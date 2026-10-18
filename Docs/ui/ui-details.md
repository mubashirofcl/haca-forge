# UI Details: Soft-Glass Dashboard Redesign (SugarCRM "Cases" style)

> **Purpose:** Reskin the current app UI to match the reference video `ui-ref.mp4`.
> **Rule for the agent:** Change visuals, layout and components only. Do NOT change business logic, API calls, routes, state management or data models. Keep all existing features working.
> **Accuracy note:** Colors were sampled from video frames. Pixel sizes are measured from a ~1420px-wide desktop frame and normalized to a **1440px desktop base**. Treat them as tight estimates and match visually. Dark mode is **not shown** in the video (only the toggle is), so the dark tokens below are extrapolated and marked as such.

---

## 1. Design Language (the "feel")

- **Soft-glass / neumorphic pill UI.** Everything is rounded: pills, circles, large-radius cards. There are almost no sharp corners and almost no hard borders.
- **Very light, cool-grey/blue-tinted canvas** with white translucent surfaces floating on it.
- **Depth comes from soft shadows and highlights**, not strong borders: a white top-left highlight plus a faint cool-grey bottom-right shadow.
- **One strong accent: pure black** for the active/primary state (active nav, active tab, primary buttons, active theme toggle).
- **Two semantic colors only:** soft periwinkle blue (progress / complete / info) and soft coral red (alerts / pending / blocked). No other saturated colors in the UI chrome.
- **Avatars everywhere.** Each list item, team and step is anchored by a circular photo avatar.
- **Generous whitespace** and low visual noise. Small gray secondary text, medium-weight dark primary text.

---

## 2. Design Tokens

### 2.1 Colors

```css
:root {
  /* Canvas */
  --bg-page-top:        #E3E3E5;   /* top-left of page gradient */
  --bg-page-bottom:     #DCDFE8;   /* bottom-right, slight blue tint */
  --bg-page: linear-gradient(160deg, var(--bg-page-top) 0%, var(--bg-page-bottom) 100%);

  /* Surfaces */
  --surface-panel:      rgba(255,255,255,0.45);  /* big containers (Case Pipelines panel) */
  --surface-panel-blue: linear-gradient(180deg, #D3DAEA 0%, #C9D2E8 100%); /* bottom chart cards, bluer than the top panel */
  --surface-card:       rgba(255,255,255,0.72);  /* pills / list cards */
  --surface-card-solid: #F1F2F5;                 /* workflow stage cards, task tiles */
  --surface-modal:      #EFF0F2;                 /* modal sheet */
  --surface-input:      #F9F9FB;                 /* input pills (lighter than modal) */
  --surface-tabgroup:   rgba(120,125,140,0.18);  /* darker "tray" behind the tab pills */

  /* Text */
  --text-primary:       #0A0A0A;
  --text-secondary:     #6B6E76;   /* sub-lines, labels */
  --text-muted:         #9A9CA3;   /* placeholders, disabled nav (e.g. "Opportunities") */
  --text-on-dark:       #FFFFFF;

  /* Accent (primary) */
  --accent-black:       #0A0A0A;

  /* Semantic */
  --blue:               #8CA4D2;   /* progress / done / links (strokes, dots, legend) */
  --blue-strong:        #89A3D6;   /* slider fill, donut blue */
  --blue-soft:          #DDE3FB;   /* connector port ring */
  --red:                #D1686D;   /* alerts, pending, badges */
  --red-dot:            #E5484D;   /* tiny notification dot */
  --yellow:             #E9D96B;   /* metric gauge arc (2nd gauge) */
  --sage:               #9AA8A6;   /* metric gauge arc (3rd gauge) */

  /* Lines */
  --border-hairline:    #C9CBD3;   /* outlined pills & circle buttons (1px) */
  --divider:            #CFD1D6;   /* modal header divider (1px) */
}
```

