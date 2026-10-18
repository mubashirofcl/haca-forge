# HACA Marketing OS: Master Build Plan (Phases 0 – 9)

**Date:** 18 October 2026  
**Status:** Approved Master Plan  
**Target:** Conversion of HACA FORGE to HACA Marketing OS (V1 Team Workspace)  
**Source of Truth:** [HACA-Marketing-OS-Build-Spec.pdf](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/HACA-Marketing-OS-Build-Spec.pdf) and [PROJECT_REPORT.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/PROJECT_REPORT.md)  

---

## 1. Overview & Phased Roadmap Strategy

The transition from HACA FORGE to HACA Marketing OS occurs across 10 sequential, self-contained phases. Each phase represents an isolated milestone that compiles, passes all lint and tests, and delivers working functionality before advancing to the next.

```mermaid
graph TD
    P0[Phase 0: Archive & Retire FORGE] --> P1[Phase 1: Profiles, People & Access Scoping]
    P1 --> P2[Phase 2: Monthly Targets & Campaigns]
    P2 --> P3[Phase 3: Work Items, My Work, Calendar, Todo]
    P3 --> P4[Phase 4: Auto-Assignment & Workload Engine]
    P4 --> P5[Phase 5: Feedback Loops, Revision Flags & Blockers]
    P5 --> P6[Phase 6: Global Filter Bar & Team Dashboard]
    P6 --> P7[Phase 7: Automation Rules, Reports & Notifications]
    P7 --> P8[Phase 8: LeadSquared Integration & Data Center]
    P8 --> P9[Phase 9: Performance Dimensions, Hardening & QA]
```

---

## 2. Phase-by-Phase Execution Specifications

### Phase 0: Archive FORGE and Retire Out-of-Scope Modules

* **Scope:** Clean slate preparation. Remove retired FORGE modules (API, UI, seeds, tests) while keeping infrastructure (Auth, Sockets, BullMQ, Mailer, Uploads, Glass UI, Access Requests flow, Admin Users and Access Requests pages). Set up placeholder screens.
* **Backend Changes:**
  * Delete API modules: `audit`, `comments`, `content`, `deliverables`, `leave`, `masterData`, `pipelines`, `requests`, `shoots`, `tasks`, `teamAssignments`, `teams`, `time`.
  * **KEEP the `access/` module:** Retain the public Request Access flow and admin access-request logic as an Admin-only enabler.
  * Prune `apps/api/src/server.js` route registrations and socket listeners for retired modules.
  * In `apps/api/src/modules/jobs/processors.js`: remove every worker that queries a retired model (`Task`, `ContentItem`, `Request`, `ScheduledReport`). Keep BullMQ queue setup and worker entry in `lib/queue.js` and `server.js` so Phase 7 can register new jobs.
  * In `apps/api/src/modules/notifications/service.js`: remove every domain event listener for retired events (`request.*`, `task.*`, `content.*`, `deliverable.*`). Retain `Notification` model, notification routes, and Socket.io push infrastructure.
  * In `apps/api/scripts/seed.js` and `seed-demo.js`: strip all imports and logic that touch retired models. Retain only what the remaining modules need (e.g., initial user seed). Mark `seed-demo.js` as a stub to be rebuilt in Phase 9.
  * **KEEP `scripts/seed-admin.js`:** Retain for seeding the initial admin account.
  * In `packages/shared`: remove retired permission keys, role keys, and enums ONLY if nothing that stays imports them. Rebuild shared package with `npm run build` before running typecheck or lint in `apps`. Do NOT add new Marketing OS roles yet (reserved for Phase 1).
* **Frontend Changes:**
  * Remove retired web pages from `apps/web/src/pages/` (audit log, master data, settings, teams/departments, request triage, timesheets, shoot planner, file library).
  * **KEEP Admin Users and Access Requests pages:** Keep `apps/web/src/pages/admin/AccessRequestsPage.tsx` and `apps/web/src/pages/admin/UsersPage.tsx`. They will be adapted in Phase 1.
  * In `apps/web/src/App.tsx`: update `RootRedirect` to route every role directly to `/dashboard`. Keep role keys as they are for now so existing logins keep working.
  * Mount 14 Marketing OS placeholder routes behind `ProtectedRoute` (`/dashboard`, `/my-work`, `/calendar`, `/campaigns`, `/campaigns/:id`, `/work`, `/work/:id`, `/feedback`, `/workload`, `/todo`, `/issues`, `/leads`, `/data-center`, `/reports`, plus `/people` and `/admin/access-requests`). All render a clear placeholder page (*"Built in Phase N"*).
