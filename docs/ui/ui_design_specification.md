# UI/UX Specification: Antigravity Modern Glassmorphic Dashboard

This document provides exact visual, component, and layout specifications to transform the current UI into the modern glassmorphic interface demonstrated in the reference design.

---

## 1. Design System Tokens

### 1.1 Color Palette
* **Background Canvas Gradient**:
  * Top-Left: `hsla(220, 20%, 97%, 1)`
  * Center / Accent Glows: `hsla(230, 60%, 95%, 0.8)`
  * Bottom-Right: `hsla(210, 15%, 93%, 1)`
* **Glassmorphic Surfaces**:
  * Default Surface: `rgba(255, 255, 255, 0.65)`
  * Surface Overlay Blur: `backdrop-filter: blur(20px) saturate(180%)`
  * Card Border: `1px solid rgba(255, 255, 255, 0.8)`
  * Active/Hover Surface: `rgba(255, 255, 255, 0.85)`
* **Primary Accents**:
  * Dark Accent (Primary Buttons / Active Tabs): `#0D0E12`
  * Secondary Accent / Focus Pill: `#4F46E5` (Indigo)
  * Hover Overlay: `rgba(0, 0, 0, 0.05)`
* **Typography & Icons**:
  * Primary Text: `#111827` (Gray 900)
  * Secondary Text: `#6B7280` (Gray 500)
  * Muted / Metadata Text: `#9CA3AF` (Gray 400)
  * Inverse Text: `#FFFFFF`

### 1.2 Typography Hierarchy
* **Font Family**: Inter, SF Pro Display, or system sans-serif stack (`font-sans`).
* **Page Titles**: `28px` / `1.2` / `Font-Weight: 700`
* **Section Headers / Modal Titles**: `20px` / `1.3` / `Font-Weight: 600`
* **Card Titles / Body Bold**: `14px`–`16px` / `Font-Weight: 600`
* **Body Regular / Form Labels**: `13px`–`14px` / `Font-Weight: 400`
* **Metadata / Timestamps**: `11px`–`12px` / `Font-Weight: 500`

### 1.3 Borders & Elevation
* **Corner Radius Scale**:
  * Modals & Large Containers: `28px`
  * Cards / Form Fields: `16px`
  * Pills / Buttons / Badges: `9999px` (Full rounded)
* **Shadow System**:
  * Glass Surface Elevation: `0px 20px 40px -15px rgba(0, 0, 0, 0.07), inset 0px 1px 0px rgba(255, 255, 255, 0.9)`
  * Floating Modals: `0px 25px 50px -12px rgba(0, 0, 0, 0.25)`

---

## 2. Main Structural Layout

```
+-----------------------------------------------------------------------------+
| Top Navigation Bar (Logo, Nav Tabs, Action Icons, Profile Avatar)          |
+---+-------------------------------------------------------------------------+
| L | Main Content Area                                                       |
| E |  +-------------------------------------------------------------------+  |
| F |  | Page Header: Title ("Cases Overview") & Tab Switchers              |  |
| T |  +-------------------------------------------------------------------+  |
|   |  | Kanban Board / Pipeline Columns                                    |  |
| S |  |  [ New Cases ]   [ In Progress ]   [ Pending Info ]   [ Closed ]  |  |
| I |  |  +-----------+   +-----------+   +--------------+   +--------+  |  |
| D |  |  | Card 1    |   | Card 2    |   | Card 3       |   | Card 4 |  |  |
| E |  |  +-----------+   +-----------+   +--------------+   +--------+  |  |
| B |  +-------------------------------------------------------------------+  |
| A |  | Bottom Analytics Row                                              |  |
| R |  |  [ Top Case Drivers ]            [ Case Metrics Dashboard ]        |  |
+---+-------------------------------------------------------------------------+
```

### 2.1 Fixed Left Icon Sidebar
* **Width**: `72px`
* **Background**: Semi-transparent glass container or direct page placement with subtle dividers.
* **Items**: Vertically stacked pill buttons for primary module switching.
  * Home / Dashboard (`Icon`)
  * Cases / Workflows (`Icon` with active background state)
  * Favorites / Analytics (`Icon`)
  * Settings (`Icon` pinned to bottom)
  * Light/Dark Toggle & Help (`Icon` pinned to bottom)

### 2.2 Top Navigation Header
* **Height**: `64px`
* **Left Section**: Brand logo (`sugarCRM` / `Antigravity` equivalent).
* **Center Section**: Horizontal tab capsule container.
  * Tabs: *Relationship*, *Opportunities*, *Leads*, *Calendar*, *Cases* (Active), *Reports*, *Quotes*.
  * Active Tab Styling: Solid black/dark pill background (`#0D0E12`) with white text.
* **Right Section**:
  * Search action button (`Icon`)
  * Notification badge (`Icon`)
  * User profile picture (Circular avatar, `36px` diameter, with status pill indicator).

---

## 3. Core Page Views & Components

### 3.1 Views Switching Bar
* **Main Title**: "Cases Overview" (or custom module title).
* **View Segment Controller**:
  * Capsule background switcher containing: *Pipelines* (Active), *In Progress*, *Completed*, *Expired*.
