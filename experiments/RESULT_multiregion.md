# Result — Multi-Region Sub-Domain Check (reviewer R1-b, no new data)

**Run:** 2026-06-25 · `experiments/multiregion_panel.py` · existing Himawari panel, 6 test days.
Splits the Malaysia crop (lon 100–119) into longitude bands: Peninsular / Sarawak / Sabah.
Metric: optical-flow high-change skill vs persistence, per region, day-block-bootstrap 95% CIs.
**ARIS phase-1 check (Codex): PASS** (no leakage; stats correct; mapping reasonable; coarse-band caveat).

| Region | High-change skill | 95% CI | Significant? |
|---|---|---|---|
| Sarawak | +0.114 | [0.047, 0.182] | ✅ yes |
| Sabah | +0.105 | [0.053, 0.157] | ✅ yes |
| Peninsular | +0.034 | [−0.017, 0.092] | ✗ no (CI spans 0) |

## Interpretation
The regime-selective pattern (optical flow helps on the evolving-cloud subset) **generalizes significantly
to both Borneo regions (Sarawak, Sabah)** but is **weak / not significant over Peninsular** in this panel.
This is partial multi-region support: the effect is not confined to one location, but it is not uniform
either — an honest, mixed result rather than a clean "holds everywhere."

## Honest caveats (per cross-model check)
- Regions are approximated by **longitude-column bands, not geographic land masks**, so estimates are
  coarse sub-domain checks, not precise administrative-region attribution; bands include sea pixels.
- Still cloud-field **brightness temperature, not irradiance**.
- This tests the optical-flow signal per region, not the full system per region.
- Ground-truth multi-site validation (NSRDB at Kuching/Kota Kinabalu) is the proper complement — the
  fetch script is configured for it (`data/fetch_nsrdb.py`) but the NREL host is unreachable from the
  current environment; run it where NREL is reachable.

## Net
✅ Partial answer to R1-b: the regime-selective signal is significant in 2 of 3 Malaysian sub-domains
(Borneo), weak in Peninsular — reported honestly. Full multi-region claim still needs ground-truth
NSRDB at the additional sites.