* **Data Model Changes:** None (all collections preserved in MongoDB).
* **Database & Asset Retention:**
  * Do NOT drop or delete any collection in MongoDB (`deliverables`, `tasks`, `requests`, `shoots`, `timeentries`, etc.).
  * Cloudinary URLs stay fully recoverable in the database and in the git tag `forge-v1-final`.
* **Migrations:** None.
* **Tests:**
  * Delete retired modules' test files together with the modules (`phase2.test.js` through `phase10_e2e.test.js`, `roles_v2_scoping.test.js`, `teamAssignments.test.js`).
  * Retain and ensure passing for `status.test.js` and `permissions.test.js`.
  * Every remaining test file must pass with 0 errors.
* **Risks:** Broken imports in kept infrastructure (`server.js`, `mailer.js`, `env.js`).
* **Acceptance Criteria:** `npm run build`, `npm run lint`, and `npm test` all pass. The app starts, users can log in, and all routes render with glass layout.
* **Dependencies:** Pre-migration tag `forge-v1-final` and database backup completed.

---

### Phase 1: Reference Data, Profiles, People & Access Scoping

* **Scope:** Seed 7 Profiles, 7 Departments, and fixed reference taxonomies. Establish 4-role model (`admin`, `marketing_head`, `team_lead`, `team_member`). Establish `Person` model with `jobRole`, `profileAccess[]`, `reportsToIds[]`, and `weeklyCapacityHours`. Build `resolveScope(user, filters)`. Adapt Access Requests and Users pages.
* **Backend Changes:**
  * Implement 4 roles in `@mmp/shared`: `ROLE_KEYS = ['admin', 'marketing_head', 'team_lead', 'team_member']`.
  * `ROLE_PERMISSIONS.admin = all PERMISSION_KEYS` (dynamically derived from `PERMISSION_KEYS`, so new keys are automatically granted).
  * Permission keys:
    * `user.approve` (Admin only): approve or reject access requests.
    * `user.manage` (Admin only): create/invite users, change roles, grant admin/marketing_head, suspend, reset passwords, force logout.
    * `people.assign` (Marketing Head): edit operational fields (`departmentId`, `jobRole`, `profileAccess`, `reportsToIds`, `weeklyCapacityHours`) of `team_lead` and `team_member`.
    * `reference.manage` (Admin only).
  * Implement `Person` schema/model in `modules/people/`:
    * Fields: `name`, `email`, `passwordHash`, `role`, `jobRole` (optional for admin), `departmentId` (optional for admin), `profileAccess`, `reportsToIds`, `weeklyCapacityHours` (optional for admin), `lastProfileId`, `status`.
  * `resolveScope(user, filters)`:
    * For `admin`: returns all profiles and all people (full access).
    * For `marketing_head`: returns assigned profiles (all by default) and all people in scope.
    * For `team_lead`: returns assigned profiles and own team (direct reports + same department).
    * For `team_member`: returns assigned profiles and self only.
    * Admin is strictly excluded from auto-assignment candidate pools, workload calculations, and performance metrics.
  * Seed 7 Profiles and 7 Departments.
  * Seed script: `scripts/seed-admin.js` creates the first admin from `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` (refuses if an admin already exists). No seed-head script.
  * `ActivityEvent`: logs every user, role, and access change. Any admin work actions are recorded with `actingAs: 'admin'`.
* **Frontend Changes:**
  * Adapt existing admin user management into People Setup (`/people`) and Access Requests (`/admin/access-requests`):
    * **Admin view:** full management (create user, set role, grant admin/marketing_head, suspend, reset password, approve access requests).
    * **Marketing Head view (`/people`):** can only edit operational assignment fields (`people.assign`) for `team_lead` and `team_member`. Cannot touch admin or marketing_head accounts.
  * RootRedirect in `App.tsx`:
    * `admin`, `marketing_head`, and `team_lead` redirect to `/dashboard`.
    * `team_member` redirects to `/my-work`.
* **Data Model Changes:**
  * `Profile`: `{ name, code, active }`
  * `Department`: `{ name, code }`
  * `Person`: `{ name, email, passwordHash, role, jobRole, departmentId, profileAccess, reportsToIds, weeklyCapacityHours, lastProfileId, status }`
  * `AccessRequest`: `{ name, email, phone, department, requestedRole, reason, status, reviewedBy, reviewedAt }`
