import * as commentService from './service.js';

export async function createCommentHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const comment = await commentService.createComment(req.body, req.user, io);
    res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
}

export async function listCommentsHandler(req, res, next) {
  try {
    const { entityType, entityId, includeDeliverables } = req.query;
    if (!entityType || !entityId) {
      const err = new Error('entityType and entityId query params are required');
      err.statusCode = 400;
      throw err;
    }
    const comments = await commentService.listComments(
      entityType,
      entityId,
      includeDeliverables === 'true' || includeDeliverables === true
    );
    res.json({ data: comments });
  } catch (err) {
    next(err);
  }
}
