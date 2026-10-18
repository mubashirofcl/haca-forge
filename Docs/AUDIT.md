# HACA FORGE to HACA Marketing OS: Architecture & Codebase Audit

**Date:** 18 October 2026  
**Author:** Senior Full-Stack Engineer (MERN)  
**Authority:** [HACA-Marketing-OS-Build-Spec.pdf](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/HACA-Marketing-OS-Build-Spec.pdf), [PROJECT_REPORT.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/PROJECT_REPORT.md), [CURRENT_ROLES_REFERENCE.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/CURRENT_ROLES_REFERENCE.md)  
**Rule:** Planning mode only. No code or schema modified.

---

## 1. Executive Summary & Conversion Boundary

HACA FORGE is currently built as an intake-and-pipeline portal across 10 phases. It is designed around external departments submitting requests, triage by a Marketing Lead, and multi-stage production handoffs across four creative teams (`content`, `graphics`, `cinematography`, `editor`).

The target product, **HACA Marketing OS (V1 Team Workspace)**, completely retires the request-intake portal and multi-stage derivative task engine. It replaces them with:
1. **Unified Workspace:** 7 brand `Profiles` as a query-level filter dimension on shared data.
2. **Strict Business Traceability Chain:** `MonthlyTarget` $\rightarrow$ `Campaign` $\rightarrow$ `WorkItem` (enforced at creation; no orphans).
3. **4-Role Architecture:** `admin` (system owner outside marketing hierarchy), `marketing_head`, `team_lead`, `team_member` scoped by `profileAccess[]`.
4. **Auto-Assignment & Workload Engine:** Capacity/revisions-based recommendations with mandatory override tracking.
5. **Quality & Blockers Loop:** Two-entry review threads, revision flags with root-cause taxonomy, blocker dependency notifications.
6. **LeadSquared (LSQ) Integration:** Read-authoritative funnel analytics, CPL/CPQL, and inbound lead auto-tasking.
7. **14 Dedicated Screens:** Replaced UI with frosted glass components and universal drill-down linking.

---

## 2. API Modules Audit & Classification

