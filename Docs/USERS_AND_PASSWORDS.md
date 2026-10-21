# HACA Marketing OS: User Accounts, Roles & Credentials

This document provides the complete reference of all user accounts currently provisioned in the system, their assigned roles (in both Marketing OS and legacy mappings), departments, and login passwords.

---

## 🔑 Quick Login Summary

| Role | Representative Email | Password | Landing Page |
|---|---|---|---|
| **Administrator** | `admin@hacaforge.com` | `Admin1212` | `/dashboard` (All Access) |
| **Marketing Head** | `sarah.lead@marketingportal.com` | `Password123!` | `/dashboard` (Executive View) |
| **Team Lead (Content)** | `david.content@marketingportal.com` | `Password123!` | `/dashboard` (Scoped View) |
| **Team Lead (Graphics)** | `elena.graphics@marketingportal.com` | `Password123!` | `/dashboard` (Scoped View) |
| **Team Lead (Cinematography)** | `kai.cinema@marketingportal.com` | `Password123!` | `/dashboard` (Scoped View) |
| **Team Lead (Video Editing)** | `oliver.editor@marketingportal.com` | `Password123!` | `/dashboard` (Scoped View) |
| **Team Member (Creative Worker)** | `chloe.b@marketingportal.com` | `Password123!` | `/my-work` (Personal Queue) |

> **Default Password Policy:**
> - The **System Administrator** (`admin@hacaforge.com`) uses `Admin1212` (configured in `apps/api/.env`).
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
| Sarah Mitchell | `sarah.lead@marketingportal.com` | `marketing_head` | `head` | Marketing Leadership | `Password123!` | Active |
| Marcus Vance | `marcus.lead@marketingportal.com` | `marketing_head` | `head` | Marketing Leadership | `Password123!` | Active |

---

## 3. Team Leads (`team_lead`)

Manages campaigns, work distribution, quality reviews, and approvals for their designated teams and brand profiles.

| Name | Email | Marketing OS Role | Database Role | Department | Password | Status |
|---|---|---|---|---|---|---|
| David Reynolds | `david.content@marketingportal.com` | `team_lead` | `team_lead` | Content & Copywriting | `Password123!` | Active |
| Elena Rostova | `elena.graphics@marketingportal.com` | `team_lead` | `team_lead` | Graphics & Visual Design | `Password123!` | Active |
| Kai Takahashi | `kai.cinema@marketingportal.com` | `team_lead` | `team_lead` | Cinematography & Shoots | `Password123!` | Active |
| Oliver Thorne | `oliver.editor@marketingportal.com` | `team_lead` | `team_lead` | Video Editing & Motion Design | `Password123!` | Active |

---

## 4. Creative Team Members (`team_member`)

Executes assigned deliverables, requests assets, logs progress, and submits deliverables for review. Lands on `/my-work`.

| Name | Email | Marketing OS Role | Database Role | Department | Password | Status |
|---|---|---|---|---|---|---|
| Aria Montgomery | `aria.m@marketingportal.com` | `team_member` | `worker` | Graphics & Visual Design | `Password123!` | Active |
| Chloe Bennett | `chloe.b@marketingportal.com` | `team_member` | `worker` | Content & Copywriting | `Password123!` | Active |
| Dante King | `dante.k@marketingportal.com` | `team_member` | `worker` | Cinematography & Shoots | `Password123!` | Active |
| Emma Watson | `emma.w@marketingportal.com` | `team_member` | `worker` | Video Editing & Motion Design | `Password123!` | Active |
| Ethan Hunt | `ethan.h@marketingportal.com` | `team_member` | `worker` | Cinematography & Shoots | `Password123!` | Active |
| Felix Baum | `felix.b@marketingportal.com` | `team_member` | `worker` | Video Editing & Motion Design | `Password123!` | Active |
| Gemma Ward | `gemma.w@marketingportal.com` | `team_member` | `worker` | Cinematography & Shoots | `Password123!` | Active |
| Julian Hayes | `julian.h@marketingportal.com` | `team_member` | `worker` | Content & Copywriting | `Password123!` | Active |
| Leo Sterling | `leo.s@marketingportal.com` | `team_member` | `worker` | Graphics & Visual Design | `Password123!` | Active |
| Liam O'Connor | `liam.o@marketingportal.com` | `team_member` | `worker` | Content & Copywriting | `Password123!` | Active |
| Lucas Rivera | `lucas.r@marketingportal.com` | `team_member` | `worker` | Video Editing & Motion Design | `Password123!` | Active |
| Mateo Rossi | `mateo.r@marketingportal.com` | `team_member` | `worker` | Graphics & Visual Design | `Password123!` | Active |
| Maya Patel | `maya.p@marketingportal.com` | `team_member` | `worker` | Content & Copywriting | `Password123!` | Active |
| Nadia Fox | `nadia.f@marketingportal.com` | `team_member` | `worker` | Cinematography & Shoots | `Password123!` | Active |
| Noah Miller | `noah.m@marketingportal.com` | `team_member` | `worker` | Graphics & Visual Design | `Password123!` | Active |
| Oliver Unassigned | `oliver.empty@marketingportal.com` | `team_member` | `worker` | Unassigned Team | `Password123!` | Active |
| Sienna Brooks | `sienna.b@marketingportal.com` | `team_member` | `worker` | Video Editing & Motion Design | `Password123!` | Active |
| Sophia Chen | `sophia.c@marketingportal.com` | `team_member` | `worker` | Graphics & Visual Design | `Password123!` | Active |
| Tariq Al-Mansoor | `tariq.a@marketingportal.com` | `team_member` | `worker` | Video Editing & Motion Design | `Password123!` | Active |
| Zoe Kravitz | `zoe.k@marketingportal.com` | `team_member` | `worker` | Content & Copywriting | `Password123!` | Active |

