import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

let currentRole = 'executive';

vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { _id: 'u1', id: 'u1', name: 'Test User', role: currentRole, permissions: [] },
    isAuthenticated: true,
    isLoading: false,
    hasPermission: () => true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('../lib/api', () => ({ apiFetch: vi.fn(async () => ({ data: [], success: true })) }));
vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ isConnected: false, socket: null, on: vi.fn().mockReturnValue(() => {}), joinTask: vi.fn(), leaveTask: vi.fn(), emitTyping: vi.fn() }),
}));

import { App } from '../App';
import { ErrorBoundary } from '../components/ErrorBoundary';

afterEach(() => cleanup());

const visit = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

describe('My Work by URL', () => {
  it('an executive is redirected to /dashboard', async () => {
    currentRole = 'executive';
    visit('/my-work');
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'), { timeout: 5000 });
  });

  it('a team member stays on My Work', async () => {
    currentRole = 'team_member';
    visit('/my-work');
    await new Promise((r) => setTimeout(r, 50));
    expect(window.location.pathname).toBe('/my-work');
  });
});

describe('error fallback', () => {
  it('has no "diagnostics" wording', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    spy.mockRestore();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/couldn't be shown because of an unexpected error/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/diagnostics/i);
  });
});
