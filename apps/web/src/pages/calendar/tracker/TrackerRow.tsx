import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, ExternalLink, Lock, MoreHorizontal, Sparkles } from 'lucide-react';
import { formatShortDate, getCalendarDefinition, getStepStatusLabel } from '@mmp/shared';
import { Avatar } from '../../../components/Avatar';
import { TimeLabelChips } from '../../../components/TimeLabelChips';
import { statusClass, statusTone } from '../../../lib/statusTone';
import {
  approvalDateOf,
  currentStepOf,
  firstName,
  metricText,
  pipelineSlots,
  postingOwnerOf,
  sinceText,
  stateSince,
  turnaroundText,
  type TrackerPiece,
  type TrackerStage,
} from './trackerModel';

const STEP_NAME: Record<string, string> = { Content: 'Content', Script: 'Script', Shoot: 'Shoot', Edit: 'Edit', Design: 'Design', Post: 'Posting' };

interface Props {
  piece: TrackerPiece;
  now?: Date;
  canAssign: boolean;
  canManageSteps: boolean;
  onOpenTimeline: (p: TrackerPiece) => void;
  onAssign: (p: TrackerPiece) => void;
  onChangeDate: (p: TrackerPiece) => void;
  onToggleSkip: (pieceId: string, stageId: string, isSkipped: boolean) => void;
  onOpenPerson: (personId: string) => void;
}

