import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFirmId, getUserFirmIdSafe, requirePermission } from "./lib/permissions";
import { Id } from "./_generated/dataModel";

const calculationVariationOption = v.object({ label: v.string(), value: v.number() });
const calculationVariation = v.object({
  id: v.string(),
  valueType: v.optional(v.union(v.literal("quantity"), v.literal("static"), v.literal("variations"))),
  label: v.optional(v.string()),
  operation: v.union(v.literal("add"), v.literal("multiply"), v.literal("divide"), v.literal("subtract")),
  options: v.optional(v.array(calculationVariationOption)),
  staticValue: v.optional(v.number()),
  quantityFieldLabel: v.optional(v.string()),
});
const lineItemReturn = v.object({
  _id: v.id("services"),
  name: v.string(),
  description: v.optional(v.string()),
  serviceSchedule: v.optional(v.string()),
  billingFrequency: v.optional(v.union(v.literal("monthly"), v.literal("one_off"))),
  pricingType: v.string(),
  taxRate: v.optional(v.string()),
  fieldLabel: v.optional(v.string()),
  fixedPrice: v.optional(v.number()),
  hourlyRate: v.optional(v.number()),
  pricingTiers: v.optional(
    v.array(
      v.object({
        name: v.string(),
        price: v.number(),
        description: v.string(),
        criteria: v.optional(v.string()),
        hours: v.optional(v.number()),
        minutes: v.optional(v.number()),
      })
    )
  ),
  isActive: v.boolean(),
  sortOrder: v.number(),
  status: v.string(), // "complete" | "field-missing" | "price-missing"
  addCalculation: v.optional(v.boolean()),
  calculationVariations: v.optional(v.array(calculationVariation)),
});

const sectionReturn = v.object({
  _id: v.id("serviceSections"),
  name: v.string(),
  description: v.optional(v.string()),
  iconName: v.optional(v.string()),
  iconColor: v.optional(v.string()),
  engagementParagraphHtml: v.optional(v.string()),
  ourResponsibilityText: v.optional(v.string()),
  yourResponsibilityText: v.optional(v.string()),
  linkedLetterVersionId: v.optional(v.id("engagementLetterVersions")),
  sortOrder: v.number(),
  isPublished: v.boolean(),
  lineItems: v.array(lineItemReturn),
});

/**
 * List all sections with their services for the user's firm (Services page).
 */
export const listSectionsWithItems = query({
  args: { userId: v.id("users") },
  returns: v.array(sectionReturn),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("listSectionsWithItems: User not found, returning empty array");
      return [];
    }

    const sections = await ctx.db
      .query("serviceSections")
      .withIndex("by_firm_sort", (q) => q.eq("firmId", firmId))
      .collect();

    const result = await Promise.all(
      sections.map(async (section) => {
        const items = await ctx.db
          .query("services")
          .withIndex("by_section", (q) => q.eq("sectionId", section._id))
          .collect();
        items.sort((a, b) => a.sortOrder - b.sortOrder);

        const hasRealText = (html: string | undefined) => {
          if (!html || !html.trim()) return false;
          const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
          return text.length > 0;
        };

        const lineItems = items.map((s) => {
          const hasName = !!s.name?.trim();
          const hasDesc = hasRealText(s.description);
          const hasSchedule = hasRealText(s.serviceSchedule);
          const hasPrice =
            (s.fixedPrice != null && s.fixedPrice > 0) ||
            (s.hourlyRate != null && s.hourlyRate > 0) ||
            (s.pricingTiers && s.pricingTiers.length > 0);
          // GoProposal traffic light: Red = missing price or description; Amber = missing schedule or field label; Green = all complete
          let status: "complete" | "field-missing" | "price-missing" = "complete";
          if (!hasPrice || !hasDesc) status = "price-missing"; // Red: essential details
          else if (!hasSchedule || !hasName) status = "field-missing"; // Amber: needs review

          return {
            _id: s._id,
            name: s.name,
            description: s.description,
            serviceSchedule: s.serviceSchedule,
            billingFrequency: s.billingFrequency,
            pricingType: s.pricingType,
            taxRate: s.taxRate,
            fieldLabel: s.fieldLabel,
            fixedPrice: s.fixedPrice,
            hourlyRate: s.hourlyRate,
            pricingTiers: s.pricingTiers,
            isActive: s.isActive,
            sortOrder: s.sortOrder,
            status,
            addCalculation: s.addCalculation ?? false,
            calculationVariations: s.calculationVariations ?? [],
          };
        });

        return {
          _id: section._id,
          name: section.name,
          description: section.description,
          iconName: section.iconName,
          iconColor: section.iconColor,
          engagementParagraphHtml: section.engagementParagraphHtml,
          ourResponsibilityText: section.ourResponsibilityText,
          yourResponsibilityText: section.yourResponsibilityText,
          linkedLetterVersionId: section.linkedLetterVersionId,
          sortOrder: section.sortOrder,
          isPublished: section.isPublished,
          lineItems,
        };
      })
    );

    return result;
  },
});

