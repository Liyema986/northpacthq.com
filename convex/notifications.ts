// convex/notifications.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * List notifications for a user
 */
export const listNotifications = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 50);

    return notifications;
  },
});

/**
 * Get unread count
 */
export const getUnreadCount = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return 0;

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .collect();

    return unreadNotifications.length;
  },
});

/**
 * Mark notification as read
 */
export const markAsRead = mutation({
  args: {
    userId: v.id("users"),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== args.userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(args.notificationId, {
      isRead: true,
    });

    return { success: true };
  },
});

/**
 * Mark all notifications as read
 */
export const markAllAsRead = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .collect();

    await Promise.all(
      unreadNotifications.map((n) =>
        ctx.db.patch(n._id, { isRead: true })
      )
    );

    return { success: true };
  },
});

/**
 * Delete a notification
 */
export const deleteNotification = mutation({
  args: {
    userId: v.id("users"),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== args.userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.delete(args.notificationId);

    return { success: true };
  },
});
