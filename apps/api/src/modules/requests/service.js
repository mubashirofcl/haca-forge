import { Request } from './model.js';
import { getNextSequenceId } from './counter.model.js';
import { RequestType } from '../masterData/models.js';
import { User } from '../users/model.js';
import { detectDuplicateRequests } from './duplicate.service.js';
import { transitionStatus } from '../common/transition.service.js';
import { createNotification } from '../notifications/service.js';
import { StatusHistory } from '../statusHistory/model.js';
import { eventBus, EVENTS } from '../../lib/events.js';

/**
 * Validates dynamic fields against the RequestType schema definition
 */
function validateDynamicFields(schema, values) {
  const errors = {};

  for (const field of schema) {
    const val = values?.[field.fieldKey];

    if (field.required) {
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
        errors[field.fieldKey] = `${field.label} is required.`;
        continue;
      }
    }

    if (val !== undefined && val !== null && val !== '') {
      if (field.type === 'number' && isNaN(Number(val))) {
        errors[field.fieldKey] = `${field.label} must be a valid number.`;
      }
      if (field.type === 'url') {
        try {
          new URL(val);
        } catch {
          errors[field.fieldKey] = `${field.label} must be a valid URL.`;
        }
      }
    }
  }

  return errors;
}

/**
 * Builds scoping filter based on caller's role and department
 */
export function buildScopingFilter(user) {
  if (!user) return { _id: null };

  // 1. Admin and Marketing Lead see all requests
  if (user.role === 'admin' || user.role === 'lead') {
    return {};
  }

  // 2. Department Lead sees all requests of their department
  if (user.role === 'dept_lead') {
    return { sourceDepartment: user.department };
  }

  // 3. Department Staff, SM Manager, and Workers see only their own requests
  return { requester: user._id };
}

/**
 * Creates a new request (or draft)
 */
export async function createRequest(payload, user, io) {
  // Resolve RequestType if provided
  let requestTypeName = payload.requestType;
  let requestTypeDoc = null;

  if (payload.requestType) {
    requestTypeDoc = await RequestType.findOne({
      $or: [{ _id: payload.requestType.match(/^[0-9a-fA-F]{24}$/) ? payload.requestType : null }, { name: payload.requestType }],
    });
    if (requestTypeDoc) {
      requestTypeName = requestTypeDoc.name;
    }
  }

  // Validate dynamic fields if not a draft
  if (!payload.isDraft && requestTypeDoc?.fieldSchema?.length) {
    const fieldErrors = validateDynamicFields(requestTypeDoc.fieldSchema, payload.dynamicFields || {});
    if (Object.keys(fieldErrors).length > 0) {
      const err = new Error('Dynamic fields validation failed.');
      err.statusCode = 400;
      err.code = 'INVALID_DYNAMIC_FIELDS';
      err.details = fieldErrors;
      throw err;
    }
  }

  // Check duplicate requests
  const dupCheck = await detectDuplicateRequests({
    sourceDepartment: payload.sourceDepartment,
    requestTypeName,
    title: payload.title,
    deadline: payload.deadline,
  });

  // Generate atomic sequential requestId
  const requestId = await getNextSequenceId('MKT');

  const initialStatus = payload.isDraft ? 'draft' : 'submitted';

  const newRequest = new Request({
    requestId,
    title: payload.title,
    sourceDepartment: payload.sourceDepartment,
    requester: user._id,
    requestType: requestTypeDoc?._id || undefined,
    requestTypeName: requestTypeName || 'General Request',
    dynamicFields: payload.dynamicFields || {},
    priority: payload.priority || 'medium',
    deadline: new Date(payload.deadline),
    attachments: payload.attachments || [],
    status: initialStatus,
    recurring: payload.recurring || undefined,
  });

  await newRequest.save();

  // Record initial StatusHistory
  await transitionStatus({
    entityType: 'Request',
    entity: newRequest,
    toStatus: initialStatus,
    user,
    reason: payload.isDraft ? 'Draft saved' : 'Request submitted',
    io,
  });

  // Notify leads/admins via domain event if submitted
  if (!payload.isDraft) {
    eventBus.emit(EVENTS.REQUEST_CREATED, newRequest);
  }

  return {
    request: newRequest,
    duplicateWarning: dupCheck.hasDuplicates ? dupCheck.candidates : null,
  };
}

