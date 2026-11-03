import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
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

export const WorkListPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<WorkItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [workTypeFilter, setWorkTypeFilter] = useState('all');
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (workTypeFilter !== 'all') queryParams.append('workType', workTypeFilter);
      if (isOverdueOnly) queryParams.append('isOverdue', 'true');
      if (searchTerm.trim()) queryParams.append('search', searchTerm.trim());

      // Pass allWork=true so team members can see items across their brand
      queryParams.append('allWork', 'true');

      const res = await apiFetch<{ data: WorkItemRow[] }>(`/api/work?${queryParams.toString()}`);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load work items', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, workTypeFilter, isOverdueOnly]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-violet-100 text-[#7a6af6] border border-violet-200 flex items-center gap-1">
              <Film className="w-3 h-3" />
              Production Engine
            </span>
            <span className="text-xs font-semibold text-slate-400">Works Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            Work Items
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            All creative steps and production deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 gap-1 text-xs shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table view"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl transition-all ${
                viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="glass-card p-4 rounded-3xl border border-white/80 shadow-glass space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
            >
              <option value="all">All Statuses</option>
              {WORK_ITEM_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {/* Work Type Filter */}
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
            >
              <option value="all">All Work Types</option>
              {WORK_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {wt}
                </option>
              ))}
            </select>

            {/* Overdue Only Toggle */}
            <button
              onClick={() => setIsOverdueOnly(!isOverdueOnly)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border flex items-center gap-1.5 ${
                isOverdueOnly
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-rose-600'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue Only
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search work items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchData();
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
            />
          </div>
        </div>
      </div>

      {/* 3. Items View */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400 animate-pulse">
          Loading work items...
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-white/80">
          <Film className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-900">No work items found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No work items match your current filter settings.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="glass-card rounded-3xl border border-white/80 shadow-glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {items.map((it) => {
                  const isPast = new Date(it.deadline) < new Date();
                  const isTerm = it.status === 'Approved' || it.status === 'Published';
                  const isOverdue = isPast && !isTerm;

                  return (
                    <tr
                      key={it._id}
                      onClick={() => navigate(`/work/${it._id}`)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-[#7a6af6] border border-violet-100">
                            {it.workType}
                          </span>
                          {it.stageKey && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Stage: {it.stageKey}
                            </span>
                          )}
                          <span className="group-hover:text-[#7a6af6] transition-colors">{it.title}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-900 font-semibold">{it.ownerId?.name || 'Unassigned'}</div>
                        <div className="text-[10px] text-slate-400">{it.ownerId?.jobRole || 'Creative Staff'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700 font-semibold'}>
                          {new Date(it.deadline).toLocaleDateString()}
                        </span>
                        {isOverdue && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-rose-600 text-white">
                            Overdue
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            it.priority === 'High'
                              ? 'bg-rose-100 text-rose-700'
                              : it.priority === 'Medium'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {it.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            it.status === 'In Progress'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : it.status === 'Blocked'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : it.status === 'Feedback'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : it.status === 'Pending'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : it.status === 'Approved'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : it.status === 'Published'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {it.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/work/${it._id}`);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#7a6af6] transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => {
            const isPast = new Date(it.deadline) < new Date();
            const isTerm = it.status === 'Approved' || it.status === 'Published';
            const isOverdue = isPast && !isTerm;

            return (
              <div
                key={it._id}
                onClick={() => navigate(`/work/${it._id}`)}
                className={`glass-card p-5 rounded-3xl flex flex-col justify-between transition-all border cursor-pointer group ${
                  isOverdue ? 'border-rose-300 bg-rose-50/20' : 'border-white/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-[#7a6af6] border border-violet-100">
                      {it.workType}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        it.status === 'In Progress'
                          ? 'bg-emerald-100 text-emerald-800'
                          : it.status === 'Blocked'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {it.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-[#7a6af6] transition-colors">
                    {it.title}
                  </h3>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                    Due: {new Date(it.deadline).toLocaleDateString()}
                  </span>
                  <span className="font-bold text-slate-800">{it.ownerId?.name || 'Unassigned'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
