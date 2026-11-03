import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Play,
  Pause,
  RotateCcw,
  X,
  Camera,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  FileImage,
} from 'lucide-react';
import {
  ResumableUploadTask,
  validateUploadFile,
  extractBrowserMediaMetadata,
  UploadKind,
} from '../../../lib/uploadManager';
import { apiFetch } from '../../../lib/api';

export interface ActiveUploadItem {
  id: string;
  stageItemId: string;
  file: File;
  name: string;
  sizeBytes: number;
  kind: UploadKind;
  progress: number;
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'error';
  errorMessage?: string;
  task?: ResumableUploadTask;
  completedClip?: any;
}

// Global active upload store across navigation
const globalUploadsQueue: ActiveUploadItem[] = [];
const queueListeners: Set<() => void> = new Set();

function notifyQueueListeners() {
  queueListeners.forEach((listener) => listener());
}

export function useGlobalUploadQueue(stageItemId: string) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    queueListeners.add(onChange);
    return () => {
      queueListeners.delete(onChange);
    };
  }, []);

  return globalUploadsQueue.filter((item) => item.stageItemId === stageItemId);
}

interface UploadManagerProps {
  stageItemId: string;
  onClipCreated?: (clip: any) => void;
  maxClips?: number;
  currentClipsCount?: number;
  disabled?: boolean;
}

