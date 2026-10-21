import { z } from 'zod';

// ==========================================
// 1. Roles & Permissions (4-Role Marketing OS Model)
// ==========================================

export const ROLE_KEYS = [
  'admin',
  'marketing_head',
  'team_lead',
  'team_member',
] as const;

export type UserRole = (typeof ROLE_KEYS)[number];

export const LEGACY_ROLE_ALIASES = {
  lead: 'marketing_head',
  head: 'marketing_head',
  worker: 'team_member',
  sm_manager: 'team_member',
  management: 'team_member',
  dept_lead: 'team_member',
  dept_staff: 'team_member',
  viewer: 'team_member',
} as const;

export type LegacyRoleAlias = keyof typeof LEGACY_ROLE_ALIASES;

export function normalizeRole(role: string | null | undefined): UserRole | string {
  if (!role) return role as string;
  if (role in LEGACY_ROLE_ALIASES) {
    return LEGACY_ROLE_ALIASES[role as LegacyRoleAlias];
  }
  return role;
}

// 20 Canonical Permission Keys (Spec Section 13.1)
export const PERMISSION_KEYS = [
  'work.create',
  'work.request',
  'work.update.own',
  'assignment.override',
  'feedback.give',
  'feedback.respond',
  'revision.classify',
  'campaign.manage',
  'target.manage',
  'target.view',
  'lead.view',
  'datacenter.view',
  'analytics.team',
  'report.view',
  'report.configure',
  'automation.manage',
  'user.approve',
  'user.manage',
  'people.assign',
  'reference.manage',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

// Role-to-Permission Mapping Matrix (Spec Section 13.1)
// Admin is dynamically derived from PERMISSION_KEYS so any new keys are automatically granted
export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: [...PERMISSION_KEYS],
  marketing_head: [
    'work.create',
    'work.request',
    'work.update.own',
    'assignment.override',
    'feedback.give',
    'feedback.respond',
    'revision.classify',
    'campaign.manage',
    'target.manage',
    'target.view',
    'lead.view',
    'datacenter.view',
    'analytics.team',
    'report.view',
    'report.configure',
    'automation.manage',
    'people.assign',
  ],
  team_lead: [
    'work.create',
    'work.request',
    'work.update.own',
    'assignment.override',
    'feedback.give',
    'feedback.respond',
    'revision.classify',
    'campaign.manage',
    'target.view',
    'lead.view',
    'datacenter.view',
    'analytics.team',
    'report.view',
  ],
  team_member: [
    'work.request',
    'work.update.own',
    'feedback.respond',
    'analytics.team',
  ],
};

// ==========================================
// 2. Fixed Reference Taxonomies (Spec Section 14)
// ==========================================

export const PROFILES = [
  { name: 'HACA', code: 'haca' },
  { name: 'HACA Mideast', code: 'haca_mideast' },
  { name: 'HACA Marketing School', code: 'haca_marketing_school' },
  { name: 'HACA Marketing School EN', code: 'haca_marketing_school_en' },
  { name: 'HACA Design School', code: 'haca_design_school' },
  { name: 'HACA Design School EN', code: 'haca_design_school_en' },
  { name: 'HACA Tech School', code: 'haca_tech_school' },
] as const;

export const PROFILE_CODES = PROFILES.map((p) => p.code);
export type ProfileCode = (typeof PROFILE_CODES)[number];

export const DEPARTMENTS = [
  { name: 'Design', code: 'design' },
  { name: 'Video Production', code: 'video_production' },
  { name: 'Social Media', code: 'social_media' },
  { name: 'SEO & Content', code: 'seo_content' },
  { name: 'WhatsApp', code: 'whatsapp' },
  { name: 'Performance Marketing', code: 'performance_marketing' },
  { name: 'Tech', code: 'tech' },
] as const;

export const DEPARTMENT_CODES = DEPARTMENTS.map((d) => d.code);
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];
// Keep DEPARTMENT_TYPES alias for backward compatibility
export const DEPARTMENT_TYPES = DEPARTMENT_CODES;
export type DepartmentType = DepartmentCode;

export const JOB_ROLES = [
  'SEO Specialist',
  'Social Specialist',
  'UI Designer',
  'Writer',
  'Developer',
  'Social Media Manager',
  'Designer',
  'Video Editor',
  'Creative Manager (TL)',
  'Design Lead (TL)',
  'YouTube Strategist',
  'WhatsApp Marketer',
  'Performance Marketer',
] as const;
export type JobRole = (typeof JOB_ROLES)[number];

