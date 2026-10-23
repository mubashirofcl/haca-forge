# Role-Based Fix Plan: HACA Marketing OS

*Built from PROJECT\_DOCUMENTATION.md (the current status) and the agreed plan: PROJECT\_REPORT, CONTENT\_FLOW, HACA-only scope and five roles. Prepared 23 October 2026.*

**How to read this:** I reviewed the documentation, not the code. Items marked **Verify** are suspected from what the documentation says and must be confirmed in the code first (Pass 0). Priorities: **P0** breaks daily use, **P1** breaks a rule or is a security risk, **P2** is cleanup.

## 1. Status in one page

**Solid, according to the documentation:** five roles with CASL permissions, `resolveScope` on every query, the Target to Campaign to Work Item rule, the work item state machine with the approver and self-approval guards, auto-assignment with an override log, feedback rounds, revision flags, blockers with dependency alerts, the 9-section dashboard, the LSQ funnel and Data Center (on mock data), 7 automation rules, 6 reports, the Executive read-only lock, and 211 passing API tests.

**Not built:** ContentPiece and the Content Tracker (your real SM workflow), My Account editing and the first-login step, the role cards, HACA-only mode, and any role-based UI tests.

**Wrong or risky:** every user is logged out after 15 minutes, several permissions don't match the plan, some reference data isn't the agreed list, and one LSQ path edits leads.

## 2. Findings

### A. Session and security

| ID | Finding | Why it matters | Roles | Priority | Action |
| --- | --- | --- | --- | --- | --- |
| A1 | The web client never refreshes an expired access token (GAP-03, SEC-01) | Everyone is logged out every 15 minutes | All | **P0** | One shared refresh-and-retry queue in `apiFetch`. If refresh fails, go to /login and return to the same page after sign-in |
| A2 | Socket connections are accepted when authentication fails (SEC-02) | Anyone can hold open sockets | All | P1 | Reject the handshake |
| A3 | Production cookies use SameSite=None with the web app and API on different sites | Browsers may drop them, and CSRF exposure widens | All | P1 Verify | Serve app and API on one registered domain (app. and api.), SameSite=Lax, set COOKIE\_DOMAIN, check Origin on state-changing requests |
| A4 | `docs/USERS_AND_PASSWORDS.md` and a documented demo password are in the repo | Credentials in git history | Admin | P1 | Remove from git, git-ignore it, rotate every password, demo seed refuses production, password only from env |
| A5 | Reports 'Generate Now' accepts `campaign.manage` | Team leads can email reports. The plan says Head and Admin only | Team Lead | P1 | Require `report.configure` only |
| A6 | Data Center 'resolve' writes `profileId` and `leadSource` on a lead | Breaks the rule that LSQ data is read-only | Head | P1 | Replace with acknowledge-with-note on a data issue |
| A7 | DELETE exists for targets and campaigns | Can orphan work items and break traceability | Head, Admin | P1 Verify | Block when children exist, archive instead |
| A8 | A marketing\_head may edit other marketing\_head accounts (only admin and executive are protected) | Heads can change each other | Head | P2 Verify | Protect admin, executive and marketing\_head |
| A9 | No change-password endpoint. Password rule is 8 characters only. No documented rate limit on forgot-password | Weak account hygiene | All | P2 | Add change password, require 8+ with an uppercase letter and a number, rate limit forgot-password |
| A10 | Swagger is open outside production | API surface visible in staging | Admin | P2 | Admin only outside local development |
| A11 | Access-request alerts go only to `ADMIN_SEED_EMAIL` | Missed requests if that mailbox changes | Admin | P2 | Notify every active admin |

### B. Permissions and workflow rules

