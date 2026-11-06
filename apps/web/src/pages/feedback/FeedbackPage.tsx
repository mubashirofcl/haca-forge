import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { statusClass, statusTone } from '../../lib/statusTone';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  CANONICAL_REVISION_ROOT_CAUSES,
  type CanonicalRevisionRootCause,
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
  FileSpreadsheet,
} from 'lucide-react';
import { PlansApprovalTab } from './PlansApprovalTab';

interface FeedbackThreadItem {
  workItem: {
    _id: string;
    title: string;
    workType: string;
    deadline: string;
    status: string;
    revisions: number;
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
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const mainTab: 'plans' | 'stages' = tabParam === 'plans' ? 'plans' : 'stages';

  const handleMainTabChange = (t: 'plans' | 'stages') => {
    setSearchParams({ tab: t });
  };

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
  const [reviewText, setReviewText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Root Cause Classification Modal
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false);
  const [selectedRootCause, setSelectedRootCause] = useState<CanonicalRevisionRootCause>(CANONICAL_REVISION_ROOT_CAUSES[0]);
  const [rootCauseNotes, setRootCauseNotes] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  // Classify modal keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const classifyDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(classifyDialogRef, isClassifyModalOpen, () => setIsClassifyModalOpen(false));

  // Fetch all feedback threads
  const fetchThreads = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: FeedbackThreadItem[] }>('/api/feedback/threads');
      setThreads(res.data);
      const queryWorkId = searchParams.get('workItemId');
      if (queryWorkId && res.data.some((t) => t.workItem._id === queryWorkId)) {
        setSelectedWorkItemId(queryWorkId);
      } else if (res.data.length > 0 && !selectedWorkItemId) {
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
          roundStatus: 'Revision Required',
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

  // Filtered Threads (Sorted Oldest First)
  const filteredThreads = useMemo(() => {
    const list = threads.filter((t) => {
      if (activeTab === 'feedback' && t.workItem.status !== 'Feedback' && t.workItem.status !== 'Pending') return false;
      if (activeTab === 'flagged' && !t.flag) return false;
      if (activeTab === 'approved' && t.workItem.status !== 'Approved') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.workItem.title.toLowerCase().includes(q);
        const matchOwner = t.workItem.ownerId?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchOwner) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const dateA = new Date(a.latestEntry?.createdAt || a.workItem.deadline).getTime();
      const dateB = new Date(b.latestEntry?.createdAt || b.workItem.deadline).getTime();
      return dateA - dateB; // Oldest first
    });
  }, [threads, activeTab, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const totalActive = threads.filter((t) => t.workItem.status === 'Feedback' || t.workItem.status === 'Pending').length;
    const totalFlagged = threads.filter((t) => t.flag && t.flag.isFlagged).length;
    const totalEscalated = threads.filter(
      (t) => t.flag && (t.flag.isEscalated || t.flag.isOver48HoursUnclassified)
    ).length;
    const totalApproved = threads.filter((t) => t.workItem.status === 'Approved').length;
    return { totalActive, totalFlagged, totalEscalated, totalApproved };
  }, [threads]);

  const isAssignedOwner =
    activeThread?.workItem.ownerId?._id === user?._id ||
    activeThread?.workItem.ownerId?._id === (user as any)?.userId;

  // Same reviewer rule as the API: creative_head and admin, never on their own work.
  const canRequestRevision =
    (user?.role === 'admin' || user?.role === 'creative_head') && !isAssignedOwner;

  const isReviewerOrAdmin = user?.role === 'admin' || user?.role === 'creative_head' || user?.role === 'sm_manager';

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Scope Reset R3 Top Tab Navigation for Creative Head */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="ui-tabs flex-wrap max-w-full rounded-ui-card">
        <button
          type="button"
          aria-pressed={mainTab === 'plans'}
          onClick={() => handleMainTabChange('plans')}
          className={`ui-tab gap-2 ${mainTab === 'plans' ? 'is-active' : ''}`}
        >
          <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
          Plans waiting for approval
        </button>

