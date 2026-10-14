import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Team } from '../src/modules/teams/model.js';
import { ContentFormat, RequestType } from '../src/modules/masterData/models.js';

let adminCookie = '';
let workerCookie = '';

beforeAll(async () => {
  await connectDB();

  // Log in as Admin
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@marketingportal.com', password: 'Admin1212' });

  expect(adminRes.status).toBe(200);
  adminCookie = adminRes.headers['set-cookie'];

  // Clean up any previous test department run
  await Department.deleteMany({ name: 'Growth & Special Projects' });

  // Log in as Worker
  const workerRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'chloe.b@marketingportal.com', password: 'Password123!' });

  expect(workerRes.status).toBe(200);
  workerCookie = workerRes.headers['set-cookie'];
}, 30000);

afterAll(async () => {
  await Department.deleteMany({ name: 'Growth & Special Projects' });
  await disconnectDB();
}, 30000);

describe('Phase 2: Departments & Teams API', () => {
  it('GET /api/departments returns seeded departments for authenticated users', async () => {
    const res = await request(app)
      .get('/api/departments')
      .set('Cookie', workerCookie);

    expect(res.status).toBe(200);
    expect(res.body.departments).toBeInstanceOf(Array);
    expect(res.body.departments.length).toBeGreaterThanOrEqual(4);
  });

  it('POST /api/departments allows admin with settings.manage to create a department', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Cookie', adminCookie)
      .send({
        name: 'Growth & Special Projects',
        type: 'other',
        description: 'Experimental marketing initiatives',
      });

    expect(res.status).toBe(201);
    expect(res.body.department.name).toBe('Growth & Special Projects');
  });

  it('POST /api/departments rejects non-admin users with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Cookie', workerCookie)
      .send({
        name: 'Unauthorized Dept',
        type: 'other',
      });

    expect(res.status).toBe(403);
  });

  it('GET /api/teams returns teams with member counts and weekly capacity rollups', async () => {
    const res = await request(app)
      .get('/api/teams')
      .set('Cookie', workerCookie);

    expect(res.status).toBe(200);
    expect(res.body.teams).toBeInstanceOf(Array);
    expect(res.body.teams.length).toBe(4);

    const contentTeam = res.body.teams.find((t) => t.name === 'content');
    expect(contentTeam).toBeDefined();
    expect(contentTeam.members.length).toBeGreaterThan(0);
    expect(contentTeam.totalWeeklyCapacity).toBeGreaterThan(0);
  });
});

describe('Phase 2: Master Data API', () => {
  it('GET /api/master-data/platforms returns social and media platforms', async () => {
    const res = await request(app)
      .get('/api/master-data/platforms')
      .set('Cookie', workerCookie);

    expect(res.status).toBe(200);
    expect(res.body.platforms).toBeInstanceOf(Array);
    expect(res.body.platforms.some((p) => p.slug === 'youtube')).toBe(true);
  });

  it('GET /api/master-data/content-formats returns formats with lead time days', async () => {
    const res = await request(app)
      .get('/api/master-data/content-formats')
      .set('Cookie', workerCookie);

    expect(res.status).toBe(200);
    expect(res.body.formats).toBeInstanceOf(Array);
    const reel = res.body.formats.find((f) => f.name.includes('Reel'));
    expect(reel).toBeDefined();
    expect(reel.leadTimeDays).toBe(7);
  });

  it('GET /api/master-data/request-types returns department dynamic schemas', async () => {
    const res = await request(app)
      .get('/api/master-data/request-types')
      .set('Cookie', workerCookie);

    expect(res.status).toBe(200);
    expect(res.body.requestTypes).toBeInstanceOf(Array);
    const social = res.body.requestTypes.find((r) => r.departmentType === 'social_media');
    expect(social).toBeDefined();
    expect(social.fieldSchema.length).toBeGreaterThan(0);
  });

  it('GET /api/master-data/settings returns system configuration', async () => {
    const res = await request(app)
      .get('/api/master-data/settings')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.settings.efficiencyWeights.onTime).toBe(0.4);
    expect(res.body.settings.requireReasonForHold).toBe(true);
  });
});

describe('Phase 2: Audit Log API', () => {
  it('GET /api/admin/audit-log returns paginated logs for user with audit.view', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log?page=1&limit=10')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.logs).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
  });

  it('GET /api/admin/audit-log denies worker without audit.view permission', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Cookie', workerCookie);

    expect(res.status).toBe(403);
  });
});
