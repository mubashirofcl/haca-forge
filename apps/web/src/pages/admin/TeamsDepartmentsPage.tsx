import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Users,
  Building2,
  Plus,
  Clock,
  UserCheck,
  UserPlus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  CheckCircle2,
  Shield,
} from 'lucide-react';

interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  capacity?: number;
  skills?: string[];
  status: string;
}

interface TeamRecord {
  _id: string;
  name: string;
  lead?: {
    _id: string;
    name: string;
    email: string;
  };
  members: TeamMember[];
  defaultWeeklyCapacity: number;
  totalWeeklyCapacity: number;
  description?: string;
}

interface DepartmentRecord {
  _id: string;
  name: string;
  type: 'social_media' | 'performance' | 'sales' | 'academics' | 'other';
  lead?: {
    _id: string;
    name: string;
    email: string;
  };
  description?: string;
  createdAt: string;
}

interface UserSummary {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  teamId?: string;
}

export const TeamsDepartmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'teams' | 'departments'>('teams');
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptType, setDeptType] = useState<DepartmentRecord['type']>('social_media');
  const [deptLeadId, setDeptLeadId] = useState('');
  const [deptDescription, setDeptDescription] = useState('');
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);

  // Team Edit Modal
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRecord | null>(null);
  const [teamLeadId, setTeamLeadId] = useState('');
  const [teamCapacity, setTeamCapacity] = useState(40);
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);

  // Add Member to Team Modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [targetTeam, setTargetTeam] = useState<TeamRecord | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [teamsRes, deptsRes, usersRes] = await Promise.all([
        apiFetch<{ teams: TeamRecord[] }>('/teams'),
        apiFetch<{ departments: DepartmentRecord[] }>('/departments'),
        apiFetch<{ data: UserSummary[] }>('/admin/users'),
      ]);
      setTeams(teamsRes.teams || []);
      setDepartments(deptsRes.departments || []);
      setAllUsers(usersRes.data || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load teams & departments data' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const clearFeedback = () => {
    setTimeout(() => setFeedback(null), 4000);
  };

  // Department CRUD
  const openCreateDept = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptType('social_media');
    setDeptLeadId('');
    setDeptDescription('');
    setShowDeptModal(true);
  };

  const openEditDept = (dept: DepartmentRecord) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setDeptType(dept.type);
    setDeptLeadId(dept.lead?._id || '');
    setDeptDescription(dept.description || '');
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDept(true);
    try {
      if (editingDept) {
        await apiFetch(`/departments/${editingDept._id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: deptName,
            type: deptType,
            lead: deptLeadId || null,
            description: deptDescription,
          }),
        });
        setFeedback({ type: 'success', message: `Department "${deptName}" successfully updated.` });
      } else {
        await apiFetch('/departments', {
          method: 'POST',
          body: JSON.stringify({
            name: deptName,
            type: deptType,
            lead: deptLeadId || undefined,
            description: deptDescription,
          }),
        });
        setFeedback({ type: 'success', message: `Department "${deptName}" successfully created.` });
      }
      setShowDeptModal(false);
      loadData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save department.' });
    } finally {
      setIsSubmittingDept(false);
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete department "${name}"?`)) return;
    try {
      await apiFetch(`/departments/${id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: `Department "${name}" deleted.` });
      loadData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete department.' });
    }
  };

  // Team Edit
  const openEditTeam = (team: TeamRecord) => {
    setEditingTeam(team);
    setTeamLeadId(team.lead?._id || '');
    setTeamCapacity(team.defaultWeeklyCapacity || 40);
    setShowTeamModal(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setIsSubmittingTeam(true);
    try {
      await apiFetch(`/teams/${editingTeam._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          lead: teamLeadId || null,
          defaultWeeklyCapacity: Number(teamCapacity),
        }),
      });
      setFeedback({ type: 'success', message: `Team "${editingTeam.name}" updated successfully.` });
      setShowTeamModal(false);
      loadData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update team.' });
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  // Team Member Add/Remove
  const openAddMember = (team: TeamRecord) => {
    setTargetTeam(team);
    setSelectedUserId('');
    setShowMemberModal(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeam || !selectedUserId) return;
    setIsSubmittingMember(true);
    try {
      await apiFetch(`/teams/${targetTeam._id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUserId }),
      });
      setFeedback({ type: 'success', message: `Staff member assigned to team "${targetTeam.name}".` });
      setShowMemberModal(false);
      loadData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to assign member to team.' });
    } finally {
      setIsSubmittingMember(false);
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from this team?`)) return;
    try {
      await apiFetch(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: `${memberName} removed from team.` });
      loadData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove member.' });
    }
  };

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Teams & Departments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure production delivery units, weekly hours capacity, and requester departments
          </p>
        </div>

        {/* Tab Pills & Action */}
        <div className="flex items-center gap-3">
          <div className="glass-pill-container p-1 border border-white/90 flex items-center">
            <button
              onClick={() => setActiveTab('teams')}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                activeTab === 'teams' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Production Teams ({teams.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                activeTab === 'departments' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Departments ({departments.length})</span>
              </div>
            </button>
          </div>

          {activeTab === 'departments' && (
            <button
              onClick={openCreateDept}
              className="px-4 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-md flex items-center gap-1.5 transition-transform hover:scale-[1.02]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Department</span>
            </button>
          )}
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

      {/* 3. Content Areas */}
      {isLoading ? (
        <div className="glass-panel p-12 text-center rounded-[24px]">
          <div className="w-8 h-8 border-4 border-[#7a6af6] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Loading organizational structure...</p>
        </div>
      ) : activeTab === 'teams' ? (
        /* TEAMS TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map((team) => (
            <div
              key={team._id}
              className="glass-panel p-6 rounded-[24px] border border-white shadow-glass flex flex-col justify-between"
            >
              <div>
                {/* Team Top Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#7a6af6]/20 to-[#6366f1]/20 border border-[#7a6af6]/30 flex items-center justify-center text-[#6366f1] font-extrabold text-sm shadow-sm capitalize">
                      {team.name.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 capitalize tracking-tight flex items-center gap-2">
                        {team.name}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                          Team
                        </span>
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        <span>Lead: <strong className="text-slate-700">{team.lead?.name || 'Unassigned'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditTeam(team)}
                      title="Edit Team Settings"
                      className="p-2 rounded-xl bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openAddMember(team)}
                      title="Add Staff Member"
                      className="p-2 rounded-xl bg-[#0d0e12] hover:bg-black text-white text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Capacity Statistics Bar */}
                <div className="p-4 rounded-2xl bg-white/60 border border-white/80 mb-5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#7a6af6]" />
                      Total Weekly Capacity
                    </span>
                    <span className="font-extrabold text-slate-900">
                      {team.totalWeeklyCapacity} hrs / week
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7a6af6] to-[#4f46e5]"
                      style={{
                        width: `${Math.min(100, (team.totalWeeklyCapacity / (team.members.length * 40 || 40)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                    <span>Default: {team.defaultWeeklyCapacity}h/member</span>
                    <span>{team.members.length} Active Staff</span>
                  </div>
                </div>

                {/* Team Members List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                    Assigned Staff ({team.members.length})
                  </h4>
                  {team.members.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No staff currently assigned to this team.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {team.members.map((member) => (
                        <div
                          key={member._id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/50 hover:bg-white/90 border border-slate-100 transition-all text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 truncate block">
                                {member.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {member.email}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              {member.capacity || 40}h
                            </span>
                            <button
                              onClick={() => handleRemoveMember(team._id, member._id, member.name)}
                              title="Remove from Team"
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* DEPARTMENTS TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div
              key={dept._id}
              className="glass-panel p-6 rounded-[24px] border border-white shadow-glass flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                        {dept.name}
                      </h3>
                      <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20 uppercase">
                        {dept.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditDept(dept)}
                      title="Edit Department"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white/80 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDept(dept._id, dept.name)}
                      title="Delete Department"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50/60 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed min-h-[38px] mb-4">
                  {dept.description || 'No description provided for this organizational unit.'}
                </p>

                <div className="p-3 rounded-xl bg-white/60 border border-white flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Department Head</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {dept.lead?.name || 'Unassigned'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 border-t border-slate-200/60 pt-3 mt-4 flex items-center justify-between">
                <span>Created {new Date(dept.createdAt).toLocaleDateString()}</span>
                <span className="font-semibold text-slate-600">Source Unit</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODALS */}
      {/* ======================================================== */}

      {/* A. Department Modal (Create / Edit) */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="glass-modal w-full max-w-lg p-6 sm:p-8 rounded-[28px] shadow-2xl border border-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                {editingDept ? 'Edit Department' : 'Create New Department'}
              </h2>
              <button
                onClick={() => setShowDeptModal(false)}
                className="p-1.5 rounded-full hover:bg-white/60 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Sales Enablement"
                  className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Category Type *
                </label>
                <select
                  value={deptType}
                  onChange={(e) => setDeptType(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                >
                  <option value="social_media">Social Media</option>
                  <option value="performance">Performance Marketing</option>
                  <option value="sales">Sales & Partnerships</option>
                  <option value="academics">Academics & Curriculum</option>
                  <option value="other">Other Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Lead
                </label>
                <select
                  value={deptLeadId}
                  onChange={(e) => setDeptLeadId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                >
                  <option value="">-- No Lead Assigned --</option>
                  {allUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role} - {u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Mission
                </label>
                <textarea
                  rows={3}
                  value={deptDescription}
                  onChange={(e) => setDeptDescription(e.target.value)}
                  placeholder="Responsibilities, request scope, and goals..."
                  className="w-full px-4 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDept}
                  className="px-6 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm"
                >
                  {isSubmittingDept ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. Team Settings Modal */}
      {showTeamModal && editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="glass-modal w-full max-w-md p-6 sm:p-8 rounded-[28px] shadow-2xl border border-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight capitalize">
                Edit {editingTeam.name} Team
              </h2>
              <button
                onClick={() => setShowTeamModal(false)}
                className="p-1.5 rounded-full hover:bg-white/60 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Team Lead
                </label>
                <select
                  value={teamLeadId}
                  onChange={(e) => setTeamLeadId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                >
                  <option value="">-- No Lead Assigned --</option>
                  {allUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role} - {u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Member Capacity (Hours/Week)
                </label>
                <input
                  type="number"
                  min={1}
                  max={80}
                  required
                  value={teamCapacity}
                  onChange={(e) => setTeamCapacity(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Baseline working hours per worker for capacity scheduling.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTeam}
                  className="px-6 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm"
                >
                  {isSubmittingTeam ? 'Updating...' : 'Save Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. Add Member Modal */}
      {showMemberModal && targetTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="glass-modal w-full max-w-md p-6 sm:p-8 rounded-[28px] shadow-2xl border border-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight capitalize">
                Assign Staff to {targetTeam.name}
              </h2>
              <button
                onClick={() => setShowMemberModal(false)}
                className="p-1.5 rounded-full hover:bg-white/60 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Staff Member *
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                >
                  <option value="">-- Choose Staff User --</option>
                  {allUsers
                    .filter((u) => !targetTeam.members.some((m) => m._id === u._id))
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role} - {u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMember || !selectedUserId}
                  className="px-6 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm disabled:opacity-50"
                >
                  {isSubmittingMember ? 'Adding...' : 'Add to Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
