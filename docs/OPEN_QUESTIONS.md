# HACA Marketing OS: Decisions, Ambiguities & Scope Reset Resolutions (Workflow V2)

**Date:** 25 October 2026  
**Status:** Scope Reset & Workflow V2 Applied (Decisions Finalized)  
**Authority:** [docs/WORKFLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/WORKFLOW.md), [docs/SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/SCOPE_RESET.md), [docs/CONTENT_FLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/CONTENT_FLOW.md), and [docs/PROJECT_REPORT.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/PROJECT_REPORT.md)

---

## 1. Core Workflow & Scope Reset Decisions

### 1.1 System Purpose & Boundary (Work and Team Only)
* **Decision:** The portal now manages **WORK and TEAM only, for HACA only**.
* **External Intake:** External request portals from other departments remain completely eliminated. Team members can request work internally from the SM Manager (`work.request`).

### 1.2 Five Canonical Roles (`admin`, `creative_head`, `executive`, `sm_manager`, `team_member`)
* **Decision:**
  * **`admin` (System Owner):** IT / System Owner outside the creative hierarchy. Derived all permissions. Only admin creates users, approves access requests, changes roles, grants elevated roles (`admin`, `creative_head`, `executive`), suspends, resets passwords, forces logout. Excluded from workload and candidate pools.
  * **`creative_head` (Creative Leadership — formerly `marketing_head`):** Verifies and approves calendar plans (approve all, selected rows, request changes with row comments, or reject the entire plan with an overall concern); approves or requests revisions on review stages (`Script`, `Content`, `Design`, `Edit`); classifies revision root causes (7 canonical causes); reassigns owners; manages team operating fields (`departmentId`, `jobRole`, `workPreferences`, `reportsToIds`, `weeklyCapacityHours`); controls reports and automation. Cannot create users, suspend, or change roles.
  * **`sm_manager` (Operational Planning Lead — formerly `team_lead`):** Uploads or enters calendar plans (`monthly` and `individual`), selects deliverable types with instant stage list and owner/deadline auto-fill suggestions, customizes suggestions (tagged 'set by SM Manager'), submits to Creative Head. Once approved, can change stage owners/deadlines or reschedule $F$ with audit logging, tracks all stages in the Content Tracker, resolves blockers, monitors workload. Cannot approve plans or review stages.
  * **`executive` (Company Leadership Viewer):** CEO, Business Head, Directors. Universal read-only view of all marketing work, calendar, tracker, workload, and reports. Zero mutation privileges (HTTP 403 on all POST, PUT, PATCH, DELETE). People contact details (email/phone) masked. Excluded from workload and candidate pools.
  * **`team_member` (Creative Contributor / Worker):** Own dashboard and portal only (`/my-work`, personal Todo, own Calendar items, Work Detail, Notifications, My Account). Starts work, updates status, pastes deliverable links, submits to Creative Head (review stages) or clicks Done and forward (non-review stages), replies to feedback, marks Blocked (9 canonical reasons), requests work from SM Manager. Sees only own items (downstream locked stages appear greyed out with scheduled due dates).
  * **No Other Department or Team Lead Roles:** Department lead silos are eliminated. The "Creative Manager (TL) job-role approver" rule is replaced directly by the `creative_head` role.

### 1.3 Single-Brand Mode (HACA Only)
* **Decision:** The portal operates strictly for the single brand **HACA**. All brand pickers, multi-brand dropdowns, profile tabs, and profile selection pages are permanently hidden in the UI. School name is carried in the plan title (e.g., `'Tech School November 2026'`).

---

## 2. LeadSquared (LSQ) & Top-of-Funnel Removal

### 2.1 Complete Removal of Leads, CRM & Data Center
* **Decision:** **REMOVED COMPLETELY.**
  * The LSQ adapter (`lsqAdapter.js`), inbound sync workers, and webhook routes are deleted.
  * Mongoose models `Lead`, `SyncRun`, and `DataIssue` are removed.
  * UI screens `/leads` (Lead Funnel) and `/data-center` (Data Center) are deleted.
  * The WhatsApp inbound auto-task creation rule is deleted.
  * All `LSQ_*` environment variables are removed.
  * Attribution formulas ($CPL$, $CPQL$, Qualified Lead %) are retired.

---

## 3. Campaigns, Targets & Revenue Scope Removal

