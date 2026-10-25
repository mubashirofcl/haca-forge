import { z } from "zod";

// ==========================================
// 1. Roles & Permissions (5-Role Marketing OS Model)
// ==========================================

export const ROLE_KEYS = [
  "admin",
  "creative_head",
  "executive",
  "sm_manager",
  "team_member",
] as const;

export type UserRole = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  creative_head: "Creative Head",
  executive: "Executive",
  sm_manager: "SM Manager",
  team_member: "Team Member",
};

export function normalizeRole(
  role: string | null | undefined,
): UserRole | string {
  if (!role) return role as string;
  return role;
}

// Canonical Permission Keys (Marketing OS Model)
export const PERMISSION_KEYS = [
  "portal.view",
  "people.view",
  "people.assign",
  "calendar.plan",
  "calendar.approve",
  "work.create",
  "work.request",
  "work.update.own",
  "assignment.override",
  "feedback.give",
  "feedback.respond",
  "revision.classify",
  "analytics.team",
  "report.view",
  "report.configure",
  "automation.manage",
  "user.approve",
  "user.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

// Role-to-Permission Mapping Matrix (Spec Section 13.1 / Scope Reset R2)
// Admin is dynamically derived from PERMISSION_KEYS so any new keys are automatically granted
export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: [...PERMISSION_KEYS],
  creative_head: [
    "portal.view",
    "people.view",
    "people.assign",
    "calendar.approve",
    "feedback.give",
    "feedback.respond",
    "revision.classify",
    "assignment.override",
    "work.update.own",
    "analytics.team",
    "report.view",
    "report.configure",
    "automation.manage",
  ],
  sm_manager: [
    "calendar.plan",
    "work.create",
    "assignment.override",
    "work.update.own",
    "feedback.respond",
    "analytics.team",
    "report.view",
    "people.view",
  ],
  executive: [
    "portal.view",
    "people.view",
    "analytics.team",
    "report.view",
  ],
  team_member: [
    "work.update.own",
    "work.request",
    "feedback.respond",
  ],
};

// ==========================================
// 2. Fixed Reference Taxonomies (Spec Section 14)
// ==========================================

export const PROFILES = [
  { name: "HACA", code: "haca" },
  { name: "HACA Mideast", code: "haca_mideast" },
  { name: "HACA Marketing School", code: "haca_marketing_school" },
  { name: "HACA Marketing School EN", code: "haca_marketing_school_en" },
  { name: "HACA Design School", code: "haca_design_school" },
  { name: "HACA Design School EN", code: "haca_design_school_en" },
  { name: "HACA Tech School", code: "haca_tech_school" },
] as const;

export const PROFILE_CODES = PROFILES.map((p) => p.code);
export type ProfileCode = (typeof PROFILE_CODES)[number];

export const DEPARTMENTS = [
  { name: "Design", code: "design" },
  { name: "Video Production", code: "video_production" },
  { name: "Social Media", code: "social_media" },
  { name: "SEO & Content", code: "seo_content" },
  { name: "WhatsApp", code: "whatsapp" },
  { name: "Performance Marketing", code: "performance_marketing" },
  { name: "Tech", code: "tech" },
] as const;

export const DEPARTMENT_CODES = DEPARTMENTS.map((d) => d.code);
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];
// Keep DEPARTMENT_TYPES alias for backward compatibility
export const DEPARTMENT_TYPES = DEPARTMENT_CODES;
export type DepartmentType = DepartmentCode;

export const JOB_ROLES = [
  "SEO Specialist",
  "Social Specialist",
  "UI Designer",
  "Writer",
  "Developer",
  "Social Media Manager",
  "Designer",
  "Video Editor",
  "Creative Manager (TL)",
  "Design Lead (TL)",
  "YouTube Strategist",
  "WhatsApp Marketer",
  "Performance Marketer",
] as const;
export type JobRole = (typeof JOB_ROLES)[number];

// Stage Work Preferences

export const WORK_PREFERENCES = [
  "Content",
  "Script",
  "Design",
  "Shoot",
  "Edit",
  "Post",
] as const;
export type WorkPreference = (typeof WORK_PREFERENCES)[number];

export const PROGRAMS = [
  "AI Integrated Graphic Design",
  "UI/UX Design + AI",
  "Creative Design & Communication",
  "AI Integrated Video Editing Mastery",
  "Branding & Identity Online Program",
] as const;
export type Program = (typeof PROGRAMS)[number];

