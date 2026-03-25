// convex/internal.ts - Internal helper functions
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * Internal: Get user by ID
 */
export const getUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Internal: Get firm by ID
 */
export const getFirmInternal = internalQuery({
  args: {
    firmId: v.id("firms"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.firmId);
  },
});

/**
 * Internal: Get proposal for email
 */
export const getProposalInternal = internalQuery({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.proposalId);
  },
});

/**
 * Internal: Get user for actions (alias for compatibility)
 */
export const getUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Internal: Get client by ID
 */
export const getClientInternal = internalQuery({
  args: {
    clientId: v.id("clients"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.clientId);
  },
});

/**
 * Internal: Log email sent activity
 */
export const logEmailSent = internalMutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    to: v.string(),
    emailId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "proposal",
      entityId: args.proposalId,
      action: "email-sent",
      metadata: {
        to: args.to,
        emailId: args.emailId,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal: Log email error
 */
export const logEmailError = internalMutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "proposal",
      entityId: args.proposalId,
      action: "email-error",
      metadata: {
        error: args.error,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal: Log proposal viewed
 */
export const logProposalViewed = internalMutation({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) return;

    await ctx.db.insert("activities", {
      firmId: proposal.firmId,
      userId: proposal.createdBy,
      entityType: "proposal",
      entityId: args.proposalId,
      action: "viewed",
      metadata: {},
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal: Update proposal status
 */
export const updateProposalStatus = internalMutation({
  args: {
    proposalId: v.id("proposals"),
    status: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
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
 * Internal: Log PDF generation
 */
export const logPdfGeneration = internalMutation({
  args: {
    proposalId: v.id("proposals"),
    userId: v.id("users"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    // Update proposal
    await ctx.db.patch(args.proposalId, {
      updatedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "proposal",
      entityId: args.proposalId,
      action: "pdf-generated",
      metadata: {
        status: args.status,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});
