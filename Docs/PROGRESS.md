# Project Progress Log

### HACA FORGE: Marketing Operations & Workflow Engine

**Current State**: Phase 0 (Foundation), Phase 1 (Auth & RBAC), Phase 2 (Master Data & Org Setup), Phase 3 (Requests, Scoping & Lead Triage), Phase 4 (Content Core, Pipelines & Handoffs), Phase 5 (Content Calendar, Bulk Import, Capacity & Publishing), and Phase 6 (Team Management, Shoots, Attendance & Time Tracking) Complete.  
**Branch**: `portal-v1`  
**Date**: October 2026

---

## 1. Summary of Completed Work

### Phase 0: Monorepo Foundation & Tooling
- **Monorepo Structure**: Established npm workspaces monorepo at root with `apps/api`, `apps/web`, and `packages/shared`.
- **Runtime Standardization**: Enforced Node 22 LTS in `.nvmrc` and `engines`.
- **Config & Environment**: Built `apps/api/src/config/env.js` with Zod validation that fails fast on startup if required variables are missing. Created `.env.example` for both API and Web.
- **Shared Package (`@mmp/shared`)**: Configured with `tsup` (generating ESM and CJS with type declarations), exporting:
  - Role keys (`admin`, `lead`, `team_lead`, `worker`, `sm_manager`, `dept_lead`, `dept_staff`, `viewer`)
  - Production team keys (`content`, `graphics`, `cinematography`, `editor`)
  - Status enums (`RequestStatus`, `ContentStatus`, `TaskStatus`, `DeliverableStatus`, `ShootStatus`, `TimeEntryStatus`)
  - Permission keys & Complete CASL permission matrix from spec Section 15.1
  - Zod schemas for Auth, Request Access, Set Password, and Task Transitions
- **Infrastructure**: Added `docker-compose.yml` for local MongoDB & Redis, `.github/workflows/ci.yml` for CI automation, and `.gitignore`.
- **API Foundations**: Pino structured logger, central error handler returning `{ error: { code, message, details? } }`, and health endpoint `GET /api/status`.

### Phase 1: Authentication, RBAC, Request Access & Frosted Glassmorphism UI
- **User Model**: Mongoose model with full role set, active/suspended status, department, team, skills, weekly capacity, attendance tracking, and hashed refresh tokens.
- **Request Access Model**: `AccessRequest` model with 48-hour hashed invite tokens, duplicate prevention, and rate-limiting.
- **CASL RBAC Middleware**: `requirePermission(key)` middleware applied to administrative routes; `authenticate` middleware reading httpOnly secure cookies and generating CASL abilities.
- **Audit Logging**: `AuditLog` records for access approvals, rejections, info requests, role changes, suspensions, and force logouts.
- **Mail Adapter (`lib/mailer.js`)**: Provider-agnostic adapter supporting `console` (local development), `smtp` (Nodemailer), and `resend` (HTTPS API for Render compatibility). Rich HTML email templates for invites, rejections, and notifications.
- **Admin Seeding**: `scripts/seed-admin.js` to securely create the first administrator from `ADMIN_SEED_EMAIL` (`admin@marketingportal.com`) and `ADMIN_SEED_PASSWORD` (`Admin1212`).
- **Complete Frosted Glassmorphic Design System (Matching `Docs/ui_design_specification.md`)**:
  - Unified `#7a6af6` accent glow, soft backdrop blurs (`backdrop-blur-xl`), `rgba(255,255,255,0.75)` frosted panels, and refined white border highlights.
  - Sticky glass header (64px) with capsule navigation pills and `#0D0E12` dark pill active indicators.
  - Left icon sidebar (72px) with quick navigation shortcuts and user profile access.
  - `CasesOverview` component with multi-column Kanban board (Content, Graphics, Cinematography, Editor), connector node indicators, Customer Journey flow diagram, and bottom analytics widgets (Top Case Drivers, Case Metrics).
  - `NewCaseModal` matching reference specifications with creator avatar picker, production team dropdown, dynamic linked budget range slider ($1k–$100k), and dark action button.
  - Removed Docker dependency in favor of direct local execution.

