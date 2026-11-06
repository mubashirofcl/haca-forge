import { useState, useEffect, useRef } from 'react';
import { useDialogFocus } from '../../lib/useDialogFocus';
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

  // Modal keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, true, onClose);
  return (
    <div
      className="fixed inset-0 z-50 ui-scrim flex items-center justify-center p-4"
      data-testid="group-modal"
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="group-modal-title" className="glass-modal max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-ui-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/70 text-ui-ink flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 id="group-modal-title" className="text-base font-bold text-ui-ink">
                {isEditing ? 'Edit Group Settings' : 'Create New Group'}
              </h3>
              <p className="text-xs text-ui-muted">
                {isEditing ? 'Update group name and invite members' : 'Start a focused team group discussion'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ui-icon-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-xl status-tint status-changes text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-ui-text mb-1">
              Group Name <span className="text-ui-ink" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Video Sprint, Reel Cutters, Design Team"
              maxLength={40}
              required
              className="ui-input w-full"
            />
            <span className="text-[10px] text-ui-muted block mt-1 text-right">
              {name.length}/40 characters
            </span>
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-semibold text-ui-text mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this group purpose..."
              maxLength={200}
              rows={2}
              className="ui-input ui-textarea w-full resize-none"
            />
            <span className="text-[10px] text-ui-muted block mt-1 text-right">
              {description.length}/200 characters
            </span>
          </div>

          {/* Member Selection List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ui-text">
                {isEditing ? 'Add Team Members' : 'Invite Members'} ({selectedUserIds.length} selected)
              </label>
              {selectedUserIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="text-xs text-ui-muted hover:text-ui-ink font-medium min-h-[44px] px-2"
                >
                  Clear selection
                </button>
              )}
            </div>

            {usersList.length > 5 && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-ui-muted absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Filter team members..."
                  className="ui-input w-full pl-8 pr-3"
                />
              </div>
            )}

            {loading ? (
              <div className="p-4 text-center text-xs text-ui-muted">Loading team members...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-ui-muted border border-ui-line rounded-xl bg-white/60">
                {memberSearch.trim() ? 'No matching team members found.' : 'No active team members available.'}
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-ui-line rounded-xl divide-y divide-ui-line">
                {filteredUsers.map((u) => {
                  const uid = (u._id || u.id)?.toString() || '';
                  const isSelected = selectedUserIds.includes(uid);
                  return (
                    <button
                      type="button"
                      key={uid}
                      aria-pressed={isSelected}
                      onClick={() => toggleUserSelection(uid)}
                      className={`w-full min-h-[44px] text-left flex items-center justify-between p-2.5 hover:bg-white/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-ink ${
                        isSelected ? 'bg-white/70' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar url={u.avatarUrl} name={u.preferredName || u.name} size="xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ui-ink truncate">
                            {u.preferredName ? `${u.preferredName} (${u.name})` : u.name}
                          </p>
                          <p className="text-[11px] text-ui-muted truncate">
                            {u.jobRole || u.role}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-ui-ink border-ui-line text-white'
                            : 'border-ui-line'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-ui-line">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="ui-btn ui-btn-secondary h-11"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="ui-btn ui-btn-primary h-11"
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
