import {
  DELIVERABLE_TYPE_KEYS,
  isPostableWorkType,
  normalizeWorkType,
  getPipelineForContent,
  STAGE_KEYS,
  VALIDATION_ERROR_CODES,
  VALIDATION_WARNING_CODES,
  DEFAULT_STAGE_HOURS,
} from '@mmp/shared';
import { Person } from '../people/model.js';
import { WorkItem } from '../workItems/model.js';

/**
 * Standard start-of-day for comparison
 */
function toStartOfDay(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Single authoritative validation function for Workflow V2
 * Used by autofill, row save, import preview and submit.
 *
 * @param {Object} params
 * @param {Object} params.plan Calendar plan or metadata (title, kind, periodStart, periodEnd)
 * @param {Array} params.rows List of row objects (draft or existing)
 * @param {Boolean} params.isSubmitting Set to true when submitting to Creative Head
 * @returns {Promise<{ isValid: boolean, errors: Array, warnings: Array }>}
 */
export async function validatePlanAndRows({ plan = {}, rows = [], isSubmitting = false }) {
  const errors = [];
  const warnings = [];

  const todayMidnight = toStartOfDay(new Date());

  // Zero rows submission validation
  if (isSubmitting && rows.length === 0) {
    errors.push({
      rowNumber: 0,
      field: 'rows',
      code: 'PLAN_EMPTY_ROWS',
      message: 'Add at least one row',
    });
  }

  // Rule 10: Individual Plan Row Violation
  if (isSubmitting && plan.kind === 'individual' && rows.length !== 1) {
    errors.push({
      rowNumber: 0,
      field: 'rows',
      code: VALIDATION_ERROR_CODES.INDIVIDUAL_PLAN_ROW_LIMIT,
      message: `An individual plan must contain exactly one row (found ${rows.length}).`,
    });
  }

  // Pre-fetch team members to validate stage owners and calculate workload warnings
  const activeMembers = await Person.find({
    role: { $in: ['team_member', 'sm_manager', 'admin'] },
    status: 'active',
  }).lean();
  const membersById = new Map(activeMembers.map((m) => [m._id.toString(), m]));

  // Track duplicates within the plan: dateKey + topic + type
  const rowSignatures = new Map();

  // Accumulate draft hours per person to detect workload saturation warnings
  const personAllocatedDraftHours = new Map();

  // Validate each row
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = row.rowNumber || idx + 1;
    const topic = (row.topic || '').trim();
    const rawType = (row.type || row.contentType || '').trim();

    // 1. Missing Required Fields
    if (!row.postingDate) {
      errors.push({
        rowNumber: rowNum,
        topic,
        field: 'postingDate',
        code: VALIDATION_ERROR_CODES.MISSING_REQUIRED_FIELDS,
        message: 'Posting Date (F) is required.',
      });
    }

    if (!topic) {
      errors.push({
        rowNumber: rowNum,
        topic: 'Untitled',
        field: 'topic',
        code: VALIDATION_ERROR_CODES.MISSING_REQUIRED_FIELDS,
        message: 'Topic is required.',
      });
    }

    if (!rawType) {
      errors.push({
        rowNumber: rowNum,
        topic,
        field: 'type',
        code: VALIDATION_ERROR_CODES.MISSING_REQUIRED_FIELDS,
        message: 'Deliverable type is required.',
      });
    }

    const briefContent =
      (row.brief && String(row.brief).trim()) ||
      (row.remarks && String(row.remarks).trim()) ||
      (row.contentLink && String(row.contentLink).trim()) ||
      (row.topic ? `Brief for ${row.topic}` : '');

    if (isSubmitting && !briefContent) {
      errors.push({
        rowNumber: rowNum,
        topic,
        field: 'brief',
        code: VALIDATION_ERROR_CODES.MISSING_REQUIRED_FIELDS,
        message: 'Brief is required before submitting for review.',
      });
    }

    // 2. Unknown Type
    const normType = normalizeWorkType(rawType);
    const matchedType = DELIVERABLE_TYPE_KEYS.find(
      (t) => t.toLowerCase() === normType.toLowerCase() || t.toLowerCase() === rawType.toLowerCase()
    );
    if (rawType && !matchedType) {
      errors.push({
        rowNumber: rowNum,
        topic,
        field: 'type',
        code: VALIDATION_ERROR_CODES.UNKNOWN_TYPE,
        message: `Type "${rawType}" is not one of the 15 supported deliverable types.`,
      });
    }

    const deliverableType = matchedType || normType || rawType;
    const postingDate = row.postingDate ? new Date(row.postingDate) : null;
    const postingMidnight = postingDate ? toStartOfDay(postingDate) : null;

    // 3. Past Dates (Posting date)
    if (postingMidnight && postingMidnight < todayMidnight) {
      errors.push({
        rowNumber: rowNum,
        topic,
        field: 'postingDate',
        code: VALIDATION_ERROR_CODES.PAST_DATE,
        message: `Posting date ${postingMidnight.toISOString().slice(0, 10)} is in the past.`,
      });
    }

    // Month Mismatch Warning
    if (postingMidnight && plan.periodStart && plan.periodEnd) {
      const pStartMidnight = toStartOfDay(new Date(plan.periodStart));
      const pEndMidnight = toStartOfDay(new Date(plan.periodEnd));
      if (postingMidnight < pStartMidnight || postingMidnight > pEndMidnight) {
        warnings.push({
          rowNumber: rowNum,
          topic,
          field: 'postingDate',
          code: VALIDATION_WARNING_CODES.MONTH_MISMATCH,
          message: `Posting date is outside the plan period (${pStartMidnight.toISOString().slice(0, 7)}).`,
        });
      }
    }

    // Duplicate Row check
    if (postingMidnight && topic && deliverableType) {
      const sig = `${postingMidnight.toISOString().slice(0, 10)}|${topic.toLowerCase()}|${deliverableType.toLowerCase()}`;
      if (rowSignatures.has(sig)) {
        errors.push({
          rowNumber: rowNum,
          topic,
          field: 'topic',
          code: VALIDATION_ERROR_CODES.DUPLICATE_ROW,
          message: `Duplicate row with same posting date, topic, and type as Row ${rowSignatures.get(sig)}.`,
        });
      } else {
        rowSignatures.set(sig, rowNum);
      }
    }

    // 6. Missing Source Video link (Reel without shoot)
    const isReel = deliverableType.toLowerCase() === 'reel';
    const needsShoot = Boolean(row.needsShoot);
    if (isReel && !needsShoot) {
      const srcLink = (row.sourceVideoLink || '').trim();
      if (!srcLink) {
        errors.push({
          rowNumber: rowNum,
          topic,
          field: 'sourceVideoLink',
          code: VALIDATION_ERROR_CODES.MISSING_SOURCE_VIDEO,
          message: 'Source video link is required when Reel does not need a shoot.',
        });
      }
    }

    // 7. Missing Posting Owner for Postable Types
    const isPostable = isPostableWorkType(deliverableType);
    if (isPostable) {
      const postingOwnerId = row.postingOwnerId ? String(row.postingOwnerId).trim() : '';
      if (!postingOwnerId) {
        errors.push({
          rowNumber: rowNum,
          topic,
          field: 'postingOwnerId',
          code: VALIDATION_ERROR_CODES.MISSING_POSTING_OWNER,
          message: `Posting owner is required for postable type "${deliverableType}".`,
        });
      }
    }

    // Validate Stages in stagePlan
    const stages = Array.isArray(row.stagePlan) ? row.stagePlan : [];
    let prevDueDate = null;
    let lastCreationStageDate = null;

    for (let sIdx = 0; sIdx < stages.length; sIdx++) {
      const st = stages[sIdx];
      const stageDueDate = st.dueDate ? new Date(st.dueDate) : null;
      const stageMidnight = stageDueDate ? toStartOfDay(stageDueDate) : null;

      // Past Stage Date
      if (stageMidnight && stageMidnight < todayMidnight) {
        errors.push({
          rowNumber: rowNum,
          topic,
          field: `stages.${st.stageKey}.dueDate`,
          code: VALIDATION_ERROR_CODES.PAST_DATE,
          message: `${st.stageKey} deadline ${stageMidnight.toISOString().slice(0, 10)} is in the past.`,
        });
      }

      // 4. Deadline After F
      if (stageMidnight && postingMidnight && stageMidnight > postingMidnight) {
        errors.push({
          rowNumber: rowNum,
          topic,
          field: `stages.${st.stageKey}.dueDate`,
          code: VALIDATION_ERROR_CODES.DEADLINE_AFTER_POSTING,
          message: `${st.stageKey} deadline is scheduled after posting date F.`,
        });
      }

      // 5. Out-of-Order Deadlines (Sequential stages)
      if (stageMidnight && prevDueDate && stageMidnight < prevDueDate) {
        errors.push({
          rowNumber: rowNum,
          topic,
          field: `stages.${st.stageKey}.dueDate`,
          code: VALIDATION_ERROR_CODES.OUT_OF_ORDER_DEADLINES,
          message: `${st.stageKey} deadline must be later than or equal to preceding stage deadline.`,
        });
      }
      if (stageMidnight) {
        prevDueDate = stageMidnight;
      }

      // Track last creation stage (before Post)
      if (st.stageKey !== 'Post') {
        lastCreationStageDate = stageMidnight;
      }

      // 8. Invalid Stage Owner
      if (st.ownerId) {
        const ownerIdStr = String(st.ownerId);
        const member = membersById.get(ownerIdStr);
        if (!member) {
          errors.push({
            rowNumber: rowNum,
            topic,
            field: `stages.${st.stageKey}.ownerId`,
            code: VALIDATION_ERROR_CODES.INVALID_STAGE_OWNER,
            message: `Assigned owner for ${st.stageKey} is not an active team member.`,
          });
        } else {
          // Check stage preference for creation stages (Script, Shoot, Edit, Design, Content)
          if (st.stageKey !== 'Post') {
            const prefs = member.workPreferences || [];
            if (!prefs.includes(st.stageKey)) {
              errors.push({
                rowNumber: rowNum,
                topic,
                field: `stages.${st.stageKey}.ownerId`,
                code: VALIDATION_ERROR_CODES.INVALID_STAGE_OWNER,
                message: `${member.name} does not hold "${st.stageKey}" in work preferences.`,
              });
            }
          }

          // Accumulate hours for workload saturation warning
          const stageHours = DEFAULT_STAGE_HOURS[st.stageKey] || 4;
          const currentHours = personAllocatedDraftHours.get(ownerIdStr) || 0;
          personAllocatedDraftHours.set(ownerIdStr, currentHours + stageHours);
        }
      }
    }

    // Warning 1: Tight Creation Buffer
    if (postingMidnight && lastCreationStageDate) {
      const bufferDays = Math.round(
        (postingMidnight.getTime() - lastCreationStageDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (bufferDays < 1) {
        warnings.push({
          rowNumber: rowNum,
          topic,
          field: 'stages',
          code: VALIDATION_WARNING_CODES.TIGHT_CREATION_BUFFER,
          message: `Tight buffer: final creation stage is due on or after F-1 (${bufferDays} days before posting).`,
        });
      }
    }
  }

  // Warning 2: Workload Saturation (> 85%)
  for (const [personId, draftHours] of personAllocatedDraftHours.entries()) {
    const member = membersById.get(personId);
    if (member) {
      const capacity = member.weeklyCapacityHours || 40;
      // Get existing open work hours
      const openItems = await WorkItem.find({
        ownerId: member._id,
        status: { $in: ['Not Started', 'In Progress', 'Feedback'] },
      }).select('estimatedEffortHrs').lean();
      const existingHours = openItems.reduce((acc, it) => acc + (it.estimatedEffortHrs || 4), 0);
      const totalHours = existingHours + draftHours;
      const totalPct = capacity > 0 ? Math.round((totalHours / capacity) * 100) : 0;

      if (totalPct >= 85) {
        warnings.push({
          rowNumber: 0,
          topic: 'Team Load',
          field: 'stagePlan.ownerId',
          code: VALIDATION_WARNING_CODES.WORKLOAD_SATURATION,
          message: `${member.name} will reach ${totalPct}% workload with these assignments (>= 85%).`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
