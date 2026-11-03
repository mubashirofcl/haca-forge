# HACA Marketing OS — UI Standards & Component Design System

**Document Authority:** Single Source of Truth for Visual Design, Layout Shells, Glassmorphism Tokens, Spacing Grid, Core Components, Accessibility, and Mobile Responsiveness.  
**Scope:** Universal across all five canonical roles (`admin`, `creative_head`, `sm_manager`, `executive`, `team_member`).

---

## 1. Design System Tokens & Glassmorphism

### 1.1 Color Palette & Surfaces
* **Background Gradient Canvas:**
  * Base: Radial and linear layered gradients (`#f4f6fa` to `#edf1f8` to `#e8edf5`) with subtle indigo and violet glow accents.
  * Attachment: `fixed`, minimum height `100vh`.
* **Glassmorphic Tokens:**
  * `.glass-panel`:
    * Background: `rgba(255, 255, 255, 0.70)`
    * Backdrop filter: `blur(20px) saturate(180%)`
    * Border: `1px solid rgba(255, 255, 255, 0.85)`
    * Box shadow: `0px 20px 40px -15px rgba(0, 0, 0, 0.05), inset 0px 1px 0px rgba(255, 255, 255, 0.95)`
  * `.glass-card`:
    * Background: `rgba(255, 255, 255, 0.78)`
    * Backdrop filter: `blur(16px)`
    * Border: `1px solid rgba(255, 255, 255, 0.90)`
    * Radius: `18px` (`rounded-2xl` / `rounded-3xl`)
    * Box shadow: `0px 10px 30px rgba(0, 0, 0, 0.04), inset 0px 1px 0px rgba(255, 255, 255, 0.90)`
    * Hover transition: `all 0.2s cubic-bezier(0.16, 1, 0.3, 1)` -> subtle elevation (`-2px`) and violet border tint (`rgba(122, 106, 246, 0.35)`).
  * `.glass-modal`:
    * Background: `rgba(255, 255, 255, 0.92)`
    * Backdrop filter: `blur(24px) saturate(200%)`
    * Border: `1px solid rgba(255, 255, 255, 0.95)`
    * Radius: `24px` to `28px`
    * Box shadow: `0px 30px 60px -15px rgba(0, 0, 0, 0.15), inset 0px 1px 0px rgba(255, 255, 255, 1)`
  * `.glass-pill-container`:
    * Background: `rgba(255, 255, 255, 0.65)`
    * Border radius: `9999px`

### 1.2 Typography Hierarchy
* **Font Family:** Plus Jakarta Sans, Inter, system sans-serif (`font-sans`).
* **Page Titles:** `24px`–`28px` / Font-Weight: 800 or 900 (`font-black`) / Tracking: `-0.03em`.
* **Section Headers:** `16px`–`18px` / Font-Weight: 700 (`font-bold`) / Tracking: `-0.01em`.
* **Card Titles & Subsection Headers:** `14px`–`15px` / Font-Weight: 700 (`font-bold`).
* **Body Regular & Labels:** `13px`–`14px` / Font-Weight: 500 or 600.
* **Metadata & Captions:** `11px`–`12px` / Font-Weight: 500 (`text-slate-400` or `text-slate-500`).
* **Uppercase Kicker Labels:** `10px`–`11px` / Font-Weight: 800 / Tracking: `0.05em` (`tracking-wider uppercase`).

---

## 2. 8px Grid & Layout Rules

### 2.1 Spacing Grid
* All paddings, margins, gaps, and dimensions strictly adhere to multiples of 8px (with 4px for compact half-grid elements):
  * `4px`: `p-1`, `gap-1`, `m-1` (compact badges, micro chips)
  * `8px`: `p-2`, `gap-2`, `m-2` (element spacing, inline badges)
  * `16px`: `p-4`, `gap-4`, `m-4` (card interior compact padding, form field gaps)
  * `24px`: `p-6`, `gap-6`, `m-6` (standard card interior padding, section separation)
  * `32px`: `p-8`, `gap-8`, `m-8` (major page container gutters, modal padding)
  * `48px`: `pb-12`, `py-12` (page bottom clearance)

### 2.2 Layout Shell for Pages
Both `/profile` and `/settings` share the identical outer layout shell:
* Max Width: `max-w-5xl` centered (`mx-auto`).
* Horizontal Gutters: `px-4 sm:px-6`.
* Vertical Clearance: `pt-4 pb-12 space-y-6`.
* Animation: `animate-fade-in`.

### 2.3 Mobile Responsiveness & 44px Touch Targets
* **Mobile Viewport Target:** Full support down to `360px` screen width.
* **Touch Target Standard:** Every interactive button, toggle switch, dropdown trigger, and tab item must meet the minimum WCAG touch target dimension of **`44px x 44px`** on mobile screens.
* **Stacking Behavior:** Multi-column grid containers (`grid-cols-2`, `grid-cols-3`, desktop split-panes) collapse to single stacked columns (`grid-cols-1`) below `640px` (`sm:` breakpoint).
* **Side-by-side Action Buttons:** On mobile screens, action pairs (`Save` / `Cancel`) stretch to full width or wrap cleanly without clipping text.

---

## 3. Core Component Standards

### 3.1 Buttons
* **Primary Button:**
  * High-contrast dark pill: `bg-slate-900 text-white hover:bg-black rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 min-h-[44px] px-5`.
* **Secondary / Outline Button:**
  * Frosted glass: `bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 rounded-xl font-semibold text-xs sm:text-sm shadow-xs transition-all active:scale-95 min-h-[44px] px-4`.
