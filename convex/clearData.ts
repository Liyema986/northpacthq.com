/**
 * DANGER: Clears ALL data from all Convex tables.
 *
 * Use from the Convex Dashboard: Functions → clearData → clearAllData → Run
 *
 * Note: _storage (uploaded files) is NOT cleared by this mutation.
 * Cascading: Tables are cleared in dependency order to avoid orphan references.
 */

import { action, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { TableNames } from "./_generated/dataModel";
import { requirePermission } from "./lib/permissions";

const TABLES: TableNames[] = [
  // Auth tables (clear first - sessions, tokens, etc.)
  "authVerificationCodes",
  "authVerifiers",
  "authRefreshTokens",
  "authSessions",
  "authAccounts",
  "authRateLimits",
  // Child/reference tables
  "proposalViews",
  "proposalAcceptSessions",
  "signingSessions",
  "presence",
  "approvalRequests",
  "emails",
  "notifications",
  "engagementLetters",
  "proposalVersions",
  "documentVersions",
  "activities",
  "documents",
  "proposals",
  "letterTemplates",
  "proposalTemplates",
  "packageTemplates",
  "services",
  "serviceSections",
  "clients",
  "integrationSyncLogs",
  "integrationAutomations",
  "firmIntegrations",
  "integrationConnections",
  "pricingToolSettings",
  // Users & firms last (parents)
  "users",
  "firms",
] as const;

/** Internal mutation: deletes one batch and stays under the read limit. */
export const _deleteBatch = internalMutation({
  args: { batchSize: v.number() },
  handler: async (ctx, args) => {
    const results: Record<string, number> = {};
    let totalDeleted = 0;
    let remaining = args.batchSize;

    for (const tableName of TABLES) {
      if (remaining <= 0) break;
      const docs = await ctx.db.query(tableName).take(remaining);
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      if (docs.length > 0) {
        results[tableName] = docs.length;
        totalDeleted += docs.length;
        remaining -= docs.length;
      }
    }

    return { results, totalDeleted };
  },
});

/**
 * One-click nuke. Run once — it loops the batched deletes internally.
 */
export const clearAllData = action({
  args: {},
  handler: async (ctx) => {
    const BATCH = 500;
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { results, totalDeleted } = await ctx.runMutation(
        internal.clearData._deleteBatch,
        { batchSize: BATCH },
      );
      if (totalDeleted === 0) break;

      grandTotal += totalDeleted;
      for (const [table, count] of Object.entries(results)) {
        totals[table] = (totals[table] ?? 0) + count;
      }
    }

    return {
      message: "All table data cleared successfully.",
      counts: totals,
      totalDeleted: grandTotal,
    };
  },
});

/**
 * Clear clients (contacts) for the current firm.
 *
 * CRITICAL SAFETY: This mutation ONLY deletes rows from our Convex "clients" table.
 * - Does NOT call any Xero API
 * - Does NOT modify integrationConnections, integrationSyncLogs, or any Xero-related tables
 * - Does NOT affect Xero's cloud data in any way
 * Xero contacts, company data, and accounting records remain completely untouched.
 */
export const clearClientsForFirm = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    deleted: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageClients");
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    for (const doc of clients) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: clients.length };
  },
});
