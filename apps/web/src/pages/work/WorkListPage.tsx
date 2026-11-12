import { getStepStatusLabel } from '@mmp/shared';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { TimeLabelChips, type TimeLabel } from '../../components/TimeLabelChips';
import { hasTimeLabel, normalizePriority } from '@mmp/shared';
import { statusClass, statusTone, withDisplayStatus } from '../../lib/statusTone';
import {
  WORK_TYPES,
  WORK_ITEM_STATUSES,
  type WorkType,
  type WorkItemStatus,
} from '@mmp/shared';
import {
  Film,
  Search,
  ArrowUpRight,
  AlertTriangle,
  Table as TableIcon,
  LayoutGrid,
} from 'lucide-react';

interface WorkItemRow {
  _id: string;
  title: string;
  workType: WorkType;
  deadline: string;
  estimatedEffortHrs: number;
  status: WorkItemStatus;
  priority?: string;
  revisions: number;
  isOverdue?: boolean;
  /** Phase 7: computed time labels (Overdue, Done late, Blocked, ...). */
  timeLabels?: TimeLabel[];
  stageKey?: string | null;
  stageOrder?: number | null;
  reviewRequired?: boolean;
  contentLink?: string;
  assetsLink?: string;
  brief?: {
    description?: string;
    contentLink?: string;
    assetsLink?: string;
  };
  departmentId?: { _id: string; name: string };
  ownerId?: { _id: string; name: string; email: string; jobRole?: string };
}

