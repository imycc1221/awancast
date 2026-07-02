import type { Forecast } from '../types';
import { regimeIcons, regimeCopy } from '../lib/icons';
import { formatTimeMyt } from '../lib/format';
import { confidenceLabel } from '../lib/confidenceLabel';
import { useT } from '../lib/i18n';

interface Props {
  forecast: Forecast;
}

const TONE_STYLES = {
  success: 'border-hairline bg-panel-nested text-ink',
  warn: 'border-[var(--warn-border)] bg-warn-bg text-warn',
  danger: 'border-danger/40 bg-[color:var(--warn-bg)] text-danger',
} as const;

export function RegimeBanner({ forecast }: Props) {
  const t = useT();
  const Icon = regimeIcons[forecast.regime];
  const { title, tone } = regimeCopy[forecast.regime];
  const stormSpan = forecast.stormWindow
    ? `${formatTimeMyt(forecast.stormWindow.start)} – ${formatTimeMyt(forecast.stormWindow.end)}`
    : null;
  const confidence = confidenceLabel(forecast.regime, forecast.regimeConfidence);

  return (
    <div
      role="status"
      data-tour="regime"
      className={`flex items-center gap-3 rounded-panel border px-4 py-2.5 ${TONE_STYLES[tone]}`}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel/60">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-tight">
          {t(title)}
          {stormSpan && <span className="ml-1 font-normal opacity-90">· {stormSpan}</span>}
        </div>
        <div className="mt-0.5 text-[11px] opacity-80">{t(confidence.word)}</div>
      </div>
    </div>
  );
}
