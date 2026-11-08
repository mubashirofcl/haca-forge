# HACA Marketing OS — Role-Based Workspaces & Project Master Reference

**Document Version:** 3.0.0  
**Status:** Canonical Source of Truth  
**Codebase:** `haca-forge` (Monorepo: `@mmp/shared`, `@mmp/api`, `@mmp/web`)  
**Current System State:** 1653/1653 tests passing across 106 test files (API 1353 in 64 files, web 300 in 42 files); 0 TypeScript errors; clean web build (after the Phase 7 close-out)  
**Current Date:** 8 November 2026  

---

## Table of Contents
1. [Executive Summary & Project Mission](#1-executive-summary--project-mission)
2. [Current Architecture & Technology Stack](#2-current-architecture--technology-stack)
3. [The 5 Canonical Roles & Permissions Matrix](#3-the-5-canonical-roles--permissions-matrix)
4. [Exact Workspaces for Every Creative Worker](#4-exact-workspaces-for-every-creative-worker)
   - [4.1 Writing Studio (Copywriters & Scriptwriters)](#41-writing-studio-copywriters--scriptwriters)
   - [4.2 Design Workspace (Graphic Designers)](#42-design-workspace-graphic-designers)
   - [4.3 Clip-by-Clip Shoot Workspace (Videographers & Shooters)](#43-clip-by-clip-shoot-workspace-videographers--shooters)
   - [4.4 Edit Workspace (Video Editors)](#44-edit-workspace-video-editors)
   - [4.5 Post Workspace (Social Media Specialists & Posters)](#45-post-workspace-social-media-specialists--posters)
   - [4.6 Dynamic Workspace Router (Multidisciplinary Allrounders)](#46-dynamic-workspace-router-multidisciplinary-allrounders)
   - [4.7 Review Studio (Creative Head Quality Cockpit)](#47-review-studio-creative-head-quality-cockpit)
   - [4.8 Earlier Outputs Viewer (Downstream Asset Visibility)](#48-earlier-outputs-viewer-downstream-asset-visibility)
   - [4.9 Quality Ratings & Craftsmanship Engine](#49-quality-ratings--craftsmanship-engine)
5. [Universal Profile, Security & Mobile OTP Verification](#5-universal-profile-security--mobile-otp-verification)
   - [5.1 Direct Workspace Entry (Welcome Gate Removed)](#51-direct-workspace-entry-welcome-gate-removed)
   - [5.2 Edit Profile Modal with Mobile SMS OTP Verification](#52-edit-profile-modal-with-mobile-sms-otp-verification)
   - [5.3 Locked Official Email (Admin-Only Modification)](#53-locked-official-email-admin-only-modification)
   - [5.4 Team Directory & Worker Profile (Overview, Work, Performance, Ratings, Activity, Changes)](#54-team-directory--worker-profile)
   - [5.5 Universal Avatar Component & Canvas Cropper](#55-universal-avatar-component--canvas-cropper)
   - [5.6 Settings Hub (Security, Sessions, Notifications, Preferences)](#56-settings-hub-security-sessions-notifications-preferences)
6. [Workflow V2: Calendars, Plans, Pipelines & Content Flow](#6-workflow-v2-calendars-plans-pipelines--content-flow)
   - [6.1 The 5 Creative Calendars](#61-the-5-creative-calendars)
   - [6.2 The 15 Supported Deliverable Types](#62-the-15-supported-deliverable-types)
   - [6.3 Backward Due-Date Offset Formulas](#63-backward-due-date-offset-formulas)
   - [6.4 Step Deadlines Row Form & Autofill Suggestions](#64-step-deadlines-row-form--autofill-suggestions)
   - [6.5 Individual Timing & Content Flow Tracker](#65-individual-timing--content-flow-tracker)
7. [Operations: Dashboards, Workload, Automations & Reports](#7-operations-dashboards-workload-automations--reports)
   - [7.1 Operational Dashboard by Role](#71-operational-dashboard-by-role)
   - [7.2 Workload & Capacity Engine](#72-workload--capacity-engine)
   - [7.3 Background Reminders](#73-background-reminders-worker-jobs-no-screen)
   - [7.4 Live Reports](#74-live-reports-reports)
8. [Security, Session Management & Audit Logging](#8-security-session-management--audit-logging)
9. [Team Chat & Communications System](#9-team-chat--communications-system)
   - [9.1 Channels (Team Chat, Specialist Groups, Private DMs)](#91-channels-team-chat-specialist-groups-private-dms)
   - [9.2 Real-time Messaging, Reactions, Mentions & Pinning](#92-real-time-messaging-reactions-mentions--pinning)
   - [9.3 Cross-Workspace Share-to-Chat Asset Bridge](#93-cross-workspace-share-to-chat-asset-bridge)
10. [Verification Status & Test Metrics](#10-verification-status--test-metrics)

---

# 1. Executive Summary & Project Mission

**HACA Marketing OS** is the centralized operational platform powering the creative production, planning, review, and publishing workflows of HACA's in-house marketing team.

### Primary Operational Mandates
1. **Work & Team Management Only:** Following the Major Scope Reset, all non-operational modules (Leads, LSQ, Funnels, Campaigns, Targets, Multi-Brand Profiles) were completely excised.
2. **Specialized Role Workspaces:** Production specialists (Writers, Designers, Shooters, Editors, Posters) work inside dedicated, tailored studios—never in loose file-link forms.
3. **Quality Gatekeeping via Review Studio:** Creative Head verifies all stages with mandatory 1–5 star ratings, anchored annotations, and structured revision root causes.
4. **Individual Timing Standards:** Each worker's time is measured strictly from their own click on `Start Work`. There are zero shared countdown clocks or artificial pressure timers derived from publish dates.
5. **Dignity & Privacy Safeguards:** Strictly zero leaderboards, zero worker-to-worker comparisons, zero monitoring beyond logged timestamps, and `HTTP 404` isolation on unauthorized projects.

---

# 2. Current Architecture & Technology Stack

The platform is structured as an npm monorepo with strict module boundaries:
* **`apps/api` (Backend):** Node 22 LTS, Express 5 (ESM), MongoDB with Mongoose, Zod `.strict()` validation, CASL attribute-based authorization, JWT in `httpOnly` secure cookies, BullMQ with Redis, Socket.IO 4.x real-time gateway, Pino structured logging, nodemailer-style mailer adapter.
* **`apps/web` (Frontend):** React 18, Vite 6, TypeScript, Tailwind CSS with Soft-Glass Glassmorphism design tokens, TanStack React Query, FullCalendar, Recharts, Lucide React icons.
* **`packages/shared` (`@mmp/shared`):** Universal types, enums, backward offset formulas, duration helpers, Zod validation schemas compiled cleanly via `tsup`.

---

# 3. The 5 Canonical Roles & Permissions Matrix

The system enforces 5 clean canonical roles across all endpoints, navigations, and pages:

```
+-----------------------------------------------------------------------------------------------------------------------------+
| CAPABILITY / PERMISSION             | admin         | creative_head   | sm_manager    | team_member   | executive (Read-Only)       |
+-----------------------------------------------------------------------------------------------------------------------------+
| System Administration & Access      | Full          | Denied          | Denied        | Denied        | Denied                      |
| People Setup & Capacity Config      | Full          | View / Edit     | View / Assign | View (Masked) | View (Masked)               |
| Create & Submit Content Plans       | Full          | Denied          | Full          | Denied        | Read-Only                   |
| Approve / Reject Content Plans      | Full          | Full (Primary)  | Denied        | Denied        | Read-Only                   |
| Content Flow Tracker (All Columns)  | Full          | Full            | Full (Primary)| Step-Scoped   | Read-Only                   |
| Edit Active Step Deliverable        | Full (Override| Denied          | Denied        | Own Step Only | Denied                      |
| Review Studio & Deliverable Decision| Full          | Full (Primary)  | Denied        | Denied        | Denied                      |
| Submit Craftsmanship Rating (1-5★)  | Denied        | Full (Primary)  | Denied        | Denied        | Denied                      |
| Edit Registered Official Email      | Full          | Denied          | Denied        | Denied        | Denied                      |
| View Teammate Contact Details       | Visible       | Visible         | Visible       | Hidden        | Hidden                      |
| View Team Directory (`/team`)       | All Users     | All Users       | All Users     | Denied (404)  | All (Masked)                |
| Team Chat Access (`chat.use`)       | Full          | Full            | Full          | Full          | Read-Only (`chat.read`)     |
| Create Groups (`chat.group.create`) | Full          | Full            | Full          | Denied        | Denied                      |
| Direct Messaging (1-to-1 DMs)       | Active Users  | Active Users    | Active Users  | Active Users  | Denied (Executive Excluded) |
| Navigation Menu Limit               | <= 8 items    | <= 8 items      | <= 8 items    | <= 8 items    | <= 8 items                  |
+-----------------------------------------------------------------------------------------------------------------------------+
```

---

# 4. Exact Workspaces for Every Creative Worker

Every creative stage in a pipeline produces a typed submission within a specialized role studio.

```
                  [ Content Piece Created from Approved Plan ]
                                       |
                                       v
                     [ 1. CONTENT / SCRIPT STAGE ]
                       Writing Studio (/work/:id/writing)
                                       |
                                       v
                     [ Creative Head Review in Review Studio ]
                                       | Approved (1-5★)
                                       v
                     [ 2. SHOOT STAGE (Videographer) ]
                       Clip-by-Clip Shoot Studio (/work/:id/shoot)
                                       |
                                       v
                     [ Creative Head Review in Review Studio ]  <-- (Shoot is a Review Step!)
                                       | Approved (1-5★)
                                       v
                     [ 3. EDIT STAGE (Video Editor) ]
                       Edit Workspace (/work/:id/edit)
                                       |
                                       v
                     [ Creative Head Review in Review Studio ]
                                       | Approved (1-5★)
                                       v
                     [ 4. DESIGN STAGE (Graphic Designer) ]
                       Design Workspace (/work/:id/design)
                                       |
                                       v
                     [ Creative Head Review in Review Studio ]
                                       | Approved (1-5★)
                                       v
                     [ 5. POST STAGE (Social Media Specialist) ]
                       Post Workspace (/work/:id/post)
                                       |
                                       v
                     [ Published & Archived in Terminal State ]
```

---

### 4.1 Writing Studio (Copywriters & Scriptwriters)
* **Route:** `/work/:id/writing`
* **Target Workers:** `Writer`, `SEO Specialist` (Work preferences: `Content`, `Script`).
* **Assigned Steps:** `Content` on postable and non-postable design types; `Script` on Reels.

```
+---------------------------------------------------------------------------------------------------+
| [< Back to My Work]   Topic: Admissions Reel - Script            [Status: In Progress] [Submit]   |
+---------------------------------------------------------------------------------------------------+
| Ribbon: [Home] [Insert] [Script Table] [Review] [View] [File]                                     |
| Toolbar: [Undo/Redo] [Font: Manjari v] [Size: 12 v] [B I U S] [Align] [Styles v] [Table]          |
+-----------------------------------------------------+---------------------------------------------+
| [DOCUMENT CANVAS (True A4: 210mm x 297mm)]          | [COLLAPSIBLE DOCKED SIDEBAR]                |
|                                                     |                                             |
| Page 1 of 1                                         | Tabs: [Brief] [Script Tools] [Comments]     |
| Title: Next Gen Robotics & Tech                     |                                             |
| Hook: "Nobody told me tech school was like this..." | BRIEF:                                      |
|                                                     | Objective: Highlight tech student autonomy  |
| Two-Column Scene Table:                             | Target Audience: Prospective tech applicants|
| +-------+------------------------+----------+-----+ |                                             |
| | Scene | Visual (Action)        | Audio    | Est | | SCRIPT TOOLS:                               |
| +-------+------------------------+----------+-----+ | - Spoken Duration: 52s / Target 60s [PASS]  |
| | 1     | Student reacts to bot  | Voice... | 4s  | | - Hook Check: 9 words (<12 limit) [PASS]    |
| | 2     | Robot arm precision    | FX...    | 8s  | | - Captions & Hashtags: [Copy]             |
| +-------+------------------------+----------+-----+ | - Auto Shot List: 4 shots extracted         |
+-----------------------------------------------------+---------------------------------------------+
| Status: Page 1 of 1 | 148 Words | 912 Chars | Zoom: 100% | Single-Editor Lock: Active | [Saved ✓]   |
+---------------------------------------------------------------------------------------------------+
```

#### Exact Features & Utilities:
1. **True A4 Canvas:** Real A4 aspect layout ($210\text{mm} \times 297\text{mm}$) with standard margins, zoom controls ($50\%$, $75\%$, $100\%$, $125\%$), and print stylesheet (`@media print`).
2. **Two-Column A/V Script Table:** Formats production scripts into `Visual / Scene / Framing`, `Audio / Dialogue / Sound Effects`, and `Estimated Time (s)`.
3. **Spoken Duration Estimator:** Evaluates word count against a spoken speech baseline of $130\text{ WPM}$ with instant compliance chips for $15\text{s}$, $30\text{s}$, $60\text{s}$, and $90\text{s}$ targets.
4. **Hook Length Checker:** Inspects the first 1–2 sentences / 3 seconds of spoken audio and flags opening lines exceeding 12 words.
5. **Auto Shot List Extractor:** Converts rows from the `Visual` column into an ordered, numbered shot checklist for the Videographer with one click.
6. **No caption box (Phase 5d):** Script and Content submit the document, a Drive link, or both. Caption and hashtags are written by the poster on the Post step.
7. **Malayalam Typographic Fidelity:** Zero-ligature corruption using Google Fonts (**Manjari** / **Gayathri**) for Malayalam Unicode (`U+0D00` to `U+0D7F`).
8. **Teleprompter Mode:** Fullscreen scrolling prompter with variable scroll speed, font resizing, and reverse mirror toggle.
9. **Native File Exchange:** Direct `.docx` file import and clean `.docx`/`.txt` export without third-party cloud services.
10. **Autosave & Single-Editor Lock:** Buffers edits locally during network hiccups and enforces a single-editor lock to avoid overwrite collisions.

---

### 4.2 Design Workspace (Graphic Designers)
* **Route:** `/work/:id/design`
* **Target Workers:** `Designer`, `UI Designer`, `Design Lead (TL)` (Work preference: `Design`).
* **Assigned Steps:** `Design` across all 14 design deliverable types.

```
+---------------------------------------------------------------------------------------------------+
| [< Back to My Work]   Topic: Admissions Carousel - Visuals       [Status: In Progress] [Submit]   |
+---------------------------------------------------------------------------------------------------+
| LEFT PANE: DOCKED APPROVED COPY (35%)               | RIGHT PANE: ARTBOARD & ASSET UPLOAD (65%)   |
|                                                     |                                             |
| Approved Copy (Writer: Test Writer One):            | CAROUSEL SLIDE MANAGER (Drag to Reorder):   |
| Headline: "Transform Your Tech Career"  [Copy]      | [Slide 1: Cover] [Slide 2] [Slide 3] [+]    |
| Subhead: "Admissions Open for 2027"     [Copy]      |                                             |
| Slide 1 Body: "Join 1000+ engineers..." [Copy]      | DROP ZONE (PNG, JPG, WebP <= 20MB, PDF <= 50MB):|
| CTA: "Link in bio to apply now"         [Copy]      | [ Upload Finished Visuals / Drag & Drop ]   |
|                                                     |                                             |
| DIMENSION PRESET GUIDES:                            | ACTIVE SLIDE PREVIEW:                       |
| [✓ 1:1 Square (1080x1080)]                          | +-----------------------------------------+ |
| [  4:5 Portrait (1080x1350)]                        | |                                         | |
| [  9:16 Story (1080x1920)]                          | |           [ Artboard Image ]            | |
| [  A4 Document (2480x3508)]                         | |                                         | |
|                                                     | +-----------------------------------------+ |
+-----------------------------------------------------+---------------------------------------------+
```

#### Exact Features & Utilities:
1. **Docked Content Copy:** Verified writer copy displayed beside the upload zone with 1-click clipboard copy per section (`Headline`, `Subhead`, `Body`, `CTA`).
2. **Carousel Slide Manager:** Multi-slide image preview with drag-and-drop reordering, slide numbering, and sequence indicators.
3. **Preset Dimension Guides:** Visual spec indicators for 1:1 Square ($1080\times 1080$), 4:5 Portrait ($1080\times 1350$), 9:16 Vertical Story ($1080\times 1920$), and A4 Print ($2480\times 3508$).
4. **High-Fidelity Formats:** Uploads PNG, JPG, WebP up to 20 MB each; multi-page vector PDFs up to 50 MB.
5. **Side-by-Side Revision Review:** In subsequent revision rounds, previous reviewer comments dock alongside current uploads.

---

### 4.3 Clip-by-Clip Shoot Workspace (Videographers & Shooters)
* **Route:** `/work/:id/shoot`
* **Target Workers:** `Videographer` (Work preference: `Shoot`).
* **Assigned Steps:** `Shoot` on Reels requiring raw footage recording.

```
+---------------------------------------------------------------------------------------------------+
| [< Back to My Work]   Topic: Student Robotics Reel - Shoot       [Status: In Progress] [Submit]   |
+---------------------------------------------------------------------------------------------------+
| ACCORDION: APPROVED SCRIPT & SHOT LIST (Click to Expand)                                          |
| Shot 1: Close-up of robot claw [ ] | Shot 2: Student reaction wide [ ] | Shot 3: Over-shoulder [ ]|
+---------------------------------------------------------------------------------------------------+
| UPLOAD CAMERA CLIPS (Phone Supported, Chunked Resumable <= 500MB):                                |
| [ + Select Video Clips from Device / Camera Roll ]                                                |
+---------------------------------------------------------------------------------------------------+
| CLIP GALLERY & PER-CLIP FEEDBACK THREADS:                                                         |
|                                                                                                   |
| Clip #1: Take 1 - Robot Claw Close.mp4                                                            |
| Tags: [Scene 1] [Take 1] [4K 60fps]   Status: [✓ Approved by Creative Head]                       |
| Chat: Creative Head: "Focus pull is razor sharp. Approved." (10:14 AM)                            |
|                                                                                                   |
| Clip #2: Take 2 - Student Reaction Wide.mp4                                                       |
| Tags: [Scene 2] [Take 2] [4K 24fps]   Status: [⚠️ Reshoot Needed]                                 |
| Chat: Creative Head: "Too underexposed in the shadow area. Please recapture." (10:15 AM)         |
| [ Replace Clip / Upload Retake ]                                                                  |
+---------------------------------------------------------------------------------------------------+
| STEP STATUS: 2 of 3 Clips Approved   [ Submit Shoot for Creative Head Verification ]              |
+---------------------------------------------------------------------------------------------------+
```

#### Exact Features & Utilities:
1. **Elevation as a Review Step:** Downstream `Edit` step remains strictly locked until the Creative Head approves the `Shoot` submission.
2. **Shot List Checklist:** Direct accordion integration displaying the writer's numbered visual shot list with interactive progress checkmarks.
3. **Chunked Resumable Upload:** Phone-friendly upload handling raw camera clips (MP4, MOV, WebM) up to 500 MB per clip with automatic pause, resume, and retry on cellular drops.
4. **Per-Clip Metadata:** Records Scene/Shot #, Take #, Resolution (4K/1080p), FPS (24/60/120), and cameraman field notes.
5. **WhatsApp-Style Discussion Thread per Clip:** Each clip has an anchored discussion thread with timestamps, seen ticks, and individual review decisions (`Approve Clip` or `Reshoot Needed`). Only rejected clips require replacement.

---

### 4.4 Edit Workspace (Video Editors)
* **Route:** `/work/:id/edit`
* **Target Workers:** `Video Editor` (Work preference: `Edit`).
* **Assigned Steps:** `Edit` on all Reel deliverables.

```
+---------------------------------------------------------------------------------------------------+
| [< Back to My Work]   Topic: Student Robotics Reel - Video Edit  [Status: In Progress] [Submit]   |
+---------------------------------------------------------------------------------------------------+
| LEFT PANE: RAW FOOTAGE & SCRIPT TIMELINE (40%)      | RIGHT PANE: MASTER CUT UPLOAD & CHECKS (60%)|
|                                                     |                                             |
| APPROVED CAMERA FOOTAGE (3 Clips):                  | MASTER CUT UPLOAD (MP4, MOV <= 500MB):      |
| * Clip 1: Robot Claw (Take 1) [Preview] [Download]  | [ Drop Rendered Master Video File Here ]    |
| * Clip 2: Student Wide (Take 3) [Preview] [Download]|                                             |
|                                                     | PRE-FLIGHT COMPLIANCE CHECKS:               |
| APPROVED SCRIPT & AUDIO BREAKDOWN:                  | [✓ Aspect Ratio: 9:16 Vertical Detected]    |
| 00:00 - 00:04: Hook ("Nobody warned me...")         | [✓ Duration: 58 seconds (<90s Limit)]       |
| 00:04 - 00:18: Scene 1: Robotics lab action         |                                             |
|                                                     | REVISION CHECKLIST (From Creative Head):    |
| [ Download Raw Assets Zip Bundle ]                  | [x] 00:12: Trim robot arm cut 1s earlier    |
|                                                     | [x] 00:38: Boost vocal track by +2dB        |
+-----------------------------------------------------+---------------------------------------------+
```

#### Exact Features & Utilities:
1. **Raw Asset Hub:** Direct in-browser stream preview and 1-click batch download of all approved camera clips from the Videographer.
2. **Script Timestamp Synchronization:** Approved script lines render beside the footage with exact timecode estimates.
3. **Non-Blocking Pre-Flight Checks:**
   - **Aspect Ratio Check:** Warns if video is not 9:16 vertical ($1080\times 1920$).
   - **Duration Check:** Warns if runtime exceeds 90 seconds.
4. **Interactive Revision Checklist:** When revisions are requested, the Creative Head's timestamped notes render as an interactive checklist that the editor ticks off before re-submitting.
5. **Rendered Cut Upload:** Master cut upload up to 500 MB with version tracking (Cut v1, Cut v2).

---

### 4.5 Post Workspace (Social Media Specialists & Posters)
* **Route:** `/work/:id/post`
* **Target Workers:** `Social Specialist`, `Social Media Manager` (Work preference: `Post`).
* **Assigned Steps:** `Post` on all live deliverable types (Reels, Static Posts, Carousels, Stories).

```
+---------------------------------------------------------------------------------------------------+
| [< Back to My Work]   Topic: Student Robotics Reel - Post        [Status: In Progress]            |
+---------------------------------------------------------------------------------------------------+
| APPROVED MASTER ASSETS:                                                                           |
| [ Download Final Master Video (1080x1920 MP4) ]   [ Download Master Thumbnail Cover Image ]       |
+---------------------------------------------------------------------------------------------------+
| ONE-CLICK METADATA EXPORTERS:                                                                     |
| Caption:  "Nobody warned me that robots could learn this fast..."                [ Copy Caption ] |
| Hashtags: "#HACA #Robotics #TechSchool #FutureEngineers #Innovation"             [ Copy Hashtags ]|
+---------------------------------------------------------------------------------------------------+
| PLATFORM PRE-PUBLISH CHECKLIST:                                                                   |
| [x] Verified 9:16 mobile framing and audio clarity.                                               |
| [x] Tagged @hacaschool and industry partners.                                                     |
| [x] Attached application link sticker in story/bio.                                               |
+---------------------------------------------------------------------------------------------------+
| PUBLISH CONFIRMATION:                                                                             |
| Live URL: [ https://www.instagram.com/reel/C7x9z... ]   Publish Time: [ 03/11/2026, 05:30 PM ]    |
| [ ✓ Mark as Posted & Complete Deliverable ]                                                       |
+---------------------------------------------------------------------------------------------------+
```

#### Exact Features & Utilities:
1. **Pre-Publish Master Bundle:** Downloads the final verified video master or graphic files in full production fidelity.
2. **Caption and hashtags (Phase 5d):** Written here by the poster (caption required to post, hashtags optional), with Instagram ($2,200$) and LinkedIn ($3,000$) counters and Copy buttons. Saved on the Post step when it is marked posted; the content piece is validated first.
3. **Platform Checklist:** Verifies account tags, cover frames, audio attribution, and bio links.
4. **Live URL Verification:** Captures the public live URL and exact timestamp, automatically moving the deliverable into terminal `Posted` state.

---

### 4.6 Dynamic Workspace Router (Multidisciplinary Allrounders)
* **Target Workers:** `Allrounder` (Workers with multiple work preferences like Content + Design or Shoot + Edit).
* **Behavior:** When opening work from `/my-work`, the application dynamically inspects the deliverable's active stage and mounts the matching specialized studio:
  - If working `Script` -> Mounts Writing Studio (`/work/:id/writing`).
  - If working `Shoot` -> Mounts Shoot Workspace (`/work/:id/shoot`).
  - If working `Edit` -> Mounts Edit Workspace (`/work/:id/edit`).
  - If working `Design` -> Mounts Design Workspace (`/work/:id/design`).
  - If working `Post` -> Mounts Post Workspace (`/work/:id/post`).
* **Independent Metrics:** Each step captures its own separate `startedAt` timestamp, work duration, and quality rating.

---

### 4.7 Review Studio (Creative Head Quality Cockpit)
* **Route:** `/feedback/review-studio/:id` (and `/feedback`)
* **Target Users:** `creative_head`, `admin`.

```
+---------------------------------------------------------------------------------------------------+
| [Queue: Waiting for approval (5)]   < Prev [2 of 5] Next >   Topic: Student Robotics Reel (Cut v2)|
+---------------------------------------------------------------------------------------------------+
| LEFT PANE: SUBMISSION VIEWER (70%)                  | RIGHT PANE: CONTEXT & COMMENTS (30%)        |
|                                                     |                                             |
| [Tabs: Current v2 | Version Diff | Previous v1]     | DELIVERABLE DETAILS:                        |
|                                                     | Due Date: 2026-11-12 | Type: Reel           |
| Video Player (0.5x, 1x, 1.25x, 1.5x, 2x)            | Assigned Worker: Test Editor One            |
| [===================O================] 00:24/00:58  | Queue Aging: 1 day in queue                 |
|                                                     |                                             |
| Timeline Pins:                                      | UPSTREAM ARTIFACTS:                         |
|  * 00:12: "Cut 1s earlier here"                     | - Approved Script [View]                    |
|  * 00:38: "Audio dip is too steep"                  | - Approved Raw Footage (3 clips) [View]     |
|                                                     |                                             |
|                                                     | ANCHORED COMMENTS:                          |
|                                                     | CH (00:12): "Trim handle before robot drop" |
+---------------------------------------------------------------------------------------------------+
| DECISION BAR:                                                                                     |
| Rating: ★ ★ ★ ★ ☆ (4 - Good)   Tags: [+ Great hook] [+ Clear message] [- Needs polish]           |
| Feedback Note: "Excellent color grade and pacing. Audio volume normalized. Approved."             |
| [ Request Revision (Requires Root Cause) ]             [ ✓ Approve Deliverable (Advance Next >) ] |
+---------------------------------------------------------------------------------------------------+
```

#### Exact Decision Rules:
1. **FIFO Queue Navigation:** Oldest submissions appear first with queue aging tags. Approving or requesting revisions auto-advances to the next item.
2. **Interactive Annotation Pins:** Video timeline pins (`00:24`) and image coordinate pins (`X, Y`) anchored directly to the creative canvas.
3. **Mandatory 1 to 5 Star Quality Rating:** Approval requires awarding 1 to 5 stars, contributing to the worker's craftsmanship profile.
4. **Structured Revision Categorization:** Revisions require categorizing the issue into 1 of 7 standard root causes (`Brief unclear`, `Creative direction unclear`, `Skill gap`, `Feedback inconsistency`, `Excessive scope change`, `Approval delay`, `Client/business requirement changed`) alongside specific, actionable notes.

---

### 4.8 Earlier Outputs Viewer (Downstream Asset Visibility)
* **Component:** `<EarlierOutputsViewer />`
* **Purpose:** Enables downstream creative specialists (e.g. an Editor inspecting the approved Script and raw Shoot clips) to inspect all upstream assets in read-only mode without navigating away from their studio.
* **Security Isolation:** Accessible only to specialists assigned to that specific content piece; unauthorized workers receive `HTTP 404`.

---

### 4.9 Quality Ratings & Craftsmanship Engine
* **Component:** `<RatingsFeedbackSection />`
* **Mounts:** `/profile`, `/team/:id`.
* **Guardrails:**
  - **3-Rating Minimum Threshold:** Average score is strictly hidden (showing *"Collecting baseline"*) until the worker receives at least 3 ratings to prevent statistical distortion.
  - **Zero Leaderboards:** Ratings are strictly private between the worker and leadership. Worker-to-worker comparisons are technically impossible.
  - **Coaching Purpose:** Institutional notice confirms ratings represent craftsmanship feedback, decoupled from compensation or automated penalties.

---

# 5. Universal Profile, Security & Mobile OTP Verification

### 5.1 Direct Workspace Entry (Welcome Gate Removed)
* The mandatory `/welcome` onboarding blocker was completely removed. Authenticated users transition directly into `/my-work` (workers) or `/dashboard` (leadership).
* Navigating to `/welcome` automatically redirects to `/profile`.

### 5.2 Edit Profile Modal with Mobile SMS OTP Verification
* Mounted on `/profile` (self) and `/team/:id` (admin).
* **Avatar Upload & Crop:** Triggers `AvatarCropModal` for interactive circular cropping.
* **Personal Attributes:** Full legal name (required), preferred display nickname, bio with live 500-character counter, spoken languages (max 5 tags), skills (max 10 tags).
* **WhatsApp Sync:** Checkbox to automatically sync WhatsApp number with mobile number.
* **Mobile Phone SMS OTP Verification:**
  - Phone input field with country code support.
  - Status indicator: `Verified ✓` in emerald or `Verification Required` in amber.
  - Modifying the phone number reveals the **OTP Verification Box**.
  - User clicks `"Send OTP"` (dispatches 6-digit code via `POST /api/me/phone-otp/send`).
  - User enters 6-digit code and clicks `"Verify Code"` (`POST /api/me/phone-otp/verify`).
  - 30-second countdown timer for resending OTP.
  - Saving profile changes is strictly disabled until the modified phone number is verified.

### 5.3 Locked Official Email (Admin-Only Modification)
* On the Edit Profile modal, the official registered email is **read-only and locked with a 🔒 badge** for regular users.
* Notice explains: *"Registered email cannot be changed by the user. Contact an administrator to request an email update."*
* Backend schema (`profileUpdateSchema`) strictly rejects email modification attempts. Only administrators can modify a user's email via `PATCH /api/team/:id`.

### 5.4 Team Directory & Worker Profile
* **Team Directory (`/team`):** Filterable, searchable directory for leadership. Displays avatar, name, role, department, load band, and 'Right Now' deliverable. Whitelist sorting: `name`, `department`, `jobRole`, `load` (zero sorting by rating or speed).
* **Worker Profile (`/team/:id` and `/profile`):**
  - **Overview Tab:** Right Now active work with live elapsed timer, Next Up queue, 8-week load trend chart (`recharts`), work breakdown by calendar.
  - **Work Tab:** Historical assigned steps with timeline traces (`assignedAt`, `startedAt`, `submittedAt`, `approvedAt`, `postedAt`) and paused interval logs.
  - **Performance Tab:** On-time rate, average days late, first-pass approval rate, revision rate, average work time by step type. Anti-ranking guarantee notice.
  - **Ratings Tab:** Score distribution and qualitative coaching notes ($\ge 3$ threshold enforced).
  - **Activity Tab:** Operational domain events (assignments, starts, submissions, decisions).
  - **Changes Tab:** Audit log of modifications to operating fields (`jobRole`, `departmentId`, `capacity`). Visible only to `admin` and `creative_head`.

### 5.5 Universal Avatar Component & Canvas Cropper
* **Component:** `<Avatar />` (Sizes: `xs` 20px, `sm` 28px, `md` 40px, `lg` 48px, `xl` 80px).
* Deterministic high-saturation gradient calculated from the user's ID hash.
* Zero presence dot indicators (no green online pips, protecting worker privacy).
* **Cropping Modal:** `<AvatarCropModal />` featuring HTML5 2D Canvas circular crop with zoom slider, drag-pan, and instant preview.

### 5.6 Settings Hub (Security, Sessions, Notifications, Preferences)
* **Route:** `/settings`
* **Security Tab:** Password change (min 8 chars, 1 uppercase, 1 digit) with 5-attempt rate limiter, active device session tracking with single or batch revocation.
* **Notifications Tab:** In-app and email category toggles (steps, approvals, comments, deadlines, chat). Mandatory security notices cannot be disabled.
* **Preferences Tab:** Default start page, date/time format, week start day.

---

# 6. Workflow V2: Calendars, Plans, Pipelines & Content Flow

### 6.1 The 5 Creative Calendars
The application is single-brand (HACA only). Plans are organized under 5 calendar keys:
1. `sm` — Social Media
2. `sales` — Sales Team
3. `ads` — Ads Team
4. `academics_management` — Academics & Management
5. `other` — Other

### 6.2 The 15 Supported Deliverable Types
1. `Reel` (Video deliverable)
2. `Static Post` (Single visual)
3. `Carousel Post` (Multi-slide)
4. `Story` (24h vertical)
5. `Cover Image`
6. `Thumbnail`
7. `Meta Ads Creative`
8. `Class Announcement`
9. `Orientation Creative`
10. `Graduation Creative`
11. `Brochure`
12. `Certificate`
13. `Offer Creative`
14. `Placement Poster`
15. `Custom Request`

### 6.3 Backward Due-Date Offset Formulas
Relative to the target publish date ($F$):
* **Postable Design (Static, Carousel, Story):** Content $F-5$, Design $F-2$, Post $F$.
* **Non-Postable Design:** Content $F-5$, Design $F-2$ (Handover on $F$).
* **Reel (Script & Shoot):** Script $F-8$, Shoot $F-5$, Edit $F-2$, Post $F$.
* **Reel (Shoot only):** Shoot $F-5$, Edit $F-2$, Post $F$.
* **Reel (Edit only):** Edit $F-2$, Post $F$.

### 6.4 Step Deadlines Row Form & Autofill Suggestions
* In the plan creation modal, selecting a deliverable type reveals its required steps.
* Each step displays: Step Name, Owner selector, and Deadline Date Picker.
* Autofill algorithm suggests available specialists with matching work preferences, workload $<85\%$, and earliest availability.
* Date offsets show helper badges (`5 days before publish`). Values edited by the manager show `"Set by you"`.

### 6.5 Individual Timing & Content Flow Tracker
* **Route:** `/calendar?tab=tracker`
* Displays deliverable topic, calendar badge, active holder, pipeline step progress, days late, elapsed work time, and approval wait.
* Timing is display-only; no automated actions or penalties occur after any duration.

---

# 7. Operations: Dashboards, Workload, Automations & Reports

### 7.1 Operational Dashboard by Role (`/dashboard`)
* `admin`: System KPIs, access requests, user distribution, active blockers.
* `creative_head`: Review queue aging, pending plans, revision rate trends.
* `sm_manager`: Calendar publishing schedule, unassigned stages, team load breakdown.
* `executive`: High-level operational throughput (all read-only).
* `team_member`: Redirected immediately to `/my-work`.

### 7.2 Workload & Capacity Engine (`/workload`)
* Evaluates weekly capacity hours (40h standard) against active stage allocations.
* Real, unclamped utilization percentages ($120\%$ displayed honestly).
* Bands: Healthy ($<65\%$), High ($65-85\%$), Overloaded ($>85\%$).

### 7.3 Background Reminders (worker jobs; no screen)
4 rules run in the background worker (Phase 7 removed them from the Reports page and removed the automation API):
1. Overdue notice: once a step is overdue by the IST day rule (from the day after its due date; locked steps skipped), the owner is notified once and one SM manager (the step's department's, else any) once the same day. No hour-based escalation, no repeats.
2. Idle step: open steps with no status change for 3+ days.
3. Blocker dependency reminders to the dependency owner.
4. Revision pattern flag: flags a step when it reaches round 4 and alerts creative heads and admins when a flag stays unclassified for 48 hours. No comparison with a worker's own average. The Dashboard lists flags by project and step.
The scheduled report emails (weekly report, month-end scorecard) were retired in Phase 7: their jobs log "retired" and do nothing, and their queue schedules are removed at startup.

### 7.4 Live Reports (`/reports`)
Live, team-level figures (Phase 7), filtered by month (publish date, IST), calendar and step type:
1. Overview: delivered, on time, overdue, blocked; weekly delivered vs on-time line.
2. Overdue and Issues: open overdue, done late and active blocker lists (owner per row, sorted by due date); bars by calendar and step type.
3. Production: planned vs delivered by calendar and type; planned vs posted per week.
4. Quality: rating distribution (one rating per step), "Reviewed steps approved first time", revision root causes (7 categories).
5. Projects: per-project KPIs, linking to the read-only Project KPI page (`/reports/projects/:id`).
CSV per table (the same cells as the screen) and a print layout (`/reports/print`) for Save as PDF. No rankings: nothing is grouped, counted or sorted by person.

---

# 8. Security, Session Management & Audit Logging

* **Authentication:** JWT access tokens and rotating refresh tokens in `httpOnly`, `SameSite=Lax` cookies.
* **Session Tracking:** `Session` collection records browser/OS label, IP hash, and last used timestamp.
* **Audit Trail (`ActivityEvent`):** Records operational modifications with zero-value logging (never logs passwords or sensitive payloads).
* **Anti-Harvesting Boundaries:** Strict controller-level authorization checks prevent unauthorized data scraping.

---

# 9. Team Chat & Communications System

* **Route:** `/chat` and `/chat/:channelId`
* **Real-time Gateway:** Socket.IO 4.x with authenticated handshakes.

### 9.1 Channels
1. **Team Chat (`type: 'team'`):** Universal singleton channel for the entire company. Executive is read-only.
2. **Specialist Groups (`type: 'group'`):** Created by Admin, Creative Head, or SM Manager for specific projects.
3. **Direct Messages (`type: 'dm'`):** Private 1-to-1 conversations between active non-executive users. Admin cannot read DMs.

### 9.2 Real-time Messaging, Reactions, Mentions & Pinning
* Markdown-safe messages up to 4,000 characters.
* 6 quick emoji reactions (`👍`, `❤️`, `😂`, `🎉`, `👀`, `✅`).
* `@mentions` with autocomplete; `@everyone` restricted to leadership.
* Pinned messages drawer in channel headers.

### 9.3 Cross-Workspace Share-to-Chat Asset Bridge
* Creative specialists in Shoot, Edit, Design, and Review workspaces can share approved creative assets directly into chat channels.
* Renders an interactive `<MediaCardPlayer />` embed with preview, title, stage badge, and direct review link.
* Revoking the share grant instantly disables the media player card.

---

# 10. Verification Status & Test Metrics

### Monorepo Test Summary (after the Phase 7 close-out)
```
Test Suites:  106 passed (106 total across monorepo)
Tests:        1653 passed (1653 total across monorepo)
Failures:     0
TypeScript:   0 errors across all workspaces (npm run typecheck)
Vite Build:   Clean production bundle (npm run build)
```

### Breakdown by Workspace
* **`@mmp/shared`:** Typings, deliverable enums, backward offsets, Zod schemas compiled cleanly via `tsup`.
* **`@mmp/api` (Backend):** **1353 passed tests across 64 test files**, including:
  - `test/phone_otp_profile.test.js` (9 tests covering 6-digit SMS OTP generation, expiry, rate limiting, and email lock).
  - `test/team_profile_api.test.js` (16 tests covering Team Directory, Worker Profile tabs, and RBAC).
  - `test/profile_and_settings.test.js` (34 tests covering strict schemas, avatar upload/delete, sessions, and password security).
  - `test/chat_system.test.js` & `test/chat_share_polish.test.js` (50 tests covering chat channels, DMs, socket events, and share-to-chat).
  - `test/individual_tracking_and_timing.test.js` & `test/step_deadlines_plan_form.test.js`.
* **`@mmp/web` (Frontend):** **300 passed tests across 42 test files**, including:
  - `src/pages/team/__tests__/TeamProfileSuite.test.tsx` (Team Directory, Worker Profile, craftsmanship metrics).
  - `src/pages/work/workspaces/__tests__/ShootWorkspaceSuite.test.tsx` (13 tests verifying clip gallery, phone uploads, and per-clip feedback).
  - `src/pages/work/workspaces/__tests__/Workspaces.test.tsx` (8 tests verifying Shoot, Edit, Design, and Post workspaces).
  - `src/pages/feedback/review-studio/__tests__/ReviewStudio.test.tsx` (11 tests verifying Review Studio decision bars and ratings).
  - `src/pages/__tests__/ProfileSettingsSuite.test.tsx` (16 tests verifying profile, crop modal, and settings).
  - `src/pages/__tests__/ChatSuite.test.tsx` & `src/pages/__tests__/ChatSharePolish.test.tsx`.
