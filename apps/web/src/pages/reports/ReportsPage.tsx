import React, { useState, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  Download,
  Layers,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Award,
  Filter,
  RefreshCw,
  Send,
  Printer,
  ChevronRight,
  ShieldAlert,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';

// Color Palette matching docs/ui-details.md and obsidian/glass tokens
const COLORS = {
  primary: '#7a6af6',
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  slate: '#64748b',
};

const CHART_PALETTE = ['#7a6af6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

type ReportTab = 'scorecard' | 'department' | 'team' | 'bottlenecks' | 'content' | 'individual';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isWorker = user?.role === 'worker';
  const isDeptLead = user?.role === 'dept_lead';

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<ReportTab>(isWorker ? 'individual' : 'scorecard');
  const [datePreset, setDatePreset] = useState<'7d' | '30d' | 'q3' | 'ytd' | 'custom'>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDept, setSelectedDept] = useState(isDeptLead ? user?.department || '' : '');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState(user?.userId || user?.id || '');

  // Modals & Drill-down
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [drillDownItem, setDrillDownItem] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scheduled Report Form State
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleFreq, setScheduleFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [scheduleFormat, setScheduleFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [scheduleRecipients, setScheduleRecipients] = useState(user?.email || '');

  // Saved Filters
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; tab: ReportTab; preset: string }>>(() => {
    try {
      const stored = localStorage.getItem('mmp_saved_filters');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Calculate Date Bounds
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    if (datePreset === '7d') start.setDate(end.getDate() - 7);
    else if (datePreset === '30d') start.setDate(end.getDate() - 30);
    else if (datePreset === 'q3') {
      start.setFullYear(2026, 6, 1);
      end.setFullYear(2026, 8, 30);
    } else if (datePreset === 'ytd') {
      start.setFullYear(2026, 0, 1);
    } else if (datePreset === 'custom' && startDate && endDate) {
      return { start: startDate, end: endDate };
    }
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  };

  const { start: queryStart, end: queryEnd } = getDateRange();

  // 1. Fetch Scorecard Report
  const { data: scorecardData, isLoading: loadingScorecard, refetch: refetchScorecard } = useQuery({
    queryKey: ['report-scorecard', queryStart, queryEnd],
    queryFn: async () => {
      const res = await fetch(`/api/reports/scorecard?startDate=${queryStart}&endDate=${queryEnd}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load scorecard');
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === 'scorecard',
  });

  // 2. Fetch Department Report
  const { data: deptData, isLoading: loadingDept, refetch: refetchDept } = useQuery({
    queryKey: ['report-dept', queryStart, queryEnd, selectedDept],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: queryStart, endDate: queryEnd });
      if (selectedDept) params.append('department', selectedDept);
      const res = await fetch(`/api/reports/department?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load department report');
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === 'department',
  });

  // 3. Fetch Team Report
  const { data: teamData, isLoading: loadingTeam, refetch: refetchTeam } = useQuery({
    queryKey: ['report-team', queryStart, queryEnd, selectedTeam],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: queryStart, endDate: queryEnd });
      if (selectedTeam) params.append('team', selectedTeam);
      const res = await fetch(`/api/reports/team?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load team report');
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === 'team',
  });

  // 4. Fetch Bottlenecks Report
  const { data: bottleneckData, isLoading: loadingBottlenecks, refetch: refetchBottlenecks } = useQuery({
    queryKey: ['report-bottlenecks', queryStart, queryEnd],
    queryFn: async () => {
      const res = await fetch(`/api/reports/bottlenecks?startDate=${queryStart}&endDate=${queryEnd}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load bottlenecks report');
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === 'bottlenecks',
  });

  // 5. Fetch Content Performance Report
  const { data: contentData, isLoading: loadingContent, refetch: refetchContent } = useQuery({
    queryKey: ['report-content', queryStart, queryEnd, selectedDept],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: queryStart, endDate: queryEnd });
      if (selectedDept) params.append('sourceDepartment', selectedDept);
      const res = await fetch(`/api/reports/content?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load content report');
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === 'content',
  });

  // 6. Fetch Individual Report
  const targetId = isWorker ? (user?.userId || user?.id) : selectedWorkerId || user?.userId || user?.id;
  const { data: individualData, isLoading: loadingIndividual, refetch: refetchIndividual } = useQuery({
    queryKey: ['report-individual', targetId, queryStart, queryEnd],
    queryFn: async () => {
      const res = await fetch(`/api/reports/individual/${targetId}?startDate=${queryStart}&endDate=${queryEnd}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load worker report');
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === 'individual' && !!targetId,
  });

  // Fetch Workers List for Select Dropdown (Leads/Admin only)
  const { data: workersList } = useQuery({
    queryKey: ['users-workers-list'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?role=worker', { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data?.users || json.data || [];
    },
    enabled: !isWorker && activeTab === 'individual',
  });

  // Scheduled Reports List
  const { data: scheduledList, refetch: refetchScheduled } = useQuery({
    queryKey: ['reports-scheduled'],
    queryFn: async () => {
      const res = await fetch('/api/reports/scheduled', { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  // Create Scheduled Report Mutation
  const scheduleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create scheduled report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-scheduled'] });
      setShowScheduleModal(false);
      setFeedbackMsg({ type: 'success', text: 'Scheduled automated report successfully created!' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err.message || 'Error creating scheduled report' });
    },
  });

  // Trigger Streaming Export Download
  const handleExport = async (format: 'xlsx' | 'csv') => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        report: activeTab,
        format,
        startDate: queryStart,
        endDate: queryEnd,
      });
      if (selectedDept) params.append('department', selectedDept);
      if (selectedTeam) params.append('team', selectedTeam);
      if (selectedWorkerId) params.append('userId', selectedWorkerId);

      const response = await fetch(`/api/reports/export?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Export generation failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}-report-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Save Current Filter
  const handleSaveFilter = () => {
    const name = prompt('Enter a name for this saved filter configuration:');
    if (!name) return;
    const newFilter = { name, tab: activeTab, preset: datePreset };
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('mmp_saved_filters', JSON.stringify(updated));
  };

  const handleApplySavedFilter = (f: { name: string; tab: ReportTab; preset: string }) => {
    setActiveTab(f.tab);
    setDatePreset(f.preset as any);
  };

  const handlePrint = () => {
    window.print();
  };

  const scorecardUniqueId = useId();

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Reports & Analytics</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#7a6af6]/10 text-[#7a6af6] font-bold border border-[#7a6af6]/20">
                Phase 9 Live
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Executive scorecards, throughput velocity, bottleneck diagnostics, and worker efficiency
          </p>
        </div>

        {/* Action Buttons: Export & Schedule */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Print-friendly view"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-3.5 py-2 bg-[#7a6af6] hover:bg-[#6857eb] text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule Email</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs (Report Picker) */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
        {!isWorker && (
          <>
            <button
              onClick={() => setActiveTab('scorecard')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'scorecard'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-[#7a6af6]" />
              <span>Management Scorecard</span>
            </button>

            <button
              onClick={() => setActiveTab('department')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'department'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Department Usage</span>
            </button>

            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'team'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              <span>Team Velocity</span>
            </button>

            <button
              onClick={() => setActiveTab('bottlenecks')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'bottlenecks'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Bottlenecks & Holds</span>
            </button>

            <button
              onClick={() => setActiveTab('content')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'content'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Content Pipeline</span>
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('individual')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'individual'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-amber-500" />
          <span>{isWorker ? 'My Efficiency & Output' : 'Worker Performance'}</span>
        </button>
      </div>

      {/* Shared Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white shadow-glass flex flex-wrap items-center justify-between gap-4">
        {/* Date Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Timeframe:</span>
          </span>
          <div className="p-1 bg-slate-100 rounded-xl flex items-center gap-1 text-xs font-semibold">
            {(['7d', '30d', 'q3', 'ytd', 'custom'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  datePreset === preset ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === '7d'
                  ? 'Last 7 Days'
                  : preset === '30d'
                  ? 'Last 30 Days'
                  : preset === 'q3'
                  ? 'Q3 2026'
                  : preset === 'ytd'
                  ? 'Year to Date'
                  : 'Custom'}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white"
              />
            </div>
          )}
        </div>

        {/* Dynamic Filters per Tab */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Department Filter (Admin/Lead only) */}
          {(activeTab === 'department' || activeTab === 'content') && !isDeptLead && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Department:</span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                <option value="">All Departments</option>
                <option value="Social Media">Social Media</option>
                <option value="Performance (Ads)">Performance (Ads)</option>
                <option value="Sales">Sales</option>
                <option value="Academics">Academics</option>
              </select>
            </div>
          )}

          {/* Team Filter */}
          {activeTab === 'team' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Team:</span>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                <option value="">All Production Teams</option>
                <option value="graphics">Graphics</option>
                <option value="editor">Editor</option>
                <option value="content">Content / Scripts</option>
                <option value="cinematography">Cinematography</option>
              </select>
            </div>
          )}

          {/* Worker Selector (Individual Tab) */}
          {activeTab === 'individual' && !isWorker && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Inspect Worker:</span>
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                <option value={user?.userId || user?.id}>Myself ({user?.name})</option>
                {workersList?.map((w: any) => (
                  <option key={w._id || w.id} value={w._id || w.id}>
                    {w.name} ({w.teamId || w.team || 'worker'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Saved Filters Dropdown & Save Button */}
          <div className="flex items-center gap-2">
            {savedFilters.length > 0 && (
              <select
                onChange={(e) => {
                  const f = savedFilters.find((x) => x.name === e.target.value);
                  if (f) handleApplySavedFilter(f);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                defaultValue=""
              >
                <option value="" disabled>
                  Load Saved Filter...
                </option>
                {savedFilters.map((f, i) => (
                  <option key={i} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleSaveFilter}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
              title="Save current filters"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Filter</span>
            </button>

            <button
              onClick={() => {
                if (activeTab === 'scorecard') refetchScorecard();
                else if (activeTab === 'department') refetchDept();
                else if (activeTab === 'team') refetchTeam();
                else if (activeTab === 'bottlenecks') refetchBottlenecks();
                else if (activeTab === 'content') refetchContent();
                else if (activeTab === 'individual') refetchIndividual();
              }}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
              title="Refresh dataset"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MANAGEMENT SCORECARD (MoM Trends & Demand Forecast) */}
      {/* ========================================================================= */}
      {activeTab === 'scorecard' && (
        <div className="space-y-6">
          {loadingScorecard ? (
            <div className="p-12 text-center text-slate-400">Loading executive scorecard...</div>
          ) : (
            <>
              {/* Executive KPI Cards with MoM Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Total Requests Ingested',
                    value: scorecardData?.scorecard?.totalRequests?.value || 0,
                    delta: scorecardData?.scorecard?.totalRequests?.momChangePct || 0,
                    icon: Layers,
                    color: 'text-[#7a6af6]',
                  },
                  {
                    label: 'Delivered Content Units',
                    value: scorecardData?.scorecard?.publishedContent?.value || 0,
                    delta: scorecardData?.scorecard?.publishedContent?.momChangePct || 0,
                    icon: CheckCircle2,
                    color: 'text-emerald-600',
                  },
                  {
                    label: 'On-Time Delivery Rate',
                    value: `${scorecardData?.scorecard?.onTimeDeliveryRate?.value || 100}%`,
                    delta: scorecardData?.scorecard?.onTimeDeliveryRate?.momChangePct || 0,
                    icon: Clock,
                    color: 'text-blue-600',
                  },
                  {
                    label: 'Avg Turnaround Time',
                    value: `${scorecardData?.scorecard?.avgTurnaroundDays?.value || 0} days`,
                    delta: scorecardData?.scorecard?.avgTurnaroundDays?.momChangePct || 0,
                    icon: TrendingUp,
                    color: 'text-purple-600',
                    inverse: true, // Lower is better
                  },
                ].map((kpi, idx) => {
                  const isPositive = kpi.inverse ? kpi.delta <= 0 : kpi.delta >= 0;
                  return (
                    <div key={idx} className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">{kpi.label}</span>
                        <kpi.icon className="w-4 h-4" />
                      </div>
                      <div className={`text-2xl sm:text-3xl font-extrabold ${kpi.color}`}>
                        {kpi.value}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span
                          className={`text-xs font-bold flex items-center ${
                            isPositive ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {Math.abs(kpi.delta)}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">vs previous month</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Demand vs Capacity Forecast Gauge */}
              <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Demand vs. Production Capacity Forecast</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Weekly workload projection based on active headcount and incoming requests
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      scorecardData?.forecast?.status === 'deficit'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {scorecardData?.forecast?.status === 'deficit' ? '⚠️ Capacity Deficit Risk' : '✅ Healthy Capacity'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Active Production Staff</span>
                    <div className="text-xl font-extrabold text-slate-800 mt-1">
                      {scorecardData?.forecast?.activeWorkers || 0} workers
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Weekly Base Capacity</span>
                    <div className="text-xl font-extrabold text-slate-800 mt-1">
                      {scorecardData?.forecast?.weeklyCapacityHours || 0} hrs
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Projected Demand</span>
                    <div className="text-xl font-extrabold text-slate-800 mt-1">
                      {scorecardData?.forecast?.estimatedDemandHours || 0} hrs
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Net Capacity Gap</span>
                    <div
                      className={`text-xl font-extrabold mt-1 ${
                        (scorecardData?.forecast?.capacityGapHours || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {scorecardData?.forecast?.capacityGapHours > 0 ? `+${scorecardData?.forecast?.capacityGapHours} hrs deficit` : 'Available surplus'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Trend Area Chart */}
              <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass">
                <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#7a6af6]" />
                  <span>Executive Throughput & Delivery Velocity</span>
                </h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { period: 'Prior Period', requests: scorecardData?.scorecard?.totalRequests?.prev || 0, content: scorecardData?.scorecard?.publishedContent?.prev || 0 },
                        { period: 'Current Period', requests: scorecardData?.scorecard?.totalRequests?.value || 0, content: scorecardData?.scorecard?.publishedContent?.value || 0 },
                      ]}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id={`${scorecardUniqueId}-req`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id={`${scorecardUniqueId}-cnt`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.8} />
                          <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="period" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="requests" name="Requests Ingested" stroke={COLORS.primary} fillOpacity={1} fill={`url(#${scorecardUniqueId}-req)`} />
                      <Area type="monotone" dataKey="content" name="Content Delivered" stroke={COLORS.emerald} fillOpacity={1} fill={`url(#${scorecardUniqueId}-cnt)`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEPARTMENT USAGE & DEMAND */}
      {/* ========================================================================= */}
      {activeTab === 'department' && (
        <div className="space-y-6">
          {loadingDept ? (
            <div className="p-12 text-center text-slate-400">Loading department analytics...</div>
          ) : (
            <>
              {/* Department Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Department Focus
                  </span>
                  <div className="text-xl font-extrabold text-slate-900">{deptData?.department}</div>
                  <span className="text-xs text-slate-500 font-medium mt-1 block">
                    {deptData?.summary?.totalRequests} total requests submitted
                  </span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    On-Time Delivery Rate
                  </span>
                  <div className="text-2xl font-extrabold text-emerald-600">
                    {deptData?.summary?.onTimeDeliveryRate}%
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1 block">
                    {deptData?.summary?.publishedContent} units delivered
                  </span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Average Turnaround
                  </span>
                  <div className="text-2xl font-extrabold text-purple-600">
                    {deptData?.summary?.avgTurnaroundDays} days
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1 block">From triage to completion</span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Pending & Overdue Aging
                  </span>
                  <div className="text-2xl font-extrabold text-rose-600">
                    {deptData?.summary?.overdueRequestsCount} overdue
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1 block">
                    {deptData?.summary?.openRequestsCount} currently open
                  </span>
                </div>
              </div>

              {/* Aging Buckets & Hours Consumed */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Aging Buckets Bar Chart */}
                <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Open Request Aging Distribution</span>
                  </h2>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { bucket: '< 3 Days', count: deptData?.agingBuckets?.under3Days || 0 },
                          { bucket: '3-7 Days', count: deptData?.agingBuckets?.threeTo7Days || 0 },
                          { bucket: '7-14 Days', count: deptData?.agingBuckets?.sevenTo14Days || 0 },
                          { bucket: '> 14 Days', count: deptData?.agingBuckets?.over14Days || 0 },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Open Requests" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Hours Consumed Breakdown Table */}
                <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#7a6af6]" />
                    <span>Production Hours Consumed by Team</span>
                  </h2>
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Team</th>
                          <th className="py-2 px-3">Format</th>
                          <th className="py-2 px-3 text-right">Hours Logged</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deptData?.hoursConsumed?.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-slate-400">
                              No logged hours found in period
                            </td>
                          </tr>
                        ) : (
                          deptData?.hoursConsumed?.map((hc: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-800 capitalize">{hc.team}</td>
                              <td className="py-2.5 px-3 text-slate-600">{hc.format}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 text-right">{hc.hours} hrs</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Overdue Requests Table with Drill-Down */}
              {deptData?.overdueRequests?.length > 0 && (
                <div className="glass-panel p-6 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-glass space-y-3">
                  <h2 className="text-sm font-bold text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Overdue Requests Requiring Attention</span>
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/60 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Title</th>
                          <th className="py-2 px-3">Department</th>
                          <th className="py-2 px-3">Priority</th>
                          <th className="py-2 px-3">Deadline</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100/40">
                        {deptData?.overdueRequests.map((r: any) => (
                          <tr key={r._id} className="hover:bg-white/60 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{r.title}</td>
                            <td className="py-2.5 px-3 text-slate-600">{r.sourceDepartment}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                {r.priority}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-rose-600">
                              {new Date(r.deadline).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => setDrillDownItem(r)}
                                className="text-xs text-[#7a6af6] font-bold hover:underline flex items-center gap-1 justify-end ml-auto"
                              >
                                <span>Inspect</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: TEAM VELOCITY & WORKLOAD */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {loadingTeam ? (
            <div className="p-12 text-center text-slate-400">Loading team velocity report...</div>
          ) : (
            <>
              {/* Velocity Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Throughput (Completed)
                  </span>
                  <div className="text-3xl font-extrabold text-indigo-600">
                    {teamData?.summary?.throughput} tasks
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1 block">In selected period</span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Current Backlog
                  </span>
                  <div className="text-3xl font-extrabold text-slate-800">
                    {teamData?.summary?.currentBacklog} open
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1 block">Active pipeline queue</span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Team Utilization
                  </span>
                  <div className="text-3xl font-extrabold text-emerald-600">
                    {teamData?.summary?.utilizationRate}%
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1 block">
                    {teamData?.summary?.totalLoggedHours}h / capacity
                  </span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Rework Rate
                  </span>
                  <div className="text-3xl font-extrabold text-amber-500">
                    {teamData?.summary?.reworkRate}%
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1 block">Revisions requested</span>
                </div>
              </div>

              {/* Queue Latency vs Work Time Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Average Queue Wait vs. Active Work Time (Hours)</span>
                  </h2>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { metric: 'Queue Latency (Wait)', hours: teamData?.summary?.avgQueueHours || 0, fill: '#3b82f6' },
                          { metric: 'Active Production Time', hours: teamData?.summary?.avgWorkHours || 0, fill: '#10b981' },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="metric" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="hours" name="Average Hours" radius={[6, 6, 0, 0]}>
                          <Cell fill="#3b82f6" />
                          <Cell fill="#10b981" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pipeline Status Breakdown */}
                <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span>Active Team Tasks Status Distribution</span>
                  </h2>
                  <div className="space-y-3 pt-2">
                    {[
                      { status: 'Completed (Done)', count: teamData?.tasksByStatus?.done || 0, color: 'bg-emerald-500' },
                      { status: 'In Progress', count: teamData?.tasksByStatus?.in_progress || 0, color: 'bg-blue-500' },
                      { status: 'Blocked', count: teamData?.tasksByStatus?.blocked || 0, color: 'bg-rose-500' },
                      { status: 'On Hold', count: teamData?.tasksByStatus?.on_hold || 0, color: 'bg-amber-500' },
                    ].map((row, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span>{row.status}</span>
                          <span className="font-bold">{row.count} tasks</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${row.color} rounded-full`}
                            style={{
                              width: `${
                                teamData?.summary?.throughput + teamData?.summary?.currentBacklog > 0
                                  ? (row.count / (teamData.summary.throughput + teamData.summary.currentBacklog)) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: BOTTLENECKS & HOLD RADAR */}
      {/* ========================================================================= */}
      {activeTab === 'bottlenecks' && (
        <div className="space-y-6">
          {loadingBottlenecks ? (
            <div className="p-12 text-center text-slate-400">Loading bottleneck radar...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hold & Block Reason Codes */}
                <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <span>Holds & Blocks by Reason Code</span>
                  </h2>
                  <div className="h-64 w-full">
                    {bottleneckData?.holdsAndBlocks?.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        No active holds or blocked items in period
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={bottleneckData?.holdsAndBlocks}
                            dataKey="count"
                            nameKey="reasonCode"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={(entry: any) => `${entry.reasonCode} (${entry.count})`}
                          >
                            {bottleneckData?.holdsAndBlocks?.map((_: any, idx: number) => (
                              <Cell key={`cell-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Status Transitions Frequency */}
                <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-600" />
                    <span>Workflow Stage Transitions Frequency</span>
                  </h2>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bottleneckData?.statusTransitions}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="status" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="transitions" name="Transitions" fill="#7a6af6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Active Blocked Tasks List */}
              <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span>Active Blocked & On-Hold Items ({bottleneckData?.currentBlockedCount})</span>
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Task ID</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Team</th>
                        <th className="py-2.5 px-3">Hold / Block Reason</th>
                        <th className="py-2.5 px-3">Comment</th>
                        <th className="py-2.5 px-3">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bottleneckData?.currentBlockedTasks?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">
                            No blocked tasks currently active! Production is unblocked.
                          </td>
                        </tr>
                      ) : (
                        bottleneckData?.currentBlockedTasks?.map((t: any) => (
                          <tr key={t._id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{t.taskId}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{t.title}</td>
                            <td className="py-2.5 px-3 capitalize text-slate-600">{t.team}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                {t.holdReason || 'Blocked'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs">{t.holdComment || '—'}</td>
                            <td className="py-2.5 px-3 text-slate-400">{new Date(t.updatedAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: CONTENT PIPELINE OUTPUT */}
      {/* ========================================================================= */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {loadingContent ? (
            <div className="p-12 text-center text-slate-400">Loading content pipeline analytics...</div>
          ) : (
            <>
              {/* Output Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Total Planned Assets
                  </span>
                  <div className="text-3xl font-extrabold text-slate-900">
                    {contentData?.summary?.totalPlanned} units
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Published / Live Units
                  </span>
                  <div className="text-3xl font-extrabold text-emerald-600">
                    {contentData?.summary?.totalPublished} units
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    On-Time Publish Rate
                  </span>
                  <div className="text-3xl font-extrabold text-blue-600">
                    {contentData?.summary?.onTimePublishRate}%
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Late Content Aging
                  </span>
                  <div className="text-3xl font-extrabold text-rose-600">
                    {contentData?.summary?.lateCount} late
                  </div>
                </div>
              </div>

              {/* Format & Platform Breakdown Chart */}
              <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Asset Production Volume by Format & Platform</span>
                </h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contentData?.outputByFormatPlatform}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="format" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" name="Total Planned" fill="#7a6af6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="published" name="Delivered / Published" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 6: WORKER PERFORMANCE & EFFICIENCY SCORECARD */}
      {/* ========================================================================= */}
      {activeTab === 'individual' && (
        <div className="space-y-6">
          {loadingIndividual ? (
            <div className="p-12 text-center text-slate-400">Loading worker performance metrics...</div>
          ) : (
            <>
              {/* Efficiency Score Hero Card */}
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white shadow-glass bg-gradient-to-r from-white via-white to-purple-50/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <span className="text-xs font-bold text-[#7a6af6] uppercase tracking-wider block mb-1">
                      Individual Performance Profile
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-900">
                      {individualData?.worker?.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Team: <span className="font-semibold text-slate-700 capitalize">{individualData?.worker?.team || 'Creative Staff'}</span> · Role: {individualData?.worker?.role}
                    </p>
                  </div>

                  {/* 4-Pillar Composite Efficiency Score Badge */}
                  <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-purple-100 shadow-sm">
                    <Award className="w-10 h-10 text-[#7a6af6]" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Efficiency Score
                      </span>
                      <div className="text-3xl font-extrabold text-[#7a6af6]">
                        {individualData?.metrics?.efficiencyScore}
                        <span className="text-sm text-slate-400 font-semibold"> / 100</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Pillars Breakdown per System Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">1. On-Time Delivery</span>
                      <span className="font-bold text-slate-900">{individualData?.metrics?.onTimeRate}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${individualData?.metrics?.onTimeRate}%` }}></div>
                    </div>
                    <span className="text-[10px] text-slate-400">Weight: {(individualData?.weightsUsed?.onTime * 100).toFixed(0)}%</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">2. First-Pass Approval</span>
                      <span className="font-bold text-slate-900">{individualData?.metrics?.firstPassRate}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${individualData?.metrics?.firstPassRate}%` }}></div>
                    </div>
                    <span className="text-[10px] text-slate-400">Weight: {(individualData?.weightsUsed?.firstPass * 100).toFixed(0)}%</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">3. Speed vs. Estimate</span>
                      <span className="font-bold text-slate-900">{individualData?.metrics?.speedScore}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${individualData?.metrics?.speedScore}%` }}></div>
                    </div>
                    <span className="text-[10px] text-slate-400">Weight: {(individualData?.weightsUsed?.speedVsEstimate * 100).toFixed(0)}%</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-semibold">4. Capacity Utilization</span>
                      <span className="font-bold text-slate-900">{individualData?.metrics?.volumeScore}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${individualData?.metrics?.volumeScore}%` }}></div>
                    </div>
                    <span className="text-[10px] text-slate-400">Weight: {(individualData?.weightsUsed?.volumeUtilization * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Work Volume & Revisions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Completed Tasks
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {individualData?.metrics?.completedCount} / {individualData?.metrics?.assignedCount}
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Estimated vs. Actual Hours
                  </span>
                  <div className="text-2xl font-extrabold text-indigo-600">
                    {individualData?.metrics?.totalActualHours}h / {individualData?.metrics?.totalEstimatedHours}h
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Leave Days in Period
                  </span>
                  <div className="text-2xl font-extrabold text-amber-500">
                    {individualData?.metrics?.leaveDays} days
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white shadow-glass">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Total Revisions on Tasks
                  </span>
                  <div className="text-2xl font-extrabold text-rose-600">
                    {individualData?.metrics?.totalRevisions} ({individualData?.metrics?.avgRevisionsPerTask} avg)
                  </div>
                </div>
              </div>

              {/* Recent Tasks Completed Table */}
              <div className="glass-panel p-6 rounded-2xl border border-white shadow-glass space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Recent Tasks Evaluated</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Task ID</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Stage</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Estimate</th>
                        <th className="py-2.5 px-3">Actual</th>
                        <th className="py-2.5 px-3 text-right">Revisions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {individualData?.recentTasks?.map((t: any) => (
                        <tr key={t._id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{t.taskId}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{t.title}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-600">{t.stageKey}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              {t.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{t.estimateHours} hrs</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{t.actualHours} hrs</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-700">{t.revisionCount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCHEDULED REPORT MODAL */}
      {/* ========================================================================= */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-white p-6 rounded-3xl border border-white shadow-2xl max-w-lg w-full space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#7a6af6]" />
                <span>Schedule Automated Recurring Report</span>
              </h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                scheduleMutation.mutate({
                  name: scheduleName || `${activeTab.toUpperCase()} Scheduled Report`,
                  reportType: activeTab,
                  frequency: scheduleFreq,
                  format: scheduleFormat,
                  recipients: scheduleRecipients.split(',').map((s) => s.trim()),
                });
              }}
              className="space-y-4 text-xs font-semibold"
            >
              <div>
                <label className="block text-slate-600 mb-1">Report Schedule Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Management Scorecard"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Frequency</label>
                  <select
                    value={scheduleFreq}
                    onChange={(e: any) => setScheduleFreq(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="daily">Daily Morning Digest</option>
                    <option value="weekly">Weekly (Monday 8:00 AM)</option>
                    <option value="monthly">Monthly (1st of Month)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Attachment Format</label>
                  <select
                    value={scheduleFormat}
                    onChange={(e: any) => setScheduleFormat(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="xlsx">Excel Spreadsheet (.xlsx)</option>
                    <option value="csv">CSV Data (.csv)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Recipients (comma-separated emails)</label>
                <input
                  type="text"
                  required
                  placeholder="lead@marketingportal.com, executive@example.com"
                  value={scheduleRecipients}
                  onChange={(e) => setScheduleRecipients(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                />
              </div>

              {/* Active Scheduled Reports List */}
              {scheduledList?.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Active Scheduled Reports ({scheduledList.length})
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {scheduledList.map((sr: any) => (
                      <div
                        key={sr._id}
                        className="p-2 bg-slate-50 rounded-xl flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{sr.name}</div>
                          <div className="text-slate-400 text-[10px]">
                            {sr.frequency} · {sr.reportType} · Next: {new Date(sr.nextRunAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Cancel scheduled report "${sr.name}"?`)) {
                              await fetch(`/api/reports/scheduled/${sr._id}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              });
                              refetchScheduled();
                            }
                          }}
                          className="p-1 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-[#7a6af6] hover:bg-[#6857eb] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{scheduleMutation.isPending ? 'Scheduling...' : 'Confirm Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRILL-DOWN ITEM MODAL */}
      {/* ========================================================================= */}
      {drillDownItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-white p-6 rounded-3xl border border-white shadow-2xl max-w-lg w-full space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Item Inspection</h2>
              <button onClick={() => setDrillDownItem(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="text-xs bg-slate-50 p-4 rounded-xl overflow-x-auto text-slate-800 font-mono">
              {JSON.stringify(drillDownItem, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setDrillDownItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReportsPage;
