import React, { useRef, useState } from 'react';
import { useDialogFocus } from '../../../lib/useDialogFocus';
import type { Editor } from '@tiptap/react';
import { Search, X } from 'lucide-react';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  editor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  // Keyboard: focus in on open, Escape closes, Tab stays inside, focus returns to the opener.
  const panelRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  // The hook focuses the search box (was `autoFocus`, which hid the opener from the hook).
  useDialogFocus(panelRef, Boolean(isOpen && editor), onClose, { initialFocusRef: findInputRef });

  if (!isOpen || !editor) return null;

  const handleFind = () => {
    if (!searchTerm) {
      setMatchCount(null);
      return;
    }

    const text = editor.getText();
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    setMatchCount(count);
  };

  const handleReplaceAll = () => {
    if (!searchTerm) return;
    const currentHtml = editor.getHTML();
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const newHtml = currentHtml.replace(regex, replaceTerm);
    editor.commands.setContent(newHtml);
    setMatchCount(0);
  };

  const handleReplaceSingle = () => {
    if (!searchTerm) return;
    const currentHtml = editor.getHTML();
    const flags = caseSensitive ? '' : 'i';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const newHtml = currentHtml.replace(regex, replaceTerm);
    editor.commands.setContent(newHtml);
    handleFind();
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby="ws-find-title"
      className="no-print fixed top-24 right-4 sm:right-8 z-50 glass-modal p-4 w-[calc(100vw-2rem)] sm:w-80 space-y-3"
    >
      <div className="flex items-center justify-between border-b border-ui-line pb-2">
        <h2 id="ws-find-title" className="flex items-center gap-1.5 text-sm font-semibold text-ui-ink">
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          Find & Replace
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" className="ui-icon-btn border-transparent">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Find Input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-medium text-ui-muted">
          <label htmlFor="ws-find-input">Find</label>
          {matchCount !== null && (
            <span role="status" className={matchCount > 0 ? 'text-ui-ink font-semibold' : 'status-chip status-changes px-2'}>
              {matchCount} match{matchCount !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        <div className="relative">
          <input
            id="ws-find-input"
            ref={findInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setMatchCount(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFind();
            }}
            placeholder="Search text..."
            className="ui-input w-full pr-12"
          />
          <button
            type="button"
            onClick={handleFind}
            className="absolute right-0 top-0 ui-icon-btn border-transparent bg-transparent"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Replace Input */}
      <div className="space-y-1">
        <label htmlFor="ws-replace-input" className="text-xs font-medium text-ui-muted">Replace with</label>
        <input
          id="ws-replace-input"
          type="text"
          value={replaceTerm}
          onChange={(e) => setReplaceTerm(e.target.value)}
          placeholder="Replace with..."
          className="ui-input w-full"
        />
      </div>

      {/* Case Sensitive Toggle */}
      <label className="flex items-center gap-2 min-h-[44px] text-xs font-medium text-ui-text cursor-pointer">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(e) => setCaseSensitive(e.target.checked)}
          className="w-4 h-4 accent-ui-ink"
        />
        Match case
      </label>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-ui-line">
        <button
          type="button"
          onClick={handleReplaceSingle}
          disabled={!searchTerm}
          className="ui-btn ui-btn-secondary h-11"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={handleReplaceAll}
          disabled={!searchTerm}
          className="ui-btn ui-btn-primary h-11"
        >
          Replace All
        </button>
      </div>
    </div>
  );
};
