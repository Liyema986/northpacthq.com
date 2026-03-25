"use client";

import { useMemo, Fragment } from "react";
import { Header } from "@/components/layout/header";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { PRICING_METHOD_LABELS } from "@/types";
import { formatCurrency, formatDate, dedupeById } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";
import {
  FileText, TrendingUp, ChevronLeft, ChevronRight,
  Users, Package, CheckCircle, XCircle, Send, Eye,
  Activity, BarChart3, Banknote, ArrowRight,
  MoreHorizontal, Pencil, Copy, Trash2, User, History, FilePlus,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; color: string }> = {
  draft:              { label: "Draft",    dot: "bg-slate-200",   text: "text-slate-400",   color: "#e2e8f0" },
  "pending-approval": { label: "Pending",  dot: "bg-amber-400",   text: "text-amber-600",   color: "#fbbf24" },
  approved:           { label: "Approved", dot: "bg-blue-400",    text: "text-blue-600",    color: "#60a5fa" },
  sent:               { label: "Sent",     dot: "bg-violet-400",  text: "text-violet-600",  color: "#a78bfa" },
  viewed:             { label: "Viewed",   dot: "bg-cyan-400",    text: "text-cyan-600",    color: "#22d3ee" },
  accepted:           { label: "Accepted", dot: "bg-emerald-400", text: "text-emerald-600", color: "#34d399" },
  rejected:           { label: "Rejected", dot: "bg-red-400",     text: "text-red-500",     color: "#f87171" },
  expired:            { label: "Expired",  dot: "bg-slate-200",   text: "text-slate-400",   color: "#cbd5e1" },
};

const PROPOSAL_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Draft",    cls: "bg-slate-50 border border-slate-200 text-slate-600" },
  "pending-approval": { label: "Pending",  cls: "bg-amber-50 border border-amber-200 text-amber-700" },
  approved:           { label: "Approved", cls: "bg-blue-50 border border-blue-200 text-blue-700" },
  sent:               { label: "Live",     cls: "bg-blue-50 border border-blue-200 text-blue-700" },
  viewed:             { label: "Live",     cls: "bg-blue-50 border border-blue-200 text-blue-700" },
  accepted:           { label: "Won",      cls: "bg-emerald-50 border border-emerald-200 text-emerald-700" },
  rejected:           { label: "Lost",     cls: "bg-red-50 border border-red-200 text-red-700" },
  expired:            { label: "Expired",  cls: "bg-slate-50 border border-slate-200 text-slate-500" },
};

type ConvexProposal = {
  _id: Id<"proposals">;
  proposalNumber: string;
  title: string;
  clientId: Id<"clients">;
  clientName: string;
  status: string;
  total: number;
  currency: string;
  createdAt: number;
  validUntil?: number;
  sentAt?: number;
  viewedAt?: number;
  acceptedAt?: number;
  netMonthlyFee?: number;
  oneOffFee?: number;
  startMonth?: string;
  createdByName?: string;
};

