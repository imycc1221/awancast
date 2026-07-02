# Result — HARDENED C&I Peak-Shaving under RP4 (real load + real forecast)

**Run:** 2026-06-27 · `experiments/cni_peakshave_hardened.py` (+ `data/fetch_comstock.py`). Replaces the two
soft spots of the stylized version: **real load** (NREL ComStock RetailStandalone, FL hot-humid, real 15-min
interval meter → 30-min, shape scaled to 2 MW peak) and a **real, causal, error-bearing forecast** (clear-sky
-index *persistence* nowcast — `k(t−1)·clearsky_PV(t)`, the "smart persistence" of B1). Resolution = **30 min,
the exact RP4 maximum-demand window**. Solar = real NSRDB Petaling Jaya 2020. **ARIS check (Codex): PASS** —
numbers citable with caveats; `shift(1)` confirmed causal (no leakage); storm-miss finding genuine.

## Annual RP4 demand charge
| Policy | RM/year |
|---|---|
| grid-only | 1,693,407 |
| solar-only (no battery) | 1,655,702 |
| blind-conservative + battery (p10 solar climatology) | 1,109,592 |
| **real-forecast + battery** (causal 30-min persistence) | **1,055,016** |
| oracle (actual solar — upper bound) | 988,132 |

## Savings (RM/year)
| | RM/yr |
|---|---|
| **System: real-forecast+battery vs grid (DEFENSIBLE headline)** | **638,391** |
| System: oracle vs grid | 705,275 |
| **Real forecast's marginal value vs smart blind operator** | **54,576** |
| Oracle headroom vs blind | 121,460 |
| **Fraction of headroom captured by the real (persistence) forecast** | **45%** |

## The honest, thesis-confirming finding
- **Most peak-shaving value comes from battery + conservative control, not the forecast.** A solar+battery
  system with a *smart blind* operator already cuts the demand charge from RM1.69M → RM1.11M.
- **A real persistence forecast adds only ~RM55k/yr** over that smart operator — and **captures just 45%**
  of the available (oracle) headroom.
- **In 2 months (March, September) the persistence forecast did *worse* than the blind operator** — it set
  an aggressive cap then got **caught by a storm-onset miss**, raising the monthly peak.

→ This is *exactly* the project's thesis: the forecast's value lives at **storm onset**, and a naive
persistence forecast **fails there**. The ~RM67k gap between the real forecast (RM55k) and the oracle
(RM121k) is the **headroom a better storm-onset nowcaster** (the regime-selective gate) could recover —
quantified motivation for the very model we build.

## Caveats (state for any pitch)
- Real load (FL ComStock 2018) and real solar (Malaysia 2020) are **non-co-located**, aligned by calendar
  slot (mm-dd HH:MM) — a stylization, not a single metered site.
- Monthly cap is chosen **ex post** over the month (not a fully online controller); battery idealized
  (100% efficiency, monthly SOC reset, no degradation); **gross of capex/O&M**.
- ComStock building = median RetailStandalone in the first FL county file (a real FL retail shape, not a
  statewide median).

## Net
✅ Hardening **shrank** the forecast-specific number (RM~0.2–0.5M stylized → **RM55k real**) — honest, and
it strengthens the science: the **system** value is large and defensible (~RM638k/yr), while the **forecast**
adds value specifically by anticipating storms — which a persistence baseline can't, leaving measurable
headroom (~RM67k/yr) for the project's storm-onset nowcaster.
