import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { Request as MarketingRequest } from '../src/modules/requests/model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { eventBus, EVENTS } from '../src/lib/events.js';
import {
  handleDomainEvent,
  getUserPreferences,
  updateUserPreferences,
} from '../src/modules/notifications/service.js';
import {
  runDeadlineRemindersJob,
  runRecurringRequestsJob,
  runDailyDigestJob,
  runCapacityGapJob,
} from '../src/modules/jobs/processors.js';

let adminCookie = '';
let leadCookie = '';
let workerCookie = '';
let adminUser = null;
let leadUser = null;
let workerUser = null;
let testTaskId = '';
let testNotificationId = '';

beforeAll(async () => {
  await connectDB();

  const login = async (email, password = 'Password123!') => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'];
  };

  adminUser = await User.findOne({ email: 'admin@marketingportal.com' });
  leadUser = await User.findOne({ role: { $in: ['lead', 'marketing_lead'] }, status: 'active' });
  workerUser = await User.findOne({ role: 'worker', status: 'active' });

  adminCookie = await login('admin@marketingportal.com', 'Admin1212');
  leadCookie = leadUser ? await login(leadUser.email) : adminCookie;
  workerCookie = workerUser ? await login(workerUser.email) : leadCookie;
});

afterAll(async () => {
  // Cleanup test notifications
  if (workerUser) {
    await Notification.deleteMany({ recipient: workerUser._id });
  }
  if (adminUser) {
    await Notification.deleteMany({ recipient: adminUser._id });
  }
  await disconnectDB();
});

