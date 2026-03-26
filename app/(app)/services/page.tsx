"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { formatCurrency } from "@/lib/utils";

import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Plus, Search, Package, MoreHorizontal, Trash2, ChevronDown,
  Pencil, Copy, TrendingUp, Download, Layers, FileText,
  CheckCircle, AlertTriangle, XCircle, ToggleLeft, ToggleRight, Loader2,
  ChevronLeft, ChevronRight, ChevronUp, ArrowDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { NewSectionSheet }            from "@/components/sheets/NewSectionSheet";
import { AddServiceSheet, getCategoryColor } from "@/components/sheets/AddServiceSheet";
import { EditServiceSheet, type LineItemForEdit } from "@/components/sheets/EditServiceSheet";
import { DuplicateServiceSheet, type LineItemForDuplicate } from "@/components/sheets/DuplicateServiceSheet";
import { GlobalPriceAdjustmentSheet } from "@/components/sheets/GlobalPriceAdjustmentSheet";
import { ImportSectionsSheet }        from "@/components/sheets/ImportSectionsSheet";
import { ServiceLetterConfigSheet, type SectionLetterConfig } from "@/components/sheets/ServiceLetterConfigSheet";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Mirrors convex lineItems.listSectionsWithItems line item shape */
type LineItemRow = {
  _id: Id<"services">;
  name: string;
  description?: string;
  serviceSchedule?: string;
  pricingType: "fixed" | "hourly" | "tiered" | "recurring";
  fixedPrice?: number;
  hourlyRate?: number;
  isActive: boolean;
  sortOrder: number;
  status: string;
};

type SectionRow = {
  _id: Id<"serviceSections">;
  name: string;
  description?: string;
  iconName?: string;
  iconColor?: string;
  /** Engagement letter: section intro when any line from this section is on a proposal */
  engagementParagraphHtml?: string;
  ourResponsibilityText?: string;
  yourResponsibilityText?: string;
  linkedLetterVersionId?: Id<"engagementLetterVersions">;
  sortOrder: number;
  isPublished: boolean;
  lineItems: LineItemRow[];
};

interface StatConfig {
  label: string; sublabel: string;
  icon: LucideIcon; iconBg: string; iconColor: string;
  getValue: (s: ReturnType<typeof computeStats>) => string;
}

function computeStats(sections: SectionRow[]) {
  const items = sections.flatMap((s) => s.lineItems);
  return {
    totalSections:     sections.length,
    totalServices:     items.length,
    publishedSections: sections.filter((s) => s.isPublished).length,
    draftSections:     sections.filter((s) => !s.isPublished).length,
    activeServices:    items.filter((i) => i.isActive).length,
    needsAttention:    items.filter((i) => i.status !== "complete").length,
  };
}

const STAT_CARDS: StatConfig[] = [
  { label: "Total Sections",     sublabel: "Service categories",        icon: Layers,       iconBg: "bg-[#C8A96E]/10", iconColor: "#C8A96E",  getValue: (s) => String(s.totalSections) },
  { label: "Total Services",     sublabel: "In catalog",                icon: FileText,     iconBg: "bg-[#243E63]/10", iconColor: "#243E63",  getValue: (s) => String(s.totalServices) },
  { label: "Published Sections", sublabel: "Live",                      icon: CheckCircle,  iconBg: "bg-emerald-50",   iconColor: "#10b981",  getValue: (s) => String(s.publishedSections) },
  { label: "Draft Sections",     sublabel: "Not published",             icon: AlertTriangle,iconBg: "bg-amber-50",     iconColor: "#f59e0b",  getValue: (s) => String(s.draftSections) },
  { label: "Active Services",    sublabel: "Live in catalog",           icon: Package,      iconBg: "bg-[#243E63]/10", iconColor: "#243E63",  getValue: (s) => String(s.activeServices) },
  { label: "Needs Attention",    sublabel: "Incomplete or missing price",icon: XCircle,     iconBg: "bg-red-50",       iconColor: "#ef4444",  getValue: (s) => String(s.needsAttention) },
];

