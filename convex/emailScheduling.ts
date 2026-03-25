// convex/emailScheduling.ts - Schedule proposal emails for send later
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePermission } from "./lib/permissions";
import { Id } from "./_generated/dataModel";

/**
 * Schedule a proposal email to be sent at a future time.
 */
export const scheduleProposalEmail = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    scheduledAt: v.number(), // Unix ms when to send
    customMessage: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    emailId: v.optional(v.id("emails")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.scheduledAt <= now + 60_000) {
      return {
        success: false,
        error: "Scheduled time must be at least 1 minute from now",
      };
    }

    const user = await requirePermission(ctx, args.userId, "canCreateProposals");
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== user.firmId) {
      return { success: false, error: "Proposal not found" };
    }

    const firm = await ctx.db.get(user.firmId);
    if (firm?.requireApprovalBeforeSend && proposal.status !== "approved") {
      return {
        success: false,
        error: "This proposal requires internal approval before it can be sent.",
      };
    }

    const client = await ctx.db.get(proposal.clientId);
    const clientEmail = client?.email || "";
    if (!clientEmail) {
      return { success: false, error: "Client has no email address" };
    }

    const emailId = await ctx.db.insert("emails", {
      firmId: user.firmId,
      proposalId: args.proposalId,
      to: clientEmail,
      subject: `Proposal: ${proposal.title}`,
      status: "scheduled",
      scheduledAt: args.scheduledAt,
      createdBy: args.userId,
      createdAt: now,
    });

    const delayMs = args.scheduledAt - now;
    await ctx.scheduler.runAfter(delayMs, internal.email.processScheduledEmail, {
      emailId,
      userId: args.userId,
      proposalId: args.proposalId,
      customMessage: args.customMessage,
    });

    return { success: true, emailId };
  },
});
