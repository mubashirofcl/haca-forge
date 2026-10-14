import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { CalendarEntry } from '../src/modules/calendar/model.js';
import { ContentItem } from '../src/modules/content/model.js';
import { User } from '../src/modules/users/model.js';
import { Department } from '../src/modules/departments/model.js';
import { seedPipelineTemplates } from '../src/modules/pipelines/service.js';

let adminCookie = '';
let leadCookie = '';
let smManagerCookie = '';
let staffCookie = '';

let testSmDeptId = '';
let testCalendarEntryId = '';
let testContentItemId = '';

beforeAll(async () => {
  await connectDB();
  await seedPipelineTemplates();

  const login = async (email, password = 'Password123!') => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'];
  };

  // Find sm_manager user
  const smUser = await User.findOne({ role: 'sm_manager' });

  [adminCookie, leadCookie, staffCookie] = await Promise.all([
    login('admin@marketingportal.com', 'Admin1212'),
    login('marcus.lead@marketingportal.com'),
    login('jessica.sales@marketingportal.com'),
  ]);

  if (smUser) {
    smManagerCookie = await login(smUser.email);
  } else {
    smManagerCookie = leadCookie;
  }

  const smDept = await Department.findOne({
    $or: [{ type: 'social_media' }, { code: 'SM' }, { name: /social/i }],
  });
  testSmDeptId = smDept?._id.toString();
}, 30000);

afterAll(async () => {
  await CalendarEntry.deleteMany({ theme: { $regex: /Phase 5 Test/i } });
  await ContentItem.deleteMany({ title: { $regex: /Phase 5 Test/i } });
  await disconnectDB();
}, 30000);

