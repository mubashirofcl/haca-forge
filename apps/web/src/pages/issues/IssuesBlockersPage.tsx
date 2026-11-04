import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  BLOCKER_REASONS,
  BLOCKER_DEPENDENCY_REASONS,
  REVISION_ROOT_CAUSES,
  type BlockerReason,
  type RevisionRootCause,
} from '@mmp/shared';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  Bell,
  Flag,
  ExternalLink,
  Plus,
  X,
  Search,
  Check,
  Sparkles,
} from 'lucide-react';

interface BlockerItem {
  _id: string;
  reason: BlockerReason;
  notes: string;
  status: 'Active' | 'Resolved';
  blockedAt: string;
  resolvedAt?: string;
  durationHours?: number;
  durationDays?: number;
  isLongBlocked?: boolean;
  lastNotifiedAt?: string;
  workItemId?: {
    _id: string;
    title: string;
    workType: string;
    deadline: string;
    status: string;
    profileId?: { _id: string; name: string };
    departmentId?: { _id: string; name: string };
    ownerId?: { _id: string; name: string; email: string; role: string; jobRole?: string };
  };
  blockedById?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  dependencyOwnerId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
    jobRole?: string;
    departmentId?: { _id: string; name: string };
  };
  resolutionNotes?: string;
}

interface RevisionFlagItem {
  _id: string;
  revisionsCount: number;
  baselineAvg: number;
  isFlagged: boolean;
  flaggedAt: string;
  rootCause?: string;
  rootCauseNotes?: string;
  isEscalated?: boolean;
  isOver48HoursUnclassified?: boolean;
  workItemId?: {
    _id: string;
    title: string;
    workType: string;
    deadline: string;
    status: string;
    profileId?: { _id: string; name: string };
    departmentId?: { _id: string; name: string };
    revisions: number;
  };
  ownerId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
    jobRole?: string;
  };
  classifiedBy?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface PersonOption {
  _id: string;
  name: string;
  email: string;
  role: string;
  jobRole?: string;
  departmentId?: { _id: string; name: string } | string;
}

interface OpenWorkItemOption {
  _id: string;
  title: string;
  workType: string;
  ownerId?: { _id: string; name: string };
}

