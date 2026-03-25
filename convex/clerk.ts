import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

/**
 * Clerk webhook handler - syncs users from Clerk to Convex
 * Set this up in Clerk Dashboard → Webhooks → Add Endpoint
 * URL: https://your-convex-site.convex.site/clerk-webhook
 * Events: user.created, user.updated
 */
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
