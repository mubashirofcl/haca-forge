// PG-2: grid decisions — month-resolved slash dates, exact type picks, Content/Design owner
// columns, reel variants, owner picks by id, template/upload (new + older layout), and
// batched autofill. Disposable test DB; synthetic rows in the November Excel structure.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { autofillRowPlan, buildAutofillContext } from '../src/modules/calendar/autofill.service.js';
import {
  parseGridDate,
  parseGridType,
  DELIVERABLE_TYPE_KEYS,
  PLAN_GRID_COLUMNS,
  PLAN_GRID_DISPLAY_COLUMNS,
  PLAN_TEMPLATE_HEADERS,
  isNewPlanLayout,
} from '@mmp/shared';

const EMAIL = /@pg2-grid-test\.com$/;

async function xlsx(headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Calendar Plan');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('PG-2 plan grid', () => {
  const people = {};
  const tokens = {};
  const make = (u) => jwt.sign({ userId: u._id.toString(), email: u.email, role: u.role }, env.JWT_SECRET, { expiresIn: '1h' });
  const cleanup = async () => {
    const ids = (await Person.find({ email: EMAIL }).select('_id').lean()).map((p) => p._id);
    const plans = await CalendarPlan.find({ createdById: { $in: ids } }).select('_id').lean();
    await ContentPiece.deleteMany({ $or: [{ planId: { $in: plans.map((p) => p._id) } }, { topic: /^PG2 / }] });
    await CalendarPlan.deleteMany({ _id: { $in: plans.map((p) => p._id) } });
    await Person.deleteMany({ email: EMAIL });
  };

  beforeAll(async () => {
    await connectDB();
    await cleanup();
    const mk = (key, name, role, workPreferences = []) =>
      Person.create({ name, email: `${key}@pg2-grid-test.com`, role, status: 'active', workPreferences }).then((p) => {
        people[key] = p;
        tokens[key] = make(p);
      });
    await mk('sm', 'PG2 SM Manager', 'sm_manager');
    await mk('writer', 'PG2 Writer', 'team_member', ['Script', 'Content']);
    await mk('shooter', 'PG2 Shooter', 'team_member', ['Shoot']);
    await mk('editor', 'PG2 Editor', 'team_member', ['Edit']);
    await mk('designer', 'PG2 Designer', 'team_member', ['Design']);
    await mk('poster', 'PG2 Poster', 'team_member', ['Post']);
    await mk('twin1', 'PG2 Twin', 'team_member', ['Edit']);
    await mk('twin2', 'PG2 Twin', 'team_member', ['Edit']);
  });
  afterAll(cleanup);

  const post = (body) => request(app).post('/api/calendar-plans/grid/rows').set('Authorization', `Bearer ${tokens.sm}`).send(body);

  describe('slash dates resolved by the grid month', () => {
    it('accepts a date only when exactly one reading falls in the month', () => {
      expect(parseGridDate('02/11/2026', { month: '2026-11' })).toEqual({ ok: true, value: '2026-11-02', resolvedByMonth: true });
      expect(parseGridDate('11/02/2026', { month: '2026-11' })).toEqual({ ok: true, value: '2026-11-02', resolvedByMonth: true });
      expect(parseGridDate('11/16/2026', { month: '2026-11' })).toEqual({ ok: true, value: '2026-11-16', resolvedByMonth: true });
      expect(parseGridDate('16/11/2026', { month: '2026-12' })).toEqual({ ok: true, value: '2026-11-16' }); // unambiguous day/month
      expect(parseGridDate('03/04/2026', { month: '2026-11' }).ok).toBe(false); // neither reading in November
      expect(parseGridDate('11/16/2026', { month: '2026-12' }).ok).toBe(false); // month-first only, outside the month
      expect(parseGridDate('02/11/2026').ok).toBe(false); // no month: still not guessed
      expect(parseGridDate('07/07/2026', { month: '2026-11' })).toEqual({ ok: true, value: '2026-07-07' }); // both readings equal
    });
  });

  describe('types', () => {
    it('keeps all 15 documented types selectable, while typed "Poster" means Static Post', () => {
      expect(DELIVERABLE_TYPE_KEYS).toHaveLength(15);
      for (const t of DELIVERABLE_TYPE_KEYS) expect(parseGridType(t, { exact: true })).toEqual({ ok: true, value: t });
      expect(parseGridType('Poster', { exact: true })).toEqual({ ok: true, value: 'Poster' });
      expect(parseGridType('Poster')).toEqual({ ok: true, value: 'Static Post' });
    });

    it('a type picked from the list is saved as that type', async () => {
      const res = await post({ calendar: 'other', month: '2031-11', dryRun: true, rows: [{ cells: { postingDate: '10 Nov, 2031', topic: 'PG2 Print poster', type: 'Poster', typeExact: true } }] });
      expect(res.body.data.results[0].status).toBe('valid');
      expect(res.body.data.results[0].resolved.type).toBeUndefined();
    });
  });

  describe('columns', () => {
    it('keeps the 18 Excel columns and adds Content Owner, Design Owner, Workflow and Source Video Link as optional columns', () => {
      expect(PLAN_GRID_COLUMNS).toHaveLength(18);
      expect(PLAN_GRID_DISPLAY_COLUMNS.map((c) => c.key)).toEqual([
        'postingDate', 'topic', 'type', 'workflow',
        'scriptStatus', 'scriptDoneDate', 'scriptOwner', 'contentOwner',
        'shootStatus', 'shootDoneDate', 'shootOwner',
        'editStatus', 'editDoneDate', 'editOwner', 'designOwner',
        'approvalStatus', 'approvalDate', 'publishedDate', 'postingOwner', 'turnaroundDays', 'remarks', 'sourceVideoLink',
      ]);
      expect(PLAN_GRID_DISPLAY_COLUMNS.find((c) => c.key === 'turnaroundDays').help).toMatch(/row approval to publishing/);
    });

    it('sets Content and Design owners on design rows and flags them on reels', async () => {
      const res = await post({
        calendar: 'other',
        month: '2031-11',
        dryRun: true,
        rows: [
          { clientKey: 'static', cells: { postingDate: '12 Nov, 2031', topic: 'PG2 Static', type: 'Static Post', contentOwner: 'PG2 Writer', designOwner: 'PG2 Designer' } },
          { clientKey: 'reel', cells: { postingDate: '13 Nov, 2031', topic: 'PG2 Reel', type: 'Reel', contentOwner: 'PG2 Writer' } },
        ],
      });
      const by = Object.fromEntries(res.body.data.results.map((r) => [r.clientKey, r]));
      expect(by.static.status).toBe('valid');
      expect(by.reel.cellErrors.contentOwner[0]).toMatch(/Reel · Full has no Content step/);
    });
  });

  describe('reels', () => {
    it('defaults to Script + Shoot and flags owners on steps the variant does not have', async () => {
      const res = await post({
        calendar: 'other',
        month: '2031-11',
        dryRun: true,
        rows: [
          { clientKey: 'default', cells: { postingDate: '14 Nov, 2031', topic: 'PG2 Reel A', type: 'Reel', scriptOwner: 'PG2 Writer', shootOwner: 'PG2 Shooter' } },
          { clientKey: 'noscript', cells: { postingDate: '15 Nov, 2031', topic: 'PG2 Reel B', type: 'Reel', needsScript: 'No', scriptOwner: 'PG2 Writer' } },
          { clientKey: 'noshoot', cells: { postingDate: '16 Nov, 2031', topic: 'PG2 Reel C', type: 'Reel', needsScript: 'No', needsShoot: 'No', shootOwner: 'PG2 Shooter', sourceVideoLink: 'https://example.invalid/raw.mp4' } },
        ],
      });
      const by = Object.fromEntries(res.body.data.results.map((r) => [r.clientKey, r]));
      expect(by.default.status).toBe('valid');
      expect(by.noscript.cellErrors.scriptOwner[0]).toMatch(/Reel · Shoot \+ Edit has no Script step/);
      expect(by.noshoot.cellErrors.shootOwner[0]).toMatch(/Reel · Edit only has no Shoot step/);
    });
  });

  describe('owners picked from the list', () => {
    it('tells two people with the same name apart by id', async () => {
      const typed = await post({ calendar: 'other', month: '2031-11', dryRun: true, rows: [{ cells: { postingDate: '17 Nov, 2031', topic: 'PG2 Twin typed', type: 'Reel', editOwner: 'PG2 Twin' } }] });
      expect(typed.body.data.results[0].cellErrors.editOwner[0]).toMatch(/More than one active person/);
      const picked = await post({ calendar: 'other', month: '2031-11', dryRun: true, rows: [{ cells: { postingDate: '17 Nov, 2031', topic: 'PG2 Twin picked', type: 'Reel', editOwnerId: String(people.twin2._id) } }] });
      expect(picked.body.data.results[0].status).toBe('valid');
    });
  });

  describe('template and upload', () => {
    const download = (q = '') =>
      request(app).get(`/api/calendar-plans/template${q}`).set('Authorization', `Bearer ${tokens.sm}`).buffer(true).parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    const headersOf = async (buf) => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const out = [];
      wb.worksheets[0].getRow(1).eachCell((c) => out.push(c.value));
      return out;
    };

    it('template has the 18 Excel columns plus Content Owner, Design Owner, Workflow and Source Video Link; the older one is still available', async () => {
      const headers = await headersOf((await download()).body);
      expect(headers).toEqual(PLAN_TEMPLATE_HEADERS);
      expect(headers).toHaveLength(22);
      expect(isNewPlanLayout(headers)).toBe(true);
      const legacy = await headersOf((await download('?layout=legacy')).body);
      expect(legacy).toHaveLength(23);
      expect(isNewPlanLayout(legacy)).toBe(false);
    });

    it('new-layout upload: dry run shows resolved values and name errors, then saves', async () => {
      const file = await xlsx(PLAN_TEMPLATE_HEADERS, [
        ['04/12/2031', 'PG2 Upload reel', 'Reel', '', '', 'PG2 Writer', '', '', 'PG2 Shooter', '', '', 'PG2 Editor', '', '', '', 'PG2 Poster', '', 'From file', '', ''],
        [new Date(Date.UTC(2031, 11, 18)), 'PG2 Upload static', 'Poster', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'PG2 Writer', 'PG2 Designer'],
        ['19 Dec, 2031', 'PG2 Upload twin', 'Reel', '', '', '', '', '', '', '', '', 'PG2 Twin', '', '', '', '', '', '', '', ''],
      ]);
      const send = (dryRun) =>
        request(app)
          .post('/api/calendar-plans/grid/upload')
          .set('Authorization', `Bearer ${tokens.sm}`)
          .field('calendar', 'other')
          .field('month', '2031-12')
          .field('dryRun', String(dryRun))
          .attach('file', file, 'plan.xlsx');

      const preview = await send(true);
      expect(preview.status).toBe(200);
      const d = preview.body.data;
      expect(d.upload).toEqual({ layout: 'grid', rowCount: 3 });
      expect(d.plan).toBeNull();
      const [reel, stat, twin] = d.results;
      expect(reel.resolved.postingDate).toEqual({ input: '04/12/2031', value: '2031-12-04', byMonth: true });
      expect(stat.status).toBe('valid');
      expect(stat.resolved.type).toEqual({ input: 'Poster', value: 'Static Post' });
      expect(twin.cellErrors.editOwner[0]).toMatch(/More than one active person/);

      const saved = await send(false);
      expect(saved.status).toBe(201);
      expect(saved.body.data.counts).toMatchObject({ saved: 2, invalid: 1 });
      const savedStatic = saved.body.data.results[1].row;
      expect(savedStatic).toMatchObject({ type: 'Static Post', postingDate: '2031-12-18', contentOwner: 'PG2 Writer', designOwner: 'PG2 Designer' });
    });

    it('older 23-column files still upload; owner emails are resolved', async () => {
      const legacyHeaders = (await headersOf((await download('?layout=legacy')).body));
      const row = Object.fromEntries(legacyHeaders.map((h) => [h, '']));
      Object.assign(row, {
        'Posting Date': '2031-12-22',
        'Posting Time': '17:00',
        Topic: 'PG2 Legacy reel',
        Type: 'Reel',
        'Needs Script': 'No',
        'Needs Shoot': 'Yes',
        'Shoot Owner': 'shooter@pg2-grid-test.com',
        'Edit Owner': 'PG2 Editor',
        'Edit Deadline': '2031-12-20',
      });
      const file = await xlsx(legacyHeaders, [legacyHeaders.map((h) => row[h])]);
      const res = await request(app)
        .post('/api/calendar-plans/grid/upload')
        .set('Authorization', `Bearer ${tokens.sm}`)
        .field('calendar', 'other')
        .field('month', '2031-12')
        .attach('file', file, 'old-plan.xlsx');
      expect(res.status).toBe(201);
      expect(res.body.data.upload.layout).toBe('legacy');
      const r = res.body.data.results[0].row;
      expect(r).toMatchObject({ topic: 'PG2 Legacy reel', publishTime: '17:00', needsScript: false, shootOwner: 'PG2 Shooter', editOwner: 'PG2 Editor' });
      expect(r.stepDeadlines.Edit).toBe('2031-12-20');
      expect(r.ownerSources.Edit.deadline).toBe('manual');
    });

    it('the older preview endpoint also matches owners by exact name, with the same ambiguity error', async () => {
      const res = await request(app)
        .post('/api/calendar-plans/preview')
        .set('Authorization', `Bearer ${tokens.sm}`)
        .send({
          rows: [
            { postingDate: '2031-11-20', topic: 'PG2 Preview named', contentType: 'Reel', needsScript: 'Yes', needsShoot: 'Yes', editOwner: 'PG2 Editor' },
            { postingDate: '2031-11-21', topic: 'PG2 Preview twin', contentType: 'Reel', needsScript: 'Yes', needsShoot: 'Yes', editOwner: 'PG2 Twin' },
          ],
        });
      expect(res.status).toBe(200);
      const [named, twin] = res.body.data.rows;
      expect(named.stagePlan.find((s) => s.stageKey === 'Edit')).toMatchObject({ ownerName: 'PG2 Editor', ownerSource: 'manual' });
      expect(twin.errors.join(' ')).toMatch(/More than one active person is named "PG2 Twin"/);
    });
  });

  describe('batched autofill', () => {
    it('gives the same suggestions as the per-row version, with earlier rows counted in order', async () => {
      const rows = [
        { type: 'Reel', postingDate: new Date('2031-11-20T00:00:00Z'), needsScript: true, needsShoot: true },
        { type: 'Static Post', postingDate: new Date('2031-11-21T00:00:00Z') },
        { type: 'Reel', postingDate: new Date('2031-11-22T00:00:00Z'), needsScript: true, needsShoot: true },
      ];
      const run = async (useContext) => {
        const ctx = useContext ? await buildAutofillContext() : null;
        const done = [];
        const out = [];
        for (const r of rows) {
          const s = await autofillRowPlan({ ...r, currentPlanRows: done, context: ctx });
          out.push(s.stages.map((x) => `${x.stageKey}:${x.ownerId}:${x.reason}`));
          done.push({ stagePlan: s.stages.map((x) => ({ stageKey: x.stageKey, ownerId: x.ownerId })) });
        }
        return out;
      };
      expect(await run(true)).toEqual(await run(false));
    });

    it('reads workload once per paste, not once per row', async () => {
      const spy = vi.spyOn(Person, 'find');
      const rows = Array.from({ length: 12 }, (_, i) => ({ cells: { postingDate: `${i + 10} Nov, 2031`, topic: `PG2 Speed ${i}`, type: i % 2 ? 'Reel' : 'Static Post' } }));
      const started = Date.now();
      const res = await post({ calendar: 'other', month: '2031-11', dryRun: true, rows });
      const elapsed = Date.now() - started;
      const memberLoads = spy.mock.calls.filter(([q]) => q && q.role === 'team_member').length;
      spy.mockRestore();
      expect(res.body.data.counts.valid).toBe(12);
      expect(memberLoads).toBe(1);
      expect(elapsed).toBeLessThan(5000);
    });
  });
});
