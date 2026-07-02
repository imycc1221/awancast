import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApplianceCard } from '../src/components/ApplianceCard';
import type { Appliance, Recommendation } from '../src/types';

const ev: Appliance = {
  id: 'ev',
  name: 'EV Charger',
  iconKey: 'ev',
  kwDraw: 7.4,
  durationMin: 120,
  flexibilityHrs: 6,
};

describe('ApplianceCard', () => {
  it('renders the RUN NOW pill when action is run-now', () => {
    const rec: Recommendation = {
      applianceId: 'ev',
      action: 'run-now',
      windowStart: '2026-05-15T06:10:00.000Z',
      windowEnd: '2026-05-15T08:10:00.000Z',
      savingsRm: 0,
      reason: '',
    };
    render(<ApplianceCard appliance={ev} recommendation={rec} />);
    expect(screen.getByText('RUN NOW')).toBeInTheDocument();
  });

  it('renders the WAIT pill with a time when action is wait', () => {
    const rec: Recommendation = {
      applianceId: 'ev',
      action: 'wait',
      windowStart: '2026-05-15T08:20:00.000Z',
      windowEnd: '2026-05-15T10:20:00.000Z',
      savingsRm: 3.6,
      reason: '',
    };
    render(<ApplianceCard appliance={ev} recommendation={rec} />);
    expect(screen.getByText(/WAIT/)).toBeInTheDocument();
    expect(screen.getByText(/RM 3\.60/)).toBeInTheDocument();
  });
});
