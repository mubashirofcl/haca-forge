import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, ROLE_KEYS, PERMISSION_KEYS, LEGACY_ROLE_ALIASES } from '@mmp/shared';
import { defineAbilityForUser } from '../src/lib/permissions.js';

describe('Marketing OS Permissions & CASL Ability Tests (Phase 1 + Executive)', () => {
  it('should have exact 5 role keys defined in specification', () => {
    const expectedRoles = ['admin', 'marketing_head', 'executive', 'team_lead', 'team_member'];
    expect(ROLE_KEYS).toEqual(expectedRoles);
  });

  it('should export legacy role aliases for smooth migration backward compatibility', () => {
    expect(LEGACY_ROLE_ALIASES).toMatchObject({
      lead: 'marketing_head',
      head: 'marketing_head',
      worker: 'team_member',
      sm_manager: 'team_member',
      management: 'executive',
      viewer: 'executive',
    });
  });

  it('admin holds all permission keys derived dynamically from PERMISSION_KEYS', () => {
    expect(ROLE_PERMISSIONS.admin).toEqual([...PERMISSION_KEYS]);
    expect(ROLE_PERMISSIONS.admin).toContain('portal.view');
    expect(ROLE_PERMISSIONS.admin).toContain('people.view');
    expect(ROLE_PERMISSIONS.admin).toContain('user.approve');
    expect(ROLE_PERMISSIONS.admin).toContain('user.manage');
    expect(ROLE_PERMISSIONS.admin).toContain('people.assign');
    expect(ROLE_PERMISSIONS.admin).toContain('reference.manage');
    expect(ROLE_PERMISSIONS.admin).toContain('campaign.manage');
    expect(ROLE_PERMISSIONS.admin).toContain('target.manage');
  });

  it('marketing_head has full marketing operations permissions plus portal.view and people.view', () => {
    const headPerms = ROLE_PERMISSIONS.marketing_head;
    expect(headPerms).toContain('portal.view');
    expect(headPerms).toContain('people.view');
    expect(headPerms).toContain('work.create');
    expect(headPerms).toContain('campaign.manage');
    expect(headPerms).toContain('target.manage');
    expect(headPerms).toContain('people.assign');
    expect(headPerms).toContain('lead.view');
    expect(headPerms).toContain('datacenter.view');
    expect(headPerms).toContain('analytics.team');
    expect(headPerms).toContain('report.configure');
    expect(headPerms).toContain('automation.manage');

    // Marketing Head CANNOT manage users or reference data or approve access requests
    expect(headPerms).not.toContain('user.manage');
    expect(headPerms).not.toContain('user.approve');
    expect(headPerms).not.toContain('reference.manage');
  });

  it('executive has portal.view, people.view and read-only view keys but zero write keys', () => {
    const execPerms = ROLE_PERMISSIONS.executive;
    const expectedExecPerms = [
      'portal.view',
      'people.view',
      'target.view',
      'lead.view',
      'datacenter.view',
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
    expect(execPerms).not.toContain('campaign.manage');
    expect(execPerms).not.toContain('target.manage');
    expect(execPerms).not.toContain('report.configure');
    expect(execPerms).not.toContain('automation.manage');
    expect(execPerms).not.toContain('user.approve');
    expect(execPerms).not.toContain('user.manage');
    expect(execPerms).not.toContain('people.assign');
    expect(execPerms).not.toContain('reference.manage');
  });

  it('team_lead has creative team permissions and views targets/reports but cannot manage targets or people.assign', () => {
    const leadPerms = ROLE_PERMISSIONS.team_lead;
    expect(leadPerms).toContain('work.create');
    expect(leadPerms).toContain('work.update.own');
    expect(leadPerms).toContain('feedback.give');
    expect(leadPerms).toContain('revision.classify');
    expect(leadPerms).toContain('campaign.manage');
    expect(leadPerms).toContain('target.view');
    expect(leadPerms).toContain('lead.view');
    expect(leadPerms).toContain('datacenter.view');
    expect(leadPerms).toContain('analytics.team');
    expect(leadPerms).toContain('report.view');

    // Team Lead CANNOT manage targets, assign people operational settings, or manage automation
    expect(leadPerms).not.toContain('target.manage');
    expect(leadPerms).not.toContain('people.assign');
    expect(leadPerms).not.toContain('report.configure');
    expect(leadPerms).not.toContain('automation.manage');
    expect(leadPerms).not.toContain('user.manage');
  });

  it('team_member has personal work permissions only', () => {
    const memberPerms = ROLE_PERMISSIONS.team_member;
    expect(memberPerms).toContain('work.request');
    expect(memberPerms).toContain('work.update.own');
    expect(memberPerms).toContain('feedback.respond');
    expect(memberPerms).toContain('analytics.team');

    // Team Member CANNOT create work, give feedback, manage campaigns, or view targets
    expect(memberPerms).not.toContain('work.create');
    expect(memberPerms).not.toContain('feedback.give');
    expect(memberPerms).not.toContain('campaign.manage');
    expect(memberPerms).not.toContain('target.view');
    expect(memberPerms).not.toContain('lead.view');
    expect(memberPerms).not.toContain('datacenter.view');
    expect(memberPerms).not.toContain('people.assign');
  });

  it('admin should have full ability to manage all in CASL', () => {
    const adminUser = { role: 'admin', status: 'active' };
    const ability = defineAbilityForUser(adminUser);
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('user.approve', 'all')).toBe(true);
    expect(ability.can('user.manage', 'all')).toBe(true);
    expect(ability.can('reference.manage', 'all')).toBe(true);
  });

  it('suspended user should have zero permissions in CASL', () => {
    const suspendedAdmin = { role: 'admin', status: 'suspended' };
    const ability = defineAbilityForUser(suspendedAdmin);
    expect(ability.can('manage', 'all')).toBe(false);
    expect(ability.can('user.manage', 'all')).toBe(false);
    expect(ability.can('work.create', 'all')).toBe(false);
  });
});
