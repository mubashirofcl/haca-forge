import React from 'react';
import { Check, CloudOff, RefreshCw } from 'lucide-react';

interface WritingStudioStatusBarProps {
  pageCount: number;
  currentPage: number;
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  selectionCount: number;
  zoom: number;
  setZoom: (zoom: number) => void;
  saveStatus: 'saved' | 'saving' | 'offline_buffered' | 'error';
  lastSavedAt: Date | null;
  spellcheckLang: string;
}

export const WritingStudioStatusBar: React.FC<WritingStudioStatusBarProps> = ({
  pageCount,
  currentPage,
  wordCount,
  charCount,
  charCountNoSpaces,
  selectionCount,
  zoom,
  setZoom,
  saveStatus,
  lastSavedAt,
  spellcheckLang,
}) => {
  const formatTime = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <footer className="writing-studio-statusbar min-h-[48px] bg-ui-card text-ui-muted text-[11px] font-medium px-4 py-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-ui-line select-none z-30">
      {/* Left Metrics */}
      <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
        <span className="whitespace-nowrap">
          Page <strong className="text-ui-ink">{currentPage}</strong> of{' '}
          <strong className="text-ui-ink">{Math.max(1, pageCount)}</strong>
        </span>

        <span className="text-ui-line hidden sm:inline" aria-hidden="true">|</span>

        <span className="whitespace-nowrap">
          <strong className="text-ui-ink">{wordCount}</strong> Words
        </span>

        <span className="text-ui-line hidden md:inline" aria-hidden="true">|</span>

        <span className="hidden md:inline whitespace-nowrap">
          <strong className="text-ui-ink">{charCount}</strong> Chars ({charCountNoSpaces} no spaces)
        </span>

        {selectionCount > 0 && (
          <>
            <span className="text-ui-line" aria-hidden="true">|</span>
            <span className="text-ui-ink font-semibold whitespace-nowrap">Selected: {selectionCount}</span>
          </>
        )}

        <span className="text-ui-line hidden lg:inline" aria-hidden="true">|</span>

        <span className="hidden lg:inline text-ui-muted capitalize whitespace-nowrap">
          Lang: {spellcheckLang === 'ml' ? 'Malayalam (മലയാളം)' : spellcheckLang}
        </span>
      </div>

      {/* Right Actions & Save Status */}
      <div className="flex items-center gap-3">
        {/* Autosave Status Indicator */}
        <div className="flex items-center gap-1.5 whitespace-nowrap" role="status" aria-live="polite">
          {saveStatus === 'saving' && (
            <span className="text-ui-text flex items-center gap-1">
              <RefreshCw className="w-3 h-3 motion-safe:animate-spin" aria-hidden="true" />
              Saving...
            </span>
          )}

          {saveStatus === 'saved' && (
            <span className="status-chip status-approved px-2 py-0.5 gap-1 font-semibold">
              <Check className="w-3 h-3" aria-hidden="true" />
              Saved ✓ {lastSavedAt && formatTime(lastSavedAt)}
            </span>
          )}

          {saveStatus === 'offline_buffered' && (
            <span className="status-chip status-waiting px-2 py-0.5 gap-1 font-semibold" title="Network offline. Changes buffered locally.">
              <CloudOff className="w-3 h-3" aria-hidden="true" />
              Buffered locally
            </span>
          )}

          {saveStatus === 'error' && (
            <span className="status-chip status-changes px-2 py-0.5 gap-1 font-semibold">
              Save failed (buffered)
            </span>
          )}
        </div>

        <span className="text-ui-line hidden sm:inline" aria-hidden="true">|</span>

        {/* Zoom Selector */}
        <div className="flex items-center gap-1">
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="ui-select text-xs"
          >
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
          </select>
        </div>
      </div>
    </footer>
  );
};
