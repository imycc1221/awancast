"""
Phase 2 — plug the DEEP U-Net (best model) into the end-to-end gate as the "expensive model".
Does routing the deep model to detector-flagged onset beat the tabular gate (oracle 6.38 / op 7.02)?
Train deep U-Net + onset detector on 13 panel days; evaluate gate policies on held-out 06-04 (full frame).
NOT diffusion (deterministic CNN). Reads cached bt_*.npy.
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
import torch, torch.nn as nn
from sklearn.metrics import mean_absolute_error
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0
ALL=["20260110","20260125","20260210","20260225","20260310","20260325","20260410","20260425","20260510","20260525","20260601","20260602","20260603","20260604"]
TEST="20260604"; TRAIN=[d for d in ALL if d!=TEST]; DEV="cuda" if torch.cuda.is_available() else "cpu"
def log(*a): print(*a,flush=True)
def frames(day):
    out={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hh=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1); out[dt.datetime.strptime(day+hh,"%Y%m%d%H%M")]=np.load(f)
    return out
def to_u8(b): x=np.where(np.isfinite(b),b,300.); return np.clip((x-180)/130*255,0,255).astype(np.uint8)
def advect(p,c,s=H):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0)
    h,w=c.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    return cv2.remap(np.where(np.isfinite(c),c,300.).astype(np.float32),(gx+s*fl[...,0]).astype(np.float32),(gy+s*fl[...,1]).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
def fdiv(p,c):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0); return np.abs(np.gradient(fl[...,0],axis=1)+np.gradient(fl[...,1],axis=0))
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
def day_items(day):
    fr=frames(day); ts=sorted(fr); it=[]
    for i in range(2,len(ts)):
        t=ts[i]; g=t+H*STEP
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or g not in fr: continue
        p2,p1,c,a=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[g]; it.append((p2,p1,c,a,advect(p1,c)))
    return it
# train deep U-Net
Xtr,Rtr=[],[]
for d in TRAIN:
    for p2,p1,c,a,adv in day_items(d):
        Xtr.append(np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0).astype(np.float32)); Rtr.append((NORM(a)-NORM(adv)).astype(np.float32))
Xtr=np.stack(Xtr); Rtr=np.stack(Rtr)[:,None]; Xtr,_=pad8(Xtr); Rtr,_=pad8(Rtr)
log(f"deep train seqs={len(Xtr)} dev={DEV}")
xt=torch.tensor(Xtr); rt=torch.tensor(Rtr); model=UNet().to(DEV); opt=torch.optim.Adam(model.parameters(),1e-3); sc=torch.cuda.amp.GradScaler(); B=2;n=len(xt)
for ep in range(60):
    perm=torch.randperm(n); model.train()
    for i in range(0,n,B):
        idx=perm[i:i+B]; xb=xt[idx].to(DEV); rb=rt[idx].to(DEV); opt.zero_grad()
        with torch.cuda.amp.autocast(): loss=torch.mean(torch.abs(model(xb)-rb))
        sc.scale(loss).backward(); sc.step(opt); sc.update()
log("deep trained")
# train detector on 13 days (issuance-time feats)
def det_pix(days,rng,full=False,N=3000):
    D,Y=[],[]
    for d in days:
        for p2,p1,c,a,adv in day_items(d):
            tend=c-p1; accel=(c-p1)-(p1-p2); lm,ls=tex(c); dv=fdiv(p1,c); rmin=np.minimum(np.minimum(c,p1),p2)
            feat=np.stack([tend,accel,ls,lm,dv,c,rmin],-1); lab=(np.abs(a-c)>THR).astype(np.int8)
            v=np.isfinite(a)&np.isfinite(c)&np.isfinite(p2); idx=np.argwhere(v)
            if not full: idx=idx[rng.choice(len(idx),min(N,len(idx)),replace=False)]
            r,cl=idx[:,0],idx[:,1]; D.append(feat[r,cl]); Y.append(lab[r,cl])
    return np.vstack(D),np.concatenate(Y)
rng=np.random.default_rng(0); Dtr,Ytr=det_pix(TRAIN,rng)
det=lgb.LGBMClassifier(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1,class_weight="balanced").fit(Dtr,Ytr)
log("detector trained")
# eval on 06-04 full frame
items=day_items(TEST); X=np.stack([np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0) for p2,p1,c,a,adv in items]).astype(np.float32)
Xp,orig=pad8(X); h0,w0=orig; model.eval()
with torch.no_grad(), torch.cuda.amp.autocast():
    pr=[]; xe=torch.tensor(Xp).to(DEV)
    for i in range(0,len(xe),B): pr.append(model(xe[i:i+B]).float().cpu().numpy())
pr=np.concatenate(pr)
deep=[]; cur=[]; tgt=[]; prob=[]
for k,(p2,p1,c,a,adv) in enumerate(items):
    dbt=(NORM(adv)+pr[k,0,:h0,:w0])*130.+180.
    tend=c-p1; accel=(c-p1)-(p1-p2); lm,ls=tex(c); dv=fdiv(p1,c); rmin=np.minimum(np.minimum(c,p1),p2)
    feat=np.stack([tend,accel,ls,lm,dv,c,rmin],-1)
    v=np.isfinite(a)&np.isfinite(c)&np.isfinite(p2)
    deep.append(dbt[v]); cur.append(c[v]); tgt.append(a[v]); prob.append(det.predict_proba(feat[v])[:,1])
deep=np.concatenate(deep); cur=np.concatenate(cur); tgt=np.concatenate(tgt); prob=np.concatenate(prob)
oracle=np.abs(tgt-cur)>THR; mae=lambda p:mean_absolute_error(tgt,p); gate=lambda m:np.where(m,deep,cur)
res={"note":"DEEP U-Net as expensive model in the gate (NOT diffusion), held-out 06-04",
 "n_px":int(len(tgt)),"onset_base_rate":round(float(oracle.mean()),3),
 "persistence_MAE":round(mae(cur),3),"always_deep_MAE":round(mae(deep),3),
 "oracle_gate_MAE":round(mae(gate(oracle)),3),"oracle_frac":round(float(oracle.mean()),3),
 "operational_gate":{}}
base=res["persistence_MAE"]; orc=res["oracle_gate_MAE"]
for thr in [0.5,0.59,0.7]:
    m=prob>=thr; mv=mae(gate(m)); res["operational_gate"][f"thr_{thr}"]={"MAE":round(mv,3),"expensive_frac":round(float(m.mean()),3),"benefit_captured_pct":round(100*(base-mv)/(base-orc),1) if base>orc else None}
res["vs_tabular_gate"]={"tabular_oracle":6.379,"tabular_op_thr0.5":7.023,"deep_oracle":res["oracle_gate_MAE"],"deep_op_thr0.5":res["operational_gate"]["thr_0.5"]["MAE"]}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"deep_gate_results.json"),"w"),indent=2)
log(json.dumps(res,indent=2))
