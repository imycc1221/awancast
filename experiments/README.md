# Awan-Cast / StormGate — Experiments (reproducibility manifest)

All experiments are CPU-runnable except where a GPU is noted. Python 3.13; deps:
`pandas numpy scikit-learn lightgbm opencv-python satpy pyresample boto3 matplotlib`.
Random seed = 0 throughout. Cross-model audit: see `EXPERIMENT_AUDIT.md`; improvement plan:
`IMPROVEMENT_ROADMAP.md`.

## Data
| Dataset | Path | Range | Source |
|---|---|---|---|
| NSRDB GHI, Petaling Jaya | `data/nsrdb/petaling_jaya_2016..2020.csv` | 2016–2020, 10-min | NREL NSRDB (`data/fetch_nsrdb.py`) |
| Himawari-9 B13 frames | `data/himawari/YYYYMMDD/` | 2026-06-01..04 windows | AWS Open Data `noaa-himawari9` (`data/fetch_himawari.py`, anon S3) |
| Hong Kong rooftop PV | `data/Dataset/` | 2021–2023 | Dryad doi:10.5061/dryad.m37pvmd99 |
| ComStock C&I load (RetailStandalone, FL) | `data/comstock/retail_fl_load.csv` | 2018, 15-min | NREL ComStock `comstock_amy2018_release_2` (OEDI S3, anon; `data/fetch_comstock.py`) |

Parse Himawari HSD → Malaysia cloud-top temp: `data/parse_himawari_sample.py` (satpy `ahi_hsd`).