export const IssuesBlockersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [blockers, setBlockers] = useState<BlockerItem[]>([]);
  const [revisionFlags, setRevisionFlags] = useState<RevisionFlagItem[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [openWorkItems, setOpenWorkItems] = useState<OpenWorkItemOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'blockers' | 'flags' | 'resolved'>('blockers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>('all');

  // Remind state
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindSuccessMsg, setRemindSuccessMsg] = useState<string | null>(null);

  // Create Blocker Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkItemId, setNewWorkItemId] = useState('');
  const [newReason, setNewReason] = useState<BlockerReason>('Waiting for feedback');
  const [newNotes, setNewNotes] = useState('');
  const [newDependencyOwnerId, setNewDependencyOwnerId] = useState('');
  const [isCreatingBlocker, setIsCreatingBlocker] = useState(false);

  // Resolve Blocker Modal
  const [resolvingBlocker, setResolvingBlocker] = useState<BlockerItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resumeStatus, setResumeStatus] = useState('In Progress');
  const [isResolving, setIsResolving] = useState(false);

  // Classify Root Cause Modal
  const [classifyingFlag, setClassifyingFlag] = useState<RevisionFlagItem | null>(null);
  const [selectedRootCause, setSelectedRootCause] = useState<RevisionRootCause>('Brief unclear');
  const [rootCauseNotes, setRootCauseNotes] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);

  // Load data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [blockersRes, flagsRes, peopleRes, workRes] = await Promise.all([
        apiFetch<{ data: BlockerItem[] }>('/api/blockers?status=Active'),
        apiFetch<{ data: RevisionFlagItem[] }>('/api/revisions/flags'),
        apiFetch<{ data: PersonOption[] }>('/api/people?active=true'),
        apiFetch<{ data: OpenWorkItemOption[] }>('/api/work?status=In Progress'),
      ]);

      setBlockers(blockersRes.data || []);
      setRevisionFlags(flagsRes.data || []);
      setPeople(peopleRes.data || []);
      setOpenWorkItems(workRes.data || []);
    } catch (err) {
      console.error('Failed to load issues and blockers', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Send Reminder to Dependency Owner
  const handleNotifyDependency = async (blockerId: string) => {
    setRemindingId(blockerId);
    setRemindSuccessMsg(null);
    try {
      await apiFetch(`/api/blockers/${blockerId}/notify`, { method: 'POST' });
      setRemindSuccessMsg('Reminder dispatched to dependency owner via notification & email.');
      await fetchData();
      setTimeout(() => setRemindSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch reminder');
    } finally {
      setRemindingId(null);
    }
  };

  // Submit New Blocker
  const handleCreateBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkItemId) {
      alert('Please select a deliverable to mark as blocked.');
      return;
    }

    if (BLOCKER_DEPENDENCY_REASONS.includes(newReason) && !newDependencyOwnerId) {
      alert('A Dependency Owner is mandatory for ' + newReason);
      return;
    }

    setIsCreatingBlocker(true);
    try {
      await apiFetch('/api/blockers', {
        method: 'POST',
        body: JSON.stringify({
          workItemId: newWorkItemId,
          reason: newReason,
          notes: newNotes.trim(),
          dependencyOwnerId: newDependencyOwnerId || undefined,
        }),
      });

      setIsCreateModalOpen(false);
      setNewWorkItemId('');
      setNewNotes('');
      setNewDependencyOwnerId('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to report blocker');
    } finally {
      setIsCreatingBlocker(false);
    }
  };

  // Resolve Blocker
  const handleResolveBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingBlocker) return;

    setIsResolving(true);
    try {
      await apiFetch(`/api/blockers/${resolvingBlocker._id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({
          resolutionNotes: resolutionNotes.trim(),
          resumeStatus,
        }),
      });

      setResolvingBlocker(null);
      setResolutionNotes('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve blocker');
    } finally {
      setIsResolving(false);
    }
  };

  // Classify Flag
  const handleClassifyFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classifyingFlag) return;

    setIsClassifying(true);
    try {
      await apiFetch(`/api/revisions/flags/${classifyingFlag._id}/classify`, {
        method: 'POST',
        body: JSON.stringify({
          rootCause: selectedRootCause,
          rootCauseNotes: rootCauseNotes.trim(),
        }),
      });

      setClassifyingFlag(null);
      setRootCauseNotes('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to classify root cause');
    } finally {
      setIsClassifying(false);
    }
  };

  // Computed Metrics
  const metrics = useMemo(() => {
    const activeBlockersCount = blockers.length;
    const longBlockedCount = blockers.filter((b) => (b.durationHours || 0) > 48).length;
    const totalFlagsCount = revisionFlags.length;
    const escalatedFlagsCount = revisionFlags.filter(
      (f) => f.isEscalated || f.isOver48HoursUnclassified
    ).length;

    return {
      activeBlockersCount,
      longBlockedCount,
      totalFlagsCount,
      escalatedFlagsCount,
    };
  }, [blockers, revisionFlags]);

  // Filtered Blockers
  const filteredBlockers = useMemo(() => {
    return blockers.filter((b) => {
      if (selectedReason !== 'all' && b.reason !== selectedReason) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = b.workItemId?.title?.toLowerCase().includes(q);
        const matchOwner = b.dependencyOwnerId?.name?.toLowerCase().includes(q);
        const matchReporter = b.blockedById?.name?.toLowerCase().includes(q);
        if (!matchTitle && !matchOwner && !matchReporter) return false;
      }
      return true;
    });
  }, [blockers, selectedReason, searchQuery]);

  // Filtered Revision Flags
  const filteredFlags = useMemo(() => {
    return revisionFlags.filter((f) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = f.workItemId?.title?.toLowerCase().includes(q);
        const matchOwner = f.ownerId?.name?.toLowerCase().includes(q);
        const matchCause = f.rootCause?.toLowerCase().includes(q);
        if (!matchTitle && !matchOwner && !matchCause) return false;
      }
      return true;
    });
  }, [revisionFlags, searchQuery]);

  const isLeadOrAdmin = user?.role === 'admin' || user?.role === 'creative_head' || user?.role === 'sm_manager';

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner Cockpit */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-500/30 text-rose-200 border border-rose-400/30">
                Screen 11 • Operational Console
              </span>
              <span className="text-xs text-rose-200/80 font-medium">Blockers & Root Cause Triage</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
              Issues and Blockers
            </h1>
            <p className="text-sm text-rose-200/70 mt-1 max-w-2xl">
              Dedicated operational console to resolve active blockers, alert dependency owners, and classify flagged revision patterns before delivery schedules slip.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Report Deliverable Blocker</span>
            </button>
            <button
              onClick={() => navigate('/feedback')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-2 shadow-sm"
            >
              <span>Feedback Threads</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 block mb-0.5">
              Active Blockers
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">{metrics.activeBlockersCount}</span>
              <span className="text-xs text-rose-300/80">Deliverables</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block mb-0.5">
              Long-Blocked (&gt;48h)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">{metrics.longBlockedCount}</span>
              <span className="text-xs text-amber-300/80">Critical SLA</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 block mb-0.5">
              Revision Flags
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-400">{metrics.totalFlagsCount}</span>
              <span className="text-xs text-purple-300/80">Pattern Alerts</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 block mb-0.5">
              48h Unclassified
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">{metrics.escalatedFlagsCount}</span>
              <span className="text-xs text-rose-300/80">Escalated to Head</span>
            </div>
          </div>
        </div>
      </div>

      {/* Remind Feedback Toast */}
      {remindSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{remindSuccessMsg}</span>
        </div>
      )}

      {/* View Switcher Tabs & Filters */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('blockers')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'blockers'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Active Blockers ({metrics.activeBlockersCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'flags'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>Revision Flags ({metrics.totalFlagsCount})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'blockers' && (
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none"
            >
              <option value="all">All Blocker Reasons</option>
              {BLOCKER_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </div>
        </div>
      </div>

      {/* Main Tab 1: Active Blockers */}
      {activeTab === 'blockers' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
              Loading active blockers...
            </div>
          ) : filteredBlockers.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
              <h3 className="text-sm font-bold text-slate-800">Zero Active Blockers</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No deliverables are currently blocked. Teams are working smoothly across production schedules.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBlockers.map((b) => (
                <div
                  key={b._id}
                  className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          {b.reason}
                        </span>
                        {b.isLongBlocked && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white animate-pulse">
                            &gt;48h Blocked
                          </span>
                        )}
                      </div>
                      <h3
                        onClick={() => b.workItemId?._id && navigate(`/work/${b.workItemId._id}`)}
                        className="text-sm font-black text-slate-900 hover:text-purple-600 cursor-pointer transition-colors"
                      >
                        {b.workItemId?.title || 'Deliverable'}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 font-semibold block">Duration</span>
                      <strong className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {b.durationHours}h ({b.durationDays}d)
                      </strong>
                    </div>
                  </div>

                  {b.notes && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                        Blocker Context:
                      </span>
                      {b.notes}
                    </div>
                  )}

                  {/* Dependency Owner Highlight */}
                  {b.dependencyOwnerId && (
                    <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center">
                          {b.dependencyOwnerId.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-amber-800 block">
                            Dependency Owner:
                          </span>
                          <strong className="text-slate-900">{b.dependencyOwnerId.name}</strong>
                          <span className="text-slate-500 text-[11px]"> ({b.dependencyOwnerId.jobRole || 'Member'})</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleNotifyDependency(b._id)}
                        disabled={remindingId === b._id}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-50"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>{remindingId === b._id ? 'Sending...' : 'Ping Owner'}</span>
                      </button>
                    </div>
                  )}

                  {/* Actions Strip */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      Reported by {b.blockedById?.name || 'Owner'}
                    </span>

                    <button
                      onClick={() => setResolvingBlocker(b)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Resolve & Unblock</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Tab 2: Revision Flags */}
      {activeTab === 'flags' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">
              Loading revision flags...
            </div>
          ) : filteredFlags.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
              <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-1" />
              <h3 className="text-sm font-bold text-slate-800">Zero Flagged Revision Patterns</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No deliverables have breached the 4th round revision ceiling or exceeded their owner baseline.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFlags.map((f) => {
                const isEscalated = f.isEscalated || f.isOver48HoursUnclassified;

                return (
                  <div
                    key={f._id}
                    className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {f.workItemId?.workType || 'Deliverable'}
                          </span>
                          {isEscalated && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white animate-pulse">
                              Escalated to Marketing Head
                            </span>
                          )}
                        </div>
                        <h3
                          onClick={() => f.workItemId?._id && navigate(`/work/${f.workItemId._id}`)}
                          className="text-sm font-black text-slate-900 hover:text-purple-600 cursor-pointer transition-colors"
                        >
                          {f.workItemId?.title || 'Deliverable'}
                        </h3>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Owner: <strong>{f.ownerId?.name || 'Unassigned'}</strong>
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-semibold block">Revision Cycles</span>
                        <strong className="text-xs font-black text-rose-600">
                          {f.revisionsCount} revs
                        </strong>
                        <span className="text-[10px] text-slate-400 block">
                          (Baseline: {f.baselineAvg})
                        </span>
                      </div>
                    </div>

                    {/* Root Cause Card */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Root Cause Analysis:
                        </span>
                        {f.rootCause ? (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                            Classified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800">
                            Unclassified
                          </span>
                        )}
                      </div>

                      {f.rootCause ? (
                        <div>
                          <strong className="text-slate-900 font-bold text-xs">{f.rootCause}</strong>
                          {f.rootCauseNotes && (
                            <p className="text-[11px] text-slate-600 mt-0.5">{f.rootCauseNotes}</p>
                          )}
                          <span className="text-[10px] text-slate-400 block mt-1">
                            Classified by {f.classifiedBy?.name || 'Manager'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          Requires SM Manager or Creative Head root-cause classification.
                        </p>
                      )}
                    </div>

                    {/* Actions Strip */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">
                        Flagged on {new Date(f.flaggedAt).toLocaleDateString()}
                      </span>

                      {!f.rootCause && isLeadOrAdmin && (
                        <button
                          onClick={() => setClassifyingFlag(f)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Classify Root Cause</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Report Deliverable Blocker */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Report Deliverable Blocker
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBlocker} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Deliverable *
                </label>
                <select
                  required
                  value={newWorkItemId}
                  onChange={(e) => setNewWorkItemId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">-- Choose active deliverable --</option>
                  {openWorkItems.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title} ({item.workType}) — {item.ownerId?.name || 'Unassigned'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Canonical Blocker Reason *
                </label>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value as BlockerReason)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  {BLOCKER_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {BLOCKER_DEPENDENCY_REASONS.includes(newReason) && (
                <div className="animate-fadeIn p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                  <label className="text-xs font-bold text-amber-900 block mb-1">
                    Mandatory Dependency Owner *
                  </label>
                  <select
                    required
                    value={newDependencyOwnerId}
                    onChange={(e) => setNewDependencyOwnerId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-amber-300 bg-white"
                  >
                    <option value="">-- Select dependency owner --</option>
                    {people.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.jobRole || p.role})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-amber-800/80 mt-1">
                    An immediate alert and email will be dispatched to this owner to unblock your task.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Context / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain exactly what is missing or required to proceed..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBlocker}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-50"
                >
                  {isCreatingBlocker ? 'Reporting...' : 'Report Blocker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Resolve Blocker */}
      {resolvingBlocker && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Resolve Deliverable Blocker
                </h3>
              </div>
              <button
                onClick={() => setResolvingBlocker(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolveBlocker} className="space-y-4 mt-4">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[10px] text-slate-400 font-semibold block">Deliverable:</span>
                <strong className="text-slate-900">{resolvingBlocker.workItemId?.title}</strong>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Blocker: {resolvingBlocker.reason}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Resolution Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe how the blocker was resolved (e.g. Writer delivered final copy)..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Resume Work Item Status:
                </label>
                <select
                  value={resumeStatus}
                  onChange={(e) => setResumeStatus(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Feedback">Feedback</option>
                  <option value="Not Started">Not Started</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingBlocker(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolving}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50"
                >
                  {isResolving ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Classify Root Cause */}
      {classifyingFlag && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Classify Revision Root Cause
                </h3>
              </div>
              <button
                onClick={() => setClassifyingFlag(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClassifyFlag} className="space-y-4 mt-4">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[10px] text-slate-400 font-semibold block">Deliverable:</span>
                <strong className="text-slate-900">{classifyingFlag.workItemId?.title}</strong>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Revisions: {classifyingFlag.revisionsCount} (baseline: {classifyingFlag.baselineAvg})
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  1 of 7 Canonical Root Causes *
                </label>
                <select
                  value={selectedRootCause}
                  onChange={(e) => setSelectedRootCause(e.target.value as RevisionRootCause)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  {REVISION_ROOT_CAUSES.map((cause) => (
                    <option key={cause} value={cause}>
                      {cause}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Root Cause Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe root cause details to improve future brief clarity..."
                  value={rootCauseNotes}
                  onChange={(e) => setRootCauseNotes(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClassifyingFlag(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClassifying}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md disabled:opacity-50"
                >
                  {isClassifying ? 'Saving...' : 'Save Classification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
