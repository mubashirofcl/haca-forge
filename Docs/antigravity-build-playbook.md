# Antigravity Build Playbook
### Marketing Workflow and Content Management Portal

How to use this file: set up the workspace (Section 0), save the two rules files (Section 1), run the kickoff prompt (Section 2), then run the phase prompts (Section 3) **one phase per conversation**, in order. Section 4 has reusable prompts for reviews, bug fixes, and progress handoffs.

---

## 0. Setup checklist (do this once)

1. **Back up first.** Commit the current Media Manager code, then create a branch: `git checkout -b portal-v1`.
2. **Open the repo** in Antigravity as the workspace folder.
3. **Add the specs** to the repo: create `docs/` and put in it
   - `Marketing_Portal_Architecture_and_Specification.pdf`
   - `roles-and-features.md`
   - your current `details.md` (Media Manager documentation)
4. **Create the rules folder** `.agent/rules/` and save the two files from Section 1 there. Rules work like standing system instructions, so the agent follows them in every session.
5. **Settings:** use **Planning mode** for every phase (Fast mode only for tiny fixes). Set agent autonomy to **Request review** at first, and add an allow list for safe commands such as `npm test`, `npm run lint`, `git status`, `git diff`. Add a deny list for destructive commands (`rm -rf`, `git push --force`, `git reset --hard`, anything touching production databases).
6. **Local services:** install Node 22 LTS and Docker (for MongoDB and Redis), or have a MongoDB Atlas dev cluster ready.
7. **Never paste real secrets** into prompts. Use `.env` files that are git-ignored.
8. **Workflow per phase:** paste the phase prompt in Planning mode → read the plan artifact and fix anything wrong **before** approving → let the agent build → run the app and the tests yourself → run the review prompt (Section 4) → commit (`git commit -m "phase N: ..."`) → start a **new conversation** for the next phase.
9. **Optional:** save the review prompt and the progress-handoff prompt as workflows in `.agent/workflows/` so you can trigger them with `/`.
10. Keep `docs/PROGRESS.md` updated at the end of every phase (the handoff prompt does this).

---

## 1. Rules files

### 1.1 `.agent/rules/00-project-context.md`

```markdown
# Project context: Marketing Workflow and Content Management Portal

An internal portal for a company marketing function. Other departments raise work requests, the social media
team plans a content calendar, and four production teams deliver the work. Every piece of content is tracked
from idea to publication. Management gets dashboards and reports. The full specification is in
docs/Marketing_Portal_Architecture_and_Specification.pdf and docs/roles-and-features.md. If this file and the
specification disagree, stop and ask.

## Production teams
Content (scripts, captions, copy), Graphics (posters, carousels, ad creatives), Cinematography (shoots,
footage), Editor (video editing, reels, exports).

## Work sources (requesting departments)
- Social Media (SM Managers): monthly or weekly content calendar
- Performance (Ads): ad creatives, A/B variants
- Sales (Sales Lead): offer posters, brochures, product and pitch videos
- Academics (Academics Lead or Performance Lead): course creatives, webinar posters, academic videos
- Others: any other marketing requirement

## Roles (keep these exact keys)
admin, lead (Marketing Manager), team_lead (optional), worker, sm_manager, dept_lead, dept_staff, viewer (optional)
- Worker's team (content, graphics, cinematography, editor) comes from team membership and skills, not from the role key.
- Reviewer and approver duties belong to lead (team_lead only if delegated). Admin can override, always audited.
- Single common login for everyone. New users use "Request Access"; only admin approves; invite email with
  a set-password link (expires in 48 hours). Google OAuth logs in already-approved users only.
- Migration of old roles: editor -> worker, member -> dept_staff.

## Core model
- Request: raised by a requester from a source department. Lead triages: accept, reject, ask info, convert.
- ContentItem: the main tracked unit (one post, reel, ad creative, brochure). Has a format, source department,
  campaign, platforms, publish date, auto-calculated production deadline, status, and a pipeline of stage tasks.
- PipelineTemplate per format. Completing a stage creates and assigns the next team's task automatically.
  - Static post or poster: Content -> Graphics -> Review -> Approved -> Scheduled -> Published (lead time 3 days)
  - Carousel: Content -> Graphics -> Review -> Approved -> Scheduled -> Published (4)
  - Story: Content -> Graphics or Editor -> Review -> Approved -> Scheduled -> Published (2)
  - Reel or video: Content (script) -> Cinematography (shoot) -> Editor -> Review -> Approved -> Scheduled -> Published (7)
  - Ad creative: Content (ad copy) -> Graphics or Editor -> Review -> Handed to Performance -> Live (4)
  - Brochure or sales material: Content -> Graphics -> Review -> Delivered to Sales (5)
  - Academic or webinar creative: Content -> Graphics or Editor -> Review -> Delivered to Academics (4)
- Statuses
  - Request: Submitted, Under Triage, Accepted, Rejected, Needs Info, Converted
  - ContentItem: Planned, Brief Ready, In Production, In Review, Changes Requested, Approved, Scheduled, Published
    (ads: Live, Paused, Retired)
  - Task: Assigned, In Progress, Submitted, Changes Requested, Approved, Done
  - On Hold and Blocked exist on any level and require a reason code.
- Every status transition is written to StatusHistory (entity, from, to, user, reason, timestamp). This powers
  all bottleneck and efficiency reports.
- Visibility: dept_lead sees all requests of their department; dept_staff see only their own; requesters never
  see internal tasks or workload.
- Only sm_manager marks content Published. Only the lead (or delegated reviewer) approves or requests changes.
  Only the requester confirms final output.
- Shoot Planner groups several video content items into one shoot day; marking a shoot Done releases footage
  to the Editor queue.
- Reports: department, team, individual, content, bottleneck, management scorecard. Efficiency score default
  weights: on-time 40%, first-pass approval 30%, speed vs estimate 20%, volume and utilization 10% (configurable).
```

### 1.2 `.agent/rules/01-engineering-rules.md`

