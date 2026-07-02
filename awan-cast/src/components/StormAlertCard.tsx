import { CloudLightning, Check } from 'lucide-react';
import { ExplainPanel } from './ExplainPanel';
import { useMemo } from 'react';
import { buildStormAlert, joinNames } from '../lib/stormAlert';
import { getTariff } from '../data/tariffs';
import { flexibleAppliancesFor } from '../data/applianceCatalog';
import { useAppStore } from '../state/useAppStore';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { demandFnFor } from '../lib/netload';
import { useActiveProfile } from '../hooks/useProfile';
import { useT } from '../lib/i18n';
import type { Forecast } from '../types';

interface Props {
  forecast: Forecast;
}

/**
 * The storm heads-up: a calm, action-first amber card shown before a storm. It leads with what to do and
 * uses human time and plain language, never a red siren. Hidden when no storm is approaching.
 */
export function StormAlertCard({ forecast }: Props) {
  const region = useAppStore((s) => s.region);
  const profile = useActiveProfile();
  const now = useCurrentTime();
  const owned = useMemo(() => flexibleAppliancesFor(profile.appliances), [profile.appliances]);
  const demandFn = useMemo(() => demandFnFor(profile), [profile]);
  const t = useT();
  const alert = buildStormAlert(forecast, owned, getTariff(region), now, demandFn);
  if (!alert) return null;

  const actions: string[] = [];
  if (alert.runNowNames.length > 0) {
    actions.push(
      t('Run {names} now, before {time}.', {
        names: joinNames(alert.runNowNames.map((n) => t(n)), t('and')),
        time: alert.startLabel,
      }),
    );
  }
  if (alert.holdName && alert.holdUntilLabel) {
    actions.push(
      t('Hold off the {name} until about {time}.', {
        name: t(alert.holdName),
        time: alert.holdUntilLabel,
      }),
    );
  }

  const explanation = t(
    'Clouds are building up nearby, which is how afternoon storms usually start here. We have left a little buffer in the timing because storms are hard to time exactly.',
  );

  return (
    <div data-tour="storm-alert" className="rounded-panel border border-[var(--warn-border)] bg-warn-bg p-4">
      <div className="flex items-center gap-2 text-warn">
        <CloudLightning className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        <div className="text-[14px] font-semibold">{t('Heads up')}</div>
      </div>

      <p className="mt-1.5 text-[13px] leading-snug text-ink">
        {t(
          'A cloudy spell is likely around {start} to {end}. Your solar will dip for about {mins} minutes, then recover.',
          { start: alert.startLabel, end: alert.endLabel, mins: alert.durationMin },
        )}
      </p>

      {actions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {actions.map((line) => (
            <li key={line} className="flex items-start gap-2 text-[12px] text-ink">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" strokeWidth={2.2} aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[11px] text-ink-muted">
        {t('We are at {conf} about this.', { conf: t(alert.confidenceWord) })}
      </p>

      <ExplainPanel explanation={explanation} label={t('Tell me more')} />
    </div>
  );
}
