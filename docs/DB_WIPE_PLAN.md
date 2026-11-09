# Database Wipe Plan: Keep Users Only

> Phase 9 note: passwords are never written in docs or source. The admin uses ADMIN_SEED_PASSWORD and the 12 test users use SEED_PASSWORD_<NAME>, all in the git-ignored apps/api/.env. The reset is `apps/api/scripts/reset-and-seed.js` (dry run by default).

**Target Environment:** Local Development  
**Connected Database:** `marketing_portal`  
**Host:** `127.0.0.1:27017` (`mongodb://127.0.0.1:27017/marketing_portal`)  
**Date & Time:** October 25, 2026  
**Status:** PENDING USER APPROVAL (No destructive operations performed)

---

## 1. Executive Summary & Preconditions (Step 0)

This plan details the exact procedure to safely purge all sample, seeded, and test data from the local MongoDB database while preserving **all 13 user accounts** (roles, statuses, work preferences, capacity, profile fields, passwords, and pending invites) and resetting reference/configuration data to canonical state.

### 1.1 Precondition Verifications
| Check | Status | Details |
| :--- | :--- | :--- |
| **Environment Guard** | PASSED | `NODE_ENV=development` (Production strictly rejected) |
| **Host Guard** | PASSED | Connected to `127.0.0.1` (Non-local hosts strictly rejected) |
| **Database Target** | PASSED | Connected database is `marketing_portal` as specified in `apps/api/.env` |
| **Workspace Dependencies** | PASSED | Installed and verified |
| **Workspace Typecheck** | PASSED | `tsc --noEmit` passed across `@mmp/shared`, `@mmp/api`, and `@mmp/web` |
| **Test Suites** | PASSED | **313 tests passed** (18 API suites / 302 tests + 3 Web suites / 11 tests) |
| **Linter Note** | NOTED | `eslint` binary is not in `package.json` devDependencies; lint script fails due to missing command |

---

## 2. Complete Inventory of Database Collections (Step 0)

Inspection of `marketing_portal` reveals **40 collections** currently present in the database:

| # | Collection Name | Count | Category | Planned Action |
| :-: | :--- | :-: | :--- | :--- |
| 1 | `users` | 13 | **Core Users** | **KEEP ALL 13 USERS UNCHANGED**; invalidate `refreshTokens` |
| 2 | `profiles` | 7 | Reference / Config | **KEEP IN-PLACE**; enforce single-brand mode (HACA active, 6 inactive) |
| 3 | `departments` | 7 | Reference / Config | **KEEP IN-PLACE** (7 canonical departments; preserves user foreign keys) |
| 4 | `priorities` | 3 | Reference / Config | **KEEP IN-PLACE** (3 canonical: High, Medium, Low) |
| 5 | `automationrules` | 6 | Reference / Config | **KEEP IN-PLACE**; reset runtime fields & restore canonical metadata |
| 6 | `reportdefinitions` | 4 | Reference / Config | **KEEP IN-PLACE**; reset runtime fields & purge orphan recipients |
| 7 | `settings` | 1 | Configuration | **KEEP IN-PLACE** (weights, capacity, and hold rules) |
| 8 | `activityevents` | 1,477 | Transactional | **EMPTY** (purge all records, preserve indexes) |
| 9 | `contentpieces` | 105 | Transactional | **EMPTY** (purge all records, preserve indexes) |
| 10 | `workitems` | 104 | Transactional | **EMPTY** (purge all records, preserve indexes) |
| 11 | `calendarplans` | 43 | Transactional | **EMPTY** (purge all records, preserve indexes) |
| 12 | `assignment_overrides` | 24 | Transactional | **EMPTY** (purge all records, preserve indexes) |
| 13 | `notifications` | 11 | Transactional | **EMPTY** (purge all records, preserve indexes) |
| 14 | `accessrequests` | 9 | Transactional | **EMPTY** (purge all records including pending requests) |
| 15 | `counters` | 0 | Transactional | **EMPTY / RESET** (reset any sequence counters) |
| 16 | `blockers` | 0 | Transactional | **EMPTY** (collection preserved) |
| 17 | `feedbackentries` | 0 | Transactional | **EMPTY** (collection preserved) |
| 18 | `revisionflags` | 0 | Transactional | **EMPTY** (collection preserved) |
| 19 | `scheduledreports` | 0 | Transactional | **EMPTY** (collection preserved) |
| 20 | `teams` | 4 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty` as model was retired in Phase 0) |
| 21 | `auditlogs` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 22 | `calendarentries` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 23 | `campaigns` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 24 | `comments` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 25 | `contentformats` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 26 | `contentitems` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 27 | `deliverables` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 28 | `holdreasons` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 29 | `leads` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 30 | `leaverequests` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 31 | `monthlytargets` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 32 | `pipelinetemplates` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 33 | `platforms` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 34 | `requests` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 35 | `requesttypes` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 36 | `shoots` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 37 | `statushistories` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 38 | `tasks` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 39 | `teamassignments` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |
| 40 | `timeentries` | 0 | Legacy / Retired | **EMPTY** (DROP with `--drop-empty`) |

---

## 3. Step 1: Detailed Strategy

### 3.1 KEEP Unchanged: User Accounts (13 Users)
All 13 accounts in the `users` collection represent legitimate workspace actors configured with proper roles, departments, weekly capacity, and preferences.

| Name | Email | Role | Status | Job Role | Work Preferences | Password / Invite State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@hacaforge.com` | `admin` | active | — | — | Password set (from git-ignored .env) |
| **Test Creative Head** | `creativehead@demo.haca.local` | `creative_head` | active | Creative Manager (TL) | Script, Content, Design, Edit | Password set (from git-ignored .env) |
| **Test SM Manager** | `smmanager@demo.haca.local` | `sm_manager` | active | Social Media Manager | Post | Password set (from git-ignored .env) |
| **Test Writer One** | `writer1@demo.haca.local` | `team_member` | active | Writer | Content, Script | Password set (from git-ignored .env) |
| **Test Writer Two** | `writer2@demo.haca.local` | `team_member` | active | Writer | Content, Script | Password set (from git-ignored .env) |
| **Test Designer One** | `designer1@demo.haca.local` | `team_member` | active | Designer | Design | Password set (from git-ignored .env) |
| **Test Designer Two** | `designer2@demo.haca.local` | `team_member` | active | Designer | Design | Password set (from git-ignored .env) |
| **Test Shooter** | `shooter@demo.haca.local` | `team_member` | active | Video Editor | Shoot | Password set (from git-ignored .env) |
| **Test Editor One** | `editor1@demo.haca.local` | `team_member` | active | Video Editor | Edit | Password set (from git-ignored .env) |
| **Test Editor Two** | `editor2@demo.haca.local` | `team_member` | active | Video Editor | Edit | Password set (from git-ignored .env) |
| **Test Poster** | `poster@demo.haca.local` | `team_member` | active | Social Specialist | Post | Password set (from git-ignored .env) |
| **Test All Rounder** | `allrounder@demo.haca.local` | `team_member` | active | SEO Specialist | — | **Pending Invite / Set-Password** |
| **Demo Executive Director** | `executive@demo.haca.local` | `executive` | active | — | — | Password set (from git-ignored .env) |

#### Actions on Users:
1. **Preserve ALL user attributes:** `_id`, `name`, `email`, `role`, `status`, `jobRole`, `departmentId`, `profileAccess`, `workPreferences`, `weeklyCapacityHours`, `reportsToIds`, `skills`, `notificationPreferences`, `passwordHash`, `mustSetPassword`, `resetPasswordTokenHash`, `resetPasswordExpiresAt`.
2. **Invalidate Sessions:** Reset `refreshTokens: []` for all 13 users so any lingering sessions are invalidated and every user logs in again.
3. **No credentials leaked:** Password hashes and reset tokens are backed up securely but NEVER printed to console or logs.

---

### 3.2 Reference & Configuration Data: Fresh Seed vs Current State

#### A. `profiles` (Brand Profiles)
* **What Fresh Seed Contains:** 7 profiles (`haca`, `haca_mideast`, `haca_marketing_school`, `haca_marketing_school_en`, `haca_design_school`, `haca_design_school_en`, `haca_tech_school`).
* **Current DB State:** Exactly 7 profiles exist. `haca` has `active: true, isActive: true`, and the other 6 have `active: false, isActive: false`.
* **Differing Documents:** None. The single-brand mode requirement (`02-reference-data.md`) dictates that only HACA is active.
* **Foreign Key Consideration:** Every user document has `profileAccess: [ObjectId('6ad85081fd864806c09e2fca')]` (pointing to `haca`).
* **Proposal:** **KEEP in-place**. Do NOT re-create, as re-creating would generate new `_id`s and break `user.profileAccess`. Re-verify `haca` is `active: true` and the remaining 6 are `active: false`.

#### B. `departments` (7 Core Departments)
* **What Fresh Seed Contains:** 7 canonical departments: `design`, `video_production`, `social_media`, `seo_content`, `whatsapp`, `performance_marketing`, `tech`.
* **Current DB State:** Exactly 7 canonical departments exist (`_id`s: `6ad469daee11119e48d529c2`, `6ad85081fd864806c09e2fdf`, etc.).
* **Differing Documents:** None. 0 extra departments present.
* **Foreign Key Consideration:** Every user's `departmentId` references one of these 7 `_id`s.
* **Proposal:** **KEEP in-place**. Deleting and re-creating would change `_id`s and invalidate `departmentId` across all 13 users. Prune any non-canonical department if found (none currently).

#### C. `priorities`
* **What Fresh Seed Contains:** Canonical priority taxonomy: `High`, `Medium`, `Low`.
* **Current DB State:** Exactly 3 documents: High (level 2), Medium (level 3), Low (level 4).
* **Differing Documents:** None. (Legacy 'Urgent' priority was already purged).
* **Proposal:** **KEEP in-place**. Ensure any future 'Urgent' priority is pruned.

#### D. `automationrules` (6 Automation Rules)
* **What Fresh Seed Contains:** 6 rules defined in `apps/api/src/modules/automation/runner.js`:
  1. `month_end_report`
  2. `overdue_escalation` (Name: "Overdue Deliverable Escalation", schedule: "Hourly check")
  3. `todo_escalation`
  4. `blocker_dependency_alert`
  5. `revision_pattern_flag`
  6. `weekly_report`
* **Current DB State & Flagged Differences:**
  * Document `overdue_escalation` was renamed by executive test suite to `"Exec Overdue Rule"` with description `"Rule for testing executive read-only behavior"`.
  * Documents have stale runtime fields populated (`lastRunAt`, `lastRunStatus: 'success'`, `lastRunDetails`, `lastRunSummary`).
* **Proposal:** **UPDATE in-place to canonical seed**:
  1. Restore canonical title `"Overdue Deliverable Escalation"`, description, action, trigger, and config.
  2. Reset runtime fields for all 6 rules:
     * `lastRunAt: null`
     * `lastRunStatus: null`
     * `lastRunSummary: null`
     * `lastRunDetails: null`
     * `errorCount: 0`
  3. Keep rule definitions and `_id`s intact.

#### E. `reportdefinitions` (4 Objective Reports)
* **What Fresh Seed Contains:** 4 canonical definitions in `apps/api/src/modules/reports/service.js`:
  1. `weekly_marketing`: recipients `['creative_head', 'sm_manager']`
  2. `monthly_scorecard`: recipients `['creative_head', 'admin']`
  3. `creative_production`: recipients `['creative_head', 'sm_manager']`
  4. `team_performance`: recipients `['creative_head', 'sm_manager']`
* **Current DB State & Flagged Differences:**
  * `weekly_marketing` contains stale execution state (`lastGeneratedAt: 2026-10-25...`, `lastGeneratedSummary`) and **orphan recipients** pointing to missing/test users: `["custom.executive@demo.haca.local", "6ade4251173358061b8903c6"]`.
  * `monthly_scorecard` contains stale execution state (`lastGeneratedAt: 2026-10-25...`, `lastGeneratedSummary`).
* **Proposal:** **UPDATE in-place to canonical seed**:
  1. Reset runtime fields:
     * `lastGeneratedAt: null`
     * `lastGeneratedBy: null`
     * `lastGeneratedSummary: null`
     * `latestSnapshot: null`
  2. Reset `recipients` to canonical roles (`['creative_head', 'sm_manager']`, `['creative_head', 'admin']`), removing all orphan user IDs and test emails.

#### F. `settings` (System Settings)
* **What Fresh Seed Contains:** 1 document (`efficiencyWeights`, `requestersCanSeeWorkerNames`, `requireReasonForHold`, `defaultWeeklyCapacityHours`).
* **Current DB State:** 1 document present (`_id: 6ad201ae34ad3deb7dd5350d`).
* **Differing Documents:** None.
* **Proposal:** **KEEP in-place**.

---

### 3.3 EMPTY Collections (Transactional & Leftovers)

The following collections will be emptied (`deleteMany({})`), preserving the collection itself and its database indexes:
* `activityevents` (1,477 documents -> 0)
* `contentpieces` (105 documents -> 0)
* `workitems` (104 documents -> 0)
* `calendarplans` (43 documents -> 0)
* `assignment_overrides` (24 documents -> 0)
* `notifications` (11 documents -> 0)
* `accessrequests` (9 documents -> 0, both pending and reviewed)
* `counters` (0 documents -> reset)
* `blockers` (0 documents)
* `feedbackentries` (0 documents)
* `revisionflags` (0 documents)
* `scheduledreports` (0 documents)

