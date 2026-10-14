import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  Download,
  Search,
  Sparkles,
  AlertTriangle,
  Layers,
  BarChart2,
  List as ListIcon,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CapacityWidget } from './CapacityWidget';
import { BulkImportModal } from './BulkImportModal';
import { CalendarEntryDrawer } from './CalendarEntryDrawer';

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  instagram: { bg: 'bg-pink-500/10', text: 'text-pink-600', border: 'border-pink-200' },
  linkedin: { bg: 'bg-blue-500/10', text: 'text-blue-700', border: 'border-blue-200' },
  youtube: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-200' },
  facebook: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', border: 'border-indigo-200' },
  tiktok: { bg: 'bg-slate-900/10', text: 'text-slate-900', border: 'border-slate-300' },
  twitter: { bg: 'bg-sky-500/10', text: 'text-sky-600', border: 'border-sky-200' },
  pinterest: { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-200' },
};

const FORMAT_LABELS: Record<string, string> = {
  static_post: 'Static Post',
  carousel: 'Carousel',
  story: 'Story',
  reel: 'Reel / Video',
  ad_creative: 'Ad Creative',
  brochure: 'Brochure',
  academic_creative: 'Course Creative',
};

export const CalendarPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [showCapacity, setShowCapacity] = useState<boolean>(true);

  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [clickedDate, setClickedDate] = useState<string | undefined>(undefined);

  // Derived Date Range for the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);

  // Query Calendar Entries
  const { data: entriesResponse } = useQuery({
    queryKey: ['calendarEntries', year, month, selectedPlatform, selectedFormat, selectedStatus, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Expand window to include full weeks
      const from = new Date(year, month, -6).toISOString().split('T')[0];
      const to = new Date(year, month + 1, 7).toISOString().split('T')[0];

      params.set('from', from);
      params.set('to', to);
      if (selectedPlatform !== 'all') params.set('platform', selectedPlatform);
      if (selectedFormat !== 'all') params.set('format', selectedFormat);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);

      const res = await fetch(`/api/calendar?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load calendar entries');
      return res.json();
    },
  });

  const entries: any[] = (entriesResponse?.data || []).filter((e: any) => {
    if (!searchQuery) return true;
    return (
      e.theme?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.captionBrief?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Batch Approve Mutation
  const batchApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch('/api/calendar/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Failed to approve entries');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
    },
  });

  // Batch Generate Pipelines Mutation
  const batchGenerateMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      const res = await fetch('/api/calendar/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds }),
      });
      if (!res.ok) throw new Error('Failed to generate pipelines');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['contentItems'] });
    },
  });

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const openNewEntry = (dateString?: string) => {
    setSelectedEntry(null);
    setClickedDate(dateString || new Date().toISOString().split('T')[0]);
    setIsDrawerOpen(true);
  };

  const openEditEntry = (entry: any) => {
    setSelectedEntry(entry);
    setClickedDate(undefined);
    setIsDrawerOpen(true);
  };

  // Group entries by Date string YYYY-MM-DD
  const entriesByDate: Record<string, any[]> = {};
  entries.forEach((entry) => {
    const dStr = new Date(entry.date).toISOString().split('T')[0];
    if (!entriesByDate[dStr]) entriesByDate[dStr] = [];
    entriesByDate[dStr].push(entry);
  });

  // Calculate Month Days Grid (35-42 boxes)
  const firstDayIndex = (startOfMonth.getDay() + 6) % 7; // Monday start
  const daysInMonth = endOfMonth.getDate();
  const calendarDays: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean }> = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    calendarDays.push({
      date: d,
      dateStr: d.toISOString().split('T')[0],
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    calendarDays.push({
      date: d,
      dateStr: d.toISOString().split('T')[0],
      isCurrentMonth: true,
    });
  }

  // Next month padding to reach full week grid (multiples of 7)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    calendarDays.push({
      date: d,
      dateStr: d.toISOString().split('T')[0],
      isCurrentMonth: false,
    });
  }

  const approvedUnconvertedEntries = entries.filter(
    (e) => e.status === 'approved' && !e.linkedContentItemId
  );
  const draftEntries = entries.filter((e) => e.status === 'draft');

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
              Content Schedule
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-500">Cross-Platform Deliverable Matrix</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Social Media Content Calendar</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
              {entries.length} scheduled
            </span>
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCapacity((prev) => !prev)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
              showCapacity
                ? 'bg-purple-50 border-purple-200 text-[#7a6af6]'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Bandwidth</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Import</span>
          </button>

          <button
            onClick={() => window.open('/api/calendar/template', '_blank')}
            className="px-3 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold transition-all"
            title="Download Excel Template"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {hasPermission('calendar.manage') && (
            <button
              onClick={() => openNewEntry()}
              className="px-4 py-2 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-transform hover:scale-105"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Post</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Bandwidth Capacity Preview Widget */}
      {showCapacity && (
        <CapacityWidget
          from={startOfMonth.toISOString().split('T')[0]}
          to={endOfMonth.toISOString().split('T')[0]}
        />
      )}

      {/* 3. Batch Action Notification Bar */}
      {(draftEntries.length > 0 || approvedUnconvertedEntries.length > 0) && (
        <div className="p-3.5 rounded-2xl glass-panel border border-[#7a6af6]/30 bg-purple-50/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#7a6af6]" />
            <span className="font-semibold text-slate-700">
              Pending Actions: <strong>{draftEntries.length}</strong> drafts to approve &bull;{' '}
              <strong>{approvedUnconvertedEntries.length}</strong> approved deliverables ready for pipeline tasks.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {draftEntries.length > 0 && (
              <button
                disabled={batchApproveMutation.isPending}
                onClick={() => batchApproveMutation.mutate(draftEntries.map((e) => e._id))}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-100 border border-purple-200 text-[#7a6af6] font-bold text-xs shadow-xs"
              >
                Approve All Drafts ({draftEntries.length})
              </button>
            )}

            {approvedUnconvertedEntries.length > 0 && (
              <button
                disabled={batchGenerateMutation.isPending}
                onClick={() =>
                  batchGenerateMutation.mutate(approvedUnconvertedEntries.map((e) => e._id))
                }
                className="px-4 py-1.5 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
              >
                <Layers className="w-3 h-3" />
                <span>Generate Pipelines ({approvedUnconvertedEntries.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Filter Toolbar & Navigation Switcher */}
      <div className="glass-panel p-4 rounded-2xl border border-white/80 flex flex-wrap items-center justify-between gap-3">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm font-black text-slate-900 ml-1">
            {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Search & Dynamic Select Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search deliverables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#7a6af6] w-40 sm:w-48"
            />
          </div>

          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 capitalize"
          >
            <option value="all">All Platforms</option>
            {Object.keys(PLATFORM_COLORS).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700"
          >
            <option value="all">All Formats</option>
            {Object.entries(FORMAT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="converted">Pipeline Generated</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center p-0.5 rounded-full bg-slate-100 border border-slate-200 ml-1">
            <button
              onClick={() => setViewMode('month')}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === 'month' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
              title="Month Grid"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === 'list' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
              title="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Calendar Viewport */}
      {viewMode === 'month' ? (
        <div className="glass-panel rounded-[28px] border border-white/80 overflow-hidden shadow-glass">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center py-2.5">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
            <div>Sun</div>
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-white/60">
            {calendarDays.map((calDay) => {
              const dayEntries = entriesByDate[calDay.dateStr] || [];
              const isToday =
                new Date().toISOString().split('T')[0] === calDay.dateStr;
              const hasClash = dayEntries.some((e) => e.hasClash);

              return (
                <div
                  key={calDay.dateStr}
                  className={`min-h-[120px] sm:min-h-[140px] p-2 flex flex-col justify-between transition-colors group ${
                    !calDay.isCurrentMonth
                      ? 'bg-slate-50/40 text-slate-300'
                      : 'hover:bg-slate-50/70'
                  } ${hasClash ? 'bg-amber-50/30' : ''}`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-[#7a6af6] text-white shadow-xs font-extrabold'
                          : calDay.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {calDay.date.getDate()}
                    </span>

                    {/* Clash Badge */}
                    {hasClash && (
                      <span
                        className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white flex items-center gap-0.5"
                        title="Multiple deliverables scheduled on same platform today"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>CLASH</span>
                      </span>
                    )}

                    {/* Add button on hover */}
                    <button
                      onClick={() => openNewEntry(calDay.dateStr)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-opacity"
                      title="Add deliverable for this day"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Day Deliverables Badges */}
                  <div className="space-y-1 flex-1 overflow-y-auto max-h-24 pr-0.5">
                    {dayEntries.map((entry) => {
                      const color = PLATFORM_COLORS[entry.platform] || {
                        bg: 'bg-slate-100',
                        text: 'text-slate-700',
                        border: 'border-slate-200',
                      };

                      return (
                        <div
                          key={entry._id}
                          onClick={() => openEditEntry(entry)}
                          className={`p-1.5 rounded-xl border text-[10px] cursor-pointer hover:shadow-xs transition-all ${color.bg} ${color.border} ${color.text} space-y-0.5`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold capitalize truncate">
                              {entry.platform}
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                entry.status === 'converted'
                                  ? 'bg-purple-500'
                                  : entry.status === 'approved'
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                          </div>
                          <p className="font-medium text-slate-800 truncate leading-tight">
                            {entry.theme}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List / Agenda View */
        <div className="glass-panel rounded-[24px] border border-white/80 overflow-hidden shadow-glass">
          <div className="p-4 border-b border-slate-100 font-bold text-xs text-slate-700">
            Chronological Deliverable Agenda
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Publish Date</th>
                  <th className="p-3.5">Platform</th>
                  <th className="p-3.5">Theme / Deliverable</th>
                  <th className="p-3.5">Format</th>
                  <th className="p-3.5">Pillar</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No deliverables scheduled in this date window.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const color = PLATFORM_COLORS[entry.platform] || {
                      bg: 'bg-slate-100',
                      text: 'text-slate-700',
                      border: 'border-slate-200',
                    };

                    return (
                      <tr
                        key={entry._id}
                        className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                        onClick={() => openEditEntry(entry)}
                      >
                        <td className="p-3.5 font-mono text-[11px] font-bold text-slate-900">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border ${color.bg} ${color.border} ${color.text}`}
                          >
                            {entry.platform}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">{entry.theme}</td>
                        <td className="p-3.5 text-slate-600">
                          {FORMAT_LABELS[entry.format] || entry.format}
                        </td>
                        <td className="p-3.5 text-slate-500">{entry.contentPillar}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                              entry.status === 'converted'
                                ? 'bg-purple-100 text-purple-700'
                                : entry.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEntry(entry);
                            }}
                            className="text-xs font-bold text-[#7a6af6] hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Calendar Entry Drawer */}
      <CalendarEntryDrawer
        entry={selectedEntry}
        isOpen={isDrawerOpen}
        initialDate={clickedDate}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedEntry(null);
        }}
      />

      {/* 7. Bulk Import Modal Wizard */}
      {showImportModal && (
        <BulkImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
};
