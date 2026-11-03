# HACA Marketing OS — UX Design Specification (Workflow V2)

**Document Type:** UI/UX Design System, Information Architecture & Text Wireframes  
**Scope:** Frontend Architecture, Navigation, Forms, Status Vocabulary, and Role-Based Views.  
**Rule:** Strictly specification and design guidance; **NO CODE CHANGES MADE**.

---

## 1. Information Architecture & Navigation System

### 1.1 Core Navigation Principles
1. **Flat Hierarchy (Zero Sub-Menus):** Eliminates multi-level nested dropdowns (`Schedule`, `Operations`, `Organization`). Every destination is directly clickable in a single click from the primary menu.
2. **Strict Limit of &le; 8 Menu Items per Role:** Clean visual clarity, no horizontal overflow, no cognitive overload.
3. **Consistent Route Preservation:** All existing browser URLs and query parameters are preserved 100% to ensure deep linking, bookmarks, and automated tests continue to function.
4. **Active State Highlight:** The current active destination is highlighted with a high-contrast dark accent pill (`bg-slate-900 text-white shadow-sm`), with inactive items in soft translucent grey (`text-slate-600 hover:text-slate-900 hover:bg-white/60`).

---

### 1.2 Role-Based Menu Architecture

#### 1. Administrator (`admin`) — 8 Main Items + Counter Badge
| Menu Label | Icon | Route / URL | Screen Purpose |
| :--- | :--- | :--- | :--- |
| **Home** | `LayoutDashboard` | `/dashboard` | System pulse, urgent bottlenecks, audit feed |
| **Plans** | `CalendarRange` | `/calendar?tab=plans` | Monthly & individual content plans & approvals |
| **Tracker** | `Activity` | `/calendar?tab=tracker` | Step-by-step deliverable stage tracking |
| **Approvals** | `FileCheck` | `/feedback` | Sign-off queue for creative deliverables |
| **Team load** | `Users` | `/workload` | Team capacity, hours, utilization |
| **Problems** | `AlertTriangle` | `/issues` | Active dependency blockers & root causes |
| **Reports** | `BarChart3` | `/reports` | Operational scorecards & scheduled digests |
| **People** | `UserCheck` | `/people` | Staff accounts, roles, departments, preferences |
| **Requests** | `ShieldCheck` | `/admin/access-requests` | Candidate sign-up review (`[Count]` badge) |

*(Note: "Requests" appears as an administrative badge item on the right side of the navigation header adjacent to the user profile, maintaining 8 primary navigation links).*

#### 2. Creative Head (`creative_head`) — Exactly 8 Items
| Menu Label | Icon | Route / URL | Screen Purpose |
| :--- | :--- | :--- | :--- |
| **Home** | `LayoutDashboard` | `/dashboard` | Urgent reviews, creative throughput, team output |
| **Approvals** | `FileCheck` | `/feedback` | Creative deliverable sign-offs (`[Count]` badge) |
| **Plans** | `CalendarRange` | `/calendar?tab=plans` | Review, request changes, or approve content plans |
| **Tracker** | `Activity` | `/calendar?tab=tracker` | Stage flow across Script, Shoot, Edit, Post |
| **Team load** | `Users` | `/workload` | Creative specialist capacity & balance |
| **Problems** | `AlertTriangle` | `/issues` | Creative dependency blockers & revision flags |
| **Reports** | `BarChart3` | `/reports` | Weekly marketing & creative production digests |
| **People** | `UserCheck` | `/people` | Creative roster, job roles, work preferences |

#### 3. Social Media Manager (`sm_manager`) — Exactly 6 Items
| Menu Label | Icon | Route / URL | Screen Purpose |
| :--- | :--- | :--- | :--- |
| **Home** | `LayoutDashboard` | `/dashboard` | Publishing schedule, pending posts, urgent items |
| **Plans** | `CalendarRange` | `/calendar?tab=plans` | Author, edit, auto-fill, and submit content plans |
| **Tracker** | `Activity` | `/calendar?tab=tracker` | Content stage holder, late tracking, reschedule |
| **Team load** | `Users` | `/workload` | Check specialist availability before assigning |
| **Problems** | `AlertTriangle` | `/issues` | Check publishing blockers & external dependencies |
| **Reports** | `BarChart3` | `/reports` | Monthly performance scorecard & weekly reports |

#### 4. Executive (`executive`) — Exactly 5 Items (Read-Only)
| Menu Label | Icon | Route / URL | Screen Purpose |
| :--- | :--- | :--- | :--- |
| **Home** | `LayoutDashboard` | `/dashboard` | High-level marketing throughput & bottlenecks |
| **Plans** | `CalendarRange` | `/calendar?tab=plans` | Read-only view of approved monthly plans |
| **Tracker** | `Activity` | `/calendar?tab=tracker` | Read-only delivery progress across schools |
| **Team load** | `Users` | `/workload` | Team bandwidth & staffing balance overview |
| **Reports** | `BarChart3` | `/reports` | Executive performance scorecards & weekly digests |

