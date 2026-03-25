/**
 * Stub document/version API for DocumentsTable UI.
 * Returns empty data until full document workflow is implemented.
 */
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserFirmIdSafe } from "./lib/permissions";

export const getDocumentVersions = query({
  args: {
    userId: v.id("users"),
    documentId: v.id("documents"),
  },
  returns: v.array(
    v.object({
      _id: v.id("documentVersions"),
      documentNumber: v.string(),
      versionNumber: v.string(),
      clientName: v.string(),
      status: v.string(),
      total: v.number(),
      currency: v.string(),
      createdByName: v.union(v.string(), v.null()),
      createdAt: v.number(),
    })
  ),
  handler: async (_ctx, _args) => {
    // Stub: no document versions until feature is fully implemented
    return [];
  },
});

export const deleteDocumentVersion = mutation({
  args: {
    userId: v.id("users"),
    versionId: v.id("documentVersions"),
  },
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return;
    // Stub: no-op until document versioning is implemented
  },
});
