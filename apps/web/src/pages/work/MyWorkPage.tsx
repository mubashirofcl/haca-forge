import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { statusClass, statusTone } from '../../lib/statusTone';
import { useAuth } from '../../context/AuthContext';
import { ResumableUploadTask } from '../../lib/uploadManager';
import {
  BLOCKER_REASONS,
  getAvailableActions,
  calculateIndividualWorkMeasures,
  type WorkType,
  type WorkItemStatus,
  type Priority,
  type BlockerReason,
} from '@mmp/shared';
import {
  CheckSquare,
  CalendarCheck,
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
  Lock,
  ExternalLink,
  Globe,
  Check,
  Copy,
  Search,
  FileText,
  Video,
  Film,
  Palette,
  Upload,
  RotateCcw,
} from 'lucide-react';

interface WorkItemSummary {
  _id: string;
  title: string;
  workType: WorkType;
  deadline: string;
  dueDate?: string;
  estimatedEffortHrs: number;
  status: WorkItemStatus;
  priority: Priority;
  revisions: number;
  blockerReason?: BlockerReason;
  blockerNote?: string;
  deliverableUrl?: string;
  publishedUrl?: string;
  description?: string;
  brief?: {
    description?: string;
    contentLink?: string;
    assetsLink?: string;
  };
  profileId: { _id: string; name: string; code: string };
  departmentId?: { _id: string; name: string };
  isOverdue?: boolean;
  isLocked?: boolean;
  stageKey?: string;
  stageOrder?: number;
  contentPieceId?: {
    _id: string;
    topic: string;
    contentType: string;
    postingDate: string;
    liveUrl?: string;
    brief?: string;
    referenceLink?: string;
    programOrEvent?: string;
  };
  latestFeedback?: {
    text: string;
    reviewer: string;
    createdAt: string;
  };
  suggestedDependencyOwner?: {
    _id: string;
    name: string;
    email: string;
    jobRole?: string;
  };
  previousStage?: {
    stageKey: string;
    deliverableUrl?: string;
    publishedUrl?: string;
    status: string;
    owner?: {
      _id: string;
      name: string;
      email: string;
      jobRole?: string;
    };
  };
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
    stageAssignmentsCount?: number;
    submissionsCount?: number;
    deliverablesCount?: number;
    avgRevisions: number;
  };
}

type FilterCategory = 'all' | 'stages' | 'deliverables' | 'submissions';

