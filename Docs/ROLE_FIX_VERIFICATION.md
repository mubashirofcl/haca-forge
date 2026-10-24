# Role Fix Verification Report: HACA Marketing OS

**Document Reference:** `docs/ROLE_FIX_VERIFICATION.md`  
**Execution Date:** 23 October 2026  
**Mode:** Read-only Codebase Verification (Pass 0) — Zero Code Changes Committed  
**Source of Truth Documents:** `.agent/rules/`, `docs/ROLE_FIX_PLAN.md` (Section 2), `docs/PROJECT_DOCUMENTATION.md`, `packages/shared/src/index.ts`

---

## Executive Summary

A comprehensive, code-level inspection was executed across `apps/api`, `apps/web`, and `packages/shared` to verify the findings in Section 2 of `ROLE_FIX_PLAN.md`, audit all API routes, evaluate role-based UI access, and inspect background worker scheduling.

### Key Verification Highlights:
1. **Critical Findings Confirmed:**
   - **A1 (Token Refresh Missing):** `apiFetch` in `apps/web/src/lib/api.ts` has no 401 interceptor or refresh queue; every session is abruptly dropped after 15 minutes.
   - **A2 (Unauthenticated WebSockets):** `apps/api/src/server.js:144-149` calls `next()` when socket tokens are missing or invalid, accepting unauthenticated WebSocket connections.
   - **B2 (Work Creation by Members):** `POST /api/work` guards with `work.request` (`apps/api/src/modules/workItems/routes.js:28`), which `team_member` holds. Members can create deliverables directly without a `WorkRequest` record or lead approval.
   - **B4 (Unrestricted Deliverable Edits):** `PATCH /api/work/:id` applies all submitted fields (deadlines, priority, effort, brief, stage locks) without field-level role checks or item ownership verification (`apps/api/src/modules/workItems/service.js:239-260`).
   - **B5 (Overloaded People Recommended):** `apps/api/src/modules/assignment/service.js:239-245` only sorts overloaded candidates to the bottom; if all candidates exceed 85%, an overloaded person is still returned as `recommendedPerson`.
   - **B10 (WhatsApp Inbound Fallback Crash):** `apps/api/src/modules/leads/service.js:156` creates a fallback campaign without `targetId`, causing Mongoose validation failure and crashing sync.
   - **B11 (Worker Scheduling Incomplete):** 5 of the 7 Marketing OS automation rules (`month_end_report`, `weekly_report`, `blocker_dependency_alert` 24h cadence, `lsq_live_sync`, `revision_pattern_flag`) are NOT registered in `apps/api/src/worker.js`.

2. **Findings Found NOT AN ISSUE or PARTLY Addressed:**
   - **A8 (Head Editing Other Heads):** **NOT AN ISSUE.** `apps/api/src/modules/people/service.js:185` explicitly blocks marketing heads from editing `admin`, `marketing_head`, and `executive` accounts.
   - **B6 (Workload Cap at 100):** **NOT AN ISSUE.** The backend returns the uncapped percentage (`workloadPct = Math.round((allocatedHours / capacity) * 100)`). The frontend shows `{member.workloadPct}%` in text and only caps the visual CSS progress bar width at `Math.min(100, member.workloadPct)%`.
   - **B8 (Team Lead Performance Scoping):** **NOT AN ISSUE.** `calculateTeamPerformance` and `calculatePersonPerformance` in `apps/api/src/modules/people/metrics.js` already scope through `resolveScope(actor, filters)`.
   - **C5 (Work Preferences UI):** **NOT AN ISSUE.** `apps/web/src/pages/admin/UsersPage.tsx:790-822, 957-975` contains complete checkbox UI for all 6 work preferences in both Create and Edit modals.
   - **C6 (Forgot Password Link):** **NOT AN ISSUE.** `apps/web/src/pages/LoginPage.tsx:233-245, 560-636` provides a "Forgot password?" trigger, modal, and API integration.
   - **D6 (Work Types Available):** **NOT AN ISSUE.** `packages/shared/src/index.ts:196-228` defines all 14 standard types (Blog, Email, WhatsApp Blast, Ad Set, etc.) alongside the 15 design types, mapped to departments.

3. **Critical Newly Discovered Defects:**
   - **Double-Counting Revisions:** When a deliverable is rejected with Revision Required, `revisions` is incremented in `feedback/service.js:230`. When the owner restarts work from Feedback to In Progress, `transition.service.js:145` increments `revisions` a second time! Every revision round counts as 2.
   - **Blocker Directory Scope Leak:** `GET /api/blockers` (`blockers/service.js:272-290`) executes `Blocker.find()` with zero profile/team scoping, leaking all organizational blockers to any team member.
   - **Data Center Health Leak:** `GET /api/datacenter` (`leads/service.js:321-325`) queries `Lead.find()` without `resolveScope`, exposing lead contact details across all brand profiles.
   - **Workload Endpoint Unprotected:** `GET /api/workload` in `apps/api/src/server.js:193` requires authentication but has no permission check (`requirePermission` / `requireAnyPermission`).
   - **Frontend Route Protection Void:** In `apps/web/src/App.tsx`, all routes wrap `<ProtectedRoute>` with no `requiredPermission` or `allowedRoles` props (except `/admin/access-requests`), allowing URL-based access to restricted views.

---

## 1. Verification of Section 2 Findings

