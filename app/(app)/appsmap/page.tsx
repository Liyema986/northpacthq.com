"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddIntegrationSheet } from "@/components/sheets/AddIntegrationSheet";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import {
  Plug,
  CheckCircle,
  Clock,
  Settings2,
  Zap,
  RefreshCw,
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Integration catalog (metadata for display) ───────────────────────────────

type IntegrationType = "accounting" | "payments" | "crm";

interface IntegrationMeta {
  provider: string;
  name: string;
  description: string;
  type: IntegrationType;
  color: string;
  initials: string;
  comingSoon?: boolean;
}

const INTEGRATION_CATALOG: IntegrationMeta[] = [
  { provider: "xero",        name: "Xero",        description: "Sync clients and invoices with Xero accounting.",    type: "accounting", color: "#13B5EA", initials: "X"  },
  { provider: "quickbooks",  name: "QuickBooks",  description: "Two-way sync with QuickBooks Online.",               type: "accounting", color: "#2CA01C", initials: "QB", comingSoon: true },
  { provider: "stripe",      name: "Stripe",      description: "Accept payments and track invoices via Stripe.",      type: "payments",   color: "#635BFF", initials: "St", comingSoon: true },
  { provider: "hubspot",     name: "HubSpot",     description: "Sync contacts and deals with your CRM pipeline.",    type: "crm",        color: "#FF7A59", initials: "HS", comingSoon: true },
  { provider: "sage",        name: "Sage",        description: "Sync with Sage accounting.",                         type: "accounting", color: "#00DC82", initials: "SG", comingSoon: true },
];

