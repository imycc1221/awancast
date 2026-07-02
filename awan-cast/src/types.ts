export type Region = 'peninsular' | 'sarawak' | 'sabah';

export type Regime = 'stable' | 'partial' | 'convective' | 'severe';

export type Confidence = 'high' | 'medium' | 'low';

export type ApplianceIconKey =
  | 'washer'
  | 'dishwasher'
  | 'ev'
  | 'ac'
  | 'pool'
  | 'waterheater';

export interface ForecastPoint {
  t: string;
  kw: number;
  kwLow: number;
  kwHigh: number;
}

export interface CloudVector {
  from: [number, number];
  to: [number, number];
}

export interface Forecast {
  issuedAt: string;
  location: { lat: number; lon: number; name: string };
  currentKw: number;
  todayKwh: number;
  points: ForecastPoint[];
  regime: Regime;
  regimeConfidence: Confidence;
  stormWindow?: { start: string; end: string };
  cloudVectors: CloudVector[];
}

export interface Appliance {
  id: string;
  name: string;
  /** Catalogue key used to resolve the appliance's icon. */
  iconKey: string;
  kwDraw: number;
  durationMin: number;
  flexibilityHrs: number;
}

export interface Recommendation {
  applianceId: string;
  action: 'run-now' | 'wait';
  windowStart: string;
  windowEnd: string;
  savingsRm: number;
  /** Value of the free solar this appliance uses in its recommended window (self-consumption advantage). */
  solarValueRm?: number;
  reason: string;
}

export interface TariffTier {
  tierMaxKwh: number;
  rateRm: number;
}

export interface TariffConfig {
  region: Region;
  retailRatesKwh: TariffTier[];
  exportRateRm: number | null;
  exportAllowed: boolean;
  label: string;
  notes: string;
}

export type ReplayScenarioId = 'peninsular-storm' | 'sarawak-partial' | 'sabah-clear';

export interface ReplayScenario {
  id: ReplayScenarioId;
  title: string;
  region: Region;
  description: string;
  forecast: Forecast;
  startTime: string;
  endTime: string;
}