/**
 * List requests with role-based scoping, search, and filters
 */
export async function listRequests(user, queryParams = {}) {
  const scoping = buildScopingFilter(user);
  const filter = { ...scoping };

  if (queryParams.status) {
    filter.status = queryParams.status;
  }
  if (queryParams.priority) {
    filter.priority = queryParams.priority;
  }
  if (queryParams.department) {
    filter.sourceDepartment = queryParams.department;
  }
  if (queryParams.search) {
    filter.$or = [
      { title: { $regex: queryParams.search, $options: 'i' } },
      { requestId: { $regex: queryParams.search, $options: 'i' } },
      { requestTypeName: { $regex: queryParams.search, $options: 'i' } },
    ];
  }

  const page = Math.max(1, Number(queryParams.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(queryParams.limit) || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Request.find(filter)
      .populate('requester', 'name email avatar department role')
      .populate('triage.decidedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Request.countDocuments(filter),
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get request detail with status history timeline
 */
export async function getRequestById(id, user) {
  const reqDoc = await Request.findById(id)
    .populate('requester', 'name email avatar department role')
    .populate('triage.decidedBy', 'name email role')
    .populate('comments.user', 'name email avatar role')
    .populate('requestType')
    .populate('mergedRequests', 'requestId title status');

  if (!reqDoc) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Enforce access scoping
  const scoping = buildScopingFilter(user);
  if (scoping.sourceDepartment && reqDoc.sourceDepartment !== scoping.sourceDepartment) {
    const err = new Error('You do not have permission to view requests from other departments.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (scoping.requester && String(reqDoc.requester._id || reqDoc.requester) !== String(user._id)) {
    const err = new Error('You may only view your own requests.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  // Fetch complete audit-grade status history
  const history = await StatusHistory.find({
    entityType: 'Request',
    entityId: reqDoc._id,
  })
    .populate('changedBy', 'name email role')
    .sort({ timestamp: 1 })
    .lean();

  return {
    ...reqDoc.toObject(),
    history,
  };
}

/**
 * Edit an existing request (only if draft, needs_info, or rejected)
 */
export async function editRequest(id, payload, user, io) {
  const reqDoc = await Request.findById(id);
  if (!reqDoc) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Verify ownership or lead/admin
  const isOwner = String(reqDoc.requester) === String(user._id);
  const isPrivileged = ['admin', 'lead'].includes(user.role);
  if (!isOwner && !isPrivileged) {
    const err = new Error('You are not authorized to edit this request.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  // Must be in editable state
  if (!['draft', 'needs_info', 'rejected'].includes(reqDoc.status)) {
    const err = new Error(`Request in status '${reqDoc.status}' cannot be edited.`);
    err.statusCode = 400;
    err.code = 'REQUEST_NOT_EDITABLE';
    throw err;
  }

  if (payload.title) reqDoc.title = payload.title;
  if (payload.priority) reqDoc.priority = payload.priority;
  if (payload.deadline) reqDoc.deadline = new Date(payload.deadline);
  if (payload.dynamicFields) reqDoc.dynamicFields = payload.dynamicFields;
  if (payload.attachments) reqDoc.attachments = payload.attachments;
  if (payload.recurring) reqDoc.recurring = payload.recurring;

  await reqDoc.save();

  // If resubmitting a rejected or needs_info request
  if (payload.resubmit || (!payload.isDraft && reqDoc.status === 'draft')) {
    await transitionStatus({
      entityType: 'Request',
      entity: reqDoc,
      toStatus: 'submitted',
      user,
      reason: payload.resubmitReason || 'Resubmitted with requested updates',
      io,
    });

    // Notify lead
    const leadUsers = await User.find({ role: { $in: ['lead', 'admin'] }, status: 'active' }).select('_id');
    for (const lead of leadUsers) {
      await createNotification({
        recipient: lead._id,
        type: 'request_resubmitted',
        title: `Request Resubmitted: ${reqDoc.requestId}`,
        message: `${user.name} resubmitted request: "${reqDoc.title}"`,
        link: `/lead/inbox?requestId=${reqDoc._id}`,
        io,
      });
    }
  }

  return reqDoc;
}

/**
 * Cancel a request (before work starts)
 */
export async function cancelRequest(id, user, reason, io) {
  const reqDoc = await Request.findById(id);
  if (!reqDoc) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const isOwner = String(reqDoc.requester) === String(user._id);
  const isPrivileged = ['admin', 'lead'].includes(user.role);
  if (!isOwner && !isPrivileged) {
    const err = new Error('You are not authorized to cancel this request.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (['converted', 'cancelled'].includes(reqDoc.status)) {
    const err = new Error(`Cannot cancel request already in '${reqDoc.status}' status.`);
    err.statusCode = 400;
    err.code = 'INVALID_STATUS_FOR_CANCEL';
    throw err;
  }

  await transitionStatus({
    entityType: 'Request',
    entity: reqDoc,
    toStatus: 'cancelled',
    user,
    reason: reason || 'Cancelled by requester',
    io,
  });

  return reqDoc;
}

/**
 * Add a comment to a request
 */
export async function addComment(id, text, user, io) {
  const reqDoc = await Request.findById(id);
  if (!reqDoc) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  reqDoc.comments.push({
    user: user._id,
    text,
    createdAt: new Date(),
  });

  await reqDoc.save();

  // Notify other party
  const isOwner = String(reqDoc.requester) === String(user._id);
  if (isOwner) {
    const leads = await User.find({ role: { $in: ['lead', 'admin'] } }).select('_id');
    for (const lead of leads) {
      await createNotification({
        recipient: lead._id,
        type: 'request_comment',
        title: `New comment on ${reqDoc.requestId}`,
        message: `${user.name}: "${text.slice(0, 100)}"`,
        link: `/lead/inbox?requestId=${reqDoc._id}`,
        io,
      });
    }
  } else {
    await createNotification({
      recipient: reqDoc.requester,
      type: 'request_comment',
      title: `New comment on your request ${reqDoc.requestId}`,
      message: `${user.name}: "${text.slice(0, 100)}"`,
      link: `/requester/dashboard?requestId=${reqDoc._id}`,
      io,
    });
  }

  return reqDoc;
}

/**
 * Clone/Repeat an existing request
 */
export async function repeatRequest(id, user, io) {
  const sourceReq = await Request.findById(id);
  if (!sourceReq) {
    const err = new Error('Original request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const newRequestId = await getNextSequenceId('MKT');
  const defaultDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const repeated = new Request({
    requestId: newRequestId,
    title: `Copy of ${sourceReq.title}`,
    sourceDepartment: sourceReq.sourceDepartment,
    requester: user._id,
    requestType: sourceReq.requestType,
    requestTypeName: sourceReq.requestTypeName,
    dynamicFields: sourceReq.dynamicFields || {},
    priority: sourceReq.priority,
    deadline: defaultDeadline,
    attachments: sourceReq.attachments || [],
    status: 'draft',
  });

  await repeated.save();

  await transitionStatus({
    entityType: 'Request',
    entity: repeated,
    toStatus: 'draft',
    user,
    reason: `Repeated from previous request ${sourceReq.requestId}`,
    io,
  });

  return repeated;
}

// ==========================================
// Triage Endpoints (Marketing Lead & Admin)
// ==========================================

export async function triageAccept(id, { priority, deadline, comment }, user, io) {
  const reqDoc = await Request.findById(id);
  if (!reqDoc) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (priority) reqDoc.priority = priority;
  if (deadline) reqDoc.deadline = new Date(deadline);

  await transitionStatus({
    entityType: 'Request',
    entity: reqDoc,
    toStatus: 'accepted',
    user,
    reason: 'Request accepted by Marketing Lead',
    comment,
    io,
  });

  eventBus.emit(EVENTS.REQUEST_DECIDED, {
    _id: reqDoc._id,
    requestId: reqDoc.requestId,
    title: reqDoc.title,
    decision: 'accepted',
    reason: comment || 'Request accepted by Marketing Lead',
    requester: reqDoc.requester,
  });

  return reqDoc;
}

export async function triageReject(id, { reason }, user, io) {
  const reqDoc = await Request.findById(id);
  if (!reqDoc) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  await transitionStatus({
    entityType: 'Request',
    entity: reqDoc,
    toStatus: 'rejected',
    user,
    reason,
    comment: reason,
    io,
  });

  eventBus.emit(EVENTS.REQUEST_DECIDED, {
    _id: reqDoc._id,
    requestId: reqDoc.requestId,
    title: reqDoc.title,
    decision: 'rejected',
    reason,
    requester: reqDoc.requester,
  });

  return reqDoc;
}

export async function triageAskInfo(id, { message }, user, io) {
  const reqDoc = await Request.findById(id);
  if (!reqDoc) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  reqDoc.comments.push({
    user: user._id,
    text: `[Info Needed]: ${message}`,
    createdAt: new Date(),
  });

  await transitionStatus({
    entityType: 'Request',
    entity: reqDoc,
    toStatus: 'needs_info',
    user,
    reason: message,
    comment: message,
    io,
  });

  eventBus.emit(EVENTS.REQUEST_DECIDED, {
    _id: reqDoc._id,
    requestId: reqDoc.requestId,
    title: reqDoc.title,
    decision: 'needs_info',
    reason: message,
    requester: reqDoc.requester,
  });

  return reqDoc;
}

export async function triageMerge(sourceId, targetRequestId, user, io) {
  const sourceReq = await Request.findById(sourceId);
  const targetReq = await Request.findById(targetRequestId);

  if (!sourceReq || !targetReq) {
    const err = new Error('Source or Target request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  sourceReq.mergedInto = targetReq._id;
  targetReq.mergedRequests.push(sourceReq._id);

  await transitionStatus({
    entityType: 'Request',
    entity: sourceReq,
    toStatus: 'cancelled',
    user,
    reason: `Merged into duplicate parent request ${targetReq.requestId}`,
    io,
  });

  await targetReq.save();

  await createNotification({
    recipient: sourceReq.requester,
    type: 'request_merged',
    title: `Request Merged: ${sourceReq.requestId}`,
    message: `Your request was identified as duplicate and merged into ${targetReq.requestId}.`,
    link: `/requester/dashboard?requestId=${targetReq._id}`,
    io,
  });

  return { sourceReq, targetReq };
}

/**
 * Phase 4 Conversion STUB (clearly marked stub recording intent)
 */
export async function convertRequestStub(id, user, io) {
  const reqDoc = await Request.findById(id);
  if (!reqDoc) {
    const err = new Error('Request not found.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (reqDoc.status !== 'accepted') {
    const err = new Error('Only accepted requests can be converted into content items.');
    err.statusCode = 400;
    err.code = 'INVALID_STATUS_FOR_CONVERSION';
    throw err;
  }

  await transitionStatus({
    entityType: 'Request',
    entity: reqDoc,
    toStatus: 'converted',
    user,
    reason: 'Converted to Content Item (Phase 4 Pipeline Engine)',
    io,
  });

  return {
    success: true,
    message: 'Request marked for pipeline conversion. Content item creation will be handled in Phase 4.',
    convertedAt: new Date(),
    requestId: reqDoc.requestId,
    status: reqDoc.status,
  };
}

export async function bulkTriageAccept({ requestIds, priority, comment }, user, io) {
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    const err = new Error('requestIds array is required and must not be empty.');
    err.statusCode = 400;
    throw err;
  }

  const results = [];
  for (const id of requestIds) {
    try {
      const res = await triageAccept(id, { priority, comment }, user, io);
      results.push({ id, success: true, requestId: res.requestId });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
    }
  }

  return results;
}

export async function bulkTriageReject({ requestIds, reason }, user, io) {
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    const err = new Error('requestIds array is required and must not be empty.');
    err.statusCode = 400;
    throw err;
  }

  if (!reason) {
    const err = new Error('A rejection reason is mandatory for bulk rejection.');
    err.statusCode = 400;
    throw err;
  }

  const results = [];
  for (const id of requestIds) {
    try {
      const res = await triageReject(id, { reason }, user, io);
      results.push({ id, success: true, requestId: res.requestId });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
    }
  }

  return results;
}

