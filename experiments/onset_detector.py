"""
Operational onset detector (Codex review #3) — the missing piece that makes the regime-selective
gate REAL. Predicts whether a pixel will undergo strong cloud evolution at t+h using ONLY
issuance-time information (no future frames). Turns the post-hoc "high-change subset" into an
operational gate with precision/recall.

Issuance-time features (from frames t-2, t-1, t only): BT tendency, BT acceleration, local texture
(std), local mean, optical-flow divergence magnitude, current BT, recent cooling (min over last 3).
Label: future high-change |BT(t+3) - BT(t)| > 15 K  (30-min horizon).
Train days 2026-06-01/02/03, held-out test day 2026-06-04. Reads cached bt_*.npy (fast, no satpy).
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score, precision_recall_curve

ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0; N_PX=4000
TRAIN=["20260601","20260602","20260603"]; TEST="20260604"

def frames(day):
    out={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hhmm=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1)
        out[dt.datetime.strptime(day+hhmm,"%Y%m%d%H%M")]=np.load(f)
    return out

def to_u8(bt):
    x=np.where(np.isfinite(bt),bt,300.0); return np.clip((x-180)/(310-180)*255,0,255).astype(np.uint8)

def flow_div(prev,cur):
    fl=cv2.calcOpticalFlowFarneback(to_u8(prev),to_u8(cur),None,0.5,3,25,3,7,1.5,0)
    dvx=np.gradient(fl[...,0],axis=1); dvy=np.gradient(fl[...,1],axis=0)
    return np.abs(dvx+dvy)

def samples(day,rng):
    fr=frames(day); ts=sorted(fr); rows=[]
    for i in range(2,len(ts)):
        t=ts[i]; tgt=t+H*STEP
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or tgt not in fr: continue
        p2,p1,cur,act=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[tgt]
        tend=cur-p1; accel=(cur-p1)-(p1-p2)
        filled=np.where(np.isfinite(cur),cur,300.0)
        lmean=cv2.blur(filled,(9,9)); lstd=np.sqrt(np.clip(cv2.blur(filled**2,(9,9))-lmean**2,0,None))
        div=flow_div(p1,cur); recent_min=np.minimum(np.minimum(cur,p1),p2)
        label=(np.abs(act-cur)>THR).astype(np.int8)
        valid=np.isfinite(act)&np.isfinite(cur)&np.isfinite(p2)
        idx=np.argwhere(valid)
        if len(idx)==0: continue
        sel=idx[rng.choice(len(idx),min(N_PX,len(idx)),replace=False)]
        for (r,c) in sel:
            rows.append([tend[r,c],accel[r,c],lstd[r,c],lmean[r,c],div[r,c],cur[r,c],recent_min[r,c],label[r,c]])
    return np.array(rows,dtype=np.float32)

rng=np.random.default_rng(0)
tr=np.vstack([samples(d,rng) for d in TRAIN]); te=samples(TEST,rng)
F=slice(0,7)
clf=lgb.LGBMClassifier(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,
    colsample_bytree=0.8,random_state=0,n_jobs=-1,class_weight="balanced")
clf.fit(tr[:,F],tr[:,7])
proba=clf.predict_proba(te[:,F])[:,1]; y=te[:,7].astype(int)
base=float(y.mean()); auc=float(roc_auc_score(y,proba))
# threshold at 0.5 and at the point achieving recall>=0.60
p50,r50,f50,_=precision_recall_fscore_support(y,(proba>=0.5).astype(int),average="binary",zero_division=0)
prec,rec,thr=precision_recall_curve(y,proba)
# find highest precision with recall>=0.60
mask=rec[:-1]>=0.60
if mask.any():
    j=np.argmax(prec[:-1][mask]); p_at=float(prec[:-1][mask][j]); thr_at=float(thr[mask][j]); r_at=float(rec[:-1][mask][j])
else:
    p_at=r_at=thr_at=float("nan")
imp=dict(zip(["tendency","accel","local_std","local_mean","flow_div","cur_BT","recent_min"],
             [int(x) for x in clf.feature_importances_]))
res={"experiment":"operational onset detector, 30-min, held-out day 2026-06-04",
 "train_rows":int(len(tr)),"test_rows":int(len(te)),"base_rate_onset":round(base,3),
 "ROC_AUC":round(auc,3),
 "at_threshold_0.5":{"precision":round(float(p50),3),"recall":round(float(r50),3),"f1":round(float(f50),3)},
 "at_recall_0.60":{"precision":round(p_at,3),"recall":round(r_at,3),"threshold":round(thr_at,3)},
 "feature_importance":imp,
 "lift_at_0.6_recall_vs_baserate":round(p_at/base,2) if base>0 else None}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"onset_detector_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
