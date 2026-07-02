import type { Forecast } from '../types';
import { BASELINE_SOLAR_KWP, type HouseholdProfile } from '../data/profiles';
import { matchCohort, demandKwAt, inventoryDeltaKw } from '../data/cohorts';

export interface NetLoadPoint {
  t: string;
  solarKw: number;
  demandKw: number;
  /** Free surplus (kW) = solar minus demand, clamped at zero. */
  surplusKw: number;
  /** Grid draw (kW) = demand minus solar, clamped at zero. */
  gridKw: number;
}

/** Scale the mock forecast to the household's solar capacity. */
export function scaleForecast(forecast: Forecast, solarKwp: number): Forecast {
  const f = solarKwp / BASELINE_SOLAR_KWP;
  if (Math.abs(f - 1) < 1e-6) return forecast;
  return {
    ...forecast,
    currentKw: Number((forecast.currentKw * f).toFixed(2)),
    todayKwh: Number((forecast.todayKwh * f).toFixed(1)),
    points: forecast.points.map((p) => ({
      t: p.t,
      kw: Number((p.kw * f).toFixed(2)),
      kwLow: Number((p.kwLow * f).toFixed(2)),
      kwHigh: Number((p.kwHigh * f).toFixed(2)),
    })),
  };
}

/**
 * A demand function for a profile: the cohort prior plus aircon load. This is the day-one stand-in for a
 * personalised demand forecaster (which is the architected, deployment-phase slot).
 */
export function demandFnFor(profile: HouseholdProfile): (ms: number) => number {
  const cohort = matchCohort(profile);
  const airconCount = profile.appliances['aircon'] ?? 0;
  // Cohort baseline (typical home incl. hidden loads) + aircon + inventory delta for owning more or
  // fewer always-on devices than typical. Floored at 50 W — a home never draws truly zero.
  return (ms: number) =>
    Math.max(0.05, demandKwAt(cohort, airconCount, ms) + inventoryDeltaKw(profile.appliances, ms));
}

/** Compute the net-load curve: solar (already scaled) minus predicted demand at each forecast point. */
export function computeNetLoad(
  scaledForecast: Forecast,
  demandFn: (ms: number) => number,
): NetLoadPoint[] {
  return scaledForecast.points.map((p) => {
    const solarKw = Math.max(0, p.kw);
    const demandKw = Math.max(0, demandFn(Date.parse(p.t)));
    const diff = solarKw - demandKw;
    return {
      t: p.t,
      solarKw: Number(solarKw.toFixed(2)),
      demandKw: Number(demandKw.toFixed(2)),
      surplusKw: Number(Math.max(0, diff).toFixed(2)),
      gridKw: Number(Math.max(0, -diff).toFixed(2)),
    };
  });
}
