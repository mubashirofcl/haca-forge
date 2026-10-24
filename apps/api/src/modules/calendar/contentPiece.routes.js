import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/requirePermission.js';
import * as contentPieceController from './contentPiece.controller.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission('calendar.plan', 'calendar.approve', 'portal.view'),
  contentPieceController.listPieces
);

router.post(
  '/recommend-owners',
  requireAnyPermission('calendar.plan', 'assignment.override'),
  contentPieceController.recommendOwners
);

router.post(
  '/assign',
  requirePermission('assignment.override'),
  contentPieceController.assignStages
);

router.post(
  '/confirm-assignments',
  requirePermission('assignment.override'),
  contentPieceController.assignStages
);

router.patch(
  '/:id/reschedule',
  requirePermission('calendar.plan'),
  contentPieceController.reschedulePiece
);

router.patch(
  '/:id/stages/:stageKey/skip',
  requirePermission('calendar.plan'),
  contentPieceController.skipStage
);

export default router;