### 3.1 Elimination of Monthly Targets and Campaigns
* **Decision:** **REMOVED COMPLETELY.**
  * `MonthlyTarget` and `Campaign` Mongoose models and routes (`/api/targets/*`, `/api/campaigns/*`) are deleted.
  * UI pages `/campaigns` and `/campaigns/:id` are deleted.
  * Budget, spend actuals, and OKR fields are removed.
  * Permission keys `target.*` and `campaign.*` are deleted.
  * The top-level organizing entity for content pieces is now the **Calendar Plan** (`calendarPlanId`), not a Campaign.
  * WorkItem fields `campaignId`, `relatedOKR`, and `relatedTarget` are unset and removed.

---

## 4. Content Flow & Workflow V2 Resolutions

### 4.1 Plan Types: Monthly & Individual Only
* **Decision:** Exactly two plan types are supported:
  1. `monthly`: Monthly Calendar covering full month of scheduled deliverables.
  2. `individual`: Individual Work containing **exactly one row** (same form, same fields, same approval).
* **Project Kind Removed:** Legacy `'project'` kind is eliminated (there are no department leads).
* **Campaign & Event Grouping:** Programs, events, and collateral batches are grouped at row level via the optional field **`Program or event`**.
* **School in Plan Title:** Plan title carries the school name and month, e.g. `'Tech School November 2026'`.

### 4.2 Row Fields & Auto-Fill Suggestions
* **Decision:** Selecting the deliverable type (and reel toggles) immediately creates the stage list, suggested owners, and suggested deadlines directly in the row draft.
* **Row Fields:** `Posting date F`, `Posting time`, `Topic`, `Type` (15 types), `For team` (Sales, Marketing, Academics, Other), `Program or event`, `Brief` (up to 1,000 chars), `Reference link` (input URL only; never reuse output fields), `Priority` (Normal/Urgent, default Normal), `Remarks`, `Posting owner` (for live types), `Source video link` (when reel needsShoot=no).
* **Owner Suggestions:** Evaluates active `team_member` candidates matching `workPreferences[]`, under 85% workload (including draft plan stage hours: Content 2h, Script 2h, Design 4h, Shoot 4h, Edit 6h, Post 1h), ranked by lowest workload $\rightarrow$ fewest 90-day revisions $\rightarrow$ earliest availability. Fallback: `'No available person with this role'`. Admin, Creative Head, SM Manager, Executive excluded.
* **Suggested Deadlines (Calendar days from $F$; 2-day buffer after last creation stage):**
  * Postable Design: Content $F-5$, Design $F-2$, Post $F$.
  * Non-postable Design: Content $F-5$, Design $F-2$, Handover $F$.
  * Reel Variant A (Script + Shoot): Script $F-8$, Shoot $F-5$, Edit $F-2$, Post $F$.
  * Reel Variant B (Shoot only): Shoot $F-5$, Edit $F-2$, Post $F$.
  * Reel Variant C (Edit only): Edit $F-2$, Post $F$.
* **Overrides:** Changed values marked `'set by SM Manager'`. If $F$ moves, only non-set values recalculate.

### 4.3 Validation Engine
* **Errors (Block Submit):** Missing required fields, unknown type, past posting date or deadline, deadline after $F$, out-of-order deadlines, Reel without shoot lacking source video link, postable type missing posting owner, invalid owner, duplicate row in plan, individual plan != 1 row.
* **Warnings (Allowed):** Last creation stage $>F-1$, owner workload $>85\%$, date outside plan month.

### 4.4 Plan Verification & Creative Head Actions
* **Decision:**
  * SM Manager submits the plan (`Draft` $\rightarrow$ `Submitted`).
  * Creative Head inspects the plan and can:
    1. **Approve All:** Approves all submitted rows.
    2. **Approve Selected:** Approves valid rows.
    3. **Request Changes:** Attaches mandatory comment to row (`changes_requested`).
    4. **Reject Whole Plan:** Rejects entire plan with overall strategic concern; all submitted rows go to `changes_requested`.
  * SM Manager edits and resubmits only draft and changes_requested rows.

### 4.5 Post-Approval Pipeline Generation & Governance
* **Decision:**
  * Approved rows generate **ContentPiece** and sequential stage **WorkItems** with row owners and deadlines.
  * Stage 1 is unlocked immediately (`unlockedAt: new Date()`); downstream stages are locked (`unlockedAt: null`, greyed out with due date).
  * SM Manager and Admin can adjust owner, deadline, reschedule $F$, or skip unstarted stage (logged in ActivityEvent: `who`, `when`, `old`, `new`; worker and Creative Head notified).
  * **Immutable Fields:** Topic and type cannot change after row approval.

