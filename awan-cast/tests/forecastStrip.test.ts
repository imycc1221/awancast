import { describe, it, expect } from 'vitest';
import { buildForecastStrip } from '../src/lib/forecastStrip';
import { mockForecast } from '../src/data/mockForecast';

const FROZEN = new Date('2026-05-15T06:05:00.000Z');

describe('buildForecastStrip', () => {
  it('returns up to five steps, the first labelled Now', () => {
    const steps = buildForecastStrip(mockForecast('sabah', FROZEN), FROZEN);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(5);
    expect(steps[0]!.isNow).toBe(true);
    expect(steps[0]!.timeLabel).toBe('Now');
  });

  it('shows strong sun with full signal dots on a clear high-confidence day (Sabah)', () => {
    const steps = buildForecastStrip(mockForecast('sabah', FROZEN), FROZEN);
    expect(steps[0]!.glyph).toBe('sun');
    expect(steps[0]!.sureness).toBe(3); // tight band -> full dots
    expect(steps[0]!.confidenceWord).toBe('High confidence');
  });

  it('gives a storm step fewer dots than now (Peninsular)', () => {
    const steps = buildForecastStrip(mockForecast('peninsular', FROZEN), FROZEN);
    const storm = steps.find((s) => s.glyph === 'storm');
    expect(storm).toBeDefined();
    expect(storm!.sureness).toBeLessThan(steps[0]!.sureness);
    expect(['Fair confidence', 'Low confidence']).toContain(storm!.confidenceWord);
  });

  it('returns an empty strip when there are no points', () => {
    const f = mockForecast('sabah', FROZEN);
    expect(buildForecastStrip({ ...f, points: [] }, FROZEN)).toEqual([]);
  });
});
