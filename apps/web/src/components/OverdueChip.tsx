import React from 'react';
import { formatOverdue, overdueDays } from '@mmp/shared';

/** "Overdue by 8 days" for a deadline. Whole calendar days, the same count as "Late by". */
export function overdueLabel(deadline?: string | Date | null): string {
  return deadline ? formatOverdue(overdueDays(deadline)) : 'Overdue';
}

/** The one way to show an overdue item. Spacing and size can be adjusted with `className`. */
export const OverdueChip: React.FC<{ deadline?: string | Date | null; className?: string }> = ({ deadline, className = '' }) => (
  <span className={`status-chip status-blocked text-[11px] font-semibold whitespace-nowrap ${className}`}>{overdueLabel(deadline)}</span>
);
