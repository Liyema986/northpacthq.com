// convex/pricing.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Industry-based pricing multipliers
 */
const INDUSTRY_MULTIPLIERS = {
  "Financial Services": 1.4,
  "Healthcare": 1.3,
  "Technology": 1.3,
  "Manufacturing": 1.2,
  "Real Estate": 1.15,
  "Retail": 1.1,
  "Professional Services": 1.2,
  "Non-Profit": 0.9,
  "Construction": 1.1,
  "Other": 1.0,
};

/**
 * Company size multipliers
 */
const SIZE_MULTIPLIERS = {
  "1-10": 0.8,
  "11-50": 1.0,
  "51-200": 1.3,
  "201-500": 1.6,
  "501+": 2.0,
};

/**
 * Service complexity multipliers
 */
const COMPLEXITY_MULTIPLIERS = {
  "simple": 0.8,
  "moderate": 1.0,
  "complex": 1.3,
  "very-complex": 1.6,
};

/**
 * Urgency multipliers
 */
const URGENCY_MULTIPLIERS = {
  "standard": 1.0,
  "expedited": 1.2,
  "rush": 1.5,
};

/**
 * Get pricing recommendation based on client and service characteristics
 */
export const suggestPricing = query({
  args: {
    userId: v.id("users"),
    serviceId: v.id("services"),
    clientId: v.id("clients"),
    industry: v.optional(v.string()),
    companySize: v.string(),
    complexity: v.string(),
    urgency: v.string(),
    estimatedHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get user and verify access
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get service base price
    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");
    if (service.firmId !== user.firmId) {
      throw new Error("Access denied");
    }

    // Get client information
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found");
    if (client.firmId !== user.firmId) {
      throw new Error("Access denied");
    }

    // Calculate base price from service
    let basePrice = 0;
    if (service.pricingType === "fixed") {
      basePrice = service.fixedPrice || 0;
    } else if (service.pricingType === "hourly") {
      basePrice = (service.hourlyRate || 0) * (args.estimatedHours || 10);
    } else if (service.pricingType === "tiered" || service.pricingType === "recurring") {
      // For tiered/recurring, use fixed price as base
      basePrice = service.fixedPrice || 0;
    }

    // Apply multipliers
    const industryMultiplier =
      INDUSTRY_MULTIPLIERS[client.industry as keyof typeof INDUSTRY_MULTIPLIERS] ||
      INDUSTRY_MULTIPLIERS["Other"];
    
    const sizeMultiplier =
      SIZE_MULTIPLIERS[args.companySize as keyof typeof SIZE_MULTIPLIERS] || 1.0;
    
    const complexityMultiplier =
      COMPLEXITY_MULTIPLIERS[args.complexity as keyof typeof COMPLEXITY_MULTIPLIERS] || 1.0;
    
    const urgencyMultiplier =
      URGENCY_MULTIPLIERS[args.urgency as keyof typeof URGENCY_MULTIPLIERS] || 1.0;

    // Calculate suggested price
    const suggestedPrice =
      basePrice *
      industryMultiplier *
      sizeMultiplier *
      complexityMultiplier *
      urgencyMultiplier;

    // Calculate confidence score (1-5 scale)
    let confidence = 5;
    
    // Reduce confidence if using defaults
    if (!client.annualRevenue) confidence -= 0.5;
    if (!args.estimatedHours && service.pricingType === "hourly") confidence -= 0.5;
    if (args.complexity === "very-complex") confidence -= 0.5; // Complex projects harder to estimate
    if (args.urgency === "rush") confidence -= 0.3; // Rush jobs have more variables
    
    // Ensure confidence is between 1 and 5
    confidence = Math.max(1, Math.min(5, confidence));

    // Get firm average for comparison
    const allProposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    
    const firmAverage =
      allProposals.length > 0
        ? allProposals.reduce((sum, p) => sum + p.total, 0) / allProposals.length
        : basePrice;

    // Build reasoning
    const factors = [];
    
    if (industryMultiplier !== 1.0) {
      factors.push(
        `${client.industry} industry (${industryMultiplier > 1 ? "+" : ""}${((industryMultiplier - 1) * 100).toFixed(0)}%)`
      );
    }
    
    if (sizeMultiplier !== 1.0) {
      factors.push(
        `Company size ${args.companySize} employees (${sizeMultiplier > 1 ? "+" : ""}${((sizeMultiplier - 1) * 100).toFixed(0)}%)`
      );
    }
    
    if (complexityMultiplier !== 1.0) {
      factors.push(
        `${args.complexity} complexity (${complexityMultiplier > 1 ? "+" : ""}${((complexityMultiplier - 1) * 100).toFixed(0)}%)`
      );
    }
    
    if (urgencyMultiplier !== 1.0) {
      factors.push(
        `${args.urgency} timeline (${urgencyMultiplier > 1 ? "+" : ""}${((urgencyMultiplier - 1) * 100).toFixed(0)}%)`
      );
    }

    const reasoning =
      factors.length > 0
        ? `Based on: ${factors.join(", ")}`
        : "Standard pricing based on service rate";

    // Calculate percentage difference from firm average
    const comparisonToAverage =
      ((suggestedPrice - firmAverage) / firmAverage) * 100;

    return {
      suggestedPrice: Math.round(suggestedPrice),
      confidence: Math.round(confidence * 10) / 10, // Round to 1 decimal
      reasoning,
      factors: {
        basePrice: Math.round(basePrice),
        industryMultiplier,
        sizeMultiplier,
        complexityMultiplier,
        urgencyMultiplier,
      },
      firmAverage: Math.round(firmAverage),
      comparisonToAverage: Math.round(comparisonToAverage),
      serviceName: service.name,
      clientName: client.companyName,
    };
  },
});

/**
 * Store pricing feedback for learning
 */
export const storePricingFeedback = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    suggestedPrice: v.number(),
    actualPrice: v.number(),
    wasAccepted: v.boolean(),
    justification: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Store as activity for future ML training
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "pricing-feedback",
      entityId: args.proposalId,
      action: args.wasAccepted ? "accepted" : "overridden",
      metadata: {
        suggestedPrice: args.suggestedPrice,
        actualPrice: args.actualPrice,
        difference: args.actualPrice - args.suggestedPrice,
        percentageDiff: ((args.actualPrice - args.suggestedPrice) / args.suggestedPrice) * 100,
        justification: args.justification,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});
