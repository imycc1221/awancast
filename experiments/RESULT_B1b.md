# Result — Experiment B1b (onset-threshold sweep + conformal intervals)

**Run:** 2026-06-25 · `experiments/conformal_onset.py` · train 2016–2018 / calib 2019 / test 2020.
**Raw:** `experiments/conformal_onset_results.json`. CPU, NSRDB only. Closes reviewer sink-risk #1 + RQ2.

## 1. Onset-threshold sensitivity sweep — gain is STABLE (kills cherry-picking)
LightGBM's MAE reduction vs the strong smart-persistence baseline, on the storm-onset slice, across
three onset definitions:

| Horizon | thr 0.20 | thr 0.30 | thr 0.40 |
|---|---|---|---|
| 30 min | −18.1% (n=2746) | −18.2% (n=1643) | −18.1% (n=968) |
| 120 min | −33.3% (n=4712) | −32.5% (n=3288) | −31.0% (n=2226) |

**Finding:** the onset advantage is essentially **invariant to the threshold** (30-min ≈ 18% at every
cut; 120-min 31–33%). The result is not an artifact of a hand-picked onset definition — directly
answering reviewer sink-risk #1. (Threshold should still be formally pre-registered in the paper; this
sweep is the robustness evidence.)

## 2. Regime-conditioned conformal intervals (RQ2) — global calibration hides convective under-coverage
Split-conformal 90% intervals (calibrated on 2019, tested on 2020).

**30-min, per-regime coverage (target 0.90):**
| Regime | Global conformal | Regime-conditioned | Width: global → regime |
|---|---|---|---|
| STABLE | 0.941 (over-covers) | 0.916 | 396 → **334** (tighter) |
| PARTIAL | 0.843 (under) | **0.895** | 396 → 471 |
| CONVECTIVE | 0.821 (under) | **0.860** | 396 → 456 |

**Finding:** a single global conformal band looks fine marginally (~0.90 overall) but **systematically
under-covers exactly in the PARTIAL and CONVECTIVE regimes** — the storm conditions that matter most —
while wasting width over-covering STABLE. **Regime-conditioning fixes most of it**: it tightens STABLE
intervals (396→334 W/m²) and lifts convective coverage (0.82→0.86). This is concrete evidence for the
paper's claim that uncertainty must be reported **per regime**, not globally. (120-min shows the same
pattern; see JSON.)

**Honest residual:** even regime-conditioned, CONVECTIVE still under-covers slightly (0.86 / 0.88 vs
0.90). A single absolute-residual quantile can't fully capture convective heteroscedasticity — this is
the empirical motivation for richer uncertainty there (diffusion ensemble spread, idea #5) as next work.

## Claims now supported by real numbers
- ✅ RQ1 premise: onset is the dominant error regime, and ML's gain concentrates there — **robust to threshold**.
- ✅ RQ2: conformal intervals are achievable; **regime-conditioning materially improves calibration** where it counts.
- ⏳ Still open: optical-flow vs diffusion on raw Himawari frames (needs frames + GPU); decision-layer per-scheme value.
