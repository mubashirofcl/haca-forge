# Project Progress Log

### HACA FORGE: Marketing Operations & Workflow Engine

**Current State**: Phase 0 (Foundation), Phase 1 (Auth & RBAC), Phase 2 (Master Data & Org Setup), Phase 3 (Requests, Scoping & Lead Triage), Phase 4 (Content Core, Pipelines & Handoffs), Phase 5 (Content Calendar, Bulk Import, Capacity & Publishing), Phase 6 (Team Management, Shoots, Attendance & Time Tracking), Phase 7 (Deliverable Review Studio, Revisions & Asset Library), Phase 8 (Notifications, Socket.io & Background Jobs), and Phase 9 (Reports & Analytics) Complete.  
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

### Phase 7: Review Queue, Direct Uploads, Video Review & Asset Library
- **Deliverable Model & Idempotent Migration**:
  - Unified `Deliverable` collection (`apps/api/src/modules/deliverables/model.js`) replacing legacy `Submission` and `Content` collections. Tracks semantic versions (`v1`, `v2`, etc.), deliverable types (`video`, `image`, `document`, `audio`, `copy`, `link`, `other`), direct `fileUrl` and `externalLink`, thumbnails, uploadedBy, notes, and approval status trails.
  - Idempotent migration script (`apps/api/src/modules/deliverables/migration.js` & `apps/api/scripts/migrate-deliverables.js`) mapping prior submissions and feedback into `Deliverable` and `Comment` models with automatic backup collections `backup_submissions` and `backup_feedbacks`.
- **Signed Direct Cloudinary Streaming**:
  - `POST /api/uploads/sign`: Enforces strict type categorization and maximum upload size limits (e.g., video files up to 500 MB). Returns Cloudinary HMAC-SHA1 signatures and folder paths so browsers stream files directly to cloud storage without burdening the API server.
- **Lead Review Studio & Timestamped Feedback**:
  - `LeadReviewQueuePage.tsx` (`/lead/reviews`): Full-featured review studio sorted by urgency and deadline.
  - HTML5 & Video.js media player with custom time scrubbers, pin-to-timestamp feedback button, and clickable timestamp badges (`[00:42]`) that automatically seek video playback to exact frames.
  - Side-by-side comparison modal (`GET /api/deliverables/compare?v1=...&v2=...`) for comparing revisions (e.g. `v1` vs `v2`) with notes diff.
  - Review decisions (`POST /api/deliverables/:id/review`):
    - `approved`: transitions task to approved and content item to `needs_requester_confirm` (or `scheduled` if originating from calendar).
    - `changes_requested`: automatically increments `revisionCount`, routes task back to assignee with reviewer notes and timestamped feedback.
    - `rejected`: marks deliverable rejected with mandatory explanation notes.
- **Worker Direct Upload & Revision Flow**:
  - `WorkerUploadModal.tsx`: React-Dropzone drag-and-drop modal with live upload progress bar (0–100%), direct signed Cloudinary upload, external link alternatives (Figma/Canva/Frame.io), and auto-calculated semantic versioning.
  - `WorkerDashboard.tsx`: Integrated changes-requested feedback banners with reviewer notes and "Upload Revision (v{N+1})" action.
- **Requester Sign-Off & Confirmation**:
  - `RequesterDashboard.tsx`: Dedicated "Final Deliverable Awaiting Your Sign-off" banner for department requests.
  - Allows department requesters to inspect final approved deliverables, provide one-click "Confirm & Schedule" sign-off, or "Request Adjustments" with feedback returned to the Marketing Lead.
- **Performance Marketing & Ad Creative Pipeline**:
  - `PerformanceDashboard.tsx` (`/performance`): Command center for ad creatives across Meta, Google, LinkedIn, and TikTok.
  - Actions: "Hand to Performance" (`POST /api/deliverables/performance/:contentItemId/hand`) and "Launch Live" (`POST /api/deliverables/performance/:contentItemId/live`) capturing live URLs and launch dates.
- **Digital Asset Management (DAM) File Library**:
  - `FileLibraryPage.tsx` (`/library`): Global asset repository supporting media filtering (Videos, Images, Documents, Audio, External Links), status filtering (Approved vs All), full-text search, grid and table views, asset preview modal, download, and copy link.

