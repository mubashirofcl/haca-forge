import * as profileService from './service.js';
import { generateUploadSignature } from '../uploads/service.js';

export async function getProfileHandler(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.user._id);
    return res.status(200).json({ data: profile });
  } catch (err) {
    next(err);
  }
}

export async function updateProfileHandler(req, res, next) {
  try {
    const profile = await profileService.updateProfile(req.user._id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendPhoneOtpHandler(req, res, next) {
  try {
    const result = await profileService.sendPhoneOtp(req.user._id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyPhoneOtpHandler(req, res, next) {
  try {
    const result = await profileService.verifyPhoneOtp(req.user._id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function signAvatarHandler(req, res, next) {
  try {
    const { fileName, fileSize, fileType } = req.body;
    const signature = await generateUploadSignature({
      fileName,
      fileSize,
      fileType,
      kind: 'image',
      folder: `marketing_portal/avatars/user_${req.user._id}`,
    });
    return res.status(200).json(signature);
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatarHandler(req, res, next) {
  try {
    const file = req.file || req.files?.file?.[0] || req.files?.avatar?.[0];
    if (!file) {
      const error = new Error('No avatar file provided');
      error.statusCode = 400;
      error.code = 'NO_FILE_PROVIDED';
      throw error;
    }
    const result = await profileService.processAvatarUpload(req.user._id, file);
    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAvatarHandler(req, res, next) {
  try {
    const result = await profileService.removeAvatar(req.user._id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSettingsHandler(req, res, next) {
  try {
    const settings = await profileService.getSettings(req.user._id);
    return res.status(200).json({ data: settings });
  } catch (err) {
    next(err);
  }
}

export async function updateSettingsHandler(req, res, next) {
  try {
    const settings = await profileService.updateSettings(req.user._id, req.body, req.user.role);
    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const result = await profileService.changePassword(req.user._id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listSessionsHandler(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const sessions = await profileService.listSessions(req.user._id, token);
    return res.status(200).json({ data: sessions });
  } catch (err) {
    next(err);
  }
}

export async function revokeSessionHandler(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await profileService.revokeSession(req.user._id, req.params.id, token);

    if (result.isCurrent) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function revokeOthersHandler(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const result = await profileService.revokeOtherSessions(req.user._id, token);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function submitChangeRequestHandler(req, res, next) {
  try {
    const result = await profileService.submitChangeRequest(req.user._id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function completeWelcomeHandler(req, res, next) {
  try {
    const { name, phone, avatarUrl, avatarStorageId } = req.body;
    const user = req.user;
    user.name = name.trim();
    user.phone = profileService.normalizePhone(phone);
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (avatarStorageId !== undefined) user.avatarStorageId = avatarStorageId;
    user.profileCompletedAt = new Date();
    await user.save();

    const updated = await profileService.getProfile(user._id);
    return res.status(200).json({
      success: true,
      message: 'Welcome profile setup complete',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

