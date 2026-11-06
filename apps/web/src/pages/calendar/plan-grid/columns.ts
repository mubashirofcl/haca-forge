import { PLAN_GRID_COLUMNS, TURNAROUND_HELP, type PlanGridColumnKey, type StageKey } from '@mmp/shared';
import { STATUS_STAGE } from './types';

export type PlanColKey =
  | 'postingDate'
  | 'topic'
  | 'type'
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

export type PlanColGroup = 'Plan' | 'Script' | 'Shoot' | 'Edit' | 'Posting' | 'Details' | 'Progress';

export interface PlanCol {
  key: PlanColKey | PlanGridColumnKey;
  header: string;
  group: PlanColGroup;
  kind: 'date' | 'text' | 'type' | 'owner' | 'deadline' | 'progress';
  /** Step this owner/deadline column belongs to. */
  stage?: StageKey;
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
  { key: 'brief', header: 'Brief', group: 'Plan', kind: 'text', width: 220 },
  { key: 'scriptOwner', header: 'Script Owner', group: 'Script', kind: 'owner', stage: 'Script', excelKey: 'scriptOwner', width: 180 },
  { key: 'scriptDeadline', header: 'Script Deadline', group: 'Script', kind: 'deadline', stage: 'Script', width: 160 },
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
  header: c.header,
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
