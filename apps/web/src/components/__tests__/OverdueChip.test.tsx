import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { overdueDays, formatOverdue } from '@mmp/shared';
import { OverdueChip, overdueLabel } from '../OverdueChip';

afterEach(() => vi.useRealTimers());

describe('overdue days', () => {
  it('counts whole calendar days, ignoring the time of day', () => {
    expect(overdueDays(new Date(2031, 10, 1, 23, 59), new Date(2031, 10, 9, 0, 1))).toBe(8);
    expect(overdueDays(new Date(2031, 10, 8, 23, 59), new Date(2031, 10, 9, 0, 1))).toBe(1);
    expect(overdueDays(new Date(2031, 10, 9, 0, 1), new Date(2031, 10, 9, 23, 0))).toBe(0);
  });

  it('crosses month and year ends, and never goes negative', () => {
    expect(overdueDays(new Date(2030, 11, 30), new Date(2031, 0, 2))).toBe(3);
    expect(overdueDays(new Date(2031, 11, 25), new Date(2031, 10, 9))).toBe(0);
  });

  it('words the count', () => {
    expect(formatOverdue(0)).toBe('Overdue today');
    expect(formatOverdue(1)).toBe('Overdue by 1 day');
    expect(formatOverdue(8)).toBe('Overdue by 8 days');
  });

  it('the chip shows the days for its deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2031, 10, 9, 12));
    render(<OverdueChip deadline={new Date(2031, 10, 1)} />);
    expect(screen.getByText('Overdue by 8 days')).toHaveClass('status-chip', 'status-blocked');
    expect(overdueLabel(null)).toBe('Overdue');
  });
});
