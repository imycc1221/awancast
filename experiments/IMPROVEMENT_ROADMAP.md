# Improvement Roadmap — ARIS cross-model research-review (Codex/GPT-5.5)

**Date:** 2026-06-25 · constructive review of the corrected paper + experiments (post integrity-audit).
Ranked by leverage; effort = QUICK (hours, no new data) / MEDIUM (days) / LARGE (diffusion/big compute).

## Single best addition
**A multi-day Himawari benchmark + an operational onset detector + day/block-bootstrap CIs + frozen
baselines.** Converts "well-reasoned prototype with promising cases" → "credible empirical system paper."

## Ranked improvements
| # | Improvement | Why it matters | Effort |
|---|---|---|---|
| 1 | **Multi-day/season Himawari panel** (20–40 days across clear/partial/convective/monsoon), one frozen protocol, per-day metrics + aggregate CIs | biggest seriousness gain — shows generalization, not a case study | MEDIUM (B13+CPU) / LARGE (multi-season+bands) |
| 2 | **Confidence intervals on every headline metric** via day/block bootstrap (resample by day/window, NOT pixels — pixels are spatially correlated) | makes claims statistically defensible | QUICK–MEDIUM |
| 3 | **Operational onset detector** using issuance-time info only (BT tendency, local variance, optical-flow divergence, k-index volatility); report precision/recall | turns post-hoc "works on onset" into an actionable gate | MEDIUM |
| 4 | **Pixel-weighted AND issuance-weighted MAE** side by side; declare primary | reviewers will ask; prevents big masks dominating | QUICK |
| 5 | **Upgrade conformal**: finite-sample split-conformal quantiles, rolling calibration, normalized/regime-conditioned residuals; marginal + per-regime coverage over time | materially strengthens RQ2 | MEDIUM |
| 6 | **Paired significance tests** (block bootstrap / Diebold–Mariano) per horizon/regime for each baseline pair | stops small MAE gaps reading as noise | QUICK–MEDIUM |
| 7 | **Reframe contribution around the gate**, not diffusion ("regime-aware tropical nowcasting + tariff-aware decision support"; diffusion = future enhancement) | evidence supports the gate/decision more than generative modeling | QUICK |
| 8 | **Feature ablation table** (B1/B3): persistence→clear-sky→lags→regime→optical-flow→texture→position | shows where skill comes from; kills "black box got lucky" | QUICK–MEDIUM |
| 9 | **B4 sensitivity**: value under perfect/clear-sky/day-ahead/noisy/persistence × appliance flexibility, export rate, PV size | makes economics robust, not a toy | QUICK |
| 10 | **Reproducibility manifest** (`experiments/README.md`: commands, date ranges, seeds, outputs, row counts) | cheap credibility | QUICK |

## Cheap rigor wins
- Pre-register the primary metric per experiment.
- Add a sample-size table (days, windows, issuances, pixels, onset counts).
- Use identical train/test split language everywhere.
- Feature negative results prominently.
- One figure: **skill by regime with CIs** (communicates the thesis faster than prose).

## Suggested execution order for a 2-person team
1. QUICK batch first: #10 manifest, #7 reframe, #4 dual-weighting, #9 sensitivity, + cheap wins (sample-size table, regime-skill figure).
2. Then #2/#6 (bootstrap CIs + paired tests) — the rigor that makes current numbers defensible.
3. Then #1 + #3 + #5 (multi-day panel, onset detector, conformal upgrade) — the "single best addition."
4. LARGE: the genuine diffusion comparison against the 16.94 K bar (unchanged open item).