### 4.6 Review Stages vs. Non-Review Stages
* **Decision:**
  * **Review stages** (`Script`, `Content`, `Design`, `Edit`): Worker submits for approval. Only `creative_head` (or `admin`) can approve. Rejection is `Revision Required` (increments revision count, returns to worker). 4th revision raises flag pinned to top of Creative Head dashboard.
  * **Non-review stages** (`Shoot`, `Post`): `Shoot` is Done and forward (footage link unlocks edit); `Post` is Publish (live URL and timestamp).
  * **Turnaround:** Computed as $\text{Published Date} - \text{First Stage Start Date}$.

### 4.7 Removal of Hour-Based Rules
* **Decision:** All hour-based escalations are eliminated. Exact timestamps are recorded for auditing, but nothing triggers after an arbitrary number of hours:
  * **Blocker:** Dependency owner and SM Manager notified instantly. Tracker shows **`Blocked since <date>`**. No 4-hour alert.
  * **Overdue:** Checked once daily at end-of-day in `REPORT_TIMEZONE`. Tracker shows **`Late by X days`**. No 4-hour alert.
  * **Approval:** Queue displays **`Waiting for X days`**.
  * **Revision flag:** Pinned at top of Creative Head dashboard until classified. No 48-hour alert.
  * Messages never say *"blocked for 4h"*.
  * **Preserved:** 4th revision flag; 3-day inactivity reminder (owner Day 3, SM Manager Day 4).
  * **At Risk:** Any active stage due within **2 calendar days** that is currently `Not Started`, `Pending`, or `Blocked`.

### 4.8 Canonical Taxonomies
* **Blocker reasons (9 exact):** `Waiting for feedback`, `Waiting for content`, `Waiting for data`, `Technical issue`, `Dependency`, `Client/business approval`, `Resource issue`, `Unclear requirement`, `Other` (free text only for Other).
* **Revision root causes (7 exact):** `Brief unclear`, `Creative direction unclear`, `Skill gap`, `Feedback inconsistency`, `Excessive scope change`, `Approval delay` (was 'TL approval delay'), `Client/business requirement changed`.
* Invented slug codes (`assets_missing`, `brief_gap`, etc.) are completely eradicated.

### 4.9 Import Template (24 Columns)
* 24 standard columns: Posting Date, Posting Time, Topic, Type, For Team, Program or Event, Brief, Reference Link, Priority, Posting Owner, Content Owner, Content Deadline, Script Owner, Script Deadline, Needs Script, Needs Shoot, Shoot Owner, Shoot Deadline, Edit Owner, Edit Deadline, Design Owner, Design Deadline, Source Video Link, Remarks.
* Owners given by email. Blank owners and deadlines are auto-filled and tagged `'suggested'`. Minimal 5-column file (`Posting Date`, `Topic`, `Type`, `For Team`, `Brief`) must work.

---

## 5. Operations, Automation & Performance Decisions

### 5.1 Four Objective Performance Dimensions
* **Decision:** Evaluated strictly across **four dimensions**:
  1. **Output:** Deliverables completed against effort estimates.
  2. **Efficiency:** On-time completion percentage and turnaround speed.
  3. **Quality:** First-pass approval rate and low average revision count ($\le 1.5$).
  4. **Collaboration:** Rapid blocker resolution and fast feedback turnaround.
  *(Business Impact dimension is permanently deleted).*

### 5.2 Six Core Automation Rules (Day-Based)
* **Decision:**
  1. `month_end_report`: Compiles monthly scorecard on last day at 23:59 IST.
  2. `overdue_daily_notification`: Daily check at end of day in `REPORT_TIMEZONE`; notifies owner and SM Manager once.
  3. `todo_inactivity_reminder`: Flags items without activity for 3 days (owner Day 3, SM Manager Day 4).
  4. `blocker_dependency_alert`: Instantly pings named dependency owner and SM Manager; shows 'blocked since <date>'.
  5. `revision_pattern_flag`: Automatically flags items on 4th revision or rolling average $+1$; pinned on dashboard.
  6. `weekly_report`: Dispatches weekly work summary every Monday at 08:00 IST.

### 5.3 Four Core Reports
* **Decision:**
  1. **Weekly Work Report** (Monday 08:00 IST)
  2. **Monthly Performance Scorecard** (Last day of month, no targets)
  3. **Creative Production Report** (Friday 18:00 IST)
  4. **Team Performance Digest** (1st of month, 09:00 IST)

### 5.4 Parked Features
* **Decision:** The CV stage (`CV Status`, `Date`, `Owner`) is parked and NOT included in the portal.