#### 5. Team Member / Worker (`team_member`) — Exactly 3 Items (Mobile-First)
| Menu Label | Icon | Route / URL | Screen Purpose |
| :--- | :--- | :--- | :--- |
| **My Work** | `CheckSquare` | `/my-work` | Daily assigned tasks, start, submit, blocker |
| **Calendar** | `Calendar` | `/calendar?tab=month` | Personal calendar showing own due dates |
| **Notifications** | `Bell` | `/notifications` | Assignment notices & feedback alerts |

*(Top-right user avatar provides direct access to **My Account** at `/my-account` and **Sign out**).*

---

### 1.3 URL & Legacy Screen Mapping
To maintain 100% backward compatibility with existing tests and bookmarks:
* `/dashboard` &rarr; Home (redirects `team_member` directly to `/my-work`).
* `/calendar?tab=plans` &rarr; Plans (Plan authoring and plan-level review).
* `/calendar?tab=tracker` &rarr; Tracker (Content stage tracker).
* `/calendar?tab=month` &rarr; Calendar Month View.
* `/feedback` &rarr; Approvals (Deliverable stage approvals; legacy embedded plans tab removed).
* `/workload` &rarr; Team load.
* `/issues` &rarr; Problems.
* `/admin/access-requests` &rarr; Requests.
* `/todo` &rarr; **Merged into `/my-work`** (navigating to `/todo` smoothly redirects to `/my-work`).

---

## 2. Standardized Vocabulary (One Word Per Idea)

To eliminate cognitive friction, internal technical terms are replaced with plain operational words everywhere (screens, buttons, chips, emails, notifications):

| Legacy / Technical Term | Standardized Term | Definition & Context |
| :--- | :--- | :--- |
| `Feedback` / `Feedback Round` | **Waiting for approval** | The stage requires Creative Head or Admin sign-off. |
| `Work item` | **Task** | A single stage assignment held by a worker (e.g. Script task). |
| `Content piece` | **Content** | A row in a calendar plan representing a social deliverable. |
| `Pipeline` / `Workflow` | **Steps** | The sequence of tasks required to produce content (e.g. 4 steps). |
| `Issues and Blockers` | **Problems** | Any active dependency roadblock or revision issue. |
| `Team Workload` / `Capacity` | **Team load** | The working hours and utilization percentage of staff. |
| `Allocation override` | **Manual assignment** | When an owner or date is manually chosen rather than suggested. |
| `Band counts` | **Staff status** | Available (&lt;65%), Busy (65–85%), Overloaded (&gt;85%). |

---

## 3. Page Layout Anatomy & Standards

Every screen follows an identical, predictable vertical hierarchy:

```
+---------------------------------------------------------------------------------------------------------+
| Top Navigation Bar: [Brand Logo]   [Flat Menu Links]                              [Help ?] [User Avatar]|
+---------------------------------------------------------------------------------------------------------+
| Page Header:                                                                                            |
|   TITLE (24px bold)                                           [ Primary Action Button ]                 |
|   Single-line sentence stating what this page is for.                                                  |
+---------------------------------------------------------------------------------------------------------+
| Filter Strip: (Single row, clean pill dropdowns, search input, reset button)                           |
+---------------------------------------------------------------------------------------------------------+
| Main Content Area: (Glassmorphic cards, responsive lists, or tables)                                    |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

### 3.1 Standard Page Header Elements
1. **Title:** Single `<h1>`, 24px bold, `#0F172A`.
2. **Purpose Line:** Exactly one sentence below the title explaining the page's exact function in plain English.
3. **Primary Action Button:** Positioned at the top right of the page header. Capsule pill (`rounded-full`), 44px height, `#0F172A` background with white text and leading icon.
4. **Contextual Help Icon (`?`):** Positioned next to the title or in the header. Clicking or hovering opens a lightweight floating card containing exactly **three lines of guidance**:
   * *Line 1:* Who uses this page and what its primary objective is.
   * *Line 2:* The single most important rule or deadline offset.
   * *Line 3:* How to proceed or resolve issues on this screen.
5. **Secondary Actions Menu (`...`):** Secondary or bulk options (e.g. "Export CSV", "Download template", "Batch archive") are grouped inside a single discreet `...` dropdown pill button next to the primary action.

---

## 4. Form Standards & Progressive Disclosure

