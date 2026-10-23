import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  PROFILES,
  WORK_TYPES,
  WORK_ITEM_STATUSES,
  PRIORITIES,
  type WorkType,
  type WorkItemStatus,
  type Priority,
} from '@mmp/shared';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  X,
  AlertTriangle,
  Building2,
  CalendarRange,
  ListFilter,
  Sparkles,
} from 'lucide-react';

interface WorkItemCalendar {
  _id: string;
  title: string;
  workType: WorkType;
  deadline: string;
  estimatedEffortHrs: number;
  status: WorkItemStatus;
  priority: Priority;
  revisions: number;
  isOverdue?: boolean;
  deliverableUrl?: string;
  campaignId: { _id: string; name: string };
  profileId: { _id: string; name: string; code: string };
  departmentId?: { _id: string; name: string };
  ownerId?: { _id: string; name: string; email: string; jobRole?: string };
}

interface CampaignOption {
  _id: string;
  name: string;
  profileId?: { _id: string; name: string; code: string };
}

interface UserOption {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface DepartmentOption {
  _id: string;
  name: string;
}

// Brand Profile Color Mapping for high visual polish
const PROFILE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  haca: { bg: 'bg-violet-50 text-violet-700', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  creative: { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  tech: { bg: 'bg-cyan-50 text-cyan-700', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  digital: { bg: 'bg-pink-50 text-pink-700', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500' },
  kids: { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  aviation: { bg: 'bg-sky-50 text-sky-700', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  corporate: { bg: 'bg-indigo-50 text-indigo-700', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
};

function getProfileBadgeStyle(profileName?: string) {
  if (!profileName) return PROFILE_COLORS.haca;
  const lower = profileName.toLowerCase();
  for (const key of Object.keys(PROFILE_COLORS)) {
    if (lower.includes(key)) return PROFILE_COLORS[key];
  }
  return PROFILE_COLORS.haca;
}

const STATUS_COLORS: Record<WorkItemStatus, { bg: string; text: string; border: string }> = {
  'Not Started': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  'In Progress': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Feedback': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Pending': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Blocked': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Published': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  // Calendar Date State (Default: current date)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');

  // Filter States
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');

  // Data States
  const [items, setItems] = useState<WorkItemCalendar[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [selectedItem, setSelectedItem] = useState<WorkItemCalendar | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCampaignId, setNewCampaignId] = useState('');
  const [newWorkType, setNewWorkType] = useState<WorkType>('Reel');
  const [newDeadline, setNewDeadline] = useState('');
  const [newEffort, setNewEffort] = useState(4);
  const [newPriority, setNewPriority] = useState<Priority>('Medium');
  const [newOwnerId, setNewOwnerId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Month Date Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Fetch Aux Data (campaigns, users, departments)
  useEffect(() => {
    const fetchAux = async () => {
      try {
        const [cRes, uRes, dRes] = await Promise.all([
          apiFetch<{ data: CampaignOption[] }>('/api/campaigns?limit=100'),
          apiFetch<{ data: UserOption[] }>('/api/users?limit=100'),
          apiFetch<{ data: DepartmentOption[] }>('/api/departments?limit=50').catch(() => ({ data: [] })),
        ]);
        setCampaigns(cRes.data || []);
        setUsers(uRes.data || []);
        setDepartments(dRes.data || []);
      } catch (err) {
        console.error('Failed to load auxiliary calendar options', err);
      }
    };
    fetchAux();
  }, []);

  // Fetch Work Items for the Calendar Range
  const fetchCalendarItems = async () => {
    setIsLoading(true);
    try {
      // Calculate start and end range with padding (covering whole month grid)
      const startDate = new Date(year, month - 1, 20).toISOString();
      const endDate = new Date(year, month + 2, 10).toISOString();

      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
      });

      if (selectedProfile !== 'all') params.set('profileId', selectedProfile);
      if (selectedDepartment !== 'all') params.set('departmentId', selectedDepartment);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedOwner !== 'all') params.set('ownerId', selectedOwner);

      const res = await apiFetch<{ data: WorkItemCalendar[] }>(`/api/work/calendar?${params.toString()}`);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to fetch calendar work items', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarItems();
  }, [year, month, selectedProfile, selectedDepartment, selectedStatus, selectedOwner]);

  // Navigate Calendar
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - 7);
      setCurrentDate(next);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Group items by Date String (YYYY-MM-DD)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, WorkItemCalendar[]>();
    for (const item of items) {
      if (!item.deadline) continue;
      const d = new Date(item.deadline);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = map.get(dateKey) || [];
      list.push(item);
      map.set(dateKey, list);
    }
    return map;
  }, [items]);

  // Generate Month Grid Days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const date = new Date(year, month - 1, d);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({ date, isCurrentMonth: false, key });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const date = new Date(year, month, d);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({ date, isCurrentMonth: true, key });
    }

    // Next month days to fill 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({ date, isCurrentMonth: false, key });
    }

