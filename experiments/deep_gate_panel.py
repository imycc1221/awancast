"""
C4 (A2+A3) — port the end-to-end gate with the DEEP model to the SEASONAL panel with day-bootstrap CIs,
using a 3-SEED deep ensemble (addresses single-seed variance). Train Jan-Apr (8 days), test May-Jun (6).
Policies per test day (full frame): persistence, always-deep(ensemble), oracle-gate, op-gate@0.5.
Day-block-bootstrap 95% CIs over the 6 test days. NOT diffusion. Reads cached bt_*.npy.
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
import torch, torch.nn as nn
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0; SEEDS=[0,1,2]
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
def items(day):
    fr=frames(day); ts=sorted(fr); it=[]
    for i in range(2,len(ts)):
        t=ts[i]; g=t+H*STEP
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or g not in fr: continue
        p2,p1,c,a=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[g]; it.append((p2,p1,c,a,advect(p1,c)))
    return it
# detector features (issuance-time)
def det_feat(p2,p1,c):
    tend=c-p1; accel=(c-p1)-(p1-p2); lm,ls=tex(c); dv=fdiv(p1,c); rmin=np.minimum(np.minimum(c,p1),p2)
    return np.stack([tend,accel,ls,lm,dv,c,rmin],-1)
# ---- train deep ensemble + detector on TRAIN ----
Xtr,Rtr,Dtr,Ytr=[],[],[],[]; rng=np.random.default_rng(0)
for d in TRAIN:
    for p2,p1,c,a,adv in items(d):
        Xtr.append(np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0).astype(np.float32)); Rtr.append((NORM(a)-NORM(adv)).astype(np.float32))
        f=det_feat(p2,p1,c); v=np.isfinite(a)&np.isfinite(c)&np.isfinite(p2); idx=np.argwhere(v); sel=idx[rng.choice(len(idx),min(3000,len(idx)),replace=False)]
        Dtr.append(f[sel[:,0],sel[:,1]]); Ytr.append((np.abs(a-c)>THR).astype(np.int8)[sel[:,0],sel[:,1]])
Xtr=np.stack(Xtr); Rtr=np.stack(Rtr)[:,None]; Xtr,_=pad8(Xtr); Rtr,_=pad8(Rtr)
det=lgb.LGBMClassifier(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1,class_weight="balanced").fit(np.vstack(Dtr),np.concatenate(Ytr))
log(f"train seqs={len(Xtr)} dev={DEV}; training {len(SEEDS)} seeds")
xt=torch.tensor(Xtr); rt=torch.tensor(Rtr); n=len(xt); models=[]
for sd in SEEDS:
    torch.manual_seed(sd); m=UNet().to(DEV); opt=torch.optim.Adam(m.parameters(),1e-3); sc=torch.cuda.amp.GradScaler(); B=2
    for ep in range(60):
        perm=torch.randperm(n); m.train()
        for i in range(0,n,B):
            idx=perm[i:i+B]; xb=xt[idx].to(DEV); rb=rt[idx].to(DEV); opt.zero_grad()
            with torch.cuda.amp.autocast(): loss=torch.mean(torch.abs(m(xb)-rb))
            sc.scale(loss).backward(); sc.step(opt); sc.update()
    m.eval(); models.append(m); log(f"seed {sd} done")
# ---- per-test-day gate policies (full frame), + per-seed onset MAE ----
perday={}; seed_onset={sd:[] for sd in SEEDS}
for d in TEST:
    it=items(d)
    if not it: continue
    X=np.stack([np.stack([NORM(p2),NORM(p1),NORM(c),NORM(adv)],0) for p2,p1,c,a,adv in it]).astype(np.float32); Xp,orig=pad8(X); h0,w0=orig
    preds=[]
    for m in models:
        with torch.no_grad(), torch.cuda.amp.autocast():
            pr=[]; xe=torch.tensor(Xp).to(DEV)
            for i in range(0,len(xe),B): pr.append(m(xe[i:i+B]).float().cpu().numpy())
        preds.append(np.concatenate(pr)[:,0,:h0,:w0])
    preds=np.stack(preds)              # (seeds, Nf, h, w) residual
    acc={k:[0.,0.,0] for k in ["persist","always_deep","oracle","opgate"]}  # sum_ae(all), sum_ae?, n
    seed_ae={sd:[0.,0] for sd in SEEDS}
    for k,(p2,p1,c,a,adv) in enumerate(it):
        ens=(NORM(adv)+preds[:,k].mean(0))*130.+180.
        prob=det.predict_proba(det_feat(p2,p1,c).reshape(-1,7))[:,1].reshape(c.shape)
        v=np.isfinite(a)&np.isfinite(c)&np.isfinite(p2); ons=v&(np.abs(a-c)>THR)
        yv=a[v]; cv=c[v]; nv=int(v.sum())
        og=np.where(np.abs(a-c)>THR,ens,c); opg=np.where(prob>=0.5,ens,c)
        acc["persist"][0]+=np.abs(yv-cv).sum();      acc["persist"][2]+=nv
        acc["always_deep"][0]+=np.abs(yv-ens[v]).sum(); acc["always_deep"][2]+=nv
        acc["oracle"][0]+=np.abs(yv-og[v]).sum();    acc["oracle"][2]+=nv
        acc["opgate"][0]+=np.abs(yv-opg[v]).sum();   acc["opgate"][2]+=nv
        for si,sd in enumerate(SEEDS):
            sp=(NORM(adv)+preds[si,k])*130.+180.
            if ons.sum()>0: seed_ae[sd][0]+=np.abs(a[ons]-sp[ons]).sum(); seed_ae[sd][1]+=int(ons.sum())
    perday[d]=acc
    for sd in SEEDS:
        if seed_ae[sd][1]>0: seed_onset[sd].append(seed_ae[sd][0]/seed_ae[sd][1])
days=list(perday); rb=np.random.default_rng(0)
def pooled(sel,k): s=sum(perday[d][k][0] for d in sel); nn_=sum(perday[d][k][2] for d in sel); return s/nn_ if nn_ else np.nan
def boot(k):
    pt=pooled(days,k); bs=[pooled(list(rb.choice(days,len(days),replace=True)),k) for _ in range(2000)]
    return round(float(pt),3),[round(float(np.nanpercentile(bs,2.5)),3),round(float(np.nanpercentile(bs,97.5)),3)]
res={"note":"C4: deep-ensemble gate on seasonal panel, full-frame MAE (K), day-bootstrap CIs","test_days":len(days),"seeds":len(SEEDS)}
for k in ["persist","always_deep","oracle","opgate"]:
    v,ci=boot(k); res[k]={"MAE":v,"ci95":ci}
# benefit captured CI
def bcap(sel): b=pooled(sel,"persist"); o=pooled(sel,"oracle"); g=pooled(sel,"opgate"); return 100*(b-g)/(b-o) if b>o else np.nan
bs=[bcap(list(rb.choice(days,len(days),replace=True))) for _ in range(2000)]
res["opgate_benefit_pct"]={"value":round(float(bcap(days)),1),"ci95":[round(float(np.nanpercentile(bs,2.5)),1),round(float(np.nanpercentile(bs,97.5)),1)]}
res["deep_onset_MAE_per_seed_meanK"]={str(sd):round(float(np.mean(seed_onset[sd])),2) for sd in SEEDS}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"deep_gate_panel_results.json"),"w"),indent=2)
log(json.dumps(res,indent=2))