### 4.1 Field Visibility Rules
* **The "Rule of 6":** Any form displays at most **6 essential fields** upon opening.
* **Progressive Disclosure ("More details"):** Secondary, optional, or advanced configuration fields are tucked under a collapsible "More details" accordion trigger with an arrow icon.
* **Field Labels:** Positioned directly **above** the field (`text-xs font-semibold text-slate-700`).
* **Required Indicators:** Marked with a subtle red asterisk (`*`).
* **Helper Text:** Short, 1-line guidance text directly beneath the field (`text-[11px] text-slate-500`).
* **Validation Errors:** Displayed in red text (`text-xs text-rose-600 flex items-center gap-1`) directly below the invalid input field immediately upon blur.
* **Auto-Save:** Draft calendar plan rows automatically save changes to local state / draft buffer with a small indicator: `"Draft saved at 14:32"`.
* **Destructive Confirmations:** Modal confirmations are strictly reserved for destructive or irreversible actions (e.g. "Reject Entire Plan", "Delete User", "Skip Stage"). Standard form submissions use an immediate "Save and continue" action.

---

## 5. Unified Status Badges & Colors

Every status indicator throughout the application uses a single, immutable color and vocabulary:

| Status Label | Visual Appearance | Meaning / Usage |
| :--- | :--- | :--- |
| **Not started** | Grey pill (`text-slate-600 bg-slate-100 border-slate-200`) | Task is assigned and unlocked, but worker has not begun. |
| **In progress** | Blue pill (`text-blue-700 bg-blue-50 border-blue-200`) | Worker has clicked Start and is actively producing the asset. |
| **Waiting for approval** | Amber pill (`text-amber-800 bg-amber-50 border-amber-200`) | Deliverable stage submitted; awaiting Creative Head sign-off. |
| **Changes requested** | Orange pill (`text-orange-800 bg-orange-50 border-orange-200`) | Reviewer requested revisions; worker must update and resubmit. |
| **Done** | Green pill (`text-emerald-800 bg-emerald-50 border-emerald-200`) | Stage or content piece has been approved or published. |
| **Blocked** | Red pill (`text-rose-800 bg-rose-50 border-rose-200`) | Worker flagged an external dependency blocker stopping progress. |
| **Locked** | Light grey pill (`text-slate-400 bg-slate-50 border-slate-200`) | Downstream stage waiting for preceding stage approval. |
| **Late** | Red outline pill (`text-rose-700 border-2 border-rose-500 bg-rose-50/50`) | Current date has passed the scheduled stage or posting deadline. |

---

## 6. Worker Page Standards (Mobile-First)

1. **Card-Based Column Layout:** Worker surfaces (`/my-work`) render as a single column of generous, touch-friendly cards (100% width on mobile, max 720px width on desktop).
2. **Minimum 44px Action Targets:** Every button, tab, and input has a minimum touch target height of `44px` (ideal `48px`).
3. **Step-Aware Primary Button:** Each card features exactly **one prominent primary button** whose label explicitly states the exact next action:
   * *Stage 1 (e.g. Script):* **`[ Start Script ]`** &rarr; **`[ Submit for Approval ]`**
   * *Stage 2 (e.g. Shoot):* **`[ Start Shoot ]`** &rarr; **`[ Done and Forward ]`**
   * *Stage 3 (e.g. Edit):* **`[ Start Edit ]`** &rarr; **`[ Submit for Approval ]`**
   * *Stage 4 (e.g. Post):* **`[ Publish Now ]`**
4. **Previous Step Links Front and Center:** If a task depends on a previous stage (e.g. video editor needing the approved script or raw footage link), the link is rendered as an embedded asset button directly at the top of the card:  
   `[ 📄 Approved Script: View Doc ↗ ]` or `[ 🎥 Raw Footage: Open Drive ↗ ]`.
5. **Discreet Blocker Action:** The blocker action is styled as a subtle text link (`"Report a problem"`) at the bottom of the card, preventing accidental triggers while keeping help easily accessible.

---

## 7. Soft-Glass Visual Styling Guidelines

* **Canvas:** Light, cool-grey gradient background (`linear-gradient(160deg, #F8FAFC 0%, #EEF2F6 100%)`).
* **Surfaces:** Translucent white cards (`background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(16px);`).
* **Borders:** Minimal, soft hairline borders (`1px solid rgba(226, 232, 240, 0.7)`).
* **Single Dominant Accent:** Pure deep slate/black (`#0F172A`) for primary interactive controls, active navigation pills, and primary CTAs.
* **Spacing:** Generous padding (`p-6` on desktop, `p-4` on mobile; `gap-6` between sections).
* **Empty States:** Exactly **one clear sentence** explaining the state, accompanied by **one primary button** to create or proceed.

---

## 8. Detailed Text Wireframes & Component Specifications

---

### a. Plan Builder (Social Media Manager)
* **Route:** `/calendar?tab=plans` (Create / Edit Mode)
* **Goal:** Quickly create monthly or individual plans, auto-fill suggested stage owners and deadlines, inspect validation, and submit.
* **Three-Step Stepper Header:** `[ 1. Plan Details ]` &rarr; `[ 2. Add Content Rows (Active) ]` &rarr; `[ 3. Review & Submit ]`

