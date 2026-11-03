import * as teamService from './service.js';

export async function getDirectory(req, res, next) {
  try {
    const result = await teamService.getTeamDirectory(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getBaseProfile(req, res, next) {
  try {
    const profile = await teamService.getPersonBaseProfile(req.params.id, req.user);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function getOverview(req, res, next) {
  try {
    const overview = await teamService.getPersonOverview(req.params.id, req.user, req.query);
    res.json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
}

export async function getWork(req, res, next) {
  try {
    const work = await teamService.getPersonWork(req.params.id, req.user, req.query);
    res.json({ success: true, data: work });
  } catch (err) {
    next(err);
  }
}

export async function getPerformance(req, res, next) {
  try {
    const performance = await teamService.getPersonPerformance(req.params.id, req.user, req.query);
    res.json({ success: true, data: performance });
  } catch (err) {
    next(err);
  }
}

export async function getRatings(req, res, next) {
  try {
    const ratings = await teamService.getPersonRatings(req.params.id, req.user);
    res.json({ success: true, data: ratings });
  } catch (err) {
    next(err);
  }
}

export async function getActivity(req, res, next) {
  try {
    const activity = await teamService.getPersonActivity(req.params.id, req.user, req.query);
    res.json({ success: true, data: activity });
  } catch (err) {
    next(err);
  }
}

export async function getChanges(req, res, next) {
  try {
    const changes = await teamService.getPersonChanges(req.params.id, req.user);
    res.json({ success: true, data: changes });
  } catch (err) {
    next(err);
  }
}

export async function updateDetails(req, res, next) {
  try {
    const updated = await teamService.updatePersonDetails(req.params.id, req.body, req.user);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function reassign(req, res, next) {
  try {
    const result = await teamService.reassignSteps(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function toggleStatusHandler(req, res, next) {
  try {
    const result = await teamService.toggleStatus(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req, res, next) {
  try {
    const result = await teamService.triggerPasswordReset(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function forceLogoutHandler(req, res, next) {
  try {
    const result = await teamService.forceLogout(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