describe('Phase 5: Content Calendar, Bulk Import, Capacity & Publishing', () => {
  // ----------------------------------------------------
  // 1. Calendar CRUD & Clash Detection
  // ----------------------------------------------------
  it('creates calendar entry and flags platform clashes when exceeding threshold', async () => {
    const targetDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

    // Create 4 entries on the same platform and date
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/calendar')
        .set('Cookie', smManagerCookie)
        .send({
          date: targetDate,
          platform: 'instagram',
          format: 'static_post',
          theme: `Phase 5 Test - Deliverable #${i}`,
          contentPillar: 'Product',
          captionBrief: `Brief for item #${i}`,
        });

      expect(res.status).toBe(201);
      if (i === 1) {
        testCalendarEntryId = res.body.data._id;
      }
    }

    // List entries and verify clash detection
    const listRes = await request(app)
      .get(`/api/calendar?from=${targetDate}&to=${targetDate}&platform=instagram&maxPostsPerPlatform=3`)
      .set('Cookie', smManagerCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(4);
    // 4 posts > threshold of 3 -> hasClash must be true
    expect(listRes.body.data[0].hasClash).toBe(true);
    expect(listRes.body.data[0].dayDeliverableCount).toBe(4);
  });

  // ----------------------------------------------------
  // 2. Approval of Calendar Entries
  // ----------------------------------------------------
  it('approves calendar entries in batch', async () => {
    const res = await request(app)
      .post('/api/calendar/approve')
      .set('Cookie', leadCookie)
      .send({ ids: [testCalendarEntryId] });

    expect(res.status).toBe(200);
    expect(res.body.data.approvedCount).toBeGreaterThanOrEqual(1);

    const getRes = await request(app)
      .get(`/api/calendar?from=${new Date().toISOString().split('T')[0]}`)
      .set('Cookie', smManagerCookie);

    const approvedItem = getRes.body.data.find((e) => e._id === testCalendarEntryId);
    expect(approvedItem?.status).toBe('approved');
  });

  // ----------------------------------------------------
  // 3. Idempotent Content Pipeline Generation
  // ----------------------------------------------------
  it('generates ContentItem and full stage pipeline from approved calendar entries idempotently', async () => {
    const genRes = await request(app)
      .post('/api/calendar/generate-content')
      .set('Cookie', smManagerCookie)
      .send({ entryIds: [testCalendarEntryId] });

    expect(genRes.status).toBe(200);
    expect(genRes.body.data.count).toBe(1);
    const createdItem = genRes.body.data.created[0];
    expect(createdItem.contentId).toMatch(/^CNT-\d{4}-\d{4}$/);
    expect(createdItem.calendarEntryId).toBe(testCalendarEntryId);
    testContentItemId = createdItem._id;

    // Verify entry is now converted and linked
    const listRes = await request(app)
      .get('/api/calendar')
      .set('Cookie', smManagerCookie);
    const entry = listRes.body.data.find((e) => e._id === testCalendarEntryId);
    expect(entry.status).toBe('converted');
    expect(entry.linkedContentItemId?._id || entry.linkedContentItemId).toBe(createdItem._id);

    // Re-running the generation must be idempotent (0 new items)
    const secondGenRes = await request(app)
      .post('/api/calendar/generate-content')
      .set('Cookie', smManagerCookie)
      .send({ entryIds: [testCalendarEntryId] });

    expect(secondGenRes.status).toBe(200);
    expect(secondGenRes.body.data.count).toBe(0);
  });

  // ----------------------------------------------------
  // 4. Team Capacity Math Factoring in Leave
  // ----------------------------------------------------
  it('computes team capacity comparison factoring in on-leave members', async () => {
    // Put one graphics worker on leave
    let graphicsUser = await User.findOne({
      $or: [{ teamId: 'graphics' }, { team: 'graphics' }],
      status: 'active',
    });
    if (!graphicsUser) {
      graphicsUser = await User.create({
        name: 'Test Graphics Worker',
        email: 'test.graphics.phase5@marketingportal.com',
        role: 'worker',
        teamId: 'graphics',
        status: 'active',
        capacity: 40,
        attendance: 'on_leave',
      });
    } else {
      graphicsUser.attendance = 'on_leave';
      await graphicsUser.save();
    }

    const res = await request(app)
      .get('/api/calendar/capacity')
      .set('Cookie', leadCookie);

    expect(res.status).toBe(200);
    const teams = res.body.data.teams;
    expect(teams.length).toBe(4);

    const graphicsTeam = teams.find((t) => t.team === 'graphics');
    expect(graphicsTeam).toBeDefined();
    expect(graphicsTeam.onLeaveMembers).toBeGreaterThanOrEqual(1);
    expect(graphicsTeam.availableCapacity).toBeLessThan(graphicsTeam.totalCapacity);

    // Reset graphics worker attendance
    if (graphicsUser) {
      graphicsUser.attendance = 'present';
      await graphicsUser.save();
    }
  });

  // ----------------------------------------------------
  // 5. Excel Template Download & Bulk Import Validation
  // ----------------------------------------------------
  it('downloads valid Excel template file', async () => {
    const res = await request(app)
      .get('/api/calendar/template')
      .set('Cookie', smManagerCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.body).toBeDefined();
  });

  it('previews bulk import and identifies row-level errors without database writes', async () => {
    // Create an in-memory workbook with 3 rows: 2 valid, 1 with invalid format
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Calendar');
    sheet.columns = [
      { header: 'Date', key: 'date' },
      { header: 'Platform', key: 'platform' },
      { header: 'Format', key: 'format' },
      { header: 'Theme', key: 'theme' },
      { header: 'Content Pillar', key: 'pillar' },
      { header: 'Caption Brief', key: 'brief' },
    ];

    const futureDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

    // Row 2: Valid
    sheet.addRow({
      date: futureDate,
      platform: 'linkedin',
      format: 'carousel',
      theme: 'Phase 5 Test - Valid Carousel',
      pillar: 'Thought Leadership',
      brief: 'Carousel slides on marketing trends',
    });

    // Row 3: Valid
    sheet.addRow({
      date: futureDate,
      platform: 'youtube',
      format: 'reel',
      theme: 'Phase 5 Test - Valid Reel',
      pillar: 'Product',
      brief: 'Reel showing new feature',
    });

    // Row 4: Invalid format
    sheet.addRow({
      date: futureDate,
      platform: 'instagram',
      format: 'invalid_unsupported_format',
      theme: 'Phase 5 Test - Broken Format Row',
      pillar: 'Culture',
      brief: 'Bad format',
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const previewRes = await request(app)
      .post('/api/calendar/import/preview')
      .set('Cookie', smManagerCookie)
      .attach('file', Buffer.from(buffer), 'test-import.xlsx');

    expect(previewRes.status).toBe(200);
    const data = previewRes.body.data;
    expect(data.validCount).toBe(2);
    expect(data.errorCount).toBe(1);
    expect(data.errors[0].field).toBe('format');

    // Commit only valid rows
    const commitRes = await request(app)
      .post('/api/calendar/import/commit')
      .set('Cookie', smManagerCookie)
      .send({
        entries: data.preview,
        batchId: data.batchId,
      });

    expect(commitRes.status).toBe(200);
    expect(commitRes.body.data.importedCount).toBe(2);
  });

  // ----------------------------------------------------
  // 6. Publishing Workflow & Permissions
  // ----------------------------------------------------
  it('blocks publishing from unauthorized roles and invalid states', async () => {
    // 1. Regular staff attempt is rejected with 403 Forbidden
    const unauthRes = await request(app)
      .patch(`/api/content/${testContentItemId}/publish`)
      .set('Cookie', staffCookie)
      .send({
        publishedUrl: 'https://instagram.com/p/test123',
      });

    expect(unauthRes.status).toBe(403);

    // 2. Cannot publish from 'planned' state (must be 'approved' or 'scheduled')
    const stateRes = await request(app)
      .patch(`/api/content/${testContentItemId}/publish`)
      .set('Cookie', smManagerCookie)
      .send({
        publishedUrl: 'https://instagram.com/p/test123',
      });

    expect(stateRes.status).toBe(400);
    expect(stateRes.body.error.code).toBe('INVALID_PUBLISH_STATUS');

    // 3. Mark ContentItem approved, then publish
    await ContentItem.findByIdAndUpdate(testContentItemId, { $set: { status: 'approved' } });

    const publishRes = await request(app)
      .patch(`/api/content/${testContentItemId}/publish`)
      .set('Cookie', smManagerCookie)
      .send({
        publishedUrl: 'https://instagram.com/p/test123',
        publishedAt: new Date().toISOString(),
        metrics: {
          reach: 12500,
          views: 9800,
          likes: 640,
        },
      });

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe('published');
    expect(publishRes.body.data.publishedUrl).toBe('https://instagram.com/p/test123');
    expect(publishRes.body.data.metrics.reach).toBe(12500);
  });
});
