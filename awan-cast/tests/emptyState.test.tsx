import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApplianceList } from '../src/components/ApplianceList';
import { PrimaryAction } from '../src/components/PrimaryAction';
import { useAppStore } from '../src/state/useAppStore';
import { exampleProfiles } from '../src/data/profiles';
import { mockForecast } from '../src/data/mockForecast';

const FROZEN = new Date('2026-05-15T06:05:00.000Z');

describe('empty appliance setup (process still makes sense)', () => {
  beforeEach(() => {
    useAppStore.setState({
      region: 'peninsular',
      profiles: {
        ...exampleProfiles,
        peninsular: { ...exampleProfiles.peninsular, appliances: {} },
      },
    });
  });

  it('the recommendations panel invites the user to add appliances instead of going blank', () => {
    render(<ApplianceList forecast={mockForecast('peninsular', FROZEN)} />);
    expect(screen.getByText(/No schedulable appliances/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add appliances/ })).toBeInTheDocument();
  });

  it('the hero invites setup instead of disappearing', () => {
    render(<PrimaryAction forecast={mockForecast('peninsular', FROZEN)} />);
    expect(screen.getByText(/cheapest solar windows/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add appliances/ })).toBeInTheDocument();
  });
});