```markdown
# Engineering rules (always follow)

## Stack (do not swap without asking)
- Monorepo with npm workspaces: apps/api, apps/web, packages/shared.
- Node.js 22 LTS. Backend: Express 5, MongoDB with Mongoose, Socket.io, JavaScript (ESM). Do not convert the
  existing backend to TypeScript unless asked.
- Frontend: React 18, Vite, TypeScript (strict), Tailwind, Shadcn/Radix, TanStack Query, TanStack Table,
  React Hook Form + Zod, React Router, dnd-kit, Recharts, FullCalendar, Tiptap.
- packages/shared: TypeScript, built with tsup. Holds Zod schemas, role keys, permission keys and the
  role-to-permission map, status enums, and shared types.
- Validation: Zod on every request body, query, and params. Permissions: CASL. Jobs: BullMQ + Redis.
- Email goes only through lib/mailer.js. Providers: smtp (Nodemailer), resend, console (local dev).
  Never call Nodemailer or Resend from controllers.
- Files: Cloudinary signed direct upload from the browser. Never buffer large files in server memory.

## Architecture
- API modules under apps/api/src/modules/<name>/ with routes, controller, service, model, schema files.
  Controllers stay thin; business rules live in services.
- All status changes go through one transition service that checks permissions and transition rules,
  requires reason codes for Blocked and On Hold, and writes StatusHistory. No direct status writes elsewhere.
- Every route has authentication plus a permission check (requirePermission('key')). No route is
  "authenticated only" unless it only touches the caller's own profile.
- Enforce department and team scoping in database queries, not only in the UI.
- Use ObjectId references everywhere. Add indexes listed in the spec for new collections.
- Write an AuditLog entry for role changes, approvals, deletions, and admin overrides.

## Security
- JWT in httpOnly, Secure, SameSite cookies; short-lived access token plus refresh token.
- helmet, rate limits on login and request-access, mongo sanitize, hpp, strict CORS with credentials.
- No default passwords or secrets in code or docs. All config through validated environment variables
  (apps/api/src/config/env.js) with a committed .env.example.
- No seed or debug endpoints in production builds. Invite and reset tokens are stored hashed and expire.

## Frontend conventions
- Role-based routes and one ProtectedRoute that checks permissions. Menus and buttons are hidden by permission,
  but the API is the real gate.
- Server data through TanStack Query; forms through React Hook Form + Zod using schemas from packages/shared.
- Every list and page needs loading, empty, and error states. Tables use TanStack Table with filters and pagination.
- Responsive layouts (mobile friendly) and keyboard accessible controls. Use the existing Shadcn components.
- No localStorage for auth tokens.

## Quality
- Add or update tests with every feature: Vitest + Supertest for API, Vitest + React Testing Library for UI.
- Run lint, type-check, and tests before saying a task is done. Fix failures; do not skip or weaken tests.
- Small focused commits with clear messages. Do not leave TODOs without a note in docs/PROGRESS.md.
- API errors use one JSON shape: { error: { code, message, details? } }.

## Working style
- Use Planning mode: write the implementation plan first, list assumptions and open questions, then build.
- If something is ambiguous or conflicts with the specification, ask instead of guessing.
- Do not change files outside the scope of the current phase unless required, and say why.
- At the end of each phase: update docs/PROGRESS.md (done, decisions, known gaps, how to run and test),
  and list the manual checks the user should perform.
```

---

## 2. Kickoff prompt (planning only, no code)

Run this once in Planning mode. It produces the audit and the master plan.

```text
You are a senior full-stack engineer (MERN) joining a project in progress. Read the rules in .agent/rules/
first, then read everything in docs/ (the architecture and specification PDF, roles-and-features.md, and
details.md that documents the existing Media Manager code), and then inspect the current repository.

GOAL
We are turning the partially built "Media Manager" into the "Marketing Workflow and Content Management
Portal" described in the specification. DO NOT WRITE OR CHANGE ANY CODE IN THIS TASK.

DELIVERABLES (write them as markdown files in docs/)
1. docs/AUDIT.md
   - What exists in the repo today versus what the specification requires, module by module.
   - Every security or design issue you find (compare with section 17 of the spec: routes that only require
     "Authenticated", public register, seed endpoint, in-memory 500 MB uploads, duplicate Submission/Content
     models, string references, default credentials, Node version) plus anything additional you discover.
   - What can be reused as is, what must be refactored, what must be rebuilt.
2. docs/BUILD_PLAN.md
   - A phased plan: Phase 0 repo audit and restructure; 1 auth, RBAC, Request Access; 2 departments, teams,
     master data, audit log; 3 requests and triage; 4 content core and pipelines; 5 content calendar;
     6 team management, shoots, time tracking; 7 review, files, publishing; 8 notifications and background
     jobs; 9 reports and dashboards; 10 hardening and QA; 11 deployment.
   - For each phase: scope, backend work, frontend work, data model changes and migrations, tests, risks,
     and acceptance criteria. Mark dependencies between phases.
   - A data migration plan for existing collections (User roles, Task, Submission, Content, Feedback).
3. docs/OPEN_QUESTIONS.md
   - Every ambiguity or decision you need from me, with your recommended default for each.
   - Include at least: whether each team has its own team lead, whether requesters can see worker names,
     ad performance feedback, post metrics scope, and the Render plan (SMTP needs a paid instance).

RULES FOR THIS TASK
- Be specific to this repository: reference real file paths and model names.
- Do not install packages, run migrations, or modify source files.
- When finished, summarize the top 10 risks and the recommended order of work in your final message.
```

Read the three documents, answer `OPEN_QUESTIONS.md` yourself (edit the file with your decisions), then continue.

---

## 3. Phase prompts

Every phase prompt has the same shape: context, goal, requirements, constraints, acceptance criteria, deliverables. Paste each one into a **new Planning-mode conversation**.

### Phase 0: Audit fixes and repo restructure

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md, docs/AUDIT.md and docs/OPEN_QUESTIONS.md (with my decisions).
This is Phase 0 of the plan. No new product features in this phase.

GOAL
Restructure the repository into the target monorepo and fix the foundations so every later phase builds on a clean base.

REQUIREMENTS
1. Monorepo with npm workspaces: move backend/ to apps/api and frontend/ to apps/web; create packages/shared
   (TypeScript, built with tsup, exporting an empty-but-wired index so apps can import it). Preserve git history
   (use git mv). Root scripts: dev (runs api and web together), build, lint, test, typecheck.