export const MyWorkPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<MyWorkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Blocker Modal State
  const [selectedItemForBlock, setSelectedItemForBlock] = useState<WorkItemSummary | null>(null);
  const [blockerReason, setBlockerReason] = useState<BlockerReason>('Waiting for feedback');
  const [blockerNote, setBlockerNote] = useState('');
  const [dependencyOwnerId, setDependencyOwnerId] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  // Deliverable Submit Modal State
  const [selectedItemForSubmit, setSelectedItemForSubmit] = useState<WorkItemSummary | null>(null);
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [socialReferenceUrl, setSocialReferenceUrl] = useState('');
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitComment, setSubmitComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleModalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedItemForSubmit) return;
    const file = e.target.files[0];
    setIsUploadingFile(true);
    setUploadProgress(0);
    setUploadFileName(file.name);
    setUploadError(null);

    const task = new ResumableUploadTask({
      file,
      workItemId: selectedItemForSubmit._id,
      onProgress: (p) => setUploadProgress(p.percentage),
      onError: (err) => {
        setIsUploadingFile(false);
        setUploadError(err.message || 'Failed to upload file');
      },
      onComplete: (res) => {
        setIsUploadingFile(false);
        setUploadedFileUrl(res.fileUrl);
        setDeliverableUrl(res.fileUrl);
        setUploadProgress(100);
      },
    });

    task.start();
  };

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
          dependencyOwnerId: dependencyOwnerId || undefined,
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
      const isPost = selectedItemForSubmit.stageKey === 'Post';
      const toStatus = isPost ? 'Published' : 'Feedback';

      if (isPost) {
        const linkToValidate = socialReferenceUrl.trim() || deliverableUrl.trim();
        if (!linkToValidate) {
          alert('Please enter the live social reference link.');
          setIsSubmitting(false);
          return;
        }
        try {
          new URL(linkToValidate);
        } catch {
          alert('Please enter a valid social reference link (e.g. https://instagram.com/p/...).');
          setIsSubmitting(false);
          return;
        }
      }

      const finalDeliverableUrl = isPost
        ? (uploadedFileUrl || deliverableUrl || '').trim() || undefined
        : (uploadedFileUrl || deliverableUrl || '').trim() || undefined;

      const finalPublishedUrl = isPost
        ? (socialReferenceUrl.trim() || deliverableUrl.trim())
        : undefined;

      await apiFetch(`/api/work/${selectedItemForSubmit._id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus,
          deliverableUrl: finalDeliverableUrl,
          publishedUrl: finalPublishedUrl,
          comment: submitComment.trim(),
        }),
      });
      setSelectedItemForSubmit(null);
      setDeliverableUrl('');
      setSocialReferenceUrl('');
      setUploadedFileUrl('');
      setUploadFileName('');
      setUploadError(null);
      setSubmitComment('');
      await fetchMyWork();
    } catch (err: any) {
      alert(err.message || 'Failed to submit deliverable');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for stage icon
  const getStageIcon = (stageKey?: string) => {
    switch (stageKey?.toLowerCase()) {
      case 'script':
      case 'content':
        return FileText;
      case 'shoot':
        return Video;
      case 'edit':
        return Film;
      case 'design':
        return Palette;
      case 'post':
        return Globe;
      default:
        return Layers;
    }
  };

  // Aggregate active items
  const allActiveItems = useMemo(() => {
    if (!data) return [];
    return [...data.overdue, ...data.today, ...data.thisWeek, ...data.upcoming];
  }, [data]);

  const totalStageAssignments = useMemo(
    () => allActiveItems.filter((i) => !!i.stageKey).length,
    [allActiveItems]
  );
  const totalDeliverables = useMemo(
    () => allActiveItems.filter((i) => i.status === 'In Progress' || !!i.deliverableUrl).length,
    [allActiveItems]
  );
  const totalSubmissions = useMemo(
    () => allActiveItems.filter((i) => i.status === 'Pending' || i.status === 'Feedback').length,
    [allActiveItems]
  );

  // Item filtering helper
  const filterItems = (items: WorkItemSummary[]) => {
    return items.filter((item) => {
      // 1. Text search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTopic = item.contentPieceId?.topic?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesStage = item.stageKey?.toLowerCase().includes(q);
        const matchesType = item.workType?.toLowerCase().includes(q);
        const matchesStatus = item.status?.toLowerCase().includes(q);
        if (!matchesTopic && !matchesTitle && !matchesStage && !matchesType && !matchesStatus) {
          return false;
        }
      }

      // 2. Category tab match
      if (activeFilter === 'stages') {
        return !!item.stageKey;
      }
      if (activeFilter === 'deliverables') {
        return item.status === 'In Progress' || !!item.deliverableUrl || !!item.publishedUrl;
      }
      if (activeFilter === 'submissions') {
        return (
          item.status === 'Pending' ||
          item.status === 'Feedback' ||
          item.status === 'Approved' ||
          item.status === 'Published'
        );
      }

      return true;
    });
  };

  const filteredOverdue = useMemo(() => filterItems(data?.overdue || []), [data?.overdue, searchQuery, activeFilter]);
  const filteredToday = useMemo(() => filterItems(data?.today || []), [data?.today, searchQuery, activeFilter]);
  const filteredThisWeek = useMemo(() => filterItems(data?.thisWeek || []), [data?.thisWeek, searchQuery, activeFilter]);
  const filteredUpcoming = useMemo(() => filterItems(data?.upcoming || []), [data?.upcoming, searchQuery, activeFilter]);
  const filteredCompleted = useMemo(() => filterItems(data?.completed || []), [data?.completed, searchQuery, activeFilter]);

  const hasAnyFilteredActive = filteredOverdue.length + filteredToday.length + filteredThisWeek.length + filteredUpcoming.length > 0;

  const renderWorkCard = (item: WorkItemSummary, isOverdueCard = false) => {
    const StageIcon = getStageIcon(item.stageKey);

    // 1. Locked Stage Card (Greyed out under Upcoming)
    if (item.isLocked) {
      return (
        <div
          key={item._id}
          className="p-5 rounded-2xl flex flex-col justify-between border border-slate-200/90 bg-slate-50/70 opacity-65 transition-all shadow-2xs hover:opacity-85"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" />
                Locked Stage {item.stageOrder ? `${item.stageOrder}: ${item.stageKey}` : ''}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Unlocks when preceding stage completes
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-700 leading-snug">
              {item.contentPieceId?.topic || item.title}
            </h3>
            {item.stageKey && (
              <span className="text-[11px] font-semibold text-purple-700/80 mt-1 flex items-center gap-1">
                <StageIcon className="w-3 h-3" />
                Step: {item.stageKey}
              </span>
            )}
            {item.contentPieceId?.brief && (
              <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 italic">
                {item.contentPieceId.brief}
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Due: {new Date(item.dueDate || item.deadline).toLocaleDateString()}</span>
            <span className="italic text-[11px] bg-slate-200/70 px-2 py-0.5 rounded">Pipeline Queue</span>
          </div>
        </div>
      );
    }

    const isPastDeadline = new Date(item.dueDate || item.deadline) < new Date();
    const isTerminal = item.status === 'Approved' || item.status === 'Published';
    const isActuallyOverdue = isPastDeadline && !isTerminal;

    const isFeedbackRework = item.status === 'Feedback' && item.revisions > 0;
    const isWaitingApproval = item.status === 'Pending' || (item.status === 'Feedback' && item.revisions === 0);
    const measures = calculateIndividualWorkMeasures(item);

    return (
      <div
        key={item._id}
        className={`glass-card p-5 rounded-2xl flex flex-col justify-between transition-all border group ${
          isActuallyOverdue || isOverdueCard
            ? 'border-rose-300/80 bg-rose-50/30 hover:border-rose-400'
            : item.status === 'Blocked'
            ? 'border-amber-300/80 bg-amber-50/20 hover:border-amber-400'
            : item.status === 'Feedback'
            ? 'border-amber-300/90 bg-amber-50/30 hover:border-amber-400'
            : item.status === 'Pending'
            ? 'border-indigo-200 bg-indigo-50/20 hover:border-indigo-300'
            : 'border-white/80 hover:border-[#7a6af6]/40'
        }`}
      >
        <div>
          {/* Top badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-[#7a6af6] border border-violet-200 flex items-center gap-1">
                <StageIcon className="w-3 h-3" />
                {item.stageKey ? `Stage ${item.stageOrder}: ${item.stageKey}` : item.workType}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  item.priority === 'High' || item.priority === 'Urgent'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : item.priority === 'Medium'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {item.priority}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {item.status === 'In Progress' && measures.workTimeFormatted !== '—' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  Working for {measures.workTimeFormatted}
                </span>
              )}
              {item.revisions > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  Rev: {item.revisions}
                </span>
              )}
              <span
                className={`status-chip ${statusClass(
                  item.status === 'In Progress' || item.status === 'Blocked'
                    ? statusTone(item.status)
                    : isFeedbackRework
                    ? 'changes'
                    : isWaitingApproval
                    ? 'waiting'
                    : statusTone(item.status)
                )} px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider`}
              >
                {isFeedbackRework ? 'Rework' : isWaitingApproval ? 'In Review' : item.status}
              </span>
            </div>
          </div>

          {/* Individual Timing Metrics for Submitted / Reviewed tasks */}
          {(isWaitingApproval || isFeedbackRework || isTerminal) && (
            <div className="flex items-center gap-2 mb-2 text-[10.5px] text-slate-500 font-medium bg-slate-50/80 px-2.5 py-1 rounded-lg border border-slate-100">
              {measures.workTimeFormatted !== '—' && (
                <span>Work: <strong className="text-slate-800">{measures.workTimeFormatted}</strong></span>
              )}
              {measures.approvalWaitFormatted !== '—' && (
                <span>• Approval wait: <strong className="text-slate-800">{measures.approvalWaitFormatted}</strong></span>
              )}
            </div>
          )}

          {/* Title / Topic */}
          <h3
            onClick={() => navigate(`/work/${item._id}`)}
            className="text-sm font-extrabold text-slate-900 group-hover:text-[#7a6af6] transition-colors cursor-pointer leading-snug"
          >
            {item.contentPieceId?.topic || item.title}
          </h3>

          {/* Program or Campaign Tag */}
          {item.contentPieceId?.programOrEvent && (
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Campaign: <span className="text-slate-700 font-semibold">{item.contentPieceId.programOrEvent}</span>
            </div>
          )}

          {/* Task Brief / Instructions */}
          {(item.contentPieceId?.brief || item.brief?.description || item.description) && (
            <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed bg-slate-50/60 p-2 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-700">Brief: </span>
              {item.contentPieceId?.brief || item.brief?.description || item.description}
            </p>
          )}

          {/* Reference Link if available */}
          {item.contentPieceId?.referenceLink && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="font-bold text-slate-600 shrink-0">Inspiration Ref:</span>
              <a
                href={item.contentPieceId.referenceLink}
                target="_blank"
                rel="noreferrer"
                className="text-[#7a6af6] hover:underline truncate flex items-center gap-1"
              >
                <span className="truncate">{item.contentPieceId.referenceLink}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          )}

          {/* Previous Stage Outputs Box */}
          {item.previousStage && (
            <div className="mt-2.5 p-2.5 bg-purple-50/70 border border-purple-200/80 rounded-xl text-[11px]">
              <span className="font-bold text-purple-900 block mb-0.5">
                Previous Stage ({item.previousStage.stageKey}) Output:
              </span>
              {item.previousStage.deliverableUrl || item.previousStage.publishedUrl ? (
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={item.previousStage.deliverableUrl || item.previousStage.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-700 hover:underline flex items-center gap-1 font-semibold truncate"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.previousStage.deliverableUrl || item.previousStage.publishedUrl}</span>
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyLink(
                        item.previousStage?.deliverableUrl || item.previousStage?.publishedUrl || '',
                        `prev-${item._id}`
                      );
                    }}
                    title="Copy Link"
                    className="p-1 rounded text-purple-600 hover:bg-purple-100 shrink-0"
                  >
                    {copiedId === `prev-${item._id}` ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-slate-400 italic">Outputs logged in previous stage</span>
              )}
            </div>
          )}

          {/* Personal Output Box */}
          {item.deliverableUrl && (
            <div className="mt-2.5 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-extrabold text-emerald-950 shrink-0">Your Output Link:</span>
                <a
                  href={item.deliverableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 hover:text-emerald-900 hover:underline font-bold truncate flex items-center gap-1"
                >
                  <span className="truncate">{item.deliverableUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink(item.deliverableUrl || '', `deliv-${item._id}`);
                }}
                title="Copy Link"
                className="p-1 rounded text-emerald-700 hover:bg-emerald-100 shrink-0"
              >
                {copiedId === `deliv-${item._id}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Live Publication Link Box */}
          {item.publishedUrl && (
            <div className="mt-2.5 p-2.5 bg-teal-50/80 border border-teal-200 rounded-xl text-[11px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Globe className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="font-extrabold text-teal-950 shrink-0">Live Published Link:</span>
                <a
                  href={item.publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-700 hover:text-teal-900 hover:underline font-bold truncate flex items-center gap-1"
                >
                  <span className="truncate">{item.publishedUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink(item.publishedUrl || '', `pub-${item._id}`);
                }}
                title="Copy Link"
                className="p-1 rounded text-teal-700 hover:bg-teal-100 shrink-0"
              >
                {copiedId === `pub-${item._id}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Submission Under Review Banner */}
          {isWaitingApproval && (
            <div className="mt-3 p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold">
                <Send className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Submitted Output</span>
              </div>
              <span className="text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded font-semibold border border-indigo-100">
                Waiting for approval
              </span>
            </div>
          )}

          {/* Revision Requested Banner (Feedback) */}
          {isFeedbackRework && (
            <div className="mt-3 p-3 bg-amber-50/95 border border-amber-300 rounded-xl text-xs text-amber-950">
              <div className="font-extrabold flex items-center gap-1.5 text-amber-900 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Revision Requested by {item.latestFeedback?.reviewer || 'Creative Head'}</span>
              </div>
              <p className="text-[11.5px] text-amber-900 font-medium pl-5 border-l-2 border-amber-400">
                "{item.latestFeedback?.text || 'Review comments on file. Please refine and submit next revision.'}"
              </p>
            </div>
          )}

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
              Due: {new Date(item.dueDate || item.deadline).toLocaleDateString()}
            </span>
            {isActuallyOverdue && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-rose-600 text-white uppercase ml-1 animate-pulse">
                Overdue
              </span>
            )}
            {item.estimatedEffortHrs && (
              <span className="text-[10px] text-slate-400 ml-1">
                ({item.estimatedEffortHrs}h effort)
              </span>
            )}
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(() => {
              const { actions, reason } = getAvailableActions(user, item as any);

              return (
                <>
                  {actions.includes('start') && (
                    <button
                      onClick={() => handleTransition(item, 'In Progress')}
                      className="px-3 py-1 bg-[#7a6af6] hover:bg-[#6857f5] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Start
                    </button>
                  )}

                  {!isWaitingApproval && actions.includes('submit_for_approval') && (
                    <button
                      onClick={() => {
                        // Shoot is submitted as clips, from its workspace, so it can go through clip review.
                        if (item.stageKey === 'Shoot') {
                          navigate(`/work/${item._id}/shoot`);
                          return;
                        }
                        setSelectedItemForSubmit(item);
                        setDeliverableUrl(item.deliverableUrl || '');
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      {isFeedbackRework ? `Resubmit (Rev ${item.revisions + 1})` : 'Submit for approval'}
                    </button>
                  )}

                  {actions.includes('mark_as_posted') && (
                    <button
                      onClick={() => {
                        setSelectedItemForSubmit(item);
                        setDeliverableUrl(item.deliverableUrl || '');
                        setSocialReferenceUrl(item.publishedUrl || '');
                        setUploadedFileUrl(item.deliverableUrl || '');
                        setUploadFileName('');
                        setUploadError(null);
                      }}
                      className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Globe className="w-3 h-3" />
                      Mark as posted
                    </button>
                  )}

                  {['Shoot', 'Edit', 'Design', 'Post'].includes(item.stageKey || '') && (
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-indigo-200 cursor-pointer"
                      title="Open full interactive workspace"
                    >
                      <Layers className="w-3 h-3" />
                      Workspace
                    </button>
                  )}

                  {actions.includes('mark_blocked') && (
                    <button
                      onClick={() => {
                        setSelectedItemForBlock(item);
                        setBlockerReason('Waiting for feedback');
                        setBlockerNote('');
                        const prevOwner = item.suggestedDependencyOwner || item.previousStage?.owner;
                        setDependencyOwnerId(prevOwner?._id || '');
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
                      title="Mark blocked"
                    >
                      <Ban className="w-3 h-3" />
                      Mark blocked
                    </button>
                  )}

                  {actions.includes('request_help') && (
                    <button
                      onClick={() => {
                        setSelectedItemForBlock(item);
                        setBlockerReason('Waiting for feedback');
                        setBlockerNote('');
                        const prevOwner = item.suggestedDependencyOwner || item.previousStage?.owner;
                        setDependencyOwnerId(prevOwner?._id || '');
                      }}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-amber-200 cursor-pointer"
                      title="Request help"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Request help
                    </button>
                  )}

                  {actions.includes('approve') && (
                    <button
                      onClick={() => navigate(`/work/${item._id}`)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Review & Rate
                    </button>
                  )}

                  {actions.includes('request_revision') && (
                    <button
                      onClick={() => navigate(`/work/${item._id}`)}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Request rework
                    </button>
                  )}

                  {actions.length === 0 && (
                    <span className="text-[11px] text-slate-500 italic font-medium px-1">
                      {reason || 'No actions available'}
                    </span>
                  )}
                </>
              );
            })()}

            <button
              onClick={() => navigate(`/work/${item._id}`)}
              className="p-1 rounded-lg text-slate-400 hover:text-[#7a6af6] transition-colors cursor-pointer"
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
            Welcome back, <strong>{user?.name}</strong>. Manage your personal stage assignments, deliverables, and submissions.
          </p>
        </div>

        <button
          onClick={() => navigate('/calendar')}
          className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:border-[#7a6af6] hover:text-[#7a6af6] transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
          View Calendar
        </button>
      </div>

      {/* 2. Personal KPI Summary Strip */}
      {data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="glass-card p-3.5 rounded-2xl border border-white/80 shadow-glass">
            <div className="text-[10px] font-bold uppercase text-slate-400">Active Work</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{data.stats.activeCount}</div>
            <div className="text-[10px] text-slate-500 font-medium">In your queue</div>
          </div>

          <div className="glass-card p-3.5 rounded-2xl border border-white/80 shadow-glass">
            <div className="text-[10px] font-bold uppercase text-purple-600">Stage Assignments</div>
            <div className="text-2xl font-black text-purple-700 mt-0.5">{totalStageAssignments}</div>
            <div className="text-[10px] text-slate-500 font-medium">Pipeline stages</div>
          </div>

          <div
            className={`glass-card p-3.5 rounded-2xl border shadow-glass ${
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
              {data.stats.overdueCount > 0 ? 'Needs action' : 'All on track'}
            </div>
          </div>

          <div className="glass-card p-3.5 rounded-2xl border border-white/80 shadow-glass">
            <div className="text-[10px] font-bold uppercase text-slate-400">Due Today</div>
            <div className="text-2xl font-black text-violet-700 mt-0.5">{data.stats.todayCount}</div>
            <div className="text-[10px] text-slate-500 font-medium">Daily commitment</div>
          </div>

          <div className="glass-card p-3.5 rounded-2xl border border-white/80 shadow-glass">
            <div className="text-[10px] font-bold uppercase text-indigo-600">Submissions</div>
            <div className="text-2xl font-black text-indigo-700 mt-0.5">{totalSubmissions}</div>
            <div className="text-[10px] text-slate-500 font-medium">In Review / Rework</div>
          </div>

          <div className="glass-card p-3.5 rounded-2xl border border-white/80 shadow-glass col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold uppercase text-slate-400">Completed</div>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">{data.stats.completedCount}</div>
            <div className="text-[10px] text-slate-500 font-medium">Approved / Live</div>
          </div>
        </div>
      )}

      {/* 2.5 Quick Filter Navigation Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            All Work ({data?.stats?.activeCount ?? 0})
          </button>

          <button
            onClick={() => setActiveFilter('stages')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'stages'
                ? 'bg-[#7a6af6] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Stage Assignments ({totalStageAssignments})
          </button>

          <button
            onClick={() => setActiveFilter('deliverables')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'deliverables'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Outputs ({totalDeliverables})
          </button>

          <button
            onClick={() => setActiveFilter('submissions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'submissions'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Submissions & Reviews ({totalSubmissions})
          </button>
        </div>

        {/* Quick Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search steps, topics, tasks..."
            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]/40 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Queues */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading personal work queue...
        </div>
      ) : !hasAnyFilteredActive && filteredCompleted.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-white/80 shadow-glass">
          <Sparkles className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-900">
            {searchQuery
              ? `No matching items found for "${searchQuery}"`
              : activeFilter !== 'all'
              ? `No items found under "${activeFilter}"`
              : 'All caught up! Zero pending deliverables.'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery
              ? 'Try adjusting your search query or clear the filter to see your complete queue.'
              : 'You have cleared all scheduled stage items. When new content pieces or stage handoffs unlock, they will appear here automatically.'}
          </p>
          {(searchQuery || activeFilter !== 'all') && (
            <button
              onClick={() => {
                setActiveFilter('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section A: Overdue (if any exist) */}
          {filteredOverdue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <h2 className="text-base font-extrabold text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Overdue Action Required ({filteredOverdue.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOverdue.map((item) => renderWorkCard(item, true))}
              </div>
            </div>
          )}

          {/* Section B: Today's Priorities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-[#7a6af6]" />
                Today's Priorities ({filteredToday.length})
              </h2>
            </div>

            {filteredToday.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredToday.map((item) => renderWorkCard(item))}
              </div>
            ) : activeFilter === 'all' && !searchQuery ? (
              <div className="glass-card p-6 text-center rounded-2xl border border-white/80">
                <Sparkles className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                <h4 className="text-sm font-bold text-slate-900">No deadlines for today!</h4>
                <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
                  You have cleared all of today's deliverables. You can pull work from your upcoming queue or focus on deep creative production.
                </p>
              </div>
            ) : null}
          </div>

          {/* Section C: This Week */}
          {filteredThisWeek.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                This Week ({filteredThisWeek.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredThisWeek.map((item) => renderWorkCard(item))}
              </div>
            </div>
          )}

          {/* Section D: Upcoming / Later */}
          {filteredUpcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                Upcoming / Pipeline ({filteredUpcoming.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUpcoming.map((item) => renderWorkCard(item))}
              </div>
            </div>
          )}

          {/* Section E: Completed Deliverables (Collapsible) */}
          {filteredCompleted.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Recently Completed ({filteredCompleted.length})
                {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showCompleted && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                  {filteredCompleted.map((item) => renderWorkCard(item))}
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
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
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
              {/* Suggested Previous Stage Dependency Owner */}
              {(selectedItemForBlock?.suggestedDependencyOwner || selectedItemForBlock?.previousStage?.owner) && (
                <div className="p-3 bg-purple-50/90 border border-purple-200/90 rounded-xl text-xs">
                  <span className="font-bold text-purple-900 block mb-1">
                    Suggested Dependency Owner (Previous Stage):
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 truncate">
                      {selectedItemForBlock?.suggestedDependencyOwner?.name || selectedItemForBlock?.previousStage?.owner?.name} ({selectedItemForBlock?.previousStage?.stageKey || 'Previous'} stage owner)
                    </span>
                    <button
                      type="button"
                      onClick={() => setDependencyOwnerId(selectedItemForBlock?.suggestedDependencyOwner?._id || selectedItemForBlock?.previousStage?.owner?._id || '')}
                      className="text-[11px] font-bold text-purple-600 hover:text-purple-800 bg-white px-2 py-0.5 rounded border border-purple-200 shadow-2xs whitespace-nowrap cursor-pointer"
                    >
                      {dependencyOwnerId === (selectedItemForBlock?.suggestedDependencyOwner?._id || selectedItemForBlock?.previousStage?.owner?._id) ? 'Selected ✓' : 'Select'}
                    </button>
                  </div>
                </div>
              )}

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
                  placeholder="Explain what is blocking progress so it can be resolved..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemForBlock(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBlocking}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isBlocking ? 'Updating...' : 'Confirm Blocked'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Submit Output for Review / Publish Modal */}
      {selectedItemForSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-md p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {selectedItemForSubmit.stageKey === 'Post' ? (
                  <Globe className="w-5 h-5 text-teal-600" />
                ) : (
                  <Send className="w-5 h-5 text-indigo-600" />
                )}
                <h3 className="text-base font-extrabold text-slate-900">
                  {selectedItemForSubmit.stageKey === 'Post'
                    ? 'Mark as posted & add social link'
                    : 'Submit for approval'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemForSubmit(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitDeliverable} className="space-y-4">
              {/* Optional Post File / Asset Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedItemForSubmit.stageKey === 'Post'
                    ? 'Upload Post Asset / Creative File (Optional)'
                    : 'Upload Output Deliverable File (Optional)'}
                </label>
                <input
                  type="file"
                  ref={submitFileInputRef}
                  onChange={handleModalFileUpload}
                  accept="image/*,video/*,application/pdf"
                  className="hidden"
                />

                <div className="space-y-2">
                  {uploadedFileUrl ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                      <div className="flex items-center gap-2 truncate">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold truncate">{uploadFileName || uploadedFileUrl}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => submitFileInputRef.current?.click()}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline shrink-0 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : isUploadingFile ? (
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs space-y-1">
                      <div className="flex justify-between text-indigo-900 font-semibold text-[11px]">
                        <span>Uploading {uploadFileName}...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-indigo-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => submitFileInputRef.current?.click()}
                      className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-indigo-400 rounded-xl text-xs text-slate-600 hover:text-indigo-600 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{selectedItemForSubmit.stageKey === 'Post' ? 'Attach post image / video / proof' : 'Attach deliverable file'}</span>
                    </button>
                  )}
                  {uploadError && <p className="text-[11px] text-rose-600">{uploadError}</p>}
                </div>
              </div>

              {/* URL input: Social Reference link for Post, or asset link for others */}
              {selectedItemForSubmit.stageKey === 'Post' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Live Social Reference URL (Instagram, LinkedIn, YouTube, TikTok) *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://instagram.com/reel/... or https://linkedin.com/posts/..."
                    value={socialReferenceUrl || deliverableUrl}
                    onChange={(e) => {
                      setSocialReferenceUrl(e.target.value);
                      setDeliverableUrl(e.target.value);
                    }}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Paste the live published URL from the social platform as reference.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Output Link / Asset URL (Google Drive, Figma, Frame.io)
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... or Figma link"
                    value={deliverableUrl}
                    onChange={(e) => setDeliverableUrl(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedItemForSubmit.stageKey === 'Post'
                    ? 'Posting Notes (Optional)'
                    : 'Notes for Reviewer (Optional)'}
                </label>
                <textarea
                  rows={3}
                  value={submitComment}
                  onChange={(e) => setSubmitComment(e.target.value)}
                  placeholder={
                    selectedItemForSubmit.stageKey === 'Post'
                      ? 'e.g. Published as Reel with pinned comment, audio sync verified...'
                      : 'Summarize key outputs, raw footage drive link, or review context...'
                  }
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemForSubmit(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingFile}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer ${
                    selectedItemForSubmit.stageKey === 'Post'
                      ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                  }`}
                >
                  {isSubmitting
                    ? 'Submitting...'
                    : selectedItemForSubmit.stageKey === 'Post'
                    ? 'Mark as Posted'
                    : 'Submit to Creative Head'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
