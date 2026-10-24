# HACA Marketing OS: Project Report (V1 Scope Reset)

**Date:** 24 October 2026  
**Status:** Approved Master Scope Reset (Work and Team Only)  
**Source of Truth:** [docs/SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/SCOPE_RESET.md) and [docs/CONTENT_FLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/CONTENT_FLOW.md)

---

## 1. Executive Summary

HACA Marketing OS is a unified operational workspace where the HACA marketing team plans, assigns, produces, approves, and reports on marketing work. 

Under the **Scope Reset**, the portal is strictly focused on **Work and Team Management** for **HACA**. All external CRM synchronization, lead tracking (LeadSquared / LSQ), top-of-funnel conversion funnels, monthly revenue targets, and marketing campaigns have been completely removed. This eliminates external schema dependencies, protects creative time, and directs all system capabilities toward production throughput, pipeline verification, stage-by-stage approvals, and team capacity.

| Dimension | Legacy Model (Prior to Scope Reset) | HACA Marketing OS (Scope Reset Target) |
|---|---|---|
| **System Boundary** | Work + Leads + Campaigns + CRM Sync | **Work and Team Only** |
| **Brand Scope** | 7 brand profiles with brand switchers | **Single-Brand Mode (HACA only, profileId hidden)** |
| **Core Organizing Unit** | Campaign (linked to Monthly Target) | **Calendar Plan (Monthly or Project)** |
| **Roles (Exact 5 Keys)** | `admin`, `marketing_head`, `executive`, `team_lead`, `team_member` | `admin`, `creative_head`, `executive`, `sm_manager`, `team_member` |
| **Planning Mechanism** | Standalone campaigns and manual tasks | **Structured Calendar Plans (Excel/CSV upload or grid)** |
| **Plan Verification** | None (direct creation) | **Creative Head verification (approve all, selected rows, or line-item comments)** |
| **Creative Approvals** | Job-role based approver rule | **Dedicated `creative_head` role approves review stages** |
| **Performance** | 5 dimensions (including Business Impact) | **4 dimensions (Output, Efficiency, Quality, Collaboration)** |
| **Reports** | 6 reports (including Lead Funnel, CPL, Campaign Deep-Dive) | **4 core work reports** |
| **Automation** | 7 rules (including lsq_live_sync) | **6 core automation rules** |
| **Screens** | 14 screens (Campaigns, Leads, Data Center) | **12 core screens** (CRM and campaign pages removed) |

---

## 2. Problems Solved

1. **Scattered Trackers & Chat Approvals:** Eliminates fragmented Google Sheets (Sheet A: SM CONTENT and Sheet B: Design sheets) and unstructured WhatsApp approvals.
2. **Chronological & Status Inconsistencies:** Prevents impossible timelines (published dates recorded before posting dates) and out-of-order execution (video editing started before script or shoot is approved).
3. **Approval Bottlenecks & Overload:** Provides dedicated approval queues for the Creative Head and enforces workload limits ($<85\%$) during assignment.
4. **Untracked Revision Cycles:** Automatically flags pieces reaching 4 revisions, requiring root-cause classification by the Creative Head.
5. **Invisible Blockers:** Mandates naming a dependency owner when marking an item Blocked, triggering instant notification.

---

## 3. Scope Specification

### 3.1 In Scope (V1)
- **12 Core Screens & Views:**
  1. `/login`
  2. `/dashboard` (8 operational sections)
  3. `/my-work` (Personal contributor queue: Today, This Week, Later)
  4. `/calendar` (Month View, Calendar Plans upload/grid, Content Tracker)
  5. `/work/:id` (Single Work Detail with visual stage stepper and Cloudinary links)
  6. `/feedback` (Stage Approvals and Plan Approvals queues)
  7. `/workload` (Live team capacity bars and overload warnings)
  8. `/todo` (Prioritized task checklist)
  9. `/issues` (Active blockers and revision flags requiring classification)
  10. `/reports` (In-app viewer, "Generate Now", and scheduled rule controls)
  11. `/people` (People directory and operational assignment management)
  12. `/admin/access-requests` (Public access-request review console)
  Plus `/account` (My Account) and `/notifications`.
