import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewStudioPage } from '../review-studio/ReviewStudioPage';
import { FeedbackPage } from '../FeedbackPage';
import { MyWorkPage } from '../../work/MyWorkPage';
import { WorkDetailPage } from '../../work/WorkDetailPage';
import { ShootReviewView } from '../../work/workspaces/ShootReviewView';
import * as authContext from '../../../context/AuthContext';
import * as apiModule from '../../../lib/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => mockNavigate }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../../../hooks/useSocket', () => ({ useSocket: () => ({ on: () => () => {}, emit: vi.fn() }) }));

const apiFetch = apiModule.apiFetch as unknown as ReturnType<typeof vi.fn>;
const useAuth = authContext.useAuth as unknown as ReturnType<typeof vi.fn>;
const stale = (message: string) => Object.assign(new Error(message), { statusCode: 409, code: 'STALE_SUBMISSION' });
const asHead = () => useAuth.mockReturnValue({ user: { _id: 'head-1', role: 'creative_head', name: 'Head' }, hasPermission: () => true });
const asOwner = () => useAuth.mockReturnValue({ user: { _id: 'owner-1', role: 'team_member', name: 'Owner' }, hasPermission: () => true });
const posts = (part: string) => apiFetch.mock.calls.filter(([url, opts]: any[]) => String(url).includes(part) && opts?.method === 'POST');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('Review Studio: a stale or decided version', () => {
  const sub = {
    id: 's1',
    _id: 's1',
    version: 1,
    kind: 'document',
    status: 'submitted',
    document: { htmlSnapshot: '<p>Draft</p>' },
    workItemId: { _id: 'w1', title: 'Script step', stageKey: 'Script', ownerId: { name: 'Owner' } },
  };

  const showStudio = (decide: () => Promise<any>, queueAfter: any[] = []) => {
    let queueCalls = 0;
    apiFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url === '/api/submissions/review-queue') {
        queueCalls += 1;
        return queueCalls === 1 ? [sub] : queueAfter;
      }
      if (opts?.method === 'POST') return decide();
      if (url.includes('/api/submissions/s1')) return sub;
      return [];
    });
    render(<MemoryRouter initialEntries={['/feedback/review-studio']}><ReviewStudioPage /></MemoryRouter>);
    return () => queueCalls;
  };

  it('shows why and refreshes the queue when an approval gets a 409', async () => {
    asHead();
    const queueCalls = showStudio(() => Promise.reject(stale('This version is out of date. Version 2 is the latest.')));
    fireEvent.click(await screen.findByLabelText(/4 stars/i));
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('This version is out of date. Version 2 is the latest.');
    expect(notice).toHaveTextContent('The review queue has been refreshed.');
    await waitFor(() => expect(queueCalls()).toBe(2));
    expect(window.alert).not.toHaveBeenCalled();
    expect(await screen.findByText(/All Caught Up/i)).toBeInTheDocument();
  });

  it('other failures are still reported as errors, and do not refresh', async () => {
    asHead();
    const queueCalls = showStudio(() => Promise.reject(Object.assign(new Error('Server error'), { statusCode: 500 })));
    fireEvent.click(await screen.findByLabelText(/4 stars/i));
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Server error'));
    expect(queueCalls()).toBe(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Shoot review', () => {
  const clips = (statuses: string[]) => ({
    clips: statuses.map((status, i) => ({ _id: `c${i}`, stageItemId: 'w1', kind: 'video', title: `Clip ${i}`, url: '/c.mp4', take: 1, status, unreadCount: 0 })),
    shotList: [],
    coverage: '',
  });

  it('a 409 is passed up, so Review Studio can explain and refresh', async () => {
    asHead();
    const onStaleDecision = vi.fn();
    apiFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/shoot-review') && opts?.method === 'POST') throw stale('This step has already been approved.');
      if (url.includes('/clips')) return clips(['approved']);
      return [];
    });
    render(<ShootReviewView stageItemId="w1" workItemTitle="Shoot" onStaleDecision={onStaleDecision} />);
    fireEvent.click(await screen.findByRole('button', { name: /approve step/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Approve & Unlock/i }));
    await waitFor(() => expect(onStaleDecision).toHaveBeenCalledWith('This step has already been approved.'));
    expect(window.alert).not.toHaveBeenCalled();
  });
});

