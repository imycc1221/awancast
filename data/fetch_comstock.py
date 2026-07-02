"""
Fetch a REAL commercial interval-meter load profile from NREL ComStock (End-Use Load Profiles for the US
Building Stock, 2024 comstock_amy2018_release_2), anonymous OEDI S3. We pick a RetailStandalone (big-box
retail ~ mall anchor) in Florida (hot-humid, climate zone 2A — a reasonable Malaysian C&I proxy) and save
its 15-min total-electricity load. Citable: NREL ComStock, doi pending / oedi-data-lake.
"""
import urllib.request, ssl, urllib.parse, re, io, os
import pyarrow.parquet as pq, pandas as pd, numpy as np
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
BASE="https://oedi-data-lake.s3.amazonaws.com/"
REL="nrel-pds-building-stock/end-use-load-profiles-for-us-building-stock/2024/comstock_amy2018_release_2/"
OUT=os.path.join(os.path.dirname(__file__),"comstock"); os.makedirs(OUT,exist_ok=True)
def get(key,t=120): return urllib.request.urlopen(BASE+urllib.parse.quote(key),timeout=t,context=ctx).read()
def lst(prefix,mk=200):
    x=urllib.request.urlopen(BASE+"?list-type=2&max-keys=%d&prefix=%s"%(mk,urllib.parse.quote(prefix)),timeout=30,context=ctx).read().decode()
    return re.findall(r"<Key>(.*?)</Key>",x)
# 1) county metadata -> pick a median-sized RetailStandalone
mkey=[k for k in lst(REL+"metadata_and_annual_results/by_state_and_county/full/parquet/state=FL/") if k.endswith(".parquet")][0]
md=pq.read_table(io.BytesIO(get(mkey))).to_pandas()
ret=md[md["in.comstock_building_type"]=="RetailStandalone"].copy()
ecol=[c for c in ret.columns if "electricity.total" in c and ("energy" in c or "kwh" in c.lower())]
ret=ret.sort_values(ecol[0]) if ecol else ret
bid=int(ret.iloc[len(ret)//2]["bldg_id"])               # median building
print("picked RetailStandalone bldg_id",bid,"| county",mkey.split("county=")[1][:9])
# 2) its 15-min timeseries
tkey=REL+"timeseries_individual_buildings/by_state/upgrade=0/state=FL/%d-0.parquet"%bid
ts=pq.read_table(io.BytesIO(get(tkey))).to_pandas()
tcol=[c for c in ts.columns if c.lower() in ("timestamp","time")][0]
lcol=[c for c in ts.columns if "electricity.total.energy_consumption" in c][0]
ts[tcol]=pd.to_datetime(ts[tcol]); ts=ts.sort_values(tcol)
step_h=(ts[tcol].iloc[1]-ts[tcol].iloc[0]).seconds/3600.0
out=pd.DataFrame({"timestamp":ts[tcol].values,"load_kW":ts[lcol].values/step_h})  # kWh/step -> kW
out.to_csv(os.path.join(OUT,"retail_fl_load.csv"),index=False)
print("saved",len(out),"rows | step %.2fh | peak %.0f kW | mean %.0f kW"%(step_h,out.load_kW.max(),out.load_kW.mean()))
print("columns sample:",lcol)
