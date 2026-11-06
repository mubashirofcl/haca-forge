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
  "chat.use",
  "chat.group.create",
  "chat.moderate",
  "chat.read",
  "team.profile.view",
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
    "chat.use",
    "chat.group.create",
    "chat.moderate",
    "team.profile.view",
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
    "chat.use",
    "chat.group.create",
    "chat.moderate",
    "team.profile.view",
  ],
  executive: [
    "portal.view",
    "people.view",
    "analytics.team",
    "report.view",
    "chat.read",
    "team.profile.view",
  ],
  team_member: [
    "work.update.own",
    "work.request",
    "feedback.respond",
    "chat.use",
  ],
};

// ==========================================
// 2. Fixed Reference Taxonomies (Spec Section 14)
// ==========================================

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
  "Videographer",
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

export const JOB_ROLE_DEFAULT_WORK_PREFERENCES: Record<string, WorkPreference[]> = {
  Writer: ["Content", "Script"],
  Designer: ["Design"],
  "UI Designer": ["Design"],
  "Video Editor": ["Edit"],
  Videographer: ["Shoot"],
  "Social Media Manager": ["Post"],
  "Social Specialist": ["Post"],
};

export function getDefaultPreferencesForJobRole(jobRole?: string | null): WorkPreference[] {
  if (!jobRole) return [];
  return JOB_ROLE_DEFAULT_WORK_PREFERENCES[jobRole] || [];
}

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
  "Flyer",
  "Banner",
  "Standee",
  "ID Card",
  "Presentation",
  "Newsletter",
  "Merchandise",
  "Other",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const CANONICAL_DELIVERABLE_TYPES = [
  "Reel",
  "Static Post",
  "Carousel Post",
  "Story",
  "Poster",
  "Brochure",
  "Flyer",
  "Banner",
  "Standee",
  "Certificate",
  "ID Card",
  "Presentation",
  "Newsletter",
  "Merchandise",
  "Other",
] as const;

export const WORK_TYPE_ALIASES: Record<string, string> = {
  poster: "Poster",
  Flyer: "Flyer",
  flyer: "Flyer",
  "Reel A": "Reel",
  "Reel B": "Reel",
  "Reel C": "Reel",
  "reel a": "Reel",
  "reel b": "Reel",
  "reel c": "Reel",
  Reel: "Reel",
  reel: "Reel",
  reels: "Reel",
  "Reel / Video": "Reel",
  "reel / video": "Reel",
  "Reel/Video": "Reel",
  "reel/video": "Reel",
  Video: "Reel",
  video: "Reel",
  "Video Ad": "Reel",
  "YouTube Short/Video": "Reel",
  "Motion Graphic": "Reel",
  "motion graphic": "Reel",
  Carousel: "Carousel Post",
  carousel: "Carousel Post",
  "Carousel Post": "Carousel Post",
  "carousel post": "Carousel Post",
  "Static Post": "Static Post",
  "static post": "Static Post",
  Post: "Static Post",
  post: "Static Post",
  Story: "Story",
  story: "Story",
  "Article / Blog": "Other",
  "article / blog": "Other",
  Article: "Other",
  article: "Other",
  Blog: "Other",
  blog: "Other",
};

export function normalizeWorkType(type: string | null | undefined): string {
  if (!type) return "";
  const trimmed = type.trim();
  if (trimmed in WORK_TYPE_ALIASES) {
    return WORK_TYPE_ALIASES[trimmed];
  }
  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(WORK_TYPE_ALIASES)) {
    if (k.toLowerCase() === lower) {
      return v;
    }
  }
  for (const dt of CANONICAL_DELIVERABLE_TYPES) {
    if (dt.toLowerCase() === lower) {
      return dt;
    }
  }
  if (lower.includes("reel") || lower === "video" || lower.includes("video reel")) {
    return "Reel";
  }
  if (lower.includes("carousel")) {
    return "Carousel Post";
  }
  if (lower.includes("story") || lower.includes("stories")) {
    return "Story";
  }
  return trimmed;
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
  Flyer: "design",
  Banner: "design",
  Standee: "design",
  "ID Card": "design",
  Presentation: "design",
  Newsletter: "design",
  Merchandise: "design",
  Other: "design",
};

export const FOR_TEAMS = ["Sales", "Marketing", "Academics", "Other", "HACA"] as const;
export type ForTeam = (typeof FOR_TEAMS)[number];

export const CALENDAR_KEYS = [
  "sm",
  "sales",
  "ads",
  "academics_management",
  "other",
] as const;
export type CalendarKey = (typeof CALENDAR_KEYS)[number];

export interface CalendarDefinition {
  id: CalendarKey;
  key: CalendarKey;
  name: string;
  color: string;
  bg: string;
  border: string;
  text: string;
}

export const CALENDARS: Record<CalendarKey, CalendarDefinition> = {
  sm: {
    id: "sm",
    key: "sm",
    name: "SM",
    color: "#7a6af6",
    bg: "#ede9fe",
    border: "#c4b5fd",
    text: "#5b21b6",
  },
  sales: {
    id: "sales",
    key: "sales",
    name: "Sales Team",
    color: "#10b981",
    bg: "#d1fae5",
    border: "#a7f3d0",
    text: "#065f46",
  },
  ads: {
    id: "ads",
    key: "ads",
    name: "Ads Team",
    color: "#f59e0b",
    bg: "#fef3c7",
    border: "#fde68a",
    text: "#92400e",
  },
  academics_management: {
    id: "academics_management",
    key: "academics_management",
    name: "Academics and Management",
    color: "#0284c7",
    bg: "#e0f2fe",
    border: "#bae6fd",
    text: "#0369a1",
  },
  other: {
    id: "other",
    key: "other",
    name: "Other",
    color: "#64748b",
    bg: "#f1f5f9",
    border: "#e2e8f0",
    text: "#334155",
  },
};

export const CALENDAR_LIST: CalendarDefinition[] = [
  CALENDARS.sm,
  CALENDARS.sales,
  CALENDARS.ads,
  CALENDARS.academics_management,
  CALENDARS.other,
];

export function getCalendarDefinition(key?: string | null): CalendarDefinition {
  if (key && key in CALENDARS) {
    return CALENDARS[key as CalendarKey];
  }
  return CALENDARS.sm;
}


export const CANONICAL_PRIORITIES = ["Normal", "Urgent"] as const;
export const PRIORITIES = [
  "Normal",
  "Urgent",
  "Low",
  "Medium",
  "High",
] as const;
export type Priority = (typeof PRIORITIES)[number];

export function normalizePriority(p?: string | null): "Normal" | "Urgent" {
  if (!p) return "Normal";
  const lower = p.toLowerCase();
  if (lower === "urgent" || lower === "high") return "Urgent";
  return "Normal";
}

export const CANONICAL_BLOCKER_REASONS = [
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
  "Asset delay",
  "Brief clarification",
  "Dependency on external team",
  "Resource unavailable",
  "Scope change",
  "Client asset delay",
  "Software or tool failure",
] as const;
export type BlockerReason = (typeof BLOCKER_REASONS)[number];

// Reasons that require dependencyOwnerId to be specified
export const BLOCKER_DEPENDENCY_REASONS: BlockerReason[] = [
  "Waiting for feedback",
  "Waiting for content",
  "Waiting for data",
  "Asset delay",
  "Brief clarification",
  "Dependency on external team",
  "Client asset delay",
];

export const CANONICAL_REVISION_ROOT_CAUSES = [
  "Brief unclear",
  "Creative direction unclear",
  "Technical error",
  "Brand guideline deviation",
  "Scope change",
  "Approval delay",
  "Other",
] as const;

export const REVISION_ROOT_CAUSES = [
  "Brief unclear",
  "Creative direction unclear",
  "Technical error",
  "Brand guideline deviation",
  "Scope change",
  "Approval delay",
  "Other",
  "Brief ambiguity",
  "Script change",
  "Visual defect",
  "Audio issue",
  "TL approval delay",
] as const;
export type RevisionRootCause = (typeof REVISION_ROOT_CAUSES)[number];
/** The only values accepted for new revision classifications and revision requests. */
export type CanonicalRevisionRootCause = (typeof CANONICAL_REVISION_ROOT_CAUSES)[number];
/** Older values that may exist in saved records. Readable, never offered or accepted for new writes. */
export const LEGACY_REVISION_ROOT_CAUSES = REVISION_ROOT_CAUSES.filter(
  (c) => !(CANONICAL_REVISION_ROOT_CAUSES as readonly string[]).includes(c),
);
export function isCanonicalRevisionRootCause(value: unknown): value is CanonicalRevisionRootCause {
  return typeof value === "string" && (CANONICAL_REVISION_ROOT_CAUSES as readonly string[]).includes(value);
}

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
  image: 20 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  other: 50 * 1024 * 1024,
} as const;

// Role Workspaces Step Output Kinds
export const STEP_OUTPUT_KINDS = [
  "document",
  "video",
  "image",
  "pdf",
  "link",
] as const;
export type StepOutputKind = (typeof STEP_OUTPUT_KINDS)[number];

export const STAGE_PRIMARY_OUTPUT_KIND: Record<string, StepOutputKind> = {
  Content: "document",
  Script: "document",
  Shoot: "video",
  Edit: "video",
  Design: "image",
  Post: "link",
};

export const STAGE_FALLBACK_OUTPUT_KIND: Record<string, StepOutputKind> = {
  Content: "link",
  Script: "link",
  Shoot: "link",
  Edit: "link",
  Design: "pdf",
};