export const PROGRAMS = [
  'AI Integrated Graphic Design',
  'UI/UX Design + AI',
  'Creative Design & Communication',
  'AI Integrated Video Editing Mastery',
  'Branding & Identity Online Program',
] as const;
export type Program = (typeof PROGRAMS)[number];

export const WORK_TYPES = [
  'Reel',
  'Ad Creative',
  'Landing Page',
  'Carousel',
  'Post',
  'Blog',
  'Email',
  'WhatsApp Blast',
  'Ad Set',
  'YouTube Short/Video',
  'SEO Audit',
  'Copy',
  'Video Ad',
  'Internal Report',
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_DEPARTMENT_MAP: Record<WorkType, DepartmentCode> = {
  Reel: 'video_production',
  'Video Ad': 'video_production',
  'YouTube Short/Video': 'video_production',
  'Ad Creative': 'design',
  Carousel: 'design',
  'Landing Page': 'design',
  Post: 'social_media',
  Blog: 'seo_content',
  Email: 'seo_content',
  Copy: 'seo_content',
  'SEO Audit': 'seo_content',
  'WhatsApp Blast': 'whatsapp',
  'Ad Set': 'performance_marketing',
  'Internal Report': 'performance_marketing',
};

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CAMPAIGN_STATUSES = ['In Progress', 'At Risk', 'Completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const GOAL_TYPES = ['Leads', 'Reactivations', 'Enrollments'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const EXPECTED_OUTCOMES = [
  'Lead Generation',
  'Brand Awareness',
  'Engagement',
  'SEO Ranking',
  'Nurture',
  'Conversion',
  'Reactivation',
  'Ops',
] as const;
export type ExpectedOutcome = (typeof EXPECTED_OUTCOMES)[number];

export const BLOCKER_REASONS = [
  'Waiting for feedback',
  'Waiting for content',
  'Waiting for data',
  'Technical issue',
  'Dependency',
  'Client/business approval',
  'Resource issue',
  'Unclear requirement',
  'Other',
] as const;
export type BlockerReason = (typeof BLOCKER_REASONS)[number];

// Reasons that require dependencyOwnerId to be specified
export const BLOCKER_DEPENDENCY_REASONS: BlockerReason[] = [
  'Waiting for feedback',
  'Waiting for content',
  'Waiting for data',
];

export const REVISION_ROOT_CAUSES = [
  'Brief unclear',
  'Creative direction unclear',
  'Skill gap',
  'Feedback inconsistency',
  'Excessive scope change',
  'TL approval delay',
  'Client/business requirement changed',
] as const;
export type RevisionRootCause = (typeof REVISION_ROOT_CAUSES)[number];

export const LEAD_SOURCES = [
  'SMM YouTube',
  'SMM Instagram',
  'Online Campaigns (SMM)',
  'Facebook Lead Ads',
  'Social Media Re-engaged Leads',
  'Meta Re-Engaged Leads',
  'Google Ads',
  'Inbound Phone Calls',
  'WhatsApp Reactivation',
  'WhatsApp Inbound',
  'Student Referral',
  'Staff Referral',
  'SEO',
  'PR',
  'Website Leads',
  'Offline Campaigns',
  'Walk-in',
  'Outbound Phone Calls',
  'Workshops/Webinars',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const FUNNEL_STAGES = [
  'Total Leads',
  'Not Contacted',
  'Not Answered',
  'Interested',
  'Qualified Leads',
  'Call Back',
  'Payment Received',
  'Not Interested',
  'Not a Potential',
  'Not Answered (Multiple)',
  'Reconnected',
  'Not Eligible',
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const WORK_ITEM_STATUSES = [
  'Not Started',
  'In Progress',
  'Feedback',
  'Pending',
  'Blocked',
  'Approved',
  'Published',
] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const ACCESS_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'info_needed',
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export const WORKLOAD_BANDS = {
  HEALTHY_MAX: 65,
  HIGH_MAX: 85,
} as const;

export function getWorkloadBand(workloadPct: number): 'Healthy' | 'High' | 'Overloaded' {
  if (workloadPct < WORKLOAD_BANDS.HEALTHY_MAX) return 'Healthy';
  if (workloadPct <= WORKLOAD_BANDS.HIGH_MAX) return 'High';
  return 'Overloaded';
}

// Deliverables & Upload constants (kept for upload infrastructure)
export const DELIVERABLE_TYPES = [
  'video',
  'image',
  'document',
  'audio',
  'copy',
  'link',
  'other',
] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export const MAX_UPLOAD_SIZES = {
  video: 500 * 1024 * 1024,
  image: 50 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  other: 50 * 1024 * 1024,
} as const;

// ==========================================
// 3. Zod Schemas
// ==========================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const setPasswordSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const REQUESTABLE_ROLES = ['team_member', 'team_lead'] as const;
export type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

export const requestAccessSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  email: z.string().trim().email('Valid work email required'),
  phone: z.string().trim().min(7, 'Valid contact number required'),
  department: z.string().trim().min(1, 'Department is required'),
  jobRole: z.string().trim().min(1, 'Job role is required'),
  requestedRole: z.enum(REQUESTABLE_ROLES, {
    errorMap: () => ({ message: 'Only Team Member or Team Lead can be requested' }),
  }),
  requestedProfileCodes: z
    .array(z.string())
    .min(1, 'Please select at least one brand you work on'),
  reason: z
    .string()
    .trim()
    .min(10, 'Please describe your role and the work you will do in the marketing team (min 10 characters)'),
});
export type RequestAccessInput = z.infer<typeof requestAccessSchema>;
export const publicRequestAccessSchema = requestAccessSchema;
export type PublicRequestAccessInput = RequestAccessInput;

export const accessRequestReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'info_needed']).optional().default('approved'),
  assignedRole: z.enum(ROLE_KEYS).optional(),
  departmentId: z.string().optional().nullable(),
  jobRole: z.string().optional(),
  weeklyCapacityHours: z.number().min(0).max(80).default(40).optional(),
  profileAccess: z.array(z.string()).optional(),
  reportsToIds: z.array(z.string()).optional(),
  reason: z.string().optional(),
  question: z.string().optional(),
});
export type AccessRequestReviewInput = z.infer<typeof accessRequestReviewSchema>;

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Department code is required'),
  description: z.string().optional(),
  lead: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const profileSchema = z.object({
  name: z.string().min(2, 'Profile name is required'),
  code: z.string().min(2, 'Profile code is required'),
  active: z.boolean().default(true),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const personCreateSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(ROLE_KEYS),
  jobRole: z.enum(JOB_ROLES).optional(),
  departmentId: z.string().optional().nullable(),
  profileAccess: z.array(z.string()).default([]),
  reportsToIds: z.array(z.string()).default([]),
  weeklyCapacityHours: z.number().min(0).max(80).default(40),
  password: z.string().min(8).optional(),
});
export type PersonCreateInput = z.infer<typeof personCreateSchema>;

