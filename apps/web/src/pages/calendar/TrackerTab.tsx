import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Table,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserX,
  ExternalLink,
  Sparkles,
  Lock,
  X,
  Check,
} from 'lucide-react';
import type { StageKey, WorkItemStatus } from '@mmp/shared';

interface StageSummary {
  _id: string;
  stageKey: StageKey;
  stageOrder: number;
  status: WorkItemStatus;
  dueDate: string;
  isLocked: boolean;
  isSkipped: boolean;
  revisions: number;
  blockerReason?: string;
  ownerId?: { _id: string; name: string; email: string; jobRole?: string };
  recommendedOwnerId?: { _id: string; name: string; email: string };
  deliverableUrl?: string;
  publishedUrl?: string;
}

interface ContentPieceTrackerRow {
  _id: string;
  planId?: { _id: string; code: string; title: string };
  postingDate: string;
  topic: string;
  contentType: string;
  pipeline: string;
  needsScript: boolean;
  needsShoot: boolean;
  contentLink?: string;
  remarks?: string;
  rowStatus: string;
  stagesGenerated: boolean;
  publishedAt?: string;
  liveUrl?: string;
  turnaroundDays?: number;
  stages: StageSummary[];
  derivedStatus: string;
  latestApprovalDate?: string;
  postingOwner?: { _id: string; name: string; email: string };
  hasNeedsOwner: boolean;
  hasWaitingApproval: boolean;
  hasBlocked: boolean;
  hasOverdue: boolean;
}

interface AssignRecommendation {
  workItemId: string;
  stageKey: string;
  stageOrder: number;
  currentOwner?: { _id: string; name: string; email: string };
  recommendedPerson: { _id: string; name: string; email: string; jobRole?: string } | null;
  rationale: string;
  candidatePool: Array<{
    person: { _id: string; name: string; email: string; jobRole?: string };
    workloadPct: number;
    availableHours: number;
    avgRevisions: number;
  }>;
}

