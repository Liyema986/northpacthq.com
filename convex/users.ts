import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { withFirmScope, requirePermission, getUserFirmId, getUserFirmIdSafe } from "./lib/permissions";
import { logAuditEntry } from "./lib/auditLog";
import { AuditActions, EntityTypes } from "./lib/auditLog";

/**
 * Get all users in the current firm.
 */
export const listUsers = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.string(),
      role: v.string(),
      avatar: v.optional(v.string()),
      lastActiveAt: v.number(),
      createdAt: v.number(),
      deactivatedAt: v.optional(v.number()),
      /** inactive | pending_invite | invite_expired | active */
      membershipStatus: v.union(
        v.literal("inactive"),
        v.literal("pending_invite"),
        v.literal("invite_expired"),
        v.literal("active")
      ),
    })
  ),
  handler: async (ctx, args) => {
    // Use safe version to avoid throwing on stale user IDs
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    
    if (!firmId) {
      console.warn("listUsers: User not found, returning empty array");
      return [];
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const now = Date.now();

    return users.map((user) => {
      let membershipStatus:
        | "inactive"
        | "pending_invite"
        | "invite_expired"
        | "active";
      if (user.deactivatedAt) {
        membershipStatus = "inactive";
      } else if (!user.authUserId) {
        membershipStatus =
          user.inviteExpiresAt != null && user.inviteExpiresAt <= now
            ? "invite_expired"
            : "pending_invite";
      } else {
        membershipStatus = "active";
      }

      return {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
        deactivatedAt: user.deactivatedAt,
        membershipStatus,
      };
    });
  },
});

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Public preview for an invite link (no auth). Used on /auth?invite=…
 */
export const getInvitePreview = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      firmName: v.string(),
      inviteeName: v.string(),
      inviteeEmail: v.string(),
      role: v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("senior"),
        v.literal("staff"),
        v.literal("view-only")
      ),
      expiresAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    if (!args.token.trim()) return null;
    const invited = await ctx.db
      .query("users")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .unique();
    if (!invited?.inviteExpiresAt || invited.inviteExpiresAt <= Date.now()) {
      return null;
    }
    if (invited.authUserId) return null;
    const firm = await ctx.db.get(invited.firmId);
    if (!firm) return null;
    return {
      firmName: firm.name,
      inviteeName: invited.name,
      inviteeEmail: invited.email,
      role: invited.role,
      expiresAt: invited.inviteExpiresAt,
    };
  },
});

/**
 * Invite a new user to the firm.
 * Only owners and admins can invite users.
 */
export const inviteUser = mutation({
  args: {
    inviterId: v.id("users"),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("senior"),
      v.literal("staff"),
      v.literal("view-only")
    ),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id("users")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const email = args.email.trim().toLowerCase();

    // Verify inviter has permission
    const inviter = await requirePermission(ctx, args.inviterId, "canManageUsers");

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existingUser?.authUserId) {
      return {
        success: false,
        error: "Email already registered",
      };
    }

    const token = crypto.randomUUID();
    const expiresAt = now + INVITE_TTL_MS;

    if (existingUser) {
      if (existingUser.firmId !== inviter.firmId) {
        return {
          success: false,
          error: "This email already has a pending or active account elsewhere.",
        };
      }
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        role: args.role,
        inviteToken: token,
        inviteExpiresAt: expiresAt,
        lastActiveAt: now,
      });

      await logAuditEntry(ctx, {
        firmId: inviter.firmId,
        userId: args.inviterId,
        entityType: EntityTypes.USER,
        entityId: existingUser._id,
        action: AuditActions.USER_INVITED,
        metadata: { email, name: args.name, role: args.role, resent: true },
      });

      const firm = await ctx.db.get(inviter.firmId);
      const inviterDoc = await ctx.db.get(args.inviterId);
      await ctx.scheduler.runAfter(0, internal.email.sendTeamInviteEmail, {
        to: email,
        firmName: firm?.name ?? "NorthPact",
        inviterName: inviterDoc?.name,
        token,
      });

      return {
        success: true,
        userId: existingUser._id,
      };
    }

    const userId = await ctx.db.insert("users", {
      firmId: inviter.firmId,
      email,
      name: args.name,
      role: args.role,
      lastActiveAt: now,
      createdAt: now,
      loginAttempts: 0,
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    });

    await logAuditEntry(ctx, {
      firmId: inviter.firmId,
      userId: args.inviterId,
      entityType: EntityTypes.USER,
      entityId: userId,
      action: AuditActions.USER_INVITED,
      metadata: { email, name: args.name, role: args.role },
    });

    const firm = await ctx.db.get(inviter.firmId);
    const inviterDoc = await ctx.db.get(args.inviterId);
    await ctx.scheduler.runAfter(0, internal.email.sendTeamInviteEmail, {
      to: email,
      firmName: firm?.name ?? "NorthPact",
      inviterName: inviterDoc?.name,
      token,
    });

    return {
      success: true,
      userId,
    };
  },
});

