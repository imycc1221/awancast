"""
Deep U-Net nowcaster — SEASONAL held-out validation with block-bootstrap CIs.
Train Jan-Apr (8 days), test May-Jun (6 held-out days). Per-test-day onset MAE for
persistence / optical-flow / tabular-LightGBM (bar) / deep U-Net; 95% CIs by resampling test days.
Confirms whether the single-day deep result (deep << tabular bar on onset) generalizes.
NOT diffusion: deterministic deep CNN (formation-capable). True diffusion = future work.
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
import torch, torch.nn as nn
from sklearn.metrics import mean_absolute_error
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0
TRAIN=["20260110","20260125","20260210","20260225","20260310","20260325","20260410","20260425"]
TEST =["20260510","20260525","20260601","20260602","20260603","20260604"]
DEV="cuda" if torch.cuda.is_available() else "cpu"
def log(*a): print(*a,flush=True)
def frames(day):
    out={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hh=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1)
        out[dt.datetime.strptime(day+hh,"%Y%m%d%H%M")]=np.load(f)
    return out
def to_u8(b): x=np.where(np.isfinite(b),b,300.); return np.clip((x-180)/130*255,0,255).astype(np.uint8)
def advect(p,c,s=H):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0)
    h,w=c.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    return cv2.remap(np.where(np.isfinite(c),c,300.).astype(np.float32),
        (gx+s*fl[...,0]).astype(np.float32),(gy+s*fl[...,1]).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
NORM=lambda x:(np.where(np.isfinite(x),x,300.)-180.)/130.
def pad8(a):
    h,w=a.shape[-2:]; ph=(8-h%8)%8; pw=(8-w%8)%8
    return np.pad(a,[(0,0)]*(a.ndim-2)+[(0,ph),(0,pw)],mode="reflect"),(h,w)
class UNet(nn.Module):
    def __init__(s,ci=4,base=24):
        super().__init__()
        def blk(i,o): return nn.Sequential(nn.Conv2d(i,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True),nn.Conv2d(o,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True))
        s.e1=blk(ci,base);s.e2=blk(base,base*2);s.e3=blk(base*2,base*4);s.bott=blk(base*4,base*8);s.pool=nn.MaxPool2d(2)
        s.u3=nn.ConvTranspose2d(base*8,base*4,2,2);s.d3=blk(base*8,base*4)
        s.u2=nn.ConvTranspose2d(base*4,base*2,2,2);s.d2=blk(base*4,base*2)
        s.u1=nn.ConvTranspose2d(base*2,base,2,2);s.d1=blk(base*2,base);s.out=nn.Conv2d(base,1,1)
    def forward(s,x):
        e1=s.e1(x);e2=s.e2(s.pool(e1));e3=s.e3(s.pool(e2));b=s.bott(s.pool(e3))
        d=s.d3(torch.cat([s.u3(b),e3],1));d=s.d2(torch.cat([s.u2(d),e2],1));d=s.d1(torch.cat([s.u1(d),e1],1))
        return s.out(d)
def day_seqs(day):
    fr=frames(day); ts=sorted(fr); items=[]
    for i in range(2,len(ts)):
        t=ts[i]; g=t+H*STEP
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or g not in fr: continue
        p2,p1,c,a=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[g]; adv=advect(p1,c)
        items.append((np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0).astype(np.float32),adv,c,a))
    return items

# build train tensors
Xtr=[];Rtr=[]
for d in TRAIN:
    for x,adv,c,a in day_seqs(d):
        Xtr.append(x); Rtr.append((NORM(a)-NORM(adv)).astype(np.float32))
Xtr=np.stack(Xtr); Rtr=np.stack(Rtr)[:,None]; Xtr,_=pad8(Xtr); Rtr,_=pad8(Rtr)
log(f"train seqs={len(Xtr)}; device={DEV}")
xt=torch.tensor(Xtr); rt=torch.tensor(Rtr)
model=UNet().to(DEV); opt=torch.optim.Adam(model.parameters(),1e-3); scaler=torch.cuda.amp.GradScaler(); B=2;n=len(xt)
for ep in range(60):
    perm=torch.randperm(n); model.train()
    for i in range(0,n,B):
        idx=perm[i:i+B]; xb=xt[idx].to(DEV); rb=rt[idx].to(DEV); opt.zero_grad()
        with torch.cuda.amp.autocast(): loss=torch.mean(torch.abs(model(xb)-rb))
        scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
    if ep%20==0 or ep==59: log(f"  epoch {ep} loss {loss.item():.4f}")

# tabular bar on same TRAIN
def tab_pixels(days,rng,full=False,N=3000):
    L,T,C=[],[],[]
    for d in days:
        fr=frames(d); ts=sorted(fr)
        for i in range(1,len(ts)):
            t=ts[i]; g=t+H*STEP
            if (t-ts[i-1])!=STEP or g not in fr: continue
            p1,c,a=fr[ts[i-1]],fr[t],fr[g]; ofa=advect(p1,c); tend=c-p1
            f=np.where(np.isfinite(c),c,300.); lm=cv2.blur(f,(9,9)); ls=np.sqrt(np.clip(cv2.blur(f**2,(9,9))-lm**2,0,None))
            hh,ww=c.shape; rr,cc=np.meshgrid(np.arange(hh),np.arange(ww),indexing="ij")
            feat=np.stack([ofa,c,tend,lm,ls,rr/hh,cc/ww],-1); v=np.isfinite(a)&np.isfinite(c); idx=np.argwhere(v)
            if not full: idx=idx[rng.choice(len(idx),min(N,len(idx)),replace=False)]
            r,cl=idx[:,0],idx[:,1]; L.append(feat[r,cl]); T.append(a[r,cl]); C.append(c[r,cl])
    return np.vstack(L),np.concatenate(T),np.concatenate(C)
rng=np.random.default_rng(0)
Ltr,Ttr,_=tab_pixels(TRAIN,rng); tab=lgb.LGBMRegressor(n_estimators=500,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(Ltr,Ttr)

# per-test-day onset abs errors
model.eval(); perday={}
for d in TEST:
    items=day_seqs(d)
    if not items: continue
    X=np.stack([it[0] for it in items]); Xp,orig=pad8(X); h0,w0=orig
    with torch.no_grad(), torch.cuda.amp.autocast():
        pr=[]; xe=torch.tensor(Xp).to(DEV)
        for i in range(0,len(xe),B): pr.append(model(xe[i:i+B]).float().cpu().numpy())
    pr=np.concatenate(pr)  # residual norm
    adv=np.stack([it[1] for it in items]); cur=np.stack([it[2] for it in items]); tgt=np.stack([it[3] for it in items])
    unet=( (NORM(adv)+pr[:,0,:h0,:w0])*130.+180. )
    # tabular for this day
    Lte,Tte,Cte=tab_pixels([d],rng,full=True); tp=tab.predict(Lte); ons_t=np.abs(Tte-Cte)>THR
    v=np.isfinite(tgt)&np.isfinite(cur); y=tgt[v]; up=unet[v]; pe=cur[v]; of=adv[v]; ons=np.abs(y-pe)>THR
    perday[d]={"unet":(np.abs(y[ons]-up[ons]).sum(),ons.sum()),
               "persist":(np.abs(y[ons]-pe[ons]).sum(),ons.sum()),
               "of":(np.abs(y[ons]-of[ons]).sum(),ons.sum()),
               "tab":(np.abs(Tte[ons_t]-tp[ons_t]).sum(),ons_t.sum())}
days=list(perday)
def pooled(sel,key):
    s=sum(perday[d][key][0] for d in sel); nn_=sum(perday[d][key][1] for d in sel); return s/nn_ if nn_ else np.nan
pt={k:round(float(pooled(days,k)),2) for k in ["persist","of","tab","unet"]}
boot={k:[] for k in pt}
for _ in range(2000):
    sel=list(rng.choice(days,len(days),replace=True))
    for k in pt: boot[k].append(pooled(sel,k))
res={"note":"deep U-Net (NOT diffusion), seasonal holdout train Jan-Apr / test May-Jun, onset MAE (K)",
 "train_seqs":int(len(Xtr)),"test_days":len(days),"onset_MAE_K":{},}
for k in pt:
    arr=np.array(boot[k]); res["onset_MAE_K"][k]={"value":pt[k],
        "ci95":[round(float(np.nanpercentile(arr,2.5)),2),round(float(np.nanpercentile(arr,97.5)),2)]}
res["deep_beats_tabular_bar"]=bool(pt["unet"]<pt["tab"])
json.dump(res,open(os.path.join(os.path.dirname(__file__),"deep_nowcast_panel_results.json"),"w"),indent=2)
log(json.dumps(res,indent=2))
