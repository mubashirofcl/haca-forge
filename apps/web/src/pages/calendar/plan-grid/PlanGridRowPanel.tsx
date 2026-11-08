import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Trash2, CheckCircle2, MessageSquare, Send, AlertTriangle } from 'lucide-react';
import { PRIORITIES, formatGridDate, getPipelineForContent, normalizePriority, parseGridDate, type StageKey } from '@mmp/shared';
import { apiFetch } from '../../../lib/api';
import { useDialogFocus } from '../../../lib/useDialogFocus';
import {
  applyAutofill,
  applyPostingDateChange,
  applyTypeChange,
  buildDefaultSteps,
  calculateDueDateString,
  getExpectedStepDefs,
  setStepDueDate,
  validateRowSteps,
  type AutofillStage,
  type StepLineState,
} from '../planRowSteps';
import { OWNER_FIELD_BY_STAGE, STAGE_LABEL } from './columns';
import type { GridCellInput, GridLine, GridPerson } from './types';

const ROW_STATUS: Record<string, { tone: string; label: string }> = {
  draft: { tone: 'status-not-started', label: 'Draft' },
  submitted: { tone: 'status-waiting', label: 'Submitted' },
  changes_requested: { tone: 'status-changes', label: 'Changes requested' },
  approved: { tone: 'status-approved', label: 'Approved' },
};

interface Props {
  line: GridLine;
  planId?: string;
  month: string;
  canEdit: boolean;
  /** Creative Head: approve or return a submitted row. */
  canReview?: boolean;
  people?: GridPerson[];
  types?: string[];
  isSaving: boolean;
  /** A failed save/review shown inside the panel (the grid's notice is behind the drawer). */
  actionError?: string | null;
  onSave: (cells: GridCellInput) => void;
  onDelete: () => void;
  onSubmitRow?: () => void;
  onReview?: (action: 'approve' | 'changes', comment?: string) => void;
  onClose: () => void;
}

/** ISO date for a draft or saved value ('' if it cannot be read). */
const isoOf = (value: unknown, month: string) => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const r = parseGridDate(s, { month });
  return r.ok ? r.value : '';
};

/** Steps of a saved row as the Add Row form holds them. */
function stepsFromRow(line: GridLine, people: GridPerson[]): StepLineState[] {
  const row = line.saved!;
  const defs = getExpectedStepDefs(row.type, row.needsScript, row.needsShoot);
  return row.stages.map((s) => {
    const id = row.ownerIds[s] || null;
    return {
      stageKey: s,
      ownerId: id,
      ownerName: people.find((p) => p._id === id)?.name || '',
      ownerSource: row.ownerSources[s]?.owner || 'suggested',
      dueDate: row.stepDeadlines[s] || '',
      dueDateSource: row.ownerSources[s]?.deadline || 'auto',
      offsetDays: defs.find((d) => d.stageKey === s)?.offset ?? 0,
    };
  });
}

/**
 * Row editor: every planning field (same fields as the Add Row form), Steps & Deadlines for
 * every step the row has (Content and Design included), review feedback, and the Creative Head's review.
 */
