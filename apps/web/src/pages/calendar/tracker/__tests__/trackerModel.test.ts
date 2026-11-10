import { describe, it, expect } from 'vitest';
import { formatShortDate, formatShortDateTime } from '@mmp/shared';
import {
  applyTrackerFilters,
  approvalDateOf,
  filtersFromParams,
  filtersToParams,
  monthOptions,
  nextDueOf,
  ownerLabels,
  postingOwnerOf,
  turnaroundText,
  type TrackerPiece,
  type TrackerStage,
} from '../trackerModel';

const st = (stageKey: string, order: number, over: Partial<TrackerStage> = {}): TrackerStage =>
  ({ _id: `${stageKey}-${order}`, stageKey, stageOrder: order, status: 'Not Started', dueDate: '2026-11-20T00:00:00.000Z', isLocked: order > 1, isSkipped: false, revisions: 0, ...over }) as TrackerStage;
const piece = (id: string, over: Partial<TrackerPiece> = {}): TrackerPiece => ({
  _id: id, topic: `Topic ${id}`, postingDate: '2026-11-25T00:00:00.000Z', contentType: 'Reel', pipeline: 'reel_a', needsScript: true, needsShoot: true,
  rowStatus: 'approved', stages: [st('Script', 1), st('Shoot', 2), st('Edit', 3), st('Post', 4)],
  hasNeedsOwner: false, hasWaitingApproval: false, hasBlocked: false, hasOverdue: false, planId: { _id: 'p', code: `PLAN-${id}`, title: 'Plan' },
  ...over,
});

const rows: TrackerPiece[] = [
  piece('a', { priority: 'Urgent', hasOverdue: true, stages: [st('Script', 1, { status: 'Approved' }), st('Shoot', 2, { status: 'In Progress', isLocked: false, ownerId: { _id: 'u1', name: 'Ravi Shooter' } }), st('Edit', 3), st('Post', 4)] }),
  piece('b', { needsScript: false, needsShoot: false, postingDate: '2026-11-21T00:00:00.000Z', stages: [st('Edit', 1, { status: 'Blocked', isLocked: false, dueDate: '2026-11-19T00:00:00.000Z' }), st('Post', 2)], hasBlocked: true }),
  piece('c', { contentType: 'Carousel Post', needsScript: false, needsShoot: false, needsContent: false, postingDate: '2026-11-19T00:00:00.000Z', publishedAt: '2026-11-19T10:00:00.000Z', stages: [st('Design', 1, { status: 'Approved', approvedAt: '2026-11-17T08:00:00.000Z' }), st('Post', 2, { status: 'Published', ownerId: { _id: 'u2', name: 'Pia Poster' } })], turnaroundDays: 9 }),
  piece('d', { topic: 'Draft faculty spotlight', contentType: 'Static Post', needsScript: false, needsShoot: false, rowStatus: 'draft', stages: [] }),
  piece('e', { postingDate: '2026-12-10T00:00:00.000Z', stages: [st('Script', 1, { dueDate: '2026-12-02T00:00:00.000Z' }), st('Shoot', 2), st('Edit', 3), st('Post', 4)], hasNeedsOwner: true }),
];
const ids = (list: TrackerPiece[]) => list.map((p) => p._id);
const f = (q: string) => filtersFromParams(new URLSearchParams(q));

