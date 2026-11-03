# Team Directory and Worker Profile — Specification

**Document Version:** 1.0.0  
**Status:** SPECIFICATION READY FOR APPROVAL (PART A)  
**Applicable Roles:** `admin`, `creative_head`, `sm_manager`, `executive`, `team_member`  
**Governing Documents:** `docs/WORKFLOW.md`, `docs/WORKSPACES.md`, `docs/PROFILE_SETTINGS.md`, `docs/METRICS.md`, `docs/UI_STANDARDS.md`, `docs/PROGRESS.md`

---

## 1. Investigation of Current State & Duplicates Audit

### 1.1 Existing Implementations & File Paths

| Functional Area | Current File Paths | Current Capabilities |
| :--- | :--- | :--- |
| **Per-Person Work View** | `apps/web/src/components/PersonWorkHistoryView.tsx`<br>`apps/web/src/components/PersonWorkHistoryDrawer.tsx`<br>`apps/web/src/pages/team/PersonWorkPage.tsx`<br>`apps/api/src/modules/people/routes.js` (`GET /people/:id/work-history`)<br>`apps/api/src/modules/people/service.js` (`getPersonWorkHistory`) | Displays active "Now" items, upcoming "Next" items, and completed "Done" items with individual timing metrics (work time, approval wait, late-by, round history). Used in drawer on Team Load and Content Flow Tracker. |
| **Team Load Page** | `apps/web/src/pages/workload/TeamWorkloadPage.tsx`<br>`apps/api/src/modules/assignment/service.js` (`getTeamWorkload`)<br>`apps/api/src/server.js` (`GET /api/workload`) | Displays team workload rollups grouped by department, capacity utilization percentages, capacity bands (`Healthy`, `High`, `Overloaded`), and member cards. |
| **People Directory & Cards** | `apps/web/src/pages/admin/UsersPage.tsx` (`/people`, `/admin/users`)<br>`apps/web/src/components/ProfileDrawer.tsx`<br>`apps/api/src/modules/people/routes.js` (`GET /people`, `POST /people`, etc.) | Admin-focused user table and card grid with status toggles, user creation, password reset, and role modifications. |
| **Profile Page** | `apps/web/src/pages/ProfilePage.tsx` (`/profile`)<br>`apps/web/src/components/ProfileView.tsx`<br>`apps/api/src/modules/profile/routes.js` | User's own profile page displaying avatar, contact info, personal details, skills, languages, role panel, and ratings section. |
| **Ratings Summary** | `apps/web/src/components/RatingsFeedbackSection.tsx`<br>`apps/api/src/modules/submissions/service.js` (`getWorkerRatingsSummary`)<br>`apps/api/src/modules/submissions/routes.js` (`GET /ratings/summary/:personId`) | Calculates average star ratings and displays distribution bars and feedback comments for delivered work. |
| **Activity Events** | `apps/api/src/modules/activity/model.js` (`ActivityEvent`)<br>`apps/api/src/modules/activity/service.js` (`recordActivity`, `getActorActivity`) | Records domain events across entities (`person`, `calendar_plan`, `work_item`, `submission`). |
| **Metrics Helpers & Docs** | `packages/shared/src/index.ts` (`formatDuration`, `calculateIndividualWorkMeasures`)<br>`docs/METRICS.md` | Standard duration formatting (`1d 4h`, `3h 20m`), net work time deduction of paused intervals, waiting to start, and late-by calculations. |
| **Chart Components** | Installed: `recharts`<br>Used in: `apps/web/src/pages/dashboard/TeamDashboardPage.tsx`, `RatingsFeedbackSection.tsx` | Responsive bar charts, area charts, line charts for metrics trends. |

### 1.2 Duplicate Flags & Consolidation Plan

1. **Fragmented People Views:**
   - `apps/web/src/pages/admin/UsersPage.tsx` (admin user grid) and `apps/web/src/pages/workload/TeamWorkloadPage.tsx` (workload member cards) present duplicate user summary cards with differing fields and styles.
   - **Resolution:** Consolidate into the unified **Team Directory (`/team`)** as the primary entry in the main navigation for `admin`, `creative_head`, `sm_manager`, and `executive`. `/people` and `/admin/users` redirect to `/team`.
2. **Duplicate Work History & Profile Views:**
   - `PersonWorkHistoryView.tsx` (`/team/members/:id/work`) and `ProfileView.tsx` (`/profile`) present disconnected slices of member information.
   - **Resolution:** Consolidate into a single polymorphic **Worker Profile component (`/team/:id` and `/profile`)**. The same component displays a worker's full management profile to leadership, and their own data to themselves at `/profile`.
