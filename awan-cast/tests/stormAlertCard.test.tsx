import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../src/hooks/useCurrentTime', () => ({
  useCurrentTime: () => new Date('2026-05-15T06:05:00.000Z'),
}));

import { StormAlertCard } from '../src/components/StormAlertCard';
import { mockForecast } from '../src/data/mockForecast';

const ISSUED = new Date('2026-05-15T06:05:00.000Z');

describe('StormAlertCard', () => {
  it('shows a calm, action-first heads-up before a storm', () => {
    render(<StormAlertCard forecast={mockForecast('peninsular', ISSUED)} />);
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText(/cloudy spell is likely/i)).toBeInTheDocument();
    expect(screen.getByText(/Good confidence/)).toBeInTheDocument();
    // calm, not a red siren: it offers a "Tell me more" explanation affordance
    expect(screen.getByRole('button', { name: /Tell me more/ })).toBeInTheDocument();
  });

  it('renders nothing when there is no storm (Sabah clear)', () => {
    const { container } = render(<StormAlertCard forecast={mockForecast('sabah', ISSUED)} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
  });
});
