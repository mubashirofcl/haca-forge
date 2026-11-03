# HACA Marketing OS: Project Report (V1 Scope Reset & Workflow V2)

**Date:** 25 October 2026  
**Status:** Approved Master Scope Reset & Workflow V2 (Work and Team Only)  
**Source of Truth:** [docs/WORKFLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/WORKFLOW.md), [docs/SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/SCOPE_RESET.md) and [docs/CONTENT_FLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/CONTENT_FLOW.md)

---

## 1. Executive Summary

HACA Marketing OS is a unified operational workspace where the HACA marketing team plans, assigns, produces, approves, and reports on marketing work. 

Under the **Scope Reset** and **Workflow V2**, the portal is strictly focused on **Work and Team Management** for **HACA**. All external CRM synchronization, lead tracking (LeadSquared / LSQ), top-of-funnel conversion funnels, monthly revenue targets, and marketing campaigns have been completely removed. Furthermore, arbitrary hour-based escalation timers and siloed project plans have been eliminated in favor of clean day-based tracking, instant stage auto-fill suggestions upon type selection, and structured plan reviews.

| Dimension | Legacy Model (Prior to Scope Reset) | HACA Marketing OS (Workflow V2 Target) |
|---|---|---|
| **System Boundary** | Work + Leads + Campaigns + CRM Sync | **Work and Team Only** |
| **Brand Scope** | 7 brand profiles with brand switchers | **Single-Brand Mode (HACA only; school in plan title)** |
| **Core Organizing Unit** | Campaign (linked to Monthly Target) | **Calendar Plan (`monthly` or `individual` with school title)** |
| **Roles (Exact 5 Keys)** | `admin`, `marketing_head`, `executive`, `team_lead`, `team_member` | `admin`, `creative_head`, `executive`, `sm_manager`, `team_member` |
| **Planning Mechanism** | Standalone campaigns and manual tasks | **Structured Calendar Plans (24-col CSV/Excel upload or grid; minimal 5-col support)** |
| **Stage Assignment** | Manual or post-approval recommendation | **Instant Auto-Fill upon Type Selection (<85% workload, ranked, default stage hours)** |
| **Plan Verification** | None (direct creation) | **Creative Head verification (approve all, selected rows, row comments, or reject plan with concern)** |
| **Creative Approvals** | Job-role based approver rule | **Dedicated `creative_head` role approves review stages** |
| **Escalation Logic** | Arbitrary 4h / 48h timers | **Day-based tracking ('blocked since <date>', daily overdue check, no hourly rules)** |
| **Performance** | 5 dimensions (including Business Impact) | **4 dimensions (Output, Efficiency, Quality, Collaboration)** |
| **Reports** | 6 reports (including Lead Funnel, CPL, Campaign Deep-Dive) | **4 core work reports** |
| **Automation** | 7 rules (including lsq_live_sync) | **6 core day-based automation rules** |
| **Screens** | 14 screens (Campaigns, Leads, Data Center) | **12 core screens** (CRM and campaign pages removed) |

---

## 2. Problems Solved

1. **Scattered Trackers & Chat Approvals:** Eliminates fragmented Google Sheets (Sheet A: SM CONTENT and Sheet B: Design sheets) and unstructured WhatsApp approvals.
2. **Chronological & Status Inconsistencies:** Prevents impossible timelines (published dates recorded before posting dates) and out-of-order execution (video editing started before script or shoot is approved).
3. **Approval Bottlenecks & Overload:** Provides dedicated approval queues for the Creative Head and enforces workload limits ($<85\%$) during auto-fill suggestion generation.
4. **Untracked Revision Cycles:** Automatically flags pieces reaching 4 revisions, pinned to the top of the Creative Head dashboard for root-cause classification (7 canonical causes).
5. **Invisible Blockers:** Mandates selecting from 9 canonical reasons and naming a dependency owner when marking an item Blocked, triggering instant notification and displaying `'blocked since <date>'`.
6. **False Urgency from Hourly Timers:** Replaces noisy 4-hour alerts with calm, predictable day-based operations (daily overdue checks at end-of-day in `REPORT_TIMEZONE`).

---

## 3. Scope Specification

