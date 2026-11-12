import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { WORKSPACES_LOCKED } from '@mmp/shared';
import { WorkspaceRoute } from '../pages/work/workspaces/WorkspaceLockedPage';
import { WorkDetailPage } from '../pages/work/WorkDetailPage';
import { MyWorkPage } from '../pages/work/MyWorkPage';
import { setWorkspacesLockedForTests, workspacesLocked } from '../lib/workspaceLock';
import * as authContext from '../context/AuthContext';
import * as apiModule from '../lib/api';
import appSource from '../App.tsx?raw';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../hooks/useSocket', () => ({ useSocket: () => ({ on: () => () => {}, emit: vi.fn() }) }));

const apiFetch = apiModule.apiFetch as unknown as ReturnType<typeof vi.fn>;
const useAuth = authContext.useAuth as unknown as ReturnType<typeof vi.fn>;

const WORKSPACE_PATHS = ['writing-studio', 'write', 'workspace', 'shoot', 'edit', 'design', 'post'];
const WORKSPACE_BUTTON = /Workspace|Writing Studio|bView Studio|View Clips/i;

const Where: React.FC = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
};

const showRoute = (segment: string) =>
  render(
    <MemoryRouter initialEntries={[`/work/w1/${segment}`]}>
      <Routes>
        <Route path={`/work/:id/${segment}`} element={<WorkspaceRoute><div data-testid="real-workspace">The workspace</div></WorkspaceRoute>} />
        <Route path="/work/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { _id: 'owner-1', role: 'team_member', name: 'Owner' }, hasPermission: () => true });
});
afterEach(() => setWorkspacesLockedForTests(null));

describe('Locked workspaces', () => {
  it('the one switch is on', () => {
    expect(WORKSPACES_LOCKED).toBe(true);
    expect(workspacesLocked()).toBe(true);
  });

  it('every workspace route in the app is behind the lock; Review Studio is not', () => {
    for (const segment of WORKSPACE_PATHS) {
      const at = appSource.indexOf(`path="/work/:id/${segment}"`);
      expect(at, segment).toBeGreaterThan(-1);
      const route = appSource.slice(at, appSource.indexOf('/>\n', appSource.indexOf('</ProtectedRoute>', at)));
      expect(route, segment).toContain('<WorkspaceRoute>');
    }
    for (const path of ['/work/:id/review', '/feedback/review-studio', '/feedback/review']) {
      const at = appSource.indexOf(`path="${path}"`);
      expect(at, path).toBeGreaterThan(-1);
      const route = appSource.slice(at, appSource.indexOf('</ProtectedRoute>', at));
      expect(route, path).toContain('<ReviewStudioPage />');
      expect(route, path).not.toContain('WorkspaceRoute');
    }
  });

  for (const segment of WORKSPACE_PATHS) {
    it(`/work/:id/${segment} shows the locked screen, not the workspace`, () => {
      showRoute(segment);
      expect(screen.getByTestId('workspace-locked')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'This workspace is locked for now' })).toBeInTheDocument();
      expect(screen.queryByTestId('real-workspace')).not.toBeInTheDocument();
    });
  }

  it('"Submit with a link" goes to the step and opens its submit dialog', () => {
    showRoute('shoot');
    fireEvent.click(screen.getByRole('button', { name: 'Submit with a link' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/work/w1?submit=1');
  });

  it('with the switch off, the same route shows the workspace again', () => {
    setWorkspacesLockedForTests(false);
    showRoute('workspace');
    expect(screen.getByTestId('real-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-locked')).not.toBeInTheDocument();
  });
});

describe('No workspace buttons while locked', () => {
  const detail = (stageKey: string, extra: any = {}) => ({
    _id: 'w1', title: `${stageKey} step`, workType: 'Reel', deadline: new Date().toISOString(), status: 'In Progress', revisions: 0, reviewRequired: stageKey !== 'Post',
    stageKey, stageOrder: 1, isLocked: false, ownerId: { _id: 'owner-1', name: 'Owner', email: 'o@example.invalid', role: 'team_member' }, ...extra,
  });
  const showDetail = (data: any) => {
    apiFetch.mockImplementation(async (url: string) => (url === '/api/work/w1' ? { data } : { data: [] }));
    render(
      <MemoryRouter initialEntries={['/work/w1']}>
        <Routes>
          <Route path="/work/:id" element={<WorkDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  for (const stageKey of ['Script', 'Content', 'Shoot', 'Edit', 'Design', 'Post']) {
    it(`Work Detail, ${stageKey} owner: no workspace button, and a link action instead`, async () => {
      showDetail(detail(stageKey));
      expect(await screen.findByRole('button', { name: stageKey === 'Post' ? 'Mark as posted' : 'Submit link' })).toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: WORKSPACE_BUTTON })).toHaveLength(0);
      expect(screen.queryByText(/Open .*Workspace|Open Writing Studio|Launch .* Workspace/)).not.toBeInTheDocument();
    });
  }

  it('Work Detail, reviewer: Review Studio stays available, no workspace button', async () => {
    useAuth.mockReturnValue({ user: { _id: 'head-1', role: 'creative_head', name: 'Head' }, hasPermission: () => true });
    showDetail(detail('Shoot', { status: 'Feedback', latestSubmission: { _id: 's1', status: 'submitted', version: 1, kind: 'link' } }));
    expect((await screen.findAllByRole('button', { name: /Open in Review Studio/ })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Approve Deliverable/ }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: WORKSPACE_BUTTON })).toHaveLength(0);
  });

  it('Work Detail, a step not started: Start work only', async () => {
    showDetail(detail('Edit', { status: 'Not Started' }));
    expect(await screen.findByRole('button', { name: 'Start work' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit link/ })).not.toBeInTheDocument();
  });

  it('with the switch off, the workspace buttons come back', async () => {
    setWorkspacesLockedForTests(false);
    showDetail(detail('Shoot'));
    expect((await screen.findAllByRole('button', { name: /Open Shoot Workspace/ })).length).toBeGreaterThan(0);
  });

  it('My Work: no workspace button on any step type', async () => {
    const steps = ['Script', 'Content', 'Shoot', 'Edit', 'Design', 'Post'].map((stageKey, i) => ({
      _id: `w${i}`, title: `${stageKey} card`, workType: 'Reel', stageKey, stageOrder: 1, status: 'In Progress', startedAt: new Date().toISOString(),
      deadline: '2031-11-05T00:00:00.000Z', priority: 'Normal', revisions: 0, isLocked: false, ownerId: 'owner-1',
    }));
    apiFetch.mockImplementation(async (url: string) =>
      url.includes('/my-work')
        ? { data: { overdue: [], today: steps, thisWeek: [], upcoming: [], completed: [], stats: { activeCount: 6, overdueCount: 0, todayCount: 6, completedCount: 0, avgRevisions: 0 } } }
        : { data: {} }
    );
    render(<MemoryRouter><MyWorkPage /></MemoryRouter>);
    expect(await screen.findAllByRole('button', { name: 'Submit link' })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Mark as posted' })).toHaveLength(1);
    expect(screen.queryAllByRole('button', { name: WORKSPACE_BUTTON })).toHaveLength(0);
  });
});