export const personOperationalUpdateSchema = z.object({
  departmentId: z.string().optional().nullable(),
  jobRole: z.enum(JOB_ROLES).optional().nullable(),
  profileAccess: z.array(z.string()).optional(),
  reportsToIds: z.array(z.string()).optional(),
  weeklyCapacityHours: z.number().min(0).max(80).optional(),
  lastProfileId: z.string().optional().nullable(),
});
export type PersonOperationalUpdateInput = z.infer<typeof personOperationalUpdateSchema>;

export const personAdminUpdateSchema = personOperationalUpdateSchema.extend({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLE_KEYS).optional(),
  status: z.enum(['invited', 'active', 'suspended']).optional(),
});
export type PersonAdminUpdateInput = z.infer<typeof personAdminUpdateSchema>;

export const signUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().positive('File size must be positive'),
  fileType: z.string().min(1, 'File type is required'),
  deliverableType: z.enum(DELIVERABLE_TYPES).optional(),
  folder: z.string().optional(),
});
export type SignUploadInput = z.infer<typeof signUploadSchema>;

// Phase 2: Monthly Targets & Campaigns Schemas
export const monthlyTargetSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format (e.g. 2026-11)'),
  profileId: z.string().optional().nullable(),
  revenueTarget: z.number().min(0, 'Revenue target must be non-negative').default(0),
  leadsTarget: z.number().min(0, 'Leads target must be non-negative').default(0),
  qualifiedLeadsTarget: z.number().min(0, 'Qualified leads target must be non-negative').default(0),
  budget: z.number().min(0, 'Budget must be non-negative').default(0),
});
export type MonthlyTargetInput = z.infer<typeof monthlyTargetSchema>;

