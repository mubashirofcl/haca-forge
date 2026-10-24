import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, ROLE_KEYS, PERMISSION_KEYS, ROLE_LABELS } from '@mmp/shared';
import { defineAbilityForUser } from '../src/lib/permissions.js';

describe('Marketing OS Permissions & CASL Ability Tests (R2 Canonical 5 Roles)', () => {
  it('should have exact 5 role keys defined in specification', () => {
    const expectedRoles = ['admin', 'creative_head', 'executive', 'sm_manager', 'team_member'];
    expect(ROLE_KEYS).toEqual(expectedRoles);
  });

  it('should export ROLE_LABELS with Creative Head and SM Manager', () => {
    expect(ROLE_LABELS).toMatchObject({
      admin: 'Administrator',
      creative_head: 'Creative Head',
      executive: 'Executive',
      sm_manager: 'SM Manager',
      team_member: 'Team Member',
    });
  });

  it('admin holds all permission keys derived dynamically from PERMISSION_KEYS', () => {
    expect(ROLE_PERMISSIONS.admin).toEqual([...PERMISSION_KEYS]);
    expect(ROLE_PERMISSIONS.admin).toContain('portal.view');
    expect(ROLE_PERMISSIONS.admin).toContain('people.view');
    expect(ROLE_PERMISSIONS.admin).toContain('user.approve');
    expect(ROLE_PERMISSIONS.admin).toContain('user.manage');
    expect(ROLE_PERMISSIONS.admin).toContain('people.assign');
    expect(ROLE_PERMISSIONS.admin).toContain('calendar.plan');
    expect(ROLE_PERMISSIONS.admin).toContain('calendar.approve');
  });

  it('creative_head has authoritative creative & people ops permissions snapshot', () => {
    const headPerms = ROLE_PERMISSIONS.creative_head;
    const expectedHeadPerms = [
      'portal.view',
      'people.view',
      'people.assign',
      'calendar.approve',
      'feedback.give',
      'feedback.respond',
      'revision.classify',
      'assignment.override',
      'work.update.own',
      'analytics.team',
      'report.view',
      'report.configure',
      'automation.manage',
    ];
    expect(headPerms).toEqual(expectedHeadPerms);

    // Creative Head CANNOT manage users, create plans, or create raw work items
    expect(headPerms).not.toContain('user.manage');
    expect(headPerms).not.toContain('user.approve');
    expect(headPerms).not.toContain('calendar.plan');
    expect(headPerms).not.toContain('work.create');
  });

  it('executive has portal.view, people.view and read-only view keys but zero write keys', () => {
    const execPerms = ROLE_PERMISSIONS.executive;
    const expectedExecPerms = [
      'portal.view',
      'people.view',
      'analytics.team',
      'report.view',
    ];
    expect(execPerms).toEqual(expectedExecPerms);

    // Strictly NO write keys
    expect(execPerms).not.toContain('work.create');
    expect(execPerms).not.toContain('work.request');
    expect(execPerms).not.toContain('work.update.own');
    expect(execPerms).not.toContain('assignment.override');
    expect(execPerms).not.toContain('feedback.give');
    expect(execPerms).not.toContain('revision.classify');
    expect(execPerms).not.toContain('report.configure');
    expect(execPerms).not.toContain('automation.manage');
    expect(execPerms).not.toContain('user.approve');
    expect(execPerms).not.toContain('user.manage');
    expect(execPerms).not.toContain('people.assign');
    expect(execPerms).not.toContain('calendar.plan');
    expect(execPerms).not.toContain('calendar.approve');
  });

  it('sm_manager has planning, work creation and assignment override permissions snapshot', () => {
    const smPerms = ROLE_PERMISSIONS.sm_manager;
    const expectedSmPerms = [
      'calendar.plan',
      'work.create',
      'assignment.override',
      'work.update.own',
      'feedback.respond',
      'analytics.team',
      'report.view',
      'people.view',
    ];
    expect(smPerms).toEqual(expectedSmPerms);

    // SM Manager CANNOT approve calendar plans or approve review stages, or people.assign
    expect(smPerms).not.toContain('calendar.approve');
    expect(smPerms).not.toContain('people.assign');
    expect(smPerms).not.toContain('feedback.give');
    expect(smPerms).not.toContain('revision.classify');
    expect(smPerms).not.toContain('report.configure');
    expect(smPerms).not.toContain('automation.manage');
    expect(smPerms).not.toContain('user.manage');
  });

  it('team_member has personal work permissions only', () => {
    const memberPerms = ROLE_PERMISSIONS.team_member;
    const expectedMemberPerms = [
      'work.update.own',
      'work.request',
      'feedback.respond',
    ];
    expect(memberPerms).toEqual(expectedMemberPerms);

    // Team Member CANNOT create work, give feedback, plan calendar, or approve
    expect(memberPerms).not.toContain('work.create');
    expect(memberPerms).not.toContain('feedback.give');
    expect(memberPerms).not.toContain('people.assign');
    expect(memberPerms).not.toContain('calendar.plan');
    expect(memberPerms).not.toContain('calendar.approve');
  });

  it('admin should have full ability to manage all in CASL', () => {
    const adminUser = { role: 'admin', status: 'active' };
    const ability = defineAbilityForUser(adminUser);
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('user.approve', 'all')).toBe(true);
    expect(ability.can('user.manage', 'all')).toBe(true);
  });

  it('suspended user should have zero permissions in CASL', () => {
    const suspendedAdmin = { role: 'admin', status: 'suspended' };
    const ability = defineAbilityForUser(suspendedAdmin);
    expect(ability.can('manage', 'all')).toBe(false);
    expect(ability.can('user.manage', 'all')).toBe(false);
    expect(ability.can('work.create', 'all')).toBe(false);
  });
});
