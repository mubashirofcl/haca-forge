import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Kanban,
  Table as TableIcon,
  Plus,
  Search,
  MessageSquare,
  History,
  Send,
  X,
  Sparkles,
} from 'lucide-react';

interface ContentItem {
  _id: string;
  contentId: string;
  title: string;
  format: string;
  sourceDepartment: { _id: string; name: string; code: string };
  requester: { _id: string; name: string; email: string; avatar?: string };
  platforms: string[];
  publishDate: string;
  productionDeadline: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  caption?: string;
  brief?: string;
  tasks: Array<{
    _id: string;
    taskId: string;
    stageKey: string;
    stageOrder: number;
    title: string;
    team: string;
    status: string;
    estimateHours: number;
    actualHours: number;
    dueDate?: string;
    assignee?: { _id: string; name: string; email: string; avatar?: string };
  }>;
}

const FORMAT_LABELS: Record<string, string> = {
  static_post: 'Static Post',
  carousel: 'Carousel',
  story: 'Story',
  reel: 'Reel / Video',
  ad_creative: 'Ad Creative',
  brochure: 'Brochure',
  academic_creative: 'Course Creative',
};

const STATUS_COLUMNS = [
  { id: 'planned', label: 'Planned', color: 'bg-slate-500/10 text-slate-700 border-slate-200' },
  { id: 'in_production', label: 'In Production', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  { id: 'in_review', label: 'In Review', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  { id: 'approved', label: 'Approved', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  { id: 'published', label: 'Published', color: 'bg-purple-500/10 text-purple-700 border-purple-200' },
];

export const ContentHubPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');

  // Fetch Content Items
  const { data: contentResponse, isLoading } = useQuery({
    queryKey: ['contentItems', selectedFormat, selectedStatus, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFormat) params.set('format', selectedFormat);
      if (selectedStatus) params.set('status', selectedStatus);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/content?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load content items');
      return res.json();
    },
  });

  const contentItems: ContentItem[] = contentResponse?.data || [];

  // Fetch Departments for New Modal
  const { data: deptsResponse } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await fetch('/api/departments');
      return res.json();
    },
    enabled: showNewModal,
  });
  const departments = deptsResponse?.data || [];

  // Fetch Detail for Slide-over
  const { data: detailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['contentDetail', selectedContentId],
    queryFn: async () => {
      if (!selectedContentId) return null;
      const res = await fetch(`/api/content/${selectedContentId}`);
      if (!res.ok) throw new Error('Failed to load content detail');
      return res.json();
    },
    enabled: !!selectedContentId,
  });

  const activeItem = detailResponse?.data?.item;
  const activeComments = detailResponse?.data?.comments || [];
  const activeHistory = detailResponse?.data?.statusHistory || [];

  // New Content Item Form State
  const [newTitle, setNewTitle] = useState('');
  const [newFormat, setNewFormat] = useState('static_post');
  const [newDept, setNewDept] = useState('');
  const [newPlatforms, setNewPlatforms] = useState<string[]>(['instagram']);
  const [newPublishDate, setNewPublishDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newBrief, setNewBrief] = useState('');

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create content item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentItems'] });
      setShowNewModal(false);
      setNewTitle('');
      setNewBrief('');
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ text, entityId }: { text: string; entityId: string }) => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'content', entityId, text }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentDetail', selectedContentId] });
      setCommentText('');
    },
  });

  const handleCreateContent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDept) return;
    createMutation.mutate({
      title: newTitle,
      format: newFormat,
      sourceDepartment: newDept,
      platforms: newPlatforms,
      publishDate: new Date(newPublishDate).toISOString(),
      priority: newPriority,
      brief: newBrief,
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedContentId) return;
    commentMutation.mutate({ text: commentText, entityId: selectedContentId });
  };

  const togglePlatform = (p: string) => {
    setNewPlatforms((prev) =>
      prev.includes(p) ? (prev.length > 1 ? prev.filter((x) => x !== p) : prev) : [...prev, p]
    );
  };

  // KPI calculations
  const totalCount = contentItems.length;
  const inProdCount = contentItems.filter((c) => c.status === 'in_production').length;
  const inReviewCount = contentItems.filter((c) => c.status === 'in_review').length;
  const approvedCount = contentItems.filter((c) => c.status === 'approved').length;
  const publishedCount = contentItems.filter((c) => c.status === 'published').length;

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Content Pipeline Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
              Phase 4 Core
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized pipeline tracking, automated cross-team handoffs, and production delivery.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-full glass-panel border border-white/80 shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                viewMode === 'table' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                viewMode === 'board' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Content Item</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="glass-panel p-4 border border-white/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Items</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="glass-panel p-4 border border-white/80">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">In Production</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{inProdCount}</p>
        </div>
        <div className="glass-panel p-4 border border-white/80">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">In Review</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{inReviewCount}</p>
        </div>
        <div className="glass-panel p-4 border border-white/80">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Approved</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{approvedCount}</p>
        </div>
        <div className="glass-panel p-4 border border-white/80 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Published</p>
          <p className="text-2xl font-black text-purple-700 mt-1">{publishedCount}</p>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="glass-panel p-3 border border-white/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search content ID or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full bg-white/70 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
            />
          </div>

          {/* Format Filter */}
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-full bg-white/70 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
          >
            <option value="">All Formats</option>
            {Object.entries(FORMAT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-full bg-white/70 border border-slate-200 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
          >
            <option value="">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="in_production">In Production</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>

        <p className="text-xs text-slate-400 font-medium">Showing {contentItems.length} active deliverables</p>
      </div>

      {/* 4. Main Views: Table vs Board */}
      {viewMode === 'table' ? (
        <div className="glass-panel border border-white/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Content ID & Title</th>
                  <th className="py-3 px-3">Format</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Platforms</th>
                  <th className="py-3 px-3">Production Deadline</th>
                  <th className="py-3 px-3">Publish Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Loading content pipeline items...
                    </td>
                  </tr>
                ) : contentItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No content items found matching current filters.
                    </td>
                  </tr>
                ) : (
                  contentItems.map((item) => (
                    <tr
                      key={item._id}
                      onClick={() => setSelectedContentId(item._id)}
                      className="hover:bg-white/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-[10px] font-bold text-[#7a6af6] bg-[#7a6af6]/10 px-1.5 py-0.5 rounded">
                          {item.contentId}
                        </span>
                        <p className="font-bold text-slate-900 mt-1 line-clamp-1">{item.title}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700">
                          {FORMAT_LABELS[item.format] || item.format}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {item.sourceDepartment?.name || 'General Marketing'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          {item.platforms.map((p) => (
                            <span
                              key={p}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-bold"
                            >
                              {p.slice(0, 2)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {item.productionDeadline
                          ? new Date(item.productionDeadline).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {new Date(item.publishDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                            item.status === 'in_production'
                              ? 'bg-blue-500/10 text-blue-700 border-blue-200'
                              : item.status === 'in_review'
                              ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                              : item.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                              : item.status === 'published'
                              ? 'bg-purple-500/10 text-purple-700 border-purple-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-slate-400 group-hover:text-[#7a6af6] transition-colors font-bold text-xs">
                          Inspect &rarr;
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Board View */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colItems = contentItems.filter((c) => c.status === col.id);
            return (
              <div key={col.id} className="glass-panel p-3 border border-white/80 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{colItems.length}</span>
                </div>

                <div className="space-y-2.5 min-h-[250px]">
                  {colItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => setSelectedContentId(item._id)}
                      className="p-3 rounded-xl bg-white/80 hover:bg-white border border-slate-200/70 shadow-xs cursor-pointer space-y-2 transition-all hover:scale-[1.01]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] font-bold text-[#7a6af6]">
                          {item.contentId}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {FORMAT_LABELS[item.format] || item.format}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs line-clamp-2">{item.title}</h4>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                        <span>{item.sourceDepartment?.code || 'MKT'}</span>
                        <span>{new Date(item.publishDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}

                  {colItems.length === 0 && (
                    <div className="py-8 text-center text-slate-300 text-xs font-medium">
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Slide-Over Detail Drawer */}
      {selectedContentId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedContentId(null)}
          />

          <div className="relative w-full max-w-[620px] bg-white h-full shadow-2xl z-10 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {detailLoading || !activeItem ? (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                Loading deliverable details...
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#7a6af6] bg-[#7a6af6]/10 px-2 py-0.5 rounded">
                        {activeItem.contentId}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-200 text-slate-700">
                        {FORMAT_LABELS[activeItem.format] || activeItem.format}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          activeItem.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-700'
                            : activeItem.priority === 'high'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {activeItem.priority}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-2">{activeItem.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Requested by {activeItem.requester?.name} &bull;{' '}
                      {activeItem.sourceDepartment?.name}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedContentId(null)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Pipeline Stepper */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#7a6af6]" />
                      <span>Automated Pipeline Stepper</span>
                    </h4>

                    <div className="relative border-l-2 border-[#7a6af6]/30 pl-5 ml-2 space-y-4">
                      {(activeItem.tasks || []).map((t: any) => {
                        const isDone = t.status === 'done' || t.status === 'approved';
                        const isInProgress = t.status === 'in_progress';

                        return (
                          <div key={t._id} className="relative space-y-1">
                            <div
                              className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white ${
                                isDone
                                  ? 'bg-emerald-500'
                                  : isInProgress
                                  ? 'bg-[#7a6af6] animate-pulse'
                                  : 'bg-slate-300'
                              }`}
                            />
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900">{t.title}</span>
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isInProgress
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                              <span>
                                Team: <b className="uppercase text-slate-700">{t.team}</b>
                              </span>
                              <span>
                                Assignee:{' '}
                                <b className="text-slate-700">{t.assignee?.name || 'Unassigned'}</b>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dates & Specifications */}
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Publish Date</p>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {new Date(activeItem.publishDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Production Deadline</p>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {new Date(activeItem.productionDeadline).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Brief */}
                  {activeItem.brief && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Production Brief
                      </h4>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                        {activeItem.brief}
                      </div>
                    </div>
                  )}

                  {/* Comments Thread */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#7a6af6]" />
                      <span>Comments & Production Notes</span>
                    </h4>

                    <div className="space-y-2.5">
                      {activeComments.map((c: any) => (
                        <div key={c._id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-slate-800">
                              {c.author?.name} ({c.author?.role})
                            </span>
                            <span className="text-slate-400">
                              {new Date(c.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700">{c.text}</p>
                        </div>
                      ))}

                      {activeComments.length === 0 && (
                        <p className="text-xs text-slate-400 italic">No notes yet on this item.</p>
                      )}
                    </div>

                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a feedback note or comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
                      />
                      <button
                        type="submit"
                        disabled={!commentText.trim()}
                        className="px-3.5 py-1.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full disabled:opacity-40"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    </form>
                  </div>

                  {/* Stage Audit History */}
                  {activeHistory.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-[#7a6af6]" />
                        <span>Stage Audit History</span>
                      </h4>
                      <div className="space-y-2 border-l-2 border-[#7a6af6]/30 pl-3 ml-1 text-xs">
                        {activeHistory.map((h: any, idx: number) => (
                          <div key={idx} className="relative">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-[11px] uppercase">
                                {h.toStatus?.replace('_', ' ')}
                              </span>
                              <span className="text-slate-400 text-[10px]">
                                {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              By {h.changedBy?.name || 'System'}
                              {h.reason ? ` • ${h.reason}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 6. New Content Item Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setShowNewModal(false)}
          />

          <div className="relative w-full max-w-[540px] bg-white rounded-2xl shadow-modal-glass border border-white p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Create Deliverable Item</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Spawns pipeline tasks across assigned teams automatically
                </p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContent} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Deliverable Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Growth Webinar Promo Poster"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Format Pipeline</label>
                  <select
                    value={newFormat}
                    onChange={(e) => setNewFormat(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                  >
                    {Object.entries(FORMAT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Source Department</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d: any) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Publish Date</label>
                  <input
                    type="date"
                    required
                    value={newPublishDate}
                    onChange={(e) => setNewPublishDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Target Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {['instagram', 'linkedin', 'youtube', 'facebook', 'tiktok', 'twitter'].map((p) => {
                    const active = newPlatforms.includes(p);
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => togglePlatform(p)}
                        className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all ${
                          active
                            ? 'bg-[#7a6af6] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Creative Brief & Notes</label>
                <textarea
                  rows={3}
                  placeholder="Outline key audience, required assets, copy themes..."
                  value={newBrief}
                  onChange={(e) => setNewBrief(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 rounded-full bg-[#0d0e12] hover:bg-black text-white font-bold disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Generating Pipeline...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
