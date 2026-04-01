import { useState, useMemo, useCallback, useEffect } from "react";
import type {
  ProposalItem,
  ProposalBuilderEntity,
  ProposalBuilderClientGroup,
  ProposalBuilderSummary,
  ServiceTemplate,
  BillingCategory,
  PaymentFrequency,
  ClientGroupMode,
  EntityPricingMode,
} from "@/types";
import { generateId } from "@/lib/utils";
import {
  getItemTotalPrice,
  getItemTotalHours,
  buildEntitySummaries,
} from "@/lib/proposal-entities";
import {
  calculateServiceHours,
  normalizeFixedTimeEstimate,
  roundHoursUpOneDecimal,
} from "@/lib/service-metrics";

// ─── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY = "northpact_proposal_draft_v1";

function readPersistedDraft(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch { return null; }
}

export function clearProposalDraft(): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

function makeEntity(): ProposalBuilderEntity {
  return {
    id:                 generateId(),
    name:               "",
    entityType:         "company",
    registrationNumber: "",
    taxNumber:          "",
    vatNumber:          "",
    notes:              "",
    revenueRange:       "Not Applicable",
    incomeTaxRange:     "Not Applicable",
  };
}

function itemFromTemplate(
  template: ServiceTemplate,
  category: BillingCategory,
  firmId: string,
  sortOrder: number,
  opts?: { targetEntityId?: string }
): ProposalItem {
  const assignment =
    opts?.targetEntityId != null
      ? {
          entityAssignmentMode: "selected_entities" as const,
          assignedEntityIds:    [opts.targetEntityId],
        }
      : {
          entityAssignmentMode: "all_entities" as const,
          assignedEntityIds:    [] as string[],
        };

  return {
    id:                generateId(),
    proposalId:        "",
    firmId,
    serviceTemplateId: template.id,
    name:              template.name,
    description:       template.description ?? "",
    billingCategory:   category,
    pricingMethod:     template.pricingMethod,
    unitPrice:         template.unitPrice ?? 0,
    quantity:          1,
    discount:          0,
    taxRate:           15,
    frequency:         "monthly",
    entityPricingMode: "single_price" as EntityPricingMode,
    ...assignment,
    customEntityPrices:{},
    timeMethod:        "fixed_hours",
    timeInputHours:    template.timeInputHours ?? 0,
    timeInputMinutes:  Math.round((template.timeInputHours ?? 0) * 60),
    pricingDriver:     "",
    duePattern:        "",
    itemNotes:         "",
    baseAmount:        template.unitPrice ?? 0,
    subtotal:          template.unitPrice ?? 0,
    totalPrice:        template.unitPrice ?? 0,
    estimatedHours:    template.timeInputHours ?? 0,
    isOptional:        false,
    sortOrder,
    createdAt:         new Date().toISOString(),
    updatedAt:         new Date().toISOString(),
  };
}

function recalc(item: ProposalItem): ProposalItem {
  const normalized = normalizeFixedTimeEstimate(item);
  const base = normalized.unitPrice * (normalized.quantity ?? 1);
  const discounted = base * (1 - (normalized.discount ?? 0) / 100);
  const total = discounted * (1 + (normalized.taxRate ?? 0) / 100);
  const hours = calculateServiceHours(normalized);
  return {
    ...normalized,
    baseAmount:     base,
    subtotal:       discounted,
    totalPrice:     total,
    estimatedHours: roundHoursUpOneDecimal(hours),
    updatedAt:      new Date().toISOString(),
  };
}

export interface ProposalDraft {
  items:               ProposalItem[];
  entities:            ProposalBuilderEntity[];
  clientGroupMode:     ClientGroupMode;
  clientGroup:         ProposalBuilderClientGroup;
  paymentFrequency:    PaymentFrequency;
  /** Proposal is sent first; engagement letter after acceptance (product default). */
  engagementLetterAfterAccept: boolean;
  setEngagementLetterAfterAccept: (v: boolean) => void;
  summary:             ProposalBuilderSummary;
  cashFlowByMonth:     { month: string; revenue: number; hours: number }[];

  addEntity:           () => void;
  updateEntity:        (id: string, updates: Partial<ProposalBuilderEntity>) => void;
  removeEntity:        (id: string) => void;
  /** Replace all entities (e.g. Xero group load) and sanitize line-item assignments */
  replaceEntities:       (entities: ProposalBuilderEntity[]) => void;
  setClientGroupMode:  (mode: ClientGroupMode) => void;
  updateClientGroup:   (updates: Partial<ProposalBuilderClientGroup>) => void;
  setPaymentFrequency: (freq: PaymentFrequency) => void;