2. Node 22 LTS: add .nvmrc and "engines" in package.json files.
3. Config: add apps/api/src/config/env.js that validates all environment variables with Zod and fails fast.
   Create .env.example for api and web. Remove any committed secrets, sample JWT secrets, and default
   credentials from code and docs. Make sure .gitignore covers env files.
4. Tooling: ESLint + Prettier for the whole repo, Vitest + Supertest in apps/api, Vitest + React Testing
   Library in apps/web, GitHub Actions workflow running lint, typecheck, and tests on pull requests.
5. docker-compose.yml with MongoDB and Redis for local development, and a README section on running locally.
6. Add a pino logger and a central error-handling middleware that returns { error: { code, message, details? } }.
   Add the health route GET /api/status (keep the existing behavior).
7. Do not change business behavior. Existing login, tasks, review, chat, and upload must still work after the move.

CONSTRAINTS
- No new dependencies beyond what the rules list. Keep the backend in JavaScript (ESM).
- Do not delete existing features; flag them in docs/PROGRESS.md if they are scheduled for replacement.

ACCEPTANCE CRITERIA
- npm install at the root works; npm run dev starts api and web; the existing app behaves as before.
- npm run lint, typecheck, and test pass locally and in CI.
- The API refuses to start with missing or invalid env variables and says exactly which ones.
- No secrets or default credentials remain in the repository.

DELIVERABLES
Code changes, docs/PROGRESS.md (create it) with Phase 0 summary, and the manual checks I should perform.
```

### Phase 1: Authentication, RBAC, and Request Access

```text
CONTEXT
Read .agent/rules/ and docs/BUILD_PLAN.md (Phase 1), plus section 3 and section 15 of the specification PDF.
Phase 0 is complete.

GOAL
Implement secure common login, permission-based access control, the Request Access flow with Admin approval,
and the mail adapter. This replaces open registration.

BACKEND REQUIREMENTS
1. Roles: admin, lead, team_lead, worker, sm_manager, dept_lead, dept_staff, viewer. Update the User model:
   role, status (active, suspended), department, teamId, skills[], capacity, mustSetPassword, lastLogin.
   Write an idempotent migration script: editor -> worker, member -> dept_staff, existing admin stays admin.
2. packages/shared: role keys, permission keys, and the role-to-permission map exactly as in the permission
   matrix of the specification (section 15.1), plus Zod schemas for auth and access requests.
3. CASL abilities built from that map on login. Add requirePermission(key) middleware. Go through EVERY
   existing route and apply the correct permission; no route may be "authenticated only" unless it only
   touches the caller's own data. List all changes in docs/PROGRESS.md.
4. Auth: POST /auth/login (common for all roles), /auth/logout, /auth/refresh, GET /auth/me (returns user,
   role, permissions). httpOnly Secure SameSite cookies, short-lived access token plus refresh token with
   rotation. Login errors for pending, rejected, and suspended users must return clear, distinct messages.
5. Request Access:
   - AccessRequest model: name, email, phone, department, requestedRole, skills[], reason, status
     (pending, approved, rejected, info_needed), reviewedBy, reviewedAt, assignedRole, rejectReason,
     inviteTokenHash, inviteExpiresAt.
   - POST /auth/request-access (public, rate-limited, blocks duplicate emails and duplicate pending requests,
     captcha-ready hook).
   - Admin endpoints: list with filters; approve (admin can change role, team, skills, capacity); reject with
     reason; ask for info. Only admin may grant lead or admin roles.
   - On approval: create the user, generate a random invite token (store only its hash), email a set-password
     link that expires in 48 hours. POST /auth/set-password consumes the token and activates the account.
6. Google OAuth: keep it, but only for users that already exist and are active. Never auto-create users.
7. lib/mailer.js adapter with providers smtp (Nodemailer), resend, console (prints emails to the log for
   local dev), selected by EMAIL_PROVIDER. Add HTML templates for: invite, rejection, info needed, and
   "new access request" notification to admins.
8. Security middleware: helmet, express-rate-limit, express-mongo-sanitize, hpp, strict CORS with credentials,
   trust proxy setting for Render.
9. Remove POST /auth/register and /tasks/seed. Add scripts/seed-admin.js that creates the first admin from
   ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD env variables (refuse if a user with role admin already exists).
10. AuditLog: write entries for approvals, rejections, role changes, suspensions, password resets.
11. Admin user management endpoints: list, change role, suspend or reactivate, reset password, force logout.

FRONTEND REQUIREMENTS
1. One login page for all roles with a "Request Access" button that opens a form (fields above, validated with
   the shared Zod schema). After login redirect by role: /admin, /lead, /worker, /requester (sm_manager,
   dept_lead, dept_staff land on requester views for now), viewer to /reports.
2. Set-password page for invite links; clear states for expired or invalid tokens.
3. Replace the old role checks with a permission-aware ProtectedRoute and a usePermission hook.
4. Admin pages: Access Requests (badge count, filters, approve dialog with role/team/skills/capacity, reject
   with reason, ask for info) and Users (change role, suspend, reset password, force logout).
5. Pending, rejected, and suspended messages on login. Rename existing /editor routes to /worker.

TESTS
- Unit tests for the permission map against the spec matrix.
- Integration tests for: request access -> approve -> invite -> set password -> login; duplicate request
  blocked; non-admin cannot approve; rejected and suspended login messages; rate limit on login.

CONSTRAINTS
- Never log or return password hashes or raw tokens. Tokens in emails are single use.
- Do not add features outside this phase.

ACCEPTANCE CRITERIA
- I can create the first admin with the seed script, submit an access request as a new user, approve it as
  admin (with email printed in the console provider), set a password from the link, and log in to the
  correct dashboard.
- Every API route has a permission check; a worker cannot call admin routes (proven by tests).
- No public registration or seed endpoint remains.

