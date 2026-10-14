import React from 'react';
import {
  Inbox,
  AlertTriangle,
  FileCheck,
  Users,
  Video,
} from 'lucide-react';
import { CasesOverview } from '../../components/CasesOverview';

export const LeadDashboard: React.FC = () => {

  const widgets = [
    {
      label: 'Awaiting Triage',
      count: '2',
      description: 'Department requests ready for acceptance & conversion',
      icon: Inbox,
      color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    },
    {
      label: 'Waiting for Review',
      count: '1',
      description: 'Deliverables with timestamped feedback pending',
      icon: FileCheck,
      color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    },
    {
      label: 'Blocked / On Hold',
      count: '0',
      description: 'Pipeline tasks flagged with hold reason codes',
      icon: AlertTriangle,
      color: 'bg-rose-500/10 text-rose-600 border-rose-200',
    },
    {
      label: 'Active Pipelines',
      count: '5',
      description: 'Content units moving across production teams',
      icon: Video,
      color: 'bg-[#7a6af6]/10 text-[#7a6af6] border-[#7a6af6]/20',
    },
  ];

  return (
    <div className="space-y-10">
      {/* Lead Operational Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {widgets.map((w, idx) => {
          const Icon = w.icon;
          return (
            <div
              key={idx}
              className="glass-panel p-5 rounded-[22px] border border-white shadow-glass flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {w.label}
                </span>
                <div className={`p-2 rounded-xl border ${w.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {w.count}
                </div>
                <div className="text-xs text-slate-500 mt-1">{w.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Production Team Capacity Grid */}
      <div className="glass-panel p-6 rounded-[24px] border border-white shadow-glass">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#7a6af6]" />
          <span>Production Team Weekly Capacity & Allocations</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { name: 'Content', role: 'Scripts, Captions & Copy', capacity: '40h / week', active: '2 tasks' },
            { name: 'Graphics', role: 'Posters & Carousels', capacity: '40h / week', active: '1 task' },
            { name: 'Cinematography', role: 'Shoots & Video Footage', capacity: '40h / week', active: '1 task' },
            { name: 'Editor', role: 'Cuts, Reels & Motion Exports', capacity: '40h / week', active: '1 task' },
          ].map((t, i) => (
            <div
              key={i}
              className="glass-card p-4 border border-white/90 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">{t.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {t.capacity}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{t.role}</p>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-400">
                <span>Active Workload:</span>
                <span className="font-semibold text-slate-700">{t.active}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cases Overview Component */}
      <CasesOverview />
    </div>
  );
};
