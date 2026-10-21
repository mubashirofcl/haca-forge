# HACA Marketing OS — Conversion Progress

## Phase 0: Retire and Archive (Status: COMPLETE)

### 1. Executive Summary
Phase 0 successfully stripped the legacy FORGE request-and-pipeline ticketing modules, legacy testing suites, and obsolete UI views while preserving all core platform infrastructure, authentication, socket communications, notifications, background worker foundations, and the critical **Access Requests** enabler (both public request flow and admin review). A unified, modern glassmorphic `PlaceholderPage` shell now serves all 14 Marketing OS destinations, and navigation has been updated to reflect the full Marketing OS information architecture.

**Crucially, zero MongoDB collections were dropped or altered.** All 24 collections remain intact for the non-destructive data migration in Phase 1.

---

### 2. What Was Removed (Retirements)

#### Backend Modules (`apps/api/src/modules/`)
The following 14 retired FORGE modules were completely deleted:
1. `audit/` — Legacy FORGE audit log collection and endpoints.
2. `comments/` — Request-level comment thread endpoints.
3. `content/` — Legacy FORGE content deliverables/posts.
4. `deliverables/` — Legacy deliverable files, versions, and upload tracking.
5. `leave/` — Legacy leave and absence tracking.
6. `masterData/` — Legacy custom field definitions, request forms, and master data.
7. `pipelines/` — Legacy pipeline stages, steps, and transitions.
8. `requests/` — Legacy FORGE request tickets, counters, and duplicate checking.
9. `shoots/` — Legacy shoot planning and call sheets.
10. `statusHistory/` — Legacy request state transition audit trails.
11. `tasks/` — Legacy task assignments and subtasks.
12. `teamAssignments/` — FORGE legacy assignment join collection.
13. `teams/` — Legacy FORGE teams model and controller.
14. `time/` — Legacy timesheet entries and tracking.
15. `apps/api/src/lib/teamAccess.js` — Legacy team-scoping helper.
16. `scripts/migrate-roles-v2.js` — Outdated migration script.

#### Backend Test Suites (`apps/api/test/`)
Deleted 12 retired test suites asserting FORGE ticketing behavior:
- `phase2.test.js` through `phase10_e2e.test.js`
- `roles_v2_scoping.test.js`
- `teamAssignments.test.js`
- `migration.test.js`

*Retained active test suites:* `apps/api/test/permissions.test.js` (8 tests) and `apps/api/test/status.test.js` (1 test).

#### Frontend Pages & Components (`apps/web/src/`)
Deleted all retired FORGE views and components:
- `pages/admin/` — Deleted `AdminDashboard.tsx`, `AuditLogPage.tsx`, `MasterDataPage.tsx`, `SettingsPage.tsx`, `TeamsDepartmentsPage.tsx`.
- `pages/calendar/` — Deleted legacy calendar views and clash modals (`BulkImportModal.tsx`, `CalendarEntryDrawer.tsx`, `CalendarPage.tsx`, `CapacityWidget.tsx`, `PublishModal.tsx`, `SmDashboard.tsx`).
- `pages/lead/` — Deleted `ContentHubPage.tsx`, `LeadDashboard.tsx`, `LeadReviewQueuePage.tsx`.
- `pages/worker/` — Deleted `WorkerDashboard.tsx`.
- `pages/requester/` — Deleted `RequesterDashboard.tsx`.
- `pages/shoots/` — Deleted `ShootPlannerPage.tsx`.
- `pages/time/` — Deleted `TimesheetsPage.tsx`.
- `pages/performance/` — Deleted `PerformanceDashboard.tsx`.
- `pages/library/` — Deleted `FileLibraryPage.tsx`.
- `pages/team/` — Deleted `TeamManagementPage.tsx`.
- `pages/reports/` — Deleted `ReportsPage.tsx`.
- `components/` — Deleted `CasesOverview.tsx`, `DynamicFormRenderer.tsx`, `NewCaseModal.tsx`, `deliverables/WorkerUploadModal.tsx`.

---

### 3. What Was Preserved & Cleaned

#### Backend Infrastructure (Kept & Operational)
- **Authentication & Sessions (`apps/api/src/modules/auth/`):** Full JWT authentication, refresh tokens, password resets, set-password tokens.
- **Access Requests (`apps/api/src/modules/access/`):** Preserved public `/api/v1/access/request` endpoint, invite generation, and admin review (`/api/v1/access/requests`, approve, reject). Removed `AuditLog` side-effects.
- **Users Baseline (`apps/api/src/modules/users/`):** Preserved user listing, creation, and profile retrieval for admin/auth. Removed `AuditLog` and `TeamAssignment` deactivation side-effects.
- **Departments (`apps/api/src/modules/departments/`):** Preserved department listing, creation, and lookups.
- **Notifications (`apps/api/src/modules/notifications/`):** Preserved in-app notifications and Socket.io broadcasts. Removed retired domain event subscribers.
- **Background Jobs (`apps/api/src/modules/jobs/`):** Preserved BullMQ queue infrastructure and Redis connections ready for Phase 7 integrations. Cleaned out retired FORGE worker jobs.
- **Calendar Infrastructure (`apps/api/src/modules/calendar/`):** Kept baseline model, controller, and routes; stripped legacy clash detection and bulk CSV imports.
- **Reporting Infrastructure (`apps/api/src/modules/reports/`):** Kept baseline report service and health routes; stripped retired collection lookups.
- **Common Utilities (`apps/api/src/lib/`, `common/`):** Sockets (`lib/socket.js`), Mailer (`lib/mailer.js`), Storage/Uploads (`lib/storage.js`), Pino logging, API error handling.
- **Server Entry (`apps/api/src/server.js`):** Unmounted all 14 retired route handlers and cleaned Socket.io listener registrations.
- **Database Seeders (`apps/api/scripts/seed.js`):** Cleaned seeder to bootstrap baseline system admin and 7 departments cleanly.