**Extrapolated dark theme (not in video: verify with design):**
```css
[data-theme="dark"] {
  --bg-page: linear-gradient(160deg, #15161A 0%, #1C1F2A 100%);
  --surface-panel: rgba(255,255,255,0.06);
  --surface-card: rgba(255,255,255,0.09);
  --surface-card-solid: #23252C;
  --surface-modal: #1E2026;
  --surface-input: #2A2C34;
  --text-primary: #F4F4F6;
  --text-secondary: #A3A6AF;
  --text-muted: #6E717A;
  --accent-black: #FFFFFF;      /* primary buttons invert to white w/ black text */
  --border-hairline: #3A3D46;
}
```

### 2.2 Typography
- **Family:** geometric rounded sans, similar to *Gilroy / Aeonik / Satoshi*. Free closest match: **"Plus Jakarta Sans"** (fallback: **"Urbanist"**, then `system-ui`).
- **Page title** ("Cases Overview"): 32px, weight 700, letter-spacing -0.01em, `--text-primary`.
- **Panel title** ("Case Pipelines", "Top Case Drivers"): 16px, weight 500, `--text-secondary`/dark gray.
- **Nav items:** 15px, weight 500.
- **Tab / pill labels:** 14–15px, weight 500.
- **Card title:** 16–17px, weight 500.
- **Card sub-line:** 12px, weight 400, `--text-secondary`.
- **Section caption** ("Last 30 Days", "Average resolution of issues"): 11–12px, `--text-secondary`.
- **Modal title:** 20px, weight 500. **Modal field label:** 14px, weight 400.
- **Modal input value:** 18px, weight 500.
- **Big metric numbers** (gauges): ~22px, weight 600.

### 2.3 Radius scale
| Token | Value | Use |
|---|---|---|
| `--r-full` | 9999px | pills, circle buttons, avatars, tabs, inputs |
| `--r-panel` | 48px | large panels / chart cards |
| `--r-modal` | 40px | modal sheet |
| `--r-stage` | 40px | workflow stage cards |
| `--r-tile` | 28px | "New Tasks" square tiles |
| `--r-textarea` | 32px | description textarea |

### 2.4 Shadows (soft / neumorphic)
```css
--shadow-pill:   0 6px 16px rgba(120,128,150,0.18), 0 1px 0 rgba(255,255,255,0.9) inset;
--shadow-raised: 0 10px 28px rgba(120,128,150,0.22), -2px -2px 6px rgba(255,255,255,0.8);
--shadow-inset:  inset 2px 2px 6px rgba(150,155,170,0.18), inset -2px -2px 6px rgba(255,255,255,0.9);
--shadow-black:  0 8px 20px rgba(0,0,0,0.28);   /* black buttons */
```
- Pills/cards: `--shadow-pill`. Inputs: soft white outer glow + a very faint bottom shadow. Textarea has a slight `--shadow-inset` feel.
- No 1px dark borders on surfaces. Only **outlined** elements (circle icon buttons, column header pills, close button) use a 1px `--border-hairline`.

### 2.5 Spacing
Base unit 4px. Common values: 6, 8, 12, 16, 20, 24, 32. Panel inner padding ≈ 28px. Gap between columns ≈ 20px. Gap between list cards ≈ 8px.

### 2.6 Motion
- Default transition: `200ms cubic-bezier(.2,.8,.2,1)`.
- Hover on pills/cards: `translateY(-1px)` + slightly stronger shadow.
- Press: `scale(0.98)`.
- Modal open: backdrop fades in with blur, sheet scales from `0.96 → 1` and fades, `320ms`.
- Screen/tab switches show a quick horizontal motion-blur slide in the video; a 250ms slide + fade is enough.
- Drag & drop for cards and tiles with live connector lines following (see §5).

---

## 3. App Shell (global layout)

```
┌───────────────────────────────────────────────────────────────┐
│ [logo]        Relationship Opportunities Leads Calendar [Cases] Reports Quotes      (🔍)(✉•)(🔔•)(👤) │  ← top nav
├────┬──────────────────────────────────────────────────────────┤
│ ‹  │  Cases Overview  (page title)                            │
│ ⌁  │ ┌─ Panel: Case Pipelines ───────────────────────────┐   │
│ ⇧  │ │                                                   │   │
│ ☆  │ └───────────────────────────────────────────────────┘   │
│ +  │ ┌─ Top Case Drivers ──────┐ ┌─ Case Metrics ─────────┐  │
│ ▯  │ └─────────────────────────┘ └────────────────────────┘  │
│ …  │                                                          │
│ ☾  │                                                          │
│ ☀  │                                                          │
└────┴──────────────────────────────────────────────────────────┘
```