| Module Path (`apps/api/src/modules/`) | Current Models | Current Purpose in FORGE | Marketing OS Requirement | Classification | Actions Needed / Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`access/`** | `AccessRequest` | Public registration & admin approval flow | Kept as Admin-only onboarding enabler. Public Request Access form + Admin approval setting role, jobRole, department, profileAccess, capacity. | **KEEP** | Retain module. Update approval logic to support Marketing OS roles and operating fields. Rate limit public submission. |
| **`audit/`** | `AuditLog` | General administrative audit log for setting changes and user edits | Audit log viewer screen is retired. Transition events move to `ActivityEvent`. | **RETIRE** | Remove module. Replace with lightweight domain event logging (`ActivityEvent`). |
| **`auth/`** | None (uses `User`) | JWT cookie authentication, login, refresh, logout, password set, invites | Reused directly. Must adapt token payload to include `role` and `profileAccess`. | **KEEP** | Update session payload with `profileAccess`, `lastProfileId`, and Marketing OS roles. |
| **`calendar/`** | `CalendarEntry` | Multi-channel publishing calendar, clash detection, platform queue | Replaced by Monthly Marketing Calendar for Work Items. | **CHANGE** | Retire clash detection and platform queue. Adapt routes to query WorkItems by deadline/scheduled date. |
| **`campaigns/`** | `Campaign` (stub) | Early draft campaign model from FORGE Phase 9 | Core entity in Marketing OS. Requires `targetId` and `relatedOKR`. | **CHANGE** | Rebuild schema to match Spec §04. Enforce link to `MonthlyTarget`. Add spend/leads actuals. |
| **`comments/`** | `Comment` | Freeform comments on requests and tasks | Replaced by structured `FeedbackEntry` with review rounds and root cause. | **RETIRE** | Delete legacy comments module. Replaced by `feedback` module in Phase 5. |
| **`common/`** | None | 13-stage transition service for ContentItems & Tasks | WorkItem statuses: Not Started, In Progress, Feedback, Pending, Blocked, Approved, Published. | **CHANGE** | Rebuild `transition.service.js` to enforce WorkItem transitions, permissions, and `ActivityEvent` writes. |
| **`content/`** | `ContentItem` | Multi-stage pipeline content tracking | Retired in favor of unified `WorkItem` (one owner, single deadline). | **RETIRE** | Delete routes, controller, service, model. Archive existing collection. |
| **`deliverables/`** | `Deliverable` | Review studio, video player proofing, version compare | Proofing studio retired. Final assets tracked as Cloudinary URLs on WorkItem. | **RETIRE** | Remove proofing studio and deliverable models. Retain direct Cloudinary signing. |
| **`departments/`** | `Department` | Dynamic requesting departments (Sales, Academics, etc.) | 7 fixed operational departments (Design, Video, Social, SEO, WhatsApp, Performance, Tech). | **CHANGE** | Seed fixed 7 departments. Link Person records to departmentId. |
| **`docs/`** | None | OpenAPI documentation endpoints | Reused for API exploration. | **KEEP** | Update route specifications to reflect Marketing OS endpoints. |
| **`jobs/`** | None | BullMQ processors for deadline reminders, digests, recurring requests | Replaced by 7 Automation Rules (overdue escalation, digest, LSQ sync, etc.). | **CHANGE** | Retire FORGE jobs (`runDeadlineRemindersJob`, `runRecurringRequestsJob`, `runCapacityGapJob`). Add AutomationRule runner. |
| **`leave/`** | `LeaveRequest` | Leave management and capacity discounting | Personal leave approval workflow retired from product scope. | **RETIRE** | Remove leave module, routes, and tests. |
| **`masterData/`** | `ContentFormat`, `Platform`, `Priority`, `RequestType`, `HoldReason` | Dynamic CRUD for taxonomy and intake forms | Marketing OS uses fixed reference data (seeded, non-editable). | **RETIRE** | Remove dynamic master data CRUD. Move taxonomy to `@mmp/shared` constants. |
| **`notifications/`** | `Notification` | Socket.io real-time bell and persistence | Core enabler for blocker alerts, feedback mentions, and escalations. | **KEEP** | Retain infrastructure. Update event types (`BLOCKER_ALERT`, `REVISION_FLAGGED`, etc.). |
| **`pipelines/`** | `PipelineTemplate` | Auto-derivation of subtasks from content formats | Pipeline templates and subtask splits retired. Each WorkItem has 1 owner. | **RETIRE** | Delete template engine and derivative task generator. |
| **`reports/`** | `ScheduledReport`, `ReportDefinition` (old) | 6 FORGE operational reports and scheduled mailer | Replaced by 6 Marketing OS Report Definitions (Weekly Marketing, Monthly Scorecard, etc.). | **CHANGE** | Rebuild report generators to read live scoped Marketing OS collections. |
| **`requests/`** | `Request`, `Counter` | Requester intake portal, dynamic forms, triage engine | Completely retired. Marketing team plans its own work inside Campaigns. | **RETIRE** | Delete intake routes, duplicate check, and triage controller. Archive MongoDB collection. |
| **`shoots/`** | `Shoot` | Call sheets, shoot planner, equipment checklists | Dedicated shoot planning module retired. Tracked as WorkItem (`Reel`/`Video Ad`) if needed. | **RETIRE** | Remove shoot planner module and routes. |
| **`status/`** | None | Health check (`/api/status`) | System operational health check. | **KEEP** | Retain without changes. |
| **`statusHistory/`**| `StatusHistory` | Audit trail of status transitions | Replaced by unified `ActivityEvent` model. | **RETIRE** | Delete model. Events are written to `ActivityEvent`. |
| **`tasks/`** | `Task` | Subtasks assigned to production teams | Subtasks retired. Unified entity is `WorkItem`. | **RETIRE** | Delete task module and routes. |
| **`teamAssignments/`**| `TeamAssignment` | Temporary role v2 scoping bridge | Replaced by clean `reportsToIds` and `profileAccess` on Person. | **RETIRE** | Delete module, routes, and tests. |
| **`teams/`** | `Team` | 4 production teams (`content`, `graphics`, etc.) | Replaced by 7 operational Departments. | **RETIRE** | Remove production team CRUD. |
| **`time/`** | `TimeEntry` | Active timers, timesheets, billable hours | Timesheets and active stopwatch tracking retired from scope. | **RETIRE** | Remove time tracking module and routes. |
| **`uploads/`** | None | Cloudinary signed upload endpoints | Reused for file attachments on Work Detail. | **KEEP** | Retain signed upload route. |
| **`users/`** | `User` | User management, roles, teams | Renamed/adapted to `Person`. Added `profileAccess`, `reportsToIds`, `jobRole`. | **CHANGE** | Migrate schema to `Person`. Add capacity, profile access, and reportsTo scoping. |

