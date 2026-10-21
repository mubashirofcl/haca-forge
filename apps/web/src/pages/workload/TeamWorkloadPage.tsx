import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import {
  WORK_TYPES,
  type WorkType,
  type CapacityBand,
} from '@mmp/shared';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Building2,
  TrendingUp,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ActiveWorkItem {
  _id: string;
  title: string;
  workType: string;
  deadline: string;
  estimatedEffortHrs: number;
  status: string;
  priority: string;
  isOverdue?: boolean;
  campaignId?: { _id: string; name: string };
  profileId?: { _id: string; name: string };
}

interface MemberWorkload {
  person: {
    _id: string;
    name: string;
    email: string;
    role: string;
    jobRole?: string;
    departmentId?: { _id: string; name: string } | string;
    weeklyCapacityHours: number;
  };
  capacity: number;
  allocatedHours: number;
  availableHours: number;
  workloadPct: number;
  capacityBand: CapacityBand;
  avgRevisions: number;
  activeItemsCount: number;
  activeWorkItems: ActiveWorkItem[];
}

interface DepartmentWorkloadGroup {
  _id: string;
  name: string;
  code: string;
  totalMembers: number;
  totalAllocatedHours: number;
  totalCapacityHours: number;
  avgWorkloadPct: number;
  bandCounts: {
    healthy: number;
    high: number;
    overloaded: number;
  };
  members: MemberWorkload[];
}

interface WorkloadResponse {
  summary: {
    totalMembers: number;
    totalCapacityHours: number;
    totalAllocatedHours: number;
    availableCapacityHours: number;
    overallAvgWorkload: number;
    overloadedCount: number;
    totalOpenItems: number;
  };
  departments: DepartmentWorkloadGroup[];
}

interface RecommendationResponse {
  recommendedPerson: {
    _id: string;
    name: string;
    email: string;
    role: string;
    jobRole?: string;
  };
  recommendedMetrics: {
    workloadPct: number;
    capacityBand: CapacityBand;
    avgRevisions: number;
    allocatedHours: number;
    availableHours: number;
    newWorkloadPct: number;
  };
  rationale: string;
  department?: { name: string; code: string };
  isOverloadWarning: boolean;
}

