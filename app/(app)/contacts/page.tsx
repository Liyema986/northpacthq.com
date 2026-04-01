"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AddOrganisationSheet } from "@/components/sheets/AddOrganisationSheet";
import { AddIndividualSheet } from "@/components/sheets/AddIndividualSheet";
import { EditContactSheet } from "@/components/sheets/EditContactSheet";
import {
  Users,
  Building2,
  User,
  CheckCircle,
  AlertTriangle,
  Link2,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactGroup {
  id: string;
  companyName: string;
  contactType: "organisation" | "individual";
  status: "prospect" | "active" | "inactive" | "archived";
  primaryEmail: string;
  primaryPhone: string;
  contactName: string;
  createdAt: number;
  fromXero: boolean;
  xeroContactId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

const CATEGORY_VALUES = ["prospect", "active", "inactive", "archived"] as const;
type CategoryFilter = "any" | (typeof CATEGORY_VALUES)[number];

function isCategoryFilter(v: string): v is CategoryFilter {
  return v === "any" || (CATEGORY_VALUES as readonly string[]).includes(v);
}

function normalizeClientStatus(raw: string): ContactGroup["status"] {
  if (raw === "prospect" || raw === "active" || raw === "inactive" || raw === "archived") return raw;
  return "prospect";
}

function CategoryBadge({ status }: { status: string }) {
  const cls =
    status === "active"   ? "bg-blue-50 border border-blue-200 text-blue-700"    :
    status === "prospect" ? "bg-amber-50 border border-amber-200 text-amber-700" :
    status === "inactive" ? "bg-slate-50 border border-slate-200 text-slate-600" :
    status === "archived" ? "bg-slate-50 border border-slate-200 text-slate-400" :
                            "bg-slate-50 border border-slate-200 text-slate-500";
  const label =
    status === "active"   ? "Client"              :
    status === "prospect" ? "Prospect"            :
    status === "inactive" ? "Missed Opportunity"  :
    status === "archived" ? "Hidden"              :
                            "Prospect";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

const STAT_STYLES = [
  { iconBg: "bg-slate-100",   iconColor: "#64748b" },
  { iconBg: "bg-blue-50",     iconColor: "#3b82f6" },
  { iconBg: "bg-purple-50",   iconColor: "#8b5cf6" },
  { iconBg: "bg-emerald-50",  iconColor: "#10b981" },
  { iconBg: "bg-amber-50",    iconColor: "#f59e0b" },
  { iconBg: "bg-violet-50",   iconColor: "#7c3aed" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const router = useRouter();
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const convexClients = useQuery(api.clients.listClients, userId ? { userId, includeArchived: true } : "skip");
  const deleteClientMutation = useMutation(api.clients.deleteClient);
  const syncXeroContacts = useAction(api.integrations.syncXeroContactsToClients);
  const archiveXeroContact = useAction(api.integrations.archiveXeroContact);

  const groups: ContactGroup[] = useMemo(
    () => (convexClients ?? []).map((c) => ({
      id: c._id,
      companyName: c.companyName,
      contactType: (c.contactType ?? "organisation") as "organisation" | "individual",
      status: normalizeClientStatus(c.status),
      primaryEmail: c.email,
      primaryPhone: c.phone ?? "",
      contactName: c.contactName,
      createdAt: c.createdAt,
      fromXero: !!c.xeroContactId,
      xeroContactId: c.xeroContactId,
    })),
    [convexClients]
  );

  const loading = convexClients === undefined;

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("any");
  /** Contact shape: organisations vs individuals (replaces unused renewal placeholder). */
  const [typeFilter, setTypeFilter] = useState<"any" | "organisation" | "individual">("any");
  const [page, setPage]                     = useState(0);
  const [deleteTarget, setDeleteTarget]     = useState<{ id: string; name: string; xeroContactId?: string } | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [orgOpen, setOrgOpen]               = useState(false);
  const [indOpen, setIndOpen]               = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [editOpen, setEditOpen]             = useState(false);
  const [editClientId, setEditClientId]     = useState<Id<"clients"> | null>(null);
  const [selected, setSelected]             = useState<Set<string>>(new Set());

  // ─── Stats ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total         = groups.length;
    const organisations = groups.filter((g) => g.contactType === "organisation").length;
    const individuals   = groups.filter((g) => g.contactType === "individual").length;
    const active        = groups.filter((g) => g.status === "active").length;
    const archived      = groups.filter((g) => g.status === "archived").length;
    const fromXero      = groups.filter((g) => g.fromXero).length;
    return [
      { label: "Total Contacts",  sublabel: "All contacts",      value: total,         icon: Users },
      { label: "Organisations",   sublabel: "Companies",         value: organisations, icon: Building2 },
      { label: "Individuals",     sublabel: "People",            value: individuals,   icon: User },
      { label: "Active",          sublabel: "Xero ACTIVE",       value: active,        icon: CheckCircle },
      { label: "Archived",        sublabel: "Xero ARCHIVED",     value: archived,      icon: AlertTriangle },
      { label: "From Xero",       sublabel: "Synced from Xero",  value: fromXero,      icon: Link2 },
    ];
  }, [groups]);

  // ─── Filter + paginate ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      const categoryOk =
        categoryFilter === "any" || g.status === categoryFilter;
      const typeOk =
        typeFilter === "any" ||
        (typeFilter === "organisation" && g.contactType === "organisation") ||
        (typeFilter === "individual" && g.contactType === "individual");
      return categoryOk && typeOk;
    });
  }, [groups, categoryFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  /** Stay on a valid page when data or filters shrink the list. */
  useEffect(() => {
    setPage((p) => {
      const maxP = Math.max(0, totalPages - 1);
      return p > maxP ? maxP : p;
    });
    setSelected(new Set());
  }, [totalPages, filtered.length]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasFilters = categoryFilter !== "any" || typeFilter !== "any";

  async function handleDelete() {
    if (!userId || !deleteTarget) return;
    setDeleting(true);
    try {
      // Archive in Xero first if linked
      if (deleteTarget.xeroContactId) {
        const xeroResult = await archiveXeroContact({ userId, xeroContactId: deleteTarget.xeroContactId });
        if (!xeroResult.success && xeroResult.error !== "Xero not connected") {
          toast.error(`Xero: ${xeroResult.error}`);
        }
      }
      await deleteClientMutation({ userId, clientId: deleteTarget.id as Id<"clients"> });
      toast.success(`"${deleteTarget.name}" permanently deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete contact");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSync() {
    if (!userId) return;
    setSyncing(true);
    try {
      const result = await syncXeroContacts({ userId });
      if (result.error) {
        if (result.error === "Xero not connected") {
          toast.error("Xero is not connected. Go to Apps Map to connect first.");
        } else {
          toast.error(result.error);
        }
      } else {
        const parts: string[] = [];
        if (result.imported > 0) parts.push(`${result.imported} imported`);
        if (result.updated > 0)  parts.push(`${result.updated} updated`);
        if (result.skipped > 0)  parts.push(`${result.skipped} skipped`);
        toast.success(
          parts.length > 0
            ? `Synced from Xero — ${parts.join(", ")}`
            : "Xero sync complete — everything is up to date"
        );
      }
    } catch {
      toast.error("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });

  const categoryLabel =
    categoryFilter === "any"      ? "Any"               :
    categoryFilter === "active"   ? "Client"            :
    categoryFilter === "inactive" ? "Missed Opportunity":
    categoryFilter === "archived" ? "Hidden"            : "Prospect";

  const typeLabel =
    typeFilter === "any"           ? "Any" :
    typeFilter === "organisation" ? "Organisations" :
    "Individuals";

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        {/* ── Stats Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map((card, i) => {
            const Icon = card.icon;
            const s = STAT_STYLES[i];
            return (
              <div key={card.label} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", s.iconBg)}>
                    <Icon className="h-[15px] w-[15px]" style={{ color: s.iconColor }} />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 leading-tight">{card.label}</p>
                </div>
                <p className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">{card.value}</p>
                <p className="text-[10px] text-slate-400">{card.sublabel}</p>
              </div>
            );
          })}
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[150px] text-[12px] font-medium justify-between">
                  Category: {categoryLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0 ml-1" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                {[
                  { val: "any",      label: "Any" },
                  { val: "prospect", label: "Prospect" },
                  { val: "active",   label: "Client" },
                  { val: "inactive", label: "Missed Opportunity" },
                  { val: "archived", label: "Hidden" },
                ].map(({ val, label }) => (
                  <DropdownMenuItem
                    key={val}
                    onClick={() => {
                      setCategoryFilter(isCategoryFilter(val) ? val : "any");
                      setPage(0);
                    }}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[170px] text-[12px] font-medium justify-between">
                  Type: {typeLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0 ml-1" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                {[
                  { val: "any" as const,           label: "Any" },
                  { val: "organisation" as const, label: "Organisations" },
                  { val: "individual" as const,   label: "Individuals" },
                ].map(({ val, label }) => (
                  <DropdownMenuItem
                    key={val}
                    onClick={() => {
                      setTypeFilter(val);
                      setPage(0);
                    }}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[11px] font-normal text-slate-600 rounded"
                onClick={() => { setCategoryFilter("any"); setTypeFilter("any"); setPage(0); }}>
                Clear filters
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" disabled={syncing} onClick={handleSync}
              className="h-8 px-3 text-[11px] font-normal border-slate-200 bg-white hover:bg-slate-50 rounded">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync from Xero"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium text-white transition-opacity hover:opacity-90 min-w-[130px]"
                  style={{ background: "#C8A96E" }}>
                  <Plus className="h-3.5 w-3.5" />
                  Add new Contact
                  <ChevronDown size={10} className="ml-auto shrink-0" strokeWidth={2} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem onClick={() => setOrgOpen(true)}>
                  <Building2 className="h-3.5 w-3.5 mr-2.5 text-blue-500" />
                  Organisation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIndOpen(true)}>
                  <User className="h-3.5 w-3.5 mr-2.5 text-purple-500" />
                  Individual
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Contacts Table ───────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <span className="text-[14px] font-semibold text-slate-900">Contacts</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Contacts grouped by organisation — click &ldquo;Show contacts&rdquo; to see all individuals
              </p>
            </div>
            <span className="text-[11px] text-slate-400 tabular-nums">{filtered.length} total</span>
          </div>

          <div className="overflow-x-auto">
            <div className="w-full min-w-[900px]">
              {/* Balanced fr columns fill row width — no empty gap on the right */}
              {/* Column headers */}
              <div className="grid w-full grid-cols-[28px_36px_minmax(0,1.15fr)_minmax(0,0.52fr)_minmax(0,0.58fr)_minmax(0,1.05fr)_minmax(0,0.55fr)_minmax(0,0.5fr)_44px] gap-x-3 gap-y-0 px-4 py-2.5 border-b border-slate-50 bg-slate-50/60">
                <div className="flex items-center justify-center">
                  <input type="checkbox"
                    checked={paged.length > 0 && paged.every(g => selected.has(g.id))}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) paged.forEach(g => next.add(g.id));
                      else paged.forEach(g => next.delete(g.id));
                      setSelected(next);
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-[#C8A96E]" />
                </div>
                {["#","Contact / Organisation","Category","Contact Name","Email","Phone","Added","Actions"].map((h) => (
                  <span key={h} className={cn("text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 whitespace-nowrap", h === "#" && "text-right")}>{h}</span>
                ))}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse mb-3" />
                  <p className="text-[13px] text-slate-400">Loading contacts…</p>
                </div>
              ) : paged.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="h-8 w-8 text-slate-200 mb-3" />
                  <p className="text-[13px] text-slate-400">
                    {hasFilters ? "No contacts match your filters" : "No contacts yet"}
                  </p>
                  {!hasFilters && (
                    <button onClick={() => setOrgOpen(true)} className="mt-3 text-[12px] font-semibold hover:underline" style={{ color: "#C8A96E" }}>
                      Add your first contact
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {paged.map((group, idx) => {
                    const rowNum = page * PAGE_SIZE + idx + 1;
                    return (
                      <Fragment key={group.id}>
                        <div className="grid w-full grid-cols-[28px_36px_minmax(0,1.15fr)_minmax(0,0.52fr)_minmax(0,0.58fr)_minmax(0,1.05fr)_minmax(0,0.55fr)_minmax(0,0.5fr)_44px] gap-x-3 gap-y-0 px-4 py-3.5 items-start hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center justify-center pt-1">
                            <input type="checkbox"
                              checked={selected.has(group.id)}
                              onChange={() => {
                                const next = new Set(selected);
                                if (next.has(group.id)) next.delete(group.id);
                                else next.add(group.id);
                                setSelected(next);
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 accent-[#C8A96E]" />
                          </div>
                          <span className="text-[11px] font-medium text-slate-300 text-right tabular-nums pt-1">{rowNum}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {group.contactType === "organisation"
                                ? <Building2 className="h-3 w-3 text-blue-400 shrink-0" />
                                : <User className="h-3 w-3 text-purple-400 shrink-0" />
                              }
                              <span className="text-[12px] font-semibold text-slate-800 truncate">{group.companyName}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {group.contactType === "organisation" ? "Organisation" : "Individual"}
                            </p>
                          </div>
                          <div className="pt-0.5"><CategoryBadge status={group.status} /></div>
                          <span className="text-[11px] font-medium text-slate-700 truncate pt-1 block min-w-0">{group.contactName || "—"}</span>
                          <span className="text-[11px] text-slate-500 truncate pt-1 block min-w-0">{group.primaryEmail || "—"}</span>
                          <span className="text-[11px] text-slate-500 truncate pt-1 block min-w-0">{group.primaryPhone || "—"}</span>
                          <div className="pt-0.5">
                            <p className="text-[11px] text-slate-700 leading-tight">{formatDate(group.createdAt)}</p>
                          </div>
                          <div className="flex justify-center pt-0.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors" aria-label="Actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-lg border border-slate-100 shadow-lg p-1">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/clients/${group.id}`)}
                                  className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
                                >
                                  <Eye className="h-4 w-4 shrink-0 text-slate-400" />View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditClientId(group.id as Id<"clients">);
                                    setEditOpen(true);
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
                                >
                                  <Edit className="h-4 w-4 shrink-0 text-blue-500" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/proposals/new?clientId=${group.id}`)}
                                  className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
                                >
                                  <FileText className="h-4 w-4 shrink-0 text-violet-500" />Create Proposal
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1" />
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget({ id: group.id, name: group.companyName, xeroContactId: group.xeroContactId })}
                                  className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md text-red-500 focus:text-red-600 focus:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} contacts
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {(() => {
                      const pages: (number | "...")[] = [];
                      if (totalPages <= 7) {
                        for (let i = 0; i < totalPages; i++) pages.push(i);
                      } else {
                        pages.push(0);
                        if (page > 2) pages.push("...");
                        for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
                        if (page < totalPages - 3) pages.push("...");
                        pages.push(totalPages - 1);
                      }
                      return pages.map((p, idx) =>
                        p === "..." ? (
                          <span key={`dots-${idx}`} className="h-7 w-7 flex items-center justify-center text-[11px] text-slate-400">...</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={cn("h-7 w-7 flex items-center justify-center rounded-md text-[11px] font-semibold transition-colors",
                              page === p ? "text-white" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            )}
                            style={page === p ? { background: "#C8A96E" } : {}}
                          >
                            {p + 1}
                          </button>
                        )
                      );
                    })()}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page === totalPages - 1}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Sheets */}
        {userId && (
          <>
            <AddOrganisationSheet open={orgOpen} onOpenChange={setOrgOpen} userId={userId} />
            <AddIndividualSheet open={indOpen} onOpenChange={setIndOpen} userId={userId} />
          </>
        )}
        <EditContactSheet
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) setEditClientId(null);
          }}
          clientId={editClientId}
          userId={userId}
        />

        {/* Delete confirm */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <div className="flex items-start justify-between gap-4">
              <AlertDialogHeader className="flex-1 space-y-2 text-left">
                <AlertDialogTitle>Delete contact permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{deleteTarget?.name}&quot;
                  {deleteTarget?.xeroContactId ? " and archive the contact in Xero" : ""}.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <button type="button" onClick={() => !deleting && setDeleteTarget(null)} className="-m-1 p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                {deleting ? "Deleting…" : "Delete permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </>
  );
}
