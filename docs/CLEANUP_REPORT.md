# Repository Cleanup Report: HACA Marketing OS
**Phase:** Stage 2 — Repository Cleanup  
**Date:** 2026-10-24  
**Repository Branch:** `marketing-os`  
**Pre-Cleanup Tag:** `pre-cleanup`  
**Working Tree Status:** Cleaned, Uncommitted (Staged/Unstaged in working tree for user inspection)

---

## 1. Executive Summary

Stage 2 of the repository cleanup has been executed in full accordance with the approved cleanup plan and user directives. The repository has been pruned of legacy code, obsolete migrations, demo fixtures, duplicate documentation, unused web components, and unnecessary npm dependencies while preserving system stability, build integrity, and test suite green status.

- **Total Direct Repo Size Saved:** ~13.5 MB (~11.8 MB git untracking + ~1.7 MB deleted files)
- **Dependencies Removed:** 9 top-level packages (10 npm packages pruned from dependency tree)
- **Test Suite Status:** **290 passing tests** across 15 test suites (279 API, 11 Web). 0 failures.
- **Build & Lint Status:** Lint 0 errors, Typecheck 0 errors, Workspace Build succeeded in 8.56s.

---

## 2. Inventory of Removed & Pruned Files

### A. Large Media & Backed-Up Artifacts
| File Path | Original Size | Action Taken | Destination / Notes |
| :--- | :--- | :--- | :--- |
| `docs/ui/ui-ref.mp4` | 12,359,636 B (11.79 MB) | Backed up & Untracked | Copied to `../haca-backups/ui-ref.mp4`. Untracked via `git rm --cached`. Added `*.mp4` to `.gitignore`. File preserved on local disk. |
| `docs/playbook/MOS_BUILD_PLAYBOOK.md` | 15,221 B (15 KB) | Backed up & Deleted | Copied to `../haca-backups/MOS_BUILD_PLAYBOOK.md`. Deleted from repo. Empty `playbook/` folder removed. |
| `docs/playbook/PROJECT_REPORT.pdf` | 856,817 B (837 KB) | Deleted | Obsolete legacy build report PDF deleted from repo. |

### B. Stale Documentation & Legacy Archives
| File Path | Original Size | Action Taken | Rationale |
| :--- | :--- | :--- | :--- |
| `docs/Role-Based Fix Plan HACA Marketing OS.md` | 20,321 B | Deleted | Exact byte-for-byte duplicate of `docs/ROLE_FIX_PLAN.md`. |
| `docs/CURRENT_ROLES_REFERENCE.md` | 55,932 B | Deleted | Obsolete pre-R2 role model (`marketing_head`, `team_lead`, `worker`). |
| `docs/ROLE_FIX_VERIFICATION.md` | 55,915 B | Deleted | Pre-reset bug audit. Superseded by `docs/PROGRESS.md`. |
| `docs/AUDIT.md` | 24,013 B | Deleted | Pre-reset audit of legacy ticketing platform. |
| `docs/SCOPE_RESET_IMPACT.md` | 20,297 B | Deleted | Completed pre-reset impact analysis. |
| `docs/DB_RESET_PLAN.md` | 6,629 B | Deleted | Obsolete reset plan. |
| `docs/USERS_AND_PASSWORDS.md` | 5,935 B | Deleted | Demo user directory reference file (git-ignored). |
| `docs/archive/` (entire folder, 15 files) | 451,927 B | Deleted | Legacy FORGE documentation archive and duplicates. |

### C. Unused Scripts, Fixtures & Tests
| File Path | Original Size | Action Taken | Rationale |
| :--- | :--- | :--- | :--- |
| `scripts/migration-overrides.json` | 1,420 B | Deleted | Legacy pre-R1 migration overrides fixture. |
| `scripts/scope-reset-r1.js` | 9,842 B | Deleted | Scope Reset R1 one-off field migration script. Migration completed. |
| `scripts/migrate-roles-r2.js` | 5,420 B | Deleted | Scope Reset R2 one-off role migration script. Migration completed. |
| `scripts/migrate-legacy-roles.js` | 4,210 B | Deleted | Pre-reset legacy role migration script. Obsolete. |
| `apps/api/scripts/clean-database.js` | 1,850 B | Deleted | Obsolete raw collection dropper. Superseded by Stage 3 wipe. |
| `apps/api/scripts/seed-demo.js` | 3,120 B | Deleted | Demo environment seeder. Multi-user demo accounts retired. |
| `scripts/reset-data-marketing-os.js` | 14,820 B | Deleted | Intermediate reset script. Superseded by Stage 3 wipe script. |
| `scripts/seed-demo-users.js` | 9,450 B | Deleted | Demo user generator. Superseded by single admin bootstrap. |
| `scripts/demo-users.json` | 3,210 B | Deleted | Fixture containing demo user credentials. |
| `apps/api/test/reset_and_demo_seed.test.js` | 7,670 B | Deleted | Tests targeting `reset-data-marketing-os.js` and `seed-demo-users.js`. |
| `apps/api/test/scope_reset_r1.test.js` | — | Pruned | Removed Block 4 testing `runScopeResetR1`. |
| `apps/api/test/scope_reset_r2.test.js` | — | Pruned | Removed Block 7 testing `runRoleMigrationR2`. |

