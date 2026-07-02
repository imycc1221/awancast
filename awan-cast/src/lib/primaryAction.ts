import type { Appliance, Forecast, Recommendation, TariffConfig } from '../types';
import { recommend } from '../data/scheduler';

export interface PrimaryAction {
  appliance: Appliance;
  recommendation: Recommendation;
  stormApproaching: boolean;
  /** Total positive savings available from all run-now recommendations right now. */
  availableNowRm: number;
  /** Free-solar value if each flexible load is run once today in its best window. */
  dailyPotentialRm: number;
}

/**
 * Choose the single highest-value action to surface as the home-screen hero. Prefers a "run now"
 * recommendation with the largest saving; if none are runnable now, surfaces the best upcoming one so the
 * user knows what to plan. Pure and deterministic, reusing the same scheduler the list uses.
 */
export function pickPrimaryAction(
  forecast: Forecast,
  appliances: Appliance[],
  tariff: TariffConfig,
  now: Date,
  demandFn?: (ms: number) => number,
): PrimaryAction | null {
  if (appliances.length === 0) return null;

  const byId = new Map(appliances.map((a) => [a.id, a]));
  // True scheduler output; the EV demo floor is applied at display only, never here or in the agent path.
  const recs = recommend(forecast, appliances, tariff, now, demandFn);

  const withAppliance = recs
    .map((r) => ({ r, a: byId.get(r.applianceId) }))
    .filter((x): x is { r: Recommendation; a: Appliance } => Boolean(x.a));
  if (withAppliance.length === 0) return null;

  const displayValue = (r: Recommendation) =>
    r.action === 'run-now' ? r.solarValueRm ?? 0 : r.savingsRm;

  const runNow = withAppliance.filter((x) => x.r.action === 'run-now');
  const pool = runNow.length > 0 ? runNow : withAppliance;
  pool.sort((x, y) => displayValue(y.r) - displayValue(x.r));
  const top = pool[0]!;

  const availableNowRm = Number(
    runNow.reduce((sum, x) => sum + Math.max(0, x.r.solarValueRm ?? 0), 0).toFixed(2),
  );
  // If each flexible load is run once today in its best window (which is how a home actually uses them).
  const dailyPotentialRm = Number(
    withAppliance.reduce((sum, x) => sum + Math.max(0, x.r.solarValueRm ?? 0), 0).toFixed(2),
  );
  const stormApproaching =
    Boolean(forecast.stormWindow) && now.getTime() < Date.parse(forecast.stormWindow!.start);

  return { appliance: top.a, recommendation: top.r, stormApproaching, availableNowRm, dailyPotentialRm };
}