| ID | Plan Description | Verification Status | File Path & Line | Exact Current Behaviour | Proposed Fix |
|---|---|---|---|---|---|
| **A1** | Token refresh missing in web client | **CONFIRMED** | `apps/web/src/lib/api.ts:30-55` | `apiFetch` sends requests with credentials, but on HTTP 401 simply throws `ApiError`. There is no token refresh attempt, no retry queue, and no session recovery. Users are logged out after 15 minutes. | Implement token refresh mutex and retry queue in `apiFetch`. On 401, call `POST /api/auth/refresh` once, update cookies/token, replay queued requests. Redirect to `/login` if refresh fails. |
| **A2** | Socket connections accepted on auth failure | **CONFIRMED** | `apps/api/src/server.js:144-149` | Socket middleware catches JWT verification errors or missing tokens, logs a debug warning, and calls `next()` unconditionally without an error argument, allowing unauthenticated sockets to connect. | Replace `next()` in unauthenticated branches and `catch` blocks with `next(new Error('Authentication failed: valid accessToken required'))`. |
| **A3** | Production cookies use `SameSite=None` across sites | **CONFIRMED** | `apps/api/src/modules/auth/controller.js:11` | `getCookieOptions` hardcodes `sameSite: isProd ? 'none' : 'lax'`. In production, cross-site cookies are set with `SameSite=None; Secure`, requiring browsers to accept third-party cookies and increasing CSRF exposure. | Align domains under one registrable root domain (`app.domain.com` and `api.domain.com`). Set `sameSite: 'lax'`, configure `COOKIE_DOMAIN`, and enforce Origin header validation on state-changing requests. |
| **A4** | `USERS_AND_PASSWORDS.md` & demo password in repo | **CONFIRMED** | `docs/USERS_AND_PASSWORDS.md`, `apps/api/src/config/env.js:32` | Passwords, demo seed accounts, and credentials are committed in repository docs. `DEMO_SEED_PASSWORD` is read from env with 6-char fallback. | Remove `USERS_AND_PASSWORDS.md` from git, add to `.gitignore`, rotate all test passwords, restrict demo seeds to development, and enforce password ingestion via environment variables only. |
| **A5** | Reports 'Generate Now' accepts `campaign.manage` | **CONFIRMED** | `apps/api/src/modules/reports/routes.js:34, 39` | `POST /api/reports/definitions/:key/generate` and `POST /api/reports/:key/generate` check `requireAnyPermission('report.configure', 'campaign.manage')`. Because team leads hold `campaign.manage`, they can generate and email reports. | Change route permission guard to `requirePermission('report.configure')`. Only Marketing Head and Admin hold `report.configure`. |
| **A6** | Data Center 'resolve' writes `profileId` & `leadSource` on lead | **CONFIRMED** | `apps/api/src/modules/leads/service.js:376-381` | `resolveDiscrepancy` directly mutates `lead.profileId` and `lead.leadSource` and calls `lead.save()`, violating the read-authoritative constraint on LeadSquared data. | Make LSQ leads strictly read-only. Store resolution status, notes, and profile mapping override in a separate `DataCenterIssue` or discrepancy audit log collection. |
| **A7** | DELETE exists for targets and campaigns | **PARTLY** | `apps/api/src/modules/targets/service.js:196-205`, `apps/api/src/modules/campaigns/service.js:280` | Targets: Partially protected; `deleteMonthlyTarget` blocks deletion if `Campaign.countDocuments({ targetId: id }) > 0`. Campaigns: Fully vulnerable; `deleteCampaign` performs `Campaign.findByIdAndDelete(id)` with zero checks for linked `WorkItem` records, orphaning deliverables. Both hard-delete instead of archiving. | Block campaign deletion if linked `WorkItem` records exist (`WorkItem.countDocuments({ campaignId: id }) > 0`). Replace hard delete with `status = 'Archived'` or soft delete. |
| **A8** | Head can edit other Head accounts | **NOT AN ISSUE** | `apps/api/src/modules/people/service.js:185` | `updatePerson` checks `if (targetRole === 'admin' \|\| targetRole === 'marketing_head')` when `actorRole === 'marketing_head'` and returns HTTP 403 Forbidden. Marketing heads cannot edit other heads. | No code fix required. Document that marketing head self-protection is already enforced in `apps/api/src/modules/people/service.js:185`. |
| **A9** | No change-password endpoint; weak password rules; no forgot-password rate limit | **CONFIRMED** | `apps/api/src/modules/auth/routes.js:47`, `packages/shared/src/index.ts:335` | No `POST /api/auth/change-password` exists. `POST /api/auth/forgot-password` has no rate limiter applied. Password schema only enforces `min(8)`. | Add `POST /api/auth/change-password` (verifying current password). Apply strict rate limiter on forgot-password (e.g. 5/hr). Enforce regex password complexity (uppercase, lowercase, number). |
| **A10** | Swagger documentation open outside production | **CONFIRMED** | `apps/api/src/modules/docs/routes.js:10-17` | `guardDocs` only enforces `authenticate` and `settings.manage` if `env.NODE_ENV === 'production'`. In staging and testing environments, `/api/docs` and `/api/docs/openapi.json` are completely unauthenticated. | Require authentication across all non-local environments (`env.NODE_ENV !== 'development'`). Restrict docs to Admin or authorized team roles. |
| **A11** | Access-request alerts go only to `ADMIN_SEED_EMAIL` | **NOT AN ISSUE** | `apps/api/src/modules/access/service.js:124-130` | `submitAccessRequest` queries all active admin users (`Person.find({ role: 'admin', status: 'active' })`) and adds `ADMIN_SEED_EMAIL` as an extra recipient in a deduplicated `Set`. All active admins receive alerts. | No code fix required. Multi-admin dispatch is already implemented. |
| **B1** | Feedback read endpoints require `analytics.team` or `portal.view`, which members lack | **PARTLY** | `apps/api/src/modules/feedback/routes.js:13, 20`, `packages/shared/src/index.ts:119` | The routes require `analytics.team` or `portal.view`. To allow members to read feedback, `packages/shared` granted `analytics.team` to `team_member`, which inadvertently gives members access to team performance and revision flag routes. | Remove `analytics.team` from `team_member`. Change `GET /api/feedback/work-item/:workItemId` permission guard to allow `feedback.respond` or work item owners/reviewers directly. |
| **B2** | `POST /api/work` accepts `work.request`; members hold it; no `WorkRequest` record | **CONFIRMED** | `apps/api/src/modules/workItems/routes.js:28`, `packages/shared/src/index.ts:116` | `router.post('/', requirePermission('work.request'), workItemController.createWorkItem)`. Team members hold `work.request`, allowing them to create full `WorkItem` records directly. No `WorkRequest` model exists in the database. | Change `POST /api/work` to require `work.create`. Create a dedicated `WorkRequest` entity and route (`POST /api/work-requests`) where members request work from team leads. |
| **B3** | Creative Head/Head/Admin approver lockouts on standalone work | **PARTLY** | `apps/api/src/modules/workItems/transition.service.js:82-112` | For stage work with `reviewRequired: true`, only `Creative Manager (TL)`, `marketing_head`, and `admin` can approve. For standalone work (`reviewRequired: false`), any `team_lead` with brand access can approve, but the system does not check if the lead manages the owner. | Restrict standalone approval to the direct Team Lead of the deliverable owner (via `reportsToIds` or department). Maintain Creative Head approver role for content stages. |
| **B4** | `PATCH /api/work/:id` allows members to edit all fields | **CONFIRMED** | `apps/api/src/modules/workItems/service.js:239-260`, `routes.js:35` | The route requires `work.update.own`, which members hold. The service applies all submitted fields (deadline, priority, estimatedEffortHrs, department, ownerId, stage metadata) with zero role or ownership checks. | Enforce field-level validation: if actor is `team_member`, verify `workItem.ownerId === actor._id` and restrict editable fields to `actualEffortHrs`, `deliverableUrl`, `contentLink`, and `assetsLink`. |
| **B5** | Overloaded candidates (>85%) ranked last instead of excluded | **CONFIRMED** | `apps/api/src/modules/assignment/service.js:239-245, 268-282` | `recommendAssignee` sorts overloaded candidates (`workloadPct > 85`) behind non-overloaded candidates. If all candidates exceed 85%, the top candidate is still recommended with a "Capacity Warning". | Filter out candidates with `workloadPct > 85` from candidate pool. If no candidates remain below 85%, return `recommendedPerson: null` with rationale stating all candidates exceed 85% capacity. |
| **B6** | Workload percentage capped at 100 in calculations | **NOT AN ISSUE** | `apps/api/src/modules/assignment/service.js:35`, `apps/web/src/pages/workload/TeamWorkloadPage.tsx:473, 532` | In API calculations, `workloadPct` is computed as `Math.round((allocatedHours / capacity) * 100)` with no cap (e.g. 150%). In UI, text displays actual `{member.workloadPct}%`, while only the CSS bar width is clamped at `Math.min(100, pct)%`. | No code fix required. Real workload percentage is already calculated and displayed. |
| **B7** | Revisions counter increment timing | **PARTLY** (Double-Counting) | `apps/api/src/modules/feedback/service.js:230`, `apps/api/src/modules/workItems/transition.service.js:145` | `revisions` is incremented in `feedback/service.js:230` when reviewer sets `roundStatus === 'Revision Required'`, AND THEN incremented AGAIN in `transition.service.js:145` when owner transitions from Feedback to In Progress! | Remove the increment from `transition.service.js:145`. Count revisions solely when the reviewer records `Revision Required` in `feedback/service.js:230`. |
| **B8** | Performance endpoints leak other teams to Team Lead | **NOT AN ISSUE** | `apps/api/src/modules/people/metrics.js:35-42, 310-318` | Both `calculatePersonPerformance` and `calculateTeamPerformance` invoke `resolveScope(actor, filters)`. For team leads, `allowedPersonIds` is restricted to their direct reports + department members. | No code fix required. Team lead scoping is enforced in performance services. |
| **B9** | Team leads lack `people.view` | **CONFIRMED** | `packages/shared/src/index.ts:100-114`, `apps/api/src/modules/people/routes.js:12, 16` | `team_lead` permissions list omits `people.view`, `user.manage`, `people.assign`, and `portal.view`. Calling `GET /api/people/` or `GET /api/people/:id` returns HTTP 403 Forbidden, breaking owner pickers. | Add `people.view` to `team_lead` permissions in `packages/shared/src/index.ts`. Scoping is already enforced in `people/service.js`. |
| **B10** | WhatsApp inbound task creates fallback campaign without `targetId` | **CONFIRMED** | `apps/api/src/modules/leads/service.js:156-167` | When creating fallback campaign for WhatsApp leads, `targetId` is omitted. `Campaign.targetId` is strictly required in schema, causing validation error and crashing sync. | Fetch the active `MonthlyTarget` for the lead's `profileId` and current month, and attach `targetId: activeTarget._id` to the fallback campaign creation call. |
| **B11** | BullMQ workers missing escalation and scheduled report jobs | **CONFIRMED** | `apps/api/src/worker.js:59-70, 77-115` | `worker.js` only registers legacy jobs (`deadline-reminders`, `recurring-requests`, `daily-digest`, `capacity-gap`). Marketing OS rules `month_end_report`, `weekly_report`, `blocker_dependency_alert`, and `lsq_live_sync` are omitted from worker registrations. | Register repeatable BullMQ jobs for all 7 automation rules with their respective cron schedules in `apps/api/src/worker.js`. |
| **C1** | Person schema lacks `phone`, `avatar`, `profileCompletedAt`, `lastLoginAt` | **CONFIRMED** | `apps/api/src/modules/people/model.js:5-117` | `Person` schema has `email`, `role`, `workPreferences`, and `lastLogin`, but lacks `phone`, `avatarUrl`, `profileCompletedAt`, and `lastLoginAt`. Phone collected in Request Access is discarded. | Add `phone` (string), `avatarUrl` (string), `profileCompletedAt` (Date), and `lastLoginAt` (Date) to `personSchema` in `apps/api/src/modules/people/model.js` and shared Zod schemas. |
| **C2** | My Account exists as modal and page; both read-only | **CONFIRMED** | `apps/web/src/pages/MyAccountPage.tsx:38-180`, `apps/web/src/components/MyAccountModal.tsx` | My Account is duplicated across modal and page. Both are static read-only cards with no edit forms for name, phone, photo, or password. | Remove `MyAccountModal.tsx`. Add edit profile form (name, phone, avatar upload) and change password form to `MyAccountPage.tsx`. |
| **C3** | No first-login `/welcome` onboarding step | **CONFIRMED** | `apps/web/src/App.tsx:116-150` | No `/welcome` route exists. When `mustSetPassword` is completed, the user lands directly on `/dashboard` or `/my-work` with incomplete profile fields. | Add `/welcome` route and component. Redirect users with `profileCompletedAt: null` to `/welcome` on login to confirm phone, avatar, and notification preferences. |
| **C4** | No role summary card on My Account | **CONFIRMED** | `apps/web/src/pages/MyAccountPage.tsx:40-58` | My Account shows basic role badge ("TEAM LEAD", "TEAM MEMBER") but provides no role summary, authority description, or daily workflow guidance. | Add 5 distinct role cards to `MyAccountPage.tsx` describing scope, permissions, key actions, and limits for the logged-in role. |
| **C5** | No UI to edit work preferences | **NOT AN ISSUE** | `apps/web/src/pages/admin/UsersPage.tsx:790-822, 957-975` | The People directory dialogs already contain full checkbox groups for all 6 work preferences (`WORK_PREFERENCES`: Content, Script, Design, Shoot, Edit, Post) in both Edit and Create modals. | No code fix required. Work preference editing is already functional in `UsersPage.tsx`. |
| **C6** | No forgot-password link on login page | **NOT AN ISSUE** | `apps/web/src/pages/LoginPage.tsx:233-245, 560-636` | `LoginPage.tsx` includes a "Forgot password?" button that triggers a glassmorphic password reset modal calling `POST /api/auth/forgot-password`. | No code fix required. Forgot password UI is already present. |
| **D1** | Profiles list differs from agreed plan | **PARTLY** | `packages/shared/src/index.ts:127-135`, `apps/web/src/pages/calendar/CalendarPage.tsx:65-71` | In `packages/shared`, the 7 HACA profiles are correctly defined. However, legacy brand codes (`creative`, `tech`, `digital`, `kids`, `aviation`, `corporate`) remain hardcoded in `CalendarPage.tsx` profile styling. | Clean up `PROFILE_COLORS` in `CalendarPage.tsx` to use the 7 canonical HACA profile codes. |
| **D2** | Departments list has `offline_ops` and lacks Tech | **NOT AN ISSUE** | `packages/shared/src/index.ts:140-148` | `DEPARTMENTS` in `packages/shared` correctly contains all 7 agreed departments including `Tech` (`tech`). `offline_ops` is not present in active reference taxonomies. | No code fix required. Current reference data matches agreed specifications. |
| **D3** | Single-brand (HACA-only) mode not applied | **CONFIRMED** | `apps/web/src/components/GlobalFilterBar.tsx`, `packages/shared/src/index.ts:127` | All 7 profiles are set to `active: true`. Profile pickers and brand dropdowns are displayed across all screens and global filter bars. | In single-brand mode, set other 6 profiles to `active: false` or hide the brand picker when only HACA is active. |
| **D4** | Campaign goal types & outcomes; work item channel missing | **PARTLY** | `packages/shared/src/index.ts:283-296`, `apps/api/src/modules/workItems/model.js` | Goal types (`Leads`, `Reactivations`, `Enrollments`) and expected outcomes match the agreed list. However, `channel` and `expectedOutcome` are absent from `WorkItem` schema. | Add `channel` (string) and `expectedOutcome` (enum) to `WorkItem` schema and creation forms. |
| **D5** | WorkItem lacks `actualEffortHrs`, timestamps, attribution; blocker duplicate | **CONFIRMED** | `apps/api/src/modules/workItems/model.js:64, 82-87, 140-205` | `WorkItem` lacks `actualEffortHrs`, `channel`, `expectedOutcome`, explicit lifecycle timestamps (`startedAt`, `submittedAt`, `approvedAt`, `publishedAt`), `leadsGenerated`, and `qualifiedLeads`. Blocker fields are duplicated on `WorkItem`. | Add missing fields to `workItemSchema`. Deprecate duplicate blocker fields on `WorkItem` in favor of relational `Blocker` collection. |
| **D6** | Non-design work types missing | **NOT AN ISSUE** | `packages/shared/src/index.ts:196-228` | All 14 standard work types (Blog, Email, WhatsApp Blast, Ad Set, SEO Audit, Copy, etc.) and all 15 design types are present, exported, and mapped to departments in `WORK_TYPE_DEPARTMENT_MAP`. | No code fix required. Standard work types are fully implemented. |
| **D7** | Lead has no campaign/work item links; Campaign stores manual leads | **CONFIRMED** | `apps/api/src/modules/leads/model.js:4-86`, `apps/api/src/modules/campaigns/model.js:60-65` | `Lead` schema has no `campaignId` or `workItemId`. `Campaign` stores manual `leadsActual` and `qualifiedLeadsActual` fields rather than aggregating linked leads. | Add `campaignId` and `workItemId` to `Lead` schema. Compute campaign actuals dynamically via aggregation from linked `Lead` records. |
| **D8** | LSQ API keys missing from `env.js` | **CONFIRMED** | `apps/api/src/config/env.js:12-37` | `env.js` validates 24 environment variables but omits `LSQ_ACCESS_KEY`, `LSQ_SECRET_KEY`, `LSQ_HOST_URL`, and `LSQ_MOCK_MODE`. | Add optional LSQ credentials and sync mode flag to `envSchema` in `apps/api/src/config/env.js`. |
| **E1** | ContentPiece and stage pipelines not built | **CONFIRMED** | `apps/api/src/modules/workItems/model.js:113` | Only individual stage fields exist on `WorkItem`. No `ContentPiece` collection, model, service, or route exists to group sequential stages. | Implement Phase 5b ContentPiece module per `docs/CONTENT_FLOW.md`. |
| **E2** | Content Tracker view on Calendar not built | **CONFIRMED** | `apps/web/src/pages/calendar/CalendarPage.tsx:99` | `CalendarPage.tsx` only offers `month`, `week`, and `list` views. The Social Media / Design table tracker is absent. | Add Content Tracker tab to `/calendar` with stage status chips and quick-add row. |
| **E3** | Assign stages table not built | **CONFIRMED** | `apps/web/src/pages/calendar/CalendarPage.tsx` | No cross-department stage assignment matrix exists for SM Manager or Leads. | Implement stage assignment table in Phase 5b. |
| **E4** | 'Waiting for my approval' queue for approvers | **CONFIRMED** | `apps/web/src/pages/feedback/FeedbackPage.tsx:108`, `apps/web/src/pages/work/MyWorkPage.tsx` | `FeedbackPage` only has tabs `all`, `feedback`, `flagged`, `approved`. `MyWorkPage` only displays owned tasks. Approvers have no dedicated queue of items awaiting their decision. | Add "Waiting for My Approval" filter/tab in `FeedbackPage.tsx` and a dedicated section on `MyWorkPage.tsx` for users holding approver roles. |
| **E5** | Request Work button for members | **CONFIRMED** | `apps/web/src/pages/work/MyWorkPage.tsx`, `apps/web/src/pages/todo/TodoPrioritiesPage.tsx` | No "Request Work" action exists anywhere in the frontend. Members have no mechanism to request tasks from their lead. | Add "Request Work" modal and button on `MyWorkPage` triggering `POST /api/work-requests`. |
| **F1** | Web app has only one smoke test | **CONFIRMED** | `apps/web/src/App.test.tsx` | Only `App.test.tsx` exists in `apps/web`. Zero role-based permission, route guard, or UI component tests exist. | Add Vitest test suites for role-based navigation, empty states, and permission guards. |
| **F2** | No end-to-end journey tests per role | **CONFIRMED** | Root directory | No Playwright or Cypress role journey tests are configured in the repository. | Implement Playwright journey tests covering the 5 canonical user journeys. |
| **F3** | Legacy `/api/calendar` and `CalendarEntry` model unused | **CONFIRMED** | `apps/api/src/modules/calendar/routes.js:10-16` | Frontend uses `/api/work/calendar`. `/api/calendar` is an unmaintained legacy artifact. | Deprecate and remove `/api/calendar` module. |
| **F4** | Legacy `/api/admin/users/*` routes and migration scripts | **CONFIRMED** | `apps/api/src/modules/users/routes.js:10-17`, `scripts/` | `server.js` mounts `/api/admin/users` alongside `/api/people`. Legacy migration scripts remain in `scripts/`. | Consolidate user management into `/api/people`. Archive one-off migration scripts. |
| **F5** | Workspace lives inside OneDrive Desktop folder | **CONFIRMED** | Workspace root | Root path is `c:\Users\ADMIN\OneDrive\Desktop\HACA\TECH\haca-forge`. File locking and cloud sync cause latency and lock errors. | Move repository outside OneDrive to a dedicated local directory (e.g. `C:\dev\haca-forge`). |
| **F6** | Documentation discrepancies on permission counts | **CONFIRMED** | `packages/shared/src/index.ts:39-62`, `docs/PROJECT_DOCUMENTATION.md:317` | Code contains 22 permission keys, while older architecture documentation references ~25 keys (e.g. `settings.manage`). | Reconcile and regenerate documentation directly from `PERMISSION_KEYS` in `@mmp/shared`. |

