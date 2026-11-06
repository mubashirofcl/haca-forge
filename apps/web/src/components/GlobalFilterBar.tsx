import React, { useEffect, useState } from 'react';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { apiFetch } from '../lib/api';
import { WORK_ITEM_STATUSES } from '@mmp/shared';
import {
  RotateCcw,
} from 'lucide-react';

interface DepartmentOption {
  _id: string;
  name: string;
  code: string;
}

export const GlobalFilterBar: React.FC = () => {
  const { filters, setFilter, resetFilters, activeFilterCount } = useGlobalFilter();

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  useEffect(() => {

    // Only departments with real data; the filter is hidden when there are none.
    apiFetch<{ data?: DepartmentOption[]; departments?: DepartmentOption[] }>('/api/departments?inUse=true')
      .then((res: any) => {
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.departments)
          ? res.departments
          : [];
        setDepartments(list);
        // An old link may name a department with no data: clear it, or a hidden filter would stay applied.
        if (filters.departmentId !== 'all' && !list.some((d: DepartmentOption) => d._id === filters.departmentId)) {
          setFilter('departmentId', 'all');
        }
      })
      .catch(() => setDepartments([]));
    // Load once; the URL filter is only checked against the first result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate recent 6 months
  const monthOptions = React.useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const date = new Date();
    // Start 2 months in future
    date.setMonth(date.getMonth() + 1);
    for (let i = 0; i < 6; i++) {
      const val = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
      list.push({ label, value: val });
      date.setMonth(date.getMonth() - 1);
    }
    return list;
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-2.5">


        {/* Department Selector */}
        {departments.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-ui-muted">Dept:</span>
            <select
              aria-label="Department"
              value={filters.departmentId}
              onChange={(e) => setFilter('departmentId', e.target.value)}
              className="ui-select cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Month Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-ui-muted">Month:</span>
          <select
            aria-label="Month"
            value={filters.month}
            onChange={(e) => setFilter('month', e.target.value)}
            className="ui-select cursor-pointer"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Deliverable Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-ui-muted">Status:</span>
          <select
            aria-label="Deliverable status"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="ui-select cursor-pointer"
          >
            <option value="all">All Statuses</option>
            {WORK_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reset Action */}
      {activeFilterCount > 0 && (
        <button
          onClick={resetFilters}
          className="ui-btn ui-btn-secondary"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
          <span
            aria-label={`${activeFilterCount} active`}
            className="min-w-[20px] h-5 px-1.5 rounded-full bg-ui-ink text-white text-[11px] font-semibold flex items-center justify-center"
          >
            {activeFilterCount}
          </span>
        </button>
      )}
    </div>
  );
};
