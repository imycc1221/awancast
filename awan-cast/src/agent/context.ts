import type { Regime, Confidence } from '../types';
import { formatRm, formatTimeMyt } from '../lib/format';
import { confidenceLabel } from '../lib/confidenceLabel';

/** The request the client posts to /agent/explain. All numbers come from the deterministic scheduler. */
export interface ExplainRequest {
  question?: string;
  applianceName: string;
  recommendation: {
    action: 'run-now' | 'wait';
    windowStart: string;
    windowEnd: string;
    savingsRm: number;
    /** Free-solar value shown on run-now cards (grounds the "RM x free solar" number for the LLM). */
    solarValueRm?: number;
    reason: string;
  };
  forecast: {
    regime: Regime;
    regimeConfidence: Confidence;
    currentKw: number;
    todayKwh: number;
    stormWindow?: { start: string; end: string };
  };
  tariff: { label: string; exportAllowed: boolean };
}

/** The set of values an explanation is allowed to state (anything else is an invented number). */
export interface AgentAllowed {
  rm: Set<string>;
  confidenceWord: string;
  times: Set<string>;
}

export interface AgentContext {
  promptContext: string;
  allowed: AgentAllowed;
  deterministicReason: string;
}

/**
 * Build the grounded context for the explanation agent from the deterministic recommendation. Produces the
 * prompt context AND the allow-list the validator uses, so the LLM can never introduce a new number.
 */
export function buildContext(req: ExplainRequest): AgentContext {
  const r = req.recommendation;
  const conf = confidenceLabel(req.forecast.regime, req.forecast.regimeConfidence);

  const solarValueRm = r.solarValueRm ?? 0;
  const rm = new Set<string>([
    formatRm(r.savingsRm),
    formatRm(Math.abs(r.savingsRm)),
    formatRm(solarValueRm),
  ]);
  const times = new Set<string>([formatTimeMyt(r.windowStart), formatTimeMyt(r.windowEnd)]);
  if (req.forecast.stormWindow) {
    times.add(formatTimeMyt(req.forecast.stormWindow.start));
    times.add(formatTimeMyt(req.forecast.stormWindow.end));
  }

  const action =
    r.action === 'run-now' ? 'run now' : `wait until ${formatTimeMyt(r.windowStart)}`;
  const savingLine =
    r.action === 'run-now'
      ? solarValueRm > 0
        ? `Running now uses about ${formatRm(solarValueRm)} of free solar (value over exporting then importing).`
        : 'Running now uses your own solar; on this tariff the timing does not change the bill much.'
      : r.savingsRm > 0
        ? `Waiting saves about ${formatRm(r.savingsRm)} today.`
        : 'There is no extra saving from changing the timing right now.';
  const stormLine = req.forecast.stormWindow
    ? `A cloudy or storm spell is expected ${formatTimeMyt(req.forecast.stormWindow.start)} to ${formatTimeMyt(req.forecast.stormWindow.end)}.`
    : 'No storm spell is expected in the next two hours.';

  const promptContext = [
    `Appliance: ${req.applianceName}.`,
    `Recommendation from the optimiser: ${action}.`,
    `Best window: ${formatTimeMyt(r.windowStart)} to ${formatTimeMyt(r.windowEnd)}.`,
    savingLine,
    `Certainty: ${conf.word}.`,
    stormLine,
    `Tariff: ${req.tariff.label}. Export of extra solar allowed: ${req.tariff.exportAllowed ? 'yes' : 'no'}.`,
  ].join(' ');

  return {
    promptContext,
    allowed: { rm, confidenceWord: conf.word, times },
    deterministicReason: r.reason,
  };
}
