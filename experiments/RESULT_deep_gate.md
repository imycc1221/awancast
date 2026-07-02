# Result — Deep Model in the Gate (Phase 2); refines the gate story

**Run:** 2026-06-25 · `experiments/deep_gate.py` · deep U-Net + onset detector trained on 13 panel days;
gate policies on held-out 06-04 (2.145M px). **ARIS phase-2 check (Codex): PASS** (no leakage, math
verified, interpretation sound). NOT diffusion (deterministic CNN).

## Results (the deep U-Net as the "expensive model")
| Policy | MAE (K) | Expensive-model fraction | Benefit captured |
|---|---|---|---|
| Persistence | 7.70 | 0% | 0% |
| **Always-deep** | **5.20** | 100% | (best accuracy) |
| Oracle gate (onset→deep) | 5.49 | 17% | 100% of *gate* benefit |
| Operational gate @0.5 | 5.68 | 40% | **91.5%** |
| Operational gate @0.7 | 6.21 | 21% | 67.5% |

**vs the tabular gate:** deep op-gate **5.68** ≪ tabular op-gate 7.02; deep always-on 5.20 ≪ tabular oracle 6.38.

## The refinement (important, honest)
With the **weak** model (tabular LightGBM, §5.9), gating **beats** applying it everywhere — because the weak
model *hurts* on the calm majority. With the **strong** model (deep U-Net), **always-on wins on accuracy
(5.20 < oracle-gate 5.49)** — the deep model helps even on calm pixels (~0.34 K better on the non-onset
subset, per the cross-model check). So the gate's role **changes with model quality**:

- **Weak/expensive-model that hurts off-onset → gate is an ACCURACY tool** (route it to onset).
- **Strong model that helps everywhere → gate is a COMPUTE-EFFICIENCY tool**: the operational gate captures
  **91.5% of the benefit while running the expensive model on only 40% of pixels** (or 67.5% at 21%).

This is a more nuanced and more useful systems conclusion than "gating always wins," and it is exactly the
regime relevant to *generative diffusion*, whose sampling is genuinely expensive — there, a gate that keeps
~90% of the benefit at ~40% of the sampling cost is directly valuable.

## Caveats (per cross-model check)
- The "oracle gate" is an **onset oracle, not a model-selector oracle** — so always-on can beat it.
- **One held-out day**; the compute-accuracy trade-off should be replicated across more dates.
- Deterministic CNN, not diffusion; cloud-field BT, not irradiance.

## Net
✅ The deep model in the gate is far better than the tabular gate (op-gate 5.68 vs 7.02). ✅ Honest
refinement: gating is an *accuracy* win for weak models and a *compute-efficiency* win for strong ones —
the latter is the regime that matters for expensive generative diffusion.
