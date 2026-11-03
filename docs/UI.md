# HACA Marketing OS — Complete UI & Design System Reference

**Authority:** Single Source of Truth for Visual Design, Layout Shells, Glassmorphism Design Tokens, Role-Based Screen Specifications, Workspaces, and Mobile UI Standards.  
**Scope:** Covers all 5 roles (`admin`, `creative_head`, `sm_manager`, `executive`, `team_member`).  
**Current as of:** 3 November 2026.

---

## 1. Visual Design Language & Color Palette

### 1.1 Canvas & Background Gradients
- **Canvas Base:** Layered soft ambient background:
  - Base: `#f8fafc` blending through radial tints of `#eef2ff` (indigo-50) and `#f5f3ff` (violet-50).
  - Background attachment: `fixed`, `min-h-screen`.
  - Subtle top glow accents: radial gradient highlights positioned at `top-left` and `top-right` giving depth without high contrast.

### 1.2 Glassmorphism Design Tokens
The UI is styled with a modern "soft-glass" visual language:
- **`.glass-panel` (Top Bar, Navbars, Side Drawers):**
  - Background: `rgba(255, 255, 255, 0.75)`
  - Backdrop Filter: `blur(20px) saturate(180%)`
  - Border: `1px solid rgba(255, 255, 255, 0.85)`
  - Box Shadow: `0px 10px 30px -10px rgba(0, 0, 0, 0.04), inset 0px 1px 0px rgba(255, 255, 255, 0.95)`
- **`.glass-card` (Main Cards, KPI Boxes, Content Cards):**
  - Background: `rgba(255, 255, 255, 0.82)`
  - Backdrop Filter: `blur(16px)`
  - Border: `1px solid rgba(255, 255, 255, 0.90)`
  - Border Radius: `20px` to `24px` (`rounded-3xl` / `rounded-2xl`)
  - Box Shadow: `0px 10px 25px -5px rgba(0, 0, 0, 0.03), inset 0px 1px 0px rgba(255, 255, 255, 0.90)`
  - Hover Transition: `all 0.2s cubic-bezier(0.16, 1, 0.3, 1)` with `-2px` translateY lift.
- **`.glass-modal` (Dialogs & Popups):**
  - Background: `rgba(255, 255, 255, 0.95)`
  - Backdrop Filter: `blur(24px) saturate(200%)`
  - Border: `1px solid rgba(255, 255, 255, 1)`
  - Border Radius: `28px` (`rounded-3xl`)
  - Box Shadow: `0px 30px 60px -15px rgba(15, 23, 42, 0.18)`
- **`.glass-pill-container` (Filter bars, Segmented controls):**
  - Background: `rgba(241, 245, 249, 0.80)`
  - Border: `1px solid rgba(255, 255, 255, 0.90)`
  - Border Radius: `9999px` (`rounded-full`)

### 1.3 Role Color Themes & Badges
Each canonical role has a distinct, semantic accent color pairing:
- **`admin` (Violet / Purple):**
  - Badge: `bg-purple-50 text-purple-700 border-purple-200`
  - Accent: `#7c3aed` (`purple-600`)
- **`creative_head` (Amber / Bronze):**
  - Badge: `bg-amber-50 text-amber-800 border-amber-200`
  - Accent: `#d97706` (`amber-600`)
- **`sm_manager` (Blue / Sky):**
  - Badge: `bg-blue-50 text-blue-700 border-blue-200`
  - Accent: `#2563eb` (`blue-600`)
- **`executive` (Indigo / Slate):**
  - Badge: `bg-indigo-50 text-indigo-700 border-indigo-200`
  - Accent: `#4f46e5` (`indigo-600`)
- **`team_member` (Emerald / Mint):**
  - Badge: `bg-emerald-50 text-emerald-700 border-emerald-200`
  - Accent: `#059669` (`emerald-600`)