---

## 6. Role Workspaces, Submissions & Ratings Decisions

*Source of Truth:* [docs/WORKSPACES.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/WORKSPACES.md).

### 6.1 Step Outputs, Typed Submissions & Shoot as Review Step
* **Decision:** Raw link inputs are replaced by **typed Submissions**:
  - `Content` and `Script`: Writing Studio document (JSON + HTML snapshot; fallback doc link).
  - `Shoot`: Video footage files up to 500 MB (fallback drive link).
  - `Edit`: Video final cut up to 500 MB (fallback video link).
  - `Design`: Images up to 20 MB or PDF up to 50 MB.
  - `Post`: Live URL with date and time.
* **Shoot Review Step:** `Shoot` is elevated from "Done and forward" to a **Review Step**. Raw footage must be reviewed and approved by the Creative Head (or Admin) before the downstream `Edit` stage unlocks.
* **Resubmission Prefill & Versioning:** Every resubmission creates a new immutable version (`v1`, `v2`, ...). Requesting a revision returns the stage to `In Progress` with the last version's data pre-filled.
* **Videographer Job Role:** `Videographer` is added to the 13 canonical Job Roles (department: Video Production; default work preference: Shoot), integrated into Request Access, People management, and demo seeds.

### 6.2 Writing Studio Technical Boundaries & Deferred Features
* **Decision:**
  - Desktop-first A4 page canvas with zoom, 6 ribbon tabs, and docked sidebar (Brief, Script Tools, Comments).
  - Malayalam Unicode font support (**Manjari** / **Gayathri**).
  - Single-editor session heartbeating lock with read-only view for second callers.
  - Autosave every 3–5 seconds with offline local buffer (`IndexedDB` / `localStorage`).
  - Document stored as JSON + sanitized HTML snapshot ($\le 1\text{ MB}$).
  - Script tools: Templates, 2-column scene table, duration estimator, hook check, captions/hashtags section feeding Post copy buttons, auto shot list, teleprompter, snippets.
* **Deferred Feature:** **Suggesting mode (track changes) is strictly deferred to a future phase and MUST NOT be built now.**

### 6.3 Approved Dependencies Constraint
* **Decision:** To maintain a lean bundle and zero bloat, only the following packages are permitted for role workspaces:
  1. Tiptap packages and official extensions (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, official table/text/media extensions).
  2. Exactly **one** DOCX export library.
  3. Exactly **one** DOCX import library (`mammoth`).
  4. PDF generation strictly via native browser print (`window.print()`) with print CSS. No binary PDF engines (Puppeteer, jsPDF, etc.).
  5. Zero other new dependencies.

### 6.4 Review Studio & Auto-Advance
* **Decision:**
  - Queue 'Waiting for approval' sorted oldest first (FIFO) with waiting days.
  - Split-screen cockpit: Left pane media viewer (~70%), Right pane context/brief/upstream outputs/comments (~30%).
  - Timecode-pinned video notes, point-pinned image notes, anchored text comments with text compare diff.
  - Decision bar: Approve (mandatory 1–5 rating, optional tags and feedback) or Request Revision (requires comment/note, root cause).
  - Auto-advance immediately opens the next pending submission in the queue.

### 6.5 Quality Ratings, Feedback & Privacy Architecture
* **Decision:**
  - Quality Rating (1 to 5 stars) is **mandatory on approval** (1 Needs a lot of work, 3 Good, 5 Excellent). Evaluates craft and storytelling, **never speed** (lateness is tracked separately).
  - Optional written feedback and tags (`Great hook`, `Clear message`, `Needs polish`, `Off brief`).
  - Worker notification with "Mark as seen".
  - Editable by rater or admin with audit log (`ActivityEvent`).
  - Profile statistics: 30d, 90d, all-time average, monthly trend, distribution, step type average, recent feedback.
  - **Threshold Guard:** No averages or ratings analytics are shown until a worker has received at least **3 ratings**.
  - **Strict Anti-Comparison Rules:** Worker sees strictly their own profile ratings. Leaders (`creative_head`, `sm_manager`, `admin`, `executive`) can inspect all profiles. **Strictly NO public leaderboards, NO ranking of workers, NO comparative percentiles, and NO incentive formulas.**

### 6.6 Permissions & Submissions Scoping
* **Decision:**
  - Submissions visible to: step owner, reviewers (`creative_head`, `admin`), `sm_manager`, `executive` (read-only), and same-piece colleagues (read-only).
  - Step comments are **strictly private** between step owner and reviewers.
  - Submission creation is exclusive to the step owner (or admin).
  - Review and rating authority is exclusive to `creative_head` and `admin`.