#### Frontend Application (Kept & Modernized)
- **Authentication Flow:** `LoginPage.tsx`, `SetPasswordPage.tsx`, `UnauthorizedPage.tsx`.
- **Notifications View:** `NotificationsPage.tsx`.
- **Admin Users & Access Control:**
  - `AccessRequestsPage.tsx` — Maintained for reviewing, approving, and rejecting inbound access requests.
  - `UsersPage.tsx` — Maintained with resilient team-fetch fallback, ready to adapt into the Phase 1 People Directory & Person Manager.
- **Placeholder Shell (`apps/web/src/pages/PlaceholderPage.tsx`):**
  - Rich glassmorphic card design adhering to modern web design standards.
  - Displays screen title, subtitle, phase badge, target route, and detailed planned capabilities.
  - Quick action buttons to return to `/dashboard`, `/work`, or `/people`.
- **Navigation & Routing (`apps/web/src/App.tsx`, `apps/web/src/components/Layout.tsx`):**
  - `RootRedirect`: All authenticated roles now redirect to `/dashboard`.
  - Mounted all 14 Marketing OS screens:
    1. `/dashboard` — Marketing OS Dashboard (Phase 8)
    2. `/work/campaigns` — Campaigns Hub (Phase 4)
    3. `/work/shoots` — Shoots Planner (Phase 5)
    4. `/work/creative` — Creative Production Board (Phase 3)
    5. `/work/calendar` — Content Calendar (Phase 3)
    6. `/work/approvals` — Reviews & Approvals (Phase 6)
    7. `/work/requests` — Creative Requests (Phase 6)
    8. `/work/brand-library` — Brand Library (Phase 7)
    9. `/reports/pipeline` — Production Pipeline (Phase 8)
    10. `/reports/team-bandwidth` — Team Bandwidth (Phase 8)
    11. `/reports/turnaround` — Turnaround Times (Phase 8)
    12. `/reports/executive` — Executive Summary (Phase 8)
    13. `/people` — People & Capacity (Phase 1)
    14. `/settings` — Settings & Reference Data (Phase 1)
  - Admin access routes maintained: `/admin/users` and `/admin/access-requests`.
  - Top navigation bar, category dropdowns ("Production & Work", "Intelligence & Reports", "Organization"), left quick-launch rail, and mobile drawer updated.

---

### 4. Build & Test Verification

| Component | Target Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build (ESM, CJS, DTS) |
| `@mmp/api` | `vitest run` | **PASSED** | 9/9 tests pass (status + permissions) in ~26s |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean build (0 TypeScript errors) in ~24s |
| `@mmp/web` | `vitest run` | **PASSED** | Smoke tests pass in ~50s |
| Monorepo Root | `npm test` | **PASSED** | All workspace tests exit with code 0 |

---

### 5. Manual Verification Checklist
1. **Server Boot:**
   - Run `npm run dev` or launch `apps/api` and `apps/web`.
   - Ensure `apps/api` starts without missing module errors.
2. **Authentication & Root Redirect:**
   - Log in at `/login` with an existing user.
   - Verify redirection routes to `/dashboard`.
   - Verify `PlaceholderPage` renders for `/dashboard` with glassmorphic styling and Phase 8 milestone tag.
3. **Navigation Testing:**
   - Click "Creative Production", "Content Calendar", "Campaigns Hub", "Shoots Planner", "Brand Library", and "Reviews & Approvals" from the top navigation dropdowns.
   - Confirm each opens its designated placeholder screen with planned capabilities.
   - Click "People & Capacity" and "Settings" to verify Phase 1 placeholders.
   - Click "Intelligence & Reports" links to verify Phase 8 placeholders.
4. **Access Requests & User Management:**
   - Navigate to `/admin/access-requests` to ensure inbound requests table renders.
   - Navigate to `/admin/users` to verify user listing loads without crashing.

---

### 6. Phase 1 Readiness
Phase 0 successfully closed and verified.

---

## Phase 1: Profiles, People & Access Scoping (Status: COMPLETE)

### 1. Executive Summary
Phase 1 established the foundation for the HACA Marketing OS 4-role model (`admin`, `marketing_head`, `team_lead`, `team_member`), query-level scoping through `resolveScope(user, filters)`, 7 fixed brand profiles, 7 operational departments, and 13 fixed creative job roles. The `Person` schema now replaces the legacy User abstraction, supporting operational assignments (`jobRole`, `profileAccess[]`, `reportsToIds[]`, `weeklyCapacityHours`) and auditing actions through `ActivityEvent`. The frontend `/people` view has been completely overhauled into a frosted glassmorphic People & Capacity setup interface supporting role-restricted operational editing.

---

### 2. What Was Built & Changed

