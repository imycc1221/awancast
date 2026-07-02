import { useMemo } from 'react';
import { Panel } from './Panel';
import { ApplianceCard } from './ApplianceCard';
import { flexibleAppliancesFor } from '../data/applianceCatalog';
import { getTariff } from '../data/tariffs';
import { recommend } from '../data/scheduler';
import { useAppStore } from '../state/useAppStore';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { applyDemoSavingsFloor } from '../lib/demoClock';
import { demandFnFor } from '../lib/netload';
import { toAgentPayload } from '../lib/agentPayload';
import { useActiveProfile } from '../hooks/useProfile';
import { useT } from '../lib/i18n';
import type { Forecast } from '../types';

interface Props {
  forecast: Forecast;
}

export function ApplianceList({ forecast }: Props) {
  const region = useAppStore((s) => s.region);
  const profile = useActiveProfile();
  const tariff = getTariff(region);
  const now = useCurrentTime();
  const t = useT();

  const owned = useMemo(() => flexibleAppliancesFor(profile.appliances), [profile.appliances]);
  const demandFn = useMemo(() => demandFnFor(profile), [profile]);
  const recs = useMemo(
    () => recommend(forecast, owned, tariff, now, demandFn),
    [forecast, owned, tariff, now, demandFn],
  );

  return (
    <Panel
      label={t('Recommendations')}
      dataTour="recommendations"
      action={
        <span className="text-[10px] uppercase tracking-[0.06em] text-ink-muted">
          {tariff.label}
        </span>
      }
    >
      {owned.length === 0 && (
        <div className="py-3 text-center">
          <p className="text-[12px] text-ink-muted">
            {t('No schedulable appliances in your setup yet.')}
          </p>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('AWANCAST_ACTION', { detail: 'EDIT_SETUP' }))
            }
            className="mt-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            {t('Add appliances')}
          </button>
        </div>
      )}
      {owned.length > 0 && (
        <p className="-mt-1 mb-1 text-[11px] leading-snug text-ink-muted">
          {t('You run these on your own schedule. When you need one, this is the cheapest window today.')}
        </p>
      )}
      <div>
        {owned.map((a, idx) => {
          const r = recs.find((x) => x.applianceId === a.id);
          if (!r) return null;
          const stormActive = Boolean(
            forecast.stormWindow && now.getTime() < Date.parse(forecast.stormWindow.end),
          );
          const adjusted = {
            ...r,
            savingsRm: applyDemoSavingsFloor(a.id, r.savingsRm, stormActive),
          };
          // The agent is grounded on the TRUE scheduler numbers, never the display-only demo floor.
          const agentPayload = toAgentPayload(a.name, r, forecast, tariff);
          return (
            <ApplianceCard
              key={a.id}
              appliance={a}
              recommendation={adjusted}
              showDivider={idx > 0}
              agentPayload={agentPayload}
            />
          );
        })}
      </div>
      <p className="mt-2 border-t border-hairline pt-2 text-[10px] leading-snug text-ink-muted">
        {tariff.notes}. {t('Illustrative tariff.')}
      </p>
    </Panel>
  );
}
