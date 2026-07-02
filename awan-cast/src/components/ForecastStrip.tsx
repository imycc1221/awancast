import { Sun, CloudSun, Cloud, CloudLightning, type LucideIcon } from 'lucide-react';
import { Panel } from './Panel';
import { buildForecastStrip, type StripGlyph } from '../lib/forecastStrip';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { useT } from '../lib/i18n';
import type { Forecast } from '../types';

const GLYPH_ICON: Record<StripGlyph, LucideIcon> = {
  sun: Sun,
  cloudSun: CloudSun,
  cloud: Cloud,
  storm: CloudLightning,
};

const GLYPH_COLOR: Record<StripGlyph, string> = {
  sun: 'text-sun',
  cloudSun: 'text-sun',
  cloud: 'text-ink-muted',
  storm: 'text-warn',
};

interface Props {
  forecast: Forecast;
}

/**
 * The plain-language forecast for the home screen. Replaces the kW chart as the primary forecast view
 * (the chart remains below as detail). Confidence is shown as icon sharpness, never as numbers.
 */
export function ForecastStrip({ forecast }: Props) {
  const now = useCurrentTime();
  const t = useT();
  const steps = buildForecastStrip(forecast, now);
  if (steps.length === 0) return null;

  return (
    <Panel label={t('Next 2 hours')} dataTour="forecast-strip">
      <div className="flex items-stretch justify-between gap-1">
        {steps.map((s) => {
          const Icon = GLYPH_ICON[s.glyph];
          return (
            <div
              key={s.key}
              className="flex flex-1 flex-col items-center gap-1 text-center"
              role="img"
              aria-label={`${t(s.label)} — ${t(s.confidenceWord)}`}
              title={t(s.confidenceWord)}
            >
              <Icon className={`h-6 w-6 ${GLYPH_COLOR[s.glyph]}`} strokeWidth={1.7} aria-hidden />
              <div className="flex gap-[3px]" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-[4px] w-[4px] rounded-full"
                    style={
                      i < s.sureness
                        ? { background: 'var(--ink-muted)' }
                        : { boxShadow: 'inset 0 0 0 1px var(--hairline)' }
                    }
                  />
                ))}
              </div>
              <div className="text-[11px] font-medium leading-tight">{t(s.label)}</div>
              <div className="text-[10px] text-ink-muted">{s.isNow ? t('Now') : s.timeLabel}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-ink-muted">
        {t('More dots means more certain. Storms are naturally the hardest hours to time.')}
      </p>
    </Panel>
  );
}
