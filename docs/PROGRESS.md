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
- Proceeded to **Phase 6: Global Filter Bar & Team Dashboard (Screen 2)**.

---

## Phase 6: Global Filter Bar & Team Dashboard (Status: COMPLETE)

### 1. Executive Summary
Phase 6 delivered the central executive cockpit and the universal cross-cutting filtering infrastructure for HACA Marketing OS. A universal, URL-synced `GlobalFilterContext` and glassmorphic `GlobalFilterBar` enable instant filtering across Brand Profiles, Departments, Months, and Deliverable Statuses. The complete 9-section `TeamDashboardPage` (`/dashboard` - Screen 2) provides the Marketing Head, Team Leads, and Team Members with real-time operational visibility into monthly targets, execution KPIs, today's immediate priorities, creative production output, campaign sprints, team workload distribution, lead funnel pacing, issues/blockers, and recent platform activity.

All data aggregations are strictly scoped via `resolveScope(user, filters)`, preventing unauthorized data leakage across brand profiles and department boundaries, backed by an optimized compound index on `WorkItem`.

---

### 2. Frontend Screens & Components Delivered
- **`GlobalFilterContext.tsx` (`apps/web/src/context/GlobalFilterContext.tsx`)**:
  - URL `useSearchParams` two-way synchronization for `profileId`, `departmentId`, `ownerId`, `campaignId`, `month`, and `status`.
  - Exposes `filters`, `setFilter`, `resetFilters`, `activeFilterCount`, and computed `queryParams` dictionary for seamless API query string generation.
- **`GlobalFilterBar.tsx` (`apps/web/src/components/GlobalFilterBar.tsx`)**:
  - Sticky glassmorphic bar (`glass-panel rounded-2xl border border-white/80 backdrop-blur-md`).
  - Brand Profile selector pills with active visual highlights.
  - Department dropdown populated from active organization departments.
  - Month picker defaulting to current active month.
  - Status filter dropdown matching `WORK_ITEM_STATUSES`.
  - Active filter badge counter and quick "Reset" action.
- **Screen 2: Team Dashboard (`/dashboard` - `TeamDashboardPage.tsx`)**:
  - **Section 1: Monthly Targets Strip**:
    - Revenue, Leads, Qualified Leads, and Budget progress cards with progress bars and percentage achieved calculations.
    - Quick link to Target Setup modal / Campaigns list.
  - **Section 2: KPI Strip**:
    - Execution pulse cards: Total Deliverables, In Progress, In Feedback, Blocked, Approved, Published, and Overdue.
    - Interactive click-through deep links directly navigating to `/work?status=...`.
  - **Section 3: Today's Priorities**:
    - Focused operational queue of deliverables due today or overdue.
    - Priority indicators, brand badges, owner avatars, status pills, and direct jump to deliverable detail.
  - **Section 4: Creative Production Stats**:
    - Production output breakdown by work type (Reels, Static Posts, Carousels, Stories, Ad Copies, Blogs).
    - Departmental throughput comparison bars.
  - **Section 5: Campaign Progress**:
    - Active campaign sprints with progress bars, due date indicators, and budget pacing.
  - **Section 6: Team Workload**:
    - Team member capacity distribution cards with utilization bands (Balanced, High, Overloaded).
    - Visual alerts for overloaded team members (>100% capacity).
  - **Section 7: Lead Funnel Snapshot**:
    - Qualified lead target vs actual, conversion rate estimates, and deep-link to Lead Funnel analytics.
  - **Section 8: Issues & Blockers**:
    - Active blocker cards with dependency owner callouts and SLA duration badges.
    - Excessive revision flags with root cause badges and links to `/issues`.
  - **Section 9: Recent Activity Feed**:
    - Chronological platform audit timeline of recent `ActivityEvent` records with actor names and entity links.

---

### 3. Backend & API Delivered
- **Optimized Compound Index**:
  - Added `{ profileId: 1, departmentId: 1, status: 1, deadline: 1 }` to `WorkItem` model (`apps/api/src/modules/workItems/model.js`) for lightning-fast multi-dimensional dashboard aggregations.
- **`dashboard.service.js` (`apps/api/src/modules/reports/dashboard.service.js`)**:
  - Implemented `getDashboardOverview(filters, user)`:
    - Resolves authorization scope via `await resolveScope(user, filters)`.
    - Simultaneously aggregates Targets, WorkItem KPIs, Today's Priorities, Creative Stats, Campaign Sprints, Team Workloads, Funnel Metrics, Blockers, and Recent Activities.
    - Implemented `getDashboardSummary(filters, user)` for high-level widget consumption.
- **Controller & Routes (`apps/api/src/modules/reports/`)**:
  - `controller.js`: Mounted `getDashboardOverviewHandler` and `getDashboardSummaryHandler`.
  - `dashboard.routes.js`: Configured `/overview`, `/summary`, `/` and `/:role` routes with authentication and validation.
- **Automated Vitest Test Suite (`apps/api/test/dashboard_and_filters.test.js`)**:
  - 3 comprehensive integration tests asserting:
    1. Full 9-section dashboard response structure and metric calculations.
    2. Global filter synchronization (filtering by profile restricts KPIs and deliverables to that profile).
    3. Role-based scoping (team members only see deliverables and targets within their authorized profile scope).

---

