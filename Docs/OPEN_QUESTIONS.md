# HACA Marketing OS: Open Questions, Ambiguities & Working Defaults

**Date:** 18 October 2026  
**Status:** Working Defaults Established  
**Authority:** [HACA-Marketing-OS-Build-Spec.pdf](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/HACA-Marketing-OS-Build-Spec.pdf) (§16) and [PROJECT_REPORT.md](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/docs/PROJECT_REPORT.md) (§17)  

> [!NOTE]
> Every question below has an established **Working Default**. The build can proceed immediately across Phases 0 through 7 without waiting. If the Marketing Head chooses an alternative for any item, update this file and adjust the corresponding configuration in `00-project-context.md`.

---

## 1. Core Workflow & Scope Decisions

### 1.1 Request Intake Removal from Other Departments
* **Ambiguity:** In HACA FORGE, other departments (Sales, Academics, Management) raised marketing requests via dynamic intake forms. Spec §01 states V1 is the "Team Workspace only". Is the external request portal completely eliminated?
* **Working Default:** **YES, removed completely.** Marketing OS is an internal team planning system where the Marketing Head and Team Leads create work items inside planned Campaigns. Other departments do not have login access or intake forms.
* **Internal Work Requests:** To enable team members to suggest work, an internal `WorkRequest` record is provided: a team member can request work via their Team Lead, who can accept and convert it into a formal `WorkItem`.

### 1.2 System Owner (Admin) vs. Marketing Head vs. Executive Email Recipients
* **Ambiguity:** Does the Marketing Head own user administration, and do executive leaders (CEO, Business Head) log in?
* **Working Default:** **4-Role Model:**
  * **`admin` (System Owner):** IT / System Owner outside the creative hierarchy. Holds all permissions (derived), manages user accounts, approves access requests, grants roles, suspends users, and forces logouts.
  * **`marketing_head`:** Operational leader of marketing. Plans work, targets, and campaigns; manages operational assignments (`people.assign` for `team_lead` and `team_member`), but cannot create users or grant roles.
  * **`team_lead` & `team_member`:** Operational roles.
  * **CEO & Business Head:** Email recipients only. They do not log into the portal and receive scheduled HTML reports.

### 1.3 Starting Profile for Carried-Over Data
* **Ambiguity:** When converting existing FORGE users to the `Person` schema, which of the 7 Profiles should they belong to?
* **Working Default:** **`HACA` (Main Brand)** is the default corporate profile. All migrated users receive access to all 7 profiles (`profileAccess = [all 7 profiles]`) until the Marketing Head explicitly scopes them in the People Management interface (`/people`).

### 1.4 Migration Overrides for Admin and Marketing Head Accounts
* **Ambiguity:** The database currently has 1 `admin` and 2 `head` accounts. Which specific accounts should end up as `admin` and which as `marketing_head`?
* **Working Default:**
  * By default, the account with email `admin@hacaforge.com` (or existing `admin` role) remains `admin`.
  * The two existing `head` accounts are mapped to `marketing_head`.
  * Support an optional `scripts/migration-overrides.json` file mapping `{ "<email>": "<new_role>" }` that runs after the default role map, allowing exact account-by-account assignments before running the migration.

---

## 2. LeadSquared (LSQ) Integration & Lead Data

### 2.1 LSQ Webhook vs. Scheduled Batch Polling
* **Ambiguity:** Does LSQ offer a real-time webhook for inbound leads, or is access restricted to batch/scheduled API exports?
* **Working Default:** **Dual-mode architecture:**
  1. A webhook endpoint (`/api/leads/webhook`) is provided to receive real-time lead pushes if LSQ webhook triggers are enabled.
  2. A scheduled 15-minute polling job (`lsq_live_sync` via BullMQ) runs continuously to fetch new/updated leads using timestamp deltas.
  3. During local development and testing, an adapter interface (`lsqAdapter.js`) uses realistic JSON fixtures so Phase 8 can be fully developed and tested before live credentials are provided.

### 2.2 Inbound Lead Auto-Task Creation: Work Type & Campaign Attachment
* **Ambiguity:** Spec §09 specifies that "WhatsApp Inbound auto-creates a task for the WhatsApp Marketer." Because Marketing OS enforces strict traceability (every WorkItem requires a `campaignId`), what work type and campaign does this task attach to?
* **Working Default:**
  * **Work Type:** `WhatsApp Blast` (or `Copy`).
  * **Target Campaign:** Attached to a seeded, permanent system campaign titled **`"Always-On Inbound & Nurture"`** created under each Profile, linked to the active `MonthlyTarget`.
  * **Assigned Owner:** The active `Person` with job role `WhatsApp Marketer` in that profile's WhatsApp department.

### 2.3 Lead-to-Work-Item Attribution Key
* **Ambiguity:** LSQ tracks lead source and campaign name. How is an individual lead tied back to a specific `WorkItem`?
* **Working Default:**
  * **Primary Attribution (Macro):** Attributed to `Campaign` via matching `lead.CampaignName` with `campaign.name` or UTM Campaign tag.
  * **Granular Attribution (Micro):** Attributed to `WorkItem` via UTM Content tag (`utm_content = workItem.shortId` or `workItem._id`). When present in lead metadata, CPL and leads generated are attributed directly to that creative.