---

## 3. Web Pages & Components Audit

| Page Path (`apps/web/src/pages/`) | Target Screen in Marketing OS | Classification | Actions Needed |
| :--- | :--- | :--- | :--- |
| **`LoginPage.tsx`** | Screen 1: Login & Profile Selection (`/login`) | **CHANGE** | Add default profile selection logic from `profileAccess` (`All` or last used). |
| **`SetPasswordPage.tsx`** | Password setup on invite (`/set-password`) | **KEEP** | Keep as onboarding enabler. |
| **`UnauthorizedPage.tsx`** | 403 Forbidden screen (`/unauthorized`) | **KEEP** | Keep for permission/scoping denials. |
| **`NotificationsPage.tsx`** | Notifications view (`/notifications`) | **KEEP** | Keep notification listing and mark-as-read. |
| **`admin/AdminDashboard.tsx`** | Retired | **RETIRE** | Delete admin dashboard. |
| **`admin/AccessRequestsPage.tsx`** | Admin Access Requests Enabler (`/admin/access-requests`) | **CHANGE** | Retain and adapt for Admin approval (assigns role, jobRole, department, profileAccess, reportsToIds, capacity). |
| **`admin/AuditLogPage.tsx`** | Retired | **RETIRE** | Delete audit log viewer. |
| **`admin/MasterDataPage.tsx`** | Retired | **RETIRE** | Delete master data configuration screens. |
| **`admin/SettingsPage.tsx`** | Retired | **RETIRE** | Delete settings screen. |
| **`admin/TeamsDepartmentsPage.tsx`** | Retired | **RETIRE** | Delete team/department builder. |
| **`admin/UsersPage.tsx`** | People Setup Enabler (`/people` and `/admin/users`) | **CHANGE** | Retain and adapt: Admin has full user/role management; Marketing Head has scoped view for `people.assign` operating fields. |
| **`calendar/CalendarPage.tsx`** | Screen 4: Monthly Marketing Calendar (`/calendar`) | **CHANGE** | Render WorkItems by deadline/scheduled date with Profile & Department filters. |
| **`calendar/SmDashboard.tsx`** | Retired | **RETIRE** | Remove SM-specific dashboard. |
| **`calendar/BulkImportModal.tsx`** | Retired | **RETIRE** | Remove CSV/social import modal. |
| **`calendar/PublishModal.tsx`** | Retired | **RETIRE** | Remove multi-channel publishing modal. |
| **`lead/LeadDashboard.tsx`** | Screen 2: Team Dashboard (`/dashboard`) | **CHANGE** | Rebuild into 9-section Team Dashboard (Target strip, KPI strip, Priorities, etc.). |
| **`lead/ContentHubPage.tsx`** | Work Drill-Down List (`/work`) | **CHANGE** | Convert into generic filtered Work Items drill-down list. |
| **`lead/LeadReviewQueuePage.tsx`** | Screen 8: Feedback & Revision History (`/feedback`) | **CHANGE** | Rebuild into 2-entry thread review interface with root-cause picker. |
| **`worker/WorkerDashboard.tsx`** | Screen 3: My Work (`/my-work`) | **CHANGE** | Rebuild as personal priority queue for `team_member` (Today, This Week, Later). |
| **`requester/RequesterDashboard.tsx`** | Retired | **RETIRE** | Delete requester dashboard. |
| **`shoots/ShootPlannerPage.tsx`** | Retired | **RETIRE** | Delete shoot planner. |
| **`team/TeamManagementPage.tsx`** | Screen 9: Team Workload (`/workload`) | **CHANGE** | Rebuild into Team Workload page (capacity bars, overload alerts, 5 dimensions). |
| **`time/TimesheetsPage.tsx`** | Retired | **RETIRE** | Delete timesheets page. |
| **`performance/PerformanceDashboard.tsx`**| Retired | **RETIRE** | Delete old performance ad dashboard. |
| **`library/FileLibraryPage.tsx`** | Retired | **RETIRE** | Delete DAM file library. |
| **`reports/ReportsPage.tsx`** | Screen 14: Reports & Automation (`/reports`) | **CHANGE** | Rebuild into Reports & Automation console (6 Report Definitions, 7 Automation Rules). |
| *(New Screen)* | Screen 5: Projects / Campaigns (`/campaigns`) | **NEW** | Build in Phase 2. |
| *(New Screen)* | Screen 6: Project Detail (`/campaigns/:id`) | **NEW** | Build in Phase 2. |
| *(New Screen)* | Screen 7: Single Work Detail (`/work/:id`) | **NEW** | Build in Phase 3. |
| *(New Screen)* | Screen 10: Todo & Priorities (`/todo`) | **NEW** | Build in Phase 3. |
| *(New Screen)* | Screen 11: Issues & Blockers (`/issues`) | **NEW** | Build in Phase 5. |
| *(New Screen)* | Screen 12: Lead Funnel (`/leads`) | **NEW** | Build in Phase 8. |
| *(New Screen)* | Screen 13: Data Center / LSQ (`/data-center`) | **NEW** | Build in Phase 8. |