```
+---------------------------------------------------------------------------------------------------------+
| Plans / Tech School November 2026 (Monthly Plan)                                  [ ? Help ] [ Save Draft ]|
| Build and schedule next month's social content deliverables and stage deadlines.                        |
+---------------------------------------------------------------------------------------------------------+
| [ + Add Row ]   [ 📥 Import Excel/CSV ]   [ 📄 Download Template v ]               Status: Draft (Unsaved)|
+---------------------------------------------------------------------------------------------------------+
| CONTENT ROWS TABLE (Responsive Table / Stackable Cards)                                                 |
| [ ] Date       Topic                      Type           Team       Steps Summary (Click to edit)  Actions|
|---------------------------------------------------------------------------------------------------------|
| [ ] Nov 03     Robotics Lab Teaser Reel   Reel (Full)    Marketing  [Sc: Alex 10/26] [Sh: Bob 10/29] ... [...]|
| [ ] Nov 05     Admissions Open Static     Static Post    Sales      [Co: Sam 10/31]  [De: Tim 11/03] ... [...]|
| [ ] Nov 08     Campus Tour Carousel       Carousel       Marketing  [Co: Sam 11/03]  [De: Tim 11/06] ... [...]|
+---------------------------------------------------------------------------------------------------------+
| SUMMARY & VALIDATION BAR (Fixed Bottom Dock)                                                           |
| 3 Content Rows   |   0 Errors   |   1 Warning (Tim has 4 items due Nov 03)        [ Submit for Approval ] |
+---------------------------------------------------------------------------------------------------------+
```

* **Row Authoring Side Panel (Drawer opens on row click):**
  * *Field 1:* `Posting Date (F)` [ Date Picker * ]
  * *Field 2:* `Posting Time` [ Time Input, e.g. 18:00 ]
  * *Field 3:* `Topic` [ Text Input * ]
  * *Field 4:* `Type` [ Dropdown with 15 deliverable types * ] *(Auto-fills steps and deadlines)*
  * *Field 5:* `For team` [ Dropdown: Sales | Marketing | Academics | Other * ]
  * *Field 6:* `Program or event` [ Text Input ]
  * *[ Collapsible: More details ]*
    * `Brief` [ Multi-line text ]
    * `Reference link` [ URL input ]
    * `Priority` [ Normal (default) | Urgent ]
    * `Posting owner` [ Dropdown of active members ]
    * `Needs script` [ Checkbox ] & `Needs shoot` [ Checkbox ] *(For reels)*
    * `Source video link` [ URL input ]
    * `Remarks` [ Text input ]
  * *Steps & Owners Sub-Section:* Shows step chips: `Script` (Alex, Due Oct 26 [Auto]), `Shoot` (Bob, Due Oct 29 [Auto]), `Edit` (John, Due Nov 01 [Auto]), `Post` (Sarah, Due Nov 03 [Auto]). Clicking any chip allows overriding owner or date.
* **Validation & Submit Rules:**
  * Live summary bar calculates errors and warnings continuously.
  * If `Errors > 0`, `[ Submit for Approval ]` is disabled with a red counter badge and a tooltip explaining required fixes.

---

### b. Plan Review (Creative Head)
* **Route:** `/calendar?tab=plans` (Review Mode)
* **Goal:** Review proposed content calendar, approve all or selected rows, or request row-level revisions.

```
+---------------------------------------------------------------------------------------------------------+
| Plan Review: Tech School November 2026 (Submitted by Sarah Manager)                [ ? Help ]           |
| Review scheduled topics, types, assigned owners, and stage deadlines before approving.                 |
+---------------------------------------------------------------------------------------------------------+
| [ Approve All Rows ]   [ Approve Selected (2) ]   [ Request Changes ]   [ Reject Plan with Concern ]    |
+---------------------------------------------------------------------------------------------------------+
| SPLIT REVIEW CONSOLE (Master-Detail)                                                                    |
| [ Rows List (Left 35%)                 ] | [ Selected Content Details (Right 65%)                       ]|
|------------------------------------------|--------------------------------------------------------------|
| [x] Nov 03: Robotics Lab Teaser Reel     | Topic: Robotics Lab Teaser Reel     Type: Reel (Full)        |
|     Status: Submitted                    | Team: Marketing                     Posting: Nov 03 at 18:00 |
|                                          | Brief: Showcase AI lab hardware and student project builds.  |
| [ ] Nov 05: Admissions Open Static Post  | Reference: https://instagram.com/p/ref123                    |
|     Status: Changes requested            |                                                              |
|                                          | Scheduled Steps:                                             |
| [x] Nov 08: Campus Tour Carousel         | 1. Script: Alex Writer (Due Oct 26) [Suggested]              |
|     Status: Submitted                    | 2. Shoot:  Bob Camera  (Due Oct 29) [Suggested]              |
|                                          | 3. Edit:   John Editor (Due Nov 01) [Suggested]              |
|                                          | 4. Post:   Sarah SM    (Due Nov 03) [Suggested]              |
|                                          |                                                              |
|                                          | Warnings: None.                                              |
|                                          | [ Approve This Row ]     [ Request Row Revision... ]         |
+---------------------------------------------------------------------------------------------------------+
```

