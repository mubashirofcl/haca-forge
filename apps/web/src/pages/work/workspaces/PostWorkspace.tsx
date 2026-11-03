import React, { useState, useRef } from 'react';
import {
  Download,
  Copy,
  Check,
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
  approvedDeliverable?: {
    fileUrl?: string;
    contentUrl?: string;
    mediaType?: string;
  };
  captionsAndHashtags?: {
    caption?: string;
    hashtags?: string;
  };
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
  approvedDeliverable,
  captionsAndHashtags,
  onMarkAsPosted,
  isSubmitting = false,
  isPosting = false,
}) => {
  const isPending = isSubmitting || isPosting;
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);

  // Platform checklist
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    aspectRatio: false,
    handlesTagged: false,
    linkSticker: false,
    coverFrame: false,
  });

  // Initial deliverable from upstream
  const deliverableUrl =
    approvedDeliverable?.fileUrl ||
    approvedDeliverable?.contentUrl ||
    (workItem as any).deliverableUrl ||
    (workItem as any).fileUrl ||
    (workItem as any).contentUrl ||
    '';

  // Uploaded post asset / file state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>(deliverableUrl);
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

  const captionText =
    captionsAndHashtags?.caption ||
    (workItem as any).caption;

  const hashtagsText =
    captionsAndHashtags?.hashtags ||
    (workItem as any).hashtags;

  const toggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyCaption = () => {
    if (!captionText) return;
    navigator.clipboard.writeText(captionText);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyHashtags = () => {
    if (!hashtagsText) return;
    navigator.clipboard.writeText(hashtagsText);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
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
    try {
      new URL(publishedUrl.trim());
    } catch {
      setErrorMsg('Please enter a valid URL (starting with https://).');
      return;
    }

    setErrorMsg(null);
    await onMarkAsPosted({
      publishedUrl: publishedUrl.trim(),
      publishedAt: new Date(publishedAt).toISOString(),
      deliverableUrl: uploadedFileUrl.trim() || deliverableUrl || undefined,
      notes: postNotes.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Workspace Header */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white">{workItem.title}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              Posting Workspace
            </span>
            {workItem.channel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                {workItem.channel}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Download master creative, upload post asset, copy caption & hashtags, and mark published with live reference link.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Approved Deliverable Download Banner */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 flex-shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Approved Master Deliverable</h3>
              <p className="text-xs text-slate-300">
                Ready for high-resolution distribution to social channels.
              </p>
            </div>
          </div>

          {deliverableUrl ? (
            <a
              href={deliverableUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center gap-2 cursor-pointer flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Approved Master
            </a>
          ) : (
            <span className="text-xs text-slate-500 italic">No master file attached</span>
          )}
        </div>

        {/* 2. Upload / Attach Post File Asset */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                Upload Post Media / Creative Asset
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload creative post file (video reel, static graphic, carousel, thumbnail, or publication proof).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManualLink((prev) => !prev)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
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
              <input
                type="url"
                value={manualLink}
                onChange={(e) => setManualLink(e.target.value)}
                placeholder="https://drive.google.com/... or Figma link"
                className="flex-1 text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualLink.trim()) {
                    setUploadedFileUrl(manualLink.trim());
                    setUploadStatus('completed');
                    setUploadFileName('External Asset Link');
                    setShowManualLink(false);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Attach
              </button>
            </div>
          ) : (
            <div>
              {uploadedFileUrl ? (
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                        Attached Post Asset
                      </span>
                      <div className="text-xs font-semibold text-white truncate">
                        {uploadFileName || 'Creative Deliverable'}
                      </div>
                      <a
                        href={uploadedFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-mono truncate"
                      >
                        <span className="truncate">{uploadedFileUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Change / Re-upload
                  </button>
                </div>
              ) : uploadStatus === 'uploading' ? (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/40 space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Uploading {uploadFileName}...</span>
                    <span className="font-bold text-indigo-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-indigo-400 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center cursor-pointer transition text-center group"
                >
                  <Upload className="w-7 h-7 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white">Click or drag & drop to upload post asset</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">MP4, MOV, PNG, JPG, WebP, PDF (up to 500MB)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Captions & Hashtags Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Caption */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Post Caption
                </span>
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  disabled={!captionText}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCaption ? 'Copied' : 'Copy Caption'}
                </button>
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                {captionText || 'No caption entered in script metadata.'}
              </p>
            </div>
          </div>

          {/* Hashtags */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Hashtags
                </span>
                <button
                  type="button"
                  onClick={handleCopyHashtags}
                  disabled={!hashtagsText}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  {copiedHashtags ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedHashtags ? 'Copied' : 'Copy Hashtags'}
                </button>
              </div>
              <p className="text-xs text-indigo-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                {hashtagsText || 'No hashtags entered in script metadata.'}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Platform Pre-Publish Checklist */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            Platform Pre-Publish Checklist {allChecked && <span className="text-emerald-400 font-mono text-[11px]">(All 4 Done ✓)</span>}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div
              onClick={() => toggleCheck('aspectRatio')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                checklist.aspectRatio
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              {checklist.aspectRatio ? (
                <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
              )}
              <span>Checked aspect ratio & audio clarity on mobile preview</span>
            </div>

            <div
              onClick={() => toggleCheck('handlesTagged')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                checklist.handlesTagged
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              {checklist.handlesTagged ? (
                <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
              )}
              <span>Tagged relevant student / partner / speaker handles</span>
            </div>

            <div
              onClick={() => toggleCheck('linkSticker')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                checklist.linkSticker
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              {checklist.linkSticker ? (
                <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
              )}
              <span>Added link sticker / bio link URL</span>
            </div>

            <div
              onClick={() => toggleCheck('coverFrame')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                checklist.coverFrame
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              {checklist.coverFrame ? (
                <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
              )}
              <span>Set high-impact cover frame thumbnail</span>
            </div>
          </div>
        </div>

        {/* 4. Live Published URL & Mark as Posted Form */}
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-indigo-400" />
            Publication Record
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Live Published Social URL (Instagram, LinkedIn, YouTube) *
              </label>
              <input
                type="url"
                required
                value={publishedUrl}
                onChange={(e) => setPublishedUrl(e.target.value)}
                placeholder="https://instagram.com/p/..."
                className="w-full text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Published Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Posting Notes (Optional)</label>
            <input
              type="text"
              value={postNotes}
              onChange={(e) => setPostNotes(e.target.value)}
              placeholder="e.g. Posted as Reel and cross-shared to Facebook."
              className="w-full text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isPending || !publishedUrl.trim()}
              className="min-h-[44px] px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center gap-2 cursor-pointer"
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
