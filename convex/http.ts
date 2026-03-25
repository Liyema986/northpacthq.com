import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { Id } from "./_generated/dataModel";
import { Webhook } from "svix";

const http = httpRouter();

// Auth routes for OAuth callbacks, etc.
auth.addHttpRoutes(http);

// ===== CLERK WEBHOOK =====
// Syncs Clerk users to Convex users table
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Get the headers and body
    const svix_id = request.headers.get("svix-id");
    const svix_timestamp = request.headers.get("svix-timestamp");
    const svix_signature = request.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    // Get the raw body
    const body = await request.text();

    // Verify the webhook signature
    const wh = new Webhook(webhookSecret);
    let evt: any;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as any;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    // Handle the webhook event
    const eventType = evt.type;
    
    if (eventType === "user.created" || eventType === "user.updated") {
      const userData = evt.data;
      
      await ctx.runMutation(internal.clerkSync.syncClerkUser, {
        clerkUserId: userData.id,
        email: userData.email_addresses?.[0]?.email_address || "",
        name: `${userData.first_name || ""} ${userData.last_name || ""}`.trim() || "User",
        avatar: userData.image_url,
      });
    }

    if (eventType === "user.deleted") {
      const userData = evt.data;
      if (userData?.id) {
        await ctx.runMutation(internal.clerkSync.deleteUserByClerkId, {
          clerkUserId: userData.id,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Xero OAuth: store tokens after callback (called from Next.js API route)
http.route({
  path: "/api/integrations/xero/store-tokens",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.INTEGRATION_CALLBACK_SECRET;
    if (!expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const authHeader = request.headers.get("X-Integration-Secret");
    if (authHeader !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let body: {
      firmId?: string;
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: number;
      tenantId?: string;
      tenantName?: string;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { firmId, accessToken, refreshToken, expiresAt, tenantId, tenantName } = body;
    if (
      !firmId ||
      !accessToken ||
      !refreshToken ||
      typeof expiresAt !== "number"
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      await ctx.runMutation(internal.integrations.setXeroConnection, {
        firmId: firmId as Id<"firms">,
        accessToken,
        refreshToken,
        expiresAt,
        tenantId: tenantId ?? undefined,
        tenantName: tenantName ?? undefined,
      });
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      console.error("setXeroConnection failed:", e);
      return new Response(
        JSON.stringify({ error: "Failed to store connection" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Resend webhook for email events (opened, bounced, etc.)
// Resend uses Svix for webhook signing - verify signature with RESEND_WEBHOOK_SECRET
http.route({
  path: "/api/webhooks/resend",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Resend webhook secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const svix_id = request.headers.get("svix-id");
    const svix_timestamp = request.headers.get("svix-timestamp");
    const svix_signature = request.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response(
        JSON.stringify({ error: "Missing svix headers" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const rawBody = await request.text();
    const wh = new Webhook(webhookSecret);
    let evt: { type?: string; data?: { email_id?: string } };

    try {
      evt = wh.verify(rawBody, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as { type?: string; data?: { email_id?: string } };
    } catch (err) {
      console.error("Resend webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const eventType = evt.type;
      const emailId = evt.data?.email_id;

      if (!eventType || !emailId) {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Handle email.opened - update our emails table and proposal viewedAt
      if (eventType === "email.opened") {
        await ctx.runMutation(
          internal.emailHelpers.updateEmailByResendIdInternal,
          { resendId: emailId, status: "opened" }
        );
      }

      // Handle email.bounced, email.failed - mark as failed (optional)
      if (eventType === "email.bounced" || eventType === "email.failed") {
        await ctx.runMutation(
          internal.emailHelpers.updateEmailByResendIdInternal,
          { resendId: emailId, status: "failed" }
        );
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Resend webhook error:", err);
      return new Response(
        JSON.stringify({ error: "Webhook processing failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Redirect /proposals/view/<token> to the Next.js app (must use pathPrefix — Convex has no :param matching on exact path)
http.route({
  pathPrefix: "/proposals/view/",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const token = url.pathname.replace(/^\/proposals\/view\//, "").split("/")[0] || "";
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) {
      return new Response(
        `NorthPact: NEXT_PUBLIC_SITE_URL is not configured. Set it in Convex: npx convex env set NEXT_PUBLIC_SITE_URL https://your-app.vercel.app`,
        { status: 503, headers: { "Content-Type": "text/plain" } }
      );
    }
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }
    const redirectUrl = `${baseUrl.replace(/\/$/, "")}/proposals/view/${token}`;
    return Response.redirect(redirectUrl, 302);
  }),
});

// ===== STRIPE WEBHOOK =====
http.route({
  path: "/api/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe webhook secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const rawBody = await request.text();
    let event: { type: string; data?: { object?: Record<string, unknown> } };

    try {
      const Stripe = (await import("stripe")).default;
      const constructed = Stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      ) as unknown;
      event = constructed as { type: string; data?: { object?: Record<string, unknown> } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid signature";
      console.error("Stripe webhook signature verification failed:", msg);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const eventType = event.type;
    const obj = event.data?.object;
    if (!obj) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: Record<string, unknown>;

    if (eventType === "checkout.session.completed") {
      payload = {
        customer: obj.customer,
        subscription: obj.subscription,
        metadata: obj.metadata,
        client_reference_id: obj.client_reference_id,
      };
    } else if (
      eventType === "customer.subscription.created" ||
      eventType === "customer.subscription.updated" ||
      eventType === "customer.subscription.deleted"
    ) {
      payload = {
        customer: obj.customer,
        subscription: obj.id,
        status: obj.status,
        metadata: obj.metadata,
        items: obj.items,
      };
    } else {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await ctx.runMutation(internal.stripeWebhook.handleStripeWebhook, {
        eventType,
        data: payload,
      });
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Stripe webhook handler error:", err);
      return new Response(
        JSON.stringify({ error: "Webhook processing failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Tracking pixel endpoint for email opens (pathPrefix — not /api/track-open/:id exact)
http.route({
  pathPrefix: "/api/track-open/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const pathname = new URL(request.url).pathname;
    const proposalId = pathname.replace(/^\/api\/track-open\//, "").split("/")[0] as Id<"proposals">;

    try {
      // Track the open event
      await ctx.runAction(internal.email.trackProposalOpen, {
        proposalId,
      });
    } catch (error) {
      console.error("Error tracking proposal open:", error);
    }

    // Return a 1x1 transparent GIF
    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );

    return new Response(pixel, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  }),
});

export default http;
