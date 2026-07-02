"""
StormGate experiment B3 (STAND-IN) — learned residual corrector on top of optical flow,
real Himawari-9 B13, Malaysia. Train days 2026-06-01/02/03, test day 2026-06-04.

IMPORTANT: this is NOT the generative-diffusion model. It is a feasible, honest stand-in
(gradient-boosted per-pixel residual corrector) that tests the SAME hypothesis the diffusion
layer targets: can a learned correction on top of optical flow improve the cloud-field nowcast,
especially on the evolving/onset subset where advection is weak? The diffusion model proper
(DDMS/LDCast adaptation) remains future work and would replace this corrector's feature stack.

Per pixel (subsampled): features = [optical_flow_pred, persistence(cur), tendency(cur-prev),
local mean, local std, row_frac, col_frac]; target = actual BT(t+h).
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
from sklearn.metrics import mean_absolute_error

ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "himawari")
MAL_BBOX = (100.0, 1.0, 119.0, 7.0)
STEP = dt.timedelta(minutes=10)
TRAIN_DAYS = ["20260601", "20260602", "20260603"]
TEST_DAY = "20260604"
H = 3  # 30-min horizon
N_PX = 3000  # pixels sampled per triple

def parse(day, ts):
    d = os.path.join(ROOT, day)
    cache = os.path.join(d, f"bt_{ts:%H%M}.npy")
    if os.path.exists(cache): return np.load(cache)
    files = sorted(glob.glob(os.path.join(d, f"HS_H09_{ts:%Y%m%d_%H%M}_B13_*.DAT.bz2")))
    if len(files) < 3: return None
    from satpy import Scene
    scn = Scene(reader="ahi_hsd", filenames=files); scn.load(["B13"])
    arr = scn.crop(ll_bbox=MAL_BBOX)["B13"].values.astype(np.float32)
    np.save(cache, arr); return arr

def day_ts(day):
    out = set()
    for f in glob.glob(os.path.join(ROOT, day, "HS_H09_*_B13_*.DAT.bz2")):
        m = re.search(r"_(\d{8})_(\d{4})_B13_", os.path.basename(f))
        if m: out.add(dt.datetime.strptime(m.group(1)+m.group(2), "%Y%m%d%H%M"))
    return sorted(out)

def to_u8(bt):
    x = np.where(np.isfinite(bt), bt, 300.0)
    return np.clip((x-180.0)/(310.0-180.0)*255, 0, 255).astype(np.uint8)

def advect(prev, cur, steps):
    flow = cv2.calcOpticalFlowFarneback(to_u8(prev), to_u8(cur), None, 0.5,3,25,3,7,1.5,0)
    h,w = cur.shape; gx,gy = np.meshgrid(np.arange(w), np.arange(h))
    mapx=(gx+steps*flow[...,0]).astype(np.float32); mapy=(gy+steps*flow[...,1]).astype(np.float32)
    filled=np.where(np.isfinite(cur),cur,300.0).astype(np.float32)
    return cv2.remap(filled,mapx,mapy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)

def samples(day, rng):
    ts = day_ts(day); frames = {t: parse(day,t) for t in ts}
    frames = {t:a for t,a in frames.items() if a is not None}; ts=sorted(frames)
    rows=[]
    for i in range(1,len(ts)):
        t=ts[i]; tgt=t+H*STEP
        if (t-ts[i-1])!=STEP or tgt not in frames: continue
        prev,cur,act = frames[ts[i-1]],frames[t],frames[tgt]
        of = advect(prev,cur,H)
        tend = cur-prev
        lmean = cv2.blur(np.where(np.isfinite(cur),cur,300.0),(9,9))
        lstd = np.sqrt(np.clip(cv2.blur(np.where(np.isfinite(cur),cur,300.0)**2,(9,9))-lmean**2,0,None))
        h,w=cur.shape; rr,cc=np.meshgrid(np.arange(h),np.arange(w),indexing="ij")
        valid=np.isfinite(act)&np.isfinite(cur)&np.isfinite(of)
        idx=np.argwhere(valid);
        if len(idx)==0: continue
        sel=idx[rng.choice(len(idx),min(N_PX,len(idx)),replace=False)]
        for (r,c) in sel:
            rows.append([of[r,c],cur[r,c],tend[r,c],lmean[r,c],lstd[r,c],
                         r/h,c/w, act[r,c]])
    return np.array(rows,dtype=np.float32)

rng=np.random.default_rng(0)
print("building train..."); tr=np.vstack([samples(d,rng) for d in TRAIN_DAYS])
print("building test...");  te=samples(TEST_DAY,rng)
print("train rows",len(tr),"test rows",len(te))
feat=slice(0,7)
model=lgb.LGBMRegressor(n_estimators=500,learning_rate=0.05,num_leaves=63,
    subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1)
model.fit(tr[:,feat],tr[:,7])
pred=model.predict(te[:,feat])

y=te[:,7]; persist=te[:,1]; oflow=te[:,0]
onset=np.abs(y-persist)>15.0
def m(p,mask=None):
    a,b=(y,p) if mask is None else (y[mask],p[mask])
    return round(float(mean_absolute_error(a,b)),2)
res={"horizon":"30min","train_rows":int(len(tr)),"test_rows":int(len(te)),
 "overall":{"persistence":m(persist),"optical_flow":m(oflow),"learned_residual":m(pred)},
 "onset_subset":{"n":int(onset.sum()),"persistence":m(persist,onset),
                 "optical_flow":m(oflow,onset),"learned_residual":m(pred,onset)}}
res["overall"]["learned_vs_oflow_pct"]=round(100*(res["overall"]["optical_flow"]-res["overall"]["learned_residual"])/res["overall"]["optical_flow"],1)
res["onset_subset"]["learned_vs_oflow_pct"]=round(100*(res["onset_subset"]["optical_flow"]-res["onset_subset"]["learned_residual"])/res["onset_subset"]["optical_flow"],1)
json.dump(res,open(os.path.join(os.path.dirname(__file__),"learned_residual_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
