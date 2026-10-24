# HACA Marketing OS: Scope Reset Impact Analysis & Implementation Matrix

**Date:** 24 October 2026  
**Status:** Approved Architectural Impact Analysis (No Code Changes)  
**Authority:** [docs/SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/SCOPE_RESET.md), [docs/CONTENT_FLOW.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/CONTENT_FLOW.md), and [docs/BUILD_PLAN.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/BUILD_PLAN.md)  
**Current Codebase Path:** `c:\Users\ADMIN\OneDrive\Desktop\HACA\TECH\haca-forge`  
**Current Test Baseline:** **232 passing tests** across 17 test files (16 backend API suites = 231 tests; 1 frontend web suite = 1 test).

---

## 1. Executive Summary & Paradigm Shift

The HACA Marketing OS portal is resetting its operational scope to **WORK and TEAM only, for HACA only**. 

All commercial lead acquisition (LeadSquared / LSQ), CRM synchronization, revenue targeting, campaign budgeting, and top-of-funnel conversion reporting are retired. The system transitions from a broad marketing CRM cockpit into an internal creative operations, calendar planning, content pipeline execution, stage approval, and capacity management system.

```mermaid
graph TD
    subgraph Retain & Refocus
        Auth[Authentication & Session Refresh]
        People[People Directory & Operations]
        Access[Access Requests Admin]
        Work[WorkItem Execution & States]
        Feedback[Stage Approvals & Feedback Rounds]
        Workload[Team Capacity Engine <85%]
        Tracker[Content Tracker Table]
        Plans[Calendar Plans: Upload & Grid]
    end

    subgraph Retired Completely (Phase R1)
        Leads[❌ Leads & LSQ Sync]
        DataCenter[❌ Data Center Console]
        Campaigns[❌ Campaigns & OKRs]
        Targets[❌ Monthly Revenue Targets]
        BizImpact[❌ Business Impact Metric]
        MultiBrand[❌ Multi-Brand Switcher]
    end
```

---

## 2. Current Quality & Test Baseline

Before any code modifications begin, the test baseline is verified and locked:

### 2.1 Backend API Suite (`npm test` in `apps/api`)
* **Test Runner:** Vitest v3.2.7
* **Status:** **16 passed (16 test files), 231 passed (231 tests)**
* **Execution Time:** ~79 seconds

| Test File | Tests | Status | Scope Affected by Reset? |
|---|---|---|---|
| `test/status.test.js` | 1 | Passed | No (health endpoint) |
| `test/permissions.test.js` | 9 | Passed | **Yes** (role keys & permission keys updated in R2) |
| `test/request_access_schema.test.js` | 7 | Passed | No (public access schema) |
| `test/phase1_scoping.test.js` | 14 | Passed | **Yes** (role keys updated to 5 keys in R2) |
| `test/access_service_and_api.test.js` | 9 | Passed | No (access request review) |
| `test/pass1_session_security.test.js` | 19 | Passed | **Yes** (campaign reference in token test updated in R1/R2) |
| `test/targets_and_campaigns.test.js` | 15 | Passed | **RETIRED** (replaced in R1) |
| `test/work_items_and_transitions.test.js` | 24 | Passed | **Yes** (`campaignId` removed from creation fixture in R1) |
| `test/assignment_and_workload.test.js` | 18 | Passed | **Yes** (`campaignId` removed from fixtures in R1) |
| `test/feedback_and_blockers.test.js` | 16 | Passed | **Yes** (approver role updated to `creative_head` in R2) |
| `test/dashboard_and_filters.test.js` | 18 | Passed | **Yes** (targets and campaign widgets updated in R4) |
| `test/automation_and_reports.test.js` | 14 | Passed | **Yes** (lsq sync and deep-dive reports retired in R1/R4) |
| `test/leads_and_datacenter.test.js` | 9 | Passed | **RETIRED** (replaced in R1) |
| `test/executive_role.test.js` | 22 | Passed | **Yes** (permissions pruned to active routes in R2) |
| `test/reset_and_demo_seed.test.js` | 9 | Passed | **Yes** (demo roles updated in R2) |
| `test/phase9_mos_e2e.test.js` | 11 | Passed | **RETIRED** (replaced by `phase_r_e2e.test.js` in R4) |

### 2.2 Frontend Web Suite (`npm test` in `apps/web`)
* **Test Runner:** Vitest v3.2.7 + React Testing Library + JSDOM
* **Status:** **1 passed (1 test file), 1 passed (1 test)**
* **File:** `apps/web/src/App.test.tsx` (Smoke test passing cleanly)