/**
 * Update a user's role.
 * Only owners and admins can change roles.
 */
export const updateUserRole = mutation({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("senior"),
      v.literal("staff"),
      v.literal("view-only")
    ),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify admin has permission
    const admin = await requirePermission(ctx, args.adminId, "canManageUsers");

    // Get target user
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Verify same firm
    if (targetUser.firmId !== admin.firmId) {
      return { success: false, error: "Access denied" };
    }

    // Cannot change owner's role
    if (targetUser.role === "owner") {
      return { success: false, error: "Cannot change owner's role" };
    }

    // Note: "owner" is already excluded from args.newRole type,
    // so no runtime check needed - TypeScript enforces this at compile time

    // Admin cannot change other admins (only owners can)
    if (targetUser.role === "admin" && admin.role !== "owner") {
      return { success: false, error: "Only owners can manage admin roles" };
    }

    await ctx.db.patch(args.targetUserId, {
      role: args.newRole,
    });

    await logAuditEntry(ctx, {
      firmId: admin.firmId,
      userId: args.adminId,
      entityType: EntityTypes.USER,
      entityId: args.targetUserId,
      action: AuditActions.USER_ROLE_CHANGED,
      metadata: { targetName: targetUser.name, targetEmail: targetUser.email, newRole: args.newRole, previousRole: targetUser.role },
    });

    return { success: true };
  },
});

/**
 * Update a user's profile (name) by admin.
 * Only owners and admins can update other users.
 */
export const updateUserByAdmin = mutation({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
    name: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, args.adminId, "canManageUsers");
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }
    if (targetUser.firmId !== admin.firmId) {
      return { success: false, error: "Access denied" };
    }
    if (targetUser.role === "owner") {
      return { success: false, error: "Cannot edit the owner's profile" };
    }
    const trimmed = args.name.trim();
    if (!trimmed) {
      return { success: false, error: "Name is required" };
    }
    await ctx.db.patch(args.targetUserId, { name: trimmed });
    await logAuditEntry(ctx, {
      firmId: admin.firmId,
      userId: args.adminId,
      entityType: EntityTypes.USER,
      entityId: args.targetUserId,
      action: AuditActions.USER_PROFILE_UPDATED,
      metadata: { targetEmail: targetUser.email, newName: trimmed, previousName: targetUser.name },
    });
    return { success: true };
  },
});

/**
 * Deactivate or reactivate a user.
 * Only owners and admins can deactivate users.
 */
export const setUserDeactivated = mutation({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
    deactivated: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, args.adminId, "canManageUsers");
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }
    if (targetUser.firmId !== admin.firmId) {
      return { success: false, error: "Access denied" };
    }
    if (targetUser.role === "owner") {
      return { success: false, error: "Cannot deactivate the owner" };
    }
    if (args.adminId === args.targetUserId) {
      return { success: false, error: "Cannot deactivate yourself" };
    }
    const now = Date.now();
    await ctx.db.patch(args.targetUserId, {
      deactivatedAt: args.deactivated ? now : undefined,
    });
    await logAuditEntry(ctx, {
      firmId: admin.firmId,
      userId: args.adminId,
      entityType: EntityTypes.USER,
      entityId: args.targetUserId,
      action: args.deactivated ? AuditActions.USER_DEACTIVATED : AuditActions.USER_ACTIVATED,
      metadata: { name: targetUser.name, email: targetUser.email },
    });
    return { success: true };
  },
});

