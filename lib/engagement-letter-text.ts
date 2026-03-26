/**
 * Normalises an engagement-letter body for display:
 * 1. Unify line endings.
 * 2. Collapse exactly-2 spaces between non-space chars → single space (OCR/PDF artefact).
 *    Alignment gaps (4+ spaces) and signature-block spacing are preserved.
 * 3. Strip " \n \n" filler lines from PDF page breaks → single blank line.
 * 4. Strip stray page-number lines (a bare "1"–"99" on its own line).
 */
export function normalizeLetterWhitespace(text: string): string {
  let t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/(\S)  (\S)/g, "$1 $2");
  t = t.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");
  t = t.replace(/\n\d{1,2}\n/g, "\n");
  return t;
}

export function normalizeScopeForStorage(scope: string | undefined): string | undefined {
  if (scope === undefined) return undefined;
  const n = normalizeLetterWhitespace(scope).trim();
  return n || undefined;
}
