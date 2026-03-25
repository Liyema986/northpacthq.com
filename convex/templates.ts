// convex/templates.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const sectionConfigValidator = v.optional(
  v.object({
    acceptanceEnabled: v.optional(v.boolean()),
    halfPageGraphicEnabled: v.optional(v.boolean()),
    testimonial1Enabled: v.optional(v.boolean()),
    fullPageGraphic1Enabled: v.optional(v.boolean()),
    proposalIntroduction: v.optional(v.string()),
    testimonial2Enabled: v.optional(v.boolean()),
    feesIntroductionParagraph: v.optional(v.string()),
    pleaseNote: v.optional(v.string()),
    whatHappensNextText: v.optional(v.string()),
    fullPageGraphic2Enabled: v.optional(v.boolean()),
    selectedServicesText: v.optional(v.string()),
    upsellSectionText: v.optional(v.string()),
    testimonial3Enabled: v.optional(v.boolean()),
    fullPageGraphic3Enabled: v.optional(v.boolean()),
  })
);

/**
 * List all templates for a firm (sorted by sortOrder, then createdAt)
 */
export const listTemplates = query({
  args: {
    userId: v.id("users"),
    serviceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const templates = await ctx.db
      .query("proposalTemplates")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();

    let filtered = args.serviceType
      ? templates.filter((t) => t.serviceType === args.serviceType)
      : templates;

    // Sort by sortOrder (undefined last), then by createdAt
    filtered.sort((a, b) => {
      const orderA = a.sortOrder ?? 999999;
      const orderB = b.sortOrder ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return a.createdAt - b.createdAt;
    });

    return filtered;
  },
});

/**
 * Get a specific template
 */
export const getTemplate = query({
  args: {
    userId: v.id("users"),
    templateId: v.id("proposalTemplates"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const template = await ctx.db.get(args.templateId);
    if (!template || template.firmId !== user.firmId) {
      return null;
    }

    return template;
  },
});

/**
 * Get default template for a service type
 */
export const getDefaultTemplate = query({
  args: {
    userId: v.id("users"),
    serviceType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const templates = await ctx.db
      .query("proposalTemplates")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();

    // Find default template for this service type
    const defaultTemplate = templates.find(
      (t) => t.serviceType === args.serviceType && t.isDefault
    );

    return defaultTemplate || null;
  },
});

/**
 * Create a new template
 */
export const createTemplate = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    serviceType: v.string(),
    introText: v.string(),
    termsText: v.string(),
    footerText: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    minimumMonthlyFee: v.optional(v.number()),
    proposalType: v.optional(v.string()),
    documentsToSend: v.optional(v.string()),
    redirectOnAcceptUrl: v.optional(v.string()),
    emailDeliverability: v.optional(v.union(v.literal("high"), v.literal("low"))),
    sortOrder: v.optional(v.number()),
    sectionConfig: sectionConfigValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    if (args.isDefault) {
      const existingTemplates = await ctx.db
        .query("proposalTemplates")
        .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
        .collect();
      for (const template of existingTemplates) {
        if (template.serviceType === args.serviceType && template.isDefault) {
          await ctx.db.patch(template._id, { isDefault: false });
        }
      }
    }

    const templates = await ctx.db
      .query("proposalTemplates")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const maxOrder = templates.reduce(
      (max, t) => Math.max(max, t.sortOrder ?? 0),
      0
    );
    const sortOrder = args.sortOrder ?? maxOrder + 1;

    const templateId = await ctx.db.insert("proposalTemplates", {
      firmId: user.firmId,
      name: args.name,
      description: args.description,
      serviceType: args.serviceType,
      introText: args.introText,
      termsText: args.termsText,
      footerText: args.footerText,
      isDefault: args.isDefault ?? false,
      createdBy: args.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      minimumMonthlyFee: args.minimumMonthlyFee,
      proposalType: args.proposalType,
      documentsToSend: args.documentsToSend,
      redirectOnAcceptUrl: args.redirectOnAcceptUrl,
      emailDeliverability: args.emailDeliverability,
      sortOrder,
      sectionConfig: args.sectionConfig,
    });

    return { success: true, templateId };
  },
});

/**
 * Update a template
 */
