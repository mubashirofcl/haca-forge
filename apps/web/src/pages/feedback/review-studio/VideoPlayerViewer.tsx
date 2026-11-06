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
      className="flex-1 flex flex-col h-full bg-slate-950 rounded-xl overflow-hidden border border-white/10 relative select-none"
    >
      {/* Top Header */}
      {title && (
        <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between text-xs text-slate-300">
          <span className="font-semibold flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-indigo-400" />
            {title}
          </span>
          <span className="font-mono text-slate-400">
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
            className="max-h-full max-w-full object-contain cursor-pointer"
            onClick={togglePlay}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
        ) : (
          <div className="text-center text-slate-500 text-xs p-6">
            <Video className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No video source attached.</p>
          </div>
        )}

        {/* Quick Add Comment Overlay */}
        {isAddingComment && (
          <div className="absolute z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-white/20 shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between text-xs text-white mb-2 font-medium">
              <span className="flex items-center gap-1 text-amber-400 font-mono">
                <Clock className="w-3.5 h-3.5" /> Stamp at {formatTime(currentTime)}
              </span>
              <button
                type="button"
                onClick={() => setIsAddingComment(false)}
                className="text-slate-400 hover:text-white"
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
                className="w-full text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingComment(false)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                >
                  Pin Comment
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Custom Bottom Player Controls */}
      <div className="bg-slate-900/95 backdrop-blur-md border-t border-white/10 p-3 flex flex-col gap-2 z-20">
        {/* Timeline Seek Bar with Comment Pins */}
        <div className="relative w-full h-4 flex items-center group/timeline cursor-pointer">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all"
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
                key={c.id}
                onClick={(e) => {
                  e.stopPropagation();
                  seek(c.sec);
                  onSelectComment?.(c.id);
                }}
                style={{ left: `${leftPercent}%` }}
                title={`${c.author} at ${c.sec}s: ${c.text}`}
                className={`absolute -translate-x-1/2 w-2.5 h-2.5 rounded-full shadow-md transition-transform hover:scale-150 z-10 ${
                  isActive
                    ? 'bg-amber-400 ring-2 ring-amber-400/50 scale-125'
                    : 'bg-indigo-400 hover:bg-amber-300'
                }`}
              />
            );
          })}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between text-slate-300 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={() => seek(currentTime - 5)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              title="Seek -5s (J)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => seek(currentTime + 5)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              title="Seek +5s (L)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] text-slate-400 ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Stamp comment at second */}
            {(onAddVideoComment || onAddCommentAtSecond) && (
              <button
                onClick={() => {
                  videoRef.current?.pause();
                  setIsPlaying(false);
                  setIsAddingComment(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white font-medium text-[11px] flex items-center gap-1 transition-colors"
              >
                <Clock className="w-3 h-3" />
                Comment @ {formatTime(currentTime)}
              </button>
            )}

            {/* Playback speed selector */}
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-white/10">
              {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => changeSpeed(rate)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                    playbackRate === rate ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Audio Toggle */}
            <button
              onClick={toggleMute}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title="Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
