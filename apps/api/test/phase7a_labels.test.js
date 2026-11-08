import { describe, it, expect } from 'vitest';
import {
  istDateKey,
  istDayDiff,
  istWeekKey,
  overdueDays,
  stepTimeLabels,
  workerOnTime,
  isFirstPassApproval,
  isFirstPassCandidate,
  stepElapsedWork,
  ratingAverage,
  projectDelivery,
  projectTimeLabel,
  firstSubmittedAt,
} from '@mmp/shared';

const HOUR = 3600000;
const kinds = (labels) => labels.map((l) => l.kind);
// Due on 10 Nov 2026 (IST), stored three ways real records use.
const DUE_UTC_MIDNIGHT = '2026-11-10T00:00:00.000Z'; // 05:30 IST on the 10th
const DUE_IST_MIDNIGHT = '2026-11-09T18:30:00.000Z'; // 00:00 IST on the 10th
const DUE_LATE_EVENING = '2026-11-10T18:00:00.000Z'; // 23:30 IST on the 10th

describe('Phase 7a: IST dates', () => {
  it('reads the three stored due-date forms as the same IST day', () => {
    expect([DUE_UTC_MIDNIGHT, DUE_IST_MIDNIGHT, DUE_LATE_EVENING].map(istDateKey)).toEqual(['2026-11-10', '2026-11-10', '2026-11-10']);
  });

  it('counts calendar days in IST, not hours', () => {
    expect(istDayDiff('2026-11-10T18:29:59.999Z', DUE_UTC_MIDNIGHT)).toBe(0); // 23:59:59 IST
    expect(istDayDiff('2026-11-10T18:30:00.000Z', DUE_UTC_MIDNIGHT)).toBe(1); // 00:00 IST next day
    expect(overdueDays(DUE_IST_MIDNIGHT, '2026-11-12T10:00:00.000Z')).toBe(2);
  });

  it('weeks start on Monday in IST', () => {
    expect(istWeekKey('2026-11-08T19:00:00.000Z')).toBe('2026-11-09'); // Mon 00:30 IST
    expect(istWeekKey('2026-11-08T18:00:00.000Z')).toBe('2026-11-02'); // Sun 23:30 IST
  });
});

