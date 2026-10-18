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
| Roles | 8 | 3 (Marketing Head, Team Lead, Team Member) |
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
Calendar, Projects/Campaigns, Project Detail, Single Work Detail, Feedback & Revision
History, Team Workload, Todo & Priorities, Issues & Blockers, Lead Funnel, Data
Center/LSQ, Reports & Automation

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
| marketing head _ | Marketing Head | Head of Marketing | Org-wide, all profiles by default |

| Role key | Spec name | Typical people | Breadth |
| --- | --- | --- | --- |
| team lead _ | Team Lead | Creative Manager, Design Lead and other leads | Own team (direct reports and department), within assigned profiles |
| team member _ | Team Member | Designers, writers, editors, specialists | Self only, within assigned profiles |

Role sets breadth. Profile access sets which brands that breadth applies to. Example: a
Team Lead scoped to HACA Design School has Team Lead breadth for that profile only.

### 5.2 Capability matrix (from the specification)

| Capability | Marketing Head | Team Lead | Team Member |
| --- | --- | --- | --- |
| Profiles visible | All by default | Assigned profiles | Assigned profiles |
| People visible | Everyone | Own team (direct reports and department) | Self only |
| Dashboard scope | Org-wide KPIs, all campaigns | Team KPIs, team's campaigns | Personal priorities only |
| Create and assign work | Yes, any profile in scope | Yes, own team | No, can request via Team Lead |
| Override auto- assignment | Yes | Yes | No |
| Approve and give feedback | Yes | Yes, own team's work | No, can respond to feedback |
| Classify revision root cause | Yes | Yes | No |
| Team performance analytics | Full | Own team only | Own stats only |
| Lead Funnel, LSQ, Data Center | Full | View only, own profiles | Hidden |
| Reports and Automation config | Full | View own team's scheduled reports | Hidden |

| Capability | Marketing Head | Team Lead | Team Member |
| --- | --- | --- | --- |
| OKR and Targets entry | Yes | View only | Hidden |

### 5.3 Profile access

profileAccess[]  is a list on each Person. The Marketing Head defaults to all profiles.

A person with several profiles lands on All or on their last-used profile.

Changing the Profile filter changes every section of the screen at once.

### 5.4 Team membership

A Team Lead sees direct reports plus their department, within profile access. Carried
over from the earlier role plan: a Team Member can report to more than one Team Lead
( reportsToIds[] ), set by the Marketing Head. Any of a member's leads can assign work

to, review and see that member.

### 5.5 Enablers (needed to run the system, not product features)

People setup: the Marketing Head creates people and sets department, job role,
access role, profile access, weekly capacity and reporting leads. Login reuses the
existing invite and set-password flow.

No separate Admin role in V1. The Marketing Head holds setup powers. Decision
pending (section 17).

CEO and Business Head are report recipients by email, not users, unless the Head
decides otherwise.

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

Nine entities come from the specification (Profile, Person, Campaign, Work Item,
Feedback Entry, Blocker, Lead, Automation Rule, Report Definition). Records marked (S)
are supporting records that the specification's own rules require.

Profile (7 fixed values): id , name . A filter dimension, not a tenant.

Department (7 fixed values): id , name .

Person

| Field | Notes |
| --- | --- |
| name, email, status | status: invited, active, suspended |
| jobRole | One of 13 fixed job titles (section 14) |
| departmentId | FK to Department |
| role | marketing head, team lead, team member. Team _ _ _ Lead breadth is granted by isTL (role is team lead) _ |
| profileAccess[] | List of Profile ids. Drives all scoping |
| reportsToIds[] (S) | Team Leads this person reports to |
| weeklyCapacityHours | Used for workload % |
| lastProfileId (S) | Last-used profile filter |
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

Work Item (the atomic unit; every screen is a view over this table and its feedback)