3. **Drawer Duplications:**
   - `PersonWorkHistoryDrawer.tsx` and `ProfileDrawer.tsx` duplicate side-over panels.
   - **Resolution:** Retire `PersonWorkHistoryDrawer.tsx` and `ProfileDrawer.tsx` in favor of navigating directly to the comprehensive `/team/:id` worker profile view (or opening the standard profile modal).

---

## 2. Team Directory Specification (`/team`)

### 2.1 Navigation & Permissions
- **Menu Entry:** Added to Main Navigation under `Organization -> Team Directory` (route `/team`) for `admin`, `creative_head`, `sm_manager`, and `executive`.
- **Permission Key:** `team.profile.view`.
- **Access Rule:** `team_member` visiting `/team` is blocked (redirected or HTTP 403).

### 2.2 Directory Grid & Filters
- **Member Row / Card Data:**
  - Avatar with status badge
  - Name (preferred name first, e.g., "Alex (Alexander Smith)")
  - Role badge (e.g. `Team Member`, `Creative Head`, `SM Manager`, `Executive`, `Admin`)
  - Job Role (e.g. `Writer`, `Graphic Designer`, `Video Editor`)
  - Department (e.g. `SEO & Content`, `Design`, `Video Production`)
  - Status indicator (`Active` / `Suspended`)
  - Load Percentage and Capacity Band (`Healthy` < 65%, `High` 65–85%, `Overloaded` > 85%)
  - 'Now' Indicator: Current active deliverable step and content title (e.g. `Content: Diwali Campaign Reel`)
  - Operational Counts: `In Progress`, `Waiting for Approval`, `Late`
- **Filters Bar:**
  - Role dropdown (`All`, `team_member`, `creative_head`, `sm_manager`, `executive`, `admin`)
  - Department dropdown (`All`, `Design`, `Video Production`, `SEO & Content`, `Social Media`, etc.)
  - Status toggle (`Active`, `Suspended`, `All`)
  - Load Band filter (`All`, `Healthy`, `High`, `Overloaded`)
  - Toggle: `Has Late Work Only`
  - Search input: Matches name, email, job role, and skills
- **Sorting Whitelist (Strict Anti-Ranking Compliance):**
  - Allowed sort fields: `name`, `department`, `jobRole`, `load`
  - **Forbidden:** No column, badge, or sort parameter allows sorting or ranking by turnaround speed, ratings, or performance scores.

### 2.3 Wireframes for Team Directory (`/team`)

#### Desktop Wireframe (>= 1024px)
```text
+--------------------------------------------------------------------------------------------------------------------+
| HACA Marketing OS  |  Creative Calendar   Work   Operations v   Organization v   [Search...]   (Bell)  (Avatar v)      |
+--------------------------------------------------------------------------------------------------------------------+
| Team Directory                                                                                    [+ Add Member]   |
| View and manage team members, assignments, capacity, and individual performance profiles                           |
|                                                                                                                    |
| [Search name, role...] [Role: All v] [Dept: All v] [Status: Active v] [Band: All v] [ ] Has Late  Sort: [Name v]   |
|--------------------------------------------------------------------------------------------------------------------|
| MEMBER               ROLE & DEPT             STATUS     LOAD & BAND      NOW (CURRENT STEP)         IN PROG  WAIT  LATE|
|--------------------------------------------------------------------------------------------------------------------|
| (AV) Test Writer One  Team Member             Active     45% [Healthy]   Content: Diwali Reel #1        2      1     0 |
|      Writer          SEO & Content                                       Due: Nov 5, 2026                          |
|--------------------------------------------------------------------------------------------------------------------|
| (AV) Test Designer    Team Member             Active     78% [High]      Design: Black Friday Carousel  3      2     1 |
|      Graphic Designer Design                                             Due: Nov 4, 2026 (Late 1d)                |
|--------------------------------------------------------------------------------------------------------------------|
| (AV) Test Video Ed    Team Member             Active     92% [Overloaded] Edit: Product Teaser #2       4      0     0 |
|      Video Editor    Video Production                                    Due: Nov 7, 2026                          |
+--------------------------------------------------------------------------------------------------------------------+
```

