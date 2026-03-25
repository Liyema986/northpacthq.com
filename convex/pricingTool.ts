"use strict";

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getUserFirmId } from "./lib/permissions";

const MAX_STRING_LENGTH = 500;
const MAX_LABEL_LENGTH = 200;
const MAX_TAX_NAME_LENGTH = 100;
const MIN_MONTHLY_FEE_MAX = 999999;

/** Sanitize string for storage: trim, remove null bytes, limit length */
function sanitizeString(s: string, maxLen: number = MAX_STRING_LENGTH): string {
  return String(s ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLen);
}

const ALIGNMENT_SUGGESTED =
  "Payment for [alignment_fee_services] are calculated over 12 months. As we are onboarding you after month [alignment_fee_months_gone] of your financial year, there is a pro-rated amount of [alignment_fee_total_due] to pay. To make this easier for you, we are spreading the cost over the remaining [alignment_fee_months_left] months of the year. How would you like to pay?";

const DEFAULT_ANNUAL_RANGES = [
  "Nil",
  "Up to R1M",
  "R1M - R2,5M",
  "R2.5M - R5M",
  "R5M - R10M",
  "R10M - R20M",
  "R20M - R50M",
  "R50M - R80M",
  "R80M - R120M",
  "R120M - R180M",
  "R180M - R5B",
];

const DEFAULT_SECOND_STYLE_RANGES = [
  "Income tax total/income ranges",
  "Less than R1m",
  "R1m - R20m",
  "R20m - R50m",
  "R50m - R100m",
  "More than R100m",
];

const taxRateValidator = v.object({
  id: v.string(),
  name: v.string(),
  ratePercent: v.number(),
  isDefault: v.boolean(),
});

const updatePatchValidator = v.object({
  annualRevenueRanges: v.optional(v.array(v.string())),
  secondStyleRanges: v.optional(v.array(v.string())),
  showFees: v.optional(v.union(v.literal("breakdown"), v.literal("total-only"))),
  sectionSubTotals: v.optional(v.boolean()),
  dontRoundPrices: v.optional(v.boolean()),
  applyMinFee: v.optional(v.boolean()),
  minMonthlyFee: v.optional(v.number()),
  currency: v.optional(v.string()),
  taxRates: v.optional(v.array(taxRateValidator)),
  upsellSection: v.optional(v.union(v.literal("consider"), v.literal("roadmap"))),
  displayFeesUpsell: v.optional(
    v.union(v.literal("always"), v.literal("never"), v.literal("optional"))
  ),
  enableAnnualised: v.optional(v.boolean()),
  discountOrIncrease: v.optional(v.union(v.literal("discount"), v.literal("increase"))),
  annualisedDiscount: v.optional(v.string()),
  alignmentLineItems: v.optional(v.string()),
  alignmentProposals: v.optional(v.array(v.string())),
  alignmentTool: v.optional(v.string()),
  alignmentPdfMonthly: v.optional(v.string()),
  alignmentPdfOneoff: v.optional(v.string()),
  enableMultipleEntities: v.optional(v.boolean()),
  businessTypes: v.optional(v.string()),
});

function getDefaults() {
  return {
    annualRevenueRanges: DEFAULT_ANNUAL_RANGES,
    secondStyleRanges: DEFAULT_SECOND_STYLE_RANGES,
    showFees: "breakdown" as const,
    sectionSubTotals: false,
    dontRoundPrices: false,
    applyMinFee: true,
    minMonthlyFee: 350,
    currency: "ZAR",
    taxRates: [
      { id: "tax-1", name: "VAT (15%)", ratePercent: 15, isDefault: true },
      { id: "tax-2", name: "Exempt VAT (0%)", ratePercent: 0, isDefault: false },
      { id: "tax-3", name: "Zero Rated (0) (0%)", ratePercent: 0, isDefault: false },
    ],
    upsellSection: "consider" as const,
    displayFeesUpsell: "always" as const,
    enableAnnualised: true,
    discountOrIncrease: "discount" as const,
    annualisedDiscount: "0",
    alignmentLineItems: "All Lines",
    alignmentProposals: ["New Client"],
    alignmentTool: ALIGNMENT_SUGGESTED,
    alignmentPdfMonthly: ALIGNMENT_SUGGESTED,
    alignmentPdfOneoff:
      "Payment for [alignment_fee_services] are calculated over 12 months. As we are onboarding you after month [alignment_fee_months_gone] of your financial year, there is a pro-rated amount of [alignment_fee_total_due] to pay.",
    enableMultipleEntities: true,
    businessTypes: "Company\nSole Trader",
  };
}

