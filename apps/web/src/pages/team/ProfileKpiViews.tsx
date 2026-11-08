import React, { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../../lib/api';
import { downloadCsv, toCsv } from '../../lib/reportExport';
import { ChartBox, CHART_AXIS, CHART_COLORS } from '../reports/ReportViews';
import {
  FIGURE_COLUMNS,
  STEP_COLUMNS,
  profileQuery,
  reviewerFigureRows,
  workerFigureRows,
  type FigureRow,
  type ProfileKpiData,
  type ReviewerKpis,
  type WorkerKpis,
} from './profileFigures';

export interface PeriodChoice {
  period: 'month' | '3months' | 'custom';
  from?: string;
  to?: string;
}

/** This month, last 3 months, or a custom range (IST days). */
export const PeriodPicker: React.FC<{ value: PeriodChoice; onChange: (v: PeriodChoice) => void; label?: string }> = ({ value, onChange, label }) => {
  const [from, setFrom] = useState(value.from || '');
  const [to, setTo] = useState(value.to || '');
  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Period">
      <label className="text-[13px] font-medium text-ui-muted space-y-1">
        <span className="block">Period{label ? `: ${label}` : ''}</span>
        <select
          className="ui-select h-11"
          value={value.period}
          onChange={(e) => onChange({ period: e.target.value as PeriodChoice['period'], from, to })}
          data-testid="profile-period"
        >
          <option value="month">This month</option>
          <option value="3months">Last 3 months</option>
          <option value="custom">Custom range</option>
        </select>
      </label>
      {value.period === 'custom' && (
        <>
          <label className="text-[13px] font-medium text-ui-muted space-y-1">
            <span className="block">From</span>
            <input type="date" className="ui-input h-11" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="profile-period-from" />
          </label>
          <label className="text-[13px] font-medium text-ui-muted space-y-1">
            <span className="block">To</span>
            <input type="date" className="ui-input h-11" value={to} onChange={(e) => setTo(e.target.value)} data-testid="profile-period-to" />
          </label>
          <button type="button" className="ui-btn ui-btn-secondary h-11" disabled={!from || !to || from > to} onClick={() => onChange({ period: 'custom', from, to })}>
            Apply
          </button>
        </>
      )}
    </div>
  );
};

/** KPI cards from figure rows. The "last period" line is plain text: no colours, arrows or wording. */
export const FigureCards: React.FC<{ rows: FigureRow[]; testPrefix: string; print?: boolean }> = ({ rows, testPrefix, print }) => (
  <div className={`grid gap-3 ${print ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
    {rows.map((r) => (
      <div key={r.key} className="glass-card p-4 min-w-0" data-testid={`${testPrefix}-${r.key}`}>
        <div className="text-[13px] font-medium text-ui-muted">{r.label}</div>
        <div className="text-[22px] font-extrabold text-ui-ink tabular-nums leading-tight mt-1 break-words" data-testid={`${testPrefix}-${r.key}-value`}>
          {r.value}
        </div>
        <div className="text-xs text-ui-muted mt-1 break-words">{r.basis}</div>
        {r.last && <div className="text-xs text-ui-muted mt-1" data-testid={`${testPrefix}-${r.key}-last`}>{r.last}</div>}
      </div>
    ))}
  </div>
);

export const WorkerCards: React.FC<{ worker: WorkerKpis; print?: boolean }> = ({ worker, print }) => (
  <FigureCards rows={workerFigureRows(worker)} testPrefix="kpi" print={print} />
);

export const ReviewerCards: React.FC<{ ch: ReviewerKpis; print?: boolean }> = ({ ch, print }) => (
  <div className="space-y-2">
    <FigureCards rows={reviewerFigureRows(ch)} testPrefix="review" print={print} />
    {ch.cards.legacyNote && <p className="text-xs text-ui-muted" data-testid="review-legacy-note">{ch.cards.legacyNote}</p>}
  </div>
);

const EmptyNote: React.FC<{ show: boolean; text: string }> = ({ show, text }) => (show ? <p className="text-xs text-ui-muted mt-2">{text}</p> : null);

export const WorkerCharts: React.FC<{ worker: WorkerKpis; print?: boolean }> = ({ worker, print }) => {
  const c = worker.charts;
  return (
    <div className={`grid gap-4 ${print ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
      <ChartBox title="Monthly trend: steps completed and on-time rate (by finish date)" print={print} testId="chart-monthly-trend">
        <LineChart data={c.monthlyTrend}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="month" {...CHART_AXIS} />
          <YAxis yAxisId="left" allowDecimals={false} {...CHART_AXIS} width={28} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...CHART_AXIS} width={36} unit="%" />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="left" type="monotone" dataKey="completed" name="Completed" stroke={CHART_COLORS.b} strokeWidth={2} isAnimationActive={!print} />
          <Line yAxisId="right" type="monotone" dataKey="onTimeRate" name="On-time %" stroke={CHART_COLORS.a} strokeWidth={2} connectNulls isAnimationActive={!print} />
        </LineChart>
      </ChartBox>
      <ChartBox title="Rating distribution (one rating per step)" print={print} testId="chart-rating-distribution">
        <BarChart data={c.ratingDistribution.map((r) => ({ ...r, label: `${r.score} ★` }))}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="label" {...CHART_AXIS} />
          <YAxis allowDecimals={false} {...CHART_AXIS} width={28} />
          <Tooltip />
          <Bar dataKey="count" name="Steps" fill={CHART_COLORS.a} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
      <div>
        <ChartBox title="Revisions by root cause" print={print} testId="chart-root-causes-profile">
          <BarChart data={c.rootCauses} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--ui-line)" />
            <XAxis type="number" allowDecimals={false} {...CHART_AXIS} />
            <YAxis type="category" dataKey="cause" width={150} {...CHART_AXIS} />
            <Tooltip />
            <Bar dataKey="count" name="Revisions" fill={CHART_COLORS.c} isAnimationActive={!print} />
          </BarChart>
        </ChartBox>
        <EmptyNote show={c.classifiedRevisions === 0} text="No classified revisions in this period." />
      </div>
      <ChartBox title="Work by step type" print={print} testId="chart-by-step-type">
        <BarChart data={c.byStepType}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="stepType" {...CHART_AXIS} />
          <YAxis allowDecimals={false} {...CHART_AXIS} width={28} />
          <Tooltip />
          <Bar dataKey="count" name="Steps" fill={CHART_COLORS.b} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
      <ChartBox title="Work by calendar" print={print} testId="chart-by-calendar">
        <BarChart data={c.byCalendar}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="calendar" {...CHART_AXIS} />
          <YAxis allowDecimals={false} {...CHART_AXIS} width={28} />
          <Tooltip />
          <Bar dataKey="count" name="Steps" fill={CHART_COLORS.b} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
    </div>
  );
};

