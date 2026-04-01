import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFirmIdSafe, requirePermission } from "./lib/permissions";
import type { Id } from "./_generated/dataModel";

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

// ─── Proposal Template Builder ─────────────────────────────────────────────

/**
 * Get all proposal template data for the builder.
 */
export const getProposalTemplateData = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return null;
    const firm = await ctx.db.get(firmId);
    if (!firm) return null;

    // Resolve logo URLs
    let logoUrl: string | null = firm.logoUrl ?? null;
    if (!logoUrl && firm.logo) logoUrl = await ctx.storage.getUrl(firm.logo);
    let coverImageUrl: string | null = null;
    if (firm.pdfCoverImage) coverImageUrl = await ctx.storage.getUrl(firm.pdfCoverImage);
    let lastPageImageUrl: string | null = null;
    if (firm.pdfLastPageImage) lastPageImageUrl = await ctx.storage.getUrl(firm.pdfLastPageImage);
    let footerImageUrl: string | null = null;
    if (firm.pdfFooterImage) footerImageUrl = await ctx.storage.getUrl(firm.pdfFooterImage);

    // Team members
    const users = await ctx.db.query("users").withIndex("by_firm", (q) => q.eq("firmId", firmId)).collect();
    const teamMembers = users
      .filter((u) => !u.deactivatedAt)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.jobTitle ?? "",
        bio: u.bio ?? "",
        phone: u.phone ?? "",
        avatar: u.avatar ?? "",
      }));

    return {
      firmName: firm.name,
      brandColors: firm.brandColors,
      headingsFont: firm.headingsFont ?? "",
      generalTextFont: firm.generalTextFont ?? "",
      logoUrl,
      coverImageUrl,
      lastPageImageUrl,
      footerImageUrl,
      // Template content
      coverQuote: firm.coverQuote ?? "",
      coverQuoteAuthor: firm.coverQuoteAuthor ?? "",
      closingQuote: firm.closingQuote ?? "",
      closingQuoteAuthor: firm.closingQuoteAuthor ?? "",
      aboutUsHtml: firm.aboutUsHtml ?? "",
      missionStatement: firm.missionStatement ?? "",
      whyChooseUsItems: firm.whyChooseUsItems ?? [],
      valuesStatement: firm.valuesStatement ?? "",
      website: firm.website ?? "",
      feesIntroductionText: firm.feesIntroductionText ?? "",
      whatHappensNextText: firm.whatHappensNextText ?? "",
      paymentTermsText: firm.paymentTermsText ?? "",
      defaultTimelineSteps: firm.defaultTimelineSteps ?? [],
      proposalBuilderDefaultIntro: firm.proposalBuilderDefaultIntro ?? "",
      // Footer / branding
      pdfFooterText: firm.pdfFooterText ?? "",
      pdfFooterAddress: firm.pdfFooterAddress ?? "",
      pdfDisclaimer: firm.pdfDisclaimer ?? "",
      pdfSignOffBlock: firm.pdfSignOffBlock ?? "",
      pdfBankingDetails: firm.pdfBankingDetails ?? "",
      // Section toggles
      proposalTemplateSections: firm.proposalTemplateSections ?? {},
      // Team
      teamMembers,
    };
  },
});

const templateSectionsValidator = v.optional(v.object({
  coverPage: v.optional(v.boolean()),
  introduction: v.optional(v.boolean()),
  aboutUs: v.optional(v.boolean()),
  team: v.optional(v.boolean()),
  fees: v.optional(v.boolean()),
  serviceSummary: v.optional(v.boolean()),
  timeline: v.optional(v.boolean()),
  allServices: v.optional(v.boolean()),
  nextSteps: v.optional(v.boolean()),
  closingPage: v.optional(v.boolean()),
}));

/**
 * Update proposal template settings.
 */
export const updateProposalTemplate = mutation({
  args: {
    userId: v.id("users"),
    coverQuote: v.optional(v.string()),
    coverQuoteAuthor: v.optional(v.string()),
    closingQuote: v.optional(v.string()),
    closingQuoteAuthor: v.optional(v.string()),
    aboutUsHtml: v.optional(v.string()),
    missionStatement: v.optional(v.string()),
    whyChooseUsItems: v.optional(v.array(v.string())),
    valuesStatement: v.optional(v.string()),
    website: v.optional(v.string()),
    feesIntroductionText: v.optional(v.string()),
    whatHappensNextText: v.optional(v.string()),
    paymentTermsText: v.optional(v.string()),
    defaultTimelineSteps: v.optional(v.array(v.object({
      marker: v.string(),
      title: v.string(),
      description: v.string(),
    }))),
    proposalBuilderDefaultIntro: v.optional(v.string()),
    pdfFooterText: v.optional(v.string()),
    pdfFooterAddress: v.optional(v.string()),
    pdfDisclaimer: v.optional(v.string()),
    pdfSignOffBlock: v.optional(v.string()),
    pdfBankingDetails: v.optional(v.string()),
    headingsFont: v.optional(v.string()),
    generalTextFont: v.optional(v.string()),
    brandColors: v.optional(v.object({ primary: v.string(), secondary: v.string() })),
    proposalTemplateSections: templateSectionsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageFirm");
    const { userId: _, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(user.firmId, updates);
    return { success: true };
  },
});

/**
 * Update a team member's proposal-visible fields (job title, bio, phone).
 */
export const updateTeamMember = mutation({
  args: {
    userId: v.id("users"),
    targetUserId: v.id("users"),
    jobTitle: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.userId, "canManageFirm");
    const target = await ctx.db.get(args.targetUserId);
    if (!target) return { success: false };
    const updates: Record<string, unknown> = {};
    if (args.jobTitle !== undefined) updates.jobTitle = args.jobTitle;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.phone !== undefined) updates.phone = args.phone;
    await ctx.db.patch(args.targetUserId, updates);
    return { success: true };
  },
});
