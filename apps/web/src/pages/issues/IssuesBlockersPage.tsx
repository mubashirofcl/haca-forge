import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  BLOCKER_REASONS,
  BLOCKER_DEPENDENCY_REASONS,
  CANONICAL_REVISION_ROOT_CAUSES,
  type BlockerReason,
  type CanonicalRevisionRootCause,
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
  AlertTriangle,
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
  const { user, hasPermission } = useAuth();
  // Same permissions the API checks on /api/blockers create, resolve and notify (blockers/routes.js).
  // Every role except executive holds one of them, so only executive loses these actions.
  const canManageBlockers = hasPermission('work.request') || hasPermission('work.update.own');
  // Same rule as the API: resolving or reminding is for the step owner, an SM Manager or an Admin.
  const canActOnBlocker = (blocker: BlockerItem) => {
    if (!canManageBlockers) return false;
    if (user?.role === 'admin' || user?.role === 'sm_manager') return true;
    const viewerId = (user as any)?._id || (user as any)?.id || (user as any)?.userId;
    return Boolean(viewerId && blocker.workItemId?.ownerId?._id === viewerId);
  };
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
  const [selectedRootCause, setSelectedRootCause] = useState<CanonicalRevisionRootCause>(CANONICAL_REVISION_ROOT_CAUSES[0]);
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
    <div className="space-y-6 pb-12">
      {/* Page title on the canvas */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-[13px] font-medium text-ui-muted">
            <span>Operational Console</span>
            <span aria-hidden="true">·</span>
            <span>Blockers & Root Cause Triage</span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">
            Issues and Blockers
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ui-muted max-w-[70ch]">
            Dedicated operational console to resolve active blockers, alert dependency owners, and classify flagged revision patterns before delivery schedules slip.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canManageBlockers && (
            <button onClick={() => setIsCreateModalOpen(true)} className="ui-btn ui-btn-primary h-11 grow sm:grow-0">
              <Plus className="w-4 h-4" />
              <span>Report Deliverable Blocker</span>
            </button>
          )}
          <button onClick={() => navigate('/feedback')} className="ui-btn ui-btn-secondary bg-transparent h-11 grow sm:grow-0">
            <span>Feedback Threads</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI strip: one card, hairline dividers. Coral marks blocker counts; the label carries the meaning. */}
      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ui-line">
          {[
            { label: 'Active Blockers', value: metrics.activeBlockersCount, unit: 'Deliverables', Icon: ShieldAlert, tone: 'text-ui-coral' },
            { label: 'Long-Blocked (>48h)', value: metrics.longBlockedCount, unit: 'Critical SLA', Icon: Clock, tone: 'text-ui-coral' },
            { label: 'Revision Flags', value: metrics.totalFlagsCount, unit: 'Pattern Alerts', Icon: Flag, tone: 'text-ui-ink' },
            { label: '48h Unclassified', value: metrics.escalatedFlagsCount, unit: 'Escalated to Head', Icon: AlertTriangle, tone: 'text-ui-ink' },
          ].map(({ label, value, unit, Icon, tone }) => (
            <div key={label} className="p-5 bg-ui-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ui-muted">{label}</span>
                <Icon className={`w-4 h-4 shrink-0 ${tone}`} aria-hidden="true" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[28px] leading-9 font-semibold text-ui-ink tabular-nums">{value}</span>
                <span className="text-xs text-ui-muted">{unit}</span>
              </div>
            </div>
          ))}
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
      <div className="glass-panel rounded-ui-panel p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto no-scrollbar">
        <div className="ui-tabs">
          <button
            onClick={() => setActiveTab('blockers')}
            aria-pressed={activeTab === 'blockers'}
            className={`ui-tab ${activeTab === 'blockers' ? 'is-active' : ''}`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Active Blockers ({metrics.activeBlockersCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('flags')}
            aria-pressed={activeTab === 'flags'}
            className={`ui-tab ${activeTab === 'flags' ? 'is-active' : ''}`}
          >
            <Flag className="w-4 h-4" />
            <span>Revision Flags ({metrics.totalFlagsCount})</span>
          </button>
        </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'blockers' && (
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              aria-label="Blocker reason"
              className="ui-select"
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
            <Search className="w-4 h-4 text-ui-muted absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search title or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search title or owner"
              className="ui-input w-full pl-10 pr-3"
            />
          </div>
        </div>
      </div>

      {/* Main Tab 1: Active Blockers */}
      {activeTab === 'blockers' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="glass-card p-12 text-center text-[13px] text-ui-muted">
              Loading active blockers...
            </div>
          ) : filteredBlockers.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
              <h3 className="text-sm font-semibold text-ui-ink">Zero Active Blockers</h3>
              <p className="text-xs text-ui-muted max-w-md mx-auto">
                No deliverables are currently blocked. Teams are working smoothly across production schedules.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBlockers.map((b) => (
                <div
                  key={b._id}
                  className="glass-card p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="status-chip status-changes text-[11px] font-semibold px-2 py-0.5">
                          {b.reason}
                        </span>
                        {b.isLongBlocked && (
                          <span className="status-chip status-blocked text-[11px] font-semibold px-2 py-0.5">
                            &gt;48h Blocked
                          </span>
                        )}
                      </div>
                      <h3 className="text-[15px] font-semibold text-ui-ink">
                        <button
                          type="button"
                          disabled={!b.workItemId?._id}
                          onClick={() => b.workItemId?._id && navigate(`/work/${b.workItemId._id}`)}
                          className="text-left hover:underline underline-offset-4 rounded-md disabled:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2"
                        >
                        {b.workItemId?.title || 'Deliverable'}
                        </button>
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-ui-muted font-semibold block">Duration</span>
                      <strong className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-ui-muted" />
                        {b.durationHours}h ({b.durationDays}d)
                      </strong>
                    </div>
                  </div>

                  {b.notes && (
                    <div className="p-3 rounded-xl bg-white/60 text-xs text-ui-text">
                      <span className="text-[10px] font-bold text-ui-muted block mb-0.5">
                        Blocker Context:
                      </span>
                      {b.notes}
                    </div>
                  )}

                  {/* Dependency Owner Highlight */}
                  {b.dependencyOwnerId && (
                    <div className="p-3 rounded-2xl bg-white/60 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-ui-ink/10 text-ui-ink font-semibold text-xs flex items-center justify-center">
                          {b.dependencyOwnerId.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-ui-muted block">
                            Dependency Owner:
                          </span>
                          <strong className="text-slate-900">{b.dependencyOwnerId.name}</strong>
                          <span className="text-ui-muted text-[11px]"> ({b.dependencyOwnerId.jobRole || 'Member'})</span>
                        </div>
                      </div>

                      {canActOnBlocker(b) && (
                        <button
                          onClick={() => handleNotifyDependency(b._id)}
                          disabled={remindingId === b._id}
                          className="ui-btn ui-btn-primary h-11 px-4"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>{remindingId === b._id ? 'Sending...' : 'Ping Owner'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Actions Strip */}
                  <div className="pt-3 border-t border-ui-line flex items-center justify-between text-xs">
                    <span className="text-[11px] text-ui-muted">
                      Reported by {b.blockedById?.name || 'Owner'}
                    </span>

                    {canActOnBlocker(b) && (
                      <button
                        onClick={() => setResolvingBlocker(b)}
                        className="ui-btn ui-btn-secondary h-11 px-4"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolve & Unblock</span>
                      </button>
                    )}
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
            <div className="glass-card p-12 text-center text-[13px] text-ui-muted">
              Loading revision flags...
            </div>
          ) : filteredFlags.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-ui-ink mx-auto mb-1" />
              <h3 className="text-sm font-semibold text-ui-ink">Zero Flagged Revision Patterns</h3>
              <p className="text-xs text-ui-muted max-w-md mx-auto">
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
                    className="glass-card p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-ui-text">
                            {f.workItemId?.workType || 'Deliverable'}
                          </span>
                          {isEscalated && (
                            <span className="status-chip status-blocked text-[11px] font-semibold px-2 py-0.5">
                              Escalated to Marketing Head
                            </span>
                          )}
                        </div>
                        <h3 className="text-[15px] font-semibold text-ui-ink">
                          <button
                            type="button"
                            disabled={!f.workItemId?._id}
                            onClick={() => f.workItemId?._id && navigate(`/work/${f.workItemId._id}`)}
                            className="text-left hover:underline underline-offset-4 rounded-md disabled:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2"
                          >
                          {f.workItemId?.title || 'Deliverable'}
                          </button>
                        </h3>
                        <span className="text-[11px] text-ui-muted block mt-0.5">
                          Owner: <strong>{f.ownerId?.name || 'Unassigned'}</strong>
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-ui-muted font-semibold block">Revision Cycles</span>
                        <strong className="text-sm font-semibold text-ui-ink tabular-nums">
                          {f.revisionsCount} revs
                        </strong>
                        <span className="text-[10px] text-ui-muted block">
                          (Baseline: {f.baselineAvg})
                        </span>
                      </div>
                    </div>

                    {/* Root Cause Card */}
                    <div className="p-3.5 rounded-2xl bg-white/60 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-ui-muted">
                          Root Cause Analysis:
                        </span>
                        {f.rootCause ? (
                          <span className="status-chip status-approved px-2 py-0.5 font-semibold text-[11px]">
                            Classified
                          </span>
                        ) : (
                          <span className="status-chip status-waiting px-2 py-0.5 font-semibold text-[11px]">
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
                          <span className="text-[10px] text-ui-muted block mt-1">
                            Classified by {f.classifiedBy?.name || 'Manager'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-ui-muted italic">
                          Requires SM Manager or Creative Head root-cause classification.
                        </p>
                      )}
                    </div>

                    {/* Actions Strip */}
                    <div className="pt-3 border-t border-ui-line flex items-center justify-between text-xs">
                      <span className="text-[11px] text-ui-muted">
                        Flagged on {new Date(f.flaggedAt).toLocaleDateString()}
                      </span>

                      {!f.rootCause && isLeadOrAdmin && (
                        <button
                          onClick={() => setClassifyingFlag(f)}
                          className="ui-btn ui-btn-primary h-11 px-4"
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
      {canManageBlockers && isCreateModalOpen && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-modal max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-ui-coral" />
                <h3 className="text-base font-semibold text-ui-ink">
                  Report Deliverable Blocker
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close" className="ui-icon-btn"
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
                  className="ui-select w-full"
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
                  className="ui-select w-full"
                >
                  {BLOCKER_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {BLOCKER_DEPENDENCY_REASONS.includes(newReason) && (
                <div className="p-3.5 rounded-2xl status-tint status-waiting">
                  <label className="text-xs font-semibold block mb-1">
                    Mandatory Dependency Owner *
                  </label>
                  <select
                    required
                    value={newDependencyOwnerId}
                    onChange={(e) => setNewDependencyOwnerId(e.target.value)}
                    className="ui-select w-full"
                  >
                    <option value="">-- Select dependency owner --</option>
                    {people.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.jobRole || p.role})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs mt-1">
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
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-ui-line">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBlocker}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {isCreatingBlocker ? 'Reporting...' : 'Report Blocker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Resolve Blocker */}
      {canManageBlockers && resolvingBlocker && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-modal max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-semibold text-ui-ink">
                  Resolve Deliverable Blocker
                </h3>
              </div>
              <button
                onClick={() => setResolvingBlocker(null)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolveBlocker} className="space-y-4 mt-4">
              <div className="p-3 rounded-2xl bg-white/60 text-xs">
                <span className="text-[10px] text-ui-muted font-semibold block">Deliverable:</span>
                <strong className="text-slate-900">{resolvingBlocker.workItemId?.title}</strong>
                <span className="text-ui-muted text-[11px] block mt-0.5">
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
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Resume Work Item Status:
                </label>
                <select
                  value={resumeStatus}
                  onChange={(e) => setResumeStatus(e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Feedback">Feedback</option>
                  <option value="Not Started">Not Started</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-ui-line">
                <button
                  type="button"
                  onClick={() => setResolvingBlocker(null)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolving}
                  className="ui-btn ui-btn-primary h-11"
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
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-modal max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-ui-ink" />
                <h3 className="text-base font-semibold text-ui-ink">
                  Classify Revision Root Cause
                </h3>
              </div>
              <button
                onClick={() => setClassifyingFlag(null)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClassifyFlag} className="space-y-4 mt-4">
              <div className="p-3 rounded-2xl bg-white/60 text-xs">
                <span className="text-[10px] text-ui-muted font-semibold block">Deliverable:</span>
                <strong className="text-slate-900">{classifyingFlag.workItemId?.title}</strong>
                <span className="text-ui-muted text-[11px] block mt-0.5">
                  Revisions: {classifyingFlag.revisionsCount} (baseline: {classifyingFlag.baselineAvg})
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  1 of 7 Canonical Root Causes *
                </label>
                <select
                  value={selectedRootCause}
                  onChange={(e) => setSelectedRootCause(e.target.value as CanonicalRevisionRootCause)}
                  className="ui-select w-full"
                >
                  {CANONICAL_REVISION_ROOT_CAUSES.map((cause) => (
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
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-ui-line">
                <button
                  type="button"
                  onClick={() => setClassifyingFlag(null)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClassifying}
                  className="ui-btn ui-btn-primary h-11"
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
