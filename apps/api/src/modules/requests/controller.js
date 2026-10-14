import * as requestService from './service.js';
import * as contentService from '../content/service.js';
import { detectDuplicateRequests } from './duplicate.service.js';
import { io } from '../../server.js';

export async function createRequestHandler(req, res, next) {
  try {
    const result = await requestService.createRequest(req.body, req.user, io);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listRequestsHandler(req, res, next) {
  try {
    const result = await requestService.listRequests(req.user, req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRequestByIdHandler(req, res, next) {
  try {
    const request = await requestService.getRequestById(req.params.id, req.user);
    return res.status(200).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function editRequestHandler(req, res, next) {
  try {
    const request = await requestService.editRequest(req.params.id, req.body, req.user, io);
    return res.status(200).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function cancelRequestHandler(req, res, next) {
  try {
    const request = await requestService.cancelRequest(
      req.params.id,
      req.user,
      req.body.reason,
      io
    );
    return res.status(200).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function addCommentHandler(req, res, next) {
  try {
    const request = await requestService.addComment(
      req.params.id,
      req.body.text,
      req.user,
      io
    );
    return res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function repeatRequestHandler(req, res, next) {
  try {
    const request = await requestService.repeatRequest(req.params.id, req.user, io);
    return res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function checkDuplicatesHandler(req, res, next) {
  try {
    const { sourceDepartment, requestTypeName, title, deadline } = req.body;
    const result = await detectDuplicateRequests({
      sourceDepartment,
      requestTypeName,
      title,
      deadline,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------
// Marketing Lead & Admin Triage Controllers
// ----------------------------------------------------

export async function triageAcceptHandler(req, res, next) {
  try {
    const request = await requestService.triageAccept(
      req.params.id,
      req.body,
      req.user,
      io
    );
    return res.status(200).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function triageRejectHandler(req, res, next) {
  try {
    const request = await requestService.triageReject(
      req.params.id,
      req.body,
      req.user,
      io
    );
    return res.status(200).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function triageAskInfoHandler(req, res, next) {
  try {
    const request = await requestService.triageAskInfo(
      req.params.id,
      req.body,
      req.user,
      io
    );
    return res.status(200).json({ request });
  } catch (err) {
    next(err);
  }
}

export async function triageMergeHandler(req, res, next) {
  try {
    const result = await requestService.triageMerge(
      req.params.id,
      req.body.targetRequestId,
      req.user,
      io
    );
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function triageConvertHandler(req, res, next) {
  try {
    const ioInstance = req.app.get('io') || io;
    const result = await contentService.convertRequestToContentItem(
      req.params.id,
      req.body,
      req.user,
      ioInstance
    );
    return res.status(200).json({
      success: true,
      status: 'converted',
      contentItem: result.contentItem,
      request: result.request,
    });
  } catch (err) {
    next(err);
  }
}
