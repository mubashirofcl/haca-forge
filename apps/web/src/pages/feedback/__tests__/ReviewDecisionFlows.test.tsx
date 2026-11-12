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

  it('clears the rating after a stale refresh, so it cannot carry over to the newer version', async () => {
    asHead();
    const newer = { ...sub, id: 's2', _id: 's2', version: 2 };
    apiFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url === '/api/submissions/review-queue') return apiFetch.mock.calls.filter(([u]: any[]) => u === url).length === 1 ? [sub] : [newer];
      if (opts?.method === 'POST') throw stale('This version is out of date.');
      if (url.includes('/api/submissions/s2')) return newer;
      if (url.includes('/api/submissions/s1')) return sub;
      return [];
    });
    render(<MemoryRouter initialEntries={['/feedback/review-studio']}><ReviewStudioPage /></MemoryRouter>);
    fireEvent.click(await screen.findByLabelText(/4 stars/i));
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled());
    expect(screen.queryByText('4/5')).not.toBeInTheDocument();
    expect(posts('/approve')).toHaveLength(1);
  });

  it('clears the rating when the review item changes', async () => {
    asHead();
    const next = { ...sub, id: 's2', _id: 's2', workItemId: { ...sub.workItemId, _id: 'w2', title: 'Other step' } };
    apiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/submissions/review-queue') return [sub, next];
      if (url.includes('/api/submissions/s2')) return next;
      if (url.includes('/api/submissions/s1')) return sub;
      return [];
    });
    render(<MemoryRouter initialEntries={['/feedback/review-studio']}><ReviewStudioPage /></MemoryRouter>);
    fireEvent.click(await screen.findByLabelText(/4 stars/i));
    expect(screen.getByRole('button', { name: /approve/i })).not.toBeDisabled();
    fireEvent.keyDown(window, { key: ']' });
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled());
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

  const showItem = (extra: any) => {
    asOwner();
    const data = myWork('Edit');
    Object.assign(data.data.today[0], extra);
    apiFetch.mockImplementation(async (url: string) => (url.includes('/my-work') ? data : { data: {} }));
    render(<MemoryRouter><MyWorkPage /></MemoryRouter>);
  };

  const DRIVE = 'https://drive.google.com/file/d/cut/view';
  const fillAndSend = async (value: string) => {
    const dialog = await screen.findByTestId('step-submit-dialog');
    fireEvent.change(within(dialog).getAllByRole('textbox')[0], { target: { value } });
    fireEvent.submit(dialog.querySelector('form')!);
    return dialog;
  };

  it('after a Shoot send-back, rework in progress is resubmitted with a link, not in the workspace', async () => {
    showItem({ stageKey: 'Shoot', title: 'Shoot step', status: 'In Progress', revisions: 1, latestSubmissionStatus: 'changes_requested' });
    fireEvent.click(await screen.findByRole('button', { name: 'Resubmit link' }));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('Rework in progress')).toBeInTheDocument();
    await fillAndSend(DRIVE);
    await waitFor(() => expect(posts('/submit-link')).toHaveLength(1));
    expect(JSON.parse(posts('/submit-link')[0][1].body).links).toEqual([DRIVE]);
    expect(posts('/transition')).toHaveLength(0);
  });

  it('a resubmitted step shows as waiting for approval, with nothing to submit or block', async () => {
    showItem({ status: 'Feedback', revisions: 1, latestSubmissionStatus: 'submitted' });
    expect((await screen.findAllByText('Waiting for approval')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Changes requested')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resubmit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit link/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start rework/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark blocked/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request help/ })).not.toBeInTheDocument();
  });

  it('changes requested shows the reviewer note and Start rework, which moves the step to In Progress', async () => {
    showItem({ status: 'Feedback', revisions: 1, latestSubmissionStatus: 'changes_requested', latestFeedback: { text: 'Trim the intro', reviewer: 'Head' } });
    expect(await screen.findByText('Changes requested')).toBeInTheDocument();
    expect(screen.getByText(/Trim the intro/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resubmit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit link/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start rework' }));
    await waitFor(() => expect(posts('/transition')).toHaveLength(1));
    expect(JSON.parse(posts('/transition')[0][1].body).toStatus).toBe('In Progress');
    expect(posts('/submit-link')).toHaveLength(0);
  });

  it('a Shoot owner submits with a link; there is no workspace button and nothing is approved', async () => {
    show('Shoot');
    expect(await screen.findByRole('button', { name: 'Submit link' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Workspace/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit link' }));
    await fillAndSend('https://drive.google.com/drive/folders/footage');
    await waitFor(() => expect(posts('/submit-link')).toHaveLength(1));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(posts('/transition')).toHaveLength(0);
    expect(screen.queryByText(/Done and forward/)).not.toBeInTheDocument();
  });

  it('an invalid link is refused in the dialog and nothing is sent', async () => {
    show('Edit');
    fireEvent.click(await screen.findByRole('button', { name: 'Submit link' }));
    const dialog = await fillAndSend('https://example.test/cut');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('drive.google.com');
    expect(within(dialog).getByText(/shared with HACA reviewers/)).toBeInTheDocument();
    expect(posts('/submit-link')).toHaveLength(0);
    fireEvent.change(within(dialog).getAllByRole('textbox')[0], { target: { value: DRIVE } });
    fireEvent.change(within(dialog).getByLabelText(/Note to the reviewer/), { target: { value: 'First cut' } });
    fireEvent.submit(dialog.querySelector('form')!);
    await waitFor(() => expect(posts('/submit-link')).toHaveLength(1));
    expect(JSON.parse(posts('/submit-link')[0][1].body)).toEqual({ links: [DRIVE], note: 'First cut' });
  });

  it('Design takes several links; other steps take one', async () => {
    show('Design');
    fireEvent.click(await screen.findByRole('button', { name: 'Submit link' }));
    const dialog = await screen.findByTestId('step-submit-dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add another link' }));
    const boxes = within(dialog).getAllByRole('textbox');
    fireEvent.change(boxes[0], { target: { value: 'https://drive.google.com/file/d/slide-1/view' } });
    fireEvent.change(boxes[1], { target: { value: 'https://drive.google.com/file/d/slide-2/view' } });
    fireEvent.submit(dialog.querySelector('form')!);
    await waitFor(() => expect(posts('/submit-link')).toHaveLength(1));
    expect(JSON.parse(posts('/submit-link')[0][1].body).links).toEqual(['https://drive.google.com/file/d/slide-1/view', 'https://drive.google.com/file/d/slide-2/view']);
  });

  it('a step other than Design has no way to add a second link', async () => {
    show('Script');
    fireEvent.click(await screen.findByRole('button', { name: 'Submit link' }));
    const dialog = await screen.findByTestId('step-submit-dialog');
    expect(within(dialog).queryByRole('button', { name: 'Add another link' })).not.toBeInTheDocument();
  });

  it('a Post step is marked posted with only the live link: no caption, no file upload', async () => {
    show('Post');
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as posted' }));
    const dialog = await screen.findByTestId('step-submit-dialog');
    expect(within(dialog).queryByText(/caption/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/hashtag/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Note to the reviewer/)).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(1);
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'http://instagram.com/p/x' } });
    fireEvent.submit(dialog.querySelector('form')!);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('https://');
    expect(posts('/transition')).toHaveLength(0);
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'https://www.instagram.com/reel/abc/' } });
    fireEvent.submit(dialog.querySelector('form')!);
    await waitFor(() => expect(posts('/transition')).toHaveLength(1));
    expect(JSON.parse(posts('/transition')[0][1].body)).toEqual({ toStatus: 'Published', publishedUrl: 'https://www.instagram.com/reel/abc/' });
  });

  it('a failed submit keeps the dialog open and shows the error', async () => {
    asOwner();
    apiFetch.mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'POST') throw Object.assign(new Error('This step is already waiting for approval.'), { statusCode: 409 });
      return url.includes('/my-work') ? myWork('Edit') : { data: {} };
    });
    render(<MemoryRouter><MyWorkPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit link' }));
    await fillAndSend(DRIVE);
    expect(await screen.findByTestId('step-submit-error')).toHaveTextContent('already waiting for approval');
    expect(screen.getByTestId('step-submit-dialog')).toBeInTheDocument();
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

  it('an owner under review has no blocked or help actions', async () => {
    asOwner();
    show(item({ status: 'Feedback', isLocked: false, latestSubmission: { _id: 's1', status: 'submitted', version: 1 } }));
    expect(await screen.findByTestId('owner-waiting')).toHaveTextContent('Waiting for approval (version 1)');
    expect(screen.queryByText('Changes requested')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit link|Resubmit link|Start rework/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark blocked/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request help/ })).not.toBeInTheDocument();
  });

  it('a Shoot owner submits with a link on Work Detail; no workspace buttons are shown', async () => {
    asOwner();
    show(item({ status: 'In Progress', stageKey: 'Shoot', isLocked: false }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit link' }));
    expect(mockNavigate).not.toHaveBeenCalled();
    const dialog = await screen.findByTestId('step-submit-dialog');
    expect(screen.queryByRole('button', { name: /Workspace|Writing Studio/ })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Google Drive link' }), { target: { value: 'https://drive.google.com/drive/folders/footage' } });
    fireEvent.submit(dialog.querySelector('form')!);
    await waitFor(() => expect(posts('/submit-link')).toHaveLength(1));
    expect(posts('/transition')).toHaveLength(0);
  });

  it('changes requested: the reviewer message and notes, then Start rework, then Resubmit link', async () => {
    asOwner();
    const sentBack = item({
      status: 'Feedback',
      stageKey: 'Edit',
      isLocked: false,
      revisions: 1,
      latestSubmission: { _id: 's1', status: 'changes_requested', version: 1 },
      latestFeedback: { text: 'Trim the intro', reviewer: 'Head', rootCause: 'Brief unclear', notes: [{ text: 'Logo is too small', author: 'Head' }] },
    });
    show(sentBack);
    const note = await screen.findByTestId('changes-requested-note');
    expect(note).toHaveTextContent('Changes requested by Head');
    expect(note).toHaveTextContent('Trim the intro');
    expect(note).toHaveTextContent('Cause: Brief unclear');
    expect(note).toHaveTextContent('Logo is too small');
    expect(screen.queryByRole('button', { name: /Submit link|Resubmit link/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start rework' }));
    await waitFor(() => expect(posts('/transition')).toHaveLength(1));
    expect(JSON.parse(posts('/transition')[0][1].body)).toEqual({ toStatus: 'In Progress' });
  });

  it('rework in progress offers Resubmit link and shows the rework time', async () => {
    asOwner();
    const start = Date.now() - 3 * 3600000;
    show(
      item({
        status: 'In Progress',
        stageKey: 'Edit',
        isLocked: false,
        revisions: 1,
        startedAt: new Date(start).toISOString(),
        latestSubmission: { _id: 's1', status: 'changes_requested', version: 1 },
        rounds: [
          { roundNumber: 1, startedAt: new Date(start).toISOString(), submittedAt: new Date(start + 3600000).toISOString(), decision: 'changes_requested', decisionAt: new Date(start + 2 * 3600000).toISOString(), intervals: [] },
          { roundNumber: 2, startedAt: new Date(Date.now() - 130 * 60000).toISOString(), intervals: [] },
        ],
      })
    );
    expect(await screen.findByRole('button', { name: 'Resubmit link' })).toBeInTheDocument();
    expect(screen.getAllByText('Rework in progress').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Start rework' })).not.toBeInTheDocument();
    expect(screen.getByTestId('rework-time')).toHaveTextContent('Rework time');
    expect(screen.getByTestId('rework-time')).toHaveTextContent('2h 10m');
  });

  it('a step never sent back shows no rework time', async () => {
    asOwner();
    show(item({ status: 'In Progress', stageKey: 'Edit', isLocked: false, rounds: [{ roundNumber: 1, startedAt: new Date(Date.now() - 3600000).toISOString(), intervals: [] }] }));
    await screen.findByRole('button', { name: 'Submit link' });
    expect(screen.queryByTestId('rework-time')).not.toBeInTheDocument();
  });

  it('From earlier steps lists every approved link, including the Shoot link and every Design link', async () => {
    asOwner();
    show(
      item({
        status: 'In Progress',
        stageKey: 'Post',
        isLocked: false,
        handoff: [
          { workItemId: 'a', stageKey: 'Shoot', ownerName: 'Shooter', version: 2, items: [{ url: 'https://drive.google.com/drive/folders/footage', kind: 'drive' }], clips: [] },
          { workItemId: 'b', stageKey: 'Design', ownerName: 'Designer', version: 1, items: [{ url: 'https://drive.google.com/file/d/s1/view', name: 'Link 1', kind: 'drive' }, { url: 'https://drive.google.com/file/d/s2/view', name: 'Link 2', kind: 'drive' }], clips: [] },
        ],
      })
    );
    const panel = await screen.findByTestId('earlier-steps-panel');
    expect(within(panel).getByText('From earlier steps')).toBeInTheDocument();
    const hrefs = within(panel).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://drive.google.com/drive/folders/footage', 'https://drive.google.com/file/d/s1/view', 'https://drive.google.com/file/d/s2/view']);
    for (const link of within(panel).getAllByRole('link')) expect(link).toHaveAttribute('target', '_blank');
    expect(within(panel).getByText(/approved version 2/)).toBeInTheDocument();
  });

  it('with no handoff from the API (a viewer not allowed to see it), the panel is not shown', async () => {
    asOwner();
    show(item({ status: 'In Progress', stageKey: 'Edit', isLocked: false }));
    await screen.findByRole('button', { name: 'Submit link' });
    expect(screen.queryByTestId('earlier-steps-panel')).not.toBeInTheDocument();
  });

  it('?submit=1 from the locked workspace screen opens the submit dialog for the owner', async () => {
    asOwner();
    apiFetch.mockImplementation(async (url: string) => (url === '/api/work/w1' ? { data: item({ status: 'In Progress', stageKey: 'Edit', isLocked: false }) } : { data: [] }));
    render(
      <MemoryRouter initialEntries={['/work/w1?submit=1']}>
        <Routes>
          <Route path="/work/:id" element={<WorkDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId('step-submit-dialog')).toBeInTheDocument();
  });

  it('?submit=1 opens nothing for someone who is not the owner', async () => {
    asHead();
    apiFetch.mockImplementation(async (url: string) => (url === '/api/work/w1' ? { data: item({ status: 'In Progress', stageKey: 'Edit', isLocked: false }) } : { data: [] }));
    render(
      <MemoryRouter initialEntries={['/work/w1?submit=1']}>
        <Routes>
          <Route path="/work/:id" element={<WorkDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findAllByText('Detail step');
    expect(screen.queryByTestId('step-submit-dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit link/ })).not.toBeInTheDocument();
  });
});
