import crypto from 'crypto';
import mongoose from 'mongoose';
import { Submission, SubmissionComment, Rating, EditorLock } from './model.js';
import { WorkItem } from '../workItems/model.js';
import { ContentPiece } from '../calendar/contentPiece.model.js';
import { Person } from '../people/model.js';
import { sanitizeDocumentPayload } from './sanitizer.js';
import { logActivity } from '../activity/service.js';
import { recordRoundSubmission } from '../workItems/rounds.js';
import { assertCanHoldEditorLock, canSeePrivateReview, isTeamMember, requireParticipant } from '../workItems/access.js';
import { visibleVersionsFilter } from '../workItems/viewerRules.js';
import { createNotification, getSocketIO } from '../notifications/service.js';
import { withoutContact } from '../../lib/socketHub.js';
import {
  assertDecisionAllowed,
  assertValidRating,
  approveSubmission,
  claimSubmission,
  releaseSubmission,
  afterDecision,
  isAwaitingDecision,
} from './reviewDecision.js';
import {
  STAGE_PRIMARY_OUTPUT_KIND,
  STAGE_FALLBACK_OUTPUT_KIND,
  normalizeRole,
  getWorkspaceMode,
} from '@mmp/shared';

/**
 * Checks if user has access to a content piece (owner or team contributor)
 */
async function canAccessPieceOutputs(user, pieceId) {
  const role = normalizeRole(user.role);
  if (['admin', 'creative_head', 'sm_manager', 'executive'].includes(role)) {
    return true;
  }
  const userId = (user._id || user.id || user.userId)?.toString();
  // Check if user is an owner of any stage in this piece
  const count = await WorkItem.countDocuments({
    contentPieceId: pieceId,
    ownerId: userId,
  });
  return count > 0;
}

/**
 * Validates whether a submission has non-empty output matching the stage's requirements
 */
function validateNonEmptySubmission(kind, stageKey, document, files, linkUrl) {
  const normalizedLink = (linkUrl || '').trim();

  if (kind === 'document' || stageKey === 'Content' || stageKey === 'Script') {
    // Document requires json or htmlSnapshot, or link fallback
    const hasDoc = Boolean(
      (document?.json && Object.keys(document.json).length > 0) ||
      (document?.htmlSnapshot && document.htmlSnapshot.trim().length > 0)
    );
    if (!hasDoc && !normalizedLink) {
      const err = new Error('Document submission is empty. Please provide document content or a valid external link.');
      err.statusCode = 400;
      err.code = 'EMPTY_SUBMISSION';
      throw err;
    }
    return;
  }

  if (kind === 'video' || stageKey === 'Shoot' || stageKey === 'Edit') {
    // Video requires at least 1 video file or link fallback
    const hasVideo = Array.isArray(files) && files.length > 0 && files.some(f => Boolean(f.url));
    if (!hasVideo && !normalizedLink) {
      const err = new Error('Video submission is empty. Please upload video footage/cut or provide a valid link.');
      err.statusCode = 400;
      err.code = 'EMPTY_SUBMISSION';
      throw err;
    }
    return;
  }

  if (kind === 'image' || kind === 'pdf' || stageKey === 'Design') {
    const hasFiles = Array.isArray(files) && files.length > 0 && files.some(f => Boolean(f.url));
    if (!hasFiles && !normalizedLink) {
      const err = new Error('Design submission is empty. Please upload image(s) or PDF deliverable.');
      err.statusCode = 400;
      err.code = 'EMPTY_SUBMISSION';
      throw err;
    }
    return;
  }

  if (kind === 'link' || stageKey === 'Post') {
    if (!normalizedLink) {
      const err = new Error('Link submission is empty. A valid live URL is required.');
      err.statusCode = 400;
      err.code = 'EMPTY_SUBMISSION';
      throw err;
    }
    return;
  }
}

// ==========================================
// 1. Draft Management (Autosave & Concurrency)
// ==========================================

export async function getDraft(workItemId, user) {
  const workItem = await WorkItem.findById(workItemId);
  if (!workItem) {
    const err = new Error('Work item not found');
    err.statusCode = 404;
    throw err;
  }

  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = (workItem.ownerId?._id || workItem.ownerId)?.toString();

  // Scoping: Worker can only get draft of their own work item; reviewers can inspect
  if (role === 'team_member' && ownerId !== userId) {
    const err = new Error('You can only view drafts for work items assigned to you');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_OWNERSHIP';
    throw err;
  }

  let draft = await Submission.findOne({ workItemId, version: 0 });
  if (!draft) {
    const defaultKind = STAGE_PRIMARY_OUTPUT_KIND[workItem.stageKey] || 'document';
    draft = await Submission.create({
      workItemId: workItem._id,
      contentPieceId: workItem.contentPieceId || null,
      stageKey: workItem.stageKey,
      version: 0,
      kind: defaultKind,
      status: 'draft',
      versionToken: crypto.randomUUID(),
    });
  }

  return draft;
}

