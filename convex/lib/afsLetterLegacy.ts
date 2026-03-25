/**
 * Detects the earlier one-line (a)/(b)/(c) “fix” that merged labels with text — should be replaced
 * with the current verbatim bundled letter. Canonical letter uses bare lines for (a)(b)(c); do not
 * match that here or we would re-patch every load.
 */
export function hasLegacyAfsBrokenLists(text: string): boolean {
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (
    /\n\(a\) Responsibility for the financial statements and the preparation and presentation thereof in accordance with a financial reporting framework/.test(
      s
    )
  ) {
    return true;
  }
  if (
    /\n\(a\) We will consider the consistency and quality of information received by us;/.test(s)
  ) {
    return true;
  }
  return false;
}
