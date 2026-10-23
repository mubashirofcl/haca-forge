# HACA Marketing OS: User Accounts, Roles & Credentials

This document provides the complete reference of all user accounts currently provisioned in the system, their assigned roles (in both Marketing OS and legacy mappings), departments, and login passwords.

---

## 🔑 Quick Login Summary

| Role | Representative Email | Password | Landing Page |
|---|---|---|---|
| **Administrator** | `admin@hacaforge.com` | `Admin1212` | `/dashboard` (All Access) |
| **Marketing Head** | `sarah.lead@marketingportal.com` | `Password123!` | `/dashboard` (Executive View) |
| **Executive (C-Suite)** | `executive@demo.haca.local` | `demoPassword123!` | `/dashboard` (Executive Read-Only View) |
| **Team Lead (Content)** | `david.content@marketingportal.com` | `Password123!` | `/dashboard` (Scoped View) |
| **Team Lead (Graphics)** | `elena.graphics@marketingportal.com` | `Password123!` | `/dashboard` (Scoped View) |
| **Team Lead (Cinematography)** | `kai.cinema@marketingportal.com` | `Password123!` | `/dashboard` (Scoped View) |
| **Team Lead (Video Editing)** | `oliver.editor@marketingportal.com` | `Password123!` | `/dashboard` (Scoped View) |
| **Team Member (Creative Worker)** | `chloe.b@marketingportal.com` | `Password123!` | `/my-work` (Personal Queue) |

> **Default Password Policy:**
> - The **System Administrator** (`admin@hacaforge.com`) uses `Admin1212` (configured in `apps/api/.env`).
> - The **Demo Executive** (`executive@demo.haca.local`) uses `demoPassword123!`.
> - **All other staff accounts** use the shared test credentials: `Password123!`.

---

## 1. System Administration (`admin`)

Full administrative control over access requests, user roles, department setups, profile assignments, and audit logs.

| Name | Email | Marketing OS Role | Database Role | Password | Status |
|---|---|---|---|---|---|
| System Administrator | `admin@hacaforge.com` | `admin` | `admin` | `Admin1212` | Active |

---

## 2. Marketing Leadership (`marketing_head`)

Sets monthly revenue/lead targets, oversees cross-brand campaigns, triages deliverables, and monitors team throughput across all 7 brand profiles.

| Name | Email | Marketing OS Role | Database Role | Department | Password | Status |
|---|---|---|---|---|---|---|
| Sarah Mitchell | `sarah.lead@marketingportal.com` | `marketing_head` | `marketing_head` | Marketing Leadership | `Password123!` | Active |
| Marcus Vance | `marcus.lead@marketingportal.com` | `marketing_head` | `marketing_head` | Marketing Leadership | `Password123!` | Active |

---

---

## 3. Executive Leadership (`executive`)

Company management (CEO, Business Head, Board Directors). Full read-only view of all marketing data, reports, and dashboards across all 7 brand profiles (`personScope: 'all'`, all 7 profiles by default). Zero mutation privileges (cannot create, edit, approve, or delete deliverables, campaigns, or settings; HTTP 403 on all mutation routes). Lands on `/dashboard`. Excluded from auto-assignment candidate pools, workload metrics, and team performance digests. In the People Directory, contact details (email and phone) are masked/omitted for executive callers. Only System Administrators can grant or approve executive accounts.

| Name | Email | Marketing OS Role | Database Role | Department | Password | Status |
|---|---|---|---|---|---|---|
| Demo Executive | `executive@demo.haca.local` | `executive` | `executive` | Executive Management | `demoPassword123!` | Active |
| Auditor Claire (Legacy Viewer) | `claire.viewer@marketingportal.com` | `executive` | `executive` | Corporate Governance | `Password123!` | Active |

---

## 4. Team Leads (`team_lead`)

Manages campaigns, work distribution, quality reviews, and approvals for their designated teams and brand profiles.