---

## 2. API Route Security & Integrity Audit (`apps/api`)

Every registered route in `apps/api` was audited against four engineering criteria:
1. **Authentication:** Enforces `authenticate` middleware.
2. **Permission Key:** Enforces `requirePermission(...)` or `requireAnyPermission(...)`.
3. **Validation:** Enforces Zod `validate(...)` on body, query, or params.
4. **Scoping (`resolveScope`):** Applies database query scoping via caller's `profileAccess` and team hierarchy.

### Route Audit Table

| Module | Method | Route Path | Authentication | Permission Key | Zod Validation | Uses resolveScope | Defect / Missing Element |
|---|---|---|---|---|---|---|---|
| **Status** | GET | `/api/status` | Public | None | None | No | None (Public probe) |
| **Status** | GET | `/api/health` | Public | None | None | No | None (Public probe) |
| **Status** | GET | `/api/ready` | Public | None | None | No | None (Public probe) |
| **Auth** | POST | `/api/auth/login` | Public | None | `loginSchema` | No | None (Standard public auth) |
| **Auth** | POST | `/api/auth/refresh` | Public | None | **Missing** | No | Body/cookie token unvalidated |
| **Auth** | POST | `/api/auth/logout` | `authenticate` | None | None | No | None (Self-scope action) |
| **Auth** | GET | `/api/auth/me` | `authenticate` | None | None | No | None (Self-scope action) |
| **Auth** | POST | `/api/auth/request-access` | Public | None | `requestAccessSchema` | No | None (Public request) |
| **Auth** | POST | `/api/auth/set-password` | Public | None | `setPasswordSchema` | No | None (Public activation) |
| **Auth** | POST | `/api/auth/forgot-password` | Public | None | **Missing** | No | **Missing validation & rate limit** |
| **Access** | GET | `/api/admin/access-requests/` | `authenticate` | `user.approve` | **Missing** | N/A (Admin) | Query parameters unvalidated |
| **Access** | PATCH | `/api/admin/access-requests/:id/approve` | `authenticate` | `user.approve` | `accessRequestReviewSchema` | N/A (Admin) | None |
| **Access** | PATCH | `/api/admin/access-requests/:id/reject` | `authenticate` | `user.approve` | **Missing** | N/A (Admin) | Rejection reason unvalidated |
| **Access** | PATCH | `/api/admin/access-requests/:id/info` | `authenticate` | `user.approve` | **Missing** | N/A (Admin) | Request note unvalidated |
| **Access** | POST | `/api/admin/access-requests/bulk-approve` | `authenticate` | `user.approve` | **Missing** | N/A (Admin) | Array of IDs unvalidated |
| **Users** | GET | `/api/admin/users/` | `authenticate` | `user.manage` | **Missing** | N/A (Legacy) | Legacy route unvalidated |
| **Users** | PATCH | `/api/admin/users/:id/role` | `authenticate` | `user.manage` | **Missing** | N/A (Legacy) | Role payload unvalidated |
| **Users** | PATCH | `/api/admin/users/:id/status` | `authenticate` | `user.manage` | **Missing** | N/A (Legacy) | Status payload unvalidated |
| **Users** | PATCH | `/api/admin/users/:id/assignment` | `authenticate` | `user.manage` | **Missing** | N/A (Legacy) | Assignment unvalidated |
| **Users** | POST | `/api/admin/users/:id/force-logout` | `authenticate` | `user.manage` | **Missing** | N/A (Legacy) | Unvalidated |
| **Users** | POST | `/api/admin/users/:id/reset-password` | `authenticate` | `user.manage` | **Missing** | N/A (Legacy) | Unvalidated |
| **People** | GET | `/api/people/` | `authenticate` | `user.manage`, `people.assign`, `people.view`, `portal.view` | **Missing** | **Yes** | Filters unvalidated; Team Lead lacks `people.view` |
| **People** | GET | `/api/people/assignment-candidates` | `authenticate` | `people.assign`, `work.create`, `portal.view` | **Missing** | **No** | **Raw query bypasses resolveScope** |
| **People** | GET | `/api/people/performance/team` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | **Yes** | Member holds `analytics.team` (leaks team data) |
| **People** | GET | `/api/people/:id/performance` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **People** | GET | `/api/people/:id` | `authenticate` | `user.manage`, `people.assign`, `people.view`, `portal.view` | **Missing** | **Yes** | Team Lead blocked (HTTP 403) |
| **People** | POST | `/api/people/` | `authenticate` | `user.manage` | **Missing** | N/A (Admin) | Body unvalidated by middleware |
| **People** | PATCH | `/api/people/:id` | `authenticate` | `user.manage`, `people.assign` | **Missing** | **Yes** | Body unvalidated by middleware |
| **People** | POST | `/api/people/:id/suspend` | `authenticate` | `user.manage` | **Missing** | N/A (Admin) | None |
| **People** | POST | `/api/people/:id/reactivate` | `authenticate` | `user.manage` | **Missing** | N/A (Admin) | None |
| **RefData** | GET | `/api/reference-data/` | `authenticate` | **Missing** | **Missing** | **No** | **No permission check; no scope** |
| **RefData** | GET | `/api/reference-data/profiles` | `authenticate` | **Missing** | **Missing** | **No** | **No permission check; returns all** |
| **RefData** | GET | `/api/reference-data/departments` | `authenticate` | **Missing** | **Missing** | **No** | **No permission check; returns all** |
| **Departments** | GET | `/api/departments/` | `authenticate` | **Missing** | **Missing** | **No** | **No permission check** |
| **Departments** | POST | `/api/departments/` | `authenticate` | `settings.manage` | `departmentSchema` | N/A | `settings.manage` not in `PERMISSION_KEYS` |
| **Departments** | PATCH | `/api/departments/:id` | `authenticate` | `settings.manage` | **Missing** | N/A | Body unvalidated |
| **Departments** | DELETE | `/api/departments/:id` | `authenticate` | `settings.manage` | **Missing** | N/A | Params unvalidated |
| **Notifications** | GET | `/api/notifications/` | `authenticate` | **Missing** | **Missing** | Self | Allowed self-exception |
| **Notifications** | GET | `/api/notifications/preferences` | `authenticate` | **Missing** | **Missing** | Self | Allowed self-exception |
| **Notifications** | PUT | `/api/notifications/preferences` | `authenticate` | **Missing** | **Missing** | Self | Payload unvalidated |
| **Notifications** | PATCH | `/api/notifications/:id/read` | `authenticate` | **Missing** | **Missing** | Self | Allowed self-exception |
| **Notifications** | PATCH | `/api/notifications/mark-all-read` | `authenticate` | **Missing** | **Missing** | Self | Allowed self-exception |
| **Calendar (Legacy)** | GET | `/api/calendar/` | `authenticate` | `work.request`, `work.update.own`, `portal.view` | **Missing** | **No** | **Direct query without resolveScope** |
| **Calendar (Legacy)** | POST | `/api/calendar/` | `authenticate` | `work.create` | **Missing** | N/A | Legacy route unvalidated |
| **Uploads** | POST | `/api/uploads/sign` | `authenticate` | `work.create`, `work.request`, `work.update.own` | `signUploadSchema` | N/A | None |
| **Reports** | GET | `/api/reports/definitions` | `authenticate` | `report.view`, `portal.view` | **Missing** | N/A | None |
| **Reports** | GET | `/api/reports/definitions/:key` | `authenticate` | `report.view`, `portal.view` | **Missing** | N/A | None |
| **Reports** | POST | `/api/reports/definitions/:key/generate` | `authenticate` | `report.configure`, `campaign.manage` | **Missing** | **Yes** | **Team Lead can email reports (A5)** |
| **Reports** | POST | `/api/reports/:key/generate` | `authenticate` | `report.configure`, `campaign.manage` | **Missing** | **Yes** | **Team Lead can email reports (A5)** |
| **Reports** | GET | `/api/reports/view/:key` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Reports** | GET | `/api/reports/department` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Legacy forwarder |
| **Reports** | GET | `/api/reports/team` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Legacy forwarder |
| **Reports** | GET | `/api/reports/individual` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Legacy forwarder |
| **Reports** | GET | `/api/reports/individual/:userId` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Legacy forwarder |
| **Reports** | GET | `/api/reports/content` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Legacy forwarder |
| **Reports** | GET | `/api/reports/bottlenecks` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Legacy forwarder |
| **Reports** | GET | `/api/reports/scorecard` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Legacy forwarder |
| **Reports** | GET | `/api/reports/export` | `authenticate` | `report.view`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Reports** | POST | `/api/reports/scheduled` | `authenticate` | `report.view`, `portal.view` | **Missing** | Self/Privileged | Body unvalidated |
| **Reports** | GET | `/api/reports/scheduled` | `authenticate` | `report.view`, `portal.view` | **Missing** | Self/Privileged | None |
| **Reports** | DELETE | `/api/reports/scheduled/:id` | `authenticate` | `report.view`, `portal.view` | **Missing** | Self/Privileged | None |
| **Dashboard** | GET | `/api/dashboard/` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Dashboard** | GET | `/api/dashboard/overview` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Dashboard** | GET | `/api/dashboard/summary` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Dashboard** | GET | `/api/dashboard/:role` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | **Yes** | Params unvalidated |
| **Docs** | GET | `/api/docs/openapi.json` | Prod only | Prod only (`settings.manage`) | None | No | **Unauthenticated in dev/staging** |
| **Docs** | GET | `/api/docs/` | Prod only | Prod only (`settings.manage`) | None | No | **Unauthenticated in dev/staging** |
| **Targets** | GET | `/api/targets/` | `authenticate` | `target.view`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Targets** | GET | `/api/targets/:id` | `authenticate` | `target.view`, `portal.view` | **Missing** | **Yes** | Params unvalidated |
| **Targets** | POST | `/api/targets/` | `authenticate` | `target.manage` | `monthlyTargetSchema` | **Yes** | None |
| **Targets** | PATCH | `/api/targets/:id` | `authenticate` | `target.manage` | `monthlyTargetUpdateSchema` | **No** | **No resolveScope check** |
| **Targets** | DELETE | `/api/targets/:id` | `authenticate` | `target.manage` | **Missing** | **No** | Hard delete (A7) |
| **Campaigns** | GET | `/api/campaigns/` | `authenticate` | `campaign.manage`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Campaigns** | GET | `/api/campaigns/:id/activity` | `authenticate` | `campaign.manage`, `portal.view` | **Missing** | **Yes** | Params unvalidated |
| **Campaigns** | GET | `/api/campaigns/:id` | `authenticate` | `campaign.manage`, `portal.view` | **Missing** | **Yes** | Params unvalidated |
| **Campaigns** | POST | `/api/campaigns/` | `authenticate` | `campaign.manage` | `campaignSchema` | **Yes** | None |
| **Campaigns** | PATCH | `/api/campaigns/:id` | `authenticate` | `campaign.manage` | `campaignUpdateSchema` | **Yes** | None |
| **Campaigns** | DELETE | `/api/campaigns/:id` | `authenticate` | `campaign.manage` | **Missing** | **Yes** | **No check for child work items (A7)** |
| **Work** | GET | `/api/work/my-work` | `authenticate` | `work.update.own` | **Missing** | Self | Query unvalidated |
| **Work** | GET | `/api/work/calendar` | `authenticate` | `work.request`, `work.update.own`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Work** | GET | `/api/work/todo` | `authenticate` | `work.request`, `work.update.own`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Work** | GET | `/api/work/` | `authenticate` | `work.request`, `work.update.own`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Work** | GET | `/api/work/:id/activity` | `authenticate` | `work.request`, `work.update.own`, `portal.view` | **Missing** | **Yes** | Params unvalidated |
| **Work** | GET | `/api/work/:id` | `authenticate` | `work.request`, `work.update.own`, `portal.view` | **Missing** | **Yes** | Params unvalidated |
| **Work** | POST | `/api/work/` | `authenticate` | `work.request` | `workItemCreateSchema` | **Yes** | **Allows members to create work (B2)** |
| **Work** | PATCH | `/api/work/:id` | `authenticate` | `work.update.own` | `workItemUpdateSchema` | **Yes** | **Allows members to edit all fields (B4)** |
| **Work** | POST | `/api/work/:id/transition` | `authenticate` | `work.update.own` | `workItemTransitionSchema` | **Yes** | Double-counts revisions on restart (B7) |
| **Work** | DELETE | `/api/work/:id` | `authenticate` | `work.create` | **Missing** | **Yes** | Params unvalidated |
| **Assignment** | POST | `/api/assignment/recommend` | `authenticate` | `work.create`, `work.request` | `assignmentRecommendSchema` | **Yes** | Overloaded candidates not excluded (B5) |
| **Assignment** | POST | `/api/assignment/override` | `authenticate` | `assignment.override` | `assignmentOverrideSchema` | N/A | None |
| **Assignment** | GET | `/api/assignment/overrides` | `authenticate` | `assignment.override`, `portal.view` | **Missing** | N/A | Query unvalidated |
| **Workload** | GET | `/api/workload` | `authenticate` | **Missing** | **Missing** | **Yes** | **Missing requirePermission middleware** |
| **Feedback** | GET | `/api/feedback/threads` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Feedback** | GET | `/api/feedback/work-item/:workItemId` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | Item/Owner | **Requires analytics.team (B1)** |
| **Feedback** | POST | `/api/feedback/work-item/:workItemId` | `authenticate` | `feedback.give`, `feedback.respond` | Inside controller | Item/Owner | Increments revisions (B7) |
| **Feedback** | POST | `/api/feedback/` | `authenticate` | `feedback.give`, `feedback.respond` | Inside controller | Item/Owner | None |
| **Revisions** | GET | `/api/revisions/flags` | `authenticate` | `analytics.team`, `portal.view` | **Missing** | **No** | **Queries flags without resolveScope** |
| **Revisions** | POST | `/api/revisions/flags/:id/classify` | `authenticate` | `revision.classify` | Inside controller | N/A | None |
| **Blockers** | POST | `/api/blockers/` | `authenticate` | `work.request`, `work.update.own` | **Missing** | Item/Owner | **No Zod validation middleware** |
| **Blockers** | GET | `/api/blockers/` | `authenticate` | `work.request`, `work.update.own`, `portal.view` | **Missing** | **No** | **No resolveScope! Leaks all blockers** |
| **Blockers** | PATCH | `/api/blockers/:id/resolve` | `authenticate` | `work.request`, `work.update.own` | **Missing** | Item | **No Zod validation middleware** |
| **Blockers** | POST | `/api/blockers/:id/notify` | `authenticate` | `work.request`, `work.update.own` | **Missing** | Item | **No Zod validation middleware** |
| **Automation** | GET | `/api/automation/rules/` | `authenticate` | `automation.manage`, `report.view`, `portal.view` | **Missing** | N/A | Query unvalidated |
| **Automation** | GET | `/api/automation/rules/:id` | `authenticate` | `automation.manage`, `report.view`, `portal.view` | **Missing** | N/A | Params unvalidated |
| **Automation** | PATCH | `/api/automation/rules/:id/toggle` | `authenticate` | `automation.manage` | **Missing** | N/A | Params unvalidated |
| **Automation** | POST | `/api/automation/rules/:id/run` | `authenticate` | `automation.manage` | **Missing** | N/A | Params unvalidated |
| **Leads** | GET | `/api/leads/funnel` | `authenticate` | `lead.view`, `portal.view` | **Missing** | **Yes** | Query unvalidated |
| **Leads** | GET | `/api/leads/datacenter` | `authenticate` | `datacenter.view`, `portal.view` | **Missing** | **No** | **No resolveScope! Leaks all leads** |
| **Leads** | PATCH | `/api/leads/datacenter/:id/resolve` | `authenticate` | `automation.manage` | **Missing** | **No** | **Writes profileId/leadSource (A6)** |
| **Leads** | POST | `/api/leads/sync` | `authenticate` | `automation.manage` | **Missing** | N/A | Body unvalidated |
| **DataCenter** | GET | `/api/datacenter/` | `authenticate` | `datacenter.view`, `portal.view` | **Missing** | **No** | **No resolveScope! Leaks all leads** |
| **DataCenter** | GET | `/api/datacenter/status` | `authenticate` | `datacenter.view`, `portal.view` | **Missing** | **No** | **No resolveScope! Leaks all leads** |
| **DataCenter** | POST | `/api/datacenter/sync` | `authenticate` | `automation.manage` | **Missing** | N/A | None |
| **DataCenter** | PATCH | `/api/datacenter/discrepancies/:id/resolve` | `authenticate` | `automation.manage` | **Missing** | **No** | **Writes profileId/leadSource (A6)** |

