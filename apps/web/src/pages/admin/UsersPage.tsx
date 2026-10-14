import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { ROLE_KEYS, type UserRole } from '@mmp/shared';
import {
  Search,
  UserX,
  UserCheck,
  LogOut,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface UserRecord {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
  department?: string;
  teamId?: {
    _id: string;
    name: string;
  } | string;
  capacity?: number;
  skills?: string[];
  lastLogin?: string;
  createdAt: string;
}

interface TeamOption {
  _id: string;
  name: string;
}

interface DeptOption {
  _id: string;
  name: string;
}

const COMMON_SKILLS = [
  'video_editing',
  'motion_graphics',
  'graphic_design',
  'copywriting',
  'scriptwriting',
  'color_grading',
  'sound_design',
  'thumbnail_design',
  'seo',
  'social_media',
];

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit User modal state
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('worker');
  const [editDept, setEditDept] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editCapacity, setEditCapacity] = useState(40);
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, teamsRes, deptsRes] = await Promise.all([
        apiFetch<{ data: UserRecord[] }>('/admin/users'),
        apiFetch<{ teams: TeamOption[] }>('/teams'),
        apiFetch<{ departments: DeptOption[] }>('/departments'),
      ]);
      setUsers(usersRes.data || []);
      setTeams(teamsRes.teams || []);
      setDepartments(deptsRes.departments || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch users data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEditModal = (u: UserRecord) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditDept(u.department || '');
    const currentTeamId = typeof u.teamId === 'object' && u.teamId !== null ? u.teamId._id : (u.teamId || '');
    setEditTeamId(currentTeamId);
    setEditCapacity(u.capacity || 40);
    setEditSkills(u.skills || []);
    setCustomSkillInput('');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsUpdating(true);
    try {
      // 1. Update role if changed
      if (editRole !== editingUser.role) {
        await apiFetch(`/admin/users/${editingUser._id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role: editRole }),
        });
      }

      // 2. Update assignment details
      await apiFetch(`/admin/users/${editingUser._id}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify({
          teamId: editTeamId || null,
          department: editDept || null,
          capacity: Number(editCapacity),
          skills: editSkills,
        }),
      });

      setFeedback({ type: 'success', message: `User "${editingUser.name}" successfully updated.` });
      setEditingUser(null);
      await fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user profile.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    if (!confirm(`Are you sure you want to mark ${user.name} as ${nextStatus}?`)) return;

    try {
      await apiFetch(`/admin/users/${user._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setFeedback({ type: 'success', message: `Status for ${user.name} updated to ${nextStatus}.` });
      await fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleForceLogout = async (user: UserRecord) => {
    if (!confirm(`Force logout ${user.name}? This will invalidate their current session.`)) return;

    try {
      await apiFetch(`/admin/users/${user._id}/force-logout`, {
        method: 'POST',
      });
      setFeedback({ type: 'success', message: `User ${user.name} session was invalidated.` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to force logout');
    }
  };

  const toggleSkill = (skill: string) => {
    if (editSkills.includes(skill)) {
      setEditSkills(editSkills.filter((s) => s !== skill));
    } else {
      setEditSkills([...editSkills, skill]);
    }
  };

  const addCustomSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customSkillInput.trim()) {
      e.preventDefault();
      const s = customSkillInput.trim().toLowerCase().replace(/\s+/g, '_');
      if (!editSkills.includes(s)) {
        setEditSkills([...editSkills, s]);
      }
      setCustomSkillInput('');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Staff & Roles
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage organization members, team assignments, weekly capacities, and skills tags
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 bg-white/70 px-3 py-1.5 rounded-full border border-slate-200 font-semibold shadow-xs">
            Total Staff: <strong className="text-slate-900">{users.length}</strong>
          </span>
        </div>
      </div>

      {/* 2. Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Filters Bar */}
      <div className="glass-panel p-4 rounded-[22px] border border-white shadow-glass flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff by name, email, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3.5 py-2 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="all">All Roles</option>
            {ROLE_KEYS.map((rk) => (
              <option key={rk} value={rk}>
                {rk.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* 4. Users Table */}
      <div className="glass-panel rounded-[24px] border border-white shadow-glass overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-[#7a6af6] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-500 font-medium">Loading staff profiles...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No staff records found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-white/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Team & Department</th>
                  <th className="py-3.5 px-4">Skills</th>
                  <th className="py-3.5 px-4">Capacity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const teamName =
                    typeof u.teamId === 'object' && u.teamId !== null
                      ? u.teamId.name
                      : teams.find((t) => t._id === u.teamId)?.name || '—';

                  return (
                    <tr key={u._id} className="hover:bg-white/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block truncate max-w-[160px]">
                              {u.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize border border-slate-200">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 capitalize">{teamName}</div>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                          {u.department || 'No Department'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(u.skills || []).length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">None</span>
                          ) : (
                            u.skills?.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="px-1.5 py-0.5 bg-white text-[9px] font-medium text-slate-600 rounded border border-slate-200"
                              >
                                {s.replace('_', ' ')}
                              </span>
                            ))
                          )}
                          {(u.skills || []).length > 3 && (
                            <span className="text-[9px] text-slate-400">+{u.skills!.length - 3}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-700">
                        {u.capacity || 40}h/wk
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            title="Edit User Profile"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={u.status === 'active' ? 'Suspend User' : 'Activate User'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.status === 'active'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {u.status === 'active' ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleForceLogout(u)}
                            title="Force Logout Session"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Comprehensive User Profile Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="glass-modal max-w-lg w-full p-6 sm:p-8 shadow-modal-glass border border-white relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-5">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Edit Staff Profile
                </h3>
                <p className="text-xs text-slate-500">{editingUser.name} ({editingUser.email})</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    System Role *
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  >
                    {ROLE_KEYS.map((rk) => (
                      <option key={rk} value={rk}>
                        {rk.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Weekly Capacity (Hours)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={80}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Production Team
                  </label>
                  <select
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] capitalize"
                  >
                    <option value="">-- No Team Assigned --</option>
                    {teams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department Unit
                  </label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  >
                    <option value="">-- No Department Assigned --</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Skills Tags Editor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Skills & Qualifications
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {COMMON_SKILLS.map((skill) => {
                    const isSelected = editSkills.includes(skill);
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          isSelected
                            ? 'bg-[#0d0e12] text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {skill.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  placeholder="Type a custom skill tag and press Enter..."
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  onKeyDown={addCustomSkill}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm disabled:opacity-50"
                >
                  {isUpdating ? 'Saving Changes...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
