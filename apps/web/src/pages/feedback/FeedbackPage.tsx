import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  REVISION_ROOT_CAUSES,
  APPROVER_JOB_ROLES,
  type RevisionRootCause,
  type FeedbackRoundStatus,
} from '@mmp/shared';
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Search,
  ChevronRight,
  Send,
  Flag,
  ShieldAlert,
  X,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

interface FeedbackThreadItem {
  workItem: {
    _id: string;
    title: string;
    workType: string;
    deadline: string;
    status: string;
    revisions: number;
    campaignId?: { _id: string; name: string };
    profileId?: { _id: string; name: string; code: string };
    departmentId?: { _id: string; name: string; code: string };
    ownerId?: { _id: string; name: string; email: string; role: string; jobRole?: string };
    reviewRequired?: boolean;
    stageKey?: string;
  };
  latestEntry?: {
    _id: string;
    round: number;
    roundStatus: string;
    text: string;
    isResponse: boolean;
    createdAt: string;
    fromPersonId?: { _id: string; name: string; role: string };
  };
  totalEntries: number;
  revisions: number;
  flag?: {
    _id: string;
    revisionsCount: number;
    baselineAvg: number;
    isFlagged: boolean;
    flaggedAt: string;
    rootCause?: string;
    rootCauseNotes?: string;
    isOver48HoursUnclassified?: boolean;
    isEscalated?: boolean;
    classifiedBy?: { _id: string; name: string; role: string };
  };
}

interface FeedbackEntryDetail {
  _id: string;
  round: number;
  roundStatus: string;
  text: string;
  isResponse: boolean;
  createdAt: string;
  fromPersonId?: {
    _id: string;
    name: string;
    email: string;
    role: string;
    jobRole?: string;
  };
  attachments?: { name: string; url: string; fileType?: string; size?: number }[];
}

interface RoundDetail {
  roundNumber: number;
  reviewerFeedback: FeedbackEntryDetail | null;
  ownerResponse: FeedbackEntryDetail | null;
  status: string;
  createdAt: string;
}

