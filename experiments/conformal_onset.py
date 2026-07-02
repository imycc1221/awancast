"""
StormGate experiment B1b — onset-threshold sensitivity sweep + regime-conditioned
conformal prediction intervals (RQ2). CPU-only, NSRDB Petaling Jaya.

Closes two reviewer sink-risks:
  #1 cherry-picking  -> show the LightGBM>baseline onset gain is stable across thresholds 0.2/0.3/0.4
  RQ2 calibration    -> split-conformal 90% intervals, GLOBAL vs REGIME-CONDITIONED, report coverage+width

Split: train 2016-2018  |  calibration 2019  |  test 2020.
"""
import json, glob, os
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.metrics import mean_absolute_error

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "nsrdb")
HORIZONS = {"30min": 3, "120min": 12}
ALPHA = 0.10  # 90% intervals

def load():
    fr = [pd.read_csv(f, skiprows=2) for f in sorted(glob.glob(os.path.join(DATA, "petaling_jaya_*.csv")))]
    df = pd.concat(fr, ignore_index=True)
    df["dt"] = pd.to_datetime(df[["Year","Month","Day","Hour","Minute"]])
    df = df.sort_values("dt").reset_index(drop=True)
    for c in ["GHI","Clearsky GHI","Temperature","Relative Humidity","Wind Speed",
              "Pressure","Solar Zenith Angle","Cloud Type"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["k"] = (df["GHI"]/df["Clearsky GHI"].replace(0,np.nan)).clip(0,1.5)
    return df

def build(df, h):
    d = df.copy()
    for lag in [0,1,2,3,6]:
        d[f"ghi_lag{lag}"]=d["GHI"].shift(lag); d[f"k_lag{lag}"]=d["k"].shift(lag)
    d["k_var_1h"]=d["k"].rolling(6).var()
    d["cs_target"]=d["Clearsky GHI"].shift(-h); d["k_now"]=d["k"]
    d["target"]=d["GHI"].shift(-h); d["k_target"]=d["k"].shift(-h)
    d["month"]=d["dt"].dt.month; d["hour"]=d["dt"].dt.hour
    d=d[(d["Clearsky GHI"]>20)&(d["cs_target"]>20)]
    feats=["month","hour","Solar Zenith Angle","Temperature","Relative Humidity",
           "Wind Speed","Pressure","Cloud Type","cs_target","ghi_lag0","ghi_lag1",
           "ghi_lag2","ghi_lag3","k_lag0","k_lag1","k_lag2","k_var_1h"]
    d=d.dropna(subset=feats+["target","k_now","cs_target","k_target"])
    return d, feats

def regime_of(v):
    return "STABLE" if v<0.01 else ("PARTIAL" if v<0.05 else "CONVECTIVE")

results={"onset_threshold_sweep":{}, "conformal_90pct":{}}
df=load()

for hname,h in HORIZONS.items():
    d,feats=build(df,h)
    tr=d[d["dt"].dt.year<=2018]; cal=d[d["dt"].dt.year==2019].copy(); te=d[d["dt"].dt.year==2020].copy()
    model=lgb.LGBMRegressor(n_estimators=400,learning_rate=0.05,num_leaves=63,
                            subsample=0.8,colsample_bytree=0.8,random_state=0,n_jobs=-1)
    model.fit(tr[feats],tr["target"])
    y=te["target"].values
    persist=te["ghi_lag0"].values
    smart=(te["k_now"]*te["cs_target"]).values
    gbm=model.predict(te[feats])

    # --- onset threshold sweep ---
    drop=(te["k_target"].values-te["k_now"].values)
    sweep={}
    for thr in [0.20,0.30,0.40]:
        m=drop< -thr
        if m.sum()==0: continue
        smae=mean_absolute_error(y[m],smart[m]); gmae=mean_absolute_error(y[m],gbm[m])
        sweep[f"thr_{thr}"]={"n":int(m.sum()),
            "smart_persist_MAE":round(float(smae),1),
            "lightgbm_MAE":round(float(gmae),1),
            "lgbm_gain_vs_smart_pct":round(float(100*(smae-gmae)/smae),1)}
    results["onset_threshold_sweep"][hname]=sweep

    # --- regime-conditioned split conformal (calibrate on 2019) ---
    cal_pred=model.predict(cal[feats]); cal_res=np.abs(cal["target"].values-cal_pred)
    cal_reg=np.array([regime_of(v) for v in cal["k_var_1h"].values])
    te_reg=np.array([regime_of(v) for v in te["k_var_1h"].values])
    abs_err=np.abs(y-gbm)

    # global conformal q
    q_global=np.quantile(cal_res,1-ALPHA)
    # regime conformal q
    q_reg={rg:(np.quantile(cal_res[cal_reg==rg],1-ALPHA) if (cal_reg==rg).sum()>50 else q_global)
           for rg in ["STABLE","PARTIAL","CONVECTIVE"]}

    def cov_width(qfunc):
        qs=np.array([qfunc(r) for r in te_reg])
        return float(np.mean(abs_err<=qs)), float(np.mean(2*qs))
    g_cov,g_w=cov_width(lambda r:q_global)
    r_cov,r_w=cov_width(lambda r:q_reg[r])

    per_regime={}
    for rg in ["STABLE","PARTIAL","CONVECTIVE"]:
        m=te_reg==rg
        if m.sum()==0: continue
        gcov=float(np.mean(abs_err[m]<=q_global)); rcov=float(np.mean(abs_err[m]<=q_reg[rg]))
        per_regime[rg]={"n":int(m.sum()),
            "global_cov":round(gcov,3),"global_width":round(2*q_global,1),
            "regime_cov":round(rcov,3),"regime_width":round(2*q_reg[rg],1)}

    results["conformal_90pct"][hname]={
        "target_coverage":0.90,
        "global":{"coverage":round(g_cov,3),"mean_width":round(g_w,1)},
        "regime_conditioned":{"coverage":round(r_cov,3),"mean_width":round(r_w,1)},
        "per_regime":per_regime}

out=os.path.join(os.path.dirname(__file__),"conformal_onset_results.json")
json.dump(results,open(out,"w"),indent=2)
print("WROTE",out); print(json.dumps(results,indent=2))
