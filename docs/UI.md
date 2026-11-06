# HACA Marketing OS — UI & Design System Reference

**Authority:** Single source of truth for visual design, shared controls, layout shell, role screens and workspaces.
**Scope:** All 5 roles (`admin`, `creative_head`, `sm_manager`, `executive`, `team_member`).
**Current as of:** 5 November 2026 (after retheme phases UI-1 to UI-4C).
**Code is the reference:** tokens live in `apps/web/src/index.css` (`:root`) and `apps/web/tailwind.config.js`; status, role and band mapping lives in `apps/web/src/lib/statusTone.ts`. If this document and the code disagree, the code wins and this file should be corrected.

---

## 1. Design tokens (final)

Defined as CSS variables on `:root` in `index.css`. Solid colours are stored as RGB channels so Tailwind can apply alpha (`bg-ui-ink/10`). Use `--ui-*` in CSS and `ui-*` in class names.

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `--ui-canvas` | `#DDE2EB` | `bg-ui-canvas` | Page background (cool grey-blue) |
| `--ui-canvas-deep` | `#CDD5E5` | `bg-ui-canvas-deep` | Recessed areas (editor backdrop, preview wells) |
| `--ui-panel` | `rgba(255,255,255,0.38)` | `bg-ui-panel` | Frosted grouping panel |
| `--ui-panel-border` | `rgba(255,255,255,0.65)` | `border-ui-panel-border` | Panel and modal edge |
| `--ui-card` | `#F3F5F9` | `bg-ui-card` | Near-white card |
| `--ui-card-hover` | `#FAFBFD` | `bg-ui-card-hover` | Hover on clickable cards |
| `--ui-line` | `rgba(39,50,71,0.12)` | `border-ui-line` | Hairlines, dividers, field borders |
| `--ui-ink` | `#0B0B0D` | `bg-ui-ink`, `text-ui-ink` | Primary actions, active states, current stage, headings |
| `--ui-text` | `#1B1F27` | `text-ui-text` | Body text |
| `--ui-muted` | `#586170` | `text-ui-muted` | Secondary text (5.7:1 on card, 4.8:1 on canvas) |
| `--ui-blue` / `--ui-blue-soft` | `#7FA3DC` / `#DCE6F6` | `ui-blue`, `ui-blue-soft` | Meaning only: progress, in-progress, healthy load, chart data |
| `--ui-coral` / `--ui-coral-soft` | `#D86A68` / `#F8DFDD` | `ui-coral`, `ui-coral-soft` | Meaning only: attention, changes, blocked, overload |

Rules:
- Blue and coral are never used for text under 18px; they appear as fills, dots, bars and icons. Text on those meanings uses the status classes below, which carry AA-safe foregrounds.
- No purple, indigo or violet, and no decorative gradients, anywhere in page content.
- Rating stars may stay amber (`amber-400/500` fill); the score is always also shown as text.

Shape and depth:

| Token | Value | Tailwind |
|---|---|---|
| `--ui-radius-panel` | `32px` | `rounded-ui-panel` |
| `--ui-radius-card` | `24px` | `rounded-ui-card` |
| `--ui-radius-control` | `9999px` | `rounded-ui-control` |
| `--ui-shadow-panel` | `0 18px 40px -24px rgba(45,58,82,0.28), inset 0 1px 0 rgba(255,255,255,0.7)` | `shadow-ui-panel` |
| `--ui-shadow-card` | `0 10px 24px -18px rgba(45,58,82,0.3)` | `shadow-ui-card` |
| `--ui-shadow-modal` | `0 32px 64px -24px rgba(45,58,82,0.38), inset 0 1px 0 rgba(255,255,255,0.8)` | `shadow-ui-modal` |

Typography: body uses Plus Jakarta Sans (`font-sans`, loaded in `index.html`); the header and sidebar keep the system UI font (`.shell-scope`). Page titles `28–32px font-extrabold tracking-[-0.02em] text-ui-ink`; section titles `14–16px font-semibold/bold`; labels `13px font-medium text-ui-muted`, sentence case. No uppercase micro-labels and no `font-black`. Minimum text size 11px. Malayalam fonts: `.font-manjari`, `.font-gayathri`.

---

## 2. Surface hierarchy

Four levels, back to front. Class names keep the old "glass" names; the values below are the current code values.