| ID | Finding | Why it matters | Roles | Priority | Action |
| --- | --- | --- | --- | --- | --- |
| B1 | The feedback read endpoints need `analytics.team` or `portal.view`, which members lack | Members cannot read revision notes on their own work | Member | **P0** Verify | Let the owner and the reviewers read their own item's thread |
| B2 | POST /api/work accepts `work.request`, which members hold. No WorkRequest record exists in the data model | Members may create work directly, or have no way to ask a lead for work | Member | **P0** Verify | Add WorkRequest (to a team lead). Members cannot create work items |
| B3 | Only the Creative Head, Head and Admin can approve. Other team leads cannot approve standalone work | A Design Lead cannot approve their own team's non-content work | Team Lead | P1 Decision | Team lead of the owner approves standalone items. Content stages stay with the Creative Head |
| B4 | PATCH /api/work/:id uses `work.update.own` for all fields | A member might edit deadline, priority, effort or brief | Member | P1 Verify | Field-level rules: members edit actual effort, links and deliverable only |
| B5 | People over 85% are ranked last, not excluded | An overloaded person can still be recommended | Team Lead, Head | P1 Verify | Exclude them. If nobody qualifies, say why |
| B6 | Workload percentage is capped at 100 | Hides how overloaded someone is | Team Lead, Head | P2 | Show the real number, cap only the bar |
| B7 | `revisions` rises when the owner restarts rework, not when the reviewer records Revision Required | Counts and flags can be wrong | Team Lead, Head | P1 Verify | Count Revision Required rounds |
| B8 | Performance endpoints may not limit a team lead to their own team | Could leak performance data | Team Lead | P1 Verify | Scope through `resolveScope` |
| B9 | Team leads lack `people.view` | Owner pickers and team views may not work for them | Team Lead | P2 Verify | Give them a masked, scoped list of their own team |
| B10 | The WhatsApp inbound task creates a fallback campaign with no `targetId` (GAP-04) | The sync fails and the traceability rule is broken | Head | P1 | Use the lead's campaign, or a standing 'Inbound Leads' campaign attached to the month's target |
| B11 | Only three BullMQ workers are listed | Overdue, todo and revision escalations and the weekly and month-end reports may run only when triggered by hand | Head | P1 Verify | Register repeatable jobs and show the last run |

### C. People, My Account and onboarding

| ID | Finding | Why it matters | Roles | Priority | Action |
| --- | --- | --- | --- | --- | --- |
| C1 | Person has no phone, avatar, `profileCompletedAt` or `lastLoginAt`, though Request Access asks for a phone | The phone number is collected and lost | All | P1 | Add the fields |
| C2 | My Account exists as both a modal and a page, and cannot edit name, phone or photo | Duplicate and read-only | All | P1 | Keep the page, remove the modal |
| C3 | There is no first-login /welcome step | New users start with an incomplete profile | All | P1 | Add the step |
| C4 | There is no role card on My Account | No role has a personal summary | All | P1 | Add the five role cards |
| C5 | No UI to edit work preferences | Auto-assign by stage cannot be set up | Admin, Head | P1 Verify | Add it to the People dialog |
| C6 | No forgot-password link on the login page | Locked-out users need an admin | All | P2 Verify | Add the flow |

### D. Data compared with the agreed plan

| ID | Finding | Why it matters | Roles | Priority | Action |
| --- | --- | --- | --- | --- | --- |
| D1 | Profiles in the documentation are haca, creative, tech, digital, kids, aviation, corporate | Not the agreed list | All | P1 | HACA only. Other profiles inactive |
| D2 | Departments include `offline_ops` and have no Tech department | Not the agreed list | All | P1 | The seven agreed departments |
| D3 | HACA-only mode is not applied | Brand pickers and filters still show | All | P1 | Apply the single-brand patch |
| D4 | Campaign goalType and expectedOutcome values differ from the agreed lists. expectedOutcome and channel belong on the work item | Forms and reports use the wrong values | Head, Team Lead | P1 | Align |
| D5 | WorkItem lacks channel, expectedOutcome, the brief object, actualEffortHrs, the timeline timestamps, leadsGenerated and qualifiedLeads. Blocker fields are duplicated on the work item | Turnaround and briefs cannot work | All | P1 Verify | Add them and remove the duplication |
| D6 | Work types are '15 design types and Reel' | Non-design departments (Blog, Email, WhatsApp Blast, Ad Set, SEO Audit, Landing Page, Internal Report) may be unable to create work | WhatsApp, SEO, Performance | P1 Verify | Add the standard types |
| D7 | Lead has no `campaignId` or `workItemId`, and Campaign stores manual `leadsActual` | Per-campaign funnel, CPL and attribution cannot work | Head, Team Lead | P1 | Add the links and derive the actuals |
| D8 | LSQ keys are missing from `env.js` (GAP-05) | The live sync cannot start | Head | P2 | Add the keys, keep mock as the default |