### Phase 2: Departments, Teams, Master Data, Audit Log, Settings & Dynamic Form Renderer
- **Organizational Structure**:
  - `Department` model with source categories (`social_media`, `performance`, `sales`, `academics`, `other`) and assigned leads.
  - `Team` model for production delivery (`Content`, `Graphics`, `Cinematography`, `Editor`) with lead assignment, member lists, and automatic weekly capacity rollups.
- **Master Data Catalog**:
  - Collections for `Platform` (YouTube, Instagram, Facebook, LinkedIn, TikTok, etc.), `Priority` (urgent, high, medium, low with SLA response hours), `HoldReason`, and `ContentFormat` (with default lead times in days).
  - `RequestType` collection per department with full dynamic schema support (`fieldKey`, `label`, `type`, `required`, `options`, `helperText`).
- **Comprehensive Database Seed (`scripts/seed.js`)**:
  - Idempotent seed script creating 36 realistic users across all 8 roles, 5 departments, 4 production teams, 7 content formats, 5 request types, 16 access requests, and 10 audit logs.
- **Audit Logging Service (`/api/admin/audit-log`)**:
  - Centralized audit trail with actor, action, entity, before/after state diff, and client IP tracking.
- **System Settings Model (`/api/master-data/settings`)**:
  - Configurable worker efficiency score weights (on-time, first-pass, speed, volume), privacy toggle (hiding worker names from external requesters), and mandatory hold reason policies.
- **Frosted Glass Admin UI Pages**:
  - `TeamsDepartmentsPage`: Team weekly capacity rollups, member management, department creation/editing.
  - `MasterDataPage`: Tabbed catalog editor (Platforms, Priorities, Hold Reasons, Content Formats & Lead Times, and Request Types with custom field schema builder and live preview).
  - `AuditLogPage`: Filterable, paginated audit trail with JSON inspector modal.
  - `SettingsPage`: Interactive weight sliders with live sum validation and privacy toggles.
  - `DynamicFormRenderer`: Reusable schema-driven form component supporting 8 input types (text, textarea, number, select, multiselect, date, url, file).
- **Users Management Upgrades (`UsersPage`)**:
  - Full modal editing for role, department, team assignment, weekly hours capacity, and interactive skills tag selection.

### Phase 3: Requests, Scoping & Marketing Lead Triage Engine
- **Sequential Atomic Numbering**: Sequential `MKT-YYYY-NNNN` generator backed by atomic MongoDB counters (`Counter` collection).
- **Comprehensive Lifecycle State Machine**:
  - Full state transition validation engine (`draft` → `submitted` → `under_triage` → `accepted` / `rejected` / `needs_info` / `converted` / `cancelled`).
  - Strict reason code requirement on rejection and cancellation.
  - Automatic historical audit trail logging every transition with actor, timestamp, and context to `StatusHistory`.
- **Department & Role Scoping**:
  - Requester portal strictly scopes queries: Department Leads view all department requests; Staff members view their own submissions; Leads and Admins view all requests across the organization.
- **Intelligent Duplicate Detection**:
  - Real-time similarity detection matching open requests on department, content format, deadline proximity (±3 days), and high title similarity.
  - Interactive live duplicate alert warnings on requester intake form.
- **In-App Notifications**:
  - Full notifications system (`/api/notifications`) alerting requesters and leads on status changes, info requests, and comments with unread counters.
- **Lead Triage Inbox (`/lead/inbox`)**:
  - Filterable triage inbox with search, urgency pills, and department badges.
  - Production team capacity preview bars (Content, Graphics, Cinematography, Editor) displaying available weekly bandwidth to guide acceptance decisions.
  - Modal action dialogs for Accept (target format, priority, notes), Reject (categorized reason code and mandatory rationale), Ask Info, and Duplicate Merge.
- **Requester Portal (`/requester/dashboard`)**:
  - KPI overview metrics (Drafts, Active Triage, Accepted, Needs Info, Completed).
  - Schema-driven intake modal powered by `DynamicFormRenderer` with file attachments and recurring frequency toggles.
  - Slide-over detail drawer with interactive timeline, real-time comment threads, resubmission flow, and cancellation.