---

## 3. Role-by-Role Web Route & Menu Visibility Audit

### Navigation Configuration (`apps/web/src/components/Layout.tsx`)
In `Layout.tsx:106-257`, navigation categories and items are configured with static `show: true` flags, with only two exceptions:
- `My Work`: `show: user?.role !== 'executive'` (hidden for Executive).
- `Access Requests`: `show: hasPermission('user.approve')` (shown only for Admin).

Furthermore, in `apps/web/src/App.tsx:125-345`, `<ProtectedRoute>` is used with **zero parameters** on every single screen except `/admin/access-requests`.

### Role Visibility & Defect Matrix

| Role | Web Routes Accessible via Direct URL | Menu Items Visible in Navigation Bar | Menu Items Visible in UI but REFUSED by API (HTTP 403) |
|---|---|---|---|
| **Admin** | All routes (`/dashboard`, `/my-work`, `/calendar`, `/todo`, `/campaigns`, `/work`, `/feedback`, `/issues`, `/workload`, `/leads`, `/data-center`, `/reports`, `/people`, `/admin/access-requests`, `/my-account`). | All 14 items (Workspace: 4, Campaigns & Work: 4, Analytics & Ops: 4, People & Access: 2). | **None.** Admin holds all permissions and all profile access. |
| **Marketing Head** | All routes (including `/admin/access-requests`, though rejected by route guard). | 13 items (`access-requests` is hidden). | **None** on read routes. However, inside `/people`, attempting to edit Admin, Executive, or other Head accounts returns HTTP 403 Forbidden. |
| **Executive** | All routes (including `/admin/access-requests`, rejected by guard; `/my-work` opens empty/read-only). | 12 items (`my-work` and `access-requests` are hidden). | **None on reads.** Executive can view all 12 screens. However, all mutations (creating campaigns, adding work, classifying causes, running rules) return HTTP 403 Forbidden. Contact details in `/people` are omitted. |
| **Team Lead** | All routes (can type `/admin/access-requests`, rejected by guard). | 13 items (`access-requests` is hidden). | **CRITICAL DEFECT:**<br>1. **`/people` (People Setup):** Visible in menu, but `team_lead` lacks `people.view`, `user.manage`, `people.assign`, and `portal.view`. API call `GET /api/people/` returns **HTTP 403 Forbidden**.<br>2. **Generate Now in Reports:** Visible, but API requires `report.configure` (or `campaign.manage` in current code, allowing unintended execution - A5). |
| **Team Member** | All routes! `<ProtectedRoute>` allows typing `/campaigns`, `/workload`, `/leads`, `/data-center`, `/reports`, `/people` into the URL bar. | 13 items (`access-requests` is hidden). The member sees the entire corporate management menu! | **MAJOR WORKFLOW BREAKDOWN:**<br>1. **`/campaigns` (Campaigns):** Visible in menu; `GET /api/campaigns` returns **HTTP 403 Forbidden**.<br>2. **`/leads` (Lead Funnel):** Visible in menu; `GET /api/leads/funnel` returns **HTTP 403 Forbidden**.<br>3. **`/data-center` (Data Center / LSQ):** Visible in menu; `GET /api/datacenter` returns **HTTP 403 Forbidden**.<br>4. **`/reports` (Reports & Automation):** Visible in menu; `GET /api/reports/definitions` returns **HTTP 403 Forbidden**.<br>5. **`/people` (People Setup):** Visible in menu; `GET /api/people` returns **HTTP 403 Forbidden**.<br>*(Only `/my-work`, `/calendar`, `/todo`, `/work`, `/feedback`, `/issues`, and `/my-account` successfully load).* |