#### Mobile Wireframe (360px)
```text
+---------------------------------------+
| [=] HACA OS                     (AV)  |
+---------------------------------------+
| Team Directory                        |
| 13 members                            |
|                                       |
| [ Search members...                 ] |
| [ Filter: Role v ] [ Dept v ]         |
| [ Band: All v ]    [ ] Late only      |
| Sort: [ Name v ]                      |
|---------------------------------------|
| (AV) Test Writer One                  |
| Writer * SEO & Content                |
| Status: Active                        |
| Load: 45% [Healthy]                   |
| Now: Content - Diwali Reel #1         |
| Due: Nov 5, 2026                      |
| In Prog: 2 | Wait: 1 | Late: 0        |
| [ View Profile -> ]                   |
|---------------------------------------|
| (AV) Test Designer                    |
| Graphic Designer * Design             |
| Status: Active                        |
| Load: 78% [High]                      |
| Now: Design - Black Friday            |
| Due: Nov 4, 2026 (Late 1d)            |
| In Prog: 3 | Wait: 2 | Late: 1        |
| [ View Profile -> ]                   |
+---------------------------------------+
```

---

## 3. Worker Profile Specification (`/team/:id` and `/profile`)

### 3.1 Dual-Mount Route Architecture
- **Management View (`/team/:id`):** Mounted for `admin`, `creative_head`, `sm_manager`, and `executive` to inspect, manage, and reassign work for any team member.
- **Worker Self-View (`/profile`):** The exact same component renders for the logged-in user viewing their own profile.
- **Worker Isolation Rule:** A `team_member` attempting to access `/team/:id` where `:id !== loggedInUserId` receives **HTTP 404 Not Found** (strictly 404, not 403, preventing account existence enumeration).

### 3.2 Transparency Notice (Self-View)
When viewed by a worker at `/profile` (or when `isSelf === true` for a team member), a prominent glassmorphic transparency banner is displayed immediately under the header:
> *"Your work history, timings and ratings are visible to the Admin, Creative Head, SM Manager and Executive."*

### 3.3 Profile Header
- **Avatar:** Large circular avatar with initials fallback and active status badge. (When viewing own profile, includes photo upload / crop button).
- **Identity:** Full Name, Preferred Name in parenthesis if set (`Test Writer One (Alex)`).
- **Role & Org Badges:** Role pill (`Team Member`), Job Role (`Writer`), Department (`SEO & Content`), Status pill (`Active` / `Suspended`).
- **Tenure & Access:** Member since (`createdAt` formatted as `MMM YYYY`), Last sign-in (`lastLoginAt` formatted as `DD/MM/YYYY hh:mm a` or `Never`).
- **Contact Details (Strictly Hidden for `executive`):**
  - Phone: `+91 9000000011`
  - WhatsApp: Direct link button to `https://wa.me/...`
  - Email: `writer1@demo.haca.local`
- **Languages & Skills:** Interactive badge chips for spoken languages and creative skills.
- **Work Preferences:** Stage chips (`Content`, `Script`, `Design`, `Shoot`, `Edit`, `Post`).
- **Weekly Capacity:** Number pill (`40h / week`).

### 3.4 KPI Summary Strip
Mounted beneath the header across all tabs:
1. **Load & Capacity Band:** e.g. `65% [High]` (or `Healthy` / `Overloaded`).
2. **In Progress:** Count of currently active steps (`status === 'In Progress'`).
3. **Waiting for Approval:** Count of steps submitted to Creative Head (`status === 'Feedback'`).
4. **Late:** Count of active deliverables past due date.
5. **On-Time Rate:** Percentage of completed steps delivered on or before due date (`92%`).
6. **Average Rating:** Star rating and numerical average (e.g. `★ 4.8 / 5.0`).
   - **3-Rating Threshold:** Displayed **ONLY** if the user has $\ge 3$ ratings. If fewer than 3 ratings exist, renders `"No ratings yet (min. 3 required)"` or dash (`—`).

### 3.5 Global Date Range Filter
Applies dynamically across the **Work**, **Performance**, **Ratings**, and **Activity** tabs:
- Preset options: `Last 7 Days`, `Last 30 Days` (default), `Last 90 Days`, `This Month`, `Last Month`, `Custom Range` (date picker).

---

## 4. Tab Specifications

### Tab 1: Overview
1. **Right Now:**
   - Active deliverables in progress, feedback, pending, or blocked.
   - Shows content title, step type, step due date, and individual work time elapsed since start.
2. **Next Up:**
   - Queued and upcoming steps (locked or not yet started) with scheduled due dates.
