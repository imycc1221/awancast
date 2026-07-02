"""
Conformal upgrade (Codex review #5) — rigorous prediction intervals for B1b.
Improvements over the first pass:
  1. FINITE-SAMPLE split-conformal quantile: rank = ceil((n+1)(1-alpha))/n (not plain np.quantile).
  2. MONDRIAN (regime-conditioned) calibration.
  3. NORMALIZED-residual variant: calibrate |resid|/clearsky_target -> width adapts to expected magnitude.
  4. ROLLING MONTHLY coverage on test 2020 -> empirically probes the exchangeability/stationarity concern.
Train 2016-2018, calibration 2019, test 2020, 120-min horizon, 90% target.
"""
import glob, os, json
import numpy as np, pandas as pd, lightgbm as lgb
DATA=os.path.join(os.path.dirname(__file__),"..","data","nsrdb"); H=12; ALPHA=0.10

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
    d["k_now"]=d["k"]; d["target"]=d["GHI"].shift(-h)
    d["month"]=d["dt"].dt.month; d["hour"]=d["dt"].dt.hour
    d=d[(d["Clearsky GHI"]>20)&(d["cs_target"]>20)]
    feats=["month","hour","Solar Zenith Angle","Temperature","Relative Humidity","Wind Speed",
           "Pressure","Cloud Type","cs_target","ghi_lag0","ghi_lag1","ghi_lag2","ghi_lag3",
           "k_lag0","k_lag1","k_lag2","k_var_1h"]
    return d.dropna(subset=feats+["target","k_now","cs_target"]), feats

def regime(v): return "STABLE" if v<0.01 else ("PARTIAL" if v<0.05 else "CONVECTIVE")
def fs_quantile(res, alpha):
    """Finite-sample split-conformal quantile of absolute residuals."""
    n=len(res);
    if n==0: return np.inf
    rank=int(np.ceil((n+1)*(1-alpha)))
    rank=min(rank,n)                      # if exceeds n -> infinite band; clip to max
    return np.sort(res)[rank-1]

df=load(); d,feats=build(df,H)
tr=d[d["dt"].dt.year<=2018]; cal=d[d["dt"].dt.year==2019].copy(); te=d[d["dt"].dt.year==2020].copy()
model=lgb.LGBMRegressor(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,
                        colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(tr[feats],tr["target"])
cal["pred"]=model.predict(cal[feats]); te["pred"]=model.predict(te[feats])
cal["res"]=(cal["target"]-cal["pred"]).abs(); te["ae"]=(te["target"]-te["pred"]).abs()
cal["reg"]=cal["k_var_1h"].map(regime); te["reg"]=te["k_var_1h"].map(regime)
cal["nres"]=cal["res"]/cal["cs_target"]; te["nae"]=te["ae"]/te["cs_target"]

# quantiles
qg=fs_quantile(cal["res"].values,ALPHA)
qr={r:fs_quantile(cal[cal["reg"]==r]["res"].values,ALPHA) for r in ["STABLE","PARTIAL","CONVECTIVE"]}
qn={r:fs_quantile(cal[cal["reg"]==r]["nres"].values,ALPHA) for r in ["STABLE","PARTIAL","CONVECTIVE"]}

def cover_width(method):
    if method=="global":
        q=np.full(len(te),qg); cov=(te["ae"].values<=q)
    elif method=="regime":
        q=te["reg"].map(qr).values; cov=(te["ae"].values<=q)
    else:  # normalized-regime: width = qn[reg]*cs_target
        q=te["reg"].map(qn).values*te["cs_target"].values; cov=(te["ae"].values<=q)
    return float(cov.mean()), float(np.mean(2*q)), cov, 2*q   # also per-pixel width

res={"horizon":"120min","target":1-ALPHA,"n_cal":int(len(cal)),"n_test":int(len(te)),"methods":{}}
for m in ["global","regime","normalized_regime"]:
    cov,width,covarr,warr=cover_width(m)
    rv=te["reg"].values
    per_reg={r:round(float(covarr[rv==r].mean()),3) for r in ["STABLE","PARTIAL","CONVECTIVE"]}
    per_reg_w={r:round(float(warr[rv==r].mean()),1) for r in ["STABLE","PARTIAL","CONVECTIVE"]}
    te["_cov"]=covarr
    monthly={int(mo):round(float(g["_cov"].mean()),3) for mo,g in te.groupby("month")}
    res["methods"][m]={"marginal_coverage":round(cov,3),"mean_width_Wm2":round(width,1),
                       "per_regime_coverage":per_reg,"per_regime_width_Wm2":per_reg_w,
                       "worst_month_coverage":round(float(min(monthly.values())),3),
                       "rolling_monthly_coverage":monthly}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"conformal_upgrade_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
