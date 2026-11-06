import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { CANONICAL_REVISION_ROOT_CAUSES, LEGACY_REVISION_ROOT_CAUSES } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Submission } from '../src/modules/submissions/model.js';
import { RevisionFlag } from '../src/modules/feedback/model.js';

// New revision requests and classifications accept only the 7 canonical root causes.
// Legacy values already saved on flags stay readable and are never rewritten.
const DOMAIN = '@root-cause-test.local';
const TITLE = 'RC Canonical Test';

const makeToken = (user) =>
  jwt.sign({ userId: user._id.toString(), role: user.role, email: user.email }, env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

describe('Canonical revision root causes', () => {
  let head, owner, headToken;
  let deptId;

  const newWorkItem = (suffix) =>
    WorkItem.create({
      title: `${TITLE} ${suffix}`,
      workType: 'Reel',
      status: 'Pending',
      stageKey: 'Content',
      stageOrder: 1,
      departmentId: deptId,
      ownerId: owner._id,
      deadline: new Date(Date.now() + 3 * 86400000),
      estimatedEffortHrs: 2,
    });
  const newSubmission = (workItem) =>
    Submission.create({ workItemId: workItem._id, kind: 'document', version: 1, status: 'submitted', submittedById: owner._id, submittedAt: new Date() });
  const newFlag = (workItem, rootCause = null) =>
    RevisionFlag.create({ workItemId: workItem._id, ownerId: owner._id, revisionsCount: 4, isFlagged: true, flaggedAt: new Date(), rootCause });

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
    await cleanup();
    const dept = await mongoose.connection.db.collection('departments').findOne({});
    deptId = dept?._id || new mongoose.Types.ObjectId();
    head = await Person.create({ name: 'RC Head', email: `head${DOMAIN}`, role: 'creative_head', status: 'active' });
    owner = await Person.create({ name: 'RC Owner', email: `owner${DOMAIN}`, role: 'team_member', status: 'active' });
    headToken = makeToken(head);
  });

  async function cleanup() {
    const items = await WorkItem.find({ title: new RegExp(`^${TITLE}`) }).select('_id');
    const ids = items.map((i) => i._id);
    await RevisionFlag.deleteMany({ workItemId: { $in: ids } });
    await Submission.deleteMany({ workItemId: { $in: ids } });
    await WorkItem.deleteMany({ _id: { $in: ids } });
    await Person.deleteMany({ email: new RegExp(`${DOMAIN.replace('.', '\\.')}$`) });
  }
  afterAll(cleanup);

  it('the shared canonical list has exactly 7 values and legacy values are separate', () => {
    expect(CANONICAL_REVISION_ROOT_CAUSES).toHaveLength(7);
    for (const legacy of LEGACY_REVISION_ROOT_CAUSES) expect(CANONICAL_REVISION_ROOT_CAUSES).not.toContain(legacy);
  });

  describe('Request revision (new write)', () => {
    it.each(['Creative Choice', 'quality', 'Brief mismatch', 'Script change'])('rejects non-canonical "%s" and leaves the submission unchanged', async (cause) => {
      const wi = await newWorkItem(`reject ${cause}`);
      const sub = await newSubmission(wi);
      const res = await request(app)
        .post(`/api/submissions/${sub._id}/request-revision`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ comment: 'Please fix the hook.', rootCause: cause });
      expect(res.status).toBe(400);
      expect((await Submission.findById(sub._id)).status).toBe('submitted');
    });

    it('accepts a canonical cause', async () => {
      const wi = await newWorkItem('accept');
      const sub = await newSubmission(wi);
      const res = await request(app)
        .post(`/api/submissions/${sub._id}/request-revision`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ comment: 'Please fix the hook.', rootCause: 'Technical error' });
      expect(res.status).toBe(200);
      expect(res.body.data.submission.status).toBe('changes_requested');
    });
  });

  describe('Classify revision flag (new write)', () => {
    it.each([...LEGACY_REVISION_ROOT_CAUSES])('rejects legacy "%s" and leaves the flag unclassified', async (cause) => {
      const wi = await newWorkItem(`classify reject ${cause}`);
      const flag = await newFlag(wi);
      const res = await request(app)
        .post(`/api/revisions/flags/${flag._id}/classify`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ rootCause: cause });
      expect(res.status).toBe(400);
      expect((await RevisionFlag.findById(flag._id)).rootCause).toBeNull();
    });

    it.each([...CANONICAL_REVISION_ROOT_CAUSES])('accepts canonical "%s"', async (cause) => {
      const wi = await newWorkItem(`classify accept ${cause}`);
      const flag = await newFlag(wi);
      const res = await request(app)
        .post(`/api/revisions/flags/${flag._id}/classify`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ rootCause: cause });
      expect(res.status).toBe(200);
      expect((await RevisionFlag.findById(flag._id)).rootCause).toBe(cause);
    });

    it('re-classifying a legacy flag requires a canonical value; the legacy value stays until then', async () => {
      const wi = await newWorkItem('legacy reclassify');
      const flag = await newFlag(wi, 'Visual defect');
      const bad = await request(app).post(`/api/revisions/flags/${flag._id}/classify`).set('Authorization', `Bearer ${headToken}`).send({ rootCause: 'Visual defect' });
      expect(bad.status).toBe(400);
      expect((await RevisionFlag.findById(flag._id)).rootCause).toBe('Visual defect');
      const good = await request(app).post(`/api/revisions/flags/${flag._id}/classify`).set('Authorization', `Bearer ${headToken}`).send({ rootCause: 'Technical error' });
      expect(good.status).toBe(200);
      expect((await RevisionFlag.findById(flag._id)).rootCause).toBe('Technical error');
    });
  });

  describe('Legacy records stay readable and untouched', () => {
    it('lists a legacy-classified flag as saved and does not rewrite it', async () => {
      const wi = await newWorkItem('legacy read');
      const flag = await newFlag(wi, 'Script change');
      const before = await RevisionFlag.findById(flag._id).lean();

      const list = await request(app).get('/api/revisions/flags').set('Authorization', `Bearer ${headToken}`);
      expect(list.status).toBe(200);
      const row = list.body.data.find((f) => String(f._id || f.id) === String(flag._id));
      expect(row).toBeDefined();
      expect(row.rootCause).toBe('Script change');

      const dash = await request(app).get('/api/dashboard/overview').set('Authorization', `Bearer ${headToken}`);
      expect(dash.status).toBe(200);

      const after = await RevisionFlag.findById(flag._id).lean();
      expect(after.rootCause).toBe('Script change');
      expect(after.updatedAt?.getTime?.()).toBe(before.updatedAt?.getTime?.());
    });
  });
});
