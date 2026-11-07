import React, { useState, useEffect, useRef } from 'react';
import { useDialogFocus } from '../../lib/useDialogFocus';
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
  const previewDialogRef = useRef<HTMLDivElement>(null);
  const ruleDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(previewDialogRef, Boolean(previewModalReport), () => setPreviewModalReport(null));
  useDialogFocus(ruleDialogRef, Boolean(ruleDetailsModal), () => setRuleDetailsModal(null));

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
  }, [activeTab, selectedReportKey, filters.month, filters.departmentId]);

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
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-ui-ink text-white text-[13px] font-semibold shadow-2xl animate-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-white/70 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="space-y-5">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-[13px] text-ui-muted font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-ui-muted" />
                Automated BullMQ Schedules
              </span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink flex flex-wrap items-center gap-3">
              Reports & Automation
              <span className="status-chip status-approved px-2.5 py-0.5 text-xs font-semibold tracking-normal">
                Live Engine
              </span>
            </h1>
            <p className="text-[15px] text-ui-muted mt-1.5 max-w-[70ch]">
              Configure organizational automation rules, audit scheduled background workflows, and trigger on-demand executive report snapshots.
            </p>
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="ui-btn ui-btn-secondary bg-transparent h-11 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-full overflow-x-auto no-scrollbar">
          <div className="ui-tabs">
          <button
            onClick={() => setActiveTab('reports')}
            aria-pressed={activeTab === 'reports'}
            className={`ui-tab ${activeTab === 'reports' ? 'is-active' : ''}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Report Definitions
            <span className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${activeTab === 'reports' ? 'bg-white/20 text-white' : 'bg-ui-ink/10 text-ui-text'}`}>
              {reportDefs.length || 4}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            aria-pressed={activeTab === 'rules'}
            className={`ui-tab ${activeTab === 'rules' ? 'is-active' : ''}`}
          >
            <Zap className="w-3.5 h-3.5" />
            Automation Rules
            <span className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${activeTab === 'rules' ? 'bg-white/20 text-white' : 'bg-ui-ink/10 text-ui-text'}`}>
              {rules.length || 6}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('viewer')}
            aria-pressed={activeTab === 'viewer'}
            className={`ui-tab ${activeTab === 'viewer' ? 'is-active' : ''}`}
          >
            <Eye className="w-3.5 h-3.5" />
            Live Report Viewer
          </button>
        </div>
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
              // Cadence is named in the chip itself; no colour coding needed.
              const cadenceColor = 'bg-white/80 text-ui-text border-transparent';

              return (
                <div
                  key={def._id}
                  className="glass-card p-5 flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Cadence & Schedule */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cadenceColor}`}>
                        {def.cadence}
                      </span>
                      <span className="text-[11px] font-semibold text-ui-muted flex items-center gap-1">
                        <Clock className="w-3 h-3 text-ui-muted" />
                        {def.scheduleDisplay}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-ui-ink">
                      {def.name}
                    </h3>
                    <p className="text-xs text-ui-muted mt-1.5 leading-relaxed">
                      {def.description}
                    </p>

                    {/* Recipients */}
                    <div className="mt-4 pt-3 border-t border-ui-line flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-ui-muted">Recipients:</span>
                      {def.recipients.map((r) => (
                        <span key={r} className="px-2 py-0.5 rounded-full bg-white/80 text-ui-text text-[11px] font-medium">
                          {r.replace('_', ' ')}
                        </span>
                      ))}
                    </div>

                    {/* Last Generated At */}
                    <div className="mt-3 text-[11px] text-ui-muted flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>
                        {def.lastGeneratedAt
                          ? `Last run: ${new Date(def.lastGeneratedAt).toLocaleDateString()} at ${new Date(def.lastGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Not generated yet'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-4 border-t border-ui-line flex items-center gap-2">
                    {hasPermission('report.configure') && (
                      <button
                        onClick={() => handleGenerateReport(def.reportKey)}
                        disabled={isGenerating}
                        className="ui-btn ui-btn-primary h-11 flex-1"
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
                      aria-label="View Live Interactive Data"
                      className="ui-icon-btn"
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
          <div className="glass-panel rounded-ui-panel p-4 sm:p-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-ui-ink" />
              <span className="text-[13px] font-semibold text-ui-text">
                BullMQ Automation Dispatcher &bull; 6 Fixed Marketing OS Rules
              </span>
            </div>
            <span className="text-[11px] text-ui-muted">
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
                  className={`glass-card p-5 ${
                    rule.active ? 'border-white/80 shadow-glass' : 'border-slate-200/60 bg-slate-50/50 opacity-80'
                  }`}
                >
                  {/* Top Bar: Trigger pill & Active toggle */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/80 text-ui-text text-[11px] font-semibold">
                        {rule.trigger}
                      </span>
                      <span className="text-[11px] text-ui-muted font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-ui-muted" />
                        {rule.schedule}
                      </span>
                    </div>

                    {/* Active Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <span className={`status-chip ${rule.active ? 'status-approved' : 'status-not-started'} text-[11px] font-semibold px-2 py-0.5`}>
                        {rule.active ? 'Active' : 'Paused'}
                      </span>
                      {hasPermission('automation.manage') && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={rule.active}
                          aria-label={`${rule.name}: ${rule.active ? 'active' : 'paused'}`}
                          onClick={() => handleToggleRule(rule)}
                          disabled={isToggling}
                          className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center rounded-full disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
                        >
                          <span
                            aria-hidden="true"
                            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 flex items-center ${
                              rule.active ? 'bg-ui-ink' : 'bg-ui-muted/60'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                                rule.active ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-ui-ink">{rule.name}</h3>
                  <p className="text-xs text-ui-muted mt-1 leading-relaxed">{rule.description}</p>

                  {/* Last Run Info */}
                  <div className="mt-4 p-3 rounded-xl bg-white/60 text-xs">
                    <div className="flex items-center justify-between text-ui-text">
                      <span className="font-semibold">Last Execution:</span>
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        {rule.lastRunStatus === 'success' && (
                          <span className="status-chip status-approved px-1.5 py-0.5 font-semibold">
                            SUCCESS
                          </span>
                        )}
                        {rule.lastRunStatus === 'failed' && (
                          <span className="status-chip status-changes px-1.5 py-0.5 font-semibold">
                            FAILED
                          </span>
                        )}
                        {rule.lastRunStatus === 'running' && (
                          <span className="status-chip status-waiting px-1.5 py-0.5 font-semibold animate-pulse">
                            RUNNING
                          </span>
                        )}
                        {rule.lastRunStatus === 'idle' && (
                          <span className="status-chip status-not-started px-1.5 py-0.5 font-semibold">
                            IDLE
                          </span>
                        )}
                        {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                    {rule.lastRunSummary && (
                      <p className="mt-1 text-[11px] text-ui-muted truncate">
                        {rule.lastRunSummary}
                      </p>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-ui-line flex items-center justify-between gap-2">
                    <button
                      onClick={() => setRuleDetailsModal(rule)}
                      className="min-h-[44px] text-xs font-semibold text-ui-text hover:underline underline-offset-4 flex items-center gap-1 rounded-full"
                    >
                      <Sliders className="w-3 h-3" />
                      View Config & Logs
                    </button>

                    {hasPermission('automation.manage') && (
                      <button
                        onClick={() => handleRunRule(rule)}
                        disabled={isRunning}
                        className="ui-btn ui-btn-primary h-11"
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
          <div className="glass-panel rounded-ui-panel p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor="report-viewer-select" className="text-[13px] font-medium text-ui-muted">Select Report:</label>
              <select
                id="report-viewer-select"
                value={selectedReportKey}
                onChange={(e) => setSelectedReportKey(e.target.value)}
                className="ui-select"
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
                className="ui-btn ui-btn-secondary h-11"
              >
                <RefreshCw className={`w-3 h-3 ${isLiveReportLoading ? 'animate-spin' : ''}`} />
                Reload
              </button>

              {liveReport && (
                <button
                  onClick={() => copyReportHtml(liveReport.html)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  <Copy className="w-3 h-3" />
                  {copiedHtml ? 'Copied HTML!' : 'Copy HTML'}
                </button>
              )}
            </div>
          </div>

          {/* Report Display Container */}
          {isLiveReportLoading ? (
            <div className="glass-panel rounded-ui-panel p-12 text-center">
              <RefreshCw className="w-8 h-8 text-ui-ink animate-spin mx-auto mb-3" />
              <p className="text-xs text-ui-muted font-semibold">Generating live scoped report analytics...</p>
            </div>
          ) : liveReport ? (
            <div className="glass-panel rounded-ui-panel p-5 sm:p-8 space-y-6">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-ui-line gap-3">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/80 text-ui-text text-[11px] font-semibold">
                    {liveReport.cadence} Report
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-ui-ink mt-2">
                    {liveReport.title}
                  </h2>
                  <p className="text-xs text-ui-muted mt-0.5">
                    Data scoped to active filters &bull; Generated {new Date(liveReport.generatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(liveReport.summary || {}).map(([key, val]) => (
                  <div key={key} className="glass-card p-4">
                    <span className="text-xs font-medium text-ui-muted block">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="text-xl font-semibold text-ui-ink mt-1 block tabular-nums">
                      {typeof val === 'number' ? val.toLocaleString() : String(val)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Report Tables */}
              {liveReport.tables.map((table, idx) => (
                <div key={idx} className="glass-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-ui-line flex items-center justify-between gap-2">
                    <h3 className="text-[13px] font-semibold text-ui-text">
                      {table.title}
                    </h3>
                    <span className="text-[11px] text-ui-muted font-semibold">
                      {table.rows.length} rows
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="ui-table w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-ui-line">
                          {table.columns.map((col, cIdx) => (
                            <th key={cIdx} className="px-4 py-2.5 text-ui-muted text-xs">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ui-line">
                        {table.rows.length === 0 ? (
                          <tr>
                            <td colSpan={table.columns.length} className="px-4 py-8 text-center text-ui-muted">
                              No data records available for current filter scope.
                            </td>
                          </tr>
                        ) : (
                          table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-white/60 transition-colors">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-4 py-2.5 text-ui-text font-medium">
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
            <div className="glass-panel rounded-ui-panel p-12 text-center text-ui-muted">
              Select a report above to view its live data.
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PREVIEW HTML MODAL */}
      {/* ------------------------------------------------------------- */}
      {previewModalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim backdrop-blur-md animate-fade-in">
          <div
            ref={previewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-preview-title"
            className="glass-modal max-w-4xl w-full max-h-[90vh] flex flex-col p-6"
          >
            <div className="flex items-center justify-between pb-4 border-b border-ui-line shrink-0">
              <div>
                <span className="status-chip status-approved px-2.5 py-0.5 text-[11px] font-semibold">
                  Generated Snapshot
                </span>
                <h3 id="report-preview-title" className="text-lg font-bold text-ui-ink mt-1">
                  {previewModalReport.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyReportHtml(previewModalReport.html)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  <Copy className="w-3.5 h-3.5 inline mr-1" />
                  {copiedHtml ? 'Copied!' : 'Copy HTML'}
                </button>
                <button
                  onClick={() => setPreviewModalReport(null)}
                  aria-label="Close" className="ui-icon-btn"
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
                sandbox=""
                className="w-full h-[550px] border-0"
              />
            </div>

            <div className="pt-3 border-t border-ui-line flex justify-end">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim backdrop-blur-md animate-fade-in">
          <div
            ref={ruleDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rule-details-title"
            className="glass-modal max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <div>
                <span className="text-[10px] font-bold text-ui-ink">
                  {ruleDetailsModal.ruleKey}
                </span>
                <h3 id="rule-details-title" className="text-base font-bold text-ui-ink">
                  {ruleDetailsModal.name}
                </h3>
              </div>
              <button
                onClick={() => setRuleDetailsModal(null)}
                aria-label="Close" className="ui-icon-btn"
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

            <div className="pt-3 border-t border-ui-line flex justify-end">
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
