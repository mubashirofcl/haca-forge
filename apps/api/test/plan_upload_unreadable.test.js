// Plan upload: a file ExcelJS can't parse returns 400 with a plain message (was 500), and the
// original error is logged. Disposable test DB.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import { PLAN_TEMPLATE_HEADERS } from '@mmp/shared';
import JSZip from 'jszip'; // already installed with exceljs; no new dependency
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { logger } from '../src/lib/logger.js';
import { Person } from '../src/modules/people/model.js';
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';

const EMAIL = /@upload-unreadable-test\.com$/;
const MESSAGE = "This file couldn't be read. Download a fresh template and copy your rows into it.";

/** A real plan file whose sheet comment links are absolute paths, as openpyxl writes them. */
async function absoluteCommentLinksXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Calendar Plan');
  ws.addRow(['Posting Date', 'Topic', 'Type']);
  ws.addRow(['04/12/2031', 'Unreadable test', 'Reel']);
  ws.getCell('A1').note = 'A header comment';
  const zip = await JSZip.loadAsync(Buffer.from(await wb.xlsx.writeBuffer()));
  const relPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  const rels = await zip.file(relPath).async('string');
  expect(rels).toContain('Target="../');
  zip.file(relPath, rels.replace(/Target="\.\.\//g, 'Target="/xl/'));
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** Starts like a zip, but the rest is junk. */
const brokenZip = () => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('not really a workbook')]);

describe('Plan upload: unreadable files', () => {
  let token;

  const cleanup = async () => {
    const ids = (await Person.find({ email: EMAIL }).select('_id').lean()).map((p) => p._id);
    await CalendarPlan.deleteMany({ createdById: { $in: ids } });
    await Person.deleteMany({ email: EMAIL });
  };

  beforeAll(async () => {
    await connectDB();
    await cleanup();
    const sm = await Person.create({ name: 'Unreadable SM', email: 'sm@upload-unreadable-test.com', role: 'sm_manager', status: 'active' });
    token = jwt.sign({ userId: sm._id.toString(), email: sm.email, role: sm.role }, env.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(cleanup);
  afterEach(() => vi.restoreAllMocks());

  const upload = (file, name = 'plan.xlsx') =>
    request(app)
      .post('/api/calendar-plans/grid/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('calendar', 'other')
      .field('month', '2031-12')
      .field('dryRun', 'true')
      .attach('file', file, name);

  it('a file with absolute comment links (openpyxl) returns 400, and the original error is logged', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const res = await upload(await absoluteCommentLinksXlsx());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'UNREADABLE_FILE', message: MESSAGE });
    const call = warn.mock.calls.find(([, msg]) => /could not be parsed/.test(String(msg)));
    expect(call).toBeTruthy();
    expect(call[0].err.message).toMatch(/reading 'comments'/);
    expect(JSON.stringify(res.body)).not.toMatch(/comments|undefined/);
  });

  it('a broken .xlsx returns 400 with the same message', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const res = await upload(brokenZip());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'UNREADABLE_FILE', message: MESSAGE });
    expect(warn.mock.calls.some(([o]) => o?.err instanceof Error)).toBe(true);
  });

  it('nothing is saved for an unreadable file', async () => {
    const before = await CalendarPlan.countDocuments({});
    await request(app)
      .post('/api/calendar-plans/grid/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('calendar', 'other')
      .field('month', '2031-12')
      .attach('file', brokenZip(), 'plan.xlsx')
      .expect(400);
    expect(await CalendarPlan.countDocuments({})).toBe(before);
  });

  it('the older preview endpoint also returns 400 instead of 500', async () => {
    const res = await request(app)
      .post('/api/calendar-plans/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', await absoluteCommentLinksXlsx(), 'plan.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'UNREADABLE_FILE', message: MESSAGE });
  });

  it('a normal template file still reads (dry run)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calendar Plan');
    ws.addRow(PLAN_TEMPLATE_HEADERS);
    ws.addRow(['04/12/2031', 'Unreadable test reel', 'Reel']);
    ws.getCell('A1').note = 'A normal header comment';
    const res = await upload(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(res.status).toBe(200);
    expect(res.body.data.upload).toEqual({ layout: 'grid', rowCount: 1 });
  });
});