### E. Features not built

| ID | Finding | Priority | Action |
| --- | --- | --- | --- |
| E1 | ContentPiece and the stage pipelines (GAP-01) | P1 | Build per CONTENT\_FLOW.md (Phase 5b) |
| E2 | Content Tracker view on the Calendar (GAP-02) | P1 | Tab on /calendar, Social and Design views |
| E3 | Assign stages table | P1 | Part of Phase 5b |
| E4 | 'Waiting for my approval' queue for approvers | P1 Verify | Tab in Feedback and Revisions, plus My Work for approvers |
| E5 | Request Work button for members | P1 Verify | Goes with B2 |

### F. Quality and hygiene

| ID | Finding | Priority | Action |
| --- | --- | --- | --- |
| F1 | The web app has one smoke test | P1 | Add role-based UI tests (route guards, hidden controls, empty states) |
| F2 | No end-to-end test per role | P1 | Playwright journeys for each role |
| F3 | Legacy `/api/calendar` and the CalendarEntry model are unused (GAP-06) | P2 | Retire |
| F4 | Legacy `/api/admin/users/*` routes and one-off scripts (`seed-demo.js`, `clean-database.js`, `migrate-user-to-person.js`, `migrate-legacy-roles.js`) | P2 | Retire once the migration is final |
| F5 | The repo lives in an OneDrive Desktop folder | P2 | Move it out (for example C:\\dev). Syncing node\_modules and .git causes slowness and corruption |
| F6 | The documentation disagrees with itself (22 versus about 25 permission keys, phase numbering) | P2 | Regenerate it from the code at the end |

## 3. Role by role: the portal each person should get

### 3.1 Admin

- **Lands on:** /dashboard
- **Menu:** Dashboard, Campaigns, Calendar (with Tracker), Work, Reviews, Issues, Workload, Leads, Data Center, Reports and Automation, People, **Access Requests (with a count badge)**, My Account
- **Daily flow:** review Access Requests (approve with role, job role, department, work preferences, reports-to and capacity, or reject, or ask for info), invite or create users, suspend, reactivate, reset a password or force a logout, watch the dashboard. Any work action is allowed and logged as Admin.
- **Never:** appears in workload or in assignment recommendations.
- **Fixes:** A4, A9, A10, A11, C1 to C5, B10.

### 3.2 Marketing Head

- **Lands on:** /dashboard
- **Menu:** Dashboard, Campaigns, Calendar (with Tracker), Work, Reviews, Issues, Workload, Leads, Data Center, Reports and Automation, People (operating fields only), My Account
- **Daily flow:** set the monthly target on the dashboard, review campaigns, watch Overdue, Blocked and Flags, approve when needed, classify revision causes, pause or run automation rules, Generate Now, edit people's department, job role, work preferences, reports-to and capacity.
- **Cannot:** create or suspend users, change roles, or touch admin, executive or other head accounts.
- **Fixes:** A5, A6, A7, A8, B10, B11, C5.

### 3.3 Executive

- **Lands on:** /dashboard
- **Menu:** the same screens as the Head, read-only. No My Work, no Access Requests. People is masked (no email or phone).
- **Daily flow:** read the dashboard, target versus actual, the funnel, reports (view and print), the Tracker, and individual performance.
- **Cannot:** change anything. The UI hides every control, and the API returns 403 on every write.
- **Fixes:** a route-table test that every write returns 403 for this role, a read-only Tracker, Generate Now hidden, role card (C4).