* **Action Dialogs:**
  * *Request Row Revision:* Modal opens requiring a specific revision comment:  
    `"What needs changing in this row?" [ Textarea * ]` &rarr; `[ Send Changes ]`.
  * *Reject Entire Plan:* Destructive action requiring an overarching plan concern:  
    `"Plan-level concern for rejection" [ Textarea * ]` &rarr; `[ Reject Entire Plan ]`.

---

### c. Stage Approval (Creative Head)
* **Route:** `/feedback` (Approvals Console)
* **Goal:** Efficiently inspect submitted deliverables, compare with briefs and past steps, and approve or request revision.

```
+---------------------------------------------------------------------------------------------------------+
| Waiting for Approval (4 items)                                                     [ ? Help ]           |
| Review creative submissions and provide feedback to advance tasks to the next step.                     |
+---------------------------------------------------------------------------------------------------------+
| DELIVERABLE REVIEW CARD (Stack of cards, 1 per submission)                                              |
| +-----------------------------------------------------------------------------------------------------+ |
| | Task: Edit Video Cut (Reel) &bull; Robotics Lab Teaser                        Step 3 of 4 &bull; Due Today| |
| | Creator: John Editor (Video Production)                       Submitted: Today at 11:20 AM          | |
| +-----------------------------------------------------------------------------------------------------+ |
| | Asset Link: [ 🎥 Watch Video Cut (Cloudinary Preview) ↗ ]                                           | |
| | Context / Previous Steps:                                                                           | |
| |   &bull; Step 1 Script: [ 📄 Approved Script Doc ↗ ] by Alex Writer                                 | |
| |   &bull; Step 2 Shoot:  [ 📁 Raw B-Roll Drive ↗ ] by Bob Shooter                                    | |
| | Creator Notes: "Trimmed to 42s, added sound design and title cards per the script instructions."    | |
| +-----------------------------------------------------------------------------------------------------+ |
| | Action Controls:                                                                                    | |
| |   [ Request Revision ]                         [ Approve & Unlock Next Step (Publish) ]             | |
| +-----------------------------------------------------------------------------------------------------+ |
```

* **Revision Flow:** Clicking `[ Request Revision ]` expands an inline feedback box right on the card:
  * Field: `Specific revision feedback` [ Textarea * ]
  * Root Cause Classification: `Root cause` [ Dropdown: Brief ambiguity | Script change | Visual defect | Audio issue | Brand guideline deviation | Approval delay | Other * ]
  * Buttons: `[ Cancel ]` `[ Send Revision Request ]`

---

### d. My Work (Specialist Worker)
* **Route:** `/my-work`
* **Goal:** A clean, distraction-free mobile-first task list where workers execute daily work in 3 priority buckets.

```
+---------------------------------------------------------------------------------------------------------+
| My Work                                                       [ ? Help ] [ Logged in as: Alex Writer ]  |
| Your active tasks and delivery deadlines for today and this week.                                       |
+---------------------------------------------------------------------------------------------------------+
| TABS: [ Today (2) ]          [ Next (3) ]          [ Later (4) ]                                        |
+---------------------------------------------------------------------------------------------------------+
| TODAY'S TASK CARDS (Mobile-First Single Column, min 44px buttons)                                       |
|                                                                                                         |
| +-----------------------------------------------------------------------------------------------------+ |
| | STEP 1: Script &bull; Robotics Lab Teaser Reel                                 [ Due Today: 17:00 ] | |
| | Content: Tech School November 2026 &bull; Marketing Campaign                                        | |
| | Brief: Write a fast-paced 45s script highlighting AI robotics workstations and student interviews.   | |
| | Reference: https://instagram.com/reel/sample                                                        | |
| |                                                                                                     | |
| | Deliverable Link: [ https://docs.google.com/document/d/1234...                     ]                | |
| |                                                                                                     | |
| | [ Submit Script for Approval ]                                                                      | |
| |                                                                     ( Problem with this task? )     | |
| +-----------------------------------------------------------------------------------------------------+ |
|                                                                                                         |
| +-----------------------------------------------------------------------------------------------------+ |
| | STEP 2: Shoot &bull; Campus Open House Story                                   [ In Progress ]      | |
| | Content: Student Recruitment Stories                                                                | |
| | Approved Script: [ 📄 Open Approved Script ↗ ]                                                     | |
| |                                                                                                     | |
| | [ Done and Forward to Edit ]                                                                        | |
| |                                                                     ( Problem with this task? )     | |
| +-----------------------------------------------------------------------------------------------------+ |
+---------------------------------------------------------------------------------------------------------+
```

