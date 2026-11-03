import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  submissionDraftSaveSchema,
  submissionSubmitSchema,
  submissionCommentCreateSchema,
  submissionReviewApproveSchema,
  submissionReviewRevisionSchema,
  ratingEditSchema,
} from '@mmp/shared';
import * as submissionController from './controller.js';

const router = Router();

router.use(authenticate);

// 1. Review Queue (Oldest first)
router.get('/review-queue', submissionController.reviewQueueHandler);
router.get('/queue', submissionController.reviewQueueHandler);

// 2. Ratings Endpoints
router.post('/ratings/:id/seen', submissionController.markRatingSeenHandler);
router.patch('/ratings/:id', validate(ratingEditSchema), submissionController.editRatingHandler);
router.get('/ratings/summary/:personId', submissionController.ratingsSummaryHandler);

// 3. Comments Resolution
router.patch('/comments/:id/resolve', submissionController.resolveCommentHandler);
router.post('/comments/:id/resolve', submissionController.resolveCommentHandler);

// 4. Submissions Root (Query by workItemId / Create or Submit)
router.get('/', submissionController.listSubmissionsQueryHandler);
router.post('/', submissionController.createOrSubmitHandler);

// 5. Submission Operations
router.get('/:id', submissionController.getSubmissionHandler);
router.post('/:id/comments', validate(submissionCommentCreateSchema), submissionController.addCommentHandler);
router.get('/:id/comments', submissionController.listCommentsHandler);
router.post('/:id/approve', validate(submissionReviewApproveSchema), submissionController.approveHandler);
router.post('/:id/request-revision', validate(submissionReviewRevisionSchema), submissionController.requestRevisionHandler);

export default router;

// WorkItem specific sub-routes helper to mount onto work-items
export function attachWorkItemSubmissionRoutes(workItemRouter) {
  workItemRouter.get('/:id/draft', submissionController.getDraftHandler);
  workItemRouter.put('/:id/draft', validate(submissionDraftSaveSchema), submissionController.saveDraftHandler);
  workItemRouter.post('/:id/submit', validate(submissionSubmitSchema), submissionController.submitHandler);
  workItemRouter.get('/:id/submissions', submissionController.listVersionsHandler);
  workItemRouter.post('/:id/editor-lock', submissionController.claimEditorLockHandler);
  workItemRouter.delete('/:id/editor-lock', submissionController.releaseEditorLockHandler);
  workItemRouter.get('/:id/editor-lock', submissionController.getEditorLockHandler);
  workItemRouter.get('/:id/comments', submissionController.listWorkItemCommentsHandler);
  workItemRouter.post('/:id/comments', validate(submissionCommentCreateSchema), submissionController.addWorkItemCommentHandler);
  workItemRouter.patch('/:id/comments/:commentId/resolve', submissionController.resolveCommentHandler);
  workItemRouter.post('/:id/comments/:commentId/resolve', submissionController.resolveCommentHandler);
}