/**
 * Remove a user from the firm.
 * Only owners and admins can remove users.
 */
export const removeUser = mutation({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify admin has permission
    const admin = await requirePermission(ctx, args.adminId, "canManageUsers");

    // Get target user
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Verify same firm
    if (targetUser.firmId !== admin.firmId) {
      return { success: false, error: "Access denied" };
    }

    // Cannot remove owner
    if (targetUser.role === "owner") {
      return { success: false, error: "Cannot remove the firm owner" };
    }

    // Cannot remove yourself
    if (args.adminId === args.targetUserId) {
      return { success: false, error: "Cannot remove yourself" };
    }

    // Admin cannot remove other admins (only owners can)
    if (targetUser.role === "admin" && admin.role !== "owner") {
      return { success: false, error: "Only owners can remove admin users" };
    }

    await logAuditEntry(ctx, {
      firmId: admin.firmId,
      userId: args.adminId,
      entityType: EntityTypes.USER,
      entityId: args.targetUserId,
      action: AuditActions.USER_REMOVED,
      metadata: { name: targetUser.name, email: targetUser.email, role: targetUser.role },
    });

    await ctx.db.delete(args.targetUserId);

    return { success: true };
  },
});

/**
 * Update user profile (Settings > Account).
 * Users can only update their own profile.
 */
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    emailNotifications: v.optional(v.boolean()),
    notificationDigest: v.optional(
      v.union(v.literal("instant"), v.literal("daily"), v.literal("weekly"))
    ),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", identity.tokenIdentifier))
      .unique();
    if (!currentUser || currentUser._id !== args.userId) {
      return { success: false, error: "Can only update your own profile" };
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.avatar !== undefined) updates.avatar = args.avatar;
    if (args.emailNotifications !== undefined)
      updates.emailNotifications = args.emailNotifications;
    if (args.notificationDigest !== undefined)
      updates.notificationDigest = args.notificationDigest;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.userId, updates);
    }
    return { success: true };
  },
});

/**
 * Get full profile for a specific user (including notification preferences).
 */
export const getUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      emailNotifications: user.emailNotifications ?? true,
      notificationDigest: user.notificationDigest ?? "instant",
      notificationPreferences: user.notificationPreferences ?? {
        proposalAccepted: true,
        proposalRejected: true,
        proposalViewed: true,
        engagementLetterSigned: true,
        approvalRequired: true,
        workPlanDue: true,
      },
    };
  },
});

/**
 * Save per-event notification preferences for the authenticated user.
 */
export const updateNotificationPreferences = mutation({
  args: {
    userId: v.id("users"),
    notificationPreferences: v.object({
      proposalAccepted: v.optional(v.boolean()),
      proposalRejected: v.optional(v.boolean()),
      proposalViewed: v.optional(v.boolean()),
      engagementLetterSigned: v.optional(v.boolean()),
      approvalRequired: v.optional(v.boolean()),
      workPlanDue: v.optional(v.boolean()),
    }),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Not authenticated" };
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", identity.tokenIdentifier))
      .unique();
    if (!currentUser || currentUser._id !== args.userId) {
      return { success: false, error: "Can only update your own preferences" };
    }
    await ctx.db.patch(args.userId, {
      notificationPreferences: args.notificationPreferences,
    });
    return { success: true };
  },
});

/**
 * Get the current authenticated user (Clerk).
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // 1. Try by authUserId (Clerk ID)
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", identity.tokenIdentifier))
      .unique();

    if (user) {
      if (user.deactivatedAt) return null;
      return user;
    }

    // 2. Try by email (fallback for invited users)
    if (identity.email) {
      const email = identity.email; // Capture email for type safety
      const userByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (userByEmail?.deactivatedAt) return null;
      return userByEmail ?? null;
    }

    return null;
  },
});