    return days;
  }, [year, month]);

  // Week View Days
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    const firstDay = new Date(curr);
    firstDay.setDate(curr.getDate() - dayOfWeek);

    const days: { date: Date; key: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDay);
      d.setDate(firstDay.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, key });
    }
    return days;
  }, [currentDate]);

  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Handle Quick Create from a Calendar Day Cell
  const handleOpenCreateForDate = (dateKey: string) => {
    setNewDeadline(dateKey);
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreateDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Deliverable title is required');
      return;
    }
    if (!newCampaignId) {
      setCreateError('Please link this deliverable to an active campaign');
      return;
    }
    if (!newDeadline) {
      setCreateError('Deadline is required');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    try {
      await apiFetch('/api/work', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          campaignId: newCampaignId,
          workType: newWorkType,
          deadline: new Date(newDeadline).toISOString(),
          estimatedEffortHrs: Number(newEffort),
          priority: newPriority,
          ownerId: newOwnerId || undefined,
        }),
      });

      setIsCreateOpen(false);
      setNewTitle('');
      setNewCampaignId('');
      fetchCalendarItems();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create deliverable');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Top Banner / Cockpit Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Screen 4 • Operations
            </span>
            <span className="text-xs text-slate-500 font-medium">Cross-Brand Deliverable Schedule</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-purple-600" />
            Monthly Marketing Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Scheduled deadlines, creative launches, and deliverables across all 7 brand profiles.
          </p>
        </div>

        {/* View Switcher & Action */}
        <div className="flex items-center gap-3">
          <div className="glass-pill-container p-1 flex items-center gap-1 border border-slate-200/80">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'month' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'week' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'list' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              List Agenda
            </button>
          </div>

          {hasPermission('work.create') && (
            <button
              onClick={() => {
                setNewDeadline(todayKey);
                setCreateError(null);
                setIsCreateOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Deliverable
            </button>
          )}
        </div>
      </div>

      {/* Profile Pills Filter Strip */}
      <div className="glass-card p-4 border border-white/80">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Building2 className="w-3.5 h-3.5" />
            Brands:
          </span>
          <button
            onClick={() => setSelectedProfile('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedProfile === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200/80'
            }`}
          >
            All 7 Brands
          </button>
          {PROFILES.map((p) => {
            const isSelected = selectedProfile === p.name;
            return (
              <button
                key={p.code}
                onClick={() => setSelectedProfile(p.name)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white/80 text-slate-600 hover:bg-white border border-slate-200/80'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Secondary Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white/90 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              {WORK_ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Assigned Owner
            </label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white/90 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Team Members</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white/90 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation & Month Header */}
      <div className="flex items-center justify-between bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {monthName}
          </h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
            {isLoading && <span className="w-2 h-2 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />}
            {items.length} deliverables
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleToday}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
          >
            Today
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* VIEW: MONTH GRID */}
      {viewMode === 'month' && (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {calendarDays.map(({ date, isCurrentMonth, key }) => {
              const dayItems = itemsByDate.get(key) || [];
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  className={`min-h-[120px] p-2 flex flex-col justify-between transition-colors ${
                    isCurrentMonth ? 'bg-white/90' : 'bg-slate-50/40 text-slate-400'
                  } ${isToday ? 'bg-purple-50/30' : 'hover:bg-slate-50/70'}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-purple-600 text-white shadow-sm'
                          : isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {date.getDate()}
                    </span>

                    {/* Quick Add Button */}
                    <button
                      onClick={() => handleOpenCreateForDate(key)}
                      title={`Add deliverable for ${key}`}
                      className="opacity-0 hover:opacity-100 group-hover:opacity-100 p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Day Deliverables */}
                  <div className="space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                    {dayItems.slice(0, 3).map((item) => {
                      const profileStyle = getProfileBadgeStyle(item.profileId?.name);
                      return (
                        <div
                          key={item._id}
                          onClick={() => setSelectedItem(item)}
                          className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer transition-all hover:scale-[1.02] truncate flex items-center gap-1.5 ${profileStyle.bg} ${profileStyle.border}`}
                          title={`${item.title} (${item.status})`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${profileStyle.dot}`} />
                          <span className="truncate flex-1 font-semibold text-slate-800">
                            {item.title}
                          </span>
                          {item.isOverdue && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" title="Overdue" />
                          )}
                        </div>
                      );
                    })}

                    {dayItems.length > 3 && (
                      <button
                        onClick={() => {
                          setCurrentDate(date);
                          setViewMode('list');
                        }}
                        className="text-[10px] font-bold text-purple-600 hover:text-purple-800 pl-1 block text-left"
                      >
                        +{dayItems.length - 3} more items
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: WEEK PERSPECTIVE */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map(({ date, key }) => {
            const dayItems = itemsByDate.get(key) || [];
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={`glass-card p-3 border flex flex-col justify-between min-h-[380px] ${
                  isToday ? 'border-purple-300 ring-2 ring-purple-500/20 bg-purple-50/20' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {date.toLocaleDateString('default', { weekday: 'short' })}
                      </span>
                      <span className={`text-sm font-extrabold ${isToday ? 'text-purple-600' : 'text-slate-800'}`}>
                        {date.getDate()} {date.toLocaleDateString('default', { month: 'short' })}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {dayItems.length}
                    </span>
                  </div>

                  {/* Item Cards */}
                  <div className="space-y-2">
                    {dayItems.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic text-center py-8">
                        No deliverables scheduled
                      </p>
                    ) : (
                      dayItems.map((item) => {
                        const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS['Not Started'];
                        const profileStyle = getProfileBadgeStyle(item.profileId?.name);

                        return (
                          <div
                            key={item._id}
                            onClick={() => setSelectedItem(item)}
                            className="p-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-purple-300 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${profileStyle.bg} ${profileStyle.border}`}>
                                {item.profileId?.code || 'Brand'}
                              </span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                {item.status}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-purple-600 transition-colors">
                              {item.title}
                            </h4>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50 text-[10px] text-slate-400">
                              <span>{item.workType}</span>
                              {item.ownerId && (
                                <span className="font-medium text-slate-600 truncate max-w-[80px]">
                                  {item.ownerId.name}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleOpenCreateForDate(key)}
                  className="w-full mt-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50/50 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Deliverable
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: LIST AGENDA PERSPECTIVE */}
      {viewMode === 'list' && (
        <div className="glass-card p-6 border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-purple-600" />
            Chronological Deliverable Agenda
          </h3>

          {items.length === 0 ? (
            <div className="text-center py-12">
              <CalendarRange className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No deliverables found for this filter range</p>
              <p className="text-xs text-slate-400 mt-1">Try switching to all profiles or adding a new deliverable.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {Array.from(itemsByDate.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([dateKey, dayItems]) => {
                  const d = new Date(dateKey + 'T00:00:00');
                  const isToday = dateKey === todayKey;

                  return (
                    <div key={dateKey} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                            isToday ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {isToday && (
                          <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                            Today
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dayItems.map((item) => {
                          const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS['Not Started'];
                          const profileStyle = getProfileBadgeStyle(item.profileId?.name);

                          return (
                            <div
                              key={item._id}
                              onClick={() => setSelectedItem(item)}
                              className="p-3 rounded-xl bg-white/90 border border-slate-200 hover:border-purple-300 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${profileStyle.bg} ${profileStyle.border}`}>
                                    {item.profileId?.name || 'Brand'}
                                  </span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                    {item.status}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                  Campaign: <span className="font-semibold text-slate-700">{item.campaignId?.name}</span>
                                </p>
                              </div>

                              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                                <span>{item.workType} • {item.estimatedEffortHrs}h</span>
                                <span className="font-medium text-slate-700">{item.ownerId?.name || 'Unassigned'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* QUICK PREVIEW MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="glass-modal w-full max-w-lg p-6 relative">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${getProfileBadgeStyle(selectedItem.profileId?.name).bg}`}>
                {selectedItem.profileId?.name}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${STATUS_COLORS[selectedItem.status].bg} ${STATUS_COLORS[selectedItem.status].text}`}>
                {selectedItem.status}
              </span>
              {selectedItem.isOverdue && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                  Overdue
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">{selectedItem.title}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Campaign: <span className="font-semibold text-slate-800">{selectedItem.campaignId?.name}</span>
            </p>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 mb-5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deliverable Type</span>
                <span className="font-semibold text-slate-700">{selectedItem.workType}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deadline</span>
                <span className="font-semibold text-slate-700">
                  {new Date(selectedItem.deadline).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned To</span>
                <span className="font-semibold text-slate-700">{selectedItem.ownerId?.name || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Effort / Priority</span>
                <span className="font-semibold text-slate-700">{selectedItem.estimatedEffortHrs}h • {selectedItem.priority.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigate(`/work/${selectedItem._id}`);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200 transition-all flex items-center gap-2"
              >
                Open Workplace
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DELIVERABLE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="glass-modal w-full max-w-lg p-6 relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Schedule New Deliverable
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a marketing deliverable linked strictly to an active campaign.
            </p>

            {createError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDeliverable} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Deliverable Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Admission Reel - Robotics Workshop Batch 4"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Campaign *
                </label>
                <select
                  required
                  value={newCampaignId}
                  onChange={(e) => setNewCampaignId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">Select an active campaign...</option>
                  {campaigns.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.profileId?.name ? `(${c.profileId.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Work Type
                  </label>
                  <select
                    value={newWorkType}
                    onChange={(e) => setNewWorkType(e.target.value as WorkType)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {WORK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>{wt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Deadline *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                  </input>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Estimated Effort (hrs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={newEffort}
                    onChange={(e) => setNewEffort(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Assignee (Optional)
                </label>
                <select
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">Leave unassigned for auto-assignment</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? 'Scheduling...' : 'Create Deliverable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
