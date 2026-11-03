/**
 * Pure TypeScript Word & Line Diff Engine for Version Comparison
 * Zero external dependencies.
 */

export interface DiffPart {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

/**
 * Computes a simple word-level diff between two strings.
 */
export function computeWordDiff(oldStr: string = '', newStr: string = ''): DiffPart[] {
  // Strip HTML tags for clean text comparison
  const cleanOld = oldStr.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanNew = newStr.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const oldWords = cleanOld ? cleanOld.split(' ') : [];
  const newWords = cleanNew ? cleanNew.split(' ') : [];

  const n = oldWords.length;
  const m = newWords.length;

  // Build LCS matrix
  const matrix: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff parts
  const diffs: DiffPart[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      diffs.unshift({ type: 'unchanged', value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      diffs.unshift({ type: 'added', value: newWords[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      diffs.unshift({ type: 'removed', value: oldWords[i - 1] });
      i--;
    }
  }

  // Group consecutive tokens of same type
  const grouped: DiffPart[] = [];
  for (const part of diffs) {
    if (grouped.length > 0 && grouped[grouped.length - 1].type === part.type) {
      grouped[grouped.length - 1].value += ' ' + part.value;
    } else {
      grouped.push({ type: part.type, value: part.value });
    }
  }

  return grouped;
}
