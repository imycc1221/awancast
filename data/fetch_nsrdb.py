"""
fetch_nsrdb.py — Download NSRDB Himawari 2016-2020 solar irradiance for Awan-Cast.

WHAT THIS DOES
  Downloads satellite-derived solar irradiance (GHI, DNI, DHI, clear-sky GHI,
  cloud type, air temperature, solar zenith) at 10-minute resolution for one or
  more Malaysian locations, one CSV per location per year, into data/nsrdb/.

BEFORE YOU RUN
  1. Get a free NREL API key: https://developer.nrel.gov/signup/  (instant, by email)
  2. pip install requests pandas
  3. Fill in API_KEY, FULL_NAME, EMAIL, AFFILIATION below.
  4. python fetch_nsrdb.py

NOTES
  - The direct-CSV endpoint serves one point + one year per request, so we loop.
  - Free tier rate limits apply; the script pauses between requests.
  - 5 years x 1 location ~ a few minutes. Add more LOCATIONS as needed.
"""

import os
import time
import requests

# ---------------------------------------------------------------------------
# FILL THESE IN  (from your NREL signup)
# ---------------------------------------------------------------------------
API_KEY      = "PASTE_YOUR_NREL_API_KEY_HERE"
FULL_NAME    = "Low Yan Cheng"
EMAIL        = "your_email@example.com"
AFFILIATION  = "Asia Pacific University"
REASON       = "SEDA Innovation Challenge 2026 - student research"

# ---------------------------------------------------------------------------
# Locations to download  (name, longitude, latitude)
# Petaling Jaya is the Awan-Cast pilot site. Add more rows if you want.
# ---------------------------------------------------------------------------
LOCATIONS = [
    ("petaling_jaya", 101.6068, 3.1073),   # Peninsular / Solar ATAP
    ("kuching",       110.3592, 1.5533),   # Sarawak / NEM
    ("kota_kinabalu", 116.0735, 5.9804),   # Sabah / SELCO-PV
]

YEARS      = [2016, 2017, 2018, 2019, 2020]
INTERVAL   = "10"   # minutes: 10, 30 or 60   (10 = highest resolution)
ATTRIBUTES = ",".join([
    "ghi", "dni", "dhi", "clearsky_ghi", "clearsky_dni", "clearsky_dhi",
    "cloud_type", "air_temperature", "solar_zenith_angle",
    "wind_speed", "relative_humidity", "surface_pressure",
])

BASE_URL = "https://developer.nlr.gov/api/nsrdb/v2/solar/himawari-download.csv"  # developer.nrel.gov was retired May 2026 -> migrated to developer.nlr.gov
OUT_DIR  = os.path.join(os.path.dirname(__file__), "nsrdb")


def fetch(name, lon, lat, year):
    """Download one location-year CSV."""
    params = {
        "api_key":     API_KEY,
        "wkt":         f"POINT({lon} {lat})",
        "names":       str(year),
        "attributes":  ATTRIBUTES,
        "interval":    INTERVAL,
        "utc":         "false",
        "leap_day":    "true",
        "full_name":   FULL_NAME,
        "email":       EMAIL,
        "affiliation": AFFILIATION,
        "reason":      REASON,
        "mailing_list": "false",
    }
    out_path = os.path.join(OUT_DIR, f"{name}_{year}.csv")
    if os.path.exists(out_path):
        print(f"  skip  {name} {year}  (already downloaded)")
        return
    print(f"  fetch {name} {year} ...", end=" ", flush=True)
    r = requests.get(BASE_URL, params=params, timeout=120)
    if r.status_code == 200 and r.text.lstrip().lower().startswith(("source", '"source')):
        with open(out_path, "w", encoding="utf-8", newline="") as f:
            f.write(r.text)
        print(f"OK ({len(r.text)//1024} KB)")
    else:
        # NREL returns JSON or an error string on failure
        print(f"FAILED  [HTTP {r.status_code}]")
        print("    response:", r.text[:300].replace("\n", " "))


def main():
    if API_KEY == "PASTE_YOUR_NREL_API_KEY_HERE":
        print("ERROR: edit fetch_nsrdb.py and paste your NREL API key first.")
        print("Get one free at https://developer.nrel.gov/signup/")
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Downloading NSRDB Himawari into {OUT_DIR}")
    for name, lon, lat in LOCATIONS:
        print(f"\n{name}  ({lat}, {lon})")
        for year in YEARS:
            fetch(name, lon, lat, year)
            time.sleep(2)   # be polite to the rate limiter
    print("\nDone. Next: load a CSV with pandas, e.g.")
    print("  import pandas as pd")
    print("  df = pd.read_csv('nsrdb/petaling_jaya_2019.csv', skiprows=2)")
    print("  print(df.columns.tolist()); print(df.head())")


if __name__ == "__main__":
    main()