---

## 4. Hard-Coded Role, Team, and Status Citations

The repository has 427 role matches, 129 team matches, and 274 status matches. Below is an exhaustive module-by-module breakdown of citations that must be refactored or deleted.

### 4.1 Legacy Role Keys (`admin`, `head`, `lead`, `worker`, `sm_manager`, `dept_lead`, `dept_staff`, `viewer`, `management`)

* **`apps/web/src/App.tsx`**:
  * L65: `case 'admin': return <Navigate to="/admin" />`
  * L67: `case 'head': return <Navigate to="/lead" />`
  * L69: `case 'team_lead': return <Navigate to="/teams" />`
  * L71: `case 'worker': return <Navigate to="/worker" />`
  * L73: `case 'sm_manager': return <Navigate to="/calendar" />`
  * L75-76: `case 'dept_lead': case 'dept_staff': return <Navigate to="/requester" />`
  * L78: `case 'management': return <Navigate to="/reports" />`
  * L105, L177, L197, L207, L219, L253, L263, L275, L285, L295, L307: `allowedRoles` arrays on `ProtectedRoute`.
* **`apps/web/src/components/Layout.tsx`**:
  * L104-110: `user?.role === 'admin' ? '/admin' : user?.role === 'head' ? '/lead' : user?.role === 'worker' ? '/worker' : '/requester'`
  * L123, L141, L158, L178, L206, L248, L274, L311, L348, L384: Hardcoded role gates across sidebar tabs.
* **`apps/api/src/modules/access/model.js`**:
  * L30, L56: `enum: ['viewer', 'dept_staff', 'dept_lead', 'worker', 'sm_manager', 'team_lead', 'lead', 'admin']`
* **`apps/api/src/modules/access/service.js`**:
  * L90: `allowedRoles = ['viewer', 'dept_staff', 'dept_lead', 'worker', 'sm_manager', 'team_lead', 'lead', 'management', 'head', 'admin']`
* **`apps/api/src/modules/deliverables/service.js`**:
  * L360: `['lead', 'head', 'sm_manager', 'admin'].includes(user.role)`
  * L400: `['lead', 'head', 'admin'].includes(user.role)`
* **`apps/api/src/modules/leave/service.js`**:
  * L51: `['lead', 'head', 'admin'].includes(user.role)`
  * L75: `user.role === 'worker'`
  * L85: `['lead', 'head', 'admin'].includes(user.role)`
* **`apps/api/src/modules/jobs/processors.js`**:
  * L189: `role: { $in: ['admin', 'head', 'lead', 'marketing_lead', 'creative_lead', 'copy_lead', 'video_lead'] }`
* **`apps/api/src/modules/content/service.js`**:
  * L40: `if (user.role === 'dept_lead')`
  * L42: `if (user.role === 'dept_staff')`
  * L44: `if (user.role === 'worker')`
