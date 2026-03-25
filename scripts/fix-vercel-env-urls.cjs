/**
 * Ensures NEXT_PUBLIC_SITE_URL + XERO_REDIRECT_URI are correct per environment (not all localhost).
 * Ensures NEXT_PUBLIC_CONVEX_URL exists on preview + development.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function parseDotEnv(content) {
  const map = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

function vercel(args) {
  return spawnSync("npx", ["vercel", ...args], { cwd: root, stdio: "inherit", shell: true }).status === 0;
}

function rm(name, target) {
  spawnSync("npx", ["vercel", "env", "rm", name, target, "--yes"], { cwd: root, stdio: "pipe", shell: true });
}

function add(name, target, value) {
  rm(name, target);
  if (!vercel(["env", "add", name, target, "--value", value, "--yes"])) {
    console.error("Failed:", name, target);
    process.exit(1);
  }
  console.log("Set", name, target);
}

/** Preview often requires a git branch via CLI; do not abort the script. */
function addPreviewOptional(name, value) {
  rm(name, "preview");
  if (!vercel(["env", "add", name, "preview", "--value", value, "--yes"])) {
    console.warn(
      "Preview not set via CLI (use Vercel dashboard or link a branch):",
      name
    );
  } else {
    console.log("Set", name, "preview");
  }
}

const local = parseDotEnv(fs.readFileSync(envPath, "utf8"));
const PROD_SITE = "https://www.northpacthq.com";
const PROD_XERO = `${PROD_SITE}/api/integrations/xero/callback`;
const DEV_SITE = "http://localhost:3000";
const DEV_XERO = `${DEV_SITE}/api/integrations/xero/callback`;

add("NEXT_PUBLIC_SITE_URL", "production", PROD_SITE);
addPreviewOptional("NEXT_PUBLIC_SITE_URL", PROD_SITE);
add("NEXT_PUBLIC_SITE_URL", "development", DEV_SITE);

add("XERO_REDIRECT_URI", "production", PROD_XERO);
addPreviewOptional("XERO_REDIRECT_URI", PROD_XERO);
add("XERO_REDIRECT_URI", "development", DEV_XERO);

const convexUrl = local.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl) {
  addPreviewOptional("NEXT_PUBLIC_CONVEX_URL", convexUrl);
  add("NEXT_PUBLIC_CONVEX_URL", "development", convexUrl);
}

console.log("Done.");
