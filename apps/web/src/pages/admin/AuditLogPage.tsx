import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Code,
} from 'lucide-react';

interface AuditLogEntry {
  _id: string;
  actor: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  };
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ total: 0, page: 1, limit: 15, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '15');
      if (actionFilter) params.append('action', actionFilter);
      if (entityFilter) params.append('entity', entityFilter);

      const res = await apiFetch<{ logs: AuditLogEntry[]; pagination: PaginationMeta }>(
        `/admin/audit-log?${params.toString()}`
      );
      setLogs(res.logs || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 15, pages: 1 });
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [actionFilter, entityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <span>Audit Trail & Security Log</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Immutable system logs tracking administrative changes, role modifications, and master data updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 bg-white/70 px-3 py-1.5 rounded-full border border-slate-200 font-semibold shadow-xs">
            Total Records: <strong className="text-slate-900">{pagination.total}</strong>
          </span>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="glass-panel p-4 rounded-[22px] border border-white shadow-glass flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by actor name or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full shadow-xs"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3.5 py-2 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="user.role_change">Role Change</option>
            <option value="user.suspend">Account Suspend</option>
            <option value="user.activate">Account Activate</option>
            <option value="access_request.approved">Access Request Approved</option>
            <option value="access_request.rejected">Access Request Rejected</option>
            <option value="master_data.update">Master Data Update</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3.5 py-2 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="">All Entities</option>
            <option value="User">User</option>
            <option value="AccessRequest">Access Request</option>
            <option value="Department">Department</option>
            <option value="Team">Team</option>
            <option value="MasterData">Master Data</option>
            <option value="Settings">Settings</option>
          </select>
        </div>
      </div>

      {/* 3. Log Table */}
      <div className="glass-panel rounded-[24px] border border-white shadow-glass overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-[#7a6af6] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-500 font-medium">Loading audit history...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No audit logs found matching your filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-white/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Entity</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-white/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {log.actor?.name?.slice(0, 2).toUpperCase() || 'SY'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block truncate max-w-[140px]">
                            {log.actor?.name || 'System Auto'}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {log.actor?.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                          log.action.includes('reject') || log.action.includes('suspend')
                            ? 'bg-rose-500/10 text-rose-700 border border-rose-200'
                            : log.action.includes('approved') || log.action.includes('activate')
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
                            : 'bg-[#7a6af6]/10 text-[#6366f1] border border-[#7a6af6]/20'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{log.entity}</div>
                      {log.entityId && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {log.entityId.slice(-6)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {log.ipAddress || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-xs font-bold text-slate-700 flex items-center gap-1 ml-auto shadow-2xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 bg-white/50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchLogs(pagination.page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchLogs(pagination.page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="glass-modal w-full max-w-xl p-6 sm:p-8 rounded-[28px] shadow-2xl border border-white">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Audit Entry Details
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Log ID: {selectedLog._id}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/60 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Actor</span>
                  <span className="font-bold text-slate-900">{selectedLog.actor?.name || 'System'}</span>
                  <span className="text-slate-500 block text-[11px]">{selectedLog.actor?.email}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/60 border border-slate-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Action & Entity</span>
                  <span className="font-bold text-slate-900">{selectedLog.action}</span>
                  <span className="text-slate-500 block text-[11px]">Entity: {selectedLog.entity}</span>
                </div>
              </div>

              {/* JSON Payload Inspector */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-[#7a6af6]" />
                    Audit Metadata & State Diff
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] max-h-60 overflow-y-auto">
                  <pre>{JSON.stringify(selectedLog.details || {}, null, 2)}</pre>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-2 flex items-center justify-between">
                <span>Client IP: {selectedLog.ipAddress || 'unknown'}</span>
                <span>Recorded: {new Date(selectedLog.createdAt).toUTCString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
