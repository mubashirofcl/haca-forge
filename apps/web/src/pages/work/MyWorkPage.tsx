import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { TimeLabelChips, type TimeLabel } from '../../components/TimeLabelChips';
import { hasTimeLabel, normalizePriority } from '@mmp/shared';
import { statusClass, statusTone } from '../../lib/statusTone';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { useAuth } from '../../context/AuthContext';
import { ResumableUploadTask } from '../../lib/uploadManager';
import { resolveStepBlocker } from '../../lib/blockers';
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
  /** Phase 7: computed time labels. */
  timeLabels?: TimeLabel[];
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
  // Modal keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const blockDialogRef = useRef<HTMLDivElement>(null);
  const submitDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(blockDialogRef, Boolean(selectedItemForBlock), () => setSelectedItemForBlock(null));
  useDialogFocus(submitDialogRef, Boolean(selectedItemForSubmit), () => setSelectedItemForSubmit(null));
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
      // From Feedback, a move to the same status would change nothing and save nothing.
      const toStatus = isPost ? 'Published' : selectedItemForSubmit.status === 'Feedback' ? 'Pending' : 'Feedback';

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
          className="p-5 rounded-ui-card flex flex-col justify-between bg-white/40 ring-1 ring-inset ring-ui-line"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="status-chip status-locked px-2.5 py-0.5 text-[11px] font-semibold">
                <Lock className="w-3 h-3" />
                Locked Stage {item.stageOrder ? `${item.stageOrder}: ${item.stageKey}` : ''}
              </span>
              <span className="text-[10px] text-ui-muted font-medium">
                Unlocks when preceding stage completes
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-700 leading-snug">
              {item.contentPieceId?.topic || item.title}
            </h3>
            {item.stageKey && (
              <span className="text-[11px] font-semibold text-ui-ink mt-1 flex items-center gap-1">
                <StageIcon className="w-3 h-3" />
                Step: {item.stageKey}
              </span>
            )}
            {item.contentPieceId?.brief && (
              <p className="text-[11px] text-ui-muted mt-2 line-clamp-2 italic">
                {item.contentPieceId.brief}
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-ui-muted text-xs font-medium">
            <span>Due: {new Date(item.dueDate || item.deadline).toLocaleDateString()}</span>
            <span className="italic text-[11px] bg-white/70 px-2 py-0.5 rounded-full">Pipeline Queue</span>
          </div>
        </div>
      );
    }

    // Phase 7: the shared Overdue label (unlocked, unfinished, past the due date in IST).
    const isActuallyOverdue = hasTimeLabel(item.timeLabels as never, 'overdue');
    const isTerminal = item.status === 'Approved' || item.status === 'Published';

    // The latest version decides: a resubmitted step is under review, even after earlier revisions.
    const latestStatus = (item as any).latestSubmissionStatus as string | null | undefined;
    const isWaitingApproval =
      item.status === 'Pending' ||
      (item.status === 'Feedback' && (latestStatus ? latestStatus === 'submitted' : item.revisions === 0));
    const isFeedbackRework =
      !isWaitingApproval &&
      item.revisions > 0 &&
      (item.status === 'Feedback' || (item.status === 'In Progress' && latestStatus === 'changes_requested'));
    const measures = calculateIndividualWorkMeasures(item);

    return (
      <div
        key={item._id}
        className={`glass-card p-5 flex flex-col justify-between group ${
          isActuallyOverdue || isOverdueCard ? 'outline outline-1 -outline-offset-1 outline-ui-coral' : ''
        }`}
      >
        <div>
          {/* Top badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/70 text-ui-ink border border-ui-line flex items-center gap-1">
                <StageIcon className="w-3 h-3" />
                {item.stageKey ? `Stage ${item.stageOrder}: ${item.stageKey}` : item.workType}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  normalizePriority(item.priority) === 'Urgent' ? 'status-tint status-changes' : 'bg-white/70 text-ui-text'
                }`}
                data-testid="priority-chip"
              >
                {normalizePriority(item.priority)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {item.status === 'In Progress' && measures.workTimeFormatted !== '—' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/70 text-ui-text">
                  Working for {measures.workTimeFormatted}
                </span>
              )}
              {item.revisions > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/70 text-ui-ink border border-ui-line">
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
                )} px-2.5 py-0.5 text-[10px] font-extrabold`}
              >
                {isFeedbackRework ? 'Rework' : isWaitingApproval ? 'In Review' : item.status}
              </span>
            </div>
          </div>

          {/* Individual Timing Metrics for Submitted / Reviewed tasks */}
          {(isWaitingApproval || isFeedbackRework || isTerminal) && (
            <div className="flex items-center gap-2 mb-2 text-[11px] text-ui-muted font-medium bg-white/60 px-2.5 py-1 rounded-lg">
              {measures.workTimeFormatted !== '—' && (
                <span>Work: <strong className="text-slate-800">{measures.workTimeFormatted}</strong></span>
              )}
              {measures.approvalWaitFormatted !== '—' && (
                <span>• Approval wait: <strong className="text-slate-800">{measures.approvalWaitFormatted}</strong></span>
              )}
            </div>
          )}

          {/* Title / Topic */}
          <h3 className="text-[15px] font-semibold text-ui-ink leading-snug">
            <button
              type="button"
              onClick={() => navigate(`/work/${item._id}`)}
              className="text-left py-3 -my-3 hover:underline underline-offset-4 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2"
            >
              {item.contentPieceId?.topic || item.title}
            </button>
          </h3>

          {/* Program or Campaign Tag */}
          {item.contentPieceId?.programOrEvent && (
            <div className="text-[11px] font-medium text-ui-muted mt-0.5">
              Campaign: <span className="text-slate-700 font-semibold">{item.contentPieceId.programOrEvent}</span>
            </div>
          )}

          {/* Task Brief / Instructions */}
          {(item.contentPieceId?.brief || item.brief?.description || item.description) && (
            <p className="text-xs text-ui-text mt-2 line-clamp-2 leading-relaxed bg-white/60 p-2.5 rounded-xl">
              <span className="font-bold text-slate-700">Brief: </span>
              {item.contentPieceId?.brief || item.brief?.description || item.description}
            </p>
          )}

          {/* Reference Link if available */}
          {item.contentPieceId?.referenceLink && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ui-muted">
              <span className="font-bold text-slate-600 shrink-0">Inspiration Ref:</span>
              <a
                href={item.contentPieceId.referenceLink}
                target="_blank"
                rel="noreferrer"
                className="text-ui-ink hover:underline truncate flex items-center gap-1 min-h-[44px] -my-3"
              >
                <span className="truncate">{item.contentPieceId.referenceLink}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          )}

          {/* Previous Stage Outputs Box */}
          {item.previousStage && (
            <div className="mt-2.5 p-2.5 bg-white/60 rounded-xl text-[11px]">
              <span className="font-bold text-ui-ink block mb-0.5">
                Previous Stage ({item.previousStage.stageKey}) Output:
              </span>
              {item.previousStage.deliverableUrl || item.previousStage.publishedUrl ? (
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={item.previousStage.deliverableUrl || item.previousStage.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ui-ink hover:underline flex items-center gap-1 font-semibold truncate"
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
                    aria-label="Copy link"
                    className="ui-icon-btn border-transparent shrink-0"
                  >
                    {copiedId === `prev-${item._id}` ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-ui-muted italic">Outputs logged in previous stage</span>
              )}
            </div>
          )}

          {/* Personal Output Box */}
          {item.deliverableUrl && (
            <div className="mt-2.5 pl-2.5 bg-white/60 rounded-xl text-[11px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileCheck className="w-4 h-4 text-ui-ink shrink-0" />
                <span className="font-semibold text-ui-text shrink-0">Your Output Link:</span>
                <a
                  href={item.deliverableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-ink hover:underline font-semibold truncate flex items-center gap-1"
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
                aria-label="Copy link"
                className="ui-icon-btn border-transparent shrink-0"
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
            <div className="mt-2.5 pl-2.5 bg-white/60 rounded-xl text-[11px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Globe className="w-4 h-4 text-ui-ink shrink-0" />
                <span className="font-semibold text-ui-text shrink-0">Live Published Link:</span>
                <a
                  href={item.publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-ink hover:underline font-semibold truncate flex items-center gap-1"
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
                aria-label="Copy link"
                className="ui-icon-btn border-transparent shrink-0"
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
            <div className="mt-3 p-2.5 bg-white/60 rounded-xl text-xs text-ui-ink flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold">
                <Send className="w-3.5 h-3.5 text-ui-ink shrink-0" />
                <span>Submitted Output</span>
              </div>
              <span className="status-chip status-waiting text-[11px] px-2 py-0.5 font-semibold">
                Waiting for approval
              </span>
            </div>
          )}

          {/* Revision Requested Banner (Feedback) */}
          {isFeedbackRework && (
            <div className="mt-3 p-3 rounded-xl text-xs status-tint status-changes">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Revision Requested by {item.latestFeedback?.reviewer || 'Creative Head'}</span>
              </div>
              <p className="text-xs font-medium pl-3 ml-1 border-l-2 border-ui-coral">
                "{item.latestFeedback?.text || 'Review comments on file. Please refine and submit next revision.'}"
              </p>
            </div>
          )}

          {/* Blocker alert if blocked */}
          {item.status === 'Blocked' && (
            <div className="mt-3 p-2.5 rounded-xl text-xs status-tint status-changes">
              <div className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Blocked: {item.blockerReason}</span>
              </div>
              {item.blockerNote && <p className="text-xs mt-0.5">{item.blockerNote}</p>}
            </div>
          )}
        </div>

        {/* Card Footer: Deadline & Action Triggers */}
        <div className="mt-4 pt-3 border-t border-ui-line flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-ui-muted">
            <Calendar className="w-3.5 h-3.5 text-ui-muted" />
            <span className={isActuallyOverdue ? 'text-ui-ink font-semibold' : 'text-ui-text'}>
              Due: {new Date(item.dueDate || item.deadline).toLocaleDateString()}
            </span>
            <TimeLabelChips labels={item.timeLabels} className="ml-1" />
            {item.estimatedEffortHrs && (
              <span className="text-[10px] text-ui-muted ml-1">
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
                      className="ui-btn ui-btn-primary h-11 px-4"
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
                      className="ui-btn ui-btn-primary h-11 px-4"
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
                      className="ui-btn ui-btn-primary h-11 px-4"
                    >
                      <Globe className="w-3 h-3" />
                      Mark as posted
                    </button>
                  )}

                  {['Shoot', 'Edit', 'Design', 'Post'].includes(item.stageKey || '') && (
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      className="ui-btn ui-btn-secondary h-11 px-4"
                      title="Open full interactive workspace"
                    >
                      <Layers className="w-3 h-3" />
                      Workspace
                    </button>
                  )}

                  {!isWaitingApproval && actions.includes('mark_blocked') && (
                    <button
                      onClick={() => {
                        setSelectedItemForBlock(item);
                        setBlockerReason('Waiting for feedback');
                        setBlockerNote('');
                        const prevOwner = item.suggestedDependencyOwner || item.previousStage?.owner;
                        setDependencyOwnerId(prevOwner?._id || '');
                      }}
                      className="ui-btn ui-btn-secondary h-11 px-4"
                      title="Mark blocked"
                    >
                      <Ban className="w-3 h-3" />
                      Mark blocked
                    </button>
                  )}

                  {actions.includes('resolve_blocker') && (
                    <button
                      onClick={async () => {
                        try {
                          await resolveStepBlocker(item._id);
                          await fetchMyWork();
                        } catch (err: any) {
                          alert(err.message || 'Could not resolve the blocker');
                        }
                      }}
                      className="ui-btn ui-btn-primary h-11 px-4"
                      title="Resolve blocker"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Resolve Blocker
                    </button>
                  )}

                  {!isWaitingApproval && actions.includes('request_help') && (
                    <button
                      onClick={() => {
                        setSelectedItemForBlock(item);
                        setBlockerReason('Waiting for feedback');
                        setBlockerNote('');
                        const prevOwner = item.suggestedDependencyOwner || item.previousStage?.owner;
                        setDependencyOwnerId(prevOwner?._id || '');
                      }}
                      className="ui-btn ui-btn-secondary h-11 px-4"
                      title="Request help"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Request help
                    </button>
                  )}

                  {actions.includes('approve') && (
                    <button
                      onClick={() => navigate(`/work/${item._id}`)}
                      className="ui-btn ui-btn-primary h-11 px-4"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Review & Rate
                    </button>
                  )}

                  {actions.includes('request_revision') && (
                    <button
                      onClick={() => navigate(`/work/${item._id}`)}
                      className="ui-btn ui-btn-secondary h-11 px-4"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Request rework
                    </button>
                  )}

                  {actions.length === 0 && (
                    <span className="text-[11px] text-ui-muted italic font-medium px-1">
                      {reason || 'No actions available'}
                    </span>
                  )}
                </>
              );
            })()}

            <button
              onClick={() => navigate(`/work/${item._id}`)}
              className="ui-icon-btn"
              title="Open detail"
              aria-label="Open detail"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. Header Banner & Personal Cockpit */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-[13px] font-medium text-ui-muted">
            <span className="inline-flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              Focus Cockpit
            </span>
            <span aria-hidden="true">·</span>
            <span>Zero Surveillance • Mental Clarity</span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">
            My Work
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ui-muted max-w-[70ch]">
            Welcome back, <strong>{user?.name}</strong>. Manage your personal stage assignments, deliverables, and submissions.
          </p>
        </div>

        <button
          onClick={() => navigate('/calendar')}
          className="ui-btn ui-btn-secondary bg-transparent h-11 self-start sm:self-auto"
        >
          <Calendar className="w-3.5 h-3.5" />
          View Calendar
        </button>
      </div>

      {/* 2. Personal KPI Summary Strip: one card, hairline dividers */}
      {data?.stats && (
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-ui-line">
            {[
              { label: 'Active Work', value: data.stats.activeCount, note: 'In your queue' },
              { label: 'Stage Assignments', value: totalStageAssignments, note: 'Pipeline stages' },
              {
                label: 'Overdue',
                value: data.stats.overdueCount,
                note: data.stats.overdueCount > 0 ? 'Needs action' : 'All on track',
                alert: data.stats.overdueCount > 0,
              },
              { label: 'Due Today', value: data.stats.todayCount, note: 'Daily commitment' },
              { label: 'Submissions', value: totalSubmissions, note: 'In Review / Rework' },
              { label: 'Completed', value: data.stats.completedCount, note: 'Approved / Live' },
            ].map(({ label, value, note, alert }) => (
              <div key={label} className="p-4 sm:p-5 bg-ui-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-ui-muted">{label}</span>
                  {alert && <AlertTriangle className="w-4 h-4 text-ui-coral shrink-0" aria-hidden="true" />}
                </div>
                <div className="mt-1 text-[28px] leading-9 font-semibold text-ui-ink tabular-nums">{value}</div>
                <div className="text-xs text-ui-muted">{note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2.5 Quick Filter Navigation Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1">
        <div className="max-w-full overflow-x-auto no-scrollbar">
        <div className="ui-tabs">
          <button
            onClick={() => setActiveFilter('all')}
            aria-pressed={activeFilter === 'all'}
            className={`ui-tab ${activeFilter === 'all' ? 'is-active' : ''}`}
          >
            All Work ({data?.stats?.activeCount ?? 0})
          </button>

          <button
            onClick={() => setActiveFilter('stages')}
            aria-pressed={activeFilter === 'stages'}
            className={`ui-tab ${activeFilter === 'stages' ? 'is-active' : ''}`}
          >
            <Layers className="w-3.5 h-3.5" />
            Stage Assignments ({totalStageAssignments})
          </button>

          <button
            onClick={() => setActiveFilter('deliverables')}
            aria-pressed={activeFilter === 'deliverables'}
            className={`ui-tab ${activeFilter === 'deliverables' ? 'is-active' : ''}`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Outputs ({totalDeliverables})
          </button>

          <button
            onClick={() => setActiveFilter('submissions')}
            aria-pressed={activeFilter === 'submissions'}
            className={`ui-tab ${activeFilter === 'submissions' ? 'is-active' : ''}`}
          >
            <Send className="w-3.5 h-3.5" />
            Submissions & Reviews ({totalSubmissions})
          </button>
        </div>
        </div>

        {/* Quick Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-ui-muted absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search steps, topics, tasks..."
            aria-label="Search steps, topics, tasks"
            className="ui-input w-full pl-10 pr-11"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-ui-muted hover:text-ui-ink"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Queues */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-ui-muted animate-pulse">
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
          <p className="text-xs text-ui-muted mt-1 max-w-md mx-auto">
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
              className="ui-btn ui-btn-primary h-11 mt-4"
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
                <span className="w-2.5 h-2.5 rounded-full bg-ui-coral animate-ping" aria-hidden="true" />
                <h2 className="text-base font-semibold text-ui-ink flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-ui-coral" />
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
              <h2 className="text-base font-semibold text-ui-ink flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-ui-ink" />
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
                <p className="text-xs text-ui-muted mt-0.5 max-w-sm mx-auto">
                  You have cleared all of today's deliverables. You can pull work from your upcoming queue or focus on deep creative production.
                </p>
              </div>
            ) : null}
          </div>

          {/* Section C: This Week */}
          {filteredThisWeek.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-ui-ink flex items-center gap-2">
                <Calendar className="w-4 h-4 text-ui-muted" />
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
              <h2 className="text-base font-semibold text-ui-ink flex items-center gap-2">
                <Layers className="w-4 h-4 text-ui-muted" />
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
                aria-expanded={showCompleted}
                className="flex items-center gap-2 min-h-[44px] text-sm font-semibold text-ui-text hover:text-ui-ink transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim backdrop-blur-sm animate-fade-in">
          <div
            ref={blockDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mywork-block-title"
            className="glass-modal w-full max-w-md p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-ui-line pb-3">
              <div className="flex items-center gap-2 text-ui-ink">
                <Ban className="w-5 h-5 text-ui-coral" />
                <h3 id="mywork-block-title" className="text-base font-semibold text-ui-ink">Mark Work Item Blocked</h3>
              </div>
              <button
                onClick={() => setSelectedItemForBlock(null)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {blockError && (
              <div className="p-3 rounded-xl text-xs status-tint status-changes">
                {blockError}
              </div>
            )}

            <form onSubmit={submitBlocker} className="space-y-4">
              {/* Suggested Previous Stage Dependency Owner */}
              {(selectedItemForBlock?.suggestedDependencyOwner || selectedItemForBlock?.previousStage?.owner) && (
                <div className="p-3 bg-white/70 border border-ui-line rounded-xl text-xs">
                  <span className="font-bold text-ui-ink block mb-1">
                    Suggested Dependency Owner (Previous Stage):
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 truncate">
                      {selectedItemForBlock?.suggestedDependencyOwner?.name || selectedItemForBlock?.previousStage?.owner?.name} ({selectedItemForBlock?.previousStage?.stageKey || 'Previous'} stage owner)
                    </span>
                    <button
                      type="button"
                      onClick={() => setDependencyOwnerId(selectedItemForBlock?.suggestedDependencyOwner?._id || selectedItemForBlock?.previousStage?.owner?._id || '')}
                      className="text-[11px] font-bold text-ui-ink hover:text-ui-ink bg-white px-2 py-0.5 rounded border border-ui-line shadow-2xs whitespace-nowrap cursor-pointer"
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
                  className="ui-select w-full"
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
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemForBlock(null)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBlocking}
                  className="ui-btn ui-btn-primary h-11"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim backdrop-blur-sm animate-fade-in">
          <div
            ref={submitDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mywork-submit-title"
            className="glass-modal w-full max-w-md p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-ui-line pb-3">
              <div className="flex items-center gap-2">
                {selectedItemForSubmit.stageKey === 'Post' ? (
                  <Globe className="w-5 h-5 text-teal-600" />
                ) : (
                  <Send className="w-5 h-5 text-ui-ink" />
                )}
                <h3 id="mywork-submit-title" className="text-base font-extrabold text-slate-900">
                  {selectedItemForSubmit.stageKey === 'Post'
                    ? 'Mark as posted & add social link'
                    : 'Submit for approval'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemForSubmit(null)}
                aria-label="Close" className="ui-icon-btn"
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
                    <div className="p-2.5 rounded-xl bg-white/70 border border-ui-line text-xs space-y-1">
                      <div className="flex justify-between text-ui-ink font-semibold text-[11px]">
                        <span>Uploading {uploadFileName}...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-ui-line rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-ui-blue h-full rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => submitFileInputRef.current?.click()}
                      className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-ui-ink/30 rounded-xl text-xs text-slate-600 hover:text-ui-ink flex items-center justify-center gap-1.5 transition cursor-pointer"
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
                    className="ui-input w-full font-mono"
                  />
                  <p className="text-[10px] text-ui-muted mt-1">
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
                    className="ui-input w-full"
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
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemForSubmit(null)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingFile}
                  className="ui-btn ui-btn-primary h-11"
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
