import { useMemo } from 'react';
import { Panel } from './Panel';
import { ExplainPanel } from './ExplainPanel';
import { catalogIcon } from '../data/applianceCatalog';
import { formatRm, formatTimeMyt } from '../lib/format';
import { pickPrimaryAction } from '../lib/primaryAction';
import { getTariff } from '../data/tariffs';
import { flexibleAppliancesFor } from '../data/applianceCatalog';
import { useAppStore } from '../state/useAppStore';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { demandFnFor } from '../lib/netload';
import { applyDemoSavingsFloor } from '../lib/demoClock';
import { toAgentPayload } from '../lib/agentPayload';
import { useActiveProfile } from '../hooks/useProfile';
import { useT } from '../lib/i18n';
import type { Forecast } from '../types';

interface Props {
  forecast: Forecast;
}

/**
 * The action-first home-screen hero. It answers "what should I do right now, and what is it worth" before
 * any kW or chart. The forecast and kW remain available below as supporting detail.
 */
export function PrimaryAction({ forecast }: Props) {
  const region = useAppStore((s) => s.region);
  const profile = useActiveProfile();
  const tariff = getTariff(region);
  const now = useCurrentTime();
  const t = useT();

  const owned = useMemo(() => flexibleAppliancesFor(profile.appliances), [profile.appliances]);
  const demandFn = useMemo(() => demandFnFor(profile), [profile]);
  const pick = useMemo(
    () => pickPrimaryAction(forecast, owned, tariff, now, demandFn),
    [forecast, owned, tariff, now, demandFn],
  );

  if (!pick) {
    return (
      <Panel label={t('What to do now')} dataTour="primary">
        <p className="text-[13px] leading-snug text-ink">
          {t('Tell us which appliances you own, and we will find their cheapest solar windows every day.')}
        </p>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('AWANCAST_ACTION', { detail: 'EDIT_SETUP' }))
          }
          className="mt-2.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/20"
        >
          {t('Add appliances')}
        </button>
      </Panel>
    );
  }
  const { appliance, recommendation, stormApproaching, dailyPotentialRm } = pick;
  const Icon = catalogIcon(appliance.id);
  const isRunNow = recommendation.action === 'run-now';
  const monthlyRm = Math.round(dailyPotentialRm * 30);

  const headline = stormApproaching
    ? t('A storm is on the way — act now')
    : isRunNow
      ? t('A good time to run a flexible load')
      : t('Better to wait for now');

  const agentPayload = toAgentPayload(appliance.name, recommendation, forecast, tariff);

  return (
    <Panel label={t('What to do now')} dataTour="primary">
      <div className="text-[13px] font-medium text-ink-muted">{headline}</div>

      <div className="mt-2 flex items-center gap-3 rounded-panel border border-hairline bg-panel-nested p-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel">
          <Icon className="h-5 w-5 text-ink" strokeWidth={1.6} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold tracking-tight">{t(appliance.name)}</div>
          <div className="mt-1">
            <span className={`pill ${isRunNow ? 'pill-run' : 'pill-wait'}`}>
              {isRunNow
                ? t('RUN NOW')
                : t('WAIT UNTIL {time}', { time: formatTimeMyt(recommendation.windowStart) })}
            </span>
          </div>
        </div>

        <div className="text-right">
          {(() => {
            const stormActive = Boolean(
              forecast.stormWindow && now.getTime() < Date.parse(forecast.stormWindow.end),
            );
            const value = isRunNow
              ? recommendation.solarValueRm ?? 0
              : applyDemoSavingsFloor(appliance.id, recommendation.savingsRm, stormActive);
            if (value < 0.01) {
              return <div className="text-[12px] font-medium text-ink-muted">{t('Free solar')}</div>;
            }
            return (
              <>
                <div className="tnum text-[20px] font-semibold leading-none">{formatRm(value)}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                  {isRunNow ? t('free solar') : t('you save')}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {monthlyRm >= 1 ? (
        <div className="mt-2 text-[11px] text-ink-muted">
          {t('Good timing on these is worth roughly {rm}/month — and the storm watch protects the rest.', {
            rm: formatRm(monthlyRm),
          })}
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-ink-muted">
          {t('You run these on your own schedule — we just pick the cheapest window today.')}
        </div>
      )}

      <ExplainPanel explanation={t(recommendation.reason)} agentPayload={agentPayload} />
    </Panel>
  );
}