* **`packages/shared/src/index.ts`**:
  * L7-16: `ROLE_KEYS = ['admin', 'management', 'head', 'team_lead', 'worker', 'sm_manager', 'dept_lead', 'dept_staff']`
  * L20-23: `LEGACY_ROLE_ALIASES = { lead: 'head', viewer: 'management' }`
  * L165-220: Role permission map with hundreds of permissions mapped to legacy keys.

### 4.2 Legacy Production Team Keys (`content`, `graphics`, `cinematography`, `editor`)

* **`packages/shared/src/index.ts`**:
  * L35-40: `TEAM_KEYS = ['content', 'graphics', 'cinematography', 'editor']`
* **`apps/api/src/modules/jobs/processors.js`**:
  * L237: `const teams = ['content', 'graphics', 'cinematography', 'editor']`
* **`apps/api/src/modules/pipelines/service.js`**:
  * L21: `team: 'content'` (Copywriting subtask)
  * L31: `team: 'graphics'` (Design subtask)
  * L58, L68, L95, L105: Multi-stage pipeline step team assignments.
* **`apps/api/src/modules/shoots/service.js`**:
  * L62: `team: 'content'`
  * L132: `team: 'cinematography'`
  * L250, L301: Cinematographer assignment checks.
  * L259, L268: Editor assignment checks.
* **`apps/api/src/modules/teams/service.js`**:
  * L262, L264, L279, L281, L309: Team key lookups.
* **`apps/api/scripts/seed.js`**:
  * L500: `key: 'content'`, L513: `key: 'graphics'`, L526: `key: 'cinematography'`, L539: `key: 'editor'`.

### 4.3 FORGE Pipeline Statuses (`under_triage`, `needs_info`, `converted`, `brief_ready`, `in_production`, `in_review`, `changes_requested`, `reshoot_needed`, `on_hold`, `planned`, `live`, `paused`, `retired`)

* **`apps/api/src/modules/common/transition.service.js`**:
  * L9: `under_triage`, `needs_info`
  * L13: `converted`
  * L20: `in_production`, `planned`
  * L25-45: 44 state transition checks for ContentItem and Task.
* **`apps/api/src/modules/reports/dashboard.service.js`**:
  * L50: `status: 'on_hold'`
  * L54: `status: 'changes_requested'`
  * L101: `status: 'live'`
  * L134: `status: { $in: ['under_triage', 'needs_info'] }`
  * L141: `status: 'converted'`
* **`apps/api/src/modules/reports/service.js`**:
  * L169: `status: 'live'`
  * L187: `status: { $in: ['under_triage', 'needs_info'] }`
  * L300: `status: 'changes_requested'`
  * L403: `status: 'on_hold'`
* **`apps/web/src/pages/lead/LeadDashboard.tsx`**:
  * L45, L68, L92: Status filters matching `under_triage`, `needs_info`, `converted`.
* **`apps/web/src/pages/requester/RequesterDashboard.tsx`**:
  * L38, L72: Status filters for requester tickets.

---

## 5. Architectural & Conversion Risks

1. **Test Suite Coupling to Retired Modules:**
   12 out of 14 test suites directly import retired models (`Request`, `ContentItem`, `Task`, `Deliverable`, `Shoot`, `TimeEntry`, `LeaveRequest`, `TeamAssignment`). Removing these models without simultaneously pruning their tests will break `npm test` completely.
2. **Background Processors referencing Retired Models:**
   `apps/api/src/modules/jobs/processors.js` contains 5 workers that actively query `Task`, `ContentItem`, `Request`, and `ScheduledReport`. If the worker starts without these models, it crashes immediately.
3. **Database Seed Script Coupling:**
   `apps/api/scripts/seed.js` and `apps/api/scripts/seed-demo.js` generate hundreds of records using retired models and `PipelineTemplate`. They cannot run against Marketing OS models.
4. **Shared Types Package Re-Export Dependencies:**
   `packages/shared/src/index.ts` exports 143+ permission keys and legacy enums used across both frontend and backend. Changing `@mmp/shared` requires running `npm run build` in `packages/shared` before `apps/api` or `apps/web` can compile.
5. **Session & JWT Cookie Invalidation:**
   Existing users in MongoDB lack `profileAccess` and have legacy `role` strings (`lead`, `worker`, `sm_manager`). If an existing user logs in before the Phase 1 migration runs, authorization middleware will reject requests with 403 Forbidden.
