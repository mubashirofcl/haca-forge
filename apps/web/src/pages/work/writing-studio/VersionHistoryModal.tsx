import React, { useRef, useState } from 'react';
import { useDialogFocus } from '../../../lib/useDialogFocus';
import { History, X, RotateCcw, User } from 'lucide-react';

export interface SubmissionVersion {
  _id: string;
  version: number;
  submittedAt: string;
  submittedById?: { name: string; email?: string };
  notes?: string;
  document?: {
    json?: any;
    htmlSnapshot?: string;
    metadata?: any;
  };
  linkUrl?: string;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: SubmissionVersion[];
  onRestoreVersion: (version: SubmissionVersion) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  versions,
  onRestoreVersion,
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    versions[0]?._id || ''
  );
  // Modal keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  const currentSelected = versions.find((v) => v._id === selectedVersionId) || versions[0];

  return (
    <div className="fixed inset-0 ui-scrim flex items-center justify-center z-50 p-3 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-versions-title"
        className="glass-modal max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-ui-line">
          <div className="flex flex-wrap items-center gap-2 text-ui-ink">
            <History className="w-5 h-5" aria-hidden="true" />
            <h2 id="ws-versions-title" className="text-base font-bold">Version History</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70 text-ui-text">
              {versions.length} submission{versions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ui-icon-btn shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Split View (List on left 35%, Preview on right 65%) */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Version List */}
          <div className="w-full sm:w-1/3 max-h-48 sm:max-h-none border-b sm:border-b-0 sm:border-r border-ui-line overflow-y-auto p-3 space-y-2">
            {versions.length === 0 ? (
              <div className="text-center py-12 text-ui-muted text-xs">
                No formal submissions yet. Each submission will create a permanent version snapshot.
              </div>
            ) : (
              versions.map((ver) => (
                <button
                  type="button"
                  key={ver._id}
                  aria-pressed={currentSelected?._id === ver._id}
                  onClick={() => setSelectedVersionId(ver._id)}
                  className={`block w-full text-left p-3 rounded-2xl border transition-colors ${
                    (currentSelected?._id === ver._id)
                      ? 'bg-white border-ui-ink outline outline-1 outline-ui-ink'
                      : 'bg-white/60 border-ui-line hover:bg-white'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ui-ink">Submission v{ver.version}</span>
                    <span className="text-[11px] font-medium text-ui-muted">
                      {new Date(ver.submittedAt).toLocaleDateString()}
                    </span>
                  </span>
                  {ver.submittedById && (
                    <span className="flex items-center gap-1 text-[11px] text-ui-muted mt-1">
                      <User className="w-3 h-3" aria-hidden="true" />
                      <span>{ver.submittedById.name}</span>
                    </span>
                  )}
                  {ver.notes && (
                    <span className="block text-[11px] text-ui-text line-clamp-1 italic mt-1">"{ver.notes}"</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Version Preview */}
          <div className="flex-1 flex flex-col bg-ui-canvas-deep/40 overflow-hidden min-h-0">
            {currentSelected ? (
              <>
                <div className="px-4 sm:px-6 py-3 border-b border-ui-line bg-white/70 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-ui-ink">
                      Previewing Submission v{currentSelected.version}
                    </h3>
                    <p className="text-[11px] text-ui-muted">
                      Created on {new Date(currentSelected.submittedAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Restore Version ${currentSelected.version} into active editor? Current uncommitted changes will be replaced.`)) {
                        onRestoreVersion(currentSelected);
                        onClose();
                      }
                    }}
                    className="ui-btn ui-btn-primary h-11 gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    Restore this version
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center">
                  <div
                    className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-ui-line max-w-2xl w-full text-slate-900 ProseMirror"
                    dangerouslySetInnerHTML={{
                      __html:
                        currentSelected.document?.htmlSnapshot ||
                        `<p class="text-slate-400 italic">No HTML snapshot stored for this version.</p>`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ui-muted text-xs">
                Select a version from the left list to preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
