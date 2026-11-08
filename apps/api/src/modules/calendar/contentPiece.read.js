import mongoose from 'mongoose';
import { ContentPiece } from './contentPiece.model.js';
import { WorkItem } from '../workItems/model.js';
import { approvedOutputOf, canSeeStepOutput, isFinished, isTeamMember, notFound, userIdOf } from '../workItems/access.js';
import { outputItems, plainText } from '../workItems/handoff.js';

/**
 * GET /api/content-pieces/:id (Phase 6): a piece and its steps, each finished step with its
 * latest approved output. Phase 3 rules: a team_member must be on the piece (otherwise the
 * same 404 as a piece that does not exist), and sees only the outputs of earlier finished
 * steps and their own.
 */
export async function getContentPieceForViewer(id, user) {
  if (!id || !mongoose.isValidObjectId(id)) throw notFound();
  const piece = await ContentPiece.findById(id).lean();
  if (!piece) throw notFound();

  const steps = await WorkItem.find({ contentPieceId: piece._id })
    .select('title stageKey stageOrder status ownerId isSkipped isLocked deadline approvedAt postedAt')
    .populate('ownerId', 'name')
    .sort({ stageOrder: 1 })
    .lean();

  let visible = () => true;
  if (isTeamMember(user)) {
    const userId = userIdOf(user);
    const owned = steps.filter((s) => String(s.ownerId?._id || s.ownerId) === userId);
    if (!owned.length) throw notFound();
    const participation = {
      userId,
      isOwner: false,
      isParticipant: true,
      latestOwnedOrder: Math.max(...owned.map((s) => s.stageOrder || 0)),
    };
    visible = (step) => canSeeStepOutput(step, participation);
  }

  const workItems = [];
  for (const step of steps) {
    const entry = {
      _id: step._id,
      title: step.title,
      stageKey: step.stageKey,
      stageOrder: step.stageOrder,
      status: step.status,
      isSkipped: Boolean(step.isSkipped),
      isLocked: Boolean(step.isLocked),
      deadline: step.deadline,
      approvedAt: step.approvedAt || null,
      ownerId: step.ownerId ? { _id: step.ownerId._id, name: step.ownerId.name } : null,
      approvedOutput: null,
    };
    if (isFinished(step) && visible(step)) {
      const output = await approvedOutputOf(step);
      if (output) {
        entry.approvedOutput = { version: output.version, items: outputItems(output), text: plainText(output.document) };
      }
    }
    workItems.push(entry);
  }

  return {
    _id: piece._id,
    topic: piece.topic,
    contentType: piece.contentType,
    pipeline: piece.pipeline,
    postingDate: piece.postingDate,
    status: piece.status,
    brief: piece.brief || null,
    planId: piece.planId,
    workItems,
  };
}