* **Locked Step Appearance (in "Next" / "Later" tabs):**
  * Displayed with a light grey card background (`bg-slate-50 border-slate-200`).
  * Shows a lock icon: `🔒 Locked &bull; Waiting for Step 1 (Script) approval`.
  * Primary action button is replaced with: `"Unlocks automatically when script is approved"`.

---

### e. Content Flow Tracker
* **Route:** `/calendar?tab=tracker`
* **Goal:** High-visibility overview of all scheduled deliverables, stage progression dots, current stage holders, and days late.

```
+---------------------------------------------------------------------------------------------------------+
| Content Tracker                                                                 [ ? Help ] [ ⚙️ Filters ]|
| Live stage progression, current task holders, and publishing deadlines across all content.              |
+---------------------------------------------------------------------------------------------------------+
| Quick Filters: [ All ] [ ⚠️ Late (2) ] [ ⏳ Waiting Approval (3) ] [ 👤 Needs Owner (1) ] [ ⛔ Blocked (1) ]|
| Search: [ 🔍 Search topic or creator... ]                         View: [ List View (Active) ] [ Month ]|
+---------------------------------------------------------------------------------------------------------+
| TRACKER TABLE / PROGRESS STEPPERS                                                                       |
| Date     Topic                    Type     Current Step   With (Person)   Due      Late by  Steps Flow  |
|---------------------------------------------------------------------------------------------------------|
| Nov 03   Robotics Lab Teaser Reel Reel     Edit           John Editor     Nov 01   -        🟢 🟢 🔵 ⚪ |
| Nov 05   Admissions Static Post   Static   Design         Tim Designer    Nov 02   1 day    🟢 🔴 ⚪    |
| Nov 08   Campus Tour Carousel     Carousel Script         Alex Writer     Nov 03   -        🔵 ⚪ ⚪    |
+---------------------------------------------------------------------------------------------------------+
```

* **Step Flow Dots Guide:**
  * 🟢 Green Dot: Completed & approved step.
  * 🔵 Blue Dot: In progress / current active step (hover shows: `"Step 3: Edit | Owner: John | Due: Nov 01"`).
  * 🟡 Amber Dot: Waiting for approval.
  * 🔴 Red Dot: Overdue or blocked step.
  * ⚪ White/Grey Dot: Locked future step.
* **Timeline Drawer:** Clicking any row opens a right-side timeline drawer showing the exact history of who touched each step, timestamps (`unlockedAt`, `startedAt`, `submittedAt`, `approvedAt`), and the post-approval change actions (`[ Reschedule F ]`, `[ Change Owner ]`, `[ Skip Stage ]`).

---

### f. Home Screens (By Role)
Every home screen displays **"What needs you now"** in the top 5 clickable cards, followed by a concise operational summary.

#### 1. Admin Home (`/dashboard`)
* **What needs you now:**
  1. *Candidate Request:* "Priya Sharma requested access as Graphic Designer" &rarr; `[ Review ]`
  2. *Blocked Task:* "Video Shoot blocked: Missing security badge" &rarr; `[ Reassign / Assist ]`
  3. *Unapproved Plan:* "Tech School November 2026 submitted 2 days ago" &rarr; `[ Inspect ]`
  4. *Overdue Task:* "Static Post design 2 days late (Tim Designer)" &rarr; `[ Nudge ]`
  5. *Unclassified Revision:* "Campus Story had 3 revisions; root cause unassigned" &rarr; `[ Classify ]`
* **Small Summary Row:** 3 cards: Active Deliverables (42) &bull; Team Load Average (74%) &bull; On-Time Delivery Rate (91%).

#### 2. Creative Head Home (`/dashboard`)
* **What needs you now:**
  1. *Plan Sign-Off:* "Tech School November 2026 (28 deliverables ready for review)" &rarr; `[ Review Plan ]`
  2. *Video Review:* "Edit Cut: Robotics Teaser (John Editor)" &rarr; `[ Watch & Approve ]`
  3. *Design Review:* "Carousel Graphics: Campus Tour (Tim Designer)" &rarr; `[ Inspect & Approve ]`
  4. *Script Review:* "Script: Student Testimonials (Alex Writer)" &rarr; `[ Read & Approve ]`
  5. *Quality Alert:* "Carousel Post reached 3 revisions" &rarr; `[ Review Feedback ]`
* **Small Summary Row:** Pending Approvals (4) &bull; Creative Output This Week (12) &bull; Turnaround Average (1.2 days).

#### 3. SM Manager Home (`/dashboard`)
* **What needs you now:**
  1. *Changes Requested:* "Row 4 in November Plan: Creative Head requested topic revision" &rarr; `[ Edit Row ]`
  2. *Ready to Post:* "Admissions Open Static approved and ready for publishing today" &rarr; `[ Publish ]`
  3. *Late Stage:* "Video shoot overdue by 1 day (Bob Shooter)" &rarr; `[ Check Status ]`
  4. *Unassigned Step:* "Campus Tour carousel needs a designer" &rarr; `[ Pick Owner ]`
  5. *Upcoming Plan:* "December monthly planning begins in 4 days" &rarr; `[ Start Draft ]`