| Field | Notes |
| --- | --- |
| title, type | 14 types (section 14) |
| profileId, campaignId, ownerId | Campaign is required |
| departmentId | Derived from owner, stored for fast filtering |
| priority | High, Medium, Low |
| status | Not Started, In Progress, Feedback, Pending, Blocked, Approved, Published. Overdue is computed |
| channel, expectedOutcome | expectedOutcome: Lead Generation, Brand Awareness, Engagement, SEO Ranking, Nurture, Conversion, Reactivation, Ops |

| Field | Notes |
| --- | --- |
| estimatedEffortHrs, actualEffortHrs | Feed workload and auto-assignment |
| deadline | Date |
| brief | objective, audience, message, cta, platform, deliverable, successMetric, reference |
| relatedOKR, relatedTarget | Inherited from the campaign, read-only |
| files[] (S) | Uploaded files or links, for the Files tab |
| createdAt, assignedAt, startedAt, submittedAt, approvedAt, publishedAt | Full timeline, feeds turnaround reporting |
| leadsGenerated, qualifiedLeads | Filled after publishing via LSQ attribution |
| revisions | Derived: number of rounds marked Revision Required |

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
| In Progress | Feedback | Owner | Submit. Sets submittedAt |
| Feedback | Approved | Reviewer (Head, or Team Lead of the owner) | Feedback entry with roundStatus Approved. Sets approvedAt |

| From | To | Who | Rule |
| --- | --- | --- | --- |
| Feedback | In Progress | Reviewer | roundStatus Revision Required. Owner must respond before the next round |
| Approved | Published | Owner or reviewer (assumed) | Sets publishedAt |
| Any open status | Blocked | Owner | Reason required (8.6) |
| Blocked | Previous status | Owner or Team Lead | Resolves the blocker |
| In Progress | Pending | Owner | Assumed meaning: waiting, but not a blocker |

### 8.3 Auto-assignment

Triggered when a Work Item is created without an owner.

1. Filter candidates: right department for the work type, workloadPct  below 85%, and

enough unallocated capacity before the deadline for estimatedEffortHrs .

2. Rank: lowest workloadPct  first, then lowest avgRevisions , then earliest availability.

3. Show, never assign silently: 'Recommended Owner: [Name]. Reason: lowest current

workload ([X]%) + suitable skill + available bandwidth.'

4. The Head or Team Lead may override before the work item is created. Every override is

logged in AssignmentOverride (who, from whom, to whom) so the rule can be tuned.

Proposed work type to department mapping (the specification only confirms Reel to
Video Production, so this table needs sign-off):

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
| 2 | Team Dashboard | /dashboard | Head, Team Lead | Sections in 12.2. Every card is clickable |

| # | Screen | Route | Who | What it does |
| --- | --- | --- | --- | --- |
| 3 | My Work | /my-work | All | Today, Overdue, Upcoming. One-click Start, Submit, Request Help, Mark Blocked |
| 4 | Monthly Marketing Calendar | /calendar | All | Month, Week, Campaign and Owner views over work item deadlines. Each item opens its detail |
| 5 | Projects / Campaigns | /campaigns | Head, Team Lead | Campaign list: goal, budget and spend, progress, status. Filter by profile and status |
| 6 | Project Detail | /campaigns/:id | Head, Team Lead | Tabs: Overview (traceability chain, budget pace), Tasks, Creatives, Leads |
| 7 | Single Work Detail | /work/:id | All (scoped) | Tabs in 12.3. Revision flag and blocker state shown inline |
| 8 | Feedback and Revision History | /feedback | Head, Team Lead | Every open feedback thread and every flagged revision pattern, to triage in one place |
| 9 | Team Workload | /workload | Head, Team Lead | Grouped by department: workload %, band, open tasks, avgRevisions |
| 10 | Todo and Priorities | /todo | All | Overdue, Today, Upcoming by role scope. Empty state reads as clarity |

