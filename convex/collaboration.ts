// convex/collaboration.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper to generate user color
const generateUserColor = (userId: string) => {
  const colors = [
    "#EF4444", // Red
    "#F59E0B", // Orange
    "#10B981", // Green
    "#3B82F6", // Blue
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#14B8A6", // Teal
    "#F97316", // Orange
  ];
  
  const hash = userId.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Join a proposal editing session
 */
export const joinProposal = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    // Get user info
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Check if user already has presence
    const existingPresence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("proposalId"), args.proposalId))
      .first();

    if (existingPresence) {
      // Update existing presence
      await ctx.db.patch(existingPresence._id, {
        isActive: true,
        lastActiveAt: Date.now(),
      });
      return { presenceId: existingPresence._id };
    }

    // Create new presence
    const presenceId = await ctx.db.insert("presence", {
      proposalId: args.proposalId,
      userId: args.userId,
      userName: user.name,
      userColor: generateUserColor(args.userId),
      isActive: true,
      lastActiveAt: Date.now(),
    });

    return { presenceId };
  },
});

/**
 * Leave a proposal editing session
 */
export const leaveProposal = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("proposalId"), args.proposalId))
      .first();

    if (presence) {
      await ctx.db.patch(presence._id, {
        isActive: false,
        lastActiveAt: Date.now(),
      });
    }
  },
});

/**
 * Update cursor position
 */
export const updateCursor = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    field: v.string(),
    offset: v.number(),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("proposalId"), args.proposalId))
      .first();

    if (presence) {
      await ctx.db.patch(presence._id, {
        cursorPosition: {
          field: args.field,
          offset: args.offset,
        },
        lastActiveAt: Date.now(),
      });
    }
  },
});

/**
 * Heartbeat to keep presence active
 */
export const heartbeat = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("proposalId"), args.proposalId))
      .first();

    if (presence) {
      await ctx.db.patch(presence._id, {
        isActive: true,
        lastActiveAt: Date.now(),
      });
    }
  },
});

/**
 * Get active users for a proposal
 */
export const getActiveUsers = query({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timeout = 30000; // 30 seconds

    const presences = await ctx.db
      .query("presence")
      .withIndex("by_proposal_active", (q) =>
        q.eq("proposalId", args.proposalId).eq("isActive", true)
      )
      .collect();

    // Filter out stale presences
    return presences
      .filter((p) => now - p.lastActiveAt < timeout)
      .map((p) => ({
        userId: p.userId,
        userName: p.userName,
        userColor: p.userColor,
        cursorPosition: p.cursorPosition,
        lastActiveAt: p.lastActiveAt,
      }));
  },
});

/**
 * Log activity for a proposal edit
 */
export const logActivity = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    action: v.string(),
    field: v.optional(v.string()),
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get user and proposal info
    const user = await ctx.db.get(args.userId);
    const proposal = await ctx.db.get(args.proposalId);
    
    if (!user || !proposal) return;

    // Insert activity
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "proposal",
      entityId: args.proposalId,
      action: args.action,
      metadata: {
        field: args.field,
        oldValue: args.oldValue,
        newValue: args.newValue,
        userName: user.name,
      },
      timestamp: Date.now(),
    });
  },
});

/**
 * Get activity history for a proposal
 */
export const getProposalActivity = query({
  args: {
    proposalId: v.id("proposals"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "proposal").eq("entityId", args.proposalId)
      )
      .order("desc")
      .take(limit);

    return activities.map((activity) => ({
      _id: activity._id,
      action: activity.action,
      userName: activity.metadata?.userName || "Unknown",
      field: activity.metadata?.field,
      oldValue: activity.metadata?.oldValue,
      newValue: activity.metadata?.newValue,
      timestamp: activity.timestamp,
    }));
  },
});

/**
 * Clean up stale presences (run periodically)
 */
export const cleanupStalePresences = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const timeout = 60000; // 1 minute

    // Get all presence records and filter for stale ones
    const allPresences = await ctx.db
      .query("presence")
      .collect();

    for (const presence of allPresences) {
      if (presence.isActive && now - presence.lastActiveAt > timeout) {
        await ctx.db.patch(presence._id, {
          isActive: false,
        });
      }
    }
  },
});
