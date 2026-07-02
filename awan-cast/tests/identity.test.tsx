import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { sunshineNowPct, systemCheck, monthlyShowcase } from '../src/lib/sunshine';
import { SunshineNow } from '../src/components/SunshineNow';
import { SystemCheck } from '../src/components/SystemCheck';
import { MonthlyCard } from '../src/components/MonthlyCard';
import { useAppStore } from '../src/state/useAppStore';
import { exampleProfiles } from '../src/data/profiles';
import { mockForecast } from '../src/data/mockForecast';
import { scaleForecast } from '../src/lib/netload';

const FROZEN = new Date('2026-05-15T06:05:00.000Z'); // 2 PM MYT

describe('sunshineNowPct', () => {
  it('covers the edges honestly', () => {
    expect(sunshineNowPct(4, 2)).toBe(100); // surplus caps at 100
    expect(sunshineNowPct(1, 2)).toBe(50);
    expect(sunshineNowPct(0, 2)).toBe(0);
    expect(sunshineNowPct(3, 0)).toBe(100); // no demand = fully covered
  });
});

describe('systemCheck (demo meter)', () => {
  it('scales expected production with system size', () => {
    expect(systemCheck(5, 'peninsular').expectedKwhWeek).toBe(Math.round(5 * 4.2 * 7));
  });

  it('shows both states across regions: healthy and worth-checking', () => {
    expect(systemCheck(5, 'peninsular').healthy).toBe(true);
    expect(systemCheck(8, 'sabah').healthy).toBe(false);
  });
});

describe('identity panels', () => {
  beforeEach(() => {
    useAppStore.setState({ region: 'sabah', profiles: exampleProfiles });
  });

  it('SunshineNow leads with the sunshine percentage, not cents', () => {
    const scaled = scaleForecast(mockForecast('sabah', FROZEN), exampleProfiles.sabah.solarKwp);
    render(<SunshineNow forecast={scaled} />);
    expect(screen.getByText(/of your home is running on sunshine/)).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument(); // clear Sabah day, big system
  });

  it('SystemCheck flags Sabah underperformance and labels the demo data', () => {
    render(<SystemCheck />);
    expect(screen.getByText('CHECK')).toBeInTheDocument();
    expect(screen.getByText(/dusty panels or an inverter fault/)).toBeInTheDocument();
    expect(screen.getByText(/Example reading/)).toBeInTheDocument();
  });

  it('MonthlyCard shows the identity stat, labelled as an example month', () => {
    render(<MonthlyCard />);
    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getByText(/top 5% of solar homes around Kota Kinabalu/)).toBeInTheDocument();
    expect(screen.getByText(/Example month/)).toBeInTheDocument();
  });

  it('MonthlyCard share copies the stat to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<MonthlyCard />);
    fireEvent.click(screen.getByRole('button', { name: /Share/ }));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('71% on sunshine'));
    expect(monthlyShowcase('sabah').shareText).toContain('Kota Kinabalu');
  });
});