export async function saveDraft(workItemId, draftData, user) {
  const workItem = await WorkItem.findById(workItemId);
  if (!workItem) {
    const err = new Error('Work item not found');
    err.statusCode = 404;
    throw err;
  }

  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = (workItem.ownerId?._id || workItem.ownerId)?.toString();

  // Guard: Only assigned owner or admin can save drafts
  if (role !== 'admin' && ownerId !== userId) {
    const err = new Error('Only the assigned owner can edit the draft for this stage');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_OWNERSHIP';
    throw err;
  }

  // Guard: Workspace must be in edit mode
  const mode = getWorkspaceMode(user, workItem);
  if (mode !== 'edit') {
    const err = new Error('Workspace is not in edit mode');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ACTION';
    throw err;
  }

  // Sanitize document and enforce 1 MB size limit
  const sanitizedDoc = sanitizeDocumentPayload(draftData.document);

  let draft = await Submission.findOne({ workItemId, version: 0 });

  // Optimistic concurrency check using versionToken
  if (draft && draftData.versionToken && draft.versionToken !== draftData.versionToken) {
    const err = new Error('Draft was modified in another session. Please reload to avoid overwriting changes.');
    err.statusCode = 409;
    err.code = 'DRAFT_VERSION_CONFLICT';
    throw err;
  }

  const newToken = crypto.randomUUID();
  const defaultKind = STAGE_PRIMARY_OUTPUT_KIND[workItem.stageKey] || 'document';

  if (!draft) {
    draft = new Submission({
      workItemId: workItem._id,
      contentPieceId: workItem.contentPieceId || null,
      stageKey: workItem.stageKey,
      version: 0,
      kind: draftData.kind || defaultKind,
      document: sanitizedDoc || { json: null, htmlSnapshot: '' },
      files: draftData.files || [],
      linkUrl: draftData.linkUrl || '',
      notes: draftData.notes || '',
      status: 'draft',
      versionToken: newToken,
    });
  } else {
    if (draftData.kind) draft.kind = draftData.kind;
    if (sanitizedDoc !== undefined) draft.document = sanitizedDoc;
    if (draftData.files !== undefined) draft.files = draftData.files;
    if (draftData.linkUrl !== undefined) draft.linkUrl = draftData.linkUrl;
    if (draftData.notes !== undefined) draft.notes = draftData.notes;
    draft.versionToken = newToken;
  }

  await draft.save();
  return draft;
}

// ==========================================
// 2. Submit for Approval (Immutable Version vN)
// ==========================================

export async function submitForApproval(workItemId, submitData = {}, user) {
  const workItem = await WorkItem.findById(workItemId);
  if (!workItem) {
    const err = new Error('Work item not found');
    err.statusCode = 404;
    throw err;
  }

  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = (workItem.ownerId?._id || workItem.ownerId)?.toString();

  if (role !== 'admin' && ownerId !== userId) {
    const err = new Error('Only the assigned owner can submit deliverables for this stage');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_OWNERSHIP';
    throw err;
  }

  // Precondition: Worker cannot submit without having started
  if (workItem.status === 'Not Started' && !submitData.autoStart) {
    const err = new Error('You must start this work item before submitting deliverables');
    err.statusCode = 400;
    err.code = 'MUST_START_BEFORE_SUBMIT';
    throw err;
  }
  if (!workItem.startedAt) {
    workItem.startedAt = workItem.createdAt || new Date();
  }

  // Guard: Workspace must be in edit mode
  const mode = getWorkspaceMode(user, workItem);
  if (mode !== 'edit') {
    const err = new Error('Workspace is not in edit mode');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ACTION';
    throw err;
  }

  // Resolve submission data: use submitData merged with draft
  const draft = await Submission.findOne({ workItemId, version: 0 });

  const sanitizedDoc = sanitizeDocumentPayload(
    submitData.document !== undefined ? submitData.document : draft?.document
  );

  const kind = submitData.kind || draft?.kind || STAGE_PRIMARY_OUTPUT_KIND[workItem.stageKey] || 'document';
  const files = submitData.files !== undefined ? submitData.files : draft?.files || [];
  const linkUrl = submitData.linkUrl !== undefined ? submitData.linkUrl : draft?.linkUrl || '';
  const notes = submitData.notes !== undefined ? submitData.notes : draft?.notes || '';

  // Non-empty output check
  validateNonEmptySubmission(kind, workItem.stageKey, sanitizedDoc, files, linkUrl);

  // Compute next version
  const latestSubmission = await Submission.findOne({ workItemId, version: { $gt: 0 } }).sort({ version: -1 });
  const nextVersion = (latestSubmission?.version || 0) + 1;
  const fileUrl = submitData.fileUrl || (files && files[0]?.url) || linkUrl || '';

  const submissionDate = new Date();

  // Create immutable submission version
  const newSubmission = await Submission.create({
    workItemId: workItem._id,
    contentPieceId: workItem.contentPieceId || null,
    stageKey: workItem.stageKey,
    version: nextVersion,
    kind,
    document: sanitizedDoc || { json: null, htmlSnapshot: '' },
    files,
    fileUrl,
    linkUrl,
    notes,
    submittedById: userId,
    submittedAt: submissionDate,
    status: 'submitted',
    versionToken: crypto.randomUUID(),
  });

  // Update workItem status to Feedback (or Pending) and individual tracking timestamps
  workItem.status = 'Feedback';
  if (!workItem.submittedAt) {
    workItem.submittedAt = submissionDate;
  } else {
    workItem.resubmittedAt = submissionDate;
  }

  recordRoundSubmission(workItem, submissionDate);

  if (fileUrl || linkUrl) {
    workItem.deliverableUrl = fileUrl || linkUrl;
  }
  await workItem.save();

  // Log Activity
  await logActivity({
    entityType: 'submission',
    entityId: newSubmission._id,
    actor: user,
    action: 'submission.submitted',
    toStatus: 'submitted',
    metadata: {
      workItemId: workItem._id,
      stageKey: workItem.stageKey,
      version: nextVersion,
      kind,
    },
  });

  // Notify Creative Heads
  const creativeHeads = await Person.find({ role: 'creative_head', status: 'active' });
  for (const ch of creativeHeads) {
    await createNotification({
      recipient: ch._id,
      type: 'submission_ready',
      title: 'Deliverable Review Requested',
      message: `${workItem.title} (${workItem.stageKey || 'Stage'} v${nextVersion}) submitted for review.`,
      link: `/feedback?tab=stages&workItemId=${workItem._id}&version=${nextVersion}`,
      metadata: { workItemId: workItem._id, submissionId: newSubmission._id, version: nextVersion },
    });
  }

  return newSubmission;
}

