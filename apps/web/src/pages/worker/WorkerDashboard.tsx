import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  Clock,
  AlertCircle,
  UserCheck,
  UserX,
  AlertTriangle,
  MessageSquare,
  Send,
  X,
  Play,
  Square,
  Calendar,
  Upload,
  Award,
} from 'lucide-react';
import { WorkerUploadModal } from '../../components/deliverables/WorkerUploadModal';

interface TaskItem {
  _id: string;
  taskId: string;
  stageKey: string;
  stageOrder: number;
  title: string;
  team: string;
  status: string;
  estimateHours: number;
  actualHours: number;
  holdReason?: string;
  holdComment?: string;
  dueDate?: string;
  assignee?: { _id: string; name: string; email: string; avatar?: string };
  contentItemId: {
    _id: string;
    contentId: string;
    title: string;
    format: string;
    priority: string;
    status: string;
    publishDate: string;
    brief?: string;
  };
  dependencies?: Array<{ _id: string; taskId: string; title: string; status: string }>;
  subtasks?: Array<{ _id: string; title: string; completed: boolean }>;
  revisionCount?: number;
  extensionRequest?: {
    requestedDate?: string;
    reason?: string;
    status: 'none' | 'pending' | 'approved' | 'rejected';
    requestedAt?: string;
    responseNote?: string;
  };
}

const HOLD_REASONS = [
  { value: 'waiting_for_content', label: 'Waiting for Content / Copy' },
  { value: 'approval_delay', label: 'Client / Stakeholder Delay' },
  { value: 'resource_shortage', label: 'Resource / Bandwidth Shortage' },
  { value: 'client_feedback', label: 'Awaiting Client Asset / Spec' },
  { value: 'equipment', label: 'Hardware / Software Blocker' },
  { value: 'other', label: 'Other Operational Reason' },
];

