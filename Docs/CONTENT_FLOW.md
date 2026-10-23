# SM Content Flow Plan

*Content calendar, stage pipelines, approvals and tracking for HACA Marketing OS* *Built from the team's SM CONTENT sheet and the per-brand design request sheets. The CV stage (CV Status, Date, Owner) is parked and not included.*

## 1. What the team does today

**Sheet A: SM CONTENT** (social content calendar). One row per piece: Posting Date, Topic, Type (Poster, Carousel, Reel), then Status, Done Date and Owner for Script, Shoot and Edit, then Approval Status and Date, Published Date, Posting Owner, Turnaround (Days) and Remarks. Owners seen in the sheet: Nifthash (scripts, shoots, posting), Nihal and Pranav (editing). One person can hold several stage roles.

**Sheet B: one tab per brand** (Marketing School, Design School, Tech School, HACA UAE and one more tab starting 'HACA C'). Columns: ID (auto), Date, Requirement, Content (link to a Zoho Writer or Google Doc), Assets (link), Deadline, Designer, Status, Approval. The Requirement list has 14 types: Static Post, Carousel Post, Story, Cover Image, Thumbnail, Meta Ad Creative, Class Announcement, Orientation Creative, Graduation Creative, Brochure, Certificate, Offer Creative, Custom Request, Placement Poster.

**What the sheets cannot prevent** (visible in the rows):

- Dates typed in two formats (for example 24/9/2026 and 1 Oct, 2026)
- A published date earlier than the posting date
- An approval marked Rejected on a row that still has a published date
- Stages done out of order, with no check that the earlier stage was approved
- No overdue alerts and no check of who is overloaded

The portal replaces both sheets with one content calendar. A brand tab becomes the Brand filter.

## 2. Roles in this flow

| Role in your team | Portal role | What they do |
| --- | --- | --- |
| Marketing Head | `marketing_head` | Oversight. Can do everything below |
| **SM Manager (the lead)** | `team_lead`, job role Social Media Manager, department Social Media | Creates calendar rows, sets deadlines, assigns or auto-assigns stage owners across departments, tracks every stage, reassigns |
| **Creative Head** | `team_lead`, job role Creative Manager (TL) | Approves content or script, design and edit. Requests revisions |
| Content creator | `team_member`, Writer | Writes the content or script |
| Designer | `team_member`, Designer or UI Designer | Designs |
| Shooter | `team_member` with work preference Shoot | Shoots video |
| Editor | `team_member`, Video Editor | Edits |
| Posting owner | `team_member` with work preference Post | Publishes |
| Admin | `admin` | Everything, plus users |
| Executive | `executive` | Read-only tracking of every stage |

**Approver rule (default):** a piece can be approved by a team lead whose job role is Creative Manager (TL), by the Marketing Head, or by Admin. The SM Manager assigns but does not approve.

## 3. The pipelines

Every piece is a **ContentPiece** that groups its stages. **Each stage is a normal Work Item** with its own owner, deadline and status, so alerts, blockers, feedback, workload and owner recommendations all work without a second engine.

### 3.1 Design pipeline (posters and all design requirements)

| # | Stage | Done by | Reviewed by | Output |
| --- | --- | --- | --- | --- |
| 1 | Content | Content creator | Creative Head (Content Approval) | Link to the content doc |
| 2 | Design | Designer | Creative Head (Design Approval) | Assets link or uploaded files |
| 3 | Post (only for postable types) | Posting owner | none | Published date and link |

The poster is **final done** when the Design Approval is given. For postable types the Post stage follows.

### 3.2 Reel pipeline

When the row is created, the SM Manager answers two questions: **Needs script?** and **Needs shoot?**

| Variant | Stages in order |
| --- | --- |
| A. With script, with shoot | Script (reviewed) , Shoot , Edit (reviewed) , Post |
| B. No script, with shoot | Shoot , Edit (reviewed) , Post |
| C. No script, no shoot (program-video based reels) | Edit (reviewed) , Post |

| Stage | Done by | Reviewed by | Output |
| --- | --- | --- | --- |
| Script | Writer or anyone with preference Script | Creative Head (Script Approval) | Script link |
| Shoot | Anyone with preference Shoot | none (Shoot Done) | Footage link |
| Edit | Video Editor or preference Edit | Creative Head (Approval) | Edited video link |
| Post | Posting owner | none | Published date and link |

Skipped stages show as 'Not needed' in the tracker and are ignored by deadlines, workload and alerts.

### 3.3 Type to pipeline (provisional, confirm in section 13)

| Type | Pipeline | Has Post stage |
| --- | --- | --- |
| Reel | Reel (A, B or C) | Yes |
| Static Post, Carousel Post, Story | Design | Yes |
| Poster (SM sheet) | Design, same as Static Post | Yes |
| Cover Image, Thumbnail | Design | No |
| Meta Ad Creative | Design | No (hand-off to the performance team to be confirmed) |
| Class Announcement, Orientation Creative, Graduation Creative, Offer Creative, Brochure, Certificate, Placement Poster, Custom Request | Design | No (final done) |

