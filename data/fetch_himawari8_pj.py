"""
BT->irradiance prep: fetch Himawari-8 B13 (2020, overlaps NSRDB) around Petaling Jaya, parse to a small
BT patch, save a compact npz (patches + UTC timestamps). Heavy satpy parse -> run in BACKGROUND.
Output: data/himawari8_pj/bt_pj_2020.npz  with arrays: patches (N,h,w) BT[K], utc (N) ISO strings.
"""
import os, glob, datetime as dt
import numpy as np
import boto3
from botocore import UNSIGNED
from botocore.config import Config

BUCKET="noaa-himawari8"; PREFIX="AHI-L1b-FLDK"
OUT=os.path.join(os.path.dirname(__file__),"himawari8_pj"); os.makedirs(OUT,exist_ok=True)
RAW=os.path.join(OUT,"raw"); os.makedirs(RAW,exist_ok=True)
SEG=["S0510","S0610","S0710"]                       # cover Malaysia latitudes incl. PJ (3N)
PJ_BBOX=(100.5,2.0,102.5,4.0)                       # ~2x2 deg around Petaling Jaya (101.61,3.11)
DAYS=["20200315","20200615","20200915","20201115"]  # 4 days spread across 2020
WIN=[(0,0),(6,0)]                                   # UTC 00:00-06:00 = 08:00-14:00 local (peak sun)
s3=boto3.client("s3",config=Config(signature_version=UNSIGNED))

def stamps(day):
    d0=dt.datetime.strptime(day,"%Y%m%d"); t=d0.replace(hour=WIN[0][0]); end=d0.replace(hour=WIN[1][0]); out=[]
    while t<=end: out.append(t); t+=dt.timedelta(minutes=10)
    return out

def fetch(ts):
    pref=f"{PREFIX}/{ts:%Y/%m/%d/%H%M}/"; r=s3.list_objects_v2(Bucket=BUCKET,Prefix=pref); got=[]
    for o in r.get("Contents",[]):
        k=o["Key"]
        if "_B13_" not in k or not any(s in k for s in SEG): continue
        dest=os.path.join(RAW,os.path.basename(k))
        if not (os.path.exists(dest) and os.path.getsize(dest)==o["Size"]): s3.download_file(BUCKET,k,dest)
        got.append(dest)
    return got

def parse(ts,files):
    from satpy import Scene
    scn=Scene(reader="ahi_hsd",filenames=files); scn.load(["B13"])
    return scn.crop(ll_bbox=PJ_BBOX)["B13"].values.astype(np.float32)

patches=[]; utcs=[]
for day in DAYS:
    n=0
    for ts in stamps(day):
        files=sorted(glob.glob(os.path.join(RAW,f"HS_H08_{ts:%Y%m%d_%H%M}_B13_*.DAT.bz2")))
        if len(files)<3: files=fetch(ts)
        if len(files)<3: continue
        try:
            arr=parse(ts,files); patches.append(arr); utcs.append(ts.strftime("%Y-%m-%dT%H:%M")); n+=1
        except Exception as e:
            print("parse fail",ts,repr(e)[:80],flush=True)
    print(f"{day}: {n} frames",flush=True)
# pad to common shape (crops should match; guard anyway)
shapes=set(p.shape for p in patches); print("shapes:",shapes,flush=True)
P=np.stack(patches) if len(shapes)==1 else np.stack([p[:min(s[0] for s in shapes),:min(s[1] for s in shapes)] for p in patches])
np.savez_compressed(os.path.join(OUT,"bt_pj_2020.npz"),patches=P,utc=np.array(utcs))
print("WROTE",os.path.join(OUT,"bt_pj_2020.npz"),"frames",len(utcs),"shape",P.shape,flush=True)
