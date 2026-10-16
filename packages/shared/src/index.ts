import { z } from 'zod';

// ==========================================
// 1. Roles & Production Teams
// ==========================================

export const ROLE_KEYS = [
  'admin',
  'lead',
  'team_lead',
  'worker',
  'sm_manager',
  'dept_lead',
  'dept_staff',
  'viewer',
] as const;

export type UserRole = (typeof ROLE_KEYS)[number];

export const TEAM_KEYS = [
  'content',
  'graphics',
  'cinematography',
  'editor',
] as const;

export type ProductionTeam = (typeof TEAM_KEYS)[number];

export const DEPARTMENT_TYPES = [
  'social_media',
  'performance',
  'sales',
  'academics',
  'other',
] as const;

export type DepartmentType = (typeof DEPARTMENT_TYPES)[number];

// ==========================================
// 2. Status Enums
// ==========================================

export const REQUEST_STATUSES = [
  'draft',
  'submitted',
  'under_triage',
  'accepted',
  'rejected',
  'needs_info',
  'converted',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const CONTENT_STATUSES = [
  'planned',
  'brief_ready',
  'in_production',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'live',
  'paused',
  'retired',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const TASK_STATUSES = [
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'approved',
  'done',
  'blocked',
  'on_hold',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DELIVERABLE_STATUSES = [
  'submitted',
  'approved',
  'changes_requested',
  'rejected',
] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export const SHOOT_STATUSES = [
  'scheduled',
  'done',
  'reshoot_needed',
  'cancelled',
] as const;
export type ShootStatus = (typeof SHOOT_STATUSES)[number];

export const TIME_ENTRY_STATUSES = [
  'draft',
  'submitted',
  'approved',
] as const;
export type TimeEntryStatus = (typeof TIME_ENTRY_STATUSES)[number];

export const ACCESS_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'info_needed',
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export const HOLD_REASON_CODES = [
  'waiting_for_content',
  'approval_delay',
  'resource_shortage',
  'client_feedback',
  'equipment',
  'weather',
  'other',
] as const;
export type HoldReasonCode = (typeof HOLD_REASON_CODES)[number];

// ==========================================
// 3. Permission Keys & Matrix (Spec Section 15.1)
// ==========================================

export const PERMISSION_KEYS = [
  'user.approve',
  'user.manage',
  'settings.manage',
  'audit.view',
  'request.create',
  'request.view.department',
  'request.triage',
  'calendar.manage',
  'calendar.import',
  'content.create',
  'content.update',
  'content.publish',
  'task.assign',
  'task.update.own',
  'task.upload',
  'review.approve',
  'request.confirm',
  'shoot.manage',
  'time.log',
  'timesheet.approve',
  'report.view',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: [
    'user.approve',
    'user.manage',
    'settings.manage',
    'audit.view',
    'request.create',
    'request.view.department',
    'request.triage',
    'calendar.manage',
    'calendar.import',
    'content.create',
    'content.update',
    'content.publish',
    'task.assign',
    'task.update.own',
    'task.upload',
    'review.approve',
    'request.confirm',
    'shoot.manage',
    'time.log',
    'timesheet.approve',
    'report.view',
  ],
  lead: [
    'request.create',
    'request.view.department',
    'request.triage',
    'calendar.manage',
    'calendar.import',
    'content.create',
    'content.update',
    'task.assign',
    'task.update.own',
    'task.upload',
    'review.approve',
    'shoot.manage',
    'time.log',
    'timesheet.approve',
    'report.view',
  ],
  team_lead: [
    'content.create',
    'content.update',
    'task.assign',
    'task.update.own',
    'task.upload',
    'shoot.manage',
    'time.log',
    'timesheet.approve',
    'report.view',
  ],
  worker: [
    'task.update.own',
    'task.upload',
    'time.log',
    'shoot.manage',
    'report.view',
  ],
  sm_manager: [
    'request.create',
    'request.view.department',
    'calendar.manage',
    'calendar.import',
    'content.create',
    'content.update',
    'content.publish',
    'request.confirm',
    'report.view',
  ],
  dept_lead: [
    'request.create',
    'request.view.department',
    'request.confirm',
    'report.view',
  ],
  dept_staff: [
    'request.create',
    'request.confirm',
    'report.view',
  ],
  viewer: [
    'report.view',
  ],
};

// ==========================================
// 4. Zod Schemas
// ==========================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const requestAccessSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid work email required'),
  phone: z.string().min(7, 'Valid contact number required'),
  department: z.string().min(2, 'Department is required'),
  requestedRole: z.enum(ROLE_KEYS),
  skills: z.array(z.string()).default([]),
  reason: z.string().min(10, 'Please provide a clear reason for access'),
});
export type RequestAccessInput = z.infer<typeof requestAccessSchema>;

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

export const accessRequestReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'info_needed']),
  assignedRole: z.enum(ROLE_KEYS).optional(),
  teamId: z.string().optional(),
  skills: z.array(z.string()).optional(),
  capacity: z.number().min(0).max(80).optional(),
  reason: z.string().optional(),
});
export type AccessRequestReviewInput = z.infer<typeof accessRequestReviewSchema>;


