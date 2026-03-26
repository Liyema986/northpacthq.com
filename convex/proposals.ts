import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getUserFirmId, getUserFirmIdSafe, requirePermission } from "./lib/permissions";
import {
  replaceWorkPlanTasksForProposal,
  deleteWorkPlanTasksForProposal,
} from "./workPlanning";
import { paymentDefaultsForAccept } from "./lib/cashFlowDefaults";

/** Matches `schema.proposals.services` line shape (including work-planning fields). */
const proposalServiceLine = v.object({
  serviceId: v.id("services"),
  serviceName: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  subtotal: v.number(),
  description: v.optional(v.string()),
  estimatedHours: v.optional(v.number()),
  scheduledMonth: v.optional(v.string()),
  workPlanEntityLabels: v.optional(v.array(v.string())),
  billingCategory: v.optional(v.string()),
  frequency: v.optional(v.string()),
});

/**
 * Generate upload URL for proposal PDF (client uploads blob, then calls setProposalPdfUrl).
 */
export const generatePdfUploadUrl = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.userId, "canCreateProposals");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Store proposal PDF storage id after client upload (so email can attach it).
 */
export const setProposalPdfUrl = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== user.firmId) {
      return { success: false, error: "Proposal not found" };
    }
    await ctx.db.patch(args.proposalId, {
      pdfUrl: args.storageId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * List all proposals for the user's firm.
 */
export const listProposals = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
  },
  returns: v.array(
    v.object({
      _id: v.id("proposals"),
      proposalNumber: v.string(),
      title: v.string(),
      clientId: v.id("clients"),
      clientName: v.string(),
      status: v.string(),
      total: v.number(),
      currency: v.string(),
      createdAt: v.number(),
      validUntil: v.optional(v.number()),
      // Extended fields for list views
      sentAt: v.optional(v.number()),
      viewedAt: v.optional(v.number()),
      acceptedAt: v.optional(v.number()),
      netMonthlyFee: v.optional(v.number()),
      oneOffFee: v.optional(v.number()),
      startMonth: v.optional(v.string()),
      createdByName: v.optional(v.string()),
      paymentSchedule: v.optional(
        v.union(v.literal("monthly"), v.literal("on_completion"), v.literal("blended"))
      ),
      cashFlowStartMonth: v.optional(v.string()),
      oneOffCashMonth: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("listProposals: User not found, returning empty array");
      return [];
    }

    let proposalsQuery = ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId));

    const proposals = await proposalsQuery.collect();

    // Filter by status if provided
    let filtered = args.status
      ? proposals.filter((p) => p.status === args.status)
      : proposals;

    // Filter by clientId if provided (e.g. Contact detail proposals for one client)
    if (args.clientId) {
      filtered = filtered.filter((p) => p.clientId === args.clientId);
    }

    // Get client names and creator names
    const proposalsWithClients = await Promise.all(
      filtered.map(async (proposal) => {
        const client = await ctx.db.get(proposal.clientId);
        const createdByUser = proposal.createdBy
          ? await ctx.db.get(proposal.createdBy)
          : null;
        return {
          _id: proposal._id,
          proposalNumber: proposal.proposalNumber,
          title: proposal.title,
          clientId: proposal.clientId,
          clientName: client?.companyName || "Unknown Client",
          status: proposal.status,
          total: proposal.total,
          currency: proposal.currency,
          createdAt: proposal.createdAt,
          validUntil: proposal.validUntil,
          sentAt: proposal.sentAt,
          viewedAt: proposal.viewedAt,
          acceptedAt: proposal.acceptedAt,
          netMonthlyFee: proposal.netMonthlyFee,
          oneOffFee: proposal.oneOffFee,
          startMonth: proposal.startMonth,
          createdByName: createdByUser?.name,
          paymentSchedule: proposal.paymentSchedule,
          cashFlowStartMonth: proposal.cashFlowStartMonth,
          oneOffCashMonth: proposal.oneOffCashMonth,
        };
      })
    );

    const byId = new Map<string, (typeof proposalsWithClients)[number]>();
    for (const row of proposalsWithClients) {
      if (!byId.has(row._id)) byId.set(row._id, row);
    }
    return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get a single proposal with full details.
 */
export const getProposal = query({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("getProposal: User not found, returning null");
      return null;
    }

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== firmId) {
      return null;
    }

    const client = await ctx.db.get(proposal.clientId);
    const createdByUser = proposal.createdBy
      ? await ctx.db.get(proposal.createdBy)
      : null;

    return {
      ...proposal,
      client: client
        ? {
            _id: client._id,
            companyName: client.companyName,
            contactName: client.contactName,
            email: client.email,
            annualRevenue: client.annualRevenue,
          }
        : null,
      createdByUser: createdByUser
        ? {
            name: createdByUser.name,
            email: createdByUser.email,
            role: createdByUser.role,
          }
        : null,
    };
  },
});

