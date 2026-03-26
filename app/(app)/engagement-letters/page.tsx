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
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { ScopeLibraryStarterTooltip } from "@/components/engagement/ScopeLibraryStarterTooltip";

const ACCENT = "#C8A96E";
/** # · template fills remaining space · last updated · actions pinned right */
const GRID = "grid-cols-[1.75rem_1fr_minmax(7.5rem,9rem)_2.5rem] gap-x-4";

export default function EngagementLettersPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const convexVersions = useQuery(api.engagementLetters.listLetterVersions, userId ? { userId } : "skip");
  const ensureDefaults = useMutation(api.engagementLetters.ensureDefaultLetterVersions);
  const fixLegacyNames = useMutation(api.engagementLetters.fixLegacyBundledTemplateNames);
  const repairLegacyAfsBodies = useMutation(api.engagementLetters.repairLegacyAfsBundledLetterBodies);
  const duplicateVersionMutation = useMutation(api.engagementLetters.duplicateLetterVersion);
  const deleteVersionMutation = useMutation(api.engagementLetters.deleteLetterVersion);

  const versions = useMemo(() => convexVersions ?? [], [convexVersions]);
  const loading = convexVersions === undefined;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteVersionId, setDeleteVersionId] = useState<Id<"engagementLetterVersions"> | null>(null);
  const [defaultsSeeded, setDefaultsSeeded] = useState(false);

  useEffect(() => {
    if (!userId || defaultsSeeded) return;
    let cancelled = false;
    (async () => {
      try {
        await fixLegacyNames({ userId });
        await repairLegacyAfsBodies({ userId });
        const { created } = await ensureDefaults({ userId });
        if (!cancelled && created > 0) {
          const byCount: Record<number, string> = {
            1: "Added 1 starter template to your library",
            2: "Added 2 starter templates to your library",
            3: "Added 3 starter templates to your library",
            4: "Added all four starter templates (AFS, Property Practitioners, Legal Practitioners, Review) to your library",
            5: "Added all five starter templates (AFS, Property Practitioners, Legal Practitioners, Review, Audit) to your library",
          };
          toast.success(byCount[created] ?? `Added ${created} starter templates to your library`);
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
  }, [userId, defaultsSeeded, ensureDefaults, fixLegacyNames, repairLegacyAfsBodies]);

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

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">
        {/* Table */}
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-[14px] font-semibold text-slate-900">Scope library</span>
              <ScopeLibraryStarterTooltip />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!loading && (
                <span className="text-[11px] text-slate-400">
                  {versions.length} template{versions.length !== 1 ? "s" : ""}
                </span>
              )}
              <Button
                type="button"
                size="sm"
                className="h-8 text-[12px] font-semibold text-white"
                style={{ background: ACCENT }}
                onClick={() => setSheetOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New template
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="w-full min-w-0">
              <div className={cn("grid pl-2 pr-4 py-2.5 border-b border-slate-50 items-center bg-slate-50/60", GRID)}>
                {["#", "Template", "Last updated", ""].map((h, i) => (
                  <span
                    key={h}
                    className={cn(
                      "text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 whitespace-nowrap",
                      i === 0 && "text-center tabular-nums",
                      i === 2 && "text-left",
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
                    <div key={i} className={cn("grid pl-2 pr-4 py-4 items-start", GRID)}>
                      <Skeleton className="h-3 w-5 justify-self-end" />
                      <Skeleton className="h-4 w-full max-w-[20rem]" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-6 w-6 shrink-0 justify-self-end rounded" />
                    </div>
                  ))}
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <ScrollText className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-[15px] font-semibold text-slate-700">No templates yet</p>
                  <Button
                    type="button"
                    className="mt-4 h-9 text-[13px] font-semibold text-white"
                    style={{ background: ACCENT }}
                    onClick={() => setSheetOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add template
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {versions.map((v, idx) => (
                    <div
                      key={v._id}
                      className={cn("grid pl-2 pr-4 py-3.5 items-start hover:bg-slate-50/60 transition-colors", GRID)}
                    >
                      <span className="block w-full pt-0.5 text-center text-[11px] font-medium tabular-nums text-slate-400">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/engagement-letters/${v._id}`}
                          className="text-[13px] font-semibold text-slate-900 hover:underline block break-words"
                          style={{ color: ACCENT }}
                        >
                          {v.name}
                        </Link>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-3 whitespace-normal break-words leading-snug">
                          {(() => {
                            const snippet = [v.introduction, v.scope]
                              .filter(Boolean)
                              .join(" ")
                              .replace(/\s+/g, " ")
                              .trim();
                            if (!snippet) return "—";
                            return snippet.length > 280 ? `${snippet.slice(0, 280)}…` : snippet;
                          })()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-0.5">
                        <Clock className="h-3 w-3 shrink-0 opacity-60" />
                        {formatDate(v.updatedAt)}
                      </div>
                      <div className="flex justify-end pt-0.5">
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
