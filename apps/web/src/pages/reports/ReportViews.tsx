import React from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type ReportColumn,
  csvFileName,
  downloadCsv,
  fmtDate,
  fmtHours,
  fmtPct,
  fmtWeek,
  toCsv,
} from '../../lib/reportExport';

// ───────────────────────────── Types (API shapes) ─────────────────────────────

export type ReportName = 'overview' | 'overdue' | 'production' | 'quality' | 'projects';
export interface ReportFilters {
  month: string;
  calendar: string;
  stepType: string;
}
interface RowBase {
  id: string;
  topic: string;
  project: string;
  calendarName: string;
  stepId: string;
  stepType: string;
  owner: string | null;
  dueDate: string | null;
}
export interface OverviewData {
  cards: { delivered: number; planned: number; onTime: number; onTimeRate: number | null; overdueSteps: number; overdueProjects: number; blocked: number };
  weekly: { week: string; delivered: number; onTime: number }[];
}
export interface OverdueData {
  openOverdue: (RowBase & { daysOverdue: number; labels: string[] })[];
  doneLate: (RowBase & { firstSubmitted: string | null; fromHistory: boolean; daysLate: number; labels: string[] })[];
  blockers: (RowBase & { reason: string; since: string | null; daysBlocked: number })[];
  byCalendar: { calendar: string; overdue: number; doneLate: number }[];
  byStepType: { stepType: string; overdue: number; doneLate: number }[];
}
export interface ProductionData {
  byCalendar: { calendar: string; planned: number; delivered: number }[];
  byType: { contentType: string; planned: number; delivered: number }[];
  weekly: { week: string; planned: number; posted: number }[];
}
export interface RatingSummary {
  count: number;
  average: number | null;
  text: string;
}
export interface FirstPass {
  label: string;
  approvedFirstTime: number;
  total: number;
  rate: number | null;
}
export interface QualityData {
  ratingDistribution: { score: number; count: number }[];
  rating: RatingSummary;
  firstPass: FirstPass;
  rootCauses: { cause: string; count: number }[];
  classifiedRevisions: number;
}
export interface ProjectKpis {
  onTime: { onTime: number; total: number; rate: number | null; delayedByEarlier: number };
  rating: RatingSummary;
  firstPass: FirstPass;
  workTime: { label: string; totalMs: number; steps: number; fromHistory: number; partial: boolean; note: string | null };
}
export interface ProjectRow {
  id: string;
  topic: string;
  calendarName: string;
  contentType: string;
  publishDate: string | null;
  label: { kind: string; text: string } | null;
  delivered: boolean;
  deliveredAt: string | null;
  kpis: ProjectKpis;
}
export interface ProjectsData {
  projects: ProjectRow[];
}
export type ReportData = OverviewData | OverdueData | ProductionData | QualityData | ProjectsData;

export const REPORT_TABS: { id: ReportName; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'overdue', label: 'Overdue and Issues' },
  { id: 'production', label: 'Production' },
  { id: 'quality', label: 'Quality' },
  { id: 'projects', label: 'Projects' },
];

// ───────────────────────────── Building blocks ─────────────────────────────

interface ViewProps<T> {
  data: T;
  filters: ReportFilters;
  print?: boolean;
}

const COLORS = { a: 'rgb(var(--ui-blue-rgb))', b: 'rgb(var(--ui-ink-rgb))', c: 'rgb(var(--ui-coral-rgb))' };
export const CHART_COLORS = COLORS;

/** A chart at full width on screen, at a fixed size in the print layout. */
export const ChartBox: React.FC<{ title: string; print?: boolean; children: React.ReactElement; testId?: string }> = ({ title, print, children, testId }) => (
  <figure className="glass-card p-4 sm:p-5 min-w-0 report-chart" data-testid={testId}>
    <figcaption className="text-sm font-semibold text-ui-ink mb-3">{title}</figcaption>
    {print ? (
      <div style={{ width: 680, height: 260 }}>{React.cloneElement(children, { width: 680, height: 260 } as never)}</div>
    ) : (
      <div className="h-[240px] sm:h-[260px] w-full" role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    )}
  </figure>
);

const axis = { tick: { fontSize: 11, fill: 'rgb(var(--ui-muted-rgb))' }, stroke: 'rgb(var(--ui-muted-rgb))' };
export const CHART_AXIS = axis;