---

## 5. Other Department Staff & Management (Normalized to `team_member`)

Staff in ancillary departments whose legacy roles map to `team_member` under Marketing OS canonical RBAC normalization.

| Name | Email | Normalized Role | Database Role | Department | Password | Status |
|---|---|---|---|---|---|---|
| Professor Arthur Pendelton | `arthur.academic@marketingportal.com` | `team_member` | `dept_lead` | Academic Affairs & Research | `Password123!` | Active |
| Rachel Adams | `rachel.sm@marketingportal.com` | `team_member` | `dept_lead` | Social Media Marketing | `Password123!` | Active |
| Victoria Stone | `victoria.sales@marketingportal.com` | `team_member` | `dept_lead` | Sales & Business Development | `Password123!` | Active |
| Vikram Malhotra | `vikram.ads@marketingportal.com` | `team_member` | `dept_lead` | Performance & Paid Media | `Password123!` | Active |
| Benjamin Clarke | `benjamin.academic@marketingportal.com` | `team_member` | `dept_staff` | Academic Affairs & Research | `Password123!` | Active |
| Carlos Mendez | `carlos.ads@marketingportal.com` | `team_member` | `dept_staff` | Performance & Paid Media | `Password123!` | Active |
| Jessica Pearson | `jessica.sales@marketingportal.com` | `team_member` | `dept_staff` | Sales & Business Development | `Password123!` | Active |
| Hannah Abbott | `hannah.sm@marketingportal.com` | `team_member` | `sm_manager` | Social Media Marketing | `Password123!` | Active |
| Auditor Claire | `claire.viewer@marketingportal.com` | `team_member` | `management` | Corporate Governance | `Password123!` | Active |

---

## 6. Demo Users Seed Template (`@demo.haca.local`)

When running `node scripts/seed-demo-users.js` with `DEMO_SEED_PASSWORD=<your_password>`, the following structured test cohort is provisioned:

| Email | Canonical Role | Job Role | Department | Assigned Profiles |
|---|---|---|---|---|
| `head@demo.haca.local` | `marketing_head` | Marketing Head | Leadership | All 7 Brand Profiles |
| `lead.design@demo.haca.local` | `team_lead` | Design Lead (TL) | Design | `haca_design_school`, `haca_design_school_en` |
| `manager.creative@demo.haca.local` | `team_lead` | Creative Manager (TL) | Video Production | `haca`, `haca_design_school` |
| `ui.designer@demo.haca.local` | `team_member` | UI Designer | Design | `haca_design_school`, `haca_design_school_en` |
| `designer@demo.haca.local` | `team_member` | Designer | Design | `haca_design_school` |
| `video.editor@demo.haca.local` | `team_member` | Video Editor | Video Production | `haca`, `haca_design_school` |
| `writer@demo.haca.local` | `team_member` | Writer | SEO & Content | `haca`, `haca_design_school`, `haca_marketing_school` |
| `whatsapp@demo.haca.local` | `team_member` | WhatsApp Marketer | WhatsApp | `haca` |
| `performance@demo.haca.local` | `team_member` | Performance Marketer | Performance Marketing | `haca`, `haca_mideast` |
