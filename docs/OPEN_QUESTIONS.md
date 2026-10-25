# HACA Marketing OS: Decisions, Ambiguities & Scope Reset Resolutions

**Date:** 24 October 2026  
**Status:** Scope Reset Applied (Decisions Finalized)  
**Authority:** [docs/SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/SCOPE_RESET.md), [docs/CONTENT_FLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/CONTENT_FLOW.md), and [docs/PROJECT_REPORT.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/PROJECT_REPORT.md)

---

## 1. Core Workflow & Scope Reset Decisions

### 1.1 System Purpose & Boundary (Work and Team Only)
* **Decision:** The portal now manages **WORK and TEAM only, for HACA only**.
* **External Intake:** External request portals from other departments remain completely eliminated. Team members can request work internally from the SM Manager (`work.request`).

### 1.2 Five Canonical Roles (`admin`, `creative_head`, `executive`, `sm_manager`, `team_member`)
* **Decision:**
  * **`admin` (System Owner):** IT / System Owner outside the creative hierarchy. Derived all permissions. Only admin creates users, approves access requests, changes roles, grants elevated roles (`admin`, `creative_head`, `executive`), suspends, resets passwords, forces logout.
  * **`creative_head` (Creative Leadership — formerly `marketing_head`):** Verifies and approves calendar plans (approve all, selected rows, or request changes with comments); approves or requests revisions on review stages (`Script`, `Content`, `Design`, `Edit`); classifies revision root causes; reassigns owners; manages team operating fields (`departmentId`, `jobRole`, `workPreferences`, `reportsToIds`, `weeklyCapacityHours`); controls reports and automation. Cannot create users, suspend, or change roles.
  * **`sm_manager` (Operational Planning Lead — formerly `team_lead`):** Uploads or enters calendar plans (Monthly or Project), submits to Creative Head. Once approved, assigns/auto-assigns stages by work preference with 1-click confirmation or override, sets/shifts deadlines, tracks all stages in the Content Tracker, reassigns, resolves blockers, monitors workload. Cannot approve plans or review stages.
  * **`executive` (Company Leadership Viewer):** CEO, Business Head, Directors. Universal read-only view of all marketing work, calendar, tracker, workload, and reports. Zero mutation privileges (HTTP 403 on all POST, PUT, PATCH, DELETE). People contact details (email/phone) masked. Excluded from workload and performance digests.
  * **`team_member` (Creative Contributor / Worker):** Own dashboard and portal only (`/my-work`, personal Todo, own Calendar items, Work Detail, Notifications, My Account). Starts work, updates status, pastes deliverable links, submits to Creative Head (review stages) or clicks Done and forward (non-review stages), replies to feedback, marks Blocked, requests work from SM Manager. Sees only own items.
  * **No Other Department or Team Lead Roles:** Department lead silos are eliminated. The "Creative Manager (TL) job-role approver" rule is replaced directly by the `creative_head` role.

### 1.3 Single-Brand Mode (HACA Only)
* **Decision:** The portal operates strictly for the single brand **HACA**. All brand pickers, multi-brand dropdowns, profile tabs, and profile selection pages are permanently hidden in the UI.

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

## 4. Content Flow & Calendar Planning Decisions

### 4.1 Calendar Plan Creation & Entry Methods
* **Decision:** The SM Manager creates plans (kind: `Monthly` or `Project`, with title and period).
  * **Excel / CSV Upload:** Standard template provided; client-side validation preview catches row syntax errors prior to commit.
  * **Interactive Grid:** Direct table row entry.
  * Row fields: `postingDate` (or final date), `topic`, `contentType`, `needsScript` (boolean), `needsShoot` (boolean, Reel only), `contentLink` (draft doc), `remarks`.

### 4.2 Calendar Plan Approval Workflow
* **Decision:**
  * SM Manager submits the plan (`Draft` $\rightarrow$ `Submitted`).
  * Creative Head inspects the plan in **Feedback & Revisions $\rightarrow$ Plan Approvals**.
  * Creative Head can:
    1. **Approve All:** Approves all rows.
    2. **Approve Selected:** Approves valid rows while flagging others.
    3. **Request Changes:** Attaches comments to specific rows and returns the plan (`Changes requested`).
  * Approved rows immediately generate **ContentPiece** records and sequential stage **WorkItems**.

