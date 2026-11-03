# HACA Marketing OS: Scope Reset Specification (V1 Source of Truth)

**Date:** 24 October 2026  
**Status:** Approved Master Scope & Architectural Reset  
**Target:** HACA Marketing OS (Internal Team Workspace)  
**System Boundary:** Work and Team management only, for the HACA brand only.

---

## 1. Executive Summary & Core Decision

The HACA Marketing OS portal is formally refocused into a dedicated, high-efficiency **Work and Team Management System** for **HACA**. 

All commercial lead tracking, external CRM synchronization, revenue targeting, and top-of-funnel marketing analytics are retired from the core codebase. This eliminates unnecessary complexity, removes external CRM schema dependencies, and places 100% of the team's operational focus on creative planning, content production pipelines, structured review approvals, and workload balancing.

```mermaid
graph TD
    subgraph Core System Boundary [HACA Marketing OS - Work & Team Only]
        CP[Calendar Plan: Monthly / Individual] -->|Submit for Approval| CH_Appr[Creative Head Verification & Row Approval]
        CH_Appr -->|Auto-Generate on Approval| Stages[ContentPiece & Stage WorkItems]
        Stages -->|Stage 1 Unlocked| Worker[Team Member: My Work & Stage Deliverables]
        Worker -->|Review Stages| Rev[Creative Head Review & Feedback Loop]
        Worker -->|Non-Review Stages| Done[Done and Forward / Publish]
        Rev -->|Approved| Live[Publish & Turnaround Tracking]
        Live -->|Tracked by All| Tracker[Content Tracker Table & Dashboard]
    end
```

---

## 2. Complete Removal Inventory

The following domains, models, routes, jobs, UI pages, and configuration are **permanently removed** from the portal:

| Area | Elements Removed Completely |
|---|---|
| **Leads & CRM** | LSQ adapter (`lsqAdapter.js`), inbound polling & sync jobs, `Lead` Mongoose model, `SyncRun` model, `DataIssue` model, Lead Funnel screen (`/leads`), Data Center screen (`/data-center`), and the WhatsApp inbound auto-task creation rule. |
| **Campaigns & OKRs** | `Campaign` Mongoose model, campaign routes (`/api/campaigns/*`), campaign UI pages (`/campaigns`, `/campaigns/:id`), campaign budget, spend tracking actuals, and `relatedOKR`. |
| **Monthly Targets** | `MonthlyTarget` Mongoose model, target routes (`/api/targets/*`), target UI forms, target KPIs, and revenue/lead target metrics. |
| **Project Plans** | `kind: 'project'` is removed (there are no department leads). Replaced by `individual` plans (exactly 1 row) and the row field `Program or event`. |
| **Hour-Based Escalations** | No 4-hour overdue escalation, no 4-hour blocker escalation, no 48-hour revision flag escalation. Replaced by daily overdue checks, 'blocked since <date>', and dashboard pinning. Messages never say 'blocked for 4h'. |
| **Invented Codes** | Retired internal codes (`assets_missing`, `brief_gap`, `waiting_approval`, etc.) replaced by standard 9 blocker reasons and 7 revision root causes. |
| **Reports** | **Lead Funnel & CPL Report** and **Campaign Deep-Dive Report** (4 core work reports remain). |
| **Automation** | `lsq_live_sync` background runner (6 core automation rules remain). |
| **Performance Dimensions** | **Business Impact** performance dimension (4 dimensions remain: Output, Efficiency, Quality, Collaboration). |
| **WorkItem Attributes** | Fields `campaignId`, `relatedOKR`, `relatedTarget`, `leadsGenerated`, and `qualifiedLeads` are removed/unset. Work items are now organized by `calendarPlanId` / `contentPieceId`. |
| **Permissions** | Retired keys: `target.*` (`target.view`, `target.manage`), `campaign.*` (`campaign.view`, `campaign.manage`), `lead.view`, and `datacenter.view`. |
| **Environment Variables** | All `LSQ_*` configuration variables (`LSQ_ACCESS_KEY`, `LSQ_SECRET_KEY`, `LSQ_HOST_URL`, etc.). |

---

## 3. Brand & Profile Scope