#### Shared Package (`@mmp/shared`)
- **4 Canonical Roles**: `ROLE_KEYS = ['admin', 'marketing_head', 'team_lead', 'team_member']`.
- **20 Permission Keys**: Defined exact matrix from Spec Section 13.1. `admin` holds all permissions dynamically derived from `PERMISSION_KEYS`.
- **Fixed Reference Taxonomies**:
  - 7 Profiles: `HACA`, `HACA Mideast`, `HACA Marketing School`, `HACA Marketing School EN`, `HACA Design School`, `HACA Design School EN`, `HACA Tech School`.
  - 7 Departments: `Design`, `Video Production`, `Social Media`, `SEO & Content`, `WhatsApp`, `Performance Marketing`, `Tech`.
  - 13 Job Roles: `SEO Specialist`, `Social Specialist`, `UI Designer`, `Writer`, `Developer`, `Social Media Manager`, `Designer`, `Video Editor`, `Creative Manager (TL)`, `Design Lead (TL)`, `YouTube Strategist`, `WhatsApp Marketer`, `Performance Marketer`.
  - 14 Work Types, 5 Design School Programs, 9 Blocker Reasons, 7 Revision Root Causes, 19 Lead Sources, 12 Funnel Stages.
  - Workload band definitions: Healthy (<65%), High (65-85%), Overloaded (>85%).
- **Zod Schemas**: Schemas for Person creation, operational updates, admin updates, and reference data.

#### Backend Modules & Infrastructure (`apps/api/`)
- **`Person` Model (`modules/people/model.js`)**:
  - Implements `name`, `email`, `role`, `jobRole`, `departmentId`, `profileAccess[]`, `reportsToIds[]`, `weeklyCapacityHours`, `lastProfileId`, `status`.
  - Bound to existing MongoDB collection `users` to transform data in-place without dropping or breaking existing references.
- **`Profile` Model (`modules/referenceData/profile.model.js`)**:
  - Mongoose schema for the 7 brand profiles (`name`, `code`, `active`).
- **`Department` Model (`modules/departments/model.js`)**:
  - Updated to enforce unique `code`, `name`, and reference to `Person` for department lead.
- **`ActivityEvent` Model & Service (`modules/activity/`)**:
  - Records domain activity across people, assignments, and work items. Automatically tags admin work actions with `actingAs: 'admin'`.
- **Row-Level Scoping Engine (`src/lib/scope.js`)**:
  - `resolveScope(user, filters)` implements query-level security:
    - `admin`: All profiles, everyone in scope (full access). Excluded from candidate assignment pools and workload metrics.
    - `marketing_head`: Assigned profiles (all by default), all people in scope.
    - `team_lead`: Assigned profiles, own team only (direct reports + same department + self).
    - `team_member`: Assigned profiles, self only.
    - Out-of-scope profile or member requests return empty/unauthorized query filters.
- **People Service & Routes (`modules/people/`)**:
  - `GET /api/people`: Scoped list of team members.
  - `GET /api/people/assignment-candidates`: Filtered candidates for assignment (excluding admin).
  - `POST /api/people`: Admin-only user creation (`user.manage`).
  - `PATCH /api/people/:id`: Accessible by Admin (`user.manage`) and Marketing Head (`people.assign`). Marketing Head is restricted to operational fields (`departmentId`, `jobRole`, `profileAccess`, `reportsToIds`, `weeklyCapacityHours`) of `team_lead` and `team_member` only, and cannot touch admin or head accounts.
  - `POST /api/people/:id/suspend` & `reactivate`: Admin-only account suspension.
- **Reference Data Routes (`modules/referenceData/`)**:
  - `GET /api/reference-data`: Returns profiles, departments, job roles, programs, work types, and taxonomies.

#### Database Migrations & Seeders
- **`scripts/seed.js` & `seed-reference.js`**:
  - Idempotently bootstraps the 7 Profiles and 7 Departments, and verifies initial Administrator.
- **`scripts/migrate-user-to-person.js`**:
  - 10-key User to Person transformation:
    - `admin` $\rightarrow$ `admin`
    - `head`, `lead` $\rightarrow$ `marketing_head`
    - `team_lead` $\rightarrow$ `team_lead`
    - `worker`, `sm_manager` $\rightarrow$ `team_member`
    - `management`, `dept_lead`, `dept_staff`, `viewer` $\rightarrow$ `suspended` (logged in report)
  - Reads active `TeamAssignment` records from MongoDB and converts into `Person.reportsToIds[]` while preserving the collection.
  - Supports `scripts/migration-overrides.json` for manual email-level role overrides.

#### Frontend Application (`apps/web/`)
- **People & Capacity Setup (`pages/admin/UsersPage.tsx` mounted at `/people`)**:
  - Frosted glass cards displaying person avatar, role badges, job roles, departments, capacity hours, and profile tags.
  - Role-specific UI permissions: Admin sees full management (Add User, role change, suspend, password reset). Marketing Head sees operational field editor for leads and members only; admin/head cards are marked as Protected.
  - Filter bar supporting text search, role filter, department filter, and status filter.
- **RootRedirect (`App.tsx`)**:
  - `admin`, `marketing_head`, and `team_lead` redirect to `/dashboard`.
  - `team_member` redirects to `/my-work`.
- **Access Requests (`AccessRequestsPage.tsx`)**:
  - Updated to 4-role selection on approval.
- **Login (`LoginPage.tsx`)**:
  - Updated to 4-role selection and role-based redirect.

---

### 3. Build & Test Verification

| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build (ESM, CJS, DTS) |
| `@mmp/api` | `vitest run` | **PASSED** | **23/23 tests pass** across 3 test suites (`phase1_scoping`, `permissions`, `status`) in ~8s |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle (0 TypeScript errors) in ~7s |
| `@mmp/web` | `vitest run` | **PASSED** | Smoke tests pass |
| Monorepo Root | `npm test` | **PASSED** | All workspace tests exit with code 0 |
| Monorepo Root | `npm run build` | **PASSED** | All workspace builds exit with code 0 |

