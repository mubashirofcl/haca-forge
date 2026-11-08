# HACA Marketing OS — Master Project Context

**Current as of:** 8 November 2026 (after the Phase 7 close-out)  
**Repository:** HACA Marketing OS (`haca-forge`)  
**Technology Stack:** Node 22 LTS, Express 5 (ESM), React 18, Vite 6, TypeScript, Tailwind CSS, MongoDB (Mongoose), Socket.io, BullMQ (Redis).  
**Test Suite Status:** **1653 tests passing across 106 test files (0 failures)**  
- `@mmp/api`: 1353 tests passed across 64 test files  
- `@mmp/web`: 300 tests passed across 42 test files  
- The API tests set their own test-only JWT secrets (`apps/api/vitest.config.js`), so a fresh checkout passes with no `.env`.  

---

## 1. Who and What

- **Owner & Developer:** Mubashir (Mubashir PP), MERN developer at HACA, founder of Orvynlabs. Prefers direct, actionable output, exact prompts, and code blocks over long conversational explanations.
- **Product:** HACA Marketing OS (formerly FORGE / Media Manager). Internal creative and marketing operations portal for HACA's in-house team to plan, assign, produce, review, publish, and track creative deliverables (Reels and 14 design types) across 5 creative calendars.
- **Stakeholders:** Abu Nabhan (Marketing Head), Social Media Manager, Creative Head, and the internal creative/production team.
- **Operating Model:** Antigravity (AI IDE agent in Planning mode) writes and executes code. Claude / Assistant drafts specifications, diagnostics, and exact pasteable prompts following `PROMPT_STYLE_GUIDE.md`. One phase per session, verified with tests before advancing.

---

## 2. Working Agreement & Rules of Engagement

1. **Exact Pasteable Prompts:** Prompts must follow `PROMPT_STYLE_GUIDE.md` (`CONTEXT`, `STEP 1: INVESTIGATE`, `STEP 2: BUILD`, `TESTS`, `CONSTRAINTS`, `ACCEPTANCE CRITERIA`, `DELIVERABLES`).
2. **Investigate Before Changing:** Bug and change prompts must inspect files, confirm line numbers, and report root causes before proposing edits.
3. **Precondition & Verification Gate:** Every phase starts and ends with `npm install`, `npm run typecheck`, `npm run build`, and test suite execution. Record test counts in `docs/PROGRESS.md`.
4. **Strict Guardrails:**
   - **Zero ranking / leaderboards:** No comparing workers, no speed rankings, no incentive-linked performance metrics.
   - **No hour-based automated escalations:** All timers and measurements are display-only.
   - **Worker individual timing:** Timing counts from each worker's own `startedAt` (no shared clocks, no countdowns).
   - **Privacy isolation:** `team_member` cannot harvest data or view other workers' profiles (`HTTP 404`). Executives have read-only access with contact information redacted.
5. **Zero New Dependencies:** Strictly no unapproved npm packages.
6. **Data Safety:** Destructive scripts must have `--confirm` flags, dry-run by default, run only locally, and back up data outside the repository first.

---

## 3. History of Scope & Decisions

1. **Original FORGE:** Intake-and-pipeline portal for other departments. 8 roles. Removed.
2. **HACA Marketing OS Spec V1:** Campaigns, monthly targets, LSQ lead funnel, 7 brand profiles.
3. **Major Scope Reset (23 Oct 2026):**
   - **Completely removed:** Leads, LSQ, funnel, Data Center, Campaigns, Monthly Targets, multi-brand profiles, attendance/leave, file libraries.
   - Portal manages **work and team only**.
   - 5 canonical roles: `admin`, `creative_head`, `sm_manager`, `executive`, `team_member`.
