/**
 * Steps & Deadlines rules for one plan row. Used by BOTH the Add Row form (PlansTab) and the
 * plan grid's row panel, so there is one rule set. The server applies the same offsets
 * (STAGE_DUE_OFFSETS / calculateStageDueDate) and validation (validatePlanAndRows) on save.
 */
import { DESIGN_WORKFLOW_TYPES, isPostableWorkType, normalizeWorkType, sourceVideoLinkError } from '@mmp/shared';

export type StepKey = 'Content' | 'Script' | 'Design' | 'Shoot' | 'Edit' | 'Post';

export interface StepLineState {
  stageKey: StepKey;
  ownerId: string | null;
  ownerName?: string;
  ownerSource: 'suggested' | 'manual';
  ownerReason?: string;
  dueDate: string; // YYYY-MM-DD
  dueDateSource: 'auto' | 'manual';
  offsetDays: number;
}

export interface StepMember {
  _id: string;
  name: string;
  workPreferences?: string[];
}

export interface AutofillStage {
  stageKey: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string;
  reason: string;
}

/**
 * Deadline = posting date minus `offsetDays`, as a calendar date.
 * Done in UTC: the old version subtracted in local time and read the result back in UTC,
 * which in IST gave a date one day early.
 */
export function calculateDueDateString(baseDateStr: string, offsetDays: number): string {
  if (!baseDateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(baseDateStr);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

/** The steps a row has and their offsets from the posting date (same as STAGE_DUE_OFFSETS). */
export function getExpectedStepDefs(type: string, needsScript: boolean, needsShoot: boolean, needsContent = true): { stageKey: StepKey; offset: number }[] {
  const norm = normalizeWorkType(type || 'Reel A');
  const postable = isPostableWorkType(norm);
  if (norm.toLowerCase() === 'reel') {
    const list: { stageKey: StepKey; offset: number }[] = [];
    if (needsScript) list.push({ stageKey: 'Script', offset: 8 });
    if (needsShoot) list.push({ stageKey: 'Shoot', offset: 5 });
    list.push({ stageKey: 'Edit', offset: 2 });
    list.push({ stageKey: 'Post', offset: 0 });
    return list;
  }
  // Design only (Static Post / Carousel Post): no Content step; Design keeps its offset.
  const designOnly = !needsContent && (DESIGN_WORKFLOW_TYPES as readonly string[]).includes(norm);
  const list: { stageKey: StepKey; offset: number }[] = [
    ...(designOnly ? [] : [{ stageKey: 'Content' as StepKey, offset: 5 }]),
    { stageKey: 'Design', offset: 2 },
  ];
  if (postable) list.push({ stageKey: 'Post', offset: 0 });
  return list;
}

const autoDue = (postDate: string, stageKey: StepKey, offset: number) =>
  stageKey === 'Post' ? postDate : calculateDueDateString(postDate, offset);

/** Initial steps before the server's suggestions arrive (first person with the work preference). */
export function buildDefaultSteps(type: string, needsScript: boolean, needsShoot: boolean, postDate: string, members: StepMember[], needsContent = true): StepLineState[] {
  return getExpectedStepDefs(type, needsScript, needsShoot, needsContent).map((d) => {
    const best = members.find((m) => m.workPreferences?.includes(d.stageKey));
    return {
      stageKey: d.stageKey,
      ownerId: best?._id || null,
      ownerName: best?.name || '',
      ownerSource: 'suggested',
      ownerReason: best ? 'Matching work preference' : 'No available person with this role',
      dueDate: autoDue(postDate, d.stageKey, d.offset),
      dueDateSource: 'auto',
      offsetDays: d.offset,
    };
  });
}

/** Posting date changed: automatic deadlines follow it, manual ones stay, Publish = posting date. */
export function applyPostingDateChange(steps: StepLineState[], newDate: string): StepLineState[] {
  if (!newDate) return steps;
  return steps.map((s) => {
    if (s.stageKey === 'Post') return { ...s, dueDate: newDate };
    if (s.dueDateSource === 'manual') return s;
    return { ...s, dueDate: calculateDueDateString(newDate, s.offsetDays) };
  });
}

/** Type or reel steps changed: keep what the user set for steps that remain, add new steps with defaults. */
export function applyTypeChange(prev: StepLineState[], type: string, needsScript: boolean, needsShoot: boolean, postDate: string, members: StepMember[], needsContent = true): StepLineState[] {
  const prevMap = new Map(prev.map((s) => [s.stageKey, s]));
  return getExpectedStepDefs(type, needsScript, needsShoot, needsContent).map((d) => {
    const existing = prevMap.get(d.stageKey);
    if (existing) {
      return {
        ...existing,
        offsetDays: d.offset,
        dueDate: d.stageKey === 'Post' ? postDate : existing.dueDateSource === 'manual' ? existing.dueDate : calculateDueDateString(postDate, d.offset),
      };
    }
    return buildDefaultSteps(type, needsScript, needsShoot, postDate, members, needsContent).find((s) => s.stageKey === d.stageKey)!;
  });
}

/** Apply the server's suggestions (POST /api/calendar-plans/autofill) to steps the user has not set. */
export function applyAutofill(steps: StepLineState[], stages: AutofillStage[]): StepLineState[] {
  return steps.map((step) => {
    const a = stages.find((s) => s.stageKey === step.stageKey);
    if (!a) return step;
    const updated = { ...step };
    if (step.ownerSource !== 'manual') {
      updated.ownerId = a.ownerId;
      updated.ownerName = a.ownerName || '';
      updated.ownerReason = a.reason;
      updated.ownerSource = 'suggested';
    }
    if (step.dueDateSource !== 'manual' && a.dueDate) {
      updated.dueDate = a.dueDate.substring(0, 10);
      updated.dueDateSource = 'auto';
    }
    return updated;
  });
}

export function setStepDueDate(steps: StepLineState[], stageKey: string, newDate: string): StepLineState[] {
  return steps.map((s) => (s.stageKey === stageKey ? { ...s, dueDate: newDate, dueDateSource: 'manual' } : s));
}

export function setStepOwner(steps: StepLineState[], stageKey: string, ownerId: string, members: StepMember[]): StepLineState[] {
  return steps.map((s) => {
    if (s.stageKey !== stageKey) return s;
    const m = members.find((mem) => mem._id === ownerId);
    return { ...s, ownerId: ownerId || null, ownerName: m?.name || '', ownerSource: 'manual', ownerReason: '' };
  });
}

const asDate = (s: string) => new Date(s.includes('T') ? s : `${s}T00:00:00`);

/** The Add Row form's checks: deadlines present, not past, not after posting, in order, owner preference; tight-buffer warning. */
export function validateRowSteps({
  steps,
  postingDate,
  type,
  needsShoot,
  sourceVideoLink,
  members,
}: {
  steps: StepLineState[];
  postingDate: string;
  type: string;
  needsShoot: boolean;
  sourceVideoLink: string;
  members: StepMember[];
}): { errors: Record<string, string>; warnings: Record<string, string> } {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPostable = isPostableWorkType(type);
  const isReel = type.toLowerCase().includes('reel');
  const postDate = postingDate ? asDate(postingDate) : null;

  for (const s of steps) {
    if (!s.dueDate) {
      errors[s.stageKey] = 'Deadline is required';
      continue;
    }
    const d = asDate(s.dueDate);
    if (d < today) errors[s.stageKey] = 'Deadline cannot be in the past';
    else if (postDate && d > postDate) errors[s.stageKey] = `Deadline cannot be after ${isPostable ? 'publish' : 'needed-by'} date`;

    const next = (k: string) => steps.find((st) => st.stageKey === k);
    if (s.stageKey === 'Script' && next('Shoot')?.dueDate && d >= asDate(next('Shoot')!.dueDate)) errors[s.stageKey] = 'Script must be before Shoot deadline';
    else if (s.stageKey === 'Shoot' && next('Edit')?.dueDate && d >= asDate(next('Edit')!.dueDate)) errors[s.stageKey] = 'Shoot must be before Edit deadline';
    else if (s.stageKey === 'Content' && next('Design')?.dueDate && d >= asDate(next('Design')!.dueDate)) errors[s.stageKey] = 'Content must be before Design deadline';

    if (s.ownerId) {
      const member = members.find((m) => m._id === s.ownerId);
      if (member && !member.workPreferences?.includes(s.stageKey)) {
        errors[s.stageKey] = `${member.name} lacks "${s.stageKey}" in work preferences`;
      }
    }

    if (postDate && (s.stageKey === 'Edit' || (s.stageKey === 'Design' && !steps.some((st) => st.stageKey === 'Edit')))) {
      const postMinus1 = new Date(postDate);
      postMinus1.setDate(postMinus1.getDate() - 1);
      if (d > postMinus1) warnings[s.stageKey] = 'Tight buffer: less than 24h before final date';
    }
  }

  // Edit only: an app upload or a Google Drive / Docs link (the same rule as the API).
  const linkError = isReel && !needsShoot ? sourceVideoLinkError('edit_only', sourceVideoLink) : null;
  if (linkError) errors.sourceVideoLink = linkError;
  return { errors, warnings };
}
