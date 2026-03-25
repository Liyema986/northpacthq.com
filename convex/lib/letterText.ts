/** Same as `lib/engagement-letter-text.ts` — used when writing letter bodies from Convex. */
export function normalizeLetterWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizeScopeForStorage(scope: string | undefined): string | undefined {
  if (scope === undefined) return undefined;
  const n = normalizeLetterWhitespace(scope).trim();
  return n || undefined;
}
