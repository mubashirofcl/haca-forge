# HACA Marketing OS — Team Chat Specification (Source of Truth)

**Document Type:** Functional & Technical Architecture Specification  
**Authority:** Single Source of Truth for Team Chat, Groups, Direct Messages, Share-to-Chat, Socket.io Real-Time Protocol, and Chat Permissions  
**Scope:** Architecture, Data Models, REST Endpoints, Socket.io Protocol, Notification Matrix, Security, UI Standards, and Migration  
**Governance:** Governs `docs/BUILD_PLAN.md`, `docs/OPEN_QUESTIONS.md`, `.agent/rules/`, and future chat implementations.  
**Rule:** Master Specification. Documentation only — no code modifications until approved.

---

## Table of Contents
1. [Investigation Findings & Codebase Audit](#1-investigation-findings--codebase-audit)
2. [Channel Architecture & Lifecycle](#2-channel-architecture--lifecycle)
3. [Message Engine & Rich Interactions](#3-message-engine--rich-interactions)
4. [Real-Time Socket.io Architecture](#4-real-time-socketio-architecture)
5. [Notification System & Unread Tracking](#5-notification-system--unread-tracking)
6. ["Share to Chat" Approval Integration & ShareGrant Engine](#6-share-to-chat-approval-integration--sharegrant-engine)
7. [Role Permissions & Governance Matrix](#7-role-permissions--governance-matrix)
8. [User Interface & Layout Standards](#8-user-interface--layout-standards)
9. [Data Models & Mongoose Schemas](#9-data-models--mongoose-schemas)
10. [REST API Endpoints Specification](#10-rest-api-endpoints-specification)
11. [Socket.io Event Protocol](#11-socketio-event-protocol)
12. [Idempotent Migration Plan](#12-idempotent-migration-plan)
13. [Files to Change, Dependencies & Technical Risks](#13-files-to-change-dependencies--technical-risks)

---

# 1. Investigation Findings & Codebase Audit

### 1.1 Existing Chat & Messaging Code
* **Task-Room Socket Stubs:**
  * File: [`apps/web/src/hooks/useSocket.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/hooks/useSocket.ts) (lines 70–98).
  * Findings: Contains client-side stubs: `joinTask(taskId)`, `leaveTask(taskId)`, `joinRequest(requestId)`, `leaveRequest(requestId)`, and `emitTyping(taskId, isTyping)`.
  * Status: **Dead Code / Orphaned Stubs**. There are zero corresponding backend listeners in `server.js` or controllers for `join_task`, `join_request`, or `task:typing`.
  * Action: **Delete & Replace**. Remove these task-room legacy stubs and replace them with the standard channel-based chat methods: `joinChannel(channelId)`, `leaveChannel(channelId)`, `emitTyping(channelId, isTyping)`.
* **Submission Comments (Approval Threads):**
  * Files: [`apps/api/src/modules/submissions/service.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/submissions/service.js) (lines 458–466, 718–726), `apps/api/src/modules/submissions/model.js`.
  * Findings: `SubmissionComment` models inline text and timecode review notes on deliverable versions, broadcasting `comment:new` to `user:${ownerId}`, `role:creative_head`, and `role:admin`.
  * Status: **Retain strictly for Approval Workflows**. Approval discussions must remain private to review steps and MUST NOT leak into general chat.
* **MediaThread Component:**
  * File: [`apps/web/src/pages/work/workspaces/MediaThread.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/pages/work/workspaces/MediaThread.tsx).
  * Findings: WhatsApp-style visual discussion feed for video clips (`/api/clips/:clipId/messages`) featuring right-aligned dark bubbles (mine), left-aligned slate bubbles (theirs), status ticks (`Check`, `CheckCheck`), quoted reply banners, and jump-to-bottom controls.
  * Action: **Reuse UX & Component Patterns**. Extract bubble layouts, tick status indicators, quoted reply banners, and jump-to-latest logic into the universal Chat component library (`apps/web/src/pages/chat/`).

### 1.2 Socket.io Setup
* **Server Handshake & Room Initialization:**
  * File: [`apps/api/src/server.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/server.js) (lines 114–173).
  * Findings:
    - Initialized on HTTP server with CORS credentials enabled.
    - Handshake authentication middleware (`io.use`) inspects `accessToken` from cookies, handshake auth object, query parameters, or Bearer authorization headers, verifying the token via `jwt.verify(token, env.JWT_SECRET)`.
    - Automatically maps connections to `user:${userId}` and `role:${normalizedRole}` rooms upon connection.
  * Action: **Reuse Handshake & Extend with Channel Room Guards**. The existing JWT handshake is production-grade. When implementing Chat, add Socket.io room handlers `chat:join` and `chat:leave` that query the database to verify `ChannelMember` membership before allowing a socket into `channel:<channelId>`.

### 1.3 Notification Categories & Preferences
* **Shared Categories & Schemas:**
  * File: [`packages/shared/src/index.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/packages/shared/src/index.ts) (lines 560–568, 605–631).
  * Current Categories: `mySteps`, `approvalsRevisions`, `messagesComments`, `deadlinesOverdue`, `planUpdates`, `system`.
  * Settings Schema: `notificationCategoryPrefSchema` (`inApp: boolean`, `email: boolean`).
  * Backend Dispatcher: [`apps/api/src/modules/notifications/service.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/notifications/service.js).
  * Action: **Extend**. Add `chat` category to `NOTIFICATION_CATEGORIES`. Extend schema to support `chat: { inApp: boolean, email: boolean, mentionsOnly: boolean }` with defaults: `inApp: true`, `email: false`, `mentionsOnly: false`.

### 1.4 Upload Signing & Storage
* **Local Disk Engine & Cloudinary Signing:**
  * Files: [`apps/api/src/modules/uploads/routes.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/api/src/modules/uploads/routes.js), `apps/api/src/modules/uploads/service.js`.
  * Findings: Multer stores files directly on local disk under `apps/api/uploads/` using sanitised filenames (`${uniqueSuffix}-${safeBase}${ext}`), with Cloudinary as optional external store.
  * Action: **Reuse Multer Engine with Unguessable Channel Subdirectories**. Store chat attachments on local disk under `apps/api/uploads/chat/:channelId/:uuid/:sanitizedFilename` (or signed storage) enforcing chat-specific attachment rules (image $\le 20$ MB, docs $\le 25$ MB, video $\le 100$ MB).

### 1.5 Avatar Component
* File: [`apps/web/src/components/Avatar.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/components/Avatar.tsx).
* Findings: Standardized component supporting sizes `xs` (20px), `sm` (28px), `md` (40px), `lg` (48px), `xl` (80px), initials fallback with deterministic gradients based on user ID hash, lazy loading, and **zero presence dots**.
* Action: **Reuse Universally**. Use `<Avatar />` for channel lists, message author headers, typing indicators, member drawer, and shared media cards.

### 1.6 Header Layout
* File: [`apps/web/src/components/Layout.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/apps/web/src/components/Layout.tsx) (lines 612–622).
* Findings: Top action cluster contains Search button, `<NotificationCenter />` bell, and `<UserMenuDropdown />` avatar dropdown. Main navigation menus are flat and strictly constrained ($\le 8$ items per role).
* Action: **Add Top Bar Chat Icon Button**. Mount `<ChatTopBarButton />` immediately adjacent to `<NotificationCenter />`. Displays unread chat count pill badge. Clicking navigates to `/chat`. Keeps navigation menus untouched and compliant with UI standards.

---

# 2. Channel Architecture & Lifecycle

The system supports exactly three distinct channel types: **Team Chat**, **Groups**, and **Direct Messages (DMs)**.

```
+---------------------------------------------------------------------------------------------------+
| CHANNEL TYPE       | SCOPE / PURPOSE                     | CREATION / MEMBERSHIP      | MUTABILITY |
+---------------------------------------------------------------------------------------------------+
| 1. Team Chat       | Public company square for all staff | System-created singleton.  | Immutable. |
|    (type: 'team')  | Announcements, team achievements    | All active users auto-join.| Cannot be  |
|                    | and organization-wide discussion.   | Suspended users revoked.   | renamed or |
|                    |                                     | Executives are read-only.  | archived.  |
+--------------------+-------------------------------------+----------------------------+------------+
| 2. Groups          | Cross-functional squads, project    | Created by creative_head,  | Creator    |
|    (type: 'group') | collaboration, or department chat   | sm_manager, or admin.      | manages.   |
|                    | (e.g. "Video Editors", "Admissions")| Members picked by creator. | Can leave, |
|                    |                                     | Executives join read-only. | archive.   |
+--------------------+-------------------------------------+----------------------------+------------+
| 3. Direct Messages | Private 1-on-1 peer communication   | Any two active users who   | Private.   |
|    (type: 'dm')    | for rapid coordination.             | are NOT executives.        | Admin      |
|                    |                                     | Zero admin eavesdropping.  | cannot     |
|                    |                                     | No group DMs.              | read DMs.  |
+---------------------------------------------------------------------------------------------------+
```

### 2.1 Team Chat (System Singleton)
* **Creation:** Exactly one system channel exists (`kind: 'team'`), created automatically during initial migration or database seed with `systemSlug: 'team-chat'`.
* **Automatic Membership:** Every active user joins automatically upon account activation (including new sign-ups, approved access requests, or reactivations).
* **Instant Suspension Revocation:** When an admin suspends a user, their socket connection is severed, active sessions are invalidated, and their channel membership is revoked immediately.
* **Immutability:** Team Chat cannot be renamed, description cannot be deleted, cannot be archived, and no user can leave it.
* **Executive Restriction:** Users with role `executive` are added as **read-only members** (`roleInChannel: 'read_only'`). They can read messages and see shared media, but cannot post messages, react, upload attachments, or initiate threads.

### 2.2 Groups (Squads & Topics)
* **Creation Authority (`chat.group.create`):** Restricted to `creative_head`, `sm_manager`, and `admin`. Regular `team_member` and `executive` cannot create groups.
* **Ownership & Member Management:**
  - The creator is assigned as `owner`.
  - The owner can pick members from active users, add members, remove members, and rename the group.
  - Name constraints: 1 to 40 characters, unique among currently active groups.
  - Optional description: Up to 200 characters.
* **Leaving & Ownership Transfer:**
  - Members can leave at any time.
  - The group owner **cannot leave** without first transferring ownership to another active member or archiving the group.
* **Archival Lifecycle:**
  - The owner (or an `admin`) can archive the group.
  - When archived, the group becomes strictly read-only for all members (no new messages, reactions, or edits).
  - Archived groups are hidden from the primary channel list and listed in an expandable "Archived" section.
* **Admin Override (`chat.moderate`):** An `admin` can manage members, transfer ownership, or archive any group if the original owner is inactive or departed.

### 2.3 Direct Messages (1-on-1 Peer Chat)
* **Participants:** Between any two distinct, active users who do NOT hold the `executive` role.
* **Strict Privacy (No Admin Peeking):** DMs are strictly private between the two participants. `admin` users have **zero permission or endpoint access** to inspect or list DM conversations in which they are not a participant.
* **No Group DMs:** DMs are strictly bilateral ($1:1$). Multi-person conversations must use Groups.
* **Executive Exclusion:** Executives cannot send or receive direct messages; peer DMs are intended for operational workers.

---

# 3. Message Engine & Rich Interactions

```
+---------------------------------------------------------------------------------------------------+
| MESSAGE FEATURE       | SPECIFICATION & BUSINESS RULES                                            |
+---------------------------------------------------------------------------------------------------+
| Text Length Limit     | Up to 4,000 characters per message (UTF-8). Stripped of executable HTML.  |
| Emoji Picker          | Built-in lightweight emoji palette (smileys, gestures, symbols). Zero     |
|                       | third-party npm emoji dependencies. Inserted as native Unicode characters.|
| @Mentions             | - `@name`: Autocompletes matching channel members. Dispatches alert.      |
|                       | - `@everyone`: Dispatches alert to all channel members. Permitted ONLY    |
|                       |   for `creative_head`, `sm_manager`, and `admin`. Blocked for workers.   |
| Quoted Replies        | Select message to quote. Stores `replyToId`. Renders banner with original  |
|                       | author name, text snippet, and 1-click scroll jump to quoted message.     |
| Editing Own Messages  | Author can edit text within 24 hours. Message receives `[edited]` badge   |
|                       | with timestamp tooltip. Edit history timestamps are stored internally.    |
| Deleting Messages     | - Author can delete own message: Displays *"Message deleted"* placeholder. |
|                       | - `admin` can delete any message: Displays *"Message removed by admin"*.  |
|                       |   Admin deletions write an immutable record to `ActivityEvent`.           |
| Reactions (Exact 6)   | Exactly 6 allowed reactions: 👍 (thumbs up), ❤️ (heart), 😂 (laugh),       |
|                       | 🎉 (party), 👀 (eyes), ✅ (check). Users can toggle reactions on/off.      |
| Pinned Messages       | Up to 10 pinned messages per channel. Permitted for `creative_head`,     |
|                       | `sm_manager`, `admin`, and Group Owners. Displayed in right side panel.   |
| Attachments           | Up to 5 files per message:                                                |
|                       | - Images: PNG, JPG, WEBP up to 20 MB each.                                |
|                       | - Documents: PDF, DOCX, XLSX, CSV, TXT up to 25 MB each.                  |
|                       | - Video: MP4, MOV, WEBM up to 100 MB each.                                |
|                       | - All other file types rejected. Stored under unguessable UUID paths.     |
| Links & Previews      | URLs remain plain text / standard clickable links. No scrapers or embeds. |
| Read Receipts         | - Groups: Shows "Seen by N" text on hover with member tooltip list.       |
|                       | - DMs: Shows single grey tick (sent) and double green ticks (seen).       |
| Unread Divider        | Persistent red rule: *"─── Unread Messages ───"* on initial channel load. |
| Typing Indicators     | Debounced real-time indicator: *"[Name] is typing..."* (auto-resets 3s).   |
| Date Separators       | Sticky headers grouping messages by date (e.g. *"Today"*, *"Yesterday"*). |
| Pagination & Jump     | Infinite scroll loading 50 messages per page. Float "Jump to Latest" pill.|
| Search & Deep Links   | Channel-scoped search + global search across user's channels.              |
|                       | Deep linking supported via URL query: `/chat/<channelId>?m=<messageId>`.  |
+---------------------------------------------------------------------------------------------------+
```

---

# 4. Real-Time Socket.io Architecture

Real-time chat is powered by the existing, verified Socket.io server running in `apps/api/src/server.js`.

```
  +------------------+         Handshake (JWT Auth)         +------------------+
  |   Client (Web)   | ===================================> | API (Socket.io)  |
  +------------------+                                      +------------------+
           |                                                          |
           | --- chat:join { channelId } ---------------------------> | Verify ChannelMember
           |                                                          | socket.join(`channel:${id}`)
           |                                                          |
           | --- chat:message:send { channelId, text, ... } --------> | Verify Member & Mutation
           |                                                          | Persist Message to DB
           | <== chat:message:new { message } ======================= | Broadcast to room
           |                                                          |
           | --- chat:typing { channelId, isTyping } ---------------> | Broadcast to room (peers)
           | <== chat:typing:update { channelId, userId, isTyping } = |
           |                                                          |
           | --- chat:read { channelId, messageId } ----------------> | Update lastReadMessageId
           | <== chat:read:update { channelId, userId, messageId } == | Broadcast to room
```

### 4.1 Room Management & Handshake Security
* **Handshake Verification:** Sockets authenticate using the established JWT cookie/Bearer protocol in `apps/api/src/server.js`. Anonymous connections are rejected with `401 Unauthorized`.
* **Channel Rooms:** Formatted as `channel:<channelId>`.
* **Zero Trust Room Joins (`chat:join`):** When a client emits `chat:join`, the server verifies the user's active `ChannelMember` record in MongoDB. If the channel is archived, the socket joins as read-only. If the user is suspended or not a member, the join is rejected with an error event.
* **Per-Emit Membership Enforcement:** The server re-checks active membership on **every mutation event** (`chat:message:send`, `chat:reaction:toggle`, `chat:message:edit`, `chat:message:delete`). Even if a client remains connected, suspending their account or removing them from a group immediately blocks subsequent emits.

### 4.2 Optimistic Delivery & Client Retry State Machine
1. **Optimistic Enqueue:** When the user hits `Enter`, the message is instantly rendered in the active conversation stream with a pending clock icon (`Clock`).
2. **Success Acknowledgment:** The server responds with the saved `Message` object. The client replaces the temporary ID with the canonical MongoDB ID and marks the status as sent (`Check`).
3. **Failure State:** If network connectivity drops or the server returns an error, the message bubble turns red with an alert icon and error text: *"Failed. Tap to retry"*.
4. **Retry Trigger:** Clicking the failed message re-submits the exact payload without retyping.

---

# 5. Notification System & Unread Tracking

### 5.1 Unread Counters & Top Bar Badge
* **Channel Member State:** `ChannelMember` stores `lastReadMessageId` and `lastReadAt`.
* **Unread Calculation:** Messages in the channel created after `lastReadAt` with `_id > lastReadMessageId` increment the channel's unread badge.
* **Global Top Bar Badge:** The sum of unread messages across all joined, non-muted channels displays as a numeric pill badge over the top bar chat icon (e.g. `[ 3 ]`).

### 5.2 Notification Rules & User Settings
1. **Mentions Always Notify:** An `@mention` of the user's name (or `@everyone` by an authorized leader) **always triggers an in-app toast notification and increments unread count**, completely bypassing mutes.
2. **Channel-Level Mute:** A user can mute any individual channel. Muted channels suppress in-app sound/toasts and email digests, and do not contribute to the global header unread badge (unless the user is explicitly `@mentioned`).
3. **System Settings Category (`chat`):**
   * Configurable in `/settings` under Notifications:
     - `inApp`: Controls in-app toast popups for chat messages (Default: `ON`).
     - `email`: Controls email notifications for offline unread messages (Default: `OFF`).
     - `mentionsOnly`: Suppresses notifications for all regular messages, alerting only when `@mentioned` (Default: `OFF`).
4. **Strict Constraint:** **Zero hour-based rules and zero quiet hours.** Institutional operations require clean, deterministic day-based workflows without scheduled sleep clocks.

---

# 6. "Share to Chat" Approval Integration & ShareGrant Engine

The "Share to Chat" capability allows creative leaders and workers to celebrate and cross-pollinate approved creative outputs across team channels without exposing sensitive production stages.

```
+---------------------------------------------------------------------------------------------------+
| UPSTREAM APPROVAL SOURCE                                                                          |
| (Review Studio, Workspaces, MediaThread, ClipCard)                                                |
| [Status: APPROVED only. Drafts & Revisions blocked]                                               |
+---------------------------------------------------------------------------------------------------+
                                   |
                                   | User clicks [ Share to chat ]
                                   v
+---------------------------------------------------------------------------------------------------+
| SHARE TO CHAT DIALOG                                                                              |
| Destination: [ Team Chat (All Staff) v ]                                                          |
| Optional Note: "Final reel cut approved! Great work on the robot pacing."                         |
| Asset Preview: [ Video Player Thumbnail | 00:58 | 9:16 Vertical | "Student Voices Reel" ]         |
| [ Cancel ]                                                             [ Confirm & Share ]        |
+---------------------------------------------------------------------------------------------------+
                                   |
                                   | 1. Creates ShareGrant record (assetId, channelId, sharedBy)
                                   | 2. Posts Media Card Message to Channel
                                   v
+---------------------------------------------------------------------------------------------------+
| CHAT MEDIA CARD MESSAGE IN CHANNEL                                                                |
| +-----------------------------------------------------------------------------------------------+ |
| | [Thumbnail Image / Poster]                [ APPROVED ★ 5 ] Reel Master Cut                    | |
| |                                           Topic: Fall 2026 Student Voices                     | |
| | [ > Play Video ]  [ Download Asset ]       Creator: Test Editor One (Avatar)                   | |
| | Note: "Final reel cut approved! Great work on the robot pacing."                               | |
| +-----------------------------------------------------------------------------------------------+ |
+---------------------------------------------------------------------------------------------------+
```

### 6.1 Strict Approval Gating
* **Only Approved Assets May Be Shared:**
  - An approved video clip (`status: 'approved'`).
  - An approved master cut (`Edit` stage in `status: 'Approved'`).
  - Approved design graphics or PDFs (`Design` stage in `status: 'Approved'`).
* **Blocked Items:** Draft submissions, items currently waiting for review (`status: 'Feedback'`), and clips flagged as `reshoot_needed` **cannot be shared**. The "Share to chat" button is hidden or disabled.
* **Eligible Roles:** Output owner, `creative_head`, `sm_manager`, and `admin`.

### 6.2 The `ShareGrant` Authorization Model
* **The Security Problem:** Regular channel members (or users in other departments) might not have access to the underlying `ContentPiece`, `CalendarPlan`, or raw storage directory.
* **The Solution (`ShareGrant`):**
  - When an asset is shared to a channel, the backend creates an immutable `ShareGrant` linking `assetId` $\to$ `channelId`.
  - When any member of that channel views the chat card or clicks "Play" / "Download", the asset delivery endpoint verifies that a valid, active `ShareGrant` exists for that channel.
  - **Zero Leakage:** The internal pipeline, step comments, stage history, and craftsmanship ratings remain strictly private under existing permissions. Only the shared media asset itself is granted read-only viewing and downloading access.
* **Unsharing (Revocation):**
  - The original sharer, a `creative_head`, or an `admin` can click "Unshare" on the message.
  - The `ShareGrant` is marked revoked (`revokedAt: new Date()`).
  - The chat message updates to display: *"This media asset is no longer shared."* Download and playback links are immediately invalidated.

### 6.3 Approval Cockpit Quick-Share Checkbox
When the Creative Head approves a final deliverable in Review Studio (`/feedback/review-studio`), the Decision Bar presents an optional checkbox:
`[ ] Also share to Team chat` (Default: `unchecked`).
If checked upon clicking **"Approve Deliverable"**, the system automatically creates the `ShareGrant` and broadcasts the approved media card into Team Chat on behalf of the Creative Head.

---

# 7. Role Permissions & Governance Matrix

```
+---------------------------------------------------------------------------------------------------------+
| PERMISSION KEY         | admin     | creative_head | sm_manager  | team_member | executive              |
+---------------------------------------------------------------------------------------------------------+
| `chat.use`             | YES       | YES           | YES         | YES         | NO (Read-only)         |
| `chat.group.create`    | YES       | YES           | YES         | NO          | NO                     |
| `chat.moderate`        | YES       | NO            | NO          | NO          | NO                     |
| `chat.read`            | YES       | YES           | YES         | YES         | YES (Team Chat & added |
|                        |           |               |             |             |      groups only)      |
| Direct Messaging (DM)  | YES (Peer)| YES (Peer)    | YES (Peer)  | YES (Peer)  | NO (Blocked)           |
| Share Approved Assets  | YES       | YES           | YES         | YES (Own)   | NO                     |
| Mention @everyone      | YES       | YES           | YES         | NO          | NO                     |
| Delete Any Message     | YES       | NO            | NO          | NO          | NO                     |
| Pin / Unpin Messages   | YES       | YES           | YES         | Group Owner | NO                     |
+---------------------------------------------------------------------------------------------------------+
```

### Institutional Anti-Surveillance Safeguards
* **Zero Leaderboards:** There are **NO chat leaderboards, NO user rankings, NO "Most Active Chatters" lists**.
* **Zero Performance Surveillance:** Chat message volume, response times, and character counts are **NEVER tracked in performance digests, workload calculations, or employee reviews**.
* **Direct Message Secrecy:** Admins have zero technical capability to read or query 1-on-1 direct messages between other users.

---

# 8. User Interface & Layout Standards

The Chat interface strictly implements the Glass tokens, 8px layout grid, and touch standards from [`docs/UI_STANDARDS.md`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/UI_STANDARDS.md).

### 8.1 Desktop Text Wireframe (1366 px Viewport)

```
+------------------------------------------------------------------------------------------------------------------------+
| TOP BAR: [Logo: HACA OS]    [Global Search (Ctrl+K)]    [Chat Icon (3)] [Notification Bell (2)]    [Avatar: Alfie (Admin)]|
+------------------------------------------------------------------------------------------------------------------------+
| LEFT: CHANNELS (280px)     | CENTER: ACTIVE CONVERSATION (Flex-1)                      | RIGHT: DETAILS PANEL (300px)  |
|                            |                                                           |                               |
| [Search channels...     ]  | [Hash] # Team Chat                          [Members: 24] | CHANNEL INFO:                 |
|                            | All-hands announcements & team milestones                 | # Team Chat                   |
| CHANNELS:                  +-----------------------------------------------------------+ General company channel for   |
| * # Team Chat        (1)   | 09:15 AM - Yesterday                                      | all HACA marketing staff.     |
| * # Video Production       | [Avatar] Maya (Creative Head):                            |                               |
| * # Admissions Reel        | Morning team! Please review the updated November calendar.| PINNED MESSAGES (2):          |
|                            |                                                           | * Maya: "Brand guidelines v2" |
| DIRECT MESSAGES:           | 10:30 AM - Today                           ─── Unread ─── | * Admin: "Server maintenance" |
| * John (Editor)      (2)   | [Avatar] John (Editor):                                   |                               |
| * Sarah (Designer)         | Draft for the student reel is ready in Review Studio!     | SHARED MEDIA (4):             |
|                            | 👍 4   🎉 2                                                | [Clip thumb] [Master cut]     |
| ARCHIVED:                  |                                                           | [Poster PDF] [Story 9:16]     |
| > Project Expo 2025        | [SHARED MEDIA CARD: Student Voices Reel]                  |                               |
|                            | [Play Thumbnail] Status: APPROVED ★ 5.0                   | MEMBERS (24):                 |
|                            | Asset: Master Cut v2 (00:58) | [Download Asset]           | * Maya (Creative Head)        |
|                            | Note: "Pacing is excellent. Approved for post!"           | * John (Video Editor)         |
|                            |                                                           | * Sarah (Designer)            |
|                            +-----------------------------------------------------------+ * David (Executive) [RO]      |
|                            | [ Replying to John: "Draft for the student reel..."   [X] ]|                               |
|                            | +-------------------------------------------------------+ | [ Leave Group ]               |
| [+ New Group] [+ New DM]   | | Write a message in # Team Chat... (@ to mention)      | | [ Archive Group ]             |
|                            | | [Emoji] [Attach (5 Max)] [Share Asset]         [Send] | | (Actions hidden in Team Chat) |
+----------------------------+-----------------------------------------------------------+-------------------------------+
```

### 8.2 Mobile Text Wireframe (360 px Viewport)

```
MOBILE SCREEN 1: CHANNEL LIST (/chat)        MOBILE SCREEN 2: ACTIVE CHAT (/chat/:id)
+---------------------------------------+    +---------------------------------------+
| [=] HACA OS       [Chat (3)] [Avatar] |    | [< Back]  # Team Chat     [Info (i)]  |
+---------------------------------------+    | 24 members • Company Square           |
| [ Search channels & messages...     ] |    +---------------------------------------+
|                                       |    | 10:30 AM                              |
| CHANNELS                              |    | [Avatar] John (Editor):               |
| [Hash] Team Chat                  [1] |    | Draft student reel is approved!       |
| Pinned • Maya: "November calendar..." |    |                                       |
|                                       |    | [MEDIA CARD: Student Voices Reel]     |
| [Hash] Video Production               |    | [Video Poster] APPROVED ★ 5.0         |
| John: "Footage clips uploaded"        |    | [ > Play ]   [ Download ]             |
|                                       |    |                                       |
| DIRECT MESSAGES                       |    | 10:32 AM                              |
| [Av] John Doe (Editor)            [2] |    | [My Avatar] You:                      |
| "Can you check the audio dip?"        |    | Shared to live channel!  ✓✓           |
|                                       |    +---------------------------------------+
| [Av] Sarah Smith (Designer)           |    | [Replying to John: "Draft student..."]|
| "Final poster dimensions attached"    |    | +-----------------------------------+ |
|                                       |    | | Message...                  [Snd] | |
| [+ New Group]        [+ Direct Msg]   |    | | [Attach]  [Emoji]  [44px touch]   | |
+---------------------------------------+    +---------------------------------------+
```

---

# 9. Data Models & Mongoose Schemas

### 9.1 Channel Model (`Channel.js`)
```javascript
import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['team', 'group', 'dm'],
      required: true,
      index: true,
    },
    systemSlug: {
      type: String,
      unique: true,
      sparse: true, // Only set for 'team-chat' singleton
    },
    name: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // For DMs: exactly two distinct user IDs sorted deterministically
    dmParticipantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    dmLookupKey: {
      type: String, // e.g. "userId1:userId2" (sorted)
      unique: true,
      sparse: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pinnedMessageIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatMessage',
      },
    ],
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

channelSchema.index({ type: 1, isArchived: 1, lastMessageAt: -1 });
export const Channel = mongoose.model('Channel', channelSchema);
```

### 9.2 ChannelMember Model (`ChannelMember.js`)
```javascript
import mongoose from 'mongoose';

const channelMemberSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roleInChannel: {
      type: String,
      enum: ['owner', 'member', 'read_only'],
      default: 'member',
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

channelMemberSchema.index({ channelId: 1, userId: 1 }, { unique: true });
export const ChannelMember = mongoose.model('ChannelMember', channelMemberSchema);
```

### 9.3 ChatMessage Model (`ChatMessage.js`)
```javascript
import mongoose from 'mongoose';

const chatAttachmentSchema = new mongoose.Schema(
  {
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: { type: String, required: true },
    kind: { type: String, enum: ['image', 'document', 'video'], required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },
  },
  { _id: true }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      enum: ['👍', '❤️', '😂', '🎉', '👀', '✅'],
      required: true,
    },
    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      maxlength: 4000,
      default: '',
    },
    replyToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
    },
    mentionedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isEveryoneMention: {
      type: Boolean,
      default: false,
    },
    attachments: [chatAttachmentSchema],
    reactions: [reactionSchema],
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: { type: Date, default: null },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // "Share to Chat" reference payload
    sharedMedia: {
      shareGrantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShareGrant', default: null },
      assetType: { type: String, enum: ['clip', 'submission'], default: null },
      assetId: { type: mongoose.Schema.Types.ObjectId, default: null },
      title: { type: String, default: null },
      deliverableTopic: { type: String, default: null },
      stageKey: { type: String, default: null },
      qualityRating: { type: Number, default: null },
      ownerName: { type: String, default: null },
      ownerAvatarUrl: { type: String, default: null },
      thumbnailUrl: { type: String, default: null },
      mediaUrl: { type: String, default: null },
      mimeType: { type: String, default: null },
      note: { type: String, default: null },
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ channelId: 1, createdAt: -1 });
export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
```

### 9.4 ShareGrant Model (`ShareGrant.js`)
```javascript
import mongoose from 'mongoose';

const shareGrantSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      enum: ['clip', 'submission'],
      required: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

shareGrantSchema.index({ channelId: 1, assetId: 1, isRevoked: 1 });
export const ShareGrant = mongoose.model('ShareGrant', shareGrantSchema);
```

---

# 10. REST API Endpoints Specification

All endpoints mount under `/api/chat/` and require JWT authentication via `authenticate`.

```
+---------------------------------------------------------------------------------------------------------+
| METHOD & PATH                  | PERMISSION & ROLES        | DESCRIPTION & STATUS CODES                 |
+---------------------------------------------------------------------------------------------------------+
| GET /api/chat/channels         | chat.use, chat.read       | Lists user's channels (Team, Groups, DMs,  |
|                                |                           | unread counts, last message). 200 OK.      |
| POST /api/chat/channels/group  | chat.group.create         | Creates new group channel (name, desc,     |
|                                | (admin, creative_head, sm)| memberIds). 201 Created.                   |
| POST /api/chat/channels/dm     | chat.use                  | Finds or creates a 1:1 DM channel.         |
|                                | (Non-executives only)     | Executives return 403 Forbidden. 200/201.  |
| GET /api/chat/channels/:id     | chat.use, chat.read       | Fetches channel metadata & member list.    |
|                                | (Must be channel member)  | 200 OK / 403 Forbidden / 404 Not Found.    |
| PATCH /api/chat/channels/:id   | Group Owner or Admin      | Renames group or updates description.      |
|                                |                           | Team Chat returns 400 Bad Request. 200 OK. |
| POST /api/chat/channels/:id/archive | Group Owner or Admin | Archives group (read-only mode). 200 OK.   |
| POST /api/chat/channels/:id/members | Group Owner or Admin | Adds members to group. 200 OK.             |
| DELETE /api/chat/channels/:id/members/:userId | Owner/Admin | Removes member from group. 200 OK.         |
| POST /api/chat/channels/:id/leave | Member of group        | Leaves group (Owner must transfer first).  |
| POST /api/chat/channels/:id/mute  | Member of channel      | Toggles channel mute state. 200 OK.        |
| GET /api/chat/channels/:id/messages | Channel member       | Infinite scroll messages (limit=50, cursor)|
| POST /api/chat/channels/:id/messages| chat.use (Non-exec)  | Sends text message, mentions, attachments. |
| PATCH /api/chat/messages/:id   | Author of message         | Edits own message (within 24h). 200 OK.    |
| DELETE /api/chat/messages/:id  | Author or chat.moderate   | Deletes message (toggles placeholder).      |
| POST /api/chat/messages/:id/reactions | chat.use (Non-exec)| Toggles 1 of 6 reactions. 200 OK.          |
| POST /api/chat/messages/:id/pin| Leader, Admin, Group Owner| Toggles pinned message status. 200 OK.      |
| POST /api/chat/upload          | chat.use (Non-exec)       | Uploads attachment (5 max, strict limits). |
| POST /api/chat/share           | Output owner, CH, SM, Admin| Creates ShareGrant & media card message.   |
| POST /api/chat/share/:id/revoke| Sharer, CH, Admin         | Revokes ShareGrant & invalidates media.    |
| GET /api/chat/shared-asset/:grantId | Channel member       | Securely streams or downloads shared asset.|
| GET /api/chat/search           | chat.use, chat.read       | Searches messages in channel or globally.  |
+---------------------------------------------------------------------------------------------------------+
```

---

# 11. Socket.io Event Protocol

### 11.1 Client-to-Server Events
* `chat:join` `{ channelId: string }`
  - Validates active `ChannelMember` record in MongoDB.
  - Sockets join room `channel:${channelId}`.
* `chat:leave` `{ channelId: string }`
  - Leaves room `channel:${channelId}`.
* `chat:typing` `{ channelId: string, isTyping: boolean }`
  - Broadcasts typing indicator to peers in room (excluding sender).
* `chat:read` `{ channelId: string, messageId: string }`
  - Updates `lastReadMessageId` and `lastReadAt` on `ChannelMember`.
  - Broadcasts read receipt update to room peers.

### 11.2 Server-to-Client Broadcast Events
* `chat:message:new` `{ channelId: string, message: ChatMessage }`
  - Emitted to `channel:${channelId}` upon new message creation.
* `chat:message:updated` `{ channelId: string, messageId: string, text: string, isEdited: boolean, editedAt: string }`
  - Emitted to `channel:${channelId}` when a message is edited.
* `chat:message:deleted` `{ channelId: string, messageId: string, isDeleted: boolean, deletedByRole: string }`
  - Emitted to `channel:${channelId}` when a message is deleted.
* `chat:reaction:updated` `{ channelId: string, messageId: string, reactions: Reaction[] }`
  - Emitted to `channel:${channelId}` when reactions change.
* `chat:pin:updated` `{ channelId: string, messageId: string, isPinned: boolean, pinnedBy: User }`
  - Emitted to `channel:${channelId}` when a message is pinned/unpinned.
* `chat:member:changed` `{ channelId: string, action: 'added' | 'removed' | 'left' | 'transferred', member: ChannelMember }`
  - Emitted to `channel:${channelId}` when membership mutates.
* `chat:typing:update` `{ channelId: string, userId: string, userName: string, isTyping: boolean }`
  - Real-time typing notification with automatic 3-second debouncing.
* `chat:read:update` `{ channelId: string, userId: string, messageId: string, seenCount?: number }`
  - Updates double ticks in DMs and hover count in Groups.
* `chat:share:revoked` `{ channelId: string, messageId: string, shareGrantId: string }`
  - Real-time invalidation of a revoked shared asset.

---

# 12. Idempotent Migration Plan

### Migration Script: `scripts/migrate-team-chat.js`
* **Purpose:** Ensure Team Chat exists and all current active users are backfilled as members.
* **Safety & Execution Controls:**
  - **Dry-Run by Default:** Running `node scripts/migrate-team-chat.js` analyzes the database and prints actions without mutating data.
  - **Confirmation Flag:** Requires `--confirm` to execute database writes.
  - **Backup Snapshot:** Generates a timestamped JSON backup under `scripts/backups/team_chat_pre_migration_<timestamp>.json`.
  - **Idempotency Guarantee:** If `Channel.findOne({ systemSlug: 'team-chat' })` exists, reuses it without duplicating. Checks `ChannelMember.findOne({ channelId, userId })` before creating membership records.

```javascript
// Step 1: Find or Create Team Chat Singleton
let teamChat = await Channel.findOne({ systemSlug: 'team-chat' });
if (!teamChat) {
  teamChat = await Channel.create({
    type: 'team',
    systemSlug: 'team-chat',
    name: 'Team Chat',
    description: 'General company channel for all HACA marketing staff.',
    isArchived: false,
  });
}

// Step 2: Query All Active Users
const activeUsers = await User.find({ status: 'active' });

// Step 3: Upsert ChannelMember Records
for (const user of activeUsers) {
  const isExec = user.role === 'executive';
  await ChannelMember.updateOne(
    { channelId: teamChat._id, userId: user._id },
    {
      $setOnInsert: {
        channelId: teamChat._id,
        userId: user._id,
        roleInChannel: isExec ? 'read_only' : 'member',
        isMuted: false,
        joinedAt: new Date(),
      },
    },
    { upsert: true }
  );
}
```

---

# 13. Files to Change, Dependencies & Technical Risks

### 13.1 Files to Create (Zero Code Added until Approval)
1. **Shared Schemas:**
   - `packages/shared/src/chat.schemas.ts`: Zod schemas for channel creation, message dispatch, reaction toggle, and share payload.
2. **Backend Domain Module (`apps/api/src/modules/chat/`):**
   - `channel.model.js`: Mongoose `Channel` schema.
   - `channelMember.model.js`: Mongoose `ChannelMember` schema.
   - `message.model.js`: Mongoose `ChatMessage` schema.
   - `shareGrant.model.js`: Mongoose `ShareGrant` schema.
   - `service.js`: Channel management, message sending, attachment checks, and ShareGrant validation.
   - `controller.js`: Request handlers and response mapping.
   - `routes.js`: Express routes with validation middleware.
   - `socket.js`: Dedicated Socket.io room joins, message events, and typing broadcasts.
3. **Frontend Pages & Components (`apps/web/src/pages/chat/`):**
   - `ChatPage.tsx`: Top-level `/chat` page mounting desktop 3-pane or mobile view.
   - `ChannelSidebar.tsx`: Channel list (Team Chat pinned, Groups, DMs, unread badges).
   - `ConversationPane.tsx`: Scrollable message stream, unread divider, date separators.
   - `MessageBubble.tsx`: Author avatar, text, emoji reactions, quoted reply, attachment gallery.
   - `ChatComposer.tsx`: Multiline textarea, Enter to send, Shift+Enter newline, emoji drawer, attach button, `@` autocomplete.
   - `ChannelDetailsDrawer.tsx`: Pinned messages list, channel members, shared media gallery.
   - `ShareToChatModal.tsx`: Dialog triggered from Review Studio and clip cards.
   - `ChatTopBarButton.tsx`: Top bar icon button with unread count pill badge.
4. **Migration Utility:**
   - `scripts/migrate-team-chat.js`: Safe idempotent migration script.

### 13.2 Existing Files to Modify
1. `packages/shared/src/index.ts`: Add `chat` to `NOTIFICATION_CATEGORIES` and export chat types.
2. `apps/api/src/server.js`: Mount `/api/chat` routes and register `setupChatSockets(io)`.
3. `apps/api/src/modules/notifications/service.js`: Support `chat` category in preference filtering.
4. `apps/web/src/components/Layout.tsx`: Insert `<ChatTopBarButton />` into top bar action cluster.
5. `apps/web/src/App.tsx`: Register `/chat` and `/chat/:channelId` routes.
6. `apps/web/src/pages/SettingsPage.tsx`: Add "Chat" notification toggle row.
7. `apps/web/src/pages/work/workspaces/ClipCard.tsx`: Add "Share to chat" action on approved clips.
8. `apps/web/src/pages/feedback/review-studio/ReviewStudioPage.tsx`: Add "Also share to Team chat" approval checkbox and "Share to chat" button.
9. `apps/web/src/hooks/useSocket.ts`: Deprecate old task stubs, wire standard chat socket events.

### 13.3 Dependencies
* **Strict Compliance:** **Zero new dependencies.**
  - Built-in Unicode character set used for emoji picker (no `emoji-picker-react` or external icon packs).
  - Native HTML5 Canvas and Lucide icons used for UI.
  - Native browser `fetch` and Socket.io client used for networking.

### 13.4 Technical Risks & Mitigations
1. **Risk: Large File Upload Memory Pressure on Socket / API:**
   - *Mitigation:* File uploads never stream over Socket.io. Sockets handle lightweight text events and metadata. Files upload directly via HTTP multipart Multer endpoints with strict size caps (image 20MB, docs 25MB, video 100MB).
2. **Risk: Unauthorized Access to Shared Creative Assets:**
   - *Mitigation:* `ShareGrant` records are checked cryptographically on every asset retrieval. If a grant is revoked, subsequent stream or download requests return `403 Forbidden`. Internal pipelines, ratings, and feedback remain completely isolated.
3. **Risk: Notification Floods on Active Channels:**
   - *Mitigation:* Per-channel mute allows workers to mute busy channels while guaranteeing that direct `@mentions` break through. Header unread badge aggregates only unmuted channels.

