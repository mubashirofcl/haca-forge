# Database Reset Plan: Transition to HACA Marketing OS

## 1. Overview & Context

During the transition from legacy HACA FORGE to **HACA Marketing OS**, legacy workflows, models, and mock transactional records must be retired cleanly while preserving operational integrity, core reference taxonomies, and critical administrator identities.

This document details the complete collection inventory discovered directly via MongoDB `listCollections()` on the connected database (`marketing_portal`), current document counts, and designated lifecycle actions.

> [!CAUTION]
> The automated agent will **NEVER** run the destructive reset with `--confirm`. The reset script (`scripts/reset-data-marketing-os.js`) executes in **dry-run** mode by default. The destructive execution must be triggered manually by the system administrator following verified database backup.

---

## 2. Collection Inventory & Action Matrix

Below is the verified inventory of all 28 collections in the connected database:

| # | Collection Name | Doc Count | Target Action | Category / Rationale |
|---|-----------------|-----------|---------------|----------------------|
| 1 | `profiles` | 0 (7 seeded) | **KEEP** | Core Marketing OS brand profile taxonomy (7 brands). |
| 2 | `departments` | 7 | **KEEP** | Core Marketing OS department taxonomy (7 departments). |
| 3 | `activityevents` | 12 | **KEEP** | Marketing OS domain activity logging and audit trail. |
| 4 | `users` | 36 | **RESET-USERS** | Target model for `Person`. Retain only emails explicitly listed in `--keep-emails`; migrate retained users to 4-role model; export & purge legacy users and refresh tokens. |
| 5 | `accessrequests` | 17 | **EMPTY** | Retired legacy FORGE access requests. Replaced by clean Marketing OS access requests seeded in Part C. |
| 6 | `auditlogs` | 37 | **EMPTY** | Retired legacy FORGE audit logs. Superseded by `activityevents`. |
| 7 | `calendarentries` | 31 | **EMPTY** | Retired legacy FORGE calendar entries. |
| 8 | `comments` | 86 | **EMPTY** | Retired legacy FORGE comments and conversations. |
| 9 | `contentformats` | 7 | **EMPTY** | Retired legacy FORGE master data format list. |
| 10 | `contentitems` | 6 | **EMPTY** | Retired legacy FORGE content items. Superseded by Marketing OS work items. |
| 11 | `counters` | 4 | **EMPTY** | Counters used exclusively by retired FORGE sequence generators. Reset to 0. |
| 12 | `deliverables` | 4 | **EMPTY** | Retired legacy FORGE deliverables. Superseded by Marketing OS deliverables. |
| 13 | `holdreasons` | 7 | **EMPTY** | Retired legacy FORGE master data hold reasons. |
| 14 | `leaverequests` | 6 | **EMPTY** | Retired legacy FORGE staff leave management. |
| 15 | `notifications` | 686 | **EMPTY** | Retired legacy FORGE notifications. |
| 16 | `pipelinetemplates` | 7 | **EMPTY** | Retired legacy FORGE multi-stage pipeline templates. |
| 17 | `platforms` | 6 | **EMPTY** | Retired legacy FORGE master data platforms list. |
| 18 | `priorities` | 4 | **EMPTY** | Retired legacy FORGE master data priorities. |
| 19 | `requests` | 5 | **EMPTY** | Retired legacy FORGE requester workflow. |
| 20 | `requesttypes` | 5 | **EMPTY** | Retired legacy FORGE request types master data. |
| 21 | `scheduledreports` | 0 | **EMPTY** | Retired legacy FORGE automated reporting schedules. |
| 22 | `settings` | 1 | **EMPTY** | Retired legacy FORGE configuration document. |
| 23 | `shoots` | 1 | **EMPTY** | Retired legacy FORGE production shoots. |
| 24 | `statushistories` | 781 | **EMPTY** | Retired legacy FORGE state change logs. |
| 25 | `tasks` | 9 | **EMPTY** | Retired legacy FORGE task board items. |
| 26 | `teamassignments` | 0 | **EMPTY** | Retired legacy FORGE department staff assignment links. |
| 27 | `teams` | 4 | **EMPTY** | Retired legacy FORGE team definitions. |
| 28 | `timeentries` | 9 | **EMPTY** | Retired legacy FORGE time logs. |

---

## 3. Action Definitions

- **KEEP**: Documents and collection structure are fully preserved. Indexes remain intact.
- **EMPTY**: All documents within the collection are deleted (`deleteMany({})`). Collection and all defined indexes are preserved so active schemas never encounter missing index errors.
- **RESET-USERS**: Evaluates all records in the `users` collection. Any user whose email is in `--keep-emails` is preserved and mapped to valid Marketing OS role and scope. All other accounts are exported to JSON and removed from the active database. All refresh tokens and active sessions for purged accounts are invalidated.
- **DROP-LATER** (Optional flag `--drop-retired`): Explicit opt-in flag to drop empty collections belonging strictly to retired legacy models after successful migration and export verification.

---

## 4. Safety Guards & Execution Prerequisites

The reset script enforces the following mandatory safeguards:
1. **Production Guard**: Aborts immediately if `NODE_ENV === 'production'`.
2. **Dry Run Default**: Runs in dry-run mode unless `--confirm` is explicitly passed.
3. **Database Match Guard**: Requires `--db-name=<connected_db_name>` exactly matching `mongoose.connection.name`.
4. **Kept Accounts Guard**: Requires `--keep-emails=<email1,email2>` with at least one email. Aborts if no kept emails are specified.
5. **Demo Password Guard**: Refuses execution if `DEMO_SEED_PASSWORD` is not set in `.env` or process environment.
6. **Pre-Deletion Backup Verification**: Exports all documents from every collection scheduled for EMPTY or RESET-USERS to `./backup-db-reset-<timestamp>/<collection>.json`. Verifies that each file is non-empty before any delete operation begins. If any export fails, the entire process aborts with zero changes.

---

## 5. Rollback & Recovery Instructions

If you ever need to restore any purged data:
```bash
# Example restoration from generated JSON backup
mongoimport --uri "mongodb://127.0.0.1:27017/marketing_portal" --collection <collection_name> --file ./backup-db-reset-<timestamp>/<collection_name>.json --mode=upsert
```
Or to restore the full pre-reset database dump:
```bash
mongorestore --uri "mongodb://127.0.0.1:27017/marketing_portal" --drop ./backup-before-db-reset/marketing_portal
```

---

## 6. Execution Command Reference

### Step 1: Dry Run (Safe, Zero Changes)
```bash
node scripts/reset-data-marketing-os.js --db-name=marketing_portal --keep-emails=admin@marketingportal.com
```

### Step 2: Live Reset (Manual Administrator Execution Only)
```bash
node scripts/reset-data-marketing-os.js --confirm --db-name=marketing_portal --keep-emails=<your_admin_email>,<your_head_email>
```

### Step 3: Seed Demo Users
```bash
node scripts/seed-demo-users.js
```
