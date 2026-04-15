// convex/stripe.ts
// Stripe Checkout and Customer Portal actions for subscription billing.
// Requires: STRIPE_SECRET_KEY and NEXT_PUBLIC_SITE_URL in Convex env.

import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import Stripe from "stripe";

/**
 * Map plan key + billing period → Stripe Price ID.
 * Set these in Convex env or replace with your actual Price IDs from Stripe Dashboard.
 */
const getPriceId = (
  planId: "professional" | "enterprise",
  billingPeriod: "monthly" | "annual"
): string => {
  const prices: Record<string, string> = {
    professional_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    professional_annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
    enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "",
    enterprise_annual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL ?? "",
  };
  const key = `${planId}_${billingPeriod}`;
  const priceId = prices[key];
  if (!priceId) {
    throw new Error(
      `Stripe Price not configured for ${planId} ${billingPeriod}. Set STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL, etc. in Convex env.`
    );
  }
  return priceId;
};

/**
 * Create a Stripe Checkout session for subscription.
 * Returns the session URL to redirect the user.
 */
export const createCheckoutSession = action({
  args: {
    userId: v.id("users"),
    firmId: v.id("firms"),
    planId: v.union(v.literal("professional"), v.literal("enterprise")),
    billingPeriod: v.union(v.literal("monthly"), v.literal("annual")),
  },
  returns: v.object({
    url: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!secretKey || !siteUrl) {
      return {
        error:
          "Stripe or site URL not configured. Set STRIPE_SECRET_KEY and NEXT_PUBLIC_SITE_URL in Convex env.",
      };
    }

    const stripe = new Stripe(secretKey);

    // Get firm for billing email and existing Stripe customer
    const firm = await ctx.runQuery(api.authFunctions.getFirmForUser, {
      userId: args.userId,
    });
    if (!firm) {
      return { error: "Firm not found" };
    }
    if (firm._id !== args.firmId) {
      return { error: "Access denied" };
    }

    const priceId = getPriceId(args.planId, args.billingPeriod);
    const successUrl = `${siteUrl.replace(/\/$/, "")}/settings?tab=billing&success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl.replace(/\/$/, "")}/settings?tab=billing&canceled=true`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: args.firmId,
      metadata: {
        firmId: args.firmId,
        planId: args.planId,
        billingPeriod: args.billingPeriod,
      },
      customer_email: firm.billingEmail,
      subscription_data: {
        metadata: {
          firmId: args.firmId,
          planId: args.planId,
        },
      },
    };

    // Use existing Stripe customer if present
    if (firm.stripeCustomerId) {
      sessionParams.customer = firm.stripeCustomerId;
      delete sessionParams.customer_email;
    }

    try {
      const session = await stripe.checkout.sessions.create(sessionParams);
      return { url: session.url ?? undefined };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe checkout failed";
      return { error: msg };
    }
  },
});

/**
 * Create a Stripe Customer Portal session for managing subscription.
 * Returns the portal URL to redirect the user.
 */
export const createCustomerPortalSession = action({
  args: {
    userId: v.id("users"),
    firmId: v.id("firms"),
  },
  returns: v.object({
    url: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ url?: string; error?: string }> => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!secretKey || !siteUrl) {
      return {
        error:
          "Stripe or site URL not configured. Set STRIPE_SECRET_KEY and NEXT_PUBLIC_SITE_URL in Convex env.",
      };
    }

    const stripe = new Stripe(secretKey);

    const firm: { _id: Id<"firms">; stripeCustomerId?: string } | null = await ctx.runQuery(api.authFunctions.getFirmForUser, {
      userId: args.userId,
    });
    if (!firm) {
      return { error: "Firm not found" };
    }
    if (firm._id !== args.firmId) {
      return { error: "Access denied" };
    }

    if (!firm.stripeCustomerId) {
      return {
        error: "No Stripe customer linked. Subscribe to a paid plan first.",
      };
    }

    const returnUrl = `${siteUrl.replace(/\/$/, "")}/settings?tab=billing`;

    try {
      const session: Stripe.BillingPortal.Session = await stripe.billingPortal.sessions.create({
        customer: firm.stripeCustomerId,
        return_url: returnUrl,
      });
      return { url: session.url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe portal failed";
      return { error: msg };
    }
  },
});

/**
 * Cancel the active Stripe subscription and downgrade to Starter.
 */
export const cancelSubscription = action({
  args: {
    userId: v.id("users"),
    firmId: v.id("firms"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return { success: false, error: "Stripe not configured" };
    }

    const firm = await ctx.runQuery(api.authFunctions.getFirmForUser, {
      userId: args.userId,
    });
    if (!firm || firm._id !== args.firmId) {
      return { success: false, error: "Access denied" };
    }

    if (!firm.stripeSubscriptionId) {
      // No active subscription — just reset the plan locally
      await ctx.runMutation(internal.stripe.applyDowngrade, { firmId: args.firmId });
      return { success: true };
    }

    const stripe = new Stripe(secretKey);

    try {
      await stripe.subscriptions.cancel(firm.stripeSubscriptionId);
      await ctx.runMutation(internal.stripe.applyDowngrade, { firmId: args.firmId });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel subscription";
      return { success: false, error: msg };
    }
  },
});

/**
 * Internal mutation to downgrade firm to Starter plan.
 */
export const applyDowngrade = internalMutation({
  args: { firmId: v.id("firms") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.firmId, {
      subscriptionPlan: "starter",
      subscriptionStatus: "cancelled",
      stripeSubscriptionId: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to update firm subscription after verifying a checkout session.
 */
export const applyCheckoutResult = internalMutation({
  args: {
    firmId: v.id("firms"),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    subscriptionPlan: v.union(v.literal("professional"), v.literal("enterprise")),
    subscriptionStatus: v.union(v.literal("active"), v.literal("trial")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.firmId, {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      subscriptionPlan: args.subscriptionPlan,
      subscriptionStatus: args.subscriptionStatus,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Verify a completed Stripe Checkout session and activate the subscription.
 * Called from the client after returning from Stripe with a session_id.
 */
export const verifyCheckoutSession = action({
  args: {
    userId: v.id("users"),
    firmId: v.id("firms"),
    sessionId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return { success: false, error: "Stripe not configured" };
    }

    const firm = await ctx.runQuery(api.authFunctions.getFirmForUser, {
      userId: args.userId,
    });
    if (!firm || firm._id !== args.firmId) {
      return { success: false, error: "Access denied" };
    }

    const stripe = new Stripe(secretKey);

    try {
      const session = await stripe.checkout.sessions.retrieve(args.sessionId);

      // Verify this session belongs to this firm
      if (session.client_reference_id !== args.firmId && session.metadata?.firmId !== args.firmId) {
        return { success: false, error: "Session does not match firm" };
      }

      if (session.payment_status !== "paid") {
        return { success: false, error: "Payment not completed" };
      }

      const planId = (session.metadata?.planId === "enterprise" ? "enterprise" : "professional") as "professional" | "enterprise";
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? "";
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? "";

      if (!customerId || !subscriptionId) {
        return { success: false, error: "Missing Stripe IDs" };
      }

      await ctx.runMutation(internal.stripe.applyCheckoutResult, {
        firmId: args.firmId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionPlan: planId,
        subscriptionStatus: "active",
      });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      return { success: false, error: msg };
    }
  },
});
