import React from 'react';
import { X } from 'lucide-react';
import { PersonWorkHistoryView } from './PersonWorkHistoryView';

interface PersonWorkHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string | null;
}

export const PersonWorkHistoryDrawer: React.FC<PersonWorkHistoryDrawerProps> = ({
  isOpen,
  onClose,
  personId,
}) => {
  if (!isOpen || !personId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-2xl w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div className="w-full bg-slate-50/95 border-l border-white/80 shadow-2xl backdrop-blur-2xl pointer-events-auto flex flex-col h-full animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white/70 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Individual Work History</h2>
              <p className="text-xs text-slate-500 font-medium">Individual tracking, timings and step timeline</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <PersonWorkHistoryView personId={personId} />
          </div>
        </div>
      </div>
    </div>
  );
};