describe('Phase 7a: step labels', () => {
  const base = { stageKey: 'Script', isLocked: false, dueDate: DUE_UTC_MIDNIGHT, unlockedAt: '2026-11-05T05:00:00.000Z' };

  it('11:59 PM IST on the due date is on time; midnight is a day late', () => {
    const onTime = stepTimeLabels({ ...base, status: 'Approved', submittedAt: '2026-11-10T18:29:00.000Z' });
    const late = stepTimeLabels({ ...base, status: 'Approved', submittedAt: '2026-11-10T18:31:00.000Z' });
    expect(onTime).toEqual([{ kind: 'done_on_time', text: 'Done on time' }]);
    expect(late).toEqual([{ kind: 'done_late', text: 'Done 1 day late', days: 1 }]);
  });

  it('uses the first submission, not a later resubmission', () => {
    const labels = stepTimeLabels({
      ...base, status: 'Approved', submittedAt: '2026-11-09T10:00:00.000Z', resubmittedAt: '2026-11-14T10:00:00.000Z',
      rounds: [{ startedAt: '2026-11-08T10:00:00.000Z', submittedAt: '2026-11-09T10:00:00.000Z' }, { startedAt: '2026-11-12T10:00:00.000Z', submittedAt: '2026-11-14T10:00:00.000Z' }],
    });
    expect(kinds(labels)).toEqual(['done_on_time']);
  });

  it('a Post step is judged by its posting time', () => {
    expect(firstSubmittedAt({ stageKey: 'Post', postedAt: '2026-11-12T05:00:00.000Z', submittedAt: '2026-11-01T05:00:00.000Z' }).toISOString()).toBe('2026-11-12T05:00:00.000Z');
    expect(kinds(stepTimeLabels({ ...base, stageKey: 'Post', status: 'Published', postedAt: '2026-11-12T05:00:00.000Z' }))).toEqual(['done_late']);
  });

  it('history fill overrides a missing first submission', () => {
    expect(stepTimeLabels({ ...base, status: 'Approved' })).toEqual([]);
    expect(kinds(stepTimeLabels({ ...base, status: 'Approved' }, { firstSubmitted: '2026-11-13T05:00:00.000Z' }))).toEqual(['done_late']);
  });

  it('Overdue only when unlocked and unfinished, from the day after the due date', () => {
    expect(stepTimeLabels({ ...base, status: 'In Progress' }, { now: '2026-11-10T18:29:00.000Z' })).toEqual([]);
    expect(stepTimeLabels({ ...base, status: 'In Progress' }, { now: '2026-11-12T05:00:00.000Z' })).toEqual([{ kind: 'overdue', text: 'Overdue by 2 days', days: 2 }]);
  });

  it('a locked past-due step shows "Waiting: earlier step late", never Overdue', () => {
    const labels = stepTimeLabels({ ...base, status: 'Not Started', isLocked: true, unlockedAt: null }, { now: '2026-11-12T05:00:00.000Z' });
    expect(labels).toEqual([{ kind: 'waiting_earlier_step_late', text: 'Waiting: earlier step late' }]);
    expect(kinds(labels)).not.toContain('overdue');
  });

  it('a step unlocked after its due date shows "Late: earlier step" and keeps it once finished late', () => {
    const lateUnlock = { ...base, unlockedAt: '2026-11-11T05:00:00.000Z' };
    expect(kinds(stepTimeLabels({ ...lateUnlock, status: 'In Progress' }, { now: '2026-11-12T05:00:00.000Z' }))).toEqual(['overdue', 'late_earlier_step']);
    expect(kinds(stepTimeLabels({ ...lateUnlock, status: 'Approved', submittedAt: '2026-11-13T05:00:00.000Z' }))).toEqual(['done_late', 'late_earlier_step']);
  });

  it('Blocked N days from the active blocker, not on a finished step', () => {
    expect(stepTimeLabels({ ...base, status: 'Blocked' }, { now: '2026-11-09T05:00:00.000Z', blockedSince: '2026-11-06T05:00:00.000Z' })).toEqual([{ kind: 'blocked', text: 'Blocked 3 days', days: 3 }]);
    expect(stepTimeLabels({ ...base, status: 'Approved', submittedAt: '2026-11-09T05:00:00.000Z' }, { blockedSince: '2026-11-06T05:00:00.000Z' }).map((l) => l.kind)).toEqual(['done_on_time']);
  });

  it('a skipped step has no labels', () => {
    expect(stepTimeLabels({ ...base, status: 'Not Started', isSkipped: true }, { now: '2026-12-01T05:00:00.000Z' })).toEqual([]);
  });
});

describe('Phase 7a: worker on-time rate', () => {
  it('leaves "Late: earlier step" steps out of the count and the total, and reports them', () => {
    const r = workerOnTime([
      [{ kind: 'done_on_time' }],
      [{ kind: 'done_late' }],
      [{ kind: 'done_late' }, { kind: 'late_earlier_step' }],
      [{ kind: 'done_on_time' }, { kind: 'late_earlier_step' }],
      [{ kind: 'overdue' }],
    ]);
    expect(r).toMatchObject({ onTime: 1, total: 2, rate: 50, delayedByEarlier: 2, delayedText: '2 steps delayed by earlier steps' });
    expect(workerOnTime([]).rate).toBeNull();
  });
});