const formatDeadline = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const WorkListPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<WorkItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [workTypeFilter, setWorkTypeFilter] = useState('all');
  // Phase 7: Overdue, Done late or Blocked, by the computed time labels.
  const [labelFilter, setLabelFilter] = useState<'all' | 'overdue' | 'done_late' | 'blocked'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (workTypeFilter !== 'all') queryParams.append('workType', workTypeFilter);
      if (labelFilter !== 'all') queryParams.append('timeLabel', labelFilter);
      if (searchTerm.trim()) queryParams.append('search', searchTerm.trim());

      // Pass allWork=true so team members can see items across their brand
      queryParams.append('allWork', 'true');

      const res = await apiFetch<{ data: WorkItemRow[] }>(`/api/work?${queryParams.toString()}`);
      setItems((res.data || []).map((it) => withDisplayStatus(it as any)));
    } catch (err) {
      console.error('Failed to load work items', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, workTypeFilter, labelFilter]);

  // Normal or Urgent; older stored values (Low, Medium, High) show as Normal.
  const priorityTone = (p?: string) => (normalizePriority(p) === 'Urgent' ? 'status-blocked' : 'status-not-started');

  const viewToggle = (mode: 'table' | 'grid', label: string, Icon: typeof TableIcon) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      aria-label={label}
      aria-pressed={viewMode === mode}
      title={label}
      className={`h-11 w-11 inline-flex items-center justify-center rounded-ui-control transition-colors ${
        viewMode === mode ? 'bg-ui-ink text-white' : 'text-ui-text hover:bg-ui-card-hover hover:text-ui-ink'
      }`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink flex items-center gap-2">
            <Film className="w-6 h-6 shrink-0" aria-hidden="true" />
            Work Items
          </h1>
          <p className="text-[15px] text-ui-muted mt-1.5">All creative steps and production deliverables.</p>
        </div>

        <div role="group" aria-label="View" className="flex items-center glass-card rounded-ui-control p-1 gap-1 self-start sm:self-auto">
          {viewToggle('table', 'Table view', TableIcon)}
          {viewToggle('grid', 'Grid view', LayoutGrid)}
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="glass-panel p-4 rounded-ui-panel">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="work-filter-status" className="text-xs font-semibold text-ui-muted">Status</label>
              <select
                id="work-filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="ui-select h-11"
              >
                <option value="all">All statuses</option>
                {WORK_ITEM_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="work-filter-type" className="text-xs font-semibold text-ui-muted">Work type</label>
              <select
                id="work-filter-type"
                value={workTypeFilter}
                onChange={(e) => setWorkTypeFilter(e.target.value)}
                className="ui-select h-11"
              >
                <option value="all">All work types</option>
                {WORK_TYPES.map((wt) => (
                  <option key={wt} value={wt}>
                    {wt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1" role="group" aria-label="Time label filter">
              <span className="text-xs font-semibold text-ui-muted flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                Show
              </span>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['all', 'All'],
                  ['overdue', 'Overdue'],
                  ['done_late', 'Done late'],
                  ['blocked', 'Blocked'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLabelFilter(value)}
                    aria-pressed={labelFilter === value}
                    className={`ui-btn h-11 ${labelFilter === value ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                    data-testid={`work-filter-${value}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 w-full sm:w-64">
            <label htmlFor="work-search" className="text-xs font-semibold text-ui-muted">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted pointer-events-none" aria-hidden="true" />
              <input
                id="work-search"
                type="search"
                placeholder="Title, then press Enter"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchData();
                }}
                className="ui-input h-11 w-full pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Items View */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-ui-muted" role="status">
          Loading work items...
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-ui-card">
          <Film className="w-10 h-10 text-ui-muted mx-auto mb-2" aria-hidden="true" />
          <h2 className="text-base font-bold text-ui-ink">No work items found</h2>
          <p className="text-sm text-ui-muted mt-1 max-w-sm mx-auto">
            Change or clear the filters to see more work.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="glass-panel rounded-ui-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-3 px-5 w-[40%]">Title</th>
                  <th className="py-3 px-5">Owner</th>
                  <th className="py-3 px-5">Deadline</th>
                  <th className="py-3 px-5">Priority</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="text-ui-text">
                {items.map((it) => {
                  return (
                    <tr
                      key={it._id}
                      onClick={() => navigate(`/work/${it._id}`)}
                      className="hover:bg-ui-card-hover transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-5 align-middle">
                        <div className="font-semibold text-ui-ink group-hover:underline">{it.title}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="status-chip status-not-started text-[11px]">{it.workType}</span>
                          {it.stageKey && (
                            <span className="status-chip status-not-started text-[11px]">Stage: {it.stageKey}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="text-ui-ink font-medium">{it.ownerId?.name || 'Unassigned'}</div>
                        <div className="text-[11px] text-ui-muted">{it.ownerId?.jobRole || 'Creative Staff'}</div>
                      </td>

                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="text-ui-ink font-medium">{formatDeadline(it.deadline)}</div>
                        <TimeLabelChips labels={it.timeLabels} showOnTime={false} className="mt-1.5" />
                      </td>

                      <td className="py-4 px-5 align-middle">
                        {it.priority && (
                          <span className={`status-chip ${priorityTone(it.priority)} text-[11px]`} data-testid="priority-chip">{normalizePriority(it.priority)}</span>
                        )}
                      </td>

                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <span className={`status-chip ${statusClass(statusTone(it.status))} text-[11px]`}>
                          {getStepStatusLabel(it.status)}
                        </span>
                      </td>

                      <td className="py-2 px-5 align-middle text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/work/${it._id}`);
                          }}
                          aria-label={`Open ${it.title}`}
                          className="ui-icon-btn h-11 w-11"
                        >
                          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const isOverdue = hasTimeLabel(it.timeLabels as never, 'overdue');

            return (
              <li key={it._id}>
                <button
                  type="button"
                  onClick={() => navigate(`/work/${it._id}`)}
                  className={`glass-card w-full h-full text-left p-5 rounded-ui-card flex flex-col justify-between hover:bg-ui-card-hover transition-colors group ${
                    isOverdue ? 'ring-1 ring-inset ring-ui-coral' : ''
                  }`}
                >
                  <span className="block">
                    <span className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="status-chip status-not-started text-[11px]">{it.workType}</span>
                      <span className={`status-chip ${statusClass(statusTone(it.status))} text-[11px]`}>
                        {getStepStatusLabel(it.status)}
                      </span>
                    </span>
                    <span className="block text-base font-bold text-ui-ink group-hover:underline">{it.title}</span>
                  </span>

                  <span className="mt-4 pt-3 border-t border-ui-line block text-xs text-ui-muted">
                    <span className="flex items-center justify-between gap-2">
                      <span>Due {formatDeadline(it.deadline)}</span>
                      <span className="font-medium text-ui-ink">{it.ownerId?.name || 'Unassigned'}</span>
                    </span>
                    <TimeLabelChips labels={it.timeLabels} showOnTime={false} className="mt-2" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