### Brand Rebranding & Asset Overhaul: HACA FORGE
- **Official Name**: **HACA FORGE**
- **Brand Assets (`apps/web/public/` & `apps/web/src/assets/`)**:
  - `haca-logo.png` & `haca-logo-white.png`: Clean transparent wordmarks cropped directly from user-uploaded high-fidelity assets (480x138).
  - `haca-forge-logo.png` & `haca-forge-logo-white.png`: Complete horizontal brand lockups pairing the authentic `HACA` wordmark with bold `FORGE` typography.
  - `haca-icon.png` & `favicon.png`: 512x512 rounded squircle app icons with obsidian dark gradient backdrop, subtle `#7a6af6` glow border, and crisp white center emblem.
  - `favicon-32x32.png`: High-contrast 32x32 favicon optimized for crisp visibility in all light/dark browser tabs.
- **Application Integration**:
  - Updated `<title>` to `HACA FORGE | Marketing Operations & Workflow Engine`.
### Phase 8: Notifications, Socket.io & Background Jobs
- **Central Domain Event Bus (`apps/api/src/lib/events.js`)**:
  - Centralized, singleton `eventBus` (EventEmitter) decoupled from HTTP handlers, publishing domain lifecycle events:
    - `request.created`, `request.decided`
    - `task.assigned`, `task.blocked`, `task.completed`
    - `stage.handoff`
    - `review.submitted`, `review.decided`
    - `content.published`
    - `comment.created`, `comment.mention`
    - `deadline.approaching`, `deadline.overdue`
    - `capacity.gap`
    - `access.requested`
- **Recipient Mapping & Notification Service (`apps/api/src/modules/notifications/service.js`)**:
  - Implemented Section 14.3 recipient routing rules:
    - Automatically routes `request.created` to Marketing Leads & Admin.
    - Routes `task.assigned` to assignee with direct link.
    - Routes `task.blocked` to assignee and Team Lead.
    - Routes `review.submitted` to lead reviewers, and `review.decided` to assignee and team.
    - Routes `deadline.approaching` to assignee within 24 hours of due date.
    - Routes `deadline.overdue` to assignee, Team Lead, and Marketing Lead.
    - Routes `capacity.gap` overload alerts to Team Leads and Admin.
  - Automatically filters delivery through user notification preferences (in-app vs email).
- **User Notification Preferences (`apps/api/src/modules/users/model.js` & `/api/notifications/preferences`)**:
  - User model schema with nested preferences for email and in-app toggles across:
    - `requestUpdates`, `taskAssigned`, `taskBlocked`, `reviewDecisions`, `deadlineReminders`, `mentions`, and `dailyDigest`.
  - Exposed via `GET /api/notifications/preferences` and `PUT /api/notifications/preferences`.
- **Resilient Background Queues & BullMQ Worker (`apps/api/src/worker.js`, `apps/api/src/lib/queue.js`)**:
  - Standalone worker service entry (`node src/worker.js`) capable of running as an independent background service on Render.
  - Workers for `emailQueue` (concurrency 5 with exponential backoff retries) and `scheduledJobsQueue` (repeatable cron triggers).
  - Four core idempotent background jobs (`apps/api/src/modules/jobs/processors.js`):
    - `runDeadlineRemindersJob`: Idempotently scans tasks & content due in <= 24h, setting `reminderSentAt` timestamp so restarts NEVER send duplicate alerts.
    - `runRecurringRequestsJob`: Instantiates new child requests for active recurring templates when `nextRunAt <= now` and calculates the next run date (+7d / +1mo).
    - `runDailyDigestJob`: Prepares and dispatches morning operational summary for Leads (pending triage, blocked tasks, pending reviews, overdue items).
    - `runCapacityGapJob`: Weekly forecast checking upcoming team assigned estimate hours against available present capacity.
  - Resilient local execution: In development without a local Redis server, cleanly falls back to direct email dispatching and lightweight interval scheduling without crashes or unhandled rejections.
- **Socket.io Handshake & Multi-Room Subscriptions (`apps/api/src/server.js`, `apps/web/src/hooks/useSocket.ts`)**:
  - Authenticated handshake supporting cookies, `auth.token`, `Bearer` authorization headers, and query tokens.
  - Automated room joining: `user:<userId>`, `role:<role>`, and `team:<teamKey>`.
  - Client events for `join_task`, `leave_task`, `join_request`, `leave_request`, and live typing broadcasts (`task:typing`).
