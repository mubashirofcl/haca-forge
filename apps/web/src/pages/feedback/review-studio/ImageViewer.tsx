import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export interface ImageCommentAnchor {
  x: number; // Percentage (0-100)
  y: number; // Percentage (0-100)
}

export interface ReviewComment {
  id: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  } | string;
  content?: string;
  text?: string;
  createdAt: string;
  anchor?: {
    type?: 'text' | 'timecode' | 'point' | string;
    text?: string;
    timecode?: number;
    coordinates?: ImageCommentAnchor;
    x?: number;
    y?: number;
  };
  resolved?: boolean;
}

interface ImageViewerProps {
  images: string[];
  activeSlideIndex?: number;
  onSlideChange?: (index: number) => void;
  comments?: ReviewComment[];
  activeCommentId?: string | null;
  onSelectComment?: (commentId: string) => void;
  onAddPointComment?: (coords: ImageCommentAnchor, text: string) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  activeSlideIndex = 0,
  onSlideChange,
  comments = [],
  activeCommentId = null,
  onSelectComment,
  onAddPointComment,
}) => {
  const [currentIndex, setCurrentIndex] = useState(activeSlideIndex);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = fit, 0.5 = 50%, 1.5, 2
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Pending comment creation pin
  const [pendingPin, setPendingPin] = useState<ImageCommentAnchor | null>(null);
  const [commentText, setCommentText] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentIndex(activeSlideIndex);
  }, [activeSlideIndex]);

  const handleSlideChange = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < images.length) {
      setCurrentIndex(newIndex);
      onSlideChange?.(newIndex);
      setPendingPin(null);
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const currentImage = images[currentIndex] || '';

  // Filter comments anchored to points
  const pointComments = comments.filter(
    (c) =>
      c.anchor?.type === 'point' &&
      (c.anchor.coordinates || (c.anchor.x !== undefined && c.anchor.y !== undefined))
  );

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or drag when zoomed in
    if (e.button === 1 || (e.button === 0 && zoomLevel > 1 && !e.shiftKey)) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Image click to drop comment pin
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (isPanning) return;
    if (!imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (clickY / rect.height) * 100));

    setPendingPin({
      x: Number(xPercent.toFixed(1)),
      y: Number(yPercent.toFixed(1)),
    });
    setCommentText('');
  };

  const handleSavePendingComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPin || !commentText.trim()) return;
    onAddPointComment?.(pendingPin, commentText.trim());
    setPendingPin(null);
    setCommentText('');
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-full w-full bg-slate-950/80 rounded-xl overflow-hidden border border-white/10 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg text-slate-300">
        <button
          onClick={handleZoomOut}
          disabled={zoomLevel <= 0.5}
          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-colors"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono font-medium px-1 text-slate-200">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          disabled={zoomLevel >= 3}
          className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-1" />
        <button
          onClick={handleResetZoom}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="Fit to Screen"
          aria-label="Fit to Screen"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {images.length > 1 && (
          <>
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <span className="text-xs text-slate-400 font-medium">
              Slide {currentIndex + 1} of {images.length}
            </span>
          </>
        )}
      </div>

      {/* Main View Area */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center p-4 cursor-crosshair"
        onMouseDown={handleMouseDown}
      >
        {currentImage ? (
          <div
            className="relative transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            <img
              ref={imgRef}
              src={currentImage}
              alt={`Slide ${currentIndex + 1}`}
              className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-2xl pointer-events-auto"
              onClick={handleImageClick}
              draggable={false}
            />

            {/* Existing Point Pins */}
            {pointComments.map((comment, index) => {
              const coords = comment.anchor!.coordinates || {
                x: comment.anchor!.x ?? 0,
                y: comment.anchor!.y ?? 0,
              };
              const authorName =
                typeof comment.author === 'string'
                  ? comment.author
                  : comment.author?.name || 'Reviewer';
              const commentText = comment.text || comment.content || '';
              const isActive = activeCommentId === comment.id;
              return (
                <button
                  key={comment.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectComment?.(comment.id);
                  }}
                  style={{
                    left: `${coords.x}%`,
                    top: `${coords.y}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs shadow-lg transition-transform hover:scale-125 z-10 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/30'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500'
                  }`}
                  title={`${authorName}: ${commentText.slice(0, 40)}`}
                >
                  {index + 1}
                </button>
              );
            })}

            {/* Pending New Pin Form */}
            {pendingPin && (
              <div
                style={{
                  left: `${pendingPin.x}%`,
                  top: `${pendingPin.y}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg ring-4 ring-emerald-500/40 animate-pulse mb-2 mx-auto">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <form
                  onSubmit={handleSavePendingComment}
                  className="w-64 p-2.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-white/20 shadow-2xl flex flex-col gap-2"
                >
                  <p className="text-xs font-medium text-slate-300">
                    Pin comment at ({pendingPin.x}%, {pendingPin.y}%)
                  </p>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Leave point feedback..."
                    autoFocus
                    rows={2}
                    className="w-full text-xs p-2 rounded-lg bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPendingPin(null)}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!commentText.trim()}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                    >
                      Add Pin
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-slate-500 p-8">
            <p className="text-sm">No image available to display.</p>
          </div>
        )}
      </div>

      {/* Carousel Thumbnail Strip (when multiple slides/images exist) */}
      {images.length > 1 && (
        <div className="h-20 bg-slate-900/90 backdrop-blur-md border-t border-white/10 px-4 flex items-center gap-3 overflow-x-auto z-10">
          <button
            onClick={() => handleSlideChange(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 flex-shrink-0"
            title="Previous slide"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Slide ${idx + 1}`}
                onClick={() => handleSlideChange(idx)}
                className={`relative h-14 w-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                  currentIndex === idx
                    ? 'border-indigo-500 ring-2 ring-indigo-500/40 scale-105'
                    : 'border-white/10 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 px-1 text-[10px] bg-slate-950/80 text-white font-mono rounded-tl">
                  {idx + 1}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => handleSlideChange(currentIndex + 1)}
            disabled={currentIndex === images.length - 1}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 flex-shrink-0"
            title="Next slide"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
