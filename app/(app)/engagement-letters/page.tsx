"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
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
import { AddVersionSheet } from "@/components/sheets/AddVersionSheet";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScrollText,
  Plus,
  Search,
  Settings2,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  FileText,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";

const ACCENT = "#C8A96E";
const GRID = "grid-cols-[40px_minmax(0,1fr)_140px_44px]";

export default function EngagementLettersPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const convexVersions = useQuery(api.engagementLetters.listLetterVersions, userId ? { userId } : "skip");
  const ensureDefaults = useMutation(api.engagementLetters.ensureDefaultLetterVersions);
  const duplicateVersionMutation = useMutation(api.engagementLetters.duplicateLetterVersion);
  const deleteVersionMutation = useMutation(api.engagementLetters.deleteLetterVersion);

  const versions = useMemo(() => convexVersions ?? [], [convexVersions]);
  const loading = convexVersions === undefined;

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteVersionId, setDeleteVersionId] = useState<Id<"engagementLetterVersions"> | null>(null);
  const [defaultsSeeded, setDefaultsSeeded] = useState(false);

  useEffect(() => {
    if (!userId || defaultsSeeded) return;
    let cancelled = false;
    (async () => {
      try {
        const { created } = await ensureDefaults({ userId });
        if (!cancelled && created > 0) {
          toast.success(`Added ${created} starter templates to your library`);
        }
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setDefaultsSeeded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, defaultsSeeded, ensureDefaults]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.introduction ?? "").toLowerCase().includes(q) ||
        (v.scope ?? "").toLowerCase().includes(q)
    );
  }, [versions, search]);

  async function handleDuplicate(id: Id<"engagementLetterVersions">) {
    if (!userId) return;
    try {
      await duplicateVersionMutation({ userId, versionId: id });
      toast.success("Template duplicated");
    } catch {
      toast.error("Failed to duplicate");
    }
  }

  async function handleDelete() {
    if (!deleteVersionId || !userId) return;
    try {
      await deleteVersionMutation({ userId, versionId: deleteVersionId });
      toast.success("Template removed");
    } catch {
      toast.error("Failed to remove");
    }
    setDeleteVersionId(null);
  }

  const statTotal = versions.length;

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">
        {/* Stat tiles — same visual language as /proposals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 leading-none">
                Scope templates
              </span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#C8A96E]/8">
                <ScrollText className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-12 mt-1" />
            ) : (
              <p className="text-[26px] font-bold text-slate-900 leading-none tabular-nums">{statTotal}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-1 leading-tight">In your library</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 leading-none">
                Suite settings
              </span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-100">
                <Settings2 className="h-3.5 w-3.5 text-slate-500" />
              </div>
            </div>
            <p className="text-[13px] font-medium text-slate-700 leading-snug">Letterhead, dates, people &amp; emails</p>
            <Link
              href="/engagement-letters/settings"
              className="inline-flex mt-2 text-[12px] font-semibold hover:underline"
              style={{ color: ACCENT }}
            >
              Open settings →
            </Link>
          </div>
          <div className="bg-white border border-slate-100 rounded-xl p-4 sm:col-span-1 col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 leading-none">
                Tip
              </span>
              <FileText className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              Edit a template to work on introduction &amp; scope. Use{" "}
              <span className="font-medium text-slate-800">Suite settings</span> for firm-wide letterhead and emails.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-9 text-[13px]" asChild>
              <Link href="/engagement-letters/settings">
                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                Suite settings
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 text-[13px] font-semibold text-white"
              style={{ background: ACCENT }}
              onClick={() => setSheetOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New template
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <span className="text-[14px] font-semibold text-slate-900">Scope library</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Starter templates are added automatically — duplicate or customise anytime
              </p>
            </div>
            {!loading && (
              <span className="text-[11px] text-slate-400">
                {filtered.length} template{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className={cn("grid px-4 py-2.5 border-b border-slate-50 gap-3 bg-slate-50/60", GRID)}>
                {["#", "Template", "Last updated", ""].map((h, i) => (
                  <span
                    key={h}
                    className={cn(
                      "text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 whitespace-nowrap",
                      i === 3 && "text-right"
                    )}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {loading ? (
                <div className="divide-y divide-slate-50">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={cn("grid px-4 py-4 gap-3 items-center", GRID)}>
                      <Skeleton className="h-3 w-4 mx-auto" />
                      <Skeleton className="h-4 w-full max-w-md" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-6 w-6 rounded mx-auto" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <ScrollText className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-[15px] font-semibold text-slate-700">
                    {search ? "No templates match your search" : "No templates yet"}
                  </p>
                  {!search && (
                    <Button
                      type="button"
                      className="mt-4 h-9 text-[13px] font-semibold text-white"
                      style={{ background: ACCENT }}
                      onClick={() => setSheetOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add template
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filtered.map((v, idx) => (
                    <div
                      key={v._id}
                      className={cn("grid px-4 py-3.5 gap-3 items-center hover:bg-slate-50/60 transition-colors", GRID)}
                    >
                      <span className="text-[11px] font-medium text-slate-300 text-center tabular-nums">{idx + 1}</span>
                      <div className="min-w-0">
                        <Link
                          href={`/engagement-letters/${v._id}`}
                          className="text-[13px] font-semibold text-slate-900 truncate hover:underline block"
                          style={{ color: ACCENT }}
                        >
                          {v.name}
                        </Link>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {(v.introduction ?? "").slice(0, 90)}
                          {(v.introduction ?? "").length > 90 ? "…" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="h-3 w-3 shrink-0 opacity-60" />
                        {formatDate(v.updatedAt)}
                      </div>
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              aria-label="Actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-lg border border-slate-100 shadow-lg p-1">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/engagement-letters/${v._id}`}
                                className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
                              >
                                <Pencil className="h-4 w-4 shrink-0 text-blue-500" /> Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(v._id)}
                              className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md"
                            >
                              <Copy className="h-4 w-4 shrink-0 text-slate-400" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem
                              onClick={() => setDeleteVersionId(v._id)}
                              className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md text-red-500 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 shrink-0" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteVersionId} onOpenChange={(o) => !o && setDeleteVersionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This scope template will be removed from your library. You can add a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddVersionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userId={userId}
        onSuccess={() => toast.success("Template added")}
      />
    </>
  );
}
