/**
 * Default payment / cash-flow fields when a proposal becomes accepted (won).
 */
export function paymentDefaultsForAccept(
  proposal: {
    paymentSchedule?: "monthly" | "on_completion" | "blended";
    cashFlowStartMonth?: string;
    oneOffCashMonth?: string;
  },
  now: number
): {
  paymentSchedule?: "monthly" | "on_completion" | "blended";
  cashFlowStartMonth?: string;
  oneOffCashMonth?: string;
} {
  const d = new Date(now);
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const out: {
    paymentSchedule?: "monthly" | "on_completion" | "blended";
    cashFlowStartMonth?: string;
    oneOffCashMonth?: string;
  } = {};
  if (proposal.paymentSchedule == null) out.paymentSchedule = "blended";
  if (!proposal.cashFlowStartMonth?.trim()) out.cashFlowStartMonth = ym;
  if (!proposal.oneOffCashMonth?.trim()) out.oneOffCashMonth = ym;
  return out;
}
