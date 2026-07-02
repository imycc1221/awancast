"""
C5 / B3 — frozen Prithvi-EO-100M embedding ablation. Run Himawari B13 stacks through the FROZEN Prithvi-EO
encoder (a 6-band optical MAE ViT — domain-mismatched to 1-band thermal IR, used as a generic feature
extractor), extract spatial patch-token embeddings, PCA them, add as per-pixel features to the B3 LightGBM
residual corrector, and compare onset MAE WITH vs WITHOUT the embeddings. Train 0601/02/03, test 0604.
Honest test of whether out-of-domain pretrained features transfer. NOT diffusion.
"""
import glob, os, re, sys, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb, yaml
import torch
from sklearn.decomposition import PCA
from sklearn.metrics import mean_absolute_error
MDIR=os.path.join(os.path.dirname(__file__),"..","models","prithvi_eo_100m"); sys.path.insert(0,MDIR)
from prithvi_mae import PrithviMAE
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari"); STEP=dt.timedelta(minutes=10); H=3; THR=15.0
TRAIN=["20260601","20260602","20260603"]; TEST="20260604"; DEV="cuda" if torch.cuda.is_available() else "cpu"
NPCA=16
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
def items(day):
    fr=frames(day); ts=sorted(fr); it=[]
    for i in range(2,len(ts)):
        t=ts[i]; g=t+H*STEP
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or g not in fr: continue
        it.append((fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[g],advect(fr[ts[i-1]],fr[t])))
    return it
# ---- load frozen Prithvi-EO encoder ----
cfg=yaml.safe_load(open(os.path.join(MDIR,"config.yaml")))["model_args"]; cfg["num_frames"]=3; cfg["in_chans"]=6
model=PrithviMAE(**cfg); sd=torch.load(os.path.join(MDIR,"Prithvi_EO_V1_100M.pt"),map_location="cpu")
sd=sd.get("model",sd); model.load_state_dict(sd,strict=False); enc=model.encoder.to(DEV).eval()
for p in enc.parameters(): p.requires_grad=False
log("Prithvi-EO encoder loaded (frozen)")
def embed_grid(p2,p1,c):
    # build [1,6,3,224,224]: 3 frames (p2,p1,c), single BT band replicated to 6, z-scored, resized
    fr3=[]
    for f in (p2,p1,c):
        z=(np.where(np.isfinite(f),f,300.)-260.)/30.0            # rough BT z-score
        z=cv2.resize(z.astype(np.float32),(224,224))
        fr3.append(np.repeat(z[None],6,axis=0))                  # 6 bands (replicated)
    x=torch.tensor(np.stack(fr3,axis=1)[None]).float().to(DEV)   # [1,6,3,224,224]
    with torch.no_grad(), torch.cuda.amp.autocast():
        feats=enc.forward_features(x)[-1]                        # [1, 1+T*196, 768]
    tok=feats[0,1:].float().cpu().numpy()                        # drop CLS -> [T*196,768]
    tok=tok.reshape(3,14,14,768).mean(0)                         # mean over time -> [14,14,768]
    return tok
def b3_feats(p2,p1,c,grid_pca,Hc,Wc):
    of=advect(p1,c); tend=c-p1; lm,ls=tex(c); hh,ww=c.shape; rr,cc=np.meshgrid(np.arange(hh),np.arange(ww),indexing="ij")
    base=np.stack([of,c,tend,lm,ls,rr/hh,cc/ww],-1)              # (h,w,7)
    up=cv2.resize(grid_pca,(Wc,Hc),interpolation=cv2.INTER_LINEAR)  # (h,w,NPCA)
    return np.concatenate([base,up],-1)                          # (h,w,7+NPCA)
# ---- collect grids + fit PCA on train tokens ----
tr_items={d:items(d) for d in TRAIN}; te_items=items(TEST)
log("running Prithvi on train+test frames...")
tr_grids={d:[embed_grid(p2,p1,c) for p2,p1,c,a,adv in tr_items[d]] for d in TRAIN}
te_grids=[embed_grid(p2,p1,c) for p2,p1,c,a,adv in te_items]
allg=np.concatenate([np.array(g).reshape(-1,768) for g in tr_grids.values()],0)
pca=PCA(n_components=NPCA,random_state=0).fit(allg); log(f"PCA fit; explained var {pca.explained_variance_ratio_.sum():.2f}")
def grid_pca(g): return pca.transform(g.reshape(-1,768)).reshape(14,14,NPCA).astype(np.float32)
# ---- build per-pixel datasets (subsample train), with and without Prithvi dims ----
rng=np.random.default_rng(0); Xtr,Ytr=[],[]
for d in TRAIN:
    for (p2,p1,c,a,adv),g in zip(tr_items[d],tr_grids[d]):
        F=b3_feats(p2,p1,c,grid_pca(g),*c.shape); v=np.isfinite(a)&np.isfinite(c); idx=np.argwhere(v)
        sel=idx[rng.choice(len(idx),min(3000,len(idx)),replace=False)]; Xtr.append(F[sel[:,0],sel[:,1]]); Ytr.append(a[sel[:,0],sel[:,1]])
Xtr=np.vstack(Xtr); Ytr=np.concatenate(Ytr)
# test: full pixels
Xte,Yte,Cte=[],[],[]
for (p2,p1,c,a,adv),g in zip(te_items,te_grids):
    F=b3_feats(p2,p1,c,grid_pca(g),*c.shape); v=np.isfinite(a)&np.isfinite(c)
    Xte.append(F[v]); Yte.append(a[v]); Cte.append(c[v])
Xte=np.vstack(Xte); Yte=np.concatenate(Yte); Cte=np.concatenate(Cte); ons=np.abs(Yte-Cte)>THR
BASE=slice(0,7); ALL=slice(0,7+NPCA)
def fit_eval(cols):
    m=lgb.LGBMRegressor(n_estimators=500,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(Xtr[:,cols],Ytr)
    p=m.predict(Xte[:,cols]); return round(float(mean_absolute_error(Yte[ons],p[ons])),2),round(float(mean_absolute_error(Yte,p)),2)
base_on,base_all=fit_eval(BASE); pri_on,pri_all=fit_eval(ALL)
res={"note":"frozen Prithvi-EO-100M embedding ablation (B3 LightGBM), held-out 06-04; 6-band OPTICAL model on 1-band thermal IR",
 "pca_components":NPCA,"baseline_no_embed":{"onset_MAE":base_on,"overall_MAE":base_all},
 "with_prithvi_embed":{"onset_MAE":pri_on,"overall_MAE":pri_all},
 "delta_onset_K":round(pri_on-base_on,2),
 "interpretation":"negative delta => EO embeddings helped; ~0/positive => no transfer (expected; optical->thermal-IR mismatch)"}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"prithvi_ablation_results.json"),"w"),indent=2)
log(json.dumps(res,indent=2))
