import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import {
  Star,
  Sparkles,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Clock,
  Layers,
  AlertCircle,
  Edit2,
  X,
  ShieldAlert,
} from 'lucide-react';
import { RATING_TAGS } from '@mmp/shared';

interface RatingEditItem {
  editedBy?: { name?: string; role?: string } | string;
  editedAt: string;
  oldScore: number;
  newScore: number;
  oldFeedback?: string;
  newFeedback?: string;
  oldTags?: string[];
  newTags?: string[];
  reason: string;
}

interface RecentFeedbackItem {
  ratingId: string;
  score: number;
  feedback?: string;
  tags?: string[];
  stageKey: string;
  deliverableTitle?: string;
  workItemId?: string;
  date: string;
  seenAt?: string | null;
  raterName?: string;
  editedLog?: RatingEditItem[];
}

export interface RatingsSummaryData {
  personId: string;
  thresholdMet: boolean;
  message?: string;
  count: number;
  averageAllTime: number | null;
  average30Days: number | null;
  average90Days: number | null;
  distribution: Record<number, number>;
  monthlyTrend: Array<{ month: string; count: number; average: number }>;
  averagePerStepType: Record<string, number>;
  recentFeedback: RecentFeedbackItem[];
}

interface RatingsFeedbackSectionProps {
  personId: string;
  personName?: string;
  isOwnProfile?: boolean;
  canEditRating?: boolean;
  readOnly?: boolean;
}

