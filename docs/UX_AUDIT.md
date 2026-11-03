# HACA Marketing OS — UX Audit (Desktop 1366px & Mobile 360px)

**Document Type:** UX Audit & Friction Analysis  
**Evaluated Viewports:** Desktop (1366 × 768 px) and Mobile (360 × 780 px)  
**Evaluated Roles:** `admin`, `creative_head`, `sm_manager`, `executive`, `team_member`, plus Public/Unauthenticated.  
**Basis:** Static component tree, routing tables, user journeys, and live DOM layout analysis across `@mmp/web`.

---

## 1. Executive Summary

The HACA Marketing OS is an operationally comprehensive, data-dense platform designed to coordinate social marketing production, calendar planning, content pipelines, reviews, and workload balancing for HACA. While the foundational data model and permissions matrix are robust, the user interface currently exhibits severe usability frictions:

1. **Complex, Multi-Level Navigation:** Navigating between essential daily tasks requires navigating nested dropdown menus ("Schedule", "Operations", "Organization") on desktop and deep accordion taps (up to 4 taps) on mobile.
2. **Duplicate & Fragmented Surfaces:** Plan approvals exist in two separate tabs (`/calendar?tab=plans` and `/feedback?tab=plans`); worker tasks are split across `/my-work` and `/todo`.
3. **High Cognitive Load & Jargon:** The UI exposes internal jargon ("Work item", "Content piece", "Pipeline", "Feedback round", "Revision flag", "Allocation override") rather than plain operational language.
4. **Desktop-Biased Tables on Mobile:** Tabular interfaces overflow horizontally by 200–500px on 360px viewports, requiring horizontal panning, while buttons frequently fail touch target standards (<44px height).
5. **Chart-First Instead of Action-First:** Home screens greet users with complex charts, KPI strips, and velocity gauges before presenting "What needs you now".

---

## 2. Screen-by-Screen Audit Across All 5 Roles

---

### Role 1: Administrator (`admin`)

The System Administrator is responsible for user provisioning, access request approvals, platform configuration, organizational assignments, and unblocking cross-functional work.

#### 1. Home / Dashboard (`/dashboard`)
* **What the person is trying to do:** Get an instant operational overview, identify stuck or overdue deliverables, check system health, and navigate to urgent administrative bottlenecks.
* **Number of clicks & fields:**
  * Initial view: 0 clicks.
  * Navigating to an overdue item: 1 click (`Section 2: KPI Strip > Overdue`).
  * Creating a deliverable: 2 clicks (Header CTA `New Deliverable` -> opens `/work` modal with 9 fields).
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Jargon like "Publishing Velocity", "Band Counts", and "Deliverable Review Stages in Feedback" creates mental fatigue.
    * The screen displays 8 distinct stacked sections with multi-colored borders (purple, amber, rose, emerald, indigo) that compete for attention.
    * Priority tasks requiring admin action are buried below Section 1 (Plan Status) and Section 2 (7-column KPI strip).
  * **360px (Mobile):**
    * The 7-column KPI strip wraps into an awkward 2-column grid taking over 600px of vertical space before any content is reached.
    * The member utilization snapshot cards become extremely cramped; text truncates with ellipsis.
    * Floating background blur orbs (`blur-3xl`) cause occasional frame drops on mobile WebKit.

#### 2. Calendar & Month View (`/calendar?tab=month`)
* **What the person is trying to do:** View the high-level monthly calendar grid of scheduled marketing deliverables, filter by department or owner, and inspect scheduled release dates.
* **Number of clicks & fields:**
  * Changing months: 1 click per chevron.
  * Filtering: 4 separate dropdown filter selects (Profile, Department, Status, Owner) requiring 8 clicks to adjust.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * The top navigation bar has 3 segmented tabs (`Month`, `Plans & Approval`, `Content Flow Tracker`). Users have to scan horizontally across the page to understand the relationship between these views.
    * Brand profile pills and deliverable chips crowd small calendar date cells.
  * **360px (Mobile):**
    * The 7-day monthly calendar grid compresses into unreadable 45px-wide columns, with dates and deliverable titles overflowing horizontally off-screen.
    * Users must scroll horizontally and vertically simultaneously, making date inspection nearly impossible on mobile devices.