* **Small Summary Row:** Published This Month (18/24) &bull; Publishing Velocity (0.8/day) &bull; Scheduled Next 48h (3).

#### 4. Executive Home (`/dashboard`)
* **What needs you now:**
  1. *Digest Available:* "Weekly Marketing Operations Digest generated for HACA" &rarr; `[ View Report ]`
  2. *Performance Alert:* "On-time delivery for Tech School is at 94%" &rarr; `[ View Scorecard ]`
  3. *Monthly Summary:* "October published deliverables reached 100% of calendar plan" &rarr; `[ Details ]`
  4. *Bottleneck Notice:* "Video Production team load is at 88% (High)" &rarr; `[ View Load ]`
  5. *Upcoming Campaign:* "Tech Visionaries Launch scheduled for Nov 15" &rarr; `[ View Calendar ]`
* **Small Summary Row:** Published Deliverables (34) &bull; On-Time Delivery Rate (94%) &bull; Operational Health (Optimal).

---

### g. People Setup & Add User
* **Route:** `/people`
* **Goal:** Clean staff management displaying essential operational fields with progressive disclosure for capacity and preferences.

```
+---------------------------------------------------------------------------------------------------------+
| People & Team Roles                                                               [ ? Help ] [ + Add Person ]|
| Manage team member profiles, assigned job roles, departments, and production capacity.                 |
+---------------------------------------------------------------------------------------------------------+
| [ All Departments v ]   [ All Roles v ]   [ 🔍 Search by name or email... ]                             |
+---------------------------------------------------------------------------------------------------------+
| STAFF TABLE                                                                                             |
| Name             Email                   Role          Job Role     Department   Preferences   Status   |
|---------------------------------------------------------------------------------------------------------|
| Sarah Manager    sarah@demo.haca.local   SM Manager    Manager      Social Media [Post]        Active   |
| Alex Writer      writer1@demo.haca.local Team Member   Writer       Content      [Co, Sc]      Active   |
| Tim Designer     tim@demo.haca.local     Team Member   Designer     Design       [De]          Active   |
| John Editor      john@demo.haca.local    Team Member   Editor       Video        [Ed]          Active   |
+---------------------------------------------------------------------------------------------------------+
```

* **Add Person Modal (6 Visible Fields + Progressive Disclosure):**
  * *Field 1:* `Full Name` [ Text Input * ]
  * *Field 2:* `Email Address` [ Email Input * ]
  * *Field 3:* `Phone Number` [ Phone Input ]
  * *Field 4:* `Role` [ Dropdown: admin | creative_head | sm_manager | team_member | executive * ]
  * *Field 5:* `Job Role` [ Dropdown: Writer | Designer | Video Editor | Video Shooter | Social Media Manager | Manager * ]
  * *Field 6:* `Department` [ Dropdown: Design | Video Production | Social Media | SEO & Content | Tech * ]
  * *[ Collapsible: More details ]*
    * `Work preferences` [ Checkboxes: Content | Script | Design | Shoot | Edit | Post ]
    * `Weekly capacity` [ Number Input: Default 40 hours ]
  * *Action Buttons:* `[ Cancel ]` `[ Create User & Send Invitation ]`

---

### h. Enabler & Operations Screens

#### 1. Request Access Modal (`/login` &rarr; Request Access)
* **Goal:** Minimal public registration form requiring zero knowledge of internal company jargon.
* **Fields (Exactly 6):**
  1. `Full Name` [ Text Input * ]
  2. `Email Address` [ Email Input * ]
  3. `Phone Number` [ Phone Input * ]
  4. `Department` [ Dropdown: Design | Video Production | Social Media | Content & Copy * ]
  5. `Job Role` [ Dropdown: Writer | Designer | Video Editor | Video Shooter * ]
  6. `Reason for Access` [ Short Textarea: e.g. "Joining HACA creative team" * ]
* **Action:** `[ Submit Request ]` &rarr; Displays clean confirmation: `"Your access request has been submitted to the HACA administrator. You will receive an email once approved."`

#### 2. My Account (`/my-account`)
* **Goal:** Personal settings where staff can update their contact info, view their assigned capacity, and select their personal production preferences.
* **Sections:**
  * *Profile Information:* Name, Email, Phone, Role (read-only), Department (read-only).
  * *Production Preferences:* Checkbox pills for work types they prefer (`Content`, `Script`, `Design`, `Shoot`, `Edit`, `Post`).
  * *Security:* Change Password form (Current password, New password, Confirm password).