const PRICING_METHOD_LABELS: Record<string, string> = {
  fixed: "Fixed",
  hourly: "Hourly",
  tiered: "Tiered",
  recurring: "Recurring",
  fixed_monthly: "Fixed Monthly", fixed_annual: "Fixed Annual", fixed_onceoff: "Once-off",
  per_transaction: "Per Transaction", per_employee: "Per Employee",
  per_payslip: "Per Payslip", per_invoice: "Per Invoice", per_bank_account: "Per Bank Account",
  per_vat_submission: "Per VAT Submission", per_entity: "Per Entity",
  quantity_x_unit: "Qty × Unit", manual_override: "Manual Override",
};

const SECTIONS_PER_PAGE = 4;

type SortOption = "custom" | "name_asc" | "name_desc" | "items_desc" | "items_asc" | "price_desc" | "price_asc";
const SORT_LABELS: Record<SortOption, string> = {
  custom: "Custom order",
  name_asc: "Name (A–Z)",
  name_desc: "Name (Z–A)",
  items_desc: "Most services",
  items_asc: "Fewest services",
  price_desc: "Price (high–low)",
  price_asc: "Price (low–high)",
};

function priceOfItem(i: LineItemRow) {
  return i.fixedPrice ?? i.hourlyRate ?? 0;
}

