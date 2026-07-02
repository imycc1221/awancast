import { useEffect, useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import type { Appliance, Recommendation } from '../types';
import { catalogIcon } from '../data/applianceCatalog';
import { formatTimeMyt, formatRm } from '../lib/format';
import { ExplainPanel } from './ExplainPanel';
import { useAppStore } from '../state/useAppStore';
import { FEEDBACK_REASONS, type FeedbackAction } from '../data/feedback';
import { useT } from '../lib/i18n';
import type { ExplainRequest } from '../agent/context';

interface Props {
  appliance: Appliance;
  recommendation: Recommendation;
  showDivider?: boolean;
  agentPayload?: ExplainRequest;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ApplianceCard({ appliance, recommendation, showDivider, agentPayload }: Props) {
  const Icon = catalogIcon(appliance.id);
  const isRunNow = recommendation.action === 'run-now';
  const t = useT();

  const addFeedback = useAppStore((s) => s.addFeedback);
  const [done, setDone] = useState<FeedbackAction | null>(null);
  const [askReasonFor, setAskReasonFor] = useState<FeedbackAction | null>(null);

  // Reset the feedback state if the recommendation for this appliance changes (e.g. the clock tick flips
  // run-now to wait), so the "Logged" line can never disagree with the card that is now shown.
  useEffect(() => {
    setDone(null);
    setAskReasonFor(null);
  }, [recommendation.action, recommendation.windowStart]);

  const log = (action: FeedbackAction, reason?: string) => {
    // Log the TRUE scheduler value (agentPayload carries it), never the display-only demo floor,
    // so the cumulative "saved so far" tracker stays honest.
    const trueRec = agentPayload?.recommendation;
    const valueRm = trueRec
      ? trueRec.action === 'run-now'
        ? trueRec.solarValueRm ?? 0
        : trueRec.savingsRm
      : isRunNow
        ? recommendation.solarValueRm ?? 0
        : recommendation.savingsRm;
    addFeedback({
      id: makeId(),
      ts: Date.now(),
      applianceId: appliance.id,
      applianceName: appliance.name,
      action,
      reason,
      recommendedAction: recommendation.action,
      savingsRm: recommendation.savingsRm,
      valueRm,
    });
    setDone(action);
    setAskReasonFor(null);
  };

  return (
    <div className={`py-2.5 ${showDivider ? 'border-t border-hairline' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-nested">
          <Icon className="h-4 w-4 text-ink" strokeWidth={1.6} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold tracking-tight">
              {t(appliance.name)}
            </span>
            <span className={`pill ${isRunNow ? 'pill-run' : 'pill-wait'}`}>
              {isRunNow
                ? t('RUN NOW')
                : t('WAIT {time}', { time: formatTimeMyt(recommendation.windowStart) })}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-ink-muted">
            {isRunNow
              ? t('Good window now, best before {time}', {
                  time: formatTimeMyt(recommendation.windowEnd),
                })
              : t('Best window {a}–{b}', {
                  a: formatTimeMyt(recommendation.windowStart),
                  b: formatTimeMyt(recommendation.windowEnd),
                })}
          </div>
        </div>

        <div className="text-right">
          {(() => {
            const value = isRunNow ? recommendation.solarValueRm ?? 0 : recommendation.savingsRm;
            if (value < 0.01) {
              return <div className="text-[11px] font-medium text-ink-muted">{t('On solar')}</div>;
            }
            return (
              <>
                <div className="tnum text-[15px] font-semibold leading-none">{formatRm(value)}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                  {isRunNow ? t('free solar') : t('saved')}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <div className="pl-11">
        <ExplainPanel explanation={t(recommendation.reason)} agentPayload={agentPayload} />

        {done ? (
          <div className="mt-1.5 text-[11px] text-ink-muted">
            {done === 'accept'
              ? t('Logged: you accepted this.')
              : done === 'reject'
                ? t('Logged: you skipped this.')
                : t('Logged: you rescheduled this.')}
          </div>
        ) : askReasonFor ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-ink-muted">{t('Why?')}</span>
            {FEEDBACK_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => log(askReasonFor, reason)}
                className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink"
              >
                {t(reason)}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => log('accept')}
              className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink"
            >
              <Check className="h-3 w-3" strokeWidth={2} /> {t('Accept')}
            </button>
            <button
              type="button"
              onClick={() => setAskReasonFor('reschedule')}
              className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink"
            >
              <Clock className="h-3 w-3" strokeWidth={2} /> {t('Reschedule')}
            </button>
            <button
              type="button"
              onClick={() => setAskReasonFor('reject')}
              className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink"
            >
              <X className="h-3 w-3" strokeWidth={2} /> {t('Skip')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
