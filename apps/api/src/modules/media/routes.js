import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  mediaItemCreateSchema,
  mediaItemUpdateSchema,
  mediaMessageCreateSchema,
  mediaItemReviewSchema,
  shootStepFinishReviewSchema,
  reorderClipsSchema,
} from '@mmp/shared';
import * as mediaController from './controller.js';
import { clipParam } from '../workItems/access.js';
import { refuseWhenWorkspacesLocked as locked } from '../../lib/workspaceLock.js';

// Router for clip-specific actions (/api/clips/...)
// `locked` refuses clip uploads and edits while the workspaces are locked; clip review stays open.
export const clipsRouter = Router();
clipsRouter.use(authenticate);
clipsRouter.param('id', clipParam);

clipsRouter.patch('/:id', locked, validate(mediaItemUpdateSchema), mediaController.updateClipHandler);
clipsRouter.post('/:id/replace', locked, mediaController.replaceClipHandler);
clipsRouter.delete('/:id', locked, mediaController.deleteClipHandler);
clipsRouter.post('/:id/review', validate(mediaItemReviewSchema), mediaController.reviewClipHandler);

// Thread messages
clipsRouter.get('/:id/messages', mediaController.listMessagesHandler);
clipsRouter.post('/:id/messages', validate(mediaMessageCreateSchema), mediaController.postMessageHandler);
clipsRouter.post('/:id/messages/seen', mediaController.markMessagesSeenHandler);
clipsRouter.patch('/:id/messages/:messageId/toggle-done', mediaController.toggleMessageDoneHandler);

// Helper to attach clip routes directly to workItemRouter
export function attachWorkItemMediaRoutes(workItemRouter) {
  workItemRouter.post('/:stageItemId/clips', locked, validate(mediaItemCreateSchema), mediaController.createClipHandler);
  workItemRouter.get('/:stageItemId/clips', mediaController.listClipsHandler);
  workItemRouter.put('/:stageItemId/clips/reorder', locked, validate(reorderClipsSchema), mediaController.reorderClipsHandler);
  workItemRouter.post('/:stageItemId/submit-clips', locked, mediaController.submitClipsHandler);
  workItemRouter.post(
    '/:stageItemId/shoot-review',
    validate(shootStepFinishReviewSchema),
    mediaController.finishShootReviewHandler
  );
}

export default clipsRouter;
