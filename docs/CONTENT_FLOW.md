# Content Flow Specification: HACA Marketing OS (Workflow V2)

*Content calendar plans, verification & approvals, stage pipelines, assignments, execution, and live tracking*  
*Source of Truth: [docs/WORKFLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/WORKFLOW.md) and [docs/SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/SCOPE_RESET.md)*  
*System Boundary: WORK and TEAM only, for HACA only. CV stage is parked and not included.*

---

## 1. What the Team Does & How the Portal Solves It

The portal unifies marketing operations into a verified digital workflow, replacing disconnected spreadsheets (Sheet A: SM CONTENT and Sheet B: Design Requirements) and unstructured chat messages:
- **Sheet A (SM CONTENT):** One row per social deliverable with posting date, topic, format (Poster, Carousel, Reel), owners for script/shoot/edit, approval status, and published link.
- **Sheet B (Design Requirements):** 14 design types (Static Post, Carousel Post, Story, Cover Image, Thumbnail, Meta Ads Creative, Class Announcement, Orientation Creative, Graduation Creative, Brochure, Certificate, Offer Creative, Placement Poster, Custom Request).
- **Problems Removed by Workflow V2:**
  - Date format inconsistencies and impossible chronological sequences (published date before posting date).
  - Out-of-order execution (editing started before script/footage is approved).
  - Invisible blockers, overloaded team members, and untracked revision cycles.
  - Arbitrary hourly alerts replaced by clean day-based tracking (`Blocked since <date>`, daily overdue checks at end-of-day).
  - Multi-brand clutter: operates in **single-brand mode** for **HACA** with school names in plan titles.

---

## 2. Roles in this Flow

| Role Key | Spec Title | Responsibilities in Content Flow |
|---|---|---|
| **`creative_head`** *(was marketing_head)* | Creative Head | **Approves plans and review stages:** Verifies calendar plans (approve all, approve selected rows, request changes with mandatory row comments, or reject the whole plan with an overall strategic concern); reviews and approves deliverables on review stages (`Script`, `Content`, `Design`, `Edit`); requests revisions with notes; classifies revision root causes (7 canonical causes); edits team operating fields. **Cannot upload plans or create users.** |
| **`sm_manager`** *(was team_lead)* | SM Manager | **Main operational planner:** Uploads or types calendar plans (`monthly` and `individual`), selects deliverable types with instant stage list and owner/deadline auto-fill suggestions, customizes suggestions (tagged 'set by SM Manager'), submits plans to Creative Head. Once approved, can change stage owners/deadlines or reschedule $F$ with audit logging, tracks every stage across content pieces in Content Tracker, resolves blockers, monitors workload. **Cannot approve plans or review stages.** |
| **`team_member`** | Creative Contributor | **Worker:** Sees assigned stages in `/my-work` (downstream locked stages appear greyed out with due dates). Executes work, updates status, pastes deliverable links, submits review stages to Creative Head or clicks Done and forward for non-review stages (`Shoot`, `Post`), replies to feedback, marks Blocked (9 canonical reasons), requests work from SM Manager. Sees only own items. |
| **`executive`** | Executive Leadership | **Read-only viewer:** Total visibility into dashboard, calendar plans, content tracker, workload, and reports. Zero write/mutation permissions (HTTP 403). Contact details masked. Excluded from workload and candidate pools. |
| **`admin`** | System Owner | **IT / System Admin:** System administration, user management, and access request approvals. Holds all permissions. Excluded from workload and candidate pools. Holds emergency operational rights. |

*Approver rule:* Approvals belong strictly to the `creative_head` (or `admin`). The SM Manager assigns and orchestrates, but **cannot approve**.

---

## 3. The End-to-End Lifecycle (Workflow V2)

