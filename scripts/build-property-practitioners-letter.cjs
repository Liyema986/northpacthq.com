"use strict";
/**
 * Generates convex/content/propertyPractitionersEngagementLetterBody.ts from scripts/property-practitioners-letter-source.txt
 * Run: node scripts/build-property-practitioners-letter.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "scripts", "property-practitioners-letter-source.txt");
const out = path.join(root, "convex", "content", "propertyPractitionersEngagementLetterBody.ts");

const body = fs.readFileSync(src, "utf8");
const escaped = JSON.stringify(body);
const ts = `/**
 * Property Practitioners engagement letter — full verbatim bundled body (Rawson Wellington Proprietary Limited).
 * Stored in \`engagementLetterVersions.scope\`; \`introduction\` is left unset.
 */
export const PROPERTY_PRACTITIONERS_ENGAGEMENT_LETTER_BODY = ${escaped};

export const PROPERTY_PRACTITIONERS_TEMPLATE_NAME = "Property Practitioners engagement letter";
`;
fs.writeFileSync(out, ts, "utf8");
console.log("Wrote", out, "chars:", body.length);