### 4. Build & Test Verification
| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/api` | `npx vitest run test/dashboard_and_filters.test.js` | **PASSED** | **3/3 tests pass** (9 sections aggregation, profile filter synchronization, role-based scoping) |
| `@mmp/api` | `npm test` | **PASSED** | **115/115 tests pass** across all 11 test suites |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle (`TeamDashboardPage-*.js` chunk generated, 0 TypeScript errors) |

---

### 5. Phase 7 Readiness
With Phase 6 complete and verified:
- Proceeded to **Phase 7: Automation Rules, Reports & Notifications (Screen 14)**.

---

## Phase 7: Automation Rules, Reports & Notifications (Status: COMPLETE)

### 1. Executive Summary
Phase 7 delivered the centralized automation and intelligence core of HACA Marketing OS. The platform now features the **7 standard Automation Rules** (managing month-end scorecard runs, overdue deliverable escalations, stagnant task warnings, cross-functional blocker alerts, revision pattern detection, LeadSquared live sync, and weekly marketing digests) with built-in execution idempotency, and the **6 Marketing OS Report Definitions** with on-demand HTML email generation and live interactive reporting.

Frontend Screen 14 (`/reports` - `ReportsPage.tsx`) provides an executive console with tabs for Report Definitions, Automation Rules, and a Live Interactive Viewer with responsive glass aesthetics.

---

### 2. Frontend Screens & Components Delivered
- **Screen 14: Reports and Automation (`/reports` - `ReportsPage.tsx`)**:
  - **Tab 1: Report Definitions (6 Reports)**:
    - Rich cards for Weekly Marketing, Monthly Performance Scorecard, Creative Production, Lead Funnel & CPL, Team Performance Digest, and Campaign Deep-Dive.
    - Cadence badges (`Weekly`, `Monthly`, `On Demand`), schedule details, and recipient tags.
    - Interactive "Generate Now" button triggering instant execution with live spinner and embedded HTML preview modal.
    - Quick "Copy HTML" and "View Live" buttons.
  - **Tab 2: Automation Rules (7 Rules)**:
    - Interactive rule management console for the 7 standard rules.
    - Active/Paused animated toggle switch (persisting state to backend).
    - Trigger pills (`cron`, `scheduled`, `event`) and schedule descriptions.
    - Last-run status indicators (`SUCCESS`, `RUNNING`, `FAILED`, `IDLE`) with execution summaries and timestamps.
    - "Run Now" on-demand trigger button with immediate toast feedback.
    - "View Config & Logs" modal showing complete execution payloads and JSON configurations.
  - **Tab 3: Live Interactive Viewer**:
    - Report selector dropdown with dynamic scoped data rendering.
    - Summary KPI metric card strip.
    - Dynamic data tables with styled headers, zebra striping, and cell formatting.
    - "Copy HTML" and "Reload" controls.

---

### 3. Backend, Shared Schemas & Jobs Delivered
- **`@mmp/shared`**:
  - `AUTOMATION_RULE_KEYS`: `['month_end_report', 'overdue_escalation', 'todo_escalation', 'blocker_dependency_alert', 'revision_pattern_flag', 'lsq_live_sync', 'weekly_report']`.
  - `REPORT_KEYS`: `['weekly_marketing', 'monthly_scorecard', 'creative_production', 'lead_funnel_cpl', 'team_performance', 'campaign_deepdive']`.
  - `REPORT_CADENCES`: `['Weekly', 'Monthly', 'On Demand']`.
  - `automationRuleToggleSchema`, `automationRuleRunSchema`, `reportGenerateSchema`.
- **`apps/api/src/modules/automation/`**:
  - `model.js`: `AutomationRule` Mongoose model.
  - `runner.js`: Execution runner implementing logic for all 7 rules with notification deduplication and SLA escalation (immediate owner ping, 4h department lead escalation).
  - `service.js`: Rule querying, toggle management, and on-demand trigger dispatcher.
  - `controller.js` & `routes.js`: Mounted at `/api/automation/rules` and `/api/automation`.
- **`apps/api/src/modules/reports/`**:
  - `model.js`: `ReportDefinition` Mongoose model.
  - `service.js`: Report generation engines for all 6 reports under `resolveScope(user, filters)` and branded HTML email generator.
  - `controller.js` & `routes.js`: Mounted at `/api/reports/definitions`, `/api/reports/definitions/:key/generate`, `/api/reports/view/:key`, `/api/reports/export`.
- **`apps/api/src/modules/jobs/processors.js`**:
  - Wired BullMQ queue job handlers (`runOverdueEscalationJob`, `runTodoEscalationJob`, `runBlockerAlertsJob`, `runWeeklyReportJob`, `runMonthEndReportJob`, `runLsqSyncJob`) to the automation engine.
- **`apps/api/test/automation_and_reports.test.js`**:
  - 13 comprehensive integration tests asserting:
    1. Retrieval and validation of the 7 standard automation rules.
    2. Active/paused toggling.
    3. Overdue deliverable notification dispatch (owner ping + 4h lead escalation).
    4. Stale task identification and alerting.
    5. Blocker dependency cross-team alerts.
    6. Retrieval and validation of the 6 standard report definitions.
    7. On-demand generation of all 6 reports with HTML rendering and data accuracy.
    8. Idempotency guarantees preventing duplicate notification spam on reruns.

---

### 4. Build & Test Verification
| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build with Phase 7 automation and report schemas |
| `@mmp/api` | `npx vitest run test/automation_and_reports.test.js` | **PASSED** | **13/13 tests pass** (7 automation rules, 6 report definitions, idempotency) |
| `@mmp/api` | `npm test` | **PASSED** | **128/128 tests pass** across all 12 test suites |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle (Screen 14 `ReportsPage-*.js` chunk generated, 0 TypeScript errors) |

---

### 5. Phase 8 (LeadSquared & Data Center) Status: COMPLETE
Phase 7 transitioned seamlessly into Phase 8.

---

## Phase 8: LeadSquared (LSQ) Integration & Data Center (Status: COMPLETE)

### 1. Executive Summary
Phase 8 delivered complete bi-directional LeadSquared (LSQ) CRM synchronization, data integrity guards, lead funnel analytics, and data hygiene remediation:
- **Read-Authoritative Architectural Guarantee**: LSQ is established as the authoritative source of truth. Direct mutations (POST, PUT, PATCH, DELETE) to lead records and funnel stages via the Marketing OS API are strictly blocked with `HTTP 405 READ_AUTHORITATIVE_CONSTRAINT`.
- **Inbound Lead Auto-Task Creation**: Inbound WhatsApp leads (`WhatsApp Inbound`) automatically spawn a prioritized `WorkItem` assigned to the WhatsApp Marketer (or WhatsApp department) with an SLA turnaround deadline and activity audit event.
- **Idempotent Sync Engine**: Idempotent synchronization keyed on `lsqLeadId` with live LSQ REST API integration and an offline deterministic fixture engine generating 12 funnel stages, 19 lead acquisition sources, and 7 brand profiles.
- **Screen 12: Lead Funnel (`/leads`)**: Visual 12-stage pipeline conversion and drop-off analysis, executive metric strip ($CPL = \frac{\text{Spend}}{\text{Ad Leads}}$, $CPQL = \frac{\text{Spend}}{\text{Qualified Leads}}$, $\text{Qualified \%} = \frac{\text{Qualified}}{\text{Total}} \times 100$), and 19-channel source acquisition breakdown.
- **Screen 13: Data Center (`/data-center`)**: LSQ sync health gauge (96%+ health score), orphan and unmapped source tracking, manual sync trigger modal, and discrepancy remediation console allowing the Marketing Head to assign missing brand profiles and map canonical channels.

---

### 2. Frontend Screens Delivered

#### Screen 12: Lead Funnel (`/leads`)
- **Executive KPI Metric Strip**:
  - **Total Pipeline**: Total inbound leads and paid ad-generated volume.
  - **Qualified Leads**: Actual qualified leads vs target with percentage achieved.
  - **Cost Per Lead (CPL)**: $\frac{\text{Spend}}{\text{Ad Leads}}$ based on active MonthlyTarget budget.
  - **Cost Per Qualified Lead (CPQL)**: $\frac{\text{Spend}}{\text{Qualified Leads}}$ efficiency index.
  - **Pipeline Qualification Rate**: $\frac{\text{Qualified}}{\text{Total}} \times 100$ conversion rate.
- **12-Stage Visual Funnel**:
  - Waterfall progression for: Total Leads, Not Contacted, Not Answered, Interested, Qualified Leads, Call Back, Payment Received, Not Interested, Not a Potential, Not Answered (Multiple), Reconnected, Not Eligible.
  - Real-time conversion drop-off indicators, stage volume counts, and milestone highlights.
- **19-Channel Acquisition Mix**:
  - Filterable tabs (All 19, Paid Ads 4, WhatsApp Inbound, Organic/Referral).
  - Searchable data table with channel classification, lead volume, pipeline share %, qualified count, and qualification rate %.
- **Recent Synced Leads**:
  - Direct feed of synced leads showing LSQ ID, contact details, brand profile, stage, score, and sync timestamp.

#### Screen 13: Data Center & LSQ Sync Hygiene (`/data-center`)
- **Sync Health Score Gauge**: Dynamic health index measuring clean vs discrepancy ratio.
- **Read-Authoritative Guard Banner**: Explicit documentation of the CRM single source of truth and HTTP 405 constraint enforcement.
- **Sync Trigger Console**: On-demand sync modal with customizable batch sizes and test discrepancy simulation.
- **Discrepancy Remediation Console**:
  - Filter tabs for Missing Brand Profile, Unmapped Lead Source, and All Discrepancies.
  - Actionable resolution modal allowing Marketing Head/Admin to map unrouted leads to one of 7 brand profiles and one of 19 canonical lead sources (`PATCH /api/datacenter/discrepancies/:id/resolve`).

---

### 3. Backend, Shared Schemas & Tests Delivered
- **`@mmp/shared`**:
  - `PAID_AD_LEAD_SOURCES`: `['Facebook Lead Ads', 'Google Ads', 'Online Campaigns (SMM)', 'Meta Re-Engaged Leads']`.
  - `leadDiscrepancyResolveSchema` and `lsqSyncTriggerSchema`.
- **`apps/api/src/modules/leads/`**:
  - `model.js`: `Lead` Mongoose schema with `lsqLeadId`, `profileId`, `leadSource`, `stage`, `score`, `ownerEmail`, `syncStatus`, `discrepancyReason`, compound indexes.
  - `lsqAdapter.js`: LSQ REST API adapter with deterministic fixture engine for offline testing.
  - `service.js`: `syncLsqLeads`, `createWhatsAppInboundTask`, `getLeadFunnelMetrics`, `getDataCenterStatus`, `resolveDiscrepancy`.
  - `controller.js` & `rejectLeadModificationHandler`: 405 handlers enforcing read-authoritative rules.
  - `routes.js` & `datacenter.routes.js`: Mounted at `/api/leads` and `/api/datacenter`.
- **`apps/api/test/leads_and_datacenter.test.js`**:
  - 9 comprehensive integration tests verifying:
    1. LSQ idempotent sync and auto-task generation for WhatsApp Inbound leads.
    2. Read-authoritative constraint returning HTTP 405 `READ_AUTHORITATIVE_CONSTRAINT` on POST, PUT, PATCH, DELETE.
    3. Lead funnel analytics with 12 stages, 19-source mix, and CPL/CPQL math.
    4. Data Center sync health score calculation, discrepancy listing, and remediation.
    5. On-demand manual sync trigger.

---

### 4. Build & Test Verification
| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| `@mmp/shared` | `npm run build` | **PASSED** | Clean tsup build with Phase 8 lead schemas |
| `@mmp/api` | `npx vitest run test/leads_and_datacenter.test.js` | **PASSED** | **9/9 tests pass** (idempotency, WhatsApp task, 405 guards, funnel, discrepancy resolution) |
| `@mmp/api` | `npm test` | **PASSED** | **137/137 tests pass** across all 13 test suites |
| `@mmp/web` | `tsc && vite build` | **PASSED** | Clean production bundle (`LeadFunnelPage-*.js`, `DataCenterPage-*.js` chunks, 0 TS errors) |

---

### 5. Phase 9 (Performance Dimensions, Hardening & QA) Status: COMPLETE
Phase 8 transitioned cleanly into Phase 9.

---

## Phase 9: Performance Dimensions, Hardening & QA (Status: COMPLETE)

### 1. Executive Summary
Phase 9 successfully concluded the Master Build Plan for the HACA Marketing OS:
- **5 Performance Dimensions Calculation Service (`modules/people/metrics.js`)**:
  - Implemented the canonical multi-dimensional evaluation model specified in Spec Section 8.7:
    1. **Output**: Completed deliverables count, in-progress items, creative volume, and executed campaigns count.
    2. **Efficiency**: Average completion time ($T_{\text{finish}} - T_{\text{start}}$ in hours), deadline adherence %, revision rate %.
    3. **Quality**: First-time approval rate %, rejection rate %, multi-revision re-edit rate %, and 1–10 quality score index.
    4. **Collaboration**: Average feedback response turnaround, blocker resolution duration, dependency delay incidents caused, and 0–100 collaboration score.
    5. **Business Impact**: Attributable inbound leads and qualified leads mapped to executed brand campaigns, qualification rate %, and overall composite performance index.
- **API Performance Endpoints**:
  - `GET /api/people/:id/performance`: Scoped individual performance dimension evaluation.
  - `GET /api/people/performance/team`: Team-wide performance aggregation.
- **Production Indexing & Query Optimizations**:
  - Added optimized compound indexes on `WorkItem` (`{ 'blocker.dependencyOwnerId': 1 }`, `{ isBlocked: 1 }`, `{ workType: 1, status: 1 }`), `Campaign` (`{ profileId: 1, status: 1 }`, `{ departmentId: 1, status: 1 }`, `{ ownerId: 1, status: 1 }`, `{ startDate: 1, endDate: 1 }`), and `ActivityEvent` (`{ actorId: 1, timestamp: -1 }`).
- **Security & Hardening Verification**:
  - Helmet CSP headers, rate-limiting (`express-rate-limit`), cookie protection, parameter pollution protection (`hpp`), input sanitization, and sensitive data redaction in Pino logs.
- **Comprehensive End-to-End Test Suite (`phase9_mos_e2e.test.js`)**:
  - 11 comprehensive tests asserting the complete lifecycle workflow from Target $\rightarrow$ Campaign $\rightarrow$ WorkItem $\rightarrow$ Feedback Loop $\rightarrow$ Blocker $\rightarrow$ LSQ Sync $\rightarrow$ Authoritative Guard $\rightarrow$ Monthly Scorecard Report $\rightarrow$ Performance Dimensions.

---

### 2. Final Verification Summary
| Component | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Full API Suite** | `npm test` | **PASSED** | **148/148 tests pass** across all 14 test suites |
| **Phase 9 E2E Suite** | `npx vitest run test/phase9_mos_e2e.test.js` | **PASSED** | **11/11 tests pass** (Target $\rightarrow$ Campaign $\rightarrow$ Work $\rightarrow$ Feedback $\rightarrow$ Blocker $\rightarrow$ Report $\rightarrow$ 5 Dimensions) |
| **Web Production Build** | `tsc && vite build` | **PASSED** | **100% production build clean** with zero TypeScript errors across all 14 screens |

---

## Phase 10: Executive Role Addition (Status: COMPLETE)

### 1. Executive Summary
Phase 10 introduced the fifth canonical role, `'executive'`, designed for company leadership (CEO, Business Head, Board Directors). The executive role provides complete read-only visibility into all marketing operations, campaigns, deliverables, feedback threads, lead funnels, and reports across all 7 brand profiles (`personScope: 'all'`, all 7 profiles assigned by default), while strictly prohibiting any data creation, modification, approval, or deletion (HTTP 403 Forbidden across all write routes).

---

### 2. Architecture & Backend Implementation
1. **Canonical Roles & Permissions (`@mmp/shared`)**:
   - `ROLE_KEYS = ['admin', 'marketing_head', 'executive', 'team_lead', 'team_member']`.
   - New permission keys:
     - `portal.view`: Universal read-only permission covering all portal read endpoints (dashboard, campaigns, work items, calendar, feedback, blockers, leads, datacenter, reports).
     - `people.view`: Read-only directory access with contact information (email and phone) omitted.
   - `ROLE_PERMISSIONS.executive = ['portal.view', 'people.view', 'target.view', 'lead.view', 'datacenter.view', 'analytics.team', 'report.view']`.
   - `ROLE_PERMISSIONS.admin` derives all permission keys dynamically.
   - `ROLE_PERMISSIONS.marketing_head` explicitly includes `portal.view` and `people.view`.
2. **Permission Middleware (`apps/api/src/middleware/requirePermission.js`)**:
   - Implemented and exported `requireAnyPermission(...perms)` to support routes accessible by either role-specific permissions or universal `portal.view`.
3. **Row-Level Scoping (`apps/api/src/lib/scope.js`)**:
   - For `role === 'executive'`: returns all profiles in `user.profileAccess` (all 7 profiles by default) and `personScope: 'all'` (`allowedPersonIds = null`, `canAccessPerson: true`).
4. **Data Redaction & Isolation (`modules/people/`)**:
   - In `people/service.js` and `people/routes.js`: when caller has `executive` role or lacks `user.manage`/`people.assign`, `email` and `phone` are sanitized (omitted) from all person listings and profile detail queries.
   - Excluded `executive` from candidate selection pools (`assignment/service.js`), operational workload calculations (`modules/people/`), and team performance digest queries (`metrics.js`).
5. **Access Control & Security Guards (`modules/access/`, `modules/users/`)**:
   - Public `POST /api/v1/access/request` rejects requests for `executive` or `admin`.
   - Only `admin` can grant `executive` role or approve access requests for `executive`.
   - `marketing_head` is barred from granting `executive` role, editing `executive` accounts, or suspending `executive` users (returns HTTP 403 `CANNOT_MODIFY_PROTECTED_ROLE`).
6. **Route Protection Verification**:
   - GET endpoints across all modules accept `portal.view` (or specific view permission).
   - Mutation endpoints (POST, PATCH, PUT, DELETE) require write permissions (`work.create`, `work.request`, `campaign.manage`, `target.manage`, `feedback.give`, `automation.manage`, `report.configure`), returning HTTP 403 for executive callers.
   - Report generation endpoints (`POST /api/reports/definitions/:key/generate` and `POST /api/reports/:key/generate`) require `requireAnyPermission('report.configure', 'campaign.manage')`, blocking executive generation while allowing reading reports.

---

### 3. Data Migration & Demo Seeding
1. **Migration Scripts (`apps/api/scripts/migrate-user-to-person.js`, `scripts/migrate-legacy-roles.js`)**:
   - Updated `DEFAULT_ROLE_MAP`:
     - `management` $\rightarrow$ `executive` (Active, all 7 profiles, empty `reportsToIds`)
     - `viewer` $\rightarrow$ `executive` (Active, all 7 profiles, empty `reportsToIds`)
     - `dept_lead` $\rightarrow$ `suspended`
     - `dept_staff` $\rightarrow$ `suspended`
2. **Demo Cohort Seeding (`scripts/demo-users.json`, `scripts/seed-demo-users.js`)**:
   - Added `Demo Executive` (`executive@demo.haca.local`, password `demoPassword123!`) with all 7 brand profiles assigned and status active, expanding the demo roster to 10 users.

---

### 4. Frontend UI Implementation (`apps/web`)
1. **Navigation & Routing (`Layout.tsx`, `App.tsx`)**:
   - `RootRedirect`: `executive` lands on `/dashboard`.
   - Hides `/my-work` from category navigation and sidebar when current user has `executive` role.
2. **Read-Only UI Protections**:
   - `TeamDashboardPage.tsx`: Hides "New Deliverable" button for non-creators; maps `executive` to "Executive" display badge.
   - `CalendarPage.tsx`: Hides "New Deliverable" button.
   - `WorkListPage.tsx`: Hides "New Work Item" button.
   - `ReportsPage.tsx`: Hides "Generate Now" action button.
   - `TeamWorkloadPage.tsx`: Hides "Auto-Assign Deliverable" action.
   - `TodoPrioritiesPage.tsx`: Hides quick status transition buttons for `executive`.
   - `UsersPage.tsx`: Hides "Add New User", omits contact fields, disables edit/suspend/reset actions, and renders a "Protected" badge on executive accounts.

---

### 5. Build & Test Verification
| Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Executive Role Suite** | `npx vitest run test/executive_role.test.js` | **PASSED** | **53/53 tests pass** (contract snapshot, scoping, route walker with 200 on reads and 403 on writes, email/phone masking, candidate/workload exclusion, security guards) |
| **Reset & Seed Suite** | `npx vitest run test/reset_and_demo_seed.test.js` | **PASSED** | **14/14 tests pass** (10 demo users verified including Demo Executive) |
| **Full API Test Suite** | `npx vitest run` | **PASSED** | **202/202 tests pass** across all 15 test suites with 0 failures |
| **Shared Package Build** | `npm run build` in `packages/shared` | **PASSED** | Clean tsup build with 5 roles and `portal.view`/`people.view` emitted |
| **Web Production Build** | `npm run build` in `apps/web` | **PASSED** | Clean production build with **0 TypeScript errors** |

---

## Role Fix Pass 1: Session and Security (Status: COMPLETE)

### 1. Executive Summary
Pass 1 resolves all high-priority session stability, authentication, and core security constraints defined in Section 5 of `docs/ROLE_FIX_PLAN.md` and verified in `docs/ROLE_FIX_VERIFICATION.md` (A1–A7, A9, A10, B10, D8). All changes adhere strictly to the engineering defaults in Section 7. Every item includes full test coverage asserting both allowed and denied paths across all 5 canonical roles (`admin`, `marketing_head`, `executive`, `team_lead`, `team_member`).

### 2. Changes Implemented by Item

| ID | Item | Target File(s) | Implementation Details |
| :--- | :--- | :--- | :--- |
| **A1** | Silent Token Refresh | `apps/web/src/lib/api.ts` | Implemented an in-flight token refresh mutex (`refreshPromise`) and retry queue in `apiFetch`. On HTTP 401, invokes `POST /api/auth/refresh` once, replaying queued requests on success or safely redirecting to `/login` with `from` parameter on failure. Excludes auth endpoints to prevent loops. |
| **A2** | Reject Unauthenticated Sockets | `apps/api/src/server.js` | Replaced unauthenticated `next()` fallback in Socket.io handshake middleware with `return next(new Error('Authentication failed: Valid accessToken required'))`. Catches invalid/expired tokens and rejects with explicit auth error. |
| **A3** | Single-Domain Cookies | `apps/api/src/modules/auth/controller.js` | Updated `getCookieOptions` and `logout` clear options from `sameSite: isProd ? 'none' : 'lax'` to `sameSite: 'lax'` for single-domain deployment, respecting `COOKIE_DOMAIN`. |
| **A4** | Credentials Repository Hygiene | `.gitignore`, `scripts/seed-demo-users.js`, `apps/api/src/config/env.js` | Untracked `docs/USERS_AND_PASSWORDS.md` from git index; added credentials patterns to `.gitignore`. Enforced `min(8)` on `DEMO_SEED_PASSWORD`. Added runtime abort guard in `seed-demo-users.js` if `NODE_ENV === 'production'`. |
| **A5** | Restrict Report 'Generate Now' | `apps/api/src/modules/reports/routes.js` | Replaced `requireAnyPermission('report.configure', 'campaign.manage')` on `POST /definitions/:key/generate` and `POST /:key/generate` with `requirePermission('report.configure')`. Only `admin` and `marketing_head` can trigger on-demand reports; `team_lead`, `executive`, and `team_member` receive 403 Forbidden. |
| **A6** | Read-Authoritative LSQ Leads | `apps/api/src/modules/leads/model.js`, `apps/api/src/modules/leads/service.js`, `apps/api/src/modules/leads/lsqAdapter.js` | Preserved LSQ lead data integrity in `resolveDiscrepancy`. Operator resolution updates `syncStatus = 'synced'`, `resolvedAt`, `resolvedById`, and `resolutionNotes` without mutating/overwriting LSQ-owned `profileId` or `leadSource`. Direct mutations via POST/PUT/PATCH/DELETE on `/api/leads` remain strictly blocked with 405 Method Not Allowed. Added `mockLeads` support to `lsqAdapter`. |
| **A7** | Block Deleting Campaigns with Work Items | `apps/api/src/modules/campaigns/service.js` | Added pre-deletion count check `WorkItem.countDocuments({ campaignId: id })`. If child work items exist, throws HTTP 400 with `CAMPAIGN_HAS_WORK_ITEMS` instructing the operator to archive the campaign instead of deleting it. |
| **A8** | Head Cannot Edit Other Heads | `apps/api/src/modules/people/service.js` | *Skipped per plan:* Verified as NOT AN ISSUE in Pass 0 (`apps/api/src/modules/people/service.js:185` already enforces 403). |
| **A9** | Change Password & Rate Limits | `packages/shared/src/index.ts`, `apps/api/src/modules/auth/routes.js`, `controller.js`, `service.js` | Added `changePasswordSchema` to `@mmp/shared` (min 8 chars, 1 uppercase, 1 number). Registered `POST /api/auth/change-password` with bcrypt verification and hashing. Added strict rate limiting (5 req / 15m) to `POST /api/auth/forgot-password`. |
| **A10** | Protect Docs Outside Development | `apps/api/src/modules/docs/routes.js` | Updated Swagger/OpenAPI guard from `env.NODE_ENV === 'production'` to `env.NODE_ENV !== 'development'`, requiring authentication and `settings.manage` (Admin only) in staging and test environments. |
| **A11** | Access Request Alert Dispatch | `apps/api/src/modules/access/service.js` | *Skipped per plan:* Verified as NOT AN ISSUE in Pass 0 (already notifies all active admins via deduplicated Set). |
| **B10** | WhatsApp Fallback Campaign Target | `apps/api/src/modules/leads/service.js` | In `createWhatsAppInboundTask`, dynamically queries active `MonthlyTarget` for the lead's profile (or current month) and attaches `targetId: target._id` during fallback campaign creation, ensuring Mongoose validation succeeds. |
| **D8** | LSQ Environment Configuration | `apps/api/src/config/env.js`, `apps/api/.env.example` | Added `LSQ_ACCESS_KEY`, `LSQ_SECRET_KEY`, `LSQ_HOST_URL`, and `LSQ_MOCK_MODE` to `envSchema` and documented in `.env.example`. |

---

### 3. Verification & Acceptance Results

- **Acceptance Criterion ("Done when"):**
  1. *The app refreshes silently after the token expires:* Verified via `apps/web/src/lib/api.ts` refresh mutex and retry queue on 401.
  2. *Unauthenticated sockets are rejected:* Verified via `apps/api/test/pass1_session_security.test.js` (unauthenticated and bad tokens receive Error in middleware).
  3. *A team lead gets 403 on Generate Now:* Verified on `POST /api/reports/definitions/:key/generate` (Admin/Head: 200; Team Lead/Executive/Member: 403).
  4. *No route can edit a lead:* Verified on `/api/leads` (405 on POST/PUT/PATCH/DELETE) and `/api/leads/datacenter/:id/resolve` (LSQ `leadSource` and `profileId` are strictly immutable).
  5. *Deleting a campaign with work items is refused:* Verified via HTTP 400 `CAMPAIGN_HAS_WORK_ITEMS` on `/api/campaigns/:id`.
  6. *The credentials file is out of git:* Verified via `git rm --cached docs/USERS_AND_PASSWORDS.md` and `.gitignore` update.
  7. *The WhatsApp task never creates a campaign without a target:* Verified via Mongoose schema validation with dynamically attached `MonthlyTarget` `targetId`.

- **Test Suite Results:**
  - Dedicated Pass 1 Suite: `npx vitest run test/pass1_session_security.test.js` $\rightarrow$ **19/19 tests passed** covering all 5 roles.
  - Complete API Test Suite: `npm test` $\rightarrow$ **16 test files passed, 231 tests passed** (0 failures).
  - Web App Tests: `npm test` in `apps/web` $\rightarrow$ **1 test passed**.
  - Typecheck: `npm run typecheck` across all workspaces $\rightarrow$ **0 errors**.
  - Code Style: Formatted with Prettier across all modified modules.

---

### 4. Manual Verification Script for Pass 1 (from Section 6)

| Role | Manual Checks to Perform | Expected Outcome |
| :--- | :--- | :--- |
| **Admin** | 1. Stay signed in past 15 minutes; trigger background data fetch.<br>2. Try connecting socket with invalid token.<br>3. Open Reports $\rightarrow$ click "Generate Now".<br>4. Attempt to delete a campaign that has deliverables.<br>5. Delete an empty campaign.<br>6. Change password via account settings. | 1. Session silently refreshes without prompting for login.<br>2. Socket connection is refused.<br>3. Report generates and preview displays successfully.<br>4. Action refused with notice to archive the campaign.<br>5. Campaign successfully deleted.<br>6. Password updated and login works with new password. |
| **Marketing Head** | 1. Open Reports $\rightarrow$ click "Generate Now".<br>2. In Data Center, click Resolve on a discrepancy item.<br>3. Verify lead record in database after resolution.<br>4. Attempt to delete a campaign with linked work items.<br>5. Change password. | 1. Report generates (200).<br>2. Discrepancy resolves to synced.<br>3. Lead's original LSQ leadSource and profileId remain intact.<br>4. Blocked with 400 error.<br>5. Password changed successfully. |
| **Executive** | 1. Open Reports view.<br>2. Attempt direct POST to `/api/reports/definitions/:key/generate`.<br>3. Attempt direct DELETE to `/api/campaigns/:id`.<br>4. Stay signed in past 15 minutes. | 1. "Generate Now" button is hidden.<br>2. API returns 403 Forbidden.<br>3. API returns 403 Forbidden.<br>4. Session maintained silently. |
| **Team Lead** | 1. Open Reports view.<br>2. Attempt direct POST to `/api/reports/definitions/:key/generate`.<br>3. Attempt deleting a campaign with linked work items.<br>4. Change password with weak password (missing number/uppercase).<br>5. Change password with valid password. | 1. "Generate Now" button is hidden.<br>2. API returns 403 Forbidden.<br>3. Action blocked with 400.<br>4. Refused with validation error.<br>5. Successfully changed. |
| **Team Member** | 1. Attempt direct POST/PUT/PATCH on `/api/leads`.<br>2. Attempt direct POST on report generate endpoints.<br>3. Change password with wrong current password.<br>4. Change password with correct credentials.<br>5. Stay signed in past 15 minutes on My Work. | 1. API returns 405 Method Not Allowed.<br>2. API returns 403 Forbidden.<br>3. Refused: "Current password is incorrect".<br>4. Successfully changed.<br>5. Session refreshed silently in background. |
| **Everyone** | 1. Reset password request on `/login` ("Forgot password?").<br>2. Send 6 forgot password requests within 15 minutes. | 1. Reset link dispatched.<br>2. Rate limit exceeded (429/RATE_LIMIT_EXCEEDED). |

---

## Scope Reset R1: Complete Removal of Leads, Campaigns, and Monthly Targets (Status: COMPLETE)

### 1. Executive Summary
Scope Reset R1 decisively cleans the HACA Marketing OS codebase of all commercial lead management, CRM synchronization (LSQ), campaign budgeting/spend, and monthly revenue/lead targets, refocusing the system strictly on **Work and Team management for HACA only**.

All associated backend modules, database models, API routes, scheduled jobs, report definitions, permissions, frontend pages, navigation links, filters, and environment variables were deleted or refactored. Work items are decoupled from campaigns and now function autonomously under the single-brand HACA profile (`profileId: 'haca'`).

---

### 2. Precondition & Post-Reset Quality Baseline

| Verification Dimension | Precondition Baseline | Post-Reset R1 Result | Status |
| :--- | :--- | :--- | :--- |
| **API Test Suites** | 16 test files (231 tests passing) | **14 test files (193 tests passing)** | **PASSED (100%)** |
| **Frontend Web Tests** | 1 test file (1 test passing) | **1 test file (1 test passing)** | **PASSED (100%)** |
| **Typecheck** (`npm run typecheck`) | 0 errors across all workspaces | **0 errors across all workspaces** | **PASSED** |
| **Web Production Build** | Clean build via Vite | **Clean build in 10.73s (0 errors)** | **PASSED** |
| **Shared Package Build** | Clean build via tsup | **Clean build via tsup** | **PASSED** |

---

### 3. Detailed Task Implementation & Changes

#### Task 1: Complete Deletion of Retired Domains
1. **Backend Modules Deleted:**
   - [apps/api/src/modules/campaigns/](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/campaigns/): Entire module deleted (`model.js`, `controller.js`, `routes.js`, `service.js`).
   - [apps/api/src/modules/targets/](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/targets/): Entire module deleted (`model.js`, `controller.js`, `routes.js`, `service.js`, `seed.js`).
   - [apps/api/src/modules/leads/](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/leads/): Entire module deleted (`model.js`, `controller.js`, `routes.js`, `service.js`, `lsqAdapter.js`, `dataIssue.model.js`, `syncRun.model.js`).
2. **Server Route Mounts Unregistered:**
   - In [apps/api/src/server.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/server.js), removed route handlers for `/api/campaigns`, `/api/targets`, `/api/leads`, and `/api/datacenter`.
3. **Jobs & Automation Pruned:**
   - In [apps/api/src/modules/jobs/processors.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/jobs/processors.js), deleted `runLsqSyncJob` BullMQ processor.
   - In [apps/api/src/modules/automation/runner.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/automation/runner.js), deleted the `lsq_live_sync` rule. Six core rules remain active.
4. **Reports Pruned:**
   - In [apps/api/src/modules/reports/service.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/reports/service.js), deleted definitions for `lead_funnel_cpl` and `campaign_deepdive`. Four canonical reports remain: `weekly_marketing`, `monthly_scorecard`, `creative_production`, `team_performance`.
   - In `monthly_scorecard`, replaced campaign comparison metrics with Content Piece throughput and turnaround metrics.
   - In [apps/api/src/modules/reports/dashboard.service.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/reports/dashboard.service.js), removed target KPI calculations, campaign progress, and lead funnel queries.
5. **Shared Package (`packages/shared`):**
   - In [packages/shared/src/index.ts](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/packages/shared/src/index.ts), removed 5 permission keys: `target.manage`, `target.view`, `campaign.manage`, `lead.view`, `datacenter.view`.
   - Removed enums: `CAMPAIGN_STATUSES`, `GOAL_TYPES`, `EXPECTED_OUTCOMES`, `LEAD_SOURCES`, `FUNNEL_STAGES`, `PAID_AD_LEAD_SOURCES`.
   - Removed Zod schemas: `campaignSchema`, `campaignCreateSchema`, `campaignUpdateSchema`, `monthlyTargetSchema`, `leadQuerySchema`.
6. **Frontend Views Deleted (`apps/web`):**
   - Deleted [apps/web/src/pages/campaigns/](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/pages/campaigns/) (`CampaignsPage.tsx`, `CampaignDetailPage.tsx`).
   - Deleted [apps/web/src/pages/leads/](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/pages/leads/) (`LeadFunnelPage.tsx`).
   - Deleted [apps/web/src/pages/datacenter/](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/pages/datacenter/) (`DataCenterPage.tsx`).
   - In [apps/web/src/App.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/App.tsx), removed route declarations for `/campaigns`, `/campaigns/:id`, `/leads`, and `/data-center`.
   - In [apps/web/src/components/Layout.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/components/Layout.tsx), removed sidebar and navigation menu items for Campaigns, Leads, and Data Center.
   - In [apps/web/src/pages/dashboard/TeamDashboardPage.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/pages/dashboard/TeamDashboardPage.tsx), removed the Monthly Targets strip, Campaign progress bar, and Lead Funnel conversion cards.
7. **Environment Configuration:**
   - Removed `LSQ_*` variables (`LSQ_ACCESS_KEY`, `LSQ_SECRET_KEY`, `LSQ_HOST_URL`, `LSQ_MOCK_MODE`) from [apps/api/src/config/env.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/config/env.js), [apps/api/.env.example](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/.env.example), and [/.env.example](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/.env.example).

#### Task 2: WorkItem Decoupling & ContentPiece Alignment
- Removed fields `campaignId`, `relatedOKR`, `relatedTarget`, `leadsGenerated`, `qualifiedLeads` from:
  - [apps/api/src/modules/workItems/model.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/workItems/model.js) (schema & indexes)
  - [apps/api/src/modules/workItems/service.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/workItems/service.js)
  - [apps/api/src/modules/workItems/transition.service.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/workItems/transition.service.js) (removed populate calls)
  - [apps/api/src/modules/feedback/service.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/feedback/service.js) (removed populate calls)
  - [apps/api/src/modules/blockers/service.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/blockers/service.js) (removed select & populate calls)
  - [apps/api/src/modules/reports/controller.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/reports/controller.js) (removed filter parsing)
  - [apps/web/src/pages/work/WorkDetailPage.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/pages/work/WorkDetailPage.tsx) (replaced Campaign banner with Brand & Production Scope banner)
  - [apps/web/src/pages/work/WorkListPage.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/pages/work/WorkListPage.tsx) (removed from table columns, grid, filters, and creation modal)
- **Grouping Replacements:**
  - Where work was previously grouped or organized by campaign, items are grouped by Content Piece or production month.
  - No unreplaced groupings remain.
- **Single-Brand Mode:**
  - Preserved internal `profileId` pointing to HACA organization. Hidden brand switcher from [apps/web/src/components/GlobalFilterBar.tsx](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/components/GlobalFilterBar.tsx).

#### Task 3: Permission Gating Realignment
- Replaced permission check on Report "Generate Now" (`POST /api/reports/definitions/:key/generate` and `POST /api/reports/:key/generate`) with `requirePermission('report.configure')` (Admin and Marketing Head only). Team Lead and Executive receive 403 Forbidden.

#### Task 4: Performance Dimension Rebalancing
- In [apps/api/src/modules/people/metrics.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/people/metrics.js), removed Dimension 5 (Business Impact).
- Rebalanced the performance evaluation model across 4 operational dimensions (25% weight each):
  1. **Output (25%):** Completion rate, volume, and velocity.
  2. **Efficiency (25%):** Turnaround time vs allocated estimate.
  3. **Quality (25%):** First-time approval rate and low revision loops.
  4. **Collaboration (25%):** Prompt blocker resolution and peer dependency support.

---

## Scope Reset R2: Role Model Change (Status: COMPLETE)

### 1. Executive Summary
Scope Reset R2 transitioned HACA Marketing OS from the legacy multi-tier structure to a lean 5-role model tailored specifically for HACA:
- **`admin`**: Full platform authority with dynamically derived permissions.
- **`creative_head`**: Direct review approvals, creative governance, and team assignment.
- **`executive`**: Read-only stakeholder view across the entire operating footprint.
- **`sm_manager`**: Social media calendar planning, work item generation, and workload tracking.
- **`team_member`**: Individual contributor with self-scoped view of assignments and deliverables.

All legacy role keys (`marketing_head`, `team_lead`) have been retired across the entire stack (`packages/shared`, Mongoose schemas, Zod validation, CASL policies, route handlers, socket rooms, notifications, email templates, seeds, scripts, tests, and frontend UI). Legacy aliases and job-role based approval overrides were eliminated.

---

### 2. Architecture & Implementation Breakdown

#### A. Canonical Roles & Permissions (`packages/shared`)
- **Canonical Roles (`ROLE_KEYS`):**
  ```ts
  export const ROLE_KEYS = [
    'admin',
    'creative_head',
    'executive',
    'sm_manager',
    'team_member',
  ] as const;
  ```
- **Labels (`ROLE_LABELS`):**
  - `'creative_head'`: `'Creative Head'`
  - `'sm_manager'`: `'SM Manager'`
  - `'admin'`: `'Administrator'`
  - `'executive'`: `'Executive'`
  - `'team_member'`: `'Team Member'`
- **Permission Matrix (`ROLE_PERMISSIONS`):**
  - Added `calendar.plan` (held by `sm_manager` and `admin`).
  - Added `calendar.approve` (held by `creative_head` and `admin`).
  - Removed obsolete `reference.manage`.
  - `admin` permissions are dynamically derived from all canonical keys (`[...PERMISSION_KEYS]`).
  - `creative_head`: `portal.view`, `people.view`, `people.assign`, `calendar.approve`, `feedback.give`, `feedback.respond`, `revision.classify`, `assignment.override`, `work.update.own`, `analytics.team`, `report.view`, `report.configure`, `automation.manage`.
  - `sm_manager`: `calendar.plan`, `work.create`, `assignment.override`, `work.update.own`, `feedback.respond`, `analytics.team`, `report.view`, `people.view`.
  - `executive`: `portal.view`, `people.view`, `analytics.team`, `report.view` (read-only).
  - `team_member`: `work.update.own`, `work.request`, `feedback.respond`.
  - Read routes universally permit access if caller holds `portal.view`.
- **Requestable Roles (`REQUESTABLE_ROLES`):**
  - Public access request form permits only `['team_member', 'sm_manager']`.

#### B. Scope Resolution (`apps/api/src/lib/scope.js`)
- `admin`, `creative_head`, `executive`, `sm_manager`:
  - `scopeType: 'all'`, `allowedPersonIds: null`, brand scoped strictly to HACA single brand (`brand_haca`).
- `team_member`:
  - `scopeType: 'self'`, `allowedPersonIds: [userId]`, brand scoped strictly to HACA single brand (`brand_haca`).
- Decoupled `reportsToIds` from scope resolution (stored in database for organizational hierarchy, but ignored during scope filtering).

#### C. Core Business Rules & Guardrails
1. **Review Stage Approvals:**
   - Restricted strictly to `creative_head` and `admin` (`apps/api/src/modules/workItems/transition.service.js` and `apps/web/src/pages/work/WorkDetailPage.tsx`).
   - `sm_manager` and deliverable owners are blocked from approving review stages.
   - Removed legacy `APPROVER_JOB_ROLES` ("Creative Manager (TL)") fallback rule.
2. **Account Protection & People Ops Editing:**
   - Elevated roles (`admin`, `creative_head`, `executive`) can only be granted by `admin` (`apps/api/src/modules/access/service.js`).
   - `creative_head` can only edit operational fields (`departmentId`, `jobRole`, `workPreferences`, `weeklyCapacityHours`) of `sm_manager` and `team_member` (`apps/api/src/modules/people/service.js`).
   - Attempts by `creative_head` to edit `admin`, `executive`, or other `creative_head` accounts return HTTP 403 Forbidden.
   - `executive` accounts have email masked (`••••••••••••`) and edit buttons hidden in UI (`apps/web/src/pages/admin/UsersPage.tsx`).
   - `reportsToIds` field hidden from user creation/edit modals and access request review modal.
3. **Calendar Planning vs Approval:**
   - `POST /api/calendar` protected by `requirePermission('calendar.plan')`.
   - `POST /api/calendar/approve` protected by `requirePermission('calendar.approve')`.
4. **Work Creation Guard:**
   - `POST /api/work` protected strictly by `requirePermission('work.create')` (`admin` and `sm_manager`). Team members cannot create unapproved work items directly.

#### D. Frontend Navigation & Landing (`apps/web`)
- **Dynamic Landing Route:**
  - `team_member` lands directly on `/my-work`.
  - `admin`, `creative_head`, `executive`, `sm_manager` land on `/dashboard`.
- **Strict Role Menus (`apps/web/src/components/Layout.tsx`):**
  - **`admin`:** Dashboard, Calendar, Work, Feedback and Revisions, Team Workload, Issues and Blockers, Reports and Automation, People, Access Requests (with live count badge), My Account.
  - **`creative_head`:** Same without Access Requests; People view restricted to operational fields.
  - **`executive`:** Same as creative_head, read-only mode, People emails masked.
  - **`sm_manager`:** Dashboard, Calendar, Work, Team Workload, Issues and Blockers, Reports (view), My Account.
  - **`team_member`:** My Work, Todo, Calendar (own items), Notifications, My Account.
- **Access Requests Badge:**
  - Live React Query fetches pending count for `admin` only (`GET /api/admin/access-requests?status=pending`).

#### E. Migration Script (`scripts/migrate-roles-r2.js`)
- **Safety First:** Runs in dry-run mode by default; zero database writes without explicit confirmation flags.
- **Production Guard:** Requires `--confirm` AND matching `--db-name=<exact name>`.
- **Pre-Migration Backup:** Automatically creates a timestamped MongoDB collection snapshot `users_backup_r2_<timestamp>` before mutating records.
- **Rollback Engine:** Supports full data restoration from any backup collection with `--rollback --backup-col=<backupColName>`.
- **Idempotent:** Safe to run repeatedly; unmigrated records are skipped on subsequent runs.
- **Token Invalidation:** Invalidates all active refresh tokens (`$unset: { refreshTokenHash: 1 }`) upon migration to force users to re-authenticate with updated permission sets.
- **Overrides Support:** Evaluates `scripts/migration-overrides.json` to allow manual role assignments to take precedence.

#### F. Seeds & Demo Data
- Updated [scripts/demo-users.json](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/scripts/demo-users.json):
  - 1 System Admin (`admin`)
  - 1 Creative Head (`creative_head`)
  - 1 SM Manager (`sm_manager`)
  - 1 Executive (`executive`)
  - 6 Team Members (`team_member`) across Graphic Design, Video Production, and Content.
- Updated [scripts/seed-demo-users.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/scripts/seed-demo-users.js) and [scripts/reset-data-marketing-os.js](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/scripts/reset-data-marketing-os.js).

---

### 3. Verification & Test Accounting

#### Full Test Suite Status: 15 / 15 Files Passed, 242 / 242 Tests Passed (0 Failures)

| Test Suite | Tests | Verification Area |
| :--- | :--- | :--- |
| **`test/scope_reset_r2.test.js` (NEW)** | **49** | **Complete R2 specification verification suite (canonical keys, labels, permissions matrix, route walk per role, approver guards, people ops edits, access requests, migration dry-run, mutation, rollback).** |
| `test/permissions.test.js` | 9 | Shared permission keys, role labels, and role mapping. |
| `test/request_access_schema.test.js` | 7 | Zod validation for requestable roles (`team_member`, `sm_manager`). |
| `test/reset_and_demo_seed.test.js` | 9 | Seeding and cleanup of 5 canonical demo user roles. |
| `test/pass1_session_security.test.js` | 12 | Password changes and auth guards across the 5 canonical roles. |
| `test/automation_and_reports.test.js` | 12 | Escalations and reports directed to `creative_head` and `sm_manager`. |
| `test/executive_role.test.js` | 46 | Universal read-only visibility, masked contacts, and write blocking. |
| `test/feedback_and_blockers.test.js` | 14 | Creative Head feedback approvals, team blocker reporting. |
| `test/assignment_and_workload.test.js` | 16 | Workload distribution and capacity calculations. |
| `test/dashboard_and_filters.test.js` | 3 | Dashboard widgets and access controls per role. |
| `test/work_items_and_transitions.test.js` | 24 | Deliverable lifecycles, approval guards, and transition policies. |
| `test/phase1_scoping.test.js` | 14 | Scoping boundaries for all 5 canonical roles. |
| `test/access_service_and_api.test.js` | 9 | Access request workflows for team member and SM manager candidates. |
| `test/scope_reset_r1.test.js` | 17 | Scope Reset R1 boundary and dry-run verification. |
| `test/status.test.js` | 1 | Health check probe. |

#### Frontend Verification
- `npm run typecheck --workspaces`: **0 errors**.
- `npm run build --workspaces`: Built `@mmp/shared` (tsup) and `@mmp/web` (Vite) successfully in 11.41s.
- `apps/web` smoke tests: **Passed**.

---

### 4. Migration Dry-Run Audit & Commands

#### Dry-Run Execution Log (`node scripts/migrate-roles-r2.js`)
```
================================================================
🛡️  MARKETING OS ROLE MIGRATION R2: DRY RUN (Zero changes made)
================================================================
Connected Database: marketing_portal
Total Users Found:  5
Users to Migrate:   2
Users Unchanged:    3
Overrides Applied:  0