/**
 * Get sections that have services in this proposal (for pricing adjustment section dropdown).
 */
export const getProposalSections = query({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  returns: v.array(
    v.object({
      id: v.id("serviceSections"),
      name: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return [];

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== firmId) return [];

    const sectionIds = new Set<Id<"serviceSections">>();
    for (const s of proposal.services ?? []) {
      const svc = await ctx.db.get(s.serviceId);
      if (svc?.sectionId) sectionIds.add(svc.sectionId);
    }

    const sections: { id: Id<"serviceSections">; name: string }[] = [];
    for (const sid of sectionIds) {
      const section = await ctx.db.get(sid);
      if (section) sections.push({ id: section._id, name: section.name });
    }
    sections.sort((a, b) => a.name.localeCompare(b.name));
    return sections;
  },
});

/**
 * Create a new proposal.
 */
const entityValidator = v.object({
  id: v.number(),
  name: v.string(),
  type: v.string(),
  revenueRange: v.string(),
  incomeTaxRange: v.string(),
});

export const createProposal = mutation({
  args: {
    userId: v.id("users"),
    clientId: v.id("clients"),
    title: v.string(),
    services: v.array(proposalServiceLine),
    introText: v.optional(v.string()),
    termsText: v.optional(v.string()),
    validUntil: v.optional(v.number()),
    packageTemplate: v.optional(v.string()),
    entities: v.optional(v.array(entityValidator)),
    template: v.optional(v.string()),
    documentType: v.optional(v.string()),
    startMonth: v.optional(v.string()),
    startYear: v.optional(v.string()),
    financialYearEndMonth: v.optional(v.string()),
    financialYearEndYear: v.optional(v.string()),
    addProjectName: v.optional(v.boolean()),
    projectName: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    proposalId: v.optional(v.id("proposals")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user has permission
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");

    const firm = await ctx.db.get(user.firmId);
    if (!firm) {
      return { success: false, error: "Firm not found" };
    }

    // Verify client belongs to firm
    const client = await ctx.db.get(args.clientId);
    if (!client || client.firmId !== user.firmId) {
      return { success: false, error: "Client not found" };
    }

    // Calculate totals
    const subtotal = args.services.reduce((sum, s) => sum + s.subtotal, 0);
    const total = subtotal; // Can add tax/discount later

    // Generate proposal number (use firm prefix from Settings > Proposals)
    const prefix = (firm.proposalNumberPrefix ?? "PROP").replace(/[^A-Za-z0-9-]/g, "") || "PROP";
    const count = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const proposalNumber = `${prefix}-${new Date().getFullYear()}-${String(count.length + 1).padStart(3, "0")}`;

    const defaultValidityDays = firm.defaultProposalValidityDays ?? 30;
    const validUntil =
      args.validUntil ??
      now + defaultValidityDays * 24 * 60 * 60 * 1000;

    const proposalId = await ctx.db.insert("proposals", {
      firmId: user.firmId,
      clientId: args.clientId,
      proposalNumber,
      title: args.title,
      status: "draft",
      services: args.services,
      subtotal,
      total,
      currency: firm.currency ?? "ZAR",
      introText: args.introText,
      termsText: args.termsText,
      validUntil,
      packageTemplate: args.packageTemplate,
      entities: args.entities,
      template: args.template,
      documentType: args.documentType,
      startMonth: args.startMonth,
      startYear: args.startYear,
      financialYearEndMonth: args.financialYearEndMonth,
      financialYearEndYear: args.financialYearEndYear,
      addProjectName: args.addProjectName,
      projectName: args.projectName,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await replaceWorkPlanTasksForProposal(ctx, proposalId);

    return { success: true, proposalId };
  },
});

/**
 * Update an existing proposal.
 */
export const updateProposal = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    title: v.optional(v.string()),
    services: v.optional(v.array(proposalServiceLine)),
    introText: v.optional(v.string()),
    termsText: v.optional(v.string()),
    validUntil: v.optional(v.number()),
    status: v.optional(v.string()),
    paymentSchedule: v.optional(
      v.union(v.literal("monthly"), v.literal("on_completion"), v.literal("blended"))
    ),
    cashFlowStartMonth: v.optional(v.string()),
    oneOffCashMonth: v.optional(v.string()),
    paymentNotes: v.optional(v.string()),
    entities: v.optional(v.array(entityValidator)),
    packageTemplate: v.optional(v.string()),
    template: v.optional(v.string()),
    documentType: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    financialYearEndMonth: v.optional(v.string()),
    financialYearEndYear: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user has permission
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");

    // Get proposal and verify access
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== user.firmId) {
      return { success: false, error: "Proposal not found" };
    }

    // Build update object
    const updates: any = { updatedAt: now };

    if (args.title !== undefined) updates.title = args.title;
    if (args.introText !== undefined) updates.introText = args.introText;
    if (args.termsText !== undefined) updates.termsText = args.termsText;
    if (args.validUntil !== undefined) updates.validUntil = args.validUntil;
    if (args.status !== undefined) updates.status = args.status;
    if (args.paymentSchedule !== undefined) updates.paymentSchedule = args.paymentSchedule;
    if (args.cashFlowStartMonth !== undefined) updates.cashFlowStartMonth = args.cashFlowStartMonth;
    if (args.oneOffCashMonth !== undefined) updates.oneOffCashMonth = args.oneOffCashMonth;
    if (args.paymentNotes !== undefined) updates.paymentNotes = args.paymentNotes;
    if (args.financialYearEndMonth !== undefined) updates.financialYearEndMonth = args.financialYearEndMonth;
    if (args.financialYearEndYear !== undefined) updates.financialYearEndYear = args.financialYearEndYear;

    if (args.entities !== undefined) updates.entities = args.entities;
    if (args.packageTemplate !== undefined) updates.packageTemplate = args.packageTemplate;
    if (args.template !== undefined) updates.template = args.template;
    if (args.documentType !== undefined) updates.documentType = args.documentType;

    if (args.clientId !== undefined) {
      const client = await ctx.db.get(args.clientId);
      if (!client || client.firmId !== user.firmId) {
        return { success: false, error: "Client not found" };
      }
      updates.clientId = args.clientId;
    }

    if (args.status === "accepted" && proposal.status !== "accepted") {
      updates.acceptedAt = now;
      Object.assign(
        updates,
        paymentDefaultsForAccept(
          {
            paymentSchedule: args.paymentSchedule ?? proposal.paymentSchedule,
            cashFlowStartMonth: args.cashFlowStartMonth ?? proposal.cashFlowStartMonth,
            oneOffCashMonth: args.oneOffCashMonth ?? proposal.oneOffCashMonth,
          },
          now
        )
      );
    }

    if (args.services !== undefined) {
      updates.services = args.services;
      const subtotal = args.services.reduce((sum, s) => sum + s.subtotal, 0);
      updates.subtotal = subtotal;
      updates.total = subtotal;
    }

    await ctx.db.patch(args.proposalId, updates);

    if (args.services !== undefined) {
      await replaceWorkPlanTasksForProposal(ctx, args.proposalId);
    }

    return { success: true };
  },
});

