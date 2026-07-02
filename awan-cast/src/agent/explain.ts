import { buildContext, type ExplainRequest } from './context';
import { validateExplanation } from './validate';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt';

export interface ExplainResponse {
  text: string;
  aiGenerated: boolean;
}

/** Injected LLM call. Kept abstract so the orchestrator is testable with a fake and key-free. */
export type LlmCaller = (args: { system: string; user: string }) => Promise<string>;

/**
 * Orchestrate one explanation. Builds grounded context, calls the LLM if available, validates the output,
 * and falls back to the deterministic reason on any of: no LLM, LLM error, empty output, or a validation
 * failure. The result therefore NEVER contains a number the optimiser did not produce.
 */
export async function explain(
  req: ExplainRequest,
  deps: { callLlm?: LlmCaller },
): Promise<ExplainResponse> {
  const ctx = buildContext(req);
  const fallbackText =
    ctx.deterministicReason?.trim() || 'Awan-Cast timed this to your solar generation.';
  const fallback: ExplainResponse = { text: fallbackText, aiGenerated: false };

  if (!deps.callLlm) return fallback;

  try {
    const raw = (
      await deps.callLlm({ system: SYSTEM_PROMPT, user: buildUserMessage(ctx, req.question) })
    ).trim();
    if (!raw) return fallback;
    const { ok } = validateExplanation(raw, ctx.allowed);
    return ok ? { text: raw, aiGenerated: true } : fallback;
  } catch {
    return fallback;
  }
}
