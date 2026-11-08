import { normalizeRole } from '@mmp/shared';
import { WorkItem } from './model.js';
import {
  approvedOutputOf,
  canSeePrivateReview,
  canSeeStepOutput,
  getParticipation,
  isTeamMember,
  userIdOf,
} from './access.js';

/** What every participant may see of a step they do not own: pipeline status. */
const PIPELINE_FIELDS = [
  '_id', 'title', 'workType', 'stageKey', 'stageOrder', 'status', 'isLocked', 'isSkipped', 'deadline', 'dueDate',
  'priority', 'contentPieceId', 'calendar', 'departmentId', 'ownerId', 'reviewRequired', 'createdAt', 'updatedAt', 'pieceStages',
];
/** Added when that step's approved output is visible to them. */
const OUTPUT_FIELDS = ['deliverableUrl', 'publishedUrl', 'contentLink', 'assetsLink', 'description', 'brief', 'previousStage', 'approvedOutput'];
const STAGE_OUTPUT_FIELDS = ['deliverableUrl', 'publishedUrl', 'revisions'];
const pick = (source, keys) => Object.fromEntries(keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]));
// Steps can arrive as Mongoose documents, whose own keys are internals rather than fields.
const plainOf = (source) => (typeof source?.toJSON === 'function' ? source.toJSON() : source);
const omit = (source, keys) => Object.fromEntries(Object.entries(plainOf(source)).filter(([k]) => !keys.includes(k)));

function scrubStages(stages, participation) {
  return (stages || []).map((stage) => (canSeeStepOutput(stage, participation) ? stage : omit(stage, STAGE_OUTPUT_FIELDS)));
}

/** Script text and approved clips attached to Shoot and Edit steps, for a team_member. */
async function scrubEarlierOutputs(result, participation) {
  const stages = result.pieceStages || [];
  if (result.scriptContent !== undefined || result.scriptShotList !== undefined) {
    const script = stages.find((s) => s.stageKey === 'Script');
    const output = script && canSeeStepOutput(script, participation) ? await approvedOutputOf(script) : null;
    delete result.scriptContent;
    delete result.scriptShotList;
    if (output?.document?.metadata?.shotList) result.scriptShotList = output.document.metadata.shotList;
    if (output?.document?.htmlSnapshot || output?.document?.plainText) {
      result.scriptContent = output.document.htmlSnapshot || output.document.plainText;
    }
  }
  if (result.approvedClips) {
    const shoot = stages.find((s) => s.stageKey === 'Shoot');
    if (!shoot || !canSeeStepOutput(shoot, participation)) delete result.approvedClips;
  }
  // Handed-over outputs follow the same rule: earlier finished steps this person may see.
  if (Array.isArray(result.handoff)) {
    result.handoff = result.handoff.filter((entry) =>
      canSeeStepOutput({ ownerId: entry.ownerId, stageOrder: entry.stageOrder, status: entry.status }, participation)
    );
  }
  delete result.handover;
  if (result.previousStage) {
    const previous = stages.find((s) => s.stageOrder === result.stageOrder - 1);
    if (!previous || !canSeeStepOutput(previous, participation)) {
      result.previousStage = omit(result.previousStage, ['deliverableUrl', 'publishedUrl']);
    }
  }
}

/** Applies who-sees-what to a work item before it is sent. Leadership sees it unchanged. */
export async function applyWorkItemViewerRules(item, user) {
  const role = normalizeRole(user?.role);
  if (role === 'executive') {
    const result = omit(item, ['latestFeedback', 'blockerNote']);
    if (result.rating) result.rating = pick(result.rating, ['_id', 'score', 'createdAt', 'stageKey']);
    return result;
  }
  if (!isTeamMember(user)) return item;

  const participation = await getParticipation(item, user);
  const stages = scrubStages(item.pieceStages, participation);

  if (participation.isOwner) {
    const result = { ...item, pieceStages: stages };
    await scrubEarlierOutputs(result, participation);
    return result;
  }

  // A participant looking at someone else's step.
  const visible = canSeeStepOutput(item, participation);
  const result = pick(item, visible ? [...PIPELINE_FIELDS, ...OUTPUT_FIELDS] : PIPELINE_FIELDS);
  result.pieceStages = stages;
  if (visible) {
    const output = await approvedOutputOf(item);
    if (output) result.latestSubmission = omit(output.toObject(), ['comments']);
    await scrubEarlierOutputs(result, participation);
  } else {
    delete result.previousStage;
  }
  return result;
}

const PRIVATE_ACTIVITY_KEYS = ['text', 'comment', 'note', 'notes', 'feedback', 'blockerNote', 'blockerReason', 'tags', 'deliverableUrl', 'publishedUrl', 'rootCause'];

/** Activity keeps who did what and when; review text and outputs stay private. */
export function sanitizeActivities(activities, user, workItem) {
  if (workItem ? canSeePrivateReview(user, workItem) : normalizeRole(user?.role) !== 'executive') return activities;
  return (activities || []).map((event) => {
    const plain = event?.toObject ? event.toObject() : event;
    return { ...plain, metadata: plain.metadata ? omit(plain.metadata, PRIVATE_ACTIVITY_KEYS) : plain.metadata };
  });
}

/**
 * Which versions of a step this team_member may see: all of their own step's versions,
 * otherwise only the approved output of a visible earlier step.
 */
export async function visibleVersionsFilter(workItem, user) {
  const participation = await getParticipation(workItem, user);
  if (participation.isOwner) return null;
  if (!canSeeStepOutput(workItem, participation)) return [];
  const output = await approvedOutputOf(workItem);
  return output ? [String(output._id)] : [];
}

/** Every version a team_member may see across a content piece. */
export async function visibleVersionIdsInPiece(pieceId, user) {
  const steps = await WorkItem.find({ contentPieceId: pieceId }).select('ownerId contentPieceId stageOrder status').lean();
  const ids = [];
  let ownStepIds = [];
  for (const step of steps) {
    if (String(step.ownerId) === userIdOf(user)) {
      ownStepIds.push(step._id);
      continue;
    }
    const allowed = await visibleVersionsFilter(step, user);
    if (allowed) ids.push(...allowed);
  }
  return { ownStepIds, ids };
}
