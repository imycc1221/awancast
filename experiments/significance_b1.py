"""
Rigor add-on for B1 (Codex review #2/#6): day-level block bootstrap 95% CIs + paired test for the
onset-slice MAE gain of LightGBM vs smart-persistence. Resamples by DAY (block bootstrap) because
10-min samples within a day are autocorrelated — pixel/sample-level CIs would be over-optimistic.
"""
import glob, os, json
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.metrics import mean_absolute_error

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "nsrdb")
H = 12          # 120-min horizon (strongest onset gain)
ONSET = 0.30    # k-collapse threshold
B = 2000        # bootstrap resamples

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
    d["month"]=d["dt"].dt.month; d["hour"]=d["dt"].dt.hour; d["date"]=d["dt"].dt.date
    d=d[(d["Clearsky GHI"]>20)&(d["cs_target"]>20)]
    feats=["month","hour","Solar Zenith Angle","Temperature","Relative Humidity","Wind Speed",
           "Pressure","Cloud Type","cs_target","ghi_lag0","ghi_lag1","ghi_lag2","ghi_lag3",
           "k_lag0","k_lag1","k_lag2","k_var_1h"]
    return d.dropna(subset=feats+["target","k_now","cs_target","k_target"]), feats

df=load(); d,feats=build(df,H)
tr=d[d["dt"].dt.year<=2019]; te=d[d["dt"].dt.year==2020].copy()
model=lgb.LGBMRegressor(n_estimators=400,learning_rate=0.05,num_leaves=63,subsample=0.8,
                        colsample_bytree=0.8,random_state=0,n_jobs=-1).fit(tr[feats],tr["target"])
te["gbm"]=model.predict(te[feats]); te["smart"]=te["k_now"]*te["cs_target"]
te=te[(te["k_target"]-te["k_now"])< -ONSET].copy()     # onset slice
te["ae_gbm"]=(te["target"]-te["gbm"]).abs(); te["ae_smart"]=(te["target"]-te["smart"]).abs()

# per-day aggregates
g=te.groupby("date").agg(n=("target","size"), ae_gbm=("ae_gbm","sum"), ae_smart=("ae_smart","sum"))
g=g[g["n"]>=5]                                          # days with enough onset samples
days=g.index.to_numpy(); rng=np.random.default_rng(0)

def pooled_gain(idx):
    sub=g.loc[idx]; mae_g=sub["ae_gbm"].sum()/sub["n"].sum(); mae_s=sub["ae_smart"].sum()/sub["n"].sum()
    return mae_s, mae_g, 100*(mae_s-mae_g)/mae_s

mae_s,mae_g,gain=pooled_gain(days)
boot=np.array([pooled_gain(rng.choice(days,len(days),replace=True))[2] for _ in range(B)])
ci=(float(np.percentile(boot,2.5)), float(np.percentile(boot,97.5)))
# paired: fraction of days where LightGBM has lower per-day MAE
perday_g=g["ae_gbm"]/g["n"]; perday_s=g["ae_smart"]/g["n"]; win=float((perday_g<perday_s).mean())
p_one_sided=float(np.mean(boot<=0))                     # bootstrap prob gain<=0

res={"experiment":"B1 onset slice, 120-min","onset_threshold":ONSET,
     "n_days":int(len(days)),"n_onset_samples":int(g["n"].sum()),
     "smart_persist_MAE":round(mae_s,2),"lightgbm_MAE":round(mae_g,2),
     "gain_pct":round(gain,1),"gain_95CI_pct":[round(ci[0],1),round(ci[1],1)],
     "days_lightgbm_wins_frac":round(win,3),"bootstrap_p(gain<=0)":round(p_one_sided,4)}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"significance_b1_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