```mermaid
sequenceDiagram
    autonumber
    actor SMM as SM Manager
    actor CH as Creative Head
    actor Worker as Team Member
    actor Publisher as Posting Owner
    
    Note over SMM: 1. Plan Creation & Auto-Fill
    SMM->>SMM: Upload 24-col CSV/Excel or enter in grid (Monthly / Individual)
    SMM->>SMM: Select Type -> Instant Auto-Fill of Owners (<85%) & Deadlines (F-5, F-2, etc.)
    Note over SMM: 2. Submit Plan
    SMM->>CH: Submit Plan (Validation errors block submit)
    Note over CH: 3. Verify Plan
    CH->>SMM: Approve All / Approve Selected / Request Changes / Reject Plan with Concern
    Note over SMM,CH: 4. Build ContentPieces & Stages
    SMM->>SMM: Approved rows generate ContentPieces & Stage WorkItems
    Note over Worker: 5. Execute Stage (Stage 1 Unlocked; Others Locked)
    Worker->>Worker: Executes stage in My Work & pastes output link
    alt Review Stage (Script, Content, Design, Edit)
        Worker->>CH: Submit for approval
        Note over CH: 6. Review & Feedback
        CH->>Worker: Approve (unlocks next stage) OR Revision Required (note attached)
    else Non-Review Stage (Shoot, Post)
        Worker->>Worker: Done and forward (footage link unlocks Edit)
    end
    Note over Publisher: 7. Publish & Track
    Publisher->>Publisher: Publishes content, enters live URL & date (Piece marked complete)
    Note over SMM,CH: Live tracking in Content Tracker & Dashboard
```

### Detailed Lifecycle Steps:

### Step 1: Create Calendar Plan
The SM Manager initiates a **Calendar Plan**:
* **Two Kinds Only:**
  * `monthly`: Monthly Calendar covering full month of scheduled deliverables.
  * `individual`: Individual Work containing **exactly one row** (same form, same fields, same approval).
  * *(Note: `project` kind is removed; campaigns and events are grouped via the row field `Program or event`).*
* **Plan Title:** Carries the school name and period, e.g., `'Tech School November 2026'` (HACA only; single-brand mode).
* **Data Entry Modes:**
  * **24-Column CSV / Excel Upload:** Downloadable standardized template; client-side preview with auto-fill; minimal 5-column upload supported.
  * **Interactive Grid:** Fast inline table editor.

### Step 2: Row Fields & Instant Auto-Fill
When a deliverable type (and reel toggles) is selected, the system immediately populates suggested owners and deadlines:
* **Row Fields:**
  * `Posting date F`: live date or needed-by delivery date (required).
  * `Posting time`: optional.
  * `Topic`: deliverable title (required).
  * `Type`: Reel plus 14 design types (required).
  * `For team`: `Sales`, `Marketing`, `Academics`, `Other` (required).
  * `Program or event`: grouping field (optional).
  * `Brief`: creative brief up to 1,000 characters (required).
  * `Reference link`: input URL for research/inspiration (optional; outputs never stored here).
  * `Priority`: `Normal` or `Urgent` (required, default `Normal`).
  * `Remarks`: operational notes (optional).
  * `Posting owner`: required for live types.
* **Owner Suggestions:** Evaluates active `team_member` candidates matching `Person.workPreferences[]`, with workload $<85\%$ (accounting for open work plus draft plan hours: Content 2h, Script 2h, Design 4h, Shoot 4h, Edit 6h, Post 1h), ranked by: lowest workload $\rightarrow$ fewest 90-day revisions $\rightarrow$ earliest availability. Rationale displayed next to name. Fallback: `'No available person with this role'`.
* **Suggested Deadlines (Calendar days from $F$; 2-day buffer after last creation stage):**
  * Postable Design: Content $F-5$, Design $F-2$, Post $F$.
  * Non-postable Design: Content $F-5$, Design $F-2$, Handover $F$.
  * Reel Variant A (Script + Shoot): Script $F-8$, Shoot $F-5$, Edit $F-2$, Post $F$.
  * Reel Variant B (Shoot only): Shoot $F-5$, Edit $F-2$, Post $F$.
  * Reel Variant C (Edit only): Edit $F-2$, Post $F$.
* **Overrides:** Any changed value is tagged `'set by SM Manager'`. If $F$ changes, only non-set values recalculate.

### Step 3: Validation & Submission
* **Blocking Errors:** Prevent plan submission (missing required fields, unknown type, past dates, stage deadline after $F$, out-of-order deadlines, Reel without shoot lacking source video link, postable type missing posting owner, invalid owner, duplicate row, individual plan with != 1 row).
* **Warnings (Allowed):** Last creation stage $>F-1$, owner workload $>85\%$, row date outside plan month.
* **Submission:** Transitions submitted rows to `submitted`. Plan status becomes `Submitted`.

### Step 4: Creative Head Verification & Approval
The Creative Head reviews the plan in **Feedback & Revisions $\rightarrow$ Plan Approvals**:
* **Approve All:** Approves all submitted rows.
* **Approve Selected:** Approves valid rows; unapproved remain pending.
* **Request Changes:** Attaches mandatory comment to row (`changes_requested`).
* **Reject Whole Plan:** Rejects entire plan with an overall concern stored on the plan; all submitted rows go to `changes_requested`.
* SM Manager edits and resubmits only rows in `draft` or `changes_requested`.

