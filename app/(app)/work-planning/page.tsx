"use client";

import { useState, useMemo, Fragment, useRef, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import type { WorkPlanEntry, BillingCategory, Frequency } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthPicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock, CheckCircle2, AlertCircle, Calendar,
  Plus, ChevronDown, ChevronLeft, ChevronRight,
  MoreHorizontal, Trash2, History, X, Loader2,
  ListTodo, Timer,
} from "lucide-react";
import { toast } from "sonner";
import { cn, dedupeById } from "@/lib/utils";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  upcoming:    { label: "Upcoming",    dot: "bg-slate-300",   text: "text-slate-500",   badge: "bg-slate-50 border border-slate-200 text-slate-600" },
  in_progress: { label: "In Progress", dot: "bg-blue-400",    text: "text-blue-700",    badge: "bg-blue-50 border border-blue-200 text-blue-700" },
  completed:   { label: "Completed",   dot: "bg-emerald-400", text: "text-emerald-700", badge: "bg-emerald-50 border border-emerald-200 text-emerald-700" },
  overdue:     { label: "Overdue",     dot: "bg-red-400",     text: "text-red-700",     badge: "bg-red-50 border border-red-200 text-red-700" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

const PAGE_SIZE = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as StatusKey] ?? { badge: "bg-slate-50 border border-slate-200 text-slate-500", label: status };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", cfg.badge)}>
      {cfg.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkPlanningPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;
  const firmId = user?.firmId ?? "";

  const convexRows = useQuery(api.workPlanning.listWorkPlanTasks, userId ? { userId } : "skip");
  const createTask = useMutation(api.workPlanning.createManualWorkPlanTask);
  const updateStatusMut = useMutation(api.workPlanning.updateWorkPlanTaskStatus);
  const deleteTaskMut = useMutation(api.workPlanning.deleteWorkPlanTask);
  const resyncWorkPlanTasks = useMutation(api.workPlanning.resyncWorkPlanTasksForFirm);
  const resyncOnce = useRef(false);

  const uniqueRows = useMemo(() => dedupeById(convexRows ?? []), [convexRows]);

  const entries = useMemo<WorkPlanEntry[]>(() => {
    if (!uniqueRows.length) return [];
    return uniqueRows.map((r) => ({
      id: r._id,
      firmId,
      proposalId: r.proposalId ?? "",
      proposalItemId: "",
      clientGroupId: r.clientGroupId,
      serviceName: r.displayLabel,
      clientName: r.clientName,
      billingCategory: r.billingCategory as BillingCategory,
      frequency: r.frequency as Frequency,
      scheduledMonth: r.scheduledMonth,
      estimatedHours: r.estimatedHours,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
      source: r.source,
    }));
  }, [uniqueRows, firmId]);

  const loading = Boolean(userId) && convexRows === undefined;
  const [view,     setView]     = useState<"list" | "board">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter,  setMonthFilter]  = useState("all");
  const [page,         setPage]         = useState(0);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Add task sheet
  const [addOpen,      setAddOpen]      = useState(false);
  const [taskName,     setTaskName]     = useState("");
  const [taskClientId, setTaskClientId] = useState("");
  const [taskMonth,    setTaskMonth]    = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [taskHours,  setTaskHours]  = useState("1");
  const [taskStatus, setTaskStatus] = useState<StatusKey>("upcoming");
  const [taskSaving, setTaskSaving] = useState(false);

  const convexClients = useQuery(api.clients.listClientsForSelect, userId ? { userId } : "skip");

  /** Rebuild tasks from saved proposals (older drafts may never have created rows). */
  useEffect(() => {
    if (!userId || resyncOnce.current) return;
    resyncOnce.current = true;
    resyncWorkPlanTasks({ userId }).catch((err) => {
      console.error("Work plan resync failed:", err);
      resyncOnce.current = false;
    });
  }, [userId, resyncWorkPlanTasks]);

  const clients = useMemo(
    () => (convexClients ?? []).map((c) => ({ id: c._id, name: c.companyName })),
    [convexClients]
  );

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients]
  );

  // ─── Stats ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total     = entries.length;
    const inProg    = entries.filter((e) => e.status === "in_progress").length;
    const completed = entries.filter((e) => e.status === "completed").length;
    const overdue   = entries.filter((e) => e.status === "overdue").length;
    const upcoming  = entries.filter((e) => e.status === "upcoming").length;
    const hours     = entries.reduce((s, e) => s + (e.estimatedHours ?? 0), 0);
    return [
      { label: "Total Tasks",    sublabel: "All work items",      value: total.toString(),          icon: ListTodo,      iconBg: "bg-slate-100",   iconColor: "#64748b" },
      { label: "In Progress",    sublabel: "Currently active",    value: inProg.toString(),          icon: Clock,         iconBg: "bg-blue-50",     iconColor: "#3b82f6" },
      { label: "Completed",      sublabel: "Done this period",    value: completed.toString(),       icon: CheckCircle2,  iconBg: "bg-emerald-50",  iconColor: "#10b981" },
      { label: "Overdue",        sublabel: "Needs attention",     value: overdue.toString(),         icon: AlertCircle,   iconBg: "bg-red-50",      iconColor: "#ef4444" },
      { label: "Est. Hours",     sublabel: "Total estimated",     value: `${hours.toFixed(1)}h`,    icon: Timer,         iconBg: "bg-violet-50",   iconColor: "#8b5cf6" },
      { label: "Upcoming",       sublabel: "Not yet started",     value: upcoming.toString(),        icon: Calendar,      iconBg: "bg-amber-50",    iconColor: "#f59e0b" },
    ];
  }, [entries]);

  // ─── Available months ────────────────────────────────────────────────────

  const availableMonths = useMemo(() => {
    const set = new Set(entries.map((e) => e.scheduledMonth).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [entries]);

  // ─── Filtered + grouped ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (monthFilter !== "all" && e.scheduledMonth !== monthFilter) return false;
      return true;
    });
  }, [entries, statusFilter, monthFilter]);

  // Group by client
  const groupedByClient = useMemo(() => {
    const map = new Map<string, WorkPlanEntry[]>();
    filtered.forEach((e) => {
      const key = e.clientGroupId || "__no_client__";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return Array.from(map.entries()).map(([clientId, tasks]) => ({ clientId, tasks }));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(groupedByClient.length / PAGE_SIZE));
  const paged      = groupedByClient.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Board groups
  const byStatus = useMemo(() => {
    const map: Record<string, WorkPlanEntry[]> = {};
    filtered.forEach((e) => {
      if (!map[e.status]) map[e.status] = [];
      map[e.status].push(e);
    });
    return map;
  }, [filtered]);

  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleUpdateStatus(id: string, status: StatusKey) {
    if (!userId) return;
    try {
      const res = await updateStatusMut({
        userId,
        taskId: id as Id<"workPlanTasks">,
        status,
      });
      if (!res.success) {
        toast.error(res.error ?? "Could not update status");
        return;
      }
      toast.success("Status updated");
    } catch {
      toast.error("Could not update status");
    }
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    try {
      const res = await deleteTaskMut({ userId, taskId: id as Id<"workPlanTasks"> });
      if (!res.success) {
        toast.error(res.error ?? "Could not delete");
        return;
      }
      toast.success("Task deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete");
    }
  }

  async function handleAddTask() {
    if (!taskName.trim()) { toast.error("Task name is required"); return; }
    if (!userId) { toast.error("Not signed in"); return; }
    if (!taskClientId) { toast.error("Please select a client"); return; }
    setTaskSaving(true);
    try {
      await createTask({
        userId,
        clientId: taskClientId as Id<"clients">,
        serviceName: taskName.trim(),
        scheduledMonth: taskMonth,
        estimatedHours: parseFloat(taskHours) || 1,
        status: taskStatus,
      });
      toast.success(`Task "${taskName.trim()}" added`);
      setTaskName(""); setTaskClientId(""); setTaskHours("1"); setTaskStatus("upcoming");
      setAddOpen(false);
    } catch {
      toast.error("Could not add task");
    } finally {
      setTaskSaving(false);
    }
  }

  const hasFilters = statusFilter !== "all" || monthFilter !== "all";

  const statusLabel = statusFilter === "all" ? "All statuses"
    : STATUS_CONFIG[statusFilter as StatusKey]?.label ?? statusFilter;

  const monthLabel = monthFilter === "all" ? "All months" : monthFilter;

  return (
    <>
      <Header />

      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        {/* ── Stats Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map((card) => {
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
                  <p className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">{card.value}</p>
                )}
                <p className="text-[10px] text-slate-400">{card.sublabel}</p>
              </div>
            );
          })}
        </div>

        {/* ── Toolbar (filters + view + add) ──────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[140px] text-[12px] font-medium justify-between">
                  {statusLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0 ml-1" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                <DropdownMenuItem onClick={() => { setStatusFilter("all"); setPage(0); }}>All statuses</DropdownMenuItem>
                {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
                  <DropdownMenuItem key={s} onClick={() => { setStatusFilter(s); setPage(0); }}>
                    <span className={cn("w-1.5 h-1.5 rounded-full mr-2 shrink-0", cfg.dot)} />
                    {cfg.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[140px] text-[12px] font-medium justify-between">
                  {monthLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0 ml-1" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                <DropdownMenuItem onClick={() => { setMonthFilter("all"); setPage(0); }}>All months</DropdownMenuItem>
                {availableMonths.map((m) => (
                  <DropdownMenuItem key={m} onClick={() => { setMonthFilter(m); setPage(0); }}>{m}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[11px] font-normal text-slate-600 rounded"
                onClick={() => { setStatusFilter("all"); setMonthFilter("all"); setPage(0); }}>
                Clear filters
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {(["list", "board"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                    view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}>
                  {v === "list" ? "List" : "Board"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#C8A96E" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {view === "list" ? (

          /* LIST VIEW */
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <span className="text-[14px] font-semibold text-slate-900">Work Plan</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Grouped by client. Tasks are rebuilt from saved proposals when you open this page and whenever you save a proposal (estimated hours and optional &ldquo;Scheduled work month&rdquo; per line). Add one-off items with Add Task.
                </p>
              </div>
              <span className="text-[11px] text-slate-400 tabular-nums">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[780px]">

                {/* Column headers */}
                <div className="grid grid-cols-[36px_1fr_120px_100px_100px_44px] px-4 py-2.5 border-b border-slate-50 gap-3 bg-slate-50/60">
                  {["#","Service / Client","Status","Est. Hours","Month",""].map((h) => (
                    <span key={h} className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 whitespace-nowrap">{h}</span>
                  ))}
                </div>

                {loading ? (
                  <div className="divide-y divide-slate-50">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-[36px_1fr_120px_100px_100px_44px] px-4 py-4 gap-3 items-center">
                        <Skeleton className="h-3 w-4 mx-auto" />
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-5 w-20 rounded" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-6 w-6 rounded mx-auto" />
                      </div>
                    ))}
                  </div>
                ) : paged.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ListTodo className="h-8 w-8 text-slate-200 mb-3" />
                    <p className="text-[13px] text-slate-400">
                      {hasFilters ? "No tasks match your filters" : "No tasks yet"}
                    </p>
                    {!hasFilters && (
                      <button onClick={() => setAddOpen(true)} className="mt-3 text-[12px] font-semibold hover:underline" style={{ color: "#C8A96E" }}>
                        Add your first task
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {paged.map(({ clientId, tasks }, idx) => {
                      const client  = clientId !== "__no_client__" ? clientMap[clientId] : null;
                      const rowNum  = page * PAGE_SIZE + idx + 1;
                      const isOpen  = expanded.has(clientId);
                      const latest  = tasks[0];
                      const rest    = tasks.slice(1);
                      const clientLabel =
                        client?.name?.trim() ||
                        latest.clientName?.trim() ||
                        (clientId !== "__no_client__" ? "Client" : "");

                      return (
                        <Fragment key={`wg-${page * PAGE_SIZE + idx}`}>
                          {/* Main row */}
                          <div className="grid grid-cols-[36px_1fr_120px_100px_100px_44px] px-4 py-3.5 gap-3 items-start hover:bg-slate-50/60 transition-colors">
                            <span className="text-[11px] font-medium text-slate-300 text-center tabular-nums pt-1">{rowNum}</span>

                            <div className="min-w-0">
                              {clientLabel && (
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[12px] font-semibold text-slate-800 truncate">{clientLabel}</span>
                                </div>
                              )}
                              <p className="text-[11px] text-slate-500 truncate">{latest.serviceName}</p>
                              {latest.source && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {latest.source === "proposal" ? "From saved proposal" : "Manual entry"}
                                </p>
                              )}
                              {rest.length > 0 && (
                                <button onClick={() => toggleExpand(clientId)}
                                  className="mt-1 text-[10px] font-semibold hover:underline flex items-center gap-1"
                                  style={{ color: "#C8A96E" }}>
                                  <History className="h-3 w-3 shrink-0" />
                                  {isOpen ? "Hide tasks" : `Show tasks (${rest.length} more)`}
                                </button>
                              )}
                            </div>

                            <div className="pt-0.5"><StatusBadge status={latest.status} /></div>

                            <span className="text-[11px] text-slate-700 pt-1 tabular-nums">
                              {latest.estimatedHours ? `${latest.estimatedHours}h` : "—"}
                            </span>

                            <span className="text-[11px] text-slate-400 pt-1">{latest.scheduledMonth ?? "—"}</span>

                            <div className="flex justify-center pt-0.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-lg border border-slate-100 shadow-lg p-1">
                                  {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => (
                                    <DropdownMenuItem key={s} onClick={() => handleUpdateStatus(latest.id, s)}
                                      className={cn("flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md", latest.status === s && "bg-slate-50")}>
                                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                                      Mark {STATUS_CONFIG[s].label}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator className="my-1" />
                                  <DropdownMenuItem onClick={() => setDeleteTarget({ id: latest.id, name: latest.serviceName })}
                                    className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md text-red-500 focus:text-red-600 focus:bg-red-50">
                                    <Trash2 className="h-4 w-4 shrink-0" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Expanded task rows */}
                          {isOpen && rest.map((task) => (
                            <div key={task.id}
                              className="grid grid-cols-[36px_1fr_120px_100px_100px_44px] px-4 py-3 gap-3 items-start bg-slate-50/70 border-t border-dashed border-slate-100">
                              <span />
                              <div className="min-w-0 pl-4 border-l-2 border-slate-200">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-slate-700 truncate">{task.serviceName}</p>
                                  {task.source && (
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      {task.source === "proposal" ? "From proposal" : "Manual"}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="pt-0.5"><StatusBadge status={task.status} /></div>
                              <span className="text-[11px] text-slate-600 pt-0.5 tabular-nums">
                                {task.estimatedHours ? `${task.estimatedHours}h` : "—"}
                              </span>
                              <span className="text-[11px] text-slate-400 pt-0.5">{task.scheduledMonth ?? "—"}</span>
                              <div className="flex justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 rounded-lg border border-slate-100 shadow-lg p-1">
                                    {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => (
                                      <DropdownMenuItem key={s} onClick={() => handleUpdateStatus(task.id, s)}
                                        className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md">
                                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                                        Mark {STATUS_CONFIG[s].label}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator className="my-1" />
                                    <DropdownMenuItem onClick={() => setDeleteTarget({ id: task.id, name: task.serviceName })}
                                      className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer rounded-md text-red-500 focus:text-red-600 focus:bg-red-50">
                                      <Trash2 className="h-4 w-4 shrink-0" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))}
                        </Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, groupedByClient.length)} of {groupedByClient.length} client groups
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors">
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
                            <button key={p} onClick={() => setPage(p)}
                              className={cn("h-7 w-7 flex items-center justify-center rounded-md text-[11px] font-semibold transition-colors",
                                page === p ? "text-white" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100")}
                              style={page === p ? { background: "#C8A96E" } : {}}>
                              {p + 1}
                            </button>
                          )
                        );
                      })()}
                      <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

        ) : (

          /* BOARD VIEW */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([status, cfg]) => {
              const items = byStatus[status] ?? [];
              return (
                <div key={status} className="w-60 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                    <p className="text-[13px] font-semibold text-slate-700">{cfg.label}</p>
                    <span className="ml-auto text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full tabular-nums">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((entry) => {
                      const client = clientMap[entry.clientGroupId];
                      const clientLabel =
                        client?.name?.trim() || entry.clientName?.trim() || "";
                      return (
                        <div key={entry.id} className="bg-white border border-slate-100 rounded-xl p-3.5 hover:border-slate-200 transition-colors">
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold text-slate-800">{entry.serviceName}</p>
                              {clientLabel && <p className="text-[11px] text-slate-400 mt-0.5">{clientLabel}</p>}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-6 w-6 flex items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 -mt-0.5 -mr-1">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => (
                                  <DropdownMenuItem key={s} onClick={() => handleUpdateStatus(entry.id, s)}
                                    className={cn("flex items-center gap-2 text-[12px]", entry.status === s && "bg-slate-50")}>
                                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                                    Mark {STATUS_CONFIG[s].label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget({ id: entry.id, name: entry.serviceName })}
                                  className="flex items-center gap-2 text-[12px] text-red-500 focus:text-red-600 focus:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center gap-3 mt-2.5">
                            {entry.estimatedHours && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="h-3 w-3" />{entry.estimatedHours}h
                              </span>
                            )}
                            {entry.scheduledMonth && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Calendar className="h-3 w-3" />{entry.scheduledMonth}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-slate-100 p-5 text-center">
                        <p className="text-[12px] text-slate-400">No tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Task Sheet ───────────────────────────────────────────────── */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
          <SheetTitle className="sr-only">Add Task</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: "rgba(254,93,51,0.08)" }}>
                    <ListTodo className="h-7 w-7" style={{ color: "#C8A96E" }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">Add Task</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Add a new work planning task</p>
                  </div>
                </div>
                <button onClick={() => setAddOpen(false)} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Service / task name <span className="text-red-500">*</span></Label>
                <input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="e.g. Monthly Bookkeeping"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Client</Label>
                  <Select value={taskClientId} onValueChange={setTaskClientId}>
                    <SelectTrigger className="h-10 text-[13px] border-slate-200 rounded-lg">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.filter((c) => !(c as { isArchived?: boolean }).isArchived).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Status</Label>
                  <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as StatusKey)}>
                    <SelectTrigger className="h-10 text-[13px] border-slate-200 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([s, cfg]) => (
                        <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Scheduled month</Label>
                  <MonthPicker value={taskMonth} onChange={setTaskMonth} placeholder="Select month" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Estimated hours</Label>
                  <Input type="number" min="0.5" step="0.5" value={taskHours} onChange={(e) => setTaskHours(e.target.value)} className="h-10 text-[13px] border-slate-200 rounded-lg" />
                </div>
              </div>
            </div>

            <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
              <button onClick={() => setAddOpen(false)} disabled={taskSaving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button onClick={handleAddTask} disabled={taskSaving || !taskName.trim()}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
                style={{ background: "#C8A96E" }}>
                {taskSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</> : "Add Task"}
              </button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <div className="flex items-start justify-between gap-4">
            <AlertDialogHeader className="flex-1 space-y-2 text-left">
              <AlertDialogTitle>Delete task?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <button type="button" onClick={() => setDeleteTarget(null)} className="-m-1 p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget.id)} className="bg-red-600 hover:bg-red-700">Yes, delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