describe('Tracker filters', () => {
  it('approved rows only by default; rows with no steps only under "Not approved yet"', () => {
    expect(ids(applyTrackerFilters(rows, f('')))).toEqual(['c', 'b', 'a', 'e']);
    expect(ids(applyTrackerFilters(rows, f('status=not_approved')))).toEqual(['d']);
  });

  it('each filter, and combinations', () => {
    expect(ids(applyTrackerFilters(rows, f('q=plan-b')))).toEqual(['b']);
    expect(ids(applyTrackerFilters(rows, f('q=topic a')))).toEqual(['a']);
    expect(ids(applyTrackerFilters(rows, f('workflow=edit_only')))).toEqual(['b']);
    expect(ids(applyTrackerFilters(rows, f('workflow=design_only')))).toEqual(['c']);
    expect(ids(applyTrackerFilters(rows, f('step=Shoot')))).toEqual(['a']);
    expect(ids(applyTrackerFilters(rows, f('step=done')))).toEqual(['c']);
    expect(ids(applyTrackerFilters(rows, f('owner=u1')))).toEqual(['a']);
    expect(ids(applyTrackerFilters(rows, f('status=overdue')))).toEqual(['a']);
    expect(ids(applyTrackerFilters(rows, f('status=blocked')))).toEqual(['b']);
    expect(ids(applyTrackerFilters(rows, f('status=posted')))).toEqual(['c']);
    expect(ids(applyTrackerFilters(rows, f('status=on_track')))).toEqual(['e']);
    expect(ids(applyTrackerFilters(rows, f('status=needs_owner')))).toEqual(['e']);
    expect(ids(applyTrackerFilters(rows, f('urgent=1')))).toEqual(['a']);
    // Combined: all must match.
    expect(ids(applyTrackerFilters(rows, f('workflow=full&status=overdue&urgent=1')))).toEqual(['a']);
    expect(ids(applyTrackerFilters(rows, f('workflow=full&status=blocked')))).toEqual([]);
  });

  it('sorts by publish date (default) or next due date, with no due date last', () => {
    expect(ids(applyTrackerFilters(rows, f('')))).toEqual(['c', 'b', 'a', 'e']);
    expect(ids(applyTrackerFilters(rows, f('sort=due')))).toEqual(['b', 'a', 'e', 'c']);
    expect(nextDueOf(rows[2])).toBeNull();
  });

  it('round-trips through the URL, keeps other parameters, and reads older links', () => {
    const base = new URLSearchParams('tab=tracker&needsOwner=true');
    const legacy = filtersFromParams(base);
    expect(legacy.status).toBe('needs_owner');
    const next = filtersToParams({ ...legacy, q: 'walk', month: '2026-11', workflow: 'edit_only', urgent: true, sort: 'due' }, base);
    expect(next.get('tab')).toBe('tracker');
    expect(next.get('needsOwner')).toBeNull();
    expect(Object.fromEntries(next)).toMatchObject({ status: 'needs_owner', q: 'walk', month: '2026-11', workflow: 'edit_only', urgent: '1', sort: 'due' });
    expect(filtersFromParams(next)).toEqual({ ...legacy, q: 'walk', month: '2026-11', workflow: 'edit_only', urgent: true, sort: 'due' });
    // Older step-status links still apply.
    expect(f('stageStatus=Blocked').stageStatus).toBe('Blocked');
    // Bad values are dropped.
    expect(f('month=Nov&workflow=quick&status=x&sort=owner')).toMatchObject({ month: '', workflow: '', status: '', sort: 'publish' });
  });

  it('month list is built around today', () => {
    const opts = monthOptions(new Date('2026-11-09T10:00:00Z'));
    expect(opts).toHaveLength(13);
    expect(opts[0]).toEqual({ value: '2026-05', label: 'May 2026' });
    expect(opts[12]).toEqual({ value: '2027-05', label: 'May 2027' });
    expect(monthOptions(new Date('2026-11-09T10:00:00Z'), '2025-01')[0].value).toBe('2025-01');
  });
});

describe('Tracker owner labels', () => {
  it('first name only, unless two different people share it: then first name + last initial', () => {
    const l = ownerLabels([
      { _id: '1', name: 'Ravi Shooter' },
      { _id: '2', name: 'Ravi Editor' },
      { _id: '3', name: 'Asha Writer' },
      { _id: '1', name: 'Ravi Shooter' }, // the same person on another step counts once
      null,
    ]);
    expect(Object.fromEntries(l)).toEqual({ '1': 'Ravi S.', '2': 'Ravi E.', '3': 'Asha' });
    expect(Object.fromEntries(ownerLabels([{ _id: '1', name: 'Ravi Shooter' }, { _id: '3', name: 'Asha Writer' }]))).toEqual({ '1': 'Ravi', '3': 'Asha' });
  });

  it('first names compare without case; a one-word name stays as is; a clash after the initial shows full names', () => {
    expect(Object.fromEntries(ownerLabels([{ _id: '1', name: 'test Writer One' }, { _id: '2', name: 'Test Designer Two' }, { _id: '3', name: 'Production Team' }, { _id: '4', name: 'Production' }]))).toEqual({
      '1': 'test O.', '2': 'Test T.', '3': 'Production T.', '4': 'Production',
    });
    expect(Object.fromEntries(ownerLabels([{ _id: '1', name: 'Test Writer Two' }, { _id: '2', name: 'Test Editor Two' }, { _id: '3', name: 'Test Poster' }]))).toEqual({
      '1': 'Test Writer Two', '2': 'Test Editor Two', '3': 'Test P.',
    });
  });
});

describe('Tracker display', () => {
  it('Turnaround: "—" when empty, "N days" when set', () => {
    expect(turnaroundText(null)).toBe('—');
    expect(turnaroundText(undefined)).toBe('—');
    expect(turnaroundText(0)).toBe('0 days');
    expect(turnaroundText(1)).toBe('1 day');
    expect(turnaroundText(9)).toBe('9 days');
  });

  it('one date format: "16 Nov", year only when not the current year (IST day)', () => {
    const now = new Date('2026-11-09T10:00:00Z');
    expect(formatShortDate('2026-11-16T00:00:00.000Z', now)).toBe('16 Nov');
    expect(formatShortDate('2027-01-03T00:00:00.000Z', now)).toBe('3 Jan 2027');
    expect(formatShortDate('2026-11-30T20:00:00.000Z', now)).toBe('1 Dec');
    expect(formatShortDate(null, now)).toBe('');
    expect(formatShortDateTime('2026-11-16T08:35:00.000Z', now)).toBe('16 Nov, 14:05');
  });

  it('Approval and Posting owner come from the steps', () => {
    expect(approvalDateOf(rows[2])).toBe('2026-11-17T08:00:00.000Z');
    expect(approvalDateOf(rows[0])).toBeNull();
    expect(postingOwnerOf(rows[2])?.name).toBe('Pia Poster');
    expect(postingOwnerOf(rows[0])).toBeNull();
  });
});