1. **Canvas** — `body { background: var(--ui-canvas) }`. No gradients or glows.
2. **Panel** (`.glass-panel`) — groups content on the canvas. `background: var(--ui-panel)` (white 38%), `backdrop-filter: blur(20px) saturate(140%)`, `border: 1px solid var(--ui-panel-border)`, `box-shadow: var(--ui-shadow-panel)`. Radius comes from the call site (usually `rounded-ui-panel`).
3. **Card** (`.glass-card`) — opaque near-white `var(--ui-card)`, `border: 1px solid transparent`, `border-radius: 24px`, `box-shadow: var(--ui-shadow-card)`. No blur and no hover lift; only clickable cards (`a`, `button`, `[role=button]`, `.cursor-pointer`) change to `--ui-card-hover`. Use `outline` (not `ring`) for a selected card, because the card already uses `box-shadow`.
4. **Modal / popover** (`.glass-modal`) — `rgb(var(--ui-card-hover-rgb) / 0.94)`, `blur(24px) saturate(160%)`, `border: 1px solid var(--ui-panel-border)`, `border-radius: 32px`, `box-shadow: var(--ui-shadow-modal)`. Behind it: `.ui-scrim` (`rgb(var(--ui-text-rgb) / 0.32)`). Side drawers use `.ui-drawer`.

Inside cards, sub-areas use `bg-white/60` (wells) or `bg-white` (inputs, list rows). Do not put every tool in its own card; dense tools sit together in one card.

**Media stage (exception):** video players, image/pin viewers and clip thumbnails stay on a dark neutral surface (`bg-black`, `neutral-900/950`) so footage and designs are not tinted. Controls on the stage are white/neutral. The A4 document page (`.a4-page`) is always white.

---

## 3. Shared controls and status rules

### 3.1 Controls (`@layer components` in `index.css`)
| Class | Rule |
|---|---|
| `.ui-btn` + `.ui-btn-primary` | Ink fill, white text, pill, `min-height: 44px`. One primary action per area. |
| `.ui-btn` + `.ui-btn-secondary` | White 60% fill, `--ui-line` border, `--ui-text`. All other actions. |
| `.ui-icon-btn` | 44×44 circle, outlined. Icon-only controls must have `aria-label`. |
| `.ui-tabs` / `.ui-tab` | Pale track, 44px tabs; active tab is ink (`aria-selected="true"` or `.is-active`). Tab buttons expose `aria-pressed` (or `role="tab"` + `aria-selected`). Legacy aliases: `.glass-pill-container` / `.pill-active`. |
| `.ui-input`, `.ui-select` | Pill field, 44px, `--ui-line` border, ink focus outline. `.ui-select` draws its own chevron. |
| `.ui-input .ui-textarea` | Multi-line field. **Always combine with `.ui-input`**: `.ui-textarea` only sets height, padding and the 16px radius; fill, border and focus come from `.ui-input`. |
| `.ui-scrim`, `.ui-drawer` | Overlay backdrop and side drawer. |
| `.ui-media-range` | Video scrubber on the dark stage: white thumb with an ink ring. |

Accessibility rules that apply to every control:
- 44px minimum target. The only exceptions are positioned media markers (see 6.6), which have a 44px keyboard equivalent.
- Visible focus: `main :focus-visible`, `.glass-modal :focus-visible` and `[role=dialog] :focus-visible` get a 2px ink outline.
- Clickable things are real `<button>`/`<a>` elements. If a card contains other controls, the card keeps its mouse click and a separate button inside it provides the keyboard path.
- Every visible label is tied to its control (`htmlFor`/`id`), or the control has `aria-label`.
- Every modal and drawer uses `useDialogFocus` (`src/lib/useDialogFocus.ts`): focus moves in, Escape closes, Tab stays inside, focus returns to the opener. Do not also use `autoFocus` inside such dialogs (it hides the opener from the hook); pass `initialFocusRef` instead.
- Reduced motion: pulse, bounce and ping animations stop; use `motion-safe:` for any new animation.

### 3.2 Status (8 step statuses)
Status colours come from shared **web** classes in `index.css` and the helper in `src/lib/statusTone.ts` (not from `@mmp/shared`). Map a raw status with `statusTone(status, isLocked)` and render with `statusClass(tone)`.

