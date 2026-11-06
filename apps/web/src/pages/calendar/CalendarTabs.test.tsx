import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CalendarPage } from './CalendarPage';
import * as authContext from '../../context/AuthContext';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/calendar-plans/plan-2')) {
      return Promise.resolve({
        data: {
          _id: 'plan-2',
          code: 'PLAN-2026-11-002',
          title: 'November Draft Plan',
          kind: 'monthly',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          status: 'Draft',
          rows: [
            {
              _id: 'row-2',
              topic: 'Draft Reel',
              contentType: 'Reel',
              postingDate: '2026-11-25',
              rowStatus: 'draft',
              needsScript: true,
              needsShoot: true,
              stagePlan: [
                { stageKey: 'Script', ownerId: 'user-1', dueDate: '2026-11-17' },
                { stageKey: 'Shoot', ownerId: 'user-2', dueDate: '2026-11-20' },
                { stageKey: 'Edit', ownerId: 'user-3', dueDate: '2026-11-23' },
                { stageKey: 'Post', ownerId: 'user-4', dueDate: '2026-11-25' },
              ],
            },
          ],
        },
      });
    }
    if (url.includes('/api/calendar-plans/plan-3')) {
      return Promise.resolve({
        data: {
          _id: 'plan-3',
          code: 'PLAN-2026-11-003',
          title: 'Sales Individual Work',
          kind: 'individual',
          calendar: 'sales',
          periodStart: '2026-11-20',
          periodEnd: '2026-11-20',
          status: 'Submitted',
          rows: [
            {
              _id: 'row-3',
              topic: 'Sales One-off Reel',
              contentType: 'Reel',
              postingDate: '2026-11-28',
              rowStatus: 'submitted',
              needsScript: true,
              needsShoot: true,
              stagePlan: [
                { stageKey: 'Script', ownerId: 'user-1', dueDate: '2026-11-20' },
                { stageKey: 'Shoot', ownerId: 'user-2', dueDate: '2026-11-23' },
                { stageKey: 'Edit', ownerId: 'user-3', dueDate: '2026-11-26' },
                { stageKey: 'Post', ownerId: 'user-4', dueDate: '2026-11-28' },
              ],
            },
          ],
        },
      });
    }
    if (url.includes('/api/calendar-plans/plan-1')) {
      return Promise.resolve({
        data: {
          _id: 'plan-1',
          code: 'PLAN-2026-10-001',
          title: 'October Grid',
          kind: 'monthly',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          status: 'Submitted',
          rows: [
            {
              _id: 'row-1',
              topic: 'Topic 1',
              contentType: 'Reel A',
              postingDate: '2026-10-25',
              rowStatus: 'submitted',
              needsScript: true,
              needsShoot: true,
            },
          ],
        },
      });
    }
    if (url.includes('/api/calendar-plans')) {
      return Promise.resolve({
        data: [
          {
            _id: 'plan-1',
            code: 'PLAN-2026-10-001',
            title: 'October Grid',
            kind: 'monthly',
            periodStart: '2026-10-01',
            periodEnd: '2026-10-31',
            status: 'Submitted',
            rowCount: 5,
            approvedRowCount: 2,
            submittedRowCount: 3,
            changesRequestedRowCount: 0,
            draftRowCount: 0,
          },
          {
            _id: 'plan-2',
            code: 'PLAN-2026-11-002',
            title: 'November Draft Plan',
            kind: 'monthly',
            periodStart: '2026-11-01',
            periodEnd: '2026-11-30',
            status: 'Draft',
            rowCount: 1,
            approvedRowCount: 0,
            submittedRowCount: 0,
            changesRequestedRowCount: 0,
            draftRowCount: 1,
          },
          {
            _id: 'plan-3',
            code: 'PLAN-2026-11-003',
            title: 'Sales Individual Work',
            kind: 'individual',
            calendar: 'sales',
            periodStart: '2026-11-20',
            periodEnd: '2026-11-20',
            status: 'Submitted',
            rowCount: 1,
            approvedRowCount: 0,
            submittedRowCount: 1,
            changesRequestedRowCount: 0,
            draftRowCount: 0,
          },
        ],
      });
    }
    if (url.includes('/api/content-pieces')) {
      return Promise.resolve({
        data: [
          {
            _id: 'piece-1',
            topic: 'Reel Topic Test',
            contentType: 'Reel A',
            postingDate: '2026-10-25',
            stages: [
              {
                _id: 'st-1',
                stageKey: 'Script',
                stageOrder: 1,
                status: 'Approved',
                dueDate: '2026-10-18',
                isLocked: false,
                isSkipped: false,
                revisions: 0,
              },
            ],
            derivedStatus: 'In Progress',
            hasNeedsOwner: false,
            hasWaitingApproval: false,
            hasBlocked: false,
            hasOverdue: false,
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  }),
}));

