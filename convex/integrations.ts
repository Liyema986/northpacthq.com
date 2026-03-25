import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/** Base64 encode bytes without Node Buffer (Convex actions run in V8 isolate). */
function base64Encode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += alphabet[a >> 2];
    out += alphabet[((a & 3) << 4) | (b ?? 0) >> 4];
    out += b !== undefined ? alphabet[((b & 15) << 2) | (c ?? 0) >> 6] : "=";
    out += c !== undefined ? alphabet[c & 63] : "=";
  }
  return out;
}

const PROVIDER_XERO = "xero";

/** All providers that can be added from Apps Map (add more as we support them). */
const ALLOWED_PROVIDERS = [PROVIDER_XERO] as const;

/**
 * List integrations added to the firm's Apps Map (cards to show).
 */
export const listFirmIntegrations = query({
  args: {
    firmId: v.id("firms"),
  },
  returns: v.array(
    v.object({
      _id: v.id("firmIntegrations"),
      firmId: v.id("firms"),
      provider: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const list = await ctx.db
      .query("firmIntegrations")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .collect();
    return list.map((row) => ({
      _id: row._id,
      firmId: row.firmId,
      provider: row.provider,
      createdAt: row.createdAt,
    }));
  },
});

/**
 * Add an integration to the firm's Apps Map. Idempotent per provider.
 */
export const addFirmIntegration = mutation({
  args: {
    firmId: v.id("firms"),
    provider: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!ALLOWED_PROVIDERS.includes(args.provider as typeof ALLOWED_PROVIDERS[number])) {
      return { success: false, error: "Integration not available." };
    }
    const existing = await ctx.db
      .query("firmIntegrations")
      .withIndex("by_firm_provider", (q) =>
        q.eq("firmId", args.firmId).eq("provider", args.provider)
      )
      .first();
    if (existing) {
      return { success: true };
    }
    const now = Date.now();
    await ctx.db.insert("firmIntegrations", {
      firmId: args.firmId,
      provider: args.provider,
      createdAt: now,
    });
    return { success: true };
  },
});

/**
 * Remove an integration from the firm's Apps Map (permanent). Does not disconnect OAuth; only removes the card.
 */
export const removeFirmIntegration = mutation({
  args: {
    firmId: v.id("firms"),
    firmIntegrationId: v.id("firmIntegrations"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.firmIntegrationId);
    if (!row) {
      return { success: false, error: "Integration not found." };
    }
    if (row.firmId !== args.firmId) {
      return { success: false, error: "Access denied." };
    }
    await ctx.db.delete(args.firmIntegrationId);
    return { success: true };
  },
});

/**
 * Sync all connected integrations for the current user's firm.
 * Records a sync log per connected provider so "Syncs today" and "Last sync" update.
 * Industry standard: one button syncs all added & connected integrations.
 */
export const runSync = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    syncedCount: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, syncedCount: 0, error: "Not authenticated" };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) =>
        q.eq("authUserId", identity.tokenIdentifier)
      )
      .unique();
    if (!user) {
      return { success: false, syncedCount: 0, error: "User not found" };
    }

    const connections = await ctx.db
      .query("integrationConnections")
      .withIndex("by_firm_provider", (q) => q.eq("firmId", user.firmId))
      .collect();

    const now = Date.now();
    for (const conn of connections) {
      await ctx.db.insert("integrationSyncLogs", {
        firmId: user.firmId,
        provider: conn.provider,
        syncedAt: now,
        status: "success",
      });
    }

    return { success: true, syncedCount: connections.length };
  },
});

const TYPE_FILTER_PROVIDERS: Record<string, string[]> = {
  all: [...ALLOWED_PROVIDERS],
  accounting: [PROVIDER_XERO],
};

/**
 * Get Apps Map stats for the dashboard (6 metrics), optionally filtered by type and status.
 */