/**
 * Create a new section.
 */
export const createSection = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    iconName: v.optional(v.string()),
    iconColor: v.optional(v.string()),
    engagementParagraphHtml: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
  },
  returns: v.object({ success: v.boolean(), sectionId: v.optional(v.id("serviceSections")), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");
    const now = Date.now();

    const sections = await ctx.db
      .query("serviceSections")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const maxOrder = Math.max(0, ...sections.map((s) => s.sortOrder));

    const sectionId = await ctx.db.insert("serviceSections", {
      firmId: user.firmId,
      name: args.name,
      description: args.description,
      iconName: args.iconName,
      iconColor: args.iconColor,
      engagementParagraphHtml: args.engagementParagraphHtml,
      sortOrder: maxOrder + 1,
      isPublished: args.isPublished ?? false,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, sectionId };
  },
});

/**
 * Update a section.
 */
export const updateSection = mutation({
  args: {
    userId: v.id("users"),
    sectionId: v.id("serviceSections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    iconName: v.optional(v.string()),
    iconColor: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    engagementParagraphHtml: v.optional(v.string()),
    ourResponsibilityText: v.optional(v.string()),
    yourResponsibilityText: v.optional(v.string()),
    linkedLetterVersionId: v.optional(v.id("engagementLetterVersions")),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const section = await ctx.db.get(args.sectionId);
    if (!section || section.firmId !== user.firmId) {
      return { success: false, error: "Section not found" };
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) {
        return { success: false, error: "Section name is required" };
      }
      updates.name = trimmed;
    }
    if (args.description !== undefined) updates.description = args.description;
    if (args.iconName !== undefined) updates.iconName = args.iconName;
    if (args.iconColor !== undefined) updates.iconColor = args.iconColor;
    if (args.isPublished !== undefined) updates.isPublished = args.isPublished;
    if (args.engagementParagraphHtml !== undefined)
      updates.engagementParagraphHtml = args.engagementParagraphHtml;
    if (args.ourResponsibilityText !== undefined)
      updates.ourResponsibilityText = args.ourResponsibilityText;
    if (args.yourResponsibilityText !== undefined)
      updates.yourResponsibilityText = args.yourResponsibilityText;
    if (args.linkedLetterVersionId !== undefined)
      updates.linkedLetterVersionId = args.linkedLetterVersionId;

    await ctx.db.patch(args.sectionId, updates);
    return { success: true };
  },
});

/**
 * Delete a section and all its services.
 */
export const deleteSection = mutation({
  args: {
    userId: v.id("users"),
    sectionId: v.id("serviceSections"),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canDeleteRecords");

    const section = await ctx.db.get(args.sectionId);
    if (!section || section.firmId !== user.firmId) {
      return { success: false, error: "Section not found" };
    }

    const items = await ctx.db
      .query("services")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.sectionId);
    return { success: true };
  },
});

/**
 * Create a service in a section.
 */
