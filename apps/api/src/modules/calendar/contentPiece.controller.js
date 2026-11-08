import * as contentPieceService from './contentPiece.service.js';

export async function listPieces(req, res, next) {
  try {
    const pieces = await contentPieceService.listContentPieces(req.query, req.user);
    res.json({ data: pieces });
  } catch (err) {
    next(err);
  }
}

export async function recommendOwners(req, res, next) {
  try {
    const { pieceId, contentPieceId } = req.body;
    const targetId = pieceId || contentPieceId;
    if (!targetId) {
      return res.status(400).json({
        error: { code: 'ID_REQUIRED', message: 'pieceId or contentPieceId is required.' },
      });
    }
    const recommendations = await contentPieceService.recommendOwnersForPiece(
      targetId,
      req.user
    );
    res.json({ data: recommendations });
  } catch (err) {
    next(err);
  }
}

export async function assignStages(req, res, next) {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Array of stage assignments is required.' },
      });
    }
    const results = await contentPieceService.assignStages(assignments, req.user);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

export async function reschedulePiece(req, res, next) {
  try {
    const { postingDate, shiftUnstartedStages } = req.body;
    if (!postingDate) {
      return res.status(400).json({
        error: { code: 'DATE_REQUIRED', message: 'postingDate is required.' },
      });
    }
    const piece = await contentPieceService.rescheduleContentPiece(
      req.params.id,
      { postingDate, shiftUnstartedStages },
      req.user
    );
    res.json({ data: piece });
  } catch (err) {
    next(err);
  }
}

export async function skipStage(req, res, next) {
  try {
    const { isSkipped } = req.body;
    const stage = await contentPieceService.skipOrRestoreStage(
      req.params.id,
      req.params.stageKey,
      isSkipped !== false,
      req.user
    );
    res.json({ data: stage });
  } catch (err) {
    next(err);
  }
}

export async function reassignStage(req, res, next) {
  try {
    const { stageKey, newOwnerId, overrideReason } = req.body;
    const stage = await contentPieceService.reassignStage(
      req.params.id,
      { stageKey, newOwnerId, overrideReason },
      req.user
    );
    res.json({ success: true, data: stage });
  } catch (err) {
    next(err);
  }
}

export async function changeDeadline(req, res, next) {
  try {
    const { stageKey, newDeadline } = req.body;
    const stage = await contentPieceService.changeStageDeadline(
      req.params.id,
      { stageKey, newDeadline },
      req.user
    );
    res.json({ success: true, data: stage });
  } catch (err) {
    next(err);
  }
}

export async function getPiece(req, res, next) {
  try {
    const { getContentPieceForViewer } = await import('./contentPiece.read.js');
    res.json(await getContentPieceForViewer(req.params.id, req.user));
  } catch (err) {
    next(err);
  }
}
