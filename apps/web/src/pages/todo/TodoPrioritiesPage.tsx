import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  BLOCKER_REASONS,
  type WorkType,
  type WorkItemStatus,
  type Priority,
  type BlockerReason,
} from '@mmp/shared';
import {
  Clock,
  AlertTriangle,
  Play,
  Send,
  Ban,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  X,
  Search,
  Sparkles,
  FileCheck,
  ListTodo,
} from 'lucide-react';

interface TodoWorkItem {
  _id: string;
  title: string;
  workType: WorkType;
  deadline: string;
  estimatedEffortHrs: number;
  status: WorkItemStatus;
  priority: Priority;
  revisions: number;
  blockerReason?: BlockerReason;
  blockerNote?: string;
  deliverableUrl?: string;
  campaignId: { _id: string; name: string };
  profileId: { _id: string; name: string; code: string };
  departmentId?: { _id: string; name: string };
  ownerId?: { _id: string; name: string; email: string; jobRole?: string };
}

interface TodoResponse {
  overdue: TodoWorkItem[];
  today: TodoWorkItem[];
  upcoming: TodoWorkItem[];
  total: number;
}

const PRIORITY_BADGES: Record<Priority, { bg: string; text: string }> = {
  High: { bg: 'bg-rose-100 text-rose-700 border-rose-200', text: 'text-rose-700' },
  Medium: { bg: 'bg-blue-100 text-blue-700 border-blue-200', text: 'text-blue-700' },
  Low: { bg: 'bg-slate-100 text-slate-700 border-slate-200', text: 'text-slate-700' },
};

