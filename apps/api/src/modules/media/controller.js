import * as mediaService from './service.js';

export async function createClipHandler(req, res, next) {
  try {
    const { stageItemId } = req.params;
    const clip = await mediaService.createClip(stageItemId, req.body, req.user);
    res.status(201).json({ success: true, data: clip });
  } catch (err) {
    next(err);
  }
}

export async function listClipsHandler(req, res, next) {
  try {
    const { stageItemId } = req.params;
    const result = await mediaService.listClips(stageItemId, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateClipHandler(req, res, next) {
  try {
    const { id } = req.params;
    const clip = await mediaService.updateClipMetadata(id, req.body, req.user);
    res.status(200).json({ success: true, data: clip });
  } catch (err) {
    next(err);
  }
}

export async function replaceClipHandler(req, res, next) {
  try {
    const { id } = req.params;
    const newClip = await mediaService.replaceClip(id, req.body, req.user);
    res.status(201).json({ success: true, data: newClip });
  } catch (err) {
    next(err);
  }
}

export async function deleteClipHandler(req, res, next) {
  try {
    const { id } = req.params;
    const result = await mediaService.deleteClip(id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function reorderClipsHandler(req, res, next) {
  try {
    const { stageItemId } = req.params;
    const { clipIds } = req.body;
    const result = await mediaService.reorderClips(stageItemId, clipIds, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function postMessageHandler(req, res, next) {
  try {
    const { id } = req.params;
    const message = await mediaService.postMessage(id, req.body, req.user);
    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}

export async function listMessagesHandler(req, res, next) {
  try {
    const { id } = req.params;
    const messages = await mediaService.listMessages(id, req.user);
    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

export async function markMessagesSeenHandler(req, res, next) {
  try {
    const { id } = req.params;
    const result = await mediaService.markMessagesSeen(id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function toggleMessageDoneHandler(req, res, next) {
  try {
    const { id, messageId } = req.params;
    const { done } = req.body;
    const message = await mediaService.toggleMessageDone(id, messageId, done, req.user);
    res.status(200).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}

export async function reviewClipHandler(req, res, next) {
  try {
    const { id } = req.params;
    const clip = await mediaService.reviewClip(id, req.body, req.user);
    res.status(200).json({ success: true, data: clip });
  } catch (err) {
    next(err);
  }
}

export async function submitClipsHandler(req, res, next) {
  try {
    const { stageItemId } = req.params;
    const result = await mediaService.submitClipsForApproval(stageItemId, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function finishShootReviewHandler(req, res, next) {
  try {
    const { stageItemId } = req.params;
    const result = await mediaService.finishShootStepReview(stageItemId, req.body, req.user);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