* **Migrations:**
  * Execute 10-key User to Person migration:
    * `admin` $\rightarrow$ `admin` (1 user)
    * `head`, `lead` $\rightarrow$ `marketing_head` (2 users)
    * `team_lead` $\rightarrow$ `team_lead` (4 users)
    * `worker`, `sm_manager` $\rightarrow$ `team_member` (21 users)
    * `management`, `dept_lead`, `dept_staff`, `viewer` $\rightarrow$ `suspended` (8 users, logged in migration report)
  * Support `scripts/migration-overrides.json` (`{ "email": "new_role" }`) applied after default map.
  * Convert active `TeamAssignment` records into `Person.reportsToIds[]` and archive the collection in MongoDB.
* **Tests:**
  * Admin holds all permission keys (derived test).
  * Only admin can grant `admin` or `marketing_head` roles.
  * Marketing Head cannot create or suspend users, and cannot edit admin or marketing_head accounts.
  * Admin is excluded from assignment candidate queries.
  * `resolveScope` tests for all 4 roles across profile boundaries.
* **Risks:** User lockout if admin account is not properly seeded or role permissions mapping fails.
* **Acceptance Criteria:** Admin can log in, approve access requests, and create users. Marketing Head can only edit operational fields of team members and leads. RootRedirect accurately directs roles.

---

### Phase 2: Monthly Targets & Campaigns

* **Scope:** Implement the top of the traceability chain: `MonthlyTarget` and `Campaign`. Campaigns strictly require `targetId` and `relatedOKR`.
* **Backend Changes:**
  * Implement `MonthlyTarget` model & service in `modules/targets/`: targets for revenue, leads, qualified leads, budget.
  * Implement `Campaign` model & service in `modules/campaigns/`: requires `targetId` and `relatedOKR`. Tracks status (`In Progress`, `At Risk`, `Completed`), goal type, spend actuals, and lead actuals.
  * API endpoints for target setting (Head only) and campaign management (Head & Team Leads).
* **Frontend Changes:**
  * Projects / Campaigns List page (`/campaigns`) with status badges and target links.
  * Campaign Detail page (`/campaigns/:id`) displaying campaign goals, related OKR, target progress, budget burn, and attached work items.
* **Data Model Changes:**
  * `MonthlyTarget`: `{ month, profileId, revenueTarget, leadsTarget, qualifiedLeadsTarget, budget, createdBy }`
  * `Campaign`: `{ name, profileId, targetId, relatedOKR, startDate, endDate, status, goalType, expectedOutcome, budgetAllocated, spendActual, leadsActual, ownerId }`
* **Migrations:** Seed initial targets for active profiles.
* **Tests:** Validation test enforcing rejection of campaigns without `targetId` or `relatedOKR`. Scoping tests ensuring Team Leads only see campaigns in their profiles.
* **Risks:** Missing OKR taxonomy; Head entering spend actuals manually.
* **Acceptance Criteria:** Campaign cannot be saved without selecting a valid Monthly Target and related OKR. List correctly filters by Profile.

---

### Phase 3: Work Items, My Work, Calendar & Todo

* **Scope:** The core unit of work: `WorkItem`. Implement Work Detail, My Work, Monthly Marketing Calendar, and Todo/Priorities.
* **Backend Changes:**
  * Implement `WorkItem` model & service in `modules/workItems/`: requires `campaignId`; inherits `profileId`, `relatedOKR`, and `relatedTarget`.
  * Central `transition.service.js` managing statuses: `Not Started`, `In Progress`, `Feedback`, `Pending`, `Blocked`, `Approved`, `Published`.
  * `Overdue` computed dynamically (`deadline < now` and status not `Approved`/`Published`).
  * Endpoints for `/work`, `/my-work`, `/calendar/work-items`, and `/todo`.
* **Frontend Changes:**
  * Single Work Detail page (`/work/:id`) with metadata header, status transition actions, and Cloudinary deliverable links.
  * My Work page (`/my-work`) for team members: personal queue partitioned into Today, This Week, and Later.
  * Monthly Marketing Calendar (`/calendar`) using FullCalendar, displaying work items colored by department/profile.
  * Todo & Priorities page (`/todo`).
  * Generic filtered Work list (`/work`) for universal drill-downs.
* **Data Model Changes:**
  * `WorkItem`: `{ campaignId, profileId, relatedOKR, relatedTarget, title, workType, departmentId, ownerId, deadline, estimatedEffortHrs, status, blockerReason, deliverableUrl, publishedUrl, revisions }`
  * `ActivityEvent`: `{ entityType, entityId, profileId, actorId, action, fromStatus, toStatus, metadata, timestamp }`
