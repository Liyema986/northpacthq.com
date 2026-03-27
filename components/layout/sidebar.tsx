"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { useState, useEffect, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  LayoutDashboard, Users, FileText, Package, ClipboardList,
  Settings, PanelLeftClose, LogOut, ChevronDown,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useSidebar } from "@/lib/sidebar-context";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Nav group definitions ─────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  section?: boolean;  // renders as a non-clickable section header
  proOnly?: boolean;  // hidden on starter plan — shown on pro/business
  starterOnly?: boolean; // hidden on pro/business — shown on starter
}

interface NavGroup {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { label: "Summary", href: "/dashboard" },
    ],
  },
  {
    id: "proposals",
    label: "Proposals",
    icon: FileText,
    items: [
      { label: "All Proposals", href: "/proposals" },
      { label: "New Proposal",  href: "/proposals/new" },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    items: [
      { label: "All Clients", href: "/clients" },
      { label: "Contacts",    href: "/contacts" },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    icon: Package,
    items: [
      { label: "Services",      href: "/services" },
      { label: "Pricing Tool",  href: "/services/pricing-tool" },
    ],
  },
  {
    id: "workflow",
    label: "Workflow",
    icon: ClipboardList,
    items: [
      { label: "Packages",           href: "/packages" },
      { label: "Engagement Letters", href: "/engagement-letters" },
      { label: "Work Planning",      href: "/work-planning" },
      { label: "Cash Flow",          href: "/cash-flow" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      { label: "Workspace",     href: "",                            section: true, proOnly: true },
      { label: "Org profile", href: "/settings?tab=org",                            proOnly: true },
      { label: "People",        href: "/settings?tab=people",                       proOnly: true },
      { label: "Billing",       href: "/settings?tab=billing",                      proOnly: true },
      { label: "Apps Map",      href: "/appsmap",                                   proOnly: true },
      { label: "Account",       href: "",                            section: true, proOnly: true },
      { label: "Profile",       href: "/settings?tab=account" },
      { label: "Billing",       href: "/settings?tab=billing",      starterOnly: true },
      { label: "Apps Map",      href: "/appsmap",                   starterOnly: true },
    ],
  },
];

// ── Sub-nav with tree connector lines ─────────────────────────────────────────

function GroupSubNav({ items, open, isPro }: { items: NavItem[]; open: boolean; isPro: boolean }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  if (!open) return null;

  const visibleItems   = items.filter((i) => (!i.proOnly || isPro) && (!i.starterOnly || !isPro));
  const clickableItems = visibleItems.filter((i) => !i.section);

  return (
    <div className="ml-[34px] mt-0.5 relative">
      {/* Vertical connector line */}
      <div className="absolute left-0 top-0 bottom-2 w-px bg-slate-200" />

      <div className="space-y-0.5">
        {visibleItems.map((item, idx) => {
          if (item.section) {
            return (
              <div key={`s-${idx}`} className={cn("relative", idx > 0 && "mt-3")}>
                {/* Branch dot on connector */}
                <div className="absolute left-0 top-1/2 w-2 h-px bg-slate-200" />
                <span className="ml-3 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 py-0.5 select-none">
                  {item.label}
                </span>
              </div>
            );
          }

          const [basePath, queryStr] = item.href.split("?");
          let active = false;
          if (queryStr) {
            const itemParams = new URLSearchParams(queryStr);
            active = pathname === basePath &&
              [...itemParams.entries()].every(([k, v]) => searchParams.get(k) === v);
          } else {
            if (item.href.endsWith("/new")) {
              active = pathname === item.href;
            } else {
              const siblingIsExact = clickableItems.some(
                (other) => other.href !== item.href && pathname === other.href.split("?")[0]
              );
              active = !siblingIsExact && (pathname === basePath || pathname.startsWith(basePath + "/"));
            }
          }

          return (
            <div key={item.href} className="relative flex items-center">
              {/* Horizontal branch */}
              <div className="absolute left-0 top-1/2 w-3 h-px bg-slate-200" />
              <Link
                href={item.href}
                className={cn(
                  "ml-4 block pr-2 py-1.5 text-[12px] rounded-md transition-colors truncate",
                  active
                    ? "text-[#C8A96E] font-semibold"
                    : "text-slate-400 hover:text-slate-700"
                )}
              >
                {item.label}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname              = usePathname();
  const router                = useRouter();
  const { user, signOut }     = useNorthPactAuth();
  const { collapsed, toggle } = useSidebar();

  const userId = user?.id as Id<"users"> | undefined;
  const firmSettings = useQuery(api.firms.getFirmSettings, userId ? { userId } : "skip");
  const convexCurrentUser = useQuery(api.users.getCurrentUser);
  const userAvatar = convexCurrentUser?.avatar ?? undefined;
  const firmLogoUrl = firmSettings?.firmLogoUrl ?? null;
  const firmNameForLogo = firmSettings?.name ?? "Firm";
  const isPro = firmSettings?.subscriptionPlan === "professional" || firmSettings?.subscriptionPlan === "enterprise";
  const [firmLogoFailed, setFirmLogoFailed] = useState(false);

  useEffect(() => {
    setFirmLogoFailed(false);
  }, [firmLogoUrl]);

  const showFirmLogo = Boolean(firmLogoUrl) && !firmLogoFailed;
  const firmInitials = getInitials(firmNameForLogo || "—");

  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Auto-expand the group that contains the current path
  useEffect(() => {
    for (const group of NAV_GROUPS) {
      const isInGroup = group.items.some((item) => {
        const [basePath] = item.href.split("?");
        return pathname === basePath || pathname.startsWith(basePath + "/");
      });
      if (isInGroup) {
        setExpandedGroup(group.id);
        return;
      }
    }
  }, [pathname]);

  const handleGroupClick = (group: NavGroup) => {
    if (expandedGroup === group.id) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(group.id);
      const firstClickable = group.items.find((i) => !i.section && i.href);
      if (firstClickable) router.push(firstClickable.href);
    }
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => {
      if (!item.href) return false;
      const [basePath] = item.href.split("?");
      return pathname === basePath || pathname.startsWith(basePath + "/");
    });

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-white border-r border-slate-100 transition-all duration-300 shrink-0 overflow-hidden",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        {/* ── Logo ─────────────────────────────────────────────────────── */}
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
              {showFirmLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={firmLogoUrl!}
                  alt={`${firmNameForLogo} logo`}
                  className="h-8 w-auto object-contain"
                  onError={() => setFirmLogoFailed(true)}
                />
              ) : userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userAvatar}
                  alt={user?.name ?? "Avatar"}
                  className="h-8 w-8 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C8A96E]/30 bg-[#C8A96E]/15 text-[10px] font-bold text-[#243E63] select-none"
                  aria-hidden
                >
                  {firmInitials}
                </div>
              )}
            </button>
          ) : (
            <>
              <div className="flex items-center min-w-0">
                {showFirmLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firmLogoUrl!}
                    alt={`${firmNameForLogo} logo`}
                    className="h-8 w-auto max-w-[148px] object-contain object-left"
                    onError={() => setFirmLogoFailed(true)}
                  />
                ) : userAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userAvatar}
                    alt={user?.name ?? "Avatar"}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#C8A96E]/30 bg-[#C8A96E]/15 text-[10px] font-bold text-[#243E63] select-none"
                    aria-hidden
                  >
                    {firmInitials}
                  </div>
                )}
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

        {/* ── Nav ──────────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_GROUPS.map((group) => {
            const Icon    = group.icon;
            const active  = isGroupActive(group);
            const expanded = expandedGroup === group.id;

            if (collapsed) {
              return (
                <Tooltip key={group.id}>
                  <TooltipTrigger asChild>
                    <Link
                      href={group.items.find((i) => !i.section && i.href)?.href ?? group.items[0].href}
                      className={cn(
                        "flex items-center justify-center h-9 w-full rounded-lg transition-colors",
                        active
                          ? "bg-[#C8A96E]/8 text-[#C8A96E]"
                          : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <Icon className="h-[17px] w-[17px] shrink-0" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{group.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <div key={group.id}>
                <button
                  onClick={() => handleGroupClick(group)}
                  className={cn(
                    "w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] transition-colors",
                    active
                      ? "bg-[#C8A96E]/8 text-[#C8A96E] font-semibold"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <Icon className="h-[15px] w-[15px] shrink-0" />
                  <span className="flex-1 text-left truncate">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 shrink-0 text-slate-300 transition-transform duration-200",
                      expanded && "rotate-180"
                    )}
                  />
                </button>

                <Suspense fallback={null}>
                  <GroupSubNav items={group.items} open={expanded} isPro={isPro} />
                </Suspense>
              </div>
            );
          })}
        </nav>

        {/* ── User ─────────────────────────────────────────────────────── */}
        <div className="px-2 py-3 border-t border-slate-100 shrink-0">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <div
                    className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold text-[#243E63] shrink-0 cursor-default select-none"
                    style={userAvatar ? undefined : { background: "#C8A96E" }}
                  >
                    {userAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userAvatar} alt={user?.name ?? "Avatar"} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(user?.name ?? "U")
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{user?.name}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <div
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-[#243E63] shrink-0 select-none"
                style={userAvatar ? undefined : { background: "#C8A96E" }}
              >
                {userAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatar} alt={user?.name ?? "Avatar"} className="w-full h-full object-cover" />
                ) : (
                  getInitials(user?.name ?? "U")
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-900 truncate leading-tight">
                  {user?.name}
                </p>
                <p className="text-[11px] text-slate-400 capitalize truncate leading-tight">
                  {user?.role?.replace("-", " ")}
                </p>
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
