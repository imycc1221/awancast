import { Panel } from './Panel';
import { useAppStore } from '../state/useAppStore';
import { useActiveProfile } from '../hooks/useProfile';
import { systemCheck } from '../lib/sunshine';
import { useT } from '../lib/i18n';

/**
 * Is the RM 30k system actually delivering? Compares this week's production with what the weather
 * allowed for a system of this size, and flags silent underperformance (dirty panels, inverter faults).
 * Demo reading until a real inverter is connected — labelled as such.
 */
export function SystemCheck() {
  const region = useAppStore((s) => s.region);
  const profile = useActiveProfile();
  const t = useT();
  const r = systemCheck(profile.solarKwp, region);

  return (
    <Panel label={t('System check')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] leading-snug text-ink">
          {r.healthy
            ? t(
                "Your system produced {pct}% of what this week's weather allowed — performing as it should.",
                { pct: r.pctOfExpected },
              )
            : t(
                "Your system produced {pct}% of what this week's weather allowed — {missing}% is missing. Worth checking: dusty panels or an inverter fault.",
                { pct: r.pctOfExpected, missing: 100 - r.pctOfExpected },
              )}
        </p>
        <span className={`pill ${r.healthy ? 'pill-run' : 'pill-wait'}`}>
          {r.healthy ? t('HEALTHY') : t('CHECK')}
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-ink-muted">
        {t(
          'Example reading — in deployment this connects to your inverter and watches your investment automatically.',
        )}
      </p>
    </Panel>
  );
}
