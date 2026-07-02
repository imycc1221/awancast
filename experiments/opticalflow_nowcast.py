"""
StormGate experiment B2 — optical-flow cloud-field nowcast on REAL Himawari-9 B13.
Tests the paper's Layer-1a claim on Malaysian data: does Farneback advection beat
persistence at predicting the cloud-top-temperature field 30/60 min ahead — and does
it fail where clouds form/dissipate (Smith et al. 2024 premise)?

Pipeline: parse each HSD frame (satpy) -> Malaysia-cropped brightness temp (cached .npy)
-> Farneback flow between consecutive frames -> advect forward h steps (cv2.remap)
-> MAE(K) vs persistence, overall and on the high-change ("onset/evolution") subset.
"""
import glob, os, re, datetime as dt
import numpy as np
import cv2

FDIR = os.path.join(os.path.dirname(__file__), "..", "data", "himawari", "20260601")
MAL_BBOX = (100.0, 1.0, 119.0, 7.0)
STEP = dt.timedelta(minutes=10)
HORIZONS = {"30min": 3, "60min": 6}

def parse_frame(stem_ts):
    """Parse the 3 Malaysia segments for one timestamp -> cropped BT array, cached."""
    cache = os.path.join(FDIR, f"bt_{stem_ts:%H%M}.npy")
    if os.path.exists(cache):
        return np.load(cache)
    files = sorted(glob.glob(os.path.join(FDIR, f"HS_H09_{stem_ts:%Y%m%d_%H%M}_B13_*.DAT.bz2")))
    if len(files) < 3:
        return None
    from satpy import Scene
    scn = Scene(reader="ahi_hsd", filenames=files)
    scn.load(["B13"])
    arr = scn.crop(ll_bbox=MAL_BBOX)["B13"].values.astype(np.float32)
    np.save(cache, arr)
    return arr

def timestamps():
    ts = set()
    for f in glob.glob(os.path.join(FDIR, "HS_H09_*_B13_*.DAT.bz2")):
        m = re.search(r"_(\d{8})_(\d{4})_B13_", os.path.basename(f))
        if m:
            ts.add(dt.datetime.strptime(m.group(1)+m.group(2), "%Y%m%d%H%M"))
    return sorted(ts)

def to_u8(bt):
    """Normalize BT (K) to 0-255 for flow; fill non-finite with warm value."""
    x = np.where(np.isfinite(bt), bt, 300.0)
    lo, hi = 180.0, 310.0
    return np.clip((x - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)

def advect(prev_bt, cur_bt, steps):
    """Estimate flow prev->cur, advect cur forward `steps` increments."""
    flow = cv2.calcOpticalFlowFarneback(to_u8(prev_bt), to_u8(cur_bt),
                                        None, 0.5, 3, 25, 3, 7, 1.5, 0)
    h, w = cur_bt.shape
    gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    mapx = (gx + steps * flow[..., 0]).astype(np.float32)
    mapy = (gy + steps * flow[..., 1]).astype(np.float32)
    filled = np.where(np.isfinite(cur_bt), cur_bt, 300.0).astype(np.float32)
    return cv2.remap(filled, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

def mae(a, b, mask):
    m = mask & np.isfinite(a) & np.isfinite(b)
    return float(np.mean(np.abs(a[m] - b[m]))) if m.any() else float("nan")

ts = timestamps()
print("frames:", len(ts), "from", ts[0], "to", ts[-1])
frames = {t: parse_frame(t) for t in ts}
frames = {t: a for t, a in frames.items() if a is not None}
ts = sorted(frames)
shape = frames[ts[0]].shape
print("frame shape:", shape, "| cached BT arrays:", len(ts))

def sae(a, b, mask):
    m = mask & np.isfinite(a) & np.isfinite(b)
    return float(np.sum(np.abs(a[m]-b[m]))), int(m.sum())   # sum-abs-err, n (for pixel-weighting)

results = {}
for hname, h in HORIZONS.items():
    of_err, pe_err, of_on, pe_on, n_on = [], [], [], [], 0
    of_sae=pe_sae=npx=of_sae_on=pe_sae_on=npx_on=0.0
    for i in range(1, len(ts)):
        t = ts[i]
        # need prev (t-1) for flow and target (t+h)
        tgt = t + h * STEP
        if (t - ts[i-1]) != STEP or tgt not in frames:
            continue
        cur, prev, actual = frames[t], frames[ts[i-1]], frames[tgt]
        pred_of = advect(prev, cur, h)
        pred_pe = cur  # persistence
        valid = np.isfinite(actual) & np.isfinite(cur)
        # high-change subset = cloud field evolving (onset/dissipation proxy)
        change = np.abs(actual - cur)
        onset = valid & (change > 15.0)  # >15K BT change = strong cloud evolution
        of_err.append(mae(pred_of, actual, valid)); pe_err.append(mae(pred_pe, actual, valid))
        of_on.append(mae(pred_of, actual, onset)); pe_on.append(mae(pred_pe, actual, onset))
        n_on += int(onset.sum())
        s,nn=sae(pred_of,actual,valid); of_sae+=s; npx+=nn
        s,_=sae(pred_pe,actual,valid); pe_sae+=s
        s,no=sae(pred_of,actual,onset); of_sae_on+=s; npx_on+=no
        s,_=sae(pred_pe,actual,onset); pe_sae_on+=s
    of_m, pe_m = np.nanmean(of_err), np.nanmean(pe_err)          # issuance-weighted
    of_o, pe_o = np.nanmean(of_on), np.nanmean(pe_on)
    of_pw, pe_pw = of_sae/npx, pe_sae/npx                        # pixel-weighted
    of_pw_o, pe_pw_o = of_sae_on/npx_on, pe_sae_on/npx_on
    results[hname] = {
        "n_pairs": len(of_err),
        "overall_issuance_weighted": {"optical_flow_MAE_K": round(of_m,2), "persistence_MAE_K": round(pe_m,2),
                    "skill_vs_persist": round(1 - of_m/pe_m, 3)},
        "overall_pixel_weighted": {"optical_flow_MAE_K": round(of_pw,2), "persistence_MAE_K": round(pe_pw,2),
                    "skill_vs_persist": round(1 - of_pw/pe_pw, 3)},
        "high_change_issuance_weighted": {"optical_flow_MAE_K": round(of_o,2), "persistence_MAE_K": round(pe_o,2),
                    "skill_vs_persist": round(1 - of_o/pe_o, 3), "n_px": n_on},
        "high_change_pixel_weighted": {"optical_flow_MAE_K": round(of_pw_o,2), "persistence_MAE_K": round(pe_pw_o,2),
                    "skill_vs_persist": round(1 - of_pw_o/pe_pw_o, 3)},
    }
    print(f"[{hname}] overall OF {of_m:.2f} vs persist {pe_m:.2f} (skill {1-of_m/pe_m:+.3f}) | "
          f"high-change OF {of_o:.2f} vs persist {pe_o:.2f} (skill {1-of_o/pe_o:+.3f})")

import json
out = os.path.join(os.path.dirname(__file__), "opticalflow_results.json")
json.dump(results, open(out, "w"), indent=2)
print("WROTE", out)
