# Result — Experiment B4 / RQ3 (per-scheme decision value)

**Run:** 2026-06-25 · `experiments/decision_value_rq3.py` · NSRDB Petaling Jaya 2020, daily simulation.
**Raw:** `experiments/decision_value_results.json`. **Confound control:** import tariff held constant
(RM 0.2703/kWh) across all schemes; **only the export rule varies** — the paper's actual variable.

## Setup
5 kW rooftop PV (simple GHI×kW model); synthetic diurnal base load; three deferrable appliances
(dishwasher, washer, EV) with flexibility windows. Two policies: **naive** (run at a fixed 8 pm,
solar-unaware) vs **forecast-driven** (run in the highest-PV window). Export treatment per scheme:
ATAP = RM 0.10/kWh, NEM = RM 0.2703/kWh (≈ retail credit), SELCO = RM 0 (export prohibited).

## Results — RM saved per day by forecast-driven scheduling (avg over 2020)
> **Corrected after cross-model audit (2026-06-25):** the earlier "persistence" forecast used same-day
> future PV (`np.roll`, leakage). Replaced with **issuance-time** forecasts that use no same-day future
> information — clear-sky (ex-ante) and day-ahead (yesterday's profile). Cost is always evaluated against
> *actual* PV; only the schedule uses the forecast.

| Scheme | Export rule | Naive cost (RM/day) | Perfect (upper bound) | Clear-sky fc | Day-ahead fc | ≈ RM/month (day-ahead) |
|---|---|---|---|---|---|---|
| **SELCO** | none (RM 0) | 4.54 | 1.90 | 1.67 | **1.70** | **≈ 51** |
| **ATAP** | RM 0.10 | 2.52 | 1.20 | 1.06 | **1.07** | ≈ 32 |
| **NEM** | RM 0.27 (≈retail) | −0.92 (net earner) | 0.00 | 0.00 | **0.00** | ≈ 0 |

## The SELCO hypothesis is confirmed
Per-household value of forecast-driven scheduling is **greatest under export-prohibited SELCO-PV**
(RM ~51/month, day-ahead forecast), intermediate under ATAP (RM ~32/month), and **essentially zero under NEM**. The mechanism
is exactly as the paper argues: when export is credited near retail (NEM), it does not matter *when* you
consume — misalignment is fully compensated — so scheduling adds no value. When export is prohibited
(SELCO), every kWh not self-consumed during generation is *lost*, so timing is everything. This directly
answers reviewer sink-risk #3 ("decision layer is bolted on"): with tariff held constant, the three
schemes produce **materially different** value, and the ordering SELCO > ATAP > NEM≈0 is the paper's
distinctive multi-scheme contribution, now quantified.

## An honest, important nuance (corrected)
A simple **issuance-time forecast captures ~88–89% of perfect-foresight value** (SELCO: day-ahead 1.70 /
perfect 1.90 = 89%; clear-sky 1.67 = 88%). At the level of *daily appliance placement*, the midday PV peak
is largely predictable, so most of the value comes from scheme structure plus basic solar-awareness — but a
real ~11–12% gap to perfect foresight remains, and that gap is exactly where storm-aware forecasting
(RQ1/diffusion) can add value (cloud-disrupted days, intra-hour timing). Stated plainly: RQ1 (skill) and
RQ3 (scheme value) are largely *separable* value sources; the bulk of routine-scheduling value is
forecast-accuracy-insensitive, with a modest residual that better forecasting can capture. (The earlier
draft's "~98% / persistence captures all value" was an artifact of same-day-future leakage, now removed.)

## Caveats
- Simplified PV (GHI×5 kW), synthetic base load, fixed appliance set.
- Import tariff held constant across schemes to isolate the export-rule effect; real Sarawak/Sabah retail
  tariffs differ (a separate, secondary effect).
- Forecasts are issuance-time (clear-sky ex-ante and day-ahead = yesterday's profile); the ~88% capture of
  perfect-foresight value is partly because daily PV shape is easy — not evidence that forecasting is
  unnecessary at storm onset (intra-hour timing is where forecast skill matters).

## Net
✅ RQ3 now has real numbers; the SELCO > ATAP > NEM≈0 ordering confirms the multi-scheme thesis with a
confound-controlled design. ✅ Honest finding: routine daily scheduling value is forecast-accuracy-
insensitive — forecast quality earns its value at storm onset, not daily placement.
