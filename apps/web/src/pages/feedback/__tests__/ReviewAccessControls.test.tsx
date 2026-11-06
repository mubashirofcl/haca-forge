import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReviewStudioPage } from '../review-studio/ReviewStudioPage';
import { ImageViewer } from '../review-studio/ImageViewer';
import { ShootReviewView } from '../../work/workspaces/ShootReviewView';
import { IssuesBlockersPage } from '../../issues/IssuesBlockersPage';
import * as authContext from '../../../context/AuthContext';
import * as apiModule from '../../../lib/api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../../../hooks/useSocket', () => ({ useSocket: () => ({ on: () => () => {}, emit: vi.fn() }) }));

const apiFetch = apiModule.apiFetch as unknown as ReturnType<typeof vi.fn>;
const useAuth = authContext.useAuth as unknown as ReturnType<typeof vi.fn>;
const signIn = (role: string, _id = `${role}-1`, canManage = role !== 'executive') =>
  useAuth.mockReturnValue({ user: { _id, role, name: role }, hasPermission: () => canManage });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Review Studio controls by role', () => {
  const video = {
    id: 's1',
    _id: 's1',
    version: 1,
    kind: 'video',
    status: 'submitted',
    files: [{ url: 'https://example.test/v.mp4' }],
    workItemId: { _id: 'w1', title: 'Edit step', stageKey: 'Edit', ownerId: { _id: 'owner-1', name: 'Owner' } },
  };
  const showStudio = async () => {
    apiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/submissions/review-queue') return [video];
      if (url.includes('/api/submissions/s1')) return video;
      return [];
    });
    render(<MemoryRouter initialEntries={['/feedback/review-studio']}><ReviewStudioPage /></MemoryRouter>);
    await screen.findAllByText('Edit step');
  };

  it.each(['sm_manager', 'executive'])('%s gets no decision or comment controls', async (role) => {
    signIn(role);
    await showStudio();
    expect(screen.queryByRole('button', { name: /^approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request revision/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /post comment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comment @/i })).not.toBeInTheDocument();
  });

  it.each(['creative_head', 'admin'])('%s can decide and comment', async (role) => {
    signIn(role);
    await showStudio();
    expect(screen.getByRole('button', { name: /^approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request revision/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /post comment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comment @/i })).toBeInTheDocument();
  });

  it('the step owner can comment but cannot decide', async () => {
    signIn('team_member', 'owner-1');
    await showStudio();
    expect(screen.getByRole('button', { name: /post comment/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request revision/i })).not.toBeInTheDocument();
  });
});

describe('Image pins', () => {
  it('cannot start a pin without a comment handler', () => {
    render(<ImageViewer images={['https://example.test/a.png']} />);
    fireEvent.click(screen.getByAltText('Slide 1'));
    expect(screen.queryByRole('button', { name: /add pin at centre/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});

describe('Shoot clip threads', () => {
  const load = () => {
    signIn('executive');
    apiFetch.mockImplementation(async (url: string) => {
      if (url.includes('/messages')) return [];
      if (url.includes('/clips')) {
        return {
          clips: [{ _id: 'c0', stageItemId: 'w1', kind: 'video', title: 'Clip', url: '/c.mp4', take: 1, status: 'approved', unreadCount: 0 }],
          shotList: [],
          coverage: '',
        };
      }
      return [];
    });
  };
  const askedForMessages = () => apiFetch.mock.calls.some(([url]: any[]) => String(url).includes('/messages'));

  it('are not loaded for a viewer who cannot read them', async () => {
    load();
    render(<ShootReviewView stageItemId="w1" workItemTitle="Shoot" readOnly canSeeThreads={false} />);
    await screen.findAllByText('Clip');
    expect(askedForMessages()).toBe(false);
  });

  it('are loaded for a viewer who can', async () => {
    load();
    render(<ShootReviewView stageItemId="w1" workItemTitle="Shoot" readOnly />);
    await waitFor(() => expect(askedForMessages()).toBe(true));
  });
});

describe('Blocker actions by role', () => {
  const blocker = {
    _id: 'b1',
    reason: 'Other',
    notes: 'Waiting',
    status: 'Active',
    blockedAt: new Date().toISOString(),
    blockedById: { _id: 'owner-1', name: 'Owner' },
    dependencyOwnerId: { _id: 'dep-1', name: 'Dependency' },
    workItemId: { _id: 'w1', title: 'Edit step', ownerId: { _id: 'owner-1', name: 'Owner' } },
  };
  const showIssues = async () => {
    apiFetch.mockImplementation(async (url: string) => (url.startsWith('/api/blockers') ? { data: [blocker] } : { data: [] }));
    render(<MemoryRouter><IssuesBlockersPage /></MemoryRouter>);
    await screen.findByText('Edit step');
  };
  const actions = () => ({
    resolve: screen.queryByRole('button', { name: /resolve/i }),
    notify: screen.queryByRole('button', { name: /ping owner/i }),
  });

  it.each(['admin', 'sm_manager'])('%s can resolve and notify', async (role) => {
    signIn(role);
    await showIssues();
    expect(actions().resolve).toBeInTheDocument();
    expect(actions().notify).toBeInTheDocument();
  });

  it('a creative head can only act on a step they own', async () => {
    signIn('creative_head');
    await showIssues();
    expect(actions().resolve).not.toBeInTheDocument();
    expect(actions().notify).not.toBeInTheDocument();
  });

  it('a creative head who owns the step can act on it', async () => {
    signIn('creative_head', 'owner-1');
    await showIssues();
    expect(actions().resolve).toBeInTheDocument();
  });

  it('an executive cannot act', async () => {
    signIn('executive');
    await showIssues();
    expect(actions().resolve).not.toBeInTheDocument();
    expect(actions().notify).not.toBeInTheDocument();
  });
});
