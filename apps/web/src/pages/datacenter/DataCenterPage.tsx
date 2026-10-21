import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { PROFILES, LEAD_SOURCES } from '@mmp/shared';
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Lock,
  ArrowLeft,
  X,
  Database,
  Activity,
} from 'lucide-react';

interface DiscrepancyItem {
  _id: string;
  lsqLeadId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  leadSource: string;
  stage: string;
  discrepancyReason: string;
  profileId: any;
  createdAt: string;
}

interface DataCenterData {
  healthScore: number;
  totalLeads: number;
  syncedLeads: number;
  discrepancyCount: number;
  missingProfileCount: number;
  unmappedSourceCount: number;
  lastSyncTimestamp: string;
  readAuthoritative: boolean;
  discrepancies: DiscrepancyItem[];
}

interface ProfileOption {
  _id: string;
  name: string;
  code: string;
}

export const DataCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<DataCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter tabs for discrepancies
  const [tabFilter, setTabFilter] = useState<'all' | 'profile' | 'source'>('all');

  // Available brand profiles
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  // Resolution modal state
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<DiscrepancyItem | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedLeadSource, setSelectedLeadSource] = useState<string>('');

  // Sync trigger options modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncBatchSize, setSyncBatchSize] = useState(50);
  const [simulateDiscrepancies, setSimulateDiscrepancies] = useState(false);

  const canResolve = ['admin', 'marketing_head'].includes(user?.role || '');

  const fetchDataCenter = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dcRes, profRes] = await Promise.all([
        apiFetch<{ data: DataCenterData }>('/datacenter'),
        apiFetch<{ data: ProfileOption[] }>('/reference-data/profiles').catch(() => ({
          data: PROFILES.map((p) => ({ _id: p.code, name: p.name, code: p.code })),
        })),
      ]);
      setData(dcRes.data);
      setProfiles(profRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Data Center status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataCenter();
  }, []);

  const handleTriggerSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setShowSyncModal(false);

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
        body: JSON.stringify({
          batchSize: syncBatchSize,
          simulateDiscrepancies,
        }),
      });

      setSuccessMessage(
        `Sync completed successfully! Processed ${res.data.synced} leads (${res.data.created} created, ${res.data.autoTasksCreated} WhatsApp tasks triggered, ${res.data.discrepanciesCount} discrepancies detected).`
      );
      setTimeout(() => setSuccessMessage(null), 6000);
      await fetchDataCenter();
    } catch (err: any) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const openResolveModal = (disc: DiscrepancyItem) => {
    setSelectedDiscrepancy(disc);
    setSelectedProfileId(disc.profileId?._id || disc.profileId || '');
    setSelectedLeadSource(
      LEAD_SOURCES.includes(disc.leadSource as any) ? disc.leadSource : 'Website Leads'
    );
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;

    try {
      setResolving(true);
      setError(null);

      const payload: { profileId?: string; leadSource?: string } = {};
      if (selectedProfileId) payload.profileId = selectedProfileId;
      if (selectedLeadSource) payload.leadSource = selectedLeadSource;

      await apiFetch(`/datacenter/discrepancies/${selectedDiscrepancy._id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSuccessMessage(
        `Resolved discrepancy for Lead ${selectedDiscrepancy.lsqLeadId} successfully.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      setSelectedDiscrepancy(null);
      await fetchDataCenter();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve discrepancy');
    } finally {
      setResolving(false);
    }
  };

  // Filtered discrepancies
  const filteredDiscrepancies = (data?.discrepancies || []).filter((item) => {
    if (tabFilter === 'profile') return !item.profileId || item.discrepancyReason.toLowerCase().includes('profile');
    if (tabFilter === 'source') return item.discrepancyReason.toLowerCase().includes('source');
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/leads')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Lead Funnel
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Building2 className="w-7 h-7 text-purple-400" />
              Data Center & LSQ Sync Hygiene
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-indigo-400" />
              Screen 13
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            LeadSquared synchronization health score, orphan lead tracking, and discrepancy remediation console.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSyncModal(true)}
            disabled={syncing}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Trigger Sync Now'}
          </button>
        </div>
      </div>

      {/* Read-Authoritative Security Callout */}
      <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-indigo-300">Read-Authoritative Architectural Guarantee: </span>
          LeadSquared (LSQ) CRM is the single source of truth for leads. Direct lead creation or stage mutations via the Marketing OS API are strictly prohibited (<code className="text-amber-300 font-mono">HTTP 405 READ_AUTHORITATIVE_CONSTRAINT</code>). Only missing brand profile routing and unmapped sources can be remediated below.
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI & Health Gauge Grid */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Health Score Gauge */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>LSQ Sync Health</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {data.healthScore}%
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                data.healthScore >= 90
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {data.healthScore >= 90 ? 'Healthy' : 'Action Required'}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Integrity Gauge</span>
              <span className="font-semibold text-slate-300">
                {data.syncedLeads} / {data.totalLeads} Synced
              </span>
            </div>
          </div>

          {/* Card 2: Active Discrepancies */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Hygiene Discrepancies</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3 text-3xl font-bold text-white tracking-tight">
              {data.discrepancyCount}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Breakdown</span>
              <span className="font-semibold text-amber-300">
                {data.missingProfileCount} Profiles · {data.unmappedSourceCount} Sources
              </span>
            </div>
          </div>

          {/* Card 3: Total Synced Volume */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Authoritative Records</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-3 text-3xl font-bold text-white tracking-tight">
              {data.syncedLeads.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Sync Engine</span>
              <span className="font-semibold text-purple-300">Idempotent (lsqLeadId)</span>
            </div>
          </div>

          {/* Card 4: Last Sync Timestamp */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Last Sync Run</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-3 text-xl font-bold text-white tracking-tight truncate">
              {data.lastSyncTimestamp ? new Date(data.lastSyncTimestamp).toLocaleTimeString() : 'Active Now'}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Connection</span>
              <span className="font-semibold text-cyan-300">Connected</span>
            </div>
          </div>
        </div>
      )}

      {/* Discrepancies Remediation Console */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Discrepancy Remediation Console
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review unmapped lead sources or leads missing a Brand Profile. Marketing Head can resolve routing.
            </p>
          </div>

          <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setTabFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${tabFilter === 'all' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
            >
              All Discrepancies ({data?.discrepancies.length || 0})
            </button>
            <button
              onClick={() => setTabFilter('profile')}
              className={`px-3 py-1.5 rounded-md transition ${tabFilter === 'profile' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
            >
              Missing Brand Profile ({data?.missingProfileCount || 0})
            </button>
            <button
              onClick={() => setTabFilter('source')}
              className={`px-3 py-1.5 rounded-md transition ${tabFilter === 'source' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
            >
              Unmapped Source ({data?.unmappedSourceCount || 0})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredDiscrepancies.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-white">All Clear! No Active Discrepancies</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              All LeadSquared leads have valid brand profiles and recognized lead acquisition channels.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase font-semibold text-slate-400 bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">LSQ Lead ID</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Issue Description</th>
                  <th className="py-3 px-4">Source Channel</th>
                  <th className="py-3 px-4">Detected Stage</th>
                  <th className="py-3 px-4 text-right">Remediation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDiscrepancies.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono text-xs text-purple-400 font-semibold">
                      {item.lsqLeadId}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{item.contactName || 'Lead Record'}</div>
                      <div className="text-xs text-slate-400">{item.contactEmail || item.contactPhone || '—'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {item.discrepancyReason}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-300">
                      {item.leadSource}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                        {item.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canResolve ? (
                        <button
                          onClick={() => openResolveModal(item)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition shadow-sm"
                        >
                          Resolve & Map
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Head Approval Required</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discrepancy Resolution Modal */}
      {selectedDiscrepancy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 space-y-5 bg-slate-900/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-base">
                  Resolve Discrepancy: {selectedDiscrepancy.lsqLeadId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDiscrepancy(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Contact:</span>
                <span className="text-white font-medium">{selectedDiscrepancy.contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Issue:</span>
                <span className="text-amber-400 font-semibold">{selectedDiscrepancy.discrepancyReason}</span>
              </div>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              {/* Profile Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Assign Brand Profile
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  required={selectedDiscrepancy.discrepancyReason.toLowerCase().includes('profile')}
                >
                  <option value="">Select Brand Profile...</option>
                  {profiles.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lead Source Mapping */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Map to Canonical Lead Source (19 Allowed)
                </label>
                <select
                  value={selectedLeadSource}
                  onChange={(e) => setSelectedLeadSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  required={selectedDiscrepancy.discrepancyReason.toLowerCase().includes('source')}
                >
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDiscrepancy(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
                >
                  {resolving ? 'Saving...' : 'Apply Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync Trigger Options Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 space-y-5 bg-slate-900/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  Trigger LeadSquared Sync
                </h3>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Batch Size
                </label>
                <select
                  value={syncBatchSize}
                  onChange={(e) => setSyncBatchSize(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={25}>25 Leads</option>
                  <option value={50}>50 Leads (Recommended)</option>
                  <option value={100}>100 Leads</option>
                </select>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <input
                  type="checkbox"
                  id="simulateDiscrepancies"
                  checked={simulateDiscrepancies}
                  onChange={(e) => setSimulateDiscrepancies(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700 focus:ring-purple-500"
                />
                <label htmlFor="simulateDiscrepancies" className="text-xs text-slate-300 leading-normal cursor-pointer">
                  <span className="font-semibold text-white block">Simulate Test Discrepancies</span>
                  Generates orphan leads (missing profile) and unmapped sources to test resolution workflows.
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerSync}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
              >
                Start Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
