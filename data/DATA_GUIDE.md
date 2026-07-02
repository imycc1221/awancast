# Awan-Cast — Data Acquisition Guide

> Everything you need to get the project's datasets. Two are essential to start; one is for the live demo later.
> All download steps take a real browser (anti-bot walls + personal API keys mean they can't be scripted blind).

---

## Dataset #1 — NSRDB Himawari 2016–2020 (ESSENTIAL — the ML backbone)

**What it is:** Satellite-derived solar irradiance (GHI, DNI, DHI, clear-sky GHI, cloud type, temperature) covering all of Malaysia, 10-minute resolution, 5 full years. This trains Layers 1b + 2 and provides validation ground truth.

**Cost:** Free. **Needs:** a free NREL API key (registered in your name).

### Step-by-step
1. Go to **https://developer.nrel.gov/signup/**
2. Fill the short form (name, email, intended use — "academic research / student competition" is fine). You get the API key **instantly by email**.
3. Open `fetch_nsrdb.py` in this folder. Paste your API key, name, email, and affiliation into the variables at the top.
4. Run it:
   ```
   pip install requests pandas
   python fetch_nsrdb.py
   ```
5. It downloads 2016–2020 for Petaling Jaya (and any other coordinates you add) into `data/nsrdb/`.

**Note:** The direct-CSV endpoint allows one location + one year per request, so the script loops. For many locations, NREL also has an async bulk endpoint — not needed for the prototype.

---

## Dataset #2 — Hong Kong Rooftop PV Dataset (ESSENTIAL — for the Layer 3 scheduler)

**What it is:** Real rooftop PV generation from 60 grid-connected stations in Hong Kong, 2021–2023. PV power at 5-minute inverter-level + on-site weather at 1-minute. ~296 MB. This is real rooftop behaviour to build and tune the appliance scheduler. (Hong Kong, not Malaysia — a defensible humid/convective tropical-ish proxy; state this caveat in your documentation.)

**Cost:** Free, open licence. **Needs:** a browser (the API is behind an anti-bot wall).

### Step-by-step
1. Go to **https://datadryad.org/dataset/doi:10.5061/dryad.m37pvmd99**
2. Click the **Download** button → choose **Download dataset** (or download `Dataset.zip` individually, ~296 MB).
3. Save the zip into this `data/` folder.
4. Unzip it here. You should get a `Dataset/` folder + `README.md`.
5. Run the explorer to see its structure:
   ```
   pip install pandas
   python load_hongkong_pv.py
   ```

---

## Dataset #3 — Himawari-9 raw frames (for the live demo — get this LATER, when building Layer 1a)

**What it is:** Live + recent raw satellite cloud imagery, 10-min, 2 km — used for the optical-flow cloud tracking and the storm-replay demo.

**Two ways to get it:**

- **AWS Open Data Registry (no registration):** public S3 bucket `noaa-himawari9`. You only pull the time slices and the Malaysia region you need — never the whole disk. Browse: https://registry.opendata.aws/noaa-himawari/
- **JAXA P-Tree (free, registration):** https://www.eorc.jaxa.jp/ptree/registration_top.html — gives gridded/processed products.

**Important:** Do this only when you start building Layer 1a (after the Stage 1 video). Don't download it now — it's large and you don't need it yet. **Never redistribute raw Himawari frames** (JAXA terms) — your open-source release ships only derived products.

---

## Supporting data (small, grab as needed — no scripts required)

| Source | URL | Use |
|--------|-----|-----|
| PVGIS (clear-sky + TMY) | https://re.jrc.ec.europa.eu/pvg_tools/en/ | Layer 1a clear-sky baseline |
| MET Malaysia open data | https://data.gov.my/ | Layer 2 weather features |
| SEDA National PV Monitoring System | https://pvms.seda.gov.my/pvportal/national-irradiance-map/ | Context + cross-check; cite the organiser's own data |
| Solar ATAP tariff rates | SEDA / TNB published rate card | Layer 3 scheduler economics (RM 0.27 / RM 0.37 per kWh) |

---

## Methodology reference (not a dataset — cite it)

**Thailand solar nowcasting study** — arXiv 2409.16320, platform at cusolarforecast.com. Himawari-8 cloud index + Ineichen clear-sky + LightGBM, 53 ground stations, 1.5 years, 15-min resolution. LightGBM best: **MAE 78.58 W/m², RMSE 118.97 W/m².** Cite this in your Stage 2 documentation as the precedent Awan-Cast extends. Licence CC-BY-NC-ND — cite and learn from, do not reuse their data.

---

## Priority & timing

| When | Do |
|------|-----|
| **Now / this week** | Nothing blocking — focus on the Stage 1 video. Optionally register the NREL API key (takes 2 minutes) so it's ready. |
| **After 17 May (build phase starts)** | Download #1 (NSRDB) and #2 (Hong Kong) — these unlock the whole ML pipeline. |
| **When building Layer 1a (~June)** | Pull #3 (Himawari-9 raw) — only the slices you need. |

The datasets are **build-phase** work. They do **not** block the Stage 1 video, which is concept-only.
