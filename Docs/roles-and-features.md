# Marketing Workflow Portal: Roles and Features

Built on the existing **Media Manager** codebase (React + Vite + TypeScript, Express 5, MongoDB, Socket.io, Cloudinary). Reference model for project and status handling: **Zoho Projects**.

---

## 1. Roles Overview

| Role | Purpose |
|---|---|
| **Admin** | Overall control: users, access approval, roles, settings, audit, all reports |
| **Marketing Manager / Lead** | Triage requests, create projects, assign work, **review and approve deliverables**, team reports |
| **Worker** (Editor, Designer, Writer...) | Receives tasks, updates status, logs time, uploads work |
| **Requester** (other departments) | Raises requests, tracks status, confirms final output |
| *Management / Viewer* (optional) | Read-only dashboards and reports for higher authorities |

**Notes**
- There is no separate Reviewer/Approver role. Review and approval is a Lead permission.
- Admin can override in emergencies (always logged) but is not part of the normal approval flow.
- Role migration from existing code: `editor` → `worker`, `member` → `requester`, new `lead`.

---

## 2. Authentication and Access

- **One common login page** for all roles. After login, the user is redirected to their role's dashboard.
- **Request Access** button on the login page for new users.

### Request Access Flow
1. User submits: name, work email, phone, department, requested role, skill type (for Workers), reason. No password at this stage.
2. Request is saved as `Pending`. Admin is notified.
3. Admin can **Approve** (edit role, team, skills, capacity), **Reject** (with reason), or **Ask for info**.
4. On approval, the account is created and an invite email with a **set-password link** (expires in 48 hours) is sent.
5. User sets a password and logs in.
6. Pending or rejected users see a status message when they try to log in.

### Access Rules
- Only Admin can approve users, and only Admin can grant Lead or Admin roles.
- Block duplicate emails and repeat requests while one is pending.
- Rate-limit and add captcha on the public request endpoint.
- Optional company email domain allowlist.
- Google OAuth logs in only already-approved users and never auto-creates accounts.
- Admin can suspend, reactivate, change role, reset password, and force logout.
- First Admin is created by a seed script using a password from `.env`, never a default password.

---

## 3. Admin

**Menu:** Dashboard · Access Requests · Users · Teams & Departments · Master Data · Reports · Audit Log · Settings

### Dashboard
- Pending access requests (badge count)
- Users by role, active vs. suspended
- Total requests, projects, tasks system-wide
- Company-wide on-time rate and overdue count
- Recent activity feed

### Features
- **Access requests:** review, approve (edit role, team, skills, capacity), reject with reason, ask for info, bulk approve
- **User management:** view, edit, change role, suspend/reactivate, reset password, force logout, deactivate
- **Teams and departments:** create teams, assign Leads, map requester departments
- **Master data:** request types and dynamic form fields, statuses, priorities, hold/block reasons, platforms, SLA times, project templates
- **Permission settings:** adjust what each role can do
- **Notification settings:** email templates, daily digest timing
- **Audit log:** role changes, deletions, approvals, status overrides, with filters and export
- **Override:** reassign, change status, or approve in emergencies (logged)
- **Data tools:** export data

### Reports
All reports across all teams and projects, with export and scheduling.

### Notifications
New access request, user suspended, SLA breach summary, system alerts.

---

## 4. Marketing Manager / Lead

**Menu:** Dashboard · Request Inbox · Projects · Tasks · Workload · Review Queue · Calendar · Reports · Team

### Dashboard
- New requests waiting for triage
- Tasks due today / this week / overdue
- Blocked and on-hold items
- Items waiting for review
- Team workload (planned hours vs. capacity)
- Project health cards (On Track / At Risk / Delayed)
- Upcoming milestones

### Request Inbox (Triage)
- All incoming requests with filters (department, type, priority, deadline)
- Accept, reject (with reason), or ask requester for info
- Set priority and deadline, merge duplicates
- Convert to a Project (from template) or a single task
- Bulk triage for weekly/monthly batches

### Project Management
- Create projects from scratch, template, or request
- Set owner, members, dates, budget hours, priority
- Task lists/phases and milestones
- Views: Overview, Board, List, Gantt, Calendar, Files, Activity, Reports
- Put on hold (reason required), archive, clone
- Auto-calculated project health

