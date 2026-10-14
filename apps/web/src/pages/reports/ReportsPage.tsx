import React from 'react';
import {
  TrendingUp,
  Download,
  Layers,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header and Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Department throughput, efficiency scores, and cross-team bottleneck diagnostics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-1 glass-pill-container flex items-center border border-white">
            <button className="px-3.5 py-1.5 text-xs font-semibold pill-active">
              Last 30 Days
            </button>
            <button className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
              Q3 2026
            </button>
            <button className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
              Year to Date
            </button>
          </div>

          <button
            onClick={() => alert('Streaming CSV/Excel/PDF export will be enabled in Phase 9!')}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-full shadow-xs flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Content Delivered', val: '142 units', sub: '+18% vs last month', color: 'text-[#7a6af6]' },
          { label: 'On-Time Delivery Rate', val: '96.4%', sub: 'Target: >95.0%', color: 'text-emerald-600' },
          { label: 'First-Pass Approval', val: '88.7%', sub: 'Target: >85.0%', color: 'text-blue-600' },
          { label: 'Avg Turnaround Time', val: '3.4 days', sub: '-0.8 days reduction', color: 'text-purple-600' },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="glass-panel p-5 rounded-[22px] border border-white shadow-glass"
          >
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {kpi.label}
            </span>
            <div className={`text-2xl sm:text-3xl font-extrabold ${kpi.color}`}>
              {kpi.val}
            </div>
            <span className="text-[10px] text-slate-500 font-medium block mt-1">
              {kpi.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Team Throughput & Efficiency Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#7a6af6]" />
              <span>Throughput by Production Team</span>
            </h3>
            <span className="text-xs text-slate-400">Total 142 items</span>
          </div>

          <div className="space-y-4 pt-2">
            {[
              { team: 'Graphics Team', delivered: 54, pct: 85, color: 'bg-[#7a6af6]' },
              { team: 'Editor Team', delivered: 42, pct: 72, color: 'bg-[#4f46e5]' },
              { team: 'Content / Scripts', delivered: 32, pct: 90, color: 'bg-emerald-500' },
              { team: 'Cinematography', delivered: 14, pct: 65, color: 'bg-amber-500' },
            ].map((t, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{t.team}</span>
                  <span className="font-bold">{t.delivered} completed</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${t.color} rounded-full transition-all duration-500`}
                    style={{ width: `${t.pct}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Department Utilization Share</span>
            </h3>
            <span className="text-xs text-slate-400">Hours Consumed</span>
          </div>

          <div className="space-y-4 pt-2">
            {[
              { dept: 'Performance (Ads)', hours: '380 hrs', share: 40, color: 'bg-blue-600' },
              { dept: 'Social Media', hours: '290 hrs', share: 30, color: 'bg-[#7a6af6]' },
              { dept: 'Sales', hours: '180 hrs', share: 20, color: 'bg-emerald-500' },
              { dept: 'Academics & Others', hours: '95 hrs', share: 10, color: 'bg-amber-500' },
            ].map((d, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{d.dept}</span>
                  <span className="font-bold">{d.hours}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${d.color} rounded-full transition-all duration-500`}
                    style={{ width: `${d.share}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