export const WORK_TYPES = [
  "Reel",
  "Ad Creative",
  "Landing Page",
  "Carousel",
  "Post",
  "Blog",
  "Email",
  "WhatsApp Blast",
  "Ad Set",
  "YouTube Short/Video",
  "SEO Audit",
  "Copy",
  "Video Ad",
  "Internal Report",
  // 14 SM Content Flow Design Requirement Types (docs/CONTENT_FLOW.md §1 & §3.3)
  "Static Post",
  "Carousel Post",
  "Story",
  "Cover Image",
  "Thumbnail",
  "Meta Ad Creative",
  "Class Announcement",
  "Orientation Creative",
  "Graduation Creative",
  "Brochure",
  "Certificate",
  "Offer Creative",
  "Custom Request",
  "Placement Poster",
  // Alias for Static Post
  "Poster",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_ALIASES: Record<string, WorkType> = {
  Poster: "Static Post",
  poster: "Static Post",
};

export function normalizeWorkType(type: string | null | undefined): string {
  if (!type) return "";
  if (type in WORK_TYPE_ALIASES) {
    return WORK_TYPE_ALIASES[type];
  }
  return type;
}

export const WORK_TYPE_DEPARTMENT_MAP: Record<WorkType, DepartmentCode> = {
  Reel: "video_production",
  "Video Ad": "video_production",
  "YouTube Short/Video": "video_production",
  "Ad Creative": "design",
  Carousel: "design",
  "Landing Page": "design",
  Post: "social_media",
  Blog: "seo_content",
  Email: "seo_content",
  Copy: "seo_content",
  "SEO Audit": "seo_content",
  "WhatsApp Blast": "whatsapp",
  "Ad Set": "performance_marketing",
  "Internal Report": "performance_marketing",
  // 14 Design Requirement Types map to Design department
  "Static Post": "design",
  "Carousel Post": "design",
  Story: "design",
  "Cover Image": "design",
  Thumbnail: "design",
  "Meta Ad Creative": "design",
  "Class Announcement": "design",
  "Orientation Creative": "design",
  "Graduation Creative": "design",
  Brochure: "design",
  Certificate: "design",
  "Offer Creative": "design",
  "Custom Request": "design",
  "Placement Poster": "design",
  Poster: "design",
};

export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const BLOCKER_REASONS = [
  "Waiting for feedback",
  "Waiting for content",
  "Waiting for data",
  "Technical issue",
  "Dependency",
  "Client/business approval",
  "Resource issue",
  "Unclear requirement",
  "Other",
] as const;
export type BlockerReason = (typeof BLOCKER_REASONS)[number];

// Reasons that require dependencyOwnerId to be specified
export const BLOCKER_DEPENDENCY_REASONS: BlockerReason[] = [
  "Waiting for feedback",
  "Waiting for content",
  "Waiting for data",
];

export const REVISION_ROOT_CAUSES = [
  "Brief unclear",
  "Creative direction unclear",
  "Skill gap",
  "Feedback inconsistency",
  "Excessive scope change",
  "TL approval delay",
  "Client/business requirement changed",
] as const;
export type RevisionRootCause = (typeof REVISION_ROOT_CAUSES)[number];

export const WORK_ITEM_STATUSES = [
  "Not Started",
  "In Progress",
  "Feedback",
  "Pending",
  "Blocked",
  "Approved",
  "Published",
] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const ACCESS_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "info_needed",
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export const WORKLOAD_BANDS = {
  HEALTHY_MAX: 65,
  HIGH_MAX: 85,
} as const;

export function getWorkloadBand(
  workloadPct: number,
): "Healthy" | "High" | "Overloaded" {
  if (workloadPct < WORKLOAD_BANDS.HEALTHY_MAX) return "Healthy";
  if (workloadPct <= WORKLOAD_BANDS.HIGH_MAX) return "High";
  return "Overloaded";
}

// Deliverables & Upload constants (kept for upload infrastructure)
export const DELIVERABLE_TYPES = [
  "video",
  "image",
  "document",
  "audio",
  "copy",
  "link",
  "other",
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
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const setPasswordSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const REQUESTABLE_ROLES = ["team_member", "sm_manager"] as const;
export type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

export const requestAccessSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters"),
  email: z.string().trim().email("Valid work email required"),
  phone: z.string().trim().min(7, "Valid contact number required"),
  department: z.string().trim().min(1, "Department is required"),
  jobRole: z.string().trim().min(1, "Job role is required"),
  requestedRole: z.enum(REQUESTABLE_ROLES, {
    errorMap: () => ({
      message: "Only Team Member or SM Manager can be requested",
    }),
  }),
  requestedProfileCodes: z
    .array(z.string())
    .min(1, "Please select at least one brand you work on"),
  reason: z
    .string()
    .trim()
    .min(
      10,
      "Please describe your role and the work you will do in the marketing team (min 10 characters)",
    ),
});
export type RequestAccessInput = z.infer<typeof requestAccessSchema>;
export const publicRequestAccessSchema = requestAccessSchema;
export type PublicRequestAccessInput = RequestAccessInput;

