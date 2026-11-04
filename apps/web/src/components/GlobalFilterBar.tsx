import React, { useEffect, useState } from 'react';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { apiFetch } from '../lib/api';
import { DEPARTMENTS, WORK_ITEM_STATUSES } from '@mmp/shared';
import {
  Filter,
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

    // Load dynamic departments
    apiFetch<{ data?: DepartmentOption[]; departments?: DepartmentOption[] }>('/api/departments')
      .then((res: any) => {
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.departments)
          ? res.departments
          : [];
        setDepartments(list);
      })
      .catch(() => {
        // Fallback to shared taxonomy
        setDepartments(
          DEPARTMENTS.map((d) => ({
            _id: d.code,
            name: d.name,
            code: d.code,
          }))
        );
      });
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
    <div className="p-3 sm:px-4 glass-panel rounded-ui-card flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 pl-1 pr-1.5 text-ui-text font-semibold text-xs">
          <Filter className="w-4 h-4 text-ui-muted" />
          <span>Universal Filters</span>
          {activeFilterCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-ui-ink text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
              {activeFilterCount}
            </span>
          )}
        </div>


        {/* Department Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-ui-muted">Dept:</span>
          <select
            value={filters.departmentId}
            onChange={(e) => setFilter('departmentId', e.target.value)}
            className="ui-select cursor-pointer"
          >
            <option value="all">All Departments</option>
            {Array.isArray(departments) && departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-ui-muted">Month:</span>
          <select
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
        </button>
      )}
    </div>
  );
};
