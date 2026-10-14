import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Calendar,
  UserCheck,
  UserX,
  Upload,
  Play,
} from 'lucide-react';

export const WorkerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState(user?.attendance || 'present');

  const toggleAttendance = () => {
    const next = attendance === 'present' ? 'on_leave' : 'present';
    setAttendance(next);
  };

  const stats = [
    { label: "Today's Tasks", value: '2', sub: 'Assigned items due today', icon: CheckSquare },
    { label: 'Due This Week', value: '5', sub: 'Active pipeline tasks', icon: Calendar },
    { label: 'Logged Hours', value: '18.5h', sub: 'Weekly timesheet progress', icon: Clock },
    { label: 'Pending Revisions', value: '1', sub: 'Feedback awaiting updates', icon: AlertCircle },
  ];

  return (
    <div className="space-y-8">
      {/* Header and Attendance Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Production Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Welcome, {user?.name}. Production Team: <span className="capitalize text-[#7a6af6] font-bold">{user?.teamId || 'Creative Team'}</span>
          </p>
        </div>

        {/* Attendance Toggle Pill */}
        <div className="flex items-center gap-3 glass-pill-container p-1.5 border border-white">
          <span className="text-xs text-slate-500 pl-2 font-medium">Status:</span>
          <button
            onClick={toggleAttendance}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="glass-panel p-5 rounded-[22px] border border-white shadow-glass flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {s.label}
                </span>
                <div className="p-2 rounded-xl bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {s.value}
                </div>
                <div className="text-xs text-slate-400 mt-1">{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* My Active Tasks Queue */}
      <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
          <div>
            <h3 className="font-bold text-base text-slate-900">Active Task Queue</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tasks currently assigned to you for delivery</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-900 text-white">
            2 In Progress
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="glass-card p-5 border border-white shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#7a6af6] tracking-wider block">
                  Reel Production Stage
                </span>
                <h4 className="font-bold text-sm text-slate-900 mt-0.5">
                  Tech Visionaries - Video Cut 01
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                In Progress
              </span>
            </div>

            <p className="text-xs text-slate-600 line-clamp-2">
              Sync sound bytes from Saturday shoot day and apply intro motion graphics according to brand guide.
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 text-xs">
              <span className="text-slate-500 text-[11px] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Due Tomorrow, 5:00 PM
              </span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5">
                  <Play className="w-3 h-3 text-[#7a6af6]" />
                  <span>Start Timer</span>
                </button>
                <button className="px-3 py-1.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5">
                  <Upload className="w-3 h-3" />
                  <span>Upload Deliverable</span>
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 border border-white shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#7a6af6] tracking-wider block">
                  Graphics Creative
                </span>
                <h4 className="font-bold text-sm text-slate-900 mt-0.5">
                  Meta Ad Variants (A/B Test 02)
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Changes Requested
              </span>
            </div>

            <p className="text-xs text-slate-600 line-clamp-2">
              Reviewer note: Increase contrast on call-to-action text and export in 4:5 carousel portrait aspect ratio.
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 text-xs">
              <span className="text-slate-500 text-[11px] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Due Today, 7:00 PM
              </span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5">
                  <Play className="w-3 h-3 text-[#7a6af6]" />
                  <span>Start Timer</span>
                </button>
                <button className="px-3 py-1.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5">
                  <Upload className="w-3 h-3" />
                  <span>Submit v2</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
