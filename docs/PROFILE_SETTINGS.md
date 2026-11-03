# Profile and Settings for All Roles — Functional & Technical Specification

**Document Version:** 1.0.0  
**Authority:** Single Source of Truth for Profile, Settings, Session Security, Avatars, and Onboarding  
**Status:** SPECIFICATION READY FOR APPROVAL (PART A)  
**Applicable Roles:** `admin`, `creative_head`, `sm_manager`, `executive`, `team_member`  

---

## 1. Executive Summary & Architecture Principles

This specification replaces all legacy My Account, profile, and onboarding implementations across HACA Marketing OS. Both the Profile page (`/profile`) and Settings page (`/settings`) follow a single, unified visual layout for all five canonical roles, where only the designated **Role Panel** slot adapts to display relevant operational data.

### Core Architectural Principles
1. **One Unified Layout Shell:** Every role views the identical layout grid, glassmorphism tokens, and responsive structure.
2. **Strict RBAC & Privacy Scoping:** Contact details (phone, email, WhatsApp) are strictly restricted by role. Workers can only view profiles of teammates collaborating on the same content piece, and contact details are masked. Executives have all contact details masked.
3. **Zero Deprecated Dependencies:** Image cropping is implemented using standard HTML5 Canvas with circular masking and a zoom slider, requiring **zero new third-party npm dependencies**.
4. **Strict Schema Validation:** All endpoints live under `/me/...` (or scoped `/people/...`), enforcing strict Zod validation with `.strict()` to reject unknown keys. Role, email, department, job role, weekly capacity, and stage work preferences can never be updated by users through `/me/...`.
5. **Session-Level Device Revocation:** Replace the single-token hash on `Person` with a dedicated `Session` model tracking device labels (parsed from the User-Agent), hashed IP addresses, last used timestamps, and refresh token families.

---

## 2. Current State Audit (File Paths, Duplicates & Dead Code)

### 2.1 My Account Modal and Page
* **File Paths:**
  * `apps/web/src/pages/MyAccountPage.tsx`
  * `apps/web/src/components/Layout.tsx` (lines 615–650)
  * `apps/web/src/App.tsx` (routes `/account` and `/my-account`)
* **Current Implementation:**
  * `MyAccountPage.tsx` renders a read-only view with user initials in a dark purple box, role badge, email, active stage preferences (`WORK_PREFERENCES`), operational attributes (job role, department, capacity, brand scoping), and `<RatingsFeedbackSection>`.
  * **Limitations:** The page is 100% read-only. A user cannot edit their photo, name, phone, about, or preferences.
  * **Modal Status:** In legacy FORGE, an account modal existed. In the current codebase, clicking the user profile button in `Layout.tsx` navigates directly to `/account`. However, no editing modal exists and the avatar button has no dropdown.

### 2.2 First-Login (Welcome) Step
* **File Paths:**
  * None (`/welcome` route and component are completely absent from `apps/web/src/App.tsx`).
* **Current Implementation:**
  * In `apps/api/src/modules/people/model.js`, `Person` has `mustSetPassword: { type: Boolean, default: false }`, but has **no `profileCompletedAt`** field.
  * When a user logs in, `RootRedirect` in `apps/web/src/App.tsx` directly routes `team_member` to `/my-work` and all other roles to `/dashboard`.
  * New team members approved via access requests are never prompted to complete their profile (name, phone, photo).

### 2.3 Avatar Fields & Current Rendering Locations
* **Backend Data Model (`apps/api/src/modules/people/model.js`):**
  * `Person` model has **zero avatar fields** (`avatarUrl` and `avatarStorageId` do not exist).
* **Frontend Rendering Locations (Inline Duplicates):**
  1. `apps/web/src/components/Layout.tsx` (lines 624–627): Hardcoded 2-letter uppercase initials in a `div.w-9.h-9.rounded-full.bg-gradient-to-tr.from-slate-800.to-slate-900` with an obsolete green online-presence dot (`span.absolute.w-2.5.h-2.5.bg-emerald-500.rounded-full`).
  2. `apps/web/src/pages/admin/UsersPage.tsx` (lines 467–473): Initials rendered inside `div.w-10.h-10.rounded-full.bg-gradient-to-tr.from-purple-500/20.to-indigo-500/20`.
  3. `apps/web/src/pages/MyAccountPage.tsx` (lines 44–46): Initials inside `div.w-16.h-16.rounded-3xl.bg-gradient-to-tr.from-slate-900.to-indigo-800`.
  4. `apps/web/src/pages/feedback/review-studio/ReviewStudioSidebar.tsx` (line 214): `span.w-5.h-5.rounded-full.bg-indigo-600.text-[10px]`.
  5. `apps/web/src/pages/work/writing-studio/WritingStudioSidebar.tsx` (line 789): `div.w-5.h-5.rounded-full.bg-indigo-100.text-indigo-700`.
  6. `apps/web/src/pages/calendar/TrackerTab.tsx` (line 531): Displays text name only (`span.text-slate-700.font-medium`), no visual avatar chip.
  7. `apps/web/src/pages/work/workspaces/MediaThread.tsx`: Renders message bubbles with text labels only, lacking user avatar chips.
* **Findings:** No unified `<Avatar />` component exists. Every component re-implements initials extraction and inline CSS styles.

