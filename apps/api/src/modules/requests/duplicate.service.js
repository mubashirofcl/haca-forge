import { Request } from './model.js';

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function calculateTokenSimilarity(strA, strB) {
  const tokensA = new Set(tokenize(strA));
  const tokensB = new Set(tokenize(strB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Searches for potential duplicate requests in the same department and request type.
 *
 * @param {Object} params
 * @param {string} params.sourceDepartment
 * @param {string} params.requestTypeName
 * @param {string} params.title
 * @param {Date|string} params.deadline
 * @param {string} [params.excludeId]
 * @returns {Promise<{ hasDuplicates: boolean, candidates: Array }>}
 */
export async function detectDuplicateRequests({
  sourceDepartment,
  requestTypeName,
  title,
  deadline,
  excludeId,
}) {
  if (!sourceDepartment || !title) {
    return { hasDuplicates: false, candidates: [] };
  }

  const query = {
    sourceDepartment,
    status: { $nin: ['rejected', 'cancelled', 'converted'] },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  if (requestTypeName) {
    query.requestTypeName = requestTypeName;
  }

  const openRequests = await Request.find(query)
    .select('_id requestId title status deadline requester createdAt')
    .populate('requester', 'name email')
    .lean();

  const candidates = [];
  const targetDeadline = deadline ? new Date(deadline).getTime() : null;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  for (const req of openRequests) {
    let isMatch = false;
    const matchReasons = [];

    // 1. Title Similarity Check
    const similarity = calculateTokenSimilarity(title, req.title);
    if (similarity >= 0.4 || req.title.toLowerCase().includes(title.toLowerCase().trim())) {
      isMatch = true;
      matchReasons.push(`Similar title (${Math.round(similarity * 100)}% match)`);
    }

    // 2. Deadline proximity check
    if (targetDeadline && req.deadline) {
      const diff = Math.abs(new Date(req.deadline).getTime() - targetDeadline);
      if (diff <= threeDaysMs) {
        if (isMatch || similarity >= 0.25) {
          isMatch = true;
          matchReasons.push('Due within 3 days of existing request');
        }
      }
    }

    if (isMatch) {
      candidates.push({
        _id: req._id,
        requestId: req.requestId,
        title: req.title,
        status: req.status,
        deadline: req.deadline,
        requester: req.requester,
        matchReasons,
      });
    }
  }

  return {
    hasDuplicates: candidates.length > 0,
    candidates,
  };
}
