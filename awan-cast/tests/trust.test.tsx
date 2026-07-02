import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuaranteePanel } from '../src/components/GuaranteePanel';
import { SetupModal } from '../src/components/SetupModal';
import { acceptedValueRm, type FeedbackEntry } from '../src/data/feedback';
import { useAppStore } from '../src/state/useAppStore';
import { exampleProfiles } from '../src/data/profiles';

function entry(partial: Partial<FeedbackEntry>): FeedbackEntry {
  return {
    id: Math.random().toString(36),
    ts: 1,
    applianceId: 'washer',
    applianceName: 'Washing machine',
    action: 'accept',
    recommendedAction: 'run-now',
    savingsRm: 0,
    ...partial,
  };
}

describe('acceptedValueRm (personal proof-it-works tracker)', () => {
  it('sums only accepted advice, preferring the true valueRm', () => {
    const entries = [
      entry({ action: 'accept', valueRm: 0.17 }),
      entry({ action: 'accept', valueRm: 4.0 }), // wait advice, true savings
      entry({ action: 'reject', valueRm: 9.99 }), // rejected: not counted
      entry({ action: 'accept', savingsRm: 0.5, valueRm: undefined }), // legacy entry falls back
    ];
    expect(acceptedValueRm(entries)).toBe(4.67);
  });

  it('is zero with no feedback', () => {
    expect(acceptedValueRm([])).toBe(0);
  });
});

describe('GuaranteePanel (the mathematical guarantee, plainly)', () => {
  it('states the 9-in-10 guarantee and the measured numbers', () => {
    render(<GuaranteePanel />);
    expect(screen.getByText(/at least 9 times out of 10/)).toBeInTheDocument();
    expect(screen.getByText(/94 out of 100 during storms/)).toBeInTheDocument();
    expect(screen.getByText(/96.6% of 261 test days/)).toBeInTheDocument();
  });

  it('links to the evidence view', () => {
    useAppStore.setState({ view: 'home' });
    render(<GuaranteePanel />);
    fireEvent.click(screen.getByRole('button', { name: /See the evidence/ }));
    expect(useAppStore.getState().view).toBe('evidence');
  });

  it('explains conformal prediction behind a plain-language reveal', () => {
    render(<GuaranteePanel />);
    fireEvent.click(screen.getByRole('button', { name: /How can you promise that/ }));
    expect(screen.getByText(/covered at least 9 of the last 10/)).toBeInTheDocument();
  });
});

describe('SetupModal zero-knowledge path', () => {
  beforeEach(() => {
    useAppStore.setState({
      region: 'peninsular',
      configured: false,
      profiles: exampleProfiles,
    });
  });

  it('one tap applies a typical Malaysian home and finishes setup', () => {
    const onClose = vi.fn();
    render(<SetupModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /typical Malaysian home/ }));
    const s = useAppStore.getState();
    expect(s.configured).toBe(true);
    expect(s.profiles.peninsular.solarKwp).toBe(5);
    expect(onClose).toHaveBeenCalled();
  });

  it('offers plain-language solar presets', () => {
    render(<SetupModal open onClose={() => {}} />);
    // solar's preset row comes first in the DOM (battery also has a "Small")
    fireEvent.click(screen.getAllByRole('button', { name: 'Small' })[0]!);
    // the small preset fills the kWp field with 2
    expect(useAppStore.getState().profiles.peninsular.solarKwp).toBe(5); // not saved yet
    const inputs = screen.getAllByRole('spinbutton');
    expect((inputs[0] as HTMLInputElement).value).toBe('2');
  });
});
