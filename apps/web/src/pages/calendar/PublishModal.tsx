import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, X, Sparkles, ExternalLink, BarChart2 } from 'lucide-react';

interface PublishModalProps {
  contentItem: {
    _id: string;
    contentId: string;
    title: string;
    format: string;
    platforms: string[];
    publishedUrl?: string;
  } | null;
  onClose: () => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({ contentItem, onClose }) => {
  const queryClient = useQueryClient();

  const [publishedUrl, setPublishedUrl] = useState(contentItem?.publishedUrl || '');
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().slice(0, 16));
  const [reach, setReach] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [shares, setShares] = useState('');
  const [comments, setComments] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!contentItem) return;
      const res = await fetch(`/api/content/${contentItem._id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishedUrl,
          publishedAt: new Date(publishedAt).toISOString(),
          metrics: {
            reach: reach ? parseInt(reach, 10) : undefined,
            views: views ? parseInt(views, 10) : undefined,
            likes: likes ? parseInt(likes, 10) : undefined,
            shares: shares ? parseInt(shares, 10) : undefined,
            comments: comments ? parseInt(comments, 10) : undefined,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to publish content');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['contentItems'] });
      queryClient.invalidateQueries({ queryKey: ['publishingQueue'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'An error occurred during publishing');
    },
  });

  if (!contentItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="glass-panel w-full max-w-lg rounded-[28px] border border-white shadow-2xl p-6 bg-white space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-[#7a6af6] flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Mark Deliverable as Published</h3>
              <p className="text-[11px] text-slate-500">{contentItem.contentId} &bull; {contentItem.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErrorMessage('');
            publishMutation.mutate();
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="font-bold text-slate-700 block mb-1">Live Published URL *</label>
            <div className="relative">
              <input
                type="url"
                required
                placeholder="https://instagram.com/p/... or https://linkedin.com/posts/..."
                value={publishedUrl}
                onChange={(e) => setPublishedUrl(e.target.value)}
                className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
              />
              {publishedUrl && (
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#7a6af6]"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Publish Date & Time *</label>
            <input
              type="datetime-local"
              required
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
            />
          </div>

          {/* Optional Post Analytics */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-[#7a6af6]" />
              <span>Initial Post Metrics (Optional)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Reach</label>
                <input
                  type="number"
                  placeholder="0"
                  value={reach}
                  onChange={(e) => setReach(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Views</label>
                <input
                  type="number"
                  placeholder="0"
                  value={views}
                  onChange={(e) => setViews(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Likes</label>
                <input
                  type="number"
                  placeholder="0"
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Shares</label>
                <input
                  type="number"
                  placeholder="0"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Comments</label>
                <input
                  type="number"
                  placeholder="0"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={publishMutation.isPending || !publishedUrl}
              className="px-6 py-2 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{publishMutation.isPending ? 'Publishing...' : 'Confirm Live Publication'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
