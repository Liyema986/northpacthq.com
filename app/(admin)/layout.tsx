"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { SidebarProvider } from "@/lib/sidebar-context";
import { useSidebar } from "@/lib/sidebar-context";
import { getInitials, cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, Shield, Users, BarChart3, LogOut, Activity, PanelLeftClose, MessageCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_PANEL_PATH } from "@/lib/routes";
import { RoleBasedRedirect } from "@/components/auth/RoleBasedRedirect";

/** Only the "admin" role gets the firm admin panel. Owners use /dashboard. */
const FIRM_ADMIN_ROLES = new Set(["admin"]);

const NAV = [
  { label: "Overview",    tab: "overview",    href: `${ADMIN_PANEL_PATH}?tab=overview`,    icon: BarChart3 },
  { label: "Users",       tab: "users",       href: `${ADMIN_PANEL_PATH}?tab=users`,       icon: Users },
  { label: "Permissions", tab: "permissions", href: `${ADMIN_PANEL_PATH}?tab=permissions`, icon: Shield },
  { label: "Audit Log",   tab: "audit",       href: `${ADMIN_PANEL_PATH}?tab=audit`,       icon: Activity },
  { label: "Support",     tab: "support",     href: `/super/support`,                      icon: MessageCircle },
];

// ── Loading skeleton ───────────────────────────────────────────────────────────
function AdminContentSkeleton() {
  return (
    <div className="px-4 md:px-6 pt-3 md:pt-4 pb-4 md:pb-6">
      <div className="space-y-4">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[100px] rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    </div>
  );
}

// ── Nav links ─────────────────────────────────────────────────────────────────
function AdminNavLinks({
  collapsed,
  supportUnreadCount,
}: {
  collapsed: boolean;
  supportUnreadCount: number;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeTab = searchParams.get("tab") ?? "overview";

  return (
    <>
      {NAV.map(({ label, href, tab, icon: Icon }) => {
        const isActive = tab === "support"
          ? pathname === "/super/support"
          : activeTab === tab;

        const content = (
          <Link
            href={href}
            className={cn(
              "w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] transition-colors relative",
              collapsed && "justify-center",
              isActive
                ? "bg-[#C8A96E]/[0.08] text-[#C8A96E] font-semibold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            <Icon className="h-[15px] w-[15px] shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
            {tab === "support" && supportUnreadCount > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold",
                  collapsed && "absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] text-[9px]"
                )}
              >
                {supportUnreadCount > 99 ? "99+" : supportUnreadCount}
              </span>
            )}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={label}>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        }
        return <div key={label}>{content}</div>;
      })}
    </>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function AdminSidebar() {
  const { collapsed, toggle } = useSidebar();
  const { user, signOut } = useNorthPactAuth();
  const supportUnreadCount = useQuery(api.supportChat.adminUnreadCount) ?? 0;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-white border-r border-slate-100 transition-all duration-300 shrink-0 overflow-hidden",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex h-14 items-center border-b border-slate-100 shrink-0 px-4",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {collapsed ? (
            <button
              onClick={toggle}
              className="flex items-center justify-center hover:opacity-80 transition-opacity"
              aria-label="Expand sidebar"
            >
              <Image src="/logo3.png" alt="NorthPact" width={32} height={32} className="h-8 w-auto object-contain" priority />
            </button>
          ) : (
            <>
              <div className="flex min-w-0 items-center">
                <Image src="/logo3.png" alt="NorthPact" width={110} height={36} className="h-7 w-auto object-contain object-left" priority />
              </div>
              <button
                onClick={toggle}
                className="p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <Suspense fallback={null}>
            <AdminNavLinks collapsed={collapsed} supportUnreadCount={supportUnreadCount} />
          </Suspense>
        </nav>

        {/* User */}
        <div className="px-2 py-3 border-t border-slate-100 shrink-0">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-[#243E63] shrink-0 cursor-default select-none"
                    style={{ background: "#C8A96E" }}
                  >
                    {getInitials(user?.name ?? "U")}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{user?.name}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-[#243E63] shrink-0 select-none"
                style={{ background: "#C8A96E" }}
              >
                {getInitials(user?.name ?? "U")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-900 truncate leading-tight">{user?.name}</p>
                <p className="text-[11px] text-slate-400 capitalize truncate leading-tight">{user?.role?.replace("-", " ")}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={signOut}
                    className="p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSupportRoute = pathname === "/super/support";

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main
          className={cn(
            "min-h-0 flex-1 bg-slate-50/40",
            isSupportRoute ? "relative flex flex-col overflow-hidden" : "overflow-y-auto"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useNorthPactAuth();
  const router = useRouter();

  // Subscribe to Convex role — this is the reactive source of truth.
  const me = useQuery(api.users.getCurrentUser);
  const meLoaded = me !== undefined;
  const canAccessFirmAdmin = meLoaded && me !== null && FIRM_ADMIN_ROLES.has(me.role);

  // Kick out unauthenticated users (Clerk layer).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth");
  }, [isAuthenticated, isLoading, router]);

  // Kick out users whose Convex role is not owner/admin (reactive — fires on role changes).
  // window.location.replace guarantees leaving the admin route group.
  useEffect(() => {
    if (meLoaded && !canAccessFirmAdmin) {
      window.location.replace("/dashboard");
    }
  }, [meLoaded, canAccessFirmAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider>
      <RoleBasedRedirect />
      <AdminShell>
        {/* Gate children: show skeleton while Convex loads or while redirecting away */}
        {!meLoaded || !canAccessFirmAdmin ? <AdminContentSkeleton /> : children}
      </AdminShell>
    </SidebarProvider>
  );
}