### 3.4 Team Lead

- **Lands on:** /dashboard
- **Menu:** Dashboard, My Work, Campaigns, Calendar (with Tracker), Work, Reviews, Issues, Workload (own team), Leads (view), Data Center (view), Reports (own team, view), My Account
- **Daily flow:** create campaigns for their scope, create work with the recommendation card, override with a reason, give feedback on their team's work, classify revision causes, resolve blockers, watch workload.
- **Cannot:** set targets, create users, Generate Now, or see other teams.
- **Variant SM Manager** (job role Social Media Manager): Tracker, quick-add row and Assign stages. Assigns across departments. **Does not approve.**
- **Variant Creative Head** (job role Creative Manager (TL)): 'Waiting for my approval' queue. Approves or requests revisions on content, script, design and edit. **Does not assign.**
- **Fixes:** A5, B3, B5, B8, B9, E1 to E4.

### 3.5 Team Member

- **Lands on:** /my-work
- **Menu:** My Work, Todo, Calendar (own items), Notifications, My Account. No Campaigns, Workload, Reports, Leads or People.
- **Daily flow by stage:**

| Their stage | What they do | What they hand over |
| --- | --- | --- |
| Content or Script (Writer) | Write in Zoho or Google Docs | Doc link, then Submit for approval |
| Design | Design | Assets link, then Submit for approval |
| Shoot | Shoot | Footage link, then Done and forward |
| Edit | Edit | Video link, then Submit for approval |
| Post | Publish | Published link and date |

- **Always:** Start, Pending, Blocked (with reason and dependency owner), Request Help, **Request Work** (to a team lead), reply to feedback.
- **Fixes:** B1, B2, B4, C1 to C4, E5.

## 4. Workflows end to end

| # | Flow | Steps and who does them | Fix |
| --- | --- | --- | --- |
| 1 | Onboarding | Candidate submits Request Access (department, job role, requested role, reason). **Admin** approves with the final role, job role, department, work preferences, reports-to and capacity. Invite email (48 hours). The person sets a password, completes **/welcome** (name, phone, photo), and lands on their home screen | A9, A11, C1, C3, C5 |
| 2 | Plan the month | **Head** sets the monthly target. **Team Lead or Head** creates campaigns with the OKR and the target. **SM Manager** adds content pieces and assigns the stages | D4, B10, A7, E1 to E3 |
| 3 | Create and assign work | A lead creates the work item under a campaign. The system shows the recommendation with its reason. The lead accepts or overrides with a reason. The owner is notified | B5, B6, D5, D6 |
| 4 | Do the work | **Member** starts, then submits for approval or clicks Done and forward. The next stage unlocks and its owner is notified | B1, B4, E1 |
| 5 | Review | **Creative Head** approves, or requests a revision with a note. The member replies and resubmits. The fourth revision raises a flag. A lead or the Head classifies the cause. Unclassified for 48 hours, it reaches the Head | B3, B7, E4 |
| 6 | Blockers | **Member** marks Blocked with a reason and the person they are waiting on, who is notified. In content pieces the previous stage's owner is suggested | E1 |
| 7 | Publish and measure | **Posting owner** publishes and enters the link and date. Turnaround is calculated. LSQ leads attach to the campaign for funnel and CPL | D7, D8, A6, B10 |
| 8 | Report | Automation rules run and build the reports. **Head or Admin** can Generate Now. Recipients get the email, and executives can read it in the app | A5, B11 |

## 5. Fix passes

Do each pass in a **new conversation**, then commit and tag it (`mos-fix-pass-N-done`).

