import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  ArrowUpDown,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { OverdueChip } from '../../components/OverdueChip';
import { useAuth } from '../../context/AuthContext';
import { InviteUserDialog } from './InviteUserDialog';
import { roleClass, bandClass } from '../../lib/statusTone';
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Capacity colours come from the shared .band-* classes; the band label is always shown.
  const getBandBadgeClass = (band: string) => `band-tint ${bandClass(band)} border-transparent`;

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">
              Team Directory
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/70 text-ui-text">
              {members.length} members
            </span>
          </div>
          <p className="text-[15px] text-ui-muted mt-1.5 max-w-[70ch]">
            View and manage team members, assignments, capacity, and individual performance profiles
          </p>
          {/* Always mounted so screen readers announce the message when it appears; no height when empty. */}
          <div role="status" aria-live="polite">
            {notice && (
              <p className="mt-3 max-w-[70ch] status-tint status-approved rounded-ui-card px-4 py-3 text-[13px] font-medium">
                {notice}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchDirectory}
            className="ui-btn ui-btn-secondary bg-transparent h-11"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setInviteOpen(true);
              }}
              className="ui-btn ui-btn-primary h-11"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Invite user
            </button>
          )}
        </div>
      </div>

      {isAdmin && inviteOpen && (
        <InviteUserDialog
          onClose={() => setInviteOpen(false)}
          onInvited={(message) => {
            setInviteOpen(false);
            setNotice(message);
            fetchDirectory();
          }}
        />
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-ui-panel p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Text Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-ui-muted absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, job role, skills..."
              aria-label="Search name, job role, skills"
              className="ui-input w-full pl-10 pr-3"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              aria-label="Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="ui-select w-full"
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
          {(departments.length > 0 || deptFilter !== 'all') && (
            <div>
              <select
                aria-label="Department"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="ui-select w-full"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Load Band Filter */}
          <div>
            <select
              aria-label="Load band"
              value={bandFilter}
              onChange={(e) => setBandFilter(e.target.value)}
              className="ui-select w-full"
            >
              <option value="all">All Load Bands</option>
              <option value="Healthy">Healthy (&lt; 65%)</option>
              <option value="High">High (65% – 85%)</option>
              <option value="Overloaded">Overloaded (&gt; 85%)</option>
            </select>
          </div>
        </div>

        {/* Secondary Toggles & Whitelist Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-ui-line">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Status Filter */}
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ui-muted font-medium">
              <span>Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                aria-pressed={statusFilter === 'active'}
                className={`h-11 px-4 rounded-full text-[13px] font-semibold border transition-colors ${
                  statusFilter === 'active' ? 'bg-ui-ink text-white border-transparent' : 'bg-white/60 text-ui-text border-ui-line hover:bg-white'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('suspended')}
                aria-pressed={statusFilter === 'suspended'}
                className={`h-11 px-4 rounded-full text-[13px] font-semibold border transition-colors ${
                  statusFilter === 'suspended' ? 'bg-ui-ink text-white border-transparent' : 'bg-white/60 text-ui-text border-ui-line hover:bg-white'
                }`}
              >
                Suspended
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                aria-pressed={statusFilter === 'all'}
                className={`h-11 px-4 rounded-full text-[13px] font-semibold border transition-colors ${
                  statusFilter === 'all' ? 'bg-ui-ink text-white border-transparent' : 'bg-white/60 text-ui-text border-ui-line hover:bg-white'
                }`}
              >
                All
              </button>
            </div>

            {/* Late Only Toggle */}
            <label className="flex items-center gap-2 min-h-[44px] cursor-pointer text-[13px] font-medium text-ui-text select-none">
              <input
                type="checkbox"
                checked={hasLateOnly}
                onChange={(e) => setHasLateOnly(e.target.checked)}
                className="w-4 h-4 rounded text-ui-ink focus:ring-ui-ink border-slate-300"
              />
              <span className="flex items-center gap-1 text-ui-ink">
                <AlertCircle className="w-3.5 h-3.5 text-ui-coral" />
                Has Late Work Only
              </span>
            </label>
          </div>

          {/* Whitelist Sorting Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ui-muted font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort:
            </span>
            <select
              aria-label="Sort by"
              value={`${sortBy}_${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('_');
                setSortBy(field as any);
                setSortDir(dir as any);
              }}
              className="ui-select"
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
          <div className="w-8 h-8 border-3 border-ui-line border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-ui-muted">Loading team directory...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center space-y-3 rounded-ui-card status-tint status-changes">
          <AlertTriangle className="w-8 h-8 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Failed to load directory</h3>
          <p className="text-xs text-ui-muted max-w-sm mx-auto">{error}</p>
          <button
            type="button"
            onClick={fetchDirectory}
            className="ui-btn ui-btn-primary h-11"
          >
            Try Again
          </button>
        </div>
      ) : members.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-2">
          <Users className="w-8 h-8 text-ui-muted mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No team members found</h3>
          <p className="text-xs text-ui-muted">
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
                className="glass-card p-5 flex flex-col justify-between space-y-4 group"
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
                      <h3 className="text-sm font-semibold text-ui-ink truncate">
                        <Link
                          to={`/team/${member._id}`}
                          title={displayName}
                          className="inline-flex items-center min-h-[44px] -my-3 hover:underline underline-offset-4 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2"
                        >
                        {displayName}
                        </Link>
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`role-badge ${roleClass(member.role)} text-[10px] font-extrabold px-2 py-0.5`}>
                          {roleLabel}
                        </span>
                        {member.jobRole && (
                          <span className="text-[10px] font-semibold text-ui-muted">
                            • {member.jobRole}
                          </span>
                        )}
                      </div>
                      {member.department?.name && (
                        <p className="text-[11px] text-ui-muted font-medium truncate mt-0.5">
                          {member.department.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      member.status === 'active'
                        ? 'status-tint status-approved'
                        : 'status-tint status-not-started'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>

                {/* Load & Capacity Band Indicator */}
                <div className="space-y-1.5 pt-2 border-t border-ui-line">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ui-muted font-semibold">Weekly Load:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ui-ink tabular-nums">{member.loadPct}%</span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getBandBadgeClass(
                          member.capacityBand
                        )}`}
                      >
                        {member.capacityBand}
                      </span>
                    </div>
                  </div>
                  {/* Visual progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-ui-line overflow-hidden">
                    <div
                      className={`h-full rounded-full band-bar ${bandClass(member.capacityBand)}`}
                      style={{ width: `${Math.min(100, member.loadPct)}%` }}
                    />
                  </div>
                </div>

                {/* 'Now' Active Step Indicator */}
                <div className="p-3 rounded-xl bg-white/60 text-xs space-y-1">
                  <span className="text-xs font-medium text-ui-muted block">
                    Now Working On
                  </span>
                  {member.currentStep ? (
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-ui-text">
                          {member.currentStep.stageKey}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {member.currentStep.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-ui-muted mt-1">
                        <span>
                          Due:{' '}
                          {member.currentStep.dueDate
                            ? new Date(member.currentStep.dueDate).toLocaleDateString()
                            : '—'}
                        </span>
                        {member.currentStep.isLate && (
                          <OverdueChip deadline={member.currentStep.dueDate} className="px-1.5 py-0.5" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-ui-muted italic">No active deliverable</span>
                  )}
                </div>

                {/* Operational Counts & View Profile CTA */}
                <div className="flex items-center justify-between pt-2 border-t border-ui-line">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      title="In Progress"
                      className="status-chip status-in-progress px-2 py-0.5 font-semibold"
                    >
                      {member.counts.inProgress} in prog
                    </span>
                    <span
                      title="Waiting for Approval"
                      className="status-chip status-waiting px-2 py-0.5 font-semibold"
                    >
                      {member.counts.waitingApproval} wait
                    </span>
                    {member.counts.late > 0 && (
                      <span
                        title="Late Deliverables"
                        className="status-chip status-changes px-2 py-0.5 font-semibold"
                      >
                        {member.counts.late} late
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/team/${member._id}`}
                    className="inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2 text-[13px] font-semibold text-ui-ink hover:underline underline-offset-4 rounded-full"
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
