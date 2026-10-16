import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Play,
  Pause,
  Clock,
  MessageSquare,
  Send,
  Columns,
  FileVideo,
  FileImage,
  FileText,
  ExternalLink,
  User,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { DeliverableType } from '@mmp/shared';

interface DeliverableItem {
  _id: string;
  version: number;
  type: DeliverableType;
  fileUrl?: string;
  externalLink?: string;
  thumbnail?: string;
  notes?: string;
  status: 'submitted' | 'approved' | 'changes_requested' | 'rejected';
  uploadedBy?: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  decidedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  decidedAt?: string;
  createdAt: string;
  taskId: {
    _id: string;
    taskId: string;
    title: string;
    stageKey: string;
    team: string;
    status: string;
    assignee?: {
      _id: string;
      name: string;
      email: string;
    };
    revisionCount?: number;
    dueDate?: string;
  };
  contentItemId: {
    _id: string;
    contentId: string;
    title: string;
    format: string;
    priority: string;
    status: string;
    publishDate?: string;
    productionDeadline?: string;
    requester?: {
      _id: string;
      name: string;
      email: string;
    };
    sourceDepartment?: {
      _id: string;
      name: string;
    };
  };
}

interface TimestampComment {
  _id?: string;
  text: string;
  mediaTimestamp?: number;
  author?: {
    _id: string;
    name: string;
    avatar?: string;
  };
  createdAt?: string;
}