| Pass | Name | Items | Done when |
| --- | --- | --- | --- |
| 0 | Verify (read-only) | Every item marked Verify | `docs/ROLE_FIX_VERIFICATION.md` lists each as Confirmed, Partly or Not an issue, with file and line evidence |
| 1 | Session and security | A1 to A11, B10, D8 | The app refreshes silently after the token expires. Unauthenticated sockets are rejected. A team lead gets 403 on Generate Now. No route can edit a lead. Deleting a campaign with work items is refused. The credentials file is out of git. The WhatsApp task never creates a campaign without a target |
| 2 | Permissions and workflow rules | B1 to B9, B11, E4, E5 | A member reads and replies to the thread on their own item. A member cannot create work but can request it. Field-level edit rules hold. Overloaded people are never recommended. Revisions count rounds. Escalation jobs are scheduled and show their last run |
| 3 | People, My Account and onboarding | C1 to C6 | Every role can edit name, phone and photo and change the password. The five role cards show. /welcome appears once. Admin and Head can edit work preferences. Forgot password works |
| 4 | Data corrections and HACA only | D1 to D7, F6 | Only HACA is active. The seven agreed departments exist. Goal types and expected outcomes are correct. WorkItem has all fields. The standard work types exist. Leads link to campaigns. Brand controls are hidden |
| 5 | Content flow (Phase 5b) | E1 to E3 | The Phase 5b acceptance criteria |
| 6 | Tests and hygiene | F1 to F5 | Role-based UI tests and one Playwright journey per role pass in CI. The route-table walk passes for all five roles. Legacy routes and scripts are gone. The repo is outside OneDrive |

**Why this order:** Pass 1 comes first because 15-minute logouts make every other test unreliable. Pass 4 comes before Pass 5 because the tracker depends on the right work types and HACA-only mode.

## 6. Manual test script for each role

| Role | Checks |
| --- | --- |
| **Admin** | Approve a request with work preferences and see the invite in the log. Create a user directly. Suspend and reactivate. Confirm Admin is in no workload or recommendation list. Stay signed in after 20 minutes. Check the Access Requests badge count |
| **Marketing Head** | Set the monthly target. Create a campaign (blocked without a target). Try to create a user (blocked). Try to edit another head (blocked). Generate Now works. Pause a rule and see it not run. Classify a revision cause |
| **Executive** | Every screen opens. No create, edit, approve, generate, notify or classify control anywhere. A direct API write returns 403. People shows no email or phone. The Tracker is read-only |
| **Team Lead** | Create work and see the recommendation card. An overloaded person is not recommended. Generate Now is blocked. Other teams' people and performance are not visible. Approve own team's standalone work. SM Manager: assign stages, cannot approve. Creative Head: approves, cannot assign |
| **Team Member** | Lands on My Work. Start, Submit, Done and forward. Read and reply to revision notes. Mark Blocked with a dependency owner. Request Work. /campaigns, /reports, /leads and /people are refused. Cannot edit deadline or priority. Sees only their own items |
| **Everyone** | Edit profile, change password, first-login /welcome, forgot password, stay signed in past 15 minutes |

## 7. Decisions and the defaults used

| # | Decision | Default |
| --- | --- | --- |
| 1 | Who approves standalone (non-content) work | The team lead of the owner, plus the Creative Head, Head and Admin |
| 2 | Can members create work | No. They send a Request Work to a team lead |
| 3 | Brands | HACA only. Other profiles inactive and hidden |
| 4 | Departments | Design, Video Production, Social Media, SEO & Content, WhatsApp, Performance Marketing, Tech |
| 5 | Campaign goal types | Leads, Reactivations, Enrollments |
| 6 | Overloaded people | Excluded from recommendations |
| 7 | Production cookies | One registered domain, SameSite=Lax |
| 8 | Content Tracker | A tab on /calendar next to the Calendar view |
| 9 | Ad spend | Manual entry on the campaign |
| 10 | Demo password | From the environment only, never in the repo |
| 11 | A head editing other heads | Not allowed |
| 12 | Report Generate Now | Head and Admin only |
