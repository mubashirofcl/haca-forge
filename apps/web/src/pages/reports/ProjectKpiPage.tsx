import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatDuration, getStepStatusLabel } from '@mmp/shared';
import { apiFetch } from '../../lib/api';
import { NotFoundState } from '../../components/RoleBoundary';
import { TimeLabelChips } from '../../components/TimeLabelChips';
import { fmtDate, fmtHours } from '../../lib/reportExport';
import { firstPassText, onTimeText, projectStatusText, workTimeText, type ProjectKpis } from './ReportViews';

interface KpiStep {
  id: string;
  stepType: string;
  status: string;
  isSkipped: boolean;
  owner: string | null;
  dueDate: string | null;
  firstSubmitted: string | null;
  firstSubmittedFromHistory: boolean;
  labels: { kind: string; text: string }[];
  elapsedMs: number | null;
  elapsedFromHistory: boolean;
  /** Time spent on rework rounds (after changes were requested); null when never reworked. */
  reworkMs?: number | null;
  rating: number | null;
}
interface KpiData {
  project: {
    id: string;
    topic: string;
    calendarName: string;
    contentType: string;
    workflowLabel?: string;
    publishDate: string | null;
    label: { kind: string; text: string } | null;
    delivered: boolean;
    deliveredAt: string | null;
    deliveredVia: 'post' | 'handover' | null;
  };
  kpis: ProjectKpis;
  steps: KpiStep[];
}

const Kpi: React.FC<{ label: string; value: string; sub?: string | null; testId: string }> = ({ label, value, sub, testId }) => (
  <div className="glass-card p-4 min-w-0" data-testid={testId}>
    <div className="text-[13px] font-medium text-ui-muted">{label}</div>
    <div className="text-xl font-extrabold text-ui-ink mt-1 break-words">{value}</div>
    {sub && <div className="text-xs text-ui-muted mt-1">{sub}</div>}
  </div>
);

/** A project's KPIs (Phase 7). Read only; team-level: each step row shows its current owner, with no per-person totals. */
export const ProjectKpiPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<KpiData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    setState('loading');
    apiFetch<{ data: KpiData }>(`/api/reports/projects/${id}`)
      .then((res) => {
        setData(res.data);
        setState('ready');
      })
      .catch((err: { statusCode?: number }) => setState(err?.statusCode === 404 ? 'missing' : 'error'));
  }, [id]);

  if (state === 'missing') return <NotFoundState />;
  if (state === 'error') return <div className="glass-card max-w-xl mx-auto my-16 p-8 text-sm">Could not load this project.</div>;
  if (!data) return <div className="glass-card max-w-xl mx-auto my-16 p-8 text-sm text-ui-muted">Loading project…</div>;

  const { project, kpis, steps } = data;
  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 text-ui-text">
      <div className="max-w-6xl mx-auto space-y-5" data-testid="project-kpi-page">
        <Link to="/reports?report=projects" className="text-[13px] text-ui-muted inline-flex items-center gap-1 min-h-[44px]">
          <ArrowLeft className="w-3.5 h-3.5" /> Reports
        </Link>
        <div>
          <h1 className="text-[26px] sm:text-[30px] leading-tight font-extrabold text-ui-ink break-words">{project.topic}</h1>
          <p className="text-sm text-ui-muted mt-1">
            {project.calendarName} · {project.workflowLabel || project.contentType} · Publish date {fmtDate(project.publishDate) || 'not set'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="project-label">
            <span className={`status-chip ${project.label?.kind === 'overdue' ? 'status-blocked' : project.label ? 'status-changes' : project.delivered ? 'status-approved' : 'status-in-progress'} text-[11px] font-semibold`}>
              {projectStatusText(project)}
            </span>
            {project.delivered && (
              <span className="status-chip status-posted text-[11px] font-semibold">
                {project.deliveredVia === 'handover' ? 'Handed over' : 'Posted'} {fmtDate(project.deliveredAt)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Steps on time" value={onTimeText(kpis)} sub={kpis.onTime.delayedByEarlier ? `${kpis.onTime.delayedByEarlier} ${kpis.onTime.delayedByEarlier === 1 ? 'step' : 'steps'} delayed by earlier steps` : null} testId="kpi-on-time" />
          <Kpi label="Average rating" value={kpis.rating.text} sub={`${kpis.rating.count} rated steps`} testId="kpi-rating" />
          <Kpi label={kpis.firstPass.label} value={firstPassText(kpis.firstPass)} sub="Review steps only; Post is not counted" testId="kpi-first-pass" />
          <Kpi label={kpis.workTime.label} value={kpis.workTime.steps ? fmtHours(kpis.workTime.totalMs) : 'No data'} sub={kpis.workTime.partial ? `Partial: ${kpis.workTime.note}` : 'Submitted rounds, minus blocked and paused time'} testId="kpi-work-time" />
        </div>
        <p className="sr-only">{workTimeText(kpis)}</p>

        <section className="glass-card p-4 sm:p-5" aria-label="Steps">
          <h2 className="text-sm font-semibold text-ui-ink mb-3">Steps</h2>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className={`rounded-xl bg-white/60 p-3 text-xs ${s.isSkipped ? 'opacity-60' : ''}`} data-testid="kpi-step-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-ui-ink text-sm">
                    {s.stepType}
                    <span className="ml-2 text-ui-muted font-normal">{s.isSkipped ? 'Skipped' : getStepStatusLabel(s.status as never)}</span>
                  </div>
                  <TimeLabelChips labels={s.labels} />
                </div>
                <dl className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1">
                  <div><dt className="text-ui-muted">Owner</dt><dd>{s.owner || 'Unassigned'}</dd></div>
                  <div><dt className="text-ui-muted">Due date</dt><dd>{fmtDate(s.dueDate) || 'Not set'}</dd></div>
                  <div><dt className="text-ui-muted">First submitted</dt><dd>{fmtDate(s.firstSubmitted) || 'Not yet'}{s.firstSubmittedFromHistory ? ' (from history)' : ''}</dd></div>
                  <div>
                    <dt className="text-ui-muted">Elapsed work time</dt>
                    <dd data-testid="kpi-step-hours">{s.elapsedMs === null ? 'No data' : `${fmtHours(s.elapsedMs)}${s.elapsedFromHistory ? ' (partial, from history)' : ''}`}</dd>
                    {s.reworkMs !== null && s.reworkMs !== undefined && (
                      <dd className="text-ui-muted" data-testid="kpi-step-rework">Rework time: {formatDuration(s.reworkMs)}</dd>
                    )}
                  </div>
                  <div><dt className="text-ui-muted">Rating</dt><dd>{s.rating ? `${s.rating} ★` : 'Not rated'}</dd></div>
                </dl>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
};

export default ProjectKpiPage;
