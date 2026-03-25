"use strict";
/**
 * Generates convex/content/reviewEngagementLetterBody.ts from scripts/review-letter-source.txt
 * Run: node scripts/build-review-letter.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "scripts", "review-letter-source.txt");
const out = path.join(root, "convex", "content", "reviewEngagementLetterBody.ts");

const body = fs.readFileSync(src, "utf8");
const escaped = JSON.stringify(body);
const ts = `/**
 * Review engagement letter — full verbatim bundled body (Boet Cilliers Bruinkoppies Proprietary Limited).
 * Stored in \`engagementLetterVersions.scope\`; \`introduction\` is left unset.
 */
export const REVIEW_ENGAGEMENT_LETTER_BODY = ${escaped};

export const REVIEW_ENGAGEMENT_TEMPLATE_NAME = "Review engagement letter";
`;
fs.writeFileSync(out, ts, "utf8");
console.log("Wrote", out, "chars:", body.length);