export const updateTemplate = mutation({
  args: {
    userId: v.id("users"),
    templateId: v.id("proposalTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    introText: v.optional(v.string()),
    termsText: v.optional(v.string()),
    footerText: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    minimumMonthlyFee: v.optional(v.number()),
    proposalType: v.optional(v.string()),
    documentsToSend: v.optional(v.string()),
    redirectOnAcceptUrl: v.optional(v.string()),
    emailDeliverability: v.optional(v.union(v.literal("high"), v.literal("low"))),
    sortOrder: v.optional(v.number()),
    sectionConfig: sectionConfigValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const template = await ctx.db.get(args.templateId);
    if (!template || template.firmId !== user.firmId) {
      throw new Error("Template not found");
    }

    if (args.isDefault && (args.serviceType ?? template.serviceType)) {
      const existingTemplates = await ctx.db
        .query("proposalTemplates")
        .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
        .collect();
      const serviceType = args.serviceType ?? template.serviceType;
      for (const existing of existingTemplates) {
        if (
          existing._id !== args.templateId &&
          existing.serviceType === serviceType &&
          existing.isDefault
        ) {
          await ctx.db.patch(existing._id, { isDefault: false });
        }
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.serviceType !== undefined) updates.serviceType = args.serviceType;
    if (args.introText !== undefined) updates.introText = args.introText;
    if (args.termsText !== undefined) updates.termsText = args.termsText;
    if (args.footerText !== undefined) updates.footerText = args.footerText;
    if (args.isDefault !== undefined) updates.isDefault = args.isDefault;
    if (args.minimumMonthlyFee !== undefined) updates.minimumMonthlyFee = args.minimumMonthlyFee;
    if (args.proposalType !== undefined) updates.proposalType = args.proposalType;
    if (args.documentsToSend !== undefined) updates.documentsToSend = args.documentsToSend;
    if (args.redirectOnAcceptUrl !== undefined) updates.redirectOnAcceptUrl = args.redirectOnAcceptUrl;
    if (args.emailDeliverability !== undefined) updates.emailDeliverability = args.emailDeliverability;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;
    if (args.sectionConfig !== undefined) updates.sectionConfig = args.sectionConfig;

    await ctx.db.patch(args.templateId, updates);
    return { success: true };
  },
});

/**
 * Delete a template
 */
export const deleteTemplate = mutation({
  args: {
    userId: v.id("users"),
    templateId: v.id("proposalTemplates"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const template = await ctx.db.get(args.templateId);
    if (!template || template.firmId !== user.firmId) {
      throw new Error("Template not found");
    }

    await ctx.db.delete(args.templateId);

    return { success: true };
  },
});

/**
 * Set template as default
 */
export const setDefaultTemplate = mutation({
  args: {
    userId: v.id("users"),
    templateId: v.id("proposalTemplates"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const template = await ctx.db.get(args.templateId);
    if (!template || template.firmId !== user.firmId) {
      throw new Error("Template not found");
    }

    // Unset other defaults for this service type
    const existingTemplates = await ctx.db
      .query("proposalTemplates")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();

    for (const existing of existingTemplates) {
      if (
        existing.serviceType === template.serviceType &&
        existing.isDefault
      ) {
        await ctx.db.patch(existing._id, { isDefault: false });
      }
    }

    // Set this as default
    await ctx.db.patch(args.templateId, {
      isDefault: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Reorder template (move up/down)
 */
export const reorderTemplate = mutation({
  args: {
    userId: v.id("users"),
    templateId: v.id("proposalTemplates"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const templates = await ctx.db
      .query("proposalTemplates")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const sorted = [...templates].sort((a, b) => {
      const oa = a.sortOrder ?? 999999;
      const ob = b.sortOrder ?? 999999;
      return oa !== ob ? oa - ob : a.createdAt - b.createdAt;
    });

    const idx = sorted.findIndex((t) => t._id === args.templateId);
    if (idx < 0) throw new Error("Template not found");
    const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return { success: true };

    const current = sorted[idx];
    const swap = sorted[swapIdx];
    const currentOrder = current.sortOrder ?? idx;
    const swapOrder = swap.sortOrder ?? swapIdx;
    await ctx.db.patch(current._id, { sortOrder: swapOrder, updatedAt: Date.now() });
    await ctx.db.patch(swap._id, { sortOrder: currentOrder, updatedAt: Date.now() });
    return { success: true };
  },
});

/**
 * Export template as JSON
 */
export const exportTemplate = query({
  args: {
    userId: v.id("users"),
    templateId: v.id("proposalTemplates"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const template = await ctx.db.get(args.templateId);
    if (!template || template.firmId !== user.firmId) {
      return null;
    }

    return {
      name: template.name,
      description: template.description,
      serviceType: template.serviceType,
      introText: template.introText,
      termsText: template.termsText,
      footerText: template.footerText,
      minimumMonthlyFee: template.minimumMonthlyFee,
      proposalType: template.proposalType,
      documentsToSend: template.documentsToSend,
      redirectOnAcceptUrl: template.redirectOnAcceptUrl,
      emailDeliverability: template.emailDeliverability,
      sectionConfig: template.sectionConfig,
      version: "1.0",
      exportedAt: Date.now(),
    };
  },
});

/**
 * Import template from JSON
 */
export const importTemplate = mutation({
  args: {
    userId: v.id("users"),
    templateData: v.object({
      name: v.string(),
      description: v.optional(v.string()),
      serviceType: v.string(),
      introText: v.string(),
      termsText: v.string(),
      footerText: v.optional(v.string()),
      minimumMonthlyFee: v.optional(v.number()),
      proposalType: v.optional(v.string()),
      documentsToSend: v.optional(v.string()),
      redirectOnAcceptUrl: v.optional(v.string()),
      emailDeliverability: v.optional(v.union(v.literal("high"), v.literal("low"))),
      sectionConfig: sectionConfigValidator,
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const templates = await ctx.db
      .query("proposalTemplates")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const maxOrder = templates.reduce(
      (max, t) => Math.max(max, t.sortOrder ?? 0),
      0
    );

    const templateId = await ctx.db.insert("proposalTemplates", {
      firmId: user.firmId,
      name: args.templateData.name,
      description: args.templateData.description,
      serviceType: args.templateData.serviceType,
      introText: args.templateData.introText,
      termsText: args.templateData.termsText,
      footerText: args.templateData.footerText,
      isDefault: false,
      createdBy: args.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      minimumMonthlyFee: args.templateData.minimumMonthlyFee,
      proposalType: args.templateData.proposalType,
      documentsToSend: args.templateData.documentsToSend,
      redirectOnAcceptUrl: args.templateData.redirectOnAcceptUrl,
      emailDeliverability: args.templateData.emailDeliverability,
      sortOrder: maxOrder + 1,
      sectionConfig: args.templateData.sectionConfig,
    });

    return { success: true, templateId };
  },
});
