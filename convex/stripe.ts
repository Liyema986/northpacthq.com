// convex/stripe.ts
// Stripe Checkout and Customer Portal actions for subscription billing.
// Requires: STRIPE_SECRET_KEY and NEXT_PUBLIC_SITE_URL in Convex env.

import { action } from "./_generated/server";
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
    const successUrl = `${siteUrl.replace(/\/$/, "")}/settings?tab=pricing&success=true`;
    const cancelUrl = `${siteUrl.replace(/\/$/, "")}/settings?tab=pricing&canceled=true`;

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

    const returnUrl = `${siteUrl.replace(/\/$/, "")}/settings?tab=pricing`;

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