### 3.4 Review stages and non-review stages

- **Review stage** (Script, Content, Design, Edit): the owner clicks **Submit for approval**. The Creative Head approves, or requests a revision with a note. The owner replies and resubmits. This is the spec's feedback loop, so revision counts and flags work as designed.
- **Non-review stage** (Shoot, Post): the owner clicks **Done and forward**.
- 'Approval' in the sheet is the Creative Head's decision on the last review stage. It is not a separate task.

## 4. How it works, step by step

### Example 1: poster

'Django vs FastAPI', Tech School, Poster, posting date 21 Oct.

1. **SM Manager** adds the row to the calendar: brand, type, topic, posting date. The row is linked to the brand's standing campaign for the month.
2. The system builds the stages with due dates counted back from 21 Oct: Content 15 Oct, Design 18 Oct, Post 21 Oct.
3. **SM Manager** opens **Assign stages**. The system recommends an owner for each stage and shows the reason. The SM Manager accepts all, or overrides any.
4. **Content creator** sees the task in My Work, writes the content in Zoho or Google Docs, pastes the link, and clicks **Submit for approval**.
5. **Creative Head** sees it under 'Waiting for my approval' and approves. If not, they request a revision and the creator fixes and resubmits.
6. **Design** unlocks. The designer is notified and sees the approved content link, due date and brief. They add the assets link and submit.
7. **Creative Head** approves the design. The poster is **final done**.
8. **Post** unlocks for the posting owner, who posts and enters the published date and link. Turnaround is calculated.

### Example 2: reel with script and shoot

'Python Student Review LEAD', Reel, posting date 23 Oct.

1. **SM Manager** adds the row and ticks Needs script and Needs shoot. Stages: Script 13 Oct, Shoot 16 Oct, Edit 19 Oct, Post 23 Oct.
2. **Assign stages**: for example Nifthash for Script, Shoot and Post, Nihal for Edit.
3. Script is written and submitted. **Creative Head** approves the script.
4. **Shoot** unlocks for the shooter, who clicks **Done and forward** with the footage link.
5. **Edit** unlocks for the editor, who edits and submits. **Creative Head** reviews. Rejected means 'revision required': it goes back to the editor, and the revision is counted.
6. After approval, **Post** unlocks and the posting owner publishes.

### If something goes wrong

| Situation | What happens |
| --- | --- |
| Someone is stuck | They mark Blocked. The previous stage owner is suggested as the person they wait on, and gets notified |
| A stage owner is overloaded | The Assign stages table shows the workload. Over 85% is never recommended |
| A deadline passes | Owner is notified, then the SM Manager after the escalation time |
| A stage has no owner when it unlocks | The SM Manager is notified with a recommendation |
| Posting date changes | The SM Manager can shift all unstarted stage deadlines in one click |

## 5. Assignment: SM Manager, auto-assign and work preferences

- **Who assigns:** the SM Manager, the Marketing Head and Admin. The Creative Head approves only.
- **Work preferences:** each person has a list of stages they can take: Content, Script, Design, Shoot, Edit, Post. Admin or the Marketing Head sets it in People. Example: Nifthash has Script, Shoot, Post. Nihal has Edit.
- **Candidates for a stage:** has that stage in their preferences, has the piece's brand, is under 85% busy, and has time before the due date. **Ranking:** lowest workload, then fewest past revisions, then earliest free. The reason is shown.
- **Never silent:** the SM Manager confirms all recommendations or overrides any. Overrides are logged.
- **Assign now or later:** assign every stage at planning time, or leave later stages open. An open stage shows 'Needs owner' and alerts the SM Manager when it unlocks.
- **The SM Manager can assign across departments** for content pieces (a Writer, a Designer and an Editor on one piece), even though a normal team lead only sees their own team.

## 6. Deadlines

Each stage has its own due date, counted back from the **final date F** (the posting date for postable types, the Deadline from the design sheet for the rest). Defaults, all editable per piece:

| Pipeline | Stage due dates |
| --- | --- |
| Design, postable | Content F-6, Design F-3, Post F |
| Design, not postable | Content F-5, Design F-2 (approved by F) |
| Reel A | Script F-10, Shoot F-7, Edit F-4, Post F |
| Reel B | Shoot F-7, Edit F-4, Post F |
| Reel C | Edit F-4, Post F |

- Approvals are expected within one working day of submission. Waiting approvals are listed oldest first for the Creative Head.
- A stage cannot be started until the previous stage is approved or done.
- Overdue, escalation and todo alerts are the ones already in the plan.

## 7. Statuses: sheet to portal

| Sheet value | Portal |
| --- | --- |
| Pending | Not Started, or In Progress once started |
| Done (Script, Shoot, Edit) | Done (stored as Approved) |
| Approved | Approved by the Creative Head |
| Rejected | Revision required: the stage goes back to its owner and the revision is counted. It is not final |
| Completed (design sheet) | Approved, or Published for postable types |
| Published Date | Published |

