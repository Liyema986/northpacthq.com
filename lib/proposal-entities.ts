import type {
  ProposalItem,
  ProposalBuilderEntity,
  ProposalEntitySummary,
  BillingCategory,
  EntityPricingMode,
  Frequency,
} from "@/types";
import { RECURRENCE_MULTIPLIER } from "@/types";
import { roundHoursUpOneDecimal } from "@/lib/service-metrics";
import { getRecurrenceMultiplier } from "@/lib/pricing-utils";

const BILLING_CATEGORIES: BillingCategory[] = ["monthly", "yearly", "onceoff"];

/** Separator for droppable ids: `monthly::<entityId>` vs plain `monthly` (list view). */
export const BILLING_DROPPABLE_SEP = "::";

export function isBillingCategory(v: string): v is BillingCategory {
  return BILLING_CATEGORIES.includes(v as BillingCategory);
}

/** Parse canvas droppable id from library / grid / list views. */
export function parseBillingDroppableId(
  droppableId: string
): { category: BillingCategory; entityId?: string } | null {
  const sep = BILLING_DROPPABLE_SEP;
  if (!droppableId.includes(sep)) {
    return isBillingCategory(droppableId) ? { category: droppableId } : null;
  }
  const i = droppableId.indexOf(sep);
  const cat = droppableId.slice(0, i);
  const entityId = droppableId.slice(i + sep.length);
  if (!isBillingCategory(cat) || !entityId) return null;
  return { category: cat, entityId };
}

export function billingDroppableId(
  category: BillingCategory,
  entityId?: string
): string {
  return entityId ? `${category}${BILLING_DROPPABLE_SEP}${entityId}` : category;
}

// ── Resolve which entity IDs a given item applies to ──────────────────────────
export function resolveAssignedEntityIds(
  item: ProposalItem,
  entities: ProposalBuilderEntity[]
): string[] {
  if (
    item.entityAssignmentMode === "all_entities" ||
    !item.entityAssignmentMode
  ) {
    return entities.map((e) => e.id);
  }
  return item.assignedEntityIds.filter((id) =>
    entities.some((e) => e.id === id)
  );
}

// ── Price for item considering entity assignment + pricing mode ───────────────
/** Returns the per-cycle price for this item (before annualization).
 *  For legacy yearly items (pricingVersion undefined), applies the ×12 factor
 *  to maintain backward compatibility. New items (pricingVersion 2+) store
 *  annual prices directly for yearly services. */
export function getItemTotalPrice(
  item: ProposalItem,
  entities: ProposalBuilderEntity[]
): number {
  // Legacy yearly items stored the monthly rate and relied on ×12 everywhere.
  // New items (pricingVersion >= 2) store the full annual price directly.
  const legacyYearlyFactor =
    item.billingCategory === "yearly" && !item.pricingVersion ? 12 : 1;

  if (entities.length === 0) return (item.totalPrice ?? item.subtotal ?? 0) * legacyYearlyFactor;

  const assignedIds = resolveAssignedEntityIds(item, entities);
  if (assignedIds.length === 0) return (item.totalPrice ?? 0) * legacyYearlyFactor;

  const mode = item.entityPricingMode as EntityPricingMode;

  if (mode === "custom_price_by_entity") {
    const n = assignedIds.length || 1;
    return assignedIds.reduce((sum, id) => {
      const custom = item.customEntityPrices?.[id];
      if (custom != null) return sum + custom;
      return sum + (item.subtotal ?? 0) / n;
    }, 0) * legacyYearlyFactor;
  }

  if (mode === "price_per_entity") {
    return (item.subtotal ?? 0) * assignedIds.length * legacyYearlyFactor;
  }

  // single_price (default)
  return (item.totalPrice ?? item.subtotal ?? 0) * legacyYearlyFactor;
}

/** Returns the annualized total for this item.
 *  Recurring items: perCyclePrice × recurrenceMultiplier
 *  Annual / Once-off: already at annual/total level from getItemTotalPrice */
export function getItemAnnualTotal(
  item: ProposalItem,
  entities: ProposalBuilderEntity[]
): number {
  const perCycle = getItemTotalPrice(item, entities);
  if (item.billingCategory === "monthly") {
    const freq = (item.frequency ?? "monthly") as Frequency;
    return perCycle * getRecurrenceMultiplier(freq);
  }
  return perCycle; // yearly & onceoff already at annual/total level
}

/** Share of this line's fee attributed to one entity (for grids & per-entity live summary).
 *  Returns the annualized amount for the entity. */
export function getItemContributionForEntity(
  item: ProposalItem,
  entityId: string,
  entities: ProposalBuilderEntity[]
): number {
  const assignedIds = resolveAssignedEntityIds(item, entities);
  if (!assignedIds.includes(entityId)) return 0;

  const mode = item.entityPricingMode as EntityPricingMode;
  // Legacy yearly items stored the monthly rate; new items store annual directly
  const legacyYearlyFactor =
    item.billingCategory === "yearly" && !item.pricingVersion ? 12 : 1;

  if (mode === "custom_price_by_entity") {
    const custom = item.customEntityPrices?.[entityId];
    if (custom != null) return custom * legacyYearlyFactor;
    const n = assignedIds.length || 1;
    return ((item.subtotal ?? 0) / n) * legacyYearlyFactor;
  }
  if (mode === "price_per_entity") {
    return (item.subtotal ?? 0) * legacyYearlyFactor;
  }
  const total = item.totalPrice ?? item.subtotal ?? 0;
  return (total / (assignedIds.length || 1)) * legacyYearlyFactor;
}

