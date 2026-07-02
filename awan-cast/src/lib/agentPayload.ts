import type { ExplainRequest } from '../agent/context';
import type { Forecast, Recommendation, TariffConfig } from '../types';

/**
 * Build the explanation-agent request from a recommendation. Single source of truth so the "ground the
 * agent on TRUE scheduler numbers" rule (raw savings + solar value, never the display-only demo floor)
 * cannot drift between the list and the hero.
 */
export function toAgentPayload(
  applianceName: string,
  rec: Recommendation,
  forecast: Forecast,
  tariff: TariffConfig,
): ExplainRequest {
  return {
    applianceName,
    recommendation: {
      action: rec.action,
      windowStart: rec.windowStart,
      windowEnd: rec.windowEnd,
      savingsRm: rec.savingsRm,
      solarValueRm: rec.solarValueRm,
      reason: rec.reason,
    },
    forecast: {
      regime: forecast.regime,
      regimeConfidence: forecast.regimeConfidence,
      currentKw: forecast.currentKw,
      todayKwh: forecast.todayKwh,
      stormWindow: forecast.stormWindow,
    },
    tariff: { label: tariff.label, exportAllowed: tariff.exportAllowed },
  };
}
