# Project context: HACA Marketing OS (V1 Team Workspace)

One system where the HACA marketing team plans, assigns, produces, approves and reports marketing work, with LSQ
lead data shown next to that work. Source of truth: docs/HACA-Marketing-OS-Build-Spec.pdf and docs/PROJECT_REPORT.md.
If this file and the specification disagree, stop and ask.

## Scope rule
Build ONLY what the specification defines. Do not re-add retired HACA FORGE modules (request intake and triage,
requester roles, pipeline templates and handoffs, shoot planner, time tracking, leave, file library, performance ads,
video review studio, calendar import, master-data editor, audit log screens). They live in git tag forge-v1-final.
Ignore docs/archive/. It describes the retired FORGE product.
Out of scope for V1: leaderboard, content repurposing, campaign templates and auto task structure, dependency
mapping, Weekly Marketing Meeting Mode. Do not add features, screens or fields that the specification does not need.

## Architecture
One centralized system. Profile (brand) is a FILTER dimension on shared data, never a separate database or tenant.
Every core document carries profileId. Permissions are enforced at the QUERY layer using the user's profileAccess[].

## Roles (exact keys)
marketing_head, team_lead, team_member. Role sets breadth; profileAccess[] sets which brands it applies to.
- marketing_head: all profiles by default, everyone, org-wide dashboard, creates and assigns work in any profile in
  scope, overrides auto-assignment, approves and gives feedback, classifies revision root cause, full analytics, full
  Lead Funnel and Data Center, full Reports and Automation, enters OKR and Targets, manages people and reference data.
- team_lead: assigned profiles, own team (direct reports via reportsToIds plus same department), team KPIs, creates
  and assigns work for own team, overrides auto-assignment, approves own team's work, classifies root cause, own-team
  analytics, Lead Funnel and Data Center view only for own profiles, views own team's scheduled reports, views targets.
- team_member: assigned profiles, self only, personal priorities, cannot create or assign (can request work via a Team
  Lead), responds to feedback, own stats only, Lead Funnel/Data Center/Reports/Targets hidden.
- No Admin role. CEO and Business Head are report recipients by email, not users.
- A team_member may report to several team leads (reportsToIds[]). Any of them may assign to, review and see that member.

## Reference data (fixed, seeded)
Profiles (7): HACA, HACA Mideast, HACA Marketing School, HACA Marketing School EN, HACA Design School, HACA Design School EN,
HACA Tech School.
Departments (7): Design, Video Production, Social Media, SEO & Content, WhatsApp, Performance Marketing, Tech.
Job roles (13): SEO Specialist, Social Specialist, UI Designer, Writer, Developer, Social Media Manager, Designer, Video Editor,
Creative Manager (TL), Design Lead (TL), YouTube Strategist, WhatsApp Marketer, Performance Marketer.
Programs: AI Integrated Graphic Design, UI/UX Design + AI, Creative Design & Communication, AI Integrated Video Editing Mastery,
Branding & Identity Online Program.
Work types (14): Reel, Ad Creative, Landing Page, Carousel, Post, Blog, Email, WhatsApp Blast, Ad Set, YouTube Short/Video,
SEO Audit, Copy, Video Ad, Internal Report.
Priorities: High, Medium, Low. Campaign status: In Progress, At Risk, Completed. Goal types: Leads, Reactivations, Enrollments.
Expected outcomes: Lead Generation, Brand Awareness, Engagement, SEO Ranking, Nurture, Conversion, Reactivation, Ops.
Blocker reasons (9): Waiting for feedback, Waiting for content, Waiting for data, Technical issue, Dependency,
Client/business approval, Resource issue, Unclear requirement, Other (free text only here).
Revision root causes (7): Brief unclear, Creative direction unclear, Skill gap, Feedback inconsistency, Excessive scope change,
TL approval delay, Client/business requirement changed.
Lead sources (19): SMM YouTube, SMM Instagram, Online Campaigns (SMM), Facebook Lead Ads, Social Media Re-engaged Leads,
Meta Re-Engaged Leads, Google Ads, Inbound Phone Calls, WhatsApp Reactivation, WhatsApp Inbound, Student Referral,
Staff Referral, SEO, PR, Website Leads, Offline Campaigns, Walk-in, Outbound Phone Calls, Workshops/Webinars.
Funnel stages (12): Total Leads, Not Contacted, Not Answered, Interested, Qualified Leads, Call Back, Payment Received,
Not Interested, Not a Potential, Not Answered (Multiple), Reconnected, Not Eligible.

