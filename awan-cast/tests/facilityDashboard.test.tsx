import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FacilityDashboard } from '../src/components/FacilityDashboard';
import { mockForecast } from '../src/data/mockForecast';

const forecast = mockForecast('peninsular', new Date('2026-05-15T06:05:00.000Z'));

describe('FacilityDashboard', () => {
  it('leads with the monthly peak translated into the RP4 charge', () => {
    render(<FacilityDashboard forecast={forecast} />);
    expect(screen.getByText(/= RM 75,165 capacity charge/)).toBeInTheDocument();
  });

  it('flags an approaching new monthly peak and is consistent about the cap', () => {
    render(<FacilityDashboard forecast={forecast} />);
    // demand (826) is above the cap (820): the copy must not say "just under"
    expect(screen.getByText(/Approaching a new monthly peak/)).toBeInTheDocument();
    expect(screen.getByText(/above your 820 kW target/)).toBeInTheDocument();
    expect(screen.queryByText(/just under your 820 kW cap/)).not.toBeInTheDocument();
  });

  it('shows the savings to date as an honest projection, grouped', () => {
    render(<FacilityDashboard forecast={forecast} />);
    expect(screen.getByText(/RM 53,200/)).toBeInTheDocument();
    expect(screen.getByText(/not audited savings/)).toBeInTheDocument();
  });
});
