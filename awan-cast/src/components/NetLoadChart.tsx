import { useMemo } from 'react';
import {
  Area,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Panel } from './Panel';
import { computeNetLoad, demandFnFor } from '../lib/netload';
import { useActiveProfile } from '../hooks/useProfile';
import { formatTimeShort } from '../lib/format';
import { useT } from '../lib/i18n';
import type { Forecast } from '../types';

interface Props {
  /** Solar forecast already scaled to the household's system size. */
  forecast: Forecast;
}

interface Row {
  t: number;
  solar: number;
  demand: number;
  surplus: number;
  grid: number;
}

/**
 * The net-load curve: solar minus predicted household demand. Green shading is genuine free-solar surplus;
 * grey shading is where the home draws from the grid. Demand comes from the cohort prior (the day-one
 * stand-in for a personalised forecaster). This is what makes each recommendation traceable to a real
 * surplus window, rather than just "solar is high".
 */
export function NetLoadChart({ forecast }: Props) {
  const profile = useActiveProfile();
  const t = useT();

  const data: Row[] = useMemo(() => {
    const net = computeNetLoad(forecast, demandFnFor(profile));
    return net.map((p) => ({
      t: Date.parse(p.t),
      solar: p.solarKw,
      demand: p.demandKw,
      surplus: p.surplusKw,
      grid: p.gridKw,
    }));
  }, [forecast, profile]);

  return (
    <Panel label={t('Free-solar windows')} dataTour="netload">
      <p className="-mt-1 mb-2 text-[11px] leading-snug text-ink-muted">
        {t(
          "Solar minus your home's predicted demand. Green is genuine surplus you can use for free; grey is when the home draws from the grid.",
        )}
      </p>
      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -26 }}>
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={(v) => formatTimeShort(new Date(v).toISOString())}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'var(--ink-muted)' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'var(--ink-muted)' }}
              width={26}
            />
            <Area
              type="monotone"
              dataKey="surplus"
              stroke="none"
              fill="var(--success)"
              fillOpacity={0.28}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="grid"
              stroke="none"
              fill="var(--danger)"
              fillOpacity={0.16}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="solar"
              stroke="var(--sun)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="demand"
              stroke="var(--chart-demand)"
              strokeWidth={1.75}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--panel)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{
                fontWeight: 700,
                color: 'var(--ink)',
                fontVariantNumeric: 'tabular-nums',
                marginBottom: 4,
              }}
              labelFormatter={(v) => formatTimeShort(new Date(Number(v)).toISOString())}
              formatter={(value: number, name) => [
                `${value} kW`,
                name === 'solar'
                  ? t('Solar')
                  : name === 'demand'
                    ? t('Home demand')
                    : name === 'surplus'
                      ? t('Free surplus')
                      : name === 'grid'
                        ? t('From grid')
                        : name,
              ]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-muted">
        <span><span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: 'var(--sun)' }} /> {t('Solar')}</span>
        <span><span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: 'var(--chart-demand)' }} /> {t('Home demand (typical day)')}</span>
        <span><span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: 'var(--success)' }} /> {t('Free surplus')}</span>
      </div>
    </Panel>
  );
}
