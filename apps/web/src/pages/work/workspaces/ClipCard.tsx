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
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Approved</span>
        </span>
      );
    }
    if (isReshootNeeded) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold animate-pulse">
          <AlertCircle className="w-3 h-3 text-rose-400" />
          <span>Reshoot needed</span>
        </span>
      );
    }
    if (isWaitingReview) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Waiting for review</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-white/10 text-[10px] font-medium">
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
      className={`group relative rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 backdrop-blur-xl ${
        isReshootNeeded
          ? 'bg-rose-950/20 border-2 border-rose-500/60 shadow-lg shadow-rose-900/20'
          : isSelected
          ? 'bg-slate-900/90 border-2 border-indigo-500 shadow-xl shadow-indigo-500/10'
          : 'bg-slate-900/60 border border-white/15 hover:border-white/30 hover:bg-slate-900/80 shadow-md'
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
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex flex-col gap-1.5 animate-fadeIn">
          <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider text-rose-300">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Reviewer Feedback</span>
            </span>
            <span className="text-[10px] lowercase font-normal opacity-75">Reshoot required</span>
          </div>
          <p className="italic text-xs text-rose-100">
            "{latestReviewMessage || clip.notes || 'Please reshoot this clip to meet visual criteria.'}"
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                replaceInputRef.current?.click();
              }}
              className="mt-1 min-h-[38px] px-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
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
              className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-1"
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
              className="flex-1 bg-white/10 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
            />
          ) : (
            <h3
              onDoubleClick={() => !isLocked && setIsEditingTitle(true)}
              className="text-sm font-semibold text-slate-100 truncate flex-1 hover:text-indigo-300 transition-colors"
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
            className={`p-1.5 rounded-lg transition-colors ${
              clip.favourite
                ? 'text-amber-400 hover:bg-amber-400/10'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <Star className={`w-4 h-4 ${clip.favourite ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Approved Lock indicator */}
          {isApproved && (
            <div
              title="Approved clips are locked and cannot be changed"
              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            >
              <Lock className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Unread Message Badge */}
          {(clip.unreadCount || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm animate-pulse">
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
          <Film className="w-10 h-10 text-slate-600" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

        {/* Play Icon Overlay */}
        <div className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

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
            className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider backdrop-blur-sm ${
              clip.orientationOk
                ? 'bg-emerald-500/80 text-emerald-100'
                : 'bg-amber-500/80 text-amber-100'
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
          <span className="text-[11px] text-slate-400 font-medium">Shot:</span>
          <select
            value={clip.shotRef || ''}
            disabled={isLocked}
            onChange={(e) => handleShotChange(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          >
            <option value="" className="bg-slate-900 text-slate-400">
              -- Unlinked --
            </option>
            {availableShots.map((shot, idx) => {
              const refVal = shot.shotRef || String(shot.sceneNumber ?? idx + 1);
              return (
                <option key={idx} value={refVal} className="bg-slate-900">
                  {refVal}: {shot.visual.substring(0, 24)}...
                </option>
              );
            })}
          </select>
        </div>

        {/* Take Counter Badge */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-0.5">
          <span className="text-[11px] text-slate-400">Take:</span>
          <span className="font-bold text-slate-200">{clip.take || 1}</span>
          {!isLocked && (
            <div className="flex items-center ml-1">
              <button
                type="button"
                onClick={(e) => handleTakeChange(-1, e)}
                className="px-1 text-slate-400 hover:text-white"
              >
                -
              </button>
              <button
                type="button"
                onClick={(e) => handleTakeChange(1, e)}
                className="px-1 text-slate-400 hover:text-white"
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
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                isTagged
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
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
          className="text-[11px] text-slate-400 italic line-clamp-1 cursor-pointer hover:text-slate-300"
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
            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNotes(false)}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNotesSubmit}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium rounded-lg"
            >
              Save Notes
            </button>
          </div>
        </div>
      )}

      {/* Card Actions Bottom Row */}
      {!isLocked && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              replaceInputRef.current?.click();
            }}
            className="min-h-[38px] px-3 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Replace file</span>
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete clip "${clip.title}"?`)) onDelete();
              }}
              className="min-h-[38px] px-2.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Share to Chat button for approved clips */}
      {canShare && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowShareModal(true);
            }}
            className="min-h-[38px] px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors font-medium"
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
