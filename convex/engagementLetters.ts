// convex/engagementLetters.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requirePermission, getUserFirmIdSafe } from "./lib/permissions";

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds HTML from Services catalogue: section intro (once per section when section changes)
 * plus each line item's serviceSchedule (engagement clause per service).
 */
async function buildEngagementClausesHtml(
  ctx: MutationCtx,
  proposal: Doc<"proposals">
): Promise<string> {
  const parts: string[] = [];
  let lastSectionKey: string | null = null;

  for (const row of proposal.services) {
    const svc = await ctx.db.get(row.serviceId);
    if (!svc) continue;

    const sectionKey = svc.sectionId ? String(svc.sectionId) : "__none__";

    if (sectionKey !== lastSectionKey) {
      lastSectionKey = sectionKey;
      if (svc.sectionId) {
        const sec = await ctx.db.get(svc.sectionId);
        const para = sec?.engagementParagraphHtml?.trim();
        if (sec && para) {
          parts.push(
            `<div style="margin-top:1em;"><h4 style="font-size:1.05em;margin:0 0 0.5em 0;">${escapeHtmlAttr(sec.name)}</h4><div>${para}</div></div>`
          );
        }
      }
    }

    const sched = svc.serviceSchedule?.trim();
    if (sched) {
      parts.push(
        `<div style="margin-top:0.75em;padding-left:0.65em;border-left:3px solid #C8A96E;"><strong>${escapeHtmlAttr(svc.name)}</strong><div>${sched}</div></div>`
      );
    }
  }

  if (parts.length === 0) return "";
  return `<div style="margin-top:1.25em;padding-top:1em;border-top:1px solid #e2e8f0;"><h3 style="font-size:1.1em;margin:0 0 0.75em 0;">Scope of services (detail)</h3>${parts.join("")}</div>`;
}

/**
 * Generate engagement letter from accepted proposal
 */
export const generateFromProposal = mutation({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get proposal
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal || proposal.firmId !== user.firmId) {
      throw new Error("Proposal not found");
    }

    // Get client
    const client = await ctx.db.get(proposal.clientId);
    if (!client) throw new Error("Client not found");

    // Get firm
    const firm = await ctx.db.get(user.firmId);
    if (!firm) throw new Error("Firm not found");

    // Determine primary service type from proposal
    const primaryService = proposal.services[0];
    const serviceType = determineServiceType(primaryService?.serviceName || "");

    // Find matching template
    const templates = await ctx.db
      .query("letterTemplates")
      .filter((q) => q.eq(q.field("jurisdiction"), firm.jurisdiction || "US"))
      .collect();

    let template = templates.find(
      (t) => t.serviceType === serviceType && t.isDefault
    );
    if (!template) {
      template = templates.find((t) => t.isDefault);
    }
    if (!template && templates.length > 0) {
      template = templates[0];
    }

    if (!template) {
      throw new Error("No engagement letter template found for this jurisdiction");
    }

    // Generate letter number
    const existingLetters = await ctx.db
      .query("engagementLetters")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    const letterNumber = `ENG-${new Date().getFullYear()}-${String(existingLetters.length + 1).padStart(3, "0")}`;

    const engagementClausesHtml = await buildEngagementClausesHtml(ctx, proposal);

    // Fill placeholders in template
    let content = fillPlaceholders(template.content, {
      firmName: firm.name,
      clientName: client.companyName,
      contactName: client.contactName,
      clientAddress: formatAddress(client),
      date: formatDate(Date.now()),
      proposalNumber: proposal.proposalNumber,
      proposalTitle: proposal.title,
      services: formatServices(proposal.services, firm.currency || "ZAR"),
      total: formatCurrency(proposal.total, firm.currency || "ZAR"),
      currency: firm.currency || "ZAR",
      validUntil: proposal.validUntil ? formatDate(proposal.validUntil) : "30 days from date above",
      jurisdiction: firm.jurisdiction || "US",
      engagementClauses: engagementClausesHtml,
    });

    if (!template.content.includes("{{engagementClauses}}") && engagementClausesHtml) {
      const once = content.replace(/<\/ul>/i, `</ul>${engagementClausesHtml}`);
      content = once !== content ? once : `${content}${engagementClausesHtml}`;
    }

    // Create engagement letter
    const letterId = await ctx.db.insert("engagementLetters", {
      firmId: user.firmId,
      proposalId: args.proposalId,
      clientId: proposal.clientId,
      letterNumber,
      templateId: template._id,
      jurisdiction: firm.jurisdiction || "US",
      serviceType,
      content,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "engagement-letter",
      entityId: letterId,
      action: "created",
      metadata: {
        letterNumber,
        proposalId: args.proposalId,
      },
      timestamp: Date.now(),
    });

    return { success: true, letterId, letterNumber };
  },
});

