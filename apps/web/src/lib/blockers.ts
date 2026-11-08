import { apiFetch } from './api';

/**
 * Resolve a step's blocker: the active blocker record is resolved and the step returns to
 * the status it had before it was blocked. A step blocked before blocker records were kept
 * has none, so it is moved out of Blocked the old way.
 */
export async function resolveStepBlocker(workItemId: string, resolutionNotes = ''): Promise<void> {
  const res = await apiFetch<{ data?: Array<{ _id: string }> } | Array<{ _id: string }>>(
    `/api/blockers?workItemId=${encodeURIComponent(workItemId)}&status=Active`
  );
  const list = Array.isArray(res) ? res : res?.data || [];
  const active = list[0];
  if (active?._id) {
    await apiFetch(`/api/blockers/${active._id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolutionNotes }),
    });
    return;
  }
  await apiFetch(`/api/work-items/${workItemId}/transition`, {
    method: 'POST',
    body: JSON.stringify({ toStatus: 'In Progress', comment: resolutionNotes || 'Blocker resolved' }),
  });
}
