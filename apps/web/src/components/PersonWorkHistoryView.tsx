import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ExternalLink,
  X,
  History,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Avatar } from './Avatar';
import type { WorkItemIndividualMeasures } from '@mmp/shared';

export interface PersonWorkHistoryData {
  person: {
    _id: string;
    name: string;
    email?: string;
    role: string;
    jobRole?: string;
    avatarUrl?: string;
    departmentId?: any;
  };
  now: any[];
  next: any[];
  done: any[];
  summary: {
    totalCompleted: number;
    activeCount: number;
    nextCount: number;
    onTimeRate: number;
    averageApprovalWaitMs: number | null;
    averageApprovalWaitFormatted: string;
    avgWorkTimeByStepType: Record<string, { avgMs: number; formatted: string; count: number }>;
    totalRevisions: number;
  };
}

interface PersonWorkHistoryViewProps {
  personId: string;
  isFullPage?: boolean;
}

export const PersonWorkHistoryView: React.FC<PersonWorkHistoryViewProps> = ({
  personId,
  isFullPage = false,
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<PersonWorkHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'now' | 'next' | 'done'>('now');
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    apiFetch<{ data: PersonWorkHistoryData }>(`/api/people/${personId}/work-history`)
      .then((res) => {
        if (isMounted) setData(res.data);
      })
      .catch((err: any) => {
        if (isMounted) setError(err?.message || 'Failed to load individual work history.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [personId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading individual work view...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
        <h4 className="text-sm font-bold text-slate-800">Unable to load work view</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">{error || 'Record not found.'}</p>
      </div>
    );
  }

  const { person, now, next, done, summary } = data;

  const renderItemCard = (item: any) => {
    const measures: WorkItemIndividualMeasures = item.measures || {};
    const dueString = item.deadline
      ? new Date(item.deadline).toLocaleDateString()
      : '—';

    return (
      <div
        key={item._id}
        className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-purple-300 shadow-2xs hover:shadow-xs transition-all space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
                {item.stageKey || item.workType || 'Stage'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  item.status === 'In Progress'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : item.status === 'Feedback'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : item.status === 'Pending'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : item.status === 'Blocked'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : item.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : item.status === 'Published'
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.status}
              </span>
              {measures.isLate && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-600 text-white">
                  Late by {measures.lateByFormatted}
                </span>
              )}
            </div>
            <h4
              onClick={() => navigate(`/work/${item._id}`)}
              className="text-xs font-bold text-slate-900 hover:text-purple-600 cursor-pointer transition-colors line-clamp-1"
              title={item.title}
            >
              {item.title}
            </h4>
            {item.contentPieceId && (
              <p className="text-[11px] text-slate-500 truncate">
                Piece: {item.contentPieceId.title || item.contentPieceId.topic || item.contentPieceId.code}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSelectedTimelineItem(item)}
            className="p-1.5 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-500 hover:text-purple-600 border border-slate-200 transition-colors shrink-0"
            title="View Step Timeline"
          >
            <History className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timings Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Due Date</span>
            <span className="font-semibold text-slate-800">{dueString}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Work Time</span>
            <span className="font-semibold text-slate-800">
              {item.status === 'In Progress' && measures.workTimeFormatted !== '—'
                ? `Working for ${measures.workTimeFormatted}`
                : measures.workTimeFormatted || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Approval Wait</span>
            <span className="font-semibold text-slate-800">{measures.approvalWaitFormatted || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Revisions</span>
            <span className="font-semibold text-slate-800">{item.revisions || 0}</span>
          </div>
        </div>

        {/* Blocker alert if blocked */}
        {item.status === 'Blocked' && item.blockerReason && (
          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Blocked: {item.blockerReason}</span>
              {item.blockerNote && <p className="text-rose-700 mt-0.5">{item.blockerNote}</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${isFullPage ? 'max-w-5xl mx-auto py-8 px-4 sm:px-6' : 'p-4 sm:p-6'}`}>
      {/* 1. Person Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <Avatar
            url={person.avatarUrl}
            name={person.name}
            userId={person._id}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{person.name}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {person.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {person.jobRole || 'Creative Contributor'} {person.email ? `• ${person.email}` : ''}
            </p>
          </div>
        </div>

        {!isFullPage && (
          <button
            type="button"
            onClick={() => navigate(`/team/members/${person._id}/work`)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>Full Work View</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. Summary Dashboard (No Performance Ranking) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Tasks</span>
          <span className="text-xl font-extrabold text-slate-900 mt-1 block">{summary.totalCompleted}</span>
          <span className="text-[10px] text-slate-500">Historical completed</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">On-Time Rate</span>
          <span className="text-xl font-extrabold text-emerald-700 mt-1 block">{summary.onTimeRate}%</span>
          <span className="text-[10px] text-slate-500">Against step due dates</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Avg Approval Wait</span>
          <span className="text-xl font-extrabold text-indigo-700 mt-1 block">{summary.averageApprovalWaitFormatted}</span>
          <span className="text-[10px] text-slate-500">Decision turnaround</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Total Revisions</span>
          <span className="text-xl font-extrabold text-amber-700 mt-1 block">{summary.totalRevisions}</span>
          <span className="text-[10px] text-slate-500">Revision rounds</span>
        </div>
      </div>

      {/* Step Types Average Work Time Strip */}
      {Object.keys(summary.avgWorkTimeByStepType || {}).length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Average Work Time by Step Type (Sum of Net Rounds)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(summary.avgWorkTimeByStepType).map(([stepKey, item]) => (
              <div
                key={stepKey}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2"
              >
                <span className="font-bold text-purple-700">{stepKey}:</span>
                <span>{item.formatted}</span>
                <span className="text-[10px] text-slate-400">({item.count} items)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Tabs: Now, Next, Done */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('now')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'now'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Now (In Progress / Feedback / Blocked)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'now' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {now.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('next')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'next'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Next (Queued / Locked)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'next' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {next.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('done')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'done'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Done (Last 30 Completed)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'done' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {done.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'now' && (
          <div className="space-y-3">
            {now.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 text-xs">
                No active deliverables currently in progress or awaiting feedback.
              </div>
            ) : (
              now.map((item) => renderItemCard(item))
            )}
          </div>
        )}

        {activeTab === 'next' && (
          <div className="space-y-3">
            {next.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 text-xs">
                No upcoming or locked tasks scheduled.
              </div>
            ) : (
              next.map((item) => renderItemCard(item))
            )}
          </div>
        )}

        {activeTab === 'done' && (
          <div className="space-y-3">
            {done.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 text-xs">
                No completed tasks on record yet.
              </div>
            ) : (
              done.map((item) => renderItemCard(item))
            )}
          </div>
        )}
      </div>

      {/* 4. Timeline Modal / Drawer */}
      {selectedTimelineItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                  Step Timing & Rounds
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">{selectedTimelineItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTimelineItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Core Timestamps */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                Lifecycle Milestones
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Unlocked</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTimelineItem.unlockedAt ? new Date(selectedTimelineItem.unlockedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Assigned</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTimelineItem.assignedAt ? new Date(selectedTimelineItem.assignedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Started</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTimelineItem.startedAt ? new Date(selectedTimelineItem.startedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Submitted</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTimelineItem.submittedAt ? new Date(selectedTimelineItem.submittedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Approved</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTimelineItem.approvedAt ? new Date(selectedTimelineItem.approvedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Published</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTimelineItem.postedAt ? new Date(selectedTimelineItem.postedAt).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Production Rounds */}
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">
                Rounds Log ({selectedTimelineItem.rounds?.length || 1})
              </span>
              {Array.isArray(selectedTimelineItem.rounds) && selectedTimelineItem.rounds.length > 0 ? (
                selectedTimelineItem.rounds.map((r: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-700">Round {r.roundNumber || idx + 1}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase font-semibold">
                        {r.decision || 'in progress'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Started: {r.startedAt ? new Date(r.startedAt).toLocaleTimeString() : '—'} • Submitted:{' '}
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : '—'}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No multi-round history recorded.</p>
              )}
            </div>

            {/* Intervals Log (Blocked / Pending) */}
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">
                Paused Intervals (Blocked / Pending)
              </span>
              {Array.isArray(selectedTimelineItem.intervals) && selectedTimelineItem.intervals.length > 0 ? (
                selectedTimelineItem.intervals.map((iv: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-700 uppercase text-[10px]">{iv.kind}</span>
                      <span className="text-[10px] text-slate-500">
                        {iv.endedAt ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {new Date(iv.startedAt).toLocaleTimeString()} → {iv.endedAt ? new Date(iv.endedAt).toLocaleTimeString() : 'ongoing'}
                    </div>
                    {iv.reason && <p className="text-[11px] font-medium text-slate-700">Reason: {iv.reason}</p>}
                    {iv.note && <p className="text-[11px] text-slate-500 italic">Note: {iv.note}</p>}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No blocked or pending intervals paused work time.</p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setSelectedTimelineItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
