import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation to sync a Clerk user to Convex users table.
 * Called by Clerk webhook or client-side on first sign-in.
 */
export const syncClerkUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatar: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
    firmId: v.id("firms"),
    isNew: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user already exists by Clerk ID
    let user = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", args.clerkUserId))
      .unique();

    if (user) {
      // Update existing user's info
      await ctx.db.patch(user._id, {
        name: args.name,
        email: args.email.toLowerCase(),
        avatar: args.avatar,
        lastActiveAt: now,
      });

      const firm = await ctx.db.get(user.firmId);
      return {
        userId: user._id,
        firmId: user.firmId,
        isNew: false,
      };
    }

    // Check if user exists by email (invited user without authUserId)
    user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();

    if (user) {
      // Link existing email user to Clerk account
      await ctx.db.patch(user._id, {
        authUserId: args.clerkUserId,
        name: args.name,
        avatar: args.avatar,
        lastActiveAt: now,
        inviteToken: undefined,
        inviteExpiresAt: undefined,
      });

      return {
        userId: user._id,
        firmId: user.firmId,
        isNew: false,
      };
    }

    // New user - create firm and user
    const firmId = await ctx.db.insert("firms", {
      name: `${args.name}'s Firm`,
      brandColors: {
        primary: "#2563EB",
        secondary: "#10B981",
      },
      billingEmail: args.email.toLowerCase(),
      subscriptionStatus: "trial",
      subscriptionPlan: "starter",
      jurisdiction: "ZA",
      currency: "ZAR",
      trialEndsAt: now + 14 * 24 * 60 * 60 * 1000, // 14-day trial
      createdAt: now,
      updatedAt: now,
    });

    // Create user as owner
    const userId = await ctx.db.insert("users", {
      firmId,
      authUserId: args.clerkUserId,
      email: args.email.toLowerCase(),
      name: args.name,
      role: "owner",
      avatar: args.avatar,
      lastActiveAt: now,
      createdAt: now,
      loginAttempts: 0,
    });

    return {
      userId,
      firmId,
      isNew: true,
    };
  },
});

/**
 * Internal mutation to delete Convex user when Clerk user is deleted.
 * Called from Clerk webhook on user.deleted.
 */
export const deleteUserByClerkId = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", args.clerkUserId))
      .unique();
    if (user) {
      await ctx.db.delete(user._id);
    }
    return null;
  },
});

/**
 * Public mutation for client-side user sync.
 * Called on first app load after Clerk sign-in to ensure user exists.
 */
export const ensureCurrentUser = mutation({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      firmId: v.id("firms"),
      isNew: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const clerkUserId = identity.tokenIdentifier;
    const email = identity.email || "";
    
    // Construct full name from Clerk identity
    const firstName = identity.givenName || "";
    const lastName = identity.familyName || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const name = identity.name || fullName || "User";
    
    const avatar = identity.pictureUrl;

    // Check if user exists
    let user = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", clerkUserId))
      .unique();

    if (user) {
      // Update last active
      await ctx.db.patch(user._id, {
        lastActiveAt: Date.now(),
      });

      return {
        userId: user._id,
        firmId: user.firmId,
        isNew: false,
      };
    }

    // Check by email
    if (email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
        .unique();

      if (user) {
        // Link to Clerk
        await ctx.db.patch(user._id, {
          authUserId: clerkUserId,
          name,
          avatar,
          lastActiveAt: Date.now(),
        });

        return {
          userId: user._id,
          firmId: user.firmId,
          isNew: false,
        };
      }
    }

    // Create new user and firm
    const now = Date.now();
    
    const firmId = await ctx.db.insert("firms", {
      name: `${name}'s Firm`,
      brandColors: {
        primary: "#2563EB",
        secondary: "#10B981",
      },
      billingEmail: email.toLowerCase(),
      subscriptionStatus: "trial",
      subscriptionPlan: "starter",
      jurisdiction: "ZA",
      currency: "ZAR",
      trialEndsAt: now + 14 * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });

    const userId = await ctx.db.insert("users", {
      firmId,
      authUserId: clerkUserId,
      email: email.toLowerCase(),
      name,
      role: "owner",
      avatar,
      lastActiveAt: now,
      createdAt: now,
      loginAttempts: 0,
    });

    return {
      userId,
      firmId,
      isNew: true,
    };
  },
});
