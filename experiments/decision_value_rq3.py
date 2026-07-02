"""
StormGate experiment B4 (RQ3) — per-scheme decision value of forecast-driven appliance scheduling.
Tests the paper's distinctive multi-scheme claim and the SELCO hypothesis:
  "forecast-driven scheduling captures the MOST value under export-prohibited SELCO-PV."

Design (confound-controlled): import tariff held CONSTANT across schemes; only the EXPORT rule varies
(the paper's actual variable). We compare two scheduling policies on identical PV/load:
  - naive   : run deferrable appliances at a fixed evening default (solar-unaware)
  - forecast: run them in the highest-PV window predicted by a forecast
Forecast variants: perfect foresight (upper bound) and persistence (realistic).

PV from NSRDB Petaling Jaya 2020 GHI (5 kW system, simple model — explicitly a simplification).
Metric: RM saved/day by forecast-driven vs naive, per scheme, averaged over 2020 daytime days.
"""
import os, glob, json
import numpy as np, pandas as pd

DATA = os.path.join(os.path.dirname(__file__), "..", "data", "nsrdb")
SYS_KW = 5.0                       # rooftop system size
IMPORT_TARIFF = 0.2703            # RM/kWh, held constant across schemes (ATAP low tier)
EXPORT_RATE = {"ATAP": 0.10, "NEM": 0.2703, "SELCO": 0.0}  # the only thing that differs
DT_H = 10/60                       # 10-min step in hours

# deferrable appliances: (energy_kWh, duration_steps, window_start_h, window_end_h)
APPLIANCES = {"dishwasher": (1.5, 9, 9, 17), "washer": (1.0, 6, 9, 17), "ev": (7.0, 12, 10, 16)}
NAIVE_START_H = 20.0               # solar-unaware default: 8 pm

def load_2020():
    df = pd.read_csv(os.path.join(DATA, "petaling_jaya_2020.csv"), skiprows=2)
    df["dt"] = pd.to_datetime(df[["Year","Month","Day","Hour","Minute"]])
    df["GHI"] = pd.to_numeric(df["GHI"], errors="coerce")
    df["Clearsky GHI"] = pd.to_numeric(df["Clearsky GHI"], errors="coerce")
    df["hour_f"] = df["Hour"] + df["Minute"]/60.0
    df["doy"] = df["dt"].dt.dayofyear
    return df

def base_load(hour_f):
    """Simple diurnal base load (kW): morning + evening peaks."""
    return 0.3 + 0.4*np.exp(-((hour_f-8)**2)/4) + 0.7*np.exp(-((hour_f-20)**2)/6)

def pv_kw(ghi):
    return np.clip(ghi/1000.0*SYS_KW, 0, SYS_KW)

def day_cost(pv, base, appl_kw, scheme):
    """RM cost for one day given net load; export credited per scheme."""
    net = base + appl_kw - pv               # kW per step
    imp = np.clip(net, 0, None)*DT_H        # kWh imported
    exp = np.clip(-net, 0, None)*DT_H       # kWh exported
    return imp.sum()*IMPORT_TARIFF - exp.sum()*EXPORT_RATE[scheme]

def place(appl_kw_template, start_step, energy, dur):
    a = np.zeros_like(appl_kw_template)
    a[start_step:start_step+dur] = energy/(dur*DT_H)   # constant power over duration
    return a

def schedule_forecast(pv_forecast, hour_f, energy, dur, w0, w1):
    """Pick start within [w0,w1) maximizing PV overlap given the forecast."""
    win = np.where((hour_f>=w0) & (hour_f<w1))[0]
    if len(win)==0: return None
    best, best_start = -1, win[0]
    for s in range(win[0], win[-1]-dur+2):
        ov = pv_forecast[s:s+dur].sum()
        if ov > best: best, best_start = ov, s
    return best_start

