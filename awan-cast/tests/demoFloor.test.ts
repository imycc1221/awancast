import { describe, it, expect } from 'vitest';
import { applyDemoSavingsFloor } from '../src/lib/demoClock';

describe('applyDemoSavingsFloor (gated to storms)', () => {
  it('floors the EV charger only when a storm is active', () => {
    expect(applyDemoSavingsFloor('ev', 0.2, true)).toBe(4.0);
  });

  it('does NOT floor the EV charger on a clear or partial day', () => {
    expect(applyDemoSavingsFloor('ev', 0.2, false)).toBe(0.2);
    expect(applyDemoSavingsFloor('ev', 0.2)).toBe(0.2); // default = no storm
  });

  it('never alters non-EV appliances', () => {
    expect(applyDemoSavingsFloor('dishwasher', 1.1, true)).toBe(1.1);
    expect(applyDemoSavingsFloor('washer', 0, false)).toBe(0);
  });

  it('keeps a genuinely higher EV saving during a storm', () => {
    expect(applyDemoSavingsFloor('ev', 6.5, true)).toBe(6.5);
  });
});
