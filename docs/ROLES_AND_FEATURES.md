# HACA Marketing OS — Roles, Workers & Features Specification

**Document Authority:** Definitive Reference for System Roles, Worker Specializations, Workspaces, Step Capabilities, Permissions, and Visibility Boundaries.  
**Scope:** Covers all 5 system roles (`admin`, `creative_head`, `sm_manager`, `executive`, `team_member`) and the 6 production worker specializations.  
**Current as of:** 3 November 2026.

---

## 1. System Roles Architecture

HACA Marketing OS enforces strict Role-Based Access Control (RBAC) across five canonical system roles. Each user account is assigned exactly one system role.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ROLES                              │
├────────────────┬────────────────────┬──────────────────┬───────────────┤
│ Role Key       │ Display Title      │ Primary Scope    │ Write Powers  │
├────────────────┼────────────────────┼──────────────────┼───────────────┤
│ admin          │ Administrator      │ Full System      │ Complete      │
│ creative_head  │ Creative Head      │ Creative Quality │ Review/Audit  │
│ sm_manager     │ SM Manager         │ Plans & Schedule │ Plan/Assign   │
│ executive      │ Executive Viewer   │ High-Level View  │ Zero (403)    │
│ team_member    │ Worker             │ Assigned Steps   │ Own Work Only │
└────────────────┴────────────────────┴──────────────────┴───────────────┘
```

---

## 2. Leadership & Management Roles

### 2.1 Role: Administrator (`admin`)
The system administrator manages platform security, user lifecycles, and high-level configuration.

- **Primary Menu Items (Max 8):** `Home`, `Plans`, `Tracker`, `Team Directory`, `Problems`, `Reports`, `Users`, `Access Requests`.
- **Exclusive Powers:**
  - **User Lifecycle:** Invites users, approves/rejects public signup requests (`/admin/access-requests`), suspends/reactivates accounts, resets passwords, and forces active session logout.
  - **Role Assignments:** The only role authorized to assign or elevate users to `admin`, `creative_head`, or `executive`.
  - **Email Override:** The only role authorized to modify a user's registered official email (`PATCH /api/team/:id`).
  - **Direct System Override:** Can reassign any step, reschedule dates, or skip unstarted steps if an SM Manager is unavailable.
- **Strict Guardrails & Exclusions:**
  - **Excluded from Workload:** Cannot be assigned production steps and is never suggested by auto-assignment algorithms.
  - **Action Logging:** All administrative overrides are explicitly audited with an `acting-as admin` flag.
  - **DM Privacy:** Cannot inspect private peer-to-peer direct messages in Team Chat.

---

### 2.2 Role: Creative Head (`creative_head`)
The Creative Head is the sole gatekeeper of creative quality and craftsmanship.

- **Primary Menu Items (Max 8):** `Home`, `Review Queue`, `Plans & Approvals`, `Tracker`, `Team Directory`, `Problems`, `Reports`.
- **Core Powers & Responsibilities:**
  - **Plan Verification & Approval:** Reviews incoming calendar plans submitted by the SM Manager (`/calendar` Tab 2). Can approve the entire plan, approve individual rows, request row changes, or reject the plan with a documented concern.
  - **Central Review Queue (`Review Studio`):** The sole role that evaluates deliverable outputs for `Content`, `Script`, `Design`, `Shoot`, and `Edit` review steps.
  - **Mandatory Quality Ratings:** Must award a **1 to 5 star rating** on every step approval (recorded towards the worker's craftsmanship metrics).
  - **Revision Root-Cause Categorization:** When requesting revisions, must select one of 7 standard root causes (`Brief unclear`, `Creative direction unclear`, `Skill gap`, `Feedback inconsistency`, `Excessive scope change`, `Approval delay`, `Client/business requirement changed`) alongside specific, actionable feedback.
  - **Worker Operational Details Management:** Authorized to adjust worker operating fields: `jobRole`, `departmentId`, `workPreferences`, and `weeklyCapacityHours` (tracked in the Changes audit log).
- **Strict Guardrails & Exclusions:**
  - Cannot create plans or upload content rows.
  - Cannot invite, approve, or suspend user accounts.
  - Cannot approve steps on content pieces they personally own (preventing self-approval).

---

### 2.3 Role: Social Media Manager (`sm_manager`)
The Social Media Manager is the master planner, scheduler, and traffic controller for all creative content.

- **Primary Menu Items (Max 8):** `Home`, `Plans`, `Tracker`, `Team Directory`, `Team Workload`, `Problems`, `Reports`.
- **Core Powers & Responsibilities:**
  - **Calendar Plan Creation:** Creates monthly and individual plans across the 5 creative calendars (`sm`, `sales`, `ads`, `academics_management`, `other`).
  - **Step-by-Step Assignment & Deadlines:** Chooses owners and deadlines for each step using autofill recommendations and offset presets.
  - **Plan Submission:** Submits drafted plans to the Creative Head for formal verification.
  - **Operational Interventions:** Can reassign steps, shift dates, skip unstarted steps, and resolve marked blockers.
  - **Team Workload Monitoring:** Analyzes real-time team capacity heatmaps (`<65% Healthy`, `65-85% High`, `>85% Overloaded`).
- **Strict Guardrails & Exclusions:**
  - Cannot approve deliverable steps (quality approval belongs strictly to Creative Head).
  - Cannot invite or suspend users.

---

### 2.4 Role: Executive (`executive`)
The executive viewer provides high-level transparency for organizational leadership.

- **Primary Menu Items (Max 8):** `Home`, `Plans`, `Tracker`, `Team Directory`, `Team Workload`, `Reports`.
- **Core Capabilities:**
  - Read-only visibility across all five calendars, active deliverables, production tracker, workload heatmaps, and aggregate reports.
  - Real-time observation of active pipeline progress and deliverable statuses.
  - Access to Team Chat in read-only observation mode.
- **Strict Privacy & Anti-Tamper Guardrails:**
  - **Zero Mutations:** Any POST/PATCH/DELETE request is rejected with `HTTP 403 Forbidden`. No action buttons exist in the UI.
  - **Contact Details Redacted:** Worker personal emails, mobile numbers, and WhatsApp links are stripped from the payload and replaced with privacy notices.
  - Cannot initiate chat messages or modify tasks.

---

## 3. Worker Specializations & Production Workspaces

All creative production workers share the system role `team_member`. Their individual capabilities and assignment eligibility are governed by their **Job Role**, their **Work Preferences**, and their specialized **Workspaces**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WORKER SPECIALIZATIONS                          │
├────────────────────┬─────────────────┬──────────────────┬──────────────┤
│ Specialization     │ Canonical Role  │ Work Preference  │ Workspace    │
├────────────────────┼─────────────────┼──────────────────┼──────────────┤
│ Copywriter / Script│ Writer          │ Content, Script  │ Writing      │
│ Graphic Designer   │ Designer        │ Design           │ Design       │
│ Videographer       │ Videographer    │ Shoot            │ Shoot        │
│ Video Editor       │ Video Editor    │ Edit             │ Edit         │
│ Social Specialist  │ Social Spec.    │ Post             │ Post         │
│ Multidisciplinary  │ Allrounder      │ Multiple         │ Dynamic      │
└────────────────────┴─────────────────┴──────────────────┴──────────────┘
```

