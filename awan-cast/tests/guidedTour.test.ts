import { describe, it, expect } from 'vitest';
import { TOUR_STEPS } from '../src/components/GuidedTour';

describe('TOUR_STEPS', () => {
  it('has a sensible number of steps for a ~3 minute pitch', () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(6);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(12);
  });

  it('every step is well-formed (view, target, title, content, pos)', () => {
    for (const s of TOUR_STEPS) {
      expect(['home', 'facility', 'evidence']).toContain(s.view);
      expect(s.target.startsWith('[data-tour="')).toBe(true);
      expect(s.title.length).toBeGreaterThan(0);
      expect(['bottom', 'right', 'left']).toContain(s.pos);
    }
  });

  it('keeps copy short enough that presenters read it (<= 260 chars)', () => {
    for (const s of TOUR_STEPS) {
      expect(s.content.length).toBeLessThanOrEqual(260);
    }
  });

  it('walks across all three views', () => {
    const views = new Set(TOUR_STEPS.map((s) => s.view));
    expect(views.has('home')).toBe(true);
    expect(views.has('facility')).toBe(true);
    expect(views.has('evidence')).toBe(true);
  });
});