def run():
    df = load_2020()
    schemes = list(EXPORT_RATE)
    # forecasts available at issuance time (start of day) — NO same-day future info:
    #   perfect   = actual PV (upper bound only)
    #   clearsky  = clear-sky PV (ex-ante, cloud-blind; known from solar geometry)
    #   dayahead  = YESTERDAY's actual PV profile (day-ahead persistence)
    FC_NAMES = ["perfect", "clearsky", "dayahead"]
    agg = {s: {f: [] for f in FC_NAMES} for s in schemes}
    naive_cost_acc = {s: [] for s in schemes}

    # precompute per-day arrays in calendar order
    days = []
    for doy, g in df.groupby("doy"):
        g = g.sort_values("hour_f")
        ghi = g["GHI"].values; cs = g["Clearsky GHI"].values; hf = g["hour_f"].values
        if np.nansum(ghi) < 100:  # skip near-empty days
            continue
        days.append({"doy": int(doy), "hf": hf, "pv": pv_kw(ghi),
                     "cs_pv": pv_kw(cs), "base": base_load(hf)})

    saved_da={s:[] for s in schemes}; saved_da_mid={s:[] for s in schemes}   # per-day day-ahead savings vs 8pm / midday
    prev_pv = None
    for day in days:
        hf, pv, cs_pv, base = day["hf"], day["pv"], day["cs_pv"], day["base"]
        n = len(pv)
        step_h = int(np.argmin(np.abs(hf - NAIVE_START_H)))
        step_mid = int(np.argmin(np.abs(hf - 12.0)))                          # A5: stronger midday naive anchor
        dayahead = prev_pv if (prev_pv is not None and prev_pv.shape == pv.shape) else cs_pv
        forecasts = {"perfect": pv, "clearsky": cs_pv, "dayahead": dayahead}
        for scheme in schemes:
            appl = np.zeros(n); appl_mid = np.zeros(n)
            for (e, d, _, _) in APPLIANCES.values():
                appl += place(appl, min(step_h, n-d-1) if n>d+1 else 0, e, d)
                appl_mid += place(appl_mid, min(step_mid, n-d-1) if n>d+1 else 0, e, d)
            c_naive = day_cost(pv, base, appl, scheme); c_naive_mid = day_cost(pv, base, appl_mid, scheme)
            naive_cost_acc[scheme].append(c_naive)
            for fc_name in FC_NAMES:
                fc = forecasts[fc_name]
                appl_f = np.zeros(n)
                for (e, d, w0, w1) in APPLIANCES.values():
                    s = schedule_forecast(fc, hf, e, d, w0, w1)
                    if s is None or s+d > n: s = min(step_h, n-d-1)
                    appl_f += place(appl_f, s, e, d)
                c_fore = day_cost(pv, base, appl_f, scheme)
                agg[scheme][fc_name].append(c_naive - c_fore)
                if fc_name=="dayahead":
                    saved_da[scheme].append(c_naive - c_fore); saved_da_mid[scheme].append(c_naive_mid - c_fore)
        prev_pv = pv
    # A5: day-bootstrap CIs on day-ahead savings, vs both naive anchors
    rb=np.random.default_rng(0)
    def ci(lst):
        a=np.array(lst); bs=[np.mean(a[rb.integers(0,len(a),len(a))]) for _ in range(2000)]
        return [round(float(np.percentile(bs,2.5)),3),round(float(np.percentile(bs,97.5)),3)]

    res = {"assumptions": {"system_kW": SYS_KW, "import_tariff_RM": IMPORT_TARIFF,
            "export_rate_RM": EXPORT_RATE,
            "note": "import held constant; only export rule varies. Forecasts are issuance-time "
                    "(no same-day future): clearsky=ex-ante, dayahead=yesterday's profile, perfect=upper bound."},
           "rm_saved_per_day": {}}
    for s in schemes:
        res["rm_saved_per_day"][s] = {
            "naive_cost_RM_day": round(float(np.mean(naive_cost_acc[s])), 3),
            "saved_perfect_RM_day": round(float(np.mean(agg[s]["perfect"])), 3),
            "saved_clearsky_RM_day": round(float(np.mean(agg[s]["clearsky"])), 3),
            "saved_dayahead_RM_day_vs_8pm": round(float(np.mean(saved_da[s])), 3),
            "saved_dayahead_ci95_vs_8pm": ci(saved_da[s]),
            "saved_dayahead_RM_day_vs_midday": round(float(np.mean(saved_da_mid[s])), 3),
            "saved_dayahead_ci95_vs_midday": ci(saved_da_mid[s]),
        }
    json.dump(res, open(os.path.join(os.path.dirname(__file__), "decision_value_results.json"), "w"), indent=2)
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    run()
