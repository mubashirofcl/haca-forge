# Project context: HACA Marketing OS (V1 Team Workspace)

One system where the HACA marketing team plans, assigns, produces, approves and reports marketing work, with LSQ
lead data shown next to that work. Source of truth: docs/HACA-Marketing-OS-Build-Spec.pdf and docs/PROJECT_REPORT.md.
If this file and the specification disagree, stop and ask.

## Scope rule
Build ONLY what the specification defines. Do not re-add retired HACA FORGE modules (request intake and triage,
requester roles, pipeline templates and handoffs, shoot planner, time tracking, leave, file library, performance ads,
video review studio, calendar import, master-data editor, audit log screens). They live in git tag forge-v1-final.
Keep the public Request Access flow and access-request admin as an Admin-only enabler.
Ignore docs/archive/. It describes the retired FORGE product.
Out of scope for V1: leaderboard, content repurposing, campaign templates and auto task structure, dependency
mapping, Weekly Marketing Meeting Mode. Do not add features, screens or fields that the specification does not need.

## Architecture
One centralized system for HACA. HACA is the single organisation; there is no profile or brand dimension.

## Roles (exact keys)
admin, creative_head, executive, sm_manager, team_member.
- admin: system owner outside the marketing hierarchy. Has EVERY permission key (derived from PERMISSION_KEYS).
- creative_head: authoritative creative and people ops permissions snapshot, approves plans and outputs.
- executive: portal.view, people.view and read-only view keys but zero write keys.
- sm_manager: plans, creates individual work, imports calendar rows, coordinates deliverables.
- team_member: personal priorities, delivers stages, views own assigned tasks.

## Creative Calendars (5 Calendars)
Creative Calendar (/calendar) organizes deliverables into five stable calendars: `sm` (SM), `sales` (Sales Team), `ads` (Ads Team), `academics_management` (Academics and Management), and `other` (Other), each with its distinct color. Calendar plans require a `calendar` key. The row field `forTeam` is removed; all rows belong to the parent plan's calendar.

## Automation rules (AutomationRule records, active or paused)
month_end_report (last day 11:59pm), overdue_escalation (owner at once, Team Lead after 4 hours), todo_escalation (no status
change for N days), blocker_dependency_alert, revision_pattern_flag, lsq_live_sync, weekly_report (Monday 8:00am).
Campaign task auto-structure is V1.1 and NOT built.

## Reports (ReportDefinition records)
Weekly Creative Report (Mon 8:00), Monthly Performance Scorecard (last day), Creative Production Report (Fri 18:00), Lead
Funnel and CPL Report (Mon 9:00), Team Performance Digest (1st of month), Campaign Deep-Dive (on demand).

## Screens and routes
/login, /dashboard, /my-work, /calendar, /work/:id, /feedback, /workload, /issues, /reports, /settings.
Creative Head and SM Manager land on /dashboard, Team Member on /my-work.
