import React from 'react';
import { Sparkles, Calendar, Layers, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  screenNumber?: string;
  phase: string;
  route: string;
  description: string;
  features?: string[];
  icon?: React.ElementType;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  screenNumber,
  phase,
  route,
  description,
  features = [],
  icon: Icon = Layers,
}) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6">
      {/* Header Banner */}
      <div className="glass-panel p-8 relative overflow-hidden border border-white/40 shadow-glass rounded-2xl bg-gradient-to-br from-white/80 via-white/40 to-white/10 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-bl from-purple-500/20 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200 shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                {screenNumber ? `${screenNumber} • Built in ${phase}` : `Built in ${phase}`}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                {route}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md shadow-purple-500/20">
                <Icon className="w-6 h-6" />
              </div>
              {title}
            </h1>

            <p className="text-slate-600 text-base max-w-2xl leading-relaxed">
              {description}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <div className="p-4 rounded-xl bg-white/70 border border-white/60 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                Target Milestone
              </div>
              <div className="text-sm font-bold text-slate-800">
                HACA Marketing OS {phase}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-white/60 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Architecture
              </div>
              <div className="text-sm font-bold text-slate-800">
                Query-Level Scoped (resolveScope)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Specification Preview */}
      {features.length > 0 && (
        <div className="glass-panel p-6 border border-white/30 rounded-2xl bg-white/50 backdrop-blur-md shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-500" />
            Specification Capabilities Delivered in {phase}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white/60 border border-white/40 shadow-xs flex items-start gap-3 hover:bg-white/80 transition-all duration-200"
              >
                <div className="w-6 h-6 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                  <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-700 leading-snug">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
