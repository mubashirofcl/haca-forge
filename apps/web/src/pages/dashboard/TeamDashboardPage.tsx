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
  Target,
  TrendingUp,
  ChevronRight,
  Plus,
  BarChart3,
  MessageSquare,
  Activity,
  Layers,
} from 'lucide-react';

interface DashboardData {
  scope: {
    profileId: string;
    departmentId: string;
    ownerId: string;
    campaignId: string;
    month: string;
    userRole: string;
  };
  targets: {
    month: string;
    targetCount: number;
    revenueTarget: number;
    leadsTarget: number;
    qualifiedLeadsTarget: number;
    budgetAllocated: number;
    targetsList: {
      _id: string;
      profileName: string;
      revenueTarget: number;
      leadsTarget: number;
      qualifiedLeadsTarget: number;
      budget: number;
    }[];
  };
  kpis: {
    totalWorkItems: number;
    inProgress: number;
    inFeedback: number;
    blocked: number;
    approved: number;
    published: number;
    overdue: number;
    completionRatePct: number;
  };
  priorities: {
    _id: string;
    title: string;
    workType: string;
    deadline: string;
    status: string;
    priority: string;
    isOverdue?: boolean;
    campaignId?: { _id: string; name: string };
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
  };
  campaigns: {
    _id: string;
    name: string;
    profileName: string;
    status: string;
    goalType: string;
    budgetAllocated: number;
    totalItems: number;
    completedItems: number;
    progressPct: number;
  }[];
  workload: {
    totalMembers: number;
    avgWorkloadPct: number;
    bandCounts: {
      healthy: number;
      high: number;
      overloaded: number;
    };
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
  leadFunnel: {
    totalLeadsTarget: number;
    qualifiedLeadsTarget: number;
    conversionRateTarget: number;
    activeCampaignsWithGoals: number;
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

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const queryString = new URLSearchParams(queryParams).toString();
      const url = `/api/dashboard/overview${queryString ? `?${queryString}` : ''}`;
      const res = await apiFetch<{ data: DashboardData }>(url);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard overview', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [queryParams]);

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'marketing_head':
        return 'Marketing Head';
      case 'executive':
        return 'Executive';
      case 'team_lead':
        return 'Team Lead';
      case 'team_member':
        return 'Team Member';
      default:
        return 'Member';
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Welcome Cockpit */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/30 text-purple-200 border border-purple-400/30">
                Screen 2 • Command Center
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
              Live operational pulse across targets, deliverables, workload bands, issues, and creative throughput.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {hasPermission('work.create') && (
              <button
                onClick={() => navigate('/work')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Deliverable</span>
              </button>
            )}
            <button
              onClick={() => navigate('/calendar')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-2 shadow-sm"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Global Filter Bar */}
      <GlobalFilterBar />

      {isLoading ? (
        <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
          Loading 9-section dashboard overview...
        </div>
      ) : !data ? (
        <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
          Failed to load dashboard metrics.
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Targets Strip */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600" />
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Section 1 • Monthly Targets ({data.targets.month})
                </h2>
              </div>
              <button
                onClick={() => navigate('/campaigns')}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
              >
                <span>View Campaigns</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div
                onClick={() => navigate('/campaigns')}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/50 border border-purple-200/60 cursor-pointer hover:border-purple-300 transition-all"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
                  Revenue Target
                </span>
                <div className="text-lg font-black text-slate-900">
                  ₹{data.targets.revenueTarget.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Across {data.targets.targetCount} Target Anchor{data.targets.targetCount === 1 ? '' : 's'}
                </span>
              </div>

              <div
                onClick={() => navigate('/leads')}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-200/60 cursor-pointer hover:border-indigo-300 transition-all"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block mb-1">
                  Total Leads Target
                </span>
                <div className="text-lg font-black text-slate-900">
                  {data.targets.leadsTarget.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Top-of-funnel intake</span>
              </div>

              <div
                onClick={() => navigate('/leads')}
                className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/60 cursor-pointer hover:border-emerald-300 transition-all"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                  Qualified Leads Target
                </span>
                <div className="text-lg font-black text-emerald-700">
                  {data.targets.qualifiedLeadsTarget.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Admissions / High intent</span>
              </div>

              <div
                onClick={() => navigate('/campaigns')}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-300 transition-all"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Budget Allocated
                </span>
                <div className="text-lg font-black text-slate-900">
                  ₹{data.targets.budgetAllocated.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Marketing spend</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: KPI Strip & Execution Pulse */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div
              onClick={() => navigate('/work')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-purple-300 transition-all"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">All Items</span>
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {data.kpis.totalWorkItems}
              </div>
              <span className="text-[10px] text-purple-600 font-bold block mt-1">
                {data.kpis.completionRatePct}% Completed
              </span>
            </div>

            <div
              onClick={() => navigate('/work?status=In Progress')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-300 transition-all"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">In Progress</span>
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-indigo-600">
                {data.kpis.inProgress}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Active execution</span>
            </div>

            <div
              onClick={() => navigate('/feedback')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-amber-300 transition-all"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">In Feedback</span>
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600">
                {data.kpis.inFeedback}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Under review</span>
            </div>

            <div
              onClick={() => navigate('/issues')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-rose-300 transition-all"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Blocked</span>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-600">
                {data.kpis.blocked}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Awaiting dependencies</span>
            </div>

            <div
              onClick={() => navigate('/work?status=Approved')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-emerald-300 transition-all"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Approved</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600">
                {data.kpis.approved + data.kpis.published}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Signed off / live</span>
            </div>

            <div
              onClick={() => navigate('/todo')}
              className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm cursor-pointer hover:border-rose-300 transition-all"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div
                className={`text-2xl font-black ${
                  data.kpis.overdue > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-800'
                }`}
              >
                {data.kpis.overdue}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Passed deadline</span>
            </div>
          </div>

          {/* TWO COLUMN ROW: Section 3 (Today's Priorities) & Section 4 (Creative Production Stats) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Section 3: Today's Priorities (7 cols) */}
            <div className="lg:col-span-7 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 3 • Today's Priorities & Urgent Focus
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/todo')}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                >
                  <span>Open Todo Queue</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {data.priorities.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No urgent deliverables due today or overdue. Clean slate!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.priorities.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => navigate(`/work/${item._id}`)}
                      className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-purple-50/60 border border-slate-200/70 cursor-pointer transition-all flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            {item.workType}
                          </span>
                          {item.isOverdue ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                              Overdue
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Due Today
                            </span>
                          )}
                          {item.status === 'Blocked' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              Blocked
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 block">
                          Owner: <strong>{item.ownerId?.name || 'Unassigned'}</strong>
                          {item.campaignId && ` • ${item.campaignId.name}`}
                        </span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Creative Production Stats (5 cols) */}
            <div className="lg:col-span-5 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 4 • Creative Production
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/work')}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                >
                  <span>Work Board</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Deliverables by Work Type:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
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

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">
                    Departmental Throughput:
                  </span>
                  {data.creativeStats.byDepartment.map((dept) => (
                    <div key={dept.departmentId} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700">{dept.name}</span>
                        <span className="text-slate-500">
                          {dept.completed}/{dept.total} ({dept.total > 0 ? Math.round((dept.completed / dept.total) * 100) : 0}%)
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

          {/* TWO COLUMN ROW: Section 5 (Campaign Progress) & Section 6 (Team Workload) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Section 5: Campaign Progress (7 cols) */}
            <div className="lg:col-span-7 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 5 • Active Campaign Sprints
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/campaigns')}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                >
                  <span>All Campaigns</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {data.campaigns.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No active campaigns matching filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.campaigns.map((camp) => (
                    <div
                      key={camp._id}
                      onClick={() => navigate(`/campaigns/${camp._id}`)}
                      className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-purple-50/50 border border-slate-200/80 cursor-pointer transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                            {camp.name}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {camp.profileName} • Goal: {camp.goalType} • ₹{camp.budgetAllocated.toLocaleString()}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            camp.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : camp.status === 'At Risk'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {camp.status}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>{camp.completedItems} of {camp.totalItems} deliverables published</span>
                          <span className="font-bold text-slate-800">{camp.progressPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full"
                            style={{ width: `${camp.progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 6: Team Workload Snapshot (5 cols) */}
            <div className="lg:col-span-5 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 6 • Team Workload
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/workload')}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                >
                  <span>Workload Monitor</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 font-bold block">Healthy (&lt;65%)</span>
                    <strong className="text-lg font-black text-emerald-800">
                      {data.workload.bandCounts.healthy}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-700 font-bold block">High (65-85%)</span>
                    <strong className="text-lg font-black text-amber-800">
                      {data.workload.bandCounts.high}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-700 font-bold block">Overload (&gt;85%)</span>
                    <strong className="text-lg font-black text-rose-800">
                      {data.workload.bandCounts.overloaded}
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                    Overloaded Team Alert:
                  </span>
                  {data.workload.overloadedMembers.length === 0 ? (
                    <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      All active team members are within capacity!
                    </span>
                  ) : (
                    <div className="space-y-1.5">
                      {data.workload.overloadedMembers.map((m) => (
                        <div
                          key={m.personId}
                          onClick={() => navigate('/workload')}
                          className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-rose-50/70 text-rose-900 border border-rose-200 cursor-pointer hover:bg-rose-100"
                        >
                          <span className="font-bold">{m.name} ({m.departmentName})</span>
                          <span className="font-black text-rose-700">{m.workloadPct}% Workload</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* THREE COLUMN ROW: Section 7 (Lead Funnel), Section 8 (Issues), Section 9 (Recent Activity) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Section 7: Lead Funnel Snapshot */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 7 • Lead Funnel
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/leads')}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                >
                  <span>Funnel</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                  <span className="text-[10px] font-bold uppercase text-indigo-700 block mb-0.5">
                    Target Conversion Rate:
                  </span>
                  <strong className="text-lg font-black text-slate-900">
                    {data.leadFunnel.conversionRateTarget}%
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    Qualified / Total Leads Intake
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-semibold block">Total Leads</span>
                    <strong className="text-slate-800">{data.leadFunnel.totalLeadsTarget}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-semibold block">Qualified</span>
                    <strong className="text-emerald-700">{data.leadFunnel.qualifiedLeadsTarget}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 8: Issues & Blockers */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 8 • Issues & Blockers
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/issues')}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
                >
                  <span>Console</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-700 font-bold block">Active Blockers</span>
                    <strong className="text-lg font-black text-rose-800">
                      {data.issues.activeBlockersCount}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-700 font-bold block">Revision Flags</span>
                    <strong className="text-lg font-black text-amber-800">
                      {data.issues.activeFlagsCount}
                    </strong>
                  </div>
                </div>

                {data.issues.blockersList.length === 0 ? (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-semibold text-center">
                    Zero active blockers!
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {data.issues.blockersList.slice(0, 3).map((b) => (
                      <div
                        key={b._id}
                        onClick={() => navigate('/issues')}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 cursor-pointer transition-colors text-[11px]"
                      >
                        <div className="font-bold text-slate-800 truncate">{b.deliverableTitle}</div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                          <span className="text-rose-700 font-semibold">{b.reason}</span>
                          <span>{b.durationHours}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section 9: Recent Activity Feed */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Section 9 • Recent Activity
                  </h2>
                </div>
              </div>

              {data.recentActivity.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No activity events recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {data.recentActivity.slice(0, 5).map((act) => (
                    <div key={act._id} className="p-2 rounded-xl bg-slate-50/70 border border-slate-200/60 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="font-bold text-slate-700">{act.actorId?.name || 'System'}</span>
                        <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-800 font-medium">
                        {act.action.replace(/_/g, ' ').replace(/\./g, ' • ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