function formatLastSync(ts: number | null): string {
  if (ts === null) return "Never";
  const d = Date.now() - ts;
  if (d < 60_000) return "Just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AppsMapContent() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;
  const searchParams = useSearchParams();

  const xeroToastFired = useRef(false);

  // Handle Xero OAuth callback result
  useEffect(() => {
    const xeroParam = searchParams.get("xero");
    if (!xeroParam || xeroToastFired.current) return;
    xeroToastFired.current = true;

    if (xeroParam === "success") {
      toast.success("Xero connected successfully!", {
        description: "Your contacts and invoices will sync shortly.",
        duration: 5000,
      });
    } else if (xeroParam === "error") {
      const reason = searchParams.get("reason") ?? "";
      const friendlyMessages: Record<string, string> = {
        // CSRF / state
        csrf_mismatch:              "Security check failed. Please try connecting again.",
        invalid_state:              "The authorisation request was invalid. Please try again.",
        // Missing params
        missing_code_or_state:      "Authorisation was incomplete. Please try again.",
        // Server config
        server_config_missing:      "Xero is not fully configured on this server. Contact your administrator.",
        // Token exchange
        token_exchange_failed:      "Could not exchange the authorisation code. Check that the Redirect URI in your Xero app matches exactly and try again.",
        token_exchange_network_error: "Network error contacting Xero. Please check your connection and try again.",
        invalid_token_response:     "Xero returned an invalid token. Please try again.",
        // Tenant
        no_tenant_id:               "Could not find a Xero organisation linked to your account. Make sure you have an active organisation in Xero and try connecting again.",
        // Storing tokens
        store_tokens_network_error: "Could not save your Xero connection. Please try again.",
        store_tokens_failed:        "Failed to save your Xero connection. Please try again.",
        // User cancelled
        access_denied:              "Xero access was denied. Please try again.",
      };
      const msg = friendlyMessages[reason] ?? "Could not connect to Xero. Please try again.";
      toast.error(msg, { duration: 7000 });
    }

    // Clean up query params without a page reload
    const url = new URL(window.location.href);
    url.searchParams.delete("xero");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams]);

  // Derive firmId from getFirmSettings
  const firmSettings = useQuery(api.firms.getFirmSettings, userId ? { userId } : "skip");
  const firmId = firmSettings?._id;

  // Convex queries
  const addedIntegrations = useQuery(
    api.integrations.listFirmIntegrations,
    firmId ? { firmId } : "skip"
  );
  const stats = useQuery(
    api.integrations.getAppsMapStats,
    firmId ? { firmId } : "skip"
  );
  const xeroConn = useQuery(
    api.integrations.getXeroConnection,
    userId ? { userId } : "skip"
  );

  // Convex mutations
  const addIntegrationMut    = useMutation(api.integrations.addFirmIntegration);
  const removeIntegrationMut = useMutation(api.integrations.removeFirmIntegration);
  const disconnectXeroMut    = useMutation(api.integrations.disconnectXero);
  const runSyncMut           = useMutation(api.integrations.runSync);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [xeroSheetOpen, setXeroSheetOpen] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [xeroSyncPending, setXeroSyncPending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | "not-connected">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "accounting" | "payments" | "crm">("all");

  const loading = firmSettings === undefined || addedIntegrations === undefined || stats === undefined;

  // Build the display list: combine catalog with added integrations
  // An integration card shows when it's in `addedIntegrations` (or is always visible from catalog)
  const addedProviders = useMemo(() => new Set((addedIntegrations ?? []).map((i) => i.provider)), [addedIntegrations]);

  // Map: provider → firmIntegration record _id (for remove)
  const addedIdMap = useMemo(() => {
    const m = new Map<string, Id<"firmIntegrations">>();
    for (const row of addedIntegrations ?? []) m.set(row.provider, row._id);
    return m;
  }, [addedIntegrations]);

  // Xero is "connected" if there's an active connection record
  const xeroConnected = !!xeroConn;

  // Build integration display rows: show all catalog items, with real connected/added state
  const allRows = useMemo(() => INTEGRATION_CATALOG.map((meta) => ({
    ...meta,
    added: addedProviders.has(meta.provider),
    connected: meta.provider === "xero" ? xeroConnected : false,
    firmIntegrationId: addedIdMap.get(meta.provider) ?? null,
  })), [addedProviders, xeroConnected, addedIdMap]);

  const filteredList = useMemo(() => allRows.filter((row) => {
    if (!row.added) return false; // only show added integrations
    if (statusFilter === "connected" && !row.connected) return false;
    if (statusFilter === "not-connected" && row.connected) return false;
    if (typeFilter !== "all" && row.type !== typeFilter) return false;
    return true;
  }), [allRows, statusFilter, typeFilter]);

  const statusLabel = statusFilter === "all" ? "All statuses" : statusFilter === "connected" ? "Connected" : "Not connected";
  const typeLabel   = typeFilter === "all" ? "All types" : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1);

  async function handleSync() {
    setSyncPending(true);
    try {
      const result = await runSyncMut({});
      if (result.success) {
        toast.success(result.syncedCount > 0 ? `Synced ${result.syncedCount} integration${result.syncedCount !== 1 ? "s" : ""}` : "Nothing to sync — no connected integrations yet");
      } else {
        toast.error(result.error ?? "Sync failed");
      }
    } catch { toast.error("Sync failed"); }
    finally { setSyncPending(false); }
  }

  async function handleToggle(provider: string, currentlyConnected: boolean, firmIntegrationId: Id<"firmIntegrations"> | null) {
    if (!firmId || !userId) return;
    const meta = INTEGRATION_CATALOG.find((m) => m.provider === provider);
    if (!meta) return;

    if (meta.comingSoon) {
      toast.info(`${meta.name} integration coming soon`);
      return;
    }

    if (provider === "xero") {
      if (currentlyConnected) {
        try {
          await disconnectXeroMut({ userId });
          toast.success("Xero disconnected");
        } catch { toast.error("Failed to disconnect Xero"); }
      } else {
        // Ensure the card exists in Apps Map, then start the OAuth flow
        if (!firmIntegrationId) {
          await addIntegrationMut({ firmId, provider: "xero" });
        }
        window.location.href = `/api/integrations/xero/authorize?firmId=${firmId}`;
      }
    }
  }

  async function handleRemove(provider: string, firmIntegrationId: Id<"firmIntegrations"> | null) {
    if (!firmId || !firmIntegrationId) return;
    const meta = INTEGRATION_CATALOG.find((m) => m.provider === provider);
    try {
      // If Xero and connected, disconnect first
      if (provider === "xero" && xeroConnected && userId) {
        await disconnectXeroMut({ userId });
      }
      await removeIntegrationMut({ firmId, firmIntegrationId });
      toast.success(`${meta?.name ?? "Integration"} removed`);
    } catch { toast.error("Failed to remove integration"); }
  }

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[140px] text-[12px] font-medium justify-between">
                  {statusLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All statuses</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("connected")}>Connected</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("not-connected")}>Not connected</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 min-w-[140px] text-[12px] font-medium justify-between">
                  {typeLabel}
                  <ChevronDown size={10} className="text-slate-500 shrink-0" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                <DropdownMenuItem onClick={() => setTypeFilter("all")}>All types</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("accounting")}>Accounting</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("payments")}>Payments</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("crm")}>CRM</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleSync}
              disabled={syncPending || loading}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {syncPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Sync
            </button>
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#C8A96E" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add App
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: "Connected",     value: stats?.connected ?? 0,                     sub: "Active integrations",  Icon: CheckCircle, iconBg: "rgba(16,185,129,0.1)",  iconColor: "text-emerald-600" },
              { label: "Available",     value: stats?.available ?? 0,                     sub: "Integration types",    Icon: Plug,        iconBg: "rgba(59,130,246,0.1)",   iconColor: "text-blue-600" },
              { label: "Pending Setup", value: stats?.pendingSetup ?? 0,                  sub: "Not yet connected",    Icon: AlertCircle, iconBg: "rgba(245,158,11,0.1)",   iconColor: "text-amber-500" },
              { label: "Automations",   value: stats?.automations ?? 0,                   sub: "Active workflows",     Icon: Zap,         iconBg: "rgba(139,92,246,0.1)",   iconColor: "text-violet-600" },
              { label: "Syncs Today",   value: stats?.syncsToday ?? 0,                    sub: "Runs in last 24h",     Icon: RefreshCw,   iconBg: "rgba(14,165,233,0.1)",   iconColor: "text-sky-600" },
              { label: "Last Sync",     value: formatLastSync(stats?.lastSyncAt ?? null), sub: "Most recent run",      Icon: Clock,       iconBg: "rgba(100,116,139,0.1)",  iconColor: "text-slate-500" },
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
        )}

        {/* Integration cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-xl flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(200,169,110,0.08)" }}>
              <Plug className="h-6 w-6" style={{ color: "#C8A96E" }} />
            </div>
            <p className="text-[15px] font-semibold text-slate-800 mb-1">
              {(addedIntegrations ?? []).length === 0 ? "No integrations added yet" : "No integrations match your filters"}
            </p>
            <p className="text-[13px] text-slate-400 max-w-sm text-center">
              {(addedIntegrations ?? []).length === 0 ? "Click \u201cAdd App\u201d to connect your first integration." : "Try adjusting the status or type filter above."}
            </p>
            {(addedIntegrations ?? []).length === 0 && (
              <button onClick={() => setSheetOpen(true)} className="mt-4 flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "#C8A96E" }}>
                <Plus className="h-3.5 w-3.5" />Add App
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredList.map((row) => (
              <div
                key={row.provider}
                className={cn(
                  "relative bg-white p-4 border rounded-xl transition-all duration-150",
                  row.connected ? "border-emerald-200" : "border-slate-100"
                )}
              >
                {/* Remove button */}
                <button
                  onClick={() => handleRemove(row.provider, row.firmIntegrationId)}
                  className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded text-red-500 hover:bg-red-50 transition-colors"
                  aria-label="Remove integration"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Logo + name */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden bg-slate-100">
                    {row.provider === "xero" ? (
                      <img src="/xero-logo.png" alt="Xero" className="w-6 h-6 object-contain" />
                    ) : (
                      <span className="text-[10px] font-bold text-white w-full h-full flex items-center justify-center" style={{ backgroundColor: row.color }}>{row.initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <p className="text-[11px] font-medium text-slate-900 truncate">{row.name}</p>
                    {row.connected && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                    {row.comingSoon && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                        Soon
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-[10px] text-slate-500 truncate leading-tight mb-1">{row.description}</p>
                {row.connected && row.provider === "xero" && xeroConn?.tenantName && (
                  <p className="text-[10px] text-emerald-600 font-medium truncate mb-2">
                    {xeroConn.tenantName}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-2">
                  <span className={cn("text-[10px] font-medium", row.connected ? "text-emerald-600" : "text-slate-500")}>
                    {row.connected ? "Connected" : row.comingSoon ? "Coming soon" : "Not connected"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {row.connected && row.provider === "xero" && (
                      <button
                        onClick={() => setXeroSheetOpen(true)}
                        className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Xero settings"
                      >
                        <Settings2 className="h-3 w-3" />
                      </button>
                    )}
                    {row.provider === "xero" ? (
                      row.connected ? (
                        <button
                          onClick={() => handleToggle(row.provider, true, row.firmIntegrationId)}
                          className="cursor-pointer block rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:brightness-95 active:scale-[0.97] transition-all p-0 leading-none"
                          aria-label="Disconnect from Xero"
                        >
                          <img
                            src="/Disconnect%20from%20Xero.png"
                            alt="Disconnect from Xero"
                            className="block h-7 w-auto"
                          />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggle(row.provider, false, row.firmIntegrationId)}
                          className="cursor-pointer block rounded-lg border border-[#13B5EA] overflow-hidden shadow-sm hover:brightness-95 active:scale-[0.97] transition-all p-0 leading-none"
                          aria-label="Connect to Xero"
                        >
                          <img
                            src="/Connect%20to%20Xero.png"
                            alt="Connect to Xero"
                            className="block h-7 w-auto"
                          />
                        </button>
                      )
                    ) : (
                      <Switch
                        checked={row.connected}
                        onCheckedChange={(checked) => handleToggle(row.provider, !checked, row.firmIntegrationId)}
                        className="data-[state=checked]:bg-emerald-500"
                        disabled={row.comingSoon}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AddIntegrationSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          firmId={firmId}
          onSuccess={() => toast.success("Integration added to your Apps Map")}
        />
      </div>

      {/* ── Xero Settings Sheet ──────────────────────────────────────────── */}
      <Sheet open={xeroSheetOpen} onOpenChange={setXeroSheetOpen}>
        <SheetContent
          side="right"
          hideClose
          className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl flex flex-col bg-white"
        >
          <SheetTitle className="sr-only">Manage Xero</SheetTitle>

          {/* Header */}
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                  <img src="/xero-logo.png" alt="Xero" className="w-9 h-9 object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">Xero</h2>
                    {xeroConn ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="h-2.5 w-2.5" />Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        Not connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {xeroConn
                      ? "Manage your Xero integration settings or disconnect."
                      : "Connect Xero to sync clients, invoices and contacts automatically."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setXeroSheetOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {xeroConn ? (
              <>
                {/* Organisation details */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5">
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Organisation</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-200">
                    <div className="px-4 py-3">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Name</span>
                      <span className="text-[13px] font-medium text-slate-800 truncate block">
                        {xeroConn.tenantName ?? "—"}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Tenant ID</span>
                      <span className="text-[11px] font-mono text-slate-500 truncate block">
                        {xeroConn.tenantId ? `${xeroConn.tenantId.slice(0, 8)}…` : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-200">
                    <div className="px-4 py-3">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Connected since</span>
                      <span className="text-[13px] font-medium text-slate-800">
                        {new Date(xeroConn.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Token expires</span>
                      <span className={cn("text-[13px] font-medium", xeroConn.expiresAt < Date.now() ? "text-red-600" : "text-slate-800")}>
                        {xeroConn.expiresAt < Date.now()
                          ? "Expired — reconnect"
                          : new Date(xeroConn.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Token expiry warning */}
                {xeroConn.expiresAt < Date.now() && (
                  <div className="flex items-start gap-3 rounded-xl px-4 py-3 border bg-amber-50 border-amber-200 text-[12px]">
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-px" />
                    <div className="min-w-0">
                      <p className="font-semibold text-amber-700 leading-tight">Reconnect required</p>
                      <p className="text-slate-500 leading-snug mt-1">
                        Your Xero access token has expired. Disconnect and reconnect to resume syncing.
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl text-[13px] font-medium border-slate-200 hover:bg-slate-50"
                    disabled={xeroSyncPending}
                    onClick={async () => {
                      setXeroSyncPending(true);
                      try {
                        const result = await runSyncMut({});
                        if (result.success) {
                          toast.success(result.syncedCount > 0
                            ? "Sync started — data will update shortly"
                            : "Nothing to sync right now");
                          setXeroSheetOpen(false);
                        } else {
                          toast.error("Sync failed");
                        }
                      } catch { toast.error("Sync failed"); }
                      finally { setXeroSyncPending(false); }
                    }}
                  >
                    {xeroSyncPending
                      ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      : <RefreshCw className="h-4 w-4 mr-1.5" />}
                    Sync Now
                  </Button>
                  <a href="https://go.xero.com" target="_blank" rel="noopener noreferrer" className="contents">
                    <Button
                      variant="outline"
                      className="w-full h-11 rounded-xl text-[13px] font-medium border-slate-200 hover:bg-slate-50"
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" />Open in Xero
                    </Button>
                  </a>
                </div>
              </>
            ) : (
              /* Not connected state */
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                  <img src="/xero-logo.png" alt="Xero" className="w-9 h-9 object-contain" />
                </div>
                <div className="space-y-1">
                  <p className="text-[14px] font-semibold text-slate-800">Connect to Xero</p>
                  <p className="text-[12px] text-slate-500 max-w-[280px]">
                    Sync contacts, invoices and accounts between NorthPact and Xero automatically.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-xs text-left">
                  {["Contacts synced both ways", "Invoices pushed to Xero", "Accounts & tax rates imported"].map((feat) => (
                    <div key={feat} className="flex items-center gap-2 text-[12px] text-slate-600">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <SheetFooter className="flex-shrink-0 border-t border-slate-200 pt-4 px-5 pb-5 bg-slate-50 flex-row items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setXeroSheetOpen(false)}
              className="flex-1 h-11 rounded-xl text-[13px] font-medium border-slate-200 text-slate-600"
            >
              Close
            </Button>
            {xeroConn ? (
              <button
                onClick={async () => {
                  if (!userId) return;
                  try {
                    await disconnectXeroMut({ userId });
                    toast.success("Xero disconnected");
                  } catch { toast.error("Failed to disconnect Xero"); }
                  setXeroSheetOpen(false);
                }}
                className="flex-1 cursor-pointer flex items-center justify-center h-11 rounded-xl border border-slate-200 bg-white hover:brightness-95 active:scale-[0.98] transition-all shadow-sm overflow-hidden"
                aria-label="Disconnect from Xero"
              >
                <img src="/Disconnect%20from%20Xero.png" alt="Disconnect from Xero" className="h-full w-full object-cover" />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (firmId) window.location.href = `/api/integrations/xero/authorize?firmId=${firmId}`;
                  setXeroSheetOpen(false);
                }}
                className="flex-1 cursor-pointer flex items-center justify-center h-11 rounded-xl border border-[#13B5EA] bg-white hover:brightness-95 active:scale-[0.98] transition-all shadow-sm overflow-hidden"
                aria-label="Connect to Xero"
              >
                <img src="/Connect%20to%20Xero.png" alt="Connect to Xero" className="h-full w-full object-cover" />
              </button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function AppsMapPage() {
  return (
    <Suspense>
      <AppsMapContent />
    </Suspense>
  );
}