- **Calendar Plans & Content Pipelines:**
  - Monthly and Project plans created via standardized Excel/CSV template upload (with syntax validation preview) or interactive grid.
  - Verification & approval step by Creative Head.
  - Approved rows auto-generate ContentPieces and sequential stage WorkItems (Design pipeline and Reel pipeline Variants A, B, C).
  - Stage due dates counted backward from final date $F$.
- **Intelligent Stage Auto-Assignment:**
  - Matches candidate stage preferences from `Person.workPreferences[]`, capacity strictly $<85\%$, and deadline availability.
  - Never silent: SM Manager confirms all with one click or manually overrides.
- **Structured Review Feedback Loops:**
  - 2-entry feedback threads on review stages (`Script`, `Content`, `Design`, `Edit`) evaluated by Creative Head.
  - Non-review stages (`Shoot`, `Post`) completed via "Done and forward".
- **Turnaround & Audit:** Live stage tracking in Content Tracker, turnaround calculation, and ActivityEvent auditing.
- **4 Objective Reports & 6 Background Automation Rules.**

### 3.2 Completely Removed (Scope Reset)
- **Leads & CRM:** LSQ adapter, sync jobs, `Lead` model, `SyncRun`, `DataIssue`, Lead Funnel (`/leads`), Data Center (`/data-center`), WhatsApp inbound auto-task.
- **Campaigns & Targets:** `Campaign` model, routes, pages (`/campaigns`, `/campaigns/:id`), budget, spend actuals, OKR, `MonthlyTarget` model and routes.
- **Reports:** Lead Funnel & CPL Report, Campaign Deep-Dive Report.
- **Automation:** `lsq_live_sync`.
- **Performance:** Business Impact dimension.
- **WorkItem Fields:** `campaignId`, `relatedOKR`, `relatedTarget`, `leadsGenerated`, `qualifiedLeads`.
- **Permissions:** `target.*`, `campaign.*`, `lead.view`, `datacenter.view`.
- **Environment Variables:** `LSQ_*`.

---

## 4. Roles & Responsibilities

The system is governed by exactly **five role keys**:

| Role Key | Title | Scope & Authority |
|---|---|---|
| **`admin`** | System Owner | **IT / System Administration:** Derived all permissions. Only admin creates users, approves public access requests, assigns/changes roles, grants elevated roles (`admin`, `creative_head`, `executive`), suspends users, resets passwords, and forces logout. Excluded from workload and candidate pools. Lands on `/dashboard`. |
| **`creative_head`** *(was marketing_head)* | Creative Head | **Creative Authority:** Verifies and approves calendar plans (approve all, selected rows, or request changes with line-item comments); approves or requests revisions on review stages (`Script`, `Content`, `Design`, `Edit`); classifies revision root causes; reassigns work owners; manages team operating fields (`departmentId`, `jobRole`, `workPreferences`, `reportsToIds`, `weeklyCapacityHours`); controls reports and automation. Cannot create users, suspend accounts, change roles, or upload calendar plans. Lands on `/dashboard`. |
| **`sm_manager`** *(was team_lead)* | SM Manager | **Operational Planning Lead:** Uploads and types calendar plans (Monthly or Project), submits plans to Creative Head. Once approved, assigns/auto-assigns stage owners by work preference, confirms assignments with 1-click or overrides, sets/shifts deadlines, resolves blockers, tracks all stages in the Content Tracker, watches team workload. Cannot approve plans or review stages. Lands on `/dashboard`. |
| **`executive`** | Executive Leadership | **Read-Only Viewer:** CEO, Business Head, Board Directors. Universal read-only visibility into all marketing work, calendar plans, tracker, workload, and reports. Zero mutation privileges (HTTP 403 on all POST, PUT, PATCH, DELETE endpoints). People contact details (email/phone) masked. Excluded from workload and performance digests. Lands on `/dashboard`. |
| **`team_member`** | Creative Contributor | **Worker:** Writers, Graphic Designers, Video Editors, Animators, Specialists. Access restricted to own personal dashboard (`/my-work`), personal Todo, personal Calendar items, Work Detail, Notifications, and My Account. Executes stages, updates status, pastes deliverable links, submits review stages to Creative Head or clicks Done and forward for non-review stages (`Shoot`, `Post`), replies to feedback, marks Blocked, requests work from SM Manager. Sees only own items. Lands on `/my-work`. |

