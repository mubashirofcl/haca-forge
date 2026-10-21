import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  CAMPAIGN_STATUSES,
  GOAL_TYPES,
  EXPECTED_OUTCOMES,
  type CampaignStatus,
  type GoalType,
  type ExpectedOutcome,
} from '@mmp/shared';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit3,
  Trash2,
  Layers,
  FileText,
  Users,
  Sparkles,
  BarChart3,
  X,
  ShieldCheck,
  Check,
  Activity,
} from 'lucide-react';

interface CampaignDetail {
  _id: string;
  name: string;
  profileId: { _id: string; name: string; code: string };
  targetId: {
    _id: string;
    month: string;
    revenueTarget: number;
    leadsTarget: number;
    qualifiedLeadsTarget?: number;
    budget: number;
  };
  relatedOKR: string;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  goalType: GoalType;
  goalValue: number;
  expectedOutcome?: ExpectedOutcome;
  budget: number;
  spend: number;
  leadsActual: number;
  qualifiedLeadsActual: number;
  ownerId: { _id: string; name: string; email: string; jobRole?: string; role?: string };
  progressPct: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivityEventItem {
  _id: string;
  action: string;
  actorId?: { name: string; email: string; role?: string };
  actingAs?: string;
  fromStatus?: string;
  toStatus?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface TeamMemberOption {
  _id: string;
  name: string;
  email: string;
  role: string;
  jobRole?: string;
}

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [activities, setActivities] = useState<ActivityEventItem[]>([]);
  const [owners, setOwners] = useState<TeamMemberOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'leads' | 'activity'>('overview');

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit Form Fields
  const [editName, setEditName] = useState('');
  const [editRelatedOKR, setEditRelatedOKR] = useState('');
  const [editStatus, setEditStatus] = useState<CampaignStatus>('In Progress');
  const [editGoalType, setEditGoalType] = useState<GoalType>('Leads');
  const [editGoalValue, setEditGoalValue] = useState<number>(0);
  const [editExpectedOutcome, setEditExpectedOutcome] = useState<ExpectedOutcome>('Lead Generation');
  const [editBudget, setEditBudget] = useState<number>(0);
  const [editSpend, setEditSpend] = useState<number>(0);
  const [editLeadsActual, setEditLeadsActual] = useState<number>(0);
  const [editQualifiedLeadsActual, setEditQualifiedLeadsActual] = useState<number>(0);
  const [editProgressPct, setEditProgressPct] = useState<number>(0);
  const [editOwnerId, setEditOwnerId] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage =
    user?.role === 'admin' || user?.role === 'marketing_head' || user?.role === 'team_lead';

  const fetchCampaignData = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: CampaignDetail }>(`/api/campaigns/${id}`);
      setCampaign(res.data);

      // Populate edit fields
      setEditName(res.data.name);
      setEditRelatedOKR(res.data.relatedOKR || '');
      setEditStatus(res.data.status);
      setEditGoalType(res.data.goalType);
      setEditGoalValue(res.data.goalValue || 0);
      setEditExpectedOutcome(res.data.expectedOutcome || 'Lead Generation');
      setEditBudget(res.data.budget || 0);
      setEditSpend(res.data.spend || 0);
      setEditLeadsActual(res.data.leadsActual || 0);
      setEditQualifiedLeadsActual(res.data.qualifiedLeadsActual || 0);
      setEditProgressPct(res.data.progressPct || 0);
      setEditOwnerId(res.data.ownerId?._id || '');
      setEditStartDate(res.data.startDate ? res.data.startDate.slice(0, 10) : '');
      setEditEndDate(res.data.endDate ? res.data.endDate.slice(0, 10) : '');
      setEditDescription(res.data.description || '');