/**
 * Get pricing tool settings for the current user's firm. Returns defaults if none saved.
 */
export const getSettings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const firmId = await getUserFirmId(ctx, args.userId);
    const doc = await ctx.db
      .query("pricingToolSettings")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .unique();
    const defaults = getDefaults();
    if (!doc) {
      return { ...defaults, _id: undefined, updatedAt: 0 };
    }
    return {
      _id: doc._id,
      annualRevenueRanges: doc.annualRevenueRanges,
      secondStyleRanges: doc.secondStyleRanges,
      showFees: doc.showFees,
      sectionSubTotals: doc.sectionSubTotals,
      dontRoundPrices: doc.dontRoundPrices,
      applyMinFee: doc.applyMinFee,
      minMonthlyFee: doc.minMonthlyFee,
      currency: doc.currency,
      taxRates: doc.taxRates,
      upsellSection: doc.upsellSection,
      displayFeesUpsell: doc.displayFeesUpsell,
      enableAnnualised: doc.enableAnnualised,
      discountOrIncrease: doc.discountOrIncrease,
      annualisedDiscount: doc.annualisedDiscount,
      alignmentLineItems: doc.alignmentLineItems,
      alignmentProposals: doc.alignmentProposals,
      alignmentTool: doc.alignmentTool,
      alignmentPdfMonthly: doc.alignmentPdfMonthly,
      alignmentPdfOneoff: doc.alignmentPdfOneoff,
      enableMultipleEntities: doc.enableMultipleEntities,
      businessTypes: doc.businessTypes,
      updatedAt: doc.updatedAt,
    };
  },
});

/**
 * Update pricing tool settings (partial patch). Creates document if none exists.
 */
