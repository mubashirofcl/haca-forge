import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { statusClass, statusTone } from '../../lib/statusTone';
import { useAuth } from '../../context/AuthContext';
import {
  WORK_TYPES,
  PRIORITIES,
  BLOCKER_REASONS,
  RATING_TAGS,
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

const NO_SUBMISSION_TO_REVIEW =
  'This step has no submission to review yet. It can be approved or sent back once the owner submits their work.';

interface WorkItemDetail {
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
  const [revisionRootCause, setRevisionRootCause] = useState<string>('Brief mismatch');

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
            rootCause: revisionRootCause || 'Brief mismatch',
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
        <div className="w-10 h-10 border-4 border-[#7a6af6] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500">Loading work item details...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="glass-card p-12 text-center rounded-3xl border border-rose-200">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Work Item Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">{error || 'Unable to display item.'}</p>
          <button
            onClick={() => navigate('/my-work')}
            className="mt-6 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all inline-flex items-center gap-2"
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
            onClick={() => navigate(-1)}
            className="text-xs font-bold text-slate-500 hover:text-[#7a6af6] transition-colors flex items-center gap-1.5 mb-2 group cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-[#7a6af6]">
              {item.workType}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                item.priority === 'Urgent'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item.priority} Priority
            </span>

            <span
              className={`status-chip ${statusClass(
                isUnderReview ? 'waiting' : isReworkRequested ? 'changes' : statusTone(item.status)
              )} text-xs font-bold px-3 py-1`}
            >
              {isUnderReview && <span className="w-2 h-2 rounded-full status-dot animate-pulse" />}
              {isReworkRequested && <RotateCcw className="w-3.5 h-3.5" />}
              {!isUnderReview && !isReworkRequested && item.status === 'In Progress' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {!isUnderReview && !isReworkRequested && item.status === 'Blocked' && <AlertTriangle className="w-3.5 h-3.5" />}
              {isUnderReview ? 'Waiting for approval' : isReworkRequested ? 'Changes requested' : getStepStatusLabel(item.status)}
            </span>

            {isOverdue && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                Overdue
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {item.title}
          </h1>
        </div>

        {/* Action Buttons in Header (Only Edit details and Delete for sm_manager and admin) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {actions.includes('edit_details') && (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:border-[#7a6af6] hover:text-[#7a6af6] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit details
            </button>
          )}

          {actions.includes('delete') && (
            <button
              onClick={() => setShowDeleteConfirmModal(true)}
              className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all shadow-xs cursor-pointer"
              title="Delete step"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Steps PipelineStepper & Action Triggers */}
      <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-4">
        <PipelineStepper
          stages={stepperStages}
          currentStageId={item._id}
          currentStageKey={item.stageKey}
          status={item.status}
          blockerReason={item.blockerReason}
        />

        {/* Action Triggers Bar (Driven strictly by getAvailableActions) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(item.stageKey === 'Content' || item.stageKey === 'Script') && (
              <button
                onClick={() => navigate(`/work/${item._id}/writing-studio`)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Open Writing Studio
              </button>
            )}

            {item.stageKey === 'Shoot' && (
              <button
                onClick={() => navigate(`/work/${item._id}/workspace`)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                Open Shoot Workspace
              </button>
            )}

            {item.stageKey === 'Edit' && (
              <button
                onClick={() => navigate(`/work/${item._id}/workspace`)}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                Open Edit Workspace
              </button>
            )}

            {item.stageKey === 'Design' && (
              <button
                onClick={() => navigate(`/work/${item._id}/workspace`)}
                className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                Open Design Workspace
              </button>
            )}

            {item.stageKey === 'Post' && (
              <button
                onClick={() => navigate(`/work/${item._id}/workspace`)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Deliverable
                </button>
                <button
                  onClick={() => setShowRevisionModal(true)}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Request Rework
                </button>
                <button
                  onClick={() => navigate(`/work/${item._id}/review`)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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
                className="px-4 py-2 bg-[#7a6af6] hover:bg-[#6857f5] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start
              </button>
            )}

            {/* Worker Submission Flow */}
            {isOwner && (
              <>
                {isUnderReview ? (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 border border-indigo-200/80 rounded-xl">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                    </span>
                    <span className="text-xs font-bold text-indigo-900">
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
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                Mark as posted
              </button>
            )}

            {actions.includes('mark_blocked') && (
              <button
                onClick={() => {
                  const prevOwner = item.suggestedDependencyOwner || item.previousStage?.owner;
                  setDependencyOwnerId(prevOwner?._id || '');
                  setShowBlockerModal(true);
                }}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                Mark blocked
              </button>
            )}

            {actions.includes('request_help') && (
              <button
                onClick={() => {
                  const msg = prompt('Enter your question or help request for the team:');
                  if (msg) alert('Help request broadcast to team: ' + msg);
                }}
                className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all border border-purple-200 flex items-center gap-1.5 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Request help
              </button>
            )}

            {actions.includes('resolve_blocker') && (
              <button
                onClick={() => handleTransition('In Progress')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Resolve blocker
              </button>
            )}

            {actions.includes('skip_step') && (
              <button
                onClick={handleSkipStep}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip step
              </button>
            )}

            {/* One-line reason shown when viewer has no action on this step */}
            {reason && !isUnderReview && (
              <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{reason}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2a. Submitted Deliverable & Review Cockpit Card */}
      {(item.latestSubmission || hasOutput || isReworkRequested || (item.revisions || 0) > 0 || isUnderReview) && (
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-black">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    Deliverable & Review Studio
                  </h3>
                  {item.latestSubmission?.version && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      v{item.latestSubmission.version}
                    </span>
                  )}
                  {(item.revisions || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <RotateCcw className="w-2.5 h-2.5" />
                      {item.revisions} stage rework{(item.revisions || 0) === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {item.latestSubmission?.submittedAt
                    ? `Submitted on ${new Date(item.latestSubmission.submittedAt).toLocaleDateString()} at ${new Date(item.latestSubmission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Current deliverable for this stage'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isUnderReview && (
                <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Awaiting Review
                </span>
              )}
              {isReworkRequested && (
                <span className="px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" />
                  Rework Requested
                </span>
              )}
              {item.status === 'Approved' && (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Approved
                </span>
              )}
            </div>
          </div>

          {/* Rework Feedback Alert Banner if changes requested */}
          {isReworkRequested && (item.latestSubmission?.feedback || item.blockerReason) && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-950 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Rework Feedback
                  </span>
                  {item.latestSubmission?.rootCause && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-200/60 text-amber-900 border border-amber-300">
                      Cause: {item.latestSubmission.rootCause}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-amber-700">
                  Revision #{item.revisions || 1}
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium bg-white/70 p-3 rounded-xl border border-amber-200/60">
                {item.latestSubmission?.feedback || 'Please review the requested changes and resubmit.'}
              </p>
            </div>
          )}

          {/* Deliverable Content & Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Output link or file */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Deliverable Link / Asset
              </span>
              {item.deliverableUrl || item.latestSubmission?.fileUrl || item.latestSubmission?.linkUrl ? (
                <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                  <a
                    href={item.deliverableUrl || item.latestSubmission?.fileUrl || item.latestSubmission?.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline truncate flex items-center gap-1.5"
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
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                    title="Copy link"
                  >
                    {copiedDeliverableLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No deliverable link uploaded yet.</p>
              )}
            </div>

            {/* Stage-specific Summary or Script snippet */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Stage Details & Artifacts
              </span>
              <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 min-h-[42px] flex items-center justify-between">
                <span>
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
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    View Studio →
                  </button>
                )}
                {item.stageKey === 'Shoot' && (
                  <button
                    onClick={() => navigate(`/work/${item._id}/workspace`)}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    View Clips →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reviewer Action Bar inside Cockpit */}
          {isReviewer && !isOwner && (isUnderReview || item.status === 'Pending' || (item.status === 'Feedback' && item.latestSubmission?.status === 'submitted')) && (
            <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-950">Reviewer Decision:</span>
                <span className="text-xs text-slate-500">Evaluate deliverable against brief</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRevisionModal(true)}
                  className="px-3.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Request Rework
                </button>
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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
        <div className="glass-card p-6 rounded-3xl border border-amber-300/80 bg-gradient-to-br from-amber-500/10 via-slate-900 to-indigo-950/90 text-white shadow-glass space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
                <Star className="w-4 h-4 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-white tracking-tight">
                    Step Quality Rating & Feedback
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {item.rating.score} ★ &bull; {item.rating.score === 5 ? 'Excellent' : item.rating.score === 4 ? 'Very Good' : item.rating.score === 3 ? 'Good' : item.rating.score === 2 ? 'Below Standard' : 'Needs Work'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Reviewed by {item.rating.raterId?.name || 'Creative Head'} on {new Date(item.rating.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Worker Mark as Seen */}
              {(item.ownerId?._id === (user?._id || user?.id || user?.userId)) && !item.rating.seenAt && (
                <button
                  onClick={handleMarkRatingSeen}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark as seen
                </button>
              )}

              {item.rating.seenAt && (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Acknowledged
                </span>
              )}

              {/* Creative Head / Admin Edit Button */}
              {(user?.role === 'creative_head' || user?.role === 'admin') && (
                <button
                  onClick={openEditRatingModal}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
                  title="Edit rating score and feedback (Audit log will be preserved)"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Rating
                </button>
              )}
            </div>
          </div>

          {/* Stars visual display */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  (item.rating?.score || 0) >= star
                    ? 'text-amber-400 fill-current'
                    : 'text-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Qualitative Feedback Text */}
          {item.rating.feedback && (
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 text-xs text-slate-200 leading-relaxed font-sans">
              "{item.rating.feedback}"
            </div>
          )}

          {/* Quality Tags */}
          {item.rating.tags && item.rating.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.rating.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                >
                  +{tag}
                </span>
              ))}
            </div>
          )}

          {/* Audit History Log */}
          {item.rating.editedLog && item.rating.editedLog.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-400 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Rating Edit History ({item.rating.editedLog.length})
              </span>
              {item.rating.editedLog.map((log, idx) => {
                const editorName =
                  typeof log.editedBy === 'object' && log.editedBy?.name
                    ? log.editedBy.name
                    : 'Reviewer';
                return (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950/40 border border-white/5 text-[11px] flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-300 font-bold">{editorName}</span>
                      <span className="text-slate-400"> adjusted score to {log.newScore}★: </span>
                      <span className="text-amber-300 italic">"{log.reason}"</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">
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
          <div className="glass-pill-container p-1.5 flex items-center gap-1 max-w-md">
            <button
              onClick={() => setActiveTab('brief')}
              className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'brief' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Details
            </button>
            <button
              onClick={() => setActiveTab('deliverable')}
              className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'deliverable' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Links and files
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'activity' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              History
            </button>
          </div>

          {/* Tab 1: Details */}
          {activeTab === 'brief' && (
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-6">
              {item.stageKey && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-extrabold text-indigo-900">
                      Stage {item.stageOrder}: {item.stageKey}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                    {item.reviewRequired ? 'Approval Required' : 'Auto-Advances'}
                  </span>
                </div>
              )}

              {/* Writing Studio Launch Card for Content and Script stages */}
              {(item.stageKey === 'Content' || item.stageKey === 'Script') && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white shadow-lg border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                        Writing Studio
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      Draft your {item.stageKey} document in the studio
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md">
                      Word-style rich text canvas with duration estimation, hook check, scene tables, Malayalam font, and docked brief.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/writing-studio`)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      Open Writing Studio
                    </button>
                  </div>
                </div>
              )}

              {/* Shoot Workspace Launch Card */}
              {item.stageKey === 'Shoot' && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white shadow-lg border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-400" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue-300">
                        Shoot Workspace
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      Capture & Upload Raw Footage
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md">
                      Read-only script & shot list, upload 1–10 clips up to 500 MB with pause/resume and phone support, shoot notes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Video className="w-4 h-4" />
                      Open Shoot Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Workspace Launch Card */}
              {item.stageKey === 'Edit' && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-950 via-slate-900 to-purple-950 text-white shadow-lg border border-violet-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-violet-400" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-violet-300">
                        Edit Workspace
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      Assemble Master Cut & Verify Pacing
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md">
                      Read-only footage clips & script, 9:16 aspect ratio & &le;90s duration pre-flight checks, revision checklist.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Film className="w-4 h-4" />
                      Open Edit Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Design Workspace Launch Card */}
              {item.stageKey === 'Design' && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-pink-950 via-slate-900 to-rose-950 text-white shadow-lg border border-pink-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-pink-400" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-pink-300">
                        Design Workspace
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      Create Visuals Beside Approved Copy
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md">
                      Approved copy with 1-click copy buttons, image/PDF upload with size guides, zoom preview, carousel ordering.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Palette className="w-4 h-4" />
                      Open Design Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Post Workspace Launch Card */}
              {item.stageKey === 'Post' && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white shadow-lg border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                        Posting Workspace
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      Publish to Live Social Channels
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md">
                      Download approved master, copy caption & hashtags, platform pre-publish checklist, mark as posted.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/work/${item._id}/workspace`)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      Open Posting Workspace
                    </button>
                  </div>
                </div>
              )}

              {/* Shot List for Videographer & Shooter (WS2 Acceptance Criteria) */}
              {(item.stageKey === 'Shoot' || item.stageKey === 'Edit') && item.scriptShotList && item.scriptShotList.length > 0 && (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Extracted Shot List (from Approved Script)
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {item.scriptShotList.length} shots to capture
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {item.scriptShotList.map((shot: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex items-start gap-2.5"
                      >
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shrink-0 text-[11px]">
                          #{shot.sceneNumber}
                        </span>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{shot.visual}</p>
                          {shot.audio && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">Audio: "{shot.audio}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Stage Context Banner */}
              {item.previousStage && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Previous Dependency &bull; {item.previousStage.stageKey} Stage
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {item.previousStage.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold">
                      Owner: {item.previousStage.owner?.name || 'Unassigned'}
                    </span>
                    {item.previousStage.deliverableUrl && (
                      <a
                        href={item.previousStage.deliverableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-600 hover:underline flex items-center gap-1 font-bold text-xs"
                      >
                        <span>View Completed Output</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Description
                </span>
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {item.description || item.brief?.description || 'No specific description provided.'}
                </div>
              </div>

              {/* Zoho / Google Content Link */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Reference & Brief Content Link
                </span>
                {item.contentLink || item.brief?.contentLink ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/50 border border-purple-100">
                    <a
                      href={item.contentLink || item.brief?.contentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-purple-700 hover:underline truncate max-w-sm flex items-center gap-1.5"
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
                      className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-100 transition-colors"
                      title="Copy link"
                    >
                      {copiedContentLink ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                    No reference link provided.
                  </div>
                )}
              </div>

              {/* Drive Assets Link */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Production Assets Drive Link
                </span>
                {item.assetsLink || item.brief?.assetsLink ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                    <a
                      href={item.assetsLink || item.brief?.assetsLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-indigo-700 hover:underline truncate max-w-sm flex items-center gap-1.5"
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
                      className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors"
                      title="Copy link"
                    >
                      {copiedAssetsLink ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                    No assets link provided.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Links and files */}
          {activeTab === 'deliverable' && (
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Worker Output Link
                </span>
                {item.deliverableUrl ? (
                  <a
                    href={item.deliverableUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-[#7a6af6] font-extrabold hover:underline group"
                  >
                    <span className="truncate max-w-md">{item.deliverableUrl}</span>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#7a6af6]" />
                  </a>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-400 italic">
                    No output link submitted yet.
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Published Live URL
                </span>
                {item.publishedUrl ? (
                  <a
                    href={item.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between text-xs text-emerald-700 font-extrabold hover:underline group"
                  >
                    <span className="truncate max-w-md">{item.publishedUrl}</span>
                    <ExternalLink className="w-4 h-4 text-emerald-500 group-hover:text-emerald-700" />
                  </a>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-400 italic">
                    Not published to live channels yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: History */}
          {activeTab === 'activity' && (
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-4">
                Audit Timeline
              </span>
              {activities.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No logged history yet.</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((act) => (
                    <div key={act._id} className="flex items-start gap-3 border-l-2 border-indigo-200 pl-4 py-1">
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {act.action.replace('work_item.', '').replace('_', ' ')}
                        </div>
                        <div className="text-[10px] text-slate-400">
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
          <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assignee</span>
            <h3 className="text-sm font-extrabold text-slate-900 mb-3">Owner</h3>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7a6af6] to-indigo-500 text-white flex items-center justify-center font-black text-base shadow-md shadow-[#7a6af6]/20">
                {item.ownerId?.name ? item.ownerId.name[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div className="text-sm font-extrabold text-slate-900">{item.ownerId?.name || 'Unassigned'}</div>
                <div className="text-xs text-slate-500">{item.ownerId?.email}</div>
                <div className="text-[10px] font-bold text-[#7a6af6] uppercase mt-0.5">
                  {item.ownerId?.jobRole || item.ownerId?.role || 'Creative Staff'}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule & Timing */}
          <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timetable</span>
            <h3 className="text-sm font-extrabold text-slate-900 mb-2">Schedule & Cadence</h3>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Target Deadline</span>
              <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-900'}`}>
                {new Date(item.deadline).toLocaleDateString()}
              </span>
            </div>

            {measures.workTimeFormatted !== '—' && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Work Time</span>
                <span className="font-bold text-slate-900">
                  {item.status === 'In Progress' ? `Working for ${measures.workTimeFormatted}` : measures.workTimeFormatted}
                </span>
              </div>
            )}

            {measures.approvalWaitFormatted !== '—' && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Approval Wait</span>
                <span className="font-bold text-slate-900">{measures.approvalWaitFormatted}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Estimated Effort</span>
              <span className="font-bold text-slate-900">{item.estimatedEffortHrs || 4} Hours</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Revisions</span>
              <span className="font-bold text-slate-900">{item.revisions || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit / Done / Post Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {submitAction === 'submit_for_approval'
                  ? 'Submit for approval'
                  : 'Mark as posted'}
              </h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Workspace recommendation for media stages */}
            {['Shoot', 'Edit', 'Design', 'Post', 'Script', 'Content'].includes(item.stageKey || '') && (
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900">
                    Recommended: {item.stageKey} Workspace
                  </span>
                  <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                    Direct Upload & Verification
                  </span>
                </div>
                <p className="text-xs text-indigo-700">
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
                  className="mt-1 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Launch {item.stageKey} Workspace
                </button>
              </div>
            )}

            <form onSubmit={handleOutputSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {submitAction === 'mark_as_posted'
                      ? 'Live Published Post URL *'
                      : 'Output URL (Fallback Cloud Link) *'}
                  </label>
                  {['Shoot', 'Edit', 'Design', 'Post', 'Script', 'Content'].includes(item.stageKey || '') && (
                    <span className="text-[10px] text-slate-400">Link Fallback</span>
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
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Comments</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={submitComment}
                  onChange={(e) => setSubmitComment(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-slate-900">Request Rework</h3>
              </div>
              <button
                onClick={() => setShowRevisionModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRevisionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Root Cause *</label>
                <select
                  value={revisionRootCause}
                  onChange={(e) => setRevisionRootCause(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Brief mismatch">Brief mismatch</option>
                  <option value="Audio/visual defect">Audio/visual defect</option>
                  <option value="Tone/copy">Tone / Copy</option>
                  <option value="Formatting/layout">Formatting / Layout</option>
                  <option value="Missing information">Missing information</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Feedback & Revisions Needed *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail exactly what must be fixed or re-recorded before resubmission..."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !revisionNotes.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">Approve Deliverable</h3>
              </div>
              <button
                onClick={() => setShowApproveModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Quality Rating (1 to 5 Stars) *
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setApproveRatingScore(star)}
                      className={`p-2 rounded-xl border text-sm font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        approveRatingScore >= star
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                      <span>{star}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Creative Feedback (Optional)
                </label>
                <textarea
                  value={approveFeedback}
                  onChange={(e) => setApproveFeedback(e.target.value)}
                  placeholder="Notes on execution, tone, visual polish..."
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
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
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        +{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApproving}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-emerald-500/20"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-slate-900">Mark blocked</h3>
              </div>
              <button
                onClick={() => setShowBlockerModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitBlocker} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Blocker *</label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Details / Blocker Note</label>
                <textarea
                  rows={3}
                  value={blockerNote}
                  onChange={(e) => setBlockerNote(e.target.value)}
                  placeholder="Explain what is blocking progress..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockerModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBlocking}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-extrabold text-slate-900">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete step <strong>&quot;{item.title}&quot;</strong>? This task has not started and will be permanently removed. This action is logged.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Edit details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Work Type</label>
                  <select
                    value={editWorkType}
                    onChange={(e) => setEditWorkType(e.target.value as WorkType)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  >
                    {WORK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as Priority)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deadline *</label>
                  <input
                    type="date"
                    required
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Effort (Hrs)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.5"
                    value={editEffort}
                    onChange={(e) => setEditEffort(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Content Doc Link (Zoho / Google)</label>
                  <input
                    type="url"
                    placeholder="https://writer.zoho.com/..."
                    value={editContentLink}
                    onChange={(e) => setEditContentLink(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Creative Assets Link (Drive)</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={editAssetsLink}
                    onChange={(e) => setEditAssetsLink(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Output Link / URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editDeliverableUrl}
                  onChange={(e) => setEditDeliverableUrl(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Live Published URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editPublishedUrl}
                  onChange={(e) => setEditPublishedUrl(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Brief</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-[#7a6af6] hover:bg-[#6857f5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#7a6af6]/20 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-current" />
                <h3 className="text-sm font-extrabold text-white">Edit Quality Rating</h3>
              </div>
              <button
                onClick={() => setShowEditRatingModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {ratingActionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{ratingActionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRatingEdit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Rating (1 to 5 Stars) *
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditRatingScore(star)}
                      className={`p-2 rounded-xl border text-sm font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        editRatingScore >= star
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                      <span>{star}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Written Feedback
                </label>
                <textarea
                  value={editRatingFeedback}
                  onChange={(e) => setEditRatingFeedback(e.target.value)}
                  placeholder="Qualitative creative notes..."
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
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
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        +{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-rose-300 block mb-1.5">
                  Reason for Correction (Required for Audit Log) *
                </label>
                <input
                  type="text"
                  value={editRatingReason}
                  onChange={(e) => setEditRatingReason(e.target.value)}
                  placeholder="e.g., Re-evaluated pacing in final cut"
                  required
                  className="w-full text-xs p-3 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditRatingModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRatingEdit || !editRatingReason.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold transition-all cursor-pointer"
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
