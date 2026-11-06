import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CalendarPage } from '../CalendarPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => mockNavigate }));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'sm_manager', name: 'Sam' }, hasPermission: () => true }),
}));

let items: any[] = [];
vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => (url.startsWith('/api/work/calendar') ? { data: items } : { data: [] })),
}));

// Mid-month today, so every entry lands in the month on screen.
const now = new Date();
const day = (d: number) => new Date(now.getFullYear(), now.getMonth(), d, 12).toISOString();
const base = { workType: 'Poster', calendar: 'sm', deadline: day(15), estimatedEffortHrs: 2, priority: 'normal' };

const show = async () => {
  render(
    <MemoryRouter initialEntries={['/calendar']}>
      <CalendarPage />
    </MemoryRouter>
  );
  return (await screen.findByText('Approved entry')).closest('button') as HTMLElement;
};

beforeEach(() => {
  mockNavigate.mockClear();
  items = [
    { ...base, _id: 'a', title: 'Approved entry', status: 'Approved' },
    { ...base, _id: 'b', title: 'Individual entry', status: 'In Progress', isIndividual: true },
    { ...base, _id: 'c', title: 'Locked entry', status: 'Not Started', isLocked: true },
  ];
});

describe('Calendar entries', () => {
  it('colours each entry by its status and says the status in words', async () => {
    const approved = await show();
    expect(approved).toHaveClass('cal-chip', 'status-approved');
    const individual = screen.getByText('Individual entry').closest('button')!;
    expect(individual).toHaveClass('status-in-progress');
    expect(within(individual).getByText('In progress')).toBeInTheDocument();
    const locked = screen.getByText('Locked entry').closest('button')!;
    expect(locked).toHaveClass('status-locked');
    expect(within(locked).getByText('Locked')).toBeInTheDocument();
  });

  it('badges individual work only', async () => {
    const approved = await show();
    expect(within(screen.getByText('Individual entry').closest('button')!).getByText('Individual')).toBeInTheDocument();
    expect(within(approved).queryByText('Individual')).not.toBeInTheDocument();
  });

  it('explains the colours and the badge', async () => {
    await show();
    const key = within(screen.getByRole('list', { name: 'Calendar key' }));
    for (const label of ['In progress', 'Waiting for approval', 'Changes requested', 'Approved', 'Blocked', 'Locked']) {
      expect(key.getByText(label)).toBeInTheDocument();
    }
    expect(key.getByText(/not part of a monthly plan/)).toBeInTheDocument();
  });

  it('a publish date opens without effort or priority, and goes to its final step', async () => {
    items.push({ _id: 'pub_1', title: 'Publish entry', displayTitle: 'Publish entry', workType: 'Poster', calendar: 'sm', deadline: day(15), status: 'Approved', isPublishEvent: true, workItemId: 'step9' });
    // Past the three a month cell shows, so put it first.
    items = [items[3], items[0]];
    await show();
    fireEvent.click(screen.getByText('Publish entry').closest('button')!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Open Workplace/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/work/step9');
  });

  it('a publish date with no steps yet has nothing to open', async () => {
    items = [{ _id: 'pub_2', title: 'Planned entry', displayTitle: 'Planned entry', workType: 'Poster', calendar: 'sm', deadline: day(15), status: 'Planned', isPublishEvent: true, workItemId: null }, items[0]];
    await show();
    fireEvent.click(screen.getByText('Planned entry').closest('button')!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Open Workplace/ })).not.toBeInTheDocument();
  });
});