export const createLineItem = mutation({
  args: {
    userId: v.id("users"),
    sectionId: v.id("serviceSections"),
    name: v.string(),
    description: v.optional(v.string()),
    serviceSchedule: v.optional(v.string()),
    billingFrequency: v.optional(v.union(v.literal("monthly"), v.literal("one_off"))),
    pricingType: v.union(
      v.literal("fixed"),
      v.literal("hourly"),
      v.literal("tiered"),
      v.literal("recurring"),
      v.literal("variation"),
      v.literal("income_range")
    ),
    taxRate: v.optional(v.string()),
    fieldLabel: v.optional(v.string()),
    fixedPrice: v.optional(v.number()),
    hourlyRate: v.optional(v.number()),
    pricingTiers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.string(),
          criteria: v.optional(v.string()),
          hours: v.optional(v.number()),
          minutes: v.optional(v.number()),
        })
      )
    ),
    applyMinimumFee: v.optional(v.boolean()),
    minMonthlyFee: v.optional(v.number()),
    minFeeType: v.optional(v.union(v.literal("fixed"), v.literal("calculation"))),
    minFeeCurrency: v.optional(v.string()),
    minFeeCalculation: v.optional(v.string()),
    addCalculation: v.optional(v.boolean()),
    calculationVariations: v.optional(v.array(calculationVariation)),
  },
  returns: v.object({ success: v.boolean(), lineItemId: v.optional(v.id("services")), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const section = await ctx.db.get(args.sectionId);
    if (!section || section.firmId !== user.firmId) {
      return { success: false, error: "Section not found" };
    }

    const items = await ctx.db
      .query("services")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();
    const maxOrder = Math.max(0, ...items.map((s) => s.sortOrder));
    const now = Date.now();

    const lineItemId = await ctx.db.insert("services", {
      firmId: user.firmId,
      sectionId: args.sectionId,
      name: args.name,
      description: args.description,
      serviceSchedule: args.serviceSchedule,
      category: section.name,
      ...(args.billingFrequency !== undefined && { billingFrequency: args.billingFrequency }),
      pricingType: args.pricingType,
      ...(args.taxRate !== undefined && { taxRate: args.taxRate }),
      ...(args.fieldLabel !== undefined && { fieldLabel: args.fieldLabel }),
      pricingTiers: args.pricingTiers,
      fixedPrice: args.fixedPrice,
      hourlyRate: args.hourlyRate,
      isActive: false, // New services start as draft (unpublished)
      sortOrder: maxOrder + 1,
      ...(args.applyMinimumFee !== undefined && { applyMinimumFee: args.applyMinimumFee }),
      ...(args.minMonthlyFee !== undefined && { minMonthlyFee: args.minMonthlyFee }),
      ...(args.minFeeType !== undefined && { minFeeType: args.minFeeType }),
      ...(args.minFeeCurrency !== undefined && { minFeeCurrency: args.minFeeCurrency }),
      ...(args.minFeeCalculation !== undefined && { minFeeCalculation: args.minFeeCalculation }),
      ...(args.addCalculation !== undefined && { addCalculation: args.addCalculation }),
      ...(args.calculationVariations !== undefined && { calculationVariations: args.calculationVariations }),
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, lineItemId };
  },
});

/**
 * Update a service.
 */
export const updateLineItem = mutation({
  args: {
    userId: v.id("users"),
    lineItemId: v.id("services"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    serviceSchedule: v.optional(v.string()),
    billingFrequency: v.optional(v.union(v.literal("monthly"), v.literal("one_off"))),
    pricingType: v.optional(
      v.union(
        v.literal("fixed"),
        v.literal("hourly"),
        v.literal("tiered"),
        v.literal("recurring"),
        v.literal("variation"),
        v.literal("income_range")
      )
    ),
    taxRate: v.optional(v.string()),
    fieldLabel: v.optional(v.string()),
    fixedPrice: v.optional(v.number()),
    hourlyRate: v.optional(v.number()),
    pricingTiers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.string(),
          criteria: v.optional(v.string()),
          hours: v.optional(v.number()),
          minutes: v.optional(v.number()),
        })
      )
    ),
    isActive: v.optional(v.boolean()),
    applyMinimumFee: v.optional(v.boolean()),
    minMonthlyFee: v.optional(v.number()),
    minFeeType: v.optional(v.union(v.literal("fixed"), v.literal("calculation"))),
    minFeeCurrency: v.optional(v.string()),
    minFeeCalculation: v.optional(v.string()),
    addCalculation: v.optional(v.boolean()),
    calculationVariations: v.optional(v.array(calculationVariation)),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const service = await ctx.db.get(args.lineItemId);
    if (!service || service.firmId !== user.firmId) {
      return { success: false, error: "Service not found" };
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.serviceSchedule !== undefined) updates.serviceSchedule = args.serviceSchedule;
    if (args.billingFrequency !== undefined) updates.billingFrequency = args.billingFrequency;
    if (args.pricingType !== undefined) updates.pricingType = args.pricingType;
    if (args.taxRate !== undefined) updates.taxRate = args.taxRate;
    if (args.fieldLabel !== undefined) updates.fieldLabel = args.fieldLabel;
    if (args.fixedPrice !== undefined) updates.fixedPrice = args.fixedPrice;
    if (args.hourlyRate !== undefined) updates.hourlyRate = args.hourlyRate;
    if (args.pricingTiers !== undefined) updates.pricingTiers = args.pricingTiers;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.applyMinimumFee !== undefined) updates.applyMinimumFee = args.applyMinimumFee;
    if (args.minMonthlyFee !== undefined) updates.minMonthlyFee = args.minMonthlyFee;
    if (args.minFeeType !== undefined) updates.minFeeType = args.minFeeType;
    if (args.minFeeCurrency !== undefined) updates.minFeeCurrency = args.minFeeCurrency;
    if (args.minFeeCalculation !== undefined) updates.minFeeCalculation = args.minFeeCalculation;
    if (args.addCalculation !== undefined) updates.addCalculation = args.addCalculation;
    if (args.calculationVariations !== undefined) updates.calculationVariations = args.calculationVariations;

    await ctx.db.patch(args.lineItemId, updates);
    return { success: true };
  },
});

