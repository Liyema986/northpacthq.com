import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFirmIdSafe, requirePermission } from "./lib/permissions";

/**
 * List package templates for the current user's firm.
 */
export const list = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("packageTemplates"),
      name: v.string(),
      template: v.string(),
      documentsToSend: v.string(),
      annualRevenueRange: v.string(),
      incomeTaxRange: v.string(),
      addProjectName: v.boolean(),
      includedServiceIds: v.array(v.id("services")),
      includedServiceSettings: v.optional(v.record(v.string(), v.record(v.string(), v.string()))),
      sortOrder: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return [];

    const list = await ctx.db
      .query("packageTemplates")
      .withIndex("by_firm_sort", (q) => q.eq("firmId", firmId))
      .collect();
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    return list.map((p) => ({
      _id: p._id,
      name: p.name,
      template: p.template,
      documentsToSend: p.documentsToSend,
      annualRevenueRange: p.annualRevenueRange,
      incomeTaxRange: p.incomeTaxRange,
      addProjectName: p.addProjectName,
      includedServiceIds: p.includedServiceIds,
      includedServiceSettings: p.includedServiceSettings ?? {},
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  },
});

/**
 * Get one package template by id (must belong to user's firm).
 */
export const get = query({
  args: { userId: v.id("users"), packageId: v.id("packageTemplates") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("packageTemplates"),
      name: v.string(),
      template: v.string(),
      documentsToSend: v.string(),
      annualRevenueRange: v.string(),
      incomeTaxRange: v.string(),
      addProjectName: v.boolean(),
      includedServiceIds: v.array(v.id("services")),
      includedServiceSettings: v.optional(v.record(v.string(), v.record(v.string(), v.string()))),
      sortOrder: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return null;

    const p = await ctx.db.get(args.packageId);
    if (!p || p.firmId !== firmId) return null;
    return {
      _id: p._id,
      name: p.name,
      template: p.template,
      documentsToSend: p.documentsToSend,
      annualRevenueRange: p.annualRevenueRange,
      incomeTaxRange: p.incomeTaxRange,
      addProjectName: p.addProjectName,
      includedServiceIds: p.includedServiceIds,
      includedServiceSettings: p.includedServiceSettings ?? {},
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  },
});

/**
 * Create a package template.
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    template: v.string(),
    documentsToSend: v.string(),
    annualRevenueRange: v.string(),
    incomeTaxRange: v.string(),
    addProjectName: v.boolean(),
    includedServiceIds: v.array(v.id("services")),
    includedServiceSettings: v.optional(v.record(v.string(), v.record(v.string(), v.string()))),
  },
  returns: v.object({ success: v.boolean(), packageId: v.optional(v.id("packageTemplates")), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const existing = await ctx.db
      .query("packageTemplates")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const maxOrder = Math.max(0, ...existing.map((p) => p.sortOrder));
    const now = Date.now();

    const packageId = await ctx.db.insert("packageTemplates", {
      firmId: user.firmId,
      name: args.name.trim(),
      template: args.template,
      documentsToSend: args.documentsToSend,
      annualRevenueRange: args.annualRevenueRange,
      incomeTaxRange: args.incomeTaxRange,
      addProjectName: args.addProjectName,
      includedServiceIds: args.includedServiceIds,
      includedServiceSettings: args.includedServiceSettings ?? {},
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, packageId };
  },
});

/**
 * Update a package template.
 */
export const update = mutation({
  args: {
    userId: v.id("users"),
    packageId: v.id("packageTemplates"),
    name: v.optional(v.string()),
    template: v.optional(v.string()),
    documentsToSend: v.optional(v.string()),
    annualRevenueRange: v.optional(v.string()),
    incomeTaxRange: v.optional(v.string()),
    addProjectName: v.optional(v.boolean()),
    includedServiceIds: v.optional(v.array(v.id("services"))),
    includedServiceSettings: v.optional(v.record(v.string(), v.record(v.string(), v.string()))),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const p = await ctx.db.get(args.packageId);
    if (!p || p.firmId !== user.firmId) {
      return { success: false, error: "Package not found" };
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.template !== undefined) updates.template = args.template;
    if (args.documentsToSend !== undefined) updates.documentsToSend = args.documentsToSend;
    if (args.annualRevenueRange !== undefined) updates.annualRevenueRange = args.annualRevenueRange;
    if (args.incomeTaxRange !== undefined) updates.incomeTaxRange = args.incomeTaxRange;
    if (args.addProjectName !== undefined) updates.addProjectName = args.addProjectName;
    if (args.includedServiceIds !== undefined) updates.includedServiceIds = args.includedServiceIds;
    if (args.includedServiceSettings !== undefined) updates.includedServiceSettings = args.includedServiceSettings;

    await ctx.db.patch(args.packageId, updates);
    return { success: true };
  },
});

/**
 * Delete a package template.
 */
export const remove = mutation({
  args: { userId: v.id("users"), packageId: v.id("packageTemplates") },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const p = await ctx.db.get(args.packageId);
    if (!p || p.firmId !== user.firmId) {
      return { success: false, error: "Package not found" };
    }
    await ctx.db.delete(args.packageId);
    return { success: true };
  },
});

/**
 * Reorder package templates (list order = sortOrder 0..n).
 */
export const reorder = mutation({
  args: {
    userId: v.id("users"),
    packageIds: v.array(v.id("packageTemplates")),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");
    const now = Date.now();

    for (let i = 0; i < args.packageIds.length; i++) {
      const row = await ctx.db.get(args.packageIds[i]);
      if (!row || row.firmId !== user.firmId) continue;
      await ctx.db.patch(args.packageIds[i], {
        sortOrder: i,
        updatedAt: now,
      });
    }
    return { success: true };
  },
});