type ConvexClient = {
  _id: Id<"clients">;
  companyName: string;
  contactName: string;
  email: string;
  industry?: string;
  status: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

type ConvexService = {
  _id: Id<"services">;
  name: string;
  description?: string;
  category: string;
  pricingType: string;
  fixedPrice?: number;
  hourlyRate?: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

function getEmailStatus(p: ConvexProposal) {
  if (p.viewedAt) return "Opened";
  if (p.sentAt)   return "Sent";
  return "Not sent";
}
function getSignatureStatus(p: ConvexProposal) {
  if (p.acceptedAt) return "Signed";
  if (p.sentAt)     return "Pending";
  return "Not required";
}
function getStartDate(p: ConvexProposal) {
  if (!p.startMonth) return "—";
  return p.startMonth;
}
function getEmailBadge(status: string) {
  if (status === "Opened") return "bg-emerald-50 border border-emerald-200 text-emerald-700";
  if (status === "Sent")   return "bg-violet-50 border border-violet-200 text-violet-600";
  return null;
}
function getSigBadge(status: string) {
  if (status === "Signed")  return "bg-emerald-50 border border-emerald-200 text-emerald-700";
  if (status === "Pending") return "bg-amber-50 border border-amber-200 text-amber-700";
  return "bg-slate-50 border border-slate-200 text-slate-500";
}
function getProposalStatusLabel(status: string) {
  return PROPOSAL_STATUS_MAP[status]?.label ?? status;
}
function getProposalStatusCls(status: string) {
  return PROPOSAL_STATUS_MAP[status]?.cls ?? "bg-slate-100 text-slate-600";
}

type SectionId = "summary" | "analytics" | "activity" | "pricing";
const ITEMS_PER_PAGE = 5;
const SERVICES_PER_PAGE = 8;

// ── Custom tooltips ───────────────────────────────────────────────────────────

function WinRateTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-[12px] px-3 py-2 rounded-lg shadow-lg">
      <p className="text-white/50 text-[10px] mb-0.5">{label}</p>
      <p className="font-semibold">{payload[0].value}%</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useNorthPactAuth();
  const uid = user ? (user.id as Id<"users">) : undefined;

  const metrics     = useQuery(api.dashboard.getDashboardMetrics, uid ? {} : "skip");
  const allProposals = useQuery(api.proposals.listProposals,   uid ? { userId: uid } : "skip");
  const clients     = useQuery(api.clients.listClients,        uid ? { userId: uid } : "skip");
  const services    = useQuery(api.services.listServices,      uid ? { userId: uid } : "skip");
  const activities  = useQuery(api.dashboard.getRecentActivity, uid ? {} : "skip");

  const sendProposalEmail = useAction(api.email.sendProposalEmail);
  const duplicateProposal = useMutation(api.proposals.duplicateProposal);
  const deleteProposalMut = useMutation(api.proposals.deleteProposal);

  const loading = allProposals === undefined || clients === undefined;

  const searchParams = useSearchParams();
  const section = (searchParams.get("section") ?? "summary") as SectionId;

  const [proposalPage,    setProposalPage]    = useState(0);
  const [servicesPage,    setServicesPage]    = useState(0);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Derived metrics ──────────────────────────────────────────────────────
  const proposals = dedupeById(allProposals ?? []);

  const acceptedProposals = useMemo(
    () => proposals.filter((p) => p.status === "accepted"),
    [proposals]
  );
  const totalRevenue = useMemo(
    () => acceptedProposals.reduce((s, p) => s + p.total, 0),
    [acceptedProposals]
  );
  const avgDealValue = acceptedProposals.length > 0 ? totalRevenue / acceptedProposals.length : 0;
  const winRate = proposals.length > 0 ? (acceptedProposals.length / proposals.length) * 100 : 0;

  const pendingApproval = useMemo(
    () => proposals.filter((p) => p.status === "pending-approval").length,
    [proposals]
  );

  const now = Date.now();
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const acceptedThisMonth = useMemo(
    () => proposals.filter((p) => p.status === "accepted" && p.acceptedAt && p.acceptedAt >= thisMonthStart).length,
    [proposals, thisMonthStart]
  );

  // Status distribution for pie chart
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    proposals.forEach((p) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      status, count,
      ...(STATUS_CONFIG[status] ?? { label: status, dot: "bg-slate-300", text: "text-slate-500", color: "#94a3b8" }),
    }));
  }, [proposals]);
  const pieTotal = pipelineCounts.reduce((a, b) => a + b.count, 0);

  // Proposals by status for conversion funnel
  const proposalsByStatus = useMemo(() => {
    const c = { draft: 0, "pending-approval": 0, approved: 0, sent: 0, viewed: 0, accepted: 0, rejected: 0, expired: 0 };
    proposals.forEach((p) => { if (p.status in c) c[p.status as keyof typeof c]++; });
    return c;
  }, [proposals]);

  // Win rate history from metrics (weekly buckets)
  const winRateHistory = useMemo(() => {
    if (metrics?.winRateHistory?.length) {
      return metrics.winRateHistory.map((h, i) => ({ date: `W${i + 1}`, rate: h.winRate }));
    }
    // Fallback: compute from proposals
    const buckets: { date: string; sent: number; accepted: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const bucketEnd = now - i * 7 * 24 * 60 * 60 * 1000;
      const bucketStart = bucketEnd - 7 * 24 * 60 * 60 * 1000;
      const inBucket = proposals.filter((p) => p.createdAt >= bucketStart && p.createdAt < bucketEnd);
      const sent = inBucket.filter((p) => ["sent", "viewed", "accepted", "rejected"].includes(p.status)).length;
      const accepted = inBucket.filter((p) => p.status === "accepted").length;
      buckets.push({ date: `W${8 - i}`, sent, accepted });
    }
    return buckets.map((b) => ({ date: b.date, rate: b.sent > 0 ? Math.round((b.accepted / b.sent) * 100) : 0 }));
  }, [metrics, proposals, now]);

  // Client lookup map
  const clientMap = useMemo(
    () => Object.fromEntries((clients ?? []).map((c) => [c._id, c])),
    [clients]
  );

  // Proposals grouped by client
  const groupedByClient = useMemo(() => {
    const map = new Map<string, ConvexProposal[]>();
    proposals.forEach((p) => {
      const arr = map.get(p.clientId) ?? [];
      if (!arr.some((x) => x._id === p._id)) arr.push(p);
      map.set(p.clientId, arr);
    });
    return Array.from(map.values())
      .map((ps) => [...ps].sort((a, b) => b.createdAt - a.createdAt))
      .sort((a, b) => b[0].createdAt - a[0].createdAt);
  }, [proposals]);

  const groupedPageCount = Math.max(1, Math.ceil(groupedByClient.length / ITEMS_PER_PAGE));
  const pagedGroups = groupedByClient.slice(
    proposalPage * ITEMS_PER_PAGE, (proposalPage + 1) * ITEMS_PER_PAGE
  );

  // Services
  const svcList = services ?? [];
  const activeServices   = svcList.filter((s) => s.isActive).length;
  const inactiveServices = svcList.filter((s) => !s.isActive).length;
  const servicesTotalPages = Math.max(1, Math.ceil(svcList.length / SERVICES_PER_PAGE));
  const pagedServices = svcList.slice(
    servicesPage * SERVICES_PER_PAGE, (servicesPage + 1) * SERVICES_PER_PAGE
  );

  // ── Mutation handlers ────────────────────────────────────────────────────
  const handleSend = async (id: Id<"proposals">) => {
    if (!uid) return;
    try {
      await sendProposalEmail({ userId: uid, proposalId: id });
      toast.success("Proposal emailed to client");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send email";
      toast.error(msg);
    }
  };

  const handleDuplicate = async (id: Id<"proposals">) => {
    if (!uid) return;
    try {
      const result = await duplicateProposal({ userId: uid, proposalId: id });
      if (result.success) toast.success("Proposal duplicated");
      else toast.error(result.error ?? "Failed to duplicate proposal");
    } catch {
      toast.error("Failed to duplicate proposal");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId || !uid) return;
    try {
      const result = await deleteProposalMut({ userId: uid, proposalId: deleteConfirmId as Id<"proposals"> });
      if (result.success) toast.success("Proposal deleted");
      else toast.error(result.error ?? "Failed to delete proposal");
    } catch {
      toast.error("Failed to delete proposal");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Stats cards
  const statsCards = [
    {
      label: "Total Proposals", sublabel: `${clients?.length ?? 0} clients`,
      value: proposals.length.toString(),
      icon: FileText, iconBg: "bg-[#C8A96E]/10", iconColor: "#C8A96E",
    },
    {
      label: "Win Rate", sublabel: "Accepted vs total",
      value: `${Math.round(winRate)}%`,
      icon: CheckCircle, iconBg: "bg-[#243E63]/10", iconColor: "#243E63",
    },
    {
      label: "Total Revenue", sublabel: "From accepted proposals",
      value: formatCurrency(totalRevenue),
      icon: Banknote, iconBg: "bg-[#243E63]/10", iconColor: "#243E63",
    },
    {
      label: "Avg Deal Value", sublabel: "Per accepted proposal",
      value: formatCurrency(avgDealValue),
      icon: BarChart3, iconBg: "bg-[#C8A96E]/10", iconColor: "#C8A96E",
    },
    {
      label: "Pending Approval", sublabel: "Awaiting review",
      value: pendingApproval.toString(),
      icon: Eye, iconBg: "bg-[#D9D4CE]/50", iconColor: "#243E63",
    },
    {
      label: "Accepted This Month", sublabel: "This calendar month",
      value: acceptedThisMonth.toString(),
      icon: TrendingUp, iconBg: "bg-emerald-50", iconColor: "#10b981",
    },
  ];

  return (
    <>
      <Header />

      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        {/* ── 6 Stats Cards ─────────────────────────────────────────────── */}
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

        {/* ── SUMMARY ───────────────────────────────────────────────────── */}
        {section === "summary" && (
          <>
            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Win Rate Trend — 2/3 */}
              <div className="lg:col-span-2 bg-white border border-slate-100 rounded-xl p-5 flex flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-0.5">
                  Win Rate Trend
                </p>
                <p className="text-[13px] font-semibold text-slate-800 mb-4">
                  Performance over the last 8 weeks
                </p>
                <div className="flex-1 min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={winRateHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="summaryWinGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#C8A96E" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#C8A96E" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} width={40} domain={[0, 100]} />
                      <Tooltip content={<WinRateTooltip />} cursor={{ stroke: "#C8A96E", strokeWidth: 1, strokeDasharray: "4 4" }} />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="#C8A96E"
                        strokeWidth={2}
                        fill="url(#summaryWinGrad)"
                        dot={{ r: 3, fill: "#C8A96E", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: "#C8A96E", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Distribution — 1/3 */}
              <div className="bg-white border border-slate-100 rounded-xl flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="text-[14px] font-semibold text-slate-900">Status Distribution</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Current proposal states</p>
                </div>

                <div className="flex flex-col items-center justify-center flex-1 py-5">
                  {loading ? (
                    <Skeleton className="h-[140px] w-[140px] rounded-full" />
                  ) : pieTotal > 0 ? (
                    <div className="relative" style={{ width: 140, height: 140 }}>
                      <PieChart width={140} height={140}>
                        <Pie
                          data={pipelineCounts}
                          cx={70} cy={70}
                          innerRadius={44} outerRadius={65}
                          dataKey="count"
                          startAngle={90} endAngle={-270}
                          strokeWidth={2} stroke="#fff"
                        >
                          {pipelineCounts.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[24px] font-bold text-slate-900 leading-none tabular-nums">
                          {pieTotal}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
                          total
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400 py-10">No proposals yet</p>
                  )}
                </div>

                {!loading && pipelineCounts.length > 0 && (
                  <div className="px-5 pb-5 space-y-2">
                    {pipelineCounts.map(({ status, count, label, dot }) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
                          {label}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 tabular-nums ml-2">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Proposals table */}
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <span className="text-[14px] font-semibold text-slate-900">Recent Proposals and Engagement Letters</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Proposals grouped by client — click &ldquo;Show History&rdquo; to see all proposals for a client
                  </p>
                </div>
                <Link
                  href="/proposals"
                  className="flex items-center gap-1 text-[12px] font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: "#C8A96E" }}
                >
                  View All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[1100px]">
                  <div className="grid grid-cols-[36px_1fr_72px_130px_72px_72px_100px_96px_130px_110px_44px] px-4 py-2.5 border-b border-slate-50 gap-3 bg-slate-50/60">
                    {["#","Client / Proposal","ID","Value","Status","Email","Signatures","Start date","Principal in charge","Created","Actions"].map((h, i) => (
                      <span key={i} className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 whitespace-nowrap">
                        {h}
                      </span>
                    ))}
                  </div>

                  {loading ? (
                    <div className="divide-y divide-slate-50">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[36px_1fr_72px_130px_72px_72px_100px_96px_130px_110px_44px] px-4 py-4 gap-3 items-center">
                          <Skeleton className="h-3 w-4 mx-auto" />
                          <Skeleton className="h-8 w-44" />
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-8 w-28" />
                          <Skeleton className="h-5 w-14 rounded" />
                          <Skeleton className="h-5 w-16 rounded" />
                          <Skeleton className="h-5 w-24 rounded" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-8 w-24" />
                          <Skeleton className="h-6 w-6 rounded mx-auto" />
                        </div>
                      ))}
                    </div>
                  ) : groupedByClient.length ? (
                    <>
                      <div className="divide-y divide-slate-50">
                        {pagedGroups.map((proposalGroup, idx) => {
                          const latest   = proposalGroup[0];
                          const older    = proposalGroup.slice(1);
                          const client   = clientMap[latest.clientId];
                          const clientId = latest.clientId;
                          const isOpen   = expandedClients.has(clientId);
                          const rowNum   = proposalPage * ITEMS_PER_PAGE + idx + 1;

                          const shortId     = latest.proposalNumber;
                          const statusLabel = getProposalStatusLabel(latest.status);
                          const statusCls   = getProposalStatusCls(latest.status);
                          const emailStatus = getEmailStatus(latest);
                          const sigStatus   = getSignatureStatus(latest);
                          const startDate   = getStartDate(latest);
                          const createdBy   = latest.createdByName ?? "—";
                          const emailBadge  = getEmailBadge(emailStatus);
                          const sigBadge    = getSigBadge(sigStatus);

                          const toggleExpand = () => {
                            const next = new Set(expandedClients);
                            isOpen ? next.delete(clientId) : next.add(clientId);
                            setExpandedClients(next);
                          };

                          return (
                            <Fragment key={`grp-${proposalPage * ITEMS_PER_PAGE + idx}`}>
                              <div className="grid grid-cols-[36px_1fr_72px_130px_72px_72px_100px_96px_130px_110px_44px] px-4 py-3.5 gap-3 items-start hover:bg-slate-50/60 transition-colors">
                                <span className="text-[11px] font-medium text-slate-300 text-center tabular-nums pt-1">{rowNum}</span>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-3 w-3 text-slate-400 shrink-0" />
                                    <Link href={`/proposals/${latest._id}`} className="text-[12px] font-semibold truncate hover:underline" style={{ color: "#C8A96E" }}>
                                      {client?.companyName ?? latest.clientName}
                                    </Link>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{latest.title}</p>
                                  {older.length > 0 && (
                                    <button
                                      onClick={toggleExpand}
                                      className="mt-1 text-[10px] font-semibold hover:underline flex items-center gap-1"
                                      style={{ color: "#C8A96E" }}
                                    >
                                      <History className="h-3 w-3 shrink-0" />
                                      {isOpen
                                        ? "Hide proposal history"
                                        : `Show proposal history (${older.length} older proposal${older.length !== 1 ? "s" : ""})`}
                                    </button>
                                  )}
                                </div>

                                <span className="text-[11px] font-semibold text-slate-700 pt-1">{shortId}</span>

                                <div className="pt-0.5">
                                  {latest.netMonthlyFee ? (
                                    <>
                                      <p className="text-[10px] text-slate-400 leading-tight">Monthly: {formatCurrency(latest.netMonthlyFee)}</p>
                                      <p className="text-[11px] font-semibold text-slate-800 leading-tight mt-0.5">One-Off: {formatCurrency(latest.oneOffFee ?? 0)}</p>
                                    </>
                                  ) : (
                                    <p className="text-[11px] font-semibold text-slate-800 leading-tight">{formatCurrency(latest.total)}</p>
                                  )}
                                </div>

                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mt-0.5 whitespace-nowrap", statusCls)}>
                                  {statusLabel}
                                </span>

                                {emailBadge ? (
                                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mt-0.5 whitespace-nowrap", emailBadge)}>
                                    {emailStatus}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400 pt-1">{emailStatus}</span>
                                )}

                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mt-0.5 whitespace-nowrap", sigBadge)}>
                                  {sigStatus}
                                </span>

                                <span className="text-[11px] text-slate-600 pt-1">{startDate}</span>
                                <span className="text-[11px] text-slate-400 pt-1">{createdBy}</span>

                                <div className="pt-0.5">
                                  <p className="text-[11px] text-slate-700 leading-tight">{formatDate(latest.createdAt)}</p>
                                </div>

                                <div className="flex justify-center pt-1">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors" aria-label="Actions">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-lg border border-slate-100 shadow-lg p-1">
                                      <DropdownMenuItem asChild>
                                        <Link href={`/proposals/${latest._id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
                                          <Eye className="h-4 w-4 shrink-0 text-slate-400" /> View
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link
                                          href={`/proposals/new?clientId=${latest.clientId}&editProposalId=${latest._id}`}
                                          className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
                                        >
                                          <Pencil className="h-4 w-4 shrink-0 text-blue-500" /> Edit
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link
                                          href={`/proposals/new?clientId=${latest.clientId}&fromProposalId=${latest._id}`}
                                          className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
                                        >
                                          <FilePlus className="h-4 w-4 shrink-0 text-[#C8A96E]" /> New proposal
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleSend(latest._id)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
                                        <Send className="h-4 w-4 shrink-0 text-violet-500" /> Send to client
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDuplicate(latest._id)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
                                        <Copy className="h-4 w-4 shrink-0 text-slate-400" /> Duplicate
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="my-1" />
                                      <DropdownMenuItem onClick={() => setDeleteConfirmId(latest._id)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md text-red-500 focus:text-red-600 focus:bg-red-50">
                                        <Trash2 className="h-4 w-4 shrink-0" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>

                              {isOpen && older.map((hp, oi) => {
                                const hEmail = getEmailStatus(hp);
                                const hSig   = getSignatureStatus(hp);
                                const hEmailBadge = getEmailBadge(hEmail);
                                const hSigBadge   = getSigBadge(hSig);
                                return (
                                  <div key={`${hp._id}-h${oi}-g${idx}`} className="grid grid-cols-[36px_1fr_72px_130px_72px_72px_100px_96px_130px_110px_44px] px-4 py-3 gap-3 items-start bg-slate-50/70 border-t border-dashed border-slate-100">
                                    <span />
                                    <div className="min-w-0 pl-4 border-l-2 border-slate-200">
                                      <Link href={`/proposals/${hp._id}`} className="text-[11px] font-semibold text-blue-600 hover:underline truncate block">
                                        {hp.proposalNumber}
                                      </Link>
                                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{hp.title}</p>
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-500">{hp.proposalNumber}</span>
                                    <div>
                                      {hp.netMonthlyFee ? (
                                        <>
                                          <p className="text-[10px] text-slate-400 leading-tight">Monthly: {formatCurrency(hp.netMonthlyFee)}</p>
                                          <p className="text-[11px] font-semibold text-slate-600 leading-tight mt-0.5">One-Off: {formatCurrency(hp.oneOffFee ?? 0)}</p>
                                        </>
                                      ) : (
                                        <p className="text-[11px] font-semibold text-slate-600">{formatCurrency(hp.total)}</p>
                                      )}
                                    </div>
                                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", getProposalStatusCls(hp.status))}>
                                      {getProposalStatusLabel(hp.status)}
                                    </span>
                                    {hEmailBadge ? (
                                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", hEmailBadge)}>{hEmail}</span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">{hEmail}</span>
                                    )}
                                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", hSigBadge)}>{hSig}</span>
                                    <span className="text-[11px] text-slate-500">{getStartDate(hp)}</span>
                                    <span className="text-[11px] text-slate-400">{hp.createdByName ?? "—"}</span>
                                    <div>
                                      <p className="text-[11px] text-slate-500 leading-tight">{formatDate(hp.createdAt)}</p>
                                    </div>
                                    <div className="flex justify-center">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors" aria-label="Actions">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 rounded-lg border border-slate-100 shadow-lg p-1">
                                          <DropdownMenuItem asChild>
                                            <Link href={`/proposals/${hp._id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
                                              <Eye className="h-4 w-4 shrink-0 text-slate-400" /> View
                                            </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem asChild>
                                            <Link
                                              href={`/proposals/new?clientId=${hp.clientId}&fromProposalId=${hp._id}`}
                                              className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
                                            >
                                              <FilePlus className="h-4 w-4 shrink-0 text-[#C8A96E]" /> New proposal
                                            </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleDuplicate(hp._id)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
                                            <Copy className="h-4 w-4 shrink-0 text-slate-400" /> Duplicate
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator className="my-1" />
                                          <DropdownMenuItem onClick={() => setDeleteConfirmId(hp._id)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md text-red-500 focus:text-red-600 focus:bg-red-50">
                                            <Trash2 className="h-4 w-4 shrink-0" /> Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </div>

                      {groupedPageCount > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                          <span className="text-[11px] text-slate-400">
                            {proposalPage * ITEMS_PER_PAGE + 1}–{Math.min((proposalPage + 1) * ITEMS_PER_PAGE, groupedByClient.length)} of {groupedByClient.length} clients
                          </span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setProposalPage((p) => Math.max(0, p - 1))} disabled={proposalPage === 0} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            {Array.from({ length: groupedPageCount }).map((_, i) => (
                              <button key={i} onClick={() => setProposalPage(i)}
                                className={cn("h-7 w-7 flex items-center justify-center rounded-md text-[11px] font-semibold transition-colors", proposalPage === i ? "text-white" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100")}
                                style={proposalPage === i ? { background: "#C8A96E" } : {}}>
                                {i + 1}
                              </button>
                            ))}
                            <button onClick={() => setProposalPage((p) => Math.min(groupedPageCount - 1, p + 1))} disabled={proposalPage === groupedPageCount - 1} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <FileText className="h-8 w-8 text-slate-200 mb-3" />
                      <p className="text-[13px] text-slate-400">No proposals yet</p>
                      <Link href="/proposals/new" className="mt-3 text-[12px] font-semibold hover:underline" style={{ color: "#C8A96E" }}>
                        Create your first proposal
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── ANALYTICS ─────────────────────────────────────────────────── */}
        {section === "analytics" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Win Rate Trend */}
              <div className="bg-white border border-slate-100 rounded-xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-0.5">Win Rate Trend</p>
                <p className="text-[13px] font-semibold text-slate-800 mb-4">Win rate over the last 8 weeks</p>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={winRateHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="winGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#C8A96E" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#C8A96E" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} width={40} />
                      <Tooltip content={<WinRateTooltip />} cursor={{ stroke: "#C8A96E", strokeWidth: 1, strokeDasharray: "4 4" }} />
                      <Area type="monotone" dataKey="rate" stroke="#C8A96E" strokeWidth={2} fill="url(#winGrad)"
                        dot={{ r: 3, fill: "#C8A96E", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: "#C8A96E", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Conversion Funnel */}
              <div className="bg-white border border-slate-100 rounded-xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-0.5">Conversion Funnel</p>
                <p className="text-[13px] font-semibold text-slate-800 mb-4">Proposal journey breakdown</p>
                <div className="space-y-4">
                  {[
                    { label: "Created",  value: proposals.length,                                                                                                    color: "#94a3b8" },
                    { label: "Sent",     value: proposalsByStatus.sent + proposalsByStatus.viewed + proposalsByStatus.accepted + proposalsByStatus.rejected,         color: "#243E63" },
                    { label: "Viewed",   value: proposalsByStatus.viewed + proposalsByStatus.accepted + proposalsByStatus.rejected,                                   color: "#C8A96E" },
                    { label: "Accepted", value: proposalsByStatus.accepted,                                                                                          color: "#10b981" },
                  ].map((stage) => {
                    const pct = proposals.length > 0 ? Math.round((stage.value / proposals.length) * 100) : 0;
                    return (
                      <div key={stage.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">{stage.label}</span>
                          <span className="font-semibold text-slate-900">{stage.value}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: stage.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Win Rate",     value: `${Math.round(winRate)}%`,    sublabel: "Accepted vs total proposals",  icon: CheckCircle, iconBg: "bg-[#C8A96E]/10", iconColor: "#C8A96E" },
                { label: "Avg Deal Size", value: formatCurrency(avgDealValue), sublabel: "Average per accepted proposal", icon: Banknote,    iconBg: "bg-[#243E63]/10", iconColor: "#243E63" },
                { label: "Total Revenue", value: formatCurrency(totalRevenue), sublabel: "From accepted proposals",       icon: BarChart3,   iconBg: "bg-[#C8A96E]/10", iconColor: "#C8A96E" },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="bg-white border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", card.iconBg)}>
                        <Icon className="h-[15px] w-[15px]" style={{ color: card.iconColor }} />
                      </div>
                      <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
                    </div>
                    <p className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">{card.value}</p>
                    <p className="text-[10px] text-slate-400">{card.sublabel}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ACTIVITY ──────────────────────────────────────────────────── */}
        {section === "activity" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[14px] font-semibold text-slate-900">Recent Activity</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Timeline of your proposal activities</p>
            </div>
            <div className="p-5">
              {activities === undefined ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (activities ?? []).length > 0 ? (
                <div className="space-y-0">
                  {(activities ?? []).map((item, index) => {
                    const isLast = index === (activities ?? []).length - 1;
                    const iconMap: Record<string, { icon: ReactNode; bg: string }> = {
                      created:  { icon: <FileText   className="h-4 w-4" />, bg: "bg-slate-100 text-slate-600" },
                      sent:     { icon: <Send       className="h-4 w-4" />, bg: "bg-blue-100 text-blue-600" },
                      accepted: { icon: <CheckCircle className="h-4 w-4" />, bg: "bg-emerald-100 text-emerald-600" },
                      rejected: { icon: <XCircle    className="h-4 w-4" />, bg: "bg-red-100 text-red-600" },
                    };
                    const cfg = iconMap[item.type] ?? { icon: <Activity className="h-4 w-4" />, bg: "bg-slate-100 text-slate-500" };
                    return (
                      <div key={`${item._id}-${index}`} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", cfg.bg)}>
                            {cfg.icon}
                          </div>
                          {!isLast && <div className="w-0.5 flex-1 bg-slate-100 my-1" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-[12px] font-medium text-slate-900">{item.description}</p>
                          <p className="text-[10px] text-slate-300 mt-0.5">{formatDate(item.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Activity className="h-8 w-8 text-slate-200 mb-3" />
                  <p className="text-[13px] text-slate-400">No activity yet</p>
                  <p className="text-[11px] text-slate-300 mt-1">Start creating proposals to see your activity</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PRICING ───────────────────────────────────────────────────── */}
        {section === "pricing" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Services", value: svcList.length,   sublabel: "In catalog",    icon: Package,     iconBg: "bg-[#C8A96E]/10", iconColor: "#C8A96E" },
                { label: "Active",         value: activeServices,   sublabel: "Live",           icon: CheckCircle, iconBg: "bg-emerald-50",   iconColor: "#10b981" },
                { label: "Inactive",       value: inactiveServices, sublabel: "Not live",       icon: FileText,    iconBg: "bg-[#D9D4CE]/40", iconColor: "#64748b" },
                { label: "Categories",     value: new Set(svcList.map((s) => s.category)).size, sublabel: "Service groups", icon: BarChart3, iconBg: "bg-[#243E63]/10", iconColor: "#243E63" },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="bg-white border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", card.iconBg)}>
                        <Icon className="h-[15px] w-[15px]" style={{ color: card.iconColor }} />
                      </div>
                      <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
                    </div>
                    {loading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <p className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">{card.value}</p>
                    )}
                    <p className="text-[10px] text-slate-400">{card.sublabel}</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">Service Catalog</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{svcList.length} service{svcList.length !== 1 ? "s" : ""} in your catalog</p>
                </div>
                <Link href="/services" className="flex items-center gap-1 text-[12px] font-semibold hover:underline" style={{ color: "#C8A96E" }}>
                  Manage pricing <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-[40px_1fr_160px_130px_120px_80px] px-5 py-2.5 border-b border-slate-50 gap-4">
                {["#", "SERVICE", "CATEGORY", "TYPE", "PRICE", "STATUS"].map((h, i) => (
                  <span key={h} className={cn("text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400", i === 0 && "text-center")}>{h}</span>
                ))}
              </div>

              {services === undefined ? (
                <div className="divide-y divide-slate-50">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[40px_1fr_160px_130px_120px_80px] px-5 py-3.5 gap-4 items-center">
                      <Skeleton className="h-4 w-6 mx-auto" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                  ))}
                </div>
              ) : svcList.length ? (
                <>
                  <div className="divide-y divide-slate-50">
                    {pagedServices.map((svc, i) => {
                      const startIdx = servicesPage * SERVICES_PER_PAGE;
                      const price = svc.fixedPrice ?? svc.hourlyRate ?? 0;
                      const typeColors: Record<string, string> = {
                        fixed: "text-blue-600", hourly: "text-emerald-600",
                        tiered: "text-amber-600", recurring: "text-violet-600",
                      };
                      return (
                        <div key={`svc-${svc._id}-${i}`} className="grid grid-cols-[40px_1fr_160px_130px_120px_80px] px-5 py-3.5 gap-4 items-center hover:bg-slate-50/70 transition-colors">
                          <span className="text-[11px] font-medium text-slate-400 text-center">{startIdx + i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900 truncate">{svc.name}</p>
                            {svc.description && <p className="text-[11px] text-slate-400 truncate mt-0.5">{svc.description}</p>}
                          </div>
                          <span className="text-[12px] text-slate-500 truncate">{svc.category}</span>
                          <span className={cn("text-[11px] font-medium capitalize", typeColors[svc.pricingType] ?? "text-slate-500")}>
                            {svc.pricingType}
                          </span>
                          <span className="text-[12px] font-semibold text-slate-800 tabular-nums">{formatCurrency(price)}</span>
                          <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", svc.isActive ? "text-emerald-600" : "text-slate-400")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", svc.isActive ? "bg-emerald-400" : "bg-slate-300")} />
                            {svc.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {servicesTotalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400">
                        {servicesPage * SERVICES_PER_PAGE + 1}–{Math.min((servicesPage + 1) * SERVICES_PER_PAGE, svcList.length)} of {svcList.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setServicesPage((p) => Math.max(0, p - 1))} disabled={servicesPage === 0} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        {Array.from({ length: servicesTotalPages }).map((_, i) => (
                          <button key={i} onClick={() => setServicesPage(i)}
                            className={cn("h-7 w-7 flex items-center justify-center rounded-md text-[11px] font-semibold transition-colors", servicesPage === i ? "text-white" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100")}
                            style={servicesPage === i ? { background: "#C8A96E" } : {}}>
                            {i + 1}
                          </button>
                        ))}
                        <button onClick={() => setServicesPage((p) => Math.min(servicesTotalPages - 1, p + 1))} disabled={servicesPage === servicesTotalPages - 1} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="h-8 w-8 text-slate-200 mb-3" />
                  <p className="text-[13px] text-slate-400">No services yet</p>
                  <Link href="/services" className="mt-3 text-[12px] font-semibold hover:underline" style={{ color: "#C8A96E" }}>Add your first service</Link>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Delete confirm dialog ───────────────────────────────────── */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this proposal? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
