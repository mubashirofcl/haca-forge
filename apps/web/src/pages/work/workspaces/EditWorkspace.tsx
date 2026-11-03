import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  UploadCloud,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Video,
  Download,
  CheckSquare,
  Square,
  History,
  Link as LinkIcon,
  Send,
  MessageSquare,
  Clock,
  ExternalLink,
  Play,
  Eye,
  Share2,
} from 'lucide-react';
import { ResumableUploadTask } from '../../../lib/uploadManager';
import { VideoPlayer } from './VideoPlayer';
import { apiFetch } from '../../../lib/api';
import { useSocket } from '../../../hooks/useSocket';
import { useAuth } from '../../../context/AuthContext';
import { ShareToChatModal } from '../../chat/ShareToChatModal';

export interface FootageClip {
  id: string;
  name?: string;
  url: string;
  size?: number;
  duration?: number;
}

export interface RevisionComment {
  id: string;
  content: string;
  authorId?: string;
  authorName?: string;
  authorRole?: string;
  createdAt?: string;
  timecode?: number;
  resolved?: boolean;
}

export interface VersionItem {
  id: string;
  versionNumber: number;
  submittedAt: string;
  fileUrl?: string;
  status: string;
  notes?: string;
}

interface EditWorkspaceProps {
  workItem: {
    id: string;
    title: string;
    workType?: string; // e.g. 'Reel', 'Video', 'Explainer'
    stageKey?: string;
    status?: string;
    revisions?: number;
    deliverableUrl?: string;
    ownerId?: any;
    _id?: string;
    contentPieceId?: any;
  };
  scriptContent?: string;
  rawFootage?: FootageClip[];
  revisionComments?: RevisionComment[];
  versions?: VersionItem[];
  activeVideoUrl?: string;
  currentSubmission?: any;
  onSubmit: (data: {
    fileUrl: string;
    contentUrl?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }) => Promise<void>;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

const formatSeconds = (sec?: number) => {
  if (sec == null || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const EditWorkspace: React.FC<EditWorkspaceProps> = ({
  workItem,
  scriptContent: propScriptContent,
  rawFootage: propRawFootage,
  revisionComments: propRevisionComments,
  versions = [],
  activeVideoUrl: propActiveVideoUrl = '',
  currentSubmission = null,
  onSubmit,
  isSubmitting = false,
  readOnly = false,
}) => {
  let user: any = null;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {
    user = null;
  }
  const { on, isConnected } = useSocket();

  const scriptContent = propScriptContent || (workItem as any).scriptContent || '';
  const rawFootage =
    propRawFootage && propRawFootage.length > 0
      ? propRawFootage
      : ((workItem as any).rawFootageUrls || []).map((url: string, idx: number) => ({
          id: `raw-${idx}`,
          name: `Clip ${idx + 1}`,
          url,
        }));

  // Resolve best initial video URL
  const initialVideoUrl =
    propActiveVideoUrl ||
    currentSubmission?.fileUrl ||
    currentSubmission?.linkUrl ||
    (currentSubmission?.files && currentSubmission.files[0]?.url) ||
    versions[0]?.fileUrl ||
    workItem.deliverableUrl ||
    '';

  const [activeVideoUrl, setActiveVideoUrl] = useState<string>(initialVideoUrl);
  const [activeVersionNumber, setActiveVersionNumber] = useState<number>(
    versions[0]?.versionNumber || 1
  );

  const effectiveCutUrl =
    activeVideoUrl ||
    propActiveVideoUrl ||
    currentSubmission?.fileUrl ||
    currentSubmission?.linkUrl ||
    (currentSubmission?.files && currentSubmission.files[0]?.url) ||
    versions[0]?.fileUrl ||
    workItem.deliverableUrl ||
    '';
  const hasExistingCut = Boolean(effectiveCutUrl);

  // Tab state: default to 'cut' if a cut exists or if in read-only mode
  const [activeTab, setActiveTab] = useState<'cut' | 'upload' | 'footage' | 'script' | 'versions'>(
    hasExistingCut || readOnly ? 'cut' : 'upload'
  );

  // Sync prop changes
  useEffect(() => {
    if (propActiveVideoUrl && propActiveVideoUrl !== activeVideoUrl) {
      setActiveVideoUrl(propActiveVideoUrl);
    }
  }, [propActiveVideoUrl, activeVideoUrl]);

  // Auto-switch to 'cut' tab when video URL arrives asynchronously or readOnly is true
  useEffect(() => {
    if ((hasExistingCut || readOnly) && activeTab === 'upload') {
      setActiveTab('cut');
    }
  }, [hasExistingCut, readOnly]);

  const fallbackComments: RevisionComment[] =
    propRevisionComments && propRevisionComments.length > 0
      ? propRevisionComments
      : ((workItem as any).revisionComments || []).map((c: any) => ({
          id: c.id || c._id,
          content: c.content || c.text,
          timecode: c.anchor?.timecode ?? c.timecode,
          resolved: !!c.resolved,
        }));

  // Comments / Live Chat state
  const [comments, setComments] = useState<RevisionComment[]>(fallbackComments);
  const [chatInput, setChatInput] = useState<string>('');
  const [taggedTimecode, setTaggedTimecode] = useState<number | null>(null);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  const [checkedComments, setCheckedComments] = useState<Record<string, boolean>>(() => {
    const initialChecked: Record<string, boolean> = {};
    fallbackComments.forEach((c) => {
      if (c.resolved) initialChecked[c.id] = true;
    });
    return initialChecked;
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state for new/revised cut
  const [file, setFile] = useState<File | null>(null);
  const [uploadTask, setUploadTask] = useState<ResumableUploadTask | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ width?: number; height?: number; duration?: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Notes & Link fallback
  const [editNotes, setEditNotes] = useState<string>(currentSubmission?.notes || '');
  const [fallbackUrl, setFallbackUrl] = useState<string>('');
  const [showLinkFallback, setShowLinkFallback] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isReel = (workItem.workType || workItem.title || '').toLowerCase().includes('reel');
  const isRevisionRequested =
    (workItem.status === 'In Progress' && (workItem.revisions || 0) > 0) ||
    currentSubmission?.status === 'changes_requested' ||
    workItem.status === 'Feedback';

  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const currentUserId = (user?._id || user?.id || (user as any)?.userId)?.toString();
  const ownerId = (workItem.ownerId?._id || workItem.ownerId)?.toString();
  const isOwner = ownerId && ownerId === currentUserId;
  const isApproved = workItem.status === 'Approved' || currentSubmission?.status === 'approved';
  const canShare = isApproved && user && (['admin', 'creative_head', 'sm_manager'].includes(user.role) || isOwner);

  // Sync prop comments if updated from parent
  useEffect(() => {
    if (!propRevisionComments || propRevisionComments.length === 0) return;
    setComments((prev) => {
      if (
        prev.length === propRevisionComments.length &&
        prev.every((p, idx) => p.id === propRevisionComments[idx]?.id && p.content === propRevisionComments[idx]?.content)
      ) {
        return prev;
      }
      return propRevisionComments;
    });
    const initialChecked: Record<string, boolean> = {};
    propRevisionComments.forEach((c) => {
      if (c.resolved) initialChecked[c.id] = true;
    });
    setCheckedComments(initialChecked);
  }, [propRevisionComments]);

  // Real-time live comments via socket
  useEffect(() => {
    const cleanup = on('comment:new', (newComment: any) => {
      const incomingWorkId = String(newComment.workItemId?._id || newComment.workItemId || '');
      const currentWorkId = String(workItem.id || (workItem as any)._id || '');
      const matchWork = Boolean(incomingWorkId && currentWorkId && incomingWorkId === currentWorkId);

      const incomingSubId = String(newComment.submissionId?._id || newComment.submissionId || '');
      const currentSubId = String(currentSubmission?._id || currentSubmission?.id || '');
      const matchSub = Boolean(incomingSubId && currentSubId && incomingSubId === currentSubId);

      if (matchWork || matchSub) {
        setComments((prev) => {
          if (prev.some((c) => c.id === (newComment._id || newComment.id))) return prev;
          return [
            ...prev,
            {
              id: newComment._id || newComment.id,
              content: newComment.content || newComment.text,
              authorId: newComment.authorId?._id || newComment.authorId?.id,
              authorName: newComment.authorId?.name || 'Reviewer',
              authorRole: newComment.authorId?.role,
              createdAt: newComment.createdAt || new Date().toISOString(),
              timecode: newComment.anchor?.timecode ?? newComment.anchor?.seconds,
              resolved: !!newComment.resolved,
            },
          ];
        });

        // Scroll chat to bottom
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
        }, 100);
      }
    });

    return cleanup;
  }, [on, workItem.id, (workItem as any)._id, currentSubmission]);

  // Auto-scroll chat on mount and message update
  useEffect(() => {
    if (comments.length > 0) {
      chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [comments.length]);

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || isSendingChat) return;

    try {
      setIsSendingChat(true);
      const payload: any = {
        text,
        content: text,
      };

      if (taggedTimecode != null) {
        payload.anchor = {
          type: 'time',
          seconds: Math.round(taggedTimecode),
          timecode: Math.round(taggedTimecode),
        };
      }

      const res = await apiFetch<any>(`/api/work-items/${workItem.id}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const created = res?.data || res;
      const isReviewerUser = user?.role === 'creative_head' || user?.role === 'admin';
      const optimisticMsg: RevisionComment = {
        id: created._id || created.id || `local-${Date.now()}`,
        content: text,
        authorId: user?.id || user?._id,
        authorName: user?.name || (isReviewerUser ? 'Creative Head' : 'You (Editor)'),
        authorRole: user?.role || (isReviewerUser ? 'creative_head' : 'team_member'),
        createdAt: new Date().toISOString(),
        timecode: taggedTimecode != null ? Math.round(taggedTimecode) : undefined,
        resolved: false,
      };

      setComments((prev) => {
        if (prev.some((c) => c.id === optimisticMsg.id)) return prev;
        return [...prev, optimisticMsg];
      });

      setChatInput('');
      setTaggedTimecode(null);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      alert(err?.message || 'Failed to send message');
    } finally {
      setIsSendingChat(false);
    }
  };

  const toggleCheckComment = async (commentId: string) => {
    const nextVal = !checkedComments[commentId];
    setCheckedComments((prev) => ({
      ...prev,
      [commentId]: nextVal,
    }));

    // If resolving on server
    try {
      await apiFetch(`/api/work-items/${workItem.id}/comments/${commentId}/resolve`, {
        method: 'PATCH',
      }).catch(() => {});
    } catch {
      // non-critical
    }
  };

  const handleSeekToTime = (seconds?: number) => {
    if (seconds != null) {
      setSeekTarget(seconds);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setErrorMsg(null);
    setWarnings([]);

    const task = new ResumableUploadTask({
      file: selectedFile,
      workItemId: workItem.id,
      onProgress: (p) => setUploadProgress(p.percentage),
      onError: (err) => {
        setUploadStatus('error');
        setErrorMsg(err.message);
      },
      onComplete: (res) => {
        setUploadStatus('completed');
        setUploadedUrl(res.fileUrl);

        // Pre-flight checks on metadata
        const newWarnings: string[] = [];
        const width = res.metadata?.width;
        const height = res.metadata?.height;
        const duration = res.metadata?.duration;

        setVideoMeta({ width, height, duration });

        if (isReel) {
          if (width && height) {
            const ratio = width / height;
            if (ratio > 0.65 || ratio < 0.5) {
              newWarnings.push(
                `Warning: Reel is not 9:16 vertical format (detected ${width}x${height}).`
              );
            }
          }
          if (duration && duration > 90) {
            newWarnings.push(
              `Warning: Reel duration (${Math.round(duration)}s) exceeds 90 seconds.`
            );
          }
        }

        setWarnings(newWarnings);
      },
    });

    setUploadTask(task);
    setUploadStatus('uploading');
    task.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = uploadedUrl || fallbackUrl.trim();
    if (!finalUrl) {
      setErrorMsg('Please upload a video cut or provide an external preview link.');
      return;
    }
    if (uploadStatus === 'uploading') {
      setErrorMsg('Please wait for the video cut upload to finish.');
      return;
    }

    setErrorMsg(null);
    await onSubmit({
      fileUrl: finalUrl,
      contentUrl: fallbackUrl.trim() || finalUrl,
      notes: editNotes.trim(),
      metadata: {
        mediaType: 'video',
        duration: videoMeta?.duration,
        width: videoMeta?.width,
        height: videoMeta?.height,
        resolvedChecklist: checkedComments,
        warningsAcknowledged: warnings,
      },
    });
  };

  const currentCutVersion = activeVersionNumber || (versions[0]?.versionNumber || 1);
  const nextCutVersion = (versions[0]?.versionNumber || 0) + 1;

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Workspace Header */}
      <div className="px-5 py-3.5 bg-slate-900/90 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {workItem.title}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium">
              Edit Workspace
            </span>
            {isReel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                Reel Format (9:16, &le;90s)
              </span>
            )}
            {isRevisionRequested && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                Revision Requested (Round #{workItem.revisions || 1})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Review your master cut, discuss live notes with Creative Head, and submit revised cuts.
          </p>
        </div>

        {/* Real-time sync badge & actions */}
        <div className="flex items-center gap-2 text-xs">
          {canShare && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              title="Share approved cut to chat"
              data-testid="edit-share-to-chat-btn"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to chat</span>
            </button>
          )}
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-white/10 text-slate-300 font-mono text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-500'
              }`}
            />
            {isConnected ? 'Live Chat Sync' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-4 pt-2 border-b border-white/10 gap-2 bg-slate-900/40 overflow-x-auto">
        <button
          onClick={() => setActiveTab('cut')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap min-h-[44px] ${
            activeTab === 'cut'
              ? 'bg-slate-950 text-violet-400 border-t-2 border-violet-500'
              : 'text-slate-400 hover:text-white'
          }`}
          aria-label="Master Cut Upload & Live Chat"
        >
          <Film className="w-4 h-4" />
          <span>Master Cut & Live Chat</span>
          {comments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-violet-500/30 text-violet-200 text-[10px] font-mono">
              {comments.length}
            </span>
          )}
        </button>

        {!readOnly && (
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap min-h-[44px] ${
              activeTab === 'upload'
                ? 'bg-slate-950 text-violet-400 border-t-2 border-violet-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Cut (v{nextCutVersion})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('footage')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap min-h-[44px] ${
            activeTab === 'footage'
              ? 'bg-slate-950 text-violet-400 border-t-2 border-violet-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Raw Footage ({rawFootage.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('script')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap min-h-[44px] ${
            activeTab === 'script'
              ? 'bg-slate-950 text-violet-400 border-t-2 border-violet-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Approved Script</span>
        </button>

        <button
          onClick={() => setActiveTab('versions')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap min-h-[44px] ${
            activeTab === 'versions'
              ? 'bg-slate-950 text-violet-400 border-t-2 border-violet-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Version History ({versions.length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-white font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: MASTER CUT & LIVE CHAT */}
        {activeTab === 'cut' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Revision Banner if Revision Requested */}
            {isRevisionRequested && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Revision Requested by Creative Head (Round #{workItem.revisions || 1})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30 font-semibold">
                        Action Required
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Creative Head requested changes on this cut. Review the feedback and timestamped notes in the Live Discussion panel on the right, make your adjustments, and upload the revised cut below.
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-transform whitespace-nowrap"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Revised Cut</span>
                  </button>
                )}
              </div>
            )}

            {/* Video Player + Live Chat Two-Column Workspace */}
            {effectiveCutUrl ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Video Player (~60% on desktop) */}
                <div className="lg:col-span-7 bg-slate-900/80 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3.5 shadow-xl">
                  {/* Player Top Meta Bar */}
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        Master Cut v{currentCutVersion}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono">
                        Active Submission
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={effectiveCutUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 transition-colors"
                        title="Download Video File"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Cut</span>
                      </a>
                      <a
                        href={effectiveCutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 transition-colors"
                        title="Open in new window"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Video Player Component */}
                  <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center min-h-[360px] max-h-[560px] relative border border-white/5">
                    <VideoPlayer
                      url={effectiveCutUrl}
                      seekToSeconds={seekTarget}
                      onTimeUpdate={setCurrentTime}
                      className="w-full h-full max-h-[560px]"
                    />
                  </div>

                  {/* Format & Current Time Info */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-white/10 text-[11px]">
                        Playback: {formatSeconds(currentTime)}
                      </span>
                      {isReel && (
                        <span className="text-[11px] text-amber-300/90 font-medium">
                          9:16 Vertical Reel
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTaggedTimecode(currentTime);
                        setChatInput((prev) => (prev ? `${prev} @${formatSeconds(currentTime)} ` : `@${formatSeconds(currentTime)} `));
                      }}
                      className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-500/10 hover:bg-violet-500/20 px-2 py-0.5 rounded border border-violet-500/20 transition-colors"
                      title="Insert current video timestamp into chat"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Tag current moment (@{formatSeconds(currentTime)})</span>
                    </button>
                  </div>
                </div>

                {/* Right: Live Chat & Feedback Discussion (~40% on desktop) */}
                <div className="lg:col-span-5 bg-slate-900/90 border border-white/10 rounded-2xl flex flex-col h-[600px] shadow-xl overflow-hidden">
                  {/* Chat Header */}
                  <div className="p-3.5 bg-slate-900 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-violet-400" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        Live Discussion & Feedback
                      </h3>
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                        {comments.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                        Live
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Messages Stream */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-950/40">
                    {comments.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                        <MessageSquare className="w-8 h-8 text-slate-600 mb-2 stroke-1" />
                        <p className="text-xs font-medium text-slate-300">No review comments yet</p>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                          Start the conversation with Creative Head below or tag specific moments in the video cut.
                        </p>
                      </div>
                    ) : (
                      comments.map((comment) => {
                        const authorIdStr = String(
                          (comment.authorId as any)?._id || (comment.authorId as any)?.id || comment.authorId || ''
                        );
                        const roleLower = String(comment.authorRole || '').toLowerCase();
                        const nameLower = String(comment.authorName || '').toLowerCase();
                        const ownerIdStr = String(
                          (workItem.ownerId as any)?._id || (workItem.ownerId as any)?.id || workItem.ownerId || ''
                        );

                        const isReviewer =
                          roleLower === 'creative_head' ||
                          roleLower === 'admin' ||
                          nameLower.includes('head') ||
                          nameLower.includes('creative') ||
                          nameLower.includes('reviewer') ||
                          nameLower.includes('manager') ||
                          (Boolean(ownerIdStr) && Boolean(authorIdStr) && authorIdStr !== ownerIdStr);
                        const isResolved = !!checkedComments[comment.id];

                        return (
                          <div
                            key={comment.id}
                            className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                              isReviewer
                                ? 'bg-purple-950/30 border-purple-500/30 text-purple-100'
                                : 'bg-slate-900/80 border-white/10 text-slate-200'
                            }`}
                          >
                            {/* Author & Timestamp */}
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">
                                  {comment.authorName || (isReviewer ? 'Creative Head' : 'Video Editor')}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase ${
                                    isReviewer
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                  }`}
                                >
                                  {isReviewer ? 'Creative Head' : 'Video Editor'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                                {comment.createdAt && (
                                  <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                              </div>
                            </div>

                            {/* Timecode badge if present */}
                            {comment.timecode != null && (
                              <button
                                type="button"
                                onClick={() => handleSeekToTime(comment.timecode)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-mono border border-amber-500/30 cursor-pointer transition-colors"
                                title="Click to seek player to this timecode"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                                <span>@{formatSeconds(comment.timecode)}</span>
                              </button>
                            )}

                            {/* Comment Text */}
                            <p className={`leading-relaxed text-xs ${isResolved ? 'line-through text-slate-500' : ''}`}>
                              {comment.content}
                            </p>

                            {/* Resolution checkbox if from reviewer */}
                            {isReviewer && (
                              <div className="pt-1 flex items-center justify-between border-t border-white/5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => toggleCheckComment(comment.id)}
                                  className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                                    isResolved ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {isResolved ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Addressed & Fixed</span>
                                    </>
                                  ) : (
                                    <>
                                      <Square className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Mark addressed</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input Bar */}
                  <form
                    onSubmit={handleSendChat}
                    className="p-3 bg-slate-900 border-t border-white/10 space-y-2"
                  >
                    {taggedTimecode != null && (
                      <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          Referencing moment: @{formatSeconds(taggedTimecode)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTaggedTimecode(null)}
                          className="text-amber-400 hover:text-white font-bold text-xs"
                        >
                          &times;
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={
                          user?.role === 'creative_head' || user?.role === 'admin'
                            ? 'Type review feedback or a message for the editor...'
                            : 'Type a message or response to Creative Head...'
                        }
                        className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />

                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isSendingChat}
                        className="px-3.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center transition-all cursor-pointer shadow-md"
                        title="Send message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              /* No video cut uploaded yet: Render initial upload form & revision checklist */
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Revision Checklist (if revision comments exist) */}
                {comments.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4" />
                        Revision Checklist (Tick off addressed feedback)
                      </h4>
                      <span className="text-[11px] font-mono text-amber-300 font-semibold">
                        {Object.values(checkedComments).filter(Boolean).length} of {comments.length} resolved
                      </span>
                    </div>
                    <div className="space-y-2">
                      {comments.map((comment) => {
                        const isChecked = !!checkedComments[comment.id];
                        return (
                          <div
                            key={comment.id}
                            onClick={() => toggleCheckComment(comment.id)}
                            className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-slate-300'
                                : 'bg-slate-900/80 border-white/10 text-slate-200'
                            }`}
                          >
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCheckComment(comment.id);
                              }}
                              className="mt-0.5 text-indigo-400"
                              aria-label={isChecked ? 'Mark pending' : 'Mark fixed'}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500" />
                              )}
                            </button>
                            <div className="text-xs">
                              {comment.timecode != null && (
                                <span className="font-mono text-amber-400 mr-1.5 font-bold">
                                  @{formatSeconds(comment.timecode)}
                                </span>
                              )}
                              <span className={isChecked ? 'line-through text-slate-500' : ''}>
                                {comment.content}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-white/20 hover:border-violet-500/60 rounded-2xl bg-white/5 hover:bg-white/[0.08] transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Upload Rendered Master Cut</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    MP4, MOV, or WebM up to 500 MB. Non-blocking reel aspect ratio & duration pre-flight checks.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {/* Active Upload Status */}
                {file && (
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white truncate">{file.name}</span>
                      <span className="text-slate-400 font-mono">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          uploadStatus === 'completed' ? 'bg-emerald-500' : 'bg-violet-500'
                        }`}
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {uploadStatus === 'completed' && (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" /> Upload complete & verified
                          </span>
                        )}
                        {uploadStatus === 'uploading' && (
                          <span className="flex items-center gap-2">
                            Uploading cut... {uploadProgress}%
                            <button
                              type="button"
                              onClick={() => {
                                uploadTask?.abort();
                                setUploadStatus('idle');
                                setFile(null);
                              }}
                              className="text-rose-400 hover:text-rose-300 underline text-[10px]"
                            >
                              Cancel
                            </button>
                          </span>
                        )}
                      </span>
                      {videoMeta?.duration && (
                        <span className="font-mono text-slate-300">
                          Duration: {Math.round(videoMeta.duration)}s |{' '}
                          {videoMeta.width}x{videoMeta.height}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Pre-Flight Non-Blocking Warning Banners */}
                {warnings.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Pre-Flight Creative Warnings (Non-Blocking)
                    </div>
                    {warnings.map((w, idx) => (
                      <p key={idx} className="pl-5 text-amber-200/90">
                        &bull; {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Edit Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Editor Notes (Audio mix, Color grading, Cut highlights)
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. Added background track at -18dB. Color graded with warm contrast."
                    className="w-full text-xs p-3 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                {/* Link Fallback */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowLinkFallback(!showLinkFallback)}
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    {showLinkFallback ? 'Hide Backup Frame.io / Drive Link' : '+ Add Backup Cloud Link'}
                  </button>

                  {showLinkFallback && (
                    <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <label className="text-xs text-slate-400">External Preview Link:</label>
                      <input
                        type="url"
                        value={fallbackUrl}
                        onChange={(e) => setFallbackUrl(e.target.value)}
                        placeholder="https://app.frame.io/player/..."
                        className="w-full text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-violet-500/25 flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmitting ? 'Submitting Cut...' : 'Submit for Approval'}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Upload Revised Cut Drawer below player */}
            {hasExistingCut && (
              <div
                ref={uploadSectionRef}
                className="mt-8 p-6 rounded-2xl bg-slate-900/70 border border-white/10 space-y-4"
              >
                {readOnly ? (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-violet-400" />
                      <span>
                        Deliverable is currently in <strong>{workItem.status || 'Feedback'}</strong> status.
                        New uploads are disabled while waiting for decision or review.
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <UploadCloud className="w-4 h-4 text-violet-400" />
                          Upload Revised Cut (Cut v{nextCutVersion})
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Upload your updated export after incorporating revision notes.
                        </p>
                      </div>
                    </div>

                    {/* Upload dropzone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 border-2 border-dashed border-white/20 hover:border-violet-500/60 rounded-xl bg-white/5 hover:bg-white/[0.08] transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-semibold text-white">
                        Select New Video Cut (MP4, MOV, WebM up to 500 MB)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Click or drag & drop file to replace or upload Cut v{nextCutVersion}
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>

                    {/* Active Upload Status */}
                    {file && (
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white truncate">{file.name}</span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {(file.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-200 ${
                              uploadStatus === 'completed' ? 'bg-emerald-500' : 'bg-violet-500'
                            }`}
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            {uploadStatus === 'completed' && (
                              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" /> Upload complete & verified
                              </span>
                            )}
                            {uploadStatus === 'uploading' && (
                              <span className="flex items-center gap-2">
                                Uploading cut... {uploadProgress}%
                                <button
                                  type="button"
                                  onClick={() => {
                                    uploadTask?.abort();
                                    setUploadStatus('idle');
                                    setFile(null);
                                  }}
                                  className="text-rose-400 hover:text-rose-300 underline text-[10px]"
                                >
                                  Cancel
                                </button>
                              </span>
                            )}
                          </span>
                          {videoMeta?.duration && (
                            <span className="font-mono text-slate-300">
                              {Math.round(videoMeta.duration)}s | {videoMeta.width}x{videoMeta.height}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes & Submit */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Revision Notes (What did you adjust in this cut?)
                      </label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={2}
                        placeholder="e.g. Adjusted pacing at 0:14, cleaned audio noise, refined color grade."
                        className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={isSubmitting || (!uploadedUrl && !fallbackUrl.trim())}
                        onClick={handleSubmit}
                        className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        {isSubmitting ? 'Submitting Revised Cut...' : `Submit Cut v${nextCutVersion} for Approval`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPLOAD (DEDICATED FULL TAB) */}
        {activeTab === 'upload' && (
          readOnly ? (
            <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-slate-900/80 border border-white/10 text-center space-y-3">
              <Clock className="w-8 h-8 text-violet-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Uploads Disabled in Read-Only Mode</h3>
              <p className="text-xs text-slate-400">
                This item is currently in {workItem.status || 'review'}. Switch to Master Cut & Live Chat to review feedback.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('cut')}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs"
              >
                Go to Master Cut & Live Chat
              </button>
            </div>
          ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Revision Checklist (if revision comments exist) */}
            {comments.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" />
                    Revision Checklist (Tick off addressed feedback)
                  </h4>
                  <span className="text-[11px] font-mono text-amber-300 font-semibold">
                    {Object.values(checkedComments).filter(Boolean).length} of {comments.length} resolved
                  </span>
                </div>
                <div className="space-y-2">
                  {comments.map((comment) => {
                    const isChecked = !!checkedComments[comment.id];
                    return (
                      <div
                        key={comment.id}
                        onClick={() => toggleCheckComment(comment.id)}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-slate-300'
                            : 'bg-slate-900/80 border-white/10 text-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          className="mt-0.5 text-indigo-400"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <div className="text-xs">
                          {comment.timecode != null && (
                            <span className="font-mono text-amber-400 mr-1.5 font-bold">
                              @{formatSeconds(comment.timecode)}
                            </span>
                          )}
                          <span className={isChecked ? 'line-through text-slate-500' : ''}>
                            {comment.content}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-white/20 hover:border-violet-500/60 rounded-2xl bg-white/5 hover:bg-white/[0.08] transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-white">Upload Rendered Master Cut</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                MP4, MOV, or WebM up to 500 MB. Non-blocking reel aspect ratio & duration pre-flight checks.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Active Upload Status */}
            {file && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white truncate">{file.name}</span>
                  <span className="text-slate-400 font-mono">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      uploadStatus === 'completed' ? 'bg-emerald-500' : 'bg-violet-500'
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {uploadStatus === 'completed' && (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> Upload complete & verified
                      </span>
                    )}
                    {uploadStatus === 'uploading' && (
                      <span className="flex items-center gap-2">
                        Uploading cut... {uploadProgress}%
                        <button
                          type="button"
                          onClick={() => {
                            uploadTask?.abort();
                            setUploadStatus('idle');
                            setFile(null);
                          }}
                          className="text-rose-400 hover:text-rose-300 underline text-[10px]"
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                  </span>
                  {videoMeta?.duration && (
                    <span className="font-mono text-slate-300">
                      Duration: {Math.round(videoMeta.duration)}s |{' '}
                      {videoMeta.width}x{videoMeta.height}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Pre-Flight Non-Blocking Warning Banners */}
            {warnings.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Pre-Flight Creative Warnings (Non-Blocking)
                </div>
                {warnings.map((w, idx) => (
                  <p key={idx} className="pl-5 text-amber-200/90">
                    &bull; {w}
                  </p>
                ))}
              </div>
            )}

            {/* Edit Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Editor Notes (Audio mix, Color grading, Cut highlights)
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Added background track at -18dB. Color graded with warm contrast."
                className="w-full text-xs p-3 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {/* Link Fallback */}
            <div>
              <button
                type="button"
                onClick={() => setShowLinkFallback(!showLinkFallback)}
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                {showLinkFallback ? 'Hide Backup Frame.io / Drive Link' : '+ Add Backup Cloud Link'}
              </button>

              {showLinkFallback && (
                <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <label className="text-xs text-slate-400">External Preview Link:</label>
                  <input
                    type="url"
                    value={fallbackUrl}
                    onChange={(e) => setFallbackUrl(e.target.value)}
                    placeholder="https://app.frame.io/player/..."
                    className="w-full text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-violet-500/25 flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Submitting Cut...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        )
      )}

        {/* TAB 3: RAW FOOTAGE (Read-only) */}
        {activeTab === 'footage' && (
          <div className="max-w-3xl mx-auto space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
              Approved Footage Packages
            </h3>
            {rawFootage.length === 0 ? (
              <p className="text-xs text-slate-500">No raw footage clips attached.</p>
            ) : (
              rawFootage.map((clip: any, idx: number) => (
                <div
                  key={clip.id || idx}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Video className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <span className="font-semibold text-white truncate">
                      {clip.name || `Footage Clip #${idx + 1}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVideoUrl(clip.url);
                        setActiveTab('cut');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 flex items-center gap-1.5 transition-colors"
                      title="Load clip in player"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <a
                      href={clip.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: SCRIPT (Read-only) */}
        {activeTab === 'script' && (
          <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Approved Script
            </h3>
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-4 rounded-xl border border-white/5">
              {scriptContent || 'No script available.'}
            </div>
          </div>
        )}

        {/* TAB 5: PAST VERSIONS */}
        {activeTab === 'versions' && (
          <div className="max-w-3xl mx-auto space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
              Cut Version History
            </h3>
            {versions.length === 0 ? (
              <p className="text-xs text-slate-500">No past versions submitted yet.</p>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">Cut v{v.versionNumber}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-mono">
                        {v.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      Submitted: {new Date(v.submittedAt).toLocaleString()}
                    </span>
                    {v.notes && (
                      <p className="text-[11px] text-slate-400 italic">
                        Notes: "{v.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {v.fileUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVideoUrl(v.fileUrl!);
                          setActiveVersionNumber(v.versionNumber);
                          setActiveTab('cut');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch Cut v{v.versionNumber}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showShareModal && (
        <ShareToChatModal
          assetId={currentSubmission?._id || currentSubmission?.id || workItem._id || ''}
          assetType="finalCut"
          contentPieceId={(workItem.contentPieceId as any)?._id || (workItem.contentPieceId as any) || ''}
          contentPieceTitle={workItem.title}
          stageKey="Edit"
          title={workItem.title}
          thumbnailUrl={videoMeta ? undefined : undefined}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};