* **Primary Action**: "+ Add New Case" button on top right.
  * Capsule pill button with dark background and leading `+` icon.

---

### 3.2 Pipeline / Kanban Column Cards

#### Card Container
* **Padding**: `16px`
* **Background**: `rgba(255, 255, 255, 0.75)`
* **Border**: `1px solid rgba(255, 255, 255, 0.9)`
* **Border Radius**: `18px`

#### Card Elements Breakdown
1. **Header Row**:
   * Card Title (e.g., *Conversion Issues*, *Tech Visionaries*).
   * Context Menu Button (`...` vertical or horizontal dots).
2. **Subtext / Meta Row**:
   * Estimated duration label (e.g., *Approximate wait: 10 minutes*, *Estimated wait: 28 minutes*).
   * Small clock icon indicator.
3. **Footer Row**:
   * User Avatar or Team stack avatars (`28px` diameter overlap stack).
   * Dynamic node connector handle on right edge for connecting dependent cards.

---

### 3.3 Modal Dialog: New Case / Processing Form

When clicking on a card or clicking "+ Add New Case", a blurred glass backdrop overlay reveals the editing modal.

```
+---------------------------------------------------------------+
|  Processing of the New Case                             [ X ] |
|                                                               |
|  Case Name                                                    |
|  [ Conversion Issues                                      ✏️ ] |
|                                                               |
|  Case Creator                                                 |
|  [ 👤 Brian McCartney - Senior Technical Lead           v ] |
|                                                               |
|  Responsible Team                                             |
|  [ 👥 Team-A - Main Support Team                         v ] |
|                                                               |
|  Allocated Budget                                             |
|  [ ... 24,985 $                      ●========|             ] |
|                                                               |
|  Case Description                                             |
|  [ Enter a description and the complexity of the case...    ] |
|                                                               |
|  ( Cancel Processing )                 [ Take for Processing ] |
+---------------------------------------------------------------+
```

#### Modal Elements & Inputs
1. **Modal Container**:
   * Width: `540px`
   * Radius: `28px`
   * Backdrop: `backdrop-filter: blur(24px) brightness(0.9)`
2. **Form Controls**:
   * **Text Input (Case Name)**: Large white capsule input with right-aligned edit icon (`✏️`).
   * **Dropdown (Case Creator / Responsible Team)**:
     * Card-styled select inputs featuring embedded avatars, user/team names, and roles.
     * Expandable list showing additional options (e.g., *Team-B*, *Team-C*).
   * **Slider + Input (Allocated Budget)**:
     * Interactive horizontal slider linked with a formatted currency input field (`$`).
     * Step drag handle with active indigo bar fill.
   * **Textarea (Case Description)**:
     * Inset rectangular text block with rounded inner corners (`16px`), placeholder hint text.
3. **Action Buttons**:
   * Secondary Action: "Cancel Processing" / "Cancel Addition" (Light gray/white pill, dark border).
   * Primary Action: "Take for Processing" / "Add Case" (Solid black pill button with light hover accent).

---

### 3.4 Process Canvas / Journey Flow View

The UI supports switching to a flowchart/canvas state (*Customer Journeys*):

1. **Stage Columns**: *Case Allocation*, *Issue Identification*, *Technical Resolution*, *New Tasks*.
2. **Process Nodes**:
   * Compact glass cards showing task title, action icons (Calendar, Checkbox, Attachment), and assignee avatar.
3. **Connector Lines**:
   * SVG Bezier curved connecting cables with directional arrows indicating workflow hierarchy.
   * Dashed and solid status lines (Blue/Indigo for active, Gray for pending).

---

## 4. Key CSS / Style Variables Matrix

| Component Property | Exact Specification Value |
| :--- | :--- |
| **Glass Background** | `rgba(255, 255, 255, 0.65)` |
| **Glass Blur** | `backdrop-filter: blur(20px)` |
| **Border Radius (Modal)** | `28px` |
| **Border Radius (Card)** | `18px` |
| **Border Radius (Button)** | `9999px` |
| **Primary Button Text** | `#FFFFFF` |
| **Primary Button Background** | `#0D0E12` |
| **Card Shadow** | `0 10px 30px rgba(0, 0, 0, 0.05)` |
| **Modal Shadow** | `0 30px 60px rgba(0, 0, 0, 0.15)` |

---

## 5. Implementation Step Plan for Antigravity

1. **Update Base Layout Container**:
   * Replace sharp borders with `backdrop-filter` utility classes and soft gradient canvas background.
2. **Style Design System Tokens**:
   * Set global border radius rules for cards (`18px`) and inputs/buttons (`full rounded`).
3. **Refactor Form Controls**:
   * Convert select components to custom dropdowns supporting multi-avatar lead cards.
   * Style inputs to have inset light shadow backgrounds with integrated trailing icons.
4. **Implement Glassmorphism Overlay**:
   * Apply backdrop blur and semi-transparent white borders across all card containers and floating modals.