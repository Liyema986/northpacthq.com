/**
 * 12-month firm cash flow from accepted proposals + payment schedule.
 */

export type PaymentSchedule = "monthly" | "on_completion" | "blended";

export type CashFlowProposalSlice = {
  netMonthlyFee?: number;
  oneOffFee?: number;
  total: number;
  paymentSchedule?: PaymentSchedule;
  cashFlowStartMonth?: string;
  oneOffCashMonth?: string;
};

export type CashFlowMonthRow = {
  month: number;
  label: string;
  ym: string;
  monthly: number;
  onceoff: number;
  total: number;
};

function ymForOffset(anchor: Date, monthOffset: number): string {
  const d = new Date(anchor.getFullYear(), anchor.getMonth() + monthOffset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Compare YYYY-MM strings chronologically */
export function ymGte(a: string, b: string): boolean {
  return a.localeCompare(b) >= 0;
}

/**
 * Recurring $ / month and one-off $ aligned with `/proposals/[id]` stats:
 * `monthlyTotal = netMonthlyFee ?? total` when no fee split exists on the document.
 */
function recurringAmount(p: CashFlowProposalSlice): number {
  if (p.netMonthlyFee != null) return p.netMonthlyFee;
  if (p.oneOffFee != null && p.oneOffFee > 0) return 0;
  return p.total;
}

function oneOffAmount(p: CashFlowProposalSlice): number {
  return p.oneOffFee ?? 0;
}

/**
 * Rolling 12 calendar months from `anchorDate` (defaults to today).
 */
export function buildTwelveMonthCashFlow(
  proposals: CashFlowProposalSlice[],
  anchorDate: Date = new Date()
): CashFlowMonthRow[] {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const rows: CashFlowMonthRow[] = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + i, 1);
    const ym = ymForOffset(anchorDate, i);
    const label = monthNames[d.getMonth()];
    let monthly = 0;
    let onceoff = 0;

    for (const p of proposals) {
      const m = recurringAmount(p);
      const o = oneOffAmount(p);
      const start = p.cashFlowStartMonth?.trim() || ym;
      const oneM = p.oneOffCashMonth?.trim() || start;
      const sched: PaymentSchedule = p.paymentSchedule ?? "blended";

      if (sched === "on_completion") {
        const lump = o > 0 ? o : p.total;
        if (ym === oneM) onceoff += lump;
        continue;
      }

      if (sched === "monthly") {
        if (ymGte(ym, start)) monthly += m;
        continue;
      }

      // blended: recurring from start month + one-off in one-off month
      if (ymGte(ym, start)) monthly += m;
      if (ym === oneM) onceoff += o;
    }

    rows.push({
      month: i + 1,
      label,
      ym,
      monthly,
      onceoff,
      total: monthly + onceoff,
    });
  }

  return rows;
}