/** Share of estimated hours for one entity (matches contribution logic for reporting). */
export function getItemHoursContributionForEntity(
  item: ProposalItem,
  entityId: string,
  entities: ProposalBuilderEntity[]
): number {
  const assignedIds = resolveAssignedEntityIds(item, entities);
  if (!assignedIds.includes(entityId)) return 0;
  const base = item.estimatedHours ?? 0;
  const mode = item.entityPricingMode as EntityPricingMode;
  if (mode === "price_per_entity" || mode === "custom_price_by_entity") {
    return base;
  }
  return base / (assignedIds.length || 1);
}

// ── Estimated hours for item considering entity count ─────────────────────────
export function getItemTotalHours(
  item: ProposalItem,
  entities: ProposalBuilderEntity[]
): number {
  const base = item.estimatedHours ?? 0;
  if (entities.length === 0) return base;

  const assignedIds = resolveAssignedEntityIds(item, entities);
  if (assignedIds.length === 0) return base;

  const mode = item.entityPricingMode as EntityPricingMode;
  if (mode === "price_per_entity" || mode === "custom_price_by_entity") {
    return base * assignedIds.length;
  }
  return base;
}

// ── Check if item should show given an entity filter ─────────────────────────
export function matchesEntityFilter(
  item: ProposalItem,
  entityFilter: string,
  entities: ProposalBuilderEntity[]
): boolean {
  if (entityFilter === "all") return true;
  const assigned = resolveAssignedEntityIds(item, entities);
  return assigned.includes(entityFilter);
}

// ── Human-readable entity assignment label ────────────────────────────────────
export function getEntityAssignmentLabel(
  item: ProposalItem,
  entities: ProposalBuilderEntity[]
): string {
  if (entities.length === 0) return "No entities";
  const mode = item.entityAssignmentMode;
  if (!mode || mode === "all_entities") return "All entities";
  const names = getAssignedEntityNames(item, entities);
  if (names.length === 0) return "None";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(" & ");
  return `${names.length} entities`;
}

// ── Get names of assigned entities ───────────────────────────────────────────
export function getAssignedEntityNames(
  item: ProposalItem,
  entities: ProposalBuilderEntity[]
): string[] {
  const ids = resolveAssignedEntityIds(item, entities);
  return ids
    .map((id) => entities.find((e) => e.id === id)?.name ?? "")
    .filter(Boolean);
}

// ── Label for pricing mode ────────────────────────────────────────────────────
export function getItemPricingModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    single_price:          "Single price",
    price_per_entity:      "Per entity",
    custom_price_by_entity:"Custom by entity",
  };
  return labels[mode] ?? mode;
}

// ── Label for grouping items by entity ────────────────────────────────────────
export function getItemGroupingLabel(
  item: ProposalItem,
  entities: ProposalBuilderEntity[]
): string {
  const mode = item.entityAssignmentMode;
  if (!mode || mode === "all_entities") return "All Entities";
  const names = getAssignedEntityNames(item, entities);
  return names.length > 0 ? names.join(", ") : "Unassigned";
}

// ── Per-entity summary breakdown ──────────────────────────────────────────────
export function buildEntitySummaries(
  items: ProposalItem[],
  entities: ProposalBuilderEntity[]
): ProposalEntitySummary[] {
  return entities.map((entity) => {
    const entityItems = items.filter((item) =>
      resolveAssignedEntityIds(item, entities).includes(entity.id)
    );

    const requiredItems = entityItems.filter((i) => !i.isOptional);

    const monthly = requiredItems
      .filter((i) => i.billingCategory === "monthly")
      .reduce((s, i) => s + getItemContributionForEntity(i, entity.id, entities), 0);
    const yearly = requiredItems
      .filter((i) => i.billingCategory === "yearly")
      .reduce((s, i) => s + getItemContributionForEntity(i, entity.id, entities), 0);
    const onceoff = requiredItems
      .filter((i) => i.billingCategory === "onceoff")
      .reduce((s, i) => s + getItemContributionForEntity(i, entity.id, entities), 0);

    // Annualize monthly items using their recurrence multiplier
    const annualMonthly = requiredItems
      .filter((i) => i.billingCategory === "monthly")
      .reduce((s, i) => {
        const contribution = getItemContributionForEntity(i, entity.id, entities);
        const freq = (i.frequency ?? "monthly") as Frequency;
        return s + contribution * getRecurrenceMultiplier(freq);
      }, 0);
    const acv = annualMonthly + yearly + onceoff;
    const year1 = acv;
    const hours = requiredItems.reduce(
      (s, i) => {
        const h = getItemHoursContributionForEntity(i, entity.id, entities);
        if (i.billingCategory === "monthly") {
          const freq = (i.frequency ?? "monthly") as Frequency;
          return s + h * getRecurrenceMultiplier(freq);
        }
        return s + h;
      },
      0
    );

    // "shared" = item is assigned to all entities (single_price mode shared)
    const isShared = requiredItems.some(
      (i) =>
        (!i.entityAssignmentMode || i.entityAssignmentMode === "all_entities") &&
        i.entityPricingMode === "single_price"
    );

    return {
      entityId:           entity.id,
      entityName:         entity.name || "Untitled entity",
      monthlyTotal:       monthly,
      yearlyTotal:        yearly,
      onceoffTotal:       onceoff,
      annualContractValue:acv,
      year1Total:         year1,
      totalHours:         roundHoursUpOneDecimal(hours),
      isShared,
    };
  });
}