*Rule:* No other department lead roles exist. The Creative Manager (TL) approver rule is replaced directly by `creative_head`.

---

## 5. Dashboard Structure (8 Sections)

1. **Month Plan Status:** Plan progress (Draft, Submitted, Approved), planned pieces versus completed pieces, and publishing velocity.
2. **KPI Strip:** Planned, Completed, In Progress, At Risk (due in 72h not in review), Blocked, Pending Approval, Overdue.
3. **Today's Priorities:** Urgent deliverables due today or overdue.
4. **Production Stats & Trend:** Output breakdown by format (Reels, Static Posts, Carousels, Stories, Design assets) and weekly velocity.
5. **Team Workload:** Live capacity status across team members ($<65\%$ healthy, $65\%-85\%$ high, $>85\%$ overloaded).
6. **Issues & Blockers:** Open blockers with dependency owners and unclassified revision flags.
7. **Waiting for Approval:** Queue of deliverables awaiting Creative Head decision.
8. **Recent Activity:** Real-time feed of stage transitions, handoffs, approvals, and assignments.

---

## 6. Reports & Automation

### 6.1 Four Core Reports
1. **Weekly Work Report:** Delivered Mondays at 08:00 IST. Operational summary of completed work, on-time rate, and active bottlenecks.
2. **Monthly Performance Scorecard:** Generated on the last day of the month at 23:59 IST. Monthly output volume, average turnaround days, revision rates, and blocker resolution speeds.
3. **Creative Production Report:** Delivered Fridays at 18:00 IST. Detailed stage throughput across scripts, designs, video edits, and review turnaround times.
4. **Team Performance Digest:** Delivered on the 1st of every month at 09:00 IST. Contributor evaluation across the 4 dimensions (Output, Efficiency, Quality, Collaboration).

### 6.2 Six Core Automation Rules
1. `month_end_report`: Compiles and archives the monthly scorecard.
2. `overdue_escalation`: Alerts owner immediately upon deadline expiry; escalates to SM Manager after 4 hours.
3. `todo_escalation`: Flags items without status change for $>3$ days.
4. `blocker_dependency_alert`: Instantly notifies named dependency owner when an item is marked Blocked.
5. `revision_pattern_flag`: Raises a `RevisionFlag` when revisions reach 4 or exceed owner baseline by $>1$.
6. `weekly_report`: Compiles and distributes the Weekly Work Report.

---

## 7. Data Architecture & Migration

### 7.1 Single-Brand Data Model
- Single-brand mode: `Profile` records retain internal `profileId` pointing to HACA. Brand selection is hidden from the UI.
- `CalendarPlan` is the top-level grouping entity for content pieces.
- Sequential stage `WorkItem` records represent individual deliverable steps.

### 7.2 Database Purge & Cleanup
- Full backup completed via `mongodump` into `backup-before-scope-reset/`.
- Retired collections (`campaigns`, `monthlytargets`, `leads`, `dataissues`, `syncruns`) exported and deleted.
- Existing `WorkItem` records have fields `campaignId`, `relatedOKR`, `relatedTarget`, `leadsGenerated`, and `qualifiedLeads` unset. All work items and stage records are preserved intact.