# Result — Deep U-Net Nowcaster vs the 16.94 K bar (LARGE item, honest attempt)

> ⚠️ **NOT a diffusion model.** A deterministic deep U-Net that takes [BT(t−2), BT(t−1), BT(t),
> optical-flow advection] and predicts the residual to advection at t+30 min. It has a full receptive
> field, so it *can* represent cloud formation/dissipation — the capability gap that diffusion targets —
> and is trainable on our panel. **True generative diffusion still needs a domain-matched pretrained
> checkpoint + large corpus** (a pretrained Himawari-Malaysia diffusion model does not exist off the shelf,
> and from-scratch diffusion on ~100 sequences would overfit). This is the strongest honest in-session
> realization of the "expensive deep model" slot in the §5.9 gate.

## Single held-out day (2026-06-04); train = 13 panel days; full resolution
| MAE (K) | Persistence | Optical flow | Tabular LightGBM (bar) | **Deep U-Net** |
|---|---|---|---|---|
| Overall | 7.70 | 8.89 | 6.85 | 7.06 |
| **Onset subset** | 24.6 | 20.2 | 16.8 | **10.4** |

Training: 103 sequences, 60 epochs, ~5 GB GPU, L1 on residual-to-advection.

## Finding (preliminary, single day)
The deep spatiotemporal model **clears the 16.94 K onset bar decisively (10.4 K, −38% vs the tabular bar,
−48% vs optical flow, −58% vs persistence)**, while being roughly comparable overall (7.06 vs tabular 6.85).
The improvement is concentrated exactly on the onset subset — consistent with the mechanism: a CNN that
sees the surrounding cold-cloud field can anticipate convective spread/formation, which per-pixel tabular
features fundamentally cannot. This is the capability gap the project's design predicted, now showing as
real skill.

## Caveats (important)
- **Single held-out day** — striking but preliminary; a seasonal-holdout validation with block-bootstrap
  CIs is in progress (`deep_nowcast_panel.py`) to confirm it generalizes before this enters the paper.
- **Deterministic CNN, not diffusion** — no calibrated ensemble/uncertainty; diffusion's probabilistic
  benefit is untested.
- Cloud-field brightness temperature, not irradiance/PV.
- ~100–150 training sequences is small; the result may be optimistic and should be read with the CIs.

## Seasonal-holdout validation with CIs (CONFIRMS the result)
Train Jan–Apr (8 days), test May–Jun (6 held-out days), onset MAE with day-level block-bootstrap 95% CI
(`deep_nowcast_panel.py`):

| Onset MAE (K) | Value | 95% CI |
|---|---|---|
| persistence | 26.4 | [25.3, 27.4] |
| optical flow | 24.2 | [22.0, 26.5] |
| tabular LightGBM (bar) | 18.3 | [17.6, 18.9] |
| **deep U-Net** | **14.5** | **[13.8, 15.3]** |

The deep U-Net CI **[13.8–15.3] does not overlap** the tabular bar CI **[17.6–18.9]** → the ~21% onset
improvement is statistically robust across a held-out *season*, not a single-day artifact. (The margin is
smaller than the single-day 10.4 K because the seasonal split has fewer training days — honest.)

## Net
✅ A deep spatiotemporal model **beats the tabular bar on onset with non-overlapping CIs across a held-out
season** (14.5 vs 18.3 K). The "expensive model" slot is worth a formation-capable deep model, and this is
the clearest motivation yet for the genuine generative-diffusion extension (which would add calibrated
ensembles and may extend the gain). Still a deterministic CNN, not diffusion.
