import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { translate } from '../src/lib/i18n';
import { SunshineNow } from '../src/components/SunshineNow';
import { ApplianceList } from '../src/components/ApplianceList';
import { useAppStore } from '../src/state/useAppStore';
import { exampleProfiles } from '../src/data/profiles';
import { mockForecast } from '../src/data/mockForecast';
import { scaleForecast } from '../src/lib/netload';

const FROZEN = new Date('2026-05-15T06:05:00.000Z');

describe('translate()', () => {
  it('returns English unchanged and falls back for unknown strings', () => {
    expect(translate('en', 'Right now')).toBe('Right now');
    expect(translate('ms', 'Right now')).toBe('Sekarang');
    expect(translate('ms', 'a string with no translation')).toBe('a string with no translation');
  });

  it('interpolates variables in both languages', () => {
    expect(translate('en', 'WAIT UNTIL {time}', { time: '3:44 pm' })).toBe('WAIT UNTIL 3:44 pm');
    expect(translate('ms', 'WAIT UNTIL {time}', { time: '3:44 pm' })).toBe('TUNGGU 3:44 pm');
  });

  it('translates the four confidence words and regime titles', () => {
    expect(translate('ms', 'Good confidence')).toBe('Keyakinan baik');
    expect(translate('ms', 'Storm building')).toBe('Ribut sedang terbentuk');
  });
});

describe('Bahasa Malaysia rendering', () => {
  beforeEach(() => {
    useAppStore.setState({ region: 'peninsular', lang: 'ms', profiles: exampleProfiles });
  });

  it('SunshineNow renders in BM', () => {
    const scaled = scaleForecast(mockForecast('peninsular', FROZEN), 5);
    render(<SunshineNow forecast={scaled} />);
    expect(screen.getByText(/rumah anda berjalan dengan cahaya matahari/)).toBeInTheDocument();
  });

  it('recommendations render appliance names and actions in BM', () => {
    const scaled = scaleForecast(mockForecast('peninsular', FROZEN), 5);
    render(<ApplianceList forecast={scaled} />);
    expect(screen.getByText('Cadangan')).toBeInTheDocument();
    expect(screen.getByText('Mesin basuh')).toBeInTheDocument(); // washing machine
    expect(screen.getAllByText('GUNA SEKARANG').length).toBeGreaterThan(0); // RUN NOW
  });
});