### 2.4 Notification Preferences Endpoint and Component
* **File Paths:**
  * `apps/api/src/modules/notifications/routes.js` (`GET /preferences`, `PUT /preferences`)
  * `apps/api/src/modules/notifications/service.js` (`updateUserPreferences`, `handleDomainEvent`)
  * `apps/web/src/components/NotificationPreferencesModal.tsx`
  * `apps/web/src/components/NotificationCenter.tsx` & `apps/web/src/pages/NotificationsPage.tsx`
* **Current Implementation:**
  * Stored on `Person` under `notificationPreferences`:
    * `email`: `requestUpdates`, `taskAssigned`, `taskBlocked`, `reviewDecisions`, `deadlineReminders`, `dailyDigest`.
    * `inApp`: `requestUpdates`, `taskAssigned`, `taskBlocked`, `reviewDecisions`, `deadlineReminders`, `mentions`.
  * Frontend component is a floating modal (`NotificationPreferencesModal.tsx`) opened from the bell icon dropdown.
* **Dead Code & Legacy References:**
  * `NotificationPreferencesModal.tsx` contains retired references to "Request Updates & Triage Decisions" and "Daily Operational Digest ... (Leads)".
  * Uses raw `fetch` instead of `apiFetch`.
  * Disconnected from any unified Settings page.

### 2.5 Refresh Tokens & Sessions Storage
* **File Paths:**
  * `apps/api/src/modules/people/model.js` (`refreshTokenHash: { type: String, select: false }`)
  * `apps/api/src/modules/auth/service.js` (`loginUser`, `refreshTokens`, `logoutUser`)
* **Current Implementation:**
  * A single SHA-256 hash string (`refreshTokenHash`) is stored on the `Person` document.
  * Logging in from a second device or browser silently overwrites `refreshTokenHash`, which unexpectedly invalidates previous device sessions.
* **Can they list devices? NO.**
  * No `Session` collection exists.
  * No user-agent parsing or device labeling.
  * No IP logging or hashed IP storage.
  * No session timestamps (`createdAt`, `lastUsedAt`).
  * No refresh token families to revoke individual devices.

### 2.6 Password Change
* **File Paths:**
  * `apps/api/src/modules/auth/routes.js` (`POST /change-password`)
  * `apps/api/src/modules/auth/service.js` (`changeUserPassword`)
  * `@mmp/shared/src/index.ts` (`changePasswordSchema`)
* **Current Implementation:**
  * Backend route exists at `/api/auth/change-password`.
  * Schema validates `currentPassword` (min 1) and `newPassword` (min 8, uppercase, number).
* **Gaps:**
  * Does NOT take or validate `confirmPassword`.
  * Does NOT enforce that `newPassword !== currentPassword`.
  * Does NOT send a mandatory security notification/email when the password changes.
  * Route is NOT rate-limited (unlike `/login` and `/forgot-password`).
  * Path is `/api/auth/change-password` instead of `/api/me/password`.
  * **Frontend:** There is ZERO in-app UI for an authenticated user to change their password (only the public `/set-password?token=...` page exists).

### 2.7 User Menu Location
* **File Path:**
  * `apps/web/src/components/Layout.tsx` (lines 615–650)
* **Current Implementation:**
  * Located in the top-right header:
    * An avatar button displaying initials and user name that navigates directly to `/account`.
    * An adjacent log-out button (`<LogOut className="w-4 h-4" />`) that calls `logout()`.
  * **Missing:** No dropdown menu exists. The requirement specifies that clicking the avatar opens a menu with: **View profile**, **Settings**, and **Sign out**.

### 2.8 Duplicates and Dead Code Summary
| Item | Current Location | Issue / Status | Action |
| :--- | :--- | :--- | :--- |
| My Account Modal | N/A (deleted earlier) | Referenced in legacy docs | Remove obsolete modal references |
| Inline Initials Rendering | `Layout.tsx`, `UsersPage.tsx`, `MyAccountPage.tsx`, `ReviewStudioSidebar.tsx`, `WritingStudioSidebar.tsx` | Duplicate code across 5 files | Replace with unified `<Avatar />` component |
| Presence Indicator | `Layout.tsx` line 627 (`bg-emerald-500`) | Fake presence dot (no presence system exists; presence is explicitly forbidden) | Remove completely |
| Legacy Notification Modal | `NotificationPreferencesModal.tsx` | References retired CRM/Leads and triage tickets | Retire modal; implement in `/settings` |
| Multiple Account Routes | `apps/web/src/App.tsx` (`/account` and `/my-account`) | Redundant route paths | Redirect `/account` and `/my-account` to `/profile` |
| Brand Scoping Display | `MyAccountPage.tsx` line 143 ("All 7 Brand Profiles") | Violates single-brand HACA-only mode | Remove brand scoping display from profile |
| Single-session token storage | `Person.refreshTokenHash` | Cannot list devices or revoke individually | Replace with `Session` collection |

---

## 3. Data Model Changes

### 3.1 `Person` (User) Model Updates
The `Person` schema in `apps/api/src/modules/people/model.js` and `@mmp/shared` gains the following fields:

```typescript
// Additions to Person Schema
{
  avatarUrl: { type: String, default: null, trim: true },
  avatarStorageId: { type: String, default: null, trim: true },
  preferredName: { type: String, default: '', trim: true, maxlength: 60 },
  phone: { type: String, default: '', trim: true }, // Normalized & validated E.164 / Indian standard
  whatsappNumber: { type: String, default: '', trim: true }, // Normalized & validated
  languages: {
    type: [String],
    default: [],
    validate: [(val: string[]) => val.length <= 5, 'Maximum 5 languages permitted']
  },
  about: { type: String, default: '', trim: true, maxlength: 200 }, // Max 200 characters
  skills: {
    type: [String],
    default: [],
    validate: [
      (val: string[]) => val.length <= 10 && val.every((s) => s.length <= 30),
      'Maximum 10 skill tags, up to 30 characters each'
    ]
  },
  preferences: {
    startPage: {
      type: String,
      enum: ['Home', 'My Work', 'Calendar'],
      default: 'Home'
    },
    dateFormat: {
      type: String,
      enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
      default: 'DD/MM/YYYY'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '12h'
    },
    weekStart: {
      type: String,
      enum: ['monday', 'sunday'],
      default: 'monday'
    }
  },
  notificationPrefs: {
    mySteps: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    approvalsRevisions: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    messagesComments: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    deadlinesOverdue: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    planUpdates: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
    system: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true } } // Admins only
  },
  profileCompletedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null } // Synced on sign-in
}
```

* **String Sanitization:** All incoming text strings (`preferredName`, `about`, `skills`, `phone`, `whatsappNumber`, `languages`) are stripped of HTML tags via `sanitize-html` / regex.
* **Member Since:** Rendered directly on the client from `createdAt`.
* **Prohibited Additions:** No 2FA, dark mode, online presence, or unapproved personal fields are added.

### 3.2 `Session` Model (`apps/api/src/modules/auth/session.model.js`)
A dedicated Mongoose model tracks sign-in sessions for device revocation:

```javascript
const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    required: true,
    index: true,
  },
  deviceLabel: {
    type: String,
    required: true,
    trim: true,
  }, // e.g. "Chrome 122 on Windows", "Safari on iOS", "Firefox on macOS"
  ipHash: {
    type: String,
    required: true,
    index: true,
  }, // SHA-256 of IP address
  refreshTokenHash: {
    type: String,
    required: true,
    select: false,
    index: true,
  },
  refreshTokenFamily: {
    type: String,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  revokedAt: {
    type: Date,
    default: null,
  }
});
```

* **Device Label Extraction:** Parsed cleanly from the incoming `User-Agent` string (browser family + OS).
* **IP Hashing:** `crypto.createHash('sha256').update(ip).digest('hex')`. Raw IP addresses are never persisted.
* **Session Lifecycle:**
  * On login: Create a new `Session` record, generate a refresh token containing `sessionId` and `refreshTokenFamily`.
  * On token refresh: Verify token against active `Session` and `refreshTokenHash`, update `lastUsedAt`, rotate `refreshTokenHash` within the same family.
  * On single device revocation (`DELETE /me/sessions/:id`): Revoke or delete that specific `Session`.
  * On revoke others (`POST /me/sessions/revoke-others`): Revoke or delete all active sessions for `userId` except the current session ID.

---

## 4. API Endpoints Specification

All endpoints are strictly authenticated and live under the signed-in user's scope. All schemas enforce `.strict()` to reject unknown keys. Read-only fields (`role`, `email`, `department`, `jobRole`, `capacity`, `workPreferences`) are strictly rejected on update.

### 4.1 Profile Endpoints

#### `GET /api/me/profile`
* **Access:** Authenticated (any role).
* **Response (200):**
  ```json
  {
    "data": {
      "id": "6ae...",
      "name": "Jane Doe",
      "preferredName": "Jane",
      "email": "jane@example.com",
      "role": "creative_head",
      "jobRole": "Creative Director",
      "department": "Creative",
      "status": "active",
      "avatarUrl": "https://.../avatar.webp",
      "phone": "+919876543210",
      "whatsappNumber": "+919876543210",
      "languages": ["English", "Hindi"],
      "about": "Passionate creative leader with 8+ years experience in brand storytelling.",
      "skills": ["Creative Direction", "Typography", "Video Editing"],
      "weeklyCapacityHours": 40,
      "workPreferences": ["Script", "Shoot", "Edit", "Design"],
      "profileCompletedAt": "2026-10-24T12:00:00.000Z",
      "createdAt": "2026-01-15T09:30:00.000Z",
      "lastLoginAt": "2026-10-29T08:15:00.000Z"
    }
  }
  ```

#### `PATCH /api/me/profile`
* **Access:** Authenticated (any role).
* **Request Schema (`profileUpdateSchema.strict()`):**
  * `preferredName`: `z.string().trim().max(60).optional()`
  * `phone`: `z.string().trim().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format").optional()`
  * `whatsappNumber`: `z.string().trim().regex(/^\+?[1-9]\d{6,14}$/, "Invalid WhatsApp number format").optional().or(z.literal(''))`
  * `languages`: `z.array(z.string().trim().max(40)).max(5).optional()`
  * `about`: `z.string().trim().max(200).optional()`
  * `skills`: `z.array(z.string().trim().max(30)).max(10).optional()`
  * *Rejects unknown keys (`role`, `email`, `department`, `jobRole`, `capacity`, etc. cause 400 validation error).*
* **ActivityEvent:** Writes `ActivityEvent` with `action: 'profile.updated'`, `entityType: 'person'`, `metadata: { changedFields: [...] }` (field names only, no values).