---

### 4. Phase 1b: Request Access Fix & Database Reset (Status: COMPLETE)

#### Part A: Request Access Flow & Permissions
- **Public Form (`apps/web/src/pages/LoginPage.tsx`)**:
  - Rebuilt the Request Access modal with HACA Marketing OS glassmorphism.
  - Subtitle: *"Submit your details for Administrator review."*
  - Required fields validated with shared Zod schema (`requestAccessSchema`):
    - Full name, Work email, Phone.
    - Department: dropdown of 7 fixed departments (`DEPARTMENTS`).
    - Job role: dropdown of 13 job roles (`JOB_ROLES`).
    - Requested role: strictly `Team Member` and `Team Lead` with helper text: *"Your administrator confirms your final role."*
    - Brands you work on: multi-select pills for all 7 brand profiles (`PROFILES`).
    - Reason for access (min 10 characters).
  - Completely removed legacy FORGE `skills` field and all references to `requester` / `department staff`.
  - Responsive at 360px viewport.
  - Clear field error indicators, submitting spinner/disabled state, duplicate pending error handling, and success feedback.
- **Access Request Model & Backend Service (`apps/api/src/modules/access/`)**:
  - Replaced legacy skills with `jobRole`, `departmentId`, `requestedProfileCodes`, and `requestedProfileIds`.
  - Server-side guard: strictly blocks requests for `admin` or `marketing_head` with HTTP 400.
  - Duplicate email guards: returns HTTP 409 for existing active accounts or already pending requests.
  - Dispatches email notification to all active administrators.
  - Records domain `ActivityEvent`.
- **Admin Review (`apps/web/src/pages/admin/AccessRequestsPage.tsx`)**:
  - Restricted to `user.approve` (Admin only; non-admins / Marketing Head receive HTTP 403).
  - Filter bar supporting Status, Department, Brand, and search.
  - Card view displays all candidate-submitted fields including requested brands.
  - Approval dialog: selects final role (Admin only can grant Admin/Marketing Head), job role, department, brand profile access (pre-filled), supervisor reports-to selector (Team Leads only), and weekly capacity (default 40h).
  - Generates 32-byte crypto token hashed with SHA-256 with 48h expiration.
  - Sends set-password invite link via `lib/mailer.js`.
  - Support for rejection with reason and clarification requests with question.
  - Records domain `ActivityEvent` for every admin action.
- **Mailer Templates (`apps/api/src/lib/mailer.js`)**:
  - Updated `invite`, `accessRequestSubmitted`, `requestRejected`, and `infoNeeded` templates with HACA Marketing OS branding and wording.

#### Part B: Database Reset Plan & Script (`docs/DB_RESET_PLAN.md` & `scripts/reset-data-marketing-os.js`)
- **Inventory & Plan (`docs/DB_RESET_PLAN.md`)**:
  - Discovered 28 collections in MongoDB via `listCollections()` with exact document counts.
  - Formulated lifecycle actions: `profiles`, `departments`, and `activityevents` are **KEEP**; `users` is **RESET-USERS**; retired FORGE collections are **EMPTY**.
- **Automated Reset Script (`scripts/reset-data-marketing-os.js`)**:
  - Dry run by default (changes nothing).
  - Refuses when `NODE_ENV === 'production'`.
  - Destructive path requires `--confirm`, `--db-name=<connected_db>`, `--keep-emails=<list>`, and `DEMO_SEED_PASSWORD`.
  - Pre-deletion safety export: exports every affected collection to `./backup-db-reset-<timestamp>/<collection>.json` and verifies non-empty files before any deletion begins.
  - Empties retired collections, resets counters, keeps only specified admin/head accounts, calls Phase 1 reference seed and demo seed.
  - Includes `--rollback-info` with `mongoimport` recovery commands.
  - **The automated agent ran ONLY dry-run mode and tests; destructive execution is left for the user.**

#### Part C: Demo Users Seed (`scripts/seed-demo-users.js`)
- Seeds 9 demo accounts with domain `@demo.haca.local` with passwords sourced from `DEMO_SEED_PASSWORD`:
  - `Demo Marketing Head` (`marketing_head`, all 7 brands, no dept, no reports-to)
  - `Demo Design Lead` (`team_lead`, Design Lead (TL), Design dept, Design School & Design School EN)
  - `Demo Creative Manager` (`team_lead`, Creative Manager (TL), Video Production dept, HACA & HACA Design School)
  - `Demo UI Designer` (`team_member`, UI Designer, Design dept, reports to BOTH Design Lead AND Creative Manager)
  - `Demo Designer` (`team_member`, Designer, Design dept, reports to Design Lead)
  - `Demo Video Editor` (`team_member`, Video Editor, Video Production dept, reports to Creative Manager)
  - `Demo Writer` (`team_member`, Writer, SEO & Content dept, reports to Creative Manager)
  - `Demo WhatsApp Marketer` (`team_member`, WhatsApp Marketer, WhatsApp dept, reports to Creative Manager)
  - `Demo Performance Marketer` (`team_member`, Performance Marketer, Performance Marketing dept, reports to Creative Manager)
- Adds 2 sample pending AccessRequests (one team_member, one team_lead).
- Supports `--remove-demo` to clean up demo accounts. Idempotent across repeated executions.

---

### 5. Build & Test Verification

| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build (ESM, CJS, DTS) |
| `@mmp/api` | `vitest run` | **PASSED** | **48/48 tests pass** across 6 test suites (`request_access_schema`, `access_service_and_api`, `reset_and_demo_seed`, `phase1_scoping`, `permissions`, `status`) in ~10s |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle (0 TypeScript errors) in ~10s |
| Dry Run | `node scripts/reset-data-marketing-os.js` | **PASSED** | Correct 28-collection inventory & user analysis with zero changes |

---

---

## Phase 2: Monthly Targets & Campaigns (Completed & Verified)

### 1. Goals & Invariants Delivered
- **Enforced Traceability Chain:** Top of the traceability hierarchy (`MonthlyTarget` $\rightarrow$ `Campaign` $\rightarrow$ `WorkItem`). Zero orphan marketing initiatives permitted.
- **Strict Validation:** A `Campaign` strictly requires both `targetId` (valid FK to `MonthlyTarget`) and `relatedOKR` (non-empty string). Rejection with HTTP 400 (`TARGET_REQUIRED` / `OKR_REQUIRED`) if either is omitted or invalid.
- **Profile Scoping (`resolveScope`):** Team Leads can only create, update, or view campaigns within their permitted brand profiles. Head and Admin possess global access.
- **Target Aggregations & Protection:** `listMonthlyTargets` dynamically rolls up `spendActual`, `leadsActual`, and `budgetAllocated` from linked campaigns. Deletion of a target is protected if campaigns are linked to it.
- **Audit Logging:** Every campaign creation, status transition, budget update, and deletion is recorded as an immutable `ActivityEvent`.

### 2. Frontend Screens Delivered
- **Screen 5: Projects / Campaigns (`/campaigns` - `CampaignsListPage.tsx`)**:
  - Live KPI summary strips (Active Campaigns, Budget Allocated, Spend, Leads Delivered, Over-Budget alerts).
  - Multi-dimensional filters (Profile pill bar, Status dropdown, Goal Type filter, search bar).
  - Campaign card grid with burn pace bar, goal progress bar, status pill, and linked target month tag.
  - "New Campaign" modal enforcing MonthlyTarget linkage and Related OKR.
  - "Monthly Targets" modal for Head/Admin to view and configure monthly targets.
- **Screen 6: Project Detail (`/campaigns/:id` - `CampaignDetailPage.tsx`)**:
  - Strategic Alignment banner showcasing the Related OKR and timeline cadence.
  - Linked Target Anchor card showing month goal, revenue target, and budget.
  - Financial Health card with budget vs spend, burn pace progress, and remaining balance.
  - Outcome Metrics card showing goal type, actuals delivered, qualified leads, and cost per lead.
  - 4 Deep-dive Tabs:
    1. *Overview & Strategy*: Brief, cadence, owner details, and 3-Node Traceability Flow diagram.
    2. *Work Items*: Department deliverables preview and Phase 3 Work Item engine bridge.
    3. *Lead Funnel*: Attribution metrics and channel breakdown (Meta Ads, WhatsApp, Organic).
    4. *Audit Trail*: Real-time ActivityEvent stream for the campaign.
  - Full Edit Campaign modal for updating parameters, metrics, and progress.

### 3. Backend & Shared Schema Delivered
- **`@mmp/shared`**:
  - Added schemas: `monthlyTargetSchema`, `monthlyTargetUpdateSchema`, `campaignSchema`, `campaignUpdateSchema`.
  - Added taxonomies: `CAMPAIGN_STATUSES`, `GOAL_TYPES`, `EXPECTED_OUTCOMES`.
- **`apps/api` Modules**:
  - `src/modules/targets/`: `model.js`, `service.js`, `controller.js`, `routes.js`, `seed.js`. Mounted at `/api/targets`.
  - `src/modules/campaigns/`: `model.js`, `service.js`, `controller.js`, `routes.js`. Mounted at `/api/campaigns`. Includes `GET /api/campaigns/:id/activity`.

### 4. Build & Test Verification
| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build (ESM, CJS, DTS) |
| `@mmp/api` | `npx vitest run test/targets_and_campaigns.test.js` | **PASSED** | **17/17 tests pass** verifying strict traceability, invariants, profile scoping, and aggregations |
| `@mmp/api` | `npm test` | **PASSED** | **65/65 tests pass** across all 7 test suites |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle with code split chunks for Screen 5 & Screen 6 |

---

## Phase 3: Work Items, My Work, Calendar & Todo (Completed & Verified)

### 1. Goals & Invariants Delivered
- **Enforced Execution Traceability Hierarchy:**
  - `WorkItem` is the central execution unit in Marketing OS.
  - **Strict Campaign Linkage:** A `WorkItem` strictly requires `campaignId` pointing to an existing, valid `Campaign`. Orphan deliverables are rejected at API/schema boundaries with HTTP 400 (`CAMPAIGN_REQUIRED`).
  - **Automatic Inheritance:** Inherits `profileId`, `relatedOKR`, and `relatedTarget` directly from the parent campaign's metadata and target anchor.
- **7-Status Central State Machine (`transition.service.js`):**
  - Canonical states: `Not Started` $\rightarrow$ `In Progress` $\rightarrow$ `Feedback` $\rightarrow$ `Pending` $\rightarrow$ `Blocked` $\rightarrow$ `Approved` $\rightarrow$ `Published`.
  - Transitions are restricted exclusively to `ALLOWED_TRANSITIONS` graph.
  - **Blocker Guard:** Transition to `Blocked` strictly requires a valid canonical `blockerReason` (from the 9 canonical reasons: *Waiting for feedback, Waiting for content, Waiting for data, Technical issue, Dependency, Client/business approval, Third-party tool outage, Asset missing, Creative direction change*).
  - **Approval Authorization Guard:** `team_member` cannot self-approve without lead or admin authorization.
  - **Ownership Guard:** `team_member` can only transition their own assigned work items.
  - **Revision Tracking:** Returning to `Feedback` or `In Progress` increments the work item's `revisions` count.
  - **Domain Events & Auditing:** Emits `work_item.status_changed`, `work_item.blocked`, `work_item.approved` and writes immutable `ActivityEvent` records.