export const monthlyTargetUpdateSchema = monthlyTargetSchema.partial();
export type MonthlyTargetUpdateInput = z.infer<typeof monthlyTargetUpdateSchema>;

export const campaignSchema = z.object({
  name: z.string().trim().min(2, 'Campaign name must be at least 2 characters'),
  profileId: z.string().min(1, 'Profile / Brand is required'),
  targetId: z.string().min(1, 'Target linkage is strictly required'),
  relatedOKR: z.string().trim().min(3, 'Related OKR is strictly required'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(CAMPAIGN_STATUSES).default('In Progress'),
  goalType: z.enum(GOAL_TYPES),
  goalValue: z.number().min(0).default(0),
  expectedOutcome: z.enum(EXPECTED_OUTCOMES).optional(),
  budget: z.number().min(0).default(0),
  spend: z.number().min(0).default(0),
  leadsActual: z.number().min(0).default(0),
  qualifiedLeadsActual: z.number().min(0).default(0),
  ownerId: z.string().min(1, 'Campaign owner is required'),
  progressPct: z.number().min(0).max(100).default(0).optional(),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

export const campaignUpdateSchema = campaignSchema.partial();
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

// Phase 3: Work Items Schemas
export const workItemCreateSchema = z.object({
  campaignId: z.string().min(1, 'Campaign linkage is strictly required'),
  title: z.string().trim().min(2, 'Work item title is required'),
  workType: z.enum(WORK_TYPES),
  departmentId: z.string().min(1, 'Department is required'),
  ownerId: z.string().min(1, 'Assigned owner is required'),
  deadline: z.coerce.date(),
  estimatedEffortHrs: z.number().min(0.5).max(100).default(4),
  status: z.enum(WORK_ITEM_STATUSES).default('Not Started'),
  priority: z.enum(PRIORITIES).default('Medium'),
  description: z.string().optional(),
  deliverableUrl: z.string().optional(),
  publishedUrl: z.string().optional(),
  blockerReason: z.enum(BLOCKER_REASONS).optional(),
  blockerNote: z.string().optional(),
  profileId: z.string().optional(),
  relatedOKR: z.string().optional(),
  relatedTarget: z.string().optional(),
});
export type WorkItemCreateInput = z.infer<typeof workItemCreateSchema>;

export const workItemUpdateSchema = workItemCreateSchema.partial();
export type WorkItemUpdateInput = z.infer<typeof workItemUpdateSchema>;

export const workItemTransitionSchema = z.object({
  toStatus: z.enum(WORK_ITEM_STATUSES),
  blockerReason: z.enum(BLOCKER_REASONS).optional(),
  blockerNote: z.string().optional(),
  deliverableUrl: z.string().optional(),
  publishedUrl: z.string().optional(),
  comment: z.string().optional(),
});
export type WorkItemTransitionInput = z.infer<typeof workItemTransitionSchema>;

// Phase 4: Auto-Assignment & Workload Schemas
export const CAPACITY_BANDS = ['Healthy', 'High', 'Overloaded'] as const;
export type CapacityBand = (typeof CAPACITY_BANDS)[number];

export const assignmentRecommendSchema = z.object({
  workType: z.enum(WORK_TYPES),
  campaignId: z.string().optional(),
  profileId: z.string().optional(),
  departmentId: z.string().optional(),
  deadline: z.coerce.date().optional(),
  estimatedEffortHrs: z.number().min(0.5).max(120).default(4),
});
export type AssignmentRecommendInput = z.infer<typeof assignmentRecommendSchema>;

export const assignmentOverrideSchema = z.object({
  workItemId: z.string().min(1, 'Work item ID is required'),
  recommendedPersonId: z.string().min(1, 'Recommended person ID is required'),
  chosenPersonId: z.string().min(1, 'Chosen person ID is required'),
  reason: z.string().min(3, 'Override reason is required'),
  metadata: z.record(z.any()).optional(),
});
export type AssignmentOverrideInput = z.infer<typeof assignmentOverrideSchema>;

