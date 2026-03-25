import type { ProposalItem, ProposalSummary, CashFlowMonth, Frequency } from "@/types";

// ─── Frequency → occurrences per year ────────────────────────────────────────

export function frequencyOccurrences(frequency: Frequency): number {
  switch (frequency) {
    case "monthly": return 12;
    case "bi_monthly": return 6;
    case "quarterly": return 4;
    case "semi_annually": return 2;
    case "annually": return 1;
    case "once_off": return 1;
    case "on_demand": return 0;
    default: return 0;
  }
}

// ─── Base Amount ──────────────────────────────────────────────────────────────

export function calculateBaseAmount(item: ProposalItem): number {
  switch (item.pricingMethod) {
    case "fixed_monthly":
    case "fixed_annual":
    case "fixed_onceoff":
    case "quantity_x_unit":
      return item.quantity * item.unitPrice;
    case "hourly":
      return item.quantity * item.unitPrice;
    case "per_transaction":
      return (item.transactionCount ?? 0) * item.unitPrice;
    case "per_employee":
      return (item.employeeCount ?? 0) * item.unitPrice;
    case "per_payslip":
      return (item.payslipCount ?? 0) * item.unitPrice;
    case "per_invoice":
      return (item.invoiceCount ?? 0) * item.unitPrice;
    case "per_bank_account":
      return (item.bankAccountCount ?? 0) * item.unitPrice;
    case "per_vat_submission":
      return (item.vatSubmissionCount ?? 0) * item.unitPrice;
    case "per_entity":
      return (item.entityCount ?? 0) * item.unitPrice;
    case "tiered": {
      const vol =
        item.transactionCount ??
        item.employeeCount ??
        item.quantity ??
        0;
      const tier = (item.tiers ?? []).find(
        (t) => vol >= t.from && (t.to === null || vol <= t.to)
      );
      return tier ? tier.price : 0;
    }
    case "manual_override":
      return item.manualPrice ?? 0;
    default:
      return item.quantity * item.unitPrice;
  }
}

// ─── Hours ────────────────────────────────────────────────────────────────────

export function calculateItemHours(item: ProposalItem): number {
  switch (item.timeMethod) {
    case "hourly":
      return item.quantity;
    case "volume_based": {
      const vol =
        item.transactionCount ??
        item.employeeCount ??
        item.payslipCount ??
        item.invoiceCount ??
        item.bankAccountCount ??
        item.vatSubmissionCount ??
        item.entityCount ??
        0;
      return (vol * (item.minutesPerUnit ?? 0)) / 60;
    }
    case "fixed_hours":
      // Total minutes is derived from hours (hours×60), not additive — see normalizeFixedTimeEstimate
      return item.timeInputHours ?? 0;
    case "fixed_minutes":
      return (item.timeInputMinutes ?? 0) / 60;
    case "quantity_x_hours":
      return (item.timeQuantity ?? 0) * (item.timeInputHours ?? 0);
    case "quantity_x_minutes":
      return ((item.timeQuantity ?? 0) * (item.timeInputMinutes ?? 0)) / 60;
    default:
      return 0;
  }
}

// ─── Item Total ───────────────────────────────────────────────────────────────

export function calculateItemTotal(item: ProposalItem): number {
  const base = calculateBaseAmount(item);
  const subtotal = base * (1 - item.discount / 100) * (1 + item.taxRate / 100);

  switch (item.entityPricingMode) {
    case "single_price":
      return subtotal;
    case "price_per_entity":
      return subtotal * (item.assignedEntityIds.length || 1);
    case "custom_price_by_entity":
      return Object.values(item.customEntityPrices).reduce((s, p) => s + p, 0);
    default:
      return subtotal;
  }
}

// ─── Full Item Recalculation ──────────────────────────────────────────────────

