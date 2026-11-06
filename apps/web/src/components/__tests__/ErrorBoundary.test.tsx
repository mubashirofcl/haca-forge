import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const Broken = (): JSX.Element => {
  throw new Error('Render failed on purpose');
};

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shows its children when nothing fails', () => {
    render(<ErrorBoundary><p>All good</p></ErrorBoundary>);
    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('catches a render error and shows the fallback with its actions', () => {
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Render failed on purpose')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return home/i })).toBeInTheDocument();
  });

  it('logs the caught error to the console', () => {
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(consoleError).toHaveBeenCalledWith(
      '[ErrorBoundary caught error]:',
      expect.objectContaining({ message: 'Render failed on purpose' }),
      expect.anything()
    );
  });

  it('uses a custom fallback when one is given', () => {
    render(<ErrorBoundary fallback={<p>Custom fallback</p>}><Broken /></ErrorBoundary>);
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
