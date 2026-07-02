# Result — Operational Onset Detector (the gate, made real)

**Run:** 2026-06-25 · `experiments/onset_detector.py` · real Himawari-9 B13, Malaysia. Train days
2026-06-01/02/03 (96,000 pixel samples), held-out test day 2026-06-04 (32,000). Horizon 30 min.
**Raw:** `experiments/onset_detector_results.json`.

## What this fixes
Every prior result defined the onset / high-change subset using *future* ground truth — a legitimate
**evaluation** device, but not something deployable. This detector predicts onset using **only
issuance-time information** (frames t-2, t-1, t): BT tendency, BT acceleration, local texture (std),
local mean, optical-flow divergence, current BT, and recent cooling. It turns the regime-selective gate
from post-hoc slicing into an operational component.

## Results (held-out day)
| Metric | Value |
|---|---|
| Base rate of onset (positives) | 17.3% |
| ROC-AUC | **0.815** |
| At threshold 0.5 | precision 0.37, recall 0.72, F1 0.49 |
| At recall 0.60 | precision **0.42** (threshold 0.59) |
| **Lift over base rate at 0.60 recall** | **2.42×** |

Feature importance is spread across all seven features (local texture and optical-flow divergence highest,
then local mean, tendency, current BT, acceleration; recent-min lowest) — no single feature dominates, and
the optical-flow divergence (a cheap physical signal of non-advective evolution) is among the most useful.

## Interpretation
- **AUC 0.815** means the detector ranks pixels by onset risk well above chance on a day it never saw.
- At 60% recall it is **2.4× more precise than random** (0.42 vs 0.17 base rate). Onset is genuinely hard
  to predict (that is the entire premise), so modest precision is expected and honest — but the gate is
  clearly usable: it can route the expensive model to a high-risk subset that contains a disproportionate
  share of true onset events.
- This directly upgrades the project's central contribution: the "apply the complex model on onset"
  design now has a **deployable trigger**, not just an oracle slice.

## Honest caveats
- One held-out day (preliminary); cloud-field brightness temperature, not irradiance.
- Pixel-level samples are spatially correlated; day/block CIs over a multi-day panel are the next step.
- Precision at usable recall is modest (~0.42) — the gate trades false positives for coverage; the
  downstream cost of false positives (running the expensive model unnecessarily) is low, so this is an
  acceptable operating point, but it should be tuned against the actual gate cost.

## Net
✅ The regime-selective gate is now **operational** (issuance-time, AUC 0.815, 2.4× lift), not post-hoc.
➡️ Remaining MEDIUM work: extend to a 20–40 day multi-season panel with day/block-bootstrap CIs (#1), and
   wire the detector into an end-to-end gated nowcast (detector fires → learned/diffusion residual; else
   persistence) to measure operational-gate utility vs the oracle gate.
