import { useState, useEffect } from 'react';
import { Users, X, AlertCircle, Check, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { ChatChannelTypeDetail } from '@mmp/shared';

interface ActiveUser {
  _id: string;
  id?: string;
  name: string;
  preferredName?: string;
  role: string;
  jobRole?: string;
  avatarUrl?: string;
}

interface GroupModalProps {
  onClose: () => void;
  onSuccess: (channel: ChatChannelTypeDetail) => void;
  channelToEdit?: ChatChannelTypeDetail | null;
}

export function GroupModal({ onClose, onSuccess, channelToEdit }: GroupModalProps) {
  const isEditing = Boolean(channelToEdit);
  const [name, setName] = useState(channelToEdit?.name || '');
  const [description, setDescription] = useState(channelToEdit?.description || '');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [usersList, setUsersList] = useState<ActiveUser[]>([]);
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  let currentUserId = '';
  try {
    const auth = useAuth();
    currentUserId = (auth?.user?._id || auth?.user?.id || (auth?.user as any)?.userId)?.toString() || '';
  } catch {
    currentUserId = '';
  }

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const res = await apiFetch<any>('/api/people?status=active');
        const rawList: ActiveUser[] =
          res?.data || res?.people || res?.users || (Array.isArray(res) ? res : []);

        // Filter out the creator if known (creator is automatically added as group owner)
        const activeList = rawList.filter((u) => {
          const uid = (u._id || u.id)?.toString();
          return !currentUserId || uid !== currentUserId;
        });

        setUsersList(activeList);
      } catch (err: any) {
        setError(err.message || 'Failed to load team members.');
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, [currentUserId]);

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  const filteredUsers = usersList.filter((u) => {
    if (!memberSearch.trim()) return true;
    const term = memberSearch.toLowerCase();
    const fullName = (u.name || '').toLowerCase();
    const prefName = (u.preferredName || '').toLowerCase();
    const role = (u.jobRole || u.role || '').toLowerCase();
    return fullName.includes(term) || prefName.includes(term) || role.includes(term);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (isEditing && channelToEdit) {
        const id = channelToEdit._id || channelToEdit.id;
        const res = await apiFetch<{ channel: ChatChannelTypeDetail }>(`/api/chat/channels/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
          }),
        });

        if (selectedUserIds.length > 0) {
          await apiFetch(`/api/chat/channels/${id}/members`, {
            method: 'POST',
            body: JSON.stringify({ memberIds: selectedUserIds }),
          });
        }

        onSuccess(res.channel);
      } else {
        if (selectedUserIds.length === 0) {
          setError('Please select at least one team member to join the group.');
          setSubmitting(false);
          return;
        }

        const res = await apiFetch<{ channel: ChatChannelTypeDetail }>('/api/chat/channels/groups', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            memberIds: selectedUserIds,
          }),
        });

        onSuccess(res.channel);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save group.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      data-testid="group-modal"
    >
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {isEditing ? 'Edit Group Settings' : 'Create New Group'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update group name and invite members' : 'Start a focused team group discussion'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Group Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Video Sprint, Reel Cutters, Design Team"
              maxLength={40}
              required
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-400 block mt-1 text-right">
              {name.length}/40 characters
            </span>
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this group purpose..."
              maxLength={200}
              rows={2}
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <span className="text-[10px] text-slate-400 block mt-1 text-right">
              {description.length}/200 characters
            </span>
          </div>

          {/* Member Selection List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {isEditing ? 'Add Team Members' : 'Invite Members'} ({selectedUserIds.length} selected)
              </label>
              {selectedUserIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="text-[11px] text-slate-400 hover:text-slate-600 font-medium"
                >
                  Clear selection
                </button>
              )}
            </div>

            {usersList.length > 5 && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Filter team members..."
                  className="w-full text-xs rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading team members...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 border border-slate-200 rounded-xl bg-slate-50/50">
                {memberSearch.trim() ? 'No matching team members found.' : 'No active team members available.'}
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const uid = (u._id || u.id)?.toString() || '';
                  const isSelected = selectedUserIds.includes(uid);
                  return (
                    <div
                      key={uid}
                      onClick={() => toggleUserSelection(uid)}
                      className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar url={u.avatarUrl} name={u.preferredName || u.name} size="xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">
                            {u.preferredName ? `${u.preferredName} (${u.name})` : u.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {u.jobRole || u.role}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : isEditing
                ? 'Save Changes'
                : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
