import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  getAvailableActions,
  getActionDisabledReason,
  WORK_ACTION_KEYS,
  ACTION_LABELS,
} from '@mmp/shared';
import { app } from '../src/server.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { WorkItem } from '../src/modules/workItems/model.js';

describe('Work Actions, Authorization, and Wording Suite', () => {
  describe('1. Shared getAvailableActions Pure Unit Tests', () => {
    const writerId = '660000000000000000000001';
    const headId = '660000000000000000000002';
    const managerId = '660000000000000000000003';
    const adminId = '660000000000000000000004';
    const execId = '660000000000000000000005';

    const writerUser = { _id: writerId, role: 'team_member', name: 'Ravi' };
    const headUser = { _id: headId, role: 'creative_head', name: 'Sarah' };
    const smManagerUser = { _id: managerId, role: 'sm_manager', name: 'Alex' };
    const adminUser = { _id: adminId, role: 'admin', name: 'DevAdmin' };
    const execUser = { _id: execId, role: 'executive', name: 'VP' };

    it('verifies exact ACTION_LABELS dictionary contains no "Lead" and has strict wording', () => {
      expect(ACTION_LABELS.start).toBe('Start');
      expect(ACTION_LABELS.submit_for_approval).toBe('Submit for approval');
      expect(ACTION_LABELS.done_and_forward).toBeUndefined();
      expect(ACTION_LABELS.mark_as_posted).toBe('Mark as posted');
      expect(ACTION_LABELS.mark_blocked).toBe('Mark blocked');
      expect(ACTION_LABELS.request_help).toBe('Request help');
      expect(ACTION_LABELS.approve).toBe('Approve');
      expect(ACTION_LABELS.request_revision).toBe('Request revision');
      expect(ACTION_LABELS.change_owner).toBe('Change owner');
      expect(ACTION_LABELS.change_date).toBe('Change date');
      expect(ACTION_LABELS.skip_step).toBe('Skip step');

      // Check all labels for forbidden word 'lead'
      for (const [key, label] of Object.entries(ACTION_LABELS)) {
        expect(label.toLowerCase()).not.toContain('lead');
      }
    });

    describe('Owner permissions across step states and stage types', () => {
      it('returns [start] for owner in Not Started', () => {
        const item = { ownerId: writerId, status: 'Not Started', stageKey: 'Content' };
        const res = getAvailableActions(writerUser, item);
        expect(res.actions).toEqual(['start']);
      });

      it('returns [submit_for_approval, mark_blocked, request_help] for review stages (Content, Script, Design, Edit) in In Progress', () => {
        for (const stageKey of ['Content', 'Script', 'Design', 'Edit']) {
          const item = { ownerId: writerId, status: 'In Progress', stageKey };
          const res = getAvailableActions(writerUser, item);
          expect(res.actions).toEqual(['submit_for_approval', 'mark_blocked', 'request_help']);
        }
      });

      it('returns [submit_for_approval, mark_blocked, request_help] for Shoot stage in In Progress', () => {
        const item = { ownerId: writerId, status: 'In Progress', stageKey: 'Shoot' };
        const res = getAvailableActions(writerUser, item);
        expect(res.actions).toEqual(['submit_for_approval', 'mark_blocked', 'request_help']);
      });

      it('returns [mark_as_posted, mark_blocked, request_help] for Post stage in In Progress', () => {
        const item = { ownerId: writerId, status: 'In Progress', stageKey: 'Post' };
        const res = getAvailableActions(writerUser, item);
        expect(res.actions).toEqual(['mark_as_posted', 'mark_blocked', 'request_help']);
      });

      it('returns [resolve_blocker, request_help] for owner in Blocked status', () => {
        const item = { ownerId: writerId, status: 'Blocked', stageKey: 'Content' };
        const res = getAvailableActions(writerUser, item);
        // Phase 6: the step owner resolves their own blocker (the API allows owner, sm_manager, admin).
        expect(res.actions).toEqual(['resolve_blocker', 'request_help']);
      });

      it('returns empty array [] for owner when stage is locked or Pending or Approved or Published', () => {
        expect(getAvailableActions(writerUser, { ownerId: writerId, status: 'Not Started', isLocked: true }).actions).toEqual([]);
        expect(getAvailableActions(writerUser, { ownerId: writerId, status: 'Pending', stageKey: 'Content' }).actions).toEqual([]);
        expect(getAvailableActions(writerUser, { ownerId: writerId, status: 'Approved', stageKey: 'Content' }).actions).toEqual([]);
        expect(getAvailableActions(writerUser, { ownerId: writerId, status: 'Published', stageKey: 'Post' }).actions).toEqual([]);
      });
    });

    describe('Non-owner restrictions (Zero worker actions on someone else task)', () => {
      it('refuses worker actions to another team_member even if that user has permission flags', () => {
        const otherMember = {
          _id: '660000000000000000000099',
          role: 'team_member',
          name: 'Intruder',
          permissions: ['work.update.own', 'work.update.all', 'work.approve'],
        };
        const item = { ownerId: writerId, status: 'In Progress', stageKey: 'Content' };
        const res = getAvailableActions(otherMember, item);
        expect(res.actions).toEqual([]);
        expect(res.isOwner).toBe(false);
      });

      it('refuses worker actions to creative_head on a task owned by writer', () => {
        const item = { ownerId: writerId, status: 'In Progress', stageKey: 'Content' };
        const res = getAvailableActions(headUser, item);
        expect(res.actions).toEqual([]);
        expect(res.isOwner).toBe(false);
      });
    });

    describe('Creative Head and Admin review actions', () => {
      it('allows creative_head to approve and request revision ONLY when step is Pending and user is not owner', () => {
        const item = { ownerId: writerId, status: 'Pending', stageKey: 'Content' };
        const res = getAvailableActions(headUser, item);
        expect(res.actions).toEqual(['approve', 'request_revision']);
      });

      it('allows admin to approve and request revision when step is Pending and user is not owner', () => {
        const item = { ownerId: writerId, status: 'Pending', stageKey: 'Content' };
        const res = getAvailableActions(adminUser, item);
        expect(res.actions).toContain('approve');
        expect(res.actions).toContain('request_revision');
      });

      it('does NOT allow creative_head to approve or request revision if creative_head owns the task', () => {
        const item = { ownerId: headId, status: 'Pending', stageKey: 'Content' };
        const res = getAvailableActions(headUser, item);
        expect(res.actions).not.toContain('approve');
        expect(res.actions).not.toContain('request_revision');
      });

      it('does NOT allow creative_head to approve or request revision when status is not Pending', () => {
        for (const status of ['Not Started', 'In Progress', 'Feedback', 'Blocked', 'Approved', 'Published']) {
          const item = { ownerId: writerId, status, stageKey: 'Content' };
          const res = getAvailableActions(headUser, item);
          expect(res.actions).not.toContain('approve');
          expect(res.actions).not.toContain('request_revision');
        }
      });
    });

    describe('SM Manager actions', () => {
      it('grants sm_manager management actions (change owner, change date, skip step, edit details, delete) on unstarted step', () => {
        const item = { ownerId: writerId, status: 'Not Started', stageKey: 'Content' };
        const res = getAvailableActions(smManagerUser, item);
        expect(res.actions).toEqual(['change_owner', 'change_date', 'skip_step', 'edit_details', 'delete']);
        expect(res.actions).not.toContain('approve');
        expect(res.actions).not.toContain('submit_for_approval');
      });

      it('does not allow sm_manager to delete or skip step once In Progress', () => {
        const item = { ownerId: writerId, status: 'In Progress', stageKey: 'Content' };
        const res = getAvailableActions(smManagerUser, item);
        expect(res.actions).toEqual(['change_owner', 'change_date', 'edit_details']);
      });

      it('allows sm_manager to resolve blocker on Blocked task', () => {
        const item = { ownerId: writerId, status: 'Blocked', stageKey: 'Content' };
        const res = getAvailableActions(smManagerUser, item);
        expect(res.actions).toContain('resolve_blocker');
        expect(res.actions).not.toContain('approve');
      });
    });

    describe('Executive restrictions', () => {
      it('returns empty actions for executive in every state', () => {
        for (const status of ['Not Started', 'In Progress', 'Pending', 'Feedback', 'Blocked', 'Approved', 'Published']) {
          const item = { ownerId: writerId, status, stageKey: 'Content' };
          const res = getAvailableActions(execUser, item);
          expect(res.actions).toEqual([]);
        }
      });
    });

    describe('getActionDisabledReason output', () => {
      it('returns clear one-line reasons for why no actions exist', () => {
        expect(getActionDisabledReason(headUser, { ownerId: { name: 'Ravi' }, status: 'In Progress', stageKey: 'Content' }))
          .toBe('Waiting for Ravi');
        expect(getActionDisabledReason(writerUser, { ownerId: { name: 'Ravi' }, status: 'Pending', stageKey: 'Content' }))
          .toBe('Waiting for the Creative Head');
        expect(
          getActionDisabledReason(writerUser, {
            ownerId: { name: 'Ravi' },
            status: 'Not Started',
            isLocked: true,
            pieceStages: [{ stageKey: 'Script', status: 'In Progress' }],
          })
        ).toBe('Locked until the Script step is approved');
      });
    });
  });

  describe('2. HTTP API Security and Authorization Transitions', () => {
    let headUser, writerUser, smManagerUser, adminUser, execUser;
    let headToken, writerToken, smManagerToken, adminToken, execToken;
    let deptDoc, profileDoc;
    let createdItems = [];

    beforeAll(async () => {
      await connectDB();

      deptDoc = (await mongoose.connection.db.collection('departments').findOne({})) || { _id: new mongoose.Types.ObjectId() };
      profileDoc = (await mongoose.connection.db.collection('profiles').findOne({})) || { _id: new mongoose.Types.ObjectId() };

      headUser = await Person.create({
        name: 'Head User Test',
        email: 'head.test.actions@example.com',
        role: 'creative_head',
        status: 'active',
        profileAccess: [profileDoc._id],
      });
      writerUser = await Person.create({
        name: 'Writer User Test',
        email: 'writer.test.actions@example.com',
        role: 'team_member',
        status: 'active',
        profileAccess: [profileDoc._id],
      });
      smManagerUser = await Person.create({
        name: 'SM Manager Test',
        email: 'sm.test.actions@example.com',
        role: 'sm_manager',
        status: 'active',
        profileAccess: [profileDoc._id],
      });
      adminUser = await Person.create({
        name: 'Admin Test',
        email: 'admin.test.actions@example.com',
        role: 'admin',
        status: 'active',
      });
      execUser = await Person.create({
        name: 'Exec Test',
        email: 'exec.test.actions@example.com',
        role: 'executive',
        status: 'active',
        profileAccess: [profileDoc._id],
      });

      headToken = jwt.sign(
        { userId: headUser._id.toString(), email: headUser.email, role: headUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      writerToken = jwt.sign(
        { userId: writerUser._id.toString(), email: writerUser.email, role: writerUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      smManagerToken = jwt.sign(
        { userId: smManagerUser._id.toString(), email: smManagerUser.email, role: smManagerUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      adminToken = jwt.sign(
        { userId: adminUser._id.toString(), email: adminUser.email, role: adminUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      execToken = jwt.sign(
        { userId: execUser._id.toString(), email: execUser.email, role: execUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    afterAll(async () => {
      // Clean up all test work items
      for (const id of createdItems) {
        await WorkItem.findByIdAndDelete(id);
      }
      // Clean up test people
      await Person.findByIdAndDelete(headUser._id);
      await Person.findByIdAndDelete(writerUser._id);
      await Person.findByIdAndDelete(smManagerUser._id);
      await Person.findByIdAndDelete(adminUser._id);
      await Person.findByIdAndDelete(execUser._id);
    });

    it('Creative Head CANNOT submit a task owned by Writer -> 403 FORBIDDEN_ACTION', async () => {
      const item = await WorkItem.create({
        title: 'Writer Work For Security Check',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'In Progress',
        stageKey: 'Content',
        isLocked: false,
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });
      createdItems.push(item._id);

      const res = await request(app)
        .post(`/api/work/${item._id}/transition`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ toStatus: 'Pending', note: 'Creative head illegal submission' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ACTION');
    });

    it('Creative Head CANNOT mark a task blocked if owned by Writer -> 403 FORBIDDEN_ACTION', async () => {
      const item = await WorkItem.create({
        title: 'Writer Work Block Check',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'In Progress',
        stageKey: 'Content',
        isLocked: false,
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });
      createdItems.push(item._id);

      const res = await request(app)
        .post(`/api/work/${item._id}/transition`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ toStatus: 'Blocked', blockerReason: 'Technical issue' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ACTION');
    });

    it('Writer (Owner) CAN submit their own task -> 200 OK', async () => {
      const item = await WorkItem.create({
        title: 'Writer Self Submit Work',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'In Progress',
        stageKey: 'Content',
        isLocked: false,
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });
      createdItems.push(item._id);

      const res = await request(app)
        .post(`/api/work/${item._id}/transition`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({ toStatus: 'Pending', note: 'Writer self submission' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Pending');
    });

    it('Creative Head CAN approve a Pending task -> 200 OK', async () => {
      const item = await WorkItem.create({
        title: 'Pending Work For Approval',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'Pending',
        stageKey: 'Content',
        isLocked: false,
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });
      createdItems.push(item._id);

      const res = await request(app)
        .post(`/api/work/${item._id}/transition`)
        .set('Authorization', `Bearer ${headToken}`)
        .send({ toStatus: 'Approved', note: 'Looks good' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Approved');
    });

    it('SM Manager CANNOT approve a Pending task -> 403 FORBIDDEN_ACTION', async () => {
      const item = await WorkItem.create({
        title: 'Pending Work For SM Approval Check',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'Pending',
        stageKey: 'Content',
        isLocked: false,
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });
      createdItems.push(item._id);

      const res = await request(app)
        .post(`/api/work/${item._id}/transition`)
        .set('Authorization', `Bearer ${smManagerToken}`)
        .send({ toStatus: 'Approved', note: 'SM Manager attempting approval' });

      expect(res.status).toBe(403);
      expect(['FORBIDDEN_ACTION', 'FORBIDDEN_APPROVAL']).toContain(res.body.error.code);
    });

    it('Executive CANNOT perform any transitions -> 403', async () => {
      const item = await WorkItem.create({
        title: 'Work For Exec Check',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'Pending',
        stageKey: 'Content',
        isLocked: false,
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });
      createdItems.push(item._id);

      const res = await request(app)
        .post(`/api/work/${item._id}/transition`)
        .set('Authorization', `Bearer ${execToken}`)
        .send({ toStatus: 'Approved' });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Delete Permissions and Lifecycle Guards', () => {
    let adminUser, smManagerUser, headUser, writerUser;
    let adminToken, smManagerToken, headToken, writerToken;
    let deptDoc, profileDoc;
    let createdItems = [];

    beforeAll(async () => {
      deptDoc = (await mongoose.connection.db.collection('departments').findOne({})) || { _id: new mongoose.Types.ObjectId() };
      profileDoc = (await mongoose.connection.db.collection('profiles').findOne({})) || { _id: new mongoose.Types.ObjectId() };

      adminUser = await Person.create({
        name: 'Del Admin',
        email: 'del.admin@example.com',
        role: 'admin',
        status: 'active',
      });
      smManagerUser = await Person.create({
        name: 'Del SM Manager',
        email: 'del.sm@example.com',
        role: 'sm_manager',
        status: 'active',
        profileAccess: [profileDoc._id],
      });
      headUser = await Person.create({
        name: 'Del Creative Head',
        email: 'del.head@example.com',
        role: 'creative_head',
        status: 'active',
        profileAccess: [profileDoc._id],
      });
      writerUser = await Person.create({
        name: 'Del Writer',
        email: 'del.writer@example.com',
        role: 'team_member',
        status: 'active',
        profileAccess: [profileDoc._id],
      });

      adminToken = jwt.sign(
        { userId: adminUser._id.toString(), email: adminUser.email, role: adminUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      smManagerToken = jwt.sign(
        { userId: smManagerUser._id.toString(), email: smManagerUser.email, role: smManagerUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      headToken = jwt.sign(
        { userId: headUser._id.toString(), email: headUser.email, role: headUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      writerToken = jwt.sign(
        { userId: writerUser._id.toString(), email: writerUser.email, role: writerUser.role },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    afterAll(async () => {
      for (const id of createdItems) {
        await WorkItem.findByIdAndDelete(id);
      }
      await Person.findByIdAndDelete(adminUser._id);
      await Person.findByIdAndDelete(smManagerUser._id);
      await Person.findByIdAndDelete(headUser._id);
      await Person.findByIdAndDelete(writerUser._id);
    });

    it('allows Admin to delete a work item in Not Started status -> 200 OK', async () => {
      const item = await WorkItem.create({
        title: 'Admin Deletable Item',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'Not Started',
        stageKey: 'Content',
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });

      const res = await request(app)
        .delete(`/api/work/${item._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const inDb = await WorkItem.findById(item._id);
      expect(inDb).toBeNull();
    });

    it('allows SM Manager to delete a work item in Not Started status -> 200 OK', async () => {
      const item = await WorkItem.create({
        title: 'SM Deletable Item',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'Not Started',
        stageKey: 'Content',
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });

      const res = await request(app)
        .delete(`/api/work/${item._id}`)
        .set('Authorization', `Bearer ${smManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const inDb = await WorkItem.findById(item._id);
      expect(inDb).toBeNull();
    });

    it('refuses Creative Head from deleting a work item -> 403 FORBIDDEN_ACTION', async () => {
      const item = await WorkItem.create({
        title: 'Creative Head Delete Attempt',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'Not Started',
        stageKey: 'Content',
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });
      createdItems.push(item._id);

      const res = await request(app)
        .delete(`/api/work/${item._id}`)
        .set('Authorization', `Bearer ${headToken}`);

      expect(res.status).toBe(403);
    });

    it('refuses deletion of a work item that is already In Progress -> 403 CANNOT_DELETE_STARTED_WORK', async () => {
      const item = await WorkItem.create({
        title: 'In Progress Item Cannot Be Deleted',
        workType: 'Copy',
        ownerId: writerUser._id,
        status: 'In Progress',
        stageKey: 'Content',
        deadline: new Date(Date.now() + 86400000),
        departmentId: deptDoc._id,
        profileId: profileDoc._id,
      });
      createdItems.push(item._id);

      const res = await request(app)
        .delete(`/api/work/${item._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CANNOT_DELETE_STARTED_WORK');
    });
  });

  describe('4. Strict Button Words & Terminology Sweep', () => {
    it('verifies exact allowed button words everywhere with zero "Lead" or "Deliverable" words', () => {
      const allowedActions = [
        'Start',
        'Submit for approval',
        'Mark as posted',
        'Mark blocked',
        'Request help',
        'Approve',
        'Request revision',
        'Change owner',
        'Change date',
        'Skip step',
      ];

      for (const [key, label] of Object.entries(ACTION_LABELS)) {
        expect(label.toLowerCase()).not.toContain('lead');
        expect(label.toLowerCase()).not.toContain('deliverable');
        expect(label.toLowerCase()).not.toContain('brand');
        expect(label.toLowerCase()).not.toContain('audit stream');
      }

      // Check all canonical actions match
      expect(Object.values(ACTION_LABELS)).toEqual(expect.arrayContaining(allowedActions));
    });
  });
});