---

### 3.1 Specialization 1: Writers (`Content` & `Script`)
Writers create copy for static graphics, carousel slides, brochures, and full audio/visual scripts for reels and videos.

- **Job Roles:** `Writer`, `SEO Specialist`.
- **Work Preferences:** `Content`, `Script`.
- **Assigned Deliverable Steps:**
  - `Content` step on Postable Designs (Static Post, Carousel Post, Story) and Non-Postable Designs.
  - `Script` step on Reels requiring original concepts.
- **Specialized Workspace: Writing Studio (`/work/:id/writing`):**
  - **Word-Style Editor:** Rich-text canvas with formatting, typography, headings, bulleted lists, and clean margins.
  - **Two-Column A/V Script Table:**
    - Column 1: `Visual / Scene / Framing` (shot descriptions, actors, visual cues).
    - Column 2: `Audio / Dialogue / Sound Effects` (voiceover, sound design, music cues).
    - Column 3: `Estimated Duration` (seconds breakdown).
  - **Side Utilities:**
    - **Hook Analyzer:** Evaluates opening 3-second hook for retention.
    - **Caption & Hashtag Box:** Tracks character limits across Instagram, LinkedIn, and YouTube.
    - **Auto Shot List Generator:** Automatically converts script visual rows into numbered shot items for the Videographer.
    - **Teleprompter:** Fullscreen scrolling prompter with variable scroll speed and adjustable font sizing.
    - **Document Import/Export:** Import `.docx` files directly; export to `.docx`, `.pdf`, or `.txt`.
