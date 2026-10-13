# Project context: Marketing Workflow and Content Management Portal

An internal portal for a company marketing function. Other departments raise work requests, the social media
team plans a content calendar, and four production teams deliver the work. Every piece of content is tracked
from idea to publication. Management gets dashboards and reports. The full specification is in
docs/Marketing_Portal_Architecture_and_Specification.pdf and docs/roles-and-features.md. If this file and the
specification disagree, stop and ask.

## Production teams
Content (scripts, captions, copy), Graphics (posters, carousels, ad creatives), Cinematography (shoots,
footage), Editor (video editing, reels, exports).

## Work sources (requesting departments)
- Social Media (SM Managers): monthly or weekly content calendar
- Performance (Ads): ad creatives, A/B variants
- Sales (Sales Lead): offer posters, brochures, product and pitch videos
- Academics (Academics Lead or Performance Lead): course creatives, webinar posters, academic videos
- Others: any other marketing requirement

## Roles (keep these exact keys)
admin, lead, team_lead, worker, sm_manager, dept_lead, dept_staff, viewer
- Worker's team (content, graphics, cinematography, editor) comes from team membership and skills, not from the role key.
- Reviewer and approver duties belong to lead (team_lead only if delegated). Admin can override, always audited.
- Single common login for everyone. New users use "Request Access"; only admin approves; invite email with
  a set-password link (expires in 48 hours). Google OAuth logs in already-approved users only.
- Migration of old roles: editor -> worker, member -> dept_staff.

## Core model
- Request: raised by a requester from a source department. Lead triages: accept, reject, ask info, convert.
- ContentItem: the main tracked unit (one post, reel, ad creative, brochure). Has a format, source department,
  campaign, platforms, publish date, auto-calculated production deadline, status, and a pipeline of stage tasks.
- PipelineTemplate per format. Completing a stage creates and assigns the next team's task automatically.
  - Static post or poster: Content -> Graphics -> Review -> Approved -> Scheduled -> Published (lead time 3 days)
  - Carousel: Content -> Graphics -> Review -> Approved -> Scheduled -> Published (4)
  - Story: Content -> Graphics or Editor -> Review -> Approved -> Scheduled -> Published (2)
  - Reel or video: Content (script) -> Cinematography (shoot) -> Editor -> Review -> Approved -> Scheduled -> Published (7)
  - Ad creative: Content (ad copy) -> Graphics or Editor -> Review -> Handed to Performance -> Live (4)
  - Brochure or sales material: Content -> Graphics -> Review -> Delivered to Sales (5)
  - Academic or webinar creative: Content -> Graphics or Editor -> Review -> Delivered to Academics (4)
- Statuses
  - Request: Submitted, Under Triage, Accepted, Rejected, Needs Info, Converted
  - ContentItem: Planned, Brief Ready, In Production, In Review, Changes Requested, Approved, Scheduled, Published
    (ads: Live, Paused, Retired)
  - Task: Assigned, In Progress, Submitted, Changes Requested, Approved, Done
  - On Hold and Blocked exist on any level and require a reason code.
- Every status transition is written to StatusHistory (entity, from, to, user, reason, timestamp). This powers
  all bottleneck and efficiency reports.
- Visibility: dept_lead sees all requests of their department; dept_staff see only their own; requesters never
  see internal tasks or workload.
- Only sm_manager marks content Published. Only the lead (or delegated reviewer) approves or requests changes.
  Only the requester confirms final output.
- Shoot Planner groups several video content items into one shoot day; marking a shoot Done releases footage
  to the Editor queue.
- Reports: department, team, individual, content, bottleneck, management scorecard. Efficiency score default
  weights: on-time 40%, first-pass approval 30%, speed vs estimate 20%, volume and utilization 10% (configurable).
