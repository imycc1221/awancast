# Result — Multi-Day Panel Evaluation with Block-Bootstrap CIs (Codex #1, "single best addition")

**Run:** 2026-06-25 · `experiments/panel_eval.py` · 14-day seasonally-spread Himawari panel (Jan–Jun 2026).
**Seasonal split:** train Jan–Apr (8 days), **test May–Jun (6 held-out days)**. 30-min horizon. CIs from
**day-level block bootstrap** (resample test days, B=2000). **Raw:** `panel_eval_results.json`.

## Headline metrics (pooled over test-day pixels) with 95% CIs
| Metric | Value | 95% CI |
|---|---|---|
| Optical-flow skill on high-change subset (vs persistence) | **+0.083** | [0.031, 0.139] |
| Learned-residual onset MAE gain (vs persistence) | **30.2%** | [27.3, 32.4] |
| Operational onset detector ROC-AUC | **0.807** | [0.793, 0.821] |
| End-to-end gate benefit captured (op-gate thr 0.5) | **53.7%** | [47.3, 59.9] |
| Gate expensive-model fraction | 0.497 | [0.46, 0.53] |

## Why this matters
Every satellite result that was previously a single-window / single-day case study now has a **confidence
interval from a seasonal held-out split**, and all four survive:
1. **Optical flow genuinely helps on evolving cloud** — skill +0.083, CI **excludes zero**, across seasons
   (smaller than the single-window 0.12, as expected once seasonal diversity is included — more honest).
2. **Learned-residual onset gain ~30%** with a tight CI [27, 32] — consistent with the single held-out day.
3. **Detector AUC 0.81** [0.79, 0.82] — robust across seasons, essentially unchanged from the single-day 0.815.
4. **The operational gate captures ~54%** of the oracle benefit [47, 60] — confirming the end-to-end result
   generalizes beyond one day.

This converts the satellite evidence from "preliminary" to a **panel-with-CIs** result on a held-out
season — the upgrade the cross-model review named as most increasing the work's credibility.

## Honest scope
- 14 days is a panel, not a climatology; CIs are over 6 test days (block bootstrap), so they capture
  day-to-day variability but a wider multi-year panel would tighten them further.
- Cloud-field brightness temperature, not irradiance/PV; high-change/onset still BT-based.
- The "expensive model" is still the learned residual stand-in, not diffusion — the 16.94 K bar (§5.6) and
  the §5.9 harness remain the path to the genuine diffusion comparison.

## Net
✅ All four satellite findings hold on a seasonally-spread, held-out 14-day panel with 95% CIs that exclude
the null in every case. The regime-selective design is now supported by panel-level evidence, not anecdote.
