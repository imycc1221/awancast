import type { Appliance, Forecast, TariffConfig } from '../types';
import { recommend } from '../data/scheduler';
import { confidenceLabel } from './confidenceLabel';
import { formatTimeMyt } from './format';

export interface StormAlert {
  startLabel: string;
  endLabel: string;
  durationMin: number;
  confidenceWord: string;
  runNowNames: string[];
  holdName: string | null;
  holdUntilLabel: string | null;
}

/** Join names into "a", "a and b", or "a, b and c" (connector word is translatable). */
export function joinNames(names: string[], andWord = 'and'): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} ${andWord} ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} ${andWord} ${names[names.length - 1]}`;
}

/**
 * Build the calm, action-first storm heads-up shown before a storm. Returns null when there is no storm
 * window or the storm has already started. Action guidance is read from the deterministic scheduler.
 */
export function buildStormAlert(
  forecast: Forecast,
  appliances: Appliance[],
  tariff: TariffConfig,
  now: Date,
  demandFn?: (ms: number) => number,
): StormAlert | null {
  if (!forecast.stormWindow) return null;
  const startMs = Date.parse(forecast.stormWindow.start);
  const endMs = Date.parse(forecast.stormWindow.end);
  if (now.getTime() >= startMs) return null;

  const byId = new Map(appliances.map((a) => [a.id, a]));
  const recs = recommend(forecast, appliances, tariff, now, demandFn);

  const runNowNames = recs
    .filter((r) => r.action === 'run-now')
    .map((r) => byId.get(r.applianceId)?.name)
    .filter((n): n is string => Boolean(n));

  const waits = recs
    .filter((r) => r.action === 'wait')
    .map((r) => ({ r, a: byId.get(r.applianceId) }))
    .filter((x): x is { r: (typeof recs)[number]; a: Appliance } => Boolean(x.a))
    .sort((x, y) => y.a.kwDraw - x.a.kwDraw);
  const hold = waits[0] ?? null;

  const conf = confidenceLabel(forecast.regime, forecast.regimeConfidence);

  return {
    startLabel: formatTimeMyt(forecast.stormWindow.start),
    endLabel: formatTimeMyt(forecast.stormWindow.end),
    durationMin: Math.round((endMs - startMs) / 60_000),
    confidenceWord: conf.word,
    runNowNames: runNowNames.slice(0, 3),
    holdName: hold ? hold.a.name : null,
    holdUntilLabel: hold ? formatTimeMyt(hold.r.windowStart) : null,
  };
}
