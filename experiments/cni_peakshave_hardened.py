"""
HARDENED C&I peak-shaving under RP4 — addresses the two soft spots of cni_peakshave_rp4.py:
  (1) REAL load: NREL ComStock RetailStandalone (FL, hot-humid) 15-min interval meter, shape preserved,
      scaled to a 2 MW-peak mall (data/fetch_comstock.py).
  (2) REAL error-bearing forecast: clear-sky-index PERSISTENCE nowcast (the 'smart persistence' baseline
      from B1) — it misses sharp storm onsets, the regime our project targets. NO oracle in the loop for
      the headline; oracle kept only as an upper bound to show captured headroom.
Resolution = 30 min, matching the RP4 maximum-demand window EXACTLY (no 10-min proxy). Solar = real NSRDB
Petaling Jaya 2020 irradiance. RP4 capacity charge RM89.27/kW of monthly peak.
Honest residual caveats: load (FL 2018) and solar (Malaysia 2020) are different real sources aligned by
calendar slot (not a single co-located site); battery idealized (no efficiency/degradation); gross of capex/O&M.
"""
import os, json, glob
import numpy as np, pandas as pd
HERE=os.path.dirname(__file__); ND=os.path.join(HERE,"..","data","nsrdb")
CAP_CHG=89.27; SYS_KW=1000.0; BATT_E=2000.0; BATT_P=1000.0; DT=0.5; LEAD=1   # 1 step = 30-min-ahead persistence
def load_solar():
    fr=[pd.read_csv(f,skiprows=2) for f in sorted(glob.glob(os.path.join(ND,"petaling_jaya_*.csv")))]
    df=pd.concat(fr,ignore_index=True); df=df[df["Year"]==2020]
    df["dt"]=pd.to_datetime(df[["Year","Month","Day","Hour","Minute"]])
    for c in ["GHI","Clearsky GHI"]: df[c]=pd.to_numeric(df[c],errors="coerce")
    df=df.set_index("dt").sort_index()
    r=df[["GHI","Clearsky GHI"]].resample("30min").mean().reset_index()       # 10-min -> 30-min
    r["key"]=r["dt"].dt.strftime("%m-%d %H:%M"); return r
def load_load():
    d=pd.read_csv(os.path.join(HERE,"..","data","comstock","retail_fl_load.csv"),parse_dates=["timestamp"])
    d=d.set_index("timestamp").sort_index()
    r=d["load_kW"].resample("30min").mean().reset_index()                     # 15-min -> 30-min
    r["key"]=r["timestamp"].dt.strftime("%m-%d %H:%M"); return r
def reactive_peak(load,solar,C):
    soc=0.5*BATT_E; peak=0.0
    for ld,sa in zip(load,solar):
        net=ld-sa
        if net>C: dis=min(net-C,BATT_P,soc/DT); grid=net-dis; soc-=dis*DT
        else: chg=min(BATT_P,(BATT_E-soc)/DT,max(0.0,C-net)); soc+=chg*DT; grid=net+chg
        peak=max(peak,grid)
    return peak
def min_cap(load,solar):
    lo,hi=0.0,float(np.max(load))
    for _ in range(22):
        mid=(lo+hi)/2
        if reactive_peak(load,solar,mid)<=mid*1.002: hi=mid
        else: lo=mid
    return hi

S=load_solar(); L=load_load()
m=pd.merge(S,L[["key","load_kW"]],on="key",how="inner").dropna().sort_values("dt").reset_index(drop=True)
m=m[~((m["dt"].dt.month==2)&(m["dt"].dt.day==29))]
m["load_kW"]*=2000.0/m["load_kW"].max()                                       # scale shape to 2 MW peak
m["pv"]=np.clip(m["GHI"]/1000.0*SYS_KW,0,SYS_KW); m["cs_pv"]=np.clip(m["Clearsky GHI"]/1000.0*SYS_KW,0,SYS_KW)
m["k"]=np.where(m["cs_pv"]>5,m["pv"]/m["cs_pv"],1.0).clip(0,1.2)
m["fc_pv"]=(m["k"].shift(LEAD).fillna(1.0)*m["cs_pv"]).clip(0,SYS_KW)         # persistence-of-k forecast (error-bearing)
tod=m.groupby(m["dt"].dt.strftime("%H:%M"))["pv"].quantile(0.10)             # p10 climatology for blind-conservative
m["p10_pv"]=m["dt"].dt.strftime("%H:%M").map(tod).values

pol={k:[] for k in ["grid_only","solar_only","blind_conservative","real_forecast","oracle"]}
permon={}
for mo,g in m.groupby(m["dt"].dt.month):
    ld=g["load_kW"].values; sa=g["pv"].values
    p_grid=float(ld.max()); p_solar=float(np.clip(ld-sa,0,None).max())
    p_blind=reactive_peak(ld,sa,min_cap(ld,g["p10_pv"].values))
    p_fc=reactive_peak(ld,sa,min_cap(ld,g["fc_pv"].values))
    p_orc=reactive_peak(ld,sa,min_cap(ld,sa))
    for k,v in zip(pol,[p_grid,p_solar,p_blind,p_fc,p_orc]): pol[k].append(v)
    permon[int(mo)]={"grid":round(p_grid),"blind":round(p_blind),"forecast":round(p_fc),"oracle":round(p_orc)}
A={k:round(sum(v)*CAP_CHG) for k,v in pol.items()}
fc_val=A["blind_conservative"]-A["real_forecast"]; orc_val=A["blind_conservative"]-A["oracle"]
res={"assumptions":{"load":"NREL ComStock RetailStandalone FL (real 15-min, scaled to 2MW peak)",
        "solar":"NSRDB Petaling Jaya 2020 (real)","forecast":"clear-sky-index persistence (real, error-bearing), 30-min lead",
        "resolution":"30-min = exact RP4 MD window","battery":"2MWh/1MW","cap_charge_RM_per_kW_mo":CAP_CHG,
        "note":"REAL load + REAL error-bearing forecast; idealized battery, two-source alignment -> still a projection"},
     "annual_demand_charge_RM":A,
     "savings_RM_per_year":{
        "system_oracle_vs_grid":A["grid_only"]-A["oracle"],
        "system_realforecast_vs_grid":A["grid_only"]-A["real_forecast"],
        "REAL_forecast_value_vs_blind":fc_val,
        "oracle_forecast_value_vs_blind (headroom)":orc_val,
        "fraction_of_oracle_value_captured_by_real_forecast":round(fc_val/orc_val,3) if orc_val else None},
     "per_month_peak_kW":permon}
json.dump(res,open(os.path.join(HERE,"cni_peakshave_hardened_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
