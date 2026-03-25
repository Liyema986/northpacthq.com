import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requirePermission, getUserFirmIdSafe } from "./lib/permissions";

const STATUS = v.union(
  v.literal("upcoming"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("overdue")
);

function defaultScheduledMonth(
  proposal: {
    startMonth?: string;
    startYear?: string;
    financialYearEndMonth?: string;
    financialYearEndYear?: string;
  }
): string {
  const sm = proposal.startMonth;
  const sy = proposal.startYear;
  if (sm && sy) {
    const n = Number.parseInt(String(sm), 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 12) {
      return `${sy}-${String(n).padStart(2, "0")}`;
    }
  }
  if (proposal.financialYearEndMonth && proposal.financialYearEndYear) {
    const n = Number.parseInt(String(proposal.financialYearEndMonth), 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 12) {
      return `${proposal.financialYearEndYear}-${String(n).padStart(2, "0")}`;
    }
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Rebuild work-plan rows for a proposal from `proposal.services` (planning fields).
 * Call after create/update when services change.
 */
export async function replaceWorkPlanTasksForProposal(
  ctx: MutationCtx,
  proposalId: Id<"proposals">
): Promise<void> {
  const proposal = await ctx.db.get(proposalId);
  if (!proposal) return;

  const firmId = proposal.firmId;
  const existing = await ctx.db
    .query("workPlanTasks")
    .withIndex("by_proposal", (q) => q.eq("proposalId", proposalId))
    .collect();
  const statusByKey = new Map<string, "upcoming" | "in_progress" | "completed" | "overdue">();
  for (const t of existing) {
    const key = `${t.proposalServiceIndex ?? -1}::${t.displayLabel}`;
    statusByKey.set(key, t.status);
    await ctx.db.delete(t._id);
  }

  const client = await ctx.db.get(proposal.clientId);
  const clientName = client?.companyName ?? "Client";
  const services = proposal.services ?? [];
  const monthFallback = defaultScheduledMonth(proposal);
  const now = Date.now();

  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    const ext = s as typeof s & {
      estimatedHours?: number;
      scheduledMonth?: string;
      workPlanEntityLabels?: string[];
      billingCategory?: string;
      frequency?: string;
    };
    const hours = ext.estimatedHours ?? 0;
    const month = ext.scheduledMonth?.trim() || monthFallback;
    if (hours <= 0 && !ext.scheduledMonth?.trim()) continue;

    const labels =
      ext.workPlanEntityLabels && ext.workPlanEntityLabels.length > 0
        ? ext.workPlanEntityLabels
        : [clientName];
    const hoursEach = hours > 0 ? hours / labels.length : 1;

    for (const ent of labels) {
      const displayLabel = `${s.serviceName} — ${ent}`;
      const stableKey = `${i}::${displayLabel}`;
      const status = statusByKey.get(stableKey) ?? "upcoming";
      await ctx.db.insert("workPlanTasks", {
        firmId,
        clientId: proposal.clientId,
        proposalId,
        proposalServiceIndex: i,
        source: "proposal",
        serviceName: s.serviceName,
        displayLabel,
        billingCategory: ext.billingCategory ?? "monthly",
        frequency: ext.frequency ?? "monthly",
        scheduledMonth: month,
        estimatedHours: Math.round(hoursEach * 100) / 100,
        status,
        createdBy: proposal.createdBy,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export async function deleteWorkPlanTasksForProposal(
  ctx: MutationCtx,
  proposalId: Id<"proposals">
): Promise<void> {
  const rows = await ctx.db
    .query("workPlanTasks")
    .withIndex("by_proposal", (q) => q.eq("proposalId", proposalId))
    .collect();
  for (const t of rows) {
    await ctx.db.delete(t._id);
  }
}

/**
 * Rebuild work-plan tasks from every proposal’s `services` for this firm.
 * Use after upgrading planning sync or when tasks are missing from older saves.
 */
export const resyncWorkPlanTasksForFirm = mutation({
  args: { userId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    proposalsProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");
    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    for (const p of proposals) {
      await replaceWorkPlanTasksForProposal(ctx, p._id);
    }
    return { success: true, proposalsProcessed: proposals.length };
  },
});

export const listWorkPlanTasks = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const firmId = await getUserFirmIdSafe(ctx, args.userId);
    if (!firmId) return [];

    const rows = await ctx.db
      .query("workPlanTasks")
      .withIndex("by_firm", (q) => q.eq("firmId", firmId))
      .collect();

    const clientIds = [...new Set(rows.map((r) => r.clientId))];
    const clientDocs = await Promise.all(clientIds.map((id) => ctx.db.get(id)));
    const clientName: Record<string, string> = {};
    for (const c of clientDocs) {
      if (c) clientName[c._id] = c.companyName;
    }

    return rows
      .map((r) => ({
        _id: r._id,
        proposalId: r.proposalId,
        source: r.source,
        serviceName: r.serviceName,
        displayLabel: r.displayLabel,
        clientGroupId: r.clientId,
        clientName: clientName[r.clientId] ?? "",
        billingCategory: r.billingCategory,
        frequency: r.frequency,
        scheduledMonth: r.scheduledMonth,
        estimatedHours: r.estimatedHours,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
      .sort((a, b) => b.scheduledMonth.localeCompare(a.scheduledMonth) || b.createdAt - a.createdAt);
  },
});

export const createManualWorkPlanTask = mutation({
  args: {
    userId: v.id("users"),
    clientId: v.id("clients"),
    serviceName: v.string(),
    scheduledMonth: v.string(),
    estimatedHours: v.number(),
    status: STATUS,
  },
  returns: v.id("workPlanTasks"),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");
    const client = await ctx.db.get(args.clientId);
    if (!client || client.firmId !== user.firmId) {
      throw new Error("Client not found");
    }
    const now = Date.now();
    return await ctx.db.insert("workPlanTasks", {
      firmId: user.firmId,
      clientId: args.clientId,
      source: "manual",
      serviceName: args.serviceName.trim(),
      displayLabel: args.serviceName.trim(),
      billingCategory: "monthly",
      frequency: "monthly",
      scheduledMonth: args.scheduledMonth,
      estimatedHours: args.estimatedHours,
      status: args.status,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateWorkPlanTaskStatus = mutation({
  args: {
    userId: v.id("users"),
    taskId: v.id("workPlanTasks"),
    status: STATUS,
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");
    const row = await ctx.db.get(args.taskId);
    if (!row || row.firmId !== user.firmId) {
      return { success: false, error: "Task not found" };
    }
    await ctx.db.patch(args.taskId, { status: args.status, updatedAt: Date.now() });
    return { success: true };
  },
});

export const deleteWorkPlanTask = mutation({
  args: {
    userId: v.id("users"),
    taskId: v.id("workPlanTasks"),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.userId, "canCreateProposals");
    const row = await ctx.db.get(args.taskId);
    if (!row || row.firmId !== user.firmId) {
      return { success: false, error: "Task not found" };
    }
    await ctx.db.delete(args.taskId);
    return { success: true };
  },
});