### 4.3 Pipeline Due-Date Offsets (Counted Back from Final Date $F$)
* **Decision:**
  * **Design postable** (Static Post, Carousel Post, Story, Poster): Content $F-6$, Design $F-3$, Post $F$.
  * **Design not postable** (Cover Image, Thumbnail, Meta Ad Creative, Class Announcement, Orientation Creative, Graduation Creative, Offer Creative, Brochure, Certificate, Placement Poster, Custom Request): Content $F-5$, Design $F-2$ (final done on design approval; no Post stage).
  * **Reel Variant A** (with script, with shoot): Script $F-10$, Shoot $F-7$, Edit $F-4$, Post $F$.
  * **Reel Variant B** (no script, with shoot): Shoot $F-7$, Edit $F-4$, Post $F$.
  * **Reel Variant C** (no script, no shoot - program-video based): Edit $F-4$, Post $F$.
  * If posting date shifts, SM Manager can shift all unstarted stage deadlines in one click.

### 4.4 Review Stages vs. Non-Review Stages
* **Decision:**
  * **Review stages** (`Script`, `Content`, `Design`, `Edit`): Owner submits for approval. Only `creative_head` (or `admin`) can approve. Rejection is `Revision Required` (increments revision count, returns to owner).
  * **Non-review stages** (`Shoot`, `Post`): Owner clicks **Done and forward**, unlocking the next stage immediately.
  * **Sequential locking:** A stage cannot start until the previous stage is approved or done (`unlockedAt` timestamp set).
  * **Turnaround:** Computed as $\text{Published Date} - \text{First Stage Start Date}$.

### 4.5 Auto-Assignment Engine & Work Preferences
* **Decision:**
  * Candidates matched by `Person.workPreferences[]` (`Content`, `Script`, `Design`, `Shoot`, `Edit`, `Post`), workload strictly $<85\%$, and bandwidth before deadline.
  * Rank by lowest workload percentage, then lowest rolling revision average, then earliest availability.
  * **Never silent:** SM Manager confirms recommendations in one click or manually overrides. Overrides logged in `AssignmentOverride`. Unassigned stages show `"Needs owner"`.

---

## 5. Operations, Automation & Performance Decisions

### 5.1 Four Objective Performance Dimensions
* **Decision:** Evaluated strictly across **four dimensions**:
  1. **Output:** Deliverables completed against effort estimates.
  2. **Efficiency:** On-time completion percentage and turnaround speed.
  3. **Quality:** First-pass approval rate and low average revision count ($\le 1.5$).
  4. **Collaboration:** Rapid blocker resolution and fast feedback turnaround.
  *(Business Impact dimension is permanently deleted).*

### 5.2 Six Core Automation Rules
* **Decision:**
  1. `month_end_report`: Compiles monthly scorecard on last day at 23:59 IST.
  2. `overdue_escalation`: Alerts owner immediately; alerts SM Manager after 4 hours.
  3. `todo_escalation`: Flags items without activity for 3 days.
  4. `blocker_dependency_alert`: Instantly pings named dependency owner.
  5. `revision_pattern_flag`: Automatically flags items on 4th revision or rolling average $+1$.
  6. `weekly_report`: Dispatches weekly work summary every Monday at 08:00 IST.
  *(lsq_live_sync is permanently deleted).*

### 5.3 Four Core Reports
* **Decision:**
  1. **Weekly Work Report** (Monday 08:00 IST)
  2. **Monthly Performance Scorecard** (Last day of month, no targets)
  3. **Creative Production Report** (Friday 18:00 IST)
  4. **Team Performance Digest** (1st of month, 09:00 IST)
  *(Lead Funnel & CPL Report and Campaign Deep-Dive are permanently deleted).*

### 5.4 Parked Features
* **Decision:** The CV stage (`CV Status`, `Date`, `Owner`) is parked and NOT included in the portal.
