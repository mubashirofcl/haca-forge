import React, { useState } from 'react';
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
    <div className="fixed top-24 right-8 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-80 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Search className="w-3.5 h-3.5 text-indigo-600" />
          Find & Replace
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Find Input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>FIND</span>
          {matchCount !== null && (
            <span className={matchCount > 0 ? 'text-indigo-600' : 'text-rose-500'}>
              {matchCount} match{matchCount !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        <div className="relative">
          <input
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
            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            autoFocus
          />
          <button
            onClick={handleFind}
            className="absolute right-1.5 top-1.5 text-slate-400 hover:text-indigo-600"
            title="Search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Replace Input */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-400">REPLACE WITH</span>
        <input
          type="text"
          value={replaceTerm}
          onChange={(e) => setReplaceTerm(e.target.value)}
          placeholder="Replace with..."
          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Case Sensitive Toggle */}
      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(e) => setCaseSensitive(e.target.checked)}
          className="rounded text-indigo-600"
        />
        Match case
      </label>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
        <button
          onClick={handleReplaceSingle}
          disabled={!searchTerm}
          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold"
        >
          Replace
        </button>
        <button
          onClick={handleReplaceAll}
          disabled={!searchTerm}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs"
        >
          Replace All
        </button>
      </div>
    </div>
  );
};