#### 3. Problems / Issues & Blockers (`/issues`)
* **Goal:** Resolve dependency roadblocks reported by workers and classify revision root causes.
* **Sections:**
  * *Active Blockers Tab:* Card list showing task title, blocker reason (e.g. "Client asset delay"), notes, dependency holder, and an inline `[ Resolve Problem ]` button.
  * *Quality & Revisions Tab:* Lists tasks with &ge; 2 revision rounds with an inline dropdown to record the root cause without modal interruption.

#### 4. Team Load (`/workload`)
* **Goal:** Real utilization percentage view without confusing mathematical bands.
* **Components:**
  * *Header Cards:* 3 status summary pills: Available (&lt;65%), Busy (65–85%), Overloaded (&gt;85%).
  * *Member Cards:* Card per member displaying avatar, name, department, real workload text (`"72% Workload &bull; 29h / 40h allocated"`), and a single progress bar capped at 100%.

#### 5. Reports (`/reports`)
* **Goal:** Clear access to the 4 canonical operational reports without technical cron clutter.
* **Components:**
  * *Report Selector Strip:* 4 cards: Weekly Marketing, Monthly Scorecard, Creative Production, Team Performance.
  * *Actions Bar:* `[ View Live Digest ]` `[ Download HTML ]` `[ Configure Recipients ]`.
  * *Report Viewer:* Clean, printable table layout rendered with clear headings, metric cards, and zero iframe double-scrollbars.

---

## 9. Implementation Roadmap: Reused Components & Target Files

### 9.1 Existing Components to Reuse & Adapt
1. `apps/web/src/components/Layout.tsx` &rarr; Flatten top nav into 8-item role-based links; remove dropdown category wrappers.
2. `apps/web/src/components/GlobalFilterBar.tsx` &rarr; Reuse existing filter provider; streamline into single horizontal pill strip.
3. `apps/web/src/components/NotificationCenter.tsx` &rarr; Maintain existing socket-driven alert dropdown.
4. `apps/web/src/components/Skeleton.tsx` &rarr; Reuse existing loading state skeletons.
5. `apps/web/src/pages/calendar/PlansTab.tsx` &rarr; Adapt into the new 3-step Plan Builder and side drawer.
6. `apps/web/src/pages/calendar/TrackerTab.tsx` &rarr; Adapt into the dot-based progress stepper and timeline drawer.
7. `apps/web/src/pages/work/MyWorkPage.tsx` &rarr; Adapt into mobile-first 3-tab layout (`Today`, `Next`, `Later`).

### 9.2 Exact Files to Modify in Phase W3 (UI Build)
* Navigation & Shell:
  * `apps/web/src/components/Layout.tsx` (Flatten navigation, apply unified vocabulary)
  * `apps/web/src/App.tsx` (Redirect `/todo` to `/my-work`, maintain all other routes)
* Core Pages:
  * `apps/web/src/pages/dashboard/TeamDashboardPage.tsx` ("What needs you now" first, simplified metrics)
  * `apps/web/src/pages/calendar/CalendarPage.tsx` (Streamlined 3-tab switcher: Month, Plans, Tracker)
  * `apps/web/src/pages/calendar/PlansTab.tsx` (Live auto-fill, side authoring drawer, validation bar)
  * `apps/web/src/pages/calendar/TrackerTab.tsx` (Dot steppers, timeline drawer, preset filter chips)
  * `apps/web/src/pages/feedback/FeedbackPage.tsx` (Card-based deliverable approval console, remove duplicate plans tab)
  * `apps/web/src/pages/work/MyWorkPage.tsx` (Mobile-first cards, step-aware buttons, previous step links)
  * `apps/web/src/pages/workload/TeamWorkloadPage.tsx` (Simplified utilization cards, plain status words)
  * `apps/web/src/pages/issues/IssuesBlockersPage.tsx` (Renamed to Problems, streamlined resolution flow)
  * `apps/web/src/pages/reports/ReportsPage.tsx` (Clean 4-report selector, remove cron strings from view)
  * `apps/web/src/pages/admin/UsersPage.tsx` (Progressive disclosure for capacity and preferences)
  * `apps/web/src/pages/admin/AccessRequestsPage.tsx` (Simplified candidate review with safe button spacing)
  * `apps/web/src/pages/LoginPage.tsx` (6-field public Request Access modal)
  * `apps/web/src/pages/MyAccountPage.tsx` (Clean personal profile and work preferences)

---

## 10. Verification & Approval Gate

Per user instructions:
* **Code Changes Status:** Strictly **ZERO** code files were modified.
* **Deliverables Generated:**
  1. [docs/UX_AUDIT.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/UX_AUDIT.md) — Comprehensive UX audit across all 5 roles and viewports (1366px & 360px), ending with the 15 worst problems.
  2. [docs/UX_SPEC.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/UX_SPEC.md) — Complete UX specification, flattened &le; 8-item navigation, standardized vocabulary, form rules, unified status chips, text wireframes, and component reuse plan.
* **Next Action:** STOPPED. Awaiting user review and approval before proceeding with implementation.