### 1.4 Status Colors & Universal Labels
Mapped by the shared status mapper function (`packages/shared`):
- `Locked`: `bg-slate-100 text-slate-400 border-slate-200`
- `Not started`: `bg-slate-100 text-slate-600 border-slate-200`
- `In progress`: `bg-blue-50 text-blue-700 border-blue-200` (pulsing blue dot)
- `Waiting for approval`: `bg-amber-50 text-amber-800 border-amber-200`
- `Changes requested`: `bg-rose-50 text-rose-700 border-rose-200`
- `Approved`: `bg-emerald-50 text-emerald-700 border-emerald-200`
- `Blocked`: `bg-orange-50 text-orange-800 border-orange-200` (hazard alert icon)
- `Posted`: `bg-indigo-50 text-indigo-700 border-indigo-200`

### 1.5 Typography
- **Primary Typeface:** Plus Jakarta Sans, Inter, system-ui (`font-sans`).
- **Page Titles:** `24px`–`28px`, `font-black` (weight 900), tracking `-0.03em`.
- **Card Titles:** `14px`–`16px`, `font-bold` (weight 700).
- **Body Text:** `13px`–`14px`, `font-medium` (weight 500) in `text-slate-700`.
- **Meta / Labels:** `11px`–`12px`, `font-semibold` in `text-slate-400` or `text-slate-500`.
- **Micro-Kickers:** `10px`, `uppercase font-extrabold tracking-wider`.

---

## 2. Layout Shell, Navigation & Global Controls

### 2.1 Universal Header & Top Bar (`Layout.tsx`)
The top bar spans full width (`sticky top-0 z-40`), featuring:
1. **Brand Identity:** HACA Marketing OS logo with vibrant purple gradient icon and clean typography.
2. **Main Navigation Menu:** Role-tailored menu (max 8 items, plain words, no nested dropdowns).
3. **Right Action Hub:**
   - **Global Month & Calendar Filters:** Quick selector showing current active calendar.
   - **Chat Trigger:** Speech bubble icon with real-time unread badge counter (`bg-rose-500 text-white animate-bounce-short`).
   - **Notification Center:** Bell icon with unread count and flyout sheet.
   - **User Profile Dropdown:** Circular avatar with deterministic fallback initials, display name, role chip, links to `/profile` and `/settings`, and "Sign Out" button.

### 2.2 Navigation Menus per Role (Max 8 Items Rule)
- **`admin`:** `Home`, `Plans`, `Tracker`, `Team Directory`, `Problems`, `Reports`, `Users`, `Access Requests`.
- **`creative_head`:** `Home`, `Review Queue`, `Plans & Approvals`, `Tracker`, `Team Directory`, `Problems`, `Reports`.
- **`sm_manager`:** `Home`, `Plans`, `Tracker`, `Team Directory`, `Team Workload`, `Problems`, `Reports`.
- **`executive`:** `Home`, `Plans`, `Tracker`, `Team Directory`, `Team Workload`, `Reports` *(all read-only)*.
- **`team_member`:** `My Work`, `Creative Calendar`, `Notifications`, `My Profile`.

### 2.3 Global Filter Bar (`GlobalFilterBar.tsx`)
Present on Calendar, Dashboard, and Tracker views:
- **Month Pill:** `< Month Year >` stepper.
- **Calendar Pill:** 5-calendar tab toggle (`All`, `SM`, `Sales Team`, `Ads Team`, `Academics & Management`, `Other`).
- **Status Filter:** Quick filter pills (`All`, `In Progress`, `Waiting Review`, `Late`, `Blocked`).

---

## 3. Role-by-Role Screen Breakdown & UI Features

### 3.1 Role 1: Administrator (`admin`)
- **Access Requests (`/admin/access-requests`):**
  - Table of pending invitations and signup requests.
  - Controls: "Approve" (with role selection modal) and "Reject".
  - Strictly prevents public signup for `admin`, `creative_head`, or `executive`.
- **Users Management (`/admin/users`):**
  - Master user list with search and role filters.
  - Controls: Invite User, Change Role, Suspend/Reactivate user, Reset Password, Force Logout.
- **Team Directory (`/team`) & Member Profile (`/team/:id`):**
  - Full view of any worker's profile.
  - Can edit official registered email address (admin-only privilege).
  - Can trigger "Edit Operational Details" (capacity, department, job role) and "Reassign Steps".

---

