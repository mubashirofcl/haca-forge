import { Comment } from './model.js';
import { createNotification } from '../notifications/service.js';

export async function createComment(input, user, io) {
  const comment = new Comment({
    ...input,
    author: user._id,
  });

  await comment.save();

  // If mentions exist, notify them
  if (input.mentions && input.mentions.length > 0) {
    for (const mentionId of input.mentions) {
      if (mentionId.toString() !== user._id.toString()) {
        await createNotification({
          recipient: mentionId,
          type: 'comment_mention',
          title: 'You were mentioned',
          message: `${user.name} mentioned you in a comment: "${input.text.slice(0, 50)}..."`,
          entityType: input.entityType,
          entityId: input.entityId,
          io,
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

export async function listComments(entityType, entityId) {
  return Comment.find({ entityType, entityId })
    .populate('author', 'name email avatar role')
    .sort({ createdAt: 1 });
}
