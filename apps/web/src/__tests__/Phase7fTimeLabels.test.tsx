import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const calls: string[] = [];
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    calls.push(url);
    return {
      data: [
        {
          _id: 'w1', title: 'Reel Script', workType: 'Reel', deadline: '2026-11-01T00:00:00.000Z', estimatedEffortHrs: 1, status: 'In Progress', revisions: 0,
          timeLabels: [{ kind: 'overdue', text: 'Overdue by 7 days', days: 7 }, { kind: 'late_earlier_step', text: 'Late: earlier step' }],
        },
        {
          _id: 'w2', title: 'Reel Edit', workType: 'Reel', deadline: '2026-11-01T00:00:00.000Z', estimatedEffortHrs: 1, status: 'Approved', revisions: 0,
          timeLabels: [{ kind: 'done_on_time', text: 'Done on time' }],
        },
      ],
    };
  }),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1', role: 'creative_head' }, hasPermission: () => true }) }));

import { TimeLabelChips } from '../components/TimeLabelChips';
import { WorkListPage } from '../pages/work/WorkListPage';

afterEach(() => {
  cleanup();
  calls.length = 0;
});

describe('Time label chips', () => {
  it('shows each label with its tone', () => {
    render(
      <TimeLabelChips
        labels={[
          { kind: 'overdue', text: 'Overdue by 2 days' },
          { kind: 'waiting_earlier_step_late', text: 'Waiting: earlier step late' },
          { kind: 'blocked', text: 'Blocked 3 days' },
        ]}
      />
    );
    expect(screen.getByText('Overdue by 2 days')).toHaveClass('status-blocked');
    expect(screen.getByText('Waiting: earlier step late')).toHaveClass('status-waiting');
    expect(screen.getByText('Blocked 3 days')).toHaveClass('status-blocked');
  });

  it('can hide "Done on time" and renders nothing without labels', () => {
    const { container } = render(<TimeLabelChips labels={[{ kind: 'done_on_time', text: 'Done on time' }]} showOnTime={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Work Items', () => {
  it('shows the labels and filters by Overdue, Done late and Blocked', async () => {
    render(
      <MemoryRouter>
        <WorkListPage />
      </MemoryRouter>
    );
    expect(await screen.findAllByText('Overdue by 7 days')).not.toHaveLength(0);
    expect(screen.getAllByText('Late: earlier step').length).toBeGreaterThan(0);
    expect(screen.queryByText('Done on time')).toBeNull();
    fireEvent.click(screen.getByTestId('work-filter-done_late'));
    await waitFor(() => expect(calls.some((u) => u.includes('timeLabel=done_late'))).toBe(true));
    fireEvent.click(screen.getByTestId('work-filter-blocked'));
    await waitFor(() => expect(calls.some((u) => u.includes('timeLabel=blocked'))).toBe(true));
  });
});

describe('Priority (Phase 7 close-out)', () => {
  it('shows only Normal and Urgent; an older stored value shows as Normal', async () => {
    const { apiFetch } = await import('../lib/api');
    vi.mocked(apiFetch).mockImplementationOnce(async () => ({
      data: [
        { _id: 'p1', title: 'Old high', workType: 'Reel', deadline: '2026-11-20T00:00:00.000Z', estimatedEffortHrs: 1, status: 'In Progress', revisions: 0, priority: 'High' },
        { _id: 'p2', title: 'Urgent one', workType: 'Reel', deadline: '2026-11-21T00:00:00.000Z', estimatedEffortHrs: 1, status: 'In Progress', revisions: 0, priority: 'Urgent' },
      ],
    }) as never);
    render(
      <MemoryRouter>
        <WorkListPage />
      </MemoryRouter>
    );
    const chips = await screen.findAllByTestId('priority-chip');
    const texts = chips.map((c) => c.textContent);
    expect(texts).toContain('Normal');
    expect(texts).toContain('Urgent');
    expect(texts.some((t) => /High|Medium|Low/.test(t || ''))).toBe(false);
  });
});
