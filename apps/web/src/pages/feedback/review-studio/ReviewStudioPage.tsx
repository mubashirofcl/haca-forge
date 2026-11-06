import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../hooks/useSocket';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowLeft,
  FileText,
  Video,
  Image as ImageIcon,
  ExternalLink,
  CheckCircle,
  Share2,
} from 'lucide-react';

import { DocumentViewer, DocumentCommentAnchor } from './DocumentViewer';
import { VideoPlayerViewer } from './VideoPlayerViewer';
import { ImageViewer, ImageCommentAnchor, ReviewComment } from './ImageViewer';
import { LinkOpenerViewer } from './LinkOpenerViewer';
import { ReviewStudioSidebar } from './ReviewStudioSidebar';
import { DecisionBar, RootCause } from './DecisionBar';
import { ShootReviewView } from '../../work/workspaces/ShootReviewView';
import { ShareToChatModal } from '../../chat/ShareToChatModal';

interface ReviewQueueItem {
  id: string;
  versionNumber: number;
  submittedAt: string;
  waitingDays: number;
  fileUrl?: string;
  contentUrl?: string;
  thumbnailUrl?: string;
  textContent?: string;
  metadata?: Record<string, any>;
  notes?: string;
  workItemId?: {
    id: string;
    title: string;
    stageKey?: string;
    step?: string;
    ownerId?: {
      id: string;
      name: string;
      role?: string;
    };
  };
  contentPieceId?: {
    id: string;
    title: string;
    brief?: {
      title?: string;
      description?: string;
      channel?: string;
      targetAudience?: string;
      hookIdea?: string;
      tone?: string;
      references?: string[];
    };
  };
}

