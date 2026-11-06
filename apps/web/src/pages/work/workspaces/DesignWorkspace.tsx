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
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ShareToChatModal } from '../../chat/ShareToChatModal';
import { ResumableUploadTask } from '../../../lib/uploadManager';
import type { RevisionComment } from './EditWorkspace';

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
  /** Submission comments for this step (same data the Edit workspace receives). */
  revisionComments?: RevisionComment[];
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
  revisionComments = [],
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

  // Creative Head / Admin revision feedback (read-only here; comments without a role are kept).
  const reviewerFeedback = revisionComments.filter(
    (c) => !c.authorRole || c.authorRole === 'creative_head' || c.authorRole === 'admin'
  );

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
    <div className="flex flex-col h-full w-full bg-ui-canvas text-ui-ink overflow-hidden">
      {/* Workspace Header */}
      <div className="p-4 bg-white/60 border-b border-ui-line flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-ui-ink">{workItem.title}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white text-ui-ink border border-ui-ink font-medium">
              Design Workspace
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-ui-text">
              {deliverableType}
            </span>
          </div>
          <p className="text-xs text-ui-muted mt-0.5">
            Render visual creative beside approved copy with size verification & carousel sequencing.
          </p>
        </div>

        {canShare && (
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="ui-btn ui-btn-primary h-11 gap-1.5"
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
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-ui-line bg-white/60 p-4 overflow-y-auto space-y-4 flex-shrink-0">
          {/* Revision feedback from the Creative Head (same comment data as the Edit workspace) */}
          {reviewerFeedback.length > 0 && (
            <section aria-labelledby="design-revision-feedback" className="status-tint status-waiting p-4 rounded-2xl border space-y-2.5">
              <h3 id="design-revision-feedback" className="text-xs font-bold flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                Revision feedback ({reviewerFeedback.length})
              </h3>
              <ul className="space-y-2">
                {reviewerFeedback.map((c) => (
                  <li key={c.id} className="p-2.5 rounded-xl bg-white/70 border border-ui-line text-xs text-ui-ink space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-ui-muted">
                      <span className="font-semibold text-ui-text">{c.authorName || 'Creative Head'}</span>
                      {c.createdAt && <span>{new Date(c.createdAt).toLocaleDateString()}</span>}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{c.content}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-ui-ink flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-ui-ink" />
              Approved Copy
            </h3>
            <span className="text-[11px] text-ui-muted">Click to copy</span>
          </div>

          {approvedCopy ? (
            <div className="space-y-3">
              {approvedCopy.headline && (
                <div className="p-3 rounded-xl bg-white/60 border border-ui-line space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ui-ink">Headline</span>
                    <button
                      onClick={() => copyToClipboard('headline', approvedCopy.headline!)}
                      className="p-1 rounded bg-white/60 hover:bg-white text-ui-text"
                      title="Copy Headline"
                    >
                      {copiedKey === 'headline' ? (
                        <Check className="w-3 h-3 text-emerald-800" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-ui-ink">{approvedCopy.headline}</p>
                </div>
              )}

              {approvedCopy.subhead && (
                <div className="p-3 rounded-xl bg-white/60 border border-ui-line space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ui-ink">Subhead</span>
                    <button
                      onClick={() => copyToClipboard('subhead', approvedCopy.subhead!)}
                      className="p-1 rounded bg-white/60 hover:bg-white text-ui-text"
                      title="Copy Subhead"
                    >
                      {copiedKey === 'subhead' ? (
                        <Check className="w-3 h-3 text-emerald-800" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-ui-ink">{approvedCopy.subhead}</p>
                </div>
              )}

              {approvedCopy.bodyCopy && (
                <div className="p-3 rounded-xl bg-white/60 border border-ui-line space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ui-ink">Body Copy</span>
                    <button
                      onClick={() => copyToClipboard('body', approvedCopy.bodyCopy!)}
                      className="p-1 rounded bg-white/60 hover:bg-white text-ui-text"
                      title="Copy Body"
                    >
                      {copiedKey === 'body' ? (
                        <Check className="w-3 h-3 text-emerald-800" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-ui-text whitespace-pre-wrap">{approvedCopy.bodyCopy}</p>
                </div>
              )}

              {approvedCopy.callToAction && (
                <div className="p-3 rounded-xl bg-white/60 border border-ui-line space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ui-ink">Call to Action</span>
                    <button
                      onClick={() => copyToClipboard('cta', approvedCopy.callToAction!)}
                      className="p-1 rounded bg-white/60 hover:bg-white text-ui-text"
                      title="Copy CTA"
                    >
                      {copiedKey === 'cta' ? (
                        <Check className="w-3 h-3 text-emerald-800" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-emerald-800">{approvedCopy.callToAction}</p>
                </div>
              )}

              {approvedCopy.rawText && !approvedCopy.headline && !approvedCopy.bodyCopy && (
                <div className="p-3 rounded-xl bg-white/60 border border-ui-line space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ui-ink">Content Text</span>
                    <button
                      onClick={() => copyToClipboard('raw', approvedCopy.rawText!)}
                      className="p-1 rounded bg-white/60 hover:bg-white text-ui-text"
                      title="Copy Text"
                    >
                      {copiedKey === 'raw' ? (
                        <Check className="w-3 h-3 text-emerald-800" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-ui-text whitespace-pre-wrap">{approvedCopy.rawText}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-ui-muted">No approved copy attached.</p>
          )}

          {/* Size Guides Reference */}
          <div className="pt-3 border-t border-ui-line space-y-1.5">
            <span className="text-[11px] font-bold text-ui-muted block">
              Size Guides
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="p-2 rounded-lg bg-white/60 border border-ui-line text-ui-text">
                <span className="block font-semibold text-ui-ink">Feed Square</span>
                <span className="text-[11px] text-ui-muted font-mono">1:1 (1080x1080)</span>
              </div>
              <div className="p-2 rounded-lg bg-white/60 border border-ui-line text-ui-text">
                <span className="block font-semibold text-ui-ink">Story / Reel</span>
                <span className="text-[11px] text-ui-muted font-mono">9:16 (1080x1920)</span>
              </div>
            </div>
          </div>

          {/* Inspiration references */}
          {brief?.references && brief.references.length > 0 && (
            <div className="pt-2 border-t border-ui-line">
              <span className="text-[11px] font-bold text-ui-muted block mb-1">
                Visual References
              </span>
              <ul className="space-y-1">
                {brief.references.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-ui-ink hover:underline flex items-center gap-1 truncate"
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
            <div className="status-tint status-changes p-3 rounded-xl border text-xs">
              {errorMsg}
            </div>
          )}

          {/* Non-blocking size guide warnings */}
          {warnings.length > 0 && (
            <div className="status-tint status-waiting p-3.5 rounded-xl border text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-800" />
                Dimension Guide Check (Non-Blocking)
              </div>
              {warnings.map((w, idx) => (
                <p key={idx} className="pl-5 text-amber-800">
                  &bull; {w}
                </p>
              ))}
            </div>
          )}

          {/* Main Visual Preview Area */}
          {activeSlide ? (
            <div className="rounded-2xl bg-white/60 border border-ui-line overflow-hidden flex flex-col items-center">
              {/* Zoom Controls */}
              <div className="w-full px-4 py-2 bg-white/60 border-b border-ui-line flex items-center justify-between text-xs">
                <span className="text-ui-muted font-mono">
                  Slide {activeSlideIndex + 1} of {slides.length} |{' '}
                  {activeSlide.width ? `${activeSlide.width}x${activeSlide.height} px` : activeSlide.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="p-1 rounded hover:bg-white text-ui-text"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-ui-text px-1">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                    className="p-1 rounded hover:bg-white text-ui-text"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="ml-1 px-1.5 py-0.5 rounded text-[11px] bg-white/60 text-ui-text hover:bg-white"
                  >
                    Fit
                  </button>
                </div>
              </div>

              {/* Image / PDF Display */}
              <div className="p-4 flex items-center justify-center max-h-[50vh] overflow-hidden">
                {activeSlide.url.toLowerCase().endsWith('.pdf') ? (
                  <div className="p-8 text-center text-ui-muted flex flex-col items-center">
                    <FileIcon className="w-12 h-12 text-ui-ink mb-2" />
                    <p className="text-sm font-semibold text-ui-ink">{activeSlide.name}</p>
                    <p className="text-xs text-ui-muted mt-1">Multi-page PDF Document</p>
                    <a
                      href={activeSlide.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ui-ink hover:bg-black text-white text-xs font-semibold"
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
                    className="max-h-[46vh] max-w-full object-contain rounded-lg transition-transform duration-75"
                  />
                )}
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-ui-line hover:border-ui-ink rounded-2xl bg-white/60 hover:bg-white/[0.08] transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-ui-ink text-ui-ink flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-ui-ink">Upload Design Visuals or PDF</h3>
              <p className="text-xs text-ui-muted mt-1 max-w-sm">
                PNG, JPG, WebP up to 20 MB or PDF up to 50 MB. Multi-file upload for Carousels.
              </p>
            </div>
          )}

          {/* Carousel Slide Ordering Strip */}
          {slides.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-ui-text flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-ui-ink" />
                  Slide Sequence & Ordering ({slides.length} slides)
                </h4>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-ui-ink hover:text-ui-ink font-medium"
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
                        ? 'bg-white border-ui-ink ring-2 ring-ui-ink'
                        : 'bg-white/60 border-ui-line hover:border-ui-line'
                    }`}
                  >
                    <div className="relative h-24 rounded-lg overflow-hidden bg-ui-canvas flex items-center justify-center">
                      {s.url.toLowerCase().endsWith('.pdf') ? (
                        <FileIcon className="w-8 h-8 text-ui-ink" />
                      ) : (
                        <img src={s.url} alt={s.name} className="w-full h-full object-cover" />
                      )}
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-white text-ui-ink">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-[11px] text-ui-text max-w-[80px]">
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
                          className="p-1 rounded hover:bg-white text-ui-muted disabled:opacity-20"
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
                          className="p-1 rounded hover:bg-white text-ui-muted disabled:opacity-20"
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
                          className="p-1 rounded hover:bg-white text-ui-muted hover:text-rose-800"
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
            <label htmlFor="design-notes" className="text-xs font-semibold text-ui-text">
              Designer Notes (Typography, Color palette, Stock licenses)
            </label>
            <textarea
              id="design-notes"
              value={designNotes}
              onChange={(e) => setDesignNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Malayalam font is Manjari. Slide 4 contains licensed icon."
              className="ui-input ui-textarea w-full"
            />
          </div>

          {/* Link Fallback */}
          <div>
            <button
              type="button"
              onClick={() => setShowLinkFallback(!showLinkFallback)}
              className="text-xs text-ui-ink hover:text-ui-ink flex items-center gap-1"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {showLinkFallback ? 'Hide Backup Figma / Canva Link' : '+ Add Backup Figma / Canva Link'}
            </button>

            {showLinkFallback && (
              <div className="mt-2 p-3 rounded-xl bg-white/60 border border-ui-line space-y-2">
                <label htmlFor="design-field-1" className="text-xs text-ui-muted">External Design Canvas URL:</label>
                <input
                  id="design-field-1"
                  type="url"
                  value={fallbackUrl}
                  onChange={(e) => setFallbackUrl(e.target.value)}
                  placeholder="https://www.figma.com/file/..."
                  className="ui-input w-full font-mono"
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
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-ui-ink hover:bg-black disabled:opacity-40 text-white font-semibold text-sm transition-all shadow-lg flex items-center gap-2 cursor-pointer"
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
