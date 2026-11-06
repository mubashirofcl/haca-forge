import type { PlanGridColumn, PlanGridColumnKey, StageKey } from '@mmp/shared';

/** One row as returned by GET /api/calendar-plans/grid (see planGrid.service.js toGridRow). */
export interface GridRow {
  rowId: string;
  rowStatus: 'draft' | 'submitted' | 'changes_requested' | 'approved';
  editable: boolean;
  postingDate: string;
  topic: string;
  type: string;
  scriptStatus: string;
  scriptDoneDate: string;
  scriptOwner: string;
  shootStatus: string;
  shootDoneDate: string;
  shootOwner: string;
  editStatus: string;
  editDoneDate: string;
  editOwner: string;
  approvalStatus: string;
  approvalDate: string;
  publishedDate: string;
  postingOwner: string;
  turnaroundDays: number | null;
  remarks: string;
  brief: string;
  publishTime: string;
  contentLink: string;
  reviewFeedback: string;
  stepDeadlines: Partial<Record<StageKey, string>>;
  ownerSources: Partial<Record<StageKey, { owner: 'manual' | 'suggested'; deadline: 'manual' | 'auto' }>>;
  ownerIds: Partial<Record<StageKey, string | null>>;
  contentOwner: string;
  designOwner: string;
  contentStatus: string;
  designStatus: string;
  needsScript: boolean;
  needsShoot: boolean;
  programOrEvent: string;
  referenceLink: string;
  priority: string;
  sourceVideoLink: string;
  pipeline: string;
  stages: StageKey[];
}

export interface GridPlanSummary {
  _id: string;
  code: string;
  title: string;
  status: string;
  rowCount: number;
  periodStart: string;
  periodEnd: string;
  periodIssue: string | null;
}

export interface GridPerson {
  _id: string;
  name: string;
  role: string;
  workPreferences: string[];
}

export interface GridData {
  calendar: string;
  month: string;
  columns: PlanGridColumn[];
  displayColumns: PlanGridColumn[];
  types: string[];
  plans: GridPlanSummary[];
  selectionRequired: boolean;
  plan: GridPlanSummary | null;
  rows: GridRow[];
  permissions: { canEdit: boolean; canReview: boolean; readOnly: boolean };
  people: GridPerson[];
}

/** Cells sent to POST /grid/rows. Owner columns may be sent as `<field>Id` (picked from a list). */
export type GridCellInput = Partial<Record<PlanGridColumnKey, string>> & {
  typeExact?: boolean;
  deadlines?: Partial<Record<StageKey, string>>;
  [key: string]: unknown;
};

export interface GridRowResult {
  clientKey: string;
  rowId: string | null;
  status: 'saved' | 'valid' | 'invalid' | 'locked';
  cellErrors: Record<string, string[]>;
  warnings: { field: string; code: string; message: string }[];
  ignoredCells: string[];
  resolved?: {
    postingDate?: { input: string; value: string; byMonth: boolean };
    type?: { input: string; value: string };
  };
  row?: GridRow;
  /** The cells that were sent, for rows that were not saved. */
  input?: GridCellInput;
}

export interface GridSaveResponse {
  calendar: string;
  month: string;
  dryRun: boolean;
  planCreated: boolean;
  plan: GridPlanSummary | null;
  paste: { headerDetected: boolean; unknownHeaders: string[]; rowCount: number } | null;
  upload?: { layout: 'grid' | 'legacy'; rowCount: number };
  counts: { total: number; saved: number; valid: number; invalid: number; locked: number };
  results: GridRowResult[];
  warnings: { code: string; message: string }[];
}

/** A row being edited in the grid: saved rows plus unsaved local rows (new or with errors). */
export interface GridLine {
  key: string;
  rowId: string | null;
  saved: GridRow | null;
  /** Unsaved cell text the user typed or pasted, by column. */
  draft: GridCellInput;
  errors: Record<string, string[]>;
  warnings: string[];
}

/** Owner column -> step. */
export const OWNER_STAGE: Partial<Record<PlanGridColumnKey, StageKey>> = {
  scriptOwner: 'Script',
  shootOwner: 'Shoot',
  editOwner: 'Edit',
  postingOwner: 'Post',
  contentOwner: 'Content',
  designOwner: 'Design',
};

/** Status column -> step (Approval/Published/Turnaround are not step columns). */
export const STATUS_STAGE: Partial<Record<PlanGridColumnKey, StageKey>> = {
  scriptStatus: 'Script',
  scriptDoneDate: 'Script',
  shootStatus: 'Shoot',
  shootDoneDate: 'Shoot',
  editStatus: 'Edit',
  editDoneDate: 'Edit',
};
