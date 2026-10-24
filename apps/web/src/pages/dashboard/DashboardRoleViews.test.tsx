import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamDashboardPage } from './TeamDashboardPage';
import * as apiModule from '../../lib/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let mockUser: any = null;
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    hasPermission: (perm: string) => {
      if (mockUser?.role === 'admin') return true;
      if (mockUser?.role === 'creative_head') {
        return ['calendar.approve', 'portal.view', 'report.configure', 'automation.manage'].includes(perm);
      }
      if (mockUser?.role === 'sm_manager') {
        return ['calendar.plan', 'work.create'].includes(perm);
      }
      if (mockUser?.role === 'executive') {
        return ['portal.view', 'report.view'].includes(perm);
      }
      return false;
    },
  }),
}));

const defaultQueryParams = {};
const defaultFilters = {};
const mockSetFilter = vi.fn();

vi.mock('../../context/GlobalFilterContext', () => ({
  useGlobalFilter: () => ({
    queryParams: defaultQueryParams,
    filters: defaultFilters,
    setFilter: mockSetFilter,
  }),
}));

const mockDashboardData = {
  scope: {
    profileId: 'all',
    departmentId: 'all',
    ownerId: 'all',
    month: '2026-10',
    userRole: 'creative_head',
  },
  monthPlanStatus: {
    selectedMonth: '2026-10',
    activePlanStatus: 'Submitted',
    totalPlans: 1,
    plannedPieces: 25,
    donePieces: 10,
    completionRatePct: 40,
    velocity: '10 done of 25 planned (40% vs 50% expected pace)',
    plans: [
      {
        _id: 'plan-1',
        code: 'PLAN-OCT-2026',
        title: 'October Master Plan',
        kind: 'monthly',
        status: 'Submitted',
        planned: 25,
        done: 10,
        createdByName: 'Sarah Manager',
      },
    ],
  },
  kpis: {
    planned: 25,
    completed: 10,
    inProgress: 8,
    atRisk: 2,
    blocked: 1,
    pendingApproval: 4,
    overdue: 2,
  },
  priorities: [
    {
      _id: 'work-1',
      title: 'Product Launch Reel Script',
      workType: 'Reel',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      status: 'In Progress',
      priority: 'high',
      profileId: { _id: 'p-1', name: 'HACA Master' },
      ownerId: { _id: 'u-1', name: 'Alex Copywriter', role: 'team_member' },
    },
  ],
  creativeStats: {
    totalDeliverables: 25,
    byWorkType: { Reel: 15, Post: 10 },
    byDepartment: [
      {
        departmentId: 'dept-1',
        name: 'Video Production',
        code: 'video',
        total: 15,
        inProgress: 5,
        completed: 10,
      },
    ],
    weeklyTrend: [{ weekLabel: 'Week -1', completed: 8 }],
  },
  workload: {
    totalMembers: 4,
    avgWorkloadPct: 92,
    bandCounts: { healthy: 1, high: 1, overloaded: 2 },
    members: [
      {
        personId: 'p-1',
        name: 'Overloaded Editor',
        role: 'team_member',
        departmentName: 'Video Production',
        workloadPct: 125, // Uncapped real percentage (>100%)
        allocatedHours: 50,
        capacity: 40,
        capacityBand: 'Overloaded',
      },
      {
        personId: 'p-2',
        name: 'Balanced Designer',
        role: 'team_member',
        departmentName: 'Creative Design',
        workloadPct: 75,
        allocatedHours: 30,
        capacity: 40,
        capacityBand: 'High',
      },
    ],
    overloadedMembers: [],
  },
  issues: {
    activeBlockersCount: 1,
    longBlockedCount: 0,
    activeFlagsCount: 1,
    escalatedFlagsCount: 0,
    blockersList: [
      {
        _id: 'blocker-1',
        workItemId: 'work-1',
        deliverableTitle: 'Campaign Motion Ad',
        reason: 'Waiting for brand logo assets',
        notes: 'Pending final approved SVG vector',
        dependencyOwnerName: 'Lead Designer',
        blockedAt: new Date().toISOString(),
        durationHours: 6,
      },
    ],
    revisionFlags: [],
  },
  waitingApproval: {
    plansCount: 1,
    stagesCount: 2,
    totalPending: 3,
    plans: [
      {
        _id: 'plan-1',
        code: 'PLAN-OCT-2026',
        title: 'October Master Plan',
        submittedAt: new Date().toISOString(),
        createdByName: 'Sarah Manager',
      },
    ],
    stages: [
      {
        _id: 'stage-1',
        title: 'Hero Video Rough Cut',
        workType: 'Reel',
        currentStageKey: 'edit',
        ownerName: 'Alex Editor',
      },
    ],
  },
  recentActivity: [
    {
      _id: 'act-1',
      action: 'work_item.status_changed',
      fromStatus: 'In Progress',
      toStatus: 'Pending',
      timestamp: new Date().toISOString(),
      actorId: { name: 'Sarah Manager', email: 'sarah@demo.haca.local', role: 'sm_manager' },
    },
  ],
};

