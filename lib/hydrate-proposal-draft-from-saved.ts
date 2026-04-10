/**
 * Map a Convex-stored proposal document into proposal-builder draft state
 * for /proposals/new?fromProposalId=...
 */

import { generateId } from "@/lib/utils";
import {
  calculateServiceHours,
  normalizeFixedTimeEstimate,
  roundHoursUpOneDecimal,
} from "@/lib/service-metrics";
import type {
  BillingCategory,
  Frequency,
  ProposalBuilderEntity,
  ProposalItem,
  ServiceTemplate,
} from "@/types";

export type ConvexProposalHydrateInput = {
  title: string;
  clientId: string;
  services?: Array<{
    serviceId: string;
    serviceName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    description?: string;
    estimatedHours?: number;
    scheduledMonth?: string;
    workPlanEntityLabels?: string[];
    billingCategory?: string;
    frequency?: string;
    paymentSchedule?: string;
  }>;
  entities?: Array<{
    id: number;
    name: string;
    type: string;
    revenueRange: string;
    incomeTaxRange: string;
  }>;
  introText?: string;
  termsText?: string;
  template?: string;
  packageTemplate?: string;
  documentType?: string;
  financialYearEndMonth?: string;
  financialYearEndYear?: string;
};

function coerceBilling(raw?: string): BillingCategory {
  if (raw === "monthly" || raw === "yearly" || raw === "onceoff") return raw;
  return "monthly";
}

function coerceFrequency(raw?: string): Frequency {
  const allowed: Frequency[] = [
    "monthly",
    "bi_monthly",
    "quarterly",
    "every_4_months",
    "semi_annually",
    "annually",
    "once_off",
    "on_demand",
  ];
  if (raw && allowed.includes(raw as Frequency)) return raw as Frequency;
  return "monthly";
}

function normalizeEntityType(t: string): ProposalBuilderEntity["entityType"] {
  const ok: ProposalBuilderEntity["entityType"][] = [
    "individual",
    "company",
    "close_corporation",
    "trust",
    "partnership",
    "non_profit",
    "other",
  ];
  return ok.includes(t as ProposalBuilderEntity["entityType"])
    ? (t as ProposalBuilderEntity["entityType"])
    : "company";
}

function mapStoredEntities(
  stored: ConvexProposalHydrateInput["entities"]
): ProposalBuilderEntity[] {
  if (!stored?.length) return [];
  return stored.map((e) => ({
    id: `entity-${e.id}`,
    name: e.name,
    entityType: normalizeEntityType(e.type),
    registrationNumber: "",
    taxNumber: "",
    vatNumber: "",
    notes: "",
    revenueRange: e.revenueRange,
    incomeTaxRange: e.incomeTaxRange,
  }));
}

function recalcItem(item: ProposalItem): ProposalItem {
  const normalized = normalizeFixedTimeEstimate(item);
  const base = normalized.unitPrice * (normalized.quantity ?? 1);
  const discounted = base * (1 - (normalized.discount ?? 0) / 100);
  const total = discounted * (1 + (normalized.taxRate ?? 0) / 100);
  const hours = calculateServiceHours(normalized);
  return {
    ...normalized,
    baseAmount: base,
    subtotal: discounted,
    totalPrice: total,
    estimatedHours: roundHoursUpOneDecimal(hours),
    updatedAt: new Date().toISOString(),
  };
}

