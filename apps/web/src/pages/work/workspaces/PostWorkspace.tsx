import React, { useState, useRef } from 'react';
import {
  Download,
  CheckSquare,
  Square,
  Globe,
  AlertCircle,
  CheckCircle,
  Upload,
  ExternalLink,
  RefreshCw,
  Link as LinkIcon,
} from 'lucide-react';
import { ResumableUploadTask } from '../../../lib/uploadManager';
import { AssetLinks, AssetItem } from '../../../components/AssetLinks';
import { DriveLinkInput, driveLinkError } from '../../../components/DriveLinkInput';
import { LIVE_URL_ERROR, isLivePostUrl } from '@mmp/shared';

interface PostWorkspaceProps {
  workItem: {
    id: string;
    title: string;
    stageKey?: string;
    status?: string;
    channel?: string;
    deliverableUrl?: string;
    publishedUrl?: string;
  };
  /** The approved final cut or design files handed over from the Edit or Design step. */
  finalAssets?: AssetItem[];
  onMarkAsPosted: (data: {
    publishedUrl: string;
    publishedAt: string;
    deliverableUrl?: string;
    notes?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
  isPosting?: boolean;
}

export const PostWorkspace: React.FC<PostWorkspaceProps> = ({
  workItem,
  finalAssets = [],
  onMarkAsPosted,
  isSubmitting = false,
  isPosting = false,
}) => {
  const isPending = isSubmitting || isPosting;
  // A Post step is marked posted with its live link only.
  const isPosted = workItem.status === 'Published';

  // Platform checklist
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    aspectRatio: false,
    handlesTagged: false,
    linkSticker: false,
    coverFrame: false,
  });

  // Uploaded post asset / file state
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The poster's own post asset, if they attach one. The approved master comes from the handoff.
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [showManualLink, setShowManualLink] = useState(false);
  const [manualLink, setManualLink] = useState('');

