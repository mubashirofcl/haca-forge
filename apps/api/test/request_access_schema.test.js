import { describe, it, expect } from 'vitest';
import {
  requestAccessSchema,
  accessRequestReviewSchema,
  REQUESTABLE_ROLES,
  DEPARTMENTS,
  JOB_ROLES,
  PROFILES,
} from '@mmp/shared';

describe('Shared Zod Schemas: Request Access & Review', () => {
  const validPayload = {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '+1 555 123 4567',
    department: DEPARTMENTS[0].name,
    jobRole: JOB_ROLES[0],
    requestedRole: 'team_member',
    requestedProfileCodes: [PROFILES[0].code],
    reason: 'I will create high-converting video and graphic campaigns for HACA.',
  };

  it('validates a valid public access request payload', () => {
    const result = requestAccessSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Jane Doe');
      expect(result.data.email).toBe('jane.doe@example.com');
      expect(result.data.requestedRole).toBe('team_member');
    }
  });

  it('requires all mandatory fields', () => {
    const emptyResult = requestAccessSchema.safeParse({});
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      const paths = emptyResult.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('name');
      expect(paths).toContain('email');
      expect(paths).toContain('phone');
      expect(paths).toContain('department');
      expect(paths).toContain('jobRole');
      expect(paths).toContain('requestedRole');
      expect(paths).toContain('requestedProfileCodes');
      expect(paths).toContain('reason');
    }
  });

  it('rejects an invalid email address', () => {
    const result = requestAccessSchema.safeParse({
      ...validPayload,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(emailIssue).toBeDefined();
    }
  });

  it('strictly limits requestedRole to team_member and team_lead only', () => {
    expect(REQUESTABLE_ROLES).toEqual(['team_member', 'team_lead']);

    // Allowed roles
    expect(requestAccessSchema.safeParse({ ...validPayload, requestedRole: 'team_member' }).success).toBe(true);
    expect(requestAccessSchema.safeParse({ ...validPayload, requestedRole: 'team_lead' }).success).toBe(true);

    // Privileged and retired roles are strictly rejected
    const adminAttempt = requestAccessSchema.safeParse({ ...validPayload, requestedRole: 'admin' });
    expect(adminAttempt.success).toBe(false);

    const headAttempt = requestAccessSchema.safeParse({ ...validPayload, requestedRole: 'marketing_head' });
    expect(headAttempt.success).toBe(false);

    const retiredAttempt = requestAccessSchema.safeParse({ ...validPayload, requestedRole: 'worker' });
    expect(retiredAttempt.success).toBe(false);
  });

  it('requires at least one brand in requestedProfileCodes', () => {
    const emptyBrandsResult = requestAccessSchema.safeParse({
      ...validPayload,
      requestedProfileCodes: [],
    });
    expect(emptyBrandsResult.success).toBe(false);
    if (!emptyBrandsResult.success) {
      const brandIssue = emptyBrandsResult.error.issues.find(
        (i) => i.path[0] === 'requestedProfileCodes'
      );
      expect(brandIssue?.message).toContain('at least one brand');
    }
  });

  it('enforces minimum description length for reason', () => {
    const shortReasonResult = requestAccessSchema.safeParse({
      ...validPayload,
      reason: 'too short',
    });
    expect(shortReasonResult.success).toBe(false);
    if (!shortReasonResult.success) {
      const reasonIssue = shortReasonResult.error.issues.find((i) => i.path[0] === 'reason');
      expect(reasonIssue).toBeDefined();
    }
  });

  it('validates accessRequestReviewSchema for administrator review', () => {
    const validReview = {
      status: 'approved',
      assignedRole: 'team_lead',
      jobRole: 'Design Lead (TL)',
      weeklyCapacityHours: 40,
      profileAccess: ['prof1', 'prof2'],
      reportsToIds: [],
    };
    const result = accessRequestReviewSchema.safeParse(validReview);
    expect(result.success).toBe(true);
  });
});
