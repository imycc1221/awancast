# Result — BT → Irradiance Link (reviewer R1-a)

**Run:** 2026-06-25 · `experiments/bt_irradiance.py` · Himawari-8 cloud-top BT at Petaling Jaya (4 days in
2020, 144 daytime frames) paired with the **existing NSRDB GHI** for the same point/time. **ARIS check
(Codex): caught in-sample fitting (FAIL) → fixed with leave-one-day-out (LODO).** Numbers below are honest
out-of-sample (the BT→k map never sees the day it predicts).

## Does cloud-top BT carry the solar signal? (the link)
| Metric | Value |
|---|---|
| corr(BT, clear-sky index k) | **0.717** |
| BT→k R² (out-of-sample, LODO) | 0.281 |
| BT→GHI MAE (out-of-sample) | 89.3 W/m² |

## Does nowcasting BT translate to GHI skill? (+30 min, W/m²)
| Method | GHI MAE |
|---|---|
| Persistence-GHI (baseline) | 116.9 |
| **BT→GHI (current BT mapped)** | **102.5** (−12.3%) |
| Optical-flow-BT → GHI | 103.0 (−11.9%) |

## Honest interpretation
- **The link is real but modest.** BT and the clear-sky index are clearly correlated (0.72) — warm BT =
  clear = high irradiance; cold BT = thick cloud = low irradiance. But a single-pixel BT→k map fit on other
  days explains only ~28% of held-out variance (the in-sample 0.65 was optimistic — the check caught it),
  so day-to-day generalization is limited with 4 days and one pixel.
- **Translation works, modestly.** Mapping BT → GHI at +30 min beats persistence-GHI by ~12% out-of-sample
  (102.5 vs 116.9 W/m²). Optical-flow BT ≈ current-BT at this single point/horizon (advection's benefit is
  on the *evolving* subset, §5.5, not pointwise), so it does not add here.
- **This answers R1-a directionally:** the satellite quantity we nowcast (brightness temperature) does
  predict irradiance, and nowcasting it yields real GHI skill in W/m² — so the cloud-field results are
  solar-relevant, not merely "cloud temperature." The effect size is preliminary.

## Caveats (per cross-model check)
- **Partial circularity:** NSRDB GHI is itself a satellite-derived product (Himawari-era inputs), so this is
  *consistency with the satellite-derived NSRDB irradiance product*, **not** independent ground (pyranometer)
  validation. A true closure needs co-located surface pyranometer GHI (SEDA PVMS / university stations).
- Single pixel (Petaling Jaya), 4 days, daytime only (144 paired / 120 nowcast samples) — preliminary.
- Simple monotonic BT→k map (ignores cloud type, multi-layer cloud); a richer map + more days would improve R².

## Net
✅ R1-a answered directionally and honestly: cloud-top BT carries the solar signal (corr 0.72) and
nowcasting it beats persistence-GHI by ~12% out-of-sample — real but modest, pending independent surface
validation and more data.
