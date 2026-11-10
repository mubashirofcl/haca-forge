import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TrackerTab } from '../../TrackerTab';
import * as authContext from '../../../../context/AuthContext';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: vi.fn() }));

const calls: string[] = [];
const st = (stageKey: string, order: number, over: Record<string, unknown> = {}) => ({
  _id: `${stageKey}-${order}-${Math.random()}`, stageKey, stageOrder: order, status: 'Not Started', dueDate: '2026-11-20T00:00:00.000Z', isLocked: order > 1, isSkipped: false, revisions: 0, ...over,
});
const PIECES = [
  {
    _id: 'p1', topic: 'Founder story', postingDate: '2026-11-20T00:00:00.000Z', contentType: 'Reel', workflowLabel: 'Reel · Full', calendar: 'sm', priority: 'Urgent',
    needsScript: true, needsShoot: true, pipeline: 'reel_a', rowStatus: 'approved', planId: { _id: 'pl', code: 'PLAN-2026-11-001', title: 'Nov' },
    stages: [st('Script', 1, { status: 'Approved' }), st('Shoot', 2, { status: 'In Progress', isLocked: false, ownerId: { _id: 'u1', name: 'Ravi Shooter' } }), st('Edit', 3), st('Post', 4)],
    hasOverdue: true, hasBlocked: false, hasNeedsOwner: false, hasWaitingApproval: false, turnaroundDays: null, waitingFormatted: '1d 1h', workTimeFormatted: '—', approvalWaitFormatted: '—', lateByFormatted: '1d', remarks: 'Shoot on Tuesday',
  },
  {
    _id: 'p2', topic: 'Campus walk cutdown', postingDate: '2026-11-22T00:00:00.000Z', contentType: 'Reel', workflowLabel: 'Reel · Edit only', calendar: 'sm',
    needsScript: false, needsShoot: false, pipeline: 'reel_c', rowStatus: 'approved', planId: { _id: 'pl', code: 'PLAN-2026-11-001', title: 'Nov' },
    stages: [st('Edit', 1, { status: 'Blocked', isLocked: false }), st('Post', 2)],
    hasOverdue: false, hasBlocked: true, hasNeedsOwner: false, hasWaitingApproval: false, turnaroundDays: 9,
  },
  {
    _id: 'p3', topic: 'Faculty spotlight (draft)', postingDate: '2026-11-29T00:00:00.000Z', contentType: 'Static Post', calendar: 'sm',
    needsScript: false, needsShoot: false, pipeline: 'design', rowStatus: 'draft', stages: [], hasOverdue: false, hasBlocked: false, hasNeedsOwner: false, hasWaitingApproval: false,
  },
];

vi.mock('../../../../lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    calls.push(url);
    if (url.startsWith('/api/content-pieces')) return { data: PIECES };
    return { data: [] };
  }),
}));

const Loc: React.FC = () => <div data-testid="loc">{useLocation().search}</div>;
const show = (path: string, role = 'sm_manager') => {
  (authContext.useAuth as any).mockReturnValue({ user: { role, name: 'User' }, hasPermission: () => true });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TrackerTab />
      <Loc />
    </MemoryRouter>
  );
};
const titles = () => screen.queryAllByTestId('tracker-row').map((r) => within(r).getAllByRole('button')[0].textContent);

beforeEach(() => {
  calls.length = 0;
});