- **Glassmorphic Frontend Notification Center & Toast Alerts**:
  - `NotificationCenter.tsx`: Soft-glass popover dropdown on the header bell icon with live unread badge, pulse dot animation, filter tabs (`All`, `Unread`, `Tasks`, `Requests`, `Mentions`), "Mark All as Read", individual check/delete actions, and direct navigation links.
  - `NotificationToast.tsx`: Floating corner toast container displaying instant real-time alerts when `notification:new` arrives via Socket.io.
  - `NotificationPreferencesModal.tsx`: Soft-glass modal allowing users to toggle email and in-app notifications per category.
  - `NotificationsPage.tsx` (`/notifications`): Full-page notifications command center with search, filter tabs, and pagination.
- **Automated Verification**:
  - `test/phase8.test.js`: 14 comprehensive unit & integration tests covering domain event bus, recipient routing, preferences filtering, REST APIs, deadline reminder idempotency, recurring request generation, and digest generation.
  - **Full test suite passing: 9 test files, 73/73 tests passing with 100% green status.**
  - **Vite + TypeScript production build: Clean with 0 errors.**

### Phase 9: Reports & Analytics
- **Central Metrics Engine (`apps/api/src/modules/reports/metrics.js` & `docs/METRICS.md`)**:
  - Canonical calculation formulas defined once with complete documentation and edge case handling:
    - **On-Time Rate**: `(onTimeCount / totalCount) * 100` (defaults to 100% if 0 items).
    - **First-Pass Approval Rate**: `(firstPassCount / totalReviewed) * 100` (disqualifies items entering `changes_requested`).
    - **Speed vs. Estimate Score**: `min(100, (estimatedHours / actualHours) * 100)` (caps at 100% if delivered within estimate).
    - **Capacity Utilization / Volume Score**: Logged hours against net capacity (`40h/week - (leaveDays * 8h)`).
    - **Worker Efficiency Score**: Weighted composite index:
      $$\text{Efficiency} = (0.40 \times \text{onTime}) + (0.30 \times \text{firstPass}) + (0.20 \times \text{speed}) + (0.10 \times \text{volume})$$
      Driven dynamically by configured weights in `Settings` (`/admin/settings`).
    - **Aging Buckets**: Grouping open requests and overdue items into `< 3 days`, `3-7 days`, `7-14 days`, and `> 14 days`.
- **Database Index Optimization**:
  - Added compound indexes to `StatusHistory`, `Task`, and `ContentItem` for sub-2-second aggregation query performance over large datasets without in-memory buffering.
- **Reporting Services & Endpoints (`/api/reports/...`)**:
  - `GET /api/reports/department`: Filterable by timeframe and department. Returns requests and content summary, on-time delivery rate, average turnaround time (days), aging distribution, and production hours consumed grouped by department, team, and format.
  - `GET /api/reports/team`: Filterable by team (`graphics`, `editor`, `content`, `cinematography`). Returns throughput, open backlog, queue wait latency vs active work hours, team utilization %, and rework/revision rate.
  - `GET /api/reports/individual/:userId`: Individual performance scorecard featuring the 4-pillar efficiency breakdown, estimated vs actual hours, total logged hours, approved leave days impact, and recent task evaluations.
  - `GET /api/reports/content`: Content output volume grouped by format and platform, planned vs published ratios, on-time publish rate, stage pipeline distribution, and late asset aging.
  - `GET /api/reports/bottlenecks`: Hold and block analysis grouped by reason code (`waiting_for_content`, `approval_delay`, `resource_shortage`, etc.), stage transition frequencies, and active blocked tasks live feed.
  - `GET /api/reports/scorecard`: Executive monthly scorecard with Month-over-Month (MoM) delta percentages, and weekly demand vs production capacity forecast.
- **Strict Role Scoping & Access Control**:
  - `admin`, `lead`, and `viewer`: Global visibility across all teams and departments.
  - `team_lead`: Strictly scoped to their assigned production team.
  - `dept_lead`: Strictly locked to their own department (attempts to query other departments are clamped to own).
  - `worker`: Strictly restricted to their own individual report; querying other workers returns `403 Forbidden`.
  - `dept_staff`: Scoped strictly to their own created requests.
