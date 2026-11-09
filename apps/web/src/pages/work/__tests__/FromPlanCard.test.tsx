import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FromPlanCard } from '../FromPlanCard';

describe('From the plan', () => {
  it('shows the brief and, for Edit only, the source video link', () => {
    render(
      <FromPlanCard
        fromPlan={{ brief: 'Cut the campus footage', workflow: 'edit_only', workflowLabel: 'Reel · Edit only', items: [{ url: 'https://drive.google.com/file/d/raw', name: 'Source video', kind: 'drive' }] }}
      />
    );
    const card = screen.getByRole('region', { name: 'From the plan' });
    expect(card).toHaveTextContent('Cut the campus footage');
    expect(card).toHaveTextContent('Reel · Edit only');
    const link = screen.getByRole('link', { name: /Source video/ });
    expect(link).toHaveAttribute('href', 'https://drive.google.com/file/d/raw');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('a first step without a brief says so; later steps show nothing', () => {
    const { rerender } = render(<FromPlanCard fromPlan={{ brief: '', items: [] }} />);
    expect(screen.getByText('No brief was written for this row.')).toBeInTheDocument();
    rerender(<FromPlanCard fromPlan={null} />);
    expect(screen.queryByRole('region', { name: 'From the plan' })).not.toBeInTheDocument();
  });
});
