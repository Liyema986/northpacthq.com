import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFirmId, getUserFirmIdSafe, requirePermission } from "./lib/permissions";
import { logAuditEntry } from "./lib/auditLog";
import { AuditActions, EntityTypes } from "./lib/auditLog";

/**
 * Get all services for the user's firm with optional filters.
 */
export const listServices = query({
  args: {
    userId: v.id("users"),
    category: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("services"),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      pricingType: v.string(),
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
      hourlyRate: v.optional(v.number()),
      fixedPrice: v.optional(v.number()),
      isActive: v.boolean(),
      sortOrder: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    // If user doesn't exist, return empty array instead of throwing
    if (!firmId) {
      console.warn("listServices: User not found, returning empty array");
      return [];
    }

    let servicesQuery = ctx.db
      .query("services")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId));

    // Apply filters
    if (args.category) {
      servicesQuery = servicesQuery.filter((q) =>
        q.eq(q.field("category"), args.category)
      );
    }

    if (args.activeOnly) {
      servicesQuery = servicesQuery.filter((q) => q.eq(q.field("isActive"), true));
    }

    const services = await servicesQuery.collect();

    // Sort by sortOrder
    services.sort((a, b) => a.sortOrder - b.sortOrder);

    return services.map((service) => ({
      _id: service._id,
      name: service.name,
      description: service.description,
      category: service.category,
      pricingType: service.pricingType,
      pricingTiers: service.pricingTiers,
      hourlyRate: service.hourlyRate,
      fixedPrice: service.fixedPrice,
      isActive: service.isActive,
      sortOrder: service.sortOrder,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }));
  },
});

/**
 * Create a new service.
 */
export const createService = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    pricingType: v.union(
      v.literal("fixed"),
      v.literal("hourly"),
      v.literal("tiered"),
      v.literal("recurring")
    ),
    pricingTiers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.string(),
          criteria: v.optional(v.string()),
        })
      )
    ),
    hourlyRate: v.optional(v.number()),
    fixedPrice: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    serviceId: v.optional(v.id("services")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user has permission to edit pricing
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    // Validate pricing data
    if (args.pricingType === "fixed" && args.fixedPrice === undefined) {
      return { success: false, error: "Fixed price is required" };
    }
    if (args.pricingType === "hourly" && args.hourlyRate === undefined) {
      return { success: false, error: "Hourly rate is required" };
    }
    if (
      (args.pricingType === "tiered" || args.pricingType === "recurring") &&
      (!args.pricingTiers || args.pricingTiers.length === 0)
    ) {
      return { success: false, error: "At least one pricing tier is required" };
    }

    // Validate no negative prices
    if (args.fixedPrice !== undefined && args.fixedPrice < 0) {
      return { success: false, error: "Price cannot be negative" };
    }
    if (args.hourlyRate !== undefined && args.hourlyRate < 0) {
      return { success: false, error: "Hourly rate cannot be negative" };
    }
    if (args.pricingTiers) {
      for (const tier of args.pricingTiers) {
        if (tier.price < 0) {
          return {
            success: false,
            error: `Price for tier "${tier.name}" cannot be negative`,
          };
        }
      }
    }

    // Get current max sortOrder
    const allServices = await ctx.db
      .query("services")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const maxSortOrder = Math.max(0, ...allServices.map((s) => s.sortOrder));

    const serviceId = await ctx.db.insert("services", {
      firmId: user.firmId,
      name: args.name,
      description: args.description,
      category: args.category,
      pricingType: args.pricingType,
      pricingTiers: args.pricingTiers,
      hourlyRate: args.hourlyRate,
      fixedPrice: args.fixedPrice,
      isActive: true,
      sortOrder: maxSortOrder + 1,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEntry(ctx, {
      firmId: user.firmId,
      userId: args.userId,
      entityType: EntityTypes.SERVICE,
      entityId: serviceId,
      action: AuditActions.SERVICE_CREATED,
      metadata: { name: args.name, category: args.category },
    });

    return { success: true, serviceId };
  },
});

/**
 * Update an existing service.
 */
