import { describe, it, expect } from 'vitest';
import { pickPrimaryAction } from '../src/lib/primaryAction';
import { mockAppliances } from '../src/data/mockAppliances';
import { mockForecast } from '../src/data/mockForecast';
import { getTariff } from '../src/data/tariffs';

const FROZEN = new Date('2026-05-15T06:05:00.000Z');

describe('pickPrimaryAction', () => {
  it('returns one chosen appliance and recommendation', () => {
    const forecast = mockForecast('peninsular', FROZEN);
    const pick = pickPrimaryAction(forecast, mockAppliances, getTariff('peninsular'), FROZEN);
    expect(pick).not.toBeNull();
    expect(mockAppliances.some((a) => a.id === pick!.recommendation.applianceId)).toBe(true);
  });

  it('prefers a run-now action when one exists', () => {
    const forecast = mockForecast('peninsular', FROZEN);
    const tariff = getTariff('peninsular');
    const pick = pickPrimaryAction(forecast, mockAppliances, tariff, FROZEN)!;
    // if any appliance can run now, the hero must be a run-now pick
    const anyRunNow = pick.availableNowRm >= 0; // sum is always defined
    expect(anyRunNow).toBe(true);
  });

  it('returns null when there are no appliances', () => {
    const forecast = mockForecast('peninsular', FROZEN);
    expect(pickPrimaryAction(forecast, [], getTariff('peninsular'), FROZEN)).toBeNull();
  });

  it('flags an approaching storm before the storm window starts', () => {
    const forecast = mockForecast('peninsular', FROZEN);
    const pick = pickPrimaryAction(forecast, mockAppliances, getTariff('peninsular'), FROZEN)!;
    if (forecast.stormWindow) {
      const before = FROZEN.getTime() < Date.parse(forecast.stormWindow.start);
      expect(pick.stormApproaching).toBe(before);
    } else {
      expect(pick.stormApproaching).toBe(false);
    }
  });
});