---

## 4. Background Worker & Automation Rules Scheduling Verification

### Worker Process Analysis (`apps/api/src/worker.js`)
Inspection of `apps/api/src/worker.js` and `apps/api/src/modules/jobs/processors.js` reveals:

1. **Active BullMQ Workers:**
   - `emailWorker`: Listens on `QUEUE_NAMES.EMAIL` (`email-queue`), concurrency 5.
   - `scheduledWorker`: Listens on `QUEUE_NAMES.SCHEDULED` (`scheduled-jobs-queue`), concurrency 2.

2. **Registered Scheduled Jobs (`worker.js:77-115`):**
   - `deadline-reminders` (`*/15 * * * *`): Invokes `runDeadlineRemindersJob()`, which internally forwards to `runOverdueEscalationJob()` (`overdue_escalation` rule).
   - `recurring-requests` (`5 0 * * *`): Retired FORGE stub returning `{ processed: 0, status: 'retired' }`.
   - `daily-digest` (`0 8 * * *`): Invokes `runDailyDigestJob()`, which internally forwards to `runTodoEscalationJob()` (`todo_escalation` rule).
   - `capacity-gap` (`0 7 * * 1`): Retired FORGE stub returning `{ processed: 0, status: 'retired' }`.

3. **Status of the 7 Marketing OS Automation Rules:**