*Preserved Scripts:* `apps/api/scripts/seed-admin.js` (single admin user bootstrap) and `apps/api/scripts/seed.js` (reference taxonomy seeder).

### D. Unused Frontend Components, Pages, Assets & Modals
| File Path | Original Size | Action Taken | Rationale |
| :--- | :--- | :--- | :--- |
| `apps/web/src/pages/PlaceholderPage.tsx` | 4,543 B | Deleted | 0 references in project. All 14 system pages are now implemented. |
| `apps/web/src/components/EmptyState.tsx` | 1,559 B | Deleted | 0 references in project. All screens use contextual glassmorphic empty states. |
| `apps/web/src/components/MyAccountModal.tsx` | 7,704 B | Deleted | Redundant duplicate of `MyAccountPage.tsx` (`/account`). Avatar click in `Layout.tsx` updated to `navigate('/account')`. |
| `apps/web/src/assets/haca-forge-logo-white.png` | 11,148 B | Deleted | 0 references across code or styles. |
| `apps/web/src/assets/haca-icon-original.png` | 17,700 B | Deleted | 0 references across code or styles. |
| `apps/web/src/assets/haca-icon.png` | 32,265 B | Deleted | 0 references across code or styles. |
| `apps/web/src/assets/haca-logo-original.png` | 14,862 B | Deleted | 0 references across code or styles. |
| `apps/web/src/assets/haca-logo-white.png` | 7,224 B | Deleted | 0 references across code or styles. |
| `apps/web/src/assets/haca-logo.png` | 7,081 B | Deleted | 0 references across code or styles. |

---

## 3. Dependencies Removed

### Backend (`apps/api/package.json`)
- `express-mongo-sanitize`: Removed. 0 references; Express 5 and Mongoose natively protect query structures.
- `pino-http`: Removed. Replaced by native pino logger in `server.js`.
- `@faker-js/faker`: Removed from devDependencies (~15 MB disk size).

### Frontend (`apps/web/package.json`)
- `@tanstack/react-table`: Removed. 0 references; tables use native glassmorphic HTML markup.
- `react-dropzone`: Removed. 0 references; uploads handled via standard input handlers.
- `react-hook-form`: Removed. 0 references; forms and modals use React state.
- `clsx`: Removed. 0 references; class composition uses template literals.
- `tailwind-merge`: Removed. 0 references.
- `zod`: Removed from `apps/web/package.json`. Verified that `@mmp/shared` bundles its Zod schemas and types into `dist/index.js` and does not list `zod` as a peer dependency.

### Engineering Rules Updated
- `.agent/rules/01-engineering-rules.md`: Updated stack descriptions on lines 6-7 and line 34, removing mentions of `TanStack Table`, `React Hook Form`, `FullCalendar`, and `mongo sanitize`.

---

## 4. Configuration Cleanups

- **Root `package.json`**: Removed `seed:demo` script.
- **`apps/api/package.json`**: Removed `seed:demo` and `db:clean` scripts.
- **`apps/api/src/config/env.js`**: Removed `DEMO_SEED_PASSWORD` schema validation.
- **`apps/api/.env.example` & `apps/api/.env`**: Removed `DEMO_SEED_PASSWORD`.

---

## 5. Folder Case Normalization

The tracked documentation folder was renamed from uppercase `Docs/` to lowercase `docs/` in git index via two-step move (`git mv Docs docs_tmp && git mv docs_tmp docs`) to prevent NTFS case collisions. All file references and links updated.

Preserved Design Specifications:
- `docs/ui/ui-details.md`
- `docs/ui/ui_design_specification.md`
- `docs/ui/ui-ref.mp4` (backed up to `../haca-backups/ui-ref.mp4`, git-ignored)

---

## 6. Verification Commands & Results

All verification commands executed cleanly with zero warnings or errors:

1. **Dependency Sync:**
   ```bash
   npm install
   ```
   *Result:* `removed 10 packages, and audited 687 packages in 14s. 0 breaking issues.`

2. **Linting:**
   ```bash
   npm run lint
   ```
   *Result:* `0 errors across all workspaces.`

3. **Type Checking:**
   ```bash
   npm run typecheck
   ```
   *Result:* `0 errors across all workspaces.`

4. **Workspace Production Build:**
   ```bash
   npm run build
   ```
   *Result:*
   - `@mmp/shared`: Built ESM, CJS, and DTS in 5.3s.
   - `@mmp/web`: Built 21 production chunks in 8.56s.

