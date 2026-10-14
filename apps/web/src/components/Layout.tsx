import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  HelpCircle,
  Bell,
  Search,
  LogOut,
  ShieldCheck,
  Users,
  Building2,
  Layers,
  FileText,
  Inbox,
  Send,
  ExternalLink,
  Film,
  Calendar,
  Video,
  Clock,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Fetch Notifications
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?limit=8');
      if (!res.ok) return { data: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 15000,
  });

  const notifications = notificationsData?.data || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications/read-all', { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Top navigation tabs per role
  const topNavTabs = [
    {
      label: 'Pipelines',
      path: user?.role === 'admin' ? '/admin' : user?.role === 'lead' ? '/lead' : user?.role === 'worker' ? '/worker' : '/requester',
      show: true,
      activeMatcher: (p: string) => ['/admin', '/lead', '/worker', '/'].includes(p),
    },
    {
      label: 'Content Hub',
      path: '/lead/content',
      show: ['admin', 'lead'].includes(user?.role || ''),
      activeMatcher: (p: string) => p.startsWith('/lead/content'),
    },
    {
      label: 'Content Calendar',
      path: '/calendar',
      show: ['admin', 'lead', 'sm_manager'].includes(user?.role || ''),
      activeMatcher: (p: string) => p.startsWith('/calendar') || p.startsWith('/sm'),
    },
    {
      label: 'Shoot Planner',
      path: '/shoots',
      show: ['admin', 'lead', 'team_lead', 'worker'].includes(user?.role || ''),
      activeMatcher: (p: string) => p.startsWith('/shoots'),
    },
    {
      label: 'Team Ops',
      path: '/teams',
      show: ['admin', 'lead', 'team_lead'].includes(user?.role || ''),
      activeMatcher: (p: string) => p.startsWith('/teams') && !p.startsWith('/admin/teams-departments'),
    },
    {
      label: 'Timesheets',
      path: '/timesheets',
      show: ['admin', 'lead', 'team_lead', 'worker'].includes(user?.role || ''),
      activeMatcher: (p: string) => p.startsWith('/timesheets'),
    },
    {
      label: 'Triage Inbox',
      path: '/lead/inbox',
      show: hasPermission('request.triage'),
      activeMatcher: (p: string) => p.startsWith('/lead/inbox'),
    },
    {
      label: 'Requests Portal',
      path: '/requester',
      show: true,
      activeMatcher: (p: string) => p.startsWith('/requester'),
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
      label: 'Teams & Depts',
      path: '/admin/teams-departments',
      show: hasPermission('settings.manage'),
      activeMatcher: (p: string) => p.startsWith('/admin/teams-departments'),
    },
    {
      label: 'Master Data',
      path: '/admin/master-data',
      show: hasPermission('settings.manage'),
      activeMatcher: (p: string) => p.startsWith('/admin/master-data'),
    },
    {
      label: 'Audit Log',
      path: '/admin/audit-log',
      show: hasPermission('audit.view'),
      activeMatcher: (p: string) => p.startsWith('/admin/audit-log'),
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
      label: 'Pipelines',
      path: user?.role === 'admin' ? '/admin' : user?.role === 'lead' ? '/lead' : user?.role === 'worker' ? '/worker' : '/requester',
      active: ['/admin', '/lead', '/worker', '/'].includes(location.pathname),
    },
    {
      id: 'content',
      icon: Film,
      label: 'Content Hub',
      path: '/lead/content',
      active: location.pathname.startsWith('/lead/content'),
      show: ['admin', 'lead'].includes(user?.role || ''),
    },
    {
      id: 'calendar',
      icon: Calendar,
      label: 'Content Calendar',
      path: '/calendar',
      active: location.pathname.startsWith('/calendar') || location.pathname.startsWith('/sm'),
      show: ['admin', 'lead', 'sm_manager'].includes(user?.role || ''),
    },
    {
      id: 'shoots',
      icon: Video,
      label: 'Shoot Planner',
      path: '/shoots',
      active: location.pathname.startsWith('/shoots'),
      show: ['admin', 'lead', 'team_lead', 'worker'].includes(user?.role || ''),
    },
    {
      id: 'team-ops',
      icon: Users,
      label: 'Team Operations',
      path: '/teams',
      active: location.pathname.startsWith('/teams') && !location.pathname.startsWith('/admin/teams-departments'),
      show: ['admin', 'lead', 'team_lead'].includes(user?.role || ''),
    },
    {
      id: 'timesheets',
      icon: Clock,
      label: 'Timesheets',
      path: '/timesheets',
      active: location.pathname.startsWith('/timesheets'),
      show: ['admin', 'lead', 'team_lead', 'worker'].includes(user?.role || ''),
    },
    {
      id: 'triage',
      icon: Inbox,
      label: 'Triage Inbox',
      path: '/lead/inbox',
      active: location.pathname.startsWith('/lead/inbox'),
      show: hasPermission('request.triage'),
    },
    {
      id: 'requests',
      icon: Send,
      label: 'Requests Portal',
      path: '/requester',
      active: location.pathname.startsWith('/requester'),
      show: true,
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
      id: 'teams',
      icon: Building2,
      label: 'Teams & Departments',
      path: '/admin/teams-departments',
      active: location.pathname.startsWith('/admin/teams-departments'),
      show: hasPermission('settings.manage'),
    },
    {
      id: 'master-data',
      icon: Layers,
      label: 'Master Data',
      path: '/admin/master-data',
      active: location.pathname.startsWith('/admin/master-data'),
      show: hasPermission('settings.manage'),
    },
    {
      id: 'audit',
      icon: FileText,
      label: 'Audit Log',
      path: '/admin/audit-log',
      active: location.pathname.startsWith('/admin/audit-log'),
      show: hasPermission('audit.view'),
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
          <div className="flex items-center">
            <Link to="/" className="flex items-center group" title="HACA FORGE">
              <img
                src="/haca-forge-logo.png"
                alt="HACA FORGE"
                className="h-6 md:h-6.5 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              />
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
            <div className="relative">
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                title="Notifications"
                className="relative p-2 rounded-full bg-white/70 hover:bg-white border border-white/90 text-slate-600 shadow-sm transition-all"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[9px] font-extrabold bg-[#7a6af6] text-white rounded-full ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl glass-panel border border-white shadow-2xl p-4 bg-white/95 z-50 animate-in fade-in slide-in-from-top-2 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#7a6af6]/10 text-[#7a6af6]">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-[11px] font-semibold text-[#7a6af6] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 my-2">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">No notifications yet.</div>
                    ) : (
                      notifications.map((n: any) => (
                        <div
                          key={n._id}
                          className={`py-2.5 px-1 space-y-1 transition-colors ${
                            !n.read ? 'bg-indigo-50/40 rounded-xl' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <strong className="text-slate-800 text-xs">{n.title}</strong>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px]">{n.message}</p>
                          {n.link && (
                            <Link
                              to={n.link}
                              onClick={() => setShowNotifications(false)}
                              className="text-[10px] font-bold text-[#7a6af6] flex items-center gap-1 hover:underline mt-1"
                            >
                              <span>Open request</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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
            <Link
              to="/admin/settings"
              title="System Settings"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                location.pathname.startsWith('/admin/settings')
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'
              }`}
            >
              <Settings className="w-4 h-4" />
            </Link>
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
