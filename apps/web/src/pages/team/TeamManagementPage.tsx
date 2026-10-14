import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  AlertTriangle,
  ArrowRightLeft,
  ShieldCheck,
  Check,
  X,
  FileText,
  Palette,
  Camera,
  Scissors,
} from 'lucide-react';

interface Member {
  _id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  skills: string[];
  capacity: number;
  attendance: string;
  onLeave: boolean;
  plannedHours: number;
  taskCount: number;
  utilization: number;
  isOverloaded: boolean;
  currentlyOnLeave: boolean;
  tasks: Array<{
    _id: string;
    taskId: string;
    title: string;
    estimateHours: number;
    status: string;
    contentItemId?: { contentId: string; title: string; format: string };
  }>;
  upcomingLeaves: Array<{
    _id: string;
    startDate: string;
    endDate: string;
    type: string;
    reason: string;
  }>;
}

interface LeaveRequestItem {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    teamId?: string;
  };
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewComment?: string;
  reviewedBy?: { name: string };
}

const TEAMS = [
  { key: 'content', label: 'Content Team', icon: FileText, color: 'text-blue-500' },
  { key: 'graphics', label: 'Graphics Team', icon: Palette, color: 'text-pink-500' },
  { key: 'cinematography', label: 'Cinematography', icon: Camera, color: 'text-violet-500' },
  { key: 'editor', label: 'Editor Team', icon: Scissors, color: 'text-amber-500' },
];

