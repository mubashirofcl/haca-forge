import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Clock,
  CheckCircle2,
  PlusCircle,
  FolderOpen,
} from 'lucide-react';

export const RequesterDashboard: React.FC = () => {
  const { user } = useAuth();

  const statuses = [
    { label: 'Submitted / Triage', count: 0, icon: Clock, color: 'text-amber-400 bg-amber-500/10' },
    { label: 'In Production', count: 0, icon: FileText, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Awaiting My Confirmation', count: 0, icon: CheckCircle2, color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Completed Deliveries', count: 0, icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
            Department Request Portal
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Department: <span className="font-semibold text-slate-200">{user?.department || 'General Marketing'}</span> &bull; Logged as: <span className="capitalize text-blue-400 font-semibold">{user?.role?.replace('_', ' ')}</span>
          </p>
        </div>

        <button
          onClick={() => alert('New Request wizard will be fully interactive in Phase 3!')}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Raise New Request</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statuses.map((st, i) => {
          const Icon = st.icon;
          return (
            <div
              key={i}
              className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {st.label}
                </span>
                <div className={`p-2 rounded-xl border border-slate-800 ${st.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {st.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State / Intake Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl text-center">
        <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-200">No requests raised yet</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
          Submit creative, social media, ads, or sales collaterals to begin production tracking.
        </p>
        <button
          onClick={() => alert('New Request intake will be enabled in Phase 3!')}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-2 border border-slate-700/80"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Submit First Request</span>
        </button>
      </div>
    </div>
  );
};
