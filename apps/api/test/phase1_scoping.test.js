import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { resolveScope } from '../src/lib/scope.js';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import * as peopleService from '../src/modules/people/service.js';

describe('Phase 1: Profiles, People & Access Scoping Tests', () => {
  let profile1Id, profile2Id;
  let designDeptId;
  let adminUser, headUser, leadUser, member1User, member2User;

  beforeAll(async () => {
    // Connect to test MongoDB database if not connected
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal_test';
      await mongoose.connect(mongoUri);
    }

    // Clean up test collections
    await Profile.deleteMany({ code: { $in: ['test_haca', 'test_mideast'] } });
    await Department.deleteMany({ code: 'test_design' });
    await Person.deleteMany({ email: { $regex: /@phase1test\.com$/ } });

    // 1. Create 2 test profiles
    const prof1 = await Profile.create({ name: 'Test HACA', code: 'test_haca', active: true });
    const prof2 = await Profile.create({ name: 'Test Mideast', code: 'test_mideast', active: true });
    profile1Id = prof1._id.toString();
    profile2Id = prof2._id.toString();

    // 2. Create test department
    const dept = await Department.create({ name: 'Test Design', code: 'test_design', isActive: true });
    designDeptId = dept._id.toString();

    // 3. Create 4 test users (one per role)
    adminUser = await Person.create({
      name: 'System Admin',
      email: 'admin@phase1test.com',
      role: 'admin',
      status: 'active',
      profileAccess: [profile1Id, profile2Id],
    });

    headUser = await Person.create({
      name: 'Marketing Head',
      email: 'head@phase1test.com',
      role: 'marketing_head',
      status: 'active',
      profileAccess: [profile1Id, profile2Id],
    });

    leadUser = await Person.create({
      name: 'Design Team Lead',
      email: 'lead@phase1test.com',
      role: 'team_lead',
      jobRole: 'Design Lead (TL)',
      departmentId: designDeptId,
      status: 'active',
      profileAccess: [profile1Id], // Access to profile 1 only
    });

    member1User = await Person.create({
      name: 'Designer Direct Report',
      email: 'member1@phase1test.com',
      role: 'team_member',
      jobRole: 'Designer',
      departmentId: designDeptId,
      reportsToIds: [leadUser._id],
      status: 'active',
      profileAccess: [profile1Id],
    });

    member2User = await Person.create({
      name: 'Other Team Member',
      email: 'member2@phase1test.com',
      role: 'team_member',
      jobRole: 'Video Editor',
      status: 'active',
      profileAccess: [profile2Id], // Access to profile 2 only
    });
  });

  afterAll(async () => {
    await Profile.deleteMany({ code: { $in: ['test_haca', 'test_mideast'] } });
    await Department.deleteMany({ code: 'test_design' });
    await Person.deleteMany({ email: { $regex: /@phase1test\.com$/ } });
  });

  describe('1. resolveScope across 4 roles and profile boundaries', () => {
    it('admin: returns all profiles and all people (full access)', async () => {
      const scope = await resolveScope(adminUser);
      expect(scope.isAllowed).toBe(true);
      expect(scope.scopeType).toBe('all');
      expect(scope.allowedPersonIds).toBeNull();
      expect(scope.canAccessPerson(member1User._id)).toBe(true);
      expect(scope.canAccessProfile(profile1Id)).toBe(true);
      expect(scope.canAccessProfile(profile2Id)).toBe(true);
    });

    it('marketing_head: returns assigned profiles and all people in scope', async () => {
      const scope = await resolveScope(headUser);
      expect(scope.isAllowed).toBe(true);
      expect(scope.scopeType).toBe('all');
      expect(scope.allowedPersonIds).toBeNull();
      expect(scope.canAccessPerson(member1User._id)).toBe(true);
      expect(scope.canAccessProfile(profile1Id)).toBe(true);
      expect(scope.canAccessProfile(profile2Id)).toBe(true);
    });

    it('team_lead: returns assigned profiles and own team only (direct reports + same department + self)', async () => {
      const scope = await resolveScope(leadUser);
      expect(scope.isAllowed).toBe(true);
      expect(scope.scopeType).toBe('team');
      expect(scope.allowedPersonIds).toContain(leadUser._id.toString());
      expect(scope.allowedPersonIds).toContain(member1User._id.toString());
      expect(scope.allowedPersonIds).not.toContain(member2User._id.toString());

      // Profile access: only profile 1
      expect(scope.canAccessProfile(profile1Id)).toBe(true);
      expect(scope.canAccessProfile(profile2Id)).toBe(false);
    });

    it('team_member: returns assigned profiles and self only', async () => {
      const scope = await resolveScope(member1User);
      expect(scope.isAllowed).toBe(true);
      expect(scope.scopeType).toBe('self');
      expect(scope.allowedPersonIds).toEqual([member1User._id.toString()]);
      expect(scope.canAccessPerson(leadUser._id)).toBe(false);
      expect(scope.canAccessPerson(member2User._id)).toBe(false);
    });

    it('denies access when user requests a profileId outside their profileAccess', async () => {
      // leadUser only has access to profile1Id, requests profile2Id
      const scope = await resolveScope(leadUser, { profileId: profile2Id });
      expect(scope.isAllowed).toBe(false);
      expect(scope.allowedProfileIds).toEqual([]);

      const query = scope.buildQuery();
      expect(query).toEqual({ _id: { $exists: false } });
    });

    it('denies access when team_lead requests an ownerId outside their team', async () => {
      const scope = await resolveScope(leadUser, { ownerId: member2User._id.toString() });
      expect(scope.isAllowed).toBe(false);
      expect(scope.allowedPersonIds).toEqual([]);
    });
  });

  describe('2. User & Person Management Permission Rules', () => {
    it('Admin can create users with any role', async () => {
      const newPerson = await peopleService.createPerson(
        {
          name: 'New Head Candidate',
          email: 'newhead@phase1test.com',
          role: 'marketing_head',
        },
        adminUser
      );
      expect(newPerson.role).toBe('marketing_head');
      expect(newPerson.status).toBe('active');
    });

    it('Marketing Head CANNOT create users', async () => {
      await expect(
        peopleService.createPerson(
          {
            name: 'Unauthorized User',
            email: 'unauth@phase1test.com',
            role: 'team_member',
          },
          headUser
        )
      ).rejects.toThrow(/only Administrator can create users/);
    });

    it('Marketing Head CANNOT suspend users', async () => {
      await expect(peopleService.suspendPerson(member1User._id, headUser)).rejects.toThrow(
        /only Administrator can suspend users/
      );
    });

    it('Admin can suspend users', async () => {
      const suspended = await peopleService.suspendPerson(member2User._id, adminUser);
      expect(suspended.status).toBe('suspended');

      // Reactivate
      const active = await peopleService.reactivatePerson(member2User._id, adminUser);
      expect(active.status).toBe('active');
    });

    it('Marketing Head CANNOT edit admin or marketing_head accounts', async () => {
      await expect(
        peopleService.updatePerson(adminUser._id, { weeklyCapacityHours: 20 }, headUser)
      ).rejects.toThrow(/Marketing Head cannot modify admin or marketing_head accounts/);

      await expect(
        peopleService.updatePerson(headUser._id, { weeklyCapacityHours: 20 }, headUser)
      ).rejects.toThrow(/Marketing Head cannot modify admin or marketing_head accounts/);
    });

    it('Marketing Head CANNOT change user roles or status or emails', async () => {
      await expect(
        peopleService.updatePerson(member1User._id, { role: 'team_lead' }, headUser)
      ).rejects.toThrow(/Marketing Head cannot change user roles/);

      await expect(
        peopleService.updatePerson(member1User._id, { status: 'suspended' }, headUser)
      ).rejects.toThrow(/Marketing Head cannot change user status/);

      await expect(
        peopleService.updatePerson(member1User._id, { email: 'newemail@phase1test.com' }, headUser)
      ).rejects.toThrow(/Marketing Head can only edit operational fields/);
    });

    it('Marketing Head CAN edit operational fields of team_lead and team_member', async () => {
      const updated = await peopleService.updatePerson(
        member1User._id,
        {
          jobRole: 'UI Designer',
          weeklyCapacityHours: 35,
        },
        headUser
      );
      expect(updated.jobRole).toBe('UI Designer');
      expect(updated.weeklyCapacityHours).toBe(35);
    });

    it('Admin is strictly excluded from candidate pools for assignment', async () => {
      const candidates = await peopleService.getAssignmentCandidates({});
      const adminCandidate = candidates.find((c) => c.role === 'admin');
      expect(adminCandidate).toBeUndefined();
    });
  });
});
