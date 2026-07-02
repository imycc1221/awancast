import type { Forecast, ForecastPoint, Region } from '../types';
import { demoNow } from '../lib/demoClock';

const REGION_LOCATIONS: Record<Region, { lat: number; lon: number; name: string }> = {
  peninsular: { lat: 3.1078, lon: 101.6064, name: 'Petaling Jaya' },
  sarawak: { lat: 1.5533, lon: 110.3592, name: 'Kuching' },
  sabah: { lat: 5.9804, lon: 116.0735, name: 'Kota Kinabalu' },
};

interface KwSample {
  minutesFromNow: number;
  kw: number;
}

// Demo-tuned Peninsular curve: sharp pre-storm peak ~+15min, cliff drop at +25min,
// deep trough +40 to +65min, full recovery by +90min. Drives a punchy on-screen
// "storm window" arc that lands inside a 3-minute video.
const PENINSULAR_STORM_CURVE: KwSample[] = [
  { minutesFromNow: 0, kw: 3.8 },
  { minutesFromNow: 5, kw: 3.85 },
  { minutesFromNow: 10, kw: 3.9 },
  { minutesFromNow: 15, kw: 4.0 },
  { minutesFromNow: 20, kw: 3.95 },
  { minutesFromNow: 25, kw: 3.6 },
  { minutesFromNow: 30, kw: 2.5 },
  { minutesFromNow: 35, kw: 1.0 },
  { minutesFromNow: 40, kw: 0.5 },
  { minutesFromNow: 45, kw: 0.4 },
  { minutesFromNow: 50, kw: 0.4 },
  { minutesFromNow: 55, kw: 0.4 },
  { minutesFromNow: 60, kw: 0.5 },
  { minutesFromNow: 65, kw: 0.7 },
  { minutesFromNow: 70, kw: 1.2 },
  { minutesFromNow: 75, kw: 2.0 },
  { minutesFromNow: 80, kw: 2.6 },
  { minutesFromNow: 85, kw: 3.1 },
  { minutesFromNow: 90, kw: 3.4 },
  { minutesFromNow: 95, kw: 3.5 },
  { minutesFromNow: 100, kw: 3.5 },
  { minutesFromNow: 105, kw: 3.4 },
  { minutesFromNow: 110, kw: 3.3 },
  { minutesFromNow: 115, kw: 3.2 },
  { minutesFromNow: 120, kw: 3.0 },
];

const SARAWAK_PARTIAL_CURVE: KwSample[] = [
  { minutesFromNow: 0, kw: 2.9 },
  { minutesFromNow: 15, kw: 3.1 },
  { minutesFromNow: 30, kw: 2.6 },
  { minutesFromNow: 45, kw: 2.4 },
  { minutesFromNow: 60, kw: 2.8 },
  { minutesFromNow: 75, kw: 3.2 },
  { minutesFromNow: 90, kw: 3.0 },
  { minutesFromNow: 105, kw: 2.6 },
  { minutesFromNow: 120, kw: 2.4 },
];

const SABAH_CLEAR_CURVE: KwSample[] = [
  { minutesFromNow: 0, kw: 4.7 },
  { minutesFromNow: 15, kw: 4.8 },
  { minutesFromNow: 30, kw: 4.85 },
  { minutesFromNow: 45, kw: 4.85 },
  { minutesFromNow: 60, kw: 4.8 },
  { minutesFromNow: 75, kw: 4.7 },
  { minutesFromNow: 90, kw: 4.5 },
  { minutesFromNow: 105, kw: 4.3 },
  { minutesFromNow: 120, kw: 4.1 },
];

function interpolate(samples: KwSample[], minutesFromNow: number): number {
  if (minutesFromNow <= samples[0]!.minutesFromNow) return samples[0]!.kw;
  const last = samples[samples.length - 1]!;
  if (minutesFromNow >= last.minutesFromNow) return last.kw;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (minutesFromNow <= b.minutesFromNow) {
      const ratio = (minutesFromNow - a.minutesFromNow) / (b.minutesFromNow - a.minutesFromNow);
      return a.kw + ratio * (b.kw - a.kw);
    }
  }
  return last.kw;
}

function bandWidth(minutesFromNow: number, region: Region): number {
  if (region === 'peninsular') {
    // Aligned with the demo storm window (+28 to +72 min): tight pre-storm,
    // widening as confidence drops into the convective valley, recovering after.
    if (minutesFromNow < 25) return 0.25;
    if (minutesFromNow < 30) return 0.5;
    if (minutesFromNow < 70) return 1.4;
    if (minutesFromNow < 85) return 0.8;
    return 0.4;
  }
  if (region === 'sarawak') return 0.4;
  return 0.2;
}

function buildPoints(
  samples: KwSample[],
  region: Region,
  issuedAtMs: number,
): ForecastPoint[] {
  const stepMin = 5;
  const points: ForecastPoint[] = [];
  for (let m = 0; m <= 120; m += stepMin) {
    const kw = Number(interpolate(samples, m).toFixed(2));
    const band = bandWidth(m, region);
    points.push({
      t: new Date(issuedAtMs + m * 60_000).toISOString(),
      kw,
      kwLow: Math.max(0, Number((kw - band).toFixed(2))),
      kwHigh: Number((kw + band).toFixed(2)),
    });
  }
  return points;
}

export function mockForecast(region: Region, issuedAt?: Date): Forecast {
  const issued = issuedAt ?? demoNow();
  const issuedMs = issued.getTime();
  const location = REGION_LOCATIONS[region];

  if (region === 'peninsular') {
    const points = buildPoints(PENINSULAR_STORM_CURVE, region, issuedMs);
    return {
      issuedAt: issued.toISOString(),
      location,
      currentKw: 3.8,
      todayKwh: 18.2,
      points,
      regime: 'partial',
      regimeConfidence: 'medium',
      stormWindow: {
        start: new Date(issuedMs + 28 * 60_000).toISOString(),
        end: new Date(issuedMs + 72 * 60_000).toISOString(),
      },
      // Five vectors converging on PJ from the NW — visible cloud-motion story
      // on the map during the demo's storm-approach moment.
      cloudVectors: [
        { from: [3.35, 101.42], to: [3.18, 101.58] },
        { from: [3.40, 101.38], to: [3.20, 101.55] },
        { from: [3.28, 101.45], to: [3.12, 101.60] },
        { from: [3.42, 101.50], to: [3.22, 101.62] },
        { from: [3.32, 101.40], to: [3.15, 101.58] },
      ],
    };
  }

  if (region === 'sarawak') {
    const points = buildPoints(SARAWAK_PARTIAL_CURVE, region, issuedMs);
    return {
      issuedAt: issued.toISOString(),
      location,
      currentKw: 2.9,
      todayKwh: 14.5,
      points,
      regime: 'partial',
      regimeConfidence: 'medium',
      cloudVectors: [
        { from: [1.65, 110.25], to: [1.55, 110.36] },
        { from: [1.6, 110.3], to: [1.5, 110.4] },
        { from: [1.7, 110.20], to: [1.58, 110.32] },
      ],
    };
  }

  // Sabah: clear stable regime gives the strongest visual contrast vs the
  // peninsular storm. Punchier hero numbers for the demo cross-Malaysia tour.
  const points = buildPoints(SABAH_CLEAR_CURVE, region, issuedMs);
  return {
    issuedAt: issued.toISOString(),
    location,
    currentKw: 4.7,
    todayKwh: 24.8,
    points,
    regime: 'stable',
    regimeConfidence: 'high',
    cloudVectors: [],
  };
}
