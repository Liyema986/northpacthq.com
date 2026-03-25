// convex/approvals.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Request approval for a proposal
 */
export const requestApproval = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    assignedTo: v.id("users"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get proposal
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== user.firmId) {
      throw new Error("Proposal not found");
    }

    // Verify proposal is in draft status
    if (proposal.status !== "draft") {
      throw new Error("Can only request approval for draft proposals");
    }

    // Get approver
    const approver = await ctx.db.get(args.assignedTo);
    if (!approver || approver.firmId !== user.firmId) {
      throw new Error("Approver not found");
    }

    // Verify approver has permission to approve
    const canApprove = ["admin", "senior", "owner"].includes(approver.role);
    if (!canApprove) {
      throw new Error("Selected user cannot approve proposals");
    }

    // Check if there's already a pending approval request
    const existingRequest = await ctx.db
      .query("approvalRequests")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new Error("There is already a pending approval request for this proposal");
    }

    // Create approval request
    const approvalRequestId = await ctx.db.insert("approvalRequests", {
      firmId: user.firmId,
      proposalId: args.proposalId,
      requestedBy: args.userId,
      assignedTo: args.assignedTo,
      message: args.message,
      status: "pending",
      requestedAt: Date.now(),
    });

    // Update proposal status
    await ctx.db.patch(args.proposalId, {
      status: "pending-approval",
      updatedAt: Date.now(),
    });

    // Create notification for approver
    await ctx.db.insert("notifications", {
      firmId: user.firmId,
      userId: args.assignedTo,
      type: "approval-request",
      title: "Approval Request",
      message: `${user.name} requested approval for proposal "${proposal.title}"`,
      relatedId: approvalRequestId,
      relatedType: "approval",
      isRead: false,
      createdAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "proposal",
      entityId: args.proposalId,
      action: "approval-requested",
      metadata: {
        assignedTo: approver.name,
        message: args.message,
      },
      timestamp: Date.now(),
    });

    return { success: true, approvalRequestId };
  },
});

/**
 * Approve a proposal
 */