### Tasks and Assignment
- Create, edit, bulk edit tasks and subtasks
- Assign to a worker with skill match and current load shown
- Collaborators, estimates, dependencies, recurring tasks
- Reassign by drag-and-drop from the Workload view
- Overload warning and leave-aware suggestions
- Re-prioritize and change deadlines (requester is notified)

### Workload View
- Per person: open tasks, planned vs. capacity hours, leave status
- Weekly capacity planner

### Review and Approval
- Review queue sorted by deadline
- Video player with **timestamped comments** and version comparison
- Approve, request changes, or reject
- Send approved work to the Requester for final confirmation
- Release/publishing queue per platform (YouTube, Instagram, Facebook, LinkedIn)
- Revision count per task

### Team
- Worker list with skills, workload, attendance
- Approve timesheets
- Worker performance summaries

### Reports (own team and projects)
Project status, turnaround time, time in each status, hold/block analysis, workload and utilization, worker performance, content output, overdue/SLA breaches, planned vs. actual hours.

### Notifications
New request, task blocked, deadline at risk, submission ready for review, requester feedback, worker on leave.

### Cannot Do
Manage users or roles, approve access requests, change system settings, see other teams' data.

---

## 5. Worker (Editor, Designer, Writer...)

**Menu:** My Dashboard · My Tasks · Calendar · Timesheet · Files · Profile

### Dashboard
- Today's tasks, due this week, overdue, blocked
- Hours logged this week
- Pending revisions (changes requested)
- Personal stats: completed, on-time %, revision rate

### My Tasks
- Views: Board, List, Calendar
- Filters: priority, project, platform, due date
- Task detail: description, brief, reference files, subtasks, deadline, project, comments
- **Status flow:** Assigned → In Progress → In Review (submit) → Changes Requested → Done
- **Mark blocked / on hold** with required reason code (alerts the Lead)
- Tick subtasks and checklists
- Request a deadline extension (Lead approves)

### Doing the Work
- Upload deliverables with versions (v1, v2...), video up to 500MB
- Attach external links (e.g. draft YouTube link)
- Submit for review with notes
- View review feedback and timestamped comments, fix and resubmit

### Collaboration
- Real-time task chat and @mentions

### Time Tracking
- Start/stop timer or manual entry per task
- Weekly timesheet submitted to Lead

### Attendance
- Mark present or on leave (visible to Lead)

### Reports
Own stats only: completed tasks, on-time rate, revisions, hours.

### Notifications
New assignment, deadline tomorrow/overdue, feedback received, mention, task re-prioritized.

### Cannot Do
Assign tasks, create projects, approve work, see other workers' stats or other teams' tasks, access admin pages.

---

## 6. Requester (Other Departments)

**Menu:** Dashboard · New Request · My Requests · Approvals · Profile

### Dashboard
- My requests by status (Submitted, In Progress, Waiting for me, Delivered)
- Items waiting for my approval or info
- Recent updates

### Raising a Request
- Choose type (poster, video, content, social, other); the form adapts to the type
- Fields: title, description, platform, size/duration, reference files, deadline, priority, campaign/event
- Save as draft, use saved templates, repeat a past request
- Recurring request setup (weekly/monthly)

### Tracking
- Status timeline: Submitted → Accepted → In Progress → In Review → Delivered
- Expected delivery date
- Assigned person's name visible (optional setting) and Lead
- Comments to Lead (clarifications, extra files)
- Cancel request before work starts

### Approval
- Preview the final deliverable
- **Confirm** or **Request changes** (with comments); rework goes back to the Lead
- Download approved files

### Rejected / Needs Info
- Reason shown, with a button to edit and resubmit

### Reports
Own request history, turnaround times, count by type.

### Notifications
Request accepted/rejected, info needed, status change, ready for confirmation, delivered.

### Cannot Do
See tasks, workers' workload, other departments' requests, or any internal project data.

---

## 7. Management / Viewer (Optional, Read-Only)

### Dashboard
Total requests, on-time %, overdue count, project health breakdown, department-wise demand, utilization, top bottlenecks.

### Reports
- **Work-based:** requests by status/type/department/priority, turnaround time, time in each status, hold/block reasons, SLA breaches, planned vs. actual
- **Worker-based:** tasks completed, on-time rate, rework rate, utilization, efficiency score
- **Content-based:** output by type and platform, weekly/monthly trend, approval rate, review cycles
- Filters, saved reports, export (PDF/Excel/CSV), scheduled email reports

