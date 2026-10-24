import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  X,
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  Sparkles,
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
  stagesGenerated?: boolean;
}

interface CalendarPlan {
  _id: string;
  code: string;
  title: string;
  kind: 'monthly' | 'project';
  periodStart: string;
  periodEnd: string;
  status: CalendarPlanStatus;
  comment?: string;
  submittedAt?: string;
  approvedAt?: string;
  createdById?: { _id: string; name: string; email: string };
  approvedById?: { _id: string; name: string; email: string };
  rowCount: number;
  approvedRowCount: number;
  submittedRowCount: number;
  changesRequestedRowCount: number;
  draftRowCount: number;
  rows?: PlanRow[];
}

interface ValidationPreviewRow {
  rowNumber: number;
  topic: string;
  contentType: string;
  postingDate: string;
  needsScript: boolean;
  needsShoot: boolean;
  contentLink: string;
  remarks: string;
  isValid: boolean;
  errors: string[];
}

interface ValidationPreviewResponse {
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  previewRows: ValidationPreviewRow[];
}

const STATUS_BADGES: Record<CalendarPlanStatus, { bg: string; text: string; border: string; label: string }> = {
  Draft: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Draft' },
  Submitted: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Submitted for Review' },
  'Changes requested': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Changes Requested' },
  Approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Approved' },
  'Approved with pending rows': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Approved (Pending Rows)' },
};

const ROW_STATUS_BADGES: Record<RowStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-slate-100 text-slate-700', text: 'text-slate-700', label: 'Draft' },
  submitted: { bg: 'bg-amber-100 text-amber-800', text: 'text-amber-800', label: 'Submitted' },
  changes_requested: { bg: 'bg-rose-100 text-rose-800', text: 'text-rose-800', label: 'Changes Requested' },
  approved: { bg: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-800', label: 'Approved' },
};