3. **8-Week Load History & Capacity Gauge:**
   - Visual radial load gauge for current week utilization.
   - 8-Week load trend chart (`recharts` Line/Bar) showing weekly capacity utilization over time.
4. **Work Breakdown:**
   - Horizontal bar distribution showing work items categorized by step type (`Content`, `Script`, `Design`, `Shoot`, `Edit`, `Post`) and by calendar (`sm`, `sales`, `ads`, `academics_management`, `other`).
5. **Skills & Work Preferences:**
   - Complete tag list of creative skills and stage preferences.

### Tab 2: Work
- **Filter Controls:**
  - Status filter (`All`, `In Progress`, `Feedback`, `Pending`, `Blocked`, `Approved`, `Published`)
  - Step Type filter (`All`, `Script`, `Content`, `Shoot`, `Edit`, `Design`, `Post`)
  - Calendar filter (`All`, `sm`, `sales`, `ads`, `academics_management`, `other`)
  - Date Range filter
- **Paginated Step Table / Cards:**
  - Content Title with link to deliverable piece
  - Step Type badge
  - Calendar tag with specific calendar color
  - Status pill
  - Due Date (local date format)
  - Work Time (net active craft time)
  - Approval Wait time
  - Late-by duration (e.g. `Late by 2d` or `On time`)
  - Revisions count
- **Expandable Step Timeline:**
  - Clicking any work item row expands the comprehensive step audit timeline:
    - `assignedAt`, `unlockedAt`, `startedAt`, `submittedAt`, `decisionAt`, `approvedAt`, `postedAt`.
    - Revision rounds ($r=1, 2, \dots$) with per-round start, submission, and decision timestamps.
    - Paused interval logs (`Blocked` / `Pending`) showing start, end, duration, blocker reason, and note.

