import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { ROLE_LABELS, UserRole } from '@mmp/shared';

export const UserMenuDropdown: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!user) return null;

  const displayName = user.preferredName || user.name || 'User';
  const roleDisplay = ROLE_LABELS[user.role as UserRole] || user.role?.replace('_', ' ') || 'Team Member';

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User navigation menu"
        className="flex items-center gap-2.5 p-1 rounded-full hover:bg-white/80 transition-all text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink min-h-[44px]"
      >
        <Avatar
          url={user.avatarUrl}
          name={user.name || 'User'}
          userId={user._id || (user as any).id}
          size="md"
        />

        <div className="hidden xl:flex flex-col text-left pr-1">
          <div className="text-xs font-bold text-ui-ink leading-tight flex items-center gap-1">
            <span className="truncate max-w-[130px]">{displayName}</span>
            <ChevronDown className={`w-3 h-3 text-ui-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </div>
          <div className="text-[10px] text-ui-muted leading-tight mt-0.5">
            {roleDisplay}
          </div>
        </div>
      </button>

      {/* Glassmorphic Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl shell-menu bg-white/95 border border-white/90 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Identity Header */}
          <div className="px-3 py-2.5 border-b border-ui-line">
            <p className="text-xs font-bold text-ui-ink truncate">{user.name}</p>
            <p className="text-[11px] text-ui-muted truncate mt-0.5">{user.email}</p>
            {/* Same neutral chip as the rest of the app (no role colour). */}
            <span className="status-chip status-not-started text-[11px] mt-1.5" data-testid="user-menu-role">
              {roleDisplay}
            </span>
          </div>

          {/* Navigation items: one style, muted icons. */}
          <div className="py-1 space-y-0.5" role="menu" aria-label="Account">
            {[
              { label: 'View profile', path: '/profile', Icon: User },
              { label: 'Settings', path: '/settings', Icon: Settings },
            ].map(({ label, path, Icon }) => (
              <button
                key={path}
                type="button"
                role="menuitem"
                onClick={() => handleNavigate(path)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ui-text hover:text-ui-ink hover:bg-slate-100/80 rounded-xl transition-colors text-left min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
              >
                <Icon className="w-4 h-4 text-ui-muted shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Sign out: red, like the sign-out button in the side menu. */}
          <div className="pt-1 border-t border-ui-line">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 rounded-xl transition-colors text-left min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