/**
 * Send proposal to client.
 */
export const sendProposal = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user has permission
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");

    // Get proposal and verify access
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== user.firmId) {
      return { success: false, error: "Proposal not found" };
    }

    // Enforce approval requirement
    const firm = await ctx.db.get(user.firmId);
    if (firm?.requireApprovalBeforeSend && proposal.status !== "approved") {
      return {
        success: false,
        error: "This proposal requires internal approval before it can be sent.",
      };
    }

    // Marks proposal as sent without emailing. Prefer api.email.sendProposalEmail from the app
    // so Resend delivers the message and status is updated after success.
    await ctx.db.patch(args.proposalId, {
      status: "sent",
      sentAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Delete a proposal.
 */
export const deleteProposal = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Requires delete permission
    const user = await requirePermission(ctx, args.userId, "canDeleteRecords");

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== user.firmId) {
      return { success: false, error: "Proposal not found" };
    }

    await deleteWorkPlanTasksForProposal(ctx, args.proposalId);
    await ctx.db.delete(args.proposalId);

    return { success: true };
  },
});

/**
 * Duplicate a proposal (create a copy as a new draft).
 */
export const duplicateProposal = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    newProposalId: v.optional(v.id("proposals")),
  }),
  handler: async (ctx, args) => {
    // Requires create permission
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");

    const originalProposal = await ctx.db.get(args.proposalId);
    if (!originalProposal || originalProposal.firmId !== user.firmId) {
      return { success: false, error: "Proposal not found" };
    }

    const firm = await ctx.db.get(user.firmId);
    const prefix = (firm?.proposalNumberPrefix ?? "PROP").replace(/[^A-Za-z0-9-]/g, "") || "PROP";
    const defaultValidityDays = firm?.defaultProposalValidityDays ?? 30;

    const existingProposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const nextNumber = existingProposals.length + 1;
    const proposalNumber = `${prefix}-${new Date().getFullYear()}-${String(nextNumber).padStart(3, "0")}`;

    const now = Date.now();
    const validUntil = now + defaultValidityDays * 24 * 60 * 60 * 1000;

    const newProposalId = await ctx.db.insert("proposals", {
      firmId: user.firmId,
      clientId: originalProposal.clientId,
      proposalNumber,
      title: `${originalProposal.title} (Copy)`,
      status: "draft",
      currency: originalProposal.currency,
      subtotal: originalProposal.subtotal,
      total: originalProposal.total,
      services: originalProposal.services,
      discount: originalProposal.discount,
      tax: originalProposal.tax,
      netMonthlyFee: originalProposal.netMonthlyFee,
      grossMonthlyFee: originalProposal.grossMonthlyFee,
      oneOffFee: originalProposal.oneOffFee,
      oneOffTax: originalProposal.oneOffTax,
      grossOneOffFee: originalProposal.grossOneOffFee,
      monthlyTax: originalProposal.monthlyTax,
      introText: originalProposal.introText,
      termsText: originalProposal.termsText,
      validUntil,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await replaceWorkPlanTasksForProposal(ctx, newProposalId);

    return { success: true, newProposalId };
  },
});