function sectionPriceRange(sec: SectionRow) {
  const prices = sec.lineItems.map(priceOfItem).filter((p) => p > 0);
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function StatusTraffic({ status }: { status: string }) {
  const k = status?.toLowerCase() ?? "";
  const cls =
    k === "complete"
      ? "bg-emerald-500"
      : k === "price-missing"
        ? "bg-red-500"
        : "bg-amber-400";
  const title =
    k === "complete"
      ? "Complete"
      : k === "price-missing"
        ? "Missing price or description"
        : "Missing schedule or details";
  return (
    <span title={title} className={cn("inline-block h-2 w-2 rounded-full shrink-0", cls)} aria-hidden />
  );
}

export default function ServicesPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const rawSections = useQuery(api.lineItems.listSectionsWithItems, userId ? { userId } : "skip");

  const updateLineItem = useMutation(api.lineItems.updateLineItem);
  const deleteLineItem = useMutation(api.lineItems.deleteLineItem);
  const deleteSectionMutation = useMutation(api.lineItems.deleteSection);
  const updateSectionMutation = useMutation(api.lineItems.updateSection);
  const reorderSectionMutation = useMutation(api.lineItems.reorderSection);

  const sections: SectionRow[] = (rawSections ?? []) as SectionRow[];
  const loading = rawSections === undefined;

  const sectionNames = useMemo(() => sections.map((s) => s.name), [sections]);

  const allSectionsOrdered = useMemo(() => {
    return [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [sections]);

  const [search, setSearch] = useState("");
  const [filterSectionId, setFilterSectionId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("custom");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [addSectionId, setAddSectionId] = useState<Id<"serviceSections"> | null>(null);
  const [addSectionName, setAddSectionName] = useState("");

  const [sectionOpen, setSectionOpen] = useState(false);
  const [globalPriceOpen, setGlobalPriceOpen] = useState(false);
  const [priceSectionMode, setPriceSectionMode] = useState<{ sectionId: Id<"serviceSections">; sectionName: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [editCtx, setEditCtx] = useState<{ item: LineItemForEdit; sectionName: string } | null>(null);
  const [dupCtx, setDupCtx] = useState<{ item: LineItemForDuplicate; sectionId: Id<"serviceSections">; sectionName: string } | null>(null);
  const [letterConfigCtx, setLetterConfigCtx] = useState<SectionLetterConfig | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"services">; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [viewedSectionId, setViewedSectionId] = useState<Id<"serviceSections"> | null>(null);

  const [renameSectionTarget, setRenameSectionTarget] = useState<{ id: Id<"serviceSections">; name: string } | null>(null);
  const [renameSectionName, setRenameSectionName] = useState("");
  const [renamingSectionBusy, setRenamingSectionBusy] = useState(false);
  const [renameSectionError, setRenameSectionError] = useState("");

  const [deleteSectionTarget, setDeleteSectionTarget] = useState<{ id: Id<"serviceSections">; name: string } | null>(null);
  const [deletingSectionBusy, setDeletingSectionBusy] = useState(false);

  const stats = useMemo(() => computeStats(sections), [sections]);

  const filteredSections = useMemo(() => {
    let list = [...sections];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((sec) => {
        if (sec.name.toLowerCase().includes(q)) return true;
        return sec.lineItems.some(
          (li) =>
            li.name.toLowerCase().includes(q) ||
            (li.description ?? "").toLowerCase().includes(q)
        );
      });
    }

    if (filterSectionId !== "all") {
      list = list.filter((s) => s._id === filterSectionId);
    }

    const byPrice = (sec: SectionRow) => {
      const { min, max } = sectionPriceRange(sec);
      return max || min;
    };

    if (sortBy === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "name_desc") list.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === "items_desc") list.sort((a, b) => b.lineItems.length - a.lineItems.length);
    else if (sortBy === "items_asc") list.sort((a, b) => a.lineItems.length - b.lineItems.length);
    else if (sortBy === "price_desc") list.sort((a, b) => byPrice(b) - byPrice(a));
    else if (sortBy === "price_asc") list.sort((a, b) => byPrice(a) - byPrice(b));
    else list.sort((a, b) => a.sortOrder - b.sortOrder);

    return list;
  }, [sections, search, filterSectionId, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredSections.length / SECTIONS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedSections = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * SECTIONS_PER_PAGE;
    return filteredSections.slice(start, start + SECTIONS_PER_PAGE);
  }, [filteredSections, page, totalPages]);

  const viewedSection = viewedSectionId
    ? sections.find((s) => s._id === viewedSectionId)
    : undefined;
  const viewedItems = viewedSection?.lineItems ?? [];

  const sortedViewedItems = useMemo(() => {
    let list = [...viewedItems];
    const pf = priceOfItem;
    if (sortBy === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "name_desc") list.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === "price_desc") list.sort((a, b) => pf(b) - pf(a));
    else if (sortBy === "price_asc") list.sort((a, b) => pf(a) - pf(b));
    else list.sort((a, b) => a.sortOrder - b.sortOrder);
    return list;
  }, [viewedItems, sortBy]);

  const categoryLabel =
    filterSectionId === "all"
      ? "All sections"
      : sections.find((s) => s._id === filterSectionId)?.name ?? "Section";

  function openAddForSection(id: Id<"serviceSections">, name: string) {
    setAddSectionId(id);
    setAddSectionName(name);
    setAddOpen(true);
  }

  function sectionAccent(sec: SectionRow) {
    if (sec.iconColor?.trim()) return sec.iconColor;
    return getCategoryColor(sectionNames, sec.name);
  }

  async function toggleActive(item: LineItemRow) {
    if (!userId) return;
    try {
      const result = await updateLineItem({ userId, lineItemId: item._id, isActive: !item.isActive });
      if (!result.success) {
        toast.error(result.error || "Failed to update");
        return;
      }
      toast.success(item.isActive ? `"${item.name}" deactivated` : `"${item.name}" activated`);
    } catch {
      toast.error("Failed to update service");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !userId) return;
    setDeleting(true);
    try {
      const result = await deleteLineItem({ userId, lineItemId: deleteTarget.id });
      if (!result.success) {
        toast.error(result.error || "Failed to delete");
        return;
      }
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete service");
    } finally {
      setDeleting(false);
    }
  }

  function openRenameSection(id: Id<"serviceSections">, name: string) {
    setRenameSectionTarget({ id, name });
    setRenameSectionName(name);
    setRenameSectionError("");
  }

  async function handleRenameSection() {
    if (!userId || !renameSectionTarget) return;
    const newName = renameSectionName.trim();
    if (!newName) { setRenameSectionError("Section name is required"); return; }
    if (newName === renameSectionTarget.name) { setRenameSectionTarget(null); return; }
    if (newName.length > 80) { setRenameSectionError("80 characters maximum"); return; }
    setRenamingSectionBusy(true);
    try {
      const result = await updateSectionMutation({ userId, sectionId: renameSectionTarget.id, name: newName });
      if (!result.success) {
        toast.error(result.error || "Failed to rename");
        return;
      }
      toast.success(`Section renamed to "${newName}"`);
      setRenameSectionTarget(null);
    } catch {
      toast.error("Failed to rename section");
    } finally {
      setRenamingSectionBusy(false);
    }
  }

  async function handleDeleteSection() {
    if (!userId || !deleteSectionTarget) return;
    setDeletingSectionBusy(true);
    try {
      const result = await deleteSectionMutation({ userId, sectionId: deleteSectionTarget.id });
      if (!result.success) {
        toast.error(result.error || "Failed to delete section");
        return;
      }
      if (viewedSectionId === deleteSectionTarget.id) setViewedSectionId(null);
      toast.success(`Section "${deleteSectionTarget.name}" deleted`);
      setDeleteSectionTarget(null);
    } catch {
      toast.error("Failed to delete section");
    } finally {
      setDeletingSectionBusy(false);
    }
  }

  async function handleSetAllActive(sec: SectionRow, active: boolean) {
    if (!userId) return;
    const toUpdate = sec.lineItems.filter((s) => s.isActive !== active);
    if (!toUpdate.length) { toast.info(`All services already ${active ? "active" : "inactive"}`); return; }
    try {
      await Promise.all(
        toUpdate.map((s) => updateLineItem({ userId: userId!, lineItemId: s._id, isActive: active }))
      );
      toast.success(`${toUpdate.length} service${toUpdate.length !== 1 ? "s" : ""} ${active ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update services");
    }
  }

  async function toggleSectionPublished(sec: SectionRow) {
    if (!userId) return;
    try {
      const result = await updateSectionMutation({
        userId,
        sectionId: sec._id,
        isPublished: !sec.isPublished,
      });
      if (!result.success) {
        toast.error(result.error || "Failed to update section");
        return;
      }
      toast.success(sec.isPublished ? `"${sec.name}" marked draft` : `"${sec.name}" published`);
    } catch {
      toast.error("Failed to update section");
    }
  }

  async function handleReorder(sec: SectionRow, direction: "up" | "down") {
    if (!userId) return;
    try {
      const result = await reorderSectionMutation({ userId, sectionId: sec._id, direction });
      if (!result.success) {
        toast.error(result.error || "Could not reorder");
        return;
      }
    } catch {
      toast.error("Failed to reorder section");
    }
  }

  function reorderDisabled(sec: SectionRow, direction: "up" | "down") {
    const idx = allSectionsOrdered.findIndex((s) => s._id === sec._id);
    if (idx < 0) return true;
    if (direction === "up") return idx === 0;
    return idx >= allSectionsOrdered.length - 1;
  }

  const allLineItemsForGlobalPrice = useMemo(
    () => sections.flatMap((s) => s.lineItems),
    [sections]
  );

  const sectionOptions = useMemo(
    () => sections.map((s) => ({ _id: s._id, name: s.name })),
    [sections]
  );

  return (
    <>
      <Header />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{deleteTarget?.name}&rdquo; will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSectionTarget} onOpenChange={(open) => { if (!open && !deletingSectionBusy) setDeleteSectionTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{deleteSectionTarget?.name}&rdquo; and all its services will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSectionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSection} disabled={deletingSectionBusy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingSectionBusy ? "Deleting…" : "Delete section"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameSectionTarget} onOpenChange={(open) => { if (!open && !renamingSectionBusy) setRenameSectionTarget(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Rename section</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-[13px] font-medium text-slate-700">Section name</label>
            <input
              autoFocus
              value={renameSectionName}
              onChange={(e) => { setRenameSectionName(e.target.value); if (renameSectionError) setRenameSectionError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameSection(); }}
              maxLength={80}
              disabled={renamingSectionBusy}
              className={cn("w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 focus:outline-none transition-colors bg-white", renameSectionError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]")}
            />
            {renameSectionError ? <p className="text-[11px] text-red-600">{renameSectionError}</p> : <p className="text-[11px] text-slate-400">80 characters maximum</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameSectionTarget(null)} disabled={renamingSectionBusy}>Cancel</Button>
            <Button onClick={handleRenameSection} disabled={renamingSectionBusy} style={{ background: "#C8A96E" }} className="text-white hover:opacity-90">
              {renamingSectionBusy ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Renaming…</> : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {STAT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", card.iconBg)}>
                    <Icon className="h-[15px] w-[15px]" style={{ color: card.iconColor }} />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 leading-tight">{card.label}</p>
                </div>
                {loading ? <Skeleton className="h-8 w-20 mb-1" /> : (
                  <p className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">{card.getValue(stats)}</p>
                )}
                <p className="text-[10px] text-slate-400">{card.sublabel}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              className="h-8 pl-9 pr-3 w-48 rounded-lg border border-slate-200 text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
              placeholder="Search services…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 px-4 text-[12px] font-semibold text-white gap-1.5 hover:opacity-90 transition-opacity"
                  style={{ background: "#C8A96E" }}
                >
                  Actions<ChevronDown size={10} strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem className="text-[13px]" onClick={() => setSectionOpen(true)}>
                  <Layers className="h-4 w-4 mr-2 text-slate-500" />New Section
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[13px]"
                  disabled={sections.length === 0}
                  onClick={() => {
                    setAddSectionId(null);
                    setAddSectionName("");
                    setAddOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2 text-slate-500" />Add Service
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[13px]"
                  disabled={!allLineItemsForGlobalPrice.length}
                  onClick={() => { setPriceSectionMode(null); setGlobalPriceOpen(true); }}
                >
                  <TrendingUp className="h-4 w-4 mr-2 text-emerald-500" />Global Price Adjustment
                </DropdownMenuItem>
                <DropdownMenuItem className="text-[13px]" onClick={() => setImportOpen(true)}>
                  <Download className="h-4 w-4 mr-2 text-blue-500" />Import Sections
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[130px] text-[12px] font-medium justify-between">
                  {SORT_LABELS[sortBy]}<ChevronDown size={10} className="text-slate-400 shrink-0" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([k, v]) => (
                  <DropdownMenuItem key={k} onClick={() => setSortBy(k)} className={cn("text-[12px]", sortBy === k && "font-semibold")}>{v}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[150px] text-[12px] font-medium justify-between">
                  {categoryLabel}<ChevronDown size={10} className="text-slate-400 shrink-0" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-[12px]" onClick={() => { setFilterSectionId("all"); setPage(1); }}>All sections</DropdownMenuItem>
                {sections.map((s) => (
                  <DropdownMenuItem key={s._id} className="text-[12px]" onClick={() => { setFilterSectionId(s._id); setPage(1); }}>
                    <span className="w-2 h-2 rounded-full shrink-0 mr-2 inline-block" style={{ background: sectionAccent(s) }} />
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[108px] rounded-xl" />)}
          </div>
        ) : sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-5">
              <Layers className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-[16px] font-semibold text-slate-700 mb-1">No sections yet</p>
            <p className="text-[13px] text-slate-400 mb-6 max-w-xs">
              Create a section to organise your services, then add services inside it.
            </p>
            <button
              onClick={() => setSectionOpen(true)}
              className="flex items-center gap-1.5 h-9 px-5 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#C8A96E" }}
            >
              <Plus className="h-3.5 w-3.5" />Create first section
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="h-8 w-8 text-slate-300 mb-3" />
                <p className="text-[14px] font-semibold text-slate-600">No sections match</p>
                <p className="text-[12px] text-slate-400 mt-1">Try a different search or filter</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginatedSections.map((sec) => {
                    const catColor = sectionAccent(sec);
                    const isViewed = viewedSectionId === sec._id;
                    const items = sec.lineItems;
                    const activeCount = items.filter((s) => s.isActive).length;
                    const { min: minPrice, max: maxPrice } = sectionPriceRange(sec);

                    return (
                      <div
                        key={sec._id}
                        className={cn(
                          "group bg-white border rounded-xl transition-colors",
                          isViewed ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className="flex items-start gap-3 p-5">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[15px] font-bold"
                            style={{ background: `${catColor}18`, color: catColor }}
                          >
                            {sec.name[0]?.toUpperCase() ?? "S"}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-slate-900 truncate leading-tight">{sec.name}</p>
                            <p className="text-[12px] text-slate-400 mt-0.5">
                              {items.length} {items.length === 1 ? "service" : "services"}
                              {items.length - activeCount > 0 && (
                                <span className="text-amber-500"> · {items.length - activeCount} inactive</span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span
                                className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  sec.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                                )}
                              >
                                {sec.isPublished ? "Published" : "Draft"}
                              </span>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100 shrink-0 mt-0.5">
                                <MoreHorizontal className="h-3.5 w-3.5 text-slate-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem className="text-[13px]" onClick={() => openRenameSection(sec._id, sec.name)}>
                                <Pencil className="mr-2 h-3.5 w-3.5 text-slate-500" />Rename section
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[13px]" onClick={() => openAddForSection(sec._id, sec.name)}>
                                <Plus className="mr-2 h-3.5 w-3.5 text-slate-500" />Add service
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-[13px]"
                                disabled={reorderDisabled(sec, "up")}
                                onClick={() => handleReorder(sec, "up")}
                              >
                                <ChevronUp className="mr-2 h-3.5 w-3.5 text-slate-500" />Move up
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-[13px]"
                                disabled={reorderDisabled(sec, "down")}
                                onClick={() => handleReorder(sec, "down")}
                              >
                                <ArrowDown className="mr-2 h-3.5 w-3.5 text-slate-500" />Move down
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[13px]" onClick={() => toggleSectionPublished(sec)}>
                                <CheckCircle className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                                {sec.isPublished ? "Mark draft" : "Publish section"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-[13px]"
                                disabled={!items.length}
                                onClick={() => {
                                  setPriceSectionMode({ sectionId: sec._id, sectionName: sec.name });
                                  setGlobalPriceOpen(true);
                                }}
                              >
                                <TrendingUp className="mr-2 h-3.5 w-3.5 text-emerald-500" />Section price adjustment
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-[13px]"
                                onClick={() => setLetterConfigCtx({
                                  _id: sec._id,
                                  name: sec.name,
                                  ourResponsibilityText: sec.ourResponsibilityText,
                                  yourResponsibilityText: sec.yourResponsibilityText,
                                  linkedLetterVersionId: sec.linkedLetterVersionId,
                                })}
                              >
                                <FileText className="mr-2 h-3.5 w-3.5 text-slate-500" />Engagement letter config
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-[13px]" onClick={() => handleSetAllActive(sec, true)}>
                                <ToggleRight className="mr-2 h-3.5 w-3.5 text-emerald-500" />Activate all
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[13px]" onClick={() => handleSetAllActive(sec, false)}>
                                <ToggleLeft className="mr-2 h-3.5 w-3.5 text-amber-500" />Deactivate all
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-[13px] text-red-600 focus:text-red-600" onClick={() => setDeleteSectionTarget({ id: sec._id, name: sec.name })}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" />Delete section
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="px-5 pb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {maxPrice > 0 ? (
                              <span className="text-[12px] font-semibold text-slate-700 tabular-nums">
                                {minPrice === maxPrice ? formatCurrency(minPrice) : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`}
                              </span>
                            ) : (
                              <span className="text-[12px] text-slate-400">No prices set</span>
                            )}
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">
                              {activeCount} active
                            </span>
                          </div>

                          <button
                            onClick={() => setViewedSectionId(isViewed ? null : sec._id)}
                            className="text-[11px] font-semibold transition-colors hover:opacity-80"
                            style={{ color: catColor }}
                          >
                            {isViewed ? "Hide" : "View"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 py-1">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-[12px] text-slate-500 tabular-nums">
                      Page {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}

            {viewedSection && sortedViewedItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: sectionAccent(viewedSection) }}
                    />
                    <h3 className="text-[13px] font-semibold text-slate-700">{viewedSection.name}</h3>
                    <span className="text-[11px] text-slate-400">({sortedViewedItems.length})</span>
                  </div>
                  <button
                    onClick={() => openAddForSection(viewedSection._id, viewedSection.name)}
                    className="flex items-center gap-1 h-7 px-3 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: sectionAccent(viewedSection) }}
                  >
                    <Plus className="h-3 w-3" />Add Service
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sortedViewedItems.map((service) => {
                    const price = priceOfItem(service);
                    const pmLabel = PRICING_METHOD_LABELS[service.pricingType] ?? service.pricingType;
                    const inactive = !service.isActive;
                    return (
                      <div
                        key={service._id}
                        className={cn(
                          "group/svc bg-white border rounded-xl p-4 hover:border-slate-200 transition-colors",
                          inactive ? "border-slate-100 opacity-60" : "border-slate-100"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <StatusTraffic status={service.status} />
                              <p className="text-[14px] font-semibold text-slate-900 truncate">{service.name}</p>
                              {inactive && (
                                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">Inactive</span>
                              )}
                            </div>
                            {service.description && (
                              <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{service.description}</p>
                            )}
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover/svc:opacity-100 transition-opacity hover:bg-slate-100 shrink-0">
                                <MoreHorizontal className="h-3.5 w-3.5 text-slate-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                className="text-[13px]"
                                onClick={() =>
                                  setEditCtx({
                                    item: service as LineItemForEdit,
                                    sectionName: viewedSection.name,
                                  })
                                }
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5 text-slate-500" />Edit service
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-[13px]"
                                onClick={() =>
                                  setDupCtx({
                                    item: { ...service, category: viewedSection.name } as LineItemForDuplicate,
                                    sectionId: viewedSection._id,
                                    sectionName: viewedSection.name,
                                  })
                                }
                              >
                                <Copy className="mr-2 h-3.5 w-3.5 text-slate-500" />Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-[13px]" onClick={() => toggleActive(service)}>
                                {service.isActive
                                  ? <><ToggleLeft  className="mr-2 h-3.5 w-3.5 text-amber-500" />Deactivate</>
                                  : <><ToggleRight className="mr-2 h-3.5 w-3.5 text-emerald-500" />Activate</>
                                }
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-[13px] text-red-600 focus:text-red-600"
                                onClick={() => setDeleteTarget({ id: service._id, name: service.name })}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                          <p className="text-[15px] font-bold text-slate-900 tabular-nums">
                            {formatCurrency(price)}
                            {service.pricingType === "hourly" && <span className="text-[11px] font-normal text-slate-400">/hr</span>}
                          </p>
                          <p className="text-[11px] text-slate-400">{pmLabel}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {userId && (
        <>
          <NewSectionSheet open={sectionOpen} onOpenChange={setSectionOpen} userId={userId} />
          <AddServiceSheet
            open={addOpen}
            onOpenChange={(v) => {
              setAddOpen(v);
              if (!v) {
                setAddSectionId(null);
                setAddSectionName("");
              }
            }}
            sectionId={addSectionId}
            sectionName={addSectionName}
            userId={userId}
            sectionOptions={addSectionId ? undefined : sectionOptions}
          />
          <EditServiceSheet
            open={!!editCtx}
            onOpenChange={(v) => { if (!v) setEditCtx(null); }}
            service={editCtx?.item ?? null}
            sectionName={editCtx?.sectionName ?? ""}
            userId={userId}
          />
          <DuplicateServiceSheet
            open={!!dupCtx}
            onOpenChange={(v) => { if (!v) setDupCtx(null); }}
            service={dupCtx?.item ?? null}
            sectionId={dupCtx?.sectionId ?? null}
            sectionName={dupCtx?.sectionName ?? ""}
            userId={userId}
          />
          <GlobalPriceAdjustmentSheet
            open={globalPriceOpen}
            onOpenChange={(v) => {
              setGlobalPriceOpen(v);
              if (!v) setPriceSectionMode(null);
            }}
            userId={userId}
            lineItems={
              priceSectionMode
                ? sections.find((s) => s._id === priceSectionMode.sectionId)?.lineItems ?? []
                : allLineItemsForGlobalPrice
            }
            sectionMode={priceSectionMode}
          />
          <ImportSectionsSheet open={importOpen} onOpenChange={setImportOpen} userId={userId} />
          <ServiceLetterConfigSheet
            open={!!letterConfigCtx}
            onOpenChange={(v) => { if (!v) setLetterConfigCtx(null); }}
            section={letterConfigCtx}
            userId={userId}
          />
        </>
      )}
    </>
  );
}
