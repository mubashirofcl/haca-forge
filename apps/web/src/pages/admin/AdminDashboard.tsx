import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import {
  ShieldCheck,
  Users,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    pendingAccessRequests: 0,
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [reqsRes, usersRes] = await Promise.all([
          apiFetch<{ data: any[] }>('/admin/access-requests?status=pending'),
          apiFetch<{ data: any[] }>('/admin/users'),
        ]);

        const users = usersRes.data || [];
        setStats({
          pendingAccessRequests: (reqsRes.data || []).length,
          totalUsers: users.length,
          activeUsers: users.filter((u) => u.status === 'active').length,
          suspendedUsers: users.filter((u) => u.status === 'suspended').length,
        });
      } catch (err) {
        console.error('Failed to load admin stats', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  const cards = [
    {
      title: 'Pending Onboarding',
      value: stats.pendingAccessRequests,
      sub: 'Access requests awaiting review',
      link: '/admin/access-requests',
      icon: ShieldCheck,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    },
    {
      title: 'Total Active Staff',
      value: stats.activeUsers,
      sub: `Out of ${stats.totalUsers} registered accounts`,
      link: '/admin/users',
      icon: Users,
      color: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
    },
    {
      title: 'Suspended Accounts',
      value: stats.suspendedUsers,
      sub: 'Locked or deactivated credentials',
      link: '/admin/users?status=suspended',
      icon: Activity,
      color: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30',
    },
    {
      title: 'Target SLA Delivery',
      value: '98.4%',
      sub: 'Company-wide on-time benchmark',
      link: '/reports',
      icon: TrendingUp,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
          Administrator Command Center
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          High-level operational metrics, security governance, and team access overview
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className={`p-6 rounded-2xl bg-slate-900/80 border backdrop-blur-md transition-all hover:scale-[1.02] hover:border-slate-700 shadow-xl flex flex-col justify-between ${card.color}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {isLoading ? '—' : card.value}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>{card.sub}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Launch & Guidance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Administrative Priorities</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            New team members submit access requests via the public portal. Only administrators can review, assign production teams (Content, Graphics, Cinematography, Editor), and grant Lead or Admin roles.
          </p>
          <div className="space-y-3">
            <Link
              to="/admin/access-requests"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-blue-500/40 text-xs font-medium text-slate-200 transition-colors"
            >
              <span>Review pending access requests</span>
              <span className="text-blue-400 font-bold flex items-center gap-1">
                Open <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
            <Link
              to="/admin/users"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-blue-500/40 text-xs font-medium text-slate-200 transition-colors"
            >
              <span>Manage roles, teams, and security status</span>
              <span className="text-blue-400 font-bold flex items-center gap-1">
                Open <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Phase 1 Architecture Status</span>
          </h2>
          <div className="space-y-2.5 text-xs text-slate-300 mt-4">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span>RBAC & CASL Permissions Matrix</span>
              <span className="text-emerald-400 font-semibold">Active & Enforced</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span>Mailer Provider Adapter</span>
              <span className="text-emerald-400 font-semibold">Console (Dev) / SMTP / Resend</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span>Token Security</span>
              <span className="text-emerald-400 font-semibold">httpOnly, Secure, 48h Invite Tokens</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
