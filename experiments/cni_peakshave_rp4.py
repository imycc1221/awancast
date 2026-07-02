"""
C&I peak-shaving under RP4 (the government value-case). STYLIZED simulation: a commercial site
(solar + battery) on real NSRDB Petaling Jaya 2020 irradiance. RP4 capacity charge = RM89.27 per kW of
monthly peak (max net grid import). We compare:
  - grid_only            : no solar/battery (peak = max load)
  - solar_only           : solar, no battery
  - battery_FORECAST     : battery peak-shaver that KNOWS the actual solar (anticipates storm dropouts)
  - battery_NAIVE        : battery peak-shaver that assumes CLEAR-SKY solar (caught by storms)
Forecast picks the true min feasible monthly cap. We compare against TWO non-forecast baselines:
naive_robust (competent, solar-blind: targets a cap from low-percentile solar climatology, never caught)
and naive_optimistic (strawman: over-trusts clear-sky, gets broken — kept only as an upper bound). A
quantile sweep (p10..p50) on the naive baseline brackets the forecast-specific value, which is
sensitivity-dependent. ASSUMPTIONS ARE STYLIZED (synthetic load, idealized battery, oracle 'forecast' uses
actual solar, one site/year, 10-min proxy for 30-min billing, gross of capex/O&M) -> a PROJECTION, not measured.
"""
import glob, os, json
import numpy as np, pandas as pd
DATA=os.path.join(os.path.dirname(__file__),"..","data","nsrdb")
CAP_CHG=89.27          # RM per kW of monthly peak (RP4 industrial capacity charge)
SYS_KW=1000.0          # 1 MW rooftop solar
BATT_E=2000.0; BATT_P=1000.0   # 2 MWh / 1 MW battery
DT=10/60.0             # 10-min step in hours
def load_pj():
    fr=[pd.read_csv(f,skiprows=2) for f in sorted(glob.glob(os.path.join(DATA,"petaling_jaya_*.csv")))]
    df=pd.concat(fr,ignore_index=True); df=df[df["Year"]==2020] if (df["Year"]==2020).any() else df
    df["dt"]=pd.to_datetime(df[["Year","Month","Day","Hour","Minute"]])
    for c in ["GHI","Clearsky GHI"]: df[c]=pd.to_numeric(df[c],errors="coerce")
    df["hour_f"]=df["Hour"]+df["Minute"]/60.0; return df.sort_values("dt").reset_index(drop=True)
def mall_load(hf):  # stylized commercial load (kW): base + HVAC afternoon peak + opening ramp
    return 700+1300*np.exp(-((hf-15)**2)/9.0)+250*np.exp(-((hf-11)**2)/6.0)
def pv(ghi): return np.clip(ghi/1000.0*SYS_KW,0,SYS_KW)

def reactive_peak(load,solar,C):
    """Reactive battery shaver targeting grid cap C; returns achieved monthly peak (kW)."""
    soc=0.5*BATT_E; peak=0.0
    for ld,sa in zip(load,solar):
        net=ld-sa
        if net>C:                                  # discharge to hold cap
            dis=min(net-C,BATT_P,soc/DT); grid=net-dis; soc-=dis*DT
        else:                                       # charge (from surplus/grid) without exceeding C
            chg=min(BATT_P,(BATT_E-soc)/DT,max(0.0,C-net)); soc+=chg*DT; grid=net+chg
        peak=max(peak,grid)
    return peak
def min_cap(load,solar):
    lo,hi=0.0,float(np.max(load));
    for _ in range(22):
        mid=(lo+hi)/2
        if reactive_peak(load,solar,mid)<=mid*1.002: hi=mid
        else: lo=mid
    return hi