| # | Automation Rule Key | Name | Defined Trigger & Cadence | Automatically Scheduled in Worker? | Evidence / Code Location |
|---|---|---|---|---|---|
| 1 | `overdue_escalation` | Overdue Deliverable Escalation | Scheduled (Hourly check; every 15m in worker) | **YES** (Via legacy alias `deadline-reminders`) | `worker.js:78`, `jobs/processors.js:41` |
| 2 | `todo_escalation` | Stale Task & Todo Escalation | Scheduled (Daily at 08:00 AM) | **YES** (Via legacy alias `daily-digest`, Redis mode only) | `worker.js:98`, `jobs/processors.js:45` |
| 3 | `blocker_dependency_alert` | Blocker Dependency Alert & SLA Monitor | Event (on create) + Scheduled (24h cadence) | **NO** (Only runs on initial event; 24h cron is NOT in worker) | Processor exists in `jobs/processors.js:19`, but NOT added to `worker.js`. |
| 4 | `revision_pattern_flag` | Revision Pattern & Quality Guard | Event-driven (evaluates on feedback submission) | **NO** (Event only; no periodic audit job in worker) | Evaluated in `feedback/service.js:269`; absent from `worker.js`. |
| 5 | `weekly_report` | Weekly Marketing Report | Cron (`0 8 * * 1` — Monday 08:00 AM) | **NO** (Can only run by hand) | Processor exists in `jobs/processors.js:24`, but NOT registered in `worker.js:77-115`. |
| 6 | `month_end_report` | Month-End Performance Scorecard | Cron (`59 23 28-31 * *` — Last day 23:59) | **NO** (Can only run by hand) | Processor exists in `jobs/processors.js:29`, but NOT registered in `worker.js:77-115`. |
| 7 | `lsq_live_sync` | LeadSquared Live Sync | Scheduled / Polling cadence | **NO** (Can only run by hand) | Processor exists in `jobs/processors.js:34`, but NOT registered in `worker.js:77-115`. |

