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
