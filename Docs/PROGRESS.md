# Project Progress Log

### Marketing Workflow and Content Management Portal

**Current State**: Phase 0 (Monorepo Foundation & Tooling) and Phase 1 (Authentication, RBAC & Request Access) Implemented.  
**Branch**: `portal-v1`  
**Date**: October 2026

---

## 1. Summary of Completed Work

### Phase 0: Monorepo Foundation & Tooling
- **Monorepo Structure**: Established npm workspaces monorepo at root with `apps/api`, `apps/web`, and `packages/shared`.
- **Runtime Standardization**: Enforced Node 22 LTS in `.nvmrc` and `engines`.
- **Config & Environment**: Built `apps/api/src/config/env.js` with Zod validation that fails fast on startup if required variables are missing. Created `.env.example` for both API and Web.
- **Shared Package (`@mmp/shared`)**: Configured with `tsup` (generating ESM and CJS with type declarations), exporting:
  - Role keys (`admin`, `lead`, `team_lead`, `worker`, `sm_manager`, `dept_lead`, `dept_staff`, `viewer`)
  - Production team keys (`content`, `graphics`, `cinematography`, `editor`)
  - Status enums (`RequestStatus`, `ContentStatus`, `TaskStatus`, `DeliverableStatus`, `ShootStatus`, `TimeEntryStatus`)
  - Permission keys & Complete CASL permission matrix from spec Section 15.1
  - Zod schemas for Auth, Request Access, Set Password, and Task Transitions
- **Infrastructure**: Added `docker-compose.yml` for local MongoDB & Redis, `.github/workflows/ci.yml` for CI automation, and `.gitignore`.
- **API Foundations**: Pino structured logger, central error handler returning `{ error: { code, message, details? } }`, and health endpoint `GET /api/status`.

### Phase 1: Authentication, RBAC & Request Access
- **User Model**: Mongoose model with full role set, active/suspended status, department, team, skills, weekly capacity, attendance tracking, and hashed refresh tokens.
- **Request Access Model**: `AccessRequest` model with 48-hour hashed invite tokens, duplicate prevention, and rate-limiting.
- **CASL RBAC Middleware**: `requirePermission(key)` middleware applied to administrative routes; `authenticate` middleware reading httpOnly secure cookies and generating CASL abilities.
- **Audit Logging**: `AuditLog` records for access approvals, rejections, info requests, role changes, suspensions, and force logouts.
- **Mail Adapter (`lib/mailer.js`)**: Provider-agnostic adapter supporting `console` (local development), `smtp` (Nodemailer), and `resend` (HTTPS API for Render compatibility). Rich HTML email templates for invites, rejections, and notifications.
- **Admin Seeding**: `scripts/seed-admin.js` to securely create the first administrator from `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD`.
- **Frontend Applications**:
  - Unified `LoginPage` with common sign-in and "Request Access" modal.
  - `SetPasswordPage` for token consumption and account activation.
  - `ProtectedRoute` and `usePermission` hook guarding routes.
  - Role-based redirector on login.
  - `AccessRequestsPage` with status filters, approval modal (role, team, skills, capacity assignment), rejection modal, and info request modal.
  - `UsersPage` with role updates, account suspension/reactivation, and force logout.
  - Role dashboards for Admin, Lead, Worker, Requester, and Viewer.

---

## 2. Key Architecture Decisions

1. **Clean Monorepo with Workspaces**: Eliminated duplicate schemas and out-of-sync types by sharing Zod validation and permission matrices across frontend and backend.
2. **CASL Permissions Over Hardcoded Roles**: Routes and UI controls verify specific capability keys rather than arbitrary strings.
3. **No Direct Registration in Production**: Public signup is completely replaced by Request Access + Admin Approval + 48h activation link.
4. **Token Security**: JWT stored in httpOnly, Secure, SameSite cookies with short-lived access token + rotated refresh token.

---

## 3. How to Run Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Build shared library**:
   ```bash
   npm run build -w packages/shared
   ```
3. **Seed the initial admin**:
   ```bash
   npm run seed:admin
   ```
4. **Start local servers**:
   ```bash
   npm run dev
   ```
   - API: `http://localhost:8080` (Health: `http://localhost:8080/api/status`)
   - Web: `http://localhost:5173`

---

## 4. Manual Verification Checklist

- [ ] **Health Check**: Open `http://localhost:8080/api/status` and verify `{ "status": "ok" }`.
- [ ] **First Admin**: Run `npm run seed:admin` and log in at `http://localhost:5173/login` using credentials from `.env`.
- [ ] **Request Access**: On the login page, click "Request Portal Access", fill in the form, and submit.
- [ ] **Admin Approval**: As admin, navigate to `/admin/access-requests`, click "Approve", select role/team, and submit.
- [ ] **Console Email**: Observe the console log output from `lib/mailer.js` displaying the activation link with token.
- [ ] **Set Password**: Open the activation link, set a new password, and verify you are redirected to login.
- [ ] **Role Routing**: Log in with the newly activated user and confirm automatic redirect to their role dashboard.
- [ ] **Permission Guard**: Try visiting `/admin` as a non-admin and verify redirect to `/unauthorized`.
