import { apiFetch, refreshSession } from './api';

export type UploadKind = 'video' | 'image' | 'pdf';

export interface UploadFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  kind: UploadKind;
  progress: number;
  status: 'idle' | 'uploading' | 'paused' | 'completed' | 'error';
  errorMessage?: string;
  url?: string;
  width?: number;
  height?: number;
  duration?: number; // In seconds
}

export interface MediaMetadata {
  width: number;
  height: number;
  duration?: number;
}

export const UPLOAD_LIMITS = {
  video: { maxBytes: 500 * 1024 * 1024, maxMB: 500, allowedExts: ['.mp4', '.mov', '.webm'], mimes: ['video/mp4', 'video/quicktime', 'video/webm'] },
  image: { maxBytes: 20 * 1024 * 1024, maxMB: 20, allowedExts: ['.png', '.jpg', '.jpeg', '.webp'], mimes: ['image/png', 'image/jpeg', 'image/webp'] },
  pdf: { maxBytes: 50 * 1024 * 1024, maxMB: 50, allowedExts: ['.pdf'], mimes: ['application/pdf'] },
};

/**
 * Extracts metadata (width, height, duration) in browser without external dependencies.
 */
export async function extractBrowserMediaMetadata(file: File, kind: UploadKind): Promise<MediaMetadata> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);

    if (kind === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
          duration: Math.round(video.duration || 0),
        });
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: 0, height: 0, duration: 0 });
      };
      video.src = objectUrl;
    } else if (kind === 'image') {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: 0, height: 0 });
      };
      img.src = objectUrl;
    } else {
      resolve({ width: 0, height: 0 });
    }
  });
}

/**
 * Validates file format and size limits.
 */