4. **Creative Calendar & HACA-Only:** Single-brand system. 5 calendars (`sm`, `sales`, `ads`, `academics_management`, `other`). Step deadlines ($F-8$, $F-5$, $F-2$, $F$).
5. **Role Workspaces:** Writing Studio, Review Studio, clip-by-clip Shoot Workspace, Edit/Design/Post Workspaces.
6. **Individual Timing:** Removed shared clocks. Timing counts from each worker's own `startedAt`.
7. **Team Directory & Worker Profile:** `/team` and `/team/:id` for leadership; `/profile` for self-view.
8. **Phase PE (Profile Edit & Mobile OTP Verification):**
   - Mandatory `/welcome` gate removed; users enter directly into `/my-work` or `/dashboard`.
   - Edit Profile modal with avatar crop at `/profile` and `/team/:id`.
   - Registered email locked for users; editable only by Administrator.
   - Mobile phone number verified via 6-digit SMS OTP (`POST /api/me/phone-otp/send`, `POST /api/me/phone-otp/verify`).

---

## 4. Current Product Definition

### 4.1 Roles & Permissions
| Role Key | Title | Core Powers & Screen Permissions |
|---|---|---|
| `admin` | Administrator | Full platform control. Manages users, invites, approvals, role assignments, suspensions, password resets, and forced logouts. Only role that can edit registered emails. Excluded from workload suggestions. |
| `creative_head` | Creative Head | Verifies and approves calendar plans. Reviews all deliverable outputs (mandatory 1–5 star rating on approval, root-cause classification on revision). Edits operational details (job role, department, capacity) for workers. Cannot create users or plans. |
| `sm_manager` | SM Manager | Main planner. Creates monthly and individual plans across 5 calendars. Assigns step owners and deadlines. Reassigns, reschedules, shifts dates, and resolves blockers. Cannot approve deliverables. |
| `executive` | Executive | Read-only observer across dashboard, plans, tracker, team directory, and reports. Zero write permissions (`HTTP 403`). All contact details (email, phone, WhatsApp) are redacted. |
| `team_member` | Team Member / Worker | Works assigned steps via specialized workspaces. Sees own work (`/my-work`), own calendar items, own profile, and read-only pipeline of projects they belong to. Cannot view unauthorized projects (`HTTP 404`). |

### 4.2 Five Creative Calendars
1. `sm` — Social Media
2. `sales` — Sales Team
3. `ads` — Ads Team
4. `academics_management` — Academics & Management
5. `other` — Other

### 4.3 Deliverables, Pipelines & Review
- **15 Supported Deliverable Types:** Reel + 14 Design Types (Static Post, Carousel Post, Story, Cover Image, Thumbnail, Meta Ads Creative, Class Announcement, Orientation Creative, Graduation Creative, Brochure, Certificate, Offer Creative, Placement Poster, Custom Request).
- **Types that Go Live (Include Post Step):** Reel, Static Post, Carousel Post, Story.
- **Deadlines Relative to Publish Date ($F$):**
  - Reel (Script & Shoot): Script $F-8$, Shoot $F-5$, Edit $F-2$, Post $F$.
  - Reel (Shoot only): Shoot $F-5$, Edit $F-2$, Post $F$.
  - Reel (Edit only): Edit $F-2$, Post $F$.
  - Postable Design: Content $F-5$, Design $F-2$, Post $F$.
  - Non-Postable Design: Content $F-5$, Design $F-2$ (handover on $F$).
- **Review Steps:** Content, Script, Design, Edit, and Shoot go to the Creative Head. Post is direct by the posting owner.
- **Autofill Suggestions:** Suggests workers by matching step preference, workload under 85%, fewest revisions in 90 days, earliest availability.

