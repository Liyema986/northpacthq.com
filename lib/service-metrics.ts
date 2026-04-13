import type { ProposalItem, PricingMethod } from "@/types";

/** Format a number as South African currency */
export function formatCurrency(n: number): string {
  return `R${n.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Round estimated hours up to 1 decimal place (avoids float junk like 50.833333333333336).
 */
export function roundHoursUpOneDecimal(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.ceil(hours * 10 - 1e-9) / 10;
}

/** Format decimal hours as "Xh" or "Xh Ym" */
export function formatHours(hours: number): string {
  if (hours === 0) return "0h";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Format decimal hours for cards/summaries: `01h:60M`.
 * Shows hours (floored) and **total minutes** (hours × 60).
 */
export function formatHoursMinutesClock(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "00h:00M";
  const h = Math.floor(hours);
  const totalMin = Math.round(hours * 60);
  const hourPart = h < 100 ? String(h).padStart(2, "0") : String(h);
  return `${hourPart}h:${String(totalMin).padStart(2, "0")}M`;
}

/** Whether this pricing method uses minutes-per-unit for time estimation */
export function pricingMethodUsesMinutesPerUnit(method: PricingMethod): boolean {
  return [
    "per_transaction",
    "per_employee",
    "per_payslip",
    "per_invoice",
    "per_bank_account",
    "per_vat_submission",
    "per_entity",
    "quantity_x_unit",
  ].includes(method);
}

/** Whether this pricing method uses hourly quantity directly */
export function pricingMethodUsesHourlyQuantity(method: PricingMethod): boolean {
  return method === "hourly";
}

/** Get a user-friendly label for the minutes input based on pricing method */
export function getDerivedMinutesLabel(
  method: PricingMethod,
  driver: string
): string {
  const map: Partial<Record<PricingMethod, string>> = {
    per_transaction:    "Minutes per transaction",
    per_employee:       "Minutes per employee",
    per_payslip:        "Minutes per payslip",
    per_invoice:        "Minutes per invoice",
    per_bank_account:   "Minutes per bank account",
    per_vat_submission: "Minutes per VAT submission",
    per_entity:         "Minutes per entity",
    quantity_x_unit:    "Minutes per unit",
  };
  return map[method] ?? (driver ? `Minutes per ${driver.toLowerCase()}` : "Minutes per unit");
}

/**
 * For fixed time estimates (not hourly quantity or volume "minutes per unit"),
 * `timeInputMinutes` is **total minutes** = `timeInputHours × 60`, kept in sync.
 * Migrates legacy additive rows (hours + minutes/60 as one duration) into one hours value + synced minutes.
 */
export function normalizeFixedTimeEstimate(item: ProposalItem): ProposalItem {
  const pm = item.pricingMethod;
  if (pricingMethodUsesHourlyQuantity(pm) || pricingMethodUsesMinutesPerUnit(pm)) {
    return item;
  }
  const h = item.timeInputHours ?? 0;
  const m = item.timeInputMinutes ?? 0;
  const expectedSync = Math.round(h * 60);
  if (Math.abs(m - expectedSync) <= 1) {
    return { ...item, timeInputMinutes: expectedSync };
  }
  const legacyTotalHours = h + m / 60;
  return {
    ...item,
    timeInputHours: legacyTotalHours,
    timeInputMinutes: Math.round(legacyTotalHours * 60),
  };
}

/** Calculate base estimated hours from item inputs */
export function calculateServiceHours(item: ProposalItem): number {
  const pm = item.pricingMethod;

  if (pricingMethodUsesHourlyQuantity(pm)) {
    return (item.quantity ?? 0);
  }

  if (pricingMethodUsesMinutesPerUnit(pm)) {
    const units = item.quantity ?? 0;
    const mins  = item.timeInputMinutes ?? 0;
    return (units * mins) / 60;
  }

  // Fixed time: duration lives in hours; minutes field is total minutes (hours×60), not additive
  return item.timeInputHours ?? 0;
}