export const accessRequestReviewSchema = z.object({
  status: z
    .enum(["approved", "rejected", "info_needed"])
    .optional()
    .default("approved"),
  assignedRole: z.enum(ROLE_KEYS).optional(),
  departmentId: z.string().optional().nullable(),
  jobRole: z.string().optional(),
  weeklyCapacityHours: z.number().min(0).max(80).default(40).optional(),
  profileAccess: z.array(z.string()).optional(),
  reportsToIds: z.array(z.string()).optional(),
  reason: z.string().optional(),
  question: z.string().optional(),
});
export type AccessRequestReviewInput = z.infer<
  typeof accessRequestReviewSchema
>;

export const departmentSchema = z.object({
  name: z.string().min(2, "Department name is required"),
  code: z.string().min(2, "Department code is required"),
  description: z.string().optional(),
  lead: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const profileSchema = z.object({
  name: z.string().min(2, "Profile name is required"),
  code: z.string().min(2, "Profile code is required"),
  active: z.boolean().default(true),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const personCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  role: z.enum(ROLE_KEYS),
  jobRole: z.enum(JOB_ROLES).optional(),
  departmentId: z.string().optional().nullable(),
  profileAccess: z.array(z.string()).default([]),
  reportsToIds: z.array(z.string()).default([]),
  weeklyCapacityHours: z.number().min(0).max(80).default(40),
  password: z.string().min(8).optional(),
  workPreferences: z.array(z.enum(WORK_PREFERENCES)).default([]),
});
export type PersonCreateInput = z.infer<typeof personCreateSchema>;

export const personOperationalUpdateSchema = z.object({
  departmentId: z.string().optional().nullable(),
  jobRole: z.enum(JOB_ROLES).optional().nullable(),
  profileAccess: z.array(z.string()).optional(),
  reportsToIds: z.array(z.string()).optional(),
  weeklyCapacityHours: z.number().min(0).max(80).optional(),
  lastProfileId: z.string().optional().nullable(),
  workPreferences: z.array(z.enum(WORK_PREFERENCES)).optional(),
});
export type PersonOperationalUpdateInput = z.infer<
  typeof personOperationalUpdateSchema
>;

export const personAdminUpdateSchema = personOperationalUpdateSchema.extend({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLE_KEYS).optional(),
  status: z.enum(["invited", "active", "suspended"]).optional(),
});
export type PersonAdminUpdateInput = z.infer<typeof personAdminUpdateSchema>;

export const signUploadSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().positive("File size must be positive"),
  fileType: z.string().min(1, "File type is required"),
  deliverableType: z.enum(DELIVERABLE_TYPES).optional(),
  folder: z.string().optional(),
});
export type SignUploadInput = z.infer<typeof signUploadSchema>;

// Work Items Schemas
export const briefSchema = z.object({
  description: z.string().optional().default(""),
  contentLink: z.string().optional().default(""),
  assetsLink: z.string().optional().default(""),
});
export type BriefInput = z.infer<typeof briefSchema>;