### 3.1 In Scope (Workflow V2)
- **12 Core Screens & Views:**
  1. `/login`
  2. `/dashboard` (8 operational sections, At Risk = 2 days)
  3. `/my-work` (Personal contributor queue; locked stages greyed out with due dates)
  4. `/calendar` (Month View, Calendar Plans upload/grid, Content Tracker)
  5. `/work/:id` (Single Work Detail with visual stage stepper, input reference links, and audit history)
  6. `/feedback` (Stage Approvals and Plan Approvals queues)
  7. `/workload` (Live team capacity bars and overload warnings)
  8. `/todo` (Prioritized task checklist)
  9. `/issues` (Active blockers with 'blocked since <date>' and revision flags requiring classification)
  10. `/reports` (In-app viewer, "Generate Now", and scheduled rule controls)
  11. `/people` (People directory and operational assignment management)
  12. `/admin/access-requests` (Public access-request review console)
  Plus `/account` (My Account) and `/notifications`.
- **Calendar Plans & Content Pipelines:**
  - Two plan types: `monthly` (Monthly Calendar) and `individual` (Individual Work with exactly 1 row). `project` kind is removed.
  - Plan title carries school name, e.g. `'Tech School November 2026'`.
  - 24-column template upload with auto-fill preview, interactive grid, minimal 5-column file support.
  - Auto-fill suggestion engine at row creation upon Type selection (owners $<85\%$ workload; calendar-day deadline offsets: $F-5, F-2$, etc.).
  - Verification & approval step by Creative Head (approve all, selected rows, row comments, reject plan with concern).
  - Approved rows auto-generate ContentPieces and sequential stage WorkItems (Design pipeline and Reel pipeline Variants A, B, C). Stage 1 unlocked immediately; downstream stages locked.
- **Stage Execution & Feedback Loops:**
  - 2-entry feedback threads on review stages (`Script`, `Content`, `Design`, `Edit`) evaluated by Creative Head. 4th revision raises flag.
  - Non-review stages (`Shoot`, `Post`) completed via "Done and forward" or "Publish" with live URL and timestamp.
  - Non-postable items finish upon design approval and are handed over on date $F$.
- **Live Tracking & Audit:**
  - Content Tracker with Social and Design views, 'who holds it now', 'at risk' (active stage due in 2 calendar days), late by days, owner lag days, approval wait days.
  - Audit logging of post-approval mutations (`who`, `when`, `old`, `new`). Topic and type immutable post-approval.
- **4 Objective Reports & 6 Day-Based Automation Rules.**

### 3.2 Completely Removed (Scope Reset & Workflow V2)
- **Leads & CRM:** LSQ adapter, sync jobs, `Lead` model, `SyncRun`, `DataIssue`, Lead Funnel (`/leads`), Data Center (`/data-center`), WhatsApp inbound auto-task.
- **Campaigns & Targets:** `Campaign` model, routes, pages (`/campaigns`, `/campaigns/:id`), budget, spend actuals, OKR, `MonthlyTarget` model and routes.
- **Project Plans:** `kind: 'project'` removed; replaced by `individual` plans and `Program or event` row field.
- **Hour-Based Escalations:** 4-hour overdue escalation, 4-hour blocker escalation, 48-hour revision flag escalation. Messages never say 'blocked for 4h'.
- **Invented Slug Codes:** `assets_missing`, `brief_gap`, `waiting_approval`, etc., replaced by 9 canonical blocker reasons and 7 revision root causes.
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
| **`creative_head`** *(was marketing_head)* | Creative Head | **Creative Authority:** Verifies and approves calendar plans (approve all, selected rows, request changes with row comments, or reject whole plan with strategic concern); approves or requests revisions on review stages (`Script`, `Content`, `Design`, `Edit`); classifies revision root causes (7 canonical causes); reassigns work owners; manages team operating fields (`departmentId`, `jobRole`, `workPreferences`, `reportsToIds`, `weeklyCapacityHours`); controls reports and automation. Cannot create users, suspend accounts, change roles, or upload calendar plans. Lands on `/dashboard`. |
| **`sm_manager`** *(was team_lead)* | SM Manager | **Operational Planning Lead:** Uploads and types calendar plans (`monthly` and `individual`), selects deliverable types with instant stage list and owner/deadline auto-fill suggestions, customizes suggestions (tagged 'set by SM Manager'), submits plans to Creative Head. Once approved, can change stage owners/deadlines or reschedule $F$ with audit logging, tracks all stages in Content Tracker, resolves blockers, monitors team workload. Cannot approve plans or review stages. Lands on `/dashboard`. |
| **`executive`** | Executive Leadership | **Read-Only Viewer:** CEO, Business Head, Board Directors. Universal read-only visibility into all marketing work, calendar plans, tracker, workload, and reports. Zero mutation privileges (HTTP 403 on all POST, PUT, PATCH, DELETE endpoints). People contact details (email/phone) masked. Excluded from workload and performance digests. Lands on `/dashboard`. |
| **`team_member`** | Creative Contributor | **Worker:** Writers, Graphic Designers, Video Editors, Animators, Specialists. Access restricted to own personal dashboard (`/my-work`), personal Todo, personal Calendar items, Work Detail, Notifications, and My Account. Executes stages, updates status, pastes deliverable links, submits review stages to Creative Head or clicks Done and forward for non-review stages (`Shoot`, `Post`), replies to feedback, marks Blocked (9 canonical reasons), requests work from SM Manager. Sees only own items (locked stages greyed out with due dates). Lands on `/my-work`. |

