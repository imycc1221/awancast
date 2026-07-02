import { explain, type LlmCaller } from './explain';

/** Minimal structural shapes so this module needs no Node type dependency. They are satisfied by the
 *  Connect/Node request and response objects that Vite's dev server provides. */
export interface ExplainReq {
  url?: string;
  method?: string;
  on(event: string, listener: (chunk?: unknown) => void): void;
}
export interface ExplainRes {
  statusCode?: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}
export type ExplainNext = () => void;

export interface ExplainMiddlewareOptions {
  /** Resolve the LLM caller per request (so the API key can be read lazily). Return undefined to fall
   *  back to the deterministic reason. */
  resolveCallLlm?: () => LlmCaller | undefined;
}

/**
 * The /agent/explain endpoint as a connect-style middleware. Reads the JSON body, runs the explain()
 * orchestrator, and writes the JSON result. Non-POST or non-matching requests pass through to next().
 * Extracted from vite.config so the full request/response path is unit-testable without a live server.
 */
export function createExplainMiddleware(opts: ExplainMiddlewareOptions = {}) {
  return (req: ExplainReq, res: ExplainRes, next: ExplainNext): void => {
    if (req.url !== '/agent/explain' || req.method !== 'POST') return next();

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      void (async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const callLlm = opts.resolveCallLlm?.();
          const result = await explain(payload, { callLlm });
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(result));
        } catch {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'bad request' }));
        }
      })();
    });
  };
}
