import { PLAN_GRID_COLUMNS, TURNAROUND_HELP, type PlanGridColumnKey, type StageKey } from '@mmp/shared';
import { STATUS_STAGE } from './types';

export type PlanColKey =
  | 'postingDate'
  | 'topic'
  | 'type'
  | 'workflow'
  | 'brief'
  | 'scriptOwner'
  | 'scriptDeadline'
  | 'shootOwner'
  | 'shootDeadline'
  | 'editOwner'
  | 'editDeadline'
  | 'postingOwner'
  | 'postingDeadline'
  | 'contentLink'
  | 'remarks';

export type PlanColGroup = 'Plan' | 'Script / Content' | 'Shoot' | 'Edit' | 'Posting' | 'Details' | 'Progress';

export interface PlanCol {
  key: PlanColKey | PlanGridColumnKey;
  header: string;
  group: PlanColGroup;
  kind: 'date' | 'text' | 'type' | 'workflow' | 'owner' | 'deadline' | 'progress';
  /** Step this owner/deadline column belongs to. */
  stage?: StageKey;
  /** Step shown instead on rows without `stage` (Script / Content: design rows show Content). */
  altStage?: StageKey;
  /** The Excel column this lines up with, for pasting several Excel rows into the grid. */
  excelKey?: PlanGridColumnKey;
  width: number;
  help?: string;
}

/** Default planning view (PG-4). Content/Design owners and deadlines are in the row panel. */
export const PLANNING_COLUMNS: PlanCol[] = [
  { key: 'postingDate', header: 'Posting Date', group: 'Plan', kind: 'date', excelKey: 'postingDate', width: 150 },
  { key: 'topic', header: 'Topic', group: 'Plan', kind: 'text', excelKey: 'topic', width: 240 },
  { key: 'type', header: 'Type', group: 'Plan', kind: 'type', excelKey: 'type', width: 160 },
  { key: 'workflow', header: 'Workflow', group: 'Plan', kind: 'workflow', width: 150, help: 'Which steps the row has. Changing Type resets it to the default for that type.' },
  { key: 'brief', header: 'Brief', group: 'Plan', kind: 'text', width: 220 },
  { key: 'scriptOwner', header: 'Script / Content Owner', group: 'Script / Content', kind: 'owner', stage: 'Script', altStage: 'Content', excelKey: 'scriptOwner', width: 190 },
  { key: 'scriptDeadline', header: 'Script / Content Deadline', group: 'Script / Content', kind: 'deadline', stage: 'Script', altStage: 'Content', width: 170 },
  { key: 'shootOwner', header: 'Shoot Owner', group: 'Shoot', kind: 'owner', stage: 'Shoot', excelKey: 'shootOwner', width: 180 },
  { key: 'shootDeadline', header: 'Shoot Deadline', group: 'Shoot', kind: 'deadline', stage: 'Shoot', width: 160 },
  { key: 'editOwner', header: 'Edit Owner', group: 'Edit', kind: 'owner', stage: 'Edit', excelKey: 'editOwner', width: 180 },
  { key: 'editDeadline', header: 'Edit Deadline', group: 'Edit', kind: 'deadline', stage: 'Edit', width: 160 },
  { key: 'postingOwner', header: 'Posting Owner', group: 'Posting', kind: 'owner', stage: 'Post', excelKey: 'postingOwner', width: 180 },
  { key: 'postingDeadline', header: 'Posting Deadline', group: 'Posting', kind: 'deadline', stage: 'Post', width: 160 },
  { key: 'contentLink', header: 'Content Link', group: 'Details', kind: 'text', width: 200 },
  { key: 'remarks', header: 'Remarks', group: 'Details', kind: 'text', excelKey: 'remarks', width: 220 },
];

/** The Excel workflow columns (status, done date, approval, published, turnaround), shown with "Show progress". */
export const PROGRESS_COLUMNS: PlanCol[] = PLAN_GRID_COLUMNS.filter((c) => !c.editable).map((c) => ({
  key: c.key,
  header: c.key === 'scriptStatus' ? 'Script / Content Status' : c.key === 'scriptDoneDate' ? 'Script / Content Done Date' : c.header,
  altStage: c.key === 'scriptStatus' || c.key === 'scriptDoneDate' ? ('Content' as StageKey) : undefined,
  group: 'Progress' as const,
  kind: 'progress' as const,
  stage: STATUS_STAGE[c.key],
  width: c.key === 'turnaroundDays' ? 130 : 140,
  help: c.key === 'turnaroundDays' ? TURNAROUND_HELP : undefined,
}));

/** Owner field the API takes for each step (Content/Design included; they are edited in the row panel). */
export const OWNER_FIELD_BY_STAGE: Record<StageKey, string> = {
  Script: 'scriptOwner',
  Shoot: 'shootOwner',
  Edit: 'editOwner',
  Post: 'postingOwner',
  Content: 'contentOwner',
  Design: 'designOwner',
};
export const STAGE_LABEL: Record<StageKey, string> = { Content: 'Content', Script: 'Script', Design: 'Design', Shoot: 'Shoot', Edit: 'Edit', Post: 'Posting' };

/** The step a column shows for a row: its own step, or the alternate one (Content on design rows). */
export function stageForColumn(col: Pick<PlanCol, 'stage' | 'altStage'>, stages: readonly StageKey[] | null): StageKey | undefined {
  if (!col.stage) return undefined;
  if (stages && !stages.includes(col.stage) && col.altStage) {
    // Design rows (they have a Design step) use the alternate step, even when their workflow skips it.
    if (stages.includes(col.altStage) || stages.includes('Design')) return col.altStage;
  }
  return col.stage;
}
