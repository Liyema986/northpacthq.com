import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getUserFirmId, getUserFirmIdSafe, requirePermission } from "./lib/permissions";
import { logAuditEntry } from "./lib/auditLog";
import { AuditActions, EntityTypes } from "./lib/auditLog";

/** Compute denormalized search text for full-text search index. */
function computeSearchText(companyName: string, contactName?: string, email?: string): string {
  return [companyName, contactName, email].filter(Boolean).join(" ").toLowerCase();
}

/**
 * List all clients for the user's firm with optional filters.
 */
export const listClients = query({
  args: {
    userId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("prospect"),
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived")
      )
    ),
    industry: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("clients"),
      contactType: v.optional(v.union(v.literal("organisation"), v.literal("individual"))),
      companyName: v.string(),
      contactName: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      industry: v.optional(v.string()),
      companySize: v.optional(v.string()),
      annualRevenue: v.optional(v.string()),
      currentSoftware: v.optional(v.array(v.string())),
      tags: v.array(v.string()),
      notes: v.optional(v.string()),
      status: v.string(),
      website: v.optional(v.string()),
      taxNumber: v.optional(v.string()),
      companyNumber: v.optional(v.string()),
      defaultCurrency: v.optional(v.string()),
      addressLine1: v.optional(v.string()),
      city: v.optional(v.string()),
      region: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      country: v.optional(v.string()),
      contactGroupIds: v.optional(v.array(v.string())),
      xeroContactId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("listClients: User not found, returning empty array");
      return [];
    }

    let query = ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId));

    const clients = await query.collect();

    // Filter by status
    let filtered = clients;
    if (!args.includeArchived) {
      filtered = filtered.filter((c) => c.status !== "archived");
    }
    if (args.status) {
      filtered = filtered.filter((c) => c.status === args.status);
    }
    if (args.industry) {
      filtered = filtered.filter((c) => c.industry === args.industry);
    }

    return filtered.map((client) => ({
      _id: client._id,
      contactType: client.contactType,
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      industry: client.industry,
      companySize: client.companySize,
      annualRevenue: client.annualRevenue,
      currentSoftware: client.currentSoftware,
      tags: client.tags,
      notes: client.notes,
      status: client.status,
      website: client.website,
      taxNumber: client.taxNumber,
      companyNumber: client.companyNumber,
      defaultCurrency: client.defaultCurrency,
      addressLine1: client.addressLine1,
      city: client.city,
      region: client.region,
      postalCode: client.postalCode,
      country: client.country,
      contactGroupIds: client.contactGroupIds,
      xeroContactId: client.xeroContactId,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    }));
  },
});

/**
 * Minimal client list for selects/comboboxes (proposals, forms).
 * Returns only fields needed for display + selection. Faster than listClients.
 */
export const listClientsForSelect = query({
  args: {
    userId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("prospect"),
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived")
      )
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("clients"),
      companyName: v.string(),
      contactName: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return [];

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    let filtered = clients.filter((c) => c.status !== "archived");
    if (args.status) {
      filtered = filtered.filter((c) => c.status === args.status);
    }

    return filtered.map((c) => ({
      _id: c._id,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
    }));
  },
});

/**
 * Full contact list for Proposal Builder: grouped UI (organisations vs individuals),
 * optional Xero badge, fields to hydrate entity rows.
 */
export const listClientsForProposalBuilder = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("clients"),
      companyName: v.string(),
      contactName: v.string(),
      email: v.string(),
      contactType: v.optional(v.union(v.literal("organisation"), v.literal("individual"))),
      xeroContactId: v.optional(v.string()),
      taxNumber: v.optional(v.string()),
      companyNumber: v.optional(v.string()),
      notes: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return [];

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const filtered = clients.filter((c) => c.status !== "archived");

    return filtered.map((c) => ({
      _id: c._id,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      contactType: c.contactType,
      xeroContactId: c.xeroContactId,
      taxNumber: c.taxNumber,
      companyNumber: c.companyNumber,
      notes: c.notes,
    }));
  },
});

