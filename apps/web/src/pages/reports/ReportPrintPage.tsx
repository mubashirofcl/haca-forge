import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CALENDAR_LIST } from '@mmp/shared';
import { apiFetch } from '../../lib/api';
import { REPORT_TABS, ReportView, type ReportData, type ReportName } from './ReportViews';
import { readReportFilters, reportQuery } from './ReportsPage';

/**
 * Print layout (Phase 7): one report with every chart at a fixed size and every table in
 * full, for the browser's Save as PDF. Opens the print dialog once the report has loaded.
 */
export const ReportPrintPage: React.FC = () => {
  const [params] = useSearchParams();
  const requested = params.get('report');
  const report: ReportName = REPORT_TABS.some((t) => t.id === requested) ? (requested as ReportName) : 'overview';
  const filters = readReportFilters(params);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = REPORT_TABS.find((t) => t.id === report)?.label || 'Report';
  const calendarName = filters.calendar === 'all' ? 'All calendars' : CALENDAR_LIST.find((c) => c.key === filters.calendar)?.name || filters.calendar;

  useEffect(() => {
    apiFetch<{ data: ReportData }>(`/api/reports/${report}?${reportQuery(filters)}`)
      .then((res) => setData(res.data))
      .catch((err: Error) => setError(err.message || 'Could not load the report'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, params.toString()]);

  useEffect(() => {
    if (!data || params.get('autoprint') === '0') return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [data, params]);

  return (
    <div className="report-print bg-white text-black min-h-screen p-6" data-testid="report-print-layout">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">HACA Reports: {title}</h1>
        <p className="text-xs mt-1">
          Month {filters.month} (by publish date, IST) · {calendarName} · {filters.stepType === 'all' ? 'All steps' : filters.stepType} · Printed{' '}
          {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </p>
        <button type="button" className="ui-btn ui-btn-primary h-11 mt-3 no-print" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : data ? <ReportView name={report} data={data} filters={filters} print /> : <p>Loading…</p>}
    </div>
  );
};

export default ReportPrintPage;
