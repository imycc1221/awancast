import { describe, it, expect } from 'vitest';
import { toAgentPayload } from '../src/lib/agentPayload';
import { mockForecast } from '../src/data/mockForecast';
import { getTariff } from '../src/data/tariffs';
import type { Recommendation } from '../src/types';

const FROZEN = new Date('2026-05-15T06:05:00.000Z');

describe('toAgentPayload', () => {
  it('grounds the agent on the true scheduler numbers (raw savings + solar value)', () => {
    const rec: Recommendation = {
      applianceId: 'ev',
      action: 'wait',
      windowStart: '2026-05-15T08:20:00.000Z',
      windowEnd: '2026-05-15T10:20:00.000Z',
      savingsRm: 0.5, // the TRUE scheduler value, not the RM 4.00 display floor
      solarValueRm: 0.17,
      reason: 'Waiting is cheaper.',
    };
    const payload = toAgentPayload('EV Charger', rec, mockForecast('peninsular', FROZEN), getTariff('peninsular'));
    expect(payload.recommendation.savingsRm).toBe(0.5);
    expect(payload.recommendation.solarValueRm).toBe(0.17);
    expect(payload.applianceName).toBe('EV Charger');
    expect(payload.tariff.label).toContain('Solar ATAP');
  });
});