The piece itself shows: Planning, In production, Awaiting approval, Revision requested, Ready (final done), Published. A red flag marks Blocked or Overdue.

## 8. Tracking

**Content Tracker** is a table view on the Calendar screen. It looks like your sheet: one row per piece, a status, date and owner for every stage, with colour chips.

| View | Columns |
| --- | --- |
| Social view | Posting Date, Topic, Type, Script (status, date, owner), Shoot (status, date, owner), Edit (status, date, owner), Approval (status, date, by), Published Date, Posting Owner, Turnaround, Remarks |
| Design view | ID, Date, Requirement, Content link, Assets link, Deadline, Designer, Status, Approval |

- Filters: Brand (replaces the tabs), month, type, owner, stage status, Needs owner, Waiting approval, Overdue, Blocked.
- Quick-add row at the top, like typing in the sheet.
- Clicking a row opens the piece with a **stage stepper**, links, outputs and history.
- **Creative Head** works from 'Waiting for my approval' in the existing Feedback and Revision screen and in My Work.
- **Dashboard** gets: pieces by stage, waiting approval, needs owner, behind schedule.

| Who | Sees in the Tracker |
| --- | --- |
| Admin, Marketing Head | All pieces in their brands |
| Executive | All pieces, read-only |
| SM Manager | All pieces in their brands |
| Creative Head | All pieces in their brands, since they approve them |
| Other team leads | Pieces where one of their people has a stage |
| Team members | No tracker. They see their own stage items in My Work, with the previous stage's output |

## 9. Data model additions

**ContentPiece:** code, topic, content type, brandId (profile), campaignId, finalDate, pipeline, needsScript, needsShoot, contentLink, assetsLink, remarks, createdById, derived status and turnaroundDays, list of stage work items.

**WorkItem (new fields):** contentPieceId (empty for standalone work), stageKey, stageOrder, reviewRequired, unlockedAt, isSkipped.

**Person:** workPreferences\[\] (Content, Script, Design, Shoot, Edit, Post).

**Shared config:** pipelines, stage definitions, type to pipeline table, default due-date offsets, approver job roles (Creative Manager (TL)).

**Work types:** extend the spec's list with the 14 design requirement types and Reel. Adding the CV stage later is a configuration change.

## 10. Who can do what

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

## 11. Where it fits in the build plan

| Phase | Change |
| --- | --- |
| 1 | Add Person.workPreferences, show it on My Account, add the approver job roles constant, demo users for SM Manager and Creative Head |
| 2 | One standing campaign per brand per month (created like any campaign) |
| 3 | Add the WorkItem stage fields, extend work types, add content and assets link fields |
| 4 | For stage items, candidates come from work preferences instead of the department table |
| 5 | Approver rule: Creative Head, Marketing Head and Admin may approve review stages |
| **5b (new)** | ContentPiece, pipelines, hand-off, Assign stages, Content Tracker, approvals queue |
| 6 | Dashboard pipeline numbers |
| 7 | Creative Production report by stage, with approval and revision counts |
| 9 | Stage turnaround and approval metrics |

## 12. What stays retired

Shoot planner (the sheet only needs shoot status, date and owner), time tracking, timesheets and leave, file library, performance ads, video review studio (reviewers use the links), calendar bulk import and clash detection, and request intake from other departments (unless decided otherwise in section 13). The old FORGE pipeline and hand-off code is not carried over. It stays readable in the tag forge-v1-final as a reference for Phase 5b.

## 13. Decisions needed, with proposed defaults

| # | Question | Default |
| --- | --- | --- |
| 1 | Who is the Creative Head? | A team lead with job role Creative Manager (TL), plus Marketing Head and Admin |
| 2 | Who shoots? There is no job role for it | Anyone with the Shoot work preference |
| 3 | Is Poster the same as Static Post? | Yes |
| 4 | Which types have a Post stage? | Table in 3.3 |
| 5 | Does Meta Ad Creative hand off to the performance team? | Not built. Final done only |
| 6 | Program-video reels: need a shoot, or edit only? | Both variants (B and C) |
| 7 | Which profile is 'HACA UAE', and what is the fifth tab? | HACA UAE maps to HACA Mideast. Fifth tab to confirm |
| 8 | Standing campaign per brand per month for every piece? | Yes |
| 9 | How is Turnaround (Days) counted? | Published date minus the first stage start date |
| 10 | Do other departments also request designs (the Custom Request type)? | No. The SM Manager enters them |
| 11 | Is Rejected a revision request, not a final rejection? | Yes |
| 12 | Can the SM Manager approve? | No |
| 13 | Default due-date offsets in section 6 | As listed |
| 14 | Import of the existing sheet rows? | Not built. Start fresh from the new month |

## 14. Out of scope here

CV Status, Date and Owner (parked), shoot day planning, bulk import, time tracking, requests from other departments, rich-text editing (the content stays in Zoho Writer or Google Docs, linked), and a video player with timestamped comments.
