"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { CreatePackageSheet } from "@/components/sheets/CreatePackageSheet";
import {
  Package,
  Plus,
  Pencil,
  Copy,
  Trash2,
  ChevronDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const SORT_OPTIONS = [
  { id: "manual", label: "Manual order" },
  { id: "newest", label: "Newest first" },
  { id: "name-az", label: "Name A–Z" },
  { id: "name-za", label: "Name Z–A" },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["id"];

export default function PackagesPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const convexPackages = useQuery(api.packageTemplates.list, userId ? { userId } : "skip");
  const removeMutation = useMutation(api.packageTemplates.remove);
  const createMutation = useMutation(api.packageTemplates.create);
  const reorderMutation = useMutation(api.packageTemplates.reorder);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [editPackageId, setEditPackageId] = useState<Id<"packageTemplates"> | undefined>();
  const [sortBy, setSortBy] = useState<SortId>("manual");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<Id<"packageTemplates"> | null>(null);

  const loading = convexPackages === undefined;
  const packages = useMemo(() => convexPackages ?? [], [convexPackages]);

  const templateCategories = useMemo(() => {
    const s = new Set<string>();
    for (const p of packages) {
      if (p.template?.trim()) s.add(p.template);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [packages]);

  const sorted = useMemo(() => {
    if (sortBy === "manual") return [...packages].sort((a, b) => a.sortOrder - b.sortOrder);
    if (sortBy === "name-az") return [...packages].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "name-za") return [...packages].sort((a, b) => b.name.localeCompare(a.name));
    return [...packages].sort((a, b) => b.createdAt - a.createdAt);
  }, [packages, sortBy]);

  const filtered = useMemo(() => {
    if (templateFilter === "all") return sorted;
    return sorted.filter((p) => p.template === templateFilter);
  }, [sorted, templateFilter]);

  function openCreate() {
    setSheetMode("create");
    setEditPackageId(undefined);
    setSheetOpen(true);
  }

  function openEdit(id: Id<"packageTemplates">) {
    setSheetMode("edit");
    setEditPackageId(id);
    setSheetOpen(true);
  }

  async function handleDuplicate(pkg: (typeof packages)[0]) {
    if (!userId) return;
    try {
      await createMutation({
        userId,
        name: `${pkg.name} (Copy)`,
        template: pkg.template,
        documentsToSend: pkg.documentsToSend,
        annualRevenueRange: pkg.annualRevenueRange,
        incomeTaxRange: pkg.incomeTaxRange,
        addProjectName: pkg.addProjectName,
        includedServiceIds: pkg.includedServiceIds,
        includedServiceSettings: pkg.includedServiceSettings ?? {},
      });
      toast.success("Package duplicated");
    } catch {
      toast.error("Failed to duplicate");
    }
  }

  async function handleDelete(packageId: Id<"packageTemplates">) {
    if (!userId) return;
    try {
      await removeMutation({ userId, packageId });
      toast.success("Package deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteConfirmId(null);
    }
  }

  async function movePackage(index: number, dir: "up" | "down") {
    if (!userId || filtered.length < 2) return;
    if (sortBy !== "manual") {
      toast.info('Switch sort to "Manual order" to reorder');
      return;
    }
    const j = dir === "up" ? index - 1 : index + 1;
    if (j < 0 || j >= filtered.length) return;
    const a = filtered[index]!;
    const b = filtered[j]!;
    const ids = sorted.map((p) => p._id);
    const ia = ids.indexOf(a._id);
    const ib = ids.indexOf(b._id);
    if (ia < 0 || ib < 0) return;
    const next = [...ids];
    [next[ia], next[ib]] = [next[ib]!, next[ia]!];
    try {
      await reorderMutation({ userId, packageIds: next });
    } catch {
      toast.error("Failed to reorder");
    }
  }

  const sortLabel = SORT_OPTIONS.find((s) => s.id === sortBy)?.label ?? "Manual order";
  const categoryLabel =
    templateFilter === "all" ? "All templates" : templateFilter;

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 min-w-[180px] text-[12px] font-medium justify-between"
                >
                  {categoryLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                <DropdownMenuItem onClick={() => setTemplateFilter("all")}>
                  All templates
                </DropdownMenuItem>
                {templateCategories.length > 0 && <div className="h-px bg-slate-100 my-1" />}
                {templateCategories.map((t) => (
                  <DropdownMenuItem key={t} onClick={() => setTemplateFilter(t)}>
                    {t}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 min-w-[150px] text-[12px] font-medium justify-between"
                >
                  {sortLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                {SORT_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => setSortBy(s.id)}>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#C8A96E" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add package template
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-xl flex flex-col items-center justify-center py-20">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(254,93,51,0.08)" }}
            >
              <Package className="h-6 w-6" style={{ color: "#C8A96E" }} />
            </div>
            <p className="text-[15px] font-semibold text-slate-800 mb-1">
              {packages.length === 0 ? "No package templates yet" : "No packages match this filter"}
            </p>
            <p className="text-[13px] text-slate-400 max-w-sm text-center">
              Create reusable service packages to speed up your proposal workflow.
            </p>
            {packages.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "#C8A96E" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Create your first package
              </button>
            )}
          </div>
        ) : (
          <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
            <ul className="divide-y divide-slate-200">
              {filtered.map((pkg, i) => (
                <li key={pkg._id} className="flex items-center gap-2 py-3 px-4 min-h-[3.25rem]">
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      onClick={() => movePackage(i, "up")}
                      disabled={sortBy !== "manual" || i === 0}
                      title={sortBy !== "manual" ? 'Use "Manual order" sort to reorder' : "Move up"}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      onClick={() => movePackage(i, "down")}
                      disabled={sortBy !== "manual" || i === filtered.length - 1}
                      title={sortBy !== "manual" ? 'Use "Manual order" sort to reorder' : "Move down"}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-slate-800">{pkg.name}</span>
                    <span className="text-[13px] text-slate-500"> – {pkg.template}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                    <button
                      type="button"
                      className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => setDeleteConfirmId(pkg._id)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="h-8 w-8 flex items-center justify-center rounded text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-colors"
                      onClick={() => handleDuplicate(pkg)}
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px]"
                      onClick={() => openEdit(pkg._id)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <CreatePackageSheet
          open={sheetOpen}
          onOpenChange={(o) => {
            setSheetOpen(o);
            if (!o) {
              setSheetMode("create");
              setEditPackageId(undefined);
            }
          }}
          onSuccess={() => toast.success(sheetMode === "edit" ? "Package updated" : "Package created")}
          userId={userId}
          mode={sheetMode}
          editPackageId={editPackageId}
        />
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this package?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{packages.find((p) => p._id === deleteConfirmId)?.name}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
