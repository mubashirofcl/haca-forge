// PG-1: Excel-style plan grid — month periods, paste parsing, grid load/save API.
// Runs against the disposable test DB (marketing_portal_test). Sample rows follow the
// November Excel structure with made-up data, not production data.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import {
  monthPeriod,
  planMonthKey,
  monthKeyInAppTz,
  parseGridDate,
  parseGridType,
  matchGridOwner,
  parseClipboardTsv,
  pastedRowsToCells,
  PLAN_GRID_COLUMNS,
} from '@mmp/shared';
import { resolvePlanPeriod } from '../src/modules/calendar/plan.service.js';

const EMAIL = /@pg1-grid-test\.com$/;
const HEADERS = PLAN_GRID_COLUMNS.map((c) => c.header);
const tsv = (rows) => rows.map((r) => r.join('\t')).join('\r\n');
/** One Excel row in the 18-column order; workflow cells carry Excel-style values that must be ignored. */
const excelRow = ({ date, topic, type, script = '', shoot = '', edit = '', poster = '', remarks = '' }) => [
  date, topic, type,
  'Done', '1 Nov, 2031', script,
  'Done', '3 Nov, 2031', shoot,
  'Pending', '', edit,
  'Approved', '5 Nov, 2031',
  '6 Nov, 2031', poster,
  '4', remarks,
];