### Phase 4: Content Core, Pipelines, Automated Task Derivation & Handoffs
- **Sequential Content Item Engine**:
  - Sequential `CNT-YYYY-NNNN` generator with derived production deadlines (`publishDate - leadTimeDays`).
  - `ContentItem` model tracking campaign links, pillars, target distribution platforms, formats, and lifecycle stages (`planned` → `in_production` → `in_review` → `approved` → `published`).
- **Pipeline Templates for all 7 Deliverable Formats**:
  - Seeded templates for `static_post`, `carousel`, `story`, `reel`, `ad_creative`, `brochure`, and `academic_creative`.
  - Configurable stage progression rules and team ownership (`content` → `graphics` → `cinematography` → `editor`).
- **Automated Task Generation & Intelligent Worker Allocation**:
  - `initializeContentPipeline`: Generates discrete sequential `Task` entities (`TSK-YYYY-NNNN`) with stage orders, estimate hours, and prerequisite dependencies.
  - Automatic workload calculation selecting the least loaded active worker on the designated team, automatically excluding workers marked as `onLeave: true`.
- **Sequential Dependency Enforcement & Automated Handoffs**:
  - Tasks strictly enforce prerequisite completion: attempting to start an unready task returns error code `DEPENDENCY_BLOCKED`.
  - Marking a stage task as `done` or `approved` automatically advances the pipeline, unblocking downstream tasks, assigning work, and dispatching real-time notifications.
- **Mandatory Hold / Blocker Governance**:
  - Transitioning any task to `blocked` or `on_hold` strictly requires a standardized `holdReason` code (waiting for content, approval delay, client feedback, resource shortage, equipment, etc.) and explanation note.
- **Request-to-Content Conversion (`POST /api/requests/:id/triage/convert`)**:
  - Transitions accepted requests to `converted` and atomically generates the production deliverable with its complete pipeline.
- **Polymorphic Collaboration Engine**:
  - Unified `Comment` collection supporting rich comment threads on requests, content items, and individual tasks.
- **Lead Content Hub (`/lead/content`) & Worker Workspace (`/worker`)**:
  - `ContentHubPage`: Toggleable view between TanStack Data Table and multi-column Kanban board, filterable by format, status, and search query. Slide-over detail drawer with interactive pipeline stepper, task progress tracking, and comment streams.
  - `WorkerDashboard`: Personal task queue, team handoff queue, subtask checklists, status transitions with hold/block modal, and live attendance toggling.
- **Development Convenience**:
  - Login rate limiter bypass enabled in development (`authLimiter` set to passthrough).

### Phase 5: Content Calendar, Bulk Import, Capacity Checks & Publishing
- **Calendar Entry Model (`CalendarEntry`)**:
  - Date, platform, format, theme, campaignId, captionBrief, contentPillar, owner (`sm_manager`), and status (`draft`, `approved`, `converted`).
  - Compound indexes on `{ date: 1, platform: 1 }`, `{ status: 1 }`, and `{ linkedContentItemId: 1 }`.
- **Intelligent Platform Clash Detection**:
  - Real-time detection flagging dates where scheduled deliverables on the same platform exceed a configurable threshold ($N$, default 3), rendering visual `CLASH` warning badges.
- **Idempotent Content Pipeline Generation (`POST /api/calendar/generate-content`)**:
  - Transforms approved calendar deliverables into full `ContentItem` records (`CNT-YYYY-NNNN`) with automatically derived production deadlines (`date - leadTimeDays`).
  - Spawns stage tasks across production teams (`content` → `graphics` → `cinematography` → `editor`) using `initializeContentPipeline`.
  - Idempotent execution: skipping already converted entries and preventing duplicate generation.