// Workspaces Upload Constants & Server-side Limits
export const UPLOAD_KINDS = ["video", "image", "pdf"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const UPLOAD_LIMITS_BYTES: Record<UploadKind, number> = {
  video: 500 * 1024 * 1024, // 500 MB (mp4, mov, webm)
  image: 20 * 1024 * 1024,  // 20 MB (png, jpg, webp)
  pdf: 50 * 1024 * 1024,    // 50 MB (pdf)
};

export const UPLOAD_ALLOWED_MIME_TYPES: Record<UploadKind, string[]> = {
  video: ["video/mp4", "video/quicktime", "video/webm"],
  image: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  pdf: ["application/pdf"],
};

export const UPLOAD_ALLOWED_EXTENSIONS: Record<UploadKind, string[]> = {
  video: [".mp4", ".mov", ".webm"],
  image: [".png", ".jpg", ".jpeg", ".webp"],
  pdf: [".pdf"],
};

// Workspaces Quality Rating Constants
export const RATING_SCORES = [1, 2, 3, 4, 5] as const;
export type RatingScore = (typeof RATING_SCORES)[number];

export const RATING_SCORE_LABELS: Record<RatingScore, string> = {
  1: "Needs a lot of work",
  2: "Below standard",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

export const RATING_TAGS = [
  "Great hook",
  "Clear message",
  "Needs polish",
  "Off brief",
] as const;
export type RatingTag = (typeof RATING_TAGS)[number];

// ==========================================
// 3. Zod Schemas
// ==========================================

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
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

// Strict Change Password for authenticated settings
export const changePasswordStrictSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password must match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });
export type ChangePasswordStrictInput = z.infer<typeof changePasswordStrictSchema>;

// Profile & Settings Taxonomies
export const START_PAGE_OPTIONS = ["Home", "My Work", "Calendar"] as const;
export type StartPageOption = (typeof START_PAGE_OPTIONS)[number];

export const DATE_FORMAT_OPTIONS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
export type DateFormatOption = (typeof DATE_FORMAT_OPTIONS)[number];

export const TIME_FORMAT_OPTIONS = ["12h", "24h"] as const;
export type TimeFormatOption = (typeof TIME_FORMAT_OPTIONS)[number];

export const WEEK_START_OPTIONS = ["monday", "sunday"] as const;
export type WeekStartOption = (typeof WEEK_START_OPTIONS)[number];

export const NOTIFICATION_CATEGORIES = [
  "mySteps",
  "approvalsRevisions",
  "messagesComments",
  "deadlinesOverdue",
  "planUpdates",
  "system",
  "chat",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const sendPhoneOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, "Please enter a valid mobile number (e.g. +919876543210)"),
});
export type SendPhoneOtpInput = z.infer<typeof sendPhoneOtpSchema>;

export const verifyPhoneOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, "Please enter a valid mobile number"),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Verification code must be exactly 6 digits"),
});
export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpSchema>;

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Full name must be at least 2 characters").max(100).optional(),
    preferredName: z.string().trim().max(60, "Preferred name must not exceed 60 characters").optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/, "Phone number must be a valid format (e.g. +919876543210)")
      .optional()
      .or(z.literal("")),
    phoneVerificationToken: z.string().optional(),
    enforceOtp: z.boolean().optional(),
    whatsappNumber: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/, "WhatsApp number must be a valid format (e.g. +919876543210)")
      .optional()
      .or(z.literal("")),
    languages: z.array(z.string().trim().max(40)).max(5, "Maximum 5 languages permitted").optional(),
    about: z.string().trim().max(200, "About must not exceed 200 characters").optional(),
    skills: z
      .array(z.string().trim().max(30, "Each skill tag must be up to 30 characters"))
      .max(10, "Maximum 10 skill tags permitted")
      .optional(),
  })
  .strict();
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const userPreferencesSchema = z
  .object({
    startPage: z.enum(START_PAGE_OPTIONS).optional(),
    dateFormat: z.enum(DATE_FORMAT_OPTIONS).optional(),
    timeFormat: z.enum(TIME_FORMAT_OPTIONS).optional(),
    weekStart: z.enum(WEEK_START_OPTIONS).optional(),
  })
  .strict();
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;

export const notificationCategoryPrefSchema = z
  .object({
    inApp: z.boolean(),
    email: z.boolean(),
    mentionsOnly: z.boolean().optional(),
  })
  .strict();
export type NotificationCategoryPref = z.infer<typeof notificationCategoryPrefSchema>;

export const notificationPrefsSchema = z
  .object({
    mySteps: notificationCategoryPrefSchema.optional(),
    approvalsRevisions: notificationCategoryPrefSchema.optional(),
    messagesComments: notificationCategoryPrefSchema.optional(),
    deadlinesOverdue: notificationCategoryPrefSchema.optional(),
    planUpdates: notificationCategoryPrefSchema.optional(),
    system: notificationCategoryPrefSchema.optional(),
    chat: notificationCategoryPrefSchema.optional(),
  })
  .strict();
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;

export const settingsUpdateSchema = z
  .object({
    preferences: userPreferencesSchema.optional(),
    notificationPrefs: notificationPrefsSchema.optional(),
  })
  .strict();
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

export const changeRequestSchema = z
  .object({
    requestedChanges: z
      .string()
      .trim()
      .min(5, "Please provide at least 5 characters describing your requested changes")
      .max(1000, "Request message must not exceed 1000 characters"),
  })
  .strict();
export type ChangeRequestInput = z.infer<typeof changeRequestSchema>;

export const adminUpdatePersonBasicSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/, "Valid phone number required")
      .optional()
      .or(z.literal("")),
  })
  .strict();
export type AdminUpdatePersonBasicInput = z.infer<typeof adminUpdatePersonBasicSchema>;

export const welcomeCompleteSchema = z
  .object({
    name: z.string().trim().min(2, "Full name must be at least 2 characters"),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{6,14}$/, "Valid phone number required (e.g. +919876543210)"),
    avatarUrl: z.string().trim().optional().nullable(),
    avatarStorageId: z.string().trim().optional().nullable(),
  })
  .strict();
export type WelcomeCompleteInput = z.infer<typeof welcomeCompleteSchema>;

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
  requestedProfileCodes: z.array(z.string()).optional().default([]),
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
  profileAccess: z.array(z.string()).optional().default([]),
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

export const personCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  role: z.enum(ROLE_KEYS),
  jobRole: z.enum(JOB_ROLES).optional(),
  departmentId: z.string().optional().nullable(),
  reportsToIds: z.array(z.string()).default([]),
  weeklyCapacityHours: z.number().min(0).max(80).default(40),
  password: z.string().min(8).optional(),
  workPreferences: z.array(z.enum(WORK_PREFERENCES)).default([]),
});
export type PersonCreateInput = z.infer<typeof personCreateSchema>;

