import React from 'react';
import { BarChart3 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
          Reports & Performance Analytics
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Cross-department throughput, bottleneck diagnostics, and individual efficiency scorecards
        </p>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl text-center py-16">
        <BarChart3 className="w-14 h-14 text-blue-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white">Advanced Aggregations & Scorecards</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
          The aggregation engine across StatusHistory, TimeEntry, ContentItem, and Request models is scheduled for Phase 9, featuring Recharts and streaming Excel/PDF exports.
        </p>
      </div>
    </div>
  );
};
