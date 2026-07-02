# Result — Self-Supervised Pretraining → Onset Transfer (C5 / B2)

**Run:** 2026-06-25 · `experiments/deep_ssl.py` · masked-patch reconstruction pretrains the U-Net encoder on
140 unlabeled 4-frame Himawari input stacks (train days), then fine-tunes the residual onset U-Net with the
encoder initialized from SSL vs random; held-out 06-04. **ARIS check (Codex): PASS** (correct, no leakage),
with robustness/scope WARNs. NOT diffusion; self-contained (no external downloads).

## Result (held-out 06-04, seed 0)
| Init | onset MAE (K) | overall MAE (K) |
|---|---|---|
| Random | 12.39 | 7.19 |
| **SSL (masked-recon)** | **10.96** | **5.33** |
| SSL − random | **−1.43** | −1.86 |

## Honest finding (per cross-model check)
Same-frame masked-reconstruction SSL initialization improved onset MAE by **1.43 K** over random init at
seed 0 — a **promising transfer signal**, but:
- **Preliminary:** one fixed seed, one held-out day. Given the known ~1 K single-day seed spread, this is
  *not yet strong evidence* — it needs multi-seed and panel CIs to confirm.
- **Scope:** SSL used the *same 140 train-frame inputs* as the supervised task (unlabeled/masked), so this
  is "same-domain SSL initialization improves optimization/sample use under this split," **not** a benefit
  from *extra* unlabeled data. The stronger version — pretraining on a larger unlabeled Himawari archive
  (free from AWS) — is the natural extension and is expected to be where SSL pays off most.

## Net
🟡 Promising: in-domain SSL initialization gives a positive onset signal (−1.43 K, seed 0) at zero data
cost — but preliminary (single seed/day) and same-domain. Honest claim: "a promising transfer signal that
needs multi-seed/multi-day CIs," with extra-unlabeled-data pretraining as the clear next step.
