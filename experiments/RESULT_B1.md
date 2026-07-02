# Result — Experiment B1 (baseline nowcasting, NSRDB Petaling Jaya, CPU)

**Run:** 2026-06-25 · `experiments/baseline_nowcast.py` · train 2016–2019, test 2020 · daytime only.
**Raw numbers:** `experiments/pilot_results.json`. **No GPU / no Himawari frames** — this is the
LightGBM/persistence *bar*, not yet the optical-flow-vs-diffusion comparison.

## Headline MAE (W/m²), test year 2020
| Horizon | Persistence | Smart-persistence (k-persist) | LightGBM | LGBM skill vs persist |
|---|---|---|---|---|
| 30 min | 111.8 | **81.9** | 83.2 | 0.26 |
| 120 min | 267.7 | 134.0 | **120.9** | 0.55 |

## Storm-onset slice (future clear-sky-index collapse > 0.30)
| Horizon | n | Persistence | Smart-persist | LightGBM | LGBM vs smart-persist |
|---|---|---|---|---|---|
| 30 min | 1,643 | 328.2 | 302.9 | **247.5** | **−18.3%** |
| 120 min | 3,288 | 433.9 | 308.4 | **204.8** | **−33.6%** |

## By regime (MAE, 120 min)
| Regime | n | Persist | Smart-persist | LightGBM |
|---|---|---|---|---|
| STABLE | 12,371 | 263.8 | 123.2 | 117.1 |
| PARTIAL | 5,696 | 277.0 | 145.6 | **126.7** |
| CONVECTIVE | 1,612 | 264.6 | 175.7 | **130.2** |

## What this establishes (claims supported)
1. **Onset is the dominant failure regime — strong empirical signal.** Onset-slice MAE (247–434) is
   **up to ~3× the overall MAE** (2.97× at 30 min, 1.69× at 120 min for LightGBM). This *quantifies* the premise behind StormGate and matches the
   literature's "RMSE +50% under ramps" (here it's worse). ✅ Core premise holds on real Malaysian data.
2. **LightGBM's advantage concentrates exactly where StormGate says to spend firepower** —
   largest gains on the **onset slice** (−18% / −34% vs the strong baseline) and in the **CONVECTIVE**
   regime, while in STABLE/short-horizon it barely beats (or slightly loses to) smart-persistence. ✅
   This *is* the regime-selective story.
3. **The strong baseline matters (Codex idea #4 vindicated).** At 30-min overall, LightGBM (83.2)
   is *slightly worse* than smart-persistence (81.9) — so "ML beats persistence" is false on average at
   short range. Any diffusion claim must clear smart-persistence, not raw persistence. ✅ Honesty guard.

## What this does NOT yet show (honest scope)
- This uses **NSRDB-derived GHI features** (clear-sky, cloud type, lags), **not** raw Himawari
  optical-flow image forecasting. It sets the LightGBM/persistence bar and proves the onset-failure
  regime — it does **not** test optical flow vs diffusion (needs Himawari frames + GPU).
- The onset threshold (k-collapse > 0.30) is **not yet pre-registered**; sensitivity sweep still owed
  (reviewer sink-risk #1).
- Point forecasts only; conformal coverage (RQ2) not yet measured.

## Next runs (unchanged priority)
1. Pre-register onset definition + threshold sensitivity.
2. Add Himawari frames + optical-flow baseline + frozen-diffusion residual on the onset slice (GPU).
3. Conformal intervals (regime-conditioned) on these forecasts.