**Verdict:** Automation rules are **PARTLY automated and PARTLY manual**. While `overdue_escalation` and `todo_escalation` run via legacy wrappers, the scheduled reports (`weekly_report`, `month_end_report`), the 24h blocker reminder cycle, and `lsq_live_sync` are **completely absent from BullMQ repeatable queue registrations and can only be triggered by hand via the UI/API**.

---

## 5. Newly Discovered Defects Not in the Fix Plan

During the read-only inspection, seven defects not documented in `ROLE_FIX_PLAN.md` were discovered:

### Defect 1: Blocker Directory Scope Leak (`apps/api/src/modules/blockers/service.js:272-290`)
- **Severity:** High (Data Confidentiality / Role Boundary Violation)
- **Current Behaviour:** `listBlockers` constructs an empty query `const query = {}` and performs `Blocker.find(query)` with NO profile or team scoping. Because `GET /api/blockers` is accessible to `team_member` via `work.request` / `work.update.own`, any team member can retrieve every active blocker, blocker reason, note, and dependency owner across all 7 brand profiles and all departments.
- **Proposed Fix:** Incorporate `resolveScope(user, filters)` into `listBlockers`. Filter work items by `scope.allowedProfileIds` and `scope.allowedPersonIds`.

### Defect 2: Data Center Lead Discrepancy Scope Leak (`apps/api/src/modules/leads/service.js:321-325`)
- **Severity:** High (Data Confidentiality / Privacy)
- **Current Behaviour:** `getDataCenterStatus` queries `Lead.find()` unconditionally without calling `resolveScope`. Team leads who only hold access to a single brand profile can inspect all lead sync discrepancies, including student names, phone numbers, email addresses, and unmapped sources for all brand profiles.
- **Proposed Fix:** Pass caller to `getDataCenterStatus`, invoke `resolveScope(user, filters)`, and constrain query to `scope.allowedProfileIds`.

