"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Banknote, TrendingUp, BarChart3, Receipt, Calendar,
  FileText, ChevronDown, FileDown, Users, HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, dedupeById } from "@/lib/utils";
import { toast } from "sonner";
import {
  buildTwelveMonthCashFlow,
  type CashFlowProposalSlice,
} from "@/lib/cash-flow-projection";
import { downloadCashFlowPdf } from "@/lib/cash-flow-pdf";

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-[12px] px-3 py-2.5 rounded-lg shadow-lg space-y-1">
      <p className="text-white/50 text-[10px] mb-1">{label}</p>
      {payload.map((p, pi) => (
        <p key={`${p.name}-${pi}`} className="font-semibold">{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  /** Business overview: all clients, or one client */
  const [selectedClientId, setSelectedClientId] = useState<string>("all");

  const acceptedProposalsRaw = useQuery(
    api.proposals.listProposals,
    userId ? { userId, status: "accepted" } : "skip"
  );

  const acceptedProposals = useMemo(
    () => dedupeById(acceptedProposalsRaw ?? []),
    [acceptedProposalsRaw]
  );

  const loading = acceptedProposalsRaw === undefined;

  const clientsInForecast = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of acceptedProposals) {
      map.set(p.clientId, p.clientName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [acceptedProposals]);

  const activeProposals = useMemo(() => {
    if (selectedClientId === "all") return acceptedProposals;
    return acceptedProposals.filter((p) => p.clientId === selectedClientId);
  }, [acceptedProposals, selectedClientId]);

  const slices: CashFlowProposalSlice[] = useMemo(
    () =>
      activeProposals.map((p) => ({
        netMonthlyFee: p.netMonthlyFee ?? undefined,
        oneOffFee: p.oneOffFee ?? undefined,
        total: p.total,
        paymentSchedule: p.paymentSchedule,
        cashFlowStartMonth: p.cashFlowStartMonth,
        oneOffCashMonth: p.oneOffCashMonth,
      })),
    [activeProposals]
  );

  const cashFlow = useMemo(() => buildTwelveMonthCashFlow(slices), [slices]);

  /** Match proposal detail + cash-flow-projection: recurring = netMonthlyFee ?? total when no one-off split */
  const effectiveMonthly = (p: (typeof activeProposals)[number]) =>
    p.netMonthlyFee != null
      ? p.netMonthlyFee
      : p.oneOffFee != null && p.oneOffFee > 0
        ? 0
        : p.total;

  const totalMonthlyRecurring = useMemo(
    () => activeProposals.reduce((s, p) => s + effectiveMonthly(p), 0),
    [activeProposals]
  );

  const totalOneOffFees = useMemo(
    () => activeProposals.reduce((s, p) => s + (p.oneOffFee ?? 0), 0),
    [activeProposals]
  );

  const year1Projected = useMemo(
    () => cashFlow.reduce((s, m) => s + m.total, 0),
    [cashFlow]
  );

  const acv = totalMonthlyRecurring * 12;

  const peakMonth = useMemo(
    () =>
      cashFlow.reduce(
        (max, m) => (m.total > max.total ? m : max),
        cashFlow[0] ?? { label: "—", total: 0, ym: "" }
      ),
    [cashFlow]
  );

  const clientFilterLabel =
    selectedClientId === "all"
      ? "All clients"
      : clientsInForecast.find(([id]) => id === selectedClientId)?.[1] ?? "Client";

  const statsCards = [
    { label: "Annual Contract Value (recurring)", sublabel: "Sum of monthly × 12", value: formatCurrency(acv), icon: Banknote, iconBg: "bg-blue-50", iconColor: "#3b82f6" },
    { label: "Monthly Recurring", sublabel: "Per month (won work)", value: formatCurrency(totalMonthlyRecurring), icon: TrendingUp, iconBg: "bg-emerald-50", iconColor: "#10b981" },
    { label: "12-Mo. cash (projected)", sublabel: "By payment timing", value: formatCurrency(year1Projected), icon: BarChart3, iconBg: "bg-violet-50", iconColor: "#8b5cf6" },
    { label: "One-off fees (total)", sublabel: "Allocated by schedule", value: formatCurrency(totalOneOffFees), icon: Receipt, iconBg: "bg-[#C8A96E]/10", iconColor: "#C8A96E" },
    { label: "Peak month", sublabel: peakMonth.label, value: formatCurrency(peakMonth.total), icon: Calendar, iconBg: "bg-amber-50", iconColor: "#f59e0b" },
    { label: "Accepted proposals", sublabel: "In this view", value: String(activeProposals.length), icon: FileText, iconBg: "bg-slate-100", iconColor: "#64748b" },
  ];

  const chartData = useMemo(
    () => cashFlow.map((m) => ({
      ...m,
      monthKey: `${m.label} ${m.ym.slice(0, 4)}`,
    })),
    [cashFlow]
  );

  const handleExportPdf = () => {
    if (loading) {
      toast.info("Still loading data…");
      return;
    }
    try {
      const statsRows = statsCards.map(({ label, sublabel, value }) => ({
        label,
        sublabel,
        value,
      }));
      const proposalRows = activeProposals.map((p) => {
        const pAcv = effectiveMonthly(p) * 12;
        const pct = acv > 0 ? (pAcv / acv) * 100 : 0;
        return {
          title: p.title,
          clientName: p.clientName,
          acv: pAcv,
          pct,
        };
      });
      downloadCashFlowPdf({
        clientFilterLabel,
        statsCards: statsRows,
        monthRows: cashFlow.map((m) => ({
          label: m.label,
          ym: m.ym,
          monthly: m.monthly,
          onceoff: m.onceoff,
          total: m.total,
        })),
        proposalRows,
      });
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    }
  };

  return (
    <>
      <Header />

      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        {/* ── Stats Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statsCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", card.iconBg)}>
                    <Icon className="h-[15px] w-[15px]" style={{ color: card.iconColor }} />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 leading-tight">{card.label}</p>
                </div>
                {loading ? (
                  <Skeleton className="h-8 w-24 mb-1" />
                ) : (
                  <p className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">
                    {card.value}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">{card.sublabel}</p>
              </div>
            );
          })}
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[200px] text-[12px] font-medium justify-between">
                  <span className="flex items-center gap-2 min-w-0">
                    <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{clientFilterLabel}</span>
                  </span>
                  <ChevronDown size={10} className="text-slate-500 shrink-0 ml-1" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4} className="max-h-[min(60vh,320px)] overflow-y-auto">
                <DropdownMenuItem onClick={() => setSelectedClientId("all")}>
                  All clients (firm overview)
                </DropdownMenuItem>
                {clientsInForecast.map(([id, name], ci) => (
                  <DropdownMenuItem key={`client-${id}-${ci}`} onClick={() => setSelectedClientId(id)}>
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                disabled={loading}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white border-0 shadow-none transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "#C8A96E" }}
              >
                Actions
                <ChevronDown className="h-3.5 w-3.5 opacity-90" strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              <DropdownMenuItem
                className="text-[13px] cursor-pointer"
                onClick={handleExportPdf}
                disabled={loading}
              >
                <FileDown className="h-4 w-4 mr-2 text-slate-500" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── 12-Month Revenue Chart ───────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-semibold text-slate-800">12-Month cash projection</p>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#C8A96E]/40"
                        aria-label="How this projection is calculated"
                      >
                        <HelpCircle className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      className="max-w-[min(100vw-2rem,380px)] bg-slate-900 text-slate-50 border-0 px-3 py-2.5 text-left text-[12px] font-normal leading-relaxed shadow-lg"
                    >
                      Agreed contracts only. This page loads accepted proposals from the same list as /proposals
                      (Convex listProposals with status won). Amounts use net monthly / one-off / total; timing uses
                      payment schedule and cash-flow months you set on each proposal under Payment and cash flow
                      (visible once the deal is won).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Based on accepted proposals and payment schedules
              </p>
            </div>
            <div className="flex items-center gap-4">
              {[
                { color: "#3b82f6", label: "Recurring" },
                { color: "#C8A96E", label: "One-off" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[11px] text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 py-5">
            {loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : activeProposals.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-[13px] text-slate-400 gap-2 px-4 text-center">
                <p>No accepted proposals in this view.</p>
                <p className="text-[12px] text-slate-400">Win proposals (status: Accepted) and configure how each client pays on the proposal page.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cfMonthly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="cfOnceoff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C8A96E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C8A96E" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="monthKey" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                    width={48}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="monthly" stackId="1" stroke="#3b82f6" strokeWidth={1.5} fill="url(#cfMonthly)" name="Recurring" />
                  <Area type="monotone" dataKey="onceoff" stackId="1" stroke="#C8A96E" strokeWidth={1.5} fill="url(#cfOnceoff)" name="One-off" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Bottom grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-50">
              <p className="text-[13px] font-semibold text-slate-800">Month by month</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Total inflow per month (next 12 months)</p>
            </div>
            <div className="px-5 py-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full rounded" />)}
                </div>
              ) : cashFlow.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-8 text-center">No data.</p>
              ) : (
                <div className="space-y-2.5">
                  {cashFlow.map((m) => {
                    const denom = year1Projected > 0 ? year1Projected / 12 : 1;
                    const pct = Math.min((m.total / denom) * 100, 100);
                    const monthKey = `${m.label} ${m.ym.slice(0, 4)}`;
                    return (
                      <div key={m.ym} className="flex items-center gap-3">
                        <span className="text-[11px] font-medium text-slate-400 w-20 shrink-0 tabular-nums">{monthKey}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, background: "#C8A96E", opacity: 0.7 }}
                          />
                        </div>
                        <span className="text-[12px] font-semibold text-slate-700 w-24 text-right tabular-nums shrink-0">
                          {formatCurrency(m.total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-50">
              <p className="text-[13px] font-semibold text-slate-800">By proposal</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Share of recurring ACV in this view</p>
            </div>
            <div className="px-5 py-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
                </div>
              ) : activeProposals.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-8 text-center">No proposals.</p>
              ) : (
                <div className="space-y-4">
                  {activeProposals.map((p, i) => {
                    const pAcv = effectiveMonthly(p) * 12;
                    const pct = acv > 0 ? (pAcv / acv) * 100 : 0;
                    return (
                      <div key={`cf-${p._id}-${i}`}>
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-slate-700 truncate">{p.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{p.clientName}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
                              {formatCurrency(pAcv)}<span className="text-slate-400 font-normal">/yr</span>
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 tabular-nums w-9 text-right">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, background: "#C8A96E", opacity: 0.65 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
