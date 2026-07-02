import type { LlmCaller } from './explain';

/**
 * Build a real LLM caller backed by the Anthropic Messages API. The API key is passed in by the server
 * (the Vite dev middleware reads it from process.env); it is NEVER imported or shipped to the browser.
 * Uses the global fetch (Node 18+ / browser), so this module has no Node-only type dependency.
 */
export function makeAnthropicCaller(apiKey: string, model: string): LlmCaller {
  return async ({ system, user }) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? '';
  };
}