export const workItemCreateSchema = z.object({
  title: z.string().trim().min(2, "Work item title is required"),
  workType: z.enum(WORK_TYPES),
  departmentId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  deadline: z.coerce.date(),
  estimatedEffortHrs: z.number().min(0.5).max(100).default(4),
  status: z.enum(WORK_ITEM_STATUSES).default("Not Started"),
  priority: z.enum(PRIORITIES).default("Medium"),
  description: z.string().optional(),
  deliverableUrl: z.string().optional(),
  publishedUrl: z.string().optional(),
  blockerReason: z.enum(BLOCKER_REASONS).optional(),
  blockerNote: z.string().optional(),
  profileId: z.string().optional(),
  // Content Flow stage fields (Phase 3 delta)
  contentPieceId: z.string().optional().nullable(),
  stageKey: z.string().optional().nullable(),
  stageOrder: z.number().int().min(1).optional().nullable(),
  reviewRequired: z.boolean().default(false).optional(),
  unlockedAt: z.coerce.date().optional().nullable(),
  isSkipped: z.boolean().default(false).optional(),
  contentLink: z.string().optional(),
  assetsLink: z.string().optional(),
  brief: z.union([z.string(), briefSchema]).optional(),
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

// Auto-Assignment & Workload Schemas
export const CAPACITY_BANDS = ["Healthy", "High", "Overloaded"] as const;
export type CapacityBand = (typeof CAPACITY_BANDS)[number];

export const assignmentRecommendSchema = z.object({
  workType: z.enum(WORK_TYPES).optional(),
  profileId: z.string().optional(),
  departmentId: z.string().optional(),
  deadline: z.coerce.date().optional(),
  estimatedEffortHrs: z.number().min(0.5).max(120).default(4),
  stageKey: z.string().optional().nullable(),
  workItemId: z.string().optional().nullable(),
});
export type AssignmentRecommendInput = z.infer<
  typeof assignmentRecommendSchema
>;

export const assignmentOverrideSchema = z.object({
  workItemId: z.string().min(1, "Work item ID is required"),
  recommendedPersonId: z.string().min(1, "Recommended person ID is required"),
  chosenPersonId: z.string().min(1, "Chosen person ID is required"),
  reason: z.string().min(3, "Override reason is required"),
  metadata: z.record(z.any()).optional(),
});
export type AssignmentOverrideInput = z.infer<typeof assignmentOverrideSchema>;

// Feedback Loops, Revision Flags & Blockers Schemas
export const FEEDBACK_ROUND_STATUSES = [
  "Revision Required",
  "Approved",
] as const;
export type FeedbackRoundStatus = (typeof FEEDBACK_ROUND_STATUSES)[number];

export const feedbackEntryCreateSchema = z.object({
  workItemId: z.string().min(1, "Work item ID is required"),
  round: z.number().int().min(1).default(1),
  roundStatus: z.enum(FEEDBACK_ROUND_STATUSES).default("Revision Required"),
  text: z.string().trim().min(2, "Feedback or response text is required"),
  isResponse: z.boolean().default(false),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url("Attachment URL must be valid"),
        fileType: z.string().optional(),
        size: z.number().optional(),
      }),
    )
    .optional(),
});
export type FeedbackEntryCreateInput = z.infer<
  typeof feedbackEntryCreateSchema
>;

export const revisionClassifySchema = z.object({
  rootCause: z.enum(REVISION_ROOT_CAUSES),
  rootCauseNotes: z.string().optional(),
});
export type RevisionClassifyInput = z.infer<typeof revisionClassifySchema>;

export const blockerCreateSchema = z
  .object({
    workItemId: z.string().min(1, "Work item ID is required"),
    reason: z.enum(BLOCKER_REASONS),
    notes: z.string().optional(),
    dependencyOwnerId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (BLOCKER_DEPENDENCY_REASONS.includes(data.reason)) {
        return Boolean(
          data.dependencyOwnerId && data.dependencyOwnerId.trim().length > 0,
        );
      }
      return true;
    },
    {
      message:
        "dependencyOwnerId is mandatory when blocker reason is Waiting for feedback, Waiting for content, or Waiting for data",
      path: ["dependencyOwnerId"],
    },
  );
export type BlockerCreateInput = z.infer<typeof blockerCreateSchema>;

export const blockerResolveSchema = z.object({
  resolutionNotes: z.string().optional(),
  resumeStatus: z.enum(WORK_ITEM_STATUSES).default("In Progress"),
});
export type BlockerResolveInput = z.infer<typeof blockerResolveSchema>;

// ==========================================
// Automation Rules & Report Definitions
// ==========================================

