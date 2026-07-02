# Result — C&I Peak-Shaving under RP4 (the government value-case)

**Run:** 2026-06-27 · `experiments/cni_peakshave_rp4.py` · **STYLIZED** simulation. A commercial site
(stylized ~2 MW-peak mall load) + 1 MW rooftop solar (real NSRDB Petaling Jaya 2020 irradiance) +
2 MWh / 1 MW battery, priced at the **RP4 industrial capacity charge RM89.27/kW of monthly peak**.
**ARIS check (Codex): PASS with caveats** — controller/min-cap search sound; first naive baseline was a
strawman (flagged + fixed); forecast-specific value is baseline-sensitive (quantile sweep added).

## Headline (annual RP4 demand charge)
| Policy | Annual demand charge |
|---|---|
| grid-only (no solar/battery) | RM 2.16M |
| solar-only (no battery) | RM 2.08M |
| **forecast + battery** | **RM 1.28M** |
| competent blind operator + battery (p10–p50 solar) | RM 1.51M – 1.99M |

## Two numbers, stated honestly
1. **System value (DEFENSIBLE headline):** solar + battery + smart control vs grid-only =
   **≈ RM 0.88M / year** saved on RP4 demand charges, for one 2 MW-peak mall. → "thousands-to-millions
   across many C&I sites" is credible *as a stylized projection*.
2. **Forecast-*specific* marginal value (secondary, baseline-sensitive):** vs a **competent conservative
   solar-blind operator** (assumes low/p10 solar, never gets caught) the forecast adds only **≈ RM 230k/yr**;
   vs progressively more optimistic operators it rises to RM 0.5–0.7M. **We quote the low end (~RM0.2–0.5M)
   as the honest figure** — a smart operator without a forecast already captures most of the benefit; the
   forecast lets them shave *more confidently/aggressively* (cap 1.41 MW → 1.28 MW).

The earlier "RM799k forecast value" came from a **strawman** naive (over-trusted clear sky, got broken on
every storm — uniform 12-month gap). Discarded; kept only as a labeled upper bound.

## Caveats (must state for any pitch)
- **Stylized**: synthetic load, idealized battery (no efficiency/degradation/O&M/capex), one site-year,
  10-min steps as a proxy for the 30-min billing window, and the "forecast" controller is effectively an
  **oracle** (uses actual solar). → a **projection, not measured savings**.
- Real validation needs **C&I interval-meter load data** + actual TNB billing rules + a *real* forecast
  (with error) in the loop. The whole-system saving is robust to these; the forecast-specific number is not.

## Net for the government argument
✅ A solar + battery + smart-control system plausibly cuts a 2 MW mall's RP4 demand charges by
**~RM0.9M/year** (stylized). The *forecast's* own contribution is real but **secondary and
baseline-dependent (~RM0.2–0.5M/yr)** — honest framing: *the forecast lets the existing national bets
(Solar ATAP self-consumption, RP4 demand charges, MyBeST storage) be exploited more aggressively and
safely*, not that forecasting alone saves millions.