| # | Screen | Route | Who | What it does |
| --- | --- | --- | --- | --- |
| 11 | Issues and Blockers | /issues | Head, Team Lead | Open blockers and revision flags, with Notify and Classify Reason inline |
| 12 | Lead Funnel | /leads | Head, Team Lead (view) | 12-stage funnel, target vs actual qualified leads, CPL and CPQL, source mix over 19 sources |
| 13 | Data Center / LSQ | /data-center | Head, Team Lead (view) | Health score and issue list |
| 14 | Reports and Automation | /reports | Head (Team Lead views own team's scheduled reports) | Scheduled reports with Generate Now, automation rules with active or paused switch |

After login: Head and Team Lead land on /dashboard , Team Member on /my-work .

### 12.2 Team Dashboard sections (top to bottom)

1. Monthly Marketing Target: revenue, leads, qualified, budget vs actual (Head edits the

target here)

2. KPI strip: planned, completed, in progress, at risk, blocked, pending feedback, overdue,

each opening its filtered list

3. Today's Priorities table

4. Creative Production stats and output trend

5. Campaign Progress list

6. Team Workload

7. Lead Funnel snapshot

8. Issues and Blockers

9. Recent Activity

### 12.3 Work Detail tabs

Overview, Brief, Files, Feedback, Activity, Performance, Related Leads.

### 12.4 Global filter and navigation chain

One filter bar: Profile (7 plus All), Department (7), Owner (anyone visible to the viewer),
Campaign (within profile scope), Date or month, Status. Navigation runs Business, Profile,
Department, Team Member, Project, Individual Work, Feedback, Result, clickable at every
step.

## 13. Permissions and API

### 13.1 Permission keys

| Key | Head | Team Lead | Member |
| --- | --- | --- | --- |
| work.create (any profile in scope / own team) | Yes | Yes | No |
| work.request (ask a Team Lead for work) | Yes | Yes | Yes |
| work.update.own | Yes | Yes | Yes |
| assignment.override | Yes | Yes | No |
| feedback.give (approve, request revision) | Yes | Own team | No |
| feedback.respond | Yes | Yes | Yes |
| revision.classify | Yes | Yes | No |
| campaign.manage | Yes | Own team | No |
| target.manage | Yes | No | No |
| target.view | Yes | Yes | No |
| lead.view | Full | Own profiles | No |
| datacenter.view | Yes | Yes (view) | No |
| analytics.team | Full | Own team | Own stats |
| report.view | Yes | Own team | No |
| report.configure , automation.manage | Yes | No | No |

| Key | Head | Team Lead | Member |
| --- | --- | --- | --- |
| people.manage , reference.manage (enablers) | Yes | No | No |

### 13.2 API catalog (all routes scoped by resolveScope )

| Module | Routes |
| --- | --- |
| auth | login, logout, refresh, me, set-password, switch profile |
| people | list, create (invite), update, suspend |
| referenceData | profiles, departments, job roles, enums |
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
| User and 8 role keys | Person with 3 roles, job role, department, profileAccess[], reportsToIds[], capacity |
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

Request intake, triage and dynamic request forms. Requester roles ( dept_lead ,

dept_staff ), sm_manager , viewer , admin . Public Request Access flow. Calendar bulk
import and clash detection. Content publishing queue. Pipeline templates and automatic
stage handoffs. Shoot planner. Time tracking, timesheets and leave. File library (DAM) and
Performance Ads dashboard. Video review studio and version compare. Master data
editor and audit log screens (reference data is fixed and seeded).

Code stays in the tagged branch, not in the new build.

### 15.4 Data

| Data | Plan |
| --- | --- |
| Users | Map to Person: admin and lead to marketing head, team lead to team lead, _ _ _ worker and sm manager to team member. _ _ Requester and viewer accounts are not migrated unless the Head decides otherwise |
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
| Is there an Admin role | No. Marketing Head holds people and reference setup |

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

## 18. Out of scope for this version

Leaderboard and best-performer recognition, content repurposing, campaign templates
and auto task structure, dependency mapping and downstream-impact view, Weekly
Marketing Meeting Mode, and every FORGE module listed in 15.3.