* **Single-Brand Mode (HACA Only):** The portal operates strictly for the single parent brand **HACA**.
* **Profile Selection Hidden:** All brand switchers, multi-brand dropdowns, profile filtering tabs, and profile selection pages are permanently hidden from the UI.
* **Internal Profile Integrity:** Documents retain an internal `profileId` pointing to the primary HACA organization record to preserve existing schema constraints without exposing multi-tenant complexity.

---

## 4. Roles & Permissions Architecture (Exact 5 Keys)

The system is governed by exactly **five role keys**: `admin`, `creative_head`, `executive`, `sm_manager`, and `team_member`.

```
admin ─── System & User Owner (Outside Creative Hierarchy)
  │
creative_head ─── Creative Authority (Approves Plans & Review Stages, Edits People Ops)
  │
sm_manager ─── Operational Planner (Builds Plans, Sets Deadlines, Assigns Stages, Resolves Blockers)
  │
team_member ─── Creative Contributor (Executes Stages, Submits for Review, Flags Blockers)

executive ─── Leadership Viewer (Company Management, Zero Mutation Privileges, Read-Only Across System)
```

### 4.1 Detailed Role Responsibilities & Boundaries

#### 1. `admin` (System Owner)
* **Identity:** IT System Administrator, outside the creative hierarchy.
* **Capabilities:** Every permission key in the system (derived dynamically from `PERMISSION_KEYS`).
* **Exclusive Powers:** ONLY `admin` can create users directly, approve/reject public access requests, assign or change user roles, grant elevated roles (`admin`, `creative_head`, `executive`), suspend or reactivate users, trigger password resets, and force session logout.
* **System Boundaries:** Admin needs no department, job role, or capacity hours; is strictly excluded from workload calculations and auto-assignment recommendation pools; and is omitted from team performance reports. Any work mutations performed by admin are logged in `ActivityEvent` with `actingAs: 'admin'`.
* **Landing Page:** `/dashboard`.

#### 2. `creative_head` (Creative Leadership — formerly `marketing_head`)
* **Identity:** Creative Director / Head of Creative Production.
* **Capabilities:**
  * **Calendar Plan Approvals:** Verifies and approves Calendar Plans submitted by the SM Manager. Actions: approve all rows at once, approve selected rows, request changes with mandatory row comments, or reject the entire plan with an overall strategic concern.
  * **Stage Review Approvals:** Authoritative approver for all creative review stages (`Script`, `Content`, `Design`, `Edit`). Approves deliverable links or sends back with `Revision Required` and specific feedback.
  * **Revision Root Cause Classification:** Classifies root causes on revision flags (7 canonical causes: Brief unclear, Creative direction unclear, Skill gap, Feedback inconsistency, Excessive scope change, Approval delay, Client/business requirement changed).
  * **Team Operations Management:** Manages operational assignments for `sm_manager` and `team_member` (`departmentId`, `jobRole`, `workPreferences[]`, `reportsToIds[]`, `weeklyCapacityHours`).
  * **System Oversight:** Sees all work, all team members, and overall team workload. Runs and controls report definitions and automation rules. Can reassign work owners.
* **Strict Boundaries:** Cannot create or suspend user accounts; cannot change user roles; cannot grant elevated roles; cannot upload or type calendar plans; cannot modify `admin`, `executive`, or other `creative_head` accounts.
* **Landing Page:** `/dashboard`.

#### 3. `sm_manager` (Social Media Manager / Operational Planner — formerly `team_lead`)
* **Identity:** Main operational planning and orchestration lead.
* **Capabilities:**
  * **Plan Creation & Upload:** Builds and creates Calendar Plans (`monthly` and `individual`). Uploads plans via structured 24-column Excel/CSV templates with auto-fill preview, or enters rows directly in an interactive grid. Title carries school name (e.g. 'Tech School November 2026').
  * **Instant Stage Auto-Fill:** Selecting deliverable type and reel toggles immediately suggests stage list, owners (<85% workload), and calendar-day deadline offsets. Overrides are tagged 'set by SM Manager'.
  * **Plan Submission:** Submits draft plans to the Creative Head for verification (errors block submit).
  * **Post-Approval Adjustments:** Can reassign an owner, modify a deadline, reschedule $F$, or skip an unstarted stage with audit logging and notifications.
  * **Workflow Orchestration:** Tracks every stage across all content pieces in the Content Tracker, resolves blockers, and monitors live team workload.
  * **Visibility:** Full visibility into all work items, all people, and all calendar entries.
