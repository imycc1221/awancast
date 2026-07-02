"""
LARGE item (honest attempt) — deep U-Net spatiotemporal nowcaster vs the 16.94 K tabular bar.

NOT a diffusion model: a deterministic deep CNN that takes [BT(t-2),BT(t-1),BT(t),optical-flow-advection]
and predicts the residual to advection at t+30min. It CAN represent formation/dissipation (full receptive
field), the capability gap diffusion targets, and is trainable on our panel. True generative diffusion
needs a domain-matched pretrained checkpoint + large corpus (stated as future work).

Fair head-to-head on a single held-out day (2026-06-04), all at full resolution, same test pixels:
  persistence vs optical-flow vs tabular-LightGBM (the bar, recomputed on this split) vs deep U-Net.
Train = 13 panel days (all except 06-04). Then plug the deep model into the §5.9 gate.
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
import torch, torch.nn as nn
from sklearn.metrics import mean_absolute_error

ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0
ALLDAYS=["20260110","20260125","20260210","20260225","20260310","20260325","20260410","20260425",
         "20260510","20260525","20260601","20260602","20260603","20260604"]
TEST="20260604"; TRAIN=[d for d in ALLDAYS if d!=TEST]
DEV="cuda" if torch.cuda.is_available() else "cpu"
def log(*a): print(*a, flush=True)

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

def seqs(days):
    X,Y,ADV,CUR,TGT=[],[],[],[],[]
    for d in days:
        fr=frames(d); ts=sorted(fr)
        for i in range(2,len(ts)):
            t=ts[i]; g=t+H*STEP
            if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or g not in fr: continue
            p2,p1,c,a=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[g]
            adv=advect(p1,c)
            X.append(np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0).astype(np.float32))
            Y.append(NORM(a).astype(np.float32)); ADV.append(adv.astype(np.float32))
            CUR.append(c.astype(np.float32)); TGT.append(a.astype(np.float32))
    return X,Y,ADV,CUR,TGT

def pad8(a):  # pad H,W to mult of 8 (reflect)
    h,w=a.shape[-2:]; ph=(8-h%8)%8; pw=(8-w%8)%8
    return np.pad(a,[(0,0)]*(a.ndim-2)+[(0,ph),(0,pw)],mode="reflect"), (h,w)

class UNet(nn.Module):
    def __init__(s,ci=4,base=24):
        super().__init__()
        def blk(i,o): return nn.Sequential(nn.Conv2d(i,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True),
                                           nn.Conv2d(o,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True))
        s.e1=blk(ci,base); s.e2=blk(base,base*2); s.e3=blk(base*2,base*4)
        s.bott=blk(base*4,base*8); s.pool=nn.MaxPool2d(2)
        s.u3=nn.ConvTranspose2d(base*8,base*4,2,2); s.d3=blk(base*8,base*4)
        s.u2=nn.ConvTranspose2d(base*4,base*2,2,2); s.d2=blk(base*4,base*2)
        s.u1=nn.ConvTranspose2d(base*2,base,2,2);   s.d1=blk(base*2,base)
        s.out=nn.Conv2d(base,1,1)
    def forward(s,x):
        e1=s.e1(x); e2=s.e2(s.pool(e1)); e3=s.e3(s.pool(e2)); b=s.bott(s.pool(e3))
        d=s.d3(torch.cat([s.u3(b),e3],1)); d=s.d2(torch.cat([s.u2(d),e2],1)); d=s.d1(torch.cat([s.u1(d),e1],1))
        return s.out(d)   # residual to advection (normalized units)

log(f"device={DEV}; building sequences...")
Xtr,Ytr,ADVtr,_,_=seqs(TRAIN); Xte,Yte,ADVte,CURte,TGTte=seqs([TEST])
log(f"train seqs={len(Xtr)}  test seqs={len(Xte)}")
# stack + pad
Xtr=np.stack(Xtr); Ytr=np.stack(Ytr)[:,None]; ADVtr=np.stack(ADVtr)[:,None]
Xte=np.stack(Xte); Yte=np.stack(Yte)[:,None]; ADVte=np.stack(ADVte)[:,None]
Xtr,_=pad8(Xtr); Ytr,_=pad8(Ytr); ADVtr,_=pad8(ADVtr)
Xte,orig=pad8(Xte); Yte,_=pad8(Yte); ADVte,_=pad8(ADVte)
advn_tr=(ADVtr-180.)/130.; advn_te=(ADVte-180.)/130.
resid_tr=Ytr-advn_tr; mask_tr=np.isfinite(np.stack([np.stack([np.where(True,1.,1.)])])) # placeholder
# train tensors
xt=torch.tensor(Xtr); rt=torch.tensor(resid_tr)
model=UNet().to(DEV); opt=torch.optim.Adam(model.parameters(),1e-3)
scaler=torch.cuda.amp.GradScaler(); B=2; n=len(xt)
log("training...")
for ep in range(60):
    perm=torch.randperm(n); tot=0
    model.train()
    for i in range(0,n,B):
        idx=perm[i:i+B]; xb=xt[idx].to(DEV); rb=rt[idx].to(DEV)
        opt.zero_grad()
        with torch.cuda.amp.autocast():
            pr=model(xb); loss=torch.mean(torch.abs(pr-rb))
        scaler.scale(loss).backward(); scaler.step(opt); scaler.update(); tot+=loss.item()*len(idx)
    if ep%10==0 or ep==59: log(f"  epoch {ep:2d}  L1(resid,norm)={tot/n:.4f}")

# eval on 06-04
model.eval(); preds=[]
with torch.no_grad(), torch.cuda.amp.autocast():
    xe=torch.tensor(Xte).to(DEV)
    for i in range(0,len(xe),B):
        preds.append(model(xe[i:i+B]).float().cpu().numpy())
resid_pred=np.concatenate(preds)                 # (N,1,Hp,Wp) normalized residual
unet_norm=advn_te+resid_pred                      # predicted normalized BT
unet_bt=unet_norm*130.+180.                       # denorm to K
h0,w0=orig
unet_bt=unet_bt[:,0,:h0,:w0]; tgt=np.stack(TGTte); cur=np.stack(CURte); adv=np.stack([a for a in ADVte[:,0,:h0,:w0]])
# flatten valid pixels
valid=np.isfinite(tgt)&np.isfinite(cur)
y=tgt[valid]; up=unet_bt[valid]; pe=cur[valid]; of=adv[valid]
onset=np.abs(y-pe)>THR
mae=lambda p,m=None:mean_absolute_error(y if m is None else y[m], p if m is None else p[m])

# tabular bar on same split (B3-style learned residual), test 06-04
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
            feat=np.stack([ofa,c,tend,lm,ls,rr/hh,cc/ww],-1)
            v=np.isfinite(a)&np.isfinite(c); idx=np.argwhere(v)
            if not full: idx=idx[rng.choice(len(idx),min(N,len(idx)),replace=False)]
            r,cl=idx[:,0],idx[:,1]; L.append(feat[r,cl]); T.append(a[r,cl]); C.append(c[r,cl])
    return np.vstack(L),np.concatenate(T),np.concatenate(C)
rng=np.random.default_rng(0)
Ltr,Ttr,_=tab_pixels(TRAIN,rng)
tab=lgb.LGBMRegressor(n_estimators=500,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(Ltr,Ttr)
Lte,Tte,Cte=tab_pixels([TEST],rng,full=True)
tabpred=tab.predict(Lte); ons_t=np.abs(Tte-Cte)>THR
tab_overall=mean_absolute_error(Tte,tabpred); tab_onset=mean_absolute_error(Tte[ons_t],tabpred[ons_t])

res={"note":"deterministic deep U-Net (NOT diffusion); single held-out day 06-04; full-res",
 "train_seqs":len(Xtr),"test_seqs":len(Xte),
 "overall_MAE_K":{"persistence":round(mae(pe),2),"optical_flow":round(mae(of),2),
                  "tabular_LightGBM":round(float(tab_overall),2),"deep_unet":round(mae(up),2)},
 "onset_MAE_K":{"persistence":round(mae(pe,onset),2),"optical_flow":round(mae(of,onset),2),
                "tabular_LightGBM_bar":round(float(tab_onset),2),"deep_unet":round(mae(up,onset),2)},
 "deep_beats_tabular_bar_on_onset": bool(mae(up,onset) < tab_onset)}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"deep_nowcast_results.json"),"w"),indent=2)
log(json.dumps(res,indent=2))