export const ReviewerCharts: React.FC<{ ch: ReviewerKpis; print?: boolean }> = ({ ch, print }) => (
  <div className={`grid gap-4 ${print ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
    <ChartBox title="Reviews per week" print={print} testId="chart-reviews-per-week">
      <LineChart data={ch.charts.reviewsPerWeek.map((w) => ({ ...w, label: w.week.slice(5) }))}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
        <XAxis dataKey="label" {...CHART_AXIS} />
        <YAxis allowDecimals={false} {...CHART_AXIS} width={28} />
        <Tooltip />
        <Line type="monotone" dataKey="reviews" name="Reviews" stroke={CHART_COLORS.b} strokeWidth={2} isAnimationActive={!print} />
      </LineChart>
    </ChartBox>
    <ChartBox title="Ratings given" print={print} testId="chart-ratings-given">
      <BarChart data={ch.charts.ratingsGiven.map((r) => ({ ...r, label: `${r.score} ★` }))}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
        <XAxis dataKey="label" {...CHART_AXIS} />
        <YAxis allowDecimals={false} {...CHART_AXIS} width={28} />
        <Tooltip />
        <Bar dataKey="count" name="Ratings" fill={CHART_COLORS.a} isAnimationActive={!print} />
      </BarChart>
    </ChartBox>
    <div className={print ? '' : 'lg:col-span-2'}>
      <ChartBox title="Root causes used" print={print} testId="chart-root-causes-used">
        <BarChart data={ch.charts.rootCausesUsed} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--ui-line)" />
          <XAxis type="number" allowDecimals={false} {...CHART_AXIS} />
          <YAxis type="category" dataKey="cause" width={150} {...CHART_AXIS} />
          <Tooltip />
          <Bar dataKey="count" name="Classified" fill={CHART_COLORS.c} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
      <EmptyNote show={ch.charts.rootCausesUsed.every((c) => c.count === 0)} text="No root causes classified in this period." />
    </div>
  </div>
);

/** "Download report": PDF (print layout) and CSV. Shown to admin, creative_head and executive only. */
export const DownloadReport: React.FC<{ targetId: string; choice: PeriodChoice; personName: string }> = ({ targetId, choice, personName }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = profileQuery(choice);
  const slug = personName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'person';
  const csv = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: ProfileKpiData }>(`/api/team/${targetId}/report?${q}`);
      const data = res.data;
      const rows = [...(data.worker ? workerFigureRows(data.worker) : []), ...(data.creativeHead ? reviewerFigureRows(data.creativeHead) : [])];
      const stamp = `${data.period.from}_${data.period.to}`;
      downloadCsv(`haca_profile_${slug}_figures_${stamp}.csv`, toCsv(FIGURE_COLUMNS, rows));
      if (data.worker?.steps) downloadCsv(`haca_profile_${slug}_steps_${stamp}.csv`, toCsv(STEP_COLUMNS, data.worker.steps));
    } catch (err) {
      setError((err as Error).message || 'Could not build the CSV');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="profile-download">
      <a href={`/team/${targetId}/report?${q}`} target="_blank" rel="noreferrer" className="ui-btn ui-btn-primary h-11" data-testid="profile-download-pdf">
        <Printer className="w-3.5 h-3.5" />
        Download report (PDF)
      </a>
      <button type="button" className="ui-btn ui-btn-secondary h-11" onClick={csv} disabled={busy} data-testid="profile-download-csv">
        <Download className="w-3.5 h-3.5" />
        CSV
      </button>
      {error && <span className="text-xs text-ui-ink" role="alert">{error}</span>}
    </div>
  );
};
