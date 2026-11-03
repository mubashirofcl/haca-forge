import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  Trash2,
  ExternalLink,
  Link as LinkIcon,
  Send,
  Layers,
  FileIcon,
  Share2,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ShareToChatModal } from '../../chat/ShareToChatModal';
import { ResumableUploadTask } from '../../../lib/uploadManager';

interface SlideItem {
  id: string;
  url: string;
  file?: File;
  name: string;
  width?: number;
  height?: number;
}

interface DesignWorkspaceProps {
  workItem: {
    id: string;
    title: string;
    workType?: string; // 'Static Post', 'Carousel', 'Story', 'Thumbnail', 'Brochure'
    stageKey?: string;
    status?: string;
    ownerId?: any;
    contentPieceId?: any;
    _id?: string;
  };
  brief?: {
    title?: string;
    description?: string;
    channel?: string;
    references?: string[];
  };
  approvedCopy?: {
    headline?: string;
    subhead?: string;
    bodyCopy?: string;
    callToAction?: string;
    rawText?: string;
  };
  onSubmit: (data: {
    fileUrl: string;
    contentUrl?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const DesignWorkspace: React.FC<DesignWorkspaceProps> = ({
  workItem,
  brief,
  approvedCopy: propApprovedCopy,
  onSubmit,
  isSubmitting = false,
}) => {
  const rawCopy = propApprovedCopy || (workItem as any).approvedCopy || {};
  const approvedCopy = {
    headline: rawCopy.headline || (workItem as any).headline,
    subhead: rawCopy.subhead,
    bodyCopy: rawCopy.bodyCopy || rawCopy.bodyText || (workItem as any).bodyCopy,
    callToAction: rawCopy.callToAction || (workItem as any).callToAction,
    rawText: rawCopy.rawText,
  };

  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  const { user } = useAuth();
  const currentUserId = (user?._id || user?.id || (user as any)?.userId)?.toString();
  const ownerId = (workItem.ownerId?._id || workItem.ownerId)?.toString();
  const isOwner = ownerId && ownerId === currentUserId;
  const isApproved = workItem.status === 'Approved';
  const canShare = isApproved && user && (['admin', 'creative_head', 'sm_manager'].includes(user.role) || isOwner);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [designNotes, setDesignNotes] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [showLinkFallback, setShowLinkFallback] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const deliverableType = workItem.workType || 'Static Post';

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const checkDimensions = (width: number, height: number, type: string): string | null => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('carousel') || lowerType.includes('static')) {
      if (width !== 1080 || height !== 1080) {
        return `Recommended size for ${type} is 1080x1080 px (detected ${width}x${height} px).`;
      }
    } else if (lowerType.includes('story')) {
      if (width !== 1080 || height !== 1920) {
        return `Recommended size for Story is 1080x1920 px (detected ${width}x${height} px).`;
      }
    } else if (lowerType.includes('thumbnail') || lowerType.includes('cover')) {
      if (width !== 1280 || height !== 720) {
        return `Recommended size for Thumbnail/Cover is 1280x720 px (detected ${width}x${height} px).`;
      }
    }
    return null;
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setErrorMsg(null);
    setIsUploading(true);

    const newWarnings: string[] = [];
    const newSlides: SlideItem[] = [];

    for (const file of files) {
      try {
        const task = new ResumableUploadTask({
          file,
          workItemId: workItem.id,
        });

        const uploadRes = await task.start();
        const width = uploadRes.metadata?.width;
        const height = uploadRes.metadata?.height;

        if (width && height) {
          const warn = checkDimensions(width, height, deliverableType);
          if (warn) newWarnings.push(warn);
        }

        newSlides.push({
          id: task.id,
          url: uploadRes.fileUrl,
          file,
          name: file.name,
          width,
          height,
        });
      } catch (err: any) {
        setErrorMsg(err?.message || 'File upload failed');
      }
    }

    setSlides((prev) => [...prev, ...newSlides]);
    setWarnings((prev) => [...prev, ...newWarnings]);
    setIsUploading(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Carousel Reordering
  const moveSlide = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;

    const updated = [...slides];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);

    setSlides(updated);
    setActiveSlideIndex(targetIdx);
  };

  const removeSlide = (index: number) => {
    const updated = slides.filter((_, i) => i !== index);
    setSlides(updated);
    if (activeSlideIndex >= updated.length) {
      setActiveSlideIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slides.length === 0 && !fallbackUrl.trim()) {
      setErrorMsg('Please upload design creative files or provide a Figma/Canva link.');
      return;
    }

    setErrorMsg(null);
    const mainFileUrl = slides[0]?.url || fallbackUrl.trim();
    const allUrls = slides.map((s) => s.url);

    await onSubmit({
      fileUrl: mainFileUrl,
      contentUrl: fallbackUrl.trim() || mainFileUrl,
      notes: designNotes.trim(),
      metadata: {
        mediaType: mainFileUrl.toLowerCase().endsWith('.pdf') ? 'document' : 'image',
        carouselSlides: allUrls.length > 1 ? allUrls : undefined,
        slideCount: allUrls.length,
        warningsAcknowledged: warnings,
      },
    });
  };

  const activeSlide = slides[activeSlideIndex];

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Workspace Header */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-md border-b border-white/10 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white">{workItem.title}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 font-medium">
              Design Workspace
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
              {deliverableType}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Render visual creative beside approved copy with size verification & carousel sequencing.
          </p>
        </div>

        {canShare && (
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            title="Share approved design to chat"
            data-testid="design-share-to-chat-btn"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share to chat</span>
          </button>
        )}
      </div>

      {/* Main Split Body: Left approved copy, Right upload & preview canvas */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANEL: Approved Copy beside canvas */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-900/60 p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-pink-400" />
              Approved Copy
            </h3>
            <span className="text-[10px] text-slate-400">Click to copy</span>
          </div>

          {approvedCopy ? (
            <div className="space-y-3">
              {approvedCopy.headline && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-pink-400 uppercase">Headline</span>
                    <button
                      onClick={() => copyToClipboard('headline', approvedCopy.headline!)}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                      title="Copy Headline"
                    >
                      {copiedKey === 'headline' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-white">{approvedCopy.headline}</p>
                </div>
              )}

              {approvedCopy.subhead && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-pink-400 uppercase">Subhead</span>
                    <button
                      onClick={() => copyToClipboard('subhead', approvedCopy.subhead!)}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                      title="Copy Subhead"
                    >
                      {copiedKey === 'subhead' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-200">{approvedCopy.subhead}</p>
                </div>
              )}

              {approvedCopy.bodyCopy && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-pink-400 uppercase">Body Copy</span>
                    <button
                      onClick={() => copyToClipboard('body', approvedCopy.bodyCopy!)}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                      title="Copy Body"
                    >
                      {copiedKey === 'body' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap">{approvedCopy.bodyCopy}</p>
                </div>
              )}

              {approvedCopy.callToAction && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-pink-400 uppercase">Call to Action</span>
                    <button
                      onClick={() => copyToClipboard('cta', approvedCopy.callToAction!)}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                      title="Copy CTA"
                    >
                      {copiedKey === 'cta' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-emerald-300">{approvedCopy.callToAction}</p>
                </div>
              )}

              {approvedCopy.rawText && !approvedCopy.headline && !approvedCopy.bodyCopy && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-pink-400 uppercase">Content Text</span>
                    <button
                      onClick={() => copyToClipboard('raw', approvedCopy.rawText!)}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                      title="Copy Text"
                    >
                      {copiedKey === 'raw' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap">{approvedCopy.rawText}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No approved copy attached.</p>
          )}

          {/* Size Guides Reference */}
          <div className="pt-3 border-t border-white/10 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Size Guides
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-300">
                <span className="block font-semibold text-white">Feed Square</span>
                <span className="text-[10px] text-slate-400 font-mono">1:1 (1080x1080)</span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-300">
                <span className="block font-semibold text-white">Story / Reel</span>
                <span className="text-[10px] text-slate-400 font-mono">9:16 (1080x1920)</span>
              </div>
            </div>
          </div>

          {/* Inspiration references */}
          {brief?.references && brief.references.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Visual References
              </span>
              <ul className="space-y-1">
                {brief.references.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {r}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Canvas & Upload Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Non-blocking size guide warnings */}
          {warnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Dimension Guide Check (Non-Blocking)
              </div>
              {warnings.map((w, idx) => (
                <p key={idx} className="pl-5 text-amber-200/90">
                  &bull; {w}
                </p>
              ))}
            </div>
          )}

          {/* Main Visual Preview Area */}
          {activeSlide ? (
            <div className="rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden flex flex-col items-center">
              {/* Zoom Controls */}
              <div className="w-full px-4 py-2 bg-slate-950/60 border-b border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">
                  Slide {activeSlideIndex + 1} of {slides.length} |{' '}
                  {activeSlide.width ? `${activeSlide.width}x${activeSlide.height} px` : activeSlide.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="p-1 rounded hover:bg-white/10 text-slate-300"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-slate-300 px-1">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                    className="p-1 rounded hover:bg-white/10 text-slate-300"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-slate-300 hover:bg-white/20"
                  >
                    Fit
                  </button>
                </div>
              </div>

              {/* Image / PDF Display */}
              <div className="p-4 flex items-center justify-center max-h-[50vh] overflow-hidden">
                {activeSlide.url.toLowerCase().endsWith('.pdf') ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                    <FileIcon className="w-12 h-12 text-pink-400 mb-2" />
                    <p className="text-sm font-semibold text-white">{activeSlide.name}</p>
                    <p className="text-xs text-slate-500 mt-1">Multi-page PDF Document</p>
                    <a
                      href={activeSlide.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Full PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={activeSlide.url}
                    alt={activeSlide.name}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    className="max-h-[46vh] max-w-full object-contain rounded-lg shadow-xl transition-transform duration-75"
                  />
                )}
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-white/20 hover:border-pink-500/60 rounded-2xl bg-white/5 hover:bg-white/[0.08] transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-white">Upload Design Visuals or PDF</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                PNG, JPG, WebP up to 20 MB or PDF up to 50 MB. Multi-file upload for Carousels.
              </p>
            </div>
          )}

          {/* Carousel Slide Ordering Strip */}
          {slides.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-pink-400" />
                  Slide Sequence & Ordering ({slides.length} slides)
                </h4>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-pink-400 hover:text-pink-300 font-medium"
                >
                  + Add more slides
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {slides.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`p-2 rounded-xl border flex flex-col gap-2 transition-all cursor-pointer ${
                      activeSlideIndex === idx
                        ? 'bg-pink-950/40 border-pink-500 ring-2 ring-pink-500/30'
                        : 'bg-slate-900/80 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="relative h-24 rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center">
                      {s.url.toLowerCase().endsWith('.pdf') ? (
                        <FileIcon className="w-8 h-8 text-pink-400" />
                      ) : (
                        <img src={s.url} alt={s.name} className="w-full h-full object-cover" />
                      )}
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-950/80 text-white">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-[11px] text-slate-300 max-w-[80px]">
                        {s.name}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSlide(idx, 'up');
                          }}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-20"
                          title="Move Left/Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === slides.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSlide(idx, 'down');
                          }}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-20"
                          title="Move Right/Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSlide(idx);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />

          {/* Designer Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Designer Notes (Typography, Color palette, Stock licenses)
            </label>
            <textarea
              value={designNotes}
              onChange={(e) => setDesignNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Malayalam font is Manjari. Slide 4 contains licensed icon."
              className="w-full text-xs p-3 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
          </div>

          {/* Link Fallback */}
          <div>
            <button
              type="button"
              onClick={() => setShowLinkFallback(!showLinkFallback)}
              className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {showLinkFallback ? 'Hide Backup Figma / Canva Link' : '+ Add Backup Figma / Canva Link'}
            </button>

            {showLinkFallback && (
              <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <label className="text-xs text-slate-400">External Design Canvas URL:</label>
                <input
                  type="url"
                  value={fallbackUrl}
                  onChange={(e) => setFallbackUrl(e.target.value)}
                  placeholder="https://www.figma.com/file/..."
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={isSubmitting || isUploading}
              onClick={handleSubmit}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-pink-500/25 flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting Design...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>

      {showShareModal && (
        <ShareToChatModal
          assetId={workItem._id || (workItem as any).id || ''}
          assetType="designImages"
          contentPieceId={(workItem.contentPieceId as any)?._id || (workItem.contentPieceId as any) || ''}
          contentPieceTitle={workItem.title}
          stageKey="Design"
          title={workItem.title}
          thumbnailUrl={slides[0]?.url}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};
