"""
BT -> irradiance link (reviewer R1-a). Pairs Himawari-8 cloud-top BT at Petaling Jaya (2020) with the
NSRDB GHI / clear-sky-index you already have for 2020. Two questions:
  (1) LINK: does cloud-top BT carry the solar signal? -> corr(BT, k) and a BT->k map's R2 / GHI MAE.
  (2) TRANSLATION: does nowcasting BT translate to GHI skill? -> persistence-BT vs optical-flow-BT at +30min,
      mapped to GHI via the BT->k map, MAE(W/m2) vs persistence-GHI baseline.
k = clear-sky index = GHI / Clearsky GHI. GHI = k * Clearsky GHI (removes solar-geometry confound).
"""
import os, glob, datetime as dt, json
import numpy as np, pandas as pd, cv2
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import mean_absolute_error

OUT=os.path.join(os.path.dirname(__file__),"..","data","himawari8_pj","bt_pj_2020.npz")
NSRDB=os.path.join(os.path.dirname(__file__),"..","data","nsrdb","petaling_jaya_2020.csv")
PJ_BBOX=(100.5,2.0,102.5,4.0); PJ=(101.61,3.11); STEP=3  # 30 min

d=np.load(OUT,allow_pickle=True); P=d["patches"]; utc=[dt.datetime.fromisoformat(s) for s in d["utc"]]
H,W=P.shape[1:]
crow=int(round((PJ_BBOX[3]-PJ[1])/(PJ_BBOX[3]-PJ_BBOX[1])*H)); ccol=int(round((PJ[0]-PJ_BBOX[0])/(PJ_BBOX[2]-PJ_BBOX[0])*W))
crow=min(max(crow,2),H-3); ccol=min(max(ccol,2),W-3)
def center(a): return float(np.nanmean(a[crow-2:crow+3,ccol-2:ccol+3]))   # 5x5 mean at PJ
bt_pj=np.array([center(p) for p in P])

# NSRDB 2020 (local time UTC+8)
df=pd.read_csv(NSRDB,skiprows=2)
df["dt_local"]=pd.to_datetime(df[["Year","Month","Day","Hour","Minute"]])
for c in ["GHI","Clearsky GHI"]: df[c]=pd.to_numeric(df[c],errors="coerce")
df["k"]=(df["GHI"]/df["Clearsky GHI"].replace(0,np.nan)).clip(0,1.5)
idx=pd.DatetimeIndex(df["dt_local"])
def nsrdb_at(utc_t):
    loc=utc_t+dt.timedelta(hours=8)
    j=idx.get_indexer([pd.Timestamp(loc)],method="nearest")[0]
    r=df.iloc[j]
    if abs((idx[j]-pd.Timestamp(loc)).total_seconds())>600: return None
    return float(r["GHI"]),float(r["Clearsky GHI"]),float(r["k"])

# pair frames with NSRDB
rows=[]
for i,t in enumerate(utc):
    m=nsrdb_at(t)
    if m is None or not np.isfinite(bt_pj[i]) or m[1]<20: continue   # daytime only (clearsky>20)
    rows.append((i,t,bt_pj[i],*m))
pair=pd.DataFrame(rows,columns=["fi","utc","bt","ghi","cs","k"]).dropna()
print("paired samples:",len(pair),flush=True)

# (1) LINK — LEAVE-ONE-DAY-OUT (honest out-of-sample; map never sees the day it predicts)
corr=float(np.corrcoef(pair["bt"],pair["k"])[0,1])
pair["day"]=pair["utc"].apply(lambda t:t.date())
day_map={}                                              # day -> iso fit on the OTHER days
for dday in pair["day"].unique():
    tr=pair[pair["day"]!=dday]
    day_map[dday]=IsotonicRegression(increasing=True,out_of_bounds="clip").fit(tr["bt"],tr["k"])
k_hat=np.array([day_map[r.day].predict([r.bt])[0] for r in pair.itertuples()])
ghi_hat=k_hat*pair["cs"].values
r2=1-np.sum((pair["k"].values-k_hat)**2)/np.sum((pair["k"].values-pair["k"].mean())**2)
ghi_mae_fit=mean_absolute_error(pair["ghi"].values,ghi_hat)
# also full-sample map for any fallback
iso=IsotonicRegression(increasing=True,out_of_bounds="clip").fit(pair["bt"],pair["k"])