/**
 * Get engagement letter by ID
 */
export const getLetter = query({
  args: {
    userId: v.id("users"),
    letterId: v.id("engagementLetters"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const letter = await ctx.db.get(args.letterId);
    if (!letter || letter.firmId !== user.firmId) {
      return null;
    }

    // Get related data
    const proposal = await ctx.db.get(letter.proposalId);
    const client = await ctx.db.get(letter.clientId);

    return {
      ...letter,
      proposalTitle: proposal?.title || "Unknown",
      proposalNumber: proposal?.proposalNumber || "Unknown",
      clientName: client?.companyName || "Unknown",
    };
  },
});

/**
 * Get engagement letter for a proposal
 */
export const getLetterByProposal = query({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const letter = await ctx.db
      .query("engagementLetters")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .first();

    if (!letter || letter.firmId !== user.firmId) {
      return null;
    }

    return letter;
  },
});

/**
 * List all engagement letters
 */
export const listLetters = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    let letters = await ctx.db
      .query("engagementLetters")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .order("desc")
      .collect();

    if (args.status) {
      letters = letters.filter((l) => l.status === args.status);
    }

    // Enrich with client data
    const enrichedLetters = await Promise.all(
      letters.map(async (letter) => {
        const client = await ctx.db.get(letter.clientId);
        const proposal = await ctx.db.get(letter.proposalId);
        return {
          ...letter,
          clientName: client?.companyName || "Unknown",
          proposalTitle: proposal?.title || "Unknown",
        };
      })
    );

    return enrichedLetters;
  },
});

/**
 * Update engagement letter content
 */
