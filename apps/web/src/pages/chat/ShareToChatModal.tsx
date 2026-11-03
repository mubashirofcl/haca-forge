import { useState, useEffect } from 'react';
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      data-testid="share-to-chat-modal"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Share to Chat</h3>
              <p className="text-xs text-slate-500">Post approved asset into team conversations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleShare} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset Preview Card */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-14 h-14 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Approved
                </span>
                <span className="text-xs text-slate-400 truncate">
                  {contentPieceTitle} • {stageKey}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-slate-900 truncate mt-1">{title}</h4>
            </div>
          </div>

          {/* Destination Channel Selector */}
          <div>
            <label htmlFor="destination-channel-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Destination Channel <span className="text-rose-500">*</span>
            </label>
            {loading ? (
              <div className="p-2.5 rounded-xl border border-slate-200 text-xs text-slate-400">
                Loading channels...
              </div>
            ) : (
              <select
                id="destination-channel-select"
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Add a note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Approved hook cut ready for thumbnail design and reel edit..."
              rows={3}
              maxLength={1000}
              className="w-full text-xs rounded-xl border border-slate-200 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Scoped Privacy Notice */}
          <p className="text-[11px] text-slate-500 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
            <strong>Security Notice:</strong> Sharing gives channel members view and download access to this specific asset only. Upstream drafts, pipelines, and review feedback remain private.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={sharing}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sharing || loading || !selectedChannelId}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
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

