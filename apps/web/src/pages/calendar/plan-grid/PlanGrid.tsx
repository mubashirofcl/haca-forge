import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardPaste, Download, HelpCircle, ListChecks, PanelRightOpen, Plus, Send, Upload } from 'lucide-react';
import {
  CALENDAR_LIST,
  formatGridDate,
  getPipelineForContent,
  getStepStatusLabel,
  monthKeyInAppTz,
  nextMonthKey,
  parseClipboardTsv,
  parseGridDate,
  pastedRowsToCells,
  type PlanGridColumnKey,
  type StageKey,
} from '@mmp/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { statusClass, statusTone } from '../../../lib/statusTone';
import { PlanGridPreviewDialog } from './PlanGridPreviewDialog';
import { PlanGridRowPanel } from './PlanGridRowPanel';
import { PlanGridConfirmDialog } from './PlanGridConfirmDialog';
import { PlanGridPasteDialog } from './PlanGridPasteDialog';
import { useMediaQuery } from './useMediaQuery';
import { OWNER_FIELD_BY_STAGE, PLANNING_COLUMNS, PROGRESS_COLUMNS, STAGE_LABEL, type PlanCol, type PlanColGroup } from './columns';
import { STATUS_STAGE, type GridCellInput, type GridData, type GridLine, type GridRow, type GridRowResult, type GridSaveResponse } from './types';

const ROW_STATUS: Record<string, { tone: string; label: string }> = {
  draft: { tone: 'status-not-started', label: 'Draft' },
  submitted: { tone: 'status-waiting', label: 'Submitted' },
  changes_requested: { tone: 'status-changes', label: 'Changes' },
  approved: { tone: 'status-approved', label: 'Approved' },
};

let lineSeq = 0;
const newLine = (draft: GridCellInput = {}, errors: Record<string, string[]> = {}): GridLine => ({ key: `new-${++lineSeq}`, rowId: null, saved: null, draft, errors, warnings: [] });
const savedLine = (row: GridRow): GridLine => ({ key: row.rowId, rowId: row.rowId, saved: row, draft: {}, errors: {}, warnings: [] });
const isBlank = (l: GridLine) =>
  !l.saved && Object.values(l.draft).every((v) => v === undefined || (typeof v === 'object' && v !== null ? !Object.keys(v as object).length : String(v).trim() === ''));
const withTrailingBlank = (lines: GridLine[]) => (lines.length && isBlank(lines[lines.length - 1]) ? lines : [...lines, newLine()]);

/** Steps a line has: from the saved row, or worked out from the typed type (new reels default to Script + Shoot). */
function stagesOf(line: GridLine): StageKey[] | null {
  if (line.saved) return line.saved.stages;
  const type = String(line.draft.type || '').trim();
  if (!type) return null;
  return getPipelineForContent({ contentType: type === 'Poster' && !line.draft.typeExact ? 'Static Post' : type, needsScript: true, needsShoot: true }).stages as StageKey[];
}

/** What is missing for a saved row's steps (Content/Design included): owner or deadline. */
function attentionOf(row: GridRow | null): string[] {
  if (!row) return [];
  return row.stages.flatMap((s) => [
    ...(!row.ownerIds[s] ? [`${STAGE_LABEL[s]} owner`] : []),
    ...(!row.stepDeadlines[s] ? [`${STAGE_LABEL[s]} deadline`] : []),
  ]);
}

/** Text value of a planning cell (draft wins over saved). */
function textOf(line: GridLine, key: string): string {
  if (line.draft[key] !== undefined) return String(line.draft[key] ?? '');
  const row = line.saved as unknown as Record<string, unknown> | null;
  if (!row) return '';
  const v = row[key];
  return v === null || v === undefined ? '' : String(v);
}

/** Frozen-column widths; narrower below 1024px so other columns can scroll into view on tablets. */
function gridLayout(compact: boolean, withSelect: boolean) {
  const lead = (compact ? 136 : 190) + (withSelect ? 44 : 0);
  const frozen = compact ? { postingDate: 146, topic: 170, type: 140 } : { postingDate: 150, topic: 240, type: 160 };
  const widthOf = (c: PlanCol) => (frozen as Record<string, number>)[c.key] ?? c.width;
  const left: Record<string, number> = { postingDate: lead, topic: lead + frozen.postingDate, type: lead + frozen.postingDate + frozen.topic };
  return { lead, widthOf, left };
}

/** Native date picker cell. Saves on blur, or shortly after a complete date is picked or typed. */
const DateCell: React.FC<{
  id: string;
  value: string;
  label: string;
  line: number;
  col: string;
  excelCol?: string;
  invalid?: string;
  describedBy?: string;
  onCommit: (iso: string) => void;
  onEnter: () => void;
}> = ({ id, value, label, line, col, excelCol, invalid, describedBy, onCommit, onEnter }) => {
  const [v, setV] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef(value);
  useEffect(() => {
    setV(value);
    committed.current = value;
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const flush = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next !== committed.current) {
      committed.current = next;
      onCommit(next);
    }
  };
  return (
    <input
      id={id}
      type="date"
      data-cell
      data-line={line}
      data-col={col}
      data-excel-col={excelCol}
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      title={invalid || undefined}
      className={`ui-input h-11 w-full${invalid ? ' ring-2 ring-inset ring-ui-coral' : ''}`}
      value={v}
      onChange={(e) => {
        const next = e.target.value;
        setV(next);
        if (timer.current) clearTimeout(timer.current);
        // A picked date (or a typed one with a full year) saves after a short pause.
        if (!next || Number(next.slice(0, 4)) >= 2000) timer.current = setTimeout(() => flush(next), 700);
      }}
      onBlur={(e) => flush(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          flush((e.target as HTMLInputElement).value);
          onEnter();
        }
      }}
    />
  );
};

interface Props {
  initialCalendar: string;
  initialMonth?: string;
  initialPlanId?: string;
  onClose: () => void;
  onChanged?: () => void;
  /** Called when calendar, month or plan change, so the page URL can follow (reload keeps the place). */
  onLocationChange?: (loc: { calendar: string; month: string; planId?: string }) => void;
}

