"""
End-to-end gated nowcast (capstone) — does the OPERATIONAL gate capture the ORACLE gate's benefit?

Policies (held-out test day 2026-06-04, 30-min horizon, real Himawari B13):
  - persistence            : cur everywhere (cheap baseline)
  - always-learned         : learned residual everywhere (expensive everywhere)
  - operational gate       : detector fires -> learned residual; else persistence
  - oracle gate            : true onset -> learned residual; else persistence (upper bound)

Both models (learned residual corrector = B3; onset detector = §5.8) are trained on 2026-06-01/02/03 and
applied to the held-out day. Reports MAE (K) per policy + the fraction of pixels routed to the expensive
model. The gate's value: most of the oracle benefit at a fraction of the expensive-model cost.
Reads cached bt_*.npy (no satpy, no downloads).
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
from sklearn.metrics import mean_absolute_error

ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0; N_PX=4000
TRAIN=["20260601","20260602","20260603"]; TEST="20260604"

def frames(day):
    out={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hh=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1)
        out[dt.datetime.strptime(day+hh,"%Y%m%d%H%M")]=np.load(f)
    return out
def to_u8(bt):
    x=np.where(np.isfinite(bt),bt,300.0); return np.clip((x-180)/(310-180)*255,0,255).astype(np.uint8)
def advect(prev,cur,steps):
    fl=cv2.calcOpticalFlowFarneback(to_u8(prev),to_u8(cur),None,0.5,3,25,3,7,1.5,0)
    h,w=cur.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    mx=(gx+steps*fl[...,0]).astype(np.float32); my=(gy+steps*fl[...,1]).astype(np.float32)
    return cv2.remap(np.where(np.isfinite(cur),cur,300.).astype(np.float32),mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
def flow_div(prev,cur):
    fl=cv2.calcOpticalFlowFarneback(to_u8(prev),to_u8(cur),None,0.5,3,25,3,7,1.5,0)
    return np.abs(np.gradient(fl[...,0],axis=1)+np.gradient(fl[...,1],axis=0))
def texture(cur):
    f=np.where(np.isfinite(cur),cur,300.); m=cv2.blur(f,(9,9))
    return m, np.sqrt(np.clip(cv2.blur(f**2,(9,9))-m**2,0,None))

def triple_feats(p2,p1,cur):
    of=advect(p1,cur,H); tend=cur-p1; accel=(cur-p1)-(p1-p2)
    lmean,lstd=texture(cur); div=flow_div(p1,cur); rmin=np.minimum(np.minimum(cur,p1),p2)
    h,w=cur.shape; rr,cc=np.meshgrid(np.arange(h),np.arange(w),indexing="ij")
    learned=np.stack([of,cur,tend,lmean,lstd,rr/h,cc/w],-1)          # B3 feature order
    detect =np.stack([tend,accel,lstd,lmean,div,cur,rmin],-1)        # detector feature order
    return of, learned, detect

def gather(days, full=False, rng=None):
    """Collect per-pixel learned-feats, detector-feats, cur, target. full=all valid px; else subsample."""
    L,D,CUR,TGT=[],[],[],[]
    for day in days:
        fr=frames(day); ts=sorted(fr)
        for i in range(2,len(ts)):
            t=ts[i]; tgt=t+H*STEP
            if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or tgt not in fr: continue
            p2,p1,cur,act=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[tgt]
            _,learned,detect=triple_feats(p2,p1,cur)
            valid=np.isfinite(act)&np.isfinite(cur)&np.isfinite(p2)
            idx=np.argwhere(valid)
            if len(idx)==0: continue
            if not full:
                idx=idx[rng.choice(len(idx),min(N_PX,len(idx)),replace=False)]
            rr,cc=idx[:,0],idx[:,1]
            L.append(learned[rr,cc]); D.append(detect[rr,cc]); CUR.append(cur[rr,cc]); TGT.append(act[rr,cc])
    return (np.vstack(L),np.vstack(D),np.concatenate(CUR),np.concatenate(TGT))

rng=np.random.default_rng(0)
# train both models on subsampled train pixels
Ltr,Dtr,_,Ttr=gather(TRAIN,full=False,rng=rng)
resid=lgb.LGBMRegressor(n_estimators=500,learning_rate=0.05,num_leaves=63,subsample=0.8,
    colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(Ltr,Ttr)
onset_y=(np.abs(Ttr-Ltr[:,1])>THR).astype(int)   # Ltr[:,1] = cur
det=lgb.LGBMClassifier(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,
    colsample_bytree=0.8,random_state=0,n_jobs=-1,class_weight="balanced").fit(Dtr,onset_y)

# full-pixel inference on held-out test day
Lte,Dte,cur,tgt=gather([TEST],full=True)
learned_pred=resid.predict(Lte); prob=det.predict_proba(Dte)[:,1]; oracle=np.abs(tgt-cur)>THR
def mae(p): return float(mean_absolute_error(tgt,p))
def gate(mask): return np.where(mask,learned_pred,cur)

res={"experiment":"end-to-end gated nowcast, held-out 2026-06-04, 30-min","n_test_px":int(len(tgt)),
     "onset_base_rate":round(float(oracle.mean()),3),
     "persistence_MAE":round(mae(cur),3),
     "always_learned_MAE":round(mae(learned_pred),3),"always_learned_expensive_frac":1.0,
     "oracle_gate_MAE":round(mae(gate(oracle)),3),"oracle_expensive_frac":round(float(oracle.mean()),3),
     "operational_gate":{}}
for thr in [0.5,0.59,0.7]:
    m=prob>=thr
    res["operational_gate"][f"thr_{thr}"]={"MAE":round(mae(gate(m)),3),
        "expensive_frac":round(float(m.mean()),3)}
# benefit-captured: (persist - opgate) / (persist - oracle)
base=res["persistence_MAE"]; orc=res["oracle_gate_MAE"]
for k,v in res["operational_gate"].items():
    denom=(base-orc); v["benefit_captured_pct"]=round(100*(base-v["MAE"])/denom,1) if denom>0 else None
json.dump(res,open(os.path.join(os.path.dirname(__file__),"end_to_end_gate_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
