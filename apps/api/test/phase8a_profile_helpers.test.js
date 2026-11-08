import { describe, it, expect } from 'vitest';
import {
  resolveProfilePeriod,
  previousProfilePeriod,
  inProfilePeriod,
  reviewStats,
  reviewerStats,
  reviewQueueAge,
  workerOnTime,
} from '@mmp/shared';

const HOUR = 3600000;

describe('Phase 8a: profile period', () => {
  const now = '2026-11-08T10:00:00.000Z';

  it('this month, last 3 months and a custom range, in IST days', () => {
    expect(resolveProfilePeriod('month', { now })).toMatchObject({ kind: 'month', from: '2026-11-01', to: '2026-11-30' });
    expect(resolveProfilePeriod('3months', { now })).toMatchObject({ kind: '3months', from: '2026-09-01', to: '2026-11-30' });
    expect(resolveProfilePeriod('custom', { now, from: '2026-10-05', to: '2026-10-20' })).toMatchObject({ kind: 'custom', from: '2026-10-05', to: '2026-10-20' });
  });

  it('a bad custom range falls back to this month', () => {
    expect(resolveProfilePeriod('custom', { now, from: '2026-10-20', to: '2026-10-05' }).kind).toBe('month');
    expect(resolveProfilePeriod('custom', { now, from: 'x', to: 'y' }).kind).toBe('month');
    expect(resolveProfilePeriod(undefined, { now }).kind).toBe('month');
  });

  it('IST month boundary: 1 Nov 00:30 IST is in November', () => {
    expect(resolveProfilePeriod('month', { now: '2026-10-31T19:00:00.000Z' }).from).toBe('2026-11-01');
    const nov = resolveProfilePeriod('month', { now });
    expect(inProfilePeriod('2026-10-31T19:00:00.000Z', nov)).toBe(true); // 00:30 IST on 1 Nov
    expect(inProfilePeriod('2026-10-31T18:00:00.000Z', nov)).toBe(false); // 23:30 IST on 31 Oct
    expect(inProfilePeriod(null, nov)).toBe(false);
  });

  it('the previous period has the same kind and length', () => {
    expect(previousProfilePeriod(resolveProfilePeriod('month', { now }))).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(previousProfilePeriod(resolveProfilePeriod('3months', { now }))).toMatchObject({ from: '2026-06-01', to: '2026-08-31' });
    expect(previousProfilePeriod(resolveProfilePeriod('custom', { now, from: '2026-10-05', to: '2026-10-14' }))).toMatchObject({ from: '2026-09-25', to: '2026-10-04' });
  });
});

describe('Phase 8a: review and rework figures', () => {
  it('counts review steps with a decision; Post is excluded', () => {
    const r = reviewStats([
      { stageKey: 'Script', status: 'Approved', revisions: 0 },
      { stageKey: 'Shoot', status: 'Approved', revisions: 2 },
      { stageKey: 'Edit', status: 'In Progress', revisions: 1 }, // sent back, not finished: reviewed
      { stageKey: 'Design', status: 'Feedback', revisions: 0 }, // waiting, no decision yet: not reviewed
      { stageKey: 'Post', status: 'Published', revisions: 3 }, // never counted
      { stageKey: 'Content', status: 'Approved', revisions: 0, changesRequested: true },
    ]);
    expect(r).toEqual({ reviewed: 4, withChangeRequest: 3, changesRequestedRate: 75, reworkRounds: 4, reworkRate: 1 });
    expect(reviewStats([])).toMatchObject({ reviewed: 0, changesRequestedRate: null, reworkRate: null });
  });

  it('late rate and done-late count, on the on-time base', () => {
    const r = workerOnTime([[{ kind: 'done_on_time' }], [{ kind: 'done_late' }], [{ kind: 'done_late' }, { kind: 'late_earlier_step' }]]);
    expect(r).toMatchObject({ onTime: 1, total: 2, rate: 50, late: 1, lateRate: 50, doneLateCount: 2, delayedByEarlier: 1 });
  });
});

describe('Phase 8a: Creative Head figures', () => {
  it('approvals vs changes requested, and the average wait from submission to decision', () => {
    const r = reviewerStats([
      { status: 'approved', submittedAt: '2026-11-01T00:00:00Z', reviewedAt: '2026-11-01T04:00:00Z' },
      { status: 'approved', submittedAt: '2026-11-02T00:00:00Z', reviewedAt: '2026-11-02T08:00:00Z' },
      { status: 'changes_requested', submittedAt: '2026-11-03T00:00:00Z', reviewedAt: '2026-11-03T06:00:00Z' },
      { status: 'approved', submittedAt: null, reviewedAt: '2026-11-04T06:00:00Z' }, // counted, no wait
      { status: 'submitted', submittedAt: '2026-11-04T00:00:00Z' }, // not a decision
    ]);
    expect(r).toEqual({ reviews: 4, approvals: 3, changesRequested: 1, avgWaitMs: 6 * HOUR, waitBasedOn: 3 });
    expect(reviewerStats([]).avgWaitMs).toBeNull();
  });

  it('the oldest item in the team review queue', () => {
    const now = '2026-11-08T12:00:00Z';
    expect(reviewQueueAge([{ submittedAt: '2026-11-08T09:00:00Z' }, { submittedAt: '2026-11-06T12:00:00Z' }], now)).toMatchObject({ waiting: 2, oldestMs: 48 * HOUR });
    expect(reviewQueueAge([], now)).toEqual({ waiting: 0, oldestMs: null, oldestSubmittedAt: null });
  });
});
