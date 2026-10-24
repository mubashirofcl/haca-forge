import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { logger } from '../src/lib/logger.js';

// Taxonomies & User Models
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import { seedReferenceData } from '../src/modules/referenceData/service.js';

// Calendar & Deliverable Models
import { CalendarPlan } from '../src/modules/calendar/plan.model.js';
import { ContentPiece } from '../src/modules/calendar/contentPiece.model.js';
import { WorkItem } from '../src/modules/workItems/model.js';
import { Blocker } from '../src/modules/blockers/model.js';
import { FeedbackEntry, RevisionFlag } from '../src/modules/feedback/model.js';
import { Notification } from '../src/modules/notifications/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';

// System Services
import { ensureAutomationRules } from '../src/modules/automation/runner.js';
import { ensureReportDefinitions, generateReport } from '../src/modules/reports/service.js';
import { AutomationRule } from '../src/modules/automation/model.js';
import { ReportDefinition } from '../src/modules/reports/model.js';

export async function seedDemoData() {
  if (env.NODE_ENV === 'production') {
    logger.error('CRITICAL: Demo seeding is strictly forbidden in production environment!');
    process.exit(1);
  }

  await connectDB();
  logger.info('🌱 Seeding rich, meaningful demo data for HACA Marketing OS (all screens & reports)...');

  try {
    const demoPassword = env.DEMO_SEED_PASSWORD || 'demoPassword123!';
    const adminPassword = env.ADMIN_SEED_PASSWORD || 'Admin1212';

    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash(demoPassword, salt);
    const adminPasswordHash = await bcrypt.hash(adminPassword, salt);

    // 1. Reference Data: 7 Profiles and 7 Departments
    const { profiles, departments } = await seedReferenceData();
    const allProfileIds = profiles.map((p) => p._id);
    const hacaProfile = profiles.find((p) => p.code === 'haca') || profiles[0];
    const techDept = departments.find((d) => d.code === 'tech') || departments[0];
    const designDept = departments.find((d) => d.code === 'design') || departments[1];
    const videoDept = departments.find((d) => d.code === 'video') || departments[2];
    const contentDept = departments.find((d) => d.code === 'content') || departments[3];
    const smDept = departments.find((d) => d.code === 'social') || departments[4];

    // 2. Provision the 5 Canonical Roles
    // A. System Administrator
    const adminEmail = (env.ADMIN_SEED_EMAIL || 'admin@hacaforge.com').toLowerCase().trim();
    const adminUser = await Person.findOneAndUpdate(
      { email: adminEmail },
      {
        $set: {
          name: 'System Administrator',
          email: adminEmail,
          passwordHash: adminPasswordHash,
          role: 'admin',
          departmentId: techDept._id,
          profileAccess: allProfileIds,
          lastProfileId: hacaProfile._id,
          weeklyCapacityHours: 40,
          status: 'active',
          mustSetPassword: false,
        },
      },
      { upsert: true, new: true }
    );

    // B. Creative Head
    const headEmail = 'creative.head@demo.haca.local';
    const creativeHead = await Person.findOneAndUpdate(
      { email: headEmail },
      {
        $set: {
          name: 'Sarah Mitchell (Creative Head)',
          email: headEmail,
          passwordHash: demoPasswordHash,
          role: 'creative_head',
          departmentId: designDept._id,
          profileAccess: allProfileIds,
          lastProfileId: hacaProfile._id,
          weeklyCapacityHours: 40,
          status: 'active',
          mustSetPassword: false,
        },
      },
      { upsert: true, new: true }
    );

    // C. Social Media Manager
    const smEmail = 'sm.manager@demo.haca.local';
    const smManager = await Person.findOneAndUpdate(
      { email: smEmail },
      {
        $set: {
          name: 'Marcus Vance (SM Manager)',
          email: smEmail,
          passwordHash: demoPasswordHash,
          role: 'sm_manager',
          departmentId: smDept._id,
          profileAccess: allProfileIds,
          lastProfileId: hacaProfile._id,
          weeklyCapacityHours: 40,
          status: 'active',
          mustSetPassword: false,
        },
      },
      { upsert: true, new: true }
    );

    // D. Executive Leadership (C-Suite Read-Only)
    const execEmail = 'executive@demo.haca.local';
    const executive = await Person.findOneAndUpdate(
      { email: execEmail },
      {
        $set: {
          name: 'Alexander Sterling (Executive Director)',
          email: execEmail,
          passwordHash: demoPasswordHash,
          role: 'executive',
          departmentId: null,
          profileAccess: allProfileIds,
          lastProfileId: hacaProfile._id,
          weeklyCapacityHours: 40,
          status: 'active',
          mustSetPassword: false,
        },
      },
      { upsert: true, new: true }
    );

    // E. Creative Specialists & Team Members
    const workersData = [
      {
        name: 'Chloe Bennett',
        email: 'chloe.b@marketingportal.com',
        jobRole: 'Senior Copywriter',
        departmentId: contentDept._id,
        workPreferences: ['Content', 'Script', 'Post'],
        weeklyCapacityHours: 40,
      },
      {
        name: 'Aria Montgomery',
        email: 'aria.m@marketingportal.com',
        jobRole: 'Visual & Motion Designer',
        departmentId: designDept._id,
        workPreferences: ['Design', 'Post'],
        weeklyCapacityHours: 40,
      },
      {
        name: 'Oliver Thorne',
        email: 'oliver.editor@marketingportal.com',
        jobRole: 'Video Editor & Colorist',
        departmentId: videoDept._id,
        workPreferences: ['Edit', 'Shoot'],
        weeklyCapacityHours: 40,
      },
      {
        name: 'Kai Takahashi',
        email: 'kai.cinema@marketingportal.com',
        jobRole: 'Cinematographer & Director',
        departmentId: videoDept._id,
        workPreferences: ['Shoot'],
        weeklyCapacityHours: 40,
      },
    ];

    const workers = [];
    for (const w of workersData) {
      const worker = await Person.findOneAndUpdate(
        { email: w.email },
        {
          $set: {
            name: w.name,
            email: w.email,
            passwordHash: demoPasswordHash,
            role: 'team_member',
            jobRole: w.jobRole,
            departmentId: w.departmentId,
            profileAccess: allProfileIds,
            lastProfileId: hacaProfile._id,
            weeklyCapacityHours: w.weeklyCapacityHours,
            workPreferences: w.workPreferences,
            status: 'active',
            mustSetPassword: false,
          },
        },
        { upsert: true, new: true }
      );
      workers.push(worker);
    }

    const [writer, designer, editor, shooter] = workers;

    // 4. Sample Pending Access Requests for Admin
    await AccessRequest.deleteMany({ email: /@demo\.haca\.local$/ });
    await AccessRequest.create([
      {
        name: 'Applicant Alex (Copywriter)',
        email: 'alex.applicant@demo.haca.local',
        phone: '+91 98765 43210',
        department: 'Content & Copywriting',
        departmentId: contentDept._id,
        jobRole: 'Writer',
        requestedRole: 'team_member',
        requestedProfileCodes: ['haca'],
        requestedProfileIds: [hacaProfile._id],
        reason: 'Applying to write high-converting copy and content campaigns.',
        status: 'pending',
      },
      {
        name: 'Applicant Sarah (Lead Strategist)',
        email: 'sarah.applicant@demo.haca.local',
        phone: '+91 98765 43211',
        department: 'Social Media',
        departmentId: smDept._id,
        jobRole: 'Social Media Manager',
        requestedRole: 'sm_manager',
        requestedProfileCodes: ['haca'],
        requestedProfileIds: [hacaProfile._id],
        reason: 'Applying to coordinate and oversee paid media campaigns across Meta and Google Ads.',
        status: 'pending',
      },
    ]);

    // 5. Clean up existing demo operational records
    await CalendarPlan.deleteMany({ code: /^DEMO-/ });
    await ContentPiece.deleteMany({ title: /^\[DEMO\]/ });
    await WorkItem.deleteMany({ title: /^\[DEMO\]/ });
    await Blocker.deleteMany({ notes: /\[DEMO\]/ });
    await FeedbackEntry.deleteMany({ text: /\[DEMO\]/ });
    await RevisionFlag.deleteMany({});
    await Notification.deleteMany({ 'metadata.isDemo': true });
    await ActivityEvent.deleteMany({ 'metadata.isDemo': true });

    // 6. Current Month Calendar Plan (Monthly Kind)
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    const calendarPlan = await CalendarPlan.create({
      code: `DEMO-PLAN-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      title: `${currentMonthLabel} Master Social Plan`,
      kind: 'monthly',
      periodStart,
      periodEnd,
      profileId: hacaProfile._id,
      createdById: smManager._id,
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      approvedById: creativeHead._id,
      approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      comment: 'Approved for social distribution across Reels and Carousel streams.',
      status: 'Approved with pending rows',
    });

    // 7. Content Pieces (Rows in Calendar Plan)
    const targetDate1 = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const targetDate2 = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

    const rowApproved1 = await ContentPiece.create({
      planId: calendarPlan._id,
      topic: '[DEMO] Product Spotlight: 5 High-Impact AI Coding Shortcuts',
      contentType: 'Reel',
      pipeline: 'reel_a',
      postingDate: targetDate1,
      needsScript: true,
      needsShoot: true,
      contentLink: 'https://instagram.com/p/demo1',
      rowStatus: 'approved',
      reviewComment: 'Strong hook and visual concept. Approved to proceed.',
    });

    const rowApproved2 = await ContentPiece.create({
      planId: calendarPlan._id,
      topic: '[DEMO] Visual Carousel: The Anatomy of Modern Architecture',
      contentType: 'Carousel',
      pipeline: 'design',
      postingDate: targetDate2,
      needsScript: false,
      needsShoot: false,
      rowStatus: 'approved',
      reviewComment: 'Color palette matches brand guidelines. Approved.',
    });

    const rowSubmitted = await ContentPiece.create({
      planId: calendarPlan._id,
      topic: '[DEMO] Founder Story: Why We Built Marketing OS in 2026',
      contentType: 'Reel',
      pipeline: 'reel_b',
      postingDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      needsScript: true,
      needsShoot: true,
      rowStatus: 'submitted',
    });

    const rowDraft = await ContentPiece.create({
      planId: calendarPlan._id,
      topic: '[DEMO] Behind The Scenes: Production Sprint Week 4',
      contentType: 'Graphic',
      pipeline: 'design',
      postingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      rowStatus: 'draft',
    });

    // 8. Create Stage WorkItems with Varied Statuses to Populate ALL Dashboard KPIs
    // A. Completed Stage (Script)
    const stageCompleted = await WorkItem.create({
      title: `[DEMO] Script - ${rowApproved1.topic}`,
      workType: 'Copy',
      contentPieceId: rowApproved1._id,
      stageKey: 'script',
      stageOrder: 1,
      status: 'Published',
      ownerId: writer._id,
      departmentId: contentDept._id,
      profileId: hacaProfile._id,
      deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      estimatedEffortHrs: 4,
      deliverableUrl: 'https://docs.google.com/document/d/demo-script',
      publishedUrl: 'https://instagram.com/p/live-demo',
    });

    // B. In Progress Stage (Graphics / Design)
    const stageInProgress = await WorkItem.create({
      title: `[DEMO] Visual Assets - ${rowApproved2.topic}`,
      workType: 'Carousel',
      contentPieceId: rowApproved2._id,
      stageKey: 'design',
      stageOrder: 1,
      status: 'In Progress',
      ownerId: designer._id,
      departmentId: designDept._id,
      profileId: hacaProfile._id,
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      estimatedEffortHrs: 8,
    });

    // C. Pending Approval Stage (For Creative Head Waiting section)
    const stagePendingApproval = await WorkItem.create({
      title: `[DEMO] Video Edit & Motion - ${rowApproved1.topic}`,
      workType: 'Reel',
      contentPieceId: rowApproved1._id,
      stageKey: 'edit',
      stageOrder: 3,
      status: 'Pending',
      ownerId: editor._id,
      departmentId: videoDept._id,
      profileId: hacaProfile._id,
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      estimatedEffortHrs: 10,
      deliverableUrl: 'https://frame.io/demo-review-cut',
    });

    // D. Blocked Stage (With Active Blocker and SLA timer)
    const stageBlocked = await WorkItem.create({
      title: `[DEMO] Studio Shoot - ${rowApproved1.topic}`,
      workType: 'Reel',
      contentPieceId: rowApproved1._id,
      stageKey: 'shoot',
      stageOrder: 2,
      status: 'Blocked',
      ownerId: shooter._id,
      departmentId: videoDept._id,
      profileId: hacaProfile._id,
      deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      estimatedEffortHrs: 6,
    });

    // Create Blocker record
    const activeBlocker = await Blocker.create({
      workItemId: stageBlocked._id,
      blockedById: shooter._id,
      dependencyOwnerId: writer._id,
      reason: 'Waiting for feedback',
      notes: '[DEMO] Waiting on updated dialogue cards before recording in studio.',
      status: 'Active',
      blockedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
    });

    // E. Overdue Stage
    const stageOverdue = await WorkItem.create({
      title: `[DEMO] Social Copy & Captions - ${rowApproved2.topic}`,
      workType: 'Post',
      contentPieceId: rowApproved2._id,
      stageKey: 'copy',
      stageOrder: 2,
      status: 'In Progress',
      ownerId: writer._id,
      departmentId: contentDept._id,
      profileId: hacaProfile._id,
      deadline: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours overdue!
      estimatedEffortHrs: 3,
    });

    // F. At Risk Stage (Deadline in <24 hours, still Not Started)
    const stageAtRisk = await WorkItem.create({
      title: `[DEMO] Sound Design & Audio Mix - ${rowApproved1.topic}`,
      workType: 'Reel',
      contentPieceId: rowApproved1._id,
      stageKey: 'audio',
      stageOrder: 4,
      status: 'Not Started',
      ownerId: editor._id,
      departmentId: videoDept._id,
      profileId: hacaProfile._id,
      deadline: new Date(Date.now() + 18 * 60 * 60 * 1000),
      estimatedEffortHrs: 5,
    });

    // 9. Feedback & Revision Flag
    await FeedbackEntry.create([
      {
        workItemId: stagePendingApproval._id,
        fromPersonId: creativeHead._id,
        round: 1,
        roundStatus: 'Revision Required',
        text: '[DEMO] Tone of the intro hook needs to be sharper. Please trim the first 3 seconds.',
        isResponse: false,
      },
      {
        workItemId: stagePendingApproval._id,
        fromPersonId: editor._id,
        round: 1,
        roundStatus: 'Revision Required',
        text: '[DEMO] Updated! Trimmed intro and boosted vocal compression.',
        isResponse: true,
      },
    ]);

    // Revision Flag for Excessive Revisions (>48h unclassified)
    await RevisionFlag.create({
      workItemId: stagePendingApproval._id,
      ownerId: editor._id,
      revisionsCount: 4,
      isFlagged: true,
      rootCause: null,
      isEscalated: false,
      flaggedAt: new Date(Date.now() - 52 * 60 * 60 * 1000),
    });

    // 10. Notifications
    await Notification.create([
      {
        recipient: creativeHead._id,
        title: 'Calendar Plan Submitted for Review',
        message: `${calendarPlan.title} submitted by Marcus Vance. 4 items ready for review.`,
        type: 'info',
        link: '/feedback',
        metadata: { isDemo: true, planId: calendarPlan._id },
      },
      {
        recipient: creativeHead._id,
        title: 'Stage Ready for Creative Review',
        message: `${stagePendingApproval.title} has been submitted by Oliver Thorne.`,
        type: 'alert',
        link: `/feedback`,
        metadata: { isDemo: true, workItemId: stagePendingApproval._id },
      },
      {
        recipient: smManager._id,
        title: 'Row Approved: AI Coding Shortcuts',
        message: 'Creative Head approved product reel row. Stage work items unlocked.',
        type: 'info',
        link: '/calendar',
        metadata: { isDemo: true },
      },
      {
        recipient: shooter._id,
        title: 'Blocker Logged',
        message: 'Studio shoot is marked blocked on dialogue cards.',
        type: 'warning',
        link: '/issues',
        metadata: { isDemo: true, blockerId: activeBlocker._id },
      },
    ]);

    // 11. Activity Stream Events
    await ActivityEvent.create([
      {
        profileId: hacaProfile._id,
        actorId: smManager._id,
        action: 'plan.submitted',
        entityType: 'CalendarPlan',
        entityId: calendarPlan._id,
        metadata: { isDemo: true },
      },
      {
        profileId: hacaProfile._id,
        actorId: creativeHead._id,
        action: 'plan.row_approved',
        entityType: 'ContentPiece',
        entityId: rowApproved1._id,
        metadata: { isDemo: true },
      },
      {
        profileId: hacaProfile._id,
        actorId: writer._id,
        action: 'stage.completed',
        entityType: 'WorkItem',
        entityId: stageCompleted._id,
        metadata: { isDemo: true },
      },
      {
        profileId: hacaProfile._id,
        actorId: editor._id,
        action: 'stage.submitted_for_review',
        entityType: 'WorkItem',
        entityId: stagePendingApproval._id,
        metadata: { isDemo: true },
      },
    ]);

    // 12. Ensure and Execute Automation Rules & Reports
    await ensureAutomationRules();
    await AutomationRule.updateMany(
      {},
      {
        $set: {
          lastRunAt: new Date(Date.now() - 30 * 60 * 1000),
          lastRunStatus: 'success',
          lastRunSummary: 'Successfully executed automated check; all SLAs validated.',
        },
      }
    );

    await ensureReportDefinitions();
    // Generate initial live snapshots for all 4 report definitions
    const reportKeys = ['weekly_marketing', 'monthly_scorecard', 'creative_production', 'team_performance'];
    for (const key of reportKeys) {
      try {
        await generateReport(key, {}, adminUser, { sendEmail: false });
        logger.info(`Generated initial demo report snapshot: ${key}`);
      } catch (e) {
        logger.warn({ err: e.message }, `Notice: Demo snapshot generation for ${key}`);
      }
    }

    logger.info('================================================================');
    logger.info('🎉 DEMO DATA SEEDED SUCCESSFULLY FOR ALL 5 CANONICAL ROLES!');
    logger.info('================================================================');
    logger.info('Role Accounts Ready:');
    logger.info(`  👑 System Admin:   ${adminEmail} (password from ADMIN_SEED_PASSWORD)`);
    logger.info(`  🎨 Creative Head:  ${headEmail} (password from DEMO_SEED_PASSWORD)`);
    logger.info(`  📱 SM Manager:     ${smEmail} (password from DEMO_SEED_PASSWORD)`);
    logger.info(`  💼 Executive:      ${execEmail} (password from DEMO_SEED_PASSWORD)`);
    logger.info(`  ✍️ Team Member:    ${writer.email} (password from DEMO_SEED_PASSWORD)`);
    logger.info('\nAll dashboards, calendar plans, trackers, reports, and automations populated with rich data!');

    return {
      success: true,
      users: { adminUser, creativeHead, smManager, executive, workers },
      plan: calendarPlan,
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed demo data');
    throw error;
  } finally {
    if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
      await disconnectDB();
    }
  }
}

// Auto-run if executed directly as entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