### Tab 3: Performance (Individual Craftsmanship Only — Strictly No Cross-Person Ranking)
- **Primary Metric Cards:**
  - **On-Time Delivery Rate:** Percentage of completed steps delivered on or before due date.
  - **Average Days Late:** Average calendar days past due date for overdue deliverables.
  - **First-Pass Approval Rate:** Percentage of deliverables approved in Round 1 without changes requested.
  - **Revision Rate:** Average revision cycles per deliverable step.
  - **Average Work Time per Step Type:** Broken down by `Script`, `Content`, `Design`, `Shoot`, `Edit` (measured strictly from worker's `startedAt`, deducting paused intervals).
  - **Average Waiting to Start:** Mean duration between `unlockedAt` and worker `startedAt`.
  - **Average Approval Wait:** Mean duration between worker submission and review decision.
  - **Blockers Raised:** Total blocker count and average blocker duration.
  - **Revision Flags:** Summary of flagged revisions categorized by root cause.
- **Monthly Output Trend Chart:**
  - Bar/Line visualization of deliverables completed per month over the trailing 6 months.
- **Previous Period Comparison Deltas:**
  - Visual delta pill comparing selected period vs preceding period (e.g., `On-time: 92% (+4% vs previous 30d)`).
- **Anti-Ranking Guarantee:**
  - Strictly **no leaderboards, peer rankings, percentile comparisons, or speed badges**.

### Tab 4: Ratings
- **Summary Header:**
  - Overall average star rating (1–5) and total rating count.
  - Enforces minimum 3-rating visibility rule: if count $< 3$, shows `"Fewer than 3 ratings received"`.
- **Rating Distribution:**
  - Star distribution bars (5★, 4★, 3★, 2★, 1★).
- **Recent Feedback Cards:**
  - Star score, content piece title, step type, reviewer name (Creative Head), review date, and constructive feedback note.

### Tab 5: Activity
- Audit feed of the member's operational events over time:
  - Step assignments received
  - Work started (`Not Started` -> `In Progress`)
  - Submissions to review
  - Revision decisions received
  - Status updates and blocker flags raised / resolved
  - Comments posted on deliverable steps
- **Privacy Enforcement:** **Zero chat messages, chat statistics, or private channel activities** are included in the activity feed.

### Tab 6: Changes (Audit Log)
- **Role Access:** Visible **ONLY** to `admin` and `creative_head`. (Hidden for `sm_manager`, `executive`, and `team_member`).
- **Audit Scope:** Records historical modifications to operational fields:
  - `Job Role`
  - `Department`
  - `Work Preferences`
  - `Weekly Capacity Hours`
- **Table Columns:**
  - Timestamp (Date and Time)
  - Changed By (Admin / Creative Head name)
  - Attribute Modified (e.g. `Weekly Capacity`)
  - Old Value (e.g. `30h / week`)
  - New Value (e.g. `40h / week`)
  - Reason / Note

---

## 5. Reduced Profiles & Role Actions Matrix

### 5.1 Reduced Profiles for Non-Worker Roles
When viewing profiles of users who are not individual creative workers (`sm_manager`, `creative_head`, `admin`, `executive`):
- **`sm_manager` & `creative_head` Profile:**
  - **Tabs Shown:** `Overview`, `Activity`, and **Role-Specific Operational Summary**.
  - Operational Summary for Creative Head: Pending review queue count, review turnaround time, approval counts.
  - Operational Summary for SM Manager: Active plans managed, upcoming publications, calendar assignments.
  - `Work`, `Performance`, and `Ratings` tabs are omitted.
- **`admin` & `executive` Profile:**
  - **Tabs Shown:** `Overview` only (System administration / corporate governance profile).
  - Operational tabs (`Work`, `Performance`, `Ratings`, `Changes`) are omitted.

### 5.2 Role Actions Matrix

| Action | Admin | Creative Head | SM Manager | Executive | Team Member (Self) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Profile & Directory** | Yes | Yes | Yes | Yes (No Contact) | Self Only |
| **Reassign Active Steps** | Yes | Yes | Yes | No | No |
| **Edit Operational Details** (Job role, dept, preferences, capacity) | Yes | Yes | No | No | Request Only |
| **Edit Contact & About** (Phone, WhatsApp, languages, skills, photo) | Yes | No | No | No | Yes (Self) |
| **View Changes Audit Log** | Yes | Yes | No | No | No |
| **Suspend / Reactivate User** | Yes | No | No | No | No |
| **Reset Password Link** | Yes | No | No | No | No |
| **Force Logout (Revoke Sessions)**| Yes | No | No | No | No |

---

## 6. Mathematical Metric Definitions

### 6.1 Weekly Load & 8-Week Load History
For any given calendar week $W$:
$$\text{Load}_W = \frac{\sum_{i \in \text{AssignedSteps}_W} \text{DefaultHours}(i)}{\text{WeeklyCapacityHours}} \times 100\%$$
- $\text{AssignedSteps}_W$: Deliverable steps assigned to the member that were active and not yet submitted during week $W$.
- $\text{DefaultHours}(i)$: Default stage hours (standard 4.0 hours, or step `estimatedEffortHrs`).
- Capacity Bands:
  - **Healthy:** $\text{Load} < 65\%$
  - **High:** $65\% \le \text{Load} \le 85\%$
  - **Overloaded:** $\text{Load} > 85\%$

### 6.2 Waiting to Start
$$\text{WaitingToStart} = \text{startedAt} - \text{unlockedAt}$$
Measures the duration from when upstream stages completed to when the worker clicked Start.

### 6.3 Net Work Time (Craft Time)
For each revision round $r \in [1, N]$:
$$\text{RoundWorkTime}_r = (\text{roundSubmittedAt}_r - \text{roundStart}_r) - \sum_{k \in \text{Intervals}_{r, \text{paused}}} (\text{intervalEnd}_k - \text{intervalStart}_k)$$
$$\text{TotalNetWorkTime} = \sum_{r=1}^{N} \text{RoundWorkTime}_r$$
Paused intervals include all time spent in `Blocked` and `Pending`.

### 6.4 Approval Wait
$$\text{ApprovalWait} = \text{decisionAt} - \text{submittedAt}$$

### 6.5 Late By
$$\text{LateDays} = \max(0, \text{calendarDate}(\text{submittedAt}) - \text{calendarDate}(\text{dueDate}))$$

### 6.6 On-Time Delivery Rate
$$\text{OnTimeRate} = \frac{\text{CompletedSteps with } \text{LateDays} = 0}{\text{TotalCompletedSteps}} \times 100\%$$

### 6.7 First-Pass Approval Rate
$$\text{FirstPassApprovalRate} = \frac{\text{CompletedSteps with } \text{Rounds} = 1}{\text{TotalCompletedSteps}} \times 100\%$$

---

## 7. Wireframes for Worker Profile (`/team/:id`)

### 7.1 Desktop Wireframe (>= 1024px)
```text
+--------------------------------------------------------------------------------------------------------------------+
| HACA Marketing OS  |  Creative Calendar   Work   Operations v   Organization v   [Search...]   (Bell)  (Avatar v)      |
+--------------------------------------------------------------------------------------------------------------------+
| [<- Back to Team Directory]                                                     [Reassign Steps] [Edit Details v]  |
|                                                                                                                    |
| (AVATAR)  Test Writer One (Alex)                       [Active]                 Member since: Nov 2026             |
|           Role: Team Member  |  Job: Writer  |  Dept: SEO & Content             Last sign-in: Today, 10:15 AM       |
|           Email: writer1@demo.haca.local  |  Phone: +91 9000000011  [WhatsApp]  Weekly Capacity: 40h / week        |
|           Languages: English, Hindi  |  Skills: Copywriting, SEO, Scriptwriting                                    |
|           Preferences: [Content] [Script]                                                                          |
|                                                                                                                    |
| +----------------------------------------------------------------------------------------------------------------+ |
| | LOAD & BAND        IN PROGRESS     WAITING APPROVAL    LATE DELIVERABLES   ON-TIME RATE        AVERAGE RATING   | |
| | 45% [Healthy]      2 steps         1 step              0 steps             94%                 ★ 4.8 / 5.0 (12) | |
| +----------------------------------------------------------------------------------------------------------------+ |
|                                                                                                                    |
| Date Range: [ Last 30 Days v ]                                                                                     |
| [ Overview ]  [ Work (14) ]  [ Performance ]  [ Ratings (12) ]  [ Activity ]  [ Changes Audit Log ]                |
|--------------------------------------------------------------------------------------------------------------------|
| OVERVIEW TAB                                                                                                       |
| +------------------------------------------------------+  +------------------------------------------------------+ |
| | RIGHT NOW (2 active)                                 |  | 8-WEEK LOAD HISTORY & CAPACITY                       | |
| | - Content: Diwali Campaign Reel                      |  | [Gauge: 45%] Utilization                             | |
| |   Due: Nov 5, 2026 | Working for 2h 15m              |  | [ Line Chart: W36 40% -> W40 65% -> W44 45% ]        | |
| | - Script: Black Friday Launch Teaser                 |  |                                                      | |
| |   Due: Nov 6, 2026 | In Review (Wait: 45m)           |  |                                                      | |
| +------------------------------------------------------+  +------------------------------------------------------+ |
| | NEXT UP (3 queued)                                   |  | WORK BREAKDOWN BY TYPE & CALENDAR                    | |
| | - Content: Winter Academics Showcase (Due Nov 10)    |  | Content: 8 | Script: 6                               | |
| | - Script: Founder Story Reel (Due Nov 12)            |  | SM: 9 | Sales: 3 | Academics: 2                       | |
| +------------------------------------------------------+  +------------------------------------------------------+ |
+--------------------------------------------------------------------------------------------------------------------+
```

### 7.2 Mobile Wireframe (360px)
```text
+---------------------------------------+
| [< Back]  Team Member Profile   (AV)  |
+---------------------------------------+
| (AVATAR)                              |
| Test Writer One (Alex)                |
| Team Member * Writer                  |
| Dept: SEO & Content                   |
| Status: [Active]                      |
|                                       |
| Capacity: 40h/week                    |
| Since: Nov 2026                       |
| Phone: +91 9000000011 [WhatsApp]      |
| Email: writer1@demo.haca.local        |
|                                       |
| Preferences: [Content] [Script]       |
|                                       |
| +-----------------------------------+ |
| | Load: 45% [Healthy]               | |
| | In Progress: 2 | Waiting: 1       | |
| | Late: 0        | On-time: 94%     | |
| | Rating: ★ 4.8 / 5.0 (12)          | |
| +-----------------------------------+ |
|                                       |
| Range: [ Last 30 Days v ]             |
| [ Overview v ] (Tab selector)         |
|                                       |
| RIGHT NOW                             |
| * Content: Diwali Reel                |
|   Due: Nov 5, 2026                    |
|   Working: 2h 15m                     |
| * Script: Black Friday                |
|   Due: Nov 6, 2026 (Feedback)         |
|                                       |
| 8-WEEK LOAD TREND                     |
| [ Chart: 45% Avg ]                    |
|                                       |
| [ Actions: Reassign ] [ Edit ]        |
+---------------------------------------+
```

---

## 8. API Contracts & Zod Schemas

### 8.1 Permission Configuration
- Added permission key: `team.profile.view`.
- Assigned to: `admin`, `creative_head`, `sm_manager`, `executive`.

### 8.2 Endpoints Specification

#### 1. `GET /api/team`
- **Description:** Returns the filtered, paginated list of team members for the directory.
- **Access:** `admin`, `creative_head`, `sm_manager`, `executive`.
- **Query Parameters:**
  - `role`: Optional string enum filter.
  - `departmentId`: Optional ObjectId filter.
  - `status`: Optional enum filter (`active`, `suspended`, `all`). Default `active`.
  - `loadBand`: Optional enum filter (`Healthy`, `High`, `Overloaded`).
  - `hasLate`: Optional boolean string (`true` / `false`).
  - `search`: Optional string search query.
  - `sortBy`: Whitelist enum (`name`, `department`, `jobRole`, `load`). Default `name`.
  - `sortDir`: Enum (`asc`, `desc`). Default `asc`.
  - `page`: Integer $\ge 1$. Default `1`.
  - `limit`: Integer $\ge 1 \le 100$. Default `20`.
- **Response Format:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "6724fa...",
        "name": "Test Writer One",
        "preferredName": "Alex",
        "avatarUrl": null,
        "role": "team_member",
        "jobRole": "Writer",
        "department": { "_id": "...", "name": "SEO & Content" },
        "status": "active",
        "weeklyCapacityHours": 40,
        "loadPct": 45,
        "capacityBand": "Healthy",
        "currentStep": {
          "workItemId": "...",
          "title": "Diwali Campaign Reel",
          "stageKey": "Content",
          "dueDate": "2026-11-05T00:00:00.000Z"
        },
        "counts": {
          "inProgress": 2,
          "waitingApproval": 1,
          "late": 0
        }
      }
    ],
    "pagination": { "total": 13, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

#### 2. `GET /api/team/:id`
- **Description:** Returns base profile header, identity, skills, preferences, and KPI strip.
- **Executive Privacy Rule:** If `req.user.role === 'executive'`, `email`, `phone`, and `whatsappNumber` fields are returned as `null`.
- **Worker Isolation Rule:** If `req.user.role === 'team_member'` and `req.user._id.toString() !== req.params.id`, returns **HTTP 404**.

#### 3. `GET /api/team/:id/overview`
- **Description:** Returns Right Now items, Next Up items, 8-week load history array, and work distribution.
- **Load History Item:** `{ weekNumber: 44, year: 2026, startDate: "2026-10-26", allocatedHours: 18, capacityHours: 40, loadPct: 45, band: "Healthy" }`.

#### 4. `GET /api/team/:id/work`
- **Description:** Paginated step items assigned to the person with timeline traces, filterable by `status`, `stageKey`, `calendar`, `startDate`, `endDate`.

#### 5. `GET /api/team/:id/performance`
- **Description:** Returns on-time rate, average days late, first-pass approval rate, revision rate, average work time by step type, waiting to start, approval wait, blocker duration, monthly output trend, and previous period comparisons.

#### 6. `GET /api/team/:id/ratings`
- **Description:** Feedback rating summary, star breakdown, and individual review comments.
- **Privacy Rule:** If ratings count $< 3$, `averageRating` is returned as `null`.

#### 7. `GET /api/team/:id/activity`
- **Description:** Person's domain activity events (assignments, starts, submissions, decisions, step comments). Excludes all chat content.

#### 8. `GET /api/team/:id/changes`
- **Description:** Audit log of modifications to `jobRole`, `departmentId`, `workPreferences`, and `weeklyCapacityHours`.
- **Access Rule:** Accessible **ONLY** to `admin` and `creative_head`. Others receive HTTP 403.

#### 9. Mutation Endpoints
- `PATCH /api/team/:id`: Admin (all fields) / Creative Head (operational fields only: jobRole, departmentId, workPreferences, weeklyCapacityHours). Logs to changes audit.
- `POST /api/team/:id/reassign`: Reassign active steps (`admin`, `creative_head`, `sm_manager`).
- `POST /api/team/:id/status`: Suspend or reactivate user (`admin` only).
- `POST /api/team/:id/reset-password`: Send password reset link (`admin` only).
- `POST /api/team/:id/force-logout`: Revoke all active sessions (`admin` only).

---

## 9. Testing Strategy

### 9.1 Backend API Test Matrix (`test/team_profile_api.test.js`)
1. **Access Control & RBAC:**
   - Verify `admin`, `creative_head`, `sm_manager`, and `executive` can call `GET /api/team`.
   - Verify `team_member` calling `GET /api/team` is rejected with 403.
   - Verify `team_member` calling `GET /api/team/:otherId` receives **404 Not Found** (anti-harvesting).
   - Verify `team_member` calling `GET /api/team/:ownId` succeeds (200 OK).
2. **Executive Redaction:**
   - Verify `executive` receiving `GET /api/team/:id` has `email: null`, `phone: null`, `whatsappNumber: null`.
   - Verify `admin`, `creative_head`, and `sm_manager` receive full contact details.
3. **Sorting Whitelist & Anti-Ranking:**
   - Verify sorting succeeds on `name`, `department`, `jobRole`, `load`.
   - Verify requesting sorting by `rating`, `speed`, or `performance` is rejected or defaults to `name`.
4. **Load & 8-Week History:**
   - Verify load history calculates `(sum default hours) / capacity` per week.
5. **3-Rating Threshold:**
   - User with 1 or 2 ratings returns `averageRating: null`.
   - User with 3 or more ratings returns calculated `averageRating`.
6. **Changes Audit Logging:**
   - Update `jobRole` or `weeklyCapacityHours` via `PATCH /api/team/:id` and verify entry logged in changes table with `actorId`, `oldValue`, `newValue`.
   - Verify `sm_manager` and `executive` cannot access `GET /api/team/:id/changes` (403 Forbidden).

### 9.2 Frontend Component Test Matrix (`apps/web/src/pages/team/__tests__/TeamProfileSuite.test.tsx`)
1. **Team Directory Rendering & Filters:**
   - Renders 13 members with load percentages and bands.
   - Filters by role, department, load band, and late work.
2. **Worker Profile Tabs:**
   - Renders Header, KPI strip, and tabs (Overview, Work, Performance, Ratings, Activity, Changes).
   - Verifies transparency notice displays for `team_member` viewing `/profile`.
   - Verifies Changes tab is hidden for `sm_manager`, `executive`, and `team_member`.
   - Verifies Executive sees no contact details and no mutation action buttons.

---

## 10. List of Files to Change, Create & Retire

### Files to Create
- `docs/TEAM_PROFILE.md` (This specification document).
- `apps/api/src/modules/team/routes.js`: Directory and profile tab endpoints.
- `apps/api/src/modules/team/controller.js`: Request controllers and role filters.
- `apps/api/src/modules/team/service.js`: Directory query, 8-week load aggregator, performance metrics, changes audit logger.
- `apps/web/src/pages/team/TeamDirectoryPage.tsx`: Primary `/team` directory page.
- `apps/web/src/pages/team/WorkerProfilePage.tsx`: Unified `/team/:id` and `/profile` view.
- `apps/web/src/pages/team/components/WorkerProfileOverviewTab.tsx`
- `apps/web/src/pages/team/components/WorkerProfileWorkTab.tsx`
- `apps/web/src/pages/team/components/WorkerProfilePerformanceTab.tsx`
- `apps/web/src/pages/team/components/WorkerProfileRatingsTab.tsx`
- `apps/web/src/pages/team/components/WorkerProfileActivityTab.tsx`
- `apps/web/src/pages/team/components/WorkerProfileChangesTab.tsx`
- `apps/api/test/team_profile_api.test.js`: Comprehensive backend test suite.
- `apps/web/src/pages/team/__tests__/TeamProfileSuite.test.tsx`: Frontend unit & integration test suite.

### Files to Modify
- `packages/shared/src/index.ts`: Add `team.profile.view` permission key and Zod schemas for team directory filters.
- `apps/api/src/server.js`: Mount `/api/team` router.
- `apps/api/src/modules/people/model.js`: Add schema for audit change log records.
- `apps/web/src/App.tsx`: Add `/team` and `/team/:id` routes; route `/profile` to unified profile page; redirect `/people` to `/team`.
- `apps/web/src/components/Layout.tsx`: Add Team Directory to main menu for elevated roles.
- `docs/METRICS.md`: Document 8-week load trend calculation formula.
- `docs/PROGRESS.md`: Record precondition test counts and Phase TP progress.

### Files to Retire / Refactor
- `apps/web/src/pages/team/PersonWorkPage.tsx` (redirects to `/team/:id?tab=work`).
- `apps/web/src/components/PersonWorkHistoryDrawer.tsx` (replaces standalone drawer with standard profile navigation).
- `apps/web/src/components/ProfileDrawer.tsx` (retires redundant cards in favor of `/team/:id`).