### 2.4 Lead Source to Department Mapping (19 Sources)
* **Ambiguity:** Spec §09 confirms `WhatsApp Inbound` $\rightarrow$ `WhatsApp Marketer`. The remaining 18 sources require operational ownership.
* **Working Default:**
  * **WhatsApp Department:** `WhatsApp Inbound`, `WhatsApp Reactivation`.
  * **Performance Marketing Department:** `Facebook Lead Ads`, `Google Ads`, `Meta Re-Engaged Leads`, `Online Campaigns (SMM)`.
  * **Social Media Department:** `SMM YouTube`, `SMM Instagram`.
  * **SEO & Content Department:** `SEO`, `Website Leads`.
  * **Offline / Ops / Unassigned:** `Student Referral`, `Staff Referral`, `Inbound Phone Calls`, `Outbound Phone Calls`, `Walk-in`, `Workshops/Webinars`, `Offline Campaigns`, `PR`.
  * Unassigned sources display in the **Data Center** (`/data-center`) for the Marketing Head to monitor and manually assign.

---

## 3. Operations, Thresholds & Business Rules

### 3.1 Source of Spend and Revenue Actuals
* **Ambiguity:** Are budget spend and revenue numbers pulled via automated billing APIs (Meta/Google Ads, Payment Gateways), or entered manually?
* **Working Default:** **Manual entry in V1.**
  * The Marketing Head enters Monthly Revenue actuals in the Target section of `/dashboard` (or derived from LSQ paid deal stages if available).
  * The Campaign Owner or Marketing Head enters `spendActual` on the Campaign Detail screen (`/campaigns/:id`).
  * Automated ad-spend API synchronization is reserved for V1.1.

### 3.2 Weekly Capacity Hours per Job Role
* **Ambiguity:** Spec §04 and §15 define workload % as $\frac{\sum \text{estimatedEffortHrs}}{\text{weeklyCapacityHours}}$, but role-specific capacity baselines were not set.
* **Working Default:** Flat **40 hours per week** for all 13 job roles by default. The Marketing Head can override capacity per person (e.g., 20h for part-time, 35h for leads) in `/people`.

### 3.3 Revision Flag Thresholds & Escalation Timing
* **Ambiguity:** Spec §07 proposes "baseline + 1 round or hard cap of 4", and §10 proposes a 4-hour overdue escalation window. Are these confirmed?
* **Working Default:** Confirmed as the standard defaults:
  * **Revision Flag Trigger:** An item is flagged when `revisions >= 4` OR `revisions > (owner.avgRevisions + 1)`.
  * **Escalation Window:** If an item remains flagged without a root-cause classification for $> 48\text{ hours}$, or if the same owner is flagged $\ge 2\text{ times}$ within a rolling 30 days, an urgent alert escalates to the Marketing Head.
  * **Overdue Escalation:** Owner is notified immediately when deadline passes; Team Lead is escalated after **4 hours**.

### 3.4 Definition of the "At Risk" KPI
* **Ambiguity:** What conditions determine that a work item or campaign is "At Risk"?
* **Working Default:**
  * **Work Item At Risk:** Any open work item (`Not Started`, `In Progress`, `Pending`, or `Blocked`) due within **3 days (72 hours)** that has not reached `Feedback`.
  * **Campaign At Risk:** A campaign where $> 25\%$ of attached open work items are overdue/blocked, OR where spend $> 90\%$ of budget while target output is $< 50\%$.

### 3.5 Status Semantics: "Pending" and "Published"
* **Ambiguity:** What are the exact behavioral semantics and transition permissions for `Pending` and `Published`?
* **Working Default:**
  * **`Pending`:** Work is temporarily on hold for non-critical dependencies or scheduled pauses (not hard-blocked). The owner can toggle `In Progress` $\leftrightarrow$ `Pending` at will.
  * **`Published`:** Terminal live status. After a reviewer marks an item `Approved`, either the owner or reviewer transitions it to `Published` upon posting/going live, providing the final public URL.

### 3.6 Report Delivery Format
* **Ambiguity:** Are reports delivered as PDF downloads, Excel spreadsheets, or emails?
* **Working Default:** **Dual Delivery:**
  1. **Automated Delivery:** Rich, beautifully styled responsive HTML email containing the summary metrics, tables, and charts.
  2. **In-App View:** A live interactive report view under `/reports` with a "Print / Save as PDF" stylesheet and CSV export button.

### 3.7 System Timezone
* **Ambiguity:** In what timezone do schedulers, reports, and daily cutoffs operate?
* **Working Default:** Configured via `REPORT_TIMEZONE` in `.env`, defaulting to **`Asia/Kolkata` (IST, UTC+5:30)**, matching HACA's headquarters and operational hours.
