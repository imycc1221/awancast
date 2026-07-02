"""
Multi-region check (reviewer R1-b) WITHOUT new data — split the existing Himawari Malaysia crop into
Peninsular / Sarawak / Sabah sub-regions and test whether the regime-selective pattern (optical flow
helps only on the evolving-cloud subset) holds in EACH region. Panel test days, day-block-bootstrap CIs.

Crop bbox = (lon 100..119, lat 1..7), array 325 rows x 825 cols, north-up.
  col = (lon-100)/19*825 ;  row = (7-lat)/6*325
Regions (approx land areas):
  Peninsular : lon 100-104   -> cols   0-174
  Sarawak    : lon 109-115   -> cols 390-650
  Sabah      : lon 115-119   -> cols 650-824
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10); H=3; THR=15.0
TEST=["20260510","20260525","20260601","20260602","20260603","20260604"]
REGIONS={"Peninsular":(0,175),"Sarawak":(390,650),"Sabah":(650,825)}

def frames(day):
    out={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hh=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1)
        out[dt.datetime.strptime(day+hh,"%Y%m%d%H%M")]=np.load(f)
    return out
def to_u8(b): x=np.where(np.isfinite(b),b,300.); return np.clip((x-180)/130*255,0,255).astype(np.uint8)
def advect(p,c,s=H):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0)
    h,w=c.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    return cv2.remap(np.where(np.isfinite(c),c,300.).astype(np.float32),
        (gx+s*fl[...,0]).astype(np.float32),(gy+s*fl[...,1]).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)

# per-day, per-region sum-abs-err on the high-change subset
perday={r:{} for r in REGIONS}
for d in TEST:
    fr=frames(d); ts=sorted(fr)
    for r in REGIONS: perday[r][d]={"of":0.,"pe":0.,"n":0}
    for i in range(1,len(ts)):
        t=ts[i]; g=t+H*STEP
        if (t-ts[i-1])!=STEP or g not in fr: continue
        p1,c,a=fr[ts[i-1]],fr[t],fr[g]; of=advect(p1,c)
        for r,(c0,c1) in REGIONS.items():
            cc=c[:,c0:c1]; aa=a[:,c0:c1]; oo=of[:,c0:c1]
            v=np.isfinite(aa)&np.isfinite(cc); hc=v&(np.abs(aa-cc)>THR)
            if hc.sum()==0: continue
            perday[r][d]["of"]+=np.abs(aa[hc]-oo[hc]).sum()
            perday[r][d]["pe"]+=np.abs(aa[hc]-cc[hc]).sum()
            perday[r][d]["n"]+=int(hc.sum())

rng=np.random.default_rng(0); days=TEST
def skill(region,sel):
    of=sum(perday[region][d]["of"] for d in sel); pe=sum(perday[region][d]["pe"] for d in sel)
    n=sum(perday[region][d]["n"] for d in sel)
    if n==0 or pe==0: return np.nan
    return 1-(of/n)/(pe/n)
res={"experiment":"multi-region optical-flow high-change skill, panel test days","by_region":{}}
for r in REGIONS:
    pt=skill(r,days); boot=[skill(r,list(rng.choice(days,len(days),replace=True))) for _ in range(2000)]
    npx=sum(perday[r][d]["n"] for d in days)
    res["by_region"][r]={"highchange_skill":round(float(pt),3),
        "ci95":[round(float(np.nanpercentile(boot,2.5)),3),round(float(np.nanpercentile(boot,97.5)),3)],
        "n_highchange_px":int(npx)}
json.dump(res,open(os.path.join(os.path.dirname(__file__),"multiregion_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