describe('Feedback page cannot approve', () => {
  const workItem = { _id: 'w1', title: 'Feedback step', workType: 'Reel', deadline: new Date().toISOString(), status: 'Feedback', revisions: 0, reviewRequired: true, ownerId: { _id: 'owner-1', name: 'Owner', role: 'team_member' } };
  const show = async () => {
    apiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/feedback/threads') return { data: [{ workItem, totalEntries: 0, revisions: 0, flag: null }] };
      if (url === '/api/feedback/work-item/w1') return { data: { workItem, entries: [], rounds: [], flag: null } };
      return { data: {} };
    });
    render(<MemoryRouter initialEntries={['/feedback']}><FeedbackPage /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Feedback step'));
  };

  it('has no approve option, and a reviewer can only request a revision', async () => {
    asHead();
    await show();
    fireEvent.change(await screen.findByPlaceholderText(/specific changes needed/i), { target: { value: 'Please trim this' } });
    expect(screen.queryByRole('radio', { name: /Approved/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Request Revision' }));
    await waitFor(() => expect(posts('/api/feedback/work-item/w1')).toHaveLength(1));
    expect(JSON.parse(posts('/api/feedback/work-item/w1')[0][1].body).roundStatus).toBe('Revision Required');
  });

  it('an sm_manager sees no decision form', async () => {
    useAuth.mockReturnValue({ user: { _id: 'sm-1', role: 'sm_manager', name: 'SM' }, hasPermission: () => true });
    await show();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/feedback/work-item/w1'));
    expect(screen.queryByRole('button', { name: 'Request Revision' })).not.toBeInTheDocument();
  });
});

describe('My Work submit button', () => {
  const myWork = (stageKey: string) => ({
    data: {
      overdue: [],
      today: [{ _id: 'w1', title: `${stageKey} step`, workType: 'Reel', stageKey, stageOrder: 1, status: 'In Progress', startedAt: new Date().toISOString(), deadline: '2031-11-05T00:00:00.000Z', priority: 'Normal', revisions: 0, isLocked: false, ownerId: 'owner-1' }],
      thisWeek: [],
      upcoming: [],
      completed: [],
      stats: { activeCount: 1, overdueCount: 0, todayCount: 1, completedCount: 0, avgRevisions: 0 },
    },
  });
  const show = (stageKey: string) => {
    asOwner();
    apiFetch.mockImplementation(async (url: string) => (url.includes('/my-work') ? myWork(stageKey) : { data: {} }));
    render(<MemoryRouter><MyWorkPage /></MemoryRouter>);
  };

  it('a Shoot owner goes to the Shoot workspace; nothing is approved', async () => {
    show('Shoot');
    fireEvent.click(await screen.findByRole('button', { name: /Submit for approval/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/work/w1/shoot');
    expect(posts('/transition')).toHaveLength(0);
    expect(screen.queryByText(/Done and forward/)).not.toBeInTheDocument();
  });

  it('other steps still open the submit form and go to review, not approved', async () => {
    show('Edit');
    fireEvent.click(await screen.findByRole('button', { name: /Submit for approval/ }));
    const submit = await screen.findByRole('button', { name: 'Submit to Creative Head' });
    expect(mockNavigate).not.toHaveBeenCalled();
    const form = submit.closest('form')!;
    fireEvent.change(within(form).getAllByRole('textbox')[0], { target: { value: 'https://example.test/cut' } });
    fireEvent.submit(form);
    await waitFor(() => expect(posts('/transition')).toHaveLength(1));
    expect(JSON.parse(posts('/transition')[0][1].body).toStatus).toBe('Feedback');
  });
});

describe('Work Detail', () => {
  const item = (extra: any) => ({ _id: 'w1', title: 'Detail step', workType: 'Reel', deadline: new Date().toISOString(), status: 'Pending', revisions: 0, reviewRequired: true, stageKey: 'Content', ownerId: { _id: 'owner-1', name: 'Owner', email: 'o@example.invalid', role: 'team_member' }, ...extra });
  const show = (data: any) => {
    apiFetch.mockImplementation(async (url: string) => (url === '/api/work/w1' ? { data } : { data: [] }));
    render(
      <MemoryRouter initialEntries={['/work/w1']}>
        <Routes>
          <Route path="/work/:id" element={<WorkDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
  };
  const approveFromDetail = async () => {
    fireEvent.click((await screen.findAllByRole('button', { name: /Approve Deliverable/ }))[0]);
    fireEvent.submit((await screen.findByRole('button', { name: /Approve & Advance Stage/ })).closest('form')!);
  };

  it('a review step with no submission shows a message and calls nothing', async () => {
    asHead();
    show(item({}));
    await approveFromDetail();
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('no submission to review yet')));
    expect(posts('/transition')).toHaveLength(0);
    expect(posts('/approve')).toHaveLength(0);
  });

  it('a step that does not require review keeps the /transition approval', async () => {
    asHead();
    show(item({ reviewRequired: false }));
    await approveFromDetail();
    await waitFor(() => expect(posts('/transition')).toHaveLength(1));
    expect(JSON.parse(posts('/transition')[0][1].body).toStatus).toBe('Approved');
  });

  it('a Shoot owner goes to the Shoot workspace to submit', async () => {
    asOwner();
    show(item({ status: 'In Progress', stageKey: 'Shoot', isLocked: false }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    expect(mockNavigate).toHaveBeenCalledWith('/work/w1/shoot');
    expect(posts('/transition')).toHaveLength(0);
  });
});
