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
      return <FileText className="w-4 h-4 text-ui-ink" />;
    }
    if (lower.includes('shoot') || lower.includes('edit')) {
      return <Video className="w-4 h-4 text-ui-ink" />;
    }
    if (lower.includes('design')) {
      return <ImageIcon className="w-4 h-4 text-ui-ink" />;
    }
    return <Layers className="w-4 h-4 text-emerald-800" />;
  };

  if (outputs.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-white/60 border border-ui-line text-center text-xs text-ui-muted shadow-xs">
        <Layers className="w-8 h-8 mx-auto mb-2 text-ui-muted opacity-60" />
        <p className="font-medium">No earlier stage deliverables have been completed yet for this piece.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-ui-ink flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-ui-ink" />
          Earlier Outputs (Read-Only)
        </h3>
        <span className="text-[11px] text-ui-muted font-mono bg-white/60 px-2 py-0.5 rounded-full">
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
                  ? 'bg-white border-ui-ink shadow-xs'
                  : 'bg-white/80 border-ui-line hover:border-ui-line shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/60 border border-ui-line flex items-center justify-center">
                    {getStageIcon(out.stageKey)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-ui-ink">{out.stageKey} Stage</h4>
                    <span className="text-[11px] text-ui-muted font-medium">
                      by {out.workerName} &bull; {out.status}
                    </span>
                  </div>
                </div>

                {out.completedAt && (
                  <span className="text-[11px] text-ui-muted font-mono">
                    {new Date(out.completedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Text Output preview */}
              {out.textContent && (
                <div className="mt-2.5 relative p-3 rounded-xl bg-white/60 border border-ui-line max-h-48 overflow-y-auto">
                  <p className="text-xs text-ui-text whitespace-pre-wrap leading-relaxed font-sans">
                    {out.textContent}
                  </p>
                  <button
                    onClick={() => handleCopy(out.id, out.textContent!)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 hover:bg-white text-ui-muted shadow-2xs border border-ui-line transition-colors"
                    title="Copy output text"
                  >
                    {copiedId === out.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-800" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}

              {/* File / Link previews */}
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-ui-line">
                {out.fileUrl && (
                  <a
                    href={out.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 hover:bg-white text-ui-text text-xs font-semibold border border-ui-line transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-ui-ink" />
                    Download File
                  </a>
                )}
                {out.contentUrl && (
                  <a
                    href={out.contentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-white text-ui-ink text-xs font-semibold border border-ui-ink transition-colors"
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