/** One Tracker row: what it is (left), its steps in order (middle), where it stands and actions (right). */
export const TrackerRow: React.FC<Props> = ({ piece, now = new Date(), canAssign, canManageSteps, onOpenTimeline, onAssign, onChangeDate, onToggleSkip, onOpenPerson }) => {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cal = getCalendarDefinition(piece.calendar || piece.planId?.calendar);
  const current = currentStepOf(piece);
  const slots = pipelineSlots(piece);
  const notApproved = piece.stages.length === 0;
  const skippable = canManageSteps ? piece.stages.filter((s) => (!s.isLocked && s.status === 'Not Started') || s.isSkipped) : [];
  const postingOwner = postingOwnerOf(piece);
  const approvedOn = approvalDateOf(piece);
  const detailsId = `tracker-details-${piece._id}`;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  let stateLine = '';
  if (notApproved) stateLine = 'Not approved yet';
  else if (!current) stateLine = piece.publishedAt ? 'Posted' : 'All steps done';
  else {
    const since = sinceText(stateSince(current), now);
    stateLine = `${STEP_NAME[current.stageKey] || current.stageKey} · ${getStepStatusLabel(current.status)}${since ? ` ${since}` : ''}`;
  }

  const metrics: Array<[string, React.ReactNode]> = [
    ['Waiting', metricText(piece.waitingFormatted)],
    ['Work time', metricText(piece.workTimeFormatted)],
    ['Approval wait', metricText(piece.approvalWaitFormatted)],
    ['Late by', metricText(piece.lateByFormatted)],
    ['Approval', approvedOn ? formatShortDate(approvedOn, now) : '—'],
    ['Posting owner', postingOwner?.name || '—'],
    ['Turnaround', turnaroundText(piece.turnaroundDays)],
    ['Remarks', piece.remarks?.trim() || '—'],
  ];

  const stepChip = (stageKey: string, st: TrackerStage | null) => {
    if (!st) {
      return (
        <div className="tracker-step rounded-xl border border-dashed border-ui-line bg-white/30 opacity-70 p-2 flex md:flex-col gap-2 md:gap-1 items-center md:items-stretch" data-testid="tracker-step">
          <span className="text-xs font-semibold text-ui-muted min-w-[64px]">{STEP_NAME[stageKey] || stageKey}</span>
          <span className="text-[11px] text-ui-muted">Not needed</span>
        </div>
      );
    }
    const isCurrent = current?._id === st._id;
    const muted = st.isLocked || st.isSkipped;
    const tone = statusClass(statusTone(st.status, st.isLocked));
    return (
      <div
        className={`tracker-step rounded-xl p-2 flex md:flex-col gap-x-2 gap-y-1 flex-wrap md:flex-nowrap items-center md:items-stretch ${
          isCurrent ? 'border-2 border-ui-ink bg-white' : muted ? 'border border-dashed border-ui-line bg-white/40 opacity-75' : 'border border-ui-line bg-white/80'
        }`}
        data-testid="tracker-step"
        aria-current={isCurrent ? 'step' : undefined}
      >
        <span className="flex items-center gap-1 text-xs font-semibold text-ui-ink min-w-[64px]">
          {STEP_NAME[st.stageKey] || st.stageKey}
          {st.isLocked && <Lock className="w-3 h-3 text-ui-muted" aria-label="Locked" />}
        </span>
        <span className={`status-chip ${tone} text-[11px] self-start`}>{st.isSkipped ? 'Skipped' : getStepStatusLabel(st.status)}</span>
        {st.ownerId ? (
          <button
            type="button"
            onClick={() => onOpenPerson(st.ownerId!._id)}
            className="inline-flex items-center gap-1.5 min-h-[32px] text-[12px] text-ui-text hover:text-ui-ink text-left"
            title={st.ownerId.name}
          >
            <Avatar url={st.ownerId.avatarUrl} name={st.ownerId.name} userId={st.ownerId._id} size="xs" />
            <span className="truncate max-w-[96px]">{firstName(st.ownerId.name)}</span>
          </button>
        ) : (
          <span className="status-chip status-changes text-[11px] self-start">Needs owner</span>
        )}
        <span className="text-[12px] text-ui-muted">Due {formatShortDate(st.dueDate, now) || '—'}</span>
        <TimeLabelChips labels={st.timeLabels} showOnTime={false} />
      </div>
    );
  };

  return (
    <li className="glass-card rounded-ui-card p-4" data-testid="tracker-row">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[260px_minmax(0,1fr)_220px]">
        {/* Left: what it is */}
        <div className="min-w-0 md:col-start-1 md:row-start-1">
          <button
            type="button"
            onClick={() => onOpenTimeline(piece)}
            className="text-left text-sm font-bold text-ui-ink line-clamp-2 hover:underline underline-offset-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
            title={piece.topic}
          >
            {piece.topic}
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="status-chip status-not-started text-[11px]">{piece.workflowLabel || piece.contentType}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-ui-line bg-white/70 text-ui-text">
              <span className={`cal-dot cal-${cal.key}`} aria-hidden="true" />
              {cal.name}
            </span>
            {piece.planId?.code && <span className="text-ui-muted">{piece.planId.code}</span>}
          </div>
          {(piece.projectLabel || piece.priority === 'Urgent' || notApproved) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {piece.projectLabel && (
                <span className={`status-chip ${piece.projectLabel.kind === 'overdue' ? 'status-blocked' : 'status-changes'} text-[11px] font-semibold`} data-testid="tracker-project-label">
                  {piece.projectLabel.kind === 'overdue' ? `Project ${piece.projectLabel.text.toLowerCase()}` : piece.projectLabel.text}
                </span>
              )}
              {piece.priority === 'Urgent' && <span className="status-chip status-blocked text-[11px] font-semibold">Urgent</span>}
              {notApproved && <span className="status-chip status-waiting text-[11px]">Not approved yet</span>}
            </div>
          )}
        </div>

        {/* Middle: the steps in order */}
        <div className="min-w-0 md:col-span-2 md:row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
          {slots.length === 0 ? (
            <p className="text-sm text-ui-muted">Steps are created when the row is approved.</p>
          ) : (
            <ol className="flex flex-col md:flex-row md:items-stretch gap-2 md:overflow-x-auto md:pb-1" aria-label={`Steps for ${piece.topic}`}>
              {slots.map(({ stageKey, stage }, i) => (
                <li key={stage?._id || stageKey} className="flex md:items-stretch gap-2 md:w-[168px] md:shrink-0">
                  <div className="flex-1 min-w-0 md:h-full [&>div]:md:h-full">{stepChip(stageKey, stage)}</div>
                  {i < slots.length - 1 && <ChevronRight className="hidden md:block w-4 h-4 self-center text-ui-muted shrink-0 -mr-1" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Right: where it stands, and actions */}
        <div className="md:col-start-2 md:row-start-1 lg:col-start-3 flex flex-col gap-1.5 text-sm">
          <div>
            <span className="text-[11px] text-ui-muted block">Publish date</span>
            <span className="font-semibold text-ui-ink">{formatShortDate(piece.postingDate, now)}</span>
          </div>
          <span className="text-[13px] text-ui-text" data-testid="tracker-state">{stateLine}</span>
          {piece.liveUrl ? (
            <a href={piece.liveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ui-ink underline underline-offset-2 self-start min-h-[32px]">
              Live <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span className="text-[13px] text-ui-muted">Unpublished</span>
          )}
          {(canAssign || canManageSteps) && !notApproved && (
            <div className="flex items-center gap-1.5 pt-1">
              {canAssign && (
                <button type="button" onClick={() => onAssign(piece)} className="ui-icon-btn h-11 w-11" aria-label={`Assign owners: ${piece.topic}`} title="Assign owners">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
              {canManageSteps && (
                <button type="button" onClick={() => onChangeDate(piece)} className="ui-icon-btn h-11 w-11" aria-label={`Change publish date: ${piece.topic}`} title="Change publish date">
                  <CalendarClock className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
              {skippable.length > 0 && (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    className="ui-icon-btn h-11 w-11"
                    aria-label={`More actions: ${piece.topic}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                  </button>
                  {menuOpen && (
                    <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-ui-card shell-menu bg-white/95 border border-ui-line shadow-xl p-1">
                      {skippable.map((s) => (
                        <button
                          key={s._id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            onToggleSkip(piece._id, s._id, s.isSkipped);
                          }}
                          className="w-full text-left px-3 min-h-[44px] text-[13px] text-ui-text hover:bg-slate-100/80 rounded-lg"
                        >
                          {s.isSkipped ? 'Restore' : 'Skip'} {STEP_NAME[s.stageKey] || s.stageKey} step
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="mt-3 inline-flex items-center gap-1 min-h-[44px] text-[13px] font-semibold text-ui-text hover:text-ui-ink"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        {expanded ? 'Hide details' : 'Details'}
      </button>
      {expanded && (
        <dl id={detailsId} className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 pt-2 border-t border-ui-line text-[13px]" data-testid="tracker-details">
          {metrics.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] text-ui-muted">{label}</dt>
              <dd className="text-ui-ink break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
};
