import React, { useState, useEffect } from 'react';
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
  onClose?: () => void;
}

export const ShootReviewView: React.FC<ShootReviewViewProps> = ({
  stageItemId,
  workItemTitle,
  hideHeader = false,
  readOnly = false,
  onFinishReview,
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

  const approvedCount = clips.filter((c) => c.status === 'approved').length;
  const reshootCount = clips.filter((c) => c.status === 'reshoot_needed').length;
  const waitingCount = clips.filter((c) => c.status === 'waiting_review' || c.status === 'uploaded').length;

  const canApproveStep = clips.length > 0 && waitingCount === 0 && reshootCount === 0;
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
      alert(err.message || 'Failed to approve step');
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
      alert(err.message || 'Failed to send back step');
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
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header / Context */}
      {!hideHeader && (
        <div className="h-14 bg-slate-900/90 border-b border-white/10 px-4 flex items-center justify-between flex-shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                Creative Head Review
              </span>
              <h2 className="text-sm font-bold text-white truncate max-w-md">
                {workItemTitle}
              </h2>
            </div>
          </div>

          {/* Coverage pill */}
          <div className="flex items-center gap-2">
            {coverage && (
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-slate-300 font-medium">
                Shot Coverage: <strong className="text-white">{coverage}</strong>
                {shotList.length > 0 && <span className="text-slate-400 ml-1">({shotList.length} defined)</span>}
              </span>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/20 border-b border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && (
        <div className="p-2 text-center text-xs text-slate-400 bg-white/5 border-b border-white/10">
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
                <div className="mt-3 p-3 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Clip Decision:</span>
                    {selectedClip.status === 'approved' ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approved</span>
                      </span>
                    ) : selectedClip.status === 'reshoot_needed' ? (
                      <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Reshoot needed</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-medium">
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
                        className="min-h-[44px] px-4 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>Reshoot needed</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmittingReview || selectedClip.status === 'approved'}
                        onClick={handleApproveClip}
                        className="min-h-[44px] px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve clip</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp-Style Thread Beside Player */}
              <div className="w-full lg:w-96 flex-shrink-0 h-80 lg:h-auto">
                <MediaThread
                  clipId={selectedClip._id}
                  clipTitle={selectedClip.title}
                  onSeekTime={(secs) => setSeekSeconds(secs)}
                  externalTimestamp={momentRef}
                  onClearTimestamp={() => setMomentRef(null)}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <Film className="w-12 h-12 text-slate-700" />
              <p>No clips available for review.</p>
            </div>
          )}
        </div>

        {/* Right Gallery of Clips */}
        <div className="w-full lg:w-72 bg-slate-900/60 border-t lg:border-t-0 lg:border-l border-white/10 p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <span>Clips Gallery ({clips.length})</span>
            {coverage && (
              <span className="text-[10px] text-indigo-300 normal-case bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30 font-sans font-medium">
                {coverage}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
            {clips.map((clip) => {
              const isSelected = selectedClip?._id === clip._id;
              return (
                <div
                  key={clip._id}
                  onClick={() => setSelectedClip(clip)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 shadow-md'
                      : clip.status === 'reshoot_needed'
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70'
                      : clip.status === 'approved'
                      ? 'bg-emerald-950/10 border-emerald-500/30 hover:border-emerald-500/60'
                      : 'bg-white/5 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-semibold text-slate-100 truncate">{clip.title}</span>
                    {(clip.unreadCount || 0) > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-bold text-[9px]">
                        {clip.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Take {clip.take || 1}</span>
                    <span>
                      {clip.status === 'approved' && <span className="text-emerald-400">Approved ✓</span>}
                      {clip.status === 'reshoot_needed' && <span className="text-rose-400">Reshoot !</span>}
                      {clip.status === 'waiting_review' && <span className="text-amber-400">Waiting</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Persistent Summary Bar at Bottom */}
      <div className="p-4 bg-slate-900 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400 font-medium">Review Progress:</span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
            {approvedCount} Approved
          </span>
          <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold">
            {reshootCount} Reshoot needed
          </span>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold">
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
              className="min-h-[44px] px-5 rounded-full bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Send Back (Changes Requested)</span>
            </button>

            {/* Approve step action */}
            <button
              type="button"
              disabled={!canApproveStep || isSubmittingReview}
              onClick={() => setApproveStepModalOpen(true)}
              className="min-h-[44px] px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Approve Step with Rating</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">
            Read-Only Deliverable View
          </div>
        )}
      </div>

      {/* Reshoot Needed Modal (Feedback message required) */}
      {reshootModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>Request Reshoot for "{selectedClip?.title}"</span>
              </h3>
              <button
                onClick={() => setReshootModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Feedback / Direction for Shooter <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={reshootMessage}
                onChange={(e) => setReshootMessage(e.target.value)}
                placeholder="Explain what needs to be changed (e.g. framing, lighting, camera shake)..."
                className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReshootModalOpen(false)}
                className="min-h-[44px] px-4 rounded-full hover:bg-white/10 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reshootMessage.trim() || isSubmittingReview}
                onClick={handleReshootSubmit}
                className="min-h-[44px] px-5 rounded-full bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Confirm Reshoot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Step with Rating Modal */}
      {approveStepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Approve Shoot Deliverable</span>
              </h3>
              <button
                onClick={() => setApproveStepModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1-5 Star Rating Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Quality Rating (1 to 5 Stars) <span className="text-amber-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingScore(star)}
                    className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= ratingScore
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Tags */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Written Feedback
              </label>
              <textarea
                rows={2}
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
                placeholder="Commend great framing, audio clarity, or take organization..."
                className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveStepModalOpen(false)}
                className="min-h-[44px] px-4 rounded-full hover:bg-white/10 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={handleFinishApproveStep}
                className="min-h-[44px] px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Approve & Unlock Edit Step
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Back Step Modal */}
      {sendBackModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-scaleIn">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>Send Back Step for Revisions</span>
              </h3>
              <button
                onClick={() => setSendBackModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              There are <strong className="text-rose-400">{reshootCount} clip(s)</strong> flagged for reshoot. The step status will return to Changes requested (Feedback) and the shooter will be notified.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Overall Note to Shooter
              </label>
              <textarea
                rows={2}
                value={sendBackNote}
                onChange={(e) => setSendBackNote(e.target.value)}
                placeholder="Add overall revision notes or deadline reminder..."
                className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSendBackModalOpen(false)}
                className="min-h-[44px] px-4 rounded-full hover:bg-white/10 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={handleFinishSendBack}
                className="min-h-[44px] px-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
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
