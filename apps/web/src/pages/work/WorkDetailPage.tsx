import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  WORK_TYPES,
  PRIORITIES,
  BLOCKER_REASONS,
  APPROVER_JOB_ROLES,
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
  Sparkles,
  ExternalLink,
  Edit3,
  Trash2,
  Activity,
  FileText,
  ShieldCheck,
  Check,
  X,
  Share2,
  Copy,
  CheckCheck,
  Layers,
  Link as LinkIcon,
} from 'lucide-react';

interface WorkItemDetail {
  _id: string;
  title: string;
  workType: WorkType;
  deadline: string;
  estimatedEffortHrs: number;
  status: WorkItemStatus;
  priority: Priority;
  revisions: number;
  description?: string;
  deliverableUrl?: string;
  publishedUrl?: string;
  blockerReason?: BlockerReason;
  blockerNote?: string;
  // Content Flow stage fields (Phase 3 delta)
  contentPieceId?: string | null;
  stageKey?: string | null;
  stageOrder?: number | null;
  reviewRequired?: boolean;
  unlockedAt?: string | null;
  isSkipped?: boolean;
  contentLink?: string;
  assetsLink?: string;
  brief?: {
    description?: string;
    contentLink?: string;
    assetsLink?: string;
  };
  campaignId: { _id: string; name: string; relatedOKR?: string };
  profileId: { _id: string; name: string; code: string };
  departmentId: { _id: string; name: string; code: string };
  ownerId: { _id: string; name: string; email: string; jobRole?: string; role?: string };
  relatedTarget?: { _id: string; month: string; leadsTarget?: number; revenueTarget?: number };
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

const STATUS_STEPS: WorkItemStatus[] = [
  'Not Started',
  'In Progress',
  'Feedback',
  'Pending',
  'Approved',
  'Published',
];

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
  const [isBlocking, setIsBlocking] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editWorkType, setEditWorkType] = useState<WorkType>('Ad Creative');
  const [editPriority, setEditPriority] = useState<Priority>('Medium');
  const [editEffort, setEditEffort] = useState(4);
  const [editDeadline, setEditDeadline] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeliverableUrl, setEditDeliverableUrl] = useState('');
  const [editPublishedUrl, setEditPublishedUrl] = useState('');
  const [editContentLink, setEditContentLink] = useState('');
  const [editAssetsLink, setEditAssetsLink] = useState('');
  const [copiedContentLink, setCopiedContentLink] = useState(false);
  const [copiedAssetsLink, setCopiedAssetsLink] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isPrivileged =
    user?.role === 'admin' || user?.role === 'marketing_head' || user?.role === 'team_lead';

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

  const handleDelete = async () => {
    if (!item || !window.confirm(`Delete "${item.title}"? This action cannot be undone.`)) return;
    try {
      await apiFetch(`/api/work/${item._id}`, { method: 'DELETE' });
      navigate('/work');
    } catch (err: any) {
      alert(err.message || 'Delete failed');
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

  const currentUserId = (user?._id || user?.id || user?.userId)?.toString();
  const ownerIdStr = (item.ownerId?._id || item.ownerId)?.toString();
  const isOwner = Boolean(currentUserId && ownerIdStr && currentUserId === ownerIdStr);

  const itemProfileId = (item.profileId?._id || item.profileId)?.toString();
  const holdsBrand = Boolean(
    user?.role === 'admin' ||
    (user?.role === 'marketing_head' && (!user?.profileAccess || user.profileAccess.length === 0)) ||
    (user?.profileAccess && itemProfileId && user.profileAccess.some((p: any) => (p?._id || p)?.toString() === itemProfileId))
  );

  const isApproverLead =
    user?.role === 'team_lead' &&
    Boolean(user?.jobRole && (APPROVER_JOB_ROLES as readonly string[]).includes(user.jobRole));

  const canApprove = (() => {
    // CONTENT FLOW DELTA: The owner can never approve their own stage
    if (item.reviewRequired && isOwner) {
      return false;
    }

    if (item.reviewRequired) {
      const isAllowedRole =
        user?.role === 'admin' || user?.role === 'marketing_head' || isApproverLead;
      return isAllowedRole && holdsBrand;
    }

    // Standalone or non-review items
    return isPrivileged && holdsBrand;
  })();

  const canRequestChanges = (() => {
    if (item.reviewRequired && isOwner) return false;
    if (item.reviewRequired) {
      const isAllowedRole =
        user?.role === 'admin' || user?.role === 'marketing_head' || isApproverLead;
      return isAllowedRole && holdsBrand;
    }
    return isPrivileged && holdsBrand;
  })();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-xs font-bold text-slate-500 hover:text-[#7a6af6] transition-colors flex items-center gap-1.5 mb-2 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-900 text-white">
              {item.profileId?.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-[#7a6af6]">
              {item.workType}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                item.priority === 'High'
                  ? 'bg-rose-100 text-rose-700'
                  : item.priority === 'Medium'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item.priority} Priority
            </span>

            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                item.status === 'In Progress'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : item.status === 'Blocked'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : item.status === 'Feedback'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : item.status === 'Pending'
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : item.status === 'Approved'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : item.status === 'Published'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {item.status === 'In Progress' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              {item.status === 'Blocked' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
              {item.status}
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

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:border-[#7a6af6] hover:text-[#7a6af6] transition-all shadow-xs flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>

          {isPrivileged && (
            <button
              onClick={handleDelete}
              className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all shadow-xs"
              title="Delete item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Strategic Traceability Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white shadow-lg shadow-indigo-500/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-violet-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Traceability Chain</span>
            <span>➔</span>
            <span>{item.profileId?.name}</span>
          </div>
          <div className="text-xs sm:text-sm font-extrabold flex items-center gap-2">
            <span>Campaign:</span>
            <span
              onClick={() => navigate(`/campaigns/${item.campaignId._id}`)}
              className="underline hover:text-violet-100 cursor-pointer"
            >
              {item.campaignId?.name}
            </span>
          </div>
          <div className="text-xs text-violet-100/90 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-300 flex-shrink-0" />
            <span>OKR: {item.campaignId?.relatedOKR || 'Strategic Objective'}</span>
          </div>
        </div>

        {item.relatedTarget && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 text-xs self-start md:self-auto flex-shrink-0">
            <div className="text-[10px] uppercase font-bold text-violet-200">Linked Anchor</div>
            <div className="font-extrabold text-white">{item.relatedTarget.month} Target</div>
          </div>
        )}
      </div>

      {/* 3. Workflow State Stepper & Action Triggers */}
      <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Execution Lifecycle</h3>
          <span className="text-xs font-semibold text-slate-500">
            Current Status: <strong>{item.status}</strong>
          </span>
        </div>

        {/* Stepper visual */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {STATUS_STEPS.map((st, idx) => {
            const isCurrent = item.status === st;
            const isPassed = STATUS_STEPS.indexOf(item.status) > idx && item.status !== 'Blocked';

            return (
              <div
                key={st}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? 'bg-slate-900 text-white font-extrabold border-slate-900 shadow-md'
                    : isPassed
                    ? 'bg-emerald-50 text-emerald-800 font-bold border-emerald-200'
                    : 'bg-slate-50 text-slate-400 font-medium border-slate-100'
                }`}
              >
                <div className="text-[9px] uppercase font-bold opacity-80">Step {idx + 1}</div>
                <div className="text-xs truncate mt-0.5">{st}</div>
              </div>
            );
          })}
        </div>

        {/* Action Triggers Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {item.status === 'Not Started' && (
              <button
                onClick={() => handleTransition('In Progress')}
                className="px-4 py-2 bg-[#7a6af6] hover:bg-[#6857f5] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Work
              </button>
            )}

            {item.status === 'In Progress' && (
              <>
                <button
                  onClick={() => handleTransition('Pending')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit for Lead Review
                </button>
                <button
                  onClick={() => setShowBlockerModal(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200 flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Mark Blocked
                </button>
              </>
            )}

            {item.status === 'Feedback' && (
              <>
                <button
                  onClick={() => handleTransition('In Progress')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Rework Deliverable
                </button>
                <button
                  onClick={() => handleTransition('Pending')}
                  className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200"
                >
                  Submit Review
                </button>
              </>
            )}

            {item.status === 'Pending' && (
              <>
                {canApprove && (
                  <button
                    onClick={() => handleTransition('Approved')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve Deliverable
                  </button>
                )}
                {canRequestChanges && (
                  <button
                    onClick={() => handleTransition('Feedback')}
                    className="px-3 py-2 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-200"
                  >
                    Request Changes
                  </button>
                )}
                {item.reviewRequired && isOwner && (
                  <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Awaiting review (Owner cannot self-approve stage)</span>
                  </div>
                )}
                {item.reviewRequired && !isOwner && !canApprove && (
                  <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {!holdsBrand
                        ? 'Brand profile access required to review'
                        : 'Creative Head (TL) / Marketing Head approval required'}
                    </span>
                  </div>
                )}
              </>
            )}

            {item.status === 'Approved' && (
              <button
                onClick={() => handleTransition('Published')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                Publish Live
              </button>
            )}

            {item.status === 'Blocked' && (
              <button
                onClick={() => handleTransition('In Progress')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Resume Work (Unblock)
              </button>
            )}
          </div>

          {item.status === 'Blocked' && (
            <div className="text-xs text-rose-700 font-bold bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Blocked: {item.blockerReason}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Main Body: Workplace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Cols: Tabs & Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-pill-container p-1.5 flex items-center gap-1 max-w-md">
            <button
              onClick={() => setActiveTab('brief')}
              className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'brief' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Creative Brief
            </button>
            <button
              onClick={() => setActiveTab('deliverable')}
              className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'deliverable' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Deliverable Assets
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'activity' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Audit Stream
            </button>
          </div>

          {/* Tab 1: Creative Brief */}
          {activeTab === 'brief' && (
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-6">
              {/* Content Flow Stage Stepper Info */}
              {item.stageKey && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#7a6af6] text-white">
                      Stage {item.stageOrder !== null && item.stageOrder !== undefined ? `${item.stageOrder}` : ''}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">{item.stageKey}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isSkipped ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                        Skipped (Not Needed)
                      </span>
                    ) : item.reviewRequired ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Creative Head Approval Required
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Direct Forward Stage
                      </span>
                    )}
                    {item.unlockedAt && (
                      <span className="text-[11px] text-slate-500">
                        Unlocked: {new Date(item.unlockedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Deliverable Document & Assets Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Content Link (Zoho Writer / Google Docs) */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#7a6af6]" />
                      Content Link (Zoho / Google Doc)
                    </span>
                    {(item.contentLink || item.brief?.contentLink) && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.contentLink || item.brief?.contentLink || '');
                          setCopiedContentLink(true);
                          setTimeout(() => setCopiedContentLink(false), 2000);
                        }}
                        className="text-[11px] font-bold text-[#7a6af6] hover:text-[#6857f5] flex items-center gap-1"
                      >
                        {copiedContentLink ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedContentLink ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  {item.contentLink || item.brief?.contentLink ? (
                    <a
                      href={item.contentLink || item.brief?.contentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold break-all flex items-center gap-1 underline underline-offset-2"
                    >
                      <LinkIcon className="w-3 h-3 flex-shrink-0" />
                      {item.contentLink || item.brief?.contentLink}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No content link provided yet.</p>
                  )}
                </div>

                {/* Assets Link (Drive / Assets Folder) */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-pink-500" />
                      Assets Link (Drive / Creative Files)
                    </span>
                    {(item.assetsLink || item.brief?.assetsLink) && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.assetsLink || item.brief?.assetsLink || '');
                          setCopiedAssetsLink(true);
                          setTimeout(() => setCopiedAssetsLink(false), 2000);
                        }}
                        className="text-[11px] font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1"
                      >
                        {copiedAssetsLink ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedAssetsLink ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  {item.assetsLink || item.brief?.assetsLink ? (
                    <a
                      href={item.assetsLink || item.brief?.assetsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-pink-600 hover:text-pink-800 font-semibold break-all flex items-center gap-1 underline underline-offset-2"
                    >
                      <LinkIcon className="w-3 h-3 flex-shrink-0" />
                      {item.assetsLink || item.brief?.assetsLink}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No creative assets link attached yet.</p>
                  )}
                </div>
              </div>

              {/* Brief & Execution Specifications */}
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-[#7a6af6]" />
                  Brief & Execution Specifications
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {item.description ||
                    item.brief?.description ||
                    'No detailed brief text provided. Execute in accordance with campaign OKR guidelines.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Department</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {item.departmentId?.name || 'General'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Effort Estimate</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {item.estimatedEffortHrs} Hours
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Revisions</div>
                  <div className="text-xs font-extrabold text-[#7a6af6] mt-0.5">
                    {item.revisions} Rounds
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Priority</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-0.5">{item.priority}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Deliverable Assets */}
          {activeTab === 'deliverable' && (
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-[#7a6af6]" />
                Deliverable & Production Links
              </h3>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Deliverable Asset URL</div>
                  {item.deliverableUrl ? (
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <a
                        href={item.deliverableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-[#7a6af6] hover:underline truncate"
                      >
                        {item.deliverableUrl}
                      </a>
                      <a
                        href={item.deliverableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-lg text-slate-500 hover:text-[#7a6af6]"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-1">No deliverable asset URL submitted yet.</div>
                  )}
                </div>

                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Live Published URL</div>
                  {item.publishedUrl ? (
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <a
                        href={item.publishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-emerald-700 hover:underline truncate"
                      >
                        {item.publishedUrl}
                      </a>
                      <a
                        href={item.publishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-lg text-slate-500 hover:text-emerald-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-1">Deliverable is not yet published live.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Audit Stream */}
          {activeTab === 'activity' && (
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#7a6af6]" />
                Work Item Lifecycle Audit Log
              </h3>

              {activities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No activity events recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div
                      key={act._id}
                      className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-violet-100 text-[#7a6af6] flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {act.actorId?.name || 'System User'}{' '}
                            <span className="font-normal text-slate-600">
                              {act.action === 'work_item.created' && 'created this work item'}
                              {act.action === 'work_item.status_changed' && (
                                <>
                                  transitioned status to{' '}
                                  <span className="font-bold text-slate-900">{act.toStatus}</span>
                                </>
                              )}
                              {act.action === 'work_item.updated' && 'updated parameters'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(act.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                        {act.action}
                      </span>
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
            <h3 className="text-sm font-extrabold text-slate-900 mb-3">Deliverable Owner</h3>

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

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Estimated Effort</span>
              <span className="font-bold text-slate-900">{item.estimatedEffortHrs} Hours</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Created On</span>
              <span className="font-bold text-slate-900">{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Mark Blocked Modal */}
      {showBlockerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-md p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-slate-900">Mark Work Item Blocked</h3>
              </div>
              <button
                onClick={() => setShowBlockerModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
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

      {/* 6. Edit Work Item Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Edit Work Item</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Deliverable Asset URL</label>
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
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-[#7a6af6] hover:bg-[#6857f5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#7a6af6]/20 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
