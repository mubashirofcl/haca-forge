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

export const createRequestSchema = z.object({
  sourceDepartment: z.string().min(1, 'Source department is required'),
  requestType: z.string().min(1, 'Request type is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  deadline: z.string().or(z.date()),
  dynamicFields: z.record(z.any()).default({}),
  attachments: z.array(z.string().url()).default([]),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const statusTransitionSchema = z.object({
  toStatus: z.string(),
  reason: z.string().optional(),
  reasonCode: z.enum(HOLD_REASON_CODES).optional(),
  comment: z.string().optional(),
});
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;
