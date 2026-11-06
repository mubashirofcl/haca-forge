import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  Volume2,
  VolumeX,
  Clock,
  Video,
} from 'lucide-react';

export interface VideoCommentAnchor {
  timecode: number;
}

export interface VideoCommentMarker {
  _id?: string;
  id?: string;
  seconds?: number;
  timecode?: number;
  text?: string;
  content?: string;
  authorName?: string;
  author?: {
    name?: string;
  };
  anchor?: {
    type?: string;
    timecode?: number;
  };
}

export interface VideoPlayerViewerProps {
  src?: string;
  videoUrl?: string;
  title?: string;
  comments?: any[];
  activeSecond?: number | null;
  activeCommentId?: string | null;
  onAddVideoComment?: (timecode: number, text: string) => void;
  onAddCommentAtSecond?: (sec: number) => void;
  onSelectComment?: (commentId: string) => void;
}

export const VideoPlayerViewer: React.FC<VideoPlayerViewerProps> = ({
  src,
  videoUrl,
  title,
  comments = [],
  activeSecond,
  activeCommentId,
  onAddVideoComment,
  onAddCommentAtSecond,
  onSelectComment,
}) => {
  const mediaSrc = src || videoUrl || '';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Jump to activeSecond when triggered externally
  useEffect(() => {
    if (activeSecond !== undefined && activeSecond !== null && videoRef.current) {
      videoRef.current.currentTime = activeSecond;
      setCurrentTime(activeSecond);
    }
  }, [activeSecond]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(time, duration));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const changeSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const currentSec = Math.round(currentTime);
    if (onAddVideoComment) {
      onAddVideoComment(currentSec, newCommentText.trim());
    } else if (onAddCommentAtSecond) {
      onAddCommentAtSecond(currentSec);
    }
    setNewCommentText('');
    setIsAddingComment(false);
  };

  // Extract markers with timecode
  const commentMarkers = comments.map((c) => {
    const sec = c.seconds ?? c.timecode ?? c.anchor?.seconds ?? c.anchor?.timecode ?? 0;
    const id = c._id || c.id || Math.random().toString();
    const text = c.text || c.content || '';
    const author = c.authorName || (typeof c.author === 'string' ? c.author : c.author?.name) || 'Reviewer';
    return { id, sec, text, author };
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-neutral-950 rounded-xl overflow-hidden border border-white/10 relative select-none"
    >
      {/* Top Header */}
      {title && (
        <div className="px-4 py-2 bg-neutral-900 border-b border-white/10 flex items-center justify-between gap-2 text-xs text-neutral-200">
          <span className="font-semibold flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5" aria-hidden="true" />
            {title}
          </span>
          <span className="font-mono text-neutral-300">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Main Video Viewport */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden group">
        {mediaSrc ? (
          <video
            ref={videoRef}
            src={mediaSrc}
            className="max-h-full max-w-full object-contain cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            onClick={togglePlay}
            // Keyboard path for click-to-play: Enter or Space toggles playback.
            role="button"
            tabIndex={0}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePlay();
              }
            }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
        ) : (
          <div className="text-center text-neutral-300 text-xs p-6">
            <Video className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No video source attached.</p>
          </div>
        )}

        {/* Quick Add Comment Overlay */}
        {isAddingComment && (
          <div className="absolute z-30 p-3 rounded-2xl bg-neutral-900 border border-white/20 max-w-md w-full mx-4">
            <div className="flex items-center justify-between text-xs text-white mb-2 font-medium">
              <span className="flex items-center gap-1 text-amber-400 font-mono">
                <Clock className="w-3.5 h-3.5" /> Stamp at {formatTime(currentTime)}
              </span>
              <button
                type="button"
                onClick={() => setIsAddingComment(false)}
                aria-label="Close"
                className="min-w-[44px] min-h-[44px] -m-3 flex items-center justify-center text-neutral-300 hover:text-white rounded-full"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateComment} className="flex flex-col gap-2">
              <textarea
                autoFocus
                rows={2}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="What should be adjusted at this second?"
                aria-label="Comment at this second"
                className="w-full text-xs p-2.5 rounded-lg bg-neutral-950 border border-white/10 text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-white/60"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingComment(false)}
                  className="min-h-[44px] px-3 text-xs text-neutral-300 hover:text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="min-h-[44px] px-3 text-xs font-semibold rounded-lg bg-white hover:bg-neutral-200 text-neutral-950 disabled:opacity-40"
                >
                  Pin Comment
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Custom Bottom Player Controls */}
      <div className="bg-neutral-900 border-t border-white/10 px-3 pb-2 flex flex-col gap-1 z-20">
        {/* Timeline Seek Bar with Comment Pins */}
        <div className="relative w-full h-11 flex items-center group/timeline">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            className="ui-media-range w-full h-11 bg-transparent cursor-pointer"
          />

          {/* Comment Timeline Pins */}
          {commentMarkers.map((c) => {
            const leftPercent =
              duration > 0
                ? Math.min(100, Math.max(0, (c.sec / duration) * 100))
                : Math.min(100, Math.max(0, (c.sec / 60) * 100));
            const isActive = activeCommentId === c.id;
            return (
              <button
                type="button"
                key={c.id}
                aria-label={`Comment by ${c.author} at ${formatTime(c.sec)}: ${c.text}`}
                aria-pressed={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  seek(c.sec);
                  onSelectComment?.(c.id);
                }}
                style={{ left: `${leftPercent}%` }}
                title={`${c.author} at ${c.sec}s: ${c.text}`}
                // 24px hit area (WCAG minimum) around the unchanged 10px marker; 44px would overlap the
                // seek bar and neighbouring markers. The "Timecoded comments" list below is the 44px path.
                className="absolute -translate-x-1/2 w-6 h-6 flex items-center justify-center rounded-full z-10 group/marker"
              >
                <span
                  aria-hidden="true"
                  className={`w-2.5 h-2.5 rounded-full shadow-md transition-transform motion-safe:group-hover/marker:scale-150 ${
                    isActive
                      ? 'bg-amber-400 ring-2 ring-amber-400/50 scale-125'
                      : 'bg-white group-hover/marker:bg-amber-300'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-1 text-neutral-200 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={togglePlay}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => seek(currentTime - 5)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-200 hover:text-white"
              title="Seek -5s (J)"
              aria-label="Back 5 seconds"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => seek(currentTime + 5)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-200 hover:text-white"
              title="Seek +5s (L)"
              aria-label="Forward 5 seconds"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] text-neutral-300 ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {/* Stamp comment at second. Only offered to someone who can post a comment. */}
            {(onAddVideoComment || onAddCommentAtSecond) && (
              <button
                type="button"
                onClick={() => {
                  videoRef.current?.pause();
                  setIsPlaying(false);
                  setIsAddingComment(true);
                }}
                className="min-h-[44px] px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1 transition-colors"
              >
                <Clock className="w-3 h-3" aria-hidden="true" />
                Comment @ {formatTime(currentTime)}
              </button>
            )}

            {/* Playback speed selector */}
            <div className="flex items-center bg-neutral-950 rounded-lg border border-white/10" role="group" aria-label="Playback speed">
              {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={playbackRate === rate}
                  onClick={() => changeSpeed(rate)}
                  className={`min-h-[44px] min-w-[44px] px-1 rounded-lg text-[11px] font-mono transition-colors ${
                    playbackRate === rate ? 'bg-white text-neutral-950 font-bold' : 'text-neutral-200 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-200 hover:text-white"
              title={isMuted ? 'Unmute' : 'Mute'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-200 hover:text-white"
              title="Fullscreen"
              aria-label="Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Keyboard / 44px equivalent for the small timeline markers */}
        {commentMarkers.length > 0 && (
          <details className="text-xs text-neutral-200">
            <summary className="min-h-[44px] flex items-center px-1 cursor-pointer rounded-lg hover:text-white">
              Timecoded comments ({commentMarkers.length})
            </summary>
            <ul className="flex flex-wrap gap-1 pb-1">
              {commentMarkers.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      seek(c.sec);
                      onSelectComment?.(c.id);
                    }}
                    aria-pressed={activeCommentId === c.id}
                    className={`min-h-[44px] px-3 rounded-lg font-mono text-[11px] border transition-colors ${
                      activeCommentId === c.id ? 'bg-white text-neutral-950 border-white' : 'border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {formatTime(c.sec)} · {c.author}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
};
