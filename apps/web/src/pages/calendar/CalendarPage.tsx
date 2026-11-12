import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  WORK_ITEM_STATUSES,
  CALENDAR_LIST,
  getCalendarDefinition,
  getStepStatusLabel,
  type CalendarKey,
  type WorkType,
  type Priority,
  type WorkItemStatus,
} from '@mmp/shared';
import { statusClass, statusTone, withDisplayStatus } from '../../lib/statusTone';
import { useDialogFocus } from '../../lib/useDialogFocus';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  AlertTriangle,
  CalendarRange,
  ListFilter,
  Plus,
  UserRound,
  X,
} from 'lucide-react';
import { PlansTab } from './PlansTab';
import { OverdueChip, overdueLabel } from '../../components/OverdueChip';
import { TrackerTab } from './TrackerTab';

interface WorkItemCalendar {
  _id: string;
  title: string;
  workType: WorkType;
  deadline: string;
  estimatedEffortHrs?: number;
  status: WorkItemStatus;
  priority?: Priority;
  revisions?: number;
  isOverdue?: boolean;
  isLocked?: boolean;
  /** From an individual plan, not a monthly plan. */
  isIndividual?: boolean;
  isPublishEvent?: boolean;
  /** The real work item behind a publish date. */
  workItemId?: string | null;
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

const isLockedItem = (item: Pick<WorkItemCalendar, 'isLocked' | 'status'>) =>
  Boolean(item.isLocked) && item.status !== 'Approved' && item.status !== 'Published';
const itemTone = (item: WorkItemCalendar) => statusClass(statusTone(item.status, isLockedItem(item)));
const itemStatusLabel = (item: WorkItemCalendar) => (isLockedItem(item) ? 'Locked' : getStepStatusLabel(item.status));

/** In a narrow month cell only the icon shows; screen readers still get the word. */
const IndividualBadge: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <span className={`cal-individual ${compact ? 'max-sm:!px-0.5' : ''}`} title="Individual work">
    <UserRound className="w-2.5 h-2.5" aria-hidden="true" />
    <span className={compact ? 'sr-only 2xl:not-sr-only' : undefined}>Individual</span>
  </span>
);

const COLOUR_KEY: { tone: Parameters<typeof statusClass>[0]; label: string }[] = [
  { tone: 'not-started', label: `${getStepStatusLabel('Not Started')} or planned` },
  { tone: 'in-progress', label: getStepStatusLabel('In Progress') },
  { tone: 'waiting', label: getStepStatusLabel('Pending') },
  { tone: 'changes', label: getStepStatusLabel('Feedback') },
  { tone: 'approved', label: getStepStatusLabel('Approved') },
  { tone: 'blocked', label: getStepStatusLabel('Blocked') },
  { tone: 'posted', label: getStepStatusLabel('Published') },
  { tone: 'locked', label: 'Locked' },
];

