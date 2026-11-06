import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLE_PERMISSIONS, type UserRole } from '@mmp/shared';
import { IssuesBlockersPage } from '../IssuesBlockersPage';
import * as apiModule from '../../../lib/api';

// Permissions come from the real role matrix, so the test reflects actual access.
let mockUser: { _id: string; name: string; role: UserRole } | null = null;
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    hasPermission: (perm: string) =>
      Boolean(mockUser && (ROLE_PERMISSIONS[mockUser.role] as readonly string[]).includes(perm)),
  }),
}));

const activeBlocker = {
  _id: 'b1',
  reason: 'Waiting for content',
  notes: 'Need the final copy',
  status: 'Active',
  blockedAt: new Date().toISOString(),
  durationHours: 5,
  workItemId: {
    _id: 'w1',
    title: 'Admission Poster',
    workType: 'Poster',
    deadline: new Date().toISOString(),
    status: 'Blocked',
    ownerId: { _id: 'u-owner', name: 'Writer One' },
  },
  blockedById: { _id: 'u2', name: 'Writer One' },
  dependencyOwnerId: { _id: 'u3', name: 'Designer One', jobRole: 'Designer' },
};

beforeEach(() => {
  vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (url: string) => {
    if (url.startsWith('/api/blockers')) return { data: [activeBlocker] } as any;
    return { data: [] } as any;
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <IssuesBlockersPage />
    </MemoryRouter>
  );
}

describe('Issues and Blockers: executive is read-only', () => {
  it('shows no report, ping or resolve actions to executive', async () => {
    mockUser = { _id: 'u-exec', name: 'Test Executive', role: 'executive' };
    renderPage();
    await waitFor(() => expect(screen.getByText('Admission Poster')).toBeInTheDocument());
    expect(screen.queryByText(/Report Deliverable Blocker/i)).toBeNull();
    expect(screen.queryByText(/Ping Owner/i)).toBeNull();
    expect(screen.queryByText(/Resolve & Unblock/i)).toBeNull();
  });

  it('keeps the actions for the team member who owns the step', async () => {
    mockUser = { _id: 'u-owner', name: 'Writer One', role: 'team_member' };
    renderPage();
    await waitFor(() => expect(screen.getByText('Admission Poster')).toBeInTheDocument());
    expect(screen.getByText(/Report Deliverable Blocker/i)).toBeInTheDocument();
    expect(screen.getByText(/Ping Owner/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolve & Unblock/i)).toBeInTheDocument();
  });

  it('shows no ping or resolve to a team member who does not own the step', async () => {
    mockUser = { _id: 'u-tm', name: 'Designer One', role: 'team_member' };
    renderPage();
    await waitFor(() => expect(screen.getByText('Admission Poster')).toBeInTheDocument());
    expect(screen.queryByText(/Ping Owner/i)).toBeNull();
    expect(screen.queryByText(/Resolve & Unblock/i)).toBeNull();
  });
});
