import React, { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../../../lib/useDialogFocus';
import {
  CheckCircle2,
  AlertCircle,
  Star,
  ArrowLeft,
  Film,
  Sparkles,
  X,
} from 'lucide-react';
import { MediaItemType, RATING_TAGS, RatingTag } from '@mmp/shared';
import { apiFetch } from '../../../lib/api';
import { VideoPlayer } from './VideoPlayer';
import { MediaThread } from './MediaThread';

interface ShootReviewViewProps {
  stageItemId: string;
  workItemTitle: string;
  hideHeader?: boolean;
  readOnly?: boolean;
  onFinishReview?: () => void;
  /** The step can no longer be decided (409): the parent explains why and refreshes. */
  onStaleDecision?: (message: string) => void;
  /** Clip review threads are private to the step owner and leadership. */
  canSeeThreads?: boolean;
  onClose?: () => void;
}

export const ShootReviewView: React.FC<ShootReviewViewProps> = ({
  stageItemId,
  workItemTitle,
  hideHeader = false,
  readOnly = false,
  onFinishReview,
  onStaleDecision,
  canSeeThreads = true,
  onClose,
}) => {
  const [clips, setClips] = useState<MediaItemType[]>([]);
  const [shotList, setShotList] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active clip under review
  const [selectedClip, setSelectedClip] = useState<MediaItemType | null>(null);
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);
  const [momentRef, setMomentRef] = useState<string | null>(null);

  // Per-clip review modal state
  const [reshootModalOpen, setReshootModalOpen] = useState(false);
  const [reshootMessage, setReshootMessage] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Finish review state (rating modal or send back modal)
  const [approveStepModalOpen, setApproveStepModalOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState<number>(4);
  const [ratingFeedback, setRatingFeedback] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<RatingTag[]>([]);

  const [sendBackModalOpen, setSendBackModalOpen] = useState(false);
  const [sendBackNote, setSendBackNote] = useState<string>('');
  // Modal keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const reshootDialogRef = useRef<HTMLDivElement>(null);
  const approveStepDialogRef = useRef<HTMLDivElement>(null);
  const sendBackDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(reshootDialogRef, reshootModalOpen, () => setReshootModalOpen(false));
  useDialogFocus(approveStepDialogRef, approveStepModalOpen, () => setApproveStepModalOpen(false));
  useDialogFocus(sendBackDialogRef, sendBackModalOpen, () => setSendBackModalOpen(false));

  const fetchClips = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch<any>(`/api/work/${stageItemId}/clips`);
      const data = res?.data || res;
      const clipList = data.clips || [];
      setClips(clipList);
      setShotList(data.shotList || []);
      setCoverage(data.coverage || '');

      if (!selectedClip && clipList.length > 0) {
        setSelectedClip(clipList[0]);
      } else if (selectedClip) {
        const refreshed = clipList.find((c: any) => c._id === selectedClip._id);
        if (refreshed) {
          setSelectedClip(refreshed);
        } else if (clipList.length > 0) {
          setSelectedClip(clipList[0]);
        } else {
          setSelectedClip(null);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load clips for review');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stageItemId) {
      fetchClips();
    }
  }, [stageItemId]);

  // A clip replaced by a newer one no longer counts, the same rule the API applies.
  const replacedIds = new Set(clips.map((c: any) => c.replacesId && String(c.replacesId)).filter(Boolean));
  const requiredClips = clips.filter((c) => !replacedIds.has(String(c._id)));
  const approvedCount = requiredClips.filter((c) => c.status === 'approved').length;
  const reshootCount = requiredClips.filter((c) => c.status === 'reshoot_needed').length;
  const waitingCount = requiredClips.filter((c) => c.status !== 'approved' && c.status !== 'reshoot_needed').length;

  const canApproveStep = requiredClips.length > 0 && waitingCount === 0 && reshootCount === 0;
  const canSendBack = reshootCount > 0 && waitingCount === 0;

  const handleApproveClip = async () => {
    if (!selectedClip || isSubmittingReview) return;
    try {
      setIsSubmittingReview(true);
      const res = await apiFetch<any>(`/api/clips/${selectedClip._id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
      });
      const updated = res?.data || res;
      setClips((prev) => prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)));
      setSelectedClip((prev) => (prev ? { ...prev, ...updated } : null));
    } catch (err: any) {
      alert(err.message || 'Failed to approve clip');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleReshootSubmit = async () => {
    if (!selectedClip || !reshootMessage.trim() || isSubmittingReview) return;
    try {
      setIsSubmittingReview(true);
      const res = await apiFetch<any>(`/api/clips/${selectedClip._id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reshoot_needed', message: reshootMessage.trim() }),
      });
      const updated = res?.data || res;
      setClips((prev) => prev.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)));
      setSelectedClip((prev) => (prev ? { ...prev, ...updated } : null));
      setReshootModalOpen(false);
      setReshootMessage('');
    } catch (err: any) {
      alert(err.message || 'Failed to flag clip for reshoot');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleFinishApproveStep = async () => {
    try {
      setIsSubmittingReview(true);
      await apiFetch(`/api/work/${stageItemId}/shoot-review`, {
        method: 'POST',
        body: JSON.stringify({
          score: ratingScore,
          feedback: ratingFeedback.trim(),
          tags: selectedTags,
        }),
      });
      setApproveStepModalOpen(false);
      if (onFinishReview) onFinishReview();
    } catch (err: any) {
      if (err?.statusCode === 409 && onStaleDecision) {
        setApproveStepModalOpen(false);
        onStaleDecision(err.message);
      } else {
        alert(err.message || 'Failed to approve step');
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleFinishSendBack = async () => {
    try {
      setIsSubmittingReview(true);
      await apiFetch(`/api/work/${stageItemId}/shoot-review`, {
        method: 'POST',
        body: JSON.stringify({
          note: sendBackNote.trim() || `${reshootCount} clip(s) flagged for reshoot`,
        }),
      });
      setSendBackModalOpen(false);
      if (onFinishReview) onFinishReview();
    } catch (err: any) {
      if (err?.statusCode === 409 && onStaleDecision) {
        setSendBackModalOpen(false);
        onStaleDecision(err.message);
      } else {
        alert(err.message || 'Failed to send back step');
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const toggleTag = (tag: RatingTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex flex-col h-full bg-ui-canvas text-ui-ink font-sans overflow-hidden">
      {/* Top Header / Context */}
      {!hideHeader && (
        <div className="h-14 bg-white/60 border-b border-ui-line px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="ui-icon-btn shrink-0"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <div>
              <span className="text-[11px] font-bold text-ui-ink">
                {readOnly ? 'Approved footage' : 'Creative Head Review'}
              </span>
              <h2 className="text-sm font-bold text-ui-ink truncate max-w-md">
                {workItemTitle}
              </h2>
            </div>
          </div>

          {/* Coverage pill */}
          <div className="flex items-center gap-2">
            {coverage && (
              <span className="px-3 py-1 rounded-full bg-white/60 border border-ui-line text-xs text-ui-text font-medium">
                Shot Coverage: <strong className="text-ui-ink">{coverage}</strong>
                {shotList.length > 0 && <span className="text-ui-muted ml-1">({shotList.length} defined)</span>}
              </span>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="status-tint status-changes p-3 border-b text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-800" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && (
        <div className="p-2 text-center text-xs text-ui-muted bg-white/60 border-b border-ui-line">
          Loading clips for review...
        </div>
      )}

      {/* Main Workspace Layout: Left Viewer + Thread; Bottom/Right Clips Strip */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Player + MediaThread */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
          {selectedClip ? (
            <>
              {/* Large Player */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <VideoPlayer
                  url={selectedClip.url}
                  thumbnailUrl={selectedClip.thumbnailUrl}
                  seekToSeconds={seekSeconds}
                  onReferenceMoment={(formatted) => setMomentRef(formatted)}
                  className="w-full h-full max-h-[520px]"
                />

                {/* Per-Clip Decision Bar */}
                <div className="mt-3 p-3 rounded-2xl bg-white/60 border border-ui-line flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ui-muted">Clip Decision:</span>
                    {selectedClip.status === 'approved' ? (
                      <span className="status-tint status-approved px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approved</span>
                      </span>
                    ) : selectedClip.status === 'reshoot_needed' ? (
                      <span className="status-tint status-changes px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Reshoot needed</span>
                      </span>
                    ) : (
                      <span className="status-tint status-waiting px-3 py-1 rounded-full border text-xs font-medium">
                        Waiting for review
                      </span>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSubmittingReview || selectedClip.status === 'reshoot_needed'}
                        onClick={() => setReshootModalOpen(true)}
                        className="status-tint status-changes min-h-[44px] px-4 rounded-full border font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>Reshoot needed</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmittingReview || selectedClip.status === 'approved'}
                        onClick={handleApproveClip}
                        className="min-h-[44px] px-5 rounded-full bg-ui-ink hover:bg-black text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve clip</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp-Style Thread Beside Player */}
              {canSeeThreads && (
                <div className="w-full lg:w-96 flex-shrink-0 h-80 lg:h-auto">
                  <MediaThread
                    clipId={selectedClip._id}
                    clipTitle={selectedClip.title}
                    onSeekTime={(secs) => setSeekSeconds(secs)}
                    externalTimestamp={momentRef}
                    onClearTimestamp={() => setMomentRef(null)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-ui-muted text-sm gap-2">
              <Film className="w-12 h-12 text-ui-text" />
              <p>No clips available for review.</p>
            </div>
          )}
        </div>

        {/* Right Gallery of Clips */}
        <div className="w-full lg:w-72 bg-white/60 border-t lg:border-t-0 lg:border-l border-ui-line p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between text-xs font-semibold text-ui-text">
            <span>Clips Gallery ({clips.length})</span>
            {coverage && (
              <span className="text-[11px] text-ui-ink normal-case bg-white px-2 py-0.5 rounded-full border border-ui-ink font-sans font-medium">
                {coverage}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
            {clips.map((clip) => {
              const isSelected = selectedClip?._id === clip._id;
              return (
                <button
                  type="button"
                  key={clip._id}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedClip(clip)}
                  className={`w-full text-left min-h-[44px] p-2.5 rounded-xl border transition-colors flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-white border-ui-ink shadow-md'
                      : clip.status === 'reshoot_needed'
                      ? 'status-tint status-changes border-ui-line hover:border-ui-line'
                      : clip.status === 'approved'
                      ? 'status-tint status-approved border-ui-line hover:border-ui-line'
                      : 'bg-white/60 border-ui-line hover:border-ui-line'
                  }`}
                >
                  <span className="flex items-center justify-between gap-1 text-[11px] w-full">
                    <span className="font-semibold text-ui-ink truncate">{clip.title}</span>
                    {(clip.unreadCount || 0) > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-ui-ink text-white font-bold text-[11px]">
                        {clip.unreadCount}
                      </span>
                    )}
                  </span>

                  <span className="flex items-center justify-between text-[11px] text-ui-muted font-mono w-full">
                    <span>Take {clip.take || 1}</span>
                    <span>
                      {clip.status === 'approved' && <span className="text-emerald-800">Approved ✓</span>}
                      {clip.status === 'reshoot_needed' && <span className="text-rose-800">Reshoot !</span>}
                      {clip.status === 'waiting_review' && <span className="text-amber-800">Waiting</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Persistent Summary Bar at Bottom */}
      <div className="p-4 bg-white/60 border-t border-ui-line flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-ui-muted font-medium">Review Progress:</span>
          <span className="status-tint status-approved px-2.5 py-1 rounded-full font-bold">
            {approvedCount} Approved
          </span>
          <span className="status-tint status-changes px-2.5 py-1 rounded-full font-bold">
            {reshootCount} Reshoot needed
          </span>
          <span className="status-tint status-waiting px-2.5 py-1 rounded-full font-bold">
            {waitingCount} Pending review
          </span>
        </div>

        {!readOnly ? (
          <div className="flex items-center gap-3">
            {/* Send back action */}
            <button
              type="button"
              disabled={!canSendBack || isSubmittingReview}
              onClick={() => setSendBackModalOpen(true)}
              className="min-h-[44px] px-5 rounded-full bg-ui-ink hover:bg-black disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Send Back (Changes Requested)</span>
            </button>

            {/* Approve step action */}
            <button
              type="button"
              disabled={!canApproveStep || isSubmittingReview}
              onClick={() => setApproveStepModalOpen(true)}
              className="min-h-[44px] px-6 rounded-full bg-ui-ink hover:bg-black disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-800" />
              <span>Approve Step with Rating</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-ui-muted italic">
            Read-Only Deliverable View
          </div>
        )}
      </div>

      {/* Reshoot Needed Modal (Feedback message required) */}
      {reshootModalOpen && (
        <div className="fixed inset-0 z-50 ui-scrim flex items-center justify-center p-4">
          <div
            ref={reshootDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-reshoot-title"
            className="glass-modal w-full max-w-md max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="sr-reshoot-title" className="text-base font-bold text-ui-ink flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-800" />
                <span>Request Reshoot for "{selectedClip?.title}"</span>
              </h3>
              <button
                onClick={() => setReshootModalOpen(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="sr-field-1" className="block text-xs font-semibold text-ui-text mb-1">
                Feedback / Direction for Shooter <span className="text-rose-800">*</span>
              </label>
              <textarea
                id="sr-field-1"
                rows={3}
                value={reshootMessage}
                onChange={(e) => setReshootMessage(e.target.value)}
                placeholder="Explain what needs to be changed (e.g. framing, lighting, camera shake)..."
                className="ui-input ui-textarea w-full"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReshootModalOpen(false)}
                className="min-h-[44px] px-4 rounded-full hover:bg-white text-ui-text text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reshootMessage.trim() || isSubmittingReview}
                onClick={handleReshootSubmit}
                className="min-h-[44px] px-5 rounded-full bg-ui-ink hover:bg-black disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Confirm Reshoot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Step with Rating Modal */}
      {approveStepModalOpen && (
        <div className="fixed inset-0 z-50 ui-scrim flex items-center justify-center p-4">
          <div
            ref={approveStepDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-approve-title"
            className="glass-modal w-full max-w-md max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="sr-approve-title" className="text-base font-bold text-ui-ink flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-800" />
                <span>Approve Shoot Deliverable</span>
              </h3>
              <button
                onClick={() => setApproveStepModalOpen(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1-5 Star Rating Selector */}
            <div>
              <label className="block text-xs font-semibold text-ui-text mb-1.5">
                Quality Rating (1 to 5 Stars) <span className="text-amber-800">*</span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingScore(star)}
                    aria-label={`${star} star${star === 1 ? '' : 's'}`}
                    aria-pressed={ratingScore === star}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl hover:bg-white transition-colors"
                  >
                    <Star
                      aria-hidden="true"
                      className={`w-7 h-7 ${
                        star <= ratingScore
                          ? 'fill-amber-400 text-amber-800'
                          : 'text-ui-muted'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Tags */}
            <div>
              <label className="block text-xs font-semibold text-ui-text mb-1.5">
                Quality Tags (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {RATING_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={active}
                      className={`min-h-[44px] px-3 rounded-full text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-ui-ink text-white'
                          : 'bg-white/60 border border-ui-line text-ui-muted hover:bg-white'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Qualitative Feedback */}
            <div>
              <label htmlFor="sr-field-2" className="block text-xs font-semibold text-ui-text mb-1">
                Written Feedback
              </label>
              <textarea
                id="sr-field-2"
                rows={2}
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
                placeholder="Commend great framing, audio clarity, or take organization..."
                className="ui-input ui-textarea w-full"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveStepModalOpen(false)}
                className="min-h-[44px] px-4 rounded-full hover:bg-white text-ui-text text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={handleFinishApproveStep}
                className="min-h-[44px] px-6 rounded-full bg-ui-ink hover:bg-black text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Approve & Unlock Edit Step
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Back Step Modal */}
      {sendBackModalOpen && (
        <div className="fixed inset-0 z-50 ui-scrim flex items-center justify-center p-4">
          <div
            ref={sendBackDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-sendback-title"
            className="glass-modal w-full max-w-md max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="sr-sendback-title" className="text-base font-bold text-ui-ink flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-800" />
                <span>Send Back Step for Revisions</span>
              </h3>
              <button
                onClick={() => setSendBackModalOpen(false)}
                type="button"
              aria-label="Close"
              className="ui-icon-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ui-text">
              There are <strong className="text-rose-800">{reshootCount} clip(s)</strong> flagged for reshoot. The step status will return to Changes requested (Feedback) and the shooter will be notified.
            </p>

            <div>
              <label htmlFor="sr-field-3" className="block text-xs font-semibold text-ui-text mb-1">
                Overall Note to Shooter
              </label>
              <textarea
                id="sr-field-3"
                rows={2}
                value={sendBackNote}
                onChange={(e) => setSendBackNote(e.target.value)}
                placeholder="Add overall revision notes or deadline reminder..."
                className="ui-input ui-textarea w-full"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSendBackModalOpen(false)}
                className="min-h-[44px] px-4 rounded-full hover:bg-white text-ui-text text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={handleFinishSendBack}
                className="min-h-[44px] px-6 rounded-full bg-ui-ink hover:bg-black text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Confirm & Send Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
