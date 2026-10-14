import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DynamicFieldDefinition } from '@mmp/shared';
import { useAuth } from '../../context/AuthContext';
import { DynamicFormRenderer } from '../../components/DynamicFormRenderer';
import {
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  FileText,
  Send,
  MessageSquare,
  Paperclip,
  Repeat,
  Trash2,
  Edit3,
  X,
  History,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface RequestTypeItem {
  _id: string;
  name: string;
  departmentType: string;
  fieldSchema: DynamicFieldDefinition[];
}

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
  };
  requestTypeName: string;
  dynamicFields: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string;
  status: 'draft' | 'submitted' | 'under_triage' | 'accepted' | 'rejected' | 'needs_info' | 'converted' | 'cancelled';
  attachments: Array<{ url: string; name: string; size?: number; type?: string }>;
  triage?: {
    decision?: string;
    reason?: string;
    decidedBy?: { name: string; email: string };
    decidedAt?: string;
  };
  recurring?: {
    isRecurring: boolean;
    frequency?: 'weekly' | 'monthly';
    nextRunAt?: string;
  };
  comments?: Array<{
    _id: string;
    user: { _id: string; name: string; email: string; avatar?: string };
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

export const RequesterDashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Modal states
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);

  // New Request Form State
  const [selectedDepartment, setSelectedDepartment] = useState<string>(user?.department || 'Sales & Business Development');
  const [selectedRequestTypeId, setSelectedRequestTypeId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [deadline, setDeadline] = useState('');
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachments, setAttachments] = useState<Array<{ url: string; name: string }>>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [duplicateWarning, setDuplicateWarning] = useState<any[] | null>(null);

  // Comment input
  const [newCommentText, setNewCommentText] = useState('');

  // 1. Fetch Requests (Scoped per role & department)
  const { data: requestsResponse, isLoading: requestsLoading } = useQuery({
    queryKey: ['requests', activeTab, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/requests?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch requests');
      return res.json();
    },
  });

  const requests: RequestItem[] = requestsResponse?.data || [];

  // 2. Fetch Request Types Master Data
  const { data: requestTypesResponse } = useQuery({
    queryKey: ['requestTypes'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/request-types');
      if (!res.ok) throw new Error('Failed to fetch request types');
      return res.json();
    },
  });

  const requestTypes: RequestTypeItem[] = requestTypesResponse?.requestTypes || [];
  const selectedRequestType = requestTypes.find((rt) => rt._id === selectedRequestTypeId);

  // 3. Fetch Single Request Detail when selected
  const { data: requestDetailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['requestDetail', selectedRequestId],
    queryFn: async () => {
      if (!selectedRequestId) return null;
      const res = await fetch(`/api/requests/${selectedRequestId}`);
      if (!res.ok) throw new Error('Failed to fetch request detail');
      return res.json();
    },
    enabled: Boolean(selectedRequestId),
  });

  const activeRequestDetail: RequestItem | null = requestDetailResponse?.request || null;

  // Real-time duplicate check as title changes
  useEffect(() => {
    if (!title || title.length < 5) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/requests/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceDepartment: selectedDepartment,
            requestTypeName: selectedRequestType?.name,
            title,
            deadline: deadline || undefined,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.hasDuplicates) {
            setDuplicateWarning(result.candidates);
          } else {
            setDuplicateWarning(null);
          }
        }
      } catch {
        // Silently catch duplicate detection ping errors
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, selectedDepartment, selectedRequestType, deadline]);

  // Handle dynamic field changes
  const handleDynamicChange = (fieldKey: string, val: any) => {
    setDynamicValues((prev) => ({ ...prev, [fieldKey]: val }));
    if (formErrors[fieldKey]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldKey];
        return copy;
      });
    }
  };

  // Add attachment
  const handleAddAttachment = () => {
    if (!attachmentUrl) return;
    setAttachments((prev) => [
      ...prev,
      { url: attachmentUrl, name: attachmentName || 'Asset Link' },
    ]);
    setAttachmentUrl('');
    setAttachmentName('');
  };

  // Remove attachment
  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Create Request Mutation
  const createRequestMutation = useMutation({
    mutationFn: async ({ isDraft }: { isDraft: boolean }) => {
      const payload = {
        title,
        sourceDepartment: selectedDepartment,
        requestType: selectedRequestType?.name || selectedRequestTypeId,
        priority,
        deadline: deadline || new Date(Date.now() + 86400000 * 7).toISOString(),
        dynamicFields: dynamicValues,
        attachments,
        isDraft,
        recurring: isRecurring ? { isRecurring: true, frequency: recurringFrequency } : undefined,
      };

      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error?.details) {
          setFormErrors(data.error.details);
        }
        throw new Error(data.error?.message || 'Failed to create request');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setIsNewRequestModalOpen(false);
      resetNewRequestForm();
      if (data.request?._id) {
        setSelectedRequestId(data.request._id);
      }
    },
  });

  // Resubmit Request Mutation
  const resubmitMutation = useMutation({
    mutationFn: async ({ id, resubmitReason }: { id: string; resubmitReason: string }) => {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority,
          deadline,
          dynamicFields: dynamicValues,
          attachments,
          resubmit: true,
          resubmitReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to resubmit request');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requestDetail', selectedRequestId] });
      setIsResubmitModalOpen(false);
    },
  });

  // Cancel Request Mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/requests/${id}/cancel`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by requester' }),
      });
      if (!res.ok) throw new Error('Failed to cancel request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['requestDetail', selectedRequestId] });
    },
  });

  // Add Comment Mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const res = await fetch(`/api/requests/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      setNewCommentText('');
      queryClient.invalidateQueries({ queryKey: ['requestDetail', selectedRequestId] });
    },
  });

  // Repeat Request Mutation
  const repeatMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/requests/${id}/repeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to repeat request');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      if (data.request?._id) {
        setSelectedRequestId(data.request._id);
      }
    },
  });

  const resetNewRequestForm = () => {
    setTitle('');
    setDynamicValues({});
    setAttachments([]);
    setDeadline('');
    setFormErrors({});
    setIsRecurring(false);
    setDuplicateWarning(null);
  };

  const openResubmitModal = (req: RequestItem) => {
    setTitle(req.title);
    setPriority(req.priority);
    setDeadline(req.deadline ? new Date(req.deadline).toISOString().split('T')[0] : '');
    setDynamicValues(req.dynamicFields || {});
    setAttachments(req.attachments || []);
    setIsResubmitModalOpen(true);
  };

  // Helper status badge renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-200">
            Submitted
          </span>
        );
      case 'under_triage':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-200">
            Under Triage
          </span>
        );
      case 'needs_info':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-200 animate-pulse">
            Needs Info
          </span>
        );
      case 'accepted':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-200">
            Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-200">
            Rejected
          </span>
        );
      case 'converted':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
            In Pipeline
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
            Cancelled
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-700">
            Draft
          </span>
        );
    }
  };

  // Computed KPI metrics
  const kpiSubmitted = requests.filter((r) => ['submitted', 'under_triage'].includes(r.status)).length;
  const kpiNeedsInfo = requests.filter((r) => r.status === 'needs_info').length;
  const kpiAccepted = requests.filter((r) => ['accepted', 'converted'].includes(r.status)).length;
  const kpiDrafts = requests.filter((r) => r.status === 'draft').length;

  return (
    <div className="space-y-8">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
              Department Portal
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-600">
              {user?.department || 'Marketing Client Department'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Work Requests & Deliverables
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Raise creative requests, monitor triage approvals, and track pipeline production delivery
          </p>
        </div>

        <button
          onClick={() => {
            resetNewRequestForm();
            if (requestTypes.length > 0 && !selectedRequestTypeId) {
              setSelectedRequestTypeId(requestTypes[0]._id);
            }
            setIsNewRequestModalOpen(true);
          }}
          className="px-5 py-2.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold shadow-pill flex items-center gap-2 transition-transform hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>Raise New Request</span>
        </button>
      </div>

      {/* KPI Status Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Submitted / In Triage', count: kpiSubmitted, icon: Clock, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
          { label: 'Needs Clarification', count: kpiNeedsInfo, icon: AlertCircle, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
          { label: 'Accepted & In Pipeline', count: kpiAccepted, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
          { label: 'Drafts in Progress', count: kpiDrafts, icon: FileText, color: 'bg-slate-100 text-slate-600 border-slate-200' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="glass-panel p-5 rounded-[22px] border border-white shadow-glass flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {kpi.label}
                </span>
                <div className={`p-2 rounded-xl border ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {kpi.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Table / List Container */}
      <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass space-y-6">
        {/* Filter & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 glass-pill-container border border-white">
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'submitted', label: 'Submitted' },
              { id: 'needs_info', label: 'Needs Info' },
              { id: 'accepted', label: 'Accepted' },
              { id: 'converted', label: 'In Pipeline' },
              { id: 'draft', label: 'Drafts' },
              { id: 'rejected', label: 'Declined' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === tab.id ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <input
              type="text"
              placeholder="Search title, ID, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-full text-xs bg-white/80 border border-slate-200 focus:outline-none focus:border-[#7a6af6] transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Requests List */}
        {requestsLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-[#7a6af6] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading department requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs glass-card border border-dashed border-slate-300">
            No requests found matching your filter criteria.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req._id}
                onClick={() => setSelectedRequestId(req._id)}
                className={`glass-card p-4 sm:p-5 border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  selectedRequestId === req._id
                    ? 'border-[#7a6af6] shadow-sm bg-white/95 ring-2 ring-[#7a6af6]/10'
                    : 'border-white hover:border-slate-300/80 hover:bg-white/90'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-extrabold text-[#7a6af6]">
                      {req.requestId}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {req.requestTypeName}
                    </span>
                    {req.priority === 'urgent' && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                        Urgent
                      </span>
                    )}
                    {req.recurring?.isRecurring && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex items-center gap-1">
                        <Repeat className="w-2.5 h-2.5" />
                        <span>Recurring ({req.recurring.frequency})</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 truncate">{req.title}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      Dept: <strong className="text-slate-700">{req.sourceDepartment}</strong>
                    </span>
                    <span>
                      Requester: <strong className="text-slate-700">{req.requester?.name || 'You'}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3 h-3" />
                      <span>Due: {req.deadline ? new Date(req.deadline).toLocaleDateString() : 'TBD'}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:self-center">
                  <div className="text-right">{renderStatusBadge(req.status)}</div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Detail Drawer / Modal */}
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
                  {activeRequestDetail && renderStatusBadge(activeRequestDetail.status)}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                  {activeRequestDetail?.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedRequestId(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            {detailLoading || !activeRequestDetail ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading request details...</div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                {/* Needs Info / Rejection Banner */}
                {activeRequestDetail.status === 'needs_info' && (
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-purple-800">
                      <AlertCircle className="w-4 h-4" />
                      <span>Clarification Requested by Marketing Lead</span>
                    </div>
                    <p className="text-xs text-purple-700 pl-6">
                      {activeRequestDetail.triage?.reason || 'Please provide updated specifications.'}
                    </p>
                    <div className="pt-2 pl-6">
                      <button
                        onClick={() => openResubmitModal(activeRequestDetail)}
                        className="px-4 py-2 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white font-bold text-xs shadow-sm flex items-center gap-2"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit & Resubmit Request</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeRequestDetail.status === 'rejected' && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-rose-800">
                      <XCircle className="w-4 h-4" />
                      <span>Request Declined</span>
                    </div>
                    <p className="text-xs text-rose-700 pl-6">
                      Reason: {activeRequestDetail.triage?.reason || 'Not aligned with current sprint capacity.'}
                    </p>
                    <div className="pt-2 pl-6">
                      <button
                        onClick={() => openResubmitModal(activeRequestDetail)}
                        className="px-4 py-2 rounded-full bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-sm flex items-center gap-2"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Revise & Resubmit</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Source Department</span>
                    <strong className="text-slate-800">{activeRequestDetail.sourceDepartment}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Deliverable Type</span>
                    <strong className="text-slate-800">{activeRequestDetail.requestTypeName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Priority</span>
                    <span className="capitalize font-bold text-slate-800">{activeRequestDetail.priority}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Production Deadline</span>
                    <strong className="text-slate-800">
                      {activeRequestDetail.deadline ? new Date(activeRequestDetail.deadline).toLocaleDateString() : 'TBD'}
                    </strong>
                  </div>
                </div>

                {/* Dynamic Field Responses */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#7a6af6]" />
                    <span>Dynamic Specifications & Brief</span>
                  </h4>
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white/60 space-y-2.5">
                    {Object.keys(activeRequestDetail.dynamicFields || {}).length === 0 ? (
                      <span className="text-slate-400 italic">No custom field values submitted.</span>
                    ) : (
                      Object.entries(activeRequestDetail.dynamicFields).map(([k, v]) => (
                        <div key={k} className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 text-xs">
                          <span className="font-semibold text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                          <span className="text-slate-800 font-medium sm:text-right max-w-sm">
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
                      <span>Attachments & References</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {activeRequestDetail.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-[#7a6af6] flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{att.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status History Timeline */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#7a6af6]" />
                    <span>Status History Timeline</span>
                  </h4>
                  <div className="space-y-2 border-l-2 border-[#7a6af6]/20 pl-4 ml-1">
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
                          By {step.changedBy?.name || 'System'} ({step.changedBy?.role || 'user'})
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
                    <span>Comments & Coordination</span>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
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

                  {/* Add Comment Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a comment or reply to lead..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 h-10 px-4 rounded-full text-xs bg-white border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
                    />
                    <button
                      onClick={() => {
                        if (newCommentText.trim()) {
                          addCommentMutation.mutate({ id: activeRequestDetail._id, text: newCommentText });
                        }
                      }}
                      disabled={!newCommentText.trim()}
                      className="px-4 h-10 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm('Create a new draft based on this request?')) {
                      repeatMutation.mutate(activeRequestDetail!._id);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-full border border-slate-300 hover:bg-white text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <Repeat className="w-3.5 h-3.5 text-slate-500" />
                  <span>Repeat Request</span>
                </button>

                {activeRequestDetail &&
                  ['draft', 'submitted', 'under_triage', 'needs_info'].includes(activeRequestDetail.status) && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to cancel this request?')) {
                          cancelMutation.mutate(activeRequestDetail._id);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-full border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-rose-600 flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cancel Request</span>
                    </button>
                  )}
              </div>

              <button
                onClick={() => setSelectedRequestId(null)}
                className="px-4 py-2 rounded-full bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "New Request" Modal Dialog */}
      {isNewRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="glass-panel w-full max-w-2xl max-h-[92vh] rounded-[28px] border border-white shadow-2xl flex flex-col overflow-hidden bg-white/95">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#7a6af6] tracking-wider">
                  Creative Workflow Intake
                </span>
                <h3 className="text-lg font-bold text-slate-900">Raise New Department Request</h3>
              </div>
              <button
                onClick={() => setIsNewRequestModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Duplicate Warning Alert */}
              {duplicateWarning && duplicateWarning.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Similar Open Request Detected!</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    A request with similar deliverables is currently open in your department:
                  </p>
                  <ul className="text-[11px] text-amber-800 font-semibold list-disc pl-5">
                    {duplicateWarning.map((c, i) => (
                      <li key={i}>
                        {c.requestId} &bull; "{c.title}" (Status: {c.status})
                      </li>
                    ))}
                  </ul>
                  <span className="text-[10px] text-amber-600 italic block mt-1">
                    You can still proceed, but your Marketing Lead may merge duplicates.
                  </span>
                </div>
              )}

              {/* Department & Request Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Source Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full h-11 px-4 rounded-full text-xs bg-white/80 border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
                  >
                    <option value="Social Media Marketing">Social Media Marketing</option>
                    <option value="Performance & Paid Media">Performance & Paid Media</option>
                    <option value="Sales & Business Development">Sales & Business Development</option>
                    <option value="Academic Affairs & Research">Academic Affairs & Research</option>
                    <option value="Growth & Special Projects">Growth & Special Projects</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Deliverable Request Type *</label>
                  <select
                    value={selectedRequestTypeId}
                    onChange={(e) => {
                      setSelectedRequestTypeId(e.target.value);
                      setDynamicValues({});
                      setFormErrors({});
                    }}
                    className="w-full h-11 px-4 rounded-full text-xs bg-white/80 border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
                  >
                    {requestTypes.map((rt) => (
                      <option key={rt._id} value={rt._id}>
                        {rt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Request Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Project / Asset Title *</span>
                  <span className="text-[10px] text-slate-400">Clear description of requirement</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Q4 Black Friday Ad Carousel Bundle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full h-11 px-4 rounded-full text-xs bg-white/80 border ${
                    formErrors.title ? 'border-rose-400' : 'border-slate-200'
                  } focus:outline-none focus:border-[#7a6af6]`}
                />
                {formErrors.title && <p className="text-rose-500 text-[10px]">{formErrors.title}</p>}
              </div>

              {/* Priority & Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Priority Level</label>
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`h-9 rounded-full text-[11px] font-bold capitalize transition-all ${
                          priority === p
                            ? p === 'urgent'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-[#0d0e12] text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Required Deadline *</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full h-11 px-4 rounded-full text-xs bg-white/80 border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
                  />
                </div>
              </div>

              {/* Dynamic Form Schema Rendering */}
              {selectedRequestType && (
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-200">
                    <Layers className="w-3.5 h-3.5 text-[#7a6af6]" />
                    <span className="text-xs font-bold text-slate-800">
                      {selectedRequestType.name} Custom Specifications
                    </span>
                  </div>

                  <DynamicFormRenderer
                    fields={selectedRequestType.fieldSchema}
                    values={dynamicValues}
                    onChange={handleDynamicChange}
                    errors={formErrors}
                  />
                </div>
              )}

              {/* Attachments Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Reference URLs / Attachments</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Reference Link Name (e.g. Design Brief Doc)"
                    value={attachmentName}
                    onChange={(e) => setAttachmentName(e.target.value)}
                    className="w-1/3 h-10 px-3 rounded-full text-xs bg-white border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
                  />
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... or Cloudinary URL"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-full text-xs bg-white border border-slate-200 focus:outline-none focus:border-[#7a6af6]"
                  />
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    className="px-4 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Add
                  </button>
                </div>

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {attachments.map((att, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center gap-1.5"
                      >
                        <span>{att.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(i)}
                          className="hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recurring Option Toggle */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Make this a Recurring Request</span>
                  <span className="text-[10px] text-slate-500">Automatically clones and queues next occurrence</span>
                </div>
                <div className="flex items-center gap-3">
                  {isRecurring && (
                    <select
                      value={recurringFrequency}
                      onChange={(e) => setRecurringFrequency(e.target.value as any)}
                      className="h-8 px-3 rounded-full text-xs bg-slate-100 border border-slate-200"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  )}
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 text-[#7a6af6] rounded border-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsNewRequestModalOpen(false)}
                className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={createRequestMutation.isPending}
                  onClick={() => createRequestMutation.mutate({ isDraft: true })}
                  className="px-4 py-2.5 rounded-full border border-slate-300 hover:bg-white text-xs font-bold text-slate-700 transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={createRequestMutation.isPending || !title}
                  onClick={() => createRequestMutation.mutate({ isDraft: false })}
                  className="px-6 py-2.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold shadow-pill flex items-center gap-2 disabled:opacity-50 transition-transform hover:scale-105"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit to Marketing Lead</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resubmit Modal Dialog */}
      {isResubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="glass-panel w-full max-w-xl rounded-[28px] border border-white shadow-2xl flex flex-col overflow-hidden bg-white/95">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Revise & Resubmit Request</h3>
              <button onClick={() => setIsResubmitModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Project Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-11 px-4 rounded-full text-xs bg-white border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-11 px-4 rounded-full text-xs bg-white border border-slate-200"
                />
              </div>

              {selectedRequestType && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">Custom Fields</span>
                  <DynamicFormRenderer
                    fields={selectedRequestType.fieldSchema}
                    values={dynamicValues}
                    onChange={handleDynamicChange}
                  />
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsResubmitModalOpen(false)}
                className="px-4 py-2 rounded-full border border-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (activeRequestDetail) {
                    resubmitMutation.mutate({
                      id: activeRequestDetail._id,
                      resubmitReason: 'Resubmitted with requested revisions',
                    });
                  }
                }}
                className="px-6 py-2 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white text-xs font-bold shadow-sm"
              >
                Resubmit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
