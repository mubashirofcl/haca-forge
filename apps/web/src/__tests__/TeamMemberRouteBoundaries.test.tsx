import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

let currentRole = 'team_member';

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
// The real header/sidebar are out of scope; render the page area only.
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
const apiCalls: string[] = [];
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    apiCalls.push(String(url));
    return { data: [], success: true };
  }),
}));
vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ isConnected: false, socket: null, on: vi.fn().mockReturnValue(() => {}), joinTask: vi.fn(), leaveTask: vi.fn(), emitTyping: vi.fn() }),
}));

import { App } from '../App';

const ROUTES: Array<{ path: string; heading: RegExp }> = [
  { path: '/reports', heading: /report/i },
  { path: '/workload', heading: /workload/i },
  { path: '/feedback', heading: /feedback/i },
  { path: '/issues', heading: /issues|blockers/i },
];

const visit = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

// These routes are lazy-loaded. The first render of each page used to compile its module
// inside the test, which under a busy full-suite run could take longer than the default 1s
// wait and fail "other roles still get the page". Load the modules once up front so every
// render resolves from the cache; the longer waits below are a safety margin only.
beforeAll(async () => {
  await Promise.all([
    import('../pages/reports/ReportsPage'),
    import('../pages/workload/TeamWorkloadPage'),
    import('../pages/feedback/FeedbackPage'),
    import('../pages/issues/IssuesBlockersPage'),
  ]);
}, 30000);
const WAIT = { timeout: 5000 };

beforeEach(() => {
  apiCalls.length = 0;
});
afterEach(() => cleanup());

describe('team_member route boundaries', () => {
  for (const { path, heading } of ROUTES) {
    it(`${path}: team_member gets the not-found state and no page data is requested`, async () => {
      currentRole = 'team_member';
      visit(path);
      expect(await screen.findByRole('heading', { name: /page not found/i }, WAIT)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1, name: heading })).not.toBeInTheDocument();
      // The page never mounted, so none of its counts or lists were fetched.
      expect(apiCalls.filter((u) => !u.startsWith('/api/auth'))).toEqual([]);
      expect(screen.queryAllByRole('table')).toHaveLength(0);
    });

    it(`${path}: other roles still get the page`, async () => {
      currentRole = 'sm_manager';
      visit(path);
      // The page mounted and asked for its own data (the stub data shape is not the point here).
      await waitFor(() => expect(apiCalls.filter((u) => !u.startsWith('/api/auth')).length).toBeGreaterThan(0), WAIT);
      expect(screen.queryByRole('heading', { name: /page not found/i })).not.toBeInTheDocument();
    });
  }
});