*Rule:* No other department lead roles exist. The Creative Manager (TL) approver rule is replaced directly by `creative_head`.

---

## 5. Dashboard Structure (8 Sections)

1. **Month Plan Status:** Plan progress (Draft, Submitted, Approved, Approved with pending rows), planned deliverables versus completed deliverables, and publishing velocity.
2. **KPI Strip:** Planned, Completed, In Progress, At Risk (active stage due within 2 calendar days not in review), Blocked ('blocked since <date>'), Pending Approval ('waiting for X days'), Overdue (late by days).
3. **Today's Priorities:** Urgent deliverables due today or overdue.
4. **Production Stats & Trend:** Output breakdown by format (Reels, Static Posts, Carousels, Stories, Design assets) and weekly velocity.
5. **Team Workload:** Live capacity status across team members ($<65\%$ healthy, $65\%-85\%$ high, $>85\%$ overloaded).
6. **Issues & Blockers:** Open blockers (9 canonical reasons) with dependency owners and unclassified revision flags pinned at top.
7. **Waiting for Approval:** Queue of deliverables awaiting Creative Head decision.
8. **Recent Activity:** Real-time feed of stage transitions, handoffs, approvals, and assignments.

---

## 6. Reports & Automation

### 6.1 Four Core Reports
1. **Weekly Work Report:** Delivered Mondays at 08:00 IST. Operational summary of completed work, on-time rate, and active bottlenecks.
2. **Monthly Performance Scorecard:** Generated on the last day of the month at 23:59 IST. Monthly output volume, average turnaround days, revision rates, and blocker resolution speeds.
3. **Creative Production Report:** Delivered Fridays at 18:00 IST. Detailed stage throughput across scripts, designs, video edits, and review turnaround times.
4. **Team Performance Digest:** Delivered on the 1st of every month at 09:00 IST. Contributor evaluation across the 4 dimensions (Output, Efficiency, Quality, Collaboration).

### 6.2 Six Core Automation Rules (Day-Based)
1. `month_end_report`: Compiles and archives the monthly scorecard.
2. `overdue_daily_notification`: Daily check at end of day in `REPORT_TIMEZONE`; alerts owner and SM Manager once.
3. `todo_inactivity_reminder`: Flags items without status change for 3 consecutive days (owner Day 3, SM Manager Day 4).
4. `blocker_dependency_alert`: Instantly notifies named dependency owner and SM Manager when an item is marked Blocked; displays 'blocked since <date>'.
5. `revision_pattern_flag`: Raises a `RevisionFlag` when revisions reach 4 or exceed owner baseline by $>1$; pinned on dashboard until classified.
6. `weekly_report`: Compiles and distributes the Weekly Work Report.

---

## 7. Data Architecture & Migration

### 7.1 Single-Brand Data Model
- Single-brand mode: `Profile` records retain internal `profileId` pointing to HACA. Brand selection is hidden from the UI.
- `CalendarPlan` is the top-level grouping entity for content pieces (`kind: 'monthly' | 'individual'`).
- Sequential stage `WorkItem` records represent individual deliverable steps with row-inherited owners and deadlines.

### 7.2 Database Purge & Backup
- Full backup completed via `mongodump` into `../haca-backups/before-workflow-v2/marketing_portal`.
- Pre-workflow git tag: `pre-workflow-v2`.
- All historical work items and stage records are preserved intact.