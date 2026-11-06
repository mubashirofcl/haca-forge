import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Clock,
  ChevronLeft,
  ChevronRight,
  Repeat,
} from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  thumbnailUrl?: string;
  onReferenceMoment?: (timestampFormatted: string, seconds: number) => void;
  seekToSeconds?: number | null;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  thumbnailUrl,
  onReferenceMoment,
  seekToSeconds,
  onTimeUpdate,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Seek when seekToSeconds changes
  useEffect(() => {
    if (seekToSeconds != null && videoRef.current) {
      videoRef.current.currentTime = seekToSeconds;
      setCurrentTime(seekToSeconds);
      if (!isPlaying) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }, [seekToSeconds]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const stepFrame = (forward = true) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    // Assume ~25-30fps -> ~0.04s step
    const step = 0.04;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(duration, videoRef.current.currentTime + (forward ? step : -step))
    );
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);
    if (onTimeUpdate) onTimeUpdate(cur);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    videoRef.current.muted = next;
    setIsMuted(next);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const total = Math.max(0, Math.floor(secs));
    const mins = Math.floor(total / 60);
    const rem = total % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleReferenceClick = () => {
    if (!onReferenceMoment) return;
    const formatted = `at ${formatTime(currentTime)}`;
    onReferenceMoment(formatted, Math.round(currentTime));
  };

  const isImage = Boolean(
    url && (
      url.match(/\.(jpg|jpeg|png|webp|gif|svg|avif)$/i) ||
      url.startsWith('data:image/')
    )
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-neutral-950 rounded-2xl overflow-hidden border border-white/10 ${className}`}
    >
      {/* Video / Image display */}
      <div
        className="relative flex-1 bg-black flex items-center justify-center cursor-pointer min-h-[240px] max-h-[500px] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-4"
        onClick={isImage ? undefined : togglePlay}
        // Keyboard path for click-to-play: Enter or Space toggles playback (same handler as a click).
        {...(isImage
          ? {}
          : {
              role: 'button',
              tabIndex: 0,
              'aria-label': isPlaying ? 'Pause video' : 'Play video',
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  togglePlay();
                }
              },
            })}
      >
        {isImage ? (
          <img
            src={url}
            alt="Footage asset"
            className="w-full h-full max-h-[500px] object-contain select-none"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              src={url}
              poster={thumbnailUrl}
              playsInline
              loop={isLooping}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full max-h-[500px] object-contain"
            />

            {/* Big play overlay if paused */}
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white" aria-hidden="true">
                  <Play className="w-8 h-8 fill-white ml-1" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Scrubber progress bar for video only */}
      {!isImage && (
        <div className="px-4 pt-1 bg-neutral-900">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.01"
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) {
                videoRef.current.currentTime = val;
              }
            }}
            aria-label="Seek"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            className="ui-media-range w-full h-11 bg-transparent cursor-pointer"
          />
        </div>
      )}

      {/* Control bar */}
      <div className="px-4 py-2 bg-neutral-900 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-neutral-300 text-xs">
        {isImage ? (
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20 text-[11px] font-semibold">
              Photo / Still Asset
            </span>
          </div>
        ) : (
          /* Left: Playback & Frame stepping */
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            {/* Frame stepping */}
            <button
              type="button"
              onClick={() => stepFrame(false)}
              title="Step backward 1 frame"
              aria-label="Step backward 1 frame"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => stepFrame(true)}
              title="Step forward 1 frame"
              aria-label="Step forward 1 frame"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Timestamp */}
            <span className="font-mono text-[11px] text-neutral-300 ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Center: Reference this moment button */}
        {onReferenceMoment && (
          <button
            type="button"
            onClick={handleReferenceClick}
            className="min-h-[44px] px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium flex items-center gap-1.5 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isImage ? 'Reference in thread' : `Reference this moment (${formatTime(currentTime)})`}</span>
          </button>
        )}

        {/* Right: Loop, Speed, Audio, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
          {/* Loop toggle */}
          <button
            type="button"
            onClick={() => setIsLooping(!isLooping)}
            title="Toggle Loop"
            aria-label="Loop"
            aria-pressed={isLooping}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${
              isLooping ? 'bg-white text-neutral-950' : 'hover:bg-white/10 text-neutral-300'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Speed selector */}
          <div className="relative flex items-center">
            <select
              value={playbackRate}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              aria-label="Playback speed"
              className="min-h-[44px] bg-white/10 text-white border border-white/20 rounded-lg px-2 text-xs font-medium cursor-pointer hover:bg-white/15 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <option value="0.5" className="bg-neutral-900">0.5x</option>
              <option value="1" className="bg-neutral-900">1x</option>
              <option value="1.25" className="bg-neutral-900">1.25x</option>
              <option value="1.5" className="bg-neutral-900">1.5x</option>
              <option value="2" className="bg-neutral-900">2x</option>
            </select>
          </div>

          {/* Volume toggle */}
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Fullscreen"
            aria-label="Fullscreen"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