# (2) TRANSLATION: nowcast BT +30min (persistence vs optical flow on local patch) -> GHI
def to_u8(b): x=np.where(np.isfinite(b),b,300.); return np.clip((x-180)/130*255,0,255).astype(np.uint8)
def advect_center(prev,cur,steps):
    fl=cv2.calcOpticalFlowFarneback(to_u8(prev),to_u8(cur),None,0.5,3,25,3,7,1.5,0)
    h,w=cur.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    warp=cv2.remap(np.where(np.isfinite(cur),cur,300.).astype(np.float32),(gx+steps*fl[...,0]).astype(np.float32),(gy+steps*fl[...,1]).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    return float(np.nanmean(warp[crow-2:crow+3,ccol-2:ccol+3]))
# build per-frame time index for consecutive checks
utc_set={t:i for i,t in enumerate(utc)}
of_ghi,pe_ghi,act_ghi,pe_bt_ghi,nowcast_days=[],[],[],[],[]
for i,t in enumerate(utc):
    tgt=t+dt.timedelta(minutes=10*STEP); prevt=t-dt.timedelta(minutes=10)
    if prevt not in utc_set or tgt not in utc_set: continue
    m_t=nsrdb_at(t); m_g=nsrdb_at(tgt)
    if m_t is None or m_g is None or m_g[1]<20: continue
    cur=P[i]; prev=P[utc_set[prevt]]
    mp=day_map.get(t.date(),iso)                        # held-out map (fit on OTHER days)
    bt_of=advect_center(prev,cur,STEP)                 # optical-flow BT nowcast at +30
    bt_pe=center(cur)                                  # persistence BT
    ghi_of=float(mp.predict([bt_of])[0])*m_g[1]        # map->k->GHI at t+30 (uses clearsky(t+30))
    ghi_pe_bt=float(mp.predict([bt_pe])[0])*m_g[1]
    of_ghi.append(ghi_of); pe_bt_ghi.append(ghi_pe_bt); act_ghi.append(m_g[0]); pe_ghi.append(m_t[0]); nowcast_days.append(t)  # persistence-GHI = GHI(t)
act=np.array(act_ghi)
# A6: day-block bootstrap CI on the BT->GHI improvement vs persistence-GHI
nd=np.array([t.date() for t in nowcast_days]); A=act; PE=np.array(pe_ghi); PB=np.array(pe_bt_ghi); OF=np.array(of_ghi)
uniq=list(set(nd)); rng2=np.random.default_rng(0)
day_idx={d:np.where(nd==d)[0] for d in uniq}        # precompute per-day sample indices
def daymae(sel,arr):
    # sel = list of days WITH repeats; concatenate per-day errors honoring multiplicity (valid block bootstrap)
    e=np.concatenate([np.abs(A[day_idx[d]]-arr[day_idx[d]]) for d in sel]); return float(np.mean(e))
def boot_impr(arr):
    base=daymae(uniq,PE)-daymae(uniq,arr)
    bs=[ (daymae(s:=list(rng2.choice(uniq,len(uniq),replace=True)),PE)-daymae(s,arr)) for _ in range(2000)]
    return round(base,1),[round(float(np.nanpercentile(bs,2.5)),1),round(float(np.nanpercentile(bs,97.5)),1)]
imp_bt=boot_impr(PB)
res={"experiment":"BT->irradiance link (Himawari-8 2020 + NSRDB Petaling Jaya)",
 "paired_samples":int(len(pair)),"nowcast_samples":int(len(act)),"n_days":len(uniq),
 "link":{"corr_BT_vs_k":round(corr,3),"BTtoK_R2":round(float(r2),3),"GHI_MAE_fit_Wm2":round(float(ghi_mae_fit),1)},
 "translation_30min_GHI_MAE_Wm2":{
    "persistence_GHI":round(float(mean_absolute_error(act,pe_ghi)),1),
    "persistBT_to_GHI":round(float(mean_absolute_error(act,pe_bt_ghi)),1),
    "opticalflowBT_to_GHI":round(float(mean_absolute_error(act,of_ghi)),1)},
 "BTtoGHI_improvement_vs_persistGHI_Wm2":{"mean":imp_bt[0],"ci95_dayblock_4days":imp_bt[1],
    "note":"day-block bootstrap over only 4 days -> coarse/wide CI; indicative"}}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"bt_irradiance_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
