import React, { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { apiFetch } from '../../lib/api';
import {
  DEPARTMENTS,
  JOB_ROLES,
  ROLE_KEYS,
  ROLE_LABELS,
  type UserRole,
} from '@mmp/shared';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  X,
  UserCheck,
  Building,
  Briefcase,
  Phone,
  Mail,
} from 'lucide-react';
import { Avatar } from '../../components/Avatar';

interface AccessRequestItem {
  _id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  departmentId?: { _id: string; name: string; code: string } | string;
  jobRole: string;
  requestedRole: UserRole;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'info_needed';
  createdAt: string;
  reviewedBy?: { _id: string; name: string; email: string; role: string };
  reviewedAt?: string;
  assignedRole?: UserRole;
  assignedJobRole?: string;
  assignedDepartmentId?: { _id: string; name: string; code: string };
  assignedReportsToIds?: Array<{ _id: string; name: string; email: string; jobRole?: string }>;
  assignedCapacity?: number;
  rejectReason?: string;
  infoQuestion?: string;
}

export const AccessRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [deptOptions, setDeptOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [selectedRequest, setSelectedRequest] = useState<AccessRequestItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'info' | null>(null);
  // Action modal keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const actionDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(actionDialogRef, !!(selectedRequest && actionType), () => {
    setSelectedRequest(null);
    setActionType(null);
  });

  // Approve dialog form fields
  const [assignedRole, setAssignedRole] = useState<UserRole>('team_member');
  const [assignedJobRole, setAssignedJobRole] = useState<string>('');
  const [assignedDept, setAssignedDept] = useState<string>('');
  const [assignedReportsTo, setAssignedReportsTo] = useState<string[]>([]);
  const [assignedCapacity, setAssignedCapacity] = useState<number>(40);

  // Reject / Info dialog state
  const [actionReason, setActionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllPending = () => {
    const pending = filteredRequests.filter((r) => r.status === 'pending').map((r) => r._id);
    if (selectedIds.length === pending.length && pending.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pending);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Bulk approve and generate onboarding invites for ${selectedIds.length} candidate(s)?`)) return;
    setIsBulkApproving(true);
    try {
      const res = await apiFetch<{ message: string; data: Array<{ id: string; success: boolean }> }>(
        '/admin/access-requests/bulk-approve',
        {
          method: 'POST',
          body: JSON.stringify({ requestIds: selectedIds, defaultRole: 'team_member', defaultCapacity: 40 }),
        }
      );
      alert(res.message || `Successfully processed ${selectedIds.length} access requests.`);
      setSelectedIds([]);
      await fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to bulk approve requests');
    } finally {
      setIsBulkApproving(false);
    }
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (deptFilter !== 'all') params.append('department', deptFilter);

      const res = await apiFetch<{ data: AccessRequestItem[] }>(
        `/admin/access-requests?${params.toString()}`
      );
      setRequests(res.data || []);
      // Filter options come from the requests themselves. Keep ones already seen, so narrowing the list does not remove them.
      setDeptOptions((prev) => {
        const names = new Set(prev);
        (res.data || []).forEach((r) => {
          if (r.department) names.add(r.department);
        });
        return Array.from(names).sort((a, b) => a.localeCompare(b));
      });
    } catch (err) {
      console.error('Failed to fetch requests', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, deptFilter]);

  const openApproveModal = (req: AccessRequestItem) => {
    setSelectedRequest(req);
    setActionType('approve');
    setAssignedRole(req.requestedRole || 'team_member');
    setAssignedJobRole(req.jobRole || JOB_ROLES[0]);
    setAssignedDept(req.department || DEPARTMENTS[0].name);
    setAssignedReportsTo([]);
    setAssignedCapacity(40);
    setActionReason('');
    setActionMessage(null);
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    setIsSubmitting(true);
    setActionMessage(null);

    try {
      if (actionType === 'approve') {
        await apiFetch(`/admin/access-requests/${selectedRequest._id}/approve`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'approved',
            assignedRole,
            jobRole: assignedJobRole,
            departmentId: assignedDept,
            department: assignedDept,
            reportsToIds: assignedReportsTo,
            weeklyCapacityHours: Number(assignedCapacity),
          }),
        });
        setActionMessage(`Approved ${selectedRequest.name}! Activation invite dispatched.`);
      } else if (actionType === 'reject') {
        if (!actionReason.trim()) {
          alert('Please enter a rejection reason.');
          setIsSubmitting(false);
          return;
        }
        await apiFetch(`/admin/access-requests/${selectedRequest._id}/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: actionReason }),
        });
        setActionMessage(`Rejected request from ${selectedRequest.name}.`);
      } else if (actionType === 'info') {
        if (!actionReason.trim()) {
          alert('Please enter a question for the applicant.');
          setIsSubmitting(false);
          return;
        }
        await apiFetch(`/admin/access-requests/${selectedRequest._id}/info`, {
          method: 'PATCH',
          body: JSON.stringify({ question: actionReason }),
        });
        setActionMessage(`Information request sent to ${selectedRequest.name}.`);
      }

      await fetchRequests();
      setTimeout(() => {
        setActionType(null);
        setSelectedRequest(null);
        setActionReason('');
        setActionMessage(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.jobRole && r.jobRole.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">
              Access Requests
            </h1>
            {pendingCount > 0 && (
              <span className="status-chip status-waiting text-xs font-semibold px-3 py-1">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-ui-muted mt-1">
            Review public registrations, confirm role scope, and issue activation invites.
          </p>
        </div>

        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={isBulkApproving}
            className="ui-btn ui-btn-primary h-11 gap-2 self-start sm:self-auto"
          >
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>{isBulkApproving ? 'Approving...' : `Bulk Approve (${selectedIds.length})`}</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="ui-tabs flex-wrap max-w-full rounded-ui-card">
          {/* Status Pills */}
          {(['pending', 'approved', 'rejected', 'info_needed', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={statusFilter === st}
              onClick={() => setStatusFilter(st)}
              className={`ui-tab capitalize ${statusFilter === st ? 'is-active' : ''}`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Department & Search dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          {deptOptions.length > 0 && (
            <select
              aria-label="Department"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="ui-select cursor-pointer"
            >
              <option value="all">All Departments</option>
              {deptOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          {/* Search box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted" />
            <input
              aria-label="Search candidate"
              type="text"
              placeholder="Search candidate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ui-input w-full pl-8 pr-3"
            />
          </div>
        </div>
      </div>

      {/* Select All Pending checkbox if there are pending items */}
      {statusFilter === 'pending' && filteredRequests.length > 0 && (
        <div className="flex items-center gap-2 pl-2 text-xs text-ui-text">
          <input
            type="checkbox"
            id="selectAllPending"
            checked={selectedIds.length === filteredRequests.length && filteredRequests.length > 0}
            onChange={selectAllPending}
            className="w-4 h-4 rounded text-ui-ink focus:ring-ui-ink cursor-pointer"
          />
          <label htmlFor="selectAllPending" className="cursor-pointer font-medium">
            Select all {filteredRequests.length} pending request(s)
          </label>
        </div>
      )}

      {/* Request Cards Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-ui-muted animate-pulse">
          Loading access requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <h3 className="text-base font-bold text-ui-ink">No requests found</h3>
          <p className="text-xs text-ui-muted mt-1">
            There are currently no access requests matching the selected filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRequests.map((req) => {
            return (
              <div
                key={req._id}
                className={`glass-card p-5 sm:p-6 flex flex-col justify-between ${
                  selectedIds.includes(req._id) ? 'outline outline-2 outline-ui-ink' : ''
                }`}
              >
                <div>
                  {/* Top user bar */}
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0 max-w-full">
                      {req.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(req._id)}
                          onChange={() => toggleSelect(req._id)}
                          className="w-4 h-4 rounded text-ui-ink focus:ring-ui-ink cursor-pointer"
                          title="Select for bulk approve"
                        />
                      )}
                      <Avatar
                        name={req.name}
                        userId={req._id}
                        size="md"
                      />
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-ui-ink leading-snug truncate">{req.name}</h3>
                        <div className="text-[11px] text-ui-muted flex items-center gap-1 min-w-0">
                          <Mail className="w-3 h-3 text-ui-muted shrink-0" aria-hidden="true" />
                          <span className="truncate" title={req.email}>{req.email}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`status-chip text-[11px] font-semibold px-2.5 py-1 capitalize shrink-0 ${
                        req.status === 'pending'
                          ? 'status-waiting'
                          : req.status === 'approved'
                          ? 'status-approved'
                          : req.status === 'rejected'
                          ? 'status-changes'
                          : 'status-in-progress'
                      }`}
                    >
                      {req.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Submitted attributes info box */}
                  <div className="space-y-1.5 text-xs text-ui-text bg-white/70 p-3.5 rounded-2xl border border-ui-line my-3">
                    <div className="flex justify-between items-center">
                      <span className="text-ui-muted flex items-center gap-1">
                        <Building className="w-3 h-3" /> Department:
                      </span>
                      <span className="font-semibold text-ui-ink">{req.department}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-ui-muted flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> Job Role:
                      </span>
                      <span className="font-semibold text-ui-ink">{req.jobRole || 'None specified'}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-ui-muted flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Requested Role:
                      </span>
                      <span className="font-bold text-ui-ink capitalize">
                        {req.requestedRole?.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-ui-muted flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone:
                      </span>
                      <span className="text-ui-text">{req.phone}</span>
                    </div>
                  </div>

                  {/* Reason text */}
                  <div className="mb-3">
                    <span className="text-[11px] text-ui-muted font-bold block mb-1">
                      Reason for Access
                    </span>
                    <p className="text-xs text-ui-text bg-white/50 p-2.5 rounded-xl border border-ui-line line-clamp-3">
                      {req.reason}
                    </p>
                  </div>

                  {/* Review Outcome info if not pending */}
                  {req.status === 'approved' && (
                    <div className="mt-3 p-3 status-tint status-approved rounded-xl text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved by {req.reviewedBy?.name || 'Admin'}
                      </div>
                      <div className="text-ui-text">
                        Assigned: <strong className="text-ui-ink">{req.assignedRole?.replace('_', ' ')}</strong> ({req.assignedCapacity || 40}h/wk)
                      </div>
                    </div>
                  )}

                  {req.status === 'rejected' && req.rejectReason && (
                    <div className="mt-3 p-3 status-tint status-changes rounded-xl text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Rejection Reason
                      </div>
                      <p className="text-ui-text">{req.rejectReason}</p>
                    </div>
                  )}

                  {req.status === 'info_needed' && req.infoQuestion && (
                    <div className="mt-3 p-3 status-tint status-in-progress rounded-xl text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" /> Clarification Question
                      </div>
                      <p className="text-ui-text">{req.infoQuestion}</p>
                    </div>
                  )}
                </div>

                {/* Actions for Pending or Info Needed Requests */}
                {req.status === 'pending' && (
                  <div className="pt-4 border-t border-ui-line flex items-center justify-between gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => openApproveModal(req)}
                      className="ui-btn ui-btn-primary h-11 flex-1 min-w-0 px-3 gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Approve</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequest(req);
                        setActionType('reject');
                        setActionReason('');
                      }}
                      className="ui-btn ui-btn-secondary h-11 flex-1 min-w-0 px-3 gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRequest(req);
                        setActionType('info');
                        setActionReason('');
                      }}
                      type="button"
                      title="Request More Info"
                      aria-label="Request More Info"
                      className="ui-icon-btn shrink-0"
                    >
                      <HelpCircle className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Modal (Approve, Reject, or Info) */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 ui-scrim">
          <div
            ref={actionDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-action-title"
            className="glass-modal max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-ui-line mb-5">
              <div>
                <h3 id="access-action-title" className="text-base sm:text-lg font-bold text-ui-ink">
                  {actionType === 'approve'
                    ? `Approve Access: ${selectedRequest.name}`
                    : actionType === 'reject'
                    ? `Reject Request: ${selectedRequest.name}`
                    : `Request Info: ${selectedRequest.name}`}
                </h3>
                <p className="text-xs text-ui-muted">{selectedRequest.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                }}
                aria-label="Close"
                className="ui-icon-btn shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionMessage ? (
              <div role="status" className="p-4 status-tint status-approved rounded-2xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>{actionMessage}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {actionType === 'approve' ? (
                  <>
                    {/* Final Role & Job Role */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-ui-text mb-1">
                          Final System Role *
                        </label>
                        <select
                          aria-label="Final system role"
                          value={assignedRole}
                          onChange={(e) => setAssignedRole(e.target.value as UserRole)}
                          className="ui-select w-full cursor-pointer"
                        >
                          {ROLE_KEYS.map((rk) => (
                            <option key={rk} value={rk}>
                              {ROLE_LABELS[rk] || rk.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-ui-muted mt-1 pl-2">
                          Requested: {selectedRequest.requestedRole ? (ROLE_LABELS[selectedRequest.requestedRole as keyof typeof ROLE_LABELS] || selectedRequest.requestedRole.replace('_', ' ')) : ''}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ui-text mb-1">
                          Job Role *
                        </label>
                        <select
                          aria-label="Job role"
                          value={assignedJobRole}
                          onChange={(e) => setAssignedJobRole(e.target.value)}
                          className="ui-select w-full cursor-pointer"
                        >
                          {JOB_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Department & Capacity */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-ui-text mb-1">
                          Department *
                        </label>
                        <select
                          aria-label="Department"
                          value={assignedDept}
                          onChange={(e) => setAssignedDept(e.target.value)}
                          className="ui-select w-full cursor-pointer"
                        >
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept.code} value={dept.name}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ui-text mb-1">
                          Weekly Capacity (Hours)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={80}
                          value={assignedCapacity}
                          onChange={(e) => setAssignedCapacity(Number(e.target.value))}
                          className="ui-input w-full"
                        />
                      </div>
                    </div>

                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-ui-text mb-1">
                      {actionType === 'reject' ? 'Rejection Reason *' : 'Question for Applicant *'}
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder={
                        actionType === 'reject'
                          ? 'Explain why this request is not approved...'
                          : 'State what clarification is needed before approval...'
                      }
                      className="ui-input ui-textarea w-full resize-none"
                    />
                  </div>
                )}

                <div className="pt-3 flex flex-wrap justify-end gap-3 border-t border-ui-line">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequest(null);
                      setActionType(null);
                    }}
                    className="ui-btn ui-btn-secondary h-11"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleAction}
                    className="ui-btn ui-btn-primary h-11"
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