### 2.3 Build Verification
* `npm run build` in `packages/shared`: Clean build via `tsup`.
* `npm run build` in `apps/web`: Clean production build via `vite build`.

---

## 3. Grouped Impact Inventory (Phases R1 through R4)

---

### Phase R1: Scope Reset & Removal Impact

The primary goal of R1 is total removal of dead code, retired endpoints, schemas, environment variables, and database documents without breaking retained work workflows.

#### 1. Files & Directories to Delete
| File / Directory | Location | Description |
|---|---|---|
| `apps/api/src/modules/leads/` | Entire directory | LSQ adapter, Lead model, lead controller, routes, service. |
| `apps/api/src/modules/campaigns/` | Entire directory | Campaign model, controller, routes, service. |
| `apps/api/src/modules/targets/` | Entire directory | MonthlyTarget model, controller, routes, service, seed. |
| `apps/web/src/pages/campaigns/` | Entire directory | `CampaignsPage.tsx`, `CampaignDetailPage.tsx`. |
| `apps/web/src/pages/leads/` | Entire directory | `LeadFunnelPage.tsx`. |
| `apps/web/src/pages/datacenter/` | Entire directory | `DataCenterPage.tsx`. |
| `apps/api/test/leads_and_datacenter.test.js` | Single file | Test suite for retired lead and datacenter endpoints. |
| `apps/api/test/targets_and_campaigns.test.js` | Single file | Test suite for retired monthly targets and campaigns. |

#### 2. Backend Routes to Unregister (`apps/api/src/server.js`)
* Unregister `/api/campaigns` (`campaignRoutes`)
* Unregister `/api/targets` (`targetRoutes`)
* Unregister `/api/leads` (`leadRoutes`)
* Unregister `/api/datacenter` (`dataCenterRoutes`)

#### 3. Database Collections & Documents to Purge
* `campaigns` (Export to JSON archive, then delete documents)
* `monthlytargets` (Export to JSON archive, then delete documents)
* `leads` (Export to JSON archive, then delete documents)
* `dataissues` (Export to JSON archive, then delete documents)
* `syncruns` (Export to JSON archive, then delete documents)

#### 4. WorkItem Model Modifications (`apps/api/src/modules/workItems/model.js`)
* Remove schema fields:
  * `campaignId`
  * `relatedOKR`
  * `relatedTarget`
  * `leadsGenerated`
  * `qualifiedLeads`
* Update indexes:
  * Drop index `{ campaignId: 1 }`.
  * Add index `{ calendarPlanId: 1 }` and `{ contentPieceId: 1 }`.
* Database migration script:
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

#### 5. Background Jobs & Automation Pruning (`apps/api/src/modules/jobs/processors.js`)
* Remove `lsq_live_sync` queue processor and repeatable scheduler.
* Remove inbound WhatsApp lead auto-task creation handler.

#### 6. Environment Variables to Delete (`apps/api/src/config/env.js`)
* `LSQ_ACCESS_KEY`
* `LSQ_SECRET_KEY`
* `LSQ_HOST_URL`
* `LSQ_WEBHOOK_SECRET`
* Update `.env.example` to remove all `LSQ_*` entries.

#### 7. Shared Package Pruning (`packages/shared/src/index.ts`)
* Remove permission keys from `PERMISSION_KEYS`:
  * `target.view`, `target.manage`
  * `campaign.view`, `campaign.manage`
  * `lead.view`
  * `datacenter.view`
* Remove enums & types:
  * `CAMPAIGN_STATUSES`, `CAMPAIGN_GOAL_TYPES`, `EXPECTED_OUTCOMES`
  * `LEAD_SOURCES` (19 items), `FUNNEL_STAGES` (12 items)
  * Remove `business_impact` from performance dimensions.
* Remove Zod schemas:
  * `campaignCreateSchema`, `campaignUpdateSchema`, `monthlyTargetSchema`, `leadQuerySchema`.

#### 8. Frontend Navigation & Single-Brand Enforcement (`apps/web/src/`)
* In `apps/web/src/App.tsx`:
  * Remove route definitions for `/campaigns`, `/campaigns/:id`, `/leads`, `/data-center`.
* In `apps/web/src/components/layout/Navbar.tsx` & `Sidebar.tsx`:
  * Remove navigation links for Campaigns, Leads, and Data Center.
  * Hide brand selection dropdowns, profile switchers, and brand tabs across all layouts.
  * Permanently bind active brand context to **HACA**.

