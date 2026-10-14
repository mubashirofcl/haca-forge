import * as teamService from './service.js';

export async function list(req, res, next) {
  try {
    const teams = await teamService.listTeams();
    return res.status(200).json({ teams });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const team = await teamService.updateTeam(req.params.id, req.body, req.user);
    if (!team) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    }
    return res.status(200).json({ team });
  } catch (error) {
    next(error);
  }
}

export async function addMember(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'userId is required' } });
    }
    const team = await teamService.addTeamMember(req.params.id, userId, req.user);
    return res.status(200).json({ team });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req, res, next) {
  try {
    const { userId } = req.params;
    const team = await teamService.removeTeamMember(req.params.id, userId, req.user);
    return res.status(200).json({ team });
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req, res, next) {
  try {
    const data = await teamService.getTeamDashboardData(req.params.teamId, req.user);
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getQueues(req, res, next) {
  try {
    const data = await teamService.getTeamHandoffQueues(req.user);
    return res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function reassign(req, res, next) {
  try {
    const io = req.app.get('io');
    const result = await teamService.reassignTask(req.body, req.user, io);
    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