  // Publishing form state
  const [publishedUrl, setPublishedUrl] = useState(() => (workItem as any).publishedUrl || '');
  const [publishedAt, setPublishedAt] = useState<string>(() => {
    const now = new Date();
    // format as YYYY-MM-DDTHH:mm for datetime-local
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [postNotes, setPostNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadFileName(file.name);
    setErrorMsg(null);

    const task = new ResumableUploadTask({
      file,
      workItemId: workItem.id,
      onProgress: (p) => setUploadProgress(p.percentage),
      onError: (err) => {
        setUploadStatus('error');
        setErrorMsg(err.message || 'Failed to upload post file');
      },
      onComplete: (res) => {
        setUploadStatus('completed');
        setUploadedFileUrl(res.fileUrl);
        setUploadProgress(100);
      },
    });

    task.start();
  };

  const allChecked = Object.values(checklist).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishedUrl.trim()) {
      setErrorMsg('Please enter the live published social post URL / reference link.');
      return;
    }
    // The shared live link rule (the same function the API uses).
    if (!isLivePostUrl(publishedUrl.trim())) {
      setErrorMsg(LIVE_URL_ERROR);
      return;
    }

    setErrorMsg(null);
    await onMarkAsPosted({
      publishedUrl: publishedUrl.trim(),
      publishedAt: new Date(publishedAt).toISOString(),
      deliverableUrl: uploadedFileUrl.trim() || undefined,
      notes: postNotes.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-ui-canvas text-ui-ink overflow-hidden">
      {/* Workspace Header */}
      <div className="p-4 bg-white/60 border-b border-ui-line flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-ui-ink">{workItem.title}</h2>
            <span className="status-tint status-approved text-xs px-2.5 py-0.5 rounded-full border font-medium">
              Posting Workspace
            </span>
            {workItem.channel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-ui-text">
                {workItem.channel}
              </span>
            )}
          </div>
          <p className="text-xs text-ui-muted mt-0.5">
            Download master creative, upload post asset, and mark published with the live post link.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
        {errorMsg && (
          <div className="status-tint status-changes p-3 rounded-xl border text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Approved Deliverable Download Banner */}
        <div className="p-5 rounded-2xl border border-ui-ink flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-ui-ink flex items-center justify-center text-ui-ink flex-shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ui-ink">Approved Master Deliverable</h3>
              <p className="text-xs text-ui-text">
                Ready for high-resolution distribution to social channels.
              </p>
            </div>
          </div>

          <div className="w-full">
            <AssetLinks
              items={finalAssets}
              emptyText="The approved final cut or design will appear here once it is approved."
              testId="post-final-assets"
            />
          </div>
        </div>

        {/* 2. Upload / Attach Post File Asset */}
        <div className="p-5 rounded-2xl bg-white/60 border border-ui-line space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-ui-ink flex items-center gap-2">
                <Upload className="w-4 h-4 text-ui-ink" />
                Upload Post Media / Creative Asset
              </h3>
              <p className="text-xs text-ui-muted mt-0.5">
                Upload creative post file (video reel, static graphic, carousel, thumbnail, or publication proof).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManualLink((prev) => !prev)}
              className="text-xs text-ui-ink hover:text-ui-ink font-medium flex items-center gap-1 cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {showManualLink ? 'Switch to File Upload' : 'Paste Asset URL instead'}
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*,application/pdf"
            className="hidden"
          />

          {showManualLink ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <DriveLinkInput id="post-asset-link" label="Google Drive link" value={manualLink} onChange={setManualLink} />
              </div>
              <button
                type="button"
                disabled={!manualLink.trim() || Boolean(driveLinkError(manualLink))}
                onClick={() => {
                  if (manualLink.trim() && !driveLinkError(manualLink)) {
                    setUploadedFileUrl(manualLink.trim());
                    setUploadStatus('completed');
                    setUploadFileName('External Asset Link');
                    setShowManualLink(false);
                  }
                }}
                className="px-4 py-2 bg-ui-ink hover:bg-black text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Attach
              </button>
            </div>
          ) : (
            <div>
              {uploadedFileUrl ? (
                <div className="p-3.5 rounded-xl bg-white/60 border border-ui-line flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="status-tint status-approved w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-emerald-800 font-bold block">
                        Attached Post Asset
                      </span>
                      <div className="text-xs font-semibold text-ui-ink truncate">
                        {uploadFileName || 'Creative Deliverable'}
                      </div>
                      <a
                        href={uploadedFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-800 hover:underline flex items-center gap-1 font-mono truncate"
                      >
                        <span className="truncate">{uploadedFileUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white/60 hover:bg-white text-ui-ink text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Change / Re-upload
                  </button>
                </div>
              ) : uploadStatus === 'uploading' ? (
                <div className="p-4 rounded-xl bg-white/60 border border-ui-ink space-y-2">
                  <div className="flex justify-between text-xs text-ui-text">
                    <span>Uploading {uploadFileName}...</span>
                    <span className="font-bold text-ui-ink">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-white/70 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-ui-ink h-full rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-xl border-2 border-dashed border-ui-line hover:border-ui-ink bg-white/60 hover:bg-white flex flex-col items-center justify-center cursor-pointer transition text-center group"
                >
                  <Upload className="w-7 h-7 text-ui-ink mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-ui-ink">Click or drag & drop to upload post asset</span>
                  <span className="text-[11px] text-ui-muted mt-0.5">MP4, MOV, PNG, JPG, WebP, PDF (up to 500MB)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Platform Pre-Publish Checklist */}
        <div className="p-5 rounded-2xl bg-white/60 border border-ui-line space-y-3">
          <h3 className="text-xs font-bold text-ui-text flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-emerald-800" />
            Platform Pre-Publish Checklist {allChecked && <span className="text-emerald-800 font-mono text-[11px]">(All 4 Done ✓)</span>}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div
              onClick={() => toggleCheck('aspectRatio')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                checklist.aspectRatio
                  ? 'status-tint status-approved border-ui-line text-ui-ink'
                  : 'bg-white/60 border-ui-line text-ui-text'
              }`}
            >
              {checklist.aspectRatio ? (
                <CheckSquare className="w-4 h-4 text-emerald-800 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-ui-muted flex-shrink-0" />
              )}
              <span>Checked aspect ratio & audio clarity on mobile preview</span>
            </div>

            <div
              onClick={() => toggleCheck('handlesTagged')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                checklist.handlesTagged
                  ? 'status-tint status-approved border-ui-line text-ui-ink'
                  : 'bg-white/60 border-ui-line text-ui-text'
              }`}
            >
              {checklist.handlesTagged ? (
                <CheckSquare className="w-4 h-4 text-emerald-800 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-ui-muted flex-shrink-0" />
              )}
              <span>Tagged relevant student / partner / speaker handles</span>
            </div>

            <div
              onClick={() => toggleCheck('linkSticker')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                checklist.linkSticker
                  ? 'status-tint status-approved border-ui-line text-ui-ink'
                  : 'bg-white/60 border-ui-line text-ui-text'
              }`}
            >
              {checklist.linkSticker ? (
                <CheckSquare className="w-4 h-4 text-emerald-800 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-ui-muted flex-shrink-0" />
              )}
              <span>Added link sticker / bio link URL</span>
            </div>

            <div
              onClick={() => toggleCheck('coverFrame')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                checklist.coverFrame
                  ? 'status-tint status-approved border-ui-line text-ui-ink'
                  : 'bg-white/60 border-ui-line text-ui-text'
              }`}
            >
              {checklist.coverFrame ? (
                <CheckSquare className="w-4 h-4 text-emerald-800 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-ui-muted flex-shrink-0" />
              )}
              <span>Set high-impact cover frame thumbnail</span>
            </div>
          </div>
        </div>

        {/* 4. Live Published URL & Mark as Posted Form */}
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl bg-white/60 border border-ui-line space-y-4">
          <h3 className="text-xs font-bold text-ui-ink flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-ui-ink" />
            Publication Record
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="post-field-1" className="text-xs font-semibold text-ui-text">
                Live Published Social URL (Instagram, LinkedIn, YouTube) *
              </label>
              <input
                id="post-field-1"
                type="url"
                required
                value={publishedUrl}
                onChange={(e) => setPublishedUrl(e.target.value)}
                placeholder="https://instagram.com/p/..."
                className="ui-input w-full font-mono"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="post-field-2" className="text-xs font-semibold text-ui-text">Published Date & Time *</label>
              <input
                id="post-field-2"
                type="datetime-local"
                required
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="ui-input w-full font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="post-field-3" className="text-xs font-semibold text-ui-text">Posting Notes (Optional)</label>
            <input
              id="post-field-3"
              type="text"
              value={postNotes}
              onChange={(e) => setPostNotes(e.target.value)}
              placeholder="e.g. Posted as Reel and cross-shared to Facebook."
              className="ui-input w-full"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isPending || isPosted || !publishedUrl.trim()}
              className="min-h-[44px] px-7 py-2.5 rounded-xl bg-ui-ink hover:bg-black disabled:opacity-40 text-white font-bold text-sm transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              {isPending ? 'Recording Publication...' : 'Mark as Posted'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
