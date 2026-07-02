# Improvement Backlog v2 — merged from two parallel agents (2026-06-25)

Sources: **Agent A** (tech scout, web) + **Agent B** (experiment/methodology reviewer). De-duplicated,
feasibility-tagged for a 6 GB GPU + ~14-day Himawari panel + NSRDB. Run one at a time, each ARIS-checked.

## Key reframes (both agents agree)
- **The binding constraint is the ~14-day dataset, NOT the 6 GB GPU.** Generative models (diffusion/flow)
  are *data*-bound here, not compute-bound.
- **The open wound is uncertainty *calibration* of the strong deep model**, not "diffusion beats the bar"
  (the deep U-Net already cleared it). → cheapest high-value win is a probabilistic head, not diffusion.
- **Aurora / Prithvi-WxC are infeasible on 6 GB** (A100-80GB-class) → downgrade the paper's "exploratory
  ablation" language to "infeasible on present hardware." The right-sized frozen-FM candidate is
  **Prithvi-EO-100M** (Landsat/Sentinel MAE) — runs in 6 GB, but domain-mismatched (optical vs thermal-IR).

## A. Rigor fixes (reviewer-driven)
| ID | Fix | Effort | GPU? | Status |
|---|---|---|---|---|
| A1 | **Fair deep-vs-tabular** (identical pixels+mask) + **paired** day-bootstrap (P1+P4) | medium | yes | ▶ running |
| A2 | Port gate / deep-gate / ensemble / detector to the 6-day seasonal panel + CIs (P2) | medium | yes | queued |
| A3 | Deep model: 3-seed mean±CI on panel + early stopping/val split (P3) | medium | yes | queued |
| A4 | THR∈{10,15,20}K × H∈{3,6} sensitivity sweep on panel (P8) | quick | no | queued |
| A5 | decision_value: stronger naive baseline (midday) + day-bootstrap CIs (P5) | quick | no | queued |
| A6 | bt_irradiance: day-bootstrap CIs; surface "optical-flow ≈ persistence BT" (P6) | quick | no | queued |
| A7 | conformal: per-regime **width** column + worst-month coverage (P7) | quick | no | queued |
| A8 | detector: 3-seed AUC + predict_proba calibration check (P9) | quick | no | queued |
| A9 | add clear-sky-climatology + AR(1)-on-k overall baseline rows (P10) | quick | no | queued |

## B. New tech (tech-scout-driven)
| ID | Idea | Effort | Feasible @6GB? | Expected value |
|---|---|---|---|---|
| B1 | **Probabilistic head** on deep U-Net (quantile / Gaussian-NLL) → predictive σ → feed conformal | LITE | yes | **highest** — closes the §5.11 calibration gap with the strong model |
| B2 | In-domain **self-supervised pretrain** on extra unlabeled Himawari history → init U-Net | moderate | yes (needs more free AWS frames) | novel, defensible |
| B3 | Frozen **Prithvi-EO-100M** embeddings as features (ablation) | LITE | yes | low–moderate; either outcome publishable |
| B4 | Rectified-flow / flow-matching generative nowcast (go/no-go) | moderate | sampling yes, training data-bound | high-risk; future work |
| B5 | Physics-informed advection-consistency loss term | LITE | yes | robustness footnote |
| — | Aurora / Prithvi-WxC fine-tune or frozen | — | **NO** (needs A100-80GB) | reframe as infeasible in paper |

## Execution phases (small, discrete, each ARIS-checked)
- **C1 [running]:** A1 — fair comparison + paired test (keystone; confirms §5.11 survives the fairness fix).
- **C2:** B1 — probabilistic head on the deep U-Net (highest new value; closes calibration gap).
- **C3 (CPU batch, can overlap GPU):** A4 + A5 + A6 + A7 + A9 — sensitivity sweeps, CIs, baselines, widths.
- **C4:** A2 + A3 — panel CIs + 3-seed/early-stop for gate & deep (de-risks the headline CI).
- **C5 (stretch):** B2 / B3 — self-supervised pretrain / frozen-EO ablation.
- **Paper honesty fix (now):** downgrade Aurora/Prithvi-WxC language to "infeasible on present hardware."
