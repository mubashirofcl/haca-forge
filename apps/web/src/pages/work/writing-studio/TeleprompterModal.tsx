import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, X, FlipHorizontal, Type, FastForward } from 'lucide-react';

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  scriptHtml: string;
}

export const TeleprompterModal: React.FC<TeleprompterModalProps> = ({
  isOpen,
  onClose,
  title,
  scriptHtml,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // pixels per frame
  const [fontSize, setFontSize] = useState(36); // px
  const [isMirrored, setIsMirrored] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowUp') {
        setSpeed((prev) => Math.min(8, prev + 0.5));
      } else if (e.key === 'ArrowDown') {
        setSpeed((prev) => Math.max(0.5, prev - 0.5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isPlaying) {
      const scrollStep = () => {
        if (containerRef.current) {
          containerRef.current.scrollTop += speed;
        }
        animFrameRef.current = requestAnimationFrame(scrollStep);
      };
      animFrameRef.current = requestAnimationFrame(scrollStep);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, speed]);

  if (!isOpen) return null;

  const handleReset = () => {
    setIsPlaying(false);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col text-white select-none">
      {/* Top Floating Control Bar */}
      <div className="h-14 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-yellow-400">Teleprompter</span>
          <span className="text-xs font-bold text-zinc-300 truncate max-w-xs">{title}</span>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
              isPlaying ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black hover:bg-emerald-400'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            title="Reset to top"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed slider */}
          <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-xl text-xs">
            <FastForward className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-bold text-zinc-300">{speed}x</span>
            <input
              type="range"
              min="0.5"
              max="6"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-16 h-1 bg-zinc-600 rounded-lg cursor-pointer"
            />
          </div>

          {/* Font Size slider */}
          <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1 rounded-xl text-xs">
            <Type className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-bold text-zinc-300">{fontSize}px</span>
            <input
              type="range"
              min="24"
              max="64"
              step="4"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="w-16 h-1 bg-zinc-600 rounded-lg cursor-pointer"
            />
          </div>

          {/* Mirror Toggle */}
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-1.5 rounded-lg transition-colors ${
              isMirrored ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            title="Mirror Mode (for prompter glass)"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
          title="Exit Teleprompter (ESC)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Prompter Canvas */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto px-8 md:px-32 py-24 text-center teleprompter-canvas ${
          isMirrored ? 'scale-x-[-1]' : ''
        }`}
        style={{ fontSize: `${fontSize}px` }}
      >
        <div
          className="max-w-4xl mx-auto font-medium tracking-wide leading-relaxed space-y-8"
          dangerouslySetInnerHTML={{ __html: scriptHtml }}
        />
        {/* Generous bottom spacing so end of script scrolls into eye line */}
        <div className="h-[60vh]" />
      </div>
    </div>
  );
};
