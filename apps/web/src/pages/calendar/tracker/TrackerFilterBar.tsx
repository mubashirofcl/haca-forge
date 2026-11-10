import React from 'react';
import { Search, X } from 'lucide-react';
import { CALENDAR_LIST, getStepStatusLabel } from '@mmp/shared';
import {
  TRACKER_SORTS,
  TRACKER_STATUSES,
  TRACKER_STEPS,
  TYPE_OPTIONS,
  WORKFLOW_OPTIONS,
  monthLabel,
  monthOptions,
  type TrackerFilters,
} from './trackerModel';

interface Props {
  filters: TrackerFilters;
  owners: Array<{ value: string; label: string }>;
  showOwner: boolean;
  count: number;
  onChange: (next: Partial<TrackerFilters>) => void;
  onClear: () => void;
}

/** One filter bar: search, selects, Urgent only, sort; active filters as removable chips. */
export const TrackerFilterBar: React.FC<Props> = ({ filters: f, owners, showOwner, count, onChange, onClear }) => {
  const select = (id: string, label: string, value: string, options: Array<{ value: string; label: string }>, key: keyof TrackerFilters, any: string) => (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[12px] font-medium text-ui-muted mb-1">{label}</label>
      <select id={id} className="ui-select h-11 w-full" value={value} onChange={(e) => onChange({ [key]: e.target.value } as Partial<TrackerFilters>)}>
        <option value="">{any}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  const label = (list: ReadonlyArray<{ value: string; label: string }>, v: string) => list.find((o) => o.value === v)?.label || v;
  const chips: Array<{ key: string; text: string; clear: Partial<TrackerFilters> }> = [];
  if (f.q.trim()) chips.push({ key: 'q', text: `Search: ${f.q.trim()}`, clear: { q: '' } });
  if (f.month) chips.push({ key: 'month', text: monthLabel(f.month), clear: { month: '' } });
  if (f.calendar) chips.push({ key: 'calendar', text: CALENDAR_LIST.find((c) => c.key === f.calendar)?.name || f.calendar, clear: { calendar: '' } });
  if (f.type) chips.push({ key: 'type', text: f.type, clear: { type: '' } });
  if (f.workflow) chips.push({ key: 'workflow', text: label(WORKFLOW_OPTIONS, f.workflow), clear: { workflow: '' } });
  if (f.step) chips.push({ key: 'step', text: `Current step: ${label(TRACKER_STEPS, f.step)}`, clear: { step: '' } });
  if (f.owner) chips.push({ key: 'owner', text: `Owner: ${label(owners, f.owner)}`, clear: { owner: '' } });
  if (f.status) chips.push({ key: 'status', text: label(TRACKER_STATUSES, f.status), clear: { status: '' } });
  if (f.urgent) chips.push({ key: 'urgent', text: 'Urgent only', clear: { urgent: false } });
  if (f.stageStatus) chips.push({ key: 'stageStatus', text: `Any step ${getStepStatusLabel(f.stageStatus).toLowerCase()}`, clear: { stageStatus: '' } });

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3" role="search" aria-label="Filter the tracker">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-end">
        <div className="min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-1">
          <label htmlFor="trk-q" className="block text-[12px] font-medium text-ui-muted mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-ui-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input id="trk-q" type="search" className="ui-input h-11 w-full pl-9" placeholder="Topic or plan ID" value={f.q} onChange={(e) => onChange({ q: e.target.value })} />
          </div>
        </div>
        {select('trk-month', 'Month (publish date)', f.month, monthOptions(new Date(), f.month), 'month', 'All months')}
        {select('trk-calendar', 'Calendar', f.calendar, CALENDAR_LIST.map((c) => ({ value: c.key, label: c.name })), 'calendar', 'All calendars')}
        {select('trk-type', 'Type', f.type, TYPE_OPTIONS, 'type', 'All types')}
        {select('trk-workflow', 'Workflow', f.workflow, WORKFLOW_OPTIONS, 'workflow', 'All workflows')}
        {select('trk-step', 'Current step', f.step, TRACKER_STEPS, 'step', 'Any step')}
        {showOwner && select('trk-owner', 'Owner', f.owner, owners, 'owner', 'Anyone')}
        {select('trk-status', 'Status', f.status, [...TRACKER_STATUSES], 'status', 'Any status')}
        <div className="min-w-0">
          <label htmlFor="trk-sort" className="block text-[12px] font-medium text-ui-muted mb-1">Sort by</label>
          <select id="trk-sort" className="ui-select h-11 w-full" value={f.sort} onChange={(e) => onChange({ sort: e.target.value as TrackerFilters['sort'] })}>
            {TRACKER_SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          aria-pressed={f.urgent}
          onClick={() => onChange({ urgent: !f.urgent })}
          className={`h-11 px-4 rounded-full text-[13px] font-semibold border transition-colors ${f.urgent ? 'bg-ui-ink text-white border-transparent' : 'bg-white/60 text-ui-text border-ui-line hover:bg-white'}`}
        >
          Urgent only
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-ui-line">
        <span className="text-[13px] font-semibold text-ui-ink" data-testid="tracker-count" aria-live="polite">
          {count} {count === 1 ? 'post' : 'posts'}
        </span>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.clear)}
            className="inline-flex items-center gap-1 min-h-[32px] px-2.5 rounded-full border border-ui-line bg-white/70 text-[12px] text-ui-text hover:text-ui-ink"
            aria-label={`Remove filter: ${c.text}`}
          >
            {c.text}
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ))}
        {chips.length > 0 && (
          <button type="button" onClick={onClear} className="min-h-[32px] px-2 text-[12px] font-semibold text-ui-ink underline underline-offset-2">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
};