df=load_pj()
# robust-naive solar profile: 20th-percentile PV by time-of-day (a competent solar-blind operator counts
# only on solar it can usually rely on -> never gets caught, but shaves less aggressively than forecast)
df["pv"]=pv(df["GHI"].values); p20=df.groupby("hour_f")["pv"].quantile(0.20)
res={"assumptions":{"capacity_charge_RM_per_kW_month":CAP_CHG,"solar_kW":SYS_KW,"battery":"2MWh/1MW",
    "load":"stylized mall ~2MW afternoon peak","site":"NSRDB Petaling Jaya 2020","note":"STYLIZED projection, not measured"},
    "annual_demand_charge_RM":{}, "per_month_peak_kW":{}}
pol={"grid_only":[],"solar_only":[],"battery_forecast":[],"naive_robust":[],"naive_optimistic":[]}
months=[]
for mo,g in df.groupby(df["dt"].dt.month):
    hf=g["hour_f"].values; ld=mall_load(hf); sa=pv(g["GHI"].values); cs=pv(g["Clearsky GHI"].values)
    sp20=p20.reindex(hf).values                                       # robust-naive's assumed solar
    p_grid=float(np.max(ld)); p_solar=float(np.max(np.clip(ld-sa,0,None)))
    Cf=min_cap(ld,sa); p_fore=reactive_peak(ld,sa,Cf)                 # FORECAST: knows actual solar -> true min cap
    Cr=min_cap(ld,sp20); p_robust=reactive_peak(ld,sa,Cr)            # FAIR naive: robust cap from p20 solar (competent, never caught)
    Co=min_cap(ld,cs); p_opt=reactive_peak(ld,sa,Co)                 # strawman naive: over-trusts clear sky (upper bound only)
    pol["grid_only"].append(p_grid); pol["solar_only"].append(p_solar); pol["battery_forecast"].append(p_fore)
    pol["naive_robust"].append(p_robust); pol["naive_optimistic"].append(p_opt); months.append(int(mo))
    res["per_month_peak_kW"][int(mo)]={"grid":round(p_grid),"solar":round(p_solar),"forecast":round(p_fore),
        "naive_robust":round(p_robust),"naive_optimistic":round(p_opt),"robust_minus_forecast":round(p_robust-p_fore)}
for k in pol: res["annual_demand_charge_RM"][k]=round(sum(pol[k])*CAP_CHG,0)
A=res["annual_demand_charge_RM"]
res["savings_RM_per_year"]={
  "DEFENSIBLE_system_forecast_vs_grid":round(A["grid_only"]-A["battery_forecast"]),
  "battery_forecast_vs_solar_only":round(A["solar_only"]-A["battery_forecast"]),
  "forecast_value_vs_FAIR_naive_p20":round(A["naive_robust"]-A["battery_forecast"]),
  "forecast_value_vs_strawman_naive (inflated upper bound)":round(A["naive_optimistic"]-A["battery_forecast"])}
# quantile sweep on the naive baseline -> bracket the forecast-specific value (ARIS-requested)
qprof={q:df.groupby("hour_f")["pv"].quantile(q) for q in [0.1,0.2,0.3,0.4,0.5]}
sweep={}
for q,prof in qprof.items():
    tot=0.0
    for mo,g in df.groupby(df["dt"].dt.month):
        hf=g["hour_f"].values; ld=mall_load(hf); sa=pv(g["GHI"].values)
        tot+=reactive_peak(ld,sa,min_cap(ld,prof.reindex(hf).values))*CAP_CHG
    sweep[f"naive_p{int(q*100)}"]={"annual_RM":round(tot),"forecast_value_RM":round(tot-A["battery_forecast"])}
res["naive_quantile_sweep"]=sweep
res["forecast_value_range_RM"]=[min(v["forecast_value_RM"] for v in sweep.values()),max(v["forecast_value_RM"] for v in sweep.values())]
res["storm_driven_months"]=[m for m in months if res["per_month_peak_kW"][m]["robust_minus_forecast"]>30]
json.dump(res,open(os.path.join(os.path.dirname(__file__),"cni_peakshave_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
