import React, { useEffect, useState } from 'react';
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
  CheckSquare,
  Clock,
  AlertTriangle,
  Play,
  Send,
  Ban,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  X,
  ChevronDown,
  ChevronUp,
  FileCheck,
} from 'lucide-react';

interface WorkItemSummary {
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
  campaignId: { _id: string; name: string; relatedOKR?: string };
  profileId: { _id: string; name: string; code: string };
  departmentId?: { _id: string; name: string };
  isOverdue?: boolean;
}

interface MyWorkResponse {
  overdue: WorkItemSummary[];
  today: WorkItemSummary[];
  thisWeek: WorkItemSummary[];
  upcoming: WorkItemSummary[];
  completed: WorkItemSummary[];
  stats: {
    activeCount: number;
    overdueCount: number;
    todayCount: number;
    completedCount: number;
    avgRevisions: number;
  };
}

export const MyWorkPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<MyWorkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Blocker Modal State
  const [selectedItemForBlock, setSelectedItemForBlock] = useState<WorkItemSummary | null>(null);
  const [blockerReason, setBlockerReason] = useState<BlockerReason>('Waiting for feedback');
  const [blockerNote, setBlockerNote] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Deliverable Submit Modal State
  const [selectedItemForSubmit, setSelectedItemForSubmit] = useState<WorkItemSummary | null>(null);
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [submitComment, setSubmitComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMyWork = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: MyWorkResponse }>('/api/my-work');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load My Work data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyWork();
  }, []);

  // Quick State Transitions
  const handleTransition = async (
    item: WorkItemSummary,
    toStatus: WorkItemStatus,
    payload: Record<string, any> = {}
  ) => {
    try {
      await apiFetch(`/api/work/${item._id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, ...payload }),
      });
      await fetchMyWork();
    } catch (err: any) {
      alert(err.message || 'Transition failed');
    }
  };

  const submitBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForBlock) return;
    setIsBlocking(true);
    setBlockError(null);

    try {
      await apiFetch(`/api/work/${selectedItemForBlock._id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus: 'Blocked',
          blockerReason,
          blockerNote,
        }),
      });
      setSelectedItemForBlock(null);
      setBlockerNote('');
      await fetchMyWork();
    } catch (err: any) {
      setBlockError(err.message || 'Failed to mark blocked');
    } finally {
      setIsBlocking(false);
    }
  };

  const submitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForSubmit) return;
    setIsSubmitting(true);

    try {
      await apiFetch(`/api/work/${selectedItemForSubmit._id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus: 'Pending',
          deliverableUrl,
          comment: submitComment,
        }),
      });
      setSelectedItemForSubmit(null);
      setDeliverableUrl('');
      setSubmitComment('');
      await fetchMyWork();
    } catch (err: any) {
      alert(err.message || 'Failed to submit deliverable');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderWorkCard = (item: WorkItemSummary, isOverdueCard = false) => {
    const isPastDeadline = new Date(item.deadline) < new Date();
    const isTerminal = item.status === 'Approved' || item.status === 'Published';
    const isActuallyOverdue = isPastDeadline && !isTerminal;

    return (
      <div
        key={item._id}
        className={`glass-card p-5 rounded-2xl flex flex-col justify-between transition-all border group ${
          isActuallyOverdue || isOverdueCard
            ? 'border-rose-300/80 bg-rose-50/30 hover:border-rose-400'
            : item.status === 'Blocked'
            ? 'border-amber-300/80 bg-amber-50/20 hover:border-amber-400'
            : 'border-white/80 hover:border-[#7a6af6]/40'
        }`}
      >
        <div>
          {/* Top badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900 text-white">
                {item.profileId?.name || 'Brand'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-[#7a6af6]">
                {item.workType}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  item.priority === 'High'
                    ? 'bg-rose-100 text-rose-700'
                    : item.priority === 'Medium'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.priority}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {item.revisions > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                  Rev: {item.revisions}
                </span>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  item.status === 'In Progress'
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : item.status === 'Blocked'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : item.status === 'Feedback'
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : item.status === 'Pending'
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : item.status === 'Approved'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : item.status === 'Published'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.status}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3
            onClick={() => navigate(`/work/${item._id}`)}
            className="text-sm font-extrabold text-slate-900 group-hover:text-[#7a6af6] transition-colors cursor-pointer leading-snug"
          >
            {item.title}
          </h3>

          {/* Campaign Link */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 font-medium">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span
              onClick={() => navigate(`/campaigns/${item.campaignId._id}`)}
              className="hover:underline cursor-pointer text-slate-700 font-semibold truncate"
            >
              {item.campaignId.name}
            </span>
          </div>

          {/* Blocker alert if blocked */}
          {item.status === 'Blocked' && (
            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Blocked: {item.blockerReason}</span>
              </div>
              {item.blockerNote && <p className="text-[11px] text-rose-700 mt-0.5">{item.blockerNote}</p>}
            </div>
          )}
        </div>

        {/* Card Footer: Deadline & Action Triggers */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className={isActuallyOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
              Due: {new Date(item.deadline).toLocaleDateString()}
            </span>
            {isActuallyOverdue && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-rose-600 text-white uppercase ml-1 animate-pulse">
                Overdue
              </span>
            )}
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-1.5">
            {item.status === 'Not Started' && (
              <button
                onClick={() => handleTransition(item, 'In Progress')}
                className="px-3 py-1 bg-[#7a6af6] hover:bg-[#6857f5] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
              >
                <Play className="w-3 h-3 fill-current" />
                Start Work
              </button>
            )}

            {item.status === 'In Progress' && (
              <>
                <button
                  onClick={() => {
                    setSelectedItemForSubmit(item);
                    setDeliverableUrl(item.deliverableUrl || '');
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  Submit Review
                </button>
                <button
                  onClick={() => setSelectedItemForBlock(item)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200"
                  title="Mark Blocked"
                >
                  <Ban className="w-3 h-3" />
                  Block
                </button>
              </>
            )}

            {item.status === 'Feedback' && (
              <>
                <button
                  onClick={() => handleTransition(item, 'In Progress')}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Rework
                </button>
                <button
                  onClick={() => {
                    setSelectedItemForSubmit(item);
                    setDeliverableUrl(item.deliverableUrl || '');
                  }}
                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all border border-indigo-200"
                >
                  Re-submit
                </button>
              </>
            )}

            {item.status === 'Blocked' && (
              <button
                onClick={() => handleTransition(item, 'In Progress')}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
              >
                <Play className="w-3 h-3 fill-current" />
                Resume
              </button>
            )}

            {item.status === 'Pending' && (
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Awaiting Lead Review
              </span>
            )}

            {item.status === 'Approved' && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                Approved
              </span>
            )}

            <button
              onClick={() => navigate(`/work/${item._id}`)}
              className="p-1 rounded-lg text-slate-400 hover:text-[#7a6af6] transition-colors"
              title="Open detail"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Banner & Personal Cockpit */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-violet-100 text-[#7a6af6] border border-violet-200 flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              Focus Cockpit
            </span>
            <span className="text-xs font-semibold text-slate-400">Zero Surveillance • Mental Clarity</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            My Work
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Welcome back, <strong>{user?.name}</strong>. Here is your personal queue partitioned into clear priorities.
          </p>
        </div>

        <button
          onClick={() => navigate('/calendar')}
          className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:border-[#7a6af6] hover:text-[#7a6af6] transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Calendar className="w-3.5 h-3.5" />
          View Calendar
        </button>
      </div>

      {/* 2. Personal KPI Summary Strip */}
      {data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="glass-card p-4 rounded-2xl border border-white/80 shadow-glass">
            <div className="text-[10px] font-bold uppercase text-slate-400">Active Work</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{data.stats.activeCount}</div>
            <div className="text-[10px] text-slate-500 font-medium">In your queue</div>
          </div>

          <div
            className={`glass-card p-4 rounded-2xl border shadow-glass ${
              data.stats.overdueCount > 0
                ? 'border-rose-300 bg-rose-50/40 text-rose-900'
                : 'border-white/80'
            }`}
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">Overdue</div>
            <div
              className={`text-2xl font-black mt-0.5 ${
                data.stats.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {data.stats.overdueCount}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              {data.stats.overdueCount > 0 ? 'Needs immediate action' : 'All on track'}
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/80 shadow-glass">
            <div className="text-[10px] font-bold uppercase text-slate-400">Due Today</div>
            <div className="text-2xl font-black text-violet-700 mt-0.5">{data.stats.todayCount}</div>
            <div className="text-[10px] text-slate-500 font-medium">Daily commitment</div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/80 shadow-glass">
            <div className="text-[10px] font-bold uppercase text-slate-400">Avg Revisions</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{data.stats.avgRevisions}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Quality indicator</div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/80 shadow-glass col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold uppercase text-slate-400">Completed</div>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">{data.stats.completedCount}</div>
            <div className="text-[10px] text-slate-500 font-medium">Approved / Published</div>
          </div>
        </div>
      )}

      {/* 3. Main Queues */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading personal work queue...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section A: Overdue (if any exist) */}
          {data?.overdue && data.overdue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <h2 className="text-base font-extrabold text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Overdue Action Required ({data.overdue.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.overdue.map((item) => renderWorkCard(item, true))}
              </div>
            </div>
          )}

          {/* Section B: Today's Priorities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#7a6af6]" />
                Today's Priorities ({data?.today?.length || 0})
              </h2>
            </div>

            {data?.today && data.today.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.today.map((item) => renderWorkCard(item))}
              </div>
            ) : (
              <div className="glass-card p-8 text-center rounded-2xl border border-white/80">
                <Sparkles className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-900">No deadlines for today!</h4>
                <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
                  You have cleared all of today's deliverables. You can pull work from your upcoming queue or focus on deep creative production.
                </p>
              </div>
            )}
          </div>

          {/* Section C: This Week */}
          {data?.thisWeek && data.thisWeek.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                This Week ({data.thisWeek.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.thisWeek.map((item) => renderWorkCard(item))}
              </div>
            </div>
          )}

          {/* Section D: Upcoming / Later */}
          {data?.upcoming && data.upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                Upcoming / Pipeline ({data.upcoming.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.upcoming.map((item) => renderWorkCard(item))}
              </div>
            </div>
          )}

          {/* Section E: Completed Deliverables (Collapsible) */}
          {data?.completed && data.completed.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Recently Completed ({data.completed.length})
                {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showCompleted && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                  {data.completed.map((item) => renderWorkCard(item))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Mark Blocked Modal */}
      {selectedItemForBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-md p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-slate-900">Mark Work Item Blocked</h3>
              </div>
              <button
                onClick={() => setSelectedItemForBlock(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {blockError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {blockError}
              </div>
            )}

            <form onSubmit={submitBlocker} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Blocker *
                </label>
                <select
                  required
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value as BlockerReason)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {BLOCKER_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Details / Blocker Note
                </label>
                <textarea
                  rows={3}
                  value={blockerNote}
                  onChange={(e) => setBlockerNote(e.target.value)}
                  placeholder="Explain what is blocking progress so your Team Lead can help resolve it..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemForBlock(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBlocking}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-50"
                >
                  {isBlocking ? 'Updating...' : 'Confirm Blocked'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Submit Deliverable for Review Modal */}
      {selectedItemForSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-md p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Send className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-slate-900">Submit for Review</h3>
              </div>
              <button
                onClick={() => setSelectedItemForSubmit(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitDeliverable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deliverable Link / Asset URL
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... or Figma link"
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes for Reviewer (Optional)
                </label>
                <textarea
                  rows={3}
                  value={submitComment}
                  onChange={(e) => setSubmitComment(e.target.value)}
                  placeholder="Summarize key changes made or points of attention for review..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemForSubmit(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Deliverable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
