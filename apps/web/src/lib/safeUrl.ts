/**
 * A link or media source we are willing to put on the page: http(s), or a path on this site.
 * Anything else (javascript:, data:, protocol-relative //host) comes back undefined, so React
 * renders no href or src at all.
 */
export function safeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const value = url.trim();
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}
