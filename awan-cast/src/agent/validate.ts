import type { AgentAllowed } from './context';

const BANNED: Array<{ label: string; re: RegExp }> = [
  { label: 'regime', re: /\bregime\b/i },
  { label: 'convective', re: /\bconvective\b/i },
  { label: 'conformal', re: /\bconformal\b/i },
  { label: 'kelvin', re: /\bkelvin\b/i },
  { label: 'kw', re: /\bkw\b/i },
  { label: 'kwh', re: /\bkwh\b/i },
  { label: 'kilowatt', re: /\bkilowatt/i },
  { label: 'algorithm', re: /\balgorithm/i },
  // Money must be stated as "RM x" (checked against the allow-list), never as a bare "ringgit" amount.
  { label: 'ringgit', re: /\bringgit\b/i },
];

const TIME_RE = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();

const CONFIDENCE_WORDS = [
  'high confidence',
  'good confidence',
  'fair confidence',
  'low confidence',
];

export interface Validation {
  ok: boolean;
  violations: string[];
}

/**
 * Enforce the safety contract on an LLM explanation: no invented ringgit amounts, no banned jargon, no
 * percentage claims, only the four confidence words, and at most four sentences. A failing response is
 * rejected so the orchestrator can fall back to the deterministic reason.
 */
export function validateExplanation(text: string, allowed: AgentAllowed): Validation {
  const violations: string[] = [];

  for (const b of BANNED) {
    if (b.re.test(text)) violations.push(`banned word: ${b.label}`);
  }

  // Ringgit amounts: catch thousands separators and k/m suffixes, then check against the allow-list.
  const rmMatches = text.match(/RM\s?[\d,]+(?:\.\d+)?\s?(?:k|m)?/gi) ?? [];
  for (const m of rmMatches) {
    const raw = m
      .replace(/RM\s?/i, '')
      .replace(/,/g, '')
      .replace(/\s?k$/i, 'e3')
      .replace(/\s?m$/i, 'e6')
      .trim();
    const value = Number(raw);
    const normed = Number.isFinite(value) ? `RM ${value.toFixed(2)}` : m;
    if (!allowed.rm.has(normed)) violations.push(`unverified amount: ${m.trim()}`);
  }

  if (/\d+(?:\.\d+)?\s?(?:%|percent)/i.test(text)) violations.push('percentage not allowed');

  // Times: every explicit clock time must be one the scheduler produced (in allowed.times).
  const allowedTimes = new Set([...allowed.times].map(norm));
  for (const m of text.match(TIME_RE) ?? []) {
    if (!allowedTimes.has(norm(m))) violations.push(`unverified time: ${m.trim()}`);
  }

  const confMatches = text.match(/\b\w+\s+confidence\b/gi) ?? [];
  for (const m of confMatches) {
    const normalized = m.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!CONFIDENCE_WORDS.includes(normalized)) violations.push(`bad confidence word: ${m.trim()}`);
  }

  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length > 4) violations.push('too long');

  return { ok: violations.length === 0, violations };
}