describe('CalendarPage 3 Tabs & Role-based Controls (Scope Reset R3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all three top tabs: Month, Plans & Approval, Content Flow Tracker', () => {
    (authContext.useAuth as any).mockReturnValue({
      user: { role: 'sm_manager', name: 'Sam Manager' },
      hasPermission: () => true,
    });

    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <CalendarPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Month \(Deadlines\)/i)).toBeDefined();
    expect(screen.getByText(/Plans & Approval/i)).toBeDefined();
    expect(screen.getByText(/Content Flow Tracker/i)).toBeDefined();
  });

  it('SM Manager: one entry point per action on the Plans tab (PG-4)', async () => {
    (authContext.useAuth as any).mockReturnValue({
      user: { role: 'sm_manager', name: 'Sam Manager' },
      hasPermission: () => true,
    });

    render(
      <MemoryRouter initialEntries={['/calendar?tab=plans']}>
        <CalendarPage />
      </MemoryRouter>
    );

    // Open plan grid: Plans tab header only. Add individual work: Calendar header only.
    expect(await screen.findAllByRole('button', { name: /Open plan grid/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Add individual work/i })).toHaveLength(1);
    // Template, Upload and Submit live in the plan grid now.
    expect(screen.queryByText(/Download Template/i)).toBeNull();
    expect(screen.queryByText(/Upload & Preview/i)).toBeNull();
    expect(screen.queryByText(/New Plan/i)).toBeNull();
  });

  it('Creative Head: monthly plans are reviewed in the grid; individual plans keep their review controls', async () => {
    (authContext.useAuth as any).mockReturnValue({
      user: { role: 'creative_head', name: 'Claire Head' },
      hasPermission: () => true,
    });

    render(
      <MemoryRouter initialEntries={['/calendar?tab=plans']}>
        <CalendarPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText(/October Grid/i));
    expect(await screen.findByText(/to review this plan row by row/i)).toBeDefined();
    expect(screen.queryByText(/Review Mode:/i)).toBeNull();
    expect(screen.getAllByRole('button', { name: /Review in plan grid/i })).toHaveLength(1);
    // Plan creation is SM/Admin only, so the Creative Head has no Add individual work button.
    expect(screen.queryByRole('button', { name: /Add individual work/i })).toBeNull();

    fireEvent.click(screen.getByText(/Sales Individual Work/i));
    expect(await screen.findByText(/Review Mode:/i)).toBeDefined();
    expect(screen.getByText(/Approve All/i)).toBeDefined();
    expect(screen.getByText(/Approve Selected/i)).toBeDefined();
    expect(screen.getByText(/Request Changes/i)).toBeDefined();
  });

  it('displays Executive in read-only mode without mutation controls', async () => {
    (authContext.useAuth as any).mockReturnValue({
      user: { role: 'executive', name: 'Elena Executive' },
      hasPermission: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/calendar?tab=plans']}>
        <CalendarPage />
      </MemoryRouter>
    );

    // Executive should see the plans management table but not upload/new buttons
    expect(await screen.findByText(/Calendar Plans Management/i)).toBeDefined();
    expect(screen.queryByText(/Upload & Preview/i)).toBeNull();
    expect(screen.queryByText(/Open plan grid/i)).toBeNull();
    expect(screen.queryByText(/New Plan/i)).toBeNull();
  });

  it('displays friendly My Work notice for creative team_member', () => {
    (authContext.useAuth as any).mockReturnValue({
      user: { role: 'team_member', name: 'Tim Member' },
      hasPermission: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <CalendarPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Creative Team Members view their personal stage assignments/i)).toBeDefined();
    expect(screen.getByText(/Go to My Work/i)).toBeDefined();
  });

  it('monthly plan rows are edited in the grid; individual plans still open the Add Row form', async () => {
    (authContext.useAuth as any).mockReturnValue({
      user: { role: 'sm_manager', name: 'Sam Manager' },
      hasPermission: () => true,
    });

    render(
      <MemoryRouter initialEntries={['/calendar?tab=plans']}>
        <CalendarPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText(/November Draft Plan/i));
    expect(await screen.findByText('Steps')).toBeDefined();
    expect(await screen.findByText('Draft Reel')).toBeDefined();
    // Monthly: no Add Row / Submit here, step chips do not open the form, a note points to the grid.
    expect(screen.queryByRole('button', { name: /^Add Row$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit for Review/i })).toBeNull();
    expect((await screen.findByRole('button', { name: /Script/i })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/to add, edit and submit rows for this plan/i)).toBeDefined();

    // Individual plan: the Add Row form (same Steps & Deadlines logic as the grid) is still here.
    fireEvent.click(screen.getByText(/Sales Individual Work/i));
    await screen.findByText('Sales One-off Reel');
    fireEvent.click(screen.getByRole('button', { name: /Script/i }));
    expect(await screen.findByText('Edit Plan Row')).toBeDefined();
    expect(screen.getAllByText(/Publish date/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Steps & Deadlines/i)).toBeDefined();
    expect(screen.getByText(/Needs script/i)).toBeDefined();
    expect(screen.getByText(/Needs shoot/i)).toBeDefined();
  });
});
