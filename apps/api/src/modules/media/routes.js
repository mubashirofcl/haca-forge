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

// Router for clip-specific actions (/api/clips/...)
export const clipsRouter = Router();
clipsRouter.use(authenticate);
clipsRouter.param('id', clipParam);

clipsRouter.patch('/:id', validate(mediaItemUpdateSchema), mediaController.updateClipHandler);
clipsRouter.post('/:id/replace', mediaController.replaceClipHandler);
clipsRouter.delete('/:id', mediaController.deleteClipHandler);
clipsRouter.post('/:id/review', validate(mediaItemReviewSchema), mediaController.reviewClipHandler);

// Thread messages
clipsRouter.get('/:id/messages', mediaController.listMessagesHandler);
clipsRouter.post('/:id/messages', validate(mediaMessageCreateSchema), mediaController.postMessageHandler);
clipsRouter.post('/:id/messages/seen', mediaController.markMessagesSeenHandler);
clipsRouter.patch('/:id/messages/:messageId/toggle-done', mediaController.toggleMessageDoneHandler);

// Helper to attach clip routes directly to workItemRouter
export function attachWorkItemMediaRoutes(workItemRouter) {
  workItemRouter.post('/:stageItemId/clips', validate(mediaItemCreateSchema), mediaController.createClipHandler);
  workItemRouter.get('/:stageItemId/clips', mediaController.listClipsHandler);
  workItemRouter.put('/:stageItemId/clips/reorder', validate(reorderClipsSchema), mediaController.reorderClipsHandler);
  workItemRouter.post('/:stageItemId/submit-clips', mediaController.submitClipsHandler);
  workItemRouter.post(
    '/:stageItemId/shoot-review',
    validate(shootStepFinishReviewSchema),
    mediaController.finishShootReviewHandler
  );
}

export default clipsRouter;