DELIVERABLES
Code, migration script, tests, updated .env.example, PROGRESS.md entry, and manual test steps.
```

### Phase 2: Departments, teams, master data, and audit log

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 2), and sections 2, 6 and 7.1 of the specification. Phases 0-1 are complete.

GOAL
Create the organizational structure and the Admin-configurable master data that every later module depends on.

BACKEND REQUIREMENTS
1. Models and CRUD (admin only unless stated):
   - Department: name, type (social_media, performance, sales, academics, other), lead (User).
   - Team: name (Content, Graphics, Cinematography, Editor), lead (optional), members[], default weekly capacity.
   - Master data collections: Platform (YouTube, Instagram, Facebook, LinkedIn, Other), Priority, HoldReason,
     ContentFormat (with default lead time in days and a link to its pipeline template, added in Phase 4),
     RequestType per source department with a dynamic field schema (field key, label, type, required, options).
2. Seed script (idempotent) that creates the default departments, the four teams, platforms, priorities, hold
   reasons (waiting for content, approval delay, resource shortage, client feedback, equipment, weather, other),
   the content formats and lead times from .agent/rules/00-project-context.md, and default request types
   per source department with the special fields listed in the spec (section 2.2).
3. User administration additions: assign team, skills, capacity, department; skills as tags from a managed list.
4. Audit log service used by all admin changes, with GET /admin/audit-log (filters by actor, action, entity,
   date range; paginated).
5. Settings model for system options (efficiency score weights, requesters can see worker names: boolean).
6. Permission checks and Zod validation on everything; Admin-only changes are audited.

FRONTEND REQUIREMENTS
1. Admin pages: Teams and Departments (members, leads, capacity), Master Data (tabbed: platforms, priorities,
   hold reasons, formats and lead times, request types with a field-schema editor), Audit Log (filters, table
   with before/after details), Settings.
2. Users page: team, department, skills, and capacity editing.
3. A reusable dynamic-form renderer component driven by a request-type field schema (will be used in Phase 3).

TESTS
- CRUD and permission tests for each model, seed idempotency, audit entries created on change, dynamic field
  schema validation (rejects invalid field definitions).

ACCEPTANCE CRITERIA
- After running the seed, the Admin can see and edit teams, departments, and master data in the UI.
- Changing a lead time or adding a hold reason is audited and visible in the audit log.
- The dynamic form renderer renders every seeded request type correctly in a Storybook-free demo page or test.

DELIVERABLES
Code, seed script, tests, PROGRESS.md entry, manual checks.
```

### Phase 3: Requests and triage

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 3), and sections 2.2, 3, 4.3 and 7.2 / 7.5 of the specification. Phases 0-2 are complete.

GOAL
Let every department raise requests and let the Marketing Lead triage them. Conversion into content items is
completed in Phase 4, so create the conversion endpoint as a clearly marked stub that records the intent.

BACKEND REQUIREMENTS
1. Request model: requestId (format MKT-YYYY-NNNN, atomic counter), sourceDepartment, requester, requestType,
   dynamic fields payload (validated against the type's field schema), priority, deadline, attachments[]
   (Cloudinary URLs), status (submitted, under_triage, accepted, rejected, needs_info, converted, cancelled),
   triage info (decision, reason, decidedBy, decidedAt), linked contentItemIds[].
2. Endpoints: create, list (scoped), detail, edit (only while draft or needs_info), cancel (before work starts),
   comment, save draft, repeat a previous request, recurring request setup (weekly or monthly; the scheduler is
   built in Phase 8, store the definition now).
3. Scoping enforced in queries: dept_lead sees all requests of their department; dept_staff and sm_manager see
   only their own (sm_manager also sees calendar-sourced work in Phase 5); lead and admin see all; viewer
   read-only.
4. Triage endpoints (lead only): accept, reject with reason, ask for info (with message), set priority and
   deadline, merge duplicates (link and close the duplicate), convert (stub).
5. Duplicate detection: warn on submit when a similar open request exists (same department, type, and similar
   title or deadline).
6. Every status change goes through the shared transition service and writes StatusHistory (create the
   StatusHistory model and the transition service in this phase; they will be reused for content and tasks).
7. Notifications: create Notification records for key events (new request to lead, decision to requester);
   push and email delivery come in Phase 8.

FRONTEND REQUIREMENTS
1. Requester area: New Request (choose type; dynamic form from the master data; attachments; draft; templates;
   recurring option), My Requests (status timeline, filters, comments), edit and resubmit when rejected or
   needs info, cancel.
2. Department lead view: all requests of the department with filters.
3. Lead area: Request Inbox (filters by department, type, priority, deadline; bulk triage; accept, reject with
   reason, ask info, merge duplicates, convert button) and request detail with comments and history.
4. Role-based menus for lead and requester roles.

TESTS
- Scoping tests (each role sees exactly what it should), status transition tests, dynamic payload validation,
  duplicate detection, ID counter concurrency test.

ACCEPTANCE CRITERIA
- A Sales user submits a brochure request; their dept_lead sees it; another department cannot; the Lead accepts
  it and the requester sees the new status and history.
- Rejected and needs-info requests can be edited and resubmitted.

DELIVERABLES
Code, tests, PROGRESS.md entry, manual checks.
```

### Phase 4: Content core, pipelines, and handoffs

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 4), and sections 4, 6, 7.4 and 14 of the specification. Phases 0-3 are complete.

GOAL
Implement the Content Item as the central tracked unit, with configurable pipelines, automatic handoffs between
teams, assignment, and worker task views. Finish request conversion.

BACKEND REQUIREMENTS
1. Models:
   - ContentItem: contentId (CNT-YYYY-NNNN), title, format, sourceDepartment, requester, requestId?,
     calendarEntryId? (Phase 5), campaignId?, pillar, platforms[], publishDate, productionDeadline, priority,
     status, caption, hashtags, brief, publishedUrl, publishedAt, publishedBy, metrics (optional).
   - Campaign: name, department, dates, platforms.
   - PipelineTemplate: format, stages[] each with order, name, team, type (work or review or handoff),
     defaultRole, and lead time share. Seed the seven default templates from .agent/rules/00-project-context.md.
   - Task (refactor the existing model): contentItemId, stageKey, team, assignee, collaborators[], status,
     estimateHours, actualHours, dependencies[], holdReason, revisionCount, dueDate, subtasks (assignable).
   - Comment (separate collection): entityType, entityId, author, text, mentions[], attachments[]. Keep the
     existing real-time Message chat for task rooms.
2. Content creation: manual create, and request conversion (complete the Phase 3 stub): accepted request ->
   one or more ContentItems from a chosen pipeline template; request becomes converted.
3. Production deadline = publishDate minus the format's lead time (configurable). Task due dates are derived from
   stage lead time shares.
4. Handoff automation: when a stage task becomes Done (after review where the pipeline requires it), the next
   stage task is created, assigned (see 5), and the next team's queue and the lead are notified. Dependencies
   block starting a task until prerequisites are done.
5. Assignment: GET /workload?team= returns per-person open tasks, planned hours versus capacity, and leave
   (attendance) status; suggestion endpoint ranks assignees by skill match and lowest load, excluding people on
   leave. Lead and team_lead assign, reassign, and set collaborators, estimates, and dependencies. Optional
   auto-assign rule per stage (least-loaded in team).
6. Status transitions only through the shared transition service with the rules from section 14.1 of the spec
   (reason required for Blocked and On Hold; submit requires a deliverable; dependency check). Content item
   status is derived and updated from its tasks plus explicit review and publish steps.
7. Endpoints: content list/detail/update, task lists (mine, by team queue, by content item), status change,
   assign, comments, and history (StatusHistory for the content item and its tasks).

FRONTEND REQUIREMENTS
1. Lead: Content Items list (TanStack Table with filters: status, format, department, team, platform, date)
   and detail page (header, pipeline stepper showing each stage with owner and status, tasks, comments,
   history, files placeholder). Board view of content by status.
2. Task views: Lead task board with assignment (suggested assignees with load shown), My Tasks for workers
   (board, list, calendar), task detail with brief, subtasks, comments, real-time chat, status change with
   required reason dialogs for Blocked and On Hold.
3. Team queues: worker sees the queue for their team (for example "Copy ready" for Graphics).
4. Request inbox "Convert" action opens a dialog to choose format, campaign, dates, and creates the content items.
5. Role-based dashboards with first versions of the widgets for lead and worker (counts only; full reports later).

TESTS
- Pipeline generation per format, handoff creation, dependency blocking, transition rule enforcement, assignment
  suggestion ranking with leave, permission and scoping tests, request conversion.

ACCEPTANCE CRITERIA
- Converting an accepted reel request creates a ContentItem with the Reel pipeline; completing the script task
  creates the Cinematography task automatically; the content item status and history update correctly.
- A worker on leave is never suggested; a blocked task requires a reason and notifies the lead.

DELIVERABLES
Code, seed templates, tests, PROGRESS.md entry, manual checks.
```

### Phase 5: Content calendar

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 5), and section 5 of the specification. Phases 0-4 are complete.

