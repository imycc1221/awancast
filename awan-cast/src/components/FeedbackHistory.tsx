import { Panel } from './Panel';
import { useAppStore } from '../state/useAppStore';
import { overrideRate, acceptedValueRm } from '../data/feedback';
import { formatRm, formatTimeMyt } from '../lib/format';
import { useT } from '../lib/i18n';

/**
 * A visible log of the user's responses to recommendations, plus the override rate — the honest
 * deployment metric that goes beyond forecast accuracy. Learning from these overrides is scoped as
 * deployment-phase work; here we demonstrate the capture.
 */
export function FeedbackHistory() {
  const feedback = useAppStore((s) => s.feedback);
  const t = useT();
  if (feedback.length === 0) return null;

  const rate = overrideRate(feedback);
  const savedRm = acceptedValueRm(feedback);
  const label = { accept: 'Accepted', reject: 'Skipped', reschedule: 'Rescheduled' } as const;

  return (
    <Panel label={t('Your actions')} dataTour="overrides">
      {savedRm >= 0.01 && (
        <div className="mb-2 flex items-baseline justify-between border-b border-hairline pb-2">
          <div className="text-[12px] text-ink-muted">{t('Saved from advice you accepted')}</div>
          <div className="tnum text-[15px] font-semibold text-[color:var(--success)]">
            ≈ {formatRm(savedRm)}
          </div>
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] text-ink-muted">{t('Override rate')}</div>
        <div className="tnum text-[15px] font-semibold">{Math.round(rate * 100)}%</div>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-ink-muted">
        {t(
          "The share of advice you did not accept. Over weeks this is what a deployed system learns from to fit your habits. Savings are estimates from the optimiser's numbers at the time you accepted.",
        )}
      </p>
      <div className="mt-2 space-y-1">
        {feedback.slice(0, 5).map((e) => (
          <div key={e.id} className="flex items-center justify-between text-[11px]">
            <span className="truncate text-ink">
              {t(label[e.action])} · {t(e.applianceName)}
              {e.reason ? <span className="text-ink-muted"> ({t(e.reason)})</span> : null}
            </span>
            <span className="tnum shrink-0 pl-2 text-ink-muted">
              {formatTimeMyt(new Date(e.ts).toISOString())}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
