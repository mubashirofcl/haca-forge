import React, { useState, useRef, useEffect } from 'react';
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
  Building2,
  Layers,
  FileText,
  Film,
  Calendar,
  Clock,
  CheckSquare,
  TrendingUp,
  ChevronDown,
  Menu,
  X,
  AlertCircle,
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { NotificationToastContainer } from './NotificationToast';
import { MyAccountModal } from './MyAccountModal';

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
  activeMatcher: (pathname: string) => boolean;
}

interface NavCategory {
  id: string;
  label: string;
  items: NavItem[];
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showMyAccountModal, setShowMyAccountModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

  // Dashboard direct tab path
  const dashboardPath = '/dashboard';
  const isDashboardActive = ['/dashboard', '/'].includes(location.pathname);

  // Grouped Navigation Categories for HACA Marketing OS
  const navCategories: NavCategory[] = [
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        {
          id: 'dashboard',
          label: 'Team Dashboard',
          path: '/dashboard',
          description: 'Monthly targets, KPIs & creative output',
          icon: LayoutDashboard,
          show: true,
          activeMatcher: (p) => p === '/dashboard' || p === '/',
        },
        {
          id: 'my-work',
          label: 'My Work',
          path: '/my-work',
          description: 'Personal priority queue & actions',
          icon: CheckSquare,
          show: user?.role !== 'executive',
          activeMatcher: (p) => p.startsWith('/my-work'),
        },
        {
          id: 'calendar',
          label: 'Calendar',
          path: '/calendar',
          description: 'Monthly marketing campaign schedule',
          icon: Calendar,
          show: true,
          activeMatcher: (p) => p.startsWith('/calendar'),
        },
        {
          id: 'todo',
          label: 'Todo & Priorities',
          path: '/todo',
          description: 'Overdue, Today & Upcoming tasks',
          icon: Clock,
          show: true,
          activeMatcher: (p) => p.startsWith('/todo'),
        },
      ],
    },
    {
      id: 'campaigns-work',
      label: 'Campaigns & Work',
      items: [
        {
          id: 'campaigns',
          label: 'Campaigns',
          path: '/campaigns',
          description: 'Goals, budgets, pace & creatives',
          icon: Layers,
          show: true,
          activeMatcher: (p) => p.startsWith('/campaigns'),
        },
        {
          id: 'work-items',
          label: 'Work Items',
          path: '/work',
          description: 'Production deliverables across 7 profiles',
          icon: Film,
          show: true,
          activeMatcher: (p) => p.startsWith('/work'),
        },
        {
          id: 'feedback',
          label: 'Feedback & Revisions',
          path: '/feedback',
          description: 'Review threads & revision history',
          icon: FileText,
          show: true,
          activeMatcher: (p) => p.startsWith('/feedback'),
        },
        {
          id: 'issues',
          label: 'Issues & Blockers',
          path: '/issues',
          description: 'Active blockers & revision flags',
          icon: AlertCircle,
          show: true,
          activeMatcher: (p) => p.startsWith('/issues'),
        },
      ],
    },
    {
      id: 'analytics-ops',
      label: 'Analytics & Ops',
      items: [
        {
          id: 'workload',
          label: 'Team Workload',
          path: '/workload',
          description: 'Capacity rollups & workload bands',
          icon: Users,
          show: true,
          activeMatcher: (p) => p.startsWith('/workload'),
        },
        {
          id: 'leads',
          label: 'Lead Funnel',
          path: '/leads',
          description: '12-stage LSQ funnel & CPL metrics',
          icon: TrendingUp,
          show: true,
          activeMatcher: (p) => p.startsWith('/leads'),
        },
        {
          id: 'data-center',
          label: 'Data Center / LSQ',
          path: '/data-center',
          description: 'LeadSquared sync health & discrepancy log',
          icon: Building2,
          show: true,
          activeMatcher: (p) => p.startsWith('/data-center'),
        },
        {
          id: 'reports',
          label: 'Reports & Automation',
          path: '/reports',
          description: '6 Report definitions & 7 automation rules',
          icon: BarChart3,
          show: true,
          activeMatcher: (p) => p.startsWith('/reports'),
        },
      ],
    },
    {
      id: 'people-access',
      label: 'People & Access',
      items: [
        {
          id: 'people',
          label: 'People Setup',
          path: '/people',
          description: 'User accounts & operational assignments',
          icon: Users,
          show: true,
          activeMatcher: (p) => p.startsWith('/people') || p.startsWith('/admin/users'),
        },
        {
          id: 'access-requests',
          label: 'Access Requests',
          path: '/admin/access-requests',
          description: 'Pending user access & onboarding invites',
          icon: ShieldCheck,
          show: hasPermission('user.approve'),
          activeMatcher: (p) => p.startsWith('/admin/access-requests'),
        },
      ],
    },
  ];

  // Flatten accessible items for quick search jump
  const allSearchableItems = [
    {
      id: 'dashboard',
      label: 'Team Dashboard',
      path: dashboardPath,
      description: 'Monthly marketing targets & creative overview',
      icon: LayoutDashboard,
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
    ? allSearchableItems.filter(
        (it) =>
          it.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          it.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          it.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allSearchableItems.slice(0, 6);

  // Left sidebar icons
  const sidebarItems = [
    {
      id: 'dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: dashboardPath,
      active: isDashboardActive,
    },
    ...(user?.role !== 'executive'
      ? [
          {
            id: 'my-work',
            icon: CheckSquare,
            label: 'My Work',
            path: '/my-work',
            active: location.pathname.startsWith('/my-work'),
          },
        ]
      : []),
    {
      id: 'campaigns',
      icon: Layers,
      label: 'Campaigns',
      path: '/campaigns',
      active: location.pathname.startsWith('/campaigns'),
    },
    {
      id: 'work',
      icon: Film,
      label: 'Work Items',
      path: '/work',
      active: location.pathname.startsWith('/work'),
    },
    {
      id: 'calendar',
      icon: Calendar,
      label: 'Calendar',
      path: '/calendar',
      active: location.pathname.startsWith('/calendar'),
    },
    {
      id: 'feedback',
      icon: FileText,
      label: 'Feedback',
      path: '/feedback',
      active: location.pathname.startsWith('/feedback'),
    },
    {
      id: 'workload',
      icon: Users,
      label: 'Workload',
      path: '/workload',
      active: location.pathname.startsWith('/workload'),
    },
    {
      id: 'todo',
      icon: Clock,
      label: 'Todo',
      path: '/todo',
      active: location.pathname.startsWith('/todo'),
    },
    {
      id: 'issues',
      icon: AlertCircle,
      label: 'Issues',
      path: '/issues',
      active: location.pathname.startsWith('/issues'),
    },
    {
      id: 'leads',
      icon: TrendingUp,
      label: 'Leads',
      path: '/leads',
      active: location.pathname.startsWith('/leads'),
    },
    {
      id: 'data-center',
      icon: Building2,
      label: 'Data Center',
      path: '/data-center',
      active: location.pathname.startsWith('/data-center'),
    },
    {
      id: 'reports',
      icon: BarChart3,
      label: 'Reports',
      path: '/reports',
      active: location.pathname.startsWith('/reports'),
    },
    {
      id: 'people',
      icon: Users,
      label: 'People',
      path: '/people',
      active: location.pathname.startsWith('/people') || location.pathname.startsWith('/admin/users'),
    },
    {
      id: 'access',
      icon: ShieldCheck,
      label: 'Access Requests',
      path: '/admin/access-requests',
      active: location.pathname.startsWith('/admin/access-requests'),
      show: hasPermission('user.approve'),
    },
  ];

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

            <Link to="/" className="flex items-center group py-0.5" title="HACA FORGE">
              <img
                src="/haca-forge-logo.png"
                alt="HACA FORGE"
                className="h-[18px] sm:h-[19px] w-auto max-w-[110px] object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
            </Link>
          </div>

          {/* Center: Capsule Tab Switcher with Dropdowns */}
          <nav
            ref={navRef}
            className="hidden md:flex items-center p-1 glass-pill-container border border-white/90 relative shrink-0"
          >
            {/* Dashboard Direct Tab */}
            <Link
              to={dashboardPath}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 ${
                isDashboardActive
                  ? 'pill-active'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              Dashboard
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
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? 'pill-active'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {singleItem.label}
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
                                  <span className="text-xs font-bold leading-tight truncate">
                                    {item.label}
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
              title="Search cases & requests (⌘K)"
              className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 hover:bg-white border border-white/90 text-xs text-slate-500 shadow-sm transition-all whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search cases & requests...</span>
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

            {/* Notification Center */}
            <NotificationCenter />

            {/* User Avatar & Menu (Opens My Account) */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-300/60">
              <button
                type="button"
                onClick={() => setShowMyAccountModal(true)}
                title="My Account & Work Preferences"
                className="flex items-center gap-2.5 p-1 rounded-full hover:bg-white/80 transition-all text-left group cursor-pointer"
              >
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-sm group-hover:ring-purple-400 transition-all">
                    {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                </div>

                <div className="hidden xl:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight group-hover:text-purple-600 transition-colors">
                    {user?.name || 'Administrator'}
                  </div>
                  <div className="text-[10px] text-slate-500 capitalize leading-tight mt-0.5">
                    {user?.role?.replace('_', ' ') || 'admin'} • My Account
                  </div>
                </div>
              </button>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50/60 rounded-full transition-colors ml-0.5"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer Dropdown */}
        {showMobileMenu && (
          <div className="md:hidden glass-panel border-b border-white bg-white/95 px-4 py-4 space-y-4 animate-in slide-in-from-top duration-200 shadow-xl max-h-[calc(100vh-70px)] overflow-y-auto">
            <div className="space-y-1">
              <Link
                to={dashboardPath}
                onClick={() => setShowMobileMenu(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold ${
                  isDashboardActive ? 'bg-[#0d0e12] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
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
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                          isActive
                            ? 'bg-[#7a6af6]/10 text-[#7a6af6] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{it.label}</span>
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
                    className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center transition-all ${
                      item.active
                        ? 'bg-[#0d0e12] text-white shadow-md shadow-[#0d0e12]/20 scale-105'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/70 hover:scale-105'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                );
              })}
          </div>

          {/* Bottom helper icons */}
          <div className="flex flex-col items-center gap-2.5 w-full border-t border-slate-200/80 pt-3 shrink-0">
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
                placeholder="Type to jump to any page or feature..."
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

      {/* My Account Modal */}
      <MyAccountModal
        isOpen={showMyAccountModal}
        onClose={() => setShowMyAccountModal(false)}
      />
    </div>
  );
};
