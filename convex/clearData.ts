/**
 * DANGER: Clears ALL data from all Convex tables.
 *
 * Use from the Convex Dashboard: Functions → clearData → clearAllData → Run
 *
 * Note: _storage (uploaded files) is NOT cleared by this mutation.
 * Cascading: Tables are cleared in dependency order to avoid orphan references.
 */

import { mutation } from "./_generated/server";
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

export const clearAllData = mutation(async (ctx) => {
  const results: Record<string, number> = {};

  for (const tableName of TABLES) {
    const docs = await ctx.db.query(tableName).collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    results[tableName] = docs.length;
  }

  return {
    message: "All table data cleared successfully.",
    counts: results,
    totalDeleted: Object.values(results).reduce((a, b) => a + b, 0),
  };
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
