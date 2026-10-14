import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Clock,
  CheckCircle2,
  Plus,
} from 'lucide-react';

export const RequesterDashboard: React.FC = () => {
  const { user } = useAuth();

  const statuses = [
    { label: 'Submitted / Triage', count: 1, icon: Clock, color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
    { label: 'In Production', count: 2, icon: FileText, color: 'bg-[#7a6af6]/10 text-[#7a6af6] border-[#7a6af6]/20' },
    { label: 'Awaiting Confirmation', count: 1, icon: CheckCircle2, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
    { label: 'Delivered / Live', count: 4, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Department Request Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Department: <span className="font-bold text-slate-900">{user?.department || 'Performance & Growth'}</span> &bull; Role: <span className="capitalize text-[#7a6af6] font-bold">{user?.role?.replace('_', ' ')}</span>
          </p>
        </div>

        <button
          onClick={() => alert('New Request submission form will be fully connected to master data in Phase 3!')}
          className="px-5 py-2.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold shadow-pill flex items-center gap-2 transition-transform hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>Raise New Request</span>
        </button>
      </div>

      {/* KPI Status Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statuses.map((st, i) => {
          const Icon = st.icon;
          return (
            <div
              key={i}
              className="glass-panel p-5 rounded-[22px] border border-white shadow-glass flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {st.label}
                </span>
                <div className={`p-2 rounded-xl border ${st.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {st.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Requests Timeline / List */}
      <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
          <div>
            <h3 className="font-bold text-base text-slate-900">Recent Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">Track deliverables moving through content pipelines</p>
          </div>
          <span className="text-xs font-bold text-slate-600">Showing 2 active</span>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 'MKT-2026-0012',
              title: 'Fall 2026 Product Announcement Video',
              type: 'Reel / Video',
              stage: 'Editing (Stage 3)',
              eta: '16 Oct 2026',
              status: 'In Production',
              statusColor: 'bg-blue-100 text-blue-700',
            },
            {
              id: 'MKT-2026-0011',
              title: 'Lead Generation Offer Carousel (Meta)',
              type: 'Carousel Ad',
              stage: 'Waiting for Final Requester Sign-off',
              eta: 'Today',
              status: 'Awaiting Confirmation',
              statusColor: 'bg-purple-100 text-purple-700',
            },
          ].map((req) => (
            <div
              key={req.id}
              className="glass-card p-4 border border-white/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] font-bold text-slate-400">{req.id}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {req.type}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">{req.title}</h4>
                <div className="text-xs text-slate-500 mt-1">
                  Current Pipeline Stage: <span className="font-semibold text-slate-700">{req.stage}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:self-center">
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${req.statusColor}`}>
                    {req.status}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">Est. Delivery: {req.eta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
