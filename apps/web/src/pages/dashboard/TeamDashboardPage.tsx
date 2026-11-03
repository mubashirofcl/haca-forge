import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { GlobalFilterBar } from '../../components/GlobalFilterBar';
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Users,
  ChevronRight,
  Plus,
  Activity,
  Layers,
  Calendar,
  FileCheck,
  TrendingUp,
  AlertOctagon,
  ArrowUpRight,
} from 'lucide-react';

interface DashboardData {
  scope: {
    profileId: string;
    departmentId: string;
    ownerId: string;
    month: string;
    userRole: string;
  };
  monthPlanStatus: {
    selectedMonth: string;
    activePlanStatus: string;
    totalPlans: number;
    plannedPieces: number;
    donePieces: number;
    completionRatePct: number;
    velocity: string;
    plans: {
      _id: string;
      code: string;
      title: string;
      kind: string;
      status: string;
      planned: number;
      done: number;
      createdByName?: string;
    }[];
  };
  kpis: {
    planned: number;
    completed: number;
    inProgress: number;
    atRisk: number;
    blocked: number;
    pendingApproval: number;
    overdue: number;
    totalWorkItems?: number;
    completionRatePct?: number;
  };
  priorities: {
    _id: string;
    title: string;
    workType: string;
    deadline: string;
    status: string;
    priority: string;
    isOverdue?: boolean;
    profileId?: { _id: string; name: string };
    ownerId?: { _id: string; name: string; role: string; jobRole?: string };
  }[];
  creativeStats: {
    totalDeliverables: number;
    byWorkType: Record<string, number>;
    byDepartment: {
      departmentId: string;
      name: string;
      code: string;
      total: number;
      inProgress: number;
      completed: number;
    }[];
    weeklyTrend: {
      weekLabel: string;
      completed: number;
    }[];
  };
  workload: {
    totalMembers: number;
    avgWorkloadPct: number;
    bandCounts: {
      healthy: number;
      high: number;
      overloaded: number;
    };
    members: {
      personId: string;
      name: string;
      role: string;
      jobRole?: string;
      departmentName: string;
      workloadPct: number;
      allocatedHours: number;
      capacity: number;
      capacityBand: string;
    }[];
    overloadedMembers: {
      personId: string;
      name: string;
      role: string;
      jobRole?: string;
      departmentName: string;
      workloadPct: number;
      allocatedHours: number;
      capacity: number;
      capacityBand: string;
    }[];
  };
  issues: {
    activeBlockersCount: number;
    longBlockedCount: number;
    activeFlagsCount: number;
    escalatedFlagsCount: number;
    blockersList: {
      _id: string;
      workItemId: string;
      deliverableTitle: string;
      reason: string;
      notes: string;
      dependencyOwnerName?: string;
      blockedAt: string;
      durationHours: number;
    }[];
    revisionFlags?: {
      _id: string;
      workItemId: string;
      deliverableTitle: string;
      ownerName: string;
      revisionsCount: number;
      rootCause?: string;
      isEscalated?: boolean;
      flaggedAt: string;
    }[];
  };
  waitingApproval: {
    plansCount: number;
    stagesCount: number;
    totalPending: number;
    plans: {
      _id: string;
      code: string;
      title: string;
      submittedAt: string;
      createdByName: string;
    }[];
    stages: {
      _id: string;
      title: string;
      workType: string;
      currentStageKey?: string;
      ownerName: string;
      deadline?: string;
    }[];
  };
  recentActivity: {
    _id: string;
    action: string;
    fromStatus?: string;
    toStatus?: string;
    timestamp: string;
    actorId?: { name: string; email: string; role: string };
    metadata?: Record<string, any>;
  }[];
}