export function ReportTable<Row>({
  title,
  report,
  table,
  columns,
  rows,
  filters,
  empty,
  print,
  testId,
  linkFor,
}: {
  title: string;
  report: string;
  table: string;
  columns: ReportColumn<Row>[];
  rows: Row[];
  filters: ReportFilters;
  empty: string;
  print?: boolean;
  testId: string;
  linkFor?: (row: Row) => string | null;
}) {
  const cell = (row: Row, c: ReportColumn<Row>, i: number) => {
    const text = c.text(row);
    const href = i === 0 && linkFor && !print ? linkFor(row) : null;
    return href ? (
      <Link to={href} className="font-semibold text-ui-ink underline underline-offset-4">
        {text}
      </Link>
    ) : (
      text
    );
  };
  return (
    <section className="glass-card p-4 sm:p-5 min-w-0 report-table" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-ui-ink">
          {title} <span className="text-ui-muted font-normal">({rows.length})</span>
        </h3>
        {!print && (
          <button
            type="button"
            className="ui-btn ui-btn-secondary h-11 no-print"
            onClick={() => downloadCsv(csvFileName(report, table, filters), toCsv(columns, rows))}
            data-testid={`${testId}-csv`}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-ui-muted italic">{empty}</p>
      ) : (
        <>
          <table className={`ui-table w-full text-xs ${print ? '' : 'hidden md:table'}`}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={`py-2 pr-3 font-semibold text-ui-muted ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-ui-line">
                  {columns.map((c, i) => (
                    <td key={c.key} className={`py-2 pr-3 align-top text-ui-text ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                      {cell(row, c, i)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!print && (
            <ul className="md:hidden space-y-2">
              {rows.map((row, r) => (
                <li key={r} className="rounded-xl bg-white/60 p-3 text-xs space-y-1">
                  {columns.map((c, i) => (
                    <div key={c.key} className="flex justify-between gap-3">
                      <span className="text-ui-muted shrink-0">{c.header}</span>
                      <span className="text-right text-ui-text min-w-0 break-words">{cell(row, c, i)}</span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

const Card: React.FC<{ label: string; value: string; sub?: string; testId: string }> = ({ label, value, sub, testId }) => (
  <div className="glass-card p-4 min-w-0" data-testid={testId}>
    <div className="text-[13px] font-medium text-ui-muted">{label}</div>
    <div className="text-[28px] font-extrabold text-ui-ink tabular-nums leading-tight mt-1">{value}</div>
    {sub && <div className="text-xs text-ui-muted mt-1">{sub}</div>}
  </div>
);

const n = (v: number) => String(v);
const rowCols = <R extends RowBase>(): ReportColumn<R>[] => [
  { key: 'project', header: 'Project', text: (r) => r.project },
  { key: 'calendar', header: 'Calendar', text: (r) => r.calendarName },
  { key: 'step', header: 'Step', text: (r) => r.stepType },
  { key: 'owner', header: 'Owner', text: (r) => r.owner || 'Unassigned' },
  { key: 'due', header: 'Due date', text: (r) => fmtDate(r.dueDate) },
];

// ───────────────────────────── Reports ─────────────────────────────

export const OverviewView: React.FC<ViewProps<OverviewData>> = ({ data, filters, print }) => {
  const { cards, weekly } = data;
  const summaryRows = [
    { metric: 'Delivered', value: `${cards.delivered} of ${cards.planned} planned` },
    { metric: 'On time', value: `${cards.onTime} (${fmtPct(cards.onTimeRate)})` },
    { metric: 'Overdue steps', value: n(cards.overdueSteps) },
    { metric: 'Overdue projects', value: n(cards.overdueProjects) },
    { metric: 'Blocked steps', value: n(cards.blocked) },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Delivered" value={n(cards.delivered)} sub={`of ${cards.planned} planned`} testId="card-delivered" />
        <Card label="On time" value={n(cards.onTime)} sub={fmtPct(cards.onTimeRate)} testId="card-on-time" />
        <Card label="Overdue" value={n(cards.overdueSteps)} sub={`steps · ${cards.overdueProjects} projects`} testId="card-overdue" />
        <Card label="Blocked" value={n(cards.blocked)} sub="steps" testId="card-blocked" />
      </div>
      <p className="text-xs text-ui-muted">Delivered and on time count projects with all their steps. Overdue and blocked count steps.</p>
      <ChartBox title="Delivered vs on time, by week" print={print} testId="chart-weekly-delivered">
        <LineChart data={weekly.map((w) => ({ ...w, label: w.week.slice(5) }))}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis allowDecimals={false} {...axis} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="delivered" name="Delivered" stroke={COLORS.b} strokeWidth={2} isAnimationActive={!print} />
          <Line type="monotone" dataKey="onTime" name="On time" stroke={COLORS.a} strokeWidth={2} isAnimationActive={!print} />
        </LineChart>
      </ChartBox>
      <ReportTable
        title="Summary" report="overview" table="summary" filters={filters} print={print} testId="table-summary" empty="No figures."
        rows={summaryRows}
        columns={[{ key: 'metric', header: 'Figure', text: (r) => r.metric }, { key: 'value', header: 'Value', text: (r) => r.value, align: 'right' }]}
      />
      <ReportTable
        title="By week" report="overview" table="weekly" filters={filters} print={print} testId="table-weekly" empty="No weeks."
        rows={weekly}
        columns={[
          { key: 'week', header: 'Week', text: (r) => fmtWeek(r.week) },
          { key: 'delivered', header: 'Delivered', text: (r) => n(r.delivered), align: 'right' },
          { key: 'onTime', header: 'On time', text: (r) => n(r.onTime), align: 'right' },
        ]}
      />
    </div>
  );
};

export const OverdueView: React.FC<ViewProps<OverdueData>> = ({ data, filters, print }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartBox title="Overdue and done late, by calendar" print={print} testId="chart-overdue-calendar">
        <BarChart data={data.byCalendar}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="calendar" {...axis} />
          <YAxis allowDecimals={false} {...axis} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="overdue" name="Overdue" stackId="a" fill={COLORS.c} isAnimationActive={!print} />
          <Bar dataKey="doneLate" name="Done late" stackId="a" fill={COLORS.a} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
      <ChartBox title="Overdue and done late, by step type" print={print} testId="chart-overdue-step">
        <BarChart data={data.byStepType}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="stepType" {...axis} />
          <YAxis allowDecimals={false} {...axis} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="overdue" name="Overdue" stackId="a" fill={COLORS.c} isAnimationActive={!print} />
          <Bar dataKey="doneLate" name="Done late" stackId="a" fill={COLORS.a} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
    </div>
    <ReportTable
      title="Open overdue steps" report="overdue" table="open-overdue" filters={filters} print={print} testId="table-open-overdue" empty="Nothing overdue."
      rows={data.openOverdue}
      columns={[...rowCols(), { key: 'days', header: 'Days overdue', text: (r) => n(r.daysOverdue), align: 'right' }, { key: 'labels', header: 'Labels', text: (r) => r.labels.join('; ') }]}
    />
    <ReportTable
      title="Done late" report="overdue" table="done-late" filters={filters} print={print} testId="table-done-late" empty="Nothing done late."
      rows={data.doneLate}
      columns={[
        ...rowCols(),
        { key: 'first', header: 'First submitted', text: (r) => `${fmtDate(r.firstSubmitted)}${r.fromHistory ? ' (from history)' : ''}` },
        { key: 'days', header: 'Days late', text: (r) => n(r.daysLate), align: 'right' },
        { key: 'labels', header: 'Labels', text: (r) => r.labels.join('; ') },
      ]}
    />
    <ReportTable
      title="Active blockers" report="overdue" table="blockers" filters={filters} print={print} testId="table-blockers" empty="No active blockers."
      rows={data.blockers}
      columns={[...rowCols(), { key: 'reason', header: 'Reason', text: (r) => r.reason || 'Not given' }, { key: 'days', header: 'Days blocked', text: (r) => n(r.daysBlocked), align: 'right' }]}
    />
    <ReportTable
      title="By calendar" report="overdue" table="by-calendar" filters={filters} print={print} testId="table-overdue-by-calendar" empty="No steps."
      rows={data.byCalendar}
      columns={[{ key: 'calendar', header: 'Calendar', text: (r) => r.calendar }, { key: 'overdue', header: 'Overdue', text: (r) => n(r.overdue), align: 'right' }, { key: 'late', header: 'Done late', text: (r) => n(r.doneLate), align: 'right' }]}
    />
    <ReportTable
      title="By step type" report="overdue" table="by-step-type" filters={filters} print={print} testId="table-overdue-by-step" empty="No steps."
      rows={data.byStepType}
      columns={[{ key: 'step', header: 'Step type', text: (r) => r.stepType }, { key: 'overdue', header: 'Overdue', text: (r) => n(r.overdue), align: 'right' }, { key: 'late', header: 'Done late', text: (r) => n(r.doneLate), align: 'right' }]}
    />
  </div>
);

export const ProductionView: React.FC<ViewProps<ProductionData>> = ({ data, filters, print }) => (
  <div className="space-y-4">
    <p className="text-xs text-ui-muted">Planned and delivered count projects with all their steps.</p>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartBox title="Deliverables by calendar" print={print} testId="chart-production-calendar">
        <BarChart data={data.byCalendar}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="calendar" {...axis} />
          <YAxis allowDecimals={false} {...axis} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="planned" name="Planned" fill={COLORS.a} isAnimationActive={!print} />
          <Bar dataKey="delivered" name="Delivered" fill={COLORS.b} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
      <ChartBox title="Deliverables by type" print={print} testId="chart-production-type">
        <BarChart data={data.byType}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="contentType" {...axis} />
          <YAxis allowDecimals={false} {...axis} width={28} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="planned" name="Planned" fill={COLORS.a} isAnimationActive={!print} />
          <Bar dataKey="delivered" name="Delivered" fill={COLORS.b} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
    </div>
    <ChartBox title="Planned vs posted, by week" print={print} testId="chart-production-weekly">
      <LineChart data={data.weekly.map((w) => ({ ...w, label: w.week.slice(5) }))}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
        <XAxis dataKey="label" {...axis} />
        <YAxis allowDecimals={false} {...axis} width={28} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="planned" name="Planned" stroke={COLORS.a} strokeWidth={2} isAnimationActive={!print} />
        <Line type="monotone" dataKey="posted" name="Posted or handed over" stroke={COLORS.b} strokeWidth={2} isAnimationActive={!print} />
      </LineChart>
    </ChartBox>
    <ReportTable
      title="By calendar" report="production" table="by-calendar" filters={filters} print={print} testId="table-production-calendar" empty="No projects."
      rows={data.byCalendar}
      columns={[{ key: 'calendar', header: 'Calendar', text: (r) => r.calendar }, { key: 'planned', header: 'Planned', text: (r) => n(r.planned), align: 'right' }, { key: 'delivered', header: 'Delivered', text: (r) => n(r.delivered), align: 'right' }]}
    />
    <ReportTable
      title="By type" report="production" table="by-type" filters={filters} print={print} testId="table-production-type" empty="No projects."
      rows={data.byType}
      columns={[{ key: 'type', header: 'Type', text: (r) => r.contentType }, { key: 'planned', header: 'Planned', text: (r) => n(r.planned), align: 'right' }, { key: 'delivered', header: 'Delivered', text: (r) => n(r.delivered), align: 'right' }]}
    />
    <ReportTable
      title="By week" report="production" table="weekly" filters={filters} print={print} testId="table-production-weekly" empty="No weeks."
      rows={data.weekly}
      columns={[{ key: 'week', header: 'Week', text: (r) => fmtWeek(r.week) }, { key: 'planned', header: 'Planned', text: (r) => n(r.planned), align: 'right' }, { key: 'posted', header: 'Posted or handed over', text: (r) => n(r.posted), align: 'right' }]}
    />
  </div>
);

export const QualityView: React.FC<ViewProps<QualityData>> = ({ data, filters, print }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Card label="Average rating" value={data.rating.text} sub={`${data.rating.count} rated steps (one rating per step)`} testId="card-rating" />
      <Card label={data.firstPass.label} value={fmtPct(data.firstPass.rate)} sub={`${data.firstPass.approvedFirstTime} of ${data.firstPass.total} reviewed steps`} testId="card-first-pass" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartBox title="Rating distribution" print={print} testId="chart-ratings">
        <BarChart data={data.ratingDistribution.map((r) => ({ ...r, label: `${r.score} ★` }))}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-line)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis allowDecimals={false} {...axis} width={28} />
          <Tooltip />
          <Bar dataKey="count" name="Steps" fill={COLORS.a} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
      <ChartBox title="Revision root causes" print={print} testId="chart-root-causes">
        <BarChart data={data.rootCauses} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--ui-line)" />
          <XAxis type="number" allowDecimals={false} {...axis} />
          <YAxis type="category" dataKey="cause" width={150} {...axis} />
          <Tooltip />
          <Bar dataKey="count" name="Revisions" fill={COLORS.c} isAnimationActive={!print} />
        </BarChart>
      </ChartBox>
    </div>
    {data.classifiedRevisions === 0 && <p className="text-xs text-ui-muted">No classified revisions yet. Root causes appear once revision flags are classified on the Feedback page.</p>}
    <ReportTable
      title="Rating distribution" report="quality" table="ratings" filters={filters} print={print} testId="table-ratings" empty="No ratings."
      rows={data.ratingDistribution}
      columns={[{ key: 'score', header: 'Rating', text: (r) => `${r.score}` }, { key: 'count', header: 'Steps', text: (r) => n(r.count), align: 'right' }]}
    />
    <ReportTable
      title="Revision root causes" report="quality" table="root-causes" filters={filters} print={print} testId="table-root-causes" empty="No root causes."
      rows={data.rootCauses}
      columns={[{ key: 'cause', header: 'Root cause', text: (r) => r.cause }, { key: 'count', header: 'Revisions', text: (r) => n(r.count), align: 'right' }]}
    />
  </div>
);

export const projectStatusText = (p: Pick<ProjectRow, 'label' | 'delivered'>) => p.label?.text || (p.delivered ? 'Delivered' : 'In production');
export const onTimeText = (k: ProjectKpis) => (k.onTime.total ? `${fmtPct(k.onTime.rate)} (${k.onTime.onTime} of ${k.onTime.total})` : 'No data');
export const workTimeText = (k: ProjectKpis) =>
  k.workTime.steps ? `${fmtHours(k.workTime.totalMs)}${k.workTime.partial ? ` (partial: ${k.workTime.note})` : ''}` : 'No data';
export const firstPassText = (f: FirstPass) => (f.total ? `${fmtPct(f.rate)} (${f.approvedFirstTime} of ${f.total})` : 'No data');

export const ProjectsView: React.FC<ViewProps<ProjectsData>> = ({ data, filters, print }) => (
  <ReportTable
    title="Projects" report="projects" table="projects" filters={filters} print={print} testId="table-projects" empty="No projects with steps in this month."
    rows={data.projects}
    linkFor={(r) => `/reports/projects/${r.id}`}
    columns={[
      { key: 'topic', header: 'Project', text: (r) => r.topic },
      { key: 'calendar', header: 'Calendar', text: (r) => r.calendarName },
      { key: 'type', header: 'Type', text: (r) => r.contentType },
      { key: 'publish', header: 'Publish date', text: (r) => fmtDate(r.publishDate) },
      { key: 'status', header: 'Status', text: projectStatusText },
      { key: 'onTime', header: 'Steps on time', text: (r) => onTimeText(r.kpis) },
      { key: 'delayed', header: 'Delayed by earlier steps', text: (r) => n(r.kpis.onTime.delayedByEarlier), align: 'right' },
      { key: 'rating', header: 'Average rating', text: (r) => r.kpis.rating.text },
      { key: 'firstPass', header: 'Reviewed steps approved first time', text: (r) => firstPassText(r.kpis.firstPass) },
      { key: 'hours', header: 'Elapsed work time', text: (r) => workTimeText(r.kpis) },
    ]}
  />
);

export const ReportView: React.FC<{ name: ReportName; data: ReportData; filters: ReportFilters; print?: boolean }> = ({ name, data, filters, print }) => {
  switch (name) {
    case 'overview':
      return <OverviewView data={data as OverviewData} filters={filters} print={print} />;
    case 'overdue':
      return <OverdueView data={data as OverdueData} filters={filters} print={print} />;
    case 'production':
      return <ProductionView data={data as ProductionData} filters={filters} print={print} />;
    case 'quality':
      return <QualityView data={data as QualityData} filters={filters} print={print} />;
    default:
      return <ProjectsView data={data as ProjectsData} filters={filters} print={print} />;
  }
};