export const updateService = mutation({
  args: {
    userId: v.id("users"),
    serviceId: v.id("services"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    pricingType: v.optional(
      v.union(
        v.literal("fixed"),
        v.literal("hourly"),
        v.literal("tiered"),
        v.literal("recurring")
      )
    ),
    pricingTiers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.string(),
          criteria: v.optional(v.string()),
        })
      )
    ),
    hourlyRate: v.optional(v.number()),
    fixedPrice: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user has permission
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    // Get service and verify it belongs to user's firm
    const service = await ctx.db.get(args.serviceId);
    if (!service) {
      return { success: false, error: "Service not found" };
    }
    if (service.firmId !== user.firmId) {
      return { success: false, error: "Access denied" };
    }

    // Build update object
    const updates: any = { updatedAt: now };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.pricingType !== undefined) updates.pricingType = args.pricingType;
    if (args.pricingTiers !== undefined) updates.pricingTiers = args.pricingTiers;
    if (args.hourlyRate !== undefined) updates.hourlyRate = args.hourlyRate;
    if (args.fixedPrice !== undefined) updates.fixedPrice = args.fixedPrice;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    // Validate no negative prices
    if (updates.fixedPrice !== undefined && updates.fixedPrice < 0) {
      return { success: false, error: "Price cannot be negative" };
    }
    if (updates.hourlyRate !== undefined && updates.hourlyRate < 0) {
      return { success: false, error: "Hourly rate cannot be negative" };
    }
    if (updates.pricingTiers) {
      for (const tier of updates.pricingTiers) {
        if (tier.price < 0) {
          return {
            success: false,
            error: `Price for tier "${tier.name}" cannot be negative`,
          };
        }
      }
    }

    await ctx.db.patch(args.serviceId, updates);

    await logAuditEntry(ctx, {
      firmId: user.firmId,
      userId: args.userId,
      entityType: EntityTypes.SERVICE,
      entityId: args.serviceId,
      action: AuditActions.SERVICE_UPDATED,
      metadata: { name: updates.name ?? service.name },
    });

    return { success: true };
  },
});

/**
 * Duplicate an existing service (creates a copy with " (Copy)" appended to name).
 */
export const duplicateService = mutation({
  args: {
    userId: v.id("users"),
    serviceId: v.id("services"),
  },
  returns: v.object({
    success: v.boolean(),
    newServiceId: v.optional(v.id("services")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    const service = await ctx.db.get(args.serviceId);
    if (!service) {
      return { success: false, error: "Service not found" };
    }
    if (service.firmId !== user.firmId) {
      return { success: false, error: "Access denied" };
    }

    const allServices = await ctx.db
      .query("services")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const maxSortOrder = Math.max(0, ...allServices.map((s) => s.sortOrder));
    const now = Date.now();

    const newServiceId = await ctx.db.insert("services", {
      firmId: user.firmId,
      sectionId: service.sectionId,
      name: `${service.name} (Copy)`,
      description: service.description,
      category: service.category,
      pricingType: service.pricingType,
      pricingTiers: service.pricingTiers,
      hourlyRate: service.hourlyRate,
      fixedPrice: service.fixedPrice,
      isActive: true,
      sortOrder: maxSortOrder + 1,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEntry(ctx, {
      firmId: user.firmId,
      userId: args.userId,
      entityType: EntityTypes.SERVICE,
      entityId: newServiceId,
      action: AuditActions.SERVICE_CREATED,
      metadata: { name: `${service.name} (Copy)`, duplicatedFrom: args.serviceId },
    });

    return { success: true, newServiceId };
  },
});

/**
 * Delete a service.
 */
export const deleteService = mutation({
  args: {
    userId: v.id("users"),
    serviceId: v.id("services"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify user has delete permission
    const user = await requirePermission(ctx, args.userId, "canDeleteRecords");

    // Get service and verify it belongs to user's firm
    const service = await ctx.db.get(args.serviceId);
    if (!service) {
      return { success: false, error: "Service not found" };
    }
    if (service.firmId !== user.firmId) {
      return { success: false, error: "Access denied" };
    }

    await ctx.db.delete(args.serviceId);

    await logAuditEntry(ctx, {
      firmId: user.firmId,
      userId: args.userId,
      entityType: EntityTypes.SERVICE,
      entityId: args.serviceId,
      action: AuditActions.SERVICE_DELETED,
      metadata: { name: service.name },
    });

    return { success: true };
  },
});

/**
 * Reorder services (for drag-and-drop).
 */
export const reorderServices = mutation({
  args: {
    userId: v.id("users"),
    serviceIds: v.array(v.id("services")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canEditPricing");

    // Update sortOrder for each service
    for (let i = 0; i < args.serviceIds.length; i++) {
      const serviceId = args.serviceIds[i];
      const service = await ctx.db.get(serviceId);

      if (service && service.firmId === user.firmId) {
        await ctx.db.patch(serviceId, {
          sortOrder: i,
          updatedAt: Date.now(),
        });
      }
    }

    return null;
  },
});

/**
 * Get service categories (for filter dropdown).
 */
export const getCategories = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    // If user doesn't exist, return empty array instead of throwing
    if (!firmId) {
      console.warn("getCategories: User not found, returning empty array");
      return [];
    }

    const services = await ctx.db
      .query("services")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const categories = [...new Set(services.map((s) => s.category))];
    return categories.sort();
  },
});