export const AUTOMATION_RULE_KEYS = [
  "month_end_report",
  "overdue_escalation",
  "todo_escalation",
  "blocker_dependency_alert",
  "revision_pattern_flag",
  "weekly_report",
] as const;
export type AutomationRuleKey = (typeof AUTOMATION_RULE_KEYS)[number];

export const automationRuleToggleSchema = z.object({
  active: z.boolean(),
});
export type AutomationRuleToggleInput = z.infer<
  typeof automationRuleToggleSchema
>;

export const automationRuleRunSchema = z.object({
  force: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});
export type AutomationRuleRunInput = z.infer<typeof automationRuleRunSchema>;

export const REPORT_KEYS = [
  "weekly_marketing",
  "monthly_scorecard",
  "creative_production",
  "team_performance",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_CADENCES = ["Weekly", "Monthly", "On Demand"] as const;
export type ReportCadence = (typeof REPORT_CADENCES)[number];

export const reportGenerateSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  profileId: z.string().optional(),
  departmentId: z.string().optional(),
  sendEmail: z.boolean().default(false),
});
export type ReportGenerateInput = z.infer<typeof reportGenerateSchema>;

// ==========================================
// 4. Content Flow & Pipelines (Scope Reset R3)
// ==========================================

export const PIPELINES = {
  DESIGN: "design",
  REEL_A: "reel_a",
  REEL_B: "reel_b",
  REEL_C: "reel_c",
} as const;
export type PipelineKey = (typeof PIPELINES)[keyof typeof PIPELINES];

export const STAGE_KEYS = [
  "Content",
  "Script",
  "Design",
  "Shoot",
  "Edit",
  "Post",
] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const REVIEW_STAGES: StageKey[] = ["Content", "Script", "Design", "Edit"];
export const NON_REVIEW_STAGES: StageKey[] = ["Shoot", "Post"];

export const POSTABLE_WORK_TYPES: WorkType[] = [
  "Reel",
  "Static Post",
  "Carousel Post",
  "Story",
  "Poster",
];

export const NON_POSTABLE_WORK_TYPES: WorkType[] = [
  "Cover Image",
  "Thumbnail",
  "Meta Ad Creative",
  "Class Announcement",
  "Orientation Creative",
  "Graduation Creative",
  "Offer Creative",
  "Brochure",
  "Certificate",
  "Placement Poster",
  "Custom Request",
];

export function isPostableWorkType(type: string): boolean {
  const norm = normalizeWorkType(type);
  return POSTABLE_WORK_TYPES.includes(norm as WorkType);
}

export function getPipelineForContent({
  contentType,
  needsScript,
  needsShoot,
}: {
  contentType: string;
  needsScript?: boolean;
  needsShoot?: boolean;
}): {
  pipeline: PipelineKey;
  stages: StageKey[];
  hasPostStage: boolean;
} {
  const norm = normalizeWorkType(contentType);
  if (norm === "Reel") {
    const withScript = Boolean(needsScript);
    const withShoot = Boolean(needsShoot);
    if (withScript && withShoot) {
      return {
        pipeline: "reel_a",
        stages: ["Script", "Shoot", "Edit", "Post"],
        hasPostStage: true,
      };
    }
    if (!withScript && withShoot) {
      return {
        pipeline: "reel_b",
        stages: ["Shoot", "Edit", "Post"],
        hasPostStage: true,
      };
    }
    return {
      pipeline: "reel_c",
      stages: ["Edit", "Post"],
      hasPostStage: true,
    };
  }
  const postable = isPostableWorkType(norm);
  const stages: StageKey[] = postable
    ? ["Content", "Design", "Post"]
    : ["Content", "Design"];
  return { pipeline: "design", stages, hasPostStage: postable };
}

// Due-date offsets (counted back in days from final date F)
export const STAGE_DUE_OFFSETS: Record<string, Record<string, number>> = {
  design_postable: { Content: 6, Design: 3, Post: 0 },
  design_non_postable: { Content: 5, Design: 2 },
  reel_a: { Script: 10, Shoot: 7, Edit: 4, Post: 0 },
  reel_b: { Shoot: 7, Edit: 4, Post: 0 },
  reel_c: { Edit: 4, Post: 0 },
};

