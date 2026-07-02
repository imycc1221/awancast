# Result — Deep U-Net Ensemble (Phase 3): seeds + uncertainty

**Run:** 2026-06-25 · `experiments/deep_ensemble.py` · 3 seeds, train 13 panel days, held-out 06-04.
**ARIS phase-3 check (Codex): PASS** (no leakage) with two honest wording fixes applied below.

## Results (onset-subset MAE, K)
| | value |
|---|---|
| Single seeds | 12.39 / 10.51 / 10.94 |
| **Ensemble (mean of 3)** | **10.75** |
| Ensemble overall MAE | 4.93 |
| Spread ↔ error correlation | 0.156 (weak) |
| Mean abs error by spread quartile | [5.23, 4.12, 3.64, **6.74**] |

## Findings (honest)
1. **Addresses the single-seed critique.** A single seed varies (10.5–12.4 K). The ensemble (10.75) **beats
   the seed average (11.28) and the worst seed, and lands near the best** — so it *reduces dependence on any
   one seed*, though it does not beat the single best seed. Honest phrasing: it stabilizes, not "always improves."
2. **Ensemble spread is only a coarse uncertainty proxy.** Correlation with error is weak (0.156) and the
   error-by-spread quartiles are **non-monotonic** [5.23, 4.12, 3.64, 6.74] — only the *highest*-spread
   quartile is clearly worse (6.74). So spread weakly flags the highest-error regime but is **poorly
   calibrated**.
3. **This motivates a genuinely probabilistic model.** A deterministic-CNN seed ensemble does not give a
   calibrated predictive distribution — which is exactly what generative diffusion (or a proper
   probabilistic model) would provide. This is an *uncertainty-calibration* motivation for diffusion, **not**
   a claim that diffusion will lower MAE.

## Caveat (for the paper, per cross-model check)
"Although ensemble spread is positively associated with error, the relationship is weak and non-monotonic,
indicating that deterministic seed ensembles provide only a coarse uncertainty proxy and motivating
explicitly probabilistic models for calibrated predictive distributions."

## Net
✅ Single-seed concern addressed (ensemble stabilizes; seeds reported). 🟡 Spread = weak uncertainty signal —
honestly reported, and it gives a concrete, evidence-based motivation for the probabilistic/diffusion extension.