#### 3. Plans & Approval (`/calendar?tab=plans`)
* **What the person is trying to do:** Review submitted monthly and individual calendar plans, inspect row deliverables, review warnings, and approve or reject plans.
* **Number of clicks & fields:**
  * Reviewing a plan: 1 click to select plan in left sidebar, 2 clicks to open row details.
  * Approving a plan: 1 click on "Approve Entire Plan" or row-by-row clicks.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * The screen is split into a dense list of plans and a wide table of rows with 10+ columns.
    * Statuses are confusing: a plan can be "Approved with pending rows" while individual rows have separate statuses ("draft", "submitted", "approved", "changes_requested").
    * Secondary actions like Excel export, CSV template download, and manual row creation are scattered across different corners of the table toolbar.
  * **360px (Mobile):**
    * The 2-column master-detail layout collapses into a vertically stacked view, but the row table remains a horizontal scroll container.
    * Action buttons (Approve, Request Changes) shrink to 28px height, causing accidental clicks on the wrong row.

#### 4. Content Flow Tracker (`/calendar?tab=tracker`)
* **What the person is trying to do:** Track stage progression (Script, Shoot, Edit, Post) across all active deliverables, check who currently holds each step, and identify overdue or blocked stages.
* **Number of clicks & fields:**
  * Inspecting a deliverable stage: 1 click to expand row, 1 click to open assignment recommendation modal.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * The table tries to display raw stage text columns alongside derived statuses ("hasNeedsOwner", "hasWaitingApproval").
    * The term "Pipeline" is used interchangeably with "Workflow" and "Steps".
    * Hovering over stage status badges triggers complex floating tooltips that often block adjacent stage badges.
  * **360px (Mobile):**
    * Severe horizontal overflow: table width exceeds 1100px on a 360px viewport.
    * Stage progression dots require microscopic finger accuracy (14px diameter) with zero touch-target padding.

#### 5. Approvals / Feedback Queue (`/feedback`)
* **What the person is trying to do:** Act as emergency sign-off authority for creative deliverables, review feedback threads, and inspect revision flags.
* **Number of clicks & fields:**
  * Reviewing a deliverable: 1 click to select thread, 1 click to view deliverable link, 1 field to input feedback note, 1 click to submit.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Duplicate functionality: has a "Plans Approval" tab embedded inside `/feedback?tab=plans`, duplicating `/calendar?tab=plans`.
    * Terminology confusion: "Feedback" implies an optional conversation, but it actually represents a mandatory sign-off checkpoint ("Waiting for approval").
    * Revision root causes ("Brief ambiguity", "Brand guideline deviation", "Script rewrite") feel like bureaucratic post-mortems rather than actionable reviews.
  * **360px (Mobile):**
    * Comment threads push action buttons below the fold; reviewers must scroll past extensive history before finding the "Approve" button.

#### 6. Team Workload (`/workload`)
* **What the person is trying to do:** Monitor team utilization, prevent staff burnout, and rebalance work across departments.
* **Number of clicks & fields:**
  * 0 clicks to view summary; 1 click to filter by department; 1 click to expand a team member's active work list.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * "Capacity Bands: <65%, 65-85%, >85%" presents mathematical jargon instead of plain status labels like "Available", "Busy", "Overloaded".
    * Workload displays both allocated hours and percentage formulas, creating visual clutter.
  * **360px (Mobile):**
    * Department breakdown cards wrap awkwardly; progress bars for members become tiny slivers (2px high) where color differences are barely discernible.

#### 7. Issues and Blockers (`/issues`)
* **What the person is trying to do:** Resolve dependency bottlenecks reported by team members (e.g. missing footage, raw assets, client asset delay).
* **Number of clicks & fields:**
  * 1 click to select blocker; 1 modal click to resolve; 1 field to type resolution note.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Separated into "Active Dependency Blockers" and "High Revision Flags" on the same screen, which conflates operational roadblocks with creative quality issues.
    * Duration is formatted in raw hours ("72h Blocked", "120h Blocked") rather than natural calendar days ("3 days late").
  * **360px (Mobile):**
    * "Resolve Blocker" modal covers the entire screen and obscures the original context of the deliverable and dependency owner.

#### 8. Reports & Automation (`/reports`)
* **What the person is trying to do:** Access scheduled operational digests (Weekly Marketing, Monthly Scorecard, Creative Production, Team Performance) and inspect automation triggers.
* **Number of clicks & fields:**
  * 1 click on report tab; 1 click to generate/preview report HTML; 2 clicks to configure recipients.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * The page contains three technical tabs: "Report Definitions", "Automation Rules", and "Report Viewer".
    * Automation rule names include system cron strings (`0 8 * * 1`) and technical triggers (`stage.overdue_notice`) that look like developer configuration files.
  * **360px (Mobile):**
    * Generated report preview tables break out of the mobile container, forcing horizontal scrolling inside a nested scroll container (double scroll trap).

