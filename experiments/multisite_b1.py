"""
Multi-site B1 (reviewer R1-b, GROUND TRUTH) — does the onset-gain pattern hold across all three Malaysian
regions? For each NSRDB site (Petaling Jaya / Kuching / Kota Kinabalu): train LightGBM (2016-2019), test
2020, 120-min horizon; onset slice (clear-sky-index collapse > 0.30); per-day onset MAE for
smart-persistence vs LightGBM; day-block-bootstrap 95% CI on the gain + fraction of days LightGBM wins.
"""
import glob, os, json
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.metrics import mean_absolute_error
DATA=os.path.join(os.path.dirname(__file__),"..","data","nsrdb"); H=12; ONSET=0.30; B=2000
SITES=["petaling_jaya","kuching","kota_kinabalu"]
def load(site):
    fr=[pd.read_csv(f,skiprows=2) for f in sorted(glob.glob(os.path.join(DATA,f"{site}_*.csv")))]
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
    d["month"]=d["dt"].dt.month; d["hour"]=d["dt"].dt.hour; d["date"]=d["dt"].dt.date
    d=d[(d["Clearsky GHI"]>20)&(d["cs_target"]>20)]
    feats=["month","hour","Solar Zenith Angle","Temperature","Relative Humidity","Wind Speed","Pressure",
           "Cloud Type","cs_target","ghi_lag0","ghi_lag1","ghi_lag2","ghi_lag3","k_lag0","k_lag1","k_lag2","k_var_1h"]
    return d.dropna(subset=feats+["target","k_now","cs_target","k_target"]), feats

res={"experiment":"multi-site B1 onset gain (LightGBM vs smart-persistence), 120-min, test 2020","by_site":{}}
rng=np.random.default_rng(0)
for site in SITES:
    d,feats=build(load(site),H)
    tr=d[d["dt"].dt.year<=2019]; te=d[d["dt"].dt.year==2020].copy()
    m=lgb.LGBMRegressor(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(tr[feats],tr["target"])
    te["gbm"]=m.predict(te[feats]); te["smart"]=te["k_now"]*te["cs_target"]
    te=te[(te["k_target"]-te["k_now"])< -ONSET].copy()
    te["ae_g"]=(te["target"]-te["gbm"]).abs(); te["ae_s"]=(te["target"]-te["smart"]).abs()
    g=te.groupby("date").agg(n=("target","size"),ag=("ae_g","sum"),as_=("ae_s","sum")); g=g[g["n"]>=5]
    days=g.index.to_numpy()
    def gain(idx):
        s=g.loc[idx]; mg=s["ag"].sum()/s["n"].sum(); ms=s["as_"].sum()/s["n"].sum(); return ms,mg,100*(ms-mg)/ms
    ms,mg,gp=gain(days); boot=np.array([gain(rng.choice(days,len(days),replace=True))[2] for _ in range(B)])
    win=float(((g["ag"]/g["n"])<(g["as_"]/g["n"])).mean())
    res["by_site"][site]={"n_days":int(len(days)),"n_onset":int(g["n"].sum()),
        "smart_persist_onset_MAE":round(float(ms),1),"lightgbm_onset_MAE":round(float(mg),1),
        "gain_pct":round(float(gp),1),"gain_ci95":[round(float(np.percentile(boot,2.5)),1),round(float(np.percentile(boot,97.5)),1)],
        "days_lightgbm_wins_frac":round(win,3)}
    print(f"{site}: gain {gp:.1f}% CI[{np.percentile(boot,2.5):.1f},{np.percentile(boot,97.5):.1f}] wins {win:.2f}",flush=True)
json.dump(res,open(os.path.join(os.path.dirname(__file__),"multisite_b1_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
