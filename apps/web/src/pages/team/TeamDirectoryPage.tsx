import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  Search,
  ArrowUpDown,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { roleClass } from '../../lib/statusTone';
import { Avatar } from '../../components/Avatar';
import { ROLE_LABELS } from '@mmp/shared';

interface DirectoryMember {
  _id: string;
  name: string;
  preferredName?: string;
  avatarUrl?: string | null;
  role: string;
  jobRole?: string;
  department?: { _id: string; name: string } | null;
  status: string;
  weeklyCapacityHours: number;
  loadPct: number;
  capacityBand: 'Healthy' | 'High' | 'Overloaded';
  currentStep?: {
    workItemId: string;
    title: string;
    stageKey: string;
    status: string;
    dueDate?: string | null;
    isLate?: boolean;
  } | null;
  counts: {
    inProgress: number;
    waitingApproval: number;
    late: number;
  };
}

export const TeamDirectoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [bandFilter, setBandFilter] = useState('all');
  const [hasLateOnly, setHasLateOnly] = useState(false);

  // Whitelist Sorting ONLY: name, department, jobRole, load
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'jobRole' | 'load'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (deptFilter !== 'all') params.set('departmentId', deptFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (bandFilter !== 'all') params.set('loadBand', bandFilter);
      if (hasLateOnly) params.set('hasLate', 'true');
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);

      const res = await apiFetch<{
        success: boolean;
        data: { items: DirectoryMember[]; pagination: any };
      }>(`/api/team?${params.toString()}`);

      setMembers(res.data.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, [roleFilter, deptFilter, statusFilter, bandFilter, hasLateOnly, sortBy, sortDir]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDirectory();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Distinct departments for filter
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      if (m.department?._id && m.department?.name) {
        map.set(m.department._id, m.department.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [members]);

  const getBandBadgeClass = (band: string) => {
    switch (band) {
      case 'Overloaded':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-16 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Team Directory
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {members.length} members
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            View and manage team members, assignments, capacity, and individual performance profiles
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDirectory}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 font-bold text-xs shadow-2xs hover:shadow-xs transition-all active:scale-95"
          title="Refresh Directory"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Text Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, job role, skills..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[44px]"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[44px]"
            >
              <option value="all">All Roles</option>
              <option value="team_member">Team Member</option>
              <option value="creative_head">Creative Head</option>
              <option value="sm_manager">SM Manager</option>
              <option value="executive">Executive</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[44px]"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Load Band Filter */}
          <div>
            <select
              value={bandFilter}
              onChange={(e) => setBandFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[44px]"
            >
              <option value="all">All Load Bands</option>
              <option value="Healthy">Healthy (&lt; 65%)</option>
              <option value="High">High (65% – 85%)</option>
              <option value="Overloaded">Overloaded (&gt; 85%)</option>
            </select>
          </div>
        </div>

        {/* Secondary Toggles & Whitelist Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
              <span>Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'active'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('suspended')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'suspended'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Suspended
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
            </div>

            {/* Late Only Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={hasLateOnly}
                onChange={(e) => setHasLateOnly(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="flex items-center gap-1 text-rose-700">
                <AlertCircle className="w-3.5 h-3.5" />
                Has Late Work Only
              </span>
            </label>
          </div>

          {/* Whitelist Sorting Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort:
            </span>
            <select
              value={`${sortBy}_${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('_');
                setSortBy(field as any);
                setSortDir(dir as any);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px]"
            >
              <option value="name_asc">Name (A – Z)</option>
              <option value="name_desc">Name (Z – A)</option>
              <option value="department_asc">Department</option>
              <option value="jobRole_asc">Job Role</option>
              <option value="load_desc">Load (Highest first)</option>
              <option value="load_asc">Load (Lowest first)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Grid & Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading team directory...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center space-y-3 rounded-2xl bg-rose-50/70 border border-rose-200">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Failed to load directory</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{error}</p>
          <button
            type="button"
            onClick={fetchDirectory}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm"
          >
            Try Again
          </button>
        </div>
      ) : members.length === 0 ? (
        <div className="p-12 text-center space-y-2 rounded-2xl bg-white/70 border border-slate-200">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No team members found</h3>
          <p className="text-xs text-slate-500">
            Try adjusting your search query, status or role filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const roleLabel = ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role;
            const displayName = member.preferredName
              ? `${member.preferredName} (${member.name})`
              : member.name;

            return (
              <div
                key={member._id}
                className="p-5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Header: Avatar, Name, Role */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      url={member.avatarUrl}
                      name={member.name}
                      size="md"
                      className="border border-slate-200/80 shadow-2xs"
                    />
                    <div className="min-w-0">
                      <h3
                        onClick={() => navigate(`/team/${member._id}`)}
                        className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors truncate cursor-pointer"
                        title={displayName}
                      >
                        {displayName}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`role-badge ${roleClass(member.role)} text-[10px] font-extrabold px-2 py-0.5`}>
                          {roleLabel}
                        </span>
                        {member.jobRole && (
                          <span className="text-[10px] font-semibold text-slate-500">
                            • {member.jobRole}
                          </span>
                        )}
                      </div>
                      {member.department?.name && (
                        <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                          {member.department.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      member.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>

                {/* Load & Capacity Band Indicator */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Weekly Load:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800">{member.loadPct}%</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${getBandBadgeClass(
                          member.capacityBand
                        )}`}
                      >
                        {member.capacityBand}
                      </span>
                    </div>
                  </div>
                  {/* Visual progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        member.capacityBand === 'Overloaded'
                          ? 'bg-rose-500'
                          : member.capacityBand === 'High'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, member.loadPct)}%` }}
                    />
                  </div>
                </div>

                {/* 'Now' Active Step Indicator */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                    Now Working On
                  </span>
                  {member.currentStep ? (
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
                          {member.currentStep.stageKey}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {member.currentStep.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span>
                          Due:{' '}
                          {member.currentStep.dueDate
                            ? new Date(member.currentStep.dueDate).toLocaleDateString()
                            : '—'}
                        </span>
                        {member.currentStep.isLate && (
                          <span className="text-[10px] font-black text-rose-600 uppercase">
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No active deliverable</span>
                  )}
                </div>

                {/* Operational Counts & View Profile CTA */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      title="In Progress"
                      className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold"
                    >
                      {member.counts.inProgress} in prog
                    </span>
                    <span
                      title="Waiting for Approval"
                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold"
                    >
                      {member.counts.waitingApproval} wait
                    </span>
                    {member.counts.late > 0 && (
                      <span
                        title="Late Deliverables"
                        className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-black"
                      >
                        {member.counts.late} late
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/team/${member._id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Profile
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