* **Strict Boundaries:** **Cannot approve calendar plans and cannot approve review stages.** Does not classify revision root causes. Cannot manage user accounts or elevate permissions.
* **Landing Page:** `/dashboard`.

#### 4. `executive` (Company Leadership Viewer)
* **Identity:** CEO, Business Head, Board Directors.
* **Capabilities:** Universal read-only visibility into the complete portal (Dashboard, Calendar, Content Tracker, Work Detail, Feedback history, Workload, Reports).
* **Strict Boundaries:** **Strictly zero mutation/write privileges (HTTP 403 Forbidden on all POST, PUT, PATCH, DELETE endpoints).** In the People directory, contact information (email and phone) is omitted/masked. Excluded from auto-assignment candidate pools, capacity calculations, and team performance digests. My Work is hidden from navigation.
* **Landing Page:** `/dashboard`.

#### 5. `team_member` (Creative Contributor / Worker)
* **Identity:** Writers, Graphic Designers, Video Editors, Animators, Specialists.
* **Capabilities:**
  * **Personal Portal:** Access restricted to own personal dashboard (`/my-work`), personal Todo, personal Calendar entries, Work Detail (`/work/:id`), Notifications, and My Account. Downstream locked stages appear greyed out with due dates.
  * **Stage Execution:** Starts own assigned stages, updates status (`In Progress`, `Pending`, `Blocked`), pastes output URLs (Zoho Writer, Google Docs, Figma, Drive, YouTube links).
  * **Handoffs:** Submits review stages (`Script`, `Content`, `Design`, `Edit`) to the Creative Head for approval; marks non-review stages (`Shoot`, `Post`) as **Done and forward** (or Publish) to complete the stage.
  * **Collaboration:** Replies to revision feedback threads, flags blockers with mandatory dependency owner attribution (9 canonical reasons), and submits work requests to the SM Manager.
* **Strict Boundaries:** Sees only own work items and own calendar items. Cannot see other members' work unless assigned. Cannot create calendar plans, cannot assign work, cannot approve deliverables, and cannot access team-wide reports or workload analytics.
* **Landing Page:** `/my-work`.

#### 4.2 Department & Approver Simplification Rule
* **No Other Department or Team Lead Roles:** All legacy department lead distinctions (Design Lead, SEO Lead, etc.) and departmental silos are retired.
* **Direct Creative Head Approval:** The legacy rule requiring a separate "Creative Manager (TL) job-role approver" is completely replaced by the dedicated `creative_head` role.

---

## 5. End-to-End Content & Work Lifecycle (Workflow V2)

```mermaid
sequenceDiagram
    autonumber
    actor SMM as SM Manager
    actor CH as Creative Head
    actor Worker as Team Member
    actor Publisher as Posting Owner
    
    Note over SMM: Step 1: Create Plan & Auto-Fill
    SMM->>SMM: Upload 24-col CSV/Excel or enter in grid (Monthly/Individual)
    SMM->>SMM: Select Type -> Instant Auto-fill of Owners & Deadlines (F-5, F-2, etc.)
    Note over SMM: Step 2: Submit Plan
    SMM->>CH: Submit Plan (Validation errors block submit)
    Note over CH: Step 3: Verify Plan
    CH->>SMM: Approve All / Approve Rows / Request Changes / Reject Plan with Concern
    Note over SMM,CH: Step 4: ContentPiece & Stages Built
    SMM->>SMM: Approved rows generate ContentPieces & Stage WorkItems
    Note over Worker: Step 5: Stage 1 Unlocked (Others Locked)
    Worker->>Worker: Executes stage in My Work & pastes output link
    alt Review Stage (Script, Content, Design, Edit)
        Worker->>CH: Submit for approval
        Note over CH: Step 6: Creative Head Review
        CH->>Worker: Approve (unlocks next stage) OR Revision Required (note attached)
    else Non-Review Stage (Shoot, Post)
        Worker->>Worker: Done and forward (footage link unlocks Edit)
    end
    Note over Publisher: Step 7: Publish & Measure
    Publisher->>Publisher: Publishes content, enters live URL & date
    Note over SMM,CH: Tracked live in Content Tracker ('who holds it now', 'at risk' 2 days)
```

