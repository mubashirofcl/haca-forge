# HACA Marketing OS: Project Report

Complete redesign of HACA FORGE into HACA Marketing OS (V1 Team Workspace)
Prepared 17 October 2026. Source of truth: HACA Marketing OS Build Specification V1.0,
from the Marketing Head.

Scope rule: only what the specification defines is part of the product. Anything it does
not mention is either removed from the product, or listed as a small enabler or an open
decision (sections 15 and 17).

## 1. Executive summary

HACA Marketing OS is one system where the marketing team plans, assigns, produces,
approves and reports on all marketing work, with LeadSquared (LSQ) lead data shown
next to that work. The Marketing Head, Team Leads and Team Members all use the same
data, seen through their role and filtered by brand Profile.

HACA FORGE today is a request-and-pipeline portal: other departments raise requests, a
Lead triages them, and four production teams deliver content in fixed stages. This
redesign replaces that product model with the Marketing OS model. The technical
foundation (monorepo, authentication, API layer, background jobs, notifications, UI
system) is reused. The product model, data model, roles and screens are replaced.

| Aspect | HACA FORGE (current) | HACA Marketing OS (target) |
| --- | --- | --- |
| Purpose | Intake and production pipeline for requests from other departments | Team workspace to plan, assign, produce, approve and report marketing work, plus lead analytics |
| Core unit | ContentItem with a multi-stage pipeline of tasks | Work Item (one owner), always inside a Campaign |
| Organizing dimension | Requesting department and 4 production teams | 7 brand Profiles as a filter on shared data, 7 departments |
| Roles | 8 | 4 (Admin, Marketing Head, Team Lead, Team Member) |
| Link to business goals | None | Business target, then Campaign, then Work Item (enforced) |

| Aspect | HACA FORGE (current) | HACA Marketing OS (target) |
| --- | --- | --- |
| Lead data | None | LSQ funnel, CPL, CPQL, data health |
| Automation | Fixed jobs | Configurable Automation Rules |
| Dashboard | Role count widgets | Team Dashboard with a clickable drill-down chain |

## 2. Problem and goal

Problems the system removes:

Work is tracked by hand in sheets and chats, so time goes to updating trackers instead
of creating.

The Head sees a number (for example 18 overdue tasks) but cannot click through to
the task, the person and the reason.

Marketing work is not tied to the business target it serves.

Work goes to whoever is asked, so some people are overloaded while others are free.

Blockers are invisible: nobody knows who is waiting on whom.

Heavy revision cycles are never diagnosed, so process problems repeat.

Lead data in LSQ is separate from the campaigns and work that produced it.

Weekly and monthly reports are assembled by hand.

Seven brands would otherwise need seven tools.

Goal: one place for the Marketing Head, Team Leads and Team Members to plan, assign,
produce, approve and report, with the coordination and reporting around it automated.

## 3. Scope

### 3.1 In scope (V1)

