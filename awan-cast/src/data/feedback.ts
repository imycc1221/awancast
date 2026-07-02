export type FeedbackAction = 'accept' | 'reject' | 'reschedule';

export interface FeedbackEntry {
  id: string;
  ts: number;
  applianceId: string;
  applianceName: string;
  action: FeedbackAction;
  reason?: string;
  recommendedAction: 'run-now' | 'wait';
  savingsRm: number;
  /** TRUE scheduler value of the advice at log time (free-solar worth for run-now, savings for wait).
   *  Never the display-only demo floor, so the cumulative tracker stays honest. */
  valueRm?: number;
}

export const FEEDBACK_REASONS = [
  'too noisy',
  'not home',
  'prefer later',
  'cost concern',
  'other',
] as const;

/** Share of recommendations the user did not accept. The honest deployment metric. */
export function overrideRate(entries: FeedbackEntry[]): number {
  if (entries.length === 0) return 0;
  const overrides = entries.filter((e) => e.action !== 'accept').length;
  return Number((overrides / entries.length).toFixed(2));
}

/** Estimated ringgit value of the advice the user accepted — their personal proof it works. */
export function acceptedValueRm(entries: FeedbackEntry[]): number {
  const total = entries
    .filter((e) => e.action === 'accept')
    .reduce((sum, e) => sum + Math.max(0, e.valueRm ?? e.savingsRm ?? 0), 0);
  return Number(total.toFixed(2));
}
