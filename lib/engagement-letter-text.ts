/**
 * Line endings only — preserves spaces and line breaks verbatim (engagement letters must match
 * source documents word-for-word).
 */
export function normalizeLetterWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizeScopeForStorage(scope: string | undefined): string | undefined {
  if (scope === undefined) return undefined;
  const n = normalizeLetterWhitespace(scope).trim();
  return n || undefined;
}