export const personOperationalUpdateSchema = z.object({
  departmentId: z.string().optional().nullable(),
  jobRole: z.enum(JOB_ROLES).optional().nullable(),
  reportsToIds: z.array(z.string()).optional(),
  weeklyCapacityHours: z.number().min(0).max(80).optional(),
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
  kind: z.enum(UPLOAD_KINDS).optional(),
  pieceId: z.string().optional(),
  contentPieceId: z.string().optional(),
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
  priority: z.enum(PRIORITIES).default("Normal"),
  description: z.string().optional(),
  deliverableUrl: z.string().optional(),
  publishedUrl: z.string().optional(),
  blockerReason: z.enum(BLOCKER_REASONS).optional(),
  blockerNote: z.string().optional(),
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
  // New classifications: canonical values only (legacy values stay readable on saved flags).
  rootCause: z.enum(CANONICAL_REVISION_ROOT_CAUSES),
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

export const REVIEW_STAGES: StageKey[] = ["Content", "Script", "Shoot", "Design", "Edit"];
export const NON_REVIEW_STAGES: StageKey[] = ["Post"];

// 15 Deliverable Types (Workflow V2)
export const DELIVERABLE_TYPES_CONFIG = [
  { type: "Reel", isPostable: true, label: "Reel" },
  { type: "Static Post", isPostable: true, label: "Static Post" },
  { type: "Carousel Post", isPostable: true, label: "Carousel Post" },
  { type: "Story", isPostable: true, label: "Story" },
  { type: "Poster", isPostable: false, label: "Poster" },
  { type: "Brochure", isPostable: false, label: "Brochure" },
  { type: "Flyer", isPostable: false, label: "Flyer" },
  { type: "Banner", isPostable: false, label: "Banner" },
  { type: "Standee", isPostable: false, label: "Standee" },
  { type: "Certificate", isPostable: false, label: "Certificate" },
  { type: "ID Card", isPostable: false, label: "ID Card" },
  { type: "Presentation", isPostable: false, label: "Presentation" },
  { type: "Newsletter", isPostable: false, label: "Newsletter" },
  { type: "Merchandise", isPostable: false, label: "Merchandise" },
  { type: "Other", isPostable: false, label: "Other" },
] as const;

export const DELIVERABLE_TYPE_KEYS = DELIVERABLE_TYPES_CONFIG.map((d) => d.type);
export type DeliverableTypeKey = (typeof DELIVERABLE_TYPE_KEYS)[number];

export const POSTABLE_WORK_TYPES = [
  "Reel",
  "Static Post",
  "Carousel Post",
  "Story",
] as const;

export const NON_POSTABLE_WORK_TYPES = [
  "Poster",
  "Brochure",
  "Flyer",
  "Banner",
  "Standee",
  "Certificate",
  "ID Card",
  "Presentation",
  "Newsletter",
  "Merchandise",
  "Other",
  // Legacy compatibility types
  "Cover Image",
  "Thumbnail",
  "Meta Ad Creative",
  "Class Announcement",
  "Orientation Creative",
  "Graduation Creative",
  "Offer Creative",
  "Placement Poster",
  "Custom Request",
] as const;

export function isPostableWorkType(type: string): boolean {
  if (type === "Poster" || type === "poster") return false;
  const norm = normalizeWorkType(type);
  if (norm === "Poster" || (NON_POSTABLE_WORK_TYPES as readonly string[]).includes(type)) return false;
  return (POSTABLE_WORK_TYPES as readonly string[]).includes(norm);
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
  const postable = isPostableWorkType(contentType);
  const stages: StageKey[] = postable
    ? ["Content", "Design", "Post"]
    : ["Content", "Design"];
  return { pipeline: "design", stages, hasPostStage: postable };
}

// Due-date offsets (counted back in calendar days from final date F per Workflow V2)
export const STAGE_DUE_OFFSETS: Record<string, Record<string, number>> = {
  design_postable: { Content: 5, Design: 2, Post: 0 },
  design_non_postable: { Content: 5, Design: 2 },
  reel_a: { Script: 8, Shoot: 5, Edit: 2, Post: 0 },
  reel_b: { Shoot: 5, Edit: 2, Post: 0 },
  reel_c: { Edit: 2, Post: 0 },
};

// Default stage effort hours (internal engine config, never shown in user forms)
export const DEFAULT_STAGE_HOURS: Record<StageKey, number> = {
  Content: 2,
  Script: 2,
  Design: 4,
  Shoot: 4,
  Edit: 6,
  Post: 1,
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

// Exactly two plan kinds: monthly and individual (project removed)
export const CALENDAR_PLAN_KINDS = ["monthly", "individual", "project"] as const;
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

// Validation Codes (Workflow V2 Section 5)
export const VALIDATION_ERROR_CODES = {
  MISSING_REQUIRED_FIELDS: "MISSING_REQUIRED_FIELDS",
  UNKNOWN_TYPE: "UNKNOWN_TYPE",
  PAST_DATE: "PAST_DATE",
  DEADLINE_AFTER_POSTING: "DEADLINE_AFTER_POSTING",
  OUT_OF_ORDER_DEADLINES: "OUT_OF_ORDER_DEADLINES",
  MISSING_SOURCE_VIDEO: "MISSING_SOURCE_VIDEO",
  MISSING_POSTING_OWNER: "MISSING_POSTING_OWNER",
  INVALID_STAGE_OWNER: "INVALID_STAGE_OWNER",
  DUPLICATE_ROW: "DUPLICATE_ROW",
  INDIVIDUAL_PLAN_ROW_LIMIT: "INDIVIDUAL_PLAN_ROW_LIMIT",
} as const;
export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[keyof typeof VALIDATION_ERROR_CODES];

export const VALIDATION_WARNING_CODES = {
  TIGHT_CREATION_BUFFER: "TIGHT_CREATION_BUFFER",
  WORKLOAD_SATURATION: "WORKLOAD_SATURATION",
  MONTH_MISMATCH: "MONTH_MISMATCH",
} as const;
export type ValidationWarningCode = (typeof VALIDATION_WARNING_CODES)[keyof typeof VALIDATION_WARNING_CODES];

export function derivePlanStatus(
  rows: { rowStatus: RowStatus }[],
  submittedAt?: Date | null
): CalendarPlanStatus {
  if (!rows || rows.length === 0) {
    return "Draft";
  }
  const total = rows.length;
  const approvedCount = rows.filter((r) => r.rowStatus === "approved").length;
  const changesCount = rows.filter(
    (r) => r.rowStatus === "changes_requested"
  ).length;
  const submittedCount = rows.filter((r) => r.rowStatus === "submitted").length;
  const draftCount = rows.filter((r) => r.rowStatus === "draft").length;

  if (approvedCount === total && total > 0) return "Approved";
  if (
    approvedCount > 0 &&
    (draftCount > 0 || submittedCount > 0 || changesCount > 0)
  ) {
    return "Approved with pending rows";
  }
  if (changesCount > 0) return "Changes requested";
  if (submittedCount > 0) return "Submitted";
  return "Draft";
}

export function formatPlanRowCounts(counts?: {
  draft?: number;
  submitted?: number;
  changes_requested?: number;
  approved?: number;
  total?: number;
} | null): string {
  if (!counts) return "No rows yet";
  const total =
    counts.total ??
    ((counts.draft || 0) +
      (counts.submitted || 0) +
      (counts.changes_requested || 0) +
      (counts.approved || 0));
  if (total === 0) return "No rows yet";

  const parts: string[] = [];
  if (counts.approved && counts.approved > 0) parts.push(`${counts.approved} approved`);
  if (counts.submitted && counts.submitted > 0) parts.push(`${counts.submitted} submitted`);
  if (counts.changes_requested && counts.changes_requested > 0) parts.push(`${counts.changes_requested} changes requested`);
  if (counts.draft && counts.draft > 0) parts.push(`${counts.draft} draft`);

  const rowsLabel = total === 1 ? "1 row" : `${total} rows`;
  return parts.length > 0 ? `${rowsLabel}: ${parts.join(", ")}` : rowsLabel;
}

// Stage Plan Item inside a draft row
export const stagePlanItemSchema = z.object({
  stageKey: z.enum(STAGE_KEYS),
  ownerId: z.string().optional().nullable(),
  dueDate: z.coerce.date(),
  ownerSource: z.enum(["suggested", "manual"]).default("suggested"),
  dueDateSource: z.enum(["auto", "manual"]).default("auto"),
  overrideReason: z.string().optional(),
});
export type StagePlanItem = z.infer<typeof stagePlanItemSchema>;

// Calendar Plan Schemas (Workflow V2)
export const calendarPlanRowCreateSchema = z.object({
  postingDate: z.coerce.date(),
  postingTime: z.string().optional().default("18:00"),
  topic: z.string().trim().min(2, "Topic must be at least 2 characters"),
  type: z.string().trim().min(1, "Deliverable type is required"),
  contentType: z.string().optional(), // alias
  forTeam: z.string().optional(),
  calendar: z.enum(CALENDAR_KEYS).optional(),
  programOrEvent: z.string().optional().default(""),
  brief: z.string().optional().default(""),
  referenceLink: z.string().optional().default(""),
  priority: z.enum(PRIORITIES).default("Normal"),
  remarks: z.string().optional().default(""),
  postingOwnerId: z.string().optional().nullable(),
  needsScript: z.boolean().default(false).optional(),
  needsShoot: z.boolean().default(false).optional(),
  sourceVideoLink: z.string().optional().default(""),
  rowStatus: z.enum(ROW_STATUSES).default("draft"),
  reviewComment: z.string().optional().default(""),
  stagePlan: z.array(stagePlanItemSchema).optional().default([]),
});
export type CalendarPlanRowCreateInput = z.infer<
  typeof calendarPlanRowCreateSchema
>;

export const calendarPlanCreateSchema = z.object({
  code: z.string().optional(),
  title: z.string().trim().optional(),
  calendar: z.enum(CALENDAR_KEYS).default("sm"),
  kind: z.enum(CALENDAR_PLAN_KINDS).default("monthly"),
  /** Monthly plans: 'YYYY-MM'. When given, the period is that whole month. */
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  comment: z.string().optional().default(""),
  rejectionConcern: z.string().optional().default(""),
  rows: z.array(calendarPlanRowCreateSchema).optional().default([]),
});
export type CalendarPlanCreateInput = z.infer<typeof calendarPlanCreateSchema>;

export const calendarPlanReviewSchema = z.object({
  action: z.enum(["approve_all", "approve_selected", "request_changes", "reject"]),
  approvedRowIds: z.array(z.string()).optional().default([]),
  selectedRowIds: z.array(z.string()).optional(),
  comments: z.record(z.string()).optional(),
  rejectionConcern: z.string().optional(),
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

// ==========================================
// 8. Shared Work Actions & Role Authorization Matrix
// ==========================================

export const WORK_ACTION_KEYS = [
  "start",
  "submit_for_approval",
  "mark_as_posted",
  "mark_blocked",
  "request_help",
  "approve",
  "request_revision",
  "change_owner",
  "change_date",
  "skip_step",
  "resolve_blocker",
  "edit_details",
  "delete",
] as const;

export type WorkActionKey = (typeof WORK_ACTION_KEYS)[number];

export const ACTION_LABELS: Record<WorkActionKey, string> = {
  start: "Start",
  submit_for_approval: "Submit for approval",
  mark_as_posted: "Mark as posted",
  mark_blocked: "Mark blocked",
  request_help: "Request help",
  approve: "Approve",
  request_revision: "Request revision",
  change_owner: "Change owner",
  change_date: "Change date",
  skip_step: "Skip step",
  resolve_blocker: "Resolve blocker",
  edit_details: "Edit details",
  delete: "Delete",
};

export interface WorkActionStageContext {
  _id?: string;
  id?: string;
  ownerId?: any;
  status?: string;
  stageKey?: string | null;
  stageOrder?: number | null;
  isLocked?: boolean;
  isSkipped?: boolean;
  reviewRequired?: boolean;
  blockerReason?: string | null;
  deliverableUrl?: string | null;
  publishedUrl?: string | null;
  startedAt?: string | Date | null;
  previousStage?: {
    stageKey?: string;
    owner?: { name?: string };
    status?: string;
  } | null;
  pieceStages?: any[];
}

export interface WorkActionPieceContext {
  _id?: string;
  topic?: string;
  contentType?: string;
  pipeline?: string;
  stages?: any[];
}

export interface AvailableActionsResult {
  actions: WorkActionKey[];
  isOwner: boolean;
  reason?: string;
}

/**
 * Returns available actions for a user on a given stage/task.
 * Strictly enforces:
 * - A user never gets owner actions on a task they do not own, even with permission keys.
 * - creative_head and admin: Approve and Request revision only when Waiting for approval (Pending) and user is not owner. Nothing else on tasks they don't own.
 * - sm_manager and admin: Change owner, Change date, Skip step (before start), Resolve blocker, Edit details, Delete (before start). No approve, no submit.
 * - executive and non-owners without role rights: no action buttons.
 */
export function getAvailableActions(
  user: { _id?: string; id?: string; userId?: string; role?: string; name?: string } | null | undefined,
  stage: WorkActionStageContext | null | undefined,
  piece?: WorkActionPieceContext | null | undefined
): AvailableActionsResult {
  if (!user || !stage) {
    return { actions: [], isOwner: false, reason: "No user or stage" };
  }

  const userId = (user.userId || user._id || user.id)?.toString();
  const rawOwner = stage.ownerId;
  const stageOwnerId = (rawOwner?._id || rawOwner?.id || rawOwner)?.toString();
  const isOwner = Boolean(userId && stageOwnerId && userId === stageOwnerId);
  const role = normalizeRole(user.role);

  const status = stage.status || "Not Started";
  const isLocked = Boolean(stage.isLocked);
  const isSkipped = Boolean(stage.isSkipped);
  const stageKey = stage.stageKey;

  const actions: WorkActionKey[] = [];

  // 1. Owner Actions (strictly while unlocked and not skipped)
  if (isOwner && !isLocked && !isSkipped) {
    if (status === "Not Started") {
      actions.push("start");
    } else if (status === "In Progress") {
      if (stageKey === "Post") {
        actions.push("mark_as_posted");
      } else {
        // Review steps: Content, Script, Shoot, Design, Edit (or generic reviewable step)
        actions.push("submit_for_approval");
      }
      actions.push("mark_blocked");
      actions.push("request_help");
    } else if (status === "Feedback") {
      actions.push("submit_for_approval");
      actions.push("mark_blocked");
      actions.push("request_help");
    } else if (status === "Blocked") {
      actions.push("request_help");
    } else if (status === "Approved" && stageKey === "Post") {
      actions.push("mark_as_posted");
    }
  }

  // 2. Creative Head Actions (Approve & Request revision ONLY on Pending tasks they do NOT own)
  if ((role === "creative_head" || role === "admin") && !isOwner) {
    if (status === "Pending") {
      actions.push("approve");
      actions.push("request_revision");
    }
  }

  // 3. SM Manager & Admin Actions (Change owner, Change date, Skip step, Resolve blocker, Edit, Delete)
  if (role === "sm_manager" || role === "admin") {
    // Only management actions, no approve, no submit (unless owner of the stage handled above)
    if (status !== "Published") {
      actions.push("change_owner");
      actions.push("change_date");
    }

    if (status === "Not Started" && !stage.startedAt && !isSkipped) {
      actions.push("skip_step");
    }

    if (status === "Blocked") {
      actions.push("resolve_blocker");
    }

    if (status !== "Published") {
      actions.push("edit_details");
    }

    if (status === "Not Started" && !stage.startedAt) {
      actions.push("delete");
    }
  }

  // 4. Compute reason if no actions available for viewer
  let reason: string | undefined;
  if (actions.length === 0) {
    reason = getActionDisabledReason(user, stage, piece);
  }

  return { actions, isOwner, reason };
}

/**
 * Returns a user-friendly one-line reason when the viewer has no active actions on a stage.
 */
export function getActionDisabledReason(
  user: { _id?: string; id?: string; userId?: string; role?: string; name?: string } | null | undefined,
  stage: WorkActionStageContext | null | undefined,
  piece?: WorkActionPieceContext | null | undefined
): string {
  if (!stage) return "No task found";

  const userId = (user?.userId || user?._id || user?.id)?.toString();
  const rawOwner = stage.ownerId;
  const stageOwnerId = (rawOwner?._id || rawOwner?.id || rawOwner)?.toString();
  const isOwner = Boolean(userId && stageOwnerId && userId === stageOwnerId);
  const ownerName = rawOwner?.name || "the owner";
  const status = stage.status || "Not Started";

  if (stage.isSkipped) {
    return "This step was skipped";
  }

  if (stage.isLocked) {
    const prevKey =
      stage.previousStage?.stageKey ||
      stage.pieceStages?.find(
        (s: any) => s.status !== 'Approved' && s.status !== 'Published' && s.stageKey !== stage.stageKey
      )?.stageKey;
    if (prevKey) {
      return `Locked until the ${prevKey} step is approved`;
    }
    return "Locked until the previous step is approved";
  }

  if (status === "Pending") {
    if (isOwner) {
      return "Waiting for the Creative Head";
    }
    return "Waiting for the Creative Head";
  }

  if (status === "Blocked") {
    if (stage.blockerReason) {
      return `Blocked: ${stage.blockerReason}`;
    }
    return "Blocked waiting on resolution";
  }

  if (status === "Not Started") {
    if (!isOwner) {
      return `Waiting for ${ownerName} to start`;
    }
    return "Not started";
  }

  if (status === "In Progress") {
    if (!isOwner) {
      return `Waiting for ${ownerName}`;
    }
    return "In progress";
  }

  if (status === "Feedback") {
    if (!isOwner) {
      return `Waiting for ${ownerName} to revise`;
    }
    return "Revision requested";
  }

  if (status === "Approved") {
    return "Approved";
  }

  if (status === "Published") {
    return "Published live";
  }

  return "";
}

// ==========================================
// 9. Workspaces Submissions, Comments & Ratings Schemas
// ==========================================

export const COMMENT_ANCHOR_TYPES = ["text", "time", "point"] as const;
export type CommentAnchorType = (typeof COMMENT_ANCHOR_TYPES)[number];

export const submissionCommentAnchorSchema = z.object({
  type: z.enum(COMMENT_ANCHOR_TYPES),
  range: z
    .object({
      from: z.number().optional(),
      to: z.number().optional(),
      text: z.string().optional(),
    })
    .optional(),
  seconds: z.number().min(0).optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  page: z.number().int().min(1).optional(),
});
export type SubmissionCommentAnchor = z.infer<typeof submissionCommentAnchorSchema>;

export const submissionFileItemSchema = z.object({
  url: z.string().min(1, "File URL is required"),
  size: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  mime: z.string().optional(),
  name: z.string().optional(),
});
export type SubmissionFileItem = z.infer<typeof submissionFileItemSchema>;

export const submissionDraftSaveSchema = z.object({
  kind: z.enum(STEP_OUTPUT_KINDS).optional(),
  document: z
    .object({
      json: z.any().optional(),
      htmlSnapshot: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .passthrough()
    .optional(),
  files: z.array(submissionFileItemSchema).optional(),
  linkUrl: z.string().url("Invalid link URL").or(z.literal("")).optional(),
  notes: z.string().max(5000).optional(),
  versionToken: z.string().optional(),
});
export type SubmissionDraftSaveInput = z.infer<typeof submissionDraftSaveSchema>;

export const submissionSubmitSchema = z.object({
  kind: z.enum(STEP_OUTPUT_KINDS).optional(),
  document: z
    .object({
      json: z.any().optional(),
      htmlSnapshot: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .passthrough()
    .optional(),
  files: z.array(submissionFileItemSchema).optional(),
  linkUrl: z.string().url("Invalid link URL").or(z.literal("")).optional(),
  notes: z.string().max(5000).optional(),
});
export type SubmissionSubmitInput = z.infer<typeof submissionSubmitSchema>;

export const submissionCommentCreateSchema = z.object({
  text: z.string().trim().min(1, "Comment text is required"),
  anchor: submissionCommentAnchorSchema.optional(),
  parentId: z.string().optional().nullable(),
});
export type SubmissionCommentCreateInput = z.infer<typeof submissionCommentCreateSchema>;

export const submissionReviewApproveSchema = z.object({
  score: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional().default(""),
  tags: z.array(z.enum(RATING_TAGS)).optional().default([]),
  alsoShareToTeamChat: z.boolean().optional().default(false),
});
export type SubmissionReviewApproveInput = z.infer<typeof submissionReviewApproveSchema>;

export const submissionReviewRevisionSchema = z.object({
  comment: z.string().trim().min(1, "Revision comment or note is required"),
  // New revision requests: canonical values only.
  rootCause: z.enum(CANONICAL_REVISION_ROOT_CAUSES).optional(),
});
export type SubmissionReviewRevisionInput = z.infer<typeof submissionReviewRevisionSchema>;

export const ratingEditSchema = z.object({
  score: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(2000).optional(),
  tags: z.array(z.enum(RATING_TAGS)).optional(),
  reason: z.string().trim().min(1, "Reason for editing rating is required"),
});
export type RatingEditInput = z.infer<typeof ratingEditSchema>;

// ==========================================
// 10. Canonical Workspace Modes & Status Words
// ==========================================

export type WorkspaceMode = "edit" | "read" | "review" | "none";

export interface WorkspaceModeInfo {
  mode: WorkspaceMode;
  reason?: string;
  isOwner: boolean;
  canEdit: boolean;
}

export const STEP_STATUS_LABELS: Record<string, string> = {
  "not started": "Not started",
  "not_started": "Not started",
  "in progress": "In progress",
  "in_progress": "In progress",
  feedback: "Changes requested",
  "changes requested": "Changes requested",
  "changes_requested": "Changes requested",
  "revision requested": "Changes requested",
  pending: "Waiting for approval",
  "waiting for approval": "Waiting for approval",
  "waiting_for_approval": "Waiting for approval",
  blocked: "Blocked",
  approved: "Approved",
  published: "Published",
  posted: "Published",
};

export function getStepStatusLabel(
  status: WorkItemStatus | string | null | undefined,
): string {
  if (!status) return "";
  const key = status.toLowerCase().replace(/_/g, " ").trim();
  return STEP_STATUS_LABELS[key] || status;
}

export function normalizeStatusKey(
  status: string | null | undefined,
): string {
  if (!status) return "not started";
  const s = status.toLowerCase().replace(/_/g, " ").trim();
  if (s === "feedback" || s === "changes requested" || s === "revision requested") {
    return "changes requested";
  }
  if (s === "pending" || s === "waiting for approval") {
    return "waiting for approval";
  }
  if (s === "in progress") return "in progress";
  if (s === "not started") return "not started";
  if (s === "blocked") return "blocked";
  if (s === "approved") return "approved";
  if (s === "published" || s === "posted") return "posted";
  return s;
}

/**
 * Canonical workspace access decision engine.
 * Rules:
 * - the owner of an unlocked step gets edit in the states not started, in progress, changes requested and blocked
 *   (blocked keeps edit but shows the blocker banner);
 * - waiting for approval gives the owner read;
 * - approved and posted give read;
 * - locked gives none for the owner with the message 'Locked until <previous step> is approved'.
 * - creative_head and admin get read on every step and review on a step waiting for approval.
 * - sm_manager and executive get read.
 * - Other owners in the same piece get read of earlier steps only.
 * - Ownership is compared as strings of the id on the stage item, never through the piece.
 */
export function getWorkspaceModeInfo(
  user:
    | { _id?: string; id?: string; userId?: string; role?: string; name?: string }
    | null
    | undefined,
  stage: any,
  piece?: any,
): WorkspaceModeInfo {
  if (!user || !stage) {
    return {
      mode: "none",
      isOwner: false,
      canEdit: false,
      reason: "No user or stage specified",
    };
  }

  const userId = (user.userId || user._id || user.id)?.toString();
  const rawOwner = stage.ownerId;
  const stageOwnerId = (rawOwner?._id || rawOwner?.id || rawOwner)?.toString();
  const isOwner = Boolean(userId && stageOwnerId && userId === stageOwnerId);
  const role = normalizeRole(user.role);

  const statusKey = normalizeStatusKey(stage.status);
  const isLocked = Boolean(stage.isLocked);
  const isSkipped = Boolean(stage.isSkipped);

  // 1. Locked check for the owner
  if (isOwner && isLocked) {
    let prevName = stage.previousStage?.stageKey;
    if (!prevName && Array.isArray(stage.pieceStages)) {
      const curOrder = stage.stageOrder || 0;
      const prev = stage.pieceStages.find(
        (s: any) => s.stageOrder === curOrder - 1,
      );
      if (prev?.stageKey) prevName = prev.stageKey;
    }
    if (!prevName && piece && Array.isArray(piece.stagePlan)) {
      const curOrder = stage.stageOrder || 0;
      const prev = piece.stagePlan[curOrder - 2];
      if (prev?.stageKey) prevName = prev.stageKey;
    }
    const reason = prevName
      ? `Locked until ${prevName} is approved`
      : "Locked until previous step is approved";
    return { mode: "none", isOwner: true, canEdit: false, reason };
  }

  // 2. Step Owner (unlocked)
  if (isOwner) {
    if (isSkipped) {
      return {
        mode: "read",
        isOwner: true,
        canEdit: false,
        reason: "This step was skipped",
      };
    }
    if (
      statusKey === "not started" ||
      statusKey === "in progress" ||
      statusKey === "changes requested" ||
      statusKey === "blocked"
    ) {
      const reason =
        statusKey === "blocked"
          ? stage.blockerReason
            ? `Blocked: ${stage.blockerReason}`
            : "Blocked"
          : undefined;
      return { mode: "edit", isOwner: true, canEdit: true, reason };
    }
    if (statusKey === "waiting for approval") {
      return {
        mode: "read",
        isOwner: true,
        canEdit: false,
        reason: "Waiting for approval",
      };
    }
    if (statusKey === "approved") {
      return {
        mode: "read",
        isOwner: true,
        canEdit: false,
        reason: "Approved",
      };
    }
    if (statusKey === "posted") {
      return {
        mode: "read",
        isOwner: true,
        canEdit: false,
        reason: "Published",
      };
    }
    return {
      mode: "read",
      isOwner: true,
      canEdit: false,
      reason: stage.status || "Read only",
    };
  }

  // 3. creative_head and admin
  if (role === "creative_head" || role === "admin") {
    if (statusKey === "waiting for approval") {
      return {
        mode: "review",
        isOwner: false,
        canEdit: false,
        reason: "Ready for review",
      };
    }
    return {
      mode: "read",
      isOwner: false,
      canEdit: false,
      reason: "Read only",
    };
  }

  // 4. sm_manager and executive
  if (role === "sm_manager" || role === "executive") {
    return {
      mode: "read",
      isOwner: false,
      canEdit: false,
      reason: "Read only",
    };
  }

  // 5. Other owners in the same piece get read of earlier steps only.
  const pieceStagesList: any[] =
    stage.pieceStages ||
    piece?.workItems ||
    piece?.stages ||
    piece?.stagePlan ||
    [];
  let userStagesInPiece: any[] = [];
  if (userId) {
    userStagesInPiece = pieceStagesList.filter((s: any) => {
      const sOwner = (s.ownerId?._id || s.ownerId?.id || s.ownerId)?.toString();
      return sOwner === userId;
    });
  }

  if (userStagesInPiece.length > 0) {
    const curStageOrder = stage.stageOrder || 1;
    const userMinOrder = Math.min(
      ...userStagesInPiece.map(
        (s: any) =>
          s.stageOrder || pieceStagesList.indexOf(s) + 1,
      ),
    );
    if (curStageOrder < userMinOrder) {
      return {
        mode: "read",
        isOwner: false,
        canEdit: false,
        reason: "Earlier step deliverable",
      };
    }
    return {
      mode: "none",
      isOwner: false,
      canEdit: false,
      reason: "Only earlier steps in this piece can be viewed",
    };
  }

  // Non-owner with no assignment in piece
  return {
    mode: "none",
    isOwner: false,
    canEdit: false,
    reason: "No access to this stage",
  };
}

export function getWorkspaceMode(
  user:
    | { _id?: string; id?: string; userId?: string; role?: string; name?: string }
    | null
    | undefined,
  stage: any,
  piece?: any,
): WorkspaceMode {
  return getWorkspaceModeInfo(user, stage, piece).mode;
}

// ==========================================
// 11. Shoot Workspace Media Items & Messages
// ==========================================

export const MEDIA_ITEM_STATUSES = [
  "uploading",
  "uploaded",
  "waiting_review",
  "approved",
  "reshoot_needed",
] as const;
export type MediaItemStatus = (typeof MEDIA_ITEM_STATUSES)[number];

export const MEDIA_ITEM_STATUS_LABELS: Record<MediaItemStatus, string> = {
  uploading: "Uploading",
  uploaded: "Uploaded",
  waiting_review: "Waiting for review",
  approved: "Approved",
  reshoot_needed: "Reshoot needed",
};

export function getMediaItemStatusLabel(
  status: MediaItemStatus | string | null | undefined,
): string {
  if (!status) return "";
  return (MEDIA_ITEM_STATUS_LABELS as any)[status] || status;
}

export const mediaItemCreateSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Valid media URL required")
    .refine(
      (val) =>
        val.startsWith("/") ||
        val.startsWith("http://") ||
        val.startsWith("https://") ||
        val.startsWith("blob:"),
      { message: "Valid media URL required" }
    ),
  storageId: z.string().optional().default(""),
  thumbnailUrl: z.string().optional().default(""),
  kind: z.enum(["video", "image"]).default("video"),
  title: z.string().trim().min(1, "Title is required"),
  shotRef: z.string().optional().default(""),
  take: z.number().int().min(1).default(1),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional().default(""),
  favourite: z.boolean().default(false),
  order: z.number().int().default(0),
  durationSeconds: z.number().min(0).default(0),
  width: z.number().int().min(0).default(0),
  height: z.number().int().min(0).default(0),
  orientationOk: z.boolean().default(true),
  sizeBytes: z.number().int().min(0).default(0),
  status: z.enum(MEDIA_ITEM_STATUSES).default("uploaded"),
  replacesId: z.string().optional().nullable(),
});
export type MediaItemCreateInput = z.infer<typeof mediaItemCreateSchema>;

export const mediaItemUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  shotRef: z.string().optional(),
  take: z.number().int().min(1).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
  favourite: z.boolean().optional(),
  order: z.number().int().optional(),
});
export type MediaItemUpdateInput = z.infer<typeof mediaItemUpdateSchema>;

export const mediaMessageCreateSchema = z.object({
  text: z.string().trim().min(1, "Message text is required"),
  timeSeconds: z.number().min(0).optional().nullable(),
  replyToId: z.string().optional().nullable(),
});
export type MediaMessageCreateInput = z.infer<typeof mediaMessageCreateSchema>;

export const mediaItemReviewSchema = z.object({
  action: z.enum(["approve", "reshoot_needed"]),
  message: z.string().trim().optional(),
});
export type MediaItemReviewInput = z.infer<typeof mediaItemReviewSchema>;

export const shootStepFinishReviewSchema = z.object({
  score: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(2000).optional(),
  tags: z.array(z.enum(RATING_TAGS)).optional(),
  note: z.string().max(2000).optional(),
});
export type ShootStepFinishReviewInput = z.infer<typeof shootStepFinishReviewSchema>;

export const reorderClipsSchema = z.object({
  clipIds: z.array(z.string().min(1)),
});
export type ReorderClipsInput = z.infer<typeof reorderClipsSchema>;

export interface MediaItemType {
  _id: string;
  id?: string;
  stageItemId: string;
  contentPieceId?: string | null;
  submissionId?: string | null;
  kind: 'video' | 'image';
  url: string;
  storageId?: string;
  thumbnailUrl?: string;
  title: string;
  shotRef?: string;
  take: number;
  tags: string[];
  notes?: string;
  favourite: boolean;
  order: number;
  version: number;
  replacesId?: string | null;
  durationSeconds: number;
  width: number;
  height: number;
  orientationOk: boolean;
  sizeBytes: number;
  status: MediaItemStatus;
  decidedById?: { _id: string; name: string } | string | null;
  decidedAt?: string | null;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaMessageType {
  _id: string;
  id?: string;
  mediaItemId: string;
  authorId: { _id: string; name: string; role: string; jobRole?: string };
  text: string;
  timeSeconds?: number | null;
  replyToId?: { _id: string; text: string; authorId: { _id: string; name: string } } | string | null;
  replyToPreview?: { authorName: string; text: string } | null;
  seenBy: Array<{ userId: string; seenAt: string }>;
  doneAt?: string | null;
  doneById?: { _id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 17. Team Chat & Communications System (docs/CHAT.md)
// ==========================================

export const CHAT_CHANNEL_TYPES = ['team', 'group', 'dm'] as const;
export type ChatChannelType = (typeof CHAT_CHANNEL_TYPES)[number];

export const CHAT_REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '✅'] as const;
export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJIS)[number];

export const CHAT_ATTACHMENT_CONFIG = {
  maxCount: 5,
  images: {
    maxBytes: 20 * 1024 * 1024, // 20 MB
    mimes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    extensions: ['.png', '.jpg', '.jpeg', '.webp'],
  },
  documents: {
    maxBytes: 25 * 1024 * 1024, // 25 MB
    mimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
    ],
    extensions: ['.pdf', '.docx', '.xlsx', '.csv', '.txt'],
  },
  videos: {
    maxBytes: 100 * 1024 * 1024, // 100 MB
    mimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    extensions: ['.mp4', '.mov', '.webm'],
  },
} as const;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(40, 'Group name must not exceed 40 characters'),
  description: z.string().trim().max(200, 'Description must not exceed 200 characters').optional().default(''),
  memberIds: z.array(z.string()).min(1, 'At least one member is required'),
}).strict();
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(40, 'Group name must not exceed 40 characters').optional(),
  description: z.string().trim().max(200, 'Description must not exceed 200 characters').optional(),
}).strict();
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addGroupMembersSchema = z.object({
  memberIds: z.array(z.string()).min(1, 'At least one member ID is required'),
}).strict();
export type AddGroupMembersInput = z.infer<typeof addGroupMembersSchema>;

export const chatAttachmentInputSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  storageUrl: z.string().optional(),
  thumbnailUrl: z.string().optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  duration: z.number().optional().nullable(),
}).passthrough();

