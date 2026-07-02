"""
A4 — onset threshold + horizon sensitivity for the satellite stack (closes "hand-picked 15K / 30min").
Pooled optical-flow high-change skill vs persistence across panel test days, for THR in {10,15,20} K and
H in {3,6} (30/60 min), with day-block-bootstrap 95% CIs. Shows the regime-selective signal is not an
artifact of the chosen onset definition. CPU; reads cached bt_*.npy.
"""
import glob, os, re, datetime as dt, json
import numpy as np, cv2
ROOT=os.path.join(os.path.dirname(__file__),"..","data","himawari")
STEP=dt.timedelta(minutes=10)
TEST=["20260510","20260525","20260601","20260602","20260603","20260604"]
def frames(day):
    o={}
    for f in glob.glob(os.path.join(ROOT,day,"bt_*.npy")):
        hh=re.search(r"bt_(\d{4})\.npy",os.path.basename(f)).group(1); o[dt.datetime.strptime(day+hh,"%Y%m%d%H%M")]=np.load(f)
    return o
def to_u8(b): x=np.where(np.isfinite(b),b,300.); return np.clip((x-180)/130*255,0,255).astype(np.uint8)
def advect(p,c,s):
    fl=cv2.calcOpticalFlowFarneback(to_u8(p),to_u8(c),None,0.5,3,25,3,7,1.5,0)
    h,w=c.shape; gx,gy=np.meshgrid(np.arange(w),np.arange(h))
    return cv2.remap(np.where(np.isfinite(c),c,300.).astype(np.float32),(gx+s*fl[...,0]).astype(np.float32),(gy+s*fl[...,1]).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)

res={"experiment":"onset THR x horizon sensitivity, optical-flow high-change skill (panel test days)","grid":{}}
rng=np.random.default_rng(0)
for Hs in [3,6]:
    for THR in [10.0,15.0,20.0]:
        perday={}
        for d in TEST:
            fr=frames(d); ts=sorted(fr); of_s=pe_s=n=0
            for i in range(1,len(ts)):
                t=ts[i]; g=t+Hs*STEP
                if (t-ts[i-1])!=STEP or g not in fr: continue
                p1,c,a=fr[ts[i-1]],fr[t],fr[g]; of=advect(p1,c,Hs)
                v=np.isfinite(a)&np.isfinite(c); hc=v&(np.abs(a-c)>THR)
                if hc.sum()==0: continue
                of_s+=np.abs(a[hc]-of[hc]).sum(); pe_s+=np.abs(a[hc]-c[hc]).sum(); n+=int(hc.sum())
            if n>0: perday[d]=(of_s,pe_s,n)
        days=list(perday)
        def skill(sel):
            o=sum(perday[d][0] for d in sel); p=sum(perday[d][1] for d in sel); nn=sum(perday[d][2] for d in sel)
            return 1-(o/nn)/(p/nn) if nn and p else np.nan
        pt=skill(days); boot=[skill(list(rng.choice(days,len(days),replace=True))) for _ in range(1500)]
        res["grid"][f"H{Hs*10}min_THR{int(THR)}"]={"highchange_skill":round(float(pt),3),
            "ci95":[round(float(np.nanpercentile(boot,2.5)),3),round(float(np.nanpercentile(boot,97.5)),3)],
            "n_px":int(sum(perday[d][2] for d in days))}
        print(f"H={Hs*10}min THR={int(THR)}: skill {pt:.3f}",flush=True)
json.dump(res,open(os.path.join(os.path.dirname(__file__),"sensitivity_sweep_results.json"),"w"),indent=2)
print(json.dumps(res,indent=2))
