"""
StormGate experiment B1 — baseline nowcasting on NSRDB Petaling Jaya (CPU-only).
Persistence, smart-persistence (clear-sky-index persistence), and LightGBM residual.
Reports MAE + skill score vs persistence, OVERALL + regime-stratified + storm-onset slice.

Data: data/nsrdb/petaling_jaya_{2016..2020}.csv  (10-min NSRDB; row 3 is the real header)
Train: 2016-2019   Test: 2020   Horizons: 30 min (3 steps) and 120 min (12 steps)
No GPU, no Himawari frames needed — this establishes the bar the diffusion layer must beat.
"""
import json, glob, os
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "nsrdb")
STEP_MIN = 10
HORIZONS = {"30min": 3, "120min": 12}

def load():
    frames = []
    for f in sorted(glob.glob(os.path.join(DATA, "petaling_jaya_*.csv"))):
        # rows 0-1 are NSRDB metadata; row 2 is the column header
        df = pd.read_csv(f, skiprows=2)
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    df["dt"] = pd.to_datetime(df[["Year", "Month", "Day", "Hour", "Minute"]])
    df = df.sort_values("dt").reset_index(drop=True)
    for c in ["GHI", "Clearsky GHI", "Temperature", "Relative Humidity",
              "Wind Speed", "Pressure", "Solar Zenith Angle", "Cloud Type"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    # clear-sky index (daytime only); avoid divide-by-zero
    cs = df["Clearsky GHI"].replace(0, np.nan)
    df["k"] = (df["GHI"] / cs).clip(0, 1.5)
    return df

def build(df, h):
    d = df.copy()
    # lags (present + recent history)
    for lag in [0, 1, 2, 3, 6]:
        d[f"ghi_lag{lag}"] = d["GHI"].shift(lag)
        d[f"k_lag{lag}"] = d["k"].shift(lag)
    d["k_var_1h"] = d["k"].rolling(6).var()           # regime proxy
    d["cs_target"] = d["Clearsky GHI"].shift(-h)        # known clear-sky at t+h
    d["k_now"] = d["k"]
    d["target"] = d["GHI"].shift(-h)                    # GHI at t+h
    d["k_target"] = d["k"].shift(-h)
    d["month"] = d["dt"].dt.month
    d["hour"] = d["dt"].dt.hour
    # daytime only: clear-sky must be meaningfully positive now and at target
    d = d[(d["Clearsky GHI"] > 20) & (d["cs_target"] > 20)]
    feats = ["month", "hour", "Solar Zenith Angle", "Temperature",
             "Relative Humidity", "Wind Speed", "Pressure", "Cloud Type",
             "cs_target", "ghi_lag0", "ghi_lag1", "ghi_lag2", "ghi_lag3",
             "k_lag0", "k_lag1", "k_lag2", "k_var_1h"]
    d = d.dropna(subset=feats + ["target", "k_now", "cs_target", "k_target"])
    return d, feats

def regime(row):
    v = row["k_var_1h"]
    if v < 0.01: return "STABLE"
    if v < 0.05: return "PARTIAL"
    return "CONVECTIVE"

def skill(mae_model, mae_persist):
    return 1.0 - mae_model / mae_persist if mae_persist > 0 else float("nan")

def evaluate(name, y, pred, persist_mae_ref=None, mask=None):
    if mask is not None:
        y, pred = y[mask], pred[mask]
    if len(y) == 0:
        return None
    mae = mean_absolute_error(y, pred)
    out = {"n": int(len(y)), "MAE": round(float(mae), 2)}
    if persist_mae_ref is not None:
        out["skill_vs_persist"] = round(float(skill(mae, persist_mae_ref)), 4)
    return out

results = {}
df = load()
print(f"loaded {len(df)} rows  {df['dt'].min()} .. {df['dt'].max()}")

for hname, h in HORIZONS.items():
    d, feats = build(df, h)
    tr = d[d["dt"].dt.year <= 2019]
    te = d[d["dt"].dt.year == 2020].copy()
    print(f"[{hname}] train={len(tr)} test={len(te)}")

    y = te["target"].values
    # baselines
    persist = te["ghi_lag0"].values                      # GHI(t)
    smart = (te["k_now"] * te["cs_target"]).values       # clear-sky-index persistence
    # LightGBM
    model = lgb.LGBMRegressor(n_estimators=400, learning_rate=0.05,
                              num_leaves=63, subsample=0.8,
                              colsample_bytree=0.8, random_state=0, n_jobs=-1)
    model.fit(tr[feats], tr["target"])
    gbm = model.predict(te[feats])

    persist_mae = mean_absolute_error(y, persist)
    te_regime = te.apply(regime, axis=1).values
    # storm-onset proxy: future clear-sky-index collapse > 0.3
    onset = (te["k_target"].values - te["k_now"].values) < -0.30

    block = {"overall": {}, "by_regime": {}, "onset_slice": {}}
    for mname, pred in [("persistence", persist), ("smart_persistence", smart),
                        ("lightgbm", gbm)]:
        block["overall"][mname] = evaluate(mname, y, pred, persist_mae)
        block["onset_slice"][mname] = evaluate(mname, y, pred, None, mask=onset)
        for rg in ["STABLE", "PARTIAL", "CONVECTIVE"]:
            block["by_regime"].setdefault(rg, {})
            block["by_regime"][rg][mname] = evaluate(mname, y, pred, None,
                                                     mask=(te_regime == rg))
    block["onset_count"] = int(onset.sum())
    block["regime_counts"] = {rg: int((te_regime == rg).sum())
                              for rg in ["STABLE", "PARTIAL", "CONVECTIVE"]}
    results[hname] = block

out_path = os.path.join(os.path.dirname(__file__), "pilot_results.json")
with open(out_path, "w") as f:
    json.dump(results, f, indent=2)
print("WROTE", out_path)
print(json.dumps(results, indent=2))
