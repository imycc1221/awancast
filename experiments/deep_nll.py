"""
C2 (Agent-1 #1) — probabilistic head on the deep U-Net: predict per-pixel mean residual + log-variance,
train with Gaussian NLL. Tests whether the STRONG model yields a USABLE calibrated uncertainty (the gap
§5.11 flagged: 3-seed ensemble spread had only corr 0.16 with error). Same setup as deep_nowcast.py
(train 13 panel days, held-out 06-04) so sigma-calibration is directly comparable to the ensemble spread.
NOT diffusion. Reads cached bt_*.npy.
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2
import torch, torch.nn as nn
from sklearn.metrics import mean_absolute_error
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0
ALL=["20260110","20260125","20260210","20260225","20260310","20260325","20260410","20260425","20260510","20260525","20260601","20260602","20260603","20260604"]
TEST="20260604"; TRAIN=[d for d in ALL if d!=TEST]; DEV="cuda" if torch.cuda.is_available() else "cpu"
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
NORM=lambda x:(np.where(np.isfinite(x),x,300.)-180.)/130.
def pad8(a):
    h,w=a.shape[-2:]; ph=(8-h%8)%8; pw=(8-w%8)%8; return np.pad(a,[(0,0)]*(a.ndim-2)+[(0,ph),(0,pw)],mode="reflect"),(h,w)
class UNet(nn.Module):
    def __init__(s,ci=4,base=24,co=2):                 # co=2: [mean residual, log_var]
        super().__init__()
        def blk(i,o): return nn.Sequential(nn.Conv2d(i,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True),nn.Conv2d(o,o,3,1,1),nn.BatchNorm2d(o),nn.ReLU(True))
        s.e1=blk(ci,base);s.e2=blk(base,base*2);s.e3=blk(base*2,base*4);s.bott=blk(base*4,base*8);s.pool=nn.MaxPool2d(2)
        s.u3=nn.ConvTranspose2d(base*8,base*4,2,2);s.d3=blk(base*8,base*4);s.u2=nn.ConvTranspose2d(base*4,base*2,2,2);s.d2=blk(base*4,base*2);s.u1=nn.ConvTranspose2d(base*2,base,2,2);s.d1=blk(base*2,base);s.out=nn.Conv2d(base,co,1)
    def forward(s,x):
        e1=s.e1(x);e2=s.e2(s.pool(e1));e3=s.e3(s.pool(e2));b=s.bott(s.pool(e3))
        d=s.d3(torch.cat([s.u3(b),e3],1));d=s.d2(torch.cat([s.u2(d),e2],1));d=s.d1(torch.cat([s.u1(d),e1],1));return s.out(d)
def items(day):
    fr=frames(day); ts=sorted(fr); it=[]
    for i in range(2,len(ts)):
        t=ts[i]; g=t+H*STEP
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or g not in fr: continue
        p2,p1,c,a=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[g]; it.append((p2,p1,c,a,advect(p1,c)))
    return it
Xtr,Rtr=[],[]
for d in TRAIN:
    for p2,p1,c,a,adv in items(d): Xtr.append(np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0).astype(np.float32)); Rtr.append((NORM(a)-NORM(adv)).astype(np.float32))
Xtr=np.stack(Xtr); Rtr=np.stack(Rtr)[:,None]; Xtr,_=pad8(Xtr); Rtr,_=pad8(Rtr)
xt=torch.tensor(Xtr); rt=torch.tensor(Rtr); n=len(xt); log(f"train seqs={n} dev={DEV}")
model=UNet().to(DEV); opt=torch.optim.Adam(model.parameters(),1e-3); scaler=torch.cuda.amp.GradScaler(); B=2
def nll(out,tgt):
    mu=out[:,0:1]; logv=torch.clamp(out[:,1:2],-7,3)
    return torch.mean(0.5*(logv+(mu-tgt)**2/torch.exp(logv)))
for ep in range(60):
    perm=torch.randperm(n); model.train()
    for i in range(0,n,B):
        idx=perm[i:i+B]; xb=xt[idx].to(DEV); rb=rt[idx].to(DEV); opt.zero_grad()
        with torch.cuda.amp.autocast(): loss=nll(model(xb),rb)
        scaler.scale(loss).backward(); scaler.step(opt); scaler.update()
    if ep%20==0 or ep==59: log(f"ep {ep} nll {loss.item():.3f}")
# eval 06-04
te=items(TEST); X=np.stack([np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0) for p2,p1,c,a,adv in te]).astype(np.float32)
Xp,orig=pad8(X); h0,w0=orig; model.eval()
with torch.no_grad(), torch.cuda.amp.autocast():
    out=[]; xe=torch.tensor(Xp).to(DEV)
    for i in range(0,len(xe),B): out.append(model(xe[i:i+B]).float().cpu().numpy())
out=np.concatenate(out)
adv=np.stack([a for *_,a in te]) if False else np.stack([t[4] for t in te])
cur=np.stack([t[2] for t in te]); tgt=np.stack([t[3] for t in te])
mu=out[:,0,:h0,:w0]; sigma=np.exp(0.5*np.clip(out[:,1,:h0,:w0],-7,3))   # normalized-unit sigma
pred=(NORM(adv)+mu)*130.+180.                                          # BT prediction (K)
v=np.isfinite(tgt)&np.isfinite(cur); y=tgt[v]; pp=pred[v]; sg=sigma[v]; cc=cur[v]
onset=np.abs(y-cc)>THR; ae=np.abs(y-pp)
mae_onset=float(mean_absolute_error(y[onset],pp[onset])); mae_all=float(mean_absolute_error(y,pp))
corr=float(np.corrcoef(sg,ae)[0,1])
q=np.quantile(sg,[0.25,0.5,0.75]); b=np.digitize(sg,q); err_by_q=[round(float(ae[b==k].mean()),2) for k in range(4)]
res={"note":"deep U-Net + Gaussian-NLL probabilistic head (NOT diffusion), held-out 06-04",
 "onset_MAE_K":round(mae_onset,2),"overall_MAE_K":round(mae_all,2),
 "predicted_sigma_vs_error_corr":round(corr,3),"mean_abs_error_by_sigma_quartile":err_by_q,
 "baseline_ensemble_spread_corr":0.156,
 "interpretation":"if corr > ensemble 0.156 and error rises monotonically with sigma-quartile, the NLL head gives a usable predictive uncertainty (closing the §5.11 gap)"}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"deep_nll_results.json"),"w"),indent=2)
log(json.dumps(res,indent=2))