- **Excel & CSV Bulk Import Engine (`/api/calendar/import`)**:
  - Uses `exceljs` to parse `.xlsx` and `.csv` uploads with memory buffering.
  - Pre-commit validation preview (`POST /api/calendar/import/preview`) identifying row-level errors (invalid dates, unsupported platforms or formats, empty themes, duplicate rows) without database mutations.
  - Single-batch commit (`POST /api/calendar/import/commit`) for validated rows.
  - Downloadable branded template file (`GET /api/calendar/template`) with obsidian styling, sample rows, and allowed values guide.
- **Team Bandwidth & Capacity Analytics (`GET /api/calendar/capacity`)**:
  - Compares weekly team demand hours (aggregated from pipeline stage estimates) against available worker capacity.
  - Dynamically discounts workers on leave (`attendance: 'on_leave'`).
  - Evaluates utilization percentages with status tags: `optimal` (<85%), `warning` (85–100%), and `overloaded` (>100%).
- **Restricted Live Publishing Workflow (`PATCH /api/content/:id/publish`)**:
  - Restricted to `sm_manager` and `admin` roles, enforcing `approved` or `scheduled` state prerequisites.
  - Records live published URL, publish date/time, publisher ID, and initial post analytics (`reach`, `views`, `likes`, `shares`, `comments`).
  - Logs immutable `StatusHistory` transition to `published`.
- **Frosted Glass Frontend Calendar & SM Manager Hub**:
  - `CalendarPage.tsx`: Interactive Month Grid, Week View, and Agenda List view with platform badges (Instagram, LinkedIn, YouTube, Facebook, TikTok), format indicators, derived deadline badges, and clash alerts.
  - `CapacityWidget.tsx`: Live visual progress bars and warning pills showing team capacity vs demand.
  - `BulkImportModal.tsx`: Multi-step import wizard with template download, drag-and-drop upload, row error highlights, and batch commit.
  - `CalendarEntryDrawer.tsx`: Slide-over drawer for deliverable creation, editing, rescheduling, batch approvals, and pipeline generation.
  - `SmDashboard.tsx`: SM Manager operations command center with status KPI cards, Ready-to-Publish queue, and live release history.
  - `PublishModal.tsx`: Live URL and post metrics submission dialog.

### Phase 6: Team Management, Shoots, Attendance & Time Tracking
- **Sequential Shoot Lifecycle Engine (`/api/shoots`)**:
  - `Shoot` model generating sequential `SHT-YYYY-NNNN` counters, tracking shoot date, location, crew roster, equipment checklist, talent notes, linked content items, footage links, status (`scheduled`, `done`, `reshoot_needed`, `cancelled`), and transition history.
  - Video deliverable restriction: strictly verifies that all linked deliverables are video-format deliverables (e.g. `reel`, `story`, `ad_creative`).
  - Script-ready guard: automatically verifies that the Content stage task for each linked item is `done` or `approved`. Rejects unready scripts with code `SCRIPT_NOT_READY` unless the `overrideWarning` flag is provided by a Lead or Admin.
  - Done transition & footage release: marking a shoot as `done` sets shoot status to `done`, completes the cinematography task, attaches raw footage links, and atomically creates/unblocks Editor stage tasks (`assigned`/`in_progress`), unblocking the downstream Editor queue.
  - Reshoot request governance: marking `reshoot_needed` requires a mandatory reason, logs a transition note, and returns the deliverable tasks back to Cinematography with reshoot instructions.
- **Attendance & Leave Management (`LeaveRequest`, `/api/leave`)**:
  - `LeaveRequest` model with date ranges (`startDate`, `endDate`), leave types (`sick`, `casual`, `annual`, `emergency`, `other`), reason, status (`pending`, `approved`, `rejected`, `cancelled`), and reviewer notes.
  - Role-scoped querying: Workers view their own leaves, Team Leads view their team's leaves, Leads and Admins view all leaves.
  - Review & approval lifecycle: Approving a leave automatically synchronizes the worker's `onLeave` flag and `leaveDates` window.
  - Dynamic assignment & capacity discounting: `findLeastLoadedWorker` in pipeline auto-allocation actively queries `LeaveRequest` and excludes any worker currently on approved leave; `getTeamCapacityComparison` in calendar planning dynamically discounts workers on leave during evaluated week windows.
