import { Rating, Submission } from './model.js';

/**
 * One rating per step (Phase 7 rule, shared by reports and profiles): the rating on the
 * step's latest approved submission, otherwise the step's latest rating.
 * Returns Map(stepId → { _id, score, createdAt }).
 */
export async function oneRatingPerStep(stepIds) {
  const result = new Map();
  if (!stepIds || !stepIds.length) return result;
  const [approved, ratings] = await Promise.all([
    Submission.find({ workItemId: { $in: stepIds }, status: 'approved', version: { $gt: 0 } }).select('workItemId version').lean(),
    Rating.find({ workItemId: { $in: stepIds } }).select('workItemId submissionId score createdAt').lean(),
  ]);
  const latestApproved = new Map();
  for (const s of approved) {
    const key = String(s.workItemId);
    if (!latestApproved.has(key) || s.version > latestApproved.get(key).version) latestApproved.set(key, s);
  }
  const byStep = new Map();
  for (const r of ratings) {
    const key = String(r.workItemId);
    if (!byStep.has(key)) byStep.set(key, []);
    byStep.get(key).push(r);
  }
  for (const [key, list] of byStep) {
    const target = latestApproved.get(key);
    const onApproved = target ? list.find((r) => String(r.submissionId) === String(target._id)) : null;
    const latest = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const chosen = onApproved || latest;
    if (chosen && typeof chosen.score === 'number') result.set(key, { _id: chosen._id, score: chosen.score, createdAt: chosen.createdAt });
  }
  return result;
}