export const TeamManagementPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isTeamLead = user?.role === 'team_lead';
  const defaultTeam = isTeamLead ? (user?.team || user?.teamId || 'content') : 'content';

  const [selectedTeam, setSelectedTeam] = useState<string>(defaultTeam);
  const [activeSubTab, setActiveSubTab] = useState<'workload' | 'skills' | 'queues' | 'leaves'>('workload');
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [taskToReassign, setTaskToReassign] = useState<any>(null);
  const [targetUserId, setTargetUserId] = useState<string>('');

  // 1. Fetch Team Dashboard Data
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['teamDashboard', selectedTeam],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${selectedTeam}/dashboard`);
      if (!res.ok) throw new Error('Failed to load team data');
      const json = await res.json();
      return json.data;
    },
  });

  // 2. Fetch Handoff Queues
  const { data: handoffQueues } = useQuery({
    queryKey: ['handoffQueues'],
    queryFn: async () => {
      const res = await fetch('/api/teams/queues');
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
    enabled: activeSubTab === 'queues',
  });

  // 3. Fetch Leaves
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['teamLeaves', selectedTeam],
    queryFn: async () => {
      const res = await fetch(`/api/leave?team=${selectedTeam}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data as LeaveRequestItem[];
    },
    enabled: activeSubTab === 'leaves',
  });

  // Reassign Mutation
  const reassignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/teams/reassign-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskToReassign._id,
          targetUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to reassign task');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamDashboard', selectedTeam] });
      setReassignModalOpen(false);
      setTaskToReassign(null);
      setTargetUserId('');
    },
  });

  // Review Leave Mutation
  const reviewLeaveMutation = useMutation({
    mutationFn: async ({ id, status, reviewComment }: { id: string; status: string; reviewComment?: string }) => {
      const res = await fetch(`/api/leave/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewComment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to review leave');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['teamDashboard'] });
    },
  });

  const members: Member[] = teamData?.members || [];
  const skillsMatrix = teamData?.skillsMatrix || [];
  const allSkills: string[] = teamData?.allSkills || [];

  const totalCapacity = teamData?.team?.totalWeeklyCapacity || 0;
  const totalPlanned = teamData?.team?.totalPlannedHours || 0;
  const teamUtilization = teamData?.team?.utilization || 0;
  const overloadedCount = members.filter((m) => m.isOverloaded).length;
  const onLeaveCount = members.filter((m) => m.currentlyOnLeave).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <Users className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Team Operations & Workload Management
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Monitor team utilization, skills matrix, reassign tasks, and coordinate leave approvals.
              </p>
            </div>
          </div>

          {/* Team Switcher Tabs (Locked for team_lead) */}
          {!isTeamLead && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5">
              {TEAMS.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTeam.toLowerCase() === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedTeam(t.key)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200/60 dark:border-white/10">
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
            <div className="text-xs font-semibold uppercase text-slate-500">Weekly Capacity</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {totalCapacity} <span className="text-sm font-normal text-slate-500">hrs</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
            <div className="text-xs font-semibold uppercase text-slate-500">Planned Demand</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {totalPlanned} <span className="text-sm font-normal text-slate-500">hrs</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
            <div className="text-xs font-semibold uppercase text-slate-500">Team Utilization</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {teamUtilization}%
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  teamUtilization > 100
                    ? 'bg-rose-500/10 text-rose-600'
                    : teamUtilization >= 85
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-emerald-500/10 text-emerald-600'
                }`}
              >
                {teamUtilization > 100 ? 'Overloaded' : teamUtilization >= 85 ? 'Warning' : 'Optimal'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
            <div className="text-xs font-semibold uppercase text-slate-500">On Leave / Overload</div>
            <div className="flex items-center gap-3 text-2xl font-bold mt-1">
              <span className="text-rose-500 text-lg">
                {onLeaveCount} <span className="text-xs font-normal text-slate-400">on leave</span>
              </span>
              <span className="text-amber-500 text-lg">
                {overloadedCount} <span className="text-xs font-normal text-slate-400">overloaded</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          onClick={() => setActiveSubTab('workload')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeSubTab === 'workload'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Members & Workload
        </button>
        <button
          onClick={() => setActiveSubTab('skills')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeSubTab === 'skills'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Skills Matrix
        </button>
        <button
          onClick={() => setActiveSubTab('queues')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeSubTab === 'queues'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Handoff Queues
        </button>
        <button
          onClick={() => setActiveSubTab('leaves')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeSubTab === 'leaves'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Leave Management
        </button>
      </div>

      {/* ============================================================== */}
      {/* Tab 1: Members & Workload                                      */}
      {/* ============================================================== */}
      {activeSubTab === 'workload' && (
        <div className="space-y-6">
          {teamLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8">
              <Users className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                No members found in this team
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Assign staff members to this team in Staff & Roles.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {members.map((member) => (
                <div
                  key={member._id}
                  className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 space-y-4 hover:shadow-md transition-all"
                >
                  {/* Member Profile Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">
                            {member.name}
                          </h3>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              member.currentlyOnLeave
                                ? 'bg-rose-500/10 text-rose-600'
                                : 'bg-emerald-500/10 text-emerald-600'
                            }`}
                          >
                            {member.currentlyOnLeave ? 'On Leave' : 'Present'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {member.email} • {member.role}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {member.plannedHours} / {member.capacity} hrs
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          member.isOverloaded
                            ? 'text-rose-500'
                            : member.utilization >= 85
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        {member.utilization}% load
                      </div>
                    </div>
                  </div>

                  {/* Capacity Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          member.isOverloaded
                            ? 'bg-rose-500'
                            : member.utilization >= 85
                            ? 'bg-amber-500'
                            : 'bg-violet-600'
                        }`}
                        style={{ width: `${Math.min(100, member.utilization)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Skills tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills?.map((skill, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                    {(member.skills?.length || 0) === 0 && (
                      <span className="text-xs text-slate-400 italic">No skills listed</span>
                    )}
                  </div>

                  {/* Active Tasks Assigned */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span>Active Tasks ({member.tasks?.length || 0})</span>
                      <span>Est. Hours</span>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {member.tasks?.map((t) => (
                        <div
                          key={t._id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-200/50 dark:border-white/5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-violet-600 dark:text-violet-400 font-semibold shrink-0">
                              {t.taskId}
                            </span>
                            <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                              {t.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {t.estimateHours || 2}h
                            </span>
                            <button
                              onClick={() => {
                                setTaskToReassign(t);
                                setReassignModalOpen(true);
                              }}
                              title="Reassign to another worker"
                              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(member.tasks?.length || 0) === 0 && (
                        <div className="text-xs text-slate-400 italic py-2">
                          No active tasks assigned to this worker.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* Tab 2: Skills Matrix                                           */}
      {/* ============================================================== */}
      {activeSubTab === 'skills' && (
        <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 overflow-x-auto shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white text-base mb-4">
            Team Skills Proficiency Matrix
          </h3>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Team Member</th>
                {allSkills.map((skill) => (
                  <th key={skill} className="py-3 px-4 text-center">
                    {skill}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {skillsMatrix.map((item: any) => (
                <tr key={item.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {item.name}
                  </td>
                  {item.skills?.map((sk: any) => (
                    <td key={sk.skill} className="py-3 px-4 text-center">
                      {sk.hasSkill ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800"></span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================== */}
      {/* Tab 3: Handoff Queues                                          */}
      {/* ============================================================== */}
      {activeSubTab === 'queues' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Editor Footage Ready */}
          <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Scissors className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Footage Ready Queue (Editor)
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600">
                {handoffQueues?.editor?.count || 0} Ready
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {handoffQueues?.editor?.tasks?.map((t: any) => (
                <div
                  key={t._id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-amber-600 dark:text-amber-400 font-mono">{t.taskId}</span>
                    <span className="text-slate-500">{t.assignee?.name || 'Unassigned'}</span>
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white">{t.title}</div>
                </div>
              ))}
              {(handoffQueues?.editor?.count || 0) === 0 && (
                <div className="text-xs text-slate-400 italic py-4 text-center">
                  No video items currently awaiting editing.
                </div>
              )}
            </div>
          </div>

          {/* Graphics Copy Ready */}
          <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Palette className="w-5 h-5 text-pink-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Copy Ready Queue (Graphics)
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-pink-500/10 text-pink-600">
                {handoffQueues?.graphics?.count || 0} Ready
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {handoffQueues?.graphics?.tasks?.map((t: any) => (
                <div
                  key={t._id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-pink-600 dark:text-pink-400 font-mono">{t.taskId}</span>
                    <span className="text-slate-500">{t.assignee?.name || 'Unassigned'}</span>
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white">{t.title}</div>
                </div>
              ))}
              {(handoffQueues?.graphics?.count || 0) === 0 && (
                <div className="text-xs text-slate-400 italic py-4 text-center">
                  No copy tasks awaiting graphics design.
                </div>
              )}
            </div>
          </div>

          {/* Cinematography Script Ready */}
          <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Camera className="w-5 h-5 text-violet-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Script Ready Queue (Cinematography)
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-violet-500/10 text-violet-600">
                {handoffQueues?.cinematography?.count || 0} Ready
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {handoffQueues?.cinematography?.tasks?.map((t: any) => (
                <div
                  key={t._id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-violet-600 dark:text-violet-400 font-mono">{t.taskId}</span>
                    <span className="text-slate-500">{t.assignee?.name || 'Unassigned'}</span>
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white">{t.title}</div>
                </div>
              ))}
              {(handoffQueues?.cinematography?.count || 0) === 0 && (
                <div className="text-xs text-slate-400 italic py-4 text-center">
                  No script items ready for shooting.
                </div>
              )}
            </div>
          </div>

          {/* Lead Review Queue */}
          <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Waiting for Review (Marketing Lead)
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-600">
                {handoffQueues?.lead?.count || 0} In Review
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {handoffQueues?.lead?.items?.map((item: any) => (
                <div
                  key={item._id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-blue-600 dark:text-blue-400 font-mono">{item.contentId}</span>
                    <span className="uppercase text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">
                      {item.format}
                    </span>
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white">{item.title}</div>
                </div>
              ))}
              {(handoffQueues?.lead?.count || 0) === 0 && (
                <div className="text-xs text-slate-400 italic py-4 text-center">
                  No deliverables waiting for final Lead review.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Tab 4: Leave Management                                        */}
      {/* ============================================================== */}
      {activeSubTab === 'leaves' && (
        <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Team Leave & Absence Requests
              </h3>
              <p className="text-xs text-slate-500">
                Approvals automatically update worker availability in pipeline assignment and capacity forecasting.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {leaveRequests.map((leave) => {
              const start = new Date(leave.startDate).toLocaleDateString();
              const end = new Date(leave.endDate).toLocaleDateString();

              return (
                <div
                  key={leave._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-xs">
                      {leave.userId?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        {leave.userId?.name}
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 capitalize font-medium">
                          {leave.type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {start} → {end} • Reason: "{leave.reason}"
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {leave.status === 'pending' ? (
                      <>
                        <button
                          onClick={() =>
                            reviewLeaveMutation.mutate({
                              id: leave._id,
                              status: 'approved',
                              reviewComment: 'Approved by lead',
                            })
                          }
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            reviewLeaveMutation.mutate({
                              id: leave._id,
                              status: 'rejected',
                              reviewComment: 'Coverage not available',
                            })
                          }
                          className="px-3.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 font-medium text-xs border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                          leave.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-rose-500/10 text-rose-600'
                        }`}
                      >
                        {leave.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {leaveRequests.length === 0 && (
              <div className="text-xs text-slate-400 italic py-8 text-center">
                No leave requests filed for this team.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Reassign Task Modal                                            */}
      {/* ============================================================== */}
      {reassignModalOpen && taskToReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Reassign Task: {taskToReassign.taskId}
              </h3>
              <button
                onClick={() => setReassignModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              {taskToReassign.title} ({taskToReassign.estimateHours || 2} hours)
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase text-slate-400">
                Select New Assignee
              </label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 dark:text-white"
              >
                <option value="">-- Choose Worker --</option>
                {members.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.plannedHours}/{m.capacity}h) {m.currentlyOnLeave ? '[ON LEAVE]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Worker Warning Alert */}
            {(() => {
              const target = members.find((m) => m._id === targetUserId);
              if (!target) return null;
              const willOverload =
                target.plannedHours + (taskToReassign.estimateHours || 2) > target.capacity;

              return (
                <div className="space-y-1.5 pt-1">
                  {target.currentlyOnLeave && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Warning: {target.name} is currently marked on leave.
                    </div>
                  )}
                  {willOverload && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Warning: Reassigning will put {target.name} into overload (
                      {Math.round(
                        ((target.plannedHours + (taskToReassign.estimateHours || 2)) / target.capacity) *
                          100
                      )}
                      % capacity).
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setReassignModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetUserId || reassignMutation.isPending}
                onClick={() => reassignMutation.mutate()}
                className="px-4 py-2 rounded-xl bg-[#0D0E12] dark:bg-white text-white dark:text-slate-950 font-medium text-xs hover:opacity-90 disabled:opacity-50"
              >
                {reassignMutation.isPending ? 'Reassigning...' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagementPage;