// ==========================================
// 3. Versions Retrieval & Upstream Visibility
// ==========================================

export async function listSubmissions(workItemId, user) {
  const workItem = await WorkItem.findById(workItemId);
  if (!workItem) {
    const err = new Error('Work item not found');
    err.statusCode = 404;
    throw err;
  }

  // Visibility check: Owner, reviewer, or contributor in same content piece
  if (workItem.contentPieceId) {
    const hasAccess = await canAccessPieceOutputs(user, workItem.contentPieceId);
    if (!hasAccess) {
      const err = new Error('You do not have permission to view submissions for this piece');
      err.statusCode = 403;
      throw err;
    }
  }

  const versionFilter = { workItemId, version: { $gt: 0 } };
  if (isTeamMember(user)) {
    const allowed = await visibleVersionsFilter(workItem, user);
    if (allowed) versionFilter._id = { $in: allowed };
  }

  return Submission.find(versionFilter)
    .sort({ version: -1 })
    .populate('submittedById', 'name email role jobRole')
    .populate('reviewedById', 'name email role');
}

export async function getSubmissionById(submissionId, user) {
  const submission = await Submission.findById(submissionId)
    .populate('submittedById', 'name email role jobRole')
    .populate('reviewedById', 'name email role')
    .populate({
      path: 'workItemId',
      populate: [
        { path: 'ownerId', select: 'name email role jobRole' },
      ],
    })
    .populate('contentPieceId');

  if (!submission) {
    const err = new Error('Submission not found');
    err.statusCode = 404;
    throw err;
  }

  if (submission.contentPieceId) {
    const hasAccess = await canAccessPieceOutputs(user, submission.contentPieceId);
    if (!hasAccess) {
      const err = new Error('You do not have permission to view this submission');
      err.statusCode = 403;
      throw err;
    }
  }

  const workId = submission.workItemId?._id || submission.workItemId;

  // A participant on someone else's step sees only its approved output.
  if (isTeamMember(user) && submission.workItemId) {
    const allowed = await visibleVersionsFilter(submission.workItemId, user);
    if (allowed && !allowed.includes(String(submission._id))) {
      const err = new Error('You do not have permission to view this submission');
      err.statusCode = 403;
      err.code = 'FORBIDDEN_ACTION';
      throw err;
    }
  }

  // Revision notes stay with the step owner and leadership.
  if (submission.workItemId && !canSeePrivateReview(user, submission.workItemId)) {
    const subPrivate = submission.toObject ? submission.toObject() : { ...submission };
    subPrivate.comments = [];
    return subPrivate;
  }

  const commentQuery = workId
    ? { $or: [{ submissionId: submission._id }, { workItemId: workId }] }
    : { submissionId: submission._id };

  const comments = await SubmissionComment.find(commentQuery)
    .sort({ createdAt: 1 })
    .populate('authorId', 'name email role jobRole')
    .populate('resolvedById', 'name email');

  const subObj = submission.toObject ? submission.toObject() : { ...submission };
  subObj.comments = comments;

  return subObj;
}

// ==========================================
// 4. Comments (Anchored & Scoped)
// ==========================================

