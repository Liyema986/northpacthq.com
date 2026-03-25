// convex/lib/auditLog.ts
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Audit log entry structure
 */
interface AuditLogEntry {
  firmId: Id<"firms">;
  userId: Id<"users">;
  entityType: string;
  entityId: Id<any>;
  action: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit entry
 */
export async function logAuditEntry(
  ctx: MutationCtx,
  entry: AuditLogEntry
): Promise<void> {
  await ctx.db.insert("activities", {
    firmId: entry.firmId,
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    metadata: entry.metadata || {},
    timestamp: Date.now(),
  });
}

/**
 * Common audit actions
 */
export const AuditActions = {
  // Proposals
  PROPOSAL_CREATED: "proposal.created",
  PROPOSAL_UPDATED: "proposal.updated",
  PROPOSAL_SENT: "proposal.sent",
  PROPOSAL_VIEWED: "proposal.viewed",
  PROPOSAL_ACCEPTED: "proposal.accepted",
  PROPOSAL_REJECTED: "proposal.rejected",
  PROPOSAL_DELETED: "proposal.deleted",

  // Approvals
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_APPROVED: "approval.approved",
  APPROVAL_REJECTED: "approval.rejected",

  // Engagement Letters
  LETTER_CREATED: "letter.created",
  LETTER_SENT: "letter.sent",
  LETTER_SIGNED: "letter.signed",

  // Users
  USER_INVITED: "user.invited",
  USER_ROLE_CHANGED: "user.role_changed",
  USER_REMOVED: "user.removed",
  USER_DEACTIVATED: "user.deactivated",
  USER_ACTIVATED: "user.activated",
  USER_PROFILE_UPDATED: "user.profile_updated",

  // Clients
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
  CLIENT_DELETED: "client.deleted",

  // Services
  SERVICE_CREATED: "service.created",
  SERVICE_UPDATED: "service.updated",
  SERVICE_DELETED: "service.deleted",

  // Templates
  TEMPLATE_CREATED: "template.created",
  TEMPLATE_UPDATED: "template.updated",
  TEMPLATE_DELETED: "template.deleted",

  // Authentication
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_PASSWORD_CHANGED: "auth.password_changed",
  AUTH_LOCKOUT: "auth.lockout",

  // Email
  EMAIL_SENT: "email.sent",
  EMAIL_BOUNCED: "email.bounced",
  EMAIL_OPENED: "email.opened",

  // PDF
  PDF_GENERATED: "pdf.generated",
  PDF_DOWNLOADED: "pdf.downloaded",

  // Settings
  SETTINGS_UPDATED: "settings.updated",
  FIRM_UPDATED: "firm.updated",
} as const;

/**
 * Entity types for audit logs
 */
export const EntityTypes = {
  PROPOSAL: "proposal",
  CLIENT: "client",
  SERVICE: "service",
  USER: "user",
  FIRM: "firm",
  TEMPLATE: "template",
  APPROVAL: "approval",
  LETTER: "engagement-letter",
  EMAIL: "email",
  PDF: "pdf",
} as const;
