import { describe, it, expect } from 'vitest';
import { buildStormAlert, joinNames } from '../src/lib/stormAlert';
import { mockAppliances } from '../src/data/mockAppliances';
import { mockForecast } from '../src/data/mockForecast';
import { getTariff } from '../src/data/tariffs';

const FROZEN = new Date('2026-05-15T06:05:00.000Z');

describe('joinNames', () => {
  it('formats lists naturally', () => {
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A and B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('buildStormAlert', () => {
  it('builds an alert before the Peninsular storm', () => {
    const alert = buildStormAlert(
      mockForecast('peninsular', FROZEN),
      mockAppliances,
      getTariff('peninsular'),
      FROZEN,
    );
    expect(alert).not.toBeNull();
    expect(alert!.durationMin).toBe(44);
    expect(alert!.confidenceWord).toBe('Good confidence');
    expect(alert!.runNowNames.length > 0 || alert!.holdName).toBeTruthy();
  });

  it('returns null when there is no storm window (Sabah)', () => {
    const alert = buildStormAlert(
      mockForecast('sabah', FROZEN),
      mockAppliances,
      getTariff('sabah'),
      FROZEN,
    );
    expect(alert).toBeNull();
  });

  it('returns null once the storm has started', () => {
    const afterStart = new Date(FROZEN.getTime() + 100 * 60_000);
    const alert = buildStormAlert(
      mockForecast('peninsular', FROZEN),
      mockAppliances,
      getTariff('peninsular'),
      afterStart,
    );
    expect(alert).toBeNull();
  });
});
