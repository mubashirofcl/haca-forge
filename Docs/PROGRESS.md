# HACA Marketing OS — Conversion Progress

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
With Phase 0 complete and verified:
- Branch `marketing-os` is clean.
- Git tag `mos-phase-0-done` will anchor the completion of Phase 0.
- Ready to proceed immediately to **Phase 1: Reference Data, Profiles & Person Model**.
