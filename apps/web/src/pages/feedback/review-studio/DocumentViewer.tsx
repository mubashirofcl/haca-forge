import React, { useState, useEffect } from 'react';
import { computeWordDiff, type DiffPart } from '../../../lib/diffUtils';
import { Eye, MessageSquare } from 'lucide-react';

export interface DocumentCommentAnchor {
  text: string;
}

export interface DocumentViewerProps {
  content?: string;
  currentHtml?: string;
  previousHtml?: string;
  diffBaseContent?: string;
  version?: number;
  versionNumber?: number;
  previousVersion?: number;
  title?: string;
  comments?: any[];
  activeCommentId?: string | null;
  onSelectComment?: (commentId: string | null) => void;
  onAddTextComment?: (anchor: DocumentCommentAnchor, text: string) => void;
  onAddCommentOnSelection?: (selectionText: string) => void;
  isDiffMode?: boolean;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  content,
  currentHtml,
  previousHtml,
  diffBaseContent,
  version = 1,
  versionNumber,
  previousVersion,
  title,
  comments: _comments = [],
  activeCommentId: _activeCommentId,
  onSelectComment: _onSelectComment,
  onAddTextComment,
  onAddCommentOnSelection,
  isDiffMode: externalDiffMode,
}) => {
  const activeContent = content || currentHtml || '';
  const activePrevious = diffBaseContent || previousHtml || '';
  const activeVersion = versionNumber || version;

  const [internalDiffMode, setInternalDiffMode] = useState(false);
  const diffMode = externalDiffMode !== undefined ? externalDiffMode : internalDiffMode;

  const [diffParts, setDiffParts] = useState<DiffPart[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [showInputBox, setShowInputBox] = useState(false);

  useEffect(() => {
    if (diffMode && activePrevious) {
      const parts = computeWordDiff(activePrevious, activeContent);
      setDiffParts(parts);
    }
  }, [diffMode, activePrevious, activeContent]);

  const handleMouseUp = () => {
    if (!onAddTextComment && !onAddCommentOnSelection) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const text = sel.toString().trim();
      setSelectedText(text);
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionCoords({
        x: rect.left + rect.width / 2,
        y: rect.top - 40,
      });
      setShowInputBox(true);
    } else {
      if (!commentInput) {
        setSelectedText('');
        setSelectionCoords(null);
        setShowInputBox(false);
      }
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedText || !commentInput.trim()) return;

    if (onAddTextComment) {
      onAddTextComment({ text: selectedText }, commentInput.trim());
    } else if (onAddCommentOnSelection) {
      onAddCommentOnSelection(commentInput.trim());
    }

    setShowInputBox(false);
    setSelectedText('');
    setCommentInput('');
    setSelectionCoords(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950/80 rounded-xl overflow-hidden border border-white/10 relative" onMouseUp={handleMouseUp}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-white/10 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            {title ? title : `Document Viewer`}
          </span>
          {activeVersion !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-white/10">
              Version {activeVersion}
            </span>
          )}
          {diffMode && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              Diff Compare Mode
            </span>
          )}
          {previousVersion && (
            <span className="text-[11px] font-mono text-slate-500">
              Comparing vs v{previousVersion}
            </span>
          )}
        </div>

        {activePrevious && externalDiffMode === undefined && (
          <button
            onClick={() => setInternalDiffMode(!internalDiffMode)}
            className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all ${
              diffMode ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/15'
            }`}
          >
            {diffMode ? 'Diff Active' : 'Compare vs Previous'}
          </button>
        )}
      </div>

      {/* Floating Tooltip to attach comment */}
      {showInputBox && selectionCoords && (
        <div
          style={{
            position: 'fixed',
            left: `${selectionCoords.x}px`,
            top: `${selectionCoords.y}px`,
            transform: 'translateX(-50%)',
          }}
          className="z-50 bg-slate-900/95 backdrop-blur-md border border-white/20 shadow-2xl rounded-xl p-2.5 w-72"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1.5 text-slate-300 text-[11px]">
            <span className="font-semibold flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-slate-300" aria-hidden="true" />
              Comment on selection
            </span>
            <button
              onClick={() => {
                setShowInputBox(false);
                setSelectedText('');
              }}
              type="button"
              aria-label="Close"
              className="min-w-[44px] min-h-[44px] -m-3 flex items-center justify-center text-slate-300 hover:text-white rounded-full"
            >
              &times;
            </button>
          </div>
          <div className="text-[11px] text-slate-300 italic mb-2 truncate max-w-full">
            "{selectedText}"
          </div>
          <form onSubmit={handleAddComment} className="flex flex-col gap-2">
            <textarea
              autoFocus
              rows={2}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Leave feedback on this text..."
              className="w-full text-xs p-2 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-white/60"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="min-h-[44px] px-3 text-xs font-semibold rounded-lg bg-white hover:bg-neutral-200 text-neutral-950 disabled:opacity-40"
              >
                Add Comment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Document Body (A4 Style Canvas) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
        <div className="max-w-3xl w-full bg-slate-900/90 text-slate-100 p-8 sm:p-12 rounded-2xl shadow-2xl border border-white/10 min-h-full leading-relaxed">
          {diffMode && diffParts.length > 0 ? (
            <div className="whitespace-pre-wrap text-sm font-sans space-y-1">
              {diffParts.map((part, index) => {
                if (part.type === 'added') {
                  return (
                    <span
                      key={index}
                      className="bg-emerald-500/20 text-emerald-300 font-medium px-1 rounded mx-0.5 border border-emerald-500/30"
                      title="Added in this version"
                    >
                      {part.value}
                    </span>
                  );
                }
                if (part.type === 'removed') {
                  return (
                    <span
                      key={index}
                      className="bg-rose-500/20 text-rose-300 line-through px-1 rounded mx-0.5 border border-rose-500/30 opacity-70"
                      title="Removed from previous version"
                    >
                      {part.value}
                    </span>
                  );
                }
                return <span key={index}>{part.value}</span>;
              })}
            </div>
          ) : activeContent.startsWith('<') ? (
            <div
              className="prose prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: activeContent }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-slate-200">
              {activeContent || 'No document content available.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