export const ReviewStudioPage: React.FC = () => {
  const { user } = useAuth();
  const { on } = useSocket();
  const navigate = useNavigate();
  const { id: routeWorkItemId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  // Review Queue state
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Shown when a decision was refused because the version is stale or already decided.
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  // Remounts the decision controls after a refresh, so a rating or note never carries over.
  const [decisionResetKey, setDecisionResetKey] = useState(0);

  // Active submission details
  const [activeSubmission, setActiveSubmission] = useState<any | null>(null);
  const [earlierOutputs, setEarlierOutputs] = useState<any[]>([]);
  const [versionList, setVersionList] = useState<any[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Viewer modes
  const [viewerType, setViewerType] = useState<'document' | 'video' | 'image' | 'link'>('document');
  const [isDiffMode, setIsDiffMode] = useState<boolean>(false);
  const [diffBaseText, setDiffBaseText] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  // Load Review Queue
  const fetchReviewQueue = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch<any>('/api/submissions/review-queue');
      const items: ReviewQueueItem[] = Array.isArray(res) ? res : (res?.data || []);
      setQueue(items);

      if (items.length > 0) {
        // If a specific workItemId was passed in route or query param
        const querySubmissionId = searchParams.get('submissionId');
        let initialIndex = 0;

        if (querySubmissionId) {
          const foundIdx = items.findIndex((i) => (i.id || (i as any)._id) === querySubmissionId);
          if (foundIdx !== -1) initialIndex = foundIdx;
        } else if (routeWorkItemId) {
          const foundIdx = items.findIndex((i) => {
            const wId =
              i.workItemId?.id ||
              (i.workItemId as any)?._id ||
              (typeof i.workItemId === 'string' ? i.workItemId : '');
            return wId === routeWorkItemId;
          });
          if (foundIdx !== -1) initialIndex = foundIdx;
        }

        setQueueIndex(initialIndex);
        const subId = items[initialIndex].id || (items[initialIndex] as any)._id;
        loadSubmissionDetails(subId);
      } else if (routeWorkItemId) {
        // Fallback: If not in review-queue (e.g. already approved or draft), fetch directly by workItemId
        fetchSubmissionByWorkItem(routeWorkItemId);
      } else {
        setActiveSubmission(null);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error fetching review queue:', err);
      setErrorMsg(err?.message || 'Failed to load review queue');
      setLoading(false);
    }
  }, [routeWorkItemId, searchParams]);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  // Fetch submission directly by workItemId fallback
  const fetchSubmissionByWorkItem = async (workItemId: string) => {
    try {
      setLoading(true);
      const rawSubs = await apiFetch<any>(`/api/submissions?workItemId=${workItemId}`);
      const subs = Array.isArray(rawSubs) ? rawSubs : (rawSubs?.data || []);
      if (subs && subs.length > 0) {
        // latest submission
        const latest = subs[0];
        setActiveSubmission(latest);
        loadSubmissionDetails(latest.id || latest._id);
      } else {
        setErrorMsg('No submissions found for this work item.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load submission');
      setLoading(false);
    }
  };

  // Load complete details for a single submission
  const loadSubmissionDetails = async (submissionId: string) => {
    try {
      setLoading(true);
      const rawSub = await apiFetch<any>(`/api/submissions/${submissionId}`);
      const sub = rawSub?.data || rawSub;
      setActiveSubmission(sub);

      // Comments
      let rawComments = sub.comments || [];
      const workId = sub.workItemId?._id || sub.workItemId?.id || sub.workItemId;

      if (!rawComments.length && workId) {
        try {
          const fetchedWorkComments = await apiFetch<any>(`/api/work-items/${workId}/comments`);
          const commentsData = Array.isArray(fetchedWorkComments)
            ? fetchedWorkComments
            : (fetchedWorkComments?.data || []);
          if (Array.isArray(commentsData) && commentsData.length > 0) {
            rawComments = commentsData;
          }
        } catch {
          // Fallback to submission comments
          try {
            const fetchedSubComments = await apiFetch<any>(`/api/submissions/${submissionId}/comments`);
            const subCommentsData = Array.isArray(fetchedSubComments)
              ? fetchedSubComments
              : (fetchedSubComments?.data || []);
            if (Array.isArray(subCommentsData) && subCommentsData.length > 0) {
              rawComments = subCommentsData;
            }
          } catch {
            // ignore
          }
        }
      }

      setComments(
        rawComments.map((c: any) => ({
          id: c._id || c.id,
          author: {
            id: c.authorId?._id || c.authorId?.id || c.authorId || 'anon',
            name: c.authorId?.name || (typeof c.authorName === 'string' ? c.authorName : 'Reviewer'),
            avatar: c.authorId?.avatar,
            role: c.authorId?.role || c.authorRole,
          },
          content: c.content || c.text || '',
          createdAt: c.createdAt,
          anchor: {
            ...c.anchor,
            timecode: c.anchor?.timecode ?? c.anchor?.seconds,
          },
          resolved: !!c.resolved,
        }))
      );

      // Fetch all versions for this work item
      if (workId) {
        const rawVersions = await apiFetch<any>(`/api/submissions?workItemId=${workId}`);
        const allVersions = Array.isArray(rawVersions) ? rawVersions : (rawVersions?.data || []);
        const formattedVersions = (allVersions || []).map((v: any) => ({
          id: v._id || v.id,
          versionNumber: v.versionNumber || v.version || 1,
          submittedAt: v.submittedAt,
          status: v.status,
          submittedBy: v.submittedBy,
        }));
        setVersionList(formattedVersions);

        // If there's an earlier version, grab its text for diffing
        if (formattedVersions.length > 1) {
          const currentVersion = sub.versionNumber || sub.version || 1;
          const prevVer = formattedVersions.find((v: any) => v.versionNumber === currentVersion - 1);
          if (prevVer) {
            const prevSub = await apiFetch<any>(`/api/submissions/${prevVer.id}`);
            if (prevSub?.textContent) {
              setDiffBaseText(prevSub.textContent);
            }
          }
        }

        // Fetch earlier outputs from the parent content piece
        const contentPieceId = sub.contentPieceId?._id || sub.contentPieceId?.id || sub.contentPieceId;
        if (contentPieceId) {
          try {
            const piece = await apiFetch<any>(`/api/content-pieces/${contentPieceId}`);
            if (piece?.workItems) {
              const previousWorkItems = piece.workItems.filter(
                (w: any) => (w._id || w.id) !== workId && w.status === 'Approved'
              );
              setEarlierOutputs(
                previousWorkItems.map((w: any) => ({
                  id: w._id || w.id,
                  stageName: w.stageKey || w.title,
                  workerName: w.ownerId?.name || 'Teammate',
                  fileUrl: w.deliverableUrl,
                  contentUrl: w.contentUrl,
                  textContent: w.finalText || w.textContent,
                  updatedAt: w.updatedAt,
                }))
              );
            }
          } catch {
            // non-critical
          }
        }
      }

      // Automatically determine the optimal viewer type
      detectViewerType(sub);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading submission details:', err);
      setErrorMsg(err?.message || 'Failed to load submission');
      setLoading(false);
    }
  };

  const detectViewerType = (sub: any) => {
    const firstFile = Array.isArray(sub.files) && sub.files.length > 0 ? sub.files[0] : null;
    const firstUrl = typeof firstFile === 'string' ? firstFile : firstFile?.url || '';
    const url = (sub.fileUrl || sub.contentUrl || firstUrl || '').toLowerCase();
    const mediaType = (
      sub.metadata?.mediaType ||
      sub.metadata?.fileType ||
      sub.deliverableType ||
      sub.kind ||
      firstFile?.mimeType ||
      ''
    ).toLowerCase();

    if (
      url.endsWith('.mp4') ||
      url.endsWith('.mov') ||
      url.endsWith('.webm') ||
      mediaType.includes('video')
    ) {
      setViewerType('video');
    } else if (
      url.endsWith('.png') ||
      url.endsWith('.jpg') ||
      url.endsWith('.jpeg') ||
      url.endsWith('.webp') ||
      url.endsWith('.gif') ||
      mediaType.includes('image') ||
      (sub.metadata?.carouselSlides && sub.metadata.carouselSlides.length > 0)
    ) {
      setViewerType('image');
    } else if (sub.contentUrl && (sub.contentUrl.startsWith('http://') || sub.contentUrl.startsWith('https://')) && !sub.textContent) {
      setViewerType('link');
    } else {
      setViewerType('document');
    }
  };

  // Auto-advance to next item
  const handleNextItem = useCallback(() => {
    if (queue.length === 0) return;
    const nextIdx = (queueIndex + 1) % queue.length;
    setQueueIndex(nextIdx);
    loadSubmissionDetails(queue[nextIdx].id);
  }, [queue, queueIndex]);

  const handlePrevItem = useCallback(() => {
    if (queue.length === 0) return;
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    setQueueIndex(prevIdx);
    loadSubmissionDetails(queue[prevIdx].id);
  }, [queue, queueIndex]);

  // Real-time live comments via socket
  useEffect(() => {
    const cleanup = on('comment:new', (incoming: any) => {
      const incomingWorkId = String(incoming.workItemId?._id || incoming.workItemId || '');
      const incomingSubId = String(incoming.submissionId?._id || incoming.submissionId || '');
      const currentWorkId = String(
        activeSubmission?.workItemId?._id ||
          activeSubmission?.workItemId?.id ||
          activeSubmission?.workItemId ||
          ''
      );
      const currentSubId = String(activeSubmission?._id || activeSubmission?.id || '');

      if (
        (incomingWorkId && currentWorkId && incomingWorkId === currentWorkId) ||
        (incomingSubId && currentSubId && incomingSubId === currentSubId)
      ) {
        setComments((prev) => {
          const commentId = incoming._id || incoming.id;
          if (prev.some((c) => c.id === commentId)) return prev;

          const formattedComment: ReviewComment = {
            id: commentId,
            author: {
              id: incoming.authorId?._id || incoming.authorId?.id || incoming.authorId || 'anon',
              name:
                incoming.authorId?.name ||
                (typeof incoming.authorName === 'string' ? incoming.authorName : 'Reviewer'),
              avatar: incoming.authorId?.avatar,
              role: incoming.authorId?.role || incoming.authorRole,
            },
            content: incoming.content || incoming.text || '',
            createdAt: incoming.createdAt || new Date().toISOString(),
            anchor: {
              ...incoming.anchor,
              timecode: incoming.anchor?.timecode ?? incoming.anchor?.seconds,
            },
            resolved: !!incoming.resolved,
          };
          return [...prev, formattedComment];
        });
      }
    });

    return cleanup;
  }, [on, activeSubmission]);

  // Comment Actions
  const handleAddTextComment = async (anchor: DocumentCommentAnchor, text: string) => {
    if (!activeSubmission) return;
    try {
      const res = await apiFetch<any>(`/api/submissions/${activeSubmission._id || activeSubmission.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          content: text,
          anchor: {
            type: 'text',
            range: {
              text: anchor.text,
            },
          },
        }),
      });
      const created = res?.data || res;
      // Append to comments
      const newComment: ReviewComment = {
        id: created._id || created.id,
        author: {
          id: user?.id || 'me',
          name: user?.name || 'Reviewer',
          role: user?.role,
        },
        content: text,
        createdAt: new Date().toISOString(),
        anchor: {
          type: 'text',
          text: anchor.text,
        },
      };
      setComments((prev) => [...prev, newComment]);
      setActiveCommentId(newComment.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to add comment');
    }
  };

  const handleAddVideoComment = async (timecode: number, text: string) => {
    if (!activeSubmission) return;
    try {
      const res = await apiFetch<any>(`/api/submissions/${activeSubmission._id || activeSubmission.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          content: text,
          anchor: {
            type: 'time',
            seconds: timecode,
            timecode,
          },
        }),
      });
      const created = res?.data || res;
      const newComment: ReviewComment = {
        id: created._id || created.id,
        author: {
          id: user?.id || 'me',
          name: user?.name || 'Reviewer',
          role: user?.role,
        },
        content: text,
        createdAt: new Date().toISOString(),
        anchor: {
          type: 'timecode',
          timecode,
        },
      };
      setComments((prev) => [...prev, newComment]);
      setActiveCommentId(newComment.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to add video comment');
    }
  };

  const handleAddPointComment = async (coords: ImageCommentAnchor, text: string) => {
    if (!activeSubmission) return;
    try {
      const res = await apiFetch<any>(`/api/submissions/${activeSubmission._id || activeSubmission.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          content: text,
          anchor: {
            type: 'point',
            x: coords.x,
            y: coords.y,
          },
        }),
      });
      const created = res?.data || res;
      const newComment: ReviewComment = {
        id: created._id || created.id,
        author: {
          id: user?.id || 'me',
          name: user?.name || 'Reviewer',
          role: user?.role,
        },
        content: text,
        createdAt: new Date().toISOString(),
        anchor: {
          type: 'point',
          coordinates: coords,
        },
      };
      setComments((prev) => [...prev, newComment]);
      setActiveCommentId(newComment.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to add point comment');
    }
  };

  const handleAddGeneralComment = async (text: string) => {
    if (!activeSubmission) return;
    try {
      const res = await apiFetch<any>(`/api/submissions/${activeSubmission._id || activeSubmission.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text, content: text }),
      });
      const created = res?.data || res;
      const newComment: ReviewComment = {
        id: created._id || created.id,
        author: {
          id: user?.id || 'me',
          name: user?.name || 'Reviewer',
          role: user?.role,
        },
        content: text,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => [...prev, newComment]);
      setActiveCommentId(newComment.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to add general comment');
    }
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    if (!activeSubmission) return;
    try {
      await apiFetch(
        `/api/submissions/comments/${commentId}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({ resolved }),
        }
      );
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved } : c))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to update comment status');
    }
  };

  // Decision Handlers
  const handleApprove = async (data: {
    rating: number;
    feedback?: string;
    tags?: string[];
    shareToTeamChat?: boolean;
  }) => {
    if (!activeSubmission) return;
    try {
      setIsSubmittingDecision(true);
      await apiFetch(`/api/submissions/${activeSubmission._id || activeSubmission.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          score: data.rating,
          feedback: data.feedback || '',
          tags: data.tags || [],
          alsoShareToTeamChat: !!data.shareToTeamChat,
        }),
      });

      // Remove from current queue and advance
      const subId = activeSubmission._id || activeSubmission.id;
      const remaining = queue.filter((item) => (item.id || (item as any)._id) !== subId);
      setQueue(remaining);

      if (remaining.length > 0) {
        const nextIndex = queueIndex >= remaining.length ? 0 : queueIndex;
        setQueueIndex(nextIndex);
        const nextSubId = remaining[nextIndex].id || (remaining[nextIndex] as any)._id;
        await loadSubmissionDetails(nextSubId);
      } else {
        setActiveSubmission(null);
      }
    } catch (err: any) {
      if (err?.statusCode === 409) await handleStaleDecision(err.message);
      else alert(err?.message || 'Approval failed');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  /** A 409 means this version can no longer be decided: say why, and reload the queue. */
  const handleStaleDecision = (message: string) => {
    setStaleNotice(`${message} The review queue has been refreshed.`);
    setDecisionResetKey((key) => key + 1);
    return fetchReviewQueue();
  };

  const handleRequestRevision = async (data: { note: string; rootCause: RootCause }) => {
    if (!activeSubmission) return;
    try {
      setIsSubmittingDecision(true);
      await apiFetch(`/api/submissions/${activeSubmission._id || activeSubmission.id}/request-revision`, {
        method: 'POST',
        body: JSON.stringify({
          comment: data.note,
          feedback: data.note,
          rootCause: data.rootCause,
        }),
      });

      // Remove from current queue and advance
      const subId = activeSubmission._id || activeSubmission.id;
      const remaining = queue.filter((item) => (item.id || (item as any)._id) !== subId);
      setQueue(remaining);

      if (remaining.length > 0) {
        const nextIndex = queueIndex >= remaining.length ? 0 : queueIndex;
        setQueueIndex(nextIndex);
        const nextSubId = remaining[nextIndex].id || (remaining[nextIndex] as any)._id;
        await loadSubmissionDetails(nextSubId);
      } else {
        setActiveSubmission(null);
      }
    } catch (err: any) {
      if (err?.statusCode === 409) await handleStaleDecision(err.message);
      else alert(err?.message || 'Request revision failed');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const currentQueueItem = queue[queueIndex];

  const isShootStage = Boolean(
    activeSubmission && (
      activeSubmission.stageKey === 'Shoot' ||
      activeSubmission.workItemId?.stageKey === 'Shoot' ||
      activeSubmission.workItemId?.step === 'Shoot' ||
      currentQueueItem?.workItemId?.stageKey === 'Shoot' ||
      currentQueueItem?.workItemId?.step === 'Shoot' ||
      (activeSubmission.metadata?.totalClips && activeSubmission.metadata?.totalClips > 0)
    )
  );

  const shootStageItemId =
    activeSubmission?.workItemId?._id ||
    activeSubmission?.workItemId?.id ||
    (typeof activeSubmission?.workItemId === 'string' ? activeSubmission?.workItemId : '') ||
    (currentQueueItem?.workItemId as any)?._id ||
    currentQueueItem?.workItemId?.id ||
    (typeof currentQueueItem?.workItemId === 'string' ? currentQueueItem?.workItemId : '') ||
    routeWorkItemId ||
    '';

  // Images for image viewer
  const imageGallery = useMemo(() => {
    if (!activeSubmission) return [];
    if (activeSubmission.metadata?.carouselSlides && Array.isArray(activeSubmission.metadata.carouselSlides)) {
      return activeSubmission.metadata.carouselSlides;
    }
    if (activeSubmission.files && activeSubmission.files.length > 0) {
      return activeSubmission.files.map((f: any) => (typeof f === 'string' ? f : f.url));
    }
    if (activeSubmission.fileUrl) {
      return [activeSubmission.fileUrl];
    }
    return [];
  }, [activeSubmission]);

  const currentUserId = (user?._id || user?.id || (user as any)?.userId)?.toString();
  const isApproved = activeSubmission?.status === 'approved';
  const ownerId = (
    activeSubmission?.submittedBy?._id ||
    activeSubmission?.submittedBy?.id ||
    activeSubmission?.submittedBy ||
    activeSubmission?.workItemId?.ownerId?._id ||
    activeSubmission?.workItemId?.ownerId?.id ||
    activeSubmission?.workItemId?.ownerId
  )?.toString();
  const isOwner = Boolean(ownerId && ownerId === currentUserId);
  // Same reviewer rule as the API: creative_head and admin decide, never on their own work.
  const isDecisionRole = user?.role === 'creative_head' || user?.role === 'admin';
  const canDecide = isDecisionRole && !isOwner;
  const canComment = isDecisionRole || isOwner;
  const isPrivileged = user?.role === 'admin' || user?.role === 'creative_head' || user?.role === 'sm_manager';
  const canShare = Boolean(isApproved && (isPrivileged || isOwner) && user?.role !== 'executive');

  const shareAssetType: 'finalCut' | 'designImages' | 'document' =
    viewerType === 'video' ? 'finalCut' :
    viewerType === 'image' ? 'designImages' :
    'document';

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header & Queue Bar */}
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-white/10 px-4 flex items-center justify-between z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide text-white">Review Studio</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
              Creative Head
            </span>
          </div>

          {/* Queue Navigation */}
          {queue.length > 0 && (
            <div className="flex items-center gap-1.5 ml-4 px-2 py-1 rounded-lg bg-slate-950/60 border border-white/10">
              <button
                onClick={handlePrevItem}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                title="Previous submission (shortcut: [)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-slate-300 px-1">
                {queueIndex + 1} of {queue.length}
              </span>
              <button
                onClick={handleNextItem}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                title="Next submission (shortcut: ])"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Current Deliverable Meta */}
        {currentQueueItem && (
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Waiting {currentQueueItem.waitingDays} day{currentQueueItem.waitingDays !== 1 ? 's' : ''}</span>
            </div>
            <div className="text-slate-300 font-medium">
              Step:{' '}
              <span className="text-indigo-400">
                {currentQueueItem.workItemId?.step || currentQueueItem.workItemId?.stageKey || 'Deliverable'}
              </span>
            </div>
            <div className="text-slate-300">
              Owner:{' '}
              <span className="font-semibold text-white">
                {currentQueueItem.workItemId?.ownerId?.name || 'Creator'}
              </span>
            </div>
          </div>
        )}

        {/* Viewer Switcher Tabs - only shown for general single-asset deliverables */}
        {!isShootStage && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setViewerType('document')}
              className={`p-1.5 rounded transition-all ${
                viewerType === 'document' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Document Viewer"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewerType('video')}
              className={`p-1.5 rounded transition-all ${
                viewerType === 'video' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Video Player"
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewerType('image')}
              className={`p-1.5 rounded transition-all ${
                viewerType === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Image / Carousel Viewer"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewerType('link')}
              className={`p-1.5 rounded transition-all ${
                viewerType === 'link' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="External Link Opener"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}

        {canShare && (
          <button
            onClick={() => setShowShareModal(true)}
            data-testid="review-share-to-chat-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-xs font-medium transition-all"
            title="Share approved output to chat"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share to chat</span>
          </button>
        )}
      </header>

      {staleNotice && (
        <div role="alert" className="status-tint status-waiting px-4 py-2.5 flex items-center justify-between gap-3 text-[13px] flex-shrink-0">
          <span>{staleNotice}</span>
          <button type="button" onClick={() => setStaleNotice(null)} className="font-semibold underline underline-offset-2 shrink-0 min-h-[44px] px-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Review Workspace Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !activeSubmission ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{errorMsg ? 'Notice' : 'All Caught Up!'}</h3>
            <p className="text-sm text-slate-400 max-w-sm mb-6">
              {errorMsg || 'There are no submissions waiting for review in the approval queue.'}
            </p>
            <button
              onClick={() => navigate('/feedback')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Back to Feedback Dashboard
            </button>
          </div>
        ) : isShootStage ? (
          <div className="flex-1 h-full overflow-hidden">
            <ShootReviewView
              key={`${shootStageItemId}-${decisionResetKey}`}
              stageItemId={shootStageItemId}
              workItemTitle={
                activeSubmission.workItemId?.title ||
                currentQueueItem?.workItemId?.title ||
                'Shoot Footage Review'
              }
              hideHeader={true}
              onStaleDecision={handleStaleDecision}
              readOnly={!canDecide}
              canSeeThreads={user?.role !== 'executive'}
              onFinishReview={async () => {
                const subId = activeSubmission._id || activeSubmission.id;
                const remaining = queue.filter((item) => (item.id || (item as any)._id) !== subId);
                setQueue(remaining);

                if (remaining.length > 0) {
                  const nextIndex = queueIndex >= remaining.length ? 0 : queueIndex;
                  setQueueIndex(nextIndex);
                  const nextSubId = remaining[nextIndex].id || (remaining[nextIndex] as any)._id;
                  await loadSubmissionDetails(nextSubId);
                } else {
                  setActiveSubmission(null);
                }
              }}
              onClose={() => navigate('/feedback')}
            />
          </div>
        ) : (
          <>
            {/* Left Viewer (~70% desktop width) */}
            <main className="flex-1 h-full overflow-hidden p-3 md:p-4 flex flex-col">
              {viewerType === 'document' && (
                <DocumentViewer
                  title={activeSubmission.workItemId?.title || 'Deliverable Document'}
                  content={activeSubmission.textContent || activeSubmission.document?.htmlSnapshot || activeSubmission.notes || ''}
                  versionNumber={activeSubmission.versionNumber || activeSubmission.version || 1}
                  comments={comments}
                  activeCommentId={activeCommentId}
                  onSelectComment={setActiveCommentId}
                  onAddTextComment={canComment ? handleAddTextComment : undefined}
                  isDiffMode={isDiffMode}
                  diffBaseContent={diffBaseText}
                />
              )}

              {viewerType === 'video' && (
                <VideoPlayerViewer
                  src={activeSubmission.files?.[0]?.url || activeSubmission.fileUrl || activeSubmission.contentUrl || ''}
                  title={activeSubmission.workItemId?.title || 'Video Deliverable'}
                  comments={comments}
                  activeCommentId={activeCommentId}
                  onSelectComment={setActiveCommentId}
                  onAddVideoComment={canComment ? handleAddVideoComment : undefined}
                />
              )}

              {viewerType === 'image' && (
                <ImageViewer
                  images={imageGallery}
                  comments={comments}
                  activeCommentId={activeCommentId}
                  onSelectComment={setActiveCommentId}
                  onAddPointComment={canComment ? handleAddPointComment : undefined}
                />
              )}

              {viewerType === 'link' && (
                <LinkOpenerViewer
                  url={activeSubmission.linkUrl || activeSubmission.contentUrl || activeSubmission.fileUrl || ''}
                  title={activeSubmission.workItemId?.title || 'External Deliverable'}
                  notes={activeSubmission.notes}
                />
              )}
            </main>

            {/* Right Context Panel (~30% desktop width) */}
            <aside className="w-full md:w-96 h-80 md:h-full flex-shrink-0">
              <ReviewStudioSidebar
                brief={activeSubmission.contentPieceId?.brief}
                earlierOutputs={earlierOutputs}
                versions={versionList}
                activeVersionId={activeSubmission._id || activeSubmission.id}
                onSelectVersion={loadSubmissionDetails}
                comments={comments}
                activeCommentId={activeCommentId}
                onSelectComment={setActiveCommentId}
                onResolveComment={handleResolveComment}
                onAddGeneralComment={handleAddGeneralComment}
                canComment={canComment}
                isDiffMode={isDiffMode}
                onToggleDiffMode={() => setIsDiffMode(!isDiffMode)}
              />
            </aside>
          </>
        )}
      </div>

      {/* Persistent Docked Decision Bar (only for non-shoot stages since ShootReviewView has its own dedicated review controls) */}
      {activeSubmission && !isShootStage && canDecide && (
        <DecisionBar
          key={`${activeSubmission._id || activeSubmission.id}-${decisionResetKey}`}
          hasComments={comments.length > 0}
          commentCount={comments.length}
          isSubmitting={isSubmittingDecision}
          onApprove={handleApprove}
          onRequestRevision={handleRequestRevision}
          onOpenCommentComposer={() => {
            // Can focus sidebar or trigger general comment
          }}
          onPrevItem={handlePrevItem}
          onNextItem={handleNextItem}
        />
      )}

      {showShareModal && activeSubmission && (
        <ShareToChatModal
          assetId={activeSubmission._id || activeSubmission.id || ''}
          assetType={shareAssetType}
          contentPieceId={
            (activeSubmission.contentPieceId as any)?._id ||
            (activeSubmission.contentPieceId as any)?.id ||
            activeSubmission.contentPieceId ||
            ''
          }
          contentPieceTitle={
            activeSubmission.contentPieceId?.title ||
            activeSubmission.workItemId?.title ||
            'Deliverable'
          }
          stageKey={activeSubmission.workItemId?.stageKey || activeSubmission.workItemId?.step || 'Review'}
          title={activeSubmission.workItemId?.title || 'Deliverable'}
          thumbnailUrl={activeSubmission.thumbnailUrl || activeSubmission.fileUrl}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};