* **Migrations:** None (clean work items).
* **Tests:** State machine transition unit tests. Permission enforcement ensuring team members cannot transition unauthorized items. Dynamic overdue computation test.
* **Risks:** High load on calendar query with deep population.
* **Acceptance Criteria:** WorkItem created inside Campaign. Status transitions fire `ActivityEvent`. Overdue is computed dynamically without stored status.

---

### Phase 4: Auto-Assignment Engine & Team Workload

* **Scope:** Auto-assignment recommendation engine and Team Workload view. Recommend owner based on workload, revisions, and availability. Never assign silently.
* **Backend Changes:**
  * Implement auto-assignment engine in `modules/assignment/service.js`:
    1. Filter department candidates with `workloadPct < 85%` and available hours before deadline.
    2. Rank by lowest `workloadPct`, lowest `avgRevisions`, and earliest availability.
    3. Return recommendation with clear rationale string.
  * `AssignmentOverride` logging whenever Head or Team Lead changes recommended owner.
  * Team workload aggregation endpoint (`/api/workload`): healthy (<65%), high (65-85%), overloaded (>85%).
* **Frontend Changes:**
  * Team Workload screen (`/workload`) displaying member capacity bars, workload bands, open work items, and overload alerts.
  * Auto-assignment recommendation modal/banner on work item creation with override selector.
* **Data Model Changes:**
  * `AssignmentOverride`: `{ workItemId, recommendedPersonId, assignedPersonId, overriddenBy, reason, timestamp }`
* **Migrations:** Compute rolling 90-day baseline for existing persons (default `avgRevisions = 1.0`).
* **Tests:** Unit test auto-assignment ranking algorithms with varied workloads. Verify `AssignmentOverride` record creation.
* **Risks:** Division by zero if member has 0 weekly capacity hours (fallback to 40h).
* **Acceptance Criteria:** Creating work item without owner recommends candidate with reason. Overrides are recorded in database.

---

### Phase 5: Feedback Loops, Revision Flags & Blockers

* **Scope:** Structured 2-entry review threads, revision flags with root-cause classification, and blocker system with dependency-owner alerting.
* **Backend Changes:**
  * `FeedbackEntry` model: round-based, reviewer feedback (`roundStatus = Revision Required` or `Approved`) followed by owner response (`isResponse = true`).
  * `RevisionFlag` detection: automatically flag when revisions reach 4 or exceed owner's rolling average by >1.
  * Root cause classification endpoint (7 fixed causes). Escalation to Head after 48h unclassified.
  * `Blocker` model: owner marks item Blocked with 1 of 9 reasons. If waiting on content/feedback/data, mandatory `dependencyOwnerId` with immediate alert.
* **Frontend Changes:**
  * Feedback & Revision History screen (`/feedback`) with thread view and root-cause classifier modal.
  * Issues & Blockers screen (`/issues`) grouping active blockers and revision flags with inline actions (Notify / Classify).
* **Data Model Changes:**
  * `FeedbackEntry`: `{ workItemId, round, fromPersonId, roundStatus, text, isResponse, attachments }`
  * `RevisionFlag`: `{ workItemId, ownerId, revisionsCount, baselineAvg, rootCause, classifiedBy, classifiedAt, escalatedAt }`
  * `Blocker`: `{ workItemId, reason, dependencyOwnerId, notes, blockedAt, resolvedAt }`
* **Migrations:** None.
* **Tests:** Automatic trigger of `RevisionFlag` on 4th revision round. Mandatory `dependencyOwnerId` validation when blocker reason requires it.
* **Risks:** Notification loops on repeated blocker toggling.
* **Acceptance Criteria:** WorkItem marked Blocked alerts dependency owner. Flagged revision requires root cause classification.

---

### Phase 6: Global Filter Bar & Team Dashboard

* **Scope:** Universal URL-synced global filter context and the 9-section Team Dashboard.
* **Backend Changes:**
  * Dashboard aggregation service (`modules/dashboard/service.js`) compiling all 9 sections under `resolveScope(user, filters)`.
  * Section-specific aggregations: Targets strip, KPI strip, Today's Priorities, Creative Production stats, Campaign Progress, Team Workload, Lead Funnel snapshot, Issues & Blockers, Recent Activity.