## Experiments (command → output → headline)
| ID | Command | Output | Headline result |
|---|---|---|---|
| B1 | `python experiments/baseline_nowcast.py` | `pilot_results.json`, `RESULT_B1.md` | onset MAE ≈ up to 3× overall; LGBM −18%@30m / −31–33%@120m vs smart-persist on onset |
| B1b | `python experiments/conformal_onset.py` | `conformal_onset_results.json`, `RESULT_B1b.md` | onset gain threshold-stable; global conformal under-covers convective (0.82), regime-cond. fixes |
| B1-sig | `python experiments/significance_b1.py` | `significance_b1_results.json` | 120-min onset gain 33.5% [95% CI 31.8–35.4], wins 96.6% of 261 days, p≈0 |
| B2 | `python experiments/opticalflow_nowcast.py` | `opticalflow_results.json`, `RESULT_B2.md` | optical flow loses overall, +12–13% on high-change subset (1 window) |
| B3 | `python experiments/learned_residual_b3.py` | `learned_residual_results.json`, `RESULT_B3.md` | learned residual −16% on onset (held-out day); sets 16.94 K bar for diffusion |
| B4/RQ3 | `python experiments/decision_value_rq3.py` | `decision_value_results.json`, `RESULT_B4_RQ3.md` | SELCO 1.70 > ATAP 1.07 > NEM 0.00 RM/day (day-ahead fc); ~88% of perfect |
| B4-sens | `python experiments/decision_sensitivity_rq3.py` | `decision_sensitivity_results.json` | ordering robust to PV size 3/5/8 kW; value→0 as export→retail |
| B1-abl | `python experiments/ablation_b1.py` | `ablation_b1_results.json` | onset skill = clear-sky anchoring; lags hurt; tabular ceiling ~205 K |
| Detector | `python experiments/onset_detector.py` | `onset_detector_results.json`, `RESULT_onset_detector.md` | operational onset detector AUC 0.815, 2.4× precision lift (held-out day) |
| Gate | `python experiments/end_to_end_gate.py` | `end_to_end_gate_results.json`, `RESULT_end_to_end_gate.md` | gate(6.38)>always-on(7.46)>persist(7.70); op-gate captures ~50% oracle benefit at ~1/3 cost |
| Conformal+ | `python experiments/conformal_upgrade.py` | `conformal_upgrade_results.json`, `RESULT_conformal_upgrade.md` | finite-sample + normalized-residual Mondrian: convective coverage 0.86→0.94; monthly-stable |
| Panel | `data/build_panel.py` (build) → `python experiments/panel_eval.py` | `panel_eval_results.json`, `RESULT_panel_eval.md` | 14-day seasonal panel, held-out-season block-bootstrap CIs; all 4 satellite findings hold (AUC 0.807 [0.79–0.82]) |
| Deep (1 day) | `python experiments/deep_nowcast.py` (GPU) | `deep_nowcast_results.json`, `RESULT_deep_nowcast.md` | deep U-Net (NOT diffusion) onset 10.4 K vs tabular bar 16.8 K (held-out 06-04) |
| Deep (panel CIs) | `python experiments/deep_nowcast_panel.py` (GPU) | `deep_nowcast_panel_results.json` | seasonal holdout: deep 14.5 K [13.8–15.3] vs tabular bar 18.3 K [17.6–18.9], non-overlapping |
| Multi-region | `python experiments/multiregion_panel.py` | `multiregion_results.json`, `RESULT_multiregion.md` | regime signal significant in Sarawak/Sabah, weak in Peninsular (coarse longitude bands) |
| Deep gate | `python experiments/deep_gate.py` (GPU) | `deep_gate_results.json`, `RESULT_deep_gate.md` | deep-in-gate: always-deep 5.20 best; op-gate 5.68 = 91.5% benefit @40% cost; gate = efficiency tool for strong models |
| Deep ensemble | `python experiments/deep_ensemble.py` (GPU) | `deep_ensemble_results.json`, `RESULT_deep_ensemble.md` | 3 seeds → ensemble 10.75 (stabilizes single-seed); spread = weak uncertainty (corr 0.16) → motivates probabilistic/diffusion |
| Figures | `python experiments/make_figures.py` | `paper/figures/fig1-4.png` | onset-by-method, gate cost/benefit, multi-region, deep-gate |
| BT→irradiance | `data/fetch_himawari8_pj.py` (build) → `python experiments/bt_irradiance.py` | `bt_irradiance_results.json`, `RESULT_bt_irradiance.md` | Himawari-8 2020 + NSRDB: corr(BT,k)=0.72; LODO R²=0.28; BT→GHI nowcast −12% vs persistence-GHI |
| Deep fair+paired | `python experiments/deep_panel_fair.py` (GPU) | `deep_panel_fair_results.json` | FAIR (identical pixels): deep 14.2 vs tab 18.4; paired tab−deep 4.19 K [2.91,5.58], deep wins 100% |
| Deep NLL head | `python experiments/deep_nll.py` (GPU) | `deep_nll_results.json`, `RESULT_deep_nll.md` | probabilistic head: σ↔error corr 0.51 (vs ensemble 0.16), monotonic; usable relative uncertainty |
| Sensitivity (A4) | `python experiments/sensitivity_sweep.py` | `sensitivity_sweep_results.json` | high-change skill significant for THR≥15K @ both horizons, grows with THR; only 10K/30min NS |
| Decision CIs (A5) | `python experiments/decision_value_rq3.py` | `decision_value_results.json` | savings vs 8pm naive RM1.70; **vs midday naive ≈0** → magnitude was strawman-anchored |
| Conformal width (A7) | `python experiments/conformal_upgrade.py` | `conformal_upgrade_results.json` | per-regime width: normalized spends width on convective (629) vs stable (555); worst-month 0.888 |
| Deep gate panel (C4) | `python experiments/deep_gate_panel.py` (GPU) | `deep_gate_panel_results.json` | seasonal panel + CIs: always-deep 6.52≈oracle 6.52; op-gate captures 92.1% [87.6,95.8]; 3-seed onset 13.9–15.0 (robust) |
| Self-supervised (C5/B2) | `python experiments/deep_ssl.py` (GPU) | `deep_ssl_results.json`, `RESULT_deep_ssl.md` | masked-recon SSL init: onset 12.39→10.96 (−1.43 K, seed 0) — promising but preliminary (1 seed/day, same-domain) |
| Multi-site (R1-b) | `python data/fetch_nsrdb.py` (build) → `python experiments/multisite_b1.py` | `multisite_b1_results.json`, `RESULT_multisite.md` | onset gain holds at 3 regions: PJ 33.5% / Kuching 25.8% / KK 28.8%, all CIs exclude 0 (ground-truth NSRDB) |
| Prithvi-EO (C5/B3) | `hf download …Prithvi-EO-1.0-100M` → `python experiments/prithvi_ablation.py` (GPU) | `prithvi_ablation_results.json`, `RESULT_prithvi_ablation.md` | frozen optical FM embeddings: onset 16.98→16.80 (−0.18 K) = no transfer (optical→thermal-IR); contrasts with in-domain SSL −1.43 K |
| C&I peak-shaving (RP4) | `python data/fetch_nsrdb.py` (build) → `python experiments/cni_peakshave_rp4.py` | `cni_peakshave_results.json`, `RESULT_cni_peakshave.md` | STYLIZED 2MW mall + solar + battery: system saves ≈RM0.88M/yr on RP4 demand charge vs grid; forecast-specific value ~RM0.2–0.5M/yr (baseline-sensitive, strawman flagged+fixed) — projection not measured |
| C&I peak-shaving HARDENED | `python data/fetch_comstock.py` (build) → `python experiments/cni_peakshave_hardened.py` | `cni_peakshave_hardened_results.json`, `RESULT_cni_peakshave_hardened.md` | REAL load (ComStock RetailStandalone FL) + REAL causal 30-min persistence forecast + exact 30-min RP4 window: system ≈RM638k/yr vs grid; real forecast adds only ≈RM55k/yr over smart-blind (45% of oracle headroom; worse in 2 storm months) → headroom for storm-onset nowcaster |

## Train/test splits (consistent language)
- NSRDB tabular (B1/B1b/B1-sig): **train 2016–2019, test 2020** (B1b: calibration = 2019).
- Himawari (B2/B3): B2 = single window 2026-06-01 05:00–07:00 UTC; B3 = **train 06-01/02/03, held-out test 06-04**.
- B4: daily simulation over 2020; forecasts are issuance-time only (no same-day future).

## Sample-size table
| Experiment | Unit | N |
|---|---|---|
| B1 test (120-min) | samples (year 2020, daytime) | 19,679 |
| B1 onset slice (120-min, thr 0.30) | samples / days | 3,130 / 261 |
| B2 | frames (1 window) | 14 |
| B3 | pixel samples (train/test) | 81,000 / 27,000 |
| B4 | simulated days | ~360 |

## Known limitations (see paper §5 + EXPERIMENT_AUDIT.md)
- NSRDB GHI is a satellite-*modeled* product (feature + ground truth); may not transfer to a real-time pipeline.
- B2/B3 onset/high-change subsets are defined with future data (evaluation device, not an operational detector).
- Conformal uses plain quantiles (finite-sample correction + ACI = planned); B2 MAE is frame-averaged.
- B2/B3 are small (1 window / 1 held-out day) — preliminary, not conclusive.
- The generative-diffusion model itself is NOT yet run (the 16.94 K bar is the target).