- **Streaming Exports & Scheduled Recurring Reports**:
  - Streaming Excel spreadsheets (`.xlsx`) via ExcelJS and CSV data (`.csv`) via `GET /api/reports/export`.
  - `ScheduledReport` model (`apps/api/src/modules/reports/model.js`) and REST APIs (`GET`, `POST`, `DELETE /api/reports/scheduled`).
  - Automated background processor `runScheduledReportsJob` in `apps/api/src/modules/jobs/processors.js` generating and dispatching recurring reports via email with next run date advancement (+1d, +7d, +1mo).
- **Role Dashboard Summaries (`/api/dashboard/...`)**:
  - Dynamic `/api/dashboard/summary` auto-resolving role-specific widgets for the logged-in user, plus dedicated `/api/dashboard/:role` endpoints.
- **Interactive Frosted Glass Frontend (`ReportsPage.tsx`)**:
  - Tabbed report picker (`Management Scorecard`, `Department Usage`, `Team Velocity`, `Bottlenecks & Holds`, `Content Pipeline`, `Worker Performance`).
  - Shared Filter Bar with timeframe presets (Last 7 Days, Last 30 Days, Q3 2026, Year to Date, Custom Date Range), department/team/worker selectors, and saved filter profiles stored in localStorage.
  - Rich interactive Recharts visualizations (AreaCharts, BarCharts, PieCharts, Donut, Custom Tooltips) and TanStack Data Tables.
  - Segment drill-down modal for inspecting underlying raw item payloads.
  - One-click streaming Excel/CSV export and print-friendly styling.
  - "Schedule Email" modal for configuring automated recurring reports.
- **Worker Dashboard Integration (`WorkerDashboard.tsx`)**:
  - Integrated 5th KPI card on the worker workspace displaying live efficiency score (`/ 100`) with direct link to the personal performance scorecard.
- **Automated Verification**:
  - `test/phase9.test.js`: 24 automated unit and integration tests verifying all 6 report types, calculation formulas, scoping isolation, Excel/CSV streaming exports, scheduled reports, and sub-2-second response performance.
  - **Full test suite passing: 10 test files, 97/97 tests passing with 100% green status.**
  - **Vite + TypeScript production build: Clean with 0 errors.**

### Phase 10: Hardening, QA, and Polish
- **Comprehensive Security Review (`docs/SECURITY_REVIEW.md`)**:
  - Remediated Broken Object Level Authorization (BOLA) and IDOR vectors on `/api/tasks/:id` and `/api/content/:id` by restricting departmental requesters from accessing internal production pipelines or cross-department content items.
  - Restricted leave approval (`/api/leave/:id/review`) strictly to `admin`, `lead`, and `team_lead`.
  - Restricted Ad Creative live launch (`/api/deliverables/live/:contentItemId`) strictly to Performance team members and Leads.
  - Configured Pino secret redaction for `req.headers.authorization`, `req.headers.cookie`, `password`, `token`, `secret`, and `refreshToken`.
  - Enforced production rate limiting: 10 attempts per 15 minutes on auth routes (`authLimiter`), and 1,500 requests per 15 minutes globally on `/api`.
  - Validated query sanitization (`sanitizeMiddleware`), HPP parameter pollution protection, and Helmet security headers with strict CSP.
- **Observability & Diagnostics**:
  - Request Correlation ID middleware (`apps/api/src/middleware/requestId.js`) generating UUID v4 and setting `X-Request-Id` response header.
  - Health & Readiness Probes (`/api/health` and `/api/ready` verifying live MongoDB connection state).
  - Dual-Stack Sentry error monitoring integration (`apps/api/src/config/sentry.js` and `apps/web/src/lib/sentry.ts`) activated only when `SENTRY_DSN` is configured.
- **OpenAPI 3.0 & Interactive API Documentation (`/api/docs`)**:
  - Complete OpenAPI 3.0 specification (`apps/api/src/modules/docs/openapi.js`) covering System, Auth, Requests, Content, Tasks, and Reports.
  - Dark obsidian styled Swagger UI mounted at `/api/docs` and schema endpoint at `/api/docs/openapi.json`.
- **UX Polish & Performance Optimization**:
  - Reusable obsidian loading skeleton primitives (`apps/web/src/components/Skeleton.tsx`): `<Skeleton>`, `<CardSkeleton>`, `<TableSkeleton>`, `<PageSkeleton>`.
  - Global obsidian Error Boundary (`apps/web/src/components/ErrorBoundary.tsx`) with automatic Sentry error capture and user retry actions.
  - Standardized obsidian Empty State component (`apps/web/src/components/EmptyState.tsx`) with dynamic iconography and call-to-action triggers.
  - Code splitting and lazy loading via `React.lazy` across all 21 feature pages with `<Suspense fallback={<PageSkeleton />}>`.
  - Optimized Vite Rollup chunking (`manualChunks` in `vite.config.ts`) splitting React core, Recharts, and Lucide icons.
  - **Performance Result**: Main JS bundle reduced from 1.38 MB to 63 kB (22x reduction in initial payload size!).