#### 9. People Setup (`/people`)
* **What the person is trying to do:** Add new staff, modify job roles, manage work preferences, and view account statuses.
* **Number of clicks & fields:**
  * Adding a user: 1 click on "+ Add Person" -> opens a modal with 11 form fields visible simultaneously (Name, Email, Phone, Role, Job Role, Department, Brand Access, Reports To, Weekly Capacity, Work Preferences, Status).
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Table mixes high-level account information with operational preferences (e.g. checkboxes for "Content", "Script", "Design", "Shoot", "Edit", "Post").
    * Editing a user requires opening a giant modal with zero progressive disclosure.
  * **360px (Mobile):**
    * The modal is longer than the mobile screen height; scrolling down inside the modal can accidentally dismiss it on touch gestures.
    * Checkbox touch targets are 16px wide, far below the 44px touch target guideline.

#### 10. Access Requests (`/admin/access-requests`)
* **What the person is trying to do:** Review public registration submissions from candidates, assign their role/department/capacity, and approve or reject them.
* **Number of clicks & fields:**
  * Approving an access request: 1 click to select card -> opens approval dialog with 6 fields -> 1 click to confirm approval and dispatch invitation email.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * The screen features 4 status filter tabs (`Pending`, `Approved`, `Rejected`, `Info Needed`), but "Info Needed" is rarely used and clutters the filter strip.
    * The approval dialog forces the admin to assign department, job role, and capacity immediately without sensible defaults.
  * **360px (Mobile):**
    * Candidate cards stack nicely, but the "Approve" and "Reject" buttons sit directly next to each other with equal visual weight, creating a high risk of accidental rejection.

---

### Role 2: Creative Head (`creative_head`)

The Creative Head is the primary quality and creative authority. They review monthly plans, approve creative stages (scripts, designs, video cuts), provide constructive revision feedback, and monitor creative department throughput.

#### 1. Home / Dashboard (`/dashboard`)
* **What the person is trying to do:** Immediately see which creative plans and stage deliverables are waiting for their sign-off, review urgent priorities, and check creative department throughput.
* **Number of clicks & fields:**
  * 0 clicks to view; 1 click on "Open Approvals Console" or "Review Plans".
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * The Creative Head sees Section 1 (Month Plan Status) and Section 2 (7-column KPI strip) before seeing their own sign-off queue (Section 7). They must scroll past charts to find what requires their attention.
    * Section 7 ("Waiting for Creative Head Approval") has sub-boxes dividing submitted plans from deliverable stages, each with its own navigation button.
  * **360px (Mobile):**
    * Section 7 is pushed 900px down the page, below KPIs and plan progress bars. The user has to scroll through 3 full screen-lengths before seeing tasks that need their approval.

#### 2. Plan Review (`/calendar?tab=plans`)
* **What the person is trying to do:** Review the SM Manager’s proposed monthly calendar, verify deliverables, request changes on specific rows with notes, or approve all/selected rows.
* **Number of clicks & fields:**
  * 1 click to select submitted plan; 1 click per row to inspect; 2 clicks to request changes (with comment modal); 1 click to approve.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * When requesting changes on a row, the Creative Head must click an edit/comment icon, wait for a modal, type a comment, submit, and repeat for every row.
    * There is no side-by-side drawer showing all fields (Topic, Type, Brief, Reference Link, Priority, Stages) while keeping the row list in view.
    * Rejecting the entire plan requires hunting for a destructive option that isn't clearly separated from approving selected rows.
  * **360px (Mobile):**
    * The table layout is unusable on 360px. Rows truncate topic titles; reviewing comments requires horizontal panning back and forth.

#### 3. Stage Approval Console (`/feedback?tab=stages`)
* **What the person is trying to do:** Watch video cuts, inspect design graphics, read scripts submitted by workers, and click "Approve" or "Request Revision" with specific feedback.
* **Number of clicks & fields:**
  * 1 click on stage card; 1 click on deliverable link; 1 field for feedback notes; 1 click on action button.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * The screen is titled "Feedback and Revisions", which sounds like a reporting archive rather than an urgent "Waiting for Approval" queue.
    * The deliverable URL is often an external Google Drive or Cloudinary link formatted as plain blue text without preview or thumbnail embedding.
    * Previous stage context (e.g. what the approved script was when reviewing an edit) is not displayed on the review card; the Creative Head must navigate away to find it.
  * **360px (Mobile):**
    * Feedback thread items take up the entire viewport. Comment text area is cramped, and clicking the text area triggers virtual keyboard popups that hide the "Approve" button completely.