describe('TeamDashboardPage Role Views & Scope Reset R4 Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (url: string) => {
      if (url.includes('/api/departments')) {
        return { data: [{ _id: 'dept-1', name: 'Video Production', code: 'video' }] } as any;
      }
      if (url.includes('/api/reference-data/profiles') || url.includes('/api/reference/profiles')) {
        return { data: [{ _id: 'p-1', name: 'HACA Master Brand', code: 'haca' }] } as any;
      }
      if (url.includes('/api/dashboard/overview')) {
        return { data: mockDashboardData } as any;
      }
      return { data: [] } as any;
    });
  });

  it('team_member is redirected to My Work immediately', async () => {
    mockUser = { _id: 'u-member', name: 'Member Worker', role: 'team_member' };
    render(
      <MemoryRouter>
        <TeamDashboardPage />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/my-work', { replace: true });
  });

  it('creative_head renders all 8 operational sections including Waiting for Approval', async () => {
    mockUser = { _id: 'u-head', name: 'Creative Head User', role: 'creative_head' };
    render(
      <MemoryRouter>
        <TeamDashboardPage />
      </MemoryRouter>
    );

    // 1. Month Plan Status - wait for data load
    expect(await screen.findByText(/Month Plan Status/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByText(/October Master Plan/i).length).toBeGreaterThanOrEqual(1);

    // 2. KPI Strip
    expect(screen.getAllByText(/Completed/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Pending Appr\./i)).toBeInTheDocument();

    // 3. Today's Priorities
    expect(screen.getByText(/Today's Priorities/i)).toBeInTheDocument();

    // 4. Production Stats
    expect(screen.getByText(/Production Stats & Trend/i)).toBeInTheDocument();

    // 5. Team Workload
    expect(screen.getByText(/Team Workload/i)).toBeInTheDocument();

    // 6. Issues & Blockers
    expect(screen.getByText(/Issues & Blockers/i)).toBeInTheDocument();

    // 7. Waiting for Approval (Creative Head primary operational block)
    expect(screen.getByText(/Waiting for Creative Head Approval/i)).toBeInTheDocument();

    // 8. Recent Activity
    expect(screen.getByText(/Recent Activity Feed/i)).toBeInTheDocument();
  });

  it('Team Workload displays real percentage uncapped (125%) with band classifications', async () => {
    mockUser = { _id: 'u-head', name: 'Creative Head User', role: 'creative_head' };
    render(
      <MemoryRouter>
        <TeamDashboardPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Overloaded Editor/i)).toBeInTheDocument();
        expect(screen.getByText(/125% Workload/i)).toBeInTheDocument(); // Real uncapped value
        expect(screen.getByText(/^Overloaded$/i)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  });

  it('strictly verifies zero Target, Funnel, or Campaign sections exist in DOM', async () => {
    mockUser = { _id: 'u-head', name: 'Creative Head User', role: 'creative_head' };
    const { container } = render(
      <MemoryRouter>
        <TeamDashboardPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Month Plan Status/i)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    const textContent = container.textContent || '';
    expect(textContent).not.toMatch(/Marketing Target/i);
    expect(textContent).not.toMatch(/Target Funnel/i);
    expect(textContent).not.toMatch(/Campaign Overview/i);
    expect(textContent).not.toMatch(/Leads Generated/i);
  });

  it('executive view shows executive role badge and has no deliverable creation trigger', async () => {
    mockUser = { _id: 'u-exec', name: 'Executive Director', role: 'executive' };
    render(
      <MemoryRouter>
        <TeamDashboardPage />
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Executive/i).length).toBeGreaterThanOrEqual(1);
        // Confirming executive has no New Deliverable button
        expect(screen.queryByText(/New Deliverable/i)).toBeNull();
      },
      { timeout: 4000 }
    );
  });
});