- **Realistic Demo Dataset Seed Script (`npm run seed:demo -w apps/api`)**:
  - `apps/api/scripts/seed-demo.js` generates 8 core role personas, 30 days of calendar entries, requests in all 6 statuses, content items in all 9 stages, deliverables v1/v2 with timestamped review comments, scheduled shoots, and timesheets.
  - Guarded against production: immediately throws if `NODE_ENV === 'production'`.
- **End-to-End Integration Test Suite (`apps/api/test/phase10_e2e.test.js`)**:
  - 32 end-to-end integration tests covering:
    1. System & Health Probes (`/api/health`, `/api/ready`, `/api/docs/openapi.json`).
    2. Journey A: Onboarding, Access Request, Admin Approval, Activation Link & Token, Password Setting, and Login.
    3. Journey B: Full Content Intake-to-Publishing Lifecycle (Request -> Triage -> Reel Conversion -> Task Assignment -> Deliverable v1 -> Changes Requested -> Deliverable v2 -> Lead Approval -> Requester Sign-off Confirmation -> Social Media Publish).
    4. Journey C: Social Media Calendar Planning, Capacity Warning, and Batch Content Generation.
    5. Journey D: Shoot Planner Lifecycle, Script-ready validation, Shoot Done transition, and Raw Footage Cloud Release.
    6. Journey E: RBAC & Scoping Violation Rejections (Workers cannot approve deliverables, Requesters cannot access task pipelines, Department Staff cannot view other departments, Non-leads cannot review leave, Non-performance cannot mark ad creative live).
    7. Journey F: Reports Scoping & Streaming Data Exports (Worker self-query vs other rejection, Department Lead automatic scoping, and Admin streaming binary Excel export).
- **Full Verification Status**:
  - **11 test suites passing: 129/129 tests passing with 100% green status.**
  - **TypeScript check: Clean across all workspaces (`packages/shared`, `apps/api`, `apps/web`) with 0 errors.**
  - **Vite production build: Clean with 0 warnings in 13.18s.**

### Phase 11: Deployment Configuration & Runbooks
- **Infrastructure as Code (Render Blueprint - `render.yaml`)**:
  - Full declared topology for Render cloud services:
    - `mmp-api`: Express.js web service running Node.js 22, configured with `/api/health` check path and production environment group.
    - `mmp-worker`: Background BullMQ queue and cron worker service running `apps/api/src/worker.js`.
    - `mmp-redis`: Managed Redis instance with `noeviction` maxmemory policy for queue state consistency.
- **Frontend Vercel Configuration (`vercel.json` & `apps/web/vercel.json`)**:
  - Configured SPA rewrites (`/(.*) -> /index.html`), monorepo build command (`npm run build -w packages/shared && npm run build -w apps/web`), and output directory (`apps/web/dist`).
  - Implemented immutable caching headers (`Cache-Control: public, max-age=31536000, immutable`) for `/assets/*` and no-cache for `/index.html`.
- **Environment Specifications**:
  - Verified and enhanced `apps/api/.env.example` and `apps/web/.env.example` with complete descriptions, production requirements, and defaults for MongoDB Atlas, Redis, Cloudinary HMAC signing, Resend transactional mail, and Sentry monitoring.
- **Production Operations Runbook (`docs/DEPLOYMENT.md`)**:
  - Authored comprehensive deployment guide covering architecture topology with Mermaid diagrams, Atlas replica set provisioning, Cloudinary direct upload presets, Resend domain verification, Render Blueprint deployment, Vercel SPA configuration, smoke testing verification commands, and disaster recovery/incident response runbooks (PITR database recovery, instant rollback, and emergency admin credential reset).

---

## 2. Key Architecture Decisions