        <button
          type="button"
          aria-pressed={mainTab === 'stages'}
          onClick={() => handleMainTabChange('stages')}
          className={`ui-tab gap-2 ${mainTab === 'stages' ? 'is-active' : ''}`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Stages waiting for approval
        </button>
        </div>

        {isReviewerOrAdmin && (
          <button
            type="button"
            onClick={() => navigate('/feedback/review-studio')}
            className="ui-btn ui-btn-primary h-11 gap-2 sm:ml-auto"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Open Review Studio
          </button>
        )}
      </div>

      {mainTab === 'plans' && <PlansApprovalTab />}

      {mainTab === 'stages' && (
        <>
          {/* Top Cockpit Header */}
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/70 text-ui-text">
                Review Hub
              </span>
              <span className="text-xs text-ui-muted font-medium">Two-Entry Review Rounds</span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink flex items-center gap-2">
              <MessageSquare className="w-6 h-6 shrink-0" aria-hidden="true" />
              Feedback & Revision History
            </h1>
            <p className="text-[15px] text-ui-muted mt-1.5 max-w-[70ch]">
              Structured round-based review threads with reviewer decisions, owner responses, automatic 4th round ceiling flags, and 7-cause root cause analysis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/issues')}
              className="ui-btn ui-btn-secondary h-11 gap-2"
            >
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              <span>Issues & Blockers</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/work')}
              className="ui-btn ui-btn-secondary h-11 gap-2"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>All Work Items</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card p-4">
            <span className="text-[13px] font-medium text-ui-muted flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full status-dot status-in-progress" aria-hidden="true" />
              In Feedback
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ui-ink tabular-nums">{metrics.totalActive}</span>
              <span className="text-xs text-ui-muted">Deliverables</span>
            </div>
          </div>
          <div className="glass-card p-4">
            <span className="text-[13px] font-medium text-ui-muted flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full status-dot status-waiting" aria-hidden="true" />
              Revision Flags
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ui-ink tabular-nums">{metrics.totalFlagged}</span>
              <span className="text-xs text-ui-muted">&ge; 4 revs</span>
            </div>
          </div>
          <div className="glass-card p-4">
            <span className="text-[13px] font-medium text-ui-muted flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full status-dot status-changes" aria-hidden="true" />
              Escalated (&gt;48h)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ui-ink tabular-nums">{metrics.totalEscalated}</span>
              <span className="text-xs text-ui-muted">To Head</span>
            </div>
          </div>
          <div className="glass-card p-4">
            <span className="text-[13px] font-medium text-ui-muted flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full status-dot status-approved" aria-hidden="true" />
              Approved
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ui-ink tabular-nums">{metrics.totalApproved}</span>
              <span className="text-xs text-ui-muted">Ready to Publish</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Thread List & Right Active Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Thread List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Filter Tabs & Search */}
          <div className="glass-card p-4 space-y-3">
            <div className="ui-tabs w-full grid grid-cols-3">
              <button
                type="button"
                aria-pressed={activeTab === 'all'}
                onClick={() => setActiveTab('all')}
                className={`ui-tab justify-center px-2 ${activeTab === 'all' ? 'is-active' : ''}`}
              >
                All ({threads.length})
              </button>
              <button
                type="button"
                aria-pressed={activeTab === 'feedback'}
                onClick={() => setActiveTab('feedback')}
                className={`ui-tab justify-center px-2 ${activeTab === 'feedback' ? 'is-active' : ''}`}
              >
                In Review ({metrics.totalActive})
              </button>
              <button
                type="button"
                aria-pressed={activeTab === 'flagged'}
                onClick={() => setActiveTab('flagged')}
                className={`ui-tab justify-center px-2 ${activeTab === 'flagged' ? 'is-active' : ''}`}
              >
                Flagged ({metrics.totalFlagged})
              </button>
            </div>

            <div className="relative">
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

          {/* List of Deliverables */}
          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="glass-card p-8 text-center text-xs text-ui-muted">
                Loading feedback threads...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="glass-card p-8 text-center text-xs text-ui-muted">
                No feedback threads matching filters.
              </div>
            ) : (
              filteredThreads.map((item) => {
                const isSelected = selectedWorkItemId === item.workItem._id;
                const hasFlag = Boolean(item.flag);
                const isEscalated = Boolean(item.flag?.isEscalated || item.flag?.isOver48HoursUnclassified);

                return (
                  <button
                    type="button"
                    key={item.workItem._id}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedWorkItemId(item.workItem._id)}
                    className={`glass-card block w-full text-left p-4 ${
                      isSelected ? 'outline outline-2 outline-ui-ink' : 'hover:bg-ui-card-hover'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-ui-text">
                          {item.workItem.workType}
                        </span>
                      </div>

                      {hasFlag && (
                        <span
                          className={`status-chip text-[11px] font-semibold px-2 py-0.5 gap-1 ${
                            isEscalated ? 'status-changes' : 'status-waiting'
                          }`}
                        >
                          <Flag className="w-2.5 h-2.5" aria-hidden="true" />
                          {isEscalated ? 'Escalated' : 'Flagged'}
                        </span>
                      )}
                    </div>

                    <span className="block text-[13px] font-semibold text-ui-ink line-clamp-1 mb-1">
                      {item.workItem.title}
                    </span>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-ui-muted mt-2 pt-2 border-t border-ui-line">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-ui-ink text-white font-semibold text-[10px] flex items-center justify-center shrink-0" aria-hidden="true">
                          {item.workItem.ownerId?.name?.charAt(0) || 'U'}
                        </div>
                        <span className="font-medium text-ui-text truncate">
                          {item.workItem.ownerId?.name || 'Unassigned'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                            item.revisions >= 4 ? 'status-chip status-changes' : 'bg-white/70 text-ui-text'
                          }`}
                        >
                          {item.revisions} {item.revisions === 1 ? 'rev' : 'revs'}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-ui-muted" aria-hidden="true" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Structured Thread View (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {isLoadingDetail ? (
            <div className="glass-card p-12 text-center text-xs text-ui-muted">
              Loading review thread details...
            </div>
          ) : !activeThread ? (
            <div className="glass-card p-12 text-center text-xs text-ui-muted">
              Select a deliverable on the left to inspect its structured feedback thread.
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Deliverable Header Card */}
              <div className="glass-card p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-ui-text">
                        {activeThread.workItem.workType}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-ui-ink">
                      {activeThread.workItem.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/work/${activeThread.workItem._id}`)}
                    className="ui-btn ui-btn-secondary h-11 gap-1.5 shrink-0"
                  >
                    <span>Open Work Detail</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-ui-line text-xs">
                  <div>
                    <span className="text-[11px] text-ui-muted font-medium block">Assigned Owner</span>
                    <strong className="text-ui-ink">{activeThread.workItem.ownerId?.name || 'Unassigned'}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-ui-muted font-medium block">Total Revisions</span>
                    <strong
                      className={`font-semibold ${
                        activeThread.workItem.revisions >= 4 ? 'status-chip status-changes px-2 py-0.5' : 'text-ui-ink'
                      }`}
                    >
                      {activeThread.workItem.revisions} cycles
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-ui-muted font-medium block">Status</span>
                    <span className={`status-chip ${statusClass(statusTone(activeThread.workItem.status))} px-2 py-0.5 font-semibold text-[11px]`}>
                      {activeThread.workItem.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Revision Flag Banner (if flagged) */}
              {activeThread.flag && (
                <div
                  className={`p-4 rounded-ui-card status-tint ${
                    activeThread.flag.isEscalated || activeThread.flag.isOver48HoursUnclassified
                      ? 'status-changes'
                      : 'status-waiting'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-ui-ink">
                            Automatic Revision Flag Triggered
                          </span>
                          {(activeThread.flag.isEscalated ||
                            activeThread.flag.isOver48HoursUnclassified) && (
                            <span className="status-chip status-blocked text-[11px] font-semibold px-2 py-0.5">
                              Escalated to Marketing Head (&gt;48h unclassified)
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold">
                          Deliverable reached {activeThread.flag.revisionsCount} revisions (baseline average was{' '}
                          {activeThread.flag.baselineAvg}).
                        </p>
                        {activeThread.flag.rootCause ? (
                          <div className="mt-2 text-xs text-ui-text bg-white/80 p-2.5 rounded-xl">
                            <span className="text-[11px] font-medium text-ui-muted block">
                              Classified Root Cause:
                            </span>
                            <strong>{activeThread.flag.rootCause}</strong>
                            {activeThread.flag.rootCauseNotes && (
                              <p className="text-ui-text text-[11px] mt-0.5">
                                Notes: {activeThread.flag.rootCauseNotes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] mt-1">
                            Awaiting root cause classification by SM Manager or Creative Head.
                          </p>
                        )}
                      </div>
                    </div>

                    {!activeThread.flag.rootCause && isReviewerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsClassifyModalOpen(true)}
                        className="ui-btn ui-btn-primary h-11 gap-1.5 shrink-0"
                      >
                        <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Classify Root Cause</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Rounds List */}
              <div className="space-y-4">
                {activeThread.rounds.length === 0 ? (
                  <div className="glass-card p-8 text-center text-xs text-ui-muted">
                    No review rounds logged yet. Be the first to submit a review!
                  </div>
                ) : (
                  activeThread.rounds.map((round) => (
                    <div
                      key={round.roundNumber}
                      className="glass-card p-5 space-y-3"
                    >
                      {/* Round Header */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-ui-line">
                        <span className="text-[13px] font-semibold text-ui-ink">
                          Round {round.roundNumber}
                        </span>
                        <span
                          className={`status-chip text-[11px] font-semibold px-2.5 py-0.5 ${
                            round.status === 'Approved' ? 'status-approved' : 'status-waiting'
                          }`}
                        >
                          {round.status}
                        </span>
                      </div>

                      {/* Entry 1: Reviewer Feedback */}
                      {round.reviewerFeedback && (
                        <div className="p-3.5 rounded-ui-card bg-white/60 text-xs space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-ui-muted">
                            <span className="font-semibold text-ui-ink flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-ui-ink" aria-hidden="true" />
                              Reviewer: {round.reviewerFeedback.fromPersonId?.name || 'Reviewer'} (
                              {round.reviewerFeedback.fromPersonId?.role})
                            </span>
                            <span>{new Date(round.reviewerFeedback.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-ui-text whitespace-pre-wrap leading-relaxed break-words">
                            {round.reviewerFeedback.text}
                          </p>
                        </div>
                      )}

                      {/* Entry 2: Owner Response */}
                      {round.ownerResponse ? (
                        <div className="p-3.5 rounded-ui-card bg-white border border-ui-line text-xs space-y-1.5 ml-4">
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-ui-ink font-semibold">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Owner Response: {round.ownerResponse.fromPersonId?.name}
                            </span>
                            <span className="text-ui-muted font-normal">
                              {new Date(round.ownerResponse.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-ui-text whitespace-pre-wrap leading-relaxed break-words">
                            {round.ownerResponse.text}
                          </p>
                        </div>
                      ) : (
                        round.status !== 'Approved' && (
                          <div className="p-3 rounded-xl bg-white/40 border border-dashed border-ui-line text-[11px] text-ui-muted italic text-center ml-4">
                            Awaiting owner response for Round {round.roundNumber}...
                          </div>
                        )
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Action Forms Accordion: Reviewer or Owner */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-[13px] font-semibold text-ui-ink flex items-center gap-2">
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>Submit Thread Update</span>
                </h3>

                {/* Reviewer Action Form (Creative Head or Admin) */}
                {canRequestRevision && (
                  <form onSubmit={handleSubmitReview} className="space-y-3 pt-2 border-t border-ui-line">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span id="fb-review-label" className="text-xs font-semibold text-ui-ink">
                        Request a revision (new round)
                      </span>
                      <span className="text-xs text-ui-muted">To approve, use Review Studio, where a rating is required.</span>
                    </div>

                    <textarea
                      required
                      rows={3}
                      placeholder="Write structured feedback with the specific changes needed..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      aria-labelledby="fb-review-label"
                      className="ui-input ui-textarea w-full"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingReview || !reviewText.trim()}
                        className="ui-btn ui-btn-primary h-11"
                      >
                        {isSubmittingReview ? 'Requesting Revision...' : 'Request Revision'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Owner Response Form (Assigned Owner or Creative Head/Admin) */}
                {(isAssignedOwner || isReviewerOrAdmin) && (
                  <form onSubmit={handleSubmitResponse} className="space-y-3 pt-3 border-t border-ui-line">
                    <span id="fb-response-label" className="text-xs font-semibold text-ui-ink block">
                      Respond to Latest Reviewer Feedback
                    </span>
                    <textarea
                      required
                      rows={2}
                      placeholder="Describe changes made, updated deliverable details, or request clarification..."
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      aria-labelledby="fb-response-label"
                      className="ui-input ui-textarea w-full"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingResponse || !responseText.trim()}
                        className="ui-btn ui-btn-primary h-11"
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
        </>
      )}

      {/* Root Cause Classification Modal */}
      {isClassifyModalOpen && (
        <div className="fixed inset-0 z-50 ui-scrim flex items-center justify-center p-4">
          <div
            ref={classifyDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fb-classify-title"
            className="glass-modal max-w-lg w-full max-h-[92vh] overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-ui-line">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-ui-ink" aria-hidden="true" />
                <h3 id="fb-classify-title" className="text-base font-bold text-ui-ink">
                  Classify Revision Root Cause
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsClassifyModalOpen(false)}
                aria-label="Close"
                className="ui-icon-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClassifyRootCause} className="space-y-4 mt-4">
              <div>
                <label htmlFor="fb-root-cause" className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Select 1 of 7 Canonical Root Causes *
                </label>
                <select
                  id="fb-root-cause"
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
                <p className="text-[11px] text-ui-muted mt-1">
                  Fixed root causes power operational analytics to reduce repetitive rework cycles.
                </p>
              </div>

              <div>
                <label htmlFor="fb-root-cause-notes" className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Actionable Context & Root Cause Notes
                </label>
                <textarea
                  id="fb-root-cause-notes"
                  rows={3}
                  placeholder="e.g. Brief omitted secondary CTA requirement, leading to 2 rounds of rework..."
                  value={rootCauseNotes}
                  onChange={(e) => setRootCauseNotes(e.target.value)}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-ui-line">
                <button
                  type="button"
                  onClick={() => setIsClassifyModalOpen(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClassifying}
                  className="ui-btn ui-btn-primary h-11"
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
