import type { Region } from '../types';

/** Share of the home's current demand covered by solar, 0–100. The identity number. */
export function sunshineNowPct(solarKw: number, demandKw: number): number {
  if (demandKw <= 0.01) return 100;
  return Math.round(100 * Math.min(1, Math.max(0, solarKw) / demandKw));
}

export interface SystemCheckResult {
  /** Percent of weather-expected production actually measured this week. */
  pctOfExpected: number;
  healthy: boolean;
  expectedKwhWeek: number;
}

// DEMO meter readings (no real inverter connected yet). Peninsular/Sarawak show the healthy state;
// Sabah shows the underperformance alert so both states are demoable. Clearly labelled in the UI.
const DEMO_PERFORMANCE: Record<Region, number> = {
  peninsular: 0.97,
  sarawak: 0.95,
  sabah: 0.82,
};

/** Weekly production vs what the weather allowed, for a system of this size (~4.2 kWh/kWp/day typical MY yield). */
export function systemCheck(solarKwp: number, region: Region): SystemCheckResult {
  const expectedKwhWeek = Math.round(solarKwp * 4.2 * 7);
  const ratio = DEMO_PERFORMANCE[region];
  return {
    expectedKwhWeek,
    pctOfExpected: Math.round(ratio * 100),
    healthy: ratio >= 0.9,
  };
}

export const REGION_CITY: Record<Region, string> = {
  peninsular: 'Petaling Jaya',
  sarawak: 'Kuching',
  sabah: 'Kota Kinabalu',
};

// DEMO monthly identity stats (an example month until real data accumulates). Labelled in the UI.
const DEMO_MONTH_PCT: Record<Region, number> = { peninsular: 62, sarawak: 58, sabah: 71 };
const DEMO_RANK: Record<Region, string> = { peninsular: 'top 10%', sarawak: 'top 25%', sabah: 'top 5%' };

export interface MonthlyShowcase {
  pct: number;
  rank: string;
  city: string;
  shareText: string;
}

export function monthlyShowcase(region: Region): MonthlyShowcase {
  const pct = DEMO_MONTH_PCT[region];
  const city = REGION_CITY[region];
  return {
    pct,
    rank: DEMO_RANK[region],
    city,
    shareText: `My home ran ${pct}% on sunshine this month in ${city} — tracked with Awan-Cast.`,
  };
}
