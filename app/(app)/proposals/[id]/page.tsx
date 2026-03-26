"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Header } from "@/components/layout/header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChevronDown, ChevronLeft, Send, CheckCircle2, MoreHorizontal, FileText,
  DollarSign, TrendingUp, Clock, Download, User, Building2, Mail,
  MessageSquare, Plus, AlertCircle, Tag,
  Banknote, ArrowRight, Copy, Layers3, Users,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  draft:              { label: "Draft",            pill: "bg-slate-100 text-slate-600",     dot: "bg-slate-400" },
  "pending-approval": { label: "Pending Approval", pill: "bg-amber-100 text-amber-700",     dot: "bg-amber-400" },
  approved:           { label: "Approved",         pill: "bg-blue-100 text-blue-700",       dot: "bg-blue-400" },
  sent:               { label: "Sent",             pill: "bg-violet-100 text-violet-700",   dot: "bg-violet-400" },
  viewed:             { label: "Viewed",           pill: "bg-cyan-100 text-cyan-700",       dot: "bg-cyan-400" },
  accepted:           { label: "Won",              pill: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  rejected:           { label: "Lost",             pill: "bg-red-100 text-red-700",         dot: "bg-red-400" },
  expired:            { label: "Expired",          pill: "bg-slate-100 text-slate-500",     dot: "bg-slate-300" },
};

const TABS = [
  { value: "client",   label: "Client Details" },
  { value: "details",  label: "Proposal Details" },
  { value: "packages", label: "Packages" },
  { value: "services", label: "Selected Services" },
  { value: "totals",   label: "Totals" },
  { value: "email",    label: "Email Content" },
  { value: "timeline", label: "Timeline" },
  { value: "docs",     label: "Docs" },
];

// ─── Timeline note type ──────────────────────────────────────────────────────

interface TimelineNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  type: "note" | "status" | "created" | "sent";
}

// ─── Convex service item display type ────────────────────────────────────────

interface ConvexServiceItem {
  serviceId: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  description?: string;
}

// ─── Services grid ───────────────────────────────────────────────────────────

function ServicesGrid({ items }: { items: ConvexServiceItem[] }) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_100px_100px_100px] bg-slate-50/60 border-b border-slate-100 px-4 py-2.5 gap-2">
        {["Service", "Qty", "Unit Price", "Subtotal"].map((h) => (
          <span key={h} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider last:text-right">{h}</span>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <div key={`${item.serviceId}-${i}`} className="grid grid-cols-[1fr_100px_100px_100px] px-4 py-3 gap-2 hover:bg-slate-50/40 transition-colors items-center">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-900 truncate">{item.serviceName}</p>
              {item.description && (
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.description}</p>
              )}
            </div>
            <span className="text-[13px] text-slate-700 tabular-nums">{item.quantity}</span>
            <span className="text-[13px] text-slate-700 tabular-nums">{formatCurrency(item.unitPrice)}</span>
            <span className="text-[13px] font-semibold text-slate-900 tabular-nums text-right">{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_100px_100px_100px] px-4 py-3 gap-2 bg-slate-50/60">
          <span className="col-span-3 text-right text-[12px] text-slate-400 font-medium pr-2">Total</span>
          <span className="text-right text-[13px] font-bold text-slate-900 tabular-nums">{formatCurrency(items.reduce((s, i) => s + i.subtotal, 0))}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Build 12-month cash flow from monthly amount ────────────────────────────

function buildCashFlow(monthlyAmount: number) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  return months.map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return {
      month: i + 1,
      label: `${months[d.getMonth()]} ${d.getFullYear()}`,
      monthly: monthlyAmount,
      yearly: 0,
      onceoff: i === 0 ? 0 : 0,
      total: monthlyAmount,
    };
  });
}

// ─── Main inner component ────────────────────────────────────────────────────

function ProposalDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "client");

  useEffect(() => {
    setActiveTab(searchParams.get("tab") ?? "client");
  }, [searchParams]);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    router.push(`/proposals/${id}?tab=${tab}`, { scroll: false });
  }

  const [editTitle,     setEditTitle]     = useState("");
  const [editIntro,     setEditIntro]     = useState("");
  const [editTerms,     setEditTerms]     = useState("");
  const [editFrequency, setEditFrequency] = useState("monthly");
  const [savingDetails, setSavingDetails] = useState(false);

  const [paySchedule, setPaySchedule] = useState<"monthly" | "on_completion" | "blended">("blended");
  const [payStartMonth, setPayStartMonth] = useState("");
  const [payOneOffMonth, setPayOneOffMonth] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [notes,       setNotes]       = useState<TimelineNote[]>([]);
  const [noteText,    setNoteText]    = useState("");
  const [addingNote,  setAddingNote]  = useState(false);

  // ── Convex ──────────────────────────────────────────────────────────────
  const proposal = useQuery(
    api.proposals.getProposal,
    userId && id
      ? { userId, proposalId: id as Id<"proposals"> }
      : "skip"
  );
  const updateProposal = useMutation(api.proposals.updateProposal);
  const deleteProposal = useMutation(api.proposals.deleteProposal);
  const generateScopeLibraryLetter = useMutation(api.engagementLetters.generateLetterFromScopeLibrary);
  const generatedLetter = useQuery(
    api.engagementLetters.getLetterByProposal,
    userId && id ? { userId, proposalId: id as Id<"proposals"> } : "skip"
  );
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [docsProposalOpen, setDocsProposalOpen] = useState(false);
  const [docsLetterOpen, setDocsLetterOpen] = useState(false);
  const firmPackages = useQuery(
    api.packageTemplates.list,
    userId ? { userId } : "skip"
  );

  const loading = proposal === undefined;

  // Initialise edit state and timeline when proposal loads
  useEffect(() => {
    if (!proposal) return;
    setEditTitle(proposal.title);
    setEditIntro(proposal.introText ?? "Thank you for considering our services. We are pleased to present this proposal which outlines the accounting and advisory services we can provide to support your business goals.");
    setEditTerms(proposal.termsText ?? "Payment is due within 30 days of invoice date. This proposal is valid for 30 days from the date of issue. Prices are exclusive of VAT unless otherwise stated.");
    setPaySchedule(proposal.paymentSchedule ?? "blended");
    setPayStartMonth(proposal.cashFlowStartMonth ?? "");
    setPayOneOffMonth(proposal.oneOffCashMonth ?? "");
    setPayNotes(proposal.paymentNotes ?? "");

    const storageKey = `proposal-timeline-${id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setNotes(JSON.parse(stored));
    } else {
      const createdAt = new Date(proposal.createdAt).toISOString();
      const updatedAt = new Date(proposal.updatedAt).toISOString();
      const defaults: TimelineNote[] = [
        { id: "evt-created", text: "Proposal created", author: "System", createdAt, type: "created" },
        ...(proposal.status !== "draft" ? [{
          id: "evt-status",
          text: `Status changed to ${STATUS_CONFIG[proposal.status]?.label ?? proposal.status}`,
          author: "System",
          createdAt: updatedAt,
          type: "status" as const,
        }] : []),
      ];
      setNotes(defaults);
      localStorage.setItem(storageKey, JSON.stringify(defaults));
    }
  }, [proposal, id]);

  async function updateStatus(status: string) {
    if (!proposal || !userId) return;
    try {
      const result = await updateProposal({
        userId,
        proposalId: id as Id<"proposals">,
        status,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to update status");
        return;
      }
      const newNote: TimelineNote = {
        id: `evt-${Date.now()}`,
        text: `Status changed to ${STATUS_CONFIG[status]?.label ?? status}`,
        author: "You",
        createdAt: new Date().toISOString(),
        type: "status",
      };
      addTimelineNote(newNote);
      toast.success(`Status updated to ${STATUS_CONFIG[status]?.label ?? status}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  function addTimelineNote(note: TimelineNote) {
    setNotes((prev) => {
      const updated = [note, ...prev];
      localStorage.setItem(`proposal-timeline-${id}`, JSON.stringify(updated));
      return updated;
    });
  }

  async function savePaymentTerms() {
    if (!proposal || !userId) return;
    setSavingPayment(true);
    try {
      const result = await updateProposal({
        userId,
        proposalId: id as Id<"proposals">,
        paymentSchedule: paySchedule,
        cashFlowStartMonth: payStartMonth.trim() || undefined,
        oneOffCashMonth: payOneOffMonth.trim() || undefined,
        paymentNotes: payNotes.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save payment terms");
        return;
      }
      toast.success("Payment timing saved — cash flow will use these dates");
    } catch {
      toast.error("Failed to save payment terms");
    } finally {
      setSavingPayment(false);
    }
  }

  async function saveDetails() {
    if (!proposal || !userId) return;
    setSavingDetails(true);
    try {
      const result = await updateProposal({
        userId,
        proposalId: id as Id<"proposals">,
        title: editTitle.trim(),
        introText: editIntro.trim(),
        termsText: editTerms.trim(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save details");
        return;
      }
      toast.success("Proposal details saved");
    } catch {
      toast.error("Failed to save details");
    } finally {
      setSavingDetails(false);
    }
  }

  function submitNote() {
    if (!noteText.trim()) return;
    const note: TimelineNote = {
      id: `note-${Date.now()}`,
      text: noteText.trim(),
      author: "You",
      createdAt: new Date().toISOString(),
      type: "note",
    };
    addTimelineNote(note);
    setNoteText("");
    setAddingNote(false);
    toast.success("Note added to timeline");
  }

  async function handleDelete() {
    if (!proposal || !userId) return;
    try {
      const result = await deleteProposal({ userId, proposalId: id as Id<"proposals"> });
      if (!result.success) {
        toast.error(result.error ?? "Failed to delete proposal");
        return;
      }
      toast.success("Proposal deleted");
      router.push("/proposals");
    } catch {
      toast.error("Failed to delete proposal");
    }
  }

  async function handleGenerateScopeLibraryLetter() {
    if (!userId || !proposal) return;
    setGeneratingLetter(true);
    try {
      const result = await generateScopeLibraryLetter({
        userId,
        proposalId: id as Id<"proposals">,
      });
      if (result.success) {
        const count = result.letters.length;
        toast.success(
          `Generated ${count} engagement letter${count > 1 ? "s" : ""}`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate";
      toast.error(msg);
    } finally {
      setGeneratingLetter(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header><Skeleton className="h-4 w-48" /></Header>
        <div className="p-6 space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (!proposal) {
    return (
      <>
        <Header>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/proposals"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
        </Header>
        <div className="flex flex-col items-center justify-center py-32">
          <FileText className="h-12 w-12 text-slate-200 mb-3" />
          <p className="text-slate-400">Proposal not found</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/proposals">Back to proposals</Link>
          </Button>
        </div>
      </>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────
  const client = proposal.client;
  const items: ConvexServiceItem[] = (proposal.services ?? []).map((s) => ({
    serviceId:   s.serviceId,
    serviceName: s.serviceName,
    quantity:    s.quantity,
    unitPrice:   s.unitPrice,
    subtotal:    s.subtotal,
    description: s.description,
  }));
  const entities = (proposal.entities ?? []).map((e, i) => ({
    id:                 String(e.id ?? i),
    name:               e.name,
    entityType:         e.type,
    registrationNumber: undefined as string | undefined,
    taxNumber:          undefined as string | undefined,
    vatNumber:          undefined as string | undefined,
  }));

  const matchedCatalogPackage =
    proposal.packageTemplate?.trim()
      ? (firmPackages ?? []).find(
          (p) => p.name.trim() === proposal.packageTemplate!.trim()
        )
      : undefined;

  const monthlyTotal = proposal.netMonthlyFee ?? proposal.total;
  const oneOffTotal  = proposal.oneOffFee ?? 0;
  const acv          = monthlyTotal * 12;
  const year1Total   = acv + oneOffTotal;

  const cfg = STATUS_CONFIG[proposal.status] ?? { label: proposal.status, pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
  const cashFlow = buildCashFlow(monthlyTotal);
  const createdAtStr = new Date(proposal.createdAt).toISOString();
  const updatedAtStr = new Date(proposal.updatedAt).toISOString();

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Header>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href="/proposals"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-semibold text-slate-900 truncate">{proposal.title}</h1>
              {proposal.proposalNumber && (
                <span className="text-xs text-slate-400 font-mono shrink-0">{proposal.proposalNumber}</span>
              )}
              <span className={cn("inline-flex text-xs px-2 py-0.5 rounded-full font-medium shrink-0", cfg.pill)}>
                {cfg.label}
              </span>
            </div>
            {client && (
              <p className="text-xs text-slate-400 truncate">
                <Link href={`/clients/${client._id}`} className="hover:underline hover:text-slate-600">
                  {client.companyName}
                </Link>
                {" · "}Updated {formatDate(updatedAtStr)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {proposal.status === "draft" && (
              <button
                onClick={() => updateStatus("pending-approval")}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "#C8A96E" }}
              >
                <Send className="h-3.5 w-3.5" />Submit for Approval
              </button>
            )}
            {proposal.status === "pending-approval" && (
              <button
                onClick={() => updateStatus("approved")}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "#C8A96E" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />Approve
              </button>
            )}
            {proposal.status === "approved" && (
              <button
                onClick={() => updateStatus("sent")}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "#C8A96E" }}
              >
                <Send className="h-3.5 w-3.5" />Mark as Sent
              </button>
            )}
            {proposal.status === "sent" && (
              <Button variant="outline" size="sm" onClick={() => updateStatus("viewed")}>
                Mark as Viewed
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Change status</p>
                {Object.entries(STATUS_CONFIG).map(([s, c]) => (
                  <DropdownMenuItem key={s} onClick={() => updateStatus(s)}>
                    <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
                    {c.label}
                    {proposal.status === s && <span className="ml-auto text-[#C8A96E]">✓</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleGenerateScopeLibraryLetter}
                  disabled={generatingLetter}
                >
                  <FileText className="mr-2 h-4 w-4 text-slate-500" />
                  {generatingLetter ? "Generating…" : "Generate engagement letter"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:bg-red-50 focus:text-red-700"
                  onClick={handleDelete}
                >
                  Delete proposal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Header>

      <div className="p-6 space-y-5">
        {/* ── Stats cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: "Monthly Revenue",       value: formatCurrency(monthlyTotal),     sub: `${items.length} services`,   Icon: DollarSign,   iconBg: "rgba(59,130,246,0.1)",   iconColor: "text-blue-600" },
            { label: "Annual Contract Value", value: formatCurrency(acv),              sub: "ACV",                         Icon: TrendingUp,   iconBg: "rgba(16,185,129,0.1)",   iconColor: "text-emerald-600" },
            { label: "Year 1 Total",          value: formatCurrency(year1Total),       sub: "inc. once-off",               Icon: Banknote,     iconBg: "rgba(139,92,246,0.1)",   iconColor: "text-violet-600" },
            { label: "Estimated Hours",       value: "—",                              sub: "Not tracked",                 Icon: Clock,        iconBg: "rgba(245,158,11,0.1)",   iconColor: "text-amber-500" },
            { label: "Services",              value: String(items.length),             sub: "line items",                  Icon: FileText,     iconBg: "rgba(254,93,51,0.1)",    iconColor: "text-[#C8A96E]" },
            { label: "Status",                value: cfg.label,                        sub: formatDate(updatedAtStr),      Icon: CheckCircle2, iconBg: "rgba(100,116,139,0.1)", iconColor: "text-slate-500" },
          ].map(({ label, value, sub, Icon, iconBg, iconColor }) => (
            <div key={label} className="bg-white border border-slate-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
                  <Icon className={cn("w-4 h-4", iconColor)} />
                </div>
              </div>
              <div className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">{value}</div>
              <div className="text-[11px] font-medium text-slate-500">{label}</div>
              <div className="text-[10px] text-slate-400">{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Payment timing (won work → cash flow) ─────────────────────── */}
        {proposal.status === "accepted" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <p className="text-[13px] font-semibold text-slate-800">Payment & cash flow</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When cash comes in drives the firm <Link href="/cash-flow" className="text-[#C8A96E] font-medium hover:underline">Cash Flow</Link> overview.
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 text-[12px]"
                style={{ background: "#C8A96E" }}
                onClick={savePaymentTerms}
                disabled={savingPayment}
              >
                {savingPayment ? "Saving…" : "Save"}
              </Button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-slate-600">How does the client pay?</Label>
                <Select value={paySchedule} onValueChange={(v) => setPaySchedule(v as typeof paySchedule)}>
                  <SelectTrigger className="h-10 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly recurring</SelectItem>
                    <SelectItem value="on_completion">On completion (lump sum)</SelectItem>
                    <SelectItem value="blended">Blended (monthly + one-off)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-slate-600">Notes (optional)</Label>
                <Input
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. 50% deposit, balance on sign-off"
                  className="h-10 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-slate-600">First recurring payment month</Label>
                <Input
                  type="month"
                  value={payStartMonth}
                  onChange={(e) => setPayStartMonth(e.target.value)}
                  className="h-10 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-slate-600">One-off / completion payment month</Label>
                <Input
                  type="month"
                  value={payOneOffMonth}
                  onChange={(e) => setPayOneOffMonth(e.target.value)}
                  className="h-10 text-[13px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Pill tabs ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 rounded-xl p-1.5 flex items-center gap-1 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => handleTabChange(t.value)}
              className={cn(
                "h-8 px-3 rounded-lg text-[12px] font-medium transition-colors",
                activeTab === t.value
                  ? "bg-[#C8A96E]/10 text-[#C8A96E] font-semibold"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              {t.label}{t.value === "services" ? ` (${items.length})` : ""}
            </button>
          ))}
        </div>

        {/* ── Tab: Client Details ───────────────────────────────────────── */}
        {activeTab === "client" && (
          <div className="space-y-4">
            {client ? (
              <>
                <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span className="text-[13px] font-semibold text-slate-800">Client</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-[11px] text-slate-400 mb-0.5">Company</p>
                        <p className="text-[13px] font-medium text-slate-900">{client.companyName}</p>
                      </div>
                      {client.contactName && (
                        <div>
                          <p className="text-[11px] text-slate-400 mb-0.5">Contact</p>
                          <p className="text-[13px] font-medium text-slate-900">{client.contactName}</p>
                        </div>
                      )}
                      {client.email && (
                        <div>
                          <p className="text-[11px] text-slate-400 mb-0.5">Email</p>
                          <a href={`mailto:${client.email}`} className="text-[13px] text-blue-600 hover:underline flex items-center gap-1">
                            <Mail className="h-3 w-3" />{client.email}
                          </a>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/clients/${client._id}`}>
                        View full client profile
                      </Link>
                    </Button>
                  </div>
                </div>

                {entities.length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-blue-500" />
                        <span className="text-[13px] font-semibold text-slate-800">Legal Entities</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{entities.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {entities.map((entity, ei) => (
                        <div key={`ent-${entity.id}-${ei}`} className="px-4 py-3 flex items-center gap-3">
                          <span className="text-[13px] font-medium text-slate-900">{entity.name}</span>
                          <span className="text-[12px] text-slate-400 capitalize">{entity.entityType?.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
                <Building2 className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-[13px] text-slate-400">No client linked to this proposal</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Proposal Details ─────────────────────────────────────── */}
        {activeTab === "details" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[13px] font-semibold text-slate-800">Proposal Details</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Edit the core content of this proposal</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Proposal Title</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Frequency</Label>
                  <Select value={editFrequency} onValueChange={setEditFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                      <SelectItem value="as_delivered">As Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Introduction</Label>
                <Textarea rows={5} value={editIntro} onChange={(e) => setEditIntro(e.target.value)} placeholder="Write an introduction..." className="resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label>Terms & Conditions</Label>
                <Textarea rows={5} value={editTerms} onChange={(e) => setEditTerms(e.target.value)} placeholder="Enter the terms and conditions..." className="resize-none" />
              </div>
              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Proposal Number</p>
                  <p className="text-[13px] font-mono font-medium text-slate-900">{proposal.proposalNumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Created</p>
                  <p className="text-[13px] text-slate-700">{formatDate(createdAtStr)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Status</p>
                  <span className={cn("inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium", cfg.pill)}>{cfg.label}</span>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Last Updated</p>
                  <p className="text-[13px] text-slate-700">{formatDate(updatedAtStr)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={saveDetails}
                  disabled={savingDetails}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#C8A96E" }}
                >
                  {savingDetails ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Packages & structure ─────────────────────────────────── */}
        {activeTab === "packages" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-[13px] font-semibold text-slate-800">Structure</span>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-[12px] text-slate-500">
                    How this proposal is organised (single legal entity vs multiple entities in a group).
                  </p>
                  <div className="flex items-center gap-2">
                    {entities.length > 1 ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 text-violet-800 text-[12px] font-semibold px-3 py-1">
                          <Users className="h-3.5 w-3.5" />
                          Client group
                        </span>
                        <span className="text-[12px] text-slate-400">
                          {entities.length} legal entities
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-800 text-[12px] font-semibold px-3 py-1">
                        <Building2 className="h-3.5 w-3.5" />
                        Single entity
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <Layers3 className="h-4 w-4 text-[#C8A96E]" />
                  <span className="text-[13px] font-semibold text-slate-800">Package template</span>
                </div>
                <div className="p-4 space-y-3">
                  {proposal.packageTemplate?.trim() ? (
                    <>
                      <p className="text-[14px] font-medium text-slate-900">{proposal.packageTemplate.trim()}</p>
                      {matchedCatalogPackage ? (
                        <p className="text-[12px] text-slate-500">
                          Matches your catalog: {matchedCatalogPackage.includedServiceIds.length} service
                          {matchedCatalogPackage.includedServiceIds.length === 1 ? "" : "s"} included in this package.
                        </p>
                      ) : (
                        <p className="text-[12px] text-slate-500">
                          Saved name — may differ slightly from current catalog titles.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-slate-500">
                      No package was linked when this proposal was created. Services were added manually or from the library.
                    </p>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/packages">Manage packages</Link>
                  </Button>
                </div>
              </div>
            </div>

            {proposal.clientId && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8 text-[12px]" style={{ background: "#C8A96E" }} asChild>
                  <Link
                    href={`/proposals/new?clientId=${proposal.clientId}${matchedCatalogPackage ? `&packageId=${matchedCatalogPackage._id}` : ""}`}
                  >
                    New proposal from this client
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Selected Services ────────────────────────────────────── */}
        {activeTab === "services" && (
          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
                <FileText className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-[13px] text-slate-400">No services added</p>
                <Link
                  href={
                    proposal?.clientId
                      ? `/proposals/new?clientId=${proposal.clientId}`
                      : "/proposals/new"
                  }
                  className="mt-3 flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#C8A96E" }}
                >
                  Create new proposal with services
                </Link>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-[13px] font-semibold text-slate-800">Services ({items.length})</span>
                </div>
                <ServicesGrid items={items} />
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Totals ───────────────────────────────────────────────── */}
        {activeTab === "totals" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <span className="text-[13px] font-semibold text-slate-800">Revenue Breakdown</span>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label: "Monthly Revenue",  value: monthlyTotal, color: "text-blue-600",   dot: "bg-blue-400" },
                    { label: "Annual Revenue",   value: acv,          color: "text-violet-600", dot: "bg-violet-400" },
                    { label: "Once-off Revenue", value: oneOffTotal,  color: "text-amber-600",  dot: "bg-amber-400" },
                  ].map(({ label, value, color, dot }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", dot)} />
                        <span className="text-[13px] text-slate-500">{label}</span>
                      </div>
                      <span className={cn("text-[13px] font-semibold tabular-nums", color)}>{formatCurrency(value)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-slate-800">Annual Contract Value</span>
                      <span className="text-[18px] font-bold text-slate-900 tabular-nums">{formatCurrency(acv)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-slate-400">Year 1 Total</span>
                      <span className="text-[13px] font-medium text-slate-700 tabular-nums">{formatCurrency(year1Total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-slate-400">Total (proposal)</span>
                      <span className="text-[13px] font-medium text-slate-700 tabular-nums">{formatCurrency(proposal.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <span className="text-[13px] font-semibold text-slate-800">Service Totals</span>
                </div>
                <div className="p-4 space-y-3">
                  {items.map((item, idx) => (
                    <div key={`svc-${item.serviceId}-${idx}`} className="flex items-center justify-between">
                      <span className="text-[12px] text-slate-500 truncate max-w-[180px]">{item.serviceName}</span>
                      <span className="text-[12px] font-medium text-slate-700 tabular-nums">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  {items.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-slate-800">Total</span>
                      <span className="text-[14px] font-bold text-slate-900 tabular-nums">{formatCurrency(proposal.total)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[13px] font-semibold text-slate-800">12-Month Cash Flow Projection</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Expected monthly revenue based on contract value</p>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={cashFlow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cfMonthly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(value: number) => [formatCurrency(value), ""]} contentStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="monthly" stackId="1" stroke="#3b82f6" fill="url(#cfMonthly)" name="Monthly" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {cashFlow.map((m) => (
                    <div key={m.month} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg px-2 py-1.5">
                      <span className="text-slate-400">{m.label}</span>
                      <span className="font-medium text-slate-900 tabular-nums">{formatCurrency(m.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Email Content ────────────────────────────────────────── */}
        {activeTab === "email" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-800">Email Preview</h3>
                <p className="text-[11px] text-slate-400">This is the email that will be sent to the client</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: Proposal: ${proposal.title} — ${proposal.proposalNumber ?? ""}`);
                    toast.success("Subject line copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copy Subject
                </Button>
                <button
                  onClick={() => toast.info("Email sending available in production")}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#C8A96E" }}
                >
                  <Send className="h-3.5 w-3.5" />Send Email
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 w-14 shrink-0">To</span>
                <span className="text-[13px] font-medium text-slate-900">
                  {client?.email ?? "No email on record"}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex items-center gap-3">
                <span className="text-[11px] text-slate-400 w-14 shrink-0">Subject</span>
                <span className="text-[13px] font-medium text-slate-900">Proposal: {proposal.title} — {proposal.proposalNumber ?? ""}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="bg-[#C8A96E]/5 border-b border-slate-100 px-6 py-4">
                <p className="text-[13px] font-bold text-slate-900">NorthPact Advisory</p>
                <p className="text-[11px] text-slate-400">Your trusted accounting partner</p>
              </div>
              <div className="px-6 py-5 space-y-4 max-w-2xl">
                <p className="text-[13px] font-medium text-slate-900">
                  Dear {client?.contactName ?? client?.companyName ?? "Client"},
                </p>
                <p className="text-[13px] text-slate-500 leading-relaxed">{editIntro}</p>
                <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 space-y-2">
                  <p className="text-[13px] font-semibold text-slate-800">Proposal Summary</p>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div><span className="text-slate-400">Proposal Number: </span><span className="font-mono font-medium text-slate-900">{proposal.proposalNumber ?? "—"}</span></div>
                    <div><span className="text-slate-400">Client: </span><span className="font-medium text-slate-900">{client?.companyName}</span></div>
                    <div><span className="text-slate-400">Monthly Fee: </span><span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(monthlyTotal)}</span></div>
                    <div><span className="text-slate-400">Annual Value: </span><span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(acv)}</span></div>
                  </div>
                </div>
                {items.length > 0 && (
                  <div>
                    <p className="text-[13px] font-medium text-slate-800 mb-2">Services Included</p>
                    <ul className="space-y-1">
                      {items.slice(0, 6).map((item, idx) => (
                        <li key={`svc-${item.serviceId}-${idx}`} className="flex items-center gap-2 text-[12px] text-slate-500">
                          <ArrowRight className="h-3 w-3 text-[#C8A96E] shrink-0" />
                          <span>{item.serviceName}</span>
                          <span className="ml-auto font-medium text-slate-900 tabular-nums">{formatCurrency(item.subtotal)}</span>
                        </li>
                      ))}
                      {items.length > 6 && (
                        <li className="text-[11px] text-slate-400 pl-5">…and {items.length - 6} more services</li>
                      )}
                    </ul>
                  </div>
                )}
                <p className="text-[13px] text-slate-500 leading-relaxed">
                  Please review the full proposal attached. Should you have any questions, please do not hesitate to contact us.
                </p>
                <p className="text-[13px] text-slate-500">To accept this proposal, please sign and return the engagement letter.</p>
                <div className="border-t border-slate-100 pt-4 text-[11px] text-slate-400 space-y-1">
                  <p className="font-medium text-slate-700">NorthPact Advisory</p>
                  <p>{editTerms.slice(0, 120)}…</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Timeline ─────────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-800">Activity Timeline</h3>
                <p className="text-[11px] text-slate-400">Track status changes and notes for this proposal</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setAddingNote((v) => !v)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Add Note
              </Button>
            </div>

            {addingNote && (
              <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-3">
                <Textarea
                  rows={3}
                  placeholder="Write a note about this proposal..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="resize-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setAddingNote(false); setNoteText(""); }}>Cancel</Button>
                  <button
                    onClick={submitNote}
                    disabled={!noteText.trim()}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#C8A96E" }}
                  >
                    Save Note
                  </button>
                </div>
              </div>
            )}

            {notes.length === 0 && !addingNote ? (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
                <MessageSquare className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-[13px] text-slate-400">No activity yet</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddingNote(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Add first note
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-100" />
                <div className="space-y-4">
                  {notes.map((note, ni) => {
                    const isNote    = note.type === "note";
                    const isCreated = note.type === "created";
                    return (
                      <div key={`${note.id}-${ni}`} className="flex gap-4">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white",
                            !isCreated && (isNote ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600")
                          )}
                          style={isCreated ? { background: "#C8A96E", color: "white" } : undefined}
                        >
                          {isCreated ? <FileText className="h-4 w-4" /> : isNote ? <MessageSquare className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 bg-white border border-slate-100 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-medium text-slate-800">{note.author}</span>
                            <span className="text-[11px] text-slate-400">{formatDate(note.createdAt)}</span>
                          </div>
                          <p className="text-[13px] text-slate-500">{note.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Docs ─────────────────────────────────────────────────── */}
        {activeTab === "docs" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <Collapsible
                open={docsProposalOpen}
                onOpenChange={setDocsProposalOpen}
                className="min-w-0 w-full bg-white border border-slate-100 rounded-xl overflow-hidden"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 border-b border-slate-100 text-left transition-colors hover:bg-slate-50/80"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                        docsProposalOpen ? "rotate-180" : "rotate-0"
                      )}
                      aria-hidden
                    />
                    <FileText className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-[13px] font-semibold text-slate-800">Proposal Document</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{proposal.title}.pdf</p>
                        <p className="text-[11px] text-slate-400">{formatDate(createdAtStr)}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => toast.info("PDF generation available in production")}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />Download
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toast.info("PDF generation available in production")} className="flex-1">
                        Generate PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/${id}`); toast.success("Portal link copied"); }} className="flex-1">
                        Copy Portal Link
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible
                open={docsLetterOpen}
                onOpenChange={setDocsLetterOpen}
                className="min-w-0 w-full bg-white border border-slate-100 rounded-xl overflow-hidden"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 border-b border-slate-100 text-left transition-colors hover:bg-slate-50/80"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                        docsLetterOpen ? "rotate-180" : "rotate-0"
                      )}
                      aria-hidden
                    />
                    <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-[13px] font-semibold text-slate-800">Engagement Letter</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden">
                  <div className="p-4 space-y-3">
                    {generatedLetter ? (
                      <>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-amber-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{generatedLetter.letterNumber}</p>
                            <p className="text-[11px] text-slate-400">{generatedLetter.serviceType ?? "Engagement letter"} · {generatedLetter.status}</p>
                          </div>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-slate-100 bg-white p-5 text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">
                          {generatedLetter.content ?? ""}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[12px] text-slate-400">No engagement letter generated yet.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateScopeLibraryLetter}
                          disabled={generatingLetter}
                          className="w-full"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          {generatingLetter ? "Generating…" : "Generate engagement letter"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="text-[13px] font-semibold text-slate-800">Client Acceptance</span>
                </div>
                <div className="p-4 space-y-3">
                  {proposal.status === "accepted" ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-[12px] font-medium text-emerald-800">Proposal Accepted</p>
                        {proposal.acceptedAt && (
                          <p className="text-[11px] text-emerald-600">{formatDate(new Date(proposal.acceptedAt).toISOString())}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400">Awaiting client acceptance.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default function ProposalDetailPage() {
  return (
    <Suspense fallback={
      <>
        <Header><div className="h-4 w-48 bg-slate-100 animate-pulse rounded" /></Header>
        <div className="p-6 space-y-4">
          <div className="h-28 w-full bg-slate-100 animate-pulse rounded-xl" />
          <div className="h-10 w-full bg-slate-100 animate-pulse rounded-lg" />
          <div className="h-64 w-full bg-slate-100 animate-pulse rounded-xl" />
        </div>
      </>
    }>
      <ProposalDetailPageInner />
    </Suspense>
  );
}
