# HACA Marketing OS — Conversion Progress

**Current test count (after Phase 12):** 1839 passing, 0 failing: API 1466 (72 files), web 373 (48 files). Typecheck 0 errors; web build clean.

## Phase 12: Locked workspaces, Drive-link submission, Start rework (Status: COMPLETE; committed locally, not pushed)

Each commit gated in the working tree (typecheck, web build, all tests).

- `b9a98ba` Workflow cards: a submitted step shows "Waiting for approval", not "Changes requested". Gate: typecheck 0 errors, web build clean, API 1427/1427, web 342/342.
- `39bfe5e` Lock workspaces; submit every step with links; Start rework. Gate: typecheck 0 errors, web build clean, API 1466/1466 (72 files), web 373/373 (48 files).

### Decisions applied
1. Status stays `Feedback` for both a submitted step and a sent-back step; the latest version tells them apart (`stepReviewState` in `@mmp/shared`). Every screen says "Waiting for approval" or "Changes requested" accordingly.
2. While locked, the API refuses workspace-only writes with 423 `WORKSPACES_LOCKED`: draft save, clip create, edit, replace, delete and reorder, and submit-clips. Reads, clip review, shoot review and Review Studio stay open.
3. Caption and hashtag fields are removed from the Post workspace too (`PostCaptionFields.tsx` deleted). Captions already saved stay in the database.

### What changed
- **Switch:** `WORKSPACES_LOCKED = true` in `@mmp/shared`, read through `apps/api/src/lib/workspaceLock.js` and `apps/web/src/lib/workspaceLock.ts` (tests can run the workspace code with it off). All workspace code and data are kept.
- **Locked screen:** the 7 workspace routes (`writing-studio`, `write`, `workspace`, `shoot`, `edit`, `design`, `post`) render `WorkspaceLockedPage`: lock illustration, "This workspace is locked for now", and "Submit with a link", which opens the submit dialog on Work Detail (`?submit=1`, owner only). No workspace buttons on My Work or Work Detail. No notification links to a workspace route (now covered by a test).
- **Submit:** `POST /api/work/:id/submit-link` (owner only): one Google Drive or Docs link, or one or more for Design, plus an optional note, using `isDriveLink`; the dialog shows "Make sure the link is shared with HACA reviewers." The version is written first and removed if the step save fails, so a step never waits for review without a version. A saved workspace draft is left unchanged and not attached. One shared `StepSubmitDialog` on My Work and Work Detail.
- **Old transition path:** submitting a review step through `/transition` is refused while locked (409 `USE_SUBMIT_LINK`). When unlocked, its version is created before the step save and rolled back on failure; the swallowed `try/catch` is gone.
- **Shoot:** the clip rule applies only to a version with clips (not a link version, on a step that has clips). A link version is approved with the mandatory 1–5 rating and message, or sent back with a message and root cause. Review Studio shows clip review only for clip versions (`clipReview` on the submission). Handoff passes the Shoot link.
- **Post:** live link only, shared `isLivePostUrl` (https, any host; rejects `http:`, `javascript:`, `data:` and credentials). The caption requirement is removed from the API and caption input is ignored. The live URL is saved on the piece and shown on the Tracker, opening in a new tab.
- **Rework:** all three revision paths (Review Studio and Work Detail, Shoot clip review, Feedback page) end in the same state through `applyChangesRequested`: status `Feedback`, latest version `changes_requested`, one revision counted, the reviewed round decided, no round running. "Start rework" (owner, `Feedback → In Progress`) starts the new round at the click and is refused with 409 while the latest version waits for review. "Resubmit link" closes the round. Resubmitting before Start rework is refused (409 `REWORK_NOT_STARTED`). The double revision count and the duplicate "revision requested" notification on the owner's move are fixed. Start rework notifies nobody.
- **Rework time:** shared `reworkTimeMs` (rounds after a changes-requested decision, same blocked and paused rule as work time). Shown on Work Detail ("Rework time: 2h 10m"), profile work history, project KPI step rows and the profile step CSV. No KPI formula changed.
- **From earlier steps:** Work Detail lists every approved link handed to the step (the Shoot link, every Design link) from the existing handoff, which already applies the Phase 3 visibility rules.
- **Waiting vs changes requested in lists:** `awaitingReview` is set on read, with nothing written, by `apps/api/src/modules/workItems/reviewState.js` for the Tracker, plan grid, calendar, work list, dashboard, team and profile pages, project report and feedback threads; the "waiting for approval" counts use it too. The reviewer's message and notes for a sent-back step come from the records each revision path already writes.

### Existing items (local DB)
48 steps. One open step with a workspace draft (Script, Blocked): it can submit a link and the draft stays. No versions awaiting review; no Shoot steps with clips under review. Two posted Post steps keep their saved captions. No data was changed.

### Tests
- New `apps/api/test/link_submit_locked.test.js` (41): lock refusals; link submission for every step type; invalid links; owner only; version and step saved together; old path refused; drafts kept; Shoot approved directly and sent back; clip rule kept for clip versions; file versions still reviewable; Post live link only and URL rules; Start rework then Resubmit with round times, rework time and revision counts; the same end state from all three revision paths; every workflow (Reel Full, Shoot + Edit, Edit only, With content, Design only, not posted) from start to finish with links and one rework, never stuck; list flags; no workspace links in notifications.
- New `apps/web/src/__tests__/WorkspacesLocked.test.tsx` (21): every workspace route behind the lock and Review Studio not; the locked screen and its button; no workspace buttons on My Work and Work Detail for any step type; the switch brings them back.
- Updated for the new rules: review decision integrity, timing, media and shoot, workflow and workspace journeys, Phase 5d (now "live link only"), tracker month roles, Phase 8 CSV (new Rework time column), web review flows and the Post workspace. Older workspace-flow test files run with the switch off.
- `scope_reset_r4` "Step 3" (approving a whole plan) has its own 30 s limit: it already took 11 s alone at `b9a98ba`, close to the 15 s default, and timed out under full-suite load.

### Browser check
Disposable `marketing_portal_uicheck` (10 test-only users, throwaway password); repo API on :8093 and web on :5301, proxied only to it. Reel Full and Static Post with links only, one rework on Shoot and one on Design, as writer, shooter, editor, copywriter, designer, poster, Creative Head, SM Manager and Executive, at 1440 and 390 px: **81 of 81 checks passed**, with no page errors, 5xx responses or alert dialogs and no page-level horizontal scroll. Disposable DB dropped and both servers stopped afterwards. Real DB unchanged (48 steps; latest step update before the run).

### Notes
- The seeded check rows had no workflow flags, so their label read "Reel · Edit only". Test data only.

## Phase 11: Calendar picker, account menu, Content Flow Tracker (Status: COMPLETE; committed locally, not pushed)

Each commit gated in the working tree (typecheck, web build, all tests).

- `375955d` Create plan, Step 1: the calendar list uses the same neutral cards as Step 2 with the standard calendar dot; the repeated "Creative calendar for …" line is gone.
- `2c85e57` Account menu: no purple; neutral role chip, muted icons, keyboard-only focus ring; Sign out stays red like the side menu.
- `770dc5e` Shared `formatShortDate` ("16 Nov", year only when not the current year, IST) and `formatShortDateTime`. Tracker month filter = the IST month of the publish date (same rule as the reports).
- `e63391a` Tracker flags: Needs owner = an open step with no owner (the old rule read a never-set `assigneeConfirmed` field, so every unstarted step counted; Profile's count uses the same flag). Waiting for approval = a Pending step (the old rule matched Feedback, i.e. changes requested).
- `54dae0d` Tracker redesign (no data rule changes):
  - Rows in three areas: title and chips (workflow, calendar, plan ID, project label, Urgent); the steps in order with connectors (equal-height chips: status, owner, due date, time labels; current step outlined; locked, skipped and "Not needed" muted; scrolls inside the row); publish date, current state line, live status and icon actions with a ⋯ menu (Skip / Restore step). Details expand into Waiting, Work time, Approval wait, Late by, Approval, Posting owner, Turnaround, Remarks. Phone: cards with vertical steps.
  - One filter bar: search, Month (built around today), Calendar, Type, Workflow, Current step, Owner, Status (Overdue, Done late, Blocked, On track, Posted, Needs owner, Waiting for approval, Not approved yet), Urgent only; sort by publish date or next due date; removable chips, Clear all, post count. Filters live in the URL; older links (?needsOwner=true, ?stageStatus=) still work, so the Profile "Needs owner" link now applies.
  - Approved rows by default; rows with no steps only under "Not approved yet". Approval (last creation step's approval date) and Posting owner (Post step owner) filled from existing step data, display only.
  - Fixes: Turnaround "—" or "N days" (it showed "d" because a stored null passed an `!== undefined` check); one date format; no monospace; "Final Date (F)" renamed "Publish date".
- Data notes: Approval and Posting owner were always empty because the API never set those fields. "Production Team" as an owner is the seeded shooter account renamed in the app (a data change, not code).
- Browser check (disposable `marketing_portal_uicheck`, test-only users, throwaway passwords; repo API on :8093 with env overrides, web on :5301): 17/17 at 1440, 1024 and 390 px — approved rows only, one-line pipelines with equal chips, one date format, no monospace, no page scroll at any width, chips and labels, current step, expand details (Turnaround "9 days"), filters combined and kept through a refresh, chips and Clear all, Not approved yet, the Profile link, Waiting for approval, sort by next due, Creative Head view, no page errors. Before and after screenshots taken at desktop and phone width. Disposable DB dropped. The real DB changed during the session only through the owner's own app use (Creative Head approval, rating and step updates, logins); none from the checks.

## Phase 10: Plan fixes, row delete, calendar names and row workflows (Status: COMPLETE; committed locally, not pushed)

Each commit gated in the working tree (typecheck, web build, all tests).

- `f4d720b` Excel upload: a file ExcelJS cannot read (broken zip, or comment links written as absolute paths by openpyxl) returns 400 `UNREADABLE_FILE` "This file couldn't be read. Download a fresh template and copy your rows into it." instead of 500; the original error is logged. Also fixes the older preview endpoint.
- `d2999d8`, `9ab848f` Publish time removed from the plan grid row panel and the Individual Work row form (nothing read it). New rows keep the 18:00 default; edits keep the stored time. No data change.
- `cba1979` Delete a plan row (SM Manager and Admin; others 403): unapproved rows, and approved rows while none of their steps has started (piece and unstarted steps removed, same rule as plan delete). Started work: 409 "This post has started work and can't be deleted.". Owners of removed steps notified once each; activity logged. Delete action on each deletable grid row, phone card and side panel; the confirm names the date and title.
- `b9c444a` Calendar display names: SM Calendar, Sales Calendar, Ads Calendar, Academics & Management Calendar, Other (keys unchanged; stored plan titles unchanged).
- `5161b7b`, `d5b2672` Row workflows:
  - Reel: Full, Shoot + Edit, Edit only. Static Post / Carousel Post: With content, Design only. Other types unchanged. Stored as flags; new `needsContent` has no default, so existing rows are not rewritten (missing = With content). Existing rows keep their flags and show the matching workflow.
  - Grid: Workflow dropdown next to Type; one "Script / Content" group (Script for reels, Content for design rows, also in the progress view); unused steps read "Not needed" with no inputs. Row panel: Workflow replaces the Needs script / Needs shoot checkboxes; changing Type resets it to the default. Read-only after approval.
  - Approval creates only the workflow's steps; deadlines counted back with the existing offsets. Autofill and the save suggestion skip unused steps.
  - Edit only needs a source video link (app upload or https drive.google.com / docs.google.com), checked on save, upload and submission.
  - Excel: optional Workflow (dropdown: Full, Shoot + Edit, Edit only, With content, Design only; blank = default) and Source Video Link columns; invalid pairs are row errors; "Script Owner" on a design row sets the Content owner (old Content Owner column still read); How to fill updated; older templates still upload.
  - "From the plan" on a step with no earlier step: the row's brief, plus the source video for Edit only (worked out on read). Workflow labels on Work Detail, Tracker and the Project KPI page.
- Browser check (disposable `marketing_portal_uicheck`, test-only users and throwaway passwords; repo API on :8093 with process env overrides, web on :5301): 20/20 — all five workflows in the grid, Script / Content and "Not needed", Add row workflow choices and reset, phone width with no page scroll, renamed calendars, approval, Work Detail label and "From the plan" with the Drive link, Tracker and Project KPI labels, read-only after approval, no page errors or 5xx. Disposable DB dropped afterwards; real DB counts and latest update times unchanged.

## Phase 9: Reset the local database and seed test users (Status: COMPLETE; committed locally, not pushed)

Three commits, each gated in the working tree: 9a `b556708`, 9b `5945fc0`, and this entry.

- Backups (outside the repo): `D:\haca-backups\2026-11-09_085137\` (Step 1) and `D:\haca-backups\2026-11-09_092010_pre-reset\` (just before the reset). Each has `mongodump\marketing_portal` (all 33 collections; counts checked) and `uploads\` (23 files, 179 MB). Restore: `mongorestore --uri=mongodb://127.0.0.1:27017 --drop <backup>\mongodump`.
- 9a, code:
  - `apps/api/scripts/reset-and-seed.js` rewritten: dry run by default; `--confirm` needs `--db-name` equal to the database in `MONGODB_URI`; refuses `NODE_ENV=production`, any non-local host and test or disposable databases. Keeps departments, automationrules, settings, counters, the admin (`ADMIN_SEED_EMAIL`) and its sessions; empties every other collection; deletes the files in `apps/api/uploads`; clears stale BullMQ jobs keeping the 4 reminder schedules; recreates Team Chat; seeds the 12 users from `SEED_PASSWORD_*` in `.env` (refuses if any is missing). Options `--uploads-dir`, `--skip-queues` (used by tests).
  - Startup `ensureBaselineUsers` now only creates the admin when missing (from `ADMIN_SEED_PASSWORD`); it no longer rewrites users or resets passwords on every start.
  - The 12 users' details (no passwords) are in `src/modules/people/seedUsers.js`.
  - Every hard-coded password removed from source and docs (`baselineUsers.js`, `reset-and-seed.js`, `DB_WIPE_PLAN.md`, `PROGRESS.md`). They remain in older git history.
  - Dev quick sign-in groups the accounts by role (Admin, Creative Head, SM Manager, Executive, Team members); the component is behind `import.meta.env.DEV`, so it is left out of production builds.
- 9b: the password guard test no longer contains a password literal.
- Profiles: no app code reads the `profiles` collection (the model was removed earlier; tests use a mock), so all 8 profiles were deleted. The old `priorities` records (High, Medium, Low) were deleted too.
- Reset run (confirmed), deleted: users 62 (12 old demo accounts, 49 test accounts on chat.com including 7 test admins, 1 suspended gmail.com SM manager), sessions 257, notifications 1141, activityevents 293, channelmembers 57, submissions 51, workitems 45, contentpieces 34, assignment_overrides 28, ratings 20, mediaitems 19, submissioncomments 14, mediamessages 12, feedbackentries 9, profiles 8, calendarplans 7, chatmessages 6, reportdefinitions 4, priorities 3, channels 2, blockers 2, accessrequests 1, sharegrants 1; 23 upload files. Redis was not running, so no queue jobs to clear.
- Kept: departments 7, automationrules 6, settings 1, the admin and its 74 sessions.
- Created: the 12 users (roles, job roles, departments and work preferences as in CONTEXT.md section 5) and Team Chat with all 13 members.
- Checks: each of the 12 users and the admin signs in through the dev quick sign-in and lands on the right page (team members on /my-work, others on /dashboard); quick sign-in shows all 13 grouped by role; the production build contains no quick sign-in, no demo emails and no encoded account list (test against `dist`). These sign-ins added 13 sessions.
- Final counts: users 13, departments 7, automationrules 6, settings 1, channels 1, channelmembers 13, sessions 87 (admin 75, users 12); every other collection 0.
- Tests: the script refuses without `--confirm` (dry run changes nothing), against a non-local URI, a test database or a mismatched `--db-name`, and when a seed password is missing; a confirmed run on a scratch database keeps config and the admin and seeds the 12 users; startup creates only a missing admin and never rewrites users; no password in the seed or startup source; quick sign-in grouping and its absence from the production build.

## Phase 8: Worker and Creative Head profile KPIs (Status: COMPLETE; committed locally, not pushed)

Five commits, each gated in the working tree (typecheck, web build, all tests): 8a `83f0988`, 8b `8b96687`, 8c `39e14b4`, 8d `7d76e9a`, and this entry.

- 8a, shared helpers in `@mmp/shared`: the profile period (this month, last 3 months, custom; IST days; steps belong by due date) and the previous period; `reviewStats` (changes-requested rate, rework); `workerOnTime` also returns the late rate and done-late count; `reviewerStats` (approvals vs changes requested, average wait from submission to decision) and `reviewQueueAge`.
- 8b, API:
  - `GET /api/team/:id/kpis`, read only, same access as the profile. One person's own figures: assigned, completed, in progress, open overdue, blocked; on-time (Late: earlier step excluded, with the delayed note); late rate and done-late count; changes requested; rework; first-pass (Post excluded); average rating (one per step, 3 minimum); elapsed work time total and by step type (history marked partial); the same person's last-period figures; charts (monthly trend by finish date, ratings, root causes, step types, calendars).
  - Creative Head section (admin, executive, the Creative Head on their own profile): reviews, approvals, changes requested, average approval wait, "Oldest item in the team review queue", plan approvals, charts (reviews per week, ratings given, root causes used). Counts submission decisions only; "N earlier approvals have no review record and are not counted." when such approvals exist.
  - `GET /api/team/:id/report`: the same plus the step list; admin, creative_head and executive only (others 403; a team member on someone else's profile 404). Neither returns contact details.
  - Fixes: header average rating and the Ratings tab use one rating per step (step-type averages only from 3); Performance counts completed steps by finish date and first-pass without Post (no data is "No data", not 100%); the placeholder revisionFlags block is removed; the Changes Log stays admin and creative_head only and returns the actor's email to admin only.
- 8c, web: Overview period picker and 12 KPI cards (each with what it is based on, and "Last period: …" as plain text: no colour, arrows or better/worse wording); Performance charts; a Reviews tab on Creative Head profiles (and Work/Performance when they own steps); "Download report" for admin, creative_head and executive: a print layout (`/team/:id/report`) for PDF and two CSVs (figures, steps) built from the same rows as the cards.
- 8d: the print layout shows one chart per row (they overlapped two to a row); "1 revision round".
- Decisions applied: A (period by due date; monthly trend by finish date), B (submission decisions only, with the legacy note), C (last period kept, neutral). Changes Log admin and creative_head only; queue label as requested.
- Tests updated for the approved rules: older rating fixtures rated one step several times; each rated version now has its own step (one rating per step). The 8-week load-trend fixture no longer falls into last week when the suite runs in the first half hour of a Monday (it failed once at 00:09 IST on 9 Nov).
- Browser test, 41 of 41, on a disposable database (dropped afterwards), desktop and 390 px phone width: worker profile cards, period picker, Performance charts; Creative Head Reviews tab with cards, legacy note and charts; CSV (every card value in the CSV, no contact details) and PDF (figures, charts, steps, review section; charts do not overlap) downloads; each role: admin, creative_head (own Reviews, download), executive (no contact details on screen or in the report, read only), sm_manager (KPIs, no download, report refused, no Reviews tab on a Creative Head), team_member (own profile with the transparency banner, no download, others not found); phone layouts fit the width with stacked cards; no page errors or 5xx.
- Clean-worktree gate: a fresh worktree of HEAD, `npm ci`, no `.env` and no secrets on the command line or in the environment; removed afterwards.
- Real database: no writes; read-only survey and checks only. Since the Phase 7 close-out the only change is one Creative Head login through the dev app at 18:00 UTC on 8 Nov (Chrome on Windows).

## Phase 7 close-out: reminders and priority (Status: COMPLETE; committed locally, not pushed)

One commit, gated in the working tree (typecheck, web build, all tests).

- Overdue notice (`overdue_escalation`):
  - Uses the shared IST calendar-day rule: a step is overdue from the day after its due date. Locked steps ("Waiting: earlier step late") are skipped.
  - The owner is notified once when the step becomes overdue, and one SM manager (the step's department's, else any active one) once the same day. Each notice is sent once per due date (a moved due date can make it due again).
  - The 4-hour escalation, the creative-head escalation path and the repeat notices are removed. Notification types: `overdue_owner`, `overdue_manager`.
- Revision flag:
  - A step is flagged when it reaches round 4 (three change requests), on the review decision and by the scheduled check; the 48-hour unclassified alert to creative heads and admins is kept.
  - The comparison with the worker's own average is removed (the "baseline" figures are gone from the Feedback and Issues pages too).
  - The Dashboard lists flags by project and step (owner name on the row only), sorted by project, never grouped, counted or sorted by person.
- Priority:
  - Only Normal and Urgent are accepted: the API schemas, Edit details, plan grid row panel, plan rows and the Excel upload (which reports "Priority must be Normal or Urgent").
  - Default Normal on every creation path, including direct work items (which defaulted to Medium).
  - Existing Low, Medium and High records are left unchanged in the database and shown as Normal (they were shown as-is, and High counted as Urgent). The database models still accept those stored values, so old records keep saving; the forms send a priority only when it is changed.
  - My Work (within each group) and Work Items sort Urgent first, then by due date.
- Tests updated for the approved rules: the overdue test fixture is now overdue by a day, not 6 hours; the overdue test checks `managerNotified` and `overdue_manager`; tests that sent High or Medium through the API now send Urgent or Normal.
- Real database: no writes and no migration; the only access was the read-only snapshot comparison.

## Phase 7: Reports, overdue and KPI (Status: COMPLETE; committed locally, not pushed)

Eight commits, each gated in the working tree (typecheck, web build, all tests): 7a `71f6a57`, 7b `745fcbd`, 7c `4afd138`, 7d `c49212f`, 7e `20885c6`, 7f `3a07bf3`, 7g `f3ac77a`, and this entry.

- 7a, shared rules in `@mmp/shared` (used by the API and web):
  - Dates compare by calendar day in Asia/Kolkata (`istDateKey`, `istDayDiff`, `istWeekKey`); `overdueDays` now uses them, so results no longer depend on the server or browser timezone.
  - `stepTimeLabels`: Overdue (unlocked, unfinished, today IST past the due date), Waiting: earlier step late (locked and past due; a locked step is never Overdue), Done N days late / Done on time (first submission, else a Post step's posting; 11:59 PM IST is on time), Late: earlier step (unlocked after its own due date, kept after it is finished), Blocked N days (active blocker).
  - `workerOnTime` leaves out "Late: earlier step" steps from count and total and reports "N steps delayed by earlier steps".
  - `projectDelivery` and `projectTimeLabel`: Overdue and Completed late, by publish date; a non-postable design is handed over when its Design step is approved.
  - KPIs: `stepElapsedWork` (submitted rounds minus blocked and paused time; older steps from history, marked partial), `ratingAverage` (3-rating minimum, else "Collecting baseline"), first-pass helpers (review steps only, Post excluded).
- 7b, retired report jobs:
  - weekly_report and month_end_report log "retired" and do nothing; they are no longer default rules; their records stay untouched.
  - The worker removes their repeat schedules from the BullMQ queue at startup and registers only the 4 reminder rules.
  - Startup never deletes or edits rule records: it only inserts missing defaults (it also used to bump `updatedAt` on every start).
- 7c, live reports API: `GET /api/reports/{overview,overdue,production,quality,projects}` and `GET /api/reports/projects/:id`.
  - Filters: month by publish date (IST; everything, including the step lists, follows it), calendar, step type.
  - Team-level only: owner names appear on list rows, sorted by due date; nothing is grouped, counted or sorted by person.
  - One rating per step, on the latest approved submission. A posted Post step without a posting time uses its piece's published time.
  - Older steps' times are read from the activity log and submissions (`workItems/history.js`), read only.
  - Team members get 403 on reports and 404 on a Project KPI page; the executive reads them.
- 7d, Reports page: the 5 reports with Recharts charts, CSV per table (built from the same columns as the screen), a print layout (`/reports/print`) for Save as PDF, and the read-only Project KPI page. No automation, scheduling, HTML preview or placeholder figures. The nav item is "Reports".
- 7e, removed: report definitions, generation, scheduled reports, HTML export, the old report aliases and the automation API (`/api/automation` list, toggle, run). Their routes return 404. `reports/service.js` and the automation controller, service and routes are deleted. Startup no longer upserts report definitions; the 4 records stay untouched.
- 7f, labels across the app: Work Items (Overdue / Done late / Blocked filter), My Work, Work Detail (owner and leadership only), Tracker (step labels, project label, Done late filter) and the profile Work tab.
- 7g, profiles: header Overdue counts open steps labelled Overdue; on-time rate by the new rule with the delayed note ("No data" instead of 100% when nothing is judged); Overview open overdue and blocked counts; Performance on-time card. Workers see only their own profile.
- Decisions applied: A (everything follows the publish-date month), B (retired jobs; schedules removed; rule records never deleted; report definitions untouched), C (automation API removed), D (locked steps never Overdue; "Waiting: earlier step late"; worker on-time excludes "Late: earlier step"; project figures unchanged).
- Routine decisions: Blocked N days uses the earliest active blocker record (an active record counts even if the step's status is not Blocked, per "has an active blocker"); the project on-time KPI counts every finished step and shows the delayed count beside it; first-pass also counts a step as not first-pass if any submission was sent back; Work Detail labels are hidden from other participants; dashboard (`/api/dashboard`) unchanged.
- Tests updated for the approved rules: tests of the removed routes now check the 404s or the live reports; the automation runner tests call the runner directly; the rule-list tests no longer expect the retired rules.
- Gate note: one 7d gate run failed only because the machine slept mid-run (a test step crossed its 15 s timeout and the 1-hour test tokens expired); it was re-run clean on the committed state (295 web, 1354 API) before 7e. One 7f run collided with a second run I had started by mistake on the same test database; the re-run alone passed.
- Browser test, 49 of 49, on a disposable database (dropped afterwards), at desktop and phone width (390 px):
  - All 5 reports with their charts drawn; Overview delivered 2 (one post, one handover); the locked Post step is not in the overdue list; the delayed Shoot step shows "Late: earlier step"; Quality average from one rating per step; root cause chart.
  - CSV download whose rows match the on-screen table exactly; print layout with fixed-size charts and every table, saved as PDF.
  - Project KPI page from the Projects report: four KPI cards, the delayed note, step rows with owner names and hours.
  - Tracker labels, project label and Done late filter; profile on-time with "1 step delayed by earlier steps", own Overview counts and Work-tab labels; a worker cannot open someone else's profile.
  - Team member: Reports and Project KPI page show not found (API 403 and 404). Executive reads reports with nothing to edit or generate.
  - Phone: every report and the Project KPI page fit the width, tables become row cards, charts draw at the phone width.
  - No page errors or 5xx.
- Clean-worktree gate: a fresh worktree of HEAD, `npm ci`, no `.env` and no secrets on the command line or in the environment; removed afterwards.
- Real database (`marketing_portal`): no writes from this phase (the Step 1 survey was read only). Against the Phase 6 snapshot it shows the user's own dev-app activity on 8 Nov: 7 logins (SM manager, admin, creative head), 8 report generations through the old routes still loaded in the running dev server, one work-item update ("Sample reels - Post"), and a plan calendar move at 15:18 UTC that touched 17 work items and sent 16 notifications. All of it happened before this phase's browser fixture was built, through the dev server, which this work never used.

## Phase 6: Small fixes (Status: COMPLETE; committed locally, not pushed)

Eight commits, each gated in the working tree (typecheck, web build, all tests): 6a `3d544e5`, 6b `dd87c5f`, 6c `2cbec11`, 6d `ea23f19`, 6e `b6e9096`, 6f `47dc987`, 6g `3cd4726`, and this entry.

- 6a, tests and repo:
  - The flaky TeamMemberRouteBoundaries test: "other roles still get the page" for `/reports` and `/workload` timed out at the default 1s while the lazy page modules compiled on first render. The test now loads those modules once up front and waits up to 5s.
  - The API tests set test-only JWT secrets in `apps/api/vitest.config.js`, so a fresh checkout with no `.env` passes. Real env values are never overridden.
  - `.gitignore` anchors the uploads rule to `/uploads/` and `/apps/api/uploads/`.
- 6b, blockers:
  - One path for blocking: a move to Blocked (from any screen) creates a Blocker record with the status it was in (`statusBefore`) and opens a blocked interval; leaving Blocked resolves the record.
  - Resolving returns the step to its status before the blocker (an explicit resume status is still honoured) and closes the interval.
  - The step owner, sm_manager and admin can resolve: "Resolve Blocker" on My Work and "Resolve blocker" on Work Detail; both resolve the record. The Issues page resume select defaults to the previous status.
- 6c, reopening:
  - "Reopen step" on Work Detail for creative_head and admin, on finished review steps only, never on their own step. Refused once the deliverable is posted, or a non-postable design is handed over (409 `DELIVERABLE_DELIVERED`).
  - On reopen, every unfinished later step is paused (`pausedBy`): it keeps its status, start time and rounds, is locked, and a started step gets a `paused` interval that work time subtracts like a blocked one. A step awaiting review is paused too; review decisions on it are refused (409 `STEP_PAUSED`) until it resumes.
  - A paused step resumes at its exact previous status when every earlier step that paused it is approved again. Owners are notified on pause (`step_paused`) and resume (`step_resumed`).
- 6d, outputs:
  - `GET /api/content-pieces/:id` with Phase 3 access (the same 404 to a team member not on the piece), each visible finished step with its latest approved output. Review Studio's Outputs tab reads it.
  - Work Detail's output section shows the step's approved output, not the latest submission. A participant's read-only Shoot view is headed "Approved footage".
- 6e, plans and publishing:
  - A plan can be deleted until any of its steps starts (left Not Started, has a start time, or has a submission). Deleting removes its unstarted steps and rows; after that, 409 `PLAN_HAS_STARTED_WORK`. Existing orphaned records are untouched. Delete Plan shows only while nothing has started.
  - Marking a Post step posted validates the content piece first: an invalid piece is a 400 `CONTENT_PIECE_INVALID` with nothing changed. It was a 500 after the step had already been saved as Published.
- 6f, screens and messages:
  - An executive opening My Work by URL is redirected to /dashboard.
  - The error fallback no longer mentions "diagnostics".
  - Attachment-only chat messages notify members ("<name> sent an attachment"). The notification needed text and failed silently; chat notification failures are now logged.
  - An unknown role in an admin role change is a 400 `INVALID_ROLE`, not a 500.
  - Performance tab work time read `netWorkTimeMs`, which the shared calculator does not return, so it was always 0. It now uses `submittedWorkTimeMs` in `@mmp/shared` (submitted rounds only), which the team digest uses too.
- 6g: test counts and outdated statuses in CONTEXT.md, WORKSPACES.md and this file.
- Routine decisions made: the owner gets `resolve_blocker`; the Issues page defaults to "previous status"; blocking by transition now creates a record; `createBlocker` opens an interval; `canReopen` is computed by the API; `approvedOutput` is an output field under the viewer rules; the content-piece GET returns the piece directly; plan delete returns 409 and removes only steps still unstarted at delete time; chat notification text for attachments and shared items.
- Tests updated for the approved rules: the actions test (owner now gets `resolve_blocker`), the review-integrity test (later steps keep their status but pause), the old reopen test, and the plan-delete test (an approved row with no started steps is now deletable).
- Browser test, 40 of 40, on a disposable database (`marketing_portal_uicheck`, dropped afterwards):
  - Blockers: the owner blocks, a record is created remembering In Progress, Resolve Blocker on My Work returns the step to In Progress and the record to Resolved with the interval closed. On Work Detail the creative head sees no resolve button, a non-participant gets 404, and the SM manager resolves.
  - Reopening: SM manager and step owner see no Reopen step; the creative head reopens; later steps pause, keeping status and start time, with the paused notice and a notification; after resubmission and approval they resume exactly, with the notice gone and a resume notification. Admin sees Reopen step. A posted deliverable shows no button and the API refuses with 409.
  - Plans: a plan with a started step shows no Delete Plan and the API refuses with 409, leaving it intact; a plan with nothing started is deleted from the UI with its row and steps.
  - No page errors or 5xx.
- Clean-worktree gate: a fresh worktree of HEAD, `npm ci`, no `.env` and no secrets on the command line or in the environment; the API tests ran on the vitest config's test-only secrets. (Phase 5's clean gate needed secrets passed on the command line because the tests then read them only from `.env`; 6a removed that need.) The worktree was removed afterwards.
- Real database (`marketing_portal`) unchanged against the Phase 6 snapshot: same collection counts and the same latest work-item update. The fixtures only read demo users from it.

## Phase 5: Asset handoff and Drive links (Status: COMPLETE; committed locally, not pushed)

Four commits, each gated in the working tree: 5a `a90692d`, 5b `ca01bd7`, 5c `23630eb`, 5d (this commit). Uploads stay local for testing; Cloudinary comes in the deployment phase.

- Why: the poster saw no final assets, because Post read its own empty `deliverableUrl`. Post also never received the caption, which it read from a field that does not exist. Edit saw only the Shoot step's first clip, Design got no approved copy, and a multi-slide design kept only slide 1.
- 5a, saved output URLs:
  - One shared rule in `@mmp/shared` (`isDriveLink`, `isAppUploadPath`, `isAllowedOutputUrl`). A clip or submission URL must be a file uploaded through the app or an https link on drive.google.com or docs.google.com.
  - The API also checks that an uploaded file exists (`modules/uploads/outputUrls.js`). This covers submission files, fileUrl, linkUrl and drafts, clip create and replace (thumbnails: uploads only), and work-item deliverableUrl.
  - Only new values are checked: records saved before Phase 5 are untouched and may be re-sent.
  - `POST /api/submissions` keeps every design slide, and no longer copies local paths into linkUrl.
- 5b, handoff:
  - The work-item detail carries `handoff`: for each finished earlier step, its latest approved output, with Phase 3's fallback for legacy steps with no version marked approved. That is its files and links, Script or Content text, caption, hashtags and shot list, and a Shoot step's approved clips.
  - Phase 3 rules filter it, and existing external URLs come through as plain links.
  - A finished non-postable Design step shows `handover` to sm_manager, creative_head and admin. Its approval notifies active SM managers (`step_handover_ready`), once per approval, after the approval is saved.
  - 5b also required a caption on postable Script and Content steps; 5d replaced that (below).
- 5c, web:
  - Post lists the approved final cut or every design file, with Download or Open in Drive. The poster's own deliverableUrl is saved only if they attach one.
  - Edit's Footage shows every approved clip. Design shows Content's approved copy.
  - Drive link inputs (`components/DriveLinkInput.tsx`, using the shared rule and "Make sure the link is shared with HACA reviewers.") are on Script (alongside the document), Shoot (per clip), Edit (final cut) and Design (per file).
  - Drive clips show "Open in Drive" instead of playing.
  - Review Studio keeps the document in view when there is document text and lists links beside it. A links-only version opens in the link viewer, which lists every link. Uploads still preview and take pins; links take general comments.
  - Work Detail shows "Approved files for handover".
- 5d, caption and hashtags move to the Post step:
  - The Writing Studio no longer has a caption box. Script and Content submit the document, a Drive link, or both, with no caption.
  - Post has caption (required to post) and hashtags (optional) fields, with the Instagram (2,200) and LinkedIn (3,000) counters and Copy buttons (`components/PostCaptionFields.tsx`).
  - They are saved on the Post step (`postCaption`, `postHashtags`) only through the posted transition. Only the Post owner, sm_manager or admin may set them, so sm_manager and admin can now mark a Post step posted. Elsewhere they are refused with `CAPTION_NOT_ALLOWED`.
  - The API limits caption and hashtags together to 3,000 characters, LinkedIn's limit (`POST_CAPTION_MAX` in `@mmp/shared`). Over Instagram's 2,200 is a warning only.
  - After posting they show read-only. Captions saved on scripts earlier are untouched and never shown in Post. Design receives the approved copy only.
- Decisions applied: non-postable design handover on Design Work Detail plus SM notification; existing non-conforming URLs untouched; Content to Design handoff; Script is the document or a Drive link; caption and hashtags written on Post; Drive clips open in Drive; PDFs keep downloading.
- External clip URLs checked before the Drive-only rule. All 14 were demo data: 3 from Google's public sample-video bucket and 11 on cdn.example.com, none with an uploader.
- Tests updated for the new rules: placeholder hosts in fixtures became Drive links, journey fixtures save a caption for postable Script and Content steps, and the old Post and Review Studio fixtures use handed-over assets and an uploaded video.
- Browser test, 30 of 30, on a disposable database, after 5d:
  - Reel: the Writing Studio has no caption box. Script is a Drive link through the Writing Studio, with a non-Drive link refused. Shoot as an uploaded clip, with an external clip refused. Edit footage shows the approved clip. The Edit cut is uploaded. Post downloads the cut and starts with an empty caption box. Mark as posted stays disabled until the poster writes a caption. Caption and hashtags are saved on the Post step and show read-only after posting.
  - Static Post: Design gets the copy and no caption. A Drive slide is added in the UI plus an upload. Review Studio previews the upload and lists the Drive slide. Post gets both files.
  - Poster: the Drive-link design is approved, one SM notification is sent, and the handover panel shows for SM and not for executive.
  - Non-participant 404; no page errors or 5xx.
- Known, not fixed:
  - Review Studio has no inline PDF viewer (decision 6).
  - Clips and designs that are Drive links have no thumbnails.
  - The Work Detail "Worker Output Link" still shows the latest submitted link, not the approved one.
  - A disposable fixture with an invalid content piece made publishing return 500 after the step was saved. It was test data only, but publishing updates the piece after the step, so a bad piece fails the request.

## Phase 4: Uploads and sockets (Status: COMPLETE; committed locally, not pushed)

Four commits, each gated in the working tree: 4a `208f884`, 4b `69f290b`, 4d `74598d1`, 4e (this commit). Local `/uploads` stays public for development and testing; production file access will use Cloudinary signed URLs in the deployment phase.

- 4a, upload safety:
  - The general upload route accepts video, image and PDF only, matched on extension and type. Avatars accept images only. Files are stored under a random name with the server's extension (`modules/uploads/fileTypes.js`).
  - `/uploads` is served with `Content-Security-Policy: sandbox` and `nosniff`. Anything that is not an image or video downloads, including PDFs: "Open Full PDF" in the Design workspace now downloads.
  - Chat uploads need a valid channel id and membership before any file is written. Message attachments are built from the file on disk, and a share card sent by the client is ignored.
  - Chat links are http(s) or site paths only, in the API and the web (`lib/safeUrl.ts`). Report HTML is escaped, and the Reports preview frame is sandboxed.
- 4b, login tokens:
  - Tokens live only in the httpOnly cookies. Login and refresh no longer return them in the body.
  - The web stores no token and sends no Authorization header. Old copies in storage are cleared at start and at logout.
  - REST, uploads and the socket renew an expired access cookie once and retry once.
- 4d, sockets:
  - The handshake reads the cookie or an auth field, never the URL. It looks the user up, refuses suspended users, and takes the role from the database.
  - A user's sockets close on logout, suspension, forced logout, revoked sessions and any role or status change; the web reconnects once.
  - Leaving or removal takes a member's sockets out of the channel room. Read receipts and typing need membership, and executives cannot type.
  - No socket payload carries email, phone or WhatsApp (`lib/socketHub.js`).
- 4e, reports and metadata:
  - `POST /api/uploads/metadata` no longer attaches files to a submission.
  - Report work-item filters are limited to `departmentId` and `status`. Earlier, `format`, `report` and `month` reached the query and emptied reports, so the web's month filter returned nothing.
  - Weekly report blockers are limited to the report's own work items.
  - `/api/reports/individual` and `/individual/:userId` are removed.
  - Report emails go only to registered emails of active users; the automation default `creative_head@hacaforge.com` is dropped.
  - Deleting a clip deletes its local video and thumbnail file. Replaced clips and old versions keep theirs.
- Team performance digest: team-level totals only, for every role. Each figure and its source:
  - Active contributors: count of active team members and SM managers.
  - Steps in scope and steps completed: counts. Completed means Approved or Published, the same rule as `isFinished` in `workItems/access.js`.
  - On-time rate: shared `calculateIndividualWorkMeasures().isLate`, only for finished steps with a due date and a recorded submit or post time. Post time stands in for submit time.
  - Average work time: shared work time over submitted rounds only, so a live round never counts.
  - Average approval wait: shared approval wait, only where a decision was recorded.
  - Revision rounds recorded: sum of each step's stored `revisions` count.
  - Team and per-step-type rating: one rating per finished step, the rating on its latest approved submission (`approvedOutputOf`). No average below 3 ratings, the same rule as worker ratings.
  - Revisions per piece and workload: "Not available yet".
  - Removed: the per-person table and three hard-coded summary figures ("92%", "1.2 revisions per piece", "96%").
  - Every figure says how many steps it is based on.
- Browser test, all 5 roles on a disposable database, 49 of 49 checks. Covered:
  - Cookie login, with no token in storage after login, refresh and reload.
  - Sockets with no token in the URL.
  - Video upload and playback, including range requests.
  - PDF download, avatar upload and display, .html and .svg refused.
  - Chat attachment, media card and its video, live chat.
  - A stored `javascript:` link that does not render as a link.
  - A suspended user cut off from live chat at once.
  - Executive with no composer and no uploads.
  - Sandboxed Reports preview, team-only digest, logout.
  - No page errors and no 5xx.
- Known, not fixed:
  - Attachment-only chat messages create no notification, because the empty text fails validation.
  - The weekly report's own on-time rate still uses `updatedAt`.
  - Clip and submission URLs are not checked when a clip or submission is saved; chat now drops unsafe ones when shared.
  - A revoked or force-logged-out device can still reconnect until its 15-minute access token expires, the same as REST, because access tokens carry no session id.
  - `.gitignore` line `uploads/` also matches `apps/api/src/modules/uploads/`, so new files there need `git add -f`.
  - The month filter on reports is ignored, as it is not a work-item field; which date it should filter on is open.

## Phase 3.5: Landing the uncommitted work (Status: COMPLETE; committed locally, not pushed)

- Why: 138 uncommitted files sat under every phase. They caused conflicts, hid a leak in Phase 3, and made working-tree and clean-worktree test counts differ by 100 API and 114 web tests.
- Landed as 14 commits, each gated alone in a clean worktree except this notes commit: 422cd76, 0962ddf, af960a2, eb2b102, fe5062a, 3edfc8b, 092fc78, 8620857, 699c07c, 52587e7, aa52f41, 174d7a8, 3acb0eb, then this file.
- Sentry removal (group 1): `apps/api/src/config/sentry.js` and `apps/web/src/lib/sentry.ts` are deleted, with their imports and `SENTRY_DSN` / `VITE_SENTRY_DSN`. Two `SENTRY_DSN` keys are removed from `render.yaml`. No Sentry package was installed, and the web helper only wrote to the console, so no error reporting was lost. `ErrorBoundary` still catches render errors, shows its fallback and logs to the console; `components/__tests__/ErrorBoundary.test.tsx` (4) was added because nothing covered it. The fallback text still says "error diagnostics have logged the details", which now means the browser console.
- Split across groups by hunk: `packages/shared/src/index.ts`, `apps/web/src/App.tsx`, `apps/web/.env.example`, `apps/web/src/components/ErrorBoundary.tsx`.
- Moved between groups, with approval: the `ErrorBoundary` Sentry lines to group 1, and `CalendarTabs.test.tsx` from group 6 to group 7.
- Flaky test: `TeamMemberRouteBoundaries` failed 2 tests in the group 7 full web run and passed 8 of 8 when rerun alone. It passed in every other run. The cause is not proven; it looks timing-related under load.
- Smoke test after group 13, on a clean worktree and a disposable database: team_member (step owner and non-participant), sm_manager, executive, creative_head and admin. No page errors, broken screens or 5xx responses. No contact details or private notes reached the wrong role. Real database counts and last work-item update time unchanged.
- Incident: the disk filled during this phase and MongoDB aborted, because it could not write its diagnostic file. A private copy of the data was recovered and validated first, then the service was restarted by the owner. `marketing_portal` validated clean with counts unchanged; no repair was run. The npm cache and pnpm store were cleared to free space.
- Phase 3 close-out, reported and not fixed:
  - My Work has no "Resolve Blocker" button. A step owner has no working screen for it, only the API. Owner blocker resolution is planned for a later phase.
  - Work Detail's "Resolve blocker" shows only to a creative_head or admin who does not own the step. From the code, the creative_head gets a 403. It moves the step to In Progress but leaves the blocker record Active.
- Other known issues, not fixed: the web calls `GET /api/content-pieces/:id`, which has no route, so Review Studio's Outputs tab stays empty. An executive opening My Work by URL gets a 403 on the data but sees "All caught up". Demo passwords remain in `baselineUsers.js`, and in git history for `LoginPage.tsx`.
- Next phase, not started: `/uploads` protection investigation.

## Phase 3: Access boundaries (Status: COMPLETE; committed locally, not pushed)

- Root cause: most routes checked a role permission but not whether the person was on that deliverable. Any team member could read any work item, read revision notes through `/submissions/:id`, and resolve any blocker. Executives could write editor locks and clip seen marks, and received contact details.
- One access check in `workItems/access.js`. Someone not on the deliverable gets the same 404 body as a missing or invalid ID. A participant who may see the step but not do the action gets 403. Invalid-ID behaviour for other roles is unchanged.
- `router.param` runs after `authenticate`, so an unauthenticated request stays 401, and before route permission checks. It is set on each router, and explicit middleware is used where `:id` means different things on one router. A route inventory test covers every `:id` route, the `/api/work-items` aliases, and submission, clip, rating, comment and blocker IDs.
- Participants see pipeline status for every step. They see outputs only for their own step and approved earlier steps (`workItems/viewerRules.js`). Later outputs, unapproved versions, rejected clips and earlier-step review threads stay hidden.
- Revision notes, rating feedback and clip threads: step owner, admin, creative_head and sm_manager only. Executives are excluded.
- Contact details: `middleware/redactContact.js` removes email, phone and WhatsApp from every REST response for team_member and executive, at any depth, except their own record.
- `/transition` checks ownership before the same-status and invalid-move returns.
- Blockers: the list is scoped to deliverables a team member is on; leadership visibility is unchanged. Resolve and notify: step owner, sm_manager or admin. Behaviour change: creative_head cannot resolve or notify on a step they do not own, and neither can a dependency owner who is not the step owner.
- Editor locks: step owner or admin. Creative head and SM manager opening the Writing Studio get a 403 that the page already handles.
- Screens: decision controls, the comment box and the three viewer comment entry points are hidden from sm_manager and executive. Clip threads are hidden from executive and read-only participants. Ping and Resolve appear only for people allowed to use them.
- Isolation found a real leak: at HEAD, steps can be Mongoose documents and the filter copied their internals, including a later step's output. Fixed in the filter, with a test.
- Tests: `apps/api/test/access_boundaries.test.js` (66), `apps/web/src/pages/feedback/__tests__/ReviewAccessControls.test.tsx` (13). Older tests updated where they relied on removed behaviour. `IssuesExecutiveReadOnly.test.tsx` was also updated, but it belongs to an earlier uncommitted phase and is not in this commit.
- Checked in a browser on a disposable database: team_member (step owner, earlier-step and later-step participant, non-participant), sm_manager, executive, creative_head and admin. The read-only Shoot screen works for an allowed participant, showing the approved clip only, with no rejected clip or thread. Plan, tracker, team, calendar and dashboard screens work after redaction. Real writes: creative_head approval, sm_manager resolve, admin ping. Real database counts and last work-item update time unchanged.
- Not changed, for the next phase: Socket.IO `comment:new` sends the author's email to the step owner and head and admin rooms (`submissions/service.js`). Chat socket events and chat shared assets, reports, and public `/uploads` are not reviewed.
- Existing bug found, not changed: the web calls `GET /api/content-pieces/:id`, which has no route. Both callers handle the 404, so the Outputs tab in Review Studio stays empty.
- Next phase, not started: `/uploads` protection investigation.

## Approval integrity close-out (Status: COMPLETE; committed locally, not pushed)

- Rating, tags and note clear after a stale refresh and whenever the review item changes, in Review Studio and Shoot review.
- Shoot send-back now returns the step to In Progress, like a normal revision. The version closes and no rating is created. The send-back note goes to the owner's notification only; My Work shows a generic message for it.
- Round times: `workItems/rounds.js` keeps each round's submit time, on both submit paths. A round already submitted keeps its time and the next submission starts a new round.
- Fixed: `/transition` wrote the "changes requested" decision on the new round instead of the reviewed one.
- An owner cannot take a review step out of Pending or Feedback while its latest version awaits review: 409, on `/transition` and `POST /api/blockers`, with no revision counted. No real step or screen relied on this. `submit-clips` is exempt because it is the submission. Steps that do not require review are unaffected.
- My Work now uses the latest version's state: a resubmitted step shows as under review, and a sent-back step shows Rework with Resubmit. Blocked and help actions are hidden while under review, here and on Work Detail.
- Fixed: Resubmit in My Work from Feedback sent a same-status request that saved nothing. It now moves to Pending.
- Checked in a browser on a disposable database: Feedback page, owner resubmit, withdrawal blocked, Work Detail Shoot button, Shoot send-back and resubmission, reopening, and admin, sm_manager and executive review screens. Real database counts and last work-item update time unchanged.
- Found, not changed: Review Studio shows Approve and Request Revision to sm_manager and executive (the API returns 403), and the review queue returns contact emails to executives. Carried into Phase 3. There is no reopen button on any screen; reopening is API only. A superseded clip can still be approved, which has no effect on the step.
- Next: Phase 3 access boundaries investigation. KPI work not started.

## Approval integrity (Status: COMPLETE; committed locally, not pushed)

- Root cause: the approval rules were not in one place. Resubmitting did not retire older versions, the queue listed every submitted version, and each decision path checked different things.
- One shared check in `submissions/reviewDecision.js`, run before any write on approve, request revision, shoot review and Feedback "Revision Required": the version must be the latest real one and `submitted`, sent after the step's last decision, on a step in Pending or Feedback. creative_head and admin decide; nobody decides on their own work.
- Shoot approval needs every required clip approved on every route, with at least one clip. A clip replaced by a newer one no longer counts. Clip-level review is unchanged.
- Partial writes: MongoDB runs standalone, so there are no transactions. Everything is checked first, one atomic update claims the submission so only one decision can win, and a failed required write undoes the claim and anything written after it. Events and notifications run after the step is saved and cannot fail the decision. A process crash between writes is not covered.
- Feedback route: approval returns 409 and the option is gone from the page. `/transition` cannot approve a review step, with or without a submission. The Shoot exception and "Done and forward" are removed.
- Live caller found: My Work sent Shoot owners to `toStatus: 'Approved'`. No real step used it. My Work and Work Detail now send Shoot owners to the Shoot workspace.
- Fixed: `/transition` created Shoot and Edit submissions with `kind: 'media'`, which is not an allowed value, and the error was swallowed, so those steps got no submission. It now uses `video`.
- Reopening: creative_head and admin only, through `/transition`, never on their own work. Ratings stay. The old version cannot be decided again; a new submission and decision are needed.
- Downstream steps on reopen: nothing happens to them. They stay unlocked with their status unchanged, so a Post step can still go ahead. `reconcileContentPieceStageLocks` only ever unlocks. Left as is.
- Queue GET is read-only, and lists only the latest real version on a step awaiting review. Existing records were not changed, so the 7 stale real entries are hidden, not repaired.
- Review Studio shows a clear message on a 409 and refreshes the queue. Work Detail shows a message instead of approving a review step with no submission.
- Tests: `apps/api/test/review_decision_integrity.test.js` (152), `apps/web/src/pages/feedback/__tests__/ReviewDecisionFlows.test.tsx` (10). 27 older tests were updated because they relied on removed behaviour.
- Checked in a browser on a disposable database: approval, request revision, stale version, already decided, shoot approval with clips, shoot send back, no-submission message, My Work Shoot button. Real database counts and last work-item update time unchanged.
- Not checked in a browser: reopening, the Feedback page and the Work Detail Shoot button; API or unit tests cover them. Other roles' screens beyond creative_head and one team_member.
- Known limits: the star rating stays selected after a stale version refreshes, so a reviewer must re-check it. A resubmit from Feedback can overwrite that round's submit time; to review in the KPI phase. An owner can still pull back their own Pending or Feedback step to In Progress through `/transition`, which counts as a revision.
- `docs/PROGRESS.md` is not part of the commit, because it holds notes from other uncommitted phases.
- Next phases, not started: GET access, project KPIs.

## PATCH /api/work/:id access fix (Status: COMPLETE; committed in 9c4748d)

- Root cause: the route only checked `work.update.own`, which does not look at ownership, and `updateWorkItem` applied changes without checking the user. A team member who did not own an item could change its title, owner, deadline, priority and skip state.
- New guard `assertCanPatchWorkItem` runs before validation, so a blocked user learns nothing from validation errors. Ownership comes from the stored step. Requests are fully allowed or fully rejected. It covers `/api/work/:id` and `/api/work-items/:id`.
- admin, sm_manager: every field. executive: 403, unchanged.
- Step owner in any other role: `deliverableUrl` only, and 403 once the step is Approved or Published. An empty body stays allowed, because the deliverable flow can send one when no link was given.
- team_member owning another step of the same content piece: 403. Any other team_member: 404, with the same response for a non-participant item, a missing item and an invalid id.
- creative_head not owning the step: 403.
- A PATCH with a deadline now sets `deadline`, `dueDate` and `dueDateSource: 'manual'` together. A PATCH without one leaves all three alone.
- `dueDateSource` was added to the WorkItem schema (default null), because the field did not exist there and writes to it were dropped. Side effect: `plan.service.js` and `contentPiece.service.js`, which already set it on steps, now save it too. No data was changed or migrated.
- An empty PATCH is a true no-op: 200, nothing saved, no update event.
- Tests: `apps/api/test/work_patch_access.test.js` (230, each case on both paths). The original attack, rerun on the test database, now gets 404 and changes nothing.
- `dueDateSource` readers: plan grid and row panel read it from `ContentPiece.stagePlan`, a separate field. Nothing reads the WorkItem field, so saving it changes no behaviour today.
- Worker flow checked in a browser on the Design step, disposable database: with a link and with an uploaded file only, submission and link saved, step in Feedback (shown as Waiting for approval), and in the review queue. With neither, the form shows an error and sends nothing. Shoot and Edit screens were not run, and no screen sent an empty PATCH.
- Review of `/api/work/:id/transition`, not changed: it has an ownership check, but a same-status request returns the item with 200 and an invalid transition returns 400 before the check runs. A non-owner team_member gets 403, not 404.
- Next phases, not started: approval integrity, GET access, project KPIs.

## Calendar: status colours and individual work badge (Status: COMPLETE; committed in Phase 3.5)

- Month entries are coloured by status tone, with the status also in words for screen readers. Week, List, Custom and the preview use the shared status labels. A key under the calendar explains the colours and the badge.
- Individual badge: on work from an individual plan, or not part of any plan. `GET /api/work/calendar` now sends `isIndividual`. The word shows at 1536px and wider; narrower month cells show the icon only.
- Publish and Needed by dates now take the status of the piece's final step (a change: before, they showed Approved or Planned from the plan row). A row with no steps stays Approved or Planned.
- Fixed: `isOverdue` was never sent to the calendar (`.lean()` drops the virtual), so the overdue marker never showed. Week, List and Custom now show the exact days.
- Fixed: Publish entries have no priority, which the preview's code could not handle. "Open Workplace" now opens the final step, and is hidden when there is none. List view no longer prints "undefinedh".
- Checked read-only at 1600, 1024 and 360 on real November 2026 data: no overflow, no clipped day lists, badge visible at each width, Publish preview opens with no page errors. Admin only. On screen: Approved, In progress, Not started, Posted and Locked. Waiting, Changes requested and Blocked are not in the data, and no overdue entry is in November.
- Not changed: most pieces show two Publish entries on the same day (the publish date and the Post step).

## Login page: quick sign in for local development (Status: COMPLETE; committed in Phase 3.5)

- One-click buttons for Admin and the 12 demo accounts, shown only on the Vite dev server (`DevQuickLogin.tsx`, `LoginPage.tsx`).
- Accounts live in `apps/web/.env.local` (ignored by git), as base64 JSON in `VITE_QUICK_LOGINS`. Base64 is not encryption. No passwords are in source or in this file.
- Production build scan: 0 passwords and 0 demo emails in `dist`. The panel code itself is in the bundle but has no accounts and renders nothing.
- All 13 passwords matched their stored hashes (read-only compare). In the browser, Admin signed in for real and reached /dashboard; the other 12 buttons sent the right account, with the request stopped before it reached the API.

## Plan grid: Publish Time column removed (Status: COMPLETE; committed in Phase 3.5)

- Removed from the grid columns, with its cell code. Paste from Excel and the template never used this column.
- Kept: the Publish time field in the row side panel, and the saved value. From reading the API code (not run for this change): rows saved without a time get 18:00, and the import still accepts a publish time header.

## Work Detail workflow redesign (Status: COMPLETE; committed in Phase 3.5)

- Replaces the staggered look described below: cards sit in one aligned row with equal heights, joined by straight status-coloured arrows. Dashed arrows mean not reached or needs attention. Phones stack the cards with down arrows.
- Each card has a status-tinted head (step number and status), the step name, the worker row (photo, name, job role), then times, then deadline, days late and revisions.
- Photo comes from the shared `Avatar`: initials when there is no photo, a placeholder when unassigned. `GET /api/work/:id` now returns the owner's `avatarUrl`.
- On real data only 2 of 63 users have a photo and neither owns a work item, so real cards show initials today. A photo was confirmed loading on a card by changing the API response inside the test browser tab only.
- Checked read-only at 1536, 1024, 768 and 360 on three real items: no page overflow, arrows touch both cards and sit centred. Waiting, Changes requested, Blocked and Locked were not seen on real data.

## Work Detail workflow diagram (Status: COMPLETE; committed in Phase 3.5)

- `PipelineStepper.tsx` is now a workflow diagram: Start and End labels, status-coloured cards, curved connectors with ports, a summary strip, and a colour key. Phones stack the cards with straight lines.
- Lines are coloured by hand-off: done (solid green), active (solid blue), attention (dashed red), idle (dashed grey).
- Each card shows owner, deadline with days late, started, submitted or resubmitted, approved or posted, and revisions. The Post step has no submitted row. The summary shows overall started, finished and final deadline.
- `getWorkItemById` fills blank step times in the response from the activity log and submissions. Saved records are not changed, and saved times win. On real data before this change, 18 started steps had no start time, 12 had no submit time, and 13 finished steps had no finish time; all of these can be filled from that history.
- A time that truly has no record shows a dash on the card and "Not recorded" in the summary.
- Tests: `PipelineStepper.test.tsx` (8), `work_detail_step_times.test.js` (3).
- Checked read-only in a browser at 1536, 1024, 768 and 360 on two real items: no page overflow, lines end on their ports (0px off), cards in a row are equal height on wide screens. The Published colour key entry was added after this check and is covered by a unit test only. Waiting, Changes requested and Blocked colours are covered by unit tests or not seen on real data.

## Overdue days and Work Items table (Status: COMPLETE; committed in Phase 3.5)

- `overdueDays` and `formatOverdue` in `@mmp/shared` count whole calendar days, the same way as "Late by". `components/OverdueChip.tsx` shows "Overdue by 8 days", "Overdue by 1 day" or "Overdue today".
- Used on Work Items (table and grid), Dashboard, My Work, Work Detail, Team Directory, Team Workload and the Calendar item preview; the Calendar month dot's tooltip shows it too. The Tracker keeps its "Late by" column. Summary cards still show a count.
- `.status-chip` now has default padding at zero specificity, so existing padding classes still win. The Plan Grid row column was widened to fit.
- Work Items table: title on its own line with type and stage chips beneath; date with the overdue chip beneath; dates read "29 Oct 2026"; even cell spacing.
- Tests: `components/__tests__/OverdueChip.test.tsx` (4).

## Header and calendar filters (Status: COMPLETE; committed in Phase 3.5)

- **Header Team Chat:** new `components/HeaderChatAvatars.tsx`: 32px faces, one 6px overlap, 2px ring, "+N" chip for the rest of the team. Faces are recent DM partners, then group creators, then Team Chat members (photos first), never yourself. Hidden below 1024px. The Search chevron is also hidden below 1024px, where it overflowed its segment.
- **Calendar selector:** the chips became one labelled `ui-select` dropdown (colour dot for the chosen calendar); the "Viewing" text was removed.
- **Calendar Month tab layout:** row 1 is navigation or date range with the view tabs opposite; row 2 is the filters at full width.
- **Custom dates:** a fourth view, Custom, with From/To date pickers (default today + 30 days). It uses the existing `start`/`end` on `/api/work/calendar`, inclusive in local time, and shows the agenda. An end before the start shows an error and loads nothing. The range is not kept in the URL, so a reload returns to the Month view.
- **Departments:** "WhatsApp" came from the fixed `DEPARTMENTS` list in `@mmp/shared`, seeded into the DB by `seedReferenceData`; it has 0 people and 0 work items.
  - New `GET /api/departments?inUse=true`: departments with an active person or a work item. Without the flag, every department is still listed.
  - Calendar and Dashboard filters use it; the Dashboard's hardcoded fallback was removed, and a stale `departmentId` in the URL is cleared.
  - Team Workload chips show departments with members only (the "7 creative departments" copy was removed). Access Requests filters by departments named in its requests. Team Directory already used real members.
  - Every one of these filters is hidden when it has nothing to list.
  - Not changed: the sign-up and Access Requests assignment forms still use the fixed list; `seedReferenceData` still seeds all 7; no department records were deleted.
- **Tests:** `pages/calendar/__tests__/CalendarFilters.test.tsx` (6), `apps/api/test/departments_in_use.test.js` (2).
Note: on 5 Nov the machine had about 1.8 GB of free commit memory, and plain `npm test --workspace=@mmp/web` crashed a Vitest worker ("Zone Allocation failed – process out of memory", with about 78 MB of heap in use). The same suite passes with `npx vitest run --maxWorkers=2`. No test failed.

## Excel-style plan grid PG-4: Simpler full-screen grid (Status: COMPLETE; committed in Phase 3.5)

Baseline: 859 (API 674, web 185). Web-only change; no API, role or workflow rules changed.

**1. Full screen**
- New route `/calendar/plan-grid?calendar=&month=&plan=`, rendered with `Layout focusMode`: the header is unchanged, the sidebar is hidden, and content uses the full width.
- The Calendar tabs and panels are not rendered. One "Back to plans" button returns to `/calendar?tab=plans`.
- Calendar, month and plan are kept in the URL, so a reload keeps the place.
- Team members get the not-found page (RoleBoundary), and the API still returns 404.
- Older `?tab=plans&grid=1…` links redirect to the new route.

**2. Default planning view** (`plan-grid/columns.ts`)
- Columns (Publish Time since removed): Posting Date, Topic, Type, Brief, Publish Time, Script/Shoot/Edit/Posting Owner and Deadline, Content Link, Remarks.
- Posting Date, Topic and Type are frozen.
- Deadlines are native date pickers with "Set by you" for edited ones. A new row shows "Auto" until it is saved.
- Step owners use the Add Row rule: people with that step in their work preferences.

**3. Content/Design**
- No longer grid columns. They are shown, with owner and deadline, in the row panel's Steps & Deadlines section for design rows.
- Data, autofill, template/upload support and the API are unchanged.
- A row missing a step owner or deadline shows a ⚠ "Needs attention" marker (screen-reader text lists what is missing), and the panel shows a "Needs attention" chip with the list.

**4. Progress**
- The 10 Excel workflow columns (status, done date, approval, published, turnaround) are behind one "Show progress" toggle (`aria-pressed`).
- The toggle appears only once the plan has approved rows (before that every status is blank). It is not shown on phones.
- The per-group hide controls were removed.

**5. Dates**: Posting Date and every editable deadline use `<input type="date">` (keyboard accessible, no dependency).
- A picked date saves after 0.7 s or on blur.
- A single Excel-style value pasted into a date cell ("2 Nov, 2026", "16/11/2026", or month-resolved "05/11/2031") is read with the grid month.
- Read-only dates show as "2 Nov 2026".

**6. Row entry, one rule set**
- New `pages/calendar/planRowSteps.ts` holds the Add Row form's step logic: steps and offsets, auto deadlines, posting-date change, type/reel change, autofill merge, owner/deadline overrides and validation. `PlansTab`'s Add Row form now uses it.
- "Add row" opens the row panel with every Add Row field, Steps & Deadlines from the same helpers, owner suggestions from the same `POST …/autofill` endpoint, and the same checks before saving (required fields, past/after-publish/order, work preference, source video).
- Saving still goes through the grid API (validatePlanAndRows, same offsets).
- Typing in the grid, row panel edits and "Paste from Excel" (now its own dialog) all still work. Multi-row paste onto Posting Date/Topic/Type and other Excel-aligned cells still works too.
- Bug fixed: `calculateDueDateString` subtracted days in local time and read the result back in UTC, so in IST every Add Row deadline came out one day early until the autofill reply arrived. A posting-date change never refreshed it. It is now computed in UTC.

**7. Repeated actions** (inventory, then removals; no capability lost)

| Action | Removed | Kept (single entry point) |
|---|---|---|
| Add individual work | Plans tab header button | Calendar page header (SM/Admin only; it was shown to the Creative Head, whose plan creation the API refuses) |
| Open plan grid | Selected-plan "Open in grid"/"Review in grid"; wizard "Monthly Content Plan" option | Plans tab header: "Open plan grid" (SM/Admin) / "Review in plan grid" (CH) / "View plan grid" (Exec); opens on the selected monthly plan. The Feedback-page link to the grid stays (a different page). |
| Download Template | Plans tab header | Grid toolbar |
| Upload | (old modal was already unreachable; kept in code) | Grid toolbar |
| Submit for review | Selected monthly plan "Submit/Resubmit"; monthly row "Resubmit" | Grid toolbar (whole plan); row panel "Submit row"/"Resubmit row" (single row) |
| Approval actions | Monthly plans: PlansTab "Review Mode" (Approve All/Selected/Request Changes); Feedback page Approve buttons and row checkboxes/notes | Grid (Approve selected, Approve whole plan, row panel Approve/Request changes) |
| Add/Edit/Delete row (monthly) | Selected-plan "Add Row", row Edit/Rework/Delete, clickable step chips | Grid: Add row, cells, row panel (edit, delete) |

- Individual plans are not in the grid, so their Add Row, Submit and Creative Head review stay in the plan detail and on the Feedback page. They are their only entry points.

**8. Reliability**: browser check on a disposable stack (Vite :5298 → API :8091 → `marketing_portal_uicheck`, departments seeded; stopped and dropped afterwards).
- **SM, Reel through Add row:** suggested owners came back, and auto deadlines were Script 12 Apr, Shoot 15, Edit 18, Post 20. A manual Edit deadline was saved.
- **SM, Static Post typed in the grid:** the date was picked; Script/Shoot/Edit showed N/A; a Posting owner change and a manual Script deadline in the grid both autosaved. In the row panel, Content/Design steps were shown and a Design owner was set.
- **SM, paste and submit:** Paste from Excel (`28/04/2027`, `Carousal` → Carousel Post) was saved. After a reload the URL and rows were kept. Submit worked.
- **Creative Head:** approved the reel and returned the post with a note.
- **SM again:** the approved row was locked (0 inputs). Show progress listed the 10 progress columns. The feedback showed in the panel, and "Resubmit row" worked.
- **Admin:** edits but has no review actions.
- **Executive:** read-only, with only Back and Show progress; writes get 403.
- **Team member:** not-found page, and the API returns 404.
- At 1440/768/360 for SM, CH, admin and executive: sidebar hidden, Calendar tabs gone, header kept, page overflow 0, and no unlabelled fields, unnamed buttons, small targets or page errors. The only contrast flag is the disabled "Approve selected (0)", which is exempt.
- Fixed during the check:
  - Compact row status dots had no size, so they were invisible at 768px.
  - Plan list and detail periods were shown in local time: an IST viewer saw "4/1/2027 – 5/1/2027" for April. They are now shown as stored dates.

**Tests**
- Web: `PlanGrid.test.tsx` was rewritten (21). It covers default columns and the hidden Progress view, deadline maths and manual override, date picking, typing and paste into date cells, design owners in the panel with Needs attention, Add Row parity (same endpoint, steps and checks), Paste from Excel and multi-row paste, locked approved rows, and single-row submit.
- `CalendarTabs.test.tsx`: three tests were rewritten for single entry points. An individual-plan fixture proves its Add Row form and review stay.
- `PlanGridRoles.test.tsx`: phone and accessibility tests were updated for date pickers. The approval-tab tests now cover monthly (grid link only) and individual (review kept).

## Excel-style plan grid PG-3: Review, roles, mobile (Status: COMPLETE; committed in Phase 3.5)

Baseline: 841 (API 668, web 173). The 21:39–21:41 demo-account plan changes were left untouched.

**Approval restriction**
- `reviewPlan` (approve_all, approve_selected, request_changes, reject) now allows `creative_head` only; admin gets `403 FORBIDDEN_APPROVAL`.
- Admin keeps every other permission: plan create/edit, grid editing, submit, and step approvals in `transition.service` (unchanged).
- What depended on admin approval:
  1. The old plan detail "Review Mode" in `PlansTab` (`isCreativeHead` counted admin). It now shows for the Creative Head only.
  2. Feedback > "Plans waiting for approval" (`PlansApprovalTab`) showed Approve/Request Changes to everyone. It now shows them to the Creative Head only; others see "Only the Creative Head can approve or return plan rows." and a "View in plan grid" link.
  3. No API or web test depended on admin approving plan rows.

**Team member**: all `/api/calendar-plans/grid*` routes return 404, in the same body shape as the `/team` isolation 404; this was 403 in PG-1. Other roles are unchanged.

**Creative Head review in the grid**
- Paths in: Plans & Approval → "Review in plan grid"; selected monthly plan → "Review in grid"; Feedback → Plans waiting for approval → "Review in plan grid". The last uses a deep link: `/calendar?tab=plans&grid=1&gridCalendar=…&gridMonth=…&gridPlan=…`.
- The grid opens filtered to "Only rows waiting for review (n)", which can be switched off. There are no editing controls: cells are plain text, and the API still returns 403 for planning writes.
- Actions:
  - Select rows → "Approve selected" (`approve_selected`).
  - Row panel → "Approve row", or "Request changes" with a required note (`request_changes`).
  - "Approve whole plan" (`approve_all`, after a confirm dialog). VERIFY: it is enabled only when every row that is not yet approved is submitted, because the existing `approve_all` rule approves every row, drafts included.
- Review Feedback stays visible in the row panel.

**Executive**
- "View plan grid": a read-only note, plain-text cells, no Template, Upload, Paste, Submit, Review or Delete, and a row panel without Save or Delete.
- Grid data carries names only.
- Every direct write returns 403: grid rows, upload, review, submit, PATCH/DELETE/POST rows.

**Mobile and tablet**
- Below 1024px the frozen columns are narrower (100+116+170+132 px), so other columns scroll into view at 768px; row status shows as a dot with a screen-reader label.
- Below 640px the grid becomes row cards. Each card shows date, type, topic, status, owners and visible problems, with an "Edit row", "Review row" or "View row" button. The row panel then also edits Posting date, Topic, Type, the step owners and Remarks.
- "Add row" opens the panel for a new row. Submit stays in the toolbar. Paste is desktop/tablet only, with a note saying so.

**Accessibility**
- The table is named by calendar and month. Each row header reads "Row n: topic". Cells are named "Column, row n, topic". The Turnaround header includes its explanation.
- Failed cells have `aria-invalid` and a visible "⚠ message" under the cell, linked with `aria-describedby`.
- Row panels, the preview dialog and the new confirm dialogs (whole-plan approval, delete row; delete no longer uses `window.confirm`) all use `useDialogFocus`.
- Errors from actions taken inside the panel now show in the panel with `role="alert"`; before, they were hidden behind the drawer.

**Tests**
- API: `plan_grid_pg3.test.js` (6) covers:
  - the full flow (paste → submit → approve one row → return one with a note → approved row locked, returned row editable with feedback);
  - admin refused for all 4 review actions;
  - admin's other permissions;
  - the Creative Head blocked from planning edits;
  - executive read-only and 403 on 7 write routes;
  - team member 404 on 3 grid routes.
- Web: `PlanGridRoles.test.tsx` (12) covers Creative Head review, executive read-only, phone add/edit, accessible names and cell errors, and the admin and Creative Head views of the approval tab.
- Changed tests:
  - `plan_grid_pg1.test.js`: team member 403 → 404.
  - `PlanGrid.test.tsx`: the viewer test now expects plain text instead of disabled inputs.

**Browser check**
- Ran on the disposable stack: Vite :5299 → API :8090 → `marketing_portal_uicheck`, with 7 departments seeded there so approval could create steps. The stack was stopped and the DB dropped afterwards.
- SM pasted 2 rows (preview: `05/03/2027` → 5 Mar 2027, `Poster` → Static Post), saved and submitted. The Creative Head approved one and returned one. As SM, the approved row was locked and the returned row showed the feedback.
- Executive saw no actions and got 403 on writes; admin got 403 on review; the team member got 404 and saw no grid entry.
- 1440/768/360 for SM, Creative Head, executive and admin: page overflow 0; no unlabeled fields, unnamed buttons or small targets.
- Contrast flags:
  - "Approve selected (0)" is a disabled button, which is exempt.
  - "Approved" at 768 was screen-reader text measured against the status dot. Fixed by moving the label outside the dot.

## Excel-style plan grid PG-2: SM grid (Status: COMPLETE; committed in Phase 3.5)

Baseline: 816 (API 655, web 161).

**Data**
- `PLAN-2027-01-001` was repaired: the period end went from 2026-12-31 to 2027-01-31 23:59:59.999Z, and a re-check found 0 bad plans.
- Later, at 21:39–21:41 IST, the activity log shows "Test SM Manager" working in the app:
  - created `PLAN-2027-02-001`;
  - deleted `PLAN-2027-01-001` and `PLAN-2026-11-002`;
  - added and submitted a row.
- These were not script changes and were left as they are.
- Business timezone: Asia/Kolkata, as approved.

**Decisions applied**
1. Content Owner and Design Owner are optional columns placed after Script Owner and Edit Owner. They show N/A on rows without those steps. The 18 Excel columns are unchanged (`PLAN_GRID_COLUMNS`); the screen uses `PLAN_GRID_DISPLAY_COLUMNS`.
2. Reels default to Script + Shoot. The flags live in the row panel. A Script or Shoot owner on a variant without that step is a cell error ("This reel has no Script step…"); a Content or Design owner on a reel is flagged too.
3. Types: typed or pasted `Poster` → Static Post and `Carousal` → Carousel Post. The Type list offers all 15 documented types and sends `typeExact`, so the print Poster type stays selectable.
4. Slash dates:
   - An unambiguous DD/MM date is accepted.
   - Otherwise the date is accepted only when exactly one reading falls in the grid month (`resolvedByMonth`); anything else stays a cell error.
   - Paste and upload show a preview with the resolved date ("5 Jan 2027, from “05/01/2027”, read using the grid month") before saving.
5. Status mapping:
   - Approval and Done Date sources as proposed in PG-1.
   - Approval wording now matches the app: Pending = Waiting for approval, Feedback = Changes requested.
   - Locked steps show "Locked".
   - Turnaround is unchanged and has a header tooltip ("Days from row approval to publishing…").
6. Template and upload:
   - The template has the 18 columns plus Content Owner and Design Owner, with grey read-only headers, a Type list and a "How to fill" sheet. `?layout=legacy` still returns the older 23-column file.
   - New `POST /api/calendar-plans/grid/upload` (dry run first) matches owners by exact name. Older files are detected and still work: owner emails are resolved to people, and the old deadlines become step deadlines.
   - The older `/preview` endpoint also accepts exact names, with the same ambiguity error.
7. Paste speed: `buildAutofillContext()` loads members, open hours and 90-day revisions in 3 queries per request. The rules are unchanged, and earlier rows of the same paste still count in row order. A test checks it gives the same output as the per-row version. A 12-row paste loads members once.

**Bug fixed on the way**: the upload CSV sniff ("a comma in the first 100 bytes") also matched `.xlsx` zip bytes, so real Excel files were read as CSV and came back empty. Zip files are now detected first; this affected the older upload too.

**UI** (`pages/calendar/plan-grid/`: `PlanGrid.tsx`, `PlanGridPreviewDialog.tsx`, `PlanGridRowPanel.tsx`, `types.ts`)
- Plans tab: "Open plan grid" replaces "New Plan" and "Upload & Preview". "Add individual work" and "Download Template" stay. A selected monthly plan has "Open in grid". In the wizard, "Monthly Content Plan" now opens the grid.
- Grid:
  - Calendar and month pickers; a plan selector when a month has several plans (nothing merged; editing waits for a choice).
  - Two-row header with the 7 groups; every group except Plan can be collapsed, and collapsing hides columns without removing them.
  - Row column, Posting Date, Topic and Type are frozen. The grid scrolls inside its own box.
- Editing:
  - Text cells save on blur or Enter; Type and owner selects save on change. Owners are sent by id, which separates two people with the same name. "Auto-assign" returns the step to autofill, and suggested owners show an "Auto" chip.
  - Enter / Shift+Enter / ↑ / ↓ move between rows. ← / → move between cells at the text edges. Esc reverts.
- Paste: multi-row Excel paste from any cell (header row detected or not) goes through a dry-run preview, then save. Rows that fail stay in the grid unsaved, with the bad cells marked (`aria-invalid` plus a described error) and listed in a "rows need fixing" bar.
- Row panel: brief, publish time, priority, content link, reel steps, source video, step deadlines (auto or set by you, with "Use auto"), program/event, reference link, review feedback, row status, and delete.
- Submit for review uses the existing endpoint and is blocked while unsaved rows remain.

**Tests**
- API: `test/plan_grid_pg2.test.js` (13). `plan_grid_pg1.test.js` was updated: the ambiguous-date row now uses `03/04/2031`, and a month-resolved row and resolved-type checks were added.
- Web: `plan-grid/__tests__/PlanGrid.test.tsx` (12).
- Changed tests:
  - `step_deadlines_plan_form.test.js`: the 23-column test now requests `?layout=legacy`.
  - `CalendarTabs.test.tsx`: the SM and executive tests use the new entry point.

**Browser check** (SM, 1440/768/360, writes blocked, only dry-run validation allowed):
- No page overflow; grid and preview at 360 are 0 px wider than the page.
- No contrast failures, small targets, purple, unlabeled fields or unnamed buttons.
- 20 columns; the row panel traps focus.
- The paste preview resolved `05/01/2027` → 5 Jan 2027 and `Poster` → Static Post, and flagged "Nobody Here".
- December shows the plan selector.

## Excel-style plan grid PG-1: Data and API (Status: COMPLETE; committed in Phase 3.5)

Baseline before the change: 795 passing (API 634, web 161), typecheck and build clean.

**Period bug ("SM January 2027 shows 1/1/2027 - 12/31/2026")**
- Root cause: in the New Plan wizard, changing Period Start updated the title but left Period End at the previous default (31 Dec). The API never checked the order.
- Stored record: `PLAN-2027-01-001` (0 rows) has periodEnd `2026-12-31`. It was not rewritten. A dry-run repair finds only this plan: `scratchpad/repair-plan-periods.mjs`, with `--apply` only after approval.
- API fix:
  - New `resolvePlanPeriod` in `plan.service.js`. `month: 'YYYY-MM'` gives the whole month, from day 1 00:00Z to the last day 23:59:59.999Z (the existing date-only convention).
  - End before start is now rejected with `400 INVALID_PERIOD` for every kind. This is a reported behaviour change; it was accepted before.
  - Custom-range monthly plans that send no `month` still work, so the existing overlap-warning tests are unchanged.
- Wizard fix: changing Period Start now resets Period End to the end of that month, and the form refuses an end before the start.
- `APP_TIME_ZONE = 'Asia/Kolkata'` (VERIFY: no timezone is configured anywhere; IST is taken from the report schedules). A plan's month is read in IST, so plans stored at UTC midnight and at local midnight both land in the right month.

**Shared (`packages/shared`)**
- `PLAN_GRID_COLUMNS`: the 18 Excel columns with groups, editable/frozen flags and the owner step for each owner column.
- Month helpers: `monthPeriod`, `planMonthKey`, `monthKeyInAppTz`.
- Paste helpers: `parseClipboardTsv` (handles quoted cells) and `pastedRowsToCells` (header detection, or placement from the paste column).
- `parseGridDate` accepts `2 Nov, 2026`, `16/11/2026`, ISO dates and `Nov 2, 2026`. Ambiguous day/month dates are rejected, never guessed.
- `parseGridType` maps Poster → Static Post and Carousal → Carousel Post, otherwise exact app type names only.
- `matchGridOwner`: exact trimmed name; duplicate names count as ambiguous.

**API (`planGrid.service.js`, mounted before `/:id`)**
- `GET /api/calendar-plans/grid?calendar=&month=&planId=` returns the month's monthly plans (a selector when there are several, with `periodIssue` flags), rows in the 18-column shape plus app fields, and permissions. It never creates a plan.
  - People (names only) are returned to editors only.
  - Team members get 403.
- `POST /api/calendar-plans/grid/rows` accepts `{ calendar, month, planId?, rows:[{clientKey,rowId?,cells}] | tsv, startColumn?, dryRun? }`.
  - Only `sm_manager` and admin may use it.
  - Results are per row (`saved`, `valid`, `invalid`, `locked`) with `cellErrors` keyed by column, warnings and ignored workflow cells.
  - The draft plan is created on the first valid row. A month with several plans returns `409 PLAN_SELECTION_REQUIRED`; duplicates are never merged. Approved rows are locked.
  - It reuses the existing autofill (blank owners only), deadline offsets, `getPipelineForContent` and `validatePlanAndRows`. Existing plan rows are passed as context so duplicates are flagged on the new row.
- Existing endpoints are unchanged apart from the period checks above.

**Tests**: `apps/api/test/plan_grid_pg1.test.js` (21) covers month periods, the January bug, date/type/owner parsing, clipboard parsing, multi-row paste with the November column structure (synthetic data), unmatched and ambiguous values, autofill with manual overrides, bulk validation, approved-row lock, the duplicate-plan selector, role permissions (SM, admin, Creative Head, executive, team member), and the template download and upload preview.

**Open for approval (VERIFY)**: see the PG-1 report. Topics: Approval column source, done-date source, Content/Design owner columns, Reel step flags, `Poster` vocabulary, ambiguous slash dates, admin row review, the template/upload format, and paste speed (about 0.4 s per row from the existing autofill).

## Release fixes (Status: COMPLETE; committed in Phase 3.5)

Blockers
1. `LoginPage.tsx`: removed the "Demo quick-fill accounts" panel, so the client code has no hard-coded emails or passwords. A rebuilt `apps/web/dist` was scanned against every password and email in `apps/api/.env` and `baselineUsers.js`, plus demo patterns: 0 hits. **The admin password was shipped in earlier bundles, so it must be rotated outside this task.** The old quick-fill test was replaced: `pages/__tests__/LoginPage.test.tsx` now checks that the panel is absent and both fields start empty.
2. `MediaThread.tsx`: own-message bubble is now `bg-white border-ui-ink text-ui-ink`; it was white on white. Mark done, Reply and Reopen are 44px. New test: `workspaces/__tests__/MediaThreadBubble.test.tsx` (2).

Fix before release
3. `WorkListPage.tsx` rethemed: no purple, uppercase or font-black; status chips for status, priority and overdue; labelled `ui-select`/`ui-input` filters at 44px; named row-open button; view toggles carry `aria-label` and `aria-pressed`; grid cards are buttons inside a list.
4. `aria-label` added to the filter controls in `GlobalFilterBar`, `TrackerTab`, `TeamDirectoryPage` and `AccessRequestsPage` (16 controls).
5. Purple, indigo and gradients removed from `PersonWorkHistoryView`, `NotificationToast`, `ProtectedRoute`, the `App` spinner, `ErrorBoundary`, `AvatarCropModal`, `PersonWorkPage`, `LoginPage`, `SetPasswordPage` and `WelcomePage`. They now use ink, ui-card and ui-line. `WelcomePage` stays dark, on solid ink.
6. `CalendarPage`: out-of-month cells are no longer faded; only the date number is muted.
7. `ReviewStudioPage`: the role badge shows the viewer's role (`ROLE_LABELS`), not a hard-coded "Creative Head".
8. Removed the internal "Screen N •" labels on Feedback, Issues and Workload; removed the whole "Screen 14 • Phase 7" label on Reports.
9. Team member route boundaries: new `components/RoleBoundary.tsx` wraps `/reports`, `/workload`, `/feedback` and `/issues` in `App.tsx`. For `team_member` these pages never mount: there are no data requests and no counts, and the not-found state from `/team/:id` is shown instead. API behaviour and other roles are unchanged. New test: `src/__tests__/TeamMemberRouteBoundaries.test.tsx` (8), which renders the real `App` routes.

Verification: 12 affected routes × 5 roles × 1440/768/360 (180 views), with all non-GET API calls blocked.
- No page overflow, purple, gradients, unnamed buttons or unlabelled fields; no focus-ring gaps.
- writer1 sees "Page Not Found" on all four routes; the other roles see the pages.
- The remaining contrast hits are exempt or false positives: disabled Send Back button, disabled Approved radio label, and the hidden avatar "Edit" overlay.
- The remaining small targets, sub-11px text and uppercase weekdays are on the Later list (calendar chips, tracker link, team and profile chips) and were left as they are.

## Final polish follow-up (Status: COMPLETE)

- ShootReviewView clip gallery: each clip is now a `<button aria-pressed>` (44px min height); the cards contain no other controls. Works in the Shoot workspace and inside Review Studio.
- Design workspace: `MediaWorkspacePage` now passes the existing `revisionComments` (same submission comments the Edit workspace gets) to `DesignWorkspace`, which shows a read-only "Revision feedback (n)" section in the left panel with Creative Head/Admin comments (author, date, text). No API change; no write actions added. Share-to-chat button moved to the shared 44px primary button.
- Tests added: `apps/web/src/pages/work/workspaces/__tests__/GalleryAndDesignFeedback.test.tsx` (3): gallery clips are buttons with pressed state and can be selected; Design shows only reviewer feedback; nothing extra when there is none.
- Audit extended: clickable/target/contrast checks now scan the whole page (minus the frozen app shell) instead of only `<main>`, and treat `<summary>` as keyboard-operable. Re-run: workspaces (stored + editable) and Review Studio media — 0 issues; the only small targets are the 8 timeline markers (documented exception with a 44px list).
- Note: the local API on :8080 stopped during the checks (not caused by any code change); it was restarted with `npm run dev` against the normal `marketing_portal` DB.
- Gate: typecheck 0; web build clean; API 634 + web 150 = 784 passed, 0 failed.

## Final polish (Status: STOPPED — clip check found a keyboard bug; resolved in the follow-up above)

- Writing Studio: caption, snippet and comment fields now `ui-input ui-textarea` (visible borders). Editor untouched.
- Avatar crop: zoom slider uses a new scoped `.ui-range` (ink thumb, hairline track) plus `aria-label="Zoom"` and a 44px hit area. The global range rule (Teleprompter) is unchanged.
- Clip review live check on a disposable stack (API :8090 → DB `marketing_portal_uicheck`, Redis off, console email; Vite :5299 via a scratchpad config; real :8080/:5199 blocked; DB dropped and processes stopped afterwards):
  - Approve Clip and Reshoot Needed work for Creative Head in the Shoot workspace and in Review Studio (server: `approved` / `reshoot_needed`); Reshoot dialog opens with focus inside, closes on confirm; Send Back becomes enabled.
  - Videographer (step still Pending) sees the read-only review view: Scene B marked "Reshoot !" with an unread badge; the note is in that clip's thread. The "Reviewer Feedback" banner in the Shoot workspace only appears after Send Back (by design).
  - **Bug:** ShootReviewView clip gallery items are clickable `div`s with no tabindex/role (`apps/web/src/pages/work/workspaces/ShootReviewView.tsx` ~line 339, `onClick={() => setSelectedClip(clip)}`). Keyboard users can only review the default clip, in both contexts and for both roles. Not fixed (stop rule).
  - Audit gap found: the clickable-element check only scanned inside `<main>`; full-screen workspaces have no `<main>`, so their clickable `div`s were never checked (ClipCard root is covered by its "Open" button; the ShootReviewView gallery is not).
- Design revision view (read-only finding): request-revision stores the note as a `SubmissionComment` and in the notification text. `MediaWorkspacePage` loads it into `revisionComments` but passes it only to `EditWorkspace`; `DesignWorkspace` has no such prop. Work Detail's "Rework Feedback" banner reads `latestSubmission.feedback`/`rootCause`, which the Submission model does not have, so it never shows the note. A Designer currently sees the note only in Notifications. No feature added.
- Gate: typecheck 0; web build clean; API 634 + web 147 = 781 passed, 0 failed.

## UI Retheme UI-4C: Production workspaces, ShootReviewView, Review Studio media (Status: COMPLETE; committed in Phase 3.5)

- Baseline 781 (API 634 + web 147). Final gate: typecheck 0; web build clean; API 634 + web 147 = 781 passed, 0 failed. No tests added, changed or removed.
- Approach: the workspaces were full-screen dark apps. Chrome (headers, panels, forms, threads, checklists, dialogs) moved to the light theme with a scripted class mapper (dark neutrals → light surfaces; solid accents → ink; emerald/rose/amber tints → `status-tint status-approved/changes/waiting`; fields → `ui-input`/`ui-textarea`/`ui-select`; no gradients, uppercase or `font-black`). Media surfaces stay dark and neutral: `VideoPlayer.tsx` (excluded from the mapper), every `bg-black` well, clip thumbnails, the Review Studio stage.
- Files: `pages/work/workspaces/` — `MediaWorkspacePage`, `DesignWorkspace`, `ShootWorkspace`, `EditWorkspace`, `PostWorkspace`, `ShootReviewView`, `ClipCard`, `MediaThread`, `UploadManager`, `EarlierOutputsViewer`, `VideoPlayer`; `pages/feedback/review-studio/VideoPlayerViewer.tsx`, `ImageViewer.tsx`; `index.css` (new scoped `.ui-media-range` scrubber thumb).
- Accessibility:
  - Dialogs: ShootReviewView Reshoot, Approve Step and Send Back, and the Shoot clip lightbox → `role="dialog"`, labelled, `useDialogFocus`, named close buttons.
  - ClipCard: the whole card is mouse-clickable and contains other controls, so an "Open {clip}" button over the thumbnail is the keyboard path to the clip dialog; favourite has a name and `aria-pressed`; the shot select is named.
  - Workspace tabs (Edit, Shoot side panel) expose `aria-pressed`; Approve Step stars are named `N star(s)` with `aria-pressed` and are 44px; quality tags `aria-pressed`, 44px; Edit checklist toggles named, 44px; message fields, send buttons and back buttons named; visible labels paired with controls (Edit 5, Post 3, ShootReviewView 3, Design 2).
  - Review Studio media: all player controls 44px and named; Enter/Space toggles play on the video surface; speed buttons `aria-pressed`; timeline markers keep the 10px dot with a 24px named hit area (44px would overlap the seek bar and neighbours) plus a "Timecoded comments" list of 44px seek buttons; image pins keep their 28px look with a 44px hit area and a full name; **Add pin at centre** is the keyboard path to the existing pin form. Same 44px/naming/keyboard treatment on the workspace `VideoPlayer`.
  - Fixed during this pass (earlier-phase oversight): `.ui-textarea` only sets size and radius, so standalone uses had no field border. All uses outside Writing Studio now use `ui-input ui-textarea` (WorkDetail 7, Feedback 3, DecisionBar 2, ReviewStudioSidebar 1, Edit 3, ShootReviewView 3, ClipCard 1, Design 1, MediaThread 1).
  - Shoot sticky submit bar made opaque (`bg-ui-canvas`); Design slide-number badge opaque over images.
- Live check (non-GET `/api` aborted; an extra pass served each work item as "In Progress" in the browser only to reach upload/checklist states): Design, Shoot, Edit, Post as owner, creative_head and executive at 1440/768/360, every workspace tab, ShootReviewView in Review Studio — 55 views, 0 overflow, 0 undersized targets, 0 clickable non-controls, 0 unnamed controls, 0 unlabelled fields, no purple. Shoot clip dialog opens from the keyboard, focus inside, thread present, Escape closes. Review Studio: Approve Step dialog passes focus/trap/Escape/return. Media: controls 44px, keyboard play/pause works, timecoded list seeks, pin form opens at (50%, 50%), nothing saved.
- Feature presence (owner views): Design — copy, slide order, dimension guides, uploads ✓; Shoot — shot list, upload states, clip metadata, per-clip discussion, Approve Clip ✓ (Reshoot banner appears only when a clip is flagged); Edit — raw footage, pre-flight, revision checklist, cut upload ✓; Post — download, copy caption, copy hashtags, checklist, live URL, publish time ✓.
- Remaining gaps / VERIFY:
  - Edit workspace has **no zip download** of raw footage in the code (each clip/link is listed individually). Not added (no new features).
  - Design workspace shows no separate revision/version view in the owner screen; revision context comes from Work Detail and Review Studio. VERIFY intended behaviour.
  - Clip-level Approve/Reshoot buttons were not exercised live because every seeded clip is already approved; unit tests cover them.
  - The global `input[type=range]` thumb is still the legacy purple (`#7a6af6`) for non-media sliders (Teleprompter, avatar crop). Left unchanged because the Teleprompter must not change; the video scrubbers use the scoped `.ui-media-range`.
  - Writing Studio sidebar still uses standalone `ui-textarea` (caption, snippets, comments): fields have no visible border. Not changed in this pass because Writing Studio was out of scope; a one-line class fix each.
  - Role-specific views: creative_head and executive see the review view of each workspace, so owner-only tools are absent there by design.
- `docs/UI.md` rewritten to match the code (tokens, surfaces, controls/status, pipeline, shell, workspaces) with the requested corrections.

## UI Retheme UI-4B: Writing Studio (Status: COMPLETE; committed in Phase 3.5)

- Baseline: 781 (API 634 + web 147, from the root-cause correction). Final gate: typecheck 0; web build clean; API 634 + web 147 = 781 passed, 0 failed. No tests changed.
- Files (all in `pages/work/writing-studio/`), style/semantics only:
  - `WritingStudioPage.tsx`: header, loading, read-only banners (`status-*`, `role="status"`), Submit as the single primary action, status chip no longer uppercase, title is an `h1`; fallback-link modal → `glass-modal` dialog + `useDialogFocus`; layout: below `md` the docked sidebar stacks under the canvas (was squeezing the A4 page to ~40px at 360).
  - `WritingStudioRibbon.tsx`: tabs and toggle tools (bold, italic, align, lists, highlight, zoom, link, comments, focus) use `aria-pressed` with an ink active state; all tools 44px; icon-only tools named; coloured icon tints removed; one primary per tab (Insert Template, Export .docx); selects use `ui-select` and are named; Rename/Link → dialogs with `useDialogFocus`. Font list (incl. Manjari/Gayathri), formatting commands, import/export and print handlers unchanged.
  - `WritingStudioSidebar.tsx`: light panel; tabs → `ui-tabs`; uppercase labels removed; duration/hook/caption/shot-list tools restyled in place (no logic change); caption/hashtag fields labelled; snippet actions visible on keyboard focus and on touch screens; comment cards: the jump-to-text action is now a button around the quote and text (was a clickable `div` containing a Resolve button and a reply input); reply input and send button named.
  - `WritingStudioStatusBar.tsx`: light bar; save status in an always-mounted `role="status"` region with `status-*` chips; zoom select named, 44px.
  - `FindReplaceModal.tsx`, `VersionHistoryModal.tsx`: dialog semantics + `useDialogFocus`; version rows were clickable `div`s → `<button aria-pressed>`; responsive split view. Text change: "FIND" / "REPLACE WITH" → "Find" / "Replace with" (labels now tied to their inputs).
  - `WritingStudioCanvas.tsx`: canvas backdrop colour only.
- Unchanged by design: `TeleprompterModal.tsx` (byte-identical), A4 page (`.a4-page` stays white, 210mm), print stylesheet and `writing-studio-*` print classes, Malayalam fonts, TipTap editor config, script table, autosave and single-editor lock, `.docx`/`.txt` import/export, hook/duration/shot list/caption tools.
- Bug found and fixed during checks: Rename, Link and Find dialogs used `autoFocus`, so focus moved inside before `useDialogFocus` could record the opener and fell back to `<main>` on close. Now the hook focuses the field (Find uses `initialFocusRef`); focus returns to the opener.
- Live check (non-GET `/api` aborted, so the editor lock and autosave never wrote): writer1, creative_head, admin, sm_manager, executive at 1440/768/360 — 0 overflow, 0 undersized targets, 0 clickable non-controls, no purple; A4 white at 794px; Manjari/Gayathri present; print media hides header/ribbon/status bar and keeps A4 white; all 5 dialogs pass focus-in, Tab trap, Escape, focus-return; Teleprompter opens and closes with Escape. An editable state was served in the browser only to reach the fallback-link dialog.
- Remaining gaps / VERIFY:
  - Links inside the document still render with the editor's `text-indigo-600` class (`WritingStudioCanvas.tsx:82`). Left unchanged: it is part of the editor output saved into document HTML.
  - The Teleprompter keeps its own dark styling and small controls (left unchanged as instructed).

## Root-cause correction: 7 canonical revision root causes (Status: COMPLETE)

- Investigation: new writes accepted non-canonical values. Classify (`revisionClassifySchema` + service) allowed all 12 `REVISION_ROOT_CAUSES`; `request-revision` accepted any string (stored only in ActivityEvent metadata). Screens: Review Studio had its own 5 values, Work Detail its own 6, Feedback and Issues & Blockers offered all 12. `RevisionFlag.rootCause` enum keeps all 12, so legacy values remain valid on read. No migration needed or done.
- Changes:
  - `@mmp/shared`: `revisionClassifySchema.rootCause` and `submissionReviewRevisionSchema.rootCause` → `z.enum(CANONICAL_REVISION_ROOT_CAUSES)` (request-revision stays optional); added `CanonicalRevisionRootCause`, `LEGACY_REVISION_ROOT_CAUSES`, `isCanonicalRevisionRootCause`. Shared `dist/` rebuilt (gitignored).
  - API: classify service checks the canonical list; reference data `revisionRootCauses` → canonical list; media reshoot transition passes `'Technical error'` instead of `'Technical issue'` (the transition ignores it; nothing stored).
  - Web: Review Studio (`DecisionBar`), Work Detail Request Rework, Feedback Classify and Issues & Blockers Classify all render `CANONICAL_REVISION_ROOT_CAUSES` from `@mmp/shared`; local lists removed. The UI only offers Classify on unclassified flags; re-classifying a legacy flag through the API now requires a canonical value.
- Tests: added `apps/api/test/revision_root_causes_canonical.test.js` (20: canonical list, request-revision rejects 4 legacy/non-canonical values and accepts canonical, classify rejects each legacy value and accepts each canonical value, legacy re-classify needs canonical, legacy flag readable via list and dashboard and not rewritten) and `apps/web/src/pages/feedback/__tests__/RootCauseChoices.test.tsx` (6: all four screens show exactly the 7 values; legacy flags render on Feedback and Issues with GET-only requests). Updated to canonical values: `review_studio_and_workspaces.test.js` (`Creative Choice` → `Creative direction unclear`), `workspaces_ws4_journeys.test.js` (`Off brief` → `Brief unclear`), `ReviewStudio.test.tsx` (`quality` → `Brief unclear`, 2 assertions).
- Gate: typecheck 0; web build clean; API 634 + web 147 = 781 passed, 0 failed.

## UI Retheme UI-4A: Work Detail, Feedback, Review Studio (Status: COMPLETE; committed in Phase 3.5)

- Baseline: 755 (API 614 + web 141). Final gate: typecheck 0; web build clean; API 614 + web 141 = 755 passed, 0 failed. No tests added, changed or removed (no test depended on a changed class).
- Files changed (style/semantics only; no route, API, permission, workflow, timer or data change):
  - `pages/work/WorkDetailPage.tsx`: gradients/purple/indigo removed; one primary action at a time, other actions secondary (`ui-btn`, 44px); status chips use `status-*`; uppercase micro-labels → sentence-case `ui-muted`; workspace launch cards → one calm light card; tabs → `ui-tabs`/`ui-tab` with `aria-pressed`; copy/delete/close icon buttons named; **rating card is now light with an ink heading (white-heading fix)**, stars stay amber with `role="img"` + text score; all 7 modals light `glass-modal` with `role="dialog"`, `aria-labelledby` and `useDialogFocus`; 15 form labels paired with their controls; star pickers named (`N star(s)`, `aria-pressed`), tag toggles `aria-pressed`; `motion-safe` on pulse/spin.
  - `pages/feedback/FeedbackPage.tsx`: dark purple cockpit → light page header + 4 metric cards; main tabs and filters → `ui-tabs`; thread cards were clickable `div`s → `<button aria-pressed>`; flag banner/round chips → `status-*`; radio group labelled, 44px; textareas named; Classify modal → dialog semantics + `useDialogFocus`, labels paired. Text change: "ROUND n" → "Round n" (was all-caps in source).
  - `pages/feedback/PlansApprovalTab.tsx`: plan header was a clickable `div` with a nested `button` → one `<button aria-expanded>` (chevron decorative); table checkboxes named with 44px hit areas; row note inputs named; status chips `status-*`; purple removed.
  - `review-studio/ReviewStudioPage.tsx`, `ReviewStudioSidebar.tsx`, `DecisionBar.tsx`: shell, header, sidebar and decision bar moved to the light theme; indigo/purple removed; viewer switcher → `ui-tabs` with `aria-pressed` + names; queue/back buttons named; comment cards: body is a `<button aria-pressed>`, Resolve stays a separate button; versions use `aria-current`; stars 44px with `aria-pressed`; root-cause select labelled.
  - `review-studio/DocumentViewer.tsx`, `ImageViewer.tsx`, `VideoPlayerViewer.tsx`, `LinkOpenerViewer.tsx`: media stage stays dark; only indigo accents → white/neutral, `motion-safe` on hover zoom/pulse, close button named. Media, pins, timecodes, slide order, players unchanged.
- No new hard-coded colours (only Tailwind neutral/white inside the dark media stage).
- Live check (Puppeteer, all non-GET `/api` aborted; browser-only stubs for one submitted plan, one flagged thread, and one work item served as Pending): admin, creative_head, sm_manager, executive, team_member at 1440/768/360 on `/work/:id` (incl. a rated item), `/feedback` (both tabs), Review Studio — 0 overflow, 0 clickable non-controls, 0 undersized targets outside the media stage; header height unchanged (72px). Every dialog: focus in, Tab/Shift+Tab trapped, Escape closes, focus returns. Review Studio: Approve disabled until a star is chosen (mandatory rating), stars keyboard-operable, root-cause select present, version switching by keyboard (v4 → v2), 8 timecode markers render. Contrast flags only on disabled controls (exempt).
- Remaining gaps / VERIFY:
  - Root causes differ across screens (unchanged, behaviour): Review Studio DecisionBar sends 5 values (`quality`, `Creative Choice`, `Technical Flaw`, `Brief Ambiguity`, `Scope Change`); Work Detail Request Rework offers 6 others; Feedback Classify lists all 12 `REVISION_ROOT_CAUSES` while its label says "1 of 7". None match the 7 canonical causes exactly. Needs a product decision.
  - `ShootReviewView` (shared with the Shoot workspace, UI-4C) still has indigo accents and renders inside Review Studio for Shoot items.
  - Inside the dark media stage, video controls (20–28px), timeline markers (10px) and image pins (28px) are under 44px; the `<video>` element has a click handler without a keyboard equivalent. Left unchanged (dense media tools, positioned on media).
  - The Review Studio document canvas was already a dark panel (not white); left unchanged.
  - The sidebar returns to the Comments tab after switching version (pre-existing: loading unmounts it).

## Restore admin user-management actions (Status: COMPLETE; committed in Phase 3.5)

- Baseline (MongoDB running): typecheck 0; web build clean; API 591 + web 117 = 708.
- Restored in the existing flow, admin only, no new routes or backend changes:
  - `/team`: **Invite user** (`InviteUserDialog.tsx`, `POST /api/people`; name, email, role, optional job role; no password field).
  - `/team/:id`: **Change role** (two-step: choose, then confirm showing current and new role; `PATCH /api/team/:id { role }`), **Reset password** (confirm; `POST /api/team/:id/reset-password`), **Force logout** (confirm; `POST /api/team/:id/force-logout`), in `AdminAccountActions.tsx`.
  - Shown only when the viewer is `admin` and the profile is not their own. All dialogs use `useDialogFocus`, `role="dialog"`, labelled titles, 44px buttons. Errors show in the dialog (`role="alert"`) and keep it open; success shows in an always-mounted `role="status"` region.
- Backend behaviour confirmed (unchanged):
  - Invite creates the account with `mustSetPassword: true` and sends **no email**; the person sets a password via "Forgot password?" on the sign-in page. Duplicate email → 409. No email-format check on the server; missing name → 500 (UI validates both).
  - Reset password only sets `mustSetPassword: true` (no token, no email, no password returned). Sign-in is blocked until the person uses "Forgot password?". Existing sessions are **not** ended.
  - Force logout deletes all sessions (refresh stops working); an existing access token stays valid until it expires (`JWT_EXPIRES_IN`, default 15m).
  - Role change takes effect on the next request (auth reloads the user from the DB). An unknown role is rejected by the model enum but returns 500, not 400.
  - Self-service: the API allows an admin to change their own role, reset their own password and force-log-out themselves. The UI hides all of these on the admin's own profile (same rule as Suspend).
- Tests added: `apps/api/test/admin_user_management_api.test.js` (23), `apps/web/src/pages/team/__tests__/AdminUserManagement.test.tsx` (24). No existing tests changed.
- Live check (Puppeteer, our Vite on 5199, all non-GET `/api` calls aborted): `/team` and `/team/:id` at 1440 and 360 — 0 overflow, 0 targets under 44px, 0 clickable non-controls; every dialog: focus moves in, Tab/Shift+Tab stay inside, visible focus, Escape closes, focus returns to the opener; confirm with a failed request shows an error and no success. Non-admin roles (creative_head, sm_manager, executive, team_member) see none of the four actions. Only flag: the existing avatar "Edit" hover overlay (invisible until hover; unchanged).
- Final gate: typecheck 0; web build clean; API 614 + web 141 = 755 passed, 0 failed.

## UI-4A pre-checks (Status: RESOLVED, see entry above)

- Baseline: typecheck 0; web build clean; API 589 + web 117 = 706 passed.
- Admin DM privacy (API): message reads were already covered (`chat_system.test.js`, admin gets 403). Added 2 tests: admin cannot open a non-member DM's details (403/404, no channel or messages returned), and another pair's DM is not in admin's channel list. Chat behaviour unchanged. API 591 passed.
- Admin user management from `/team` (`WorkerProfilePage.tsx`):
  - Present: Suspend / Reactivate (line ~694), edit registered email (Edit Profile modal, admin on another person, line ~1609).
  - Missing in the UI: Invite user, change system role (Edit Operational Details edits job role, department and capacity only), reset password, force logout. The API still has `POST /api/people`, `PATCH /api/team/:id` (accepts `role` from admin), `POST /api/team/:id/reset-password`, `POST /api/team/:id/force-logout`.
  - Invite, role edit and reset-password UI were in `pages/admin/UsersPage.tsx`, deleted as unrouted in commit `11ed385` (2026-11-03). Force logout had no UI there either.
- Per instruction, UI-4A build not started. No UI files changed.

## Privacy check + UI Retheme UI-3C: Admin, Settings, Chat (Status: COMPLETE; committed in Phase 3.5)

### Privacy check: team member boundaries
- Before: as team_member, `GET /api/team` returned 403 (confirms the resource exists); other people's profile reads already returned 404; `GET /api/team/:other/changes` returned 403.
- Change (`apps/api/src/modules/team/routes.js`): `notFoundForWorkers` middleware in front of the directory and `/:id/changes` routes. Roles without `team.profile.view` (team_member only) get 404 `NOT_FOUND` for the directory and for another person's records; their own `:id` is unchanged. Admin, creative_head, sm_manager and executive are unchanged.
- Tests (`apps/api/test/team_profile_api.test.js`): "team_member is denied access to /api/team with 403" now expects 404 (requested behaviour change). Added: 404 on another member's changes log; 404 for every read of another profile (base, overview, work, performance, ratings, activity); creative_head still lists the directory (200).
- Live as team_member: `/team` shows "Failed to load directory · Not found", `/team/:other` shows "Profile Not Found"; no other person's name or email appears. Own profile loads (200).
- Workload: `/api/workload` returns 200 with only the requesting member (1 department, 1 member, summary from self). No teammate data exposed; behaviour unchanged.
- Gate after the check (UI-3C baseline): typecheck 0; build clean; API 589 + web 116 = 705 passed.

### UI-3C findings
- `/admin/users` only redirects to `/team` (rethemed in UI-3B); no separate Admin Users screen exists.
- `/admin/access-requests` (requires `user.approve`) → `AccessRequestsPage`. `/settings` → `SettingsPage`. `/chat`, `/chat/:channelId` → `ChatPage` with `GroupModal`, `ShareToChatModal`, `MediaCardPlayer`, `EmojiPicker`.
- Clickable non-controls found: Group modal member rows (`<div onClick>`). Converted to `<button aria-pressed>`.
- Dialogs without keyboard handling: Access Requests action modal, Group modal, Share to Chat modal, in-chat video player, chat info drawer (< xl).
- `useDialogFocus` bug (dev only): under React StrictMode a dialog that mounts already open (Group, Share to Chat) lost focus to the opener straight after opening, and focus went to `<main>` on close. Production builds do not double-mount. Fixed in the hook (see below).

### UI-3C changes
- `AccessRequestsPage.tsx`: page title scale; pending count and request status as shared chips (pending → waiting, approved → approved, rejected → changes, info needed → in-progress); filter bar as one panel; status filter as the shared tab track (buttons with `aria-pressed`, 44px); cards as `glass-card` with selection outline; decision notes as status tints; Approve / Reject as 44px shared buttons; "Request More Info" icon button named; action modal with `role="dialog"`, `aria-labelledby`, named Close and `useDialogFocus`; long emails truncate (no overflow at 360). Approve / reject / info / bulk approve logic and Admin-only gating unchanged.
- `SettingsPage.tsx`: page title scale; tab buttons keep `<button>` with `aria-pressed`, ink active pill; panels as `glass-card`; success / error banners as status tints with `role="status"` / `role="alert"`; password rules use the approved tone; buttons shared (sign-out buttons neutral secondary). Validation and actions unchanged.
- `ChatPage.tsx`: panes as `glass-card`; message area takes the card surface; other people's bubbles white with `--ui-line`; message toolbar and composer icon buttons 44px named; send button ink; "jump to latest" 44px; info tabs on the shared tab track (still `role="tab"` / `aria-selected`); archived chip and notice in the waiting tone; mention highlight ring ink; destructive menu items neutral text with icon; "Add" members 44px; info drawer uses `ui-scrim` / `ui-drawer` and `useDialogFocus`. Executive read-only notice, DM privacy, `@everyone`, group creation rules, mentions, reactions, pins and media cards unchanged. No presence or typing indicators added.
- `GroupModal.tsx`, `ShareToChatModal.tsx`: `glass-modal`, `role="dialog"`, `aria-labelledby` on the existing heading, named 44px Close, shared buttons, error as `role="alert"` tint, `useDialogFocus`. Group member rows are toggle buttons.
- `MediaCardPlayer.tsx`: decorative gradient header strip removed; Approved chip shared; "Watch" is a 44px secondary button; Unshare 44px neutral; video player dialog named with `useDialogFocus` and a 44px "Close player" button. Media is not tinted (dark backdrops behind video and images are kept on purpose).
- `EmojiPicker.tsx`: neutral palette mapped to tokens.
- `lib/useDialogFocus.ts`: a run counter skips the focus restore when a newer run has started, and the original opener is kept across the StrictMode re-run.
- Hard-coded colour: `#1e5a3c` for met password rules = the existing `.status-approved` text colour (7.1:1 on white).

### Verification
- Final gate: typecheck 0 errors; web build clean; API 589 + web 117 = 706 passed, 0 failures. Tests added: `useDialogFocus` StrictMode test (fails without the hook fix). No existing web test changed.
- Screens at 1440 / 768 / 360 for admin, executive, creative_head, sm_manager, team_member (Settings, Chat; Access Requests for admin): 0 horizontal overflow, 0 text-contrast failures, 0 interactive targets under 44px, 0 clickable non-controls.
- Access Requests with pending items: the seed has none, so the list response was stubbed in the browser only (two placeholder applicants, nothing stored). Approve, Reject and Request More Info dialogs open, are named, trap Tab, close on Escape and return focus; no overflow at 360. Confirm was never pressed.
- Chat: every non-GET API call except login was blocked during checks (8 read-marker posts per run), so no read state changed. Executive: no composer, no reactions, no New group, read-only notice shown. Team member: no New group. Group modal and info drawer pass the keyboard checks for every role that has them. No presence dots or typing text.
- Settings tabs: Enter selects, `aria-pressed` follows.
- Reduced motion leaves nothing animating. Header: `Layout.tsx` unchanged in this pass.

### Remaining / VERIFY
- VERIFY: DM privacy against live data. The seed has no DMs, so the "admin cannot read another pair's DM" check had nothing to test; chat API code was not touched.
- VERIFY: shared media cards with real data (none in the seed); covered by `ChatSuite` / `ChatSharePolish` tests.
- Access Requests checkboxes are 16px native inputs with adjacent labels (unchanged).
- For UI-4: Login / auth screens, Feedback page (dark hero), workspaces and Work Detail remain on the old palette.

## UI-3 fixes + UI Retheme UI-3B: Team and reporting (Status: COMPLETE)

### Fix 1: executive read-only Issues screen
- Route: `POST /api/blockers` (and `PATCH /:id/resolve`, `POST /:id/notify`) require `work.request` or `work.update.own` (`apps/api/src/modules/blockers/routes.js:10-13`). Executive holds neither; admin, creative_head, sm_manager and team_member hold at least one. The API already returned 403 for executive, so no backend change was needed.
- UI (`IssuesBlockersPage.tsx`): "Report Deliverable Blocker" and its modal, "Ping Owner", and "Resolve & Unblock" and its modal now render only when the user holds one of those two permissions (same check as the API). No other role changes.
- Tests: `apps/api/test/executive_role.test.js` + 2 (executive gets 403 on resolve and notify; create was already covered). New `apps/web/src/pages/issues/__tests__/IssuesExecutiveReadOnly.test.tsx` (2): executive sees none of the three actions; team_member still sees all three. Permissions come from the real `ROLE_PERMISSIONS`.
- Live: executive at 1440 and 360 sees no blocker actions; `POST /api/blockers` as executive → 403; admin still sees the report button.

### Fix 2: remaining modal keyboard handling
- `useDialogFocus` + `role="dialog"`, `aria-modal`, `aria-labelledby` on My Work "Mark blocked" and "Submit" modals and Tracker "Assign" and "Change date" modals.
- Found and fixed (pre-existing): Tracker row action buttons did not stop the click reaching the row, so Assign / Change date also opened the timeline dialog on top. The Actions cell now stops propagation (`TrackerTab.tsx`, Actions `<td>`).
- Live (1440 and 360): focus moves to Close, dialog named, Tab / Shift+Tab stay inside, Escape closes, focus returns to the opener for all four. My Work modals were opened against a client-side copy of the queue with one item marked In Progress (nothing saved).
- Gate after the fixes (UI-3B baseline): typecheck 0; build clean; API 586 + web 116 = 702 passed.

### UI-3B findings
- Routes: `/team` → `TeamDirectoryPage`; `/team/:id` and `/profile` → `WorkerProfilePage` (My Profile is the self view); `/workload` → `TeamWorkloadPage`; `/reports` → `ReportsPage`. All use `ProtectedRoute`; access is enforced by the API (team_member gets a permission error on Team Directory and a self-scoped Workload, unchanged).
- Not reachable from any route (left unchanged): `ProfilePage.tsx`, `ProfileView.tsx`, `ProfileDrawer.tsx`, `RatingsFeedbackSection.tsx`, `PersonWorkPage.tsx`.
- Recharts is used only in `WorkerProfilePage` (two single-series bar charts).
- Workload band colours were duplicated in Workload, Team Directory, Worker Profile and the Dashboard workload section (emerald / amber / rose).
- Existing "Load (Highest first)" sort on Team Directory is a capacity sort, not performance; unchanged.

### UI-3B changes
- `index.css`: `.band-healthy` (blue), `.band-high` (neutral ink), `.band-overloaded` (coral) with `.band-chip`, `.band-tint`, `.band-bar`. Text 7.5 / 10.2 / 6.6:1.
- `lib/statusTone.ts`: `bandClass()`, `bandForPct()` (same thresholds; real percentages passed in, only bar widths are capped as before).
- `TeamWorkloadPage.tsx`: page title; overload alert in the coral band tint; one KPI card where Healthy / High / Overloaded are pressed filter buttons with the band label and icon; 44px department toggles; member name and expanded work rows are buttons; band chips and bars; recommendation modal with `useDialogFocus`.
- `TeamDirectoryPage.tsx`: page title; filter panel; 44px status toggles; cards as `glass-card`; name is a link; band chips and bars; count chips use status tones.
- `WorkerProfilePage.tsx` (`/team/:id`, `/profile`): header panel; avatar is a button only when self/admin; status, verified and notice chips use shared tones; one KPI card; shared tabs and range select; charts use `--ui-blue`, muted axes, `--ui-line` grid and direct value labels; Reassign, Edit Operational Details and Edit Profile modals with `useDialogFocus`; 3-rating minimum, redaction and action gates untouched.
- `ReportsPage.tsx`: page title (decorative gradient removed); shared tabs; report and rule cards; rule toggle is a named 44px `role="switch"` with `aria-checked`; status chips; viewer panels and table; preview and rule-details modals with `useDialogFocus`.
- `TeamDashboardPage.tsx`: workload band summary and member bars use the shared band classes (shared consistency).

### Verification
- Final gate: typecheck 0 errors; web build clean; API 586 + web 116 = 702 passed, 0 failures. No existing test changed.
- Screens at 1440 / 768 / 360 for admin, executive, creative_head, sm_manager, team_member: 0 horizontal overflow, 0 text-contrast failures, 0 interactive targets under 44px, 0 clickable non-controls.
- Privacy and access: executive sees no email/WhatsApp, the "Contact details restricted" note, and no profile actions; creative_head sees Reassign + Edit Operational Details; sm_manager sees Reassign; admin sees all four. Team member boundaries unchanged.
- Keyboard: band filter (Enter toggles), member drawer, recommendation, rule details, Edit Profile, Reassign and Edit Operational Details dialogs all move focus in, trap Tab, close on Escape and return focus. Reduced motion leaves nothing animating.
- Header: `Layout.tsx` unchanged in this pass.

### Remaining
- Avatar initials still use their per-person gradient (existing identity colours).
- Rating stars remain amber (rating glyph).

## UI Retheme UI-3A: Work and planning (Status: COMPLETE; committed in Phase 3.5)

Visual and accessibility only. No route, API, data, permission or label-text changes.

### Baseline (clean, before any edit)
- Typecheck 0 errors; web build clean; API 584 + web 114 = 698 passed.

### Findings
- Routes `/my-work`, `/calendar` (Plans, Tracker tabs), `/issues`, `/notifications` all use `ProtectedRoute` with no role list; role gating is inside the pages (e.g. `PlansTab.tsx:198-201`, `TrackerTab.tsx:81`). `PlansApprovalTab` lives under `/feedback` and is not in this batch.
- Calendar is custom markup; FullCalendar is not installed.
- Before: 227 purple/indigo/violet uses, 1 gradient hero (`IssuesBlockersPage.tsx:334`), 42 decorative `uppercase`, 88 `text-slate-400`, 45 `text-slate-500` (4.36:1 on the card, fails AA), 44 native controls without shared classes, two one-off plan colour maps (`PlansTab.tsx:171,179`), and clickable non-controls (`MyWorkPage.tsx:518` h3, `PlansTab.tsx:1234` row div, `TrackerTab.tsx:475` tr, `IssuesBlockersPage.tsx:510,621` h3).
- No test asserts classes on these screens.
- Pre-existing, unchanged: executive sees "Report Deliverable Blocker" on `/issues` (never gated, same in HEAD). Flagged for a decision; access rules were not changed.

### Changes
- `MyWorkPage.tsx`: page title on the canvas; six KPI tiles → one card with hairline dividers; filter chips → shared tabs (`aria-pressed`); search → `ui-input` with a name and a 44px clear button; cards lose tinted borders/backgrounds (overdue = thin coral outline); priority, status, "waiting", rework and blocked use shared tones; card actions → `ui-btn` (44px); open-detail and copy-link → named icon buttons; title is now a button inside the heading; modals use shared buttons, scrim and close button; upload progress uses `ui-blue`.
- `PlansTab.tsx`: header → frosted panel; plan list → card with dividers, rows are buttons (`aria-pressed`); `STATUS_BADGES` / `ROW_STATUS_BADGES` now hold shared tones (labels unchanged); calendar tags use `.cal-*` dots; Approve All / New Plan / Submit → primary, Request Changes / Rework → coral tint, others secondary; icon buttons named; four modals → `glass-modal`.
- `TrackerTab.tsx`: filter area → frosted panel; quick filters → 44px pressed toggles; table in a card; topic is a button that opens the timeline (row click kept for the mouse); timeline modal uses `useDialogFocus`; locked stage cells no longer use `opacity-60` (fixed the contrast failure); row actions → shared buttons; owner, topic and "Skip step" hit areas raised to 44px without growing rows.
- `IssuesBlockersPage.tsx`: gradient hero → page title + one KPI card (coral icons for blocker counts); toolbar → panel with shared tabs, select and search; cards → `glass-card`; clickable titles → buttons in headings; actions and modals → shared buttons and surfaces.
- `NotificationsPage.tsx`: page title; tabs → shared tabs; search named; list → card with dividers; unread = blue dot + screen-reader "Unread:" + bolder title (was background only); named 44px icon actions; titles wrap on mobile with the time below.
- All five files: purple/indigo → ink/neutral by meaning; `text-slate-400/500` → `ui-muted`; decorative uppercase removed (weekday headers kept); native controls → `ui-select` / `ui-input`; scrims → `ui-scrim`.
- `index.css`: `.ui-textarea` (multi-line variant of `.ui-input`); `animate-ping` added to the reduced-motion rule.

### Verification
- Final gate: typecheck 0 errors; web build clean; API 584 + web 114 = 698 passed, 0 failures. No tests changed.
- Screenshots of every batch screen at 1440 / 768 / 360 as admin, executive, creative_head, sm_manager and team_member: 0 horizontal overflow.
- Live audit (admin, executive, team_member; 1440 and 360): 0 text-contrast failures; 0 interactive targets under 44px; reduced motion leaves nothing animating.
- Keyboard: My Work title (Enter opens the item) and tabs (Space toggles); plan row (Enter selects); Tracker topic opens the timeline with focus inside, Tab trapped, Escape closes, focus returns; Issues and Notifications tabs.
- Role gates: the number of permission/role conditions per file is identical to HEAD and no diff line touches one. Executive: no plan create/upload actions, no Tracker Actions column.
- Header identical to the pre-change capture apart from the notification count (data) and avatar image resampling.

### Remaining for UI-3B / UI-3C / later
- `PlansApprovalTab` (`/feedback`) and `FeedbackPage` are outside 3A.
- My Work and Tracker modals other than the timeline do not yet move focus or close on Escape.
- Tracker remains a wide table that scrolls inside its card on mobile.

## Accessibility fixes before UI-3 (M1–M5) (Status: COMPLETE; committed in Phase 3.5)

From the pre-UI-3 review. Visual and accessibility changes only; no copy, route, API, data or RBAC changes.

### Baseline
- The baseline run started for this pass overlapped the edits (its web run already included the new test file), so it is not a clean pre-edit baseline. The last clean baseline on unchanged code is the Dashboard + Calendar pass: API 584 + web 109 = 693.

### Changes
- **New:** `apps/web/src/lib/useDialogFocus.ts`. Moves focus into a dialog on open, closes on Escape, keeps Tab / Shift+Tab inside, returns focus to the opener on close, or to `<main>` if the opener no longer exists. No dependency.
- **M1** `CalendarPage.tsx`: month chips, week cards and list cards are now `<button type="button">` (previously clickable `div`s). Inner `div`/`h4` became `span`s with the same classes (a button may only contain phrasing content). No nested interactive elements existed. Visible ink focus ring added.
- **M2** `CalendarPage.tsx`: preview modal uses the hook; initial focus on Close.
- **M3** `PersonWorkHistoryDrawer.tsx`: `role="dialog"`, `aria-modal`, `aria-labelledby` (heading id via `useId`), and the hook; initial focus on Close.
- **M4** `TeamDashboardPage.tsx`: "Today's priorities" rows are `<button type="button">` with the same navigation. The `h4` / `div` / `p` inside became `span`s. No nested interactive elements existed.
- **M5** `Layout.tsx`: sidebar padding `px-3.5` → `px-[13px]`. Nav links now 44×44; rail width (72px), breakpoints, items and behaviour unchanged.

### Tests
- Added `apps/web/src/lib/__tests__/useDialogFocus.test.tsx` (5 tests): initial focus, Escape, Tab / Shift+Tab trapping and focus pulled back in, focus restored to the opener, fallback to `<main>` when the opener is gone. No existing test changed.

### Verification
- Typecheck 0 errors; web build clean; API 584 + web 114 = 698 passed, 0 failures.
- Live, as admin and executive, at 1440 and 360: calendar item reachable by Tab and opened with Enter; focus lands on Close; Tab and Shift+Tab stay in the dialog; Escape closes; focus returns to the item. Same for the Tracker work-history drawer (returns to the owner button). "Today's priorities" row reachable by Tab, Enter opens `/work/<id>`. Sidebar links 44×44, rail 72px. 0 horizontal overflow. Executive: 0 action buttons on Dashboard and Calendar. Header identical to the previous capture.
- Executive access: calendar items, the preview modal, Tracker owner buttons / drawer and priority rows were all already available to executive (navigation or read-only views); none are actions.

## UI Retheme corrections: Dashboard + Calendar (Status: COMPLETE; committed in Phase 3.5)

Rollback point before this pass: commit `642a5df` (UI-1 + UI-2).

### Findings
- One dashboard component (`pages/dashboard/TeamDashboardPage.tsx`) serves admin, creative_head, sm_manager and executive; team_member is redirected to My Work. All fixes apply to every leadership role.
- `GlobalFilterBar` is used only on the Dashboard (not Calendar or Tracker).
- The executive test (`DashboardRoleViews.test.tsx:310`) expects the word "Executive" on the dashboard, and the hero role chip is the only place it appears there, so the role chip was kept (restyled with the shared `.role-badge`), not removed.
- Calendar identity colours live in `@mmp/shared` `CALENDARS`, which the API also uses; left untouched. The UI now uses `.cal-*` dot classes instead.

### Changes
- `TeamDashboardPage.tsx`: purple hero → plain page title on the canvas (role badge, 28–32px ink title, 15px muted line, ink "New Deliverable" + outlined "Calendar & Plans"; same permission gate). Filters, month plan status and KPIs in one `.glass-panel`; month plan status in a `.glass-card`; 7 KPI cards → one card with a hairline-divided stat strip (2 / 4 / 7 columns, Overdue spans the leftover cells), stats are now keyboard-reachable buttons. Approval queue in a `.glass-panel` with two `.glass-card`s and an ink "Open Approvals Console". Other sections moved to panels. All "Section N •" prefixes removed; uppercase tracking labels → sentence case; purple → ink / ui-text; progress bars → `ui-blue` on `ui-line`; plan-status colour map replaced by shared status tones; overdue and blocked use coral tones. Overdue KPI no longer pulses.
- `CalendarPage.tsx`: plain page title; one control panel (row 1: `ui-tabs` view tabs + calendar selector; row 2 on the Month tab: circular prev/next, Today, month title, three `ui-select` filters with labels, Month/Week/List `ui-tabs`); month grid in its own panel with `bg-ui-card` day cells, a 1.5px ink ring for today and an ink date dot; event chips `bg-ui-blue-soft`; neutral calendar tags with dots; preview modal uses shared buttons, icon button and chips. "Calendar:" / "Viewing:" colons removed.
- `GlobalFilterBar.tsx`: no own surface (sits in the panel); "Universal Filters" pill removed; the active-filter count now shows on the Reset button.
- `index.css`: `.ui-tab` raised to 44px (touch target; nothing used it before); `.cal-dot` + `.cal-<key>` (ink, blue, coral, grey, hollow ring for Other).

### Verification
- Typecheck 0 errors; web build clean; API 584 + web 109 = 693 passed, 0 failures. No tests changed.
- Screens: Dashboard, Calendar, Tracker at 1440 / 768 / 360 as admin and as executive. 0px horizontal overflow on all 18.
- Executive: no "New Deliverable", "Add individual work" or "Open Approvals Console" anywhere. Admin sees all three.
- Dashboard title block at 360px ends at 37% of the first screen.
- Header identical to the UI-2 capture apart from the notification count, which changed in the data (2 → 1).

### Remaining gaps
- `TrackerTab.tsx` and `PlansTab.tsx` internals (uppercase labels, purple accents, native selects) were out of scope.
- Capacity-band colours on the dashboard workload section are still emerald / amber / rose.

## UI Retheme UI-2: Shared Components (Status: COMPLETE; approved, UI-3 built on it)

Decisions applied: Plus Jakarta Sans for page content (header, its flyouts and the sidebar keep the system font); sidebar recoloured only; one shared CSS class set for statuses and roles (no new React component).

### Gate
- Before (04 November 2026): typecheck 0 errors; web build clean; API 584 passed (35 files); web 109 passed (16 files). Baseline 693.
- After: typecheck 0 errors; web build clean (same pre-existing chunk-size warning); API 584 passed; web 109 passed. 693, 0 failures. No tests changed.

### Root findings
1. **Font:** Plus Jakarta Sans is loaded by the Google Fonts link in `apps/web/index.html:13` (weights 300–800) but never applied: `font-sans` on `<body>` resolved to Tailwind's default stack. Fixed by setting `fontFamily.sans` in `tailwind.config.js`; `.shell-scope` pins the old stack on `<header>` and `<aside>` in `Layout.tsx`.
2. **No portals.** No `createPortal` in the app; modals, drawers, toasts and popovers render in place, so they inherit the body font. The search modal and toasts sit outside `<header>` and use Plus Jakarta Sans; header flyouts sit inside it and do not.
3. **UI-1 regression found and fixed:** `.glass-modal` used `rgba(var(--ui-card-hover-rgb), 0.94)`, which is invalid with space-separated channels, so every `.glass-modal` was transparent. Now `rgb(var(...) / 0.94)`.
4. **Status colour maps (8 sites, conflicting colours: "In Progress" was blue in some places and green in others):** `CalendarPage.tsx:56` `STATUS_COLORS`, `TrackerTab.tsx:78` `STAGE_STATUS_COLORS`, `PipelineStepper.tsx:53-86`, `WorkDetailPage.tsx:~617`, `MyWorkPage.tsx:~487`, `WorkListPage.tsx:~275` and `~320`, `WorkerProfilePage.tsx:~966`, `PersonWorkHistoryView.tsx:~113`, `WritingStudioPage.tsx:~591`, `TeamDashboardPage.tsx:~695`. All now use `.status-chip/.status-tint/.status-dot` + `.status-<tone>`.
5. **Role colour maps:** one map, `ProfileView.tsx:386` `getBadgeStyle`; role chips also at `TeamDirectoryPage.tsx:355` (all grey) and `WorkerProfilePage.tsx:611` (all black). All three now use `.role-badge .role-<role>`.
6. **Not step statuses (left alone):** plan statuses (`PlansTab.tsx:171,179`, `TeamDashboardPage.tsx:231`), review-round badge (`FeedbackPage.tsx:692`), clip statuses (`ClipCard.tsx:138`), capacity bands, account Active/Suspended.
7. **PipelineStepper** is rendered only on Work Detail (`WorkDetailPage.tsx:679`), reached from My Work. UI.md says My Work cards include it; they do not.
8. **Shared controls:** there are still no Button/Tabs/Input/Select/Table components. UI-2 adds the class set and applies it in shared components; page call sites move in UI-3/UI-4.
9. **Overflow from the font change:** Calendar tab row +9px at 360px (fixed: `overflow-x-auto`). Issues page already overflowed 84px at 360px before this work (+13px with the new font); fixed by letting its filter row wrap.
10. **Pre-existing, not fixed (UI-4):** `WorkDetailPage.tsx:1100` rating block puts `bg-gradient-to-br … text-white` beside `.glass-card`; the `.glass-card` `background` shorthand has always cancelled the gradient, so the heading is white on a light card.

### Changes
- `index.css`: `.shell-scope`; content focus ring (`main`, dialogs); `.ui-btn/-primary/-secondary`, `.ui-icon-btn` (44px), `.ui-tabs/.ui-tab`, `.ui-input/.ui-select` (in `@layer components` so utilities can adjust them); `.ui-table`; 8 status tones + `.status-chip/.status-tint/.status-dot`; 5 role tones + `.role-badge`; `.ui-avatar` (header keeps its old 1px ring); `.ui-drawer`, `.ui-scrim`; reduced-motion stops `animate-pulse`/`animate-bounce` and control transitions.
- `tailwind.config.js`: `fontFamily.sans`.
- `lib/statusTone.ts` (new): maps raw status/role to a tone class name. No colours.
- `Layout.tsx`: `shell-scope` on header and sidebar; sidebar surface → frosted panel, ink active pill, `ui-muted` items, ink focus ring, coral badge, `ui-line` divider. Width, breakpoints, items and behaviour unchanged. Search modal: scrim, pill input, neutral hover.
- `PipelineStepper.tsx`: rebuilt as stage cards joined by thin connectors with nodes (blue = completed hand-off, coral dashed = changes requested/blocked, grey = not reached). Ink = current stage. Icons plus screen-reader text for every state. Navigable stages are now `<button>`s (same navigation). Equal-width grid from md up, scrolling inside the panel when there are many stages; vertical spine below md.
- `GlobalFilterBar.tsx`, `ProfileDrawer.tsx`, `PersonWorkHistoryDrawer.tsx`, `AvatarCropModal.tsx`, `Avatar.tsx`: shared surfaces and controls.
- Status call sites listed above; role call sites listed above; `ui-table` on all 7 `<table>`s.

### Verification
- Screens: Dashboard, My Work, Work Detail (pipeline), Calendar, Team, search modal, Add-work modal at 1440/768/360; pipeline with 7 synthetic stages (changes requested, blocked, locked, long names) at all three widths. 0px horizontal overflow on all, and on 14 routes at 360px.
- Header band identical to the pre-UI-2 capture (max 6/255 per channel, 0 pixels over 15). Account menu and notifications flyout identical.
- Keyboard focus visible on sidebar items, modal inputs and results, pipeline stages, buttons and selects. Reduced motion confirmed (`animate-pulse` → `none`).
- Status and role chip contrast: 5.7:1 to 19.7:1.
- Note: a dev server started before this change keeps the old Tailwind config cached. Restart `npm run dev` to see the new font.

### Remaining for UI-3 / UI-4
- Page-level buttons, tabs, inputs and selects still use inline purple and indigo styles (dashboard hero, Calendar tabs, "Open Writing Studio", etc.).
- Recharts colours, KPI strip, eyebrow labels, Dashboard panel grouping, My Work card borders by status.
- Workspaces (Writing Studio, Review Studio, media) apart from the Writing Studio status chip.

## UI Retheme UI-1: Foundation (Status: COMPLETE; approved, UI-2 built on it)

Visual-only. Reference: cool grey-blue canvas, frosted panels, near-white cards, near-black active states.

### Precondition gate (04 November 2026, before any edit)
- `npm install` clean; `npm run typecheck` 0 errors; `npm run build --workspace=@mmp/web` clean.
- `@mmp/api` 584 passed (35 files); `@mmp/web` 109 passed (16 files). Total 693, 0 failures.

### Findings that differ from UI.md (VERIFY items resolved)
1. **Plus Jakarta Sans is not rendering.** `index.html` puts Tailwind `font-sans` on `<body>`; Tailwind's default `font-sans` is the system stack and, as a utility, overrides the `@layer base` body rule. Computed font on every screen: `ui-sans-serif, system-ui, …` (Segoe UI on Windows). Not changed in UI-1; needs a decision because the fix also changes header typography.
2. **FullCalendar is not a dependency.** The calendar month grid is custom markup in `CalendarPage.tsx`. UI.md §3.3 is wrong.
3. **Recharts** is used only in `pages/team/WorkerProfilePage.tsx`.
4. **Status colours are not in `@mmp/shared`.** The shared package maps labels only; colours are duplicated per page (`CalendarPage.tsx:56` `STATUS_COLORS`, `TrackerTab.tsx:78` `STAGE_STATUS_COLORS`, `ClipCard.tsx:138`, `PipelineStepper.tsx:53-86`, `TeamDashboardPage.tsx:231`). Role badges: `ProfileView.tsx:386`.
5. **No shared Button, Tabs, Input, Select, Modal, Table, StatusChip, RoleBadge or KPI component exists.** All inline Tailwind. Shared components that do exist: `Avatar`, `PipelineStepper`, `GlobalFilterBar` (used only by `TeamDashboardPage`).
6. **No app footer exists.** The only `<footer>` is the Writing Studio status bar (`WritingStudioStatusBar.tsx:37`, opaque, unchanged). No `.shell-footer` was created.
7. UI.md §1.2 glass values did not match code (panel 0.75 vs 0.7, card 0.82/20-24px vs 0.78/18px, modal 0.95 vs 0.88, pill track slate vs white).
8. `.glass-*` rules are unlayered and come after `@tailwind utilities`, so they override same-specificity utilities beside them (`glass-card rounded-2xl` renders at the glass radius). Precedence kept to limit churn.
9. Accent debt for UI-2–4: ~1,215 purple/indigo/violet utility uses and 116 hard-coded `#7a6af6`.

### Changes
- `apps/web/src/index.css`: `:root` tokens (`--ui-*`, radii, shadows, `--shell-surface`); flat canvas on `body`; `.shell-header`, `.shell-sidebar`, `.shell-popover`, `.shell-menu` hold the old shell look (opaque `#F8F9FF` measured from the old rendered pills); `.glass-panel/.glass-card/.glass-modal/.glass-pill-container/.pill-active` restyled in place; card hover is colour-only and only on clickable cards (no lift); reduced-motion guard.
- `apps/web/tailwind.config.js`: `ui-*` colours (alpha-capable), `rounded-ui-panel/card/control`, `shadow-ui-panel/card/modal`.
- `apps/web/index.html`: removed `bg-slate-50` from `<body>` (it overrode the canvas colour).
- `components/Layout.tsx`: header pills and hanging tab `glass-panel` → `shell-header`; tab corner fills → `var(--shell-surface)`; sidebar → `shell-sidebar`. Class names only.
- `components/NotificationCenter.tsx` → `shell-popover`; `components/UserMenuDropdown.tsx` → `shell-menu` (header flyouts frozen).
- `components/NotificationToast.tsx`, `pages/chat/EmojiPicker.tsx`: `glass-panel` → `glass-modal` (overlays need the opaque top-layer surface to stay legible).
- Removed element: the white 1px outline on every `.glass-card` (now transparent, same box size).

### Verification
- Typecheck 0 errors; web build clean; API 584 passed, web 109 passed (693, 0 failures). No tests changed.
- Header pixel check vs baseline at 1440/768/360 on Dashboard, Calendar, Reports, Team: surfaces within 2 RGB units, text and icons identical. Zero horizontal overflow at all 12 captures.
- Contrast: `--ui-muted` 5.7:1 on card, 4.8:1 on canvas; `--ui-blue` 2.4:1 and `--ui-coral` 3.1:1 on card, so not for text.

### Remaining gaps (expected, later phases)
- Page sections that use inline `bg-white` instead of `.glass-card` (most of Dashboard) are still white; calendar day cells are white inside near-white cards. UI-3.
- Purple primary buttons, eyebrow labels and decorative "Section 1 •" numbering remain. UI-2/UI-3.

## Phase PE: Profile Edit, Mobile OTP Verification & Mandatory Welcome Step Removal (Status: COMPLETE)

### Precondition & Final Verification Counts (Verified 03 November 2026)
- **Database Baseline:** 13 canonical users verified in MongoDB.
- **`npm install`:** Clean install, strictly 0 new npm dependencies.
- **`npm run typecheck`:** PASSED cleanly (**0 TypeScript errors** across `@mmp/shared`, `@mmp/api`, and `@mmp/web`).
- **`npm run build`:** PASSED cleanly across all workspaces:
  - `@mmp/shared`: Built cleanly.
  - `@mmp/web`: Vite production bundle generated cleanly in 12.93s.
- **Test Suite Results:**
  - `@mmp/api`: **583 tests passed across 35 test files (100% green)**, including all 9 tests in `apps/api/test/phone_otp_profile.test.js`, 34 tests in `apps/api/test/profile_and_settings.test.js`, and 16 tests in `apps/api/test/team_profile_api.test.js`.
  - `@mmp/web`: **109 tests passed across 16 test files (100% green)**.
  - Total: **692 tests passing, 0 failures**.

### Key Deliverables & Changes Completed
1. **Mandatory Welcome Setup Gate Removed:**
   - Deleted the onboarding blocker in `RootRedirect` (`apps/web/src/App.tsx`) that formerly forced uncompleted profiles to `/welcome`. Authenticated users now transition directly into their home/workspace (`/my-work` or `/dashboard`).
   - Route `/welcome` redirects to `/profile`.
2. **Official Email Security (Admin-Only Modification):**
   - Registered email address is strictly locked against modification by non-admin users.
   - User profile update schema (`profileUpdateSchema` in `@mmp/shared`) excludes `email` to block unauthorized payload attempts.
   - Profile UI displays a clear 🔒 lock badge and notice explaining that official email changes require Administrator intervention.
   - Administrators retain the capability to adjust user emails via `PATCH /api/team/:id`.
3. **SMS OTP Service for Mobile Phone Verification:**
   - Dedicated `PhoneVerification` model (`apps/api/src/modules/profile/phoneVerification.model.js`) storing cryptographically secure 6-digit OTPs with 10-minute expiry and rate-limiting safeguards.
   - Added `POST /api/me/phone-otp/send` and `POST /api/me/phone-otp/verify` endpoints.
   - When a user modifies their mobile number, an OTP verification token (`phoneVerificationToken`) is required before `PATCH /api/me/profile` allows the update.
   - Updated `Person` schema to record `phoneVerified` and `phoneVerifiedAt`.
4. **Standard, High-Quality Profile UI:**
   - Prominent "Edit Profile" action for self-view and administrators on `/profile` and `/team/:id`.
   - Comprehensive Edit Profile modal featuring:
     - Avatar crop trigger integration (`AvatarCropModal`).
     - Full legal name and preferred name / nickname inputs.
     - Official locked email field with security notice.
     - Mobile phone input with integrated OTP request, 6-digit verification code field, feedback alerts, and countdown resend timer.
     - WhatsApp number with "Same as mobile number" sync checkbox.
     - Bio / About textarea with dynamic 500-character counter.
     - Interactive chip managers for Languages (max 5) and Skills (max 10).
     - Verified phone badge and official email indicators in profile header cards.

---

## Phase TP: Team Directory and Worker Profile (Status: COMPLETE)

### Precondition & Final Verification Counts (Verified 03 November 2026)
- **Database Seed:** Verified clean re-seed with 13 canonical users; all 13 canonical credentials authenticated via bcrypt.
- **`npm install`:** Clean install, strictly zero new npm dependencies.
- **`npm run typecheck`:** PASSED cleanly (**0 TypeScript errors** across `@mmp/shared`, `@mmp/api`, and `@mmp/web`).
- **`npm run build`:** PASSED cleanly across all workspaces:
  - `@mmp/shared`: tsup ESM/CJS/DTS build success.
  - `@mmp/web`: Vite production bundle generated cleanly (built in 17.00s).
- **Final Test Counts:** **683 tests passed across 50 test files (100% green, 0 failures)**:
  - `@mmp/api`: **574 tests passed across 34 test files** (including 16 tests in `apps/api/test/team_profile_api.test.js`).
  - `@mmp/web`: **109 tests passed across 16 test files** (including 4 tests in `apps/web/src/pages/team/__tests__/TeamProfileSuite.test.tsx`).
  - Monorepo Total: **683 passed tests, 0 failures (100% green)**.

### Architecture & Key Deliverables Completed (Phase TP)
1. **Team Directory (`/team`):**
   - Mounted at `/team` and added to main navigation for `admin`, `creative_head`, `sm_manager`, and `executive`.
   - Comprehensive directory list displaying avatar, name (preferred name first), role, job role, department, status, load % & band, 'Now' deliverable indicator, and active counts (in progress, waiting for approval, late).
   - Filter bar: search, role, department, status, load band, and has late work only toggle.
   - **Strict Whitelist Sorting:** Limited strictly to `name`, `department`, `jobRole`, `load`. Strictly zero ranking/sort on performance, speed, or ratings.
2. **Polymorphic Worker Profile (`/team/:id` and `/profile`):**
   - Unified component displaying member profile to leadership at `/team/:id` and to the worker themselves at `/profile`.
   - **Worker Transparency Notice:** Prominently alerts workers on self-view: *"Your work history, timings and ratings are visible to the Admin, Creative Head, SM Manager and Executive."*
   - **Anti-Harvesting Isolation:** `team_member` attempting to access `/team/:otherId` receives **HTTP 404 Not Found**.
   - **Executive Privacy Redaction:** Contact details (`email`, `phone`, `whatsappNumber`) are stripped/null for `executive` viewers.
   - **KPI Strip & 3-Rating Threshold:** Displays load & band, in progress, waiting, late, on-time rate, and average rating. Average rating is **strictly hidden until $\ge 3$ ratings exist**, displaying a confidentiality notice otherwise.
   - **Global Date Range Control:** Presets for 7d, 30d, 90d, this month, last month.
3. **Six Profile Tabs:**
   - **Overview:** Right Now active deliverables with live elapsed work time, Next Up queued deliverables with due dates, 8-Week load trend chart (`recharts`), work breakdown by step type & calendar, skills & preferences, plus operational summary for non-worker roles.
   - **Work:** Filterable assigned deliverable steps with expandable timeline traces (`assignedAt`, `unlockedAt`, `startedAt`, `submittedAt`, `decisionAt`, `approvedAt`, `postedAt`), revision rounds, and paused interval logs.
   - **Performance:** Individual craftsmanship metrics (on-time rate, average days late, first-pass approval rate, revision rate, average work time by step type, waiting to start, approval wait, blockers raised count & duration), monthly output trend chart, and previous period comparison deltas. Anti-ranking guarantee notice.
   - **Ratings:** Feedback summary, star score distribution, and constructive review feedback comments ($\ge 3$ threshold enforced).
   - **Activity:** Person's domain operational events feed (assignments, starts, submissions, decisions, step comments; strictly zero chat content or stats).
   - **Changes:** Audit log of modifications to `jobRole`, `departmentId`, `workPreferences`, and `weeklyCapacityHours` (who, when, old, new). Visible **only to `admin` and `creative_head`**.
4. **Role Action Modals:**
   - Reassign Steps modal (`admin`, `creative_head`, `sm_manager`).
   - Edit Operational Details modal (`admin`, `creative_head`).
   - Administrative controls: Suspend/Reactivate, Reset password, Force logout (`admin` only). Executive has zero mutation buttons.
5. **Specification Documentation:**
   - [`docs/TEAM_PROFILE.md`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/TEAM_PROFILE.md) authored as single source of truth for Team Directory and Worker Profile.
   - [`docs/METRICS.md`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/METRICS.md) updated with 8-week load trend formula.

---

## Phase IT1: Individual Tracking and Timing from Each Worker's Start (Status: COMPLETE)

### Precondition & Final Verification Counts (Verified 02 November 2026)
- **`npm install`:** Clean install, strictly zero new npm dependencies.
- **`npm run typecheck`:** PASSED cleanly (**0 TypeScript errors** across `@mmp/shared`, `@mmp/api`, and `@mmp/web`).
- **`npm run build`:** PASSED cleanly across all workspaces:
  - `@mmp/shared`: tsup ESM/CJS/DTS build success.
  - `@mmp/web`: Vite production bundle generated cleanly (built in 24.58s).
- **Final Test Counts:** **663 passed tests, 0 failed across 48 test files**:
  - `@mmp/api`: **558 passed tests across 33 test files** (including 8 tests in `apps/api/test/individual_tracking_and_timing.test.js`).
  - `@mmp/web`: **105 passed tests across 15 test files** (including `apps/web/src/pages/work/WorkerIndividualTiming.test.tsx`).
  - Monorepo Total: **663 passed tests, 0 failures (100% green)**.

### Architecture & Key Deliverables Completed (Individual Tracking and Timing)
1. **Timestamping per Stage and Round:**
   - Work items track timestamps: `unlockedAt`, `assignedAt`, `startedAt`, `submittedAt`, `decisionAt`, `changesRequestedAt`, `resubmittedAt`, `approvedAt`, `postedAt`.
   - `intervals` log array tracking paused intervals (`blocked`, `pending`) with `{ kind, startedAt, endedAt, reason, note }`.
   - `rounds` array capturing each revision cycle `{ roundNumber, startedAt, submittedAt, decisionAt, outcome, intervals }`.
2. **Start Precondition Guard (`MUST_START_BEFORE_SUBMIT`):**
   - Workers cannot submit without starting. Submitting from `'Not Started'` without having started is rejected with HTTP 400 `MUST_START_BEFORE_SUBMIT`.
   - Transition to `'In Progress'` stamps `startedAt` and closes paused intervals.
   - Legacy records without timestamps display neutral dash (`'—'`).
3. **Shared Metrics Engine (`packages/shared` & `docs/METRICS.md`):**
   - `formatDuration(ms)` producing compact formatted strings: `'1d 4h'`, `'3h 20m'`, `'45m'`, `'0m'`, or `'—'`.
   - `calculateIndividualWorkMeasures(item, nowDate)` computing:
     - Waiting to start (`startedAt - unlockedAt`).
     - Net work time (gross round work time minus blocked and pending periods, summed across rounds).
     - Approval wait (`decisionAt - submittedAt`).
     - Late by (calendar days between submission date and step due date).
4. **Worker Screens (Removal of Shared Clocks & Countdowns):**
   - Removed shared countdown clocks, time-of-day deadlines, and derivations from publish date on worker views.
   - Workers see their step due DATE only.
   - Once started, workers see elapsed individual work time (`"Working for 2h 15m"` excluding blocked/pending time).
   - After submission, workers see their work time and approval wait.
5. **Per-Person Work View (Drawer & Full Page):**
   - Implemented `PersonWorkHistoryDrawer` and `PersonWorkHistoryView`, mounted at route `/team/members/:id/work` and drawer on Team Load and Content Flow Tracker.
   - Scoped access: elevated roles can view any member; `team_member` can only view their own history (HTTP 403 otherwise).
   - Sections: Now, Next (locked/not started with due dates), Done (last 30 with individual metrics).
   - Interactive Step Timeline modal breaking down each round, pause intervals, and timestamps.
   - Neutral summary: completion count, on-time rate, average work time by step type, average approval wait, revision count. Strictly zero performance rankings.
6. **Content Flow Tracker Timing Columns:**
   - Added Waiting, Work Time, Approval Wait, and Late by columns to Tracker.
   - Row click opens step timeline modal.
   - Worker view scoped to their own stage items.
7. **Reports & Non-Ranked Alphabetical Digest:**
   - Creative Production Report: added average waiting to start and average work time per step type.
   - Team Performance Digest: members listed strictly alphabetically with individual work metrics (zero ranking or speed-based ordering).

---

## Phase SD1: Step Deadlines in the Plan Row Form (Status: COMPLETE)

### Precondition & Final Verification Counts (Verified 02 November 2026)
- **`npm install`:** Clean install, strictly zero new npm dependencies.
- **`npm run typecheck`:** PASSED cleanly (**0 TypeScript errors** across `@mmp/shared`, `@mmp/api`, and `@mmp/web`).
- **`npm run build`:** PASSED cleanly across all workspaces:
  - `@mmp/shared`: tsup ESM/CJS/DTS build success.
  - `@mmp/web`: Vite production bundle generated cleanly (built in 18.33s).
- **Final Test Counts:** **654 passed tests, 0 failed across 46 test files**:
  - `@mmp/api`: **550 passed tests across 32 test files** (including 9 tests in `apps/api/test/step_deadlines_plan_form.test.js`).
  - `@mmp/web`: **104 passed tests across 14 test files** (including 6 tests in `apps/web/src/pages/calendar/CalendarTabs.test.tsx`).
  - Monorepo Total: **654 passed tests, 0 failures (100% green)**.

### Architecture & Key Deliverables Completed (Step Deadlines in the Plan Row Form)
1. **Dynamic Main Date Label & Pipeline Selection:**
   - Main date label dynamically displays **"Publish date"** for deliverables that go live (`Reel`, `Static Post`, `Carousel Post`, `Story`) and **"Needed-by date"** for internal design types (`Flyer`, `Poster`, `Brochure`, `Banner`, `Document`, `Merchandise`).
   - Retained optional `postingTime` ("Publish time") input field.
2. **Dynamic Steps Section & Pipeline Variants:**
   - Reels include interactive toggles for `Needs script` (adds Script stage) and `Needs shoot` (adds Shoot stage; when toggled off, renders a required `Source video link` URL field). Always includes Edit and Post stages.
   - Design types include Content and Design stages; Post stage included only for postable types.
   - The Post stage line displays the assigned posting owner and is pinned to the publish date.
3. **Autofill Deadlines & Suggested Offsets ($F - \text{offset}$):**
   - Implemented standard backwards calendar day offsets from publish/needed-by date $F$:
     - **Reel with Script & Shoot:** Script $F-8$, Shoot $F-5$, Edit $F-2$, Post $F$.
     - **Reel with Shoot only:** Shoot $F-5$, Edit $F-2$, Post $F$.
     - **Reel with Edit only:** Edit $F-2$, Post $F$.
     - **Postable Design:** Content $F-5$, Design $F-2$, Post $F$.
     - **Non-postable Design:** Content $F-5$, Design $F-2$.
   - Interactive date pickers for each stage with dynamic offset hint chips (`5 days before publish`, `On publish date`).
   - Manual override tracking: editing a date sets `dueDateSource: 'manual'` and displays a `'Set by you'` badge. When $F$ is updated, manual deadlines are preserved while auto-deadlines are cleanly recalculated.
4. **Suggested Owners & Work Preferences:**
   - Autofills owners based on lowest workload and stage qualification (`workPreferences`), tagging with reason badges (`Work preference: <Stage>`, `Load: <Pct>%`, or `'Set by you'`).
   - Graceful fallback when no team member holds a preference: marks select with warning banner `'No available person with this role; assign manually'`.
   - Permitted SM Managers and Admins to be assigned as posting owners without triggering worker work preference mismatch.
5. **Real-Time Row Form Validation & Submit Guards:**
   - Blocks invalid inputs with clear messages: past dates, deadlines $> F$, out-of-order stage sequence (Script $\ge$ Shoot $\ge$ Edit; Content $\ge$ Design), missing source video on Reels without shoot, and unqualified owner selections.
   - Tight buffer warning highlighted when last creation stage is due $\ge F-1$.
   - Form Save/Submit button is disabled while validation errors exist.
6. **Plan Grid & Import Enhancements:**
   - Plan rows table includes a **Steps** column displaying step avatar chips with deadline badges. Clicking any chip opens the Edit Plan Row modal.
   - 23-column standard Excel import template downloaded via `GET /api/calendar-plans/template/excel`.
   - Preview import calculates blank deadlines ($F - \text{offset}$) and suggests owners, tagging them in the preview table.
7. **Calendar Visibility:**
   - Calendar month view displays both stage deadlines (`${stageKey} due: <topic> (<owner>)`) and live publish events (`Publish: <topic>`).
   - Scoped visibility: workers view only their assigned stage items, while managers/admins view all events.

---

## Phase CC1: Creative Calendar & Multiple Calendars (Status: COMPLETE)

### Precondition & Final Verification Counts (Verified 02 November 2026)
- **`npm install`:** Clean install, strictly zero new npm dependencies.
- **`npm run typecheck`:** PASSED cleanly (**0 TypeScript errors** across `@mmp/shared`, `@mmp/api`, and `@mmp/web`).
- **`npm run build`:** PASSED cleanly across all workspaces:
  - `@mmp/shared`: tsup ESM/CJS/DTS build success.
  - `@mmp/web`: Vite production bundle generated cleanly.
- **Final Test Counts:** **644 passed tests, 0 failed across 45 test files**:
  - `@mmp/api`: **541 passed tests across 31 test files** (including 11 tests in `apps/api/test/creative_calendar_multical.test.js`).
  - `@mmp/web`: **103 passed tests across 14 test files**.
  - Monorepo Total: **644 passed tests, 0 failures (100% green)**.

### Architecture & Key Deliverables Completed (Creative Calendar & Multiple Calendars)
1. **Renaming & Scope Consistency:**
   - Renamed "Monthly Marketing Calendar", "Marketing Calendar", and "SM Calendar" to "Creative Calendar" across navigation, headers, breadcrumbs, notifications, emails, docs, rules, and OpenAPI descriptions.
   - Renamed report from "Weekly Marketing Report" to "Weekly Creative Report" (and digest job to "Weekly Creative Executive Digest").
   - Product name **HACA Marketing OS** kept strictly untouched.
2. **Multiple Calendars Support (5 Fixed Calendars):**
   - Added stable calendar keys and visual palette in `@mmp/shared`:
     - `sm` (SM) - Violet
     - `sales` (Sales Team) - Emerald
     - `ads` (Ads Team) - Amber
     - `academics_management` (Academics and Management) - Sky
     - `other` (Other) - Slate
   - `CalendarPlan` model updated with required `calendar` field and compound index `{ calendar: 1, periodStart: 1, periodEnd: 1 }`.
   - Propagated `calendar` to `ContentPiece` and `WorkItem`.
   - Removed legacy `forTeam` row field and its import column.
3. **Plan Creation Wizard & Duplicate Period Blocking:**
   - 3-step wizard in `PlansTab.tsx`:
     - Step 1: "Which calendar is this for?" (5 calendar selection cards with descriptions & colors).
     - Step 2: "Plan Type" (Monthly or Individual work).
     - Step 3: Details form with dynamic default title `<Calendar Name> <Month Year>` (editable).
   - Period overlap validation: scoped per `{ kind: 'monthly', calendar }`. Exact duplicate start/end period on the same calendar is strictly blocked with HTTP 400 `EXACT_DUPLICATE_PERIOD`. Partial overlap surfaces an advisory warning `OVERLAPPING_PERIOD`.
4. **Individual Work Management:**
   - 1-row plan of kind `individual`.
   - Dedicated "Add individual work" button in Creative Calendar and Plans views.
   - Moving calendar via `PATCH /api/calendar-plans/:id/calendar`: Allowed freely during Draft or Changes requested; once approved, restricted to SM Manager and Admin only. Emits `plan.calendar_moved` ActivityEvent and notifies leadership.
5. **Creative Calendar UI & Filtering:**
   - Top selector bar in `CalendarPage.tsx` supporting: All, SM, Sales Team, Ads Team, Academics and Management, Other.
   - Persistent synchronization with URL query parameter `?calendar=`.
   - Month, Plans, and Content Flow Tracker tabs filter seamlessly by selected calendar.
   - Deliverables and timeline chips styled with calendar-specific colors.
   - Worker scoping preserved: Workers only see their own assigned stage items on the calendar.
6. **Data Migration Script (`scripts/migrate-calendars.js`):**
   - Safe, idempotent migration script with dry-run default, local database enforcement, external JSON backup export to temporary directory, and rollback mechanism.
   - Assigns `calendar: 'sm'` to existing plans and pieces and unsets deprecated `forTeam`.
   - Dry-run tested and verified.

---

## Phase CH2: Share to Chat, Media Cards, Access Grants, and Chat Polish (Status: COMPLETE)

### Precondition & Final Verification Counts (Verified 01 November 2026)
- **`npm install`:** Clean install, strictly zero new npm dependencies.
- **`npm run typecheck`:** PASSED cleanly (**0 TypeScript errors** across `@mmp/shared`, `@mmp/api`, and `@mmp/web`).
- **`npm run build`:** PASSED cleanly across all workspaces:
  - `@mmp/shared`: tsup ESM/CJS/DTS build success in 3.08s (`dist/index.d.ts` 123 KB).
  - `@mmp/web`: Vite production bundle generated in 14.85s (2215 modules transformed, 0 bundle errors).
- **Final Test Counts:** **637 passed tests, 0 failed across 44 test files** (+22 tests in this phase):
  - `@mmp/api`: **534 passed tests across 30 test files** (+17 tests in `apps/api/test/chat_share_polish.test.js` covering approved-only gating, destination channel membership verification, ownership checks, grant creation, signed HMAC streaming/download, revocation cutoff, and submission approval atomic sharing).
  - `@mmp/web`: **103 passed tests across 14 test files** (+5 tests in `apps/web/src/pages/__tests__/ChatSharePolish.test.tsx` verifying channel population, snapshot preview, custom note submission, inline video player modal, and real-time revoked state transition).
  - Monorepo Total: **637 passed tests, 0 failures (100% green)**.

### Architecture & Key Deliverables Completed (Share to Chat & Chat Polish)
1. **Scoped ShareGrant Model (`apps/api/src/modules/chat/shareGrant.model.js`):**
   - Implemented `ShareGrant` schema: `{ mediaItem, channel, message, grantedBy, revokedAt, isRevoked }`.
   - Indexes on `{ channel: 1, isRevoked: 1 }` and `{ mediaItem: 1 }`.
2. **Backend Endpoints & Access Control (`apps/api/src/modules/chat`):**
   - `POST /api/chat/share`: Strict role checking (asset owner, creative_head, sm_manager, admin). Status must be approved. Sharer must be a member of destination channel. Executives blocked. Generates `ChatMessage` of kind `media_share` with snapshot metadata.
   - `GET /api/chat/shared-asset/:grantId`: Verifies requester channel membership; ensures grant is not revoked (HTTP 403 `SHARE_REVOKED`). Signs short-lived 15-minute download/stream URL (`token` & `expires`). Leaks zero review comments, ratings, or pipeline internals. Supports `?download=1` direct streaming header.
   - `POST /api/chat/share/:grantId/revoke`: Sharer, creative_head, or admin sets `revokedAt`. Emits revocation and transforms card to revoked state.
   - Atomic approval sharing: `approveWithRating` supports `alsoShareToTeamChat: true`, creating chat share within the same transaction.
3. **Frontend Workspaces & Polish (`apps/web/src`):**
   - `ShareToChatModal`: Integrated in Shoot, Edit, and Design workspaces (`ClipCard`, `MediaThread`, `DesignWorkspace`, `EditWorkspace`) and Review Studio (`ReviewStudioPage`).
   - `MediaCardPlayer`: Inline media preview with play modal, direct signed download link, approved badge, owner attribution, note display, and role-gated "Unshare" button with instantaneous revoked notice.
   - "Shared media" right drawer tab in `ChatPage.tsx` listing all active shared deliverables with scroll-to-message navigation.
   - Review Studio decision bar includes `[ ] Also share to Team chat` checkbox for Creative Head approving final cut.
   - Consistent UI standards adhered to: responsive layout, smooth scrolling, reserved image heights to prevent layout jumps, and accessible contrast.

---

## Phase CH1: Team Chat, Groups, Direct Messages, and Real-Time Socket Architecture (Status: COMPLETE)

### Precondition & Final Verification Counts (Verified 29 October 2026)
- **`npm install`:** Clean install, 0 dependency changes, strictly zero new npm packages added.
- **`npm run typecheck`:** PASSED cleanly (**0 TypeScript errors** across `@mmp/shared`, `@mmp/api`, and `@mmp/web`).
- **`npm run build`:** PASSED cleanly:
  - `@mmp/shared`: tsup ESM/CJS/DTS generated in 3.30s.
  - `@mmp/web`: Vite production bundle generated in 12.22s (`dist/assets/ChatPage-Cc5Sbq-A.js`, 2214 modules transformed).
- **Final Test Counts:** **615 passed tests, 0 failed across 42 test files** (+44 new tests):
  - `@mmp/shared`: TypeScript contracts & Zod schemas built into package bundle.
  - `@mmp/api`: **517 passed tests across 29 test files** (+33 tests in `apps/api/test/chat_system.test.js`, updated permission snapshots in `executive_role.test.js`, `permissions.test.js`, `scope_reset_r2.test.js`).
  - `@mmp/web`: **98 passed tests across 13 test files** (+11 tests in `apps/web/src/pages/__tests__/ChatSuite.test.tsx`).
  - Monorepo Total: **615 passed tests, 0 failures (100% green)**.

### Architecture & Key Deliverables Completed
1. **Source of Truth Specification (`docs/CHAT.md` & Rules):**
   - Wrote comprehensive master specification in `docs/CHAT.md` and `haca-forge/docs/CHAT.md`.
   - Updated `.agent/rules/` files (`00-project-context.md`, `00-scope-and-roles.md`, `01-engineering-rules.md`, `03-business-rules.md`) strictly keeping all files under 8,000 characters.
   - Updated `docs/BUILD_PLAN.md` and `docs/OPEN_QUESTIONS.md`.
2. **Channel Model & Management (`apps/api/src/modules/chat`):**
   - **Team Chat:** Singleton system channel (`general-team`). Automatically joins all active users upon activation; suspended/deactivated users lose access immediately. Immutable (cannot be renamed, archived, or left). Executive users are read-only members.
   - **Groups:** Created by `creative_head`, `sm_manager`, and `admin` (`chat.group.create`). Owner controls membership and group rename/archive; members can leave; owner must transfer ownership or archive before leaving; admin can manage any group. Archived groups become read-only and are listed under Archived.
   - **Direct Messages (DMs):** 1:1 private channels between any two active users who are not executives. Strictly private from admin inspection; zero group DMs.
3. **Messages, Rich Interactions & Media Security:**
   - Text limit: 4,000 characters; Unicode emoji picker built-in (84 emojis across 4 categories with zero npm dependencies); @mentions with autocomplete (`@everyone` restricted to leaders/admin).
   - Quoted replies, 24-hour edit window (`[edited]` flag), deletion placeholders (`"Message deleted"`), admin deletion logging in `ActivityEvent`.
   - 6 fixed reactions (👍, ❤️, 😂, 🎉, 👀, ✅), up to 10 pinned messages per channel.
   - Attachments: Images ($\le 20$ MB), Documents ($\le 25$ MB), Video ($\le 100$ MB) with max 5 files per message; stored in unguessable UUID directory paths with filename sanitization.
   - Plain text links (no preview scraping); read receipts (`Seen by N` for groups, double-tick for DMs), unread dividers, real-time typing indicators, jump-to-latest button, infinite scroll history (50 per page), in-channel and cross-channel message search, deep links (`/chat/<channelId>?m=<messageId>`).
4. **Real-Time Socket.io Architecture:**
   - Authenticated handshake via JWT; database membership check on room join (`chat:join`) and every emit.
   - Socket events: `chat:message:new`, `chat:message:edited`, `chat:message:deleted`, `chat:reaction:toggled`, `chat:pin:toggled`, `chat:typing`, `chat:read`.
   - Optimistic message sending with retry UI.
5. **Scoped "Share to Chat" (`ShareGrant` Model):**
   - Only approved outputs (clips, final cuts, design images/PDFs, documents) can be shared from workspaces, Review Studio, and clip cards by output owner, `creative_head`, `sm_manager`, or `admin`.
   - Scoped `ShareGrant`: grants channel members read-only access to view and download *that asset only*; upstream pipelines, review comments, ratings, and steps remain private.
   - Unshare revokes grant immediately, showing `"This asset is no longer shared in this channel. Access was revoked."`
   - Creative Head Review Studio decision bar includes optional `[ ] Also share to Team chat` checkbox during approval.
6. **Zero Surveillance Rule Strictly Enforced:**
   - No leaderboards, message volume metrics, or individual chat ranking reports anywhere in the application.

---



### Precondition Verification & Baseline Counts (Verified 29 October 2026)
- **`npm install`:** PASSED cleanly (`up to date, audited 780 packages in 35s`, 0 install errors).
- **`npm run typecheck`:** PASSED cleanly (0 TypeScript errors across `@mmp/shared`, `@mmp/api`, and `@mmp/web`).
- **`npm run build`:** PASSED cleanly:
  - `@mmp/shared`: tsup ESM/CJS/DTS compiled in 3.79s.
  - `@mmp/web`: Vite production bundle compiled in 24.36s (2204 modules transformed).
- **Initial Baseline `npm test`:** **521 passed tests, 0 failed across 38 test files**:
  - `@mmp/shared`: No tests needed (typings and Zod schemas).
  - `@mmp/api`: **450 passed tests across 27 test files** (0 failures).
  - `@mmp/web`: **71 passed tests across 11 test files** (0 failures).
  - Total: **521 passed tests, 0 failed**.
- **`npm run lint`:** References `eslint .`; eslint is not present in devDependencies per the project's zero-new-dependencies constraint (documented in previous phases).

### Final Implementation & Verification Counts
- **`npm run typecheck`:** PASSED cleanly with **0 errors** across all workspaces (`@mmp/shared`, `@mmp/api`, `@mmp/web`).
- **`npm run build`:** PASSED cleanly in 24.52s across all workspaces.
- **Final `npm test`:** **571 passed tests, 0 failed across 40 test files** (+50 new tests):
  - `@mmp/shared`: No test runner required (pure schemas & types).
  - `@mmp/api`: **484 passed tests across 28 test files** (+34 in `test/profile_and_settings.test.js`).
  - `@mmp/web`: **87 passed tests across 12 test files** (+16 in `ProfileSettingsSuite.test.tsx`).
- **Zero New Dependencies:**
  - Standard HTML5 2D Canvas was used to build the responsive client-side image cropper (`<AvatarCropModal />`), adhering strictly to the constraint of zero external cropping dependencies.
- **Ratings & Feedback Integration:**
  - `<RatingsFeedbackSection>` component integrated on `ProfileView.tsx` directly underneath the role panel slot, displaying summary rating stats, distribution bars, monthly trends, and teammate feedback.

### Architecture & Key Deliverables Completed
1. **Data Model Extensions (`Person` / `User` & `Session`):**
   - Added profile attributes: `avatarUrl`, `avatarStorageId`, `preferredName`, `phone` (E.164 validated), `whatsappNumber`, `languages` (up to 5), `about` (up to 200 chars), `skills` (up to 10 tags <= 30 chars), `preferences` (`startPage`, `dateFormat`, `timeFormat`, `weekStart`), `notificationPrefs` (category switches: `mySteps`, `approvalsRevisions`, `messagesComments`, `deadlinesOverdue`, `planUpdates`, `system`), `profileCompletedAt`, `lastLoginAt`.
   - New `Session` model tracking active sign-ins (`deviceLabel` from user agent, SHA-256 `ipHash`, `refreshTokenFamily`, `refreshTokenHash`, `lastUsedAt`, `revokedAt`).
2. **Backend Services & Strict Endpoints (`apps/api`):**
   - Strictly validates all payloads via Zod (`.strict()`), disallowing unauthorized modifications to `role`, `email`, `department`, `jobRole`, `capacity`, or unrecognized properties.
   - Mounted endpoints: `GET /api/me/profile`, `PATCH /api/me/profile`, `POST /api/me/avatar` (png/jpg/webp <= 5MB, old file deleted), `DELETE /api/me/avatar`, `GET /api/me/settings`, `PATCH /api/me/settings`, `POST /api/me/password` (min 8 chars, 1 uppercase, 1 digit, different from current, rate limited with mandatory security alert email), `GET /api/me/sessions`, `DELETE /api/me/sessions/:id`, `POST /api/me/sessions/revoke-others`, `POST /api/me/change-request` (notifies all active admins & records `ActivityEvent`), `GET /api/people/:id/profile` (strict contact masking; workers restricted to teammates sharing content pieces), `PATCH /api/people/:id/basic-info` (admin only), `DELETE /api/people/:id/avatar` (admin only), `POST /api/me/welcome` (first login completion).
   - `ActivityEvent` audit records created with field names only (values never recorded).
   - In-app and email notification suppression respects user notification switches while security alerts are non-suppressible.
3. **Frontend Components & Pages (`apps/web`):**
   - `<Avatar />`: Universal component (sizes `xs`, `sm`, `md` [40px], `lg`, `xl`) with initials fallback, deterministic ID-derived accessible gradient, and lazy loading. Completely removed online presence dots.
   - `<AvatarCropModal />`: Canvas circular crop modal with zoom slider, drag pan, and preview.
   - `<UserMenuDropdown />`: Compact top-nav dropdown with "View profile", "Settings", and "Sign out".
   - `<ProfileView />`: Header card, edit/discard about form with character counter and dirty-state warning, read-only work details with change request modal, and 5-variant role panels:
     - `admin`: Pending access requests link & team distribution by role.
     - `creative_head`: Stages waiting approval link & plans waiting review link.
     - `sm_manager`: Content pipeline status, stages needing owner count, and late items.
     - `executive`: Company operational throughput summary (read-only).
     - `team_member`: Active deliverables in flight, capacity workload band, and on-time rate.
   - `/profile`: Main profile route (`/account` and `/my-account` redirect to `/profile`).
   - `/settings`: Unified layout for all roles with tabs for Security (password change & active sessions list), Notifications (role-scoped category toggles), and Preferences (landing page, date/time format, week start).
   - `/welcome`: First-login profile completion wizard requiring name and phone.
   - `<ProfileDrawer />`: Slide-out teammate profile drawer with strict contact masking.
4. **Idempotent Migration Script:**
   - `scripts/migrate-profile-completed.js` created with dry-run mode, JSON backup, and rollback capabilities. Verified in dry run mode without database mutations.

---

## Phase WS3.2: Editor Workspace Video Player & Live Discussion Sync (Status: COMPLETE)
- **Problem Statement:**
  - In Editor's workspace (`/work/:id/workspace`), when an edited video was submitted and Creative Head requested revisions (`status: 'Feedback'`), the edited cut video player and live chat feedback stream were not displaying, leaving the workspace empty or trapped on the upload tab.
  - In read-only mode (when awaiting approval), editors and reviewers visiting the edit step fell through to a generic viewer rather than showing the rendered cut and live feedback thread.
- **Root Cause & Fixes:**
  1. **Read Mode Trap in `MediaWorkspacePage.tsx`:**
     - Previously, when `modeInfo.mode === 'read'`, only Shoot stage was handled and other stages fell through to `EarlierOutputsViewer`.
     - Fixed `MediaWorkspacePage.tsx` to render `EditWorkspace` with `readOnly={true}` when `stageKey === 'Edit'`, ensuring the cut player and live feedback are always accessible in read mode.
  2. **Tab Stuck on Upload & Video Player Resolution in `EditWorkspace.tsx`:**
     - `activeTab` was initialized based on `hasExistingCut` at initial mount. If props loaded asynchronously, `activeTab` stayed stuck on `'upload'`, which hid the video player and chat entirely.
     - Resolved `effectiveCutUrl` across `activeVideoUrl`, `propActiveVideoUrl`, `currentSubmission?.fileUrl`, `currentSubmission?.linkUrl`, `versions[0]?.fileUrl`, and `workItem.deliverableUrl`.
     - Added automatic tab sync to switch to `'cut'` whenever an existing cut is detected or when in `readOnly` mode.
     - In `activeTab === 'cut'`, rendered `<VideoPlayer url={effectiveCutUrl} ... />` whenever `effectiveCutUrl` is truthy, with a quick upload revised cut drawer underneath.
     - In `readOnly` mode, displayed a clean deliverable status banner and hid submission dropzones.
  3. **Backend `fileUrl` Persistence on `Submission` Model:**
     - Added `fileUrl: { type: String, default: '', trim: true }` to `submissionSchema` in `apps/api/src/modules/submissions/model.js` so local `/uploads/...` paths are directly stored and returned.
  4. **Creative Head Revision Notes in Live Discussion:**
     - Updated `requestRevision` in `apps/api/src/modules/submissions/service.js` to automatically create a `SubmissionComment` and broadcast `comment:new` over Socket.IO when a reviewer submits a revision note, ensuring feedback immediately appears in the editor's live chat stream.
     - Enhanced `isReviewer` detection in `EditWorkspace.tsx` to handle all creative roles and team member checks.
  5. **Performance & Infinite Loop Fix in React `useEffect`:**
     - Removed default parameter `[]` array instantiation in `propRevisionComments` and `propRawFootage` destructuring, and memoized comment updates to eliminate memory leaks and ensure rapid ~0.4s test execution.
- **Verification:**
  - Automated tests: **8/8 passed** in `Workspaces.test.tsx` (including dedicated video player, live discussion, and read-only tests).
  - API integration tests: **16/16 passed** in `workspaces_ws4_journeys.test.js` and **6/6 passed** in `review_studio_and_workspaces.test.js`.
  - Typecheck: `npm run typecheck` passed with 0 errors across `@mmp/shared`, `@mmp/api`, and `@mmp/web`.
  - Production build: `npm run build` completed successfully in 14.12s.
- **Precondition Verification & Baseline Counts:**
  - `typecheck`: Passed with 0 errors across `@mmp/shared`, `@mmp/api`, and `@mmp/web`.
  - `build`: Passed (`@mmp/shared` tsup ESM/CJS/DTS in 4.5s, `@mmp/web` Vite production bundle in 35.00s).
  - `test`: **477 passed tests, 0 failed** across entire monorepo:
    - API (`@mmp/api`): 426 passed tests across 25 test files.
    - Web (`@mmp/web`): 51 passed tests across 8 test files.
    - Total: 477 passed tests, 0 failed.
  - `lint`: npm run lint references eslint; dependencies strictly preserved per zero new dependencies constraint.
- **Root Cause & Resolution:**
  - Owner opening workspace during `Feedback` status was previously routed to read-only `view` mode instead of `edit` mode.
  - Fixed `getWorkspaceMode` logic in `@mmp/shared/src/index.ts` so step owner in `Feedback` or `In Progress` status correctly receives `mode: 'edit'`.
  - Added unit and integration test coverage across all role permutations.

## Phase WS3: Shoot Workspace: Clips, Per-Clip Feedback and Tools (Status: COMPLETE)
- **Precondition Verification & Final Results:**
  - Precondition baseline: 426 API tests, 51 Web tests (477 total passed).
  - Final tests: **514 passed tests, 0 failed** across entire monorepo:
    - API (`@mmp/api`): 450 passed tests across 27 test files (+21 in `media_and_shoot_workspace.test.js`, +3 in `local_uploads.test.js`).
    - Web (`@mmp/web`): 64 passed tests across 9 test files (+13 in `ShootWorkspaceSuite.test.tsx`).
    - Total: 514 passed tests, 0 failed.
  - `typecheck`: Passed with 0 errors across `@mmp/shared`, `@mmp/api`, and `@mmp/web`.
  - `build`: Passed (`@mmp/shared` tsup ESM/CJS/DTS in 4.5s, `@mmp/web` Vite bundle in 19.58s).
  - `dependencies`: **Zero new dependencies added.** Reused existing Multer package, Mongoose models, Zod, and Tailwind/Lucide ecosystem.
  - `storage`: Replaced external Cloudinary client upload with a dedicated local project upload engine (`apps/api/uploads/`), served statically via Express on `/uploads` and proxied through Vite, resolving HTTP 401 external credentials errors while preserving MongoDB `MediaItem` models and document references.

## Phase WS3.1: Creative Review Studio & Media Workspace Footage Display (Status: COMPLETE)
- **Problem Statement:**
  - After shooter uploaded footage clips and submitted the Shoot step for approval, Creative Head / Creative Manager opening Review Studio (`/feedback/review-studio`) saw a dark card displaying only the raw string text `"Clips submitted for review"` instead of the uploaded footage clips.
- **Root Cause:**
  1. `detectViewerType(sub)` in `ReviewStudioPage.tsx` checked only `sub.fileUrl` or `sub.contentUrl`. Because Shoot deliverables store media as a collection of clips (`sub.files` and `MediaItem` collection), `sub.fileUrl` was undefined, causing it to fall through to `setViewerType('document')`.
  2. `DocumentViewer` rendered `sub.textContent || sub.notes`, displaying only the notes string `"Clips submitted for review"`.
  3. `ShootReviewView` was only mounted under `/work/:id/workspace` and was not wired into `ReviewStudioPage.tsx`.
  4. In `MediaWorkspacePage.tsx`, any user accessing Shoot workspace in `read` mode was redirected to an empty `EarlierOutputsViewer` rather than showing the uploaded Shoot deliverables in read-only mode.
  5. In `VideoPlayer.tsx`, clips with image extensions (`.jpg`, `.jpeg`, `.png`, `.webp`) attempted to load into HTML5 `<video>`, which fails for still assets.
- **Resolution:**
  1. **`ReviewStudioPage.tsx`:**
     - Embedded `ShootReviewView` directly into the Review Studio queue when the active submission is a `Shoot` deliverable (`isShootStage`), passing `stageItemId`, `hideHeader={true}`, and `onFinishReview` to advance the queue.
     - Enhanced `detectViewerType(sub)` to inspect `sub.files[0]`, `sub.kind`, and `sub.deliverableType` when `sub.fileUrl` is not directly on the root.
     - Guarded `DecisionBar` and viewer switcher tabs so Shoot's dedicated per-clip review suite and rating bar take precedence.
  2. **`ShootReviewView.tsx`:**
     - Added `hideHeader?: boolean` and `readOnly?: boolean` props.
     - Displayed coverage badge in the Clips Gallery header so it remains visible without top header.
     - Fixed `selectedClip` reset when navigating between queue items so the first clip of the new item is selected.
  3. **`VideoPlayer.tsx`:**
     - Added image detection (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg`, `data:image/`) rendering `<img>` for photo assets and `<video>` for video footage with full thread referencing support.
  4. **`MediaWorkspacePage.tsx`:**
     - In `modeInfo.mode === 'read'` for Shoot steps, renders `ShootReviewView` with `readOnly={true}` so teammates, owners, and creative managers can always inspect uploaded clips.
  5. **`apps/api/src/modules/media/service.js`:**
     - Populated `fileUrl: clipFiles[0]?.url` on `Submission` creation and updated `WorkItem.deliverableUrl`.
- **Verification:**
  - `npm --workspace=@mmp/web test`: **65 passed tests** (including new `ReviewStudioPage with Shoot Submissions` test).
  - `npm --workspace=@mmp/api test`: **450 passed tests**.
  - `npm run typecheck`: **0 errors** across all workspaces.
  - `npm run build`: Production build succeeded in 18.78s.

## SM Manager My Work Section & Posting Workflow Enhancements (Status: COMPLETE)
- **User Request:**
  - "SM Manager will may have the work of social media work upload like the posting role will the the work of sm maneger so is a work that assing to sm maneger he need to upload the post and add social loink as the reference , so add the my work section also for sm manger"
- **Implementations:**
  1. **Navigation & Sidebar Integration (`apps/web/src/components/Layout.tsx`):**
     - Added `My Work` (`/my-work`) to `navCategories` under the Schedule group for `sm_manager` with `CheckSquare` icon and description.
     - Added `My Work` (`/my-work`) to left desktop icon `sidebarItems` immediately adjacent to Dashboard for `sm_manager`.
     - Automatically included in mobile drawer navigation and search jump index.
  2. **Posting Workspace Asset Uploading & Social Link Reference (`apps/web/src/pages/work/workspaces/PostWorkspace.tsx`):**
     - Enhanced `PostWorkspace` with an interactive post media upload dropzone supporting images, videos, and PDFs via `ResumableUploadTask` (`/api/uploads/file`).
     - Added support for pasting external asset links (Google Drive, Figma, Dropbox).
     - Added live status badge displaying attached post asset details and replace button.
     - Enhanced publication form to capture and validate live social post URL reference (Instagram, LinkedIn, YouTube, TikTok, Facebook).
     - Passes both `deliverableUrl` (uploaded creative post) and `publishedUrl` (live social reference link) upon marking as posted.
  3. **Workspace Orchestration (`apps/web/src/pages/work/workspaces/MediaWorkspacePage.tsx`):**
     - Updated `handleMarkAsPosted` to forward `deliverableUrl` alongside `publishedUrl` to the backend transition endpoint.
     - Forwarded `deliverableUrl` and `publishedUrl` into `PostWorkspace` props.
  4. **My Work Quick Modal (`apps/web/src/pages/work/MyWorkPage.tsx`):**
     - Enhanced the Quick Submit / Mark as Posted modal with file upload capability (`ResumableUploadTask`) and validated live social reference link input for the `Post` stage.
     - Added direct "Workspace" quick launch button on deliverable cards for interactive stages (`Shoot`, `Edit`, `Design`, `Post`).
  5. **Unit & Integration Test Coverage:**
     - Created `apps/web/src/components/__tests__/LayoutNavigation.test.tsx` verifying that `My Work` is rendered in navigation for `sm_manager`.
     - Added test in `apps/web/src/pages/work/workspaces/__tests__/Workspaces.test.tsx` verifying post asset attachment, live social reference URL validation, and transition execution.
- **Verification:**
  - `npm --workspace=@mmp/web test`: **68 passed tests** across 10 test files (0 failures).
  - `npm --workspace=@mmp/api test`: **450 passed tests** across 27 test files (0 failures).
  - Monorepo Total: **518 passed tests** (0 failures).
  - `npm run typecheck`: **0 errors** across all packages.
  - `npm run build`: Production bundle built successfully in 16.71s.

## Demo Quick-Fill Accounts Update (Status: COMPLETE)
- **User Request:**
  - "add - shooter@demo.haca.local : [password removed], editor1@demo.haca.local : [password removed] , also in Demo Quick-Fill Accounts in login page"
- **Implementations:**
  1. **MongoDB Verification:**
     - Verified `shooter@demo.haca.local` (Test Shooter, role `team_member`, workPreferences `['Shoot']`) and `editor1@demo.haca.local` (Test Editor One, role `team_member`, workPreferences `['Edit']`) already exist with active status, `mustSetPassword: false`, and password hashes matching `[password removed]` and `[password removed]`.
     - Confirmed both authenticate with status 200 via `POST /api/auth/login`.
  2. **Login Page Quick-Fill Accounts (`apps/web/src/pages/LoginPage.tsx`):**
     - Added quick-fill buttons for **Shooter (Worker)** (`shooter@demo.haca.local` : `[password removed]`) and **Editor (Worker)** (`editor1@demo.haca.local` : `[password removed]`) to the 2-column quick-fill grid.
  3. **Unit Tests Added (`apps/web/src/pages/__tests__/LoginPage.test.tsx`):**
     - Added unit test asserting Shooter and Editor buttons render in Demo Quick-Fill Accounts and correctly autofill email and password fields on click.
- **Verification:**
  - `npm --workspace=@mmp/web test`: **69 passed tests** across 11 test files (0 failures).
  - `npm run typecheck`: **0 errors** across all packages.
  - `npm run build`: Production bundle built successfully in 16.77s.

### Backend Architecture & Endpoints
1. **Data Models (`apps/api/src/modules/media/model.js`):**
   - `MediaItem`: `stageItemId`, `submissionId`, `kind` ('video' | 'image'), `url`, `storageId`, `thumbnailUrl`, `title`, `shotRef`, `take`, `tags[]`, `notes`, `favourite`, `order`, `version`, `replacesId`, `durationSeconds`, `width`, `height`, `orientationOk`, `sizeBytes`, `status` ('uploading' | 'uploaded' | 'waiting_review' | 'approved' | 'reshoot_needed'), `decidedById`, `decidedAt`, timestamps.
   - `MediaMessage`: `mediaItemId`, `authorId`, `text`, `timeSeconds`, `replyToId`, `seenBy[]` (`userId`, `seenAt`), `doneAt`, `doneById`, timestamps. Immutable (no update endpoint).
2. **REST Endpoints (`apps/api/src/modules/media/routes.js` & `controller.js`):**
   - `POST /api/clips`: Create clip record after signed upload. Calculates 9:16 vertical ratio ($1.6 \le \text{height}/\text{width} \le 1.9$).
   - `GET /api/work/:stageItemId/clips`: List clips for stage item with unread counts per viewer.
   - `PATCH /api/clips/:id`: Update metadata (`title`, `shotRef`, `take`, `tags`, `notes`, `favourite`, `order`). Approved clips locked.
   - `POST /api/clips/:id/replace`: Replaces clip with a new version; original clip remains archived in history.
   - `DELETE /api/clips/:id`: Delete clip (only permitted while clip is not approved and stage item is editable).
   - `PUT /api/work/:stageItemId/clips/reorder`: Reorder clip display sequence.
   - `POST /api/clips/:id/messages`: Post message with optional `timeSeconds` and `replyToId`. Step owner, `creative_head`, and `admin` have write access; `sm_manager` and `executive` are read-only; others receive 403 Forbidden.
   - `GET /api/clips/:id/messages`: List chronological thread with resolved `replyToPreview`.
   - `POST /api/clips/:id/messages/seen`: Mark thread messages as seen for current user.
   - `PATCH /api/clips/messages/:messageId/toggle-done`: Mark feedback message as done / reopen.
   - `POST /api/clips/:id/review`: Approve clip or mark `reshoot_needed` (feedback text mandatory).
   - `POST /api/work/:stageItemId/finish-review`: If any clip is `reshoot_needed`, step moves to `Feedback` (Changes requested); if all clips are approved, approves step with 1–5 rating score and unlocks `Edit` stage. Blocks approval if clips are `waiting_review` or `reshoot_needed`.
   - `POST /api/work/:stageItemId/submit-clips`: Validates submission ($\ge 1$ clip, none uploading, all flagged clips replaced) and transitions eligible clips to `waiting_review`.
3. **Stage Handoff & Isolation:**
   - In `apps/api/src/modules/workItems/service.js`, `getWorkItemById` attaches `approvedClips` (with `title`, `shotRef`, `tags`, `notes`) read-only when stage is `Edit`.
4. **Notifications:**
   - Automated notification triggers for clips submitted (to `creative_head`), new messages (to opposite side), and clip review decisions (to shooter).

### Frontend Components (`apps/web/src/pages/work/workspaces/`)
1. `UploadManager.tsx`:
   - Concurrency queue (2 parallel uploads).
   - Pause, resume, retry, cancel per upload.
   - Camera recording capture (`capture="environment"`) and drag-and-drop file picker.
   - Tab-close protection (`beforeunload` warning when uploads are in flight).
   - Background upload persistence across in-app navigation via singleton module queue.
2. `ClipCard.tsx`:
   - Thumbnail preview, duration formatting, file size, 9:16 vertical badge.
   - Inline title editing, shot link dropdown, take counter, tag selector (`A-roll`, `B-roll`, `Interview`, `Cutaway`), notes textarea, favourite star.
   - Version replacement button, delete button (conditional), lock icon for approved clips.
   - Unread message counter badge.
   - Revision highlight banner with latest reviewer feedback on top when flagged.
3. `VideoPlayer.tsx`:
   - Speed playback controls (`0.5x`, `1x`, `1.25x`, `1.5x`, `2x`).
   - Frame stepping forward/backward, loop toggle, fullscreen, mute/unmute.
   - "Reference this moment" button injecting current playback time into message composer.
4. `MediaThread.tsx`:
   - WhatsApp-style chat bubbles (mine right, theirs left) with author name, role chip, and timestamp.
   - Quoted replies (`replyToPreview`) with jump-to-source indicator.
   - Interactive timestamp chips (`at 0:12`) that seek video player.
   - Sent (`✓`) and seen (`✓✓`) status ticks.
   - Feedback Done toggle (`doneAt`, `doneById`) with Reopen capability for reviewers.
   - Auto-scroll with floating "Jump to latest" button.
   - Plain-text sanitization with non-clickable links by default.
   - Read-only permission state for `sm_manager` and `executive` roles.
5. `ShootReviewView.tsx`:
   - Creative Head / Admin review cockpit: clip gallery with status, unread counts, shot coverage bar.
   - Side-by-side video player and WhatsApp feedback thread.
   - Action buttons: "Approve clip" and "Reshoot needed" (message required).
   - Sticky summary bar: "Send back (Changes requested)" and "Approve Step with Rating" (1–5 stars + quality tags).
6. `ShootWorkspace.tsx`:
   - Split-screen workspace: upload dropzone + clip cards on left; docked sidebar tabs (Brief, Script, Shot list) on right.
   - Shot checklist with coverage metrics (`"X of Y shots covered"`) and one-click shot linking.
   - Submit for approval bar with live validation reason display and shot coverage summary.
   - Mobile-optimized: player modal opens as full bottom-sheet on 360 px viewport with $\ge 44\text{ px}$ touch targets.
7. `MediaWorkspacePage.tsx`:
   - Dispatches `ShootReviewView` for `mode === 'review'` and `ShootWorkspace` for `mode === 'edit'`.

### Automated Test Suites
1. **API Integration Tests (`apps/api/test/media_and_shoot_workspace.test.js` - 21 tests):**
   - Clip creation with 9:16 aspect ratio validation and size limits.
   - Metadata updates and approved-clip lock enforcement.
   - Clip replacement versioning (replacesId tracking).
   - Clip deletion restrictions on approved clips and submitted steps.
   - Message posting permissions: Step owner, creative_head, admin can post; sm_manager and executive read-only; others 403.
   - Thread seen receipts and toggle-done/reopen lifecycle.
   - Per-clip review decisions (Approve, Reshoot needed with mandatory comment).
   - Step finish review: All approved -> rating & approval; any reshoot -> feedback stage.
   - Step approval blocked while clips are waiting_review or reshoot_needed.
   - Submission validation: empty clip guard, uploading guard, and revision replacement guard.
   - Shot coverage calculation against Script stage scenes.
   - Edit step receives only approved clips read-only.
2. **Web Component Tests (`apps/web/src/pages/work/workspaces/__tests__/ShootWorkspaceSuite.test.tsx` - 13 tests):**
   - `ClipCard`: Renders metadata, 9:16 badge, tags, and locks approved clips.
   - `VideoPlayer`: Speed toggle, frame stepping, loop, and "Reference this moment" click handler.
   - `MediaThread`: Chat bubbles, quoted replies, timestamp chips seeking player, seen ticks, read-only role banner, toggle done/reopen.
   - `ShootReviewView`: Clip gallery, unread counts, review buttons, step approval enabled/disabled based on clip statuses.
   - `ShootWorkspace`: Submit validation disable reason, tab docking, 360 px layout with $\ge 44\text{ px}$ touch targets.
   - `UploadManager`: Rejection of files exceeding 500 MB video limit.



## Phase WS2: Writing Studio (Status: COMPLETE)
- **Precondition Verification & Final Results:**
  - `typecheck`: Passed with 0 errors across `@mmp/shared`, `@mmp/api`, and `@mmp/web`.
  - `build`: Passed (`@mmp/shared` tsup ESM/CJS/DTS in 4.5s, `@mmp/web` Vite bundle).
  - `test`: **410 passed tests, 0 failed** across entire monorepo (API: 381 passed across 22 test files; Web: 29 passed across 5 test files).
  - Added new automated test suites:
    - `apps/api/test/writing_studio_api.test.js` (14 comprehensive integration tests for session lock, anchored comments, draft autosave, empty submission guard, shotlist handoff to Shoot step, Malayalam Unicode preservation).
    - `apps/web/src/lib/__tests__/scriptTools.test.ts` (14 unit tests for duration maths, hook checks, caption platform limits, scene table extraction, and 7 templates).
    - `apps/web/src/lib/__tests__/docxUtils.test.ts` (4 unit tests for DOCX export, Malayalam support, and browser download).

### Allowed New Dependencies (Strictly Constrained)
| Package | Version | Justification |
| :--- | :--- | :--- |
| `@tiptap/react` | ^2.11.5 | React component wrapper for ProseMirror rich text editor. |
| `@tiptap/pm` | ^2.11.5 | ProseMirror core engine packages (state, view, model, transform). |
| `@tiptap/starter-kit` | ^2.11.5 | Standard formatting extensions (headings, bold, italic, strike, lists, code, blockquote). |
| `@tiptap/extension-table` | ^2.11.5 | Multi-column scene table editing with add/remove rows/cols and cell navigation. |
| `@tiptap/extension-table-row` | ^2.11.5 | Table row DOM specification for scene tables. |
| `@tiptap/extension-table-cell` | ^2.11.5 | Table cell DOM specification. |
| `@tiptap/extension-table-header` | ^2.11.5 | Table header cell DOM specification. |
| `@tiptap/extension-underline` | ^2.11.5 | Underline text styling. |
| `@tiptap/extension-highlight` | ^2.11.5 | Text background highlight. |
| `@tiptap/extension-text-align` | ^2.11.5 | Paragraph and heading alignment (left, center, right, justify). |
| `@tiptap/extension-subscript` | ^2.11.5 | Subscript styling for technical notations. |
| `@tiptap/extension-superscript` | ^2.11.5 | Superscript styling for footnotes and indices. |
| `@tiptap/extension-color` | ^2.11.5 | Inline text color selection. |
| `@tiptap/extension-text-style` | ^2.11.5 | Inline CSS style attributes for text runs. |
| `@tiptap/extension-image` | ^2.11.5 | Image insertion support for visual references. |
| `@tiptap/extension-link` | ^2.11.5 | Hyperlink insertion and navigation. |
| `@tiptap/extension-task-list` | ^2.11.5 | Interactive checklist container. |
| `@tiptap/extension-task-item` | ^2.11.5 | Interactive checklist checkbox item with checked state toggling. |
| `docx` | ^9.1.1 | Single DOCX export library generating Microsoft Word `.docx` documents. |
| `mammoth` | ^1.9.0 | Single DOCX import library converting incoming `.docx` files to semantic HTML. |
| *Native Print* | N/A | PDF export uses browser print (`window.print()`) with `@media print` A4 canvas rules; zero extra PDF libraries. |

### Tasks Completed
1. **Writing Studio Page**: Opened from Content / Script step page (`/work/:id/writing-studio` and `/work/:id/write`), with brief & earlier outputs docked in side panel.
2. **Editor**: A4 page view, zoom controls (50%–150%), 6 ribbon tabs (Home, Insert, Script, Review, View, File), full formatting (B, I, U, S, sub/sup, font family, font size, colors, alignments, lists, interactive checklists, tables, images, links, page breaks, undo/redo, find & replace, counts, spellcheck with language setting, focus mode, autosave with 'Saved' indicator and local buffer resilience in `localStorage`, version history with preview & restore, single-editor session lock with heartbeat, import .docx/.txt/paste, export .docx/PDF via print/TXT, print, rename, Malayalam fonts (Manjari, Gayathri) and Unicode text preservation.
3. **Comments**: Anchored comments in side panel (`/api/work/:id/comments`), writer replies, resolves, and jumps to anchor in document.
4. **Script tools**: 7 pre-structured templates (Reel, Explainer, Student Voices, Event Promo, Poster Copy, Carousel, Story), two-column scene table with numbering & duration totals, duration estimator with target duration chips (15s, 30s, 60s, 90s) & warnings, hook check (12-word limit), caption & hashtag section with platform limits (Instagram 2,200, LinkedIn 3,000), automatic shot list generator stored with submission for Shoot step, teleprompter mode (fullscreen high-contrast auto-scrolling with speed/mirror controls), personal snippets (local collection only).
5. **Submit for Approval**: Guarded when document is empty with tooltip/error; studio enters read-only mode while Waiting for approval; unlocks on revision with last version loaded and comments visible.
6. **Fallback**: External link submission modal remains accessible via secondary option.
7. **Responsive**: Desktop-first glass UI; collapses gracefully on 360px mobile view with toolbar menu and scrollable A4 view.

---

## Phase WS1: Submissions, Review and Ratings Backend (Status: COMPLETE)
- **Precondition Verification & Final Results:**
  - `typecheck`: Passed with 0 errors across `@mmp/shared`, `@mmp/api`, and `@mmp/web`.
  - `build`: Passed (`@mmp/shared` tsup ESM/CJS/DTS in 6.4s, `@mmp/web` Vite production bundle in 40.26s).
  - `test`: Passed all 378/378 baseline tests before expanding into WS2.
  - Submissions, ratings, reviews, review queue, and editor session lock endpoints active.

## Work Actions by Role and Wording (Status: COMPLETE)
- **Precondition Verification & Final Results:**
  - `typecheck`: Passed with 0 errors across `@mmp/shared`, `@mmp/api`, and `@mmp/web`.
  - `build`: Passed (`@mmp/shared` tsup ESM/CJS/DTS, `@mmp/web` Vite production bundle in 11.92s).
  - `test`: Passed 378/378 tests (API: 367 tests across 21 test files, Web: 11 tests across 3 test files). Added 32 new tests across `security_probe.test.js` and `work_actions_and_wording.test.js`.
  - `database`: `marketing_portal` verified clean (13 users, 8 campaign pieces, 13 work items, 0 orphaned test items). `marketing_portal_test` dropped cleanly after automated tests.
  - `security`: Closed security gap where non-owners (e.g. Creative Head) could trigger submit, block, and publish on worker tasks; now strictly forbidden with 403 `FORBIDDEN_ACTION`.

### Summary of Implementations
1. **Shared Action Rules (`packages/shared/src/index.ts`)**:
   - Implemented canonical `getAvailableActions(user, stage, piece)`, `getActionDisabledReason`, `WORK_ACTION_KEYS`, and `ACTION_LABELS`.
   - Worker actions strictly require stage ownership (`isOwner`); Creative Head and admin can only `approve` and `request_revision` when `Pending` and `!isOwner`.
   - SM Manager and admin can `change_owner`, `change_date`, `skip_step`, `resolve_blocker`.
   - Executive and all other roles have zero actions.
2. **Backend API Guards (`apps/api/src/modules/workItems/transition.service.js` & `service.js`)**:
   - `transitionWorkItem` checks `getAvailableActions`. Unauthorised worker transitions return 403 `FORBIDDEN_ACTION`.
   - Self-approval blocked (403 `FORBIDDEN_SELF_APPROVAL`). SM Manager cannot approve (403 `FORBIDDEN_APPROVAL`).
   - `deleteWorkItem`: Only allowed for `sm_manager` and `admin` when task is in `Not Started` state (403 `CANNOT_DELETE_STARTED_WORK` / `FORBIDDEN_DELETE`). Audited via `work_item.deleted`.
3. **Frontend UI Alignment**:
   - `WorkDetailPage.tsx`: Cleaned wording (`Owner`, `Links and files`, `Details`, `History`, `Steps`), removed Brand Profile strip/badge, replaced 6-step bar with glassmorphic `PipelineStepper`, added delete confirmation modal.
   - `MyWorkPage.tsx` & `TodoPrioritiesPage.tsx`: Actions rendered strictly from `getAvailableActions`.
   - `WorkListPage.tsx` & `CalendarPage.tsx`: Removed standalone item creation modal and button; individual works created as 1-row calendar plans.
   - `TrackerTab.tsx`: Button wording updated to `Skip step`, `Restore step`, `Change date`.
4. **Wording Sweep**:
   - Cleaned `Lead`, `TL`, `Team Lead`, `Deliverable`, `Brand`, `Audit Stream`, `FORGE` across code, comments, errors, docs, and UI.

---

## Worker Portal & Personal Stage Assignments Fix (Status: COMPLETE)

### Overview & Root Causes Resolved
1. **Empty Queue After Database Wipe**: When running the local database wipe preserving users, the local database was devoid of active uncompleted deliverables for creative team members (`role: 'team_member'`). A background seed script crashed due to unsupplied required fields on `CalendarPlan.create`, leaving writers, designers, editors, shooters, and posters with 0 work items.
2. **Missing Deliverable & Submission Details in UI**: Work cards previously omitted current worker deliverable URLs, live publication links, reviewer feedback notes from the Creative Head, and task instructions/briefs.
3. **Consolidated Worker Navigation**: Cleaned redundant `/todo` routing in favor of `/my-work` ("Focus Cockpit"), added interactive category filters (`All Work`, `Stage Assignments`, `Deliverables`, `Submissions & Reviews`), live search, and full stage workflow badges with stage-specific icons.
4. **Enhanced API**: `/api/my-work` now populates briefs, reference links, and attaches the latest Creative Head revision feedback to items in `Feedback` status.

---

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

---

## Workflow V2 Build Precondition Baseline

### Verification Results (2026-10-25)
- **Authoritative Spec:** [docs/WORKFLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/WORKFLOW.md) verified present (422 lines).
- **`npm install`:** PASSED (687 packages audited, up to date).
- **`npm run typecheck`:** PASSED (0 errors across `@mmp/shared`, `@mmp/api`, `@mmp/web`).
- **`npm run build`:** PASSED (`@mmp/shared` built in 2.8s, `@mmp/web` built in 24.04s).
- **`npm test`:** PASSED (20 test files, 296 tests passed, 0 failures: 17 files / 285 tests in `apps/api`, 3 files / 11 tests in `apps/web`).
- **`npm run lint`:** FAILED (`'eslint' is not recognized as an internal or external command`; `eslint` is not listed in root or workspace dependencies).

---

## Workflow V2: Verification, Role Journeys, and Sample Data (Status: COMPLETE)

### 1. Executive Summary
Workflow V2 implementation, UI build, verification test suites, role-journey verification, and sample data generation are **100% COMPLETE**.

All architectural principles from [docs/WORKFLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/WORKFLOW.md), [docs/UX_SPEC.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/UX_SPEC.md), and [docs/SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/SCOPE_RESET.md) have been systematically realized and validated across the monorepo:
1. **Simplified Information Architecture:** Exactly two plan kinds (`monthly` and `individual` with a strict 1-row invariant). `project` plan kind and department-lead references have been completely retired.
2. **Canonical 15 Deliverable Types & 4 Pipelines:** `reel_a` (Script $\rightarrow$ Shoot $\rightarrow$ Edit $\rightarrow$ Post), `reel_b` (Shoot $\rightarrow$ Edit $\rightarrow$ Post), `reel_c` (Edit $\rightarrow$ Post), `design_postable` (Content $\rightarrow$ Design $\rightarrow$ Post), and `design_non_postable` (Content $\rightarrow$ Design).
3. **Calendar-Day Offsets:** Counted back from posting date $F$ (`Script: F-8`, `Shoot: F-5`, `Edit: F-2`, `Content: F-5`, `Design: F-2`, `Post: F-0`). Internal default stage hours are maintained in the engine but permanently removed from all user-facing forms.
4. **Authoritative Validation Engine:** Full pre-submission validation on every row mutation, returning standardized `VALIDATION_ERROR_CODES` (`MISSING_REQUIRED_FIELDS`, `UNKNOWN_TYPE`, `PAST_DATE`, `DEADLINE_AFTER_POSTING`, `OUT_OF_ORDER_DEADLINES`, `MISSING_SOURCE_VIDEO`, `MISSING_POSTING_OWNER`, `INVALID_STAGE_OWNER`, `DUPLICATE_ROW`, `INDIVIDUAL_PLAN_ROW_LIMIT`) and warnings (`MONTH_MISMATCH`, `TIGHT_CREATION_BUFFER`, `WORKLOAD_SATURATION`).
5. **State Machine Integrity:** Shoot stage is non-review ("Done and forward", auto-unlocking Edit upon footage delivery). Review stages require workers to transition from `Not Started` $\rightarrow$ `In Progress` before submitting to `Feedback`. Approvals auto-unlock downstream stages; revisions require selecting from the exact 7 canonical root causes.
6. **Social Publishing & Dynamic Holder Derivation:** Post stages transition from `Not Started` $\rightarrow$ `In Progress` $\rightarrow$ `Published`. When all stages are finished, content piece holder derives cleanly as `'Done'` with on-time audit.
7. **Canonical Taxonomies:** Exactly 9 blocker reasons and 7 revision root causes (with "Approval delay" replacing legacy "TL approval delay").

---

### 2. Monorepo Build & Test Verification

| Component | Target Command | Result | Details |
| :--- | :--- | :---: | :--- |
| **Monorepo Typecheck** | `npm run typecheck` | **PASSED** | **0 errors** across `@mmp/shared`, `@mmp/api`, `@mmp/web`. |
| **Production Build** | `npm run build` | **PASSED** | Clean build (`@mmp/shared` tsup in 7.08s, `@mmp/web` Vite bundle in 16.35s). |
| **Unit & Integration Tests** | `npm test` | **PASSED** | **21 test files, 313 tests passed, 0 failures (100% green)**. |
| `@mmp/api` | `vitest run` | **PASSED** | 18 test files, 302 tests passed. |
| `@mmp/web` | `vitest run` | **PASSED** | 3 test files, 11 tests passed. |

#### Baseline Comparison
- **Pre-Workflow-V2 Baseline:** 20 test files, 296 tests passed (17 API / 285 tests; 3 Web / 11 tests).
- **Post-Workflow-V2 Verification:** **21 test files, 313 tests passed (+17 new comprehensive role-journey integration tests in `apps/api/test/workflow_v2_journeys.test.js`)**.

---

### 3. Role Journeys Verification Matrix

| Journey | Role Path | Test Specification | Status | Key Validations |
| :--- | :--- | :--- | :---: | :--- |
| **Journey A** | Admin $\rightarrow$ SM Manager | `apps/api/test/workflow_v2_journeys.test.js`<br>`test/e2e/workflow_v2_journeys.spec.js` | **PASSED** | Inbound access request approval; SM Manager calendar plan creation with Reel A, Reel C (source video), postable poster, and non-postable poster; auto-fill populates 4 stages for Reel A and 2 stages for non-postable poster; manual date override succeeds. |
| **Journey B** | Creative Head $\rightarrow$ SM Manager $\rightarrow$ Creative Head | `apps/api/test/workflow_v2_journeys.test.js`<br>`test/e2e/workflow_v2_journeys.spec.js` | **PASSED** | Creative Head requests changes on row 1 with feedback; rows 2-4 approved; SM Manager amends row 1 brief and resubmits; Creative Head approves; all `ContentPiece` records and `WorkItem` stages materialize with exact computed dates and owners. |
| **Journey C** | Writer $\rightarrow$ Videographer $\rightarrow$ Editor $\rightarrow$ Creative Head $\rightarrow$ SM Manager | `apps/api/test/workflow_v2_journeys.test.js`<br>`test/e2e/workflow_v2_journeys.spec.js` | **PASSED** | Script review & approval; Shoot stage "Done and forward" auto-unlocks Edit without Creative Head gate; Editor submits cut; Creative Head requests revision with canonical root cause (`Creative direction unclear`); Editor resubmits and gets approval; SM Manager publishes; Tracker holder transitions to `'Done'` on time. |
| **Journey D** | SM Manager $\rightarrow$ Creative Head $\rightarrow$ SM Manager | `apps/api/test/workflow_v2_journeys.test.js`<br>`test/e2e/workflow_v2_journeys.spec.js` | **PASSED** | Creative Head rejects whole plan with mandatory concern text; SM Manager views rejection banner with concern and resubmits with resolved topics. |
| **Journey E** | SM Manager | `apps/api/test/workflow_v2_journeys.test.js`<br>`test/e2e/workflow_v2_journeys.spec.js` | **PASSED** | Individual Work plan created with 1 row; attempting a 2nd row triggers validation error `INDIVIDUAL_PLAN_ROW_LIMIT`; single-row submission succeeds. |
| **Journey F** | Team Member $\rightarrow$ Creative Head / SM Manager | `apps/api/test/workflow_v2_journeys.test.js`<br>`test/e2e/workflow_v2_journeys.spec.js` | **PASSED** | Worker flags blocker with canonical reason (`Asset / footage missing`); notification sent to manager with "blocked since" timestamp; unblocking clears issue; overdue alert escalation verified. |
| **Journey G** | Executive | `apps/api/test/workflow_v2_journeys.test.js`<br>`test/e2e/workflow_v2_journeys.spec.js` | **PASSED** | Executive navigates read-only dashboard, plans, tracker, and reports; mutation attempts return 403 Forbidden; menu strictly $\le 8$ items. |

---

### 4. Codebase Audit & Leftover Purge
- **Hour-based wording:** Stripped from all frontend forms, table columns, and modals. Stage effort hours remain strictly encapsulated in backend capacity calculations (`DEFAULT_STAGE_HOURS`).
- **Plan Kinds:** `CALENDAR_PLAN_KINDS` restricted to `['monthly', 'individual']`. `project` kind completely excised from all models, validation rules, and UI dropdowns.
- **Department Lead References:** Completely removed; all creative reviews route exclusively to `creative_head`.
- **Pre-Approval Stage Generation:** Replaced obsolete "recommend after approval" logic. Stages and owners are populated during autofill and finalized upon plan approval.
- **Canonical Enums:** Replaced all legacy internal slugs (`assets_missing`, `waiting_approval`, `scope_change`) with the exact 9 blocker reasons and 7 revision root causes.
- **Documentation Overhaul:** Regenerated [docs/PROJECT_DOCUMENTATION.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/PROJECT_DOCUMENTATION.md) and [docs/FLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/FLOW.md) to match current Workflow V2 implementation.

---

### 5. Sample & Test Data (`../haca-test-data/`)
The required sample datasets have been created outside the git repository in `c:\Users\ADMIN\OneDrive\Desktop\HACA\TECH\haca-test-data\`:

1. **`minimal-import-template.csv` (848 bytes, 5 columns):**  
   `Posting Date`, `Topic`, `Type`, `For Team`, `Brief`. Designed for 1-click batch import where the auto-fill engine derives all stage owners, pipelines, and dates.
2. **`full-import-template.csv` (2,029 bytes, 24 columns):**  
   Comprehensive specification covering all deliverable properties, stage owners, stage deadlines, reel toggles (`Needs Script`, `Needs Shoot`), source video URL, and remarks.
3. **`november-2026-plan.csv` (3,801 bytes, 10 rows):**  
   Realistic November 2026 HACA marketing schedule containing:
   - 3 Reel variants: Reel A (Script + Shoot + Edit + Post), Reel B (Shoot + Edit + Post), Reel C (Edit + Post with source footage).
   - 3 Postable designs: Static Post, Carousel Post, Story.
   - 4 Non-postable designs: Poster, Brochure, Standee, Certificate.
4. **`validation-errors.csv` (3,819 bytes, 12 rows):**  
   Specifically crafted test rows triggering every system validation error code (`MISSING_REQUIRED_FIELDS`, `UNKNOWN_TYPE`, `PAST_DATE`, `DEADLINE_AFTER_POSTING`, `OUT_OF_ORDER_DEADLINES`, `MISSING_SOURCE_VIDEO`, `MISSING_POSTING_OWNER`, `INVALID_STAGE_OWNER`, `DUPLICATE_ROW`, `INDIVIDUAL_PLAN_ROW_LIMIT`).
5. **`manual-test-script.md` (17,623 bytes):**  
   Step-by-step manual QA test manual with pipeline and offset reference formulas, credential directory, test procedures for Journeys A through G, and sign-off criteria.

---

### 6. Final Launch Checklist

- [x] **Database & Migrations:** MongoDB running; collections aligned to Workflow V2 schemas without data loss.
- [x] **Type Safety & Build:** `npm run typecheck` passes with 0 errors; `npm run build` succeeds cleanly.
- [x] **Test Verification:** All 313 tests passing across monorepo (`npm test` exits with code 0).
- [x] **E2E & Role Journeys:** Journeys A through G validated with dedicated test suites.
- [x] **External Test Data:** 5 CSV and QA guide artifacts generated in `../haca-test-data/`.
- [x] **Documentation Alignment:** `docs/WORKFLOW.md`, `docs/PROJECT_DOCUMENTATION.md`, `docs/FLOW.md`, and `docs/PROGRESS.md` synchronized.

---

## Database Wipe: Keep Users Only (Status: READY FOR CONFIRMED RUN)

### 1. Executive Summary
Implemented and validated the safe, idempotent database wipe script (`scripts/wipe-keep-users.js`) and test suite (`apps/api/test/wipe_keep_users.test.js`):
- **User Accounts Preserved:** All 13 local user accounts (including Admin, Creative Head, SM Manager, Team Members, pending set-password invites, and Executive Director) remain completely intact with all roles, preferences, capacities, department assignments, and passwords preserved.
- **Session Security:** Session tokens are invalidated (`refreshTokens: []`) across all accounts so users sign in afresh.
- **Reference & Config Standardization:** Standardized `departments` to canonical 7, `priorities` to canonical 3 (pruning 'Urgent'), `profiles` to single-brand mode (HACA active, 6 inactive), `automationrules` to canonical 6 rules with runtime state cleared, and `reportdefinitions` to canonical 4 reports with runtime state and orphan recipients cleared.
- **Transactional Clean Slate:** Empties all transactional collections (`activityevents`, `contentpieces`, `workitems`, `calendarplans`, `assignment_overrides`, `notifications`, `accessrequests`, `counters`, `blockers`, `feedbackentries`, `revisionflags`, `scheduledreports`) while preserving collections and indexes.
- **Retired Collections Purge (`--drop-empty`):** Drops collections without an active Mongoose model (e.g. `teams`).
- **External Pre-Wipe Backup:** Automatically exports every non-empty collection as formatted JSON to a backup directory outside the repository (`../haca-backups/<timestamp>`). Refuses paths inside the repository. Aborts if any file fails or is empty.
- **Cloudinary File Audit:** Scans all deleted documents and exports deduplicated Cloudinary URLs to `cloudinary-urls.txt` in the backup directory.
- **BullMQ Queue Clearing (`--clear-queues`):** Obliterates all BullMQ Redis keys (`bull:*`) and repeatable jobs. Verified that `worker.js` re-registers all 6 repeatable jobs automatically on startup.
- **Legacy Cleanup:** Deleted old `scripts/wipe-keep-admin.js` and obsolete `wipe_keep_admin.test.js`.

### 2. Verification & Test Results
- **Isolated Test Suite:** `apps/api/test/wipe_keep_users.test.js` passed **22 / 22 tests** asserting all guards (production refusal, non-local host refusal, db-name mismatch, inside-repo backup refusal), dry-run immutability, complete user preservation, reference data resets, Cloudinary URL extraction, and strict idempotency on second runs.
- **Dry-run on Local Database:** Verified via `node scripts/wipe-keep-users.js` against `marketing_portal`.

---

## Pipeline Visibility and Status UI (Status: COMPLETE)

### 1. Preconditions Verification
- **Install & Workspace Alignment:** Confirmed intact (`@mmp/shared`, `@mmp/api`, `@mmp/web`).
- **Typecheck:** `npm run typecheck` passed cleanly with 0 errors across all workspaces.
- **Build:** `npm run build` completed cleanly (shared CJS/ESM/DTS, web Vite production build in 7.77s).
- **Tests:** `npm test` passed **328 / 328 tests across 21 test files** (18 API test files / 317 tests, 3 Web test files / 11 tests).
- **Lint:** `npm run lint` invokes `eslint .` which is not present in root devDependencies (per zero-new-dependencies constraint, noted).

---

## Plan List Fixes (Status: COMPLETE)

### 1. Executive Summary
Resolved all reported issues on the **Calendar > Plans** page for the SM Manager role, eliminating legacy terminology, fixing row count metrics, forbidding invalid zero-row plan submissions, warning on overlapping plan date ranges, blocking exact duplicate monthly periods, supporting plan deletion and renaming, and repairing orphaned zero-row records in the local database.

### 2. Step 1 Investigation Findings
1. **Origin of `PLAN-2026-10-001`:**
   - **Created In:** `apps/api/test/scope_reset_r4.test.js:191-200` at `2026-10-25T18:13:07.731Z` by SM Manager ID `6ade46b3442f9f39fb6810e0`.
   - **Why it had 0 rows:** The test added 1 row and submitted it. In `afterAll` (lines 142-143), the test cleaned up plans matching `code: /R4-/` and rows matching `topic: /R4/`. Because plan codes are generated dynamically as `PLAN-YYYY-MM-NNN`, the regex `/R4-/` failed to match, leaving the plan orphaned in MongoDB while its rows were wiped.
   - **Why it showed "Submitted for Review":** The legacy implementation of `derivePlanStatus` in `@mmp/shared` contained fallback logic: `if (!rows || rows.length === 0) return submittedAt ? 'Submitted' : 'Draft';`. Because `submittedAt` was still stamped on the document, it falsely reported "Submitted" despite having 0 rows.
2. **Missing Row Numbers on Plan Cards:**
   - In `plan.service.js:87-93`, the API returned `{ totalRows, approvedRows, pendingRows }`, while `PlansTab.tsx` accessed `p.rowCount`, `p.approvedRowCount`, `p.submittedRowCount`, `p.changesRequestedRowCount`, evaluating to `undefined` and rendering `"Total: rows · approved · submitted"`.
3. **Non-Derived Status Inconsistencies:**
   - `derivePlanStatus` trusted `submittedAt` on empty arrays.
   - `submitPlan` allowed plans with 0 rows to transition into review.

### 3. Step 2 Fixes Implemented

#### A. Shared Package (`@mmp/shared`)
- **`derivePlanStatus`:** Strictly returns `"Draft"` whenever `rows.length === 0` or `rows` is empty, completely removing reliance on `submittedAt`.
- **`formatPlanRowCounts`:** Returns `"No rows yet"` when total rows is 0. For non-zero rows, produces concise breakdown omitting zero counts (e.g. `'10 rows: 6 approved, 2 submitted, 2 changes requested'`).
- **`calendarPlanCreateSchema`:** Made `title` optional so backend can derive `<Month> <Year>` from `periodStart`.
- **Rebuilt cleanly:** ESM, CJS, and DTS bundles built via `tsup`.

#### B. Backend API (`apps/api/src/modules/calendar/`)
- **Zero-Row Submission Guard:** `submitPlan` throws 400 with exact message `'Add at least one row'` and code `'PLAN_EMPTY_ROWS'` when attempting to submit a plan with 0 rows. `validation.js` also records error `PLAN_EMPTY_ROWS`.
- **Row Metrics Computation (`computePlanRowStats`):** Unifies canonical row counts and breakdowns (`rowCount`, `totalRows`, `draftRowCount`, `submittedRowCount`, `changesRequestedRowCount`, `approvedRowCount`, `pendingRows`, and `rowCounts` dictionary).
- **Default Plan Title (`getDefaultPlanTitle`):** Defaults title to `<Month> <Year>` (e.g. `'November 2026'`) when title is omitted.
- **Period Constraints (`checkPlanPeriodConstraints`):**
  - Blocks exact duplicate monthly periods with 400 (`EXACT_DUPLICATE_PERIOD`).
  - Emits interactive warnings for overlapping periods (`OVERLAPPING_PERIOD`) containing the conflicting plan ID and code.
  - Ignores cancelled plans.
- **Plan Deletion (`deletePlan`):** Allows SM Manager or Admin to delete Draft plans with zero approved rows. Deletes all associated rows, removes the plan, and logs `ActivityEvent` with action `calendar_plan.deleted`.
- **Plan Renaming (`updatePlan`):** Allows updating title via `PATCH /api/calendar-plans/:id`.
- **Robust Code Generation (`generatePlanCode`):** Queries the maximum existing numeric sequence in the monthly prefix to prevent sequence collision upon document deletions.
- **On-Read Self-Healing:** `listPlans` and `getPlanById` automatically clear legacy `submittedAt`, `approvedAt`, `approvedById`, and `rejectionConcern` if a plan has zero rows.
- **Database Repair Utility (`repairInconsistentPlanStatuses`):** Idempotently repairs plans with zero rows and non-Draft stored fields in the local database.

#### C. Frontend UI (`apps/web/src/pages/calendar/PlansTab.tsx`)
- **Plan Card Rendering:** Displays human-readable row metrics via `formatPlanRowCounts` (or `"No rows yet"`). Displays amber pill badge when `submissionWarnings` includes an overlapping period.
- **Header Actions:** Added Rename Plan button (`Edit2`) and Delete Plan button (`Trash2`).
- **Overlapping Period Banner:** Renders amber warning banner in the plan detail header linking directly to conflicting plans.
- **Submit Button Guard:** Disabled with tooltip and amber alert message `'Add at least one row'` when row count is 0.
- **Create Plan Modal:**
  - Label changed to **"Plan Name"** with placeholder `e.g. November 2026`.
  - Date change auto-populates `<Month> <Year>` if title is blank or unmodified.
  - Plan Kind options: `"Monthly Content Plan"` (`monthly`) and `"Individual Work Plan"` (`individual`) (removed `project`).
  - Notes placeholder updated to `"Content goals, theme or remarks..."`.
- **Rename Plan Modal:** Added dialog with autofocus input and validation to rename plans without page reload.
- **Page Header Text:** Updated to: `"Build the monthly content calendar, check your spreadsheet before upload, and follow the Creative Head's approval row by row."`.

#### D. Comprehensive Wording Sweep
- Replaced all instances of `HACA FORGE` with `HACA Marketing OS` in `<title>`, `<meta>`, `LoginPage.tsx`, `SetPasswordPage.tsx`, `Layout.tsx`, `service.js`, `mailer.js`, and `README.md`.
- Search placeholder updated from `'Search cases & requests'` to `'Search tasks and content'`.
- Eradicated ticketing terminology (`case`, `ticket`, `campaign` outside proper contexts) across user-facing views.

#### E. Local Database Repair
- Executed `repairInconsistentPlanStatuses()` against local MongoDB `marketing_portal`:
  - Repaired `PLAN-2026-10-001`: cleared `submittedAt`, `approvedAt`, `approvedById`.
  - Repaired `PLAN-2026-10-003`: cleared `submittedAt`, `approvedAt`, `approvedById`.
  - Confirmed subsequent execution is 100% idempotent (`repairedCount: 0`).
  - Cleaned leftover orphaned test plans from previous test trajectories.

#### F. Automated Testing (`apps/api/test/plan_fixes.test.js`)
Created dedicated 18-test test suite asserting:
1. `formatPlanRowCounts`: zero rows returns `'No rows yet'`, formats counts cleanly omitting 0s.
2. `computePlanRowStats`: provides canonical and breakdown fields.
3. `derivePlanStatus`: strictly returns `'Draft'` for empty rows regardless of timestamps; correct status derivation across approved, mixed, changes requested, submitted, and draft.
4. Empty plan submission blocked with exact message `'Add at least one row'` (`PLAN_EMPTY_ROWS`).
5. Exact duplicate monthly period blocked with 400 (`EXACT_DUPLICATE_PERIOD`).
6. Overlapping monthly period returns warning linking to conflicting plan; cancelled plans ignored.
7. Default plan title derived as `<Month> <Year>` when omitted; title editing via PATCH.
8. Delete allowed only for Draft plans without approved rows; blocked for approved rows; logs `calendar_plan.deleted` in `ActivityEvent`.
9. Database repair utility repairs inconsistent plans and logs changes.
10. UI Text Scan verifies zero forbidden strings (`FORGE`, `Search cases & requests`, old subheader text) in web pages.

### 4. Final Quality Gates
- **`npm run typecheck`:** **PASSED** (0 errors across `@mmp/shared`, `@mmp/api`, `@mmp/web`).
- **`npm run build`:** **PASSED** (shared ESM/CJS/DTS and web production bundle compiled cleanly in 12.26s).
- **`npm test`:** **PASSED** (**346 / 346 tests passed across 22 test files** — 19 API test files with 335 tests, 3 Web test files with 11 tests).

---

## WORKSPACES WS3: Review Studio & Media Workspaces (Status: COMPLETE)

### 1. Executive Summary
Completed Phase WS3 according to `docs/WORKSPACES.md` (Sections 3 and 4), `docs/UI_STANDARDS.md`, and strict system constraints.
Zero new dependencies were added: built exclusively using native HTML5 `<video>`, browser DOM APIs, and existing upload signing endpoints.
The system delivers a unified, high-throughput Review Studio cockpit at `/feedback` for Creative Head and Admin, plus dedicated role workspaces for Videographer (`Shoot`), Video Editor (`Edit`), Graphic Designer (`Design`), and Publisher (`Post`), with an upstream outputs viewer (`EarlierOutputsViewer`) and role-based workspace router (`MediaWorkspacePage`).

---

### 2. Capabilities Delivered

#### A. Review Studio Cockpit (`/feedback` - `ReviewStudioPage.tsx`)
1. **Waiting for Approval Queue:**
   - FIFO sorting (oldest submissions first), elapsed waiting days display (`Waiting for X days in queue`), step and owner information.
   - Breadcrumb navigation: `< Prev [X of Y] Next >` with auto-advance to next pending item upon approval or revision request.
2. **Four Specialized Media Viewers:**
   - **Document Viewer (`DocumentViewer.tsx`):**
     - Formatted script/copy reader with version badge.
     - Inline text diff compare mode (`diffUtils.ts`) highlighting additions in green and deletions in line-through red.
     - Text selection floating comment popover anchoring text to review threads.
   - **Video Player Viewer (`VideoPlayerViewer.tsx`):**
     - Native HTML5 video player with speed toggles ($0.5\times$, $1.0\times$, $1.25\times$, $1.5\times$, $2.0\times$), seekbar, and fullscreen.
     - Timecode-pinned comments with interactive pins directly on the timeline seekbar jumping playback to that exact second.
   - **Image & Carousel Viewer (`ImageViewer.tsx`):**
     - Pan & Zoom controls ($50\%$ to $300\%$) with reset.
     - Coordinate-pinned comments (`x%, y%`) with clickable numbered pins.
     - Thumbnail carousel gallery with keyboard navigation and slide indicator (`Slide X of Y`).
   - **Link Opener Viewer (`LinkOpenerViewer.tsx`):**
     - Safe fallback card displaying destination URL, deliverable notes, and secure "Open in New Tab" target link.
3. **Right Context Sidebar (`ReviewStudioSidebar.tsx`):**
   - Accessible tab navigation (`Comments`, `Brief`, `Outputs`, `Versions`).
   - Upstream deliverable outputs viewer with script / footage / graphic downloads.
   - Version history switcher with diff comparison toggle.
4. **Persistent Decision Bar (`DecisionBar.tsx`):**
   - **Mandatory 1 to 5 Star Rating:** Approve button is strictly disabled until a 1–5 score is selected.
   - Optional qualitative feedback note and quality tags (`Sharp Hook`, `Clean Audio`, `On Brand`, etc.).
   - **Request Revision Guard:** Blocked unless at least one anchored comment exists or a revision note is provided. Dropdown for 7 canonical revision root causes.
   - **Keyboard Shortcuts:** `1-5` (rating), `A` (approve), `R` (request revision), `[` (previous item), `]` (next item).

---

#### B. Media Role Workspaces (`apps/web/src/pages/work/workspaces/`)
1. **Videographer Workspace (`ShootWorkspace.tsx`):**
   - Creative brief and target shoot date docked alongside read-only approved script and auto-generated shot list tabs.
   - Chunked resilient video upload engine supporting 1–10 clips up to 500 MB each with progress tracking, pause, and retry.
   - Camera roll and mobile file support; shoot notes capture; submit for approval and link fallback.
2. **Video Editor Workspace (`EditWorkspace.tsx`):**
   - Docked tabs for approved script and raw shoot footage clips.
   - Video cut upload with client-side pre-flight checks: warning if aspect ratio $\ne 9:16$ (vertical reel) or duration $> 90$s.
   - Interactive revision feedback checklist with live counter (`X of Y resolved`) and `role="checkbox"`.
3. **Graphic Designer Workspace (`DesignWorkspace.tsx`):**
   - Docked approved copy panel with quick "Copy Headline" and "Copy Body" buttons.
   - Platform size guide reference cards (Instagram 1080x1350 / 1080x1080, LinkedIn 1200x628, YouTube 1280x720) with dimension mismatch warnings.
   - Image (up to 20 MB) and PDF (up to 50 MB) upload, multi-slide thumbnail gallery with reordering controls.
4. **Publisher Workspace (`PostWorkspace.tsx`):**
   - Download approved deliverable master button.
   - Copy caption and copy hashtags buttons directly from approved script metadata.
   - 4-item pre-publish platform checklist (Aspect ratio verified, Audio synced, Caption/tags pasted, Thumbnail set).
   - Live published URL input and publication datetime picker; "Mark as Posted" action.
5. **Upstream Outputs & Workspace Router:**
   - `EarlierOutputsViewer.tsx`: Read-only viewer for cross-stage collaboration and deliverable file downloads.
   - `MediaWorkspacePage.tsx`: Dynamic role and stage router mounted at `/work/:id/workspace` routing automatically to Shoot, Edit, Design, Post, or Writing Studio based on deliverable stage.

---

---

### 3. Verification & Test Results
- **API Tests:** `apps/api/test/review_studio_and_workspaces.test.js` (**6/6 tests pass**).
- **Web Component Tests:**
  - `apps/web/src/pages/work/workspaces/__tests__/Workspaces.test.tsx` (**5/5 tests pass**).
  - `apps/web/src/pages/feedback/review-studio/__tests__/ReviewStudio.test.tsx` (**10/10 tests pass**).

---

## Workspaces Phase WS4: Ratings in Profiles, Polish, Guardrails and End-to-End Journeys (Status: COMPLETE & VERIFIED)

### 1. Architectural Summary & Delivered Features

#### A. Ratings & Feedback Component & Scoped Profile Views
1. **`RatingsFeedbackSection.tsx` Component:**
   - **Metrics Bar:** 4 cards displaying Rolling 30-Day Average, Rolling 90-Day Average, All-Time Average, and Total Ratings Count.
   - **Monthly Trend Chart:** Mini 6-month historical sparkline chart showing monthly averages and rating counts with tooltips.
   - **Score Distribution Bars:** 5-tier distribution bar breakdown displaying counts and percentages of 5★, 4★, 3★, 2★, and 1★ ratings.
   - **Breakdown by Step Type:** Card displaying average score across each pipeline stage (`Script`, `Shoot`, `Edit`, `Design`, `Post`).
   - **Recent Creative Feedback:** Chronological list of qualitative reviews with deliverable content title, date, rating score, tags, and rater name.
   - **3-Rating Minimum Threshold:** Shows exact card with `"Not enough ratings yet"` and coaching baseline explanation until $\ge 3$ ratings exist.
   - **Mark as Seen:** Optimistic action allowing creative workers to acknowledge new review feedback.
   - **Edit Rating Modal:** Creative Head or Admin can correct a previously submitted rating with mandatory reason field; every correction updates `editedLog` and dispatches `ActivityEvent`.
2. **Page Integrations:**
   - **My Account (`MyAccountPage.tsx`):** Creative workers inspect their own ratings, feedback, and trends.
   - **People Directory (`UsersPage.tsx`):** Leaders (`creative_head`, `sm_manager`, `admin`, `executive`) can click "Ratings" on user cards to inspect performance.
   - **Step Detail (`WorkDetailPage.tsx`):** Completed work items display the quality score, qualitative feedback note, quality tags, and seen marker.

#### B. Institutional Guardrails & Privacy Protections
1. **Zero Leaderboards:** No leaderboards exist anywhere in the platform UI or API.
2. **Zero Rankings or Percentiles:** No ranking endpoints, no cross-person comparisons, no "top performers" lists.
3. **No Ratings Export by Person:** Exports exclude individual worker ratings.
4. **Strict Role-Scoping:**
   - Workers (`team_member`) can **only** access and view their own ratings. Attempting to query another worker's ratings returns `HTTP 403 FORBIDDEN_RATINGS_ACCESS`.
   - Authorized Leaders (`creative_head`, `sm_manager`, `admin`) can view team member ratings for growth and coaching.
   - Executive (`executive`) has read-only access to view ratings across all profiles; mutation attempts return `HTTP 403`.
5. **Decoupled from Compensation:** Prominent notice on profile section: *"Ratings evaluate the craftsmanship and creative quality of approved work for coaching and growth. They are strictly decoupled from compensation, pay, or financial incentives."*

#### C. Aggregated Report Baselines
- **Creative Production Report (`/api/reports/view/creative_production`):** Added `teamAverageRating`, `averageRatingPerStepType`, and a strictly aggregated *"Quality Ratings by Step Type (Aggregated Baseline)"* table (never per-person).
- **Team Performance Digest (`/api/reports/view/team_performance`):** Added `teamAverageQualityRating`, `averageRatingPerStepType`, and a strictly aggregated *"Stage Quality Ratings (Aggregated Baseline)"* section.

#### D. Regression Sweep & Polish
- **Link-Only Placeholders:** Purged old link-only submission placeholders in favor of typed payloads.
- **Role & Label Modernization:** Cleaned obsolete `Lead` labels (renamed to `isReviewerOrAdmin`), verified 0 hits for `FORGE`.
- **Responsive Layouts & Keyboard Order:** Verified mobile stacked viewports, touch targets ($\ge 44$px), and tab orders across Writing Studio, Review Studio, and Media Workspaces.

---

### 2. Verified Test Suites & Monorepo Statistics

| Workspace | Test Suite File | Tests | Status |
|---|---|---|---|
| **`@mmp/api`** | `apps/api/test/workspaces_ws4_ratings.test.js` | 20 | **PASSED (100%)** |
| **`@mmp/api`** | `apps/api/test/workspaces_ws4_journeys.test.js` | 16 | **PASSED (100%)** |
| **`@mmp/api`** | `apps/api/test/workspaces_ws1_submissions.test.js` | 17 | **PASSED (100%)** |
| **`@mmp/api`** | `apps/api/test/workspaces_ws2_review.test.js` | 16 | **PASSED (100%)** |
| **`@mmp/api`** | `apps/api/test/workspaces_ws3_media.test.js` | 15 | **PASSED (100%)** |
| **`@mmp/api`** | 20 additional backend suites | 339 | **PASSED (100%)** |
| **`@mmp/web`** | `apps/web/src/components/__tests__/RatingsFeedbackSection.test.tsx` | 7 | **PASSED (100%)** |
| **`@mmp/web`** | `apps/web/src/pages/feedback/review-studio/__tests__/ReviewStudio.test.tsx` | 10 | **PASSED (100%)** |
| **`@mmp/web`** | `apps/web/src/pages/work/workspaces/__tests__/Workspaces.test.tsx` | 5 | **PASSED (100%)** |
| **`@mmp/web`** | 5 additional frontend suites | 29 | **PASSED (100%)** |
| **E2E** | `test/e2e/workspaces_ws4_journeys.spec.js` | Specs A–G | **VERIFIED** |
| **Total** | **33 Test Files** | **474 Tests** | **100% PASSED** |

### 3. Playwright & Vitest Journeys (A through G) Verified
- **Journey A (Writer Studio & Revision):** Writer authors draft, submits v1, Creative Head requests revision with anchored text comment, Writer resolves comment and submits v2, Creative Head approves with 5★ rating and `Great hook` tag.
- **Journey B (Shooter & Editor Loop):** Shooter uploads footage package and is approved with 5★ rating; Editor submits cut v1, Creative Head pins timecode comment at second 4 and requests revision; Editor resubmits cut v2 and is approved with 4★ rating.
- **Journey C (Designer Workspace):** Designer submits multi-slide carousel and Creative Head approves with 5★ rating.
- **Journey D (Posting Owner):** Posting owner validates checklist, enters live published URL, and marks deliverable as `Published`.
- **Journey E (Profile Ratings Visibility):** Each worker inspects their own ratings in My Account; Creative Head can inspect all worker profiles.
- **Journey F (Anti-Comparison & Privacy Guardrail):** Cross-worker rating inspection requests strictly return `HTTP 403 FORBIDDEN_RATINGS_ACCESS`.
- **Journey G (Executive Read-Only Walk):** Executive inspects all ratings and deliverables in read-only mode; approval or edit mutations return `HTTP 403`.

---

### 4. Final Launch Checklist
- [x] **Zero New Dependencies:** Implemented strictly using existing workspace dependencies.
- [x] **Monorepo Build:** `npm run build` succeeds cleanly across all packages.
- [x] **Type Safety:** `npm run typecheck` exits with code 0 (zero TypeScript errors).
- [x] **Automated Tests:** 474/474 tests pass across 33 test suites.
- [x] **Strict Privacy Enforced:** Zero leaderboards, zero worker rankings, zero per-person ratings export.
- [x] **Documentation Synchronized:** `docs/WORKSPACES.md`, `docs/PROJECT_DOCUMENTATION.md`, and `docs/PROGRESS.md` fully up to date.

---

## Deliverable Type Normalization & Submission Healing Fix

### 1. Root Cause
1. In `apps/web/src/pages/calendar/PlansTab.tsx`, the Individual Plan creation modal's dropdown contained legacy deliverable type options (`<option value="Reel / Video">`, `<option value="Carousel">`, `<option value="Motion Graphic">`, `<option value="Article / Blog">`) rather than the 15 canonical deliverable types from `DELIVERABLE_TYPES_CONFIG`.
2. When creating an individual deliverable with `"Reel / Video"`, the deliverable was stored with `type: "Reel / Video"`.
3. In `packages/shared/src/index.ts`, `normalizeWorkType` did not map `"Reel / Video"` to canonical `"Reel"`.
4. When calling `/api/calendar-plans/:id/submit`, `validation.js` rejected the row with `HTTP 400 PLAN_SUBMISSION_BLOCKED` (`UNKNOWN_TYPE: Type "Reel / Video" is not one of the 15 supported deliverable types.`).
5. A spurious `MONTH_MISMATCH` warning was also triggered due to comparing timestamped dates without start/end of day boundaries.

### 2. Solution Implemented
1. **`@mmp/shared`**:
   - Updated `WORK_TYPE_ALIASES` in `packages/shared/src/index.ts` to map `"Reel / Video"`, `"reel / video"`, `"Video"`, `"Motion Graphic"` to `"Reel"`, `"Carousel"` to `"Carousel Post"`, and `"Article / Blog"` to `"Other"`.
   - Enhanced `normalizeWorkType` to check `CANONICAL_DELIVERABLE_TYPES` and apply case-insensitive pattern matching.
   - Re-compiled `@mmp/shared` cleanly.
2. **`@mmp/api`**:
   - Added virtual `type` getter/setter in `apps/api/src/modules/calendar/contentPiece.model.js` mapped to `contentType`.
   - Updated `submitPlan` in `apps/api/src/modules/calendar/plan.service.js` to heal incomplete or aliased draft rows (normalizing `type`/`contentType` to canonical types and ensuring Reel default shoot stage configuration).
   - Updated `createPlan` to normalize types and assign default `needsScript`/`needsShoot` for Reels when unassigned.
   - Refined `MONTH_MISMATCH` in `apps/api/src/modules/calendar/validation.js` using start-of-day boundaries (`pStartMidnight`, `pEndMidnight`).
3. **`@mmp/web`**:
   - Updated the Individual Plan modal dropdown in `apps/web/src/pages/calendar/PlansTab.tsx` to list all 15 canonical deliverable types from `DELIVERABLE_TYPES_CONFIG`.
   - Ensured creation payload normalizes the deliverable type and assigns script/shoot flags.
4. **Automated Verification**:
   - Added automated regression test in `apps/api/test/plan_fixes.test.js` asserting that plans with `"Reel / Video"` rows heal and submit successfully with HTTP 200.
   - Verified that all 34 API test files (575 tests) and all 16 web test files (109 tests) pass with 100% green status (684 total tests).
   - Verified clean typecheck (`npm run typecheck`) and web production build (`npm run build`).


