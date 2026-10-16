import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { ROLE_KEYS, type UserRole } from '@mmp/shared';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  X,
} from 'lucide-react';

interface AccessRequestItem {
  _id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  requestedRole: UserRole;
  skills: string[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'info_needed';
  createdAt: string;
  assignedRole?: UserRole;
  rejectReason?: string;
}

export const AccessRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [selectedRequest, setSelectedRequest] = useState<AccessRequestItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'info' | null>(null);
  const [assignedRole, setAssignedRole] = useState<UserRole>('worker');
  const [assignedTeam, setAssignedTeam] = useState<string>('content');
  const [assignedCapacity, setAssignedCapacity] = useState<number>(40);
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
      const res = await apiFetch<{ message: string; data: { approvedCount: number } }>(
        '/admin/access-requests/bulk-approve',
        {
          method: 'POST',
          body: JSON.stringify({ requestIds: selectedIds }),
        }
      );
      alert(res.message || `Successfully approved ${res.data?.approvedCount || selectedIds.length} access requests.`);
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
      const res = await apiFetch<{ data: AccessRequestItem[] }>(
        `/admin/access-requests${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`
      );
      setRequests(res.data || []);
    } catch (err) {
      console.error('Failed to fetch requests', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

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
            teamId: assignedTeam,
            capacity: Number(assignedCapacity),
          }),
        });
        setActionMessage(`Approved ${selectedRequest.name}! Activation invite sent.`);
      } else if (actionType === 'reject') {
        await apiFetch(`/admin/access-requests/${selectedRequest._id}/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: actionReason }),
        });
        setActionMessage(`Rejected request from ${selectedRequest.name}.`);
      } else if (actionType === 'info') {
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
      r.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-8">
      {/* Header and Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Access Requests
            </h1>
            {pendingCount > 0 && (
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-[#7a6af6]/15 text-[#7a6af6] border border-[#7a6af6]/30">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review applicant identities, assign production teams, and approve onboarding
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white/80 border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs w-48 sm:w-60"
            />
          </div>

          <div className="p-1 glass-pill-container flex items-center border border-white">
            {(['pending', 'approved', 'rejected', 'info_needed', 'all'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full capitalize transition-all ${
                  statusFilter === st
                    ? 'pill-active'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {pendingCount > 0 && (
            <button
              onClick={selectAllPending}
              className="px-3.5 py-2 rounded-full border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 shadow-xs transition-colors"
            >
              {selectedIds.length === pendingCount ? 'Deselect All' : 'Select All Pending'}
            </button>
          )}
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="glass-panel p-3.5 px-6 rounded-2xl border border-violet-200 bg-violet-50/90 shadow-glass flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse"></span>
            <span className="text-xs font-extrabold text-violet-900">
              {selectedIds.length} candidate{selectedIds.length > 1 ? 's' : ''} selected for bulk onboarding
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
            >
              Clear
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              className="px-5 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isBulkApproving ? 'Approving Candidates...' : `Bulk Approve Selected (${selectedIds.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid of Request Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 glass-panel rounded-[22px] border border-white animate-pulse" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-[24px] border border-white shadow-glass">
          <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No requests found</h3>
          <p className="text-xs text-slate-500 mt-1">
            There are currently no access requests matching the "{statusFilter}" status filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRequests.map((req) => (
            <div
              key={req._id}
              className={`glass-card p-6 flex flex-col justify-between shadow-glass hover:scale-[1.01] transition-all ${
                selectedIds.includes(req._id) ? 'ring-2 ring-[#7a6af6] bg-violet-50/20' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {req.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(req._id)}
                        onChange={() => toggleSelect(req._id)}
                        className="w-4 h-4 rounded text-[#7a6af6] focus:ring-[#7a6af6] cursor-pointer"
                        title="Select for bulk approve"
                      />
                    )}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7a6af6] to-[#4f46e5] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {req.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{req.name}</h3>
                      <div className="text-xs text-slate-500">{req.email}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      req.status === 'pending'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : req.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : req.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {req.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-700 bg-white/70 p-3.5 rounded-2xl border border-slate-100 my-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span className="font-semibold text-slate-900">{req.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Requested Role:</span>
                    <span className="font-bold text-[#7a6af6] capitalize">
                      {req.requestedRole.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contact Phone:</span>
                    <span className="text-slate-700">{req.phone}</span>
                  </div>
                </div>

                {req.skills.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {req.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Reason</span>
                  <p className="text-xs text-slate-600 bg-white/50 p-3 rounded-xl border border-slate-100 line-clamp-3">
                    {req.reason}
                  </p>
                </div>
              </div>

              {/* Actions for Pending Requests */}
              {req.status === 'pending' && (
                <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedRequest(req);
                      setAssignedRole(req.requestedRole);
                      setActionType('approve');
                    }}
                    className="flex-1 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full flex items-center justify-center gap-1.5 shadow-sm transition-transform hover:scale-105"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRequest(req);
                      setActionType('reject');
                    }}
                    className="flex-1 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRequest(req);
                      setActionType('info');
                    }}
                    title="Request More Info"
                    className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-full transition-colors"
                  >
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Modal (Glassmorphic) */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-modal max-w-md w-full p-6 sm:p-8 shadow-modal-glass border border-white relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {actionType === 'approve'
                    ? `Approve Access: ${selectedRequest.name}`
                    : actionType === 'reject'
                    ? `Reject Request: ${selectedRequest.name}`
                    : `Request Info: ${selectedRequest.name}`}
                </h3>
                <p className="text-xs text-slate-500">{selectedRequest.email}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionMessage ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{actionMessage}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {actionType === 'approve' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Assigned Role
                      </label>
                      <select
                        value={assignedRole}
                        onChange={(e) => setAssignedRole(e.target.value as UserRole)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                      >
                        {ROLE_KEYS.map((rk) => (
                          <option key={rk} value={rk}>
                            {rk.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {assignedRole === 'worker' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Production Team
                        </label>
                        <select
                          value={assignedTeam}
                          onChange={(e) => setAssignedTeam(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                        >
                          <option value="content">Content (Scripts / Copywriting)</option>
                          <option value="graphics">Graphics (Posters / Carousels)</option>
                          <option value="cinematography">Cinematography (Shoots)</option>
                          <option value="editor">Editor (Reels / Video Exports)</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Weekly Capacity (Hours)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={assignedCapacity}
                        onChange={(e) => setAssignedCapacity(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                          : 'State what clarification is needed...'
                      }
                      className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs resize-none"
                    />
                  </div>
                )}

                <div className="pt-3 flex justify-end gap-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequest(null);
                      setActionType(null);
                    }}
                    className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleAction}
                    className="px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill disabled:opacity-50"
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