--- USER ROLE MIGRATION PLAN ---
┌─────────┬────────────────────────┬──────────────────────────┬────────────────────────┬──────────────────┬─────────────────┬──────────────┬──────────┐
│ (index) │ Name                   │ Email                    │ Job Role               │ Old Role         │ New Role        │ Status       │ Override │
├─────────┼────────────────────────┼──────────────────────────┼────────────────────────┼──────────────────┼─────────────────┼──────────────┼──────────┤
│ 0       │ 'System Administrator' │ 'admin@hacaforge.com'    │ 'None'                 │ 'admin'          │ 'admin'         │ '✓ KEEP'     │ 'NO'     │
│ 1       │ 'Marketing Head'       │ 'head1212@gmail.com'     │ 'Developer'            │ 'marketing_head' │ 'creative_head' │ '🔄 MIGRATE' │ 'NO'     │
│ 2       │ 'MUBASHIR'             │ 'techlead1212@gmail.com' │ 'Developer'            │ 'team_lead'      │ 'sm_manager'    │ '🔄 MIGRATE' │ 'NO'     │
│ 3       │ 'MUBASHIR'             │ 'worker1212@gmail.com'   │ 'Social Media Manager' │ 'team_member'    │ 'team_member'   │ '✓ KEEP'     │ 'NO'     │
│ 4       │ 'sm manager'           │ 'sm1212@gmail.com'       │ 'Social Media Manager' │ 'team_member'    │ 'team_member'   │ '✓ KEEP'     │ 'NO'     │
└─────────┴────────────────────────┴──────────────────────────┴────────────────────────┴──────────────────┴─────────────────┴──────────────┴──────────┘

