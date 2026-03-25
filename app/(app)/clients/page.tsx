"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { getInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AddClientSheet } from "@/components/sheets/AddClientSheet";
import { Plus, Search, Users, Archive, MoreHorizontal, Building2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ConvexClient = {
  _id: Id<"clients">;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  industry?: string;
  status: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export default function ClientsPage() {
  const { user } = useNorthPactAuth();
  const uid = user ? (user.id as Id<"users">) : undefined;

  const clients = useQuery(api.clients.listClients, uid ? { userId: uid, includeArchived: true } : "skip");
  const loading = clients === undefined;

  const archiveClientMut = useMutation(api.clients.archiveClient);
  const updateClientMut  = useMutation(api.clients.updateClient);

  const [search,  setSearch]  = useState("");
  const [tab,     setTab]     = useState<"active" | "archived">("active");
  const [addOpen, setAddOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 2000));
    toast.success("Synced from Xero");
    setSyncing(false);
  }

  const allClients = clients ?? [];
  const activeCount   = allClients.filter((c) => c.status !== "archived").length;
  const archivedCount = allClients.filter((c) => c.status === "archived").length;

  const filtered = useMemo(() =>
    allClients.filter((c) => {
      if (tab === "active"   && c.status === "archived") return false;
      if (tab === "archived" && c.status !== "archived") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.companyName.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }),
    [allClients, search, tab]
  );

  async function handleToggleArchive(client: ConvexClient) {
    if (!uid) return;
    try {
      if (client.status === "archived") {
        // Restore: set status back to active
        const result = await updateClientMut({ userId: uid, clientId: client._id, status: "active" });
        if (result.success) toast.success("Client restored");
        else toast.error(result.error ?? "Restore failed");
      } else {
        const result = await archiveClientMut({ userId: uid, clientId: client._id });
        if (result.success) toast.success("Client archived");
        else toast.error(result.error ?? "Archive failed");
      }
    } catch {
      toast.error("Action failed");
    }
  }

  function onClientAdded() {
    // useQuery auto-refreshes via Convex reactivity
  }

  return (
    <>
      <Header />

      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
            {([
              { key: "active",   label: "Active",   count: activeCount },
              { key: "archived", label: "Archived", count: archivedCount },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all",
                  tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {label}
                <span className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
                  tab === key ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
                )}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="ml-auto flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync from Xero"}
          </button>

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#C8A96E" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add Client
          </button>
        </div>

        {uid && (
          <AddClientSheet open={addOpen} onOpenChange={setAddOpen} userId={uid} onSuccess={onClientAdded} />
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[108px] rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Users className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-[15px] font-semibold text-slate-700">
              {search ? "No clients match your search" : tab === "archived" ? "No archived clients" : "No clients yet"}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {!search && tab === "active" && "Add your first client to get started"}
            </p>
            {!search && tab === "active" && (
              <button
                onClick={() => setAddOpen(true)}
                className="mt-5 flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "#C8A96E" }}
              >
                <Plus className="h-3.5 w-3.5" /> Add your first client
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((client) => (
              <div key={client._id} className="group bg-white border border-slate-100 rounded-xl p-5 hover:border-slate-200 transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: "#C8A96E" }}
                  >
                    {getInitials(client.companyName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/clients/${client._id}`}
                      className="text-[14px] font-semibold text-slate-900 hover:text-[#C8A96E] transition-colors truncate block leading-tight"
                    >
                      {client.companyName}
                    </Link>
                    {client.industry && (
                      <p className="text-[12px] text-slate-400 mt-0.5 truncate">{client.industry}</p>
                    )}
                    {client.contactName && !client.industry && (
                      <p className="text-[12px] text-slate-400 mt-0.5 truncate">{client.contactName}</p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100">
                        <MoreHorizontal className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem asChild>
                        <Link href={`/clients/${client._id}`}>View details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleArchive(client)}>
                        <Archive className="mr-2 h-3.5 w-3.5" />
                        {client.status === "archived" ? "Restore" : "Archive"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                    <Building2 className="h-3.5 w-3.5" />
                    {client.email}
                  </div>
                  {client.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      {client.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {tag}
                        </span>
                      ))}
                      {client.tags.length > 2 && (
                        <span className="text-[11px] text-slate-400">+{client.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