export const updateLetter = mutation({
  args: {
    userId: v.id("users"),
    letterId: v.id("engagementLetters"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const letter = await ctx.db.get(args.letterId);
    if (!letter || letter.firmId !== user.firmId) {
      throw new Error("Letter not found");
    }

    await ctx.db.patch(args.letterId, {
      content: args.content,
      updatedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "engagement-letter",
      entityId: args.letterId,
      action: "edited",
      metadata: {
        warning: "Manual edits may affect compliance",
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Send engagement letter for signature
 */
export const sendForSignature = mutation({
  args: {
    userId: v.id("users"),
    letterId: v.id("engagementLetters"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const letter = await ctx.db.get(args.letterId);
    if (!letter || letter.firmId !== user.firmId) {
      throw new Error("Letter not found");
    }

    await ctx.db.patch(args.letterId, {
      status: "sent",
      sentAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create notification for client
    const client = await ctx.db.get(letter.clientId);

    // Log activity
    await ctx.db.insert("activities", {
      firmId: user.firmId,
      userId: args.userId,
      entityType: "engagement-letter",
      entityId: args.letterId,
      action: "sent",
      metadata: {
        clientEmail: client?.email || "Unknown",
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/** Built-in default engagement letter HTML template (used when no DB templates exist). */
const DEFAULT_ENGAGEMENT_LETTER_TEMPLATE = `
<div style="font-family: Georgia, serif; max-width: 700px; margin: 0 auto; line-height: 1.6; color: #333;">
  <p style="margin-bottom: 1em;">{{date}}</p>
  <p style="margin-bottom: 1em;"><strong>{{clientName}}</strong><br/>Attn: {{contactName}}<br/>{{clientAddress}}</p>
  <p style="margin-bottom: 1em;"><strong>RE: Letter of Engagement – {{proposalTitle}}</strong></p>
  <p style="margin-bottom: 1em;">Dear {{contactName}},</p>
  <p style="margin-bottom: 1em;">Following our proposal ({{proposalNumber}}), this letter confirms the terms of our engagement for the services outlined below.</p>
  <h3 style="font-size: 1.1em; margin-top: 1.5em;">Services</h3>
  <ul style="margin-bottom: 1em;">{{services}}</ul>
  {{engagementClauses}}
  <p style="margin-bottom: 1em;"><strong>Total: {{total}} ({{currency}})</strong></p>
  <p style="margin-bottom: 1em;">This proposal is valid until {{validUntil}}.</p>
  <h3 style="font-size: 1.1em; margin-top: 1.5em;">Terms</h3>
  <p style="margin-bottom: 1em;">By accepting this engagement, you confirm that you have read and agree to the terms set out above and in the associated proposal. Please retain a copy for your records.</p>
  <p style="margin-top: 2em;">Yours faithfully,</p>
  <p style="margin-top: 0.5em;"><strong>{{firmName}}</strong></p>
</div>
`;

const SAMPLE_PLACEHOLDER_DATA = (jurisdiction: string, currency: string = "ZAR") => ({
  firmName: "Your Accounting Firm",
  clientName: "Sample Client Ltd",
  contactName: "Jane Smith",
  clientAddress: "123 Business Street, City, 1234",
  date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  proposalNumber: "PROP-2026-001",
  proposalTitle: "Monthly Bookkeeping Services",
  services: "<li><strong>Monthly Bookkeeping</strong> - R 3,500</li><li><strong>Tax Preparation</strong> - R 2,000</li>",
  total: "R 5,500",
  currency,
  validUntil: "30 days from date above",
  jurisdiction,
  engagementClauses:
    '<p style="color:#64748b;font-size:0.95em;">When a proposal is accepted, section and line-item clauses from <strong>Services</strong> and <strong>Engagement Letters</strong> appear here.</p>',
});

/**
 * Get sample engagement letter content for preview (e.g. in Settings).
 * Always returns content: uses DB templates when available, otherwise a built-in default.
 */
export const getSampleLetterTemplate = query({
  args: {
    jurisdiction: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const jurisdiction = args.jurisdiction || "ZA";
    const currency = args.currency || "ZAR";
    const templates = await ctx.db
      .query("letterTemplates")
      .filter((q) => q.eq(q.field("jurisdiction"), jurisdiction))
      .collect();
    const template = templates.find((t) => t.isDefault) ?? templates[0];
    const sampleData = SAMPLE_PLACEHOLDER_DATA(jurisdiction, currency);
    const content = template
      ? fillPlaceholders(template.content, sampleData)
      : fillPlaceholders(DEFAULT_ENGAGEMENT_LETTER_TEMPLATE, sampleData);
    return { content, name: template?.name ?? "Standard Engagement Letter" };
  },
});

// ===== HELPER FUNCTIONS =====

function determineServiceType(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  if (lower.includes("audit")) return "audit";
  if (lower.includes("bookkeeping") || lower.includes("accounting")) return "bookkeeping";
  if (lower.includes("tax")) return "tax";
  if (lower.includes("payroll")) return "payroll";
  if (lower.includes("advisory") || lower.includes("consulting")) return "advisory";
  return "other";
}

function fillPlaceholders(
  template: string,
  data: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, "gi"), value);
  }
  return result;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string): string {
  const n = Number(amount);
  if (n !== n || !Number.isFinite(n)) {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(0);
  }
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(n);
}

function formatServices(services: any[], currency: string = "ZAR"): string {
  return services
    .map(
      (s) =>
        `<li><strong>${s.serviceName}</strong> - ${formatCurrency(s.subtotal, currency)}</li>`
    )
    .join("\n");
}

function formatAddress(client: any): string {
  const parts = [
    client.address,
    client.city,
    client.state,
    client.postalCode,
    client.country,
  ].filter(Boolean);
  return parts.join(", ") || "Address on file";
}

// Engagement email templates schema (for validators)
const engagementTemplateValidator = v.object({
  clientSubject: v.optional(v.string()),
  clientContent: v.optional(v.string()),
  additionalSignatorySubject: v.optional(v.string()),
  additionalSignatoryContent: v.optional(v.string()),
  staffSubject: v.optional(v.string()),
  staffContent: v.optional(v.string()),
  additionallyEmailTo: v.optional(v.string()),
});

/**
 * Get engagement letter email templates for the current user's firm.
 */
export const getEngagementEmailTemplates = query({
  args: { userId: v.id("users") },
  returns: v.object({
    signed: v.optional(engagementTemplateValidator),
    acceptance: v.optional(engagementTemplateValidator),
  }),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return {};

    const firm = await ctx.db.get(firmId);
    return firm?.engagementEmailTemplates ?? {};
  },
});

/**
 * Update engagement letter email templates (Configure > Engagement Letters > Emails).
 */
export const updateEngagementEmailTemplates = mutation({
  args: {
    userId: v.id("users"),
    signed: v.optional(engagementTemplateValidator),
    acceptance: v.optional(engagementTemplateValidator),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) throw new Error("User not found");

    const firm = await ctx.db.get(firmId);
    if (!firm) throw new Error("Firm not found");

    const existing = firm.engagementEmailTemplates ?? {};
    const signedMerged =
      args.signed !== undefined
        ? { ...existing.signed, ...args.signed }
        : existing.signed;
    const acceptanceMerged =
      args.acceptance !== undefined
        ? { ...existing.acceptance, ...args.acceptance }
        : existing.acceptance;

    await ctx.db.patch(firmId, {
      updatedAt: Date.now(),
      engagementEmailTemplates: {
        ...existing,
        ...(args.signed !== undefined && { signed: signedMerged }),
        ...(args.acceptance !== undefined && { acceptance: acceptanceMerged }),
      },
    });

    return { success: true };
  },
});

// Key Dates settings (Engagement Letters > Key Dates)
const keyDatesSettingsValidator = v.object({
  keyDatesTableIntroduction: v.optional(v.string()),
  infoDeadlineHeading: v.optional(v.string()),
  filingDeadlineHeading: v.optional(v.string()),
});

/**
 * Get Key Dates settings for the current user's firm.
 */
export const getKeyDatesSettings = query({
  args: { userId: v.id("users") },
  returns: keyDatesSettingsValidator,
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return {};

    const firm = await ctx.db.get(firmId);
    return firm?.keyDatesSettings ?? {};
  },
});

/**
 * Update Key Dates settings (Configure > Engagement Letters > Key Dates).
 */
export const updateKeyDatesSettings = mutation({
  args: {
    userId: v.id("users"),
    keyDatesTableIntroduction: v.optional(v.string()),
    infoDeadlineHeading: v.optional(v.string()),
    filingDeadlineHeading: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) throw new Error("User not found");

    const firm = await ctx.db.get(firmId);
    if (!firm) throw new Error("Firm not found");

    const existing = firm.keyDatesSettings ?? {};
    const updates: Record<string, unknown> = {};
    if (args.keyDatesTableIntroduction !== undefined)
      updates.keyDatesTableIntroduction = args.keyDatesTableIntroduction;
    if (args.infoDeadlineHeading !== undefined)
      updates.infoDeadlineHeading = args.infoDeadlineHeading;
    if (args.filingDeadlineHeading !== undefined)
      updates.filingDeadlineHeading = args.filingDeadlineHeading;

    await ctx.db.patch(firmId, {
      updatedAt: Date.now(),
      keyDatesSettings: { ...existing, ...updates },
    });

    return { success: true };
  },
});

// Engagement Letter Versions (Scope Library)
const letterVersionValidator = v.object({
  _id: v.id("engagementLetterVersions"),
  _creationTime: v.number(),
  firmId: v.id("firms"),
  name: v.string(),
  introduction: v.optional(v.string()),
  scope: v.optional(v.string()),
  sortOrder: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * List engagement letter versions for the user's firm.
 */
export const listLetterVersions = query({
  args: { userId: v.id("users") },
  returns: v.array(letterVersionValidator),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return [];

    return await ctx.db
      .query("engagementLetterVersions")
      .withIndex("by_firm_sort", (q) => q.eq("firmId", firmId))
      .order("asc")
      .collect();
  },
});

/**
 * Single engagement letter version (scope library) for edit screen.
 */
export const getLetterVersion = query({
  args: {
    userId: v.id("users"),
    versionId: v.id("engagementLetterVersions"),
  },
  returns: v.union(letterVersionValidator, v.null()),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return null;
    const row = await ctx.db.get(args.versionId);
    if (!row || row.firmId !== firmId) return null;
    return row;
  },
});

/**
 * Create a new engagement letter version.
 */
export const createLetterVersion = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    introduction: v.optional(v.string()),
    scope: v.optional(v.string()),
  },
  returns: v.id("engagementLetterVersions"),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const existing = await ctx.db
      .query("engagementLetterVersions")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    const maxSort = existing.reduce((m, v) => Math.max(m, v.sortOrder), -1);

    const now = Date.now();
    return await ctx.db.insert("engagementLetterVersions", {
      firmId,
      name: args.name.trim(),
      introduction: args.introduction?.trim() || undefined,
      scope: args.scope?.trim() || undefined,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an engagement letter version.
 */
export const updateLetterVersion = mutation({
  args: {
    userId: v.id("users"),
    versionId: v.id("engagementLetterVersions"),
    name: v.string(),
    introduction: v.optional(v.string()),
    scope: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const version = await ctx.db.get(args.versionId);
    if (!version || version.firmId !== firmId) throw new Error("Version not found");

    await ctx.db.patch(args.versionId, {
      name: args.name.trim(),
      introduction: args.introduction?.trim() || undefined,
      scope: args.scope?.trim() || undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Duplicate an engagement letter version.
 */
export const duplicateLetterVersion = mutation({
  args: {
    userId: v.id("users"),
    versionId: v.id("engagementLetterVersions"),
  },
  returns: v.id("engagementLetterVersions"),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const source = await ctx.db.get(args.versionId);
    if (!source || source.firmId !== firmId) throw new Error("Version not found");

    const existing = await ctx.db
      .query("engagementLetterVersions")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    const maxSort = existing.reduce((m, v) => Math.max(m, v.sortOrder), -1);

    const now = Date.now();
    return await ctx.db.insert("engagementLetterVersions", {
      firmId,
      name: `${source.name} (Copy)`,
      introduction: source.introduction,
      scope: source.scope,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Delete an engagement letter version.
 */
export const deleteLetterVersion = mutation({
  args: {
    userId: v.id("users"),
    versionId: v.id("engagementLetterVersions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const version = await ctx.db.get(args.versionId);
    if (!version || version.firmId !== firmId) throw new Error("Version not found");

    await ctx.db.delete(args.versionId);
    return null;
  },
});

/**
 * Seed four default scope-library templates when a firm has none (idempotent).
 */
export const ensureDefaultLetterVersions = mutation({
  args: { userId: v.id("users") },
  returns: v.object({ created: v.number() }),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return { created: 0 };

    const existing = await ctx.db
      .query("engagementLetterVersions")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();
    if (existing.length > 0) {
      return { created: 0 };
    }

    const defaults: { name: string; introduction: string; scope: string }[] = [
      {
        name: "Standard professional services",
        introduction:
          "This letter sets out the terms on which we agree to provide professional services to you. Please read it together with our schedule of services and any engagement-specific documents.",
        scope:
          "Our services will be performed with reasonable skill and care in accordance with applicable professional standards. The detailed scope for this engagement is described in the schedule of services and supporting documentation.",
      },
      {
        name: "Trust & estate focus",
        introduction:
          "We are pleased to confirm our engagement to provide trust, estate, and related advisory services. This letter should be read with the trust deed, will, and any letters of instruction you have provided.",
        scope:
          "Services may include trust administration, estate planning coordination, tax compliance support, and liaison with third parties as agreed. Specific deliverables and timelines are set out in the schedule of services.",
      },
      {
        name: "Small business & corporate",
        introduction:
          "This engagement letter confirms the basis on which we will provide accounting, tax, and business advisory services to your organisation for the period described below.",
        scope:
          "Our work typically includes statutory and management reporting, tax compliance, payroll support where applicable, and ad hoc advisory as requested. The exact scope is defined in the schedule of services attached.",
      },
      {
        name: "Audit & assurance",
        introduction:
          "This letter outlines the terms of our engagement to perform audit, independent review, or assurance services as applicable, in line with International Standards on Auditing (or equivalent) and regulatory requirements.",
        scope:
          "The objective, responsibilities of management and those charged with governance, and the nature and limitations of our work are described in the detailed engagement plan and schedule of services.",
      },
    ];

    const now = Date.now();
    let sortOrder = 0;
    for (const d of defaults) {
      await ctx.db.insert("engagementLetterVersions", {
        firmId,
        name: d.name,
        introduction: d.introduction,
        scope: d.scope,
        sortOrder: sortOrder++,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { created: defaults.length };
  },
});

/**
 * Reorder engagement letter versions.
 */
export const reorderLetterVersions = mutation({
  args: {
    userId: v.id("users"),
    versionIds: v.array(v.id("engagementLetterVersions")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = user.firmId;

    const now = Date.now();
    for (let i = 0; i < args.versionIds.length; i++) {
      const ver = await ctx.db.get(args.versionIds[i]);
      if (!ver || ver.firmId !== firmId) continue;
      await ctx.db.patch(args.versionIds[i], {
        sortOrder: i,
        updatedAt: now,
      });
    }
    return null;
  },
});

// Engagement Suite global settings (Terms, Privacy, Schedule intro, Agreement)
const suiteSettingsValidator = v.object({
  termsAndConditions: v.optional(v.string()),
  privacyNoticeEnabled: v.optional(v.boolean()),
  privacyNoticeContent: v.optional(v.string()),
  scheduleOfServicesIntroduction: v.optional(v.string()),
  agreementSignatureVersion: v.optional(v.string()),
  agreementNoSignatureVersion: v.optional(v.string()),
  includePrincipalSignature: v.optional(v.boolean()),
});

/**
 * Get engagement suite settings for the current user's firm.
 */
export const getEngagementSuiteSettings = query({
  args: { userId: v.id("users") },
  returns: suiteSettingsValidator,
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return {};

    const firm = await ctx.db.get(firmId);
    return firm?.engagementSuiteSettings ?? {};
  },
});

/**
 * Update engagement suite settings (Terms, Privacy, Schedule intro, Agreement).
 */
export const updateEngagementSuiteSettings = mutation({
  args: {
    userId: v.id("users"),
    termsAndConditions: v.optional(v.string()),
    privacyNoticeEnabled: v.optional(v.boolean()),
    privacyNoticeContent: v.optional(v.string()),
    scheduleOfServicesIntroduction: v.optional(v.string()),
    agreementSignatureVersion: v.optional(v.string()),
    agreementNoSignatureVersion: v.optional(v.string()),
    includePrincipalSignature: v.optional(v.boolean()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.userId, "canManageTemplates");
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) throw new Error("User not found");

    const firm = await ctx.db.get(firmId);
    if (!firm) throw new Error("Firm not found");

    const existing = firm.engagementSuiteSettings ?? {};
    const updates: Record<string, unknown> = {};
    const keys: (keyof typeof args)[] = [
      "termsAndConditions", "privacyNoticeEnabled", "privacyNoticeContent",
      "scheduleOfServicesIntroduction", "agreementSignatureVersion",
      "agreementNoSignatureVersion", "includePrincipalSignature",
    ];
    for (const k of keys) {
      if (args[k] !== undefined) (updates as Record<string, unknown>)[k] = args[k];
    }

    await ctx.db.patch(firmId, {
      updatedAt: Date.now(),
      engagementSuiteSettings: { ...existing, ...updates },
    });

    return { success: true };
  },
});

/**
 * Letterhead UI: logo URL + text fields (practice address & footer share PDF proposal fields).
 */
export const getEngagementLetterheadForUi = query({
  args: { userId: v.id("users") },
  returns: v.object({
    logoUrl: v.union(v.string(), v.null()),
    practiceAddress: v.string(),
    footerText: v.string(),
    directorsList: v.string(),
  }),
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) {
      return { logoUrl: null, practiceAddress: "", footerText: "", directorsList: "" };
    }
    const firm = await ctx.db.get(firmId);
    if (!firm) {
      return { logoUrl: null, practiceAddress: "", footerText: "", directorsList: "" };
    }
    let logoUrl: string | null = null;
    if (firm.logo) {
      logoUrl = await ctx.storage.getUrl(firm.logo);
    }
    return {
      logoUrl,
      practiceAddress: firm.pdfFooterAddress ?? "",
      footerText: firm.pdfFooterText ?? "",
      directorsList: firm.letterheadDirectorsList ?? "",
    };
  },
});
