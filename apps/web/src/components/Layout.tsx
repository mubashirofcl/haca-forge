import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeaderChatAvatars, type ChatPerson } from './HeaderChatAvatars';
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Search,
  LogOut,
  ShieldCheck,
  Users,
  FileText,
  Film,
  Calendar,
  CheckSquare,
  Menu,
  X,
  AlertCircle,
  Bell,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { NotificationCenter } from './NotificationCenter';
import { NotificationToastContainer } from './NotificationToast';
import { UserMenuDropdown } from './UserMenuDropdown';
import { Avatar } from './Avatar';

interface LayoutProps {
  children: React.ReactNode;
  /** Focused workspace (plan grid): the header stays as is; the sidebar is hidden and the content uses the full width. */
  focusMode?: boolean;
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

export const Layout: React.FC<LayoutProps> = ({ children, focusMode = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);
  // Faces for the header chat link: people from your own recent chats (no extra request, nothing you cannot already see).
  const [chatPeople, setChatPeople] = useState<ChatPerson[]>([]);
  const [chatTeamMore, setChatTeamMore] = useState(0);
  const teamMembersCache = React.useRef<Array<{ _id: string; name?: string; preferredName?: string; avatarUrl?: string | null; status?: string }> | null>(null);
  const [headerHidden, setHeaderHidden] = useState(false);

  // Hide the header while scrolling down, reveal it when scrolling up / near the top
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) setHeaderHidden(false);
      else if (y > lastY + 4) setHeaderHidden(true);
      else if (y < lastY - 4) setHeaderHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!user) return;
    type ChatUser = { _id: string; name?: string; preferredName?: string; avatarUrl?: string | null; status?: string };
    apiFetch<{
      channels: Array<{ unreadCount?: number; type?: string; isArchived?: boolean; membersCount?: number; otherUser?: ChatUser | null; createdById?: ChatUser | string | null }>;
    }>('/api/chat/channels')
      .then((res) => {
        const channels = res.channels || [];
        const total = channels.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setChatUnreadCount(total);
        // Most recent first (the API sorts by last message): direct-message partners, then group creators.
        const me = String(user?.id || user?._id || '');
        const seen = new Set<string>([me]);
        const people: ChatPerson[] = [];
        const add = (u?: ChatUser | string | null) => {
          if (!u || typeof u !== 'object' || !u._id || seen.has(String(u._id)) || u.status === 'suspended') return;
          seen.add(String(u._id));
          people.push({ _id: String(u._id), name: u.preferredName || u.name || 'Teammate', avatarUrl: u.avatarUrl });
        };
        channels.filter((c) => c.type === 'dm' && !c.isArchived).forEach((c) => add(c.otherUser));
        channels.filter((c) => c.type !== 'dm' && c.type !== 'team' && !c.isArchived).forEach((c) => add(c.createdById));
        const team = channels.find((c) => c.type === 'team') as { _id?: string; membersCount?: number } | undefined;
        const teamMembers = Math.max(0, (team?.membersCount || 0) - 1);
        const finish = (list: ChatPerson[]) => {
          setChatPeople(list);
          // "+N": the rest of the team in Team Chat (everyone but you and the faces shown).
          setChatTeamMore(Math.max(0, teamMembers - Math.min(list.length, 4)));
        };
        if (people.length >= 4 || !team?._id) return finish(people);
        // Fill the remaining faces from Team Chat (every member already sees its members), photos first. Read once per session.
        const fill = (members: ChatUser[]) => {
          const rest = members.filter((m) => m && m._id && !seen.has(String(m._id)) && m.status !== 'suspended');
          rest.sort((a, b) => Number(Boolean(b.avatarUrl)) - Number(Boolean(a.avatarUrl)));
          rest.forEach((m) => add(m));
          finish(people);
        };
        if (teamMembersCache.current) return fill(teamMembersCache.current);
        apiFetch<{ members?: Array<{ userId?: ChatUser }>; data?: { members?: Array<{ userId?: ChatUser }> } }>(`/api/chat/channels/${team._id}`)
          .then((d) => {
            const members = ((d.members || d.data?.members || []) as Array<{ userId?: ChatUser }>).map((m) => m.userId).filter(Boolean) as ChatUser[];
            teamMembersCache.current = members;
            fill(members);
          })
          .catch(() => finish(people));
      })
      .catch(() => {});
  }, [user, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Keyboard shortcuts: Esc closes overlays, Cmd/Ctrl+K toggles search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSearchModal(false);
        setShowMobileMenu(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close the mobile menu on page route change
  useEffect(() => {
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
              activeMatcher: (p: string) => p === '/work' || p.startsWith('/work/'),
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
            activeMatcher: (p: string) => p === '/work' || p.startsWith('/work/'),
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
            label: 'Reports',
            path: '/reports',
            description: 'Live reports: overdue, production, quality, projects',
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
        { id: 'work', icon: Film, label: 'Work', path: '/work', active: location.pathname === '/work' || location.pathname.startsWith('/work/') },
        { id: 'workload', icon: Users, label: 'Team Workload', path: '/workload', active: location.pathname.startsWith('/workload') },
        { id: 'issues', icon: AlertCircle, label: 'Issues and Blockers', path: '/issues', active: location.pathname.startsWith('/issues') },
        { id: 'reports', icon: BarChart3, label: 'Reports', path: '/reports', active: location.pathname.startsWith('/reports') },
        { id: 'team', icon: Users, label: 'Team Directory', path: '/team', active: location.pathname.startsWith('/team') },
      ];
    }

    // creative_head, executive, admin
    const items: SidebarItem[] = [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', active: isLandingActive },
      { id: 'calendar', icon: Calendar, label: 'Creative Calendar', path: '/calendar', active: location.pathname.startsWith('/calendar') },
      { id: 'work', icon: Film, label: 'Work', path: '/work', active: location.pathname === '/work' || location.pathname.startsWith('/work/') },
      { id: 'feedback', icon: FileText, label: 'Feedback and Revisions', path: '/feedback', active: location.pathname.startsWith('/feedback') },
      { id: 'workload', icon: Users, label: 'Team Workload', path: '/workload', active: location.pathname.startsWith('/workload') },
      { id: 'issues', icon: AlertCircle, label: 'Issues and Blockers', path: '/issues', active: location.pathname.startsWith('/issues') },
      { id: 'reports', icon: BarChart3, label: 'Reports', path: '/reports', active: location.pathname.startsWith('/reports') },
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

  // Current page name for the header (sidebar is the single source of navigation)
  const PAGE_TITLE_FALLBACKS: Array<[string, string]> = [
    ['/profile', 'Profile'],
    ['/settings', 'Settings'],
    ['/chat', 'Team Chat'],
    ['/notifications', 'Notifications'],
  ];
  const currentPageTitle =
    sidebarItems.find((item) => item.active)?.label ??
    PAGE_TITLE_FALLBACKS.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ??
    '';

  return (
    <div className="min-h-screen flex flex-col text-slate-800">
      {/* 1. Top Navigation Bar (64px) */}
      <header
        className={`shell-scope sticky top-0 z-40 transition-transform duration-300 ease-out ${
          headerHidden && !showMobileMenu ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="max-w-[1520px] mx-auto px-3 sm:px-6 pb-2">
        <div className="flex items-start justify-between gap-3">
          {/* Left pill: menu toggle (below lg), brand logo, current page */}
          <div className="mt-2 flex items-center gap-3 min-w-0 h-12 pl-3 pr-6 rounded-full shell-header shadow-glass">
            <button
              onClick={() => setShowMobileMenu((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={showMobileMenu}
              className="lg:hidden w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
            >
              {showMobileMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <Link to="/" className="flex items-center group py-0.5 shrink-0" title="HACA Marketing OS">
              <img
                src="/haca-forge-logo.png"
                alt="HACA Marketing OS"
                className="h-[18px] sm:h-[19px] w-auto max-w-[110px] object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
            </Link>

            {currentPageTitle && (
              <div className="hidden sm:flex items-center gap-3 min-w-0">
                <span className="h-5 w-px bg-slate-300/70" aria-hidden="true" />
                <span className="text-sm font-semibold text-slate-800 truncate">{currentPageTitle}</span>
              </div>
            )}
          </div>

          {/* Center: labelled segments (Search | Team Chat) */}
          <div className="hidden md:flex flex-1 justify-center min-w-0">
            {/* Tab hanging from the top edge, with inverted (concave) top corners */}
            <div className="relative flex items-center w-full max-w-[760px] h-16 px-4 shell-header border-t-0 rounded-b-[32px]">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 -left-8 w-8 h-8"
                style={{ background: 'radial-gradient(circle at 0 100%, transparent 31.5px, var(--shell-surface) 32px)' }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 -right-8 w-8 h-8"
                style={{ background: 'radial-gradient(circle at 100% 100%, transparent 31.5px, var(--shell-surface) 32px)' }}
              />
              <button
                onClick={() => setShowSearchModal(true)}
                title="Search tasks and content (⌘K)"
                className="flex-1 min-w-0 flex flex-col justify-center h-12 px-6 rounded-full hover:bg-white/60 transition-all text-left leading-tight"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <Search className="w-3 h-3" />
                  Search
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-8 text-xs font-semibold text-slate-800 whitespace-nowrap">
                  Tasks and content
                  <ChevronDown className="hidden lg:block w-3.5 h-3.5 text-slate-500" />
                </span>
              </button>

              <span className="h-7 w-px bg-slate-300/70 shrink-0" aria-hidden="true" />

              <Link
                to="/chat"
                title="Team Chat"
                data-testid="top-bar-chat-btn"
                className={`relative flex-1 min-w-0 flex flex-col justify-center h-12 px-6 rounded-full transition-all text-left leading-tight ${
                  location.pathname.startsWith('/chat')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'hover:bg-white/60 text-slate-800'
                }`}
              >
                <span className="flex items-center justify-between gap-3 min-w-0">
                  <span className="flex flex-col min-w-0">
                    <span
                      className={`flex items-center gap-1.5 text-[10px] font-medium ${
                        location.pathname.startsWith('/chat') ? 'text-white/70' : 'text-slate-400'
                      }`}
                    >
                      <MessageSquare className="w-3 h-3" />
                      Team Chat
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                      Messages
                      {chatUnreadCount > 0 && (
                        <span
                          data-testid="chat-unread-badge"
                          className="px-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold bg-rose-500 text-white flex items-center justify-center shadow-sm"
                        >
                          {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                  <HeaderChatAvatars people={chatPeople} moreCount={chatTeamMore} active={location.pathname.startsWith('/chat')} />
                </span>
              </Link>
            </div>
          </div>

          {/* Right pill: Search/Chat (mobile), Notifications, Account */}
          <div className="mt-2 flex items-center gap-1.5 shrink-0 h-12 pl-2 pr-1 rounded-full shell-header shadow-glass">
            <button
              onClick={() => setShowSearchModal(true)}
              title="Search (⌘K)"
              aria-label="Search"
              className="flex md:hidden p-2 rounded-full hover:bg-white text-slate-600 transition-all"
            >
              <Search className="w-4 h-4" />
            </button>
            <Link
              to="/chat"
              title="Team Chat"
              aria-label="Team Chat"
              className={`relative flex md:hidden p-2 rounded-full transition-all ${
                location.pathname.startsWith('/chat')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'hover:bg-white text-slate-600'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {chatUnreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
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
        </div>

        {/* Mobile Navigation Drawer Dropdown */}
        {showMobileMenu && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-4 animate-in slide-in-from-top duration-200 shadow-xl max-h-[calc(100vh-70px)] overflow-y-auto">
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
      <div
        className={
          focusMode
            ? 'flex-1 w-full min-w-0 px-2 sm:px-4 flex pt-3 pb-6'
            : 'flex-1 max-w-[1520px] w-full mx-auto px-4 sm:px-6 flex gap-6 pt-6 pb-12'
        }
      >
        {/* Left sidebar: 72px icon rail that widens on hover/keyboard focus to show labels.
            It is part of the flex row, so the main content resizes along with it. */}
        {!focusMode && (
        <aside
          className="group/sidebar hidden lg:flex flex-col shrink-0 self-start sticky top-24 h-[calc(100vh-120px)] w-[72px] hover:w-60 focus-within:w-60 py-4 px-[13px] shell-scope glass-panel rounded-[24px] border border-white/80 shadow-glass overflow-hidden transition-[width] duration-200 ease-out hover:delay-75"
        >
            <nav aria-label="Sidebar navigation" className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto overflow-x-hidden no-scrollbar">
              {sidebarItems
                .filter((item) => item.show !== false)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      aria-current={item.active ? 'page' : undefined}
                      className={`relative flex items-center h-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2 ${
                        item.active
                          ? 'bg-ui-ink text-white'
                          : 'text-ui-muted hover:text-ui-ink hover:bg-white/70'
                      }`}
                    >
                      <span className="w-11 h-11 shrink-0 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="flex-1 min-w-0 truncate whitespace-nowrap pr-3 text-[13px] font-semibold opacity-0 -translate-x-1 transition-all duration-150 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0">
                        {item.label}
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute top-0.5 left-7 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold bg-ui-coral text-ui-ink flex items-center justify-center ring-2 ring-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </nav>

            {/* Bottom: settings */}
            <div className="shrink-0 mt-3 pt-3 border-t border-ui-line">
              <Link
                to="/settings"
                aria-current={location.pathname.startsWith('/settings') ? 'page' : undefined}
                className={`flex items-center h-11 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2 ${
                  location.pathname.startsWith('/settings')
                    ? 'bg-ui-ink text-white'
                    : 'text-ui-muted hover:text-ui-ink hover:bg-white/70'
                }`}
              >
                <span className="w-11 h-11 shrink-0 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0 truncate whitespace-nowrap pr-3 text-[13px] font-semibold opacity-0 -translate-x-1 transition-all duration-150 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0">
                  Settings
                </span>
              </Link>
            </div>
        </aside>
        )}

        {/* 3. Main Dynamic Content Container */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* Global Quick Search Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 ui-scrim backdrop-blur-md animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSearchModal(false);
          }}
        >
          <div className="glass-modal max-w-lg w-full p-4 shadow-modal-glass border border-white">
            <div className="relative">
              <Search className="w-4 h-4 text-ui-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Search tasks and content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ui-input w-full pl-11"
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
                    className="w-full text-left flex items-center gap-3 p-2 rounded-2xl hover:bg-white/70 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-ui-ink/5 group-hover:bg-ui-ink group-hover:text-white flex items-center justify-center text-ui-muted transition-colors shrink-0">
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

            <div className="p-3 text-[11px] text-ui-muted flex justify-between items-center mt-2 border-t border-ui-line">
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
