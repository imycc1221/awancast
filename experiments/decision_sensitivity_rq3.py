"""
B4 sensitivity (Codex review #9): is the SELCO>ATAP>NEM result robust to PV size and export rate?
Reuses the leakage-free day-ahead forecast policy. CPU, NSRDB 2020.
"""
import os, glob, json
import numpy as np, pandas as pd
DATA=os.path.join(os.path.dirname(__file__),"..","data","nsrdb")
IMPORT=0.2703; DT_H=10/60
APPL={"dishwasher":(1.5,9,9,17),"washer":(1.0,6,9,17),"ev":(7.0,12,10,16)}
NAIVE_H=20.0

def load():
    df=pd.read_csv(os.path.join(DATA,"petaling_jaya_2020.csv"),skiprows=2)
    df["dt"]=pd.to_datetime(df[["Year","Month","Day","Hour","Minute"]])
    for c in ["GHI","Clearsky GHI"]: df[c]=pd.to_numeric(df[c],errors="coerce")
    df["hour_f"]=df["Hour"]+df["Minute"]/60.0; df["doy"]=df["dt"].dt.dayofyear; return df

def base_load(h): return 0.3+0.4*np.exp(-((h-8)**2)/4)+0.7*np.exp(-((h-20)**2)/6)
def place(n,s,e,d): a=np.zeros(n); a[s:s+d]=e/(d*DT_H); return a
def sched(fc,hf,e,d,w0,w1):
    win=np.where((hf>=w0)&(hf<w1))[0]
    if len(win)==0: return None
    best,bs=-1,win[0]
    for s in range(win[0],win[-1]-d+2):
        ov=fc[s:s+d].sum()
        if ov>best: best,bs=ov,s
    return bs

def daydata(df,sys_kw):
    days=[]
    for doy,g in df.groupby("doy"):
        g=g.sort_values("hour_f"); ghi=g["GHI"].values
        if np.nansum(ghi)<100: continue
        days.append({"hf":g["hour_f"].values,"pv":np.clip(ghi/1000*sys_kw,0,sys_kw),
                     "cs":np.clip(g["Clearsky GHI"].values/1000*sys_kw,0,sys_kw),
                     "base":base_load(g["hour_f"].values)})
    return days

def saved(days,export,sys_kw):
    acc=[]; prev=None
    for d in days:
        hf,pv,cs,base=d["hf"],d["pv"],d["cs"],d["base"]; n=len(pv)
        sh=int(np.argmin(np.abs(hf-NAIVE_H)))
        fc = prev if (prev is not None and prev.shape==pv.shape) else cs   # day-ahead, cs fallback
        def cost(appl):
            net=base+appl-pv; imp=np.clip(net,0,None)*DT_H; exp=np.clip(-net,0,None)*DT_H
            return imp.sum()*IMPORT-exp.sum()*export
        an=np.zeros(n)
        for (e,dd,_,_) in APPL.values(): an+=place(n,min(sh,n-dd-1),e,dd)
        af=np.zeros(n)
        for (e,dd,w0,w1) in APPL.values():
            s=sched(fc,hf,e,dd,w0,w1); s=min(sh,n-dd-1) if (s is None or s+dd>n) else s; af+=place(n,s,e,dd)
        acc.append(cost(an)-cost(af)); prev=pv
    return float(np.mean(acc))

df=load()
res={"pv_size_sweep":{}, "export_rate_sweep_5kW":{}}
EXPORT={"SELCO":0.0,"ATAP":0.10,"NEM":0.2703}
for kw in [3,5,8]:
    days=daydata(df,kw)
    res["pv_size_sweep"][f"{kw}kW"]={s:round(saved(days,e,kw),3) for s,e in EXPORT.items()}
days5=daydata(df,5)
for er in [0.0,0.05,0.10,0.15,0.20,0.2703]:
    res["export_rate_sweep_5kW"][f"{er:.2f}"]=round(saved(days5,er,5),3)
json.dump(res,open(os.path.join(os.path.dirname(__file__),"decision_sensitivity_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
