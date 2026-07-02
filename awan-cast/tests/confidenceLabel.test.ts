import { describe, it, expect } from 'vitest';
import { confidenceLabel, confidenceToneClass } from '../src/lib/confidenceLabel';
import type { Confidence, Regime } from '../src/types';

describe('confidenceLabel ladder', () => {
  const cases: Array<[Regime, Confidence, string, string]> = [
    ['stable', 'high', 'High confidence', 'high'],
    ['stable', 'medium', 'Good confidence', 'good'],
    ['stable', 'low', 'Good confidence', 'good'],
    ['partial', 'high', 'Good confidence', 'good'],
    ['partial', 'medium', 'Good confidence', 'good'],
    ['partial', 'low', 'Fair confidence', 'fair'],
    ['convective', 'high', 'Fair confidence', 'fair'],
    ['convective', 'medium', 'Fair confidence', 'fair'],
    ['convective', 'low', 'Low confidence', 'low'],
    ['severe', 'high', 'Low confidence', 'low'],
    ['severe', 'medium', 'Low confidence', 'low'],
    ['severe', 'low', 'Low confidence', 'low'],
  ];

  it.each(cases)('maps %s + %s to "%s" (%s)', (regime, confidence, word, tone) => {
    const result = confidenceLabel(regime, confidence);
    expect(result.word).toBe(word);
    expect(result.tone).toBe(tone);
  });

  it('only ever produces the four ladder words', () => {
    const allowed = new Set(['High confidence', 'Good confidence', 'Fair confidence', 'Low confidence']);
    const regimes: Regime[] = ['stable', 'partial', 'convective', 'severe'];
    const confs: Confidence[] = ['high', 'medium', 'low'];
    for (const r of regimes) {
      for (const c of confs) {
        expect(allowed.has(confidenceLabel(r, c).word)).toBe(true);
      }
    }
  });

  it('every tone has a colour class', () => {
    for (const tone of ['high', 'good', 'fair', 'low'] as const) {
      expect(confidenceToneClass[tone]).toMatch(/var\(--/);
    }
  });
});
