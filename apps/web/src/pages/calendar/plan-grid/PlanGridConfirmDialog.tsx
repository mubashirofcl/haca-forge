import React, { useRef } from 'react';
import { useDialogFocus } from '../../../lib/useDialogFocus';

interface Props {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small confirmation dialog (whole-plan approval, row delete). Focus moves in and returns on close. */
export const PlanGridConfirmDialog: React.FC<Props> = ({ title, message, confirmLabel, isBusy, onConfirm, onCancel }) => {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(ref, true, onCancel, { initialFocusRef: cancelRef });
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 ui-scrim">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="plan-grid-confirm-title"
        aria-describedby="plan-grid-confirm-body"
        className="glass-modal w-full max-w-md p-5 space-y-4"
      >
        <h2 id="plan-grid-confirm-title" className="text-base font-bold text-ui-ink">{title}</h2>
        <div id="plan-grid-confirm-body" className="text-sm text-ui-text">{message}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="ui-btn ui-btn-secondary h-11">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={isBusy} className="ui-btn ui-btn-primary h-11">
            {isBusy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
