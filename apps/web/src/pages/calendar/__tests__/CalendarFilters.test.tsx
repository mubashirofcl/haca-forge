import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CalendarPage } from '../CalendarPage';

let departments: { _id: string; name: string; code: string }[] = [];
const urls: string[] = [];

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'sm_manager', name: 'Sam' }, hasPermission: () => true }),
}));
vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    urls.push(url);
    if (url.startsWith('/api/departments')) return { data: departments };
    return { data: [] };
  }),
}));

const show = () =>
  render(
    <MemoryRouter initialEntries={['/calendar']}>
      <CalendarPage />
    </MemoryRouter>
  );
const calendarCalls = () => urls.filter((u) => u.startsWith('/api/work/calendar'));

beforeEach(() => {
  urls.length = 0;
  departments = [];
});

describe('Calendar department filter', () => {
  it('asks only for departments with real data and lists just those', async () => {
    departments = [{ _id: 'd1', name: 'Design', code: 'design' }];
    show();
    const select = await screen.findByLabelText('Department');
    expect(urls.some((u) => u === '/api/departments?inUse=true')).toBe(true);
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.text)).toEqual(['All Departments', 'Design']);
  });

  it('removes the dropdown when no department has data', async () => {
    show();
    await waitFor(() => expect(urls.some((u) => u.startsWith('/api/departments'))).toBe(true));
    await waitFor(() => expect(calendarCalls().length).toBeGreaterThan(0));
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument();
  });
});

describe('Calendar custom date range', () => {
  const openCustom = async () => {
    show();
    fireEvent.click(await screen.findByRole('tab', { name: 'Custom' }));
    return { from: screen.getByLabelText('From'), to: screen.getByLabelText('To') };
  };

  it('offers calendar pickers instead of Previous/Today/Next', async () => {
    const { from, to } = await openCustom();
    expect(from).toHaveAttribute('type', 'date');
    expect(to).toHaveAttribute('type', 'date');
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('loads the chosen days, start to end inclusive', async () => {
    const { from, to } = await openCustom();
    fireEvent.change(to, { target: { value: '2031-11-20' } });
    fireEvent.change(from, { target: { value: '2031-11-05' } });
    const start = new Date('2031-11-05T00:00:00').toISOString();
    const end = new Date('2031-11-20T23:59:59.999').toISOString();
    await waitFor(() => {
      const q = new URLSearchParams(calendarCalls().pop()!.split('?')[1]);
      expect(q.get('start')).toBe(start);
      expect(q.get('end')).toBe(end);
    });
    expect(await screen.findByText(/Deliverables, .*5.*to.*20/)).toBeInTheDocument();
  });

  it('an end date before the start shows an error on both fields and loads nothing', async () => {
    const { from, to } = await openCustom();
    fireEvent.change(from, { target: { value: '2031-11-20' } });
    fireEvent.change(to, { target: { value: '2031-11-05' } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The end date cannot be before the start date.');
    expect(from).toHaveAccessibleDescription(/cannot be before/);
    expect(to).toHaveAttribute('aria-invalid', 'true');
    const bad = new Date('2031-11-20T00:00:00').toISOString();
    expect(calendarCalls().some((u) => new URLSearchParams(u.split('?')[1]).get('start') === bad)).toBe(false);
  });

  it('going back to Month restores the normal navigation', async () => {
    await openCustom();
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    expect(await screen.findByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  });
});