export function calculateStageDueDate(
  finalDate: Date,
  pipeline: string,
  stage: StageKey,
  hasPostStage: boolean = true
): Date {
  let key = pipeline;
  if (pipeline === "design") {
    key = hasPostStage ? "design_postable" : "design_non_postable";
  }
  const offsetDays = STAGE_DUE_OFFSETS[key]?.[stage] ?? 0;
  const dueDate = new Date(finalDate);
  dueDate.setDate(dueDate.getDate() - offsetDays);
  return dueDate;
}

export const DISPLAY_WORDS = {
  DONE: "Done",
  APPROVED: "Approved",
  REVISION_REQUESTED: "Revision requested",
} as const;

export const CALENDAR_PLAN_KINDS = ["monthly", "project"] as const;
export type CalendarPlanKind = (typeof CALENDAR_PLAN_KINDS)[number];

export const CALENDAR_PLAN_STATUSES = [
  "Draft",
  "Submitted",
  "Changes requested",
  "Approved",
  "Approved with pending rows",
] as const;
export type CalendarPlanStatus = (typeof CALENDAR_PLAN_STATUSES)[number];

export const ROW_STATUSES = [
  "draft",
  "submitted",
  "changes_requested",
  "approved",
] as const;
export type RowStatus = (typeof ROW_STATUSES)[number];

export function derivePlanStatus(
  rows: { rowStatus: RowStatus }[],
  submittedAt?: Date | null
): CalendarPlanStatus {
  if (!rows || rows.length === 0) {
    return submittedAt ? "Submitted" : "Draft";
  }
  const total = rows.length;
  const approvedCount = rows.filter((r) => r.rowStatus === "approved").length;
  const changesCount = rows.filter(
    (r) => r.rowStatus === "changes_requested"
  ).length;
  const submittedCount = rows.filter((r) => r.rowStatus === "submitted").length;
  const draftCount = rows.filter((r) => r.rowStatus === "draft").length;

  if (approvedCount === total) return "Approved";
  if (
    approvedCount > 0 &&
    (draftCount > 0 || submittedCount > 0 || changesCount > 0)
  ) {
    return "Approved with pending rows";
  }
  if (changesCount > 0) return "Changes requested";
  if (submittedCount > 0 || submittedAt) return "Submitted";
  return "Draft";
}

// Calendar Plan Schemas
export const calendarPlanRowCreateSchema = z.object({
  postingDate: z.coerce.date(),
  topic: z.string().trim().min(2, "Topic must be at least 2 characters"),
  contentType: z.string().trim().min(1, "Content type is required"),
  needsScript: z.boolean().default(false).optional(),
  needsShoot: z.boolean().default(false).optional(),
  contentLink: z.string().optional().default(""),
  remarks: z.string().optional().default(""),
});
export type CalendarPlanRowCreateInput = z.infer<
  typeof calendarPlanRowCreateSchema
>;

export const calendarPlanCreateSchema = z.object({
  code: z.string().optional(),
  title: z.string().trim().min(2, "Plan title is required"),
  kind: z.enum(CALENDAR_PLAN_KINDS).default("monthly"),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  comment: z.string().optional().default(""),
  rows: z.array(calendarPlanRowCreateSchema).optional().default([]),
});
export type CalendarPlanCreateInput = z.infer<typeof calendarPlanCreateSchema>;

export const calendarPlanReviewSchema = z.object({
  action: z.enum(["approve_all", "approve_selected", "request_changes"]),
  approvedRowIds: z.array(z.string()).optional().default([]),
  selectedRowIds: z.array(z.string()).optional(),
  comments: z.record(z.string()).optional(),
  changes: z
    .array(
      z.object({
        rowId: z.string().min(1, "Row ID is required"),
        comment: z.string().trim().min(1, "Change request comment is required"),
      })
    )
    .optional()
    .default([]),
});
export type CalendarPlanReviewInput = z.infer<typeof calendarPlanReviewSchema>;

export const contentPieceAssignSchema = z.object({
  assignments: z.array(
    z.object({
      workItemId: z.string().min(1, "Work item ID is required"),
      assigneeId: z.string().min(1, "Assignee ID is required"),
      overrideReason: z.string().optional(),
    })
  ),
});
export type ContentPieceAssignInput = z.infer<typeof contentPieceAssignSchema>;

export const contentPieceRescheduleSchema = z.object({
  postingDate: z.coerce.date(),
  shiftUnstartedStages: z.boolean().default(true).optional(),
});
export type ContentPieceRescheduleInput = z.infer<
  typeof contentPieceRescheduleSchema
>;


