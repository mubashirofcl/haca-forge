import React, { useState } from 'react';
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

  if (!isOpen) return null;

  const currentSelected = versions.find((v) => v._id === selectedVersionId) || versions[0];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full h-[80vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-900">
            <History className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-extrabold">Version History</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {versions.length} submission{versions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Split View (List on left 35%, Preview on right 65%) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version List */}
          <div className="w-1/3 border-r border-slate-200 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
            {versions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No formal submissions yet. Each submission will create a permanent version snapshot.
              </div>
            ) : (
              versions.map((ver) => (
                <div
                  key={ver._id}
                  onClick={() => setSelectedVersionId(ver._id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    (currentSelected?._id === ver._id)
                      ? 'bg-white border-indigo-500 shadow-xs ring-2 ring-indigo-500/10'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">Submission v{ver.version}</span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {new Date(ver.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {ver.submittedById && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{ver.submittedById.name}</span>
                    </div>
                  )}
                  {ver.notes && (
                    <p className="text-[11px] text-slate-600 line-clamp-1 italic mt-1">"{ver.notes}"</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Version Preview */}
          <div className="flex-1 flex flex-col bg-slate-100/60 overflow-hidden">
            {currentSelected ? (
              <>
                <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900">
                      Previewing Submission v{currentSelected.version}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Created on {new Date(currentSelected.submittedAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Restore Version ${currentSelected.version} into active editor? Current uncommitted changes will be replaced.`)) {
                        onRestoreVersion(currentSelected);
                        onClose();
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore this version
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex justify-center">
                  <div
                    className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl w-full text-slate-900 ProseMirror"
                    dangerouslySetInnerHTML={{
                      __html:
                        currentSelected.document?.htmlSnapshot ||
                        `<p class="text-slate-400 italic">No HTML snapshot stored for this version.</p>`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                Select a version from the left list to preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
