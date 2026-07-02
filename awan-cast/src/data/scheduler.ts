import type {
  Appliance,
  Forecast,
  ForecastPoint,
  Recommendation,
  TariffConfig,
} from '../types';

const STEP_MIN = 15;

// `tierMaxKwh` is a cumulative monthly threshold; return the rate of the first tier that covers the
// projected monthly consumption (simple block model, single rate for the whole usage).
export function retailRate(tariff: TariffConfig, projectedMonthlyKwh = 800): number {
  for (const tier of tariff.retailRatesKwh) {
    if (projectedMonthlyKwh <= tier.tierMaxKwh) return tier.rateRm;
  }
  return tariff.retailRatesKwh[tariff.retailRatesKwh.length - 1]!.rateRm;
}

function kwAt(points: ForecastPoint[], timeMs: number): number {
  if (points.length === 0) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (timeMs <= Date.parse(first.t)) return first.kw;
  // Beyond the forecast horizon we know nothing about the sky (and it may be night): assume zero
  // solar rather than extrapolating the last sample forward. Prevents "run at 10 PM on solar" advice.
  if (timeMs >= Date.parse(last.t)) return 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const tA = Date.parse(a.t);
    const tB = Date.parse(b.t);
    if (timeMs <= tB) {
      if (tB === tA) return b.kw; // guard duplicate timestamps
      const ratio = (timeMs - tA) / (tB - tA);
      return a.kw + ratio * (b.kw - a.kw);
    }
  }
  return last.kw;
}

interface WindowCost {
  startMs: number;
  endMs: number;
  costRm: number;
  selfConsumedKwh: number;
  importedKwh: number;
}

function costForWindow(
  appliance: Appliance,
  forecast: Forecast,
  tariff: TariffConfig,
  startMs: number,
  demandFn?: (ms: number) => number,
): WindowCost {
  const endMs = startMs + appliance.durationMin * 60_000;
  const integrationStepMs = 5 * 60_000;
  let importedKwh = 0;
  let selfConsumedKwh = 0;

  for (let t = startMs; t < endMs; t += integrationStepMs) {
    // Clamp the final step so a duration that is not a multiple of the step still integrates exactly.
    const stepMs = Math.min(integrationStepMs, endMs - t);
    const fractionalHr = stepMs / 3_600_000;
    const draw = appliance.kwDraw * fractionalHr;
    // Net-load aware: only the surplus after the household's baseline demand is free solar.
    const solar = Math.max(0, kwAt(forecast.points, t));
    const baseline = demandFn ? Math.max(0, demandFn(t)) : 0;
    const generation = Math.max(0, solar - baseline) * fractionalHr;
    const used = Math.min(draw, generation);
    selfConsumedKwh += used;
    importedKwh += draw - used;
  }

  const rate = retailRate(tariff);
  const exportRate = tariff.exportAllowed ? (tariff.exportRateRm ?? 0) : 0;
  const displacedExport = tariff.exportAllowed ? selfConsumedKwh : 0;

  // Opportunity cost of running in this window: imports are paid at the retail rate, and any solar the
  // appliance self-consumes forgoes the export credit it would otherwise have earned. Under a 1:1 export
  // scheme (rate === exportRate) every window therefore costs the same — timing honestly saves nothing.
  const costRm = importedKwh * rate + displacedExport * exportRate;

  return { startMs, endMs, costRm, selfConsumedKwh, importedKwh };
}

function windowOverlapsStorm(
  forecast: Forecast,
  startMs: number,
  endMs: number,
): number {
  if (!forecast.stormWindow) return 0;
  const sStart = Date.parse(forecast.stormWindow.start);
  const sEnd = Date.parse(forecast.stormWindow.end);
  const overlap = Math.max(0, Math.min(endMs, sEnd) - Math.max(startMs, sStart));
  return overlap;
}

// Static, jargon-free sentences (also the keys for the Bahasa Malaysia dictionary in lib/i18n.ts).
function describeReason(
  appliance: Appliance,
  best: WindowCost,
  nowCost: WindowCost,
  forecast: Forecast,
  tariff: TariffConfig,
): string {
  if (!tariff.exportAllowed) {
    return 'No export is allowed on your scheme, so every unit of solar you use yourself counts.';
  }
  if (best.startMs === nowCost.startMs) {
    if (forecast.stormWindow) {
      return 'Solar is strong now and a storm is approaching. Run before the storm arrives.';
    }
    return "Solar generation is at or above the appliance's draw — running now uses your own power.";
  }
  return 'Generation will be higher and cheaper in this window, so waiting saves the most.';
}

export function recommend(
  forecast: Forecast,
  appliances: Appliance[],
  tariff: TariffConfig,
  nowOverride?: Date,
  demandFn?: (ms: number) => number,
): Recommendation[] {
  const nowMs = (nowOverride ?? new Date(forecast.issuedAt)).getTime();

  return appliances.map((appliance) => {
    const candidates: WindowCost[] = [];
    const flexEndMs = nowMs + appliance.flexibilityHrs * 3_600_000;
    for (let t = nowMs; t <= flexEndMs; t += STEP_MIN * 60_000) {
      candidates.push(costForWindow(appliance, forecast, tariff, t, demandFn));
    }
    if (candidates.length === 0) {
      const fallback = costForWindow(appliance, forecast, tariff, nowMs, demandFn);
      candidates.push(fallback);
    }

    const nowCost = candidates[0]!;
    const STORM_PENALTY_PER_HR = 3.0;
    const scoreOf = (c: WindowCost) =>
      c.costRm + (windowOverlapsStorm(forecast, c.startMs, c.endMs) / 3_600_000) * STORM_PENALTY_PER_HR;

    let best = nowCost;
    let bestScore = scoreOf(nowCost);
    for (const c of candidates) {
      const s = scoreOf(c);
      if (s < bestScore) {
        best = c;
        bestScore = s;
      }
    }

    const action: Recommendation['action'] =
      best.startMs - nowMs < STEP_MIN * 60_000 ? 'run-now' : 'wait';
    const savings = Math.max(0, nowCost.costRm - best.costRm);

    // The value of the free solar this appliance uses: the self-consumption advantage over the
    // alternative (exporting then importing). For no-export schemes that is the full retail rate; for a
    // 1:1 export scheme it is ~zero, which is the honest result for Sarawak NEM.
    const rate = retailRate(tariff);
    const exportAdvantage = tariff.exportAllowed ? rate - (tariff.exportRateRm ?? 0) : rate;
    const solarValueRm = Number((best.selfConsumedKwh * Math.max(0, exportAdvantage)).toFixed(2));

    return {
      applianceId: appliance.id,
      action,
      windowStart: new Date(best.startMs).toISOString(),
      windowEnd: new Date(best.endMs).toISOString(),
      savingsRm: Number(savings.toFixed(2)),
      solarValueRm,
      reason: describeReason(appliance, best, nowCost, forecast, tariff),
    };
  });
}