14 screens: Login and Profile selection, Team Dashboard, My Work, Monthly Marketing
Calendar (with Content Tracker view: Social view and Design view tables replacing the team's sheets),
Projects/Campaigns, Project Detail, Single Work Detail (with sequential stage stepper),
Feedback & Revision History, Team Workload, Todo & Priorities, Issues & Blockers, Lead Funnel,
Data Center/LSQ, Reports & Automation

Content flow (CONTENT_FLOW.md): ContentPiece grouping sequential stage work items (Design pipeline and
Reel pipeline variants A, B, C), stage-based work items with dependency unlocking, review stages
(Script, Content, Design, Edit) and non-review stages (Shoot, Post), Creative Head approver rule
(team_lead with job role Creative Manager (TL)), work preferences (Content, Script, Design, Shoot,
Edit, Post) for stage candidates, cross-department assignment by SM Manager, Content Tracker table view
on Calendar, stage stepper on Work Detail, standing monthly brand campaigns, and turnaround tracking.
(Note: CV stage is parked and NOT included).

Auto-assignment recommendation with Team Lead override

LSQ read sync and inbound-lead-to-task creation

Revision-pattern flagging, root-cause classification and escalation

Blocker system with dependency-owner notification

Automation rules and automated weekly and monthly reports

Business-goal traceability chain, global filter bar, drill-down navigation

### 3.2 Out of scope (deferred, not rejected)

Leaderboard, content repurposing, campaign templates (auto task structure),
dependency mapping, Weekly Marketing Meeting Mode.

## 4. Design principles

1. One centralized system. Profile is a filter dimension, never a separate database or

tenant.

2. Permissions are enforced at the query layer using the user's profile access, not by

sending people to different apps.

3. No orphaned work: a Campaign needs a Monthly Target, a Work Item needs a

Campaign.

4. Never assign silently: show the recommendation and the reason, and log overrides.

5. Simple, explainable rules, not black-box scoring.

6. Every number is clickable down to the record: Business, Profile, Department, Member,

Project, Work, Feedback, Result.

7. Protect creative time: automate coordination and reporting.

8. Empty states read as clarity, not surveillance. Performance is never linked to

incentives.

## 5. Users, roles and access

### 5.1 Roles

| Role key | Spec name | Typical people | Breadth |
| --- | --- | --- | --- |
| admin | System Owner / Admin | IT / System Owner | Every permission, all profiles, everyone, every screen |
| marketing_head | Marketing Head | Head of Marketing | Org-wide, all profiles by default (creative & operating leadership) |
| executive | Executive / Management | CEO, Business Head, Directors | Complete read-only view of portal, all 7 profiles, zero write permissions |
| team_lead | Team Lead | Creative Manager, Design Lead and other leads | Own team (direct reports and department), within assigned profiles |
| team_member | Team Member | Designers, writers, editors, specialists | Self only, within assigned profiles |

Role sets breadth. Profile access sets which brands that breadth applies to. Example: a
Team Lead scoped to HACA Design School has Team Lead breadth for that profile only.
Admin sits outside the creative hierarchy, holds all permissions, and manages user accounts and access requests.
Executive sits at company management level, holds complete read-only visibility into all profiles and screens, and cannot mutate any data.

### 5.2 Capability matrix (from the specification)

| Capability | Admin | Marketing Head | Executive | Team Lead | Team Member |
| --- | --- | --- | --- | --- | --- |
| User administration & role changes | Yes | No | No | No | No |
| Approve / reject access requests | Yes | No | No | No | No |
| Manage people operating fields | Yes | Yes (TL & Member only) | No | No | No |
| Profiles visible | All | All by default | All (7 by default) | Assigned profiles | Assigned profiles |
| People visible | Everyone | Everyone | Everyone (names/roles; email/phone masked) | Own team (direct reports and department) | Self only |
| Dashboard scope | Org-wide | Org-wide KPIs, all campaigns | Org-wide KPIs, all campaigns (read-only) | Team KPIs, team's campaigns | Personal priorities only |
| Create and assign work | Yes | Yes, any profile in scope | No | Yes, own team | No, can request via Team Lead |
| Override auto-assignment | Yes | Yes | No | Yes | No |
| Approve and give feedback | Yes | Yes | No | Yes, own team's work | No, can respond to feedback |
| Classify revision root cause | Yes | Yes | No | Yes | No |
| Team performance analytics | Full | Full | Full (view only) | Own team only | Own stats only |
| Lead Funnel, LSQ, Data Center | Full | Full | View only (all profiles) | View only, own profiles | Hidden |
| Reports and Automation config | Full | Full | View reports (generation blocked) | View own team's scheduled reports | Hidden |
| OKR and Targets entry | Yes | Yes | View only | View only | Hidden |

### 5.3 Profile access

profileAccess[] is a list on each Person. Admin, the Marketing Head, and Executive default to all profiles.
A person with several profiles lands on All or on their last-used profile.
Changing the Profile filter changes every section of the screen at once.

### 5.4 Team membership

A Team Lead sees direct reports plus their department, within profile access. Carried
over from the earlier role plan: a Team Member can report to more than one Team Lead
( reportsToIds[] ), set by the Marketing Head. Any of a member's leads can assign work
to, review and see that member.

### 5.5 Enablers (needed to run the system, not product features)

People setup and access administration:
- The Admin creates and invites users, approves/rejects access requests, sets roles (including granting admin, marketing_head, and executive), suspends users, and forces logouts.
- The Marketing Head manages operational fields of team leads and team members (department, job role, profileAccess, reportsToIds, weeklyCapacityHours) via `people.assign`. Marketing Head cannot create, grant, or modify admin or executive accounts.
- The Request Access flow is kept from FORGE as an Admin-only onboarding enabler: public request form (rate-limited, duplicate-protected) + Admin approval interface. The executive role cannot be requested publicly.
- Executive Leadership (CEO, Business Head, Directors) hold the `executive` role for complete portal visibility across all 7 brand profiles, while also continuing to receive scheduled email reports.

## 6. Architecture

### 6.1 Stack (reused from FORGE)

| Layer | Technology |
| --- | --- |
| Backend | Node 22 LTS, Express 5, MongoDB with Mongoose, Zod validation, CASL permissions, JWT in httpOnly cookies |

| Layer | Technology |
| --- | --- |
| Jobs and events | BullMQ with Redis, internal event bus, Socket.io for live notifications |
| Email | Existing mailer adapter (smtp, resend, console) |
| Frontend | React 18, Vite, TypeScript, Tailwind, TanStack Query and Table, React Hook Form with Zod, Recharts, existing glass UI |
| Shared | @mmp/shared : role keys, permission keys, enums, Zod schemas |
| Files | Cloudinary, for the Work Detail Files tab |
| Integration | LSQ API (webhook if available, otherwise polling) |
| Logging | Pino |

### 6.2 Layout

apps/api/src/modules/  auth, people, referenceData, targets, campaigns, 
workItems,
                       assignment, feedback, blockers, leads, automation, 
reports,
                       dashboard, notifications, activity
apps/web/src/pages/    the 14 screens, plus people setup
packages/shared/       roles, permissions, enums, schemas

### 6.3 Row-level scoping

One helper, resolveScope(user, filters) , returns the allowed profile ids and the

person scope (all, team or self). Every list, aggregate and report takes its scope from this
helper. No route builds its own filter.

### 6.4 Global filter

One filter state (Profile, Department, Owner, Campaign, Date or month, Status), synced to
the URL and passed to every query. Changing Profile updates every widget on the screen
in one state change.

### 6.5 Events and jobs

Events: workItem.created , assigned , submitted , approved , published , overdue ,

blocked , unblocked , feedback.given , revision.flagged , revision.escalated ,

lead.inbound , lead.synced , report.generated . Jobs run as BullMQ repeatable

schedules and read AutomationRule.active  before acting.

## 7. Data model

Ten core entities include the nine from the specification (Profile, Person, Campaign, Work Item,
Feedback Entry, Blocker, Lead, Automation Rule, Report Definition) plus ContentPiece from the content flow.
Records marked (S) are supporting records that the specification's own rules require.

Profile (7 fixed values): id , name . A filter dimension, not a tenant.

Department (7 fixed values): id , name .

Person

| Field | Notes |
| --- | --- |
| name, email, status | status: invited, active, suspended |
| jobRole | One of 13 fixed job titles (section 14). Optional for admin |
| departmentId | FK to Department. Optional for admin |
| role | admin, marketing_head, team_lead, team_member. Admin holds all permissions; team_lead breadth granted by isTL |
| profileAccess[] | List of Profile ids. Drives all scoping. Admin defaults to all profiles |
| reportsToIds[] (S) | Team Leads this person reports to (empty for admin and marketing_head) |
| weeklyCapacityHours | Used for workload %. Optional for admin (admin excluded from workload/assignment) |
| lastProfileId (S) | Last-used profile filter |
| workPreferences[] | Stages person can take: Content, Script, Design, Shoot, Edit, Post. Set by Admin or Marketing Head in People |
| workloadPct | Derived: sum of estimatedEffortHrs of open owned work items divided by weeklyCapacityHours |
| avgRevisions | Derived, rolling 90 days. Feeds the revision flag and auto-assignment |

MonthlyTarget (S): month , profileId  (empty means org-wide), revenueTarget ,

leadsTarget , qualifiedLeadsTarget , budget , enteredById . Actuals are computed
from campaigns (spend) and leads (LSQ). Entry: Marketing Head. View: Team Lead.

Campaign / Project

| Field | Notes |
| --- | --- |
| name, profileId, ownerId | Owner is usually a Team Lead |
| goalType, goalValue | For example Leads, Reactivations, Enrollments |
| budget, spend | Currency |
| relatedOKR | Text, required |
| targetId | FK to MonthlyTarget, required |
| status | In Progress, At Risk, Completed |
| progressPct | Derived from linked work item completion, or set manually when the goal is not work-item-countable |
| startDate, endDate (S) | Needed for budget pace and the Campaign calendar view |

ContentPiece (groups sequential stages of a piece from CONTENT_FLOW.md)

| Field | Notes |
| --- | --- |
| code, topic | Generated code, content topic |
| contentType | One of the extended work types (Reel, Static Post, Carousel Post, etc.) |
| profileId | FK to Profile (brand). Replaces the sheet brand tabs |
| campaignId | FK to Campaign (standing monthly campaign for the brand) |
| finalDate | Final date F: posting date for postable types, deadline from design sheet for others |
| pipeline | Design or Reel (Variant A, B, or C) |
| needsScript, needsShoot | Booleans (for Reel pipeline variants) |
| contentLink, assetsLink | Zoho Writer / Google Docs content link, creative assets link |
| remarks | Free text remarks |
| createdById | FK to Person (SM Manager, Marketing Head, or Admin) |
| status | Derived: Planning, In production, Awaiting approval, Revision requested, Ready (final done), Published; red flag if Blocked/Overdue |
| turnaroundDays | Derived: published date minus first stage start date |
| stageWorkItems[] | List of attached stage WorkItem records in execution sequence |

Work Item (the atomic unit; each stage of a ContentPiece is a normal Work Item)

| Field | Notes |
| --- | --- |
| title, type | Extended work types: 14 design requirement types + Reel (section 14) |
| profileId, campaignId, ownerId | Campaign is required |
| contentPieceId | FK to parent ContentPiece (empty for standalone work items) |
| stageKey, stageOrder | Stage identifier (Script, Shoot, Edit, Post, Content, Design) and numeric order |
| reviewRequired | Boolean: true for review stages (Script, Content, Design, Edit); false for non-review stages (Shoot, Post) |
| unlockedAt, isSkipped | Unlocking timestamp when prior stage finishes; isSkipped for stages not needed |
| contentLink, assetsLink | Stage deliverable link (Zoho/Google doc or assets link) |
| departmentId | Derived from owner, stored for fast filtering |
| priority | High, Medium, Low |
| status | Not Started, In Progress, Feedback, Pending, Blocked, Approved, Published. Overdue is computed |
| channel, expectedOutcome | expectedOutcome: Lead Generation, Brand Awareness, Engagement, SEO Ranking, Nurture, Conversion, Reactivation, Ops |
| estimatedEffortHrs, actualEffortHrs | Feed workload and auto-assignment |
| deadline | Date (calculated by stage offset from final date F, editable) |
| brief | objective, audience, message, cta, platform, deliverable, successMetric, reference |
| relatedOKR, relatedTarget | Inherited from the campaign, read-only |
| files[] (S) | Uploaded files or links, for the Files tab |
| createdAt, assignedAt, startedAt, submittedAt, approvedAt, publishedAt | Full timeline, feeds turnaround reporting |
| leadsGenerated, qualifiedLeads | Filled after publishing via LSQ attribution |
| revisions | Derived: number of rounds marked Revision Required |

Shared config: pipelines, stage definitions, type-to-pipeline table, default due-date offsets, approver job roles (Creative Manager (TL)).
Work types: extended with the 14 design requirement types and Reel. Note: CV stage is parked and NOT included.

Feedback Entry: workItemId , round , fromPersonId , text , isResponse  (true for the

assignee's reply), roundStatus  (Revision Required or Approved, reviewer entry only),

at . History is never overwritten.

RevisionFlag (S): workItemId , ownerId , raisedAt , trigger  (baseline exceeded or hard
cap), revisionCountAtFlag , ownerBaselineAtFlag , rootCause  (empty until classified),

classifiedById , classifiedAt , escalatedAt .

Blocker: workItemId , reason  (9 fixed values), waitingOnPersonId , raisedAt ,

resolvedAt , notifiedAt , note  (used for Other).

AssignmentOverride (S): workItemId , recommendedPersonId , chosenPersonId ,

overriddenById , at .

Lead (read-authoritative from LSQ, never hand-edited): lsqLeadId , phone , source  (19
values), campaignId , profileId , program , leadStatus  (12 funnel stages),

qualifiedStatus , contactStatus , paymentStatus , reEngagementFlag ,

conversionFlag , ownerRef , LSQ timestamps, lastSyncedAt , workItemId  (empty
unless attributed).

Automation Rule: name , triggerType , triggerCondition , action , active ,

lastRunAt .

Report Definition: name , cadence , scope  (profile, department, team member, campaign

or org-wide), recipients[] , lastGeneratedAt .

ActivityEvent (S): entityType , entityId , actorId , action , at , meta . Feeds the
Activity tab and Recent Activity.

Notification (S): userId , type , entityRef , message , readAt , createdAt .

## 8. Business rules

### 8.1 Traceability chain

Business Goal, Marketing Target, Strategy, Campaign, Work Item, Execution, Feedback
and Approval, Publishing, Lead and Performance data, Analysis, Decision.

Enforced when records are created, not filled in later:

A Campaign cannot be created without a Monthly Target ( targetId ) and

relatedOKR .

A Work Item cannot be created without a Campaign.

relatedOKR  and relatedTarget  are copied from the Campaign onto the Work Item

and are read-only there.

Drill-down path: dashboard KPI card, filtered list, work item, its campaign, the business
target.

### 8.2 Work Item statuses and transitions

Statuses: Not Started, In Progress, Feedback, Pending, Blocked, Approved, Published.
Overdue is computed (deadline passed and status not Approved or Published). It is never
stored and never a transition target.

| From | To | Who | Rule |
| --- | --- | --- | --- |
| Not Started | In Progress | Owner | Start. Sets startedAt |
| In Progress | Feedback | Owner | Submit for approval (review stages: Script, Content, Design, Edit). Sets submittedAt |
| Feedback | Approved | Reviewer (Creative Head [Creative Manager (TL)], Head, or Admin) | Feedback entry with roundStatus Approved. Sets approvedAt |
| Feedback | In Progress | Reviewer (Creative Head, Head, or Admin) | roundStatus Revision Required ('Rejected' in sheet maps to Revision Required, counted as revision; not final). Owner must respond before next round |
| In Progress | Approved / Next stage | Owner | 'Done and forward' for non-review stages (Shoot, Post). Sets completed timestamp and links |
| Approved | Published | Owner or reviewer | Sets publishedAt (only for postable types: Reel, Static Post, Carousel Post, Story, Poster) |
| Any open status | Blocked | Owner | Reason required (8.6) |
| Blocked | Previous status | Owner or Team Lead | Resolves the blocker |
| In Progress | Pending | Owner | Assumed meaning: waiting, but not a blocker |

Stage dependency rule: A stage cannot be started until the previous stage is approved or done.
Skipped stages ('Not needed') are bypassed and ignored by deadlines, workload, and alerts.
Poster is final done when Design Approval is given; for postable types the Post stage follows.
'Approval' in the sheet is the Creative Head's decision on the last review stage, not a separate task.

### 8.3 Auto-assignment and work preferences

Triggered when a Work Item is created without an owner.

1. Filter candidates:
   - For standalone work items: right department for the work type, workloadPct below 85%, and enough unallocated capacity before the deadline.
   - For ContentPiece stage work items: candidate pool comes from Person.workPreferences[] (Content, Script, Design, Shoot, Edit, Post) instead of the department table, filtered by brand profile, workloadPct below 85%, and available bandwidth before the stage due date.
2. Rank: lowest workloadPct first, then lowest avgRevisions, then earliest availability.
3. Show, never assign silently: 'Recommended Owner: [Name]. Reason: lowest current workload ([X]%) + suitable skill/preference + available bandwidth.'
4. Who assigns: SM Manager, Marketing Head, and Admin. The Creative Head approves only.
5. Cross-department assignment: The SM Manager can assign across departments for content pieces (e.g. a Writer, a Designer, and an Editor on one piece), even though a normal team lead only sees their own team.
6. Assign now or later: Stages can be assigned at planning time or left open ('Needs owner'), alerting the SM Manager when unlocked.
7. Overrides: Head or Team Lead (SM Manager) may override before creation. Every override is logged in AssignmentOverride (who, from whom, to whom).

Proposed work type to department mapping (standalone work items):

| Department | Work types |
| --- | --- |
| Video Production | Reel, Video Ad, YouTube Short/Video |
| Design | Ad Creative, Carousel, Landing Page |
| Social Media | Post |
| SEO & Content | Blog, Email, Copy, SEO Audit |

| Department | Work types |
| --- | --- |
| WhatsApp | WhatsApp Blast |
| Performance Marketing | Ad Set, Internal Report |

### 8.4 Workload

workloadPct  = sum of estimatedEffortHrs  of open work items owned, divided by

weeklyCapacityHours .

| Band | Range |
| --- | --- |
| Healthy | below 65% |
| High | 65% to 85% |
| Overloaded | above 85% |

The Team Workload screen is a leading indicator: it must show overload before deadlines
slip.

### 8.5 Feedback, revision flag and escalation

Every review round has the reviewer's entry (roundStatus) and, if revision was
required, the assignee's response ( isResponse  true) before the next round opens.

revisions  on a Work Item is the number of rounds marked Revision Required.

Flag a work item when revisions exceed the owner's own rolling avgRevisions  by

more than 1, or reach a hard cap of 4, whichever comes first (defaults, pending sign-
off).

The Team Lead classifies the root cause from a fixed list: Brief unclear, Creative
direction unclear, Skill gap, Feedback inconsistency, Excessive scope change, TL
approval delay, Client/business requirement changed.

Escalate to the Marketing Head (notification) when a flag stays unclassified for more
than 48 hours, or the same person is flagged 2 or more times in a rolling 30 days.

The purpose is to diagnose the process, not the person. Performance data is never
incentive-linked.

### 8.6 Blockers

Any Work Item can be marked Blocked by its owner. Reason is one of 9 fixed values:
Waiting for feedback, Waiting for content, Waiting for data, Technical issue, Dependency,
Client/business approval, Resource issue, Unclear requirement, Other (free text only
here).

For Waiting for content, feedback or data, the owner must choose the dependency owner,
and that person is notified immediately (not the requester). Example: 'Video Editor A is
blocked for 4h because final copy is pending from Writer B.' blockedSince  and

resolvedAt  give blocker resolution time.

### 8.7 Performance dimensions

Performance is not 'tasks completed'. Five dimensions feed Team Workload now and the
deferred Leaderboard later.

| Dimension | Metrics |
| --- | --- |
| Output | Work completed, creative output volume, campaigns executed |
| Efficiency | Average completion time (createdAt to publishedAt), deadline adherence %, revision rate |
| Quality | Approval rate, rejection rate, re-edit rate |
| Collaboration | Feedback response time, blocker resolution time, dependency delay incidents caused |
| Business impact | Leads, qualified leads and engagement attributable to published work |

### 8.8 Content flow pipelines, deadlines, approvals & turnaround

From `docs/CONTENT_FLOW.md` (replaces legacy SM CONTENT and brand design sheets; brand tabs become Brand filter; CV stage is parked and NOT included).

1. **Pipelines:**
   - **Design pipeline (posters and all design requirements):** Content (Content creator, reviewed by Creative Head -> content doc link) -> Design (Designer, reviewed by Creative Head -> assets link or files) -> Post (Posting owner, non-review -> published date and link, only for postable types). Poster is final done when Design Approval is given; for postable types the Post stage follows.
   - **Reel pipeline:** SM Manager specifies Needs script? and Needs shoot?:
     - Variant A (with script, with shoot): Script (reviewed) -> Shoot -> Edit (reviewed) -> Post
     - Variant B (no script, with shoot): Shoot -> Edit (reviewed) -> Post
     - Variant C (no script, no shoot - program-video based reels): Edit (reviewed) -> Post
     - Skipped stages show as 'Not needed' in the tracker and are ignored by deadlines, workload, and alerts.
   - **Type to pipeline:**
     - Reel: Reel (A, B, or C; has Post stage)
     - Static Post, Carousel Post, Story, Poster (SM sheet): Design pipeline (has Post stage)
     - Cover Image, Thumbnail: Design pipeline (no Post stage)
     - Meta Ad Creative: Design pipeline (no Post stage; final done, hand-off to performance team not built)
     - Class Announcement, Orientation Creative, Graduation Creative, Offer Creative, Brochure, Certificate, Placement Poster, Custom Request: Design pipeline (no Post stage; final done)

2. **Approver rule (default):**
   A piece can be approved by a team lead whose job role is `Creative Manager (TL)` (Creative Head), by the Marketing Head, or by Admin. The SM Manager assigns but does NOT approve.

3. **Stage Deadlines:**
   Each stage has its own due date, counted back from final date F (posting date for postable types, deadline from design sheet for the rest):
   - Design, postable: Content F-6, Design F-3, Post F
   - Design, not postable: Content F-5, Design F-2 (approved by F)
   - Reel A: Script F-10, Shoot F-7, Edit F-4, Post F
   - Reel B: Shoot F-7, Edit F-4, Post F
   - Reel C: Edit F-4, Post F
   - Approvals are expected within 1 working day of submission. If the posting date changes, the SM Manager can shift all unstarted stage deadlines in one click.

4. **Turnaround:**
   Turnaround (Days) = Published date minus the first stage start date.

5. **Campaign Linkage:**
   Each content piece links to one standing campaign per brand per month.

## 9. Automation rules

All rules are simple trigger and action pairs, run by a scheduler and the event bus. Each is
an AutomationRule  record with an active or paused switch and lastRunAt . Jobs load

their rule, skip if paused, run, then update lastRunAt . Idempotency keys (work item, rule,

date) prevent duplicate alerts after a restart. Notifications go in-app and by email through
the existing mailer.

| Rule | Trigger and action | Priority | Defaults and open points |
| --- | --- | --- | --- |
| Month-end performance report | Last day of month, 11:59pm: compile and email to Marketing Head, Business Head, CEO | Priority | Timezone to confirm |
| Overdue task escalation | Task passes deadline: notify owner at once, notify Team Lead after a threshold | Priority | 4 hours (placeholder, to confirm) |
| Todo escalation notice | Work item has no status change for N days: notify owner, then Team Lead | Priority | N not given, suggest 3 days |
| Blocker dependency alert | Task marked Blocked: notify the dependency owner | V1 | Must ship in V1 |
| Revision pattern flag | Revisions exceed owner baseline: flag for Team Lead classification | V1 | +1 or 4 (to confirm) |
| LSQ live sync | New or updated lead in LSQ: update funnel and dashboard | V1 | Webhook or polling (section 10) |
| Weekly report builder | Every Monday 8:00am: compile and send the weekly marketing report | V1 |  |
| Campaign task auto-structure | New campaign: generate starter tasks by campaign type | V1.1 | Not built until campaign type templates exist |

## 10. LSQ integration

LSQ is the source of truth for lead data. Marketing OS visualizes and analyzes it and never
lets anyone hand-edit a lead.

### 10.1 Sync direction 1: LSQ to Marketing OS

Pull per lead: source, campaign, profile, program, lead status, qualified status, contact
status, payment status, re-engagement flag, conversion flag, timestamps. Map to the
fixed 12-stage funnel already used in the weekly sync tracker:

Derived per campaign or profile (same formulas as the Outbound and Paid Ads weekly-
sync block):

CPL = spend / ad leads achieved

CPQL = spend / qualified leads

Qualified Lead % = qualified / total

### 10.2 Sync direction 2: LSQ to auto-created Work Item

An inbound lead on a channel with a clear owner creates a follow-up Work Item for that
owner. Confirmed: WhatsApp Inbound creates a task for the WhatsApp Marketer. The
other 18 sources are not mapped yet.

### 10.3 Sync mechanics

Webhook if LSQ provides one, otherwise a BullMQ polling job at a fixed interval. Leads are
upserted on lsqLeadId  so repeats are harmless. Each run records lastSyncedAt , and

failures are logged and shown in the Data Center.

### 10.4 Data hygiene (Data Center)

Automatic checks: missing campaign tag, missing source, duplicate leads (same phone),
unmapped profile, stale status (for example Not Contacted for more than 5 days), missing
owner, sync failures. Shown as one health score (for example 98.2% healthy) plus a
resolvable issue list.

### 10.5 Access

Marketing Head: full. Team Lead: view only, own profiles. Team Member: hidden.

## 11. Reporting

Every report is a saved Report Definition rendered from the same live tables the
dashboard reads. Nothing is compiled by hand.

| Report | Cadence | Recipients | Scope |
| --- | --- | --- | --- |
| Weekly Marketing Report | Monday 8:00am | Marketing Head, Business Head | Org-wide, by profile |
| Monthly Performance Scorecard | Last day of month | CEO, Marketing Head, Business Head | Org-wide |
| Creative Production Report | Friday 6:00pm | Marketing Head, Creative Manager | By department |
| Lead Funnel and CPL Report | Monday 9:00am | Marketing Head, Performance Marketer | By profile and campaign |
| Team Performance Digest | 1st of month | Marketing Head | Org-wide, by person |
| Campaign Deep-Dive | On demand | Marketing Head, campaign owner | Single campaign |

The Reports and Automation screen lists these with a manual Generate Now.

## 12. Screens

### 12.1 The 14 screens

| # | Screen | Route | Who | What it does |
| --- | --- | --- | --- | --- |
| 1 | Login and Profile selection | /login | All | Sign in, resolve role, set default profile from profileAccess (All or last used) |
| 2 | Team Dashboard | /dashboard | Admin, Head, Executive, Team Lead | Sections in 12.2. Every card is clickable (Executive is read-only) |

| # | Screen | Route | Who | What it does |
| --- | --- | --- | --- | --- |
| 3 | My Work | /my-work | Admin, Head, Team Lead, Team Member | Today, Overdue, Upcoming. One-click Start, Submit, Request Help, Mark Blocked (Hidden for Executive). Creative Head works from 'Waiting for my approval' |
| 4 | Monthly Marketing Calendar | /calendar | All | Month, Week, Campaign and Owner views over work item deadlines. Gets a Content Tracker view (Social view and Design view) replacing the team's sheets, with stage status, date, owner chips, and quick-add row. Each item opens its detail |
| 5 | Projects / Campaigns | /campaigns | Head, Executive, Team Lead | Campaign list: goal, budget and spend, progress, status. Filter by profile and status |
| 6 | Project Detail | /campaigns/:id | Head, Executive, Team Lead | Tabs: Overview (traceability chain, budget pace), Tasks, Creatives, Leads |
| 7 | Single Work Detail | /work/:id | All (scoped) | Shows a sequential stage stepper (stages, links, outputs, history). Tabs in 12.3. Revision flag and blocker state shown inline (Executive is read-only) |
| 8 | Feedback and Revision History | /feedback | Head, Executive, Team Lead | Every open feedback thread and every flagged revision pattern. Creative Head works from 'Waiting for my approval' queue |
| 9 | Team Workload | /workload | Head, Executive, Team Lead | Grouped by department: workload %, band, open tasks, avgRevisions |
| 10 | Todo and Priorities | /todo | All | Overdue, Today, Upcoming by role scope. Empty state reads as clarity |

| # | Screen | Route | Who | What it does |
| --- | --- | --- | --- | --- |
| 11 | Issues and Blockers | /issues | Head, Executive, Team Lead | Open blockers and revision flags, with Notify and Classify Reason inline |
| 12 | Lead Funnel | /leads | Head, Executive, Team Lead (view) | 12-stage funnel, target vs actual qualified leads, CPL and CPQL, source mix over 19 sources |
| 13 | Data Center / LSQ | /data-center | Head, Executive, Team Lead (view) | Health score and issue list |
| 14 | Reports and Automation | /reports | Head, Executive, Team Lead | Scheduled reports with Generate Now, automation rules with active or paused switch (Executive view only) |

After login (RootRedirect): Admin, Marketing Head, Executive, and Team Lead land on /dashboard, Team Member on /my-work.

### 12.2 Team Dashboard sections (top to bottom)

1. Monthly Marketing Target: revenue, leads, qualified, budget vs actual (Head edits the target here)
2. KPI strip: planned, completed, in progress, at risk, blocked, pending feedback, overdue, each opening its filtered list
3. Today's Priorities table
4. Creative Production stats and output trend (plus pipeline counts: pieces by stage, waiting approval, needs owner, behind schedule)
5. Campaign Progress list
6. Team Workload
7. Lead Funnel snapshot
8. Issues and Blockers
9. Recent Activity

### 12.3 Work Detail tabs and stage stepper

The single Work Detail page (/work/:id) features a visual **stage stepper** across the top showing the piece's stages in sequence (Script/Content, Shoot, Edit, Post, Design), the active stage, links to stage deliverables (content doc link, assets link, published link), and history.
Tabs below the stepper: Overview, Brief, Files, Feedback, Activity, Performance, Related Leads.

### 12.4 Global filter and navigation chain

One filter bar: Profile (7 plus All), Department (7), Owner (anyone visible to the viewer),
Campaign (within profile scope), Date or month, Status. Navigation runs Business, Profile,
Department, Team Member, Project, Individual Work, Feedback, Result, clickable at every
step.

### 12.5 Content Tracker (Calendar screen view)

The **Content Tracker** is a dedicated table view on the Calendar screen (/calendar) that replaces Sheet A (SM CONTENT) and Sheet B (per-brand design sheets):
- **Views:**
  - **Social view:** Posting Date, Topic, Type, Script (status, date, owner), Shoot (status, date, owner), Edit (status, date, owner), Approval (status, date, by), Published Date, Posting Owner, Turnaround, Remarks.
  - **Design view:** ID, Date, Requirement, Content link, Assets link, Deadline, Designer, Status, Approval.
- **Controls & Filters:**
  - Brand filter (replaces the brand tabs from Sheet B).
  - Filters: Brand, month, type, owner, stage status, Needs owner, Waiting approval, Overdue, Blocked.
  - Quick-add row at the top, allowing fast inline piece creation like typing in the sheet.
  - Clicking any row opens the piece with its sequential **stage stepper**, links, outputs, and history.
- **Tracker Access Matrix:**
  - Admin, Marketing Head, SM Manager: All pieces across their assigned brands.
  - Creative Head: All pieces across their brands (since they approve review stages).
  - Other Team Leads: Pieces where at least one of their team members owns a stage.
  - Executive: All pieces across all brands, read-only.
  - Team Members: No tracker access. They see their assigned stage items in My Work with input links from previous stages.

## 13. Permissions and API

### 13.1 Permission keys

| Key | Admin | Marketing Head | Executive | Team Lead | Team Member |
| --- | --- | --- | --- | --- | --- |
| portal.view (universal portal read access) | Yes | Yes | Yes | No | No |
| people.view (read people directory, masked email/phone) | Yes | Yes | Yes | No | No |
| work.create (any profile in scope / own team) | Yes | Yes | No | Yes | No |
| work.request (ask a Team Lead for work) | Yes | Yes | No | Yes | Yes |
| work.update.own | Yes | Yes | No | Yes | Yes |
| assignment.override | Yes | Yes | No | Yes | No |
| feedback.give (approve, request revision) | Yes | Yes | No | Own team | No |
| feedback.respond | Yes | Yes | No | Yes | Yes |
| revision.classify | Yes | Yes | No | Yes | No |
| campaign.manage | Yes | Yes | No | Own team | No |
| target.manage | Yes | Yes | No | No | No |
| target.view | Yes | Yes | Yes | Yes | No |
| lead.view | Yes | Full | Full | Own profiles | No |
| datacenter.view | Yes | Yes | Yes | Yes (view) | No |
| analytics.team | Yes | Full | Full | Own team | Own stats |
| report.view | Yes | Yes | Yes | Own team | No |
| report.configure , automation.manage | Yes | Yes | No | No | No |
| user.approve (approve/reject access requests) | Yes | No | No | No | No |
| user.manage (create, invite, suspend, reactivate, set roles, reset pwd) | Yes | No | No | No | No |
| people.assign (edit dept, jobRole, profileAccess, reportsTo, capacity) | Yes | Yes (TL & Member only) | No | No | No |
| reference.manage (manage reference data) | Yes | No | No | No | No |

Admin has all permission keys (derived from PERMISSION_KEYS array, so future keys are included automatically).
Work actions taken by Admin are recorded in ActivityEvent with actingAs: 'admin'. Both Admin and Executive are excluded from
auto-assignment, workload % calculations, and performance reports.
Executive role is strictly read-only: holds `portal.view`, `people.view`, `target.view`, `lead.view`, `datacenter.view`, `analytics.team`, `report.view`, and receives HTTP 403 on all POST, PATCH, PUT, and DELETE routes. In the People Directory, contact details (email and phone) are omitted for executive callers. Only Admin can grant or approve the executive role; Marketing Head cannot modify or grant executive accounts.

#### Content Flow Access Matrix (from CONTENT_FLOW.md §10)

| Action | Admin | Marketing Head | SM Manager | Creative Head | Other team lead | Member | Executive |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create or edit a content piece | Yes | Yes | Yes | No | No | No | No |
| Assign or reassign stage owners | Yes | Yes | Yes | No | No | No | No |
| Change due dates, skip a stage | Yes | Yes | Yes | No | No | No | No |
| Work a stage and forward it | Yes | Yes | Yes | Yes | Yes | Own stages | No |
| Approve or request revision | Yes | Yes | No | Yes | No | No | No |
| Post and mark Published | Yes | Yes | Yes | No | No | Own Post stage | No |
| See the Tracker | Yes | Yes | Yes | Yes | Own people's pieces | No | Read-only |
| Set work preferences | Yes | Yes | No | No | No | No | No |

*Approver rule (default):* A review stage can be approved only by a team lead whose job role is Creative Manager (TL) (Creative Head), the Marketing Head, or Admin. The SM Manager assigns across departments but does not approve.

### 13.2 API catalog (all routes scoped by resolveScope )

| Module | Routes |
| --- | --- |
| auth | login, logout, refresh, me, set-password, switch profile, force-logout |
| accessRequests | submit (public), list (admin), approve (admin), reject (admin) |
| people | list, create/invite (admin), update (admin / head for TL & member operational fields), suspend (admin), reactivate (admin), reset-password (admin) |
| referenceData | profiles, departments, job roles, enums (admin manage) |
| targets | list by month, create or update |
| campaigns | list, detail, create, update, tasks, creatives, leads |
| workItems | list, detail, create, update, recommend-owner, assign, transition, block, unblock, submit, files, calendar |
| feedback | thread by work item, add entry, cross-item history |
| revisionFlags | list, classify |
| blockers | list, create, resolve, notify |
| leads | list, funnel, source mix, metrics, data-center health and issues, resolve issue |
| automation | list rules, toggle, run log |
| reports | list definitions, create, generate now, view |
| dashboard | summary, KPI lists |
| notifications | list, mark read |
| activity | by entity, recent |

## 14. Reference data

Profiles (7): HACA, HACA Mideast, HACA Marketing School, HACA Marketing School EN,
HACA Design School, HACA Design School EN, HACA Tech School.

Departments (7): Design, Video Production, Social Media, SEO & Content, WhatsApp,
Performance Marketing, Tech.

Job roles (13): SEO Specialist, Social Specialist, UI Designer, Writer, Developer, Social
Media Manager, Designer, Video Editor, Creative Manager (TL), Design Lead (TL), YouTube
Strategist, WhatsApp Marketer, Performance Marketer.

Design School programs: AI Integrated Graphic Design, UI/UX Design + AI, Creative
Design & Communication, AI Integrated Video Editing Mastery, Branding & Identity Online
Program.

Work types (14): Reel, Ad Creative, Landing Page, Carousel, Post, Blog, Email, WhatsApp
Blast, Ad Set, YouTube Short/Video, SEO Audit, Copy, Video Ad, Internal Report.

Statuses: Not Started, In Progress, Feedback, Pending, Blocked, Approved, Published
(Overdue computed).

Priorities: High, Medium, Low. Campaign status: In Progress, At Risk, Completed.

Expected outcomes: Lead Generation, Brand Awareness, Engagement, SEO Ranking,
Nurture, Conversion, Reactivation, Ops.

Blocker reasons (9): Waiting for feedback, Waiting for content, Waiting for data, Technical
issue, Dependency, Client/business approval, Resource issue, Unclear requirement,
Other.

Revision root causes (7): Brief unclear, Creative direction unclear, Skill gap, Feedback
inconsistency, Excessive scope change, TL approval delay, Client/business requirement
changed.

Lead sources (19): SMM YouTube, SMM Instagram, Online Campaigns (SMM), Facebook
Lead Ads, Social Media Re-engaged Leads, Meta Re-Engaged Leads, Google Ads, Inbound
Phone Calls, WhatsApp Reactivation, WhatsApp Inbound, Student Referral, Staff Referral,
SEO, PR, Website Leads, Offline Campaigns, Walk-in, Outbound Phone Calls,
Workshops/Webinars.

Funnel stages (12): listed in section 10.1.

## 15. Conversion from HACA FORGE

Before anything changes, tag the current build ( forge-v1-final ) so nothing is lost and
any retired module can be recovered later.

### 15.1 Reuse as is (infrastructure)

Monorepo and tooling, Node 22, Express 5, MongoDB and Mongoose, Zod, CASL, JWT
cookie auth with the invite and set-password flow, BullMQ and Redis, event bus,
Socket.io, mailer adapter, Pino, Cloudinary signed upload (for the Files tab), glass UI
components, Vitest setup, CI.

### 15.2 Change

| FORGE | Becomes |
| --- | --- |
| User and 8 role keys | Person with 5 roles (admin, marketing_head, executive, team_lead, team_member), job role, department, profileAccess[], reportsToIds[], capacity (jobRole/dept/capacity optional for admin/executive) |
| CASL abilities and permission keys | New permission keys (13.1) plus profile scoping through resolveScope |
| Campaign (optional, basic) | Campaign with goal, budget, spend, target link, status, progress |
| Task and ContentItem | Work Item (one owner, campaign required, 14 types, brief, effort, timeline) |
| Hold reasons (7, editable) | Blocker with 9 fixed reasons and dependency owner |
| Review decisions and revisionCount | Feedback Entry rounds, revision flag, root cause, escalation |
| Least-loaded auto-assign (silent) | Recommendation with reason, override log, 85% filter, deadline fit, avgRevisions tiebreak |
| Workload (over 100% overload) | Bands under 65, 65 to 85, over 85 |
| Scheduled jobs (reminders, digest, capacity gap) | Automation Rule registry with the rules in section 9 |
| 6 reports and scheduled reports | 6 Report Definitions in section 11 |

| FORGE | Becomes |
| --- | --- |
| 4 production teams, 5 requester department types | 7 departments and 13 job roles |
| Role dashboards | Team Dashboard, My Work, Todo |
| Notification module | Same module, rebuilt around the events in 6.5 |

### 15.3 Retire from the product (not in the specification)

Request intake, triage and dynamic request forms. Requester roles (dept_lead, dept_staff), sm_manager, viewer.
(NOTE: `admin` role, the public Request Access flow, and the admin Users and Access Requests pages are KEPT as Admin-only onboarding enablers and adapted in Phase 1).
Legacy roles `management` and `viewer` map to `executive` (active status, all 7 profiles, empty reportsTo), while `dept_lead` and `dept_staff` map to `suspended`.
Calendar bulk import and clash detection. Content publishing queue. Pipeline templates and automatic
stage handoffs. Shoot planner. Time tracking, timesheets and leave. File library (DAM) and
Performance Ads dashboard. Video review studio and version compare. Master data
editor and audit log screens (reference data is fixed and seeded).

Code stays in the tagged branch, not in the new build.

### 15.4 Data

| Data | Plan |
| --- | --- |
| Users | Map to Person (10 keys): admin to admin; head and lead to marketing_head; team_lead to team_lead; worker and sm_manager to team_member; management, dept_lead, dept_staff, viewer to suspended and printed in the report. Applied to all 36 existing users. Active TeamAssignment records converted to Person.reportsToIds[]. Overrides supported via scripts/migration-overrides.json by email. |
| Teams and departments | Map graphics to Design, cinematography and editor to Video Production, content to SEO & Content. Add Social Media, WhatsApp, Performance Marketing, Tech |
| Requests, ContentItems, Tasks, Deliverables | Recommended: do not migrate. Export to an archive and start with a clean operational database, because the old model has no profile, campaign or target |

| Data | Plan |
| --- | --- |
| Existing profile data | Everything in the new system is created with a Profile, so a starting profile is needed for any carried-over record (decision in section 17) |

## 16. Build plan

Each phase ends with passing tests and a demo of its screens before the next begins.
Phases build on each other, so the order matters.

| Phase | Scope | Screens delivered | Done when |
| --- | --- | --- | --- |
| 0 | Tag and archive FORGE, remove retired modules from routes and navigation, keep infrastructure | None | App builds and logs in with retired modules gone |
| 1 | Reference data, Profiles, Departments, Person with profileAccess and reportsToIds, resolveScope , profile switcher, people setup | 1 and people setup | A user only ever receives data for profiles they hold, proven by tests |
| 2 | Monthly Target, Campaign upgrade, traceability enforcement | 5, 6 | A campaign cannot save without a target, and a work item cannot save without a campaign |
| 3 | Work Item core, statuses, brief, files, activity | 3, 4, 7 (Overview, Brief, Files, Activity), 10 | One-click status actions work, and Overdue is computed |
| 4 | Auto-assignment recommendation, override log, workload and bands, avgRevisions | 9 | Recommendation shows its reason, and overrides are logged |

| Phase | Scope | Screens delivered | Done when |
| --- | --- | --- | --- |
| 5 | Feedback rounds, revision flag, root cause, escalation, blockers with notification | 7 (Feedback), 8, 11 | A flagged item reaches the Head after 48 hours unclassified, and a blocker notifies the dependency owner |
| 6 | Global filter bar, Team Dashboard, KPI drill-down | 2 | Changing Profile updates every section at once, and each KPI opens its list |
| 7 | Automation rule registry, notifications, 6 report definitions, Reports and Automation screen | 14 | Rules can be paused, reports generate on schedule and on demand |
| 8 | LSQ: Lead model, sync, funnel and metrics, Data Center, inbound-to-task, attribution | 12, 13, 7 (Performance, Related Leads) | Funnel numbers reconcile with the weekly sync tracker |
| 9 | Five performance dimensions, hardening, QA | None new | All role and profile access tests pass and numbers match fixtures |

Phase 8 depends on LSQ access, so start that conversation in parallel with Phase 1.

## 17. Assumptions, open decisions and specification gaps

### 17.1 Decisions the specification already lists (section 16 of the spec)

| Item | Working default |
| --- | --- |
| LSQ webhook or batch only | Polling job until a webhook is confirmed |
| Lead source to role mapping | WhatsApp Inbound to WhatsApp Marketer only. The other 18 sources create no tasks until mapped |
| Revision threshold | +1 over personal baseline or 4, 48-hour unclassified escalation |

| Item | Working default |
| --- | --- |
| Overdue escalation | Owner at once, Team Lead after 4 hours |
| Weekly capacity hours per role | Flat 40 hours until given |
| Campaign type templates | Rule 8 is not built (V1.1) |

### 17.2 Gaps found in the specification

| Gap | Proposed handling |
| --- | --- |
| No screen for entering Monthly Targets, but a campaign cannot exist without one | Edit target inside the Team Dashboard target section (Head only), no new screen |
| Team Lead report access: access table says view own team's scheduled reports, screen list says Marketing Head only | Follow the access table: Team Lead views own team's reports, read-only |
| Data Center: Team Lead is view only, but the issue list is described as resolvable | Head resolves, Team Lead sees |
| Where spend comes from (needed for CPL and CPQL) | Manual entry on the Campaign by Head or owner |
| Revenue actual for the Monthly Target | Source undefined, needs a decision |
| 'Pending' status has no definition | Treated as waiting, not blocked |
| Who publishes, and who marks Published | Owner or reviewer after Approved |
| How an LSQ lead is attributed to a specific work item | Key undefined (for example a campaign tag or UTM). Needed before leadsGenerated can be filled |
| Inbound lead task has no work type, and a work item needs a campaign | Needs a follow-up work type and a rule for the campaign (lead's own campaign, or a standing inbound campaign) |
| Who may log in: CEO and Business Head | Email recipients only |
| Is there an Admin role | Yes. 4-role model: Admin is the system owner outside marketing hierarchy. Admin holds all permissions (derived), manages user accounts, invites, access requests, role assignments, passwords, and reference data. Marketing Head manages operational fields only (people.assign). |

| Gap | Proposed handling |
| --- | --- |
| Team Member 'request work via TL' | Small request record sent to the Team Lead, no workflow beyond it |
| Report format and delivery | HTML email with an in-app view, format to confirm |
| Timezone for scheduled rules | To confirm |
| Work type to department mapping | Proposed in 8.3, needs sign-off |

### 17.3 Questions for the Marketing Head

1. Is the request intake from other departments removed completely in V1?

2. Do the CEO and Business Head log in, or only receive emails?

3. Which profile do any carried-over records belong to?

4. Does LSQ offer a webhook, and who provides API access?

5. Where do budget, spend and revenue actuals come from?

6. Weekly capacity hours per job role.

7. Confirm the revision, escalation and overdue numbers.

8. Lead source to department mapping for the other 18 sources.

9. How leads are attributed to a work item.

### 17.4 Content Flow decisions and proposed defaults (CONTENT_FLOW.md §13)

| # | Question | Proposed Default |
| --- | --- | --- |
| 1 | Who is the Creative Head? | A team lead with job role Creative Manager (TL), plus Marketing Head and Admin |
| 2 | Who shoots? There is no job role for it | Anyone with the Shoot work preference |
| 3 | Is Poster the same as Static Post? | Yes |
| 4 | Which types have a Post stage? | Reel, Static Post, Carousel Post, Story, Poster (table in CONTENT_FLOW §3.3) |
| 5 | Does Meta Ad Creative hand off to the performance team? | Not built. Final done only |
| 6 | Program-video reels: need a shoot, or edit only? | Both variants (B with shoot, C edit only) |
| 7 | Which profile is 'HACA UAE', and what is the fifth tab? | HACA UAE maps to HACA Mideast. Fifth tab to confirm |
| 8 | Standing campaign per brand per month for every piece? | Yes |
| 9 | How is Turnaround (Days) counted? | Published date minus the first stage start date |
| 10 | Do other departments also request designs (the Custom Request type)? | No. The SM Manager enters them |
| 11 | Is Rejected a revision request, not a final rejection? | Yes (revision required, goes back to owner, counted) |
| 12 | Can the SM Manager approve? | No (assigns across departments, but does not approve) |
| 13 | Default due-date offsets in section 6 | As listed in CONTENT_FLOW §6 |
| 14 | Import of the existing sheet rows? | Not built. Start fresh from the new month |

Parked / Out of scope for Content Flow (CONTENT_FLOW.md §14): CV Status, Date and Owner (parked and NOT included), shoot day planning, bulk import, time tracking, requests from other departments, rich-text editing (content stays in Zoho Writer / Google Docs, linked), video player with timestamped comments.

## 18. Out of scope for this version

Leaderboard and best-performer recognition, content repurposing, campaign templates
and auto task structure, dependency mapping and downstream-impact view, Weekly
Marketing Meeting Mode, and every FORGE module listed in 15.3.