- Page background: `--bg-page` gradient. Content is inset ~32px from the viewport edges.
- The browser frame (traffic lights, URL bar) in the video is a **mockup, not part of the app**. Do not build it.

### 3.1 Top Navigation Bar
- **Height:** ~56px row, ~24px top padding. Transparent (sits directly on the page gradient).
- **Left:** logo mark (stacked layers icon, black) + wordmark: bold lowercase "sugar" + regular "crm" (replace with the app's own logo/name, same treatment: mark + two-weight wordmark, ~22px).
- **Center nav items:** plain text, 15px/500, horizontal gap ≈ 28px. Items: `Relationship · Opportunities · Leads · Calendar · Cases · Reports · Quotes`.
  - **Default:** `--text-primary`.
  - **Muted/secondary:** `--text-muted` (e.g. "Opportunities" is lighter in the video).
  - **Active:** black pill, `--accent-black` bg, white text, height 54px, horizontal padding ≈ 24px, `--r-full`. No shadow or a very soft one.
  - Hover: faint white pill background (`rgba(255,255,255,.6)`).
- **Right cluster** (gap 6px): three **54px circle buttons** (search, mail, bell) + **54px circular avatar**.
  - Circle button: bg `--surface-card` (≈ #E7E7E7 to white), `--shadow-pill`, 20px outline icon, stroke 1.5px.
  - Mail and bell carry a **6px red dot** (`--red-dot`) at the top-right of the icon.
  - Avatar: 54px, full circle, photo, 2px white ring.

### 3.2 Left Icon Rail
- **Position:** left, aligned with content (≈ 23px from left edge), vertically spanning below the nav.
- **Buttons:** 52px circles, `--surface-card`, `--shadow-pill`, 20px outline icons (1.5px stroke), vertical gap ≈ 5–6px.
- **Order (top → bottom):**
  1. Back chevron `‹`
  2. Share / network nodes
  3. Upload / export (arrow up from tray)
  4. Star
  5. Plus
  6. Mobile phone
  7. Database (stacked cylinder)
  8. Calendar
  9. Paper-plane / send
  10. Alert triangle with a small **red dot**
- **Bottom pinned: theme toggle** (two stacked 52px circles):
  - Moon (light-mode state shown as a normal circle).
  - Sun: **black filled circle**, white icon. This is the *active* theme, so the active one is black.
- Active rail item (if any) = black circle, white icon (same rule as everywhere).

---

## 4. Screen A: "Cases Overview" (Pipelines board)

### 4.1 Page title
"Cases Overview", 32px/700, left-aligned with the main panel's inner left edge (≈ 20px from panel edge), margin-bottom ≈ 16px.

### 4.2 Main panel: "Case Pipelines"
- **Size:** full content width (~1317px at 1440 base), height ≈ 557px, `--r-panel` (48px).
- **Fill:** `--surface-panel` (translucent white over the gradient) with `--shadow-raised`. A faint 1px inner white highlight on the top edge.
- **Signature shape detail:** the panel's top edge has a **concave "notch"** that wraps around the centered tab group, so the tab tray looks cut out of / merged into the panel. Easiest implementation: a tab tray (rounded rect, `--surface-tabgroup`) positioned at the top center overlapping the panel top, plus inverted-corner pseudo-elements (radial-gradient masks, 24px radius) at both sides of the tray. If too complex, a plain tray overlapping the panel edge is an acceptable fallback.
- **Header row (inside panel):**
  - Left: title "Case Pipelines", 16px/500, `--text-secondary`, ≈ 30px from left.
  - Center: **Tab group** (see 4.3).
  - Right: three **48px outlined circle buttons**: share/upload, calendar, expand/fullscreen (diagonal arrows). Bg transparent/very light, 1px `--border-hairline`, 18px icon.

### 4.3 Tab group (segmented control)
- Tray: width ≈ 500px, height ≈ 88px (includes padding), `--r-full`, `--surface-tabgroup`.
- Tabs: `Pipelines · In Progress · Completed · Expired`
  - Pill height 54px, horizontal padding ≈ 24px, gap 6px, `--r-full`, 15px/500.
  - **Active:** `--accent-black`, white text, `--shadow-black`.
  - **Inactive:** `#F3F3F5` / white, `--shadow-pill`, `--text-primary`.
- **Contextual header variant (when "In Progress" workflow view is active):** panel title becomes **"Cases in Progress ⌄"** (a dropdown with a small chevron), and the right side shows a **black pill button "＋ Add New Case"** (height 54px, padding 24px, white 15px/600 text) followed by two outlined circle buttons.

### 4.4 Kanban columns (4 columns)
Columns: **New Cases · In Progress · Pending Info · Closed**.
- Column width ≈ 300px, gap ≈ 20px, left inset ≈ 34px from panel edge.
- **Column header:** outlined pill, height ≈ 51px, full column width, transparent bg, 1px `--border-hairline` (slightly darker bottom edge for a subtle emboss), centered label 15px/500.
- Column body starts ≈ 28px below the header; cards stack vertically with 8px gap. The panel body is **scrollable vertically**; cards are clipped by the panel's bottom radius (see the half-cut card at the bottom of "New Cases").

### 4.5 Case card (pill)
- Size: full column width (~300px) × **78px**, `--r-full`.
- Fill `--surface-card`, `--shadow-pill`.
- **Layout (left → right):** 48px circular avatar (photo, 2px light ring) → 12px gap → text block → right slot.
  - Title: 17px/500, `--text-primary`, truncate with ellipsis.
  - Sub-line: 12px, `--text-secondary`. Examples: "Current wait time: 30 minutes", "Approximate wait: 10 minutes", "Anticipated wait: 25 minutes", "Expected wait: 35 minutes", "Projected wait: 40 minutes", "Estimated wait: 12 minutes".
  - **Right slot varies by column:**
    - New Cases: horizontal **"···" more menu** (three 3px dots, `--text-primary`).
    - In Progress: *(no right icon)*.
    - Pending Info: **clock icon** (20px outline, stroke 1.5px).
    - Closed: **double-check ✓✓** icon (20px).
- **Connector ports:** every card has tiny **ports (≈ 7–8px circles, ring `--blue-soft` with `--blue` center)** at top-center, bottom-center and right-middle edge. Between vertically adjacent cards, the bottom port of one and top port of the next visually link them as a chain. Cards can be dragged between columns; a thin curved line (≈ 1.5px, dark/`--blue`) follows the cursor from the right port while dragging (visible in the video as a short black curve from "Conversion Issues").
- States: hover = lift 1px + brighter fill; dragging = scale(1.02) + `--shadow-raised`; drop target column header gets a 1px `--blue` outline.

### 4.6 Bottom row: two chart cards
Two cards side by side below the main panel, gap ≈ 20px, equal width (~50% each), `--r-panel`, `--surface-panel-blue` (noticeably bluer than the top panel), top edge partially visible at the fold. Each card has a header with **title (16px/500) + caption (11–12px gray)** on the left and **two 48px outlined circle buttons (share, calendar)** on the right.

**Card 1: "Top Case Drivers" (caption: "Last 30 Days")**
- Chart: **overlapping circles/donut-style share chart**: a large blue circle (`--blue-strong`) overlapped by a red segment/circle (`--red`), with a white count bubble ("4") and label "Billing Inquiry" inside the blue shape.
- Legend to the right: colored dot (8px) + name + bold percent:
  - ● Billing Inquiry **(54%)** (blue)
  - ● Integration Errors **(27%)** (red)
  - (more rows below the fold; use gray/yellow/sage for additional categories)

**Card 2: "Case Metrics" (caption: "Average resolution of issues")**
- Three **radial gauges** in a row, each ≈ 130px diameter: thick arc (≈ 10px stroke, round caps) on a light-gray track, large centered number below/inside:
  1. Blue arc (`--blue-strong`), value **128**
  2. Yellow arc (`--yellow`), value **4.66**
  3. Sage/gray-green arc (`--sage`), value **82%**
- Number: ~22px/600. A small caption sits under each value (e.g. units).

---

## 5. Screen B: Workflow Editor (zoomed "In Progress" case flow)

This is the case workflow canvas opened from the "In Progress" tab.

### 5.1 Team strip (top)
- A horizontal tray (pill/rounded, same `--surface-tabgroup` look as the tab tray, slightly bleeding into the panel with the same concave notch) containing **8 team member avatars**, 78px circles at this zoom (≈ 56px at 1440 base), gap ≈ 12px.
- **Under each avatar, a 24px badge circle:**
  - Blue (`--blue`) with white number (2, 3): tasks assigned/in progress.
  - Red (`--red`) with white number (2, 1): overdue/blocked tasks.
  - Dark `+` circle (`#32353A`, white plus) for members with no tasks (tap to assign).
- Right of the tray: toolbar of outlined circle buttons (`+`, share, …), 48px.

### 5.2 Stage cards (columns)
Three stage groups laid out horizontally with a **label centered below each**: **"Issue Identification"**, **"Technical Resolution"**, **"New Tasks"** (labels 16px/500, dark).

**Stage card (Issue Identification / Technical Resolution):**
- Size ≈ 340px wide, height ≈ 400px at 1440 base, `--r-stage` (40px), fill `--surface-card-solid` (`#F1F2F5`), `--shadow-raised`.
- Contains 5 **step rows**, each ≈ 72px high, avatar-first.

**Step row anatomy**
- **Assigned step:** 56px avatar → 2-line label (15–16px/400, wraps) → right slot.
  - Done: **double-check ✓✓** + **64px outlined circle button with calendar icon** (opens schedule picker).
  - In progress / next: label in **bold (600)**, right slot is a faint "···" (3 dots, diagonal/horizontal).
- **Unassigned step:** a **56px white circle with a `+`** replacing the avatar; label in `--text-muted` (gray). Click to assign someone.
- Mixed state shown in video: the step "Advise Customer of Resolution Estimate" is assigned (avatar + dark text + "···") while its siblings are unassigned (+ and gray text).

**Step rows in the video**
- Issue Identification: *Identify Issue Category* (✓✓ + calendar), *Identify Issue Severity* (✓✓ + calendar), *Identify Issue Impact* (✓✓ + calendar), **Allocate to Resolution Team** (bold, ···), **Advise Customer of Resolution estimate** (bold, ···).
- Technical Resolution: *Identify Issue Dependencies* (+), *Identify Issue Resolution* (+), *Estimate Resolution Time* (+ / avatar once assigned), *Advise Customer of Resolution Estimate* (avatar, ···), *Advise Customer Issue Resolved* (+).

### 5.3 Connectors between steps/stages
- **Ports:** 14px circles on card left/right edges at each row's vertical center. Ring `--blue-soft`; center dot 6px: **blue** for outgoing/completed paths, **red** for pending/blocked ones.
- **Lines:** smooth **cubic Bézier curves**, 1.5px stroke.
  - **Solid blue** (`--blue`): satisfied dependency / completed flow.
  - **Solid or dashed red** (`--red`, `stroke-dasharray: 4 4` for pending/not-yet-satisfied): pending dependency.
- Lines are drawn in an SVG layer behind the cards; endpoints snap to ports. Recompute on drag/resize.

### 5.4 "New Tasks" tray
- A 2-column grid of **rounded-square tiles** (≈ 120×120 at 1440 base), `--r-tile` (28px), fill `#F2F3F5`, `--shadow-pill`, text top-left, 14px/400, 2-line wrap, padding ≈ 16px.
- Tiles: *Request Processing, Problem Resolution, Customer Communication, Testing and Verification, Customer Notification, Customer Satisfaction.*
- **Draggable** onto a step's port: a dashed red line extends from the tile to the target port while dragging.

---

## 6. Screen C: "Processing of the New Case" modal

Opened by **＋ Add New Case**.

- **Backdrop:** the page behind gets `backdrop-filter: blur(14px)` + a cool tint overlay `rgba(198,202,213,0.55)`.
- **Sheet:** centered, width **≈ 480px**, auto height, `--surface-modal` (#EFF0F2), `--r-modal` (40px), padding 32px, `--shadow-raised`.

**Structure (top → bottom)**
1. **Header row:** title "Processing of the New Case" (20px/500) left; **56px outlined circle close button (×)** right (1px `--border-hairline`, bg transparent).
2. **1px divider** (`--divider`), margin 16px 0 20px.
3. **Case Name:** label (14px, `--text-secondary`/dark gray, mb 8px) → **input pill** (height 58px, `--r-full`, `--surface-input`, soft shadow, 24px side padding, 18px/500 value) with a **pencil/edit icon** on the right. Blinking text caret while typing. Example value: "Conversion Issues".
4. **Case Creator:** label → **select pill** (58px): 55px avatar flush to the left inside the pill, name (16px/500) + role sub-line (12px, gray), **chevron-down** on the right. Example: "Brian McCartney / Senior Technical Lead of the Project", "Alex Thompson / Lead Engineer for the Initiative".
5. **Responsible Team:** label → **select pill** (58px): **overlapping avatar stack** (3 avatars, 55px, overlap ≈ -14px, white 2px ring each) → team name (16px/500) + sub-line ("Main Support Team") → chevron-down. Example: Team-A, Team-B. When opened, the dropdown list slides out below, rows with the same anatomy (the video shows a clipped second option sliding under the selected pill).
6. **Allocated Budget:** label → **range slider where the thumb is a big pill**:
   - Thumb: ≈ 140×58px pill, `--surface-input`, centered value **"42,650 $"** (18px/600, with a small "$" suffix in gray), **drag grips** at both ends: three vertical dots (left faint/light, right dark).
   - Track extends to the right: 10px tall, `--r-full`, filled `--blue-strong` (#89A3D6) on the active side, light gray on the rest.
7. **Case Description:** label (note: video spells it "Discription"; use correct spelling "Description") → **textarea** (height ≈ 120px, `--r-textarea` 32px, `--surface-input`, soft inset shadow, padding 20px, placeholder "Enter a description and the complexity of the case" in `--text-muted`, 15px).
8. **Footer actions** (two equal pills, gap 10px, height 60px):
   - **Cancel Addition:** `--surface-input`/#F9F9FB, `--shadow-pill`, `--text-primary`, 16px/500.
   - **Add Case:** `--accent-black`, white text 16px/600, `--shadow-black`.

**Field labels** sit above each control with ~20px vertical rhythm between field groups. All controls are pill-shaped with a soft, slightly "puffy" look.

---

## 7. Component Inventory (build as reusable components)

| Component | Key props | Notes |
|---|---|---|
| `AppShell` | `children` | page gradient, nav, rail, content area |
| `TopNav` | `items`, `activeKey` | black active pill |
| `IconRail` | `items`, `theme`, `onThemeToggle` | circle buttons, sticky bottom toggle |
| `CircleButton` | `icon`, `variant: soft \| outline \| black`, `dot?`, `size` | 48/52/54/56/64 sizes |
| `PillButton` | `variant: primary(black) \| secondary(white)`, `icon?` | 54–60px tall |
| `SegmentedTabs` | `tabs`, `value`, `onChange` | tray + pills, notch shape |
| `Panel` | `title`, `actions`, `tone: glass \| blue` | radius 48 |
| `ColumnHeader` | `label` | outlined pill |
| `CaseCard` | `avatar`, `title`, `subtitle`, `rightSlot: menu \| clock \| done` | pill, ports, draggable |
| `Avatar` / `AvatarStack` | `src`, `size`, `overlap` | 2px ring |
| `Badge` | `tone: blue \| red \| dark`, `value \| plus` | 24px circle under avatar |
| `FormField` | `label` | label + control wrapper |
| `PillInput`, `PillSelect`, `PillTextarea` | standard form props | 58px / 32px radius |
| `PillSlider` | `min`, `max`, `value`, `prefix/suffix` | big pill thumb |
| `Modal` | `open`, `title`, `onClose` | blur backdrop |
| `StageCard` | `title`, `steps` | workflow column |
| `StepRow` | `avatar?`, `label`, `status: done \| active \| empty` | + / ✓✓ / ··· states |
| `ConnectorLayer` | `links[]` | SVG Béziers, blue solid / red dashed |
| `TaskTile` | `label` | draggable square tile |
| `RadialGauge` | `value`, `max`, `color`, `label` | 10px stroke, round caps |
| `ShareDonut` / `LegendItem` | `segments[]` | dot + name + bold % |

**Icons:** outline style, 1.5px stroke, rounded caps/joins. Use **Lucide** (`search, mail, bell, chevron-left, share-2, upload, star, plus, smartphone, database, calendar, send, triangle-alert, moon, sun, pencil, chevron-down, clock, check-check, ellipsis, x, maximize-2`).

---

## 8. Responsive Behavior (not shown in video; recommended)
- ≥ 1280px: layout as above.
- 1024–1279px: columns shrink to ~240px; chart cards stay side by side.
- < 1024px: nav collapses into a hamburger pill; icon rail becomes a bottom dock; kanban columns scroll horizontally with snap; chart cards stack; modal becomes a full-width bottom sheet (radius 32px top).

---

## 9. Implementation Instructions for Antigravity

1. **Do not break functionality.** Keep existing routes, API integration, auth, state and data. Only restyle and restructure markup/CSS.
2. **Start with tokens:** create the CSS variables from §2 (or map them into the existing Tailwind/theme config), add the font, then build the shared primitives (`CircleButton`, `PillButton`, `Avatar`, `Panel`, `PillInput`…) before touching pages.
3. **Rebuild the shell** (TopNav + IconRail + gradient background) so every page inherits the new look.
4. **Map existing screens to the reference patterns:**
   - Any list / board of items → pill `CaseCard`s inside outlined-header columns on a glass `Panel`.
   - Dashboard stats → bluish `Panel` cards with `RadialGauge` and legend charts.
   - Any "create/edit" form → the pill-form `Modal` (§6).
   - Any multi-step or assignment flow → `StageCard` + `StepRow` + `ConnectorLayer` (§5).
   - Filters/views → `SegmentedTabs`.
5. **Replace** square/rectangular buttons, bordered inputs, table-heavy layouts and hard-edged cards with the pill/soft-glass equivalents. Keep tables only where data density truly requires it, and then style rows as soft pills.
6. **Avatars:** wherever a user/owner appears, show a circular avatar (fallback: initials on `--blue-soft`).
7. **Theme toggle:** implement light (default, as designed) and dark (extrapolated tokens in §2.1), with the sun/moon control at the bottom of the rail.
8. **Accessibility:** keep contrast ≥ 4.5:1 for body text (`--text-secondary` on white is OK; `--text-muted` is for placeholders/disabled only), visible focus ring `2px solid --blue` + 2px offset, ARIA labels on all icon-only buttons.
9. **Done when:** shell, board, cards, modal form, workflow editor (if the app has an equivalent flow) and dashboard cards visually match the reference, and every existing feature still works.

---

## 10. Quick Visual Checklist
- [ ] Gradient grey-blue canvas, no flat white background
- [ ] All buttons/inputs/tabs are pills or circles (no sharp corners)
- [ ] Black = active/primary (nav, tabs, primary button, theme toggle)
- [ ] Soft shadows with white top-left highlight, no hard borders (except outlined circle buttons / column headers)
- [ ] Avatar-led cards with sub-line text in small gray
- [ ] Connector ports and curved blue/red lines in workflow views
- [ ] Bluish chart cards with radial gauges and legend with bold percentages
- [ ] Modal with blurred backdrop, 58px pill fields, pill-thumb budget slider, Cancel (white) + Add (black) footer
- [ ] Red dot notifications on mail / bell / alert icons
