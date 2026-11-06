import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clapperboard, FileText, Lock, Palette, PenLine, Send, UserRound, Video, type LucideIcon } from 'lucide-react';
import { overdueDays, type StageKey, type WorkItemStatus, getStepStatusLabel } from '@mmp/shared';
import { statusClass, statusTone, type StatusTone } from '../lib/statusTone';
import { Avatar } from './Avatar';

export interface PipelineStageItem {
  _id?: string;
  stageKey: StageKey | string;
  stageOrder?: number;
  status?: WorkItemStatus | string;
  isLocked?: boolean;
  isSkipped?: boolean;
  ownerId?: { _id?: string; name?: string; email?: string; jobRole?: string; avatarUrl?: string | null } | null;
  title?: string;
  deadline?: string;
  revisions?: number;
  startedAt?: string | null;
  submittedAt?: string | null;
  resubmittedAt?: string | null;
  approvedAt?: string | null;
  postedAt?: string | null;
}

interface PipelineStepperProps {
  stages: PipelineStageItem[];
  currentStageKey?: string | null;
  currentStageId?: string;
  status: WorkItemStatus | string;
  blockerReason?: string | null;
  revisions?: number;
}

const STAGE_ICON: Record<string, LucideIcon> = {
  Content: PenLine,
  Script: FileText,
  Design: Palette,
  Shoot: Video,
  Edit: Clapperboard,
  Post: Send,
};

/** The gap between cards, and so the length of an arrow. Matches md:gap-x-10. */
const GAP = 40;
/** The length of an arrow between stacked cards on phones. */
const STACK_GAP = 28;

type EdgeState = 'done' | 'active' | 'attention' | 'idle';
const EDGE_TONE: Record<EdgeState, StatusTone> = { done: 'approved', active: 'in-progress', attention: 'changes', idle: 'not-started' };

const isDone = (s: PipelineStageItem) => s.status === 'Approved' || s.status === 'Published';
const isPassed = (s: PipelineStageItem) => isDone(s) || Boolean(s.isSkipped);
const toneOf = (s: PipelineStageItem): StatusTone => (s.isSkipped ? 'locked' : statusTone(s.status, s.isLocked));
const labelOf = (s: PipelineStageItem) => (s.isSkipped ? 'Skipped' : s.isLocked && !isDone(s) ? 'Locked' : getStepStatusLabel(s.status || 'Not Started'));

/** The line INTO a step: the colour says what happened at that hand-off. */
function edgeInto(prev: PipelineStageItem, next: PipelineStageItem): EdgeState {
  if (next.status === 'Blocked' || next.status === 'Feedback') return 'attention';
  if (!isPassed(prev)) return 'idle';
  if (next.status === 'In Progress' || next.status === 'Pending') return 'active';
  return isDone(next) ? 'done' : 'idle';
}

const formatWhen = (v?: string | null) =>
  v
    ? new Date(v)
        .toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
        .replace(/\b(am|pm)\b/, (m) => m.toUpperCase())
    : null;
const formatDay = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

