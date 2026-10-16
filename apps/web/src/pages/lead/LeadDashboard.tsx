import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  HelpCircle,
  GitMerge,
  Sparkles,
  Clock,
  Layers,
  Search,
  X,
  History,
  MessageSquare,
  Send,
  Paperclip,
  ExternalLink,
  ChevronRight,
  Users,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface RequestItem {
  _id: string;
  requestId: string;
  title: string;
  sourceDepartment: string;
  requester: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    department?: string;
    role?: string;
  };
  requestTypeName: string;
  dynamicFields: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string;
  status: 'draft' | 'submitted' | 'under_triage' | 'accepted' | 'rejected' | 'needs_info' | 'converted' | 'cancelled';
  attachments: Array<{ url: string; name: string }>;
  triage?: {
    decision?: string;
    reason?: string;
    decidedBy?: { name: string; email: string };
    decidedAt?: string;
  };
  comments?: Array<{
    _id: string;
    user: { _id: string; name: string; email: string };
    text: string;
    createdAt: string;
  }>;
  history?: Array<{
    _id: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy: { name: string; email: string; role: string };
    reason?: string;
    comment?: string;
    timestamp: string;
  }>;
  createdAt: string;
}

export const LeadDashboard: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'triage' | 'needs_info' | 'accepted' | 'all'>('triage');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected request for detail drawer
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Triage Action Modals
  const [triageAction, setTriageAction] = useState<'accept' | 'reject' | 'ask_info' | 'merge' | 'convert' | null>(null);
  const [actionTargetRequest, setActionTargetRequest] = useState<RequestItem | null>(null);

  // Modal Inputs
  const [triagePriority, setTriagePriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [triageDeadline, setTriageDeadline] = useState<string>('');
  const [triageComment, setTriageComment] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [askInfoMessage, setAskInfoMessage] = useState<string>('');
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [commentInput, setCommentInput] = useState<string>('');

  // Bulk Triage State
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState<'accept' | 'reject' | null>(null);
  const [bulkPriority, setBulkPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [bulkComment, setBulkComment] = useState<string>('');
  const [bulkRejectReason, setBulkRejectReason] = useState<string>('');

  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllSubmitted = () => {
    const submitted = requests.filter((r) => r.status === 'submitted').map((r) => r._id);
    if (selectedRequestIds.length === submitted.length && submitted.length > 0) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(submitted);
    }
  };

  // 1. Fetch All Requests for Triage
  const { data: requestsResponse, isLoading: requestsLoading } = useQuery({
    queryKey: ['leadRequests', activeTab, selectedDept, selectedPriority, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab === 'triage') params.set('status', 'submitted');
      else if (activeTab === 'needs_info') params.set('status', 'needs_info');
      else if (activeTab === 'accepted') params.set('status', 'accepted');

      if (selectedDept !== 'all') params.set('department', selectedDept);
      if (selectedPriority !== 'all') params.set('priority', selectedPriority);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/requests?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch triage requests');
      return res.json();
    },
  });

  const requests: RequestItem[] = requestsResponse?.data || [];

  // 2. Fetch Single Request Detail
  const { data: requestDetailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['leadRequestDetail', selectedRequestId],
    queryFn: async () => {
      if (!selectedRequestId) return null;
      const res = await fetch(`/api/requests/${selectedRequestId}`);
      if (!res.ok) throw new Error('Failed to fetch request detail');
      return res.json();
    },
    enabled: Boolean(selectedRequestId),
  });

  const activeRequestDetail: RequestItem | null = requestDetailResponse?.request || null;

  // 3. Triage Mutations
  const acceptMutation = useMutation({
    mutationFn: async ({ id, priority, deadline, comment }: any) => {
      const res = await fetch(`/api/requests/${id}/triage/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority, deadline: deadline || undefined, comment: comment || undefined }),
      });
      if (!res.ok) throw new Error('Failed to accept request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leadRequestDetail', selectedRequestId] });
      closeActionModal();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: any) => {
      const res = await fetch(`/api/requests/${id}/triage/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to decline request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leadRequestDetail', selectedRequestId] });
      closeActionModal();
    },
  });

  const askInfoMutation = useMutation({
    mutationFn: async ({ id, message }: any) => {
      const res = await fetch(`/api/requests/${id}/triage/ask-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error('Failed to send inquiry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leadRequestDetail', selectedRequestId] });
      closeActionModal();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ sourceId, targetRequestId }: any) => {
      const res = await fetch(`/api/requests/${sourceId}/triage/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRequestId }),
      });
      if (!res.ok) throw new Error('Failed to merge requests');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadRequests'] });
      closeActionModal();
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/requests/${id}/triage/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to convert request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leadRequestDetail', selectedRequestId] });
      closeActionModal();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ id, text }: any) => {
      const res = await fetch(`/api/requests/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      setCommentInput('');
      queryClient.invalidateQueries({ queryKey: ['leadRequestDetail', selectedRequestId] });
    },
  });

  const bulkAcceptMutation = useMutation({
    mutationFn: async ({ requestIds, priority, comment }: any) => {
      const res = await fetch('/api/requests/triage/bulk-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds, priority, comment }),
      });
      if (!res.ok) throw new Error('Failed to bulk accept requests');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leadRequests'] });
      setSelectedRequestIds([]);
      setShowBulkModal(null);
      setBulkComment('');
      alert(data.message || 'Selected requests accepted.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to bulk accept requests');
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async ({ requestIds, reason }: any) => {
      const res = await fetch('/api/requests/triage/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds, reason }),
      });
      if (!res.ok) throw new Error('Failed to bulk reject requests');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leadRequests'] });
      setSelectedRequestIds([]);
      setShowBulkModal(null);
      setBulkRejectReason('');
      alert(data.message || 'Selected requests declined.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to bulk decline requests');
    },
  });

  // Fetch pending deadline extensions
  const { data: pendingExtensionTasks = [] } = useQuery({
    queryKey: ['pendingExtensionTasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks?extensionStatus=pending');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  const reviewExtensionMutation = useMutation({
    mutationFn: async ({
      taskId,
      decision,
      responseNote,
    }: {
      taskId: string;
      decision: 'approved' | 'rejected';
      responseNote?: string;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}/extension-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, responseNote }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to review deadline extension');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingExtensionTasks'] });
      alert('Extension decision recorded.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to review extension');
    },
  });

  const closeActionModal = () => {
    setTriageAction(null);
    setActionTargetRequest(null);
    setTriageComment('');
    setRejectReason('');
    setAskInfoMessage('');
    setMergeTargetId('');
  };

  const openActionModal = (action: 'accept' | 'reject' | 'ask_info' | 'merge' | 'convert', req: RequestItem) => {
    setActionTargetRequest(req);
    setTriagePriority(req.priority);
    setTriageDeadline(req.deadline ? new Date(req.deadline).toISOString().split('T')[0] : '');
    setTriageAction(action);
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
              Command Center
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-600">Marketing Leadership</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Marketing Request Triage Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluate inbound departmental requests, assign production priorities, ask clarification, and convert to pipeline items
          </p>
        </div>
      </div>

      {/* 2. Top Metric Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Awaiting Triage', count: requests.filter((r) => r.status === 'submitted').length, icon: Inbox, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
          { label: 'Pending Clarification', count: requests.filter((r) => r.status === 'needs_info').length, icon: HelpCircle, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
          { label: 'Accepted (Ready to Convert)', count: requests.filter((r) => r.status === 'accepted').length, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
          { label: 'Active in Production', count: requests.filter((r) => r.status === 'converted').length, icon: Sparkles, color: 'bg-[#7a6af6]/10 text-[#7a6af6] border-[#7a6af6]/20' },
        ].map((w, idx) => {
          const Icon = w.icon;
          return (
            <div key={idx} className="glass-panel p-5 rounded-[22px] border border-white shadow-glass flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{w.label}</span>
                <div className={`p-2 rounded-xl border ${w.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{w.count}</div>
            </div>
          );
        })}
      </div>

      {/* 3. Production Team Capacity Rollup Preview */}
      <div className="glass-panel p-5 rounded-[24px] border border-white shadow-glass">
        <h2 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#7a6af6]" />
          <span>Production Teams Available Bandwidth</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'Content', role: 'Copy, Scripts & Hooks', cap: '40h/wk' },
            { name: 'Graphics', role: 'Carousels & Ad Creatives', cap: '40h/wk' },
            { name: 'Cinematography', role: 'Studio & Field Shoots', cap: '40h/wk' },
            { name: 'Editor', role: 'Reels, Motion & Cuts', cap: '40h/wk' },
          ].map((t, i) => (
            <div key={i} className="p-3 rounded-2xl bg-white/70 border border-white text-xs space-y-1">
              <div className="flex justify-between items-center">
                <strong className="text-slate-900">{t.name}</strong>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.cap}</span>
              </div>
              <p className="text-[10px] text-slate-400">{t.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3.5 Pending Task Deadline Extension Requests */}
      {pendingExtensionTasks.length > 0 && (
        <div className="glass-panel p-5 rounded-[24px] border border-purple-200 bg-purple-50/40 shadow-glass space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-700" />
              <h2 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                Pending Task Deadline Extension Requests ({pendingExtensionTasks.length})
              </h2>
            </div>
            <span className="text-[10px] text-purple-700 font-semibold bg-purple-100/80 px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-purple-600" />
              <span>Requires Lead Decision</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {pendingExtensionTasks.map((t: any) => (
              <div
                key={t._id}
                className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#7a6af6]">{t.taskId}</span>
                    <strong className="text-xs text-slate-900">{t.title}</strong>
                    <span className="text-[11px] text-slate-500">
                      by <b>{t.assignee?.name || 'Assignee'}</b>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>
                      Current Due: <s className="text-slate-400">{new Date(t.dueDate).toLocaleDateString()}</s>
                    </span>
                    <span className="font-semibold text-purple-700">
                      Requested: {new Date(t.extensionRequest?.requestedDate).toLocaleDateString()}
                    </span>
                    {t.extensionRequest?.reason && (
                      <span className="italic text-slate-500">
                        "{t.extensionRequest.reason}"
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      reviewExtensionMutation.mutate({
                        taskId: t._id,
                        decision: 'approved',
                      });
                    }}
                    disabled={reviewExtensionMutation.isPending}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const note = prompt('Rejection reason (optional):') || '';
                      reviewExtensionMutation.mutate({
                        taskId: t._id,
                        decision: 'rejected',
                        responseNote: note,
                      });
                    }}
                    disabled={reviewExtensionMutation.isPending}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-full transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Triage Inbox Table / Queue Container */}
      <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass space-y-6">
        {/* Filter Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 glass-pill-container border border-white">
            <button
              onClick={() => setActiveTab('triage')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'triage' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Needs Triage
            </button>
            <button
              onClick={() => setActiveTab('needs_info')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'needs_info' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Waiting for Info
            </button>
            <button
              onClick={() => setActiveTab('accepted')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'accepted' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Accepted
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'all' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Requests
            </button>
            {activeTab === 'triage' && requests.some((r) => r.status === 'submitted') && (
              <button
                type="button"
                onClick={selectAllSubmitted}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs ml-1"
              >
                {selectedRequestIds.length === requests.filter((r) => r.status === 'submitted').length && selectedRequestIds.length > 0
                  ? 'Deselect All'
                  : 'Select All Submitted'}
              </button>
            )}
          </div>

          {/* Department, Priority & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-10 px-3.5 rounded-full text-xs bg-white/80 border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
            >
              <option value="all">All Departments</option>
              <option value="Social Media Marketing">Social Media</option>
              <option value="Performance & Paid Media">Performance</option>
              <option value="Sales & Business Development">Sales</option>
              <option value="Academic Affairs & Research">Academics</option>
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="h-10 px-3.5 rounded-full text-xs bg-white/80 border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <div className="relative">
              <input
                type="text"
                placeholder="Search triage requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 h-10 pl-8 pr-3 rounded-full text-xs bg-white/80 border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedRequestIds.length > 0 && (
          <div className="glass-panel p-3.5 px-6 rounded-2xl border border-violet-200 bg-violet-50/90 shadow-glass flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-extrabold text-violet-950">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse"></span>
              <span>{selectedRequestIds.length} request{selectedRequestIds.length > 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRequestIds([])}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowBulkModal('accept')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1.5 transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bulk Accept ({selectedRequestIds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkModal('reject')}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-all"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Bulk Reject ({selectedRequestIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Queue Items */}
        {requestsLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-[#7a6af6] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading triage queue...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs glass-card border border-dashed border-slate-300">
            No requests currently in this triage view.
          </div>
        ) : (
          <div className="space-y-3.5">
            {requests.map((req) => (
              <div
                key={req._id}
                className={`glass-card p-5 border border-white hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  selectedRequestIds.includes(req._id) ? 'ring-2 ring-[#7a6af6] bg-violet-50/15' : ''
                }`}
              >
                {/* Left Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {req.status === 'submitted' && (
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(req._id)}
                      onChange={() => toggleSelectRequest(req._id)}
                      className="mt-1 w-4 h-4 rounded text-[#7a6af6] focus:ring-[#7a6af6] cursor-pointer shrink-0"
                      title="Select for bulk triage"
                    />
                  )}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-[#7a6af6]">{req.requestId}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {req.requestTypeName}
                      </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        req.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : req.priority === 'high'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {req.priority}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {req.sourceDepartment}
                    </span>
                  </div>

                  <h3
                    onClick={() => setSelectedRequestId(req._id)}
                    className="font-bold text-sm text-slate-900 hover:text-[#7a6af6] cursor-pointer transition-colors"
                  >
                    {req.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      Requester: <strong className="text-slate-700">{req.requester?.name || 'Staff Member'}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>Due: {req.deadline ? new Date(req.deadline).toLocaleDateString() : 'Unset'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Submitted: {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

                {/* Right: Quick Action Triage Buttons */}
                <div className="flex flex-wrap items-center gap-2 sm:self-center">
                  <button
                    onClick={() => setSelectedRequestId(req._id)}
                    className="px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1"
                  >
                    <span>View Detail</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Accept Button */}
                  {req.status === 'submitted' && (
                    <button
                      onClick={() => openActionModal('accept', req)}
                      className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-transform hover:scale-105"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                  )}

                  {/* Ask Info Button */}
                  {['submitted', 'under_triage'].includes(req.status) && (
                    <button
                      onClick={() => openActionModal('ask_info', req)}
                      className="px-3.5 py-1.5 rounded-full border border-purple-300 hover:bg-purple-50 text-xs font-bold text-purple-700 flex items-center gap-1.5 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Ask Info</span>
                    </button>
                  )}

                  {/* Reject Button */}
                  {['submitted', 'under_triage', 'needs_info'].includes(req.status) && (
                    <button
                      onClick={() => openActionModal('reject', req)}
                      className="px-3 py-1.5 rounded-full border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-rose-600 flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  )}

                  {/* Convert to Pipeline (Phase 4 integration) */}
                  {req.status === 'accepted' && (
                    <button
                      onClick={() => openActionModal('convert', req)}
                      className="px-4 py-1.5 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-transform hover:scale-105"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Convert to Content Item</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Request Detail Slide-over / Modal */}
      {selectedRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] rounded-[28px] border border-white shadow-2xl flex flex-col overflow-hidden bg-white/95">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-extrabold text-[#7a6af6]">
                    {activeRequestDetail?.requestId}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                    {activeRequestDetail?.status}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  {activeRequestDetail?.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedRequestId(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            {detailLoading || !activeRequestDetail ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading request details...</div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                {/* Requester Info & Deliverable Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Requester</span>
                    <strong className="text-slate-800">{activeRequestDetail.requester?.name}</strong>
                    <span className="text-[10px] text-slate-400 block">{activeRequestDetail.requester?.email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Department</span>
                    <strong className="text-slate-800">{activeRequestDetail.sourceDepartment}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Priority</span>
                    <span className="font-bold capitalize text-slate-800">{activeRequestDetail.priority}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Deadline</span>
                    <strong className="text-slate-800">
                      {activeRequestDetail.deadline ? new Date(activeRequestDetail.deadline).toLocaleDateString() : 'TBD'}
                    </strong>
                  </div>
                </div>

                {/* Dynamic Field Values */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#7a6af6]" />
                    <span>Dynamic Specifications</span>
                  </h4>
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white/70 space-y-2">
                    {Object.keys(activeRequestDetail.dynamicFields || {}).length === 0 ? (
                      <span className="text-slate-400 italic">No custom fields submitted.</span>
                    ) : (
                      Object.entries(activeRequestDetail.dynamicFields).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-start gap-2 border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-semibold capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                          <span className="text-slate-900 font-medium text-right max-w-sm">
                            {Array.isArray(v) ? v.join(', ') : String(v)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Attachments */}
                {activeRequestDetail.attachments?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-[#7a6af6]" />
                      <span>Attachments</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {activeRequestDetail.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-[#7a6af6] flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{att.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Timeline */}
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#7a6af6]" />
                    <span>Status History Timeline</span>
                  </h4>
                  <div className="space-y-2 border-l-2 border-[#7a6af6]/30 pl-4 ml-1">
                    {(activeRequestDetail.history || []).map((step, idx) => (
                      <div key={idx} className="relative space-y-0.5">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#7a6af6] ring-4 ring-white" />
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                            {step.toStatus.replace('_', ' ')}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(step.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px]">
                          By {step.changedBy?.name || 'System'} ({step.changedBy?.role})
                          {step.reason && ` &bull; ${step.reason}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comments Section */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#7a6af6]" />
                    <span>Comments & Communication</span>
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {(activeRequestDetail.comments || []).map((cmt, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <strong className="text-slate-800">{cmt.user?.name}</strong>
                          <span className="text-slate-400">{new Date(cmt.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-700">{cmt.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Send comment to requester..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      className="flex-1 h-10 px-4 rounded-full text-xs bg-white border border-slate-200"
                    />
                    <button
                      onClick={() => {
                        if (commentInput.trim()) {
                          addCommentMutation.mutate({ id: activeRequestDetail._id, text: commentInput });
                        }
                      }}
                      className="px-4 h-10 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Triage Quick Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeRequestDetail?.status === 'submitted' && (
                  <button
                    onClick={() => openActionModal('accept', activeRequestDetail)}
                    className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept Request</span>
                  </button>
                )}

                {activeRequestDetail?.status === 'accepted' && (
                  <button
                    onClick={() => openActionModal('convert', activeRequestDetail)}
                    className="px-4 py-2 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Convert to Pipeline</span>
                  </button>
                )}

                {activeRequestDetail && ['submitted', 'under_triage'].includes(activeRequestDetail.status) && (
                  <button
                    onClick={() => openActionModal('ask_info', activeRequestDetail)}
                    className="px-3.5 py-2 rounded-full border border-purple-300 text-purple-700 font-bold text-xs hover:bg-purple-50"
                  >
                    Ask Info
                  </button>
                )}

                {activeRequestDetail && ['submitted', 'under_triage'].includes(activeRequestDetail.status) && (
                  <button
                    onClick={() => openActionModal('reject', activeRequestDetail)}
                    className="px-3.5 py-2 rounded-full border border-rose-200 text-rose-600 font-semibold text-xs hover:bg-rose-50"
                  >
                    Decline
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedRequestId(null)}
                className="px-4 py-2 rounded-full bg-white border border-slate-300 text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Triage Action Modals */}
      {/* Accept Modal */}
      {triageAction === 'accept' && actionTargetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md rounded-[28px] border border-white shadow-2xl p-6 bg-white space-y-4">
            <h3 className="text-base font-bold text-slate-900">Accept & Scope Request</h3>
            <p className="text-xs text-slate-500">
              Confirm or adjust priority and production deadline for "{actionTargetRequest.title}".
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Production Priority</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setTriagePriority(p)}
                      className={`h-8 rounded-full text-[11px] font-bold capitalize ${
                        triagePriority === p ? 'bg-[#0d0e12] text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Target Delivery Deadline</label>
                <input
                  type="date"
                  value={triageDeadline}
                  onChange={(e) => setTriageDeadline(e.target.value)}
                  className="w-full h-10 px-3 rounded-full text-xs bg-white border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Approval Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Assigned to sprint pipeline"
                  value={triageComment}
                  onChange={(e) => setTriageComment(e.target.value)}
                  className="w-full h-10 px-3 rounded-full text-xs bg-white border border-slate-200"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={closeActionModal} className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold">
                Cancel
              </button>
              <button
                onClick={() =>
                  acceptMutation.mutate({
                    id: actionTargetRequest._id,
                    priority: triagePriority,
                    deadline: triageDeadline,
                    comment: triageComment,
                  })
                }
                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                Confirm Acceptance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {triageAction === 'reject' && actionTargetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md rounded-[28px] border border-white shadow-2xl p-6 bg-white space-y-4">
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>Decline Request</span>
            </h3>
            <p className="text-xs text-slate-500">
              Provide a clear reason for declining "{actionTargetRequest.title}". The requester can edit and resubmit.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Reason for Decline *</label>
              <textarea
                rows={3}
                placeholder="e.g., Creative brief does not align with current brand sprint capacity."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-3 rounded-2xl text-xs bg-white border border-slate-200 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={closeActionModal} className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold">
                Cancel
              </button>
              <button
                disabled={rejectReason.trim().length < 5}
                onClick={() => rejectMutation.mutate({ id: actionTargetRequest._id, reason: rejectReason })}
                className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-50"
              >
                Decline Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ask Info Modal */}
      {triageAction === 'ask_info' && actionTargetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md rounded-[28px] border border-white shadow-2xl p-6 bg-white space-y-4">
            <h3 className="text-base font-bold text-purple-700 flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              <span>Request Information from Requester</span>
            </h3>
            <p className="text-xs text-slate-500">
              Specify what missing information or assets are required before accepting "{actionTargetRequest.title}".
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Questions / Required Details *</label>
              <textarea
                rows={3}
                placeholder="e.g., Please provide the brand color codes and high-res vector logos."
                value={askInfoMessage}
                onChange={(e) => setAskInfoMessage(e.target.value)}
                className="w-full p-3 rounded-2xl text-xs bg-white border border-slate-200 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={closeActionModal} className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold">
                Cancel
              </button>
              <button
                disabled={askInfoMessage.trim().length < 5}
                onClick={() => askInfoMutation.mutate({ id: actionTargetRequest._id, message: askInfoMessage })}
                className="px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs disabled:opacity-50"
              >
                Send Inquiry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert (Phase 4 Stub) Modal */}
      {triageAction === 'convert' && actionTargetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md rounded-[28px] border border-white shadow-2xl p-6 bg-white space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#7a6af6]/10 text-[#7a6af6] flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Convert to Content Item</h3>
              <p className="text-xs text-slate-500 mt-1">
                This marks request <strong>{actionTargetRequest.requestId}</strong> as converted into the active production pipeline.
                Stage task distribution and handoffs will be orchestrated by the Phase 4 engine.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div>Title: <strong>{actionTargetRequest.title}</strong></div>
              <div>Format: <strong>{actionTargetRequest.requestTypeName}</strong></div>
              <div>Deadline: <strong>{actionTargetRequest.deadline ? new Date(actionTargetRequest.deadline).toLocaleDateString() : 'TBD'}</strong></div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={closeActionModal} className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold">
                Cancel
              </button>
              <button
                onClick={() => convertMutation.mutate(actionTargetRequest._id)}
                className="px-6 py-2.5 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Confirm Conversion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {triageAction === 'merge' && actionTargetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md rounded-[28px] border border-white shadow-2xl p-6 bg-white space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-[#7a6af6]" />
              <span>Merge Duplicate Request</span>
            </h3>
            <p className="text-xs text-slate-500">
              Select the primary parent request to merge "{actionTargetRequest.title}" into.
              This duplicate request will be marked as merged and closed.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Target Parent Request *</label>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full h-11 px-3 rounded-full text-xs bg-white border border-slate-200"
              >
                <option value="">Select target open request...</option>
                {requests
                  .filter((r) => r._id !== actionTargetRequest._id && !['cancelled', 'converted'].includes(r.status))
                  .map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.requestId} - {r.title.slice(0, 40)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button onClick={closeActionModal} className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold">
                Cancel
              </button>
              <button
                disabled={!mergeTargetId}
                onClick={() =>
                  mergeMutation.mutate({
                    sourceId: actionTargetRequest._id,
                    targetRequestId: mergeTargetId,
                  })
                }
                className="px-5 py-2 rounded-full bg-[#0d0e12] hover:bg-black text-white font-bold text-xs disabled:opacity-50"
              >
                Merge & Close Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md rounded-[28px] border border-white shadow-2xl p-6 bg-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {showBulkModal === 'accept' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Bulk Accept ({selectedRequestIds.length}) Requests</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Bulk Reject ({selectedRequestIds.length}) Requests</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showBulkModal === 'accept' ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Accept all {selectedRequestIds.length} selected requests into the production backlog simultaneously.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Assign Priority</label>
                  <select
                    value={bulkPriority}
                    onChange={(e: any) => setBulkPriority(e.target.value)}
                    className="w-full h-11 px-3 rounded-full text-xs bg-white border border-slate-200"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Triage Note (Optional)</label>
                  <input
                    type="text"
                    value={bulkComment}
                    onChange={(e) => setBulkComment(e.target.value)}
                    placeholder="e.g., Fast-tracked into sprint queue"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(null)}
                    className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={bulkAcceptMutation.isPending}
                    onClick={() =>
                      bulkAcceptMutation.mutate({
                        requestIds: selectedRequestIds,
                        priority: bulkPriority,
                        comment: bulkComment,
                      })
                    }
                    className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{bulkAcceptMutation.isPending ? 'Accepting...' : `Confirm Accept (${selectedRequestIds.length})`}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Please provide a rejection reason. This reason will be logged and dispatched to each requester.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Reason for Declining *</label>
                  <textarea
                    rows={3}
                    value={bulkRejectReason}
                    onChange={(e) => setBulkRejectReason(e.target.value)}
                    placeholder="Explain why these requests cannot be accommodated at this time..."
                    className="w-full p-3 rounded-2xl text-xs bg-slate-50 border border-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(null)}
                    className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={bulkRejectMutation.isPending || !bulkRejectReason.trim()}
                    onClick={() =>
                      bulkRejectMutation.mutate({
                        requestIds: selectedRequestIds,
                        reason: bulkRejectReason.trim(),
                      })
                    }
                    className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{bulkRejectMutation.isPending ? 'Declining...' : `Confirm Reject (${selectedRequestIds.length})`}</span>
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
