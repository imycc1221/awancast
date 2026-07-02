import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExplainPanel } from '../src/components/ExplainPanel';

const REASON = 'Solar is strong now and a storm is approaching. Run before the convective window starts.';

describe('ExplainPanel', () => {
  it('hides the explanation until the user opens it', () => {
    render(<ExplainPanel explanation={REASON} />);
    expect(screen.getByRole('button', { name: /Why\?/ })).toBeInTheDocument();
    expect(screen.queryByText(REASON)).not.toBeInTheDocument();
  });

  it('reveals the explanation and the deterministic disclosure on click', () => {
    render(<ExplainPanel explanation={REASON} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(REASON)).toBeInTheDocument();
    expect(
      screen.getByText("This is the reason behind Awan-Cast's recommendation."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tell me less/ })).toBeInTheDocument();
  });

  it('shows the AI disclosure when aiGenerated is set', () => {
    render(<ExplainPanel explanation={REASON} aiGenerated />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/This explanation is AI-generated/)).toBeInTheDocument();
  });

  it('collapses again when toggled off', () => {
    render(<ExplainPanel explanation={REASON} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByText(REASON)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText(REASON)).not.toBeInTheDocument();
  });
});
