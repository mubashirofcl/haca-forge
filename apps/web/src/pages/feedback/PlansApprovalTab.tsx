import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { CalendarPlanStatus, RowStatus } from '@mmp/shared';

interface PlanRow {
  _id: string;
  postingDate: string;
  topic: string;
  contentType: string;
  needsScript?: boolean;
  needsShoot?: boolean;
  contentLink?: string;
  remarks?: string;
  rowStatus: RowStatus;
  reviewComment?: string;
}

interface CalendarPlanWaiting {
  _id: string;
  code: string;
  title: string;
  kind: string;
  periodStart: string;
  periodEnd: string;
  status: CalendarPlanStatus;
  submittedAt?: string;
  createdAt: string;
  createdById?: { _id: string; name: string; email: string };
  rowCount: number;
  submittedRowCount: number;
  approvedRowCount: number;
  rows?: PlanRow[];
}

export const PlansApprovalTab: React.FC = () => {
  const [plans, setPlans] = useState<CalendarPlanWaiting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  // Review State per expanded plan
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [rowComments, setRowComments] = useState<Record<string, string>>({});
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const fetchSubmittedPlans = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: CalendarPlanWaiting[] }>('/api/calendar-plans');
      // Filter for plans waiting for approval and sort oldest first
      const waiting = (res.data || [])
        .filter((p) => p.status === 'Submitted' || p.submittedRowCount > 0)
        .sort((a, b) => {
          const dateA = new Date(a.submittedAt || a.createdAt).getTime();
          const dateB = new Date(b.submittedAt || b.createdAt).getTime();
          return dateA - dateB; // Oldest first
        });

      setPlans(waiting);
      if (waiting.length > 0 && !expandedPlanId) {
        setExpandedPlanId(waiting[0]._id);
        fetchPlanDetail(waiting[0]._id);
      }
    } catch (err) {
      console.error('Failed to fetch plans waiting for approval', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanDetail = async (id: string) => {
    try {
      const res = await apiFetch<{ data: CalendarPlanWaiting }>(`/api/calendar-plans/${id}`);
      setPlans((prev) => prev.map((p) => (p._id === id ? res.data : p)));
      setSelectedRowIds([]);
      setRowComments({});
    } catch (err) {
      console.error('Failed to load plan details for review', err);
    }
  };

  useEffect(() => {
    fetchSubmittedPlans();
  }, []);

  const handleToggleExpand = (id: string) => {
    if (expandedPlanId === id) {
      setExpandedPlanId(null);
    } else {
      setExpandedPlanId(id);
      fetchPlanDetail(id);
    }
  };

  const handleReview = async (planId: string, action: 'approve_all' | 'approve_selected' | 'request_changes') => {
    setIsSubmittingReview(true);
    setFeedbackSuccess(null);

    try {
      const targetPlan = plans.find((p) => p._id === planId);
      const payload: any = { action };

      if (action === 'approve_selected') {
        if (selectedRowIds.length === 0) {
          alert('Please select at least one row to approve');
          setIsSubmittingReview(false);
          return;
        }
        payload.approvedRowIds = selectedRowIds;
        payload.selectedRowIds = selectedRowIds;
      }

      if (action === 'request_changes') {
        const comments: Record<string, string> = {};
        const changes: Array<{ rowId: string; comment: string }> = [];
        const targetIds = selectedRowIds.length > 0 ? selectedRowIds : (targetPlan?.rows || []).map((r) => r._id);
        let hasComment = false;
        for (const rid of targetIds) {
          if (rowComments[rid]?.trim()) {
            comments[rid] = rowComments[rid].trim();
            changes.push({ rowId: rid, comment: rowComments[rid].trim() });
            hasComment = true;
          }
        }
        if (!hasComment) {
          alert('Please enter a review comment explaining requested revisions for at least one row');
          setIsSubmittingReview(false);
          return;
        }
        payload.comments = comments;
        payload.changes = changes;
      }

      const res = await apiFetch<{ message: string }>(`/api/calendar-plans/${planId}/review`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setFeedbackSuccess(res.message || 'Plan review successfully submitted');
      setSelectedRowIds([]);
      setRowComments({});
      await fetchSubmittedPlans();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
        Loading plans waiting for Creative Head approval...
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">All Plans Approved!</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          There are currently no submitted monthly or project calendar plans waiting for Creative Head review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbackSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {feedbackSuccess}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Plans Waiting for Approval ({plans.length}) • Sorted Oldest First
        </div>
      </div>

      <div className="space-y-3">
        {plans.map((plan, index) => {
          const isExpanded = expandedPlanId === plan._id;
          const submittedDate = plan.submittedAt ? new Date(plan.submittedAt) : new Date(plan.createdAt);
          const submittedRows = (plan.rows || []).filter((r) => r.rowStatus === 'submitted');

          return (
            <div
              key={plan._id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all"
            >
              {/* Plan Card Header */}
              <div
                onClick={() => handleToggleExpand(plan._id)}
                className="p-4 cursor-pointer hover:bg-slate-50/70 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {plan.code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{plan.title}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {plan.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>Submitted by {plan.createdById?.name || 'SM Manager'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-amber-700 font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        Waiting since {submittedDate.toLocaleDateString()} {submittedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">
                        {plan.submittedRowCount || submittedRows.length} rows awaiting review
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Expanded Review Section */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40 space-y-4">
                  {/* Creative Head Action Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold text-slate-800">Creative Head Review Actions:</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReview(plan._id, 'approve_all')}
                        disabled={isSubmittingReview}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        Approve All Rows
                      </button>

                      <button
                        onClick={() => handleReview(plan._id, 'approve_selected')}
                        disabled={isSubmittingReview || selectedRowIds.length === 0}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        Approve Selected ({selectedRowIds.length})
                      </button>

                      <button
                        onClick={() => handleReview(plan._id, 'request_changes')}
                        disabled={isSubmittingReview}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        Request Changes with Comments
                      </button>
                    </div>
                  </div>

                  {/* Rows Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-8">
                            <input
                              type="checkbox"
                              checked={
                                submittedRows.length > 0 &&
                                selectedRowIds.length === submittedRows.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRowIds(submittedRows.map((r) => r._id));
                                } else {
                                  setSelectedRowIds([]);
                                }
                              }}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                          </th>
                          <th className="p-3">#</th>
                          <th className="p-3">Posting Date</th>
                          <th className="p-3">Topic</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Flags</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 min-w-[200px]">Revision Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(plan.rows || []).map((row, rIdx) => {
                          const isSubmitted = row.rowStatus === 'submitted';
                          const isRowChecked = selectedRowIds.includes(row._id);

                          return (
                            <tr
                              key={row._id}
                              className={`hover:bg-slate-50 transition-colors ${
                                isRowChecked ? 'bg-purple-50/30' : ''
                              }`}
                            >
                              <td className="p-3">
                                {isSubmitted && (
                                  <input
                                    type="checkbox"
                                    checked={isRowChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRowIds([...selectedRowIds, row._id]);
                                      } else {
                                        setSelectedRowIds(selectedRowIds.filter((id) => id !== row._id));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                  />
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-400">{rIdx + 1}</td>
                              <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                                {new Date(row.postingDate).toLocaleDateString()}
                              </td>
                              <td className="p-3 font-medium text-slate-900 max-w-[200px] truncate" title={row.topic}>
                                {row.topic}
                              </td>
                              <td className="p-3 font-bold text-purple-700 whitespace-nowrap">
                                {row.contentType}
                              </td>
                              <td className="p-3 text-[11px] text-slate-500 whitespace-nowrap">
                                {row.contentType.toLowerCase().includes('reel') ? (
                                  <div className="flex items-center gap-1">
                                    {row.needsScript && (
                                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Script</span>
                                    )}
                                    {row.needsShoot && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Shoot</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    row.rowStatus === 'approved'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : row.rowStatus === 'submitted'
                                      ? 'bg-amber-100 text-amber-800'
                                      : row.rowStatus === 'changes_requested'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {row.rowStatus}
                                </span>
                              </td>
                              <td className="p-3">
                                {isSubmitted ? (
                                  <input
                                    type="text"
                                    placeholder="Enter revision note for this row..."
                                    value={rowComments[row._id] || ''}
                                    onChange={(e) =>
                                      setRowComments({
                                        ...rowComments,
                                        [row._id]: e.target.value,
                                      })
                                    }
                                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                  />
                                ) : row.reviewComment ? (
                                  <span className="text-[11px] text-rose-700 italic">{row.reviewComment}</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