/** Same shape as listClientsForSelect for proposal/combobox use. */
const clientSelectShape = v.object({
  _id: v.id("clients"),
  companyName: v.string(),
  contactName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
});

/**
 * Search clients by full-text (companyName, contactName, email). Scalable to 60k+ contacts.
 * Use when user has typed 2+ chars. Returns top 50 matches.
 */
export const searchClientsForSelect = query({
  args: {
    userId: v.id("users"),
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(clientSelectShape),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId || !args.searchTerm.trim()) return [];

    const limit = Math.min(args.limit ?? 50, 50);
    const clients = await ctx.db
      .query("clients")
      .withSearchIndex("search_client", (q) =>
        q.search("searchText", args.searchTerm.trim()).eq("firmId", firmId)
      )
      .filter((q) => q.neq(q.field("status"), "archived"))
      .take(limit);

    return clients.map((c) => ({
      _id: c._id,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
    }));
  },
});

/**
 * Recent clients for combobox initial/empty state. Returns 20 most recent (non-archived).
 * Use when search is empty and popover is open.
 */
export const listRecentClientsForSelect = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(clientSelectShape),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return [];

    const limit = Math.min(args.limit ?? 20, 50);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm_created", (q) => q.eq("firmId", firmId))
      .order("desc")
      .filter((q) => q.neq(q.field("status"), "archived"))
      .take(limit);

    return clients.map((c) => ({
      _id: c._id,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
    }));
  },
});

/**
 * Backfill searchText for clients that don't have it (e.g. created before search index).
 * Run from Convex dashboard or via admin action. Processes up to 500 per call.
 */
export const backfillClientSearchText = mutation({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageClients");
    const limit = Math.min(args.limit ?? 500, 500);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .take(limit * 2);
    const toUpdate = clients.filter((c) => !c.searchText);
    let updated = 0;
    for (const c of toUpdate.slice(0, limit)) {
      await ctx.db.patch(c._id, {
        searchText: computeSearchText(c.companyName, c.contactName, c.email),
        updatedAt: Date.now(),
      });
      updated++;
    }
    return { updated };
  },
});

/**
 * Single source of truth for client/contact stats. Counts are computed in the DB
 * so the numbers are accurate and match Xero-aligned concepts (Active, Archived, From Xero).
 */
export const getClientCounts = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    total: v.number(),
    organisations: v.number(),
    individuals: v.number(),
    active: v.number(),
    prospect: v.number(),
    inactive: v.number(),
    archived: v.number(),
    fromXero: v.number(),
  }),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) {
      return {
        total: 0,
        organisations: 0,
        individuals: 0,
        active: 0,
        prospect: 0,
        inactive: 0,
        archived: 0,
        fromXero: 0,
      };
    }
    const all = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    const total = all.length;
    const organisations = all.filter((c) => c.contactType !== "individual").length;
    const individuals = all.filter((c) => c.contactType === "individual").length;
    const active = all.filter((c) => c.status === "active").length;
    const prospect = all.filter((c) => c.status === "prospect").length;
    const inactive = all.filter((c) => c.status === "inactive").length;
    const archived = all.filter((c) => c.status === "archived").length;
    const fromXero = all.filter((c) => !!c.xeroContactId).length;
    return {
      total,
      organisations,
      individuals,
      active,
      prospect,
      inactive,
      archived,
      fromXero,
    };
  },
});

/**
 * Get a single client by ID.
 */
