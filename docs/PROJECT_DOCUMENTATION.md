# HACA Marketing OS: Complete System & Architecture Documentation

> **Document Type:** Master Project Architecture & Implementation Reference  
> **Target Audience:** Engineering Team, Technical Reviewers, AI Coding Agents  
> **Codebase Path:** `c:\Users\ADMIN\OneDrive\Desktop\HACA\TECH\haca-forge`  
> **Specification References:** [SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/SCOPE_RESET.md), [CONTENT_FLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/CONTENT_FLOW.md), and [PROGRESS.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/PROGRESS.md)  
> **Monorepo Version:** `1.0.0` (Marketing OS Architecture)  
> **Verification Status:** **100% Green** across monorepo: 291/291 backend tests passing (17 test suites); 11/11 web tests passing (3 test suites); clean TypeScript compilation; production build passing.

---

## Table of Contents
1. [Project Overview & Scope Reset](#1-project-overview--scope-reset)
2. [Project Structure & Monorepo Architecture](#2-project-structure--monorepo-architecture)
3. [Technology Stack](#3-technology-stack)
4. [User Roles and Permissions (The 5 Canonical Roles)](#4-user-roles-and-permissions-the-5-canonical-roles)
5. [Content Flow, Calendar Plans & Pipelines](#5-content-flow-calendar-plans--pipelines)
6. [Work Items, Transitions & State Machine](#6-work-items-transitions--state-machine)
7. [The 8-Section Operational Dashboard](#7-the-8-section-operational-dashboard)
8. [The 4 Canonical Reports](#8-the-4-canonical-reports)
9. [The 6 Automation Rules & Worker Dispatcher](#9-the-6-automation-rules--worker-dispatcher)
10. [Team Workload & Capacity Engine](#10-team-workload--capacity-engine)
11. [Feedback Loops, Blockers & Revision Flags](#11-feedback-loops-blockers--revision-flags)
12. [Authentication, Session Refresh & Socket Security](#12-authentication-session-refresh--socket-security)
13. [Inventory: What Remains vs What Was Removed](#13-inventory-what-remains-vs-what-was-removed)
14. [Testing & Quality Assurance](#14-testing--quality-assurance)
15. [Launch & Production Checklist](#15-launch--production-checklist)

---

# 1. Project Overview & Scope Reset

### 1.1 Project Mission
**HACA Marketing OS** is the unified, authoritative marketing operations cockpit and content production pipeline engine built exclusively for the HACA educational network.

It replaces fragmented Google Sheets, manual spreadsheets, and ad-hoc chat approvals with an audited, deterministic, and role-governed workflow system.

### 1.2 The Scope Reset (R1 – R4)
During system hardening, all unneeded commercial CRM baggage, multi-tenant brand switching overhead, and legacy ticketing features were permanently stripped from the platform:
* **Scope Reset R1:** Removed all commercial lead management, LeadSquared (LSQ) integrations, campaigns, and monthly revenue targets. Refocused the system on **Work and Team Management** under a single unified HACA profile (`profileId: 'haca'`).
* **Scope Reset R2:** Retired legacy role names (`marketing_head`, `team_lead`) in favor of **5 clean Canonical Roles**: `admin`, `creative_head`, `sm_manager`, `team_member`, and `executive`.
* **Scope Reset R3:** Built the complete spreadsheet-to-pipeline content lifecycle: `CalendarPlan` generation, Excel template/validation preview, row-by-row Creative Head review, automated backward stage scheduling, sequential locking/unlocking, and intelligent workload-aware assignment.
* **Scope Reset R4:** Completed the 8-section operational dashboard, 4 saved reports, 6 worker-scheduled automation rules, real uncapped workload analytics, silent session refresh-and-retry, socket authentication security, and end-to-end role journeys.

---

# 2. Project Structure & Monorepo Architecture

The repository is organized as a private npm workspace monorepo:

```
haca-forge/
├── apps/
│   ├── api/                     # Express 5 REST API & Socket.io server
│   │   ├── src/
│   │   │   ├── config/          # Environment schema (Zod), MongoDB & Redis connectors
│   │   │   ├── lib/             # Mailer, Scope resolution, Cloudinary, Sentry
│   │   │   ├── middleware/      # Authentication (JWT), CASL RBAC, rate-limiting, error handling
│   │   │   ├── modules/         # Domain modules (access, assignment, auth, automation,
│   │   │   │                    #  blockers, calendar, departments, feedback, notifications,
│   │   │   │                    #  people, referenceData, reports, workItems)
│   │   │   ├── server.js        # Express app and Socket.io server bootstrap
│   │   │   └── worker.js        # Standalone BullMQ worker process & interval cron dispatcher
│   │   └── test/                # 17 Vitest integration suites (291 tests)
│   └── web/                     # React 18 + Vite frontend SPA
│       ├── src/
│       │   ├── components/      # Layout, GlobalFilterBar, Modal, Table, UI primitives
│       │   ├── context/         # AuthContext, GlobalFilterContext, SocketContext
│       │   ├── hooks/           # useAuth, useSocket, usePermissions
│       │   ├── lib/             # apiFetch with refresh-and-retry mutex
│       │   └── pages/           # Role-based views: Dashboard, Calendar, Work, MyWork,
│       │                        #  Feedback, Workload, Issues, Reports, Admin Users
│       └── src/pages/**/*.test.tsx # Frontend Vitest + React Testing Library suites
├── packages/
│   └── shared/                  # Shared TypeScript types, Zod schemas, role permissions,
│                                #  constants, pipelines, and validation rules
├── scripts/                     # Seed scripts, demo data, role migration utilities
└── docs/                        # Architecture specs, SCOPE_RESET.md, PROGRESS.md
```

---

# 3. Technology Stack

| Layer | Technologies | Key Libraries / Frameworks |
|---|---|---|
| **Backend API** | Node.js 22+, Express 5 (ESM) | Mongoose 8, JWT, bcryptjs, CASL (`@casl/ability`), Multer, Pino, Helmet, HPP, express-mongo-sanitize |
| **Realtime Sockets** | Socket.io 4.8 | JWT handshake authentication guard, role-based and profile-based rooms |
| **Worker / Queue** | BullMQ 6, Redis 6+ / In-Memory | Scheduled automation dispatcher, periodic escalation jobs |
| **Web Frontend** | React 18, Vite 6, TypeScript 5.8 | React Router v7, TanStack Query v5, TanStack Table v8, Tailwind CSS 3, Lucide Icons |
| **Testing** | Vitest 3, Supertest 7 | `@testing-library/react`, `@testing-library/jest-dom`, JSDOM |
| **Code Hygiene** | ESLint 9, Prettier 3 | Zero uncommitted credentials, environment-isolated passwords |

---

# 4. User Roles and Permissions (The 5 Canonical Roles)

The platform enforces strict role-based access control (RBAC) via `@casl/ability` and `@mmp/shared`.

### 4.1 Canonical Roles Summary

| Role Key | Display Name | Landing Route | Description & Primary Capabilities |
|---|---|---|---|
| **`admin`** | Administrator | `/dashboard` | System administrator with full technical authority. Dynamically holds all permissions. Manages access requests, users, departments, and system configuration. |
| **`creative_head`** | Creative Head | `/dashboard` | Operational creative authority. Reviews and approves calendar plan rows, reviews deliverable submissions, triggers report generation, and oversees automation rules. |
| **`sm_manager`** | SM Manager | `/dashboard` | Social media planner and distributor. Authorizes and uploads calendar plans, submits plans for review, confirms stage assignments, and publishes live URLs. |
| **`team_member`** | Team Member | `/my-work` | Creative execution worker (writers, designers, editors, cinematographers). Self-scoped access to assigned stage deliverables on My Work. Submits deliverables for review. |
| **`executive`** | Executive | `/dashboard` | C-Suite, Business Head, and Stakeholders. Complete read-only visibility into dashboard, calendar plans, tracker, and reports across all departments. Zero mutation rights. |

### 4.2 Canonical Permissions Matrix (`ROLE_PERMISSIONS`)

```ts
export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  admin: [...PERMISSION_KEYS], // Dynamically holds all system permissions
  creative_head: [
    'portal.view',
    'people.view',
    'people.assign',
    'calendar.approve',
    'feedback.give',
    'feedback.respond',
    'revision.classify',
    'assignment.override',
    'work.update.own',
    'analytics.team',
    'report.view',
    'report.configure',
    'automation.manage',
  ],
  sm_manager: [
    'portal.view',
    'people.view',
    'calendar.plan',
    'work.create',
    'assignment.override',
    'work.update.own',
    'feedback.respond',
    'analytics.team',
    'report.view',
  ],
  executive: [
    'portal.view',
    'people.view',
    'analytics.team',
    'report.view',
  ],
  team_member: [
    'work.update.own',
    'work.request',
    'feedback.respond',
  ],
};
```

---

# 5. Content Flow, Calendar Plans & Pipelines

### 5.1 The Planning Lifecycle (`CalendarPlan` & `ContentPiece`)
1. **Plan Authoring:** An `sm_manager` or `admin` creates a `CalendarPlan` (monthly or project-based) with a unique code (e.g. `PLAN-2026-10-001`).
2. **Spreadsheet Ingestion:** The planner can download a formatted Excel template (`GET /api/calendar-plans/template`) or upload a CSV/XLSX file.
3. **Pre-flight Validation Preview (`POST /api/calendar-plans/preview`):**
   - Flags invalid date formats and past dates.
   - Detects duplicate topics within the plan.
   - Rejects non-reel formats flagged with reel-only requirements (`needsScript`, `needsShoot`).
   - Verifies unknown or unsupported content types.
4. **Grid Row Authoring:** Rows are committed as `ContentPiece` documents in `Draft` status.
5. **Plan Submission:** The planner submits rows for review (`POST /api/calendar-plans/:id/submit`). Row status becomes `submitted`.
6. **Creative Head Review (`POST /api/calendar-plans/:id/review`):**
   - Creative Head can `approve_all`, `approve_selected`, or `request_changes` with per-row feedback comments.
   - **Critical Rule:** Stages are generated **only upon row approval**. Unapproved or rejected rows never spawn work items.
   - Approved rows cannot be edited or tampered with directly.

### 5.2 Content Production Pipelines
Each approved `ContentPiece` is routed through one of four predefined stage pipelines:

| Pipeline Key | Stages | Stage Hand-offs |
|---|---|---|
| **`design`** | Design $\rightarrow$ Post | Design (Review) $\rightarrow$ Post (Publish) |
| **`reel_a`** | Content $\rightarrow$ Shoot $\rightarrow$ Edit $\rightarrow$ Post | Content (Review) $\rightarrow$ Shoot (Non-Review) $\rightarrow$ Edit (Review) $\rightarrow$ Post (Publish) |
| **`reel_b`** | Shoot $\rightarrow$ Edit $\rightarrow$ Post | Shoot (Non-Review) $\rightarrow$ Edit (Review) $\rightarrow$ Post (Publish) |
| **`reel_c`** | Edit $\rightarrow$ Post | Edit (Review) $\rightarrow$ Post (Publish) |

### 5.3 Backward Scheduling & Sequential Locking
* **Backward Due-Date Offsets:** Stage deadlines are computed backward from the final posting date ($F$):
  - Post: $F$
  - Edit: $F - 2\text{ days}$
  - Shoot: $F - 4\text{ days}$
  - Script / Content: $F - 6\text{ days}$
* **Sequential Locking:** Stage 1 is created with `isLocked: false`. Stages 2 through $N$ are generated with `isLocked: true`.
* **Automatic Unlocking:** When Stage $k$ is approved (or marked "Done and forward" for non-review stages like `Shoot`), Stage $k+1$ automatically unlocks (`isLocked: false`, `unlockedAt: new Date()`) and dispatches a realtime notification to its assignee.

---

# 6. Work Items, Transitions & State Machine

### 6.1 State Machine Rules
The transition service (`transition.service.js`) governs deliverable lifecycles:

```
[Not Started] ──> [In Progress] ──> [Pending / Feedback] ──> [Approved] ──> [Published]
                       │                     │
                       └─────< Blocked <─────┘
```

* **Starting Work:** A worker must transition from `Not Started` to `In Progress` before submitting.
* **Review Submission:** Transition to `Pending` / `Feedback` requires a valid deliverable URL (`deliverableUrl`).
* **Creative Head Approval:** Only `creative_head` and `admin` hold authority to approve review stages. Workers cannot approve their own work.
* **Publishing:** The posting owner completes the final stage by transitioning to `Published` with a live URL (`publishedUrl`), automatically calculating total `turnaroundDays`.

---

# 7. The 8-Section Operational Dashboard

Designed exclusively for operational control (visible to `admin`, `creative_head`, `sm_manager`, and `executive`; `team_member` is redirected immediately to `/my-work`):

1. **Month Plan Status:** Displays plan code, title, derived status, and planned vs completed deliverables for the selected month.
2. **KPI Strip:** 7 clickable operational counters linking directly to filtered views:
   - *Planned*, *Completed*, *In Progress*, *At Risk*, *Blocked*, *Pending Approval*, *Overdue*.
3. **Today's Priorities:** Critical deliverables due today or escalated for immediate action.
4. **Production Stats & Trend:** Throughput velocity, completed stages count, and 4-week historical trend.
5. **Team Workload:** Departmental and member capacity utilization showing real uncapped percentage with capacity band coloring ($<65\%$, $65-85\%$, $>85\%$).
6. **Issues & Blockers:** Live summary of flagged dependencies, external blockers, and unresolved items.
7. **Waiting for Approval:** Dedicated review queue for the Creative Head showing submitted calendar plans and deliverables pending sign-off.
8. **Recent Activity:** Real-time audit log of transitions, approvals, submissions, and publications.

> **Strict Boundary:** The dashboard contains **zero** sales targets, lead funnels, campaign budgets, or sync run panels.

---

# 8. The 4 Canonical Reports

Accessible via `/reports` (`Generate Now` restricted to `creative_head` and `admin`; `executive` and `sm_manager` have read-only visibility):

| Report Key | Report Title | Dimensions & Metrics Included |
|---|---|---|
| **`weekly_marketing`** | Weekly Work Report | Weekly output volume, stage throughput, on-time completions, active blockers. |
| **`monthly_scorecard`** | Monthly Performance Scorecard | Planned vs published pieces, on-time delivery rate, revision rate, and average approval turnaround hours. (Zero commercial targets). |
| **`creative_production`** | Creative Production Report | Production velocity and turnaround sliced by department (Design, Video, Content) and stage key. |
| **`team_performance`** | Team Performance Digest | Objective evaluation across 4 dimensions: Output (25%), Efficiency (25%), Quality (25%), and Collaboration (25%). |

* **Custom Recipients:** Each report definition supports configurable distribution recipients containing user ObjectIds and external email addresses.

---

# 9. The 6 Automation Rules & Worker Dispatcher

The background automation runner (`runner.js`) and worker (`worker.js`) schedule and dispatch 6 canonical operational rules:

| Rule Key | Schedule | Behavior & Escalation Path |
|---|---|---|
| **`month_end_report`** | Monthly (last day 23:00) | Compiles monthly scorecard and dispatches report digests to configured recipients. |
| **`overdue_escalation`** | Hourly | Notifies deliverable owner immediately upon due date breach. Escalates to SM Manager if overdue $>4\text{ hours}$. |
| **`todo_escalation`** | Daily (08:30) | Audits unstarted high-priority tasks and notifies assignees. |
| **`blocker_dependency_alert`** | Every 2 hours | Checks unresolved blockers and alerts dependency owners. |
| **`revision_pattern_flag`** | Every 4 hours | Flags deliverables with $\ge 4$ revisions or abnormal rework to Creative Head. Escalates if unclassified $>48\text{ hours}$. |
| **`weekly_report`** | Weekly (Friday 18:00) | Aggregates weekly production stats and delivers digest. |

* **Execution Tracking:** Each rule records `lastRunAt` and `lastRunStatus` (`success` / `failed`), rendered in the automation UI with one-click manual execution support.

---

# 10. Team Workload & Capacity Engine

* **Real Percentage Display:** Workload metrics display true uncapped load (e.g. `125% Workload`), with progress bars visually capped at 100% to maintain clean UI rendering.
* **Three Capacity Bands:**
  - **Healthy ($<65\%$):** Optimal capacity, prioritized for new stage assignments.
  - **High ($65\% - 85\%$):** Nearing saturation; assign with caution.
  - **Overloaded ($>85\%$):** Strictly excluded from automated assignment recommendations.
* **Intelligent Auto-Assignment Recommendation:** Evaluates `Person.workPreferences`, excludes overloaded members ($\ge 85\%$), and ranks candidates by: Lowest active workload $\rightarrow$ Fewest 90-day revisions $\rightarrow$ Earliest available bandwidth.

---

# 11. Feedback Loops, Blockers & Revision Flags

* **Two-Entry Review Model:** Formalizes reviews into structured rounds (`Revision Required` vs `Approved`).
* **Mandatory Blocker Classification:** When a deliverable is blocked, reporters must specify category (`Asset Missing`, `Brief Ambiguous`, `Technical Issue`, `External Dependency`) and assign a dependency owner.
* **Revision Flags:** Deliverables reaching $\ge 4$ revisions or exceeding baseline average by $>1.5\sigma$ are flagged for Creative Head root-cause classification (`Scope Creep`, `Ambiguous Brief`, `Skill Gap`, `Client Preference Change`).

---

# 12. Authentication, Session Refresh & Socket Security

* **Shared Refresh-and-Retry Mutex:** `apps/web/src/lib/api.ts` features a centralized request interceptor with a token refresh mutex. When an access token expires (HTTP 401), pending requests are queued while a single refresh handshake executes, silently updating the session without logging the user out.
* **Socket Authentication Guard:** The Socket.io server enforces JWT handshake verification in connection middleware (`apps/api/src/server.js`), rejecting missing, expired, or malformed tokens before socket connection establishment.
* **Zero Hardcoded Credentials:** Plaintext passwords are strictly banned from repository code, tests, and documentation. Demo accounts and initial administrative passwords ingest exclusively from environment variables (`ADMIN_SEED_PASSWORD`, `DEMO_SEED_PASSWORD`).

---

# 13. Inventory: What Remains vs What Was Removed

### What Remains (The Lean Core)
* **5 Canonical Roles:** `admin`, `creative_head`, `sm_manager`, `team_member`, `executive`.
* **Single-Brand HACA Focus:** Organization and profile scoped strictly to HACA (`profileId: 'haca'`).
* **Content Planning & Pipelines:** `CalendarPlan`, `ContentPiece`, 4 pipelines, backward stage offsets, sequential stage locking.
* **Deliverable Execution:** `WorkItem`, central state machine, My Work execution portal.
* **Quality & Feedback:** Two-entry review model, blocker tracking, revision flags.
* **Management & Oversight:** 8-section dashboard, 4 saved reports, 6 automated scheduled worker rules, workload capacity analytics.

### What Was Removed (Permanently Deleted)
* ❌ **Commercial Leads & CRM:** `leads` module, LeadSquared (LSQ) sync adapters, datacenter discrepancies, sync runs, and `LSQ_*` env variables.
* ❌ **Sales Targets & Campaigns:** `targets` module, `campaigns` module, OKR alignments, funnel conversion charts.
* ❌ **Legacy Calendar Module:** Old flat calendar endpoints replaced by `CalendarPlan` and `ContentPiece`.
* ❌ **Legacy Roles & Aliases:** Retired `marketing_head` and `team_lead`; removed legacy approver job-role fallbacks ("Creative Manager (TL)").
* ❌ **Legacy User Routes:** Legacy `/api/users` endpoints replaced by `/api/people` and `/api/admin/access-requests`.
* ❌ **Credentials in Git:** `USERS_AND_PASSWORDS.md` untracked from git index; hardcoded passwords replaced with environment variables.

---

# 14. Testing & Quality Assurance

### Test Suite Summary: 302 Total Tests Passing (100% Green)

| Workspace / Package | Test Suites | Total Tests | Status |
|---|---|---|---|
| **`apps/api` (Backend)** | 17 Files | 291 Tests | **PASSED (100%)** |
| **`apps/web` (Frontend)** | 3 Files | 11 Tests | **PASSED (100%)** |
| **Monorepo Total** | **20 Suites** | **302 Tests** | **PASSED (100%)** |

### Verified Test Suites
1. `scope_reset_r4.test.js`: Full 8-step lifecycle journey across all 5 roles, 8 dashboard sections, uncapped workload bands, 4 saved reports, 6 automation rules, session/socket security, and route-table walk across all 5 roles.
2. `scope_reset_r3.test.js`: Calendar plan authoring, Excel template & preview, row approvals, stage generation, backward offsets, stage locking/unlocking, owner recommendations.
3. `scope_reset_r2.test.js`: Canonical 5-role permissions matrix, role migration dry-run and rollback, access requests.
4. `scope_reset_r1.test.js`: Clean deletion of leads, campaigns, and monthly targets.
5. `DashboardRoleViews.test.tsx`: Role-specific dashboard rendering, 8 operational sections, real workload percentages, absence of sales widgets, executive read-only controls.
6. `CalendarTabs.test.tsx`: 3-tab navigation, SM Manager plan authoring, Creative Head review, worker My Work notices.

---

# 15. Launch & Production Checklist

- [x] **Database Clean & Reset:** Run `npm run seed:demo` to seed the canonical HACA staff and demo accounts.
- [x] **Environment Variables Verified:** Ensure `JWT_SECRET`, `ADMIN_SEED_PASSWORD`, `DEMO_SEED_PASSWORD`, and `MONGODB_URI` are configured.
- [x] **Worker Process:** Start the background worker daemon via `npm run worker -w apps/api`.
- [x] **API & Web Build:** Compile production bundles via `npm run build`.
- [x] **Security Audit:** Confirm no credentials or debug tokens exist in repository or documentation.
