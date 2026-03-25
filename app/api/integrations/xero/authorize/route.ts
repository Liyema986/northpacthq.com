import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHmac } from "crypto";
import { auth } from "@clerk/nextjs/server";

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";

// Granular scopes — required for apps created on/after 2 March 2026.
// accounting.transactions has been split into: invoices, payments, banktransactions, manualjournals
const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  // Transactions (replaces broad accounting.transactions)
  "accounting.invoices",
  "accounting.invoices.read",
  "accounting.payments",
  "accounting.payments.read",
  "accounting.banktransactions",
  "accounting.banktransactions.read",
  // Contacts
  "accounting.contacts",
  "accounting.contacts.read",
  // Settings (organisation + chart of accounts)
  "accounting.settings",
  "accounting.settings.read",
  // Attachments
  "accounting.attachments",
  "accounting.attachments.read",
].join(" ");

function deriveRedirectUri(request: NextRequest): string | null {
  if (process.env.XERO_REDIRECT_URI) return process.env.XERO_REDIRECT_URI;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  if (host) return `${proto}://${host}/api/integrations/xero/callback`;
  return null;
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const firmId = request.nextUrl.searchParams.get("firmId");
  if (!firmId) {
    return NextResponse.json({ error: "Missing firmId" }, { status: 400 });
  }

  const xeroClientId = process.env.XERO_CLIENT_ID;
  const redirectUri = deriveRedirectUri(request);
  const secret = process.env.INTEGRATION_CALLBACK_SECRET;

  if (!xeroClientId) {
    console.error("[Xero OAuth] XERO_CLIENT_ID is not set");
    return NextResponse.json(
      { error: "Xero integration is not configured. Contact your administrator." },
      { status: 500 }
    );
  }

  if (!redirectUri) {
    console.error("[Xero OAuth] Could not determine redirect URI");
    return NextResponse.json(
      { error: "Xero redirect URI is not configured. Contact your administrator." },
      { status: 500 }
    );
  }

  if (!secret) {
    console.error("[Xero OAuth] INTEGRATION_CALLBACK_SECRET is not set");
    return NextResponse.json(
      { error: "Integration secret is not configured. Contact your administrator." },
      { status: 500 }
    );
  }

  // CSRF protection via HMAC-signed state — no cookie needed.
  // Cookies from OAuth redirect responses are unreliable across browsers
  // (Chrome can drop sameSite: lax cookies in cross-origin redirect chains).
  const nonce = randomBytes(16).toString("hex");
  const exp = Date.now() + 5 * 60 * 1000; // 5 min window
  const payload = JSON.stringify({ firmId, nonce, exp });
  const sig = createHmac("sha256", secret).update(payload).digest("hex");

  const stateObj = { firmId, nonce, exp, sig };
  const state = encodeURIComponent(JSON.stringify(stateObj));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: xeroClientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });

  const authorizeUrl = `${XERO_AUTHORIZE_URL}?${params.toString()}`;
  return NextResponse.redirect(authorizeUrl);
}