/**
 * Update proposal pricing for a new year (same client, adjusted prices).
 * Creates a new draft proposal with:
 * - Optional adjustment (increase/decrease, percentage/cost)
 * - Optional section scope (all services or specific section)
 * - Updated startYear / financialYearEndYear to target year
 */
export const updateProposalPricing = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    targetYear: v.string(),
    adjustmentType: v.optional(v.union(v.literal("increase"), v.literal("decrease"))),
    adjustmentMethod: v.optional(v.union(v.literal("percentage"), v.literal("cost"))),
    amount: v.optional(v.number()),
    sectionId: v.optional(v.id("serviceSections")),
    sectionName: v.optional(v.string()),
    // Legacy: adjustmentPercent = percentage increase; when used, type=increase, method=percentage
    adjustmentPercent: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    newProposalId: v.optional(v.id("proposals")),
  }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");

    const originalProposal = await ctx.db.get(args.proposalId);
    if (!originalProposal || originalProposal.firmId !== user.firmId) {
      return { success: false, error: "Proposal not found" };
    }

    const useLegacy = args.adjustmentPercent != null && args.adjustmentType == null;
    const effectiveAmount = useLegacy ? args.adjustmentPercent! : (args.amount ?? 0);
    if (effectiveAmount < 0) {
      return { success: false, error: "Amount cannot be negative" };
    }

    const firm = await ctx.db.get(user.firmId);
    const prefix = (firm?.proposalNumberPrefix ?? "PROP").replace(/[^A-Za-z0-9-]/g, "") || "PROP";
    const defaultValidityDays = firm?.defaultProposalValidityDays ?? 30;

    const existingProposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const nextNumber = existingProposals.length + 1;
    const proposalNumber = `${prefix}-${args.targetYear}-${String(nextNumber).padStart(3, "0")}`;

    // Support legacy adjustmentPercent (percentage increase only)
    const isLegacy = args.adjustmentPercent != null && args.adjustmentType == null;
    const type = isLegacy ? ("increase" as const) : (args.adjustmentType ?? "increase");
    const method = isLegacy ? ("percentage" as const) : (args.adjustmentMethod ?? "percentage");
    const amount = isLegacy ? args.adjustmentPercent! : (args.amount ?? 0);

    // Build section filter: which serviceIds belong to the selected section
    let sectionServiceIds: Set<string> | null = null;
    if (args.sectionId) {
      sectionServiceIds = new Set<string>();
      const sectionServices = await ctx.db
        .query("services")
        .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId!))
        .collect();
      for (const s of sectionServices) sectionServiceIds.add(s._id);
    }

    const applyAdjustment = (price: number, qty: number): { unitPrice: number; subtotal: number } => {
      if (amount <= 0) return { unitPrice: price, subtotal: price * qty };
      let newUnitPrice: number;
      if (method === "percentage") {
        const mult = type === "increase" ? 1 + amount / 100 : Math.max(0, 1 - amount / 100);
        newUnitPrice = Math.round(price * mult * 100) / 100;
      } else {
        newUnitPrice = type === "increase"
          ? Math.round((price + amount) * 100) / 100
          : Math.round(Math.max(0, price - amount) * 100) / 100;
      }
      const newSubtotal = Math.round(newUnitPrice * qty * 100) / 100;
      return { unitPrice: newUnitPrice, subtotal: newSubtotal };
    };

    const adjustedServices = (originalProposal.services ?? []).map((s) => {
      const inScope = !sectionServiceIds || sectionServiceIds.has(s.serviceId);
      if (!inScope) return s;

      const { unitPrice: newUnitPrice, subtotal: newSubtotal } = applyAdjustment(s.unitPrice, s.quantity);
      return { ...s, unitPrice: newUnitPrice, subtotal: newSubtotal };
    });

    const newSubtotal = adjustedServices.reduce((sum, s) => sum + s.subtotal, 0);

    // For "all" scope, adjust fees too; for "section" scope, fees stay as-is (total from services)
    const isGlobalScope = !sectionServiceIds || sectionServiceIds.size === 0;
    let finalNetMonthly = originalProposal.netMonthlyFee;
    let finalGrossMonthly = originalProposal.grossMonthlyFee;
    let finalOneOff = originalProposal.oneOffFee;
    let finalGrossOneOff = originalProposal.grossOneOffFee;
    if (isGlobalScope && amount > 0) {
      if (originalProposal.netMonthlyFee != null) {
        const { subtotal } = applyAdjustment(originalProposal.netMonthlyFee, 1);
        finalNetMonthly = subtotal;
      }
      if (originalProposal.grossMonthlyFee != null) {
        const { subtotal } = applyAdjustment(originalProposal.grossMonthlyFee, 1);
        finalGrossMonthly = subtotal;
      }
      if (originalProposal.oneOffFee != null) {
        const { subtotal } = applyAdjustment(originalProposal.oneOffFee, 1);
        finalOneOff = subtotal;
      }
      if (originalProposal.grossOneOffFee != null) {
        const { subtotal } = applyAdjustment(originalProposal.grossOneOffFee, 1);
        finalGrossOneOff = subtotal;
      }
    }

    const newTotal = newSubtotal > 0
      ? newSubtotal
      : (finalGrossMonthly ?? finalGrossOneOff ?? originalProposal.total);

    const now = Date.now();
    const validUntil = now + defaultValidityDays * 24 * 60 * 60 * 1000;

    const cleanTitle = originalProposal.title
      .replace(/\s*\(Copy\)\s*$/i, "")
      .replace(/\s*\(\d{4}\s*Pricing\)\s*$/i, "")
      .trim();

    const pricingAdjustment = amount > 0 ? {
      type,
      method,
      amount,
      scope: args.sectionId ? ("section" as const) : ("all" as const),
      sectionId: args.sectionId,
      sectionName: args.sectionName,
      targetYear: args.targetYear,
    } : undefined;

    const newProposalId = await ctx.db.insert("proposals", {
      firmId: user.firmId,
      clientId: originalProposal.clientId,
      proposalNumber,
      title: cleanTitle,
      status: "draft",
      currency: originalProposal.currency,
      services: adjustedServices,
      subtotal: newSubtotal,
      total: newTotal,
      discount: originalProposal.discount,
      tax: originalProposal.tax,
      netMonthlyFee: finalNetMonthly,
      grossMonthlyFee: finalGrossMonthly,
      oneOffFee: finalOneOff,
      oneOffTax: originalProposal.oneOffTax,
      grossOneOffFee: finalGrossOneOff,
      monthlyTax: originalProposal.monthlyTax,
      introText: originalProposal.introText,
      termsText: originalProposal.termsText,
      validUntil,
      packageTemplate: originalProposal.packageTemplate,
      entities: originalProposal.entities,
      template: originalProposal.template,
      documentType: originalProposal.documentType,
      startMonth: originalProposal.startMonth,
      startYear: args.targetYear,
      financialYearEndMonth: originalProposal.financialYearEndMonth,
      financialYearEndYear: args.targetYear,
      addProjectName: originalProposal.addProjectName,
      projectName: originalProposal.projectName,
      appsMapData: originalProposal.appsMapData,
      sourceProposalId: args.proposalId,
      pricingAdjustment,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await replaceWorkPlanTasksForProposal(ctx, newProposalId);

    return { success: true, newProposalId };
  },
});