export const TeamWorkloadPage: React.FC = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedBand, setSelectedBand] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  // Auto-Assignment Modal State
  const [isRecommendOpen, setIsRecommendOpen] = useState(false);
  const [recWorkType, setRecWorkType] = useState<WorkType>('Reel');
  const [recEffort, setRecEffort] = useState(4);
  const [recDeadline, setRecDeadline] = useState('');
  const [recResult, setRecResult] = useState<RecommendationResponse | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);

  // Override Form in Modal
  const [overridePersonId, setOverridePersonId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState<string | null>(null);

  const fetchWorkload = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: WorkloadResponse }>('/api/workload');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load team workload', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkload();
  }, []);

  const toggleExpand = (personId: string) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [personId]: !prev[personId],
    }));
  };

  // Run Recommendation
  const handleGetRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRecommending(true);
    setRecResult(null);
    setOverrideSuccessMsg(null);

    try {
      const res = await apiFetch<{ data: RecommendationResponse }>('/api/assignment/recommend', {
        method: 'POST',
        body: JSON.stringify({
          workType: recWorkType,
          estimatedEffortHrs: Number(recEffort),
          deadline: recDeadline ? new Date(recDeadline).toISOString() : undefined,
        }),
      });
      setRecResult(res.data);
      if (res.data.recommendedPerson) {
        setOverridePersonId(res.data.recommendedPerson._id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate recommendation');
    } finally {
      setIsRecommending(false);
    }
  };

  // Filtered Departments & Members
  const filteredDepartments = useMemo(() => {
    if (!data?.departments) return [];

    return data.departments
      .filter((dept) => {
        if (selectedDept !== 'all' && dept._id !== selectedDept && dept.code !== selectedDept) {
          return false;
        }
        return true;
      })
      .map((dept) => {
        const filteredMembers = dept.members.filter((m) => {
          if (selectedBand !== 'all' && m.capacityBand !== selectedBand) {
            return false;
          }
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = m.person.name.toLowerCase().includes(q);
            const matchJob = m.person.jobRole?.toLowerCase().includes(q);
            const matchEmail = m.person.email.toLowerCase().includes(q);
            if (!matchName && !matchJob && !matchEmail) return false;
          }
          return true;
        });

        return {
          ...dept,
          members: filteredMembers,
        };
      })
      .filter((dept) => dept.members.length > 0 || selectedDept === dept._id);
  }, [data, selectedDept, selectedBand, searchQuery]);

  const getCapacityBandBadge = (band: CapacityBand) => {
    switch (band) {
      case 'Healthy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Overloaded':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getProgressBarColor = (workloadPct: number) => {
    if (workloadPct > 85) return 'bg-rose-500';
    if (workloadPct >= 65) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Top Cockpit Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Screen 9 • Capacity Management
            </span>
            <span className="text-xs text-slate-500 font-medium">Auto-Assignment &amp; Workload Bands</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-600" />
            Team Workload &amp; Capacity
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time workload monitoring across 7 creative departments with auto-assignment recommendations.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsRecommendOpen(true);
              setRecResult(null);
              setOverrideSuccessMsg(null);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Assign Deliverable
          </button>
        </div>
      </div>

      {/* Leading Indicator Overload Warning Banner */}
      {data && data.summary.overloadedCount > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200/90 text-rose-800 shadow-sm flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-900">
                Leading Indicator Alert: {data.summary.overloadedCount} Team Member{data.summary.overloadedCount > 1 ? 's are' : ' is'} Overloaded (&gt;85% Capacity)
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Active tasks exceed healthy capacity thresholds. Rebalance open deliverables now to prevent deadline slips and burnout.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedBand('Overloaded')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-800 bg-white border border-rose-200 hover:bg-rose-100 transition-colors whitespace-nowrap shadow-xs"
          >
            View Overloaded
          </button>
        </div>
      )}

      {/* KPI Overview Strip */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Utilization */}
          <div className="glass-card p-4 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Utilization</span>
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {data.summary.overallAvgWorkload}%
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${getProgressBarColor(data.summary.overallAvgWorkload)}`}
                style={{ width: `${Math.min(100, data.summary.overallAvgWorkload)}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              {data.summary.totalAllocatedHours}h allocated / {data.summary.totalCapacityHours}h total
            </span>
          </div>

          {/* Healthy Band */}
          <div
            onClick={() => setSelectedBand(selectedBand === 'Healthy' ? 'all' : 'Healthy')}
            className={`glass-card p-4 border cursor-pointer transition-all ${
              selectedBand === 'Healthy' ? 'ring-2 ring-emerald-500/30 border-emerald-300' : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Healthy (&lt;65%)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              {data.departments.reduce((acc, d) => acc + d.bandCounts.healthy, 0)}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">Ready for new deliverables</span>
          </div>

          {/* High Band */}
          <div
            onClick={() => setSelectedBand(selectedBand === 'High' ? 'all' : 'High')}
            className={`glass-card p-4 border cursor-pointer transition-all ${
              selectedBand === 'High' ? 'ring-2 ring-amber-500/30 border-amber-300' : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">High (65-85%)</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-amber-700 mt-1">
              {data.departments.reduce((acc, d) => acc + d.bandCounts.high, 0)}
            </div>
            <span className="text-[11px] text-amber-600 font-medium">Optimal productive bandwidth</span>
          </div>

          {/* Overloaded Band */}
          <div
            onClick={() => setSelectedBand(selectedBand === 'Overloaded' ? 'all' : 'Overloaded')}
            className={`glass-card p-4 border cursor-pointer transition-all ${
              selectedBand === 'Overloaded' ? 'ring-2 ring-rose-500/30 border-rose-300' : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Overloaded (&gt;85%)</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">
              {data.summary.overloadedCount}
            </div>
            <span className="text-[11px] text-rose-500 font-medium">Needs task reassignment</span>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass-card p-4 border border-white/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Department Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Building2 className="w-3.5 h-3.5" />
            Depts:
          </span>
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedDept === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200/80'
            }`}
          >
            All Departments
          </button>
          {data?.departments.map((d) => {
            const isSelected = selectedDept === d._id || selectedDept === d.code;
            return (
              <button
                key={d._id}
                onClick={() => setSelectedDept(d._id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200/80'
                }`}
              >
                {d.name} ({d.totalMembers})
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search member or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-700"
          />
        </div>
      </div>

      {/* Department Workload Sections */}
      {isLoading ? (
        <div className="glass-card p-12 text-center border border-slate-200">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600">Loading team capacity metrics...</p>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="glass-card p-12 text-center border border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No team members match this filter</p>
          <p className="text-xs text-slate-400 mt-1">Try resetting the department or capacity band filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredDepartments.map((dept) => (
            <div key={dept._id} className="glass-card p-6 border border-slate-200/90 shadow-sm space-y-4">
              {/* Department Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                    {dept.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      {dept.name}
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {dept.totalMembers} members
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Capacity utilization across active tasks in this department
                    </p>
                  </div>
                </div>

                {/* Department Capacity Snapshot */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Dept Utilization
                    </span>
                    <span className="text-sm font-extrabold text-slate-800">
                      {dept.avgWorkloadPct}%
                    </span>
                  </div>
                  <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getProgressBarColor(dept.avgWorkloadPct)}`}
                      style={{ width: `${Math.min(100, dept.avgWorkloadPct)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Members Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dept.members.map((member) => {
                  const isExpanded = expandedMembers[member.person._id] ?? false;

                  return (
                    <div
                      key={member.person._id}
                      className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-purple-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Member Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center justify-center">
                              {member.person.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                                {member.person.name}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-medium">
                                {member.person.jobRole || member.person.role.replace('_', ' ')}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCapacityBandBadge(
                              member.capacityBand
                            )}`}
                          >
                            {member.capacityBand}
                          </span>
                        </div>

                        {/* Capacity Progress Bar */}
                        <div className="space-y-1.5 my-3">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-700">
                              {member.workloadPct}% Workload
                            </span>
                            <span className="text-slate-500 font-medium">
                              {member.allocatedHours}h / {member.capacity}h
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getProgressBarColor(member.workloadPct)}`}
                              style={{ width: `${Math.min(100, member.workloadPct)}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] mb-3">
                          <div>
                            <span className="text-slate-400 block font-medium">Active Tasks</span>
                            <strong className="text-slate-800 font-bold">{member.activeItemsCount}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Available</span>
                            <strong className="text-slate-800 font-bold">{member.availableHours}h</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Avg Revs</span>
                            <strong className="text-slate-800 font-bold">{member.avgRevisions}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Active Tasks Section */}
                      <div>
                        {member.activeItemsCount > 0 && (
                          <button
                            onClick={() => toggleExpand(member.person._id)}
                            className="w-full py-1.5 text-[11px] font-bold text-slate-500 hover:text-purple-600 flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>{isExpanded ? 'Hide Deliverables' : `View ${member.activeItemsCount} Deliverables`}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {isExpanded && member.activeWorkItems && (
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                            {member.activeWorkItems.map((item) => (
                              <div
                                key={item._id}
                                onClick={() => navigate(`/work/${item._id}`)}
                                className="p-2 rounded-lg bg-slate-50/70 hover:bg-purple-50/50 border border-slate-200/80 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="text-[10px] font-bold text-slate-800 truncate flex-1">
                                    {item.title}
                                  </span>
                                  {item.isOverdue && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">
                                      Overdue
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>{item.workType} • {item.estimatedEffortHrs}h</span>
                                  <span>
                                    {new Date(item.deadline).toLocaleDateString('default', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AUTO-ASSIGNMENT RECOMMENDATION MODAL */}
      {isRecommendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="glass-modal w-full max-w-xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsRecommendOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Auto-Assignment Recommendation Engine
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Algorithmically matches deliverables to team members based on department skills, current workload percentage, and rolling revisions.
            </p>

            <form onSubmit={handleGetRecommendation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Work Type *</label>
                  <select
                    value={recWorkType}
                    onChange={(e) => setRecWorkType(e.target.value as WorkType)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {WORK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>{wt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Effort (Hours) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={recEffort}
                    onChange={(e) => setRecEffort(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Target Deadline</label>
                  <input
                    type="date"
                    value={recDeadline}
                    onChange={(e) => setRecDeadline(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isRecommending}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isRecommending ? 'Calculating Best Match...' : 'Find Best Candidate'}
                </button>
              </div>
            </form>

            {/* Recommendation Result Banner */}
            {recResult && (
              <div className="mt-5 pt-5 border-t border-slate-100 space-y-4 animate-fadeIn">
                <div
                  className={`p-4 rounded-2xl border ${
                    recResult.isOverloadWarning
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-purple-50/80 border-purple-200 text-purple-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
                        Explainable Auto-Assignment Rationale
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {recResult.rationale}
                      </h4>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getCapacityBandBadge(
                        recResult.recommendedMetrics.capacityBand
                      )}`}
                    >
                      {recResult.recommendedMetrics.capacityBand}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-purple-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Current Workload</span>
                      <strong className="text-slate-800">{recResult.recommendedMetrics.workloadPct}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Post-Assignment</span>
                      <strong className="text-purple-700 font-bold">{recResult.recommendedMetrics.newWorkloadPct}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Available Bandwidth</span>
                      <strong className="text-slate-800">{recResult.recommendedMetrics.availableHours}h</strong>
                    </div>
                  </div>
                </div>

                {/* Team Lead Override Section */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      Depart from Recommendation (Assignment Override)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Logged in AssignmentOverride audit table
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Assign Alternative Team Member:
                    </label>
                    <select
                      value={overridePersonId}
                      onChange={(e) => setOverridePersonId(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      {data?.departments.flatMap((d) =>
                        d.members.map((m) => (
                          <option key={m.person._id} value={m.person._id}>
                            {m.person.name} ({d.name}) — {m.workloadPct}% Workload ({m.capacityBand})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {overridePersonId !== recResult.recommendedPerson?._id && (
                    <div className="animate-fadeIn">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Mandatory Override Reason *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Specialized 3D motion skills required for luxury campaign"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  )}

                  {overrideSuccessMsg && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{overrideSuccessMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
