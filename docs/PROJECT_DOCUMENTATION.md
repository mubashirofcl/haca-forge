# HACA Marketing OS: Complete System & Architecture Documentation

> **Document Type:** Master Project Architecture & Implementation Reference  
> **Target Audience:** Engineering Team, Technical Reviewers, AI Coding Agents  
> **Codebase Path:** `c:\Users\ADMIN\OneDrive\Desktop\HACA\TECH\haca-forge`  
> **Specification References:** [WORKFLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/WORKFLOW.md), [UX_SPEC.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/UX_SPEC.md), [SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/SCOPE_RESET.md), and [PROGRESS.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/PROGRESS.md)  
> **Monorepo Version:** `1.0.0` (Marketing OS Workflow V2 & Workspaces WS1-WS4 Architecture)  
> **Verification Status:** **100% Green** across monorepo: 423/423 backend tests passing (25 test suites); 51/51 web tests passing (8 test suites); **474 total tests passing (33 test suites)**; clean TypeScript compilation (`tsc --noEmit`); zero linter errors.

---

## Table of Contents
1. [Project Overview & Scope Reset](#1-project-overview--scope-reset)
2. [Project Structure & Monorepo Architecture](#2-project-structure--monorepo-architecture)
3. [Technology Stack](#3-technology-stack)
4. [User Roles and Permissions (The 5 Canonical Roles)](#4-user-roles-and-permissions-the-5-canonical-roles)
5. [Workflow V2: Content Flow, Plans & Pipelines](#5-workflow-v2-content-flow-plans--pipelines)
6. [Work Items, Transitions & State Machine](#6-work-items-transitions--state-machine)
7. [The 8-Section Operational Dashboard](#7-the-8-section-operational-dashboard)
8. [The 4 Canonical Reports](#8-the-4-canonical-reports)
9. [The 6 Automation Rules & Worker Dispatcher](#9-the-6-automation-rules--worker-dispatcher)
10. [Team Workload & Capacity Engine](#10-team-workload--capacity-engine)
11. [Feedback Loops, Blockers & Revision Flags](#11-feedback-loops-blockers--revision-flags)
12. [Authentication, Session Refresh & Socket Security](#12-authentication-session-refresh--socket-security)
13. [Workspaces Architecture: Writing Studio, Review Studio, Media Workspaces & Quality Ratings (WS1 to WS4)](#13-workspaces-architecture-writing-studio-review-studio-media-workspaces--quality-ratings-ws1-to-ws4)
14. [Inventory: What Remains vs What Was Removed](#14-inventory-what-remains-vs-what-was-removed)
15. [Testing & Quality Assurance](#15-testing--quality-assurance)
16. [Launch & Production Checklist](#16-launch--production-checklist)

---

# 1. Project Overview & Scope Reset

### 1.1 Project Mission
**HACA Marketing OS** is the unified, authoritative marketing operations cockpit and content production pipeline engine built exclusively for the HACA educational network.

It replaces fragmented Google Sheets, manual spreadsheets, and ad-hoc chat approvals with an audited, deterministic, and role-governed workflow system.

### 1.2 The Scope Reset (R1 – R4) & Workflow V2
During system hardening, all unneeded commercial CRM baggage, multi-tenant brand switching overhead, and legacy ticketing features were permanently stripped from the platform:
* **Scope Reset R1:** Removed all commercial lead management, LeadSquared (LSQ) integrations, campaigns, and monthly revenue targets. Refocused the system on **Work and Team Management** under a single unified HACA profile (`profileId: 'haca'`).
* **Scope Reset R2:** Retired legacy role names (`marketing_head`, `team_lead`) in favor of **5 clean Canonical Roles**: `admin`, `creative_head`, `sm_manager`, `team_member`, and `executive`.
* **Scope Reset R3:** Built the complete spreadsheet-to-pipeline content lifecycle: `CalendarPlan` generation, Excel template/validation preview, row-by-row Creative Head review, automated backward stage scheduling, sequential locking/unlocking, and intelligent workload-aware assignment.
* **Scope Reset R4:** Completed the 8-section operational dashboard, 4 saved reports, 6 worker-scheduled automation rules, real uncapped workload analytics, silent session refresh-and-retry, socket authentication security, and end-to-end role journeys.
* **Workflow V2 Hardening:** Streamlined plan architecture to 2 plan kinds (`monthly` and `individual`), 15 deliverable types with postable flags, calendar-day backward due-date offsets, instant pre-approval stage auto-fill, plan submission validation blocking, tracker live auditing (holder, lateByDays, lag, wait), whole-plan rejection with strategic concern, and UX flat menu restructuring ($\le 8$ items per role).

---

# 2. Project Structure & Monorepo Architecture

The repository is organized as a private npm workspace monorepo:

```
haca-forge/
├── apps/
│   ├── api/                     # Express 5 REST API & Socket.io server
│   │   ├── src/
│   │   │   ├── config/          # Environment schema (Zod), MongoDB & Redis connectors
│   │   │   ├── lib/             # Mailer, Scope resolution, Cloudinary
│   │   │   ├── middleware/      # Authentication (JWT), CASL RBAC, rate-limiting, error handling
│   │   │   ├── modules/         # Domain modules (access, assignment, auth, automation,
│   │   │   │                    #  blockers, calendar, departments, feedback, notifications,
│   │   │   │                    #  people, referenceData, reports, workItems)
│   │   │   └── server.js        # Express app and Socket.io server entry
│   │   └── test/                # 18 Vitest test suites (302 tests, 100% passing)
│   └── web/                     # React 18 + Vite frontend application
│       ├── src/
│       │   ├── components/      # Layout, GlobalFilterBar, NotificationCenter, Skeletons
│       │   ├── context/         # AuthContext, NotificationContext, SocketContext
│       │   ├── lib/             # API client with token refresh mutex & query client
│       │   ├── pages/           # Flat-route pages (Dashboard, Plans, Tracker, Approvals,
│       │   │                    #  Workload, Problems, Reports, People, Requests, My Work)
│       │   └── App.tsx          # React Router 7 route definitions & redirects
│       └── test/                # 3 Vitest frontend test suites (11 tests, 100% passing)
├── packages/
│   └── shared/                  # Isomorphic schemas, pipelines, enums, offsets, validation
│       └── src/index.ts         # Single source of truth for canonical workflow types
├── docs/                        # Authoritative documentation (WORKFLOW.md, UX_SPEC.md, etc.)
└── test/
    └── e2e/                     # Playwright role journeys test specification
```

---

# 3. Technology Stack

* **Runtime:** Node.js `>=22.0.0` (ESM native)
* **Backend Framework:** Express 5.0 with express-rate-limit and Helmet
* **Database:** MongoDB 8.x with Mongoose 8.12
* **Frontend Framework:** React 18.3, Vite 6.4, Tailwind CSS, Lucide Icons, Recharts 3.10
* **Routing:** React Router 7 with unified flat-menu navigation
* **Validation & Schemas:** Zod 3.24 (shared isomorphic package `@mmp/shared`)
* **Realtime:** Socket.io 4.8 with strict JWT handshake authentication
* **Test Runner:** Vitest 3.2 (API & Web) and Playwright Test (E2E)

---

# 4. User Roles and Permissions (The 5 Canonical Roles)

The platform strictly enforces 5 canonical roles:

| Role Key | Display Name | Primary Responsibilities & Permitted Actions |
|---|---|---|
| **`admin`** | Administrator | Full platform authority: system settings, user management, access request approvals, reports, automation. |
| **`creative_head`** | Creative Head | Editorial authority: plan reviews, row change requests, plan rejection with concern, review stage approvals, revision root-cause classification. |
| **`sm_manager`** | SM Manager | Operational lead: monthly & individual plan building, row authoring, stage assignment, post-approval changes, tracker audit. |
| **`team_member`** | Team Member / Worker | Deliverable execution: My Work dashboard, stage start/submit, deliverable URL upload, "Done and forward" for Shoot, blocker reporting. |
| **`executive`** | Executive Director | Global oversight: read-only access to all dashboards, plans, tracker, and reports. All mutation endpoints return HTTP 403. |

### Flat Menu Structure (No more than 8 items per role)
* **Admin:** Home, Plans, Tracker, Approvals, Team load, Problems, Reports, People, Requests
* **Creative Head:** Home, Plans, Tracker, Approvals, Team load, Problems, Reports, Feedback
* **SM Manager:** Home, Plans, Tracker, Approvals, Team load, Problems, Reports, My Work
* **Team Member:** Home, My Work, Problems, My Account
* **Executive:** Home, Plans, Tracker, Approvals, Team load, Problems, Reports

---

# 5. Workflow V2: Content Flow, Plans & Pipelines

### 5.1 Plan Types
Two plan kinds only:
1. **`monthly` (Monthly Calendar Plan):** Recurring monthly social and marketing deliverable grid. Title carries the school (e.g. `Tech School November 2026`). Built around the 25th of the prior month.
2. **`individual` (Individual Work):** Standalone plan with **exactly one deliverable row**, using the exact same form, auto-fill, and approval flow.

> **Removed:** The `project` plan kind is permanently retired (there are no department leads or siloed planning layers). Events and programs are grouped using the row field `Program or event`.

### 5.2 Deliverable Types & Postable Flags
The platform supports 15 deliverable types:
* **Postable Deliverables (`hasPostStage: true`):** `Reel`, `Static Post`, `Carousel Post`, `Story`, `Cover Image`, `Thumbnail`, `Meta Ad Creative`, `Class Announcement`, `Orientation Creative`, `Graduation Creative`, `Offer Creative`, `Custom Request`. Requires a designated `postingOwnerId`.
* **Non-Postable Deliverables (`hasPostStage: false`):** `Poster`, `Brochure`, `Certificate`. Has no `Post` stage; terminates upon Creative Head `Design` approval.

### 5.3 Pipelines & Backward Stage Offsets
Deadlines are calculated backward in calendar days from the target date ($F$):

| Pipeline Key | Stages Generated | Offsets from $F$ | Stage Types |
|---|---|---|---|
| **`reel_a`** | Script $\rightarrow$ Shoot $\rightarrow$ Edit $\rightarrow$ Post | $F-8$, $F-5$, $F-2$, $F-0$ | Script (Review) $\rightarrow$ Shoot (Non-Review, Done and Forward) $\rightarrow$ Edit (Review) $\rightarrow$ Post (Publish) |
| **`reel_b`** | Shoot $\rightarrow$ Edit $\rightarrow$ Post | $F-5$, $F-2$, $F-0$ | Shoot (Non-Review) $\rightarrow$ Edit (Review) $\rightarrow$ Post (Publish) |
| **`reel_c`** | Edit $\rightarrow$ Post | $F-2$, $F-0$ | Edit (Review) $\rightarrow$ Post (Publish) |
| **`design` (postable)** | Content $\rightarrow$ Design $\rightarrow$ Post | $F-5$, $F-2$, $F-0$ | Content (Review) $\rightarrow$ Design (Review) $\rightarrow$ Post (Publish) |
| **`design` (non-postable)** | Content $\rightarrow$ Design | $F-5$, $F-2$ | Content (Review) $\rightarrow$ Design (Review) |

### 5.4 Default Stage Hours
Internal engine configuration (`DEFAULT_STAGE_HOURS`: Content 2h, Script 2h, Design 4h, Shoot 4h, Edit 6h, Post 1h). **Never shown in user forms.**

### 5.5 Plan Submission & Validation Engine
The plan builder validates rows on every type, date, or owner change. `POST /api/calendar-plans/:id/submit` blocks submission if errors exist (HTTP 400 `PLAN_SUBMISSION_BLOCKED`):
* **Validation Errors (8 codes):** `MISSING_REQUIRED_FIELDS`, `UNKNOWN_TYPE`, `PAST_DATE`, `DUPLICATE_IN_PLAN`, `DUPLICATE_TOPIC_SAME_DAY`, `INVALID_POSTING_TIME`, `INDIVIDUAL_PLAN_ROW_LIMIT`, `MISSING_POSTING_OWNER`.
* **Validation Warnings (4 codes):** `MONTH_MISMATCH`, `NON_PREFERRED_OWNER`, `OVERLOADED_OWNER`, `SHORT_LEAD_TIME`.

### 5.6 Creative Head Plan Review & Whole-Plan Rejection
* **Approve All / Approve Selected:** Generates `WorkItem` stages for approved rows with chosen owners and dates. Stage 1 is unlocked immediately; Stages 2..N are locked.
* **Request Changes:** Moves specific rows to `changes_requested` with row-level comments.
* **Reject Whole Plan:** Action `'reject'` requires a strategic `rejectionConcern`. Moves all submitted rows to `changes_requested`, stores concern on plan and rows, and notifies SM Manager.

### 5.7 Live Content Tracker
Audits all deliverables across profiles:
* **`holder`:** Indicates current operational owner:
  - Active worker name (when unlocked and assigned)
  - `Locked` (waiting on upstream stage completion)
  - `SM Manager` (unassigned stage needing an owner)
  - `Creative Head` (stage submitted to `Feedback` pending approval)
  - `Blocked since YYYY-MM-DD` (active blocker)
  - `Done` (all stages finished or published)
* **`lateByDays`:** Calendar days overdue past stage deadline.
* **`ownerLagDays`:** Days elapsed past deadline before worker submitted for review.
* **`approvalWaitDays`:** Days deliverable sat in `Feedback` waiting for Creative Head sign-off.
* **`pieceStatus`:** `On Track`, `At Risk`, `Late`, `Done`.
* **Post-Approval Changes:**
  - `PATCH /api/content-pieces/:id/reassign`: Reassign unstarted stage to a different team member.
  - `PATCH /api/content-pieces/:id/deadline`: Change stage deadline (requires override reason; shifts downstream stages).
  - `PATCH /api/content-pieces/:id/stages/:stageKey/skip`: Skip or restore a stage before work begins.

---

# 6. Work Items, Transitions & State Machine

The central transition service (`transition.service.js`) enforces strict state governance:

```
[Not Started] ──> [In Progress] ──> [Feedback] ──> [Approved] ──> [Published]
                       │                │
                       └───< Blocked <──┘
```

* **Starting Work:** Worker transitions from `Not Started` to `In Progress`.
* **Submitting for Review:** Worker transitions from `In Progress` to `Feedback` with a valid `deliverableUrl`.
* **Revision Loop:** Creative Head transitions from `Feedback` to `In Progress` with a comment. Increments `revisions` counter and notifies worker.
* **Review Stage Approval:** Only `creative_head` and `admin` can approve review stages. Unlocks next stage (`isLocked = false`).
* **Shoot "Done and Forward":** Shoot is non-review. Worker transitions to `Approved` with footage URL, immediately unlocking Edit without waiting for Creative Head review.
* **Publication:** Posting owner marks `Published` with live `publishedUrl`, recording `publishedAt` and calculating `turnaroundDays`.

---

# 7. The 8-Section Operational Dashboard

1. **Month Plan Status:** Code, title, status, and planned vs completed deliverables.
2. **KPI Strip:** Planned, Completed, In Progress, At Risk, Blocked, Pending Approval, Overdue.
3. **Today's Priorities:** High-priority items and overdue deliverables requiring action.
4. **Production Stats & Trend:** Output throughput and 4-week trend.
5. **Team Workload:** Uncapped percentage with capacity bands ($<65\%$, $65-85\%$, $>85\%$).
6. **Issues & Blockers:** Unresolved dependencies, active blockers, and stagnation alerts.
7. **Waiting for Approval:** Queue for Creative Head showing submitted plans and review stages.
8. **Recent Activity:** Real-time audit log of transitions, submissions, and publications.

---

# 8. The 4 Canonical Reports

| Report Key | Title | Summary & Dimensions |
|---|---|---|
| **`weekly_marketing`** | Weekly Work Report | Weekly output volume, stage throughput, on-time completions, active blockers. |
| **`monthly_scorecard`** | Monthly Performance Scorecard | Planned vs published pieces, on-time rate, revision rate. Zero commercial targets. |
| **`creative_production`** | Creative Production Report | Velocity and turnaround times sliced by department and stage key. |
| **`team_performance`** | Team Performance Digest | Output (25%), Efficiency (25%), Quality (25%), Collaboration (25%). |

---

# 9. The 6 Automation Rules & Worker Dispatcher

1. **`month_end_report`:** Monthly on last day at 23:00. Compiles scorecard and emails summary.
2. **`overdue_escalation`:** Hourly. Pings owner immediately; escalates to SM Manager once if overdue $>4\text{ hours}$.
3. **`todo_escalation`:** Daily at 08:30. Flags unstarted high-priority tasks.
4. **`blocker_dependency_alert`:** Every 2 hours. Reminds dependency owners of active blockers.
5. **`revision_pattern_flag`:** Every 4 hours. Flags deliverables with $\ge 4$ revisions to Creative Head.
6. **`weekly_report`:** Friday at 18:00. Aggregates weekly production velocity.

---

# 10. Team Workload & Capacity Engine

* **Real Percentage Display:** Uncapped load (e.g. `120% Workload`).
* **Three Capacity Bands:** Healthy ($<65\%$), High ($65\% - 85\%$), Overloaded ($>85\%$).
* **Intelligent Auto-Assignment:** Evaluates `Person.workPreferences`, excludes members $\ge 85\%$, and ranks by lowest active load and fewest 90-day revisions.

---

# 11. Feedback Loops, Blockers & Revision Flags

* **Canonical Blocker Reasons (9):** `Waiting for feedback`, `Waiting for content`, `Waiting for data`, `Asset missing`, `Brief unclear`, `Technical issue`, `External dependency`, `Resource issue`, `Other`.
* **Blocker Notifications:** Blocker creation immediately alerts both the dependency owner and the SM Manager, displaying `Blocked since <date>` in the Tracker.
* **Canonical Revision Root Causes (7):** `Brief unclear`, `Creative direction unclear`, `Technical error`, `Brand guideline deviation`, `Scope change`, `Approval delay`, `Other`.

---

# 12. Authentication, Session Refresh & Socket Security

* **Shared Refresh Mutex:** Token refresh interceptor silently updates expired access tokens without user interruption.
* **Socket Handshake Guard:** Socket.io verifies JWT before allowing websocket connections.
* **Zero Hardcoded Credentials:** Banned from git; loaded strictly from environment variables.

---

---

# 13. Workspaces Architecture: Writing Studio, Review Studio, Media Workspaces & Quality Ratings (WS1 to WS4)

The **Workspaces Engine** delivers dedicated, rich media authoring, reviewing, and quality feedback stations for every creative role in the HACA Marketing operations lifecycle:

### 13.1 Writing Studio (`WS1`)
* **ProseMirror/Tiptap A4 Canvas:** Dedicated scriptwriting environment at `/work/:id/writing-studio` with split-screen brief viewer, automated word count and reading time calculator, and search & replace modal.
* **Structured Scene Table:** Visual scene extraction table (`visual` and `audio` columns) auto-populates downstream videographer shot lists.
* **Interoperability:** DOCX import via `mammoth`, DOCX export via `docx`, and browser-native `@media print` PDF generation.

### 13.2 Review Studio (`WS2`)
* **High-Throughput Review Cockpit:** Dedicated station at `/feedback/review-studio` for `creative_head` and `admin`.
* **FIFO Queue Ordering:** Oldest waiting submissions appear first with queue position indicators and auto-advance to next item upon review decision.
* **Specialized Media Viewers:**
  - *Document Viewer:* Side-by-side or inline text diff highlighting additions and deletions.
  - *Video Player:* HTML5 player with variable playback speed and timecode-pinned feedback markers.
  - *Image & Carousel Viewer:* Pan & zoom controls, coordinate point pins, and multi-slide gallery strip.
  - *Link Opener:* Secure fallback viewer for external assets.
* **Persistent Decision Bar:** Enforces mandatory 1 to 5 star rating, qualitative notes, and standard tags on approval; revision requests require anchored comments or an overall note plus root cause classification.

### 13.3 Role Workspaces & Earlier Outputs (`WS3`)
* **Videographer Workspace (`Shoot`):** Shot list extraction from upstream script, shoot notes, and multi-clip raw footage upload.
* **Editor Workspace (`Edit`):** Direct stream access to raw footage packages, approved script text, and interactive revision comment resolution checklist.
* **Designer Workspace (`Design`):** Carousel slide management with drag-and-drop reordering, copy inspection, and asset upload.
* **Poster Workspace (`Post`):** Platform pre-publish checklist, live social URL recording, caption/hashtag clipboard tools, and direct transition to `Published`.
* **Earlier Outputs Viewer:** Read-only cards allowing downstream contributors on the same piece to inspect upstream deliverables without cross-team leakage.

### 13.4 Quality Ratings & Feedback Architecture (`WS4`)
* **Institutional Scope & Guardrails:** Ratings evaluate the craftsmanship and creative quality of approved deliverables for coaching and growth. Strictly decoupled from compensation, pay, or financial incentives.
* **Strict Anti-Comparison Rules:** Zero leaderboards, zero worker rankings, zero percentile comparisons, and zero export of ratings by person. Workers see strictly their own ratings; `creative_head`, `sm_manager`, `admin`, and `executive` (read-only) can inspect ratings across team member profiles.
* **3-Rating Minimum Threshold:** A profile displays `"Not enough ratings yet"` (with a baseline collection notice) until at least 3 ratings exist, preventing statistical distortion from single scores.
* **Profile Metrics:** Once $\ge 3$ ratings exist, computes rolling 30-day, 90-day, and all-time averages, total count, 6-month monthly trend chart, 1 to 5 star distribution bars, and average per step type (`Script`, `Shoot`, `Edit`, `Design`, `Post`).
* **Seen Marker & Edit Log:** Workers can mark ratings and feedback as seen. A rating can only be edited by the original rater or an admin with a mandatory correction reason, recorded into `editedLog` and `ActivityEvent`.
* **Aggregated Reports:** Team average quality rating and step type breakdowns are included strictly as aggregated baseline figures in the Creative Production Report and Team Performance Digest.

---

# 14. Inventory: What Remains vs What Was Removed

### What Remains (The Lean Core)
* **5 Roles:** `admin`, `creative_head`, `sm_manager`, `team_member`, `executive`.
* **Unified School Scoping:** HACA network profile (`profileId: 'haca'`).
* **2 Plan Kinds:** `monthly` and `individual`.
* **15 Work Types & 5 Pipelines:** Structured stages with calendar-day backward offsets.
* **Live Tracker & Operations Cockpit:** End-to-end auditability and stage handoffs.
* **Integrated Creative Workspaces:** Writing Studio, Review Studio, Media Workspaces, Quality Ratings.

### What Was Removed (Permanently Deleted)
* ❌ Commercial Leads & CRM (LSQ integrations, sync runs, commercial targets).
* ❌ `project` plan kind and Department Lead silos.
* ❌ Legacy role names (`marketing_head`, `team_lead`, obsolete `Lead` labels).
* ❌ Commercial sales widgets, leaderboard widgets, and funnel charts.
* ❌ Legacy link-only submission placeholders.

---

# 15. Testing & Quality Assurance

### Test Suite Summary: 474 Total Tests Passing (100% Green)

| Workspace / Package | Test Suites | Total Tests | Status |
|---|---|---|---|
| **`apps/api` (Backend)** | 25 Files | 423 Tests | **PASSED (100%)** |
| **`apps/web` (Frontend)** | 8 Files | 51 Tests | **PASSED (100%)** |
| **Monorepo Total** | **33 Suites** | **474 Tests** | **PASSED (100%)** |

### Verified Test Suites
1. **`workspaces_ws4_journeys.test.js` (16 tests):** Complete End-to-End role journeys A through G:
   - *Journey A:* Writer Writing Studio, revision loop with anchored comments, fixes & approval with 5★ rating and tag.
   - *Journey B:* Shoot workspace footage approval; Edit workspace time-pinned revision loop & approval.
   - *Journey C:* Designer workspace carousel images submission & approval.
   - *Journey D:* Posting owner live social URL publishing.
   - *Journey E:* Workers inspect own profile ratings; Creative Head inspects all profiles.
   - *Journey F:* Strict guardrails: 403 Forbidden on cross-worker rating inspection and unauthorized access.
   - *Journey G:* Executive read-only walk: inspection permitted, modification/approval strictly 403 forbidden.
2. **`workspaces_ws4_ratings.test.js` (20 tests):** Profile mathematics (30d, 90d, all-time, count, monthly trend, distribution, step breakdown), 3-rating minimum threshold, mark seen, rating correction log, role scoping, report aggregates, zero ranking guardrail.
3. **`workspaces_ws4_journeys.spec.js`:** Playwright E2E browser journeys test specification.
4. **`workspaces_ws1_submissions.test.js` (17 tests):** Submissions, draft autosave, version monotonic increment, comments anchoring.
5. **`workspaces_ws2_review.test.js` (16 tests):** Review queue oldest-first ordering, approval with mandatory rating, revision with root cause, auto-advance.
6. **`workspaces_ws3_media.test.js` (15 tests):** Multi-file chunked upload engine, media metadata extraction, earlier outputs scoping.
7. **`RatingsFeedbackSection.test.tsx` (7 tests):** Frontend profile section rendering, below-threshold state, stats cards, trend chart, distribution, seen acknowledgment, edit modal.
8. **`ReviewStudio.test.tsx` (10 tests):** DecisionBar rating requirement, DocumentViewer diff, VideoPlayerViewer timecode markers, ImageViewer coordinate pins, ReviewStudioSidebar.
9. **`Workspaces.test.tsx` (5 tests):** ShootWorkspace, EditWorkspace, DesignWorkspace, PostWorkspace, EarlierOutputsViewer.
10. **`workflow_v2_journeys.test.js` (17 tests):** Workflow V2 role journeys A through G.
11. **`scope_reset_r4.test.js` (26 tests):** Lifecycle journey across 5 roles, dashboard sections, saved reports, automation rules.
12. **`scope_reset_r3.test.js` (23 tests):** Plan authoring, validations, approvals, stage offsets, locking/unlocking, assignment engine.
13. **`scope_reset_r2.test.js` (14 tests):** Role permissions matrix, migration, access requests.
14. **`scope_reset_r1.test.js` (7 tests):** Verification of commercial CRM deletion.
15. **`work_items_and_transitions.test.js` (24 tests):** Work item state machine, transition guards, stage fields.
16. **`assignment_and_workload.test.js` (19 tests):** Uncapped workload bands and recommendation algorithm.
17. **`feedback_and_blockers.test.js` (15 tests):** Blocker creation, dependency owner alerts, revision flags.
18. **`automation_and_reports.test.js` (16 tests):** Scheduled rules runner, report generation.
19. **`executive_role.test.js` (24 tests):** Executive read-only permissions across all models.
20. **`DashboardRoleViews.test.tsx` (5 tests):** Role-specific dashboard widgets and executive guards.
21. **`CalendarTabs.test.tsx` (5 tests):** 3-tab navigation, SM Manager plan authoring, worker notices.
22. **`App.test.tsx` (1 test):** Application smoke test.

---

# 16. Launch & Production Checklist

- [x] **Monorepo Build:** `npm run build` cleanly compiles `@mmp/shared` and `@mmp/web`.
- [x] **Typecheck Clean:** `npm run typecheck` passes with 0 TypeScript errors across all workspaces.
- [x] **Test Verification:** 474/474 tests pass with 100% success rate across 33 test suites.
- [x] **Workspaces E2E Journeys Verified:** Automated journeys A through G pass across both integration and E2E suites.
- [x] **Strict Guardrails Enforced:** Zero leaderboards, zero user rankings, zero cross-worker rating comparisons; ratings decoupled from compensation.
- [x] **Privacy & Role Scoping:** Workers see strictly their own ratings; leaders (`creative_head`, `sm_manager`, `admin`, `executive`) can view all profiles; executive is strictly read-only.
- [x] **Regression Cleanliness:** Zero hits for obsolete `FORGE`, old `Lead` labels, or link-only submission placeholders.
- [x] **Responsive Mobile Layouts:** Writing Studio, Review Studio, and Media Workspaces adapt smoothly to mobile viewports with accessible keyboard navigation.
- [x] **Database Seed Ready:** Verified clean seed scripts for demo and administration.
- [x] **Zero Hardcoded Secrets:** Audited code and documentation.

