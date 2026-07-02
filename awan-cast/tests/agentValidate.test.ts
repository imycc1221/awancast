import { describe, it, expect } from 'vitest';
import { validateExplanation } from '../src/agent/validate';
import type { AgentAllowed } from '../src/agent/context';

const allowed: AgentAllowed = {
  rm: new Set(['RM 2.30', 'RM 0.00']),
  confidenceWord: 'Good confidence',
  times: new Set(['4:20 PM']),
};

describe('validateExplanation', () => {
  it('accepts a clean, grounded explanation', () => {
    const text =
      'Right now your solar is not quite enough, so some power would come from the grid. Waiting saves about RM 2.30 today. We are at Good confidence about this.';
    expect(validateExplanation(text, allowed).ok).toBe(true);
  });

  it('rejects an invented ringgit amount', () => {
    const text = 'Waiting saves about RM 9.99 today.';
    const r = validateExplanation(text, allowed);
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toMatch(/unverified amount/);
  });

  it('rejects banned jargon', () => {
    const text = 'The convective regime means generation in kW will drop. We are at Good confidence.';
    const r = validateExplanation(text, allowed);
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toMatch(/banned word/);
  });

  it('rejects an off-ladder confidence word', () => {
    const text = 'We are at Medium confidence about this.';
    const r = validateExplanation(text, allowed);
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toMatch(/bad confidence word/);
  });

  it('rejects a percentage claim', () => {
    expect(validateExplanation('We are 90% sure of this.', allowed).ok).toBe(false);
    expect(validateExplanation('We are 90 percent sure of this.', allowed).ok).toBe(false);
  });

  it('rejects a thousands-separated or suffixed invented amount', () => {
    expect(validateExplanation('That is RM 1,200 today.', allowed).ok).toBe(false);
    expect(validateExplanation('That is RM 12k today.', allowed).ok).toBe(false);
    expect(validateExplanation('You save 4 ringgit today.', allowed).ok).toBe(false);
  });

  it('rejects an unverified time but accepts one from the allow-list', () => {
    expect(validateExplanation('Run before 9:15 PM.', allowed).ok).toBe(false);
    expect(validateExplanation('There is more sun around 4:20 PM.', allowed).ok).toBe(true);
  });

  it('rejects the display-only demo floor value that the scheduler never produced', () => {
    // EV true saving is small; the RM 4.00 demo floor must not pass the agent as authoritative.
    const a = { rm: new Set(['RM 0.50', 'RM 0.00']), confidenceWord: 'Good confidence', times: new Set<string>() };
    expect(validateExplanation('Waiting saves about RM 4.00 today.', a).ok).toBe(false);
  });

  it('rejects an over-long answer', () => {
    const text = 'One. Two. Three. Four. Five.';
    const r = validateExplanation(text, allowed);
    expect(r.violations).toContain('too long');
  });
});