ℹ️  To execute the live migration, run with --confirm and --db-name:
   node scripts/migrate-roles-r2.js --confirm --db-name=marketing_portal
================================================================
```

#### Exact Command for Live Execution
To execute the live migration against the local database:
```bash
node scripts/migrate-roles-r2.js --confirm --db-name=marketing_portal
```

To rollback at any time:
```bash
node scripts/migrate-roles-r2.js --rollback --backup-col=<backup_collection_name>
```

---

## Scope Reset R3: Calendar Plans, Creative Head Approval & Intelligent Assignment (Status: COMPLETE)

### 1. Executive Summary
Scope Reset R3 delivers the complete end-to-end content marketing lifecycle for HACA Marketing OS:
- **Campaign Planning & Grid Creation:** Monthly and project-based `CalendarPlan` generation, Excel/CSV spreadsheet template generation and validation preview, grid-based row authoring, and state machine transitions.
- **Creative Head Approval & Revision Cycle:** Selective row-by-row approvals, change request feedback with comments per row, and re-submission workflows without mutating already-approved deliverables.
- **Automated Stage Generation:** Stages (`Content`, `Script`, `Shoot`, `Design`, `Edit`, `Post`) generated **only upon row approval**, computing backward due-date offsets from the final posting date ($F$). Stage 1 unlocks immediately while subsequent stages remain securely locked.
- **Intelligent Assignment Engine:** Multi-factor assignment matching `Person.workPreferences[]`, strictly excluding overloaded members ($\ge 85\%$ capacity), prioritizing lowest workload $\rightarrow$ fewest revisions $\rightarrow$ earliest bandwidth, with cross-department assignment, override audit trails, and "Needs owner" support.
- **Stage Hand-offs & Publishing:** Self-approval guards (only Creative Head and Admin can approve review stages), "Done and forward" for non-review stages (`Shoot`), next stage auto-unlocking with real-time notifications, and Live Publishing calculating turnaround days.
- **Cross-Role Frontend Experience:**
  - `/calendar` with 3 tabs: **Month** (deadlines), **Plans** (grid authoring, Excel upload/preview, review mode), **Tracker** (sheet-like pipeline tracker, status chips, assignment modal).
  - `/feedback` with 2 tabs: **Plans waiting for approval** and **Stages waiting for approval** (sorted oldest first).
  - `/my-work`: Personal worker portal with stage cards, previous stage outputs, deliverable link inputs, Submit / Done buttons, and greyed-out upcoming locked stages.
  - Role scoping: Executive read-only mode with zero mutation controls; Team Member receives 403 on management endpoints and accesses personal work items via My Work.

---

### 2. Models & Architecture

#### Core Mongoose Models
1. **`CalendarPlan` (`apps/api/src/modules/calendar/plan.model.js`):**
   - Fields: `code`, `title`, `kind` (`monthly` | `project`), `periodStart`, `periodEnd`, `createdById`, `submittedAt`, `approvedById`, `approvedAt`, `comment`.
   - Dynamic Status Derivation: `Draft`, `Submitted`, `Changes requested`, `Approved`, `Approved with pending rows`.
2. **`ContentPiece` (`apps/api/src/modules/calendar/contentPiece.model.js`):**
   - Fields: `planId`, `postingDate` ($F$), `topic`, `contentType`, `needsScript`, `needsShoot`, `contentLink`, `remarks`, `rowStatus` (`draft`, `submitted`, `changes_requested`, `approved`), `reviewComment`, `pipeline`, `hasPostStage`, `stagesGenerated`, `publishedAt`, `liveUrl`, `turnaroundDays`.
3. **`WorkItem` Updates (`apps/api/src/modules/workItems/model.js`):**
   - Fields: `calendarPlanId`, `isLocked`, `dueDate`.

#### Shared Configuration (`packages/shared/src/index.ts`)
- **Pipelines:** `design` (Design $\rightarrow$ Post), `reel_a` (Content $\rightarrow$ Shoot $\rightarrow$ Edit $\rightarrow$ Post), `reel_b` (Shoot $\rightarrow$ Edit $\rightarrow$ Post), `reel_c` (Edit $\rightarrow$ Post).
- **Stage Definitions:** Review (`Content`, `Script`, `Design`, `Edit`), Non-Review (`Shoot`), Post (`Post`).
- **Due-Date Offsets:** $F-10, F-7, F-6, F-5, F-4, F-3, F-2, F$.
- **Display Words:** `Done`, `Approved`, `Revision requested`.

---

### 3. API Endpoints & Workflows

| Method | Endpoint | Permissions / Role | Workflow / Capability |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/calendar-plans` | `admin`, `creative_head`, `sm_manager`, `executive` | List calendar plans with derived statuses and row counts. (Team Member: HTTP 403). |
| `POST` | `/api/calendar-plans` | `calendar.plan` (`sm_manager`, `admin`) | Create new monthly/project plan with unique code (`PLAN-YYYY-MM-001`). |
| `GET` | `/api/calendar-plans/template` | All authenticated | Downloads canonical Excel import template with data validation and column formatting. |
| `POST` | `/api/calendar-plans/preview` | `calendar.plan` (`sm_manager`, `admin`) | Validates uploaded Excel/CSV file without persisting: checks bad dates, past dates, unknown types, duplicates, and non-reel flags. |
| `POST` | `/api/calendar-plans/commit` | `calendar.plan` (`sm_manager`, `admin`) | Commits validated rows as `Draft` into target calendar plan. |
| `POST` | `/api/calendar-plans/:id/submit` | `calendar.plan` (`sm_manager`, `admin`) | Transitions all Draft / Changes requested rows to `Submitted` and notifies all Creative Heads. |
| `POST` | `/api/calendar-plans/:id/review` | `calendar.approve` (`creative_head`, `admin`) | Creative Head review: `approve_all`, `approve_selected`, or `request_changes` with per-row comments. Row approval triggers stage generation. |
| `POST` | `/api/calendar-plans/:id/rows` | `calendar.plan` (`sm_manager`, `admin`) | Adds new rows in a grid. New rows start as `Draft`. |
| `PATCH` | `/api/calendar-plans/:id/rows/:rowId` | `calendar.plan` (`sm_manager`, `admin`) | Edits row only while `Draft` or `Changes requested`. Approved rows cannot be directly modified. |
| `GET` | `/api/content-pieces` | `admin`, `creative_head`, `sm_manager`, `executive` | Content tracker sheet view with multi-stage status, dates, owners, approval, and turnaround. |
| `POST` | `/api/content-pieces/recommend-owners` | `assignment.override` (`sm_manager`, `creative_head`, `admin`) | Algorithmic owner recommendations: matches `workPreferences`, strictly excludes overloaded members ($\ge 85\%$), lowest workload $\rightarrow$ fewest revisions $\rightarrow$ earliest free bandwidth. |
| `POST` | `/api/content-pieces/assign` | `assignment.override` (`sm_manager`, `creative_head`, `admin`) | Assigns stage owners across departments, logging override reasons when deviating from recommendations. |
| `POST` | `/api/work/:id/transition` | Transition Service | Hand-offs: Review stages submitted to `Feedback` (Creative Head/Admin approval only, self-approval blocked); `Shoot` marked `Approved` via "Done and forward"; `Post` published with live URL; next stage auto-unlocks with real-time notifications. |
| `PATCH` | `/api/content-pieces/:id/reschedule` | `assignment.override` (`sm_manager`, `creative_head`, `admin`) | Reschedules final date with option to shift unstarted stage deadlines backward from new date. |
| `PATCH` | `/api/content-pieces/:id/stages/:stageId/skip` | `assignment.override` (`sm_manager`, `creative_head`, `admin`) | Skips or restores stage before it starts. |

