import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFirmIdSafe, requirePermission } from "./lib/permissions";

/**
 * Get the current user's firm settings.
 */
export const getFirmSettings = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return null;

    const firm = await ctx.db.get(firmId);
    if (!firm) return null;

    // Prefer the stored URL (set at upload time). Fall back to resolving from storageId for
    // firms that uploaded a logo before this field was added.
    let firmLogoUrl: string | null = firm.logoUrl ?? null;
    if (!firmLogoUrl && firm.logo) {
      firmLogoUrl = await ctx.storage.getUrl(firm.logo);
    }

    return {
      _id: firm._id,
      name: firm.name,
      firmLogoUrl,
      billingEmail: firm.billingEmail,
      phone: firm.phone ?? "",
      currency: firm.currency,
      jurisdiction: firm.jurisdiction,
      subscriptionPlan: firm.subscriptionPlan,
      subscriptionStatus: firm.subscriptionStatus,
      proposalNumberPrefix: firm.proposalNumberPrefix ?? "PROP-",
      defaultProposalValidityDays: firm.defaultProposalValidityDays ?? 30,
      requireApprovalBeforeSend: firm.requireApprovalBeforeSend ?? false,
      autoExpireProposals: firm.autoExpireProposals ?? true,
      autoExpireDays: firm.autoExpireDays ?? 30,
      sendFollowUpReminders: firm.sendFollowUpReminders ?? true,
      followUpReminderDays: firm.followUpReminderDays ?? 3,
      requireClientSignature: firm.requireClientSignature ?? false,
      defaultPaymentFrequency: firm.defaultPaymentFrequency ?? "monthly",
      showTaxInclusive: firm.showTaxInclusive ?? false,
      roundPrices: firm.roundPrices ?? true,
      defaultTaxRate: firm.defaultTaxRate ?? 15,
      vatRegistered: firm.vatRegistered ?? false,
      vatNumber: firm.vatNumber ?? "",
      brandColors: firm.brandColors,
    };
  },
});

/**
 * Update firm settings.
 */
export const updateFirmSettings = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    currency: v.optional(v.string()),
    jurisdiction: v.optional(
      v.union(
        v.literal("US"), v.literal("UK"), v.literal("CA"),
        v.literal("AU"), v.literal("NZ"), v.literal("ZA")
      )
    ),
    proposalNumberPrefix: v.optional(v.string()),
    defaultProposalValidityDays: v.optional(v.number()),
    requireApprovalBeforeSend: v.optional(v.boolean()),
    autoExpireProposals: v.optional(v.boolean()),
    autoExpireDays: v.optional(v.number()),
    sendFollowUpReminders: v.optional(v.boolean()),
    followUpReminderDays: v.optional(v.number()),
    requireClientSignature: v.optional(v.boolean()),
    defaultPaymentFrequency: v.optional(v.union(
      v.literal("monthly"), v.literal("quarterly"),
      v.literal("annually"), v.literal("as_delivered")
    )),
    showTaxInclusive: v.optional(v.boolean()),
    roundPrices: v.optional(v.boolean()),
    defaultTaxRate: v.optional(v.number()),
    vatRegistered: v.optional(v.boolean()),
    vatNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageFirm");
    const now = Date.now();

    const updates: Record<string, unknown> = { updatedAt: now };
    if (args.name !== undefined) updates.name = args.name;
    if (args.billingEmail !== undefined) updates.billingEmail = args.billingEmail;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.jurisdiction !== undefined) updates.jurisdiction = args.jurisdiction;
    if (args.proposalNumberPrefix !== undefined) updates.proposalNumberPrefix = args.proposalNumberPrefix;
    if (args.defaultProposalValidityDays !== undefined) updates.defaultProposalValidityDays = args.defaultProposalValidityDays;
    if (args.requireApprovalBeforeSend !== undefined) updates.requireApprovalBeforeSend = args.requireApprovalBeforeSend;
    if (args.autoExpireProposals !== undefined) updates.autoExpireProposals = args.autoExpireProposals;
    if (args.autoExpireDays !== undefined) updates.autoExpireDays = args.autoExpireDays;
    if (args.sendFollowUpReminders !== undefined) updates.sendFollowUpReminders = args.sendFollowUpReminders;
    if (args.followUpReminderDays !== undefined) updates.followUpReminderDays = args.followUpReminderDays;
    if (args.requireClientSignature !== undefined) updates.requireClientSignature = args.requireClientSignature;
    if (args.defaultPaymentFrequency !== undefined) updates.defaultPaymentFrequency = args.defaultPaymentFrequency;
    if (args.showTaxInclusive !== undefined) updates.showTaxInclusive = args.showTaxInclusive;
    if (args.roundPrices !== undefined) updates.roundPrices = args.roundPrices;
    if (args.defaultTaxRate !== undefined) updates.defaultTaxRate = args.defaultTaxRate;
    if (args.vatRegistered !== undefined) updates.vatRegistered = args.vatRegistered;
    if (args.vatNumber !== undefined) updates.vatNumber = args.vatNumber;

    await ctx.db.patch(user.firmId, updates);
    return { success: true };
  },
});
