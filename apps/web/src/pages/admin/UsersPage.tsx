import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { ROLE_KEYS, type UserRole } from '@mmp/shared';
import {
  Search,
  UserX,
  UserCheck,
  LogOut,
  Edit2,
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff & Roles</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage organization members, security statuses, and RBAC permissions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
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
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Department / Team</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-100">{u.name}</div>
                      <div className="text-[11px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-200 capitalize">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-200">{u.department || '—'}</div>
                      {u.teamId && (
                        <div className="text-[10px] text-blue-400 capitalize">Team: {u.teamId}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.status === 'active'
                            ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/60'
                            : 'bg-red-950/50 text-red-400 border border-red-800/60'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-[11px]">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setNewRole(u.role);
                          }}
                          title="Change Role"
                          className="p-1.5 bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 rounded-lg border border-slate-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          title={u.status === 'active' ? 'Suspend User' : 'Reactivate User'}
                          className={`p-1.5 rounded-lg border ${
                            u.status === 'active'
                              ? 'bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border-slate-700'
                              : 'bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border-slate-700'
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
                          className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded-lg border border-slate-700"
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

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Change Role: {editingUser.name}
            </h3>
            <p className="text-xs text-slate-400 mb-5">{editingUser.email}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select New Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {ROLE_KEYS.map((rk) => (
                    <option key={rk} value={rk}>
                      {rk.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  disabled={isUpdating}
                  onClick={handleRoleChange}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
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
