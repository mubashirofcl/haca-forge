import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  HelpCircle,
  Search,
  LogOut,
  ShieldCheck,
  Users,
  FileText,
  Film,
  Calendar,
  CheckSquare,
  ChevronDown,
  Menu,
  X,
  AlertCircle,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { NotificationCenter } from './NotificationCenter';
import { NotificationToastContainer } from './NotificationToast';
import { UserMenuDropdown } from './UserMenuDropdown';
import { Avatar } from './Avatar';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: React.ElementType;
  show: boolean;
  badge?: number;
  activeMatcher: (pathname: string) => boolean;
}

interface NavCategory {
  id: string;
  label: string;
  items: NavItem[];
}

interface SidebarItem {
  id: string;
  icon: React.ElementType;
  label: string;
  path: string;
  active: boolean;
  show?: boolean;
  badge?: number;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ channels: Array<{ unreadCount?: number }> }>('/api/chat/channels')
      .then((res) => {
        const total = (res.channels || []).reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setChatUnreadCount(total);
      })
      .catch(() => {});
  }, [user, location.pathname]);

  const navRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close dropdowns on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
        setShowSearchModal(false);
        setShowMobileMenu(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close menus on page route change
  useEffect(() => {
    setOpenDropdown(null);
    setShowMobileMenu(false);
  }, [location.pathname]);

  // Role flags
  const role = user?.role;
  const isTeamMember = role === 'team_member';
  const isSmManager = role === 'sm_manager';
  const isCreativeHead = role === 'creative_head';
  const isAdmin = role === 'admin';

  // Pending Access Requests Count Badge for Admin
  const [pendingAccessCount, setPendingAccessCount] = useState<number>(0);
  useEffect(() => {
    if (isAdmin) {
      apiFetch<{ data: any[] }>('/admin/access-requests?status=pending')
        .then((res) => {
          setPendingAccessCount(res.data?.length || 0);
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  // Landing page path and label
  const landingPath = isTeamMember ? '/my-work' : '/dashboard';
  const landingLabel = isTeamMember ? 'My Work' : 'Dashboard';
  const isLandingActive = isTeamMember
    ? (location.pathname.startsWith('/my-work') || location.pathname === '/')
    : (['/dashboard', '/'].includes(location.pathname));

  // Role-specific Navigation Categories
  const navCategories: NavCategory[] = useMemo(() => {
    if (isTeamMember) {
      return [
        {
          id: 'workspace',
          label: 'Planning',
          items: [
            {
              id: 'my-work',
              label: 'My Work',
              path: '/my-work',
              description: 'Personal stage assignments, deliverables & submissions',
              icon: CheckSquare,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/my-work') || p === '/' || p.startsWith('/todo'),
            },
            {
              id: 'calendar',
              label: 'Creative Calendar',
              path: '/calendar',
              description: 'Own scheduled deliverables & deadlines',
              icon: Calendar,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/calendar'),
            },
            {
              id: 'notifications',
              label: 'Notifications',
              path: '/notifications',
              description: 'System alerts and assignments',
              icon: Bell,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/notifications'),
            },
          ],
        },
      ];
    }

    if (isSmManager) {
      return [
        {
          id: 'schedule',
          label: 'Schedule',
          items: [
            {
              id: 'my-work',
              label: 'My Work',
              path: '/my-work',
              description: 'Personal assignments, posting deliverables & publishing tasks',
              icon: CheckSquare,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/my-work') || p.startsWith('/todo'),
            },
            {
              id: 'calendar',
              label: 'Creative Calendar',
              path: '/calendar',
              description: 'Creative production & deliverable schedule',
              icon: Calendar,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/calendar'),
            },
            {
              id: 'work-items',
              label: 'Work',
              path: '/work',
              description: 'Production deliverables',
              icon: Film,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/work'),
            },
          ],
        },
        {
          id: 'operations',
          label: 'Operations',
          items: [
            {
              id: 'workload',
              label: 'Team Workload',
              path: '/workload',
              description: 'Capacity rollups & workload bands',
              icon: Users,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/workload'),
            },
            {
              id: 'issues',
              label: 'Issues and Blockers',
              path: '/issues',
              description: 'Active blockers & revision flags',
              icon: AlertCircle,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/issues'),
            },
            {
              id: 'reports',
              label: 'Reports',
              path: '/reports',
              description: 'Deliverables & performance reporting',
              icon: BarChart3,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/reports'),
            },
          ],
        },
        {
          id: 'organization',
          label: 'Organization',
          items: [
            {
              id: 'team',
              label: 'Team Directory',
              path: '/team',
              description: 'Team directory, capacity & worker performance profiles',
              icon: Users,
              show: true,
              activeMatcher: (p: string) => p.startsWith('/team'),
            },
          ],
        },
      ];
    }

    // creative_head, executive, admin
    const cats: NavCategory[] = [
      {
        id: 'schedule',
        label: 'Workspace',
        items: [
          {
            id: 'calendar',
            label: 'Creative Calendar',
            path: '/calendar',
            description: 'Creative production & deliverable schedule',
            icon: Calendar,
            show: true,
            activeMatcher: (p: string) => p.startsWith('/calendar'),
          },
          {
            id: 'work-items',
            label: 'Work',
            path: '/work',
            description: 'Production deliverables',
            icon: Film,
            show: true,
            activeMatcher: (p: string) => p.startsWith('/work'),
          },
          {
            id: 'feedback',
            label: 'Feedback and Revisions',
            path: '/feedback',
            description: 'Review threads & revision history',
            icon: FileText,
            show: true,
            activeMatcher: (p: string) => p.startsWith('/feedback'),
          },
        ],
      },
      {
        id: 'operations',
        label: 'Operations',
        items: [
          {
            id: 'workload',
            label: 'Team Workload',
            path: '/workload',
            description: 'Capacity rollups & workload bands',
            icon: Users,
            show: true,
            activeMatcher: (p: string) => p.startsWith('/workload'),
          },
          {
            id: 'issues',
            label: 'Issues and Blockers',
            path: '/issues',
            description: 'Active blockers & revision flags',
            icon: AlertCircle,
            show: true,
            activeMatcher: (p: string) => p.startsWith('/issues'),
          },
          {
            id: 'reports',
            label: 'Reports and Automation',
            path: '/reports',
            description: '4 Report definitions & automation rules',
            icon: BarChart3,
            show: true,
            activeMatcher: (p: string) => p.startsWith('/reports'),
          },
        ],
      },
      {
        id: 'people-org',
        label: 'Organization',
        items: [
          {
            id: 'team',
            label: 'Team Directory',
            path: '/team',
            description: 'Team directory, capacity & worker performance profiles',
            icon: Users,
            show: true,
            activeMatcher: (p: string) => p.startsWith('/team') || p.startsWith('/people') || p.startsWith('/admin/users'),
          },
          ...(isAdmin
            ? [
                {
                  id: 'access-requests',
                  label: 'Access Requests',
                  path: '/admin/access-requests',
                  description: 'Pending user access & onboarding invites',
                  icon: ShieldCheck,
                  show: true,
                  badge: pendingAccessCount > 0 ? pendingAccessCount : undefined,
                  activeMatcher: (p: string) => p.startsWith('/admin/access-requests'),
                },
              ]
            : []),
        ],
      },
    ];
    return cats;
  }, [user?.role, isAdmin, isSmManager, isCreativeHead, isTeamMember, pendingAccessCount]);

  // Flatten accessible items for quick search jump
  const allSearchableItems = [
    {
      id: isTeamMember ? 'my-work' : 'dashboard',
      label: landingLabel,
      path: landingPath,
      description: isTeamMember ? 'Personal priority queue & actions' : 'KPIs, priorities & creative overview',
      icon: isTeamMember ? CheckSquare : LayoutDashboard,
      category: 'Workspace',
    },
    ...navCategories.flatMap((cat) =>
      cat.items
        .filter((it) => it.show)
        .map((it) => ({
          ...it,
          category: cat.label,
        }))
    ),
  ];

  const filteredSearchItems = searchQuery.trim()
    ? [
        {
          id: 'search-tasks-direct',
          label: `Search tasks & content for "${searchQuery.trim()}"`,
          path: `/work?search=${encodeURIComponent(searchQuery.trim())}`,
          description: 'Jump to Work items and content matching this query',
          icon: Search,
          category: 'Tasks & Content',
        },
        ...allSearchableItems.filter(
          (it) =>
            it.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.category.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      ]
    : allSearchableItems.slice(0, 6);

  // Left sidebar icons per role
  const sidebarItems: SidebarItem[] = useMemo(() => {
    if (isTeamMember) {
      return [
        { id: 'my-work', icon: CheckSquare, label: 'My Work', path: '/my-work', active: location.pathname.startsWith('/my-work') || location.pathname.startsWith('/todo') },
        { id: 'calendar', icon: Calendar, label: 'Creative Calendar', path: '/calendar', active: location.pathname.startsWith('/calendar') },
        { id: 'notifications', icon: Bell, label: 'Notifications', path: '/notifications', active: location.pathname.startsWith('/notifications') },
      ];
    }

    if (isSmManager) {
      return [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', active: isLandingActive },
        { id: 'my-work', icon: CheckSquare, label: 'My Work', path: '/my-work', active: location.pathname.startsWith('/my-work') || location.pathname.startsWith('/todo') },
        { id: 'calendar', icon: Calendar, label: 'Creative Calendar', path: '/calendar', active: location.pathname.startsWith('/calendar') },
        { id: 'work', icon: Film, label: 'Work', path: '/work', active: location.pathname.startsWith('/work') },
        { id: 'workload', icon: Users, label: 'Team Workload', path: '/workload', active: location.pathname.startsWith('/workload') },
        { id: 'issues', icon: AlertCircle, label: 'Issues and Blockers', path: '/issues', active: location.pathname.startsWith('/issues') },
        { id: 'reports', icon: BarChart3, label: 'Reports', path: '/reports', active: location.pathname.startsWith('/reports') },
      ];
    }

    // creative_head, executive, admin
    const items: SidebarItem[] = [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', active: isLandingActive },
      { id: 'calendar', icon: Calendar, label: 'Creative Calendar', path: '/calendar', active: location.pathname.startsWith('/calendar') },
      { id: 'work', icon: Film, label: 'Work', path: '/work', active: location.pathname.startsWith('/work') },
      { id: 'feedback', icon: FileText, label: 'Feedback and Revisions', path: '/feedback', active: location.pathname.startsWith('/feedback') },
      { id: 'workload', icon: Users, label: 'Team Workload', path: '/workload', active: location.pathname.startsWith('/workload') },
      { id: 'issues', icon: AlertCircle, label: 'Issues and Blockers', path: '/issues', active: location.pathname.startsWith('/issues') },
      { id: 'reports', icon: BarChart3, label: 'Reports and Automation', path: '/reports', active: location.pathname.startsWith('/reports') },
      { id: 'team', icon: Users, label: 'Team Directory', path: '/team', active: location.pathname.startsWith('/team') || location.pathname.startsWith('/people') || location.pathname.startsWith('/admin/users') },
    ];

    if (isAdmin) {
      items.push({
        id: 'access',
        icon: ShieldCheck,
        label: 'Access Requests',
        path: '/admin/access-requests',
        active: location.pathname.startsWith('/admin/access-requests'),
        badge: pendingAccessCount > 0 ? pendingAccessCount : undefined,
      });
    }

    return items;
  }, [user?.role, location.pathname, isLandingActive, isTeamMember, isSmManager, isAdmin, pendingAccessCount]);

  return (
    <div className="min-h-screen flex flex-col text-slate-800">
      {/* 1. Top Navigation Bar (64px) */}
      <header className="sticky top-0 z-40 h-16 glass-panel border-b border-white/80 transition-all">
        <div className="max-w-[1520px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3 md:gap-4">
          {/* Left: Mobile Menu Toggle & Brand Logo */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile hamburger button */}
            <button
              onClick={() => setShowMobileMenu((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="p-1 rounded-lg md:hidden text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-colors"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/" className="flex items-center group py-0.5" title="HACA Marketing OS">
              <img
                src="/haca-forge-logo.png"
                alt="HACA Marketing OS"
                className="h-[18px] sm:h-[19px] w-auto max-w-[110px] object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
            </Link>
          </div>

          {/* Center: Capsule Tab Switcher with Dropdowns */}
          <nav
            ref={navRef}
            className="hidden md:flex items-center p-1 glass-pill-container border border-white/90 relative shrink-0"
          >
            {/* Landing Direct Tab */}
            <Link
              to={landingPath}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 ${
                isLandingActive
                  ? 'pill-active'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {landingLabel}
            </Link>

            {/* Categorized Dropdowns / Direct Tabs */}
            {navCategories.map((category) => {
              const visibleItems = category.items.filter((item) => item.show);
              if (visibleItems.length === 0) return null;

              // If only 1 item in category (e.g. for worker/requester), render direct tab
              if (visibleItems.length === 1) {
                const singleItem = visibleItems[0];
                const isActive = singleItem.activeMatcher(location.pathname);
                return (
                  <Link
                    key={singleItem.id}
                    to={singleItem.path}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                      isActive
                        ? 'pill-active'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span>{singleItem.label}</span>
                    {singleItem.badge !== undefined && singleItem.badge > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-xs">
                        {singleItem.badge}
                      </span>
                    )}
                  </Link>
                );
              }

              // Otherwise render category dropdown
              const isCategoryActive = visibleItems.some((item) => item.activeMatcher(location.pathname));
              const isOpen = openDropdown === category.id;

              return (
                <div key={category.id} className="relative">
                  <button
                    onClick={() => setOpenDropdown((prev) => (prev === category.id ? null : category.id))}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 ${
                      isCategoryActive || isOpen
                        ? 'pill-active'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <span>{category.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu Popover */}
                  {isOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-72 sm:w-80 glass-panel border border-white shadow-2xl rounded-2xl p-2 bg-white/95 backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                        <span>{category.label}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 font-mono">
                          {visibleItems.length}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {visibleItems.map((item) => {
                          const Icon = item.icon;
                          const isItemActive = item.activeMatcher(location.pathname);
                          return (
                            <Link
                              key={item.id}
                              to={item.path}
                              onClick={() => setOpenDropdown(null)}
                              className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                                isItemActive
                                  ? 'bg-[#7a6af6]/10 text-[#7a6af6]'
                                  : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                  isItemActive
                                    ? 'bg-[#7a6af6] text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold leading-tight truncate flex items-center gap-1.5">
                                    {item.label}
                                    {item.badge !== undefined && item.badge > 0 && (
                                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-xs">
                                        {item.badge}
                                      </span>
                                    )}
                                  </span>
                                  {isItemActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#7a6af6]"></span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
                                  {item.description}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right: Actions, Search, Notifications, Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Search Pill (Full on XL, Compact icon on < XL) */}
            <button
              onClick={() => setShowSearchModal(true)}
              title="Search tasks and content (⌘K)"
              className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 hover:bg-white border border-white/90 text-xs text-slate-500 shadow-sm transition-all whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search tasks and content...</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                ⌘K
              </kbd>
            </button>
            <button
              onClick={() => setShowSearchModal(true)}
              title="Search (⌘K)"
              className="flex xl:hidden p-2 rounded-full bg-white/70 hover:bg-white border border-white/90 text-slate-600 shadow-sm transition-all"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Team Chat Button */}
            <Link
              to="/chat"
              title="Team Chat"
              data-testid="top-bar-chat-btn"
              className={`relative p-2 rounded-full border transition-all ${
                location.pathname.startsWith('/chat')
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white/70 hover:bg-white border-white/90 text-slate-600 hover:text-slate-900 shadow-sm'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {chatUnreadCount > 0 && (
                <span
                  data-testid="chat-unread-badge"
                  className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold bg-rose-500 text-white flex items-center justify-center border-2 border-white shadow-sm"
                >
                  {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                </span>
              )}
            </Link>

            {/* Notification Center */}
            <NotificationCenter />

            {/* User Avatar Menu Dropdown */}
            <div className="flex items-center pl-2 border-l border-slate-300/60">
              <UserMenuDropdown />
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer Dropdown */}
        {showMobileMenu && (
          <div className="md:hidden glass-panel border-b border-white bg-white/95 px-4 py-4 space-y-4 animate-in slide-in-from-top duration-200 shadow-xl max-h-[calc(100vh-70px)] overflow-y-auto">
            {/* Mobile User Identity Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <Link
                to="/profile"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center gap-2.5 min-w-0"
              >
                <Avatar
                  url={user?.avatarUrl}
                  name={user?.name || 'User'}
                  userId={user?._id || user?.id}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {user?.preferredName || user?.name || 'User'}
                  </div>
                  <div className="text-[10px] text-slate-500 capitalize">
                    {user?.role?.replace('_', ' ') || 'member'} • Profile
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  to="/chat"
                  onClick={() => setShowMobileMenu(false)}
                  title="Team Chat"
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center relative"
                >
                  <MessageSquare className="w-4 h-4" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                  )}
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setShowMobileMenu(false)}
                  title="Settings"
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleLogout();
                  }}
                  title="Sign out"
                  className="p-2 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Link
                to={landingPath}
                onClick={() => setShowMobileMenu(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold ${
                  isLandingActive ? 'bg-[#0d0e12] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isTeamMember ? <CheckSquare className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                <span>{landingLabel}</span>
              </Link>
            </div>

            {navCategories.map((cat) => {
              const visible = cat.items.filter((it) => it.show);
              if (visible.length === 0) return null;
              return (
                <div key={cat.id} className="space-y-1 pt-2 border-t border-slate-100">
                  <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {cat.label}
                  </div>
                  {visible.map((it) => {
                    const Icon = it.icon;
                    const isActive = it.activeMatcher(location.pathname);
                    return (
                      <Link
                        key={it.id}
                        to={it.path}
                        onClick={() => setShowMobileMenu(false)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold ${
                          isActive
                            ? 'bg-[#7a6af6]/10 text-[#7a6af6] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{it.label}</span>
                        </div>
                        {it.badge !== undefined && it.badge > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white">
                            {it.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </header>

      {/* 2. Main Body with Fixed Left Icon Sidebar (72px) & Content Area */}
      <div className="flex-1 max-w-[1520px] w-full mx-auto px-4 sm:px-6 flex gap-6 pt-6 pb-12">
        {/* Fixed Left Sidebar (72px) */}
        <aside className="hidden lg:flex flex-col justify-between items-center w-[72px] py-6 px-2 glass-panel rounded-[24px] border border-white/80 self-start sticky top-24 max-h-[calc(100vh-120px)] shadow-glass">
          {/* Top module items */}
          <div className="flex flex-col items-center gap-3.5 w-full overflow-y-auto no-scrollbar py-1">
            {sidebarItems
              .filter((item) => item.show !== false)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    title={item.label}
                    className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center transition-all relative ${
                      item.active
                        ? 'bg-[#0d0e12] text-white shadow-md shadow-[#0d0e12]/20 scale-105'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 hover:scale-105'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {'badge' in item && item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>

          {/* Bottom helper icons */}
          <div className="flex flex-col items-center gap-2.5 w-full border-t border-slate-200/80 pt-3 shrink-0">
            {isAdmin && (
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
            )}
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
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/30 backdrop-blur-md animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSearchModal(false);
          }}
        >
          <div className="glass-modal max-w-lg w-full p-4 shadow-modal-glass border border-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Search tasks and content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] transition-all"
              />
            </div>

            {/* Quick Results */}
            <div className="mt-3 space-y-1 max-h-64 overflow-y-auto divide-y divide-slate-100">
              {filteredSearchItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigate(item.path);
                      setShowSearchModal(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left flex items-center gap-3 p-2 rounded-xl hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-[#7a6af6] group-hover:text-white flex items-center justify-center text-slate-500 transition-colors shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-slate-900">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-3 text-[11px] text-slate-400 flex justify-between items-center mt-2 border-t border-slate-100">
              <span>Press ESC to close</span>
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Toast Notifications */}
      <NotificationToastContainer />
    </div>
  );
};