export async function addComment(submissionId, commentData, user) {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    const err = new Error('Submission not found');
    err.statusCode = 404;
    throw err;
  }

  const workItem = await WorkItem.findById(submission.workItemId);
  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = (workItem?.ownerId?._id || workItem?.ownerId)?.toString();

  // Comment Privacy Guard: strictly between step owner and reviewers (creative_head, admin)
  const isReviewer = role === 'creative_head' || role === 'admin';
  const isStepOwner = ownerId === userId;

  if (!isReviewer && !isStepOwner) {
    const err = new Error('Comments on a stage submission are strictly private between the step owner and reviewers');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_COMMENT_ACCESS';
    throw err;
  }

  const comment = await SubmissionComment.create({
    submissionId: submission._id,
    workItemId: submission.workItemId,
    authorId: userId,
    anchor: commentData.anchor || null,
    text: commentData.text.trim(),
    parentId: commentData.parentId || null,
  });

  // Log Activity
  await logActivity({
    entityType: 'submission_comment',
    entityId: comment._id,
    actor: user,
    action: 'submission.comment_added',
    metadata: {
      submissionId: submission._id,
      workItemId: submission.workItemId,
      anchorType: commentData.anchor?.type,
    },
  });

  // Notification: notify the other party
  if (isReviewer && ownerId) {
    await createNotification({
      recipient: ownerId,
      type: 'submission_comment',
      title: 'New Feedback Comment',
      message: `Reviewer added feedback on ${workItem?.title || 'your deliverable'}: "${comment.text.slice(0, 60)}"`,
      link: `/my-work?id=${workItem?._id}`,
      metadata: { submissionId: submission._id, commentId: comment._id },
    });
  } else if (isStepOwner) {
    const creativeHeads = await Person.find({ role: 'creative_head', status: 'active' });
    for (const ch of creativeHeads) {
      await createNotification({
        recipient: ch._id,
        type: 'submission_comment',
        title: 'Worker Replied on Submission',
        message: `${user.name || 'Worker'} replied on ${workItem?.title || 'deliverable'}: "${comment.text.slice(0, 60)}"`,
        link: `/feedback?tab=stages&workItemId=${workItem?._id}`,
        metadata: { submissionId: submission._id, commentId: comment._id },
      });
    }
  }

  const populated = withoutContact(await SubmissionComment.findById(comment._id).populate('authorId', 'name role jobRole'));

  const io = getSocketIO();
  if (io) {
    if (ownerId) io.to(`user:${ownerId}`).emit('comment:new', populated);
    io.to('role:creative_head').emit('comment:new', populated);
    io.to('role:admin').emit('comment:new', populated);
  }

  return populated;
}

export async function listComments(submissionId, user) {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    const err = new Error('Submission not found');
    err.statusCode = 404;
    throw err;
  }

  const workItem = await WorkItem.findById(submission.workItemId);
  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = (workItem?.ownerId?._id || workItem?.ownerId)?.toString();

  // Privacy Guard
  const isReviewer = role === 'creative_head' || role === 'admin' || role === 'sm_manager';
  const isStepOwner = ownerId === userId;
  if (!isReviewer && !isStepOwner) {
    const err = new Error('Comments are private to the assigned worker and reviewers');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_COMMENT_ACCESS';
    throw err;
  }

  const query = submission.workItemId
    ? { $or: [{ submissionId }, { workItemId: submission.workItemId }] }
    : { submissionId };

  return SubmissionComment.find(query)
    .sort({ createdAt: 1 })
    .populate('authorId', 'name email role jobRole')
    .populate('resolvedById', 'name email');
}

export async function resolveComment(commentId, user) {
  const comment = await SubmissionComment.findById(commentId);
  if (!comment) {
    const err = new Error('Comment not found');
    err.statusCode = 404;
    throw err;
  }

  const workItem = await WorkItem.findById(comment.workItemId);
  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = (workItem?.ownerId?._id || workItem?.ownerId)?.toString();

  const isReviewer = role === 'creative_head' || role === 'admin';
  const isStepOwner = ownerId === userId;
  if (!isReviewer && !isStepOwner) {
    const err = new Error('Only the author, owner, or reviewer can resolve comments');
    err.statusCode = 403;
    throw err;
  }

  comment.resolved = true;
  comment.resolvedById = userId;
  comment.resolvedAt = new Date();
  await comment.save();

  await logActivity({
    entityType: 'submission_comment',
    entityId: comment._id,
    actor: user,
    action: 'submission.comment_resolved',
    metadata: { submissionId: comment.submissionId },
  });

  return comment;
}

// ==========================================
// 5. Review Actions: Approve with Rating
// ==========================================

