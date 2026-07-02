"""
Parse the downloaded Himawari-9 B13 HSD segments -> geolocated cloud-top brightness
temperature, crop to Malaysia, report stats, save a preview PNG + a .npy array.
Proves the satpy pipeline end-to-end on the smoke-test frame.
"""
import glob, os, sys
import numpy as np

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "himawari", "20260601")
MAL_BBOX = (100.0, 1.0, 119.0, 7.0)  # (min_lon, min_lat, max_lon, max_lat) — Peninsular+Borneo Malaysia

files = sorted(glob.glob(os.path.join(SAMPLE_DIR, "HS_H09_*_B13_*.DAT.bz2")))
print("segments found:", len(files))
for f in files: print("  ", os.path.basename(f))
if not files:
    sys.exit("no B13 segments — run fetch_himawari.py first")

from satpy import Scene
scn = Scene(reader="ahi_hsd", filenames=files)
scn.load(["B13"])  # 10.4 um IR -> brightness_temperature (K) by default
print("loaded B13:", scn["B13"].shape, "units:", scn["B13"].attrs.get("units"))

# crop to Malaysia
try:
    mal = scn.crop(ll_bbox=MAL_BBOX)
    arr = mal["B13"].values
    region = "Malaysia-cropped"
except Exception as e:
    print("crop failed (segments may not fully cover bbox):", repr(e))
    arr = scn["B13"].values
    region = "full-segments (uncropped)"

finite = arr[np.isfinite(arr)]
print(f"\n[{region}] shape={arr.shape}  valid_px={finite.size}")
if finite.size:
    print(f"  brightness temp K: min={finite.min():.1f} mean={finite.mean():.1f} max={finite.max():.1f}")
    # cold cloud tops (convective) vs warm clear: low BT = high cloud
    print(f"  cold-cloud fraction (<240K, deep convection proxy): {100*np.mean(finite<240):.1f}%")

np.save(os.path.join(SAMPLE_DIR, "B13_malaysia.npy"), arr)
print("saved array ->", os.path.join(SAMPLE_DIR, "B13_malaysia.npy"))

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.figure(figsize=(6,5))
    plt.imshow(arr, cmap="gray_r")
    plt.colorbar(label="Brightness temp (K)")
    plt.title("Himawari-9 B13 (10.4um) — " + region)
    out = os.path.join(SAMPLE_DIR, "B13_malaysia_preview.png")
    plt.savefig(out, dpi=110, bbox_inches="tight")
    print("saved preview ->", out)
except Exception as e:
    print("(matplotlib preview skipped:", repr(e), ")")
