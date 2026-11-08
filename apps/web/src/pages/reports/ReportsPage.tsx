import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Printer, RefreshCw } from 'lucide-react';
import { CALENDAR_LIST, STAGE_KEYS, monthKeyInAppTz } from '@mmp/shared';
import { apiFetch } from '../../lib/api';
import { REPORT_TABS, ReportView, type ReportData, type ReportFilters, type ReportName } from './ReportViews';

const isReport = (v: string | null): v is ReportName => REPORT_TABS.some((t) => t.id === v);

export function readReportFilters(params: URLSearchParams): ReportFilters {
  const month = params.get('month');
  return {
    month: month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : monthKeyInAppTz(new Date()),
    calendar: params.get('calendar') || 'all',
    stepType: params.get('stepType') || 'all',
  };
}

export const reportQuery = (f: ReportFilters) => new URLSearchParams({ month: f.month, calendar: f.calendar, stepType: f.stepType }).toString();

/** Live reports (Phase 7): computed on request, team-level only, CSV per table and a print layout for PDF. */
export const ReportsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const report: ReportName = isReport(params.get('report')) ? (params.get('report') as ReportName) : 'overview';
  const filters = readReportFilters(params);
  // Data is kept with the report and filters it belongs to, so a tab switch never renders
  // one report's data with another report's view.
  const [loaded, setLoaded] = useState<{ key: string; data: ReportData } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const query = reportQuery(filters);
  const key = `${report}?${query}`;
  const data = loaded && loaded.key === key ? loaded.data : null;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetch<{ data: ReportData }>(`/api/reports/${report}?${query}`)
      .then((res) => alive && setLoaded({ key: `${report}?${query}`, data: res.data }))
      .catch((err: Error) => alive && setError(err.message || 'Could not load the report'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [report, query, reloadKey]);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 text-ui-text">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-[13px] text-ui-muted font-medium flex items-center gap-1 mb-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Live figures
            </div>
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">Reports</h1>
            <p className="text-[15px] text-ui-muted mt-1.5 max-w-[70ch]">
              Team-level figures computed from current data. The month follows each project's publish date (IST).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} disabled={loading} className="ui-btn ui-btn-secondary h-11">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a
              href={`/reports/print?report=${report}&${query}`}
              target="_blank"
              rel="noreferrer"
              className="ui-btn ui-btn-primary h-11"
              data-testid="report-print"
            >
              <Printer className="w-3.5 h-3.5" />
              Print or save as PDF
            </a>
          </div>
        </div>

        <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3" role="group" aria-label="Report filters">
          <label className="text-[13px] font-medium text-ui-muted space-y-1">
            <span>Month (publish date)</span>
            <input type="month" className="ui-input h-11 w-full" value={filters.month} onChange={(e) => e.target.value && update({ month: e.target.value })} data-testid="filter-month" />
          </label>
          <label className="text-[13px] font-medium text-ui-muted space-y-1">
            <span>Calendar</span>
            <select className="ui-select h-11 w-full" value={filters.calendar} onChange={(e) => update({ calendar: e.target.value })} data-testid="filter-calendar">
              <option value="all">All calendars</option>
              {CALENDAR_LIST.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-medium text-ui-muted space-y-1">
            <span>Step type</span>
            <select className="ui-select h-11 w-full" value={filters.stepType} onChange={(e) => update({ stepType: e.target.value })} data-testid="filter-step">
              <option value="all">All steps</option>
              {STAGE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="max-w-full overflow-x-auto no-scrollbar">
          <div className="ui-tabs" role="tablist">
            {REPORT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={report === t.id}
                onClick={() => update({ report: t.id })}
                className={`ui-tab ${report === t.id ? 'is-active' : ''}`}
                data-testid={`report-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="glass-card p-6 text-sm text-ui-ink" role="alert">
            {error}
          </div>
        ) : !data ? (
          <div className="glass-card p-6 text-sm text-ui-muted">Loading report…</div>
        ) : data ? (
          <div aria-busy={loading} data-testid={`report-${report}`}>
            <ReportView name={report} data={data} filters={filters} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReportsPage;