export async function approveWithRating(submissionId, { score, feedback = '', tags = [], alsoShareToTeamChat = false }, user) {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    const err = new Error('Submission not found');
    err.statusCode = 404;
    throw err;
  }

  const workItem = await WorkItem.findById(submission.workItemId);
  if (!workItem) {
    const err = new Error('Work item not found');
    err.statusCode = 404;
    throw err;
  }

  // Everything is checked before the first write.
  await assertDecisionAllowed({ user, workItem, submissionId: submission._id, decision: 'approve' });
  assertValidRating(score);

  const { submission: approved, rating } = await approveSubmission({ submission, workItem, score, feedback, tags, user });

  // 6. Optional auto-share to Team Chat
  let sharedMessage = null;
  if (alsoShareToTeamChat) {
    try {
      const { Channel } = await import('../chat/channel.model.js');
      const { shareAssetToChat } = await import('../chat/service.js');
      const teamChannel = await Channel.findOne({ type: 'team' });
      if (teamChannel) {
        const shareResult = await shareAssetToChat(user, {
          channelId: teamChannel._id.toString(),
          assetId: submission._id.toString(),
          assetType: submission.assetType || 'finalCut',
          contentPieceId: workItem.contentPieceId ? workItem.contentPieceId.toString() : null,
          stageKey: workItem.stageKey,
          note: `Approved ${workItem.stageKey || 'deliverable'} shared to Team Chat`,
        });
        sharedMessage = shareResult.message || shareResult;
      }
    } catch (shareErr) {
      logger.warn('Failed to auto-share approved submission to Team Chat:', shareErr);
    }
  }

  return { submission: approved, rating, sharedMessage };
}

// ==========================================
// 6. Review Actions: Request Revision
// ==========================================

export async function requestRevision(submissionId, { comment, rootCause }, user) {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    const err = new Error('Submission not found');
    err.statusCode = 404;
    throw err;
  }

  const workItem = await WorkItem.findById(submission.workItemId);
  if (!workItem) {
    const err = new Error('Work item not found');
    err.statusCode = 404;
    throw err;
  }

  // Everything is checked before the first write.
  await assertDecisionAllowed({ user, workItem, submissionId: submission._id, decision: 'revision' });

  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = (workItem.ownerId?._id || workItem.ownerId)?.toString();

  // Revision comment guard: Requires comment or note
  const trimmedComment = (comment || '').trim();
  const hasExistingComments = await SubmissionComment.countDocuments({ submissionId: submission._id });
  if (!trimmedComment && hasExistingComments === 0) {
    const err = new Error('Requesting revision requires at least one comment or an overall revision note');
    err.statusCode = 400;
    err.code = 'REVISION_FEEDBACK_REQUIRED';
    throw err;
  }

  const now = new Date();

  // 1. Claim the submission: only one decision can win
  const decided = await claimSubmission(submission, 'changes_requested', user);

  let commentRecord = null;
  try {
    // A comment record for the revision note, so it appears in the editor's live chat discussion
    if (trimmedComment) {
      commentRecord = await SubmissionComment.create({
        submissionId: submission._id,
        workItemId: workItem._id,
        authorId: userId,
        anchor: null,
        text: trimmedComment,
        parentId: null,
      });
    }

    // 2. Return workItem to In Progress & increment revisions and track round decision
    workItem.status = 'In Progress';
    workItem.revisions = (workItem.revisions || 0) + 1;
    workItem.changesRequestedAt = now;
    workItem.decisionAt = now;

    if (workItem.rounds && workItem.rounds.length > 0) {
      const curRound = workItem.rounds[workItem.rounds.length - 1];
      curRound.decisionAt = now;
      curRound.decision = 'changes_requested';
    }
    if (!workItem.rounds) workItem.rounds = [];
    workItem.rounds.push({
      roundNumber: workItem.rounds.length + 1,
      startedAt: now,
      intervals: [],
    });
    await workItem.save();
  } catch (error) {
    if (commentRecord) await SubmissionComment.deleteOne({ _id: commentRecord._id });
    await releaseSubmission(submission);
    throw error;
  }

  // The decision is saved. What follows must not fail it.
  if (commentRecord) {
    await afterDecision('the live comment', async () => {
      const populatedComment = withoutContact(
        await SubmissionComment.findById(commentRecord._id).populate('authorId', 'name role jobRole')
      );
      const io = getSocketIO();
      if (io) {
        if (ownerId) io.to(`user:${ownerId}`).emit('comment:new', populatedComment);
        io.to('role:creative_head').emit('comment:new', populatedComment);
        io.to('role:admin').emit('comment:new', populatedComment);
      }
    });
  }

  // 3. Prefill next draft from this reviewed version so the worker can iterate directly
  let draft = null;
  await afterDecision('the next draft', async () => {
    draft = await Submission.findOne({ workItemId: workItem._id, version: 0 });
    const newToken = crypto.randomUUID();

    if (!draft) {
      draft = new Submission({
        workItemId: workItem._id,
        contentPieceId: workItem.contentPieceId || null,
        stageKey: workItem.stageKey,
        version: 0,
        kind: submission.kind,
        document: submission.document,
        files: submission.files,
        linkUrl: submission.linkUrl,
        notes: submission.notes,
        status: 'draft',
        versionToken: newToken,
      });
    } else {
      draft.kind = submission.kind;
      draft.document = submission.document;
      draft.files = submission.files;
      draft.linkUrl = submission.linkUrl;
      draft.notes = submission.notes;
      draft.versionToken = newToken;
    }
    await draft.save();
  });

  // 4. Log Activity
  await afterDecision('the revision event', () =>
    logActivity({
      entityType: 'submission',
      entityId: submission._id,
      actor: user,
      action: 'submission.revision_requested',
      toStatus: 'changes_requested',
      metadata: {
        workItemId: workItem._id,
        version: submission.version,
        revisions: workItem.revisions,
        comment: trimmedComment,
        rootCause,
      },
    })
  );

  // 5. Notify Worker
  if (ownerId) {
    await afterDecision('the revision notification', () =>
      createNotification({
        recipient: ownerId,
        type: 'revision_requested',
        title: 'Revision Requested on Stage Deliverable',
        message: `Creative Head requested a revision on ${workItem.title}. Note: ${trimmedComment || 'Please review comments and resubmit.'}`,
        link: `/my-work?id=${workItem._id}`,
        metadata: { workItemId: workItem._id, submissionId: submission._id, comment: trimmedComment },
      })
    );
  }

  return { submission: decided, draft, revisions: workItem.revisions };
}