### Step 5: Post-Approval Pipeline Generation
* When a row transitions to `approved`, the system automatically generates a parent **ContentPiece** and sequential stage **WorkItems** using the owners and deadlines validated in the row.
* **Sequential Locking:** Stage 1 unlocks immediately (`unlockedAt = new Date()`). Downstream stages remain locked (`unlockedAt = null`), visible greyed out in the worker's `/my-work` view with scheduled due dates.
* **Mid-Flight Mutations:** SM Manager and Admin can change an owner, a deadline, reschedule $F$, or skip an unstarted stage. Every change is logged in `ActivityEvent` (`who`, `when`, `old`, `new`), and the worker and Creative Head are notified. Topic and type cannot change after approval.

### Step 6: Contributor Execution & Review Loops
* Contributor opens `/my-work`, clicks **Start Work** (`In Progress`), and pastes deliverable URL.
* **Review Stages (`Script`, `Content`, `Design`, `Edit`):** Worker clicks **Submit for approval**.
  * Creative Head reviews: **Approve** (unlocks next stage) or **Revision Required** (attaches note, work returns to worker queue, revision count increments).
  * When revisions reach **4**, an automatic `RevisionFlag` is raised and pinned at the top of the Creative Head dashboard until classified.
* **Non-Review Stages (`Shoot`, `Post`):**
  * `Shoot`: Worker pastes raw footage folder link and clicks **Done and forward** (no review required; unlocks Edit immediately).
  * `Post`: Posting owner publishes asset, inputs live public URL and timestamp, marking the piece complete. Non-postable items conclude upon final design approval and are handed over on date $F$.

---

## 4. Pipeline Definitions

Every piece is a **ContentPiece** that groups its stages. **Each stage is a normal Work Item** with its own owner, deadline, and status.

### 4.1 Design Pipeline (14 Design Types)

| # | Stage | Done by | Reviewed by | Output |
|---|---|---|---|---|
| 1 | **Content** | Content writer (`workPreferences: Content`) | Creative Head (Content Approval) | Content document link |
| 2 | **Design** | Graphic designer (`workPreferences: Design`) | Creative Head (Design Approval) | High-res assets / Drive link |
| 3 | **Post** *(only for postable types)* | Posting owner (`workPreferences: Post`) | None (Done and forward) | Published live URL and time |

*Completion rule:* Non-postable design items are **final done** upon Design Approval and handed over on date $F$. Postable items proceed to Post.

### 4.2 Reel Pipeline

Configured when the row is created via two toggles: **Needs script?** and **Needs shoot?**:

| Variant | Conditions | Sequential Stages |
|---|---|---|
| **Variant A** | Needs script: Yes, Needs shoot: Yes | `Script` (reviewed) $\rightarrow$ `Shoot` $\rightarrow$ `Edit` (reviewed) $\rightarrow$ `Post` |
| **Variant B** | Needs script: No, Needs shoot: Yes | `Shoot` $\rightarrow$ `Edit` (reviewed) $\rightarrow$ `Post` |
| **Variant C** | Needs script: No, Needs shoot: No (cut from program video) | `Edit` (reviewed) $\rightarrow$ `Post` *(Source video link required)* |

| Stage | Done by | Reviewed by | Output |
|---|---|---|---|
| **Script** | Writer (`workPreferences: Script`) | Creative Head (Script Approval) | Script document link |
| **Shoot** | Anyone with `workPreferences: Shoot` | None (Shoot Done) | Raw footage folder link |
| **Edit** | Video Editor (`workPreferences: Edit`) | Creative Head (Edit Approval) | Rendered video link |
| **Post** | Posting owner (`workPreferences: Post`) | None (Published) | Published live URL and timestamp |

### 4.3 Type-to-Pipeline Mapping

| Content Type | Pipeline | Has Post Stage? |
|---|---|---|
| **Reel** | Reel (Variant A, B, or C) | Yes (Live on $F$) |
| **Static Post**, **Carousel Post**, **Story** | Design | Yes (Live on $F$) |
| **Cover Image**, **Thumbnail** | Design | No (Handover on $F$) |
| **Meta Ads Creative** | Design | No (Handover on $F$) |
| **Class Announcement**, **Orientation Creative**, **Graduation Creative**, **Brochure**, **Certificate**, **Offer Creative**, **Placement Poster**, **Custom Request** | Design | No (Handover on $F$) |

