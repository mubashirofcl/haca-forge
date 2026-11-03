import { useState } from 'react';
import { Play, Download, Eye, AlertCircle, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { ChatSharedMediaCard } from '@mmp/shared';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

interface MediaCardPlayerProps {
  card: ChatSharedMediaCard;
  onRevoked?: (grantId: string) => void;
}

export function MediaCardPlayer({ card, onRevoked }: MediaCardPlayerProps) {
  const { user } = useAuth();
  const [showPlayer, setShowPlayer] = useState(false);
  const [isRevoked, setIsRevoked] = useState(card.isRevoked || false);
  const [revoking, setRevoking] = useState(false);

  const currentUserId = (user?._id || user?.id || (user as any)?.userId)?.toString();
  const cardOwnerId = (card.owner?._id || (card.owner as any)?.id)?.toString();
  const canUnshare =
    user?.role === 'admin' ||
    user?.role === 'creative_head' ||
    (cardOwnerId && cardOwnerId === currentUserId);

  async function handleUnshare() {
    if (!card.grantId || revoking) return;
    if (!window.confirm('Are you sure you want to unshare this asset? Channel members will no longer be able to view or download it.')) {
      return;
    }
    try {
      setRevoking(true);
      await apiFetch(`/api/chat/share/${card.grantId}/revoke`, { method: 'POST' });
      setIsRevoked(true);
      if (onRevoked) onRevoked(card.grantId);
    } catch (err) {
      console.error('Failed to revoke share:', err);
    } finally {
      setRevoking(false);
    }
  }

  if (isRevoked) {
    return (
      <div
        className="mt-2 p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 text-amber-800 flex items-center gap-2.5 text-xs font-medium"
        data-testid="shared-media-revoked"
      >
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>This asset is no longer shared in this channel. Access was revoked.</span>
      </div>
    );
  }

  const isVideo = card.assetType === 'clip' || card.assetType === 'finalCut';
  const isImage = card.assetType === 'designImages';

  return (
    <div
      className="mt-2.5 rounded-2xl border border-slate-200/90 bg-white/95 overflow-hidden shadow-sm hover:shadow-md transition-shadow max-w-sm sm:max-w-md"
      data-testid="shared-media-card"
    >
      {/* Header bar */}
      <div className="px-3.5 py-2 bg-gradient-to-r from-emerald-500/10 via-slate-50 to-indigo-50/20 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
          <span className="text-xs font-medium text-slate-500 truncate">
            {card.contentPieceTitle} • {card.stageKey}
          </span>
        </div>

        {canUnshare && (
          <button
            type="button"
            onClick={handleUnshare}
            disabled={revoking}
            className="text-[11px] font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
            title="Unshare asset"
            data-testid="unshare-btn"
          >
            <Trash2 className="w-3 h-3" />
            <span>{revoking ? 'Unsharing...' : 'Unshare'}</span>
          </button>
        )}
      </div>

      {/* Media Preview Box */}
      <div className="relative bg-slate-900 flex items-center justify-center min-h-[160px] max-h-[220px] overflow-hidden group">
        {isVideo ? (
          <>
            {card.thumbnailUrl ? (
              <img
                src={card.thumbnailUrl}
                alt={card.title}
                className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
              />
            ) : (
              <div className="text-slate-400 text-xs font-medium flex flex-col items-center gap-1">
                <Play className="w-8 h-8 opacity-60" />
                <span>Video Deliverable</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowPlayer(true)}
              className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
              title="Play Video"
            >
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </button>
          </>
        ) : isImage ? (
          <img
            src={card.previewUrl || card.thumbnailUrl}
            alt={card.title}
            className="w-full h-full object-contain max-h-[220px]"
          />
        ) : (
          <div className="p-6 text-center text-slate-300 flex flex-col items-center gap-2">
            <FileText className="w-10 h-10 text-indigo-400" />
            <span className="text-xs font-medium">{card.title}</span>
          </div>
        )}
      </div>

      {/* Info & Actions */}
      <div className="p-3 bg-white space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-slate-900 truncate" title={card.title}>
              {card.title}
            </h4>
            <div className="flex items-center gap-1.5 mt-1">
              <Avatar
                url={card.owner?.avatarUrl}
                name={card.owner?.preferredName || card.owner?.name || 'Owner'}
                size="xs"
              />
              <span className="text-[11px] text-slate-500 truncate">
                {card.owner?.preferredName || card.owner?.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isVideo && (
              <button
                type="button"
                onClick={() => setShowPlayer(true)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Watch
              </button>
            )}
            {card.downloadUrl && (
              <a
                href={card.downloadUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1 transition-colors"
                title="Download asset"
              >
                <Download className="w-3.5 h-3.5" />
                Save
              </a>
            )}
          </div>
        </div>

        {card.note && (
          <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
            "{card.note}"
          </p>
        )}
      </div>

      {/* In-chat Modal Video Player */}
      {showPlayer && card.previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowPlayer(false)}
        >
          <div
            className="relative bg-black rounded-2xl overflow-hidden max-w-3xl w-full max-h-[85vh] shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-medium truncate">{card.title}</span>
              <button
                type="button"
                onClick={() => setShowPlayer(false)}
                className="text-slate-400 hover:text-white px-2 py-0.5 rounded text-sm"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <video
                data-testid="inline-video-player"
                src={card.previewUrl}
                controls
                autoPlay
                className="max-h-[75vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

