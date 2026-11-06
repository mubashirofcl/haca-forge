import React, { useId, useRef } from 'react';
import { X } from 'lucide-react';
import { PersonWorkHistoryView } from './PersonWorkHistoryView';
import { useDialogFocus } from '../lib/useDialogFocus';

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
  const open = isOpen && Boolean(personId);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  // Focus moves to Close on open, Escape closes, Tab stays inside, focus returns on close.
  useDialogFocus(panelRef, open, onClose, { initialFocusRef: closeRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden ui-scrim backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-2xl w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="w-full ui-drawer rounded-l-ui-panel overflow-hidden pointer-events-auto flex flex-col h-full animate-in slide-in-from-right duration-300"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-ui-line flex items-center justify-between shrink-0">
            <div>
              <h2 id={titleId} className="text-base font-extrabold text-ui-text tracking-tight">
                Individual Work History
              </h2>
              <p className="text-xs text-ui-muted font-medium">Individual tracking, timings and step timeline</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ui-icon-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <PersonWorkHistoryView personId={personId!} />
          </div>
        </div>
      </div>
    </div>
  );
};
