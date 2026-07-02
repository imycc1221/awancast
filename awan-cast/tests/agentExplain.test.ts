import { describe, it, expect } from 'vitest';
import { explain, type LlmCaller } from '../src/agent/explain';
import { buildContext, type ExplainRequest } from '../src/agent/context';

const req: ExplainRequest = {
  applianceName: 'EV Charger',
  recommendation: {
    action: 'wait',
    windowStart: '2026-05-15T08:20:00.000Z',
    windowEnd: '2026-05-15T10:20:00.000Z',
    savingsRm: 2.3,
    reason: 'Generation will be higher and cheaper in this window, so waiting saves the most.',
  },
  forecast: {
    regime: 'partial',
    regimeConfidence: 'medium',
    currentKw: 3.8,
    todayKwh: 18.2,
    stormWindow: undefined,
  },
  tariff: { label: 'Solar ATAP · Peninsular', exportAllowed: true },
};

describe('explain orchestrator', () => {
  it('falls back to the deterministic reason when there is no LLM', async () => {
    const res = await explain(req, {});
    expect(res.aiGenerated).toBe(false);
    expect(res.text).toBe(req.recommendation.reason);
  });

  it('uses validated LLM text when the LLM returns a clean, grounded answer', async () => {
    const goodSaving = `RM ${req.recommendation.savingsRm.toFixed(2)}`;
    const callLlm: LlmCaller = async () =>
      `There is more sun a bit later, so waiting uses your own power and saves about ${goodSaving} today. We are at Good confidence about this.`;
    const res = await explain(req, { callLlm });
    expect(res.aiGenerated).toBe(true);
    expect(res.text).toMatch(/waiting/);
  });

  it('falls back when the LLM invents a number', async () => {
    const callLlm: LlmCaller = async () => 'Waiting saves about RM 99.00 today.';
    const res = await explain(req, { callLlm });
    expect(res.aiGenerated).toBe(false);
    expect(res.text).toBe(req.recommendation.reason);
  });

  it('falls back when the LLM throws', async () => {
    const callLlm: LlmCaller = async () => {
      throw new Error('network');
    };
    const res = await explain(req, { callLlm });
    expect(res.aiGenerated).toBe(false);
  });

  it('builds an allow-list that contains the deterministic saving', () => {
    const ctx = buildContext(req);
    expect(ctx.allowed.rm.has('RM 2.30')).toBe(true);
    expect(ctx.allowed.confidenceWord).toBe('Good confidence');
  });

  it('grounds the run-now free-solar value in the allow-list and prompt', () => {
    const ctx = buildContext({
      applianceName: 'Dishwasher',
      recommendation: {
        action: 'run-now',
        windowStart: '2026-05-15T06:05:00.000Z',
        windowEnd: '2026-05-15T06:25:00.000Z',
        savingsRm: 0,
        solarValueRm: 0.17,
        reason: 'Uses free solar now.',
      },
      forecast: { regime: 'stable', regimeConfidence: 'high', currentKw: 4, todayKwh: 20 },
      tariff: { label: 'SELCO-PV · Sabah', exportAllowed: false },
    });
    expect(ctx.allowed.rm.has('RM 0.17')).toBe(true);
    expect(ctx.promptContext).toMatch(/free solar/i);
  });
});