export const PlanGrid: React.FC<Props> = ({ initialCalendar, initialMonth, initialPlanId, onClose, onChanged, onLocationChange }) => {
  const [calendar, setCalendar] = useState(initialCalendar && initialCalendar !== 'all' ? initialCalendar : 'sm');
  const [month, setMonth] = useState(initialMonth || nextMonthKey(monthKeyInAppTz(new Date())));
  const [planId, setPlanId] = useState<string | undefined>(initialPlanId);
  const [data, setData] = useState<GridData | null>(null);
  const [lines, setLines] = useState<GridLine[]>([newLine()]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [showProgress, setShowProgress] = useState(false);
  const [panelKey, setPanelKeyRaw] = useState<string | null>(null);
  const setPanelKey = (key: string | null) => {
    if (key) setNotice((n) => (n?.tone === 'error' ? null : n));
    setPanelKeyRaw(key);
  };
  const [panelSaving, setPanelSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteChecking, setPasteChecking] = useState(false);
  const [preview, setPreview] = useState<{
    source: 'paste' | 'upload';
    response: GridSaveResponse;
    rows: { clientKey: string; rowId: string | null; cells: GridCellInput }[];
    file?: File;
  } | null>(null);
  const [previewSaving, setPreviewSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const linesRef = useRef<GridLine[]>(lines);
  linesRef.current = lines;
  /** Plan id learned from the server (load or first save). Adopting it must not reload and wipe local edits. */
  const adoptedPlanRef = useRef<string | undefined>(undefined);
  const adoptPlan = (id: string) => {
    adoptedPlanRef.current = id;
    setPlanId(id);
  };

  const canEdit = Boolean(data?.permissions.canEdit) && !data?.selectionRequired;
  // Creative Head reviews rows; never edits planning fields (the API refuses those writes too).
  const canReview = Boolean(data?.permissions.canReview) && !data?.selectionRequired;
  const readOnly = Boolean(data?.permissions.readOnly); // executive
  const people = data?.people || [];
  const isPhone = useMediaQuery('(max-width: 639px)');
  const isCompact = useMediaQuery('(max-width: 1023px)');
  const layout = useMemo(() => gridLayout(isCompact, canReview), [isCompact, canReview]);
  const [onlyWaiting, setOnlyWaiting] = useState<boolean | null>(null);
  const showOnlyWaiting = onlyWaiting ?? canReview;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { kind: 'approveAll' } | { kind: 'deleteRow' }>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  // Progress columns are only useful once rows are approved (their steps exist).
  const hasProgress = lines.some((l) => l.saved?.rowStatus === 'approved');
  const columns: PlanCol[] = useMemo(() => [...PLANNING_COLUMNS, ...(showProgress && hasProgress ? PROGRESS_COLUMNS : [])], [showProgress, hasProgress]);
  const groups = useMemo(() => {
    const out: { group: PlanColGroup; span: number }[] = [];
    for (const c of columns) {
      const last = out[out.length - 1];
      if (last && last.group === c.group) last.span++;
      else out.push({ group: c.group, span: 1 });
    }
    return out;
  }, [columns]);

  useEffect(() => {
    onLocationChange?.({ calendar, month, planId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar, month, planId]);

  const load = useCallback(
    async (keepLocal: GridLine[] = []) => {
      setLoading(true);
      setLoadError(null);
      try {
        const q = new URLSearchParams({ calendar, month });
        if (planId) q.set('planId', planId);
        const res = await apiFetch<{ data: GridData }>(`/api/calendar-plans/grid?${q.toString()}`);
        setData(res.data);
        if (res.data.plan && res.data.plan._id !== planId) adoptPlan(res.data.plan._id);
        setLines(withTrailingBlank([...res.data.rows.map(savedLine), ...keepLocal]));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not load the plan grid.');
        setData(null);
        setLines([newLine()]);
      } finally {
        setLoading(false);
      }
    },
    [calendar, month, planId]
  );

  useEffect(() => {
    if (planId && planId === adoptedPlanRef.current) {
      adoptedPlanRef.current = undefined;
      return;
    }
    load();
    // Reload only when the grid identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar, month, planId]);

  const send = async (body: Record<string, unknown>) =>
    (
      await apiFetch<{ data: GridSaveResponse }>('/api/calendar-plans/grid/rows', {
        method: 'POST',
        body: JSON.stringify({ calendar, month, planId, ...body }),
      })
    ).data;

  const reportError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'PLAN_SELECTION_REQUIRED') {
      setNotice({ tone: 'error', text: 'This month has more than one plan. Choose one above before editing.' });
    } else {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    }
  };

  /** Apply a save response to the lines it was sent for. */
  const applyResults = (results: GridRowResult[], sentCells: Record<string, GridCellInput>) => {
    setLines((prev) =>
      withTrailingBlank(
        prev.map((l) => {
          const r = results.find((x) => x.clientKey === l.key);
          if (!r) return l;
          if (r.status === 'saved' && r.row) return savedLine(r.row);
          return { ...l, draft: { ...l.draft, ...sentCells[l.key] }, errors: r.cellErrors, warnings: r.warnings.map((w) => w.message) };
        })
      )
    );
  };

  const afterSave = (res: GridSaveResponse) => {
    if (res.plan && res.plan._id !== planId) adoptPlan(res.plan._id);
    if (res.planCreated) {
      setNotice({ tone: 'ok', text: `Draft plan ${res.plan?.code} created for this month.` });
      onChanged?.();
    }
    if (res.plan) setData((d) => (d ? { ...d, plan: res.plan, plans: d.plans.some((p) => p._id === res.plan!._id) ? d.plans : [...d.plans, res.plan!] } : d));
  };

  /** Save one or more cells of a line. New lines save once date, topic and type are there. */
  const commit = async (staleLine: GridLine, cells: GridCellInput) => {
    if (!canEdit) return false;
    // Read the latest version of the line: quick edits can arrive before a re-render.
    const line = linesRef.current.find((l) => l.key === staleLine.key) || staleLine;
    let toSend: GridCellInput = cells;
    if (!line.saved) {
      const merged: GridCellInput = { ...line.draft, ...cells };
      if (cells.deadlines || line.draft.deadlines) merged.deadlines = { ...(line.draft.deadlines || {}), ...(cells.deadlines || {}) };
      linesRef.current = linesRef.current.map((l) => (l.key === line.key ? { ...l, draft: merged } : l));
      setLines((prev) => withTrailingBlank(prev.map((l) => (l.key === line.key ? { ...l, draft: merged } : l))));
      const ready = ['postingDate', 'topic', 'type'].every((k) => String(merged[k] ?? '').trim() !== '');
      if (!ready) return false;
      toSend = merged;
    }
    setSavingKeys((s) => new Set(s).add(line.key));
    try {
      const res = await send({ rows: [{ clientKey: line.key, rowId: line.rowId, cells: toSend }] });
      applyResults(res.results, { [line.key]: toSend });
      afterSave(res);
      const ok = res.results[0]?.status === 'saved';
      if (ok) setNotice(null);
      return ok;
    } catch (err) {
      reportError(err);
      return false;
    } finally {
      setSavingKeys((s) => {
        const n = new Set(s);
        n.delete(line.key);
        return n;
      });
    }
  };

  // ── Paste (separate action, plus multi-row paste on Excel-aligned cells) ──
  const checkRows = async (rows: { clientKey: string; rowId: string | null; cells: GridCellInput }[]) => {
    const response = await send({ rows, dryRun: true });
    setPreview({ source: 'paste', response, rows });
  };
  const checkPastedText = async (text: string) => {
    const { cells } = pastedRowsToCells(parseClipboardTsv(text), 'postingDate');
    if (!cells.length) {
      setNotice({ tone: 'error', text: 'Nothing to paste: no rows were found.' });
      return;
    }
    setPasteChecking(true);
    try {
      await checkRows(cells.map((c) => ({ clientKey: `paste-${++lineSeq}`, rowId: null, cells: c as GridCellInput })));
      setPasteOpen(false);
    } catch (err) {
      reportError(err);
    } finally {
      setPasteChecking(false);
    }
  };
  const onPaste = async (e: React.ClipboardEvent<HTMLTableElement>) => {
    if (!canEdit) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-col]');
    const multi = text.includes('\t') || /\r?\n./.test(text);
    // One value pasted into a date picker: read it like Excel does (2 Nov, 2026 / 16/11/2026).
    if (!multi && target instanceof HTMLInputElement && target.type === 'date') {
      e.preventDefault();
      const r = parseGridDate(text, { month });
      const line = lines[Number(target.dataset.line)];
      const col = target.dataset.col || '';
      if (!line) return;
      const stage = PLANNING_COLUMNS.find((c) => c.key === col)?.stage;
      if (!r.ok) {
        const errKey = col === 'postingDate' ? 'postingDate' : `deadline.${stage}`;
        setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, errors: { ...l.errors, [errKey]: [r.error] } } : l)));
        return;
      }
      if (col === 'postingDate') commit(line, { postingDate: r.value });
      else if (stage) commit(line, { deadlines: { [stage]: r.value } });
      return;
    }
    if (!multi) return; // single value into a text cell: normal paste
    e.preventDefault();
    const excelCol = target?.dataset.excelCol as PlanGridColumnKey | undefined;
    if (!excelCol) {
      setNotice({ tone: 'error', text: 'To paste several Excel rows, use “Paste from Excel”, or paste into Posting Date, Topic or Type.' });
      return;
    }
    const startLine = Number(target?.dataset.line ?? lines.length - 1);
    const { cells, headerDetected } = pastedRowsToCells(parseClipboardTsv(text), excelCol);
    if (!cells.length) return;
    const rows = cells.map((c, i) => {
      const at = headerDetected ? undefined : lines[startLine + i];
      if (at?.saved) return { clientKey: at.key, rowId: at.rowId, cells: c as GridCellInput };
      if (at && !at.saved) return { clientKey: at.key, rowId: null, cells: { ...at.draft, ...c } as GridCellInput };
      return { clientKey: `paste-${++lineSeq}`, rowId: null, cells: c as GridCellInput };
    });
    try {
      await checkRows(rows);
    } catch (err) {
      reportError(err);
    }
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const uploadFile = async (file: File, dryRun: boolean) => {
    const form = new FormData();
    form.append('file', file);
    form.append('calendar', calendar);
    form.append('month', month);
    if (planId) form.append('planId', planId);
    form.append('dryRun', String(dryRun));
    return (await apiFetch<{ data: GridSaveResponse }>('/api/calendar-plans/grid/upload', { method: 'POST', body: form })).data;
  };
  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    try {
      const response = await uploadFile(file, true);
      setPreview({ source: 'upload', response, rows: response.results.map((r) => ({ clientKey: r.clientKey, rowId: null, cells: r.input || {} })), file });
    } catch (err) {
      reportError(err);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmPreview = async () => {
    if (!preview) return;
    setPreviewSaving(true);
    try {
      const res = preview.source === 'upload' && preview.file ? await uploadFile(preview.file, false) : await send({ rows: preview.rows });
      afterSave(res);
      // Rows that could not be saved stay in the grid, unsaved, with their cells marked.
      const sentByKey = Object.fromEntries(preview.rows.map((r) => [r.clientKey, r.cells]));
      const failedSaved = new Map<string, GridRowResult>();
      const failedNew: GridLine[] = [];
      for (const r of res.results) {
        if (r.status === 'saved') continue;
        const existing = lines.find((l) => l.key === r.clientKey && l.saved);
        if (existing) failedSaved.set(existing.key, r);
        else failedNew.push(newLine({ ...(sentByKey[r.clientKey] || r.input || {}) }, r.cellErrors));
      }
      setPreview(null);
      const saved = res.counts.saved;
      setNotice({
        tone: res.counts.invalid ? 'error' : 'ok',
        text: `${saved} ${saved === 1 ? 'row' : 'rows'} saved.${res.counts.invalid ? ` ${res.counts.invalid} need fixing; the marked cells show why.` : ''}`,
      });
      await load(failedNew);
      if (failedSaved.size) {
        setLines((prev) =>
          prev.map((l) => {
            const r = failedSaved.get(l.key);
            return r ? { ...l, draft: { ...(sentByKey[l.key] || {}) }, errors: r.cellErrors } : l;
          })
        );
      }
      onChanged?.();
    } catch (err) {
      reportError(err);
    } finally {
      setPreviewSaving(false);
    }
  };

  // ── Submit, review & delete ──────────────────────────────────────────────
  const plan = data?.plan || null;
  const toSubmit = lines.filter((l) => l.saved && (l.saved.rowStatus === 'draft' || l.saved.rowStatus === 'changes_requested')).length;
  const unsavedWithContent = lines.filter((l) => !isBlank(l) && (!l.saved || Object.keys(l.errors).length > 0)).length;
  const keepUnsaved = () => linesRef.current.filter((l) => !l.saved && !isBlank(l));
  const submitPlan = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/calendar-plans/${plan._id}/submit`, { method: 'POST' });
      setNotice({ tone: 'ok', text: 'Sent to the Creative Head for review.' });
      await load(keepUnsaved());
      onChanged?.();
    } catch (err) {
      reportError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (body: Record<string, unknown>, okText: string) => {
    if (!plan) return false;
    setReviewBusy(true);
    try {
      await apiFetch(`/api/calendar-plans/${plan._id}/review`, { method: 'POST', body: JSON.stringify(body) });
      setNotice({ tone: 'ok', text: okText });
      setSelectedIds(new Set());
      await load();
      onChanged?.();
      return true;
    } catch (err) {
      reportError(err);
      return false;
    } finally {
      setReviewBusy(false);
    }
  };
  const submittedLines = lines.filter((l) => l.saved?.rowStatus === 'submitted');
  // Whole-plan approval uses the existing approve_all rule (approves every row); offered only when
  // every row not yet approved has been submitted, so no draft is approved by accident.
  const canApproveWhole =
    canReview && submittedLines.length > 0 && lines.every((l) => !l.saved || l.saved.rowStatus === 'submitted' || l.saved.rowStatus === 'approved');

  const panelLine = lines.find((l) => l.key === panelKey) || null;
  const savePanel = async (cells: GridCellInput) => {
    if (!panelLine) return;
    if (Object.keys(cells).length === 0) {
      setPanelKey(null);
      return;
    }
    setPanelSaving(true);
    const ok = await commit(panelLine, cells);
    setPanelSaving(false);
    if (ok) setPanelKey(null);
  };
  const submitPanelRow = async () => {
    if (!panelLine?.rowId || !plan) return;
    setPanelSaving(true);
    try {
      await apiFetch(`/api/calendar-plans/${plan._id}/rows/${panelLine.rowId}/submit`, { method: 'POST' });
      setNotice({ tone: 'ok', text: `Sent "${panelLine.saved?.topic}" for review.` });
      setPanelKey(null);
      await load(keepUnsaved());
      onChanged?.();
    } catch (err) {
      reportError(err);
    } finally {
      setPanelSaving(false);
    }
  };
  const reviewPanelRow = async (action: 'approve' | 'changes', comment?: string) => {
    if (!panelLine?.rowId) return;
    setPanelSaving(true);
    const ok =
      action === 'approve'
        ? await review({ action: 'approve_selected', approvedRowIds: [panelLine.rowId] }, `Approved "${panelLine.saved?.topic}". Its steps are now created.`)
        : await review({ action: 'request_changes', changes: [{ rowId: panelLine.rowId, comment }] }, `Sent "${panelLine.saved?.topic}" back with your note.`);
    setPanelSaving(false);
    if (ok) setPanelKey(null);
  };
  const deletePanelRowConfirmed = async () => {
    if (!panelLine?.rowId || !plan) return;
    setConfirm(null);
    setPanelSaving(true);
    try {
      await apiFetch(`/api/calendar-plans/${plan._id}/rows/${panelLine.rowId}`, { method: 'DELETE' });
      setPanelKey(null);
      await load(keepUnsaved());
      onChanged?.();
    } catch (err) {
      reportError(err);
    } finally {
      setPanelSaving(false);
    }
  };
  const addRow = () => {
    const blank = lines.find((l) => isBlank(l));
    if (blank) setPanelKey(blank.key);
  };

  // ── Keyboard movement between cells ──────────────────────────────────────
  const focusCell = (lineIdx: number, colKey: string) => {
    tableRef.current?.querySelector<HTMLElement>(`[data-line="${lineIdx}"][data-col="${colKey}"]`)?.focus();
  };
  const moveSideways = (from: HTMLElement, dir: 1 | -1) => {
    const all = Array.from(tableRef.current?.querySelectorAll<HTMLElement>('[data-cell]') || []);
    all[all.indexOf(from) + dir]?.focus();
  };
  const onTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, lineIdx: number, colKey: string) => {
    const el = e.currentTarget;
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      el.blur();
      focusCell(lineIdx + 1, colKey);
    } else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
      e.preventDefault();
      el.blur();
      focusCell(lineIdx - 1, colKey);
    } else if (e.key === 'ArrowLeft' && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      moveSideways(el, -1);
    } else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) {
      e.preventDefault();
      moveSideways(el, 1);
    } else if (e.key === 'Escape') {
      el.value = el.defaultValue;
    }
  };

  // ── Cells ────────────────────────────────────────────────────────────────
  const errorFor = (line: GridLine, ...keys: string[]) =>
    keys
      .map((k) => line.errors[k]?.join(' '))
      .filter(Boolean)
      .join(' ');

  const renderPlanning = (line: GridLine, idx: number, col: PlanCol) => {
    const key = col.key;
    const stage = col.stage;
    const stages = stagesOf(line);
    const id = `cell-${line.key}-${key}`;
    const label = `${col.header}, row ${idx + 1}${line.saved ? `, ${line.saved.topic}` : ''}`;
    const locked = !canEdit || (line.saved ? !line.saved.editable : false);
    const err =
      col.kind === 'owner' && stage
        ? errorFor(line, OWNER_FIELD_BY_STAGE[stage], `${OWNER_FIELD_BY_STAGE[stage]}Id`)
        : col.kind === 'deadline' && stage
          ? errorFor(line, `deadline.${stage}`)
          : errorFor(line, key);
    const errNode = err ? (
      <span id={`${id}-err`} className="block mt-0.5 px-1 text-[11px] leading-snug text-ui-ink whitespace-normal">
        <span aria-hidden="true">⚠ </span>
        {err}
      </span>
    ) : null;
    const invalidCls = err ? ' ring-2 ring-inset ring-ui-coral' : '';
    const common = {
      id,
      'data-cell': true,
      'data-line': idx,
      'data-col': key,
      'data-excel-col': col.excelKey,
      'aria-label': label,
      'aria-invalid': err ? true : undefined,
      'aria-describedby': err ? `${id}-err` : undefined,
      title: err || undefined,
    } as const;

    if (stage && stages && !stages.includes(stage)) {
      return (
        <span className="block px-2 text-sm text-ui-muted">
          N/A<span className="sr-only">{`: ${col.header} does not apply to this row`}</span>
        </span>
      );
    }

    // Read-only text (approved rows; every row for reviewers and viewers).
    if (locked) {
      let text = '';
      if (col.kind === 'deadline' && stage) text = line.saved?.stepDeadlines[stage] ? formatGridDate(line.saved.stepDeadlines[stage]!) : '';
      else if (col.kind === 'date') text = line.saved ? formatGridDate(line.saved.postingDate) : textOf(line, key);
      else text = textOf(line, key);
      return (
        <span className="block px-2 py-2 text-sm text-ui-ink truncate" title={text || undefined}>
          {text || <span className="text-ui-muted">–</span>}
        </span>
      );
    }

    if (col.kind === 'date') {
      const draft = line.draft.postingDate;
      let iso = line.saved?.postingDate || '';
      if (draft !== undefined) {
        const r = parseGridDate(String(draft), { month });
        iso = r.ok ? r.value : '';
      }
      return (
        <>
          <DateCell id={id} value={iso} label={label} line={idx} col={key} excelCol={col.excelKey} invalid={err} describedBy={err ? `${id}-err` : undefined} onCommit={(v) => commit(line, { postingDate: v })} onEnter={() => focusCell(idx + 1, key)} />
          {errNode}
        </>
      );
    }

    if (col.kind === 'deadline' && stage) {
      if (!line.saved) {
        return (
          <span className="block px-2 text-sm text-ui-muted" title="Worked out from the posting date when the row is saved">
            Auto
          </span>
        );
      }
      const manual = line.saved.ownerSources[stage]?.deadline === 'manual';
      return (
        <>
          <DateCell
            id={id}
            value={line.saved.stepDeadlines[stage] || ''}
            label={`${label}${manual ? ', set by you' : ', automatic'}`}
            line={idx}
            col={key}
            invalid={err}
            describedBy={err ? `${id}-err` : undefined}
            onCommit={(v) => commit(line, { deadlines: { [stage]: v } })}
            onEnter={() => focusCell(idx + 1, key)}
          />
          {manual && <span className="block px-1 text-[11px] text-ui-text">Set by you</span>}
          {errNode}
        </>
      );
    }

    if (col.kind === 'type') {
      const current = line.draft.type !== undefined ? String(line.draft.type) : line.saved?.type || '';
      const known = (data?.types || []).includes(current);
      return (
        <>
          <select {...common} className={`ui-select h-11 w-full${invalidCls}`} value={current} onChange={(e) => commit(line, { type: e.target.value, typeExact: true })}>
            <option value="">Choose type</option>
            {!known && current && <option value={current}>{current}</option>}
            {(data?.types || []).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errNode}
        </>
      );
    }

    if (col.kind === 'owner' && stage) {
      const field = OWNER_FIELD_BY_STAGE[stage];
      const draftId = line.draft[`${field}Id`];
      const savedId = line.saved?.ownerIds[stage] || '';
      const value = draftId !== undefined ? String(draftId) : savedId || '';
      const source = line.saved?.ownerSources[stage]?.owner;
      // Same rule as the Add Row form: owners hold the step in their work preferences.
      const options = people.filter((p) => p.workPreferences.includes(stage) || p._id === value);
      const typedName = line.draft[field] !== undefined ? String(line.draft[field]) : '';
      return (
        <div>
          <div className="flex items-center gap-1">
            <select {...common} className={`ui-select h-11 w-full min-w-0${invalidCls}`} value={value} onChange={(e) => commit(line, e.target.value ? { [`${field}Id`]: e.target.value } : { [field]: '' })}>
              <option value="">{typedName ? `“${typedName}” (not matched)` : 'Auto-assign'}</option>
              {options.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            {value && source === 'suggested' && draftId === undefined && (
              <span className="status-chip status-not-started text-[11px] shrink-0" title="Suggested by autofill. Pick a person to fix it.">
                Auto
              </span>
            )}
          </div>
          {errNode}
        </div>
      );
    }

    // Text: topic, brief, content link, remarks.
    const display = textOf(line, key);
    return (
      <>
        <input
          {...common}
          key={`${line.key}-${key}-${display}`}
          type={key === 'contentLink' ? 'url' : 'text'}
          defaultValue={display}
          className={`ui-input h-11 w-full${invalidCls}`}
          onKeyDown={(e) => onTextKeyDown(e, idx, key)}
          onBlur={(e) => {
            if (e.target.value !== display) commit(line, { [key]: e.target.value });
          }}
        />
        {errNode}
      </>
    );
  };

  const renderProgress = (line: GridLine, col: PlanCol) => {
    const row = line.saved;
    if (!row) return <span className="text-ui-muted" aria-hidden="true">–</span>;
    const stage = STATUS_STAGE[col.key as PlanGridColumnKey];
    if (stage && !row.stages.includes(stage)) return <span className="text-sm text-ui-muted">N/A</span>;
    const raw = (row as unknown as Record<string, unknown>)[col.key];
    if (col.key.endsWith('Status')) {
      const s = String(raw || '');
      if (!s) return <span className="text-sm text-ui-muted">Not started</span>;
      if (col.key === 'approvalStatus') {
        const tone = s === 'Approved' ? 'approved' : s === 'Changes requested' ? 'changes' : 'waiting';
        return <span className={`status-chip ${statusClass(tone)} text-[11px]`}>{s}</span>;
      }
      if (s === 'Skipped') return <span className="status-chip status-locked text-[11px]">Skipped</span>;
      return (
        <span className={`status-chip ${statusClass(statusTone(s === 'Locked' ? 'Not Started' : s, s === 'Locked'))} text-[11px]`}>
          {s === 'Locked' ? 'Locked' : getStepStatusLabel(s)}
        </span>
      );
    }
    if (col.key === 'turnaroundDays') return <span className="text-sm text-ui-text">{raw === null || raw === undefined ? '–' : `${raw}`}</span>;
    const text = String(raw || '');
    return <span className="text-sm text-ui-text whitespace-nowrap">{text ? formatGridDate(text) : '–'}</span>;
  };

  const cellStyle = (col: PlanCol | null): React.CSSProperties => {
    if (!col) return { left: 0, minWidth: layout.lead, width: layout.lead };
    const w = layout.widthOf(col);
    const left = layout.left[col.key];
    return left !== undefined ? { left, minWidth: w, width: w } : { minWidth: w, width: w };
  };
  const isFrozen = (col: PlanCol) => layout.left[col.key] !== undefined;

  const errorLines = lines.map((l, i) => ({ l, i })).filter(({ l }) => Object.keys(l.errors).length > 0);
  const selectedPlan = data?.plans.find((p) => p._id === planId) || null;
  const calendarName = CALENDAR_LIST.find((c) => c.id === calendar)?.name || calendar;

  return (
    <section aria-labelledby="plan-grid-title" className="space-y-3 w-full min-w-0">
      {/* Toolbar */}
      <div className="glass-panel rounded-ui-panel p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary h-11">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to plans
          </button>
          <div className="min-w-0 mr-auto">
            <h1 id="plan-grid-title" className="text-lg font-bold text-ui-ink leading-tight">Plan grid</h1>
            <p className="text-sm text-ui-muted">
              {canReview
                ? 'Review submitted rows: approve them, or send them back with a note.'
                : readOnly
                  ? 'Read-only view of the month plan.'
                  : isPhone
                    ? 'Add or edit one row at a time.'
                    : 'Type in the grid, pick dates from the calendar, or paste rows from Excel.'}
            </p>
          </div>
          {canEdit && (
            <>
              <button type="button" className="ui-btn ui-btn-primary h-11" onClick={addRow}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add row
              </button>
              {!isPhone && (
                <button type="button" className="ui-btn ui-btn-secondary h-11" onClick={() => setPasteOpen(true)}>
                  <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
                  Paste from Excel
                </button>
              )}
            </>
          )}
          {data?.permissions.canEdit && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="sr-only" id="plan-grid-upload" aria-label="Upload an Excel or CSV plan file" onChange={(e) => onFileChosen(e.target.files?.[0])} disabled={!canEdit} />
              <button type="button" className="ui-btn ui-btn-secondary h-11" onClick={() => fileRef.current?.click()} disabled={!canEdit}>
                <Upload className="w-4 h-4" aria-hidden="true" />
                Upload
              </button>
              <a href="/api/calendar-plans/template" download="haca-calendar-plan-template.xlsx" className="ui-btn ui-btn-secondary h-11">
                <Download className="w-4 h-4" aria-hidden="true" />
                Download Template
              </a>
              <button
                type="button"
                className="ui-btn ui-btn-primary h-11"
                onClick={submitPlan}
                disabled={!plan || toSubmit === 0 || submitting || unsavedWithContent > 0}
                title={unsavedWithContent > 0 ? 'Fix or clear the unsaved rows first.' : undefined}
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                {submitting ? 'Submitting…' : `Submit for review${toSubmit ? ` (${toSubmit})` : ''}`}
              </button>
            </>
          )}
          {canReview && (
            <>
              <button
                type="button"
                className="ui-btn ui-btn-secondary h-11"
                disabled={selectedIds.size === 0 || reviewBusy}
                onClick={() => review({ action: 'approve_selected', approvedRowIds: [...selectedIds] }, `Approved ${selectedIds.size} ${selectedIds.size === 1 ? 'row' : 'rows'}.`)}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Approve selected ({selectedIds.size})
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-primary h-11"
                disabled={!canApproveWhole || reviewBusy}
                title={!canApproveWhole && submittedLines.length > 0 ? 'Some rows are still drafts or sent back, so approve rows one by one.' : undefined}
                onClick={() => setConfirm({ kind: 'approveAll' })}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Approve whole plan
              </button>
            </>
          )}
          {hasProgress && !isPhone && (
            <button type="button" className="ui-btn ui-btn-secondary h-11" aria-pressed={showProgress} onClick={() => setShowProgress((v) => !v)}>
              <ListChecks className="w-4 h-4" aria-hidden="true" />
              {showProgress ? 'Hide progress' : 'Show progress'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="plan-grid-calendar" className="text-xs font-semibold text-ui-muted">Calendar</label>
            <select
              id="plan-grid-calendar"
              className="ui-select h-11"
              value={calendar}
              onChange={(e) => {
                setPlanId(undefined);
                setCalendar(e.target.value);
              }}
            >
              {CALENDAR_LIST.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="plan-grid-month" className="text-xs font-semibold text-ui-muted">Month</label>
            <input
              id="plan-grid-month"
              type="month"
              className="ui-input h-11"
              value={month}
              onChange={(e) => {
                if (!e.target.value) return;
                setPlanId(undefined);
                setMonth(e.target.value);
              }}
            />
          </div>
          {data && data.plans.length > 1 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="plan-grid-plan" className="text-xs font-semibold text-ui-muted">Plan for this month</label>
              <select id="plan-grid-plan" className="ui-select h-11" value={planId || ''} onChange={(e) => setPlanId(e.target.value || undefined)}>
                <option value="">Choose a plan</option>
                {data.plans.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.code} · {p.title} ({p.rowCount} {p.rowCount === 1 ? 'row' : 'rows'})
                  </option>
                ))}
              </select>
            </div>
          )}
          {canReview && (
            <label className="inline-flex items-center gap-3 min-h-[44px] text-sm text-ui-text">
              <input type="checkbox" className="w-5 h-5 accent-ui-ink" checked={showOnlyWaiting} onChange={(e) => setOnlyWaiting(e.target.checked)} />
              Only rows waiting for review ({submittedLines.length})
            </label>
          )}
          <p className="text-sm text-ui-muted sm:ml-auto" aria-live="polite">
            {loading
              ? 'Loading…'
              : plan
                ? `${plan.code} · ${plan.status} · ${lines.filter((l) => l.saved).length} rows`
                : data?.selectionRequired
                  ? ''
                  : 'No plan yet. The draft is created when the first row is saved.'}
          </p>
        </div>

        {readOnly && data && <p className="text-sm text-ui-muted">Read-only view. Contact details are not shown.</p>}
        {isPhone && canEdit && <p className="text-sm text-ui-muted">Paste from Excel works on a tablet or computer. Here, add or edit one row at a time.</p>}
        {data?.selectionRequired && (
          <p className="status-tint status-waiting rounded-ui-control px-3 py-2 text-sm">
            This month has {data.plans.length} plans for this calendar. Choose one to view or edit it; they are not merged.
          </p>
        )}
        {selectedPlan?.periodIssue && <p className="status-tint status-changes rounded-ui-control px-3 py-2 text-sm">This plan's saved period ends before it starts.</p>}
        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`status-tint ${notice.tone === 'error' ? 'status-changes' : 'status-approved'} rounded-ui-control px-3 py-2 text-sm`}>
            {notice.text}
          </p>
        )}
        {errorLines.length > 0 && (
          <div className="status-tint status-changes rounded-ui-control px-3 py-2 text-sm">
            <p className="font-semibold">
              {errorLines.length} {errorLines.length === 1 ? 'row needs' : 'rows need'} fixing:
            </p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {errorLines.map(({ l, i }) => {
                const firstField = Object.keys(l.errors)[0];
                const col = PLANNING_COLUMNS.find(
                  (c) => c.key === firstField || c.key === firstField.replace(/Id$/, '') || (c.kind === 'deadline' && firstField === `deadline.${c.stage}`)
                );
                return (
                  <li key={l.key}>
                    <button type="button" className="ui-btn ui-btn-secondary h-11" onClick={() => (col && !isPhone ? focusCell(i, col.key) : setPanelKey(l.key))}>
                      Row {i + 1}: {l.errors[firstField][0]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {loadError ? (
        <p role="alert" className="status-tint status-changes rounded-ui-control px-3 py-2 text-sm">{loadError}</p>
      ) : isPhone ? (
        <ul className="space-y-3" aria-label={`Rows for ${calendarName}, ${month}`}>
          {lines.map((line, idx) => {
            if (isBlank(line)) return null;
            if (showOnlyWaiting && line.saved?.rowStatus !== 'submitted') return null;
            const row = line.saved;
            const status = row ? ROW_STATUS[row.rowStatus] : null;
            const steps = row
              ? row.stages.map((s) => {
                  const ownerName = people.find((p) => p._id === row.ownerIds[s])?.name || String((row as unknown as Record<string, unknown>)[OWNER_FIELD_BY_STAGE[s]] || '') || 'auto';
                  return `${STAGE_LABEL[s]}: ${ownerName}${row.stepDeadlines[s] ? `, ${formatGridDate(row.stepDeadlines[s]!)}` : ''}`;
                })
              : [];
            const errs = Object.entries(line.errors);
            const attention = attentionOf(row);
            const verb = canReview && row?.rowStatus === 'submitted' ? 'Review row' : canEdit && (!row || row.editable) ? 'Edit row' : 'View row';
            return (
              <li key={line.key} className="glass-card rounded-ui-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-ui-muted">
                      Row {idx + 1} · {row ? formatGridDate(row.postingDate) : String(line.draft.postingDate || 'No date')} · {row?.type || String(line.draft.type || 'No type')}
                    </p>
                    <h3 className="text-sm font-semibold text-ui-ink break-words">{row?.topic || String(line.draft.topic || 'Untitled')}</h3>
                  </div>
                  {status ? (
                    <span className={`status-chip ${status.tone} text-[11px] shrink-0`}>{status.label}</span>
                  ) : (
                    <span className="status-chip status-changes text-[11px] shrink-0">Unsaved</span>
                  )}
                </div>
                {steps.length > 0 && (
                  <ul className="text-xs text-ui-text space-y-0.5">
                    {steps.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                {attention.length > 0 && <p className="text-xs text-ui-ink status-tint status-changes rounded-ui-control px-2 py-1">Needs attention: {attention.join(', ')}</p>}
                {errs.length > 0 && (
                  <ul className="status-tint status-changes rounded-ui-control px-2 py-1 text-xs" aria-label={`Problems in row ${idx + 1}`}>
                    {errs.map(([f, m]) => (
                      <li key={f}>
                        <span className="font-semibold">{PLANNING_COLUMNS.find((c) => c.key === f.replace(/Id$/, ''))?.header || f}:</span> {m.join(' ')}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="ui-btn ui-btn-secondary h-11 w-full"
                  aria-label={`${verb}: ${row?.topic || String(line.draft.topic || `row ${idx + 1}`)}`}
                  onClick={() => setPanelKey(line.key)}
                >
                  {verb}
                </button>
              </li>
            );
          })}
          {!loading && lines.every((l) => isBlank(l) || (showOnlyWaiting && l.saved?.rowStatus !== 'submitted')) && (
            <li className="text-sm text-ui-muted">{showOnlyWaiting ? 'No rows are waiting for review.' : 'No rows yet.'}</li>
          )}
        </ul>
      ) : (
        <div className="glass-panel rounded-ui-panel overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-260px)] min-h-[320px]">
            <table ref={tableRef} onPaste={onPaste} className="border-separate border-spacing-0 text-sm" aria-label={`Plan grid for ${calendarName}, ${month}`} aria-busy={loading}>
              <thead>
                <tr>
                  <th scope="col" rowSpan={2} className="sticky top-0 left-0 z-30 bg-ui-card border-b border-r border-ui-line px-2 text-left text-xs font-semibold text-ui-muted" style={cellStyle(null)}>
                    Row
                  </th>
                  {groups.map((g, i) => {
                    const frozen = g.group === 'Plan';
                    return (
                      <th
                        key={`${g.group}-${i}`}
                        scope="colgroup"
                        colSpan={g.span}
                        className={`sticky top-0 h-10 bg-ui-card border-b border-r border-ui-line px-2 text-left text-xs font-semibold text-ui-ink ${frozen ? 'z-30' : 'z-20'}`}
                        style={frozen ? { left: layout.lead } : undefined}
                      >
                        {g.group}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={`sticky top-10 bg-ui-card border-b border-r border-ui-line px-2 py-2 text-left text-xs font-semibold ${c.kind === 'progress' ? 'text-ui-muted' : 'text-ui-ink'} ${isFrozen(c) ? 'z-30' : 'z-20'}`}
                      style={cellStyle(c)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.header}
                        {c.help && (
                          <span className="inline-flex" title={c.help}>
                            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="sr-only">: {c.help}</span>
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const status = line.saved ? ROW_STATUS[line.saved.rowStatus] : null;
                  const saving = savingKeys.has(line.key);
                  const blank = isBlank(line);
                  if (!line.saved && blank && !canEdit) return null;
                  if (showOnlyWaiting && line.saved?.rowStatus !== 'submitted') return null;
                  const attention = attentionOf(line.saved);
                  return (
                    <tr key={line.key} className={saving ? 'opacity-70' : undefined}>
                      <th scope="row" className="sticky left-0 z-10 bg-ui-card border-b border-r border-ui-line px-2 text-left font-normal" style={cellStyle(null)}>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-ui-muted w-6 text-right" aria-hidden="true">{blank ? '+' : idx + 1}</span>
                          <span className="sr-only">{blank ? 'New row' : `Row ${idx + 1}: ${line.saved?.topic || String(line.draft.topic || 'unsaved row')}`}</span>
                          {status ? (
                            isCompact ? (
                              <>
                                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 status-dot ${status.tone}`} title={status.label} aria-hidden="true" />
                                <span className="sr-only">{status.label}</span>
                              </>
                            ) : (
                              <span className={`status-chip ${status.tone} text-[11px]`}>{status.label}</span>
                            )
                          ) : !blank ? (
                            <span className="status-chip status-changes text-[11px]">
                              {isCompact ? '!' : 'Unsaved'}
                              {isCompact && <span className="sr-only">Unsaved</span>}
                            </span>
                          ) : null}
                          {attention.length > 0 && (
                            <span className="status-chip status-changes text-[11px]" title={`Needs attention: ${attention.join(', ')}`}>
                              <span aria-hidden="true">⚠</span>
                              <span className="sr-only">{`Needs attention: ${attention.join(', ')}`}</span>
                            </span>
                          )}
                          {canReview && line.saved?.rowStatus === 'submitted' && (
                            <label className="inline-flex items-center justify-center w-11 h-11 cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-5 h-5 accent-ui-ink"
                                aria-label={`Select ${line.saved.topic} for approval`}
                                checked={selectedIds.has(line.saved.rowId)}
                                onChange={(e) =>
                                  setSelectedIds((cur) => {
                                    const n = new Set(cur);
                                    if (e.target.checked) n.add(line.saved!.rowId);
                                    else n.delete(line.saved!.rowId);
                                    return n;
                                  })
                                }
                              />
                            </label>
                          )}
                          {!blank && (
                            <button
                              type="button"
                              className="ui-icon-btn h-11 w-11 ml-auto shrink-0"
                              aria-label={`${canReview && line.saved?.rowStatus === 'submitted' ? 'Review row' : 'Row details'}: ${line.saved?.topic || String(line.draft.topic || `row ${idx + 1}`)}`}
                              onClick={() => setPanelKey(line.key)}
                            >
                              <PanelRightOpen className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </th>
                      {columns.map((c) => (
                        <td key={c.key} className={`border-b border-r border-ui-line px-1 py-0.5 align-middle ${isFrozen(c) ? 'sticky z-10 bg-ui-card' : 'bg-white/40'}`} style={cellStyle(c)}>
                          {c.kind === 'progress' ? renderProgress(line, c) : renderPlanning(line, idx, c)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pasteOpen && <PlanGridPasteDialog isChecking={pasteChecking} onCheck={checkPastedText} onCancel={() => setPasteOpen(false)} />}

      {preview && (
        <PlanGridPreviewDialog
          title={preview.source === 'paste' ? 'Check pasted rows' : 'Check uploaded rows'}
          source={preview.source}
          preview={preview.response}
          inputs={Object.fromEntries(preview.rows.map((r) => [r.clientKey, r.cells]))}
          isSaving={previewSaving}
          onConfirm={confirmPreview}
          onCancel={() => setPreview(null)}
        />
      )}

      {panelLine && (
        <PlanGridRowPanel
          key={panelLine.key}
          line={panelLine}
          planId={plan?._id}
          month={month}
          canEdit={canEdit}
          canReview={canReview}
          people={people}
          types={data?.types || []}
          isSaving={panelSaving || reviewBusy}
          actionError={notice?.tone === 'error' ? notice.text : null}
          onSave={savePanel}
          onDelete={() => setConfirm({ kind: 'deleteRow' })}
          onSubmitRow={submitPanelRow}
          onReview={reviewPanelRow}
          onClose={() => setPanelKey(null)}
        />
      )}

      {confirm?.kind === 'approveAll' && (
        <PlanGridConfirmDialog
          title="Approve the whole plan?"
          message={`All ${submittedLines.length} submitted ${submittedLines.length === 1 ? 'row' : 'rows'} will be approved and their steps created. Approved rows can no longer be edited.`}
          confirmLabel="Approve whole plan"
          isBusy={reviewBusy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const ok = await review({ action: 'approve_all' }, 'Plan approved.');
            if (ok) setConfirm(null);
          }}
        />
      )}
      {confirm?.kind === 'deleteRow' && panelLine?.saved && (
        <PlanGridConfirmDialog
          title="Delete this row?"
          message={`"${panelLine.saved.topic}" will be removed from this plan.`}
          confirmLabel="Delete row"
          isBusy={panelSaving}
          onCancel={() => setConfirm(null)}
          onConfirm={deletePanelRowConfirmed}
        />
      )}
    </section>
  );
};
