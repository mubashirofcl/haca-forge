import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Mail,
  Briefcase,
  Building,
  Clock,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { WORK_PREFERENCES } from '@mmp/shared';

interface MyAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyAccountModal: React.FC<MyAccountModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  if (!isOpen || !user) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-modal max-w-xl w-full p-6 sm:p-8 rounded-3xl border border-white shadow-modal-glass relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-800 text-white font-black text-sm flex items-center justify-center ring-4 ring-white shadow-md">
              {userInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{user.name}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 border border-purple-200/50">
                  {roleDisplay}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-5">
          {/* Work Preferences Spotlight (Phase 5b Content Flow) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white border border-indigo-100/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Content Flow Stage Preferences
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Assigned stage competencies for content piece pipelines
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700">
                {userPrefs.length} Active
              </span>
            </div>

            {/* Badges Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {WORK_PREFERENCES.map((pref) => {
                const isAssigned = userPrefs.includes(pref);
                return (
                  <div
                    key={pref}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs transition-all ${
                      isAssigned
                        ? 'bg-white border-indigo-200 text-slate-900 font-bold shadow-xs'
                        : 'bg-slate-50/50 border-slate-200/50 text-slate-400 font-medium'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isAssigned ? 'text-indigo-600' : 'text-slate-300'
                      }`}
                    />
                    <span className="truncate">{pref}</span>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-400 mt-2.5">
              * Stage competencies are configured by the Marketing Head or Administrator in People Setup.
            </p>
          </div>

          {/* Operational Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Job Role */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Job Title
              </span>
              <p className="font-semibold text-slate-800 text-xs">
                {user.jobRole || (user.role === 'admin' ? 'System Administrator' : 'Not configured')}
              </p>
            </div>

            {/* Department */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Department
              </span>
              <p className="font-semibold text-slate-800 text-xs">
                {user.department || 'All Departments'}
              </p>
            </div>

            {/* Capacity */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Weekly Capacity
              </span>
              <p className="font-semibold text-purple-700 text-xs">
                {user.capacity || 40} hours / week
              </p>
            </div>

            {/* Brand Access */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Brand Scoping
              </span>
              <p className="font-semibold text-slate-800 text-xs">
                {user.profileAccess && user.profileAccess.length > 0
                  ? `${user.profileAccess.length} profile(s) scoped`
                  : 'All 7 Brand Profiles'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