export const updateSettings = mutation({
  args: {
    userId: v.id("users"),
    patch: updatePatchValidator,
  },
  handler: async (ctx, args) => {
    const firmId = await getUserFirmId(ctx, args.userId);
    const now = Date.now();
    const defaults = getDefaults();

    const existing = await ctx.db
      .query("pricingToolSettings")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .unique();

    const patch = { ...args.patch } as Record<string, unknown>;

    // Server-side validation
    if (patch.minMonthlyFee !== undefined) {
      const val = Number(patch.minMonthlyFee);
      if (!Number.isFinite(val) || val < 0 || val > MIN_MONTHLY_FEE_MAX) {
        throw new ConvexError({ message: "Minimum monthly fee must be between 0 and 999,999" });
      }
      patch.minMonthlyFee = Math.round(val);
    }
    if (patch.annualisedDiscount !== undefined) {
      const s = sanitizeString(String(patch.annualisedDiscount), 50);
      if (s && Number.isNaN(parseFloat(s))) {
        throw new ConvexError({ message: "Annualised discount must be a valid number" });
      }
      patch.annualisedDiscount = s;
    }
    if (patch.annualRevenueRanges !== undefined) {
      if (!Array.isArray(patch.annualRevenueRanges)) {
        throw new ConvexError({ message: "Annual revenue ranges must be an array" });
      }
      patch.annualRevenueRanges = (patch.annualRevenueRanges as string[]).map((l) =>
        sanitizeString(l, MAX_LABEL_LENGTH)
      );
    }
    if (patch.secondStyleRanges !== undefined) {
      if (!Array.isArray(patch.secondStyleRanges)) {
        throw new ConvexError({ message: "Second style ranges must be an array" });
      }
      patch.secondStyleRanges = (patch.secondStyleRanges as string[]).map((l) =>
        sanitizeString(l, MAX_LABEL_LENGTH)
      );
    }
    if (patch.currency !== undefined) {
      patch.currency = sanitizeString(String(patch.currency), 10) || "ZAR";
    }
    if (patch.taxRates && Array.isArray(patch.taxRates)) {
      const rates = patch.taxRates as { id: string; name: string; ratePercent: number; isDefault: boolean }[];
      for (const r of rates) {
        if (typeof r.ratePercent !== "number" || r.ratePercent < 0 || r.ratePercent > 100) {
          throw new ConvexError({ message: "Tax rate must be between 0 and 100" });
        }
        r.name = sanitizeString(r.name, MAX_TAX_NAME_LENGTH) || r.name || "New rate";
      }
    }

    // If tax rates are provided, ensure exactly one is default
    if (patch.taxRates && Array.isArray(patch.taxRates)) {
      const rates = patch.taxRates as { id: string; name: string; ratePercent: number; isDefault: boolean }[];
      const defaultCount = rates.filter((r) => r.isDefault).length;
      if (defaultCount !== 1) {
        // Ensure first is default if none, or only one
        const fixed = rates.map((r, i) => ({
          ...r,
          isDefault: defaultCount === 0 ? i === 0 : r.isDefault,
        }));
        if (defaultCount === 0) fixed[0].isDefault = true;
        else if (defaultCount > 1) {
          let first = true;
          for (const r of fixed) {
            if (r.isDefault && !first) r.isDefault = false;
            if (r.isDefault) first = false;
          }
        }
        patch.taxRates = fixed;
      }
    }

    const next = {
      firmId,
      annualRevenueRanges: (patch.annualRevenueRanges as string[]) ?? (existing?.annualRevenueRanges ?? defaults.annualRevenueRanges),
      secondStyleRanges: (patch.secondStyleRanges as string[]) ?? (existing?.secondStyleRanges ?? defaults.secondStyleRanges),
      showFees: (patch.showFees as "breakdown" | "total-only") ?? (existing?.showFees ?? defaults.showFees),
      sectionSubTotals: (patch.sectionSubTotals as boolean) ?? (existing?.sectionSubTotals ?? defaults.sectionSubTotals),
      dontRoundPrices: (patch.dontRoundPrices as boolean) ?? (existing?.dontRoundPrices ?? defaults.dontRoundPrices),
      applyMinFee: (patch.applyMinFee as boolean) ?? (existing?.applyMinFee ?? defaults.applyMinFee),
      minMonthlyFee: (patch.minMonthlyFee as number) ?? (existing?.minMonthlyFee ?? defaults.minMonthlyFee),
      currency: (patch.currency as string) ?? (existing?.currency ?? defaults.currency),
      taxRates: (patch.taxRates as typeof defaults.taxRates) ?? (existing?.taxRates ?? defaults.taxRates),
      upsellSection: (patch.upsellSection as "consider" | "roadmap") ?? (existing?.upsellSection ?? defaults.upsellSection),
      displayFeesUpsell: (patch.displayFeesUpsell as "always" | "never" | "optional") ?? (existing?.displayFeesUpsell ?? defaults.displayFeesUpsell),
      enableAnnualised: (patch.enableAnnualised as boolean) ?? (existing?.enableAnnualised ?? defaults.enableAnnualised),
      discountOrIncrease: (patch.discountOrIncrease as "discount" | "increase") ?? (existing?.discountOrIncrease ?? defaults.discountOrIncrease),
      annualisedDiscount: (patch.annualisedDiscount as string) ?? (existing?.annualisedDiscount ?? defaults.annualisedDiscount),
      alignmentLineItems: (patch.alignmentLineItems as string) ?? (existing?.alignmentLineItems ?? defaults.alignmentLineItems),
      alignmentProposals: (patch.alignmentProposals as string[]) ?? (existing?.alignmentProposals ?? defaults.alignmentProposals),
      alignmentTool: (patch.alignmentTool as string) ?? (existing?.alignmentTool ?? defaults.alignmentTool),
      alignmentPdfMonthly: (patch.alignmentPdfMonthly as string) ?? (existing?.alignmentPdfMonthly ?? defaults.alignmentPdfMonthly),
      alignmentPdfOneoff: (patch.alignmentPdfOneoff as string) ?? (existing?.alignmentPdfOneoff ?? defaults.alignmentPdfOneoff),
      enableMultipleEntities: (patch.enableMultipleEntities as boolean) ?? (existing?.enableMultipleEntities ?? defaults.enableMultipleEntities),
      businessTypes: (patch.businessTypes as string) ?? (existing?.businessTypes ?? defaults.businessTypes),
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }
    return await ctx.db.insert("pricingToolSettings", next);
  },
});

