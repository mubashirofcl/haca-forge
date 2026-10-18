import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, ROLE_KEYS, PERMISSION_KEYS, LEGACY_ROLE_ALIASES } from '@mmp/shared';
import { defineAbilityForUser } from '../src/lib/permissions.js';

describe('Permissions & CASL Ability Tests', () => {
  it('should have exact role keys defined in specification', () => {
    const expectedRoles = [
      'admin',
      'management',
      'head',
      'team_lead',
      'worker',
      'sm_manager',
      'dept_lead',
      'dept_staff',
    ];
    expect(ROLE_KEYS).toEqual(expectedRoles);
  });

  it('should export legacy role aliases for backward compatibility', () => {
    expect(LEGACY_ROLE_ALIASES).toEqual({
      lead: 'head',
      viewer: 'management',
    });
  });

  it('asserts diff of new matrix vs old matrix matches exact allowed changes', () => {
    // 1. Admin must be derived directly from PERMISSION_KEYS
    expect(ROLE_PERMISSIONS.admin).toEqual([...PERMISSION_KEYS]);
    expect(ROLE_PERMISSIONS.admin).toContain('assignment.manage');
    expect(ROLE_PERMISSIONS.admin).toContain('assignment.view');

    // 2. Head has exact 15 old lead permissions + assignment.view
    const expectedOldLeadPermissions = [
      'request.create',
      'request.view.department',
      'request.triage',
      'calendar.manage',
      'calendar.import',
      'content.create',
      'content.update',
      'task.assign',
      'task.update.own',
      'task.upload',
      'review.approve',
      'shoot.manage',
      'time.log',
      'timesheet.approve',
      'report.view',
    ];
    expect(ROLE_PERMISSIONS.head).toEqual([...expectedOldLeadPermissions, 'assignment.view']);

    // 3. Team lead has existing 9 permissions + review.approve + assignment.view
    const expectedOldTeamLeadPermissions = [
      'content.create',
      'content.update',
      'task.assign',
      'task.update.own',
      'task.upload',
      'shoot.manage',
      'time.log',
      'timesheet.approve',
      'report.view',
    ];
    expect(ROLE_PERMISSIONS.team_lead).toEqual([
      ...expectedOldTeamLeadPermissions.slice(0, 5),
      'review.approve',
      ...expectedOldTeamLeadPermissions.slice(5),
      'assignment.view',
    ]);
    expect(ROLE_PERMISSIONS.team_lead).toContain('review.approve');
    expect(ROLE_PERMISSIONS.team_lead).toContain('assignment.view');

    // 4. Worker has existing 5 permissions + assignment.view
    const expectedOldWorkerPermissions = [
      'task.update.own',
      'task.upload',
      'time.log',
      'shoot.manage',
      'report.view',
    ];
    expect(ROLE_PERMISSIONS.worker).toEqual([...expectedOldWorkerPermissions, 'assignment.view']);

    // 5. Management has report.view (same as legacy viewer)
    expect(ROLE_PERMISSIONS.management).toEqual(['report.view']);

    // 6. sm_manager, dept_lead, dept_staff unchanged
    expect(ROLE_PERMISSIONS.sm_manager).toEqual([
      'request.create',
      'request.view.department',
      'calendar.manage',
      'calendar.import',
      'content.create',
      'content.update',
      'content.publish',
      'request.confirm',
      'report.view',
    ]);
    expect(ROLE_PERMISSIONS.dept_lead).toEqual([
      'request.create',
      'request.view.department',
      'request.confirm',
      'report.view',
    ]);
    expect(ROLE_PERMISSIONS.dept_staff).toEqual([
      'request.create',
      'request.confirm',
      'report.view',
    ]);
  });

  it('normalizes legacy roles in defineAbilityForUser for backward compatibility', () => {
    const legacyLead = { role: 'lead', status: 'active' };
    const leadAbility = defineAbilityForUser(legacyLead);
    expect(leadAbility.can('request.triage', 'all')).toBe(true);
    expect(leadAbility.can('assignment.view', 'all')).toBe(true);

    const legacyViewer = { role: 'viewer', status: 'active' };
    const viewerAbility = defineAbilityForUser(legacyViewer);
    expect(viewerAbility.can('report.view', 'all')).toBe(true);
    expect(viewerAbility.can('request.triage', 'all')).toBe(false);
  });

  it('admin should have full ability to manage all', () => {
    const adminUser = { role: 'admin', status: 'active' };
    const ability = defineAbilityForUser(adminUser);
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('user.approve', 'all')).toBe(true);
  });

  it('worker should only have worker permissions and cannot approve users or triage', () => {
    const workerUser = { role: 'worker', status: 'active' };
    const ability = defineAbilityForUser(workerUser);

    expect(ability.can('task.update.own', 'all')).toBe(true);
    expect(ability.can('time.log', 'all')).toBe(true);
    expect(ability.can('user.approve', 'all')).toBe(false);
    expect(ability.can('request.triage', 'all')).toBe(false);
    expect(ability.can('settings.manage', 'all')).toBe(false);
  });

  it('department staff should be able to create requests but not view other departments or triage', () => {
    const staffUser = { role: 'dept_staff', status: 'active' };
    const ability = defineAbilityForUser(staffUser);

    expect(ability.can('request.create', 'all')).toBe(true);
    expect(ability.can('request.confirm', 'all')).toBe(true);
    expect(ability.can('request.triage', 'all')).toBe(false);
    expect(ability.can('request.view.department', 'all')).toBe(false);
  });

  it('suspended user should have no permissions', () => {
    const suspendedAdmin = { role: 'admin', status: 'suspended' };
    const ability = defineAbilityForUser(suspendedAdmin);
    expect(ability.can('manage', 'all')).toBe(false);
    expect(ability.can('report.view', 'all')).toBe(false);
  });
});
