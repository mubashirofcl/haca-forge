import { isAppUploadPath, isDriveLink, isPostableWorkType, workflowFromFlags, workflowLabel } from '@mmp/shared';
import { MediaItem } from '../media/model.js';
import { approvedOutputOf, isFinished } from './access.js';

/**
 * Asset handoff (Phase 5): what each step receives from the finished steps before it, and,
 * for a finished non-postable Design step, what is handed over. Always the latest approved
 * version (approvedOutputOf, with its fallback for legacy steps that never marked one).
 * Who may see each entry is applied afterwards by the viewer rules.
 */

/** upload | drive | link. "link" is an existing external URL saved before Phase 5: shown as a plain link. */
export function linkKind(url) {
  if (isAppUploadPath(url)) return 'upload';
  if (isDriveLink(url)) return 'drive';
  return 'link';
}

const SAFE_URL = /^(https?:\/\/|\/uploads\/)/i;

/** An output's items: files first, then fileUrl and linkUrl, without duplicates or unsafe URLs. */
export function outputItems(submission) {
  if (!submission) return [];
  const items = [];
  const seen = new Set();
  const add = (url, name) => {
    const value = typeof url === 'string' ? url.trim() : '';
    if (!value || seen.has(value) || !SAFE_URL.test(value)) return;
    seen.add(value);
    items.push({ url: value, name: name || null, kind: linkKind(value) });
  };
  for (const file of submission.files || []) add(file?.url, file?.name);
  add(submission.fileUrl);
  add(submission.linkUrl);
  return items;
}

export function plainText(document) {
  if (!document) return '';
  if (typeof document.plainText === 'string' && document.plainText.trim()) return document.plainText.trim();
  const html = typeof document.htmlSnapshot === 'string' ? document.htmlSnapshot : '';
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function entryFor(step) {
  const output = await approvedOutputOf(step);
  const meta = output?.document?.metadata || {};
  const entry = {
    workItemId: String(step._id),
    stageKey: step.stageKey,
    stageOrder: step.stageOrder,
    ownerId: step.ownerId?._id ? String(step.ownerId._id) : step.ownerId ? String(step.ownerId) : null,
    ownerName: step.ownerId?.name || null,
    status: step.status,
    approvedAt: step.approvedAt || null,
    version: output?.version ?? null,
    items: [],
    text: '',
    shotList: [],
    clips: [],
  };
  if (step.stageKey === 'Shoot') {
    // A Shoot step hands over its approved clips, one item each.
    const clips = await MediaItem.find({ stageItemId: step._id, status: 'approved' })
      .select('title shotRef take url thumbnailUrl kind durationSeconds width height order')
      .sort({ order: 1, createdAt: 1 })
      .lean();
    entry.clips = clips
      .filter((c) => SAFE_URL.test(String(c.url || '')))
      .map((c) => ({
        _id: String(c._id),
        title: c.title,
        shotRef: c.shotRef || '',
        take: c.take,
        url: c.url,
        kind: linkKind(c.url),
        mediaKind: c.kind || 'video',
        thumbnailUrl: isAppUploadPath(c.thumbnailUrl) ? c.thumbnailUrl : '',
        durationSeconds: c.durationSeconds,
      }));
    return entry;
  }
  entry.items = outputItems(output);
  if (step.stageKey === 'Script' || step.stageKey === 'Content') {
    // Text and shot list only; captions are written by the poster on the Post step.
    entry.text = plainText(output?.document);
    entry.shotList = Array.isArray(meta.shotList) ? meta.shotList : [];
  }
  return entry;
}

/** The approved outputs of every finished, not skipped step before this one. */
export async function buildHandoff(current, siblingStages) {
  const earlier = (siblingStages || [])
    .filter((s) => (s.stageOrder || 0) < (current.stageOrder || 0) && !s.isSkipped && isFinished(s))
    .sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
  const entries = [];
  for (const step of earlier) entries.push(await entryFor(step));
  return entries;
}

/**
 * What the plan row gives a step: the row's workflow label for every step and, for a step with
 * no earlier step, "From the plan": the row's brief, plus the source video for Edit only reels.
 * Worked out on each read from the stored row; nothing is saved.
 */
export async function buildFromPlan(contentPieceId, { isFirstStep }) {
  const { ContentPiece } = await import('../calendar/contentPiece.model.js');
  const piece = await ContentPiece.findById(contentPieceId)
    .select('brief contentType needsScript needsShoot needsContent sourceVideoLink')
    .lean();
  if (!piece) return { workflowLabel: null, fromPlan: null };
  const workflow = workflowFromFlags(piece.contentType, piece);
  const label = workflowLabel(piece.contentType, piece);
  if (!isFirstStep) return { workflowLabel: label, fromPlan: null };
  const items = [];
  const source = typeof piece.sourceVideoLink === 'string' ? piece.sourceVideoLink.trim() : '';
  if (workflow === 'edit_only' && SAFE_URL.test(source)) items.push({ url: source, name: 'Source video', kind: linkKind(source) });
  return {
    workflowLabel: label,
    fromPlan: { brief: (piece.brief || '').trim(), workflow, workflowLabel: label, items },
  };
}

/** A non-postable Design step that has been approved is the end of its pipeline: hand it over. */
export function isHandoverStep(step) {
  return step?.stageKey === 'Design' && !isPostableWorkType(step.workType || '');
}

export async function buildHandover(step) {
  if (!isHandoverStep(step) || !isFinished(step)) return null;
  const entry = await entryFor(step);
  return { approvedAt: entry.approvedAt, version: entry.version, items: entry.items };
}

/**
 * Tell every active SM manager that an approved non-postable design is ready to hand over.
 * Called once per approval, after the approval is saved.
 */
export async function notifyHandoverReady(step) {
  const { Person } = await import('../people/model.js');
  const { createNotification } = await import('../notifications/service.js');
  const managers = await Person.find({ role: 'sm_manager', status: 'active' }).select('_id').lean();
  for (const manager of managers) {
    await createNotification({
      recipient: manager._id,
      type: 'step_handover_ready',
      title: 'Design ready for handover',
      message: `"${step.title}" is approved and ready for handover.`,
      link: `/work/${step._id}`,
      metadata: { workItemId: step._id },
    });
  }
  return managers.length;
}