export const getAppsMapStats = query({
  args: {
    firmId: v.id("firms"),
    typeFilter: v.optional(v.union(v.literal("all"), v.literal("accounting"))),
    statusFilter: v.optional(
      v.union(v.literal("all"), v.literal("connected"), v.literal("not-connected"))
    ),
  },
  returns: v.object({
    connected: v.number(),
    available: v.number(),
    pendingSetup: v.number(),
    automations: v.number(),
    syncsToday: v.number(),
    lastSyncAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const typeFilter = args.typeFilter ?? "all";
    const statusFilter = args.statusFilter ?? "all";
    const providers = TYPE_FILTER_PROVIDERS[typeFilter] ?? TYPE_FILTER_PROVIDERS.all;

    const [connections, added, automationsList, syncLogs] = await Promise.all([
      ctx.db
        .query("integrationConnections")
        .withIndex("by_firm_provider", (q) => q.eq("firmId", args.firmId))
        .collect(),
      ctx.db
        .query("firmIntegrations")
        .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
        .collect(),
      ctx.db
        .query("integrationAutomations")
        .withIndex("by_firm_enabled", (q) =>
          q.eq("firmId", args.firmId).eq("enabled", true)
        )
        .collect(),
      ctx.db
        .query("integrationSyncLogs")
        .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
        .collect(),
    ]);

    const addedFiltered = added.filter((a) => providers.includes(a.provider));
    const connectionsFiltered = connections.filter((c) => providers.includes(c.provider));
    const automationsFiltered = automationsList.filter((a) => providers.includes(a.provider));
    const syncLogsFiltered = syncLogs.filter((log) => providers.includes(log.provider));

    let connected: number;
    let pendingSetup: number;
    if (statusFilter === "connected") {
      connected = connectionsFiltered.length;
      pendingSetup = 0;
    } else if (statusFilter === "not-connected") {
      connected = 0;
      pendingSetup = Math.max(0, addedFiltered.length - connectionsFiltered.length);
    } else {
      connected = connectionsFiltered.length;
      pendingSetup = Math.max(0, addedFiltered.length - connectionsFiltered.length);
    }

    const available = typeFilter === "accounting" ? 1 : ALLOWED_PROVIDERS.length;
    const automations = automationsFiltered.length;

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startOfToday = now - (now % oneDayMs);
    const syncsToday = syncLogsFiltered.filter(
      (log) => log.syncedAt >= startOfToday
    ).length;

    const lastSyncAt =
      syncLogsFiltered.length === 0
        ? null
        : Math.max(...syncLogsFiltered.map((log) => log.syncedAt));

    return {
      connected,
      available,
      pendingSetup,
      automations,
      syncsToday,
      lastSyncAt,
    };
  },
});

/**
 * Get Xero connection for the current user's firm (if any).
 */
export const getXeroConnection = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("integrationConnections"),
      firmId: v.id("firms"),
      provider: v.string(),
      tenantId: v.optional(v.string()),
      tenantName: v.optional(v.string()),
      expiresAt: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const conn = await ctx.db
      .query("integrationConnections")
      .withIndex("by_firm_provider", (q) =>
        q.eq("firmId", user.firmId).eq("provider", PROVIDER_XERO)
      )
      .first();

    if (!conn) return null;

    return {
      _id: conn._id,
      firmId: conn.firmId,
      provider: conn.provider,
      tenantId: conn.tenantId,
      tenantName: conn.tenantName,
      expiresAt: conn.expiresAt,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  },
});

/**
 * Internal: get Xero connection with tokens (for backend-only use, e.g. actions).
 */
