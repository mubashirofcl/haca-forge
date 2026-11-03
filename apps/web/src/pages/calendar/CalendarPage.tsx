import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  WORK_ITEM_STATUSES,
  CALENDAR_LIST,
  getCalendarDefinition,
  type CalendarKey,
  type WorkType,
  type Priority,
  type WorkItemStatus,
} from '@mmp/shared';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  AlertTriangle,
  CalendarRange,
  ListFilter,
  Plus,
  X,
} from 'lucide-react';
import { PlansTab } from './PlansTab';
import { TrackerTab } from './TrackerTab';

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
  calendar?: CalendarKey;
  departmentId?: { _id: string; name: string };
  ownerId?: { _id: string; name: string; email: string; jobRole?: string };
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
  code?: string;
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

function formatCalendarItemTitle(item: any): string {
  if (item.displayTitle) return item.displayTitle;
  const ownerName = item.ownerId?.name || item.ownerName || '';
  if (item.stageKey) {
    const rawTitle = (item.title || '').replace(new RegExp(`\\s*-\\s*${item.stageKey}$`, 'i'), '');
    if (item.stageKey === 'Post') {
      return `Publish: ${rawTitle}${ownerName ? ` (${ownerName})` : ''}`;
    }
    return `${item.stageKey} due: ${rawTitle}${ownerName ? ` (${ownerName})` : ''}`;
  }
  return item.title;
}

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const tabParam = searchParams.get('tab');
  const activeTab: 'month' | 'plans' | 'tracker' =
    tabParam === 'plans' || tabParam === 'tracker' ? tabParam : 'month';

  const handleTabChange = (newTab: 'month' | 'plans' | 'tracker') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newTab === 'month') {
        next.delete('tab');
      } else {
        next.set('tab', newTab);
      }
      return next;
    });
  };

  const currentCalendar = searchParams.get('calendar') || 'all';
  const [isIndividualCreateRequested, setIsIndividualCreateRequested] = useState(false);

  const handleCalendarSelect = (calKey: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (calKey === 'all') {
        next.delete('calendar');
      } else {
        next.set('calendar', calKey);
      }
      return next;
    });
  };

  // Calendar Date State (Default: current date)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');

  // Filter States
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');

  // Data States
  const [items, setItems] = useState<WorkItemCalendar[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [selectedItem, setSelectedItem] = useState<WorkItemCalendar | null>(null);

  // Month Date Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Fetch Aux Data (users, departments)
  useEffect(() => {
    const fetchAux = async () => {
      try {
        const [uRes, dRes] = await Promise.all([
          apiFetch<{ data: UserOption[] }>('/api/people?status=active').catch(() =>
            apiFetch<{ data: UserOption[] }>('/api/users?limit=100').catch(() => ({ data: [] }))
          ),
          apiFetch<{ data?: DepartmentOption[]; departments?: DepartmentOption[] }>('/api/departments?limit=50').catch(() => ({ data: [] })),
        ]);
        setUsers(uRes.data || []);
        setDepartments(dRes.data || (dRes as any).departments || []);
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

      if (selectedDepartment !== 'all') params.set('departmentId', selectedDepartment);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedOwner !== 'all') params.set('ownerId', selectedOwner);
      if (currentCalendar !== 'all') params.set('calendar', currentCalendar);

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
  }, [year, month, selectedDepartment, selectedStatus, selectedOwner, currentCalendar]);

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

  const canCreatePlans = user?.role === 'sm_manager' || user?.role === 'admin' || user?.role === 'creative_head';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Creative Calendar</h1>
              <p className="text-sm font-medium text-slate-500">
                Plan, schedule and track deliverables across creative calendars
              </p>
            </div>
          </div>
        </div>

        {canCreatePlans && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleTabChange('plans');
                setIsIndividualCreateRequested(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add individual work
            </button>
          </div>
        )}
      </div>

      {user?.role === 'team_member' && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Creative Team Members view their personal stage assignments, deliverables, and submissions directly in the <strong>My Work</strong> portal.
            </span>
          </div>
          <button
            onClick={() => navigate('/my-work')}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs whitespace-nowrap"
          >
            Go to My Work
          </button>
        </div>
      )}

      {/* Top Calendar Selector Row with Legend */}
      <div className="glass-card p-3 border border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
            Calendar:
          </span>
          <button
            onClick={() => handleCalendarSelect('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 border ${
              currentCalendar === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <span>All Calendars</span>
          </button>
          {CALENDAR_LIST.map((cal) => {
            const isSelected = currentCalendar === cal.key;
            return (
              <button
                key={cal.key}
                onClick={() => handleCalendarSelect(cal.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 border ${
                  isSelected ? 'shadow-sm' : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: isSelected ? cal.bg : '#ffffff',
                  borderColor: isSelected ? cal.border : '#e2e8f0',
                  color: isSelected ? cal.text : '#475569',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cal.color }}
                />
                <span>{cal.name}</span>
              </button>
            );
          })}
        </div>

        {/* Status / Scope Note */}
        <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
          <span>Viewing:</span>
          <span className="font-semibold text-slate-700">
            {currentCalendar === 'all'
              ? 'All Calendars'
              : getCalendarDefinition(currentCalendar as CalendarKey).name}
          </span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => handleTabChange('month')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'month'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Month (Deadlines)
        </button>
        <button
          onClick={() => handleTabChange('plans')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'plans'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          Plans & Approval
        </button>
        <button
          onClick={() => handleTabChange('tracker')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'tracker'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          Content Flow Tracker
        </button>
      </div>

      {/* Tab: Plans & Approval */}
      {activeTab === 'plans' && (
        <PlansTab
          selectedCalendar={currentCalendar}
          isIndividualCreateRequested={isIndividualCreateRequested}
          onIndividualCreateHandled={() => setIsIndividualCreateRequested(false)}
        />
      )}

      {/* Tab: Content Flow Tracker */}
      {activeTab === 'tracker' && (
        <TrackerTab selectedCalendar={currentCalendar} />
      )}

      {/* Tab: Month (Deadlines) */}
      {activeTab === 'month' && (
        <>
          {isLoading && (
            <div className="text-center py-1 text-xs text-purple-600 animate-pulse font-medium">
              Loading calendar deliverables...
            </div>
          )}
          {/* Controls Bar */}
          <div className="glass-card p-4 border border-white/80 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Prev / Today / Next and Month Title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={handlePrev}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                  title="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                >
                  Today
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                  title="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 min-w-[160px]">
                {monthName}
              </h2>
            </div>

            {/* View Switcher */}
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
            </div>
          </div>

          {/* Filter Row */}
          <div className="glass-card p-4 border border-white/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* VIEW: MONTH GRID PERSPECTIVE */}
          {viewMode === 'month' && (
            <div className="glass-card p-4 border border-white/80 overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px mb-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map(({ date, isCurrentMonth, key }) => {
                  const dayItems = itemsByDate.get(key) || [];
                  const isToday = key === todayKey;

                  return (
                    <div
                      key={key}
                      className={`min-h-[110px] p-2 rounded-xl border flex flex-col justify-between transition-all ${
                        isCurrentMonth ? 'bg-white/60 border-slate-200/70' : 'bg-slate-50/40 border-slate-100 opacity-60'
                      } ${isToday ? 'ring-2 ring-purple-500/30 border-purple-300 bg-purple-50/20' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-extrabold w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-purple-600 text-white shadow-xs'
                              : isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </div>

                      {/* Day Deliverables */}
                      <div className="space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                        {dayItems.slice(0, 3).map((item) => {
                          const cal = getCalendarDefinition(item.calendar);
                          return (
                            <div
                              key={item._id}
                              onClick={() => setSelectedItem(item)}
                              className="px-2 py-1 rounded text-[11px] font-medium border cursor-pointer transition-all hover:scale-[1.02] truncate flex items-center gap-1.5"
                              style={{
                                backgroundColor: cal.bg,
                                borderColor: cal.border,
                                color: cal.text,
                              }}
                              title={`${item.title} (${item.status}) [${cal.name}]`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cal.color }}
                              />
                              <span className="truncate flex-1 font-semibold">
                                {formatCalendarItemTitle(item)}
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
                            const cal = getCalendarDefinition(item.calendar);

                            return (
                              <div
                                key={item._id}
                                onClick={() => setSelectedItem(item)}
                                className="p-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-purple-300 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                                    style={{
                                      backgroundColor: cal.bg,
                                      borderColor: cal.border,
                                      color: cal.text,
                                    }}
                                  >
                                    {cal.name}
                                  </span>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                    {item.status}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                  {formatCalendarItemTitle(item)}
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
                  <p className="text-xs text-slate-400 mt-1">Try adjusting filters or adding a new deliverable.</p>
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
                              const cal = getCalendarDefinition(item.calendar);

                              return (
                                <div
                                  key={item._id}
                                  onClick={() => setSelectedItem(item)}
                                  className="p-3 rounded-xl bg-white/90 border border-slate-200 hover:border-purple-300 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span
                                        className="text-[10px] font-bold px-2 py-0.5 rounded border"
                                        style={{
                                          backgroundColor: cal.bg,
                                          borderColor: cal.border,
                                          color: cal.text,
                                        }}
                                      >
                                        {cal.name}
                                      </span>
                                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                        {item.status}
                                      </span>
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{formatCalendarItemTitle(item)}</h4>
                                  </div>

                                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                                    <span>{item.estimatedEffortHrs}h</span>
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
                  {(() => {
                    const cal = getCalendarDefinition(selectedItem.calendar);
                    return (
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded border"
                        style={{
                          backgroundColor: cal.bg,
                          borderColor: cal.border,
                          color: cal.text,
                        }}
                      >
                        {cal.name}
                      </span>
                    );
                  })()}
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200`}>
                    {selectedItem.workType}
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

                <h3 className="text-lg font-bold text-slate-900 mb-4">{selectedItem.title}</h3>

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
        </>
      )}
    </div>
  );
};