/** Local calendar date for a date input (YYYY-MM-DD). */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromInputLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list' | 'custom'>('month');
  // Custom range (local calendar dates, YYYY-MM-DD). Starts at today through the next 30 days.
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date()));
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toDateInput(d);
  });
  const isCustom = viewMode === 'custom';
  const customError = !isCustom
    ? null
    : !customFrom || !customTo
      ? 'Choose both a start and an end date.'
      : customTo < customFrom
        ? 'The end date cannot be before the start date.'
        : null;

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
          apiFetch<{ data?: DepartmentOption[]; departments?: DepartmentOption[] }>('/api/departments?inUse=true').catch(() => ({ data: [] })),
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
  const fetchRequestRef = useRef(0);
  const fetchCalendarItems = async () => {
    const requestId = ++fetchRequestRef.current;
    if (customError) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Custom: the chosen days, start to end inclusive, in local time.
      // Otherwise: the month with padding (covering the whole month grid).
      const startDate = isCustom ? new Date(`${customFrom}T00:00:00`).toISOString() : new Date(year, month - 1, 20).toISOString();
      const endDate = isCustom ? new Date(`${customTo}T23:59:59.999`).toISOString() : new Date(year, month + 2, 10).toISOString();

      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
      });

      if (selectedDepartment !== 'all') params.set('departmentId', selectedDepartment);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedOwner !== 'all') params.set('ownerId', selectedOwner);
      if (currentCalendar !== 'all') params.set('calendar', currentCalendar);

      const res = await apiFetch<{ data: WorkItemCalendar[] }>(`/api/work/calendar?${params.toString()}`);
      // Dates can change quickly: only the latest request may update the list.
      if (requestId === fetchRequestRef.current) setItems((res.data || []).map((it) => withDisplayStatus(it as any)));
    } catch (err) {
      console.error('Failed to fetch calendar work items', err);
    } finally {
      if (requestId === fetchRequestRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarItems();
  }, [year, month, selectedDepartment, selectedStatus, selectedOwner, currentCalendar, isCustom, customFrom, customTo]);

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

  // Preview modal: focus moves in on open, Escape closes, Tab stays inside, focus returns on close.
  const previewRef = useRef<HTMLDivElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(previewRef, Boolean(selectedItem), () => setSelectedItem(null), { initialFocusRef: previewCloseRef });

  // Plan creation is SM Manager / Admin only (the API refuses the Creative Head), so only they see Add individual work.
  const canCreatePlans = user?.role === 'sm_manager' || user?.role === 'admin';

  // Shared text styles for this screen
  const fieldLabel = 'text-[13px] font-medium text-ui-muted';

  // Neutral calendar tag: identity comes from the dot (.cal-*), the name is always shown.
  const calTag = (key: string, name: string, size: 'sm' | 'md' = 'sm') => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/80 text-ui-text font-medium shrink-0 ${
        size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'
      }`}
    >
      <span className={`cal-dot cal-${key}`} />
      {name}
    </span>
  );

  const tabs: Array<{ id: 'month' | 'plans' | 'tracker'; label: string; Icon: typeof CalendarIcon }> = [
    { id: 'month', label: 'Month (Deadlines)', Icon: CalendarIcon },
    { id: 'plans', label: 'Plans & Approval', Icon: CalendarRange },
    { id: 'tracker', label: 'Content Flow Tracker', Icon: ListFilter },
  ];

  const views: Array<{ id: 'month' | 'week' | 'list' | 'custom'; label: string }> = [
    { id: 'month', label: 'Month' },
    { id: 'week', label: 'Week' },
    { id: 'list', label: 'List Agenda' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page title on the canvas */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">
            Creative Calendar
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ui-muted max-w-[70ch]">
            Plan, schedule and track deliverables across creative calendars
          </p>
        </div>

        {canCreatePlans && (
          <button
            onClick={() => {
              handleTabChange('plans');
              setIsIndividualCreateRequested(true);
            }}
            className="ui-btn ui-btn-primary h-11 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add individual work
          </button>
        )}
      </div>

      {user?.role === 'team_member' && (
        <div className="p-4 rounded-2xl status-tint status-waiting text-[13px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              Creative Team Members view their personal stage assignments, deliverables, and submissions directly in the <strong>My Work</strong> portal.
            </span>
          </div>
          <button onClick={() => navigate('/my-work')} className="ui-btn ui-btn-primary h-11 self-start sm:self-auto">
            Go to My Work
          </button>
        </div>
      )}

      {/* Controls: one panel. Row 1 = view tabs + calendar selector. Row 2 (month tab) = navigation, filters, view switch. */}
      <section className="glass-panel rounded-ui-panel p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="shrink-0 max-w-full overflow-x-auto no-scrollbar">
            <div role="tablist" aria-label="Calendar views" className="ui-tabs">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => handleTabChange(id)}
                  className="ui-tab"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar filter: one dropdown, aligned with the tabs. */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label htmlFor="calendar-filter" className={`${fieldLabel} shrink-0`}>Calendar</label>
            <div className="relative flex-1 sm:flex-none sm:w-64">
              {currentCalendar !== 'all' && (
                <span
                  className={`cal-dot cal-${currentCalendar} absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none`}
                  aria-hidden="true"
                />
              )}
              <select
                id="calendar-filter"
                value={currentCalendar}
                onChange={(e) => handleCalendarSelect(e.target.value)}
                className={`ui-select w-full cursor-pointer ${currentCalendar !== 'all' ? 'pl-9' : ''}`}
              >
                <option value="all">All Calendars</option>
                {CALENDAR_LIST.map((cal) => (
                  <option key={cal.key} value={cal.key}>{cal.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {activeTab === 'month' && (
          <div className="pt-5 border-t border-ui-line space-y-4">
            {/* Row 1: custom range pickers, or Prev / Today / Next and month title, with the view switcher opposite */}
            <div className="flex flex-wrap items-end justify-between gap-4">
            {isCustom ? (
              <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                <div className="min-w-0">
                  <label htmlFor="cal-custom-from" className={`${fieldLabel} block mb-1`}>From</label>
                  <input
                    id="cal-custom-from"
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    aria-invalid={customError ? true : undefined}
                    aria-describedby={customError ? 'cal-custom-error' : undefined}
                    className="ui-input w-full sm:w-44"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="cal-custom-to" className={`${fieldLabel} block mb-1`}>To</label>
                  <input
                    id="cal-custom-to"
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                    aria-invalid={customError ? true : undefined}
                    aria-describedby={customError ? 'cal-custom-error' : undefined}
                    className="ui-input w-full sm:w-44"
                  />
                </div>
              </div>
            ) : (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button onClick={handlePrev} className="ui-icon-btn" title="Previous" aria-label="Previous">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleToday} className="ui-btn ui-btn-secondary h-11 px-4">
                Today
              </button>
              <button onClick={handleNext} className="ui-icon-btn" title="Next" aria-label="Next">
                <ChevronRight className="w-4 h-4" />
              </button>
              <h2 className="order-first w-full sm:order-none sm:w-auto sm:ml-2 text-lg font-bold text-ui-ink whitespace-nowrap">
                {monthName}
              </h2>
            </div>
            )}

              {/* View switcher */}
              <div role="tablist" aria-label="Layout" className="ui-tabs flex-wrap max-w-full rounded-ui-card">
                {views.map(({ id, label }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={viewMode === id}
                    onClick={() => setViewMode(id)}
                    className="ui-tab"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: filters, full width */}
            <div className={`grid grid-cols-1 gap-3 ${departments.length > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              <div className="min-w-0">
                <label htmlFor="cal-filter-status" className={`${fieldLabel} block mb-1`}>
                  Status
                </label>
                <select
                  id="cal-filter-status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="ui-select w-full cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  {WORK_ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="cal-filter-owner" className={`${fieldLabel} block mb-1`}>
                  Assigned owner
                </label>
                <select
                  id="cal-filter-owner"
                  value={selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value)}
                  className="ui-select w-full cursor-pointer"
                >
                  <option value="all">All Team Members</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {departments.length > 0 && (
                <div className="min-w-0">
                  <label htmlFor="cal-filter-department" className={`${fieldLabel} block mb-1`}>
                    Department
                  </label>
                  <select
                    id="cal-filter-department"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="ui-select w-full cursor-pointer"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'month' && customError && (
          <p id="cal-custom-error" role="alert" className="status-tint status-changes rounded-ui-control px-3 py-2 text-sm">
            {customError}
          </p>
        )}
      </section>

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
            <div className="text-center py-1 text-[13px] text-ui-muted animate-pulse font-medium">
              Loading calendar deliverables...
            </div>
          )}

          {/* VIEW: MONTH GRID */}
          {viewMode === 'month' && (
            <section className="glass-panel rounded-ui-panel p-3 sm:p-5 overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px mb-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-2 text-[11px] font-semibold uppercase tracking-wider text-ui-muted">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarDays.map(({ date, isCurrentMonth, key }) => {
                  const dayItems = itemsByDate.get(key) || [];
                  const isToday = key === todayKey;

                  return (
                    <div
                      key={key}
                      className={`min-h-[110px] p-1.5 sm:p-2 rounded-2xl bg-ui-card flex flex-col justify-between ${
                        isToday ? 'ring-[1.5px] ring-ui-ink' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-ui-ink text-white' : isCurrentMonth ? 'text-ui-text' : 'text-ui-muted'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </div>

                      {/* Day deliverables */}
                      <div className="space-y-1 overflow-y-auto max-h-[110px] no-scrollbar">
                        {dayItems.slice(0, 3).map((item) => {
                          const cal = getCalendarDefinition(item.calendar);
                          return (
                            <button
                              type="button"
                              key={item._id}
                              onClick={() => setSelectedItem(item)}
                              className={`cal-chip ${itemTone(item)} w-full text-left px-1 sm:px-2 py-1 rounded-lg text-[11px] cursor-pointer hover:brightness-95 transition truncate flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2`}
                              title={`${item.title} (${itemStatusLabel(item)}) [${cal.name}]${item.isIndividual ? ' Individual work' : ''}`}
                            >
                              {/* On a phone the cell only fits one mark, so the badge takes the dot's place. */}
                              <span className={`cal-dot cal-${cal.key} ${item.isIndividual ? 'max-sm:hidden' : ''}`} />
                              <span className="truncate flex-1 min-w-0 font-medium">{formatCalendarItemTitle(item)}</span>
                              <span className="sr-only">{itemStatusLabel(item)}</span>
                              {item.isIndividual && <IndividualBadge compact />}
                              {item.isOverdue && (
                                <span className="w-1.5 h-1.5 rounded-full bg-ui-coral ring-1 ring-white flex-shrink-0" title={overdueLabel(item.deadline)}>
                                  <span className="sr-only">{overdueLabel(item.deadline)}</span>
                                </span>
                              )}
                            </button>
                          );
                        })}

                        {dayItems.length > 3 && (
                          <button
                            onClick={() => {
                              setCurrentDate(date);
                              setViewMode('list');
                            }}
                            className="text-[11px] font-semibold text-ui-text hover:underline underline-offset-2 pl-1 block text-left"
                          >
                            +{dayItems.length - 3}<span className="max-sm:sr-only"> more items</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* VIEW: WEEK */}
          {viewMode === 'week' && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map(({ date, key }) => {
                const dayItems = itemsByDate.get(key) || [];
                const isToday = key === todayKey;

                return (
                  <div
                    key={key}
                    className={`glass-card p-3 flex flex-col justify-between min-h-[380px] ${
                      isToday ? 'ring-[1.5px] ring-ui-ink' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-ui-line">
                        <div>
                          <span className="text-[11px] font-semibold text-ui-muted uppercase tracking-wider block">
                            {date.toLocaleDateString('default', { weekday: 'short' })}
                          </span>
                          <span className="text-sm font-bold text-ui-ink">
                            {date.getDate()} {date.toLocaleDateString('default', { month: 'short' })}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-ui-text tabular-nums">
                          {dayItems.length}
                        </span>
                      </div>

                      {/* Item cards */}
                      <div className="space-y-2">
                        {dayItems.length === 0 ? (
                          <p className="text-xs text-ui-muted italic text-center py-8">No deliverables scheduled</p>
                        ) : (
                          dayItems.map((item) => {
                            const statusStyle = itemTone(item);
                            const cal = getCalendarDefinition(item.calendar);

                            return (
                              <button
                                type="button"
                                key={item._id}
                                onClick={() => setSelectedItem(item)}
                                className="block w-full text-left p-2.5 rounded-xl bg-white/70 hover:bg-white transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2"
                              >
                                <span className="flex flex-wrap items-center justify-between gap-1 mb-1">
                                  {calTag(cal.key, cal.name)}
                                  <span className={`status-chip ${statusStyle} text-[10px] font-semibold px-1.5 py-0.5`}>
                                    {itemStatusLabel(item)}
                                  </span>
                                  {item.isIndividual && <IndividualBadge />}
                                  {item.isOverdue && <OverdueChip deadline={item.deadline} className="text-[10px] px-1.5 py-0.5" />}
                                </span>
                                <span className="block text-xs font-semibold text-ui-text line-clamp-2 group-hover:underline underline-offset-2">
                                  {formatCalendarItemTitle(item)}
                                </span>
                                <span className="flex items-center justify-between mt-2 pt-1 border-t border-ui-line text-[11px] text-ui-muted">
                                  <span>{item.workType}</span>
                                  {item.ownerId && (
                                    <span className="font-medium text-ui-text truncate max-w-[80px]">{item.ownerId.name}</span>
                                  )}
                                </span>
                              </button>
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

          {/* VIEW: LIST AGENDA */}
          {(viewMode === 'list' || isCustom) && (
            <section className="glass-panel rounded-ui-panel p-5 sm:p-6">
              <h3 className="text-base font-semibold text-ui-text mb-4 flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-ui-ink" />
                {isCustom && !customError
                  ? `Deliverables, ${fromInputLabel(customFrom)} to ${fromInputLabel(customTo)}`
                  : 'Chronological Deliverable Agenda'}
              </h3>

              {items.length === 0 ? (
                <div className="glass-card text-center py-12">
                  <CalendarRange className="w-10 h-10 text-ui-muted mx-auto mb-2" />
                  <p className="text-sm font-semibold text-ui-text">
                    {customError ? 'Fix the dates above to see deliverables' : 'No deliverables found for this filter range'}
                  </p>
                  {!customError && <p className="text-[13px] text-ui-muted mt-1">Try adjusting filters or adding a new deliverable.</p>}
                </div>
              ) : (
                <div className="divide-y divide-ui-line">
                  {Array.from(itemsByDate.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dateKey, dayItems]) => {
                      const d = new Date(dateKey + 'T00:00:00');
                      const isToday = dateKey === todayKey;

                      return (
                        <div key={dateKey} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                isToday ? 'bg-ui-ink text-white' : 'bg-white/70 text-ui-text'
                              }`}
                            >
                              {d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {isToday && <span className="text-[13px] font-semibold text-ui-ink">Today</span>}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {dayItems.map((item) => {
                              const statusStyle = itemTone(item);
                              const cal = getCalendarDefinition(item.calendar);

                              return (
                                <button
                                  type="button"
                                  key={item._id}
                                  onClick={() => setSelectedItem(item)}
                                  className="glass-card cursor-pointer w-full text-left p-3 flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2"
                                >
                                  <span className="block w-full">
                                    <span className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                                      {calTag(cal.key, cal.name)}
                                      <span className={`status-chip ${statusStyle} text-[10px] font-semibold px-2 py-0.5`}>
                                        {itemStatusLabel(item)}
                                      </span>
                                      {item.isIndividual && <IndividualBadge />}
                                      {item.isOverdue && <OverdueChip deadline={item.deadline} className="text-[10px] px-2 py-0.5" />}
                                    </span>
                                    <span className="block text-[13px] font-semibold text-ui-text line-clamp-1">
                                      {formatCalendarItemTitle(item)}
                                    </span>
                                  </span>

                                  <span className="flex w-full items-center justify-between mt-3 pt-2 border-t border-ui-line text-[11px] text-ui-muted">
                                    <span>{item.estimatedEffortHrs != null ? `${item.estimatedEffortHrs}h` : item.workType}</span>
                                    <span className="font-medium text-ui-text">{item.ownerId?.name || 'Unassigned'}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>
          )}

          {/* What the colours and the badge mean */}
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-medium" aria-label="Calendar key">
            {COLOUR_KEY.map(({ tone, label }) => (
              <li key={tone} className={`cal-chip ${statusClass(tone)} rounded-lg px-2 py-0.5`}>
                {label}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5 text-ui-muted">
              <IndividualBadge /> Individual work, not part of a monthly plan
            </li>
          </ul>

          {/* QUICK PREVIEW MODAL */}
          {selectedItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim backdrop-blur-sm">
              <div
                ref={previewRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cal-preview-title"
                className="glass-modal w-full max-w-lg p-6 relative"
              >
                <button
                  ref={previewCloseRef}
                  onClick={() => setSelectedItem(null)}
                  aria-label="Close"
                  className="ui-icon-btn absolute top-4 right-4"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex flex-wrap items-center gap-2 mb-2 pr-12">
                  {(() => {
                    const cal = getCalendarDefinition(selectedItem.calendar);
                    return calTag(cal.key, cal.name, 'md');
                  })()}
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 text-ui-text">
                    {selectedItem.workType}
                  </span>
                  <span className={`status-chip ${itemTone(selectedItem)} text-xs font-semibold px-2.5 py-0.5`}>
                    {itemStatusLabel(selectedItem)}
                  </span>
                  {selectedItem.isIndividual && <IndividualBadge />}
                  {selectedItem.isOverdue && (
                    <OverdueChip deadline={selectedItem.deadline} className="text-xs px-2.5 py-0.5" />
                  )}
                </div>

                <h3 id="cal-preview-title" className="text-lg font-bold text-ui-ink mb-4">
                  {selectedItem.title}
                </h3>

                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/70 mb-5 text-[13px]">
                  <div>
                    <span className="text-xs font-medium text-ui-muted block">Deliverable type</span>
                    <span className="font-semibold text-ui-text">{selectedItem.workType}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-ui-muted block">Deadline</span>
                    <span className="font-semibold text-ui-text">
                      {new Date(selectedItem.deadline).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-ui-muted block">Assigned to</span>
                    <span className="font-semibold text-ui-text">{selectedItem.ownerId?.name || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-ui-muted block">Effort / priority</span>
                    <span className="font-semibold text-ui-text">
                      {[selectedItem.estimatedEffortHrs != null ? `${selectedItem.estimatedEffortHrs}h` : null, selectedItem.priority?.toUpperCase()]
                        .filter(Boolean)
                        .join(' • ') || '–'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button onClick={() => setSelectedItem(null)} className="ui-btn ui-btn-secondary h-11">
                    Close
                  </button>
                  {/* A publish date opens its final step; a row with no steps yet has nothing to open. */}
                  {(!selectedItem.isPublishEvent || selectedItem.workItemId) && (
                    <button
                      onClick={() => {
                        navigate(`/work/${selectedItem.workItemId || selectedItem._id}`);
                      }}
                      className="ui-btn ui-btn-primary h-11"
                    >
                      Open Workplace
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
