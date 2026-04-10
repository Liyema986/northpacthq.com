// convex/proposalAccept.ts - Public proposal view and accept/reject
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { paymentDefaultsForAccept } from "./lib/cashFlowDefaults";

/**
 * Get proposal accept session by token (public - no auth required)
 */
export const getProposalAcceptSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("proposalAcceptSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      return { error: "Link not found" };
    }

    if (session.status !== "pending") {
      const proposal = await ctx.db.get(session.proposalId);
      const firm = proposal ? await ctx.db.get(session.firmId) : null;
      const client = proposal ? await ctx.db.get(proposal.clientId) : null;

      let firmLogoUrl: string | null = null;
      if (firm) {
        const logoStorageId =
          firm.useDifferentLogoProposalHeader && firm.logoProposalHeader
            ? firm.logoProposalHeader
            : firm.logo;
        if (logoStorageId) {
          firmLogoUrl = await ctx.storage.getUrl(logoStorageId);
        }
      }

      return {
        resolvedStatus: session.status as "accepted" | "rejected",
        firmName: firm?.name || "Your firm",
        proposalTitle: proposal?.title || "Proposal",
        proposalNumber: proposal?.proposalNumber || "",
        signerName: session.signerName ?? undefined,
        acceptedAt: session.acceptedAt ?? session.rejectedAt ?? undefined,
        firmLogoUrl,
        clientEmail: client?.email ?? undefined,
      };
    }

    if (Date.now() > session.expiresAt) {
      return { error: "This link has expired" };
    }

    const proposal = await ctx.db.get(session.proposalId);
    if (!proposal) {
      return { error: "Proposal not found" };
    }

    const firm = await ctx.db.get(session.firmId);
    const client = await ctx.db.get(proposal.clientId);

    // Get PDF URL for client viewing (if proposal has generated PDF)
    let pdfStorageUrl: string | null = null;
    if (proposal.pdfUrl) {
      pdfStorageUrl = await ctx.storage.getUrl(proposal.pdfUrl);
    }

    // Firm assets for PDF preview (shared contract – used across all PDFs)
    let firmLogoUrl: string | null = null;
    let pdfCoverImageUrl: string | null = null;
    let pdfFooterImageUrl: string | null = null;
    let pdfLastPageImageUrl: string | null = null;
    if (firm) {
      const logoStorageId =
        firm.useDifferentLogoProposalHeader && firm.logoProposalHeader
          ? firm.logoProposalHeader
          : firm.logo;
      if (logoStorageId) {
        firmLogoUrl = await ctx.storage.getUrl(logoStorageId);
      }
      if (firm.pdfCoverImage) {
        pdfCoverImageUrl = await ctx.storage.getUrl(firm.pdfCoverImage);
      }
      if (firm.pdfFooterImage) {
        pdfFooterImageUrl = await ctx.storage.getUrl(firm.pdfFooterImage);
      }
      if (firm.pdfLastPageImage) {
        pdfLastPageImageUrl = await ctx.storage.getUrl(firm.pdfLastPageImage);
      }
    }

    // ── Advisor (proposal creator) ──
    const advisor = await ctx.db.get(proposal.createdBy);

    // ── Team members ──
    const teamMemberIds = proposal.teamMemberIds ?? [];
    const teamMembers: { name: string; role?: string; bio?: string; avatarUrl?: string }[] = [];
    for (const uid of teamMemberIds) {
      const u = await ctx.db.get(uid);
      if (u && !u.deactivatedAt) {
        teamMembers.push({
          name: u.name,
          role: u.jobTitle ?? undefined,
          bio: u.bio ?? undefined,
          avatarUrl: u.avatar ?? undefined,
        });
      }
    }
    // If no team assigned, include the advisor as fallback
    if (teamMembers.length === 0 && advisor) {
      teamMembers.push({
        name: advisor.name,
        role: advisor.jobTitle ?? undefined,
        bio: advisor.bio ?? undefined,
        avatarUrl: advisor.avatar ?? undefined,
      });
    }

    // ── All firm service sections (for "All Services We Provide" page) ──
    const allSections = firm
      ? await ctx.db.query("serviceSections").withIndex("by_firm_sort", (q) => q.eq("firmId", firm._id)).collect()
      : [];
    const allFirmServices = allSections.map((s) => ({ name: s.name, icon: s.iconName ?? undefined }));

    return {
      session,
      proposal: {
        _id: proposal._id,
        title: proposal.title,
        proposalNumber: proposal.proposalNumber,
        introText: proposal.introText,
        termsText: proposal.termsText,
        services: proposal.services,
        total: proposal.total,
        currency: proposal.currency,
        validUntil: proposal.validUntil,
        createdAt: proposal.createdAt,
        pdfUrl: proposal.pdfUrl,
        pdfStorageUrl,
        entities: proposal.entities,
        netMonthlyFee: proposal.netMonthlyFee,
        oneOffFee: proposal.oneOffFee,
      },
      firmName: firm?.name || "Unknown Firm",
      clientName: client?.companyName || "Client",
      clientEmail: client?.email || "",
      clientPhone: client?.phone ?? undefined,
      brandColors: firm?.brandColors
        ? { primary: firm.brandColors.primary, secondary: firm.brandColors.secondary }
        : { primary: "#2DD4BF", secondary: "#818CF8" },
      firmLogoUrl,
      pdfFooterText: firm?.pdfFooterText ?? undefined,
      pdfFooterAddress: firm?.pdfFooterAddress ?? undefined,
      pdfDisclaimer: firm?.pdfDisclaimer ?? undefined,
      pdfSignOffBlock: firm?.pdfSignOffBlock ?? undefined,
      pdfBankingDetails: firm?.pdfBankingDetails ?? undefined,
      pdfCoverImageUrl: pdfCoverImageUrl ?? undefined,
      pdfFooterImageUrl: pdfFooterImageUrl ?? undefined,
      pdfLastPageImageUrl: pdfLastPageImageUrl ?? undefined,
      // ── New template fields ──
      aboutUsHtml: firm?.aboutUsHtml ?? undefined,
      missionStatement: firm?.missionStatement ?? undefined,
      whyChooseUsItems: firm?.whyChooseUsItems ?? undefined,
      valuesStatement: firm?.valuesStatement ?? undefined,
      website: firm?.website ?? undefined,
      coverQuote: firm?.coverQuote ?? undefined,
      coverQuoteAuthor: firm?.coverQuoteAuthor ?? undefined,
      closingQuote: firm?.closingQuote ?? undefined,
      closingQuoteAuthor: firm?.closingQuoteAuthor ?? undefined,
      feesIntroductionText: firm?.feesIntroductionText ?? undefined,
      whatHappensNextText: firm?.whatHappensNextText ?? undefined,
      paymentTermsText: firm?.paymentTermsText ?? undefined,
      teamMembers,
      allFirmServices,
      advisorName: advisor?.name ?? undefined,
      advisorTitle: advisor?.jobTitle ?? undefined,
      advisorEmail: advisor?.email ?? undefined,
      advisorPhone: advisor?.phone ?? undefined,
      timelineSteps: firm?.defaultTimelineSteps ?? undefined,
    };
  },
});