export const getClient = query({
  args: {
    userId: v.id("users"),
    clientId: v.id("clients"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("clients"),
      contactType: v.optional(v.union(v.literal("organisation"), v.literal("individual"))),
      companyName: v.string(),
      contactName: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      industry: v.optional(v.string()),
      companySize: v.optional(v.string()),
      annualRevenue: v.optional(v.string()),
      currentSoftware: v.optional(v.array(v.string())),
      tags: v.array(v.string()),
      notes: v.optional(v.string()),
      status: v.string(),
      website: v.optional(v.string()),
      taxNumber: v.optional(v.string()),
      companyNumber: v.optional(v.string()),
      defaultCurrency: v.optional(v.string()),
      addressLine1: v.optional(v.string()),
      city: v.optional(v.string()),
      region: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      country: v.optional(v.string()),
      contactGroupIds: v.optional(v.array(v.string())),
      xeroContactId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("getClient: User not found, returning null");
      return null;
    }

    const client = await ctx.db.get(args.clientId);
    if (!client || client.firmId !== firmId) {
      return null;
    }

    return {
      _id: client._id,
      contactType: client.contactType,
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      industry: client.industry,
      companySize: client.companySize,
      annualRevenue: client.annualRevenue,
      currentSoftware: client.currentSoftware,
      tags: client.tags,
      notes: client.notes,
      status: client.status,
      website: client.website,
      taxNumber: client.taxNumber,
      companyNumber: client.companyNumber,
      defaultCurrency: client.defaultCurrency,
      addressLine1: client.addressLine1,
      city: client.city,
      region: client.region,
      postalCode: client.postalCode,
      country: client.country,
      contactGroupIds: client.contactGroupIds,
      xeroContactId: client.xeroContactId,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  },
});

/**
 * Create a new client.
 */
export const createClient = mutation({
  args: {
    userId: v.id("users"),
    contactType: v.optional(v.union(v.literal("organisation"), v.literal("individual"))),
    companyName: v.string(),
    contactName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    companyNumber: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    companySize: v.optional(
      v.union(
        v.literal("1-10"),
        v.literal("11-50"),
        v.literal("51-200"),
        v.literal("201+")
      )
    ),
    annualRevenue: v.optional(v.string()),
    currentSoftware: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    xeroContactId: v.optional(v.string()),
    contactGroupIds: v.optional(v.array(v.string())), // Xero ContactGroup IDs (organisations can belong to groups)
    status: v.optional(
      v.union(
        v.literal("prospect"),
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived")
      )
    ), // e.g. from Xero ContactStatus on import
  },
  returns: v.object({
    success: v.boolean(),
    clientId: v.optional(v.id("clients")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user has permission
    const user = await requirePermission(ctx, args.userId, "canManageClients");

    // Check for duplicate email
    const existingClient = await ctx.db
      .query("clients")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();

    if (existingClient && existingClient.firmId === user.firmId) {
      return {
        success: false,
        error: "A client with this email already exists",
      };
    }

    const email = args.email.toLowerCase();
    const clientId = await ctx.db.insert("clients", {
      firmId: user.firmId,
      contactType: args.contactType ?? "organisation",
      companyName: args.companyName,
      contactName: args.contactName,
      email,
      searchText: computeSearchText(args.companyName, args.contactName, email),
      phone: args.phone,
      industry: args.industry,
      companySize: args.companySize,
      annualRevenue: args.annualRevenue,
      currentSoftware: args.currentSoftware,
      tags: args.tags || [],
      notes: args.notes,
      website: args.website,
      xeroContactId: args.xeroContactId,
      taxNumber: args.taxNumber,
      companyNumber: args.companyNumber,
      defaultCurrency: args.defaultCurrency,
      addressLine1: args.addressLine1,
      city: args.city,
      region: args.region,
      postalCode: args.postalCode,
      country: args.country,
      contactGroupIds: args.contactGroupIds,
      status: args.status ?? "prospect",
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEntry(ctx, {
      firmId: user.firmId,
      userId: args.userId,
      entityType: EntityTypes.CLIENT,
      entityId: clientId,
      action: AuditActions.CLIENT_CREATED,
      metadata: { companyName: args.companyName, contactName: args.contactName, email: args.email.toLowerCase() },
    });

    return { success: true, clientId };
  },
});

/**
 * Update an existing client.
 */
export const updateClient = mutation({
  args: {
    userId: v.id("users"),
    clientId: v.id("clients"),
    contactType: v.optional(v.union(v.literal("organisation"), v.literal("individual"))),
    companyName: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    industry: v.optional(v.string()),
    companySize: v.optional(
      v.union(
        v.literal("1-10"),
        v.literal("11-50"),
        v.literal("51-200"),
        v.literal("201+")
      )
    ),
    annualRevenue: v.optional(v.string()),
    currentSoftware: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("prospect"),
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived")
      )
    ),
    website: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    companyNumber: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    contactGroupIds: v.optional(v.array(v.string())), // Xero ContactGroup IDs
    xeroContactId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user has permission
    const user = await requirePermission(ctx, args.userId, "canManageClients");

    // Get client and verify access
    const client = await ctx.db.get(args.clientId);
    if (!client || client.firmId !== user.firmId) {
      return { success: false, error: "Client not found" };
    }

    // Build update object
    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.xeroContactId !== undefined) updates.xeroContactId = args.xeroContactId;
    if (args.contactType !== undefined) updates.contactType = args.contactType;
    if (args.companyName !== undefined) updates.companyName = args.companyName;
    if (args.contactName !== undefined) updates.contactName = args.contactName;
    if (args.email !== undefined) updates.email = args.email.toLowerCase();
    // Recompute searchText when searchable fields change
    if (args.companyName !== undefined || args.contactName !== undefined || args.email !== undefined) {
      updates.searchText = computeSearchText(
        (args.companyName ?? client.companyName) as string,
        (args.contactName ?? client.contactName) as string | undefined,
        ((args.email ?? client.email) as string).toLowerCase()
      );
    }
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.industry !== undefined) updates.industry = args.industry;
    if (args.companySize !== undefined) updates.companySize = args.companySize;
    if (args.annualRevenue !== undefined) updates.annualRevenue = args.annualRevenue;
    if (args.currentSoftware !== undefined)
      updates.currentSoftware = args.currentSoftware;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.status !== undefined) updates.status = args.status;
    if (args.website !== undefined) updates.website = args.website;
    if (args.taxNumber !== undefined) updates.taxNumber = args.taxNumber;
    if (args.companyNumber !== undefined) updates.companyNumber = args.companyNumber;
    if (args.defaultCurrency !== undefined) updates.defaultCurrency = args.defaultCurrency;
    if (args.addressLine1 !== undefined) updates.addressLine1 = args.addressLine1;
    if (args.city !== undefined) updates.city = args.city;
    if (args.region !== undefined) updates.region = args.region;
    if (args.postalCode !== undefined) updates.postalCode = args.postalCode;
    if (args.country !== undefined) updates.country = args.country;
    if (args.contactGroupIds !== undefined) updates.contactGroupIds = args.contactGroupIds;

    await ctx.db.patch(args.clientId, updates);

    await logAuditEntry(ctx, {
      firmId: user.firmId,
      userId: args.userId,
      entityType: EntityTypes.CLIENT,
      entityId: args.clientId,
      action: AuditActions.CLIENT_UPDATED,
      metadata: { companyName: updates.companyName ?? client.companyName, contactName: updates.contactName ?? client.contactName },
    });

    return { success: true };
  },
});

