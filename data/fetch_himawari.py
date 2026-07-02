"""
fetch_himawari.py — download Himawari-9 AHI L1b full-disk frames from the AWS Open Data
Registry (bucket: noaa-himawari9) via ANONYMOUS S3 access. No JAXA registration, no API key.

This gets the RAW Himawari Standard Data (.DAT.bz2). To turn it into geolocated
brightness-temperature / irradiance arrays you then need `satpy` (reader 'ahi_hsd') + pyresample
(see README note at bottom) — that is the next, heavier dependency, not handled here.

Band 13 (10.4 um IR, R20 = 2 km) is the default: it gives cloud-top temperature, the key input
for optical-flow cloud tracking and the convective-regime detector.

Malaysia (~1-7 N, 100-119 E) lies near the Himawari sub-satellite equator, so full-disk latitude
segments S05-S07 cover it (default). Use --segments all to fetch the whole disk.

USAGE
  python fetch_himawari.py --start 2026-01-15T03:00 --end 2026-01-15T09:00 --band B13
  python fetch_himawari.py --start ... --end ... --band B13 --segments all
  python fetch_himawari.py --start ... --end ... --dry-run        # size estimate only
"""
import argparse, os, datetime as dt
import boto3
from botocore import UNSIGNED
from botocore.config import Config

BUCKET = "noaa-himawari9"
PREFIX = "AHI-L1b-FLDK"
OUT_ROOT = os.path.join(os.path.dirname(__file__), "himawari")
MALAYSIA_SEGMENTS = ["S0510", "S0610", "S0710"]  # near-equator full-disk segments

def client():
    return boto3.client("s3", config=Config(signature_version=UNSIGNED))

def frames(start, end, step_min=10):
    t = start
    while t <= end:
        yield t
        t += dt.timedelta(minutes=step_min)

def keys_for_frame(s3, t, band, seg_filter):
    pref = f"{PREFIX}/{t:%Y/%m/%d/%H%M}/"
    r = s3.list_objects_v2(Bucket=BUCKET, Prefix=pref)
    out = []
    for o in r.get("Contents", []):
        k = o["Key"]
        if f"_{band}_" not in k:
            continue
        if seg_filter and not any(s in k for s in seg_filter):
            continue
        out.append((k, o["Size"]))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True, help="UTC, e.g. 2026-01-15T03:00")
    ap.add_argument("--end", required=True, help="UTC, e.g. 2026-01-15T09:00")
    ap.add_argument("--band", default="B13")
    ap.add_argument("--segments", default="malaysia",
                    choices=["malaysia", "all"], help="malaysia=S05-S07, all=full disk")
    ap.add_argument("--step-min", type=int, default=10)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    start = dt.datetime.fromisoformat(a.start)
    end = dt.datetime.fromisoformat(a.end)
    seg = None if a.segments == "all" else MALAYSIA_SEGMENTS
    s3 = client()

    plan, total = [], 0
    for t in frames(start, end, a.step_min):
        for k, sz in keys_for_frame(s3, t, a.band, seg):
            plan.append((t, k, sz)); total += sz
    print(f"frames {start}..{end}  band {a.band}  segments={a.segments}")
    print(f"files: {len(plan)}   total: {total/1e6:.1f} MB")
    if a.dry_run or not plan:
        print("(dry-run — nothing downloaded)" if a.dry_run else "(no files found)")
        return

    for t, k, sz in plan:
        d = os.path.join(OUT_ROOT, f"{t:%Y%m%d}")
        os.makedirs(d, exist_ok=True)
        dest = os.path.join(d, os.path.basename(k))
        if os.path.exists(dest) and os.path.getsize(dest) == sz:
            continue
        s3.download_file(BUCKET, k, dest)
        print(f"  + {os.path.basename(k)}  {sz/1e6:.1f} MB")
    print(f"DONE -> {OUT_ROOT}")

if __name__ == "__main__":
    main()

# ---------------------------------------------------------------------------
# NEXT STEP (parsing) — turn .DAT.bz2 into geolocated cloud-top temperature:
#   pip install "satpy[ahi]" pyresample   # heavier; may need conda on Windows
#   from satpy import Scene
#   scn = Scene(reader="ahi_hsd", filenames=glob("data/himawari/20260115/HS_H09_*_B13_*S05*"))
#   scn.load(["B13"]); cropped = scn.crop(ll_bbox=(100, 1, 119, 7))  # Malaysia
# Then warp consecutive frames with OpenCV Farneback for the optical-flow baseline.
# ---------------------------------------------------------------------------
