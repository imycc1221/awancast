# Experiment Audit Report (ARIS cross-model)

**Date:** 2026-06-25
**Auditor:** Codex / GPT-5.5 (xhigh, read-only), fresh context — no prior project knowledge.
**Executor:** Claude (collected file paths only; did not participate in the integrity judgment).
**Scope:** experiments B1, B1b, B2, B3, B4 + their result JSONs + paper §5.

## Initial verdict: **FAIL** → after fixes: issues resolved (see Action Log)
The fail was **not** fraud in the core supervised experiments (B1/B1b/B2/B3 use real dataset targets and
avoid training leakage). It was driven by one real leakage bug in B4 plus manuscript overclaiming/stale scope.

## Checks
- **A. Ground-truth provenance — PASS.** B1/B1b target = NSRDB GHI; B2/B3 target = real Himawari B13 future
  frames; B4 explicitly labelled simulation. No target derived from model outputs.
- **B. Leakage / target contamination — FAIL → FIXED.** Core forecasters clean (no `target`/`k_target` in
  features; `cs_target` is legitimate ex-ante clear-sky; clean train/cal/test split). **Real bug:** B4's
  "persistence forecast" used `np.roll(pv,1)` = same-day future PV, then optimized over the whole day →
  inflated the "persistence captures all value" claim.
- **C. Result/claim match — WARN → FIXED.** JSON↔writeup numbers matched. Issues: B1 "~3×" mixed
  models/horizons (true 2.97× @30m, 1.69× @120m); paper had stale scope lines.
- **D. Metric soundness — WARN.** MAE/skill/coverage formulas correct. Notes (acknowledged, not fixed in
  code): split-conformal uses plain quantile not finite-sample-corrected; B2 averages per-frame MAEs
  (not pixel-weighted). Both now caveated.
- **E. Scope vs language — WARN → FIXED.** Language too strong for the evidence ("confirmed twice" on one
  2-h window; "third consecutive" on one held-out day; "SELCO confirmed" from a simplified sim).
- **F. Narrative self-consistency — WARN → FIXED.** SELCO>ATAP>NEM holds in the data; "regime-selective"
  story is partially (not cleanly) proven; paper self-contradicted its own scope.

## Ranked problems and Action Log
| # | Problem (auditor) | Fix applied |
|---|---|---|
| 1 | **B4 future-info leakage** in "persistence" forecast | Rewrote `decision_value_rq3.py`: forecasts are now issuance-time only — **clear-sky (ex-ante)** and **day-ahead (yesterday's profile)**; perfect kept only as an upper bound. Re-ran. Honest result: simple forecast captures ~88–89% of perfect (not ~98%); SELCO>ATAP>NEM ordering unchanged. Updated RESULT_B4 + paper §5.7 + abstract. |
| 2 | Stale/contradictory paper scope lines | Updated doc-type line, §5.4, and §5 intro so they reflect §5.5–5.7 (Himawari + decision sim); only the diffusion model is now stated as pending. |
| 3 | Target-defined onset/high-change subsets framed as validation | Already caveated; tightened wording to "diagnostic slice / evaluation device, not operational detection." |
| 4 | B2/B3 evidence small ("confirmed") | Softened throughout to "preliminary / consistent with," with explicit single-window / single-day caveats in paper and RESULT files. |
| 5 | B1 "~3×" mixes models/horizons | Corrected to 2.97× (30 min) / 1.69× (120 min) in paper and RESULT_B1. |

## Residual (acknowledged, not code-fixed)
- Conformal: finite-sample split-conformal quantile + time-series exchangeability — caveated in paper §5
  limitations; ACI named as the planned online fix.
- B2 MAE is frame-averaged, not pixel-weighted — minor; noted.

## Net
The cross-model audit caught a genuine leakage bug the executor missed (B4) and a pattern of mild
overclaiming. All actionable items fixed or caveated; the corrected results are weaker but honest, and the
headline SELCO ordering and regime-selective pattern survive. Integrity status after fixes: **WARN**
(honest preliminary results with stated caveats), not FAIL.
