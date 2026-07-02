import type { Regime, Confidence } from '../types';

/**
 * The deterministic four-word confidence ladder shared by the UI and the (future) explanation agent.
 * The whole product uses ONLY these four phrases so the vocabulary is identical everywhere. The mapping
 * is pure and rule-based, never produced by an LLM. See awan-cast-agent-spec.md section 5.
 */
export type ConfidenceWord =
  | 'High confidence'
  | 'Good confidence'
  | 'Fair confidence'
  | 'Low confidence';

export type ConfidenceTone = 'high' | 'good' | 'fair' | 'low';

export interface ConfidenceLabel {
  word: ConfidenceWord;
  tone: ConfidenceTone;
}

export function confidenceLabel(regime: Regime, confidence: Confidence): ConfidenceLabel {
  if (regime === 'severe') return { word: 'Low confidence', tone: 'low' };
  if (regime === 'convective') {
    return confidence === 'low'
      ? { word: 'Low confidence', tone: 'low' }
      : { word: 'Fair confidence', tone: 'fair' };
  }
  if (regime === 'partial') {
    return confidence === 'low'
      ? { word: 'Fair confidence', tone: 'fair' }
      : { word: 'Good confidence', tone: 'good' };
  }
  // stable
  return confidence === 'high'
    ? { word: 'High confidence', tone: 'high' }
    : { word: 'Good confidence', tone: 'good' };
}

/** Map a tone to a text-colour utility using the app's CSS variables. */
export const confidenceToneClass: Record<ConfidenceTone, string> = {
  high: 'text-[color:var(--success)]',
  good: 'text-[color:var(--accent)]',
  fair: 'text-[color:var(--warn)]',
  low: 'text-[color:var(--danger)]',
};