- **Worker Actions:**
  - `Start Work`: Records `startedAt` and begins individual work timer.
  - `Submit for Review`: Hands off copy to the Creative Head in the Review Studio.

---

### 3.2 Specialization 2: Graphic Designers (`Design`)
Graphic Designers produce visual creatives across digital and print formats.

- **Job Roles:** `Designer`, `UI Designer`, `Design Lead (TL)`.
- **Work Preferences:** `Design`.
- **Assigned Deliverable Steps:**
  - `Design` step across all 14 design deliverable types (Carousels, Static Posts, Stories, Thumbnails, Meta Ads, Banners, Brochures, Certificates, Placement Posters).
- **Specialized Workspace: Design Workspace (`/work/:id/design`):**
  - **Side-by-Side Copy Viewer:** Displays the approved writer copy alongside the artboard upload zone.
  - **Dimension & Aspect Ratio Guides:** Built-in specs for 1:1 square, 4:5 portrait, 9:16 vertical stories, and print A4 dimensions.
  - **Carousel Ordering Tool:** Multi-slide image preview with drag-and-drop reordering.
  - **Format Support:** High-resolution PNG, JPG, and multi-page PDF previews.
- **Worker Actions:**
  - `Start Work`: Commences timer.
  - `Submit for Review`: Uploads final graphic files to the Creative Head.

---

### 3.3 Specialization 3: Videographers / Shooters (`Shoot`)
Videographers execute raw footage capture, b-roll recording, and studio shoots based on the approved script.

- **Job Roles:** `Videographer`.
- **Work Preferences:** `Shoot`.
- **Assigned Deliverable Steps:**
  - `Shoot` step on Reels where "Needs Shoot" is enabled.
- **Specialized Workspace: Clip-by-Clip Shoot Workspace (`/work/:id/shoot`):**
  - **Script & Shot List Reference:** Accordion displaying the approved script and numbered shot checklist.
  - **Individual Clip Upload:**
    - Chunked, resumable file uploads optimized for mobile and field shooting.
    - Metadata per clip: Scene/Shot number, Take number, Resolution (4K/1080p), FPS (24/60/120), and cameraman notes.
  - **Clip-by-Clip Review & Feedback Thread:**
    - WhatsApp-style discussion thread for each clip.
    - Creative Head reviews each clip individually (`Approve Clip` or `Reshoot Needed`).
    - The step completes only when all required shots are marked approved.
- **Worker Actions:**
  - `Start Shoot`: Commences production timer.
  - `Submit Footage`: Sends uploaded raw clips to Creative Head for footage review.

---

### 3.4 Specialization 4: Video Editors (`Edit`)
Video Editors take approved raw footage, sync audio, add visual effects, color grade, and assemble the final cut.

- **Job Roles:** `Video Editor`.
- **Work Preferences:** `Edit`.
- **Assigned Deliverable Steps:**
  - `Edit` step on all Reel deliverables.
- **Specialized Workspace: Edit Workspace (`/work/:id/edit`):**
  - **Raw Asset Hub:** Direct download links for all approved camera clips from the Videographer.
  - **Video Quality Checks:**
    - Aspect ratio enforcement (flags non-9:16 vertical videos).
    - Duration warnings (flags reels exceeding 90 seconds).
  - **Interactive Revision Checklist:** When revisions are requested, the Creative Head's second-by-second timestamps appear as an interactive checklist.
- **Worker Actions:**
  - `Start Editing`: Commences edit timer.
  - `Submit Final Cut`: Uploads MP4/MOV master video to the Creative Head.

---

### 3.5 Specialization 5: Social Media Specialists / Posters (`Post`)
Publishing owners download final approved assets and schedule or publish them live on social platforms.

- **Job Roles:** `Social Specialist`, `Social Media Manager`.
- **Work Preferences:** `Post`.
- **Assigned Deliverable Steps:**
  - `Post` step on all live deliverable types (Reel, Static Post, Carousel Post, Story).
- **Specialized Workspace: Post Workspace (`/work/:id/post`):**
  - **Asset Download Button:** Downloads approved video or graphic files in full fidelity.
  - **One-Click Caption & Hashtag Copy:** Copies verified copy with platform formatting preserved.
  - **Publishing Checklist:** Account verification, tag checks, audio attribution, and scheduling confirmation.
  - **Live URL Verification:** Input field to record the published post link (Instagram, LinkedIn, YouTube).