export function validateUploadFile(file: File, kind: UploadKind): { valid: boolean; error?: string } {
  const limits = UPLOAD_LIMITS[kind];
  if (!limits) return { valid: false, error: `Invalid upload kind: ${kind}` };

  if (file.size > limits.maxBytes) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the ${limits.maxMB} MB limit for ${kind} uploads.`,
    };
  }

  const nameLower = file.name.toLowerCase();
  const extMatch = limits.allowedExts.some((ext) => nameLower.endsWith(ext));
  const mimeMatch = !file.type || limits.mimes.includes(file.type.toLowerCase()) || limits.mimes.some((m) => file.type.includes(m));

  if (!extMatch && !mimeMatch) {
    return {
      valid: false,
      error: `Invalid file format. Allowed formats: ${limits.allowedExts.join(', ')}`,
    };
  }

  return { valid: true };
}

export interface ResumableUploadOptions {
  file: File;
  kind?: UploadKind;
  workItemId?: string;
  onProgress?: (progress: { percentage: number }) => void;
  onComplete?: (result: { fileUrl: string; metadata: MediaMetadata }) => void;
  onError?: (err: Error) => void;
}

/**
 * Upload Controller with Progress, Pause, Resume, and Retry.
 */
export class ResumableUploadTask {
  public id: string = Math.random().toString(36).substring(2, 9);
  private file: File;
  private kind: UploadKind;
  private metadata: MediaMetadata = { width: 0, height: 0 };
  private xhr: XMLHttpRequest | null = null;
  private isPaused = false;
  private currentProgress = 0;
  private onProgressCallback?: (progress: { percentage: number }) => void;
  private onCompleteCallback?: (result: { fileUrl: string; metadata: MediaMetadata }) => void;
  private onErrorCallback?: (err: Error) => void;

  constructor(fileOrOptions: File | ResumableUploadOptions, maybeKind?: UploadKind) {
    if (fileOrOptions instanceof File) {
      this.file = fileOrOptions;
      if (maybeKind) {
        this.kind = maybeKind;
      } else {
        const lower = fileOrOptions.name.toLowerCase();
        if (lower.endsWith('.pdf')) this.kind = 'pdf';
        else if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || fileOrOptions.type.startsWith('video/')) this.kind = 'video';
        else this.kind = 'image';
      }
    } else {
      this.file = fileOrOptions.file;
      if (fileOrOptions.kind) {
        this.kind = fileOrOptions.kind;
      } else {
        const lower = fileOrOptions.file.name.toLowerCase();
        if (lower.endsWith('.pdf')) this.kind = 'pdf';
        else if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || fileOrOptions.file.type.startsWith('video/')) this.kind = 'video';
        else this.kind = 'image';
      }
      this.onProgressCallback = fileOrOptions.onProgress;
      this.onCompleteCallback = fileOrOptions.onComplete;
      this.onErrorCallback = fileOrOptions.onError;
    }
  }

  public onProgress(cb: (progress: number) => void) {
    this.onProgressCallback = (p) => cb(p.percentage);
    return this;
  }

  public onComplete(cb: (result: { url: string; metadata: MediaMetadata }) => void) {
    this.onCompleteCallback = (res) => cb({ url: res.fileUrl, metadata: res.metadata });
    return this;
  }

  public onError(cb: (err: Error) => void) {
    this.onErrorCallback = cb;
    return this;
  }

  public abort(): void {
    this.pause();
  }

  public async start(): Promise<{ fileUrl: string; metadata: MediaMetadata }> {
    this.isPaused = false;

    // 1. Extract browser metadata
    try {
      this.metadata = await extractBrowserMediaMetadata(this.file, this.kind);
    } catch {}

    return new Promise<{ fileUrl: string; metadata: MediaMetadata }>((resolve, reject) => {
      const handleFinish = (fileUrl: string) => {
        const res = { fileUrl, metadata: this.metadata };
        this.onProgressCallback?.({ percentage: 100 });
        this.onCompleteCallback?.(res);
        resolve(res);
      };

      const handleFail = (err: Error) => {
        this.onErrorCallback?.(err);
        reject(err);
      };

      // Direct upload to local project uploads endpoint
      const formData = new FormData();
      formData.append('file', this.file);
      formData.append('kind', this.kind);

      // Sent with the httpOnly login cookie. If it has expired, renew it once and resend.
      let retriedAfterRefresh = false;
      const send = () => {
        this.xhr = new XMLHttpRequest();
        this.xhr.open('POST', '/api/uploads/file');
        this.xhr.withCredentials = true;

        this.xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && !this.isPaused) {
            const percent = Math.round((e.loaded / e.total) * 100);
            this.currentProgress = percent;
            this.onProgressCallback?.({ percentage: percent });
          }
        };

        this.xhr.onload = async () => {
          if (this.xhr && this.xhr.status === 401 && !retriedAfterRefresh) {
            retriedAfterRefresh = true;
            if (await refreshSession()) {
              send();
              return;
            }
          }
          if (this.xhr && this.xhr.status >= 200 && this.xhr.status < 300) {
            try {
              const resp = JSON.parse(this.xhr.responseText);
              const fileUrl = resp?.data?.url;
              if (!fileUrl) {
                throw new Error('Upload succeeded but no file URL was returned');
              }
              await this.recordMetadata(fileUrl);
              handleFinish(fileUrl);
            } catch (e: any) {
              handleFail(e);
            }
          } else {
            try {
              const errResp = JSON.parse(this.xhr?.responseText || '{}');
              handleFail(
                new Error(
                  errResp?.error?.message || errResp?.message || `Upload failed with HTTP status ${this.xhr?.status}`
                )
              );
            } catch {
              handleFail(new Error(`Upload failed with HTTP status ${this.xhr?.status}`));
            }
          }
        };

        this.xhr.onerror = () => {
          handleFail(new Error('Network error during upload'));
        };

        this.xhr.send(formData);
      };
      send();
    });
  }

  public pause(): void {
    this.isPaused = true;
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }
  }

  public resume(): void {
    if (this.isPaused) {
      this.start();
    }
  }

  public retry(): void {
    this.currentProgress = 0;
    this.start();
  }

  public get progress(): number {
    return this.currentProgress;
  }


  private async recordMetadata(url: string) {
    try {
      await apiFetch('/api/uploads/metadata', {
        method: 'POST',
        body: JSON.stringify({
          url,
          name: this.file.name,
          size: this.file.size,
          mime: this.file.type,
          width: this.metadata.width,
          height: this.metadata.height,
          duration: this.metadata.duration,
        }),
      });
    } catch {}
  }
}
