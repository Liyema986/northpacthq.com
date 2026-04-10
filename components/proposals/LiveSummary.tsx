"use client";

import { useState } from "react";
import type { ProposalBuilderSummary, PaymentFrequency } from "@/types";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/service-metrics";

interface LiveSummaryProps {
  summary: ProposalBuilderSummary;
  paymentFrequency: PaymentFrequency;
  onPaymentFrequencyChange: (freq: PaymentFrequency) => void;
  cashFlowByMonth: { month: string; revenue: number; hours: number }[];
}

const freqLabels: Record<PaymentFrequency, string> = {
  as_delivered: "As Delivered",
  monthly:      "Monthly",
  bi_monthly:   "Bi-monthly",
  quarterly:    "Quarterly",
  "6_monthly":  "6-monthly",
  annually:     "Annually",
};

/** Relative to best month in the preview: strong / moderate / light cash. */
function cashFlowBarColors(ratioToPeak: number): { fill: string; hover: string } {
  const r = Math.min(1, Math.max(0, ratioToPeak));
  if (r >= 0.67) {
    return { fill: "rgba(16, 185, 129, 0.88)", hover: "rgba(5, 150, 105, 0.95)" };
  }
  if (r >= 0.34) {
    return { fill: "rgba(234, 179, 8, 0.92)", hover: "rgba(202, 138, 4, 0.98)" };
  }
  return { fill: "rgba(239, 68, 68, 0.88)", hover: "rgba(220, 38, 38, 0.95)" };
}