#### `POST /api/me/avatar/sign`
* **Access:** Authenticated (any role).
* **Request Schema:** `{ fileName: z.string(), fileSize: z.number().max(5 * 1024 * 1024), fileType: z.enum(['image/png', 'image/jpeg', 'image/webp']) }`
* **Behavior:** Generates signed Cloudinary upload params targeting `marketing_portal/avatars/user_{userId}_{uuid}` with public listing blocked.

#### `POST /api/me/avatar`
* **Access:** Authenticated (any role).
* **Behavior:** Handles local direct multipart upload (Multer) for environments without Cloudinary. Enforces `png`, `jpg`, `jpeg`, `webp` up to 5 MB. Deletes old avatar file if present. Updates `user.avatarUrl` and `user.avatarStorageId`.
* **ActivityEvent:** Writes `action: 'avatar.updated'`.

#### `DELETE /api/me/avatar`
* **Access:** Authenticated (any role).
* **Behavior:** Deletes avatar asset from Cloudinary or local `/uploads` directory using `avatarStorageId`. Sets `user.avatarUrl = null` and `user.avatarStorageId = null`.
* **ActivityEvent:** Writes `action: 'avatar.removed'`.

---

### 4.2 Settings & Security Endpoints

#### `GET /api/me/settings`
* **Access:** Authenticated (any role).
* **Response (200):**
  ```json
  {
    "data": {
      "preferences": {
        "startPage": "Home",
        "dateFormat": "DD/MM/YYYY",
        "timeFormat": "12h",
        "weekStart": "monday"
      },
      "notificationPrefs": {
        "mySteps": { "inApp": true, "email": true },
        "approvalsRevisions": { "inApp": true, "email": true },
        "messagesComments": { "inApp": true, "email": false },
        "deadlinesOverdue": { "inApp": true, "email": true },
        "planUpdates": { "inApp": true, "email": false },
        "system": { "inApp": true, "email": true }
      }
    }
  }
  ```

#### `PATCH /api/me/settings`
* **Access:** Authenticated (any role).
* **Request Schema (`settingsUpdateSchema.strict()`):**
  * `preferences`: `z.object({ startPage: z.enum(['Home', 'My Work', 'Calendar']).optional(), dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(), timeFormat: z.enum(['12h', '24h']).optional(), weekStart: z.enum(['monday', 'sunday']).optional() }).optional()`
  * `notificationPrefs`: `z.object({ mySteps: z.object({ inApp: z.boolean(), email: z.boolean() }).optional(), approvalsRevisions: z.object({ inApp: z.boolean(), email: z.boolean() }).optional(), messagesComments: z.object({ inApp: z.boolean(), email: z.boolean() }).optional(), deadlinesOverdue: z.object({ inApp: z.boolean(), email: z.boolean() }).optional(), planUpdates: z.object({ inApp: z.boolean(), email: z.boolean() }).optional(), system: z.object({ inApp: z.boolean(), email: z.boolean() }).optional() }).optional()`
  * *Note: `system` category is only persisted for `admin` role.*
* **ActivityEvent:** Writes `action: 'settings.updated'`.

#### `POST /api/me/password`
* **Access:** Authenticated (any role). Rate limited: 5 attempts per 15 minutes.
* **Request Schema (`changePasswordStrictSchema.strict()`):**
  * `currentPassword`: `z.string().min(1)`
  * `newPassword`: `z.string().min(8).regex(/[A-Z]/, "Requires at least one uppercase letter").regex(/[0-9]/, "Requires at least one number")`
  * `confirmPassword`: `z.string().min(1)`
  * *Refinement: `newPassword === confirmPassword` AND `newPassword !== currentPassword`.*
* **Security Action:** Dispatches immediate security email (`templates().securityNotice`) and in-app security alert. Cannot be disabled.
* **ActivityEvent:** Writes `action: 'password.changed'`.

#### `GET /api/me/sessions`
* **Access:** Authenticated (any role).
* **Response (200):**
  ```json
  {
    "data": [
      {
        "id": "sess_123",
        "deviceLabel": "Chrome 122 on Windows",
        "createdAt": "2026-10-25T14:20:00.000Z",
        "lastUsedAt": "2026-10-29T10:00:00.000Z",
        "isCurrent": true
      },
      {
        "id": "sess_456",
        "deviceLabel": "Safari on iOS",
        "createdAt": "2026-10-27T08:10:00.000Z",
        "lastUsedAt": "2026-10-28T19:30:00.000Z",
        "isCurrent": false
      }
    ]
  }
  ```

#### `DELETE /api/me/sessions/:id`
* **Access:** Authenticated (any role).
* **Behavior:** Revokes target session. If target is the current session, cookie is cleared and user is logged out.
* **ActivityEvent:** Writes `action: 'session.revoked'`.

#### `POST /api/me/sessions/revoke-others`
* **Access:** Authenticated (any role).
* **Behavior:** Revokes all active sessions for `userId` except the current session ID.
* **ActivityEvent:** Writes `action: 'sessions.revoked_others'`.

#### `POST /api/me/change-request`
* **Access:** Authenticated (any role).
* **Request Schema (`changeRequestSchema.strict()`):**
  * `requestedChanges`: `z.string().trim().min(5).max(1000)`
* **Behavior:** Dispatches in-app notification and email to every active user with role `admin`. Writes `ActivityEvent` with `action: 'profile.change_requested'`.

---

### 4.3 People Profile & Drawer Scoping