---

## 7. Team Chat & Communications System Decisions

*Source of Truth:* [docs/CHAT.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/CHAT.md).

### 7.1 Channels & Membership Architecture
* **Decision:**
  - **Team Chat (System Singleton):** Immutable channel (`type: 'team'`, `systemSlug: 'team-chat'`). Every active user joins automatically upon activation; suspended accounts lose access immediately. Cannot be renamed, archived, or left. Executive role is strictly read-only.
  - **Groups:** Created only by `creative_head`, `sm_manager`, and `admin` (`chat.group.create`). Creator is initial owner. Owner manages members, renaming (up to 40 characters), description (up to 200 characters), and archival. Members may leave voluntarily; the owner must transfer ownership or archive before leaving. Admin can moderate and unarchive any group. Archived groups become read-only and move under an Archived section.
  - **Direct Messages:** Strictly 1:1 between any two active non-executive users. No group DMs. Private: Admin cannot view, list, or query DM contents. Executives cannot send or receive DMs.

### 7.2 Real-Time Engine, Socket.io Guards & Optimistic Updates
* **Decision:**
  - Reuse the existing Socket.io instance and JWT handshake in `apps/api/src/server.js`.
  - Channel rooms: `channel:<id>`. Joining a room requires database membership verification. Every emit (new message, edit, delete, reaction, typing) re-verifies active membership in the channel.
  - Client performs optimistic message appending with a pending indicator, retry queue, and inline "Failed. Tap to retry" state.

### 7.3 Message Constraints & Features
* **Decision:**
  - Max 4,000 characters; executable HTML stripped via sanitization; plain text URLs without unfurl link previews.
  - Built-in Unicode emoji picker (zero external npm dependencies).
  - @mentions: `@<name>` highlights the user and triggers high-priority notification; `@everyone` is restricted to `creative_head`, `sm_manager`, and `admin`.
  - Quoted replies: References parent message ID with snippet rendering; clicking jumps to original message.
  - Message modification: Edit own message within 24 hours (renders `[edited]`); delete own message renders "Message deleted" placeholder; admin deletion renders "Message removed by admin" and logs `ActivityEvent`.
  - Exactly 6 reactions: 👍, ❤️, 😂, 🎉, 👀, ✅.
  - Up to 10 pinned messages per channel (restricted to leaders, admin, and group owner).
  - Attachments: Max 5 files per message. Storage under unguessable UUID directory `uploads/chat/:channelId/:uuid/:safeFileName`. Caps: Images $\le 20\text{ MB}$ (PNG, JPG, WEBP); Documents $\le 25\text{ MB}$ (PDF, DOCX, XLSX, CSV, TXT); Video $\le 100\text{ MB}$ (MP4, MOV, WEBM); all other formats rejected.
  - Unread messages divider, typing indicators (debounced 3s), date separators, jump-to-latest button, infinite scroll history (50 messages/page), search within channel and cross-channel, deep linking (`/chat/<channelId>?m=<messageId>`).

### 7.4 "Share to Chat" & ShareGrant Security Model
* **Decision:**
  - Triggered exclusively on **approved outputs** (`approved` clip, approved edit cut, approved design image/PDF) in Review Studio, Workspaces, and clip cards. Drafts, in-review, and reshoot-needed assets cannot be shared.
  - Creates a `ShareGrant` record linking `assetId` to `channelId`. Channel members gain read-only view and download access to that specific asset.
  - The upstream production pipeline, approval comments, review notes, ratings, and unshared deliverables remain completely isolated.
  - Unshare by sharer, creative_head, or admin revokes the grant; the card displays "No longer shared".
  - Optional `[ ] Also share to Team chat` checkbox in Review Studio decision bar when approving a final stage.

### 7.5 Role Boundaries, Permissions & Zero Surveillance
* **Decision:**
  - **Permissions:** `chat.use` (`admin`, `creative_head`, `sm_manager`, `team_member`), `chat.group.create` (`admin`, `creative_head`, `sm_manager`), `chat.moderate` (`admin`), `chat.read` (`executive`).
  - **Executive:** Strictly read-only viewer in Team chat and groups they are explicitly added to. Cannot post messages, react, share outputs, or send/receive DMs.
  - **Strict Anti-Surveillance Rule:** Strictly NO chat activity leaderboards, NO message counts per person in performance digests, and NO ranking of employees by chat responsiveness or activity anywhere in the platform.


