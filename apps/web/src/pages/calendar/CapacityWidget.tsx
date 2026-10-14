import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface CapacityWidgetProps {
  from?: string;
  to?: string;
}

const TEAM_DISPLAY_NAMES: Record<string, string> = {
  content: 'Content & Copy',
  graphics: 'Graphics & Design',
  cinematography: 'Cinematography & Shoots',
  editor: 'Video Editing & Motion',
};

export const CapacityWidget: React.FC<CapacityWidgetProps> = ({ from, to }) => {
  const { data: capacityResponse, isLoading } = useQuery({
    queryKey: ['teamCapacity', from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/calendar/capacity?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load team capacity');
      return res.json();
    },
  });

  const teams = capacityResponse?.data?.teams || [];
  const totalDemand = capacityResponse?.data?.totalDemandHours || 0;

  if (isLoading) {
    return (
      <div className="p-4 rounded-2xl glass-panel border border-white/80 animate-pulse text-xs text-slate-400">
        Calculating weekly team bandwidth and leave deductions...
      </div>
    );
  }

  return (
    <div className="p-4 rounded-[24px] glass-panel border border-white/80 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#7a6af6]/10 text-[#7a6af6] flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900">Production Team Bandwidth</h4>
            <p className="text-[10px] text-slate-500">Live demand vs available worker capacity (factoring in leave)</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Demand</span>
          <span className="text-xs font-black text-[#7a6af6]">{totalDemand} hrs</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {teams.map((t: any) => {
          const isOverloaded = t.status === 'overloaded';
          const isWarning = t.status === 'warning';

          return (
            <div
              key={t.team}
              className={`p-3 rounded-2xl border transition-all ${
                isOverloaded
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : isWarning
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-white/80 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs truncate">
                  {TEAM_DISPLAY_NAMES[t.team] || t.team}
                </span>
                {isOverloaded ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-600 text-white flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>OVER</span>
                  </span>
                ) : isWarning ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-white flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span>NEAR</span>
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                    <CheckCircle className="w-2.5 h-2.5" />
                    <span>OK</span>
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverloaded
                      ? 'bg-rose-500'
                      : isWarning
                      ? 'bg-amber-500'
                      : 'bg-[#7a6af6]'
                  }`}
                  style={{ width: `${Math.min(t.utilizationPct, 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>
                  <strong>{t.demandHours}h</strong> / {t.availableCapacity}h
                </span>
                <span className="font-bold">{t.utilizationPct}% cap</span>
              </div>

              {t.onLeaveMembers > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-200/40 text-[9px] text-slate-400 flex items-center justify-between">
                  <span>{t.onLeaveMembers} on leave</span>
                  <span>{t.activeMembers} active</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
