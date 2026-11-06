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
    <div className="flex flex-col h-full glass-panel md:rounded-none md:border-y-0 md:border-r-0 text-ui-text">
      {/* Tab Navigation */}
      <div className="px-3 pt-3 pb-2 border-b border-ui-line">
      <div role="tablist" aria-label="Review details" className="ui-tabs w-full grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 rounded-ui-card">
        <button
          role="tab"
          aria-selected={activeTab === 'comments'}
          type="button"
          onClick={() => setActiveTab('comments')}
          className="ui-tab justify-center gap-1.5 px-2 text-xs"
        >
          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
          Comments ({comments.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'brief'}
          type="button"
          onClick={() => setActiveTab('brief')}
          className="ui-tab justify-center gap-1.5 px-2 text-xs"
        >
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          Brief
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'upstream'}
          type="button"
          onClick={() => setActiveTab('upstream')}
          className="ui-tab justify-center gap-1.5 px-2 text-xs"
        >
          <Layers className="w-3.5 h-3.5" aria-hidden="true" />
          Outputs ({earlierOutputs.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'versions'}
          type="button"
          onClick={() => setActiveTab('versions')}
          className="ui-tab justify-center gap-1.5 px-2 text-xs"
        >
          <History className="w-3.5 h-3.5" aria-hidden="true" />
          Versions ({versions.length})
        </button>
      </div>
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
                aria-label="Comment on this deliverable"
                rows={2}
                className="ui-input ui-textarea w-full"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!generalCommentText.trim()}
                  className="ui-btn ui-btn-primary h-11"
                >
                  Post Comment
                </button>
              </div>
            </form>}

            <div className="space-y-2">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-ui-muted text-xs">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
                  <p>No comments pinned yet.</p>
                  {canComment && (
                    <p className="text-[11px] mt-1 text-ui-muted">
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
                      className={`rounded-xl border transition-colors ${
                        isSelected
                          ? 'bg-white border-ui-ink outline outline-1 outline-ui-ink'
                          : 'bg-white/60 border-ui-line hover:bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onSelectComment(comment.id)}
                        className="block w-full text-left p-3 rounded-xl"
                      >
                      <span className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-ui-ink text-[10px] font-bold text-white flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <Avatar
                            url={typeof comment.author === 'object' ? (comment.author as any)?.avatarUrl : null}
                            name={typeof comment.author === 'string' ? comment.author : comment.author?.name || 'Reviewer'}
                            userId={typeof comment.author === 'object' ? (comment.author as any)?._id : undefined}
                            size="xs"
                          />
                          <span className="text-xs font-semibold text-ui-ink truncate">
                            {typeof comment.author === 'string'
                              ? comment.author
                              : comment.author?.name || 'Reviewer'}
                          </span>
                          {typeof comment.author === 'object' && comment.author?.role && (
                            <span
                              className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-white text-ui-text border border-ui-line shrink-0"
                            >
                              {comment.author.role === 'creative_head' || comment.author.role === 'admin'
                                ? 'Creative Head'
                                : 'Video Editor'}
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-ui-muted shrink-0">
                          {new Date(comment.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>

                      {/* Anchor badge */}
                      {comment.anchor && (
                        <span className="block mb-2">
                          {comment.anchor.type === 'timecode' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded status-chip status-waiting">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              {formatTimecode(comment.anchor.timecode)}
                            </span>
                          )}
                          {comment.anchor.type === 'point' && comment.anchor.coordinates && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded status-chip status-in-progress">
                              <MapPin className="w-3 h-3" aria-hidden="true" />
                              Pin ({comment.anchor.coordinates.x}%, {comment.anchor.coordinates.y}%)
                            </span>
                          )}
                          {comment.anchor.type === 'text' && comment.anchor.text && (
                            <span className="block text-[11px] italic text-ui-muted border-l-2 border-ui-ink pl-2 line-clamp-2 my-1">
                              "{comment.anchor.text}"
                            </span>
                          )}
                        </span>
                      )}

                      <span className="block text-xs text-ui-text whitespace-pre-wrap break-words">{comment.content}</span>
                      </button>

                      {onResolveComment && (
                        <div className="mx-3 pt-1 pb-1 border-t border-ui-line flex justify-end">
                          <button
                            type="button"
                            aria-pressed={Boolean(comment.resolved)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onResolveComment(comment.id, !comment.resolved);
                            }}
                            className={`text-[13px] font-medium flex items-center gap-1 min-h-[44px] px-3 rounded-full ${
                              comment.resolved
                                ? 'status-chip status-approved'
                                : 'text-ui-muted hover:text-ui-ink'
                            }`}
                          >
                            <Check className="w-3 h-3" aria-hidden="true" />
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
                  <h4 className="text-[13px] font-medium text-ui-muted mb-1">
                    Title & Objective
                  </h4>
                  <p className="text-sm font-bold text-ui-ink">{brief.title || 'Untitled Piece'}</p>
                  {brief.description && (
                    <p className="text-ui-text mt-1 whitespace-pre-wrap">{brief.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-2.5 rounded-lg bg-white/60">
                    <span className="text-ui-muted block text-[11px]">Channel</span>
                    <span className="font-semibold text-ui-ink">{brief.channel || 'General'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/60">
                    <span className="text-ui-muted block text-[11px]">Tone</span>
                    <span className="font-semibold text-ui-ink">{brief.tone || 'On Brand'}</span>
                  </div>
                </div>

                {brief.hookIdea && (
                  <div className="p-3 rounded-lg status-tint status-waiting">
                    <span className="font-bold block mb-1">Hook Angle:</span>
                    <p>{brief.hookIdea}</p>
                  </div>
                )}

                {brief.targetAudience && (
                  <div>
                    <span className="text-ui-muted block mb-1">Target Audience:</span>
                    <p className="text-ui-text">{brief.targetAudience}</p>
                  </div>
                )}

                {brief.references && brief.references.length > 0 && (
                  <div>
                    <span className="text-ui-muted block mb-1">Reference Links:</span>
                    <ul className="space-y-1">
                      {brief.references.map((refUrl, i) => (
                        <li key={i}>
                          <a
                            href={refUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ui-ink underline-offset-4 hover:underline flex items-center gap-1 truncate min-h-[44px]"
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
              <p className="text-ui-muted">No brief attached to this content item.</p>
            )}
          </div>
        )}

        {/* UPSTREAM OUTPUTS TAB */}
        {activeTab === 'upstream' && (
          <div className="space-y-3">
            {earlierOutputs.length === 0 ? (
              <p className="text-xs text-ui-muted">No earlier stage outputs found.</p>
            ) : (
              earlierOutputs.map((out) => (
                <div
                  key={out.id}
                  className="p-3 rounded-xl bg-white/60 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ui-ink">{out.stageName}</span>
                    <span className="text-[11px] text-ui-muted font-mono">
                      by {out.workerName}
                    </span>
                  </div>

                  {out.textContent && (
                    <div className="relative p-2 pr-12 rounded-lg bg-white max-h-36 overflow-y-auto">
                      <p className="text-ui-text text-[11px] whitespace-pre-wrap">
                        {out.textContent}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(out.textContent!)}
                        className="ui-icon-btn absolute top-0 right-0 border-transparent"
                        title="Copy text"
                        aria-label={copiedText ? 'Text copied' : 'Copy text'}
                      >
                        {copiedText ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}

                  {out.fileUrl && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-ui-muted truncate max-w-[180px]">Attached File</span>
                      <a
                        href={out.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ui-ink underline-offset-4 hover:underline inline-flex items-center gap-1 font-semibold min-h-[44px]"
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
              <div className="p-3 rounded-xl bg-white/60 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-ui-ink block">Version Compare Diff</span>
                  <span className="text-[11px] text-ui-muted">
                    Highlight additions & deletions
                  </span>
                </div>
                <button
                  type="button"
                  aria-pressed={Boolean(isDiffMode)}
                  onClick={onToggleDiffMode}
                  className={`ui-btn h-11 shrink-0 ${isDiffMode ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
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
                    type="button"
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => onSelectVersion(ver.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-white border-ui-ink text-ui-ink font-medium outline outline-1 outline-ui-ink'
                        : 'bg-white/60 border-ui-line text-ui-text hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">Version {ver.versionNumber}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/70 text-ui-text border border-ui-line">
                          {ver.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-ui-muted block mt-0.5">
                        {new Date(ver.submittedAt).toLocaleDateString()} by{' '}
                        {ver.submittedBy?.name || 'Creator'}
                      </span>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-ui-ink shrink-0" aria-hidden="true" />}
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
