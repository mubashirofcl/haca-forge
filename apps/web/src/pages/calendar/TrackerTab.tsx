import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Sparkles, X, Check } from 'lucide-react';
import { formatShortDate, formatShortDateTime, getStepStatusLabel } from '@mmp/shared';
import { apiFetch } from '../../lib/api';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { useAuth } from '../../context/AuthContext';
import { PersonWorkHistoryDrawer } from '../../components/PersonWorkHistoryDrawer';
import { TrackerFilterBar } from './tracker/TrackerFilterBar';
import { TrackerRow } from './tracker/TrackerRow';
import {
  apiParams,
  applyTrackerFilters,
  filtersFromParams,
  filtersToParams,
  ownerLabels,
  ownerOptions,
  type TrackerFilters,
  type TrackerPiece,
} from './tracker/trackerModel';

type ContentPieceTrackerRow = TrackerPiece;

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

/**
 * Content Flow Tracker: one row per post (what it is, its steps in order, where it stands),
 * one filter bar, filters kept in the URL. Data rules come from the API unchanged.
 */
export const TrackerTab: React.FC<{ selectedCalendar?: string }> = () => {
  const { user } = useAuth();
  const isExecutive = user?.role === 'executive';
  const canAssign = user?.role === 'admin' || user?.role === 'creative_head' || user?.role === 'sm_manager';
  const canManageSteps = user?.role === 'admin' || user?.role === 'sm_manager';
  const showOwnerFilter = user?.role !== 'team_member';

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const apiQuery = apiParams(filters).toString();

  const [pieces, setPieces] = useState<ContentPieceTrackerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const updateFilters = (next: Partial<TrackerFilters>) =>
    setSearchParams(filtersToParams({ ...filters, ...next }, searchParams), { replace: true });
  const clearFilters = () =>
    setSearchParams(
      filtersToParams({ q: '', month: '', calendar: '', type: '', workflow: '', step: '', owner: '', status: '', urgent: false, sort: filters.sort, stageStatus: '' }, searchParams),
      { replace: true }
    );

  // Assign Modal State
  const [selectedPieceForAssign, setSelectedPieceForAssign] = useState<ContentPieceTrackerRow | null>(null);
  const [drawerPersonId, setDrawerPersonId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedTimelinePiece, setSelectedTimelinePiece] = useState<ContentPieceTrackerRow | null>(null);
  useDialogFocus(timelineRef, Boolean(selectedTimelinePiece), () => setSelectedTimelinePiece(null));
  const [recommendations, setRecommendations] = useState<AssignRecommendation[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // Reschedule Modal State
  const [selectedPieceForReschedule, setSelectedPieceForReschedule] = useState<ContentPieceTrackerRow | null>(null);
  const assignDialogRef = useRef<HTMLDivElement>(null);
  const rescheduleDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(assignDialogRef, Boolean(selectedPieceForAssign), () => setSelectedPieceForAssign(null));
  useDialogFocus(rescheduleDialogRef, Boolean(selectedPieceForReschedule), () => setSelectedPieceForReschedule(null));
  const [newPostingDate, setNewPostingDate] = useState('');
  const [shiftUnstarted, setShiftUnstarted] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Users Pool (for manual selection in Assign modal)
  const [allUsers, setAllUsers] = useState<Array<{ _id: string; name: string; email: string; role: string }>>([]);

  const fetchTrackerData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch<{ data: ContentPieceTrackerRow[] }>(`/api/content-pieces${apiQuery ? `?${apiQuery}` : ''}`);
      setPieces(res.data || []);
    } catch (err) {
      console.error('Failed to fetch tracker data', err);
      setLoadError('The tracker could not be loaded. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiQuery]);

  const rows = useMemo(() => applyTrackerFilters(pieces, filters), [pieces, filters]);
  const owners = useMemo(() => ownerOptions(pieces), [pieces]);
  // Owner labels for the rows shown: first name, or first name + last initial when first names clash.
  const ownerNames = useMemo(() => ownerLabels(rows.flatMap((p) => p.stages.map((s) => s.ownerId))), [rows]);
  const now = new Date();

  useEffect(() => {
    if (!canAssign) return;
    const fetchUsers = async () => {
      try {
        const res = await apiFetch<{ data: any[] }>('/api/people?status=active');
        if (res.data && res.data.length > 0) {
          setAllUsers(res.data);
        } else {
          const cand = await apiFetch<{ data: any[] }>('/api/people/assignment-candidates');
          setAllUsers(cand.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch people', err);
        try {
          const cand = await apiFetch<{ data: any[] }>('/api/people/assignment-candidates');
          setAllUsers(cand.data || []);
        } catch (e2) {
          console.error('Failed to fetch assignment candidates', e2);
        }
      }
    };
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open Assign Modal and fetch recommendations
  const handleOpenAssignModal = async (piece: ContentPieceTrackerRow) => {
    setSelectedPieceForAssign(piece);
    setIsLoadingRecs(true);
    setRecommendations([]);
    setAssignSelections({});
    setOverrideReasons({});

    // Ensure users pool is loaded
    if (allUsers.length === 0) {
      try {
        const uRes = await apiFetch<{ data: any[] }>('/api/people?status=active');
        if (uRes.data && uRes.data.length > 0) {
          setAllUsers(uRes.data);
        }
      } catch (e) {
        // ignore
      }
    }

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

  const emptyText =
    filters.status === 'not_approved'
      ? 'No rows waiting for approval match these filters.'
      : 'No approved posts match these filters. Rows not approved yet are under Status: Not approved yet.';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 px-1">
        <Table className="w-5 h-5 text-ui-ink mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold text-ui-ink">Content Flow Tracker</h2>
          <p className="text-[13px] text-ui-muted mt-0.5 max-w-[70ch]">Every approved post, its steps in order, and where it stands.</p>
        </div>
      </div>

      <TrackerFilterBar
        filters={filters}
        owners={owners}
        showOwner={showOwnerFilter}
        count={rows.length}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      {loadError && (
        <p role="alert" className="status-tint status-changes rounded-ui-control px-3 py-2 text-sm text-ui-ink">{loadError}</p>
      )}

      {isLoading && pieces.length === 0 ? (
        <p className="glass-card p-8 text-center text-sm text-ui-muted" aria-busy="true">Loading the tracker…</p>
      ) : rows.length === 0 ? (
        <p className="glass-card p-8 text-center text-sm text-ui-muted" data-testid="tracker-empty">{emptyText}</p>
      ) : (
        <ul className="space-y-3" aria-label="Posts" aria-busy={isLoading}>
          {rows.map((piece) => (
            <TrackerRow
              key={piece._id}
              piece={piece}
              now={now}
              canAssign={canAssign && !isExecutive}
              canManageSteps={canManageSteps && !isExecutive}
              onOpenTimeline={setSelectedTimelinePiece}
              onAssign={handleOpenAssignModal}
              onChangeDate={(p) => {
                setSelectedPieceForReschedule(p);
                setNewPostingDate(p.postingDate.substring(0, 10));
                setShiftUnstarted(true);
              }}
              onToggleSkip={handleToggleSkipStage}
              onOpenPerson={setDrawerPersonId}
              ownerNames={ownerNames}
            />
          ))}
        </ul>
      )}

      {/* Assign Stages Modal */}
      {selectedPieceForAssign && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={assignDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-assign-title"
            className="glass-modal max-w-2xl w-full p-6 max-h-[90vh] flex flex-col animate-scaleUp"
          >
            <div className="flex items-center justify-between pb-4 border-b border-ui-line">
              <div>
                <h3 id="tracker-assign-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-ui-ink" />
                  Assign Stage Owners: {selectedPieceForAssign.topic}
                </h3>
                <p className="text-xs text-ui-muted mt-0.5">
                  Algorithmic owner recommendations based on work preferences, current workload (&lt;85%), revisions, and bandwidth.
                </p>
              </div>
              <button
                onClick={() => setSelectedPieceForAssign(null)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {isLoadingRecs ? (
                <div className="text-center py-8 text-xs text-ui-ink font-semibold">
                  Calculating member bandwidth, work preferences, and lowest workload candidates...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Stages ({recommendations.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAcceptAllRecommendations}
                      className="px-3 py-1 rounded-lg bg-white/70 text-ui-ink border border-ui-line hover:bg-white text-xs font-bold flex items-center gap-1 shadow-2xs"
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

                      const optionsMap = new Map<string, any>();
                      for (const u of allUsers) {
                        optionsMap.set(u._id, u);
                      }
                      if (rec.recommendedPerson?._id) {
                        optionsMap.set(rec.recommendedPerson._id, rec.recommendedPerson);
                      }
                      if (rec.currentOwner?._id) {
                        optionsMap.set(rec.currentOwner._id, rec.currentOwner);
                      }
                      if (Array.isArray(rec.candidatePool)) {
                        for (const c of rec.candidatePool) {
                          const m = (c as any)?.member || c;
                          if (m?._id) optionsMap.set(m._id, m);
                        }
                      }
                      const availableUsers = Array.from(optionsMap.values());

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
                              <p className="text-[11px] text-ui-muted mt-1 italic">{rec.rationale}</p>
                            </div>
                          </div>

                          {/* Owner Selection Dropdown */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[10px] font-bold text-ui-muted block mb-1">
                                Assign Owner
                              </label>
                              <select
                                aria-label="Assign owner"
                                value={selectedPersonId}
                                onChange={(e) =>
                                  setAssignSelections({
                                    ...assignSelections,
                                    [rec.workItemId]: e.target.value,
                                  })
                                }
                                className="ui-select w-full"
                              >
                                <option value="">— Needs Owner (Unassigned) —</option>
                                {availableUsers.map((u: any) => (
                                  <option key={u._id} value={u._id}>
                                    {u.name} {u.jobRole ? `— ${u.jobRole}` : u.role ? `(${u.role.replace('_', ' ')})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Override Reason input if overriding */}
                            {isOverriding && (
                              <div>
                                <label className="text-[10px] font-bold text-amber-700 block mb-1">
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
                                  className="ui-input w-full"
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

            <div className="pt-4 border-t border-ui-line flex items-center justify-end gap-2">
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
                className="px-4 py-2 rounded-xl bg-ui-ink hover:bg-ui-ink/85 text-white text-xs font-bold shadow-md disabled:opacity-50"
              >
                {isSavingAssign ? 'Saving...' : 'Save Stage Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {selectedPieceForReschedule && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={rescheduleDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-reschedule-title"
            className="glass-modal max-w-md w-full p-6 animate-scaleUp"
          >
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <h3 id="tracker-reschedule-title" className="text-base font-bold text-slate-900">Change publish date</h3>
              <button
                onClick={() => setSelectedPieceForReschedule(null)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">New publish date</label>
                <input
                  type="date"
                  required
                  value={newPostingDate}
                  onChange={(e) => setNewPostingDate(e.target.value)}
                  className="ui-input w-full"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-3 bg-white/70 rounded-xl border border-ui-line">
                <input
                  type="checkbox"
                  checked={shiftUnstarted}
                  onChange={(e) => setShiftUnstarted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-ui-ink focus:ring-ui-ink"
                />
                <div>
                  <span className="font-bold block">Shift unstarted stage deadlines</span>
                  <span className="text-[11px] text-ui-muted">
                    Automatically recalculates due dates for all unstarted stages backwards from the new publish date.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-3 border-t border-ui-line flex items-center justify-end gap-2">
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
                className="px-4 py-2 rounded-xl bg-ui-ink hover:bg-ui-ink/85 text-white text-xs font-bold shadow-md disabled:opacity-50"
              >
                {isRescheduling ? 'Rescheduling...' : 'Update Date'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Drawer for Content Piece */}
      {selectedTimelinePiece && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-xs flex items-center justify-center p-4">
          <div
            ref={timelineRef}
            role="dialog"
            aria-modal="true"
            aria-label="Content piece timeline"
            className="glass-modal max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <div>
                <span className="text-[10px] font-bold text-ui-ink block">
                  Piece Timeline &amp; Step Lifecycle
                </span>
                <h3 className="text-base font-extrabold text-slate-900">{selectedTimelinePiece.topic}</h3>
                <p className="text-xs text-ui-muted">
                  {selectedTimelinePiece.workflowLabel || selectedTimelinePiece.contentType} · Publish date {formatShortDate(selectedTimelinePiece.postingDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTimelinePiece(null)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stages Timeline List */}
            <div className="space-y-4">
              {selectedTimelinePiece.stages.map((st: any) => (
                <div key={st._id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{st.stageKey}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border text-slate-700">
                        {getStepStatusLabel(st.status)}
                      </span>
                    </div>
                    <span className="text-xs text-ui-muted font-semibold">
                      Holder: <strong className="text-slate-800">{st.holder || st.ownerId?.name || '—'}</strong>
                    </span>
                  </div>

                  {/* Stage Timestamps */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-ui-muted block text-[10px] font-bold">Due Date</span>
                      <span className="font-semibold text-slate-800">
                        {formatShortDate(st.dueDate) || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-ui-muted block text-[10px] font-bold">Started</span>
                      <span className="font-semibold text-slate-800">
                        {formatShortDateTime(st.startedAt) || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-ui-muted block text-[10px] font-bold">Submitted</span>
                      <span className="font-semibold text-slate-800">
                        {formatShortDateTime(st.submittedAt) || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-ui-muted block text-[10px] font-bold">Approved</span>
                      <span className="font-semibold text-slate-800">
                        {formatShortDateTime(st.approvedAt) || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-ui-muted block text-[10px] font-bold">Work Time</span>
                      <span className="font-semibold text-slate-800">
                        {st.measures?.workTimeFormatted || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-ui-muted block text-[10px] font-bold">Approval Wait</span>
                      <span className="font-semibold text-slate-800">
                        {st.measures?.approvalWaitFormatted || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Paused intervals if any */}
                  {Array.isArray(st.intervals) && st.intervals.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-ui-muted block">
                        Paused Intervals ({st.intervals.length})
                      </span>
                      {st.intervals.map((iv: any, idx: number) => (
                        <div key={idx} className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                          <span className="font-bold text-rose-700">{iv.kind}</span>
                          <span>{formatShortDateTime(iv.startedAt)} → {iv.endedAt ? formatShortDateTime(iv.endedAt) : 'ongoing'}</span>
                          {iv.reason && <span className="text-ui-muted">({iv.reason})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-ui-line text-right">
              <button
                type="button"
                onClick={() => setSelectedTimelinePiece(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Work History Drawer */}
      <PersonWorkHistoryDrawer
        isOpen={Boolean(drawerPersonId)}
        personId={drawerPersonId}
        onClose={() => setDrawerPersonId(null)}
      />
    </div>
  );
};