GOAL
Build the social media content calendar module: planning, bulk import, automatic deadlines, capacity check,
and publishing.

BACKEND REQUIREMENTS
1. CalendarEntry model: date, platform, format, theme, campaign, caption brief, content pillar, owner (SM
   manager), status (draft, approved, converted), importBatchId, linked contentItemId.
2. Endpoints: list (date range, filters), create, edit, delete; approve entries; "generate content" that
   creates ContentItems and pipelines for approved entries (idempotent, no duplicates).
3. Bulk import: upload an Excel or CSV file, return a validation preview (row errors, unknown platform or
   format, past dates, duplicates) without saving; then commit the valid rows as one import batch. Provide a
   downloadable template file. Use ExcelJS for parsing and export.
4. Capacity check: GET /calendar/capacity?from=&to= compares required hours per team (from pipeline stage
   estimates for planned items) with team capacity minus leave; returns gaps per team per week.
5. Clash detection: flag more than N posts per platform per day (N configurable in settings).
6. Publishing: PATCH /content/:id/publish (sm_manager and admin only) sets Published with link, date, and
   publisher; allowed only from Approved or Scheduled. Optional metrics fields (reach, views, likes).
7. Scoping: sm_manager manages calendar entries; lead and admin see all; others read-only where relevant.

FRONTEND REQUIREMENTS
1. Content Calendar page with FullCalendar (month, week, list), filters (platform, department, campaign,
   format, team), color coding by status, and two dates visible: production deadline and publish date.
2. Entry create and edit drawer; drag to reschedule (updates deadlines and warns on capacity impact).
3. Import wizard: download template, upload, preview with errors, confirm.
4. Capacity widget showing demand versus capacity per team per week with red and amber states; clash badges.
5. SM Manager dashboard: calendar status counts (planned, in production, ready, published), at-risk posts this
   week, publishing queue with a Mark Published dialog (link, date, optional metrics).
6. Overlays for shoots, leave, and holidays on the calendar (shoots arrive in Phase 6; leave now).

TESTS
- Import validation cases, idempotent generation, capacity math with leave, publish permission and state rules.

ACCEPTANCE CRITERIA
- Importing an October calendar of 40 rows with 3 errors previews the errors, commits 37 entries, and
  generating content creates 37 content items with correct production deadlines.
- Capacity warnings appear for an overloaded week; only sm_manager or admin can mark content Published.

