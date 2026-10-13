import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  BarChart3,
  LogOut,
  Bell,
  Sparkles,
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'lead':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'worker':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'dept_lead':
      case 'dept_staff':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'sm_manager':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const navItems = [
    {
      label: 'Admin Overview',
      path: '/admin',
      show: user?.role === 'admin',
      icon: LayoutDashboard,
    },
    {
      label: 'Access Requests',
      path: '/admin/access-requests',
      show: hasPermission('user.approve'),
      icon: ShieldCheck,
    },
    {
      label: 'Users & Roles',
      path: '/admin/users',
      show: hasPermission('user.manage'),
      icon: Users,
    },
    {
      label: 'Lead Dashboard',
      path: '/lead',
      show: user?.role === 'lead',
      icon: LayoutDashboard,
    },
    {
      label: 'Worker Dashboard',
      path: '/worker',
      show: user?.role === 'worker',
      icon: LayoutDashboard,
    },
    {
      label: 'Requester Portal',
      path: '/requester',
      show: ['dept_lead', 'dept_staff', 'sm_manager'].includes(user?.role || ''),
      icon: LayoutDashboard,
    },
    {
      label: 'Reports',
      path: '/reports',
      show: hasPermission('report.view'),
      icon: BarChart3,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Marketing Portal
                </span>
                <span className="block text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
                  Workflow Engine
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              {navItems
                .filter((item) => item.show)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
          </div>

          {/* User profile & actions */}
          <div className="flex items-center gap-4">
            <button
              title="Notifications"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            </button>

            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-200 leading-tight">
                  {user?.name}
                </div>
                <div className="text-xs text-slate-400 leading-tight mt-0.5">
                  {user?.department || user?.email}
                </div>
              </div>

              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeColor(
                  user?.role
                )}`}
              >
                {user?.role?.replace('_', ' ')}
              </span>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        Marketing Workflow and Content Management Portal &bull; Enterprise Monorepo v1.0
      </footer>
    </div>
  );
};
