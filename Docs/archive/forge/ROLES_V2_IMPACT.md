# Roles v2 Architecture & Impact Analysis (Stage 0 Baseline)

> **Document Status**: Stage 0 Complete — Baseline Recorded & Impact Analysis Ready for Review  
> **Target Release**: HACA FORGE "Roles v2" Refactor  
> **Date**: October 2026

---

## 1. Executive Summary & Goals

HACA FORGE is refactoring its role and access control model from **Roles v1** (8 roles with fixed team-scoped leads) to **Roles v2**:
1. **Renamed Roles**:
   - `lead` &rarr; `head` (Marketing Head: runs the entire marketing function; retains all screens and permissions of today's lead).
   - `viewer` &rarr; `management` (Management: read-only executive access to reports, dashboards, exports, scheduled reports, DAM library).
2. **Derived Admin Permissions**:
   - `admin` permissions in `@mmp/shared` are derived as `[...PERMISSION_KEYS]` (dynamic full access without manual enumeration).
3. **New Many-to-Many Worker-to-Lead Assignment Model (`TeamAssignment`)**:
   - `team_lead` is no longer constrained to a single production team (`content`, `graphics`, `cinematography`, `editor`). Instead, each `team_lead` manages a dynamic set of workers via `TeamAssignment` records.
   - A creative worker may have multiple team leads; a team lead may manage multiple workers.
   - Centralized helper `getManagedWorkerIds(user)` governs all `team_lead` access across task assignment, reassignment, deliverable review, leave approval, timesheets, and reports.
4. **Deliverable Review Governance**:
   - Deliverable review is allowed for: `head`, `admin`, or a `team_lead` who manages the task assignee AND (`task.assignedBy` is that lead, or `assignedBy` is empty/system/head).
5. **Zero Disruption Guarantee**:
   - URLs remain identical (`/lead`, `/lead/inbox`, `/lead/content`, `/lead/reviews`, etc.).
   - Unrelated fields (`Department.lead`, `Team.lead`, `leadTimeDays`, `dept_lead`) are strictly preserved.
   - Backward compatibility via `LEGACY_ROLE_ALIASES = { lead: 'head', viewer: 'management' }` for in-flight JWT tokens, legacy DB documents, and existing fixtures.

---

## 2. Stage 0 Baseline Test & Verification Results

Prior to making any code modifications, the full baseline test suites, TypeScript typechecks, and linters were executed.

| Workspace / Target | Command | Result | Details |
|---|---|:---:|---|
| **Root Workspace Typecheck** | `npm run typecheck` | ✅ **PASS** | 0 errors across `@mmp/shared`, `@mmp/api`, and `@mmp/web` |
| **API Test Suite** | `npm run test -w apps/api` | ✅ **PASS** | **11 test files passed, 129/129 tests passed (100% green)** |
| **Web Test Suite** | `npm run test -w apps/web` | ✅ **PASS** | **1 test file passed, 1/1 test passed** |
| **Total Test Baseline** | `npm run test --workspaces` | ✅ **PASS** | **12 test files passed, 130/130 tests passed** |
| **Linter** | `npm run lint` | ⚠️ Note | Global root `eslint` binary is not in devDependencies (`'eslint' is not recognized`). |

### Baseline Test Suite Details (`apps/api`)
1. `test/status.test.js`: 1 test passed
2. `test/permissions.test.js`: 5 tests passed
3. `test/phase2.test.js`: 10 tests passed
4. `test/phase3.test.js`: 13 tests passed
5. `test/phase4.test.js`: 7 tests passed
6. `test/phase5.test.js`: 7 tests passed
7. `test/phase6.test.js`: 7 tests passed
8. `test/phase7.test.js`: 9 tests passed
9. `test/phase8.test.js`: 14 tests passed
10. `test/phase9.test.js`: 24 tests passed
11. `test/phase10_e2e.test.js`: 32 tests passed  
**Total API Baseline: 129 passing tests.**

---

## 3. Scope Boundary & Name Preservation Rules

> [!IMPORTANT]
> **Strict Name Preservation Rules**:
> The string `lead` appears in several unrelated architectural contexts throughout the codebase. The following fields **MUST NOT** be modified:
> - `Department.lead`: ObjectId reference pointing to the department's designated head (e.g. Sales Lead).
> - `Team.lead`: ObjectId reference pointing to the designated lead of a production team.
> - `ContentFormat.leadTimeDays`, `Pipeline.defaultLeadTimeDays`, `Stage.leadTimeShare`: Delivery schedule calculation metrics.
> - `dept_lead`: Role key representing external department leads (Sales Lead, Academics Lead).
> - Route paths: `/lead`, `/lead/inbox`, `/lead/content`, `/lead/reviews` stay unchanged.

---

## 4. Comprehensive Repository Impact Table

The following table catalogs every occurrence of role keys, checks, scoping logic, socket rooms, jobs, and navigation predicates across the repository:

| # | File Path | Line(s) | Current Implementation | Planned Roles v2 Change |
|:---:|---|:---:|---|---|
| **Shared Package (`packages/shared`)** |
| 1 | `packages/shared/src/index.ts` | 7–16 | `ROLE_KEYS = ['admin', 'lead', 'team_lead', 'worker', 'sm_manager', 'dept_lead', 'dept_staff', 'viewer']` | Replace with: `['admin', 'management', 'head', 'team_lead', 'worker', 'sm_manager', 'dept_lead', 'dept_staff']`. Export `LEGACY_ROLE_ALIASES = { lead: 'head', viewer: 'management' } as const`. |
| 2 | `packages/shared/src/index.ts` | 128–152 | `PERMISSION_KEYS` (21 keys) | Add new keys: `'assignment.manage'`, `'assignment.view'`. Total becomes 23 permission keys. |
| 3 | `packages/shared/src/index.ts` | 154–177 | `admin: ['user.approve', ...]` hand-listed array | Derive dynamically: `admin: [...PERMISSION_KEYS]`. |
| 4 | `packages/shared/src/index.ts` | 178–194 | `lead: [15 permissions]` | Rename key to `head`. Retain all 15 permissions + add `'assignment.view'`. |
| 5 | `packages/shared/src/index.ts` | 195–205 | `team_lead: [9 permissions]` | Add `'review.approve'` and `'assignment.view'`. Retains existing 9 permissions. |
| 6 | `packages/shared/src/index.ts` | 206–212 | `worker: [5 permissions]` | Add `'assignment.view'`. Retains existing 5 permissions. |
| 7 | `packages/shared/src/index.ts` | 235–237 | `viewer: ['report.view']` | Rename key to `management`. Retains `['report.view']`. |
| 8 | `packages/shared/src/index.ts` | 255 | `requestedRole: z.enum(ROLE_KEYS)` | Automatically inherits updated `ROLE_KEYS`. |
| 9 | `packages/shared/src/index.ts` | 277 | `assignedRole: z.enum(ROLE_KEYS).optional()` | Automatically inherits updated `ROLE_KEYS`. |
| **API Backend Models & Schemas (`apps/api`)** |
| 10 | `apps/api/src/modules/users/model.js` | 23–27 | `role: { type: String, enum: ROLE_KEYS }` | Accept new `ROLE_KEYS` plus legacy keys during migration window. |
| 11 | `apps/api/src/modules/access/model.js` | 28–32, 54–58 | `requestedRole` & `assignedRole`: `enum: ROLE_KEYS` | Accept new `ROLE_KEYS` plus legacy keys during migration window. |
| 12 | `apps/api/src/modules/tasks/model.js` | New Field | Task model lacks assigning actor | Add `assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }`. |
| 13 | `apps/api/src/modules/teamAssignments/` | New Module | N/A | Create `TeamAssignment` model with unique partial index on `(workerId, teamLeadId, active: true)`, indexes on `(teamLeadId, active)` and `(workerId, active)`. |
| **Auth & Permissions Middleware (`apps/api`)** |
| 14 | `apps/api/src/middleware/auth.js` | 44–66 | `req.user = user; req.ability = defineAbilityForUser(user);` | Normalize role via `LEGACY_ROLE_ALIASES[user.role] || user.role`. |
| 15 | `apps/api/src/server.js` | 133 | `socket.user = decoded;` | Normalize socket user role via `LEGACY_ROLE_ALIASES`. |
| 16 | `apps/api/src/server.js` | 149–151 | `socket.join('role:' + socket.user.role)` | Joins `role:head` (or alias normalized). |
| 17 | `apps/api/src/modules/auth/service.js` | 10–16 | `generateTokens(user)` payload contains `role: user.role` | Normalize via `LEGACY_ROLE_ALIASES[user.role] || user.role`. |
| 18 | `apps/api/src/modules/auth/service.js` | 104, 159 | `permissions: ROLE_PERMISSIONS[user.role] || []` | Resolves from updated `ROLE_PERMISSIONS` dictionary. |
| 19 | `apps/api/src/modules/auth/controller.js` | 83, 90–91 | User profile and permissions resolution in `/auth/me` | Normalized role and permissions. |
| 20 | `apps/api/src/lib/permissions.js` | 11–16 | `defineAbilityForUser(user)` CASL ability generator | Role checked against normalized role; `admin` gets `manage all`. |
| **Access Requests & User Management (`apps/api`)** |
| 21 | `apps/api/src/modules/access/service.js` | 90 | `if ((assignedRole === 'admin' || assignedRole === 'lead') && adminUser.role !== 'admin')` | Change to: `if (['admin', 'head', 'management'].includes(assignedRole) && adminUser.role !== 'admin')`. |
| 22 | `apps/api/src/modules/users/service.js` | 32–45 | `updateUserRole`: updates user role & audit logs | When changing role away from `worker` or `team_lead`, automatically soft-end active `TeamAssignment` rows with audit entry. |
| **Requests & Triage Scoping (`apps/api`)** |
| 23 | `apps/api/src/modules/requests/service.js` | 51 | `if (user.role === 'admin' || user.role === 'lead')` | Update to: `if (user.role === 'admin' || user.role === 'head')`. |
| 24 | `apps/api/src/modules/requests/service.js` | 256, 322 | `const isPrivileged = ['admin', 'lead'].includes(user.role);` | Update to: `['admin', 'head'].includes(user.role)`. |
| 25 | `apps/api/src/modules/requests/service.js` | 293, 372 | `User.find({ role: { $in: ['lead', 'admin'] } })` | Query `role: { $in: ['head', 'admin'] }`. |
| **Tasks & Pipeline Allocation (`apps/api`)** |
| 26 | `apps/api/src/modules/tasks/service.js` | 137–151 | `updateTask(id, updates)` | When assignee changes, set `task.assignedBy = user._id`. |
| 27 | `apps/api/src/modules/tasks/service.js` | 389 | `User.find({ role: { $in: ['lead', 'admin'] } })` | Query `role: { $in: ['head', 'admin'] }`. |
| 28 | `apps/api/src/modules/content/pipeline.js` | - | `initializeContentPipeline` automated derivation | Pipeline auto-assign leaves `task.assignedBy = null`. |
| **Team Operations & Scoping (`apps/api`)** |
| 29 | `apps/api/src/modules/teams/service.js` | 121–125 | `if (user.role === 'team_lead') { if (targetTeam !== userTeam) throw Forbidden }` | **Refactor with helper**: `team_lead` may view any team key containing &ge;1 managed worker (`getManagedWorkerIds`). Filter members, workload, skills to managed workers. |
| 30 | `apps/api/src/modules/teams/service.js` | 351–423 | `reassignTask`: reassigns task | **Refactor with helper**: `team_lead` may reassign only if task's current assignee is managed AND target worker is managed. Set `task.assignedBy = actor._id`. |
| **Timesheets & Leaves Scoping (`apps/api`)** |
| 31 | `apps/api/src/modules/time/service.js` | 146–155 | `user.role === 'team_lead'` pending timesheets list | Filter `userId: { $in: await getManagedWorkerIds(user) }`. |
| 32 | `apps/api/src/modules/time/service.js` | 244–255 | `reviewer.role === 'team_lead'` timesheet batch approve | Validate all entry worker IDs are within `await getManagedWorkerIds(reviewer)`. Multi-lead: any assigned lead can approve. |
| 33 | `apps/api/src/modules/leave/service.js` | 50 | `User.find({ role: { $in: ['lead', 'admin'] } })` | Query `role: { $in: ['head', 'admin'] }`. |
| 34 | `apps/api/src/modules/leave/service.js` | 76–85 | `user.role === 'team_lead'` leave requests list | Filter `userId: { $in: await getManagedWorkerIds(user) }`. |
| 35 | `apps/api/src/modules/leave/service.js` | 88, 194 | `['admin', 'lead'].includes(user.role)` | Update to: `['admin', 'head'].includes(user.role)`. |
| 36 | `apps/api/src/modules/leave/service.js` | 108 | `!['admin', 'lead', 'team_lead'].includes(reviewer.role)` | Update to: `!['admin', 'head', 'team_lead'].includes(reviewer.role)`. |
| 37 | `apps/api/src/modules/leave/service.js` | 124 | `reviewer.role === 'team_lead'` leave approve check | Validate applicant is within `await getManagedWorkerIds(reviewer)`. Multi-lead: any assigned lead can approve. |
| **Deliverable Reviews (`apps/api`)** |
| 38 | `apps/api/src/modules/deliverables/service.js` | 91–170 | `reviewDeliverable`: review decision handler | **Enforce Rule**: Review allowed for `head`, `admin`, OR `team_lead` where task assignee is managed AND (`task.assignedBy` === lead._id OR `task.assignedBy` is null/head). |
| 39 | `apps/api/src/modules/deliverables/service.js` | 331, 371 | `User.find({ role: { $in: ['lead', 'admin'] } })` | Query `role: { $in: ['head', 'admin'] }`. |
| 40 | `apps/api/src/modules/deliverables/service.js` | 394 | `!['admin', 'lead', 'team_lead'].includes(user.role)` | Update to: `!['admin', 'head', 'team_lead'].includes(user.role)`. |
| 41 | `apps/api/src/modules/deliverables/service.js` | 421 | `['admin', 'lead'].includes(user.role)` | Update to: `['admin', 'head'].includes(user.role)`. |
| **Reports Engine & Scoping (`apps/api`)** |
| 42 | `apps/api/src/modules/reports/service.js` | 26–65 | `getScopingFilter(user, entityType)` | **Replace with unified `resolveReportScope(user)`**: returns `'all'` for `admin`/`head`/`management`, `{ workerIds }` for `team_lead`, `{ departmentId }` for `dept_lead`, `{ userId }` for `worker`. |
| 43 | `apps/api/src/modules/reports/service.js` | 897, 906 | `['admin', 'lead'].includes(user.role)` | Update to: `['admin', 'head'].includes(user.role)`. |
| 44 | `apps/api/src/modules/reports/dashboard.service.js` | 161–203 | `role === 'team_lead'` dashboard metrics | Scope team tasks, members, and blocked counts to `await getManagedWorkerIds(user)`. |
| 45 | `apps/api/src/modules/reports/dashboard.service.js` | 205–241 | Default executive dashboard summary | Resolves for `admin`, `head`, `management`. |
| **Notifications, Jobs & Mailer (`apps/api`)** |
| 46 | `apps/api/src/modules/notifications/service.js` | 191, 381 | `role: { $in: ['marketing_lead', 'admin'] }` | Query `role: { $in: ['head', 'admin'] }`. |
| 47 | `apps/api/src/modules/notifications/service.js` | 250, 275, 293 | Worker events (`task.blocked`, `deadline.approaching`, `deadline.overdue`, `review.submitted`) | **Update routing**: dispatch to `head` AND to that worker's active team leads (assigning lead prioritized). |
| 48 | `apps/api/src/modules/jobs/processors.js` | 189 | `runDailyDigestJob` leads query | Query `role: { $in: ['admin', 'head'] }`. |
| 49 | `apps/api/src/lib/mailer.js` | 96 | `"reach out to the Marketing Lead"` | Update text to: `"reach out to the Marketing Head"`. |
| 50 | `apps/api/src/modules/docs/openapi.js` | 60 | `enum: ['admin', 'lead', ... 'viewer']` | Update enum to the 8 new canonical roles. |
| **Frontend Routing & Guards (`apps/web`)** |
| 51 | `apps/web/src/App.tsx` | 64–80 | `RootRedirect` switch cases | `admin` &rarr; `/admin`, `head` &rarr; `/lead`, `team_lead` &rarr; `/teams`, `management` &rarr; `/reports`, `worker` &rarr; `/worker`, `sm_manager` &rarr; `/calendar`, `dept_lead`/`dept_staff` &rarr; `/requester`. |
| 52 | `apps/web/src/App.tsx` | 175, 195 | `/lead`, `/lead/content` protected routes | `allowedRoles={['head', 'admin']}`. |
| 53 | `apps/web/src/App.tsx` | 205 | `/lead/reviews` protected route | `allowedRoles={['head', 'admin', 'team_lead']}` (added `team_lead`). |
| 54 | `apps/web/src/App.tsx` | 217 | `/worker` protected route | `allowedRoles={['worker', 'head', 'admin']}`. |
| 55 | `apps/web/src/App.tsx` | 251 | `/calendar` protected route | `allowedRoles={['admin', 'head', 'sm_manager']}`. |
| 56 | `apps/web/src/App.tsx` | 273, 283, 293 | `/shoots`, `/teams`, `/timesheets` | `allowedRoles={['admin', 'head', 'team_lead', ...]}`. |
| 57 | `apps/web/src/App.tsx` | 305 | `/performance` protected route | `allowedRoles={['admin', 'head', 'dept_lead']}`. |
| 58 | `apps/web/src/components/ProtectedRoute.tsx` | 35 | `allowedRoles.includes(user.role)` | Respects new roles and fallback permissions. |
| **Frontend Layout & Navigation (`apps/web`)** |
| 59 | `apps/web/src/components/Layout.tsx` | 106 | `user?.role === 'lead'` | Update to: `user?.role === 'head'`. |
| 60 | `apps/web/src/components/Layout.tsx` | 126–195, 324–372 | `show: ['admin', 'lead'].includes(...)` | Replace `'lead'` with `'head'`. |
| 61 | `apps/web/src/components/Layout.tsx` | Admin Nav | Navigation category: Administration | Add "Team Assignments" (`/admin/team-assignments`, permission: `assignment.manage`). |
| **Frontend Pages & Dialogs (`apps/web`)** |
| 62 | `apps/web/src/pages/LoginPage.tsx` | 76, 87 | Role redirection switch | `lead` &rarr; `head`, `viewer` &rarr; `management`, add `team_lead` &rarr; `/teams`. |
| 63 | `apps/web/src/pages/LoginPage.tsx` | 397–398 | Request Access role dropdown options | Replace: `"lead"` &rarr; `"head"` ("Marketing Head"), `"viewer"` &rarr; `"management"` ("Management"), add `"team_lead"` ("Team Lead"). |
| 64 | `apps/web/src/pages/admin/UsersPage.tsx` | 296, 497 | Role filtering and modal role select | Render friendly labels ("Marketing Head", "Management"). Restrict `head`, `management`, `admin` assignment to Admin only. |
| 65 | `apps/web/src/pages/admin/AccessRequestsPage.tsx` | 430 | Assigned role select | Render 8 new roles with friendly labels. |
| 66 | `apps/web/src/pages/time/TimesheetsPage.tsx` | 48 | `['lead', 'team_lead', 'admin'].includes(...)` | Update to: `['head', 'team_lead', 'admin'].includes(...)`. |
| 67 | `apps/web/src/pages/team/TeamManagementPage.tsx` | 78, 192 | Team lead view & tabs | Filter tabs by skill teams with managed workers; add lead filter for Head/Admin; add "Team Leads overview" card. |
| 68 | `apps/web/src/pages/worker/WorkerDashboard.tsx` | New Section | Worker workspace | Add read-only "My Leads" section populated from `/api/team-assignments/me`. |
| 69 | `apps/web/src/pages/admin/TeamAssignmentsPage.tsx` | New Page | Admin team assignment management (`/admin/team-assignments`) | Lead-to-workers and worker-to-leads dual selector, unassigned workers alert badge, glassmorphic UI. |
| **Seed & Migration Scripts (`apps/api/scripts`)** |
| 70 | `apps/api/scripts/seed.js` | 457, 470, 692 | Seed users with roles `lead` and `viewer` | Update to `head` and `management`. Seed initial `TeamAssignment` rows. |
| 71 | `apps/api/scripts/seed-demo.js` | 157 | Seed demo user with role `lead` | Update to `head`. |
| 72 | `scripts/migrate-roles-v2.js` | New Script | Migration script | Idempotent migration with `--dry-run` and `--rollback`, document backups, user conversions, assignment backfills, refresh token invalidations. |
| **Test Fixtures & Assertions (`apps/api/test`)** |
| 73 | `apps/api/test/permissions.test.js` | 6–18 | `expectedRoles` assertion | Assert 8 new roles. Add unit test asserting matrix diff matches exact spec requirements. |
| 74 | `apps/api/test/phase7.test.js` | 45 | `User.findOne({ role: 'lead' })` | Update fixture to `role: 'head'`. |
| 75 | `apps/api/test/phase8.test.js` | 42 | `User.findOne({ role: { $in: ['lead', 'marketing_lead'] } })` | Update fixture to `role: { $in: ['head', 'lead'] }`. |
| 76 | `apps/api/test/phase9.test.js` | 51 | `User.findOne({ role: { $in: ['lead', 'marketing_lead'] } })` | Update fixture to `role: { $in: ['head', 'lead'] }`. |
| 77 | `apps/api/test/phase10_e2e.test.js` | 99 | `getAuthCookie('...', '...', 'lead')` | Update fixture to `head`. |

---

## 5. Potential Risks, Edge Cases & Mitigation Strategies

### Risk 1: In-Flight JWT Tokens & Active Sessions
* **Risk**: Users with unexpired cookies containing `role: 'lead'` or `role: 'viewer'` might encounter authorization errors or landing redirect failures.
* **Mitigation**:
  1. `authenticate` middleware and `server.js` socket handshake normalize `decoded.role` through `LEGACY_ROLE_ALIASES`.
  2. The migration script resets `refreshTokenHash` on converted accounts so that upon token expiration, clients cleanly re-authenticate and receive new tokens with `head` or `management`.

### Risk 2: Immutable History Integrity (`AuditLog` & `StatusHistory`)
* **Risk**: Historical entries recording `role: 'lead'` or decisions by previous leads might fail validation or display inconsistent terminology.
* **Mitigation**:
  1. Historical collections (`AuditLog`, `StatusHistory`) will **NEVER** be mutated by the migration.
  2. Display layers and JSON formatters pass role strings through `LEGACY_ROLE_ALIASES` to render uniform UI labels without altering database historical facts.

### Risk 3: Multi-Lead Conflict Resolution
* **Risk**: Two team leads concurrently managing the same worker could encounter race conditions when approving timesheets or leave requests.
* **Mitigation**:
  1. Once any lead approves a timesheet entry or leave request, its status moves to `approved`. A subsequent lead action on the same item becomes an idempotent no-op or returns the already-approved state.
  2. In deliverable review, a team lead can review only if `task.assignee` is managed AND (`task.assignedBy` is that lead OR `assignedBy` is empty/system/head).

### Risk 4: Worker Without an Assigned Team Lead
* **Risk**: A newly approved worker might not yet have an active `TeamAssignment`, making them invisible to all team leads.
* **Mitigation**:
  1. `getManagedWorkerIds(user)` returns `"all"` for `admin` and `head`. Thus, unassigned workers remain fully manageable, assignable, and reviewable by Marketing Head and Admin.
  2. An interactive "Workers without a Lead" panel with a live counter badge is rendered on both the Admin Dashboard and the new `/admin/team-assignments` page.

---

## 6. Verification Plan & Approval Gate

### Order of Execution (Stages 1 through 6)
1. **Stage 1**: Shared package and role rename (`@mmp/shared`, Mongoose enums, auth normalization, core role checks). Run `npm run typecheck` and `npm run test --workspaces`.
2. **Stage 2**: Idempotent migration script (`scripts/migrate-roles-v2.js` with `--dry-run`, `--rollback`, backups, and unit test).
3. **Stage 3**: `TeamAssignment` backend module, `getManagedWorkerIds` helper, routes, and tests.
4. **Stage 4**: Scoping refactor (`team_lead` scoping to managed workers across team dashboards, reassign, leave, timesheets, deliverable reviews, reports, notifications).
5. **Stage 5**: Frontend updates (`AuthContext`, `RootRedirect`, `Layout`, `/admin/team-assignments` page, team lead tabs, worker leads card, UI label updates).
6. **Stage 6**: Regression testing, diff tests, and documentation synchronization.

---

*(Stage 0 analysis complete. No code has been modified. Awaiting user approval to proceed to Stage 1.)*