#### 4. People View (`/people`)
* **What the person is trying to do:** Check team members' assigned job roles, current capacity, and skills/preferences when reassigning creative work.
* **Number of clicks & fields:**
  * 0 clicks to view; 1 click to filter by department.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Administrative controls (Suspend account, Reset password) are either disabled or hidden with vague tooltips, leaving the Creative Head unsure of what they can or cannot edit.
  * **360px (Mobile):**
    * Overflows horizontally; department badges and job roles collide visually.

---

### Role 3: Social Media Manager (`sm_manager`)

The SM Manager builds and submits the monthly content calendar, schedules day-wise social media posts, monitors production deadlines, coordinates with creative specialists, and publishes finished assets.

#### 1. Home / Dashboard (`/dashboard`)
* **What the person is trying to do:** Check monthly publishing velocity, monitor upcoming posting dates, verify whether content pieces are on track or late, and access the Plan Builder.
* **Number of clicks & fields:**
  * 0 clicks to view; 1 click to navigate to Calendar & Plans.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * The dashboard emphasizes departmental throughput and velocity equations rather than posting readiness: "Which deliverables are scheduled to post in the next 48 hours?"
    * Lacks a quick widget showing rows currently in "changes_requested" status that require the SM Manager's immediate edits.
  * **360px (Mobile):**
    * High visual noise; KPI badges wrap awkwardly; navigating to the calendar plan builder requires opening the hamburger menu.

#### 2. Plan Builder & Row Editor (`/calendar?tab=plans`)
* **What the person is trying to do:** Create a new Monthly or Individual plan, add deliverable rows, set posting dates, pick content types, assign stage owners, review validation errors/warnings, and submit to the Creative Head.
* **Number of clicks & fields:**
  * Creating a plan: 1 click on "+ Create Plan" -> 4 fields (Title, Kind, Period Start, Period End) -> 1 click to save.
  * Adding a row manually: 1 click on "+ Add Row" -> 7 fields (Posting Date, Topic, Content Type, Needs Script, Needs Shoot, Content Link, Remarks) -> 1 click to save.
  * Setting stages & owners: Currently, stage generation and owner recommendations only happen AFTER row approval in the legacy flow, violating Workflow V2 where owners and dates are chosen in draft before submission!
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Inability to see stage auto-fill before saving the row. The SM Manager has to guess who is available.
    * No side drawer for detailed fields (Brief, Reference Link, Priority, Remarks, Source Video Link, Posting Owner); rows are cramped in a standard table.
    * Validation errors are only revealed when attempting to submit, causing frustrating form-level rejection rather than continuous live validation chips.
    * Excel/CSV import: Preview modal provides limited error detail when an imported date format or email fails.
  * **360px (Mobile):**
    * Row authoring is virtually impossible on mobile: table cells are too small to tap, dropdowns pop up over the submit button, and horizontal scrolling is mandatory.

#### 3. Post-Approval Schedule & Stage Tracking (`/calendar?tab=tracker`)
* **What the person is trying to do:** Reschedule a deliverable's posting date $F$, swap an owner if a specialist is unavailable, skip an unstarted stage, or mark a completed post as published.
* **Number of clicks & fields:**
  * Editing a row: 2 clicks to open drawer; 2 fields to reschedule date or swap owner.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Action icons for "Reschedule", "Reassign Owner", and "Skip Stage" are hidden inside secondary dropdowns or obscured behind small badge icons.
    * No clear indicator showing whether a deadline was calculated automatically ("auto") or locked manually by the user ("manual").
  * **360px (Mobile):**
    * The tracker table overflows horizontally by over 800px; touching any row risks triggering the wrong stage detail modal.

---

### Role 4: Executive (`executive`)

The Executive Director needs high-level, read-only operational visibility: on-time delivery rates, publishing output across schools, bottlenecks, and team health, with sensitive contact details masked.

