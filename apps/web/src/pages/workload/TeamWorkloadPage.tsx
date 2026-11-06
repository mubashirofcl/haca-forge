import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { OverdueChip } from '../../components/OverdueChip';
import { useAuth } from '../../context/AuthContext';
import {
  WORK_TYPES,
  WORK_PREFERENCES,
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
import { Avatar } from '../../components/Avatar';
import { PersonWorkHistoryDrawer } from '../../components/PersonWorkHistoryDrawer';
import { bandClass, bandForPct } from '../../lib/statusTone';
import { useDialogFocus } from '../../lib/useDialogFocus';

interface ActiveWorkItem {
  _id: string;
  title: string;
  workType: string;
  deadline: string;
  estimatedEffortHrs: number;
  status: string;
  priority: string;
  isOverdue?: boolean;
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
  const { hasPermission } = useAuth();

  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedBand, setSelectedBand] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [workHistoryPersonId, setWorkHistoryPersonId] = useState<string | null>(null);

  // Auto-Assignment Modal State
  const [isRecommendOpen, setIsRecommendOpen] = useState(false);
  const recommendDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(recommendDialogRef, isRecommendOpen, () => setIsRecommendOpen(false));
  const [recWorkType, setRecWorkType] = useState<WorkType>('Reel');
  const [recStageKey, setRecStageKey] = useState<string>('none');
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
          stageKey: recStageKey !== 'none' ? recStageKey : undefined,
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

  // Only departments that have people get a filter chip.
  const departmentChips = (data?.departments || []).filter((d) => d.totalMembers > 0);

  // Capacity colours come from the shared .band-* classes; the label is always shown beside them.
  const getCapacityBandBadge = (band: CapacityBand) => `band-tint ${bandClass(band)} border-transparent`;
  const getProgressBarColor = (workloadPct: number) => `band-bar ${bandClass(bandForPct(workloadPct))}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page title on the canvas */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-[13px] font-medium text-ui-muted">
            <span>Capacity Management</span>
            <span aria-hidden="true">·</span>
            <span>Auto-Assignment &amp; Workload Bands</span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">
            Team Workload &amp; Capacity
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ui-muted max-w-[70ch]">
            Real-time workload monitoring across your departments with auto-assignment recommendations.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          {hasPermission('assignment.override') && (
            <button
              onClick={() => {
                setIsRecommendOpen(true);
                setRecResult(null);
                setOverrideSuccessMsg(null);
              }}
              className="ui-btn ui-btn-primary h-11"
            >
              <Sparkles className="w-4 h-4" />
              Auto-Assign Deliverable
            </button>
          )}
        </div>
      </div>

      {/* Leading Indicator Overload Warning Banner */}
      {data && data.summary.overloadedCount > 0 && (
        <div className="p-4 rounded-ui-card band-tint band-overloaded flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">
                Leading Indicator Alert: {data.summary.overloadedCount} Team Member{data.summary.overloadedCount > 1 ? 's are' : ' is'} Overloaded (&gt;85% Capacity)
              </h4>
              <p className="text-xs mt-0.5 max-w-[70ch]">
                Active tasks exceed healthy capacity thresholds. Rebalance open deliverables now to prevent deadline slips and burnout.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedBand('Overloaded')}
            className="ui-btn ui-btn-secondary h-11 bg-white/80 self-start"
          >
            View Overloaded
          </button>
        </div>
      )}

      {/* KPI Overview Strip */}
      {data && (
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ui-line">
            {/* Team utilization */}
            <div className="p-5 bg-ui-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ui-muted">Team Utilization</span>
                <TrendingUp className="w-4 h-4 text-ui-ink" aria-hidden="true" />
              </div>
              <div className="mt-1 text-[28px] leading-9 font-semibold text-ui-ink tabular-nums">
                {data.summary.overallAvgWorkload}%
              </div>
              <div className="w-full bg-ui-line rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${getProgressBarColor(data.summary.overallAvgWorkload)}`}
                  style={{ width: `${Math.min(100, data.summary.overallAvgWorkload)}%` }}
                />
              </div>
              <span className="text-xs text-ui-muted block mt-1.5">{data.summary.totalAllocatedHours}h allocated / {data.summary.totalCapacityHours}h total</span>
            </div>

            {(
              [
                { band: 'Healthy', label: 'Healthy (<65%)', count: data.departments.reduce((acc, d) => acc + d.bandCounts.healthy, 0), note: 'Ready for new deliverables', Icon: CheckCircle2 },
                { band: 'High', label: 'High (65-85%)', count: data.departments.reduce((acc, d) => acc + d.bandCounts.high, 0), note: 'Optimal productive bandwidth', Icon: Clock },
                { band: 'Overloaded', label: 'Overloaded (>85%)', count: data.summary.overloadedCount, note: 'Needs task reassignment', Icon: AlertTriangle },
              ] as const
            ).map(({ band, label, count, note, Icon }) => (
              <button
                key={band}
                type="button"
                aria-pressed={selectedBand === band}
                onClick={() => setSelectedBand(selectedBand === band ? 'all' : band)}
                className={`p-5 bg-ui-card text-left transition-colors hover:bg-ui-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-ink ${
                  selectedBand === band ? 'shadow-[inset_0_0_0_2px_rgb(var(--ui-ink-rgb))]' : ''
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`band-chip ${bandClass(band)} px-2 py-0.5 text-xs font-semibold`}>
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {label}
                  </span>
                </span>
                <span className="block mt-1 text-[28px] leading-9 font-semibold text-ui-ink tabular-nums">{count}</span>
                <span className="block text-xs text-ui-muted">{note}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass-panel rounded-ui-panel p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Department Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
          {departmentChips.length > 0 && (
            <>
          <span className="text-xs font-bold text-ui-muted flex items-center gap-1.5 mr-2">
            <Building2 className="w-3.5 h-3.5" />
            Depts:
          </span>
          <button
            onClick={() => setSelectedDept('all')}
            aria-pressed={selectedDept === 'all'}
            className={`h-11 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap border transition-colors ${
              selectedDept === 'all' ? 'bg-ui-ink text-white border-transparent' : 'bg-white/60 text-ui-text border-ui-line hover:bg-white'
            }`}
          >
            All Departments
          </button>
          {departmentChips.map((d) => {
            const isSelected = selectedDept === d._id || selectedDept === d.code;
            return (
              <button
                key={d._id}
                onClick={() => setSelectedDept(d._id)}
                aria-pressed={isSelected}
                className={`h-11 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap border transition-colors ${
                  isSelected ? 'bg-ui-ink text-white border-transparent' : 'bg-white/60 text-ui-text border-ui-line hover:bg-white'
                }`}
              >
                {d.name} ({d.totalMembers})
              </button>
            );
          })}
            </>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-ui-muted absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search member or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search team members"
            className="ui-input w-full pl-10 pr-4"
          />
        </div>
      </div>

      {/* Department Workload Sections */}
      {isLoading ? (
        <div className="glass-card p-12 text-center border border-slate-200">
          <div className="w-8 h-8 border-4 border-ui-line border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600">Loading team capacity metrics...</p>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="glass-card p-12 text-center border border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No team members match this filter</p>
          <p className="text-xs text-ui-muted mt-1">Try resetting the department or capacity band filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredDepartments.map((dept) => (
            <div key={dept._id} className="glass-panel rounded-ui-panel p-5 sm:p-6 space-y-4">
              {/* Department Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-ui-line gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/70 border border-ui-line flex items-center justify-center text-ui-ink font-bold text-sm">
                    {dept.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      {dept.name}
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {dept.totalMembers} members
                      </span>
                    </h3>
                    <p className="text-xs text-ui-muted">
                      Capacity utilization across active tasks in this department
                    </p>
                  </div>
                </div>

                {/* Department Capacity Snapshot */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-ui-muted block">
                      Dept Utilization
                    </span>
                    <span className="text-sm font-extrabold text-slate-800">
                      {dept.avgWorkloadPct}%
                    </span>
                  </div>
                  <div className="w-24 bg-ui-line rounded-full h-2 overflow-hidden">
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
                      className="glass-card p-4 flex flex-col justify-between"
                    >
                      <div>
                        {/* Member Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => setWorkHistoryPersonId(member.person._id)}
                            title="Click to view individual work history"
                            className="group flex items-center gap-2.5 min-h-[44px] text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2"
                          >
                            <Avatar
                              url={(member.person as any).avatarUrl}
                              name={member.person.name}
                              userId={member.person._id}
                              size="sm"
                            />
                            <span>
                              <span className="block text-[13px] font-semibold text-ui-ink group-hover:underline underline-offset-2">
                                {member.person.name}
                              </span>
                              <span className="block text-xs text-ui-muted font-medium">
                                {member.person.jobRole || member.person.role.replace('_', ' ')}
                              </span>
                            </span>
                          </button>

                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${getCapacityBandBadge(
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
                            <span className="text-ui-muted font-medium">
                              {member.allocatedHours}h / {member.capacity}h
                            </span>
                          </div>
                          <div className="w-full bg-ui-line rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getProgressBarColor(member.workloadPct)}`}
                              style={{ width: `${Math.min(100, member.workloadPct)}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-white/60 text-[11px] mb-3">
                          <div>
                            <span className="text-ui-muted block font-medium">Active Tasks</span>
                            <strong className="text-slate-800 font-bold">{member.activeItemsCount}</strong>
                          </div>
                          <div>
                            <span className="text-ui-muted block font-medium">Available</span>
                            <strong className="text-slate-800 font-bold">{member.availableHours}h</strong>
                          </div>
                          <div>
                            <span className="text-ui-muted block font-medium">Avg Revs</span>
                            <strong className="text-slate-800 font-bold">{member.avgRevisions}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Active Tasks Section */}
                      <div>
                        {member.activeItemsCount > 0 && (
                          <button
                            onClick={() => toggleExpand(member.person._id)}
                            aria-expanded={isExpanded}
                            className="w-full min-h-[44px] text-xs font-semibold text-ui-muted hover:text-ui-ink flex items-center justify-center gap-1 rounded-xl transition-colors"
                          >
                            <span>{isExpanded ? 'Hide Deliverables' : `View ${member.activeItemsCount} Deliverables`}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {isExpanded && member.activeWorkItems && (
                          <div className="mt-2 pt-2 border-t border-ui-line space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                            {member.activeWorkItems.map((item) => (
                              <button
                                type="button"
                                key={item._id}
                                onClick={() => navigate(`/work/${item._id}`)}
                                className="block w-full text-left p-2.5 rounded-xl bg-white/60 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
                              >
                                <span className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="text-[10px] font-bold text-slate-800 truncate flex-1">
                                    {item.title}
                                  </span>
                                  {item.isOverdue && (
                                    <OverdueChip deadline={item.deadline} className="px-1.5 py-0.5 shrink-0" />
                                  )}
                                </span>
                                <span className="flex items-center justify-between text-[10px] text-ui-muted">
                                  <span>{item.workType} • {item.estimatedEffortHrs}h</span>
                                  <span>
                                    {new Date(item.deadline).toLocaleDateString('default', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </span>
                              </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim backdrop-blur-sm animate-fadeIn">
          <div
            ref={recommendDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workload-recommend-title"
            className="glass-modal w-full max-w-xl p-6 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setIsRecommendOpen(false)}
              aria-label="Close"
              className="ui-icon-btn absolute top-4 right-4"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 id="workload-recommend-title" className="text-lg font-bold text-ui-ink flex items-center gap-2 mb-1 pr-12">
              <Sparkles className="w-5 h-5 text-ui-ink" />
              Auto-Assignment Recommendation Engine
            </h3>
            <p className="text-xs text-ui-muted mb-4">
              Algorithmically matches deliverables to team members based on department skills, current workload percentage, and rolling revisions.
            </p>

            <form onSubmit={handleGetRecommendation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-ui-muted block mb-1">Work Type *</label>
                  <select
                    value={recWorkType}
                    onChange={(e) => setRecWorkType(e.target.value as WorkType)}
                    className="ui-select w-full"
                  >
                    {WORK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>{wt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[13px] font-medium text-ui-muted block mb-1">Stage Preference (Content Flow)</label>
                  <select
                    value={recStageKey}
                    onChange={(e) => setRecStageKey(e.target.value)}
                    className="ui-select w-full"
                  >
                    <option value="none">None (Standalone Department Rule)</option>
                    {WORK_PREFERENCES.map((wp) => (
                      <option key={wp} value={wp}>Stage: {wp}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[13px] font-medium text-ui-muted block mb-1">Effort (Hours) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={recEffort}
                    onChange={(e) => setRecEffort(Number(e.target.value))}
                    className="ui-input w-full"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-ui-muted block mb-1">Target Deadline</label>
                  <input
                    type="date"
                    value={recDeadline}
                    onChange={(e) => setRecDeadline(e.target.value)}
                    className="ui-input w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isRecommending}
                  className="ui-btn ui-btn-primary h-11"
                >
                  <Sparkles className="w-4 h-4" />
                  {isRecommending ? 'Calculating Best Match...' : 'Find Best Candidate'}
                </button>
              </div>
            </form>

            {/* Recommendation Result Banner */}
            {recResult && (
              <div className="mt-5 pt-5 border-t border-ui-line space-y-4 animate-fadeIn">
                <div
                  className={`p-4 rounded-2xl ${
                    recResult.isOverloadWarning ? 'band-tint band-overloaded' : 'bg-white/70 text-ui-ink'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-ui-ink block mb-1">
                        Explainable Auto-Assignment Rationale
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {recResult.rationale}
                      </h4>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${getCapacityBandBadge(
                        recResult.recommendedMetrics.capacityBand
                      )}`}
                    >
                      {recResult.recommendedMetrics.capacityBand}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-ui-line text-xs">
                    <div>
                      <span className="text-[10px] text-ui-muted font-semibold block">Current Workload</span>
                      <strong className="text-slate-800">{recResult.recommendedMetrics.workloadPct}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-ui-muted font-semibold block">Post-Assignment</span>
                      <strong className="text-ui-ink font-bold">{recResult.recommendedMetrics.newWorkloadPct}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-ui-muted font-semibold block">Available Bandwidth</span>
                      <strong className="text-slate-800">{recResult.recommendedMetrics.availableHours}h</strong>
                    </div>
                  </div>
                </div>

                {/* Manager Override Section */}
                <div className="p-4 rounded-2xl bg-white/60 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      Depart from Recommendation (Assignment Override)
                    </span>
                    <span className="text-[10px] text-ui-muted">
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
                      className="ui-select w-full"
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
                        placeholder="e.g. Specialized 3D motion skills required for specialized deliverable launch"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="ui-input w-full"
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

      {/* Per-Person Work View Drawer */}
      <PersonWorkHistoryDrawer
        isOpen={Boolean(workHistoryPersonId)}
        onClose={() => setWorkHistoryPersonId(null)}
        personId={workHistoryPersonId}
      />
    </div>
  );
};
