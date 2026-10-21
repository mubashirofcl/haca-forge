import {
  syncLsqLeads,
  getLeadFunnelMetrics,
  getDataCenterStatus,
  resolveDiscrepancy,
} from './service.js';
import {
  leadDiscrepancyResolveSchema,
  lsqSyncTriggerSchema,
} from '@mmp/shared';

export async function getLeadFunnelHandler(req, res, next) {
  try {
    const data = await getLeadFunnelMetrics(req.query, req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDataCenterStatusHandler(req, res, next) {
  try {
    const data = await getDataCenterStatus(req.query, req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function triggerLsqSyncHandler(req, res, next) {
  try {
    const parsed = lsqSyncTriggerSchema.safeParse(req.body || {});
    const options = parsed.success ? parsed.data : {};

    const result = await syncLsqLeads(options, req.user);
    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

export async function resolveDiscrepancyHandler(req, res, next) {
  try {
    const parsed = leadDiscrepancyResolveSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid resolution input',
          details: parsed.error.issues,
        },
      });
    }

    const lead = await resolveDiscrepancy(req.params.id, parsed.data, req.user);
    return res.status(200).json({ success: true, lead });
  } catch (err) {
    next(err);
  }
}

/**
 * Read-authoritative constraint handler.
 * Rejects manual creation or stage alteration.
 */
export async function rejectLeadModificationHandler(req, res) {
  return res.status(405).json({
    error: {
      code: 'READ_AUTHORITATIVE_CONSTRAINT',
      message:
        'LeadSquared is read-authoritative: direct creation or modification of lead status/stage via Marketing OS API is strictly prohibited.',
    },
  });
}