- **Computed Overdue State:**
  - `Overdue` is **never** a stored state in MongoDB. Dynamically evaluated at query time: `deadline < now` and status $\notin$ `['Approved', 'Published']`.
  - Mongoose virtual `isOverdue` provides live boolean flag on documents.

### 2. Frontend Screens Delivered
- **Screen 3: My Work (`/my-work` - `MyWorkPage.tsx`)**:
  - Personal priority queue partitioned into **Overdue**, **Today**, **This Week**, **Upcoming**, and **Completed**.
  - One-click state transitions (`Start`, `Submit for Review`, `Block`, `Clear Blocker`).
  - Rolling average revisions metric, active count, and mental clarity empty states with zero surveillance pressure.
- **Screen 4: Monthly Marketing Calendar (`/calendar` - `CalendarPage.tsx`)**:
  - Multi-perspective calendar: **Month**, **Week**, and **List Agenda** views.
  - Visual color coding by brand profile (all 7 brands) and department.
  - Filter bar: Brand Profile pills, Assigned Owner, Department, and Status.
  - Day cells with quick-add deliverable button, click-through modal preview, and deep link to workplace.
- **Screen 7: Single Work Detail (`/work/:id` - `WorkDetailPage.tsx`)**:
  - Unified execution workplace for individual deliverables.
  - Workflow stepper with status badge, blocker alerts, and overdue indicators.
  - 4 tabs: *Overview & Brief*, *Files & Deliverables*, *Feedback Rounds*, *Audit Activity*.
  - Strict inline status actions (Start, Submit, Block, Clear Blocker, Approve, Publish).
- **Screen 10: Todo & Priorities (`/todo` - `TodoPrioritiesPage.tsx`)**:
  - Role-scoped focus queue: Member (self), Team Lead (team), Head/Admin (org-wide).
  - Partitioned into **Overdue Deliverables**, **Due Today**, and **Upcoming Deliverables**.
  - Inline transition triggers and modal forms for submit links and blocker reasons.
- **Universal Work Items Directory (`/work` - `WorkListPage.tsx`)**:
  - Table and Grid layout switcher for cross-brand deliverables.
  - Filter by Profile, Status, Work Type, Overdue-only, and search text.
  - "New Deliverable" modal enforcing campaign linkage and validation.

### 3. Backend & Shared Schema Delivered
- **`@mmp/shared`**:
  - Added schemas: `workItemCreateSchema`, `workItemUpdateSchema`, `workItemTransitionSchema`.
  - Exported types: `WorkItemCreateInput`, `WorkItemUpdateInput`, `WorkItemTransitionInput`.
- **`apps/api` Modules**:
  - `src/modules/workItems/model.js`: `WorkItem` schema, compound indexes, virtual `isOverdue`.
  - `src/modules/workItems/transition.service.js`: Central state machine validator, permission checker, and activity logger.
  - `src/modules/workItems/service.js`: CRUD, `getMyWork`, `getCalendarWorkItems`, `getTodoItems`, `getWorkItemActivities`.
  - `src/modules/workItems/controller.js` & `routes.js`: Mounted at `/api/work`, `/api/my-work`, and `/api/todo`.

### 4. Build & Test Verification
| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build (ESM, CJS, DTS) |
| `@mmp/api` | `npx vitest run test/work_items_and_transitions.test.js` | **PASSED** | **19/19 tests pass** (traceability, state machine, self-approval guards, blocker reasons, scoping) |
| `@mmp/api` | `npm test` | **PASSED** | **84/84 tests pass** across all 8 test suites |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle with code split chunks for all 5 Phase 3 screens |

---

### 5. Phase 4 Readiness
With Phase 3 complete and verified:
- Ready to proceed to **Phase 4: Auto-Assignment Engine & Team Workload (Screen 9)** upon user approval.

---

## Phase 4: Auto-Assignment Engine & Team Workload (Screen 9) (Completed & Verified)

### 1. Goals & Invariants Delivered
- **Workload Formula & Three Capacity Bands:**
  - $\text{workloadPct} = \text{round}((\sum \text{estimatedEffortHrs of open work items} / \text{weeklyCapacityHours}) \times 100)$
  - Standardized Capacity Bands:
    - **Healthy**: $< 65\%$ (Emerald/Green)
    - **High**: $65\% - 85\%$ (Amber)
    - **Overloaded**: $> 85\%$ (Rose/Red)
  - Workload metrics evaluate rolling 90-day `avgRevisions` per person across closed deliverables to assess quality and rework rates.
- **Explainable Auto-Assignment Engine (`assignment/service.js`):**
  - Triggered during deliverable creation or scheduling. **Never assigns silently**.
  - Candidate Pool: Candidates matched from the department responsible for `WORK_TYPE_DEPARTMENT_MAP[workType]`, active non-admin personnel.
  - Multi-factor deterministic ranking:
    1. Filter out candidate pool members who exceed capacity where possible; non-overloaded ($<85\%$) ranked ahead of overloaded members.
    2. Creative `team_member` preferred over managerial `team_lead`.
    3. Lowest current `workloadPct`.
    4. Lowest rolling 90-day `avgRevisions`.
    5. Highest available bandwidth (remaining capacity hours).
  - Generates clear, human-readable rationale: e.g. `"Recommended Owner: Jane Doe. Reason: lowest current workload (45%) + suitable skill in SEO & Content + 22h available bandwidth."`
  - Explicit `isOverloadWarning: true` emitted if all candidates in the department exceed 85% capacity.