  addService:          (
    template: ServiceTemplate,
    category: BillingCategory,
    index?: number,
    opts?: { targetEntityId?: string }
  ) => ProposalItem;
  updateItem:          (id: string, updates: Partial<ProposalItem>) => void;
  removeItem:          (id: string) => void;
  duplicateItem:       (id: string) => void;
  moveItem:            (id: string, category: BillingCategory, toIndex?: number) => void;
  reorderItems:        (category: BillingCategory, from: number, to: number) => void;
  /** Replace all line items (e.g. load from a package template). */
  replaceItems:        (items: ProposalItem[]) => void;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function useProposalDraft(firmId: string, opts?: { restoreFromDraft?: boolean }): ProposalDraft {
  const restore = opts?.restoreFromDraft ?? false;

  // Always initialise with SSR-safe defaults to avoid hydration mismatches.
  // sessionStorage is restored in a post-mount effect below.
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [entities, setEntities] = useState<ProposalBuilderEntity[]>([]);
  const [clientGroupMode, setClientGroupMode] = useState<ClientGroupMode>("single_entity");
  const [clientGroup, setClientGroup] = useState<ProposalBuilderClientGroup>({ name: "", groupType: "", notes: "" });
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>("monthly");
  const [engagementLetterAfterAccept, setEngagementLetterAfterAccept] = useState<boolean>(true);

  // Restore draft from sessionStorage after mount (client-only) to keep
  // the initial server render in sync with the first client render.
  useEffect(() => {
    if (!restore) return;
    const s = readPersistedDraft();
    if (!s) return;
    if (Array.isArray(s.items)) setItems(s.items as ProposalItem[]);
    if (Array.isArray(s.entities)) setEntities(s.entities as ProposalBuilderEntity[]);
    if (s.clientGroupMode) setClientGroupMode(s.clientGroupMode as ClientGroupMode);
    if (s.clientGroup) setClientGroup(s.clientGroup as ProposalBuilderClientGroup);
    if (s.paymentFrequency) setPaymentFrequency(s.paymentFrequency as PaymentFrequency);
    if (typeof s.engagementLetterAfterAccept === "boolean") setEngagementLetterAfterAccept(s.engagementLetterAfterAccept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Entity management ──────────────────────────────────────────────────────
  const addEntity = useCallback(() => {
    setEntities((prev) => [...prev, makeEntity()]);
  }, []);

  const updateEntity = useCallback((id: string, updates: Partial<ProposalBuilderEntity>) => {
    setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }, []);

  const removeEntity = useCallback((id: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== id));
    // Sanitize orphaned assignments
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        assignedEntityIds: (item.assignedEntityIds ?? []).filter((eid) => eid !== id),
        customEntityPrices: Object.fromEntries(
          Object.entries(item.customEntityPrices ?? {}).filter(([eid]) => eid !== id)
        ),
      }))
    );
  }, []);

  const replaceEntities = useCallback((next: ProposalBuilderEntity[]) => {
    setEntities(next);
    const ids = new Set(next.map((e) => e.id));
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        assignedEntityIds: (item.assignedEntityIds ?? []).filter((eid) => ids.has(eid)),
        customEntityPrices: Object.fromEntries(
          Object.entries(item.customEntityPrices ?? {}).filter(([eid]) => ids.has(eid))
        ),
      }))
    );
  }, []);

  const updateClientGroup = useCallback((updates: Partial<ProposalBuilderClientGroup>) => {
    setClientGroup((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Item management ────────────────────────────────────────────────────────
  const addService = useCallback((
    template: ServiceTemplate,
    category: BillingCategory,
    index?: number,
    opts?: { targetEntityId?: string }
  ): ProposalItem => {
    const newItem = recalc(itemFromTemplate(template, category, firmId, 0, opts));
    setItems((prev) => {
      const categoryItems = prev.filter((i) => i.billingCategory === category);
      const otherItems    = prev.filter((i) => i.billingCategory !== category);
      const insertAt =
        opts?.targetEntityId != null ? categoryItems.length : (index ?? categoryItems.length);
      const updated = [
        ...categoryItems.slice(0, insertAt),
        newItem,
        ...categoryItems.slice(insertAt),
      ];
      return [...otherItems, ...updated];
    });
    return newItem;
  }, [firmId]);

  const updateItem = useCallback((id: string, updates: Partial<ProposalItem>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? recalc({ ...item, ...updates }) : item
      )
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const duplicateItem = useCallback((id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const copy: ProposalItem = {
        ...prev[idx],
        id:        generateId(),
        name:      `${prev[idx].name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  }, []);

  const moveItem = useCallback((id: string, category: BillingCategory, toIndex?: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      const without = prev.filter((i) => i.id !== id);
      const moved = { ...item, billingCategory: category };
      const catItems = without.filter((i) => i.billingCategory === category);
      const others   = without.filter((i) => i.billingCategory !== category);
      const idx = toIndex ?? catItems.length;
      return [
        ...others,
        ...catItems.slice(0, idx),
        moved,
        ...catItems.slice(idx),
      ];
    });
  }, []);

  const reorderItems = useCallback((category: BillingCategory, from: number, to: number) => {
    setItems((prev) => {
      const catItems = prev.filter((i) => i.billingCategory === category);
      const others   = prev.filter((i) => i.billingCategory !== category);
      if (from < 0 || from >= catItems.length || to < 0 || to >= catItems.length) return prev;
      const reordered = [...catItems];
      const [removed] = reordered.splice(from, 1);
      if (!removed) return prev;
      reordered.splice(to, 0, removed);
      return [...others, ...reordered];
    });
  }, []);

  const replaceItems = useCallback((next: ProposalItem[]) => {
    setItems(next.map((i) => recalc(i)));
  }, []);

  // ── Persist draft to sessionStorage ───────────────────────────────────────
  useEffect(() => {
    if (!restore || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        items, entities, clientGroupMode, clientGroup, paymentFrequency, engagementLetterAfterAccept,
      }));
    } catch {}
  }, [restore, items, entities, clientGroupMode, clientGroup, paymentFrequency, engagementLetterAfterAccept]);

  // ── Computed summary ───────────────────────────────────────────────────────
  const summary = useMemo<ProposalBuilderSummary>(() => {
    const required = items.filter((i) => !i.isOptional);

    const monthly = required
      .filter((i) => i.billingCategory === "monthly")
      .reduce((s, i) => s + getItemTotalPrice(i, entities), 0);
    const yearly = required
      .filter((i) => i.billingCategory === "yearly")
      .reduce((s, i) => s + getItemTotalPrice(i, entities), 0);
    const onceoff = required
      .filter((i) => i.billingCategory === "onceoff")
      .reduce((s, i) => s + getItemTotalPrice(i, entities), 0);

    const acv = monthly * 12 + yearly + onceoff;

    const cycleMap: Record<PaymentFrequency, number> = {
      monthly:      monthly,
      quarterly:    (monthly * 3) + (yearly / 4),
      annually:     acv,
      as_delivered: monthly,
    };

    const totalHours = roundHoursUpOneDecimal(
      required.reduce((s, i) => s + getItemTotalHours(i, entities), 0)
    );

    const entityTotals =
      entities.length > 0 ? buildEntitySummaries(items, entities) : [];

    return {
      itemCount:          items.length,
      monthlyTotal:       monthly,
      yearlyTotal:        yearly,
      onceoffTotal:       onceoff,
      annualContractValue:acv,
      year1Total:         acv,
      totalHours,
      perCycle:           cycleMap[paymentFrequency],
      entityTotals,
    };
  }, [items, entities, paymentFrequency]);

  // ── Cash flow ──────────────────────────────────────────────────────────────
  const cashFlowByMonth = useMemo(() => {
    const now = new Date();
    return MONTHS.map((m, idx) => {
      const isYearlyMonth = idx === 0; // dump all yearly in Jan for simplicity
      const revenue =
        summary.monthlyTotal +
        (isYearlyMonth ? summary.yearlyTotal + summary.onceoffTotal : 0);
      const hours = roundHoursUpOneDecimal(summary.totalHours / 12);
      return { month: m, revenue, hours };
    });
  }, [summary]);

  return {
    items,
    entities,
    clientGroupMode,
    clientGroup,
    paymentFrequency,
    engagementLetterAfterAccept,
    setEngagementLetterAfterAccept,
    summary,
    cashFlowByMonth,
    addEntity,
    updateEntity,
    removeEntity,
    replaceEntities,
    setClientGroupMode,
    updateClientGroup,
    setPaymentFrequency,
    addService,
    updateItem,
    removeItem,
    duplicateItem,
    moveItem,
    reorderItems,
    replaceItems,
  };
}
