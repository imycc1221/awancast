import {
  Area,
  AreaChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Forecast } from '../types';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { formatTimeShort, formatRm } from '../lib/format';

interface Props {
  forecast: Forecast;
}

interface ChartPoint {
  t: number;
  kw: number;
  kwLow: number;
  kwHigh: number;
  bandLow: number;
  bandSpan: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-hairline bg-panel px-3 py-2 text-[12px] shadow-hairline">
      <div className="tnum font-semibold">{formatTimeShort(new Date(p.t).toISOString())}</div>
      <div className="mt-1 flex items-center gap-3 text-ink-muted">
        <span>
          <span className="tnum font-semibold text-ink">{p.kw.toFixed(2)}</span> kW
        </span>
        <span className="text-[10px]">
          range <span className="tnum">{p.kwLow.toFixed(1)}–{p.kwHigh.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
}

export function ForecastChart({ forecast }: Props) {
  const now = useCurrentTime();

  const data: ChartPoint[] = forecast.points.map((pt) => ({
    t: Date.parse(pt.t),
    kw: pt.kw,
    kwLow: pt.kwLow,
    kwHigh: pt.kwHigh,
    bandLow: pt.kwLow,
    bandSpan: Math.max(0, pt.kwHigh - pt.kwLow),
  }));

  const stormStart = forecast.stormWindow ? Date.parse(forecast.stormWindow.start) : null;
  const stormEnd = forecast.stormWindow ? Date.parse(forecast.stormWindow.end) : null;

  const xMin = data[0]?.t ?? now.getTime();
  const xMax = data[data.length - 1]?.t ?? xMin + 120 * 60_000;

  return (
    <div className="h-[140px] w-full lg:h-[150px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          <defs>
            <linearGradient id="kwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="t"
            type="number"
            domain={[xMin, xMax]}
            scale="time"
            tickFormatter={(v) => formatTimeShort(new Date(v).toISOString())}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--ink-muted)' }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={[0, 'auto']}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--ink-muted)' }}
            tickFormatter={(v) => `${v}`}
            width={28}
          />

          {stormStart && stormEnd && (
            <ReferenceArea
              x1={stormStart}
              x2={stormEnd}
              fill="var(--warn-bg)"
              fillOpacity={0.5}
              stroke="none"
            />
          )}

          <Area
            type="monotone"
            dataKey="bandLow"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="bandSpan"
            stackId="band"
            stroke="none"
            fill="var(--chart-band)"
            isAnimationActive={false}
          />

          <Area
            type="monotone"
            dataKey="kw"
            stroke="var(--chart-line)"
            strokeWidth={2}
            fill="url(#kwFill)"
            isAnimationActive={false}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="kw"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          <ReferenceLine
            x={now.getTime()}
            stroke="var(--ink)"
            strokeDasharray="2 3"
            strokeWidth={1}
            label={{
              value: 'now',
              position: 'top',
              fill: 'var(--ink-muted)',
              fontSize: 10,
            }}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'var(--ink-muted)', strokeDasharray: '2 3' }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="sr-only" aria-hidden="false">
        Forecast value, illustrative {formatRm(0)}
      </div>
    </div>
  );
}