/**
 * Get or create a preview token for a proposal (authenticated — firm user only).
 * Used by the "Review PDF" button so the firm can preview the client portal view.
 */
export const getOrCreatePreviewToken = mutation({
  args: {
    proposalId: v.id("proposals"),
    firmId: v.id("firms"),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    // Check for existing session
    const existing = await ctx.db
      .query("proposalAcceptSessions")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .first();
    if (existing) return { token: existing.token };

    // Create a new session
    const array = new Uint8Array(32);
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    const token = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.db.insert("proposalAcceptSessions", {
      firmId: args.firmId,
      proposalId: args.proposalId,
      token,
      status: "pending",
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });
    return { token };
  },
});

/**
 * Accept proposal (public - client uses token)
 */
export const acceptProposal = mutation({
  args: {
    token: v.string(),
    signerName: v.string(),
    signatureImage: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("proposalAcceptSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      return { success: false, error: "Link not found" };
    }

    if (session.status !== "pending") {
      return {
        success: false,
        error:
          session.status === "accepted"
            ? "This proposal has already been accepted"
            : "This proposal has been declined",
      };
    }

    if (Date.now() > session.expiresAt) {
      return { success: false, error: "This link has expired" };
    }

    // Validate signature image if provided (data URL from draw pad or upload)
    if (args.signatureImage != null) {
      if (typeof args.signatureImage !== "string" || args.signatureImage.length === 0) {
        return { success: false, error: "Invalid signature" };
      }
      if (!args.signatureImage.startsWith("data:image/")) {
        return { success: false, error: "Signature must be a valid image (PNG, JPG, or WebP)" };
      }
      const maxLength = 1_500_000; // ~1.1MB base64 for Convex doc limit safety
      if (args.signatureImage.length > maxLength) {
        return { success: false, error: "Signature image is too large. Use a smaller image (max 2MB file)." };
      }
    }

    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "accepted",
      acceptedAt: now,
      signerName: args.signerName,
      signatureImage: args.signatureImage,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    const proposal = await ctx.db.get(session.proposalId);
    if (proposal) {
      const payDefaults = paymentDefaultsForAccept(
        {
          paymentSchedule: proposal.paymentSchedule,
          cashFlowStartMonth: proposal.cashFlowStartMonth,
          oneOffCashMonth: proposal.oneOffCashMonth,
        },
        now
      );
      await ctx.db.patch(session.proposalId, {
        status: "accepted",
        updatedAt: now,
        acceptedAt: now,
        ...payDefaults,
        signatureData:
          args.signatureImage != null
            ? {
                signerName: args.signerName,
                signatureImage: args.signatureImage,
                signedAt: now,
                ipAddress: args.ipAddress,
                userAgent: args.userAgent,
              }
            : undefined,
      });

      await ctx.db.insert("activities", {
        firmId: session.firmId,
        userId: proposal.createdBy,
        entityType: "proposal",
        entityId: session.proposalId,
        action: "accepted",
        metadata: {
          signerName: args.signerName,
          ipAddress: args.ipAddress,
        },
        timestamp: now,
      });

      // Schedule Wahoo emails (Client + Staff) using configured templates
      const templateType = args.signatureImage != null ? "signed" : "acceptance";
      await ctx.scheduler.runAfter(0, api.email.sendWahooEmails, {
        proposalId: session.proposalId,
        templateType,
      });

      // Auto-generate the engagement letter and email the signing link to the client
      await ctx.scheduler.runAfter(0, api.email.sendEngagementLetterEmail, {
        proposalId: session.proposalId,
      });
    }

    return { success: true };
  },
});

/**
 * Reject proposal (public - client uses token)
 */
export const rejectProposal = mutation({
  args: {
    token: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("proposalAcceptSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) {
      return { success: false, error: "Link not found" };
    }

    if (session.status !== "pending") {
      return {
        success: false,
        error:
          session.status === "accepted"
            ? "This proposal has already been accepted"
            : "This proposal has been declined",
      };
    }

    if (Date.now() > session.expiresAt) {
      return { success: false, error: "This link has expired" };
    }

    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "rejected",
      rejectedAt: now,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    const proposal = await ctx.db.get(session.proposalId);
    if (proposal) {
      await ctx.db.patch(session.proposalId, {
        status: "rejected",
        updatedAt: now,
      });

      await ctx.db.insert("activities", {
        firmId: session.firmId,
        userId: proposal.createdBy,
        entityType: "proposal",
        entityId: session.proposalId,
        action: "rejected",
        metadata: { ipAddress: args.ipAddress },
        timestamp: now,
      });
    }

    return { success: true };
  },
});
