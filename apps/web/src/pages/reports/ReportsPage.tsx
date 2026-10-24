import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import {
  BarChart3,
  Zap,
  Clock,
  Play,
  CheckCircle2,
  RefreshCw,
  Copy,
  Eye,
  Sliders,
  X,
  Sparkles,
} from 'lucide-react';

interface ReportDef {
  _id: string;
  reportKey: string;
  name: string;
  description: string;
  cadence: string;
  scheduleDisplay: string;
  recipients: string[];
  lastGeneratedAt?: string;
  lastGeneratedSummary?: {
    generatedAt: string;
    generatedByName: string;
    summaryMetrics: Record<string, any>;
  };
}

interface AutomationRule {
  _id: string;
  ruleKey: string;
  name: string;
  description: string;
  trigger: string;
  schedule: string;
  action: string;
  active: boolean;
  lastRunAt?: string;
  lastRunStatus: 'idle' | 'success' | 'failed' | 'running';
  lastRunSummary?: string;
  lastRunDetails?: any;
  config?: Record<string, any>;
}

interface GeneratedReport {
  reportKey: string;
  title: string;
  cadence: string;
  generatedAt: string;
  summary: Record<string, any>;
  tables: {
    title: string;
    columns: string[];
    rows: (string | number)[][];
  }[];
  html: string;
}

