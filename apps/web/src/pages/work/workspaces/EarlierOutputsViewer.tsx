import React, { useState } from 'react';
import {
  Layers,
  FileText,
  Video,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Check,
  Download,
  Eye,
} from 'lucide-react';

export interface StageOutput {
  id: string;
  stageKey?: string;
  stageName?: string;
  workerName: string;
  status?: string;
  completedAt?: string;
  updatedAt?: string;
  fileUrl?: string;
  contentUrl?: string;
  textContent?: string;
  metadata?: Record<string, any>;
}

interface EarlierOutputsViewerProps {
  outputs: StageOutput[];
  currentStageKey?: string;
  currentStageTitle?: string;
}

export const EarlierOutputsViewer: React.FC<EarlierOutputsViewerProps> = ({
  outputs,
  currentStageKey,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStageIcon = (key?: string) => {
    const lower = (key || '').toLowerCase();
    if (lower.includes('content') || lower.includes('script')) {
      return <FileText className="w-4 h-4 text-indigo-400" />;
    }
    if (lower.includes('shoot') || lower.includes('edit')) {
      return <Video className="w-4 h-4 text-violet-400" />;
    }
    if (lower.includes('design')) {
      return <ImageIcon className="w-4 h-4 text-pink-400" />;
    }
    return <Layers className="w-4 h-4 text-emerald-400" />;
  };

  if (outputs.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-white/60 backdrop-blur-md border border-slate-200/80 text-center text-xs text-slate-500 shadow-xs">
        <Layers className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
        <p className="font-medium">No earlier stage deliverables have been completed yet for this piece.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-indigo-600" />
          Earlier Outputs (Read-Only)
        </h3>
        <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-full">
          {outputs.length} deliverable{outputs.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {outputs.map((out) => {
          const isCurrent = out.stageKey === currentStageKey;
          return (
            <div
              key={out.id}
              className={`p-4 rounded-2xl border transition-all ${
                isCurrent
                  ? 'bg-indigo-50/50 border-indigo-200 shadow-xs'
                  : 'bg-white/80 backdrop-blur-sm border-slate-200/80 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center">
                    {getStageIcon(out.stageKey)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{out.stageKey} Stage</h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      by {out.workerName} &bull; {out.status}
                    </span>
                  </div>
                </div>

                {out.completedAt && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(out.completedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Text Output preview */}
              {out.textContent && (
                <div className="mt-2.5 relative p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 max-h-48 overflow-y-auto">
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                    {out.textContent}
                  </p>
                  <button
                    onClick={() => handleCopy(out.id, out.textContent!)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-600 shadow-2xs border border-slate-200/60 transition-colors"
                    title="Copy output text"
                  >
                    {copiedId === out.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}

              {/* File / Link previews */}
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                {out.fileUrl && (
                  <a
                    href={out.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200/60 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    Download File
                  </a>
                )}
                {out.contentUrl && (
                  <a
                    href={out.contentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Deliverable Link
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
