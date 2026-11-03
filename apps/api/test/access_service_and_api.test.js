import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Person } from '../src/modules/people/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import * as accessService from '../src/modules/access/service.js';

describe('Phase 1b: Access Request Backend Service & Authorization', () => {
  let adminUser, headUser, leadUser, existingUser;
  let testDept, testProfile1, testProfile2;

  beforeAll(async () => {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Clean test artifacts
    await AccessRequest.deleteMany({ email: /@access-test\.com$/ });
    await Person.deleteMany({ email: /@access-test\.com$/ });
    await Profile.deleteMany({ code: { $in: ['brand_alpha', 'brand_beta'] } });
    await Department.deleteMany({ code: 'dept_content' });
    await ActivityEvent.deleteMany({ 'metadata.email': /@access-test\.com$/ });

    // Seed test reference data
    testProfile1 = await Profile.create({ name: 'Brand Alpha', code: 'brand_alpha', active: true });
    testProfile2 = await Profile.create({ name: 'Brand Beta', code: 'brand_beta', active: true });
    testDept = (await Department.findOne({ name: 'SEO & Content' })) ||
      (await Department.create({ name: 'SEO & Content', code: 'dept_content', isActive: true }));

    // Seed test users
    adminUser = await Person.create({
      name: 'Test Administrator',
      email: 'admin@access-test.com',
      role: 'admin',
      status: 'active',
      profileAccess: [testProfile1._id, testProfile2._id],
    });

    headUser = await Person.create({
      name: 'Test Creative Head',
      email: 'head@access-test.com',
      role: 'creative_head',
      status: 'active',
      profileAccess: [testProfile1._id, testProfile2._id],
    });

    leadUser = await Person.create({
      name: 'Test SM Manager',
      email: 'lead@access-test.com',
      role: 'sm_manager',
      jobRole: 'Social Media Manager',
      status: 'active',
      profileAccess: [testProfile1._id],
    });

    existingUser = await Person.create({
      name: 'Existing Member',
      email: 'existing@access-test.com',
      role: 'team_member',
      status: 'active',
    });
  });

  afterAll(async () => {
    await AccessRequest.deleteMany({ email: /@access-test\.com$/ });
    await Person.deleteMany({ email: /@access-test\.com$/ });
    await Profile.deleteMany({ code: { $in: ['brand_alpha', 'brand_beta'] } });
    await Department.deleteMany({ code: 'dept_content' });
    await ActivityEvent.deleteMany({ 'metadata.email': /@access-test\.com$/ });
  });

  it('rejects public access request with privileged requestedRole (server-side guard)', async () => {
    await expect(
      accessService.submitAccessRequest({
        name: 'Attacker Admin',
        email: 'attacker@access-test.com',
        phone: '+1 555 000 1111',
        department: 'SEO & Content',
        jobRole: 'Writer',
        requestedRole: 'admin',
        requestedProfileCodes: ['brand_alpha'],
        reason: 'Attempting to self-request admin privileges',
      })
    ).rejects.toThrow('Only Team Member or SM Manager can be requested');

    await expect(
      accessService.submitAccessRequest({
        name: 'Attacker Head',
        email: 'attacker2@access-test.com',
        phone: '+1 555 000 1112',
        department: 'SEO & Content',
        jobRole: 'Writer',
        requestedRole: 'creative_head',
        requestedProfileCodes: ['brand_alpha'],
        reason: 'Attempting to self-request creative head privileges',
      })
    ).rejects.toThrow('Only Team Member or SM Manager can be requested');
  });

  it('rejects duplicate submission if an account already exists for that email', async () => {
    await expect(
      accessService.submitAccessRequest({
        name: 'Existing Member Copy',
        email: 'existing@access-test.com',
        phone: '+1 555 000 2222',
        department: 'SEO & Content',
        jobRole: 'Writer',
        requestedRole: 'team_member',
        requestedProfileCodes: ['brand_alpha'],
        reason: 'Applying with already registered email',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'USER_EXISTS',
    });
  });

  it('submits a valid public request and blocks duplicate pending submissions', async () => {
    const candidateEmail = 'candidate1@access-test.com';

    // First submission succeeds
    const req = await accessService.submitAccessRequest({
      name: 'Candidate One',
      email: candidateEmail,
      phone: '+1 555 333 4444',
      department: 'SEO & Content',
      jobRole: 'Writer',
      requestedRole: 'team_member',
      requestedProfileCodes: ['brand_alpha', 'brand_beta'],
      reason: 'I will write weekly SEO blog posts and campaign copy.',
    });

    expect(req).toBeDefined();
    expect(req.status).toBe('pending');
    expect(req.departmentId?.toString()).toBe(testDept._id.toString());

    // Second submission with same email is rejected with 409 duplicate message
    await expect(
      accessService.submitAccessRequest({
        name: 'Candidate One Duplicate',
        email: candidateEmail,
        phone: '+1 555 333 4444',
        department: 'SEO & Content',
        jobRole: 'Writer',
        requestedRole: 'team_member',
        requestedProfileCodes: ['brand_alpha'],
        reason: 'Submitting duplicate access application',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_PENDING_REQUEST',
    });
  });

  it('filters access requests by status and department', async () => {
    const allReqs = await accessService.listAccessRequests({ status: 'pending' });
    expect(allReqs.length).toBeGreaterThan(0);

    const deptReqs = await accessService.listAccessRequests({ department: 'SEO & Content' });
    expect(deptReqs.length).toBeGreaterThan(0);
  });

  it('enforces that only admin can approve; creative_head receives 403', async () => {
    const candidateReq = await AccessRequest.findOne({ email: 'candidate1@access-test.com' });
    expect(candidateReq).toBeDefined();

    // Creative Head attempts approval -> 403 Forbidden
    await expect(
      accessService.approveAccessRequest(
        candidateReq._id,
        { assignedRole: 'team_member', weeklyCapacityHours: 40 },
        headUser
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('enforces that non-admin cannot grant privileged roles (admin, creative_head, executive)', async () => {
    const candidateReq = await AccessRequest.findOne({ email: 'candidate1@access-test.com' });

    // Non-admin lead user attempts granting admin -> 403 Forbidden
    await expect(
      accessService.approveAccessRequest(
        candidateReq._id,
        { assignedRole: 'admin', weeklyCapacityHours: 40 },
        leadUser
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('approves access request as admin: creates Person, sets 48h invite token, writes ActivityEvent', async () => {
    const candidateReq = await AccessRequest.findOne({ email: 'candidate1@access-test.com' });
    expect(candidateReq).toBeDefined();

    const approvalResult = await accessService.approveAccessRequest(
      candidateReq._id,
      {
        assignedRole: 'team_member',
        jobRole: 'Writer',
        departmentId: testDept._id.toString(),
        profileAccess: [testProfile1._id.toString()],
        reportsToIds: [leadUser._id.toString()],
        weeklyCapacityHours: 35,
      },
      adminUser
    );

    expect(approvalResult.inviteSent).toBe(true);
    expect(approvalResult.inviteToken).toBeDefined();
    expect(approvalResult.inviteToken.length).toBe(64); // 32 bytes hex = 64 characters

    // Verify Person created
    const createdPerson = await Person.findOne({ email: 'candidate1@access-test.com' }).select(
      '+resetPasswordTokenHash +resetPasswordExpiresAt'
    );
    expect(createdPerson).toBeDefined();
    expect(createdPerson.role).toBe('team_member');
    expect(createdPerson.jobRole).toBe('Writer');
    expect(createdPerson.departmentId?.toString()).toBe(testDept._id.toString());
    expect(createdPerson.reportsToIds[0]?.toString()).toBe(leadUser._id.toString());
    expect(createdPerson.weeklyCapacityHours).toBe(35);
    expect(createdPerson.mustSetPassword).toBe(true);
    expect(createdPerson.resetPasswordTokenHash).toBeDefined();
    expect(createdPerson.resetPasswordExpiresAt).toBeDefined();

    // Verify AccessRequest status updated
    const updatedReq = await AccessRequest.findById(candidateReq._id).select('+inviteTokenHash');
    expect(updatedReq.status).toBe('approved');
    expect(updatedReq.reviewedBy?.toString()).toBe(adminUser._id.toString());
    expect(updatedReq.inviteTokenHash).toBeDefined();
    expect(updatedReq.inviteExpiresAt).toBeDefined();

    // Verify ActivityEvent recorded
    const event = await ActivityEvent.findOne({
      entityId: candidateReq._id,
      action: 'access_request.approved',
    });
    expect(event).toBeDefined();
    expect(event.toStatus).toBe('approved');
  });

  it('rejects access request as admin with reason and records ActivityEvent', async () => {
    // Create new candidate request
    const rejectCandidate = await accessService.submitAccessRequest({
      name: 'Candidate To Reject',
      email: 'candidate.reject@access-test.com',
      phone: '+1 555 999 0001',
      department: 'SEO & Content',
      jobRole: 'Writer',
      requestedRole: 'team_member',
      requestedProfileCodes: ['brand_alpha'],
      reason: 'Incomplete application test',
    });

    // Marketing Head cannot reject
    await expect(
      accessService.rejectAccessRequest(rejectCandidate._id, 'Missing portfolio', headUser)
    ).rejects.toMatchObject({ statusCode: 403 });

    // Admin rejects with reason
    const rejectedReq = await accessService.rejectAccessRequest(
      rejectCandidate._id,
      'Missing portfolio and writing samples',
      adminUser
    );

    expect(rejectedReq.status).toBe('rejected');
    expect(rejectedReq.rejectReason).toBe('Missing portfolio and writing samples');

    const event = await ActivityEvent.findOne({
      entityId: rejectCandidate._id,
      action: 'access_request.rejected',
    });
    expect(event).toBeDefined();
    expect(event.metadata?.reason).toBe('Missing portfolio and writing samples');
  });

  it('requests info on access request as admin and updates status to info_needed', async () => {
    const infoCandidate = await accessService.submitAccessRequest({
      name: 'Candidate For Info',
      email: 'candidate.info@access-test.com',
      phone: '+1 555 999 0002',
      department: 'SEO & Content',
      jobRole: 'Writer',
      requestedRole: 'sm_manager',
      requestedProfileCodes: ['brand_alpha'],
      reason: 'Applying for SM Manager position',
    });

    // Creative Head cannot request info
    await expect(
      accessService.requestInfoForAccess(infoCandidate._id, 'Please clarify your experience', headUser)
    ).rejects.toMatchObject({ statusCode: 403 });

    // Admin requests info
    const infoReq = await accessService.requestInfoForAccess(
      infoCandidate._id,
      'Please upload your portfolio link and past team leadership experience.',
      adminUser
    );

    expect(infoReq.status).toBe('info_needed');
    expect(infoReq.infoQuestion).toBe(
      'Please upload your portfolio link and past team leadership experience.'
    );

    const event = await ActivityEvent.findOne({
      entityId: infoCandidate._id,
      action: 'access_request.info_requested',
    });
    expect(event).toBeDefined();
    expect(event.toStatus).toBe('info_needed');
  });
});
