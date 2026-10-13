import * as accessService from './service.js';

export async function submitRequest(req, res, next) {
  try {
    const accessReq = await accessService.submitAccessRequest(req.body);
    return res.status(201).json({
      success: true,
      message: 'Access request submitted successfully. An administrator will review your application.',
      requestId: accessReq._id,
    });
  } catch (error) {
    next(error);
  }
}

export async function listRequests(req, res, next) {
  try {
    const requests = await accessService.listAccessRequests(req.query);
    return res.status(200).json({ data: requests });
  } catch (error) {
    next(error);
  }
}

export async function approveRequest(req, res, next) {
  try {
    const result = await accessService.approveAccessRequest(
      req.params.id,
      req.body,
      req.user,
      req.ip
    );
    return res.status(200).json({
      success: true,
      message: 'Access request approved. Activation link sent to user.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const result = await accessService.rejectAccessRequest(
      req.params.id,
      req.body.reason,
      req.user,
      req.ip
    );
    return res.status(200).json({
      success: true,
      message: 'Access request rejected.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function requestInfo(req, res, next) {
  try {
    const result = await accessService.requestInfoForAccess(
      req.params.id,
      req.body.question,
      req.user,
      req.ip
    );
    return res.status(200).json({
      success: true,
      message: 'Information request sent to user.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
