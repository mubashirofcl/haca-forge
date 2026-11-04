import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, Clock, AlertTriangle, RotateCcw } from 'lucide-react';
import { type StageKey, type WorkItemStatus, getStepStatusLabel } from '@mmp/shared';
import { statusClass, statusTone } from '../lib/statusTone';

export interface PipelineStageItem {
  _id?: string;
  stageKey: StageKey | string;
  stageOrder?: number;
  status?: WorkItemStatus | string;
  isLocked?: boolean;
  isSkipped?: boolean;
  ownerId?: { _id?: string; name?: string; email?: string; jobRole?: string } | null;
  title?: string;
  deadline?: string;
  revisions?: number;
}

interface PipelineStepperProps {
  stages: PipelineStageItem[];
  currentStageKey?: string | null;
  currentStageId?: string;
  status: WorkItemStatus | string;
  blockerReason?: string | null;
  revisions?: number;
}

type StageState = 'current' | 'done' | 'changes' | 'blocked' | 'locked' | 'upcoming';

/** How the line leading INTO a stage is drawn. */
type LinkState = 'done' | 'attention' | 'idle';

const STATE_TEXT: Record<StageState, string> = {
  current: 'Current step',
  done: 'Done',
  changes: 'Changes requested',
  blocked: 'Blocked',
  locked: 'Locked',
  upcoming: 'Not started',
};

/**
 * One connector between two stage cards: a thin line with a small node at each
 * end. Horizontal from md up, vertical below. Blue = completed hand-off,
 * coral dashed = changes requested / blocked, hairline grey = not reached yet.
 */
