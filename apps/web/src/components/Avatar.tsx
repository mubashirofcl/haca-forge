import React, { useState } from 'react';

export interface AvatarProps {
  url?: string | null;
  name?: string;
  userId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

// Accessible gradient palette deterministically selected by user ID / name
const AVATAR_GRADIENTS = [
  'from-indigo-600 to-purple-800',
  'from-blue-600 to-indigo-900',
  'from-violet-600 to-purple-900',
  'from-teal-600 to-emerald-900',
  'from-amber-600 to-orange-800',
  'from-rose-600 to-pink-900',
  'from-slate-700 to-slate-900',
];

function getGradient(identifier: string = ''): string {
  if (!identifier) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function getInitials(name: string = ''): string {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_MAP = {
  xs: {
    container: 'w-5 h-5 min-w-[20px] text-[10px]',
    text: 'text-[9px] font-bold',
  },
  sm: {
    container: 'w-7 h-7 min-w-[28px] text-xs',
    text: 'text-[11px] font-bold',
  },
  md: {
    container: 'w-10 h-10 min-w-[40px] text-xs',
    text: 'text-xs font-bold',
  },
  lg: {
    container: 'w-12 h-12 min-w-[48px] text-sm',
    text: 'text-sm font-extrabold',
  },
  xl: {
    container: 'w-20 h-20 min-w-[80px] text-2xl',
    text: 'text-2xl font-black',
  },
};

export const Avatar: React.FC<AvatarProps> = ({
  url,
  name = 'User',
  userId,
  size = 'md',
  className = '',
  alt,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  const initials = getInitials(name);
  const gradient = getGradient(userId || name);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  const showImage = Boolean(url && !imageFailed);

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden ring-1 ring-white/80 shadow-sm ${sizeConfig.container} ${className}`}
      title={name}
      aria-label={alt || name}
    >
      {showImage ? (
        <img
          src={url!}
          alt={alt || name}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-tr ${gradient} text-white flex items-center justify-center tracking-tight ${sizeConfig.text}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
};

