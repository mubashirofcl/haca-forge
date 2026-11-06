import React, { useState } from 'react';
import {
  Play,
  Star,
  Trash2,
  RefreshCw,
  Lock,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  Clock,
  Film,
  MessageSquare,
  Share2,
} from 'lucide-react';
import { MediaItemType, getMediaItemStatusLabel } from '@mmp/shared';
import { useAuth } from '../../../context/AuthContext';
import { ShareToChatModal } from '../../chat/ShareToChatModal';

interface ClipCardProps {
  clip: MediaItemType;
  isSelected?: boolean;
  onSelect?: () => void;
  onUpdateMetadata?: (updates: Partial<MediaItemType>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onReplace?: (file: File) => Promise<void>;
  availableShots?: Array<{ sceneNumber?: number; visual: string; shotRef?: string }>;
  canEdit?: boolean;
  latestReviewMessage?: string;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const AVAILABLE_TAGS = ['A-roll', 'B-roll', 'Interview', 'Cutaway'];

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  isSelected = false,
  onSelect,
  onUpdateMetadata,
  onDelete,
  onReplace,
  availableShots = [],
  canEdit = true,
  latestReviewMessage,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(clip.title);
  const [showNotes, setShowNotes] = useState(false);
  const [notesInput, setNotesInput] = useState(clip.notes || '');

  const isApproved = clip.status === 'approved';
  const isReshootNeeded = clip.status === 'reshoot_needed';
  const isWaitingReview = clip.status === 'waiting_review';
  const isLocked = isApproved || !canEdit;

  const { user } = useAuth();
  const [showShareModal, setShowShareModal] = useState(false);
  const currentUserId = (user?._id || user?.id || (user as any)?.userId)?.toString();
  const uploadedById = ((clip as any).uploadedBy?._id || (clip as any).uploadedBy)?.toString();
  const isOwner = uploadedById && uploadedById === currentUserId;
  const canShare = isApproved && user && (['admin', 'creative_head', 'sm_manager'].includes(user.role) || isOwner);

  const replaceInputRef = React.useRef<HTMLInputElement>(null);

  const formatDuration = (secs?: number) => {
    if (!secs) return '0:00';
    const total = Math.floor(secs);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const handleTitleSubmit = async () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== clip.title && onUpdateMetadata) {
      await onUpdateMetadata({ title: titleInput.trim() });
    } else {
      setTitleInput(clip.title);
    }
  };