- **Mandatory Assignment Override Audit Logging:**
  - When a Team Lead, Marketing Head, or Admin departs from the recommendation or overrides an existing assignee, a mandatory non-empty `overrideReason` is captured.
  - Stored in dedicated `AssignmentOverride` Mongoose collection with original recommendation, chosen owner, and audit trail.
  - Automatically emits `work_item.assignment_overridden` domain event and creates an immutable `ActivityEvent`.
- **Leading Indicator Early Warning Cockpit:**
  - Live capacity radar at `/workload` flags overloaded team members before deadlines slip and bottlenecks propagate to subsequent campaigns.

### 2. Frontend Screens Delivered
- **Screen 9: Team Workload (`/workload` - `TeamWorkloadPage.tsx`)**:
  - **Early Warning Cockpit Banner**: Dynamically highlights overloaded team members requiring immediate rebalancing.
  - **KPI Metric Strip**: Total Team Members, Total Bandwidth Hours, Allocated Hours, Available Capacity, Overall Avg Workload %, Overloaded Count, Total Open Deliverables.
  - **Department Accordions & Workload Cards**:
    - Grouped by department with average workload percentage and band distribution indicators.
    - Member cards featuring capacity badges (`Healthy`, `High`, `Overloaded`), animated progress bars, weekly allocated vs capacity hours, and rolling 90-day avg revisions.
    - Expandable deliverable drawer showing each member's active items, effort hours, overdue status, and deep links to `/work/:id`.
  - **Filter & Search Bar**: Quick filtering by department, capacity band (`Healthy`, `High`, `Overloaded`), and text search (name, email, job role).
  - **Interactive Auto-Assignment Modal**:
    - Test recommendations on demand by selecting Work Type, Estimated Effort Hours, and optional Deadline.
    - Displays recommended candidate with explainable rationale string, post-assignment simulated workload %, and bandwidth impact.
    - Depart from recommendation form requiring mandatory override reason with live validation.

### 3. Backend & Shared Schema Delivered
- **`@mmp/shared`**:
  - `CAPACITY_BANDS`: `['Healthy', 'High', 'Overloaded']` constant.
  - `assignmentRecommendSchema`: Validates `workType`, `estimatedEffortHrs`, `deadline`.
  - `assignmentOverrideSchema`: Validates `workItemId`, `recommendedPersonId`, `chosenPersonId`, `overrideReason`.
  - Exported TypeScript types: `CapacityBand`, `AssignmentRecommendInput`, `AssignmentOverrideInput`.
- **`apps/api` Modules**:
  - `src/modules/assignment/model.js`: `AssignmentOverride` Mongoose schema with indexes on `workItemId`, `chosenPersonId`, `createdAt`.
  - `src/modules/assignment/service.js`:
    - `calculateMemberWorkloadMetrics(personId)`
    - `recommendAssignee(criteria, user)`
    - `recordAssignmentOverride(data, user)`
    - `getTeamWorkload(filters, user)`
    - `listAssignmentOverrides(filters, user)`
  - `src/modules/assignment/controller.js` & `routes.js`: Mounted at `/api/assignment` (`/recommend`, `/override`, `/overrides`) and `/api/workload`.
  - Mounted in `apps/api/src/server.js`.

### 4. Build & Test Verification
| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build (ESM, CJS, DTS) with capacity bands and assignment schemas |
| `@mmp/api` | `npx vitest run test/assignment_and_workload.test.js` | **PASSED** | **13/13 tests pass** (workload calculation, 3 capacity bands, ranking heuristics, explainable rationale, overload warnings, override logging) |
| `@mmp/api` | `npm test` | **PASSED** | **97/97 tests pass** across all 9 test suites |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle (Screen 9 `TeamWorkloadPage-*.js` chunk generated, 0 TypeScript errors) |

---

### 5. Phase 5 Readiness
With Phase 4 complete and verified:
- Ready to proceed to **Phase 5: Feedback Loops, Revision Flags & Blockers (Screens 8 & 11)** upon user approval.

---

## Phase 5: Feedback Loops, Revision Flags & Blockers (Screens 8 & 11) (Completed & Verified)

### 1. Goals & Invariants Delivered
- **Structured 2-Entry Review Threads:**
  - Round-based review structure:
    - Entry 1: Reviewer feedback (`roundStatus = 'Revision Required' | 'Approved'`, `isResponse = false`). Only Team Lead, Marketing Head, or Admin can approve deliverables.
    - Entry 2: Assigned Owner response (`isResponse = true`).
  - Reviewer submitting `Revision Required` sets work item `status = 'Feedback'`, increments `revisions` count, and triggers automated revision flag check.
  - Reviewer submitting `Approved` sets work item `status = 'Approved'` and writes immutable `ActivityEvent`.
