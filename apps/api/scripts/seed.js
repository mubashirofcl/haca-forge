import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import { AuditLog } from '../src/modules/audit/model.js';
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
import { Request } from '../src/modules/requests/model.js';
import { ContentItem } from '../src/modules/content/model.js';
import { Task } from '../src/modules/tasks/model.js';
import { Shoot } from '../src/modules/shoots/model.js';
import { Deliverable } from '../src/modules/deliverables/model.js';
import { Counter } from '../src/modules/requests/counter.model.js';
import { seedPipelineTemplates } from '../src/modules/pipelines/service.js';
import { logger } from '../src/lib/logger.js';

// Enforce reproducible generation
faker.seed(42);

async function seed() {
  if (env.NODE_ENV === 'production') {
    logger.error('CRITICAL: Seeding is strictly forbidden in production environment!');
    process.exit(1);
  }

  await connectDB();
  logger.info('🌱 Starting comprehensive database seed for Marketing Portal...');

  try {
    // ----------------------------------------------------
    // 1. Clean existing records for idempotent re-seed
    // ----------------------------------------------------
    logger.info('🧹 Cleaning existing collections...');
    await Promise.all([
      User.deleteMany({}),
      AccessRequest.deleteMany({}),
      AuditLog.deleteMany({}),
      Department.deleteMany({}),
      Team.deleteMany({}),
      Platform.deleteMany({}),
      Priority.deleteMany({}),
      HoldReason.deleteMany({}),
      ContentFormat.deleteMany({}),
      RequestType.deleteMany({}),
      Settings.deleteMany({}),
      Request.deleteMany({}),
      ContentItem.deleteMany({}),
      Task.deleteMany({}),
      Shoot.deleteMany({}),
      Deliverable.deleteMany({}),
      Counter.deleteMany({}),
    ]);

    const defaultPassword = 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const sharedPasswordHash = await bcrypt.hash(defaultPassword, salt);
    const adminPasswordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD || 'Admin1212', salt);

    // ----------------------------------------------------
    // 2. Seed System Settings
    // ----------------------------------------------------
    logger.info('⚙️ Seeding system settings...');
    await Settings.create({
      efficiencyWeights: {
        onTime: 0.4,
        firstPass: 0.3,
        speedVsEstimate: 0.2,
        volumeUtilization: 0.1,
      },
      requestersCanSeeWorkerNames: false,
      requireReasonForHold: true,
      defaultWeeklyCapacityHours: 40,
    });

    // ----------------------------------------------------
    // 3. Seed Master Data: Platforms, Priorities, Hold Reasons, Formats
    // ----------------------------------------------------
    logger.info('🏷️ Seeding master data collections...');
    const platforms = await Platform.insertMany([
      { name: 'YouTube', slug: 'youtube', isActive: true },
      { name: 'Instagram', slug: 'instagram', isActive: true },
      { name: 'Facebook', slug: 'facebook', isActive: true },
      { name: 'LinkedIn', slug: 'linkedin', isActive: true },
      { name: 'X / Twitter', slug: 'x_twitter', isActive: true },
      { name: 'Website / Blog', slug: 'website', isActive: true },
    ]);

    await Priority.insertMany([
      { name: 'Urgent', level: 1, color: '#D1686D', slaHours: 24, isActive: true },
      { name: 'High', level: 2, color: '#E9D96B', slaHours: 48, isActive: true },
      { name: 'Medium', level: 3, color: '#8CA4D2', slaHours: 72, isActive: true },
      { name: 'Low', level: 4, color: '#9AA8A6', slaHours: 120, isActive: true },
    ]);

    await HoldReason.insertMany([
      { code: 'waiting_for_content', label: 'Waiting for Content', description: 'Raw copy, scripts, or assets pending from requester', isActive: true },
      { code: 'approval_delay', label: 'Approval Delay', description: 'Pending lead or department review sign-off', isActive: true },
      { code: 'resource_shortage', label: 'Resource Shortage', description: 'Team bandwidth currently committed to urgent priorities', isActive: true },
      { code: 'client_feedback', label: 'Client Feedback', description: 'Awaiting feedback from external partner or client', isActive: true },
      { code: 'equipment', label: 'Equipment Availability', description: 'Cameras, lenses, studio spaces, or render nodes in use', isActive: true },
      { code: 'weather', label: 'Weather Delay', description: 'Outdoor shoot delayed by adverse environmental conditions', isActive: true },
      { code: 'other', label: 'Other Blockers', description: 'Miscellaneous operational block documented in notes', isActive: true },
    ]);

    const formats = await ContentFormat.insertMany([
      {
        name: 'Static Post or Poster',
        leadTimeDays: 3,
        defaultPlatforms: ['Instagram', 'LinkedIn', 'Facebook'],
        description: 'Single image promotional post, event banner, or social quote.',
        isActive: true,
      },
      {
        name: 'Carousel Post',
        leadTimeDays: 4,
        defaultPlatforms: ['Instagram', 'LinkedIn'],
        description: 'Multi-slide educational or feature carousel breakdown (5-10 slides).',
        isActive: true,
      },
      {
        name: 'Story / Reel Teaser',
        leadTimeDays: 2,
        defaultPlatforms: ['Instagram', 'Facebook'],
        description: 'Ephemeral 15-second vertical update or interactive poll.',
        isActive: true,
      },
      {
        name: 'Reel or Video Clip',
        leadTimeDays: 7,
        defaultPlatforms: ['Instagram', 'YouTube', 'LinkedIn'],
        description: 'Fully scripted, recorded, and edited video cut with captions.',
        isActive: true,
      },
      {
        name: 'Ad Creative Variant',
        leadTimeDays: 4,
        defaultPlatforms: ['Facebook', 'Instagram', 'YouTube'],
        description: 'Performance ad creative with A/B variant hooks and call-to-actions.',
        isActive: true,
      },
      {
        name: 'Brochure or Sales Deck',
        leadTimeDays: 5,
        defaultPlatforms: ['Website / Blog'],
        description: 'PDF collateral, pitch sheet, product catalog, or customer handout.',
        isActive: true,
      },
      {
        name: 'Academic or Webinar Creative',
        leadTimeDays: 4,
        defaultPlatforms: ['LinkedIn', 'Website / Blog', 'YouTube'],
        description: 'Webinar deck, speaker poster, course spotlight, and registration assets.',
        isActive: true,
      },
    ]);

    // ----------------------------------------------------
    // 4. Seed Request Types per Department with Dynamic Field Schemas
    // ----------------------------------------------------
    logger.info('📋 Seeding department request types and dynamic field schemas...');
    await RequestType.insertMany([
      {
        name: 'Social Media Campaign Post',
        departmentType: 'social_media',
        fieldSchema: [
          {
            fieldKey: 'targetPlatforms',
            label: 'Target Platforms',
            type: 'multiselect',
            required: true,
            options: ['Instagram', 'LinkedIn', 'Facebook', 'YouTube', 'X / Twitter'],
          },
          {
            fieldKey: 'postFormat',
            label: 'Recommended Format',
            type: 'select',
            required: true,
            options: ['Static Post', 'Carousel (5-10 slides)', 'Reel / Short Video', 'Story Teaser'],
          },
          {
            fieldKey: 'captionHook',
            label: 'Opening Hook & Angle',
            type: 'textarea',
            required: true,
            placeholder: 'What is the attention-grabbing opening line or thought?',
          },
          {
            fieldKey: 'suggestedHashtags',
            label: 'Suggested Tags & Keywords',
            type: 'text',
            required: false,
            placeholder: '#Marketing #Growth #Design',
          },
          {
            fieldKey: 'callToAction',
            label: 'Primary Call to Action',
            type: 'text',
            required: true,
            placeholder: 'Link in bio / Comment below / Register today',
          },
        ],
        isActive: true,
      },
      {
        name: 'Performance Ad Campaign Creative',
        departmentType: 'performance',
        fieldSchema: [
          {
            fieldKey: 'campaignObjective',
            label: 'Campaign Objective',
            type: 'select',
            required: true,
            options: ['Lead Generation', 'Direct Conversions / Sales', 'Brand Awareness', 'App Installs'],
          },
          {
            fieldKey: 'targetAudience',
            label: 'Audience Persona & Demographics',
            type: 'textarea',
            required: true,
            placeholder: 'e.g., Marketing Managers, 25-45, Urban Tech Executives',
          },
          {
            fieldKey: 'targetCPA',
            label: 'Target CPA Goal ($)',
            type: 'number',
            required: false,
            placeholder: '45',
          },
          {
            fieldKey: 'adDimensions',
            label: 'Required Dimensions',
            type: 'select',
            required: true,
            options: ['1080x1080 (Square 1:1)', '1080x1920 (Vertical 9:16)', '1200x628 (Landscape 16:9)', 'All Dimensions Pack'],
          },
          {
            fieldKey: 'landingPageUrl',
            label: 'Landing Page URL',
            type: 'url',
            required: true,
            placeholder: 'https://example.com/landing-page',
          },
        ],
        isActive: true,
      },
      {
        name: 'Sales Collateral & Product One-Pager',
        departmentType: 'sales',
        fieldSchema: [
          {
            fieldKey: 'productServiceLine',
            label: 'Product or Service Line',
            type: 'select',
            required: true,
            options: ['Enterprise Suite', 'Professional Plan', 'Custom Consulting', 'Event Sponsorship'],
          },
          {
            fieldKey: 'clientIndustry',
            label: 'Client Industry Segment',
            type: 'text',
            required: true,
            placeholder: 'Fintech, Healthcare, Retail, SaaS...',
          },
          {
            fieldKey: 'coreValueProps',
            label: 'Top 3 Value Propositions',
            type: 'textarea',
            required: true,
            placeholder: '1. 40% cost reduction\n2. Real-time synchronization\n3. Dedicated 24/7 support',
          },
          {
            fieldKey: 'collateralFormat',
            label: 'Deliverable Type',
            type: 'select',
            required: true,
            options: ['2-Page PDF Brochure', 'Pitch Deck Presentation (10-15 slides)', 'Printable Rollup Banner', 'Case Study PDF'],
          },
        ],
        isActive: true,
      },
      {
        name: 'Academic Webinar & Course Promotion',
        departmentType: 'academics',
        fieldSchema: [
          {
            fieldKey: 'courseOrTopic',
            label: 'Course or Webinar Title',
            type: 'text',
            required: true,
            placeholder: 'Advanced Generative AI Masterclass',
          },
          {
            fieldKey: 'speakerName',
            label: 'Featured Speaker / Professor',
            type: 'text',
            required: true,
            placeholder: 'Dr. Sarah Mitchell, Lead AI Researcher',
          },
          {
            fieldKey: 'sessionDateTime',
            label: 'Live Broadcast Date & Time',
            type: 'date',
            required: true,
          },
          {
            fieldKey: 'registrationUrl',
            label: 'Registration Page URL',
            type: 'url',
            required: true,
            placeholder: 'https://example.com/webinar/register',
          },
          {
            fieldKey: 'keyTakeaways',
            label: 'Key Takeaways (Bullet points)',
            type: 'textarea',
            required: true,
            placeholder: 'Students will learn prompt engineering, fine-tuning, and multi-agent coordination.',
          },
        ],
        isActive: true,
      },
      {
        name: 'General Marketing Creative Request',
        departmentType: 'other',
        fieldSchema: [
          {
            fieldKey: 'scopeSummary',
            label: 'Brief Project Summary',
            type: 'textarea',
            required: true,
            placeholder: 'Please provide a clear description of the marketing assets needed.',
          },
          {
            fieldKey: 'urgencyReason',
            label: 'Reason for Urgency / Milestone',
            type: 'text',
            required: false,
            placeholder: 'e.g., Upcoming CEO keynote on Friday',
          },
          {
            fieldKey: 'deliverableCount',
            label: 'Number of Asset Variants Needed',
            type: 'number',
            required: true,
            placeholder: '3',
          },
        ],
        isActive: true,
      },
    ]);

    // ----------------------------------------------------
    // 5. Seed Core Departments
    // ----------------------------------------------------
    logger.info('🏢 Seeding organizational departments...');
    const departments = await Department.insertMany([
      {
        name: 'Social Media Marketing',
        type: 'social_media',
        description: 'Manages multi-channel social organic reach, content calendars, community engagement, and brand narrative.',
        isActive: true,
      },
      {
        name: 'Performance & Paid Media',
        type: 'performance',
        description: 'Drives customer acquisition through paid campaigns on Meta, Google, LinkedIn, and programmatic channels.',
        isActive: true,
      },
      {
        name: 'Sales & Business Development',
        type: 'sales',
        description: 'Commercial sales organization requiring pitch decks, battlecards, product brochures, and lead collateral.',
        isActive: true,
      },
      {
        name: 'Academic Affairs & Research',
        type: 'academics',
        description: 'Produces academic courses, faculty webinars, educational whitepapers, and certifications.',
        isActive: true,
      },
      {
        name: 'Corporate Communications & Events',
        type: 'other',
        description: 'Internal communications, town halls, press releases, and global brand sponsorships.',
        isActive: true,
      },
    ]);

    // ----------------------------------------------------
    // 6. Seed Production Teams
    // ----------------------------------------------------
    logger.info('👥 Seeding production delivery teams...');
    const teams = await Team.insertMany([
      {
        name: 'content',
        displayName: 'Content & Copywriting',
        description: 'Scripts, ad copy, research, editorial articles, and social hooks.',
        defaultWeeklyCapacity: 40,
        members: [],
      },
      {
        name: 'graphics',
        displayName: 'Graphics & Visual Design',
        description: 'Posters, social carousels, display ads, infographics, and corporate branding.',
        defaultWeeklyCapacity: 40,
        members: [],
      },
      {
        name: 'cinematography',
        displayName: 'Cinematography & Shoots',
        description: 'Video recording, studio setups, live event cameras, lighting, and audio captures.',
        defaultWeeklyCapacity: 40,
        members: [],
      },
      {
        name: 'editor',
        displayName: 'Video Editing & Motion Design',
        description: 'Cutting, color grading, visual effects, reels, sound mixing, and exports.',
        defaultWeeklyCapacity: 40,
        members: [],
      },
    ]);

    // ----------------------------------------------------
    // 7. Seed Real Users Across Roles and Teams
    // ----------------------------------------------------
    logger.info('👤 Seeding user accounts across all 8 roles...');

    // 7.1 Admin Account
    const adminUser = await User.create({
      name: 'System Administrator',
      email: (env.ADMIN_SEED_EMAIL || 'admin@marketingportal.com').toLowerCase().trim(),
      passwordHash: adminPasswordHash,
      role: 'admin',
      department: 'Marketing Leadership',
      status: 'active',
      capacity: 40,
      attendance: 'present',
      mustSetPassword: false,
    });

    // 7.2 Marketing Leads
    const leadSarah = await User.create({
      name: 'Sarah Mitchell',
      email: 'sarah.lead@marketingportal.com',
      passwordHash: sharedPasswordHash,
      role: 'lead',
      department: 'Marketing Leadership',
      status: 'active',
      capacity: 40,
      attendance: 'present',
      skills: ['Creative Direction', 'Pipeline Strategy', 'Resource Allocation', 'Budget Management'],
      mustSetPassword: false,
    });

    const leadMarcus = await User.create({
      name: 'Marcus Vance',
      email: 'marcus.lead@marketingportal.com',
      passwordHash: sharedPasswordHash,
      role: 'lead',
      department: 'Marketing Leadership',
      status: 'active',
      capacity: 40,
      attendance: 'present',
      skills: ['Video Operations', 'Triage Review', 'Campaign Strategy'],
      mustSetPassword: false,
    });

    // 7.3 Team Leads
    const teamLeads = await Promise.all([
      User.create({
        name: 'David Reynolds',
        email: 'david.content@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'team_lead',
        teamId: 'content',
        department: 'Content & Copywriting',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Copywriting', 'SEO', 'Scriptwriting', 'Messaging Strategy'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Elena Rostova',
        email: 'elena.graphics@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'team_lead',
        teamId: 'graphics',
        department: 'Graphics & Visual Design',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Art Direction', 'Figma', 'Photoshop', 'Brand Systems'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Kai Takahashi',
        email: 'kai.cinema@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'team_lead',
        teamId: 'cinematography',
        department: 'Cinematography & Shoots',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Camera Operation', 'Lighting Design', 'Sound Capture', 'Studio Setup'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Oliver Thorne',
        email: 'oliver.editor@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'team_lead',
        teamId: 'editor',
        department: 'Video Editing & Motion Design',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Sound Design'],
        mustSetPassword: false,
      }),
    ]);

    // 7.4 Production Workers (5-6 per team with realistic skills & attendance)
    const workerDefs = [
      // Content Workers
      { name: 'Chloe Bennett', email: 'chloe.b@marketingportal.com', teamId: 'content', skills: ['Social Copy', 'Captions', 'Hooks'], capacity: 40, attendance: 'present' },
      { name: 'Liam O\'Connor', email: 'liam.o@marketingportal.com', teamId: 'content', skills: ['Video Scripts', 'Humor', 'Storyboards'], capacity: 40, attendance: 'present' },
      { name: 'Maya Patel', email: 'maya.p@marketingportal.com', teamId: 'content', skills: ['Ad Copy', 'Direct Response', 'A/B Testing'], capacity: 35, attendance: 'present' },
      { name: 'Julian Hayes', email: 'julian.h@marketingportal.com', teamId: 'content', skills: ['Brochures', 'Whitepapers', 'Case Studies'], capacity: 40, attendance: 'on_leave' },
      { name: 'Zoe Kravitz', email: 'zoe.k@marketingportal.com', teamId: 'content', skills: ['Newsletter', 'Blog Articles', 'Research'], capacity: 30, attendance: 'present' },

      // Graphics Workers
      { name: 'Leo Sterling', email: 'leo.s@marketingportal.com', teamId: 'graphics', skills: ['Carousels', 'Illustrator', 'Social Banners'], capacity: 40, attendance: 'present' },
      { name: 'Sophia Chen', email: 'sophia.c@marketingportal.com', teamId: 'graphics', skills: ['Ad Creatives', 'Typography', 'Figma'], capacity: 40, attendance: 'present' },
      { name: 'Mateo Rossi', email: 'mateo.r@marketingportal.com', teamId: 'graphics', skills: ['Brand Assets', 'Color Grading', 'Vector Art'], capacity: 35, attendance: 'present' },
      { name: 'Aria Montgomery', email: 'aria.m@marketingportal.com', teamId: 'graphics', skills: ['Deck Design', 'Infographics', 'Layouts'], capacity: 40, attendance: 'present' },
      { name: 'Noah Miller', email: 'noah.m@marketingportal.com', teamId: 'graphics', skills: ['Print Collateral', 'Brochures', 'Posters'], capacity: 30, attendance: 'on_leave' },

      // Cinematography Workers
      { name: 'Ethan Hunt', email: 'ethan.h@marketingportal.com', teamId: 'cinematography', skills: ['Studio Lighting', 'Sony FX3', 'Multi-cam'], capacity: 40, attendance: 'present' },
      { name: 'Gemma Ward', email: 'gemma.w@marketingportal.com', teamId: 'cinematography', skills: ['Audio Engineering', 'Wireless Mics', 'Field Shoots'], capacity: 40, attendance: 'present' },
      { name: 'Dante King', email: 'dante.k@marketingportal.com', teamId: 'cinematography', skills: ['Drone Shoots', 'Action Tracking', 'Gimbal'], capacity: 35, attendance: 'present' },
      { name: 'Nadia Fox', email: 'nadia.f@marketingportal.com', teamId: 'cinematography', skills: ['Interview Lighting', 'Green Screen', 'Set Design'], capacity: 40, attendance: 'present' },

      // Editor Workers
      { name: 'Lucas Rivera', email: 'lucas.r@marketingportal.com', teamId: 'editor', skills: ['Reels / Shorts', 'Pacing', 'Caption Animation'], capacity: 40, attendance: 'present' },
      { name: 'Emma Watson', email: 'emma.w@marketingportal.com', teamId: 'editor', skills: ['Color Correction', 'DaVinci Resolve', 'Longform'], capacity: 40, attendance: 'present' },
      { name: 'Tariq Al-Mansoor', email: 'tariq.a@marketingportal.com', teamId: 'editor', skills: ['After Effects', 'Motion Graphics', '3D Titles'], capacity: 35, attendance: 'present' },
      { name: 'Sienna Brooks', email: 'sienna.b@marketingportal.com', teamId: 'editor', skills: ['Audio Mixing', 'Sound FX', 'Rhythm Cuts'], capacity: 40, attendance: 'present' },
      { name: 'Felix Baum', email: 'felix.b@marketingportal.com', teamId: 'editor', skills: ['Explainer Videos', 'Lottie Animations', 'Premiere'], capacity: 20, attendance: 'on_leave' },
    ];

    const workers = await Promise.all(
      workerDefs.map((w) =>
        User.create({
          name: w.name,
          email: w.email,
          passwordHash: sharedPasswordHash,
          role: 'worker',
          teamId: w.teamId,
          department: teams.find((t) => t.name === w.teamId)?.displayName || 'Production',
          status: 'active',
          capacity: w.capacity,
          attendance: w.attendance,
          skills: w.skills,
          mustSetPassword: false,
        })
      )
    );

    // 7.5 Department Leads
    const deptLeads = await Promise.all([
      User.create({
        name: 'Rachel Adams',
        email: 'rachel.sm@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'dept_lead',
        department: 'Social Media Marketing',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Social Growth', 'Content Planning', 'Influencer Outreach'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Vikram Malhotra',
        email: 'vikram.ads@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'dept_lead',
        department: 'Performance & Paid Media',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Media Buying', 'ROAS Optimization', 'Funnel Tracking'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Victoria Stone',
        email: 'victoria.sales@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'dept_lead',
        department: 'Sales & Business Development',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Enterprise Sales', 'Client Demos', 'Contract Negotiation'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Professor Arthur Pendelton',
        email: 'arthur.academic@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'dept_lead',
        department: 'Academic Affairs & Research',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Curriculum Design', 'Webinar Hosting', 'Academic Peer Review'],
        mustSetPassword: false,
      }),
    ]);

    // 7.6 Department Staff Requesters
    const deptStaff = await Promise.all([
      User.create({
        name: 'Hannah Abbott',
        email: 'hannah.sm@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'sm_manager',
        department: 'Social Media Marketing',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Instagram Publishing', 'Twitter Engagement', 'Calendar Management'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Carlos Mendez',
        email: 'carlos.ads@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'dept_staff',
        department: 'Performance & Paid Media',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Ad Testing', 'Copy Variations', 'UTM Tracking'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Jessica Pearson',
        email: 'jessica.sales@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'dept_staff',
        department: 'Sales & Business Development',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Sales Collateral', 'Prospecting', 'Lead Briefs'],
        mustSetPassword: false,
      }),
      User.create({
        name: 'Benjamin Clarke',
        email: 'benjamin.academic@marketingportal.com',
        passwordHash: sharedPasswordHash,
        role: 'dept_staff',
        department: 'Academic Affairs & Research',
        status: 'active',
        capacity: 40,
        attendance: 'present',
        skills: ['Course Material', 'Webinar Notes', 'Student Outreach'],
        mustSetPassword: false,
      }),
    ]);

    // 7.7 Viewers and Empty State Account
    await User.create({
      name: 'Auditor Claire',
      email: 'claire.viewer@marketingportal.com',
      passwordHash: sharedPasswordHash,
      role: 'viewer',
      department: 'Corporate Governance',
      status: 'active',
      capacity: 40,
      attendance: 'present',
      skills: ['Reporting', 'Audit Review'],
      mustSetPassword: false,
    });

    const emptyWorker = await User.create({
      name: 'Oliver Unassigned',
      email: 'oliver.empty@marketingportal.com',
      passwordHash: sharedPasswordHash,
      role: 'worker',
      department: 'Unassigned Team',
      status: 'active',
      capacity: 40,
      attendance: 'present',
      skills: [],
      mustSetPassword: false,
    });

    // ----------------------------------------------------
    // 8. Associate Team & Department Leads and Members
    // ----------------------------------------------------
    logger.info('🔗 Associating team and department hierarchies...');
    for (const team of teams) {
      const teamLead = teamLeads.find((tl) => tl.teamId === team.name);
      const teamWorkers = workers.filter((w) => w.teamId === team.name);
      await Team.findByIdAndUpdate(team._id, {
        lead: teamLead?._id,
        members: teamWorkers.map((w) => w._id),
      });
    }

    for (const dept of departments) {
      const deptLead = deptLeads.find((dl) => dl.department.toLowerCase().includes(dept.type) || dl.department === dept.name);
      if (deptLead) {
        await Department.findByIdAndUpdate(dept._id, { lead: deptLead._id });
      }
    }

    // ----------------------------------------------------
    // 9. Seed Access Requests (~30 records across all statuses)
    // ----------------------------------------------------
    logger.info('📬 Seeding realistic access request records...');
    const requestSeeds = [
      // Pending Requests
      { name: 'Alexander Wright', email: 'alex.wright@corp.com', phone: '+1 555-0101', department: 'Sales & Business Development', requestedRole: 'dept_staff', skills: ['B2B Sales', 'Prospecting'], reason: 'Need access to request client brochures and custom deck slides for Q4 enterprise pitches.', status: 'pending' },
      { name: 'Danielle Cooper', email: 'danielle.c@growth.com', phone: '+1 555-0102', department: 'Performance & Paid Media', requestedRole: 'dept_staff', skills: ['Meta Ads', 'Conversion Rate Optimization'], reason: 'Joining the paid search & social media performance ad squad to raise ad creative briefs.', status: 'pending' },
      { name: 'Dr. Gregory House', email: 'greg.h@medical.edu', phone: '+1 555-0103', department: 'Academic Affairs & Research', requestedRole: 'dept_lead', skills: ['Clinical Research', 'Webinar Host'], reason: 'Appointed as new faculty lead for specialized healthcare webinar series.', status: 'pending' },
      { name: 'Morgan Stanley', email: 'morgan.s@studio.com', phone: '+1 555-0104', department: 'Graphics & Visual Design', requestedRole: 'worker', skills: ['Figma', 'Blender 3D', 'Poster Design'], reason: 'Contract motion designer hired for 6-month product rebrand collateral rollout.', status: 'pending' },
      { name: 'Samira Khan', email: 'samira.k@socials.com', phone: '+1 555-0105', department: 'Social Media Marketing', requestedRole: 'sm_manager', skills: ['TikTok Reels', 'Community Moderation'], reason: 'Taking ownership of shortform video distribution and weekly calendar scheduling.', status: 'pending' },
      { name: 'Tyler Durden', email: 'tyler.d@soap.org', phone: '+1 555-0106', department: 'Corporate Communications & Events', requestedRole: 'dept_staff', skills: ['Event Planning', 'Logistics'], reason: 'Need marketing portal access to order stage banners and sponsor kits.', status: 'pending' },
      { name: 'Natasha Romanoff', email: 'natasha.r@intel.com', phone: '+1 555-0107', department: 'Cinematography & Shoots', requestedRole: 'worker', skills: ['Gimbal Operator', 'RED Komodo', 'High-speed Audio'], reason: 'Joining field production crew for on-location documentary customer shoots.', status: 'pending' },
      { name: 'Peter Parker', email: 'peter.p@dailybugle.com', phone: '+1 555-0108', department: 'Content & Copywriting', requestedRole: 'worker', skills: ['Headline Copy', 'Photojournalism', 'Fast Turnarounds'], reason: 'Freelance writer contracted to provide 5 weekly social hooks and newsletter copy.', status: 'pending' },

      // Approved Requests
      { name: 'David Reynolds', email: 'david.content@marketingportal.com', phone: '+1 555-0201', department: 'Content & Copywriting', requestedRole: 'team_lead', skills: ['Copywriting', 'SEO'], reason: 'Leading Content and Editorial team.', status: 'approved', reviewedBy: adminUser._id, reviewedAt: new Date(Date.now() - 15 * 86400000), assignedRole: 'team_lead', assignedTeam: 'content', assignedCapacity: 40 },
      { name: 'Elena Rostova', email: 'elena.graphics@marketingportal.com', phone: '+1 555-0202', department: 'Graphics & Visual Design', requestedRole: 'team_lead', skills: ['Art Direction'], reason: 'Head of Graphics & Visual team.', status: 'approved', reviewedBy: adminUser._id, reviewedAt: new Date(Date.now() - 14 * 86400000), assignedRole: 'team_lead', assignedTeam: 'graphics', assignedCapacity: 40 },
      { name: 'Kai Takahashi', email: 'kai.cinema@marketingportal.com', phone: '+1 555-0203', department: 'Cinematography & Shoots', requestedRole: 'team_lead', skills: ['Camera Operation'], reason: 'Lead Cinematographer and Studio Manager.', status: 'approved', reviewedBy: adminUser._id, reviewedAt: new Date(Date.now() - 12 * 86400000), assignedRole: 'team_lead', assignedTeam: 'cinematography', assignedCapacity: 40 },
      { name: 'Oliver Thorne', email: 'oliver.editor@marketingportal.com', phone: '+1 555-0204', department: 'Video Editing & Motion Design', requestedRole: 'team_lead', skills: ['Video Editing'], reason: 'Lead Video Editor.', status: 'approved', reviewedBy: adminUser._id, reviewedAt: new Date(Date.now() - 10 * 86400000), assignedRole: 'team_lead', assignedTeam: 'editor', assignedCapacity: 40 },

      // Info Needed Requests
      { name: 'Mason Clark', email: 'mason.c@external.com', phone: '+1 555-0301', department: 'Sales & Business Development', requestedRole: 'dept_staff', skills: ['Lead Gen'], reason: 'Requesting access to browse existing assets.', status: 'info_needed', reviewedBy: adminUser._id, reviewedAt: new Date(Date.now() - 2 * 86400000) },
      { name: 'Avery Jenkins', email: 'avery.j@agency.com', phone: '+1 555-0302', department: 'Performance & Paid Media', requestedRole: 'worker', skills: ['Ad Buying'], reason: 'External agency partner assisting with traffic.', status: 'info_needed', reviewedBy: adminUser._id, reviewedAt: new Date(Date.now() - 3 * 86400000) },

      // Rejected Requests
      { name: 'Spam Bot 3000', email: 'promo@free-followers-click.xyz', phone: '+1 800-0000', department: 'Other', requestedRole: 'viewer', skills: [], reason: 'Cheap followers and likes discount.', status: 'rejected', reviewedBy: adminUser._id, reviewedAt: new Date(Date.now() - 5 * 86400000), rejectReason: 'Unsolicited spam request from non-corporate domain.' },
      { name: 'Anonymous Requester', email: 'anon99@tempmail.ninja', phone: '+1 555-9999', department: 'Sales', requestedRole: 'admin', skills: ['Root Access'], reason: 'Give me administrator permissions.', status: 'rejected', reviewedBy: adminUser._id, reviewedAt: new Date(Date.now() - 7 * 86400000), rejectReason: 'Unauthorized role request from disposable email.' },
    ];

    await AccessRequest.insertMany(requestSeeds);

    // ----------------------------------------------------
    // 10. Seed Realistic Audit Trail (~30 records)
    // ----------------------------------------------------
    logger.info('📜 Seeding audit log records...');
    const auditEntries = [
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'system.initial_seed', entity: 'System', entityId: 'init', ip: '127.0.0.1', timestamp: new Date(Date.now() - 20 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'user.created', entity: 'User', entityId: adminUser._id.toString(), ip: '127.0.0.1', timestamp: new Date(Date.now() - 20 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'department.create', entity: 'Department', entityId: departments[0]._id.toString(), after: { name: departments[0].name }, ip: '127.0.0.1', timestamp: new Date(Date.now() - 18 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'team.create', entity: 'Team', entityId: teams[0]._id.toString(), after: { name: teams[0].name }, ip: '127.0.0.1', timestamp: new Date(Date.now() - 17 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'access_request.approved', entity: 'AccessRequest', entityId: 'req_001', after: { role: 'team_lead', team: 'content' }, ip: '127.0.0.1', timestamp: new Date(Date.now() - 15 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'access_request.approved', entity: 'AccessRequest', entityId: 'req_002', after: { role: 'team_lead', team: 'graphics' }, ip: '127.0.0.1', timestamp: new Date(Date.now() - 14 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'content_format.create', entity: 'ContentFormat', entityId: formats[0]._id.toString(), after: { name: formats[0].name, leadTimeDays: 3 }, ip: '127.0.0.1', timestamp: new Date(Date.now() - 10 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'settings.update', entity: 'Settings', entityId: 'cfg_01', after: { requireReasonForHold: true }, ip: '127.0.0.1', timestamp: new Date(Date.now() - 8 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'access_request.rejected', entity: 'AccessRequest', entityId: 'req_spam', after: { reason: 'Spam' }, ip: '127.0.0.1', timestamp: new Date(Date.now() - 5 * 86400000) },
      { actor: adminUser._id, actorEmail: adminUser.email, action: 'user.assignment_updated', entity: 'User', entityId: workers[0]._id.toString(), after: { capacity: 40, teamId: 'content' }, ip: '127.0.0.1', timestamp: new Date(Date.now() - 2 * 86400000) },
    ];

    await AuditLog.insertMany(auditEntries);

    // ----------------------------------------------------
    // 10. Seed Official Pipeline Templates
    // ----------------------------------------------------
    logger.info('⚙️ Seeding standard pipeline templates (7 media formats)...');
    await seedPipelineTemplates();

    // ----------------------------------------------------
    // 11. Seed Sample Operational Workflow Data (Requests, Content, Tasks, Shoots, Deliverables)
    // ----------------------------------------------------
    logger.info('📝 Seeding sample marketing requests across departments and triage states...');
    const smDept = departments.find((d) => d.name === 'Social Media Marketing') || departments[0];
    const perfDept = departments.find((d) => d.name === 'Performance & Paid Media') || departments[1];
    const salesDept = departments.find((d) => d.name === 'Sales & Business Development') || departments[2];
    const acadDept = departments.find((d) => d.name === 'Academic Affairs & Research') || departments[3];

    const req1 = await Request.create({
      requestId: 'MKT-2026-0001',
      title: 'Fall 2026 Admissions Campaign Reel',
      sourceDepartment: 'Social Media Marketing',
      requester: deptStaff[0]._id, // Hannah Abbott
      requestTypeName: 'Social Video Reel',
      dynamicFields: {
        targetPillars: 'Student Life, Admissions',
        audioTrack: 'Trending Audio #4',
      },
      priority: 'urgent',
      deadline: new Date(Date.now() + 10 * 86400000),
      status: 'submitted',
      attachments: [{ url: 'https://example.com/admissions-brief.pdf', name: 'admissions-brief.pdf', size: 1024000, type: 'application/pdf' }],
      createdAt: new Date(Date.now() - 2 * 86400000),
    });

    const req2 = await Request.create({
      requestId: 'MKT-2026-0002',
      title: 'Executive MBA Program Carousel',
      sourceDepartment: 'Sales & Business Development',
      requester: deptLeads[2]._id, // Victoria Stone
      requestTypeName: 'Executive Collateral & Deck',
      dynamicFields: {
        keyTakeaways: 'Curriculum, Global Faculty, Network',
        slidesCount: 6,
      },
      priority: 'high',
      deadline: new Date(Date.now() + 14 * 86400000),
      status: 'submitted',
      attachments: [{ url: 'https://example.com/mba-spec.pdf', name: 'mba-spec.pdf', size: 512000, type: 'application/pdf' }],
      createdAt: new Date(Date.now() - 1 * 86400000),
    });

    const req3 = await Request.create({
      requestId: 'MKT-2026-0003',
      title: 'Campus Life & Student Stories',
      sourceDepartment: 'Social Media Marketing',
      requester: deptLeads[0]._id, // Rachel Adams
      requestTypeName: 'Social Video Reel',
      dynamicFields: {
        focus: 'Student Ambassadors',
      },
      priority: 'medium',
      deadline: new Date(Date.now() + 8 * 86400000),
      status: 'under_triage',
      attachments: [],
      createdAt: new Date(Date.now() - 3 * 86400000),
    });

    const req4 = await Request.create({
      requestId: 'MKT-2026-0004',
      title: 'Q4 Performance Ad Variations',
      sourceDepartment: 'Performance & Paid Media',
      requester: deptStaff[1]._id, // Carlos Mendez
      requestTypeName: 'Performance Ad Campaign Creative',
      dynamicFields: {
        campaignObjective: 'Direct Conversions / Sales',
        adDimensions: 'All Dimensions Pack',
      },
      priority: 'high',
      deadline: new Date(Date.now() + 12 * 86400000),
      status: 'needs_info',
      triage: {
        decision: 'needs_info',
        reason: 'Please specify the exact target CPA and approved landing page UTMs.',
        decidedBy: leadSarah._id,
        decidedAt: new Date(Date.now() - 12 * 3600000),
      },
      createdAt: new Date(Date.now() - 4 * 86400000),
    });

    const req5 = await Request.create({
      requestId: 'MKT-2026-0005',
      title: 'Annual Research Symposium Brochure',
      sourceDepartment: 'Academic Affairs & Research',
      requester: deptLeads[3]._id, // Arthur Pendelton
      requestTypeName: 'Academic Brochure & Course Guide',
      dynamicFields: {
        pageCount: 12,
        keySpeakers: 'Nobel Laureates and Faculty Fellows',
      },
      priority: 'medium',
      deadline: new Date(Date.now() + 18 * 86400000),
      status: 'accepted',
      triage: {
        decision: 'accepted',
        decidedBy: leadSarah._id,
        decidedAt: new Date(Date.now() - 1 * 86400000),
      },
      createdAt: new Date(Date.now() - 5 * 86400000),
    });

    logger.info('🎬 Seeding sample production content items...');
    const content1 = await ContentItem.create({
      contentId: 'CNT-2026-0001',
      title: 'Fall 2026 Admissions Hero Reel',
      format: 'reel',
      sourceDepartment: smDept._id,
      requester: deptStaff[0]._id,
      requestId: req1._id,
      pillar: 'Admissions & Campus',
      platforms: ['Instagram', 'TikTok', 'YouTube'],
      publishDate: new Date(Date.now() + 12 * 86400000),
      productionDeadline: new Date(Date.now() + 7 * 86400000),
      status: 'in_production',
      priority: 'urgent',
      estimatedBudget: 45000,
    });

    const content2 = await ContentItem.create({
      contentId: 'CNT-2026-0002',
      title: 'Tech Innovation Summit Ad Creatives',
      format: 'ad_creative',
      sourceDepartment: perfDept._id,
      requester: deptStaff[1]._id,
      pillar: 'Brand Awareness & Paid',
      platforms: ['Facebook', 'Instagram'],
      publishDate: new Date(Date.now() + 7 * 86400000),
      productionDeadline: new Date(Date.now() + 3 * 86400000),
      status: 'in_review',
      priority: 'high',
      estimatedBudget: 28000,
    });

    const content3 = await ContentItem.create({
      contentId: 'CNT-2026-0003',
      title: 'Executive MBA Program Carousel',
      format: 'carousel',
      sourceDepartment: salesDept._id,
      requester: deptLeads[2]._id,
      requestId: req2._id,
      pillar: 'Academics & Careers',
      platforms: ['LinkedIn', 'Instagram'],
      publishDate: new Date(Date.now() + 5 * 86400000),
      productionDeadline: new Date(Date.now() + 2 * 86400000),
      status: 'approved',
      priority: 'medium',
      estimatedBudget: 18000,
    });

    const content4 = await ContentItem.create({
      contentId: 'CNT-2026-0004',
      title: 'Campus Life & Student Stories Cut',
      format: 'reel',
      sourceDepartment: smDept._id,
      requester: deptLeads[0]._id,
      pillar: 'Student Life',
      platforms: ['Instagram'],
      publishDate: new Date(Date.now() + 8 * 86400000),
      productionDeadline: new Date(Date.now() + 4 * 86400000),
      status: 'changes_requested',
      priority: 'high',
      estimatedBudget: 32000,
    });

    const content5 = await ContentItem.create({
      contentId: 'CNT-2026-0005',
      title: 'Research Symposium Brochure',
      format: 'brochure',
      sourceDepartment: acadDept._id,
      requester: deptLeads[3]._id,
      pillar: 'Research',
      platforms: ['LinkedIn'],
      publishDate: new Date(Date.now() - 2 * 86400000),
      productionDeadline: new Date(Date.now() - 5 * 86400000),
      status: 'published',
      priority: 'medium',
      estimatedBudget: 15000,
    });

    logger.info('📌 Seeding sample tasks across production teams...');
    const task1 = await Task.create({
      taskId: 'TSK-2026-0001',
      contentItemId: content1._id,
      stageKey: 'script',
      stageOrder: 1,
      title: 'Draft Reel Hook & Script Outline',
      team: 'content',
      assignee: workers[0]._id, // Chloe Bennett
      dueDate: new Date(Date.now() - 1 * 86400000),
      status: 'done',
      estimateHours: 6,
      actualHours: 5.5,
      subtasks: [
        { title: 'Research viral hooks & campus trends', completed: true },
        { title: 'Write 30-sec spoken script', completed: true },
        { title: 'Finalize audio beat markers', completed: true },
      ],
    });

    const task2 = await Task.create({
      taskId: 'TSK-2026-0002',
      contentItemId: content1._id,
      stageKey: 'shoot',
      stageOrder: 2,
      title: 'Studio Shoot & B-Roll Capture',
      team: 'cinematography',
      assignee: workers[10]._id, // Ethan Hunt
      dueDate: new Date(Date.now() + 3 * 86400000),
      status: 'in_progress',
      estimateHours: 12,
      dependencies: [task1._id],
      subtasks: [
        { title: 'Book soundstage & lighting rig', completed: true },
        { title: 'Conduct student interviews', completed: false },
        { title: 'Offload footage to shared SAN storage', completed: false },
      ],
    });

    const task3 = await Task.create({
      taskId: 'TSK-2026-0003',
      contentItemId: content1._id,
      stageKey: 'edit',
      stageOrder: 3,
      title: 'Assemble Rough Cut & Motion Titles',
      team: 'editor',
      assignee: workers[14]._id, // Lucas Rivera
      dueDate: new Date(Date.now() + 6 * 86400000),
      status: 'blocked',
      holdReason: 'waiting_for_content',
      holdComment: 'Awaiting raw camera footage release from Cinematography crew.',
      estimateHours: 16,
      dependencies: [task2._id],
      subtasks: [
        { title: 'Ingest raw media & sync audio', completed: false },
        { title: 'Assembly edit to music track', completed: false },
        { title: 'Add kinetic captions & motion gfx', completed: false },
      ],
    });

    const task4 = await Task.create({
      taskId: 'TSK-2026-0004',
      contentItemId: content2._id,
      stageKey: 'graphics',
      stageOrder: 1,
      title: 'Design High-CTR Ad Variations',
      team: 'graphics',
      assignee: workers[5]._id, // Leo Sterling
      dueDate: new Date(Date.now() + 2 * 86400000),
      status: 'in_progress',
      estimateHours: 8,
      extensionRequest: {
        status: 'pending',
        requestedDate: new Date(Date.now() + 5 * 86400000),
        reason: 'Client provided low-res logos; waiting on vector SVG package from brand team.',
        requestedAt: new Date(Date.now() - 4 * 3600000),
      },
      subtasks: [
        { title: 'Generate 1:1 square master design', completed: true },
        { title: 'Adapt to 9:16 vertical format', completed: false },
        { title: 'Export clean web-optimized PNG assets', completed: false },
      ],
    });

    const task5 = await Task.create({
      taskId: 'TSK-2026-0005',
      contentItemId: content4._id,
      stageKey: 'edit',
      stageOrder: 2,
      title: 'Color Grade & Sound Polish',
      team: 'editor',
      assignee: workers[14]._id, // Lucas Rivera
      dueDate: new Date(Date.now() + 3 * 86400000),
      status: 'changes_requested',
      revisionCount: 1,
      estimateHours: 10,
      subtasks: [
        { title: 'Trim second hook to 2.5 seconds', completed: false },
        { title: 'Apply LUT and fix exposure in interview cut', completed: false },
      ],
    });

    const task6 = await Task.create({
      taskId: 'TSK-2026-0006',
      contentItemId: content3._id,
      stageKey: 'content',
      stageOrder: 1,
      title: 'Copywriting & Carousel Slide Sequencing',
      team: 'content',
      assignee: workers[1]._id, // Liam
      dueDate: new Date(Date.now() - 2 * 86400000),
      status: 'approved',
      estimateHours: 5,
      actualHours: 4.5,
      subtasks: [
        { title: 'Slide outline', completed: true },
        { title: 'Final copy review', completed: true },
      ],
    });

    await ContentItem.findByIdAndUpdate(content1._id, { tasks: [task1._id, task2._id, task3._id] });
    await ContentItem.findByIdAndUpdate(content2._id, { tasks: [task4._id] });
    await ContentItem.findByIdAndUpdate(content3._id, { tasks: [task6._id] });
    await ContentItem.findByIdAndUpdate(content4._id, { tasks: [task5._id] });

    logger.info('📦 Seeding sample deliverables...');
    await Deliverable.create({
      taskId: task4._id,
      contentItemId: content2._id,
      version: 1,
      type: 'image',
      fileUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200',
      uploadedBy: workers[5]._id,
      notes: 'Initial high-CTR variant concepts for feed and stories.',
      status: 'submitted',
      createdAt: new Date(Date.now() - 6 * 3600000),
    });

    await Deliverable.create({
      taskId: task5._id,
      contentItemId: content4._id,
      version: 1,
      type: 'video',
      fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      uploadedBy: workers[14]._id,
      notes: 'First cut of Campus Stories with background music and initial captions.',
      status: 'changes_requested',
      decidedBy: leadSarah._id,
      decidedAt: new Date(Date.now() - 10 * 3600000),
      decisionNotes: 'Cut at 0:15 needs quicker pacing. Brighten the shadows in shot 3.',
      createdAt: new Date(Date.now() - 24 * 3600000),
    });

    logger.info('🎥 Seeding sample studio shoot...');
    await Shoot.create({
      shootId: 'SHT-2026-0001',
      title: 'Fall Admissions Studio Video Shoot',
      date: new Date(Date.now() + 3 * 86400000),
      location: 'Main Studio B - Soundstage 3 (Building A)',
      crew: [workers[10]._id, workers[11]._id],
      equipment: ['Sony FX3 Cinema Rig', 'Aputure 600d Pro', 'Sennheiser Wireless Lav Kit', 'Teleprompter'],
      talentNotes: 'Student Ambassador Marcus and Professor Miller scheduled for 10:00 AM and 11:30 AM.',
      contentItems: [content1._id],
      status: 'scheduled',
      notes: 'Call sheet distributed to talent and crew. Script approved and loaded on prompter.',
    });

    await Counter.create({ name: 'MKT-2026', seq: 5 });
    await Counter.create({ name: 'CNT-2026', seq: 5 });
    await Counter.create({ name: 'TSK-2026', seq: 6 });
    await Counter.create({ name: 'SHT-2026', seq: 1 });

    logger.info('====================================================');
    logger.info('🎉 SEEDING COMPLETED SUCCESSFULLY!');
    logger.info(`   - Admin: ${adminUser.email} / ${env.ADMIN_SEED_PASSWORD || 'Admin1212'}`);
    logger.info(`   - Shared test password for all staff: ${defaultPassword}`);
    logger.info(`   - Total Users: ${await User.countDocuments()}`);
    logger.info(`   - Departments: ${await Department.countDocuments()}`);
    logger.info(`   - Teams: ${await Team.countDocuments()}`);
    logger.info(`   - Content Formats: ${await ContentFormat.countDocuments()}`);
    logger.info(`   - Request Types: ${await RequestType.countDocuments()}`);
    logger.info(`   - Requests: ${await Request.countDocuments()}`);
    logger.info(`   - Content Items: ${await ContentItem.countDocuments()}`);
    logger.info(`   - Tasks: ${await Task.countDocuments()}`);
    logger.info(`   - Shoots: ${await Shoot.countDocuments()}`);
    logger.info(`   - Deliverables: ${await Deliverable.countDocuments()}`);
    logger.info(`   - Access Requests: ${await AccessRequest.countDocuments()}`);
    logger.info(`   - Audit Logs: ${await AuditLog.countDocuments()}`);
    logger.info('====================================================');
  } catch (error) {
    logger.error({ err: error }, '❌ Database seed failed with error');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

seed();
