// convex/signatures.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Generate a secure signing link for an engagement letter
 */
export const generateSigningLink = mutation({
  args: {
    userId: v.id("users"),
    letterId: v.id("engagementLetters"),
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get letter
    const letter = await ctx.db.get(args.letterId);
    if (!letter || letter.firmId !== user.firmId) {
      throw new Error("Letter not found");
    }

    // Generate unique token
    const token = generateSecureToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    // Create signing session
    const sessionId = await ctx.db.insert("signingSessions", {
      firmId: user.firmId,
      letterId: args.letterId,
      token,
      status: "pending",
      createdBy: args.userId,
      expiresAt,
      createdAt: Date.now(),
    });

    // Update letter status
    await ctx.db.patch(args.letterId, {
      status: "sent",
      sentAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      sessionId,
      token,
      signingUrl: `/sign/${token}`,
      expiresAt,
    };
  },
});

/**
 * Get signing session by token (for public signing page)
 */
export const getSigningSession = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("signingSessions")
      .filter((q) => q.eq(q.field("token"), args.token))
      .first();

    if (!session) {
      return { error: "Signing link not found" };
    }

    if (session.status === "signed") {
      const letter = await ctx.db.get(session.letterId);
      const firm = letter ? await ctx.db.get(letter.firmId) : null;
      const client = letter ? await ctx.db.get(letter.clientId) : null;
      const sigData = letter?.signatureData as { signerName?: string; signedAt?: number } | undefined;
      return {
        error: "already_signed",
        signedBy: sigData?.signerName ?? "Unknown",
        signedAt: session.signedAt ?? session._creationTime,
        letterNumber: letter?.letterNumber ?? "—",
        firmName: firm?.name ?? "Unknown Firm",
        clientName: client?.companyName ?? "Unknown Client",
      };
    }

    if (Date.now() > session.expiresAt) {
      return { error: "This signing link has expired" };
    }

    // Get letter
    const letter = await ctx.db.get(session.letterId);
    if (!letter) {
      return { error: "Document not found" };
    }

    // Get firm
    const firm = await ctx.db.get(letter.firmId);

    // Get client
    const client = await ctx.db.get(letter.clientId);

    return {
      session,
      letter: {
        content: letter.content,
        letterNumber: letter.letterNumber,
      },
      firmName: firm?.name || "Unknown Firm",
      clientName: client?.companyName || "Unknown Client",
    };
  },
});

/**
 * Submit signature
 */
export const submitSignature = mutation({
  args: {
    token: v.string(),
    signerName: v.string(),
    signatureImage: v.string(), // Base64 image data
    ipAddress: v.string(),
    userAgent: v.string(),
  },
  handler: async (ctx, args) => {
    // Get session
    const session = await ctx.db
      .query("signingSessions")
      .filter((q) => q.eq(q.field("token"), args.token))
      .first();

    if (!session) {
      throw new Error("Signing session not found");
    }

    if (session.status === "signed") {
      throw new Error("This document has already been signed");
    }

    if (Date.now() > session.expiresAt) {
      throw new Error("This signing link has expired");
    }

    const signedAt = Date.now();

    // Update session
    await ctx.db.patch(session._id, {
      status: "signed",
      signedAt,
    });

    // Update letter with signature data
    await ctx.db.patch(session.letterId, {
      status: "signed",
      signedAt,
      signatureData: {
        signerName: args.signerName,
        signatureImage: args.signatureImage,
        signedAt,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      },
      updatedAt: signedAt,
    });

    // Get letter for notification
    const letter = await ctx.db.get(session.letterId);

    // Log activity
    if (letter) {
      await ctx.db.insert("activities", {
        firmId: letter.firmId,
        userId: session.createdBy,
        entityType: "engagement-letter",
        entityId: session.letterId,
        action: "signed",
        metadata: {
          signerName: args.signerName,
          ipAddress: args.ipAddress,
          signedAt: new Date(signedAt).toISOString(),
        },
        timestamp: signedAt,
      });

      // Create notification for firm
      await ctx.db.insert("notifications", {
        firmId: letter.firmId,
        userId: session.createdBy,
        type: "proposal-accepted",
        title: "Document Signed!",
        message: `${args.signerName} has signed engagement letter ${letter.letterNumber}`,
        relatedId: session.letterId,
        relatedType: "engagement-letter",
        isRead: false,
        createdAt: signedAt,
      });

      // Email the firm to notify them of the signed letter
      await ctx.scheduler.runAfter(0, api.email.sendEngagementLetterSignedEmail, {
        letterId: session.letterId,
      });
    }

    return { success: true, signedAt };
  },
});

/**
 * List signing sessions for a firm
 */
export const listSigningSessions = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const sessions = await ctx.db
      .query("signingSessions")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .order("desc")
      .collect();

    // Enrich with letter data
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const letter = await ctx.db.get(session.letterId);
        const client = letter ? await ctx.db.get(letter.clientId) : null;
        return {
          ...session,
          letterNumber: letter?.letterNumber || "Unknown",
          clientName: client?.companyName || "Unknown",
        };
      })
    );

    return enrichedSessions;
  },
});

// Helper function to generate secure token
function generateSecureToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