### 4.4 Individual Timing & Tracking
- **Recorded Timestamps:** `unlockedAt`, `assignedAt`, `startedAt`, `submittedAt`, `decisionAt`, `changesRequestedAt`, `resubmittedAt`, `approvedAt`, `postedAt`, plus paused interval logs (`blocked`, `pending`, and `paused` for a later step held while an earlier step is reopened).
- **Measures (Display-Only):**
  - Waiting to start: `startedAt` minus `unlockedAt`.
  - Time labels (Phase 7, computed only; dates compared in Asia/Kolkata, so a step due on a day is on time until 11:59 PM IST): Overdue (unlocked, unfinished, past its due date), Waiting: earlier step late (locked and past due; never Overdue), Done N days late / Done on time (by the first submission; a Post step by its posting), Late: earlier step (unlocked after its own due date), Blocked N days (active blocker). Project labels: Overdue (publish date passed, not posted or handed over) and Completed late. Shared in `@mmp/shared` (`stepTimeLabels`, `projectTimeLabel`).
  - Worker on-time rate leaves out "Late: earlier step" steps and shows "N steps delayed by earlier steps".
  - Priority is Normal or Urgent only (default Normal). Older stored Low, Medium and High stay unchanged in the database and show as Normal. My Work and Work Items sort Urgent first, then by due date.
  - Work time: round submission minus round start, minus blocked, pending and paused periods. Reports, the team digest and the Performance tab count submitted rounds only (`submittedWorkTimeMs` in `@mmp/shared`).
  - Approval wait: decision time minus submission time.
  - Late by: calendar days between submission date and step due date.
- Workers see only their own step's due date and elapsed work time since their own click on "Start".

### 4.5 Role Workspaces
- **Writing Studio (Content / Script):** Word-style rich editor (Tiptap), two-column Visual/Audio table, duration estimator, teleprompter, shot list generator, .docx export/import.
- **Review Studio (Creative Head):** Centralized review queue. Media viewers with second-pinned video comments, coordinate-pinned image comments, 1–5 star mandatory approval rating, and 7-category revision root causes.
- **Shoot Workspace (Videographer):** Clip-by-clip upload with pause/resume, individual clip review ("Approve Clip" / "Reshoot Needed"), and WhatsApp-style per-clip discussion thread.
- **Edit / Design Workspaces:** Media upload with size guides, aspect ratio checks, approved copy side-by-side view, and revision checklist.
- **Post Workspace:** Caption (required to post) and hashtags written on the Post step, with copy buttons; download of the approved final assets; platform checklist, live link and post timestamp recording.

### 4.6 Team Directory & Profile
- **Team Directory (`/team`):** Operating status, workload percentage and band, 'Right Now' deliverable, and active counts (in progress, waiting for approval, late). Whitelist sorting: `name`, `department`, `jobRole`, `load`.
- **Worker Profile (`/team/:id` and `/profile`):** 6 tabs: Overview, Work (timeline traces), Performance (individual craftsmanship metrics), Ratings (feedback summary, $\ge 3$ threshold), Activity, and Changes (operational audit log for Admin & Creative Head).
- **Edit Profile:** Name, preferred name, avatar upload with circular crop, locked registered email (Admin managed), phone number with 6-digit OTP verification, WhatsApp sync checkbox, bio, languages, and skills.

### 4.7 Team Chat
- Real-time messaging via Socket.io.
- Group channels created by Admin, Creative Head, and SM Manager.
- Private DMs between non-executives (Admin cannot read DMs; Executive is read-only).
- **Share to Chat:** Approved creative assets from workspaces can be shared directly into channels with media preview cards.

---

## 5. Canonical Database Seed Users

Seeded via `apps/api/scripts/reset-and-seed.js`:
| # | Role | Job Role | Department | Email | Phone |
|---|---|---|---|---|---|
| 1 | `creative_head` | Creative Manager (TL) | Design | `creativehead@demo.haca.local` | 9000000001 |
| 2 | `sm_manager` | Social Media Manager | Social Media | `smmanager@demo.haca.local` | 9000000002 |
| 3 | `executive` | None | None | `executive@demo.haca.local` | 9000000003 |
| 4 | `team_member` | Writer | SEO & Content | `writer1@demo.haca.local` | 9000000011 |
| 5 | `team_member` | Writer | SEO & Content | `writer2@demo.haca.local` | 9000000012 |
| 6 | `team_member` | Designer | Design | `designer1@demo.haca.local` | 9000000013 |
| 7 | `team_member` | Designer | Design | `designer2@demo.haca.local` | 9000000014 |
| 8 | `team_member` | Videographer | Video Production | `shooter@demo.haca.local` | 9000000015 |
| 9 | `team_member` | Video Editor | Video Production | `editor1@demo.haca.local` | 9000000016 |
| 10 | `team_member` | Video Editor | Video Production | `editor2@demo.haca.local` | 9000000017 |
| 11 | `team_member` | Social Specialist | Social Media | `poster@demo.haca.local` | 9000000018 |
| 12 | `team_member` | Social Specialist | Social Media | `allrounder@demo.haca.local` | 9000000019 |
| 13 | `admin` | System Admin | Tech | `admin@hacaforge.com` | — |

