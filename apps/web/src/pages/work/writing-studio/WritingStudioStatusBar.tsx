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
    <footer className="writing-studio-statusbar h-8 bg-slate-900 text-slate-300 text-[11px] font-medium px-4 flex items-center justify-between border-t border-slate-800 select-none z-30">
      {/* Left Metrics */}
      <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
        <span className="whitespace-nowrap">
          Page <strong className="text-white">{currentPage}</strong> of{' '}
          <strong className="text-white">{Math.max(1, pageCount)}</strong>
        </span>

        <span className="text-slate-600 hidden sm:inline">|</span>

        <span className="whitespace-nowrap">
          <strong className="text-white">{wordCount}</strong> Words
        </span>

        <span className="text-slate-600 hidden md:inline">|</span>

        <span className="hidden md:inline whitespace-nowrap">
          <strong className="text-white">{charCount}</strong> Chars ({charCountNoSpaces} no spaces)
        </span>

        {selectionCount > 0 && (
          <>
            <span className="text-slate-600">|</span>
            <span className="text-indigo-400 font-bold whitespace-nowrap">Selected: {selectionCount}</span>
          </>
        )}

        <span className="text-slate-600 hidden lg:inline">|</span>

        <span className="hidden lg:inline text-slate-400 capitalize whitespace-nowrap">
          Lang: {spellcheckLang === 'ml' ? 'Malayalam (മലയാളം)' : spellcheckLang}
        </span>
      </div>

      {/* Right Actions & Save Status */}
      <div className="flex items-center gap-3">
        {/* Autosave Status Indicator */}
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {saveStatus === 'saving' && (
            <span className="text-amber-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}

          {saveStatus === 'saved' && (
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <Check className="w-3 h-3 text-emerald-400" />
              Saved ✓ {lastSavedAt && formatTime(lastSavedAt)}
            </span>
          )}

          {saveStatus === 'offline_buffered' && (
            <span className="text-amber-300 flex items-center gap-1 font-semibold" title="Network offline. Changes buffered locally.">
              <CloudOff className="w-3 h-3 text-amber-400" />
              Buffered locally
            </span>
          )}

          {saveStatus === 'error' && (
            <span className="text-rose-400 flex items-center gap-1 font-semibold">
              Save failed (buffered)
            </span>
          )}
        </div>

        <span className="text-slate-700 hidden sm:inline">|</span>

        {/* Zoom Selector */}
        <div className="flex items-center gap-1">
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-bold cursor-pointer hover:bg-slate-700"
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
