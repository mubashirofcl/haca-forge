import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '../../../lib/useDialogFocus';

interface Props {
  isChecking: boolean;
  onCheck: (text: string) => void;
  onCancel: () => void;
}

/**
 * "Paste from Excel": a separate action. Rows pasted here go through the same check-then-save
 * preview as before. With the header row, columns are matched by name; without it, the columns
 * are read in the Excel template's order starting at Posting Date.
 */
export const PlanGridPasteDialog: React.FC<Props> = ({ isChecking, onCheck, onCancel }) => {
  const ref = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  useDialogFocus(ref, true, onCancel, { initialFocusRef: areaRef });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="plan-paste-title" className="glass-modal w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-ui-line">
          <div>
            <h2 id="plan-paste-title" className="text-lg font-bold text-ui-ink">Paste from Excel</h2>
            <p id="plan-paste-help" className="text-sm text-ui-muted mt-1">
              Copy the rows in your Excel sheet (include the header row if you can) and paste them below. You will see how each row is read before anything is saved.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="ui-icon-btn h-11 w-11" aria-label="Close paste">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">
          <label htmlFor="plan-paste-text" className="block text-xs font-semibold text-ui-text mb-1">Excel rows</label>
          <textarea
            ref={areaRef}
            id="plan-paste-text"
            aria-describedby="plan-paste-help"
            className="ui-input ui-textarea w-full min-h-[200px] font-mono text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 p-5 border-t border-ui-line">
          <button type="button" onClick={onCancel} className="ui-btn ui-btn-secondary h-11">Cancel</button>
          <button type="button" onClick={() => onCheck(text)} disabled={!text.trim() || isChecking} className="ui-btn ui-btn-primary h-11">
            {isChecking ? 'Checking…' : 'Check rows'}
          </button>
        </div>
      </div>
    </div>
  );
};