describe('Phase 7a: KPIs', () => {
  const t0 = new Date('2026-11-02T04:30:00.000Z');
  const at = (h) => new Date(t0.getTime() + h * HOUR);

  it('elapsed work time excludes blocked and paused time and counts submitted rounds only', () => {
    const step = {
      status: 'Feedback',
      rounds: [
        { startedAt: at(0), submittedAt: at(10), intervals: [{ kind: 'blocked', startedAt: at(1), endedAt: at(3) }, { kind: 'paused', startedAt: at(5), endedAt: at(6) }] },
        { startedAt: at(12) },
      ],
    };
    expect(stepElapsedWork(step)).toEqual({ ms: 7 * HOUR, fromHistory: false });
  });

  it('older steps without rounds use history and are marked partial', () => {
    expect(stepElapsedWork({ status: 'Approved' }, { startedAt: at(0), firstSubmittedAt: at(4) })).toEqual({ ms: 4 * HOUR, fromHistory: true });
    expect(stepElapsedWork({ status: 'Approved' }, {})).toBeNull();
  });

  it('an average needs 3 ratings, otherwise "Collecting baseline"', () => {
    expect(ratingAverage([5, 4])).toEqual({ count: 2, average: null, text: 'Collecting baseline' });
    expect(ratingAverage([5, 4, 4])).toEqual({ count: 3, average: 4.3, text: '4.3' });
  });

  it('first-pass approval: review steps only, never Post', () => {
    expect(isFirstPassCandidate({ stageKey: 'Post', status: 'Published' })).toBe(false);
    expect(isFirstPassCandidate({ stageKey: 'Script', status: 'Approved' })).toBe(true);
    expect(isFirstPassCandidate({ stageKey: 'Script', status: 'Feedback' })).toBe(false);
    expect(isFirstPassApproval({ revisions: 0, rounds: [{ decision: 'approved' }] })).toBe(true);
    expect(isFirstPassApproval({ revisions: 1 })).toBe(false);
    expect(isFirstPassApproval({ revisions: 0, rounds: [{ decision: 'changes_requested' }, { decision: 'approved' }] })).toBe(false);
    expect(isFirstPassApproval({ revisions: 0 }, { changesRequested: true })).toBe(false);
  });
});

describe('Phase 7a: project labels', () => {
  const piece = { contentType: 'Reel', postingDate: DUE_UTC_MIDNIGHT };
  const steps = (postStatus, postedAt) => [{ stageKey: 'Script', status: 'Approved' }, { stageKey: 'Post', status: postStatus, postedAt }];

  it('Overdue: the publish date passed and it is not posted', () => {
    const d = projectDelivery(piece, steps('Not Started'));
    expect(d.delivered).toBe(false);
    expect(projectTimeLabel(piece, d, { now: '2026-11-10T18:29:00.000Z' })).toBeNull();
    expect(projectTimeLabel(piece, d, { now: '2026-11-11T05:00:00.000Z' })).toMatchObject({ kind: 'overdue', days: 1 });
  });

  it('Completed late: posted after the publish date; on the day is not late', () => {
    expect(projectTimeLabel(piece, projectDelivery(piece, steps('Published', '2026-11-10T18:00:00.000Z')))).toBeNull();
    expect(projectTimeLabel(piece, projectDelivery(piece, steps('Published', '2026-11-12T05:00:00.000Z')))).toMatchObject({ kind: 'completed_late', text: 'Completed 2 days late' });
  });

  it('falls back to the piece published time when the Post step has no posting time', () => {
    const d = projectDelivery({ ...piece, publishedAt: '2026-11-13T05:00:00.000Z' }, steps('Published', null));
    expect(d).toMatchObject({ delivered: true, via: 'post' });
    expect(projectTimeLabel(piece, d).kind).toBe('completed_late');
  });

  it('a non-postable design is handed over when its Design step is approved', () => {
    const poster = { contentType: 'Poster', postingDate: DUE_UTC_MIDNIGHT, hasPostStage: false };
    const open = projectDelivery(poster, [{ stageKey: 'Content', status: 'Approved' }, { stageKey: 'Design', status: 'In Progress' }]);
    expect(open.delivered).toBe(false);
    expect(projectTimeLabel(poster, open, { now: '2026-11-12T05:00:00.000Z' }).kind).toBe('overdue');
    const done = projectDelivery(poster, [{ stageKey: 'Content', status: 'Approved' }, { stageKey: 'Design', status: 'Approved', approvedAt: '2026-11-11T05:00:00.000Z' }]);
    expect(done).toMatchObject({ delivered: true, via: 'handover' });
    expect(projectTimeLabel(poster, done)).toMatchObject({ kind: 'completed_late', days: 1 });
  });
});
