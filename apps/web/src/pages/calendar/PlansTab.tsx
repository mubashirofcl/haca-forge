import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { planGridHref } from './PlanGridPage';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { statusClass, type StatusTone } from '../../lib/statusTone';
import {
  FileSpreadsheet,
  Upload,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  X,
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  CALENDAR_LIST,
  getCalendarDefinition,
  type CalendarKey,
  type CalendarPlanStatus,
  type RowStatus,
  formatPlanRowCounts,
  isPostableWorkType,
  normalizeWorkType,
  planMonthKey,
} from '@mmp/shared';
import { Avatar } from '../../components/Avatar';
import {
  type StepLineState,
  calculateDueDateString,
  getExpectedStepDefs,
  buildDefaultSteps,
  applyAutofill,
  applyPostingDateChange,
  applyTypeChange,
  setStepDueDate,
  setStepOwner,
  validateRowSteps,
} from './planRowSteps';

export interface StagePlanPreviewItem {
  stageKey: 'Content' | 'Script' | 'Design' | 'Shoot' | 'Edit' | 'Post';
  ownerId?: string | { _id: string; name: string; avatarUrl?: string; workPreferences?: string[] };
  ownerName?: string;
  dueDate: string;
  ownerSource?: 'suggested' | 'manual';
  dueDateSource?: 'auto' | 'manual';
  overrideReason?: string;
  isSuggestedOwner?: boolean;
  isSuggestedDueDate?: boolean;
}

export type { StepLineState } from './planRowSteps';

export interface TeamMemberOption {
  _id: string;
  name: string;
  email: string;
  role: string;
  workPreferences?: string[];
  avatarUrl?: string;
}

interface PlanRow {
  _id: string;
  postingDate: string;
  postingTime?: string;
  topic: string;
  contentType: string;
  type?: string;
  brief?: string;
  forTeam?: string;
  programOrEvent?: string;
  priority?: string;
  postingOwnerId?: string | { _id: string; name: string; avatarUrl?: string };
  needsScript?: boolean;
  needsShoot?: boolean;
  sourceVideoLink?: string;
  contentLink?: string;
  remarks?: string;
  rowStatus: RowStatus;
  reviewComment?: string;
  stagesGenerated?: boolean;
  stagePlan?: StagePlanPreviewItem[];
}

interface CalendarPlan {
  _id: string;
  code: string;
  title: string;
  kind: 'monthly' | 'individual' | 'project';
  periodStart: string;
  periodEnd: string;
  calendar?: CalendarKey;
  status: CalendarPlanStatus;
  comment?: string;
  submittedAt?: string;
  approvedAt?: string;
  createdById?: { _id: string; name: string; email: string };
  approvedById?: { _id: string; name: string; email: string };
  rowCount: number;
  approvedRowCount: number;
  /** Phase 6: any generated step has started; the plan can no longer be deleted. */
  hasStartedWork?: boolean;
  submittedRowCount: number;
  changesRequestedRowCount: number;
  draftRowCount: number;
  submissionWarnings?: Array<{
    code: string;
    message: string;
    overlappingPlanId?: string;
    overlappingPlanCode?: string;
    overlappingPlanTitle?: string;
  }>;
  rows?: PlanRow[];
}

interface ValidationPreviewRow {
  rowNumber: number;
  topic: string;
  contentType: string;
  postingDate: string;
  needsScript: boolean;
  needsShoot: boolean;
  contentLink: string;
  remarks: string;
  isValid: boolean;
  errors: string[];
}

interface ValidationPreviewResponse {
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  previewRows: ValidationPreviewRow[];
}

// Plan and row statuses reuse the shared status tones (colours live in index.css).
const STATUS_BADGES: Record<CalendarPlanStatus, { tone: StatusTone; label: string }> = {
  Draft: { tone: 'not-started', label: 'Draft' },
  Submitted: { tone: 'waiting', label: 'Submitted for Review' },
  'Changes requested': { tone: 'changes', label: 'Changes Requested' },
  Approved: { tone: 'approved', label: 'Approved' },
  'Approved with pending rows': { tone: 'in-progress', label: 'Approved (Pending Rows)' },
};

const ROW_STATUS_BADGES: Record<RowStatus, { tone: StatusTone; label: string }> = {
  draft: { tone: 'not-started', label: 'Draft' },
  submitted: { tone: 'waiting', label: 'Submitted' },
  changes_requested: { tone: 'changes', label: 'Changes Requested' },
  approved: { tone: 'approved', label: 'Approved' },
};

interface PlansTabProps {
  selectedCalendar?: string;
  isIndividualCreateRequested?: boolean;
  onIndividualCreateHandled?: () => void;
}