## Core model
Entities: Profile, Department, Person, MonthlyTarget, Campaign, WorkItem, FeedbackEntry, RevisionFlag, Blocker,
AssignmentOverride, Lead, AutomationRule, ReportDefinition, ActivityEvent, Notification, WorkRequest.
- Traceability is enforced at creation: Campaign requires targetId (MonthlyTarget) and relatedOKR. WorkItem requires
  campaignId. relatedOKR and relatedTarget are copied from the campaign and are read-only on the work item. No orphans.
- Person: jobRole, departmentId, role, profileAccess[], reportsToIds[], weeklyCapacityHours (default 40), lastProfileId.
  Derived: workloadPct = sum(estimatedEffortHrs of open owned work items) / weeklyCapacityHours; avgRevisions = rolling
  90 days.
- WorkItem statuses: Not Started, In Progress, Feedback, Pending, Blocked, Approved, Published. Overdue is COMPUTED
  (deadline passed and status not Approved or Published). It is never stored and never a transition target.
- Transitions: Not Started to In Progress (owner); In Progress to Feedback (owner submits); Feedback to Approved or back to
  In Progress (reviewer, roundStatus Approved or Revision Required); Approved to Published (owner or reviewer); any open
  status to Blocked (owner, reason required) and back; In Progress to Pending and back (owner).
- All status changes go through ONE transition service that checks permission and scope, sets the timeline timestamps and
  writes an ActivityEvent. No direct status writes elsewhere.

## Business rules
- Auto-assignment (work item created without an owner): candidates in the department for the work type, workloadPct below 85,
  enough unallocated capacity before the deadline. Rank by lowest workloadPct, then lowest avgRevisions, then earliest
  availability. NEVER assign silently: return the recommendation and its reason. Head or Team Lead may override before
  creation. Every override is logged in AssignmentOverride (who, from, to).
- Workload bands: Healthy below 65, High 65 to 85, Overloaded above 85.
- Feedback: each round has the reviewer entry (roundStatus) and, if revision was required, the owner's response (isResponse)
  before the next round. revisions = number of rounds marked Revision Required. History is never overwritten.
- Revision flag: revisions exceed the owner's own rolling avgRevisions by more than 1, or reach 4, whichever comes first. Team
  Lead classifies root cause. Escalate to Marketing Head when a flag is unclassified for more than 48 hours, or the same
  person is flagged 2 or more times in a rolling 30 days. Never link performance data to incentives.
- Blockers: owner marks Blocked with a reason. For Waiting for content, feedback or data the owner MUST name the dependency
  owner, who is notified immediately (not the requester).
- LSQ is read-authoritative: no route may create or edit a lead's status. CPL = spend / ad leads, CPQL = spend / qualified
  leads, Qualified Lead % = qualified / total.
- Performance has five dimensions (Output, Efficiency, Quality, Collaboration, Business impact). Not 'tasks completed'.
  No leaderboard and no cross-person ranking UI.

## Automation rules (AutomationRule records, active or paused)
month_end_report (last day 11:59pm), overdue_escalation (owner at once, Team Lead after 4 hours), todo_escalation (no status
change for N days), blocker_dependency_alert, revision_pattern_flag, lsq_live_sync, weekly_report (Monday 8:00am).
Campaign task auto-structure is V1.1 and NOT built.

## Reports (ReportDefinition records)
Weekly Marketing Report (Mon 8:00), Monthly Performance Scorecard (last day), Creative Production Report (Fri 18:00), Lead
Funnel and CPL Report (Mon 9:00), Team Performance Digest (1st of month), Campaign Deep-Dive (on demand).

## Screens (14) and routes
/login, /dashboard, /my-work, /calendar, /campaigns, /campaigns/:id, /work/:id, /feedback, /workload, /todo, /issues, /leads,
/data-center, /reports. Plus enablers: People setup (/people) and a generic filtered Work list (/work) for drill-down.
Head and Team Lead land on /dashboard, Team Member on /my-work.

## Working assumptions (until the Marketing Head decides; change here when decided)
- Pending status means waiting but not blocked. Published is set by the owner or a reviewer after Approved.
- Monthly Targets are edited inside the Team Dashboard target section by the Head. Spend is entered manually on the Campaign.
- Team Lead views own team's scheduled reports read-only; Head resolves Data Center issues.
- Migrated users get access to all profiles until the Head edits them. Capacity is a flat 40 hours until given per role.
- Work type to department: Video Production (Reel, Video Ad, YouTube Short/Video), Design (Ad Creative, Carousel, Landing Page),
  Social Media (Post), SEO & Content (Blog, Email, Copy, SEO Audit), WhatsApp (WhatsApp Blast), Performance Marketing (Ad Set,
  Internal Report).
- At Risk KPI: open item due within 3 days that is Not Started, Pending or Blocked.
- Only the WhatsApp Inbound source creates a task automatically (to the WhatsApp Marketer).
- Report timezone comes from env REPORT_TIMEZONE.
