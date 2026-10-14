import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  Clock,
  Square,
  Plus,
  CheckCircle2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
} from 'lucide-react';

interface TimeEntryItem {
  _id: string;
  taskId: {
    _id: string;
    taskId: string;
    title: string;
    team: string;
    estimateHours?: number;
    actualHours?: number;
    contentItemId?: { contentId: string; title: string };
  };
  userId: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    teamId?: string;
  };
  date: string;
  start?: string;
  end?: string;
  minutes: number;
  note?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  approvedBy?: { name: string };
  rejectionComment?: string;
}

export const TimesheetsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const isReviewer = hasPermission('timesheet.approve') || ['lead', 'team_lead', 'admin'].includes(user?.role || '');

  const [activeTab, setActiveTab] = useState<'my' | 'approvals'>(isReviewer ? 'approvals' : 'my');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Manual Entry Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualMinutes, setManualMinutes] = useState(60);
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualNote, setManualNote] = useState('');

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectEntryIds, setRejectEntryIds] = useState<string[]>([]);
  const [rejectComment, setRejectComment] = useState('');

  // 1. Fetch Active Timer
  const { data: activeTimer } = useQuery({
    queryKey: ['activeTimer'],
    queryFn: async () => {
      const res = await fetch('/api/time/timer/active');
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 10000,
  });

  // Local live timer seconds counter
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    if (activeTimer?.start) {
      const startTime = new Date(activeTimer.start).getTime();
      const update = () => {
        const diffSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        setTimerSeconds(diffSec);
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      setTimerSeconds(0);
    }
  }, [activeTimer]);

  const formatTimerDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  // 2. Fetch My Tasks for logging
  const { data: myTasks = [] } = useQuery({
    queryKey: ['myTasksForTime'],
    queryFn: async () => {
      const res = await fetch('/api/tasks?mine=true');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  // 3. Fetch Time Entries for current week
  const weekStartStr = currentWeekStart.toISOString().split('T')[0];
  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['timeEntries', weekStartStr, activeTab],
    queryFn: async () => {
      let url = `/api/time?weekStart=${weekStartStr}`;
      if (activeTab === 'approvals') {
        url += '&status=submitted';
      }
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as TimeEntryItem[];
    },
  });

  // Stop Timer Mutation
  const stopTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time/timer/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to stop timer');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });

  // Manual Log Mutation
  const manualLogMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: manualTaskId,
          date: manualDate,
          minutes: Number(manualMinutes),
          note: manualNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to log time');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setShowManualModal(false);
      setManualNote('');
    },
  });

  // Submit Timesheet Mutation
  const submitTimesheetMutation = useMutation({
    mutationFn: async (entryIds?: string[]) => {
      const res = await fetch('/api/time/timesheet/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: weekStartStr, entryIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit timesheet');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });

  // Approve / Reject Timesheet Mutation
  const reviewTimesheetMutation = useMutation({
    mutationFn: async ({
      entryIds,
      status,
      comment,
    }: {
      entryIds: string[];
      status: 'approved' | 'rejected';
      comment?: string;
    }) => {
      const res = await fetch('/api/time/timesheet/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds, status, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to review timesheet');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setRejectModalOpen(false);
      setRejectEntryIds([]);
      setRejectComment('');
    },
  });

  // Week navigation
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Group entries by task for My Timesheet grid
  const myDraftEntries = timeEntries.filter((e) => e.status === 'draft');
  const myTotalMinutes = timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
  const myTotalHours = (myTotalMinutes / 60).toFixed(1);

  // Group entries by worker for Approvals tab
  const entriesByWorker = timeEntries.reduce((acc, entry) => {
    const workerId = entry.userId?._id || 'unknown';
    if (!acc[workerId]) {
      acc[workerId] = {
        worker: entry.userId,
        entries: [],
        totalMinutes: 0,
      };
    }
    acc[workerId].entries.push(entry);
    acc[workerId].totalMinutes += entry.minutes || 0;
    return acc;
  }, {} as Record<string, { worker: any; entries: TimeEntryItem[]; totalMinutes: number }>);

  return (
    <div className="space-y-6">
      {/* Top Banner with Active Timer */}
      <div className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <Clock className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Time Tracking & Timesheet Hub
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Log live work hours, submit weekly timesheets, and review team productivity rollups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowManualModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 text-violet-500" />
              Log Manual Time
            </button>
          </div>
        </div>

        {/* Live Active Timer Bar */}
        {activeTimer ? (
          <div className="mt-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
              </span>
              <div>
                <div className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                  Active Running Timer
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeTimer.taskId?.taskId}: {activeTimer.taskId?.title}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-mono text-2xl font-bold text-violet-600 dark:text-violet-400">
                {formatTimerDuration(timerSeconds)}
              </span>
              <button
                disabled={stopTimerMutation.isPending}
                onClick={() => stopTimerMutation.mutate()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium text-xs hover:bg-rose-700 transition-colors shadow-sm"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop Timer
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Tabs & Week Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'my'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            My Timesheet
          </button>
          {isReviewer && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'approvals'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Team Approvals
            </button>
          )}
        </div>

        {/* Week Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-1.5 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 text-xs font-semibold text-slate-800 dark:text-slate-200">
            {currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <button
            onClick={handleNextWeek}
            className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* My Timesheet View                                              */}
      {/* ============================================================== */}
      {activeTab === 'my' && (
        <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10 gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Logged Work Entries
              </h3>
              <p className="text-xs text-slate-500">
                Total hours logged this week:{' '}
                <strong className="text-violet-600 dark:text-violet-400">{myTotalHours} hrs</strong>
              </p>
            </div>

            {myDraftEntries.length > 0 && (
              <button
                disabled={submitTimesheetMutation.isPending}
                onClick={() => submitTimesheetMutation.mutate()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white font-medium text-xs hover:bg-violet-700 transition-colors shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Weekly Timesheet ({myDraftEntries.length} draft entries)
              </button>
            )}
          </div>

          {entriesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm italic">
              No time logged for this week. Use the timer or Log Manual Time above.
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => {
                const entryDate = new Date(entry.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

                const statusStyles = {
                  draft: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                  submitted: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                  rejected: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
                };

                return (
                  <div
                    key={entry._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">
                          {entry.taskId?.taskId || 'Task'}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {entry.taskId?.title}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {entryDate} • {entry.note || 'No notes entered'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {(entry.minutes / 60).toFixed(1)} hrs ({entry.minutes}m)
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          statusStyles[entry.status]
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* Team Approvals View                                            */}
      {/* ============================================================== */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {Object.keys(entriesByWorker).length === 0 ? (
            <div className="text-center py-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                All timesheets reviewed!
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                No submitted time entries pending approval for this week.
              </p>
            </div>
          ) : (
            Object.values(entriesByWorker).map((group) => {
              const entryIds = group.entries.map((e) => e._id);
              const totalHours = (group.totalMinutes / 60).toFixed(1);

              return (
                <div
                  key={group.worker?._id}
                  className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-sm">
                        {group.worker?.name?.charAt(0) || 'W'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          {group.worker?.name}
                        </h4>
                        <div className="text-xs text-slate-500">
                          {group.worker?.email} • {group.worker?.teamId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2">
                        <span className="text-xs font-semibold uppercase text-slate-400">Total Submitted</span>
                        <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
                          {totalHours} hrs
                        </div>
                      </div>

                      <button
                        disabled={reviewTimesheetMutation.isPending}
                        onClick={() =>
                          reviewTimesheetMutation.mutate({
                            entryIds,
                            status: 'approved',
                            comment: 'Approved by lead',
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve Timesheet
                      </button>

                      <button
                        onClick={() => {
                          setRejectEntryIds(entryIds);
                          setRejectModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 font-medium text-xs border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>

                  {/* Entries Table */}
                  <div className="space-y-2">
                    {group.entries.map((entry) => (
                      <div
                        key={entry._id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-200/50 dark:border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500">
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {entry.taskId?.title}
                          </span>
                          {entry.note && (
                            <span className="text-slate-400 italic truncate max-w-[200px]">
                              "{entry.note}"
                            </span>
                          )}
                        </div>

                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {(entry.minutes / 60).toFixed(1)}h ({entry.minutes}m)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* Log Manual Time Modal                                          */}
      {/* ============================================================== */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Log Manual Work Hours
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-500 mb-1">
                  Select Task *
                </label>
                <select
                  value={manualTaskId}
                  onChange={(e) => setManualTaskId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 dark:text-white"
                >
                  <option value="">-- Choose Task --</option>
                  {myTasks.map((t: any) => (
                    <option key={t._id} value={t._id}>
                      {t.taskId}: {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-500 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-500 mb-1">
                    Minutes Logged *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={15}
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-500 mb-1">
                  Work Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Completed initial color grading pass, drafted hooks..."
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!manualTaskId || manualMinutes <= 0 || manualLogMutation.isPending}
                onClick={() => manualLogMutation.mutate()}
                className="px-4 py-2 rounded-xl bg-[#0D0E12] dark:bg-white text-white dark:text-slate-950 font-medium text-xs hover:opacity-90 disabled:opacity-50"
              >
                {manualLogMutation.isPending ? 'Logging...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Reject Timesheet Modal                                         */}
      {/* ============================================================== */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Reject Timesheet
            </h3>
            <p className="text-xs text-slate-500">
              Please provide feedback on why these hours are being rejected.
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Duplicate hours logged on static post..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                disabled={!rejectComment.trim() || reviewTimesheetMutation.isPending}
                onClick={() =>
                  reviewTimesheetMutation.mutate({
                    entryIds: rejectEntryIds,
                    status: 'rejected',
                    comment: rejectComment.trim(),
                  })
                }
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-medium text-xs hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimesheetsPage;
