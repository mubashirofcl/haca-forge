import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { getNextSequenceId } from '../src/modules/requests/counter.model.js';
import { Request } from '../src/modules/requests/model.js';
import { RequestType } from '../src/modules/masterData/models.js';
import { User } from '../src/modules/users/model.js';

let adminCookie = '';
let leadCookie = '';
let salesLeadCookie = '';
let salesStaffCookie = '';
let adsLeadCookie = '';
let adsStaffCookie = '';

let createdSalesRequestId = '';
let testRequestType = null;
let targetSalesDept = 'Sales & Business Development';

beforeAll(async () => {
  await connectDB();

  const vic = await User.findOne({ email: 'victoria.sales@marketingportal.com' });
  if (vic?.department) {
    targetSalesDept = vic.department;
  }

  // 1. Log in all roles concurrently
  const login = async (email, password = 'Password123!') => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'];
  };

  [adminCookie, leadCookie, salesLeadCookie, salesStaffCookie, adsLeadCookie, adsStaffCookie] =
    await Promise.all([
      login('admin@marketingportal.com', 'Admin1212'),
      login('marcus.lead@marketingportal.com'),
      login('victoria.sales@marketingportal.com'),
      login('jessica.sales@marketingportal.com'),
      login('vikram.ads@marketingportal.com'),
      login('carlos.ads@marketingportal.com'),
    ]);

  // Find a seeded request type
  testRequestType = await RequestType.findOne({ departmentType: 'sales' });
}, 30000);

afterAll(async () => {
  // Clean up any requests created during tests
  await Request.deleteMany({ title: { $regex: /Test Request/i } });
  await disconnectDB();
}, 30000);