describe('Phase 8: Notifications, Socket.io & Background Jobs Test Suite', () => {
  describe('1. Central Domain Event Bus & Recipient Mapping', () => {
    it('should emit events through eventBus and notify registered listeners', async () => {
      let eventPayloadReceived = null;
      const testListener = (payload) => {
        eventPayloadReceived = payload;
      };

      eventBus.once(EVENTS.TASK_ASSIGNED, testListener);
      eventBus.emit(EVENTS.TASK_ASSIGNED, {
        taskId: 'TSK-TEST-EVENT-001',
        title: 'Event Bus Unit Test Task',
        assignee: workerUser?._id,
      });

      expect(eventPayloadReceived).toBeDefined();
      expect(eventPayloadReceived.taskId).toBe('TSK-TEST-EVENT-001');
    });

    it('should map task.assigned event to recipient and persist Notification document', async () => {
      const priorCount = await Notification.countDocuments({ recipient: workerUser._id });

      await handleDomainEvent(EVENTS.TASK_ASSIGNED, {
        taskId: 'TSK-2026-TEST-P8',
        title: 'Phase 8 Video Editing Task',
        assignee: workerUser._id,
        link: '/tasks?taskId=TSK-2026-TEST-P8',
      });

      const updatedCount = await Notification.countDocuments({ recipient: workerUser._id });
      expect(updatedCount).toBeGreaterThan(priorCount);

      const latest = await Notification.findOne({
        recipient: workerUser._id,
        type: EVENTS.TASK_ASSIGNED,
      }).sort({ createdAt: -1 });

      expect(latest).toBeDefined();
      expect(latest.title).toContain('Task Assigned');
      expect(latest.message).toContain('Phase 8 Video Editing Task');
      expect(latest.read).toBe(false);

      testNotificationId = latest._id.toString();
    });

    it('should respect user preferences and skip in-app notifications if disabled', async () => {
      // Temporarily disable taskAssigned inApp notifications for worker
      await updateUserPreferences(workerUser._id, {
        inApp: { taskAssigned: false },
      });

      const countBefore = await Notification.countDocuments({ recipient: workerUser._id });

      await handleDomainEvent(EVENTS.TASK_ASSIGNED, {
        taskId: 'TSK-2026-TEST-MUTED',
        title: 'Muted Assignment Task',
        assignee: workerUser._id,
      });

      const countAfter = await Notification.countDocuments({ recipient: workerUser._id });
      // Should not have incremented because user disabled taskAssigned in-app alerts
      expect(countAfter).toBe(countBefore);

      // Restore user preferences
      await updateUserPreferences(workerUser._id, {
        inApp: { taskAssigned: true },
      });
    });
  });

  describe('2. Notification REST API Endpoints', () => {
    it('GET /api/notifications should return paginated notifications and unread count', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('unreadCount');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/notifications?unreadOnly=true should filter only unread items', async () => {
      const res = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.every((n) => n.read === false)).toBe(true);
    });

    it('GET /api/notifications/preferences should return user notification settings', async () => {
      const res = await request(app)
        .get('/api/notifications/preferences')
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);
      expect(res.body.preferences).toHaveProperty('email');
      expect(res.body.preferences).toHaveProperty('inApp');
    });

    it('PUT /api/notifications/preferences should update user preferences', async () => {
      const res = await request(app)
        .put('/api/notifications/preferences')
        .set('Cookie', workerCookie)
        .send({
          preferences: {
            email: { deadlineReminders: false },
            inApp: { deadlineReminders: true },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.preferences.email.deadlineReminders).toBe(false);
      expect(res.body.preferences.inApp.deadlineReminders).toBe(true);
    });

    it('PATCH /api/notifications/:id/read should mark a single notification as read', async () => {
      if (!testNotificationId) return;

      const res = await request(app)
        .patch(`/api/notifications/${testNotificationId}/read`)
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);
      expect(res.body.notification.read).toBe(true);
    });

    it('PATCH /api/notifications/read-all should mark all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const unreadCheck = await Notification.countDocuments({
        recipient: workerUser._id,
        read: false,
      });
      expect(unreadCheck).toBe(0);
    });

    it('DELETE /api/notifications/:id should delete a notification', async () => {
      if (!testNotificationId) return;

      const res = await request(app)
        .delete(`/api/notifications/${testNotificationId}`)
        .set('Cookie', workerCookie);

      expect(res.status).toBe(200);

      const check = await Notification.findById(testNotificationId);
      expect(check).toBeNull();
    });
  });

  describe('3. Background Jobs & Idempotency', () => {
    it('runDeadlineRemindersJob should identify tasks approaching deadline within 24h and be idempotent', async () => {
      // Create a test task due in 12 hours
      const now = new Date();
      const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);

      const urgentTask = await Task.create({
        taskId: `TSK-URGENT-${Date.now()}`,
        contentItemId: new mongoose.Types.ObjectId(),
        stageKey: 'graphics',
        title: 'Phase 8 Urgent Deadline Test Task',
        team: 'graphics',
        assignee: workerUser._id,
        status: 'assigned',
        dueDate: in12Hours,
      });

      // 1st Run: Should identify the task and send reminder
      const result1 = await runDeadlineRemindersJob();
      expect(result1.approaching).toBeGreaterThanOrEqual(1);

      // Verify reminderSentAt timestamp is set on the task
      const updatedTask = await Task.findById(urgentTask._id);
      expect(updatedTask.reminderSentAt).toBeDefined();

      // 2nd Run (Simulating worker restart or cron trigger):
      // Because reminderSentAt is already set, this task MUST NOT be re-processed
      const result2 = await runDeadlineRemindersJob();
      // Should find 0 additional tasks due to idempotency
      const rechecked = await Task.findById(urgentTask._id);
      expect(rechecked.reminderSentAt.getTime()).toBe(updatedTask.reminderSentAt.getTime());

      // Cleanup
      await Task.findByIdAndDelete(urgentTask._id);
    });

    it('runRecurringRequestsJob should spawn child request and advance nextRunAt', async () => {
      const now = new Date();
      const pastDueRun = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

      // Create a recurring template
      const recurringTemplate = await MarketingRequest.create({
        requestId: `MKT-REC-${Date.now()}`,
        title: 'Weekly Recurring Product Digest',
        sourceDepartment: 'Marketing',
        requester: leadUser ? leadUser._id : adminUser._id,
        requestTypeName: 'Social Post',
        status: 'accepted',
        deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        recurring: {
          isRecurring: true,
          frequency: 'weekly',
          nextRunAt: pastDueRun,
        },
      });

      const spawned = await runRecurringRequestsJob();
      expect(spawned.length).toBeGreaterThanOrEqual(1);

      // Verify template's nextRunAt has been advanced by 7 days
      const updatedTemplate = await MarketingRequest.findById(recurringTemplate._id);
      expect(new Date(updatedTemplate.recurring.nextRunAt).getTime()).toBeGreaterThan(now.getTime());

      // Verify child request was created
      const child = await MarketingRequest.findOne({
        title: { $regex: 'Weekly Recurring Product Digest' },
        status: 'submitted',
      });
      expect(child).toBeDefined();

      // Cleanup
      await MarketingRequest.findByIdAndDelete(recurringTemplate._id);
      if (child) await MarketingRequest.findByIdAndDelete(child._id);
    });

    it('runDailyDigestJob should execute without crashing and summarize lead operational queues', async () => {
      const digestResult = await runDailyDigestJob();
      expect(digestResult).toBeDefined();
      expect(digestResult).toHaveProperty('digestsSent');
      expect(typeof digestResult.digestsSent).toBe('number');
    });

    it('runCapacityGapJob should execute workload analysis cleanly', async () => {
      const capacityResult = await runCapacityGapJob();
      expect(Array.isArray(capacityResult)).toBe(true);
    });
  });
});
