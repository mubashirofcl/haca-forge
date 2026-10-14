import * as userService from './service.js';

export async function listUsers(req, res, next) {
  try {
    const users = await userService.listUsers(req.query);
    return res.status(200).json({ data: users });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req, res, next) {
  try {
    const user = await userService.updateUserRole(
      req.params.id,
      req.body.role,
      req.user,
      req.ip
    );
    return res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const user = await userService.updateUserStatus(
      req.params.id,
      req.body.status,
      req.user,
      req.ip
    );
    return res.status(200).json({
      success: true,
      message: `User status changed to ${req.body.status}`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function forceLogout(req, res, next) {
  try {
    await userService.forceLogoutUser(req.params.id, req.user, req.ip);
    return res.status(200).json({
      success: true,
      message: 'User session has been revoked',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAssignment(req, res, next) {
  try {
    const user = await userService.updateUserAssignment(
      req.params.id,
      req.body,
      req.user,
      req.ip
    );
    return res.status(200).json({
      success: true,
      message: 'User assignment updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