export const PlanGridRowPanel: React.FC<Props> = ({
  line,
  planId,
  month,
  canEdit,
  canReview = false,
  people = [],
  types = [],
  isSaving,
  actionError,
  onSave,
  onDelete,
  onSubmitRow,
  onReview,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true, onClose);
  const row = line.saved;
  const editable = canEdit && (!row || row.editable);
  const d = line.draft;

  const initial = useMemo(
    () => ({
      postingDate: d.postingDate !== undefined ? isoOf(d.postingDate, month) : row?.postingDate ?? '',
      topic: d.topic !== undefined ? String(d.topic) : row?.topic ?? '',
      type: d.type !== undefined ? String(d.type) : row?.type ?? '',
      brief: d.brief !== undefined ? String(d.brief) : row?.brief ?? '',
      publishTime: d.publishTime !== undefined ? String(d.publishTime) : row?.publishTime || '18:00',
      contentLink: d.contentLink !== undefined ? String(d.contentLink) : row?.contentLink ?? '',
      remarks: d.remarks !== undefined ? String(d.remarks) : row?.remarks ?? '',
      programOrEvent: row?.programOrEvent ?? '',
      referenceLink: row?.referenceLink ?? '',
      // An older stored value (Low, Medium, High) shows as Normal and is only sent if changed.
      priority: normalizePriority(row?.priority),
      sourceVideoLink: row?.sourceVideoLink ?? '',
      needsScript: row ? row.needsScript : true,
      needsShoot: row ? row.needsShoot : true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, d]
  );
  const initialSteps = useMemo(() => (row ? stepsFromRow(line, people) : []), [row, line, people]);
  const [form, setForm] = useState(initial);
  const [steps, setSteps] = useState<StepLineState[]>(() =>
    row ? initialSteps : initial.type && initial.postingDate ? buildDefaultSteps(initial.type, initial.needsScript, initial.needsShoot, initial.postingDate, people) : []
  );
  const [showErrors, setShowErrors] = useState(false);
  const [changesComment, setChangesComment] = useState('');
  const [changesError, setChangesError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isReel = form.type === 'Reel';

  // Owner suggestions from the same endpoint the Add Row form uses (POST .../autofill).
  const suggest = async (type: string, postingDate: string, needsScript: boolean, needsShoot: boolean) => {
    if (!type || !postingDate || !editable) return;
    try {
      const url = planId ? `/api/calendar-plans/${planId}/rows/autofill` : '/api/calendar-plans/autofill';
      const res = await apiFetch<{ data: { stages: AutofillStage[] } }>(url, {
        method: 'POST',
        body: JSON.stringify({ type, postingDate, needsScript, needsShoot }),
      });
      if (res?.data?.stages) setSteps((prev) => applyAutofill(prev, res.data.stages));
    } catch {
      // Suggestions are optional; the server autofills blanks on save.
    }
  };
  useEffect(() => {
    if (!row && initial.type && initial.postingDate) suggest(initial.type, initial.postingDate, initial.needsScript, initial.needsShoot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changePostingDate = (value: string) => {
    set('postingDate', value);
    if (!value) return;
    setSteps((prev) => (prev.length ? applyPostingDateChange(prev, value) : form.type ? buildDefaultSteps(form.type, form.needsScript, form.needsShoot, value, people) : prev));
    if (!row && form.type && !steps.length) suggest(form.type, value, form.needsScript, form.needsShoot);
  };
  const changeTypeOrSteps = (type: string, needsScript: boolean, needsShoot: boolean) => {
    setForm((f) => ({ ...f, type, needsScript, needsShoot }));
    if (!type) return;
    setSteps((prev) => applyTypeChange(prev, type, needsScript, needsShoot, form.postingDate, people));
    suggest(type, form.postingDate, needsScript, needsShoot);
  };
  const changeOwner = (stageKey: StageKey, ownerId: string) =>
    setSteps((prev) =>
      prev.map((s) =>
        s.stageKey !== stageKey
          ? s
          : ownerId
            ? { ...s, ownerId, ownerName: people.find((p) => p._id === ownerId)?.name || '', ownerSource: 'manual', ownerReason: '' }
            : { ...s, ownerId: null, ownerName: '', ownerSource: 'suggested', ownerReason: 'Auto-assign on save' }
      )
    );
  const resetDeadline = (stageKey: StageKey) =>
    setSteps((prev) =>
      prev.map((s) =>
        s.stageKey !== stageKey ? s : { ...s, dueDateSource: 'auto', dueDate: s.stageKey === 'Post' ? form.postingDate : calculateDueDateString(form.postingDate, s.offsetDays) }
      )
    );

  const validation = useMemo(
    () => validateRowSteps({ steps, postingDate: form.postingDate, type: form.type, needsShoot: form.needsShoot, sourceVideoLink: form.sourceVideoLink, members: people }),
    [steps, form.postingDate, form.type, form.needsShoot, form.sourceVideoLink, people]
  );
  const fieldErrors: Record<string, string> = {};
  if (!form.postingDate) fieldErrors.postingDate = 'Posting date is required.';
  if (form.topic.trim().length < 2) fieldErrors.topic = 'Topic is required.';
  if (!form.type) fieldErrors.type = 'Type is required.';
  if (validation.errors.sourceVideoLink) fieldErrors.sourceVideoLink = validation.errors.sourceVideoLink;

  const save = () => {
    if (Object.keys(fieldErrors).length || Object.keys(validation.errors).length) {
      setShowErrors(true);
      return;
    }
    const cells: GridCellInput = {};
    if (form.postingDate !== initial.postingDate || (!row && form.postingDate)) cells.postingDate = form.postingDate;
    if (form.topic !== initial.topic || (!row && form.topic)) cells.topic = form.topic;
    if (form.type !== initial.type || (!row && form.type)) {
      cells.type = form.type;
      cells.typeExact = true;
    }
    (['brief', 'publishTime', 'contentLink', 'remarks', 'programOrEvent', 'referenceLink', 'priority', 'sourceVideoLink'] as const).forEach((k) => {
      if (form[k] !== initial[k]) cells[k] = form[k];
    });
    if (isReel) {
      if (form.needsScript !== initial.needsScript || !row) cells.needsScript = form.needsScript ? 'Yes' : 'No';
      if (form.needsShoot !== initial.needsShoot || !row) cells.needsShoot = form.needsShoot ? 'Yes' : 'No';
    }
    // Steps: send what the user set; suggested owners and automatic deadlines are recalculated by the same rules on save.
    const deadlines: Partial<Record<StageKey, string>> = {};
    for (const s of steps) {
      const before = initialSteps.find((x) => x.stageKey === s.stageKey);
      const field = OWNER_FIELD_BY_STAGE[s.stageKey];
      if (s.ownerSource === 'manual' && s.ownerId && (s.ownerId !== before?.ownerId || before?.ownerSource !== 'manual')) cells[`${field}Id`] = s.ownerId;
      else if (s.ownerSource !== 'manual' && before?.ownerSource === 'manual') cells[field] = '';
      if (s.dueDateSource === 'manual' && (s.dueDate !== before?.dueDate || before?.dueDateSource !== 'manual')) deadlines[s.stageKey] = s.dueDate;
      else if (s.dueDateSource !== 'manual' && before?.dueDateSource === 'manual') deadlines[s.stageKey] = '';
    }
    if (Object.keys(deadlines).length) cells.deadlines = deadlines;
    onSave(cells);
  };

  const err = (key: string) => (line.errors[key] || line.errors[`${key}Id`])?.join(' ') || (showErrors ? fieldErrors[key] : '') || '';
  const field = (id: string, label: string, control: React.ReactNode, error?: string) => (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-ui-text">{label}</label>
      {control}
      {error && <p id={`${id}-error`} className="text-xs text-ui-ink status-tint status-changes rounded-ui-control px-2 py-1">{error}</p>}
    </div>
  );
  const described = (id: string, error?: string) => ({ 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined });
  const status = row ? ROW_STATUS[row.rowStatus] : null;
  const reviewable = canReview && row?.rowStatus === 'submitted';
  const title = row?.topic || form.topic || 'New row';
  const stagesNow: StageKey[] = form.type
    ? (getPipelineForContent({ contentType: form.type, needsScript: form.needsScript, needsShoot: form.needsShoot }).stages as StageKey[])
    : [];
  const missing = steps.filter((s) => !s.ownerId || !s.dueDate).map((s) => `${STAGE_LABEL[s.stageKey]} ${!s.ownerId ? 'owner' : 'deadline'}`);
  const canSubmitRow = Boolean(onSubmitRow && editable && row && (row.rowStatus === 'draft' || row.rowStatus === 'changes_requested'));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close row details" className="absolute inset-0 ui-scrim cursor-default" onClick={onClose} tabIndex={-1} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="plan-row-panel-title" className="relative ui-drawer w-full max-w-lg h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-ui-line">
          <div className="min-w-0">
            <h2 id="plan-row-panel-title" className="text-base font-bold text-ui-ink truncate">{title}</h2>
            <p className="text-sm text-ui-muted">{row ? `${formatGridDate(row.postingDate)} · ${row.type}` : 'New row: not saved yet'}</p>
          </div>
          <button type="button" onClick={onClose} className="ui-icon-btn h-11 w-11" aria-label="Close row details">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {actionError && <p role="alert" className="status-tint status-changes rounded-ui-control px-3 py-2 text-sm text-ui-ink">{actionError}</p>}
          {status && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ui-text">Row status</span>
              <span className={`status-chip ${status.tone} text-[11px]`}>{status.label}</span>
            </div>
          )}

          {row?.reviewFeedback && (
            <section aria-labelledby="row-feedback-title" className="status-tint status-changes rounded-ui-card p-3">
              <h3 id="row-feedback-title" className="text-xs font-semibold text-ui-ink">Review feedback</h3>
              <p className="text-sm text-ui-text mt-1 whitespace-pre-wrap">{row.reviewFeedback}</p>
            </section>
          )}

          {reviewable && onReview && (
            <section aria-labelledby="row-review-title" className="glass-card rounded-ui-card p-3 space-y-3">
              <h3 id="row-review-title" className="text-sm font-semibold text-ui-ink">Review this row</h3>
              <button type="button" className="ui-btn ui-btn-primary h-11 w-full" disabled={isSaving} onClick={() => onReview('approve')}>
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Approve row
              </button>
              <div className="space-y-1">
                <label htmlFor="row-changes" className="block text-xs font-semibold text-ui-text">What needs to change</label>
                <textarea
                  id="row-changes"
                  className="ui-input ui-textarea w-full min-h-[88px]"
                  value={changesComment}
                  aria-invalid={changesError ? true : undefined}
                  aria-describedby={changesError ? 'row-changes-error' : undefined}
                  onChange={(e) => {
                    setChangesComment(e.target.value);
                    setChangesError(null);
                  }}
                />
                {changesError && <p id="row-changes-error" className="text-xs text-ui-ink status-tint status-changes rounded-ui-control px-2 py-1">{changesError}</p>}
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-secondary h-11 w-full"
                disabled={isSaving}
                onClick={() => {
                  if (!changesComment.trim()) {
                    setChangesError('Say what needs to change before sending the row back.');
                    return;
                  }
                  onReview('changes', changesComment.trim());
                }}
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                Request changes
              </button>
            </section>
          )}

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-ui-text">Plan</legend>
            <div className="grid grid-cols-2 gap-3">
              {field('row-date', 'Posting date', (
                <input id="row-date" type="date" className="ui-input h-11 w-full" value={form.postingDate} readOnly={!editable} onChange={(e) => changePostingDate(e.target.value)} {...described('row-date', err('postingDate'))} />
              ), err('postingDate'))}
              {field('row-time', 'Publish time', (
                <input id="row-time" type="time" className="ui-input h-11 w-full" value={form.publishTime} readOnly={!editable} onChange={(e) => set('publishTime', e.target.value)} {...described('row-time', err('publishTime'))} />
              ), err('publishTime'))}
            </div>
            {field('row-topic', 'Topic', (
              <input id="row-topic" className="ui-input h-11 w-full" value={form.topic} readOnly={!editable} onChange={(e) => set('topic', e.target.value)} {...described('row-topic', err('topic'))} />
            ), err('topic'))}
            {field('row-type', 'Type', (
              <select id="row-type" className="ui-select h-11 w-full" value={form.type} disabled={!editable} onChange={(e) => changeTypeOrSteps(e.target.value, form.needsScript, form.needsShoot)} {...described('row-type', err('type'))}>
                <option value="">Choose type</option>
                {form.type && !types.includes(form.type) && <option value={form.type}>{form.type}</option>}
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ), err('type'))}
            {isReel && (
              <fieldset className="space-y-1">
                <legend className="text-xs font-semibold text-ui-text">Reel steps</legend>
                {(['needsScript', 'needsShoot'] as const).map((k) => (
                  <label key={k} className="flex items-center gap-3 min-h-[44px] text-sm text-ui-text">
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-ui-ink"
                      checked={form[k]}
                      disabled={!editable}
                      onChange={(e) => changeTypeOrSteps(form.type, k === 'needsScript' ? e.target.checked : form.needsScript, k === 'needsShoot' ? e.target.checked : form.needsShoot)}
                    />
                    {k === 'needsScript' ? 'Needs script' : 'Needs shoot'}
                  </label>
                ))}
                {!form.needsShoot &&
                  field('row-source', 'Source video link (needed when there is no shoot)', (
                    <input id="row-source" type="url" className="ui-input h-11 w-full" value={form.sourceVideoLink} readOnly={!editable} onChange={(e) => set('sourceVideoLink', e.target.value)} {...described('row-source', err('sourceVideoLink'))} />
                  ), err('sourceVideoLink'))}
              </fieldset>
            )}
            {field('row-brief', 'Brief', (
              <textarea id="row-brief" className="ui-input ui-textarea w-full min-h-[88px]" value={form.brief} readOnly={!editable} onChange={(e) => set('brief', e.target.value)} {...described('row-brief', err('brief'))} />
            ), err('brief'))}
          </fieldset>

          <fieldset className="space-y-2" aria-describedby={missing.length ? 'row-steps-attention' : undefined}>
            <legend className="flex items-center gap-2 text-xs font-semibold text-ui-text">
              Steps &amp; Deadlines
              {missing.length > 0 && <span className="status-chip status-changes text-[11px]">Needs attention</span>}
            </legend>
            <p className="text-xs text-ui-muted">Deadlines are worked out from the posting date. Change one to fix it (“Set by you”); “Use auto” puts it back.</p>
            {missing.length > 0 && (
              <p id="row-steps-attention" className="flex items-start gap-1 text-xs text-ui-ink status-tint status-changes rounded-ui-control px-2 py-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                Missing: {missing.join(', ')}.{!row ? ' Owners left on Auto are assigned when the row is saved.' : ''}
              </p>
            )}
            {!stagesNow.length && <p className="text-sm text-ui-muted">Choose a type and posting date to see the steps.</p>}
            {steps.map((s) => {
              const ownerId = `row-owner-${s.stageKey}`;
              const dueId = `row-deadline-${s.stageKey}`;
              const stepErr = (showErrors || s.dueDateSource === 'manual' || s.ownerSource === 'manual' ? validation.errors[s.stageKey] : '') || err(OWNER_FIELD_BY_STAGE[s.stageKey]) || err(`deadline.${s.stageKey}`);
              const stepErrId = `row-step-${s.stageKey}-error`;
              const options = people.filter((p) => p.workPreferences.includes(s.stageKey) || p._id === s.ownerId);
              return (
                <div key={s.stageKey} className="rounded-ui-card glass-card p-3 space-y-2">
                  <p className="text-sm font-semibold text-ui-ink">{STAGE_LABEL[s.stageKey]}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {field(ownerId, `${STAGE_LABEL[s.stageKey]} owner`, (
                      <select id={ownerId} className="ui-select h-11 w-full" value={s.ownerId || ''} disabled={!editable} onChange={(e) => changeOwner(s.stageKey, e.target.value)} aria-invalid={stepErr ? true : undefined} aria-describedby={stepErr ? stepErrId : undefined}>
                        <option value="">Auto-assign</option>
                        {options.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </select>
                    ))}
                    {field(dueId, `${STAGE_LABEL[s.stageKey]} deadline`, (
                      <input id={dueId} type="date" className="ui-input h-11 w-full" value={s.dueDate} readOnly={!editable} onChange={(e) => setSteps((prev) => setStepDueDate(prev, s.stageKey, e.target.value))} aria-invalid={stepErr ? true : undefined} aria-describedby={stepErr ? stepErrId : undefined} />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`status-chip text-[11px] ${s.ownerSource === 'manual' ? 'status-in-progress' : 'status-not-started'}`}>
                      Owner: {s.ownerSource === 'manual' ? 'Set by you' : 'Suggested'}
                    </span>
                    <span className={`status-chip text-[11px] ${s.dueDateSource === 'manual' ? 'status-in-progress' : 'status-not-started'}`}>
                      Deadline: {s.dueDateSource === 'manual' ? 'Set by you' : 'Auto'}
                    </span>
                    {editable && s.dueDateSource === 'manual' && (
                      <button type="button" className="ui-btn ui-btn-secondary h-11" onClick={() => resetDeadline(s.stageKey)}>
                        Use auto
                      </button>
                    )}
                  </div>
                  {stepErr && <p id={stepErrId} className="text-xs text-ui-ink status-tint status-changes rounded-ui-control px-2 py-1">{stepErr}</p>}
                  {!stepErr && validation.warnings[s.stageKey] && <p className="text-xs text-ui-muted">{validation.warnings[s.stageKey]}</p>}
                </div>
              );
            })}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-ui-text">Details</legend>
            {field('row-content-link', 'Content link', (
              <input id="row-content-link" type="url" className="ui-input h-11 w-full" value={form.contentLink} readOnly={!editable} onChange={(e) => set('contentLink', e.target.value)} />
            ))}
            {field('row-remarks', 'Remarks', (
              <input id="row-remarks" className="ui-input h-11 w-full" value={form.remarks} readOnly={!editable} onChange={(e) => set('remarks', e.target.value)} />
            ), err('remarks'))}
            <div className="grid grid-cols-2 gap-3">
              {field('row-priority', 'Priority', (
                <select id="row-priority" className="ui-select h-11 w-full" value={form.priority} disabled={!editable} onChange={(e) => set('priority', normalizePriority(e.target.value))}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ), err('priority'))}
              {field('row-program', 'Program or event', (
                <input id="row-program" className="ui-input h-11 w-full" value={form.programOrEvent} readOnly={!editable} onChange={(e) => set('programOrEvent', e.target.value)} />
              ))}
            </div>
            {field('row-ref', 'Reference link', (
              <input id="row-ref" type="url" className="ui-input h-11 w-full" value={form.referenceLink} readOnly={!editable} onChange={(e) => set('referenceLink', e.target.value)} />
            ))}
          </fieldset>
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2 p-5 border-t border-ui-line">
            {row && (
              <button type="button" onClick={onDelete} className="ui-btn ui-btn-secondary h-11 mr-auto" disabled={isSaving}>
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Delete row
              </button>
            )}
            {canSubmitRow && (
              <button type="button" onClick={onSubmitRow} className="ui-btn ui-btn-secondary h-11" disabled={isSaving}>
                <Send className="w-4 h-4" aria-hidden="true" />
                {row?.rowStatus === 'changes_requested' ? 'Resubmit row' : 'Submit row'}
              </button>
            )}
            <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary h-11">Cancel</button>
            <button type="button" onClick={save} className="ui-btn ui-btn-primary h-11" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save row'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