DELIVERABLES
Code, template file, tests, PROGRESS.md entry, manual checks.
```

### Phase 6: Team management, shoots, and time tracking

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 6), and sections 6 and 7.4 of the specification. Phases 0-5 are complete.

GOAL
Give leads real team management tools and give workers time tracking, attendance, and shoot handling.

BACKEND REQUIREMENTS
1. Shoot model: date, location, crew[], equipment, talent notes, contentItems[], status (scheduled, done,
   reshoot_needed, cancelled), notes. Rules: only video-format content items; script-ready check (the Content
   stage must be done) with a warning override by lead. Marking Done releases footage: the Editor stage task
   is created or unblocked for each linked content item. Reshoot_needed returns the item to Cinematography.
2. Attendance and leave: leave requests or declarations with date ranges, visible to leads, used by
   assignment, workload, and capacity. Keep the existing present or leave toggle and extend it with dates.
3. TimeEntry model: taskId, userId, start, end, minutes, note, status (draft, submitted, approved), approvedBy.
   Timer start and stop, manual entry, weekly timesheet submit, lead or team_lead approval. Task actualHours
   derives from approved and submitted entries.
4. Team endpoints: team page data (members, skills, capacity, today's load, leave, queue, metrics), skills
   matrix, workload by week, handoff queues per team.
5. Team lead scoping: team_lead sees and manages only their team; lead manages all.

FRONTEND REQUIREMENTS
1. Team pages (one per team) with members, skills, capacity, workload bars, leave, current tasks, queue.
2. Workload view: per-person planned versus capacity hours by week; drag a task onto another person to
   reassign; overload warnings.
3. Shoot Planner: calendar and list; create a shoot, add video items, assign crew, mark Done or Reshoot with
   reason; the Cinematography worker sees "Today's shoots" with script and shot list.
4. Worker timesheet: timer widget on tasks, weekly grid, submit; lead approval screen.
5. Handoff queue widgets: Editor "Footage ready", Graphics "Copy ready", Cinematography "Script ready",
   Lead "Waiting for review".
6. Leave management UI for workers and leads.

TESTS
- Shoot completion releases editor tasks, reshoot flow, leave-aware workload and capacity, timesheet approval
  flow, team_lead scoping.

ACCEPTANCE CRITERIA
- Grouping three reels into one shoot and marking it Done creates three Editor tasks in the Editor queue.
- A worker's logged hours update task actual hours; leads can approve a weekly timesheet; a person on leave is
  excluded from suggestions and reduces capacity in the calendar check.

DELIVERABLES
Code, tests, PROGRESS.md entry, manual checks.
```

### Phase 7: Review, files, and publishing flow

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 7), and sections 4, 7.2, 7.4 and 14 of the specification. Phases 0-6 are complete.

GOAL
Implement versioned deliverables with direct uploads, timestamped video review, Lead approval, requester
confirmation, and the publishing queue. Merge the old Submission and Content models.

BACKEND REQUIREMENTS
1. Deliverable model (replaces Submission and Content): taskId, contentItemId, version, type, fileUrl or
   externalLink, thumbnail, uploadedBy, notes, status (submitted, approved, changes_requested, rejected),
   decidedBy, decidedAt. Write and run a migration that maps existing Submission, Content, and Feedback
   documents into Deliverable and Comment (keep a backup collection; make it idempotent; document it).
2. Signed direct upload: POST /uploads/sign returns Cloudinary signed parameters with type and size limits
   (video up to 500 MB). Remove the multer in-memory upload route (keep a small-file fallback only if needed,
   with a strict size limit). The API stores only the resulting URL and metadata.
3. Review decisions: lead (or delegated reviewer) approves, requests changes, or rejects with comments;
   revisionCount increments on changes requested; the task returns to the assignee. Timestamped comments for
   video (Comment with media timestamp). Version history and comparison data.
4. Requester confirmation: after Lead approval, the requester can confirm or request changes with comments;
   changes go back to the Lead. Sources without a requester (calendar items) skip this step.
5. Publishing queue: approved and confirmed items become Scheduled; sm_manager publishes (already built in
   Phase 5); ads move to Handed to Performance and Live, set by the performance team.
6. File library per content item and per campaign: list, filter by type, version tags, download of approved files.
7. All transitions through the transition service with the rules in section 14.1.

FRONTEND REQUIREMENTS
1. Worker upload component with react-dropzone, progress bar, resumable-safe behavior (direct to Cloudinary),
   version notes, link attachments, and Submit for review.
2. Lead Review Queue sorted by deadline; review screen with Video.js or Plyr player, click-to-comment at the
   current timestamp, comment list that seeks the player on click, version switcher and side-by-side compare,
   Approve, Request changes, Reject buttons.
3. Worker feedback view showing timestamped notes, with resubmit flow.
4. Requester confirmation screen (preview, confirm, request changes, download approved files).
5. Performance dashboard: ad creatives requested, in production, ready, live, with Handed to Performance and
   Live actions.
6. File library pages.

TESTS
- Migration idempotency test, signature endpoint validation (type and size), review decision rules, revision
  counting, confirmation flow, permission tests for who can approve, confirm, and publish.

ACCEPTANCE CRITERIA
- A 300 MB video uploads straight from the browser to Cloudinary without passing through the API; the API
  holds only metadata.
- Lead requests changes with three timestamped comments; the editor sees them, uploads version 2; the lead
  approves; the requester confirms; the content becomes Scheduled; the SM manager publishes.

DELIVERABLES
Code, migration with rollback notes, tests, PROGRESS.md entry, manual checks.
```

### Phase 8: Notifications, real-time, and background jobs

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 8), and sections 9.3, 14.2 and 14.3 of the specification. Phases 0-7 are complete.

GOAL
Deliver timely notifications (in-app, real-time, email, digest) and reliable background processing.

BACKEND REQUIREMENTS
1. Central domain event bus: services emit events (request.created, request.decided, task.assigned,
   task.blocked, stage.handoff, review.submitted, review.decided, content.published, deadline.approaching,
   deadline.overdue, capacity.gap, access.requested ...). A notification service maps events to recipients per
   section 14.3 and writes Notification records.
2. Socket.io: authenticate in the handshake with the same JWT cookie; rooms per user and per task; push
   notifications and live status changes; keep task chat and typing events. Add the Redis adapter behind a flag.
3. BullMQ with Redis: a separate worker entry (apps/api/src/worker.js) so it can run as its own Render service.
   Jobs: email sending with retries, deadline reminders (24 hours before), overdue alerts (1 day), daily digest
   for leads and management, recurring request generation (weekly or monthly definitions from Phase 3), capacity
   gap alerts for the coming week, invite and reset emails moved to the queue.
4. Notification preferences per user (email on/off per event group, digest on/off), unread counts, mark read,
   mark all read, pagination.
5. Mail templates for each event group; the mailer adapter stays the only sender (smtp, resend, console).
6. Idempotency for scheduled jobs so restarts never send duplicate alerts.

FRONTEND REQUIREMENTS
1. Notification bell with unread count, dropdown, full notifications page with filters, and links that open
   the related request, content item, or task.
2. Live updates: new assignments, status changes, and comments appear without refresh; toast for important events.
3. Preferences page for notification settings.
4. @mention support in comments (Tiptap mention extension) producing mention notifications.

TESTS
- Event-to-recipient mapping tests, job idempotency tests, socket auth tests, preference filtering tests.

ACCEPTANCE CRITERIA
- Assigning a task shows a live notification to the worker within seconds and sends the email (console
  provider locally). A task due in 24 hours produces exactly one reminder even if the worker restarts.
- The daily digest lists pending triage, blocked items, and items awaiting review for the Lead.

DELIVERABLES
Code, worker entry point and run instructions, tests, PROGRESS.md entry, manual checks.
```

