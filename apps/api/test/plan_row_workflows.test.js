// Row workflows: Reel Full | Shoot + Edit | Edit only; Static/Carousel With content | Design only.
// Stored as the row's flags; approval creates only the workflow's steps with deadlines counted back
// from the posting date; "From the plan" gives the first step the brief (and the source video for
// Edit only). Disposable test DB, synthetic rows.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import { PLAN_TEMPLATE_HEADERS, istDateKey } from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';

const EMAIL = /@wf-row-test\.com$/;
const CAL = 'other';
const DRIVE = 'https://drive.google.com/file/d/wf-footage/view';

describe('Row workflows', () => {
  const people = {};
  const tokens = {};
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
      Person.create({ name, email: `${key}@wf-row-test.com`, role, status: 'active', workPreferences }).then((p) => {
        people[key] = p;
        tokens[key] = make(p);
      });
    await mk('sm', 'WF SM Manager', 'sm_manager');
    await mk('admin', 'WF Admin', 'admin');
    await mk('head', 'WF Creative Head', 'creative_head');
    await mk('writer', 'WF Writer', 'team_member', ['Script', 'Content']);
    await mk('shooter', 'WF Shooter', 'team_member', ['Shoot']);
    await mk('editor', 'WF Editor', 'team_member', ['Edit']);
    await mk('designer', 'WF Designer', 'team_member', ['Design']);
    await mk('poster', 'WF Poster', 'team_member', ['Post']);
  });
  afterAll(cleanup);

  const saveRows = (month, rows, extra = {}) =>
    request(app).post('/api/calendar-plans/grid/rows').set(as('sm')).send({ calendar: CAL, month, rows, ...extra });
  const byKey = (res) => Object.fromEntries(res.body.data.results.map((r) => [r.clientKey, r]));
  const minusDays = (ymd, n) => {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };

  async function xlsx(rows) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calendar Plan');
    ws.addRow(PLAN_TEMPLATE_HEADERS);
    for (const r of rows) ws.addRow(PLAN_TEMPLATE_HEADERS.map((h) => r[h] ?? ''));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  async function legacyXlsx(headers, rows) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calendar Plan');
    ws.addRow(headers);
    for (const r of rows) ws.addRow(headers.map((h) => r[h] ?? ''));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  const upload = (month, file, dryRun = true) =>
    request(app)
      .post('/api/calendar-plans/grid/upload')
      .set(as('sm'))
      .field('calendar', CAL)
      .field('month', month)
      .field('dryRun', String(dryRun))
      .attach('file', file, 'plan.xlsx');

  describe('approval creates the workflow steps, deadlines and handoffs', () => {
    const MONTH = '2032-04';
    const POST = '2032-04-20';
    let planId;
    const rows = {};

    beforeAll(async () => {
      const res = await saveRows(MONTH, [
        { clientKey: 'full', cells: { postingDate: POST, topic: 'WF Full reel', type: 'Reel', typeExact: true, brief: 'Full brief' } },
        { clientKey: 'shootEdit', cells: { postingDate: POST, topic: 'WF Shoot edit reel', type: 'Reel', typeExact: true, workflow: 'Shoot + Edit', brief: 'Shoot brief' } },
        { clientKey: 'editOnly', cells: { postingDate: POST, topic: 'WF Edit only reel', type: 'Reel', typeExact: true, workflow: 'Edit only', sourceVideoLink: DRIVE, brief: 'Cut the campus footage' } },
        { clientKey: 'withContent', cells: { postingDate: POST, topic: 'WF With content post', type: 'Static Post', typeExact: true, brief: 'Content brief' } },
        { clientKey: 'designOnly', cells: { postingDate: POST, topic: 'WF Design only carousel', type: 'Carousel Post', typeExact: true, workflow: 'design_only', brief: 'Use the approved copy' } },
      ]);
      expect(res.status).toBe(201);
      const by = byKey(res);
      for (const [k, r] of Object.entries(by)) {
        expect(r.cellErrors, k).toEqual({});
        rows[k] = r;
      }
      planId = res.body.data.plan._id;
      expect((await request(app).post(`/api/calendar-plans/${planId}/submit`).set(as('sm'))).status).toBe(200);
      const approved = await request(app)
        .post(`/api/calendar-plans/${planId}/review`)
        .set(as('head'))
        .send({ action: 'approve_selected', approvedRowIds: Object.values(rows).map((r) => r.rowId) });
      expect(approved.status).toBe(200);
    });

    const cases = [
      ['full', 'full', 'Reel · Full', { Script: 8, Shoot: 5, Edit: 2, Post: 0 }],
      ['shootEdit', 'shoot_edit', 'Reel · Shoot + Edit', { Shoot: 5, Edit: 2, Post: 0 }],
      ['editOnly', 'edit_only', 'Reel · Edit only', { Edit: 2, Post: 0 }],
      ['withContent', 'with_content', 'Static Post · With content', { Content: 5, Design: 2, Post: 0 }],
      ['designOnly', 'design_only', 'Carousel Post · Design only', { Design: 2, Post: 0 }],
    ];
    for (const [key, workflow, label, offsets] of cases) {
      it(`${label}: the grid row, steps and deadlines`, async () => {
        expect(rows[key].row.workflow).toBe(workflow);
        const steps = await WorkItem.find({ contentPieceId: rows[key].rowId }).sort({ stageOrder: 1 }).lean();
        expect(steps.map((s) => s.stageKey)).toEqual(Object.keys(offsets));
        for (const s of steps) expect(istDateKey(s.deadline), s.stageKey).toBe(minusDays(POST, offsets[s.stageKey]));
      });
    }

    it('"From the plan": every first step gets the brief; Edit only also gets the source video; later steps get none', async () => {
      for (const [key, , label] of cases) {
        const steps = await WorkItem.find({ contentPieceId: rows[key].rowId }).sort({ stageOrder: 1 }).lean();
        const first = await request(app).get(`/api/work-items/${steps[0]._id}`).set(as('admin'));
        expect(first.status).toBe(200);
        const d = first.body.data;
        expect(d.workflowLabel).toBe(label);
        expect(d.fromPlan.brief, key).toBe((await ContentPiece.findById(rows[key].rowId).lean()).brief);
        if (key === 'editOnly') {
          expect(steps[0].stageKey).toBe('Edit');
          expect(d.fromPlan.items).toEqual([{ url: DRIVE, name: 'Source video', kind: 'drive' }]);
        } else {
          expect(d.fromPlan.items).toEqual([]);
        }
        const second = await request(app).get(`/api/work-items/${steps[1]._id}`).set(as('admin'));
        expect(second.body.data.fromPlan).toBeNull();
        expect(second.body.data.workflowLabel).toBe(label);
      }
    });

    it('the owner of the first step sees "From the plan" too', async () => {
      const step = await WorkItem.findOne({ contentPieceId: rows.editOnly.rowId, stageKey: 'Edit' }).lean();
      const owner = Object.keys(people).find((k) => String(people[k]._id) === String(step.ownerId));
      expect(owner).toBeTruthy();
      const res = await request(app).get(`/api/work-items/${step._id}`).set(as(owner));
      expect(res.body.data.fromPlan).toMatchObject({ brief: 'Cut the campus footage', items: [{ url: DRIVE }] });
    });

    it('the workflow is locked after approval', async () => {
      const res = await saveRows(MONTH, [{ clientKey: 'x', rowId: rows.full.rowId, cells: { workflow: 'Edit only' } }], { planId });
      expect(byKey(res).x.status).toBe('locked');
      const piece = await ContentPiece.findById(rows.full.rowId).lean();
      expect(piece).toMatchObject({ needsScript: true, needsShoot: true });
    });

    it('Tracker and the Project KPI page carry the workflow label', async () => {
      const tracker = await request(app).get('/api/content-pieces').query({ month: MONTH }).set(as('admin'));
      const mine = tracker.body.data.filter((p) => String(p.planId?._id || p.planId) === String(planId));
      expect(Object.fromEntries(mine.map((p) => [p.topic, p.workflowLabel]))).toMatchObject({
        'WF Edit only reel': 'Reel · Edit only',
        'WF Design only carousel': 'Carousel Post · Design only',
      });
      const kpi = await request(app).get(`/api/reports/projects/${rows.shootEdit.rowId}`).set(as('admin'));
      expect(kpi.status).toBe(200);
      expect(kpi.body.data.project.workflowLabel).toBe('Reel · Shoot + Edit');
    });
  });

  describe('grid and API rules', () => {
    const MONTH = '2032-05';

    it('blank workflow is the type default; other types have none', async () => {
      const res = await saveRows(MONTH, [
        { clientKey: 'reel', cells: { postingDate: '2032-05-10', topic: 'WF Default reel', type: 'Reel', typeExact: true, workflow: '' } },
        { clientKey: 'static', cells: { postingDate: '2032-05-11', topic: 'WF Default static', type: 'Static Post', typeExact: true } },
        { clientKey: 'story', cells: { postingDate: '2032-05-12', topic: 'WF Story', type: 'Story', typeExact: true } },
      ], { dryRun: true });
      const by = byKey(res);
      expect(by.reel.row ?? null).toBeNull(); // dry run: nothing saved
      expect(by.reel.cellErrors).toEqual({});
      const saved = await saveRows(MONTH, [
        { clientKey: 'reel', cells: { postingDate: '2032-05-10', topic: 'WF Default reel', type: 'Reel', typeExact: true, workflow: '' } },
        { clientKey: 'static', cells: { postingDate: '2032-05-11', topic: 'WF Default static', type: 'Static Post', typeExact: true } },
        { clientKey: 'story', cells: { postingDate: '2032-05-12', topic: 'WF Story', type: 'Story', typeExact: true } },
      ]);
      const s = byKey(saved);
      expect(s.reel.row).toMatchObject({ workflow: 'full', stages: ['Script', 'Shoot', 'Edit', 'Post'] });
      expect(s.static.row).toMatchObject({ workflow: 'with_content', stages: ['Content', 'Design', 'Post'] });
      expect(s.story.row).toMatchObject({ workflow: null, stages: ['Content', 'Design', 'Post'] });
    });

    it('an invalid type + workflow pair is a cell error', async () => {
      const res = await saveRows(MONTH, [
        { clientKey: 'a', cells: { postingDate: '2032-05-13', topic: 'WF Bad pair', type: 'Reel', typeExact: true, workflow: 'Design only' } },
        { clientKey: 'b', cells: { postingDate: '2032-05-14', topic: 'WF Bad pair 2', type: 'Static Post', typeExact: true, workflow: 'Edit only' } },
        { clientKey: 'c', cells: { postingDate: '2032-05-15', topic: 'WF Story pair', type: 'Story', typeExact: true, workflow: 'Design only' } },
        { clientKey: 'd', cells: { postingDate: '2032-05-16', topic: 'WF Unknown', type: 'Reel', typeExact: true, workflow: 'Quick' } },
      ], { dryRun: true });
      const by = byKey(res);
      expect(by.a.cellErrors.workflow[0]).toBe('Reel can\'t use "Design only". Use Full, Shoot + Edit, Edit only.');
      expect(by.b.cellErrors.workflow[0]).toMatch(/Static Post can't use "Edit only". Use With content, Design only/);
      expect(by.c.cellErrors.workflow[0]).toMatch(/Story has no workflow choice/);
      expect(by.d.cellErrors.workflow[0]).toMatch(/Unknown workflow "Quick"/);
    });

    it('Edit only needs a source video link that is an app upload or a Drive / Docs link', async () => {
      const res = await saveRows(MONTH, [
        { clientKey: 'missing', cells: { postingDate: '2032-05-17', topic: 'WF No source', type: 'Reel', typeExact: true, workflow: 'Edit only' } },
        { clientKey: 'other', cells: { postingDate: '2032-05-18', topic: 'WF YouTube source', type: 'Reel', typeExact: true, workflow: 'Edit only', sourceVideoLink: 'https://youtube.com/watch?v=x' } },
        { clientKey: 'http', cells: { postingDate: '2032-05-19', topic: 'WF Http drive', type: 'Reel', typeExact: true, workflow: 'Edit only', sourceVideoLink: 'http://drive.google.com/file/d/x' } },
        { clientKey: 'docs', cells: { postingDate: '2032-05-20', topic: 'WF Docs source', type: 'Reel', typeExact: true, workflow: 'Edit only', sourceVideoLink: 'https://docs.google.com/document/d/x' } },
      ], { dryRun: true });
      const by = byKey(res);
      expect(by.missing.cellErrors.sourceVideoLink[0]).toMatch(/Edit only needs a source video link/);
      expect(by.other.cellErrors.sourceVideoLink[0]).toMatch(/drive\.google\.com or docs\.google\.com/);
      expect(by.http.cellErrors.sourceVideoLink[0]).toMatch(/drive\.google\.com or docs\.google\.com/);
      expect(by.docs.cellErrors).toEqual({});
    });

    it('changing Type resets the workflow to that type\'s default; unused steps drop out of the plan', async () => {
      const first = await saveRows(MONTH, [
        { clientKey: 'r', cells: { postingDate: '2032-05-21', topic: 'WF Type change', type: 'Reel', typeExact: true, workflow: 'Edit only', sourceVideoLink: DRIVE } },
      ]);
      const row = byKey(first).r;
      expect(row.row).toMatchObject({ workflow: 'edit_only', stages: ['Edit', 'Post'] });
      const planId = first.body.data.plan._id;
      const toStatic = byKey(await saveRows(MONTH, [{ clientKey: 'r', rowId: row.rowId, cells: { type: 'Static Post', typeExact: true } }], { planId })).r;
      expect(toStatic.row).toMatchObject({ workflow: 'with_content', stages: ['Content', 'Design', 'Post'] });
      const back = byKey(await saveRows(MONTH, [{ clientKey: 'r', rowId: row.rowId, cells: { type: 'Reel', typeExact: true } }], { planId })).r;
      expect(back.row).toMatchObject({ workflow: 'full', stages: ['Script', 'Shoot', 'Edit', 'Post'] });
      const designOnly = byKey(await saveRows(MONTH, [{ clientKey: 'r', rowId: row.rowId, cells: { type: 'Carousel Post', typeExact: true, workflow: 'Design only' } }], { planId })).r;
      expect(designOnly.row.stages).toEqual(['Design', 'Post']);
      const piece = await ContentPiece.findById(row.rowId).lean();
      expect(piece.stagePlan.map((s) => s.stageKey)).toEqual(['Design', 'Post']);
      expect(piece.needsContent).toBe(false);
    });

    it('existing rows keep their stored flags and show the matching workflow', async () => {
      const first = await saveRows(MONTH, [{ clientKey: 'r', cells: { postingDate: '2032-05-22', topic: 'WF Kept flags', type: 'Reel', typeExact: true } }]);
      const { rowId } = byKey(first).r;
      // An older draft saved with Needs Script = No, Needs Shoot = Yes (written around the API).
      await ContentPiece.updateOne({ _id: rowId }, { $set: { needsScript: false, needsShoot: true }, $unset: { needsContent: '' } });
      const again = byKey(await saveRows(MONTH, [{ clientKey: 'r', rowId, cells: { remarks: 'touched' } }], { planId: first.body.data.plan._id })).r;
      expect(again.row).toMatchObject({ workflow: 'shoot_edit', stages: ['Shoot', 'Edit', 'Post'], remarks: 'touched' });
    });

    it('autofill and the save suggestion skip steps the workflow does not use', async () => {
      const saved = await saveRows(MONTH, [{ clientKey: 'r', cells: { postingDate: '2032-05-23', topic: 'WF Autofill design only', type: 'Static Post', typeExact: true, workflow: 'Design only' } }]);
      const r = byKey(saved).r;
      expect(Object.keys(r.row.ownerIds)).toEqual(['Design', 'Post']);
      expect(r.row.ownerIds.Design).toBe(String(people.designer._id));
      const planId = saved.body.data.plan._id;
      const af = await request(app)
        .post(`/api/calendar-plans/${planId}/rows/autofill`)
        .set(as('sm'))
        .send({ type: 'Static Post', postingDate: '2032-05-23', needsContent: false });
      expect(af.status).toBe(200);
      expect(af.body.data.stages.map((s) => s.stageKey)).toEqual(['Design', 'Post']);
      const reel = await request(app)
        .post(`/api/calendar-plans/${planId}/rows/autofill`)
        .set(as('sm'))
        .send({ type: 'Reel', postingDate: '2032-05-23', needsScript: false, needsShoot: true });
      expect(reel.body.data.stages.map((s) => s.stageKey)).toEqual(['Shoot', 'Edit', 'Post']);
    });
  });

  describe('Excel upload', () => {
    const MONTH = '2032-06';

    it('reads Workflow (blank = default), rejects bad pairs and bad source links, and Script Owner sets the Content owner on design rows', async () => {
      const file = await xlsx([
        { 'Posting Date': '2 Jun, 2032', Topic: 'WF Up blank', Type: 'Reel' },
        { 'Posting Date': '3 Jun, 2032', Topic: 'WF Up shoot edit', Type: 'Reel', Workflow: 'Shoot + Edit' },
        { 'Posting Date': '4 Jun, 2032', Topic: 'WF Up edit only', Type: 'Reel', Workflow: 'Edit only', 'Source Video Link': DRIVE },
        { 'Posting Date': '5 Jun, 2032', Topic: 'WF Up design only', Type: 'Static Post', Workflow: 'Design only', 'Design Owner': 'WF Designer' },
        { 'Posting Date': '6 Jun, 2032', Topic: 'WF Up bad pair', Type: 'Reel', Workflow: 'Design only' },
        { 'Posting Date': '7 Jun, 2032', Topic: 'WF Up no source', Type: 'Reel', Workflow: 'Edit only' },
        { 'Posting Date': '8 Jun, 2032', Topic: 'WF Up bad source', Type: 'Reel', Workflow: 'Edit only', 'Source Video Link': 'https://vimeo.com/123' },
        { 'Posting Date': '9 Jun, 2032', Topic: 'WF Up script owner', Type: 'Static Post', 'Script Owner': 'WF Writer' },
      ]);
      const res = await upload(MONTH, file, false);
      expect(res.status).toBe(201);
      const r = res.body.data.results;
      expect(r[0].row).toMatchObject({ workflow: 'full', stages: ['Script', 'Shoot', 'Edit', 'Post'] });
      expect(r[1].row).toMatchObject({ workflow: 'shoot_edit', stages: ['Shoot', 'Edit', 'Post'] });
      expect(r[2].row).toMatchObject({ workflow: 'edit_only', stages: ['Edit', 'Post'], sourceVideoLink: DRIVE });
      expect(r[3].row).toMatchObject({ workflow: 'design_only', stages: ['Design', 'Post'], designOwner: 'WF Designer' });
      expect(r[4].cellErrors.workflow[0]).toMatch(/Reel can't use "Design only"/);
      expect(r[5].cellErrors.sourceVideoLink[0]).toMatch(/Edit only needs a source video link/);
      expect(r[6].cellErrors.sourceVideoLink[0]).toMatch(/drive\.google\.com or docs\.google\.com/);
      expect(r[7].cellErrors).toEqual({});
      expect(r[7].row).toMatchObject({ workflow: 'with_content', contentOwner: 'WF Writer', ownerIds: { Content: String(people.writer._id) } });
      expect(res.body.data.counts).toMatchObject({ saved: 5, invalid: 3 });
    });

    it('an older template without the Workflow column still uploads with the defaults', async () => {
      const oldHeaders = PLAN_TEMPLATE_HEADERS.filter((h) => h !== 'Workflow' && h !== 'Source Video Link');
      expect(oldHeaders).toHaveLength(20);
      const file = await legacyXlsx(oldHeaders, [
        { 'Posting Date': '12 Jun, 2032', Topic: 'WF Old reel', Type: 'Reel', 'Script Owner': 'WF Writer' },
        { 'Posting Date': '13 Jun, 2032', Topic: 'WF Old carousel', Type: 'Carousel Post', 'Content Owner': 'WF Writer', 'Design Owner': 'WF Designer' },
      ]);
      const res = await upload(MONTH, file);
      expect(res.status).toBe(200);
      const [reel, carousel] = res.body.data.results;
      expect(reel.cellErrors).toEqual({});
      expect(carousel.cellErrors).toEqual({});
      expect(reel.resolved).toBeDefined();
      expect(res.body.data.counts).toMatchObject({ valid: 2, invalid: 0 });
    });
  });
});
