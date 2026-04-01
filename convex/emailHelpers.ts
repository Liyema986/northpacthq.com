// convex/emailHelpers.ts - Internal helper functions for email actions
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * Generate a secure random token for proposal view/accept links
 */
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Internal: Get email record
 */
export const getEmailForProcessInternal = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.emailId);
  },
});

/**
 * Internal: Get proposal for email
 */
export const getProposalForEmail = internalQuery({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.proposalId);
  },
});

/**
 * Internal: Get client for email
 */
export const getClientForEmail = internalQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.clientId);
  },
});

/**
 * Internal: Get user for email
 */
export const getUserForEmail = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Internal: Get firm for email
 */
export const getFirmForEmail = internalQuery({
  args: { firmId: v.id("firms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.firmId);
  },
});

/**
 * Internal: Update proposal status
 */
export const updateProposalStatusEmail = internalMutation({
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
 * Internal: Log email sent activity
 */
export const logEmailSentInternal = internalMutation({
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
export const logEmailErrorInternal = internalMutation({
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
export const logProposalViewedInternal = internalMutation({
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
 * Internal: Get proposal accept session by proposal (for building view/sign URL)
 */
export const getProposalAcceptSessionByProposalInternal = internalQuery({
  args: { proposalId: v.id("proposals") },
  returns: v.union(
    v.object({
      token: v.string(),
      viewUrl: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("proposalAcceptSessions")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .first();
    if (!session) return null;
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    return {
      token: session.token,
      viewUrl: baseUrl ? `${baseUrl}/proposals/view/${session.token}` : "",
    };
  },
});

/**
 * Internal: Create proposal accept session (token for client view/accept)
 */
export const createProposalAcceptSessionInternal = internalMutation({
  args: {
    firmId: v.id("firms"),
    proposalId: v.id("proposals"),
  },
  returns: v.object({
    sessionId: v.id("proposalAcceptSessions"),
    token: v.string(),
    viewUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const token = generateSecureToken();
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000; // 90 days
    // Public Next.js URL only — never CONVEX_SITE_URL (convex.site has no /proposals/view page).
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    if (!baseUrl) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is not set in Convex. Set your app URL: npx convex env set NEXT_PUBLIC_SITE_URL https://your-domain.com (production or Vercel preview)."
      );
    }
    const viewUrl = `${baseUrl}/proposals/view/${token}`;

    const sessionId = await ctx.db.insert("proposalAcceptSessions", {
      firmId: args.firmId,
      proposalId: args.proposalId,
      token,
      status: "pending",
      expiresAt,
      createdAt: Date.now(),
    });

    return { sessionId, token, viewUrl };
  },
});

/**
 * Internal: Insert email record (queued or sent)
 */
export const insertEmailRecordInternal = internalMutation({
  args: {
    firmId: v.id("firms"),
    proposalId: v.id("proposals"),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("failed")
    ),
    resendId: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  returns: v.id("emails"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("emails", {
      firmId: args.firmId,
      proposalId: args.proposalId,
      to: args.to,
      subject: args.subject,
      status: args.status,
      resendId: args.resendId,
      scheduledAt: args.scheduledAt,
      sentAt: args.sentAt,
      error: args.error,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal: Update email record
 */
export const updateEmailRecordInternal = internalMutation({
  args: {
    emailId: v.id("emails"),
    status: v.optional(v.string()),
    resendId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {};
    if (args.status) updates.status = args.status;
    if (args.resendId !== undefined) updates.resendId = args.resendId;
    if (args.sentAt !== undefined) updates.sentAt = args.sentAt;
    if (args.error !== undefined) updates.error = args.error;
    await ctx.db.patch(args.emailId, updates);
  },
});

/**
 * Internal: Find email by Resend ID and update status (for webhooks)
 * When status is "opened", also updates proposal viewedAt and logs activity.
 */
export const updateEmailByResendIdInternal = internalMutation({
  args: {
    resendId: v.string(),
    status: v.union(
      v.literal("opened"),
      v.literal("failed"),
      v.literal("sent"),
      v.literal("scheduled"),
      v.literal("queued")
    ),
  },
  returns: v.union(v.boolean(), v.null()),
  handler: async (ctx, args) => {
    const email = await ctx.db
      .query("emails")
      .withIndex("by_resend_id", (q) => q.eq("resendId", args.resendId))
      .first();

    if (!email) return null;

    await ctx.db.patch(email._id, { status: args.status });

    if (args.status === "opened") {
      const proposal = await ctx.db.get(email.proposalId);
      if (proposal) {
        await ctx.db.patch(email.proposalId, {
          viewedAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("activities", {
          firmId: email.firmId,
          userId: email.createdBy,
          entityType: "proposal",
          entityId: email.proposalId,
          action: "viewed",
          metadata: { source: "resend_webhook" },
          timestamp: Date.now(),
        });
      }
    }

    return true;
  },
});

/**
 * Internal: Get proposal ID from email record (for webhook)
 */
export const getProposalIdByResendIdInternal = internalQuery({
  args: { resendId: v.string() },
  handler: async (ctx, args) => {
    const email = await ctx.db
      .query("emails")
      .withIndex("by_resend_id", (q) => q.eq("resendId", args.resendId))
      .first();
    return email?.proposalId ?? null;
  },
});

/**
 * Internal: Get scheduled emails due to send
 */
export const getScheduledEmailsDueInternal = internalQuery({
  args: { beforeTs: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emails")
      .withIndex("by_scheduled", (q) =>
        q.eq("status", "scheduled").lte("scheduledAt", args.beforeTs)
      )
      .collect();
  },
});

/**
 * Internal: Get all engagement letters + signing sessions for a proposal (for multi-letter emails).
 */
export const getLettersWithSessionsForProposal = internalQuery({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args) => {
    const letters = await ctx.db
      .query("engagementLetters")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .collect();

    const results = [];
    for (const letter of letters) {
      const session = await ctx.db
        .query("signingSessions")
        .filter((q) => q.eq(q.field("letterId"), letter._id))
        .first();
      results.push({
        letterId: letter._id,
        letterNumber: letter.letterNumber,
        serviceType: letter.serviceType,
        status: letter.status,
        signingToken: session?.token ?? null,
      });
    }
    return results;
  },
});