### Defect 3: Revision Counter Double-Counting (`apps/api/src/modules/feedback/service.js:230` vs. `apps/api/src/modules/workItems/transition.service.js:145`)
- **Severity:** High (Workflow & Integrity)
- **Current Behaviour:** 
  1. Reviewer records "Revision Required" in `feedback/service.js:230`: `workItem.revisions = (workItem.revisions || 0) + 1;`
  2. Owner restarts rework in `transition.service.js:145` (Feedback -> In Progress): `workItem.revisions = (workItem.revisions || 0) + 1;`
  The counter increments by 2 for every single feedback rejection. As a result, a deliverable with only 2 revisions reaches `revisions = 4` and triggers false excessive revision flags and escalation alerts.
- **Proposed Fix:** Delete lines 143-146 in `transition.service.js`. Rely solely on `feedback/service.js:230` to count revision rounds.

### Defect 4: Missing Permission Guard on `/api/workload` (`apps/api/src/server.js:193`)
- **Severity:** Medium (Authorization Gap)
- **Current Behaviour:** `server.js:193` mounts `app.use('/api/workload', authenticate, assignmentController.getTeamWorkload)`. It uses `authenticate`, but completely omits `requirePermission` or `requireAnyPermission`. Any logged-in user (including team members) can fetch department capacity and workload rollups.
- **Proposed Fix:** Add `requireAnyPermission('analytics.team', 'portal.view')` to `/api/workload` in `server.js:193`.

### Defect 5: Unprotected Frontend Routes in `App.tsx` (`apps/web/src/App.tsx:125-345`)
- **Severity:** Medium (UI Integrity)
- **Current Behaviour:** `<ProtectedRoute>` supports `requiredPermission` and `allowedRoles` props, but in `App.tsx`, routes `/campaigns`, `/workload`, `/leads`, `/data-center`, `/reports`, `/people` omit these props entirely. Route guards never prevent team members from entering management routes.
- **Proposed Fix:** Provide explicit `requiredPermission` props to each `<ProtectedRoute>` wrapper in `App.tsx` (e.g. `<ProtectedRoute requiredPermission="campaign.manage">`).

### Defect 6: Non-Existent Permission Key `settings.manage` (`apps/api/src/modules/docs/routes.js:13`, `departments/routes.js:16`)
- **Severity:** Low (Architectural Consistency)
- **Current Behaviour:** `docs/routes.js` and `departments/routes.js` check `requirePermission('settings.manage')`. However, `'settings.manage'` is NOT in `PERMISSION_KEYS` in `@mmp/shared`. Admin only bypasses it because of `if (req.user.role === 'admin') return next()`.
- **Proposed Fix:** Replace `settings.manage` with canonical permission keys `reference.manage` or `user.manage`.

### Defect 7: `WorkItem` Patch Ownership Verification Missing (`apps/api/src/modules/workItems/service.js:222-260`)
- **Severity:** High (Privilege Escalation)
- **Current Behaviour:** `updateWorkItem` validates brand profile scoping, but never checks if `workItem.ownerId === user._id`. A team member holding `work.update.own` can update deliverables assigned to other team members within the same brand.
- **Proposed Fix:** If caller is `team_member`, assert `workItem.ownerId.toString() === userId` before applying updates.

---

## 6. Recommended Action Plan for Subsequent Passes

| Pass | Target Scope | Key Items to Address |
|---|---|---|
| **Pass 1: Session, Security & Scoping** | A1, A2, A3, A4, A5, A6, A7, A9, A10, Defect 1, Defect 2, Defect 4, Defect 6 | Fix `apiFetch` token refresh; reject unauthenticated sockets; fix cookie domain/SameSite; restrict Generate Now to `report.configure`; enforce read-only leads; protect campaign deletion; add scope to blockers and datacenter; add change-password route. |
| **Pass 2: Workflow Rules & Permissions** | B1, B2, B3, B4, B5, B7, B9, B10, B11, Defect 3, Defect 7 | Create `WorkRequest` model; restrict `POST /api/work` to `work.create`; enforce field-level patch rules; exclude candidates >85%; remove double revision increment; grant `people.view` to `team_lead`; register repeatable BullMQ jobs for all 7 automation rules; fix WhatsApp fallback campaign `targetId`. |
| **Pass 3: Identity, My Account & UI Navigation** | C1, C2, C3, C4, Defect 5 | Add `phone`, `avatarUrl`, `profileCompletedAt` to `Person`; implement editable `MyAccountPage` and delete `MyAccountModal`; build `/welcome` step; add 5 role cards; configure menu visibility and `<ProtectedRoute>` guards per role in `Layout.tsx` and `App.tsx`. |
| **Pass 4: Taxonomy & Content Flow Preparation** | D1, D3, D4, D5, D7, D8, E4, E5 | Clean up calendar profile styles; implement HACA-only mode; add `channel`, `expectedOutcome`, `actualEffortHrs` to `WorkItem`; add campaign links to `Lead`; add LSQ env keys; build Approver Queue and Member Request Work button. |
| **Pass 5: Content Flow (Phase 5b)** | E1, E2, E3 | Build `ContentPiece` entity, stage pipelines, Content Tracker on `/calendar`, and stage assignment matrix. |
| **Pass 6: Quality, Testing & Hygiene** | F1, F2, F3, F4, F5, F6 | Retire legacy calendar and user routes; move repository outside OneDrive; add role-based UI and Playwright tests. |
