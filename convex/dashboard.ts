import { query } from "./_generated/server";
import { v } from "convex/values";
import { getUserFirmId, getUserFirmIdSafe } from "./lib/permissions";

/**
 * Get dashboard metrics for the user's firm.
 */
export const getDashboardMetrics = query({
  args: {
    userId: v.optional(v.id("users")),
    days: v.optional(v.number()), // Number of days to include (default 30)
  },
  returns: v.object({
    totalProposals: v.number(),
    winRate: v.number(),
    totalRevenue: v.number(),
    avgProposalValue: v.number(),
    recentProposals: v.array(
      v.object({
        _id: v.id("proposals"),
        title: v.string(),
        clientName: v.string(),
        totalPrice: v.number(),
        status: v.string(),
        createdAt: v.number(),
        validUntil: v.number(),
      })
    ),
    winRateHistory: v.array(
      v.object({
        date: v.string(),
        winRate: v.number(),
      })
    ),
    proposalsByStatus: v.object({
      draft: v.number(),
      sent: v.number(),
      viewed: v.number(),
      accepted: v.number(),
      rejected: v.number(),
      expired: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // Empty metrics structure to return on error/missing user
    const emptyMetrics = {
      totalProposals: 0,
      winRate: 0,
      totalRevenue: 0,
      avgProposalValue: 0,
      recentProposals: [],
      winRateHistory: [],
      proposalsByStatus: {
        draft: 0,
        sent: 0,
        viewed: 0,
        accepted: 0,
        rejected: 0,
        expired: 0,
      },
    };

    let userId = args.userId;
    if (!userId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        // Return empty metrics if not authenticated
        console.warn("getDashboardMetrics: Not authenticated, returning empty metrics");
        return emptyMetrics;
      }
      
      // 1. Try by authUserId (Clerk ID)
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_user", (q) => q.eq("authUserId", identity.tokenIdentifier))
        .unique();
        
      if (user) {
        userId = user._id;
      } else if (identity.email) {
        // 2. Try by email (fallback for invited users)
        const email = identity.email; // Capture email for type safety
        const userByEmail = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique();
        if (userByEmail) {
            userId = userByEmail._id;
        }
      }
    }

    // Use safe version to avoid throwing on stale user IDs
    const firmId = userId ? await getUserFirmIdSafe(ctx, userId) : null;
    
    // If user doesn't exist, return empty metrics instead of throwing
    if (!firmId) {
      console.warn("getDashboardMetrics: User not found, returning empty metrics");
      return emptyMetrics;
    }
    const days = args.days || 30;
    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;
    const bucketSizeMs = 7 * 24 * 60 * 60 * 1000;

    const allProposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    // Single-pass: status counts (all time) and recent-period metrics
    const proposalsByStatus = {
      draft: 0,
      sent: 0,
      viewed: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
    };
    let totalProposals = 0;
    let acceptedProposals = 0;
    let sentProposals = 0;
    let totalRevenue = 0;
    const numBuckets = Math.ceil(days / 7);
    const bucketAccepted: number[] = new Array(numBuckets).fill(0);
    const bucketSent: number[] = new Array(numBuckets).fill(0);

    const now = Date.now();
    for (const p of allProposals) {
      const status = p.status as keyof typeof proposalsByStatus;
      if (proposalsByStatus[status] !== undefined) proposalsByStatus[status]++;

      const inRange = p.createdAt >= cutoffDate;
      if (inRange) {
        totalProposals++;
        if (p.status === "accepted") {
          acceptedProposals++;
          totalRevenue += Number(p.total) || 0;
        }
        if (["sent", "viewed", "accepted", "rejected"].includes(p.status)) sentProposals++;
      }

      for (let i = 0; i < numBuckets; i++) {
        const bucketEnd = now - i * bucketSizeMs;
        const bucketStart = bucketEnd - bucketSizeMs;
        if (p.createdAt >= bucketStart && p.createdAt < bucketEnd) {
          if (["sent", "viewed", "accepted", "rejected"].includes(p.status)) bucketSent[i]++;
          if (p.status === "accepted") bucketAccepted[i]++;
        }
      }
    }

    const winRate = sentProposals > 0 ? (acceptedProposals / sentProposals) * 100 : 0;
    const avgProposalValue = acceptedProposals > 0 ? totalRevenue / acceptedProposals : 0;
    const safeTotalRevenue = Number.isFinite(totalRevenue) ? totalRevenue : 0;
    const safeAvgProposalValue = Number.isFinite(avgProposalValue) ? avgProposalValue : 0;

    const winRateHistory = bucketSent.map((sent, i) => {
      const bucketEnd = now - i * bucketSizeMs;
      const bucketStart = bucketEnd - bucketSizeMs;
      const rate = sent > 0 ? (bucketAccepted[i] / sent) * 100 : 0;
      return {
        date: new Date(bucketStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        winRate: Math.round(rate * 10) / 10,
      };
    }).reverse();

    const sorted = [...allProposals].sort((a, b) => b.createdAt - a.createdAt);
    const recentProposalsWithClients = await Promise.all(
      sorted.slice(0, 10).map(async (proposal) => {
        const client = await ctx.db.get(proposal.clientId);
        return {
          _id: proposal._id,
          title: proposal.title,
          clientName: client?.companyName || "Unknown Client",
          totalPrice: proposal.total,
          status: proposal.status,
          createdAt: proposal.createdAt,
          validUntil: proposal.validUntil || 0,
        };
      })
    );

    return {
      totalProposals,
      winRate: Math.round(winRate * 10) / 10,
      totalRevenue: safeTotalRevenue,
      avgProposalValue: safeAvgProposalValue,
      recentProposals: recentProposalsWithClients,
      winRateHistory,
      proposalsByStatus,
    };
  },
});

/**
 * Get activity feed for the dashboard.
 */
export const getRecentActivity = query({
  args: {
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("activities"),
      type: v.string(),
      description: v.string(),
      metadata: v.any(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Try to get userId from args or from auth identity
    let userId = args.userId;
    if (!userId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        console.warn("getRecentActivity: Not authenticated, returning empty array");
        return [];
      }
      
      // Try by authUserId (Clerk ID)
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_user", (q) => q.eq("authUserId", identity.tokenIdentifier))
        .unique();
        
      if (user) {
        userId = user._id;
      } else {
        const email = identity.email;
        if (email) {
          // Try by email (fallback for invited users)
          const userByEmail = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique();
          if (userByEmail) {
            userId = userByEmail._id;
          }
        }
      }
    }

    // Use safe version to avoid throwing
    const firmId = userId ? await getUserFirmIdSafe(ctx, userId) : null;
    
    if (!firmId) {
      console.warn("getRecentActivity: User or firm not found, returning empty array");
      return [];
    }

    const limit = args.limit || 20;

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .order("desc")
      .take(limit);

    return activities.map((activity) => ({
      _id: activity._id,
      type: activity.action,
      description: `${activity.entityType} ${activity.action}`,
      metadata: activity.metadata,
      createdAt: activity.timestamp,
    }));
  },
});
