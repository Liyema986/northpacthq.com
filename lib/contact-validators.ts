/** Shared validation for contact / client forms */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequiredEmail(email: string): string | undefined {
  const t = email.trim();
  if (!t) return "Email is required";
  if (!EMAIL_RE.test(t)) return "Enter a valid email address";
  return undefined;
}

/** Normalize optional website to a full URL; returns undefined if empty or invalid */
export function normalizeOptionalWebsite(website: string): string | undefined {
  const t = website.trim();
  if (!t) return undefined;
  try {
    const raw = t.includes("://") ? t : `https://${t}`;
    const u = new URL(raw);
    if (!u.hostname) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export function validateOptionalWebsite(website: string): string | undefined {
  const t = website.trim();
  if (!t) return undefined;
  if (!normalizeOptionalWebsite(website)) return "Enter a valid website URL (e.g. example.com)";
  return undefined;
}
