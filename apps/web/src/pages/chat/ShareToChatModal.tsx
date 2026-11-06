import { useState, useEffect, useRef } from 'react';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { Share2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ChatChannelTypeDetail } from '@mmp/shared';

interface ShareToChatModalProps {
  assetId: string;
  assetType: 'clip' | 'finalCut' | 'designImages' | 'designPdf' | 'document';
  contentPieceId: string;
  contentPieceTitle: string;
  stageKey: string;
  title: string;
  thumbnailUrl?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ShareToChatModal({
  assetId,
  assetType,
  contentPieceId,
  contentPieceTitle,
  stageKey,
  title,
  thumbnailUrl,
  onClose,
  onSuccess,
}: ShareToChatModalProps) {
  const [channels, setChannels] = useState<ChatChannelTypeDetail[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sharing, setSharing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChannels() {
      try {
        setLoading(true);
        const res = await apiFetch<{ channels: ChatChannelTypeDetail[] }>('/api/chat/channels');
        const active = (res.channels || []).filter((c) => !c.isArchived);
        setChannels(active);

        // Default to Team Chat if available, otherwise first channel
        const team = active.find((c) => c.type === 'team');
        if (team) {
          setSelectedChannelId(team._id || team.id || '');
        } else if (active.length > 0) {
          setSelectedChannelId(active[0]._id || active[0].id || '');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load accessible channels.');
      } finally {
        setLoading(false);
      }
    }
    loadChannels();
  }, []);

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChannelId) {
      setError('Please select a destination channel.');
      return;
    }

    try {
      setSharing(true);
      setError(null);

      await apiFetch('/api/chat/share', {
        method: 'POST',
        body: JSON.stringify({
          channelId: selectedChannelId,
          assetId,
          assetType,
          contentPieceId,
          stageKey,
          note: note.trim(),
        }),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to share asset to chat.');
    } finally {
      setSharing(false);
    }
  }

  // Modal keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, true, onClose);
  return (
    <div
      className="fixed inset-0 z-50 ui-scrim flex items-center justify-center p-4"
      data-testid="share-to-chat-modal"
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="share-to-chat-title" className="glass-modal max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-ui-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/70 text-ui-ink flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="share-to-chat-title" className="text-base font-bold text-ui-ink">Share to Chat</h3>
              <p className="text-xs text-ui-muted">Post approved asset into team conversations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ui-icon-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleShare} className="p-5 space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-xl status-tint status-changes text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Preview Card */}
          <div className="p-3 rounded-xl bg-white/60 border border-ui-line flex items-center gap-3">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-14 h-14 rounded-lg object-cover bg-slate-800 shrink-0 border border-ui-line"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white/70 border border-ui-line text-ui-ink flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="status-chip status-approved text-[11px] font-semibold px-2 py-0.5">
                  Approved
                </span>
                <span className="text-xs text-ui-muted truncate">
                  {contentPieceTitle} • {stageKey}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-ui-ink truncate mt-1">{title}</h4>
            </div>
          </div>

          {/* Destination Channel Selector */}
          <div>
            <label htmlFor="destination-channel-select" className="block text-xs font-semibold text-ui-text mb-1">
              Destination Channel <span className="text-ui-ink" aria-hidden="true">*</span>
            </label>
            {loading ? (
              <div className="p-2.5 rounded-xl border border-ui-line text-xs text-ui-muted">
                Loading channels...
              </div>
            ) : (
              <select
                id="destination-channel-select"
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="ui-select w-full"
                required
              >
                {channels.map((c) => {
                  const id = c._id || c.id;
                  const label =
                    c.type === 'team'
                      ? `# ${c.name} (Everyone)`
                      : c.type === 'group'
                      ? `👥 ${c.name}`
                      : `💬 ${c.name}`;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-ui-text mb-1">
              Add a note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Approved hook cut ready for thumbnail design and reel edit..."
              rows={3}
              maxLength={1000}
              className="ui-input ui-textarea w-full resize-none"
            />
          </div>

          {/* Scoped Privacy Notice */}
          <p className="text-[11px] text-ui-muted bg-white/70 p-2.5 rounded-xl border border-ui-line">
            <strong>Security Notice:</strong> Sharing gives channel members view and download access to this specific asset only. Upstream drafts, pipelines, and review feedback remain private.
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-ui-line">
            <button
              type="button"
              onClick={onClose}
              disabled={sharing}
              className="ui-btn ui-btn-secondary h-11"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sharing || loading || !selectedChannelId}
              className="ui-btn ui-btn-primary h-11 gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              {sharing ? 'Sharing...' : 'Share to Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

