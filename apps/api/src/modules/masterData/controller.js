import * as mdService from './service.js';

// Platforms
export async function getPlatforms(req, res, next) {
  try {
    const platforms = await mdService.listPlatforms(req.query.activeOnly === 'true');
    return res.status(200).json({ platforms });
  } catch (err) {
    next(err);
  }
}
export async function createPlatform(req, res, next) {
  try {
    const platform = await mdService.createPlatform(req.body, req.user);
    return res.status(201).json({ platform });
  } catch (err) {
    next(err);
  }
}
export async function updatePlatform(req, res, next) {
  try {
    const platform = await mdService.updatePlatform(req.params.id, req.body, req.user);
    if (!platform) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Platform not found' } });
    return res.status(200).json({ platform });
  } catch (err) {
    next(err);
  }
}
export async function deletePlatform(req, res, next) {
  try {
    await mdService.deletePlatform(req.params.id, req.user);
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Priorities
export async function getPriorities(req, res, next) {
  try {
    const priorities = await mdService.listPriorities(req.query.activeOnly === 'true');
    return res.status(200).json({ priorities });
  } catch (err) {
    next(err);
  }
}
export async function createPriority(req, res, next) {
  try {
    const priority = await mdService.createPriority(req.body, req.user);
    return res.status(201).json({ priority });
  } catch (err) {
    next(err);
  }
}
export async function updatePriority(req, res, next) {
  try {
    const priority = await mdService.updatePriority(req.params.id, req.body, req.user);
    if (!priority) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Priority not found' } });
    return res.status(200).json({ priority });
  } catch (err) {
    next(err);
  }
}
export async function deletePriority(req, res, next) {
  try {
    await mdService.deletePriority(req.params.id, req.user);
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Hold Reasons
export async function getHoldReasons(req, res, next) {
  try {
    const holdReasons = await mdService.listHoldReasons(req.query.activeOnly === 'true');
    return res.status(200).json({ holdReasons });
  } catch (err) {
    next(err);
  }
}
export async function createHoldReason(req, res, next) {
  try {
    const holdReason = await mdService.createHoldReason(req.body, req.user);
    return res.status(201).json({ holdReason });
  } catch (err) {
    next(err);
  }
}
export async function updateHoldReason(req, res, next) {
  try {
    const holdReason = await mdService.updateHoldReason(req.params.id, req.body, req.user);
    if (!holdReason) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hold reason not found' } });
    return res.status(200).json({ holdReason });
  } catch (err) {
    next(err);
  }
}
export async function deleteHoldReason(req, res, next) {
  try {
    await mdService.deleteHoldReason(req.params.id, req.user);
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Content Formats
export async function getContentFormats(req, res, next) {
  try {
    const formats = await mdService.listContentFormats(req.query.activeOnly === 'true');
    return res.status(200).json({ formats });
  } catch (err) {
    next(err);
  }
}
export async function createContentFormat(req, res, next) {
  try {
    const format = await mdService.createContentFormat(req.body, req.user);
    return res.status(201).json({ format });
  } catch (err) {
    next(err);
  }
}
export async function updateContentFormat(req, res, next) {
  try {
    const format = await mdService.updateContentFormat(req.params.id, req.body, req.user);
    if (!format) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Content format not found' } });
    return res.status(200).json({ format });
  } catch (err) {
    next(err);
  }
}
export async function deleteContentFormat(req, res, next) {
  try {
    await mdService.deleteContentFormat(req.params.id, req.user);
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Request Types
export async function getRequestTypes(req, res, next) {
  try {
    const requestTypes = await mdService.listRequestTypes({
      departmentType: req.query.departmentType,
      activeOnly: req.query.activeOnly === 'true',
    });
    return res.status(200).json({ requestTypes });
  } catch (err) {
    next(err);
  }
}
export async function getRequestTypeById(req, res, next) {
  try {
    const requestType = await mdService.getRequestTypeById(req.params.id);
    if (!requestType) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request type not found' } });
    return res.status(200).json({ requestType });
  } catch (err) {
    next(err);
  }
}
export async function createRequestType(req, res, next) {
  try {
    const requestType = await mdService.createRequestType(req.body, req.user);
    return res.status(201).json({ requestType });
  } catch (err) {
    next(err);
  }
}
export async function updateRequestType(req, res, next) {
  try {
    const requestType = await mdService.updateRequestType(req.params.id, req.body, req.user);
    if (!requestType) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request type not found' } });
    return res.status(200).json({ requestType });
  } catch (err) {
    next(err);
  }
}
export async function deleteRequestType(req, res, next) {
  try {
    await mdService.deleteRequestType(req.params.id, req.user);
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Settings
export async function getSettings(_req, res, next) {
  try {
    const settings = await mdService.getSettings();
    return res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
}
export async function updateSettings(req, res, next) {
  try {
    const settings = await mdService.updateSettings(req.body, req.user);
    return res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
}