* **Frontend Changes:**
  * Global Filter context (`Profile`, `Department`, `Owner`, `Campaign`, `Date/Month`, `Status`) synchronized to URL query parameters.
  * Universal breadcrumb / navigation chain: every KPI number, person, and campaign links directly to its underlying record or filtered list.
  * Team Dashboard screen (`/dashboard`) implementing all 9 sections with frosted glass styling and live card counters.
* **Data Model Changes:** Compound indexes on `profileId + departmentId + status + deadline`.
* **Migrations:** None.
* **Tests:** Verification that changing Profile filter updates all 9 dashboard widgets in a single state change. Drill-down link destination tests.
* **Risks:** Heavy aggregation query latency on dashboard load; mitigate with Lean projections and compound indexes.
* **Acceptance Criteria:** Changing Profile dropdown updates every dashboard card simultaneously. Clicking any metric opens the exact filtered list.

---

### Phase 7: Automation Rules, Reports & Notifications

* **Scope:** 7 core Automation Rules and 6 scheduled Report Definitions.
* **Backend Changes:**
  * `AutomationRule` model and execution runner in `modules/automation/`:
    1. `month_end_report` (Last day 23:59)
    2. `overdue_escalation` (Owner immediate, Team Lead after 4h)
    3. `todo_escalation` (No status change for N days)
    4. `blocker_dependency_alert` (Instant ping)
    5. `revision_pattern_flag` (Auto-flagging)
    6. `lsq_live_sync` (Inbound sync runner)
    7. `weekly_report` (Monday 08:00)
  * `ReportDefinition` model and generation service for the 6 reports: Weekly Marketing Report, Monthly Performance Scorecard, Creative Production Report, Lead Funnel & CPL Report, Team Performance Digest, Campaign Deep-Dive.
  * HTML email generation and in-app report viewer.
* **Frontend Changes:**
  * Reports & Automation screen (`/reports`) with rule pause/resume toggles, last-run logs, and "Generate Now" on-demand exports.
* **Data Model Changes:**
  * `AutomationRule`: `{ ruleKey, name, trigger, action, active, lastRunAt, config }`
  * `ReportDefinition`: `{ name, cadence, recipients, scope, lastGeneratedAt, templateConfig }`
* **Migrations:** Seed standard 7 rules and 6 report definitions.
* **Tests:** Idempotency tests ensuring BullMQ job restarts do not emit duplicate notifications. Scheduled report email dispatch mock tests.
* **Risks:** Rate limits or failures in mailer transport.
* **Acceptance Criteria:** Reports can be generated manually via "Generate Now" or on schedule. Overdue items trigger escalation notifications.

---

### Phase 8: LeadSquared (LSQ) Integration & Data Center

* **Scope:** Read-authoritative LSQ sync, inbound-lead-to-task creation, CPL/CPQL calculation, Lead Funnel screen, and Data Center hygiene console.
* **Backend Changes:**
  * LSQ API adapter (`modules/leads/lsqAdapter.js`) with fixture fallback and idempotency on `lsqLeadId`.
  * Lead sync worker reading stages (12 funnel stages) and lead sources (19 sources).
  * Auto-task creation: WhatsApp Inbound leads automatically spawn a WorkItem assigned to WhatsApp Marketer.
  * Calculated metrics: $CPL = \frac{\text{Spend}}{\text{Ad Leads}}$, $CPQL = \frac{\text{Spend}}{\text{Qualified Leads}}$, $\text{Qualified \%} = \frac{\text{Qualified}}{\text{Total}}$.
  * Data hygiene service flagging unassigned leads, invalid stages, or missing profiles.
* **Frontend Changes:**
  * Lead Funnel screen (`/leads`) showing 12-stage visual pipeline, conversion rates, and source breakdown.
  * Data Center screen (`/data-center`) showing sync health, orphan leads, and unmapped sources (Head can resolve/re-assign).
* **Data Model Changes:**
  * `Lead`: `{ lsqLeadId, profileId, leadSource, stage, score, ownerEmail, syncStatus, rawData, createdAt }`
* **Migrations:** Seed demo lead dataset for offline testing.
* **Tests:** Verification that no route permits updating a lead's status (read-only constraint). Task auto-creation on WhatsApp Inbound leads. CPL/CPQL math unit tests.
* **Risks:** LSQ API downtime, missing webhook, or schema variations.
* **Acceptance Criteria:** LSQ leads sync idempotently. Inbound WhatsApp lead creates WorkItem. Lead Funnel renders metrics accurately.

---

### Phase 9: Performance Dimensions, Hardening & QA

