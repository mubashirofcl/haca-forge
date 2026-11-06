import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CANONICAL_REVISION_ROOT_CAUSES } from '@mmp/shared';
import { DecisionBar } from '../review-studio/DecisionBar';
import { FeedbackPage } from '../FeedbackPage';
import { WorkDetailPage } from '../../work/WorkDetailPage';
import { IssuesBlockersPage } from '../../issues/IssuesBlockersPage';
import * as authContext from '../../../context/AuthContext';
import * as apiModule from '../../../lib/api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../lib/api', () => ({ apiFetch: vi.fn() }));

const apiFetch = apiModule.apiFetch as unknown as ReturnType<typeof vi.fn>;
const useAuth = authContext.useAuth as unknown as ReturnType<typeof vi.fn>;
const CANONICAL = [...CANONICAL_REVISION_ROOT_CAUSES];
const optionValues = (select: HTMLElement) => Array.from(select.querySelectorAll('option')).map((o) => o.value);
const now = new Date().toISOString();

const workItem = {
  _id: 'w1',
  title: 'Root cause test item',
  workType: 'Reel',
  deadline: now,
  status: 'Feedback',
  revisions: 4,
  reviewRequired: true,
  ownerId: { _id: 'owner-1', name: 'Sample Owner', email: 'o@example.invalid', role: 'team_member' },
};
const thread = (rootCause: string | null) => ({
  workItem,
  totalEntries: 0,
  revisions: 4,
  flag: { _id: 'f1', revisionsCount: 4, baselineAvg: 1.5, isFlagged: true, flaggedAt: now, rootCause },
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { _id: 'head-1', role: 'creative_head', name: 'Head' }, hasPermission: () => true });
});

describe('Revision root causes: only the 7 canonical values are offered', () => {
  it('Review Studio decision bar', () => {
    render(<DecisionBar hasComments commentCount={1} onApprove={vi.fn()} onRequestRevision={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /request revision/i }));
    expect(optionValues(screen.getByLabelText(/root cause/i))).toEqual(CANONICAL);
  });

  it('Work Detail Request Rework', async () => {
    apiFetch.mockImplementation((url: string) => {
      if (url === '/api/work/w1') {
        return Promise.resolve({ data: { ...workItem, status: 'Pending', stageKey: 'Content', latestSubmission: { _id: 's1', status: 'submitted', version: 1 } } });
      }
      return Promise.resolve({ data: [] });
    });
    render(
      <MemoryRouter initialEntries={['/work/w1']}>
        <Routes>
          <Route path="/work/:id" element={<WorkDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click((await screen.findAllByRole('button', { name: 'Request Rework' }))[0]);
    const dialog = screen.getByRole('dialog', { name: 'Request Rework' });
    expect(optionValues(within(dialog).getByLabelText(/root cause/i))).toEqual(CANONICAL);
  });

  it('Feedback Classify Root Cause', async () => {
    apiFetch.mockImplementation((url: string) => {
      if (url === '/api/feedback/threads') return Promise.resolve({ data: [thread(null)] });
      if (url === '/api/feedback/work-item/w1') return Promise.resolve({ data: { workItem, entries: [], rounds: [], flag: thread(null).flag } });
      return Promise.resolve({ data: [] });
    });
    render(<MemoryRouter initialEntries={['/feedback']}><FeedbackPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Root cause test item/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Classify Root Cause/ }));
    const dialog = screen.getByRole('dialog', { name: /Classify Revision Root Cause/ });
    expect(optionValues(within(dialog).getByLabelText(/canonical root causes/i))).toEqual(CANONICAL);
  });

  it('Issues & Blockers Classify Root Cause', async () => {
    apiFetch.mockImplementation((url: string) => {
      if (url === '/api/revisions/flags') return Promise.resolve({ data: [{ _id: 'f1', workItemId: workItem, ownerId: workItem.ownerId, revisionsCount: 4, baselineAvg: 1.5, isFlagged: true, flaggedAt: now, rootCause: null }] });
      return Promise.resolve({ data: [] });
    });
    render(<MemoryRouter><IssuesBlockersPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Revision Flags/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Classify Root Cause/ }));
    const select = screen.getAllByRole('combobox').find((el) => optionValues(el).includes('Brief unclear'))!;
    expect(optionValues(select)).toEqual(CANONICAL);
  });
});

describe('Legacy root causes stay readable', () => {
  it('Feedback renders a flag saved with a legacy cause, without offering to change it', async () => {
    apiFetch.mockImplementation((url: string) => {
      if (url === '/api/feedback/threads') return Promise.resolve({ data: [thread('Script change')] });
      if (url === '/api/feedback/work-item/w1') return Promise.resolve({ data: { workItem, entries: [], rounds: [], flag: thread('Script change').flag } });
      return Promise.resolve({ data: [] });
    });
    render(<MemoryRouter initialEntries={['/feedback']}><FeedbackPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Root cause test item/ }));
    expect(await screen.findByText('Script change')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Classify Root Cause/ })).not.toBeInTheDocument();
    // Reading never writes: only GET requests were made.
    expect(apiFetch.mock.calls.every(([, opts]: any[]) => !opts || !opts.method || opts.method === 'GET')).toBe(true);
  });

  it('Issues & Blockers renders a flag saved with a legacy cause', async () => {
    apiFetch.mockImplementation((url: string) => {
      if (url === '/api/revisions/flags') return Promise.resolve({ data: [{ _id: 'f2', workItemId: workItem, ownerId: workItem.ownerId, revisionsCount: 5, baselineAvg: 1.5, isFlagged: true, flaggedAt: now, rootCause: 'Visual defect', classifiedBy: { name: 'Earlier Lead' } }] });
      return Promise.resolve({ data: [] });
    });
    render(<MemoryRouter><IssuesBlockersPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Revision Flags/ }));
    expect(await screen.findByText('Visual defect')).toBeInTheDocument();
    expect(apiFetch.mock.calls.every(([, opts]: any[]) => !opts || !opts.method || opts.method === 'GET')).toBe(true);
  });
});