---

## 6. Verification Status Checklist

| # | Item | Status | Verified Evidence |
|---|---|---|---|
| 1 | Scope reset R1 to R4 (leads, campaigns, targets removed; 5 roles; calendar plans) | **Done** | 302 tests passed; scope reset verified |
| 2 | Wipe scripts (`wipe-keep-users.js`, `reset-and-seed.js`) | **Done** | Scripts idempotent, dry-run by default |
| 3 | Workflow V2 backend (auto-fill, validation, plan rejection) | **Done** | Plan controllers, autofill service passing |
| 4 | Workflow V2 UI & Simple UI | **Done** | Max 8 menu items, one primary action per page |
| 5 | Plan list & row form fixes (counts, derived status, step deadlines) | **Done** | Row form shows step owner & date picker |
| 6 | Work actions by role (no "Lead" wording, role-based buttons) | **Done** | `getAvailableActions` tested across 5 roles |
| 7 | Pipeline visibility & stepper UI | **Done** | Teammates see read-only pipeline of own projects |
| 8 | Workspaces WS1 to WS4 (Writing, Review, Shoot, Edit, Design, Post) | **Done** | Workspaces passing tests and production build |
| 9 | Clip-by-clip Shoot workspace & feedback thread | **Done** | `ShootWorkspaceSuite.test.tsx` 13/13 passing |
| 10 | Team Chat (channels, DMs, share to chat) | **Done** | `chat_system.test.js` & `chat_share_polish.test.js` |
| 11 | HACA-Only (all other brands removed) | **Done** | Brand profiles wiped; 5 calendars active |
| 12 | Step deadlines in plan row form | **Done** | `step_deadlines_plan_form.test.js` passing |
| 13 | Individual tracking & timing | **Done** | `individual_tracking_and_timing.test.js` passing |
| 14 | Team Directory & Worker Profile (`/team`, `/team/:id`) | **Done** | `team_profile_api.test.js` passing |
| 15 | Mandatory `/welcome` gate removal | **Done** | Direct entry to `/my-work` or `/dashboard` |
| 16 | Edit Profile Modal & Mobile OTP Verification | **Done** | `phone_otp_profile.test.js` 9/9 passing |
| 17 | Approval integrity (approved version, review decisions) | **Done** | `review_decision_integrity.test.js` |
| 18 | Phase 3: access boundaries (participants, 404 to non-participants) | **Done** | Phase 3 tests; see docs/PROGRESS.md |
| 19 | Phase 4: uploads and sockets | **Done** | `phase4a_upload_safety.test.js` and Phase 4 tests |
| 20 | Phase 5: asset handoff, Drive links, caption on Post | **Done** | Phase 5 tests; 30/30 browser checks |
| 21 | Phase 6: blockers, reopening, plan delete, small fixes | **Done** | Phase 6 tests; see docs/PROGRESS.md |
| 22 | Phase 7: live reports, overdue and lateness labels, project KPIs | **Done** | Phase 7 tests; 49/49 browser checks; see docs/PROGRESS.md |

---

## 7. Technical Commands Reference

```bash
# Typecheck
npm run typecheck

# Production Web Build
npm run build --workspace=@mmp/web

# Test API Suite
npm test --workspace=@mmp/api

# Test Web Suite
npm test --workspace=@mmp/web

# Database Reset & Seed (13 Canonical Users)
node apps/api/scripts/reset-and-seed.js --confirm --db-name=marketing_portal
```

