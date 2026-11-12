import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  submissionDraftSaveSchema,
  submissionSubmitSchema,
  stepLinkSubmitSchema,
  submissionCommentCreateSchema,
  submissionReviewApproveSchema,
  submissionReviewRevisionSchema,
  ratingEditSchema,
} from '@mmp/shared';
import * as submissionController from './controller.js';

import { refuseWhenWorkspacesLocked } from '../../lib/workspaceLock.js';
import { requireCommentAccess, requireRatingAccess, requireSubmissionAccess } from '../workItems/access.js';

const router = Router();

router.use(authenticate);

// 1. Review Queue (Oldest first)
router.get('/review-queue', submissionController.reviewQueueHandler);
router.get('/queue', submissionController.reviewQueueHandler);

// 2. Ratings Endpoints
// :id means a different object on these routes, so each has its own explicit check.
router.post('/ratings/:id/seen', requireRatingAccess, submissionController.markRatingSeenHandler);
router.patch('/ratings/:id', requireRatingAccess, validate(ratingEditSchema), submissionController.editRatingHandler);
router.get('/ratings/summary/:personId', submissionController.ratingsSummaryHandler);

// 3. Comments Resolution
router.patch('/comments/:id/resolve', requireCommentAccess, submissionController.resolveCommentHandler);
router.post('/comments/:id/resolve', requireCommentAccess, submissionController.resolveCommentHandler);

// 4. Submissions Root (Query by workItemId / Create or Submit)
router.get('/', submissionController.listSubmissionsQueryHandler);
router.post('/', submissionController.createOrSubmitHandler);

// 5. Submission Operations
router.get('/:id', requireSubmissionAccess, submissionController.getSubmissionHandler);
router.post('/:id/comments', requireSubmissionAccess, validate(submissionCommentCreateSchema), submissionController.addCommentHandler);
router.get('/:id/comments', requireSubmissionAccess, submissionController.listCommentsHandler);
router.post('/:id/approve', requireSubmissionAccess, validate(submissionReviewApproveSchema), submissionController.approveHandler);
router.post('/:id/request-revision', requireSubmissionAccess, validate(submissionReviewRevisionSchema), submissionController.requestRevisionHandler);

export default router;

// WorkItem specific sub-routes helper to mount onto work-items
export function attachWorkItemSubmissionRoutes(workItemRouter) {
  workItemRouter.get('/:id/draft', submissionController.getDraftHandler);
  workItemRouter.put('/:id/draft', refuseWhenWorkspacesLocked, validate(submissionDraftSaveSchema), submissionController.saveDraftHandler);
  workItemRouter.post('/:id/submit', validate(submissionSubmitSchema), submissionController.submitHandler);
  // Submit a step with Google Drive links (the step owner, from My Work and Work Detail).
  workItemRouter.post('/:id/submit-link', validate(stepLinkSubmitSchema), submissionController.submitLinkHandler);
  workItemRouter.get('/:id/submissions', submissionController.listVersionsHandler);
  workItemRouter.post('/:id/editor-lock', submissionController.claimEditorLockHandler);
  workItemRouter.delete('/:id/editor-lock', submissionController.releaseEditorLockHandler);
  workItemRouter.get('/:id/editor-lock', submissionController.getEditorLockHandler);
  workItemRouter.get('/:id/comments', submissionController.listWorkItemCommentsHandler);
  workItemRouter.post('/:id/comments', validate(submissionCommentCreateSchema), submissionController.addWorkItemCommentHandler);
  workItemRouter.patch('/:id/comments/:commentId/resolve', submissionController.resolveCommentHandler);
  workItemRouter.post('/:id/comments/:commentId/resolve', submissionController.resolveCommentHandler);
}