export function LiveSummary({
  summary,
  paymentFrequency,
  onPaymentFrequencyChange,
  cashFlowByMonth,
}: LiveSummaryProps) {
  const maxRevenue = Math.max(...cashFlowByMonth.map((m) => m.revenue), 1);
  const hasEntities = summary.entityTotals.length > 0;

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col overflow-y-auto border-l border-slate-100 bg-white">
      <div className="border-b border-slate-100 p-4 pr-10">
        <h2 className="text-[13px] font-semibold text-slate-800">Live Summary</h2>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {summary.itemCount} {summary.itemCount === 1 ? "service" : "services"} configured
        </p>
      </div>

      <div className="space-y-4 p-4">
        {/* Entity or overall totals */}
        {hasEntities ? (
          <div className="space-y-3">
            {summary.entityTotals.map((entity) => (
              <EntitySummarySection key={entity.entityId} entity={entity} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <SummaryRow label="Recurring Services"  value={formatCurrency(summary.monthlyTotal)} sublabel="/month" dotColor="bg-blue-400" />
            <SummaryRow label="Annual Services"   value={formatCurrency(summary.yearlyTotal)}  sublabel="/year"  dotColor="bg-violet-400" />
            <SummaryRow label="Once-off Services" value={formatCurrency(summary.onceoffTotal)} sublabel=""       dotColor="bg-amber-400" />
          </div>
        )}

        {/* ACV + Year 1 */}
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-slate-400">Annual Contract Value</span>
            <span className="text-[15px] font-bold text-slate-900 tabular-nums">
              {formatCurrency(summary.annualContractValue)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-slate-400">Year 1 Payable</span>
            <span className="text-[13px] font-semibold text-emerald-600 tabular-nums">
              {formatCurrency(summary.year1Total)}
            </span>
          </div>
        </div>

        {/* Payment frequency */}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Payment Frequency
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(freqLabels) as PaymentFrequency[]).map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => onPaymentFrequencyChange(freq)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  paymentFrequency === freq
                    ? "text-white"
                    : "bg-slate-100 text-slate-500 hover:text-slate-700"
                )}
                style={paymentFrequency === freq ? { background: "#C8A96E" } : {}}
              >
                {freqLabels[freq]}
              </button>
            ))}
          </div>
          {summary.annualContractValue > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Per {paymentFrequency === "as_delivered" ? "month (est.)" : freqLabels[paymentFrequency].toLowerCase()} cycle
              </p>
              <span className="text-[18px] font-bold text-slate-900 tabular-nums">
                {formatCurrency(summary.perCycle)}
              </span>
            </div>
          )}
        </div>

        {/* Work estimate */}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Work Estimate
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
              <p className="text-[10px] text-slate-400 mb-0.5">Annual Hours</p>
              <p className="text-[14px] font-bold text-slate-900">
                {summary.totalHours.toLocaleString("en-ZA", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1,
                })}
                h
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
              <p className="text-[10px] text-slate-400 mb-0.5">Revenue/Hour</p>
              <p className="text-[14px] font-bold text-slate-900">
                {summary.totalHours > 0
                  ? formatCurrency(summary.annualContractValue / summary.totalHours)
                  : "R0.00"}
              </p>
            </div>
          </div>
        </div>

        {/* Cash flow sparkline — use px heights; % height fails here (parent chain has no explicit height). */}
        {summary.annualContractValue > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Cash Flow Preview
            </p>
            <p className="mb-3 text-[9px] leading-snug text-slate-400">
              Colour vs strongest month in this view: green stronger, amber mid, red lighter.
            </p>
            <div className="flex gap-1">
              {cashFlowByMonth.map((m, i) => {
                const chartMaxPx = 52;
                const ratio = m.revenue / maxRevenue;
                const barPx = Math.max(ratio * chartMaxPx, 3);
                const { fill, hover } = cashFlowBarColors(ratio);
                return (
                  <div
                    key={i}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  >
                    <div
                      className="flex w-full items-end justify-center"
                      style={{ height: chartMaxPx }}
                    >
                      <div
                        className="group relative w-full rounded-sm transition-colors"
                        style={{
                          height: barPx,
                          background: fill,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = hover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = fill;
                        }}
                      >
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] text-white group-hover:block">
                          {formatCurrency(m.revenue)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[8px] text-slate-400">{m.month.slice(0, 1)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-50 pt-2 text-center text-[9px] text-slate-500">
              <span className="inline-flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm bg-emerald-500" aria-hidden />
                Strong
              </span>
              <span className="inline-flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm bg-amber-400" aria-hidden />
                Mid
              </span>
              <span className="inline-flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm bg-red-500" aria-hidden />
                Light
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Entity summary collapsible ───────────────────────────────────────────────

function EntitySummarySection({ entity }: { entity: ProposalBuilderSummary["entityTotals"][number] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-slate-50 rounded-xl"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown  className="h-3.5 w-3.5 text-slate-400" />
            : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          }
          <span className="text-[12px] font-semibold text-slate-800">{entity.entityName}</span>
          {entity.isShared && (
            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-white"
              style={{ background: "#C8A96E" }}>
              Shared
            </span>
          )}
        </div>
        <span className="text-[12px] font-semibold text-emerald-600 tabular-nums">
          {formatCurrency(entity.year1Total)}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2">
          <SummaryRow label="Monthly"  value={formatCurrency(entity.monthlyTotal)} sublabel="/mo" dotColor="bg-blue-400" />
          <SummaryRow label="Annual"   value={formatCurrency(entity.yearlyTotal)}  sublabel="/yr" dotColor="bg-violet-400" />
          <SummaryRow label="Once-off" value={formatCurrency(entity.onceoffTotal)} sublabel=""    dotColor="bg-amber-400" />
          <div className="mt-1 border-t border-slate-100 pt-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] text-slate-400">ACV</span>
              <span className="text-[11px] font-semibold text-slate-800 tabular-nums">
                {formatCurrency(entity.annualContractValue)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] text-slate-400">Hours</span>
              <span className="text-[11px] font-semibold text-slate-800">
                {entity.totalHours.toLocaleString("en-ZA", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1,
                })}
                h
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label, value, sublabel, dotColor,
}: {
  label: string; value: string; sublabel: string; dotColor: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
        <span className="text-[12px] text-slate-500">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-[13px] font-semibold text-slate-800 tabular-nums">{value}</span>
        {sublabel && <span className="ml-0.5 text-[10px] text-slate-400">{sublabel}</span>}
      </div>
    </div>
  );
}