export const LeadReviewQueuePage: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [formatFilter, setFormatFilter] = useState<string>('');
  const [selectedDeliverable, setSelectedDeliverable] = useState<DeliverableItem | null>(null);

  // Video Player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Comment at timestamp
  const [commentText, setCommentText] = useState('');
  const [capturedTimestamp, setCapturedTimestamp] = useState<number | null>(null);

  // Modals
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'changes_requested' | 'rejected'>('approved');
  const [decisionNotes, setDecisionNotes] = useState('');

  // Comparison view
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareV1, setCompareV1] = useState<DeliverableItem | null>(null);
  const [compareV2, setCompareV2] = useState<DeliverableItem | null>(null);

  // 1. Fetch Review Queue
  const { data: queueResponse, isLoading } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: async () => {
      const res = await fetch('/api/deliverables/queue');
      if (!res.ok) throw new Error('Failed to load review queue');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const allDeliverables: DeliverableItem[] = queueResponse?.data || [];

  // Filter deliverables
  const filteredDeliverables = allDeliverables.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (formatFilter && item.contentItemId?.format !== formatFilter) return false;
    return true;
  });

  // 2. Fetch all versions for the currently selected deliverable's task
  const { data: taskVersionsResponse } = useQuery({
    queryKey: ['taskDeliverables', selectedDeliverable?.taskId?._id],
    queryFn: async () => {
      if (!selectedDeliverable?.taskId?._id) return { data: [] };
      const res = await fetch(`/api/deliverables/task/${selectedDeliverable.taskId._id}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!selectedDeliverable?.taskId?._id,
  });

  const taskVersions: DeliverableItem[] = taskVersionsResponse?.data || [];

  // 3. Fetch comments for the selected deliverable
  const { data: deliverableCommentsResponse, refetch: refetchComments } = useQuery({
    queryKey: ['deliverableComments', selectedDeliverable?._id],
    queryFn: async () => {
      if (!selectedDeliverable?._id) return { data: [] };
      const res = await fetch(`/api/comments?entityType=deliverable&entityId=${selectedDeliverable._id}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!selectedDeliverable?._id,
  });

  const deliverableComments: TimestampComment[] = deliverableCommentsResponse?.data || [];

  // Review Decision Mutation
  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      notes,
      comments,
    }: {
      id: string;
      decision: 'approved' | 'changes_requested' | 'rejected';
      notes: string;
      comments?: Array<{ text: string; mediaTimestamp?: number }>;
    }) => {
      const res = await fetch(`/api/deliverables/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes, comments }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to submit review');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['taskDeliverables'] });
      queryClient.invalidateQueries({ queryKey: ['contentItems'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      setIsReviewModalOpen(false);
      setDecisionNotes('');
      setSelectedDeliverable(null);
    },
  });

  // Standalone comment mutation
  const postCommentMutation = useMutation({
    mutationFn: async (payload: { text: string; mediaTimestamp?: number; entityId: string }) => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'deliverable',
          entityId: payload.entityId,
          text: payload.text,
          mediaTimestamp: payload.mediaTimestamp,
        }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      refetchComments();
      setCommentText('');
      setCapturedTimestamp(null);
    },
  });

  // Video helper formatters
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const captureCurrentTime = () => {
    if (videoRef.current) {
      const t = Math.round(videoRef.current.currentTime * 10) / 10;
      setCapturedTimestamp(t);
    }
  };

  const handleAddStagedComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    if (selectedDeliverable) {
      postCommentMutation.mutate({
        entityId: selectedDeliverable._id,
        text: commentText.trim(),
        mediaTimestamp: capturedTimestamp !== null ? capturedTimestamp : undefined,
      });
    }
  };

  // Metrics
  const pendingCount = allDeliverables.filter((d) => d.status === 'submitted').length;
  const changesCount = allDeliverables.filter((d) => d.status === 'changes_requested').length;
  const approvedCount = allDeliverables.filter((d) => d.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Lead Review Studio</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
              Phase 7 Review & Verification
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Frame-accurate video verification, timestamped revisions, version diffing, and final gatekeeping.
          </p>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-2">
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700"
          >
            <option value="">All Formats</option>
            <option value="reel">Reels / Videos</option>
            <option value="ad_creative">Ad Creatives</option>
            <option value="story">Stories</option>
            <option value="static_post">Static Posts</option>
            <option value="carousel">Carousels</option>
          </select>

          <div className="flex items-center p-1 rounded-full glass-panel border border-white/80 shadow-xs">
            <button
              onClick={() => setStatusFilter('submitted')}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                statusFilter === 'submitted' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('changes_requested')}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                statusFilter === 'changes_requested' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Changes ({changesCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                statusFilter === 'approved' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                statusFilter === '' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* 2. Review Queue Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 py-20 text-center text-slate-400 text-xs">
            Loading review queue submissions...
          </div>
        ) : filteredDeliverables.length === 0 ? (
          <div className="col-span-3 py-20 text-center text-slate-400 text-xs glass-panel rounded-3xl p-12">
            No submissions in this queue view.
          </div>
        ) : (
          filteredDeliverables.map((item) => (
            <div
              key={item._id}
              onClick={() => setSelectedDeliverable(item)}
              className="glass-panel p-5 border border-white/90 rounded-3xl shadow-xs hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded">
                      {item.contentItemId?.contentId}
                    </span>
                    <span className="font-mono text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      v{item.version}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      item.status === 'submitted'
                        ? 'bg-amber-100 text-amber-800'
                        : item.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'changes_requested'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Media Preview Thumbnail */}
                <div className="relative aspect-video rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.contentItemId?.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : item.type === 'video' ? (
                    <FileVideo className="w-10 h-10 text-slate-600" />
                  ) : item.type === 'image' ? (
                    <FileImage className="w-10 h-10 text-slate-600" />
                  ) : (
                    <FileText className="w-10 h-10 text-slate-600" />
                  )}

                  <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-900 shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider">
                    {item.type}
                  </div>
                </div>

                {/* Content Title */}
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1 group-hover:text-violet-700 transition-colors">
                    {item.contentItemId?.title || item.taskId?.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Task: <b>{item.taskId?.title}</b> ({item.taskId?.team})
                  </p>
                </div>

                {/* Notes if present */}
                {item.notes && (
                  <p className="text-[11px] text-slate-600 italic line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    "{item.notes}"
                  </p>
                )}
              </div>

              {/* Footer info */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {item.uploadedBy?.name || item.taskId?.assignee?.name || 'Worker'}
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Interactive Review Studio Drawer / Modal */}
      {selectedDeliverable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-6xl h-[92vh] bg-white rounded-3xl border border-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedDeliverable(null)}
                  className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-violet-100 text-violet-800">
                      {selectedDeliverable.contentItemId?.contentId}
                    </span>
                    <span className="font-mono text-xs font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-white">
                      Version v{selectedDeliverable.version}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        selectedDeliverable.status === 'submitted'
                          ? 'bg-amber-100 text-amber-800'
                          : selectedDeliverable.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedDeliverable.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                    {selectedDeliverable.contentItemId?.title}
                  </h2>
                </div>
              </div>

              {/* Version Comparison Button & Quick Controls */}
              <div className="flex items-center gap-2">
                {taskVersions.length > 1 && (
                  <button
                    onClick={() => {
                      setCompareV1(taskVersions[0]);
                      setCompareV2(taskVersions[taskVersions.length - 1]);
                      setIsCompareModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800 text-xs font-bold transition-all"
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Compare Versions ({taskVersions.length})</span>
                  </button>
                )}

                {/* External link if available */}
                {selectedDeliverable.externalLink && (
                  <a
                    href={selectedDeliverable.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-full border border-slate-200 hover:bg-slate-100 text-slate-600"
                    title="Open external prototype link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Studio Workspace Body */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
              {/* Left 2 Cols: Media Player & Playback Controls */}
              <div className="lg:col-span-2 bg-slate-950 flex flex-col justify-between overflow-hidden relative">
                {/* Media Container */}
                <div className="flex-1 flex items-center justify-center p-4">
                  {selectedDeliverable.type === 'video' && selectedDeliverable.fileUrl ? (
                    <video
                      ref={videoRef}
                      src={selectedDeliverable.fileUrl}
                      className="max-h-[55vh] max-w-full rounded-2xl shadow-2xl object-contain bg-black"
                      onTimeUpdate={() => {
                        if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                      }}
                      onLoadedMetadata={() => {
                        if (videoRef.current) setDuration(videoRef.current.duration);
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      playsInline
                    />
                  ) : selectedDeliverable.type === 'image' && selectedDeliverable.fileUrl ? (
                    <img
                      src={selectedDeliverable.fileUrl}
                      alt="Deliverable asset"
                      className="max-h-[55vh] max-w-full rounded-2xl shadow-2xl object-contain"
                    />
                  ) : selectedDeliverable.externalLink ? (
                    <div className="text-center p-8 bg-slate-900 rounded-3xl border border-slate-800 space-y-4 max-w-md">
                      <ExternalLink className="w-12 h-12 text-violet-400 mx-auto" />
                      <div>
                        <h4 className="font-bold text-white text-sm">External Deliverable Attachment</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          This asset is hosted externally on Canva, Figma, Frame.io, or Google Drive.
                        </p>
                      </div>
                      <a
                        href={selectedDeliverable.externalLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs"
                      >
                        <span>Open In New Tab</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs">No media file attached to this deliverable.</div>
                  )}
                </div>

                {/* Video Transport Bar */}
                {selectedDeliverable.type === 'video' && selectedDeliverable.fileUrl && (
                  <div className="p-4 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur-md space-y-2">
                    {/* Scrubber slider */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        {formatTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.1}
                        value={currentTime}
                        onChange={(e) => handleSeek(parseFloat(e.target.value))}
                        className="flex-1 accent-violet-500 cursor-pointer"
                      />
                      <span className="font-mono text-xs font-bold text-slate-400">
                        {formatTime(duration)}
                      </span>
                    </div>

                    {/* Transport controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (isPlaying) videoRef.current.pause();
                              else videoRef.current.play();
                            }
                          }}
                          className="w-9 h-9 rounded-full bg-white text-slate-950 flex items-center justify-center hover:scale-105 transition-transform"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.muted = !isMuted;
                              setIsMuted(!isMuted);
                            }
                          }}
                          className="p-2 rounded-full text-slate-400 hover:text-white"
                        >
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={captureCurrentTime}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-300 text-xs font-bold transition-all"
                        >
                          <Clock className="w-3.5 h-3.5 text-violet-400" />
                          <span>Pin Note at {formatTime(currentTime)}</span>
                        </button>
                      </div>

                      {/* Versions Pill Switcher */}
                      <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-full border border-slate-700">
                        {taskVersions.map((v) => (
                          <button
                            key={v._id}
                            onClick={() => setSelectedDeliverable(v)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                              v._id === selectedDeliverable._id
                                ? 'bg-violet-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            v{v.version}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Col: Timestamp Comments & Gatekeeping Actions */}
              <div className="bg-white flex flex-col justify-between border-l border-slate-100 overflow-hidden">
                {/* Comments Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-violet-600" />
                    <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                      Timestamped Feedback ({deliverableComments.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Click note to seek</span>
                </div>

                {/* Comments List */}
                <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
                  {/* Version notes banner */}
                  {selectedDeliverable.notes && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Worker v{selectedDeliverable.version} Notes
                      </span>
                      <p className="text-slate-700">{selectedDeliverable.notes}</p>
                    </div>
                  )}

                  {deliverableComments.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs italic">
                      No timestamped comments yet. Play video, pause, and click "Pin Note" to add feedback.
                    </div>
                  ) : (
                    deliverableComments.map((comment) => (
                      <div
                        key={comment._id}
                        onClick={() => {
                          if (comment.mediaTimestamp !== undefined) handleSeek(comment.mediaTimestamp);
                        }}
                        className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-violet-300 hover:shadow-xs transition-all cursor-pointer space-y-1 group"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-slate-800">{comment.author?.name || 'Reviewer'}</span>
                          {comment.mediaTimestamp !== undefined && (
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                              {formatTime(comment.mediaTimestamp)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">{comment.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input Form */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
                  {capturedTimestamp !== null && (
                    <div className="flex items-center justify-between text-[11px] font-bold text-violet-700 bg-violet-100 px-3 py-1 rounded-xl">
                      <span>Pinned at: {formatTime(capturedTimestamp)}</span>
                      <button
                        onClick={() => setCapturedTimestamp(null)}
                        className="text-violet-500 hover:text-violet-900"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleAddStagedComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add timestamped note for editor..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs rounded-full bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full disabled:opacity-40 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                {/* Gatekeeper Decision Action Footer */}
                <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setReviewDecision('changes_requested');
                      setIsReviewModalOpen(true);
                    }}
                    disabled={selectedDeliverable.status === 'approved'}
                    className="flex-1 px-3 py-2 rounded-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Request Changes</span>
                  </button>

                  <button
                    onClick={() => {
                      setReviewDecision('approved');
                      setIsReviewModalOpen(true);
                    }}
                    disabled={selectedDeliverable.status === 'approved'}
                    className="flex-1 px-3 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Cut</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Decision Confirm Modal (Approve / Request Changes / Reject) */}
      {isReviewModalOpen && selectedDeliverable && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                {reviewDecision === 'approved' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Approve Deliverable v{selectedDeliverable.version}</span>
                  </>
                ) : reviewDecision === 'changes_requested' ? (
                  <>
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span>Request Changes (Increment Revision Counter)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Reject Deliverable</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {reviewDecision === 'approved'
                ? 'Approving this deliverable marks the task approved. If linked to an external requester, it routes to requester confirmation. If originating from the content calendar, it advances directly to the publishing queue.'
                : 'Requesting changes will increment the revision count and assign the task back to the worker with your timestamped notes.'}
            </p>

            <div>
              <label className="font-bold text-slate-700 text-[10px] uppercase tracking-wider block mb-1">
                Review Decision Summary Notes
              </label>
              <textarea
                rows={3}
                required={reviewDecision !== 'approved'}
                placeholder="Summary notes explaining this review decision..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewMutation.isPending}
                onClick={() => {
                  reviewMutation.mutate({
                    id: selectedDeliverable._id,
                    decision: reviewDecision,
                    notes: decisionNotes,
                  });
                }}
                className={`px-6 py-2 rounded-full text-white font-bold text-xs shadow-sm transition-all ${
                  reviewDecision === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {reviewMutation.isPending ? 'Submitting...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Side-by-Side Version Comparison Modal */}
      {isCompareModalOpen && compareV1 && compareV2 && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-7xl h-[92vh] bg-white rounded-3xl border border-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="font-mono text-[10px] font-black uppercase text-violet-700 tracking-wider">
                  Side-by-Side Comparison
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Version {compareV1.version} vs Version {compareV2.version}
                </h3>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Screen Media Players */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6 bg-slate-950 overflow-y-auto">
              {/* V1 Side */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between text-white text-xs font-bold px-2">
                  <span className="bg-slate-800 px-3 py-1 rounded-full">Version v{compareV1.version}</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(compareV1.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center p-2">
                  {compareV1.type === 'video' && compareV1.fileUrl ? (
                    <video
                      src={compareV1.fileUrl}
                      controls
                      className="max-h-[50vh] max-w-full rounded-xl object-contain"
                    />
                  ) : compareV1.fileUrl ? (
                    <img src={compareV1.fileUrl} alt="V1" className="max-h-[50vh] object-contain rounded-xl" />
                  ) : (
                    <div className="text-slate-500 text-xs">External Link / Asset</div>
                  )}
                </div>
                {compareV1.notes && (
                  <p className="text-xs text-slate-300 italic p-3 rounded-xl bg-slate-900 border border-slate-800">
                    "{compareV1.notes}"
                  </p>
                )}
              </div>

              {/* V2 Side */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between text-white text-xs font-bold px-2">
                  <span className="bg-violet-600 px-3 py-1 rounded-full">Version v{compareV2.version} (Updated)</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(compareV2.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center p-2">
                  {compareV2.type === 'video' && compareV2.fileUrl ? (
                    <video
                      src={compareV2.fileUrl}
                      controls
                      className="max-h-[50vh] max-w-full rounded-xl object-contain"
                    />
                  ) : compareV2.fileUrl ? (
                    <img src={compareV2.fileUrl} alt="V2" className="max-h-[50vh] object-contain rounded-xl" />
                  ) : (
                    <div className="text-slate-500 text-xs">External Link / Asset</div>
                  )}
                </div>
                {compareV2.notes && (
                  <p className="text-xs text-slate-300 italic p-3 rounded-xl bg-slate-900 border border-slate-800">
                    "{compareV2.notes}"
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