---

### 4. Verification & Test Accounting

#### Full Backend Test Suite: 16 / 16 Files Passed, 265 / 265 Tests Passed (0 Failures)

| Test Suite | Tests | Verification Area |
| :--- | :--- | :--- |
| **`test/scope_reset_r3.test.js` (NEW)** | **23** | **Complete R3 specification verification suite: Excel template generation, validation preview (bad dates, past dates, duplicates, unknown types, non-reel flags), plan status derivation, row editing guards, submission, Creative Head review (approve all, approve selected, request changes), automated stage generation on row approval, backward due-date offsets, stage locking/unlocking, transition hand-offs, self-approval guards, owner recommendations, overload exclusion (&ge;85%), override logging, cross-department assignment, final date rescheduling, stage skipping, and per-role scoping (executive read-only, team_member 403).** |
| `test/scope_reset_r2.test.js` | 49 | Canonical 5-role model verification suite. |
| `test/work_items_and_transitions.test.js` | 24 | Transition policies, deliverable approvals, and blocker tracking. |
| `test/scope_reset_r1.test.js` | 17 | Scope Reset R1 boundary and non-destructive data invariants. |
| `test/assignment_and_workload.test.js` | 16 | Workload distribution and capacity calculations. |
| `test/executive_role.test.js` | 46 | Executive read-only permissions and masked contact guards. |
| `test/feedback_and_blockers.test.js` | 14 | Creative Head feedback approvals, team blocker reporting. |
| `test/pass1_session_security.test.js` | 12 | Password changes and auth guards across canonical roles. |
| `test/automation_and_reports.test.js` | 12 | Escalations and reports directed to `creative_head` and `sm_manager`. |
| `test/access_service_and_api.test.js` | 9 | Access request workflows for candidates. |
| `test/permissions.test.js` | 9 | Shared permission keys, role labels, and role mapping. |
| `test/reset_and_demo_seed.test.js` | 9 | Demo user seeding and reset guards. |
| `test/request_access_schema.test.js` | 7 | Zod validation for requestable roles. |
| `test/phase1_scoping.test.js` | 14 | Scoping boundaries for all roles. |
| `test/dashboard_and_filters.test.js` | 3 | Dashboard widgets and access controls per role. |
| `test/status.test.js` | 1 | Health check probe. |

