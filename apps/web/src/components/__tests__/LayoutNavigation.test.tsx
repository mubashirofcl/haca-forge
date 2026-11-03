import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '../Layout';

let mockUser: any = null;
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({ data: [] }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('Layout Navigation for Canonical Roles', () => {
  it('renders My Work section for sm_manager in sidebar and navigation items', () => {
    mockUser = {
      _id: 'sm-mgr-1',
      name: 'Sam Manager',
      email: 'sam@haca.test',
      role: 'sm_manager',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Layout>
            <div>SM Dashboard Content</div>
          </Layout>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // SM Manager should have My Work in navigation
    const myWorkLinks = screen.getAllByRole('link', { name: /my work/i });
    expect(myWorkLinks.length).toBeGreaterThanOrEqual(1);

    const hasMyWorkHref = myWorkLinks.some((link) => link.getAttribute('href') === '/my-work');
    expect(hasMyWorkHref).toBe(true);

    // SM Manager also has Dashboard, Calendar, Work in navigation
    expect(screen.getAllByRole('link', { name: /calendar/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /dashboard/i }).length).toBeGreaterThan(0);
  });

  it('renders My Work for team_member as primary landing section', () => {
    mockUser = {
      _id: 'member-1',
      name: 'Taylor Creator',
      email: 'taylor@haca.test',
      role: 'team_member',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/my-work']}>
          <Layout>
            <div>Team Member Content</div>
          </Layout>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const myWorkLinks = screen.getAllByRole('link', { name: /my work/i });
    expect(myWorkLinks.length).toBeGreaterThanOrEqual(1);
  });
});
