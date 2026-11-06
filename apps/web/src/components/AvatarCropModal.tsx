import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, ZoomIn, ZoomOut, RotateCcw, Check, Trash2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string | null;
  onAvatarUpdated: (newUrl: string | null) => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  onAvatarUpdated,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setImageSrc(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setError(null);
    }
  }, [isOpen]);

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Please select a PNG, JPG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image exceeds maximum allowed size of 5 MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setImageSrc(src);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Redraw canvas with crop circle
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    // Save state
    ctx.save();

    // Center translation
    ctx.translate(size / 2, size / 2);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw image centered
    const aspect = img.width / img.height;
    let drawWidth = size;
    let drawHeight = size;

    if (aspect > 1) {
      drawWidth = size * aspect;
      drawHeight = size;
    } else {
      drawWidth = size;
      drawHeight = size / aspect;
    }

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }, [zoom, pan]);

  useEffect(() => {
    if (imageSrc) {
      drawCanvas();
    }
  }, [imageSrc, zoom, pan, drawCanvas]);

  // Mouse / Touch Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Save Cropped Image
  const handleSaveCrop = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;

    setUploading(true);
    setError(null);

    try {
      // Create output 512x512 canvas for high-quality avatar
      const outCanvas = document.createElement('canvas');
      outCanvas.width = 512;
      outCanvas.height = 512;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) throw new Error('Could not initialize canvas context');

      // Draw circular mask on output
      outCtx.save();
      outCtx.beginPath();
      outCtx.arc(256, 256, 256, 0, Math.PI * 2);
      outCtx.closePath();
      outCtx.clip();

      const img = imageRef.current;
      if (img) {
        outCtx.translate(256, 256);
        const scaleFactor = 512 / canvas.width;
        outCtx.translate(pan.x * scaleFactor, pan.y * scaleFactor);
        outCtx.scale(zoom, zoom);

        const aspect = img.width / img.height;
        let dw = 512;
        let dh = 512;
        if (aspect > 1) {
          dw = 512 * aspect;
          dh = 512;
        } else {
          dw = 512;
          dh = 512 / aspect;
        }
        outCtx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      }
      outCtx.restore();

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) =>
        outCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );
      if (!blob) throw new Error('Failed to create image blob');

      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');

      const res = await apiFetch<{ success: boolean; data: { avatarUrl: string } }>(
        '/api/me/avatar',
        {
          method: 'POST',
          body: formData,
        }
      );

      if (res.data?.avatarUrl) {
        onAvatarUpdated(res.data.avatarUrl);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to upload cropped avatar. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Remove Avatar with Confirmation
  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;

    setUploading(true);
    setError(null);
    try {
      await apiFetch('/api/me/avatar', { method: 'DELETE' });
      onAvatarUpdated(null);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to remove avatar.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal w-full max-w-md p-6 sm:p-7 shadow-2xl relative border border-white/80 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-ui-text">Profile Photo</h3>
            <p className="text-xs text-ui-muted">Upload and position your circular avatar</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ui-icon-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload & Crop Canvas Area */}
        <div className="flex flex-col items-center justify-center py-2">
          {imageSrc ? (
            <div className="space-y-4 w-full flex flex-col items-center">
              {/* Circular Canvas Preview Container */}
              <div
                className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-white shadow-xl cursor-grab active:cursor-grabbing bg-slate-900"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <canvas
                  ref={canvasRef}
                  width={256}
                  height={256}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Zoom Slider Control */}
              <div className="w-full max-w-xs flex items-center gap-3 px-2">
                <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  aria-label="Zoom"
                  className="ui-range w-full h-11 cursor-pointer"
                />
                <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  title="Reset alignment"
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-ui-ink hover:text-ui-ink underline"
                >
                  Choose a different photo
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-12 px-6 border-2 border-dashed border-slate-300 hover:border-ui-ink rounded-3xl bg-slate-50/50 hover:bg-white text-center cursor-pointer transition-all space-y-3 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-ui-card text-ui-ink flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Upload your profile photo</p>
                <p className="text-xs text-slate-500 mt-1">PNG, JPG, or WEBP up to 5 MB</p>
              </div>
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-xs">
                Browse Files
              </span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {currentAvatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove current photo</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="ui-btn ui-btn-secondary"
            >
              Cancel
            </button>
            {imageSrc && (
              <button
                type="button"
                onClick={handleSaveCrop}
                disabled={uploading}
                className="ui-btn ui-btn-primary"
              >
                {uploading ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Save Photo</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