| Tone class | Background | Text | Used for |
|---|---|---|---|
| `.status-locked` | transparent, dashed border | `#586170` | Locked steps |
| `.status-not-started` | `rgba(39,50,71,0.08)` | `#3A4150` | Not started |
| `.status-in-progress` | `#DCE6F6` | `#23457C` | In progress |
| `.status-waiting` | `#F3E7CF` | `#684811` | Waiting for approval, submitted |
| `.status-changes` | coral-soft | `#8B2D2A` | Changes requested, escalations |
| `.status-approved` | `#DBEEE2` | `#1E5A3C` | Approved |
| `.status-blocked` | coral | ink | Blocked, overdue |
| `.status-posted` | white, ink border | ink | Posted / published |

Render as `.status-chip` (pill), `.status-tint` (larger block) or `.status-dot`. All pass WCAG AA (5.7:1–19.7:1).

### 3.3 Roles, bands and calendars
- **Roles:** `.role-badge` + `roleClass(role)` → `.role-admin`, `.role-creative-head`, `.role-sm-manager`, `.role-executive`, `.role-team-member` (desaturated, AA).
- **Workload bands:** `bandClass(band)` / `bandForPct(pct)` → `.band-healthy` (<65%, blue), `.band-high` (65–85%, neutral ink), `.band-overloaded` (>85%, coral); use `.band-chip`, `.band-tint`, `.band-bar`. The band label is always shown. Workload % is real and unclamped.
- **Calendars:** `.cal-dot` + `.cal-sm` (ink), `.cal-sales` (blue), `.cal-ads` (coral), `.cal-academics_management` (muted), `.cal-other` (hollow ring). The calendar name is always shown beside the dot.

---

## 4. Pipeline rules

- `PipelineStepper` (`src/components/PipelineStepper.tsx`) is shown on **Work Detail** (`/work/:id`) only. It is not on My Work cards.
- It is read-only and shows the whole content piece: step number, step name and owner per stage.
- The current stage is the near-black (ink) card. Passed stages show a check; locked stages are dashed with a lock; changes and blocked stages show their icon. Connectors are thin lines with small nodes.
- The overall status chip above the steps uses `statusTone`/`statusClass`.
- Layout: vertical on phones, horizontal scrolling grid from `md`.
- Each worker sees their own step timing only (due date, their own work time). There are no shared countdowns.

---

## 5. Layout shell: header and sidebar (current)

The shell is frozen at its pre-retheme look: retheme phases did not change it.
- **Header** (`Layout.tsx`, `<header className="shell-scope sticky top-0 z-40 ...">`): three opaque `.shell-header` pills on a max-1520px row — brand (logo and page name), a centre pill with Search and Team Chat, and a right pill with notifications and the account menu. Below `lg` a menu button opens a mobile panel. Flyouts use `.shell-popover` / `.shell-menu`.
- **Sidebar** (`lg` and up only): a sticky `glass-panel` rail, 72px wide, expanding to 240px on hover or keyboard focus. Icons with labels revealed on expand; the access-request count badge uses coral with ink text.
- **No app footer.** (The Writing Studio has its own status bar inside the studio.)
- Full-screen tools (Writing Studio, Review Studio, production workspaces) render without the app shell and provide their own back control.

Navigation per role (sidebar and mobile menu):
- `team_member`: My Work, Creative Calendar, Notifications.
- `sm_manager`: Dashboard, My Work, Creative Calendar, Work, Team Workload, Issues and Blockers, Reports, Team Directory.
- `creative_head`, `executive`: Dashboard, Creative Calendar, Work, Feedback and Revisions, Team Workload, Issues and Blockers, Reports and Automation, Team Directory.
- `admin`: the same as above plus **Access Requests**.

There is no separate Admin Users screen and no "Users" navigation item. `/admin/users` redirects to `/team`.

---

## 6. Screens and workspaces (current rules)

