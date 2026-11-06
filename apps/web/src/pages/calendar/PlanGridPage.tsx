import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlanGrid } from './plan-grid/PlanGrid';

/** Link to the full-screen plan grid. Calendar, month and plan are in the URL so a reload keeps the place. */
export function planGridHref(opts: { calendar?: string; month?: string; planId?: string } = {}): string {
  const q = new URLSearchParams();
  if (opts.calendar && opts.calendar !== 'all') q.set('calendar', opts.calendar);
  if (opts.month) q.set('month', opts.month);
  if (opts.planId) q.set('plan', opts.planId);
  const s = q.toString();
  return `/calendar/plan-grid${s ? `?${s}` : ''}`;
}

/** Full-screen plan grid workspace (rendered in Layout focus mode: header kept, sidebar hidden). */
export const PlanGridPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  return (
    <PlanGrid
      initialCalendar={params.get('calendar') || 'sm'}
      initialMonth={params.get('month') || undefined}
      initialPlanId={params.get('plan') || undefined}
      onLocationChange={(loc) => {
        const next = new URLSearchParams();
        next.set('calendar', loc.calendar);
        next.set('month', loc.month);
        if (loc.planId) next.set('plan', loc.planId);
        if (next.toString() !== params.toString()) setParams(next, { replace: true });
      }}
      onClose={() => navigate('/calendar?tab=plans')}
    />
  );
};

export default PlanGridPage;
