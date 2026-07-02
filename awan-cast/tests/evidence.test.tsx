import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceView } from '../src/components/EvidenceView';
import { evidenceSections } from '../src/data/evidence';

describe('evidence data', () => {
  it('carries the headline verified numbers', () => {
    const all = evidenceSections.flatMap((s) => s.metrics);
    const values = all.map((m) => m.value);
    expect(values).toContain('+33.5%');
    expect(values).toContain('92.1%');
    expect(values).toContain('4.19 K');
    expect(values).toContain('0.86 → 0.94');
    expect(values).toContain('≈ RM 638k/yr');
  });

  it('tags the commercial figures as projections, not measured', () => {
    const commercial = evidenceSections.find((s) => s.title.includes('Commercial'))!;
    expect(commercial.metrics.every((m) => m.measured === false)).toBe(true);
  });

  it('tags the forecasting results as measured', () => {
    const onset = evidenceSections.find((s) => s.title.includes('storm onset'))!;
    expect(onset.metrics.every((m) => m.measured === true)).toBe(true);
  });
});

describe('EvidenceView', () => {
  it('renders the thesis, the diagrams, and key numbers', () => {
    render(<EvidenceView />);
    expect(screen.getByText(/three times larger/i)).toBeInTheDocument();
    expect(screen.getAllByText('+33.5%').length).toBeGreaterThan(0); // onset gain + Petaling Jaya
    expect(screen.getByText('92.1%')).toBeInTheDocument();
    // both diagrams embedded
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    // measured vs projected tags present
    expect(screen.getAllByText('MEASURED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROJECTED').length).toBeGreaterThan(0);
  });
});
