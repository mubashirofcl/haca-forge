import { useState, useRef } from 'react';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { Play, Download, Eye, AlertCircle, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { ChatSharedMediaCard } from '@mmp/shared';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { safeUrl } from '../../lib/safeUrl';

interface MediaCardPlayerProps {
  card: ChatSharedMediaCard;
  onRevoked?: (grantId: string) => void;
}

export function MediaCardPlayer({ card, onRevoked }: MediaCardPlayerProps) {
  const { user } = useAuth();
  const [showPlayer, setShowPlayer] = useState(false);
  // Player keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const playerRef = useRef<HTMLDivElement>(null);
  useDialogFocus(playerRef, showPlayer, () => setShowPlayer(false));
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
        className="mt-2 p-3 rounded-xl border border-dashed status-tint status-waiting flex items-center gap-2.5 text-xs font-medium"
        data-testid="shared-media-revoked"
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>This asset is no longer shared in this channel. Access was revoked.</span>
      </div>
    );
  }

  const isVideo = card.assetType === 'clip' || card.assetType === 'finalCut';
  const isImage = card.assetType === 'designImages';

  return (
    <div
      className="mt-2.5 rounded-ui-card border border-ui-line bg-white overflow-hidden shadow-ui-card max-w-sm sm:max-w-md"
      data-testid="shared-media-card"
    >
      {/* Header bar */}
      <div className="px-3.5 py-2 border-b border-ui-line flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="status-chip status-approved text-[11px] font-semibold px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
          <span className="text-xs font-medium text-ui-muted truncate">
            {card.contentPieceTitle} • {card.stageKey}
          </span>
        </div>

        {canUnshare && (
          <button
            type="button"
            onClick={handleUnshare}
            disabled={revoking}
            className="text-xs font-medium text-ui-muted hover:text-ui-ink hover:bg-white/70 px-2 min-h-[44px] rounded-lg transition-colors flex items-center gap-1"
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
                src={safeUrl(card.thumbnailUrl)}
                alt={card.title}
                className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
              />
            ) : (
              <div className="text-ui-muted text-xs font-medium flex flex-col items-center gap-1">
                <Play className="w-8 h-8 opacity-60" />
                <span>Video Deliverable</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowPlayer(true)}
              className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-ui-ink text-white flex items-center justify-center shadow-lg backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
              title="Play Video"
            >
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </button>
          </>
        ) : isImage ? (
          <img
            src={safeUrl(card.previewUrl) || safeUrl(card.thumbnailUrl)}
            alt={card.title}
            className="w-full h-full object-contain max-h-[220px]"
          />
        ) : (
          <div className="p-6 text-center text-slate-300 flex flex-col items-center gap-2">
            <FileText className="w-10 h-10 text-ui-muted" />
            <span className="text-xs font-medium">{card.title}</span>
          </div>
        )}
      </div>

      {/* Info & Actions */}
      <div className="p-3 bg-white space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-ui-ink truncate" title={card.title}>
              {card.title}
            </h4>
            <div className="flex items-center gap-1.5 mt-1">
              <Avatar
                url={card.owner?.avatarUrl}
                name={card.owner?.preferredName || card.owner?.name || 'Owner'}
                size="xs"
              />
              <span className="text-[11px] text-ui-muted truncate">
                {card.owner?.preferredName || card.owner?.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isVideo && (
              <button
                type="button"
                onClick={() => setShowPlayer(true)}
                className="ui-btn ui-btn-secondary h-11 px-3 text-xs gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                Watch
              </button>
            )}
            {safeUrl(card.downloadUrl) && (
              <a
                href={safeUrl(card.downloadUrl)}
                download
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white/70 hover:bg-white text-ui-ink flex items-center gap-1 transition-colors"
                title="Download asset"
              >
                <Download className="w-3.5 h-3.5" />
                Save
              </a>
            )}
          </div>
        </div>

        {card.note && (
          <p className="text-xs text-ui-muted bg-ui-canvas/50 p-2 rounded-lg italic">
            "{card.note}"
          </p>
        )}
      </div>

      {/* In-chat Modal Video Player */}
      {showPlayer && card.previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPlayer(false)}
        >
          <div
            ref={playerRef}
            role="dialog"
            aria-modal="true"
            aria-label={card.title}
            className="relative bg-black rounded-2xl overflow-hidden max-w-3xl w-full max-h-[85vh] shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-medium truncate">{card.title}</span>
              <button
                type="button"
                onClick={() => setShowPlayer(false)}
                aria-label="Close player"
                className="inline-flex items-center justify-center w-11 h-11 rounded-full text-white/80 hover:text-white hover:bg-white/10 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <video
                data-testid="inline-video-player"
                src={safeUrl(card.previewUrl)}
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

