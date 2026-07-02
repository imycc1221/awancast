# Result — Experiment B3 (STAND-IN: learned residual corrector, real Himawari-9)

> ⚠️ **This is NOT the generative-diffusion model.** It is an honest, feasible stand-in — a
> gradient-boosted per-pixel residual corrector on top of optical flow — that tests the same
> hypothesis the diffusion layer targets. The diffusion model proper (DDMS/LDCast adaptation) remains
> future work. Treat these numbers as a *lower bound* on what a learned correction can do, and as the
> **bar the diffusion model must clear** to justify its complexity.

**Run:** 2026-06-25 · `experiments/learned_residual_b3.py` · real Himawari-9 B13, Malaysia crop.
Train days 2026-06-01/02/03 (81,000 pixel samples), **held-out test day 2026-06-04** (27,000). Horizon
30 min. Metric: MAE of cloud-top brightness temperature (K). Features per pixel: optical-flow prediction,
persistence, tendency, local mean/std, normalized row/col.

## Results
| Subset | Persistence | Optical flow | Learned residual | Learned vs optical flow |
|---|---|---|---|---|
| Overall | 7.64 | 8.90 | **7.55** | **−15.2%** |
| Onset subset (evolving >15 K, n=4,637) | 24.30 | 20.13 | **16.94** | **−15.8%** |

## Interpretation
1. **The learned correction beats both baselines — most on onset.** On the held-out day it improves over
   optical flow by 15% overall and 16% on the onset subset, and over persistence by ~30% on onset
   (24.3 → 16.94 K). The biggest gain is exactly on the evolving/onset pixels — a third result (after
   B1, B2) consistent with the regime-selective pattern (single held-out day; preliminary), now for the *full* optical-flow +
   learned-correction stack on a held-out day.
2. **Optical flow alone is still worse than persistence overall** (8.90 vs 7.64) — consistent with B2 —
   which is *why* the learned correction matters: it recovers the advection signal where it helps and
   suppresses its noise where it doesn't.
3. **This sets the concrete bar for the diffusion model.** A simple per-pixel corrector already reaches
   16.94 K on the onset subset. For the generative-diffusion layer to be worth its complexity, it must
   beat *this*, not just persistence/optical-flow. That is a more honest target than "diffusion beats
   persistence."

## What the stand-in CANNOT do (why diffusion is still the open question)
- A per-pixel gradient-boosted corrector **cannot generate new convective cells** or enforce spatial
  coherence; it only reweights local features. Diffusion's hypothesized advantage — *generating* cloud
  formation/dissipation and producing calibrated ensembles — is precisely what this stand-in lacks and
  therefore does **not** test. The real research question (does generative modeling beat a strong
  per-pixel corrector on onset?) remains open.

## Honest caveats
- One held-out day; cloud-field brightness temperature, not irradiance/PV.
- Onset subset defined with future data (evaluation device; operational detector still to be built).
- Train/test are adjacent days in one season — no cross-season generalization tested.

## Net
✅ The full optical-flow + learned-correction stack works on a held-out day and concentrates its gain on
onset — strengthening the regime-selective thesis a third time, on real satellite data.
➡️ The diffusion model now has a concrete, honest bar to beat (16.94 K onset MAE), not a strawman.
