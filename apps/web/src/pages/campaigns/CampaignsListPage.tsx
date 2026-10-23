import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  PROFILES,
  CAMPAIGN_STATUSES,
  GOAL_TYPES,
  EXPECTED_OUTCOMES,
  type CampaignStatus,
  type GoalType,
  type ExpectedOutcome,
} from '@mmp/shared';
import {
  Layers,
  Target,
  TrendingUp,
  Plus,
  Search,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  X,
  Users,
} from 'lucide-react';

interface CampaignItem {
  _id: string;
  name: string;
  profileId: { _id: string; name: string; code: string };
  targetId: { _id: string; month: string; revenueTarget: number; leadsTarget: number; budget: number };
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
  ownerId: { _id: string; name: string; email: string; jobRole?: string };
  progressPct: number;
  description?: string;
}

interface MonthlyTargetItem {
  _id: string;
  month: string;
  profileId?: { _id: string; name: string; code: string } | null;
  revenueTarget: number;
  leadsTarget: number;
  qualifiedLeadsTarget: number;
  budget: number;
}

interface TeamMemberOption {
  _id: string;
  name: string;
  email: string;
  role: string;
  jobRole?: string;
}

export const CampaignsListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [targets, setTargets] = useState<MonthlyTargetItem[]>([]);
  const [owners, setOwners] = useState<TeamMemberOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [profileFilter, setProfileFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [goalFilter, setGoalFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTargetsModal, setShowTargetsModal] = useState(false);

  // New Campaign Form State
  const [formName, setFormName] = useState('');
  const [formProfileId, setFormProfileId] = useState('');
  const [formTargetId, setFormTargetId] = useState('');
  const [formRelatedOKR, setFormRelatedOKR] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [formStatus, setFormStatus] = useState<CampaignStatus>('In Progress');
  const [formGoalType, setFormGoalType] = useState<GoalType>('Leads');
  const [profilesList, setProfilesList] = useState<Array<{ name: string; code: string; _id?: string }>>([...PROFILES]);
  const [formGoalValue, setFormGoalValue] = useState<number | ''>('');
  const [formExpectedOutcome, setFormExpectedOutcome] = useState<ExpectedOutcome>('Lead Generation');
  const [formBudget, setFormBudget] = useState<number | ''>('');
  const [formOwnerId, setFormOwnerId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Target Form State
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [targetMonth, setTargetMonth] = useState(currentMonthStr);
  const [targetProfileId, setTargetProfileId] = useState<string>('org-wide');
  const [targetRevenue, setTargetRevenue] = useState<number | ''>('');
  const [targetLeads, setTargetLeads] = useState<number | ''>('');
  const [targetQualifiedLeads, setTargetQualifiedLeads] = useState<number | ''>('');
  const [targetBudget, setTargetBudget] = useState<number | ''>('');
  const [isSubmittingTarget, setIsSubmittingTarget] = useState(false);
  const [targetMessage, setTargetMessage] = useState<string | null>(null);

  const canManageTargets = user?.role === 'admin' || user?.role === 'marketing_head';
  const canManageCampaigns = user?.role === 'admin' || user?.role === 'marketing_head' || user?.role === 'team_lead';

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (profileFilter !== 'all') params.append('profileId', profileFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (goalFilter !== 'all') params.append('goalType', goalFilter);
      if (searchTerm) params.append('search', searchTerm);

      const [cRes, tRes, oRes, pRes] = await Promise.all([
        apiFetch<{ data: CampaignItem[] }>(`/campaigns?${params.toString()}`).catch(() => ({ data: [] })),
        apiFetch<{ data: MonthlyTargetItem[] }>('/targets').catch(() => ({ data: [] })),
        apiFetch<{ data: TeamMemberOption[] }>('/people').catch(() => ({ data: [] })),
        apiFetch<{ data: Array<{ name: string; code: string; _id?: string }> }>('/reference-data/profiles').catch(() => ({ data: [] })),
      ]);

      setCampaigns(cRes.data || []);
      setTargets(tRes.data || []);
      setOwners(oRes.data || []);
      if (pRes.data && pRes.data.length > 0) {
        setProfilesList(pRes.data);
      }

      if (!formProfileId && (pRes.data?.length || PROFILES.length) > 0) {
        setFormProfileId((pRes.data?.[0]?.code || PROFILES[0].code));
      }
      if (!formOwnerId && user) {
        setFormOwnerId(user._id || user.id || user.userId || '');
      }
    } catch (err) {
      console.error('Failed to load campaigns data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profileFilter, statusFilter, goalFilter]);

  // Filter available targets based on chosen profile in campaign creation
  const availableTargets = targets.filter((t) => {
    if (!t.profileId) return true; // Org-wide target is always eligible
    return t.profileId._id === formProfileId || t.profileId.code === formProfileId;
  });

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTargetId) {
      setFormError('Please select a Monthly Target. Campaigns cannot be created without a target link.');
      return;
    }

    if (!formRelatedOKR.trim()) {
      setFormError('Please enter the Related OKR. Business traceability requires an OKR.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          profileId: formProfileId,
          targetId: formTargetId,
          relatedOKR: formRelatedOKR,
          startDate: formStartDate,
          endDate: formEndDate,
          status: formStatus,
          goalType: formGoalType,
          goalValue: Number(formGoalValue),
          expectedOutcome: formExpectedOutcome,
          budget: Number(formBudget),
          ownerId: formOwnerId || user?._id || user?.id,
          description: formDescription,
        }),
      });

      setShowCreateModal(false);
      setFormName('');
      setFormRelatedOKR('');
      setFormDescription('');
      setFormGoalValue('');
      setFormBudget('');
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create campaign. Please check required fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setTargetMessage(null);
    setIsSubmittingTarget(true);

    try {
      await apiFetch('/targets', {
        method: 'POST',
        body: JSON.stringify({
          month: targetMonth,
          profileId: targetProfileId === 'org-wide' ? null : targetProfileId,
          revenueTarget: Number(targetRevenue),
          leadsTarget: Number(targetLeads),
          qualifiedLeadsTarget: Number(targetQualifiedLeads),
          budget: Number(targetBudget),
        }),
      });

      setTargetMessage('Monthly Target saved successfully!');
      setTargetRevenue('');
      setTargetLeads('');
      setTargetQualifiedLeads('');
      setTargetBudget('');
      await fetchData();
      setTimeout(() => {
        setTargetMessage(null);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to save target');
    } finally {
      setIsSubmittingTarget(false);
    }
  };

  // KPI Rollups
  const activeCampaignsCount = campaigns.filter((c) => c.status !== 'Completed').length;
  const totalBudgetAllocated = campaigns.reduce((acc, c) => acc + (c.budget || 0), 0);
  const totalActualSpend = campaigns.reduce((acc, c) => acc + (c.spend || 0), 0);
  const totalLeadsActual = campaigns.reduce((acc, c) => acc + (c.leadsActual || 0), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-7 h-7 text-[#7a6af6]" />
              Projects & Campaigns
            </h1>
            <span className="px-3 py-1 bg-violet-100 text-[#7a6af6] text-xs font-bold rounded-full border border-violet-200">
              Phase 2
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Top of the business traceability chain. Every marketing initiative is grouped into a Campaign tied directly to a Monthly Target and related OKR.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {canManageTargets && (
            <button
              onClick={() => setShowTargetsModal(true)}
              className="px-4 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Target className="w-4 h-4 text-[#7a6af6]" />
              <span>Monthly Targets</span>
            </button>
          )}

          {canManageCampaigns && (
            <button
              onClick={() => {
                setShowCreateModal(true);
                setFormError(null);
                if (targets.length > 0 && !formTargetId) {
                  setFormTargetId(targets[0]._id);
                }
              }}
              className="px-5 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill flex items-center gap-2 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Campaign</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Campaigns */}
        <div className="glass-card p-5 rounded-3xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Campaigns</span>
            <div className="w-8 h-8 rounded-full bg-violet-50 text-[#7a6af6] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{activeCampaignsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">{campaigns.length} total initiatives registered</div>
        </div>

        {/* Card 2: Budget Allocated */}
        <div className="glass-card p-5 rounded-3xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Budget Allocated</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{formatCurrency(totalBudgetAllocated)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Across filtered initiatives</div>
        </div>

        {/* Card 3: Spend Actuals */}
        <div className="glass-card p-5 rounded-3xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spend Actuals</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{formatCurrency(totalActualSpend)}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Burn pace: {totalBudgetAllocated > 0 ? Math.round((totalActualSpend / totalBudgetAllocated) * 100) : 0}% of budget
          </div>
        </div>

        {/* Card 4: Total Leads */}
        <div className="glass-card p-5 rounded-3xl border border-white/80 shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leads Attributed</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{totalLeadsActual}</div>
          <div className="text-[11px] text-slate-500 mt-1">Direct LSQ attribution</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'In Progress', 'At Risk', 'Completed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-[#0d0e12] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st === 'all' ? 'All Statuses' : st}
            </button>
          ))}
        </div>

        {/* Profile, Goal & Search Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
          >
            <option value="all">All Brands</option>
            {profilesList.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
          >
            <option value="all">All Goals</option>
            {GOAL_TYPES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns & OKRs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchData();
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-slate-200/80">
          <Target className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-900">No campaigns found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No marketing campaigns match your active filter criteria. Click "New Campaign" to create an initiative tied to a Monthly Target.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const burnPct = camp.budget > 0 ? Math.round((camp.spend / camp.budget) * 100) : 0;
            const leadsPct = camp.goalValue > 0 ? Math.round((camp.leadsActual / camp.goalValue) * 100) : 0;

            return (
              <div
                key={camp._id}
                onClick={() => navigate(`/campaigns/${camp._id}`)}
                className="glass-card p-5 sm:p-6 rounded-3xl flex flex-col justify-between shadow-glass hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer border border-white/80 group"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {camp.profileId?.name || 'General'}
                      </span>
                      {camp.targetId && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-[#7a6af6] border border-violet-100 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {camp.targetId.month} Target
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                        camp.status === 'In Progress'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : camp.status === 'At Risk'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {camp.status === 'At Risk' && <AlertTriangle className="w-3 h-3" />}
                      {camp.status === 'In Progress' && <CheckCircle2 className="w-3 h-3" />}
                      {camp.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-[#7a6af6] transition-colors leading-snug flex items-center justify-between">
                    <span>{camp.name}</span>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7a6af6] transition-colors" />
                  </h3>

                  {/* Related OKR Banner */}
                  <div className="mt-2 p-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Related OKR
                    </span>
                    <p className="text-slate-700 font-medium line-clamp-2">{camp.relatedOKR}</p>
                  </div>

                  {/* Metrics: Budget pace & Leads Goal */}
                  <div className="space-y-3 my-4 text-xs">
                    {/* Budget Burn */}
                    <div>
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-slate-500">Budget Pace:</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(camp.spend)} / {formatCurrency(camp.budget)} ({burnPct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            burnPct > 90
                              ? 'bg-rose-500'
                              : burnPct > 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(burnPct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Leads / Goal Progress */}
                    <div>
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-slate-500">{camp.goalType} Goal:</span>
                        <span className="font-bold text-slate-900">
                          {camp.leadsActual} / {camp.goalValue} ({leadsPct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#7a6af6] transition-all"
                          style={{ width: `${Math.min(leadsPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">
                      {camp.ownerId?.name?.slice(0, 2).toUpperCase() || 'TL'}
                    </div>
                    <span className="font-medium text-slate-700">{camp.ownerId?.name || 'Unassigned'}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(camp.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} -{' '}
                      {new Date(camp.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-modal max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-modal-glass border border-white relative rounded-3xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Create Marketing Campaign</h3>
                <p className="text-xs text-slate-500">
                  Enforce strict traceability: requires Monthly Target and related OKR linkage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              {/* Campaign Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Diwali Admission Drive 2026"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                />
              </div>

              {/* Profile & Target Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand / Profile *
                  </label>
                  <select
                    value={formProfileId}
                    onChange={(e) => setFormProfileId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
                  >
                    {profilesList.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Target Link *
                  </label>
                  <select
                    required
                    value={formTargetId}
                    onChange={(e) => setFormTargetId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
                  >
                    <option value="">Select Monthly Target...</option>
                    {availableTargets.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.month} ({t.profileId?.name || 'Org-Wide'} - Target {t.leadsTarget} leads)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Related OKR */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Related OKR (Business Objective) *
                </label>
                <input
                  type="text"
                  required
                  value={formRelatedOKR}
                  onChange={(e) => setFormRelatedOKR(e.target.value)}
                  placeholder="e.g. Q4 Inbound Lead Surge: 5,000 qualified student leads across EN & Regional"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                />
              </div>

              {/* Dates & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as CampaignStatus)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
                  >
                    {CAMPAIGN_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Goal Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Goal Type *</label>
                  <select
                    value={formGoalType}
                    onChange={(e) => setFormGoalType(e.target.value as GoalType)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
                  >
                    {GOAL_TYPES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Goal Target Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={formGoalValue}
                    onChange={(e) => setFormGoalValue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Budget Allocated (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
              </div>

              {/* Owner & Expected Outcome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Campaign Owner *</label>
                  <select
                    value={formOwnerId}
                    onChange={(e) => setFormOwnerId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
                  >
                    {owners.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.name} ({o.jobRole || o.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Outcome</label>
                  <select
                    value={formExpectedOutcome}
                    onChange={(e) => setFormExpectedOutcome(e.target.value as ExpectedOutcome)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
                  >
                    {EXPECTED_OUTCOMES.map((eo) => (
                      <option key={eo} value={eo}>
                        {eo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill disabled:opacity-50 transition-transform active:scale-95"
                >
                  {isSubmitting ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MONTHLY TARGETS MODAL (Head & Admin) */}
      {showTargetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-modal max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-modal-glass border border-white relative rounded-3xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#7a6af6]" />
                  Monthly Target Management
                </h3>
                <p className="text-xs text-slate-500">
                  Set revenue, lead goals, and operating budgets per profile for {targetMonth}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTargetsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {targetMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{targetMessage}</span>
              </div>
            )}

            {/* Set Target Form */}
            <form onSubmit={handleSetTarget} className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Month (YYYY-MM) *</label>
                  <input
                    type="month"
                    required
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand / Profile *</label>
                  <select
                    value={targetProfileId}
                    onChange={(e) => setTargetProfileId(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs cursor-pointer"
                  >
                    <option value="org-wide">🏢 Org-Wide (All Profiles)</option>
                    {profilesList.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Revenue Goal (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={targetRevenue}
                    onChange={(e) => setTargetRevenue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 500000"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Leads</label>
                  <input
                    type="number"
                    min={0}
                    value={targetLeads}
                    onChange={(e) => setTargetLeads(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 800"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Qualified Leads</label>
                  <input
                    type="number"
                    min={0}
                    value={targetQualifiedLeads}
                    onChange={(e) => setTargetQualifiedLeads(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 300"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Budget (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={targetBudget}
                    onChange={(e) => setTargetBudget(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 100000"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingTarget}
                  className="px-5 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm transition-transform active:scale-95"
                >
                  {isSubmittingTarget ? 'Saving...' : 'Set Monthly Target'}
                </button>
              </div>
            </form>

            {/* Existing Targets Table */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Current Registered Targets
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="py-2 font-semibold">Month</th>
                      <th className="py-2 font-semibold">Profile</th>
                      <th className="py-2 font-semibold">Revenue Goal</th>
                      <th className="py-2 font-semibold">Leads</th>
                      <th className="py-2 font-semibold">Budget</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {targets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No registered monthly targets yet. Use the form above to register a target.
                        </td>
                      </tr>
                    ) : (
                      targets.map((t) => (
                        <tr key={t._id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-bold text-slate-900">{t.month}</td>
                          <td className="py-2.5 text-slate-700">{t.profileId?.name || '🏢 Org-Wide'}</td>
                          <td className="py-2.5 text-slate-700">{formatCurrency(t.revenueTarget)}</td>
                          <td className="py-2.5 text-[#7a6af6] font-semibold">{t.leadsTarget}</td>
                          <td className="py-2.5 text-slate-700">{formatCurrency(t.budget)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