export const PlansTab: React.FC = () => {
  const { user } = useAuth();
  const isExecutive = user?.role === 'executive';
  const isCreativeHead = user?.role === 'creative_head' || user?.role === 'admin';
  const isSMManager = user?.role === 'sm_manager' || user?.role === 'admin';

  // Plans List State
  const [plans, setPlans] = useState<CalendarPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<CalendarPlan | null>(null);

  // Create Plan Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<'monthly' | 'project'>('monthly');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Upload & Import Preview State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPlanId, setUploadPlanId] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ValidationPreviewResponse | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Row Grid Edit / Add State
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [rowPostingDate, setRowPostingDate] = useState('');
  const [rowTopic, setRowTopic] = useState('');
  const [rowType, setRowType] = useState('Reel A');
  const [rowNeedsScript, setRowNeedsScript] = useState(true);
  const [rowNeedsShoot, setRowNeedsShoot] = useState(true);
  const [rowContentLink, setRowContentLink] = useState('');
  const [rowRemarks, setRowRemarks] = useState('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Creative Head Review State
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [rowComments, setRowComments] = useState<Record<string, string>>({});
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: CalendarPlan[] }>('/api/calendar-plans');
      setPlans(res.data || []);
      if (selectedPlan) {
        const updated = (res.data || []).find((p) => p._id === selectedPlan._id);
        if (updated) {
          fetchPlanDetails(updated._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch calendar plans', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanDetails = async (id: string) => {
    try {
      const res = await apiFetch<{ data: CalendarPlan }>(`/api/calendar-plans/${id}`);
      setSelectedPlan(res.data);
      setSelectedRowIds([]);
    } catch (err) {
      console.error('Failed to fetch plan details', err);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // Template Download
  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/api/calendar-plans/template';
    link.download = 'calendar_plan_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create Plan Submit
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStart || !newEnd) {
      setCreateError('Title, period start, and period end are required');
      return;
    }
    setIsSubmittingPlan(true);
    setCreateError(null);
    try {
      const res = await apiFetch<{ data: CalendarPlan }>('/api/calendar-plans', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          kind: newKind,
          periodStart: newStart,
          periodEnd: newEnd,
          comment: newComment.trim(),
        }),
      });
      setIsCreateOpen(false);
      setNewTitle('');
      setNewComment('');
      await fetchPlans();
      if (res.data) {
        await fetchPlanDetails(res.data._id);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create plan');
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  // Handle File Selection & Validation Preview
  const handlePreviewUpload = async (file: File) => {
    setSelectedFile(file);
    setIsPreviewLoading(true);
    setImportError(null);
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token =
        localStorage.getItem('accessToken') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('token');
      const response = await fetch('/api/calendar-plans/preview', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || res.message || 'Validation preview failed');
      }
      setPreviewData(res.data);
    } catch (err: any) {
      setImportError(err.message || 'Failed to validate uploaded file');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Commit Previewed Rows
  const handleCommitUpload = async () => {
    if (!previewData || !uploadPlanId) {
      setImportError('Please select a target plan for committing rows');
      return;
    }

    const validRows = previewData.previewRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setImportError('No valid rows available to commit');
      return;
    }

    setIsCommitting(true);
    setImportError(null);
    try {
      await apiFetch(`/api/calendar-plans/${uploadPlanId}/rows`, {
        method: 'POST',
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            postingDate: r.postingDate,
            topic: r.topic,
            contentType: r.contentType,
            needsScript: r.needsScript,
            needsShoot: r.needsShoot,
            contentLink: r.contentLink,
            remarks: r.remarks,
          })),
        }),
      });

      setIsUploadOpen(false);
      setPreviewData(null);
      setSelectedFile(null);
      await fetchPlans();
      await fetchPlanDetails(uploadPlanId);
    } catch (err: any) {
      setImportError(err.message || 'Failed to commit rows to plan');
    } finally {
      setIsCommitting(false);
    }
  };

  // Submit Plan for Approval
  const handleSubmitPlan = async (planId: string) => {
    try {
      await apiFetch(`/api/calendar-plans/${planId}/submit`, { method: 'POST' });
      await fetchPlans();
      await fetchPlanDetails(planId);
    } catch (err: any) {
      alert(err.message || 'Failed to submit plan');
    }
  };

  // Add / Edit Row in Plan Grid
  const handleSaveRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!rowTopic.trim() || !rowPostingDate) {
      alert('Topic and posting date are required');
      return;
    }

    try {
      if (editingRowId) {
        await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows/${editingRowId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            topic: rowTopic.trim(),
            postingDate: rowPostingDate,
            contentType: rowType,
            needsScript: rowType.toLowerCase().includes('reel') ? rowNeedsScript : false,
            needsShoot: rowType.toLowerCase().includes('reel') ? rowNeedsShoot : false,
            contentLink: rowContentLink.trim(),
            remarks: rowRemarks.trim(),
          }),
        });
      } else {
        await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows`, {
          method: 'POST',
          body: JSON.stringify({
            rows: [
              {
                topic: rowTopic.trim(),
                postingDate: rowPostingDate,
                contentType: rowType,
                needsScript: rowType.toLowerCase().includes('reel') ? rowNeedsScript : false,
                needsShoot: rowType.toLowerCase().includes('reel') ? rowNeedsShoot : false,
                contentLink: rowContentLink.trim(),
                remarks: rowRemarks.trim(),
              },
            ],
          }),
        });
      }

      setIsAddRowOpen(false);
      setEditingRowId(null);
      setRowTopic('');
      setRowPostingDate('');
      setRowContentLink('');
      setRowRemarks('');
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to save row');
    }
  };

  // Delete Row
  const handleDeleteRow = async (rowId: string) => {
    if (!selectedPlan || !confirm('Are you sure you want to delete this row?')) return;
    try {
      await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows/${rowId}`, {
        method: 'DELETE',
      });
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete row');
    }
  };

  // Creative Head Review Actions (approve_all, approve_selected, request_changes)
  const handleReviewPlan = async (action: 'approve_all' | 'approve_selected' | 'request_changes') => {
    if (!selectedPlan) return;
    setIsReviewSubmitting(true);
    setReviewSuccessMsg(null);

    try {
      const payload: any = { action };
      if (action === 'approve_selected') {
        if (selectedRowIds.length === 0) {
          alert('Please select at least one row to approve');
          setIsReviewSubmitting(false);
          return;
        }
        payload.approvedRowIds = selectedRowIds;
        payload.selectedRowIds = selectedRowIds;
      }

      if (action === 'request_changes') {
        const comments: Record<string, string> = {};
        const changes: Array<{ rowId: string; comment: string }> = [];
        const targetIds = selectedRowIds.length > 0 ? selectedRowIds : (selectedPlan.rows || []).map((r) => r._id);
        let hasComment = false;
        for (const rid of targetIds) {
          if (rowComments[rid]?.trim()) {
            comments[rid] = rowComments[rid].trim();
            changes.push({ rowId: rid, comment: rowComments[rid].trim() });
            hasComment = true;
          }
        }
        if (!hasComment) {
          alert('Please enter a review comment explaining requested changes for at least one row');
          setIsReviewSubmitting(false);
          return;
        }
        payload.comments = comments;
        payload.changes = changes;
      }

      const res = await apiFetch<{ data: CalendarPlan; message: string }>(
        `/api/calendar-plans/${selectedPlan._id}/review`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setReviewSuccessMsg(res.message || 'Review completed successfully');
      setSelectedRowIds([]);
      setRowComments({});
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-card p-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-purple-600" />
            Calendar Plans Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create monthly campaigns, validate spreadsheet imports, and manage Creative Head row-by-row approvals.
          </p>
        </div>

        {/* Action Controls (Hidden for Executive read-only) */}
        {!isExecutive && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              title="Download Excel template (Posting Date, Topic, Type, Needs Script, Needs Shoot, Content Link, Remarks)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Download Template
            </button>

            {isSMManager && (
              <>
                <button
                  onClick={() => {
                    setIsUploadOpen(true);
                    setPreviewData(null);
                    setSelectedFile(null);
                    setImportError(null);
                    setUploadPlanId(selectedPlan?._id || plans[0]?._id || '');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload & Preview
                </button>

                <button
                  onClick={() => {
                    setIsCreateOpen(true);
                    setCreateError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-200 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Plan
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Plans List + Selected Plan Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Plans Table */}
        <div className={selectedPlan ? 'lg:col-span-5' : 'lg:col-span-12'}>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                All Plans ({plans.length})
              </span>
              {isLoading && <span className="text-xs text-slate-400">Loading...</span>}
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {plans.length === 0 && !isLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No calendar plans created yet. Click "New Plan" or "Upload & Preview" to get started.
                </div>
              ) : (
                plans.map((p) => {
                  const badge = STATUS_BADGES[p.status] || STATUS_BADGES.Draft;
                  const isSelected = selectedPlan?._id === p._id;
                  return (
                    <div
                      key={p._id}
                      onClick={() => fetchPlanDetails(p._id)}
                      className={`p-4 cursor-pointer transition-all hover:bg-slate-50 ${
                        isSelected ? 'bg-purple-50/60 border-l-4 border-purple-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded">
                              {p.code}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{p.title}</h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500 font-medium">
                        <span>Total: {p.rowCount} rows</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">{p.approvedRowCount} approved</span>
                        <span>•</span>
                        <span className="text-amber-700 font-semibold">{p.submittedRowCount} submitted</span>
                        {p.changesRequestedRowCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-rose-700 font-semibold">{p.changesRequestedRowCount} changes</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Plan Detail & Editable Rows Grid */}
        {selectedPlan && (
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              {/* Plan Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                      {selectedPlan.code}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        STATUS_BADGES[selectedPlan.status]?.bg
                      } ${STATUS_BADGES[selectedPlan.status]?.text} ${
                        STATUS_BADGES[selectedPlan.status]?.border
                      }`}
                    >
                      {STATUS_BADGES[selectedPlan.status]?.label}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedPlan.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Period: {new Date(selectedPlan.periodStart).toLocaleDateString()} –{' '}
                    {new Date(selectedPlan.periodEnd).toLocaleDateString()} • Created by{' '}
                    {selectedPlan.createdById?.name || 'SM Manager'}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedPlan(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Success Alert */}
              {reviewSuccessMsg && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  {reviewSuccessMsg}
                </div>
              )}

              {/* Action Toolbar for SM Manager (Submit) & Creative Head (Review) */}
              {!isExecutive && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {isSMManager && (selectedPlan.status === 'Draft' || selectedPlan.status === 'Changes requested') && (
                      <>
                        <button
                          onClick={() => {
                            setEditingRowId(null);
                            setRowTopic('');
                            setRowPostingDate('');
                            setRowContentLink('');
                            setRowRemarks('');
                            setIsAddRowOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Row
                        </button>

                        <button
                          onClick={() => handleSubmitPlan(selectedPlan._id)}
                          className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Submit for Approval
                        </button>
                      </>
                    )}
                  </div>

                  {/* Creative Head Review Controls */}
                  {isCreativeHead && (selectedPlan.status === 'Submitted' || (selectedPlan.rows || []).some(r => r.rowStatus === 'submitted')) && (
                    <div className="flex items-center gap-2 flex-wrap bg-amber-50/70 p-2 rounded-xl border border-amber-200/70">
                      <span className="text-[11px] font-bold text-amber-900 mr-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        Review Mode:
                      </span>

                      <button
                        onClick={() => handleReviewPlan('approve_all')}
                        disabled={isReviewSubmitting}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Approve All
                      </button>

                      <button
                        onClick={() => handleReviewPlan('approve_selected')}
                        disabled={isReviewSubmitting || selectedRowIds.length === 0}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Approve Selected ({selectedRowIds.length})
                      </button>

                      <button
                        onClick={() => handleReviewPlan('request_changes')}
                        disabled={isReviewSubmitting}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Request Changes
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Rows Grid */}
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      {isCreativeHead && (
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              (selectedPlan.rows || []).length > 0 &&
                              selectedRowIds.length === (selectedPlan.rows || []).filter(r => r.rowStatus === 'submitted').length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRowIds(
                                  (selectedPlan.rows || [])
                                    .filter((r) => r.rowStatus === 'submitted')
                                    .map((r) => r._id)
                                );
                              } else {
                                setSelectedRowIds([]);
                              }
                            }}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                        </th>
                      )}
                      <th className="p-3">#</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Topic</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Flags</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Review Feedback</th>
                      {!isExecutive && <th className="p-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedPlan.rows || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400">
                          No rows in this plan yet. Use "Add Row" or upload via Excel.
                        </td>
                      </tr>
                    ) : (
                      (selectedPlan.rows || []).map((row, idx) => {
                        const statusBadge = ROW_STATUS_BADGES[row.rowStatus] || ROW_STATUS_BADGES.draft;
                        const isRowChecked = selectedRowIds.includes(row._id);

                        return (
                          <tr
                            key={row._id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isRowChecked ? 'bg-purple-50/30' : ''
                            }`}
                          >
                            {isCreativeHead && (
                              <td className="p-3">
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
                              </td>
                            )}
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                              {new Date(row.postingDate).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-medium text-slate-900 max-w-[180px] truncate" title={row.topic}>
                              {row.topic}
                            </td>
                            <td className="p-3 font-semibold text-purple-700 whitespace-nowrap">
                              {row.contentType}
                            </td>
                            <td className="p-3 text-[11px] text-slate-500 whitespace-nowrap">
                              {row.contentType.toLowerCase().includes('reel') ? (
                                <div className="flex items-center gap-1">
                                  {row.needsScript && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Script</span>}
                                  {row.needsShoot && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Shoot</span>}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge.bg}`}>
                                {statusBadge.label}
                              </span>
                            </td>
                            <td className="p-3 max-w-[200px]">
                              {isCreativeHead && row.rowStatus === 'submitted' ? (
                                <input
                                  type="text"
                                  placeholder="Comment for revision..."
                                  value={rowComments[row._id] || ''}
                                  onChange={(e) =>
                                    setRowComments({
                                      ...rowComments,
                                      [row._id]: e.target.value,
                                    })
                                  }
                                  className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                />
                              ) : row.reviewComment ? (
                                <div className="text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-100 flex items-start gap-1">
                                  <MessageSquare className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-2">{row.reviewComment}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            {!isExecutive && (
                              <td className="p-3 text-right whitespace-nowrap">
                                {(row.rowStatus === 'draft' || row.rowStatus === 'changes_requested') && (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingRowId(row._id);
                                        setRowTopic(row.topic);
                                        setRowPostingDate(row.postingDate.substring(0, 10));
                                        setRowType(row.contentType);
                                        setRowNeedsScript(row.needsScript ?? true);
                                        setRowNeedsShoot(row.needsShoot ?? true);
                                        setRowContentLink(row.contentLink || '');
                                        setRowRemarks(row.remarks || '');
                                        setIsAddRowOpen(true);
                                      }}
                                      className="p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                                      title="Edit row"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRow(row._id)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                      title="Delete row"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload & Validation Preview Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-900">Upload Plan & Validation Preview</h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Target Plan Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Target Plan</label>
                <select
                  value={uploadPlanId}
                  onChange={(e) => setUploadPlanId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">Select a plan...</option>
                  {plans.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.code} — {p.title} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* File Dropzone */}
              <div className="border-2 border-dashed border-purple-200 bg-purple-50/30 rounded-2xl p-6 text-center">
                <input
                  type="file"
                  id="excel-file-input"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePreviewUpload(file);
                  }}
                />
                <label
                  htmlFor="excel-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-10 h-10 text-purple-500" />
                  <span className="text-xs font-bold text-purple-700">
                    {selectedFile ? selectedFile.name : 'Click to select Excel (.xlsx) or CSV file'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Columns: Posting Date, Topic, Type, Needs Script, Needs Shoot, Content Link, Remarks
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {importError}
                </div>
              )}

              {/* Loading Indicator */}
              {isPreviewLoading && (
                <div className="text-center py-6 text-xs text-purple-600 font-semibold">
                  Validating rows against due date, types, and duplicate constraints...
                </div>
              )}

              {/* Validation Summary & Preview Table */}
              {previewData && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Total Rows</span>
                      <p className="text-lg font-extrabold text-slate-800">{previewData.totalRows}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase">Valid Rows</span>
                      <p className="text-lg font-extrabold text-emerald-700">{previewData.validRowsCount}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                      <span className="text-[11px] font-bold text-rose-700 uppercase">Invalid Rows</span>
                      <p className="text-lg font-extrabold text-rose-700">{previewData.errorRowsCount}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Topic</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Validation Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.previewRows.map((r) => (
                          <tr key={r.rowNumber} className={r.isValid ? 'bg-white' : 'bg-rose-50/50'}>
                            <td className="p-2.5 font-mono text-slate-400">{r.rowNumber}</td>
                            <td className="p-2.5 whitespace-nowrap">{r.postingDate || '—'}</td>
                            <td className="p-2.5 font-medium text-slate-800 max-w-[150px] truncate">{r.topic}</td>
                            <td className="p-2.5 text-purple-700 font-semibold">{r.contentType}</td>
                            <td className="p-2.5">
                              {r.isValid ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  Valid
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  {r.errors.map((err, i) => (
                                    <span
                                      key={i}
                                      className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 mr-1"
                                    >
                                      {err}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsUploadOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>

              {previewData && previewData.validRowsCount > 0 && (
                <button
                  onClick={handleCommitUpload}
                  disabled={isCommitting || !uploadPlanId}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" />
                  {isCommitting ? 'Committing...' : `Commit ${previewData.validRowsCount} Valid Rows as Draft`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create New Calendar Plan</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="py-4 space-y-3">
              {createError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                  {createError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Plan Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. November 2026 Content Grid"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Plan Kind</label>
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="monthly">Monthly Grid</option>
                  <option value="project">Project Campaign</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Period Start</label>
                  <input
                    type="date"
                    required
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Period End</label>
                  <input
                    type="date"
                    required
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Optional Notes</label>
                <textarea
                  rows={2}
                  placeholder="Campaign goals, theme or remarks..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPlan}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200 disabled:opacity-50"
                >
                  {isSubmittingPlan ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Row Modal */}
      {isAddRowOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingRowId ? 'Edit Plan Row' : 'Add Row to Plan'}
              </h3>
              <button
                onClick={() => setIsAddRowOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRow} className="py-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Topic / Working Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5 Tech Tips for Startups"
                  value={rowTopic}
                  onChange={(e) => setRowTopic(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Posting Date (Final F)</label>
                  <input
                    type="date"
                    required
                    value={rowPostingDate}
                    onChange={(e) => setRowPostingDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Content Type</label>
                  <select
                    value={rowType}
                    onChange={(e) => setRowType(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="Reel A">Reel A</option>
                    <option value="Reel B">Reel B</option>
                    <option value="Reel C">Reel C</option>
                    <option value="Static Post">Static Post (Design)</option>
                    <option value="Carousel">Carousel (Design)</option>
                    <option value="Story">Story</option>
                  </select>
                </div>
              </div>

              {rowType.toLowerCase().includes('reel') && (
                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rowNeedsScript}
                      onChange={(e) => setRowNeedsScript(e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    Needs Script
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rowNeedsShoot}
                      onChange={(e) => setRowNeedsShoot(e.target.checked)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    Needs Shoot
                  </label>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Content Link / Drive URL</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={rowContentLink}
                  onChange={(e) => setRowContentLink(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="Additional context or references"
                  value={rowRemarks}
                  onChange={(e) => setRowRemarks(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddRowOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200"
                >
                  {editingRowId ? 'Save Changes' : 'Add Row'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