* **Danger Button:**
  * Crimson accent: `bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/60 rounded-xl font-bold text-xs sm:text-sm transition-all min-h-[44px] px-4`.
* **Icon-Only Button:**
  * Square or rounded circle: `w-11 h-11 flex items-center justify-center rounded-xl bg-white/70 hover:bg-white text-slate-600 border border-white/90 shadow-sm transition-all`.

### 3.2 Form Fields
* **Input Container:**
  * Background: `bg-white/80 border border-slate-200/90 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all min-h-[44px] w-full`.
* **Labels:**
  * Stacked above input: `block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5`.
* **Inline Validation Errors:**
  * Positioned immediately underneath the invalid field: `text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1`.
* **Character Counters:**
  * Right-aligned beneath textareas: `text-[11px] font-mono text-slate-400 mt-1 text-right`.

### 3.3 Chips & Badges
* **Role Badges:**
  * `admin`: `bg-purple-500/10 text-purple-700 border border-purple-200/50`
  * `creative_head`: `bg-amber-500/10 text-amber-800 border border-amber-200/50`
  * `sm_manager`: `bg-blue-500/10 text-blue-700 border border-blue-200/50`
  * `executive`: `bg-indigo-500/10 text-indigo-700 border border-indigo-200/50`
  * `team_member`: `bg-emerald-500/10 text-emerald-700 border border-emerald-200/50`
* **Status Badges:**
  * `active`: `bg-emerald-50 text-emerald-700 border border-emerald-200`
  * `suspended`: `bg-rose-50 text-rose-700 border border-rose-200`
  * `invited`: `bg-amber-50 text-amber-700 border border-amber-200`

### 3.4 Feedback & Status Patterns
* **Loading Skeletons:**
  * Animated pulsing rectangles matching exact target geometries: `animate-pulse bg-slate-200/70 rounded-2xl`.
* **Error State with Retry:**
  * Glass card banner with an alert icon, clear explanation, and a dedicated `"Retry"` button triggering manual refetch.
* **Success Toast:**
  * Glassmorphic transient banner positioned top-center or inline check confirmation pill, auto-dismissing in 2.5s.

### 3.5 Accessibility & Contrast (WCAG AA)
* Minimum contrast ratio of 4.5:1 for normal body text and 3:1 for large text / graphical controls.
* Explicit `aria-label` or visible `<label>` on every input and icon button.
* Visible keyboard focus rings (`focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2`).
* Logical tab navigation order preserving visual DOM flow.

---

## 4. New Design Patterns

### 4.1 Avatar Pattern (`<Avatar />`)
The universal `<Avatar />` component standardizes user photo and initials rendering across the entire application:
* **Sizes:**
  * `xs`: `20px x 20px` (`w-5 h-5 text-[10px]`) — Table cells, nested comments.
  * `sm`: `28px x 28px` (`w-7 h-7 text-xs`) — Owner chips, pipeline tracker, review pins.
  * `md`: `40px x 40px` (`w-10 h-10 text-xs`) — Navigation header, user cards, discussion threads.
  * `lg`: `48px x 48px` (`w-12 h-12 text-sm font-bold`) — Drawers, profile summaries.
  * `xl`: `80px x 80px` (`w-20 h-20 text-2xl font-black`) — Profile header card, welcome step.
* **Deterministic Fallback Colors:**
  * When no `avatarUrl` is present (or image fails to load), initials are rendered on a high-saturation background color deterministically calculated from the user's unique ID hash (SHA-256 or numeric reduction) selected from an accessible palette:
    * Slate Indigo: `from-slate-800 to-indigo-900`
    * Deep Violet: `from-purple-800 to-violet-950`
    * Teal Blue: `from-cyan-800 to-teal-900`
    * Amber Bronze: `from-amber-700 to-amber-900`
    * Emerald Dark: `from-emerald-800 to-teal-950`
* **Performance:**
  * Images use native `loading="lazy"` with an `onError` handler falling back seamlessly to initials.
* **Strict Constraint:**
  * **Zero presence indicator**: Do NOT render green online status dots or activity pips.

### 4.2 Form Section Pattern
Used across Profile and Account management to cluster related fields:
* **Structure:**
  * Container: `.glass-card p-6 sm:p-8 rounded-3xl space-y-6`.
  * Header: Icon container (`w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center`), section title (`text-base font-bold text-slate-900`), and descriptive subtitle (`text-xs text-slate-500`).
  * Body: Form fields in an 8px grid (`gap-4 sm:gap-6`).
  * Action Footer: Divider (`border-t border-slate-100/80 pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3`), dirty-state indicator, `"Cancel"` button, and `"Save Changes"` primary button with loading spinner state.
  * Dirty State Guard: Warns the user when navigating away from a form with unsaved changes.

### 4.3 Settings Row Pattern
Used across Security, Notifications, and System Preferences:
* **Structure:**
  * Container: Flex container (`flex items-center justify-between p-4 rounded-2xl bg-white/60 hover:bg-white/90 border border-slate-100/90 transition-all`).
  * Left Content:
    * Optional leading icon: `w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0`.
    * Title: `text-xs sm:text-sm font-bold text-slate-900`.
    * Description: `text-xs text-slate-500 mt-0.5 max-w-md`.
  * Right Action:
    * Toggle switch (`w-11 h-6 bg-slate-200 peer-checked:bg-slate-900 rounded-full`), or single action button (`px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 min-h-[44px]`).
  * Mobile Layout (<640px):
    * Flex direction switches or wraps so description and control remain legible and comfortably clickable without overflow.