export const WorkerDashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'mine' | 'teamQueue' | 'calendar'>('mine');
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showReasonModal, setShowReasonModal] = useState<boolean>(false);
  const [targetStatus, setTargetStatus] = useState<'blocked' | 'on_hold' | null>(null);
  const [holdReason, setHoldReason] = useState<string>('waiting_for_content');
  const [holdComment, setHoldComment] = useState<string>('');
  const [taskCommentText, setTaskCommentText] = useState<string>('');
  const [attendance, setAttendance] = useState<'present' | 'on_leave'>('present');
  const [uploadTask, setUploadTask] = useState<TaskItem | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>('');
  const [showExtensionModal, setShowExtensionModal] = useState<boolean>(false);
  const [extensionTask, setExtensionTask] = useState<TaskItem | null>(null);
  const [extensionDate, setExtensionDate] = useState<string>('');
  const [extensionReason, setExtensionReason] = useState<string>('');

  // Active timer query
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

  const [timerSeconds, setTimerSeconds] = useState(0);
  React.useEffect(() => {
    if (activeTimer?.start) {
      const startMs = new Date(activeTimer.start).getTime();
      const update = () => setTimerSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      setTimerSeconds(0);
    }
  }, [activeTimer]);

  const startTimerMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch('/api/time/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to start timer');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });

  // Leave Request Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveType, setLeaveType] = useState('vacation');
  const [leaveReason, setLeaveReason] = useState('');

  const requestLeaveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: leaveStart,
          endDate: leaveEnd,
          type: leaveType,
          reason: leaveReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to request leave');
      return data.data;
    },
    onSuccess: () => {
      setShowLeaveModal(false);
      setLeaveReason('');
      setLeaveStart('');
      setLeaveEnd('');
    },
  });

  // Fetch My Tasks
  const { data: myTasks = [], isLoading: myTasksLoading } = useQuery({
    queryKey: ['myTasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks?mine=true');
      if (!res.ok) throw new Error('Failed to load my tasks');
      const data = await res.json();
      return data.data as TaskItem[];
    },
  });

  // Fetch Team Queue
  const { data: teamTasks = [], isLoading: teamTasksLoading } = useQuery({
    queryKey: ['teamQueueTasks', user?.team],
    queryFn: async () => {
      const res = await fetch('/api/tasks?teamQueue=true');
      if (!res.ok) throw new Error('Failed to load team tasks');
      const data = await res.json();
      return data.data as TaskItem[];
    },
    enabled: activeTab === 'teamQueue',
  });

  // Fetch Task Comments & Reviewer Deliverable Feedback
  const { data: taskComments = [] } = useQuery({
    queryKey: ['taskComments', selectedTask?._id],
    queryFn: async () => {
      if (!selectedTask) return [];
      const res = await fetch(`/api/comments?entityType=task&entityId=${selectedTask._id}&includeDeliverables=true`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!selectedTask,
  });

  const { data: dashboardSummary } = useQuery({
    queryKey: ['worker-dashboard-summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.data;
    },
  });

  // Mutations
  const transitionMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
      holdReason,
      holdComment,
    }: {
      taskId: string;
      status: string;
      holdReason?: string;
      holdComment?: string;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, holdReason, holdComment }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to update task status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      queryClient.invalidateQueries({ queryKey: ['teamQueueTasks'] });
      setShowReasonModal(false);
      setSelectedTask(null);
    },
    onError: (err: Error) => {
      alert(`Status transition error: ${err.message}`);
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ text, taskId }: { text: string; taskId: string }) => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'task', entityId: taskId, text }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskComments', selectedTask?._id] });
      setTaskCommentText('');
    },
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ taskId, subtaskId, completed }: { taskId: string; subtaskId: string; completed?: boolean }) => {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error('Failed to update subtask');
      return res.json();
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      if (selectedTask && resData?.data) {
        setSelectedTask(resData.data);
      }
    },
  });

  const addSubtaskMutation = useMutation({
    mutationFn: async ({ taskId, title }: { taskId: string; title: string }) => {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to add subtask');
      return res.json();
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      if (selectedTask && resData?.data) {
        setSelectedTask(resData.data);
      }
      setNewSubtaskTitle('');
    },
  });

  const requestExtensionMutation = useMutation({
    mutationFn: async ({ taskId, requestedDate, reason }: { taskId: string; requestedDate: string; reason: string }) => {
      const res = await fetch(`/api/tasks/${taskId}/extension-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedDate, reason }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to submit extension request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      setShowExtensionModal(false);
      setExtensionDate('');
      setExtensionReason('');
      alert('Deadline extension request submitted to Marketing Lead.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to submit extension request');
    },
  });

  const handleQuickStatusChange = (task: TaskItem, newStatus: string) => {
    if (newStatus === 'blocked' || newStatus === 'on_hold') {
      setSelectedTask(task);
      setTargetStatus(newStatus as any);
      setShowReasonModal(true);
      return;
    }

    transitionMutation.mutate({ taskId: task._id, status: newStatus });
  };

  const submitHoldOrBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !targetStatus) return;

    transitionMutation.mutate({
      taskId: selectedTask._id,
      status: targetStatus,
      holdReason,
      holdComment,
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskCommentText.trim() || !selectedTask) return;
    commentMutation.mutate({ text: taskCommentText, taskId: selectedTask._id });
  };

  const tasksToDisplay = activeTab === 'mine' ? myTasks : teamTasks;

  // KPI Calculations
  const inProgressCount = myTasks.filter((t) => t.status === 'in_progress').length;
  const assignedCount = myTasks.filter((t) => t.status === 'assigned').length;
  const completedCount = myTasks.filter((t) => t.status === 'done' || t.status === 'approved').length;
  const totalPlannedHours = myTasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header & Attendance Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Production Workspace
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
              Team: {user?.team || 'Creative'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Execute assigned creative stages, log deliverables, and complete automated handoffs.
          </p>
        </div>

        {/* Attendance status & Leave Request */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors shadow-xs"
          >
            <Calendar className="w-3.5 h-3.5 text-violet-500" />
            <span>Request Leave</span>
          </button>

          <div className="flex items-center gap-2 p-1.5 glass-panel border border-white/80 rounded-full">
            <span className="text-xs text-slate-500 font-medium pl-2">Status:</span>
            <button
              onClick={() => setAttendance(attendance === 'present' ? 'on_leave' : 'present')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                attendance === 'present'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-amber-500 text-white shadow-xs'
              }`}
            >
              {attendance === 'present' ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Present</span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  <span>On Leave</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active Running Timer Banner */}
      {activeTimer && (
        <div className="p-3.5 rounded-2xl bg-violet-600/10 border border-violet-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                Tracking Time on Task
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                {activeTimer.taskId?.taskId}: {activeTimer.taskId?.title}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-violet-600">
              {Math.floor(timerSeconds / 3600).toString().padStart(2, '0')}:
              {Math.floor((timerSeconds % 3600) / 60).toString().padStart(2, '0')}:
              {(timerSeconds % 60).toString().padStart(2, '0')}
            </span>
            <button
              onClick={() => stopTimerMutation.mutate()}
              className="px-3 py-1 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition-colors flex items-center gap-1"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop
            </button>
          </div>
        </div>
      )}

      {/* 2. KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="glass-panel p-4 border border-white/80">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">In Progress</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{inProgressCount}</p>
        </div>
        <div className="glass-panel p-4 border border-white/80">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Assignment</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{assignedCount}</p>
        </div>
        <div className="glass-panel p-4 border border-white/80">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Completed Tasks</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{completedCount}</p>
        </div>
        <div className="glass-panel p-4 border border-white/80">
          <p className="text-[11px] font-bold text-[#7a6af6] uppercase tracking-wider">Total Est. Hours</p>
          <p className="text-2xl font-black text-[#7a6af6] mt-1">{totalPlannedHours}h</p>
        </div>
        <Link
          to="/reports"
          className="glass-panel p-4 border border-purple-200/60 bg-gradient-to-br from-white to-purple-50/50 hover:border-purple-300 transition-all flex flex-col justify-between"
          title="Inspect full worker performance & efficiency scorecard"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#7a6af6] uppercase tracking-wider">Efficiency</p>
            <Award className="w-3.5 h-3.5 text-[#7a6af6]" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-[#7a6af6]">
              {dashboardSummary?.widgets?.efficiencyScore ?? '—'}
            </span>
            <span className="text-xs text-slate-400 font-semibold">/ 100</span>
          </div>
        </Link>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${
              activeTab === 'mine' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Assigned Tasks ({myTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('teamQueue')}
            className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${
              activeTab === 'teamQueue' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Team Handoff Queue ({user?.team || 'Team'})
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
          Automated Handoffs Enabled
        </span>
      </div>

      {/* 4. Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myTasksLoading || teamTasksLoading ? (
          <div className="col-span-3 py-16 text-center text-slate-400 text-xs">
            Loading assigned production tasks...
          </div>
        ) : tasksToDisplay.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-slate-400 text-xs">
            No active tasks found in this queue.
          </div>
        ) : (
          tasksToDisplay.map((task) => {
            const hasBlockedDep =
              task.dependencies?.some((d) => d.status !== 'done' && d.status !== 'approved') || false;

            return (
              <div
                key={task._id}
                className="glass-panel p-5 border border-white/90 space-y-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#7a6af6] bg-[#7a6af6]/10 px-2 py-0.5 rounded">
                      {task.taskId}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        task.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : task.status === 'done' || task.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : task.status === 'blocked'
                          ? 'bg-rose-100 text-rose-700'
                          : task.status === 'on_hold'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{task.title}</h3>

                  <p className="text-xs text-slate-500 font-medium">
                    Deliverable:{' '}
                    <b className="text-slate-800">{task.contentItemId?.title || 'Deliverable'}</b> (
                    {task.contentItemId?.contentId})
                  </p>

                  {/* Dependencies Banner */}
                  {hasBlockedDep && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Prerequisite task pending before this can start</span>
                    </div>
                  )}

                  {/* Hold Reason Banner */}
                  {task.holdReason && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-0.5">
                      <span className="font-bold uppercase tracking-wider block">
                        Reason: {task.holdReason.replace('_', ' ')}
                      </span>
                      {task.holdComment && <p>{task.holdComment}</p>}
                    </div>
                  )}

                  {/* Changes Requested Revision Banner */}
                  {task.status === 'changes_requested' && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-[10px] uppercase tracking-wider text-amber-800">
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Changes Requested {task.revisionCount ? `(Rev #${task.revisionCount})` : ''}
                        </span>
                        <span className="font-mono text-amber-700">v{(task.revisionCount || 1) + 1} Needed</span>
                      </div>
                      <p className="text-[11px] text-amber-800">Reviewer left feedback on this deliverable. Please inspect comments and upload a revision.</p>
                    </div>
                  )}

                  {/* Extension Status Banner */}
                  {task.extensionRequest && task.extensionRequest.status === 'pending' && (
                    <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-[11px] flex items-center justify-between">
                      <span className="font-semibold">Extension Pending Review</span>
                      <span className="font-mono text-[10px]">
                        Target: {new Date(task.extensionRequest.requestedDate!).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Est: {task.estimateHours}h • <strong className="text-violet-600 font-mono">{task.actualHours || 0}h logged</strong>
                    </span>
                    <span className="text-[11px]">
                      Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTask(task)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900"
                      >
                        Details &rarr;
                      </button>

                      {['assigned', 'in_progress', 'changes_requested'].includes(task.status) && (
                        <button
                          onClick={() => {
                            setExtensionTask(task);
                            setExtensionDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
                            setExtensionReason('');
                            setShowExtensionModal(true);
                          }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-purple-600 transition-colors"
                          title="Request Deadline Extension"
                        >
                          +Extend
                        </button>
                      )}

                      {/* Timer Button */}
                      {activeTimer?.taskId?._id === task._id ? (
                        <button
                          onClick={() => stopTimerMutation.mutate()}
                          className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[11px] font-bold border border-rose-500/20 animate-pulse"
                        >
                          <Square className="w-2.5 h-2.5 fill-current" />
                          Stop Timer
                        </button>
                      ) : (
                        <button
                          onClick={() => startTimerMutation.mutate(task._id)}
                          title="Start tracking time on this task"
                          className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 text-[11px] font-semibold border border-violet-500/20 transition-colors"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          Timer
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {task.status === 'assigned' && (
                        <button
                          onClick={() => handleQuickStatusChange(task, 'in_progress')}
                          disabled={hasBlockedDep}
                          className="px-3 py-1.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold disabled:opacity-40"
                        >
                          Start Work
                        </button>
                      )}

                      {task.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => setUploadTask(task)}
                            className="px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Submit Cut</span>
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(task, 'done')}
                            className="px-2.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(task, 'blocked')}
                            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold"
                          >
                            Block
                          </button>
                        </>
                      )}

                      {task.status === 'changes_requested' && (
                        <button
                          onClick={() => setUploadTask(task)}
                          className="px-3.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs animate-bounce"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Upload Revision</span>
                        </button>
                      )}

                      {task.status === 'blocked' && (
                        <button
                          onClick={() => handleQuickStatusChange(task, 'in_progress')}
                          className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                        >
                          Resume
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setSelectedTask(null)}
          />

          <div className="relative w-full max-w-[560px] bg-white rounded-2xl shadow-modal-glass border border-white p-6 z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-bold text-[#7a6af6] bg-[#7a6af6]/10 px-2 py-0.5 rounded">
                  {selectedTask.taskId}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">{selectedTask.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Content Deliverable: {selectedTask.contentItemId?.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Brief Context */}
            {selectedTask.contentItemId?.brief && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
                <span className="font-bold uppercase text-[10px] text-slate-400 block">
                  Production Brief Context
                </span>
                <p className="leading-relaxed">{selectedTask.contentItemId.brief}</p>
              </div>
            )}

            {/* Subtasks Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Subtasks Checklist
                </h4>
                {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400">
                    {selectedTask.subtasks.filter((s: any) => s.completed).length} / {selectedTask.subtasks.length} done
                  </span>
                )}
              </div>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {(selectedTask.subtasks || []).map((st: any, i: number) => (
                  <div
                    key={st._id || i}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center gap-2 hover:bg-slate-100/60 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(st.completed)}
                      onChange={(e) => {
                        toggleSubtaskMutation.mutate({
                          taskId: selectedTask._id,
                          subtaskId: st._id,
                          completed: e.target.checked,
                        });
                      }}
                      className="rounded text-[#7a6af6] focus:ring-[#7a6af6] cursor-pointer"
                    />
                    <span className={`flex-1 text-slate-700 ${st.completed ? 'line-through text-slate-400' : ''}`}>
                      {st.title}
                    </span>
                  </div>
                ))}
                {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && (
                  <p className="text-xs text-slate-400 italic">No subtasks defined yet.</p>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubtaskTitle.trim()) return;
                  addSubtaskMutation.mutate({
                    taskId: selectedTask._id,
                    title: newSubtaskTitle.trim(),
                  });
                }}
                className="flex gap-2 pt-1"
              >
                <input
                  type="text"
                  placeholder="Add a subtask step..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
                />
                <button
                  type="submit"
                  disabled={!newSubtaskTitle.trim() || addSubtaskMutation.isPending}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-40"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Status Change Bar & Deliverable Upload */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Deliverable Upload:</span>
                <button
                  type="button"
                  onClick={() => setUploadTask(selectedTask)}
                  className="px-4 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{selectedTask.status === 'changes_requested' ? 'Upload Revision' : 'Upload Deliverable'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-500">Quick Status:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedTask, 'in_progress')}
                    className="px-3 py-1.5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold"
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedTask, 'done')}
                    className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    Mark Done
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedTask, 'on_hold')}
                    className="px-3 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold"
                  >
                    Hold
                  </button>
                </div>
              </div>
            </div>

            {/* Comments Thread */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#7a6af6]" />
                <span>Task Comments & Review Notes</span>
              </h4>

              <div className="space-y-2 max-h-[160px] overflow-y-auto">
                {taskComments.map((c: any) => (
                  <div key={c._id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{c.author?.name || 'Reviewer'}</span>
                        {c.deliverableVersion && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-violet-100 text-violet-800">
                            Cut v{c.deliverableVersion}
                          </span>
                        )}
                        {typeof c.mediaTimestamp === 'number' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 flex items-center gap-0.5">
                            ⏱️ {Math.floor(c.mediaTimestamp / 60)}:{(Math.floor(c.mediaTimestamp % 60)).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400">
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{c.text}</p>
                  </div>
                ))}
                {taskComments.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No comments on this task yet.</p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add comment..."
                  value={taskCommentText}
                  onChange={(e) => setTaskCommentText(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
                />
                <button
                  type="submit"
                  disabled={!taskCommentText.trim()}
                  className="px-3.5 py-1.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 6. Reason Code Modal for Blocked / On Hold */}
      {showReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setShowReasonModal(false)}
          />

          <div className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-modal-glass border border-white p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Specify {targetStatus === 'blocked' ? 'Blocker' : 'Hold'} Reason</span>
              </h3>
              <button
                onClick={() => setShowReasonModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitHoldOrBlock} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason Code</label>
                <select
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                >
                  {HOLD_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Explanation / Notes</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this deliverable task is blocked or paused..."
                  value={holdComment}
                  onChange={(e) => setHoldComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReasonModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transitionMutation.isPending}
                  className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Confirm Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500" />
                Request Planned Leave
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                requestLeaveMutation.mutate();
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Leave Type *
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                >
                  <option value="vacation">Vacation / Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason / Notes *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain absence and any handoff arrangements..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestLeaveMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold"
                >
                  {requestLeaveMutation.isPending ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Extension Request Modal */}
      {showExtensionModal && extensionTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-white/80 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                Request Deadline Extension
              </h3>
              <button
                onClick={() => setShowExtensionModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (extensionTask && extensionDate) {
                  requestExtensionMutation.mutate({
                    taskId: extensionTask._id,
                    requestedDate: extensionDate,
                    reason: extensionReason,
                  });
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <p className="text-slate-500 text-xs mb-2">
                  Task: <b className="text-slate-800">{extensionTask.taskId} - {extensionTask.title}</b>
                </p>
                <label className="block font-bold text-slate-700 mb-1">
                  Requested New Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={extensionDate}
                  onChange={(e) => setExtensionDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Extension Request *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why extra time is required (e.g. assets delay, complex animation rework)..."
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExtensionModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestExtensionMutation.isPending}
                  className="px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50"
                >
                  {requestExtensionMutation.isPending ? 'Submitting...' : 'Submit Extension Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Worker Upload Modal */}
      {uploadTask && (
        <WorkerUploadModal
          isOpen={!!uploadTask}
          onClose={() => setUploadTask(null)}
          task={uploadTask}
          latestVersion={uploadTask.revisionCount || 0}
        />
      )}
    </div>
  );
};
