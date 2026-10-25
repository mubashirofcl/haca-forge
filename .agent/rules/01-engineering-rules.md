# Engineering rules (always follow)

## Stack (kept from HACA FORGE, do not swap without asking)
- Monorepo with npm workspaces: apps/api, apps/web, packages/shared. Node 22 LTS.
- Backend: Express 5, MongoDB with Mongoose, JavaScript (ESM). Do not convert the backend to TypeScript.
- Frontend: React 18, Vite, TypeScript (strict), Tailwind, existing glass UI components, TanStack Query,
  React Router, Recharts, Lucide Icons.
- packages/shared (@mmp/shared): role keys (`admin`, `creative_head`, `executive`, `sm_manager`, `team_member`),
  permission keys and role-to-permission map (admin has all keys derived from PERMISSION_KEYS; executive has read-only
  portal.view, people.view, calendar.view, work.view, feedback.view, analytics.team, report.view), enums, Zod schemas,
  shared metric formulas. Built with tsup.
- Validation: Zod on every body, query and params. Permissions: CASL. Jobs: BullMQ + Redis. Realtime: Socket.io.
- Email only through lib/mailer.js (smtp, resend, console). Files: Cloudinary signed direct upload.
- No new dependencies unless a phase requires it. Say why when adding one.

## Architecture
- API modules under `apps/api/src/modules/<name>/` with routes, controller, service, model, schema. Thin controllers.
- ALL data access goes through `resolveScope(user, filters)`. Single-brand mode (HACA only). Person scope is 'all'
  for admin, creative_head, sm_manager, and executive; 'self' for team_member. Every list, aggregate, report and export uses it.
- Both Admin and Executive are excluded from auto-assignment candidates, workload calculations, and performance reports.
- Read endpoints allow `portal.view` (or module-specific view permission) using `requireAnyPermission`.
- Executive role is strictly read-only: zero mutation privileges across all modules (HTTP 403 on all POST, PATCH, PUT, DELETE).
- In the People API, email and phone are omitted/masked for executive callers.
- Only Admin can grant or approve elevated roles (`admin`, `creative_head`, `executive`). Creative Head cannot modify or grant admin or executive accounts.
- Every route: authentication + `requirePermission('key')` (or `requireAnyPermission`) + Zod validation. Scoping is enforced in database queries, not only in the UI.
- Central status transition service (`transition.service.js`) for work item status. Every change writes an `ActivityEvent` (admin actions recorded with `actingAs: 'admin'`).
- Metric formulas are defined once in shared or in `modules/<name>/metrics.js` with comments.
- Scheduled and event jobs read their `AutomationRule.active` flag, record `lastRunAt` and use idempotency keys so restarts never send duplicate alerts.
- Use ObjectId references. Add indexes as needed (indexes on calendarPlanId, contentPieceId, departmentId, ownerId, status, deadline).
- API errors use one JSON shape: `{ error: { code, message, details? } }`.

## Security (unchanged from FORGE)
- JWT in httpOnly, Secure, SameSite cookies; short access token plus rotating refresh token with shared refresh-and-retry queue.
- helmet, rate limits on login, hpp, strict CORS with credentials.
- No default passwords or secrets in code or docs. Config through validated env (`apps/api/src/config/env.js`), committed `.env.example`.
- Invite and reset tokens stored hashed, single use, 48 hours.
- The first user is seeded as admin via `scripts/seed-admin.js` from `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` (refuses if an admin exists).
- No seed or debug endpoints in production builds. Logs never contain secrets or tokens.

## Frontend conventions
- UI reference: `docs/ui/ui_design_specification.md` and `docs/ui/ui-details.md`. Keep the existing glass design language.
- Single-brand mode: HACA only. Profile switcher is hidden. Global filter context manages Department, Owner, Date, Status synced to URL.
- Every KPI, row and name is a link to the next record (Member, Plan, ContentPiece, WorkItem, Feedback).
- One ProtectedRoute using permissions. The API is the real gate.
- Every list and page has loading, empty and error states. Empty states read as clarity, not surveillance (e.g., 'You have no active priorities. Check the calendar plan or ask the SM Manager for upcoming work.').
- Responsive down to 360 px, keyboard accessible. Reuse existing glass UI components and tokens.
- No localStorage for auth tokens.

## Quality
- Tests with every feature: Vitest + Supertest (API), Vitest + React Testing Library (UI). Include permission and scope denial cases for every role, not only happy paths.
- Run lint, typecheck and tests before saying a task is done. Fix failures. Never skip or weaken tests.
- Small focused commits. No TODOs without a note in docs/PROGRESS.md.

## Working style
- Planning mode: write the plan first with assumptions and open questions, then build.
- If something is ambiguous or conflicts with the specification, ask. Do not guess and do not add features.
- Do not change files outside the current phase unless required, and say why.
- End of each phase: update `docs/PROGRESS.md` and list manual checks to perform.
