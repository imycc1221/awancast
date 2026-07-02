import { describe, it, expect } from 'vitest';
import { hash32, valueNoise, intensityAt } from '../src/lib/cloudField';
import type { Forecast, Regime } from '../src/types';

describe('hash32', () => {
  it('is deterministic for the same input', () => {
    expect(hash32('2026-05-15T03:37:00Z')).toBe(hash32('2026-05-15T03:37:00Z'));
  });

  it('returns different values for different inputs', () => {
    expect(hash32('a')).not.toBe(hash32('b'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hash32('any string');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('valueNoise', () => {
  it('is deterministic for the same (x, y, seed)', () => {
    expect(valueNoise(1.2, 3.4, 42)).toBe(valueNoise(1.2, 3.4, 42));
  });

  it('returns values in [0, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = (i * 0.731) % 50;
      const y = (i * 1.913) % 50;
      const v = valueNoise(x, y, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('different seeds produce different fields', () => {
    expect(valueNoise(1.2, 3.4, 1)).not.toBe(valueNoise(1.2, 3.4, 2));
  });
});

import { buildColorLUT } from '../src/lib/cloudField';

describe('buildColorLUT', () => {
  it('returns a 1024-byte Uint8ClampedArray (256 RGBA entries)', () => {
    const lut = buildColorLUT('light');
    expect(lut).toBeInstanceOf(Uint8ClampedArray);
    expect(lut.length).toBe(256 * 4);
  });

  it('entry 0 is fully transparent', () => {
    const lut = buildColorLUT('light');
    expect(lut[3]).toBe(0); // alpha at intensity 0
  });

  it('entry 255 has the highest alpha', () => {
    const lut = buildColorLUT('light');
    const top = lut[255 * 4 + 3] ?? 0;
    const mid = lut[128 * 4 + 3] ?? 0;
    expect(top).toBeGreaterThan(mid);
  });

  it('light and dark themes produce different colors', () => {
    const light = buildColorLUT('light');
    const dark = buildColorLUT('dark');
    // Compare the mid-intensity color (index 128, channel R)
    expect(light[128 * 4]).not.toBe(dark[128 * 4]);
  });

  it('alpha at index 255 matches the spec (0.85 * 255 ≈ 217)', () => {
    const lut = buildColorLUT('light');
    expect(lut[255 * 4 + 3]).toBeGreaterThanOrEqual(215);
    expect(lut[255 * 4 + 3]).toBeLessThanOrEqual(219);
  });
});

function fc(regime: Regime, overrides: Partial<Forecast> = {}): Forecast {
  return {
    issuedAt: '2026-05-15T03:37:00Z',
    location: { lat: 3.10, lon: 101.65, name: 'Petaling Jaya' },
    currentKw: 3.8,
    todayKwh: 18.2,
    points: [],
    regime,
    regimeConfidence: 'medium',
    cloudVectors: [],
    ...overrides,
  };
}

describe('intensityAt', () => {
  it('is deterministic for the same (lat, lon, forecast)', () => {
    const f = fc('partial');
    expect(intensityAt(3.10, 101.65, f)).toBe(intensityAt(3.10, 101.65, f));
  });

  it('always returns a value in [0, 1]', () => {
    const f = fc('convective', {
      cloudVectors: [{ from: [3.05, 101.60], to: [3.20, 101.80] }],
    });
    for (let i = 0; i < 1000; i++) {
      const lat = 1 + Math.random() * 6;   // Malaysia lat range ≈ 1–7
      const lon = 99 + Math.random() * 21; // Malaysia lon range ≈ 99–120
      const v = intensityAt(lat, lon, f);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('regime monotonicity: stable < partial < convective < severe on average', () => {
    const samples = (regime: Regime) => {
      const f = fc(regime);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
          sum += intensityAt(3.0 + i * 0.05, 101.5 + j * 0.05, f);
          n++;
        }
      }
      return sum / n;
    };
    const s = samples('stable');
    const p = samples('partial');
    const c = samples('convective');
    const v = samples('severe');
    expect(s).toBeLessThan(p);
    expect(p).toBeLessThan(c);
    expect(c).toBeLessThan(v);
  });

  it('cloud-vector bump: mean intensity along a vector exceeds 0.5° away', () => {
    const f = fc('partial', {
      cloudVectors: [{ from: [3.10, 101.65], to: [3.25, 101.85] }],
    });
    // Sample 5 evenly-spaced points along the vector and 5 points 0.5° south of them.
    let onSum = 0;
    let offSum = 0;
    for (let i = 0; i < 5; i++) {
      const t = i / 4;                       // 0, 0.25, 0.5, 0.75, 1
      const lat = 3.10 + (3.25 - 3.10) * t;
      const lon = 101.65 + (101.85 - 101.65) * t;
      onSum  += intensityAt(lat,        lon, f);
      offSum += intensityAt(lat - 0.5,  lon, f);
    }
    expect(onSum / 5).toBeGreaterThan(offSum / 5);
  });

  it('different issuedAt produces different fields (seed wiring)', () => {
    const f1 = fc('partial', { issuedAt: '2026-05-15T03:37:00Z' });
    const f2 = fc('partial', { issuedAt: '2026-05-15T04:37:00Z' });
    expect(intensityAt(3.10, 101.65, f1)).not.toBe(intensityAt(3.10, 101.65, f2));
  });
});
