import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function errorRedirect(baseUrl: string, reason: string): NextResponse {
  return NextResponse.redirect(
    `${baseUrl}/appsmap?xero=error&reason=${encodeURIComponent(reason)}`
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = getBaseUrl(request);

  if (error) {
    console.error("[Xero OAuth] Error from Xero:", error, errorDescription);
    return errorRedirect(baseUrl, errorDescription || error);
  }

  if (!code || !state) {
    console.error("[Xero OAuth] Missing code or state");
    return errorRedirect(baseUrl, "missing_code_or_state");
  }

  // Parse state
  let firmId: string;
  let parsedState: { firmId: string; nonce?: string; exp?: number; sig?: string };
  try {
    parsedState = JSON.parse(decodeURIComponent(state)) as {
      firmId: string;
      nonce?: string;
      exp?: number;
      sig?: string;
    };
    firmId = parsedState.firmId;
  } catch {
    console.error("[Xero OAuth] state is not valid JSON");
    return errorRedirect(baseUrl, "invalid_state");
  }

  if (!firmId) {
    console.error("[Xero OAuth] firmId missing from state");
    return errorRedirect(baseUrl, "invalid_state");
  }

  const xeroClientId = process.env.XERO_CLIENT_ID;
  const xeroClientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri =
    process.env.XERO_REDIRECT_URI ??
    `${baseUrl}/api/integrations/xero/callback`;
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  const integrationSecret = process.env.INTEGRATION_CALLBACK_SECRET;

  const missingVars: string[] = [];
  if (!xeroClientId) missingVars.push("XERO_CLIENT_ID");
  if (!xeroClientSecret) missingVars.push("XERO_CLIENT_SECRET");
  if (!convexSiteUrl) missingVars.push("CONVEX_SITE_URL");
  if (!integrationSecret) missingVars.push("INTEGRATION_CALLBACK_SECRET");

  if (missingVars.length > 0) {
    console.error("[Xero OAuth] Missing env vars:", missingVars.join(", "));
    return errorRedirect(baseUrl, "server_config_missing");
  }

  // Verify HMAC-signed state (replaces cookie-based CSRF check).
  // Cookies from OAuth redirect responses are unreliable across browsers —
  // Chrome can silently drop sameSite: lax cookies in cross-origin redirect chains.
  const { nonce, exp, sig } = parsedState;
  if (!nonce || !exp || !sig) {
    console.error("[Xero OAuth] State missing nonce/exp/sig fields — possible old or tampered state");
    return errorRedirect(baseUrl, "csrf_mismatch");
  }

  if (Date.now() > exp) {
    console.error("[Xero OAuth] State expired", { exp, now: Date.now() });
    return errorRedirect(baseUrl, "state_expired");
  }

  const expectedPayload = JSON.stringify({ firmId, nonce, exp });
  const expectedSig = createHmac("sha256", integrationSecret!).update(expectedPayload).digest("hex");
  if (sig !== expectedSig) {
    console.error("[Xero OAuth] HMAC signature mismatch — possible CSRF or tampering");
    return errorRedirect(baseUrl, "csrf_mismatch");
  }

  // Exchange authorization code for tokens
  const basicAuth = Buffer.from(
    `${xeroClientId}:${xeroClientSecret}`
  ).toString("base64");

  let tokenRes: Response;
  try {
    tokenRes = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
  } catch (e) {
    console.error("[Xero OAuth] Token exchange network error:", e);
    return errorRedirect(baseUrl, "token_exchange_network_error");
  }

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => "");
    console.error("[Xero OAuth] Token exchange failed:", tokenRes.status, errBody);
    return errorRedirect(baseUrl, "token_exchange_failed");
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    tenant_id?: string;
  };

  if (!tokenData.access_token || !tokenData.refresh_token) {
    console.error("[Xero OAuth] Token response missing access/refresh token");
    return errorRedirect(baseUrl, "invalid_token_response");
  }

  const expiresAt = Date.now() + (tokenData.expires_in ?? 1800) * 1000;

  // Resolve tenantId from /connections (with retry for propagation delay)
  let tenantId = tokenData.tenant_id;
  let tenantName: string | undefined;

  if (!tenantId) {
    let authEventId: string | undefined;
    try {
      const payload = JSON.parse(
        Buffer.from(tokenData.access_token.split(".")[1]!, "base64").toString("utf8")
      ) as { authentication_event_id?: string };
      authEventId = payload.authentication_event_id;
    } catch {
      // JWT decode is best-effort
    }

    type XeroConnection = { tenantId: string; tenantType?: string; tenantName?: string };
    const fetchConnections = async (url: string): Promise<XeroConnection[]> => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!res.ok) return [];
      return (await res.json()) as XeroConnection[];
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Retry delays: immediate → 1.5 s → 3 s (handles Xero propagation lag)
    const RETRY_DELAYS_MS = [0, 1500, 3000];

    try {
      for (const delay of RETRY_DELAYS_MS) {
        if (delay > 0) await sleep(delay);

        let connections: XeroConnection[] = [];
        if (authEventId) {
          connections = await fetchConnections(
            `${XERO_CONNECTIONS_URL}?authEventId=${encodeURIComponent(authEventId)}`
          );
        }
        // Fallback to all connections (handles re-connect where no new record is created)
        if (connections.length === 0) {
          connections = await fetchConnections(XERO_CONNECTIONS_URL);
        }

        const org =
          connections.find((c) => c.tenantType === "ORGANISATION") ?? connections[0];
        if (org?.tenantId) {
          tenantId = org.tenantId;
          tenantName = org.tenantName;
          break;
        }
      }
    } catch (e) {
      console.warn("[Xero OAuth] Connections API error:", e);
    }
  }

  if (!tenantId) {
    console.error("[Xero OAuth] Could not determine tenantId");
    return errorRedirect(baseUrl, "no_tenant_id");
  }

  // POST tokens to Convex via the secure HTTP action
  const storeUrl = `${convexSiteUrl!.replace(/\/$/, "")}/api/integrations/xero/store-tokens`;
  let storeRes: Response;
  try {
    storeRes = await fetch(storeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Integration-Secret": integrationSecret!,
      },
      body: JSON.stringify({
        firmId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        tenantId,
        tenantName,
      }),
    });
  } catch (e) {
    console.error("[Xero OAuth] Failed to reach Convex store-tokens:", e);
    return errorRedirect(baseUrl, "store_tokens_network_error");
  }

  if (!storeRes.ok) {
    const errBody = await storeRes.text().catch(() => "");
    console.error("[Xero OAuth] store-tokens failed:", storeRes.status, errBody);
    return errorRedirect(baseUrl, "store_tokens_failed");
  }

  return NextResponse.redirect(`${baseUrl}/appsmap?xero=success`);
}