---

### Phase R2: Roles & Permissions Alignment Impact

The goal of R2 is establishing the exact **5 canonical role keys** and updating CASL abilities, `resolveScope`, and route security guards.

#### 1. Canonical Role Keys (`packages/shared/src/index.ts`)
```typescript
export const ROLE_KEYS = [
  'admin',
  'creative_head', // was marketing_head
  'executive',
  'sm_manager',    // was team_lead
  'team_member'
] as const;
```

#### 2. Added Permission Keys
* `calendar.plan`: Create, upload, edit, and submit calendar plans.
* `calendar.approve`: Verify, approve, or request changes on calendar plans; approve review stages.

#### 3. Canonical Role-to-Permission Map
| Role Key | Permissions Granted |
|---|---|
| **`admin`** | `*` (All keys derived dynamically from `PERMISSION_KEYS`). |
| **`creative_head`** | `portal.view`, `people.view`, `people.assign`, `calendar.view`, `calendar.approve`, `work.view`, `work.create`, `work.assign`, `feedback.give`, `feedback.view`, `blocker.resolve`, `analytics.team`, `report.view`, `report.configure`, `automation.manage`. |
| **`sm_manager`** | `portal.view`, `people.view`, `calendar.view`, `calendar.plan`, `work.view`, `work.create`, `work.assign`, `feedback.view`, `blocker.resolve`, `analytics.team`, `report.view`. |
| **`executive`** | `portal.view`, `people.view` (masked), `calendar.view`, `work.view`, `feedback.view`, `analytics.team`, `report.view`. |
| **`team_member`** | `portal.view`, `calendar.view`, `work.view.own`, `work.update.own`, `work.request`, `feedback.view.own`, `feedback.reply`. |

#### 4. Scope Resolution Updates (`apps/api/src/modules/common/scope.js`)
* Remove profile resolution across multi-brands; hard-bind to active HACA profile.
* `personScope`:
  * `all`: For `admin`, `creative_head`, `sm_manager`, and `executive`.
  * `self`: For `team_member` (scoped strictly to `userId`).

#### 5. Role Boundary Guards
* **Executive Role Lock:** Ensure HTTP 403 Forbidden is returned on every POST, PUT, PATCH, DELETE route.
* **People Contact Masking:** In `/api/people`, strip `email` and `phone` when caller's role is `executive`.
* **Elevated Role Protection:**
  * Only `admin` can create users, change roles, or grant `admin`, `creative_head`, `executive`.
  * `creative_head` can edit operational fields (`departmentId`, `jobRole`, `workPreferences`, `reportsToIds`, `weeklyCapacityHours`) of `sm_manager` and `team_member`, but cannot touch `admin`, `executive`, or other `creative_head` accounts.
* **Approver Guard:**
  * Only `creative_head` and `admin` can approve review stages (`Script`, `Content`, `Design`, `Edit`).
  * `sm_manager` and `team_member` are barred from approving review stages.
  * An owner cannot approve their own stage.
* **Department Approver Simplification:**
  * The legacy rule requiring a separate `Creative Manager (TL)` job-role approver is replaced by the dedicated `creative_head` role.

#### 6. Database User Migration
* Migration script `scripts/migrate-scope-reset-roles.js`:
  * Map `marketing_head` $\rightarrow$ `creative_head`.
  * Map `team_lead` $\rightarrow$ `sm_manager`.
  * Update `scripts/seed-demo-users.js` to seed the exact 5 roles.

---

### Phase R3: Calendar Plans, ContentPiece Pipelines & Assignment Engine Impact

Phase R3 builds the core content operating workflow: calendar plan creation, verification, stage work item generation, intelligent auto-assignment, and the Content Tracker table.

#### 1. New Backend Modules & Models
* **`apps/api/src/modules/calendarPlans/`:**
  * `model.js`: `CalendarPlan` schema (`kind`, `title`, `period`, `status`, `rows[]`, `createdById`, `reviewedById`).
  * `service.js`: Plan creation, CSV/Excel parsing with syntax preview, submission, Creative Head row-level approval, ContentPiece generation trigger.
  * `controller.js`: Route handlers for upload, preview, commit, submit, approve, reject.
  * `routes.js`: Registered at `/api/calendar-plans`.
