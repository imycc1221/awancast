import { describe, it, expect } from 'vitest';
import {
  createExplainMiddleware,
  type ExplainReq,
  type ExplainRes,
} from '../src/agent/middleware';
import type { LlmCaller } from '../src/agent/explain';
import type { ExplainRequest } from '../src/agent/context';

const PAYLOAD: ExplainRequest = {
  applianceName: 'EV Charger',
  recommendation: {
    action: 'wait',
    windowStart: '2026-05-15T08:20:00.000Z',
    windowEnd: '2026-05-15T10:20:00.000Z',
    savingsRm: 2.3,
    reason: 'Generation will be higher and cheaper in this window, so waiting saves the most.',
  },
  forecast: {
    regime: 'partial',
    regimeConfidence: 'medium',
    currentKw: 3.8,
    todayKwh: 18.2,
    stormWindow: undefined,
  },
  tariff: { label: 'Solar ATAP · Peninsular', exportAllowed: true },
};

class FakeReq implements ExplainReq {
  url: string;
  method: string;
  private listeners: Record<string, Array<(c?: unknown) => void>> = {};
  constructor(url: string, method: string) {
    this.url = url;
    this.method = method;
  }
  on(event: string, listener: (c?: unknown) => void) {
    (this.listeners[event] ??= []).push(listener);
  }
  fire(event: string, chunk?: unknown) {
    (this.listeners[event] ?? []).forEach((l) => l(chunk));
  }
}

class FakeRes implements ExplainRes {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = '';
  done: Promise<void>;
  private resolveDone!: () => void;
  constructor() {
    this.done = new Promise<void>((r) => {
      this.resolveDone = r;
    });
  }
  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  end(body = '') {
    this.body = body;
    this.resolveDone();
  }
}

async function drive(
  opts: Parameters<typeof createExplainMiddleware>[0],
  url: string,
  method: string,
  rawBody: string,
): Promise<{ res: FakeRes; nextCalled: boolean }> {
  const mw = createExplainMiddleware(opts);
  const req = new FakeReq(url, method);
  const res = new FakeRes();
  let nextCalled = false;
  mw(req, res, () => {
    nextCalled = true;
  });
  req.fire('data', rawBody);
  req.fire('end');
  if (!nextCalled) await res.done;
  return { res, nextCalled };
}

describe('/agent/explain middleware', () => {
  it('returns the deterministic reason when no key is configured', async () => {
    const { res } = await drive({}, '/agent/explain', 'POST', JSON.stringify(PAYLOAD));
    const json = JSON.parse(res.body);
    expect(res.headers['content-type']).toBe('application/json');
    expect(json.aiGenerated).toBe(false);
    expect(json.text).toBe(PAYLOAD.recommendation.reason);
  });

  it('returns validated agent text when a key/LLM is available', async () => {
    const callLlm: LlmCaller = async () =>
      'There is more sun later, so waiting uses your own power and saves about RM 2.30 today. We are at Good confidence about this.';
    const { res } = await drive(
      { resolveCallLlm: () => callLlm },
      '/agent/explain',
      'POST',
      JSON.stringify(PAYLOAD),
    );
    const json = JSON.parse(res.body);
    expect(json.aiGenerated).toBe(true);
    expect(json.text).toMatch(/waiting/);
  });

  it('responds 400 on a malformed body', async () => {
    const { res } = await drive({}, '/agent/explain', 'POST', '{not valid json');
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'bad request' });
  });

  it('passes through non-POST requests to next()', async () => {
    const { nextCalled, res } = await drive({}, '/agent/explain', 'GET', '');
    expect(nextCalled).toBe(true);
    expect(res.body).toBe('');
  });

  it('passes through other paths to next()', async () => {
    const { nextCalled } = await drive({}, '/forecast', 'POST', '{}');
    expect(nextCalled).toBe(true);
  });
});
