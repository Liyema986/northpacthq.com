"use client";

import { useState, useMemo, Fragment } from "react";
import { Header } from "@/components/layout/header";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, FileText, TrendingUp, CheckCircle2,
  Clock, Copy, Trash2, MoreHorizontal, Download,
  Eye, Pencil, Send, User, History, Banknote, FilePlus,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn, dedupeById } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function getStatusLabel(status: string) { return PROPOSAL_STATUS_MAP[status]?.label ?? status; }
function getStatusCls(status: string)   { return PROPOSAL_STATUS_MAP[status]?.cls ?? "bg-slate-50 border border-slate-200 text-slate-600"; }
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
function getStartDate(p: ConvexProposal) { return p.startMonth ?? "—"; }
function getEmailBadge(s: string) {
  if (s === "Opened") return "bg-emerald-50 border border-emerald-200 text-emerald-700";
  if (s === "Sent")   return "bg-violet-50 border border-violet-200 text-violet-600";
  return null;
}
function getSigBadge(s: string) {
  if (s === "Signed")  return "bg-emerald-50 border border-emerald-200 text-emerald-700";
  if (s === "Pending") return "bg-amber-50 border border-amber-200 text-amber-700";
  return "bg-slate-50 border border-slate-200 text-slate-500";
}

const GRID = "grid-cols-[36px_1fr_120px_130px_72px_72px_100px_96px_130px_110px_44px]";
const ITEMS_PER_PAGE = 10;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const { user } = useNorthPactAuth();
  const uid = user ? (user.id as Id<"users">) : undefined;

  const proposals = useQuery(api.proposals.listProposals, uid ? { userId: uid } : "skip");
  const loading = proposals === undefined;

  const sendProposalEmail = useAction(api.email.sendProposalEmail);
  const duplicateProposalMut = useMutation(api.proposals.duplicateProposal);
  const deleteProposalMut   = useMutation(api.proposals.deleteProposal);

  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [page,            setPage]            = useState(1);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset page + collapse rows on filter/search change
  useMemo(() => { setPage(1); setExpandedClients(new Set()); }, [statusFilter, search]);

  const proposalList = dedupeById(proposals ?? []);

  const stats = useMemo(() => {
    const accepted = proposalList.filter((p) => p.status === "accepted");
    return {
      total:    proposalList.length,
      clients:  new Set(proposalList.map((p) => p.clientId)).size,
      drafts:   proposalList.filter((p) => p.status === "draft").length,
      pending:  proposalList.filter((p) => p.status === "pending-approval").length,
      live:     proposalList.filter((p) => ["sent", "viewed"].includes(p.status)).length,
      won:      accepted.length,
      totalAcv: accepted.reduce((s, p) => s + p.total, 0),
    };
  }, [proposalList]);

  const filtered = useMemo(() =>
    proposalList.filter((p) => {
      if (statusFilter === "sent" && !["sent", "viewed"].includes(p.status)) return false;
      if (statusFilter !== "all" && statusFilter !== "sent" && p.status !== statusFilter) return false;
      if (!search.trim()) return true;
      return (
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.clientName.toLowerCase().includes(search.toLowerCase()) ||
        p.proposalNumber.toLowerCase().includes(search.toLowerCase())
      );
    }),
    [proposalList, search, statusFilter]
  );

  const groupedByClient = useMemo(() => {
    const map = new Map<string, ConvexProposal[]>();
    filtered.forEach((p) => {
      const arr = map.get(p.clientId) ?? [];
      if (!arr.some((x) => x._id === p._id)) arr.push(p);
      map.set(p.clientId, arr);
    });
    return Array.from(map.values())
      .map((ps) => [...ps].sort((a, b) => b.createdAt - a.createdAt))
      .sort((a, b) => b[0].createdAt - a[0].createdAt);
  }, [filtered]);

  const totalPages  = Math.max(1, Math.ceil(groupedByClient.length / ITEMS_PER_PAGE));
  const pagedGroups = groupedByClient.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ── Mutation handlers ─────────────────────────────────────────────────────

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
      const result = await duplicateProposalMut({ userId: uid, proposalId: id });
      if (result.success) toast.success("Proposal duplicated");
      else toast.error(result.error ?? "Failed to duplicate proposal");
    } catch { toast.error("Failed to duplicate proposal"); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId || !uid) return;
    try {
      const result = await deleteProposalMut({ userId: uid, proposalId: deleteConfirmId as Id<"proposals"> });
      if (result.success) toast.success("Proposal deleted");
      else toast.error(result.error ?? "Failed to delete proposal");
    } catch { toast.error("Failed to delete proposal"); }
    finally { setDeleteConfirmId(null); }
  };

  function exportCsv() {
    const rows = [
      ["Number", "Title", "Client", "Status", "Total", "Created"],
      ...filtered.map((p) => [
        p.proposalNumber,
        p.title,
        p.clientName,
        getStatusLabel(p.status),
        String(p.total),
        formatDate(p.createdAt),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "proposals.csv";
    a.click();
    toast.success("CSV exported");
  }

  // ── Stat tiles config ─────────────────────────────────────────────────────

  const STAT_TILES = [
    { key: "all",              label: "All Proposals",    value: loading ? null : String(stats.total),         sublabel: `${stats.clients} client${stats.clients !== 1 ? "s" : ""}`, icon: FileText,     iconBg: "bg-[#C8A96E]/8",  iconColor: "#C8A96E" },
    { key: "draft",            label: "Drafts",           value: loading ? null : String(stats.drafts),        sublabel: "in progress",     icon: Clock,        iconBg: "bg-slate-100", iconColor: "#94a3b8" },
    { key: "pending-approval", label: "Pending",          value: loading ? null : String(stats.pending),       sublabel: "awaiting approval", icon: Clock,      iconBg: "bg-amber-50", iconColor: "#f59e0b" },
    { key: "sent",             label: "Live",             value: loading ? null : String(stats.live),          sublabel: "sent or viewed",  icon: TrendingUp,   iconBg: "bg-blue-50",  iconColor: "#3b82f6" },
    { key: "accepted",         label: "Won",              value: loading ? null : String(stats.won),           sublabel: "accepted",        icon: CheckCircle2, iconBg: "bg-emerald-50", iconColor: "#10b981" },
    { key: "_acv",             label: "Total Revenue",    value: loading ? null : formatCurrency(stats.totalAcv), sublabel: "from won proposals", icon: Banknote, iconBg: "bg-[#C8A96E]/8", iconColor: "#C8A96E" },
  ];

  // ── Actions dropdown component ───────────────────────────────────────────

  function ActionsDropdown({ p, isHistory = false }: { p: ConvexProposal; isHistory?: boolean }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors" aria-label="Actions">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-lg border border-slate-100 shadow-lg p-1">
          <DropdownMenuItem asChild>
            <Link href={`/proposals/${p._id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
              <Eye className="h-4 w-4 shrink-0 text-slate-400" /> View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={`/proposals/new?clientId=${p.clientId}&editProposalId=${p._id}`}
              className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
            >
              <Pencil className="h-4 w-4 shrink-0 text-blue-500" /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={`/proposals/new?clientId=${p.clientId}&fromProposalId=${p._id}`}
              className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
            >
              <FilePlus className="h-4 w-4 shrink-0 text-[#C8A96E]" /> New proposal
            </Link>
          </DropdownMenuItem>
          {!isHistory && (
            <DropdownMenuItem onClick={() => handleSend(p._id)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
              <Send className="h-4 w-4 shrink-0 text-violet-500" /> Send to client
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => handleDuplicate(p._id)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
            <Copy className="h-4 w-4 shrink-0 text-slate-400" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem onClick={() => setDeleteConfirmId(p._id)} className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md text-red-500 focus:text-red-600 focus:bg-red-50">
            <Trash2 className="h-4 w-4 shrink-0" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        {/* ── Stat tiles ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAT_TILES.map(({ key, label, value, sublabel, icon: Icon, iconBg, iconColor }) => {
            const isFilter = !key.startsWith("_");
            const isActive = isFilter && statusFilter === key;
            const Wrapper  = isFilter ? "button" : "div";
            return (
              <Wrapper
                key={key}
                {...(isFilter ? { onClick: () => setStatusFilter(statusFilter === key ? "all" : key) } : {})}
                className={cn(
                  "bg-white border rounded-xl p-4 text-left transition-all",
                  isFilter && "cursor-pointer hover:border-slate-200",
                  isActive ? "border-[#C8A96E]/40 ring-1 ring-[#C8A96E]/20" : "border-slate-100"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 leading-none">{label}</span>
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
                    <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                  </div>
                </div>
                {value === null ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-[26px] font-bold text-slate-900 leading-none tabular-nums">{value}</p>
                )}
                <p className="text-[11px] text-slate-400 mt-1 leading-tight">{sublabel}</p>
              </Wrapper>
            );
          })}
        </div>

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
              placeholder="Search by title, client or number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={exportCsv}
              disabled={loading || filtered.length === 0}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <Link
              href="/proposals/new"
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#C8A96E" }}
            >
              <Plus className="h-4 w-4" /> New Proposal
            </Link>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <span className="text-[14px] font-semibold text-slate-900">Recent Proposals and Engagement Letters</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Proposals grouped by client — click &ldquo;Show History&rdquo; to see all proposals for a client
              </p>
            </div>
            {!loading && (
              <span className="text-[11px] text-slate-400">
                {groupedByClient.length} client{groupedByClient.length !== 1 ? "s" : ""} · {filtered.length} proposal{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div className={cn("grid px-4 py-2.5 border-b border-slate-50 gap-3 bg-slate-50/60", GRID)}>
                {["#","Client / Proposal","Number","Value","Status","Email","Signatures","Start date","Created by","Created","Actions"].map((h, i) => (
                  <span key={i} className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 whitespace-nowrap">{h}</span>
                ))}
              </div>

              {loading ? (
                <div className="divide-y divide-slate-50">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={cn("grid px-4 py-4 gap-3 items-center", GRID)}>
                      <Skeleton className="h-3 w-4 mx-auto" />
                      <Skeleton className="h-9 w-44" />
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-9 w-28" />
                      <Skeleton className="h-5 w-14 rounded" />
                      <Skeleton className="h-5 w-14 rounded" />
                      <Skeleton className="h-5 w-22 rounded" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-9 w-24" />
                      <Skeleton className="h-6 w-6 rounded mx-auto" />
                    </div>
                  ))}
                </div>

              ) : groupedByClient.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <FileText className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-[15px] font-semibold text-slate-700">
                    {search || statusFilter !== "all" ? "No proposals match your filters" : "No proposals yet"}
                  </p>
                  {!search && statusFilter === "all" && (
                    <Link
                      href="/proposals/new"
                      className="mt-5 flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: "#C8A96E" }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Create first proposal
                    </Link>
                  )}
                </div>

              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {pagedGroups.map((group, idx) => {
                      const latest   = group[0];
                      const older    = group.slice(1);
                      const clientId = latest.clientId;
                      const isOpen   = expandedClients.has(clientId);
                      const rowNum   = (page - 1) * ITEMS_PER_PAGE + idx + 1;

                      const statusLabel = getStatusLabel(latest.status);
                      const statusCls   = getStatusCls(latest.status);
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
                        <Fragment key={`grp-${(page - 1) * ITEMS_PER_PAGE + idx}`}>
                          <div className={cn("grid px-4 py-3.5 gap-3 items-start hover:bg-slate-50/60 transition-colors", GRID)}>
                            <span className="text-[11px] font-medium text-slate-300 text-center tabular-nums pt-1">{rowNum}</span>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                <Link href={`/proposals/${latest._id}`} className="text-[12px] font-semibold truncate hover:underline" style={{ color: "#C8A96E" }}>
                                  {latest.clientName}
                                </Link>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{latest.title}</p>
                              {older.length > 0 && (
                                <button onClick={toggleExpand} className="mt-1 text-[10px] font-semibold hover:underline flex items-center gap-1" style={{ color: "#C8A96E" }}>
                                  <History className="h-3 w-3 shrink-0" />
                                  {isOpen ? "Hide proposal history" : `Show proposal history (${older.length} older proposal${older.length !== 1 ? "s" : ""})`}
                                </button>
                              )}
                            </div>

                            <span className="text-[11px] font-semibold text-slate-700 pt-1">{latest.proposalNumber}</span>

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
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mt-0.5 whitespace-nowrap", emailBadge)}>{emailStatus}</span>
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
                              <ActionsDropdown p={latest} />
                            </div>
                          </div>

                          {isOpen && older.map((hp, oi) => {
                            const hEmail    = getEmailStatus(hp);
                            const hSig      = getSignatureStatus(hp);
                            const hEmailBdg = getEmailBadge(hEmail);
                            const hSigBdg   = getSigBadge(hSig);
                            return (
                              <div key={`${hp._id}-h${oi}-g${idx}`} className={cn("grid px-4 py-3 gap-3 items-start bg-slate-50/70 border-t border-dashed border-slate-100", GRID)}>
                                <span />
                                <div className="min-w-0 pl-4 border-l-2 border-slate-200">
                                  <Link href={`/proposals/${hp._id}`} className="text-[11px] font-semibold text-blue-600 hover:underline truncate block">{hp.proposalNumber}</Link>
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
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", getStatusCls(hp.status))}>{getStatusLabel(hp.status)}</span>
                                {hEmailBdg ? (
                                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", hEmailBdg)}>{hEmail}</span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">{hEmail}</span>
                                )}
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", hSigBdg)}>{hSig}</span>
                                <span className="text-[11px] text-slate-500">{getStartDate(hp)}</span>
                                <span className="text-[11px] text-slate-400">{hp.createdByName ?? "—"}</span>
                                <div>
                                  <p className="text-[11px] text-slate-500 leading-tight">{formatDate(hp.createdAt)}</p>
                                </div>
                                <div className="flex justify-center">
                                  <ActionsDropdown p={hp} isHistory />
                                </div>
                              </div>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, groupedByClient.length)} of {groupedByClient.length} clients
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                          <button key={n} onClick={() => setPage(n)}
                            className={cn("h-7 w-7 flex items-center justify-center rounded-md text-[11px] font-semibold transition-colors", n === page ? "text-white" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100")}
                            style={n === page ? { background: "#C8A96E" } : {}}>
                            {n}
                          </button>
                        ))}
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

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
