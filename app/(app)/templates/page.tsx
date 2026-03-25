"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { TemplateSheet } from "@/components/sheets/TemplateSheet";
import { useQuery, useMutation } from "convex/react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  FileText,
  Plus,
  Upload,
  ChevronDown,
  ListFilter,
  GripVertical,
  Edit,
  Copy,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  Star,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceType = "all" | "audit" | "bookkeeping" | "tax" | "advisory" | "general" | "payroll" | "other";
type Deliverability = "all" | "high" | "low";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_TABS = [
  { id: "all", label: "All Templates" },
  { id: "audit", label: "Audit" },
  { id: "bookkeeping", label: "Bookkeeping" },
  { id: "tax", label: "Tax" },
  { id: "advisory", label: "Advisory" },
  { id: "general", label: "General" },
  { id: "payroll", label: "Payroll" },
  { id: "other", label: "Other" },
] as const;

const ITEMS_PER_PAGE = 5;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;
  const convex = useConvex();

  const convexTemplates = useQuery(api.templates.listTemplates, userId ? { userId } : "skip");
  const deleteTemplateMutation = useMutation(api.templates.deleteTemplate);
  const createTemplateMutation = useMutation(api.templates.createTemplate);
  const importTemplateMutation = useMutation(api.templates.importTemplate);
  const reorderTemplateMutation = useMutation(api.templates.reorderTemplate);
  const setDefaultTemplateMutation = useMutation(api.templates.setDefaultTemplate);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [editTemplateId, setEditTemplateId] = useState<Id<"proposalTemplates"> | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ServiceType>("all");
  const [deliverabilityFilter, setDeliverabilityFilter] = useState<Deliverability>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteId, setDeleteId] = useState<Id<"proposalTemplates"> | null>(null);

  const loading = convexTemplates === undefined;
  const templates = useMemo(() => convexTemplates ?? [], [convexTemplates]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, deliverabilityFilter]);

  const filtered = useMemo(
    () =>
      templates.filter((t) => {
        if (categoryFilter !== "all" && t.serviceType !== categoryFilter) return false;
        if (deliverabilityFilter !== "all" && (t.emailDeliverability ?? "high") !== deliverabilityFilter)
          return false;
        return true;
      }),
    [templates, categoryFilter, deliverabilityFilter]
  );

  /** Same sort as Convex `reorderTemplate` / `listTemplates` — for up/down bounds */
  const sortedForReorder = useMemo(() => {
    const copy = [...templates];
    copy.sort((a, b) => {
      const oa = a.sortOrder ?? 999999;
      const ob = b.sortOrder ?? 999999;
      if (oa !== ob) return oa - ob;
      return a.createdAt - b.createdAt;
    });
    return copy;
  }, [templates]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(start, start + ITEMS_PER_PAGE);

  function goTo(p: number) {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  }

  async function handleDuplicate(tpl: (typeof templates)[0]) {
    if (!userId) return;
    try {
      await createTemplateMutation({
        userId,
        name: `${tpl.name} (Copy)`,
        serviceType: tpl.serviceType,
        introText: tpl.introText,
        termsText: tpl.termsText,
        footerText: tpl.footerText,
        description: tpl.description,
        isDefault: false,
        minimumMonthlyFee: tpl.minimumMonthlyFee,
        proposalType: tpl.proposalType,
        documentsToSend: tpl.documentsToSend,
        redirectOnAcceptUrl: tpl.redirectOnAcceptUrl,
        emailDeliverability: tpl.emailDeliverability,
        sectionConfig: tpl.sectionConfig,
      });
      toast.success("Template duplicated");
    } catch {
      toast.error("Failed to duplicate");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteId || !userId) return;
    try {
      await deleteTemplateMutation({ userId, templateId: deleteId });
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
    setDeleteId(null);
  }

  async function handleReorder(direction: "up" | "down", templateId: Id<"proposalTemplates">) {
    if (!userId) return;
    try {
      await reorderTemplateMutation({ userId, templateId, direction });
    } catch {
      toast.error("Failed to reorder");
    }
  }

  async function handleSetDefault(templateId: Id<"proposalTemplates">) {
    if (!userId) return;
    try {
      await setDefaultTemplateMutation({ userId, templateId });
      toast.success("Default template updated");
    } catch {
      toast.error("Failed to set default");
    }
  }

  async function handleExport(templateId: Id<"proposalTemplates">) {
    if (!userId) return;
    try {
      const data = await convex.query(api.templates.exportTemplate, { userId, templateId });
      if (!data) {
        toast.error("Could not export template");
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.name.replace(/[^\w\s-]/g, "").slice(0, 40) || "template"}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Template exported");
    } catch {
      toast.error("Export failed");
    }
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !userId) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string);
          await importTemplateMutation({
            userId,
            templateData: {
              name: raw.name ?? "Imported Template",
              description: raw.description,
              serviceType: raw.serviceType ?? "general",
              introText: raw.introText ?? "",
              termsText: raw.termsText ?? "",
              footerText: raw.footerText,
              minimumMonthlyFee: raw.minimumMonthlyFee ?? raw.minimumFee,
              proposalType: raw.proposalType ?? "standard",
              documentsToSend: raw.documentsToSend ?? raw.documents ?? "Proposal",
              redirectOnAcceptUrl: raw.redirectOnAcceptUrl,
              emailDeliverability: raw.emailDeliverability ?? "high",
              sectionConfig: raw.sectionConfig,
            },
          });
          toast.success("Template imported");
        } catch {
          toast.error("Invalid template file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  const catLabel = CATEGORY_TABS.find((t) => t.id === categoryFilter)?.label ?? "All Templates";
  const delivLabel =
    deliverabilityFilter === "all"
      ? "All deliverability"
      : deliverabilityFilter === "high"
        ? "High"
        : "Low";

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[150px] text-[12px] font-medium justify-between">
                  {catLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                {CATEGORY_TABS.map((tab) => (
                  <DropdownMenuItem key={tab.id} onClick={() => setCategoryFilter(tab.id as ServiceType)}>
                    <ListFilter className="h-3.5 w-3.5 mr-2.5 text-slate-500" />
                    {tab.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[150px] text-[12px] font-medium justify-between">
                  {delivLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                <DropdownMenuItem onClick={() => setDeliverabilityFilter("all")}>All deliverability</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeliverabilityFilter("high")}>High</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeliverabilityFilter("low")}>Low</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-[11px] font-normal text-slate-800 border-slate-200 bg-white hover:bg-slate-50 rounded"
              onClick={handleImport}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Import
            </Button>
            <button
              type="button"
              onClick={() => {
                setSheetMode("create");
                setEditTemplateId(null);
                setSheetOpen(true);
              }}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#C8A96E" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Template
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(254,93,51,0.08)" }}>
                <FileText className="h-6 w-6" style={{ color: "#C8A96E" }} />
              </div>
              <p className="text-[15px] font-semibold text-slate-800 mb-1">
                {templates.length === 0 ? "No templates yet" : "No templates match your filters"}
              </p>
              <p className="text-[13px] text-slate-400 max-w-sm text-center">
                {templates.length === 0
                  ? "Create proposal templates to standardise your workflow."
                  : "Try adjusting the filters above."}
              </p>
              {templates.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetMode("create");
                    setEditTemplateId(null);
                    setSheetOpen(true);
                  }}
                  className="mt-5 flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#C8A96E" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create your first template
                </button>
              )}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-200">
                {paginated.map((tpl) => {
                  const deliverability = tpl.emailDeliverability ?? "high";
                  const idxInAll = sortedForReorder.findIndex((t) => t._id === tpl._id);
                  return (
                    <li key={tpl._id} className="flex items-center gap-2 py-3 px-4 min-h-[3.25rem]">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move up"
                          disabled={idxInAll <= 0}
                          onClick={() => handleReorder("up", tpl._id)}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move down"
                          disabled={idxInAll < 0 || idxInAll >= sortedForReorder.length - 1}
                          onClick={() => handleReorder("down", tpl._id)}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-slate-400 flex-shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                        <span className="text-[13px] font-medium text-slate-800 truncate">{tpl.name}</span>
                        {tpl.isDefault && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 flex-shrink-0">
                            Default
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 flex-shrink-0 capitalize">{tpl.serviceType}</span>
                        <span className="text-[11px] text-slate-500 flex-shrink-0">Email deliverability</span>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium flex-shrink-0",
                            deliverability === "high" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          )}
                        >
                          {deliverability === "high" ? "High" : "Low"}
                        </span>
                        {tpl.minimumMonthlyFee !== undefined && (
                          <span className="text-[11px] text-slate-400 flex-shrink-0 hidden sm:inline">
                            Min fee: {formatCurrency(tpl.minimumMonthlyFee)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                        <Button variant="outline" size="sm" className="h-8 px-2 text-[11px] border-slate-200" asChild>
                          <Link href={`/proposals/new?templateId=${tpl._id}`}>Use in proposal</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 border-slate-200"
                          title="Set as default for this category"
                          onClick={() => void handleSetDefault(tpl._id)}
                        >
                          <Star className={cn("w-3.5 h-3.5", tpl.isDefault ? "text-amber-500 fill-amber-400" : "text-slate-500")} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 border-slate-200"
                          title="Export JSON"
                          onClick={() => void handleExport(tpl._id)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-[11px] border-slate-200 text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setSheetMode("edit");
                            setEditTemplateId(tpl._id);
                            setSheetOpen(true);
                          }}
                        >
                          <Edit className="w-3.5 h-3.5 mr-1.5" />
                          Edit
                        </Button>
                        <button
                          type="button"
                          className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-colors"
                          onClick={() => handleDuplicate(tpl)}
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => setDeleteId(tpl._id)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                  <div className="text-[11px] text-slate-500">
                    Showing {start + 1}–{Math.min(start + ITEMS_PER_PAGE, filtered.length)} of {filtered.length}{" "}
                    {filtered.length === 1 ? "template" : "templates"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 hover:bg-slate-100 disabled:opacity-50" onClick={() => goTo(1)} disabled={safePage === 1}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 hover:bg-slate-100 disabled:opacity-50" onClick={() => goTo(safePage - 1)} disabled={safePage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 mx-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p: number;
                        if (totalPages <= 5) p = i + 1;
                        else if (safePage <= 3) p = i + 1;
                        else if (safePage >= totalPages - 2) p = totalPages - 4 + i;
                        else p = safePage - 2 + i;
                        return (
                          <Button
                            key={p}
                            variant={safePage === p ? "default" : "outline"}
                            size="sm"
                            onClick={() => goTo(p)}
                            className={cn(
                              "h-8 w-8 p-0 text-[11px] font-medium",
                              safePage === p
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 border-0"
                                : "border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {p}
                          </Button>
                        );
                      })}
                    </div>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 hover:bg-slate-100 disabled:opacity-50" onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 hover:bg-slate-100 disabled:opacity-50" onClick={() => goTo(totalPages)} disabled={safePage === totalPages}>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <div className="flex items-start justify-between gap-4">
              <AlertDialogHeader className="flex-1 space-y-2 text-left">
                <AlertDialogTitle>Delete template</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete this template? This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <button type="button" onClick={() => setDeleteId(null)} className="-m-1 p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <TemplateSheet
          open={sheetOpen}
          onOpenChange={(o) => {
            setSheetOpen(o);
            if (!o) setEditTemplateId(null);
          }}
          userId={userId}
          mode={sheetMode}
          editTemplateId={editTemplateId ?? undefined}
          onSuccess={() => {}}
        />
      </div>
    </>
  );
}
