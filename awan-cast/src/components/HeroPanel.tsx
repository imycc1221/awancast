import { Sun } from 'lucide-react';
import { Panel } from './Panel';
import { ForecastChart } from './ForecastChart';
import type { Forecast } from '../types';

interface Props {
  forecast: Forecast;
}

export function HeroPanel({ forecast }: Props) {
  const integer = Math.floor(forecast.currentKw);
  const decimal = Math.round((forecast.currentKw - integer) * 10);

  return (
    <Panel
      label="Live solar"
      action={
        <span className="hidden text-[11px] text-ink-muted md:inline">
          {forecast.location.name}
        </span>
      }
    >
      <div className="flex items-end gap-4">
        <div className="flex items-baseline gap-2">
          <div className="tnum text-[44px] font-medium leading-none tracking-[-0.03em] lg:text-[52px]">
            {integer}.{decimal}
          </div>
          <div className="pb-1 text-[18px] font-medium text-ink-muted">kW</div>
          <Sun
            className="mb-0.5 ml-1 h-5 w-5 self-center text-sun"
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <div className="mb-1 ml-auto text-right text-[11px] text-ink-muted">
          <div>Today so far</div>
          <div className="tnum text-[15px] font-semibold text-ink">
            {forecast.todayKwh.toFixed(1)}{' '}
            <span className="text-[11px] font-normal text-ink-muted">kWh</span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <ForecastChart forecast={forecast} />
      </div>
    </Panel>
  );
}
