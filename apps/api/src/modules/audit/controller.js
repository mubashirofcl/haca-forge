import { listAuditLogs } from './service.js';

export async function getAuditLogs(req, res, next) {
  try {
    const result = await listAuditLogs(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
