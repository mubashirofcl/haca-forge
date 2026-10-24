# Project context: HACA Marketing OS (V1 Scope Reset)

One unified system where the HACA marketing team plans, assigns, produces, approves and reports marketing work.
The portal manages **WORK and TEAM only, for HACA only**.
Source of truth: `docs/SCOPE_RESET.md`, `docs/CONTENT_FLOW.md`, and `docs/PROJECT_REPORT.md`.

## Scope Reset Summary
Build ONLY what the Scope Reset defines:
- **Calendar Plans** (Monthly or Project, via CSV/Excel upload or interactive grid);
- **Creative Head Verification & Row Approval** (approve all, approve selected rows, or request changes with comments);
- **ContentPiece & Sequential Stage WorkItems** (Design pipeline and Reel pipeline Variants A, B, C);
- **Intelligent Stage Auto-Assignment** with candidate recommendations matching `workPreferences[]` and capacity `<85%`;
- **Structured Review Feedback Loops** evaluated by Creative Head (`Script`, `Content`, `Design`, `Edit`);
- **Non-Review Stages** completed via 'Done and forward' (`Shoot`, `Post`);
- **Content Tracker** table view on `/calendar` (Social view and Design view);
- **8-Section Dashboard**;
- **4 Objective Reports** (Weekly Work Report, Monthly Performance Scorecard, Creative Production Report, Team Performance Digest);
- **6 Automation Rules** (`month_end_report`, `overdue_escalation`, `todo_escalation`, `blocker_dependency_alert`, `revision_pattern_flag`, `weekly_report`);
- **4 Performance Dimensions** (Output, Efficiency, Quality, Collaboration);
- **Single-Brand Mode** (HACA only; brand selection hidden).

## Removed Completely (Scope Reset)
- Leads (LSQ adapter, sync jobs, Lead model, SyncRun, DataIssue, Lead Funnel, Data Center, WhatsApp inbound auto-task);
- Campaigns (model, routes, pages, budget, spend, OKR);
- Monthly Targets (model, routes, pages);
- Reports: Lead Funnel & CPL Report, Campaign Deep-Dive Report;
- Automation: `lsq_live_sync`;
- Performance: Business Impact dimension;
- WorkItem attributes: `campaignId`, `relatedOKR`, `relatedTarget`, `leadsGenerated`, `qualifiedLeads`;
- Permission keys: `target.*`, `campaign.*`, `lead.view`, `datacenter.view`;
- Environment variables: `LSQ_*`.

## Roles (Exact Five Keys)
1. **`admin`**: System Owner outside creative hierarchy. Derived all permissions. Only admin creates users, approves access requests, changes roles, grants elevated roles (`admin`, `creative_head`, `executive`), suspends, resets passwords, forces logout. Excluded from workload and candidate pools.
2. **`creative_head`** *(was marketing_head)*: Creative Director. Verifies and approves calendar plans; approves or requests revisions on review stages (`Script`, `Content`, `Design`, `Edit`); classifies revision root causes; edits team operating fields (`departmentId`, `jobRole`, `workPreferences`, `reportsToIds`, `weeklyCapacityHours`); controls reports and automation. Cannot create users, suspend accounts, change roles, or upload calendar plans.
3. **`sm_manager`** *(was team_lead)*: Main operational planner. Uploads/types calendar plans (Monthly or Project), submits to Creative Head. Once approved, assigns/auto-assigns stages by work preference with 1-click confirmation or override, sets/shifts deadlines, resolves blockers, tracks all stages in Content Tracker, watches workload. Cannot approve plans or review stages.
4. **`executive`**: Leadership viewer (CEO, Business Head, Directors). Read-only viewer across all screens. Zero mutation privileges (HTTP 403). Contact details masked. Excluded from workload and candidate pools.
5. **`team_member`**: Creative contributor. Own portal only (`/my-work`, Todo, own Calendar items, Work Detail, Notifications, My Account). Starts work, updates status, pastes deliverable links, submits to Creative Head (review stages) or Done and forward (non-review stages), replies to feedback, marks Blocked, requests work from SM Manager. Sees only own items.

*Approver rule:* No other department lead roles. Creative Manager (TL) approver rule is replaced by `creative_head`.