/**
 * Duplicate a service within the same section.
 */
export const duplicateLineItem = mutation({
  args: {
    userId: v.id("users"),
    sectionId: v.id("serviceSections"),
    lineItemId: v.id("services"),
    newName: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), lineItemId: v.optional(v.id("services")), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const section = await ctx.db.get(args.sectionId);
    if (!section || section.firmId !== user.firmId) {
      return { success: false, error: "Section not found" };
    }

    const source = await ctx.db.get(args.lineItemId);
    if (!source || source.firmId !== user.firmId || source.sectionId !== args.sectionId) {
      return { success: false, error: "Service not found" };
    }

    const items = await ctx.db
      .query("services")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();
    const maxOrder = Math.max(0, ...items.map((s) => s.sortOrder));
    const now = Date.now();
    const name = (args.newName ?? `${source.name} (Copy)`).trim() || `${source.name} (Copy)`;

    const lineItemId = await ctx.db.insert("services", {
      firmId: user.firmId,
      sectionId: args.sectionId,
      name,
      description: source.description,
      serviceSchedule: source.serviceSchedule,
      category: section.name,
      pricingType: source.pricingType,
      pricingTiers: source.pricingTiers,
      fixedPrice: source.fixedPrice,
      hourlyRate: source.hourlyRate,
      isActive: false, // Duplicate starts as draft (unpublished)
      sortOrder: maxOrder + 1,
      ...(source.addCalculation !== undefined && { addCalculation: source.addCalculation }),
      ...(source.calculationVariations && { calculationVariations: source.calculationVariations }),
      ...(source.billingFrequency !== undefined && { billingFrequency: source.billingFrequency }),
      ...(source.taxRate !== undefined && { taxRate: source.taxRate }),
      ...(source.fieldLabel !== undefined && { fieldLabel: source.fieldLabel }),
      ...(source.applyMinimumFee !== undefined && { applyMinimumFee: source.applyMinimumFee }),
      ...(source.minMonthlyFee !== undefined && { minMonthlyFee: source.minMonthlyFee }),
      ...(source.minFeeType !== undefined && { minFeeType: source.minFeeType }),
      ...(source.minFeeCurrency !== undefined && { minFeeCurrency: source.minFeeCurrency }),
      ...(source.minFeeCalculation !== undefined && { minFeeCalculation: source.minFeeCalculation }),
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, lineItemId };
  },
});

/**
 * Delete a service.
 */
export const deleteLineItem = mutation({
  args: {
    userId: v.id("users"),
    lineItemId: v.id("services"),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canDeleteRecords");

    const service = await ctx.db.get(args.lineItemId);
    if (!service || service.firmId !== user.firmId) {
      return { success: false, error: "Service not found" };
    }

    await ctx.db.delete(args.lineItemId);
    return { success: true };
  },
});

/**
 * Reorder a section (move up or down).
 */