### 3.2 Role 2: Creative Head (`creative_head`)
- **Review Queue / Review Studio (`/feedback/review-studio/:id`):**
  - Centralized split-screen review interface:
    - **Left Canvas:** Media viewer (video player with second-by-second scrub bar, high-res image zoom with point pins, document reader for scripts/content).
    - **Right Thread:** Version selector (v1, v2, v3), pinned annotation list, revision history.
    - **Sticky Decision Bar:**
      - **"Approve" Button:** Triggers mandatory **1 to 5 Star Quality Rating** with optional constructive tags.
      - **"Request Revision" Button:** Opens modal requiring root-cause categorization (7 options: Brief unclear, Direction unclear, Skill gap, etc.) + actionable comment.
- **Plans & Approval Tab (`/calendar` Tab 2):**
  - Review incoming monthly and individual calendar plans submitted by SM Manager.
  - Row-by-row approval checklist or "Approve Entire Plan".
  - "Reject Plan with Concern" drawer.

---

### 3.3 Role 3: Social Media Manager (`sm_manager`)
- **Creative Calendar & Plan Creator (`/calendar`):**
  - **Tab 1: Month View:** FullCalendar grid showing published and scheduled works color-coded by calendar.
  - **Tab 2: Plans & Approval:** Plan cards with derived status (`Draft`, `Submitted`, `Approved`), row counts, and error validation chips.
  - **Tab 3: Content Flow Tracker:** Deliverable matrix showing active holder, pipeline step progress, days late, and elapsed wait times.
- **Plan Row Form & Step Deadlines Modal:**
  - Type picker (Reel + 14 design types).
  - Toggles: "Needs Script", "Needs Shoot" (shows "Source video link" when off).
  - **Per-Step Row Lines:** Step Name, Suggested Owner (with autofill matching reason), and Deadline Date Picker.
  - Offset badge hints (`5 days before publish`). Values edited by the manager show `"Set by you"`.
- **Team Workload View (`/workload`):**
  - Heatmap and capacity bar charts (`<65% Healthy`, `65-85% High`, `>85% Overloaded`).

---

### 3.4 Role 4: Executive (`executive`)
- **Dashboard & High-Level Views:**
  - Full visibility across all 5 calendars, team directory, and production reports.
  - **Executive Privacy Redaction:** All contact numbers, WhatsApp links, and personal emails are stripped/hidden across all profiles.
  - **Strict Read-Only Enforcement:** Zero action buttons. Approval, creation, reassignment, and status toggle buttons are completely omitted.

---

### 3.5 Role 5: Team Member / Worker (`team_member`)
- **My Work Dashboard (`/my-work`):**
  - **"Right Now" Active Banner:** Highlights the single deliverable currently in progress with live elapsed work time counter (`Working for 2h 15m`).
  - **Filter Tabs:** `All`, `In Progress`, `Next Up`, `Waiting for Approval`, `Revisions Needed`, `Completed`.
  - **Deliverable Cards:**
    - Topic title, deliverable type chip, calendar badge.
    - Assigned step name and **due date only** (no shared countdown clocks).
    - **Pipeline Stepper (`PipelineStepper.tsx`):** Read-only visual pipeline showing the whole project flow (teammate names and statuses).
    - **Dynamic Action Button (`getAvailableActions`):**
      - Not started -> `"Start Work"`
      - In progress -> `"Open Workspace"` / `"Submit for Approval"`
      - Blocked -> `"Mark Blocked"` / `"Resolve Blocker"`
- **My Profile (`/profile`):**
  - Shows personal craftsmanship metrics (on-time rate, revision rate, work time breakdown).
  - Transparency notice: *"Your work history, timings and ratings are visible to leadership."*
  - **"Edit Profile" Button:** Launches the Profile Edit Modal.

---

## 4. Specialized Role Workspaces

### 4.1 Writing Studio (`WritingStudioPage.tsx`)
Dedicated studio for Writers working on Content and Script steps:
- **Editor Canvas:** Word-style editor powered by Tiptap with typography controls, lists, headings, and clean page borders.
- **Script Table Tool:** Two-column table layout:
  - Column 1: `Visual / Scene / Framing`
  - Column 2: `Audio / Dialogue / Sound Effects`
  - Column 3: `Time Duration Estimate`