#### `GET /api/people/:id/profile`
* **Access:** Authenticated.
* **Role Visibility Rules:**
  1. `admin`, `creative_head`, `sm_manager`: Full profile including contact details (`email`, `phone`, `whatsappNumber`).
  2. `executive`: Full profile with contact details masked (`email: "••••••••@••••", phone: "••••••••••", whatsappNumber: "••••••••••"`).
  3. `team_member` (worker):
     * **Content Piece Sharing Check:** Must share at least one `ContentPiece` with the target person (as stage owner or collaborator).
     * If NO shared piece: Returns **`403 Forbidden`** (`code: 'TEAMMATE_OUTSIDE_SHARED_PIECE'`).
     * If shared piece exists: Returns profile with contact details completely omitted/masked.

#### Admin Management Endpoints
* `DELETE /api/people/:id/avatar`: Admin can remove an inappropriate profile photo.
* `PATCH /api/people/:id/basic-info`: Admin can correct a person's name or phone from the People console.

---

## 5. UI & Component Architecture

### 5.1 Profile Page (`/profile`)
1. **Header Card:**
   * Circle avatar preview with zoom & circular crop modal.
   * "Change photo" and "Remove photo" (with confirmation dialog).
   * Display name: Preferred name displayed prominently; full legal name underneath.
   * Role badge, job role, department, status pill (`Active`).
   * "Member since [Date]" (formatted with user's date format preference).
   * "Last sign-in [Date, Time]" (formatted with user's date/time preference).
2. **About Me Form Section:**
   * Preferred name (text input).
   * Phone (normalised phone input).
   * WhatsApp number + "Same as phone" toggle switch (auto-copies phone).
   * Languages (multi-tag input, max 5 tags).
   * About Me (textarea, max 200 characters with live character counter).
   * Skills & Tools (tag input with add/remove pills, max 10 tags, up to 30 chars each).
   * Action bar: "Save Changes" (primary) and "Cancel" (resets form). Unsaved changes dirty-state banner with route exit guard. Inline field validation errors under each field.
3. **Work Details Section (Read-Only):**
   * Role badge, job role, department.
   * Work preferences as chips (`Script`, `Shoot`, `Edit`, `Design`, `Post`).
   * Weekly capacity (e.g. `40 hrs/wk`).
   * Email address (read-only with padlock icon).
   * "Request a change" button: Opens modal with short message field (`"Explain what needs updating in your role or capacity"`). Notifies all admins.
4. **Role Panel (1 Slot, 5 Dynamic Contents):**
   * **`admin`:** Pending access requests link with badge count (`/admin/access-requests`), active staff distribution by role.
   * **`creative_head`:** Stages waiting for approval count + link (`/feedback`), content plans waiting review count + link (`/calendar?tab=plans`).
   * **`sm_manager`:** Plan status distribution (Draft, Submitted, Approved), count of stages needing an owner, late items count.
   * **`executive`:** Marketing pulse throughput scorecard (active content pieces, on-time health, department output). Read-only.
   * **`team_member`:** My open steps count, current weekly workload hours, utilization band (<85% Optimal, >=85% Over capacity), personal on-time completion rate.
   * *Rule:* Uses existing backend services. Hides missing/empty metrics cleanly without broken layouts.
5. **Ratings & Feedback Section:**
   * Reuses `<RatingsFeedbackSection personId={user.id} personName={user.name} isOwnProfile={true} />`.

---

### 5.2 Settings Page (`/settings`)
Layout: Left vertical tab navigation on desktop (>768px), stacked sections on mobile (360px).

1. **Security Section:**
   * Change Password card:
     * Current password field with visibility toggle.
     * New password field + confirm password field.
     * Real-time password strength rules list:
       * `[✓/✗] Minimum 8 characters`
       * `[✓/✗] At least one uppercase letter`
       * `[✓/✗] At least one number`
       * `[✓/✗] Different from current password`
     * Notice: *"A security alert email will be sent to your registered address upon password change."*
   * Device & Session List:
     * Lists active sessions with device icon, device label (`Chrome on Windows`), last active timestamp, and `"This device"` badge.
     * `"Sign out"` button per device.
     * `"Sign out all other devices"` primary action button with confirmation.
2. **Notification Preferences Section:**
   * Table / list of toggles for **In-App** and **Email**:
     * My steps (`mySteps`) — When tasks are assigned or handoffs ready.
     * Approvals and revisions (`approvalsRevisions`) — Review requests and rework notes.
     * Messages and comments (`messagesComments`) — Comments in workspaces and threads.
     * Deadlines and overdue (`deadlinesOverdue`) — 24h reminders and overdue alerts.
     * Plan updates (`planUpdates`) — Plan submissions and approvals.
     * System notices (`system`) — New user requests (visible strictly to `admin`).
   * Category visibility is filtered by role (e.g. workers only see steps, messages, deadlines; managers see plans and approvals).
   * Notice: *"Mandatory security notices (password changes, session alerts) cannot be disabled."*
3. **Preferences Section:**
   * Start Page dropdown:
     * Options tailored to role permissions:
       * `admin`, `creative_head`, `sm_manager`, `executive`: `Home`, `Calendar`, `My Work`.
       * `team_member`: `My Work`, `Home`.
   * Date Format dropdown: `DD/MM/YYYY` (default), `MM/DD/YYYY`, `YYYY-MM-DD`.
   * Time Format dropdown: `12h (e.g. 02:30 PM)` or `24h (e.g. 14:30)`.
   * Week Starts On dropdown: `Monday` (default) or `Sunday`.
   * Global Application: Preferences immediately update local state and context, governing calendar grids, tracker columns, and date format utilities across the app.

---

### 5.3 First-Login Welcome Step (`/welcome`)
* Triggered automatically upon sign-in if `!user.profileCompletedAt`.
* Fullscreen glassmorphic card:
  1. Header: *"Welcome to HACA Marketing OS. Let's set up your profile."*
  2. Legal name (pre-filled from access request, editable).
  3. Mobile phone number (required, with validation).
  4. Avatar upload & circular crop (optional, can skip photo).
  5. Action: `"Complete & Continue to Dashboard"` (disabled until name and valid phone are present).
* On commit: Sends `PATCH /api/me/profile`, marks `profileCompletedAt = new Date()`, redirects to designated start page.

---

### 5.4 Universal `<Avatar />` Component
* **Props:**
  ```typescript
  interface AvatarProps {
    url?: string | null;
    name: string;
    userId?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    alt?: string;
  }
  ```
* **Dimensions:**
  * `xs`: `20px x 20px` (`w-5 h-5 text-[10px]`)
  * `sm`: `28px x 28px` (`w-7 h-7 text-xs`)
  * `md`: `36px x 36px` (`w-9 h-9 text-xs`)
  * `lg`: `48px x 48px` (`w-12 h-12 text-sm font-bold`)
  * `xl`: `80px x 80px` (`w-20 h-20 text-2xl font-black`)
* **Color Derivation:** Deterministic background hue derived from hash of `userId || name`.
* **Zero Presence Indicator:** Prohibits rendering presence indicators (no green dots).

---

## 6. Text Wireframes

### 6.1 Profile Page (`/profile`) — Desktop View (1366 px)
```
+----------------------------------------------------------------------------------------------------+
|  [HACA Logo]   Home   Plans   Tracker   Approvals   Team load   Problems   Reports   People   [Avatar v] |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  PROFILE                                                                                           |
|  +-----------------------------------------------------------------------------------------------+ |
|  | [ Avatar XL ]  Jane Doe (Preferred: Jane)                        [ Active ]                   | |
|  | (Change Photo) Creative Head • Creative Department               Member since: 15/01/2026     | |
|  | (Remove Photo)                                                   Last sign-in: 29/10/2026     | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  +--------------------------------------------------+ +------------------------------------------+ |
|  | ABOUT ME                                         | | WORK DETAILS (Read-only)                 | |
|  | Preferred Name: [ Jane                         ] | | Role: Creative Head                      | |
|  | Phone:          [ +91 98765 43210              ] | | Job Role: Creative Director              | |
|  | WhatsApp:       [ +91 98765 43210 ] [x] Same     | | Department: Creative                     | |
|  | Languages:      [ English x ] [ Hindi x ]        | | Capacity: 40 hrs / week                  | |
|  | About (200c):   [ Leading the creative story.. ] | | Stage Prefs: [Script] [Shoot] [Edit]     | |
|  |                 142/200 characters               | | Email: [ jane@example.com (Locked)     ] | |
|  | Skills & Tools: [ Direction x ] [ Scripting x  ] | |                                          | |
|  |                                                  | | [ Request a change in role / capacity  ] | |
|  | [ Cancel ]              [ Save Changes (Active)] | +------------------------------------------+ |
|  +--------------------------------------------------+                                              |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | ROLE PANEL (Creative Head Content)                                                            | |
|  |  +------------------------------------+  +--------------------------------------------------+ | |
|  |  | Deliverables Waiting Approval: 6   |  | Calendar Plans Waiting Review: 2                 | | |
|  |  | [ View Review Studio Queue -> ]    |  | [ View Plans Tab -> ]                            | | |
|  |  +------------------------------------+  +--------------------------------------------------+ | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | RATINGS & FEEDBACK                                                                            | |
|  |  Quality Score: 4.8 / 5.0 (★ ★ ★ ★ ★) • 38 Reviews Recorded • Rolling 90d Trend              | |
|  +-----------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

### 6.2 Profile Page (`/profile`) — Mobile View (360 px)
```
+-----------------------------------+
| [=] HACA Marketing OS   [Avatar]  |
+-----------------------------------+
| PROFILE                           |
| +-------------------------------+ |
| |        [ Avatar XL ]          | |
| |     [ Change ] [ Remove ]     | |
| |                               | |
| | Jane Doe                      | |
| | (Preferred: Jane)             | |
| | Creative Head • Creative      | |
| | [ Active Badge ]              | |
| | Member: 15/01/2026            | |
| | Last sign-in: 29/10/2026      | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | ABOUT ME                      | |
| | Preferred Name:               | |
| | [ Jane                      ] | |
| | Phone:                        | |
| | [ +91 98765 43210           ] | |
| | WhatsApp:                     | |
| | [ +91 98765 43210           ] | |
| | [x] Same as phone             | |
| | Languages:                    | |
| | [ English x ] [ Hindi x ]     | |
| | About:                        | |
| | [ Leading creative team...  ] | |
| | 142/200 chars                 | |
| | Skills:                       | |
| | [ Direction x ] [ Script x ]  | |
| |                               | |
| | [ Save Changes (44px)       ] | |
| | [ Cancel                    ] | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | WORK DETAILS (Read-only)      | |
| | Role: Creative Head           | |
| | Dept: Creative                | |
| | Capacity: 40 hrs/wk           | |
| | Stages:                       | |
| | [Script] [Shoot] [Edit]       | |
| | Email:                        | |
| | jane@example.com (Locked)     | |
| |                               | |
| | [ Request a Change (44px)   ] | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | ROLE PANEL                    | |
| | Waiting Approvals: 6          | |
| | [ Go to Approvals -> ]        | |
| | Waiting Plans: 2              | |
| | [ Go to Plans -> ]            | |
| +-------------------------------+ |
|                                   |
| +-------------------------------+ |
| | RATINGS & FEEDBACK            | |
| | Score: 4.8 / 5.0 (38 reviews) | |
| +-------------------------------+ |
+-----------------------------------+
```

### 6.3 Settings Page (`/settings`) — Desktop View (1366 px)
```
+----------------------------------------------------------------------------------------------------+
|  SETTINGS                                                                                          |
|  +--------------------+  +-----------------------------------------------------------------------+ |
|  | (1) Security       |  | SECURITY & SESSIONS                                                   | |
|  | (2) Notifications  |  |                                                                       | |
|  | (3) Preferences    |  | Change Password                                                       | |
|  +--------------------+  | Current Password: [ ••••••••••••             ]                        | |
|                          | New Password:     [ ••••••••••••             ]                        | |
|                          | Confirm Password: [ ••••••••••••             ]                        | |
|                          |  [✓] 8+ chars  [✓] 1 uppercase  [✓] 1 number  [✓] Different           | |
|                          | Notice: Security email confirmation dispatched on save.               | |
|                          | [ Update Password ]                                                   | |
|                          |                                                                       | |
|                          | Active Sign-in Sessions                                               | |
|                          | +-------------------------------------------------------------------+ | |
|                          | | Chrome 122 on Windows (Current Device)   Active now   [ This Dev ]| | |
|                          | | Safari on iPhone 15                      2h ago       [ Sign Out ]| | |
|                          | +-------------------------------------------------------------------+ | |
|                          | [ Sign Out All Other Devices ]                                        | |
|                          +-----------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

### 6.4 Settings Page (`/settings`) — Mobile View (360 px)
```
+-----------------------------------+
| SETTINGS                          |
| [ Security ] [ Notifs ] [ Prefs ] |
+-----------------------------------+
| CHANGE PASSWORD                   |
| Current:                          |
| [ ••••••••••••                  ] |
| New:                              |
| [ ••••••••••••                  ] |
| Confirm:                          |
| [ ••••••••••••                  ] |
| [✓] 8+  [✓] Upper  [✓] Number     |
| [ Update Password (44px)        ] |
|                                   |
| ACTIVE SESSIONS                   |
| +-------------------------------+ |
| | Chrome on Windows             | |
| | [ Current Device Badge ]      | |
| +-------------------------------+ |
| | Safari on iPhone              | |
| | Last used: 2h ago             | |
| | [ Revoke Session (44px)     ] | |
| +-------------------------------+ |
| [ Sign Out Other Devices (44px) ] |
+-----------------------------------+
```

### 6.5 User Avatar Dropdown Menu
```
+-----------------------------------+
| [ Avatar ] Jane Doe (Creative) [v]|
+-----------------------------------+
|  Signed in as                     |
|  jane@example.com                 |
|  -------------------------------- |
|  [User]     View profile          |
|  [Settings] Settings              |
|  -------------------------------- |
|  [LogOut]   Sign out              |
+-----------------------------------+
```

---

## 7. Migration Script Specification

### File: `scripts/migrate-profile-completed.js`
* **Purpose:** Mark existing users who already possess `name` and `phone` as `profileCompletedAt = createdAt || new Date()`.
* **Safety Flags:**
  * `--dry-run` (default): Prints summary table of matching users without modifying database.
  * `--backup`: Saves a timestamped JSON file (`backups/profile_migration_{timestamp}.json`) containing the pre-migration state of all affected records.
  * `--rollback <backup-file>`: Reverts modified users back to their exact pre-migration state.
  * `--confirm`: Executes the database update. **Per strict prompt instructions: DO NOT run with `--confirm` during automated stages.**

---

## 8. Test Plan

A comprehensive suite covering all 5 roles (`admin`, `creative_head`, `sm_manager`, `executive`, `team_member`):

1. **Profile & Settings Layout Consistency:**
   * Every role renders identical header card, about section, work details, and settings sections.
2. **Role Panel Accuracy:**
   * `admin`: Access request badge link and role counts.
   * `creative_head`: Waiting approvals and waiting plans.
   * `sm_manager`: Plan status counts, needs-owner count, late deliverables.
   * `executive`: Company marketing throughput scorecard (read-only).
   * `team_member`: Personal open steps, load utilization band, on-time rate.
3. **Strict Validation & Forbidden Fields:**
   * PATCH `/me/profile` rejects edits to `role`, `email`, `department`, `jobRole`, `weeklyCapacityHours`, `workPreferences`, and unknown keys (400 Bad Request).
4. **Avatar Upload & Removal:**
   * Validates 5 MB limit and image MIME types (`png`, `jpg`, `webp`).
   * Canvas crop and replacement deletes old asset.
   * Deletion sets `avatarUrl: null` and removes storage file.
   * Unified `<Avatar />` renders across header, People, Tracker, MediaThread, and review sidebar.
5. **Session Revocation:**
   * Listing active devices with `isCurrent` flag.
   * Revoking single session deletes target session.
   * Revoking all other sessions preserves current session.
6. **Password Hygiene & Rate Limiting:**
   * Enforces 8+ chars, uppercase, number, `new !== current`, `new === confirm`.
   * Enforces 5 attempts per 15 min rate limit.
   * Dispatches mandatory security email notification.
7. **Contact Details Masking & Teammate Drawer Scoping:**
   * `admin`, `creative_head`, `sm_manager`: Full contact visibility.
   * `executive`: Contact details masked.
   * `team_member`: Teammate drawer permitted ONLY if sharing a content piece; contact details masked. If no shared content piece, returns 403 Forbidden.
8. **First-Login Step & Migration:**
   * Users with `!profileCompletedAt` are routed to `/welcome`.
   * Migration runs cleanly in dry-run mode and produces backup.
9. **Mobile 360 px Viewport & Keyboard A11y:**
   * Touch targets $\ge 44$ px, WCAG AA contrast, proper tab ordering.

---

## 9. List of Files to Change, Create, and Delete

### New Files to Create
1. `apps/api/src/modules/auth/session.model.js` — Session tracking schema for device revocation.
2. `apps/api/src/modules/profile/routes.js` — `/me/profile`, `/me/settings`, `/me/password`, `/me/sessions`, `/me/change-request`.
3. `apps/api/src/modules/profile/controller.js` — Profile, settings, session, and change request controllers.
4. `apps/api/src/modules/profile/service.js` — Business logic, avatar deletion, device agent parsing, session management.
5. `apps/web/src/components/Avatar.tsx` — Universal avatar component (sizes xs to xl, deterministic color, lazy loading, no presence dot).
6. `apps/web/src/components/AvatarCropModal.tsx` — HTML5 Canvas circular crop with zoom slider.
7. `apps/web/src/components/ProfileDrawer.tsx` — Slide-out teammate profile drawer wrapping `ProfileView`.
8. `apps/web/src/components/ProfileView.tsx` — Shared read-only profile rendering component.
9. `apps/web/src/components/UserMenuDropdown.tsx` — Avatar header dropdown (View profile, Settings, Sign out).
10. `apps/web/src/pages/ProfilePage.tsx` — Main `/profile` page with header, about form, work details, role panel, ratings.
11. `apps/web/src/pages/SettingsPage.tsx` — Main `/settings` page with security, notifications, and preferences.
12. `apps/web/src/pages/WelcomePage.tsx` — Mandatory first-login profile completion page (`/welcome`).
13. `scripts/migrate-profile-completed.js` — Idempotent migration script with dry-run, backup, and rollback.
14. `apps/api/test/profile_and_settings.test.js` — Comprehensive backend integration tests across 5 roles.
15. `apps/web/src/pages/__tests__/ProfileSettingsSuite.test.tsx` — Frontend component tests across 5 roles.

### Existing Files to Modify
1. `packages/shared/src/index.ts` — Add schemas for profile update, settings update, password change strict, change request.
2. `apps/api/src/modules/people/model.js` — Add `avatarUrl`, `avatarStorageId`, `preferredName`, `phone`, `whatsappNumber`, `languages`, `about`, `skills`, `preferences`, `notificationPrefs`, `profileCompletedAt`, `lastLoginAt`.
3. `apps/api/src/modules/auth/service.js` — Update login and refresh flow to create/rotate `Session` records with user agent parsing.
4. `apps/api/src/modules/people/service.js` — Add teammate content piece sharing check and contact masking for `GET /people/:id/profile`.
5. `apps/api/src/modules/people/routes.js` — Expose `GET /:id/profile`, admin avatar removal, admin basic info update.
6. `apps/api/src/server.js` — Mount `/api/me` routes.
7. `apps/api/src/lib/mailer.js` — Add email templates for `passwordChanged` and `changeRequest`.
8. `apps/web/src/App.tsx` — Add `/profile`, `/settings`, `/welcome` routes; update `/account` redirect; update `RootRedirect` to check `profileCompletedAt` and `startPage`.
9. `apps/web/src/components/Layout.tsx` — Integrate `UserMenuDropdown`, remove presence dot, use `<Avatar />`.
10. `apps/web/src/pages/admin/UsersPage.tsx` — Replace inline avatar with `<Avatar />`, connect profile drawer click.
11. `apps/web/src/pages/calendar/TrackerTab.tsx` — Replace owner text with `<Avatar />` chip and drawer trigger.
12. `apps/web/src/pages/calendar/PlansTab.tsx` — Use `<Avatar />` for pipeline stage owners.
13. `apps/web/src/pages/work/workspaces/MediaThread.tsx` — Use `<Avatar />` in discussion bubbles.
14. `apps/web/src/pages/feedback/review-studio/ReviewStudioSidebar.tsx` — Use `<Avatar />`.
15. `apps/web/src/pages/work/writing-studio/WritingStudioSidebar.tsx` — Use `<Avatar />`.
16. `docs/PROGRESS.md` — Record implementation steps and test counts.

### Existing Files to Delete / Retire
1. `apps/web/src/components/NotificationPreferencesModal.tsx` — Fully replaced by the Notifications tab on `/settings`.
2. `apps/web/src/pages/MyAccountPage.tsx` — Replaced by `/profile` (routes `/account` and `/my-account` redirect to `/profile`).