6. **Frontend Routing Black Hole:**
   `RootRedirect` in `App.tsx` redirects legacy roles to `/lead`, `/teams`, `/worker`, `/requester`. When these pages are retired in Phase 0, all users would hit broken or empty routes unless redirected to `/dashboard`.
7. **Cross-Module Imports on Deletion:**
   `apps/api/src/modules/notifications/service.js` listens to `request.*`, `task.*`, `content.*`, and `deliverable.*` events. Removing those modules requires removing the obsolete listeners so unhandled events do not leak.
8. **Cloudinary Asset Storage Drift:**
   Existing `Deliverable` records hold Cloudinary URLs. When retiring `Deliverable`, historic upload records must remain accessible or archived so that linked files are not lost.
9. **Single Transition Service Invariant:**
   FORGE allowed direct status updates in several controllers (`tasks/controller.js`, `requests/controller.js`). Marketing OS strictly requires that **all** status changes route through ONE transition service that logs `ActivityEvent`.
10. **Query Scoping Leaks:**
    FORGE relied on controller-level `req.user.team` checks. Marketing OS mandates query-level scoping via `resolveScope(user, filters)`. Any missed query allows cross-brand or cross-team data leaks.

---

## 6. Roles v2 Residue & Verification

### 6.1 Confirmation: Roles v2 Landed in Code and Database
**Finding:** The earlier Roles v2 refactoring **did land** in this repository and was executed against the database.
1. **Database Role Distribution:** Querying `mongodb://127.0.0.1:27017/marketing_portal` confirms 36 total users where `lead` and `viewer` have already been converted to `head` and `management`:
   * `worker`: 20
   * `team_lead`: 4
   * `admin`: 1
   * `head`: 2
   * `dept_lead`: 4
   * `sm_manager`: 1
   * `dept_staff`: 3
   * `management`: 1
2. **Collections:** The `teamassignments` collection exists in MongoDB (0 documents currently).
3. **Files containing Roles v2 residue:**
   * [`packages/shared/src/index.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/packages/shared/src/index.ts): Defines `ROLE_KEYS` with `'head'` and `'management'`, `LEGACY_ROLE_ALIASES` (`lead -> head`, `viewer -> management`), and `normalizeRole()`.
   * [`apps/api/src/modules/users/model.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/users/model.js): Accepts all 10 keys via `enum: [...ROLE_KEYS, 'lead', 'viewer']`.
   * [`apps/api/src/modules/teamAssignments/model.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/teamAssignments/model.js): Implements `TeamAssignment` schema (`workerId`, `teamLeadId`, `assignedBy`, `active`).
   * [`apps/api/src/modules/teamAssignments/service.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/teamAssignments/service.js), `controller.js`, `routes.js`: Team assignment endpoints.
   * [`apps/api/src/lib/teamAccess.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/lib/teamAccess.js): Scoping helper querying `TeamAssignment`.
   * [`scripts/migrate-roles-v2.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/scripts/migrate-roles-v2.js): 319-line migration script.
   * [`apps/api/test/roles_v2_scoping.test.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/test/roles_v2_scoping.test.js), [`apps/api/test/teamAssignments.test.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/test/teamAssignments.test.js), [`apps/api/test/migration.test.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/test/migration.test.js): Test suites testing Roles v2.
   * [`apps/api/src/server.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/server.js): Mounts `/api/team-assignments`, calls `normalizeRole`.
   * [`apps/web/src/App.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/App.tsx): Routes `head` and `management` in `RootRedirect`.

### 6.2 Role Keys Accepted Today
* **In `@mmp/shared`:**
  * Canonical `ROLE_KEYS`: `admin`, `management`, `head`, `team_lead`, `worker`, `sm_manager`, `dept_lead`, `dept_staff` (8 keys)
  * Legacy Aliases: `lead` $\rightarrow$ `head`, `viewer` $\rightarrow$ `management`
* **In `User` Model (`apps/api/src/modules/users/model.js`):**
  * Accepts all **10 role keys**: `admin`, `lead`, `head`, `management`, `team_lead`, `worker`, `sm_manager`, `dept_lead`, `dept_staff`, `viewer`.