* **Scope:** 5 performance dimensions (Output, Efficiency, Quality, Collaboration, Business Impact). Complete end-to-end verification, performance profiling, responsive glass UI review, and final production build.
* **Backend Changes:**
  * Performance dimension calculation service in `modules/people/metrics.js`.
  * Production index optimizations and MongoDB query profiling.
  * Strict security headers, rate limiting verification, and sanitized logs.
* **Frontend Changes:**
  * Mobile responsiveness audit (360px layout validation).
  * Glassmorphism UI consistency check across all 14 screens.
  * Accessible keyboard navigation and empty states review.
* **Data Model Changes:** Production indexing on all collections.
* **Migrations:** Final reference data check and validation.
* **Tests:** Comprehensive end-to-end test suite (`phase9_mos_e2e.test.js`) testing complete workflow from Target $\rightarrow$ Campaign $\rightarrow$ WorkItem $\rightarrow$ Feedback $\rightarrow$ Report.
* **Risks:** Performance lag on complex aggregations; CSS blur rendering lag on mobile devices.
* **Acceptance Criteria:** All 14 screens fully functional. Full test suite passing with 0 lint errors. Lighthouse performance & accessibility score > 90.

---

## 3. Data Migration & Archival Plan

### 3.1 What to Migrate (Transform in Place)

1. **`User` $\rightarrow$ `Person` Comprehensive 10-Key Role Map:**
   The database currently holds 36 users across legacy and Roles v2 keys. The Phase 1 migration script maps every key that can exist in the database:
   * **`admin`, `lead`, `head` $\rightarrow$ `marketing_head`:**
     * Granted org-wide access by default (`profileAccess = [all 7 profiles]`).
     * `status: 'active'`.
   * **`team_lead` $\rightarrow$ `team_lead`:**
     * Retains assigned department and profile access.
     * `status: 'active'`.
   * **`worker`, `sm_manager` $\rightarrow$ `team_member`:**
     * `worker` maps to `team_member` with appropriate creative `jobRole`.
     * `sm_manager` maps to `team_member` with `jobRole: 'Social Media Manager'`.
     * `status: 'active'`.
   * **`management`, `dept_lead`, `dept_staff`, `viewer` $\rightarrow$ `suspended`:**
     * Roles outside the Marketing OS specification are deactivated (`status: 'suspended'`).
     * All suspended accounts are explicitly logged in the migration report output.
     * `management` and `viewer` emails are flagged for inclusion in executive email report distribution lists.
   * **Baseline Attributes:**
     * `weeklyCapacityHours`: set to 40 by default.
     * `profileAccess`: defaults to all 7 profiles until customized by the Marketing Head in `/people`.
     * `lastProfileId`: initialized to the primary `HACA` profile.

2. **`TeamAssignment` Conversion to `Person.reportsToIds[]`:**
   * In HACA FORGE / Roles v2, `TeamAssignment` records stored worker-to-team-lead relationships (`workerId`, `teamLeadId`, `active`).
   * **Migration Logic:** For each `User`, query `TeamAssignment.find({ workerId: user._id, active: true })`.
   * Extract all active `teamLeadId` values and assign them to `Person.reportsToIds = activeTeamAssignments.map(ta => ta.teamLeadId)`.
   * **Collection Retention:** The `teamassignments` collection is **archived in MongoDB** (do NOT drop the collection) to preserve assignment history.

3. **`Department`:**
   * Map existing dynamic departments to the 7 fixed operational departments (`Design`, `Video Production`, `Social Media`, `SEO & Content`, `WhatsApp`, `Performance Marketing`, `Tech`).

### 3.2 What to Archive (Retain in MongoDB, Disconnect from Application)

The following collections are retained in MongoDB for historical records but completely disconnected from API routes, models, and UI:
* `requests` and `counters` (Intake forms retired)
* `contentitems` and `tasks` (Multi-stage pipelines retired)
* `deliverables` (Proofing studio retired)
* `shoots` (Shoot planner retired)
* `timeentries` (Timesheets retired)
* `leaverequests` (Attendance retired)
* `accessrequests` (Self-registration retired)
* `auditlogs` (Old audit screens retired)
* `pipelinetemplates` (Automated derivation retired)
* `scheduledreports` (Old 6 reports retired)
* `teamassignments` (Migrated into `reportsToIds`, retained for audit)

All active operations begin cleanly on `Campaigns`, `WorkItems`, `FeedbackEntries`, `RevisionFlags`, `Blockers`, `Leads`, `AutomationRules`, and `ReportDefinitions`.
