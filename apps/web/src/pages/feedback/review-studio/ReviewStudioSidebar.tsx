import React, { useState } from 'react';
import {
  FileText,
  History,
  Layers,
  MessageSquare,
  Check,
  Clock,
  MapPin,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { ReviewComment } from './ImageViewer';
import { Avatar } from '../../../components/Avatar';

interface VersionItem {
  id: string;
  versionNumber: number;
  submittedAt: string;
  status?: string;
  submittedBy?: {
    name?: string;
  };
}

interface UpstreamOutput {
  id: string;
  stageName: string;
  workerName: string;
  fileUrl?: string;
  contentUrl?: string;
  textContent?: string;
  metadata?: Record<string, any>;
  updatedAt: string;
}

interface ReviewStudioSidebarProps {
  canComment?: boolean;
  brief?:
    | {
        title?: string;
        description?: string;
        channel?: string;
        targetAudience?: string;
        hookIdea?: string;
        tone?: string;
        references?: string[];
      }
    | string;
  earlierOutputs?: UpstreamOutput[];
  versions?: VersionItem[];
  activeVersionId: string;
  onSelectVersion: (versionId: string) => void;
  comments: ReviewComment[];
  activeCommentId?: string | null;
  onSelectComment: (commentId: string) => void;
  onResolveComment?: (commentId: string, resolved: boolean) => void;
  onAddGeneralComment?: (text: string) => void;
  isDiffMode?: boolean;
  onToggleDiffMode?: () => void;
}

export const ReviewStudioSidebar: React.FC<ReviewStudioSidebarProps> = ({
  brief: rawBrief,
  earlierOutputs = [],
  versions = [],
  activeVersionId,
  onSelectVersion,
  comments,
  activeCommentId,
  onSelectComment,
  onResolveComment,
  onAddGeneralComment,
  canComment = true,
  isDiffMode = false,
  onToggleDiffMode,
}) => {
  const brief =
    typeof rawBrief === 'string'
      ? { title: 'Content Brief', description: rawBrief }
      : rawBrief;

  const [activeTab, setActiveTab] = useState<'comments' | 'brief' | 'upstream' | 'versions'>('comments');
  const [generalCommentText, setGeneralCommentText] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  const formatTimecode = (seconds?: number) => {
    if (seconds === undefined || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalCommentText.trim()) return;
    onAddGeneralComment?.(generalCommentText.trim());
    setGeneralCommentText('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-xl border-l border-white/10 text-slate-200">
      {/* Tab Navigation */}
      <div role="tablist" className="flex items-center border-b border-white/10 px-2 py-2 gap-1 bg-slate-950/40">
        <button
          role="tab"
          aria-selected={activeTab === 'comments'}
          onClick={() => setActiveTab('comments')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'comments'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Comments ({comments.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'brief'}
          onClick={() => setActiveTab('brief')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'brief'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Brief
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'upstream'}
          onClick={() => setActiveTab('upstream')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'upstream'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Outputs ({earlierOutputs.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'versions'}
          onClick={() => setActiveTab('versions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'versions'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Versions ({versions.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* COMMENTS TAB */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Quick add comment form */}
            {canComment && <form onSubmit={handleAddComment} className="space-y-2">
              <textarea
                value={generalCommentText}
                onChange={(e) => setGeneralCommentText(e.target.value)}
                placeholder="Leave feedback on this deliverable... (shortcut: C)"
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!generalCommentText.trim()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs shadow-md transition-colors"
                >
                  Post Comment
                </button>
              </div>
            </form>}

            <div className="space-y-2">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No comments pinned yet.</p>
                  {canComment && (
                    <p className="text-[11px] mt-1 text-slate-600">
                      Select text in documents, click timeline in video, or click image to drop a pin.
                    </p>
                  )}
                </div>
              ) : (
                comments.map((comment, idx) => {
                  const isSelected = activeCommentId === comment.id;
                  return (
                    <div
                      key={comment.id}
                      onClick={() => onSelectComment(comment.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <Avatar
                            url={typeof comment.author === 'object' ? (comment.author as any)?.avatarUrl : null}
                            name={typeof comment.author === 'string' ? comment.author : comment.author?.name || 'Reviewer'}
                            userId={typeof comment.author === 'object' ? (comment.author as any)?._id : undefined}
                            size="xs"
                          />
                          <span className="text-xs font-semibold text-slate-200">
                            {typeof comment.author === 'string'
                              ? comment.author
                              : comment.author?.name || 'Reviewer'}
                          </span>
                          {typeof comment.author === 'object' && comment.author?.role && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase ${
                                comment.author.role === 'creative_head' || comment.author.role === 'admin'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              }`}
                            >
                              {comment.author.role === 'creative_head' || comment.author.role === 'admin'
                                ? 'Creative Head'
                                : 'Video Editor'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(comment.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Anchor badge */}
                      {comment.anchor && (
                        <div className="mb-2">
                          {comment.anchor.type === 'timecode' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              {formatTimecode(comment.anchor.timecode)}
                            </span>
                          )}
                          {comment.anchor.type === 'point' && comment.anchor.coordinates && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              <MapPin className="w-3 h-3" />
                              Pin ({comment.anchor.coordinates.x}%, {comment.anchor.coordinates.y}%)
                            </span>
                          )}
                          {comment.anchor.type === 'text' && comment.anchor.text && (
                            <div className="text-[11px] italic text-slate-400 border-l-2 border-indigo-500 pl-2 line-clamp-2 my-1">
                              "{comment.anchor.text}"
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-slate-300 whitespace-pre-wrap">{comment.content}</p>

                      {onResolveComment && (
                        <div className="mt-2.5 pt-2 border-t border-white/5 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResolveComment(comment.id, !comment.resolved);
                            }}
                            className={`text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded ${
                              comment.resolved
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            {comment.resolved ? 'Resolved' : 'Mark as resolved'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* BRIEF TAB */}
        {activeTab === 'brief' && (
          <div className="space-y-4 text-xs">
            {brief ? (
              <>
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Title & Objective
                  </h4>
                  <p className="text-sm font-bold text-white">{brief.title || 'Untitled Piece'}</p>
                  {brief.description && (
                    <p className="text-slate-300 mt-1 whitespace-pre-wrap">{brief.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase">Channel</span>
                    <span className="font-semibold text-slate-200">{brief.channel || 'General'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase">Tone</span>
                    <span className="font-semibold text-slate-200">{brief.tone || 'On Brand'}</span>
                  </div>
                </div>

                {brief.hookIdea && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">
                    <span className="font-bold block mb-1">Hook Angle:</span>
                    <p>{brief.hookIdea}</p>
                  </div>
                )}

                {brief.targetAudience && (
                  <div>
                    <span className="text-slate-400 block mb-1">Target Audience:</span>
                    <p className="text-slate-200">{brief.targetAudience}</p>
                  </div>
                )}

                {brief.references && brief.references.length > 0 && (
                  <div>
                    <span className="text-slate-400 block mb-1">Reference Links:</span>
                    <ul className="space-y-1">
                      {brief.references.map((refUrl, i) => (
                        <li key={i}>
                          <a
                            href={refUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            {refUrl}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-500">No brief attached to this content item.</p>
            )}
          </div>
        )}

        {/* UPSTREAM OUTPUTS TAB */}
        {activeTab === 'upstream' && (
          <div className="space-y-3">
            {earlierOutputs.length === 0 ? (
              <p className="text-xs text-slate-500">No earlier stage outputs found.</p>
            ) : (
              earlierOutputs.map((out) => (
                <div
                  key={out.id}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{out.stageName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      by {out.workerName}
                    </span>
                  </div>

                  {out.textContent && (
                    <div className="relative p-2 rounded-lg bg-slate-950/60 border border-white/5 max-h-36 overflow-y-auto">
                      <p className="text-slate-300 text-[11px] whitespace-pre-wrap">
                        {out.textContent}
                      </p>
                      <button
                        onClick={() => handleCopy(out.textContent!)}
                        className="absolute top-1.5 right-1.5 p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                        title="Copy text"
                      >
                        {copiedText ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}

                  {out.fileUrl && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400 truncate max-w-[180px]">Attached File</span>
                      <a
                        href={out.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View File
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* VERSIONS TAB */}
        {activeTab === 'versions' && (
          <div className="space-y-3">
            {onToggleDiffMode && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Version Compare Diff</span>
                  <span className="text-[10px] text-slate-400">
                    Highlight additions & deletions
                  </span>
                </div>
                <button
                  onClick={onToggleDiffMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isDiffMode
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {isDiffMode ? 'Diff Active' : 'Compare'}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {versions.map((ver) => {
                const isActive = activeVersionId === ver.id;
                return (
                  <button
                    key={ver.id}
                    onClick={() => onSelectVersion(ver.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium ring-1 ring-indigo-500/30'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">Version {ver.versionNumber}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-400">
                          {ver.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {new Date(ver.submittedAt).toLocaleDateString()} by{' '}
                        {ver.submittedBy?.name || 'Creator'}
                      </span>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
