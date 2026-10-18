# Engineering rules (always follow)

## Stack (kept from HACA FORGE, do not swap without asking)
- Monorepo with npm workspaces: apps/api, apps/web, packages/shared. Node 22 LTS.
- Backend: Express 5, MongoDB with Mongoose, JavaScript (ESM). Do not convert the backend to TypeScript.
- Frontend: React 18, Vite, TypeScript (strict), Tailwind, existing glass UI components, TanStack Query and Table,
  React Hook Form + Zod, React Router, Recharts, FullCalendar.
- packages/shared (@mmp/shared): role keys (admin, marketing_head, team_lead, team_member), permission keys and the role-to-permission map (admin has all permission keys derived from PERMISSION_KEYS), enums, Zod schemas, shared
  metric formulas. Built with tsup.
- Validation: Zod on every body, query and params. Permissions: CASL. Jobs: BullMQ + Redis. Realtime: Socket.io.
- Email only through lib/mailer.js (smtp, resend, console). Files: Cloudinary signed direct upload.
- No new dependencies unless a phase requires it. Say why when adding one.

## Architecture
- API modules under apps/api/src/modules/<name>/ with routes, controller, service, model, schema. Thin controllers.
- ALL data access goes through resolveScope(user, filters). It returns allowed profileIds and the person scope (all, team or
  self). For admin, resolveScope returns all profiles and all people. Every list, aggregate, report and export uses it.
- Admin is excluded from auto-assignment candidates, workload calculations, and performance reports.
- Every route: authentication + requirePermission('key') + Zod validation. Scoping is enforced in database queries, not only in
  the UI. A route is never 'authenticated only' unless it touches the caller's own profile.
- One shared filter schema (profile, department, owner, campaign, date or month, status) parsed once and used by all list endpoints.
- One transition service for work item status. Every change writes an ActivityEvent (admin actions recorded with actingAs: 'admin').
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
- The first user is seeded as admin via scripts/seed-admin.js from ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (refuses if an admin exists).
- No seed or debug endpoints in production builds. Logs never contain secrets or tokens.

## Frontend conventions
- UI reference: docs/ui/ui_design_specification.md and docs/ui/ui-details.md. Keep the existing glass design language.
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