  const handleNotesSubmit = async () => {
    setShowNotes(false);
    if (notesInput !== clip.notes && onUpdateMetadata) {
      await onUpdateMetadata({ notes: notesInput.trim() });
    }
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked || !onUpdateMetadata) return;
    await onUpdateMetadata({ favourite: !clip.favourite });
  };

  const toggleTag = async (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked || !onUpdateMetadata) return;
    const currentTags = clip.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    await onUpdateMetadata({ tags: newTags });
  };

  const handleShotChange = async (shotRef: string) => {
    if (isLocked || !onUpdateMetadata) return;
    await onUpdateMetadata({ shotRef });
  };

  const handleTakeChange = async (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked || !onUpdateMetadata) return;
    const nextTake = Math.max(1, (clip.take || 1) + delta);
    await onUpdateMetadata({ take: nextTake });
  };

  const handleFileReplaced = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onReplace) {
      onReplace(e.target.files[0]);
    }
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  // Status chip styling
  const getStatusChip = () => {
    const label = getMediaItemStatusLabel(clip.status);
    if (isApproved) {
      return (
        <span className="status-tint status-approved inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold">
          <CheckCircle2 className="w-3 h-3 text-emerald-800" />
          <span>Approved</span>
        </span>
      );
    }
    if (isReshootNeeded) {
      return (
        <span className="status-tint status-changes inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold motion-safe:animate-pulse">
          <AlertCircle className="w-3 h-3 text-rose-800" />
          <span>Reshoot needed</span>
        </span>
      );
    }
    if (isWaitingReview) {
      return (
        <span className="status-tint status-waiting inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold">
          <Clock className="w-3 h-3 text-amber-800" />
          <span>Waiting for review</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/70 text-ui-text border border-ui-line text-[11px] font-medium">
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div
      draggable={!isLocked && Boolean(onDragStart)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={`group relative rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 ${
        isReshootNeeded
          ? 'status-tint status-changes border-2 border-ui-line shadow-lg'
          : isSelected
          ? 'bg-white/60 border-2 border-ui-ink'
          : 'bg-white/60 border border-ui-line hover:border-ui-line hover:bg-white shadow-md'
      }`}
    >
      <input
        ref={replaceInputRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={handleFileReplaced}
      />

      {/* Flagged Reviewer Message Banner on Top */}
      {isReshootNeeded && (
        <div className="status-tint status-changes p-3 rounded-xl border text-xs flex flex-col gap-1.5 animate-fadeIn">
          <div className="flex items-center justify-between font-bold text-[11px] text-rose-800">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-800" />
              <span>Reviewer Feedback</span>
            </span>
            <span className="text-[11px] lowercase font-normal opacity-75">Reshoot required</span>
          </div>
          <p className="italic text-xs text-rose-800">
            "{latestReviewMessage || clip.notes || 'Please reshoot this clip to meet visual criteria.'}"
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                replaceInputRef.current?.click();
              }}
              className="mt-1 min-h-[38px] px-3 rounded-full bg-ui-ink hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Replace This Clip</span>
            </button>
          )}
        </div>
      )}

      {/* Top Header Row: Drag handle, Title, Favourite, Lock */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isLocked && (
            <div
              className="text-ui-muted hover:text-ui-text cursor-grab active:cursor-grabbing p-1"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          {isEditingTitle && !isLocked ? (
            <input
              type="text"
              autoFocus
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              className="ui-input flex-1"
            />
          ) : (
            <h3
              onDoubleClick={() => !isLocked && setIsEditingTitle(true)}
              className="text-sm font-semibold text-ui-ink truncate flex-1 hover:text-ui-ink transition-colors"
              title="Double click to edit title"
            >
              {clip.title}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Favorite Star */}
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={isLocked}
            title={clip.favourite ? 'Remove from favourites' : 'Mark as favourite'}
            aria-label="Favourite"
            aria-pressed={Boolean(clip.favourite)}
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg transition-colors ${
              clip.favourite
                ? 'text-amber-800 hover:bg-white'
                : 'text-ui-muted hover:text-ui-text hover:bg-white'
            }`}
          >
            <Star className={`w-4 h-4 ${clip.favourite ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Approved Lock indicator */}
          {isApproved && (
            <div
              title="Approved clips are locked and cannot be changed"
              className="status-tint status-approved p-1.5 rounded-lg border"
            >
              <Lock className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Unread Message Badge */}
          {(clip.unreadCount || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-ui-ink text-white font-bold text-[11px] flex items-center gap-1 shadow-sm motion-safe:animate-pulse">
              <MessageSquare className="w-3 h-3" />
              <span>{clip.unreadCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Thumbnail + Video Details */}
      <div className="relative aspect-video rounded-xl bg-black/60 overflow-hidden border border-white/10 flex items-center justify-center">
        {clip.thumbnailUrl || clip.url ? (
          clip.kind === 'image' ? (
            <img
              src={clip.thumbnailUrl || clip.url}
              alt={clip.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={clip.url}
              poster={clip.thumbnailUrl}
              className="w-full h-full object-cover pointer-events-none"
            />
          )
        ) : (
          <Film className="w-10 h-10 text-ui-muted" />
        )}

        {/* Play overlay: a real button so the clip (player + discussion) opens from the keyboard too.
            The whole card stays clickable with the mouse, as before. */}
        {onSelect ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            aria-label={`Open ${clip.title}`}
            className="absolute inset-0 flex items-center justify-center focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-4 rounded-xl"
          >
            <span className="w-11 h-11 rounded-full bg-white border border-ui-line flex items-center justify-center text-ui-ink shadow-lg motion-safe:group-hover:scale-110 transition-transform" aria-hidden="true">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </span>
          </button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="w-11 h-11 rounded-full bg-white border border-ui-line flex items-center justify-center text-ui-ink shadow-lg">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </span>
          </div>
        )}

        {/* Badges on Thumbnail */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {getStatusChip()}
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-white/90 font-mono">
          <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
            {formatDuration(clip.durationSeconds)} • {formatSize(clip.sizeBytes)}
          </span>

          {/* 9:16 aspect ratio pill badge */}
          <span
            className={`px-2 py-0.5 rounded font-bold ${
              clip.orientationOk
                ? 'status-tint status-approved'
                : 'status-tint status-waiting'
            }`}
          >
            {clip.orientationOk ? '9:16 ✓' : 'Not 9:16'}
          </span>
        </div>
      </div>

      {/* Metadata Controls Row: Shot link & Take count */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        {/* Shot Checklist Link Dropdown */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
          <span className="text-[11px] text-ui-muted font-medium">Shot:</span>
          <select
            value={clip.shotRef || ''}
            disabled={isLocked}
            onChange={(e) => handleShotChange(e.target.value)}
            aria-label={`Shot for ${clip.title}`}
            className="ui-select flex-1"
          >
            <option value="">
              -- Unlinked --
            </option>
            {availableShots.map((shot, idx) => {
              const refVal = shot.shotRef || String(shot.sceneNumber ?? idx + 1);
              return (
                <option key={idx} value={refVal}>
                  {refVal}: {shot.visual.substring(0, 24)}...
                </option>
              );
            })}
          </select>
        </div>

        {/* Take Counter Badge */}
        <div className="flex items-center gap-1 bg-white/60 border border-ui-line rounded-lg px-2 py-0.5">
          <span className="text-[11px] text-ui-muted">Take:</span>
          <span className="font-bold text-ui-ink">{clip.take || 1}</span>
          {!isLocked && (
            <div className="flex items-center ml-1">
              <button
                type="button"
                onClick={(e) => handleTakeChange(-1, e)}
                className="px-1 text-ui-muted hover:text-ui-ink"
              >
                -
              </button>
              <button
                type="button"
                onClick={(e) => handleTakeChange(1, e)}
                className="px-1 text-ui-muted hover:text-ui-ink"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tags Pills Row: A-roll, B-roll, Interview, Cutaway */}
      <div className="flex flex-wrap items-center gap-1.5">
        {AVAILABLE_TAGS.map((tag) => {
          const isTagged = (clip.tags || []).includes(tag);
          return (
            <button
              key={tag}
              type="button"
              disabled={isLocked}
              onClick={(e) => toggleTag(tag, e)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                isTagged
                  ? 'bg-ui-ink text-white shadow-sm'
                  : 'bg-white/60 text-ui-muted hover:bg-white hover:text-ui-ink'
              } disabled:cursor-default`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Notes / Expandable comments */}
      {clip.notes && !showNotes && (
        <p
          onClick={(e) => {
            e.stopPropagation();
            if (!isLocked) setShowNotes(true);
          }}
          className="text-[11px] text-ui-muted italic line-clamp-1 cursor-pointer hover:text-ui-text"
        >
          Notes: {clip.notes}
        </p>
      )}

      {showNotes && !isLocked && (
        <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
          <textarea
            rows={2}
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Add notes for editor or reviewer..."
            className="ui-input ui-textarea w-full"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNotes(false)}
              className="text-[11px] text-ui-muted hover:text-ui-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNotesSubmit}
              className="px-3 py-1 bg-ui-ink hover:bg-black text-white text-[11px] font-medium rounded-lg"
            >
              Save Notes
            </button>
          </div>
        </div>
      )}

      {/* Card Actions Bottom Row */}
      {!isLocked && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-ui-line text-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              replaceInputRef.current?.click();
            }}
            className="min-h-[38px] px-3 rounded-lg hover:bg-white text-ui-text hover:text-ui-ink flex items-center gap-1.5 transition-colors font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5 text-ui-ink" />
            <span>Replace file</span>
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete clip "${clip.title}"?`)) onDelete();
              }}
              className="min-h-[38px] px-2.5 rounded-lg hover:bg-rose-500/20 text-ui-muted hover:text-rose-800 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Share to Chat button for approved clips */}
      {canShare && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-ui-line text-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowShareModal(true);
            }}
            className="status-tint status-approved min-h-[38px] px-3 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
            title="Share approved clip to chat"
            data-testid="share-clip-to-chat-btn"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share to chat</span>
          </button>
        </div>
      )}

      {showShareModal && (
        <ShareToChatModal
          assetId={clip._id || clip.id || ''}
          assetType="clip"
          contentPieceId={(clip.contentPieceId as any)?._id || clip.contentPieceId || ''}
          contentPieceTitle={clip.title || 'Approved Clip'}
          stageKey="Shoot"
          title={clip.title}
          thumbnailUrl={clip.thumbnailUrl}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};