describe('Content Flow Tracker', () => {
  it('shows approved rows with a count; filters write to the URL and survive a refresh', async () => {
    const first = show('/calendar?tab=tracker');
    await waitFor(() => expect(titles()).toEqual(['Founder story', 'Campus walk cutdown']));
    expect(screen.getByTestId('tracker-count')).toHaveTextContent('2 posts');

    fireEvent.change(screen.getByLabelText('Workflow'), { target: { value: 'edit_only' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'blocked' } });
    fireEvent.change(screen.getByLabelText('Month (publish date)'), { target: { value: '2026-11' } });
    await waitFor(() => expect(titles()).toEqual(['Campus walk cutdown']));
    const search = screen.getByTestId('loc').textContent!;
    expect(new URLSearchParams(search).get('workflow')).toBe('edit_only');
    expect(new URLSearchParams(search).get('status')).toBe('blocked');
    expect(new URLSearchParams(search).get('tab')).toBe('tracker');
    await waitFor(() => expect(calls.some((u) => u.includes('month=2026-11'))).toBe(true));
    expect(screen.getByRole('button', { name: 'Remove filter: Edit only' })).toBeInTheDocument();
    first.unmount();

    // "Refresh": the same URL brings back the same filters and rows.
    show(`/calendar${search}`);
    await waitFor(() => expect(titles()).toEqual(['Campus walk cutdown']));
    expect(screen.getByLabelText('Workflow')).toHaveValue('edit_only');
    expect(screen.getByLabelText('Status')).toHaveValue('blocked');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(titles()).toEqual(['Founder story', 'Campus walk cutdown']));
    expect(new URLSearchParams(screen.getByTestId('loc').textContent!).get('workflow')).toBeNull();
  });

  it('rows with no steps show only under "Not approved yet", labelled that way', async () => {
    show('/calendar?tab=tracker&status=not_approved');
    await waitFor(() => expect(titles()).toEqual(['Faculty spotlight (draft)']));
    expect(screen.getAllByText('Not approved yet').length).toBeGreaterThan(0);
  });

  it('the Profile "Needs owner" link applies the filter', async () => {
    show('/calendar?tab=tracker&needsOwner=true');
    await waitFor(() => expect(screen.getByLabelText('Status')).toHaveValue('needs_owner'));
    expect(screen.getByTestId('tracker-empty')).toBeInTheDocument();
  });

  it('a row: one date format, publish date, current state, and details on expand (Turnaround "—" or "N days")', async () => {
    show('/calendar?tab=tracker');
    await waitFor(() => expect(titles()).toHaveLength(2));
    const [founder, walk] = screen.getAllByTestId('tracker-row');
    expect(founder).toHaveTextContent('Publish date20 Nov');
    expect(within(founder).getByTestId('tracker-state')).toHaveTextContent('Shoot · In progress');
    expect(founder).toHaveTextContent('Due 20 Nov');
    expect(founder).not.toHaveTextContent(/\d+\/\d+\/\d{4}/);
    expect(within(founder).getByText('Urgent')).toBeInTheDocument();
    expect(within(founder).getByText('Reel · Full')).toBeInTheDocument();
    // Edit only: Script and Shoot are shown as not needed.
    expect(within(walk).getAllByText('Not needed')).toHaveLength(2);

    expect(within(founder).queryByTestId('tracker-details')).not.toBeInTheDocument();
    fireEvent.click(within(founder).getByRole('button', { name: 'Details' }));
    const details = within(founder).getByTestId('tracker-details');
    for (const label of ['Waiting', 'Work time', 'Approval wait', 'Late by', 'Approval', 'Posting owner', 'Turnaround', 'Remarks']) expect(details).toHaveTextContent(label);
    expect(details).toHaveTextContent('Waiting1d 1h');
    expect(details).toHaveTextContent('Turnaround—');
    expect(details).toHaveTextContent('RemarksShoot on Tuesday');
    fireEvent.click(within(walk).getByRole('button', { name: 'Details' }));
    expect(within(walk).getByTestId('tracker-details')).toHaveTextContent('Turnaround9 days');
  });

  it('roles: SM manager gets actions; executive sees the same rows with no actions', async () => {
    const sm = show('/calendar?tab=tracker');
    await waitFor(() => expect(titles()).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: /^Assign owners:/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Change publish date:/ })).toHaveLength(2);
    sm.unmount();
    show('/calendar?tab=tracker', 'executive');
    await waitFor(() => expect(titles()).toEqual(['Founder story', 'Campus walk cutdown']));
    expect(screen.queryByRole('button', { name: /^Assign owners:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Change publish date:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^More actions:/ })).not.toBeInTheDocument();
  });
});
