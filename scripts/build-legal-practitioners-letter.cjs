"use strict";
/**
 * Generates convex/content/legalPractitionersEngagementLetterBody.ts from scripts/legal-practitioners-letter-source.txt
 * Run: node scripts/build-legal-practitioners-letter.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "scripts", "legal-practitioners-letter-source.txt");
const out = path.join(root, "convex", "content", "legalPractitionersEngagementLetterBody.ts");

const body = fs.readFileSync(src, "utf8");
const escaped = JSON.stringify(body);
const ts = `/**
 * Legal Practitioners engagement letter — full verbatim bundled body (Van De Wall Incorporated).
 * Stored in \`engagementLetterVersions.scope\`; \`introduction\` is left unset.
 */
export const LEGAL_PRACTITIONERS_ENGAGEMENT_LETTER_BODY = ${escaped};

export const LEGAL_PRACTITIONERS_TEMPLATE_NAME = "Legal Practitioners engagement letter";
`;
fs.writeFileSync(out, ts, "utf8");
console.log("Wrote", out, "chars:", body.length);
