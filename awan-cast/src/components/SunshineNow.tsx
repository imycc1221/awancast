import { Panel } from './Panel';
import { useActiveProfile } from '../hooks/useProfile';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { demandFnFor } from '../lib/netload';
import { sunshineNowPct } from '../lib/sunshine';
import { formatTimeMyt } from '../lib/format';
import { useT } from '../lib/i18n';
import type { Forecast } from '../types';

interface Props {
  /** Solar forecast already scaled to the household's system size. */
  forecast: Forecast;
}

/**
 * The identity + protection hero: how much of the home is running on sunshine right now, and whether a
 * storm threatens it. Leads with what a solar owner is proud of and worried about — not cents.
 */
export function SunshineNow({ forecast }: Props) {
  const profile = useActiveProfile();
  const now = useCurrentTime();
  const t = useT();

  const demandKw = demandFnFor(profile)(now.getTime());
  const pct = sunshineNowPct(forecast.currentKw, demandKw);
  const surplus = forecast.currentKw - demandKw;

  let stormLine = t('No storm expected in the next two hours.');
  if (forecast.stormWindow) {
    const start = Date.parse(forecast.stormWindow.start);
    const end = Date.parse(forecast.stormWindow.end);
    if (now.getTime() < start) {
      stormLine = t('Storm watch {time} — your plan is ready below.', {
        time: formatTimeMyt(forecast.stormWindow.start),
      });
    } else if (now.getTime() < end) {
      stormLine = t('Storm passing — your solar will recover soon.');
    }
  }

  return (
    <Panel label={t('Right now')} dataTour="sunshine">
      <div className="flex items-baseline gap-2">
        <span className="tnum text-[34px] font-semibold leading-none tracking-[-0.02em]">{pct}%</span>
        <span className="text-[13px] leading-snug text-ink">
          {t('of your home is running on sunshine')}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
        {surplus >= 0 ? t('With power to spare. ') : t('Topping up from the grid. ')}
        {stormLine}
      </p>
    </Panel>
  );
}
