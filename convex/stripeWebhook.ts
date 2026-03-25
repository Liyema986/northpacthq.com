// convex/stripeWebhook.ts
// Internal mutation to handle Stripe webhook events.
// Called from convex/http.ts after signature verification.

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type SubscriptionPlan = "starter" | "professional" | "enterprise";

/**
 * Map Stripe Price ID to plan key.
 * Uses metadata.plan on the subscription if available, otherwise price ID mapping.
 */
function priceToPlan(
  priceId: string | undefined,
  metadata?: { plan?: string }
): SubscriptionPlan {
  if (metadata?.plan && ["starter", "professional", "enterprise"].includes(metadata.plan)) {
    return metadata.plan as SubscriptionPlan;
  }
  // Fallback: map common Stripe price ID prefixes or env-configured IDs
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const proAnnual = process.env.STRIPE_PRICE_PRO_ANNUAL;
  const entMonthly = process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
  const entAnnual = process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL;
  if (priceId === proMonthly || priceId === proAnnual) return "professional";
  if (priceId === entMonthly || priceId === entAnnual) return "enterprise";
  return "professional"; // safe default if no match
}

/**
 * Handle Stripe webhook events.
 * Updates firms.subscriptionPlan, subscriptionStatus, stripeCustomerId, stripeSubscriptionId.
 */
export const handleStripeWebhook = internalMutation({
  args: {
    eventType: v.string(),
    // For checkout.session.completed: session object (customer, subscription, metadata)
    // For customer.subscription.*: subscription object (id→subscription, status, metadata, items)
    data: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { eventType, data } = args;

    if (eventType === "checkout.session.completed") {
      const firmId =
        (data.metadata?.firmId as string | undefined) ??
        (data.client_reference_id as string | undefined);
      const customerId = data.customer;
      const subscriptionId = data.subscription;

      if (!firmId || typeof firmId !== "string") return null;

      const planId = (data.metadata?.planId ?? "professional") as SubscriptionPlan;
      const updates: Record<string, unknown> = {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionPlan: planId,
        subscriptionStatus: "active",
        updatedAt: Date.now(),
      };
      await ctx.db.patch(firmId as Id<"firms">, updates);
      return null;
    }

    if (
      eventType === "customer.subscription.created" ||
      eventType === "customer.subscription.updated" ||
      eventType === "customer.subscription.deleted"
    ) {
      // For subscription events, data is the subscription object.
      // subscription field = subscription.id (passed by HTTP handler)
      const subscriptionId = data.subscription;
      const status = data.status;
      const metadata = data.metadata;
      const firmId = metadata?.firmId;

      if (!firmId || typeof firmId !== "string") return null;

      const planId = metadata?.planId
        ? (metadata.planId as SubscriptionPlan)
        : priceToPlan(
            data.items?.data?.[0]?.price?.id,
            { plan: metadata?.planId }
          );

      const subscriptionStatus =
        status === "active"
          ? "active"
          : status === "past_due"
            ? "past_due"
            : "cancelled";

      const updates: Record<string, unknown> = {
        stripeSubscriptionId: subscriptionId,
        subscriptionPlan: planId,
        subscriptionStatus,
        updatedAt: Date.now(),
      };
      if (eventType === "customer.subscription.deleted") {
        updates.subscriptionPlan = "starter";
        updates.subscriptionStatus = "cancelled";
        updates.stripeSubscriptionId = undefined;
      }
      await ctx.db.patch(firmId as Id<"firms">, updates);
      return null;
    }

    return null;
  },
});
