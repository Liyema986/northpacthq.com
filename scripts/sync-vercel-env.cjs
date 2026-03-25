/**
 * Sync .env.local into Vercel for project northpacthq-com (risen-group).
 * Per XERO-OAUTH-DEBUGGING-LESSONS.md: only --value (no PowerShell pipes).
 *
 * Run from northpact-final:
 *   node scripts/sync-vercel-env.cjs
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
  const r = spawnSync("npx", ["vercel", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    shell: true,
  });
  return r.status === 0;
}

function envRm(name, target) {
  spawnSync("npx", ["vercel", "env", "rm", name, target, "--yes"], {
    cwd: root,
    stdio: "pipe",
    shell: true,
  });
}

function envAdd(name, target, value) {
  if (value === undefined || value === "") {
    console.warn(`[skip] ${name} (${target}): empty`);
    return;
  }
  envRm(name, target);
  const ok = vercel(["env", "add", name, target, "--value", value, "--yes"]);
  if (!ok) console.error(`[fail] ${name} ${target}`);
  else console.log(`[ok] ${name} (${target})`);
}

if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local at", envPath);
  process.exit(1);
}

const local = parseDotEnv(fs.readFileSync(envPath, "utf8"));

// Link (idempotent)
vercel(["link", "--project", "northpacthq-com", "--scope", "risen-group", "--yes"]);

const PROD_SITE = "https://www.northpacthq.com";
const PROD_XERO_REDIRECT = `${PROD_SITE}/api/integrations/xero/callback`;
const DEV_SITE = "http://localhost:3000";
const DEV_XERO_REDIRECT = `${DEV_SITE}/api/integrations/xero/callback`;

const sharedKeys = [
  "NEXT_PUBLIC_CONVEX_URL",
  "CONVEX_SITE_URL",
  "CONVEX_DEPLOYMENT",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  "NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL",
  "XERO_CLIENT_ID",
  "XERO_CLIENT_SECRET",
  "INTEGRATION_CALLBACK_SECRET",
  "RESEND_API_KEY",
  "RESEND_DOMAIN",
];

for (const key of sharedKeys) {
  const v = local[key];
  if (!v) {
    console.warn(`[skip] ${key}: not in .env.local`);
    continue;
  }
  for (const target of ["production", "preview", "development"]) {
    envAdd(key, target, v);
  }
}

// Optional Mapbox
const mapbox = local.MAPBOX_PUBLIC_TOKEN || local.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (mapbox) {
  const k = local.MAPBOX_PUBLIC_TOKEN ? "MAPBOX_PUBLIC_TOKEN" : "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN";
  for (const target of ["production", "preview", "development"]) {
    envAdd(k, target, mapbox);
  }
}

// Site + Xero redirect: prod vs dev (doc); preview uses prod URLs so links match live domain
envAdd("NEXT_PUBLIC_SITE_URL", "production", PROD_SITE);
envAdd("XERO_REDIRECT_URI", "production", PROD_XERO_REDIRECT);
envAdd("NEXT_PUBLIC_SITE_URL", "preview", PROD_SITE);
envAdd("XERO_REDIRECT_URI", "preview", PROD_XERO_REDIRECT);
envAdd("NEXT_PUBLIC_SITE_URL", "development", DEV_SITE);
envAdd("XERO_REDIRECT_URI", "development", DEV_XERO_REDIRECT);

console.log("\nVerify: npx vercel env ls");
console.log("Convex: npx convex env get INTEGRATION_CALLBACK_SECRET — must match Vercel.");