// ==========================================
// 7. Ratings: Mark Seen & Edit Rating
// ==========================================

export async function markRatingSeen(ratingId, user) {
  const rating = await Rating.findById(ratingId);
  if (!rating) {
    const err = new Error('Rating not found');
    err.statusCode = 404;
    throw err;
  }

  const userId = (user._id || user.id || user.userId)?.toString();
  if (rating.workerId.toString() !== userId) {
    const err = new Error('You can only mark your own rating as seen');
    err.statusCode = 403;
    throw err;
  }

  rating.seenAt = new Date();
  await rating.save();
  return rating;
}

export async function editRating(ratingId, editData, user) {
  const rating = await Rating.findById(ratingId);
  if (!rating) {
    const err = new Error('Rating not found');
    err.statusCode = 404;
    throw err;
  }

  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();

  // Guard: Rater or Admin only
  if (role !== 'admin' && rating.raterId.toString() !== userId) {
    const err = new Error('Only the original rater or an Admin can edit this rating');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ACTION';
    throw err;
  }

  if (!editData.reason || !editData.reason.trim()) {
    const err = new Error('Reason for editing rating is required');
    err.statusCode = 400;
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  // Push to editedLog
  rating.editedLog.push({
    editedBy: userId,
    editedAt: new Date(),
    oldScore: rating.score,
    newScore: editData.score !== undefined ? editData.score : rating.score,
    oldFeedback: rating.feedback,
    newFeedback: editData.feedback !== undefined ? editData.feedback : rating.feedback,
    oldTags: rating.tags,
    newTags: editData.tags !== undefined ? editData.tags : rating.tags,
    reason: editData.reason.trim(),
  });

  if (editData.score !== undefined) rating.score = editData.score;
  if (editData.feedback !== undefined) rating.feedback = editData.feedback.trim();
  if (editData.tags !== undefined) rating.tags = editData.tags;

  await rating.save();

  await logActivity({
    entityType: 'rating',
    entityId: rating._id,
    actor: user,
    action: 'rating.edited',
    metadata: {
      ratingId: rating._id,
      reason: editData.reason.trim(),
      newScore: rating.score,
    },
  });

  return rating;
}

// ==========================================
// 8. Review Queue
// ==========================================

export async function getReviewQueue(user) {
  const role = normalizeRole(user.role);
  if (!['admin', 'creative_head', 'sm_manager', 'executive'].includes(role)) {
    const err = new Error('Only reviewers and leadership can view the review queue');
    err.statusCode = 403;
    throw err;
  }

  // Read-only. A version is listed only while it is the latest real version on a step
  // awaiting review. Older versions and finished steps stay in the database, unlisted.
  const submitted = await Submission.find({ status: 'submitted', version: { $gt: 0 } })
    .sort({ submittedAt: 1 }) // FIFO oldest first
    .populate('submittedById', 'name email role jobRole')
    .populate({
      path: 'workItemId',
      select: 'title stageKey status priority deadline ownerId blockerReason blockerNote decisionAt approvedAt changesRequestedAt',
      populate: [
        { path: 'ownerId', select: 'name email role jobRole' },
      ],
    })
    .populate({
      path: 'contentPieceId',
      select: 'title workType targetDate liveUrl',
    });

  const latestVersions = await Submission.aggregate([
    { $match: { workItemId: { $in: submitted.map((s) => s.workItemId?._id).filter(Boolean) }, version: { $gt: 0 } } },
    { $group: { _id: '$workItemId', version: { $max: '$version' } } },
  ]);
  const latestVersionOf = new Map(latestVersions.map((row) => [String(row._id), row.version]));

  const submissions = submitted.filter(
    (sub) =>
      sub.workItemId &&
      latestVersionOf.get(String(sub.workItemId._id)) === sub.version &&
      isAwaitingDecision(sub.workItemId, sub)
  );

  const now = Date.now();

  return submissions.map((sub) => {
    const submittedMs = sub.submittedAt ? new Date(sub.submittedAt).getTime() : now;
    const waitingDays = Math.max(0, Math.floor((now - submittedMs) / (1000 * 3600 * 24)));

    const workItemObj = sub.workItemId && typeof sub.workItemId === 'object' ? sub.workItemId : null;
    const workItemIdStr = workItemObj?._id ? workItemObj._id.toString() : (sub.workItemId?.toString() || '');
    const pieceObj = sub.contentPieceId && typeof sub.contentPieceId === 'object' ? sub.contentPieceId : null;

    return {
      _id: sub._id,
      id: sub._id.toString(),
      submissionId: sub._id.toString(),
      workItemId: {
        _id: workItemIdStr,
        id: workItemIdStr,
        title: workItemObj?.title || '',
        stageKey: sub.stageKey || workItemObj?.stageKey,
        step: sub.stageKey || workItemObj?.stageKey,
        ownerId: workItemObj?.ownerId
          ? {
              _id: (workItemObj.ownerId._id || workItemObj.ownerId.id || workItemObj.ownerId)?.toString(),
              id: (workItemObj.ownerId._id || workItemObj.ownerId.id || workItemObj.ownerId)?.toString(),
              name: workItemObj.ownerId.name,
              role: workItemObj.ownerId.role,
            }
          : null,
      },
      workItem: workItemObj || sub.workItemId,
      contentPieceId: pieceObj
        ? {
            _id: pieceObj._id?.toString(),
            id: pieceObj._id?.toString(),
            title: pieceObj.title,
          }
        : null,
      contentPiece: pieceObj || sub.contentPieceId,
      stageKey: sub.stageKey,
      version: sub.version,
      versionNumber: sub.version,
      kind: sub.kind,
      submittedBy: sub.submittedById,
      submittedAt: sub.submittedAt,
      waitingDays,
      status: sub.status,
      filesCount: sub.files?.length || 0,
      hasDocument: Boolean(sub.document?.json || sub.document?.htmlSnapshot),
      linkUrl: sub.linkUrl,
      fileUrl: sub.files?.[0]?.url || sub.linkUrl,
      contentUrl: sub.linkUrl,
      notes: sub.notes,
    };
  });
}

// ==========================================
// 9. Ratings Summary Per Person (Privacy Protected)
// ==========================================

export async function getRatingsSummary(personId, user) {
  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();
  const targetIdStr = personId.toString();

  // Scoping Guard:
  // - A worker reads ONLY their own ratings
  // - creative_head, sm_manager, admin, executive read anyone's
  // - NO comparative ranking or leaderboards
  if (role === 'team_member' && userId !== targetIdStr) {
    const err = new Error('Workers are permitted to inspect only their own quality ratings');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_RATINGS_ACCESS';
    throw err;
  }

  const ratings = await Rating.find({ workerId: targetIdStr })
    .sort({ createdAt: -1 })
    .populate('raterId', 'name role')
    .populate('editedLog.editedBy', 'name role')
    .populate('workItemId', 'title stageKey');

  const count = ratings.length;

  // Rule: The average is null until at least 3 ratings exist
  if (count < 3) {
    return {
      personId: targetIdStr,
      thresholdMet: false,
      message: 'Not enough ratings yet',
      count,
      averageAllTime: null,
      average30Days: null,
      average90Days: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      monthlyTrend: [],
      averagePerStepType: {},
      recentFeedback: [],
    };
  }

  const now = Date.now();
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const ms90d = 90 * 24 * 60 * 60 * 1000;

  // 1. All-time average
  const totalScore = ratings.reduce((sum, r) => sum + r.score, 0);
  const averageAllTime = Number((totalScore / count).toFixed(2));

  // 2. Rolling 30-Day and 90-Day Averages
  const ratings30d = ratings.filter(r => (now - new Date(r.createdAt).getTime()) <= ms30d);
  const average30Days = ratings30d.length > 0
    ? Number((ratings30d.reduce((sum, r) => sum + r.score, 0) / ratings30d.length).toFixed(2))
    : null;

  const ratings90d = ratings.filter(r => (now - new Date(r.createdAt).getTime()) <= ms90d);
  const average90Days = ratings90d.length > 0
    ? Number((ratings90d.reduce((sum, r) => sum + r.score, 0) / ratings90d.length).toFixed(2))
    : null;

  // 3. Distribution (1 to 5)
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    if (distribution[r.score] !== undefined) {
      distribution[r.score] += 1;
    }
  }

  // 4. Monthly Trend (last 6 calendar months)
  const monthlyGroups = {};
  for (const r of ratings) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyGroups[key]) monthlyGroups[key] = [];
    monthlyGroups[key].push(r.score);
  }

  const monthlyTrend = Object.keys(monthlyGroups)
    .sort()
    .slice(-6)
    .map(month => ({
      month,
      count: monthlyGroups[month].length,
      average: Number((monthlyGroups[month].reduce((a, b) => a + b, 0) / monthlyGroups[month].length).toFixed(2)),
    }));

  // 5. Average per Step Type
  const stepGroups = {};
  for (const r of ratings) {
    const step = r.stageKey || 'Other';
    if (!stepGroups[step]) stepGroups[step] = [];
    stepGroups[step].push(r.score);
  }

  const averagePerStepType = {};
  for (const [step, scores] of Object.entries(stepGroups)) {
    averagePerStepType[step] = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  }

  // 6. Recent Feedback (last 10 ratings with notes or tags)
  const recentFeedback = ratings
    .filter(r => (r.feedback && r.feedback.length > 0) || (r.tags && r.tags.length > 0))
    .slice(0, 10)
    .map(r => ({
      ratingId: r._id,
      score: r.score,
      feedback: r.feedback,
      tags: r.tags,
      stageKey: r.stageKey,
      deliverableTitle: r.workItemId?.title || '',
      workItemId: r.workItemId?._id || r.workItemId,
      date: r.createdAt,
      seenAt: r.seenAt,
      raterName: r.raterId?.name || 'Creative Head',
      editedLog: r.editedLog || [],
    }));

  return {
    personId: targetIdStr,
    thresholdMet: true,
    count,
    averageAllTime,
    average30Days,
    average90Days,
    distribution,
    monthlyTrend,
    averagePerStepType,
    recentFeedback: role === 'executive' ? [] : recentFeedback,
  };
}

