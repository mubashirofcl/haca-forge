import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { CANONICAL_REVISION_ROOT_CAUSES, type CanonicalRevisionRootCause } from '@mmp/shared';

export const QUALITY_TAGS = [
  'Sharp Hook',
  'Clean Audio',
  'On Brand',
  'Punchy Edit',
  'Great Pacing',
  'Stunning Visuals',
] as const;

// Revision requests use the 7 canonical root causes from @mmp/shared (no local list).
export type RootCause = CanonicalRevisionRootCause;

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
  const [rootCause, setRootCause] = useState<RootCause>(CANONICAL_REVISION_ROOT_CAUSES[0]);
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
    <div className="sticky bottom-0 left-0 right-0 z-40 bg-ui-card border-t border-ui-line shadow-ui-panel text-ui-text">
      {/* Expanded drawer for Approve / Revision details */}
      {activeMode !== 'idle' && (
        <div className="max-w-4xl mx-auto p-4 border-b border-ui-line flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ui-ink flex items-center gap-2">
              {activeMode === 'approve' ? (
                <>
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  Approve Deliverable
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  Request Revision ({commentCount} comments pinned)
                </>
              )}
            </h4>
            <button
              type="button"
              onClick={() => setActiveMode('idle')}
              className="ui-btn ui-btn-secondary h-11 shrink-0"
            >
              Cancel
            </button>
          </div>

          {errorMsg && (
            <div role="alert" className="text-xs status-tint status-changes px-3 py-2 rounded-lg">
              {errorMsg}
            </div>
          )}

          {activeMode === 'approve' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span id="decision-rating-label" className="text-xs text-ui-text font-medium">Rating (Required):</span>
                <div className="flex flex-wrap items-center gap-0.5" role="group" aria-labelledby="decision-rating-label">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white"
                      aria-label={`${star} star`}
                      aria-pressed={rating === star}
                    >
                      <Star
                        aria-hidden="true"
                        className={`w-5 h-5 ${
                          (hoverRating || rating) >= star
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-ui-muted'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-ui-ink font-mono ml-2 font-semibold">
                    {rating > 0 ? `${rating}/5` : 'Required'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-ui-muted block mb-1.5">Quality Tags (Optional):</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUALITY_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        aria-pressed={isSelected}
                        className={`text-[13px] min-h-[44px] px-3 rounded-full border transition-colors ${
                          isSelected
                            ? 'bg-ui-ink border-transparent text-white font-medium'
                            : 'bg-white/70 border-ui-line text-ui-text hover:bg-white'
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
                  aria-label="Approval feedback (optional)"
                  rows={2}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 min-h-[44px] text-xs text-ui-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={shareToTeamChat}
                    onChange={(e) => setShareToTeamChat(e.target.checked)}
                    className="w-4 h-4 accent-ui-ink"
                  />
                  <span>Also share to Team chat</span>
                </label>

                <button
                  type="button"
                  disabled={isSubmitting || rating === 0}
                  onClick={handleApproveSubmit}
                  className="ui-btn ui-btn-primary h-11 gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  {isSubmitting ? 'Approving...' : 'Confirm Approval (A)'}
                </button>
              </div>
            </div>
          )}

          {activeMode === 'revision' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="decision-root-cause" className="text-xs text-ui-text font-medium">Root Cause (Required):</label>
                <select
                  id="decision-root-cause"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value as RootCause)}
                  className="ui-select"
                >
                  {CANONICAL_REVISION_ROOT_CAUSES.map((rc) => (
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
                  aria-label="Revision notes"
                  rows={2}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-ui-muted">
                  {commentCount > 0 ? (
                    <span className="text-ui-ink font-medium">
                      ✓ {commentCount} anchored comment{commentCount > 1 ? 's' : ''} attached
                    </span>
                  ) : (
                    <span className="text-ui-muted">
                      No anchored comments yet. Written note above is required.
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={isSubmitting || (!hasComments && !feedback.trim())}
                  onClick={handleRevisionSubmit}
                  className="ui-btn ui-btn-primary h-11 gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
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
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-ui-muted font-mono">
            <span className="px-1.5 py-0.5 rounded bg-white border border-ui-line text-ui-text">
              [A]
            </span>{' '}
            Approve
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white border border-ui-line text-ui-text">
              [R]
            </span>{' '}
            Revision
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white border border-ui-line text-ui-text">
              [1-5]
            </span>{' '}
            Rating
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white border border-ui-line text-ui-text">
              [C]
            </span>{' '}
            Comment
          </div>

          <div className="flex items-center gap-1 text-xs text-ui-muted">
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{commentCount} comments</span>
          </div>
        </div>

        {/* Center: Rating Stars (1-5 Required for Approval) */}
        <div className="flex items-center gap-0.5 px-2 rounded-ui-card bg-white/70 border border-ui-line" role="group" aria-label="Rating, required to approve">
          <span className="text-xs text-ui-muted mr-1 font-medium hidden md:inline">Rating:</span>
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
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white"
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              aria-pressed={rating === star}
            >
              <Star
                aria-hidden="true"
                className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  (hoverRating || rating) >= star
                    ? 'text-amber-500 fill-amber-500'
                    : 'text-ui-muted'
                }`}
              />
            </button>
          ))}
          {rating > 0 ? (
            <span className="text-xs text-ui-ink font-mono font-semibold ml-1 mr-1">{rating}/5</span>
          ) : (
            <span className="text-[11px] text-ui-muted font-mono ml-1 mr-1">Req</span>
          )}
        </div>

        {/* Right: Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setActiveMode(activeMode === 'revision' ? 'idle' : 'revision');
              setErrorMsg(null);
            }}
            aria-expanded={activeMode === 'revision'}
            className={`ui-btn h-11 gap-2 ${activeMode === 'revision' ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
          >
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Request Revision
          </button>

          <button
            type="button"
            disabled={isSubmitting || rating === 0}
            onClick={handleApproveSubmit}
            className="ui-btn ui-btn-primary h-11 gap-2"
          >
            <CheckCircle className="w-4 h-4" aria-hidden="true" />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};
