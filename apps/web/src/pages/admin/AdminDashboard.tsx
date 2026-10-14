import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import {
  ShieldCheck,
  Users,
  Activity,
  ArrowRight,
  TrendingUp,
  Building2,
  Layers,
  FileText,
  Settings,
} from 'lucide-react';
import { CasesOverview } from '../../components/CasesOverview';

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
      color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    },
    {
      title: 'Total Active Staff',
      value: stats.activeUsers,
      sub: `Out of ${stats.totalUsers} registered staff`,
      link: '/admin/users',
      icon: Users,
      color: 'bg-[#7a6af6]/10 text-[#7a6af6] border-[#7a6af6]/20',
    },
    {
      title: 'Suspended Accounts',
      value: stats.suspendedUsers,
      sub: 'Locked or revoked credentials',
      link: '/admin/users?status=suspended',
      icon: Activity,
      color: 'bg-rose-500/10 text-rose-600 border-rose-200',
    },
    {
      title: 'Target SLA Delivery',
      value: '98.4%',
      sub: 'Company-wide on-time benchmark',
      link: '/reports',
      icon: TrendingUp,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    },
  ];

  return (
    <div className="space-y-10">
      {/* Administrative KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className="glass-panel p-5 rounded-[22px] border border-white shadow-glass transition-all hover:scale-[1.02] flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2 rounded-xl border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {isLoading ? '—' : card.value}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                  <span>{card.sub}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Admin Tools Shortcuts */}
      <div className="glass-panel p-4 rounded-[22px] border border-white shadow-glass flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Quick Management:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/teams-departments"
            className="px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-full text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all hover:scale-[1.02]"
          >
            <Building2 className="w-3.5 h-3.5 text-[#7a6af6]" />
            <span>Teams & Depts</span>
          </Link>
          <Link
            to="/admin/master-data"
            className="px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-full text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all hover:scale-[1.02]"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Master Data & Schemas</span>
          </Link>
          <Link
            to="/admin/audit-log"
            className="px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-full text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all hover:scale-[1.02]"
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>Audit Trail</span>
          </Link>
          <Link
            to="/admin/settings"
            className="px-3.5 py-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-full text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all hover:scale-[1.02]"
          >
            <Settings className="w-3.5 h-3.5 text-slate-700" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* Main Reference Cases Overview: Kanban, Flow Nodes, Bottom Analytics */}
      <CasesOverview />
    </div>
  );
};
