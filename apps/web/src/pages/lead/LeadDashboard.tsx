import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Inbox,
  AlertTriangle,
  FileCheck,
  Users,
  Video,
} from 'lucide-react';

export const LeadDashboard: React.FC = () => {
  const { user } = useAuth();

  const widgets = [
    {
      label: 'Awaiting Triage',
      count: '0',
      description: 'Incoming department requests ready for triage',
      icon: Inbox,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Waiting for Review',
      count: '0',
      description: 'Deliverables submitted by workers with pending feedback',
      icon: FileCheck,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Blocked / On Hold',
      count: '0',
      description: 'Pipeline tasks marked with impediment reason codes',
      icon: AlertTriangle,
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
    },
    {
      label: 'Active Pipelines',
      count: '0',
      description: 'Content deliverables moving across production teams',
      icon: Video,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
          Marketing Operations Dashboard
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Welcome back, {user?.name}. Overseeing request triage, cross-team handoffs, and deliverable approvals.
        </p>
      </div>

      {/* Widget grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {widgets.map((w, idx) => {
          const Icon = w.icon;
          return (
            <div
              key={idx}
              className={`p-6 rounded-2xl bg-slate-900/80 border backdrop-blur-md shadow-xl flex flex-col justify-between ${w.color}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {w.label}
                </span>
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {w.count}
                </div>
                <div className="text-xs text-slate-400 mt-1">{w.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Production Teams Status */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <span>Production Team Capacity Overview</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { name: 'Content', role: 'Scripts, Captions & Ad Copy', count: '40h default' },
            { name: 'Graphics', role: 'Posters, Carousels & Creatives', count: '40h default' },
            { name: 'Cinematography', role: 'Shoots & Footage Logging', count: '40h default' },
            { name: 'Editor', role: 'Reels, Cuts & Final Exports', count: '40h default' },
          ].map((t, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-sm">{t.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {t.count}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{t.role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