export const sendMessageSchema = z.object({
  content: z.string().max(4000, 'Message must not exceed 4,000 characters').optional().default(''),
  replyToId: z.string().optional().nullable(),
  attachmentIds: z.array(z.string()).max(5, 'Maximum 5 attachments per message').optional().default([]),
  attachments: z.array(chatAttachmentInputSchema).max(5, 'Maximum 5 attachments per message').optional().default([]),
  sharedMedia: z.any().optional().nullable(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const editMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content cannot be empty').max(4000, 'Message must not exceed 4,000 characters'),
}).strict();
export type EditMessageInput = z.infer<typeof editMessageSchema>;

export const toggleReactionSchema = z.object({
  emoji: z.enum(CHAT_REACTION_EMOJIS),
}).strict();
export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;

export const shareToChatSchema = z.object({
  channelId: z.string().min(1, 'Target channel is required'),
  assetId: z.string().min(1).optional(),
  mediaItemId: z.string().min(1).optional(),
  assetType: z.enum(['clip', 'finalCut', 'designImages', 'designPdf', 'document', 'submission']).optional().default('clip'),
  contentPieceId: z.string().optional(),
  stageKey: z.string().optional(),
  note: z.string().trim().max(1000).optional().default(''),
});
export type ShareToChatInput = z.infer<typeof shareToChatSchema>;

export interface ChatAttachment {
  _id?: string;
  id?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ChatReactionRecord {
  emoji: ChatReactionEmoji;
  userIds: string[];
}

export interface ChatMessageAuthor {
  _id: string;
  id?: string;
  name: string;
  role: string;
  preferredName?: string;
  avatarUrl?: string;
}

export interface ChatMessageReplyPreview {
  _id: string;
  authorName: string;
  content: string;
}

export interface ChatSharedMediaCard {
  grantId: string;
  assetId: string;
  assetType: 'clip' | 'finalCut' | 'designImages' | 'designPdf' | 'document';
  contentPieceId: string;
  contentPieceTitle: string;
  stageKey: string;
  title: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  owner: {
    _id: string;
    name: string;
    preferredName?: string;
    avatarUrl?: string;
  };
  note?: string;
  isRevoked: boolean;
}

export interface ChatMessageType {
  _id: string;
  id?: string;
  channelId: string;
  authorId: ChatMessageAuthor;
  content: string;
  replyToId?: string | null;
  replyPreview?: ChatMessageReplyPreview | null;
  attachments: ChatAttachment[];
  reactions: ChatReactionRecord[];
  isPinned: boolean;
  pinnedAt?: string | null;
  pinnedById?: string | null;
  isEdited: boolean;
  editedAt?: string | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedById?: string | null;
  sharedMedia?: ChatSharedMediaCard | null;
  seenBy: Array<{ userId: string; seenAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMemberType {
  _id: string;
  channelId: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string;
  lastReadMessageId?: string | null;
  lastReadAt?: string | null;
  isMuted: boolean;
  user?: {
    _id: string;
    name: string;
    preferredName?: string;
    role: string;
    jobRole?: string;
    avatarUrl?: string;
    status: string;
  };
}

export interface ChatChannelTypeDetail {
  _id: string;
  id?: string;
  type: ChatChannelType;
  name: string;
  description?: string;
  systemSlug?: string | null;
  createdById?: string | null;
  isArchived: boolean;
  archivedAt?: string | null;
  archivedById?: string | null;
  lastMessageAt?: string | null;
  lastMessageSnippet?: string | null;
  unreadCount?: number;
  membersCount?: number;
  isMuted?: boolean;
  otherUser?: {
    _id: string;
    name: string;
    preferredName?: string;
    role: string;
    jobRole?: string;
    avatarUrl?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 15. Individual Tracking & Worker Timing Engine
// ==========================================

export type IntervalKind = "blocked" | "pending";

export interface WorkInterval {
  kind: IntervalKind;
  startedAt: string | Date;
  endedAt?: string | Date | null;
  reason?: string;
  note?: string;
}

export interface WorkRound {
  roundNumber: number;
  startedAt: string | Date;
  submittedAt?: string | Date | null;
  decisionAt?: string | Date | null;
  decision?: "approved" | "changes_requested" | null;
  intervals?: WorkInterval[];
}

export interface WorkItemTimestamps {
  unlockedAt?: string | Date | null;
  assignedAt?: string | Date | null;
  startedAt?: string | Date | null;
  submittedAt?: string | Date | null;
  decisionAt?: string | Date | null;
  changesRequestedAt?: string | Date | null;
  resubmittedAt?: string | Date | null;
  approvedAt?: string | Date | null;
  postedAt?: string | Date | null;
  intervals?: WorkInterval[];
  rounds?: WorkRound[];
  dueDate?: string | Date | null;
  deadline?: string | Date | null;
  status?: string;
}

export interface WorkItemIndividualMeasures {
  waitingToStartMs: number | null;
  waitingToStartText: string;
  waitingToStartFormatted: string;
  totalWorkTimeMs: number | null;
  workTimeMs: number | null;
  totalWorkTimeText: string;
  workTimeFormatted: string;
  currentRoundWorkTimeMs: number | null;
  currentRoundWorkTimeText: string;
  approvalWaitMs: number | null;
  approvalWaitText: string;
  approvalWaitFormatted: string;
  lateByDays: number | null;
  lateByText: string;
  lateByFormatted: string;
  isLate: boolean;
}

/**
 * Format milliseconds into standard compact duration strings ('1d 4h', '3h 20m', '45m').
 * Returns '—' for null, undefined, negative, or invalid values.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms) || ms < 0) {
    return "—";
  }
  const totalMinutes = Math.floor(ms / (1000 * 60));
  if (totalMinutes === 0) {
    return "0m";
  }

  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const remainingMinutes = totalMinutes % 60;

  if (days > 0) {
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }

  if (remainingHours > 0) {
    if (remainingMinutes > 0) {
      return `${remainingHours}h ${remainingMinutes}m`;
    }
    return `${remainingHours}h`;
  }

  return `${remainingMinutes}m`;
}

/**
 * Normalizes any Date or ISO string to the start of local day (midnight).
 */
export function toMidnightDate(d: string | Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Whole calendar days past a deadline (0 if it falls today or later). Same date-only count as "Late by". */
export function overdueDays(deadline: string | Date, now: string | Date = new Date()): number {
  const diff = toMidnightDate(now).getTime() - toMidnightDate(deadline).getTime();
  return Math.max(0, Math.round(diff / (24 * 60 * 60 * 1000)));
}

export function formatOverdue(days: number): string {
  if (days <= 0) return "Overdue today";
  return `Overdue by ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Calculates sum of paused interval durations (blocked or pending) within a time window.
 */
export function calculateIntervalDurationInWindow(
  intervals: WorkInterval[] = [],
  windowStart: Date,
  windowEnd: Date
): number {
  let pausedMs = 0;
  const winStart = windowStart.getTime();
  const winEnd = windowEnd.getTime();

  for (const interval of intervals) {
    if (!interval || !interval.startedAt) continue;
    const intStart = new Date(interval.startedAt).getTime();
    const intEnd = interval.endedAt ? new Date(interval.endedAt).getTime() : winEnd;

    const overlapStart = Math.max(winStart, intStart);
    const overlapEnd = Math.min(winEnd, intEnd);

    if (overlapEnd > overlapStart) {
      pausedMs += overlapEnd - overlapStart;
    }
  }

  return pausedMs;
}

/**
 * Comprehensive Individual Timing & Measures Calculator
 * Implements Section 2 of Individual Tracking & Timing spec:
 * - Waiting to start = startedAt - unlockedAt
 * - Work time = for each round, (submission - roundStart) - (blocked & pending time inside it); total is sum of rounds.
 * - Approval wait = decision time - submission time
 * - Late by = calendar days between submission date and step due date (date only). If unsubmitted: days between today and due date.
 */
export function calculateIndividualWorkMeasures(
  item: WorkItemTimestamps,
  nowDate: Date = new Date()
): WorkItemIndividualMeasures {
  const now = nowDate.getTime();

  // 1. Waiting to start
  let waitingToStartMs: number | null = null;
  if (item.startedAt && item.unlockedAt) {
    const startMs = new Date(item.startedAt).getTime();
    const unlockMs = new Date(item.unlockedAt).getTime();
    if (startMs >= unlockMs) {
      waitingToStartMs = startMs - unlockMs;
    }
  }

  // 2. Work time per round & total work time
  let totalWorkTimeMs: number | null = null;
  let currentRoundWorkTimeMs: number | null = null;

  const allIntervals = item.intervals || [];

  if (Array.isArray(item.rounds) && item.rounds.length > 0) {
    let accumulatedMs = 0;
    let hasAnyValidRound = false;

    for (let i = 0; i < item.rounds.length; i++) {
      const round = item.rounds[i];
      if (!round.startedAt) continue;
      hasAnyValidRound = true;

      const rStart = new Date(round.startedAt);
      const rEnd = round.submittedAt
        ? new Date(round.submittedAt)
        : (item.status === 'Approved' || item.status === 'Published') && item.approvedAt
        ? new Date(item.approvedAt)
        : new Date(now);

      const grossMs = Math.max(0, rEnd.getTime() - rStart.getTime());
      const roundIntervals = round.intervals && round.intervals.length > 0
        ? round.intervals
        : allIntervals;
      const pausedMs = calculateIntervalDurationInWindow(roundIntervals, rStart, rEnd);
      const netMs = Math.max(0, grossMs - pausedMs);

      accumulatedMs += netMs;
      if (i === item.rounds.length - 1) {
        currentRoundWorkTimeMs = netMs;
      }
    }

    if (hasAnyValidRound) {
      totalWorkTimeMs = accumulatedMs;
    }
  } else if (item.startedAt) {
    // Single round / legacy fallback
    const rStart = new Date(item.startedAt);
    const rEnd = item.submittedAt
      ? new Date(item.submittedAt)
      : (item.status === 'Approved' || item.status === 'Published') && item.approvedAt
      ? new Date(item.approvedAt)
      : new Date(now);

    const grossMs = Math.max(0, rEnd.getTime() - rStart.getTime());
    const pausedMs = calculateIntervalDurationInWindow(allIntervals, rStart, rEnd);
    totalWorkTimeMs = Math.max(0, grossMs - pausedMs);
    currentRoundWorkTimeMs = totalWorkTimeMs;
  }

  // 3. Approval wait
  let approvalWaitMs: number | null = null;
  if (item.submittedAt) {
    const subMs = new Date(item.submittedAt).getTime();
    const decDate = item.decisionAt || item.approvedAt || item.changesRequestedAt;
    if (decDate) {
      const decMs = new Date(decDate).getTime();
      if (decMs >= subMs) {
        approvalWaitMs = decMs - subMs;
      }
    } else if (item.status === 'Feedback') {
      // Currently waiting for approval
      approvalWaitMs = Math.max(0, now - subMs);
    }
  }

  // 4. Late by (Calendar Days, date-only)
  let lateByDays: number | null = null;
  const rawDue = item.dueDate || item.deadline;
  if (rawDue) {
    const dueMidnight = toMidnightDate(rawDue).getTime();
    const evalMidnight = item.submittedAt
      ? toMidnightDate(item.submittedAt).getTime()
      : (item.status === 'Approved' || item.status === 'Published') && item.approvedAt
      ? toMidnightDate(item.approvedAt).getTime()
      : toMidnightDate(nowDate).getTime();

    const diffDays = Math.floor((evalMidnight - dueMidnight) / (24 * 60 * 60 * 1000));
    const isTerminal = item.status === 'Approved' || item.status === 'Published';

    if (diffDays > 0) {
      lateByDays = diffDays;
    } else if (isTerminal) {
      lateByDays = 0; // Completed on time
    } else {
      lateByDays = 0; // On track
    }
  }

  const isLate = lateByDays !== null && lateByDays > 0;

  const waitingToStartText = formatDuration(waitingToStartMs);
  const totalWorkTimeText = formatDuration(totalWorkTimeMs);
  const currentRoundWorkTimeText = formatDuration(currentRoundWorkTimeMs);
  const approvalWaitText = formatDuration(approvalWaitMs);
  const lateByText =
    lateByDays === null
      ? "—"
      : lateByDays > 0
      ? `${lateByDays}d`
      : "On time";

  return {
    waitingToStartMs,
    waitingToStartText,
    waitingToStartFormatted: waitingToStartText,
    totalWorkTimeMs,
    workTimeMs: totalWorkTimeMs,
    totalWorkTimeText,
    workTimeFormatted: totalWorkTimeText,
    currentRoundWorkTimeMs,
    currentRoundWorkTimeText,
    approvalWaitMs,
    approvalWaitText,
    approvalWaitFormatted: approvalWaitText,
    lateByDays,
    lateByText,
    lateByFormatted: lateByText,
    isLate,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Excel-style plan grid: month periods, column map and paste parsing.
// Pure helpers shared by the API (validation) and the web grid (paste preview).
// ─────────────────────────────────────────────────────────────────────────────

/** Business timezone for plan months (approved: Asia/Kolkata). */
export const APP_TIME_ZONE = "Asia/Kolkata";

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY_RE.test(value);
}

/** 'YYYY-MM' for a moment, read in the business timezone. */
export function monthKeyInAppTz(date: Date | string | number = new Date()): string {
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

/**
 * Month a stored plan belongs to. Plan dates are stored date-only (UTC midnight),
 * but some older rows were saved at local midnight (previous day 18:30Z); reading
 * the date in the business timezone gives the intended calendar day for both.
 */
export function planMonthKey(periodStart: Date | string): string {
  return monthKeyInAppTz(periodStart);
}

/** Full calendar month as stored date-only bounds: first day 00:00Z to last day 23:59:59.999Z. */
export function monthPeriod(monthKey: string): { periodStart: Date; periodEnd: Date } {
  const m = MONTH_KEY_RE.exec(monthKey);
  if (!m) throw new Error(`Invalid month "${monthKey}". Use YYYY-MM.`);
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  return {
    periodStart: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    periodEnd: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

export function nextMonthKey(monthKey: string): string {
  const { periodStart } = monthPeriod(monthKey);
  return new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 7);
}

export const PLAN_GRID_GROUPS = [
  "Plan",
  "Script",
  "Shoot",
  "Edit",
  "Approval",
  "Publishing",
  "Tracking",
] as const;
export type PlanGridGroup = (typeof PLAN_GRID_GROUPS)[number];

export type PlanGridExcelColumnKey =
  | "postingDate"
  | "topic"
  | "type"
  | "scriptStatus"
  | "scriptDoneDate"
  | "scriptOwner"
  | "shootStatus"
  | "shootDoneDate"
  | "shootOwner"
  | "editStatus"
  | "editDoneDate"
  | "editOwner"
  | "approvalStatus"
  | "approvalDate"
  | "publishedDate"
  | "postingOwner"
  | "turnaroundDays"
  | "remarks";

/** App-only optional columns (Static/Carousel and other design rows have Content and Design steps). */
export type PlanGridExtraColumnKey = "contentOwner" | "designOwner";
export type PlanGridColumnKey = PlanGridExcelColumnKey | PlanGridExtraColumnKey;

export interface PlanGridColumn {
  key: PlanGridColumnKey;
  header: string;
  group: PlanGridGroup;
  /** SM can type/paste into it. Workflow columns are filled by the system. */
  editable: boolean;
  frozen?: boolean;
  /** Stage whose owner this column sets, if any. */
  ownerStage?: StageKey;
  /** Optional app column, not one of the 18 Excel columns. */
  optional?: boolean;
  /** Short help shown as a tooltip on the header. */
  help?: string;
}

export const TURNAROUND_HELP =
  "Days from row approval to publishing. Counted once, when the post is published: from the time the Creative Head approved the row (its first step was created) to the publish time.";

/** The 18 Excel columns, in Excel order. */
export const PLAN_GRID_COLUMNS: PlanGridColumn[] = [
  { key: "postingDate", header: "Posting Date", group: "Plan", editable: true, frozen: true },
  { key: "topic", header: "Topic", group: "Plan", editable: true, frozen: true },
  { key: "type", header: "Type", group: "Plan", editable: true, frozen: true },
  { key: "scriptStatus", header: "Script Status", group: "Script", editable: false },
  { key: "scriptDoneDate", header: "Script Done Date", group: "Script", editable: false },
  { key: "scriptOwner", header: "Script Owner", group: "Script", editable: true, ownerStage: "Script" },
  { key: "shootStatus", header: "Shoot Status", group: "Shoot", editable: false },
  { key: "shootDoneDate", header: "Shoot Done Date", group: "Shoot", editable: false },
  { key: "shootOwner", header: "Shoot Owner", group: "Shoot", editable: true, ownerStage: "Shoot" },
  { key: "editStatus", header: "Edit Status", group: "Edit", editable: false },
  { key: "editDoneDate", header: "Edit Done Date", group: "Edit", editable: false },
  { key: "editOwner", header: "Edit Owner", group: "Edit", editable: true, ownerStage: "Edit" },
  { key: "approvalStatus", header: "Approval Status", group: "Approval", editable: false },
  { key: "approvalDate", header: "Approval Date", group: "Approval", editable: false },
  { key: "publishedDate", header: "Published Date", group: "Publishing", editable: false },
  { key: "postingOwner", header: "Posting Owner", group: "Publishing", editable: true, ownerStage: "Post" },
  { key: "turnaroundDays", header: "Turnaround (Days)", group: "Tracking", editable: false, help: TURNAROUND_HELP },
  { key: "remarks", header: "Remarks", group: "Tracking", editable: true },
];

/** Optional app columns. Content sits with the writing step (Script), Design with production (Edit). */
export const PLAN_GRID_EXTRA_COLUMNS: (PlanGridColumn & { after: PlanGridExcelColumnKey })[] = [
  { key: "contentOwner", header: "Content Owner", group: "Script", editable: true, ownerStage: "Content", optional: true, after: "scriptOwner" },
  { key: "designOwner", header: "Design Owner", group: "Edit", editable: true, ownerStage: "Design", optional: true, after: "editOwner" },
];

/** Columns in on-screen order: the 18 Excel columns with the 2 optional ones placed after their anchors. */
export const PLAN_GRID_DISPLAY_COLUMNS: PlanGridColumn[] = PLAN_GRID_COLUMNS.flatMap((c) => [
  c,
  ...PLAN_GRID_EXTRA_COLUMNS.filter((x) => x.after === c.key).map(({ after: _after, ...rest }) => rest),
]);

/** Template / upload headers: the 18 Excel columns, then the 2 optional owner columns. */
export const PLAN_TEMPLATE_HEADERS: string[] = [
  ...PLAN_GRID_COLUMNS.map((c) => c.header),
  ...PLAN_GRID_EXTRA_COLUMNS.map((c) => c.header),
];

const normHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");
const HEADER_TO_COLUMN = new Map<string, PlanGridColumnKey>(
  [...PLAN_GRID_COLUMNS, ...PLAN_GRID_EXTRA_COLUMNS].map((c) => [normHeader(c.header), c.key])
);
HEADER_TO_COLUMN.set("turnaround", "turnaroundDays");
HEADER_TO_COLUMN.set("turnaround days", "turnaroundDays");

/** Column key for a grid/template header, or null if it is not one. */
export function planGridColumnForHeader(header: string): PlanGridColumnKey | null {
  return HEADER_TO_COLUMN.get(normHeader(String(header ?? ""))) ?? null;
}

/** Headers only the new 18-column layout has; their presence marks a new-layout file. */
const NEW_LAYOUT_ONLY_HEADERS = new Set(
  ["Script Status", "Script Done Date", "Shoot Status", "Shoot Done Date", "Edit Status", "Edit Done Date", "Approval Status", "Approval Date", "Published Date", "Turnaround (Days)", "Turnaround"].map(normHeader)
);
export function isNewPlanLayout(headers: string[]): boolean {
  return headers.some((h) => NEW_LAYOUT_ONLY_HEADERS.has(normHeader(String(h ?? ""))));
}

/**
 * Split clipboard text from Excel (tab-separated, CRLF or LF rows, quoted cells
 * may contain tabs/newlines and doubled quotes). Trailing empty lines are dropped.
 */
export function parseClipboardTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let quoted = false;
  const src = String(text ?? "");
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
      i++;
      continue;
    }
    if (ch === "\t") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += ch === "\r" && src[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

export type PlanGridCells = Partial<Record<PlanGridColumnKey, string>>;

/**
 * Turn pasted rows into cell maps. If the first row is a header row it places the
 * columns; otherwise columns follow the 18 Excel columns from `startColumn` (the cell
 * the paste landed on). A paste that starts on an optional column fills only that column.
 */
export function pastedRowsToCells(
  rows: string[][],
  startColumn: PlanGridColumnKey = "postingDate"
): { cells: PlanGridCells[]; headerDetected: boolean; unknownHeaders: string[] } {
  if (rows.length === 0) return { cells: [], headerDetected: false, unknownHeaders: [] };
  const first = rows[0];
  const headerHits = first.filter((h) => planGridColumnForHeader(h)).length;
  const headerDetected = headerHits >= 2;
  let keys: (PlanGridColumnKey | null)[];
  const unknownHeaders: string[] = [];
  let body = rows;
  if (headerDetected) {
    keys = first.map((h) => {
      const k = planGridColumnForHeader(h);
      if (!k && h.trim()) unknownHeaders.push(h.trim());
      return k;
    });
    body = rows.slice(1);
  } else if (PLAN_GRID_EXTRA_COLUMNS.some((c) => c.key === startColumn)) {
    keys = [startColumn];
  } else {
    const startIdx = Math.max(0, PLAN_GRID_COLUMNS.findIndex((c) => c.key === startColumn));
    keys = PLAN_GRID_COLUMNS.slice(startIdx).map((c) => c.key);
  }
  const cells = body
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const out: PlanGridCells = {};
      r.forEach((value, idx) => {
        const key = keys[idx];
        if (key) out[key] = value.trim();
      });
      return out;
    });
  return { cells, headerDetected, unknownHeaders };
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type GridDateResult =
  | { ok: true; value: string; resolvedByMonth?: boolean }
  | { ok: false; empty?: boolean; ambiguous?: boolean; error: string };

const isRealDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** '2026-11-02' -> '2 Nov 2026' */
export function formatGridDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return value || "";
  return `${Number(m[3])} ${SHORT_MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Parse a date cell into 'YYYY-MM-DD'. Accepts `2026-11-02`, `2 Nov, 2026`,
 * `2 November 2026`, `Nov 2, 2026` and slashed dates (`/`, `-` or `.`).
 *
 * Slashed dates: an unambiguous day/month date (e.g. 16/11/2026) is accepted.
 * When both DD/MM and MM/DD are real dates, or only MM/DD is, the grid month
 * (`opts.month`, 'YYYY-MM') decides: the date is accepted only when exactly one
 * reading falls in that month. Otherwise it is an error, never a guess.
 */
export function parseGridDate(raw: unknown, opts: { month?: string } = {}): GridDateResult {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: false, empty: true, error: "Date is required." };

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(y, mo, d) ? { ok: true, value: ymd(y, mo, d) } : { ok: false, error: `"${s}" is not a real date.` };
  }

  m = /^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(s);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    const [d, y] = [Number(m[1]), Number(m[3])];
    if (mo && isRealDate(y, mo, d)) return { ok: true, value: ymd(y, mo, d) };
    return { ok: false, error: `"${s}" is not a real date.` };
  }

  m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    const [d, y] = [Number(m[2]), Number(m[3])];
    if (mo && isRealDate(y, mo, d)) return { ok: true, value: ymd(y, mo, d) };
    return { ok: false, error: `"${s}" is not a real date.` };
  }

  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dayFirst = isRealDate(y, b, a) ? ymd(y, b, a) : null;
    const monthFirst = isRealDate(y, a, b) ? ymd(y, a, b) : null;
    const readings = [...new Set([dayFirst, monthFirst].filter(Boolean) as string[])];
    if (readings.length === 0) return { ok: false, error: `"${s}" is not a real date.` };
    // Unambiguous day/month (the Excel sample's format).
    if (readings.length === 1 && dayFirst) return { ok: true, value: dayFirst };
    const month = opts.month && isMonthKey(opts.month) ? opts.month : null;
    if (month) {
      const inMonth = readings.filter((r) => r.slice(0, 7) === month);
      if (inMonth.length === 1) return { ok: true, value: inMonth[0], resolvedByMonth: true };
    }
    const options = readings.map(formatGridDate).join(" or ");
    return {
      ok: false,
      ambiguous: readings.length > 1,
      error:
        readings.length > 1
          ? `"${s}" could be ${options}${month ? ", and the grid month does not settle it" : ""}. Write the month as a word, e.g. ${formatGridDate(readings[0]).replace(/ (\d{4})$/, ", $1")}.`
          : `"${s}" reads as ${options} only month-first${month ? ", which is outside this grid month" : ""}. Use day/month/year.`,
    };
  }

  return { ok: false, error: `"${s}" is not a recognised date. Use 2 Nov, 2026 or 16/11/2026.` };
}

/** Grid/Excel vocabulary that differs from the app's type names (typed or pasted text only). */
export const PLAN_GRID_TYPE_ALIASES: Record<string, string> = {
  poster: "Static Post",
  carousal: "Carousel Post",
  carousel: "Carousel Post",
  "static post": "Static Post",
  "carousel post": "Carousel Post",
  reel: "Reel",
  reels: "Reel",
  story: "Story",
};

export type GridTypeResult = { ok: true; value: string } | { ok: false; empty?: boolean; error: string };

/**
 * Map a Type cell to an app deliverable type.
 * - Typed/pasted text: grid aliases first (Poster -> Static Post, Carousal -> Carousel Post),
 *   then an exact app type name. Nothing is guessed from partial text.
 * - `exact: true` (picked from the type list): one of the 15 documented types as-is,
 *   so the print "Poster" type stays selectable.
 */
export function parseGridType(raw: unknown, opts: { exact?: boolean } = {}): GridTypeResult {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: false, empty: true, error: "Type is required." };
  const lower = s.toLowerCase().replace(/\s+/g, " ");
  if (opts.exact) {
    const hit = DELIVERABLE_TYPE_KEYS.find((t) => t.toLowerCase() === lower);
    return hit ? { ok: true, value: hit } : { ok: false, error: `Unknown type "${s}".` };
  }
  const alias = PLAN_GRID_TYPE_ALIASES[lower];
  if (alias) return { ok: true, value: alias };
  const exact = DELIVERABLE_TYPE_KEYS.find((t) => t.toLowerCase() === lower);
  if (exact && exact !== "Poster") return { ok: true, value: exact };
  return { ok: false, error: `Unknown type "${s}". Use Reel, Poster, Carousal, Static Post, Carousel Post, Story or pick from the list.` };
}

export interface GridOwnerCandidate {
  _id: string;
  name: string;
}

export type GridOwnerResult =
  | { ok: true; empty: true }
  | { ok: true; empty?: false; id: string; name: string }
  | { ok: false; ambiguous?: boolean; error: string };

/** Exact (trimmed, case-sensitive) name match only. Two people with the same name is ambiguous. */
export function matchGridOwner(raw: unknown, people: GridOwnerCandidate[]): GridOwnerResult {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, empty: true };
  const hits = people.filter((p) => (p.name || "").trim() === s);
  if (hits.length === 1) return { ok: true, id: String(hits[0]._id), name: hits[0].name };
  if (hits.length > 1) return { ok: false, ambiguous: true, error: `More than one active person is named "${s}". Pick the owner from the list.` };
  return { ok: false, error: `No active person is named exactly "${s}".` };
}