// ==========================================
// 10. Single-Editor Session Lock
// ==========================================

export async function claimEditorLock(workItemId, user) {
  await assertCanHoldEditorLock(workItemId, user);
  const userId = (user._id || user.id || user.userId)?.toString();
  const userName = user.name || 'Another user';
  const cutoff = new Date(Date.now() - 60000); // 60s timeout

  const existing = await EditorLock.findOne({ workItemId });
  if (existing && existing.lastHeartbeat > cutoff && existing.userId.toString() !== userId) {
    return {
      locked: true,
      heldBy: existing.userName,
      isOwner: false,
    };
  }

  await EditorLock.findOneAndUpdate(
    { workItemId },
    { workItemId, userId, userName, lastHeartbeat: new Date() },
    { upsert: true, new: true }
  );

  return {
    locked: false,
    heldBy: userName,
    isOwner: true,
  };
}

export async function releaseEditorLock(workItemId, user) {
  await assertCanHoldEditorLock(workItemId, user);
  const userId = (user._id || user.id || user.userId)?.toString();
  await EditorLock.deleteOne({ workItemId, userId });
  return { released: true };
}

export async function getEditorLock(workItemId, user) {
  const userId = (user._id || user.id || user.userId)?.toString();
  const cutoff = new Date(Date.now() - 60000);
  const existing = await EditorLock.findOne({ workItemId });
  if (!existing || existing.lastHeartbeat <= cutoff) {
    return { locked: false, heldBy: null, isOwner: true };
  }
  const isOwner = existing.userId.toString() === userId;
  return {
    locked: !isOwner,
    heldBy: existing.userName,
    isOwner,
  };
}