#### Dropping Empty Collections Without a Model (`--drop-empty`)
Collections from retired FORGE features that have no active Mongoose model in `apps/api/src/modules/` will be dropped when the `--drop-empty` flag is supplied:
`teams` (4 documents), `auditlogs`, `calendarentries`, `campaigns`, `comments`, `contentformats`, `contentitems`, `deliverables`, `holdreasons`, `leads`, `leaverequests`, `monthlytargets`, `pipelinetemplates`, `platforms`, `requests`, `requesttypes`, `shoots`, `statushistories`, `tasks`, `teamassignments`, `timeentries`.

---

### 3.4 BullMQ Queues and Repeatable Jobs

#### Defined Queues:
1. `email-queue` (`QUEUE_NAMES.EMAIL`)
2. `scheduled-jobs-queue` (`QUEUE_NAMES.SCHEDULED`)

#### Repeatable Jobs Defined in `scheduled-jobs-queue`:
1. `overdue_escalation` (Cron: `*/15 * * * *` — every 15 minutes)
2. `todo_escalation` (Cron: `0 9 * * *` — daily at 09:00 AM)
3. `blocker_dependency_alert` (Cron: `0 10 * * *` — daily at 10:00 AM)
4. `revision_pattern_flag` (Cron: `0 * * * *` — hourly)
5. `weekly_report` (Cron: `0 8 * * 1` — Mondays at 08:00 AM)
6. `month_end_report` (Cron: `59 23 28-31 * *` — last day of month at 23:59)

#### Queue Clearing (`--clear-queues`):
* Obliterates `email-queue` and `scheduled-jobs-queue` via BullMQ `queue.obliterate({ force: true })` or flushes Redis keys matching `bull:*`.
* **Worker Re-registration Verification:** In `apps/api/src/worker.js` (lines 89–152), the worker explicitly invokes `scheduledJobsQueue.add(...)` for each of the 6 repeatable jobs when starting up. When the worker is launched (`npm run worker -w apps/api`), all 6 repeatable jobs and schedules are automatically re-created on Redis.

---

### 3.5 Cloudinary Files & URLs Audit

* **Collections Scanned:** All 1,773 documents across transactional collections (`workitems`, `contentpieces`, `calendarplans`, `accessrequests`, `activityevents`, `notifications`).
* **Cloudinary URLs Found:** **0 URLs** (No files currently hosted in Cloudinary).
* **Other URLs Found:** 4 test mock URLs (`https://figma.com/file/guards-test`, `https://docs.google.com/script`, `https://docs.google.com/script-done`, `http://localhost:5173/set-password?...`).
* **Export Action:** The script will scan all deleted documents, extract any URL containing `cloudinary.com` or `res.cloudinary.com`, and output them to `../haca-backups/<timestamp>/cloudinary-urls.txt`.

---

## 4. Safety Architecture & Backup Verification (Step 2 Preview)

1. **Pre-Wipe Export:**
   * Script exports every affected collection (including `users` and reference collections) into `../haca-backups/<timestamp>/` using `mongoexport` or direct JSON serialization.
   * Path guard: **Refuses any backup directory located inside the repository.**
   * Verification guard: Inspects every backup file to ensure it exists and has non-zero size. If any file fails, the wipe **immediately aborts** with zero mutations.
2. **Confirmed Execution Guard:**
   * Default is **dry-run**.
   * Confirmed run requires:
     * `--confirm`
     * `--db-name=marketing_portal` (aborts if not strictly matching connected DB name)
     * Rejects `NODE_ENV=production`
     * Rejects non-local host (`mongodb://localhost...`, `127.0.0.1`, `::1`)
3. **Idempotency:**
   * A second run against the cleaned database finds 0 records to delete, keeps all 13 users, leaves reference data clean, and produces identical state.
4. **Console Output:**
   * Prints kept-users table (`name`, `email`, `role`, `status`) — passwords and tokens are never printed.
   * Prints before-and-after document counts table.
   * Prints step-by-step instructions for restoring from backup.

---

## 5. Next Steps

> [!IMPORTANT]
> Execution is stopped per instructions. Please review this plan. Upon your approval, we will proceed to **Step 2**:
> 1. Create `scripts/wipe-keep-users.js` with all guards, JSON backup, Cloudinary scanner, and idempotent execution.
> 2. Remove legacy wipe scripts (`scripts/wipe-keep-admin.js`).
> 3. Create test suite in `apps/api/test/wipe_keep_users.test.js` verifying guards, user preservation, and idempotency against an isolated test database.
> 4. Execute the dry run and present output.