- **Time Tracking & Timesheet Approvals (`TimeEntry`, `/api/time`)**:
  - `TimeEntry` model recording `taskId`, `contentItemId`, `userId`, `date`, `startTime`, `endTime`, `minutes`, `note`, `status` (`draft`, `submitted`, `approved`), and `approvedBy`.
  - Live timer controls: `/api/time/timer/start` (enforces single concurrent timer per worker) and `/api/time/timer/stop` (auto-calculates elapsed minutes and creates entry).
  - Manual entry logging and weekly timesheet batch submission (`/api/time/timesheets/submit`).
  - Lead / Team Lead review queue (`GET /api/time/timesheets/pending`) and batch approval (`PATCH /api/time/timesheets/approve`).
  - Automatic `actualHours` derivation: Automatically derives and keeps updated `Task.actualHours` (`sum(minutes) / 60`) across submitted and approved entries.
- **Team Management, Workload & Handoff Queues (`/api/teams`)**:
  - `team_lead` role scoping: Team Leads strictly view and manage only their assigned team (`/api/teams/:teamId/dashboard`); Leads and Admins can view and switch between all 4 production teams.
  - Team dashboard dataset: Aggregates team members, skills matrix, weekly capacity, today's active load hours, utilization percentages, leave statuses, and team backlog metrics.
  - Interactive Task Reassignment (`POST /api/teams/reassign`): Allows Leads to reassign tasks between team members, returning granular warning payloads if the target worker is overloaded (>100% capacity) or currently on leave.
  - Handoff queue feeds: Returns ready handoff queues across all 4 production stages:
    - Editor: "Footage ready" (shoots marked done with footage released)
    - Graphics: "Copy ready" (content stage completed, ready for visual design)
    - Cinematography: "Script ready" (content approved, ready for shoot scheduling)
    - Lead: "Waiting for review" (worker submissions awaiting sign-off)
- **Frosted Glass Frontend Pages**:
  - `ShootPlannerPage.tsx`: Full Shoot Planner featuring toggleable Calendar and List views, "Today's Shoots" call sheet widget, Call Sheet slide-over drawer with crew assignments and gear checklists, "Schedule Shoot" modal with script checks and override warning, "Mark Done" footage submission modal, and "Request Reshoot" dialog.
  - `TeamManagementPage.tsx`: Operations command center for Leads and Team Leads featuring member capacity meters, overload badges, skills matrix cross-tabulation table, 4 handoff queue feeds, team leave approval queue, and interactive task reassignment modal with leave/overload warnings.
  - `TimesheetsPage.tsx`: Worker weekly timesheet grid with Monday–Sunday breakdown, day-by-day manual entry dialog, live active timer controls, weekly submit action, and Lead approval queue.
  - `WorkerDashboard.tsx`: Integrated live timer ticker bar, task card play/stop buttons with actual hours logged, and "Request Planned Leave" modal.

### Brand Rebranding & Asset Overhaul: HACA FORGE
- **Official Name**: **HACA FORGE**
- **Brand Assets (`apps/web/public/` & `apps/web/src/assets/`)**:
  - `haca-logo.png` & `haca-logo-white.png`: Clean transparent wordmarks cropped directly from user-uploaded high-fidelity assets (480x138).
  - `haca-forge-logo.png` & `haca-forge-logo-white.png`: Complete horizontal brand lockups pairing the authentic `HACA` wordmark with bold `FORGE` typography.
  - `haca-icon.png` & `favicon.png`: 512x512 rounded squircle app icons with obsidian dark gradient backdrop, subtle `#7a6af6` glow border, and crisp white center emblem.
  - `favicon-32x32.png`: High-contrast 32x32 favicon optimized for crisp visibility in all light/dark browser tabs.
- **Application Integration**:
  - Updated `<title>` to `HACA FORGE | Marketing Operations & Workflow Engine`.
  - Calibrated logo sizes across `Layout.tsx` (`h-6 md:h-6.5`), `LoginPage.tsx` (`h-8 sm:h-9`), and `SetPasswordPage.tsx` (`h-8 sm:h-9`).

---

## 2. Key Architecture Decisions

