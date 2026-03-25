// convex/principals.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getUserFirmIdSafe, requirePermission } from "./lib/permissions";

const PRINCIPAL_ROLES = ["director", "principal", "statutory-auditor"] as const;

/**
 * List principals for the user's firm.
 */
export const listPrincipals = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("principals"),
      _creationTime: v.number(),
      firmId: v.id("firms"),
      name: v.string(),
      qualification: v.optional(v.string()),
      signatureStorageId: v.optional(v.id("_storage")),
      roles: v.array(v.string()),
      sortOrder: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return [];

    return await ctx.db
      .query("principals")
      .withIndex("by_firm_sort", (q) => q.eq("firmId", firmId))
      .order("asc")
      .collect();
  },
});

/**
 * Generate upload URL for principal signature image.
 */
export const generateSignatureUploadUrl = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    void user; // used for permission check
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a new principal.
 */
export const createPrincipal = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    qualification: v.optional(v.string()),
    signatureStorageId: v.optional(v.id("_storage")),
    roles: v.array(v.string()),
  },
  returns: v.id("principals"),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const existing = await ctx.db
      .query("principals")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    const maxSort = existing.reduce((m, p) => Math.max(m, p.sortOrder), -1);

    const now = Date.now();
    const roles = args.roles.filter((r) => PRINCIPAL_ROLES.includes(r as (typeof PRINCIPAL_ROLES)[number]));
    return await ctx.db.insert("principals", {
      firmId,
      name: args.name.trim(),
      qualification: args.qualification?.trim() || undefined,
      signatureStorageId: args.signatureStorageId,
      roles,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing principal.
 */
export const updatePrincipal = mutation({
  args: {
    userId: v.id("users"),
    principalId: v.id("principals"),
    name: v.string(),
    qualification: v.optional(v.string()),
    signatureStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    roles: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const principal = await ctx.db.get(args.principalId);
    if (!principal || principal.firmId !== firmId) {
      throw new Error("Principal not found");
    }

    const roles = args.roles.filter((r) => PRINCIPAL_ROLES.includes(r as (typeof PRINCIPAL_ROLES)[number]));
    await ctx.db.patch(args.principalId, {
      name: args.name.trim(),
      qualification: args.qualification?.trim() || undefined,
      signatureStorageId: args.signatureStorageId === null ? undefined : args.signatureStorageId ?? principal.signatureStorageId,
      roles,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Delete a principal.
 */
export const deletePrincipal = mutation({
  args: {
    userId: v.id("users"),
    principalId: v.id("principals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const principal = await ctx.db.get(args.principalId);
    if (!principal || principal.firmId !== firmId) {
      throw new Error("Principal not found");
    }

    await ctx.db.delete(args.principalId);
    return null;
  },
});

/**
 * Reorder principals.
 */
export const reorderPrincipals = mutation({
  args: {
    userId: v.id("users"),
    principalIds: v.array(v.id("principals")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const now = Date.now();
    for (let i = 0; i < args.principalIds.length; i++) {
      const principal = await ctx.db.get(args.principalIds[i]);
      if (!principal || principal.firmId !== firmId) continue;
      await ctx.db.patch(args.principalIds[i], {
        sortOrder: i,
        updatedAt: now,
      });
    }
    return null;
  },
});
