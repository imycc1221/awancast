# Experiment Audit v2 (ARIS cross-model) — new/upgraded experiments

**Date:** 2026-06-25 · **Auditor:** Codex/GPT-5.5 (xhigh, read-only), fresh context.
**Scope:** the experiments added after audit v1 — significance, ablation, conformal upgrade, onset detector,
end-to-end gate, decision sensitivity, panel eval, and the corrected RQ3.

## Overall verdict: **PASS on leakage** (issues are doc/reproducibility, not result-invalidating)
> "No critical leakage found in the new detector, gate, panel split, conformal, or corrected RQ3 code.
> The operational gates use issuance-time features; oracle labels are kept to oracle/evaluation paths."

## Checks
- **A. Leakage / future-info — PASS.** Detector/gate/panel features use only frames t-2,t-1,t; labels from
  t+H used only for the *label* and the *oracle* policy; operational gate uses detector probability only;
  panel train (Jan–Apr) and test (May–Jun) days are disjoint and models fit on train only.
- **B. Bootstrap validity — WARN.** Resampling unit is correct (days, not pixels) in both significance and
  panel. Two notes: `bootstrap_p(gain<=0)` is not a formal p-value (reworded in the paper); panel CIs rest
  on 6 test days (caveat kept prominent in §5.10).
- **C. Conformal — PASS.** Calibration (2019) disjoint from test (2020); finite-sample rank formula correct;
  normalized interval reconstructed as q·cs_target; coverage check correct.
- **D. Metric/claim match — WARN → FIXED.** Panel AUC 0.807, gate benefit 53.7%, conformal convective 0.935
  all match JSON↔RESULT↔paper. Fixed: stale RQ3 prose (RM ~57/~36 → ~51/~32; "1-step roll" → issuance-time).
- **E. Over/under-claim — WARN → FIXED.** Fixed the stale RQ3 prose; made `build_panel.py` self-contained
  (now includes the June days `panel_eval.py` consumes). Paper §5 appropriately caveated.
- **F. RQ3 prior-leakage recheck — PASS.** Day-ahead forecast uses `prev_pv` (yesterday), updated only after
  the current day; cost evaluated vs actual PV; `perfect` labelled an upper bound.

## Action log (this audit)
| # | Issue | Fix |
|---|---|---|
| 1 | Stale RQ3 RESULT prose (RM 57/36; "1-step roll") | Corrected to RM 51/32 + issuance-time forecast wording |
| 2 | `build_panel.py` built only 10 days; `panel_eval.py` needs 14 | Added June days to `build_panel.py` |
| 3 | Panel CIs rest on 6 test days | Caveat already prominent in §5.10; left as stated |
| 4 | `bootstrap_p` mislabeled as p-value | Paper reworded to "no resample showed non-positive gain; permutation test = refinement" |

## Net
The expanded experiment set (12 results) is **leakage-clean** on independent cross-model review. The only
findings were documentation/reproducibility mismatches, now fixed. Integrity status: **PASS** with minor
caveats (panel size, formal p-value) stated honestly in the paper.
