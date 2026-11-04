/**
 * Maps raw step statuses and roles to the shared CSS tone classes in index.css
 * (`.status-*`, `.role-*`). Colours live only in the stylesheet; this file only
 * names the tone, so every screen shows a status the same way.
 *
 * Raw status → user-facing label (see getStepStatusLabel in @mmp/shared):
 *   Not Started → Not started        In Progress → In progress
 *   Pending     → Waiting for approval  Feedback  → Changes requested
 *   Approved    → Approved           Blocked     → Blocked
 *   Published   → Posted             isLocked    → Locked
 */
export type StatusTone =
  | 'locked'
  | 'not-started'
  | 'in-progress'
  | 'waiting'
  | 'changes'
  | 'approved'
  | 'blocked'
  | 'posted';

export function statusTone(status?: string | null, isLocked?: boolean): StatusTone {
  if (isLocked) return 'locked';
  switch (status) {
    case 'In Progress':
      return 'in-progress';
    case 'Pending':
      return 'waiting';
    case 'Feedback':
      return 'changes';
    case 'Approved':
      return 'approved';
    case 'Blocked':
      return 'blocked';
    case 'Published':
      return 'posted';
    default:
      return 'not-started';
  }
}

/** Class for a status tone, e.g. `status-in-progress`. Combine with `status-chip`, `status-dot` or `status-tint`. */
export const statusClass = (tone: StatusTone): string => `status-${tone}`;

/** Class for a role tone, e.g. `role-creative-head`. Combine with `role-badge`. */
export function roleClass(role?: string | null): string {
  switch (role) {
    case 'admin':
      return 'role-admin';
    case 'creative_head':
      return 'role-creative-head';
    case 'sm_manager':
      return 'role-sm-manager';
    case 'executive':
      return 'role-executive';
    default:
      return 'role-team-member';
  }
}
