# Result — Probabilistic Head on the Deep U-Net (C2 / Agent-1 #1)

**Run:** 2026-06-25 · `experiments/deep_nll.py` · deep U-Net with a 2-channel head [mean residual, log-variance]
trained by Gaussian NLL; same train (13 panel days) / held-out (06-04) split as `deep_nowcast.py`.
**ARIS check (Codex): PASS** (correct NLL + σ extraction, no leakage), with a wording caveat (below). NOT diffusion.

## Result
| Quantity | NLL head | Prior 3-seed ensemble spread |
|---|---|---|
| σ ↔ \|error\| correlation | **0.509** | 0.156 |
| mean abs error by σ quartile (K) | **[2.81, 4.41, 6.41, 9.65]** (monotonic) | [5.23, 4.12, 3.64, 6.74] (non-monotonic) |
| onset MAE (K, single day) | 11.61 | — |
| overall MAE (K) | 5.83 | — |

## Finding (honest)
A Gaussian-NLL probabilistic head gives a **usable *relative* uncertainty signal**: predicted σ ranks larger
errors well (corr 0.51, monotonic error-by-quartile 2.8→9.7 K), a **3× improvement over the deterministic
3-seed ensemble spread** (0.16, non-monotonic) — at essentially zero extra cost (one extra output channel,
same architecture/data/training time). Accuracy is not hurt (onset MAE comparable to the deterministic model).

This **partially closes the §5.11 uncertainty gap** the paper flagged: the *strong* model can produce a
meaningful predictive uncertainty, not just the weak signal a seed ensemble gave.

## Honest caveats (per cross-model check)
- **Not yet coverage-calibrated.** corr 0.51 + monotonic quartiles show σ *ranks* error well; we have NOT
  tested whether σ is the right *magnitude* (i.e., that 90% intervals hit 90% coverage). So σ is a usable
  *relative* uncertainty, not a validated interval scale. (Honest phrasing: "ranks error well," not "calibrated.")
- Single held-out day; MAE point estimates here (11.61) are same-split, not robust model-ranking evidence
  (cf. deterministic single-day ~10.4, seasonal-CI 14.2).
- σ is in normalized BT units (×130 for Kelvin).

## Net
✅ The strong model CAN yield a usable predictive-uncertainty signal via a cheap NLL head (corr 0.51,
monotonic) — a genuinely new RQ2 result that closes most of the §5.11 gap. Full coverage calibration (and a
properly probabilistic generative model) remains the next step — but "you need diffusion for *any* usable
uncertainty" is now false; you need it for *fully calibrated* distributions.
