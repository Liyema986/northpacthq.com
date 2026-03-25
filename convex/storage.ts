// convex/storage.ts
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get public URL for a stored file (e.g. logo, proposal PDF).
 */
export const getStorageUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
