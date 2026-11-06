import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { planGridHref } from '../calendar/PlanGridPage';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from 'lucide-react';
import { planMonthKey, type CalendarPlanStatus, type RowStatus } from '@mmp/shared';

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
  calendar?: string;
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
  const { user } = useAuth();
  const navigate = useNavigate();
  // Plan row review is the Creative Head's alone (PG-3); others see the queue read-only.
  const canReview = user?.role === 'creative_head';
  // Review controls on this page are for individual plans; monthly plans are reviewed in the plan grid.
  const canReviewHere = (plan: { kind: string }) => canReview && plan.kind !== 'monthly';
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
      <div className="glass-card p-8 text-center text-xs text-ui-muted">
        Loading plans waiting for Creative Head approval...
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-3">
        <div className="w-12 h-12 status-tint status-approved rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-ui-ink">All Plans Approved!</h3>
        <p className="text-xs text-ui-muted max-w-sm mx-auto">
          There are currently no submitted monthly or project calendar plans waiting for Creative Head review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbackSuccess && (
        <div role="status" className="p-3 status-tint status-approved rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {feedbackSuccess}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-ui-muted">
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
              className="glass-card overflow-hidden"
            >
              {/* Plan Card Header */}
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => handleToggleExpand(plan._id)}
                className="w-full text-left p-4 hover:bg-ui-card-hover flex items-center justify-between gap-4 rounded-ui-card"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-white/70 text-ui-ink flex items-center justify-center font-semibold text-xs shrink-0">
                    #{index + 1}
                  </span>
                  <span className="block min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ui-ink bg-white/70 px-2 py-0.5 rounded">
                        {plan.code}
                      </span>
                      <span className="text-sm font-semibold text-ui-ink">{plan.title}</span>
                      <span className="status-chip status-waiting text-[11px] font-semibold px-2 py-0.5">
                        {plan.status}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-ui-muted">
                      <span>Submitted by {plan.createdById?.name || 'SM Manager'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-ui-text font-semibold">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        Waiting since {submittedDate.toLocaleDateString()} {submittedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-ui-text">
                        {plan.submittedRowCount || submittedRows.length} rows awaiting review
                      </span>
                    </span>
                  </span>
                </span>

                <span className="text-ui-muted shrink-0" aria-hidden="true">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </button>

              {/* Expanded Review Section */}
              {isExpanded && (
                <div className="border-t border-ui-line p-4 space-y-4">
                  {/* Creative Head Action Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-white/60 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-ui-ink" aria-hidden="true" />
                      <span className="text-xs font-semibold text-ui-ink">Creative Head Review Actions:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {plan.kind === 'monthly' && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(planGridHref({ calendar: plan.calendar || 'sm', month: planMonthKey(plan.periodStart), planId: plan._id }))
                          }
                          className="ui-btn ui-btn-secondary h-11"
                        >
                          <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                          {canReview ? 'Review in plan grid' : 'View in plan grid'}
                        </button>
                      )}
                      {!canReview && plan.kind !== 'monthly' && (
                        <p className="text-xs text-ui-muted">Only the Creative Head can approve or return plan rows.</p>
                      )}
                      {plan.kind === 'monthly' && (
                        <p className="text-xs text-ui-muted">Monthly plans are reviewed row by row in the plan grid.</p>
                      )}
                      {/* Individual plans are not in the grid, so their review stays here. */}
                      {canReview && plan.kind !== 'monthly' && (<>
                      <button
                        type="button"
                        onClick={() => handleReview(plan._id, 'approve_all')}
                        disabled={isSubmittingReview}
                        className="ui-btn ui-btn-primary h-11"
                      >
                        Approve All Rows
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReview(plan._id, 'approve_selected')}
                        disabled={isSubmittingReview || selectedRowIds.length === 0}
                        className="ui-btn ui-btn-secondary h-11"
                      >
                        Approve Selected ({selectedRowIds.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReview(plan._id, 'request_changes')}
                        disabled={isSubmittingReview}
                        className="ui-btn ui-btn-secondary h-11"
                      >
                        Request Changes with Comments
                      </button>
                      </>)}
                    </div>
                  </div>

                  {/* Rows Table */}
                  <div className="overflow-x-auto rounded-xl bg-white">
                    <table className="ui-table w-full text-left text-xs">
                      <thead className="text-ui-muted font-medium border-b border-ui-line">
                        <tr>
                          {canReviewHere(plan) && <th className="p-1 w-11">
                            <label className="inline-flex items-center justify-center w-11 h-11 cursor-pointer">
                            <input
                              type="checkbox"
                              aria-label="Select all submitted rows"
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
                              className="w-4 h-4 accent-ui-ink"
                            />
                            </label>
                          </th>}
                          <th className="p-3">#</th>
                          <th className="p-3">Posting Date</th>
                          <th className="p-3">Topic</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Flags</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 min-w-[200px]">Revision Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ui-line">
                        {(plan.rows || []).map((row, rIdx) => {
                          const isSubmitted = row.rowStatus === 'submitted';
                          const isRowChecked = selectedRowIds.includes(row._id);

                          return (
                            <tr
                              key={row._id}
                              className={`hover:bg-ui-card-hover transition-colors ${
                                isRowChecked ? 'bg-ui-blue-soft/40' : ''
                              }`}
                            >
                              {canReviewHere(plan) && <td className="p-1">
                                {isSubmitted && (
                                  <label className="inline-flex items-center justify-center w-11 h-11 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select row ${rIdx + 1}`}
                                    checked={isRowChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRowIds([...selectedRowIds, row._id]);
                                      } else {
                                        setSelectedRowIds(selectedRowIds.filter((id) => id !== row._id));
                                      }
                                    }}
                                    className="w-4 h-4 accent-ui-ink"
                                  />
                                  </label>
                                )}
                              </td>}
                              <td className="p-3 font-mono text-ui-muted">{rIdx + 1}</td>
                              <td className="p-3 font-semibold text-ui-text whitespace-nowrap">
                                {new Date(row.postingDate).toLocaleDateString()}
                              </td>
                              <td className="p-3 font-medium text-ui-ink max-w-[200px] truncate" title={row.topic}>
                                {row.topic}
                              </td>
                              <td className="p-3 font-semibold text-ui-text whitespace-nowrap">
                                {row.contentType}
                              </td>
                              <td className="p-3 text-[11px] text-ui-muted whitespace-nowrap">
                                {row.contentType.toLowerCase().includes('reel') ? (
                                  <div className="flex items-center gap-1">
                                    {row.needsScript && (
                                      <span className="px-1.5 py-0.5 rounded bg-white/70 text-ui-text border border-ui-line">Script</span>
                                    )}
                                    {row.needsShoot && (
                                      <span className="px-1.5 py-0.5 rounded bg-white/70 text-ui-text border border-ui-line">Shoot</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-ui-muted">—</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span
                                  className={`status-chip text-[11px] font-semibold px-2 py-0.5 ${
                                    row.rowStatus === 'approved'
                                      ? 'status-approved'
                                      : row.rowStatus === 'submitted'
                                      ? 'status-waiting'
                                      : row.rowStatus === 'changes_requested'
                                      ? 'status-changes'
                                      : 'status-not-started'
                                  }`}
                                >
                                  {row.rowStatus}
                                </span>
                              </td>
                              <td className="p-3">
                                {isSubmitted && canReviewHere(plan) ? (
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
                                    aria-label={`Revision note for row ${rIdx + 1}`}
                                    className="ui-input w-full"
                                  />
                                ) : row.reviewComment ? (
                                  <span className="text-[11px] text-ui-text italic">{row.reviewComment}</span>
                                ) : (
                                  <span className="text-ui-muted">—</span>
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
