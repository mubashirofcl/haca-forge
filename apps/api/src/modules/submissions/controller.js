import { isTeamMember, requireParticipant } from '../workItems/access.js';
import { visibleVersionIdsInPiece } from '../workItems/viewerRules.js';
import * as submissionService from './service.js';
import { isDriveLink } from '../uploads/outputUrls.js';

export async function getDraftHandler(req, res, next) {
  try {
    const draft = await submissionService.getDraft(req.params.id, req.user);
    res.json({ data: draft });
  } catch (err) {
    next(err);
  }
}

export async function saveDraftHandler(req, res, next) {
  try {
    const draft = await submissionService.saveDraft(req.params.id, req.body, req.user);
    res.json({ data: draft });
  } catch (err) {
    next(err);
  }
}

export async function submitHandler(req, res, next) {
  try {
    const submission = await submissionService.submitForApproval(req.params.id, req.body, req.user);
    res.status(201).json({ data: submission });
  } catch (err) {
    next(err);
  }
}

export async function submitLinkHandler(req, res, next) {
  try {
    const submission = await submissionService.submitStepLinks(req.params.id, req.body, req.user);
    res.status(201).json({ data: submission });
  } catch (err) {
    next(err);
  }
}

export async function listVersionsHandler(req, res, next) {
  try {
    const versions = await submissionService.listSubmissions(req.params.id, req.user);
    res.json({ data: versions });
  } catch (err) {
    next(err);
  }
}

export async function getSubmissionHandler(req, res, next) {
  try {
    const submission = await submissionService.getSubmissionById(req.params.id, req.user);
    res.json({ data: submission });
  } catch (err) {
    next(err);
  }
}

export async function addCommentHandler(req, res, next) {
  try {
    const comment = await submissionService.addComment(req.params.id, req.body, req.user);
    res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
}

export async function listCommentsHandler(req, res, next) {
  try {
    const comments = await submissionService.listComments(req.params.id, req.user);
    res.json({ data: comments });
  } catch (err) {
    next(err);
  }
}

export async function resolveCommentHandler(req, res, next) {
  try {
    const commentId = req.params.commentId || req.params.id;
    const comment = await submissionService.resolveComment(commentId, req.user);
    res.json({ data: comment });
  } catch (err) {
    next(err);
  }
}

export async function approveHandler(req, res, next) {
  try {
    const result = await submissionService.approveWithRating(req.params.id, req.body, req.user);
    res.json({ data: result, ...result });
  } catch (err) {
    next(err);
  }
}

export async function requestRevisionHandler(req, res, next) {
  try {
    const result = await submissionService.requestRevision(req.params.id, req.body, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function markRatingSeenHandler(req, res, next) {
  try {
    const rating = await submissionService.markRatingSeen(req.params.id, req.user);
    res.json({ data: rating });
  } catch (err) {
    next(err);
  }
}

export async function editRatingHandler(req, res, next) {
  try {
    const rating = await submissionService.editRating(req.params.id, req.body, req.user);
    res.json({ data: rating });
  } catch (err) {
    next(err);
  }
}

export async function reviewQueueHandler(req, res, next) {
  try {
    const queue = await submissionService.getReviewQueue(req.user);
    res.json({ data: queue });
  } catch (err) {
    next(err);
  }
}

export async function ratingsSummaryHandler(req, res, next) {
  try {
    const personId = req.params.personId || req.params.id;
    const summary = await submissionService.getRatingsSummary(personId, req.user);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
}

export async function claimEditorLockHandler(req, res, next) {
  try {
    const lock = await submissionService.claimEditorLock(req.params.id, req.user);
    res.json({ data: lock });
  } catch (err) {
    next(err);
  }
}

export async function releaseEditorLockHandler(req, res, next) {
  try {
    const result = await submissionService.releaseEditorLock(req.params.id, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getEditorLockHandler(req, res, next) {
  try {
    const lock = await submissionService.getEditorLock(req.params.id, req.user);
    res.json({ data: lock });
  } catch (err) {
    next(err);
  }
}

export async function listWorkItemCommentsHandler(req, res, next) {
  try {
    const comments = await submissionService.listWorkItemComments(req.params.id, req.user);
    res.json({ data: comments });
  } catch (err) {
    next(err);
  }
}

export async function addWorkItemCommentHandler(req, res, next) {
  try {
    const comment = await submissionService.addWorkItemComment(req.params.id, req.body, req.user);
    res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
}

export async function listSubmissionsQueryHandler(req, res, next) {
  try {
    const { workItemId, contentPieceId } = req.query;
    if (workItemId) {
      if (isTeamMember(req.user)) await requireParticipant(workItemId, req.user);
      const versions = await submissionService.listSubmissions(workItemId, req.user);
      return res.json(versions);
    }
    if (contentPieceId) {
      const { Submission } = await import('./model.js');
      const pieceFilter = { contentPieceId, version: { $gt: 0 } };
      if (isTeamMember(req.user)) {
        const { ownStepIds, ids } = await visibleVersionIdsInPiece(contentPieceId, req.user);
        if (ownStepIds.length === 0) return res.json([]);
        pieceFilter.$or = [{ workItemId: { $in: ownStepIds } }, { _id: { $in: ids } }];
      }
      const versions = await Submission.find(pieceFilter)
        .sort({ version: -1 })
        .populate('submittedById', 'name email role jobRole')
        .populate('reviewedById', 'name email role');
      return res.json(versions);
    }
    return res.json([]);
  } catch (err) {
    next(err);
  }
}

export async function createOrSubmitHandler(req, res, next) {
  try {
    if (isTeamMember(req.user)) await requireParticipant(req.body?.workItemId, req.user);
    const {
      workItemId,
      contentPieceId,
      fileUrl,
      videoUrls,
      contentUrl,
      notes,
      metadata = {},
      submit = true,
      kind,
      files: explicitFiles,
      linkUrl: explicitLinkUrl,
    } = req.body;

    if (!workItemId) {
      const err = new Error('workItemId is required');
      err.statusCode = 400;
      throw err;
    }

    // Every output item (an uploaded file or a Drive link) goes in files[]. A design's
    // slides arrive as metadata.carouselSlides and are all kept, not only the first.
    let files = explicitFiles || [];
    if (!files.length) {
      if (videoUrls && Array.isArray(videoUrls) && videoUrls.length > 0) {
        files = videoUrls.filter(Boolean).map((url, i) => ({
          name: `clip_${i + 1}.mp4`,
          url,
        }));
      } else if (Array.isArray(metadata?.carouselSlides) && metadata.carouselSlides.length > 0) {
        files = metadata.carouselSlides.filter(Boolean).map((url, i) => ({ name: `slide_${i + 1}`, url }));
      } else if (fileUrl) {
        files = [{ name: 'deliverable', url: fileUrl }];
      }
    }

    // linkUrl is a separate Drive link only; a local file path is never copied into it.
    const candidateLink = explicitLinkUrl || contentUrl || '';
    const linkUrl = isDriveLink(candidateLink) && !files.some((f) => f.url === candidateLink) ? candidateLink : (explicitLinkUrl || '');

    const submission = await submissionService.submitForApproval(
      workItemId,
      {
        kind,
        files,
        linkUrl,
        notes,
        autoStart: true,
        metadata: {
          ...metadata,
          videoUrls,
          fileUrl,
          contentUrl,
        },
      },
      req.user
    );

    res.status(201).json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
}