export function recalculateItem(item: ProposalItem): ProposalItem {
  const baseAmount = calculateBaseAmount(item);
  const subtotal =
    baseAmount * (1 - item.discount / 100) * (1 + item.taxRate / 100);
  const totalPrice = calculateItemTotal(item);
  const baseHours = calculateItemHours(item);

  // Scale hours by entity count for price_per_entity
  const entityCount = item.assignedEntityIds.length || 1;
  const estimatedHours =
    item.entityPricingMode === "single_price"
      ? baseHours
      : baseHours * entityCount;

  return { ...item, baseAmount, subtotal, totalPrice, estimatedHours };
}

// ─── Proposal Summary ─────────────────────────────────────────────────────────

export function calculateProposalSummary(
  items: ProposalItem[],
  paymentFrequency: "as_delivered" | "monthly" | "quarterly" | "annually" = "monthly"
): ProposalSummary {
  const required = items.filter((i) => !i.isOptional);

  const monthlyTotal = required
    .filter((i) => i.billingCategory === "monthly")
    .reduce((s, i) => s + i.totalPrice, 0);

  const yearlyTotal = required
    .filter((i) => i.billingCategory === "yearly")
    .reduce((s, i) => s + i.totalPrice, 0);

  const onceoffTotal = required
    .filter((i) => i.billingCategory === "onceoff")
    .reduce((s, i) => s + i.totalPrice, 0);

  const acv = monthlyTotal * 12 + yearlyTotal;
  const year1Total = acv + onceoffTotal;

  const totalHours = required.reduce((s, i) => {
    const occ = frequencyOccurrences(i.frequency);
    return s + i.estimatedHours * occ;
  }, 0);

  const effectiveRate = totalHours > 0 ? acv / totalHours : 0;

  const frequencyDivisor =
    paymentFrequency === "monthly"
      ? 12
      : paymentFrequency === "quarterly"
      ? 4
      : 1;

  const perCycle = frequencyDivisor > 0 ? acv / frequencyDivisor : acv;

  return {
    monthlyTotal,
    yearlyTotal,
    onceoffTotal,
    acv,
    year1Total,
    totalHours,
    effectiveRate,
    perCycle,
  };
}

// ─── Cash Flow Distribution ───────────────────────────────────────────────────

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function calculateCashFlow(
  items: ProposalItem[],
  paymentFrequency: "as_delivered" | "monthly" | "quarterly" | "annually" = "monthly"
): CashFlowMonth[] {
  const months: CashFlowMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: MONTH_LABELS[i],
    monthly: 0,
    yearly: 0,
    onceoff: 0,
    total: 0,
  }));

  for (const item of items) {
    if (item.isOptional) continue;

    if (item.billingCategory === "monthly") {
      // Distribute monthly total across months
      switch (paymentFrequency) {
        case "monthly":
          months.forEach((m) => { m.monthly += item.totalPrice; });
          break;
        case "quarterly":
          [3, 6, 9, 12].forEach((mo) => {
            months[mo - 1].monthly += item.totalPrice * 3;
          });
          break;
        case "annually":
          months[0].monthly += item.totalPrice * 12;
          break;
        case "as_delivered":
          months.forEach((m) => { m.monthly += item.totalPrice; });
          break;
      }
    } else if (item.billingCategory === "yearly") {
      switch (paymentFrequency) {
        case "monthly":
          months.forEach((m) => { m.yearly += item.totalPrice / 12; });
          break;
        case "quarterly":
          [3, 6, 9, 12].forEach((mo) => {
            months[mo - 1].yearly += item.totalPrice / 4;
          });
          break;
        case "annually":
        case "as_delivered":
          // Allocate to month 1 (commencement)
          months[0].yearly += item.totalPrice;
          break;
      }
    } else if (item.billingCategory === "onceoff") {
      months[0].onceoff += item.totalPrice;
    }
  }

  months.forEach((m) => {
    m.total = m.monthly + m.yearly + m.onceoff;
  });

  return months;
}