const STAGE_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Not Started': { bg: 'bg-slate-100 text-slate-700', text: 'text-slate-700', dot: 'bg-slate-400' },
  'In Progress': { bg: 'bg-blue-50 text-blue-700', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Feedback': { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Pending': { bg: 'bg-purple-50 text-purple-700', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Approved': { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Published': { bg: 'bg-teal-50 text-teal-700', text: 'text-teal-700', dot: 'bg-teal-500' },
  'Blocked': { bg: 'bg-rose-50 text-rose-700', text: 'text-rose-700', dot: 'bg-rose-500' },
};

export const TrackerTab: React.FC = () => {
  const { user } = useAuth();
  const isExecutive = user?.role === 'executive';
  const canAssign = user?.role === 'admin' || user?.role === 'creative_head' || user?.role === 'sm_manager';

  const [pieces, setPieces] = useState<ContentPieceTrackerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStageStatus, setSelectedStageStatus] = useState<string>('all');
  const [filterNeedsOwner, setFilterNeedsOwner] = useState(false);
  const [filterWaitingApproval, setFilterWaitingApproval] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterBlocked, setFilterBlocked] = useState(false);

  // Assign Modal State
  const [selectedPieceForAssign, setSelectedPieceForAssign] = useState<ContentPieceTrackerRow | null>(null);
  const [recommendations, setRecommendations] = useState<AssignRecommendation[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // Reschedule Modal State
  const [selectedPieceForReschedule, setSelectedPieceForReschedule] = useState<ContentPieceTrackerRow | null>(null);
  const [newPostingDate, setNewPostingDate] = useState('');
  const [shiftUnstarted, setShiftUnstarted] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Users Pool (for manual selection in Assign modal)
  const [allUsers, setAllUsers] = useState<Array<{ _id: string; name: string; email: string; role: string }>>([]);

  const fetchTrackerData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth !== 'all') params.set('month', selectedMonth);
      if (selectedType !== 'all') params.set('type', selectedType);
      if (selectedStageStatus !== 'all') params.set('stageStatus', selectedStageStatus);
      if (filterNeedsOwner) params.set('needsOwner', 'true');
      if (filterWaitingApproval) params.set('waitingApproval', 'true');
      if (filterOverdue) params.set('overdue', 'true');
      if (filterBlocked) params.set('blocked', 'true');

      const res = await apiFetch<{ data: ContentPieceTrackerRow[] }>(`/api/content-pieces?${params.toString()}`);
      setPieces(res.data || []);
    } catch (err) {
      console.error('Failed to fetch tracker data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackerData();
  }, [
    selectedMonth,
    selectedType,
    selectedStageStatus,
    filterNeedsOwner,
    filterWaitingApproval,
    filterOverdue,
    filterBlocked,
  ]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiFetch<{ data: any[] }>('/api/users?limit=100');
        setAllUsers(res.data || []);
      } catch (err) {
        console.error('Failed to fetch users', err);
      }
    };
    fetchUsers();
  }, []);

  // Open Assign Modal and fetch recommendations
  const handleOpenAssignModal = async (piece: ContentPieceTrackerRow) => {
    setSelectedPieceForAssign(piece);
    setIsLoadingRecs(true);
    setRecommendations([]);
    setAssignSelections({});
    setOverrideReasons({});

    try {
      const res = await apiFetch<{ data: AssignRecommendation[] }>('/api/content-pieces/recommend-owners', {
        method: 'POST',
        body: JSON.stringify({ pieceId: piece._id }),
      });

      const recs = res.data || [];
      setRecommendations(recs);

      // Pre-populate with recommended person or current owner
      const initialSelections: Record<string, string> = {};
      for (const r of recs) {
        if (r.recommendedPerson) {
          initialSelections[r.workItemId] = r.recommendedPerson._id;
        } else if (r.currentOwner) {
          initialSelections[r.workItemId] = r.currentOwner._id;
        } else {
          initialSelections[r.workItemId] = ''; // Needs owner
        }
      }
      setAssignSelections(initialSelections);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch recommendations');
    } finally {
      setIsLoadingRecs(false);
    }
  };

  // One-click accept all recommendations
  const handleAcceptAllRecommendations = () => {
    const updated: Record<string, string> = {};
    for (const r of recommendations) {
      if (r.recommendedPerson) {
        updated[r.workItemId] = r.recommendedPerson._id;
      }
    }
    setAssignSelections(updated);
  };

  // Submit assignments
  const handleSaveAssignments = async () => {
    if (!selectedPieceForAssign) return;
    setIsSavingAssign(true);

    try {
      const assignments = recommendations
        .map((r) => {
          const personId = assignSelections[r.workItemId];
          const isOverriding = personId && r.recommendedPerson && personId !== r.recommendedPerson._id;
          return {
            workItemId: r.workItemId,
            assigneeId: personId || undefined,
            overrideReason: isOverriding
              ? overrideReasons[r.workItemId] || 'Manual assignment override by lead'
              : undefined,
          };
        })
        .filter((a) => a.assigneeId !== undefined);

      await apiFetch('/api/content-pieces/assign', {
        method: 'POST',
        body: JSON.stringify({ assignments }),
      });

      setSelectedPieceForAssign(null);
      await fetchTrackerData();
    } catch (err: any) {
      alert(err.message || 'Failed to save assignments');
    } finally {
      setIsSavingAssign(false);
    }
  };

  // Reschedule Final Date Submit
  const handleSaveReschedule = async () => {
    if (!selectedPieceForReschedule || !newPostingDate) return;
    setIsRescheduling(true);

    try {
      await apiFetch(`/api/content-pieces/${selectedPieceForReschedule._id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({
          postingDate: newPostingDate,
          shiftUnstartedStages: shiftUnstarted,
        }),
      });

      setSelectedPieceForReschedule(null);
      await fetchTrackerData();
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule content piece');
    } finally {
      setIsRescheduling(false);
    }
  };

  // Skip or Restore a stage
  const handleToggleSkipStage = async (pieceId: string, stageId: string, currentSkipped: boolean) => {
    if (isExecutive) return;
    try {
      await apiFetch(`/api/content-pieces/${pieceId}/stages/${stageId}/skip`, {
        method: 'PATCH',
        body: JSON.stringify({ isSkipped: !currentSkipped }),
      });
      await fetchTrackerData();
    } catch (err: any) {
      alert(err.message || 'Failed to update stage skip status');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Cockpit Strip */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Table className="w-5 h-5 text-purple-600" />
              Content Flow Tracker
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-stage pipeline tracking: stage status, deadlines, intelligent assignments, approvals, and turnaround.
            </p>
          </div>

          {/* Quick Filter Toggles */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterNeedsOwner(!filterNeedsOwner)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterNeedsOwner
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              Needs Owner
            </button>

            <button
              onClick={() => setFilterWaitingApproval(!filterWaitingApproval)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterWaitingApproval
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Waiting Approval
            </button>

            <button
              onClick={() => setFilterOverdue(!filterOverdue)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterOverdue
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue
            </button>

            <button
              onClick={() => setFilterBlocked(!filterBlocked)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterBlocked
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Blocked
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Months</option>
              <option value="2026-10">October 2026</option>
              <option value="2026-11">November 2026</option>
              <option value="2026-12">December 2026</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Content Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Content Types</option>
              <option value="Reel A">Reel A</option>
              <option value="Reel B">Reel B</option>
              <option value="Reel C">Reel C</option>
              <option value="Static Post">Static Post</option>
              <option value="Carousel">Carousel</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Stage Status
            </label>
            <select
              value={selectedStageStatus}
              onChange={(e) => setSelectedStageStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Stage Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Feedback">Feedback</option>
              <option value="Approved">Approved</option>
              <option value="Published">Published</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div className="flex items-end">
            <span className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-900">{pieces.length}</span> tracker items
            </span>
          </div>
        </div>
      </div>

      {/* Sheet-like Tracker Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 whitespace-nowrap">Content Piece</th>
                <th className="p-3 whitespace-nowrap">Final Date (F)</th>
                <th className="p-3 min-w-[340px]">Pipeline Stages & Owners</th>
                <th className="p-3 whitespace-nowrap">Approval</th>
                <th className="p-3 whitespace-nowrap">Live URL & Date</th>
                <th className="p-3 whitespace-nowrap">Posting Owner</th>
                <th className="p-3 whitespace-nowrap">Turnaround</th>
                <th className="p-3">Remarks</th>
                {!isExecutive && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pieces.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No approved content pieces match the selected filters.
                  </td>
                </tr>
              ) : (
                pieces.map((piece) => {
                  return (
                    <tr key={piece._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Content Piece Details */}
                      <td className="p-3 max-w-[200px]">
                        <div className="font-bold text-slate-900 line-clamp-1" title={piece.topic}>
                          {piece.topic}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1 py-0.2 rounded">
                            {piece.contentType}
                          </span>
                          {piece.planId && (
                            <span className="text-[10px] text-slate-400">
                              {piece.planId.code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Final Posting Date */}
                      <td className="p-3 whitespace-nowrap font-semibold text-slate-800">
                        {new Date(piece.postingDate).toLocaleDateString()}
                      </td>

                      {/* Stage Chips */}
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {piece.stages.length === 0 ? (
                            <span className="text-slate-400 italic text-[11px]">No stages generated</span>
                          ) : (
                            piece.stages.map((st) => {
                              const style = STAGE_STATUS_COLORS[st.status] || STAGE_STATUS_COLORS['Not Started'];
                              return (
                                <div
                                  key={st._id}
                                  className={`p-2 rounded-xl border flex flex-col gap-1 min-w-[100px] transition-all ${
                                    st.isLocked
                                      ? 'bg-slate-50 border-slate-200 opacity-60'
                                      : 'bg-white border-slate-200/90 shadow-2xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-[11px] text-slate-800">
                                      {st.stageKey}
                                    </span>
                                    {st.isLocked ? (
                                      <span title="Locked stage">
                                        <Lock className="w-3 h-3 text-slate-400" />
                                      </span>
                                    ) : (
                                      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                    )}
                                  </div>

                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${style.bg}`}>
                                    {st.status}
                                  </span>

                                  <div className="text-[10px] text-slate-500 truncate" title={st.ownerId?.name || 'Needs owner'}>
                                    {st.ownerId ? (
                                      <span className="text-slate-700 font-medium">{st.ownerId.name}</span>
                                    ) : (
                                      <span className="text-amber-700 font-bold">Needs owner</span>
                                    )}
                                  </div>

                                  <div className="text-[9px] text-slate-400 font-mono">
                                    Due: {new Date(st.dueDate).toLocaleDateString()}
                                  </div>

                                  {!isExecutive && !st.isLocked && st.status === 'Not Started' && (
                                    <button
                                      onClick={() => handleToggleSkipStage(piece._id, st._id, st.isSkipped)}
                                      className="text-[9px] text-slate-400 hover:text-purple-600 text-left pt-0.5"
                                    >
                                      {st.isSkipped ? 'Restore' : 'Skip'}
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Approval Status */}
                      <td className="p-3 whitespace-nowrap">
                        {piece.latestApprovalDate ? (
                          <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{new Date(piece.latestApprovalDate).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Published Date & Live Link */}
                      <td className="p-3 whitespace-nowrap">
                        {piece.liveUrl ? (
                          <a
                            href={piece.liveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-600 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                          >
                            <span>Live Reel/Post</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unpublished</span>
                        )}
                        {piece.publishedAt && (
                          <div className="text-[10px] text-slate-400">
                            {new Date(piece.publishedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Posting Owner */}
                      <td className="p-3 whitespace-nowrap text-slate-700 font-medium">
                        {piece.postingOwner?.name || <span className="text-slate-400">—</span>}
                      </td>

                      {/* Turnaround Days */}
                      <td className="p-3 whitespace-nowrap">
                        {piece.turnaroundDays !== undefined ? (
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {piece.turnaroundDays}d
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="p-3 max-w-[150px] truncate text-slate-500" title={piece.remarks}>
                        {piece.remarks || '—'}
                      </td>

                      {/* Actions */}
                      {!isExecutive && (
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {canAssign && (
                              <button
                                onClick={() => handleOpenAssignModal(piece)}
                                className="px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center gap-1 shadow-2xs"
                                title="Compute recommendations and assign stages"
                              >
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                Assign
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setSelectedPieceForReschedule(piece);
                                setNewPostingDate(piece.postingDate.substring(0, 10));
                                setShiftUnstarted(true);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium"
                              title="Reschedule final date and shift stage deadlines"
                            >
                              Reschedule
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Stages Modal */}
      {selectedPieceForAssign && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Assign Stage Owners: {selectedPieceForAssign.topic}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Algorithmic owner recommendations based on work preferences, current workload (&lt;85%), revisions, and bandwidth.
                </p>
              </div>
              <button
                onClick={() => setSelectedPieceForAssign(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {isLoadingRecs ? (
                <div className="text-center py-8 text-xs text-purple-600 font-semibold">
                  Calculating member bandwidth, work preferences, and lowest workload candidates...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Stages ({recommendations.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAcceptAllRecommendations}
                      className="px-3 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-bold flex items-center gap-1 shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Accept All Recommendations
                    </button>
                  </div>

                  <div className="space-y-3">
                    {recommendations.map((rec) => {
                      const selectedPersonId = assignSelections[rec.workItemId] || '';
                      const isOverriding =
                        selectedPersonId &&
                        rec.recommendedPerson &&
                        selectedPersonId !== rec.recommendedPerson._id;

                      return (
                        <div
                          key={rec.workItemId}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">
                                  Stage {rec.stageOrder}: {rec.stageKey}
                                </span>
                                {rec.recommendedPerson ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                    Recommended: {rec.recommendedPerson.name}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                    Needs owner (overloaded / none)
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1 italic">{rec.rationale}</p>
                            </div>
                          </div>

                          {/* Owner Selection Dropdown */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Assign Owner
                              </label>
                              <select
                                value={selectedPersonId}
                                onChange={(e) =>
                                  setAssignSelections({
                                    ...assignSelections,
                                    [rec.workItemId]: e.target.value,
                                  })
                                }
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                              >
                                <option value="">— Needs Owner (Unassigned) —</option>
                                {allUsers.map((u) => (
                                  <option key={u._id} value={u._id}>
                                    {u.name} ({u.role.replace('_', ' ')})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Override Reason input if overriding */}
                            {isOverriding && (
                              <div>
                                <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                                  Override Reason (Logged)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Urgent client priority or specialist skill"
                                  value={overrideReasons[rec.workItemId] || ''}
                                  onChange={(e) =>
                                    setOverrideReasons({
                                      ...overrideReasons,
                                      [rec.workItemId]: e.target.value,
                                    })
                                  }
                                  className="w-full text-xs px-2.5 py-1.5 border border-amber-300 rounded-lg bg-amber-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPieceForAssign(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingAssign || isLoadingRecs}
                onClick={handleSaveAssignments}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200 disabled:opacity-50"
              >
                {isSavingAssign ? 'Saving...' : 'Save Stage Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {selectedPieceForReschedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Reschedule Final Posting Date</h3>
              <button
                onClick={() => setSelectedPieceForReschedule(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">New Posting Date (F)</label>
                <input
                  type="date"
                  required
                  value={newPostingDate}
                  onChange={(e) => setNewPostingDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <input
                  type="checkbox"
                  checked={shiftUnstarted}
                  onChange={(e) => setShiftUnstarted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="font-bold block">Shift unstarted stage deadlines</span>
                  <span className="text-[11px] text-slate-500">
                    Automatically recalculates due dates for all unstarted stages backwards from the new final date.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPieceForReschedule(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRescheduling}
                onClick={handleSaveReschedule}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200 disabled:opacity-50"
              >
                {isRescheduling ? 'Rescheduling...' : 'Update Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
