import { AlertTriangle, BatteryCharging, TrendingDown } from 'lucide-react';
import { Panel } from './Panel';
import { getFacility, facilityStatus } from '../data/mockFacility';
import { confidenceLabel } from '../lib/confidenceLabel';
import { formatRm, formatRm0, formatTimeMyt } from '../lib/format';
import { useAppStore } from '../state/useAppStore';
import type { Forecast } from '../types';

interface Props {
  forecast: Forecast;
}

function kw(value: number): string {
  return `${Math.round(value)} kW`;
}

/**
 * The commercial facility dashboard. The whole product value here is one number: this month's peak demand
 * and what it is costing under the RP4 capacity charge. Leads with that, then live new-peak risk, the
 * demand-versus-cap picture, the battery action, and savings to date.
 */
export function FacilityDashboard({ forecast }: Props) {
  const region = useAppStore((s) => s.region);
  const f = getFacility(region);
  const s = facilityStatus(f);
  const conf = confidenceLabel(forecast.regime, forecast.regimeConfidence);

  const scale = (x: number) => `${Math.min(100, Math.max(0, (x / f.lastMonthPeakKw) * 100))}%`;

  return (
    <div className="stagger-children flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-eyebrow">Facility · {f.siteName}</div>
        <div className="text-[11px] text-ink-muted">
          {f.scheme} capacity charge {formatRm(f.capChargeRmPerKw)} per kW
          {f.illustrativeRate ? ' (illustrative)' : ''}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel label="This month's peak demand" dataTour="facility-peak">
          <div className="tnum text-[34px] font-medium leading-none tracking-[-0.02em]">{kw(f.monthPeakKw)}</div>
          <div className="mt-1 text-[14px] font-semibold">= {formatRm0(s.monthChargeRm)} capacity charge</div>
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted">
            <TrendingDown className="h-3.5 w-3.5 text-[color:var(--success)]" strokeWidth={1.8} />
            <span>
              {s.vsLastMonthPct}% lower than last month ({kw(f.lastMonthPeakKw)})
            </span>
          </div>
        </Panel>

        <Panel label="Right now">
          {s.atRisk ? (
            <div className="flex items-start gap-2 text-warn">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
              <div className="text-[13px] font-semibold leading-snug text-ink">
                {f.currentDemandKw >= f.targetCapKw
                  ? `Approaching a new monthly peak. Demand is ${kw(f.currentDemandKw)}, above your ${kw(f.targetCapKw)} target — the battery is shaving it down.`
                  : `Approaching a new monthly peak. Demand is ${kw(f.currentDemandKw)}, nearing your ${kw(f.targetCapKw)} cap.`}
              </div>
            </div>
          ) : (
            <div className="text-[13px] font-semibold text-ink">
              Demand {kw(f.currentDemandKw)}, safely under your {kw(f.targetCapKw)} cap.
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted">
            <BatteryCharging className="h-3.5 w-3.5 text-accent" strokeWidth={1.8} />
            <span>
              Battery {f.batteryPercent}%{' '}
              {f.batteryDischarging ? 'discharging now to hold the peak down' : 'reserved for the peak window'}.
            </span>
          </div>
        </Panel>
      </div>

      <Panel label="Today's demand vs your cap">
        <div className="relative h-7 rounded bg-panel-nested">
          <div className="absolute inset-y-0 left-0 rounded bg-accent/30" style={{ width: scale(f.currentDemandKw) }} />
          <div className="absolute inset-y-0 w-[2px] bg-warn" style={{ left: scale(f.targetCapKw) }} title="target cap" />
          <div className="absolute inset-y-0 w-[2px] bg-danger" style={{ left: scale(f.monthPeakKw) }} title="this month's peak" />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
          <span><span className="inline-block h-2 w-2 rounded-sm bg-accent/60 align-middle" /> Current {kw(f.currentDemandKw)}</span>
          <span><span className="inline-block h-2 w-2 rounded-sm bg-warn align-middle" /> Target cap {kw(f.targetCapKw)}</span>
          <span><span className="inline-block h-2 w-2 rounded-sm bg-danger align-middle" /> Peak {kw(f.monthPeakKw)}</span>
        </div>
        {forecast.stormWindow && (
          <p className="mt-2 text-[11px] leading-snug text-ink-muted">
            Cloud dip forecast {formatTimeMyt(forecast.stormWindow.start)} to{' '}
            {formatTimeMyt(forecast.stormWindow.end)} ({conf.word}). The battery is positioned so a sudden
            solar drop does not push grid demand into a new peak.
          </p>
        )}
      </Panel>

      <Panel label="Savings this month (vs no smart battery dispatch)">
        <div className="flex items-end justify-between">
          <div className="tnum text-[26px] font-semibold leading-none">{formatRm0(f.savingsThisMonthRm)}</div>
          <div className="text-right text-[12px] text-ink-muted">
            on pace for about{' '}
            <span className="font-semibold text-ink">{formatRm0(f.annualPaceRm)}</span> / year
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-ink-muted">
          Projection from a stylised simulation on real interval-meter load and the real tariff, not audited savings.
        </p>
      </Panel>
    </div>
  );
}
