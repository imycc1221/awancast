import { describe, it, expect } from 'vitest';
import { recommend, retailRate } from '../src/data/scheduler';
import { mockAppliances } from '../src/data/mockAppliances';
import { mockForecast } from '../src/data/mockForecast';
import { getTariff } from '../src/data/tariffs';
import type { TariffConfig } from '../src/types';

const FROZEN = new Date('2026-05-15T06:05:00.000Z');

describe('scheduler', () => {
  it('returns one recommendation per appliance', () => {
    const forecast = mockForecast('peninsular', FROZEN);
    const tariff = getTariff('peninsular');
    const recs = recommend(forecast, mockAppliances, tariff, FROZEN);
    expect(recs).toHaveLength(mockAppliances.length);
  });

  it('every recommendation references a real appliance', () => {
    const forecast = mockForecast('peninsular', FROZEN);
    const tariff = getTariff('peninsular');
    const recs = recommend(forecast, mockAppliances, tariff, FROZEN);
    const ids = new Set(mockAppliances.map((a) => a.id));
    for (const r of recs) expect(ids.has(r.applianceId)).toBe(true);
  });

  it('Peninsular: EV charger waits past the storm window', () => {
    const forecast = mockForecast('peninsular', FROZEN);
    const tariff = getTariff('peninsular');
    const recs = recommend(forecast, mockAppliances, tariff, FROZEN);
    const ev = recs.find((r) => r.applianceId === 'ev');
    expect(ev).toBeDefined();
    expect(ev!.action).toBe('wait');
  });

  it('Sabah SELCO: scheduler still produces recommendations with export disabled', () => {
    const forecast = mockForecast('sabah', FROZEN);
    const tariff = getTariff('sabah');
    expect(tariff.exportAllowed).toBe(false);
    const recs = recommend(forecast, mockAppliances, tariff, FROZEN);
    for (const r of recs) expect(['run-now', 'wait']).toContain(r.action);
  });

  it('savings are always non-negative', () => {
    for (const region of ['peninsular', 'sarawak', 'sabah'] as const) {
      const forecast = mockForecast(region, FROZEN);
      const tariff = getTariff(region);
      const recs = recommend(forecast, mockAppliances, tariff, FROZEN);
      for (const r of recs) expect(r.savingsRm).toBeGreaterThanOrEqual(0);
    }
  });

  it('solar value is honest by scheme: Sabah > Peninsular > Sarawak (~0)', () => {
    const total = (region: 'peninsular' | 'sarawak' | 'sabah') => {
      const recs = recommend(mockForecast(region, FROZEN), mockAppliances, getTariff(region), FROZEN);
      return recs.reduce((s, r) => s + (r.solarValueRm ?? 0), 0);
    };
    const pen = total('peninsular');
    const swk = total('sarawak');
    const sbh = total('sabah');
    expect(swk).toBeCloseTo(0, 2); // 1:1 export means timing has no value
    expect(sbh).toBeGreaterThan(pen); // no export -> self-consumption worth full retail
    expect(pen).toBeGreaterThan(swk);
  });

  it('Sarawak 1:1 export: timing honestly saves nothing (all savings exactly zero)', () => {
    const forecast = mockForecast('sarawak', FROZEN);
    const tariff = getTariff('sarawak');
    expect(tariff.exportRateRm).toBe(tariff.retailRatesKwh[0]!.rateRm); // 1:1 scheme
    const recs = recommend(forecast, mockAppliances, tariff, FROZEN);
    for (const r of recs) expect(r.savingsRm).toBe(0);
  });

  it('never claims savings from a window that starts after the forecast horizon (no night solar)', () => {
    for (const region of ['peninsular', 'sarawak', 'sabah'] as const) {
      const forecast = mockForecast(region, FROZEN);
      const horizonMs = Date.parse(forecast.points[forecast.points.length - 1]!.t);
      const recs = recommend(forecast, mockAppliances, getTariff(region), FROZEN);
      for (const r of recs) {
        if (r.savingsRm > 0) {
          expect(Date.parse(r.windowStart)).toBeLessThan(horizonMs);
        }
      }
    }
  });

  it('retailRate returns the first tier whose cumulative cap covers the usage', () => {
    const banded: TariffConfig = {
      region: 'peninsular',
      retailRatesKwh: [
        { tierMaxKwh: 200, rateRm: 0.22 },
        { tierMaxKwh: Infinity, rateRm: 0.44 },
      ],
      exportRateRm: 0.16,
      exportAllowed: true,
      label: 'test',
      notes: 'test',
    };
    expect(retailRate(banded, 150)).toBe(0.22);
    expect(retailRate(banded, 300)).toBe(0.44);
  });

  it('windowEnd is always after windowStart', () => {
    const forecast = mockForecast('peninsular', FROZEN);
    const tariff = getTariff('peninsular');
    const recs = recommend(forecast, mockAppliances, tariff, FROZEN);
    for (const r of recs) {
      expect(Date.parse(r.windowEnd)).toBeGreaterThan(Date.parse(r.windowStart));
    }
  });

  it('action is run-now when chosen window is within the next quarter hour', () => {
    const forecast = mockForecast('sabah', FROZEN);
    const tariff = getTariff('sabah');
    const recs = recommend(forecast, mockAppliances, tariff, FROZEN);
    const runs = recs.filter((r) => r.action === 'run-now');
    expect(runs.length).toBeGreaterThan(0);
  });
});
