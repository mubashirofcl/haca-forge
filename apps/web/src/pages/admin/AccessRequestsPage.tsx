import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { ROLE_KEYS, type UserRole } from '@mmp/shared';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Access Requests</h1>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Review and onboard staff into roles across production teams and departments
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 sm:w-64"
            />
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-medium">
            {(['pending', 'approved', 'rejected', 'info_needed', 'all'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-900/60 rounded-2xl border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800/80">
          <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No requests found</h3>
          <p className="text-xs text-slate-500 mt-1">
            There are currently no access requests matching the "{statusFilter}" status filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRequests.map((req) => (
            <div
              key={req._id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-base text-slate-100">{req.name}</h3>
                    <div className="text-xs text-slate-400">{req.email}</div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      req.status === 'pending'
                        ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                        : req.status === 'approved'
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                        : req.status === 'rejected'
                        ? 'bg-red-950/40 text-red-300 border-red-800/60'
                        : 'bg-blue-950/40 text-blue-300 border-blue-800/60'
                    }`}
                  >
                    {req.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-medium text-slate-200">{req.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Requested Role:</span>
                    <span className="font-semibold text-blue-400 capitalize">
                      {req.requestedRole.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="text-slate-300">{req.phone}</span>
                  </div>
                </div>

                {req.skills.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[11px] text-slate-500 block mb-1">Skills:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {req.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-[11px] text-slate-500 block mb-1">Reason:</span>
                  <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40 line-clamp-3">
                    {req.reason}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {req.status === 'pending' && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedRequest(req);
                      setAssignedRole(req.requestedRole);
                      setActionType('approve');
                    }}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRequest(req);
                      setActionType('reject');
                    }}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-slate-700/80"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRequest(req);
                      setActionType('info');
                    }}
                    title="Ask for information"
                    className="p-1.5 bg-slate-800 hover:bg-blue-500/20 text-slate-300 hover:text-blue-400 rounded-xl border border-slate-700/80"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              {actionType === 'approve'
                ? `Approve Access: ${selectedRequest.name}`
                : actionType === 'reject'
                ? `Reject Request: ${selectedRequest.name}`
                : `Request Info: ${selectedRequest.name}`}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              {selectedRequest.email} &bull; {selectedRequest.department}
            </p>

            {actionMessage ? (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{actionMessage}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {actionType === 'approve' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Assigned Role
                      </label>
                      <select
                        value={assignedRole}
                        onChange={(e) => setAssignedRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
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
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Production Team
                        </label>
                        <select
                          value={assignedTeam}
                          onChange={(e) => setAssignedTeam(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="content">Content (Scripts / Copywriting)</option>
                          <option value="graphics">Graphics (Posters / Carousels)</option>
                          <option value="cinematography">Cinematography (Shoots)</option>
                          <option value="editor">Editor (Reels / Video Exports)</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Weekly Capacity (Hours)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={assignedCapacity}
                        onChange={(e) => setAssignedCapacity(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {actionType === 'reject' ? 'Rejection Reason *' : 'Question for Requester *'}
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
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                )}

                <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequest(null);
                      setActionType(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleAction}
                    className={`px-5 py-2 text-white text-xs font-semibold rounded-xl flex items-center gap-2 ${
                      actionType === 'approve'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        : actionType === 'reject'
                        ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                    }`}
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
