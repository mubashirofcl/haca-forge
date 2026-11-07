import React, { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { OverdueChip } from '../../components/OverdueChip';
import { statusClass, statusTone } from '../../lib/statusTone';
import { useAuth } from '../../context/AuthContext';
import {
  WORK_TYPES,
  PRIORITIES,
  BLOCKER_REASONS,
  RATING_TAGS,
  CANONICAL_REVISION_ROOT_CAUSES,
  type CanonicalRevisionRootCause,
  getAvailableActions,
  getStepStatusLabel,
  calculateIndividualWorkMeasures,
  type WorkType,
  type WorkItemStatus,
  type Priority,
  type BlockerReason,
} from '@mmp/shared';
import {
  ArrowLeft,
  AlertTriangle,
  Play,
  Send,
  Ban,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Trash2,
  Activity,
  FileText,
  Check,
  X,
  Copy,
  CheckCheck,
  Globe,
  Info,
  RotateCcw,
  SkipForward,
  HelpCircle,
  Layers,
  Sparkles,
  Video,
  Film,
  Palette,
  Share2,
  Star,
  FileCheck,
} from 'lucide-react';
import { PipelineStepper, type PipelineStageItem } from '../../components/PipelineStepper';
import { AssetLinks } from '../../components/AssetLinks';

const NO_SUBMISSION_TO_REVIEW =
  'This step has no submission to review yet. It can be approved or sent back once the owner submits their work.';

interface WorkItemDetail {
  /** Approved files of a finished non-postable Design step (sm_manager, creative_head and admin only). */
  handover?: {
    approvedAt?: string | null;
    version?: number | null;
    items: Array<{ url: string; name?: string | null; kind?: 'upload' | 'drive' | 'link' }>;
  };
  _id: string;
  title: string;
  workType: WorkType;
  deadline: string;
  estimatedEffortHrs: number;
  status: WorkItemStatus;
  priority: Priority;
  revisions: number;
  ownerId?: any;
  description?: string;
  deliverableUrl?: string;
  publishedUrl?: string;
  blockerReason?: BlockerReason;
  blockerNote?: string;
  contentPieceId?: string | null;
  stageKey?: string | null;
  stageOrder?: number | null;
  reviewRequired?: boolean;
  unlockedAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  resubmittedAt?: string | null;
  approvedAt?: string | null;
  postedAt?: string | null;
  isSkipped?: boolean;
  isLocked?: boolean;
  contentLink?: string;
  assetsLink?: string;
  brief?: {
    description?: string;
    contentLink?: string;
    assetsLink?: string;
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
  pieceStages?: PipelineStageItem[];
  scriptShotList?: Array<{
    sceneNumber: number;
    visual: string;
    audio?: string;
    estTime?: number;
  }>;
  departmentId: { _id: string; name: string; code: string };
  rating?: {
    _id: string;
    score: number;
    feedback?: string;
    tags?: string[];
    stageKey: string;
    seenAt?: string | null;
    raterId?: { _id: string; name: string; role?: string };
    editedLog?: Array<{
      editedBy?: { name?: string; role?: string } | string;
      editedAt: string;
      oldScore: number;
      newScore: number;
      oldFeedback?: string;
      newFeedback?: string;
      oldTags?: string[];
      newTags?: string[];
      reason: string;
    }>;
    createdAt: string;
  };
  latestSubmission?: any;
  draftSubmission?: any;
  scriptContent?: string;
  approvedClips?: any[];
  createdAt: string;
  updatedAt: string;
}

interface ActivityEventItem {
  _id: string;
  action: string;
  actorId?: { name: string; email: string; role?: string };
  fromStatus?: string;
  toStatus?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export const WorkDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [activities, setActivities] = useState<ActivityEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'brief' | 'deliverable' | 'activity'>('brief');

  // Blocker Modal
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [blockerReason, setBlockerReason] = useState<BlockerReason>('Waiting for feedback');
  const [blockerNote, setBlockerNote] = useState('');
  const [dependencyOwnerId, setDependencyOwnerId] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Submit / Done / Post Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitAction, setSubmitAction] = useState<'submit_for_approval' | 'mark_as_posted'>('submit_for_approval');
  const [submitUrl, setSubmitUrl] = useState('');
  const [submitComment, setSubmitComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approve Deliverable Modal (Creative Head / Admin)
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveRatingScore, setApproveRatingScore] = useState<number>(5);
  const [approveFeedback, setApproveFeedback] = useState<string>('');
  const [approveTags, setApproveTags] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);

  // Revision / Rework Modal
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [revisionRootCause, setRevisionRootCause] = useState<CanonicalRevisionRootCause>(CANONICAL_REVISION_ROOT_CAUSES[0]);

  // Delete Confirm Modal
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editWorkType, setEditWorkType] = useState<WorkType>('Static Post');
  const [editPriority, setEditPriority] = useState<Priority>('Normal');
  const [editEffort, setEditEffort] = useState(4);
  const [editDeadline, setEditDeadline] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeliverableUrl, setEditDeliverableUrl] = useState('');
  const [editPublishedUrl, setEditPublishedUrl] = useState('');
  const [editContentLink, setEditContentLink] = useState('');
  const [editAssetsLink, setEditAssetsLink] = useState('');
  const [copiedContentLink, setCopiedContentLink] = useState(false);
  const [copiedAssetsLink, setCopiedAssetsLink] = useState(false);
  const [copiedDeliverableLink, setCopiedDeliverableLink] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Rating Edit Modal (WS4: Step Ratings & Corrections)
  const [showEditRatingModal, setShowEditRatingModal] = useState(false);
  const [editRatingScore, setEditRatingScore] = useState<number>(5);
  const [editRatingFeedback, setEditRatingFeedback] = useState<string>('');
  const [editRatingTags, setEditRatingTags] = useState<string[]>([]);
  const [editRatingReason, setEditRatingReason] = useState<string>('');
  const [isSubmittingRatingEdit, setIsSubmittingRatingEdit] = useState(false);
  const [ratingActionError, setRatingActionError] = useState<string | null>(null);

  // Modal keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const submitDialogRef = useRef<HTMLDivElement>(null);
  const revisionDialogRef = useRef<HTMLDivElement>(null);
  const approveDialogRef = useRef<HTMLDivElement>(null);
  const blockerDialogRef = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const editDialogRef = useRef<HTMLDivElement>(null);
  const editRatingDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(submitDialogRef, showSubmitModal, () => setShowSubmitModal(false));
  useDialogFocus(revisionDialogRef, showRevisionModal, () => setShowRevisionModal(false));
  useDialogFocus(approveDialogRef, showApproveModal, () => setShowApproveModal(false));
  useDialogFocus(blockerDialogRef, showBlockerModal, () => setShowBlockerModal(false));
  useDialogFocus(deleteDialogRef, showDeleteConfirmModal, () => setShowDeleteConfirmModal(false));
  useDialogFocus(editDialogRef, showEditModal, () => setShowEditModal(false));
  useDialogFocus(editRatingDialogRef, showEditRatingModal, () => setShowEditRatingModal(false));

  const handleMarkRatingSeen = async () => {
    if (!item?.rating?._id) return;
    try {
      await apiFetch(`/api/submissions/ratings/${item.rating._id}/seen`, { method: 'POST' });
      await fetchItemData();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge rating');
    }
  };

  const openEditRatingModal = () => {
    if (!item?.rating) return;
    setEditRatingScore(item.rating.score);
    setEditRatingFeedback(item.rating.feedback || '');
    setEditRatingTags(item.rating.tags || []);
    setEditRatingReason('');
    setRatingActionError(null);
    setShowEditRatingModal(true);
  };

  const handleSubmitRatingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item?.rating?._id) return;
    if (!editRatingReason.trim()) {
      setRatingActionError('Reason for editing rating is required');
      return;
    }
    setIsSubmittingRatingEdit(true);
    setRatingActionError(null);
    try {
      await apiFetch(`/api/submissions/ratings/${item.rating._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          score: editRatingScore,
          feedback: editRatingFeedback.trim(),
          tags: editRatingTags,
          reason: editRatingReason.trim(),
        }),
      });
      setShowEditRatingModal(false);
      await fetchItemData();
    } catch (err: any) {
      setRatingActionError(err.message || 'Failed to update rating');
    } finally {
      setIsSubmittingRatingEdit(false);
    }
  };

  const toggleEditRatingTag = (tag: string) => {
    setEditRatingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleApproveTag = (tag: string) => {
    setApproveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const fetchItemData = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: WorkItemDetail }>(`/api/work/${id}`);
      setItem(res.data);

      setEditTitle(res.data.title);
      setEditWorkType(res.data.workType);
      setEditPriority(res.data.priority);
      setEditEffort(res.data.estimatedEffortHrs || 4);
      setEditDeadline(res.data.deadline ? res.data.deadline.slice(0, 10) : '');
      setEditDescription(res.data.description || res.data.brief?.description || '');
      setEditDeliverableUrl(res.data.deliverableUrl || '');
      setEditPublishedUrl(res.data.publishedUrl || '');
      setEditContentLink(res.data.contentLink || res.data.brief?.contentLink || '');
      setEditAssetsLink(res.data.assetsLink || res.data.brief?.assetsLink || '');

      try {
        const actRes = await apiFetch<{ data: ActivityEventItem[] }>(`/api/work/${id}/activity`);
        setActivities(actRes.data || []);
      } catch (actErr) {
        console.warn('Could not load activity events:', actErr);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load work item');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItemData();
  }, [id]);

  const handleTransition = async (toStatus: WorkItemStatus, extraPayload: Record<string, any> = {}) => {
    if (!item) return;
    try {
      await apiFetch(`/api/work/${item._id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, ...extraPayload }),
      });
      await fetchItemData();
    } catch (err: any) {
      alert(err.message || 'Transition failed');
    }
  };

  const submitBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setIsBlocking(true);
    try {
      await apiFetch(`/api/work/${item._id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus: 'Blocked',
          blockerReason,
          blockerNote,
          dependencyOwnerId: dependencyOwnerId || undefined,
        }),
      });
      setShowBlockerModal(false);
      setBlockerNote('');
      await fetchItemData();
    } catch (err: any) {
      alert(err.message || 'Failed to mark blocked');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleOutputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setIsSubmitting(true);
    try {
      let toStatus: WorkItemStatus = 'Pending';
      let deliverableUrl: string | undefined = submitUrl.trim();
      let publishedUrl: string | undefined;

      if (submitAction === 'mark_as_posted') {
        toStatus = 'Published';
        publishedUrl = submitUrl.trim();
        deliverableUrl = undefined;
      }

      await apiFetch(`/api/work/${item._id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus,
          deliverableUrl,
          publishedUrl,
          comment: submitComment.trim() || undefined,
        }),
      });
      setShowSubmitModal(false);
      setSubmitUrl('');
      setSubmitComment('');
      await fetchItemData();
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setIsApproving(true);
    try {
      const subId = item.latestSubmission?._id || item.latestSubmission?.id;
      if (subId) {
        await apiFetch(`/api/submissions/${subId}/approve`, {
          method: 'POST',
          body: JSON.stringify({
            score: approveRatingScore,
            feedback: approveFeedback.trim(),
            tags: approveTags,
          }),
        });
      } else if (item.reviewRequired) {
        // A review step can only be approved on a submission, with a rating.
        setShowApproveModal(false);
        alert(NO_SUBMISSION_TO_REVIEW);
        return;
      } else {
        await apiFetch(`/api/work/${item._id}/transition`, {
          method: 'POST',
          body: JSON.stringify({ toStatus: 'Approved' }),
        });
      }
      setShowApproveModal(false);
      setApproveFeedback('');
      setApproveTags([]);
      await fetchItemData();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
      if (err?.statusCode === 409) {
        setShowApproveModal(false);
        await fetchItemData();
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setIsSubmitting(true);
    try {
      const subId = item.latestSubmission?._id || item.latestSubmission?.id;
      if (subId) {
        await apiFetch(`/api/submissions/${subId}/request-revision`, {
          method: 'POST',
          body: JSON.stringify({
            comment: revisionNotes.trim(),
            feedback: revisionNotes.trim(),
            rootCause: revisionRootCause,
          }),
        });
      } else if (item.reviewRequired) {
        setShowRevisionModal(false);
        alert(NO_SUBMISSION_TO_REVIEW);
        return;
      } else {
        await apiFetch(`/api/work/${item._id}/transition`, {
          method: 'POST',
          body: JSON.stringify({
            toStatus: 'Feedback',
            comment: revisionNotes.trim(),
          }),
        });
      }
      setShowRevisionModal(false);
      setRevisionNotes('');
      await fetchItemData();
    } catch (err: any) {
      alert(err.message || 'Revision request failed');
      if (err?.statusCode === 409) {
        setShowRevisionModal(false);
        await fetchItemData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipStep = async () => {
    if (!item || !window.confirm(`Skip step "${item.stageKey || item.title}"?`)) return;
    try {
      await apiFetch(`/api/content-pieces/${item.contentPieceId}/stages/${item._id}/skip`, {
        method: 'PATCH',
        body: JSON.stringify({ isSkipped: true }),
      });
      await fetchItemData();
    } catch {
      await apiFetch(`/api/work/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isSkipped: true }),
      });
      await fetchItemData();
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setIsUpdating(true);
    try {
      await apiFetch(`/api/work/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle,
          workType: editWorkType,
          priority: editPriority,
          estimatedEffortHrs: Number(editEffort),
          deadline: editDeadline,
          description: editDescription,
          deliverableUrl: editDeliverableUrl,
          publishedUrl: editPublishedUrl,
          contentLink: editContentLink,
          assetsLink: editAssetsLink,
          brief: {
            description: editDescription,
            contentLink: editContentLink,
            assetsLink: editAssetsLink,
          },
        }),
      });
      setShowEditModal(false);
      await fetchItemData();
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDelete = async () => {
    if (!item) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/work/${item._id}`, { method: 'DELETE' });
      navigate('/my-work');
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-ui-ink border-t-transparent rounded-full motion-safe:animate-spin mb-4" />
        <p className="text-sm font-semibold text-ui-muted">Loading work item details...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="glass-card p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-ui-coral mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-bold text-ui-ink">Work Item Not Found</h2>
          <p className="text-xs text-ui-muted mt-1">{error || 'Unable to display item.'}</p>
          <button
            type="button"
            onClick={() => navigate('/my-work')}
            className="ui-btn ui-btn-primary h-11 mt-6 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Work
          </button>
        </div>
      </div>
    );
  }

  const isPastDeadline = new Date(item.deadline) < new Date();
  const isTerminal = item.status === 'Approved' || item.status === 'Published';
  const isOverdue = isPastDeadline && !isTerminal;
  const measures = calculateIndividualWorkMeasures(item);

  // Central Role & Action Computation via shared getAvailableActions
  const { actions, reason } = getAvailableActions(user, item);

  // Compute stages for PipelineStepper
  const stepperStages: PipelineStageItem[] =
    item.pieceStages && item.pieceStages.length > 0
      ? item.pieceStages
      : [
          {
            _id: item._id,
            stageKey: item.stageKey || 'Content',
            stageOrder: item.stageOrder || 1,
            status: item.status,
            isLocked: item.isLocked,
            isSkipped: item.isSkipped,
            ownerId: item.ownerId,
            title: item.title,
            deadline: item.deadline,
            revisions: item.revisions,
            startedAt: item.startedAt,
            submittedAt: item.submittedAt,
            resubmittedAt: item.resubmittedAt,
            approvedAt: item.approvedAt,
            postedAt: item.postedAt,
          },
        ];

  const isOwner = Boolean(
    user && (user.userId || user.id || user._id) === (item.ownerId?._id || item.ownerId?.id || item.ownerId)
  );
  const isReviewer = user?.role === 'creative_head' || user?.role === 'admin';
  const hasOutput = Boolean(
    item.deliverableUrl ||
    item.latestSubmission?.fileUrl ||
    item.latestSubmission?.linkUrl ||
    item.draftSubmission?.files?.length ||
    item.draftSubmission?.linkUrl ||
    item.draftSubmission?.document?.plainText ||
    item.scriptContent ||
    item.approvedClips?.length
  );
  const isUnderReview =
    item.status === 'Pending' ||
    (item.status === 'Feedback' && item.latestSubmission?.status === 'submitted');
  const isReworkRequested =
    (item.status === 'Feedback' && item.latestSubmission?.status === 'changes_requested') ||
    (item.status === 'In Progress' && (item.revisions || 0) > 0 && item.latestSubmission?.status === 'changes_requested') ||
    (item.status === 'Feedback' && !item.latestSubmission && (item.revisions || 0) > 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 min-h-[44px] -mt-2 text-[13px] font-semibold text-ui-muted hover:text-ui-ink transition-colors rounded-full"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/70 text-ui-text">
              {item.workType}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                item.priority === 'Urgent'
                  ? 'status-chip status-changes'
                  : 'bg-white/70 text-ui-text'
              }`}
            >
              {item.priority} Priority
            </span>

            <span
              className={`status-chip ${statusClass(
                isUnderReview ? 'waiting' : isReworkRequested ? 'changes' : statusTone(item.status)
              )} text-xs font-bold px-3 py-1`}
            >
              {isUnderReview && <span className="w-2 h-2 rounded-full status-dot motion-safe:animate-pulse" />}
              {isReworkRequested && <RotateCcw className="w-3.5 h-3.5" />}
              {!isUnderReview && !isReworkRequested && item.status === 'In Progress' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {!isUnderReview && !isReworkRequested && item.status === 'Blocked' && <AlertTriangle className="w-3.5 h-3.5" />}
              {isUnderReview ? 'Waiting for approval' : isReworkRequested ? 'Changes requested' : getStepStatusLabel(item.status)}
            </span>

            {isOverdue && (
              <OverdueChip deadline={item.deadline} className="px-2.5 py-0.5" />
            )}
          </div>

          <h1 className="text-[26px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink mt-2 break-words">
            {item.title}
          </h1>
        </div>

        {/* Action Buttons in Header (Only Edit details and Delete for sm_manager and admin) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {actions.includes('edit_details') && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit details
            </button>
          )}

          {actions.includes('delete') && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirmModal(true)}
              className="ui-icon-btn"
              title="Delete step"
              aria-label="Delete step"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Steps PipelineStepper & Action Triggers */}
      <div className="glass-card p-5 sm:p-6 space-y-4">
        <PipelineStepper
          stages={stepperStages}
          currentStageId={item._id}
          currentStageKey={item.stageKey}
          status={item.status}
          blockerReason={item.blockerReason}
        />

        {/* Action Triggers Bar (Driven strictly by getAvailableActions) */}
        <div className="pt-3 border-t border-ui-line flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(item.stageKey === 'Content' || item.stageKey === 'Script') && (
              <button
                onClick={() => navigate(`/work/${item._id}/writing-studio`)}
                className="ui-btn ui-btn-secondary h-11 gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Open Writing Studio
              </button>
            )}

            {item.stageKey === 'Shoot' && (
              <button
                onClick={() => navigate(`/work/${item._id}/workspace`)}
                className="ui-btn ui-btn-secondary h-11 gap-1.5"
              >
                <Video className="w-3.5 h-3.5" />
                Open Shoot Workspace
              </button>
            )}

            {item.stageKey === 'Edit' && (
              <button
                onClick={() => navigate(`/work/${item._id}/workspace`)}
                className="ui-btn ui-btn-secondary h-11 gap-1.5"
              >
                <Film className="w-3.5 h-3.5" />
                Open Edit Workspace
              </button>
            )}

            {item.stageKey === 'Design' && (
              <button
                onClick={() => navigate(`/work/${item._id}/workspace`)}
                className="ui-btn ui-btn-secondary h-11 gap-1.5"
              >
                <Palette className="w-3.5 h-3.5" />
                Open Design Workspace
              </button>
            )}

            {item.stageKey === 'Post' && (
              <button
                onClick={() => navigate(`/work/${item._id}/workspace`)}
                className="ui-btn ui-btn-secondary h-11 gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                Open Posting Workspace
              </button>
            )}

            {/* Reviewer Actions: Creative Head & Admin direct approval cockpit */}
            {isReviewer && !isOwner && (isUnderReview || item.status === 'Pending' || (item.status === 'Feedback' && item.latestSubmission?.status === 'submitted')) && (
              <>
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="ui-btn ui-btn-primary h-11 gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Deliverable
                </button>
                <button
                  onClick={() => setShowRevisionModal(true)}
                  className="ui-btn ui-btn-secondary h-11 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Request Rework
                </button>
                <button
                  onClick={() => navigate(`/work/${item._id}/review`)}
                  className="ui-btn ui-btn-secondary h-11 gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Review Studio
                </button>
              </>
            )}

            {/* Worker Start Action */}
            {actions.includes('start') && (
              <button
                onClick={() => handleTransition('In Progress')}
                className="ui-btn ui-btn-primary h-11 gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start
              </button>
            )}

            {/* Worker Submission Flow */}
            {isOwner && (
              <>
                {isUnderReview ? (
                  <div className="status-chip status-waiting min-h-[44px] px-3.5 gap-2 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full status-dot motion-safe:animate-pulse" aria-hidden="true" />
                    <span>
                      Under Review by Creative Head {item.latestSubmission?.version ? `(v${item.latestSubmission.version})` : ''}
                    </span>
                  </div>
                ) : isReworkRequested ? (
                  <button
                    onClick={() => {
                      if (item.stageKey === 'Shoot') {
                        navigate(`/work/${item._id}/shoot`);
                        return;
                      }
                      setSubmitAction('submit_for_approval');
                      setSubmitUrl(item.deliverableUrl || item.latestSubmission?.fileUrl || item.latestSubmission?.linkUrl || '');
                      setShowSubmitModal(true);
                    }}
                    className="ui-btn ui-btn-primary h-11 gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Resubmit for approval {item.latestSubmission?.version ? `(v${item.latestSubmission.version + 1})` : ''}
                  </button>
                ) : (
                  actions.includes('submit_for_approval') && (
                    <button
                      onClick={() => {
                        // Shoot is submitted as clips, from its workspace, so it can go through clip review.
                        if (item.stageKey === 'Shoot') {
                          navigate(`/work/${item._id}/shoot`);
                          return;
                        }
                        setSubmitAction('submit_for_approval');
                        setSubmitUrl(item.deliverableUrl || '');
                        setShowSubmitModal(true);
                      }}
                      className="ui-btn ui-btn-primary h-11 gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit for approval
                    </button>
                  )
                )}
              </>
            )}

            {actions.includes('mark_as_posted') && (
              <button
                onClick={() => {
                  setSubmitAction('mark_as_posted');
                  setSubmitUrl(item.publishedUrl || item.deliverableUrl || '');
                  setShowSubmitModal(true);
                }}
                className="ui-btn ui-btn-primary h-11 gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                Mark as posted
              </button>
            )}

            {!isUnderReview && actions.includes('mark_blocked') && (
              <button
                onClick={() => {
                  const prevOwner = item.suggestedDependencyOwner || item.previousStage?.owner;
                  setDependencyOwnerId(prevOwner?._id || '');
                  setShowBlockerModal(true);
                }}
                className="ui-btn ui-btn-secondary h-11 gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                Mark blocked
              </button>
            )}

            {!isUnderReview && actions.includes('request_help') && (
              <button
                onClick={() => {
                  const msg = prompt('Enter your question or help request for the team:');
                  if (msg) alert('Help request broadcast to team: ' + msg);
                }}
                className="ui-btn ui-btn-secondary h-11 gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Request help
              </button>
            )}

            {actions.includes('resolve_blocker') && (
              <button
                onClick={() => handleTransition('In Progress')}
                className="ui-btn ui-btn-primary h-11 gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Resolve blocker
              </button>
            )}

            {actions.includes('skip_step') && (
              <button
                onClick={handleSkipStep}
                className="ui-btn ui-btn-secondary h-11 gap-1.5"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip step
              </button>
            )}

            {/* One-line reason shown when viewer has no action on this step */}
            {reason && !isUnderReview && (
              <div className="text-xs font-medium text-ui-muted bg-white/60 px-3.5 min-h-[44px] rounded-ui-control flex items-center gap-2">
                <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{reason}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2a. Submitted Deliverable & Review Cockpit Card */}
      {(item.latestSubmission || hasOutput || isReworkRequested || (item.revisions || 0) > 0 || isUnderReview) && (
        <div className="glass-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-line pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/70 text-ui-ink flex items-center justify-center" aria-hidden="true">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ui-ink tracking-tight">
                    Deliverable & Review Studio
                  </h3>
                  {item.latestSubmission?.version && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/70 text-ui-text">
                      v{item.latestSubmission.version}
                    </span>
                  )}
                  {(item.revisions || 0) > 0 && (
                    <span className="status-chip status-changes px-2 py-0.5 text-[11px] font-semibold gap-1">
                      <RotateCcw className="w-2.5 h-2.5" />
                      {item.revisions} stage rework{(item.revisions || 0) === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-ui-muted">
                  {item.latestSubmission?.submittedAt
                    ? `Submitted on ${new Date(item.latestSubmission.submittedAt).toLocaleDateString()} at ${new Date(item.latestSubmission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Current deliverable for this stage'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isUnderReview && (
                <span className="status-chip status-waiting px-2.5 py-1 text-xs font-semibold gap-1.5">
                  <span className="w-2 h-2 rounded-full status-dot motion-safe:animate-pulse" aria-hidden="true" />
                  Awaiting Review
                </span>
              )}
              {isReworkRequested && (
                <span className="status-chip status-changes px-2.5 py-1 text-xs font-semibold gap-1.5">
                  <RotateCcw className="w-3 h-3" />
                  Rework Requested
                </span>
              )}
              {item.status === 'Approved' && (
                <span className="status-chip status-approved px-2.5 py-1 text-xs font-semibold gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Approved
                </span>
              )}
            </div>
          </div>

          {/* Rework Feedback Alert Banner if changes requested */}
          {isReworkRequested && (item.latestSubmission?.feedback || item.blockerReason) && (
            <div className="p-4 rounded-ui-card status-tint status-changes space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  <span className="text-[13px] font-semibold">
                    Rework Feedback
                  </span>
                  {item.latestSubmission?.rootCause && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-ui-ink">
                      Cause: {item.latestSubmission.rootCause}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold">
                  Revision #{item.revisions || 1}
                </span>
              </div>
              <p className="text-xs text-ui-text leading-relaxed font-medium bg-white/70 p-3 rounded-xl">
                {item.latestSubmission?.feedback || 'Please review the requested changes and resubmit.'}
              </p>
            </div>
          )}

          {/* Deliverable Content & Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Output link or file */}
            <div className="p-4 rounded-ui-card bg-white/60 space-y-2 min-w-0">
              <span className="text-[13px] font-medium text-ui-muted">
                Deliverable Link / Asset
              </span>
              {item.deliverableUrl || item.latestSubmission?.fileUrl || item.latestSubmission?.linkUrl ? (
                <div className="flex items-center justify-between gap-2 bg-white pl-3 pr-1 py-1 rounded-xl min-w-0">
                  <a
                    href={item.deliverableUrl || item.latestSubmission?.fileUrl || item.latestSubmission?.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-ui-ink hover:underline underline-offset-4 truncate flex items-center gap-1.5 min-h-[44px] min-w-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {item.latestSubmission?.fileName ||
                        item.deliverableUrl ||
                        item.latestSubmission?.fileUrl ||
                        item.latestSubmission?.linkUrl}
                    </span>
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        item.deliverableUrl || item.latestSubmission?.fileUrl || item.latestSubmission?.linkUrl || ''
                      );
                      setCopiedDeliverableLink(true);
                      setTimeout(() => setCopiedDeliverableLink(false), 2000);
                    }}
                    type="button"
                    className="ui-icon-btn shrink-0 border-transparent"
                    title="Copy link"
                    aria-label={copiedDeliverableLink ? 'Link copied' : 'Copy link'}
                  >
                    {copiedDeliverableLink ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-ui-muted italic">No deliverable link uploaded yet.</p>
              )}
            </div>

            {/* Stage-specific Summary or Script snippet */}
            <div className="p-4 rounded-ui-card bg-white/60 space-y-2 min-w-0">
              <span className="text-[13px] font-medium text-ui-muted">
                Stage Details & Artifacts
              </span>
              <div className="text-xs text-ui-text bg-white pl-3 pr-1 py-1 rounded-xl min-h-[44px] flex items-center justify-between gap-2 min-w-0">
                <span className="min-w-0 break-words">
                  {item.stageKey === 'Shoot'
                    ? `${item.approvedClips?.length || 0} clips recorded / uploaded`
                    : item.stageKey === 'Content' || item.stageKey === 'Script'
                    ? item.scriptContent
                      ? `${item.scriptContent.slice(0, 80)}...`
                      : 'Script in writing studio'
                    : item.publishedUrl
                    ? `Live URL: ${item.publishedUrl}`
                    : `Stage: ${item.stageKey || 'Production'}`}
                </span>
                {(item.stageKey === 'Content' || item.stageKey === 'Script') && (
                  <button
                    onClick={() => navigate(`/work/${item._id}/writing-studio`)}
                    type="button"
                    className="shrink-0 min-h-[44px] px-2 text-[13px] font-semibold text-ui-ink hover:underline underline-offset-4 rounded-full"
                  >
                    View Studio →
                  </button>
                )}
                {item.stageKey === 'Shoot' && (
                  <button
                    onClick={() => navigate(`/work/${item._id}/workspace`)}
                    type="button"
                    className="shrink-0 min-h-[44px] px-2 text-[13px] font-semibold text-ui-ink hover:underline underline-offset-4 rounded-full"
                  >
                    View Clips →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reviewer Action Bar inside Cockpit */}
          {isReviewer && !isOwner && (isUnderReview || item.status === 'Pending' || (item.status === 'Feedback' && item.latestSubmission?.status === 'submitted')) && (
            <div className="p-3 bg-white/60 rounded-ui-card flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ui-ink">Reviewer Decision:</span>
                <span className="text-xs text-ui-muted">Evaluate deliverable against brief</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowRevisionModal(true)}
                  className="ui-btn ui-btn-secondary h-11 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Request Rework
                </button>
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="ui-btn ui-btn-primary h-11 gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Deliverable
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2b. Quality Rating & Creative Feedback Section (WS4) */}
      {item.rating && (
        <div className="glass-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-line pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/70 text-amber-500 flex items-center justify-center" aria-hidden="true">
                <Star className="w-4 h-4 fill-current" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-ui-ink tracking-tight">
                    Step Quality Rating & Feedback
                  </h3>
                  <span className="status-chip status-waiting px-2 py-0.5 text-[11px] font-semibold">
                    {item.rating.score} ★ &bull; {item.rating.score === 5 ? 'Excellent' : item.rating.score === 4 ? 'Very Good' : item.rating.score === 3 ? 'Good' : item.rating.score === 2 ? 'Below Standard' : 'Needs Work'}
                  </span>
                </div>
                <p className="text-[11px] text-ui-muted">
                  Reviewed by {item.rating.raterId?.name || 'Creative Head'} on {new Date(item.rating.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Worker Mark as Seen */}
              {(item.ownerId?._id === (user?._id || user?.id || user?.userId)) && !item.rating.seenAt && (
                <button
                  onClick={handleMarkRatingSeen}
                  type="button"
                  className="ui-btn ui-btn-primary h-11 gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark as seen
                </button>
              )}

              {item.rating.seenAt && (
                <span className="status-chip status-approved px-2.5 py-1 text-[11px] font-semibold gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Acknowledged
                </span>
              )}

              {/* Creative Head / Admin Edit Button */}
              {(user?.role === 'creative_head' || user?.role === 'admin') && (
                <button
                  onClick={openEditRatingModal}
                  type="button"
                  className="ui-btn ui-btn-secondary h-11 gap-1.5"
                  title="Edit rating score and feedback (Audit log will be preserved)"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Rating
                </button>
              )}
            </div>
          </div>

          {/* Stars visual display */}
          <div className="flex items-center gap-1" role="img" aria-label={`${item.rating.score} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                aria-hidden="true"
                className={`w-5 h-5 ${
                  (item.rating?.score || 0) >= star
                    ? 'text-amber-500 fill-current'
                    : 'text-ui-muted/40'
                }`}
              />
            ))}
          </div>

          {/* Qualitative Feedback Text */}
          {item.rating.feedback && (
            <div className="p-3.5 rounded-ui-card bg-white/60 text-xs text-ui-text leading-relaxed">
              "{item.rating.feedback}"
            </div>
          )}

          {/* Quality Tags */}
          {item.rating.tags && item.rating.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.rating.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/70 text-ui-text"
                >
                  +{tag}
                </span>
              ))}
            </div>
          )}

          {/* Audit History Log */}
          {item.rating.editedLog && item.rating.editedLog.length > 0 && (
            <div className="mt-3 pt-3 border-t border-ui-line text-xs text-ui-muted space-y-1.5">
              <span className="text-[13px] font-medium text-ui-muted block">
                Rating Edit History ({item.rating.editedLog.length})
              </span>
              {item.rating.editedLog.map((log, idx) => {
                const editorName =
                  typeof log.editedBy === 'object' && log.editedBy?.name
                    ? log.editedBy.name
                    : 'Reviewer';
                return (
                  <div key={idx} className="p-2.5 rounded-xl bg-white/60 text-[11px] flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-ui-ink font-semibold">{editorName}</span>
                      <span className="text-ui-muted"> adjusted score to {log.newScore}★: </span>
                      <span className="text-ui-text italic">"{log.reason}"</span>
                    </div>
                    <span className="text-ui-muted font-mono text-[11px]">
                      {new Date(log.editedAt).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Main Body: Workplace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Cols: Tabs & Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="ui-tabs max-w-full overflow-x-auto">
            <button
              type="button"
              aria-pressed={activeTab === 'brief'}
              onClick={() => setActiveTab('brief')}
              className={`ui-tab gap-1.5 shrink-0 ${activeTab === 'brief' ? 'is-active' : ''}`}
            >
              <FileText className="w-3.5 h-3.5" />
              Details
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'deliverable'}
              onClick={() => setActiveTab('deliverable')}
              className={`ui-tab gap-1.5 shrink-0 ${activeTab === 'deliverable' ? 'is-active' : ''}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Links and files
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'activity'}
              onClick={() => setActiveTab('activity')}
              className={`ui-tab gap-1.5 shrink-0 ${activeTab === 'activity' ? 'is-active' : ''}`}
            >
              <Activity className="w-3.5 h-3.5" />
              History
            </button>
          </div>

          {/* Tab 1: Details */}
          {activeTab === 'brief' && (
            <div className="glass-card p-5 sm:p-6 space-y-6">
              {item.stageKey && (
                <div className="p-4 rounded-ui-card bg-white/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                    <span className="text-xs font-semibold text-ui-ink">
                      Stage {item.stageOrder}: {item.stageKey}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-ui-text bg-white px-2.5 py-1 rounded-full">
                    {item.reviewRequired ? 'Approval Required' : 'Auto-Advances'}
                  </span>
                </div>
              )}

              {/* Writing Studio Launch Card for Content and Script stages */}
              {(item.stageKey === 'Content' || item.stageKey === 'Script') && (
                <div className="p-5 rounded-ui-card bg-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-ui-muted">
                        Writing Studio
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-ui-ink">
                      Draft your {item.stageKey} document in the studio
                    </h3>
                    <p className="text-xs text-ui-muted max-w-md">
                      Word-style rich text canvas with duration estimation, hook check, scene tables, Malayalam font, and docked brief.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/writing-studio`)}
                      type="button"
                      className="ui-btn ui-btn-primary h-11 gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Open Writing Studio
                    </button>
                  </div>
                </div>
              )}

              {/* Shoot Workspace Launch Card */}
              {item.stageKey === 'Shoot' && (
                <div className="p-5 rounded-ui-card bg-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-ui-muted">
                        Shoot Workspace
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-ui-ink">
                      Capture & Upload Raw Footage
                    </h3>
                    <p className="text-xs text-ui-muted max-w-md">
                      Read-only script & shot list, upload 1–10 clips up to 500 MB with pause/resume and phone support, shoot notes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      type="button"
                      className="ui-btn ui-btn-primary h-11 gap-2"
                    >
                      <Video className="w-4 h-4" />
                      Open Shoot Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Workspace Launch Card */}
              {item.stageKey === 'Edit' && (
                <div className="p-5 rounded-ui-card bg-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-ui-muted">
                        Edit Workspace
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-ui-ink">
                      Assemble Master Cut & Verify Pacing
                    </h3>
                    <p className="text-xs text-ui-muted max-w-md">
                      Read-only footage clips & script, 9:16 aspect ratio & &le;90s duration pre-flight checks, revision checklist.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      type="button"
                      className="ui-btn ui-btn-primary h-11 gap-2"
                    >
                      <Film className="w-4 h-4" />
                      Open Edit Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Design Workspace Launch Card */}
              {item.stageKey === 'Design' && (
                <div className="p-5 rounded-ui-card bg-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-ui-muted">
                        Design Workspace
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-ui-ink">
                      Create Visuals Beside Approved Copy
                    </h3>
                    <p className="text-xs text-ui-muted max-w-md">
                      Approved copy with 1-click copy buttons, image/PDF upload with size guides, zoom preview, carousel ordering.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      type="button"
                      className="ui-btn ui-btn-primary h-11 gap-2"
                    >
                      <Palette className="w-4 h-4" />
                      Open Design Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Post Workspace Launch Card */}
              {item.stageKey === 'Post' && (
                <div className="p-5 rounded-ui-card bg-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-ui-muted">
                        Posting Workspace
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-ui-ink">
                      Publish to Live Social Channels
                    </h3>
                    <p className="text-xs text-ui-muted max-w-md">
                      Download approved master, copy caption & hashtags, platform pre-publish checklist, mark as posted.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      type="button"
                      className="ui-btn ui-btn-primary h-11 gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      Open Posting Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Shot List for Videographer & Shooter (WS2 Acceptance Criteria) */}
              {(item.stageKey === 'Shoot' || item.stageKey === 'Edit') && item.scriptShotList && item.scriptShotList.length > 0 && (
                <div className="p-5 rounded-ui-card bg-white/60 space-y-3">
                  <div className="flex items-center justify-between border-b border-ui-line pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-ui-ink">
                        Extracted Shot List (from Approved Script)
                      </span>
                    </div>
                    <span className="text-xs font-bold text-ui-muted">
                      {item.scriptShotList.length} shots to capture
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {item.scriptShotList.map((shot: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-white/60 border border-ui-line rounded-xl text-xs flex items-start gap-2.5"
                      >
                        <span className="min-w-6 h-6 px-1 rounded-lg bg-white text-ui-ink flex items-center justify-center font-semibold shrink-0 text-[11px]">
                          #{shot.sceneNumber}
                        </span>
                        <div className="flex-1">
                          <p className="font-bold text-ui-text">{shot.visual}</p>
                          {shot.audio && (
                            <p className="text-[11px] text-ui-muted italic mt-0.5">Audio: "{shot.audio}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Stage Context Banner */}
              {item.previousStage && (
                <div className="p-4 rounded-ui-card bg-white/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-ui-muted">
                      Previous Dependency &bull; {item.previousStage.stageKey} Stage
                    </span>
                    <span className={`status-chip ${statusClass(statusTone(item.previousStage.status))} text-[11px] font-semibold px-2 py-0.5`}>
                      {item.previousStage.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ui-text font-semibold">
                      Owner: {item.previousStage.owner?.name || 'Unassigned'}
                    </span>
                    {item.previousStage.deliverableUrl && (
                      <a
                        href={item.previousStage.deliverableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ui-ink hover:underline underline-offset-4 flex items-center gap-1 font-semibold text-xs min-h-[44px]"
                      >
                        <span>View Completed Output</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[13px] font-medium text-ui-muted block mb-2">
                  Description
                </span>
                <div className="p-4 rounded-ui-card bg-white/60 text-xs text-ui-text leading-relaxed whitespace-pre-wrap">
                  {item.description || item.brief?.description || 'No specific description provided.'}
                </div>
              </div>

              {/* Zoho / Google Content Link */}
              <div className="space-y-1.5">
                <span className="text-[13px] font-medium text-ui-muted block">
                  Reference & Brief Content Link
                </span>
                {item.contentLink || item.brief?.contentLink ? (
                  <div className="flex items-center justify-between gap-2 pl-3 pr-1 py-1 rounded-ui-card bg-white/60 min-w-0">
                    <a
                      href={item.contentLink || item.brief?.contentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-ui-ink hover:underline underline-offset-4 truncate max-w-sm flex items-center gap-1.5 min-h-[44px] min-w-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.contentLink || item.brief?.contentLink}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.contentLink || item.brief?.contentLink || '');
                        setCopiedContentLink(true);
                        setTimeout(() => setCopiedContentLink(false), 2000);
                      }}
                      className="ui-icon-btn shrink-0 border-transparent"
                      title="Copy link"
                      aria-label={copiedContentLink ? 'Link copied' : 'Copy link'}
                    >
                      {copiedContentLink ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-ui-muted italic p-3 rounded-ui-card bg-white/60">
                    No reference link provided.
                  </div>
                )}
              </div>

              {/* Drive Assets Link */}
              <div className="space-y-1.5">
                <span className="text-[13px] font-medium text-ui-muted block">
                  Production Assets Drive Link
                </span>
                {item.assetsLink || item.brief?.assetsLink ? (
                  <div className="flex items-center justify-between gap-2 pl-3 pr-1 py-1 rounded-ui-card bg-white/60 min-w-0">
                    <a
                      href={item.assetsLink || item.brief?.assetsLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-ui-ink hover:underline underline-offset-4 truncate max-w-sm flex items-center gap-1.5 min-h-[44px] min-w-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.assetsLink || item.brief?.assetsLink}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.assetsLink || item.brief?.assetsLink || '');
                        setCopiedAssetsLink(true);
                        setTimeout(() => setCopiedAssetsLink(false), 2000);
                      }}
                      className="ui-icon-btn shrink-0 border-transparent"
                      title="Copy link"
                      aria-label={copiedAssetsLink ? 'Link copied' : 'Copy link'}
                    >
                      {copiedAssetsLink ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-ui-muted italic p-3 rounded-ui-card bg-white/60">
                    No assets link provided.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Links and files */}
          {activeTab === 'deliverable' && (
            <div className="glass-card p-5 sm:p-6 space-y-6">
              {item.handover && (
                <div data-testid="handover-panel">
                  <span className="text-[13px] font-medium text-ui-muted block mb-1">
                    Approved files for handover
                  </span>
                  <p className="text-xs text-ui-text mb-2">
                    This design is approved and ready to hand over{item.handover.version ? ` (version ${item.handover.version})` : ''}.
                  </p>
                  <AssetLinks items={item.handover.items || []} emptyText="No approved files found." testId="handover-files" />
                </div>
              )}

              <div>
                <span className="text-[13px] font-medium text-ui-muted block mb-1">
                  Worker Output Link
                </span>
                {item.deliverableUrl ? (
                  <a
                    href={item.deliverableUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-ui-card bg-white/60 flex items-center justify-between gap-2 text-xs text-ui-ink font-semibold hover:underline underline-offset-4 min-w-0"
                  >
                    <span className="truncate max-w-md">{item.deliverableUrl}</span>
                    <ExternalLink className="w-4 h-4 shrink-0 text-ui-muted" aria-hidden="true" />
                  </a>
                ) : (
                  <div className="p-4 rounded-ui-card bg-white/60 text-xs text-ui-muted italic">
                    No output link submitted yet.
                  </div>
                )}
              </div>

              <div>
                <span className="text-[13px] font-medium text-ui-muted block mb-1">
                  Published Live URL
                </span>
                {item.publishedUrl ? (
                  <a
                    href={item.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-ui-card status-tint status-approved flex items-center justify-between gap-2 text-xs font-semibold hover:underline underline-offset-4 min-w-0"
                  >
                    <span className="truncate max-w-md">{item.publishedUrl}</span>
                    <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <div className="p-4 rounded-ui-card bg-white/60 text-xs text-ui-muted italic">
                    Not published to live channels yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: History */}
          {activeTab === 'activity' && (
            <div className="glass-card p-5 sm:p-6">
              <span className="text-[13px] font-medium text-ui-muted block mb-4">
                Audit Timeline
              </span>
              {activities.length === 0 ? (
                <p className="text-xs text-ui-muted italic py-4">No logged history yet.</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((act) => (
                    <div key={act._id} className="flex items-start gap-3 border-l-2 border-ui-line pl-4 py-1">
                      <div>
                        <div className="text-xs font-bold text-ui-text">
                          {act.action.replace('work_item.', '').replace('_', ' ')}
                        </div>
                        <div className="text-[11px] text-ui-muted">
                          {act.actorId?.name || 'System'} &bull; {new Date(act.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 1-Col Sidebar: Owner & Schedule */}
        <div className="space-y-6">
          {/* Owner Card */}
          <div className="glass-card p-5 sm:p-6">
            <span className="text-[13px] font-medium text-ui-muted">Assignee</span>
            <h3 className="text-sm font-bold text-ui-ink mb-3">Owner</h3>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-ui-ink text-white flex items-center justify-center font-bold text-base shrink-0" aria-hidden="true">
                {item.ownerId?.name ? item.ownerId.name[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div className="text-sm font-bold text-ui-ink">{item.ownerId?.name || 'Unassigned'}</div>
                <div className="text-xs text-ui-muted break-all">{item.ownerId?.email}</div>
                <div className="text-[11px] font-semibold text-ui-muted mt-0.5">
                  {item.ownerId?.jobRole || item.ownerId?.role || 'Creative Staff'}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule & Timing */}
          <div className="glass-card p-5 sm:p-6 space-y-3">
            <span className="text-[13px] font-medium text-ui-muted">Timetable</span>
            <h3 className="text-sm font-bold text-ui-ink mb-2">Schedule & Cadence</h3>

            <div className="flex justify-between items-center text-xs">
              <span className="text-ui-muted">Target Deadline</span>
              <span className={`font-semibold ${isOverdue ? 'status-chip status-changes px-2 py-0.5' : 'text-ui-ink'}`}>
                {new Date(item.deadline).toLocaleDateString()}
              </span>
            </div>

            {measures.workTimeFormatted !== '—' && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-ui-muted">Work Time</span>
                <span className="font-bold text-ui-ink">
                  {item.status === 'In Progress' ? `Working for ${measures.workTimeFormatted}` : measures.workTimeFormatted}
                </span>
              </div>
            )}

            {measures.approvalWaitFormatted !== '—' && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-ui-muted">Approval Wait</span>
                <span className="font-bold text-ui-ink">{measures.approvalWaitFormatted}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs">
              <span className="text-ui-muted">Estimated Effort</span>
              <span className="font-bold text-ui-ink">{item.estimatedEffortHrs || 4} Hours</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-ui-muted">Revisions</span>
              <span className="font-bold text-ui-ink">{item.revisions || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit / Done / Post Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
          <div
            ref={submitDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wd-submit-title"
            className="glass-modal w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-ui-line pb-3">
              <h3 id="wd-submit-title" className="text-base font-bold text-ui-ink">
                {submitAction === 'submit_for_approval'
                  ? 'Submit for approval'
                  : 'Mark as posted'}
              </h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Workspace recommendation for media stages */}
            {['Shoot', 'Edit', 'Design', 'Post', 'Script', 'Content'].includes(item.stageKey || '') && (
              <div className="p-4 rounded-ui-card bg-white/60 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ui-ink">
                    Recommended: {item.stageKey} Workspace
                  </span>
                  <span className="text-[11px] bg-white text-ui-text px-2 py-0.5 rounded-full font-semibold">
                    Direct Upload & Verification
                  </span>
                </div>
                <p className="text-xs text-ui-muted">
                  Upload raw files, verify checks, and submit directly within your specialized workspace.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmitModal(false);
                    if (item.stageKey === 'Content' || item.stageKey === 'Script') {
                      navigate(`/work/${item._id}/writing-studio`);
                    } else {
                      navigate(`/work/${item._id}/workspace`);
                    }
                  }}
                  className="ui-btn ui-btn-secondary h-11 mt-1 gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Launch {item.stageKey} Workspace
                </button>
              </div>
            )}

            <form onSubmit={handleOutputSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[13px] font-medium text-ui-muted">
                    {submitAction === 'mark_as_posted'
                      ? 'Live Published Post URL *'
                      : 'Output URL (Fallback Cloud Link) *'}
                  </label>
                  {['Shoot', 'Edit', 'Design', 'Post', 'Script', 'Content'].includes(item.stageKey || '') && (
                    <span className="text-[11px] text-ui-muted">Link Fallback</span>
                  )}
                </div>
                <input
                  type="url"
                  required
                  placeholder={
                    submitAction === 'mark_as_posted'
                      ? 'https://instagram.com/reel/...'
                      : 'https://drive.google.com/...'
                  }
                  value={submitUrl}
                  onChange={(e) => setSubmitUrl(e.target.value)}
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label htmlFor="wd-field-1" className="block text-[13px] font-medium text-ui-muted mb-1.5">Notes / Comments</label>
                <textarea
                  id="wd-field-1"
                  rows={2}
                  placeholder="Optional notes..."
                  value={submitComment}
                  onChange={(e) => setSubmitComment(e.target.value)}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revision / Rework Request Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
          <div
            ref={revisionDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wd-revision-title"
            className="glass-modal w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-ui-line pb-3">
              <div className="flex items-center gap-2 text-ui-ink">
                <RotateCcw className="w-5 h-5" aria-hidden="true" />
                <h3 id="wd-revision-title" className="text-base font-bold text-ui-ink">Request Rework</h3>
              </div>
              <button
                onClick={() => setShowRevisionModal(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRevisionSubmit} className="space-y-4">
              <div>
                <label htmlFor="wd-field-2" className="block text-[13px] font-medium text-ui-muted mb-1.5">Root Cause *</label>
                <select
                  id="wd-field-2"
                  value={revisionRootCause}
                  onChange={(e) => setRevisionRootCause(e.target.value as CanonicalRevisionRootCause)}
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
                <label htmlFor="wd-field-3" className="block text-[13px] font-medium text-ui-muted mb-1.5">Feedback & Revisions Needed *</label>
                <textarea
                  id="wd-field-3"
                  rows={4}
                  required
                  placeholder="Detail exactly what must be fixed or re-recorded before resubmission..."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !revisionNotes.trim()}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {isSubmitting ? 'Requesting...' : 'Request Rework'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Deliverable Modal (Creative Head / Admin) */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
          <div
            ref={approveDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wd-approve-title"
            className="glass-modal w-full max-w-md max-h-[92vh] overflow-y-auto p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-ui-line pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                <h3 id="wd-approve-title" className="text-base font-bold text-ui-ink">Approve Deliverable</h3>
              </div>
              <button
                onClick={() => setShowApproveModal(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Quality Rating (1 to 5 Stars) *
                </label>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quality rating, 1 to 5 stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setApproveRatingScore(star)}
                      aria-label={`${star} star${star === 1 ? '' : 's'}`}
                      aria-pressed={approveRatingScore === star}
                      className={`min-h-[44px] min-w-[44px] px-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1 transition-colors ${
                        approveRatingScore >= star
                          ? 'bg-amber-50 border-amber-400 text-amber-900'
                          : 'bg-white/70 border-ui-line text-ui-muted hover:text-ui-ink'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" aria-hidden="true" />
                      <span aria-hidden="true">{star}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Creative Feedback (Optional)
                </label>
                <textarea
                  value={approveFeedback}
                  onChange={(e) => setApproveFeedback(e.target.value)}
                  placeholder="Notes on execution, tone, visual polish..."
                  rows={2}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Quality Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_TAGS.map((tag) => {
                    const isSelected = approveTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleApproveTag(tag)}
                        aria-pressed={isSelected}
                        className={`min-h-[44px] px-3 rounded-full border text-[13px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-ui-ink text-white border-transparent'
                            : 'bg-white/70 text-ui-text border-ui-line hover:bg-white'
                        }`}
                      >
                        +{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApproving}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {isApproving ? 'Approving...' : 'Approve & Advance Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blocker Modal */}
      {showBlockerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
          <div
            ref={blockerDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wd-blocker-title"
            className="glass-modal w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-ui-line pb-3">
              <div className="flex items-center gap-2 text-ui-ink">
                <Ban className="w-5 h-5" aria-hidden="true" />
                <h3 id="wd-blocker-title" className="text-base font-bold text-ui-ink">Mark blocked</h3>
              </div>
              <button
                onClick={() => setShowBlockerModal(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitBlocker} className="space-y-4">
              <div>
                <label htmlFor="wd-field-4" className="block text-[13px] font-medium text-ui-muted mb-1.5">Reason for Blocker *</label>
                <select
                  id="wd-field-4"
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
                <label htmlFor="wd-field-5" className="block text-[13px] font-medium text-ui-muted mb-1.5">Details / Blocker Note</label>
                <textarea
                  id="wd-field-5"
                  rows={3}
                  value={blockerNote}
                  onChange={(e) => setBlockerNote(e.target.value)}
                  placeholder="Explain what is blocking progress..."
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockerModal(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBlocking}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {isBlocking ? 'Updating...' : 'Mark blocked'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Step Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wd-delete-title"
            className="glass-modal w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-ui-ink">
              <AlertTriangle className="w-6 h-6 shrink-0 text-ui-coral" aria-hidden="true" />
              <h3 id="wd-delete-title" className="text-base font-bold text-ui-ink">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-ui-text leading-relaxed">
              Are you sure you want to delete step <strong>&quot;{item.title}&quot;</strong>? This task has not started and will be permanently removed. This action is logged.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="ui-btn ui-btn-secondary h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="ui-btn ui-btn-primary h-11"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
          <div
            ref={editDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wd-edit-title"
            className="glass-modal w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-ui-line pb-3">
              <h3 id="wd-edit-title" className="text-base font-bold text-ui-ink">Edit details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label htmlFor="wd-field-6" className="block text-[13px] font-medium text-ui-muted mb-1.5">Title *</label>
                <input
                  id="wd-field-6"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="ui-input w-full"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wd-field-7" className="block text-[13px] font-medium text-ui-muted mb-1.5">Work Type</label>
                  <select
                    id="wd-field-7"
                    value={editWorkType}
                    onChange={(e) => setEditWorkType(e.target.value as WorkType)}
                    className="ui-select w-full"
                  >
                    {WORK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="wd-field-8" className="block text-[13px] font-medium text-ui-muted mb-1.5">Priority</label>
                  <select
                    id="wd-field-8"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as Priority)}
                    className="ui-select w-full"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wd-field-9" className="block text-[13px] font-medium text-ui-muted mb-1.5">Deadline *</label>
                  <input
                    id="wd-field-9"
                    type="date"
                    required
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="ui-input w-full"
                  />
                </div>

                <div>
                  <label htmlFor="wd-field-10" className="block text-[13px] font-medium text-ui-muted mb-1.5">Estimated Effort (Hrs)</label>
                  <input
                    id="wd-field-10"
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.5"
                    value={editEffort}
                    onChange={(e) => setEditEffort(Number(e.target.value))}
                    className="ui-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wd-field-11" className="block text-[13px] font-medium text-ui-muted mb-1.5">Content Doc Link (Zoho / Google)</label>
                  <input
                    id="wd-field-11"
                    type="url"
                    placeholder="https://writer.zoho.com/..."
                    value={editContentLink}
                    onChange={(e) => setEditContentLink(e.target.value)}
                    className="ui-input w-full"
                  />
                </div>
                <div>
                  <label htmlFor="wd-field-12" className="block text-[13px] font-medium text-ui-muted mb-1.5">Creative Assets Link (Drive)</label>
                  <input
                    id="wd-field-12"
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={editAssetsLink}
                    onChange={(e) => setEditAssetsLink(e.target.value)}
                    className="ui-input w-full"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="wd-field-13" className="block text-[13px] font-medium text-ui-muted mb-1.5">Output Link / URL</label>
                <input
                  id="wd-field-13"
                  type="url"
                  placeholder="https://..."
                  value={editDeliverableUrl}
                  onChange={(e) => setEditDeliverableUrl(e.target.value)}
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label htmlFor="wd-field-14" className="block text-[13px] font-medium text-ui-muted mb-1.5">Live Published URL</label>
                <input
                  id="wd-field-14"
                  type="url"
                  placeholder="https://..."
                  value={editPublishedUrl}
                  onChange={(e) => setEditPublishedUrl(e.target.value)}
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label htmlFor="wd-field-15" className="block text-[13px] font-medium text-ui-muted mb-1.5">Description / Brief</label>
                <textarea
                  id="wd-field-15"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rating Modal (WS4: Creative Head & Admin Corrections) */}
      {showEditRatingModal && item?.rating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
          <div
            ref={editRatingDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wd-edit-rating-title"
            className="glass-modal w-full max-w-md max-h-[92vh] overflow-y-auto p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-ui-line pb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-current" aria-hidden="true" />
                <h3 id="wd-edit-rating-title" className="text-base font-bold text-ui-ink">Edit Quality Rating</h3>
              </div>
              <button
                onClick={() => setShowEditRatingModal(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {ratingActionError && (
              <div role="alert" className="p-3 rounded-xl status-tint status-changes text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{ratingActionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRatingEdit} className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Rating (1 to 5 Stars) *
                </label>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quality rating, 1 to 5 stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditRatingScore(star)}
                      aria-label={`${star} star${star === 1 ? '' : 's'}`}
                      aria-pressed={editRatingScore === star}
                      className={`min-h-[44px] min-w-[44px] px-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1 transition-colors ${
                        editRatingScore >= star
                          ? 'bg-amber-50 border-amber-400 text-amber-900'
                          : 'bg-white/70 border-ui-line text-ui-muted hover:text-ui-ink'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" aria-hidden="true" />
                      <span aria-hidden="true">{star}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Written Feedback
                </label>
                <textarea
                  value={editRatingFeedback}
                  onChange={(e) => setEditRatingFeedback(e.target.value)}
                  placeholder="Qualitative creative notes..."
                  rows={2}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Quality Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_TAGS.map((tag) => {
                    const isSelected = editRatingTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleEditRatingTag(tag)}
                        aria-pressed={isSelected}
                        className={`min-h-[44px] px-3 rounded-full border text-[13px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-ui-ink text-white border-transparent'
                            : 'bg-white/70 text-ui-text border-ui-line hover:bg-white'
                        }`}
                      >
                        +{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[13px] font-medium text-ui-muted block mb-1.5">
                  Reason for Correction (Required for Audit Log) *
                </label>
                <input
                  type="text"
                  value={editRatingReason}
                  onChange={(e) => setEditRatingReason(e.target.value)}
                  placeholder="e.g., Re-evaluated pacing in final cut"
                  required
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditRatingModal(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRatingEdit || !editRatingReason.trim()}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {isSubmittingRatingEdit ? 'Saving...' : 'Save & Log Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
