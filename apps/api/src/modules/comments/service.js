import { Comment } from './model.js';
import { Deliverable } from '../deliverables/model.js';
import { createNotification } from '../notifications/service.js';
import { eventBus, EVENTS } from '../../lib/events.js';

export async function createComment(input, user, io) {
  const comment = new Comment({
    ...input,
    author: user._id,
  });

  await comment.save();

  // If mentions exist, notify them via domain event bus
  if (input.mentions && input.mentions.length > 0) {
    for (const mentionId of input.mentions) {
      if (mentionId.toString() !== user._id.toString()) {
        eventBus.emit(EVENTS.COMMENT_MENTION, {
          mentionedUserId: mentionId,
          authorName: user.name,
          text: input.text ? input.text.slice(0, 100) : '',
          link: input.entityType === 'task' ? `/tasks?taskId=${input.entityId}` : `/${input.entityType}/${input.entityId}`,
          entityType: input.entityType,
          entityId: input.entityId,
        });
      }
    }
  }

  const populated = await Comment.findById(comment._id).populate(
    'author',
    'name email avatar role'
  );

  if (io) {
    io.to(`${input.entityType}:${input.entityId}`).emit('new_comment', populated);
  }

  return populated;
}

export async function listComments(entityType, entityId, includeDeliverables = false) {
  if (entityType === 'task' && includeDeliverables) {
    const deliverables = await Deliverable.find({ taskId: entityId }).select('_id version').lean();
    const deliverableIds = deliverables.map((d) => d._id);
    const versionMap = new Map(deliverables.map((d) => [d._id.toString(), d.version]));

    const comments = await Comment.find({
      $or: [
        { entityType: 'task', entityId },
        { entityType: 'deliverable', entityId: { $in: deliverableIds } },
      ],
    })
      .populate('author', 'name email avatar role')
      .sort({ createdAt: 1 });

    return comments.map((c) => {
      const obj = c.toObject();
      if (c.entityType === 'deliverable') {
        obj.deliverableVersion = versionMap.get(c.entityId.toString()) || 1;
      }
      return obj;
    });
  }

  return Comment.find({ entityType, entityId })
    .populate('author', 'name email avatar role')
    .sort({ createdAt: 1 });
}