#### 1. Home / Dashboard (`/dashboard`)
* **What the person is trying to do:** Check high-level marketing throughput, on-time delivery rate, published deliverables vs target, and identify persistent operational bottlenecks.
* **Number of clicks & fields:**
  * 0 clicks (read-only view).
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Displays interactive buttons ("New Deliverable", "Create Plan") that either show 403 Forbidden errors when clicked or are disabled without a friendly explanation of the executive's read-only scope.
    * The page contains too many micro-level task lists (Today's Priorities) rather than executive-level operational scorecards.
  * **360px (Mobile):**
    * Long, tedious vertical scroll with dense data tables that are not optimized for quick executive scanning on a phone.

#### 2. Read-Only Calendar & Tracker (`/calendar`)
* **What the person is trying to do:** Check scheduled marketing campaigns for upcoming school launches or major programs without risking accidental edits.
* **Number of clicks & fields:**
  * 0 clicks to view; 1 click to toggle Month/Tracker.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Action buttons like "Import Excel", "Create Plan", and "Approve" are rendered in disabled grey states that clutter the executive's visual field instead of being cleanly hidden.
  * **360px (Mobile):**
    * Overflows horizontally; text overlaps on small screens.

#### 3. Executive Reports (`/reports`)
* **What the person is trying to do:** View and export the Weekly Marketing Report and Monthly Scorecard.
* **Number of clicks & fields:**
  * 1 click to select report, 1 click to view HTML digest.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Sees technical tabs like "Automation Rules" with cron expressions (`0 8 * * 1`) which are irrelevant to executive management.
  * **360px (Mobile):**
    * Report tables scroll horizontally inside nested iframe-like containers.

---

### Role 5: Team Member / Worker (`team_member`)

The specialist worker (Copywriter, Graphic Designer, Video Editor, Video Shooter, Poster) focuses exclusively on executing assigned production stages, logging progress, accessing assets, and reporting blockers.

#### 1. My Work (`/my-work`)
* **What the person is trying to do:** See exactly what tasks are assigned to them today, access briefs and previous stage links, start tasks, submit work for approval, and report blockers.
* **Number of clicks & fields:**
  * Starting a task: 1 click on "Start".
  * Submitting for approval: 1 click on "Submit for Approval" -> 1 field (Deliverable URL) -> 1 click to confirm.
  * Reporting a blocker: 1 click on "Report Blocker" -> 2 fields (Reason dropdown, notes) -> 1 click to submit.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Divided into 5 arbitrary date buckets: "Overdue", "Today", "This Week", "Upcoming", "Completed". This creates duplicate scanning effort when a worker just wants to know "What should I do right now?"
    * Cards display internal IDs and technical jargon: "Work Type: Script", "Effort: 2h", "Revisions: 0", "Profile: HACA".
    * Previous stage deliverables (e.g. the approved script that the video editor needs to download) are buried inside a collapsible dropdown labeled "Previous Stage Output".
  * **360px (Mobile):**
    * This is the primary device for creators and shooters on location. Action buttons ("Start", "Submit", "Blocker") are stacked with small heights (<36px) and lack generous thumb-friendly touch targets.
    * The "Report Blocker" modal covers the entire screen, making it impossible to check the brief while describing the blocker.

#### 2. Todo & Priorities (`/todo`) — *Duplicate Page*
* **What the person is trying to do:** Manage daily tasks and check overdue items.
* **Number of clicks & fields:**
  * Duplicate of `/my-work` with a slightly different list presentation.
* **What is confusing & friction points:**
  * **1366px & 360px:**
    * Highly confusing duplication: Workers have both a "My Work" page and a "Todo" page in the navigation menu. Both show assigned tasks, deadlines, and statuses, forcing the user to question which page is the source of truth.

#### 3. Worker Calendar (`/calendar`)
* **What the person is trying to do:** View a personal calendar of their upcoming deliverable due dates.
* **Number of clicks & fields:**
  * 1 click to open calendar; 1 click on date cell.
* **What is confusing & friction points:**
  * **1366px & 360px:**
    * Shows the entire organizational calendar interface with tabs for "Plans & Approval" and "Tracker", which either display 403 Forbidden errors or a message saying "Content Flow Tracker is restricted".
    * It does not filter automatically to "Only My Items" by default, confusing the worker with everyone else's deliverables.

---

### Public & Unauthenticated Surfaces

#### 1. Login Page (`/login`)
* **What the person is trying to do:** Log into the portal with email and password, request new user access, or trigger password recovery.
* **Number of clicks & fields:**
  * Login: 2 fields (Email, Password), 1 button click.
  * Request Access: 1 click to open modal -> 8 fields (Name, Email, Phone, Department, Job Role, Requested Role, Brand Access multi-select, Reason) -> 1 click to submit.
* **What is confusing & friction points:**
  * **1366px (Desktop):**
    * Clean centered card, but the "Request Access" modal is overloaded: it asks unauthenticated external candidates to select internal role hierarchies (`sm_manager`, `team_member`, `executive`) and multi-select internal brand profile codes (`haca`, `haca_tech_school`) that an outsider has no knowledge of.
  * **360px (Mobile):**
    * Request access modal spills over the mobile screen height. The submit button is pushed below the virtual keyboard fold.

---

## 3. The 15 Worst UX Problems (Ranked by Severity)

| Rank | Problem Area | Severity | Root Cause & Impact on User |
| :---: | :--- | :---: | :--- |
| **1** | **Multi-Level Dropdown Navigation** | **Critical** | Top menu hides essential daily tools behind generic category dropdowns ("Schedule", "Operations", "Organization"). Mobile requires 3–4 taps through deep accordions just to reach the Calendar or Workload. |
| **2** | **Duplicate Plan Approval Screens** | **Critical** | Monthly plans are reviewed under `/calendar?tab=plans` AND under `/feedback?tab=plans`. The Creative Head faces split attention and conflicting review controls across two routes. |
| **3** | **Fragmented Worker Experience (`/my-work` vs `/todo`)** | **Critical** | Specialist workers have two separate menu destinations showing their tasks. This creates double maintenance and severe confusion over where to log work. |
| **4** | **Unusable Mobile Table Overflow (360px)** | **Critical** | Tables in Calendar, Tracker, Workload, and People overflow horizontally by 200–800px on mobile screens. Users must scroll horizontally back and forth to read rows. |
| **5** | **Sub-Standard Touch Targets (<44px)** | **High** | Action buttons on table rows (Approve, Reject, Start, Submit) have heights between 26px and 34px, causing frequent mis-taps on mobile touchscreens. |
| **6** | **Jargon-Heavy Terminology** | **High** | Words like "Work Item", "Content Piece", "Pipeline", "Feedback Round", "Revision Flag", and "Band Counts" confuse users who think in terms of "Tasks", "Content", "Steps", and "Team Load". |
| **7** | **Inconsistent Status Terminology & Colors** | **High** | Disparate status words across entities: deliverables use "Feedback", plans use "Submitted", rows use "changes_requested". Colors clash (amber for feedback, purple for pending, teal for published). |
| **8** | **Charts Before "What Needs You Now"** | **High** | Home screens display large analytics cards, velocity gauges, and 7-column KPI strips before displaying urgent items that require immediate sign-off or action. |
| **9** | **Plan Builder Lacks Live Auto-Fill & Auto-Save** | **High** | The SM Manager cannot see auto-calculated stage owners and deadlines before saving rows. Lack of auto-save causes high risk of data loss on long monthly plans. |
| **10** | **Stage Approval Lacks Direct Asset Previews & Context** | **High** | The Creative Head must open external URLs in new browser tabs to review work and cannot see previous stage outputs (e.g. approved script) alongside the current submission. |
| **11** | **Exposed Form Complexity (No Progressive Disclosure)** | **Medium** | Add User and Add Row forms expose 10+ fields at once without progressive disclosure ("More details"), overwhelming the user with optional or internal settings. |
| **12** | **Candidate Request Access Form Demands Internal Knowledge** | **Medium** | Public candidates are asked to choose internal role keys (`team_member`, `sm_manager`) and internal brand codes (`haca_mideast`) before they even join the company. |
| **13** | **Tracker Table Lacks Compact Visual Steppers** | **Medium** | The Tracker renders multi-column text tables rather than clean stage progression dots (Script &bull; Shoot &bull; Edit &bull; Post) with hovering tooltips and a detail drawer. |
| **14** | **Absence of Page Purpose Guidance & Contextual Help** | **Medium** | Pages lack a single-sentence statement of purpose and a '?' contextual help tooltip, leaving new users guessing about operational rules and deadlines. |
| **15** | **Cluttered Visual Hierarchy with Multi-Colored Chrome** | **Medium** | The UI uses a cacophony of conflicting accent colors (purple, violet, emerald, cyan, pink, amber, rose) and heavy borderlines that degrade the soft-glass aesthetic. |

---

## 4. Conclusion & Transition to Part B

The findings from this audit confirm that the system's operational foundations are capable, but the interface creates unnecessary friction for all five roles. Part B of this specification ([docs/UX_SPEC.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/UX_SPEC.md)) provides the exact, unified, mobile-first design system, flattened navigation architecture, text wireframes, and component reuse specifications to resolve every issue identified above.
