import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, Clock, AlertTriangle } from 'lucide-react';
import { type StageKey, type WorkItemStatus, getStepStatusLabel } from '@mmp/shared';

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

  return (
    <div className="space-y-3">
      {/* Status Chips Header (Pending and Blocked are chips, NOT steps) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Steps</h3>
        <div className="flex items-center gap-2">
          {status === 'Pending' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Waiting for approval
            </span>
          )}
          {status === 'Blocked' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Blocked: {blockerReason || 'Waiting on resolution'}
            </span>
          )}
          {status === 'In Progress' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              In progress
            </span>
          )}
          {status === 'Feedback' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {getStepStatusLabel(status)}
            </span>
          )}
          {status === 'Approved' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Approved
            </span>
          )}
          {status === 'Published' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-600 text-white shadow-xs flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Published
            </span>
          )}
        </div>
      </div>

      {/* Step Nodes Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {stages.map((st, idx) => {
          const isCurrent =
            (currentStageId && st._id === currentStageId) ||
            (currentIndex !== -1 ? idx === currentIndex : st.stageKey === currentStageKey);

          const isPassed =
            st.status === 'Approved' ||
            st.status === 'Published' ||
            (currentIndex !== -1 && idx < currentIndex && st.status !== 'Blocked');

          const canNavigate = Boolean(st._id && st._id !== currentStageId);

          return (
            <div
              key={st._id || `${st.stageKey}-${idx}`}
              onClick={() => {
                if (canNavigate) {
                  navigate(`/work/${st._id}`);
                }
              }}
              className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between gap-1.5 ${
                canNavigate ? 'cursor-pointer hover:border-indigo-400 hover:shadow-sm' : ''
              } ${
                isCurrent
                  ? 'bg-slate-900 text-white font-extrabold border-slate-900 shadow-md ring-2 ring-purple-500/20'
                  : isPassed
                  ? 'bg-emerald-50/80 text-emerald-900 font-bold border-emerald-200'
                  : st.isLocked
                  ? 'bg-slate-50 text-slate-400 border-slate-100 opacity-75'
                  : 'bg-white text-slate-700 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className={isCurrent ? 'text-purple-300' : isPassed ? 'text-emerald-700' : 'text-slate-400'}>
                  Step {idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  {typeof st.revisions === 'number' && st.revisions > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${
                        isCurrent
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                      title={`${st.revisions} rework cycle${st.revisions > 1 ? 's' : ''}`}
                    >
                      {st.revisions} rev
                    </span>
                  )}
                  {st.isLocked ? (
                    <Lock className="w-3 h-3 text-slate-400" />
                  ) : isPassed ? (
                    <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  ) : null}
                </div>
              </div>

              <div className="text-xs truncate font-extrabold">{st.stageKey}</div>

              <div
                className={`text-[10px] truncate ${
                  isCurrent ? 'text-slate-300' : isPassed ? 'text-emerald-700' : 'text-slate-400'
                }`}
                title={st.ownerId?.name || 'Unassigned'}
              >
                {st.ownerId?.name || 'Unassigned'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