describe('Phase 3: Requests, Scoping & Triage Engine', () => {
  // ----------------------------------------------------
  // 1. Atomic ID Counter Concurrency Test
  // ----------------------------------------------------
  it('concurrently generates strictly unique, sequential IDs', async () => {
    const totalCalls = 15;
    const promises = Array.from({ length: totalCalls }, () => getNextSequenceId('CONCUR_TEST'));
    const generatedIds = await Promise.all(promises);

    expect(generatedIds.length).toBe(totalCalls);
    const uniqueIds = new Set(generatedIds);
    expect(uniqueIds.size).toBe(totalCalls);

    const year = new Date().getFullYear();
    for (const id of generatedIds) {
      expect(id).toMatch(new RegExp(`^CONCUR_TEST-${year}-\\d{4}$`));
    }
  });

  // ----------------------------------------------------
  // 2. Dynamic Payload Validation
  // ----------------------------------------------------
  it('validates dynamic fields schema when creating a request', async () => {
    // Missing required fields on non-draft request
    const invalidRes = await request(app)
      .post('/api/requests')
      .set('Cookie', salesStaffCookie)
      .send({
        title: 'Test Request: Missing Fields',
        sourceDepartment: targetSalesDept,
        requestType: testRequestType?.name || 'Sales Collateral & Product One-Pager',
        priority: 'medium',
        deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
        dynamicFields: {}, // Missing required fields
        isDraft: false,
      });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe('INVALID_DYNAMIC_FIELDS');
  });

  // ----------------------------------------------------
  // 3. Request Creation & Duplicate Detection
  // ----------------------------------------------------
  it('allows dept_staff to create a valid submitted request', async () => {
    const validRes = await request(app)
      .post('/api/requests')
      .set('Cookie', salesStaffCookie)
      .send({
        title: 'Test Request: Q4 Enterprise Pitch Deck Collateral',
        sourceDepartment: targetSalesDept,
        requestType: testRequestType?.name || 'Sales Collateral & Product One-Pager',
        priority: 'high',
        deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
        dynamicFields: {
          productServiceLine: 'Enterprise Suite',
          clientIndustry: 'Fintech & Banking',
          coreValueProps: '1. 40% cost reduction\n2. Real-time sync\n3. 24/7 dedicated support',
          collateralFormat: 'Pitch Deck Presentation (10-15 slides)',
        },
        attachments: [
          {
            url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf',
            name: 'client-brief.pdf',
            size: 102400,
            type: 'application/pdf',
          },
        ],
        isDraft: false,
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.request).toBeDefined();
    expect(validRes.body.request.status).toBe('submitted');
    expect(validRes.body.request.requestId).toMatch(/^MKT-\d{4}-\d{4}$/);

    createdSalesRequestId = validRes.body.request._id;
  });

  it('detects duplicate request warning on similar title or deadline', async () => {
    const dupRes = await request(app)
      .post('/api/requests')
      .set('Cookie', salesStaffCookie)
      .send({
        title: 'Test Request: Q4 Enterprise Pitch Deck Collateral (Duplicate)',
        sourceDepartment: targetSalesDept,
        requestType: testRequestType?.name || 'Sales Collateral & Product One-Pager',
        priority: 'medium',
        deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
        dynamicFields: {
          productServiceLine: 'Enterprise Suite',
          clientIndustry: 'Fintech & Banking',
          coreValueProps: 'Duplicate props',
          collateralFormat: 'Pitch Deck Presentation (10-15 slides)',
        },
        isDraft: false,
      });

    expect(dupRes.status).toBe(201);
    expect(dupRes.body.duplicateWarning).toBeInstanceOf(Array);
    expect(dupRes.body.duplicateWarning.length).toBeGreaterThanOrEqual(1);

    // Clean up duplicate
    await Request.findByIdAndDelete(dupRes.body.request._id);
  });

  // ----------------------------------------------------
  // 4. Role-based Scoping Tests
  // ----------------------------------------------------
  it('enforces department scoping: sales lead can see sales request', async () => {
    const res = await request(app)
      .get('/api/requests')
      .set('Cookie', salesLeadCookie);

    expect(res.status).toBe(200);
    const found = res.body.data.some((r) => r._id === createdSalesRequestId);
    expect(found).toBe(true);
  });

  it('enforces department scoping: ads lead CANNOT see sales request', async () => {
    const res = await request(app)
      .get('/api/requests')
      .set('Cookie', adsLeadCookie);

    expect(res.status).toBe(200);
    const found = res.body.data.some((r) => r._id === createdSalesRequestId);
    expect(found).toBe(false);
  });

  it('enforces requester scoping: ads staff CANNOT see sales request', async () => {
    const res = await request(app)
      .get('/api/requests')
      .set('Cookie', adsStaffCookie);

    expect(res.status).toBe(200);
    const found = res.body.data.some((r) => r._id === createdSalesRequestId);
    expect(found).toBe(false);
  });

  it('marketing lead and admin CAN see all requests across all departments', async () => {
    const leadRes = await request(app)
      .get('/api/requests')
      .set('Cookie', leadCookie);

    expect(leadRes.status).toBe(200);
    expect(leadRes.body.data.some((r) => r._id === createdSalesRequestId)).toBe(true);

    const adminRes = await request(app)
      .get('/api/requests')
      .set('Cookie', adminCookie);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.some((r) => r._id === createdSalesRequestId)).toBe(true);
  });

  // ----------------------------------------------------
  // 5. Marketing Lead Triage Workflows
  // ----------------------------------------------------
  it('allows Marketing Lead to ask for info (needs_info transition)', async () => {
    const res = await request(app)
      .post(`/api/requests/${createdSalesRequestId}/triage/ask-info`)
      .set('Cookie', leadCookie)
      .send({ message: 'Please clarify client branding guidelines.' });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('needs_info');
    expect(res.body.request.triage.reason).toContain('branding guidelines');
  });

  it('allows requester to edit and resubmit request after needs_info', async () => {
    const res = await request(app)
      .patch(`/api/requests/${createdSalesRequestId}`)
      .set('Cookie', salesStaffCookie)
      .send({
        title: 'Test Request: Q4 Enterprise Pitch Deck Collateral (Updated Guidelines)',
        resubmit: true,
        resubmitReason: 'Added brand palette notes and fonts.',
      });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('submitted');
  });

  it('allows Marketing Lead to accept request with priority and deadline adjustment', async () => {
    const newDeadline = new Date(Date.now() + 86400000 * 10).toISOString();
    const res = await request(app)
      .post(`/api/requests/${createdSalesRequestId}/triage/accept`)
      .set('Cookie', leadCookie)
      .send({
        priority: 'urgent',
        deadline: newDeadline,
        comment: 'Approved for Q4 priority production.',
      });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('accepted');
    expect(res.body.request.priority).toBe('urgent');
  });

  it('converts accepted request via conversion stub (Phase 4 integration)', async () => {
    const res = await request(app)
      .post(`/api/requests/${createdSalesRequestId}/triage/convert`)
      .set('Cookie', leadCookie)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('converted');
  });

  // ----------------------------------------------------
  // 6. Comments & Audit-Grade History Timeline
  // ----------------------------------------------------
  it('allows adding comments and returns complete status history timeline', async () => {
    // Add comment
    const commentRes = await request(app)
      .post(`/api/requests/${createdSalesRequestId}/comments`)
      .set('Cookie', salesStaffCookie)
      .send({ text: 'Thank you Marcus, let us know when first draft is ready!' });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.request.comments.length).toBeGreaterThanOrEqual(1);

    // Fetch detail
    const detailRes = await request(app)
      .get(`/api/requests/${createdSalesRequestId}`)
      .set('Cookie', salesLeadCookie);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.request.history).toBeInstanceOf(Array);
    expect(detailRes.body.request.history.length).toBeGreaterThanOrEqual(3);

    // Verify history includes transitions: submitted -> needs_info -> submitted -> accepted -> converted
    const statuses = detailRes.body.request.history.map((h) => h.toStatus);
    expect(statuses).toContain('submitted');
    expect(statuses).toContain('needs_info');
    expect(statuses).toContain('accepted');
    expect(statuses).toContain('converted');
  });
});