export const PlansTab: React.FC<PlansTabProps> = ({
  selectedCalendar,
  isIndividualCreateRequested,
  onIndividualCreateHandled,
}) => {
  const { user } = useAuth();
  const isExecutive = user?.role === 'executive';
  // Plan row review is the Creative Head's alone (PG-3); admin keeps planning and every other permission.
  const isCreativeHead = user?.role === 'creative_head';
  const isSMManager = user?.role === 'sm_manager' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  // Plans List State
  const [plans, setPlans] = useState<CalendarPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<CalendarPlan | null>(null);

  // The plan grid is a full-screen route (/calendar/plan-grid). One entry point per role, below.
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openGrid = (opts: { calendar?: string; month?: string; planId?: string } = {}) =>
    navigate(planGridHref(opts));
  // Older deep links (?tab=plans&grid=1&gridCalendar=&gridMonth=&gridPlan=) still work.
  useEffect(() => {
    if (searchParams.get('grid') === '1') {
      navigate(
        planGridHref({
          calendar: searchParams.get('gridCalendar') || 'sm',
          month: searchParams.get('gridMonth') || undefined,
          planId: searchParams.get('gridPlan') || undefined,
        }),
        { replace: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** The grid opens on the selected monthly plan's month, otherwise on the current calendar filter. */
  const openGridForContext = () =>
    selectedPlan && selectedPlan.kind === 'monthly'
      ? openGrid({ calendar: selectedPlan.calendar || 'sm', month: planMonthKey(selectedPlan.periodStart), planId: selectedPlan._id })
      : openGrid({ calendar: selectedCalendar && selectedCalendar !== 'all' ? selectedCalendar : 'sm' });
  const gridLabel = isCreativeHead ? 'Review in plan grid' : isExecutive ? 'View plan grid' : 'Open plan grid';
  const canOpenGrid = isSMManager || isCreativeHead || isExecutive;
  const isMonthlyPlan = selectedPlan?.kind === 'monthly';

  // Create Plan Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<'monthly' | 'individual'>('monthly');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newComment, setNewComment] = useState('');
  // Multi-step Create Plan Modal State
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [selectedCalendarForPlan, setSelectedCalendarForPlan] = useState<CalendarKey>('sm');
  const [indivTopic, setIndivTopic] = useState('');
  const [indivType, setIndivType] = useState('Static Post');
  const [indivBrief, setIndivBrief] = useState('');
  const [isMovingCalendar, setIsMovingCalendar] = useState(false);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Rename Plan State
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Upload & Import Preview State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPlanId, setUploadPlanId] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ValidationPreviewResponse | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Row Grid Edit / Add State
  const [activeMembers, setActiveMembers] = useState<TeamMemberOption[]>([]);
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [rowPostingDate, setRowPostingDate] = useState('');
  const [rowPostingTime, setRowPostingTime] = useState('18:00');
  const [rowTopic, setRowTopic] = useState('');
  const [rowBrief, setRowBrief] = useState('');
  const [rowType, setRowType] = useState('Reel A');
  const [rowNeedsScript, setRowNeedsScript] = useState(true);
  const [rowNeedsShoot, setRowNeedsShoot] = useState(true);
  const [rowSourceVideoLink, setRowSourceVideoLink] = useState('');
  const [rowContentLink, setRowContentLink] = useState('');
  const [rowRemarks, setRowRemarks] = useState('');
  const [rowSteps, setRowSteps] = useState<StepLineState[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowComment, setEditingRowComment] = useState<string | null>(null);

  // Creative Head Review State
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [rowComments, setRowComments] = useState<Record<string, string>>({});
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await apiFetch<{ data: TeamMemberOption[] }>('/api/people?status=active');
        setActiveMembers(res.data || []);
      } catch {
        try {
          const res2 = await apiFetch<{ data: TeamMemberOption[] }>('/api/users?limit=100');
          setActiveMembers(res2.data || []);
        } catch {}
      }
    };
    fetchMembers();
  }, []);

  const isPostable = isPostableWorkType(rowType);
  const isReel = rowType.toLowerCase().includes('reel');
  const mainDateLabel = isPostable ? 'Publish date' : 'Needed-by date';

  const generateDefaultSteps = (
    type: string,
    needsScript: boolean,
    needsShoot: boolean,
    postDateStr: string
  ): StepLineState[] => buildDefaultSteps(type, needsScript, needsShoot, postDateStr, activeMembers);

  const triggerAutofill = async (
    type: string,
    dateStr: string,
    needsScript: boolean,
    needsShoot: boolean
  ) => {
    if (!dateStr) return;
    try {
      const res = await apiFetch<{
        data: {
          stages: Array<{
            stageKey: string;
            ownerId: string | null;
            ownerName: string | null;
            dueDate: string;
            reason: string;
          }>;
          suggestedPostingOwner: { _id: string; name: string } | null;
        };
      }>('/api/calendar-plans/autofill', {
        method: 'POST',
        body: JSON.stringify({
          type,
          postingDate: dateStr,
          needsScript,
          needsShoot,
          currentPlanRows: selectedPlan?.rows || [],
        }),
      });

      if (res?.data?.stages) {
        setRowSteps((prev) => applyAutofill(prev, res.data.stages));
      }
    } catch {}
  };

  const stepValidation = useMemo(
    () =>
      validateRowSteps({
        steps: rowSteps,
        postingDate: rowPostingDate,
        type: rowType,
        needsShoot: rowNeedsShoot,
        sourceVideoLink: rowSourceVideoLink,
        members: activeMembers,
      }),
    [rowSteps, rowPostingDate, rowType, rowNeedsShoot, rowSourceVideoLink, activeMembers]
  );

  const handlePostingDateChange = (newDate: string) => {
    setRowPostingDate(newDate);
    if (!newDate) return;
    setRowSteps((prev) => applyPostingDateChange(prev, newDate));
  };

  const handleTypeOrTogglesChange = (
    newType: string,
    newNeedsScript: boolean,
    newNeedsShoot: boolean
  ) => {
    setRowType(newType);
    setRowNeedsScript(newNeedsScript);
    setRowNeedsShoot(newNeedsShoot);
    setRowSteps((prev) => applyTypeChange(prev, newType, newNeedsScript, newNeedsShoot, rowPostingDate, activeMembers));
    triggerAutofill(newType, rowPostingDate, newNeedsScript, newNeedsShoot);
  };

  const handleStepDueDateChange = (stageKey: string, newDate: string) => {
    setRowSteps((prev) => setStepDueDate(prev, stageKey, newDate));
  };

  const handleStepOwnerChange = (stageKey: string, newOwnerId: string) => {
    setRowSteps((prev) => setStepOwner(prev, stageKey, newOwnerId, activeMembers));
  };

  const handleOpenEditModal = (row: PlanRow) => {
    setEditingRowId(row._id);
    setEditingRowComment(row.reviewComment || null);
    setRowTopic(row.topic);
    const postDateStr = row.postingDate ? row.postingDate.substring(0, 10) : '';
    setRowPostingDate(postDateStr);
    setRowPostingTime(row.postingTime || '18:00');
    const cType = row.contentType || row.type || 'Reel A';
    setRowType(cType);
    setRowBrief(row.brief || '');
    setRowNeedsScript(row.needsScript ?? true);
    setRowNeedsShoot(row.needsShoot ?? true);
    setRowSourceVideoLink(row.sourceVideoLink || '');
    setRowContentLink(row.contentLink || '');
    setRowRemarks(row.remarks || '');

    const defs = getExpectedStepDefs(cType, row.needsScript ?? true, row.needsShoot ?? true);
    if (Array.isArray(row.stagePlan) && row.stagePlan.length > 0) {
      const stepMap = new Map(row.stagePlan.map((sp: any) => [sp.stageKey, sp]));
      const steps: StepLineState[] = defs.map((d) => {
        const sp = stepMap.get(d.stageKey);
        const ownerObj = typeof sp?.ownerId === 'object' && sp?.ownerId ? sp.ownerId : null;
        const ownerId = ownerObj ? ownerObj._id : (sp?.ownerId || null);
        const ownerName = ownerObj ? ownerObj.name : '';
        const dueDate = sp?.dueDate ? sp.dueDate.substring(0, 10) : calculateDueDateString(postDateStr, d.offset);
        return {
          stageKey: d.stageKey,
          ownerId: ownerId || null,
          ownerName: ownerName || '',
          ownerSource: sp?.ownerSource || 'suggested',
          ownerReason: sp?.overrideReason || '',
          dueDate,
          dueDateSource: sp?.dueDateSource || 'auto',
          offsetDays: d.offset,
        };
      });
      setRowSteps(steps);
    } else {
      const steps = generateDefaultSteps(cType, row.needsScript ?? true, row.needsShoot ?? true, postDateStr);
      setRowSteps(steps);
      triggerAutofill(cType, postDateStr, row.needsScript ?? true, row.needsShoot ?? true);
    }

    setIsAddRowOpen(true);
  };

  const handleOpenAddRowModal = () => {
    setEditingRowId(null);
    setEditingRowComment(null);
    setRowTopic('');
    setRowBrief('');
    const targetDate = selectedPlan?.periodStart
      ? selectedPlan.periodStart.substring(0, 10)
      : new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
    setRowPostingDate(targetDate);
    setRowPostingTime('18:00');
    setRowType('Reel A');
    setRowNeedsScript(true);
    setRowNeedsShoot(true);
    setRowSourceVideoLink('');
    setRowContentLink('');
    setRowRemarks('');

    const steps = generateDefaultSteps('Reel A', true, true, targetDate);
    setRowSteps(steps);
    triggerAutofill('Reel A', targetDate, true, true);
    setIsAddRowOpen(true);
  };

  const getDefaultStagePlanPreview = (row: PlanRow): StagePlanPreviewItem[] => {
    const isRowReel = (row.contentType || row.type || '').toLowerCase().includes('reel');
    const defs = getExpectedStepDefs(
      row.contentType || row.type || 'Static Post',
      row.needsScript ?? isRowReel,
      row.needsShoot ?? isRowReel
    );
    const postDateStr = row.postingDate ? row.postingDate.substring(0, 10) : '';
    return defs.map((d) => ({
      stageKey: d.stageKey,
      ownerName: 'Unassigned',
      dueDate: d.stageKey === 'Post' ? postDateStr : calculateDueDateString(postDateStr, d.offset),
      ownerSource: 'suggested',
      dueDateSource: 'auto',
    }));
  };

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const url = selectedCalendar && selectedCalendar !== 'all' ? `/api/calendar-plans?calendar=${selectedCalendar}` : '/api/calendar-plans';
      const res = await apiFetch<{ data: CalendarPlan[] }>(url);
      setPlans(res.data || []);
      if (selectedPlan) {
        const updated = (res.data || []).find((p) => p._id === selectedPlan._id);
        if (updated) {
          fetchPlanDetails(updated._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch calendar plans', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanDetails = async (id: string) => {
    try {
      const res = await apiFetch<{ data: CalendarPlan }>(`/api/calendar-plans/${id}`);
      setSelectedPlan(res.data);
      setSelectedRowIds([]);
    } catch (err) {
      console.error('Failed to fetch plan details', err);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [selectedCalendar]);

  useEffect(() => {
    if (isIndividualCreateRequested) {
      openCreateModal('individual');
      onIndividualCreateHandled?.();
    }
  }, [isIndividualCreateRequested]);



  const openCreateModal = (kind: 'monthly' | 'individual' = 'monthly') => {
    setNewKind(kind);
    setCreateStep(1);
    setCreateError(null);
    const initialCal: CalendarKey = selectedCalendar && selectedCalendar !== 'all' ? (selectedCalendar as CalendarKey) : 'sm';
    setSelectedCalendarForPlan(initialCal);

    const now = new Date();
    if (kind === 'monthly') {
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const monthName = nextMonth.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
      setNewTitle(`${getCalendarDefinition(initialCal).name} ${monthName} ${nextMonth.getUTCFullYear()}`);
      setNewStart(nextMonth.toISOString().slice(0, 10));
      const endMonth = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0));
      setNewEnd(endMonth.toISOString().slice(0, 10));
    } else {
      const todayStr = now.toISOString().slice(0, 10);
      setNewTitle(`${getCalendarDefinition(initialCal).name} Individual Work`);
      setNewStart(todayStr);
      setNewEnd(todayStr);
      setIndivTopic('');
      setIndivType('Static Post');
      setIndivBrief('');
    }
    setIsCreateOpen(true);
  };

  const duplicateMonthPlan = useMemo(() => {
    if (newKind !== 'monthly' || !newStart) return null;
    const startMonthStr = newStart.slice(0, 7);
    return plans.find(
      (p) =>
        p.kind === 'monthly' &&
        (p.calendar || 'sm') === selectedCalendarForPlan &&
        p.periodStart.slice(0, 7) === startMonthStr
    );
  }, [plans, newKind, newStart, selectedCalendarForPlan]);

  const handleMoveCalendar = async (newCal: CalendarKey) => {
    if (!selectedPlan) return;
    setIsMovingCalendar(true);
    try {
      await apiFetch(`/api/calendar-plans/${selectedPlan._id}/calendar`, {
        method: 'PATCH',
        body: JSON.stringify({ calendar: newCal }),
      });
      await fetchPlanDetails(selectedPlan._id);
      await fetchPlans();
    } catch (err: any) {
      alert(err.message || 'Failed to move plan to another calendar');
    } finally {
      setIsMovingCalendar(false);
    }
  };

  // Create Plan Submit
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStart || !newEnd) {
      setCreateError('Title, period start, and period end are required');
      return;
    }
    setIsSubmittingPlan(true);
    setCreateError(null);
    try {
      const payload: any = {
        title: newTitle.trim(),
        calendar: selectedCalendarForPlan,
        kind: newKind,
        periodStart: newStart,
        periodEnd: newEnd,
        comment: newComment.trim(),
      };
      if (newKind === 'monthly' && newEnd < newStart) {
        setCreateError('Period end cannot be before period start.');
        setIsSubmittingPlan(false);
        return;
      }
      if (newKind === 'individual') {
        const normIndivType = normalizeWorkType(indivType) || 'Static Post';
        const isReel = normIndivType === 'Reel';
        payload.rows = [
          {
            topic: indivTopic.trim() || 'Individual Deliverable',
            type: normIndivType,
            postingDate: newStart,
            brief: indivBrief.trim(),
            needsScript: isReel,
            needsShoot: isReel,
          },
        ];
      }
      const res = await apiFetch<{ data: CalendarPlan }>('/api/calendar-plans', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setIsCreateOpen(false);
      setNewTitle('');
      setNewComment('');
      await fetchPlans();
      if (res.data) {
        await fetchPlanDetails(res.data._id);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create plan');
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  // Handle File Selection & Validation Preview
  const handlePreviewUpload = async (file: File) => {
    setSelectedFile(file);
    setIsPreviewLoading(true);
    setImportError(null);
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch<{ data: any }>('/api/calendar-plans/preview', {
        method: 'POST',
        body: formData,
      });
      setPreviewData(res.data);
    } catch (err: any) {
      setImportError(err.message || 'Failed to validate uploaded file');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Commit Previewed Rows
  const handleCommitUpload = async () => {
    if (!previewData || !uploadPlanId) {
      setImportError('Please select a target plan for committing rows');
      return;
    }

    const rowsToInspect = (previewData as any).previewRows || (previewData as any).rows || [];
    const validRows = rowsToInspect.filter((r: any) => r.isValid);
    if (validRows.length === 0) {
      setImportError('No valid rows available to commit');
      return;
    }

    setIsCommitting(true);
    setImportError(null);
    try {
      await apiFetch(`/api/calendar-plans/${uploadPlanId}/rows`, {
        method: 'POST',
        body: JSON.stringify({
          rows: validRows.map((r: any) => ({
            postingDate: r.postingDate,
            postingTime: r.postingTime || '18:00',
            topic: r.topic,
            contentType: r.contentType,
            type: r.contentType,
            needsScript: r.needsScript,
            needsShoot: r.needsShoot,
            sourceVideoLink: r.sourceVideoLink || '',
            postingOwnerId: r.postingOwnerId || null,
            stagePlan: r.stagePlan || [],
            contentLink: r.contentLink || '',
            remarks: r.remarks || '',
          })),
        }),
      });

      setIsUploadOpen(false);
      setPreviewData(null);
      setSelectedFile(null);
      await fetchPlans();
      await fetchPlanDetails(uploadPlanId);
    } catch (err: any) {
      setImportError(err.message || 'Failed to commit rows to plan');
    } finally {
      setIsCommitting(false);
    }
  };

  // Submit Plan for Approval
  const handleSubmitPlan = async (planId: string) => {
    if (!selectedPlan?.rows || selectedPlan.rows.length === 0) {
      alert('Add at least one row');
      return;
    }
    try {
      await apiFetch(`/api/calendar-plans/${planId}/submit`, { method: 'POST' });
      await fetchPlans();
      await fetchPlanDetails(planId);
    } catch (err: any) {
      alert(err.message || 'Failed to submit plan');
    }
  };

  // Delete a plan whose steps have not started (Phase 6)
  const handleDeletePlan = async (planId: string) => {
    if (
      !confirm(
        'Delete this plan? Its rows and any steps not started yet will be removed. This cannot be undone.'
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/calendar-plans/${planId}`, { method: 'DELETE' });
      setSelectedPlan(null);
      await fetchPlans();
    } catch (err: any) {
      alert(err.message || 'Failed to delete plan');
    }
  };

  // Rename Plan
  const handleRenamePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !renameTitle.trim()) return;
    setIsRenaming(true);
    try {
      await apiFetch(`/api/calendar-plans/${selectedPlan._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      setIsRenameOpen(false);
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to rename plan');
    } finally {
      setIsRenaming(false);
    }
  };

  // Add / Edit Row in Plan Grid
  const handleSaveRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!rowTopic.trim() || !rowPostingDate) {
      alert('Topic and date are required');
      return;
    }

    if (Object.keys(stepValidation.errors).length > 0) {
      alert('Please resolve all step errors before submitting.');
      return;
    }

    const derivedBrief =
      rowBrief.trim() ||
      rowRemarks.trim() ||
      (rowTopic.trim() ? `Brief for ${rowTopic.trim()}` : '');

    const postStep = rowSteps.find((s) => s.stageKey === 'Post');
    const stagePlanPayload = rowSteps.map((s) => ({
      stageKey: s.stageKey,
      ownerId: s.ownerId || null,
      dueDate: s.dueDate ? new Date(s.dueDate.includes('T') ? s.dueDate : s.dueDate + 'T00:00:00') : new Date(),
      ownerSource: s.ownerSource || 'suggested',
      dueDateSource: s.dueDateSource || 'auto',
      overrideReason:
        s.dueDateSource === 'manual' || s.ownerSource === 'manual'
          ? 'set by SM Manager'
          : s.ownerReason || '',
    }));

    const payload = {
      topic: rowTopic.trim(),
      postingDate: rowPostingDate,
      postingTime: rowPostingTime || '18:00',
      contentType: rowType,
      type: rowType,
      brief: derivedBrief,
      postingOwnerId: postStep?.ownerId || null,
      needsScript: isReel ? rowNeedsScript : false,
      needsShoot: isReel ? rowNeedsShoot : false,
      sourceVideoLink: isReel && !rowNeedsShoot ? rowSourceVideoLink.trim() : '',
      stagePlan: stagePlanPayload,
      contentLink: rowContentLink.trim(),
      remarks: rowRemarks.trim(),
    };

    try {
      if (editingRowId) {
        await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows/${editingRowId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows`, {
          method: 'POST',
          body: JSON.stringify({
            rows: [payload],
          }),
        });
      }

      setIsAddRowOpen(false);
      setEditingRowId(null);
      setEditingRowComment(null);
      setRowTopic('');
      setRowPostingDate('');
      setRowPostingTime('18:00');
      setRowBrief('');
      setRowSourceVideoLink('');
      setRowContentLink('');
      setRowRemarks('');
      setRowSteps([]);
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to save row');
    }
  };

  // Quick Resubmit single row
  const handleQuickResubmitRow = async (rowId: string) => {
    if (!selectedPlan) return;
    try {
      await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows/${rowId}/submit`, {
        method: 'POST',
      });
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to submit row');
    }
  };

  // Save changes and immediately resubmit row
  const handleSaveAndResubmitRow = async () => {
    if (!selectedPlan || !editingRowId) return;
    if (!rowTopic.trim() || !rowPostingDate) {
      alert('Topic and date are required');
      return;
    }

    if (Object.keys(stepValidation.errors).length > 0) {
      alert('Please resolve all step errors before submitting.');
      return;
    }

    const derivedBrief =
      rowBrief.trim() ||
      rowRemarks.trim() ||
      (rowTopic.trim() ? `Brief for ${rowTopic.trim()}` : '');

    const postStep = rowSteps.find((s) => s.stageKey === 'Post');
    const stagePlanPayload = rowSteps.map((s) => ({
      stageKey: s.stageKey,
      ownerId: s.ownerId || null,
      dueDate: s.dueDate ? new Date(s.dueDate.includes('T') ? s.dueDate : s.dueDate + 'T00:00:00') : new Date(),
      ownerSource: s.ownerSource || 'suggested',
      dueDateSource: s.dueDateSource || 'auto',
      overrideReason:
        s.dueDateSource === 'manual' || s.ownerSource === 'manual'
          ? 'set by SM Manager'
          : s.ownerReason || '',
    }));

    try {
      await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows/${editingRowId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          topic: rowTopic.trim(),
          postingDate: rowPostingDate,
          postingTime: rowPostingTime || '18:00',
          contentType: rowType,
          type: rowType,
          brief: derivedBrief,
          postingOwnerId: postStep?.ownerId || null,
          needsScript: isReel ? rowNeedsScript : false,
          needsShoot: isReel ? rowNeedsShoot : false,
          sourceVideoLink: isReel && !rowNeedsShoot ? rowSourceVideoLink.trim() : '',
          stagePlan: stagePlanPayload,
          contentLink: rowContentLink.trim(),
          remarks: rowRemarks.trim(),
        }),
      });

      await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows/${editingRowId}/submit`, {
        method: 'POST',
      });

      setIsAddRowOpen(false);
      setEditingRowId(null);
      setEditingRowComment(null);
      setRowTopic('');
      setRowPostingDate('');
      setRowPostingTime('18:00');
      setRowBrief('');
      setRowSourceVideoLink('');
      setRowContentLink('');
      setRowRemarks('');
      setRowSteps([]);
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to resubmit row');
    }
  };

  // Delete Row
  const handleDeleteRow = async (rowId: string) => {
    if (!selectedPlan || !confirm('Are you sure you want to delete this row?')) return;
    try {
      await apiFetch(`/api/calendar-plans/${selectedPlan._id}/rows/${rowId}`, {
        method: 'DELETE',
      });
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete row');
    }
  };

  // Creative Head Review Actions (approve_all, approve_selected, request_changes)
  const handleReviewPlan = async (action: 'approve_all' | 'approve_selected' | 'request_changes') => {
    if (!selectedPlan) return;
    setIsReviewSubmitting(true);
    setReviewSuccessMsg(null);

    try {
      const payload: any = { action };
      if (action === 'approve_selected') {
        if (selectedRowIds.length === 0) {
          alert('Please select at least one row to approve');
          setIsReviewSubmitting(false);
          return;
        }
        payload.approvedRowIds = selectedRowIds;
        payload.selectedRowIds = selectedRowIds;
      }

      if (action === 'request_changes') {
        const comments: Record<string, string> = {};
        const changes: Array<{ rowId: string; comment: string }> = [];
        const targetIds = selectedRowIds.length > 0 ? selectedRowIds : (selectedPlan.rows || []).map((r) => r._id);
        let hasComment = false;
        for (const rid of targetIds) {
          if (rowComments[rid]?.trim()) {
            comments[rid] = rowComments[rid].trim();
            changes.push({ rowId: rid, comment: rowComments[rid].trim() });
            hasComment = true;
          }
        }
        if (!hasComment) {
          alert('Please enter a review comment explaining requested changes for at least one row');
          setIsReviewSubmitting(false);
          return;
        }
        payload.comments = comments;
        payload.changes = changes;
      }

      const res = await apiFetch<{ data: CalendarPlan; message: string }>(
        `/api/calendar-plans/${selectedPlan._id}/review`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setReviewSuccessMsg(res.message || 'Review completed successfully');
      setSelectedRowIds([]);
      setRowComments({});
      await fetchPlans();
      await fetchPlanDetails(selectedPlan._id);
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-panel rounded-ui-panel p-5 sm:p-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-ui-ink" />
            Calendar Plans Management
          </h2>
          <p className="text-xs text-ui-muted mt-0.5">
            Build the monthly content calendar, check your spreadsheet before upload, and follow the Creative Head's approval row by row.
          </p>
        </div>

        {/* One entry point into the plan grid for every role that may use it.
            Download Template, Upload and Submit live in the grid; Add individual work is on the Calendar header. */}
        {canOpenGrid && (
          <button type="button" onClick={openGridForContext} className="ui-btn ui-btn-primary h-11 self-start sm:self-auto">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {gridLabel}
          </button>
        )}
      </div>

      {/* Main Grid: Plans List + Selected Plan Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Plans Table */}
        <div className={selectedPlan ? 'lg:col-span-5' : 'lg:col-span-12'}>
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-ui-line flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ui-text">
                All Plans ({plans.length})
              </span>
              {isLoading && <span className="text-xs text-ui-muted">Loading...</span>}
            </div>

            <div className="divide-y divide-ui-line max-h-[600px] overflow-y-auto">
              {plans.length === 0 && !isLoading ? (
                <div className="p-8 text-center text-ui-muted text-xs">
                  No calendar plans created yet. Click "New Plan" or "Upload & Preview" to get started.
                </div>
              ) : (
                plans.map((p) => {
                  const badge = STATUS_BADGES[p.status] || STATUS_BADGES.Draft;
                  const isSelected = selectedPlan?._id === p._id;
                  const hasOverlap = p.submissionWarnings?.some((w) => w.code === 'OVERLAPPING_PERIOD');
                  const planCal = getCalendarDefinition(p.calendar);
                  return (
                    <button
                      type="button"
                      key={p._id}
                      onClick={() => fetchPlanDetails(p._id)}
                      aria-pressed={isSelected}
                      className={`block w-full text-left p-4 transition-colors hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-ink ${
                        isSelected ? 'bg-white shadow-[inset_3px_0_0_rgb(var(--ui-ink-rgb))]' : ''
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="block min-w-0">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-ui-ink line-clamp-1">{p.title}</span>
                            <span className="text-[10px] font-mono font-bold text-ui-ink bg-white/70 px-1.5 py-0.5 rounded">
                              {p.code}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/80 text-ui-text">
                              <span className={`cal-dot cal-${planCal.key}`} />
                              {planCal.name}
                            </span>
                          </span>
                          <span className="block text-xs text-ui-muted mt-1">
                            {new Date(p.periodStart).toLocaleDateString(undefined, { timeZone: 'UTC' })} – {new Date(p.periodEnd).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                          </span>
                        </span>
                        <span
                          className={`status-chip ${statusClass(badge.tone)} text-[11px] font-semibold px-2 py-0.5 whitespace-nowrap`}
                        >
                          {badge.label}
                        </span>
                      </span>

                      <span className="block mt-2 text-xs text-ui-text font-medium">
                        {p.rowCount === 0 ? (
                          <span className="italic text-ui-muted">No rows yet</span>
                        ) : (
                          <span>
                            {formatPlanRowCounts({
                              draft: p.draftRowCount,
                              submitted: p.submittedRowCount,
                              changes_requested: p.changesRequestedRowCount,
                              approved: p.approvedRowCount,
                              total: p.rowCount,
                            })}
                          </span>
                        )}
                      </span>

                      {hasOverlap && (
                        <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit status-tint status-waiting">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>Overlapping period</span>
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Plan Detail & Editable Rows Grid */}
        {selectedPlan && (
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-panel rounded-ui-panel p-5 sm:p-6">
              {/* Plan Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-ui-line">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">{selectedPlan.title}</h2>
                    <span className="text-xs font-mono font-bold text-ui-ink bg-white/70 px-2 py-0.5 rounded">
                      {selectedPlan.code}
                    </span>
                    <span
                      className={`status-chip ${statusClass(STATUS_BADGES[selectedPlan.status]?.tone || 'not-started')} text-[11px] font-bold px-2.5 py-0.5`}
                    >
                      {STATUS_BADGES[selectedPlan.status]?.label}
                    </span>
                    {(() => {
                      const planCal = getCalendarDefinition(selectedPlan.calendar);
                      const canMove =
                        (isSMManager || isAdmin) ||
                        (selectedPlan.status === 'Draft' || selectedPlan.status === 'Changes requested');
                      return (
                        <div className="flex items-center gap-1">
                          {canMove ? (
                            <select
                              value={selectedPlan.calendar || 'sm'}
                              disabled={isMovingCalendar}
                              onChange={(e) => handleMoveCalendar(e.target.value as CalendarKey)}
                              className="ui-select cursor-pointer"
                              style={{
                                backgroundColor: planCal.bg,
                                borderColor: planCal.border,
                                color: planCal.text,
                              }}
                              title="Calendar (click to move)"
                            >
                              {CALENDAR_LIST.map((cal) => (
                                <option key={cal.id} value={cal.id}>
                                  {cal.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: planCal.bg,
                                borderColor: planCal.border,
                                color: planCal.text,
                              }}
                            >
                              {planCal.name}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {isSMManager && selectedPlan.status !== 'Approved' && (
                      <button
                        onClick={() => {
                          setRenameTitle(selectedPlan.title);
                          setIsRenameOpen(true);
                        }}
                        title="Rename Plan"
                        className="p-1 rounded text-ui-muted hover:text-ui-ink hover:bg-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isSMManager &&
                      selectedPlan.hasStartedWork === false && (
                        <button
                          onClick={() => handleDeletePlan(selectedPlan._id)}
                          title="Delete Plan"
                          aria-label="Delete Plan"
                          className="ui-icon-btn hover:text-ui-ink"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                  <p className="text-xs text-ui-muted mt-1">
                    Period: {new Date(selectedPlan.periodStart).toLocaleDateString(undefined, { timeZone: 'UTC' })} –{' '}
                    {new Date(selectedPlan.periodEnd).toLocaleDateString(undefined, { timeZone: 'UTC' })} • Created by{' '}
                    {selectedPlan.createdById?.name || 'SM Manager'}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedPlan(null)}
                  aria-label="Close plan"
                  className="ui-icon-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Overlapping Plan Period Warning Banner */}
              {selectedPlan.submissionWarnings
                ?.filter((w) => w.code === 'OVERLAPPING_PERIOD')
                .map((w, idx) => (
                  <div
                    key={idx}
                    className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Warning:</strong> {w.message}
                      </span>
                    </div>
                    {w.overlappingPlanId && (
                      <button
                        onClick={() => fetchPlanDetails(w.overlappingPlanId!)}
                        className="text-xs font-bold text-amber-800 underline hover:text-amber-950 whitespace-nowrap shrink-0"
                      >
                        View Plan ({w.overlappingPlanCode})
                      </button>
                    )}
                  </div>
                ))}

              {/* Success Alert */}
              {reviewSuccessMsg && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  {reviewSuccessMsg}
                </div>
              )}

              {/* Feedback Banner for Changes Requested */}
              {(selectedPlan.status === 'Changes requested' ||
                (selectedPlan.rows || []).some((r) => r.rowStatus === 'changes_requested')) && (
                <div className="mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-900 flex items-center gap-2">
                        <span>Changes Requested by Creative Head</span>
                        <span className="text-[10px] font-semibold bg-rose-200/70 text-rose-800 px-1.5 py-0.2 rounded-full">
                          {(selectedPlan.rows || []).filter((r) => r.rowStatus === 'changes_requested').length} row(s) need rework
                        </span>
                      </div>
                      <p className="text-rose-700 mt-1">
                        {selectedPlan.comment ? (
                          <span className="font-medium block mb-0.5">
                            Reviewer note: "{selectedPlan.comment}"
                          </span>
                        ) : null}
                        Review the feedback on highlighted rows below, click <strong>Rework</strong> to update deliverables, then click <strong>Resubmit for Approval</strong>.
                      </p>
                    </div>
                  </div>
                  {isSMManager && (
                    <button
                      onClick={() => handleSubmitPlan(selectedPlan._id)}
                      disabled={isSubmittingPlan || (selectedPlan.rows || []).length === 0}
                      className="ui-btn ui-btn-primary h-11"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Resubmit for Approval
                    </button>
                  )}
                </div>
              )}

              {/* Monthly plans: rows are added, edited, submitted and reviewed in the plan grid only. */}
              {isMonthlyPlan && canOpenGrid && (
                <p className="mt-4 pt-3 border-t border-ui-line text-sm text-ui-muted">
                  {isExecutive
                    ? `Use “${gridLabel}” above to see this plan's rows and progress.`
                    : `Use “${gridLabel}” above to ${isCreativeHead ? 'review this plan row by row' : 'add, edit and submit rows for this plan'}.`}
                </p>
              )}

              {/* Action Toolbar for individual plans: SM Manager (Submit/Resubmit) & Creative Head (Review) */}
              {!isExecutive && !isMonthlyPlan && (
                <div className="mt-4 pt-3 border-t border-ui-line flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {isSMManager && !isMonthlyPlan && selectedPlan.status !== 'Approved' && (
                      <button
                        onClick={handleOpenAddRowModal}
                        className="ui-btn ui-btn-secondary h-11"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Row
                      </button>
                    )}

                    {isSMManager && !isMonthlyPlan &&
                      (selectedPlan.status === 'Draft' ||
                        selectedPlan.status === 'Changes requested' ||
                        selectedPlan.status === 'Approved with pending rows' ||
                        (selectedPlan.rows || []).some(
                          (r) => r.rowStatus === 'draft' || r.rowStatus === 'changes_requested'
                        )) && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSubmitPlan(selectedPlan._id)}
                            disabled={isSubmittingPlan || (selectedPlan.rows || []).length === 0}
                            title={(selectedPlan.rows || []).length === 0 ? 'Add at least one row' : undefined}
                            className={`px-3.5 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${
                              (selectedPlan.rows || []).length === 0
                                ? 'opacity-50 cursor-not-allowed bg-slate-400'
                                : selectedPlan.status === 'Changes requested' ||
                                  (selectedPlan.rows || []).some((r) => r.rowStatus === 'changes_requested')
                                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                                : 'bg-ui-ink hover:bg-ui-ink/85'
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" />
                            {selectedPlan.status === 'Changes requested' ||
                            (selectedPlan.rows || []).some((r) => r.rowStatus === 'changes_requested')
                              ? 'Resubmit for Approval'
                              : 'Submit for Review'}
                          </button>
                          {(selectedPlan.rows || []).length === 0 && (
                            <span className="text-[11px] text-ui-muted italic">
                              Add at least one row
                            </span>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Creative Head Review Controls */}
                  {isCreativeHead && !isMonthlyPlan && (selectedPlan.status === 'Submitted' || (selectedPlan.rows || []).some(r => r.rowStatus === 'submitted')) && (
                    <div className="flex items-center gap-2 flex-wrap bg-amber-50/70 p-2 rounded-xl border border-amber-200/70">
                      <span className="text-[11px] font-bold text-amber-900 mr-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        Review Mode:
                      </span>

                      <button
                        onClick={() => handleReviewPlan('approve_all')}
                        disabled={isReviewSubmitting}
                        className="ui-btn ui-btn-primary h-11"
                      >
                        Approve All
                      </button>

                      <button
                        onClick={() => handleReviewPlan('approve_selected')}
                        disabled={isReviewSubmitting || selectedRowIds.length === 0}
                        className="ui-btn ui-btn-secondary h-11"
                      >
                        Approve Selected ({selectedRowIds.length})
                      </button>

                      <button
                        onClick={() => handleReviewPlan('request_changes')}
                        disabled={isReviewSubmitting}
                        className="ui-btn status-tint status-changes h-11"
                      >
                        Request Changes
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Rows Grid */}
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="ui-table w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      {isCreativeHead && !isMonthlyPlan && (
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              (selectedPlan.rows || []).length > 0 &&
                              selectedRowIds.length === (selectedPlan.rows || []).filter(r => r.rowStatus === 'submitted').length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRowIds(
                                  (selectedPlan.rows || [])
                                    .filter((r) => r.rowStatus === 'submitted')
                                    .map((r) => r._id)
                                );
                              } else {
                                setSelectedRowIds([]);
                              }
                            }}
                            className="rounded border-slate-300 text-ui-ink focus:ring-ui-ink"
                          />
                        </th>
                      )}
                      <th className="p-3">#</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Topic</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Steps</th>
                      <th className="p-3">Flags</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Review Feedback</th>
                      {!isExecutive && !isMonthlyPlan && <th className="p-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ui-line">
                    {(selectedPlan.rows || []).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-ui-muted">
                          {isMonthlyPlan ? `No rows in this plan yet. Use “${gridLabel}” above.` : 'No rows in this plan yet. Use "Add Row".'}
                        </td>
                      </tr>
                    ) : (
                      (selectedPlan.rows || []).map((row, idx) => {
                        const statusBadge = ROW_STATUS_BADGES[row.rowStatus] || ROW_STATUS_BADGES.draft;
                        const isRowChecked = selectedRowIds.includes(row._id);

                        return (
                          <tr
                            key={row._id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isRowChecked
                                ? 'bg-white/70'
                                : row.rowStatus === 'changes_requested'
                                ? 'bg-rose-50/40'
                                : ''
                            }`}
                          >
                            {isCreativeHead && !isMonthlyPlan && (
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={isRowChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRowIds([...selectedRowIds, row._id]);
                                    } else {
                                      setSelectedRowIds(selectedRowIds.filter((id) => id !== row._id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-ui-ink focus:ring-ui-ink"
                                />
                              </td>
                            )}
                            <td className="p-3 font-mono text-ui-muted">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                              {new Date(row.postingDate).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-medium text-slate-900 max-w-[180px] truncate" title={row.topic}>
                              {row.topic}
                            </td>
                            <td className="p-3 font-semibold text-ui-ink whitespace-nowrap">
                              {row.contentType}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 flex-wrap max-w-[280px]">
                                {(row.stagePlan && row.stagePlan.length > 0
                                  ? row.stagePlan
                                  : getDefaultStagePlanPreview(row)
                                ).map((sp: any) => {
                                  const ownerObj =
                                    typeof sp.ownerId === 'object' && sp.ownerId
                                      ? sp.ownerId
                                      : activeMembers.find((m) => m._id === sp.ownerId);
                                  const ownerName = ownerObj?.name || sp.ownerName || 'Unassigned';
                                  const dueStr = sp.dueDate
                                    ? new Date(
                                        sp.dueDate.includes('T') ? sp.dueDate : sp.dueDate + 'T00:00:00'
                                      ).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                      })
                                    : '—';
                                  const isTight =
                                    (sp.stageKey === 'Edit' || sp.stageKey === 'Design') &&
                                    row.postingDate &&
                                    sp.dueDate &&
                                    Math.round(
                                      (new Date(
                                        row.postingDate.includes('T') ? row.postingDate : row.postingDate + 'T00:00:00'
                                      ).getTime() -
                                        new Date(
                                          sp.dueDate.includes('T') ? sp.dueDate : sp.dueDate + 'T00:00:00'
                                        ).getTime()) /
                                        86400000
                                    ) < 1;

                                  return (
                                    <button
                                      key={sp.stageKey}
                                      type="button"
                                      disabled={isMonthlyPlan || isExecutive}
                                      onClick={() => handleOpenEditModal(row)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-all hover:scale-105 shadow-2xs ${
                                        isTight
                                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-ui-ink/30'
                                      }`}
                                      title={`${sp.stageKey}: ${ownerName} - Due: ${dueStr}${
                                        isTight ? ' (Tight buffer: <24h before publish)' : ''
                                      }`}
                                    >
                                      <span className="font-bold text-[10px] text-ui-ink">
                                        {sp.stageKey}
                                      </span>
                                      <Avatar name={ownerName} url={ownerObj?.avatarUrl} size="xs" />
                                      <span className="text-[10px] text-ui-muted font-mono">{dueStr}</span>
                                      {isTight && (
                                        <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3 text-[11px] text-ui-muted whitespace-nowrap">
                              {row.contentType.toLowerCase().includes('reel') ? (
                                <div className="flex items-center gap-1">
                                  {row.needsScript && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Script</span>}
                                  {row.needsShoot && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Shoot</span>}
                                </div>
                              ) : (
                                <span className="text-ui-muted">—</span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span className={`status-chip ${statusClass(statusBadge.tone)} text-[11px] font-semibold px-2 py-0.5`}>
                                {statusBadge.label}
                              </span>
                            </td>
                            <td className="p-3 max-w-[200px]">
                              {isCreativeHead && !isMonthlyPlan && row.rowStatus === 'submitted' ? (
                                <input
                                  type="text"
                                  placeholder="Comment for revision..."
                                  value={rowComments[row._id] || ''}
                                  onChange={(e) =>
                                    setRowComments({
                                      ...rowComments,
                                      [row._id]: e.target.value,
                                    })
                                  }
                                  className="ui-input w-full"
                                />
                              ) : row.reviewComment ? (
                                <div className="text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-100 flex items-start gap-1">
                                  <MessageSquare className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-2">{row.reviewComment}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            {!isExecutive && !isMonthlyPlan && (
                              <td className="p-3 text-right whitespace-nowrap">
                                {(row.rowStatus === 'draft' || row.rowStatus === 'changes_requested') && (
                                  <div className="flex items-center justify-end gap-1.5">
                                    {row.rowStatus === 'changes_requested' ? (
                                      <>
                                        <button
                                          onClick={() => handleOpenEditModal(row)}
                                          className="ui-btn status-tint status-changes h-11 px-3"
                                          title="Rework deliverable based on Creative Head feedback"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                          Rework
                                        </button>
                                        <button
                                          onClick={() => handleQuickResubmitRow(row._id)}
                                          className="ui-btn ui-btn-secondary h-11 px-3"
                                          title="Resubmit this deliverable row for approval"
                                        >
                                          <Send className="w-3 h-3" />
                                          Resubmit
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenEditModal(row)}
                                        className="ui-icon-btn"
                                        title="Edit row"
                                        aria-label="Edit row"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteRow(row._id)}
                                      className="ui-icon-btn"
                                      title="Delete row"
                                      aria-label="Delete row"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
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
          </div>
        )}
      </div>

      {/* Upload & Validation Preview Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-modal max-w-3xl w-full p-6 max-h-[90vh] flex flex-col animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-ui-line">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-ui-ink" />
                <h3 className="text-lg font-bold text-slate-900">Upload Plan & Validation Preview</h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Target Plan Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Target Plan</label>
                <select
                  value={uploadPlanId}
                  onChange={(e) => setUploadPlanId(e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="">Select a plan...</option>
                  {plans.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.code} — {p.title} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* File Dropzone */}
              <div className="border-2 border-dashed border-ui-line bg-white/70 rounded-2xl p-6 text-center">
                <input
                  type="file"
                  id="excel-file-input"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePreviewUpload(file);
                  }}
                />
                <label
                  htmlFor="excel-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-10 h-10 text-ui-ink" />
                  <span className="text-xs font-bold text-ui-ink">
                    {selectedFile ? selectedFile.name : 'Click to select Excel (.xlsx) or CSV file'}
                  </span>
                  <span className="text-[11px] text-ui-muted">
                    Columns: Posting Date, Topic, Type, Needs Script, Needs Shoot, Content Link, Remarks
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {importError}
                </div>
              )}

              {/* Loading Indicator */}
              {isPreviewLoading && (
                <div className="text-center py-6 text-xs text-ui-ink font-semibold">
                  Validating rows against due date, types, and duplicate constraints...
                </div>
              )}

              {/* Validation Summary & Preview Table */}
              {previewData && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[11px] font-bold text-ui-muted">Total Rows</span>
                      <p className="text-lg font-extrabold text-slate-800">{previewData.totalRows}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                      <span className="text-[11px] font-bold text-emerald-700">Valid Rows</span>
                      <p className="text-lg font-extrabold text-emerald-700">{previewData.validRowsCount}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
                      <span className="text-[11px] font-bold text-rose-700">Invalid Rows</span>
                      <p className="text-lg font-extrabold text-rose-700">{previewData.errorRowsCount}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-60">
                    <table className="ui-table w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Topic</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Steps</th>
                          <th className="p-2.5">Validation Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ui-line">
                        {((previewData.previewRows || (previewData as any).rows || []) as any[]).map((r, rIdx) => (
                          <tr key={r.rowIndex || r.rowNumber || rIdx} className={r.isValid ? 'bg-white' : 'bg-rose-50/50'}>
                            <td className="p-2.5 font-mono text-ui-muted">{r.rowIndex || r.rowNumber || rIdx + 1}</td>
                            <td className="p-2.5 whitespace-nowrap">{r.postingDate ? r.postingDate.substring(0, 10) : '—'}</td>
                            <td className="p-2.5 font-medium text-slate-800 max-w-[150px] truncate">{r.topic}</td>
                            <td className="p-2.5 text-ui-ink font-semibold">{r.contentType}</td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-1 flex-wrap max-w-[260px]">
                                {(r.stagePlan || []).map((sp: any) => (
                                  <span
                                    key={sp.stageKey}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 border border-slate-200 text-slate-700"
                                  >
                                    <span className="font-bold text-ui-ink">{sp.stageKey}</span>
                                    <span>{sp.ownerName || 'Unassigned'}</span>
                                    {sp.isSuggestedOwner && (
                                      <span className="text-[8px] bg-white/70 text-ui-ink px-1 rounded font-bold">
                                        suggested
                                      </span>
                                    )}
                                    <span className="font-mono text-ui-muted">
                                      {sp.dueDate ? new Date(sp.dueDate.includes('T') ? sp.dueDate : sp.dueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                                    </span>
                                    {sp.isSuggestedDueDate && (
                                      <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-bold">
                                        suggested
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-2.5">
                              {r.isValid ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  Valid
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  {(r.errors || []).map((err: string, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 mr-1"
                                    >
                                      {err}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-ui-line flex items-center justify-end gap-3">
              <button
                onClick={() => setIsUploadOpen(false)}
                className="ui-btn ui-btn-secondary h-11"
              >
                Cancel
              </button>

              {previewData && previewData.validRowsCount > 0 && (
                <button
                  onClick={handleCommitUpload}
                  disabled={isCommitting || !uploadPlanId}
                  className="ui-btn ui-btn-primary h-11"
                >
                  <FileCheck className="w-4 h-4" />
                  {isCommitting ? 'Committing...' : `Commit ${previewData.validRowsCount} Valid Rows as Draft`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Modal - 3-Step Wizard */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-modal max-w-lg w-full p-6 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <div className="flex items-center gap-2">
                {createStep > 1 && (
                  <button
                    onClick={() => setCreateStep((s) => (s === 3 && newKind === 'individual' ? 1 : s - 1) as any)}
                    aria-label="Previous step" className="ui-icon-btn"
                    title="Previous Step"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <h3 className="text-base font-bold text-slate-900">
                  {createStep === 1 && 'Step 1: Which calendar is this for?'}
                  {createStep === 2 && 'Step 2: Choose Plan Type'}
                  {createStep === 3 && `Step 3: ${getCalendarDefinition(selectedCalendarForPlan).name} Plan Details`}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                {createError}
              </div>
            )}

            {/* STEP 1: CHOOSE CALENDAR */}
            {createStep === 1 && (
              <div className="py-4 space-y-3">
                <p className="text-xs text-ui-muted font-medium">
                  Select the creative calendar this plan will be associated with:
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {CALENDAR_LIST.map((cal) => {
                    const isSelected = selectedCalendarForPlan === cal.id;
                    return (
                      <button
                        key={cal.id}
                        type="button"
                        onClick={() => {
                          setSelectedCalendarForPlan(cal.id);
                          if (newKind === 'monthly' && newStart) {
                            const d = new Date(newStart);
                            const mName = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
                            setNewTitle(`${cal.name} ${mName} ${d.getUTCFullYear()}`);
                          } else if (newKind === 'individual') {
                            setNewTitle(`${cal.name} Individual Work`);
                          }
                          setCreateStep(newKind === 'individual' ? 3 : 2);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between group hover:scale-[1.01] ${
                          isSelected ? 'ring-2 ring-ui-ink' : 'hover:border-slate-300'
                        }`}
                        style={{
                          backgroundColor: cal.bg,
                          borderColor: cal.border,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cal.color }}
                          />
                          <div>
                            <span className="text-xs font-extrabold block" style={{ color: cal.text }}>
                              {cal.name}
                            </span>
                            <span className="text-[11px] text-ui-muted">
                              Creative calendar for {cal.name}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-ui-muted group-hover:text-slate-700" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: CHOOSE PLAN KIND */}
            {createStep === 2 && (
              <div className="py-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-ui-muted">Selected calendar:</span>
                  {(() => {
                    const cal = getCalendarDefinition(selectedCalendarForPlan);
                    return (
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ backgroundColor: cal.bg, borderColor: cal.border, color: cal.text }}
                      >
                        {cal.name}
                      </span>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setNewKind('individual');
                      const todayStr = new Date().toISOString().slice(0, 10);
                      setNewTitle(`${getCalendarDefinition(selectedCalendarForPlan).name} Individual Work`);
                      setNewStart(todayStr);
                      setNewEnd(todayStr);
                      setCreateStep(3);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all group hover:scale-[1.01] ${
                      newKind === 'individual' ? 'border-ui-line bg-white/70' : 'border-slate-200 hover:border-ui-ink/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Individual Work</span>
                      <ChevronRight className="w-4 h-4 text-ui-muted group-hover:text-ui-ink" />
                    </div>
                    <p className="text-[11px] text-ui-muted">
                      A single-deliverable plan for ad-hoc, quick-turnaround, or spontaneous tasks.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: DETAILS */}
            {createStep === 3 && (
              <form onSubmit={handleCreatePlan} className="py-4 space-y-3">
                {duplicateMonthPlan && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Duplicate / Overlapping Plan Detected</p>
                      <p className="text-[11px] mt-0.5">
                        A monthly plan "{duplicateMonthPlan.title}" already exists for this calendar in {newStart.slice(0, 7)}. Exact duplicate periods are blocked.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Plan Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="ui-input w-full"
                  />
                </div>

                {newKind === 'monthly' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Period Start</label>
                      <input
                        type="date"
                        required
                        value={newStart}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewStart(val);
                          if (val) {
                            try {
                              const d = new Date(val);
                              if (!isNaN(d.getTime())) {
                                const mName = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
                                const calName = getCalendarDefinition(selectedCalendarForPlan).name;
                                setNewTitle(`${calName} ${mName} ${d.getUTCFullYear()}`);
                                // Keep the end in the same month; a stale end produced "1/1/2027 - 12/31/2026".
                                const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
                                setNewEnd(monthEnd.toISOString().slice(0, 10));
                              }
                            } catch {}
                          }
                        }}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ui-ink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Period End</label>
                      <input
                        type="date"
                        required
                        value={newEnd}
                        onChange={(e) => setNewEnd(e.target.value)}
                        className="ui-input w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Target Date</label>
                        <input
                          type="date"
                          required
                          value={newStart}
                          onChange={(e) => {
                            setNewStart(e.target.value);
                            setNewEnd(e.target.value);
                          }}
                          className="ui-input w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Deliverable Type</label>
                        <select
                          value={indivType}
                          onChange={(e) => setIndivType(e.target.value)}
                          className="ui-select w-full"
                        >
                          <option value="Static Post">Static Post</option>
                          <option value="Reel">Reel</option>
                          <option value="Carousel Post">Carousel Post</option>
                          <option value="Story">Story</option>
                          <option value="Poster">Poster</option>
                          <option value="Brochure">Brochure</option>
                          <option value="Flyer">Flyer</option>
                          <option value="Banner">Banner</option>
                          <option value="Standee">Standee</option>
                          <option value="Certificate">Certificate</option>
                          <option value="ID Card">ID Card</option>
                          <option value="Presentation">Presentation</option>
                          <option value="Newsletter">Newsletter</option>
                          <option value="Merchandise">Merchandise</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Topic / Deliverable Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Product Announcement Banner"
                        value={indivTopic}
                        onChange={(e) => setIndivTopic(e.target.value)}
                        className="ui-input w-full"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Creative Brief</label>
                      <textarea
                        rows={2}
                        placeholder="Key requirements, hooks or instructions..."
                        value={indivBrief}
                        onChange={(e) => setIndivBrief(e.target.value)}
                        className="ui-input ui-textarea w-full"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Optional Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Content goals, theme or remarks..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="ui-input ui-textarea w-full"
                  />
                </div>

                <div className="pt-3 border-t border-ui-line flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateStep(newKind === 'individual' ? 1 : 2)}
                    className="ui-btn ui-btn-secondary h-11"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="ui-btn ui-btn-secondary h-11"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingPlan || (newKind === 'monthly' && !!duplicateMonthPlan && duplicateMonthPlan.periodStart.slice(0, 7) === newStart.slice(0, 7))}
                      className="ui-btn ui-btn-primary h-11"
                    >
                      {isSubmittingPlan ? 'Creating...' : 'Create Plan'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Row Modal */}
      {isAddRowOpen && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="glass-modal max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <h3 className="text-base font-bold text-slate-900">
                {editingRowId
                  ? editingRowComment
                    ? 'Rework Deliverable Row'
                    : 'Edit Plan Row'
                  : 'Add Row to Plan'}
              </h3>
              <button
                onClick={() => {
                  setIsAddRowOpen(false);
                  setEditingRowId(null);
                  setEditingRowComment(null);
                  setRowSteps([]);
                }}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingRowComment && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs">
                <div className="font-bold text-rose-800 flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                  Creative Head Feedback / Changes Requested:
                </div>
                <p className="text-rose-700 italic">"{editingRowComment}"</p>
              </div>
            )}

            <form onSubmit={handleSaveRow} className="py-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Topic / Working Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5 Tech Tips for Startups"
                  value={rowTopic}
                  onChange={(e) => setRowTopic(e.target.value)}
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Brief</label>
                <textarea
                  rows={2}
                  placeholder="Target audience, key message, and angle"
                  value={rowBrief}
                  onChange={(e) => setRowBrief(e.target.value)}
                  className="ui-input ui-textarea w-full"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {mainDateLabel} (Final F)
                  </label>
                  <input
                    type="date"
                    required
                    value={rowPostingDate}
                    onChange={(e) => handlePostingDateChange(e.target.value)}
                    className="ui-input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Optional Time
                  </label>
                  <input
                    type="time"
                    value={rowPostingTime}
                    onChange={(e) => setRowPostingTime(e.target.value)}
                    className="ui-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Content Type</label>
                <select
                  value={rowType}
                  onChange={(e) => {
                    const val = e.target.value;
                    let s = rowNeedsScript;
                    let sh = rowNeedsShoot;
                    if (val === 'Reel A') {
                      s = true;
                      sh = true;
                    } else if (val === 'Reel B') {
                      s = false;
                      sh = true;
                    } else if (val === 'Reel C') {
                      s = false;
                      sh = false;
                    }
                    handleTypeOrTogglesChange(val, s, sh);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ui-ink focus:outline-none"
                >
                  <option value="Reel A">Reel (Variant A: Script + Shoot)</option>
                  <option value="Reel B">Reel (Variant B: Shoot only)</option>
                  <option value="Reel C">Reel (Variant C: Edit only)</option>
                  <option value="Static Post">Static Post (Postable)</option>
                  <option value="Carousel Post">Carousel Post (Postable)</option>
                  <option value="Story">Story (Postable)</option>
                  <option value="Poster">Poster (Non-Postable Print)</option>
                  <option value="Brochure">Brochure (Non-Postable)</option>
                  <option value="Flyer">Flyer (Non-Postable)</option>
                  <option value="Banner">Banner (Non-Postable)</option>
                  <option value="Standee">Standee (Non-Postable)</option>
                  <option value="Certificate">Certificate (Non-Postable)</option>
                  <option value="ID Card">ID Card (Non-Postable)</option>
                  <option value="Presentation">Presentation (Non-Postable)</option>
                  <option value="Newsletter">Newsletter (Non-Postable)</option>
                  <option value="Merchandise">Merchandise (Non-Postable)</option>
                  <option value="Other">Other (Non-Postable)</option>
                </select>
              </div>

              {isReel && (
                <div className="p-3 bg-white/70 rounded-xl border border-ui-line space-y-2.5">
                  <span className="text-[11px] font-bold text-ui-ink block">Reel Pipeline Options</span>
                  <div className="flex items-center gap-5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rowNeedsScript}
                        onChange={(e) =>
                          handleTypeOrTogglesChange(rowType, e.target.checked, rowNeedsShoot)
                        }
                        className="rounded border-slate-300 text-ui-ink focus:ring-ui-ink"
                      />
                      Needs Script
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rowNeedsShoot}
                        onChange={(e) =>
                          handleTypeOrTogglesChange(rowType, rowNeedsScript, e.target.checked)
                        }
                        className="rounded border-slate-300 text-ui-ink focus:ring-ui-ink"
                      />
                      Needs Shoot
                    </label>
                  </div>

                  {!rowNeedsShoot && (
                    <div className="pt-2 border-t border-ui-line">
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Source Video Link <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://drive.google.com/source-footage..."
                        value={rowSourceVideoLink}
                        onChange={(e) => setRowSourceVideoLink(e.target.value)}
                        className="ui-input w-full"
                      />
                      {stepValidation.errors['sourceVideoLink'] && (
                        <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          {stepValidation.errors['sourceVideoLink']}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEPS & DEADLINES SECTION */}
              <div className="pt-3 border-t border-ui-line">
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-ui-ink" />
                      Steps & Deadlines
                    </h4>
                    <p className="text-[11px] text-ui-muted">
                      Each creative step has its own owner and deadline calculated from {mainDateLabel.toLowerCase()}.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {rowSteps.map((step) => {
                    const stepError = stepValidation.errors[step.stageKey];
                    const stepWarning = stepValidation.warnings[step.stageKey];
                    const qualifyingMembers = activeMembers.filter(
                      (m) => m.workPreferences?.includes(step.stageKey)
                    );
                    const isPostStep = step.stageKey === 'Post';

                    return (
                      <div
                        key={step.stageKey}
                        className={`p-2.5 rounded-xl border transition-all ${
                          stepError
                            ? 'bg-rose-50/50 border-rose-300'
                            : stepWarning
                            ? 'bg-amber-50/40 border-amber-200'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          {/* Step Label */}
                          <div className="sm:col-span-3 flex items-center gap-1.5">
                            <span className="font-bold text-xs text-ui-ink bg-white/70 px-2 py-0.5 rounded-md">
                              {step.stageKey}
                            </span>
                            {step.dueDateSource === 'manual' && (
                              <span
                                className="text-[10px] text-amber-700 font-semibold px-1 py-0.5 rounded bg-amber-100/60"
                                title="Date set manually"
                              >
                                Set by you
                              </span>
                            )}
                          </div>

                          {/* Owner Dropdown */}
                          <div className="sm:col-span-5">
                            <select
                              value={step.ownerId || ''}
                              onChange={(e) => handleStepOwnerChange(step.stageKey, e.target.value)}
                              className="ui-select w-full"
                            >
                              <option value="">
                                {qualifyingMembers.length === 0
                                  ? 'No available person with this role'
                                  : 'Select owner (or leave unassigned)'}
                              </option>
                              {qualifyingMembers.map((m) => (
                                <option key={m._id} value={m._id}>
                                  {m.name} ({m.email})
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {step.ownerSource === 'manual' ? (
                                <span className="text-[9px] text-amber-700 bg-amber-50 font-semibold px-1 rounded">
                                  Set by you
                                </span>
                              ) : step.ownerReason ? (
                                <span
                                  className="text-[9px] text-ui-ink bg-white/70 px-1 rounded truncate max-w-[200px]"
                                  title={step.ownerReason}
                                >
                                  {step.ownerReason}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Deadline Date */}
                          <div className="sm:col-span-4">
                            {isPostStep ? (
                              <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                                <span className="font-mono">{rowPostingDate || '—'}</span>
                                <span className="text-[10px] text-ui-muted font-medium">On publish date</span>
                              </div>
                            ) : (
                              <div>
                                <input
                                  type="date"
                                  required
                                  value={step.dueDate}
                                  onChange={(e) => handleStepDueDateChange(step.stageKey, e.target.value)}
                                  className="ui-input w-full"
                                />
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-[10px] text-ui-muted">
                                    {step.offsetDays > 0
                                      ? `${step.offsetDays} days before ${isPostable ? 'publish' : 'needed-by'}`
                                      : 'On publish date'}
                                  </span>
                                  {step.dueDateSource === 'manual' && (
                                    <span className="text-[9px] text-amber-700 bg-amber-50 font-semibold px-1 rounded">
                                      Set by you
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Validation Feedback */}
                        {stepError && (
                          <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {stepError}
                          </p>
                        )}
                        {!stepError && stepWarning && (
                          <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {stepWarning}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Content Link / Drive URL</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={rowContentLink}
                  onChange={(e) => setRowContentLink(e.target.value)}
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="Additional context or references"
                  value={rowRemarks}
                  onChange={(e) => setRowRemarks(e.target.value)}
                  className="ui-input w-full"
                />
              </div>

              <div className="pt-3 border-t border-ui-line flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddRowOpen(false);
                    setEditingRowId(null);
                    setEditingRowComment(null);
                    setRowSteps([]);
                  }}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={
                      Object.keys(stepValidation.errors).length > 0 ||
                      !rowTopic.trim() ||
                      !rowPostingDate
                    }
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingRowId ? (editingRowComment ? 'Save Rework' : 'Save Changes') : 'Add Row'}
                  </button>
                  {editingRowId && editingRowComment && (
                    <button
                      type="button"
                      disabled={Object.keys(stepValidation.errors).length > 0}
                      onClick={handleSaveAndResubmitRow}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Save & Resubmit
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Plan Modal */}
      {isRenameOpen && (
        <div className="fixed inset-0 z-50 ui-scrim backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-modal max-w-sm w-full p-6 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-ui-line">
              <h3 className="text-base font-bold text-slate-900">Rename Plan</h3>
              <button
                onClick={() => setIsRenameOpen(false)}
                aria-label="Close" className="ui-icon-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenamePlan} className="py-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. November 2026"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="ui-input w-full"
                  autoFocus
                />
              </div>

              <div className="pt-3 border-t border-ui-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRenameOpen(false)}
                  className="ui-btn ui-btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming || !renameTitle.trim()}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {isRenaming ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