- **Side Drawer Tools:**
  - **Hook Check:** Analyzes opening 3-second hook strength.
  - **Caption & Hashtag Box:** Dynamic character counters with limits for Instagram, LinkedIn, and YouTube.
  - **Auto Shot List:** Generates shot items with one click for the Videographer.
  - **Teleprompter Mode:** Clean fullscreen scrolling view with adjustable scroll speed and font size.
- **Import/Export:** Native `.docx` upload import and clean `.docx`/`.txt` export.

### 4.2 Shoot Workspace (`ShootWorkspace.tsx`)
Dedicated workspace for Videographers:
- **Script & Brief Accordion:** Read-only reference of the approved script and shot list beside the camera zone.
- **Per-Clip Upload Zone:**
  - Phone-friendly chunked file upload.
  - Per-clip metadata: Clip Title, Shot Link, Take Number, Resolution/FPS tags.
- **WhatsApp-Style Clip Discussion Thread:**
  - Speech bubbles for each clip with timestamps and read ticks.
  - Specific clip review actions: `"Approve Clip"` or `"Reshoot Needed"`.
  - Entire step completes only when all required shots are approved.

### 4.3 Edit, Design & Post Workspaces
- **Edit Workspace:** Video preview player, aspect ratio warning banners (flags non-9:16 reels), and revision checklists.
- **Design Workspace:** Image & PDF upload preview, multi-slide carousel reordering tool, and size guides.
- **Post Workspace:** Download approved final media, copy approved caption/hashtags with one click, social media checklist, and live link verification input.

---

## 5. Universal Modals & Dialog Patterns

### 5.1 Edit Profile Modal (with OTP Verification)
- **Avatar Section:** Preview with "Change Photo" button opening `AvatarCropModal`.
- **Identity Fields:** Full legal name (required) and preferred nickname.
- **Official Registered Email:**
  - Disabled and locked with 🔒 lock icon for regular users.
  - Notice badge: *"Registered email cannot be changed by the user. Contact an administrator to request an email update."*
  - Editable only by Admin with warning: *"Modifying official email changes user login credentials."*
- **Mobile Phone & SMS OTP Verification:**
  - Phone input field with country code support.
  - Status chip: `Verified ✓` in emerald or `Verification Required` in amber.
  - **OTP Verification Box:**
    - Appears when phone number is changed.
    - "Send OTP" button with loading spinner.
    - 6-digit verification code input.
    - "Verify Code" button.
    - 30-second countdown timer for resending code.
- **WhatsApp Field:** Includes "Same as mobile number" sync checkbox.
- **Bio / About:** Textarea with dynamic `500-character` counter.
- **Tag Managers:** Interactive chip managers for Spoken Languages (max 5) and Skills (max 10).

### 5.2 Avatar Crop Modal (`AvatarCropModal.tsx`)
- Canvas-based image cropper.
- Features: Zoom in/out slider, pan/drag positioning, circular mask boundary, and file size validation (max 5 MB).
- Saves cropped circular avatar directly to profile.

---

## 6. Mobile Responsiveness Standards (Down to 360px)

1. **44px Touch Target Rule:** Every interactive button, pill, dropdown, and tab trigger must have a minimum clickable area of `44px x 44px`.
2. **Responsive Stacking:**
   - Desktop multi-column grids (`grid-cols-2`, `grid-cols-3`) collapse to single columns (`grid-cols-1`) on viewports under `640px`.
   - Action buttons (`Save`, `Cancel`) stack vertically or stretch full-width on mobile.
3. **Horizontal Scrollable Tabs:** Navigation tabs on Calendar, My Work, and Profile use smooth horizontal touch-scrolling (`overflow-x-auto no-scrollbar`) with swipe indicators.
4. **Zero Horizontal Overflow:** All modals have `max-w-[94vw]` with internal scrollable bodies (`max-h-[85vh] overflow-y-auto`).
5. **No Presence Indicators:** In accordance with privacy and anti-monitoring rules, green online status dots and activity pips are strictly excluded.

