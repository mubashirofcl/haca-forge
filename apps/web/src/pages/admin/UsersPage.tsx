import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  ROLE_KEYS,
  JOB_ROLES,
  PROFILES,
  DEPARTMENTS,
  WORK_PREFERENCES,
  type UserRole,
  type JobRole,
} from '@mmp/shared';
import {
  Search,
  UserX,
  UserCheck,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  Key,
  Copy,
  Check,
  UserPlus,
  Briefcase,
  Building,
  Clock,
  Users,
} from 'lucide-react';

interface PersonRecord {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'invited';
  jobRole?: string;
  departmentId?: {
    _id: string;
    name: string;
    code: string;
  } | string;
  profileAccess?: Array<{
    _id: string;
    name: string;
    code: string;
  } | string>;
  reportsToIds?: Array<{
    _id: string;
    name: string;
    email: string;
    jobRole?: string;
  }>;
  weeklyCapacityHours?: number;
  workPreferences?: string[];
  lastLogin?: string;
  createdAt: string;
}

interface ReferenceData {
  profiles: Array<{ _id: string; name: string; code: string }>;
  departments: Array<{ _id: string; name: string; code: string }>;
}

export const UsersPage: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isMarketingHead = currentUser?.role === 'marketing_head';
  const isExecutive = currentUser?.role === 'executive';
  const canManageUsers = (isAdmin || hasPermission('user.manage')) && !isExecutive;
  const canAssignPeople = (canManageUsers || isMarketingHead || hasPermission('people.assign')) && !isExecutive;

  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    profiles: PROFILES.map((p, i) => ({ _id: `prof-${i}`, name: p.name, code: p.code })),
    departments: DEPARTMENTS.map((d, i) => ({ _id: `dept-${i}`, name: d.name, code: d.code })),
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create User modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'team_member' as UserRole,
    jobRole: 'Designer' as JobRole,
    departmentId: '',
    weeklyCapacityHours: 40,
    profileAccess: [] as string[],
    reportsToIds: [] as string[],
    password: '',
    workPreferences: [] as string[],
  });

  // Edit Person modal state
  const [editingPerson, setEditingPerson] = useState<PersonRecord | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('team_member');
  const [editJobRole, setEditJobRole] = useState<string>('Designer');
  const [editDeptId, setEditDeptId] = useState<string>('');
  const [editCapacity, setEditCapacity] = useState<number>(40);
  const [editProfileAccess, setEditProfileAccess] = useState<string[]>([]);
  const [editReportsToIds, setEditReportsToIds] = useState<string[]>([]);
  const [editWorkPreferences, setEditWorkPreferences] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Password Reset modal
  const [resetModalData, setResetModalData] = useState<{ person: PersonRecord; resetLink?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [peopleRes, refRes] = await Promise.all([
        apiFetch<{ data: PersonRecord[] }>('/people').catch(() =>
          apiFetch<{ data: PersonRecord[] }>('/admin/users')
        ),
        apiFetch<{ data: ReferenceData }>('/reference-data').catch(() => null),
      ]);

      setPeople(peopleRes.data || []);
      if (refRes?.data) {
        setReferenceData(refRes.data);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load people directory' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered People List
  const filteredPeople = useMemo(() => {
    return people.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.jobRole && p.jobRole.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRole = roleFilter === 'all' || p.role === roleFilter;

      const deptId = typeof p.departmentId === 'object' && p.departmentId !== null
        ? p.departmentId._id
        : p.departmentId;
      const matchesDept = deptFilter === 'all' || deptId === deptFilter;

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [people, searchTerm, roleFilter, deptFilter, statusFilter]);

  // Available Team Leads for Reports To dropdown
  const availableTeamLeads = useMemo(() => {
    return people.filter((p) => p.role === 'team_lead' && p.status === 'active');
  }, [people]);

  // Open Edit Modal
  const openEditModal = (p: PersonRecord) => {
    setEditingPerson(p);
    setEditRole(p.role);
    setEditJobRole(p.jobRole || 'Designer');
    const currentDeptId = typeof p.departmentId === 'object' && p.departmentId !== null
      ? p.departmentId._id
      : (p.departmentId || '');
    setEditDeptId(currentDeptId);
    setEditCapacity(p.weeklyCapacityHours || 40);

    const accessIds = (p.profileAccess || []).map((prof) =>
      typeof prof === 'object' && prof !== null ? prof._id : prof
    );
    setEditProfileAccess(accessIds);

    const reportsIds = (p.reportsToIds || []).map((r) =>
      typeof r === 'object' && r !== null ? r._id : r
    );
    setEditReportsToIds(reportsIds);
    setEditWorkPreferences(p.workPreferences || []);
  };

  // Save Person Updates
  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;
    setIsUpdating(true);

    try {
      const body: Record<string, any> = {
        departmentId: editDeptId || null,
        jobRole: editJobRole || null,
        weeklyCapacityHours: Number(editCapacity),
        profileAccess: editProfileAccess,
        reportsToIds: editReportsToIds,
        workPreferences: editWorkPreferences,
      };

      // Admin can also update role
      if (isAdmin && editRole !== editingPerson.role) {
        body.role = editRole;
      }

      await apiFetch(`/people/${editingPerson._id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      setFeedback({ type: 'success', message: `Updated ${editingPerson.name} successfully.` });
      setEditingPerson(null);
      await fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update person.' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Create New Person
  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      await apiFetch('/people', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          departmentId: createForm.departmentId || null,
          profileAccess: createForm.profileAccess.length > 0
            ? createForm.profileAccess
            : referenceData.profiles.map((p) => p._id),
          workPreferences: createForm.workPreferences,
        }),
      });

      setFeedback({ type: 'success', message: `Created user ${createForm.name} successfully.` });
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        email: '',
        role: 'team_member',
        jobRole: 'Designer',
        departmentId: '',
        weeklyCapacityHours: 40,
        profileAccess: [],
        reportsToIds: [],
        password: '',
        workPreferences: [],
      });
      await fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create user.' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle Suspend / Reactivate (Admin only)
  const handleToggleStatus = async (p: PersonRecord) => {
    const isSuspending = p.status === 'active';
    const action = isSuspending ? 'suspend' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} ${p.name}'s account?`)) return;

    try {
      await apiFetch(`/people/${p._id}/${action}`, { method: 'POST' });
      setFeedback({ type: 'success', message: `${p.name} account ${action}ed.` });
      await fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || `Failed to ${action} account.` });
    }
  };

  // Reset Password (Admin only)
  const handleResetPassword = async (p: PersonRecord) => {
    try {
      const res = await apiFetch<{ resetLink?: string; message: string }>(
        `/admin/users/${p._id}/reset-password`,
        { method: 'POST' }
      );
      setResetModalData({ person: p, resetLink: res.resetLink });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to generate reset link.' });
    }
  };

  // Role Badge Styling
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/10 text-purple-600 border border-purple-200 dark:border-purple-500/30';
      case 'executive':
        return 'bg-indigo-500/10 text-indigo-600 border border-indigo-200 dark:border-indigo-500/30';
      case 'marketing_head':
        return 'bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-500/30';
      case 'team_lead':
        return 'bg-blue-500/10 text-blue-600 border border-blue-200 dark:border-blue-500/30';
      case 'team_member':
      default:
        return 'bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-white/60 shadow-glass">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 border border-purple-200/50">
              Phase 1 Milestone
            </span>
            <span className="text-xs text-slate-500">4-Role Scoped Organization</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600" />
            People & Capacity Setup
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage team assignments, job roles, profile boundaries, and capacity limits.
          </p>
        </div>

        {canManageUsers && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full flex items-center gap-2 shadow-sm transition-all hover:scale-105 self-start md:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 shadow-sm border animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 rounded-2xl border border-white/60 shadow-glass flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or job role..."
            className="w-full pl-9 pr-4 py-2 bg-white/70 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-semibold">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/70 border border-slate-200 rounded-full text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">All Roles</option>
            {ROLE_KEYS.map((rk) => (
              <option key={rk} value={rk}>
                {rk.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-semibold">Dept:</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/70 border border-slate-200 rounded-full text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">All Departments</option>
            {referenceData.departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-semibold">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/70 border border-slate-200 rounded-full text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* People Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading people directory...</p>
        </div>
      ) : filteredPeople.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-white/60 shadow-glass">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No people found</h3>
          <p className="text-xs text-slate-500 mt-1">Try refining your search terms or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPeople.map((person) => {
            const isSelf = person._id === currentUser?.id;
            const isProtectedAccount = !isAdmin && (person.role === 'admin' || person.role === 'marketing_head' || person.role === 'executive');
            const canEditThisPerson = canAssignPeople && !isProtectedAccount && !isExecutive;

            const deptName = typeof person.departmentId === 'object' && person.departmentId !== null
              ? person.departmentId.name
              : 'Unassigned';

            const assignedProfiles = (person.profileAccess || []).map((prof) =>
              typeof prof === 'object' && prof !== null ? prof.name : prof
            );

            return (
              <div
                key={person._id}
                className="glass-card rounded-3xl p-5 border border-white/60 shadow-glass flex flex-col justify-between hover:shadow-hover transition-all relative overflow-hidden"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 flex items-center justify-center text-sm font-bold text-purple-700 border border-purple-200">
                        {person.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                          {person.name}
                          {isSelf && (
                            <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded-md">
                              You
                            </span>
                          )}
                        </h3>
                        {!isExecutive && person.email && (
                          <p className="text-xs text-slate-500">{person.email}</p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${getRoleBadge(
                        person.role
                      )}`}
                    >
                      {person.role.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Attributes Strip */}
                  <div className="space-y-2 text-xs bg-white/50 p-3 rounded-2xl border border-slate-100 my-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" /> Job Role:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {person.jobRole || (person.role === 'admin' ? 'System Admin' : 'Unspecified')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" /> Department:
                      </span>
                      <span className="font-medium text-slate-800">{deptName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Weekly Capacity:
                      </span>
                      <span className="font-semibold text-purple-700">
                        {person.weeklyCapacityHours || 40} hrs/wk
                      </span>
                    </div>
                  </div>

                  {/* Profile Access Tags */}
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Profile Access ({assignedProfiles.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {assignedProfiles.slice(0, 3).map((prof, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] text-slate-700 font-medium"
                        >
                          {prof}
                        </span>
                      ))}
                      {assignedProfiles.length > 3 && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-md text-[10px] font-bold">
                          +{assignedProfiles.length - 3} more
                        </span>
                      )}
                      {assignedProfiles.length === 0 && (
                        <span className="text-[10px] text-slate-400 italic">Org-wide (All 7 Profiles)</span>
                      )}
                    </div>
                  </div>

                  {/* Stage Work Preferences (Content Flow) */}
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Work Preferences ({person.workPreferences?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(person.workPreferences || []).map((pref, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold"
                        >
                          {pref}
                        </span>
                      ))}
                      {(!person.workPreferences || person.workPreferences.length === 0) && (
                        <span className="text-[10px] text-slate-400 italic">None assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        person.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-[11px] font-semibold text-slate-600 capitalize">
                      {person.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isExecutive && (
                      <>
                        {canEditThisPerson ? (
                          <button
                            onClick={() => openEditModal(person)}
                            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                            title="Edit Operational Fields"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        ) : isProtectedAccount ? (
                          <span
                            className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full"
                            title="Protected account"
                          >
                            Protected
                          </span>
                        ) : null}

                        {isAdmin && !isSelf && (
                          <>
                            <button
                              onClick={() => handleResetPassword(person)}
                              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-purple-600 transition-colors"
                              title="Generate Password Reset Link"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleToggleStatus(person)}
                              className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors ${
                                person.status === 'active'
                                  ? 'text-rose-500 hover:text-rose-700'
                                  : 'text-emerald-500 hover:text-emerald-700'
                              }`}
                              title={person.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                            >
                              {person.status === 'active' ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Person Modal */}
      {editingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-fade-in">
          <div className="glass-modal max-w-lg w-full p-6 sm:p-8 rounded-3xl border border-white shadow-modal-glass relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Person: {editingPerson.name}
                </h3>
                <p className="text-xs text-slate-500">{editingPerson.email}</p>
              </div>
              <button
                onClick={() => setEditingPerson(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePerson} className="space-y-4">
              {/* Role selector (Admin only) */}
              {isAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    System Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    {ROLE_KEYS.map((rk) => (
                      <option key={rk} value={rk}>
                        {rk.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Job Role selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  13 Fixed Job Titles
                </label>
                <select
                  value={editJobRole}
                  onChange={(e) => setEditJobRole(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  {JOB_ROLES.map((jr) => (
                    <option key={jr} value={jr}>
                      {jr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <select
                  value={editDeptId}
                  onChange={(e) => setEditDeptId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">Unassigned</option>
                  {referenceData.departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weekly Capacity Hours */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Weekly Capacity (Hours)
                </label>
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Profile Access Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Profile (Brand) Scoping
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-100 max-h-36 overflow-y-auto">
                  {referenceData.profiles.map((p) => {
                    const checked = editProfileAccess.includes(p._id);
                    return (
                      <label key={p._id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditProfileAccess([...editProfileAccess, p._id]);
                            } else {
                              setEditProfileAccess(editProfileAccess.filter((id) => id !== p._id));
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500/30"
                        />
                        <span className="truncate">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Reports To (Team Leads) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reports To (Team Lead)
                </label>
                <select
                  multiple
                  value={editReportsToIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                    setEditReportsToIds(selected);
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 h-24"
                >
                  {availableTeamLeads.map((tl) => (
                    <option key={tl._id} value={tl._id}>
                      {tl.name} ({tl.jobRole || 'Team Lead'})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Hold Ctrl/Cmd to select multiple Team Leads.
                </span>
              </div>

              {/* Work Preferences (Content Flow) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Content Flow Stage Preferences
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Content, Script, Design, Shoot, Edit, Post
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                  {WORK_PREFERENCES.map((pref) => {
                    const checked = editWorkPreferences.includes(pref);
                    return (
                      <label key={pref} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditWorkPreferences([...editWorkPreferences, pref]);
                            } else {
                              setEditWorkPreferences(editWorkPreferences.filter((p) => p !== pref));
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500/30"
                        />
                        <span className="font-medium">{pref}</span>
                      </label>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Stages this person is eligible to be assigned on Content Pieces.
                </span>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingPerson(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal (Admin only) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-fade-in">
          <div className="glass-modal max-w-lg w-full p-6 sm:p-8 rounded-3xl border border-white shadow-modal-glass relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
              <h3 className="text-base font-bold text-slate-900">Add New Person</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePerson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  placeholder="jane@haca.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">System Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  >
                    {ROLE_KEYS.map((rk) => (
                      <option key={rk} value={rk}>
                        {rk.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Job Role</label>
                  <select
                    value={createForm.jobRole}
                    onChange={(e) => setCreateForm({ ...createForm, jobRole: e.target.value as JobRole })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                  >
                    {JOB_ROLES.map((jr) => (
                      <option key={jr} value={jr}>
                        {jr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={createForm.departmentId}
                  onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                >
                  <option value="">Select department...</option>
                  {referenceData.departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Password (Optional)
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Leave empty to require password setup"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>

              {/* Work Preferences (Content Flow) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Content Flow Stage Preferences
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Content, Script, Design, Shoot, Edit, Post
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                  {WORK_PREFERENCES.map((pref) => {
                    const checked = createForm.workPreferences.includes(pref);
                    return (
                      <label key={pref} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({
                                ...createForm,
                                workPreferences: [...createForm.workPreferences, pref],
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                workPreferences: createForm.workPreferences.filter((p) => p !== pref),
                              });
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500/30"
                        />
                        <span className="font-medium">{pref}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full disabled:opacity-50"
                >
                  {isUpdating ? 'Creating...' : 'Create Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal (Admin) */}
      {resetModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-fade-in">
          <div className="glass-modal max-w-md w-full p-6 sm:p-8 rounded-3xl border border-white shadow-modal-glass relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" />
                Password Reset Link Generated
              </h3>
              <button
                onClick={() => setResetModalData(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              A secure password reset link for <span className="font-semibold">{resetModalData.person.name}</span> has been created.
            </p>

            {resetModalData.resetLink && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 mb-4 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-700 truncate select-all">
                  {resetModalData.resetLink}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resetModalData.resetLink || '');
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setResetModalData(null)}
                className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-full hover:bg-black"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