export const reorderSection = mutation({
  args: {
    userId: v.id("users"),
    sectionId: v.id("serviceSections"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const sections = await ctx.db
      .query("serviceSections")
      .withIndex("by_firm_sort", (q) => q.eq("firmId", user.firmId))
      .collect();

    const idx = sections.findIndex((s) => s._id === args.sectionId);
    if (idx < 0) return { success: false, error: "Section not found" };

    const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return { success: true };

    const a = sections[idx];
    const b = sections[swapIdx];
    await ctx.db.patch(a._id, { sortOrder: b.sortOrder, updatedAt: Date.now() });
    await ctx.db.patch(b._id, { sortOrder: a.sortOrder, updatedAt: Date.now() });
    return { success: true };
  },
});

/**
 * Global price adjustment - adjust all service prices across all sections.
 */
export const globalPriceAdjustment = mutation({
  args: {
    userId: v.id("users"),
    adjustmentType: v.union(v.literal("increase"), v.literal("decrease")),
    adjustmentMethod: v.union(v.literal("percentage"), v.literal("cost")),
    amount: v.number(),
  },
  returns: v.object({ success: v.boolean(), updatedCount: v.optional(v.number()), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    if (args.amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    // Get all services for this firm
    const services = await ctx.db
      .query("services")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();

    const now = Date.now();
    let updatedCount = 0;

    for (const service of services) {
      const updates: Record<string, unknown> = { updatedAt: now };
      
      // Adjust fixed price
      if (service.fixedPrice != null && service.fixedPrice > 0) {
        let newPrice = service.fixedPrice;
        if (args.adjustmentMethod === "percentage") {
          const adjustment = (service.fixedPrice * args.amount) / 100;
          newPrice = args.adjustmentType === "increase"
            ? service.fixedPrice + adjustment
            : Math.max(0, service.fixedPrice - adjustment);
        } else {
          newPrice = args.adjustmentType === "increase"
            ? service.fixedPrice + args.amount
            : Math.max(0, service.fixedPrice - args.amount);
        }
        updates.fixedPrice = Math.round(newPrice * 100) / 100; // Round to 2 decimal places
      }

      // Adjust hourly rate
      if (service.hourlyRate != null && service.hourlyRate > 0) {
        let newRate = service.hourlyRate;
        if (args.adjustmentMethod === "percentage") {
          const adjustment = (service.hourlyRate * args.amount) / 100;
          newRate = args.adjustmentType === "increase"
            ? service.hourlyRate + adjustment
            : Math.max(0, service.hourlyRate - adjustment);
        } else {
          newRate = args.adjustmentType === "increase"
            ? service.hourlyRate + args.amount
            : Math.max(0, service.hourlyRate - args.amount);
        }
        updates.hourlyRate = Math.round(newRate * 100) / 100;
      }

      // Only update if we have price changes
      if (updates.fixedPrice !== undefined || updates.hourlyRate !== undefined) {
        await ctx.db.patch(service._id, updates);
        updatedCount++;
      }
    }

    return { success: true, updatedCount };
  },
});

/**
 * Section price adjustment - adjust all service prices within a specific section.
 */
export const sectionPriceAdjustment = mutation({
  args: {
    userId: v.id("users"),
    sectionId: v.id("serviceSections"),
    adjustmentType: v.union(v.literal("increase"), v.literal("decrease")),
    adjustmentMethod: v.union(v.literal("percentage"), v.literal("cost")),
    amount: v.number(),
  },
  returns: v.object({ success: v.boolean(), updatedCount: v.optional(v.number()), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    if (args.amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    const section = await ctx.db.get(args.sectionId);
    if (!section || section.firmId !== user.firmId) {
      return { success: false, error: "Section not found" };
    }

    // Get all services for this section
    const services = await ctx.db
      .query("services")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    const now = Date.now();
    let updatedCount = 0;

    for (const service of services) {
      const updates: Record<string, unknown> = { updatedAt: now };
      
      // Adjust fixed price
      if (service.fixedPrice != null && service.fixedPrice > 0) {
        let newPrice = service.fixedPrice;
        if (args.adjustmentMethod === "percentage") {
          const adjustment = (service.fixedPrice * args.amount) / 100;
          newPrice = args.adjustmentType === "increase"
            ? service.fixedPrice + adjustment
            : Math.max(0, service.fixedPrice - adjustment);
        } else {
          newPrice = args.adjustmentType === "increase"
            ? service.fixedPrice + args.amount
            : Math.max(0, service.fixedPrice - args.amount);
        }
        updates.fixedPrice = Math.round(newPrice * 100) / 100;
      }

      // Adjust hourly rate
      if (service.hourlyRate != null && service.hourlyRate > 0) {
        let newRate = service.hourlyRate;
        if (args.adjustmentMethod === "percentage") {
          const adjustment = (service.hourlyRate * args.amount) / 100;
          newRate = args.adjustmentType === "increase"
            ? service.hourlyRate + adjustment
            : Math.max(0, service.hourlyRate - adjustment);
        } else {
          newRate = args.adjustmentType === "increase"
            ? service.hourlyRate + args.amount
            : Math.max(0, service.hourlyRate - args.amount);
        }
        updates.hourlyRate = Math.round(newRate * 100) / 100;
      }

      if (updates.fixedPrice !== undefined || updates.hourlyRate !== undefined) {
        await ctx.db.patch(service._id, updates);
        updatedCount++;
      }
    }

    return { success: true, updatedCount };
  },
});

// Section templates for import
const SECTION_TEMPLATES: Record<string, { name: string; lineItems: { name: string; description?: string; fixedPrice?: number }[] }> = {
  "monthly-accounting": {
    name: "Monthly Accounting",
    lineItems: [
      { name: "Bank reconciliations", description: "Monthly bank statement reconciliation", fixedPrice: 500 },
      { name: "Monthly journals", description: "Processing of monthly journal entries", fixedPrice: 750 },
      { name: "Debtors management", description: "Age analysis and collection follow-ups", fixedPrice: 400 },
      { name: "Creditors management", description: "Payment scheduling and reconciliation", fixedPrice: 400 },
      { name: "VAT calculations and submissions", description: "Monthly VAT return preparation and submission", fixedPrice: 650 },
    ],
  },
  "annual-compliance": {
    name: "Annual Compliance",
    lineItems: [
      { name: "Annual financial statements", description: "Preparation of annual financial statements", fixedPrice: 3500 },
      { name: "Income tax returns", description: "Corporate income tax return preparation and submission", fixedPrice: 1500 },
      { name: "CIPC annual returns", description: "Company annual return filing", fixedPrice: 350 },
      { name: "SARS registrations", description: "Tax and PAYE registration services", fixedPrice: 500 },
    ],
  },
  "payroll-services": {
    name: "Payroll Services",
    lineItems: [
      { name: "Monthly payroll processing", description: "Processing of monthly salaries and wages", fixedPrice: 75 },
      { name: "EMP201 submissions", description: "Monthly PAYE submissions to SARS", fixedPrice: 200 },
      { name: "IRP5 certificates", description: "Annual employee tax certificates", fixedPrice: 50 },
      { name: "UIF declarations", description: "Unemployment insurance fund submissions", fixedPrice: 150 },
    ],
  },
  "advisory-services": {
    name: "Advisory Services",
    lineItems: [
      { name: "Business consulting", description: "Strategic business advisory services", fixedPrice: 1500 },
      { name: "Financial planning", description: "Cash flow and financial projections", fixedPrice: 2000 },
      { name: "Tax planning", description: "Tax optimization and planning strategies", fixedPrice: 1800 },
      { name: "Cash flow management", description: "Working capital optimization", fixedPrice: 1200 },
    ],
  },
};

/**
 * Import sections from predefined templates.
 */
export const importSections = mutation({
  args: {
    userId: v.id("users"),
    templateIds: v.array(v.string()),
  },
  returns: v.object({ success: v.boolean(), importedCount: v.optional(v.number()), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    if (args.templateIds.length === 0) {
      return { success: false, error: "No templates selected" };
    }

    const now = Date.now();
    let importedCount = 0;

    // Get existing sections to determine sort order and check for duplicates
    const existingSections = await ctx.db
      .query("serviceSections")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const existingSectionNames = new Set(existingSections.map((s) => s.name.toLowerCase()));
    let maxSectionOrder = Math.max(0, ...existingSections.map((s) => s.sortOrder));

    for (const templateId of args.templateIds) {
      const template = SECTION_TEMPLATES[templateId];
      if (!template) continue;

      // Skip if section with same name already exists (avoid duplicates on re-import)
      if (existingSectionNames.has(template.name.toLowerCase())) {
        continue;
      }

      // Create section
      maxSectionOrder++;
      const sectionId = await ctx.db.insert("serviceSections", {
        firmId: user.firmId,
        name: template.name,
        description: `Imported from ${template.name} template`,
        sortOrder: maxSectionOrder,
        isPublished: false,
        createdAt: now,
        updatedAt: now,
      });

      // Create services (imported services start as draft/unpublished)
      for (let i = 0; i < template.lineItems.length; i++) {
        const item = template.lineItems[i];
        await ctx.db.insert("services", {
          firmId: user.firmId,
          sectionId,
          name: item.name,
          description: item.description,
          category: template.name,
          pricingType: "fixed",
          fixedPrice: item.fixedPrice,
          isActive: false,
          sortOrder: i + 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      importedCount++;
      existingSectionNames.add(template.name.toLowerCase());
    }

    return { success: true, importedCount };
  },
});