#### Full Frontend Verification:
- **`src/pages/calendar/CalendarTabs.test.tsx` (NEW):** **4 / 4 tests passed** (renders 3 tabs, SM Manager controls, Executive read-only mode, and Team Member notice).
- **TypeScript Typecheck (`npm run typecheck`):** **0 errors** across monorepo.
- **Production Build (`npm run build`):** Built `@mmp/shared` (tsup) and `@mmp/web` (Vite) successfully in 10.26s.
- **Web App smoke tests (`src/App.test.tsx`):** **Passed**.

---

## Scope Reset R4: Dashboard, Reports, Automation, Journey Tests & Final Cleanup (Status: COMPLETE)

### 1. Executive Summary
Scope Reset R4 delivers the final operational polish, executive governance, scheduled automations, reporting digests, session security, and end-to-end multi-role test verifications for HACA Marketing OS:
- **Operational Dashboard:** 8 distinct operational sections tailored for `admin`, `creative_head`, `sm_manager`, and `executive` (with `team_member` redirected immediately to `/my-work`): Month plan status, KPI strip (7 filtered metrics), Today's priorities, Production stats & trend, Team workload (real uncapped percentage), Issues and blockers, Waiting for approval (primary review block for Creative Head), and Recent activity. Strictly zero commercial targets, funnels, or campaigns.
- **Four Canonical Reports:** Four saved report definitions (`weekly_marketing`, `monthly_scorecard`, `creative_production`, `team_performance`). "Generate Now" is restricted to `creative_head` and `admin`, while `executive` and `sm_manager` have read-only visibility. Report recipients support both user ObjectIds and external email addresses.
- **Six Scheduled Automation Rules:** Six active worker rules (`month_end_report`, `overdue_escalation`, `todo_escalation`, `blocker_dependency_alert`, `revision_pattern_flag`, `weekly_report`) scheduled via BullMQ and in-memory intervals. Each rule tracks `lastRunAt` and `lastRunStatus` with manual trigger support.
- **Team Workload Capacity:** Real uncapped percentages (e.g. `125% Workload`) displayed with visually capped progress bars and 3 capacity bands ($<65\%$ healthy, $65-85\%$ high, $>85\%$ overloaded).
- **Session & Socket Security:** Shared refresh-and-retry mutex in `apps/web/src/lib/api.ts` so users stay signed in silently across token expiries. Socket.io handshake authentication guard rejecting unauthenticated or corrupted JWT tokens.
- **Final Cleanup & Zero Credentials:** Legacy calendar, legacy admin user routes, one-off scripts, stale env variables, and unused dependencies permanently removed. Zero credentials in repository or docs; demo passwords loaded exclusively from environment variables (`ADMIN_SEED_PASSWORD`, `DEMO_SEED_PASSWORD`).
- **End-to-End Role Journeys & Route-Table Walk:** Verified in `test/scope_reset_r4.test.js` covering the full lifecycle (Admin approves user $\rightarrow$ SM Manager uploads and submits plan $\rightarrow$ Creative Head approves plan $\rightarrow$ SM Manager confirms assignments $\rightarrow$ Worker submits stage deliverable $\rightarrow$ Creative Head approves deliverable $\rightarrow$ Posting owner publishes live URL $\rightarrow$ Executive views read-only), and a complete route-table walk across all 5 canonical roles.