* **`apps/api/src/modules/contentPieces/`:**
  * `model.js`: `ContentPiece` schema (`code`, `topic`, `contentType`, `calendarPlanId`, `finalDate`, `pipeline`, `needsScript`, `needsShoot`, `contentLink`, `assetsLink`, `status`, `turnaroundDays`).
  * `service.js`: Pipeline stage generator constructing stage `WorkItems` with due dates counted backward from final date $F$.
  * `controller.js` & `routes.js`: Registered at `/api/content-pieces`.

#### 2. Pipeline Due-Date Offset Formulas
* **Design Postable:** Content ($F-6$), Design ($F-3$), Post ($F$).
* **Design Non-Postable:** Content ($F-5$), Design ($F-2$, approved by $F$).
* **Reel Variant A (Script + Shoot):** Script ($F-10$), Shoot ($F-7$), Edit ($F-4$), Post ($F$).
* **Reel Variant B (No Script + Shoot):** Shoot ($F-7$), Edit ($F-4$), Post ($F$).
* **Reel Variant C (No Script + No Shoot):** Edit ($F-4$), Post ($F$).
* One-click deadline shift helper: shifts unstarted stage deadlines when final date shifts.

#### 3. Intelligent Auto-Assignment Service Updates (`modules/assignment/service.js`)
* Stage candidates matched from `Person.workPreferences[]` (`Content`, `Script`, `Design`, `Shoot`, `Edit`, `Post`).
* Candidate filter: workload percentage strictly $<85\%$, and available bandwidth before deadline.
* Ranking: lowest `workloadPct`, lowest `avgRevisions`, earliest availability.
* Confirmation UI: 1-click confirmation or override by SM Manager. Overrides logged in `AssignmentOverride`.

#### 4. Frontend UI Components (`apps/web/src/pages/calendar/`)
* **Calendar Plans Tab:**
  * Excel / CSV upload modal with client-side syntax error preview table.
  * Interactive inline table grid for direct row entry.
  * Plan status badges: `Draft`, `Submitted`, `Changes requested`, `Approved`.
* **Plan Approvals Queue (`apps/web/src/pages/feedback/`):**
  * Dedicated queue for Creative Head to approve all rows, approve selected rows, or add line-item comments.
* **Content Tracker Tab (`apps/web/src/pages/calendar/`):**
  * Social View & Design View table tabs.
  * Color-coded stage status chips.
  * Row click opens Single Work Detail (`/work/:id`) with sequential stage stepper.

---

### Phase R4: Dashboard, Reports, Automation & Comprehensive Tests Impact

Phase R4 delivers the 8-section dashboard, 4 work reports, 6 automation rules, 4-dimension performance metrics, and end-to-end test verification.

#### 1. 8-Section Dashboard Implementation (`apps/api/src/modules/dashboard/service.js` & `apps/web/src/pages/dashboard/`)
* **Section 1: Month Plan Status:** Plan progress, planned vs completed pieces, publishing rate.
* **Section 2: KPI Strip:** Planned, Completed, In Progress, At Risk (due in 72h not in review), Blocked, Pending Approval, Overdue.
* **Section 3: Today's Priorities:** Urgent deliverables due today or overdue.
* **Section 4: Production Stats & Trend:** Output by content type and weekly trend.
* **Section 5: Team Workload:** Member capacity bars ($<65\%$ healthy, $65\%-85\%$ high, $>85\%$ overloaded).
* **Section 6: Issues & Blockers:** Active blockers with dependency owners and unclassified revision flags.
* **Section 7: Waiting for Approval:** Deliverables awaiting Creative Head review.
* **Section 8: Recent Activity:** Audit stream of transitions, approvals, handoffs, assignments.

#### 2. Report Definitions Consolidation (`apps/api/src/modules/reports/`)
* Remove: Lead Funnel & CPL Report, Campaign Deep-Dive Report.
* Retain & Update:
  1. **Weekly Work Report** (Mon 08:00 IST)
  2. **Monthly Performance Scorecard** (Last day 23:59 IST, targets removed)
  3. **Creative Production Report** (Fri 18:00 IST)
  4. **Team Performance Digest** (1st of month 09:00 IST)

#### 3. Automation Rules Consolidation (`apps/api/src/modules/automation/`)
* Remove: `lsq_live_sync`.
* Retain & Update:
  1. `month_end_report`
  2. `overdue_escalation` (Owner immediate, SM Manager after 4h)
  3. `todo_escalation` (No status change for 3 days)
  4. `blocker_dependency_alert` (Instant ping to dependency owner)
  5. `revision_pattern_flag` (Auto-flag on 4 revisions or average $+1$)
  6. `weekly_report`

