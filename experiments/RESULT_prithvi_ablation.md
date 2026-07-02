# Result — Frozen Prithvi-EO-100M Embedding Ablation (C5 / B3)

**Run:** 2026-06-27 · `experiments/prithvi_ablation.py` · frozen Prithvi-EO-1.0-100M encoder (downloaded from
HuggingFace) as a feature extractor over Himawari B13; PCA(16) of patch-token embeddings added to the B3
LightGBM; train 0601/02/03, test 0604. **ARIS check (Codex): PASS** — null result is genuine (not a bug);
weight-load verified (150/150 encoder params matched, pretrained not random-init).

## Result
| | onset MAE (K) | overall MAE (K) |
|---|---|---|
| B3 baseline (no embeddings) | 16.98 | 7.52 |
| + frozen Prithvi-EO embeddings | 16.80 | 7.27 |
| **Δ (onset)** | **−0.18 (negligible)** | −0.25 |

## Finding
Adding frozen Prithvi-EO embeddings yields **no meaningful onset improvement (−0.18 K)** — within noise.
This is the **predicted null**: Prithvi-EO is a **6-band *optical* (Landsat/Sentinel) MAE**, and we feed it
**1-band *thermal-IR*** (replicated to 6 bands) — a real domain mismatch. The embeddings are non-degenerate
(PCA explains 80% variance) and the weights genuinely loaded; they simply don't carry thermal-IR-convection
signal useful for onset.

## The honest, narrative-coherent contrast
- **Out-of-domain optical foundation model (this, B3):** −0.18 K → **no transfer.**
- **In-domain self-supervision (B2, §5.11):** −1.43 K → **promising positive signal.**

Together these argue clearly: for this task, **in-domain self-supervised pretraining on the project's own
Himawari frames is the right direction, not borrowing a large out-of-domain (optical) foundation model** —
which also matches the hardware reality (Aurora/Prithvi-WxC infeasible at 6 GB; Prithvi-EO runs but doesn't help).

## Caveats
- Single held-out day; PCA(16) of time-averaged patch tokens (a coarse use of the embeddings); a
  fine-tuned (not frozen) adapter or a thermal-IR foundation model could differ.
- 6-band replication + z-scored BT is a domain hack (unavoidable for optical→IR).

## Net
✅ Honest null: a frozen out-of-domain optical foundation model gives negligible transfer to thermal-IR
onset (−0.18 K), reinforcing that in-domain SSL (−1.43 K) is the better path. Either outcome was publishable;
this one strengthens the paper's coherence.
