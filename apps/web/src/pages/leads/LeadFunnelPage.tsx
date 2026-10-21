import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { GlobalFilterBar } from '../../components/GlobalFilterBar';
import {
  TrendingUp,
  Target,
  DollarSign,
  Users,
  Percent,
  RefreshCw,
  Database,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  Share2,
} from 'lucide-react';

interface FunnelSummary {
  totalLeads: number;
  qualifiedLeads: number;
  adLeads: number;
  spend: number;
  cpl: string;
  cpql: string;
  qualifiedPercentage: number;
  targetQualified: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  conversionPct: number;
}

interface SourceMixItem {
  source: string;
  count: number;
  sharePct: number;
  qualifiedCount: number;
  qualificationRate: number;
}

interface LeadRecord {
  _id: string;
  lsqLeadId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  leadSource: string;
  stage: string;
  score: number;
  profileId?: {
    _id: string;
    name: string;
    code: string;
  };
  syncStatus: string;
  createdAt: string;
}

const PAID_AD_SOURCES = [
  'Facebook Lead Ads',
  'Google Ads',
  'Online Campaigns (SMM)',
  'Meta Re-Engaged Leads',
];

export const LeadFunnelPage: React.FC = () => {
  const navigate = useNavigate();
  const { filters } = useGlobalFilter();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [summary, setSummary] = useState<FunnelSummary | null>(null);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [sourceMix, setSourceMix] = useState<SourceMixItem[]>([]);
  const [recentLeads, setRecentLeads] = useState<LeadRecord[]>([]);

  // Filter states for source mix
  const [sourceCategory, setSourceCategory] = useState<'all' | 'paid' | 'organic' | 'whatsapp'>('all');
  const [sourceSearch, setSourceSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'funnel' | 'sources' | 'leads'>('funnel');

  const fetchFunnelData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.profileId && filters.profileId !== 'all') {
        params.append('profileId', filters.profileId);
      }
      if (filters.month) {
        params.append('month', filters.month);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';

      const [funnelRes, leadsRes] = await Promise.all([
        apiFetch<{ data: { summary: FunnelSummary; funnelStages: FunnelStage[]; sourceMix: SourceMixItem[] } }>(
          `/leads/funnel${queryString}`
        ),
        apiFetch<{ data: LeadRecord[] }>(`/leads${queryString}&limit=15`).catch(() => ({ data: [] })),
      ]);

      setSummary(funnelRes.data.summary);
      setStages(funnelRes.data.funnelStages || []);
      setSourceMix(funnelRes.data.sourceMix || []);
      setRecentLeads(leadsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load lead funnel data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnelData();
  }, [filters.profileId, filters.month]);

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await apiFetch<{
        data: {
          synced: number;
          created: number;
          updated: number;
          autoTasksCreated: number;
          discrepanciesCount: number;
        };
      }>('/leads/sync', {
        method: 'POST',
        body: JSON.stringify({ batchSize: 50, simulateDiscrepancies: false }),
      });

      setSuccessMessage(
        `LSQ Sync Complete! Synced ${res.data.synced} leads (${res.data.created} new, ${res.data.autoTasksCreated} WhatsApp auto-tasks spawned).`
      );
      setTimeout(() => setSuccessMessage(null), 6000);
      await fetchFunnelData();
    } catch (err: any) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Filtered source mix
  const filteredSources = useMemo(() => {
    return sourceMix.filter((item) => {
      const matchesSearch = item.source.toLowerCase().includes(sourceSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (sourceCategory === 'paid') {
        return PAID_AD_SOURCES.includes(item.source);
      }
      if (sourceCategory === 'whatsapp') {
        return item.source.toLowerCase().includes('whatsapp');
      }
      if (sourceCategory === 'organic') {
        return !PAID_AD_SOURCES.includes(item.source) && !item.source.toLowerCase().includes('whatsapp');
      }
      return true;
    });
  }, [sourceMix, sourceCategory, sourceSearch]);

  const maxStageCount = useMemo(() => {
    if (!stages.length) return 1;
    return Math.max(...stages.map((s) => s.count), 1);
  }, [stages]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-indigo-400" />
              Lead Funnel Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              LSQ Read-Authoritative
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Visual 12-stage pipeline progression, CPL & CPQL cost calculations, and 19-channel source acquisition mix.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/data-center')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 flex items-center gap-2 transition"
          >
            <Database className="w-4 h-4 text-purple-400" />
            Data Center & Hygiene
          </button>

          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing LSQ...' : 'Sync Leads Now'}
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <GlobalFilterBar />

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 5 Executive KPI Metric Strip */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Total Leads */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Total Pipeline</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-3 text-3xl font-bold text-white tracking-tight">
              {summary.totalLeads.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Ad-Generated</span>
              <span className="font-semibold text-indigo-300">{summary.adLeads} leads</span>
            </div>
          </div>

          {/* 2. Qualified Leads */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Qualified Leads</span>
              <Target className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 text-3xl font-bold text-white tracking-tight flex items-baseline gap-2">
              <span>{summary.qualifiedLeads}</span>
              <span className="text-xs font-normal text-emerald-400">
                ({summary.qualifiedPercentage}%)
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Target: {summary.targetQualified}</span>
              <span className={`font-semibold ${summary.qualifiedLeads >= summary.targetQualified ? 'text-emerald-400' : 'text-amber-400'}`}>
                {summary.targetQualified ? Math.round((summary.qualifiedLeads / summary.targetQualified) * 100) : 0}% achieved
              </span>
            </div>
          </div>

          {/* 3. Cost Per Lead (CPL) */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Cost Per Lead (CPL)</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3 text-3xl font-bold text-white tracking-tight">
              ₹{Number(summary.cpl).toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span className="text-[11px] font-mono text-amber-300/80">Spend / Ad Leads</span>
              <span className="font-semibold text-slate-300">₹{summary.spend.toLocaleString()}</span>
            </div>
          </div>

          {/* 4. Cost Per Qualified Lead (CPQL) */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>CPQL</span>
              <Percent className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-3 text-3xl font-bold text-white tracking-tight">
              ₹{Number(summary.cpql).toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span className="text-[11px] font-mono text-purple-300/80">Spend / Qualified</span>
              <span className="font-semibold text-purple-300">Efficiency</span>
            </div>
          </div>

          {/* 5. Qualification Rate */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Pipeline Qual. Rate</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-3 text-3xl font-bold text-white tracking-tight">
              {summary.qualifiedPercentage}%
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Formula</span>
              <span className="font-semibold text-cyan-300">Qualified / Total</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('funnel')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'funnel'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          12-Stage Visual Funnel
        </button>

        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'sources'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Share2 className="w-4 h-4" />
          19-Channel Acquisition Mix ({sourceMix.length})
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'leads'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          Recent Synced Leads ({recentLeads.length})
        </button>
      </div>

      {/* Tab 1: 12-Stage Visual Funnel */}
      {activeTab === 'funnel' && (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Funnel Progression & Drop-Off Analysis
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Full 12-stage lifecycle mapped from LeadSquared CRM with conversion percentages.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-r from-indigo-500 to-purple-600"></span>
              <span>Pipeline Stage Volume</span>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {stages.map((stageItem, index) => {
                const widthPct = Math.max(Math.round((stageItem.count / maxStageCount) * 100), 4);
                const isHighlight = ['Total Leads', 'Qualified Leads', 'Payment Received'].includes(stageItem.stage);
                const isFinalWon = stageItem.stage === 'Payment Received';

                return (
                  <div
                    key={stageItem.stage}
                    className={`p-3.5 rounded-xl border transition group ${
                      isFinalWon
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : isHighlight
                        ? 'bg-indigo-950/20 border-indigo-500/30'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 text-xs font-mono flex items-center justify-center font-bold">
                          {index + 1}
                        </span>
                        <span className={`font-semibold ${isFinalWon ? 'text-emerald-400' : isHighlight ? 'text-white' : 'text-slate-300'}`}>
                          {stageItem.stage}
                        </span>
                        {isHighlight && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            isFinalWon
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}>
                            {isFinalWon ? 'Conversion Goal' : 'Key Milestone'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-slate-400 font-sans">
                          {stageItem.conversionPct}% of total
                        </span>
                        <span className="font-bold text-white text-sm bg-slate-800 px-2.5 py-0.5 rounded-md">
                          {stageItem.count} leads
                        </span>
                      </div>
                    </div>

                    {/* Funnel Progress Bar */}
                    <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isFinalWon
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                            : isHighlight
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-sm shadow-indigo-500/50'
                            : 'bg-gradient-to-r from-slate-600 to-slate-500'
                        }`}
                        style={{ width: `${widthPct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 19-Channel Acquisition Mix */}
      {activeTab === 'sources' && (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                19-Channel Acquisition Source Breakdown
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluation of lead volume, share percentage, and qualification rate across all sources.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter sources..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
                />
              </div>

              <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
                <button
                  onClick={() => setSourceCategory('all')}
                  className={`px-3 py-1 rounded-md transition ${sourceCategory === 'all' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  All (19)
                </button>
                <button
                  onClick={() => setSourceCategory('paid')}
                  className={`px-3 py-1 rounded-md transition ${sourceCategory === 'paid' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  Paid Ads (4)
                </button>
                <button
                  onClick={() => setSourceCategory('whatsapp')}
                  className={`px-3 py-1 rounded-md transition ${sourceCategory === 'whatsapp' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => setSourceCategory('organic')}
                  className={`px-3 py-1 rounded-md transition ${sourceCategory === 'organic' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  Organic/Other
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase font-semibold text-slate-400 bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Lead Source</th>
                  <th className="py-3 px-4">Channel Type</th>
                  <th className="py-3 px-4 text-right">Lead Count</th>
                  <th className="py-3 px-4 text-right">Pipeline Share</th>
                  <th className="py-3 px-4 text-right">Qualified Leads</th>
                  <th className="py-3 px-4 text-right">Qual. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSources.map((item) => {
                  const isPaid = PAID_AD_SOURCES.includes(item.source);
                  const isWa = item.source.toLowerCase().includes('whatsapp');

                  return (
                    <tr key={item.source} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                        {item.source}
                        {item.source === 'WhatsApp Inbound' && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-normal">
                            Auto-Task Enabled
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isPaid ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Paid Ad Channel
                          </span>
                        ) : isWa ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            WhatsApp Channel
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            Organic / Referral
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                        {item.count}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-mono text-slate-400">{item.sharePct}%</span>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(item.sharePct * 2, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">
                        {item.qualifiedCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            item.qualificationRate >= 25
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : item.qualificationRate >= 10
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.qualificationRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Recent Synced Leads */}
      {activeTab === 'leads' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Recent Synced Leads from LeadSquared
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct view of inbound lead records with sync status and assigned Brand Profile.
              </p>
            </div>
            <span className="text-xs text-slate-400 italic">Showing up to 15 recent records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase font-semibold text-slate-400 bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">LSQ ID</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Brand Profile</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4 text-right">Synced At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No synced leads found. Click "Sync Leads Now" to populate.
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono text-xs text-indigo-400 font-semibold">
                        {lead.lsqLeadId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{lead.contactName || 'Unnamed Lead'}</div>
                        <div className="text-xs text-slate-400">{lead.contactEmail || lead.contactPhone || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {lead.profileId ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-200 border border-slate-700">
                            {lead.profileId.name}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Missing Profile
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {lead.leadSource}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          lead.stage === 'Payment Received'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : lead.stage === 'Qualified Leads'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {lead.stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                        {lead.score || 0}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-400 font-mono">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