#### 4. Four Performance Dimensions (`apps/api/src/modules/people/metrics.js`)
* Calculate: Output, Efficiency, Quality, Collaboration.
* Remove: Business Impact dimension.
* Add turnaround days calculation: $\text{Published Date} - \text{First Stage Start Date}$.

#### 5. Comprehensive Test Suite
* Create `apps/api/test/phase_r_e2e.test.js`:
  * Tests entire 8-step lifecycle from Plan Creation $\rightarrow$ Submission $\rightarrow$ Creative Head Verification $\rightarrow$ Stage WorkItem Generation $\rightarrow$ Auto-Assignment $\rightarrow$ Contributor Execution $\rightarrow$ Review Feedback $\rightarrow$ Publishing $\rightarrow$ Turnaround $\rightarrow$ Dashboard $\rightarrow$ Reports.
* Role-based route-table walk testing all 5 roles across all active API endpoints.

---

## 4. Risk Assessment & Mitigation Strategy

| # | Risk Description | Severity | Mitigation Strategy |
|---|---|---|---|
| **R-1** | **Orphaned Work Items:** Deleting campaigns could break work item queries that filter on `campaignId`. | **High** | In Phase R1, execute an atomic `$unset` on `WorkItem` to safely remove `campaignId`, `relatedOKR`, and `relatedTarget`. WorkItems will filter by `calendarPlanId` or `contentPieceId`. All historical work items remain intact. |
| **R-2** | **Test Suite Breakage:** Deleting campaigns, targets, and leads will immediately cause `test/leads_and_datacenter.test.js` and `test/targets_and_campaigns.test.js` to fail. | **High** | In Phase R1, decommission the retired test files and update shared test fixtures to remove `campaignId` from work item creation mocks. Target baseline: 14 test files passing cleanly. |
| **R-3** | **Data Loss During Purge:** Accidental deletion of work items during collection drop. | **Critical** | Database backup already verified via `mongodump` in `backup-before-scope-reset/`. Export collections to JSON files before dropping. Only drop `campaigns`, `monthlytargets`, `leads`, `dataissues`, `syncruns`. Never drop `workitems`, `users`, or `feedbackentries`. |
| **R-4** | **Executive Write Leakage:** A new endpoint in R3 or R4 omitting the executive mutation guard. | **High** | Centralize the executive read-only check in `requirePermission` or authorization middleware to reject any non-GET/HEAD request from an executive caller with HTTP 403 Forbidden. Validate with an automated route-table walk test. |
| **R-5** | **Deadlock in Sequential Stages:** A stage remaining locked if an approval fails to set `unlockedAt`. | **Medium** | Centralize stage handoffs in `transition.service.js`. Every approved review stage and completed non-review stage explicitly invokes `unlockNextStage(contentPieceId, currentStageOrder)`. Add fallback admin/creative head manual unlock override. |

---

## 5. Rollback & Recovery Plan

1. **Code Rollback:**
   * Pre-scope-reset commit: `91fa3de` ("before scope reset").
   * Pre-scope-reset git tag: `pre-scope-reset`.
   * Fast rollback command: `git checkout pre-scope-reset`.
2. **Database Rollback:**
   * Pre-scope-reset MongoDB backup directory: `C:\Users\ADMIN\OneDrive\Desktop\HACA\TECH\backup-before-scope-reset\marketing_portal`.
   * Fast restore command:
     ```powershell
     & "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" --uri "mongodb://127.0.0.1:27017/marketing_portal" --drop "C:\Users\ADMIN\OneDrive\Desktop\HACA\TECH\backup-before-scope-reset\marketing_portal"
     ```

---

## 6. Implementation Readiness Summary

* **Source of Truth Document:** [docs/SCOPE_RESET.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/docs/SCOPE_RESET.md) (Created & Verified)
* **Rules Files:** All 6 `.agent/rules/` files updated, aligned with the 5 roles, and verified under 8,000 characters each.
* **Project Specifications:** `PROJECT_REPORT.md`, `CONTENT_FLOW.md`, `BUILD_PLAN.md`, `OPEN_QUESTIONS.md`, and `ROLE_FIX_PLAN.md` updated and synchronized across both directories.
* **Code Modification Status:** **ZERO CODE CHANGES COMMITTED.** All changes are documentation and architectural analysis only.
* **Ready for Approval:** Awaiting explicit USER approval to begin Phase R1 execution.
