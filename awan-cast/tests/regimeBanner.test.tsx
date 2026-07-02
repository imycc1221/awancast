import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegimeBanner } from '../src/components/RegimeBanner';
import type { Forecast } from '../src/types';

function baseForecast(overrides: Partial<Forecast>): Forecast {
  return {
    issuedAt: '2026-05-15T06:05:00.000Z',
    location: { lat: 3.1, lon: 101.6, name: 'PJ' },
    currentKw: 3.8,
    todayKwh: 18.2,
    points: [],
    regime: 'partial',
    regimeConfidence: 'medium',
    cloudVectors: [],
    ...overrides,
  };
}

describe('RegimeBanner', () => {
  it('renders the stable copy', () => {
    render(<RegimeBanner forecast={baseForecast({ regime: 'stable', regimeConfidence: 'high' })} />);
    expect(screen.getByText(/Clear skies/i)).toBeInTheDocument();
  });

  it('renders the convective copy with storm window', () => {
    render(
      <RegimeBanner
        forecast={baseForecast({
          regime: 'convective',
          regimeConfidence: 'medium',
          stormWindow: {
            start: '2026-05-15T07:15:00.000Z',
            end: '2026-05-15T08:00:00.000Z',
          },
        })}
      />,
    );
    expect(screen.getByText(/Storm building/i)).toBeInTheDocument();
  });

  it('renders partial without a storm range', () => {
    render(<RegimeBanner forecast={baseForecast({ regime: 'partial' })} />);
    expect(screen.getByText(/Partial cloud/i)).toBeInTheDocument();
  });
});