/**
 * Archive a client (soft delete).
 */
export const archiveClient = mutation({
  args: {
    userId: v.id("users"),
    clientId: v.id("clients"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageClients");

    const client = await ctx.db.get(args.clientId);
    if (!client || client.firmId !== user.firmId) {
      return { success: false, error: "Client not found" };
    }

    await ctx.db.patch(args.clientId, {
      status: "archived",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Permanently delete a client.
 */
export const deleteClient = mutation({
  args: {
    userId: v.id("users"),
    clientId: v.id("clients"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Requires delete permission
    const user = await requirePermission(ctx, args.userId, "canDeleteRecords");

    const client = await ctx.db.get(args.clientId);
    if (!client || client.firmId !== user.firmId) {
      return { success: false, error: "Client not found" };
    }

    await ctx.db.delete(args.clientId);

    return { success: true };
  },
});

/**
 * Get unique industries from clients (for filter).
 */
export const getIndustries = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("getIndustries: User not found, returning empty array");
      return [];
    }

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const industries = [
      ...new Set(
        clients.map((c) => c.industry).filter((i): i is string => i !== undefined)
      ),
    ];

    return industries.sort();
  },
});

/**
 * Search clients by name or email.
 */
export const searchClients = query({
  args: {
    userId: v.id("users"),
    searchTerm: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("clients"),
      companyName: v.string(),
      contactName: v.string(),
      email: v.string(),
      status: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("searchClients: User not found, returning empty array");
      return [];
    }

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const searchLower = args.searchTerm.toLowerCase();
    const filtered = clients
      .filter(
        (c) =>
          c.companyName.toLowerCase().includes(searchLower) ||
          c.contactName.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower)
      )
      .filter((c) => c.status !== "archived")
      .slice(0, 10); // Limit to 10 results for autocomplete

    return filtered.map((c) => ({
      _id: c._id,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      status: c.status,
    }));
  },
});

/**
 * Import multiple clients from CSV.
 */
export const importClients = mutation({
  args: {
    userId: v.id("users"),
    clients: v.array(
      v.object({
        companyName: v.string(),
        contactName: v.string(),
        email: v.string(),
        contactType: v.optional(v.string()),
        phone: v.optional(v.string()),
        industry: v.optional(v.string()),
        companySize: v.optional(v.string()),
        annualRevenue: v.optional(v.string()),
        website: v.optional(v.string()),
        taxNumber: v.optional(v.string()),
        companyNumber: v.optional(v.string()),
        defaultCurrency: v.optional(v.string()),
        addressLine1: v.optional(v.string()),
        city: v.optional(v.string()),
        region: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        country: v.optional(v.string()),
        notes: v.optional(v.string()),
        contactGroupIds: v.optional(v.array(v.string())),
      })
    ),
    duplicateHandling: v.union(
      v.literal("skip"),
      v.literal("merge"),
      v.literal("overwrite")
    ),
  },
  returns: v.object({
    imported: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user has permission
    const user = await requirePermission(ctx, args.userId, "canManageClients");

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Get existing clients for duplicate checking
    const existingClients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();

    const existingEmailMap = new Map(
      existingClients.map((c) => [c.email.toLowerCase(), c])
    );

    for (const clientData of args.clients) {
      try {
        // Validate required fields (contactName optional for individuals - use companyName)
        if (!clientData.companyName || !clientData.email) {
          errors.push(`Missing required fields for client: ${clientData.companyName || "Unknown"}`);
          continue;
        }
        const effectiveContactName = (clientData.contactName || "").trim() || clientData.companyName;

        const email = clientData.email.toLowerCase();
        const existingClient = existingEmailMap.get(email);

        // Normalize company size if provided
        let normalizedCompanySize: "1-10" | "11-50" | "51-200" | "201+" | undefined;
        if (clientData.companySize) {
          const size = clientData.companySize.toLowerCase().replace(/\s/g, "");
          if (size.includes("1-10") || size.includes("1to10") || size.includes("micro")) {
            normalizedCompanySize = "1-10";
          } else if (size.includes("11-50") || size.includes("11to50") || size.includes("small")) {
            normalizedCompanySize = "11-50";
          } else if (size.includes("51-200") || size.includes("51to200") || size.includes("medium")) {
            normalizedCompanySize = "51-200";
          } else if (size.includes("201") || size.includes("large") || size.includes("enterprise")) {
            normalizedCompanySize = "201+";
          }
        }

        // Normalize contactType for Xero alignment (Organisation / Individual)
        let contactType: "organisation" | "individual" = "organisation";
        if (clientData.contactType) {
          const t = clientData.contactType.toLowerCase().trim();
          if (t === "individual" || t === "person" || t === "individual contact") contactType = "individual";
          else if (t === "organisation" || t === "organization" || t === "company" || t === "org") contactType = "organisation";
        }

        if (existingClient) {
          // Handle duplicate
          if (args.duplicateHandling === "skip") {
            skipped++;
            continue;
          } else if (args.duplicateHandling === "merge") {
            // Only update empty fields
            const updates: any = { updatedAt: now };
            if (!existingClient.phone && clientData.phone) updates.phone = clientData.phone;
            if (!existingClient.industry && clientData.industry) updates.industry = clientData.industry;
            if (!existingClient.companySize && normalizedCompanySize) updates.companySize = normalizedCompanySize;
            if (!existingClient.annualRevenue && clientData.annualRevenue) updates.annualRevenue = clientData.annualRevenue;
            if (!existingClient.notes && clientData.notes) updates.notes = clientData.notes;
            if (!existingClient.website && clientData.website) updates.website = clientData.website;
            if (!existingClient.taxNumber && clientData.taxNumber) updates.taxNumber = clientData.taxNumber;
            if (!existingClient.companyNumber && clientData.companyNumber) updates.companyNumber = clientData.companyNumber;
            if (!existingClient.defaultCurrency && clientData.defaultCurrency) updates.defaultCurrency = clientData.defaultCurrency;
            if (!existingClient.addressLine1 && clientData.addressLine1) updates.addressLine1 = clientData.addressLine1;
            if (!existingClient.city && clientData.city) updates.city = clientData.city;
            if (!existingClient.region && clientData.region) updates.region = clientData.region;
            if (!existingClient.postalCode && clientData.postalCode) updates.postalCode = clientData.postalCode;
            if (!existingClient.country && clientData.country) updates.country = clientData.country;
            if ((!existingClient.contactName || existingClient.contactName === "") && effectiveContactName) updates.contactName = effectiveContactName;
            if (existingClient.contactType === undefined && contactType) updates.contactType = contactType;
            if (clientData.contactGroupIds && (!existingClient.contactGroupIds || existingClient.contactGroupIds.length === 0)) updates.contactGroupIds = clientData.contactGroupIds;

            if (Object.keys(updates).length > 1) {
              await ctx.db.patch(existingClient._id, updates);
              imported++;
            } else {
              skipped++;
            }
            continue;
          } else if (args.duplicateHandling === "overwrite") {
            // Overwrite all fields (Xero-aligned)
            await ctx.db.patch(existingClient._id, {
              companyName: clientData.companyName,
              contactName: effectiveContactName,
              contactType,
              searchText: computeSearchText(clientData.companyName, effectiveContactName, email),
              phone: clientData.phone,
              industry: clientData.industry,
              companySize: normalizedCompanySize,
              annualRevenue: clientData.annualRevenue,
              website: clientData.website,
              taxNumber: clientData.taxNumber,
              companyNumber: clientData.companyNumber,
              defaultCurrency: clientData.defaultCurrency,
              addressLine1: clientData.addressLine1,
              city: clientData.city,
              region: clientData.region,
              postalCode: clientData.postalCode,
              country: clientData.country,
              notes: clientData.notes,
              contactGroupIds: clientData.contactGroupIds,
              updatedAt: now,
            });
            imported++;
            continue;
          }
        }

        // Create new client (Xero-aligned fields)
        const newId = await ctx.db.insert("clients", {
          firmId: user.firmId,
          contactType,
          companyName: clientData.companyName,
          contactName: effectiveContactName,
          email,
          searchText: computeSearchText(clientData.companyName, effectiveContactName, email),
          phone: clientData.phone,
          industry: clientData.industry,
          companySize: normalizedCompanySize,
          annualRevenue: clientData.annualRevenue,
          website: clientData.website,
          taxNumber: clientData.taxNumber,
          companyNumber: clientData.companyNumber,
          defaultCurrency: clientData.defaultCurrency,
          addressLine1: clientData.addressLine1,
          city: clientData.city,
          region: clientData.region,
          postalCode: clientData.postalCode,
          country: clientData.country,
          notes: clientData.notes,
          contactGroupIds: clientData.contactGroupIds,
          tags: [],
          status: "prospect",
          createdBy: args.userId,
          createdAt: now,
          updatedAt: now,
        });
        imported++;

        // Add to map to catch duplicates within the same import (store _id for merge/overwrite)
        existingEmailMap.set(email, { _id: newId, email } as any);
      } catch (error: any) {
        errors.push(`Error importing ${clientData.companyName}: ${error.message}`);
      }
    }

    return { imported, skipped, errors };
  },
});

/**
 * Internal: Find client by firm and Xero ContactID (for proposal entity lookup).
 */
export const getClientByXeroContactIdInternal = internalQuery({
  args: {
    firmId: v.id("firms"),
    xeroContactId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("clients"),
      companyName: v.string(),
      contactName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("clients")
      .withIndex("by_firm_and_xeroContactId", (q) =>
        q.eq("firmId", args.firmId).eq("xeroContactId", args.xeroContactId)
      )
      .first();
    if (!client) return null;
    return {
      _id: client._id,
      companyName: client.companyName,
      contactName: client.contactName,
    };
  },
});

/** Shape of a pre-transformed Xero contact for bulk import. */
const xeroContactBatchItem = v.object({
  contactType: v.union(v.literal("organisation"), v.literal("individual")),
  companyName: v.string(),
  contactName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  taxNumber: v.optional(v.string()),
  companyNumber: v.optional(v.string()),
  defaultCurrency: v.optional(v.string()),
  addressLine1: v.optional(v.string()),
  city: v.optional(v.string()),
  region: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  country: v.optional(v.string()),
  xeroContactId: v.optional(v.string()),
  status: v.union(v.literal("prospect"), v.literal("active"), v.literal("inactive"), v.literal("archived")),
});

/**
 * Internal: Bulk upsert clients from Xero (batch of pre-transformed contacts).
 * Used by syncXeroContactsToClients action. Uses DB lookups to avoid Convex 1024-field arg limit.
 */
export const bulkUpsertClientsFromXero = internalMutation({
  args: {
    userId: v.id("users"),
    contacts: v.array(xeroContactBatchItem),
  },
  returns: v.object({
    imported: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageClients");
    const now = Date.now();

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const c of args.contacts) {
      const email = c.email.toLowerCase();
      const contactId = (c.xeroContactId ?? "").trim();

      // Deduplicate: xeroContactId is primary (one Xero contact = one client). When set, match by it.
      // Fallback to email only when: no xeroContactId, or manual client (no xeroContactId) with same email
      let existing = null;
      if (contactId) {
        existing = await ctx.db
          .query("clients")
          .withIndex("by_firm_and_xeroContactId", (q) =>
            q.eq("firmId", user.firmId).eq("xeroContactId", contactId)
          )
          .first();
      }
      if (!existing) {
        const byEmail = await ctx.db
          .query("clients")
          .withIndex("by_firm_and_email", (q) =>
            q.eq("firmId", user.firmId).eq("email", email)
          )
          .first();
        // Use email match only if: no xeroContactId on incoming, or existing is manual (no xeroContactId)
        // Prevents merging two different Xero contacts that share an email
        if (byEmail && (!contactId || !byEmail.xeroContactId)) {
          existing = byEmail;
        }
      }

      if (existing) {
        try {
          await ctx.db.patch(existing._id, {
            contactType: c.contactType,
            companyName: c.companyName,
            contactName: c.contactName,
            email,
            searchText: computeSearchText(c.companyName, c.contactName, email),
            phone: c.phone ?? undefined,
            website: c.website ?? undefined,
            taxNumber: c.taxNumber ?? undefined,
            companyNumber: c.companyNumber ?? undefined,
            defaultCurrency: c.defaultCurrency ?? undefined,
            addressLine1: c.addressLine1 ?? undefined,
            city: c.city ?? undefined,
            region: c.region ?? undefined,
            postalCode: c.postalCode ?? undefined,
            country: c.country ?? undefined,
            xeroContactId: contactId || undefined,
            status: c.status,
            updatedAt: now,
          });
          updated++;
        } catch {
          skipped++;
        }
      } else {
        try {
          await ctx.db.insert("clients", {
            firmId: user.firmId,
            contactType: c.contactType,
            companyName: c.companyName,
            contactName: c.contactName,
            email,
            searchText: computeSearchText(c.companyName, c.contactName, email),
            phone: c.phone,
            website: c.website,
            taxNumber: c.taxNumber,
            companyNumber: c.companyNumber,
            defaultCurrency: c.defaultCurrency,
            addressLine1: c.addressLine1,
            city: c.city,
            region: c.region,
            postalCode: c.postalCode,
            country: c.country,
            xeroContactId: contactId || undefined,
            tags: [],
            status: c.status,
            createdBy: args.userId,
            createdAt: now,
            updatedAt: now,
          });
          imported++;
        } catch {
          skipped++;
        }
      }
    }

    return { imported, updated, skipped };
  },
});
