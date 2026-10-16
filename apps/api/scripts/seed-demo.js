import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { Department } from '../src/modules/departments/model.js';
import { Team } from '../src/modules/teams/model.js';
import {
  Platform,
  Priority,
  HoldReason,
  ContentFormat,
  RequestType,
  Settings,
} from '../src/modules/masterData/models.js';
import { CalendarEntry } from '../src/modules/calendar/model.js';
import { Request } from '../src/modules/requests/model.js';
import { ContentItem } from '../src/modules/content/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { Shoot } from '../src/modules/shoots/model.js';
import { Deliverable } from '../src/modules/deliverables/model.js';
import { Comment } from '../src/modules/comments/model.js';
import { TimeEntry } from '../src/modules/time/model.js';
import { StatusHistory } from '../src/modules/statusHistory/model.js';
import { AuditLog } from '../src/modules/audit/model.js';
import { logger } from '../src/lib/logger.js';
import { seedPipelineTemplates } from '../src/modules/pipelines/service.js';

// SAFETY GUARD: Refuse to execute in production environment
if (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') {
  console.error('\n🛑 CRITICAL SAFETY GUARD: seed-demo is strictly prohibited from running in production!');
  process.exit(1);
}

async function seedDemoData() {
  await connectDB();
  logger.info('🚀 Starting realistic Demo Data Seeding for Marketing Portal...');

  try {
    const defaultPassword = 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const sharedPasswordHash = await bcrypt.hash(defaultPassword, salt);
    const adminPasswordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD || 'Admin1212', salt);

    // Clean previous demo-specific records to ensure idempotency
    await Promise.all([
      Request.deleteMany({ requestId: /^DEMO-/ }),
      ContentItem.deleteMany({ contentId: /^DEMO-/ }),
      Task.deleteMany({ taskId: /^DEMO-/ }),
      CalendarEntry.deleteMany({ captionBrief: /Targeting prospective creatives/ }),
      Shoot.deleteMany({ shootId: /^DEMO-/ }),
    ]);

    // 1. Seed or find System Settings
    await Settings.findOneAndUpdate(
      {},
      {
        efficiencyWeights: {
          onTime: 0.4,
          firstPass: 0.3,
          speedVsEstimate: 0.2,
          volumeUtilization: 0.1,
        },
        requestersCanSeeWorkerNames: false,
        requireReasonForHold: true,
        defaultWeeklyCapacityHours: 40,
      },
      { upsert: true, new: true }
    );

    // 2. Seed Master Data (Platforms, Priorities, Hold Reasons, Formats)
    const platformDefs = [
      { name: 'Instagram', slug: 'instagram', isActive: true },
      { name: 'YouTube', slug: 'youtube', isActive: true },
      { name: 'LinkedIn', slug: 'linkedin', isActive: true },
      { name: 'Facebook', slug: 'facebook', isActive: true },
      { name: 'TikTok', slug: 'tiktok', isActive: true },
      { name: 'Website / Blog', slug: 'website', isActive: true },
    ];
    for (const p of platformDefs) {
      await Platform.findOneAndUpdate({ slug: p.slug }, p, { upsert: true });
    }

    const priorityDefs = [
      { name: 'Urgent', level: 1, color: '#D1686D', slaHours: 24, isActive: true },
      { name: 'High', level: 2, color: '#E9D96B', slaHours: 48, isActive: true },
      { name: 'Medium', level: 3, color: '#8CA4D2', slaHours: 72, isActive: true },
      { name: 'Low', level: 4, color: '#9AA8A6', slaHours: 120, isActive: true },
    ];
    for (const p of priorityDefs) {
      await Priority.findOneAndUpdate({ name: p.name }, p, { upsert: true });
    }

    const holdDefs = [
      { code: 'waiting_for_content', label: 'Waiting for Content', description: 'Raw copy or assets pending', isActive: true },
      { code: 'approval_delay', label: 'Approval Delay', description: 'Pending lead or dept sign-off', isActive: true },
      { code: 'resource_shortage', label: 'Resource Shortage', description: 'Capacity committed to urgent items', isActive: true },
      { code: 'client_feedback', label: 'Client Feedback', description: 'Awaiting client/external feedback', isActive: true },
      { code: 'equipment', label: 'Equipment Availability', description: 'Cameras, lenses, studio in use', isActive: true },
      { code: 'weather', label: 'Weather Delay', description: 'Outdoor shoot delayed', isActive: true },
      { code: 'other', label: 'Other Blockers', description: 'General operational delay', isActive: true },
    ];
    for (const h of holdDefs) {
      await HoldReason.findOneAndUpdate({ code: h.code }, h, { upsert: true });
    }

    const formatDefs = [
      { name: 'Static post or poster', leadTimeDays: 3, defaultPlatforms: ['Instagram', 'LinkedIn'] },
      { name: 'Carousel', leadTimeDays: 4, defaultPlatforms: ['Instagram', 'LinkedIn'] },
      { name: 'Story', leadTimeDays: 2, defaultPlatforms: ['Instagram', 'Facebook'] },
      { name: 'Reel or video', leadTimeDays: 7, defaultPlatforms: ['Instagram', 'YouTube', 'TikTok'] },
      { name: 'Ad creative', leadTimeDays: 4, defaultPlatforms: ['Facebook', 'Instagram'] },
      { name: 'Brochure or sales material', leadTimeDays: 5, defaultPlatforms: ['LinkedIn', 'Website / Blog'] },
      { name: 'Academic or webinar creative', leadTimeDays: 4, defaultPlatforms: ['LinkedIn', 'Website / Blog'] },
    ];
    for (const f of formatDefs) {
      await ContentFormat.findOneAndUpdate({ name: f.name }, f, { upsert: true });
    }

    await seedPipelineTemplates();

    // 3. Seed Departments
    const deptList = [
      { name: 'Social Media', type: 'social_media', description: 'Social Media Marketing' },
      { name: 'Performance', type: 'performance', description: 'Paid Ads & Conversions' },
      { name: 'Sales', type: 'sales', description: 'Sales & Business Development' },
      { name: 'Academics', type: 'academics', description: 'Academics & Research' },
    ];
    const depts = {};
    for (const d of deptList) {
      depts[d.name] = await Department.findOneAndUpdate({ name: d.name }, d, { upsert: true, new: true });
    }

    // 4. Seed Production Teams
    const teamList = [
      { name: 'content', displayName: 'Content & Copywriting', description: 'Copywriting, script outlines, and briefs' },
      { name: 'graphics', displayName: 'Graphic Design', description: 'Posters, carousels, ad creatives, thumbnails' },
      { name: 'cinematography', displayName: 'Cinematography', description: 'Video footage, b-roll, studio lighting' },
      { name: 'editor', displayName: 'Video Editing', description: 'Rough cuts, sound design, color grading' },
    ];
    const teams = {};
    for (const t of teamList) {
      teams[t.name] = await Team.findOneAndUpdate({ name: t.name }, t, { upsert: true, new: true });
    }

    // 5. Seed Core Role Users
    const usersToSeed = [
      {
        name: 'Alex Admin',
        email: 'admin@marketingportal.com',
        role: 'admin',
        passwordHash: adminPasswordHash,
        status: 'active',
      },
      {
        name: 'Sarah Jenkins',
        email: 'sarah.lead@marketingportal.com',
        role: 'lead',
        passwordHash: sharedPasswordHash,
        status: 'active',
        capacity: 40,
      },
      {
        name: 'Rachel Adams',
        email: 'rachel.sm@marketingportal.com',
        role: 'sm_manager',
        department: 'Social Media',
        passwordHash: sharedPasswordHash,
        status: 'active',
      },
      {
        name: 'Chloe Bennett',
        email: 'chloe.writer@marketingportal.com',
        role: 'worker',
        team: 'content',
        teamId: 'content',
        skills: ['Scriptwriting', 'Social Copy', 'Headlines'],
        passwordHash: sharedPasswordHash,
        status: 'active',
        capacity: 40,
        weeklyCapacityHours: 40,
      },
      {
        name: 'Leo Sterling',
        email: 'leo.graphics@marketingportal.com',
        role: 'worker',
        team: 'graphics',
        teamId: 'graphics',
        skills: ['Carousel Design', 'Typography', 'Figma', 'Photoshop'],
        passwordHash: sharedPasswordHash,
        status: 'active',
        capacity: 40,
        weeklyCapacityHours: 40,
      },
      {
        name: 'Ethan Hunt',
        email: 'ethan.cinema@marketingportal.com',
        role: 'worker',
        team: 'cinematography',
        teamId: 'cinematography',
        skills: ['Camera Operator', 'Lighting', 'Audio Engineering', 'Drones'],
        passwordHash: sharedPasswordHash,
        status: 'active',
        capacity: 40,
        weeklyCapacityHours: 40,
      },
      {
        name: 'Lucas Rivera',
        email: 'lucas.editor@marketingportal.com',
        role: 'worker',
        team: 'editor',
        teamId: 'editor',
        skills: ['Premiere Pro', 'DaVinci Resolve', 'Sound Design', 'Reels Editing'],
        passwordHash: sharedPasswordHash,
        status: 'active',
        capacity: 40,
        weeklyCapacityHours: 40,
      },
      {
        name: 'David Vance',
        email: 'david.perf@marketingportal.com',
        role: 'dept_lead',
        department: 'Performance',
        passwordHash: sharedPasswordHash,
        status: 'active',
      },
      {
        name: 'Victoria Stone',
        email: 'victoria.sales@marketingportal.com',
        role: 'dept_lead',
        department: 'Sales',
        passwordHash: sharedPasswordHash,
        status: 'active',
      },
      {
        name: 'Arthur Pendelton',
        email: 'arthur.acad@marketingportal.com',
        role: 'dept_lead',
        department: 'Academics',
        passwordHash: sharedPasswordHash,
        status: 'active',
      },
      {
        name: 'Hannah Abbott',
        email: 'hannah.staff@marketingportal.com',
        role: 'dept_staff',
        department: 'Sales',
        passwordHash: sharedPasswordHash,
        status: 'active',
      },
    ];

    const users = {};
    for (const u of usersToSeed) {
      users[u.email] = await User.findOneAndUpdate({ email: u.email }, u, { upsert: true, new: true });
    }

    // 6. Seed a Full Month of Calendar Entries (Past 15 days to Future 15 days)
    logger.info('📅 Seeding 30-day Social Media Calendar Entries...');
    const now = new Date();
    const calendarEntries = [];
    const platformsArr = ['instagram', 'youtube', 'linkedin', 'facebook'];
    const formatsArr = ['Reel or video', 'Carousel', 'Static post or poster', 'Story'];
    const themesArr = [
      'Student Spotlight & Campus Tour',
      'Behind the Scenes: Film Lab',
      'Alumni Career Milestones',
      'Q4 Masterclass Announcement',
      'Faculty Insights & Research',
      'Weekly Industry Trends Roundup',
      'Interactive Student Q&A',
      'Weekend Creative Inspiration',
    ];

    for (let dayOffset = -15; dayOffset <= 14; dayOffset++) {
      const entryDate = new Date(now.getTime() + dayOffset * 86400000);
      entryDate.setHours(10, 0, 0, 0);

      const isPast = dayOffset < 0;
      const status = isPast ? 'converted' : dayOffset <= 3 ? 'approved' : 'draft';

      const entry = await CalendarEntry.create({
        date: entryDate,
        platform: platformsArr[Math.abs(dayOffset) % platformsArr.length],
        format: formatsArr[Math.abs(dayOffset) % formatsArr.length],
        theme: themesArr[Math.abs(dayOffset) % themesArr.length],
        captionBrief: `Targeting prospective creatives. Highlight community value and upcoming registration dates.`,
        contentPillar: dayOffset % 2 === 0 ? 'Brand Awareness' : 'Academics & Life',
        owner: users['rachel.sm@marketingportal.com']._id,
        status,
      });
      calendarEntries.push(entry);
    }

    // 7. Seed Requests in EVERY status
    logger.info('📥 Seeding Requests in every lifecycle status...');
    const requestStatuses = ['submitted', 'under_triage', 'accepted', 'rejected', 'needs_info', 'converted'];
    const requests = [];

    for (let i = 0; i < requestStatuses.length; i++) {
      const reqStatus = requestStatuses[i];
      const reqDoc = await Request.create({
        requestId: `DEMO-REQ-2026-000${i + 1}`,
        title: `Demo Request: ${reqStatus.replace('_', ' ').toUpperCase()} Marketing Asset`,
        sourceDepartment: i % 2 === 0 ? 'Sales' : 'Performance',
        requester: users['hannah.staff@marketingportal.com']._id,
        requestTypeName: 'Marketing Creative Request',
        dynamicFields: {
          objective: 'Generate customer interest and qualified leads',
          channel: 'Omnichannel promotion',
        },
        priority: i === 0 ? 'urgent' : i === 1 ? 'high' : 'medium',
        deadline: new Date(now.getTime() + (i + 4) * 86400000),
        status: reqStatus,
        triage: ['accepted', 'rejected', 'needs_info', 'converted'].includes(reqStatus)
          ? {
              decision: reqStatus === 'converted' ? 'accepted' : reqStatus,
              decidedBy: users['sarah.lead@marketingportal.com']._id,
              decidedAt: new Date(),
              reason:
                reqStatus === 'rejected'
                  ? 'Duplicate of existing campaign asset.'
                  : reqStatus === 'needs_info'
                  ? 'Need high-res brand logos.'
                  : undefined,
            }
          : undefined,
      });

      await StatusHistory.create({
        entityType: 'Request',
        entityId: reqDoc._id,
        fromStatus: 'draft',
        toStatus: reqStatus,
        changedBy: users['sarah.lead@marketingportal.com']._id,
        reason: `Status transitioned to ${reqStatus}`,
        timestamp: new Date(now.getTime() - (10 - i) * 86400000),
      });

      requests.push(reqDoc);
    }

    // 8. Seed Content Items in EVERY pipeline stage
    logger.info('🎨 Seeding Content Items across all pipeline stages...');
    const pipelineStages = [
      'planned',
      'brief_ready',
      'in_production',
      'in_review',
      'changes_requested',
      'approved',
      'scheduled',
      'published',
      'live',
    ];

    const contentItems = [];
    for (let i = 0; i < pipelineStages.length; i++) {
      const stage = pipelineStages[i];
      const isPublished = stage === 'published' || stage === 'live';
      const isLive = stage === 'live';

      const content = await ContentItem.create({
        contentId: `DEMO-CNT-2026-000${i + 1}`,
        title: `Demo Deliverable: Stage [${stage.replace('_', ' ').toUpperCase()}] Showcase`,
        format: i % 3 === 0 ? 'reel' : i % 3 === 1 ? 'carousel' : 'ad_creative',
        sourceDepartment: depts['Social Media']._id,
        requester: users['rachel.sm@marketingportal.com']._id,
        pillar: 'Campus Culture & Highlights',
        platforms: ['Instagram', 'YouTube'],
        publishDate: isPublished ? new Date(now.getTime() - 2 * 86400000) : new Date(now.getTime() + 6 * 86400000),
        productionDeadline: isPublished ? new Date(now.getTime() - 5 * 86400000) : new Date(now.getTime() + 2 * 86400000),
        status: stage,
        priority: i === 2 ? 'urgent' : i === 3 ? 'high' : 'medium',
        publishedUrl: isPublished ? 'https://instagram.com/p/demo_post_123' : undefined,
        performanceStatus: isLive ? 'live' : undefined,
        liveUrl: isLive ? 'https://adsmanager.facebook.com/campaigns/demo-ad' : undefined,
        metrics: isPublished ? {
          views: 14200,
          likes: 1250,
          comments: 88,
          shares: 215,
        } : undefined,
      });

      // Link historical transitions
      await StatusHistory.create({
        entityType: 'ContentItem',
        entityId: content._id,
        fromStatus: 'planned',
        toStatus: stage,
        changedBy: users['sarah.lead@marketingportal.com']._id,
        reason: `Progressed to ${stage}`,
        timestamp: new Date(now.getTime() - (pipelineStages.length - i) * 86400000),
      });

      contentItems.push(content);
    }

    // 9. Seed Connected Tasks with Assignees, Time Entries, and Deliverables
    logger.info('🛠️ Seeding Tasks, Timesheets, and Deliverables...');
    const inProdItem = contentItems[2]; // in_production
    const inReviewItem = contentItems[3]; // in_review
    const changesReqItem = contentItems[4]; // changes_requested
    const approvedItem = contentItems[5]; // approved

    // Task 1: Script (Done)
    const t1 = await Task.create({
      taskId: 'DEMO-TSK-2026-0001',
      contentItemId: inProdItem._id,
      stageKey: 'script',
      title: 'Script & Storyboard Drafting',
      team: 'content',
      assignee: users['chloe.writer@marketingportal.com']._id,
      dueDate: new Date(now.getTime() - 2 * 86400000),
      status: 'done',
      estimateHours: 6,
      actualHours: 5,
    });

    // Task 2: Shoot (In Progress)
    const t2 = await Task.create({
      taskId: 'DEMO-TSK-2026-0002',
      contentItemId: inProdItem._id,
      stageKey: 'shoot',
      title: 'Main Camera Production Shoot',
      team: 'cinematography',
      assignee: users['ethan.cinema@marketingportal.com']._id,
      dueDate: new Date(now.getTime() + 2 * 86400000),
      status: 'in_progress',
      estimateHours: 8,
      dependencies: [t1._id],
    });

    // Task 3: Edit (In Review with Deliverable v1)
    const t3 = await Task.create({
      taskId: 'DEMO-TSK-2026-0003',
      contentItemId: inReviewItem._id,
      stageKey: 'edit',
      title: 'Video Edit & Color Grading Cut',
      team: 'editor',
      assignee: users['lucas.editor@marketingportal.com']._id,
      dueDate: new Date(now.getTime() + 1 * 86400000),
      status: 'submitted',
      estimateHours: 12,
      actualHours: 10,
    });

    const d1 = await Deliverable.create({
      taskId: t3._id,
      contentItemId: inReviewItem._id,
      version: 1,
      type: 'video',
      fileUrl: 'https://res.cloudinary.com/demo/video/upload/sample.mp4',
      status: 'submitted',
      uploadedBy: users['lucas.editor@marketingportal.com']._id,
      notes: 'Initial high-res cut complete. Awaiting Lead review.',
    });

    // Task 4: Graphics (Changes Requested with Deliverable v1 + Timestamped Comments)
    const t4 = await Task.create({
      taskId: 'DEMO-TSK-2026-0004',
      contentItemId: changesReqItem._id,
      stageKey: 'graphics',
      title: 'Carousel Asset Design',
      team: 'graphics',
      assignee: users['leo.graphics@marketingportal.com']._id,
      dueDate: new Date(now.getTime() - 1 * 86400000),
      status: 'changes_requested',
      revisionCount: 1,
      estimateHours: 8,
      actualHours: 7,
    });

    const d2 = await Deliverable.create({
      taskId: t4._id,
      contentItemId: changesReqItem._id,
      version: 1,
      type: 'image',
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      status: 'changes_requested',
      uploadedBy: users['leo.graphics@marketingportal.com']._id,
      decidedBy: users['sarah.lead@marketingportal.com']._id,
      decidedAt: new Date(now.getTime() - 4 * 3600000),
    });

    await Comment.create({
      entityType: 'deliverable',
      entityId: d2._id,
      author: users['sarah.lead@marketingportal.com']._id,
      text: 'Please adjust slide 3 contrast and update the CTA button alignment to match our 2026 branding.',
      mediaTimestamp: 12,
    });

    // 10. Seed Shoots in Shoot Planner (Scheduled, Done, Reshoot)
    logger.info('🎬 Seeding Shoot Planner records...');
    await Shoot.create([
      {
        shootId: 'DEMO-SHT-2026-0001',
        title: 'Studio Portrait & Soundstage Session',
        date: new Date(now.getTime() + 3 * 86400000),
        location: 'Studio Stage B',
        crew: [users['ethan.cinema@marketingportal.com']._id],
        equipment: ['Sony FX6', 'Aputure 600d', 'Sennheiser MKH416'],
        talent: ['Student Ambassador Marcus', 'Dean Elena'],
        contentItems: [inProdItem._id],
        status: 'scheduled',
        notes: 'Three wardrobe changes scheduled.',
      },
      {
        shootId: 'DEMO-SHT-2026-0002',
        title: 'Campus Quad B-Roll & Aerial Drone Run',
        date: new Date(now.getTime() - 4 * 86400000),
        location: 'North Campus Quad',
        crew: [users['ethan.cinema@marketingportal.com']._id],
        equipment: ['DJI Inspire 3', 'Sony A7SIII'],
        contentItems: [inReviewItem._id],
        status: 'done',
        footageUrl: 'https://storage.googleapis.com/demo-footage/quad_broll_raw.zip',
        notes: 'Footage offloaded to SAN server and released to Editor queue.',
      },
    ]);

    // 11. Seed Worker Time Entries
    logger.info('⏱️ Seeding Timesheet Entries...');
    await TimeEntry.create([
      {
        taskId: t1._id,
        userId: users['chloe.writer@marketingportal.com']._id,
        date: new Date(now.getTime() - 3 * 86400000),
        minutes: 300,
        note: 'Completed script research and dialogue outline',
        status: 'approved',
        approvedBy: users['sarah.lead@marketingportal.com']._id,
      },
      {
        taskId: t3._id,
        userId: users['lucas.editor@marketingportal.com']._id,
        date: new Date(now.getTime() - 1 * 86400000),
        minutes: 480,
        note: 'Rough cut assembly and audio mastering',
        status: 'submitted',
      },
      {
        taskId: t4._id,
        userId: users['leo.graphics@marketingportal.com']._id,
        date: new Date(),
        minutes: 240,
        note: 'Addressing revisions on slide 3 CTA buttons',
        status: 'draft',
      },
    ]);

    // 12. Seed Audit Log entries
    logger.info('📜 Seeding Audit Logs...');
    await AuditLog.create([
      {
        actor: users['admin@marketingportal.com']._id,
        action: 'user.create',
        entity: 'User',
        entityId: users['sarah.lead@marketingportal.com']._id,
        after: { role: 'lead', name: 'Sarah Jenkins' },
        timestamp: new Date(now.getTime() - 30 * 86400000),
      },
      {
        actor: users['sarah.lead@marketingportal.com']._id,
        action: 'content.status_change',
        entity: 'ContentItem',
        entityId: approvedItem._id,
        before: { status: 'in_review' },
        after: { status: 'approved' },
        timestamp: new Date(now.getTime() - 2 * 86400000),
      },
    ]);

    logger.info('✨ Demo data seeding complete! All dashboards and analytics now have rich, realistic data.');
    logger.info(`Credentials for demo users: Password: "${defaultPassword}" (Admin: "${env.ADMIN_SEED_PASSWORD || 'Admin1212'}")`);
    logger.info(' - Admin: admin@marketingportal.com');
    logger.info(' - Marketing Lead: sarah.lead@marketingportal.com');
    logger.info(' - Social Media Manager: rachel.sm@marketingportal.com');
    logger.info(' - Copywriter: chloe.writer@marketingportal.com');
    logger.info(' - Graphic Designer: leo.graphics@marketingportal.com');
    logger.info(' - Cinematographer: ethan.cinema@marketingportal.com');
    logger.info(' - Video Editor: lucas.editor@marketingportal.com');
    logger.info(' - Sales Dept Lead: victoria.sales@marketingportal.com');
    logger.info(' - Performance Dept Lead: david.perf@marketingportal.com');
    logger.info(' - Sales Staff Requester: hannah.staff@marketingportal.com');

  } catch (err) {
    logger.error({ err }, 'Failed to seed demo data');
    throw err;
  } finally {
    await disconnectDB();
  }
}

// Auto-run when executed directly from CLI
if (process.argv[1]?.endsWith('seed-demo.js')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedDemoData };
