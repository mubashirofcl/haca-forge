# HACA Marketing OS: Antigravity Build Playbook

*How to convert the current HACA FORGE into HACA Marketing OS (V1 Team Workspace), phase by phase, with Antigravity.* *Source of truth: HACA Marketing OS Build Specification V1.0 (in docs/) and the Project Report. Nothing outside that specification is built.*

**How to use this file:** set up the workspace (Section 0), save the two rules files (Section 1), run the kickoff prompt (Section 2), then run the phase prompts (Section 3) **one phase per conversation**, in order. Section 4 has reusable prompts for reviews, bug fixes and handoffs.

## 0. Setup checklist (do this once)

1. **Back up first.** Commit everything. Tag the current build: `git tag forge-v1-final`. Create a branch: `git checkout -b marketing-os`. Back up the database: `mongodump --uri '<dev uri>' --out ./backup-before-marketing-os`.
2. **Open the repo** in Antigravity as the workspace folder.
3. **Add the documents** to `docs/`:
   - `HACA-Marketing-OS-Build-Spec.pdf` (the Head's specification)
   - `PROJECT_REPORT.md` (export of the Project Report doc)
   - `CURRENT_ROLES_REFERENCE.md` (the FORGE reference manual, used for the audit)
4. **Replace the rules.** Move the old files in `.agent/rules/` to `docs/archive/`, then save the two files from Section 1 in `.agent/rules/`. Move the old `docs/PROGRESS.md` to `docs/archive/PROGRESS_FORGE.md`.
5. **Settings:** Planning mode for every phase. Agent autonomy: Request review. Allow list: `npm test`, `npm run lint`, `npm run typecheck`, `git status`, `git diff`. Deny list: `rm -rf`, `git push --force`, `git reset --hard`, anything touching production databases.
6. **Local services:** Node 22 LTS and Docker (MongoDB and Redis), or a MongoDB Atlas dev cluster.
7. **Never paste real secrets or LSQ credentials into prompts.** Use git-ignored `.env` files.
8. **Workflow per phase:** paste the phase prompt in Planning mode, read the plan and fix anything wrong before approving, let the agent build, run the app and tests yourself, run the review prompt (4.2), commit (`git commit -m 'phase N: ...'`), tag (`git tag mos-phase-N-done`), then start a **new conversation** for the next phase.
9. **Optional:** save the review prompt and the handoff prompt in `.agent/workflows/` so you can trigger them with `/`.
10. **Send the Head the open questions** (the kickoff creates `docs/OPEN_QUESTIONS.md`). The working defaults in the rules file let you start without waiting, but Phase 8 needs the LSQ answers.

## 1. Rules files

### 1.1 `.agent/rules/00-project-context.md`

```markdown
# Project context: HACA Marketing OS (V1 Team Workspace)

One system where the HACA marketing team plans, assigns, produces, approves and reports marketing work, with LSQ
lead data shown next to that work. Source of truth: docs/HACA-Marketing-OS-Build-Spec.pdf and docs/PROJECT_REPORT.md.
If this file and the specification disagree, stop and ask.

## Scope rule
Build ONLY what the specification defines. Do not re-add retired HACA FORGE modules (request intake and triage,
requester roles, pipeline templates and handoffs, shoot planner, time tracking, leave, file library, performance ads,
video review studio, calendar import, master-data editor, audit log screens). They live in git tag forge-v1-final.
Out of scope for V1: leaderboard, content repurposing, campaign templates and auto task structure, dependency
mapping, Weekly Marketing Meeting Mode. Do not add features, screens or fields that the specification does not need.

## Architecture
One centralized system. Profile (brand) is a FILTER dimension on shared data, never a separate database or tenant.
Every core document carries profileId. Permissions are enforced at the QUERY layer using the user's profileAccess[].

## Roles (exact keys)
marketing_head, team_lead, team_member. Role sets breadth; profileAccess[] sets which brands it applies to.
- marketing_head: all profiles by default, everyone, org-wide dashboard, creates and assigns work in any profile in
  scope, overrides auto-assignment, approves and gives feedback, classifies revision root cause, full analytics, full
  Lead Funnel and Data Center, full Reports and Automation, enters OKR and Targets, manages people and reference data.
- team_lead: assigned profiles, own team (direct reports via reportsToIds plus same department), team KPIs, creates
  and assigns work for own team, overrides auto-assignment, approves own team's work, classifies root cause, own-team
  analytics, Lead Funnel and Data Center view only for own profiles, views own team's scheduled reports, views targets.
- team_member: assigned profiles, self only, personal priorities, cannot create or assign (can request work via a Team
  Lead), responds to feedback, own stats only, Lead Funnel/Data Center/Reports/Targets hidden.
- No Admin role. CEO and Business Head are report recipients by email, not users.
- A team_member may report to several team leads (reportsToIds[]). Any of them may assign to, review and see that member.

## Reference data (fixed, seeded)
Profiles (7): HACA, HACA Mideast, HACA Marketing School, HACA Marketing School EN, HACA Design School, HACA Design School EN,
HACA Tech School.
Departments (7): Design, Video Production, Social Media, SEO & Content, WhatsApp, Performance Marketing, Tech.
Job roles (13): SEO Specialist, Social Specialist, UI Designer, Writer, Developer, Social Media Manager, Designer, Video Editor,
Creative Manager (TL), Design Lead (TL), YouTube Strategist, WhatsApp Marketer, Performance Marketer.
Programs: AI Integrated Graphic Design, UI/UX Design + AI, Creative Design & Communication, AI Integrated Video Editing Mastery,
Branding & Identity Online Program.
Work types (14): Reel, Ad Creative, Landing Page, Carousel, Post, Blog, Email, WhatsApp Blast, Ad Set, YouTube Short/Video,
SEO Audit, Copy, Video Ad, Internal Report.
Priorities: High, Medium, Low. Campaign status: In Progress, At Risk, Completed. Goal types: Leads, Reactivations, Enrollments.
Expected outcomes: Lead Generation, Brand Awareness, Engagement, SEO Ranking, Nurture, Conversion, Reactivation, Ops.
Blocker reasons (9): Waiting for feedback, Waiting for content, Waiting for data, Technical issue, Dependency,
Client/business approval, Resource issue, Unclear requirement, Other (free text only here).
Revision root causes (7): Brief unclear, Creative direction unclear, Skill gap, Feedback inconsistency, Excessive scope change,
TL approval delay, Client/business requirement changed.
Lead sources (19): SMM YouTube, SMM Instagram, Online Campaigns (SMM), Facebook Lead Ads, Social Media Re-engaged Leads,
Meta Re-Engaged Leads, Google Ads, Inbound Phone Calls, WhatsApp Reactivation, WhatsApp Inbound, Student Referral,
Staff Referral, SEO, PR, Website Leads, Offline Campaigns, Walk-in, Outbound Phone Calls, Workshops/Webinars.
Funnel stages (12): Total Leads, Not Contacted, Not Answered, Interested, Qualified Leads, Call Back, Payment Received,
Not Interested, Not a Potential, Not Answered (Multiple), Reconnected, Not Eligible.

## Core model
Entities: Profile, Department, Person, MonthlyTarget, Campaign, WorkItem, FeedbackEntry, RevisionFlag, Blocker,
AssignmentOverride, Lead, AutomationRule, ReportDefinition, ActivityEvent, Notification, WorkRequest.
- Traceability is enforced at creation: Campaign requires targetId (MonthlyTarget) and relatedOKR. WorkItem requires
  campaignId. relatedOKR and relatedTarget are copied from the campaign and are read-only on the work item. No orphans.
- Person: jobRole, departmentId, role, profileAccess[], reportsToIds[], weeklyCapacityHours (default 40), lastProfileId.
  Derived: workloadPct = sum(estimatedEffortHrs of open owned work items) / weeklyCapacityHours; avgRevisions = rolling
  90 days.
- WorkItem statuses: Not Started, In Progress, Feedback, Pending, Blocked, Approved, Published. Overdue is COMPUTED
  (deadline passed and status not Approved or Published). It is never stored and never a transition target.
- Transitions: Not Started to In Progress (owner); In Progress to Feedback (owner submits); Feedback to Approved or back to
  In Progress (reviewer, roundStatus Approved or Revision Required); Approved to Published (owner or reviewer); any open
  status to Blocked (owner, reason required) and back; In Progress to Pending and back (owner).
- All status changes go through ONE transition service that checks permission and scope, sets the timeline timestamps and
  writes an ActivityEvent. No direct status writes elsewhere.

## Business rules
- Auto-assignment (work item created without an owner): candidates in the department for the work type, workloadPct below 85,
  enough unallocated capacity before the deadline. Rank by lowest workloadPct, then lowest avgRevisions, then earliest
  availability. NEVER assign silently: return the recommendation and its reason. Head or Team Lead may override before
  creation. Every override is logged in AssignmentOverride (who, from, to).
- Workload bands: Healthy below 65, High 65 to 85, Overloaded above 85.
- Feedback: each round has the reviewer entry (roundStatus) and, if revision was required, the owner's response (isResponse)
  before the next round. revisions = number of rounds marked Revision Required. History is never overwritten.
- Revision flag: revisions exceed the owner's own rolling avgRevisions by more than 1, or reach 4, whichever comes first. Team
  Lead classifies root cause. Escalate to Marketing Head when a flag is unclassified for more than 48 hours, or the same
  person is flagged 2 or more times in a rolling 30 days. Never link performance data to incentives.
- Blockers: owner marks Blocked with a reason. For Waiting for content, feedback or data the owner MUST name the dependency
  owner, who is notified immediately (not the requester).
- LSQ is read-authoritative: no route may create or edit a lead's status. CPL = spend / ad leads, CPQL = spend / qualified
  leads, Qualified Lead % = qualified / total.
- Performance has five dimensions (Output, Efficiency, Quality, Collaboration, Business impact). Not 'tasks completed'.
  No leaderboard and no cross-person ranking UI.

## Automation rules (AutomationRule records, active or paused)
month_end_report (last day 11:59pm), overdue_escalation (owner at once, Team Lead after 4 hours), todo_escalation (no status
change for N days), blocker_dependency_alert, revision_pattern_flag, lsq_live_sync, weekly_report (Monday 8:00am).
Campaign task auto-structure is V1.1 and NOT built.

## Reports (ReportDefinition records)
Weekly Marketing Report (Mon 8:00), Monthly Performance Scorecard (last day), Creative Production Report (Fri 18:00), Lead
Funnel and CPL Report (Mon 9:00), Team Performance Digest (1st of month), Campaign Deep-Dive (on demand).

## Screens (14) and routes
/login, /dashboard, /my-work, /calendar, /campaigns, /campaigns/:id, /work/:id, /feedback, /workload, /todo, /issues, /leads,
/data-center, /reports. Plus enablers: People setup (/people) and a generic filtered Work list (/work) for drill-down.
Head and Team Lead land on /dashboard, Team Member on /my-work.

## Working assumptions (until the Marketing Head decides; change here when decided)
- Pending status means waiting but not blocked. Published is set by the owner or a reviewer after Approved.
- Monthly Targets are edited inside the Team Dashboard target section by the Head. Spend is entered manually on the Campaign.
- Team Lead views own team's scheduled reports read-only; Head resolves Data Center issues.
- Migrated users get access to all profiles until the Head edits them. Capacity is a flat 40 hours until given per role.
- Work type to department: Video Production (Reel, Video Ad, YouTube Short/Video), Design (Ad Creative, Carousel, Landing Page),
  Social Media (Post), SEO & Content (Blog, Email, Copy, SEO Audit), WhatsApp (WhatsApp Blast), Performance Marketing (Ad Set,
  Internal Report).
- At Risk KPI: open item due within 3 days that is Not Started, Pending or Blocked.
- Only the WhatsApp Inbound source creates a task automatically (to the WhatsApp Marketer).
- Report timezone comes from env REPORT_TIMEZONE.
```

### 1.2 `.agent/rules/01-engineering-rules.md`

```markdown
# Engineering rules (always follow)

## Stack (kept from HACA FORGE, do not swap without asking)
- Monorepo with npm workspaces: apps/api, apps/web, packages/shared. Node 22 LTS.
- Backend: Express 5, MongoDB with Mongoose, JavaScript (ESM). Do not convert the backend to TypeScript.
- Frontend: React 18, Vite, TypeScript (strict), Tailwind, existing glass UI components, TanStack Query and Table,
  React Hook Form + Zod, React Router, Recharts, FullCalendar.
- packages/shared (@mmp/shared): role keys, permission keys and the role-to-permission map, enums, Zod schemas, shared
  metric formulas. Built with tsup.
- Validation: Zod on every body, query and params. Permissions: CASL. Jobs: BullMQ + Redis. Realtime: Socket.io.
- Email only through lib/mailer.js (smtp, resend, console). Files: Cloudinary signed direct upload.
- No new dependencies unless a phase requires it. Say why when adding one.

## Architecture
- API modules under apps/api/src/modules/<name>/ with routes, controller, service, model, schema. Thin controllers.
- ALL data access goes through resolveScope(user, filters). It returns allowed profileIds and the person scope (all, team or
  self). Every list, aggregate, report and export uses it. No route builds its own profile or team filter.
- Every route: authentication + requirePermission('key') + Zod validation. Scoping is enforced in database queries, not only in
  the UI. A route is never 'authenticated only' unless it touches the caller's own profile.
- One shared filter schema (profile, department, owner, campaign, date or month, status) parsed once and used by all list endpoints.
- One transition service for work item status. Every change writes an ActivityEvent.
- Metric formulas are defined once in shared or in modules/<name>/metrics.js with comments, and documented in docs/METRICS.md.
- Leads are read-only: no endpoint may change a lead's LSQ fields. Use idempotent upserts keyed by lsqLeadId.
- Scheduled and event jobs read their AutomationRule.active flag, record lastRunAt and use idempotency keys so restarts
  never send duplicate alerts.
- Use ObjectId references. Add the indexes the phase needs (profileId first in compound indexes on core collections).
- API errors use one JSON shape: { error: { code, message, details? } }.

## Security (unchanged from FORGE)
- JWT in httpOnly, Secure, SameSite cookies; short access token plus rotating refresh token.
- helmet, rate limits on login, mongo sanitize, hpp, strict CORS with credentials.
- No default passwords or secrets in code or docs. Config through validated env (apps/api/src/config/env.js), committed
  .env.example. Invite and reset tokens stored hashed, single use, 48 hours.
- No seed or debug endpoints in production builds. Logs never contain secrets or tokens.

## Frontend conventions
- One global filter context (Profile, Department, Owner, Campaign, Date, Status) synced to the URL. Changing Profile updates
  every widget on the screen in one state change. Never a per-widget profile filter.
- Every KPI, row and name is a link to the next record (Business, Profile, Department, Member, Project, Work, Feedback, Result).
- One ProtectedRoute using permissions. The API is the real gate.
- Every list and page has loading, empty and error states. Empty states read as clarity, not surveillance, for example:
  'You have no active priorities. Check the team plan or ask your TL for upcoming work.'
- Responsive down to 360 px, keyboard accessible. Reuse the existing glass UI components and tokens.
- No localStorage for auth tokens.

## Quality
- Tests with every feature: Vitest + Supertest (API), Vitest + React Testing Library (UI). Include permission and scope
  denial cases for every role, not only happy paths.
- Run lint, typecheck and tests before saying a task is done. Fix failures. Never skip or weaken tests.
- Small focused commits. No TODOs without a note in docs/PROGRESS.md.

## Working style
- Planning mode: write the plan first with assumptions and open questions, then build.
- If something is ambiguous or conflicts with the specification, ask. Do not guess and do not add features.
- Do not change files outside the current phase unless required, and say why.
- Never invent LSQ API shapes. Use the adapter interface and fixtures until real docs and credentials exist.
- End of each phase: update docs/PROGRESS.md (done, decisions, deviations, known gaps, how to run and test, migrations) and
  list the manual checks to perform.
```

## 2. Kickoff prompt (planning only, no code)

Run once in Planning mode. It produces the audit and the master plan.

```text
You are a senior full-stack engineer (MERN) joining a project in progress. Read .agent/rules/ first, then everything in
docs/ (the HACA Marketing OS specification PDF, PROJECT_REPORT.md, CURRENT_ROLES_REFERENCE.md), then inspect the repository.

GOAL
We are converting the built HACA FORGE (a request-and-pipeline portal) into HACA Marketing OS exactly as the specification
defines. DO NOT WRITE OR CHANGE ANY CODE IN THIS TASK.

DELIVERABLES (markdown files in docs/)
1. docs/AUDIT.md
   - Module by module (api and web): what exists today versus what the specification needs, with real file paths and model names.
   - Classify every module and page as KEEP (infrastructure), CHANGE (with what changes), or RETIRE (not in the specification).
   - For every place that hard-codes role keys (lead, worker, sm_manager, dept_lead, dept_staff, viewer, admin), team keys
     (content, graphics, cinematography, editor) or FORGE statuses, list file and line.
   - Risks: anything that makes the conversion unsafe (shared imports across modules, tests tied to retired modules, jobs that
     reference retired models, seed scripts).
2. docs/BUILD_PLAN.md
   - Confirm or adjust Phases 0 to 9: 0 archive and retire; 1 reference data, profiles, people, access scope; 2 targets and
     campaigns; 3 work items, My Work, calendar, todo; 4 auto-assignment and workload; 5 feedback, revision flags, blockers;
     6 global filter and Team Dashboard; 7 automation, reports and notifications; 8 LSQ; 9 performance dimensions, hardening, QA.
   - For each phase: scope, backend, frontend, data model changes, migrations, tests, risks, acceptance criteria, dependencies.
   - A data migration plan: User to Person (role mapping, default profileAccess), teams to departments, what to archive and not
     migrate (requests, content items, tasks, deliverables).
3. docs/OPEN_QUESTIONS.md
   - Every ambiguity, each with your recommended default. Include at least: requests removal, CEO and Business Head login,
     starting profile for carried-over data, LSQ webhook versus batch and API access, source of spend and revenue actuals,
     weekly capacity per job role, revision and escalation numbers, lead source to department mapping, lead to work item
     attribution key, the work type for inbound lead tasks and the campaign they attach to, Pending and Published semantics,
     the At Risk definition, report format, timezone.

RULES FOR THIS TASK
- Be specific to this repository. Do not install packages, run migrations or modify source files.
- Do not propose features that are not in the specification.
- In your final message give the top 10 risks and the recommended order of work.
```

Read the three documents, edit `OPEN_QUESTIONS.md` with your decisions (or the Head's), then continue.

## 3. Phase prompts

Every phase prompt has the same shape: context, goal, requirements, constraints, acceptance criteria, deliverables. Paste each one into a **new Planning-mode conversation**.

### Phase 0: Archive FORGE and retire modules outside the specification

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md, docs/AUDIT.md and docs/OPEN_QUESTIONS.md (with my decisions). This is Phase 0. No new
product features in this phase.

GOAL
Leave a clean, running base: infrastructure kept, everything outside the Marketing OS specification removed from the build, and
a placeholder shell ready for the 14 screens.

REQUIREMENTS
1. Confirm tag forge-v1-final exists on the last FORGE commit. Work on branch marketing-os.
2. Remove from the build (API routes, models, services, jobs, seeds, tests, web pages, navigation, shared exports) every module
   that docs/AUDIT.md classified RETIRE: request intake and triage and dynamic forms, requester roles, public Request Access flow
   and access-request admin, calendar import and clash detection and the SM publishing queue, pipeline templates and handoffs,
   shoot planner, time tracking and timesheets and leave, file library and performance ads, deliverable review studio and version
   compare, master-data editor, audit log screens, and the old six reports and scheduled-report model. Use the audit list as the
   authority. Delete code and its tests together. Do NOT drop or modify any database collection.
3. KEEP and verify still working: auth (login, logout, refresh, me, set-password, invite), user model (it becomes Person in
   Phase 1), notifications module and bell, Socket.io, event bus, BullMQ queue setup and worker entry, mailer adapter, Cloudinary
   signed upload route, Pino logger, error middleware, env validation, glass UI components and layout, CI.
4. Replace the web navigation with the 14 Marketing OS menu items plus People and Work list. Each route renders a clearly labelled
   placeholder page ('Built in Phase N') behind ProtectedRoute. All roles redirect to /dashboard for now.
5. Fix every broken import, shared export, seed script and test caused by the removals. Remove dead env variables from env.js and
   .env.example.
6. Create a fresh docs/PROGRESS.md with a Phase 0 entry that lists what was removed and kept.

CONSTRAINTS
- No new dependencies. Backend stays JavaScript (ESM).
- Do not rename roles or models yet (Phase 1).
- If removing something breaks a kept module, stop and tell me instead of improvising.

ACCEPTANCE CRITERIA
- npm install, lint, typecheck and test all pass.
- The app starts, you can log in with an existing user, and every placeholder route loads.
- No route, job or seed refers to a retired module. A search for the retired model names returns nothing in apps/ and packages/.
- Notifications, upload signing and the worker still start without errors.

DELIVERABLES
Code changes, PROGRESS.md, and the manual checks I should perform.
```