- **Automated Revision Flagging Engine:**
  - Invariant: Automatically creates `RevisionFlag` when a deliverable reaches $\ge 4$ revision rounds OR exceeds the owner's rolling 90-day baseline average by $> 1.0$.
  - Generates `revision.flagged` `ActivityEvent` and dispatches immediate notification to departmental Team Leads and Marketing Heads.
  - 48-Hour Unclassified Escalation Window: Flags unclassified after 48 hours are automatically flagged as `isEscalated = true` with critical escalation badges directed to the Marketing Head.
  - 7 Canonical Root Causes:
    1. `Brief unclear`
    2. `Creative direction unclear`
    3. `Skill gap`
    4. `Feedback inconsistency`
    5. `Excessive scope change`
    6. `TL approval delay`
    7. `Client/business requirement changed`
  - Classification is strictly restricted to Team Leads, Marketing Heads, or Admins.
- **Blocker Engine & Dependency Owner Alerting:**
  - Canonical 9 Blocker Reasons: *Waiting for feedback, Waiting for content, Waiting for data, Technical issue, Dependency, Client/business approval, Resource issue, Unclear requirement, Other*.
  - **Dependency Invariant Guard:** When reason is in `BLOCKER_DEPENDENCY_REASONS` (`Waiting for feedback`, `Waiting for content`, `Waiting for data`), a non-empty `dependencyOwnerId` is strictly required at schema and API levels.
  - Immediate multi-channel alerting: In-app notification + email notification dispatched immediately to the dependency owner.
  - Resolving blocker marks `status = 'Resolved'`, captures `resolutionNotes`, restores deliverable status to `In Progress`, and notifies deliverable owner.
  - Interactive "Ping Dependency Owner" reminder trigger via `/api/blockers/:id/notify`.

### 2. Frontend Screens Delivered
- **Screen 8: Feedback & Revision History (`/feedback` - `FeedbackPage.tsx`)**:
  - Live metric strip: In Feedback, Revision Flags, Escalated Flags (>48h SLA), Approved Deliverables.
  - Master-detail split layout:
    - Left column: Filterable list of deliverables with search, brand profile badges, revision counts, and flag indicators.
    - Right column: Full interactive review thread displaying chronological rounds with reviewer decision cards and owner response cards.
    - Reviewer action form for submitting round decisions (`Revision Required` vs `Approved`).
    - Owner response form for replying to comments and submitting revised links.
    - Flagged revision banner with "Classify Root Cause" modal.
- **Screen 11: Issues & Blockers (`/issues` - `IssuesBlockersPage.tsx`)**:
  - Operational console with tabs for **Active Blockers** and **Revision Flags**.
  - KPI banner: Active Blockers, Long-Blocked (>48h SLA), Revision Flags, 48h Escalations to Marketing Head.
  - Active Blocker Cards:
    - Displays blocker reason, blocked duration (hours & days), context notes, and highlighted dependency owner card.
    - Quick actions: "Ping Owner" reminder button, "Resolve & Unblock" modal.
    - "+ Report Deliverable Blocker" modal enforcing mandatory dependency owner selection when reason requires it.
  - Revision Flag Cards:
    - Displays revision counts vs owner baseline, root-cause status badge, and >48h escalation badges.
    - Inline "Classify Root Cause" modal with dropdown of the 7 fixed causes and notes.

### 3. Backend & Shared Schema Delivered
- **`@mmp/shared`**:
  - `FEEDBACK_ROUND_STATUSES`: `['Revision Required', 'Approved']`.
  - `feedbackEntryCreateSchema`: Validates `workItemId`, `round`, `roundStatus`, `text`, `isResponse`, `attachments`.
  - `revisionClassifySchema`: Validates `rootCause` against the 7 fixed taxonomies.
  - `blockerCreateSchema`: Validates `workItemId`, `reason`, `notes`, with `.refine()` enforcing mandatory `dependencyOwnerId` when reason is in `BLOCKER_DEPENDENCY_REASONS`.
  - `blockerResolveSchema`: Validates `resolutionNotes` and `resumeStatus`.
- **`apps/api` Modules**:
  - `src/modules/feedback/`:
    - `model.js`: `FeedbackEntry` and `RevisionFlag` models with indexes and `isOver48HoursUnclassified` virtual.
    - `service.js`: `getFeedbackForWorkItem`, `createFeedbackEntry`, `checkAndCreateRevisionFlag`, `classifyRevisionFlag`, `listRevisionFlags`, `listFeedbackThreads`.
    - `controller.js` & `routes.js`: Mounted at `/api/feedback` and `/api/revisions`.
  - `src/modules/blockers/`:
    - `model.js`: `Blocker` model with indexes on `workItemId` and `dependencyOwnerId`.
    - `service.js`: `createBlocker`, `resolveBlocker`, `notifyDependencyOwner`, `listBlockers`.
    - `controller.js` & `routes.js`: Mounted at `/api/blockers`.
  - Mounted in `apps/api/src/server.js`.

### 4. Build & Test Verification
| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build with feedback, revision flag, and blocker schemas |
| `@mmp/api` | `npx vitest run test/feedback_and_blockers.test.js` | **PASSED** | **15/15 tests pass** (two-entry rounds, owner ownership guards, auto-flagging on 4th round, 7 root causes classification, escalation window, dependency owner mandatory validation, resolution, reminder notify) |
| `@mmp/api` | `npm test` | **PASSED** | **112/112 tests pass** across all 10 test suites |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle (Screen 8 `FeedbackPage-*.js` and Screen 11 `IssuesBlockersPage-*.js` chunks generated, 0 TypeScript errors) |

---

### 5. Phase 6 Readiness
With Phase 5 complete and verified:
- Ready to proceed to **Phase 6: Global Filter Bar & Team Dashboard (Screen 2)** upon user approval.




