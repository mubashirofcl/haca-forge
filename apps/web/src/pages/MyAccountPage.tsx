import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Mail,
  Briefcase,
  Building,
  Clock,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { WORK_PREFERENCES } from '@mmp/shared';

export const MyAccountPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Please sign in to view your account details.
      </div>
    );
  }

  const roleDisplay = user.role?.replace('_', ' ') || 'team_member';
  const userInitials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'US';

  const userPrefs = user.workPreferences || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-3xl border border-white/60 shadow-glass flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-slate-900 to-indigo-800 text-white font-black text-xl flex items-center justify-center ring-4 ring-white shadow-lg shrink-0">
            {userInitials}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{user.name}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 border border-purple-200/50">
                {roleDisplay}
              </span>
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
              <Mail className="w-4 h-4 text-slate-400" />
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-white/60 shadow-glass space-y-6">
        {/* Work Preferences Section (Phase 5b Content Flow) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white border border-indigo-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Content Flow Stage Preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Eligible stage assignments in ContentPiece pipelines (Phase 5b Content Flow)
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto text-xs font-bold px-3 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 shadow-xs">
              {userPrefs.length} Active Stage{userPrefs.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {WORK_PREFERENCES.map((pref) => {
              const isAssigned = userPrefs.includes(pref);
              return (
                <div
                  key={pref}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs transition-all ${
                    isAssigned
                      ? 'bg-white border-indigo-200 text-slate-900 font-bold shadow-xs'
                      : 'bg-slate-50/50 border-slate-200/50 text-slate-400 font-medium'
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 ${
                      isAssigned ? 'text-indigo-600' : 'text-slate-300'
                    }`}
                  />
                  <span>{pref}</span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-indigo-100/60">
            * These preferences determine candidate scoring and recommendation when stages unlock in Design and Reel pipelines. Configured by Marketing Head and Admin in People Setup.
          </p>
        </div>

        {/* Operational Attributes */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Operational Identity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white/60 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Assigned Job Role
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {user.jobRole || (user.role === 'admin' ? 'System Administrator' : 'Unspecified')}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white/60 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Department
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {user.department || 'All Departments'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white/60 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Weekly Capacity
                </span>
                <span className="text-sm font-bold text-purple-700">
                  {user.capacity || 40} hours / week
                </span>
              </div>
            </div>

            <div className="p-4 bg-white/60 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Brand Scoping
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {user.profileAccess && user.profileAccess.length > 0
                    ? `${user.profileAccess.length} profile(s) scoped`
                    : 'All 7 Brand Profiles'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
