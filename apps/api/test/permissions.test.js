import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, ROLE_KEYS, PERMISSION_KEYS } from '@mmp/shared';
import { defineAbilityForUser } from '../src/lib/permissions.js';

describe('Permissions & CASL Ability Tests', () => {
  it('should have exact role keys defined in specification', () => {
    const expectedRoles = [
      'admin',
      'lead',
      'team_lead',
      'worker',
      'sm_manager',
      'dept_lead',
      'dept_staff',
      'viewer',
    ];
    expect(ROLE_KEYS).toEqual(expectedRoles);
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
