"""
Panel evaluation (Codex review #1) — consolidate B2/B3 + detector + end-to-end gate across a
14-day, seasonally-spread Himawari panel with day-level BLOCK-BOOTSTRAP 95% CIs.
Seasonal split: train Jan-Apr (8 days), test May-Jun (6 held-out days). Reads cached bt_*.npy.

Headline metrics (pooled over test-day pixels), each with a CI from resampling TEST DAYS:
  - optical-flow high-change skill vs persistence
  - learned-residual onset-subset MAE gain vs persistence
  - operational onset detector ROC-AUC
  - end-to-end gate benefit-captured (op-gate thr 0.5) + expensive fraction
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2, lightgbm as lgb
from sklearn.metrics import mean_absolute_error, roc_auc_score
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0; N_PX=3000
TRAIN=["20260110","20260125","20260210","20260225","20260310","20260325","20260410","20260425"]
TEST =["20260510","20260525","20260601","20260602","20260603","20260604"]

def frames(day):
    out={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hh=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1)
        out[dt.datetime.strptime(day+hh,"%Y%m%d%H%M")]=np.load(f)
    return out
def to_u8(b): x=np.where(np.isfinite(b),b,300.); return np.clip((x-180)/130*255,0,255).astype(np.uint8)
def advect(p,c,s):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0)
    h,w=c.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    return cv2.remap(np.where(np.isfinite(c),c,300.).astype(np.float32),
        (gx+s*fl[...,0]).astype(np.float32),(gy+s*fl[...,1]).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
def fdiv(p,c):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0)
    return np.abs(np.gradient(fl[...,0],axis=1)+np.gradient(fl[...,1],axis=0))
def tex(c): f=np.where(np.isfinite(c),c,300.); m=cv2.blur(f,(9,9)); return m,np.sqrt(np.clip(cv2.blur(f**2,(9,9))-m**2,0,None))

def day_pixels(day,rng,full=False):
    fr=frames(day); ts=sorted(fr); L,D,cur_l,tgt_l,of_l=[],[],[],[],[]
    for i in range(2,len(ts)):
        t=ts[i]; g=t+H*STEP
        if (t-ts[i-1])!=STEP or (ts[i-1]-ts[i-2])!=STEP or g not in fr: continue
        p2,p1,c,a=fr[ts[i-2]],fr[ts[i-1]],fr[t],fr[g]
        of=advect(p1,c,H); tend=c-p1; accel=(c-p1)-(p1-p2); lm,ls=tex(c); dv=fdiv(p1,c)
        rmin=np.minimum(np.minimum(c,p1),p2); h,w=c.shape
        rr,cc=np.meshgrid(np.arange(h),np.arange(w),indexing="ij")
        learned=np.stack([of,c,tend,lm,ls,rr/h,cc/w],-1); detect=np.stack([tend,accel,ls,lm,dv,c,rmin],-1)
        v=np.isfinite(a)&np.isfinite(c)&np.isfinite(p2); idx=np.argwhere(v)
        if len(idx)==0: continue
        if not full: idx=idx[rng.choice(len(idx),min(N_PX,len(idx)),replace=False)]
        r,cl=idx[:,0],idx[:,1]
        L.append(learned[r,cl]); D.append(detect[r,cl]); cur_l.append(c[r,cl]); tgt_l.append(a[r,cl]); of_l.append(of[r,cl])
    if not L: return None
    return dict(L=np.vstack(L),D=np.vstack(D),cur=np.concatenate(cur_l),tgt=np.concatenate(tgt_l),of=np.concatenate(of_l))

rng=np.random.default_rng(0)
# train
Ltr=[];Dtr=[];Ttr=[]
for d in TRAIN:
    pk=day_pixels(d,rng)
    if pk: Ltr.append(pk["L"]);Dtr.append(pk["D"]);Ttr.append(pk["tgt"])
Ltr=np.vstack(Ltr);Dtr=np.vstack(Dtr);Ttr=np.concatenate(Ttr)
resid=lgb.LGBMRegressor(n_estimators=500,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(Ltr,Ttr)
det=lgb.LGBMClassifier(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1,class_weight="balanced").fit(Dtr,(np.abs(Ttr-Ltr[:,1])>THR).astype(int))

# per-test-day signals
days={}
for d in TEST:
    pk=day_pixels(d,rng)
    if not pk: continue
    pk["learned"]=resid.predict(pk["L"]); pk["prob"]=det.predict_proba(pk["D"])[:,1]
    days[d]=pk
tlist=list(days)

def metrics(sel):
    cur=np.concatenate([days[d]["cur"] for d in sel]); tgt=np.concatenate([days[d]["tgt"] for d in sel])
    of=np.concatenate([days[d]["of"] for d in sel]); lp=np.concatenate([days[d]["learned"] for d in sel])
    pr=np.concatenate([days[d]["prob"] for d in sel]); hc=np.abs(tgt-cur)>THR
    mae=lambda p,m=None:mean_absolute_error(tgt if m is None else tgt[m], p if m is None else p[m])
    of_skill=1-mae(of,hc)/mae(cur,hc)
    learn_gain=100*(mae(cur,hc)-mae(lp,hc))/mae(cur,hc)
    auc=roc_auc_score(hc.astype(int),pr) if hc.any() and (~hc).any() else np.nan
    base=mae(cur); orc=mae(np.where(hc,lp,cur)); op=mae(np.where(pr>=0.5,lp,cur))
    benefit=100*(base-op)/(base-orc) if base>orc else np.nan
    frac=float((pr>=0.5).mean())
    return dict(of_highchange_skill=of_skill,learned_onset_gain_pct=learn_gain,detector_AUC=auc,
                gate_benefit_pct=benefit,gate_expensive_frac=frac)

point=metrics(tlist)
# block bootstrap over test days
B=2000; boot={k:[] for k in point}
for _ in range(B):
    sel=list(rng.choice(tlist,len(tlist),replace=True))
    m=metrics(sel)
    for k in boot: boot[k].append(m[k])
res={"panel":{"train_days":len(TRAIN),"test_days":len(tlist),"horizon":"30min"},"metrics":{}}
for k,v in point.items():
    arr=np.array(boot[k]);
    res["metrics"][k]={"value":round(float(v),3),
        "ci95":[round(float(np.nanpercentile(arr,2.5)),3),round(float(np.nanpercentile(arr,97.5)),3)]}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"panel_eval_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