- **Worker Actions:**
  - `Mark as Posted`: Unlocks the live link input, captures the timestamp, and transitions the deliverable to `Posted` (Completed).

---

### 3.6 Specialization 6: Multidisciplinary Workers (`Allrounder`)
Workers possessing multiple work preferences (e.g. Content + Design, or Shoot + Edit).

- **Dynamic Workspace Selection:** The worker automatically gets the correct specialized workspace depending on which step of the deliverable they are currently executing.
- **Independent Round Timings:** If an allrounder owns both `Script` and `Edit`, each step records its own independent `startedAt`, work duration, and approval rating.

---

## 4. Universal Worker Capabilities & Screen Flows

### 4.1 My Work Dashboard (`/my-work`)
The home screen for every creative worker:
1. **"Right Now" Card:** Highlighting the current active step in progress with live elapsed time (`Working for 2h 15m`).
2. **Filter Tabs:** `All`, `In Progress`, `Next Up` (queued steps waiting for earlier stages), `Waiting for Approval`, `Revisions Needed`, `Completed`.
3. **Deliverable Cards:**
   - Displays topic title, deliverable type chip, calendar badge, and **due date only** (no shared countdown clocks).
   - **Pipeline Stepper (`PipelineStepper.tsx`):** A read-only stepper displaying the whole project lifecycle. Shows names of upstream and downstream teammates.
   - **Action Buttons (`getAvailableActions`):**
     - Step unstarted: `Start Work`
     - Step started: `Open Workspace` / `Submit for Review`
     - Encountered blocker: `Mark Blocked`
     - Active blocker: `Resolve Blocker`

### 4.2 Individual Work Timing Standards
- **Worker Starts Clock:** Elapsed time starts *only* when the worker clicks `Start Work`.
- **No Shared Clocks:** Workers are never shown countdown clocks based on the final publish date or another worker's timeline.
- **Paused Intervals:** If a worker marks a step `Blocked` or puts it in `Pending`, the elapsed work timer automatically pauses and resumes when resolved.

### 4.3 Transparency & Visibility Boundaries
- **Project Pipeline Visibility:** A worker can view the full pipeline of any deliverable they belong to (read-only).
- **Anti-Harvesting Isolation:** A worker cannot view deliverables or projects they have no steps in (`HTTP 404 Not Found`).
- **Review Comment Privacy:** Revision feedback is strictly private between the step owner and leadership.
- **Worker Profile Privacy:** Workers cannot access `/team` or view other workers' profiles (`HTTP 404`).

### 4.4 Worker Profile & Self-Settings (`/profile`)
- **Transparency Banner:** Alerts workers that their work history, timings, and ratings are visible to leadership.
- **Craftsmanship Metrics:** On-time completion rate, first-pass approval rate, average work time per step type.
- **Feedback & Ratings:** Average quality rating (shown only after 3 ratings are recorded to protect privacy) and constructive review feedback comments.
- **Edit Profile Modal:** Allows worker to edit preferred name, upload/crop photo avatar, manage language and skill tags, update bio, and verify/update phone numbers using 6-digit SMS OTP.

---

## 5. Summary Matrix: Roles, Permissions & Workspaces

| Capability / Screen | `admin` | `creative_head` | `sm_manager` | `executive` | `team_member` |
|---|:---:|:---:|:---:|:---:|:---:|
| **Access Requests & Invites** | Full | No | No | No | No |
| **User Role / Email Editing** | Full | No | No | No | No |
| **Create Calendar Plans** | Full | No | Full | No | No |
| **Approve Calendar Plans** | No | Full | No | No | No |
| **Autofill Step Assignment** | Full | No | Full | No | No |
| **Reassign / Shift Dates** | Full | No | Full | No | No |
| **Access Review Studio** | Full | Full | View | No | No |
| **Give 1-5 Star Ratings** | No | Full | No | No | No |
| **Request Revisions & Root Causes** | No | Full | No | No | No |
| **Execute Writing Studio** | No | No | No | No | If Assigned |
| **Execute Shoot Workspace** | No | No | No | No | If Assigned |
| **Execute Edit/Design Workspace** | No | No | No | No | If Assigned |
| **Execute Post Workspace** | No | No | No | No | If Assigned |
| **View Team Directory (`/team`)** | Full | Full | Full | Redacted | No (404) |
| **Edit Operational Details** | Full | Full | No | No | No |
| **Access Team Chat** | Full | Full | Full | Read-Only | Full |
| **Share Approved Asset to Chat** | Full | Full | Full | No | If Owner |

