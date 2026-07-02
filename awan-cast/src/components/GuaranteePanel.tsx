import { ShieldCheck } from 'lucide-react';
import { Panel } from './Panel';
import { ExplainPanel } from './ExplainPanel';
import { useAppStore } from '../state/useAppStore';
import { useT } from '../lib/i18n';

// Plain-language conformal-prediction explanation. Deterministic copy, not LLM-generated.
const HOW =
  'Before showing a range, Awan-Cast checks how far off its recent forecasts were, and widens the range until it would have covered at least 9 of the last 10. Storms automatically get wider ranges. Statisticians call this conformal prediction — the promise holds by construction, however strange the weather gets.';

/**
 * The mathematical guarantee, in words anyone can read. Numbers are the project's MEASURED research
 * results (see AWAN-CAST_PROJECT_BRIEF.md section 6.4 and the Evidence view): conformal target 90%,
 * measured convective coverage 94%, onset skill wins on 96.6% of 261 test days.
 */
export function GuaranteePanel() {
  const setView = useAppStore((s) => s.setView);
  const t = useT();

  return (
    <Panel label={t('Our promise')} dataTour="guarantee">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel-nested">
          <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] leading-snug text-ink">
            {t('When we show a range, reality lands inside it')}{' '}
            <strong>{t('at least 9 times out of 10')}</strong>
            {t('. That is a mathematical property of how the range is built — not a hope.')}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
            {t(
              'Measured on real data: 94 out of 100 during storms, and our storm warnings beat the standard method on 96.6% of 261 test days.',
            )}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 pl-[38px]">
        <ExplainPanel explanation={t(HOW)} label={t('How can you promise that?')} />
        <button
          type="button"
          onClick={() => setView('evidence')}
          className="shrink-0 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {t('See the evidence')}
        </button>
      </div>
    </Panel>
  );
}