/** Arrow from one step to the next. Dashed means the hand-off has not happened or needs attention. */
const EdgeArrow: React.FC<{ state: EdgeState; vertical?: boolean }> = ({ state, vertical }) => {
  const dashed = state === 'idle' || state === 'attention';
  const length = vertical ? STACK_GAP : GAP;
  return (
    <svg
      aria-hidden="true"
      data-edge={vertical ? undefined : state}
      width={vertical ? 12 : length}
      height={vertical ? length : 12}
      viewBox={vertical ? `0 0 12 ${length}` : `0 0 ${length} 12`}
      className={`flow-edge ${statusClass(EDGE_TONE[state])} pointer-events-none ${
        vertical ? 'md:hidden block mx-auto' : 'hidden md:block absolute top-1/2 -translate-y-1/2 right-full'
      }`}
    >
      {vertical ? (
        <>
          <line x1={6} y1={3} x2={6} y2={length - 4} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={dashed ? '3 4' : undefined} />
          <path d={`M 2 ${length - 8} L 6 ${length - 3} L 10 ${length - 8}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <line x1={3} y1={6} x2={length - 4} y2={6} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={dashed ? '3 4' : undefined} />
          <path d={`M ${length - 8} 2 L ${length - 3} 6 L ${length - 8} 10`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 text-xs">
    <span className="text-ui-muted shrink-0">{label}</span>
    <span className={`text-right min-w-0 ${value ? 'font-medium text-ui-ink' : 'text-ui-muted'}`}>{value || '–'}</span>
  </div>
);

export const PipelineStepper: React.FC<PipelineStepperProps> = ({ stages, currentStageKey, currentStageId, status, blockerReason }) => {
  const navigate = useNavigate();
  if (!stages || stages.length === 0) return null;

  const currentIndex = stages.findIndex(
    (s) => (currentStageId && s._id === currentStageId) || (currentStageKey && s.stageKey?.toLowerCase() === currentStageKey?.toLowerCase())
  );

  const doneCount = stages.filter(isPassed).length;
  const allDone = doneCount === stages.length;
  const times = (pick: (s: PipelineStageItem) => string | null | undefined) =>
    stages.map(pick).filter(Boolean).map((v) => new Date(v as string).getTime());
  const started = times((s) => s.startedAt);
  const finished = times((s) => s.postedAt || s.approvedAt);
  const firstStart = started.length ? new Date(Math.min(...started)).toISOString() : null;
  const lastFinish = allDone && finished.length ? new Date(Math.max(...finished)).toISOString() : null;
  const hasBegun = doneCount > 0 || stages.some((s) => s.status && s.status !== 'Not Started');
  const finalDeadline = stages[stages.length - 1]?.deadline;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-ui-ink">Workflow</h3>
            {status === 'Blocked' && (
              <span className={`status-chip ${statusClass(statusTone(status))} text-[11px] font-semibold min-w-0`}>
                <span className="truncate">Blocked: {blockerReason || 'Waiting on resolution'}</span>
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 max-w-sm">
            <div
              role="progressbar"
              aria-label="Steps finished"
              aria-valuemin={0}
              aria-valuemax={stages.length}
              aria-valuenow={doneCount}
              className="flex-1 h-1.5 rounded-full bg-ui-line overflow-hidden"
            >
              <div className="h-full rounded-full status-approved status-dot" style={{ width: `${(doneCount / stages.length) * 100}%` }} />
            </div>
            <span className="text-xs text-ui-muted whitespace-nowrap">
              {doneCount} of {stages.length} steps done
            </span>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <div>
            <dt className="text-ui-muted">Started</dt>
            <dd className="font-medium text-ui-ink mt-0.5">{formatWhen(firstStart) || (hasBegun ? 'Not recorded' : 'Not started')}</dd>
          </div>
          <div>
            <dt className="text-ui-muted">Finished</dt>
            <dd className="font-medium text-ui-ink mt-0.5">{formatWhen(lastFinish) || (allDone ? 'Not recorded' : 'Not finished')}</dd>
          </div>
          <div>
            <dt className="text-ui-muted">Final deadline</dt>
            <dd className="font-medium text-ui-ink mt-0.5">{formatDay(finalDeadline) || '–'}</dd>
          </div>
        </dl>
      </div>

      {/* Flow. Scrolls inside itself on wide screens when there are many steps. */}
      <div className="overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        <ol
          className="flex flex-col md:grid md:gap-x-10 pt-6"
          aria-label="Workflow steps"
          style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(216px, 1fr))` }}
        >
          {stages.map((st, idx) => {
            const viewing = idx === currentIndex || (currentStageId ? st._id === currentStageId : false);
            const canNavigate = Boolean(st._id && st._id !== currentStageId);
            const edge = idx > 0 ? edgeInto(stages[idx - 1], st) : null;
            const tone = toneOf(st);
            const Icon = STAGE_ICON[String(st.stageKey)] || FileText;
            const lastSubmit = st.resubmittedAt || st.submittedAt;
            const finish = st.postedAt || st.approvedAt;
            const late = st.deadline && !isDone(st) && !st.isSkipped ? overdueDays(st.deadline) : 0;
            const locked = st.isLocked && !isDone(st);
            const owner = st.ownerId;

            return (
              <li key={st._id || `${st.stageKey}-${idx}`} className="relative flex flex-col">
                {edge && <EdgeArrow state={edge} vertical />}
                <div className="relative h-full">
                  {idx === 0 && <span className="absolute -top-6 left-1 text-xs font-semibold text-ui-ink">Start</span>}
                  {idx === stages.length - 1 && stages.length > 1 && <span className="absolute -top-6 right-1 text-xs font-semibold text-ui-ink">End</span>}
                  {edge && <EdgeArrow state={edge} />}
                  <div
                    aria-current={viewing ? 'step' : undefined}
                    className={`flow-node ${statusClass(tone)} relative flex flex-col h-full rounded-2xl overflow-hidden bg-white shadow-ui-card ${
                      viewing ? 'ring-2 ring-ui-ink' : ''
                    } ${canNavigate ? 'transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-within:ring-2 focus-within:ring-ui-ink' : ''}`}
                  >
                    <div className="flow-head flex items-center justify-between gap-2 px-4 py-2 text-[11px] font-semibold">
                      <span className="shrink-0">Step {idx + 1}</span>
                      <span className="inline-flex items-center gap-1.5 min-w-0 text-right" data-step-status>
                        {isDone(st) ? (
                          <Check className="w-3 h-3 stroke-[3] shrink-0" aria-hidden="true" />
                        ) : locked ? (
                          <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                        ) : (
                          <span aria-hidden="true" className="w-2 h-2 rounded-full status-dot shrink-0" />
                        )}
                        {labelOf(st)}
                      </span>
                    </div>

                    <div className="flex flex-col flex-1 p-4 gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-ui-canvas flex items-center justify-center shrink-0 text-ui-ink">
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        {canNavigate ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/work/${st._id}`)}
                            aria-label={`Open ${st.stageKey} step`}
                            className="min-w-0 flex-1 text-left text-sm font-semibold text-ui-ink truncate focus:outline-none after:absolute after:inset-0 after:content-['']"
                          >
                            {st.stageKey}
                          </button>
                        ) : (
                          <span className="min-w-0 flex-1 text-sm font-semibold text-ui-ink truncate">{st.stageKey}</span>
                        )}
                        {viewing && <span className="status-chip status-posted text-[11px] font-semibold shrink-0">Viewing</span>}
                      </div>

                      <div className="flex items-center gap-2.5 min-w-0 rounded-xl bg-ui-canvas/50 p-2">
                        {owner?.name ? (
                          <span aria-hidden="true" className="inline-flex shrink-0">
                            <Avatar url={owner.avatarUrl} name={owner.name} userId={owner._id} size="sm" className="!w-8 !h-8 !min-w-[32px]" />
                          </span>
                        ) : (
                          <span aria-hidden="true" className="w-8 h-8 rounded-full bg-ui-canvas flex items-center justify-center shrink-0 text-ui-muted">
                            <UserRound className="w-4 h-4" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className={`block text-xs font-semibold truncate ${owner?.name ? 'text-ui-ink' : 'text-ui-muted'}`}>{owner?.name || 'Unassigned'}</span>
                          {owner?.jobRole && <span className="block text-[11px] text-ui-muted truncate">{owner.jobRole}</span>}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <Row label="Started" value={formatWhen(st.startedAt)} />
                        {st.stageKey !== 'Post' && <Row label={st.resubmittedAt ? 'Resubmitted' : 'Submitted'} value={formatWhen(lastSubmit)} />}
                        <Row label={st.stageKey === 'Post' ? 'Posted' : 'Approved'} value={formatWhen(finish)} />
                      </div>

                      <div className="mt-auto pt-3 border-t border-ui-line space-y-1.5">
                        <Row
                          label="Deadline"
                          value={
                            st.deadline ? (
                              <>
                                {formatDay(st.deadline)}
                                {late > 0 && (
                                  <span className={`block text-[11px] font-semibold ${statusClass('changes')}`} style={{ color: 'var(--st-fg)' }}>
                                    {late} {late === 1 ? 'day' : 'days'} late
                                  </span>
                                )}
                              </>
                            ) : null
                          }
                        />
                        {typeof st.revisions === 'number' && st.revisions > 0 && <Row label="Revisions" value={st.revisions} />}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* What the colours mean */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ui-muted" aria-label="Colour key">
        {(
          [
            ['posted', 'Published'],
            ['approved', 'Done'],
            ['in-progress', 'In progress'],
            ['waiting', 'Waiting for approval'],
            ['changes', 'Changes requested or blocked'],
            ['not-started', 'Not started'],
          ] as [StatusTone, string][]
        ).map(([t, label]) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`w-2 h-2 rounded-full status-dot ${statusClass(t)}`} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
};