5. **Test Suites:**
   ```bash
   npm test
   ```
   *Result:*
   - **`@mmp/api`**: 12 test files passed, 279 tests passed (0 failures).
   - **`@mmp/web`**: 3 test files passed, 11 tests passed (0 failures).
   - **Total:** 15 test files passed, 290 tests passed.

---

## 7. Stage 3: Database Wipe Execution Results

Following explicit user confirmation, [`scripts/wipe-keep-admin.js`](file:///c:/Users/ADMIN/OneDrive/Desktop/HACA/TECH/haca-forge/scripts/wipe-keep-admin.js) was executed on the live development database `marketing_portal`:

- **Safety mongodump:** Automatically generated pre-wipe snapshot in `../haca-backups/wipe-2026-10-24T12-09-22-431Z`.
- **Users:** 8 non-admin users deleted; single administrator `admin@hacaforge.com` preserved with password hash intact.
- **Departments:** Pruned from 13 legacy records down to the exact 7 canonical departments (`social_media`, `design`, `video_production`, `seo_content`, `whatsapp`, `performance_marketing`, `tech`).
- **Priorities:** Pruned from 4 down to the agreed 3 canonical priorities (`High`, `Medium`, `Low`). `Urgent` removed.
- **Report Definitions:** Standardized to the 4 canonical R4 reports (`weekly_marketing`, `monthly_scorecard`, `creative_production`, `team_performance`).
- **Profiles:** Single-brand rule enforced. `code: 'haca'` active; 6 other brand profiles set to inactive.
- **Transactional & Activity Collections:** 1,308 activity events, 97 content pieces, 90 work items, 42 calendar plans, 24 assignment overrides, and all related records completely emptied (0 documents remaining).
- **Unused Reference Collections:** `holdreasons`, `contentformats`, `platforms`, `requesttypes`, `pipelinetemplates` emptied.
- **Kept Collections:** `teams` (4 documents), `settings` (1 document), and `automationrules` (6 rules, runtime fields reset).

---

## 8. Working Tree Status

Changes are deliberately **not committed**, remaining in the working tree for user review:
- Staged renames: `Docs/` to `docs/`, untracking `ui-ref.mp4`, deletions of `archive/` and `playbook/`.
- Working tree modifications: dependency cleanups in `package.json` files, deleted unused web components, deleted obsolete scripts.
- Untracked scripts & tests: `scripts/wipe-keep-admin.js`, `apps/api/test/wipe_keep_admin.test.js`, and cleanup documentation.

---

## 9. Deliverable Quick-Creation Fix (ZodError Resolution)

During runtime testing of deliverable creation from the Calendar view (`/calendar` quick create modal), an error occurred:
```json
"ZodError": [
  { "code": "invalid_type", "expected": "string", "received": "undefined", "path": ["departmentId"], "message": "Required" },
  { "code": "invalid_type", "expected": "string", "received": "undefined", "path": ["ownerId"], "message": "Required" }
]
```

### Root Cause
1. `packages/shared/src/index.ts` defined `departmentId` and `ownerId` with strict `.min(1)` requirements in `workItemCreateSchema`.
2. In quick-creation interfaces (such as Calendar day cells), `departmentId` is omitted because departments are automatically inferred from the selected `workType` via `WORK_TYPE_DEPARTMENT_MAP`. Similarly, `ownerId` is optional to support unassigned deliverables for auto-assignment or defaulting to the creator.
3. The shared package dist bundle also had an older compiled schema build.

### Remediation Applied
1. **Schema Relaxed & Types Updated:** In `packages/shared/src/index.ts`, `departmentId` and `ownerId` were updated to `z.string().optional().nullable()`.
2. **Shared Package Rebuilt:** Compiled ESM, CJS, and DTS bundles via `npm run build -w packages/shared`.
3. **Backend Service Auto-Resolution:** In `apps/api/src/modules/workItems/service.js`:
   - Auto-resolves `departmentId` by looking up `WORK_TYPE_DEPARTMENT_MAP[normalizedType]` against the canonical active `Department` records if omitted/falsy.
   - Falls back to the default active department if needed.
   - Defaults `ownerId` to acting user if omitted/undefined, or sets to `null` if explicitly provided as unassigned (`ownerId: null`).
4. **Frontend Form Payloads Sanitized:**
   - In `CalendarPage.tsx`, auto-matches and passes `departmentId` from loaded departments using `WORK_TYPE_DEPARTMENT_MAP`, and passes `ownerId: newOwnerId || null`.
   - In `WorkListPage.tsx`, passes `formDepartmentId || undefined` and `formOwnerId || null`.
5. **Automated Test Coverage:** Added 2 integration tests in `apps/api/test/scope_reset_r1.test.js` validating:
   - Deliverable creation with omitted `departmentId` and `ownerId` succeeds (HTTP 201) with auto-resolved department and owner.
   - Deliverable creation with explicit `ownerId: null` creates an unassigned deliverable.