### Phase 9: Reports and dashboards

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 9), and sections 8 and 15 of the specification. Phases 0-8 are complete.

GOAL
Build the full reporting layer and role dashboards for management, leads, requesters, and workers.

BACKEND REQUIREMENTS
1. Reporting services using MongoDB aggregation pipelines over StatusHistory, Task, TimeEntry, ContentItem,
   Request, and Deliverable. Add the compound indexes from the spec and verify with explain plans. Never load
   large collections into memory.
2. Endpoints (all filterable by date range, department, team, person, format, platform; all paginated or
   aggregated server side):
   - /reports/department: requests and content by type, status, period; turnaround; on-time rate; revision rate;
     pending and overdue aging; hours consumed per department, team, format.
   - /reports/team: throughput, backlog, queue time versus work time, utilization, rework, handoff delay.
   - /reports/individual/:userId: assigned versus completed, on-time rate, average time per task type, actual
     versus estimate, first-pass approval rate, revision count, hours versus capacity, leave days, trend,
     efficiency score using the configured weights.
   - /reports/content: output by format, platform, week or month, campaign, pillar, source department; planned
     versus published; on-time publish rate; pipeline by stage; late items with aging; review cycles; ad
     creatives per campaign; optional post metrics.
   - /reports/bottlenecks: time in each status, holds and blocks by reason, stage, team, and department;
     handoff delay between teams; rework and rejection reasons; SLA breaches.
   - /reports/scorecard: monthly management scorecard with month-over-month trend and demand versus capacity forecast.
3. Scoping: admin, lead, viewer see all; team_lead sees their team; dept_lead sees their department; workers
   see only their own individual report; dept_staff see their own request history.
4. Exports: GET /reports/export?report=...&format=xlsx|csv|pdf using ExcelJS and pdfmake, streaming for large
   outputs. Scheduled reports: model and endpoints to schedule a report by email (weekly or monthly), sent by a
   BullMQ job.
5. Dashboard summary endpoints per role: /dashboard/admin, lead, team_lead, worker, sm_manager, dept_lead,
   dept_staff, viewer.
6. Fixture-based tests with a seeded dataset where expected numbers are known exactly (including edge cases:
   reopened tasks, holds, tasks spanning month boundaries).

FRONTEND REQUIREMENTS
1. Reports area with a report picker, a shared filter bar, charts (Recharts) plus TanStack Tables, drill-down
   from a chart segment to the underlying items, saved filters, and export buttons.
2. Dashboards for each role with the widgets listed in section 8.7 of the specification (scorecard, pipelines
   by stage, workload per team, awaiting triage and review, blocked and at-risk items, calendar status for the
   SM manager, ad creative status for Performance, department requests for Sales and Academics leads, personal
   stats for workers).
3. Individual performance page for leads and workers (their own) with the efficiency score breakdown.
4. Admin settings page for efficiency weights is already built; wire it into the calculations.
5. Print-friendly report views.

CONSTRAINTS
- Define metric formulas once in apps/api/src/modules/reports/metrics.js with comments, and reuse them everywhere.
- Document each metric's definition in docs/METRICS.md (what counts as on time, first-pass approval, queue time,
  utilization, rework).

ACCEPTANCE CRITERIA
- Reports match the fixture dataset's expected values exactly; every report responds in under 2 seconds on a
  dataset of 50,000 status history rows.
- A dept_lead cannot see another department's data through any report or export route.

DELIVERABLES
Code, docs/METRICS.md, tests, PROGRESS.md entry, manual checks.
```

### Phase 10: Hardening, QA, and polish

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 10), section 15.2 and section 17 of the specification, and
docs/PROGRESS.md. Phases 0-9 are complete.

GOAL
Make the application production-ready: security review, end-to-end tests, UX polish, performance, observability.

REQUIREMENTS
1. Security audit of the whole codebase against the checklist in .agent/rules/01-engineering-rules.md and
   section 15.2 of the spec. Produce docs/SECURITY_REVIEW.md listing each finding, severity, and fix. Fix all
   high and medium findings. Specifically verify: every route has a permission check, scoping is enforced in
   queries, no secrets or default credentials, token handling, upload limits, rate limits, CORS, dependency
   audit (npm audit) with resolved criticals.
2. Playwright end-to-end tests for the core journeys:
   a. Request Access -> admin approval -> set password -> login.
   b. Sales request -> triage -> convert -> pipeline -> handoffs -> review with changes -> approval ->
      requester confirmation -> schedule -> publish.
   c. SM calendar import -> generate content -> capacity warning.
   d. Reel pipeline with Shoot Planner.
   e. Permission denial checks for each role.
   f. Report scoping and export.
3. UX polish: loading skeletons, empty states, error boundaries, consistent toasts, form validation messages,
   responsive layouts at 360 px and 768 px, keyboard navigation and focus states, color contrast.
4. Performance: pagination everywhere, query indexes verified with explain, frontend code splitting by role,
   image and video lazy loading.
5. Observability: pino structured logs without secrets, Sentry hooks for api and web (DSN from env, disabled when
   absent), request IDs, health and readiness endpoints.
6. API documentation with Swagger or OpenAPI generated from the Zod schemas where possible, served only outside
   production or behind admin auth.
7. Demo data script (refuses to run when NODE_ENV=production) that creates realistic users, a month of calendar
   entries, requests in every status, and content items in every pipeline stage.

ACCEPTANCE CRITERIA
- All unit, integration, and Playwright tests pass in CI.
- docs/SECURITY_REVIEW.md has no open high or medium issues.
- The demo data script produces a populated app where every dashboard and report shows meaningful data.

DELIVERABLES
Code, tests, docs/SECURITY_REVIEW.md, PROGRESS.md entry, manual checks.
```

