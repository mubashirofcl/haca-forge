import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';

export const QUALITY_TAGS = [
  'Sharp Hook',
  'Clean Audio',
  'On Brand',
  'Punchy Edit',
  'Great Pacing',
  'Stunning Visuals',
] as const;

export const REVISION_ROOT_CAUSES = [
  'quality',
  'Creative Choice',
  'Technical Flaw',
  'Brief Ambiguity',
  'Scope Change',
] as const;

export type RootCause = typeof REVISION_ROOT_CAUSES[number];

interface DecisionBarProps {
  hasComments: boolean;
  commentCount: number;
  isSubmitting?: boolean;
  onApprove: (data: {
    rating: number;
    feedback?: string;
    tags?: string[];
    shareToTeamChat?: boolean;
  }) => Promise<void>;
  onRequestRevision: (data: { note: string; rootCause: RootCause }) => Promise<void>;
  onOpenCommentComposer?: () => void;
  onPrevItem?: () => void;
  onNextItem?: () => void;
}

export const DecisionBar: React.FC<DecisionBarProps> = ({
  hasComments,
  commentCount,
  isSubmitting = false,
  onApprove,
  onRequestRevision,
  onOpenCommentComposer,
  onPrevItem,
  onNextItem,
}) => {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [shareToTeamChat, setShareToTeamChat] = useState<boolean>(false);
  const [rootCause, setRootCause] = useState<RootCause>('quality');
  const [activeMode, setActiveMode] = useState<'idle' | 'approve' | 'revision'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ratingRef = React.useRef(rating);
  useEffect(() => {
    ratingRef.current = rating;
  }, [rating]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      ) {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (ratingRef.current > 0) {
          onApprove({ rating: ratingRef.current });
        } else {
          setActiveMode('approve');
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setActiveMode('revision');
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const score = Number(e.key);
        setRating(score);
        ratingRef.current = score;
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        onOpenCommentComposer?.();
      } else if (e.key === '[') {
        e.preventDefault();
        onPrevItem?.();
      } else if (e.key === ']') {
        e.preventDefault();
        onNextItem?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCommentComposer, onPrevItem, onNextItem]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleApproveSubmit = async () => {
    if (rating < 1 || rating > 5) {
      setErrorMsg('Rating (1 to 5 stars) is strictly required to approve.');
      return;
    }
    setErrorMsg(null);
    await onApprove({
      rating,
      feedback: feedback.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      shareToTeamChat,
    });
  };

  const handleRevisionSubmit = async () => {
    if (!hasComments && !feedback.trim()) {
      setErrorMsg('At least one anchored comment or a written revision note is required.');
      return;
    }
    setErrorMsg(null);
    await onRequestRevision({
      note: feedback.trim(),
      rootCause,
    });
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 shadow-2xl transition-all">
      {/* Expanded drawer for Approve / Revision details */}
      {activeMode !== 'idle' && (
        <div className="max-w-4xl mx-auto p-4 border-b border-white/10 flex flex-col gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              {activeMode === 'approve' ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Approve Deliverable
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Request Revision ({commentCount} comments pinned)
                </>
              )}
            </h4>
            <button
              onClick={() => setActiveMode('idle')}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
              {errorMsg}
            </div>
          )}

          {activeMode === 'approve' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 font-medium">Rating (Required):</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 hover:scale-110 transition-transform"
                      aria-label={`${star} star`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          (hoverRating || rating) >= star
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-amber-400 font-mono ml-2 font-bold">
                    {rating > 0 ? `${rating}/5` : 'Required'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-1.5">Quality Tags (Optional):</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUALITY_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-medium'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional encouraging notes or creative feedback..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={shareToTeamChat}
                    onChange={(e) => setShareToTeamChat(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span>Also share to Team chat</span>
                </label>

                <button
                  type="button"
                  disabled={isSubmitting || rating === 0}
                  onClick={handleApproveSubmit}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isSubmitting ? 'Approving...' : 'Confirm Approval (A)'}
                </button>
              </div>
            </div>
          )}

          {activeMode === 'revision' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-300 font-medium">Root Cause (Required):</label>
                <select
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value as RootCause)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/10 text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  {REVISION_ROOT_CAUSES.map((rc) => (
                    <option key={rc} value={rc}>
                      {rc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Describe required changes or revision notes..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">
                  {commentCount > 0 ? (
                    <span className="text-amber-400 font-medium">
                      ✓ {commentCount} anchored comment{commentCount > 1 ? 's' : ''} attached
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      No anchored comments yet. Written note above is required.
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={isSubmitting || (!hasComments && !feedback.trim())}
                  onClick={handleRevisionSubmit}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold text-xs transition-all shadow-lg hover:shadow-rose-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {isSubmitting ? 'Submitting...' : 'Send Revision Request'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Bottom Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Shortcuts & Info */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              [A]
            </span>{' '}
            Approve
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              [R]
            </span>{' '}
            Revision
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              [1-5]
            </span>{' '}
            Rating
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              [C]
            </span>{' '}
            Comment
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>{commentCount} comments</span>
          </div>
        </div>

        {/* Center: Rating Stars (1-5 Required for Approval) */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-white/10">
          <span className="text-xs text-slate-400 mr-1 font-medium hidden md:inline">Rating:</span>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => {
                setRating(star);
                setErrorMsg(null);
              }}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 hover:scale-110 transition-transform"
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  (hoverRating || rating) >= star
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-600'
                }`}
              />
            </button>
          ))}
          {rating > 0 ? (
            <span className="text-xs text-amber-400 font-mono font-bold ml-1">{rating}/5</span>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono ml-1">Req</span>
          )}
        </div>

        {/* Right: Quick action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setActiveMode(activeMode === 'revision' ? 'idle' : 'revision');
              setErrorMsg(null);
            }}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 border cursor-pointer ${
              activeMode === 'revision'
                ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-500/30'
                : 'bg-white/5 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Request Revision
          </button>

          <button
            type="button"
            disabled={isSubmitting || rating === 0}
            onClick={handleApproveSubmit}
            className={`min-h-[44px] px-5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 border cursor-pointer ${
              rating === 0
                ? 'opacity-40 bg-emerald-950/40 text-emerald-400 border-emerald-500/20 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg hover:shadow-emerald-500/20'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};