export const UploadManager: React.FC<UploadManagerProps> = ({
  stageItemId,
  onClipCreated,
  maxClips = 10,
  currentClipsCount = 0,
  disabled = false,
}) => {
  const items = useGlobalUploadQueue(stageItemId);
  const [isDragging, setIsDragging] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Tab-close warning if any upload in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const active = globalUploadsQueue.some(
        (it) => it.status === 'uploading' || it.status === 'queued'
      );
      if (active) {
        e.preventDefault();
        e.returnValue = 'Uploads are currently in progress. If you leave or close this tab, uploads may be interrupted.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Process concurrency queue (max 2-3 parallel uploads)
  const processQueue = useCallback(async () => {
    const maxParallel = 2;
    const currentlyUploading = globalUploadsQueue.filter((it) => it.status === 'uploading');
    if (currentlyUploading.length >= maxParallel) return;

    const nextItem = globalUploadsQueue.find((it) => it.status === 'queued');
    if (!nextItem) return;

    nextItem.status = 'uploading';
    notifyQueueListeners();

    try {
      const task = new ResumableUploadTask({
        file: nextItem.file,
        kind: nextItem.kind,
        workItemId: nextItem.stageItemId,
        onProgress: (p) => {
          nextItem.progress = p.percentage;
          notifyQueueListeners();
        },
      });

      nextItem.task = task;

      const result = await task.start();

      // Extract metadata (width, height, duration)
      let meta = result.metadata;
      if (!meta || (!meta.width && !meta.duration)) {
        try {
          meta = await extractBrowserMediaMetadata(nextItem.file, nextItem.kind);
        } catch {}
      }

      // Calculate orientation
      const width = meta.width || 0;
      const height = meta.height || 0;
      const ratio = width > 0 ? height / width : 1;
      const orientationOk = width > 0 && height > 0 ? ratio >= 1.6 && ratio <= 1.9 : true;

      // Create Clip directly via backend API
      const cleanTitle = nextItem.file.name.replace(/\.[^/.]+$/, '');
      const clipRes = await apiFetch<any>(`/api/work/${nextItem.stageItemId}/clips`, {
        method: 'POST',
        body: JSON.stringify({
          url: result.fileUrl,
          thumbnailUrl: result.fileUrl,
          kind: nextItem.kind,
          title: cleanTitle,
          sizeBytes: nextItem.sizeBytes,
          width,
          height,
          durationSeconds: meta.duration || 0,
          orientationOk,
          status: 'uploaded',
        }),
      });

      const createdClip = clipRes?.data || clipRes;
      nextItem.status = 'completed';
      nextItem.progress = 100;
      nextItem.completedClip = createdClip;
      notifyQueueListeners();

      if (onClipCreated) {
        onClipCreated(createdClip);
      }
    } catch (err: any) {
      nextItem.status = 'error';
      nextItem.errorMessage = err?.message || 'Upload failed';
      notifyQueueListeners();
    } finally {
      processQueue();
    }
  }, [onClipCreated]);

  // Trigger queue check on state changes
  useEffect(() => {
    processQueue();
  }, [processQueue, items.length]);

  const handleFilesAdded = (files: File[]) => {
    if (disabled) return;
    setErrorBanner(null);

    const totalAllowed = maxClips - currentClipsCount - items.filter((it) => it.status !== 'error').length;
    if (files.length > totalAllowed) {
      setErrorBanner(`Cannot upload more than ${maxClips} clips total. You can add at most ${Math.max(0, totalAllowed)} more.`);
      return;
    }

    for (const file of files) {
      const lower = file.name.toLowerCase();
      const kind: UploadKind =
        lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || file.type.startsWith('video/')
          ? 'video'
          : 'image';

      const validation = validateUploadFile(file, kind);
      if (!validation.valid) {
        setErrorBanner(validation.error || 'Invalid file format or size limit exceeded.');
        return;
      }

      const uploadItem: ActiveUploadItem = {
        id: Math.random().toString(36).substring(2, 9),
        stageItemId,
        file,
        name: file.name,
        sizeBytes: file.size,
        kind,
        progress: 0,
        status: 'queued',
      };

      globalUploadsQueue.push(uploadItem);
    }

    notifyQueueListeners();
    processQueue();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || !e.dataTransfer.files) return;
    handleFilesAdded(Array.from(e.dataTransfer.files));
  };

  const handlePause = (item: ActiveUploadItem) => {
    if (item.task) {
      item.task.pause();
    }
    item.status = 'paused';
    notifyQueueListeners();
    processQueue();
  };

  const handleResume = (item: ActiveUploadItem) => {
    item.status = 'queued';
    notifyQueueListeners();
    processQueue();
  };

  const handleRetry = (item: ActiveUploadItem) => {
    item.status = 'queued';
    item.progress = 0;
    item.errorMessage = undefined;
    notifyQueueListeners();
    processQueue();
  };

  const handleCancel = (item: ActiveUploadItem) => {
    if (item.task) {
      item.task.abort();
    }
    const idx = globalUploadsQueue.findIndex((it) => it.id === item.id);
    if (idx !== -1) {
      globalUploadsQueue.splice(idx, 1);
      notifyQueueListeners();
      processQueue();
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {errorBanner && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs animate-fadeIn">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span className="flex-1 font-medium">{errorBanner}</span>
          <button
            onClick={() => setErrorBanner(null)}
            className="p-1 hover:bg-rose-500/20 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drop Zone Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 transition-all duration-200 text-center ${
          disabled
            ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
            : isDragging
            ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
            : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/[0.08]'
        } backdrop-blur-md`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(Array.from(e.target.files));
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(Array.from(e.target.files));
            if (cameraInputRef.current) cameraInputRef.current.value = '';
          }}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-white/20 flex items-center justify-center text-indigo-400">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-100">
              Drag & drop clips here, or browse files
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports MP4, MOV, WebM (up to 500 MB) & images. 9:16 vertical recommended.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-5 rounded-full bg-slate-900 border border-white/20 text-white font-medium text-xs hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              Choose Files
            </button>

            {/* Mobile record camera button */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[44px] px-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-indigo-300" />
              <span>Record Clip</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            {currentClipsCount} of {maxClips} clips uploaded
          </div>
        </div>
      </div>

      {/* Active Uploads Queue Cards */}
      {items.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Upload Queue ({items.length})</span>
            <span className="text-[11px] text-slate-400 font-normal">
              2 parallel uploads
            </span>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 backdrop-blur-md flex flex-col gap-2 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-slate-300">
                      {item.kind === 'video' ? (
                        <FileVideo className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <FileImage className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-100 truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatSize(item.sizeBytes)} •{' '}
                        {item.status === 'uploading' && `${item.progress}%`}
                        {item.status === 'queued' && 'Queued'}
                        {item.status === 'paused' && 'Paused'}
                        {item.status === 'completed' && 'Completed'}
                        {item.status === 'error' && (
                          <span className="text-rose-400">{item.errorMessage || 'Error'}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons with min 44px touch targets on mobile */}
                  <div className="flex items-center gap-1">
                    {item.status === 'uploading' && (
                      <button
                        type="button"
                        onClick={() => handlePause(item)}
                        title="Pause upload"
                        className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {item.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleResume(item)}
                        title="Resume upload"
                        className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {item.status === 'error' && (
                      <button
                        type="button"
                        onClick={() => handleRetry(item)}
                        title="Retry upload"
                        className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {item.status === 'completed' ? (
                      <div className="w-7 h-7 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCancel(item)}
                        title="Cancel upload"
                        className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {item.status === 'uploading' && (
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