### Phase 11: Deployment (Vercel and Render)

```text
CONTEXT
Read .agent/rules/, docs/BUILD_PLAN.md (Phase 11), and section 16 of the specification. Phases 0-10 are complete.

GOAL
Prepare and document deployment: frontend on Vercel, API (and worker) on Render, MongoDB Atlas, Redis,
Cloudinary, and the email adapter. Do not deploy anything yourself and do not use real credentials.

REQUIREMENTS
1. Frontend: vercel.json with an SPA rewrite, correct build settings for apps/web, and environment variable
   docs (VITE_API_BASE_URL, VITE_SOCKET_URL). Confirm the socket connects directly to the API origin.
2. API: render.yaml blueprint with a web service (apps/api, build, start, health check /api/status, NODE_VERSION=22)
   and a background worker service for BullMQ, plus the Redis instance. List every environment variable with
   description, required or optional, and example (no real values).
3. Cookies and CORS for one custom domain with subdomains (app. and api.): cookie domain setting, SameSite lax,
   Secure, trust proxy, CORS origin from FRONTEND_URL, Socket.io CORS. Document what to change if only
   vercel.app and onrender.com domains are used.
4. Email: confirm EMAIL_PROVIDER=smtp works with Nodemailer on port 587 or 465 (document that Render blocks
   SMTP on free instances, so a paid instance or the Resend provider is required) and document the exact
   steps to switch to Resend (install, verify domain, set EMAIL_PROVIDER=resend and RESEND_API_KEY).
5. Atlas: indexes created on startup or by a script, network access notes, backup recommendation.
6. Production checks: no seed or demo routes, env validation fails fast, cookies Secure, rate limits on,
   Swagger protected.
7. Write docs/DEPLOYMENT.md as a runbook: first-time setup order, first admin creation, release checklist,
   rollback steps, monitoring and backup, common problems (CORS, cookies, sleeping free instances, SMTP blocked).
8. A README with local development, testing, and architecture overview.

ACCEPTANCE CRITERIA
- Following docs/DEPLOYMENT.md from scratch yields a working deployment with no guesswork; every env variable
  used in the code appears in the docs and in .env.example.

DELIVERABLES
Config files, docs/DEPLOYMENT.md, README, final PROGRESS.md entry, and a launch checklist.
```

---

## 4. Reusable prompts

### 4.1 Start of every new conversation

```text
Read .agent/rules/ and docs/PROGRESS.md so you know the current state. We are starting Phase N. Re-read the
Phase N section of docs/BUILD_PLAN.md and the relevant parts of the specification, then produce your
implementation plan (files to create or change, data model changes, risks, test plan) and WAIT for my
approval before writing code.
```

### 4.2 Review the phase before committing

```text
Review everything you changed in this phase as a strict senior reviewer. Check:
1. Does every acceptance criterion of the phase pass? Run the app and tests and show the results.
2. Does every new or changed route have authentication, a permission check, Zod validation, and database-level
   scoping? List any gaps.
3. Are all status changes going through the transition service with StatusHistory entries?
4. Are there leftover TODOs, dead code, console logs, hard-coded secrets, or unused dependencies?
5. Do loading, empty, and error states exist on every new screen? Is it usable at 360 px width?
6. Do the tests cover failure paths and permission denial, not only happy paths?
Fix everything you find, re-run lint, typecheck, and tests, and give me a short summary of what you fixed and
what still needs my decision.
```

### 4.3 Bug fix

```text
BUG
What I did: <steps>
What I expected: <expected>
What happened: <actual, with error text or screenshot>
Where: <page or route, role I was logged in as>

Instructions: reproduce the bug first (write a failing test if possible), find the root cause and explain it
in two or three sentences, fix it with the smallest correct change, confirm the test passes, and check whether
the same mistake exists elsewhere in the codebase. Do not refactor unrelated code.
```

### 4.4 Small feature or change request

```text
CHANGE REQUEST
<describe the change in plain language>

Constraints: follow .agent/rules/. First list the files you will touch and any data model or permission
changes, and ask me if the change conflicts with the specification. Then implement it with tests and update
docs/PROGRESS.md.
```

### 4.5 Progress handoff (run at the end of every phase)

```text
Update docs/PROGRESS.md for the phase we just finished. Include: what was built, key decisions and why,
deviations from the specification, known gaps and technical debt, new environment variables, new scripts and
how to run them, migrations that must be run, and a manual test checklist. Keep it concise and accurate to the
code as it is now. Then list the three most important things to remember when starting the next phase.
```

### 4.6 Security spot-check (any time)

```text
Run a focused security review of <module or route group>. For each route list: authentication, permission key,
validation, scoping, and risks (injection, IDOR, mass assignment, privilege escalation, data leakage in
responses, missing rate limits). Show the code evidence, rank findings by severity, and fix the high and
medium ones with tests that prove the fix.
```

### 4.7 Parallel work in the Agent Manager (use sparingly)

Only run parallel agents for **independent** work inside a phase, for example one agent on the backend module and one on the frontend pages **after** the API contract is agreed. Use this instruction first in both conversations:

```text
The API contract for this work is defined in docs/api/<module>.md (routes, request and response shapes,
permissions). Do not change the contract. If you believe it must change, stop and tell me why.
```

---

## 5. Tips for good results

- **One phase per conversation.** Long conversations drift; fresh conversations plus `PROGRESS.md` and rules keep the agent consistent.
- **Always read the plan artifact before approving.** Fixing a plan costs minutes; fixing built code costs hours.
- **Commit after every phase**, and tag it (`git tag phase-3-done`) so you can roll back.
- **Test yourself, too.** After each phase, log in as each role and try to break permissions.
- **Keep the specification as the source of truth.** If you change a decision, update `00-project-context.md` and the relevant doc so future sessions do not revert it.
- **Switch models per task if useful.** Antigravity lets you pick the model per conversation, so use a stronger model for planning, security reviews, and report logic, and a faster one for UI polish.
- **Never skip Phase 0.** A clean monorepo with CI makes every later phase safer.