1. **Clean Monorepo with Workspaces**: Eliminated duplicate schemas and out-of-sync types by sharing Zod validation and permission matrices across frontend and backend.
2. **CASL Permissions Over Hardcoded Roles**: Routes and UI controls verify specific capability keys rather than arbitrary strings.
3. **No Direct Registration in Production**: Public signup is completely replaced by Request Access + Admin Approval + 48h activation link.
4. **Token Security**: JWT stored in httpOnly, Secure, SameSite cookies with short-lived access token + rotated refresh token.
5. **Direct Signed Storage Streaming**: 500 MB video files stream directly from the browser to cloud object storage (Cloudinary) via HMAC signed upload signatures, eliminating API memory pressure.
6. **Semantic Versioning & Frame-Accurate Feedback**: Deliverables retain immutable version histories (`v1`, `v2`, etc.) with media timestamp seek points.

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
- [ ] **Worker Deliverable Upload**: On `/worker`, click "Submit Cut" on an active task. Drag and drop a video file, watch progress bar, enter version notes, and submit.
- [ ] **Lead Review Studio**: Visit `/lead/reviews`. Open the submitted deliverable, play the video, pin a timestamp comment at `0:15`, and click the comment to verify it seeks playback to that exact second.
- [ ] **Request Changes Flow**: From the review studio, click "Request Changes" with feedback. Verify `Task.revisionCount` increments and the task returns to the worker with an amber banner.
- [ ] **Upload Revision v2 & Side-by-Side Compare**: On `/worker`, click "Upload Revision", submit v2. In `/lead/reviews`, open "Compare Versions" and inspect the side-by-side player.
- [ ] **Lead Approval & Requester Confirmation**: In `/lead/reviews`, click "Approve Cut". Log in as the requester on `/requester`, verify the "Final Deliverable Awaiting Your Sign-off" banner, and click "Confirm & Schedule".
- [ ] **Performance Marketing Pipeline**: Visit `/performance`. Find an approved ad creative, click "Hand to Performance", and click "Launch Live" to enter live campaign URLs.
- [ ] **Asset & File Library**: Visit `/library`. Filter assets by Category (Videos, Images, Documents), search by title, preview in modal, and download approved files.
- [ ] **Management Scorecard & Demand Forecast**: Visit `/reports` as Admin or Lead. Inspect the Executive Scorecard tab to view Month-over-Month (MoM) delta percentages for ingested requests, delivered units, on-time rate, and turnaround time. Review the Demand vs Capacity forecast panel.
- [ ] **Department Usage & Aging Buckets**: On `/reports`, switch to the "Department Usage" tab. Toggle departments, verify request breakdown by type, inspect the aging distribution bar chart (`<3d`, `3-7d`, `7-14d`, `>14d`), and review hours consumed by production team and format.
- [ ] **Team Velocity & Queue Latency**: Switch to "Team Velocity". Inspect throughput, current backlog, rework rate, team utilization percentage, and the Queue Latency vs Active Work Hours comparison chart.
- [ ] **Bottlenecks & Hold Reason Radar**: Switch to "Bottlenecks & Holds". Inspect the pie chart breakdown of hold reason codes, workflow stage transition frequencies, and the active blocked tasks live feed.
- [ ] **Content Pipeline Performance**: Switch to "Content Pipeline". Review output volume grouped by format and platform, on-time publish rate, and late asset aging.
- [ ] **Worker Performance & 4-Pillar Scorecard**: Switch to "Worker Performance" (or log in as a worker to view `/reports`). Inspect the composite Efficiency Score (`/ 100`) and the 4 weighted pillar progress bars (On-Time 40%, First-Pass Approval 30%, Speed vs Estimate 20%, Capacity Utilization 10%). Inspect recent task evaluations with estimated vs actual hours and revision count.
- [ ] **Worker Privacy & Isolation**: Log in as a worker and verify you can only inspect your own performance report; verifying that direct API queries for other workers return `403 Forbidden`.
- [ ] **Department Lead Isolation**: Log in as a `dept_lead` and verify all department reports and exports are strictly constrained to your assigned department.
- [ ] **Excel & CSV Streaming Export**: Click "Export Excel (.xlsx)" and "Export CSV" to trigger streaming file downloads. Open the generated spreadsheet to verify multi-tab summary and hours data.
- [ ] **Automated Report Scheduling**: Click "Schedule Email", configure a recurring weekly scorecard report, and verify it appears in the active scheduled reports list.
- [ ] **Worker Dashboard Efficiency Link**: Navigate to `/worker` and observe the 5th KPI card displaying your live Efficiency Score with direct click-through to the personal scorecard.