### Detailed Lifecycle Steps:

1. **Plan Creation & Row Fields:**
   * The SM Manager creates a **Calendar Plan** (`kind: 'monthly'` or `'individual'`, title carrying school e.g. 'Tech School November 2026').
   * Enters rows via 24-column Excel/CSV upload or interactive grid.
   * Required fields per row: `postingDate F`, `topic`, `type` (15 types), `forTeam` (Sales, Marketing, Academics, Other), `brief` (max 1,000 chars), `priority` (Normal/Urgent, default Normal).
   * Optional fields: `postingTime`, `programOrEvent`, `referenceLink` (input URL only; never reuse output fields), `remarks`.
   * Postable types require `postingOwner`. Reels require `needsScript`, `needsShoot`, and `sourceVideoLink` when needsShoot is no.
2. **Auto-Fill Suggestion Engine (at Row Creation):**
   * Selecting `type` and reel toggles immediately generates stages, suggested owners, and suggested deadlines:
     * Owners: active `team_member`, matching `workPreferences[]`, capacity strictly $<85\%$ (including draft plan stage hours), ranked by lowest workload, fewest 90-day revisions, earliest availability. Admin, Creative Head, SM Manager, Executive excluded.
     * Deadlines (calendar days from $F$, 2-day buffer after last creation stage):
       * Postable design: Content $F-5$, Design $F-2$, Post $F$.
       * Non-postable design: Content $F-5$, Design $F-2$, Handover $F$.
       * Reel A (script & shoot): Script $F-8$, Shoot $F-5$, Edit $F-2$, Post $F$.
       * Reel B (shoot only): Shoot $F-5$, Edit $F-2$, Post $F$.
       * Reel C (edit only): Edit $F-2$, Post $F$.
   * SM Manager can edit or clear any suggestion (marked 'set by SM Manager').
3. **Plan Submission & Validation:**
   * Errors block submit: missing required fields, unknown type, past dates, stage deadline after $F$, out-of-order deadlines, needsShoot=no without sourceVideoLink, postable type without posting owner, invalid owner, duplicate row, individual plan != 1 row.
   * Warnings (allowed): creation stage > $F-1$, owner > 85%, date outside plan month.
4. **Creative Head Verification:**
   * Creative Head inspects the plan in **Feedback & Revisions $\rightarrow$ Plan Approvals**:
     * **Approve All:** Approves all rows in the plan.
     * **Approve Selected:** Approves valid rows while leaving others.
     * **Request Changes:** Attaches specific row comment (`changes_requested`).
     * **Reject Plan:** Rejects entire plan with overall concern; all submitted rows go to `changes_requested`.
   * SM Manager edits and resubmits only draft and changes_requested rows.
5. **ContentPiece & Stage Generation (Post-Approval):**
   * Approved rows auto-generate a **ContentPiece** record and sequential stage **WorkItems** with row owners and deadlines.
   * Stage 1 is unlocked immediately (`unlockedAt: new Date()`); downstream stages remain locked (`unlockedAt: null`, greyed out with due date).
   * SM Manager and Admin can adjust owner, deadline, reschedule $F$, or skip unstarted stage (logged in ActivityEvent; worker & Creative Head notified). Topic and type cannot change after approval.
6. **Work Execution & Submission:**
   * Workers see assigned stages in `/my-work`.
   * Worker clicks **Start Work** (`In Progress`), executes work, and pastes output deliverable URL.
   * **Review Stages (`Script`, `Content`, `Design`, `Edit`):** Worker clicks **Submit for approval**.
   * **Non-Review Stages (`Shoot`, `Post`):** Worker clicks **Done and forward** (footage URL), unlocking edit.
7. **Creative Head Review & Revision Guardrails:**
   * Decisions:
     * **Approved:** Marks stage approved and unlocks the next stage.
     * **Revision Required:** Attaches clear feedback text; returns to worker (`In Progress`), incrementing revisions.
   * **Revision Flag:** When revisions reach 4 or exceed owner baseline by $>1$, a `RevisionFlag` is raised and pinned to the top of the Creative Head dashboard until classified (no 48-hour escalation).