const Connector: React.FC<{ state: LinkState }> = ({ state }) => {
  const line =
    state === 'done'
      ? 'border-ui-blue border-solid'
      : state === 'attention'
      ? 'border-ui-coral border-dashed'
      : 'border-ui-line border-solid';
  const node =
    state === 'done' ? 'bg-ui-blue' : state === 'attention' ? 'bg-ui-coral' : 'bg-ui-canvas-deep';
  return (
    <div
      aria-hidden="true"
      className="relative shrink-0 h-6 w-full md:absolute md:right-full md:inset-y-0 md:h-auto md:w-7 lg:w-12"
    >
      {/* vertical (mobile) */}
      <span className={`md:hidden absolute left-[17px] top-0 bottom-0 border-l-[1.5px] ${line}`} />
      <span className={`md:hidden absolute left-[14px] -top-[3px] w-[7px] h-[7px] rounded-full ring-2 ring-white ${node}`} />
      <span className={`md:hidden absolute left-[14px] -bottom-[3px] w-[7px] h-[7px] rounded-full ring-2 ring-white ${node}`} />
      {/* horizontal (md+) */}
      <span className={`hidden md:block absolute left-0 right-0 top-1/2 border-t-[1.5px] ${line}`} />
      <span className={`hidden md:block absolute -left-[4px] top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full ring-2 ring-white ${node}`} />
      <span className={`hidden md:block absolute -right-[4px] top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full ring-2 ring-white ${node}`} />
    </div>
  );
};

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  stages,
  currentStageKey,
  currentStageId,
  status,
  blockerReason,
}) => {
  const navigate = useNavigate();
  if (!stages || stages.length === 0) {
    return null;
  }

  // Find index of current stage
  const currentIndex = stages.findIndex(
    (s) =>
      (currentStageId && s._id === currentStageId) ||
      (currentStageKey && s.stageKey?.toLowerCase() === currentStageKey?.toLowerCase())
  );

  const view = stages.map((st, idx) => {
    const isCurrent =
      (currentStageId && st._id === currentStageId) ||
      (currentIndex !== -1 ? idx === currentIndex : st.stageKey === currentStageKey);

    const isPassed =
      st.status === 'Approved' ||
      st.status === 'Published' ||
      (currentIndex !== -1 && idx < currentIndex && st.status !== 'Blocked');

    const state: StageState = isCurrent
      ? 'current'
      : st.status === 'Blocked'
      ? 'blocked'
      : st.status === 'Feedback'
      ? 'changes'
      : isPassed
      ? 'done'
      : st.isLocked
      ? 'locked'
      : 'upcoming';

    const canNavigate = Boolean(st._id && st._id !== currentStageId);
    return { st, idx, isCurrent: Boolean(isCurrent), isPassed, state, canNavigate };
  });

  const linkInto = (i: number): LinkState => {
    const target = view[i];
    if (target.st.status === 'Blocked' || target.st.status === 'Feedback') return 'attention';
    return view[i - 1].isPassed ? 'done' : 'idle';
  };

  const tone = statusTone(status);
  const chip = `status-chip ${statusClass(tone)} px-3 py-1 text-xs font-semibold`;

  return (
    <div className="space-y-4">
      {/* Status chip header (Pending and Blocked are chips, NOT steps) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ui-text">Steps</h3>
        <div className="flex items-center gap-2 min-w-0">
          {status === 'Pending' && (
            <span className={chip}>
              <Clock className="w-3.5 h-3.5" />
              Waiting for approval
            </span>
          )}
          {status === 'Blocked' && (
            <span className={`${chip} min-w-0`}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Blocked: {blockerReason || 'Waiting on resolution'}</span>
            </span>
          )}
          {status === 'In Progress' && <span className={chip}>In progress</span>}
          {status === 'Feedback' && (
            <span className={chip}>
              <RotateCcw className="w-3.5 h-3.5" />
              {getStepStatusLabel(status)}
            </span>
          )}
          {status === 'Approved' && (
            <span className={chip}>
              <Check className="w-3.5 h-3.5" />
              Approved
            </span>
          )}
          {status === 'Published' && (
            <span className={chip}>
              <Check className="w-3.5 h-3.5" />
              Published
            </span>
          )}
        </div>
      </div>

      {/* Stage cards joined by connectors. Scrolls sideways on md+ when there are many stages. */}
      <ol
        className="relative flex flex-col md:grid md:gap-x-7 lg:gap-x-12 md:overflow-x-auto no-scrollbar md:-mx-2 md:px-2 md:-my-5 md:py-5"
        style={{ gridTemplateColumns: `repeat(${view.length}, minmax(140px, 1fr))` }}
      >
        {view.map(({ st, idx, isCurrent, state, canNavigate }) => {
          const cardTone =
            state === 'current'
              ? 'bg-ui-ink text-white shadow-[0_10px_20px_-12px_rgba(11,11,13,0.55)]'
              : state === 'done'
              ? 'bg-white text-ui-text shadow-ui-card'
              : state === 'changes'
              ? 'bg-white text-ui-text shadow-ui-card ring-1 ring-inset ring-ui-coral'
              : state === 'blocked'
              ? 'bg-ui-coral-soft text-ui-text ring-1 ring-inset ring-ui-coral'
              : 'bg-transparent text-ui-muted ring-1 ring-inset ring-ui-line';

          const metaTone = state === 'current' ? 'text-white/70' : 'text-ui-muted';

          const marker =
            state === 'locked' ? (
              <Lock className="w-3.5 h-3.5" />
            ) : state === 'done' ? (
              <span className="w-5 h-5 rounded-full bg-ui-blue-soft text-ui-ink flex items-center justify-center">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            ) : state === 'changes' ? (
              <RotateCcw className="w-3.5 h-3.5 text-ui-ink" />
            ) : state === 'blocked' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-ui-ink" />
            ) : state === 'current' ? (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            ) : null;

          const body = (
            <>
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium">
                <span className={`whitespace-nowrap ${metaTone}`}>Step {idx + 1}</span>
                <span className="flex items-center gap-1.5">
                  {typeof st.revisions === 'number' && st.revisions > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                        isCurrent ? 'bg-white/15 text-white' : 'status-chip status-changes'
                      }`}
                      title={`${st.revisions} rework cycle${st.revisions > 1 ? 's' : ''}`}
                    >
                      {st.revisions} rev
                    </span>
                  )}
                  {marker}
                </span>
              </div>

              <div className={`text-sm font-semibold truncate ${state === 'upcoming' || state === 'locked' ? 'text-ui-text' : ''}`}>
                {st.stageKey}
              </div>

              <div
                className={`text-xs leading-snug line-clamp-2 break-words ${metaTone}`}
                title={st.ownerId?.name || 'Unassigned'}
              >
                {st.ownerId?.name || 'Unassigned'}
              </div>
              <span className="sr-only">{STATE_TEXT[state]}</span>
            </>
          );

          const cardClass = `relative w-full h-full text-left p-3.5 rounded-[20px] flex flex-col gap-1.5 ${cardTone}`;

          return (
            <li
              key={st._id || `${st.stageKey}-${idx}`}
              className="relative flex flex-col"
            >
              {idx > 0 && <Connector state={linkInto(idx)} />}
              {canNavigate ? (
                <button
                  type="button"
                  onClick={() => navigate(`/work/${st._id}`)}
                  className={`${cardClass} transition-colors hover:brightness-[1.03] hover:ring-1 hover:ring-inset hover:ring-ui-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2`}
                >
                  {body}
                </button>
              ) : (
                <div className={cardClass} aria-current={isCurrent ? 'step' : undefined}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