/**
 * Mark a proposal as won or lost (with proper authorization).
 */
export const markProposalStatus = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Requires approval permission to mark proposals as won/lost
    const user = await requirePermission(ctx, args.userId, "canApproveProposals");

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== user.firmId) {
      return { success: false, error: "Proposal not found" };
    }

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
      approvedBy: args.status === "accepted" ? args.userId : undefined,
    };

    if (args.status === "accepted" && proposal.status !== "accepted") {
      patch.acceptedAt = now;
      Object.assign(
        patch,
        paymentDefaultsForAccept(
          {
            paymentSchedule: proposal.paymentSchedule,
            cashFlowStartMonth: proposal.cashFlowStartMonth,
            oneOffCashMonth: proposal.oneOffCashMonth,
          },
          now
        )
      );
    }

    await ctx.db.patch(args.proposalId, patch);

    return { success: true };
  },
});

/**
 * Get PDF download URL for a proposal.
 */
export const getProposalPdfUrl = query({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return null;

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== firmId) {
      return null;
    }

    if (!proposal.pdfUrl) {
      return null;
    }

    // Get the storage URL
    const url = await ctx.storage.getUrl(proposal.pdfUrl);
    return url;
  },
});

/**
 * Update proposal status (internal mutation for email actions)
 */
export const updateProposalStatus = mutation({
  args: {
    proposalId: v.id("proposals"),
    status: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
    emailId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.status) updates.status = args.status;
    if (args.sentAt) updates.sentAt = args.sentAt;
    if (args.viewedAt) updates.viewedAt = args.viewedAt;

    await ctx.db.patch(args.proposalId, updates);

    return { success: true };
  },
});