export const TodoPrioritiesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<TodoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');

  // Blocker Modal State
  const [selectedItemForBlock, setSelectedItemForBlock] = useState<TodoWorkItem | null>(null);
  const [blockerReason, setBlockerReason] = useState<BlockerReason>('Waiting for feedback');
  const [blockerNote, setBlockerNote] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Deliverable Submit Modal State
  const [selectedItemForSubmit, setSelectedItemForSubmit] = useState<TodoWorkItem | null>(null);
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [submitComment, setSubmitComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchTodo = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: TodoResponse }>('/api/work/todo');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load todo priorities', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodo();
  }, []);

  // Quick State Transitions
  const handleTransition = async (itemId: string, newStatus: WorkItemStatus, extraPayload = {}) => {
    try {
      await apiFetch(`/api/work/${itemId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus: newStatus,
          ...extraPayload,
        }),
      });
      fetchTodo();
    } catch (err: any) {
      alert(err.message || `Failed to transition item to ${newStatus}`);
    }
  };

  const handleStartWork = (item: TodoWorkItem) => {
    handleTransition(item._id, 'In Progress');
  };

  const handleOpenSubmit = (item: TodoWorkItem) => {
    setSelectedItemForSubmit(item);
    setDeliverableUrl(item.deliverableUrl || '');
    setSubmitComment('');
    setSubmitError(null);
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForSubmit) return;
    if (!deliverableUrl.trim()) {
      setSubmitError('Deliverable URL is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await handleTransition(selectedItemForSubmit._id, 'Feedback', {
        deliverableUrl: deliverableUrl.trim(),
        comment: submitComment.trim() || undefined,
      });
      setSelectedItemForSubmit(null);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit deliverable');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBlockModal = (item: TodoWorkItem) => {
    setSelectedItemForBlock(item);
    setBlockerReason('Waiting for feedback');
    setBlockerNote('');
    setBlockError(null);
  };

  const handleConfirmBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForBlock) return;

    setIsBlocking(true);
    setBlockError(null);

    try {
      await handleTransition(selectedItemForBlock._id, 'Blocked', {
        blockerReason,
        blockerNote: blockerNote.trim() || undefined,
      });
      setSelectedItemForBlock(null);
    } catch (err: any) {
      setBlockError(err.message || 'Failed to mark deliverable as blocked');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblock = (item: TodoWorkItem) => {
    handleTransition(item._id, 'In Progress', {
      comment: 'Blocker cleared. Resumed execution.',
    });
  };

  // Filter items by search query
  const filterList = (list?: TodoWorkItem[]) => {
    if (!list) return [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.workType.toLowerCase().includes(q) ||
        it.campaignId?.name?.toLowerCase().includes(q) ||
        it.profileId?.name?.toLowerCase().includes(q) ||
        it.ownerId?.name?.toLowerCase().includes(q)
    );
  };

  const overdueFiltered = useMemo(() => filterList(data?.overdue), [data, searchQuery]);
  const todayFiltered = useMemo(() => filterList(data?.today), [data, searchQuery]);
  const upcomingFiltered = useMemo(() => filterList(data?.upcoming), [data, searchQuery]);

  const roleScopedSubtitle = useMemo(() => {
    if (user?.role === 'marketing_head' || user?.role === 'admin') {
      return 'Org-wide priorities and production deliverables across all teams.';
    }
    if (user?.role === 'team_lead') {
      return 'Team priorities and deliverables pending completion.';
    }
    return 'Your personal priority queue with one-click transitions and zero noise.';
  }, [user]);

  // Card Component for Deliverables
  const renderItemCard = (item: TodoWorkItem, section: 'overdue' | 'today' | 'upcoming') => {
    const isLeadOrAdmin = user?.role === 'team_lead' || user?.role === 'marketing_head' || user?.role === 'admin';
    const isOwner = (item.ownerId?._id || item.ownerId) === (user?._id || user?.id);
    const canTransition = isLeadOrAdmin || isOwner;

    const deadlineDate = new Date(item.deadline);
    const formattedDeadline = deadlineDate.toLocaleDateString('default', {
      month: 'short',
      day: 'numeric',
    });

    const priorityBadge = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.Medium;

    return (
      <div
        key={item._id}
        className={`glass-card p-5 border transition-all ${
          section === 'overdue'
            ? 'border-rose-200/90 bg-rose-50/20 hover:border-rose-300'
            : section === 'today'
            ? 'border-purple-200/90 bg-purple-50/15 hover:border-purple-300'
            : 'border-slate-200/90 hover:border-slate-300'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {item.profileId?.name || 'Brand'}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                {item.workType}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge.bg}`}>
                {item.priority.toUpperCase()}
              </span>

              {item.status === 'Blocked' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <Ban className="w-3 h-3" />
                  Blocked: {item.blockerReason}
                </span>
              )}

              {item.status === 'Feedback' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                  In Review ({item.revisions} rev)
                </span>
              )}
            </div>

            <h3
              onClick={() => navigate(`/work/${item._id}`)}
              className="text-base font-bold text-slate-900 hover:text-purple-600 transition-colors cursor-pointer tracking-tight"
            >
              {item.title}
            </h3>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs text-slate-500">
              <span>
                Campaign: <strong className="text-slate-700 font-semibold">{item.campaignId?.name}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Est. {item.estimatedEffortHrs}h
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Due: <strong className={section === 'overdue' ? 'text-rose-600 font-bold' : 'text-slate-700 font-semibold'}>{formattedDeadline}</strong>
              </span>
              {item.ownerId && (
                <span>
                  Owner: <strong className="text-slate-700 font-semibold">{item.ownerId.name}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {canTransition && (
              <>
                {item.status === 'Not Started' && (
                  <button
                    onClick={() => handleStartWork(item)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start
                  </button>
                )}

                {item.status === 'In Progress' && (
                  <>
                    <button
                      onClick={() => handleOpenSubmit(item)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit
                    </button>
                    <button
                      onClick={() => handleOpenBlockModal(item)}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Block
                    </button>
                  </>
                )}

                {item.status === 'Blocked' && (
                  <button
                    onClick={() => handleUnblock(item)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Clear Blocker
                  </button>
                )}

                {isLeadOrAdmin && (item.status === 'Feedback' || item.status === 'In Progress') && (
                  <button
                    onClick={() => handleTransition(item._id, 'Approved')}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center gap-1"
                    title="Lead / Admin Approval"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => navigate(`/work/${item._id}`)}
              className="p-2 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              title="Open Single Work Detail"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Screen 10 • Priorities
            </span>
            <span className="text-xs text-slate-500 font-medium">Clarity Focus Queue</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <ListTodo className="w-8 h-8 text-purple-600" />
            Todo & Priorities
          </h1>
          <p className="text-sm text-slate-500 mt-1">{roleScopedSubtitle}</p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search deliverables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-700"
          />
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('all')}
          className={`glass-card p-4 border cursor-pointer transition-all ${
            activeTab === 'all' ? 'ring-2 ring-purple-500/30 border-purple-300' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{data?.total ?? 0}</div>
          <span className="text-[11px] text-slate-500 font-medium">In execution queue</span>
        </div>

        <div
          onClick={() => setActiveTab('overdue')}
          className={`glass-card p-4 border cursor-pointer transition-all ${
            activeTab === 'overdue' ? 'ring-2 ring-rose-500/30 border-rose-300' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{data?.overdue?.length ?? 0}</div>
          <span className="text-[11px] text-rose-500 font-medium">Missed target deadline</span>
        </div>

        <div
          onClick={() => setActiveTab('today')}
          className={`glass-card p-4 border cursor-pointer transition-all ${
            activeTab === 'today' ? 'ring-2 ring-purple-500/30 border-purple-300' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Due Today</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-600 mt-1">{data?.today?.length ?? 0}</div>
          <span className="text-[11px] text-purple-500 font-medium">Immediate focus</span>
        </div>

        <div
          onClick={() => setActiveTab('upcoming')}
          className={`glass-card p-4 border cursor-pointer transition-all ${
            activeTab === 'upcoming' ? 'ring-2 ring-blue-500/30 border-blue-300' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-700 mt-1">{data?.upcoming?.length ?? 0}</div>
          <span className="text-[11px] text-slate-500 font-medium">Future scheduled</span>
        </div>
      </div>

      {/* Partitioned Sections */}
      {isLoading ? (
        <div className="glass-card p-12 text-center border border-slate-200">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600">Loading priority items...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Overdue Deliverables */}
          {(activeTab === 'all' || activeTab === 'overdue') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Overdue Deliverables ({overdueFiltered.length})
                  </h2>
                </div>
                {overdueFiltered.length > 0 && (
                  <span className="text-xs text-rose-600 font-medium">Requires immediate unblocking</span>
                )}
              </div>

              {overdueFiltered.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>No overdue deliverables. You are on track with target dates!</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueFiltered.map((it) => renderItemCard(it, 'overdue'))}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Due Today */}
          {(activeTab === 'all' || activeTab === 'today') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Due Today ({todayFiltered.length})
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">Focus on completing these first</span>
              </div>

              {todayFiltered.length === 0 ? (
                <div className="p-6 rounded-xl bg-white/70 border border-slate-200 text-center">
                  <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No deliverables due today</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Take time to review upcoming tasks or refine ongoing drafts.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayFiltered.map((it) => renderItemCard(it, 'today'))}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Upcoming Deliverables */}
          {(activeTab === 'all' || activeTab === 'upcoming') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Upcoming Deliverables ({upcomingFiltered.length})
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">Scheduled for this sprint</span>
              </div>

              {upcomingFiltered.length === 0 ? (
                <div className="p-6 rounded-xl bg-white/70 border border-slate-200 text-center">
                  <p className="text-xs font-semibold text-slate-600">No upcoming deliverables scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingFiltered.map((it) => renderItemCard(it, 'upcoming'))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DELIVERABLE SUBMIT MODAL */}
      {selectedItemForSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="glass-modal w-full max-w-lg p-6 relative">
            <button
              onClick={() => setSelectedItemForSubmit(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
              <FileCheck className="w-5 h-5 text-emerald-600" />
              Submit for Review
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Move &quot;{selectedItemForSubmit.title}&quot; to Feedback state for Lead / Peer review.
            </p>

            {submitError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDeliverable} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Deliverable Link / Artifact URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/... or Figma link"
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Notes for Reviewer (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Added motion blur effect and updated call-to-action text."
                  value={submitComment}
                  onChange={(e) => setSubmitComment(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItemForSubmit(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Deliverable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK BLOCKED MODAL */}
      {selectedItemForBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="glass-modal w-full max-w-lg p-6 relative">
            <button
              onClick={() => setSelectedItemForBlock(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Ban className="w-5 h-5 text-rose-600" />
              Mark Deliverable as Blocked
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Blockers notify your Team Lead and surface on the Issues &amp; Blockers dashboard.
            </p>

            {blockError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{blockError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmBlock} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Canonical Blocker Reason *
                </label>
                <select
                  required
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value as BlockerReason)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {BLOCKER_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Blocker Detail / Dependency Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail what is missing or who needs to provide assets..."
                  value={blockerNote}
                  onChange={(e) => setBlockerNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItemForBlock(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBlocking}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-200 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isBlocking ? 'Recording Blocker...' : 'Confirm Blocker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
