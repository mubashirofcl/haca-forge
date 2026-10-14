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
} from 'lucide-react';

interface UserRecord {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
  department?: string;
  teamId?: string;
  capacity?: number;
  lastLogin?: string;
  createdAt: string;
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Edit role modal
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('worker');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: UserRecord[] }>('/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async () => {
    if (!editingUser) return;
    setIsUpdating(true);
    try {
      await apiFetch(`/admin/users/${editingUser._id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
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
      await fetchUsers();
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
      alert(`User ${user.name} was successfully logged out.`);
    } catch (err: any) {
      alert(err.message || 'Failed to force logout');
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
    <div className="space-y-8">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Staff & Roles
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage organization members, security statuses, and RBAC permissions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white/80 border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs w-44 sm:w-56"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
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
            className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Glassmorphic Users Table */}
      <div className="glass-panel rounded-[24px] border border-white shadow-glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Department / Team</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u._id} className="hover:bg-white/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 capitalize border border-slate-200/60">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{u.department || '—'}</div>
                      {u.teamId && (
                        <div className="text-[10px] text-[#7a6af6] font-semibold capitalize">Team: {u.teamId}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-[11px]">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setNewRole(u.role);
                          }}
                          title="Change Role"
                          className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-full border border-slate-200 shadow-xs transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          title={u.status === 'active' ? 'Suspend User' : 'Reactivate User'}
                          className={`p-2 rounded-full border shadow-xs transition-colors ${
                            u.status === 'active'
                              ? 'bg-white hover:bg-rose-50 text-rose-600 border-slate-200'
                              : 'bg-white hover:bg-emerald-50 text-emerald-600 border-slate-200'
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
                          title="Force Logout"
                          className="p-2 bg-white hover:bg-amber-50 text-amber-600 rounded-full border border-slate-200 shadow-xs transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Role Modal (Glassmorphic) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="glass-modal max-w-sm w-full p-6 sm:p-8 shadow-modal-glass border border-white relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Change Role
                </h3>
                <p className="text-xs text-slate-500">{editingUser.name}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select New Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                >
                  {ROLE_KEYS.map((rk) => (
                    <option key={rk} value={rk}>
                      {rk.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200/80">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  disabled={isUpdating}
                  onClick={handleRoleChange}
                  className="px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Update Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
