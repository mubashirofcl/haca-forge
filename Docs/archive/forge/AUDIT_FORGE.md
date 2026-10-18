# Audit & Architecture Baseline

### Marketing Workflow and Content Management Portal

**Audit Date**: October 2026  
**Target Repository**: `HACA/TECH/haca-forge`  
**Status**: New clean-slate monorepo implementation based on `Marketing_Portal_Architecture_and_Specification.pdf` and `roles-and-features.md`.

---

## 1. Executive Summary

The project is built as a production-grade **modular monolith** with a modern decoupled architecture:
- **apps/api**: Express 5 (Node.js 22 LTS, ESM), MongoDB (Mongoose), Socket.io, CASL, Pino logger, BullMQ + Redis.
- **apps/web**: React 18, Vite, TypeScript, Tailwind CSS, Shadcn/Radix UI, TanStack Query, TanStack Table, dnd-kit, Recharts, FullCalendar.
- **packages/shared**: Shared TypeScript package built with `tsup`, containing Zod schemas, role definitions, permission keys, CASL ability rules, and status definitions.

---

## 2. Legacy Pitfalls vs. Target Architecture (Spec Section 17)

The specification explicitly highlighted architectural vulnerabilities and anti-patterns commonly present in prototype media manager implementations. We proactively design our clean-slate build to eliminate every single one:

| Area | Known Anti-Pattern in Legacy Systems | Our Target Monorepo Architecture |
|---|---|---|
| **Route Protection** | Generic `isAuthenticated` middleware without role or permission checks. | **Granular CASL permission middleware** (`requirePermission(key)`) on every route. No route is open unless explicitly public. |
| **User Onboarding** | Open `/auth/register` allowing anyone to sign up. | **Request Access flow**: Users submit requests; only Admin can approve/assign roles. Set-password via 48-hour hashed token. |
| **Seeding & Debug** | Endpoints like `/tasks/seed` exposed in production. | **Dedicated CLI scripts** (`scripts/seed-admin.js`, `scripts/seed-master-data.js`) with environment variable gates, completely absent from HTTP routes. |
| **Upload Architecture** | In-memory `multer` buffering files up to 500 MB (crashing Node heap). | **Direct Cloudinary signed upload**: Browser gets HMAC signature from `/uploads/sign` and uploads directly to Cloudinary. Server only stores metadata. |
| **Entity Overlap** | Duplicate `Submission` and `Content` collections. | **Unified `Deliverable` model** with semantic versioning (`v1`, `v2`, etc.), thumbnail URLs, status, and approval trails. |
| **Database References** | String references (e.g. `userId: String`, `user_email: String`). | **Strict `mongoose.Schema.Types.ObjectId`** references with foreign key integrity and compound indexes. |
| **Credentials & Secrets** | Hardcoded secrets or default credentials (`admin123`). | **Strict Zod environment validation** (`apps/api/src/config/env.js`) that fails fast on startup if secrets are missing or weak. |
| **Runtime Version** | Unstable Node versions (e.g., Node 25). | **Standardized on Node.js 22 LTS** across `.nvmrc` and `engines`. |
| **Status Transitions** | Ad-hoc updates to task status directly in controllers. | **Central `TransitionService`**: Enforces valid state machine paths, mandatory reason codes for `Blocked` and `On Hold`, and writes immutable `StatusHistory` rows. |
| **Comment Systems** | Fragmented comments (some embedded in tasks, some in chat). | **Clean separation**: `Message` for real-time task room chat via Socket.io; `Comment` collection for formal threaded reviews and timestamped video notes. |

---

## 3. Module Gap Analysis & Requirements Verification

### 3.1 Authentication & RBAC
- **Roles**: `admin`, `lead`, `team_lead`, `worker`, `sm_manager`, `dept_lead`, `dept_staff`, `viewer`.
- **RBAC**: CASL permissions matrix derived from specification section 15.1.
- **Sessions**: httpOnly, Secure, SameSite cookies with access and refresh tokens.

### 3.2 Departments & Teams
- **4 Production Teams**: Content, Graphics, Cinematography, Editor.
- **Source Departments**: Social Media, Performance, Sales, Academics, Others.
- **Master Data**: Configurable platforms, hold reasons, content formats, request types with dynamic field schemas.

### 3.3 Request Intake & Triage
- Auto-generated atomic IDs: `MKT-YYYY-NNNN`.
- Department scoping: `dept_lead` sees department-wide; `dept_staff` sees only own.
- Marketing Lead triage: Accept, Reject, Needs Info, Convert to Content Items.

### 3.4 Content Core & Pipelines
- Central `ContentItem` model (`CNT-YYYY-NNNN`).
- Configurable pipeline templates per format (Post, Carousel, Story, Reel, Ad, Brochure, Webinar).
- Automatic stage handoffs: completing Content (script) triggers Cinematography or Graphics; completing Shoot triggers Editor queue.

### 3.5 Content Calendar & Bulk Planning
- FullCalendar integration (Month, Week, List).
- Excel/CSV bulk import validation and idempotent batch processing.
- Demand vs. capacity checking with leave awareness.

### 3.6 Team Management, Shoots & Time
- Shoot Planner grouping reels into multi-item shoot days.
- Leave & attendance calendar impacting capacity and assignment recommendations.
- Task timer and timesheets with Lead approval.

### 3.7 Deliverables & Review Queue
- Video player with timestamped review comments.
- Lead approval and requester final confirmation loop.
- Publishing queue for Social Media and Performance teams.

### 3.8 Background Jobs & Real-Time
- Socket.io for live updates, chat, and notification badges.
- BullMQ + Redis for background emails, digest jobs, reminders, and recurring tasks.

### 3.9 Reports & Dashboards
- MongoDB aggregation pipelines over `StatusHistory`, `Task`, `TimeEntry`, `ContentItem`.
- Efficiency score calculation: 40% on-time, 30% first-pass approval, 20% speed, 10% volume.
- Exports to Excel, CSV, and PDF.
