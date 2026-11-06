import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { STEP_OUTPUT_KINDS } from '@mmp/shared';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { getWorkItemById } from '../src/modules/workItems/service.js';

const at = (iso) => new Date(iso);

describe('Work detail: step times on the workflow', () => {
  const contentPieceId = new mongoose.Types.ObjectId();
  let admin;
  let older;
  let current;
  let notStarted;

  const removeLeftovers = async () => {
    const ids = (await WorkItem.find({ title: /^Step times / }).select('_id').lean()).map((s) => s._id);
    await ActivityEvent.deleteMany({ entityId: { $in: ids } });
    await Submission.deleteMany({ workItemId: { $in: ids } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await Person.deleteOne({ email: 'step.times.admin@example.com' });
  };

  const stage = (stageKey, stageOrder, status, extra = {}) =>
    WorkItem.create({
      title: `Step times ${stageKey}`,
      workType: 'Reel',
      contentPieceId,
      stageKey,
      stageOrder,
      status,
      isLocked: false,
      deadline: at('2031-12-01T00:00:00.000Z'),
      departmentId: new mongoose.Types.ObjectId(),
      profileId: new mongoose.Types.ObjectId(),
      ...extra,
    });
  const history = (workItem, toStatus, timestamp) =>
    ActivityEvent.create({ entityType: 'work_item', entityId: workItem._id, actorId: admin._id, action: 'work_item.status_changed', toStatus, timestamp });
  const submission = (workItem, version, submittedAt, status, reviewedAt = null) =>
    Submission.create({ workItemId: workItem._id, stageKey: workItem.stageKey, version, kind: STEP_OUTPUT_KINDS[0], submittedAt, status, reviewedAt });

  beforeAll(async () => {
    await connectDB();
    await removeLeftovers();
    admin = await Person.create({ name: 'Step Times Admin', email: 'step.times.admin@example.com', role: 'admin', status: 'active', avatarUrl: 'https://example.test/owner.jpg' });

    // Worked on before the timing fields were saved: only history has the times.
    older = await stage('Script', 1, 'Approved');
    await history(older, 'In Progress', at('2031-11-01T04:00:00.000Z'));
    await submission(older, 1, at('2031-11-02T05:00:00.000Z'), 'changes_requested', at('2031-11-02T06:00:00.000Z'));
    await submission(older, 2, at('2031-11-03T05:00:00.000Z'), 'approved', at('2031-11-03T06:00:00.000Z'));
    await history(older, 'Approved', at('2031-11-03T06:00:01.000Z'));

    // Saved times win over history.
    current = await stage('Shoot', 2, 'Approved', {
      ownerId: admin._id,
      startedAt: at('2031-11-05T01:00:00.000Z'),
      submittedAt: at('2031-11-05T02:00:00.000Z'),
      approvedAt: at('2031-11-05T03:00:00.000Z'),
    });
    await history(current, 'In Progress', at('2031-11-04T09:00:00.000Z'));

    notStarted = await stage('Edit', 3, 'Not Started');
    await history(notStarted, 'In Progress', at('2031-11-04T09:00:00.000Z'));
  });

  afterAll(removeLeftovers);

  const stages = async () => {
    const detail = await getWorkItemById(older._id, admin);
    return Object.fromEntries(detail.pieceStages.map((s) => [s.stageKey, s]));
  };

  it('fills blank times from the activity log and submissions', async () => {
    const { Script } = await stages();
    expect(Script.startedAt).toEqual(at('2031-11-01T04:00:00.000Z'));
    expect(Script.submittedAt).toEqual(at('2031-11-02T05:00:00.000Z'));
    expect(Script.resubmittedAt).toEqual(at('2031-11-03T05:00:00.000Z'));
    expect(Script.approvedAt).toEqual(at('2031-11-03T06:00:01.000Z'));
  });

  it('keeps saved times and never invents times for a step not started', async () => {
    const { Shoot, Edit } = await stages();
    expect(Shoot.startedAt).toEqual(at('2031-11-05T01:00:00.000Z'));
    expect(Shoot.approvedAt).toEqual(at('2031-11-05T03:00:00.000Z'));
    expect(Edit.startedAt ?? null).toBeNull();
    expect(Edit.approvedAt ?? null).toBeNull();
  });

  it("includes the owner's photo on each step", async () => {
    const { Shoot } = await stages();
    expect(Shoot.ownerId.avatarUrl).toBe('https://example.test/owner.jpg');
  });

  it('does not write the filled times back to the saved record', async () => {
    await stages();
    const saved = await WorkItem.findById(older._id).lean();
    expect(saved.startedAt ?? null).toBeNull();
    expect(saved.submittedAt ?? null).toBeNull();
    expect(saved.approvedAt ?? null).toBeNull();
  });
});
