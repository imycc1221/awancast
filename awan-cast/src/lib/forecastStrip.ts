import type { Forecast } from '../types';
import { formatTimeMyt } from './format';
import type { ConfidenceWord } from './confidenceLabel';

export type StripGlyph = 'sun' | 'cloudSun' | 'cloud' | 'storm';

export interface StripStep {
  key: string;
  timeLabel: string;
  glyph: StripGlyph;
  label: string;
  /** Filled signal dots, 0–3: more dots = more certain (narrower forecast band). */
  sureness: 0 | 1 | 2 | 3;
  /** The matching four-word ladder term, for tooltips and screen readers. */
  confidenceWord: ConfidenceWord;
  isNow: boolean;
}

const MAX_STEPS = 5;

// Band width relative to the day's peak -> signal-dot level. Mirrors the four-word ladder.
function surenessOf(uncertainty: number): 0 | 1 | 2 | 3 {
  if (uncertainty < 0.12) return 3;
  if (uncertainty < 0.25) return 2;
  if (uncertainty < 0.5) return 1;
  return 0;
}

const SURENESS_WORD: Record<0 | 1 | 2 | 3, ConfidenceWord> = {
  3: 'High confidence',
  2: 'Good confidence',
  1: 'Fair confidence',
  0: 'Low confidence',
};

/**
 * Turn the kW forecast into a plain-language sun/cloud strip for the home screen. Strength of solar maps to
 * a sun/cloud glyph and a plain word; the forecast band width maps to icon sharpness, so honestly widening
 * uncertainty during storms reads as a blurrier icon, with no numbers shown. Pure and deterministic.
 */
export function buildForecastStrip(forecast: Forecast, now: Date): StripStep[] {
  const pts = forecast.points;
  if (pts.length === 0) return [];

  const nowMs = now.getTime();
  const peak = Math.max(...pts.map((p) => p.kw), 0.1);
  const future = pts.filter((p) => Date.parse(p.t) >= nowMs - 60_000);
  const source = future.length >= 2 ? future : pts.slice(-MAX_STEPS);

  const stormStart = forecast.stormWindow ? Date.parse(forecast.stormWindow.start) : null;
  const stormEnd = forecast.stormWindow ? Date.parse(forecast.stormWindow.end) : null;

  const n = Math.min(MAX_STEPS, source.length);
  const steps: StripStep[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (source.length - 1)) / Math.max(1, n - 1));
    const p = source[idx]!;
    const tMs = Date.parse(p.t);
    const strength = Math.max(0, Math.min(1, p.kw / peak));
    const uncertainty = Math.max(0, (p.kwHigh - p.kwLow) / peak);
    const inStorm = stormStart !== null && stormEnd !== null && tMs >= stormStart && tMs <= stormEnd;

    let glyph: StripGlyph;
    let label: string;
    if (inStorm) {
      glyph = 'storm';
      label = 'Storm';
    } else if (strength < 0.3) {
      glyph = 'cloud';
      label = 'Very cloudy';
    } else if (strength < 0.55) {
      glyph = 'cloud';
      label = 'Cloudy';
    } else if (strength < 0.8) {
      glyph = 'cloudSun';
      label = 'Some sun';
    } else {
      glyph = 'sun';
      label = 'Strong sun';
    }

    const isNow = i === 0;
    const sureness = surenessOf(uncertainty);
    steps.push({
      key: p.t,
      timeLabel: isNow ? 'Now' : formatTimeMyt(p.t),
      glyph,
      label,
      sureness,
      confidenceWord: SURENESS_WORD[sureness],
      isNow,
    });
  }
  return steps;
}