### 6.1 Admin user management (`/team`, `/team/:id`)
- `/team`: admin-only **Invite user** (creates the account; no email is sent — the person sets a password with "Forgot password?").
- `/team/:id` (admin, someone else's profile): **Change role** (two-step, shows current and new role), **Reset password** (blocks sign-in until a new password is set; existing sessions continue), **Force logout** (ends all sessions), plus Suspend/Reactivate, Edit Profile (registered email), Reassign Steps and Edit Operational Details.
- Account actions are hidden on the admin's own profile.
- `/admin/access-requests`: approve, reject or ask for more info on access requests.

### 6.2 Work Detail (`/work/:id`)
Light page. One primary action at a time in the action bar. Request Rework and Approve open dialogs. Approval requires a 1–5 star rating; revision requests use the 7 canonical root causes from `@mmp/shared` (`CANONICAL_REVISION_ROOT_CAUSES`). The rating card is a light card with an ink heading.

### 6.3 Feedback (`/feedback`) and plan approval
Tabs for plans and stages. Thread cards are buttons. The Classify Root Cause dialog offers only the 7 canonical causes; legacy values on saved flags are shown as stored and are never rewritten.

### 6.4 Review Studio (`/feedback/review-studio`, `/work/:id/review`)
Light shell (header, sidebar, decision bar) around a dark neutral media stage. The decision bar requires a 1–5 star rating before Approve; Request Revision uses the 7 canonical causes. Sidebar tabs: Comments, Brief, Outputs, Versions. Comments and pins stay private between the step owner and leadership. Shoot submissions open `ShootReviewView` inside the studio.

### 6.5 Writing Studio (`/work/:id/writing-studio`)
Word-style TipTap editor on a white A4 page. Light header, ribbon (tabs: Home, Insert, Script, Review, View, File), docked sidebar (Brief, Script Tools, Comments) and status bar. Below `md` the sidebar stacks under the page. Print stylesheet hides the studio chrome and prints only the A4 page. The Teleprompter keeps its own dark full-screen styling. Document links keep the editor's link class (it is stored in document HTML).

### 6.6 Production workspaces (`/work/:id/workspace`)
Light chrome, dark media stage. All four share the media player (`VideoPlayer.tsx`), clip cards and per-clip discussion (`MediaThread.tsx`).
- **Design:** copy-ready approved text with copy buttons, slide upload and ordering, dimension/size guides, upload states, designer notes.
- **Shoot:** shot list, resumable/phone-friendly uploads (choose files, record clip), clip cards with take, shot link, duration, size and 9:16 check; each clip opens a dialog with the player and its discussion thread (keyboard: the "Open {clip}" button on the thumbnail). Clip review uses **Approve Clip** and **Reshoot Needed**.
- **Edit:** tabs for Master Cut & Live Chat, Upload Cut, Raw Footage, Approved Script, Version History; pre-flight checks (9:16, ≤90s), revision checklist (each item a 44px checkbox button), cut upload states.
- **Post:** download approved master, copy caption, copy hashtags, pre-publish checklist, live URL and published date/time.
- **ShootReviewView** (Shoot review in the workspace and inside Review Studio): clip gallery, per-clip discussion, Approve Clip / Reshoot Needed, Send Back, and Approve Step with a mandatory 1–5 star rating. Its three dialogs use `useDialogFocus`.

Media controls (workspace player and Review Studio):
- Every player control is 44px and named; the video surface toggles play with Enter/Space as well as click.
- Timeline comment markers keep their 10px dot with a 24px hit area (44px would overlap the seek bar and each other). Each marker is named (author, timecode, text), and a **Timecoded comments** list under the controls gives 44px buttons that seek to each comment.
- Image pins keep their 28px look with a 44px hit area and a full name. Pins are placed by clicking the image; **Add pin at centre** is the keyboard path to the same pin form.
- Timecodes, pin coordinates and media appearance are unchanged by styling.

---

## 7. Mobile standards (down to 360px)

1. 44px touch targets (see 3.1 for the media-marker exception).
2. Grids collapse to one column below 640px; action rows wrap.
3. Tab tracks wrap or scroll horizontally inside their own container.
4. Zero horizontal page overflow; dialogs use `max-h-[92vh]` with an internal scroll.
5. No presence indicators (no online dots or typing indicators).

---

## 8. Facts that replaced older statements in this file

- FullCalendar is **not** installed; the Creative Calendar uses the app's own grid.
- Status colours come from the web classes and `src/lib/statusTone.ts`, not from `@mmp/shared`.
- Glass values are the current ones in section 2 (the old 0.75/0.82/0.95 white values and lift-on-hover are gone).
- There is no app footer.
- `PipelineStepper` is on Work Detail, not on My Work cards.
- There is no separate Admin Users screen; admin user actions are on `/team` and `/team/:id`.