export const TeamDashboardPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const { queryParams } = useGlobalFilter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Requirement: team_member is redirected to My Work
  useEffect(() => {
    if (user?.role === 'team_member') {
      navigate('/my-work', { replace: true });
    }
  }, [user, navigate]);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const queryString = new URLSearchParams(queryParams).toString();
      const url = `/api/dashboard/overview${queryString ? `?${queryString}` : ''}`;
      const res = await apiFetch<{ data?: DashboardData } | DashboardData>(url);
      const dashboardData = (res as any).data || res;
      setData(dashboardData);
    } catch (err) {
      console.error('Failed to load dashboard overview', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'team_member') {
      fetchDashboard();
    }
  }, [queryParams, user]);

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'creative_head':
        return 'Creative Head';
      case 'executive':
        return 'Executive';
      case 'sm_manager':
        return 'SM Manager';
      case 'team_member':
        return 'Team Member';
      default:
        return 'Member';
    }
  };

  const getPlanStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Submitted':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Changes requested':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Approved with pending rows':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-fadeIn">
      {/* Top Welcome Cockpit */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/30 text-purple-200 border border-purple-400/30">
                Command Center
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-200">
                {getRoleDisplayName(user?.role)}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-purple-400" />
              Welcome back, {user?.name || 'Marketer'}
            </h1>
            <p className="text-sm text-purple-200/70 mt-1 max-w-2xl">
              Live operational pulse: calendar plans, production velocity, workload capacity, blockers, and sign-offs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {hasPermission('work.create') && (
              <button
                onClick={() => navigate('/work')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Deliverable</span>
              </button>
            )}

            <button
              onClick={() => navigate('/calendar')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Calendar &amp; Plans</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Global Filter Bar */}
      <GlobalFilterBar />

      {isLoading ? (
        <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
          Loading operational dashboard overview...
        </div>
      ) : !data ? (
        <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
          Failed to load dashboard metrics.
        </div>
      ) : (
        <div className="space-y-6">
          {/* ========================================================= */}
          {/* SECTION 1: Month Plan Status */}
          {/* ========================================================= */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                      Section 1 &bull; Month Plan Status
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      ({data.monthPlanStatus.selectedMonth})
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    Active Monthly Plan:{' '}
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getPlanStatusBadge(
                        data.monthPlanStatus.activePlanStatus
                      )}`}
                    >
                      {data.monthPlanStatus.activePlanStatus}
                    </span>
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/calendar?tab=plans')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors"
                >
                  <span>View All Plans ({data.monthPlanStatus.totalPlans})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
              {/* Planned vs Done */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600">Planned vs Published</span>
                  <span className="font-extrabold text-slate-900">
                    {data.monthPlanStatus.donePieces} / {data.monthPlanStatus.plannedPieces} Pieces
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, data.monthPlanStatus.completionRatePct)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>{data.monthPlanStatus.completionRatePct}% Completed</span>
                  <span>{data.monthPlanStatus.plannedPieces - data.monthPlanStatus.donePieces} Remaining</span>
                </div>
              </div>

              {/* Velocity */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Publishing Velocity
                </span>
                <div className="text-base font-black text-slate-800">
                  {data.monthPlanStatus.velocity}
                </div>
                <p className="text-[11px] text-slate-500">
                  Calculated against days elapsed in {data.monthPlanStatus.selectedMonth}.
                </p>
              </div>

              {/* Plans breakdown pill list */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Active Plans In Period
                </span>
                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                  {data.monthPlanStatus.plans.length === 0 ? (
                    <span className="text-xs text-slate-400">No calendar plans uploaded for this month.</span>
                  ) : (
                    data.monthPlanStatus.plans.map((p) => (
                      <div
                        key={p._id}
                        onClick={() => navigate(`/calendar?tab=plans`)}
                        className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 border border-slate-100 hover:bg-purple-50/60 cursor-pointer transition-colors"
                      >
                        <span className="font-bold text-slate-800 truncate mr-2">{p.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded-full font-bold border shrink-0 ${getPlanStatusBadge(
                            p.status
                          )}`}
                        >
                          {p.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: KPI Strip (7 core metrics, linking to filtered lists) */}
          {/* ========================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* 1. Planned */}
            <div
              onClick={() => navigate('/calendar?tab=tracker')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-purple-400 transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Planned</span>
                <Layers className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-slate-900">{data.kpis.planned}</div>
              <span className="text-[10px] text-purple-600 font-bold block mt-1 flex items-center gap-0.5">
                <span>View all</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>

            {/* 2. Completed */}
            <div
              onClick={() => navigate('/calendar?tab=tracker&status=Approved,Published')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-emerald-400 transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-emerald-600">{data.kpis.completed}</div>
              <span className="text-[10px] text-emerald-700 font-bold block mt-1 flex items-center gap-0.5">
                <span>Published/Approved</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>

            {/* 3. In Progress */}
            <div
              onClick={() => navigate('/calendar?tab=tracker&status=In%20Progress')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-400 transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">In Progress</span>
                <Clock className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-indigo-600">{data.kpis.inProgress}</div>
              <span className="text-[10px] text-indigo-700 font-bold block mt-1 flex items-center gap-0.5">
                <span>Active stages</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>

            {/* 4. At Risk */}
            <div
              onClick={() => navigate('/calendar?tab=tracker&filter=at_risk')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-amber-400 transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">At Risk</span>
                <AlertOctagon className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className={`text-2xl font-black ${data.kpis.atRisk > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {data.kpis.atRisk}
              </div>
              <span className="text-[10px] text-amber-700 font-bold block mt-1 flex items-center gap-0.5">
                <span>Due in &le;72h</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>

            {/* 5. Blocked */}
            <div
              onClick={() => navigate('/calendar?tab=tracker&status=Blocked')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-rose-400 transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Blocked</span>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className={`text-2xl font-black ${data.kpis.blocked > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {data.kpis.blocked}
              </div>
              <span className="text-[10px] text-rose-700 font-bold block mt-1 flex items-center gap-0.5">
                <span>Dependencies</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>

            {/* 6. Pending Approval */}
            <div
              onClick={() => navigate('/feedback')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-purple-400 transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Pending Appr.</span>
                <FileCheck className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-black text-purple-700">{data.kpis.pendingApproval}</div>
              <span className="text-[10px] text-purple-700 font-bold block mt-1 flex items-center gap-0.5">
                <span>In review</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>

            {/* 7. Overdue */}
            <div
              onClick={() => navigate('/calendar?tab=tracker&filter=overdue')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-rose-400 transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
              </div>
              <div
                className={`text-2xl font-black ${
                  data.kpis.overdue > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-800'
                }`}
              >
                {data.kpis.overdue}
              </div>
              <span className="text-[10px] text-rose-700 font-bold block mt-1 flex items-center gap-0.5">
                <span>Past deadline</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 7: Waiting for Approval (Creative Head / Admin Sign-off Queue) */}
          {/* ========================================================= */}
          {(user?.role === 'creative_head' || user?.role === 'admin') && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-50 via-white to-indigo-50 border border-purple-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-purple-700" />
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-purple-900">
                      Section 7 &bull; Waiting for Creative Head Approval
                    </h2>
                    <span className="text-[11px] text-purple-700 font-semibold">
                      {data.waitingApproval.totalPending} pending items requiring your sign-off
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/feedback')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
                >
                  <span>Open Approvals Console</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Submitted Calendar Plans */}
                <div className="p-3.5 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Submitted Plans ({data.waitingApproval.plans.length})</span>
                    <button
                      onClick={() => navigate('/calendar?tab=plans')}
                      className="text-[11px] text-purple-600 hover:underline"
                    >
                      Review Plans
                    </button>
                  </div>
                  {data.waitingApproval.plans.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No plans waiting for approval.</span>
                  ) : (
                    <div className="space-y-1.5">
                      {data.waitingApproval.plans.map((p) => (
                        <div
                          key={p._id}
                          onClick={() => navigate('/calendar?tab=plans')}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-purple-50/50 hover:bg-purple-100/60 cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">{p.title}</span>
                            <span className="text-[10px] text-slate-500">By {p.createdByName}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                            Submitted
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stages in Feedback */}
                <div className="p-3.5 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Deliverable Review Stages ({data.waitingApproval.stages.length})</span>
                    <button
                      onClick={() => navigate('/feedback')}
                      className="text-[11px] text-purple-600 hover:underline"
                    >
                      Review Stages
                    </button>
                  </div>
                  {data.waitingApproval.stages.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No deliverable review stages in feedback.</span>
                  ) : (
                    <div className="space-y-1.5">
                      {data.waitingApproval.stages.map((s) => (
                        <div
                          key={s._id}
                          onClick={() => navigate('/feedback')}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-purple-50/50 hover:bg-purple-100/60 cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">{s.title}</span>
                            <span className="text-[10px] text-slate-500">
                              {s.workType} &bull; {s.ownerName}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Feedback
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TWO COLUMN ROW: Section 3 (Today's Priorities) & Section 4 (Production Stats & Trend) */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECTION 3: Today's Priorities */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Section 3 &bull; Today's Priorities
                    </h2>
                  </div>
                  <button
                    onClick={() => navigate('/todo')}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                  >
                    <span>Todo List</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 mt-3">
                  {data.priorities.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No urgent tasks due today. All deadlines are clear!
                    </div>
                  ) : (
                    data.priorities.map((item) => (
                      <div
                        key={item._id}
                        onClick={() => navigate(`/work/${item._id}`)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          item.isOverdue
                            ? 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
                            : item.status === 'Blocked'
                            ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
                            : 'bg-slate-50 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase bg-white border border-slate-200 text-slate-600">
                              {item.workType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {item.ownerId?.name || 'Unassigned'}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full block mb-1 ${
                              item.isOverdue
                                ? 'bg-rose-600 text-white'
                                : item.status === 'Blocked'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {item.isOverdue ? 'Overdue' : item.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'No date'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 4: Production Stats & Trend */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 4 &bull; Production Stats &amp; Trend
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/calendar?tab=tracker')}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                >
                  <span>Content Tracker</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Work Type Matrix */}
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400 block mb-2">
                    Output by Deliverable Type:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {Object.entries(data.creativeStats.byWorkType).map(([type, count]) => (
                      <div
                        key={type}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-700 truncate">{type}</span>
                        <strong className="text-purple-700 font-bold ml-1">{count}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4-Week Completion Trend */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block mb-2">
                    4-Week Completion Trend:
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {data.creativeStats.weeklyTrend.map((t) => (
                      <div key={t.weekLabel} className="p-2 rounded-xl bg-purple-50/60 border border-purple-100">
                        <span className="text-[10px] text-purple-700 font-bold block">{t.weekLabel}</span>
                        <strong className="text-base font-black text-purple-900">{t.completed}</strong>
                        <span className="text-[9px] text-slate-400 block">published</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Departmental Throughput */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">
                    Departmental Throughput:
                  </span>
                  {data.creativeStats.byDepartment.map((dept) => (
                    <div key={dept.departmentId} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700">{dept.name}</span>
                        <span className="text-slate-500">
                          {dept.completed}/{dept.total} (
                          {dept.total > 0 ? Math.round((dept.completed / dept.total) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full"
                          style={{
                            width: `${dept.total > 0 ? (dept.completed / dept.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 5: Team Workload (Real % text, capped bar, bands: <65, 65-85, >85) */}
          {/* ========================================================= */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 5 &bull; Team Workload
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Real utilization percentage &bull; Capacity Bands: &lt;65%, 65-85%, &gt;85%
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate('/workload')}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
              >
                <span>Capacity Console</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Capacity Band Summary Cards */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-bold block uppercase tracking-wider">
                    Healthy (&lt;65%)
                  </span>
                  <strong className="text-2xl font-black text-emerald-800">
                    {data.workload.bandCounts.healthy}
                  </strong>
                  <span className="text-[10px] text-emerald-600 block mt-0.5">members</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] text-amber-700 font-bold block uppercase tracking-wider">
                    High (65-85%)
                  </span>
                  <strong className="text-2xl font-black text-amber-800">
                    {data.workload.bandCounts.high}
                  </strong>
                  <span className="text-[10px] text-amber-600 block mt-0.5">members</span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-700 font-bold block uppercase tracking-wider">
                    Overload (&gt;85%)
                  </span>
                  <strong className="text-2xl font-black text-rose-800">
                    {data.workload.bandCounts.overloaded}
                  </strong>
                  <span className="text-[10px] text-rose-600 block mt-0.5">members</span>
                </div>
              </div>

              {/* Members Capacity List with Real % and Capped Bar */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Member Utilization Snapshot:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(data.workload.members || []).slice(0, 6).map((m) => {
                    const isOverloaded = m.workloadPct > 85;
                    const isHigh = m.workloadPct >= 65 && m.workloadPct <= 85;
                    const barColor = isOverloaded ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-emerald-500';
                    const badgeBg = isOverloaded
                      ? 'bg-rose-100 text-rose-800'
                      : isHigh
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800';

                    return (
                      <div
                        key={m.personId}
                        onClick={() => navigate('/workload')}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-purple-300 transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 truncate">{m.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${badgeBg}`}>
                            {m.capacityBand}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{m.departmentName}</span>
                          {/* Requirement 4: Show REAL percentage in text */}
                          <strong className="font-extrabold text-slate-900">{m.workloadPct}% Workload</strong>
                        </div>
                        {/* Requirement 4: Cap only the progress bar width at 100% */}
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${Math.min(100, m.workloadPct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* TWO COLUMN ROW: Section 6 (Issues & Blockers) & Section 8 (Recent Activity) */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECTION 6: Issues & Blockers */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 6 &bull; Issues &amp; Blockers
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/issues')}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
                >
                  <span>Issues Console</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/60 border border-rose-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-rose-900">Active Unresolved Blockers</span>
                  </div>
                  <strong className="text-base font-black text-rose-900">
                    {data.issues.activeBlockersCount}
                  </strong>
                </div>

                {data.issues.blockersList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No active dependency blockers currently reported.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.issues.blockersList.map((blocker) => (
                      <div
                        key={blocker._id}
                        onClick={() => navigate('/issues')}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-rose-300 transition-colors cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{blocker.deliverableTitle}</span>
                          <span className="text-[10px] font-bold text-rose-700 px-2 py-0.5 rounded-full bg-rose-100">
                            {blocker.durationHours}h Blocked
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">Reason: {blocker.reason}</p>
                        <span className="text-[10px] text-slate-400 block">
                          Dependency Owner: {blocker.dependencyOwnerName || 'Unassigned'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 8: Recent Activity Feed */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 8 &bull; Recent Activity Feed
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Audit Feed
                </span>
              </div>

              <div className="space-y-3">
                {data.recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No recent audit activity recorded.
                  </div>
                ) : (
                  data.recentActivity.map((event) => (
                    <div
                      key={event._id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3 text-xs"
                    >
                      <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate">
                            {event.actorId?.name || 'System Automation'}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(event.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {event.action.replace('_', ' ').replace('.', ' ')}
                          {event.fromStatus && event.toStatus && ` (${event.fromStatus} -> ${event.toStatus})`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default TeamDashboardPage;
