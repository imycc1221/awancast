import { Panel } from './Panel';
import {
  evidenceIntro,
  evidenceSections,
  evidenceFootnote,
  type EvidenceMetric,
} from '../data/evidence';

/**
 * Tidy stat card: the tag is pinned to the top-right on every card (consistent alignment), the value gets
 * its own full line, then label and detail. No value-next-to-pill jostling.
 */
function MetricCard({ m }: { m: EvidenceMetric }) {
  return (
    <div className="panel-nested card-hover flex flex-col p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="tnum text-[20px] font-semibold leading-none tracking-[-0.01em]">{m.value}</div>
        <span
          className={`pill mt-[3px] shrink-0 ${m.measured ? 'pill-run' : 'pill-wait'}`}
          title={m.measured ? 'Measured, with confidence intervals' : 'Projection, not audited'}
        >
          {m.measured ? 'MEASURED' : 'PROJECTED'}
        </span>
      </div>
      <div className="mt-2 text-[12px] font-semibold tracking-tight">{m.label}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-ink-muted">{m.detail}</div>
    </div>
  );
}

/**
 * The Evidence view: surfaces the validated research behind the product so judges can see the rigor, not
 * just the consumer app. Every figure matches the project brief; measured results and projections are
 * tagged distinctly.
 */
export function EvidenceView() {
  return (
    <div className="stagger-children flex flex-col gap-3">
      <Panel label="The evidence behind Awan-Cast" dataTour="evidence-intro">
        <p className="text-[14px] leading-snug text-ink">{evidenceIntro.thesis}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {evidenceIntro.badges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-hairline bg-panel-nested px-2.5 py-1 text-[11px] font-medium text-ink-muted"
            >
              {b}
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel label="The regime-selective gate" dataTour="evidence-gate">
          <img src="/fig_gate.png" alt="The regime selective gate routes storm-onset pixels to the accurate model and calm pixels to a cheap baseline." className="w-full rounded-md" />
        </Panel>
        <Panel label="System workflow">
          <img src="/fig_workflow.png" alt="Awan-Cast system workflow across the three layers, from inputs to forecast and schedule." className="w-full rounded-md" />
        </Panel>
      </div>

      {evidenceSections.map((sec) => (
        <Panel key={sec.title} label={sec.title}>
          <p className="-mt-1 mb-3 text-[12px] leading-snug text-ink-muted">{sec.blurb}</p>
          <div className="stagger-children grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {sec.metrics.map((m) => (
              <MetricCard key={m.label} m={m} />
            ))}
          </div>
        </Panel>
      ))}

      <Panel label="Honesty note">
        <p className="text-[11px] leading-snug text-ink-muted">{evidenceFootnote}</p>
      </Panel>
    </div>
  );
}
