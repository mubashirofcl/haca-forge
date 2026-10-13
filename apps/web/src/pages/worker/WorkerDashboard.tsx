import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  UserCheck,
  UserX,
} from 'lucide-react';

export const WorkerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState(user?.attendance || 'present');

  const toggleAttendance = () => {
    const next = attendance === 'present' ? 'on_leave' : 'present';
    setAttendance(next);
  };

  const stats = [
    { label: "Today's Tasks", value: '0', sub: 'Assigned items due today', icon: CheckSquare },
    { label: 'Due This Week', value: '0', sub: 'Active pipeline tasks', icon: Calendar },
    { label: 'Logged Hours', value: '0.0h', sub: 'Timesheet for current week', icon: Clock },
    { label: 'Pending Revisions', value: '0', sub: 'Feedback awaiting updates', icon: AlertCircle },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
            My Production Workspace
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Welcome, {user?.name}. Team: <span className="capitalize text-blue-400 font-semibold">{user?.teamId || 'Production Worker'}</span>
          </p>
        </div>

        {/* Attendance status toggle */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <span className="text-xs text-slate-400 pl-2">My Status:</span>
          <button
            onClick={toggleAttendance}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              attendance === 'present'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {s.label}
                </span>
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-blue-400">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {s.value}
                </div>
                <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Queue Placeholder */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl text-center py-12">
        <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">Your Task Queue is Clear</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          When requests are accepted and converted into content pipelines, assigned tasks will automatically appear here.
        </p>
      </div>
    </div>
  );
};