describe('PG-1 plan grid', () => {
  const people = {};
  const tokens = {};
  const make = (u) => jwt.sign({ userId: u._id.toString(), email: u.email, role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
  const cleanup = async () => {
    const ids = (await Person.find({ email: EMAIL }).select('_id').lean()).map((p) => p._id);
    const plans = await CalendarPlan.find({ $or: [{ createdById: { $in: ids } }, { code: /^PG1-/ }] }).select('_id').lean();
    await ContentPiece.deleteMany({ $or: [{ planId: { $in: plans.map((p) => p._id) } }, { topic: /^PG1 / }] });
    await CalendarPlan.deleteMany({ _id: { $in: plans.map((p) => p._id) } });
    await Person.deleteMany({ email: EMAIL });
  };

  beforeAll(async () => {
    await connectDB();
    await cleanup();
    const mk = (key, name, role, workPreferences = []) =>
      Person.create({ name, email: `${key}@pg1-grid-test.com`, role, status: 'active', workPreferences }).then((p) => {
        people[key] = p;
        tokens[key] = make(p);
      });
    await mk('sm', 'PG1 SM Manager', 'sm_manager');
    await mk('admin', 'PG1 Admin', 'admin');
    await mk('head', 'PG1 Creative Head', 'creative_head');
    await mk('exec', 'PG1 Executive', 'executive');
    await mk('member', 'PG1 Member', 'team_member', ['Content']);
    await mk('writer', 'PG1 Writer', 'team_member', ['Script', 'Content']);
    await mk('shooter', 'PG1 Shooter', 'team_member', ['Shoot']);
    await mk('editor', 'PG1 Editor', 'team_member', ['Edit']);
    await mk('designer', 'PG1 Designer', 'team_member', ['Design']);
    await mk('poster', 'PG1 Poster', 'team_member', ['Post']);
    await mk('twin1', 'PG1 Twin', 'team_member', ['Edit']);
    await mk('twin2', 'PG1 Twin', 'team_member', ['Edit']);
  });

  afterAll(cleanup);

  describe('month periods', () => {
    it('monthPeriod covers the whole month, including year ends and leap years', () => {
      const jan = monthPeriod('2027-01');
      expect(jan.periodStart.toISOString()).toBe('2027-01-01T00:00:00.000Z');
      expect(jan.periodEnd.toISOString()).toBe('2027-01-31T23:59:59.999Z');
      expect(monthPeriod('2028-02').periodEnd.toISOString()).toBe('2028-02-29T23:59:59.999Z');
      expect(monthPeriod('2026-12').periodEnd.toISOString()).toBe('2026-12-31T23:59:59.999Z');
      expect(() => monthPeriod('2027-13')).toThrow();
    });

    it('reads the month in the app timezone for both stored conventions', () => {
      expect(planMonthKey('2027-01-01T00:00:00.000Z')).toBe('2027-01'); // date-only (UTC midnight)
      expect(planMonthKey('2026-12-31T18:30:00.000Z')).toBe('2027-01'); // local (IST) midnight
      // 20:00 UTC on 31 Dec is already 1 Jan in IST.
      expect(monthKeyInAppTz('2026-12-31T20:00:00.000Z')).toBe('2027-01');
    });

    it('resolvePlanPeriod uses the whole month and ignores a stale end (the SM January 2027 bug)', () => {
      const p = resolvePlanPeriod({ kind: 'monthly', month: '2027-01', periodStart: '2027-01-01', periodEnd: '2026-12-31' });
      expect(p.periodStart.toISOString().slice(0, 10)).toBe('2027-01-01');
      expect(p.periodEnd.toISOString().slice(0, 10)).toBe('2027-01-31');
      expect(() => resolvePlanPeriod({ kind: 'monthly', periodStart: '2027-01-01', periodEnd: '2026-12-31' })).toThrow(/before/);
      expect(() => resolvePlanPeriod({ kind: 'individual', periodStart: '2027-01-02', periodEnd: '2027-01-01' })).toThrow(/before/);
    });

    it('POST /calendar-plans with month stores Jan 1 - Jan 31; end before start is rejected', async () => {
      const ok = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${tokens.sm}`)
        .send({ calendar: 'other', kind: 'monthly', month: '2032-01', periodStart: '2032-01-01', periodEnd: '2031-12-31' });
      expect(ok.status).toBe(201);
      expect(ok.body.data.periodStart.slice(0, 10)).toBe('2032-01-01');
      expect(ok.body.data.periodEnd.slice(0, 10)).toBe('2032-01-31');

      const bad = await request(app)
        .post('/api/calendar-plans')
        .set('Authorization', `Bearer ${tokens.sm}`)
        .send({ calendar: 'other', kind: 'monthly', periodStart: '2032-02-01', periodEnd: '2032-01-31' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('INVALID_PERIOD');
    });
  });

  describe('type, date and owner parsing', () => {
    it('parses the accepted date formats', () => {
      expect(parseGridDate('2 Nov, 2026')).toEqual({ ok: true, value: '2026-11-02' });
      expect(parseGridDate('2 November 2026')).toEqual({ ok: true, value: '2026-11-02' });
      expect(parseGridDate('Nov 2, 2026')).toEqual({ ok: true, value: '2026-11-02' });
      expect(parseGridDate('16/11/2026')).toEqual({ ok: true, value: '2026-11-16' });
      expect(parseGridDate('2026-11-16')).toEqual({ ok: true, value: '2026-11-16' });
      expect(parseGridDate('5/5/2026')).toEqual({ ok: true, value: '2026-05-05' });
    });

    it('does not guess ambiguous or impossible dates', () => {
      const amb = parseGridDate('02/11/2026');
      expect(amb.ok).toBe(false);
      expect(amb.ambiguous).toBe(true);
      expect(amb.error).toMatch(/2 Nov 2026 or 11 Feb 2026/);
      expect(parseGridDate('31/02/2026').ok).toBe(false);
      expect(parseGridDate('11/16/2026').ok).toBe(false); // month-first is not accepted
      expect(parseGridDate('next Tuesday').ok).toBe(false);
      expect(parseGridDate('').empty).toBe(true);
    });

    it('maps Excel type words and rejects unknown ones', () => {
      expect(parseGridType('Poster')).toEqual({ ok: true, value: 'Static Post' });
      expect(parseGridType('Carousal')).toEqual({ ok: true, value: 'Carousel Post' });
      expect(parseGridType('reel')).toEqual({ ok: true, value: 'Reel' });
      expect(parseGridType('Brochure')).toEqual({ ok: true, value: 'Brochure' });
      expect(parseGridType('Reelz').ok).toBe(false);
      expect(parseGridType('Carousel-ish').ok).toBe(false);
    });

    it('matches owners by exact name only', () => {
      const list = [
        { _id: 'a', name: 'Asha K' },
        { _id: 'b', name: 'Ravi' },
        { _id: 'c', name: 'Ravi' },
      ];
      expect(matchGridOwner(' Asha K ', list)).toEqual({ ok: true, id: 'a', name: 'Asha K' });
      expect(matchGridOwner('asha k', list).ok).toBe(false);
      expect(matchGridOwner('Asha', list).ok).toBe(false);
      const twin = matchGridOwner('Ravi', list);
      expect(twin.ok).toBe(false);
      expect(twin.ambiguous).toBe(true);
      expect(matchGridOwner('', list)).toEqual({ ok: true, empty: true });
    });

    it('splits Excel clipboard text, including quoted cells with tabs and line breaks', () => {
      const rows = parseClipboardTsv('a\t"b\tc"\t"line1\nline2"\r\nx\t"say ""hi"""\t\r\n\r\n');
      expect(rows).toEqual([
        ['a', 'b\tc', 'line1\nline2'],
        ['x', 'say "hi"', ''],
      ]);
    });

    it('places pasted columns by header, or by the paste column without a header', () => {
      const withHeader = pastedRowsToCells([['Topic', 'Posting Date', 'Mystery'], ['T1', '2 Nov, 2031', 'x']]);
      expect(withHeader.headerDetected).toBe(true);
      expect(withHeader.unknownHeaders).toEqual(['Mystery']);
      expect(withHeader.cells[0]).toEqual({ topic: 'T1', postingDate: '2 Nov, 2031' });

      const fromTopic = pastedRowsToCells([['T2', 'Reel']], 'topic');
      expect(fromTopic.headerDetected).toBe(false);
      expect(fromTopic.cells[0]).toEqual({ topic: 'T2', type: 'Reel' });
    });
  });

  describe('grid API', () => {
    const post = (who, body) => request(app).post('/api/calendar-plans/grid/rows').set('Authorization', `Bearer ${tokens[who]}`).send(body);
    const get = (who, q) => request(app).get('/api/calendar-plans/grid').query(q).set('Authorization', `Bearer ${tokens[who]}`);

    it('loading an empty month creates nothing', async () => {
      const res = await get('sm', { calendar: 'ads', month: '2031-11' });
      expect(res.status).toBe(200);
      expect(res.body.data.plans).toEqual([]);
      expect(res.body.data.plan).toBeNull();
      expect(res.body.data.columns).toHaveLength(18);
      expect(res.body.data.permissions).toEqual({ canEdit: true, canReview: false, readOnly: false });
      expect(await CalendarPlan.countDocuments({ calendar: 'ads', title: /November 2031/ })).toBe(0);
    });

    it('dry run validates a paste without creating a plan', async () => {
      const res = await post('sm', {
        calendar: 'ads',
        month: '2031-11',
        dryRun: true,
        tsv: tsv([HEADERS, excelRow({ date: '2 Nov, 2031', topic: 'PG1 Dry', type: 'Poster' })]),
      });
      expect(res.status).toBe(200);
      expect(res.body.data.counts).toMatchObject({ total: 1, valid: 1, saved: 0 });
      expect(res.body.data.plan).toBeNull();
      expect(await ContentPiece.countDocuments({ topic: 'PG1 Dry' })).toBe(0);
    });

    it('multi-row paste: saves valid rows, creates the draft once, flags bad cells', async () => {
      const text = tsv([
        HEADERS,
        excelRow({ date: '12 Nov, 2031', topic: 'PG1 Founder reel', type: 'Reel', script: 'PG1 Writer', shoot: 'PG1 Shooter', edit: 'PG1 Editor', poster: 'PG1 Poster', remarks: 'Campus' }),
        excelRow({ date: '16/11/2031', topic: 'PG1 Admissions poster', type: 'Poster', remarks: 'Batch 14' }),
        excelRow({ date: '20 Nov, 2031', topic: 'PG1 Carousel tips', type: 'Carousal', poster: 'PG1 Poster' }),
        excelRow({ date: '03/04/2031', topic: 'PG1 Ambiguous date', type: 'Reel' }),
        excelRow({ date: '22 Nov, 2031', topic: 'PG1 Unknown owner', type: 'Reel', edit: 'Nobody Here' }),
        excelRow({ date: '23 Nov, 2031', topic: 'PG1 Bad type', type: 'Reelz' }),
        excelRow({ date: '24 Nov, 2031', topic: 'PG1 Twin owner', type: 'Reel', edit: 'PG1 Twin' }),
        excelRow({ date: '25 Nov, 2031', topic: 'PG1 Script on poster', type: 'Poster', script: 'PG1 Writer' }),
        excelRow({ date: '05/11/2031', topic: 'PG1 Month resolves date', type: 'Poster' }),
      ]);
      const res = await post('sm', { calendar: 'ads', month: '2031-11', tsv: text });
      expect(res.status).toBe(201);
      const d = res.body.data;
      expect(d.paste).toMatchObject({ headerDetected: true, rowCount: 9 });
      expect(d.planCreated).toBe(true);
      expect(d.plan.periodStart.slice(0, 10)).toBe('2031-11-01');
      expect(d.plan.periodEnd.slice(0, 10)).toBe('2031-11-30');
      expect(d.counts).toMatchObject({ total: 9, saved: 5, invalid: 4 });

      const by = Object.fromEntries(d.results.map((r) => [r.clientKey, r]));
      // Workflow cells are never written; they are reported as ignored.
      expect(by['paste-1'].ignoredCells).toEqual(expect.arrayContaining(['scriptStatus', 'approvalStatus', 'publishedDate', 'turnaroundDays']));
      expect(by['paste-1'].row).toMatchObject({ type: 'Reel', scriptOwner: 'PG1 Writer', shootOwner: 'PG1 Shooter', editOwner: 'PG1 Editor', postingOwner: 'PG1 Poster', scriptStatus: '', approvalStatus: '', turnaroundDays: null, rowStatus: 'draft' });
      expect(by['paste-2'].row).toMatchObject({ type: 'Static Post', postingDate: '2031-11-16', scriptStatus: 'N/A' });
      expect(by['paste-3'].row.type).toBe('Carousel Post');
      expect(by['paste-4'].cellErrors.postingDate[0]).toMatch(/could be 3 Apr 2031 or 4 Mar 2031/);
      // 05/11 in a November grid: only 5 Nov falls in the month, so it is accepted and shown as resolved.
      expect(by['paste-9'].resolved.postingDate).toEqual({ input: '05/11/2031', value: '2031-11-05', byMonth: true });
      expect(by['paste-2'].resolved.type).toEqual({ input: 'Poster', value: 'Static Post' });
      expect(by['paste-5'].cellErrors.editOwner[0]).toMatch(/No active person is named exactly "Nobody Here"/);
      expect(by['paste-6'].cellErrors.type[0]).toMatch(/Unknown type "Reelz"/);
      expect(by['paste-7'].cellErrors.editOwner[0]).toMatch(/More than one active person/);
      // Script Owner is the Script / Content column: on a design row it sets the Content owner.
      expect(by['paste-8'].cellErrors).toEqual({});
      expect(by['paste-8'].row).toMatchObject({ type: 'Static Post', contentOwner: 'PG1 Writer', scriptStatus: 'N/A' });

      // Second paste into the same month reuses the plan; a duplicate is flagged on the new row only.
      const again = await post('sm', {
        calendar: 'ads',
        month: '2031-11',
        tsv: tsv([excelRow({ date: '12 Nov, 2031', topic: 'PG1 Founder reel', type: 'Reel' })]),
      });
      expect(again.status).toBe(200);
      expect(again.body.data.planCreated).toBe(false);
      expect(again.body.data.results[0].cellErrors.topic[0]).toMatch(/Duplicate row/);
      expect(await CalendarPlan.countDocuments({ calendar: 'ads', kind: 'monthly', periodStart: new Date('2031-11-01T00:00:00.000Z') })).toBe(1);
    });

    it('autofills blank owners and deadlines; keeps manual owners and deadlines on later edits', async () => {
      const created = await post('sm', {
        calendar: 'ads',
        month: '2031-12',
        rows: [{ clientKey: 'r1', cells: { postingDate: '20 Dec, 2031', topic: 'PG1 Autofill reel', type: 'Reel', editOwner: 'PG1 Editor', deadlines: { Edit: '17 Dec, 2031' } } }],
      });
      expect(created.status).toBe(201);
      const r = created.body.data.results[0];
      expect(r.status).toBe('saved');
      expect(r.row.ownerSources.Edit).toEqual({ owner: 'manual', deadline: 'manual' });
      expect(r.row.ownerSources.Script).toEqual({ owner: 'suggested', deadline: 'auto' });
      expect(r.row.stepDeadlines).toMatchObject({ Script: '2031-12-12', Shoot: '2031-12-15', Edit: '2031-12-17', Post: '2031-12-20' });
      expect(r.row.scriptOwner).not.toBe(''); // a Script-preference person exists, so autofill picks one

      // Move the posting date: auto deadlines follow, the manual Edit deadline and owner stay.
      const moved = await post('sm', {
        calendar: 'ads',
        month: '2031-12',
        rows: [{ rowId: r.rowId, cells: { postingDate: '22 Dec, 2031' } }],
      });
      const m = moved.body.data.results[0].row;
      expect(m.stepDeadlines).toMatchObject({ Script: '2031-12-14', Shoot: '2031-12-17', Edit: '2031-12-17', Post: '2031-12-22' });
      expect(m.editOwner).toBe('PG1 Editor');

      // Clearing the owner cell returns that step to autofill.
      const cleared = await post('sm', { calendar: 'ads', month: '2031-12', rows: [{ rowId: r.rowId, cells: { editOwner: '' } }] });
      expect(cleared.body.data.results[0].row.ownerSources.Edit.owner).toBe('suggested');
    });

    it('bulk validation reports existing rule errors on the right cells', async () => {
      const res = await post('sm', {
        calendar: 'ads',
        month: '2031-12',
        dryRun: true,
        rows: [
          { clientKey: 'late', cells: { postingDate: '10 Dec, 2031', topic: 'PG1 Late edit', type: 'Reel', deadlines: { Edit: '12 Dec, 2031' } } },
          { clientKey: 'shooter-as-editor', cells: { postingDate: '11 Dec, 2031', topic: 'PG1 Wrong skill', type: 'Reel', editOwner: 'PG1 Shooter' } },
          { clientKey: 'no-topic', cells: { postingDate: '12 Dec, 2031', topic: '', type: 'Poster' } },
          { clientKey: 'outside', cells: { postingDate: '5 Jan, 2032', topic: 'PG1 January post', type: 'Poster' } },
        ],
      });
      const by = Object.fromEntries(res.body.data.results.map((r) => [r.clientKey, r]));
      expect(by.late.cellErrors['deadline.Edit'].join(' ')).toMatch(/after posting date/);
      expect(by['shooter-as-editor'].cellErrors.editOwner.join(' ')).toMatch(/work preferences/);
      expect(by['no-topic'].cellErrors.topic[0]).toMatch(/Topic is required/);
      expect(by.outside.status).toBe('valid');
      expect(by.outside.warnings.map((w) => w.code)).toContain('MONTH_MISMATCH');
    });

    it('approved rows are locked in the grid', async () => {
      const grid = await get('sm', { calendar: 'ads', month: '2031-12' });
      const rowId = grid.body.data.rows[0].rowId;
      await ContentPiece.updateOne({ _id: rowId }, { $set: { rowStatus: 'approved' } });
      const res = await post('sm', { calendar: 'ads', month: '2031-12', rows: [{ rowId, cells: { remarks: 'try' } }] });
      expect(res.body.data.results[0].status).toBe('locked');
    });

    it('a month with several plans needs a selection; existing duplicates are not merged', async () => {
      const mk = (code) =>
        CalendarPlan.create({ code, title: code, calendar: 'sales', kind: 'monthly', ...monthPeriod('2031-10'), createdById: people.sm._id });
      const a = await mk('PG1-DUP-A');
      await mk('PG1-DUP-B');
      const grid = await get('sm', { calendar: 'sales', month: '2031-10' });
      expect(grid.body.data.plans).toHaveLength(2);
      expect(grid.body.data.selectionRequired).toBe(true);
      expect(grid.body.data.plan).toBeNull();

      const blocked = await post('sm', { calendar: 'sales', month: '2031-10', rows: [{ cells: { postingDate: '20 Oct, 2031', topic: 'PG1 Pick', type: 'Poster' } }] });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('PLAN_SELECTION_REQUIRED');
      expect(blocked.body.error.details.plans).toHaveLength(2);

      const chosen = await post('sm', { calendar: 'sales', month: '2031-10', planId: String(a._id), rows: [{ cells: { postingDate: '20 Oct, 2031', topic: 'PG1 Pick', type: 'Poster' } }] });
      expect(chosen.status).toBe(201);
      expect(chosen.body.data.plan._id).toBe(String(a._id));
      expect(await CalendarPlan.countDocuments({ code: /^PG1-DUP-/ })).toBe(2);
    });

    it('role permissions: SM and admin edit; Creative Head reviews; executive read-only and redacted; team member blocked', async () => {
      const q = { calendar: 'ads', month: '2031-11' };
      const sm = await get('sm', q);
      expect(sm.body.data.people.length).toBeGreaterThan(0);
      expect(JSON.stringify(sm.body.data.people)).not.toMatch(/@/);

      const head = await get('head', q);
      expect(head.status).toBe(200);
      expect(head.body.data.permissions).toEqual({ canEdit: false, canReview: true, readOnly: false });

      const exec = await get('exec', q);
      expect(exec.status).toBe(200);
      expect(exec.body.data.permissions).toEqual({ canEdit: false, canReview: false, readOnly: true });
      expect(exec.body.data.people).toEqual([]);
      expect(JSON.stringify(exec.body.data.rows)).not.toMatch(/@|email|phone/i);

      // PG-3: team members get 404 on the grid (isolation rule), not 403.
      expect((await get('member', q)).status).toBe(404);

      const row = { rows: [{ cells: { postingDate: '26 Nov, 2031', topic: 'PG1 Role check', type: 'Poster' } }], ...q };
      expect((await post('exec', row)).status).toBe(403);
      expect((await post('head', row)).status).toBe(403);
      expect((await post('member', row)).status).toBe(404);
      expect((await post('admin', row)).status).toBe(201);
    });

    it('rejects bad calendar or month input', async () => {
      expect((await get('sm', { calendar: 'nope', month: '2031-11' })).status).toBe(400);
      expect((await get('sm', { calendar: 'sm', month: '2031-13' })).status).toBe(400);
      expect((await post('sm', { calendar: 'sm', month: '2031-11', rows: [] })).status).toBe(400);
    });
  });

  describe('existing template and upload flows still work', () => {
    it('downloads the Excel template', async () => {
      const res = await request(app).get('/api/calendar-plans/template').set('Authorization', `Bearer ${tokens.sm}`).buffer(true).parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
      expect(res.body.length).toBeGreaterThan(1000);
    });

    it('upload preview still validates rows', async () => {
      const res = await request(app)
        .post('/api/calendar-plans/preview')
        .set('Authorization', `Bearer ${tokens.sm}`)
        .send({ rows: [{ postingDate: '2031-11-20', topic: 'PG1 Upload row', contentType: 'Static Post' }] });
      expect(res.status).toBe(200);
      expect(res.body.data.totalRows).toBe(1);
    });
  });
});