export const approveProposal = mutation({
  args: {
    userId: v.id("users"),
    approvalRequestId: v.id("approvalRequests"),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get approval request
    const request = await ctx.db.get(args.approvalRequestId);
    if (!request || request.firmId !== user.firmId) {
      throw new Error("Approval request not found");
    }

    // Verify user is the assigned approver
    if (request.assignedTo !== args.userId) {
      throw new Error("You are not assigned to approve this request");
    }

    // Verify request is pending
    if (request.status !== "pending") {
      throw new Error("This request has already been reviewed");
    }

    // Update approval request
    await ctx.db.patch(args.approvalRequestId, {
      status: "approved",
      reviewedBy: args.userId,
      reviewComment: args.comment,
      reviewedAt: Date.now(),
    });

    // Update proposal
    await ctx.db.patch(request.proposalId, {
      status: "approved",
      approvedBy: args.userId,
      updatedAt: Date.now(),
    });

    // Get requester for notification
    const requester = await ctx.db.get(request.requestedBy);
    const proposal = await ctx.db.get(request.proposalId);

    // Create notification for requester
    if (requester && proposal) {
      await ctx.db.insert("notifications", {
        firmId: user.firmId,
        userId: request.requestedBy,
        type: "approval-approved",
        title: "Proposal Approved",
        message: `Your proposal "${proposal.title}" has been approved by ${user.name}`,
        relatedId: request.proposalId,
        relatedType: "proposal",
        isRead: false,
        createdAt: Date.now(),
      });
    }

    // Log activity
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "proposal",
      entityId: request.proposalId,
      action: "approved",
      metadata: {
        approver: user.name,
        comment: args.comment,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Reject a proposal
 */
export const rejectProposal = mutation({
  args: {
    userId: v.id("users"),
    approvalRequestId: v.id("approvalRequests"),
    comment: v.string(), // Comment is required for rejections
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get approval request
    const request = await ctx.db.get(args.approvalRequestId);
    if (!request || request.firmId !== user.firmId) {
      throw new Error("Approval request not found");
    }

    // Verify user is the assigned approver
    if (request.assignedTo !== args.userId) {
      throw new Error("You are not assigned to approve this request");
    }

    // Verify request is pending
    if (request.status !== "pending") {
      throw new Error("This request has already been reviewed");
    }

    // Update approval request
    await ctx.db.patch(args.approvalRequestId, {
      status: "rejected",
      reviewedBy: args.userId,
      reviewComment: args.comment,
      reviewedAt: Date.now(),
    });

    // Update proposal back to draft
    await ctx.db.patch(request.proposalId, {
      status: "draft",
      updatedAt: Date.now(),
    });

    // Get requester for notification
    const requester = await ctx.db.get(request.requestedBy);
    const proposal = await ctx.db.get(request.proposalId);

    // Create notification for requester
    if (requester && proposal) {
      await ctx.db.insert("notifications", {
        firmId: user.firmId,
        userId: request.requestedBy,
        type: "approval-rejected",
        title: "Proposal Changes Requested",
        message: `${user.name} requested changes to "${proposal.title}": ${args.comment}`,
        relatedId: request.proposalId,
        relatedType: "proposal",
        isRead: false,
        createdAt: Date.now(),
      });
    }

    // Log activity
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "proposal",
      entityId: request.proposalId,
      action: "rejected",
      metadata: {
        reviewer: user.name,
        comment: args.comment,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get approval request for a proposal
 */
export const getProposalApprovalRequest = query({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Get the most recent approval request
    const request = await ctx.db
      .query("approvalRequests")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .order("desc")
      .first();

    if (!request || request.firmId !== user.firmId) {
      return null;
    }

    // Get related users
    const requester = await ctx.db.get(request.requestedBy);
    const assignee = await ctx.db.get(request.assignedTo);
    const reviewer = request.reviewedBy ? await ctx.db.get(request.reviewedBy) : null;

    return {
      ...request,
      requesterName: requester?.name || "Unknown",
      assigneeName: assignee?.name || "Unknown",
      reviewerName: reviewer?.name || null,
    };
  },
});

/**
 * List pending approval requests for a user
 */
export const listPendingApprovals = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    // Get all pending approvals assigned to this user
    const requests = await ctx.db
      .query("approvalRequests")
      .withIndex("by_assignee", (q) =>
        q.eq("assignedTo", args.userId).eq("status", "pending")
      )
      .collect();

    // Enrich with proposal and requester details
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const proposal = await ctx.db.get(request.proposalId);
        const requester = await ctx.db.get(request.requestedBy);
        const client = proposal ? await ctx.db.get(proposal.clientId) : null;

        return {
          ...request,
          proposalTitle: proposal?.title || "Unknown",
          proposalNumber: proposal?.proposalNumber || "Unknown",
          clientName: client?.companyName || "Unknown",
          requesterName: requester?.name || "Unknown",
        };
      })
    );

    return enrichedRequests;
  },
});

/**
 * Get approval metrics for dashboard
 */
export const getApprovalMetrics = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Get all approval requests for the firm
    const allRequests = await ctx.db
      .query("approvalRequests")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();

    const pending = allRequests.filter((r) => r.status === "pending").length;
    const approved = allRequests.filter((r) => r.status === "approved").length;
    const rejected = allRequests.filter((r) => r.status === "rejected").length;

    // Calculate average approval time (in hours)
    const completedRequests = allRequests.filter(
      (r) => r.reviewedAt && r.status !== "pending"
    );
    const avgApprovalTime =
      completedRequests.length > 0
        ? completedRequests.reduce((sum, r) => {
            const duration = (r.reviewedAt! - r.requestedAt) / (1000 * 60 * 60);
            return sum + duration;
          }, 0) / completedRequests.length
        : 0;

    return {
      pending,
      approved,
      rejected,
      total: allRequests.length,
      avgApprovalTimeHours: Math.round(avgApprovalTime * 10) / 10,
    };
  },
});

/**
 * List approvers (users who can approve proposals)
 */
export const listApprovers = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    // Get all users in the firm who can approve
    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();

    // Filter to only approvers (admin, senior, owner)
    const approvers = allUsers.filter((u) =>
      ["admin", "senior", "owner"].includes(u.role)
    );

    return approvers.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
    }));
  },
});
