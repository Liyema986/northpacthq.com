import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Define the 5 roles and their permission levels
export type UserRole = "owner" | "admin" | "senior" | "staff" | "view-only";

// Permission matrix based on PRD requirements
export const ROLE_PERMISSIONS = {
  owner: {
    // Full access to everything
    canManageFirm: true,
    canManageBilling: true,
    canManageUsers: true,
    canManageTemplates: true,
    canEditPricing: true,
    canApproveProposals: true,
    canCreateProposals: true,
    canSendProposals: true,
    canViewProposals: true,
    canManageClients: true,
    canViewClients: true,
    canDeleteRecords: true,
    canViewReports: true,
  },
  admin: {
    // Can manage templates and clients, but not billing
    canManageFirm: false,
    canManageBilling: false,
    canManageUsers: true,
    canManageTemplates: true,
    canEditPricing: true,
    canApproveProposals: true,
    canCreateProposals: true,
    canSendProposals: true,
    canViewProposals: true,
    canManageClients: true,
    canViewClients: true,
    canDeleteRecords: true,
    canViewReports: true,
  },
  senior: {
    // Can approve and edit pricing
    canManageFirm: false,
    canManageBilling: false,
    canManageUsers: false,
    canManageTemplates: false,
    canEditPricing: true,
    canApproveProposals: true,
    canCreateProposals: true,
    canSendProposals: true,
    canViewProposals: true,
    canManageClients: true,
    canViewClients: true,
    canDeleteRecords: false,
    canViewReports: true,
  },
  staff: {
    // Can create and send proposals only
    canManageFirm: false,
    canManageBilling: false,
    canManageUsers: false,
    canManageTemplates: false,
    canEditPricing: false,
    canApproveProposals: false,
    canCreateProposals: true,
    canSendProposals: true,
    canViewProposals: true,
    canManageClients: true,
    canViewClients: true,
    canDeleteRecords: false,
    canViewReports: false,
  },
  "view-only": {
    // Read-only access
    canManageFirm: false,
    canManageBilling: false,
    canManageUsers: false,
    canManageTemplates: false,
    canEditPricing: false,
    canApproveProposals: false,
    canCreateProposals: false,
    canSendProposals: false,
    canViewProposals: true,
    canManageClients: false,
    canViewClients: true,
    canDeleteRecords: false,
    canViewReports: false,
  },
} as const;

export type Permission = keyof typeof ROLE_PERMISSIONS.owner;

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: UserRole): Record<Permission, boolean> {
  return ROLE_PERMISSIONS[role];
}

/**
 * Verify user has access to a specific firm (Row-Level Security).
 * All queries/mutations should use this to ensure data isolation.
 */
export async function verifyFirmAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  firmId: Id<"firms">
): Promise<{ user: Doc<"users">; firm: Doc<"firms"> }> {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.firmId !== firmId) {
    throw new Error("Access denied: User does not belong to this firm");
  }

  const firm = await ctx.db.get(firmId);
  if (!firm) {
    throw new Error("Firm not found");
  }

  return { user, firm };
}

/**
 * Get user and verify they exist.
 */
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"users">> {
  const user = await ctx.db.get(userId);
  if (!user) {
    // Log more context for debugging
    console.error("User not found:", {
      userId,
      timestamp: new Date().toISOString(),
      context: "getAuthenticatedUser"
    });
    throw new Error(`User not found: ${userId}. Please sign out and sign back in.`);
  }
  return user;
}

/**
 * Check if user has a specific permission for their role.
 */
export async function checkPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  permission: Permission
): Promise<boolean> {
  const user = await getAuthenticatedUser(ctx, userId);
  return hasPermission(user.role, permission);
}

/**
 * Require a specific permission - throws if not granted.
 * If the user is the only member of their firm, they are treated as having permission
 * (avoids blocking solo users when role is staff/view-only by mistake).
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  permission: Permission
): Promise<Doc<"users">> {
  const user = await getAuthenticatedUser(ctx, userId);
  if (hasPermission(user.role, permission)) {
    return user;
  }
  // Fallback: sole member of firm is allowed (e.g. creator with wrong role)
  const firmUsers = await ctx.db
    .query("users")
    .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
    .collect();
  if (firmUsers.length === 1 && firmUsers[0]._id === userId) {
    return user;
  }
  throw new Error(`Access denied: ${permission} permission required`);
}

/**
 * Get user's firm ID (for row-level filtering).
 */
export async function getUserFirmId(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Id<"firms">> {
  const user = await getAuthenticatedUser(ctx, userId);
  return user.firmId;
}

/**
 * Safely get user's firm ID - returns null if user doesn't exist.
 * Use this for queries that should return empty results instead of throwing.
 */
export async function getUserFirmIdSafe(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Id<"firms"> | null> {
  const user = await ctx.db.get(userId);
  if (!user) {
    console.warn("User not found for safe firm ID lookup:", userId);
    return null;
  }
  return user.firmId;
}

/**
 * Create a firm-scoped query helper.
 * Returns the firmId that should be used for all queries.
 */
export async function withFirmScope(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<{
  firmId: Id<"firms">;
  user: Doc<"users">;
  hasPermission: (permission: Permission) => boolean;
}> {
  const user = await getAuthenticatedUser(ctx, userId);
  return {
    firmId: user.firmId,
    user,
    hasPermission: (permission: Permission) => hasPermission(user.role, permission),
  };
}