8. **Publishing & Turnaround Tracking:**
   * The posting owner publishes live, sets status to `Published`, and enters live public URL and timestamp. Non-postable items are handed over on date $F$.
   * System audits live in the **Content Tracker** (`who holds it now`, `at risk` if due in 2 days and not started/pending/blocked, late by days, lag days, wait days).

---

## 6. Screen Inventory & Structure

The user interface consists of exactly **12 screens and views** (4 legacy screens permanently removed):

```
Active Navigation:
├── Dashboard (/dashboard)
├── My Work (/my-work)
├── Calendar & Plans (/calendar)
│   ├── Month View
│   ├── Calendar Plans (Upload / Grid / Approvals)
│   └── Content Tracker (Social & Design Views)
├── Work Detail (/work/:id)
├── Feedback & Revisions (/feedback)
│   ├── Stage Approvals Queue
│   └── Plan Approvals Queue
├── Team Workload (/workload)
├── Todo & Priorities (/todo)
├── Issues & Blockers (/issues)
├── Reports & Automation (/reports)
└── Administration & Account
    ├── People Management (/people)
    ├── Access Requests (/admin/access-requests)
    ├── My Account (/account)
    └── Notifications (/notifications)

REMOVED SCREENS:
❌ Campaigns List (/campaigns)
❌ Campaign Detail (/campaigns/:id)
❌ Lead Funnel (/leads)
❌ Data Center (/data-center)
```

---

## 7. Dashboard Architecture (8 Core Sections)

The `/dashboard` screen is structured into 8 operational sections designed for real-time clarity:

1. **Month Plan Status:** Live status of current calendar plans (Draft, Submitted, Approved, Approved with pending rows), planned deliverables versus completed deliverables, and publishing velocity.
2. **KPI Strip:** 7 core real-time metrics:
   * **Planned:** Total pieces planned for the active period.
   * **Completed:** Total pieces published / final approved.
   * **In Progress:** Stages actively being worked on.
   * **At Risk:** Active stages due within **2 calendar days** that are currently `Not Started`, `Pending`, or `Blocked`.
   * **Blocked:** Items currently held up with an active blocker ('blocked since <date>').
   * **Pending Approval:** Items awaiting Creative Head review ('waiting for X days').
   * **Overdue:** Items where deadline has passed without completion (late by days).
3. **Today's Priorities:** High-urgency deliverables due today or overdue.
4. **Production Stats & Trend:** Output velocity by content type (Reels, Static Posts, Carousels, Stories, Design assets) and weekly completion trends.
5. **Team Workload:** Live capacity breakdown showing healthy ($<65\%$), high ($65\%-85\%$), and overloaded ($>85\%$) team members.
6. **Issues & Blockers:** Unresolved blocker items (9 canonical reasons) with dependency owners, plus active revision flags pinned at top for classification.
7. **Waiting for Approval:** Urgent deliverables submitted by team members awaiting Creative Head action.
8. **Recent Activity:** Audit feed of status transitions, approvals, handoffs, and assignments.

---

## 8. Report Definitions (4 Core Reports)

Four focused reports replace all previous marketing and lead reports:

| Report Name | Cadence | Scope & Contents |
|---|---|---|
| **Weekly Work Report** | Every Monday, 08:00 IST | Weekly summary of completed deliverables, on-time delivery rate, active bottlenecks, and upcoming week priorities. |
| **Monthly Performance Scorecard** | Last day of month, 23:59 IST | End-of-month operational throughput, turnaround days by content format, revision rates, and blocker resolution times (targets completely removed). |
| **Creative Production Report** | Every Friday, 18:00 IST | Deep dive into stage throughput: script output, design assets created, video edit hours, and stage approval turnaround. |
| **Team Performance Digest** | 1st of every month, 09:00 IST | Objective evaluation across 4 dimensions (Output, Efficiency, Quality, Collaboration) for each creative contributor. |

*(Removed: Lead Funnel & CPL Report, Campaign Deep-Dive Report).*

---

## 9. Automation Rules (Day-Based, Hour Rules Removed)

Six background automation jobs run via BullMQ:

1. **`month_end_report`:** Automatically compiles and archives the Monthly Performance Scorecard on the last day of the month at 23:59.
2. **`overdue_daily_notification`:** Checks at the end of each day in `REPORT_TIMEZONE`; notifies the deliverable owner and SM Manager once when a due date passes. Tracker displays 'late by days'. (No 4-hour alert).
3. **`todo_inactivity_reminder`:** Flags open items that have had no status change for 3 consecutive days (owner notified on Day 3; SM Manager notified on Day 4).
4. **`blocker_dependency_alert`:** Instantly dispatches a notification to the named dependency owner and SM Manager when an item is marked Blocked. Tracker displays 'blocked since <date>'. (No 4-hour alert).
5. **`revision_pattern_flag`:** Automatically raises a `RevisionFlag` when an item reaches 4 revisions or exceeds owner average by $>1$. Stays pinned at top of Creative Head dashboard until classified. (No 48-hour alert).
6. **`weekly_report`:** Compiles and dispatches the Weekly Work Report every Monday morning at 08:00.

*(Removed: `lsq_live_sync`, 4-hour overdue escalation, 4-hour blocker escalation, 48-hour flag escalation).*

---

## 10. Performance Dimensions (4 Objective Dimensions)

Performance evaluation is strictly creative and operational, calculated across **four dimensions**:

1. **Output:** Deliverables completed against estimated effort hours and stage volume.
2. **Efficiency:** On-time completion percentage and average stage turnaround days versus deadline baselines.
3. **Quality:** First-pass approval rate and low average revision count ($\le 1.5$ rounds per piece).
4. **Collaboration:** Rapid blocker resolution time and constructive response time on revision feedback.

*(Permanently Removed: Business Impact dimension).*

---

## 11. Permissions Key Registry

### Deleted Permission Keys:
* `target.view`, `target.manage`
* `campaign.view`, `campaign.manage`
* `lead.view`
* `datacenter.view`

### Added Permission Keys:
* **`calendar.plan`:** Create, upload, edit, and submit calendar plans. Granted to: `sm_manager`, `admin`.
* **`calendar.approve`:** Approve or request changes on calendar plans and approve review stages. Granted to: `creative_head`, `admin`.

### Complete Canonical Permission Map:
```javascript
export const ROLE_PERMISSIONS = {
  admin: ['*'], // Derived dynamically from all PERMISSION_KEYS
  creative_head: [
    'portal.view',
    'people.view',
    'people.assign',
    'calendar.view',
    'calendar.approve',
    'work.view',
    'work.create',
    'work.assign',
    'feedback.give',
    'feedback.view',
    'blocker.resolve',
    'analytics.team',
    'report.view',
    'report.configure',
    'automation.manage'
  ],
  sm_manager: [
    'portal.view',
    'people.view',
    'calendar.view',
    'calendar.plan',
    'work.view',
    'work.create',
    'work.assign',
    'feedback.view',
    'blocker.resolve',
    'analytics.team',
    'report.view'
  ],
  executive: [
    'portal.view',
    'people.view', // Email & phone masked
    'calendar.view',
    'work.view',
    'feedback.view',
    'analytics.team',
    'report.view'
  ],
  team_member: [
    'portal.view',
    'calendar.view',
    'work.view.own',
    'work.update.own',
    'work.request',
    'feedback.view.own',
    'feedback.reply'
  ]
};
```

---

## 12. Database Transition & Data Cleanup Strategy

Before executing database modifications during Phase R1:
1. **Full Export Backup:** Completed via `mongodump` into `backup-before-scope-reset/`.
2. **Collection Purge:**
   * Export documents from `campaigns`, `monthlytargets`, `leads`, `dataissues`, and `syncruns` to JSON archive.
   * Drop/delete documents in these 5 retired collections.
3. **WorkItem Field Cleanup:**
   * Execute an atomic Mongoose update script to unset retired fields on all existing `WorkItem` documents:
     ```javascript
     await WorkItem.updateMany({}, {
       $unset: {
         campaignId: 1,
         relatedOKR: 1,
         relatedTarget: 1,
         leadsGenerated: 1,
         qualifiedLeads: 1
       }
     });
     ```
   * All historical work items and stage records are preserved intact.
