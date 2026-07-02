"""
Build a multi-day Himawari panel for the StormGate experiments: download B13 Malaysia segments
(AWS anon) AND parse to cached bt_*.npy (satpy), across seasonally-spread days. Idempotent:
skips files/caches that already exist. Designed to run in the BACKGROUND (slow satpy parse).
"""
import os, glob, datetime as dt
import numpy as np
import boto3
from botocore import UNSIGNED
from botocore.config import Config

BUCKET="noaa-himawari9"; PREFIX="AHI-L1b-FLDK"
ROOT=os.path.join(os.path.dirname(__file__),"himawari")
MAL_BBOX=(100.0,1.0,119.0,7.0); SEG=["S0510","S0610","S0710"]
# seasonally spread across 2026 H1 (NE monsoon -> inter-monsoon), 05:00-07:00 UTC window (= 1-3pm local)
DAYS=["20260110","20260125","20260210","20260225","20260310","20260325",
      "20260410","20260425","20260510","20260525",
      "20260601","20260602","20260603","20260604"]  # incl. June days used by panel_eval.py (reproducibility)
WIN=[(5,0),(7,0)]  # start, end (h,m) UTC inclusive, 10-min step
s3=boto3.client("s3",config=Config(signature_version=UNSIGNED))

def stamps(day):
    d0=dt.datetime.strptime(day,"%Y%m%d"); out=[]
    t=d0.replace(hour=WIN[0][0],minute=WIN[0][1]); end=d0.replace(hour=WIN[1][0],minute=WIN[1][1])
    while t<=end: out.append(t); t+=dt.timedelta(minutes=10)
    return out

def fetch(ts):
    pref=f"{PREFIX}/{ts:%Y/%m/%d/%H%M}/"
    r=s3.list_objects_v2(Bucket=BUCKET,Prefix=pref)
    got=[]
    d=os.path.join(ROOT,f"{ts:%Y%m%d}"); os.makedirs(d,exist_ok=True)
    for o in r.get("Contents",[]):
        k=o["Key"]
        if "_B13_" not in k or not any(s in k for s in SEG): continue
        dest=os.path.join(d,os.path.basename(k))
        if not (os.path.exists(dest) and os.path.getsize(dest)==o["Size"]):
            s3.download_file(BUCKET,k,dest)
        got.append(dest)
    return d, got

def parse(ts):
    d=os.path.join(ROOT,f"{ts:%Y%m%d}"); cache=os.path.join(d,f"bt_{ts:%H%M}.npy")
    if os.path.exists(cache): return True
    files=sorted(glob.glob(os.path.join(d,f"HS_H09_{ts:%Y%m%d_%H%M}_B13_*.DAT.bz2")))
    if len(files)<3: return False
    from satpy import Scene
    scn=Scene(reader="ahi_hsd",filenames=files); scn.load(["B13"])
    arr=scn.crop(ll_bbox=MAL_BBOX)["B13"].values.astype(np.float32)
    np.save(cache,arr); return True

total_parsed=0
for day in DAYS:
    n=0
    for ts in stamps(day):
        _,got=fetch(ts)
        if len(got)>=3 and parse(ts): n+=1
    total_parsed+=n
    print(f"{day}: {n} frames cached", flush=True)
print(f"PANEL DONE: {total_parsed} new frames across {len(DAYS)} days", flush=True)