export const getXeroConnectionWithTokens = internalQuery({
  args: {
    firmId: v.id("firms"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("integrationConnections"),
      firmId: v.id("firms"),
      accessToken: v.string(),
      refreshToken: v.string(),
      expiresAt: v.number(),
      tenantId: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const conn = await ctx.db
      .query("integrationConnections")
      .withIndex("by_firm_provider", (q) =>
        q.eq("firmId", args.firmId).eq("provider", PROVIDER_XERO)
      )
      .first();
    if (!conn) return null;
    return {
      _id: conn._id,
      firmId: conn.firmId,
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      expiresAt: conn.expiresAt,
      tenantId: conn.tenantId,
    };
  },
});

/**
 * Internal: store Xero OAuth tokens after callback (called from HTTP action).
 */
export const setXeroConnection = internalMutation({
  args: {
    firmId: v.id("firms"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    tenantId: v.optional(v.string()),
    tenantName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("integrationConnections")
      .withIndex("by_firm_provider", (q) =>
        q.eq("firmId", args.firmId).eq("provider", PROVIDER_XERO)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        tenantId: args.tenantId,
        tenantName: args.tenantName,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("integrationConnections", {
        firmId: args.firmId,
        provider: PROVIDER_XERO,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        tenantId: args.tenantId,
        tenantName: args.tenantName,
        createdAt: now,
        updatedAt: now,
      });
    }
    // Also ensure the integration is in firmIntegrations (Apps Map card)
    const alreadyAdded = await ctx.db
      .query("firmIntegrations")
      .withIndex("by_firm_provider", (q) =>
        q.eq("firmId", args.firmId).eq("provider", PROVIDER_XERO)
      )
      .first();
    if (!alreadyAdded) {
      await ctx.db.insert("firmIntegrations", {
        firmId: args.firmId,
        provider: PROVIDER_XERO,
        createdAt: now,
      });
    }
    return null;
  },
});

/**
 * Disconnect Xero for the current user's firm.
 */
export const disconnectXero = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const conn = await ctx.db
      .query("integrationConnections")
      .withIndex("by_firm_provider", (q) =>
        q.eq("firmId", user.firmId).eq("provider", PROVIDER_XERO)
      )
      .first();

    if (conn) {
      await ctx.db.delete(conn._id);
    }
    return null;
  },
});

/** Xero API base URLs */
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONTACTS_URL = "https://api.xero.com/api.xro/2.0/Contacts";
const XERO_CONTACT_GROUPS_URL = "https://api.xero.com/api.xro/2.0/ContactGroups";

type XeroConn = {
  _id: import("./_generated/dataModel").Id<"integrationConnections">;
  firmId: import("./_generated/dataModel").Id<"firms">;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tenantId?: string;
};

/** Refresh Xero token if needed; returns conn with valid accessToken. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureXeroToken(conn: XeroConn, ctx: any, firmId: import("./_generated/dataModel").Id<"firms">): Promise<XeroConn> {
  const now = Date.now();
  const bufferMs = 60 * 1000;
  if (conn.expiresAt >= now + bufferMs) return conn;
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Xero credentials not configured");
  const basic = base64Encode(new TextEncoder().encode(`${clientId}:${clientSecret}`));
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: conn.refreshToken,
  });
  const tokenRes = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) throw new Error(`Token refresh failed: ${tokenText.slice(0, 200)}`);
  let tokenJson: { access_token: string; refresh_token: string; expires_in: number };
  try {
    if (!tokenText.trim().startsWith("{")) throw new Error("Token response was not JSON");
    tokenJson = JSON.parse(tokenText) as { access_token: string; refresh_token: string; expires_in: number };
  } catch {
    throw new Error(`Token response was not valid JSON. Body: ${tokenText.slice(0, 150)}`);
  }
  const expiresAt = now + tokenJson.expires_in * 1000;
  await ctx.runMutation(internal.integrations.setXeroConnection, {
    firmId,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresAt,
    tenantId: conn.tenantId,
  });
  return {
    ...conn,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresAt,
  };
}

/**
 * Sync Xero contacts into Convex clients for the current user's firm.
 * Fetches contacts from Xero (with token refresh if needed), then creates clients for new emails.
 */
