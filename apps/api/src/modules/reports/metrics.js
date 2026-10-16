/**
 * Central Metric Formulas & Engine for MMP Marketing Portal
 *
 * Rules & Constraints:
 * 1. Define metric formulas once here with complete docstrings.
 * 2. Reuse these functions across all aggregations, reports, and scheduled jobs.
 * 3. All percentage metrics are scaled 0 - 100 and rounded to 1 decimal place.
 * 4. Handle edge cases cleanly: 0 denominators default to 100% or 0% as semantically appropriate.
 */

export const DEFAULT_EFFICIENCY_WEIGHTS = {
  onTime: 0.4,
  firstPass: 0.3,
  speedVsEstimate: 0.2,
  volumeUtilization: 0.1,
};

/**
 * Calculate On-Time Delivery / Completion Rate
 *
 * @param {number} onTimeCount - Number of tasks or content items completed on or before deadline
 * @param {number} totalCount - Total completed/published items in the scope
 * @returns {number} Percentage (0 - 100)
 */
export function calculateOnTimeRate(onTimeCount, totalCount) {
  if (!totalCount || totalCount <= 0) return 100.0;
  const rate = (Math.max(0, onTimeCount) / totalCount) * 100;
  return Math.min(100.0, Math.round(rate * 10) / 10);
}

/**
 * Calculate First-Pass Approval Rate
 *
 * Definition: Items accepted/approved without undergoing any revision cycles
 * (i.e., revisionCount === 0 and never transitioned to changes_requested / reshoot_needed).
 *
 * @param {number} firstPassCount - Number of items approved on first review
 * @param {number} totalReviewedCount - Total approved items evaluated
 * @returns {number} Percentage (0 - 100)
 */
export function calculateFirstPassRate(firstPassCount, totalReviewedCount) {
  if (!totalReviewedCount || totalReviewedCount <= 0) return 100.0;
  const rate = (Math.max(0, firstPassCount) / totalReviewedCount) * 100;
  return Math.min(100.0, Math.round(rate * 10) / 10);
}

/**
 * Calculate Speed vs Estimate Score
 *
 * Definition: Evaluates whether worker completes tasks within estimated hours.
 * If actualHours <= estimateHours, score is 100%.
 * If actualHours > estimateHours, score decreases proportionally: (estimate / actual) * 100.
 *
 * @param {number} estimatedHours - Total estimated task hours
 * @param {number} actualHours - Total actual logged hours
 * @returns {number} Score (0 - 100)
 */
export function calculateSpeedScore(estimatedHours, actualHours) {
  const est = Number(estimatedHours) || 0;
  const act = Number(actualHours) || 0;

  if (act <= 0) return 100.0;
  if (est <= 0) return 100.0; // If unestimated, do not penalize

  if (act <= est) return 100.0;

  const score = (est / act) * 100;
  return Math.min(100.0, Math.max(0, Math.round(score * 10) / 10));
}

/**
 * Calculate Volume / Capacity Utilization Score
 *
 * Definition: Percentage of available working capacity effectively logged.
 * Available capacity = base capacity (e.g. 40h/week or 160h/month) minus leave hours (leaveDays * 8h).
 * Target utilization is 100% of available hours (capped at 100% for scoring).
 *
 * @param {number} loggedHours - Total logged time entry hours in the period
 * @param {number} capacityHours - Net capacity hours (accounting for approved leave)
 * @returns {number} Score (0 - 100)
 */
export function calculateVolumeScore(loggedHours, capacityHours) {
  const logged = Number(loggedHours) || 0;
  const cap = Number(capacityHours) || 0;

  if (cap <= 0) return 100.0;
  const utilization = (logged / cap) * 100;
  return Math.min(100.0, Math.max(0, Math.round(utilization * 10) / 10));
}

/**
 * Calculate Overall Worker Efficiency Score
 *
 * Formula per Specification:
 * Score = (W_onTime * onTimeRate) + (W_firstPass * firstPassRate) + (W_speed * speedScore) + (W_volume * volumeScore)
 *
 * @param {Object} params
 * @param {number} params.onTimeRate - 0 to 100
 * @param {number} params.firstPassRate - 0 to 100
 * @param {number} params.speedScore - 0 to 100
 * @param {number} params.volumeScore - 0 to 100
 * @param {Object} [params.weights] - Optional configured weights from system settings
 * @returns {number} Clamped efficiency score (0 - 100, 1 decimal place)
 */
export function calculateEfficiencyScore({
  onTimeRate = 100,
  firstPassRate = 100,
  speedScore = 100,
  volumeScore = 100,
  weights = DEFAULT_EFFICIENCY_WEIGHTS,
}) {
  const w = {
    onTime: Number(weights?.onTime ?? DEFAULT_EFFICIENCY_WEIGHTS.onTime),
    firstPass: Number(weights?.firstPass ?? DEFAULT_EFFICIENCY_WEIGHTS.firstPass),
    speedVsEstimate: Number(weights?.speedVsEstimate ?? DEFAULT_EFFICIENCY_WEIGHTS.speedVsEstimate),
    volumeUtilization: Number(weights?.volumeUtilization ?? DEFAULT_EFFICIENCY_WEIGHTS.volumeUtilization),
  };

  const totalWeight = w.onTime + w.firstPass + w.speedVsEstimate + w.volumeUtilization || 1;

  const weightedSum =
    (w.onTime * Number(onTimeRate || 0)) +
    (w.firstPass * Number(firstPassRate || 0)) +
    (w.speedVsEstimate * Number(speedScore || 0)) +
    (w.volumeUtilization * Number(volumeScore || 0));

  const normalizedScore = weightedSum / totalWeight;
  return Math.min(100.0, Math.max(0.0, Math.round(normalizedScore * 10) / 10));
}

/**
 * Calculate Turnaround Time in Hours or Days
 *
 * @param {Date|string} start
 * @param {Date|string} end
 * @param {'hours'|'days'} [unit='days']
 * @returns {number}
 */
export function calculateTurnaround(start, end, unit = 'days') {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return 0;

  const hours = ms / (1000 * 60 * 60);
  if (unit === 'hours') {
    return Math.round(hours * 10) / 10;
  }
  return Math.round((hours / 24) * 10) / 10;
}

/**
 * Group open items into aging buckets:
 * - < 3 days
 * - 3-7 days
 * - 7-14 days
 * - > 14 days
 *
 * @param {Array<Object>} items
 * @param {string} [dateField='createdAt']
 * @param {Date} [now=new Date()]
 * @returns {Object}
 */
export function categorizeAgingBuckets(items = [], dateField = 'createdAt', now = new Date()) {
  const buckets = {
    under3Days: 0,
    threeTo7Days: 0,
    sevenTo14Days: 0,
    over14Days: 0,
  };

  const nowMs = now.getTime();

  for (const item of items) {
    const itemDate = item[dateField] ? new Date(item[dateField]).getTime() : nowMs;
    const diffDays = Math.max(0, (nowMs - itemDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 3) {
      buckets.under3Days += 1;
    } else if (diffDays <= 7) {
      buckets.threeTo7Days += 1;
    } else if (diffDays <= 14) {
      buckets.sevenTo14Days += 1;
    } else {
      buckets.over14Days += 1;
    }
  }

  return buckets;
}