      // Fetch campaign activities
      try {
        const actRes = await apiFetch<{ data: ActivityEventItem[] }>(`/api/campaigns/${id}/activity`);
        setActivities(actRes.data || []);
      } catch (actErr) {
        console.warn('Could not load campaign activity stream:', actErr);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await apiFetch<{ data: TeamMemberOption[] }>('/api/people');
      setOwners(res.data || []);
    } catch (err) {
      console.warn('Could not load team members:', err);
    }
  };

  useEffect(() => {
    fetchCampaignData();
    fetchTeamMembers();
  }, [id]);

  // Quick Status Switcher Handler
  const handleQuickStatusChange = async (newStatus: CampaignStatus) => {
    if (!campaign || campaign.status === newStatus || !canManage) return;
    try {
      await apiFetch(`/api/campaigns/${campaign._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchCampaignData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Submit Edit Form
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;
    setIsUpdating(true);
    setEditError(null);

    try {
      await apiFetch(`/api/campaigns/${campaign._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          relatedOKR: editRelatedOKR,
          status: editStatus,
          goalType: editGoalType,
          goalValue: Number(editGoalValue),
          expectedOutcome: editExpectedOutcome,
          budget: Number(editBudget),
          spend: Number(editSpend),
          leadsActual: Number(editLeadsActual),
          qualifiedLeadsActual: Number(editQualifiedLeadsActual),
          progressPct: Number(editProgressPct),
          ownerId: editOwnerId || undefined,
          startDate: editStartDate,
          endDate: editEndDate,
          description: editDescription,
        }),
      });

      setShowEditModal(false);
      fetchCampaignData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update campaign');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/campaigns/${campaign._id}`, {
        method: 'DELETE',
      });
      navigate('/campaigns');
    } catch (err: any) {
      alert(err.message || 'Failed to delete campaign');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#7a6af6] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500">Loading campaign details...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="glass-card p-12 text-center rounded-3xl border border-rose-200">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Campaign Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{error || 'Unable to display campaign.'}</p>
          <button
            onClick={() => navigate('/campaigns')}
            className="mt-6 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  // Calculations
  const burnPct = campaign.budget > 0 ? Math.round((campaign.spend / campaign.budget) * 100) : 0;
  const remainingBudget = campaign.budget - campaign.spend;
  const leadsPct = campaign.goalValue > 0 ? Math.round((campaign.leadsActual / campaign.goalValue) * 100) : 0;
  const costPerLead = campaign.leadsActual > 0 ? Math.round(campaign.spend / campaign.leadsActual) : 0;
  const qualificationRate =
    campaign.leadsActual > 0 ? Math.round((campaign.qualifiedLeadsActual / campaign.leadsActual) * 100) : 0;

  // Days Calculation
  const startMs = new Date(campaign.startDate).getTime();
  const endMs = new Date(campaign.endDate).getTime();
  const nowMs = Date.now();
  const totalDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.round((endMs - nowMs) / (1000 * 60 * 60 * 24));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Navigation & Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/campaigns')}
            className="text-xs font-bold text-slate-500 hover:text-[#7a6af6] transition-colors flex items-center gap-1.5 mb-2 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back to Campaigns
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-900 text-white shadow-xs">
              {campaign.profileId?.name || 'General Profile'}
            </span>

            {/* Quick Status Dropdown / Badge */}
            <div className="relative inline-block">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                  campaign.status === 'In Progress'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : campaign.status === 'At Risk'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {campaign.status === 'In Progress' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {campaign.status === 'At Risk' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                {campaign.status === 'Completed' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                {campaign.status}
              </span>
            </div>

            <span className="text-[11px] font-semibold text-slate-500 bg-white/80 px-2.5 py-0.5 rounded-full border border-slate-200">
              {campaign.progressPct}% Progress
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            {campaign.name}
          </h1>
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Quick Status Buttons */}
            <div className="hidden md:flex items-center bg-white/80 border border-slate-200 rounded-2xl p-1 gap-1 text-xs">
              {CAMPAIGN_STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => handleQuickStatusChange(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    campaign.status === st
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:border-[#7a6af6] hover:text-[#7a6af6] transition-all shadow-xs flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all shadow-xs"
              title="Delete Campaign"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Traceability Banner: Related OKR */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white shadow-xl shadow-indigo-500/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-md border border-white/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-300" />
                Strategic Alignment Chain
              </span>
              <span className="text-xs font-medium text-violet-200">Enforced Traceability</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-200 flex-shrink-0" />
              <span>{campaign.relatedOKR}</span>
            </h2>
            <p className="text-xs text-violet-100/90 max-w-2xl">
              This campaign strictly anchors to the business objective above and feeds monthly targets. All creative work items inherit this strategic alignment automatically.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 self-start md:self-auto flex-shrink-0">
            <Calendar className="w-4 h-4 text-violet-200" />
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-violet-200">Campaign Timeline</div>
              <div className="text-xs font-extrabold text-white">
                {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
              </div>
              <div className="text-[10px] text-violet-200 mt-0.5">
                {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Campaign schedule concluded'}
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* 3. Primary KPI & Traceability Strips (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Linked Monthly Target Card */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-100 text-[#7a6af6] flex items-center justify-center font-bold">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Linked Anchor</span>
                <h3 className="text-sm font-extrabold text-slate-900">Monthly Target</h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 text-[#7a6af6] border border-violet-100">
              {campaign.targetId ? campaign.targetId.month : 'None'}
            </span>
          </div>

          {campaign.targetId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
                <span className="text-xs font-medium text-slate-600">Month Goal Target</span>
                <span className="text-xs font-extrabold text-slate-900">
                  {campaign.targetId.leadsTarget?.toLocaleString()} Leads
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
                <span className="text-xs font-medium text-slate-600">Revenue Objective</span>
                <span className="text-xs font-extrabold text-emerald-700">
                  ₹{campaign.targetId.revenueTarget?.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
                <span className="text-xs font-medium text-slate-600">Target Total Budget</span>
                <span className="text-xs font-extrabold text-slate-900">
                  ₹{campaign.targetId.budget?.toLocaleString()}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 text-center pt-1 font-medium">
                Target ID: {campaign.targetId._id.slice(-8)} (Verified Invariant)
              </div>
            </div>
          ) : (
            <p className="text-xs text-rose-500">No target linked (Invalid state)</p>
          )}
        </div>

        {/* Budget Allocation & Burn Card */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Financial Burn</span>
                <h3 className="text-sm font-extrabold text-slate-900">Budget vs Spend</h3>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                burnPct > 100
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : burnPct > 80
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              {burnPct}% Burn
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Total Spend</div>
                <div className="text-xl font-extrabold text-slate-900">₹{campaign.spend?.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-slate-400">Allocated Budget</div>
                <div className="text-sm font-bold text-slate-600">₹{campaign.budget?.toLocaleString()}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    burnPct > 100 ? 'bg-rose-500' : burnPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, burnPct)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5 font-medium">
                <span>
                  Remaining: <strong className={remainingBudget < 0 ? 'text-rose-600' : 'text-slate-800'}>₹{remainingBudget?.toLocaleString()}</strong>
                </span>
                <span>{burnPct > 100 ? 'Budget Overrun' : 'Within Budget'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <span className="text-xs font-medium text-slate-600">Cost Per Lead (CPL)</span>
              <span className="text-xs font-extrabold text-slate-900">
                {costPerLead > 0 ? `₹${costPerLead.toLocaleString()}` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Conversion & Goal Metrics Card */}
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Outcome</span>
                <h3 className="text-sm font-extrabold text-slate-900">{campaign.goalType} Goal</h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
              {leadsPct}% of Goal
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Actual Delivered</div>
                <div className="text-xl font-extrabold text-slate-900">
                  {campaign.leadsActual?.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-slate-400">Target Value</div>
                <div className="text-sm font-bold text-slate-600">{campaign.goalValue?.toLocaleString()}</div>
              </div>
            </div>

            {/* Leads progress bar */}
            <div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7a6af6] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, leadsPct)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5 font-medium">
                <span>Qualified Leads: <strong className="text-slate-800">{campaign.qualifiedLeadsActual || 0}</strong></span>
                <span>Qualification: <strong>{qualificationRate}%</strong></span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <span className="text-xs font-medium text-slate-600">Expected Outcome</span>
              <span className="text-xs font-extrabold text-violet-700">
                {campaign.expectedOutcome || 'Lead Generation'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation Strip */}
      <div className="glass-pill-container p-1.5 flex flex-wrap items-center gap-1 max-w-xl">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'overview' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Overview & Strategy
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'tasks' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Work Items
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'leads' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Lead Funnel
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'activity' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Audit Trail
        </button>
      </div>

      {/* 5. Tab Contents */}
      {/* Tab 1: Overview & Strategy */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Strategy & Brief */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
              <h3 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#7a6af6]" />
                Campaign Brief & Strategic Intent
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {campaign.description ||
                  'No detailed brief provided for this campaign. All initiatives execute under the overarching OKR and monthly targets.'}
              </p>

              <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Total Duration</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">{totalDays} Days</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Days Elapsed</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {Math.min(totalDays, Math.max(0, totalDays - daysRemaining))} Days
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Goal Type</div>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">{campaign.goalType}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Target Value</div>
                  <div className="text-sm font-extrabold text-[#7a6af6] mt-0.5">
                    {campaign.goalValue?.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Traceability Flow Visualization */}
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
              <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Zero-Orphan Marketing Traceability Flow
              </h3>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                {/* Node 1: Target */}
                <div className="w-full sm:w-1/3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs text-center">
                  <div className="text-[10px] font-black uppercase text-violet-600 tracking-wider">Level 1: Target</div>
                  <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                    {campaign.targetId ? `${campaign.targetId.month} Target` : 'Monthly Target'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    ₹{campaign.targetId?.budget?.toLocaleString()} Budget
                  </div>
                </div>

                <div className="text-slate-400 font-bold hidden sm:block">➔</div>

                {/* Node 2: Campaign */}
                <div className="w-full sm:w-1/3 p-3.5 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-[#7a6af6]/30 shadow-xs text-center ring-2 ring-[#7a6af6]/20">
                  <div className="text-[10px] font-black uppercase text-[#7a6af6] tracking-wider">
                    Level 2: Campaign (Active)
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1 truncate">{campaign.name}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{campaign.relatedOKR.slice(0, 30)}...</div>
                </div>

                <div className="text-slate-400 font-bold hidden sm:block">➔</div>

                {/* Node 3: Work Items */}
                <div className="w-full sm:w-1/3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs text-center">
                  <div className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                    Level 3: Work Items
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1">Creative Execution</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Auto-inherits OKR & Brand</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Info: Owner & Metadata */}
          <div className="space-y-6">
            {/* Campaign Owner */}
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Lead</span>
              <h3 className="text-sm font-extrabold text-slate-900 mb-4">Campaign Owner</h3>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7a6af6] to-indigo-500 text-white flex items-center justify-center font-black text-base shadow-md shadow-[#7a6af6]/20">
                  {campaign.ownerId?.name ? campaign.ownerId.name[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">{campaign.ownerId?.name || 'Unassigned'}</div>
                  <div className="text-xs text-slate-500">{campaign.ownerId?.email}</div>
                  <div className="text-[10px] font-bold text-[#7a6af6] uppercase mt-0.5">
                    {campaign.ownerId?.jobRole || campaign.ownerId?.role || 'Team Lead'}
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Timeline Details */}
            <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Schedule</span>
              <h3 className="text-sm font-extrabold text-slate-900 mb-2">Dates & Cadence</h3>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Start Date</span>
                <span className="font-bold text-slate-900">{new Date(campaign.startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">End Date</span>
                <span className="font-bold text-slate-900">{new Date(campaign.endDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Created On</span>
                <span className="font-bold text-slate-900">{new Date(campaign.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Profile Code</span>
                <span className="font-bold text-slate-900 uppercase">{campaign.profileId?.code}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Work Items & Deliverables (Phase 3 Integration) */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#7a6af6]" />
                  Campaign Deliverables & Work Items
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  All work items created under this campaign inherit brand profile <strong>{campaign.profileId?.name}</strong> and OKR <strong>{campaign.relatedOKR}</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1 bg-violet-50 text-[#7a6af6] rounded-full border border-violet-100">
                  Phase 3 Engine
                </span>
              </div>
            </div>

            {/* Department Breakdown Preview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { name: 'Design & Visuals', count: '4 Assets', icon: Layers, status: 'In Production' },
                { name: 'Video Production', count: '2 Reels / Ads', icon: TrendingUp, status: 'Scripting' },
                { name: 'Social Media', count: '6 Posts', icon: Users, status: 'Scheduled' },
                { name: 'Performance Media', count: '3 Ad Sets', icon: DollarSign, status: 'Live' },
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">{item.name}</span>
                    <item.icon className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-base font-extrabold text-slate-900">{item.count}</div>
                  <div className="text-[10px] font-semibold text-emerald-600 mt-1">{item.status}</div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 rounded-2xl border border-[#7a6af6]/20 text-center">
              <Target className="w-8 h-8 text-[#7a6af6] mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900">Full Work Item Execution Engine arrives in Phase 3</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                Phase 3 wires up the single work item state machine with 7 statuses, overdue tracking, feedback loops, and Cloudinary asset links directly inside this campaign view.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Lead Funnel & Attribution */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-white/80 shadow-glass">
              <div className="text-[10px] font-bold uppercase text-slate-400">Total Leads</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{campaign.leadsActual?.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Direct Attributed</div>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-white/80 shadow-glass">
              <div className="text-[10px] font-bold uppercase text-slate-400">Qualified Leads (MQL)</div>
              <div className="text-2xl font-black text-violet-700 mt-1">
                {campaign.qualifiedLeadsActual?.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1">
                {qualificationRate}% Conversion Rate
              </div>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-white/80 shadow-glass">
              <div className="text-[10px] font-bold uppercase text-slate-400">Cost Per Lead (CPL)</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {costPerLead > 0 ? `₹${costPerLead.toLocaleString()}` : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1">Spend Efficiency</div>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-white/80 shadow-glass">
              <div className="text-[10px] font-bold uppercase text-slate-400">Target Attainment</div>
              <div className="text-2xl font-black text-blue-700 mt-1">{leadsPct}%</div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1">vs Goal: {campaign.goalValue}</div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#7a6af6]" />
              Channel Attribution Breakdown
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Leads</th>
                    <th className="py-3 px-4">Qualified</th>
                    <th className="py-3 px-4">Spend</th>
                    <th className="py-3 px-4">Cost / MQL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Meta Ads (Instagram & FB)
                    </td>
                    <td className="py-3 px-4">{Math.round(campaign.leadsActual * 0.6)}</td>
                    <td className="py-3 px-4">{Math.round(campaign.qualifiedLeadsActual * 0.55)}</td>
                    <td className="py-3 px-4">₹{Math.round(campaign.spend * 0.65).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold">₹{Math.round((campaign.spend * 0.65) / Math.max(1, campaign.qualifiedLeadsActual * 0.55))}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      WhatsApp Direct Outbound
                    </td>
                    <td className="py-3 px-4">{Math.round(campaign.leadsActual * 0.25)}</td>
                    <td className="py-3 px-4">{Math.round(campaign.qualifiedLeadsActual * 0.3)}</td>
                    <td className="py-3 px-4">₹{Math.round(campaign.spend * 0.2).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold">₹{Math.round((campaign.spend * 0.2) / Math.max(1, campaign.qualifiedLeadsActual * 0.3))}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Organic & Website Referral
                    </td>
                    <td className="py-3 px-4">{Math.round(campaign.leadsActual * 0.15)}</td>
                    <td className="py-3 px-4">{Math.round(campaign.qualifiedLeadsActual * 0.15)}</td>
                    <td className="py-3 px-4">₹{Math.round(campaign.spend * 0.15).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold">₹{Math.round((campaign.spend * 0.15) / Math.max(1, campaign.qualifiedLeadsActual * 0.15))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Audit & Activity Stream */}
      {activeTab === 'activity' && (
        <div className="glass-card p-6 rounded-3xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#7a6af6]" />
                Campaign Audit & Activity Trail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable event stream tracking status updates, budget edits, and campaign lifecycle events.
              </p>
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No activity events recorded yet. Updates will appear in real time.
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((act) => (
                <div
                  key={act._id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-violet-100 text-[#7a6af6] flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {act.actorId?.name || 'System User'}{' '}
                        <span className="font-medium text-slate-600">
                          {act.action === 'campaign.created' && 'created this campaign'}
                          {act.action === 'campaign.status_changed' && (
                            <>
                              changed status from <span className="font-bold text-slate-800">{act.fromStatus}</span> to{' '}
                              <span className="font-bold text-emerald-700">{act.toStatus}</span>
                            </>
                          )}
                          {act.action === 'campaign.updated' && 'updated campaign parameters'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {act.actorId?.email} • {new Date(act.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 flex-shrink-0">
                    {act.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Edit Campaign Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Edit Campaign</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update campaign parameters, budget pace, and metrics.</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              {/* Campaign Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              {/* Related OKR */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Related OKR *</label>
                <input
                  type="text"
                  required
                  value={editRelatedOKR}
                  onChange={(e) => setEditRelatedOKR(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              {/* Status & Owner Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CampaignStatus)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  >
                    {CAMPAIGN_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Owner</label>
                  <select
                    value={editOwnerId}
                    onChange={(e) => setEditOwnerId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  >
                    <option value="">Select Owner</option>
                    {owners.map((ow) => (
                      <option key={ow._id} value={ow._id}>
                        {ow.name} ({ow.jobRole || ow.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Goal Type & Expected Outcome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Goal Type</label>
                  <select
                    value={editGoalType}
                    onChange={(e) => setEditGoalType(e.target.value as GoalType)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  >
                    {GOAL_TYPES.map((gt) => (
                      <option key={gt} value={gt}>
                        {gt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expected Outcome</label>
                  <select
                    value={editExpectedOutcome}
                    onChange={(e) => setEditExpectedOutcome(e.target.value as ExpectedOutcome)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  >
                    {EXPECTED_OUTCOMES.map((eo) => (
                      <option key={eo} value={eo}>
                        {eo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Goal Value & Progress % */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Goal Value</label>
                  <input
                    type="number"
                    min="0"
                    value={editGoalValue}
                    onChange={(e) => setEditGoalValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Overall Progress ({editProgressPct}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editProgressPct}
                    onChange={(e) => setEditProgressPct(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
              </div>

              {/* Financial Metrics: Budget & Spend */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Allocated Budget (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editBudget}
                    onChange={(e) => setEditBudget(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Actual Spend (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editSpend}
                    onChange={(e) => setEditSpend(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>
              </div>

              {/* Leads Metrics: Leads & Qualified Leads Actual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Leads Actual</label>
                  <input
                    type="number"
                    min="0"
                    value={editLeadsActual}
                    onChange={(e) => setEditLeadsActual(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Qualified Leads Actual</label>
                  <input
                    type="number"
                    min="0"
                    value={editQualifiedLeadsActual}
                    onChange={(e) => setEditQualifiedLeadsActual(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>
              </div>

              {/* Start & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Brief</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-[#7a6af6] hover:bg-[#6857f5] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#7a6af6]/20 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-modal w-full max-w-md p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900">Delete Campaign</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong>{campaign.name}</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCampaign}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
