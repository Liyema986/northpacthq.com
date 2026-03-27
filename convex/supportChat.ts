import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { DatabaseReader } from "./_generated/server";

const messageValidator = v.object({
  _id: v.id("support_messages"),
  _creationTime: v.number(),
  userId: v.string(),
  role: v.union(v.literal("user"), v.literal("support")),
  content: v.string(),
  createdAt: v.number(),
  isAutoReply: v.optional(v.boolean()),
});

async function isAdminUser(db: DatabaseReader, authUserId: string): Promise<boolean> {
  const user = await db
    .query("users")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", authUserId))
    .first();
  return user !== null && (user.role === "owner" || user.role === "admin");
}

/**
 * Whether the current user has any unread support replies.
 */
export const hasUnreadReplies = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const lastMsg = await ctx.db
      .query("support_messages")
      .withIndex("by_user_and_created", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .first();
    return lastMsg?.role === "support";
  },
});

/**
 * List support messages for the current user, oldest first.
 */
export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(messageValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("support_messages")
      .withIndex("by_user_and_created", (q) => q.eq("userId", identity.subject))
      .order("asc")
      .take(limit);
  },
});

/**
 * Send a message as the current user. Auto-replies on first message.
 */
export const send = mutation({
  args: { content: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const content = args.content.trim();
    if (!content) throw new Error("Message cannot be empty");

    const existing = await ctx.db
      .query("support_messages")
      .withIndex("by_user_and_created", (q) => q.eq("userId", identity.subject))
      .first();
    const isFirstMessage = existing === null;

    await ctx.db.insert("support_messages", {
      userId: identity.subject,
      role: "user",
      content,
      createdAt: Date.now(),
    });

    if (isFirstMessage) {
      await ctx.scheduler.runAfter(1200, internal.supportChat.sendAutoReply, {
        userId: identity.subject,
      });
    }

    return null;
  },
});

/**
 * [Internal] Automated welcome reply on first message.
 */
export const sendAutoReply = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("support_messages", {
      userId: args.userId,
      role: "support",
      isAutoReply: true,
      content:
        "Hi there! 👋 Thanks for reaching out — we've received your message and our team will get back to you as soon as possible. Feel free to add any extra details that might help us assist you. We're happy to help! 😊",
      createdAt: Date.now(),
    });
    return null;
  },
});

/**
 * [Admin] List all conversations with last message preview.
 */
export const adminListConversations = query({
  args: {},
  returns: v.array(
    v.object({
      userId: v.string(),
      userEmail: v.optional(v.string()),
      userName: v.optional(v.string()),
      lastMessageAt: v.number(),
      lastMessagePreview: v.string(),
      unreadBySupport: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const admin = await isAdminUser(ctx.db, identity.subject);
    if (!admin) return [];

    const all = await ctx.db.query("support_messages").collect();
    const byUser = new Map<
      string,
      { lastAt: number; lastPreview: string; lastRole: "user" | "support" }
    >();
    for (const m of all) {
      const curr = byUser.get(m.userId);
      if (!curr || m.createdAt > curr.lastAt) {
        byUser.set(m.userId, {
          lastAt: m.createdAt,
          lastPreview: m.content.slice(0, 60) + (m.content.length > 60 ? "…" : ""),
          lastRole: m.isAutoReply ? "user" : m.role,
        });
      }
    }

    const userIds = Array.from(byUser.keys());
    const users = await Promise.all(
      userIds.map((authId) =>
        ctx.db
          .query("users")
          .withIndex("by_auth_user", (q) => q.eq("authUserId", authId))
          .first()
      )
    );
    const userByAuthId = new Map(
      users.filter(Boolean).map((u) => [u!.authUserId!, u!])
    );

    return Array.from(byUser.entries())
      .map(([userId, data]) => ({
        userId,
        userEmail: userByAuthId.get(userId)?.email,
        userName: userByAuthId.get(userId)?.name,
        lastMessageAt: data.lastAt,
        lastMessagePreview: data.lastPreview,
        unreadBySupport: data.lastRole === "user",
      }))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

/**
 * [Admin] List messages for a specific user thread.
 */
export const adminListForUser = query({
  args: { userId: v.string() },
  returns: v.array(messageValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const admin = await isAdminUser(ctx.db, identity.subject);
    if (!admin) return [];

    return await ctx.db
      .query("support_messages")
      .withIndex("by_user_and_created", (q) => q.eq("userId", args.userId))
      .order("asc")
      .take(200);
  },
});

/**
 * [Admin] Count of conversations awaiting a support reply.
 */
export const adminUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const admin = await isAdminUser(ctx.db, identity.subject);
    if (!admin) return 0;

    const all = await ctx.db.query("support_messages").collect();
    const lastByUser = new Map<string, { lastAt: number; lastRole: "user" | "support" }>();
    for (const m of all) {
      const curr = lastByUser.get(m.userId);
      if (!curr || m.createdAt > curr.lastAt) {
        lastByUser.set(m.userId, {
          lastAt: m.createdAt,
          lastRole: m.isAutoReply ? "user" : m.role,
        });
      }
    }
    let count = 0;
    for (const { lastRole } of lastByUser.values()) {
      if (lastRole === "user") count++;
    }
    return count;
  },
});

/**
 * [Admin] Reply to a user as support.
 */
export const adminReply = mutation({
  args: { userId: v.string(), content: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const admin = await isAdminUser(ctx.db, identity.subject);
    if (!admin) throw new Error("Only admins can reply to support messages");
    const content = args.content.trim();
    if (!content) throw new Error("Message cannot be empty");
    await ctx.db.insert("support_messages", {
      userId: args.userId,
      role: "support",
      content,
      createdAt: Date.now(),
    });
    return null;
  },
});

/**
 * [Admin] Delete an entire conversation.
 */
export const adminDeleteConversation = mutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const admin = await isAdminUser(ctx.db, identity.subject);
    if (!admin) throw new Error("Only admins can delete conversations");
    const messages = await ctx.db
      .query("support_messages")
      .withIndex("by_user_and_created", (q) => q.eq("userId", args.userId))
      .collect();
    await Promise.all(messages.map((m) => ctx.db.delete(m._id)));
    return null;
  },
});

/**
 * [Admin] Delete a single message.
 */
export const adminDeleteMessage = mutation({
  args: { messageId: v.id("support_messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const admin = await isAdminUser(ctx.db, identity.subject);
    if (!admin) throw new Error("Only admins can delete messages");
    await ctx.db.delete(args.messageId);
    return null;
  },
});