// ==========================================
// 11. Work Item Comments
// ==========================================

export async function listWorkItemComments(workItemId, user) {
  const workItem = await WorkItem.findById(workItemId);
  if (!workItem) {
    const err = new Error('Work item not found');
    err.statusCode = 404;
    throw err;
  }
  const role = normalizeRole(user.role);
  const userId = (user._id || user.id || user.userId)?.toString();
  const ownerId = (workItem.ownerId?._id || workItem.ownerId)?.toString();

  const isReviewer = role === 'creative_head' || role === 'admin' || role === 'sm_manager';
  const isStepOwner = ownerId === userId;
  if (!isReviewer && !isStepOwner) {
    const err = new Error('Comments are private to the assigned worker and reviewers');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_COMMENT_ACCESS';
    throw err;
  }

  return SubmissionComment.find({ workItemId })
    .sort({ createdAt: 1 })
    .populate('authorId', 'name email role jobRole')
    .populate('resolvedById', 'name email');
}

export async function addWorkItemComment(workItemId, commentData, user) {
  const workItem = await WorkItem.findById(workItemId);
  if (!workItem) {
    const err = new Error('Work item not found');
    err.statusCode = 404;
    throw err;
  }

  // Find latest submission or draft
  let submission = await Submission.findOne({ workItemId, version: { $gt: 0 } }).sort({ version: -1 });
  if (!submission) {
    submission = await Submission.findOne({ workItemId, version: 0 });
  }
  if (!submission) {
    // Ensure draft exists
    submission = await getDraft(workItemId, user);
  }

  return addComment(submission._id, commentData, user);
}

