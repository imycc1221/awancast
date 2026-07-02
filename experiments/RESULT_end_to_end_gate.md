# Result — End-to-End Gated Nowcast (capstone)

**Run:** 2026-06-25 · `experiments/end_to_end_gate.py` · real Himawari B13, held-out test day 2026-06-04,
30-min horizon, **2.145M test pixels** (full frames, not subsampled). Both models (learned residual = B3;
onset detector = §5.8) trained on 2026-06-01/02/03. **Raw:** `experiments/end_to_end_gate_results.json`.

## Policies and MAE (K)
| Policy | MAE (K) | Expensive-model fraction | Benefit captured |
|---|---|---|---|
| Persistence (cheap baseline) | 7.696 | 0% | 0% |
| **Always-learned** (expensive everywhere) | 7.459 | 100% | 24% |
| Operational gate @ thr 0.50 | **7.023** | **33%** | **51%** |
| Operational gate @ thr 0.59 | 7.067 | 24.5% | 48% |
| Operational gate @ thr 0.70 | 7.175 | 14.2% | 40% |
| **Oracle gate** (perfect onset labels) | **6.379** | 17.1% | 100% (ceiling) |

(Benefit captured = (persistence − policy) / (persistence − oracle).)

## Two headline findings
1. **Gating beats applying the expensive model everywhere.** Oracle gate (6.38) < always-learned (7.46) <
   persistence (7.70). Running the complex model on *every* pixel is *worse* than routing it only to onset,
   because on the calm majority the expensive model adds noise where persistence is better. This is the
   most direct possible validation of the regime-selective ("gate it, don't always-apply") design — the
   central thesis of the paper, now demonstrated end-to-end on a held-out day.
2. **The operational detector makes the gate useful at a fraction of the cost.** Using only issuance-time
   features, it captures **~half of the oracle benefit (48–51%)** while running the expensive model on only
   **25–33%** of pixels. The threshold trades coverage for cost monotonically (40% benefit at 14% cost →
   51% at 33% cost).

## Honest interpretation
- The operational gate captures ~half, not all, of the oracle benefit — because the detector's precision is
  modest (~0.42 at 60% recall). A better detector closes the gap toward the oracle ceiling. This is stated
  as a limitation, not hidden.
- Crucially, this experiment sets up the diffusion case precisely: here the "expensive model" is the cheap
  learned residual (oracle ceiling 6.38). When the expensive model becomes generative diffusion — which, if
  it beats the 16.94 K onset bar (§5.6), would *raise* the oracle ceiling — the gate's value grows. The
  end-to-end harness is now in place to measure exactly that.

## Caveats
One held-out day; cloud-field brightness temperature, not irradiance; pixel samples spatially correlated
(multi-day block-bootstrap CIs are the remaining step). Farnebäck/feature params untuned.

## Net
✅ The regime-selective design is validated end-to-end: **gate > always-on > persistence**, and the
operational detector captures ~50% of the oracle benefit at ~1/3 the expensive-model cost — on a held-out
day, with a deployable (no-future-info) trigger. The diffusion comparison now plugs directly into this harness.