| Name | Email | Marketing OS Role | Database Role | Department | Password | Status |
|---|---|---|---|---|---|---|
| David Reynolds | `david.content@marketingportal.com` | `team_lead` | `team_lead` | Content & Copywriting | `Password123!` | Active |
| Elena Rostova | `elena.graphics@marketingportal.com` | `team_lead` | `team_lead` | Graphics & Visual Design | `Password123!` | Active |
| Kai Takahashi | `kai.cinema@marketingportal.com` | `team_lead` | `team_lead` | Cinematography & Shoots | `Password123!` | Active |
| Oliver Thorne | `oliver.editor@marketingportal.com` | `team_lead` | `team_lead` | Video Editing & Motion Design | `Password123!` | Active |

---

## 5. Creative Team Members (`team_member`)

Executes assigned deliverables, requests assets, logs progress, and submits deliverables for review. Lands on `/my-work`.

| Name | Email | Marketing OS Role | Database Role | Department | Password | Status |
|---|---|---|---|---|---|---|
| Aria Montgomery | `aria.m@marketingportal.com` | `team_member` | `team_member` | Graphics & Visual Design | `Password123!` | Active |
| Chloe Bennett | `chloe.b@marketingportal.com` | `team_member` | `team_member` | Content & Copywriting | `Password123!` | Active |
| Dante King | `dante.k@marketingportal.com` | `team_member` | `team_member` | Cinematography & Shoots | `Password123!` | Active |
| Emma Watson | `emma.w@marketingportal.com` | `team_member` | `team_member` | Video Editing & Motion Design | `Password123!` | Active |
| Ethan Hunt | `ethan.h@marketingportal.com` | `team_member` | `team_member` | Cinematography & Shoots | `Password123!` | Active |
| Felix Baum | `felix.b@marketingportal.com` | `team_member` | `team_member` | Video Editing & Motion Design | `Password123!` | Active |
| Gemma Ward | `gemma.w@marketingportal.com` | `team_member` | `team_member` | Cinematography & Shoots | `Password123!` | Active |
| Julian Hayes | `julian.h@marketingportal.com` | `team_member` | `team_member` | Content & Copywriting | `Password123!` | Active |
| Leo Sterling | `leo.s@marketingportal.com` | `team_member` | `team_member` | Graphics & Visual Design | `Password123!` | Active |
| Liam O'Connor | `liam.o@marketingportal.com` | `team_member` | `team_member` | Content & Copywriting | `Password123!` | Active |
| Lucas Rivera | `lucas.r@marketingportal.com` | `team_member` | `team_member` | Video Editing & Motion Design | `Password123!` | Active |
| Mateo Rossi | `mateo.r@marketingportal.com` | `team_member` | `team_member` | Graphics & Visual Design | `Password123!` | Active |
| Maya Patel | `maya.p@marketingportal.com` | `team_member` | `team_member` | Content & Copywriting | `Password123!` | Active |
| Nadia Fox | `nadia.f@marketingportal.com` | `team_member` | `team_member` | Cinematography & Shoots | `Password123!` | Active |
| Noah Miller | `noah.m@marketingportal.com` | `team_member` | `team_member` | Graphics & Visual Design | `Password123!` | Active |
| Oliver Unassigned | `oliver.empty@marketingportal.com` | `team_member` | `team_member` | Unassigned Team | `Password123!` | Active |
| Sienna Brooks | `sienna.b@marketingportal.com` | `team_member` | `team_member` | Video Editing & Motion Design | `Password123!` | Active |
| Sophia Chen | `sophia.c@marketingportal.com` | `team_member` | `team_member` | Graphics & Visual Design | `Password123!` | Active |
| Tariq Al-Mansoor | `tariq.a@marketingportal.com` | `team_member` | `team_member` | Video Editing & Motion Design | `Password123!` | Active |
| Zoe Kravitz | `zoe.k@marketingportal.com` | `team_member` | `team_member` | Content & Copywriting | `Password123!` | Active |

---

## 6. Legacy Roles Migration Mapping

