import { useId, useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { fetchExplanation } from '../lib/agentClient';
import { useT } from '../lib/i18n';
import type { ExplainRequest } from '../agent/context';

interface Props {
  /** The plain-language explanation. Today this is the deterministic `reason` from the scheduler; the
   *  live agent (when enabled and reachable) can replace it on open. */
  explanation: string;
  /** When true, shows the AI disclosure line instead of the deterministic one. */
  aiGenerated?: boolean;
  /** Toggle label, defaults to "Why?". */
  label?: string;
  /** If provided and the agent is enabled, the panel fetches a live explanation on first open. */
  agentPayload?: ExplainRequest;
}

const DET_DISCLOSURE = "This is the reason behind Awan-Cast's recommendation.";
const AI_DISCLOSURE =
  'This explanation is AI-generated to help you understand the forecast; it does not change the recommendation.';

const AGENT_ENABLED = import.meta.env.VITE_AGENT_ENABLED === 'true';

/**
 * A collapsible "Why?" reveal under a recommendation. It shows the deterministic explanation immediately
 * and, if the explanation agent is enabled and reachable, swaps in the validated agent text on first open.
 * It always degrades gracefully to the deterministic reason. See awan-cast-agent-spec.md.
 */
export function ExplainPanel({ explanation, aiGenerated = false, label, agentPayload }: Props) {
  const [open, setOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const [agentText, setAgentText] = useState<string | null>(null);
  const [agentAi, setAgentAi] = useState(false);
  const t = useT();

  const displayText = agentText ?? explanation;
  const displayAi = agentText ? agentAi : aiGenerated;
  const panelId = useId();
  const toggleLabel = label ?? t('Why?');

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !tried && AGENT_ENABLED && agentPayload) {
      setTried(true);
      void fetchExplanation(agentPayload).then((r) => {
        if (r && r.text) {
          setAgentText(r.text);
          setAgentAi(r.aiGenerated);
        }
      });
    }
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.7} />
        {open ? t('Tell me less') : toggleLabel}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div id={panelId} className="panel-nested reveal-in mt-1.5 p-2.5">
          <p className="text-[12px] leading-snug text-ink">{displayText}</p>
          <p className="mt-1.5 text-[10px] leading-snug text-ink-muted">
            {t(displayAi ? AI_DISCLOSURE : DET_DISCLOSURE)}
          </p>
        </div>
      )}
    </div>
  );
}
