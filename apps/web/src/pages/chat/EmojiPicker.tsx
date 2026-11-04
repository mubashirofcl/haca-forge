import { useState } from 'react';
import { CHAT_REACTION_EMOJIS, ChatReactionEmoji } from '@mmp/shared';

export const BUILT_IN_EMOJI_CATEGORIES = [
  {
    name: 'Smileys & Emotion',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😎', '🥳', '😏', '🤔', '🤫', '🫡', '🤐', '😮', '😯', '😲', '😴', '🤤', '😷', '🤯'],
  },
  {
    name: 'Gestures & Reactions',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '👊', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '👈', '👉', '👆', '👇', '✋', '👋', '🙏', '💪', '👀', '👁️'],
  },
  {
    name: 'Hearts & Sparks',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '✨', '⭐', '🌟', '💥', '🎉', '🎊'],
  },
  {
    name: 'Work & Objects',
    emojis: ['🔥', '🚀', '🎯', '💯', '✅', '☑️', '✔️', '❌', '⏳', '⏰', '📌', '📎', '📁', '📄', '📊', '📈', '💡', '🎨', '🎬', '📷', '📱', '💻', '☕'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div
      className="absolute bottom-14 right-2 sm:right-6 w-72 sm:w-80 glass-modal bg-white/95 border border-slate-200/80 shadow-2xl rounded-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
      data-testid="chat-emoji-picker"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Emojis</span>
        <button
          onClick={onClose}
          type="button"
          className="text-xs text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded-md hover:bg-slate-100 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1 text-xs">
        {BUILT_IN_EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveCategory(idx)}
            className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === idx
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="h-44 overflow-y-auto grid grid-cols-7 gap-1 p-1">
        {BUILT_IN_EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100/90 rounded-lg hover:scale-110 active:scale-95 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

interface QuickReactionsProps {
  onReact: (emoji: ChatReactionEmoji) => void;
  onClose: () => void;
  currentReactions?: ChatReactionEmoji[];
}

export function QuickReactionsBar({ onReact, onClose, currentReactions = [] }: QuickReactionsProps) {
  return (
    <div
      className="flex items-center gap-1 bg-white/95 border border-slate-200/80 shadow-xl rounded-full px-2 py-1 z-40 backdrop-blur-md animate-in fade-in duration-100"
      data-testid="chat-quick-reactions"
    >
      {CHAT_REACTION_EMOJIS.map((emoji) => {
        const isSelected = currentReactions.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onReact(emoji);
              onClose();
            }}
            className={`w-7 h-7 flex items-center justify-center text-base rounded-full hover:scale-125 transition-transform ${
              isSelected ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'hover:bg-slate-100'
            }`}
            title={emoji}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

