import { WorkItem } from '../workItems/model.js';
import { FeedbackEntry } from '../feedback/model.js';
import { Person } from './model.js';
import { resolveScope } from '../../lib/scope.js';
import { logger } from '../../lib/logger.js';

/**
 * Performance Dimensions Calculation Service (Scope Reset R1)
 * Computes the 4 canonical performance dimensions (25% weight each):
 * 1. Output (25%): Work completed, deliverable volume, throughput
 * 2. Efficiency (25%): Avg completion time, deadline adherence %, revision rate
 * 3. Quality (25%): Approval rate, rejection rate, re-edit rate
 * 4. Collaboration (25%): Feedback response time, blocker resolution time, dependency delays caused
 */

export async function calculatePersonPerformance(personId, filters = {}, actor = null) {
  // 1. Verify existence & actor scoping
  const person = await Person.findById(personId)
    .populate('departmentId', 'name code')
    .lean();

  if (!person) {
    const error = new Error('Person not found');
    error.code = 'PERSON_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  if (actor) {
    const scope = await resolveScope(actor, filters);
    if (!scope.canAccessPerson(person._id)) {
      const error = new Error('Access denied: person is outside your team scope');
      error.code = 'FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
  }

  // 2. Query work items owned by this person
  const itemQuery = { ownerId: person._id };
  if (filters.month) {
    const start = new Date(`${filters.month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    itemQuery.createdAt = { $gte: start, $lt: end };
  }

  const workItems = await WorkItem.find(itemQuery).lean();
  const totalWorkItems = workItems.length;

  const completedItems = workItems.filter((w) =>
    ['Approved', 'Published', 'Completed'].includes(w.status)
  );
  const inProgressItems = workItems.filter((w) =>
    ['In Progress', 'Feedback Requested', 'Blocked'].includes(w.status)
  );

  // -------------------------------------------------------------
  // Dimension 1: Output
  // -------------------------------------------------------------
  const completedCount = completedItems.length;
  const inProgressCount = inProgressItems.length;
  const creativeOutputVolume = completedItems.filter((w) =>
    ['Reel', 'Video Ad', 'YouTube Short/Video', 'Ad Creative', 'Carousel', 'Post', 'Landing Page'].includes(
      w.workType
    )
  ).length;

  // -------------------------------------------------------------
  // Dimension 2: Efficiency
  // -------------------------------------------------------------
  // Average completion time (hours from createdAt to completion)
  let totalCompletionHours = 0;
  let onTimeCount = 0;
  let itemsWithRevisions = 0;

  completedItems.forEach((w) => {
    const created = new Date(w.createdAt).getTime();
    const finished = new Date(w.publishedAt || w.completedAt || w.updatedAt).getTime();
    const hours = Math.max((finished - created) / 3600000, 0.5);
    totalCompletionHours += hours;

    if (w.deadline) {
      const deadline = new Date(w.deadline).getTime();
      if (finished <= deadline) {
        onTimeCount += 1;
      }
    } else {
      onTimeCount += 1; // Default to on-time if no deadline set
    }

    if ((w.revisionCount || 0) > 0) {
      itemsWithRevisions += 1;
    }
  });

  const avgCompletionTimeHrs = completedCount > 0
    ? Number((totalCompletionHours / completedCount).toFixed(1))
    : 0;

  const deadlineAdherencePct = completedCount > 0
    ? Math.round((onTimeCount / completedCount) * 100)
    : 100;

  const revisionRatePct = completedCount > 0
    ? Math.round((itemsWithRevisions / completedCount) * 100)
    : 0;

  // -------------------------------------------------------------
  // Dimension 3: Quality
  // -------------------------------------------------------------
  // First-time approval rate: completed items with 0 revisions
  const firstTimeApprovedCount = completedItems.filter(
    (w) => (w.revisionCount || 0) === 0
  ).length;

  const approvalRatePct = completedCount > 0
    ? Math.round((firstTimeApprovedCount / completedCount) * 100)
    : 100;

  // Multiple re-edit rate: items with >= 2 revisions
  const multipleReEditCount = completedItems.filter(
    (w) => (w.revisionCount || 0) >= 2
  ).length;

  const reEditRatePct = completedCount > 0
    ? Math.round((multipleReEditCount / completedCount) * 100)
    : 0;

  const rejectionRatePct = completedCount > 0
    ? Math.max(0, 100 - approvalRatePct)
    : 0;

  // Overall Quality Index (1-10 scale)
  const qualityScore = Number(
    (Math.max(1, Math.min(10, (approvalRatePct / 100) * 8 + (1 - reEditRatePct / 100) * 2))).toFixed(1)
  );

  // -------------------------------------------------------------
  // Dimension 4: Collaboration
  // -------------------------------------------------------------
  // Query blocker delays caused (where this person was dependencyOwnerId)
  const dependencyBlockersCaused = await WorkItem.find({
    'blocker.dependencyOwnerId': person._id,
  }).lean();

  const dependencyDelaysCausedCount = dependencyBlockersCaused.length;

  // Average blocker resolution time for items owned by this person
  let totalBlockerResolutionHrs = 0;
  let resolvedBlockersCount = 0;

  workItems.forEach((w) => {
    if (w.blocker?.blockedSince && w.blocker?.resolvedAt) {
      const start = new Date(w.blocker.blockedSince).getTime();
      const end = new Date(w.blocker.resolvedAt).getTime();
      const hrs = Math.max((end - start) / 3600000, 0.2);
      totalBlockerResolutionHrs += hrs;
      resolvedBlockersCount += 1;
    }
  });

  const avgBlockerResolutionTimeHrs = resolvedBlockersCount > 0
    ? Number((totalBlockerResolutionHrs / resolvedBlockersCount).toFixed(1))
    : 0;

  // Average feedback turnaround (if reviewer)
  const feedbackReviews = await FeedbackEntry.find({ fromPersonId: person._id }).lean();
  let totalFeedbackHrs = 0;
  let resolvedFeedbackCount = 0;

  feedbackReviews.forEach((fb) => {
    if (fb.createdAt && fb.resolvedAt) {
      const hrs = Math.max(
        (new Date(fb.resolvedAt).getTime() - new Date(fb.createdAt).getTime()) / 3600000,
        0.5
      );
      totalFeedbackHrs += hrs;
      resolvedFeedbackCount += 1;
    }
  });

  const avgFeedbackResponseTimeHrs = resolvedFeedbackCount > 0
    ? Number((totalFeedbackHrs / resolvedFeedbackCount).toFixed(1))
    : 3.2; // Baseline SLA average

  // Collaboration index (0 - 100)
  const collaborationScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          dependencyDelaysCausedCount * 5 -
          (avgBlockerResolutionTimeHrs > 24 ? 15 : avgBlockerResolutionTimeHrs > 8 ? 5 : 0)
      )
    )
  );

  // -------------------------------------------------------------
  // Composite Performance Index (0 - 100)
  // Weights: Output 25%, Efficiency 25%, Quality 25%, Collaboration 25%
  // -------------------------------------------------------------
  const outputSubScore = Math.min(100, completedCount * 10);
  const efficiencySubScore = Math.round(
    deadlineAdherencePct * 0.7 + (100 - Math.min(100, revisionRatePct)) * 0.3
  );
  const qualitySubScore = Math.round(approvalRatePct * 0.8 + (100 - reEditRatePct) * 0.2);
  const collaborationSubScore = collaborationScore;

  const overallScore = Math.round(
    outputSubScore * 0.25 +
      efficiencySubScore * 0.25 +
      qualitySubScore * 0.25 +
      collaborationSubScore * 0.25
  );

  return {
    person: {
      _id: person._id,
      name: person.name,
      email: person.email,
      role: person.role,
      jobRole: person.jobRole,
      department: person.departmentId,
    },
    overallScore,
    dimensions: {
      output: {
        score: outputSubScore,
        workCompleted: completedCount,
        inProgress: inProgressCount,
        totalWorkItems,
        creativeOutputVolume,
      },
      efficiency: {
        score: efficiencySubScore,
        avgCompletionTimeHrs,
        deadlineAdherencePct,
        revisionRatePct,
        completedOnTime: onTimeCount,
      },
      quality: {
        score: qualitySubScore,
        qualityIndex: qualityScore,
        approvalRatePct,
        rejectionRatePct,
        reEditRatePct,
        firstTimeApproved: firstTimeApprovedCount,
      },
      collaboration: {
        score: collaborationSubScore,
        avgFeedbackResponseTimeHrs,
        avgBlockerResolutionTimeHrs,
        dependencyDelaysCausedCount,
      },
    },
  };
}

export async function calculateTeamPerformance(filters = {}, actor = null) {
  const scope = await resolveScope(actor, filters);
  if (!scope.isAllowed) {
    return { overallTeamScore: 0, members: [] };
  }

  const query = { status: { $ne: 'suspended' }, role: { $nin: ['admin', 'executive'] } };
  if (scope.allowedPersonIds !== null) {
    query._id = { $in: scope.allowedPersonIds };
  }
  if (filters.departmentId && filters.departmentId !== 'all') {
    query.departmentId = filters.departmentId;
  }

  const team = await Person.find(query).select('_id name role jobRole departmentId').lean();

  const memberResults = await Promise.all(
    team.map((m) =>
      calculatePersonPerformance(m._id, filters, actor).catch((err) => {
        logger.warn({ err: err.message, personId: m._id }, 'Failed to calc member performance');
        return null;
      })
    )
  );

  const validResults = memberResults.filter(Boolean);

  const avgScore = validResults.length > 0
    ? Math.round(validResults.reduce((sum, r) => sum + r.overallScore, 0) / validResults.length)
    : 0;

  return {
    overallTeamScore: avgScore,
    totalMembersEvaluated: validResults.length,
    members: validResults,
  };
}