/** Add a new tax rate. Generates id and ensures only one default. */
export const addTaxRate = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    ratePercent: v.number(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const ratePercent = Number(args.ratePercent);
    if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      throw new ConvexError({ message: "Tax rate must be between 0 and 100" });
    }
    const name = sanitizeString(args.name, MAX_TAX_NAME_LENGTH) || "New rate";

    const firmId = await getUserFirmId(ctx, args.userId);
    const now = Date.now();
    const defaults = getDefaults();

    let doc = await ctx.db
      .query("pricingToolSettings")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .unique();

    if (!doc) {
      const id = await ctx.db.insert("pricingToolSettings", {
        firmId,
        ...defaults,
        updatedAt: now,
      });
      doc = (await ctx.db.get(id))!;
    }

    const id = `tax-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newRate = {
      id,
      name,
      ratePercent,
      isDefault: args.isDefault ?? false,
    };
    let rates = [...doc.taxRates];
    if (newRate.isDefault) {
      rates = rates.map((r) => ({ ...r, isDefault: false }));
    }
    rates.push(newRate);
    if (rates.every((r) => !r.isDefault)) rates[0].isDefault = true;

    await ctx.db.patch(doc._id, { taxRates: rates, updatedAt: now });
    return id;
  },
});

/** Remove a tax rate by id. Ensures at least one remains and one default. */
export const removeTaxRate = mutation({
  args: { userId: v.id("users"), taxRateId: v.string() },
  handler: async (ctx, args) => {
    const firmId = await getUserFirmId(ctx, args.userId);
    const doc = await ctx.db
      .query("pricingToolSettings")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .unique();
    if (!doc) {
      throw new ConvexError({ message: "Settings not found" });
    }
    let rates = doc.taxRates.filter((r) => r.id !== args.taxRateId);
    if (rates.length === 0) {
      throw new ConvexError({ message: "Cannot remove the last tax rate. Keep at least one." });
    }
    const hasDefault = rates.some((r) => r.isDefault);
    if (!hasDefault) rates[0].isDefault = true;
    await ctx.db.patch(doc._id, { taxRates: rates, updatedAt: Date.now() });
  },
});

/** Set which tax rate is the default (only one). */
export const setDefaultTaxRate = mutation({
  args: { userId: v.id("users"), taxRateId: v.string() },
  handler: async (ctx, args) => {
    const firmId = await getUserFirmId(ctx, args.userId);
    const doc = await ctx.db
      .query("pricingToolSettings")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .unique();
    if (!doc) return;
    const rates = doc.taxRates.map((r) => ({
      ...r,
      isDefault: r.id === args.taxRateId,
    }));
    await ctx.db.patch(doc._id, { taxRates: rates, updatedAt: Date.now() });
  },
});

/** Update a tax rate's name or ratePercent. */
export const updateTaxRate = mutation({
  args: {
    userId: v.id("users"),
    taxRateId: v.string(),
    name: v.optional(v.string()),
    ratePercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.ratePercent !== undefined) {
      const v = Number(args.ratePercent);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        throw new ConvexError({ message: "Tax rate must be between 0 and 100" });
      }
    }
    const name = args.name !== undefined ? sanitizeString(args.name, MAX_TAX_NAME_LENGTH) : undefined;

    const firmId = await getUserFirmId(ctx, args.userId);
    const doc = await ctx.db
      .query("pricingToolSettings")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .unique();
    if (!doc) {
      throw new ConvexError({ message: "Settings not found" });
    }
    const rates = doc.taxRates.map((r) =>
      r.id === args.taxRateId
        ? {
            ...r,
            ...(name !== undefined && { name: name || r.name }),
            ...(args.ratePercent !== undefined && { ratePercent: Number(args.ratePercent) }),
          }
        : r
    );
    await ctx.db.patch(doc._id, { taxRates: rates, updatedAt: Date.now() });
  },
});