Under the Marketing OS canonical RBAC normalization:
- `admin` $\rightarrow$ `admin` (Active, all profiles)
- `head`, `lead` $\rightarrow$ `marketing_head` (Active, all profiles)
- `team_lead` $\rightarrow$ `team_lead` (Active, scoped profiles)
- `worker`, `sm_manager` $\rightarrow$ `team_member` (Active, scoped profiles)
- `management`, `viewer` $\rightarrow$ `executive` (Active, all 7 profiles, empty reportsTo)
- `dept_lead`, `dept_staff` $\rightarrow$ `suspended` (Retained safely in database, cannot log in)

| Name | Email | Legacy Role | Canonical Role | Department | Password | Status |
|---|---|---|---|---|---|---|
| Professor Arthur Pendelton | `arthur.academic@marketingportal.com` | `dept_lead` | `suspended` | Academic Affairs & Research | `Password123!` | Suspended |
| Rachel Adams | `rachel.sm@marketingportal.com` | `dept_staff` | `suspended` | Social Media Marketing | `Password123!` | Suspended |
| Victoria Stone | `victoria.sales@marketingportal.com` | `dept_lead` | `suspended` | Sales & Business Development | `Password123!` | Suspended |
| Vikram Malhotra | `vikram.ads@marketingportal.com` | `dept_staff` | `suspended` | Performance & Paid Media | `Password123!` | Suspended |
| Benjamin Clarke | `benjamin.academic@marketingportal.com` | `dept_staff` | `suspended` | Academic Affairs & Research | `Password123!` | Suspended |
| Carlos Mendez | `carlos.ads@marketingportal.com` | `dept_staff` | `suspended` | Performance & Paid Media | `Password123!` | Suspended |
| Jessica Pearson | `jessica.sales@marketingportal.com` | `dept_lead` | `suspended` | Sales & Business Development | `Password123!` | Suspended |
| Hannah Abbott | `hannah.sm@marketingportal.com` | `dept_staff` | `suspended` | Social Media Marketing | `Password123!` | Suspended |
| Auditor Claire | `claire.viewer@marketingportal.com` | `viewer` | `executive` | Corporate Governance | `Password123!` | Active |

---

## 7. Demo Users Seed Template (`@demo.haca.local`)

When running `node scripts/seed-demo-users.js` with `DEMO_SEED_PASSWORD=<your_password>`, the following 11-user test cohort is provisioned:

| Email | Canonical Role | Job Role | Department | Work Preferences | Assigned Profiles |
|---|---|---|---|---|---|
| `head@demo.haca.local` | `marketing_head` | Marketing Head | Leadership | `Content`, `Script`, `Post` | All 7 Brand Profiles |
| `executive@demo.haca.local` | `executive` | Executive | Executive Management | *None* | All 7 Brand Profiles |
| `lead.design@demo.haca.local` | `team_lead` | Design Lead (TL) | Design | `Design` | `haca_design_school`, `haca_design_school_en` |
| `manager.creative@demo.haca.local` | `team_lead` | Creative Manager (TL) | Video Production | `Script`, `Shoot`, `Edit` | `haca`, `haca_design_school` |
| `sm.manager@demo.haca.local` | `team_lead` | Social Media Manager | Social Media | `Post`, `Content` | All 7 Brand Profiles |
| `ui.designer@demo.haca.local` | `team_member` | UI Designer | Design | `Design` | `haca_design_school`, `haca_design_school_en` |
| `designer@demo.haca.local` | `team_member` | Designer | Design | `Design` | `haca_design_school` |
| `video.editor@demo.haca.local` | `team_member` | Video Editor | Video Production | `Edit`, `Shoot` | `haca`, `haca_design_school` |
| `writer@demo.haca.local` | `team_member` | Writer | SEO & Content | `Content`, `Script` | `haca`, `haca_design_school`, `haca_marketing_school` |
| `whatsapp@demo.haca.local` | `team_member` | WhatsApp Marketer | WhatsApp | `Post`, `Content` | `haca` |
| `performance@demo.haca.local` | `team_member` | Performance Marketer | Performance Marketing | `Post` | `haca`, `haca_mideast` |