function buildLineItem(
  line: NonNullable<ConvexProposalHydrateInput["services"]>[number],
  template: ServiceTemplate | null,
  firmId: string,
  sortOrder: number,
  nameToId: Map<string, string>
): ProposalItem {
  const billingCategory = coerceBilling(line.billingCategory);
  const frequency = coerceFrequency(line.frequency);
  const assignedEntityIds = (line.workPlanEntityLabels ?? [])
    .map((n) => nameToId.get(n))
    .filter((x): x is string => !!x);
  const entityAssignmentMode =
    assignedEntityIds.length > 0 ? "selected_entities" : "all_entities";

  const pricingMethod = template?.pricingMethod ?? "fixed_monthly";
  const name = line.serviceName || template?.name || "Service";
  const description = line.description ?? template?.description ?? "";
  const hoursFromLine = line.estimatedHours ?? template?.timeInputHours ?? 0;

  const item: ProposalItem = {
    id: generateId(),
    proposalId: "",
    firmId,
    serviceTemplateId: String(line.serviceId),
    name,
    description,
    billingCategory,
    pricingMethod,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    discount: 0,
    taxRate: 15,
    frequency,
    entityPricingMode: "single_price",
    assignedEntityIds,
    customEntityPrices: {},
    entityAssignmentMode,
    timeMethod: "fixed_hours",
    timeInputHours: hoursFromLine,
    timeInputMinutes: Math.round(hoursFromLine * 60),
    baseAmount: 0,
    subtotal: 0,
    totalPrice: 0,
    estimatedHours: line.estimatedHours ?? 0,
    isOptional: false,
    sortOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scheduledWorkMonth: line.scheduledMonth,
    commitmentDate: line.scheduledMonth ? `${line.scheduledMonth}-01` : undefined,
    ...(line.paymentSchedule && { paymentSchedule: line.paymentSchedule as import("@/types").PaymentFrequency }),
  };
  return recalcItem(item);
}

export function hydrateDraftFromConvexProposal(args: {
  proposal: ConvexProposalHydrateInput;
  templates: ServiceTemplate[];
  firmId: string;
  /** `new` = copy for another proposal (title gets “ — New”); `edit` = load for update (keeps title). */
  mode?: "new" | "edit";
}): {
  items: ProposalItem[];
  entities: ProposalBuilderEntity[];
  title: string;
  packageTemplateName: string | null;
  templatePreset: {
    introText: string;
    termsText: string;
    templateName: string;
  } | null;
  engagementLetterAfterAccept: boolean;
} {
  const { proposal, templates, firmId, mode = "new" } = args;

  let entities = mapStoredEntities(proposal.entities);
  /** Older saves may omit `entities`; builder needs ≥1 row for client + canvas. */
  if (entities.length === 0) {
    entities = [
      {
        id: `entity-${generateId()}`,
        name: "",
        entityType: "company",
        registrationNumber: "",
        taxNumber: "",
        vatNumber: "",
        notes: "",
        revenueRange: "Not Applicable",
        incomeTaxRange: "Not Applicable",
      },
    ];
  }
  if (entities[0]) {
    entities[0].financialYearEndMonth = proposal.financialYearEndMonth;
    entities[0].financialYearEndYear = proposal.financialYearEndYear;
  }

  const nameToId = new Map<string, string>();
  for (const e of entities) {
    nameToId.set(e.name, e.id);
  }

  const services = proposal.services ?? [];
  const items: ProposalItem[] = services.map((line, i) => {
    const template =
      templates.find((t) => t.id === String(line.serviceId)) ?? null;
    return buildLineItem(line, template, firmId, i, nameToId);
  });

  const baseTitle = proposal.title.replace(/\s*\(Copy\)\s*$/i, "").trim();
  const title =
    mode === "edit"
      ? (baseTitle || "Proposal")
      : baseTitle
        ? `${baseTitle} — New`
        : "New Proposal";

  const pkgName = proposal.packageTemplate?.trim() || null;

  const hasTemplate =
    !!(proposal.introText?.trim() || proposal.termsText?.trim() || proposal.template?.trim());
  const templatePreset = hasTemplate
    ? {
        introText: proposal.introText ?? "",
        termsText: proposal.termsText ?? "",
        templateName: proposal.template ?? "",
      }
    : null;

  /** Matches createProposal: proposal_only vs proposal_then_engagement_after_accept */
  const engagementLetterAfterAccept = proposal.documentType !== "proposal_only";

  return {
    items,
    entities,
    title,
    packageTemplateName: pkgName,
    templatePreset,
    engagementLetterAfterAccept,
  };
}
