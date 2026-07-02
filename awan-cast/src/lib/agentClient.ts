import type { ExplainRequest } from '../agent/context';
import type { ExplainResponse } from '../agent/explain';

/**
 * Call the explanation endpoint. Returns null on any failure so the caller can keep showing the
 * deterministic reason. The app is fully usable when this returns null (no server, no key, offline).
 */
export async function fetchExplanation(req: ExplainRequest): Promise<ExplainResponse | null> {
  try {
    const res = await fetch('/agent/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    return (await res.json()) as ExplainResponse;
  } catch {
    return null;
  }
}
