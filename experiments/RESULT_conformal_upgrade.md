# Result — Conformal Upgrade (RQ2 rigor, Codex review #5)

**Run:** 2026-06-25 · `experiments/conformal_upgrade.py` · NSRDB Petaling Jaya, 120-min, 90% target.
Train 2016–2018, calibration 2019, test 2020. **Raw:** `conformal_upgrade_results.json`.

Upgrades over the first pass: (1) **finite-sample** split-conformal quantile (rank = ⌈(n+1)(1−α)⌉),
(2) **Mondrian** regime-conditioned calibration, (3) **normalized-residual** variant (calibrate
|resid|/clear-sky → width adapts to expected magnitude), (4) **rolling monthly** coverage on 2020.

## Coverage (target 0.90) and mean interval width
| Method | Marginal | STABLE | PARTIAL | CONVECTIVE | Width (W/m²) |
|---|---|---|---|---|---|
| Global | 0.899 | 0.911 | 0.883 | **0.863** (under) | 525.6 |
| Regime (Mondrian) | 0.898 | 0.897 | 0.905 | 0.877 (under) | 523.2 |
| **Normalized + regime** | 0.908 | 0.904 | 0.910 | **0.935** | 570.7 |

## Findings
- **Global conformal under-covers the convective regime (0.863)** — the storms that matter most — and wastes
  width over-covering STABLE. Plain Mondrian helps but still under-covers convective (0.877).
- **Normalized-residual Mondrian fixes it:** convective coverage 0.863 → **0.935**, all regimes ≥ 0.90, at
  the cost of ~9% wider intervals (570 vs 525). Scaling the residual by clear-sky magnitude gives the
  larger, honest intervals convective conditions require.
- **Rolling monthly coverage is stable** across all 12 months of 2020 (normalized-regime range 0.888–0.934),
  which empirically supports conformal validity despite the formal time-series exchangeability concern —
  no month is catastrophically miscovered.

## Net
✅ RQ2 upgraded: finite-sample quantiles + normalized-residual Mondrian conformal deliver per-regime
calibration (incl. the hard convective regime) with month-to-month stability. The "global looks fine but
regimes fail" story now has a concrete, rigorous fix.