1. **Clean Monorepo with Workspaces**: Eliminated duplicate schemas and out-of-sync types by sharing Zod validation and permission matrices across frontend and backend.
2. **CASL Permissions Over Hardcoded Roles**: Routes and UI controls verify specific capability keys rather than arbitrary strings.
3. **No Direct Registration in Production**: Public signup is completely replaced by Request Access + Admin Approval + 48h activation link.
4. **Token Security**: JWT stored in httpOnly, Secure, SameSite cookies with short-lived access token + rotated refresh token.

---

## 3. How to Run Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Build shared library**:
   ```bash
   npm run build -w packages/shared
   ```
3. **Seed the initial admin**:
   ```bash
   npm run seed:admin
   ```
4. **Start local servers**:
   ```bash
   npm run dev
   ```
   - API: `http://localhost:8080` (Health: `http://localhost:8080/api/status`)
   - Web: `http://localhost:5173`

---

## 4. Manual Verification Checklist

- [ ] **Health Check**: Open `http://localhost:8080/api/status` and verify `{ "status": "ok" }`.
- [ ] **First Admin**: Run `npm run seed:admin` and log in at `http://localhost:5173/login` using credentials from `.env`.
- [ ] **Request Access**: On the login page, click "Request Portal Access", fill in the form, and submit.
- [ ] **Admin Approval**: As admin, navigate to `/admin/access-requests`, click "Approve", select role/team, and submit.
- [ ] **Console Email**: Observe the console log output from `lib/mailer.js` displaying the activation link with token.
- [ ] **Set Password**: Open the activation link, set a new password, and verify you are redirected to login.
- [ ] **Role Routing**: Log in with the newly activated user and confirm automatic redirect to their role dashboard.
- [ ] **Permission Guard**: Try visiting `/admin` as a non-admin and verify redirect to `/unauthorized`.
- [ ] **Teams & Departments**: As admin, visit `/admin/teams-departments`. Review production teams capacity bars, assign a staff member to the Content team, and create a new department.
- [ ] **Master Data & Schemas**: Visit `/admin/master-data`. Inspect platforms, SLA priority tiers, hold reasons, format lead times, and test the Live Dynamic Form Schema renderer.
- [ ] **Audit Trail**: Visit `/admin/audit-log`. Filter by action or entity, and click "Inspect" to view the JSON state diff.
- [ ] **System Settings**: Visit `/admin/settings`. Adjust efficiency score weight sliders (ensuring 100% sum), toggle privacy rules, and save configuration.
- [ ] **Staff Profiling**: Visit `/admin/users`. Open the profile editor on any user, change their team, department, capacity, and toggle skill tags.
- [ ] **Shoot Planner & Call Sheet**: As lead or cinematography worker, visit `/shoots`. Verify upcoming shoots, click on a shoot to inspect the call sheet drawer, and test scheduling a shoot with script-ready validation.
- [ ] **Footage Release & Downstream Unblocking**: Mark a shoot as "Done", enter raw footage URLs, and verify that linked Editor tasks in `/teams` and worker boards transition to active.
- [ ] **Reshoot Return Flow**: From `/shoots`, select "Request Reshoot", provide a mandatory reason, and verify the task returns to Cinematography.
- [ ] **Team Ops & Skills Matrix**: Visit `/teams`. Switch between teams (or log in as a `team_lead` to verify scoped view). Review member capacity meters, overload badges, the cross-tabulation skills matrix, and handoff queues.
- [ ] **Workload Reassignment Warnings**: Reassign a task to a member who is either overloaded or on leave, verifying the confirmation warning modal.
- [ ] **Leave Request & Capacity Discounting**: Log in as a worker, submit a leave request via `/worker` or `/timesheets`. As lead, approve the leave in `/teams`. Verify the worker is discounted in `/calendar` capacity and excluded from auto-assignments.
- [ ] **Live Timer & Timesheets**: On `/worker`, start the live timer on a task, let it run, and stop it. Navigate to `/timesheets` to review the weekly grid, submit the timesheet, and approve it as lead. Verify `Task.actualHours` updates.