export const statusTransitionSchema = z.object({
  toStatus: z.string(),
  reason: z.string().optional(),
  reasonCode: z.enum(HOLD_REASON_CODES).optional(),
  comment: z.string().optional(),
});
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;

// ==========================================
// 5. Phase 2: Master Data & Organization Schemas
// ==========================================

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  type: z.enum(DEPARTMENT_TYPES),
  lead: z.string().optional().nullable(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const teamSchema = z.object({
  name: z.enum(TEAM_KEYS),
  displayName: z.string().min(2, 'Display name is required'),
  lead: z.string().optional().nullable(),
  members: z.array(z.string()).default([]),
  defaultWeeklyCapacity: z.number().min(0).max(200).default(40),
});
export type TeamInput = z.infer<typeof teamSchema>;

export const platformSchema = z.object({
  name: z.string().min(2, 'Platform name is required'),
  slug: z.string().min(2, 'Platform slug is required'),
  isActive: z.boolean().default(true),
});
export type PlatformInput = z.infer<typeof platformSchema>;

export const prioritySchema = z.object({
  name: z.string().min(2, 'Priority name is required'),
  level: z.number().min(1).max(5),
  color: z.string().default('#8CA4D2'),
  slaHours: z.number().min(1).default(48),
  isActive: z.boolean().default(true),
});
export type PriorityInput = z.infer<typeof prioritySchema>;

export const holdReasonSchema = z.object({
  code: z.enum(HOLD_REASON_CODES),
  label: z.string().min(2, 'Label is required'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type HoldReasonInput = z.infer<typeof holdReasonSchema>;

export const contentFormatSchema = z.object({
  name: z.string().min(2, 'Format name is required'),
  leadTimeDays: z.number().min(1, 'Lead time must be at least 1 day'),
  defaultPlatforms: z.array(z.string()).default([]),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type ContentFormatInput = z.infer<typeof contentFormatSchema>;

export const DYNAMIC_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'select',
  'multiselect',
  'date',
  'checkbox',
  'url',
] as const;
export type DynamicFieldType = (typeof DYNAMIC_FIELD_TYPES)[number];

export const dynamicFieldDefinitionSchema = z.object({
  fieldKey: z.string().min(1, 'Field key is required').regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscore only'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(DYNAMIC_FIELD_TYPES),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  helperText: z.string().optional(),
});
export type DynamicFieldDefinition = z.infer<typeof dynamicFieldDefinitionSchema>;

export const requestTypeSchema = z.object({
  name: z.string().min(2, 'Request type name is required'),
  departmentType: z.enum(DEPARTMENT_TYPES),
  fieldSchema: z.array(dynamicFieldDefinitionSchema).default([]),
  isActive: z.boolean().default(true),
});
export type RequestTypeInput = z.infer<typeof requestTypeSchema>;

export const settingsSchema = z.object({
  efficiencyWeights: z
    .object({
      onTime: z.number().min(0).max(1).default(0.4),
      firstPass: z.number().min(0).max(1).default(0.3),
      speedVsEstimate: z.number().min(0).max(1).default(0.2),
      volumeUtilization: z.number().min(0).max(1).default(0.1),
    })
    .default({
      onTime: 0.4,
      firstPass: 0.3,
      speedVsEstimate: 0.2,
      volumeUtilization: 0.1,
    }),
  requestersCanSeeWorkerNames: z.boolean().default(false),
  requireReasonForHold: z.boolean().default(true),
  defaultWeeklyCapacityHours: z.number().min(10).max(80).default(40),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const auditLogQuerySchema = z.object({
  actor: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

// ==========================================
// 5. Phase 3: Requests & Triage Schemas
// ==========================================

export const PRIORITY_LEVELS = ['urgent', 'high', 'medium', 'low'] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const createRequestSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  sourceDepartment: z.string().min(2, 'Source department is required'),
  requestType: z.string().min(1, 'Request type is required'),
  dynamicFields: z.record(z.any()).default({}),
  priority: z.enum(PRIORITY_LEVELS).default('medium'),
  deadline: z.string().or(z.date()),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        name: z.string(),
        size: z.number().optional(),
        type: z.string().optional(),
      })
    )
    .default([]),
  isDraft: z.boolean().default(false),
  recurring: z
    .object({
      isRecurring: z.boolean().default(false),
      frequency: z.enum(['weekly', 'monthly']).optional(),
      nextRunAt: z.string().or(z.date()).optional(),
      endDate: z.string().or(z.date()).optional(),
    })
    .optional(),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const editRequestSchema = createRequestSchema.partial().extend({
  resubmit: z.boolean().optional(),
  resubmitReason: z.string().optional(),
});
export type EditRequestInput = z.infer<typeof editRequestSchema>;

export const triageAcceptSchema = z.object({
  priority: z.enum(PRIORITY_LEVELS).optional(),
  deadline: z.string().or(z.date()).optional(),
  comment: z.string().optional(),
});
export type TriageAcceptInput = z.infer<typeof triageAcceptSchema>;

export const triageRejectSchema = z.object({
  reason: z.string().min(5, 'Rejection reason must be at least 5 characters'),
});
export type TriageRejectInput = z.infer<typeof triageRejectSchema>;

export const triageNeedsInfoSchema = z.object({
  message: z.string().min(5, 'Message explaining required info is required'),
});
export type TriageNeedsInfoInput = z.infer<typeof triageNeedsInfoSchema>;

export const triageMergeSchema = z.object({
  targetRequestId: z.string().min(1, 'Target parent request ID is required'),
});
export type TriageMergeInput = z.infer<typeof triageMergeSchema>;

export const requestCommentSchema = z.object({
  text: z.string().min(1, 'Comment text cannot be empty'),
});
export type RequestCommentInput = z.infer<typeof requestCommentSchema>;

// ==========================================
// 6. Phase 4: Content, Pipelines, Tasks & Handoffs
// ==========================================

export const CONTENT_FORMATS = [
  'static_post',
  'carousel',
  'story',
  'reel',
  'ad_creative',
  'brochure',
  'academic_creative',
] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const createContentItemSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  format: z.string().min(1, 'Format is required'),
  sourceDepartment: z.string().min(1, 'Source department is required'),
  requester: z.string().optional(),
  requestId: z.string().optional(),
  campaignId: z.string().optional(),
  pillar: z.string().default('General'),
  platforms: z.array(z.string()).min(1, 'At least one platform is required'),
  publishDate: z.string().or(z.date()),
  productionDeadline: z.string().or(z.date()).optional(),
  priority: z.enum(PRIORITY_LEVELS).default('medium'),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  brief: z.string().optional(),
  publishedUrl: z.string().url().optional().or(z.literal('')),
});
export type CreateContentItemInput = z.infer<typeof createContentItemSchema>;

export const updateContentItemSchema = createContentItemSchema.partial().extend({
  status: z.enum(CONTENT_STATUSES).optional(),
});
export type UpdateContentItemInput = z.infer<typeof updateContentItemSchema>;

export const convertRequestSchema = z
  .object({
    format: z.string().default('static_post'),
    title: z.string().min(3).optional(),
    campaignId: z.string().optional(),
    platforms: z.array(z.string()).default(['instagram']),
    publishDate: z.string().or(z.date()).optional(),
    priority: z.enum(PRIORITY_LEVELS).default('medium'),
    pillar: z.string().default('General'),
    brief: z.string().optional(),
    caption: z.string().optional(),
  })
  .default({});
export type ConvertRequestInput = z.infer<typeof convertRequestSchema>;

export const createTaskSchema = z.object({
  contentItemId: z.string().min(1, 'Content item ID is required'),
  stageKey: z.string().min(1, 'Stage key is required'),
  stageOrder: z.number().default(1),
  title: z.string().min(3, 'Task title must be at least 3 characters'),
  team: z.enum(TEAM_KEYS),
  assignee: z.string().optional(),
  collaborators: z.array(z.string()).default([]),
  estimateHours: z.number().min(0.5).default(2),
  dueDate: z.string().or(z.date()).optional(),
  dependencies: z.array(z.string()).default([]),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  assignee: z.string().nullable().optional(),
  collaborators: z.array(z.string()).optional(),
  estimateHours: z.number().min(0.5).optional(),
  actualHours: z.number().min(0).optional(),
  dueDate: z.string().or(z.date()).optional(),
  title: z.string().min(3).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskTransitionSchema = z.object({
  status: z.enum(TASK_STATUSES),
  holdReason: z.string().optional(),
  holdComment: z.string().optional(),
  comment: z.string().optional(),
});
export type TaskTransitionInput = z.infer<typeof taskTransitionSchema>;

export const createCommentSchema = z.object({
  entityType: z.enum(['request', 'content', 'task', 'deliverable']),
  entityId: z.string().min(1, 'Entity ID is required'),
  text: z.string().min(1, 'Comment text cannot be empty'),
  mediaTimestamp: z.number().min(0).optional(),
  mentions: z.array(z.string()).default([]),
  attachments: z.array(z.string()).default([]),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ==========================================
// 8. Phase 5: Calendar & Publishing Schemas
// ==========================================

export const CALENDAR_STATUSES = ['draft', 'approved', 'converted'] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const createCalendarEntrySchema = z.object({
  date: z.string().or(z.date()),
  platform: z.string().min(1, 'Platform is required'),
  format: z.string().min(1, 'Format is required'),
  theme: z.string().min(1, 'Theme is required'),
  campaign: z.string().optional(),
  captionBrief: z.string().optional(),
  contentPillar: z.string().default('General'),
  status: z.enum(CALENDAR_STATUSES).default('draft'),
});
export type CreateCalendarEntryInput = z.infer<typeof createCalendarEntrySchema>;

export const updateCalendarEntrySchema = createCalendarEntrySchema.partial();
export type UpdateCalendarEntryInput = z.infer<typeof updateCalendarEntrySchema>;

export const commitCalendarImportSchema = z.object({
  entries: z.array(createCalendarEntrySchema),
  batchId: z.string().optional(),
});
export type CommitCalendarImportInput = z.infer<typeof commitCalendarImportSchema>;

export const publishContentSchema = z.object({
  publishedUrl: z.string().url('A valid published URL is required'),
  publishedAt: z.string().or(z.date()).optional(),
  metrics: z
    .object({
      reach: z.number().min(0).optional(),
      views: z.number().min(0).optional(),
      likes: z.number().min(0).optional(),
      shares: z.number().min(0).optional(),
      comments: z.number().min(0).optional(),
    })
    .optional(),
});
export type PublishContentInput = z.infer<typeof publishContentSchema>;

export const clashSettingsSchema = z.object({
  maxPostsPerPlatformPerDay: z.number().min(1).default(3),
});
export type ClashSettingsInput = z.infer<typeof clashSettingsSchema>;

// ==========================================
// 9. Phase 6: Shoots, Time Tracking & Attendance Schemas
// ==========================================

export const LEAVE_TYPES = ['vacation', 'sick', 'personal', 'other'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const createShootSchema = z.object({
  title: z.string().min(3, 'Shoot title must be at least 3 characters'),
  date: z.string().or(z.date()),
  location: z.string().min(2, 'Location is required'),
  crew: z.array(z.string()).min(1, 'At least one crew member must be assigned'),
  equipment: z.union([z.array(z.string()), z.string()]).default([]),
  talentNotes: z.string().optional(),
  contentItems: z.array(z.string()).min(1, 'At least one video content item must be linked'),
  notes: z.string().optional(),
  overrideWarning: z.boolean().default(false),
});
export type CreateShootInput = z.infer<typeof createShootSchema>;

export const updateShootSchema = createShootSchema.partial().extend({
  status: z.enum(SHOOT_STATUSES).optional(),
});
export type UpdateShootInput = z.infer<typeof updateShootSchema>;

export const shootTransitionSchema = z.object({
  status: z.enum(SHOOT_STATUSES),
  notes: z.string().optional(),
  reshootReason: z.string().optional(),
});
export type ShootTransitionInput = z.infer<typeof shootTransitionSchema>;

export const createLeaveRequestSchema = z.object({
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  type: z.enum(LEAVE_TYPES).default('vacation'),
  reason: z.string().min(3, 'Reason is required'),
});
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const reviewLeaveRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewComment: z.string().optional(),
});
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>;

export const createTimeEntrySchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  date: z.string().or(z.date()).optional(),
  minutes: z.number().min(1, 'Minutes must be at least 1'),
  note: z.string().optional(),
});
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;

export const startTimerSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  note: z.string().optional(),
});
export type StartTimerInput = z.infer<typeof startTimerSchema>;

export const stopTimerSchema = z.object({
  timeEntryId: z.string().optional(),
  note: z.string().optional(),
});
export type StopTimerInput = z.infer<typeof stopTimerSchema>;

export const submitTimesheetSchema = z.object({
  weekStart: z.string().or(z.date()).optional(),
  entryIds: z.array(z.string()).optional(),
});
export type SubmitTimesheetInput = z.infer<typeof submitTimesheetSchema>;

export const approveTimesheetSchema = z.object({
  entryIds: z.array(z.string()).min(1, 'At least one time entry must be selected'),
  status: z.enum(['approved', 'rejected']),
  comment: z.string().optional(),
});
export type ApproveTimesheetInput = z.infer<typeof approveTimesheetSchema>;

// ==========================================
// 10. Phase 7: Deliverables, Direct Uploads, Video Review & Publishing Flow
// ==========================================

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
  video: 500 * 1024 * 1024, // 500 MB
  image: 50 * 1024 * 1024, // 50 MB
  audio: 100 * 1024 * 1024, // 100 MB
  document: 50 * 1024 * 1024, // 50 MB
  other: 50 * 1024 * 1024, // 50 MB
} as const;

export const signUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().positive('File size must be positive'),
  fileType: z.string().min(1, 'File type is required'),
  deliverableType: z.enum(DELIVERABLE_TYPES).optional(),
  folder: z.string().optional(),
});
export type SignUploadInput = z.infer<typeof signUploadSchema>;

export const createDeliverableSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  contentItemId: z.string().optional(),
  type: z.enum(DELIVERABLE_TYPES).default('video'),
  fileUrl: z.string().optional(),
  externalLink: z.string().optional(),
  thumbnail: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;

export const reviewDeliverableSchema = z.object({
  decision: z.enum(['approved', 'changes_requested', 'rejected']),
  notes: z.string().optional(),
  comments: z
    .array(
      z.object({
        text: z.string().min(1),
        mediaTimestamp: z.number().min(0).optional(),
      })
    )
    .optional(),
});
export type ReviewDeliverableInput = z.infer<typeof reviewDeliverableSchema>;

export const requesterConfirmSchema = z.object({
  decision: z.enum(['confirm', 'request_changes']),
  feedback: z.string().optional(),
});
export type RequesterConfirmInput = z.infer<typeof requesterConfirmSchema>;

export const performanceLiveSchema = z.object({
  liveUrl: z.string().url('A valid live URL is required'),
  liveDate: z.string().or(z.date()).optional(),
  notes: z.string().optional(),
});
export type PerformanceLiveInput = z.infer<typeof performanceLiveSchema>;