export const FeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [threads, setThreads] = useState<FeedbackThreadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);

  // Active Thread Details
  const [activeThread, setActiveThread] = useState<{
    workItem: FeedbackThreadItem['workItem'];
    entries: FeedbackEntryDetail[];
    rounds: RoundDetail[];
    flag: FeedbackThreadItem['flag'] | null;
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'all' | 'feedback' | 'flagged' | 'approved'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Submit Review / Response State
  const [reviewDecision, setReviewDecision] = useState<FeedbackRoundStatus>('Revision Required');
  const [reviewText, setReviewText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Root Cause Classification Modal
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false);
  const [selectedRootCause, setSelectedRootCause] = useState<RevisionRootCause>('Brief unclear');
  const [rootCauseNotes, setRootCauseNotes] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);

  // Fetch all feedback threads
  const fetchThreads = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: FeedbackThreadItem[] }>('/api/feedback/threads');
      setThreads(res.data);
      if (res.data.length > 0 && !selectedWorkItemId) {
        setSelectedWorkItemId(res.data[0].workItem._id);
      }
    } catch (err) {
      console.error('Failed to load feedback threads', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  // Fetch selected thread detail
  const fetchThreadDetail = async (workItemId: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await apiFetch<{
        data: {
          workItem: FeedbackThreadItem['workItem'];
          entries: FeedbackEntryDetail[];
          rounds: RoundDetail[];
          flag: FeedbackThreadItem['flag'] | null;
        };
      }>(`/api/feedback/work-item/${workItemId}`);
      setActiveThread(res.data);
    } catch (err) {
      console.error('Failed to load thread detail', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedWorkItemId) {
      fetchThreadDetail(selectedWorkItemId);
    }
  }, [selectedWorkItemId]);

  // Submit Reviewer Entry
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkItemId || !reviewText.trim()) return;

    setIsSubmittingReview(true);
    try {
      await apiFetch(`/api/feedback/work-item/${selectedWorkItemId}`, {
        method: 'POST',
        body: JSON.stringify({
          roundStatus: reviewDecision,
          text: reviewText.trim(),
          isResponse: false,
        }),
      });
      setReviewText('');
      await fetchThreadDetail(selectedWorkItemId);
      await fetchThreads();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Submit Owner Response
  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkItemId || !responseText.trim()) return;

    const currentRounds = activeThread?.rounds || [];
    const latestRoundNum = currentRounds.length > 0 ? currentRounds[currentRounds.length - 1].roundNumber : 1;

    setIsSubmittingResponse(true);
    try {
      await apiFetch(`/api/feedback/work-item/${selectedWorkItemId}`, {
        method: 'POST',
        body: JSON.stringify({
          round: latestRoundNum,
          text: responseText.trim(),
          isResponse: true,
        }),
      });
      setResponseText('');
      await fetchThreadDetail(selectedWorkItemId);
      await fetchThreads();
    } catch (err: any) {
      alert(err.message || 'Failed to submit response');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // Classify Root Cause
  const handleClassifyRootCause = async (e: React.FormEvent) => {
    e.preventDefault();
    const flagId = activeThread?.flag?._id;
    if (!flagId) return;

    setIsClassifying(true);
    try {
      await apiFetch(`/api/revisions/flags/${flagId}/classify`, {
        method: 'POST',
        body: JSON.stringify({
          rootCause: selectedRootCause,
          rootCauseNotes: rootCauseNotes.trim(),
        }),
      });
      setIsClassifyModalOpen(false);
      setRootCauseNotes('');
      if (selectedWorkItemId) {
        await fetchThreadDetail(selectedWorkItemId);
      }
      await fetchThreads();
    } catch (err: any) {
      alert(err.message || 'Failed to classify root cause');
    } finally {
      setIsClassifying(false);
    }
  };

  // Filtered Threads
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (activeTab === 'feedback' && t.workItem.status !== 'Feedback') return false;
      if (activeTab === 'flagged' && !t.flag) return false;
      if (activeTab === 'approved' && t.workItem.status !== 'Approved') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.workItem.title.toLowerCase().includes(q);
        const matchOwner = t.workItem.ownerId?.name.toLowerCase().includes(q);
        const matchCampaign = t.workItem.campaignId?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchOwner && !matchCampaign) return false;
      }
      return true;
    });
  }, [threads, activeTab, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const totalActive = threads.filter((t) => t.workItem.status === 'Feedback').length;
    const totalFlagged = threads.filter((t) => t.flag && t.flag.isFlagged).length;
    const totalEscalated = threads.filter(
      (t) => t.flag && (t.flag.isEscalated || t.flag.isOver48HoursUnclassified)
    ).length;
    const totalApproved = threads.filter((t) => t.workItem.status === 'Approved').length;
    return { totalActive, totalFlagged, totalEscalated, totalApproved };
  }, [threads]);

  const isApproverLead =
    user?.role === 'team_lead' &&
    Boolean(user?.jobRole && (APPROVER_JOB_ROLES as readonly string[]).includes(user.jobRole));

  const canApprove =
    user?.role === 'admin' ||
    user?.role === 'marketing_head' ||
    isApproverLead;

  const isLeadOrAdmin = user?.role === 'admin' || user?.role === 'marketing_head' || user?.role === 'team_lead';
  const isAssignedOwner =
    activeThread?.workItem.ownerId?._id === user?._id ||
    activeThread?.workItem.ownerId?._id === (user as any)?.userId;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Cockpit Header */}
      <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/80 to-slate-900/90 text-white p-6 rounded-3xl shadow-xl border border-white/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/30 text-purple-200 border border-purple-400/30">
                Screen 8 • Review Hub
              </span>
              <span className="text-xs text-purple-200/80 font-medium">Two-Entry Review Rounds</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-purple-400" />
              Feedback & Revision History
            </h1>
            <p className="text-sm text-purple-200/70 mt-1 max-w-2xl">
              Structured round-based review threads with reviewer decisions, owner responses, automatic 4th round ceiling flags, and 7-cause root cause analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/issues')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-2 shadow-sm"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Issues & Blockers</span>
            </button>
            <button
              onClick={() => navigate('/work')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>All Work Items</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 block mb-0.5">
              In Feedback
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{metrics.totalActive}</span>
              <span className="text-xs text-purple-300/80">Deliverables</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block mb-0.5">
              Revision Flags
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">{metrics.totalFlagged}</span>
              <span className="text-xs text-amber-300/80">&ge; 4 revs</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 block mb-0.5">
              Escalated (&gt;48h)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">{metrics.totalEscalated}</span>
              <span className="text-xs text-rose-300/80">To Head</span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block mb-0.5">
              Approved
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">{metrics.totalApproved}</span>
              <span className="text-xs text-emerald-300/80">Ready to Publish</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Thread List & Right Active Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Thread List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Filter Tabs & Search */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'all' ? 'bg-white text-purple-700 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                All ({threads.length})
              </button>
              <button
                onClick={() => setActiveTab('feedback')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'feedback' ? 'bg-white text-purple-700 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                In Review ({metrics.totalActive})
              </button>
              <button
                onClick={() => setActiveTab('flagged')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'flagged' ? 'bg-white text-amber-700 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Flagged ({metrics.totalFlagged})
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, owner, or campaign..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* List of Deliverables */}
          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                Loading feedback threads...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                No feedback threads matching filters.
              </div>
            ) : (
              filteredThreads.map((item) => {
                const isSelected = selectedWorkItemId === item.workItem._id;
                const hasFlag = Boolean(item.flag);
                const isEscalated = Boolean(item.flag?.isEscalated || item.flag?.isOver48HoursUnclassified);

                return (
                  <div
                    key={item.workItem._id}
                    onClick={() => setSelectedWorkItemId(item.workItem._id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-500/20 shadow-sm'
                        : 'bg-white border-slate-200/80 hover:border-purple-200 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {item.workItem.workType}
                        </span>
                        {item.workItem.profileId && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                            {item.workItem.profileId.name}
                          </span>
                        )}
                      </div>

                      {hasFlag && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                            isEscalated
                              ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          <Flag className="w-2.5 h-2.5" />
                          {isEscalated ? 'Escalated' : 'Flagged'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">
                      {item.workItem.title}
                    </h3>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center">
                          {item.workItem.ownerId?.name?.charAt(0) || 'U'}
                        </div>
                        <span className="font-medium text-slate-700">
                          {item.workItem.ownerId?.name || 'Unassigned'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            item.revisions >= 4
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.revisions} {item.revisions === 1 ? 'rev' : 'revs'}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Structured Thread View (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {isLoadingDetail ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
              Loading review thread details...
            </div>
          ) : !activeThread ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
              Select a deliverable on the left to inspect its structured feedback thread.
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Deliverable Header Card */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        {activeThread.workItem.workType}
                      </span>
                      {activeThread.workItem.campaignId && (
                        <span className="text-[10px] font-semibold text-slate-500">
                          Campaign: <strong>{activeThread.workItem.campaignId.name}</strong>
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-black text-slate-900">
                      {activeThread.workItem.title}
                    </h2>
                  </div>

                  <button
                    onClick={() => navigate(`/work/${activeThread.workItem._id}`)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                  >
                    <span>Open Work Detail</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Assigned Owner</span>
                    <strong className="text-slate-800">{activeThread.workItem.ownerId?.name || 'Unassigned'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Total Revisions</span>
                    <strong
                      className={`font-black ${
                        activeThread.workItem.revisions >= 4 ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      {activeThread.workItem.revisions} cycles
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Status</span>
                    <span className="inline-block px-2 py-0.5 rounded font-bold text-[10px] bg-purple-100 text-purple-800">
                      {activeThread.workItem.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Revision Flag Banner (if flagged) */}
              {activeThread.flag && (
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    activeThread.flag.isEscalated || activeThread.flag.isOver48HoursUnclassified
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200/70 text-amber-900">
                            Automatic Revision Flag Triggered
                          </span>
                          {(activeThread.flag.isEscalated ||
                            activeThread.flag.isOver48HoursUnclassified) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white animate-pulse">
                              Escalated to Marketing Head (&gt;48h unclassified)
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold">
                          Deliverable reached {activeThread.flag.revisionsCount} revisions (baseline average was{' '}
                          {activeThread.flag.baselineAvg}).
                        </p>
                        {activeThread.flag.rootCause ? (
                          <div className="mt-2 text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                            <span className="text-[10px] font-bold uppercase text-amber-800 block">
                              Classified Root Cause:
                            </span>
                            <strong>{activeThread.flag.rootCause}</strong>
                            {activeThread.flag.rootCauseNotes && (
                              <p className="text-slate-600 text-[11px] mt-0.5">
                                Notes: {activeThread.flag.rootCauseNotes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-800/80 mt-1">
                            Awaiting root cause classification by Team Lead or Marketing Head.
                          </p>
                        )}
                      </div>
                    </div>

                    {!activeThread.flag.rootCause && isLeadOrAdmin && (
                      <button
                        onClick={() => setIsClassifyModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm shrink-0 flex items-center gap-1.5 transition-all"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Classify Root Cause</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Rounds List */}
              <div className="space-y-4">
                {activeThread.rounds.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                    No review rounds logged yet. Be the first to submit a review!
                  </div>
                ) : (
                  activeThread.rounds.map((round) => (
                    <div
                      key={round.roundNumber}
                      className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3"
                    >
                      {/* Round Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-black text-slate-900 tracking-wide">
                          ROUND {round.roundNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            round.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {round.status}
                        </span>
                      </div>

                      {/* Entry 1: Reviewer Feedback */}
                      {round.reviewerFeedback && (
                        <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-purple-600" />
                              Reviewer: {round.reviewerFeedback.fromPersonId?.name || 'Reviewer'} (
                              {round.reviewerFeedback.fromPersonId?.role})
                            </span>
                            <span>{new Date(round.reviewerFeedback.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {round.reviewerFeedback.text}
                          </p>
                        </div>
                      )}

                      {/* Entry 2: Owner Response */}
                      {round.ownerResponse ? (
                        <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200 text-xs space-y-1.5 ml-4">
                          <div className="flex items-center justify-between text-[11px] text-purple-700 font-bold">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                              Owner Response: {round.ownerResponse.fromPersonId?.name}
                            </span>
                            <span className="text-slate-400 font-normal">
                              {new Date(round.ownerResponse.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {round.ownerResponse.text}
                          </p>
                        </div>
                      ) : (
                        round.status !== 'Approved' && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-400 italic text-center ml-4">
                            Awaiting owner response for Round {round.roundNumber}...
                          </div>
                        )
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Action Forms Accordion: Reviewer or Owner */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <Send className="w-4 h-4 text-purple-600" />
                  <span>Submit Thread Update</span>
                </h3>

                {/* Reviewer Action Form (Team Lead or Admin) */}
                {isLeadOrAdmin && (
                  <form onSubmit={handleSubmitReview} className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Submit Review Decision (New Round)
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            value="Revision Required"
                            checked={reviewDecision === 'Revision Required'}
                            onChange={() => setReviewDecision('Revision Required')}
                            className="text-amber-600"
                          />
                          <span className="font-semibold text-amber-800">Revision Required</span>
                        </label>
                        <label className={`flex items-center gap-1 text-xs ${activeThread.workItem.reviewRequired && !canApprove ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="decision"
                            value="Approved"
                            disabled={Boolean(activeThread.workItem.reviewRequired && !canApprove)}
                            checked={reviewDecision === 'Approved'}
                            onChange={() => setReviewDecision('Approved')}
                            className="text-emerald-600"
                          />
                          <span className="font-semibold text-emerald-800">
                            Approved {activeThread.workItem.reviewRequired && !canApprove && '(Approver Role Required)'}
                          </span>
                        </label>
                      </div>
                    </div>

                    <textarea
                      required
                      rows={3}
                      placeholder="Write structured feedback with specific adjustments needed or approval signoff..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingReview || !reviewText.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-all disabled:opacity-50"
                      >
                        {isSubmittingReview ? 'Submitting Review...' : 'Submit Review'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Owner Response Form (Assigned Owner or Admin/Lead) */}
                {(isAssignedOwner || isLeadOrAdmin) && (
                  <form onSubmit={handleSubmitResponse} className="space-y-3 pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-800 block">
                      Respond to Latest Reviewer Feedback
                    </span>
                    <textarea
                      required
                      rows={2}
                      placeholder="Describe changes made, paste updated deliverable links, or request clarification..."
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingResponse || !responseText.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all disabled:opacity-50"
                      >
                        {isSubmittingResponse ? 'Submitting Response...' : 'Send Owner Response'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Root Cause Classification Modal */}
      {isClassifyModalOpen && (
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
                onClick={() => setIsClassifyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClassifyRootCause} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Select 1 of 7 Canonical Root Causes *
                </label>
                <select
                  value={selectedRootCause}
                  onChange={(e) => setSelectedRootCause(e.target.value as RevisionRootCause)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  {REVISION_ROOT_CAUSES.map((cause) => (
                    <option key={cause} value={cause}>
                      {cause}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Fixed root causes power operational analytics to reduce repetitive rework cycles.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Actionable Context & Root Cause Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Brief omitted secondary CTA requirement, leading to 2 rounds of rework..."
                  value={rootCauseNotes}
                  onChange={(e) => setRootCauseNotes(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClassifyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClassifying}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md disabled:opacity-50"
                >
                  {isClassifying ? 'Classifying...' : 'Save Classification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