---

## 5. Due-Date Offsets (Calendar Days from $F$)

| Pipeline | Stage Deadlines | Handover / Live | Buffer |
|---|---|---|---|
| **Postable Design** | Content: $F - 5$, Design: $F - 2$ | Post: $F$ | 2 days after Design (1d review + 1d spare) |
| **Non-Postable Design** | Content: $F - 5$, Design: $F - 2$ | Handover: $F$ | 2 days after Design (1d review + 1d spare) |
| **Reel Variant A** | Script: $F - 8$, Shoot: $F - 5$, Edit: $F - 2$ | Post: $F$ | 2 days after Edit (1d review + 1d spare) |
| **Reel Variant B** | Shoot: $F - 5$, Edit: $F - 2$ | Post: $F$ | 2 days after Edit (1d review + 1d spare) |
| **Reel Variant C** | Edit: $F - 2$ | Post: $F$ | 2 days after Edit (1d review + 1d spare) |

*Sundays and holidays are not skipped when calculating offsets.*

---

## 6. Content Tracker View & Live Tracking

The Content Tracker lives on `/calendar?tab=tracker`:
* **Views:**
  * **Social View:** Tracks live social deliverables (`Reel`, `Static Post`, `Carousel Post`, `Story`) with posting date, topic, stage chips, live link, and turnaround.
  * **Design View:** Tracks collateral and design requirements with needed-by date, topic, stage chips, and assets link.
* **Operational Indicators:**
  * **Who holds it now:** Current holder name, Creative Head, SM Manager for 'needs owner', Blocked since <date>, or Locked.
  * **Piece Status:**
    * **`On Track`:** All active stages proceeding normally.
    * **`At Risk`:** Active stage due within **2 calendar days** and currently `Not Started`, `Pending`, or `Blocked`.
    * **`Late`:** Any stage has passed its deadline without being completed.
  * **Audited Days:** Late by days, owner lag days (due to submit), approval wait days (submit to approve).

---

## 7. Hour-Based Rules Removed

| Rule Area | Legacy Rule (Removed) | Workflow V2 Rule (Active) |
|---|---|---|
| **Blockers** | Escalates to SM Manager after 4 hours. | Dependency owner and SM Manager notified **instantly**; tracker displays: **`Blocked since <date>`**. No 4-hour alert. |
| **Overdue Work** | Escalates to SM Manager after 4 hours. | Notified **once** when due date passes (checked at end of day in `REPORT_TIMEZONE` by daily job); tracker shows **`Late by X days`**. |
| **Approvals** | Hourly escalation countdown. | Review queue displays: **`Waiting for X days`**. |
| **Revision Flags** | Escalates after 48 hours. | Pinned at **top of Creative Head dashboard** until classified. No 48-hour alert. |
| **Messaging** | Messages said *"blocked for 4h"*. | System messages and UI chips **never reference hour counts**. |

---

## 8. Canonical Taxonomies

### Blocker Reasons (9 Exact)
1. `Waiting for feedback`
2. `Waiting for content`
3. `Waiting for data`
4. `Technical issue`
5. `Dependency`
6. `Client/business approval`
7. `Resource issue`
8. `Unclear requirement`
9. `Other` *(free-text note required)*

### Revision Root Causes (7 Exact)
1. `Brief unclear`
2. `Creative direction unclear`
3. `Skill gap`
4. `Feedback inconsistency`
5. `Excessive scope change`
6. `Approval delay` *(was 'TL approval delay')*
7. `Client/business requirement changed`

---

## 9. Spreadsheet Import Template (24 Columns)

Columns in order:
1. `Posting Date`
2. `Posting Time`
3. `Topic`
4. `Type`
5. `For Team`
6. `Program or Event`
7. `Brief`
8. `Reference Link`
9. `Priority`
10. `Posting Owner`
11. `Content Owner`
12. `Content Deadline`
13. `Script Owner`
14. `Script Deadline`
15. `Needs Script`
16. `Needs Shoot`
17. `Shoot Owner`
18. `Shoot Deadline`
19. `Edit Owner`
20. `Edit Deadline`
21. `Design Owner`
22. `Design Deadline`
23. `Source Video Link`
24. `Remarks`

*Owners are provided by system email. Blank owners and deadlines are auto-filled during validation preview and tagged `'suggested'`. Minimal file with only `Posting Date`, `Topic`, `Type`, `For Team`, and `Brief` is fully supported.*
