import React, { useEffect, useState } from 'react';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { apiFetch } from '../lib/api';
import { PROFILES, DEPARTMENTS, WORK_ITEM_STATUSES } from '@mmp/shared';
import {
  Filter,
  RotateCcw,
} from 'lucide-react';

interface ProfileOption {
  _id: string;
  name: string;
  code: string;
}

interface DepartmentOption {
  _id: string;
  name: string;
  code: string;
}

export const GlobalFilterBar: React.FC = () => {
  const { filters, setFilter, resetFilters, activeFilterCount } = useGlobalFilter();

  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  useEffect(() => {
    // Load dynamic profiles
    apiFetch<{ data: ProfileOption[] }>('/api/reference-data/profiles')
      .then((res) => setProfiles(res.data || []))
      .catch(() => {
        // Fallback to shared taxonomy
        setProfiles(
          PROFILES.map((p) => ({
            _id: p.code,
            name: p.name,
            code: p.code,
          }))
        );
      });

    // Load dynamic departments
    apiFetch<{ data: DepartmentOption[] }>('/api/departments')
      .then((res) => setDepartments(res.data || []))
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
    <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200/60">
          <Filter className="w-3.5 h-3.5 text-purple-600" />
          <span>Universal Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] font-black flex items-center justify-center ml-0.5">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* Brand Profile Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">Brand:</span>
          <select
            value={filters.profileId}
            onChange={(e) => setFilter('profileId', e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 transition-all cursor-pointer"
          >
            <option value="all">All Brands (Org-wide)</option>
            {profiles.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Department Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">Dept:</span>
          <select
            value={filters.departmentId}
            onChange={(e) => setFilter('departmentId', e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 transition-all cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">Month:</span>
          <select
            value={filters.month}
            onChange={(e) => setFilter('month', e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 transition-all cursor-pointer"
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
          <span className="text-[11px] font-semibold text-slate-400">Status:</span>
          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 transition-all cursor-pointer"
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
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-purple-700 bg-slate-100 hover:bg-purple-50 transition-all flex items-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3 text-slate-500" />
          <span>Reset Filters</span>
        </button>
      )}
    </div>
  );
};