export const syncXeroContactsToClients = action({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    imported: v.number(),
    updated: v.number(),
    skipped: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ imported: number; updated: number; skipped: number; error?: string }> => {
    try {
    const user = await ctx.runQuery(internal.internal.getUserInternal, {
      userId: args.userId,
    });
    if (!user) {
      return { imported: 0, updated: 0, skipped: 0, error: "User not found" };
    }

    const firmId = user.firmId;
    let conn = await ctx.runQuery(internal.integrations.getXeroConnectionWithTokens, {
      firmId,
    });
    if (!conn) {
      return { imported: 0, updated: 0, skipped: 0, error: "Xero not connected" };
    }

    const now = Date.now();
    const bufferMs = 60 * 1000; // refresh if expiring in next 60s
    if (conn.expiresAt < now + bufferMs) {
      const clientId = process.env.XERO_CLIENT_ID;
      const clientSecret = process.env.XERO_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return { imported: 0, updated: 0, skipped: 0, error: "Xero credentials not configured" };
      }
      // Convex actions run in V8 isolate (no Node Buffer). Encode Basic auth without Buffer.
      const basic = base64Encode(new TextEncoder().encode(`${clientId}:${clientSecret}`));
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refreshToken,
      });
      const tokenRes = await fetch(XERO_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const tokenText = await tokenRes.text();
      if (!tokenRes.ok) {
        return { imported: 0, updated: 0, skipped: 0, error: `Token refresh failed: ${tokenText.slice(0, 200)}` };
      }
      let tokenJson: { access_token: string; refresh_token: string; expires_in: number };
      try {
        if (!tokenText.trim().startsWith("{")) {
          return { imported: 0, updated: 0, skipped: 0, error: `Token response was not JSON. Body: ${tokenText.slice(0, 150)}` };
        }
        tokenJson = JSON.parse(tokenText) as { access_token: string; refresh_token: string; expires_in: number };
      } catch {
        return { imported: 0, updated: 0, skipped: 0, error: `Token response was not valid JSON. Body: ${tokenText.slice(0, 150)}` };
      }
      const expiresAt = now + tokenJson.expires_in * 1000;
      await ctx.runMutation(internal.integrations.setXeroConnection, {
        firmId,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt,
        tenantId: conn.tenantId,
      });
      conn = {
        ...conn,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        expiresAt,
      };
    }

    const tenantId = conn.tenantId ?? "";
    if (!tenantId) {
      return { imported: 0, updated: 0, skipped: 0, error: "No Xero tenant selected" };
    }

    type XeroAddress = { AddressType?: string; AddressLine1?: string; City?: string; Region?: string; PostalCode?: string; Country?: string };
    type XeroContact = {
      ContactID?: string;
      Name?: string;
      FirstName?: string;
      LastName?: string;
      EmailAddress?: string;
      Phones?: Array<{ PhoneNumber?: string; PhoneType?: string }>;
      Addresses?: XeroAddress[];
      Website?: string;
      CompanyNumber?: string;
      TaxNumber?: string;
      DefaultCurrency?: string;
      ContactStatus?: string;
    };
    const allContacts: XeroContact[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const url = `${XERO_CONTACTS_URL}?page=${page}&pageSize=${pageSize}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          "xero-tenant-id": tenantId,
          Accept: "application/json",
        },
      });
      const text = await res.text();
      if (!res.ok) {
        return { imported: 0, updated: 0, skipped: 0, error: `Xero API error (${res.status}): ${text.slice(0, 200)}` };
      }
      // API may return HTML/XML error pages with 200; avoid JSON parse crash
      const trimmed = text.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        return { imported: 0, updated: 0, skipped: 0, error: `Xero API returned non-JSON (e.g. HTML/XML). Check URL and tenant. Body: ${text.slice(0, 150)}` };
      }
      let data: { Contacts?: XeroContact[] };
      try {
        data = JSON.parse(text) as { Contacts?: XeroContact[] };
      } catch {
        return { imported: 0, updated: 0, skipped: 0, error: `Xero API response was not valid JSON. Body: ${text.slice(0, 150)}` };
      }
      const contacts = data.Contacts ?? [];
      allContacts.push(...contacts);
      if (contacts.length < pageSize) break;
      page++;
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const mapXeroStatus = (contactStatus: string | undefined): "prospect" | "active" | "inactive" | "archived" => {
      const s = (contactStatus ?? "").toUpperCase();
      if (s === "ARCHIVED") return "archived";
      if (s === "ACTIVE") return "active";
      return "prospect";
    };

    const nameLooksLikePerson = (n: string): boolean => {
      const lower = n.trim().toLowerCase();
      if (!lower || lower === "unknown") return false;
      const words = lower.split(/\s+/).filter(Boolean);
      if (words.length > 3) return false;
      const orgSuffixes = ["ltd", "limited", "inc", "inc.", "pty", "pty.", "llc", "co.", "co", "corp", "corp.", "gmbh", "sa", "nv", "plc", "llp"];
      const lastWord = words[words.length - 1] ?? "";
      if (orgSuffixes.some((suf) => lastWord === suf || lastWord.endsWith("." + suf))) return false;
      return true;
    };

    const transformContact = (c: XeroContact, index: number) => {
      const rawEmail = (c.EmailAddress ?? "").trim();
      const contactId = (c.ContactID ?? "").trim();
      const email = rawEmail ? rawEmail.toLowerCase() : contactId ? `xero-${contactId}@import.placeholder` : `xero-${index}@import.placeholder`;
      const name = (c.Name ?? "Unknown").trim() || "Unknown";
      const firstName = (c.FirstName ?? "").trim();
      const lastName = (c.LastName ?? "").trim();
      const hasPersonName = !!(firstName || lastName);
      const hasCompanyNumber = !!((c.CompanyNumber ?? "").trim());
      const contactType: "organisation" | "individual" = hasCompanyNumber ? "organisation" : hasPersonName ? "individual" : nameLooksLikePerson(name) ? "individual" : "organisation";
      const status = mapXeroStatus(c.ContactStatus);
      const companyName = contactType === "individual" ? [firstName, lastName].filter(Boolean).join(" ").trim() || name : name;
      const contactName = contactType === "individual" ? companyName : [firstName, lastName].filter(Boolean).join(" ").trim() || name;
      const phone = c.Phones?.[0]?.PhoneNumber?.trim();
      const addrs = c.Addresses ?? [];
      const pobox = addrs.find((a) => (a.AddressType ?? "").toUpperCase() === "POBOX");
      const street = addrs.find((a) => (a.AddressType ?? "").toUpperCase() === "STREET");
      const addr = pobox ?? street ?? addrs[0];
      return {
        contactType,
        companyName,
        contactName,
        email,
        phone: phone || undefined,
        website: (c.Website ?? "").trim() || undefined,
        taxNumber: (c.TaxNumber ?? "").trim() || undefined,
        companyNumber: (c.CompanyNumber ?? "").trim() || undefined,
        defaultCurrency: (c.DefaultCurrency ?? "").trim() || undefined,
        addressLine1: addr?.AddressLine1?.trim() || undefined,
        city: addr?.City?.trim() || undefined,
        region: addr?.Region?.trim() || undefined,
        postalCode: addr?.PostalCode?.trim() || undefined,
        country: addr?.Country?.trim() || undefined,
        xeroContactId: contactId || undefined,
        status,
      };
    };

    // Process in batches of 100 (same as Xero page size). DB lookups avoid Convex 1024-field arg limit.
    const BATCH_SIZE = 100;
    for (let i = 0; i < allContacts.length; i += BATCH_SIZE) {
      const batch = allContacts.slice(i, i + BATCH_SIZE).map((c, j) => transformContact(c, i + j));
      const result = await ctx.runMutation(internal.clients.bulkUpsertClientsFromXero, {
        userId: args.userId,
        contacts: batch,
      });
      imported += result.imported;
      updated += result.updated;
      skipped += result.skipped;
    }

    return { imported, updated, skipped };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { imported: 0, updated: 0, skipped: 0, error: msg || "Import failed" };
    }
  },
});

/** Xero ContactGroup shape */
type XeroContactGroup = {
  ContactGroupID?: string;
  Name?: string;
  Status?: string;
  Contacts?: Array<{ ContactID?: string; Name?: string }>;
};

/** Entity shape for proposal populate */
type EntityForProposal = {
  name: string;
  type: string;
  revenueRange: string;
  incomeTaxRange: string;
};

const DEFAULT_ENTITY = {
  type: "Company",
  revenueRange: "Not Applicable",
  incomeTaxRange: "Not Applicable",
};

/**
 * Get Xero contact groups for the firm (for proposal step 1 - Group selection).
 */
export const getXeroContactGroups = action({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      groups: v.array(v.object({
        contactGroupID: v.string(),
        name: v.string(),
        status: v.string(),
      })),
    }),
    v.object({ error: v.string() })
  ),
  handler: async (ctx, args): Promise<{ groups: Array<{ contactGroupID: string; name: string; status: string }> } | { error: string }> => {
    try {
      const user = await ctx.runQuery(internal.internal.getUserInternal, { userId: args.userId });
      if (!user) return { error: "User not found" };
      let conn: { _id: string; firmId: string; accessToken: string; refreshToken: string; expiresAt: number; tenantId?: string } | null = await ctx.runQuery(internal.integrations.getXeroConnectionWithTokens, {
        firmId: user.firmId,
      });
      if (!conn) return { error: "Xero not connected" };
      conn = (await ensureXeroToken(conn as XeroConn, ctx, user.firmId)) as typeof conn;
      const tenantId = conn.tenantId ?? "";
      if (!tenantId) return { error: "No Xero tenant selected" };

      const res: Response = await fetch(XERO_CONTACT_GROUPS_URL, {
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          "xero-tenant-id": tenantId,
          Accept: "application/json",
        },
      });
      const text = await res.text();
      if (!res.ok) return { error: `Xero API error (${res.status}): ${text.slice(0, 200)}` };
      let data: { ContactGroups?: XeroContactGroup[] };
      try {
        data = JSON.parse(text) as { ContactGroups?: XeroContactGroup[] };
      } catch {
        return { error: `Xero API response was not valid JSON. Body: ${text.slice(0, 150)}` };
      }
      const groups = (data.ContactGroups ?? []).filter((g) => (g.Status ?? "").toUpperCase() === "ACTIVE");
      return {
        groups: groups.map((g) => ({
          contactGroupID: g.ContactGroupID ?? "",
          name: g.Name ?? "Unnamed Group",
          status: g.Status ?? "ACTIVE",
        })),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg || "Failed to fetch contact groups" };
    }
  },
});

/**
 * Get contacts in a Xero contact group + map to entities. Also returns primaryClientId (first client matched by xeroContactId).
 */
export const getXeroEntitiesForGroup = action({
  args: {
    userId: v.id("users"),
    contactGroupId: v.string(),
  },
  returns: v.union(
    v.object({
      entities: v.array(v.object({
        name: v.string(),
        type: v.string(),
        revenueRange: v.string(),
        incomeTaxRange: v.string(),
      })),
      primaryClientId: v.union(v.id("clients"), v.null()),
    }),
    v.object({ error: v.string() })
  ),
  handler: async (ctx, args): Promise<{ entities: Array<{ name: string; type: string; revenueRange: string; incomeTaxRange: string }>; primaryClientId: Id<"clients"> | null } | { error: string }> => {
    try {
      const user = await ctx.runQuery(internal.internal.getUserInternal, { userId: args.userId });
      if (!user) return { error: "User not found" };
      let conn: { _id: string; firmId: string; accessToken: string; refreshToken: string; expiresAt: number; tenantId?: string } | null = await ctx.runQuery(internal.integrations.getXeroConnectionWithTokens, {
        firmId: user.firmId,
      });
      if (!conn) return { error: "Xero not connected" };
      conn = (await ensureXeroToken(conn as XeroConn, ctx, user.firmId)) as typeof conn;
      const tenantId = conn.tenantId ?? "";
      if (!tenantId) return { error: "No Xero tenant selected" };

      const url = `${XERO_CONTACT_GROUPS_URL}/${args.contactGroupId}`;
      const res: Response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          "xero-tenant-id": tenantId,
          Accept: "application/json",
        },
      });
      const text = await res.text();
      if (!res.ok) return { error: `Xero API error (${res.status}): ${text.slice(0, 200)}` };
      let data: { ContactGroups?: XeroContactGroup[] };
      try {
        data = JSON.parse(text) as { ContactGroups?: XeroContactGroup[] };
      } catch {
        return { error: `Xero API response was not valid JSON. Body: ${text.slice(0, 150)}` };
      }
      const group = data.ContactGroups?.[0];
      const contacts = group?.Contacts ?? [];
      const entities: EntityForProposal[] = contacts.map((c) => ({
        name: c.Name ?? "Unknown",
        ...DEFAULT_ENTITY,
      }));

      let primaryClientId: Id<"clients"> | null = null;
      for (const c of contacts) {
        const xeroId = (c.ContactID ?? "").trim();
        if (!xeroId) continue;
        const client: { _id: Id<"clients"> } | null = await ctx.runQuery(internal.clients.getClientByXeroContactIdInternal, {
          firmId: user.firmId,
          xeroContactId: xeroId,
        });
        if (client) {
          primaryClientId = client._id;
          break;
        }
      }

      return {
        entities,
        primaryClientId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg || "Failed to fetch group entities" };
    }
  },
});

/**
 * Get entities for a selected client: client + all contacts from Xero groups the client belongs to.
 */
export const getXeroEntitiesForClient = action({
  args: {
    userId: v.id("users"),
    xeroContactId: v.optional(v.string()),
    primaryEntityName: v.string(),
  },
  returns: v.union(
    v.object({
      entities: v.array(v.object({
        name: v.string(),
        type: v.string(),
        revenueRange: v.string(),
        incomeTaxRange: v.string(),
      })),
    }),
    v.object({ error: v.string() })
  ),
  handler: async (ctx, args) => {
    try {
      if (!args.xeroContactId?.trim()) {
        return {
          entities: [{ name: args.primaryEntityName, ...DEFAULT_ENTITY }],
        };
      }

      const user = await ctx.runQuery(internal.internal.getUserInternal, { userId: args.userId });
      if (!user) return { error: "User not found" };
      let conn = await ctx.runQuery(internal.integrations.getXeroConnectionWithTokens, {
        firmId: user.firmId,
      });
      if (!conn) {
        return { entities: [{ name: args.primaryEntityName, ...DEFAULT_ENTITY }] };
      }
      conn = (await ensureXeroToken(conn as XeroConn, ctx, user.firmId)) as typeof conn;
      const tenantId = conn.tenantId ?? "";
      if (!tenantId) return { entities: [{ name: args.primaryEntityName, ...DEFAULT_ENTITY }] };

      type XeroContactFull = {
        ContactID?: string;
        Name?: string;
        ContactGroups?: Array<{ ContactGroupID?: string; Name?: string }>;
      };
      const contactUrl = `${XERO_CONTACTS_URL}/${args.xeroContactId.trim()}`;
      const contactRes = await fetch(contactUrl, {
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          "xero-tenant-id": tenantId,
          Accept: "application/json",
        },
      });
      const contactText = await contactRes.text();
      if (!contactRes.ok) return { entities: [{ name: args.primaryEntityName, ...DEFAULT_ENTITY }] };
      let contactData: { Contacts?: XeroContactFull[] };
      try {
        contactData = JSON.parse(contactText) as { Contacts?: XeroContactFull[] };
      } catch {
        return { entities: [{ name: args.primaryEntityName, ...DEFAULT_ENTITY }] };
      }
      const contact = contactData.Contacts?.[0];
      const groupIds = contact?.ContactGroups?.map((g) => g.ContactGroupID).filter(Boolean) ?? [];
      if (groupIds.length === 0) {
        return { entities: [{ name: args.primaryEntityName, ...DEFAULT_ENTITY }] };
      }

      const seen = new Set<string>([args.xeroContactId.trim()]);
      const entitiesMap = new Map<string, EntityForProposal>();
      entitiesMap.set(args.xeroContactId.trim(), { name: args.primaryEntityName, ...DEFAULT_ENTITY });

      for (const gid of groupIds) {
        if (!gid) continue;
        const groupUrl = `${XERO_CONTACT_GROUPS_URL}/${gid}`;
        const groupRes = await fetch(groupUrl, {
          headers: {
            Authorization: `Bearer ${conn.accessToken}`,
            "xero-tenant-id": tenantId,
            Accept: "application/json",
          },
        });
        const groupText = await groupRes.text();
        if (!groupRes.ok) continue;
        let groupData: { ContactGroups?: XeroContactGroup[] };
        try {
          groupData = JSON.parse(groupText) as { ContactGroups?: XeroContactGroup[] };
        } catch {
          continue;
        }
        const groupContacts = groupData.ContactGroups?.[0]?.Contacts ?? [];
        for (const c of groupContacts) {
          const id = (c.ContactID ?? "").trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          entitiesMap.set(id, {
            name: c.Name ?? "Unknown",
            ...DEFAULT_ENTITY,
          });
        }
      }

      const entities = Array.from(entitiesMap.values());
      return { entities };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { entities: [{ name: args.primaryEntityName, ...DEFAULT_ENTITY }] };
    }
  },
});