### Cannot Do
Edit anything.

---

## 8. Permission Matrix

| Capability | Admin | Lead | Worker | Requester |
|---|:-:|:-:|:-:|:-:|
| Approve new users | ✅ | ❌ | ❌ | ❌ |
| Manage roles and settings | ✅ | ❌ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ | ❌ |
| Submit requests | ✅ | ✅ | ❌ | ✅ |
| Triage requests, create projects | ✅ | ✅ | ❌ | ❌ |
| Assign / reassign tasks | ✅ | ✅ | ❌ | ❌ |
| Update task status | ✅ | ✅ | own tasks | ❌ |
| Review and approve work | override | ✅ | ❌ | final confirm |
| Upload deliverables | ✅ | ✅ | ✅ | ❌ |
| Log time | ❌ | ❌ | ✅ | ❌ |
| Approve timesheets | ✅ | ✅ | ❌ | ❌ |
| View reports | all | own team | own | own |

---

## 9. Shared Modules

### Request Intake
Dynamic forms by type, templates, recurring requests, auto request ID (e.g. `MKT-2026-0142`), duplicate detection, attachments.

### Project and Task Engine (Zoho-style)
Projects, task lists/phases, milestones, tasks, assignable subtasks, dependencies, recurring tasks, custom fields, templates, Kanban/List/Gantt/Calendar views.

### Status Workflow
Configurable statuses per project type. Default: Backlog → Assigned → In Progress → In Review → Changes Requested → Approved → Released, plus On Hold and Blocked (reason required). Transition rules control who can move what. Every transition is saved in a status history with time, user, and reason.

### Review and Release
Versioned deliverables, timestamped comments, approve/changes/reject, revision counter, publishing calendar by platform.

### Collaboration
Task chat (Socket.io), threaded comments with @mentions, project activity feed, file library with versions.

### Notifications
In-app, email, daily digest, optional WhatsApp/Slack.

### Automation
Rule examples: notify requester on approval, alert Lead when a task is overdue by a day, auto-create tasks from a template when a request is accepted, recurring request generation, deadline reminders.

### Reports and Analytics
Work-based, worker-based, and content-based reports. Filters, saved reports, PDF/Excel/CSV export, scheduled emails. Bottleneck analysis uses status history and hold reason codes.

---

## 10. Data Model Changes

**New collections:** `AccessRequest`, `Project`, `TaskList`, `Milestone`, `Request`, `StatusHistory`, `TimeEntry`, `Comment`, `Deliverable` (with versions), `Template`, `AutomationRule`, `AuditLog`, `Department`, `CustomFieldDefinition`.

**Update `User`:** role enum `['admin', 'lead', 'worker', 'requester']`, add `status` (active/suspended), `mustSetPassword`, `lastLogin`, `skills[]`, `capacity`, `department`.

**Update `Task`:** add `projectId`, `listId`, `dependencies`, `estimate`, `holdReason`, `collaborators`, `revisionCount`.

**Merge:** `Submission` + `Content` → `Deliverable`.

---

## 11. Fixes Needed in the Current Codebase

| Issue | Fix |
|---|---|
| Many routes are only "Authenticated" (delete team, create team, delete task, seed) | Add permission middleware per route; remove `/tasks/seed` in production |
| Public `/api/auth/register` | Remove or lock; use Request Access flow |
| No project entity | Add Project → Task List → Task → Subtask |
| No status history | Add `StatusHistory` |
| Two comment systems (embedded + chat) | Keep chat for live talk; comments in a separate collection |
| `Feedback.userId` String, `Submission.user_email` | Use ObjectId refs |
| Default seeded credentials and sample JWT secret | Generate strong secrets; no default admin password |
| Node v25 | Use Node 22 LTS |

---

## 12. Suggested Build Order

1. **Foundation:** permission middleware, new roles, Request Access flow, `Project` and task lists, security fixes
2. **Intake and assignment:** Request module, Lead inbox, workload view, status history
3. **Execution:** configurable statuses, dependencies, time tracking, recurring tasks, file versions
4. **Reports:** dashboards, bottleneck and efficiency reports, exports, scheduled emails
5. **Advanced:** Gantt, automation rules, multi-step approvals, custom fields, templates, publishing queue