export const ReportsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { filters } = useGlobalFilter();

  const [activeTab, setActiveTab] = useState<'reports' | 'rules' | 'viewer'>('reports');
  const [reportDefs, setReportDefs] = useState<ReportDef[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Selected report for live viewer & modal preview
  const [selectedReportKey, setSelectedReportKey] = useState<string>('weekly_marketing');
  const [liveReport, setLiveReport] = useState<GeneratedReport | null>(null);
  const [isLiveReportLoading, setIsLiveReportLoading] = useState(false);
  const [previewModalReport, setPreviewModalReport] = useState<GeneratedReport | null>(null);
  const [ruleDetailsModal, setRuleDetailsModal] = useState<AutomationRule | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch report definitions and automation rules
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [defsRes, rulesRes] = await Promise.all([
        apiFetch<{ definitions: ReportDef[] }>('/api/reports/definitions'),
        apiFetch<{ rules: AutomationRule[] }>('/api/automation/rules'),
      ]);
      setReportDefs(defsRes.definitions || []);
      setRules(rulesRes.rules || []);
    } catch (err: any) {
      console.error('Failed to load reports/rules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch live report when viewer tab is opened or key changes
  const fetchLiveReport = async (key: string) => {
    setIsLiveReportLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.month) queryParams.set('month', filters.month);
      if (filters.profileId && filters.profileId !== 'all') queryParams.set('profileId', filters.profileId);
      if (filters.departmentId && filters.departmentId !== 'all') queryParams.set('departmentId', filters.departmentId);

      const url = `/api/reports/view/${key}?${queryParams.toString()}`;
      const res = await apiFetch<{ success: boolean; report: GeneratedReport }>(url);
      setLiveReport(res.report);
    } catch (err: any) {
      console.error('Failed to load live report:', err);
    } finally {
      setIsLiveReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'viewer') {
      fetchLiveReport(selectedReportKey);
    }
  }, [activeTab, selectedReportKey, filters.month, filters.profileId, filters.departmentId]);

  // Generate Report on Demand ("Generate Now")
  const handleGenerateReport = async (key: string, sendEmail: boolean = false) => {
    setActionLoading(`generate-${key}`);
    try {
      const res = await apiFetch<{ success: boolean; report: GeneratedReport }>(
        `/api/reports/definitions/${key}/generate`,
        {
          method: 'POST',
          body: JSON.stringify({
            sendEmail,
            month: filters.month,
            profileId: filters.profileId !== 'all' ? filters.profileId : undefined,
          }),
        }
      );
      showToast(`Successfully generated ${res.report.title}!`);
      setPreviewModalReport(res.report);
      // Refresh definitions list to update lastGeneratedAt
      fetchData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Automation Rule (Pause / Resume)
  const handleToggleRule = async (rule: AutomationRule) => {
    setActionLoading(`toggle-${rule._id}`);
    try {
      const res = await apiFetch<{ rule: AutomationRule }>(`/api/automation/rules/${rule._id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !rule.active }),
      });
      setRules((prev) => prev.map((r) => (r._id === rule._id ? res.rule : r)));
      showToast(`Rule "${rule.name}" is now ${res.rule.active ? 'Active' : 'Paused'}.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Run Automation Rule Now
  const handleRunRule = async (rule: AutomationRule) => {
    setActionLoading(`run-${rule._id}`);
    try {
      const res = await apiFetch<{ result: any }>(`/api/automation/rules/${rule._id}/run`, {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      });
      showToast(`Executed "${rule.name}": ${res.result.summary || 'Success'}`);
      fetchData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const copyReportHtml = (htmlContent: string) => {
    navigator.clipboard.writeText(htmlContent);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
    showToast('HTML copied to clipboard!');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900/90 text-white text-xs font-semibold shadow-2xl backdrop-blur-md border border-white/20 animate-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-[28px] border border-white/80 shadow-glass relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold tracking-wide uppercase">
                Screen 14 &bull; Phase 7
              </span>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Automated BullMQ Schedules
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              Reports & Automation
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                Live Engine
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              Configure organizational automation rules, audit scheduled background workflows, and trigger on-demand executive report snapshots.
            </p>
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 hover:bg-white text-slate-700 text-xs font-bold border border-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'reports'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-white/60 text-slate-600 hover:bg-white border border-slate-200/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Report Definitions
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'reports' ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {reportDefs.length || 4}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'rules'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-white/60 text-slate-600 hover:bg-white border border-slate-200/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Automation Rules
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'rules' ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {rules.length || 6}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('viewer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'viewer'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-white/60 text-slate-600 hover:bg-white border border-slate-200/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Live Report Viewer
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: REPORT DEFINITIONS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {reportDefs.map((def) => {
              const isGenerating = actionLoading === `generate-${def.reportKey}`;
              const cadenceColor =
                def.cadence === 'Weekly'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : def.cadence === 'Monthly'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200';

              return (
                <div
                  key={def._id}
                  className="glass-panel p-5 rounded-2xl border border-white/80 shadow-glass flex flex-col justify-between hover:shadow-md transition-all group"
                >
                  <div>
                    {/* Header: Cadence & Schedule */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cadenceColor}`}>
                        {def.cadence}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {def.scheduleDisplay}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                      {def.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {def.description}
                    </p>

                    {/* Recipients */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recipients:</span>
                      {def.recipients.map((r) => (
                        <span key={r} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {r.replace('_', ' ')}
                        </span>
                      ))}
                    </div>

                    {/* Last Generated At */}
                    <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>
                        {def.lastGeneratedAt
                          ? `Last run: ${new Date(def.lastGeneratedAt).toLocaleDateString()} at ${new Date(def.lastGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Not generated yet'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                    {hasPermission('report.configure') && (
                      <button
                        onClick={() => handleGenerateReport(def.reportKey)}
                        disabled={isGenerating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white" />
                            Generate Now
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedReportKey(def.reportKey);
                        setActiveTab('viewer');
                      }}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                      title="View Live Interactive Data"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: AUTOMATION RULES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="glass-panel p-4 rounded-2xl border border-white/80 shadow-glass flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-800">
                BullMQ Automation Dispatcher &bull; 6 Fixed Marketing OS Rules
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Active Rules: <strong>{rules.filter((r) => r.active).length} / {rules.length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => {
              const isToggling = actionLoading === `toggle-${rule._id}`;
              const isRunning = actionLoading === `run-${rule._id}`;

              return (
                <div
                  key={rule._id}
                  className={`glass-panel p-5 rounded-2xl border transition-all ${
                    rule.active ? 'border-white/80 shadow-glass' : 'border-slate-200/60 bg-slate-50/50 opacity-80'
                  }`}
                >
                  {/* Top Bar: Trigger pill & Active toggle */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                        {rule.trigger}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {rule.schedule}
                      </span>
                    </div>

                    {/* Active Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold ${rule.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {rule.active ? 'Active' : 'Paused'}
                      </span>
                      {hasPermission('automation.manage') && (
                        <button
                          onClick={() => handleToggleRule(rule)}
                          disabled={isToggling}
                          className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                            rule.active ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                              rule.active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{rule.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{rule.description}</p>

                  {/* Last Run Info */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold">Last Execution:</span>
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        {rule.lastRunStatus === 'success' && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                            SUCCESS
                          </span>
                        )}
                        {rule.lastRunStatus === 'failed' && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                            FAILED
                          </span>
                        )}
                        {rule.lastRunStatus === 'running' && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold animate-pulse">
                            RUNNING
                          </span>
                        )}
                        {rule.lastRunStatus === 'idle' && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">
                            IDLE
                          </span>
                        )}
                        {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                    {rule.lastRunSummary && (
                      <p className="mt-1 text-[11px] text-slate-500 truncate">
                        {rule.lastRunSummary}
                      </p>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setRuleDetailsModal(rule)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                    >
                      <Sliders className="w-3 h-3" />
                      View Config & Logs
                    </button>

                    {hasPermission('automation.manage') && (
                      <button
                        onClick={() => handleRunRule(rule)}
                        disabled={isRunning}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      >
                        {isRunning ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 fill-white" />
                        )}
                        Run Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: LIVE INTERACTIVE REPORT VIEWER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'viewer' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-white/80 shadow-glass flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Select Report:</span>
              <select
                value={selectedReportKey}
                onChange={(e) => setSelectedReportKey(e.target.value)}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {reportDefs.map((def) => (
                  <option key={def.reportKey} value={def.reportKey}>
                    {def.name} ({def.cadence})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLiveReport(selectedReportKey)}
                disabled={isLiveReportLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-3 h-3 ${isLiveReportLoading ? 'animate-spin' : ''}`} />
                Reload
              </button>

              {liveReport && (
                <button
                  onClick={() => copyReportHtml(liveReport.html)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition-colors shadow-sm"
                >
                  <Copy className="w-3 h-3" />
                  {copiedHtml ? 'Copied HTML!' : 'Copy HTML'}
                </button>
              )}
            </div>
          </div>

          {/* Report Display Container */}
          {isLiveReportLoading ? (
            <div className="glass-panel p-12 rounded-3xl border border-white/80 text-center">
              <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-semibold">Generating live scoped report analytics...</p>
            </div>
          ) : liveReport ? (
            <div className="glass-panel p-6 sm:p-8 rounded-[28px] border border-white/80 shadow-glass space-y-6">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-3">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">
                    {liveReport.cadence} Report
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">
                    {liveReport.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Data scoped to active filters &bull; Generated {new Date(liveReport.generatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(liveReport.summary || {}).map(([key, val]) => (
                  <div key={key} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="text-lg font-black text-slate-900 mt-1 block">
                      {typeof val === 'number' ? val.toLocaleString() : String(val)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Report Tables */}
              {liveReport.tables.map((table, idx) => (
                <div key={idx} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {table.title}
                    </h3>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      {table.rows.length} rows
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40">
                          {table.columns.map((col, cIdx) => (
                            <th key={cIdx} className="px-4 py-2.5 font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {table.rows.length === 0 ? (
                          <tr>
                            <td colSpan={table.columns.length} className="px-4 py-8 text-center text-slate-400">
                              No data records available for current filter scope.
                            </td>
                          </tr>
                        ) : (
                          table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-4 py-2.5 text-slate-700 font-medium">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-3xl border border-white/80 text-center text-slate-400">
              Select a report above to view its live data.
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PREVIEW HTML MODAL */}
      {/* ------------------------------------------------------------- */}
      {previewModalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="glass-modal max-w-4xl w-full max-h-[90vh] flex flex-col p-6 shadow-modal-glass border border-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Generated Snapshot
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {previewModalReport.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyReportHtml(previewModalReport.html)}
                  className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200"
                >
                  <Copy className="w-3.5 h-3.5 inline mr-1" />
                  {copiedHtml ? 'Copied!' : 'Copy HTML'}
                </button>
                <button
                  onClick={() => setPreviewModalReport(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Embedded HTML Preview Frame */}
            <div className="flex-1 overflow-y-auto my-4 rounded-xl border border-slate-200 bg-white p-4">
              <iframe
                title="Report HTML Preview"
                srcDoc={previewModalReport.html}
                className="w-full h-[550px] border-0"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewModalReport(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RULE DETAILS MODAL */}
      {/* ------------------------------------------------------------- */}
      {ruleDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="glass-modal max-w-lg w-full p-6 shadow-modal-glass border border-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                  {ruleDetailsModal.ruleKey}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {ruleDetailsModal.name}
                </h3>
              </div>
              <button
                onClick={() => setRuleDetailsModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-700 block">Trigger & Schedule:</span>
                <span className="text-slate-600">{ruleDetailsModal.trigger} &bull; {ruleDetailsModal.schedule}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 block">Action:</span>
                <span className="text-slate-600">{ruleDetailsModal.action}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 block">Configuration:</span>
                <pre className="mt-1 p-2.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(ruleDetailsModal.config || {}, null, 2)}
                </pre>
              </div>
              <div>
                <span className="font-bold text-slate-700 block">Last Run Details:</span>
                <pre className="mt-1 p-2.5 rounded-xl bg-slate-100 text-slate-800 font-mono text-[11px] overflow-x-auto max-h-36">
                  {JSON.stringify(ruleDetailsModal.lastRunDetails || { summary: ruleDetailsModal.lastRunSummary }, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setRuleDetailsModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
