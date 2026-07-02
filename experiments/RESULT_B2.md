# Result — Experiment B2 (optical-flow cloud-field nowcast, REAL Himawari-9)

**Run:** 2026-06-25 · `experiments/opticalflow_nowcast.py` · real Himawari-9 B13 (10.4 µm) frames,
Malaysia crop (325×825 @ 2 km), 2026-06-01 05:00–07:00 UTC (afternoon convection), 14 frames.
**Raw:** `experiments/opticalflow_results.json`. Metric: MAE of cloud-top brightness temperature (K).

## Results
| Horizon | Subset | Optical flow MAE (K) | Persistence MAE (K) | Skill vs persistence |
|---|---|---|---|---|
| 30 min | overall | 10.21 | 8.51 | **−0.200** (worse) |
| 30 min | high-change (cloud evolving >15 K) | 22.49 | 25.54 | **+0.120** (better) |
| 60 min | overall | 13.28 | 11.55 | **−0.150** (worse) |
| 60 min | high-change | 24.51 | 28.23 | **+0.132** (better) |

## Interpretation — this independently reproduces the StormGate thesis on a 2nd modality
1. **Overall, optical flow LOSES to persistence** (−15 to −20% skill). Over 30–60 min the cloud field is
   mostly slow-moving/stable, so advection just injects warping noise. This is the empirical version of
   Smith et al. (2024): advection is not a free win, and on average a naïve baseline is hard to beat.
2. **On the high-change (evolving/onset) subset, optical flow WINS** (+12–13% skill). Exactly where clouds
   are forming/moving/dissipating — the operationally important pixels — advection adds real value.
3. **This is the regime-selective story, consistent across two modalities (preliminary).** B1 (NSRDB tabular features) and B2 (real
   satellite cloud fields) — two independent modalities — both show the same pattern: **the more complex
   method loses on the easy majority and wins on the hard, evolving minority.** That convergence is the
   strongest evidence yet that a *gate* (apply firepower only on onset/evolution) is the right design, not
   "always use the complex model."

## Honest caveats
- **Tiny sample:** one 2-hour window, one day, 14 frames. Indicative, not conclusive — needs many storm days.
- **Brightness-temperature proxy:** evaluates the *cloud-field* nowcast (K), not the final irradiance/PV
  forecast. Mapping BT → irradiance (clear-sky × transmittance) is the next bridge.
- **"High-change" uses future actual** to define the subset (an evaluation device, like the B1 onset
  slice) — the operational onset *detector* must flag it without future info, still to be built.
- Farnebäck parameters untuned; persistence is a strong short-horizon baseline.

## What B2 establishes
✅ The true optical-flow arm now exists on real Himawari data (not just described in the paper).
✅ The premise "advection fails on average, helps on evolution" is supported on satellite imagery (one window; preliminary).
➡️ Directly motivates B3: replace/augment optical flow with frozen-diffusion residual **on the
   high-change/onset subset**, where there is measured headroom (persistence MAE 25–28 K there).
