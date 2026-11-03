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
- Allowed dependencies rule (STRICT): For Role Workspaces and documents, only these dependencies are allowed: Tiptap packages and extensions (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, official extensions), exactly ONE DOCX export library, exactly ONE DOCX import library; PDF strictly through browser print (`window.print()` with `@media print` CSS); nothing else! No external binary PDF generators (e.g. Puppeteer, jsPDF, pdfmake). Zero other new dependencies.

## Architecture
- API modules under `apps/api/src/modules/<name>/` with routes, controller, service, model, schema. Thin controllers.
- ALL data access goes through `resolveScope(user, filters)`. HACA is the only organisation; there is no brand or profile dimension. Person scope is 'all'
  for admin, creative_head, sm_manager, and executive; 'self' for team_member. Every list, aggregate, report and export uses it.
- Admin, Creative Head, SM Manager, and Executive are excluded from auto-assignment candidate pools. Admin and Executive are excluded from workload calculations and performance reports.
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
- HACA is the only organisation; there is no brand or profile dimension. Global filter context manages Department, Owner, Date, Status synced to URL.
- Every KPI, row and name is a link to the next record (Member, Plan, ContentPiece, WorkItem, Feedback).
- One ProtectedRoute using permissions. The API is the real gate.
- Every list and page has loading, empty and error states. Empty states read as clarity, not surveillance (e.g., 'You have no active priorities. Check the calendar plan or ask the SM Manager for upcoming work.').
- Responsive down to 360 px, keyboard accessible. Reuse existing glass UI components and tokens.
- No localStorage for auth tokens.

## Quality
- Tests with every feature: Vitest + Supertest (API), Vitest + React Testing Library (UI). Include permission and scope denial cases for every role, not only happy paths.
- Run lint, typecheck and tests before saying a task is done. Fix failures. Never skip or weaken tests.
- Small focused commits. No TODOs without a note in docs/PROGRESS.md.

## Real-Time Chat & Communications Engineering (docs/CHAT.md)
- **Real-Time Architecture**: Socket.io authenticated handshake (verifying JWT). Channel rooms (`channel:<id>`) joined only after database membership verification. Membership re-checked on every emit. Optimistic client sends with retry.
- **Message Constraints**: Max 4,000 characters; stripped of executable HTML; links plain text with zero unfurl preview fetching. Built-in Unicode emoji set (no third-party emoji dependencies).
- **Attachments Engine**: Stored under unguessable UUID directory paths `uploads/chat/:channelId/:uuid/:safeFileName`. Limits: images $\le 20\text{ MB}$, documents $\le 25\text{ MB}$, video $\le 100\text{ MB}$. Max 5 attachments per message.
- **ShareGrant Model**: Approved assets shared to chat generate a scoped `ShareGrant` record. Asset view/download endpoints verify caller membership in the granted channel. Pipelines and comments remain unshared.
- **Zero Surveillance**: Chat message counts and activity metrics are prohibited from employee dashboards, leaderboards, and performance reports.


## Working style
- Planning mode: write the plan first with assumptions and open questions, then build.
- If something is ambiguous or conflicts with the specification, ask. Do not guess and do not add features.
- Do not change files outside the current phase unless required, and say why.
- End of each phase: update `docs/PROGRESS.md` and list manual checks to perform.
