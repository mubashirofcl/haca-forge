// PG-3: review and role boundaries for the plan grid (disposable test DB, synthetic rows).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';

const EMAIL = /@pg3-grid-test\.com$/;
const MONTH = '2031-12';
const CAL = 'academics_management';

describe('PG-3 plan grid review and roles', () => {
  const people = {};
  const tokens = {};
  let planId;
  let rowA;
  let rowB;
  const make = (u) => jwt.sign({ userId: u._id.toString(), email: u.email, role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
  const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
  const cleanup = async () => {
    const ids = (await Person.find({ email: EMAIL }).select('_id').lean()).map((p) => p._id);
    const plans = await CalendarPlan.find({ createdById: { $in: ids } }).select('_id').lean();
    const pids = plans.map((p) => p._id);
    await WorkItem.deleteMany({ calendarPlanId: { $in: pids } });
    await ContentPiece.deleteMany({ planId: { $in: pids } });
    await CalendarPlan.deleteMany({ _id: { $in: pids } });
    await Person.deleteMany({ email: EMAIL });
  };

  beforeAll(async () => {
    await connectDB();
    await cleanup();
    const mk = (key, name, role, workPreferences = []) =>
      Person.create({ name, email: `${key}@pg3-grid-test.com`, role, status: 'active', workPreferences }).then((p) => {
        people[key] = p;
        tokens[key] = make(p);
      });
    await mk('sm', 'PG3 SM Manager', 'sm_manager');
    await mk('admin', 'PG3 Admin', 'admin');
    await mk('head', 'PG3 Creative Head', 'creative_head');
    await mk('exec', 'PG3 Executive', 'executive');
    await mk('member', 'PG3 Member', 'team_member', ['Content', 'Design', 'Post']);
  });
  afterAll(cleanup);

  it('full flow: SM pastes rows and submits; Creative Head approves one row and returns the other; the approved row is locked', async () => {
    // 1. Paste two rows (November Excel structure, synthetic data).
    const tsv = ['Posting Date\tTopic\tType\tRemarks', '10 Dec, 2031\tPG3 Approved post\tPoster\tfirst', '12/12/2031\tPG3 Returned post\tCarousal\tsecond'].join('\r\n');
    const pasted = await request(app).post('/api/calendar-plans/grid/rows').set(as('sm')).send({ calendar: CAL, month: MONTH, tsv });
    expect(pasted.status).toBe(201);
    expect(pasted.body.data.counts.saved).toBe(2);
    planId = pasted.body.data.plan._id;
    [rowA, rowB] = pasted.body.data.results.map((r) => r.rowId);

    // 2. Submit for review (existing endpoint).
    const submitted = await request(app).post(`/api/calendar-plans/${planId}/submit`).set(as('sm'));
    expect(submitted.status).toBe(200);

    // 3. The Creative Head sees the submitted rows in the grid, as a reviewer.
    const headGrid = await request(app).get('/api/calendar-plans/grid').query({ calendar: CAL, month: MONTH }).set(as('head'));
    expect(headGrid.body.data.permissions).toEqual({ canEdit: false, canReview: true, readOnly: false });
    expect(headGrid.body.data.rows.map((r) => r.rowStatus)).toEqual(['submitted', 'submitted']);

    // 4. Approve one row, return the other with a note.
    const approved = await request(app).post(`/api/calendar-plans/${planId}/review`).set(as('head')).send({ action: 'approve_selected', approvedRowIds: [rowA] });
    expect(approved.status).toBe(200);
    const returned = await request(app)
      .post(`/api/calendar-plans/${planId}/review`)
      .set(as('head'))
      .send({ action: 'request_changes', changes: [{ rowId: rowB, comment: 'PG3: use the new logo' }] });
    expect(returned.status).toBe(200);

    const after = await request(app).get('/api/calendar-plans/grid').query({ calendar: CAL, month: MONTH }).set(as('sm'));
    const byId = Object.fromEntries(after.body.data.rows.map((r) => [r.rowId, r]));
    expect(byId[rowA]).toMatchObject({ rowStatus: 'approved', editable: false });
    expect(byId[rowB]).toMatchObject({ rowStatus: 'changes_requested', editable: true, reviewFeedback: 'PG3: use the new logo' });
    // Approval created the row's steps (existing rule), so step status columns fill in.
    expect(await WorkItem.countDocuments({ contentPieceId: rowA })).toBeGreaterThan(0);

    // 5. The approved row is locked; the returned row can be fixed.
    const edits = await request(app)
      .post('/api/calendar-plans/grid/rows')
      .set(as('sm'))
      .send({ calendar: CAL, month: MONTH, planId, rows: [{ rowId: rowA, cells: { remarks: 'try' } }, { rowId: rowB, cells: { remarks: 'logo updated' } }] });
    const [a, b] = edits.body.data.results;
    expect(a.status).toBe('locked');
    expect(b.status).toBe('saved');
  });

  it('only the Creative Head can review plan rows: admin is refused for every review action', async () => {
    for (const body of [
      { action: 'approve_selected', approvedRowIds: [rowB] },
      { action: 'approve_all' },
      { action: 'request_changes', changes: [{ rowId: rowB, comment: 'x' }] },
      { action: 'reject', rejectionConcern: 'x' },
    ]) {
      const res = await request(app).post(`/api/calendar-plans/${planId}/review`).set(as('admin')).send(body);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_APPROVAL');
    }
    expect((await ContentPiece.findById(rowB).lean()).rowStatus).toBe('changes_requested');
  });

  it("admin's other plan permissions are unchanged (edit rows, submit)", async () => {
    const edit = await request(app)
      .post('/api/calendar-plans/grid/rows')
      .set(as('admin'))
      .send({ calendar: CAL, month: MONTH, planId, rows: [{ rowId: rowB, cells: { remarks: 'admin note' } }] });
    expect(edit.body.data.results[0].status).toBe('saved');
    const submit = await request(app).post(`/api/calendar-plans/${planId}/submit`).set(as('admin'));
    expect(submit.status).toBe(200);
  });

  it('the Creative Head cannot edit planning fields', async () => {
    const res = await request(app).post('/api/calendar-plans/grid/rows').set(as('head')).send({ calendar: CAL, month: MONTH, planId, rows: [{ rowId: rowB, cells: { topic: 'changed' } }] });
    expect(res.status).toBe(403);
  });

  it('executive: read-only grid without contact details; every write returns 403', async () => {
    const grid = await request(app).get('/api/calendar-plans/grid').query({ calendar: CAL, month: MONTH }).set(as('exec'));
    expect(grid.status).toBe(200);
    expect(grid.body.data.permissions).toEqual({ canEdit: false, canReview: false, readOnly: true });
    expect(grid.body.data.people).toEqual([]);
    expect(JSON.stringify(grid.body.data)).not.toMatch(/@pg3-grid-test|email|phone/i);

    const writes = [
      request(app).post('/api/calendar-plans/grid/rows').set(as('exec')).send({ calendar: CAL, month: MONTH, rows: [{ cells: { topic: 'x' } }] }),
      request(app).post('/api/calendar-plans/grid/upload').set(as('exec')).field('calendar', CAL).field('month', MONTH).attach('file', Buffer.from('a,b'), 'x.csv'),
      request(app).post(`/api/calendar-plans/${planId}/review`).set(as('exec')).send({ action: 'approve_all' }),
      request(app).post(`/api/calendar-plans/${planId}/submit`).set(as('exec')),
      request(app).patch(`/api/calendar-plans/${planId}/rows/${rowB}`).set(as('exec')).send({ remarks: 'x' }),
      request(app).delete(`/api/calendar-plans/${planId}/rows/${rowB}`).set(as('exec')),
      request(app).post(`/api/calendar-plans/${planId}/rows`).set(as('exec')).send({ rows: [{ topic: 'x' }] }),
    ];
    for (const res of await Promise.all(writes)) expect(res.status).toBe(403);
  });

  it('team member: every grid route returns 404', async () => {
    const q = { calendar: CAL, month: MONTH };
    expect((await request(app).get('/api/calendar-plans/grid').query(q).set(as('member'))).status).toBe(404);
    expect((await request(app).post('/api/calendar-plans/grid/rows').set(as('member')).send({ ...q, rows: [{ cells: {} }] })).status).toBe(404);
    expect((await request(app).post('/api/calendar-plans/grid/upload').set(as('member')).field('calendar', CAL).attach('file', Buffer.from('a'), 'x.csv')).status).toBe(404);
    // Other roles are unchanged.
    expect((await request(app).get('/api/calendar-plans/grid').query(q).set(as('sm'))).status).toBe(200);
  });
});
