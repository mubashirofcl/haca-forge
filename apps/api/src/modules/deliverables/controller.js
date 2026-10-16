import * as deliverableService from './service.js';

export async function createDeliverableHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const deliverable = await deliverableService.createDeliverable(req.body, req.user, io);
    res.status(201).json({ data: deliverable });
  } catch (err) {
    next(err);
  }
}

export async function reviewDeliverableHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const deliverable = await deliverableService.reviewDeliverable(
      req.params.id,
      req.body,
      req.user,
      io
    );
    res.json({ data: deliverable });
  } catch (err) {
    next(err);
  }
}

export async function confirmDeliverableHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const content = await deliverableService.confirmDeliverable(
      req.params.contentItemId,
      req.body,
      req.user,
      io
    );
    res.json({ data: content });
  } catch (err) {
    next(err);
  }
}

export async function handToPerformanceHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const content = await deliverableService.handToPerformance(
      req.params.contentItemId,
      req.user,
      io
    );
    res.json({ data: content });
  } catch (err) {
    next(err);
  }
}

export async function setPerformanceLiveHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const content = await deliverableService.setPerformanceLive(
      req.params.contentItemId,
      req.body,
      req.user,
      io
    );
    res.json({ data: content });
  } catch (err) {
    next(err);
  }
}

export async function getTaskDeliverablesHandler(req, res, next) {
  try {
    const deliverables = await deliverableService.getDeliverablesByTask(req.params.taskId);
    res.json({ data: deliverables });
  } catch (err) {
    next(err);
  }
}

export async function getComparisonHandler(req, res, next) {
  try {
    const { v1, v2 } = req.query;
    if (!v1 || !v2) {
      const err = new Error('Both v1 and v2 deliverable IDs are required in query params');
      err.statusCode = 400;
      throw err;
    }
    const comparison = await deliverableService.getDeliverableComparison(v1, v2);
    res.json({ data: comparison });
  } catch (err) {
    next(err);
  }
}

export async function listReviewQueueHandler(req, res, next) {
  try {
    const queue = await deliverableService.listReviewQueue();
    res.json({ data: queue });
  } catch (err) {
    next(err);
  }
}

export async function listFileLibraryHandler(req, res, next) {
  try {
    const result = await deliverableService.listFileLibrary(req.query);
    res.json({
      data: result.files,
      total: result.total,
      page: result.page,
      pages: result.pages,
    });
  } catch (err) {
    next(err);
  }
}
