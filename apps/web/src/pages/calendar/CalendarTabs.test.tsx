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

  it('displays SM Manager actions (Upload & Preview, New Plan) on Plans tab', async () => {
    (authContext.useAuth as any).mockReturnValue({
      user: { role: 'sm_manager', name: 'Sam Manager' },
      hasPermission: () => true,
    });

    render(
      <MemoryRouter initialEntries={['/calendar?tab=plans']}>
        <CalendarPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Upload & Preview/i)).toBeDefined();
    expect(screen.getByText(/New Plan/i)).toBeDefined();
    expect(screen.getByText(/Download Template/i)).toBeDefined();
  });

  it('displays Creative Head review controls when a plan is selected', async () => {
    (authContext.useAuth as any).mockReturnValue({
      user: { role: 'creative_head', name: 'Claire Head' },
      hasPermission: () => true,
    });

    render(
      <MemoryRouter initialEntries={['/calendar?tab=plans']}>
        <CalendarPage />
      </MemoryRouter>
    );

    const planItem = await screen.findByText(/October Grid/i);
    expect(planItem).toBeDefined();
    fireEvent.click(planItem);

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
});

