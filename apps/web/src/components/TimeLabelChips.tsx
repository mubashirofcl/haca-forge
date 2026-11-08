import React from 'react';

export interface TimeLabel {
  kind: string;
  text: string;
  days?: number;
}

/** Tone per computed time label, using the shared status-chip colours. */
const TONE: Record<string, string> = {
  overdue: 'status-blocked',
  blocked: 'status-blocked',
  done_late: 'status-changes',
  late_earlier_step: 'status-waiting',
  waiting_earlier_step_late: 'status-waiting',
  done_on_time: 'status-approved',
};

/**
 * The computed time labels of a step (Phase 7): Overdue, Done N days late, Done on time,
 * Late: earlier step, Waiting: earlier step late, Blocked N days. "Done on time" is hidden
 * unless `showOnTime`, so lists stay quiet when nothing is wrong.
 */
export const TimeLabelChips: React.FC<{ labels?: TimeLabel[] | null; showOnTime?: boolean; className?: string }> = ({
  labels,
  showOnTime = true,
  className = '',
}) => {
  const shown = (labels || []).filter((l) => showOnTime || l.kind !== 'done_on_time');
  if (!shown.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`} data-testid="time-labels">
      {shown.map((l) => (
        <span key={l.kind} className={`status-chip ${TONE[l.kind] || 'status-not-started'} text-[11px] font-semibold whitespace-nowrap`} data-kind={l.kind}>
          {l.text}
        </span>
      ))}
    </span>
  );
};
