import { describe, it, expect } from 'vitest';
import { explain, type LlmCaller } from '../src/agent/explain';
import { recommend } from '../src/data/scheduler';
import { mockAppliances } from '../src/data/mockAppliances';
import { mockForecast } from '../src/data/mockForecast';
import { getTariff } from '../src/data/tariffs';
import { applyDemoSavingsFloor } from '../src/lib/demoClock';
import { formatRm } from '../src/lib/format';
import type { ExplainRequest } from '../src/agent/context';

const FROZEN = new Date('2026-05-15T06:05:00.000Z');

/** Build the request exactly as the UI does: from the real scheduler output. */
function payloadFor(applianceId: string): ExplainRequest {
  const forecast = mockForecast('peninsular', FROZEN);
  const tariff = getTariff('peninsular');
  const r = recommend(forecast, mockAppliances, tariff, FROZEN).find(
    (x) => x.applianceId === applianceId,
  )!;
  const appliance = mockAppliances.find((a) => a.id === applianceId)!;
  const savingsRm = applyDemoSavingsFloor(applianceId, r.savingsRm);
  return {
    applianceName: appliance.name,
    recommendation: {
      action: r.action,
      windowStart: r.windowStart,
      windowEnd: r.windowEnd,
      savingsRm,
      reason: r.reason,
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

describe('agent pipeline (scheduler -> context -> validate -> response)', () => {
  it('accepts grounded LLM text built from the real recommendation', async () => {
    const req = payloadFor('ev');
    const saving = formatRm(req.recommendation.savingsRm);
    const callLlm: LlmCaller = async () =>
      `There is more sun a bit later, so waiting uses your own power and saves about ${saving} today. We are at Good confidence about this.`;
    const res = await explain(req, { callLlm });
    expect(res.aiGenerated).toBe(true);
    expect(res.text).toMatch(/waiting/);
  });

  it('falls back to the deterministic reason when the LLM invents a number', async () => {
    const req = payloadFor('ev');
    const callLlm: LlmCaller = async () => 'You will save about RM 123.45 today.';
    const res = await explain(req, { callLlm });
    expect(res.aiGenerated).toBe(false);
    expect(res.text).toBe(req.recommendation.reason);
  });

  it('returns the deterministic reason when no LLM is configured', async () => {
    const req = payloadFor('dishwasher');
    const res = await explain(req, {});
    expect(res.aiGenerated).toBe(false);
    expect(res.text).toBe(req.recommendation.reason);
  });
});
