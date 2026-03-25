"use strict";
/**
 * Generates convex/content/auditEngagementLetterBody.ts from scripts/audit-letter-source.txt
 * Run: node scripts/build-audit-letter.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "scripts", "audit-letter-source.txt");
const out = path.join(root, "convex", "content", "auditEngagementLetterBody.ts");

const body = fs.readFileSync(src, "utf8");
const escaped = JSON.stringify(body);
const ts = `/**
 * Audit engagement letter (RA Illustratives Proprietary Limited) — full verbatim bundled body.
 * Stored in \`engagementLetterVersions.scope\`; \`introduction\` is left unset.
 */
export const AUDIT_ENGAGEMENT_LETTER_BODY = ${escaped};

export const AUDIT_ENGAGEMENT_TEMPLATE_NAME = "Audit engagement letter";
`;
fs.writeFileSync(out, ts, "utf8");
console.log("Wrote", out, "chars:", body.length);
