import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { NotFoundState } from '../../components/RoleBoundary';
import { ReportTable } from '../reports/ReportViews';
import { FIGURE_COLUMNS, STEP_COLUMNS, reviewerFigureRows, workerFigureRows, type ProfileKpiData } from './profileFigures';
import { ReviewerCharts, WorkerCharts } from './ProfileKpiViews';

const ROLE_NAMES: Record<string, string> = {
  admin: 'Admin',
  creative_head: 'Creative Head',
  sm_manager: 'SM Manager',
  executive: 'Executive',
  team_member: 'Team member',
};

/**
 * The individual profile report (Phase 8): print layout for Save as PDF. Header (name, role,
 * job role, department; no contact details), the period, the figures, charts and the step
 * list with labels. admin, creative_head and executive only (the API enforces it).
 */
export const ProfileReportPage: React.FC = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState<ProfileKpiData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'forbidden' | 'error'>('loading');
  const query = new URLSearchParams(params);
  query.delete('autoprint');

  useEffect(() => {
    apiFetch<{ data: ProfileKpiData }>(`/api/team/${id}/report?${query.toString()}`)
      .then((res) => {
        setData(res.data);
        setState('ready');
      })
      .catch((err: { statusCode?: number }) => setState(err?.statusCode === 404 ? 'missing' : err?.statusCode === 403 ? 'forbidden' : 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, params.toString()]);

  useEffect(() => {
    if (state !== 'ready' || params.get('autoprint') === '0') return;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [state, params]);

  if (state === 'missing') return <NotFoundState />;
  if (state === 'forbidden') return <div className="glass-card max-w-xl mx-auto my-16 p-8 text-sm" role="alert">Only admin, creative head and executive can download this report.</div>;
  if (state === 'error') return <div className="glass-card max-w-xl mx-auto my-16 p-8 text-sm" role="alert">Could not load the report.</div>;
  if (!data) return <div className="p-8 text-sm text-ui-muted">Loading…</div>;

  const p = data.person;
  const filters = { month: data.period.from.slice(0, 7), calendar: 'all', stepType: 'all' };
  return (
    <div className="report-print bg-white text-black min-h-screen p-6 space-y-5" data-testid="profile-report">
      <div>
        <h1 className="text-2xl font-extrabold" data-testid="profile-report-name">{p.preferredName || p.name}</h1>
        <p className="text-sm mt-1">
          {ROLE_NAMES[p.role] || p.role}
          {p.jobRole ? ` · ${p.jobRole}` : ''}
          {p.department ? ` · ${p.department}` : ''}
        </p>
        <p className="text-xs mt-1">
          Period: {data.period.label} ({data.period.from} to {data.period.to}, IST) · Printed{' '}
          {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </p>
        <p className="text-xs mt-1">{data.note}</p>
        <button type="button" className="ui-btn ui-btn-primary h-11 mt-3 no-print" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      {data.worker && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Work figures</h2>
          <ReportTable title="Figures" report="profile" table="figures" filters={filters} print testId="profile-report-figures" empty="No figures." rows={workerFigureRows(data.worker)} columns={FIGURE_COLUMNS} />
          <WorkerCharts worker={data.worker} print />
          <ReportTable title="Steps" report="profile" table="steps" filters={filters} print testId="profile-report-steps" empty="No steps due in this period." rows={data.worker.steps || []} columns={STEP_COLUMNS} />
        </section>
      )}

      {data.creativeHead && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Review work</h2>
          <ReportTable title="Review figures" report="profile" table="review-figures" filters={filters} print testId="profile-report-review" empty="No figures." rows={reviewerFigureRows(data.creativeHead)} columns={FIGURE_COLUMNS} />
          {data.creativeHead.cards.legacyNote && <p className="text-xs">{data.creativeHead.cards.legacyNote}</p>}
          <ReviewerCharts ch={data.creativeHead} print />
        </section>
      )}

      {!data.worker && !data.creativeHead && <p className="text-sm">No work or review figures for this person.</p>}
    </div>
  );
};

export default ProfileReportPage;
