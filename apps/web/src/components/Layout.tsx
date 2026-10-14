import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  HelpCircle,
  Bell,
  Search,
  LogOut,
  Sparkles,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Top navigation tabs per role
  const topNavTabs = [
    {
      label: 'Pipelines',
      path: user?.role === 'admin' ? '/admin' : user?.role === 'lead' ? '/lead' : user?.role === 'worker' ? '/worker' : '/requester',
      show: true,
      activeMatcher: (p: string) => ['/admin', '/lead', '/worker', '/requester', '/'].includes(p),
    },
    {
      label: 'Access Requests',
      path: '/admin/access-requests',
      show: hasPermission('user.approve'),
      activeMatcher: (p: string) => p.startsWith('/admin/access-requests'),
    },
    {
      label: 'Staff & Roles',
      path: '/admin/users',
      show: hasPermission('user.manage'),
      activeMatcher: (p: string) => p.startsWith('/admin/users'),
    },
    {
      label: 'Reports & Analytics',
      path: '/reports',
      show: hasPermission('report.view'),
      activeMatcher: (p: string) => p.startsWith('/reports'),
    },
  ];

  // Left sidebar icons
  const sidebarItems = [
    {
      id: 'dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: user?.role === 'admin' ? '/admin' : user?.role === 'lead' ? '/lead' : user?.role === 'worker' ? '/worker' : '/requester',
      active: ['/admin', '/lead', '/worker', '/requester', '/'].includes(location.pathname),
    },
    {
      id: 'access',
      icon: ShieldCheck,
      label: 'Access Requests',
      path: '/admin/access-requests',
      active: location.pathname.startsWith('/admin/access-requests'),
      show: hasPermission('user.approve'),
    },
    {
      id: 'users',
      icon: Users,
      label: 'Users & Roles',
      path: '/admin/users',
      active: location.pathname.startsWith('/admin/users'),
      show: hasPermission('user.manage'),
    },
    {
      id: 'reports',
      icon: BarChart3,
      label: 'Analytics',
      path: '/reports',
      active: location.pathname.startsWith('/reports'),
      show: hasPermission('report.view'),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col text-slate-800">
      {/* 1. Top Navigation Bar (64px) */}
      <header className="sticky top-0 z-40 h-16 glass-panel border-b border-white/80 transition-all">
        <div className="max-w-[1520px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7a6af6] to-[#4f46e5] flex items-center justify-center shadow-md shadow-[#7a6af6]/25 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
                  Antigravity <span className="font-medium text-xs px-2 py-0.5 rounded-full bg-slate-900 text-white">v1.0</span>
                </span>
                <span className="block text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                  Marketing Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Capsule Tab Switcher */}
          <nav className="hidden md:flex items-center p-1 glass-pill-container border border-white/90">
            {topNavTabs
              .filter((tab) => tab.show)
              .map((tab) => {
                const isActive = tab.activeMatcher(location.pathname);
                return (
                  <Link
                    key={tab.label}
                    to={tab.path}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                      isActive
                        ? 'pill-active'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
          </nav>

          {/* Right: Actions, Search, Notifications, Avatar */}
          <div className="flex items-center gap-3">
            {/* Search Pill */}
            <button
              onClick={() => setShowSearchModal(true)}
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 hover:bg-white border border-white/90 text-xs text-slate-500 shadow-sm transition-all"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search cases & requests...</span>
              <kbd className="hidden lg:inline text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                ⌘K
              </kbd>
            </button>

            {/* Notification Bell */}
            <button
              title="Notifications"
              className="relative p-2 rounded-full bg-white/70 hover:bg-white border border-white/90 text-slate-600 shadow-sm transition-all"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#7a6af6] ring-2 ring-white"></span>
            </button>

            {/* User Avatar & Menu */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-300/60">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-sm">
                  {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
              </div>

              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {user?.name || 'Administrator'}
                </div>
                <div className="text-[10px] text-slate-500 capitalize leading-tight mt-0.5">
                  {user?.role?.replace('_', ' ') || 'admin'}
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50/60 rounded-full transition-colors ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Body with Fixed Left Icon Sidebar (72px) & Content Area */}
      <div className="flex-1 max-w-[1520px] w-full mx-auto px-4 sm:px-6 flex gap-6 pt-6 pb-12">
        {/* Fixed Left Sidebar (72px) */}
        <aside className="hidden lg:flex flex-col justify-between items-center w-[72px] py-6 px-2 glass-panel rounded-[24px] border border-white/80 self-start sticky top-24 min-h-[calc(100vh-120px)] shadow-glass">
          {/* Top module items */}
          <div className="flex flex-col items-center gap-4 w-full">
            {sidebarItems
              .filter((item) => item.show !== false)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    title={item.label}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      item.active
                        ? 'bg-[#0d0e12] text-white shadow-md shadow-[#0d0e12]/20'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                );
              })}
          </div>

          {/* Bottom helper icons */}
          <div className="flex flex-col items-center gap-3 w-full border-t border-slate-200/80 pt-4">
            <button
              title="Settings"
              className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 flex items-center justify-center transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              title="Help & Guides"
              className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 flex items-center justify-center transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* 3. Main Dynamic Content Container */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* Global Quick Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/30 backdrop-blur-md animate-in fade-in">
          <div className="glass-modal max-w-lg w-full p-4 shadow-modal-glass border border-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Type to search workflows, cases, tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] transition-all"
              />
            </div>
            <div className="p-3 text-[11px] text-slate-400 flex justify-between items-center mt-2">
              <span>Press ESC to close</span>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
