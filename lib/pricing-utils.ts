import type { Frequency, PaymentFrequency } from "@/types";
import { RECURRENCE_MULTIPLIER, PAYMENT_PERIOD_COUNT } from "@/types";

/**
 * Returns how many delivery cycles per year for the given work frequency.
 * e.g. quarterly → 4, monthly → 12, annually → 1
 */
export function getRecurrenceMultiplier(frequency: Frequency): number {
  return RECURRENCE_MULTIPLIER[frequency] ?? 1;
}

/**
 * Annual Total = Price per Cycle × Recurrence Multiplier
 */
export function calculateAnnualTotal(
  pricePerCycle: number,
  frequency: Frequency
): number {
  return pricePerCycle * getRecurrenceMultiplier(frequency);
}

/**
 * Returns the number of invoices per year for a payment schedule.
 * For "as_delivered", falls back to the work frequency multiplier.
 */
export function getPaymentPeriodCount(
  paymentFrequency: PaymentFrequency,
  workFrequency?: Frequency
): number {
  if (paymentFrequency === "as_delivered") {
    return workFrequency ? getRecurrenceMultiplier(workFrequency) : 12;
  }
  return PAYMENT_PERIOD_COUNT[paymentFrequency] ?? 12;
}

/**
 * Invoice Amount = Annual Total ÷ Number of Payment Periods
 * For "as_delivered", invoice amount = price per cycle (no division needed).
 */
export function calculateInvoiceAmount(
  annualTotal: number,
  paymentFrequency: PaymentFrequency,
  workFrequency?: Frequency
): number {
  if (paymentFrequency === "as_delivered" && workFrequency) {
    const multiplier = getRecurrenceMultiplier(workFrequency);
    return multiplier > 0 ? annualTotal / multiplier : annualTotal;
  }
  const periods = getPaymentPeriodCount(paymentFrequency, workFrequency);
  return periods > 0 ? annualTotal / periods : annualTotal;
}
