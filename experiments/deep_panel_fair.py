"""
P1 fix + P4 — FAIR deep-vs-tabular panel comparison. All four methods (persistence, optical flow,
tabular-LightGBM, deep U-Net) scored on the SAME frames, SAME valid pixels, SAME onset mask per frame.
Adds a PAIRED day-bootstrap on the tabular-minus-deep onset-MAE difference. Seasonal split (train Jan-Apr,
test May-Jun). NOT diffusion. Reads cached bt_*.npy.
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
import torch, torch.nn as nn
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0
TRAIN=["20260110","20260125","20260210","20260225","20260310","20260325","20260410","20260425"]
TEST=["20260510","20260525","20260601","20260602","20260603","20260604"]
DEV="cuda" if torch.cuda.is_available() else "cpu"
def log(*a): print(*a,flush=True)
def frames(day):
    o={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hh=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1); o[dt.datetime.strptime(day+hh,"%Y%m%d%H%M")]=np.load(f)
    return o
def to_u8(b): x=np.where(np.isfinite(b),b,300.); return np.clip((x-180)/130*255,0,255).astype(np.uint8)
def advect(p,c,s=H):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0)
    h,w=c.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    return cv2.remap(np.where(np.isfinite(c),c,300.).astype(np.float32),(gx+s*fl[...,0]).astype(np.float32),(gy+s*fl[...,1]).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
def tex(c): f=np.where(np.isfinite(c),c,300.); m=cv2.blur(f,(9,9)); return m,np.sqrt(np.clip(cv2.blur(f**2,(9,9))-m**2,0,None))
NORM=lambda x:(np.where(np.isfinite(x),x,300.)-180.)/130.
def pad8(a):
    h,w=a.shape[-2:]; ph=(8-h%8)%8; pw=(8-w%8)%8; return np.pad(a,[(0,0)]*(a.ndim-2)+[(0,ph),(0,pw)],mode="reflect"),(h,w)
class UNet(nn.Module):
    def __init__(s,ci=4,base=24):
        super().__init__()
        def blk(i,o): return nn.Sequential(nn.Conv2d(i,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True),nn.Conv2d(o,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True))
        s.e1=blk(ci,base);s.e2=blk(base,base*2);s.e3=blk(base*2,base*4);s.bott=blk(base*4,base*8);s.pool=nn.MaxPool2d(2)
        s.u3=nn.ConvTranspose2d(base*8,base*4,2,2);s.d3=blk(base*8,base*4);s.u2=nn.ConvTranspose2d(base*4,base*2,2,2);s.d2=blk(base*4,base*2);s.u1=nn.ConvTranspose2d(base*2,base,2,2);s.d1=blk(base*2,base);s.out=nn.Conv2d(base,1,1)
    def forward(s,x):
        e1=s.e1(x);e2=s.e2(s.pool(e1));e3=s.e3(s.pool(e2));b=s.bott(s.pool(e3))
        d=s.d3(torch.cat([s.u3(b),e3],1));d=s.d2(torch.cat([s.u2(d),e2],1));d=s.d1(torch.cat([s.u1(d),e1],1));return s.out(d)
def items(day):
    fr=frames(day); ts=sorted(fr); it=[]
    for i in range(2,len(ts)):                       # SAME frame set for ALL methods (needs p2)
        t=ts[i]; g=t+H*STEP
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or g not in fr: continue
        p2,p1,c,a=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[g]; it.append((p2,p1,c,a,advect(p1,c)))
    return it
def tab_feats(p2,p1,c,adv):
    tend=c-p1; lm,ls=tex(c); hh,ww=c.shape; rr,cc=np.meshgrid(np.arange(hh),np.arange(ww),indexing="ij")
    return np.stack([adv,c,tend,lm,ls,rr/hh,cc/ww],-1)   # SAME order as before
# ---- train deep + tabular on TRAIN ----
Xtr,Rtr,Lt,Tt=[],[],[],[]; rng=np.random.default_rng(0)
for d in TRAIN:
    for p2,p1,c,a,adv in items(d):
        Xtr.append(np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0).astype(np.float32)); Rtr.append((NORM(a)-NORM(adv)).astype(np.float32))
        feat=tab_feats(p2,p1,c,adv); v=np.isfinite(a)&np.isfinite(c); idx=np.argwhere(v)
        sel=idx[rng.choice(len(idx),min(3000,len(idx)),replace=False)]; Lt.append(feat[sel[:,0],sel[:,1]]); Tt.append(a[sel[:,0],sel[:,1]])
Xtr=np.stack(Xtr); Rtr=np.stack(Rtr)[:,None]; Xtr,_=pad8(Xtr); Rtr,_=pad8(Rtr)
log(f"train seqs={len(Xtr)} dev={DEV}")
xt=torch.tensor(Xtr); rt=torch.tensor(Rtr); model=UNet().to(DEV); opt=torch.optim.Adam(model.parameters(),1e-3); sc=torch.cuda.amp.GradScaler(); B=2;n=len(xt)
for ep in range(60):
    perm=torch.randperm(n); model.train()
    for i in range(0,n,B):
        idx=perm[i:i+B]; xb=xt[idx].to(DEV); rb=rt[idx].to(DEV); opt.zero_grad()
        with torch.cuda.amp.autocast(): loss=torch.mean(torch.abs(model(xb)-rb))
        sc.scale(loss).backward(); sc.step(opt); sc.update()
tab=lgb.LGBMRegressor(n_estimators=500,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(np.vstack(Lt),np.concatenate(Tt))
log("trained")
# ---- FAIR eval: identical pixels/mask per frame ----
model.eval(); perday={d:{} for d in TEST}
for d in TEST:
    it=items(d)
    if not it: perday.pop(d); continue
    X=np.stack([np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0) for p2,p1,c,a,adv in it]).astype(np.float32)
    Xp,orig=pad8(X); h0,w0=orig
    with torch.no_grad(), torch.cuda.amp.autocast():
        pr=[]; xe=torch.tensor(Xp).to(DEV)
        for i in range(0,len(xe),B): pr.append(model(xe[i:i+B]).float().cpu().numpy())
    pr=np.concatenate(pr)
    acc={k:[0.,0] for k in ["persist","of","tab","unet"]}
    for k,(p2,p1,c,a,adv) in enumerate(it):
        unet=(NORM(adv)+pr[k,0,:h0,:w0])*130.+180.
        tabp=tab.predict(tab_feats(p2,p1,c,adv).reshape(-1,7)).reshape(c.shape)
        v=np.isfinite(a)&np.isfinite(c); ons=v&(np.abs(a-c)>THR)         # SAME mask for all
        if ons.sum()==0: continue
        yy=a[ons]
        acc["persist"][0]+=np.abs(yy-c[ons]).sum();   acc["persist"][1]+=int(ons.sum())
        acc["of"][0]+=np.abs(yy-adv[ons]).sum();       acc["of"][1]+=int(ons.sum())
        acc["tab"][0]+=np.abs(yy-tabp[ons]).sum();     acc["tab"][1]+=int(ons.sum())
        acc["unet"][0]+=np.abs(yy-unet[ons]).sum();    acc["unet"][1]+=int(ons.sum())
    perday[d]=acc
days=[d for d in TEST if d in perday and perday[d]["unet"][1]>0]
def pooled(sel,k): s=sum(perday[d][k][0] for d in sel); nn_=sum(perday[d][k][1] for d in sel); return s/nn_ if nn_ else np.nan
pt={k:round(float(pooled(days,k)),2) for k in ["persist","of","tab","unet"]}
# paired bootstrap on (tab - unet) per-day MAE difference
boot={k:[] for k in pt}; diff=[]
for _ in range(2000):
    sel=list(rng.choice(days,len(days),replace=True))
    for k in pt: boot[k].append(pooled(sel,k))
    diff.append(pooled(sel,"tab")-pooled(sel,"unet"))
res={"note":"FAIR deep-vs-tabular (identical pixels+mask), seasonal holdout, onset MAE (K)","test_days":len(days),
 "onset_MAE_K":{k:{"value":pt[k],"ci95":[round(float(np.nanpercentile(boot[k],2.5)),2),round(float(np.nanpercentile(boot[k],97.5)),2)]} for k in pt},
 "paired_tab_minus_unet":{"mean":round(float(np.mean(diff)),2),"ci95":[round(float(np.nanpercentile(diff,2.5)),2),round(float(np.nanpercentile(diff,97.5)),2)],"frac_unet_better":round(float(np.mean(np.array(diff)>0)),3)}}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"deep_panel_fair_results.json"),"w"),indent=2)
log(json.dumps(res,indent=2))
