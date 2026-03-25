// convex/pdfGeneration.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get proposal data for PDF generation (client-side generation)
 */
export const getProposalPDFData = query({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get proposal with full details
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.firmId !== user.firmId) {
      throw new Error("Access denied");
    }

    // Get client details
    const client = await ctx.db.get(proposal.clientId);

    // Get firm details for branding
    const firm = await ctx.db.get(user.firmId);
    if (!firm) throw new Error("Firm not found");

    return {
      proposal,
      client,
      firm,
      generatedAt: Date.now(),
    };
  },
});

/**
 * Store PDF metadata (internal mutation)
 */
export const storePDFMetadata = mutation({
  args: {
    proposalId: v.id("proposals"),
    userId: v.id("users"),
    status: v.string(),
    pdfUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Update proposal with PDF generation status
    await ctx.db.patch(args.proposalId, {
      updatedAt: Date.now(),
    });

    // Log activity
    const user = await ctx.db.get(args.userId);
    if (user) {
      await ctx.db.insert("activities", {
        firmId: user.firmId,
        userId: args.userId,
        entityType: "proposal",
        entityId: args.proposalId,
        action: "pdf-generated",
        metadata: {
          status: args.status,
          pdfUrl: args.pdfUrl,
        },
        timestamp: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Get proposal details for PDF generation (internal query)
 */
export const getProposalForPDF = mutation({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) return null;

    // Get client details
    const client = await ctx.db.get(proposal.clientId);
    
    // Get firm details
    const firm = await ctx.db.get(proposal.firmId);

    return {
      proposal,
      client,
      firm,
    };
  },
});