/**
 * Get proposal for email (internal query)
 */
export const getProposalForEmail = query({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) return null;

    const client = await ctx.db.get(proposal.clientId);
    
    return {
      ...proposal,
      clientName: client?.companyName || "Client",
      clientEmail: client?.email || "",
    };
  },
});

/**
 * Get version history for a proposal
 */
export const getProposalVersions = query({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  returns: v.array(
    v.object({
      _id: v.id("proposalVersions"),
      proposalNumber: v.string(),
      versionNumber: v.string(),
      clientName: v.string(),
      status: v.string(),
      total: v.number(),
      currency: v.string(),
      createdByName: v.union(v.string(), v.null()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("getProposalVersions: User not found, returning empty array");
      return [];
    }

    // Verify the proposal belongs to the firm
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== firmId) {
      return [];
    }

    // Get all versions for this proposal
    const versions = await ctx.db
      .query("proposalVersions")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .collect();

    return versions
      .map((v) => ({
        _id: v._id,
        proposalNumber: v.proposalNumber,
        versionNumber: v.versionNumber,
        clientName: v.clientName,
        status: v.status,
        total: v.total,
        currency: v.currency,
        createdByName: v.createdByName ?? null,
        createdAt: v.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt); // Newest first
  },
});

/**
 * List all proposals with their version counts for the user's firm.
 * Includes: monthly fee, creator name, principal in charge, signature status
 */
export const listProposalsWithVersions = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("proposals"),
      proposalNumber: v.string(),
      title: v.string(),
      clientId: v.id("clients"),
      clientName: v.string(),
      status: v.string(),
      total: v.number(),
      currency: v.string(),
      createdAt: v.number(),
      validUntil: v.optional(v.number()),
      versionCount: v.number(),
      // Production-ready fields
      monthlyFee: v.optional(v.number()),
      createdByName: v.optional(v.string()),
      principalInCharge: v.optional(v.string()),
      signatureStatus: v.string(), // "not_required", "pending", "signed"
      signatureImage: v.optional(v.string()), // Base64 image when signed
      signerName: v.optional(v.string()),
      documentType: v.optional(v.string()),
      createdById: v.optional(v.id("users")),
      approvedById: v.optional(v.id("users")),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    // If user doesn't exist, return empty array instead of throwing
    if (!firmId) {
      console.warn("listProposalsWithVersions: User not found, returning empty array");
      return [];
    }

    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    // Filter by status if provided
    const filtered = args.status
      ? proposals.filter((p) => p.status === args.status)
      : proposals;

    // Helper to get user name
    const getUserName = async (userId: typeof proposals[0]["createdBy"] | undefined): Promise<string | undefined> => {
      if (!userId) return undefined;
      const user = await ctx.db.get(userId);
      return user?.name;
    };

    // Helper to get signature status and data for a proposal
    const getSignatureInfo = async (
      proposalId: typeof proposals[0]["_id"],
      proposal: (typeof proposals)[0]
    ): Promise<{ status: string; signatureImage?: string; signerName?: string }> => {
      const engagementLetter = await ctx.db
        .query("engagementLetters")
        .withIndex("by_proposal", (q) => q.eq("proposalId", proposalId))
        .first();

      if (!engagementLetter) {
        return {
          status: "not_required",
          signatureImage: proposal.signatureData?.signatureImage,
          signerName: proposal.signatureData?.signerName,
        };
      }
      if (engagementLetter.status === "signed") {
        return {
          status: "signed",
          signatureImage: engagementLetter.signatureData?.signatureImage ?? proposal.signatureData?.signatureImage,
          signerName: engagementLetter.signatureData?.signerName ?? proposal.signatureData?.signerName,
        };
      }
      return { status: "pending" };
    };

    // Get client names, version counts, and additional metadata
    const proposalsWithData = await Promise.all(
      filtered.map(async (proposal) => {
        const client = await ctx.db.get(proposal.clientId);

        // Count versions for this proposal
        const versions = await ctx.db
          .query("proposalVersions")
          .withIndex("by_proposal", (q) => q.eq("proposalId", proposal._id))
          .collect();

        // Get creator and approver names
        const createdByName = await getUserName(proposal.createdBy);
        const principalInCharge = await getUserName(proposal.approvedBy);
        const sig = await getSignatureInfo(proposal._id, proposal);

        return {
          _id: proposal._id,
          proposalNumber: proposal.proposalNumber,
          title: proposal.title,
          clientId: proposal.clientId,
          clientName: client?.companyName || "Unknown Client",
          status: proposal.status,
          total: proposal.total,
          currency: proposal.currency,
          createdAt: proposal.createdAt,
          validUntil: proposal.validUntil,
          versionCount: versions.length,
          // Production-ready fields
          monthlyFee: proposal.grossMonthlyFee ?? proposal.netMonthlyFee,
          createdByName,
          principalInCharge,
          signatureStatus: sig.status,
          signatureImage: sig.signatureImage,
          signerName: sig.signerName,
          documentType: proposal.documentType,
          createdById: proposal.createdBy,
          approvedById: proposal.approvedBy,
        };
      })
    );

    return proposalsWithData.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * List proposals grouped by client, showing the latest proposal per client
 * with all other proposals available as history.
 * Includes: monthly fee, creator name, principal in charge, signature status
 */
export const listProposalsGroupedByClient = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      clientId: v.id("clients"),
      clientName: v.string(),
      clientEmail: v.optional(v.string()),
      totalProposals: v.number(),
      latestProposal: v.object({
        _id: v.id("proposals"),
        proposalNumber: v.string(),
        title: v.string(),
        status: v.string(),
        total: v.number(),
        currency: v.string(),
        createdAt: v.number(),
        validUntil: v.optional(v.number()),
        versionCount: v.number(),
        // Production-ready fields
        monthlyFee: v.optional(v.number()),
        createdByName: v.optional(v.string()),
        principalInCharge: v.optional(v.string()),
        signatureStatus: v.string(), // "not_required", "pending", "signed"
        signatureImage: v.optional(v.string()),
        signerName: v.optional(v.string()),
        documentType: v.optional(v.string()),
        createdById: v.optional(v.id("users")),
        approvedById: v.optional(v.id("users")),
      }),
      proposalHistory: v.array(
        v.object({
          _id: v.id("proposals"),
          proposalNumber: v.string(),
          title: v.string(),
          status: v.string(),
          total: v.number(),
          currency: v.string(),
          createdAt: v.number(),
          validUntil: v.optional(v.number()),
          versionCount: v.number(),
          monthlyFee: v.optional(v.number()),
          createdByName: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    // If user doesn't exist, return empty array instead of throwing
    if (!firmId) {
      console.warn("listProposalsGroupedByClient: User not found, returning empty array");
      return [];
    }

    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    // Filter by status if provided
    const filtered = args.status
      ? proposals.filter((p) => p.status === args.status)
      : proposals;

    // Group proposals by clientId
    const clientProposalsMap = new Map<string, typeof filtered>();
    for (const proposal of filtered) {
      const clientIdStr = proposal.clientId.toString();
      if (!clientProposalsMap.has(clientIdStr)) {
        clientProposalsMap.set(clientIdStr, []);
      }
      clientProposalsMap.get(clientIdStr)!.push(proposal);
    }

    // Helper to get version count
    const getVersionCount = async (proposalId: typeof proposals[0]["_id"]) => {
      const versions = await ctx.db
        .query("proposalVersions")
        .withIndex("by_proposal", (q) => q.eq("proposalId", proposalId))
        .collect();
      return versions.length;
    };

    // Helper to get signature status and data for a proposal
    const getSignatureInfo = async (
      proposalId: typeof proposals[0]["_id"],
      proposal: (typeof proposals)[0]
    ): Promise<{ status: string; signatureImage?: string; signerName?: string }> => {
      const engagementLetter = await ctx.db
        .query("engagementLetters")
        .withIndex("by_proposal", (q) => q.eq("proposalId", proposalId))
        .first();

      if (!engagementLetter) {
        return {
          status: "not_required",
          signatureImage: proposal.signatureData?.signatureImage,
          signerName: proposal.signatureData?.signerName,
        };
      }
      if (engagementLetter.status === "signed") {
        return {
          status: "signed",
          signatureImage: engagementLetter.signatureData?.signatureImage ?? proposal.signatureData?.signatureImage,
          signerName: engagementLetter.signatureData?.signerName ?? proposal.signatureData?.signerName,
        };
      }
      return { status: "pending" };
    };

    // Helper to get user name
    const getUserName = async (userId: typeof proposals[0]["createdBy"] | undefined): Promise<string | undefined> => {
      if (!userId) return undefined;
      const user = await ctx.db.get(userId);
      return user?.name;
    };

    // Build grouped results
    const groupedResults = await Promise.all(
      Array.from(clientProposalsMap.entries()).map(async ([_, clientProposals]) => {
        // Sort proposals by createdAt (newest first)
        const sortedProposals = clientProposals.sort((a, b) => b.createdAt - a.createdAt);
        const latestProposal = sortedProposals[0];
        const historyProposals = sortedProposals.slice(1);

        // Get client info
        const client = await ctx.db.get(latestProposal.clientId);

        // Get creator and approver names for latest proposal
        const createdByName = await getUserName(latestProposal.createdBy);
        const principalInCharge = await getUserName(latestProposal.approvedBy);
        const sig = await getSignatureInfo(latestProposal._id, latestProposal);
        const latestVersionCount = await getVersionCount(latestProposal._id);

        const historyWithVersions = await Promise.all(
          historyProposals.map(async (proposal) => ({
            _id: proposal._id,
            proposalNumber: proposal.proposalNumber,
            title: proposal.title,
            status: proposal.status,
            total: proposal.total,
            currency: proposal.currency,
            createdAt: proposal.createdAt,
            validUntil: proposal.validUntil,
            versionCount: await getVersionCount(proposal._id),
            monthlyFee: proposal.grossMonthlyFee ?? proposal.netMonthlyFee,
            createdByName: await getUserName(proposal.createdBy),
          }))
        );

        return {
          clientId: latestProposal.clientId,
          clientName: client?.companyName || "Unknown Client",
          clientEmail: client?.email,
          totalProposals: sortedProposals.length,
          latestProposal: {
            _id: latestProposal._id,
            proposalNumber: latestProposal.proposalNumber,
            title: latestProposal.title,
            status: latestProposal.status,
            total: latestProposal.total,
            currency: latestProposal.currency,
            createdAt: latestProposal.createdAt,
            validUntil: latestProposal.validUntil,
            versionCount: latestVersionCount,
            monthlyFee: latestProposal.grossMonthlyFee ?? latestProposal.netMonthlyFee,
            createdByName,
            principalInCharge,
            signatureStatus: sig.status,
            signatureImage: sig.signatureImage,
            signerName: sig.signerName,
            documentType: latestProposal.documentType,
            createdById: latestProposal.createdBy,
            approvedById: latestProposal.approvedBy,
          },
          proposalHistory: historyWithVersions,
        };
      })
    );

    // Sort by latest proposal's createdAt (newest first)
    return groupedResults.sort(
      (a, b) => b.latestProposal.createdAt - a.latestProposal.createdAt
    );
  },
});

/**
 * Delete a proposal version
 */
export const deleteProposalVersion = mutation({
  args: {
    userId: v.id("users"),
    versionId: v.id("proposalVersions"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Requires delete permission
    const user = await requirePermission(ctx, args.userId, "canDeleteRecords");

    const version = await ctx.db.get(args.versionId);
    if (!version || version.firmId !== user.firmId) {
      return { success: false, error: "Version not found" };
    }

    await ctx.db.delete(args.versionId);

    return { success: true };
  },
});
