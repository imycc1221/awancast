"""
B1 feature ablation (Codex review #8): cumulative feature groups -> 120-min onset-slice MAE.
Shows where the onset skill comes from (not a black box). Train 2016-2019, test 2020, onset thr 0.30.
"""
import glob, os, json
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.metrics import mean_absolute_error
DATA=os.path.join(os.path.dirname(__file__),"..","data","nsrdb"); H=12; ONSET=0.30

def load():
    fr=[pd.read_csv(f,skiprows=2) for f in sorted(glob.glob(os.path.join(DATA,"petaling_jaya_*.csv")))]
    df=pd.concat(fr,ignore_index=True); df["dt"]=pd.to_datetime(df[["Year","Month","Day","Hour","Minute"]])
    df=df.sort_values("dt").reset_index(drop=True)
    for c in ["GHI","Clearsky GHI","Temperature","Relative Humidity","Wind Speed","Pressure","Solar Zenith Angle","Cloud Type"]:
        df[c]=pd.to_numeric(df[c],errors="coerce")
    df["k"]=(df["GHI"]/df["Clearsky GHI"].replace(0,np.nan)).clip(0,1.5); return df

def build(df,h):
    d=df.copy()
    for lag in [0,1,2,3,6]: d[f"ghi_lag{lag}"]=d["GHI"].shift(lag); d[f"k_lag{lag}"]=d["k"].shift(lag)
    d["k_var_1h"]=d["k"].rolling(6).var(); d["cs_target"]=d["Clearsky GHI"].shift(-h)
    d["k_now"]=d["k"]; d["target"]=d["GHI"].shift(-h); d["k_target"]=d["k"].shift(-h)
    d["month"]=d["dt"].dt.month; d["hour"]=d["dt"].dt.hour
    d=d[(d["Clearsky GHI"]>20)&(d["cs_target"]>20)]
    allf=["month","hour","Solar Zenith Angle","Temperature","Relative Humidity","Wind Speed",
          "Pressure","Cloud Type","cs_target","ghi_lag0","ghi_lag1","ghi_lag2","ghi_lag3",
          "k_lag0","k_lag1","k_lag2","k_var_1h"]
    return d.dropna(subset=allf+["target","k_now","cs_target","k_target"])

GROUPS=[
 ("clear-sky only",        ["cs_target"]),
 ("+ recent GHI/k lags",   ["cs_target","ghi_lag0","ghi_lag1","ghi_lag2","ghi_lag3","k_lag0","k_lag1","k_lag2"]),
 ("+ regime variance",     ["cs_target","ghi_lag0","ghi_lag1","ghi_lag2","ghi_lag3","k_lag0","k_lag1","k_lag2","k_var_1h"]),
 ("+ weather",             ["cs_target","ghi_lag0","ghi_lag1","ghi_lag2","ghi_lag3","k_lag0","k_lag1","k_lag2","k_var_1h","Temperature","Relative Humidity","Wind Speed","Pressure","Cloud Type"]),
 ("+ temporal (full)",     ["cs_target","ghi_lag0","ghi_lag1","ghi_lag2","ghi_lag3","k_lag0","k_lag1","k_lag2","k_var_1h","Temperature","Relative Humidity","Wind Speed","Pressure","Cloud Type","month","hour","Solar Zenith Angle"]),
]
d=build(load(),H); tr=d[d["dt"].dt.year<=2019]; te=d[d["dt"].dt.year==2020].copy()
onset=(te["k_target"]-te["k_now"])< -ONSET
y=te["target"].values; smart=(te["k_now"]*te["cs_target"]).values
res={"experiment":"B1 ablation, 120-min onset slice","onset_threshold":ONSET,
     "smart_persistence_onset_MAE":round(float(mean_absolute_error(y[onset],smart[onset])),1),"rows":{}}
for name,feats in GROUPS:
    m=lgb.LGBMRegressor(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,
                        colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(tr[feats],tr["target"])
    p=m.predict(te[feats]); mae=mean_absolute_error(y[onset],p[onset])
    res["rows"][name]={"n_features":len(feats),"onset_MAE":round(float(mae),1)}
    print(f"{name:24s} ({len(feats):2d} feat): onset MAE {mae:.1f}")
json.dump(res,open(os.path.join(os.path.dirname(__file__),"ablation_b1_results.json"),"w"),indent=2)
print("smart-persistence onset MAE:",res["smart_persistence_onset_MAE"])