export const RatingsFeedbackSection: React.FC<RatingsFeedbackSectionProps> = ({
  personId,
  personName,
  isOwnProfile = false,
  canEditRating = false,
  readOnly = false,
}) => {
  const [data, setData] = useState<RatingsSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<RecentFeedbackItem | null>(null);
  const [editScore, setEditScore] = useState<number>(5);
  const [editFeedback, setEditFeedback] = useState<string>('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editReason, setEditReason] = useState<string>('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRatings = async () => {
    if (!personId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: RatingsSummaryData }>(
        `/api/submissions/ratings/summary/${personId}`
      );
      setData(res.data);
    } catch (err: any) {
      if (err.statusCode === 403 || err.code === 'FORBIDDEN_RATINGS_ACCESS') {
        setError('Workers are permitted to inspect only their own quality ratings.');
      } else {
        setError(err.message || 'Failed to load ratings summary');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRatings();
  }, [personId]);

  const handleMarkSeen = async (ratingId: string) => {
    try {
      await apiFetch(`/api/submissions/ratings/${ratingId}/seen`, {
        method: 'POST',
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recentFeedback: prev.recentFeedback.map((item) =>
            item.ratingId === ratingId
              ? { ...item, seenAt: new Date().toISOString() }
              : item
          ),
        };
      });
    } catch (err: any) {
      alert(err.message || 'Failed to mark feedback as seen');
    }
  };

  const openEditModal = (item: RecentFeedbackItem) => {
    setEditingItem(item);
    setEditScore(item.score);
    setEditFeedback(item.feedback || '');
    setEditTags(item.tags || []);
    setEditReason('');
    setActionError(null);
  };

  const submitEditRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editReason.trim()) {
      setActionError('Reason for editing rating is required');
      return;
    }

    setIsSubmittingEdit(true);
    setActionError(null);
    try {
      await apiFetch(`/api/submissions/ratings/${editingItem.ratingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          score: editScore,
          feedback: editFeedback.trim(),
          tags: editTags,
          reason: editReason.trim(),
        }),
      });
      setEditingItem(null);
      await fetchRatings();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update rating');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const toggleEditTag = (tag: string) => {
    setEditTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
        Loading quality ratings and feedback...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-700/50 text-slate-400 text-xs flex items-center gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Institutional Guardrail & Dignity Note */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold uppercase tracking-wider text-indigo-800 text-[10px] block">
            Quality Coaching Baseline
          </span>
          <p className="mt-0.5 text-indigo-900/90 leading-relaxed">
            Ratings evaluate the craftsmanship and creative quality of approved work for coaching and growth. They are strictly decoupled from compensation, pay, or financial incentives.
          </p>
        </div>
      </div>

      {/* Threshold Guard: Fewer than 3 Ratings */}
      {!data.thresholdMet ? (
        <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-sm">
            <Star className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-white">Not enough ratings yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {data.message ||
              'Fewer than 3 ratings — collecting initial baseline. Metric averages, distribution, and monthly trend will unlock once at least 3 approved deliverables have been rated.'}
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              {data.count} of 3 ratings recorded
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* 4 Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                All-Time Average
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-400">{data.averageAllTime}</span>
                <span className="text-xs font-bold text-amber-400/80">★</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {data.count} total rating{data.count === 1 ? '' : 's'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                30-Day Average
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-indigo-400">
                  {data.average30Days !== null ? data.average30Days : '—'}
                </span>
                {data.average30Days !== null && <span className="text-xs font-bold text-indigo-400/80">★</span>}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Rolling 30 days</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                90-Day Average
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-purple-400">
                  {data.average90Days !== null ? data.average90Days : '—'}
                </span>
                {data.average90Days !== null && <span className="text-xs font-bold text-purple-400/80">★</span>}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Rolling 90 days</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total Rated
              </span>
              <span className="text-2xl font-black text-emerald-400 block">{data.count}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Approved deliverables</span>
            </div>
          </div>

          {/* Charts Row: Monthly Trend & Score Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monthly Trend Mini-Chart */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  Monthly Trend (Last 6 Months)
                </h4>
              </div>

              {data.monthlyTrend.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">No monthly trend data</p>
              ) : (
                <div className="space-y-2 pt-2">
                  <div className="flex items-end justify-between gap-2 h-28 px-2 border-b border-white/10 pb-2">
                    {data.monthlyTrend.map((m) => {
                      const heightPct = Math.round((m.average / 5) * 100);
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group/bar">
                          <span className="text-[10px] font-bold text-amber-400 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                            {m.average}★
                          </span>
                          <div className="w-full max-w-[28px] bg-slate-800 rounded-t-md overflow-hidden h-20 flex items-end">
                            <div
                              style={{ height: `${heightPct}%` }}
                              className="w-full bg-gradient-to-t from-indigo-600 to-amber-400 rounded-t-md transition-all duration-500"
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                            {m.month.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-2">
                    <span>1★ Baseline</span>
                    <span>5★ Excellent</span>
                  </div>
                </div>
              )}
            </div>

            {/* Score Distribution (1 to 5 Stars) */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 backdrop-blur-md space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                Score Distribution
              </h4>

              <div className="space-y-2 pt-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const countForStar = data.distribution[star] || 0;
                  const pct = data.count > 0 ? Math.round((countForStar / data.count) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2.5 text-xs">
                      <span className="w-8 font-bold text-slate-300 flex items-center gap-1 shrink-0 font-mono">
                        {star} <span className="text-amber-400 text-[11px]">★</span>
                      </span>
                      <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all duration-500 ${
                            star >= 4 ? 'bg-amber-400' : star === 3 ? 'bg-indigo-400' : 'bg-rose-400'
                          }`}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-slate-400 text-[11px] shrink-0">
                        {countForStar} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Average per Step Type */}
          {Object.keys(data.averagePerStepType).length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 backdrop-blur-md space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Average Rating per Step Type
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Object.entries(data.averagePerStepType).map(([step, avg]) => (
                  <div
                    key={step}
                    className="p-3 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-slate-300">{step}</span>
                    <span className="text-xs font-mono font-black text-amber-400">{avg} ★</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Qualitative Feedback List */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Recent Creative Feedback ({data.recentFeedback.length})
            </h4>

            {data.recentFeedback.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400 italic">
                No qualitative feedback comments recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentFeedback.map((item) => (
                  <div
                    key={item.ratingId}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                          {item.score} ★
                        </span>
                        <span className="text-xs font-bold text-white">
                          {item.deliverableTitle || 'Content Deliverable'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                          {item.stageKey}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.date).toLocaleDateString()}
                        </span>

                        {/* Mark as seen action */}
                        {isOwnProfile && !item.seenAt && (
                          <button
                            onClick={() => handleMarkSeen(item.ratingId)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Mark as seen
                          </button>
                        )}

                        {item.seenAt && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Seen
                          </span>
                        )}

                        {/* Edit Rating action for Creative Head & Admin */}
                        {canEditRating && !readOnly && (
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs"
                            title="Edit Rating (History will be logged)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Feedback Text */}
                    {item.feedback && (
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-white/5">
                        "{item.feedback}"
                      </p>
                    )}

                    {/* Quality Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                          >
                            +{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Edit History Log */}
                    {item.editedLog && item.editedLog.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/5 text-[11px] text-slate-400 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Edit History
                        </span>
                        {item.editedLog.map((log, idx) => {
                          const editorName =
                            typeof log.editedBy === 'object' && log.editedBy?.name
                              ? log.editedBy.name
                              : 'Reviewer';
                          return (
                            <div key={idx} className="flex items-center gap-1.5 text-slate-400">
                              <span>
                                {editorName} adjusted rating to {log.newScore}★ on{' '}
                                {new Date(log.editedAt).toLocaleDateString()}:
                              </span>
                              <span className="text-slate-300 italic">"{log.reason}"</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit Rating Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-extrabold text-white">
                  Edit Quality Rating{personName ? ` (${personName})` : ''}
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={submitEditRating} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Rating (1 to 5 Stars) *
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditScore(star)}
                      className={`p-2 rounded-xl border text-sm font-bold flex items-center gap-1 transition-all ${
                        editScore >= star
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                      <span>{star}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Written Feedback
                </label>
                <textarea
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  placeholder="Qualitative creative notes..."
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Quality Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_TAGS.map((tag) => {
                    const isSelected = editTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleEditTag(tag)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        +{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="edit-correction-reason" className="text-xs font-bold text-rose-300 block mb-1.5">
                  Reason for Correction (Required for Audit Log) *
                </label>
                <input
                  id="edit-correction-reason"
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g., Re-evaluated pacing in final cut"
                  required
                  className="w-full text-xs p-3 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || !editReason.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold transition-all"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save & Log Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