---

### 2. Detailed Task Implementation & Verification

#### Task 1: Dashboard Sections & Role Redirection
- **Route Access:** `admin`, `creative_head`, `sm_manager`, `executive` access `/dashboard`. `team_member` is immediately redirected to `/my-work` (`replace: true`).
- **8 Operational Sections:**
  1. *Month Plan Status:* Derived plan status, planned pieces vs published pieces for the current month.
  2. *KPI Strip:* 7 operational metrics (`planned`, `completed`, `inProgress`, `atRisk`, `blocked`, `pendingApproval`, `overdue`), each hyperlinking to filtered lists.
  3. *Today's Priorities:* High-priority deliverables due today or past due.
  4. *Production Stats & Trend:* 30-day stage throughput velocity and 4-week completion trendline.
  5. *Team Workload:* Department and member workload with capacity band badges.
  6. *Issues & Blockers:* Real-time summary of dependencies and unresolved blockers.
  7. *Waiting for Approval:* Operational review queue for Creative Head showing submitted calendar plans and deliverables pending sign-off.
  8. *Recent Activity:* Real-time audit log of transitions, approvals, submissions, and publications.
- **DOM Verification:** Verified that zero Target, Funnel, Campaign, or Lead elements exist in the DOM.

#### Task 2: Four Canonical Reports & Recipients Management
- **Definitions:**
  - `weekly_marketing`: Weekly Work Report.
  - `monthly_scorecard`: Monthly Performance Scorecard (no targets: planned vs published, on-time rate, revision rate, approval turnaround).
  - `creative_production`: Creative Production Report by department and stage.
  - `team_performance`: Team Performance Digest across 4 dimensions: Output (25%), Efficiency (25%), Quality (25%), Collaboration (25%).
