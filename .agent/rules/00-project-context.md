# Project context: HACA Marketing OS (V1 Scope Reset & Workflow V2)

One unified system where the HACA marketing team plans, assigns, produces, approves and reports marketing work.
The portal manages **WORK and TEAM only, for HACA only**.
Source of truth: `docs/WORKFLOW.md`, `docs/SCOPE_RESET.md`, `docs/CONTENT_FLOW.md`, and `docs/PROJECT_REPORT.md`.

## Scope Reset & Workflow V2 Summary
Build ONLY what the Scope Reset and Workflow V2 define:
- **Calendar Plans** (Two kinds only: `monthly` and `individual`, via 24-col CSV/Excel upload or interactive grid; title carries school e.g. 'Tech School November 2026'; minimal 5-column upload supported);
- **Row-level Planning & Grouping**: `Program or event` for campaign/event grouping, `For team` (Sales, Marketing, Academics, Other), `Brief` (<=1,000 chars), `Reference link` (input URL), `Priority` (Normal or Urgent, default Normal), `Remarks`, `Posting owner` (for live types);
- **Instant Stage & Owner Auto-Fill**: Selecting type/reel toggles creates stages with suggested owners (<85% workload including draft rows, matching work preferences, ranked) and calendar-day deadline offsets ($F-5, F-2$, etc.);
- **Creative Head Verification & Line-Item Approval** (approve all, approve selected rows, request changes with row comment, or reject whole plan with concern);
- **ContentPiece & Sequential Stage WorkItems** (Design pipeline and Reel pipeline Variants A, B, C; Stage 1 unlocked, downstream stages locked);
- **Structured Review Feedback Loops** evaluated by Creative Head (`Script`, `Shoot`, `Edit`, `Content`, `Design`); Shoot is a review step; only `Post` is non-review; 4th revision raises flag;
- **Typed Submissions & Role Workspaces**: Each step has a typed output (Content/Script Writing Studio doc; Shoot video footage; Edit video final cut; Design images/PDF; Post live link + timestamp). Link-only outputs remain as fallback for document and video;
- **Job Role 'Videographer'**: Dedicated job role added (13 canonical roles; default work preference: Shoot);
- **Quality Ratings on Approval**: 1–5 star rating required on approval, optional feedback and tags; worker sees rating and can mark as seen; strict anti-comparison guards (no leaderboards, no rankings);
- **Content Tracker** table view on `/calendar` with Social and Design views, 'who holds it now', 'at risk' (due in 2 days and not started/pending/blocked);
- **8-Section Dashboard**;
- **4 Objective Reports** (Weekly Work Report, Monthly Performance Scorecard, Creative Production Report, Team Performance Digest);
- **Day-Based Automation** (daily overdue notification at end-of-day, instant blocker ping with 'blocked since <date>', 3-day inactivity reminder, 4th revision flag; all hour-based rules removed);
- **HACA Only**: HACA is the only organisation; there is no brand or profile dimension.

## Removed Completely (Scope Reset & Workflow V2)
- Brand / Profile dimension: HACA is the only organisation; there is no brand or profile dimension. Profile model, profileId, profileAccess, brand switchers and chips are completely removed.
- Leads (LSQ adapter, sync jobs, Lead model, SyncRun, DataIssue, Lead Funnel, Data Center, WhatsApp inbound auto-task);
- Campaigns (model, routes, pages, budget, spend, OKR);
- Monthly Targets (model, routes, pages);
- Project plans (`kind: 'project'` removed; replaced by `individual` plans and `Program or event` row grouping);
- Hour-based escalations (no 4-hour overdue escalation, no 4-hour blocker escalation, no 48-hour revision flag escalation);
- Invented codes (`assets_missing`, `brief_gap`, etc.);
- Reports: Lead Funnel & CPL Report, Campaign Deep-Dive Report;
- Automation: `lsq_live_sync`;
- Performance: Business Impact dimension;
- WorkItem attributes: `campaignId`, `relatedOKR`, `relatedTarget`, `leadsGenerated`, `qualifiedLeads`;
- Permission keys: `target.*`, `campaign.*`, `lead.view`, `datacenter.view`;
- Environment variables: `LSQ_*`.

## Roles (Exact Five Keys)
1. **`admin`**: System Owner outside creative hierarchy. Derived all permissions. Only admin creates users, approves access requests, changes roles, grants elevated roles (`admin`, `creative_head`, `executive`), suspends, resets passwords, forces logout. Excluded from workload and candidate pools.
2. **`creative_head`** *(was marketing_head)*: Creative Director. Verifies and approves calendar plans (all, selected rows, request changes, or reject plan with concern); approves or requests revisions on review stages (`Script`, `Content`, `Design`, `Edit`); classifies revision root causes; edits team operating fields (`departmentId`, `jobRole`, `workPreferences`, `reportsToIds`, `weeklyCapacityHours`); controls reports and automation. Cannot create users, suspend accounts, change roles, or upload calendar plans.
3. **`sm_manager`** *(was team_lead)*: Main operational planner. Uploads/types calendar plans (`monthly` and `individual`), selects type with instant stage auto-fill, customizes owners/deadlines, submits to Creative Head. Once approved, can change owners/deadlines with logging, resolves blockers, tracks all stages in Content Tracker, watches workload. Cannot approve plans or review stages.
4. **`executive`**: Leadership viewer (CEO, Business Head, Directors). Read-only viewer across all screens. Zero mutation privileges (HTTP 403). Contact details masked. Excluded from workload and candidate pools.
5. **`team_member`**: Creative contributor. Own portal only (`/my-work`, Todo, own Calendar items, Work Detail, Notifications, My Account). Starts work, updates status, pastes deliverable links, submits to Creative Head (review stages) or Done and forward (non-review stages), replies to feedback, marks Blocked, requests work from SM Manager. Sees only own items (locked stages greyed out).

*Approver rule:* No other department lead roles. Creative Manager (TL) approver rule is replaced by `creative_head`.

## Team Chat System (Source of truth: docs/CHAT.md)
- **Navigation**: Pinned chat icon with unread badge in top bar for all 5 roles (`/chat`).
- **Channels**: `Team Chat` (system singleton, all active users auto-joined, immutable; `executive` is read-only); `Groups` (created by `creative_head`, `sm_manager`, `admin`); `Direct Messages` (1:1 private between active non-executives; zero admin viewing; no DMs for executive).
- **Messages**: Max 4,000 chars, built-in Unicode emoji (no npm emoji dependencies), @mentions (`@everyone` for leaders/admin only), quoted replies, 24h edit window (`[edited]`), deletion placeholders, 6 reactions (👍, ❤️, 😂, 🎉, 👀, ✅), up to 10 pins/channel, up to 5 attachments (image $\le 20\text{ MB}$, doc $\le 25\text{ MB}$, video $\le 100\text{ MB}$; unguessable UUID directory storage), plain text links, read receipts, unread divider, typing indicators, jump-to-latest button, infinite scroll (50/page), search, deep links (`/chat/<channel>?m=<id>`).
- **Real-Time Engine**: Socket.io authenticated handshake, room per channel (`channel:<id>`), membership verified on join and on every emit; optimistic send with retry.
- **Notifications**: Settings 'Chat' category (in-app default ON, email default OFF, mentionsOnly option) + per-channel mute. Zero hour-based rules.
- **Share to Chat**: Approved outputs can be shared to chat by owner, `creative_head`, `sm_manager`, `admin`. Creates a scoped `ShareGrant` for that asset only; review threads stay isolated.
- **Zero Surveillance**: Strictly NO chat leaderboards, message counts, or chat activity rankings anywhere.