- **Generate Now Guard:** Restricted strictly to callers holding `report.configure` (`admin` and `creative_head`). `executive` and `sm_manager` receive HTTP 403 Forbidden.
- **Recipients Update:** `PATCH /api/reports/definitions/:key` allows updating `recipients` with a blend of user ObjectIds and email addresses (`custom.executive@demo.haca.local`).

#### Task 3: Six Scheduled Automation Rules & Worker Dispatcher
- **Rules Managed:**
  1. `month_end_report`: Compiles monthly scorecard on last day of month.
  2. `overdue_escalation`: Escalates overdue items to owner immediately and to SM Manager after 4 hours.
  3. `todo_escalation`: Daily audit of unstarted high-priority tasks.
  4. `blocker_dependency_alert`: Bi-hourly reminder to blocker dependency owners.
  5. `revision_pattern_flag`: Flags $\ge 4$ revisions to Creative Head; escalates if unclassified $>48\text{ hours}$.
  6. `weekly_report`: Aggregates weekly production velocity.
- **Scheduler:** Automated in `apps/api/src/worker.js` with active/paused toggle via `PATCH /api/automation/rules/:id/toggle` and last run status tracking (`lastRunAt`, `lastRunStatus`).

#### Task 4: Team Workload Real Percentage
- Displays real uncapped percentage (e.g., `125% Workload`), with progress bars visually capped at 100%.
- Capacity bands: $<65\%$ (Healthy), $65-85\%$ (High), $>85\%$ (Overloaded). Overloaded members are strictly excluded from auto-assignment recommendations.

#### Task 5: Final Cleanup & Removal of Unused Code
- Cleaned up legacy calendar module, legacy admin user routes, one-off scripts, stale env variables (`LSQ_*`), and unused dependencies.
- Confirmed zero occurrences of old role names (`marketing_head`, `team_lead`) in active code.
- Removed credentials from docs and git index (`USERS_AND_PASSWORDS.md`); verified passwords ingest only from env (`ADMIN_SEED_PASSWORD`, `DEMO_SEED_PASSWORD`).
- Regenerated `docs/PROJECT_DOCUMENTATION.md` and `PROJECT_DOCUMENTATION.md` directly from the codebase.

#### Task 6: Session & Socket Authentication Security
- **Refresh Mutex:** Centralized `apiFetch` in `apps/web/src/lib/api.ts` transparently catches 401s, executes token refresh, and replays queued requests so users remain logged in.
- **Socket Authentication:** `apps/api/src/server.js` verifies JWT token in Socket.io handshake middleware, rejecting missing or invalid tokens with HTTP 401 error.

#### Task 7: Comprehensive End-to-End Role Journeys & Route-Table Walk
- Verified in `apps/api/test/scope_reset_r4.test.js`:
  - *Step 1:* Admin approves access request for new user and sends activation link.
  - *Step 2:* SM Manager creates and submits monthly calendar plan.
  - *Step 3:* Creative Head reviews and approves plan rows, automatically generating stage work items with backward offsets.
  - *Step 4:* SM Manager confirms stage assignment to worker.
  - *Step 5:* Worker views item on My Work, starts work, and submits deliverable URL for review.
  - *Step 6:* Creative Head reviews and approves deliverable, unlocking next stage.
  - *Step 7:* Posting owner publishes final stage with live URL and calculates turnaround days.
  - *Step 8:* Executive verifies read-only access; all mutation attempts return 403 Forbidden.
- **Route-Table Walk:** Validated against all 5 canonical roles (`admin`, `creative_head`, `sm_manager`, `team_member`, `executive`).
- **UI Tests:** Role views verified in `apps/web/src/pages/dashboard/DashboardRoleViews.test.tsx` and `CalendarTabs.test.tsx`.

---

### 3. Verification & Acceptance Results

#### Full Monorepo Test Summary: 20 Test Suites Passed, 302 Tests Passed (0 Failures)

| Test Suite File | Tests | Status | Verification Scope |
| :--- | :--- | :--- | :--- |
| **`test/scope_reset_r4.test.js` (NEW)** | **26** | **PASSED** | **Full 8-Step Lifecycle Journey across 5 roles, 8 Dashboard Sections, Uncapped Workload Bands, 4 Saved Reports & Recipients, 6 Automation Rules & Dispatcher, Session/Socket Security, Route-Table Walk.** |
| `test/scope_reset_r3.test.js` | 23 | **PASSED** | Calendar plan authoring, Excel template & preview, row approvals, stage generation, backward offsets, stage locking/unlocking, owner recommendations. |
| `test/scope_reset_r2.test.js` | 49 | **PASSED** | Canonical 5-role permissions matrix, role migration dry-run and rollback, access requests. |
| `test/scope_reset_r1.test.js` | 17 | **PASSED** | Clean deletion of leads, campaigns, and monthly targets. |
| `test/executive_role.test.js` | 45 | **PASSED** | Executive read-only permissions and masked contact guards. |
| `test/work_items_and_transitions.test.js` | 23 | **PASSED** | Central state machine, deliverable approvals, and blocker tracking. |
| `test/assignment_and_workload.test.js` | 17 | **PASSED** | Workload distribution and capacity calculations. |
| `test/feedback_and_blockers.test.js` | 15 | **PASSED** | Creative Head feedback approvals, team blocker reporting. |
| `test/pass1_session_security.test.js` | 12 | **PASSED** | Password changes and auth guards across canonical roles. |
| `test/automation_and_reports.test.js` | 12 | **PASSED** | Escalations and reports directed to `creative_head` and `sm_manager`. |
| `test/phase1_scoping.test.js` | 14 | **PASSED** | Scoping boundaries for all roles. |
| `test/access_service_and_api.test.js` | 9 | **PASSED** | Access request workflows for candidates. |
| `test/reset_and_demo_seed.test.js` | 9 | **PASSED** | Demo user seeding and reset guards. |
| `test/permissions.test.js` | 9 | **PASSED** | Shared permission keys, role labels, and role mapping. |
| `test/request_access_schema.test.js` | 7 | **PASSED** | Zod validation for requestable roles. |
| `test/dashboard_and_filters.test.js` | 3 | **PASSED** | Dashboard widgets and access controls per role. |
| `test/status.test.js` | 1 | **PASSED** | Health check probe. |
| **`DashboardRoleViews.test.tsx` (NEW)** | **5** | **PASSED** | **Frontend role dashboard rendering, 8 sections, uncapped workload, zero target widgets, executive view.** |
| `CalendarTabs.test.tsx` | 5 | **PASSED** | 3-tab navigation, SM Manager plan authoring, Creative Head review, worker My Work notices. |
| `App.test.tsx` | 1 | **PASSED** | Application smoke test. |

#### Build & Typecheck Metrics
- `npm run typecheck --workspaces`: **0 errors** across `@mmp/shared`, `@mmp/api`, and `@mmp/web`.
- `npm run build --workspaces`: Built `@mmp/shared` (tsup) and `@mmp/web` (Vite) successfully in 11.87s.
- `npm test --workspaces`: **20 test files, 302 tests passed, 0 failures**.

---

### 4. Inventory: What Remains vs What Was Removed

#### What Remains
- **5 Canonical Roles:** `admin`, `creative_head`, `sm_manager`, `team_member`, `executive`.
- **Single-Brand HACA Focus:** Organization and profile scoped strictly to HACA (`profileId: 'haca'`).
- **Content Flow & Calendar Plans:** `CalendarPlan`, `ContentPiece`, 4 pipelines, backward stage offsets, sequential stage locking.
- **Stage Execution:** `WorkItem`, central state machine, My Work execution portal.
- **Review & Quality:** Structured feedback model, blocker tracking, revision flags.
- **Operational Cockpit:** 8-section dashboard, 4 saved reports, 6 worker-scheduled automation rules, real workload capacity engine.

#### What Was Removed
- ❌ **Commercial Leads & CRM:** `leads` module, LeadSquared (LSQ) sync adapters, datacenter discrepancies, sync runs, and `LSQ_*` env variables.
- ❌ **Sales Targets & Campaigns:** `targets` module, `campaigns` module, OKR alignments, funnel conversion charts.
- ❌ **Legacy Calendar Module:** Old flat calendar endpoints replaced by `CalendarPlan` and `ContentPiece`.
- ❌ **Legacy Roles & Aliases:** Retired `marketing_head` and `team_lead`; removed legacy approver job-role fallbacks ("Creative Manager (TL)").
- ❌ **Legacy User Routes:** Legacy `/api/users` endpoints replaced by `/api/people` and `/api/admin/access-requests`.
- ❌ **Credentials in Git:** `USERS_AND_PASSWORDS.md` untracked from git index; hardcoded passwords replaced with environment variables.

---

### 5. Final Launch Checklist

- [x] **Database Clean & Reset:** Run `npm run seed:demo` to seed canonical HACA staff and demo accounts.
- [x] **Environment Variables Verified:** Ensure `JWT_SECRET`, `ADMIN_SEED_PASSWORD`, `DEMO_SEED_PASSWORD`, and `MONGODB_URI` are configured.
- [x] **Worker Process:** Start background worker daemon via `npm run worker -w apps/api`.
- [x] **API & Web Build:** Compile production bundles via `npm run build`.
- [x] **Security Audit:** Confirm no credentials or debug tokens exist in repository or documentation.
- [x] **Test Verification:** Confirm all 302 tests pass across monorepo (`npm test`).














