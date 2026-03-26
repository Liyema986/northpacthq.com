"use client";

import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ADMIN_PANEL_PATH } from "@/lib/routes";

/** Only the "admin" role gets the firm admin panel. Owners use /dashboard. */
const ADMIN_PANEL_ROLES = new Set(["admin"]);

function isAdminPanelRole(role: string | undefined | null): boolean {
  return !!role && ADMIN_PANEL_ROLES.has(role);
}

function isPublicPath(pathname: string | null): boolean {
  return (
    !pathname ||
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/proposals/view") ||
    pathname.startsWith("/sign") ||
    pathname.startsWith("/portal")
  );
}

function isFirmAdminPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const n =
    pathname.endsWith("/") && pathname.length > 1
      ? pathname.slice(0, -1)
      : pathname;
  return n === ADMIN_PANEL_PATH || n.startsWith(`${ADMIN_PANEL_PATH}/`);
}

/**
 * Fully bidirectional, stateless role-based routing guard.
 *
 * Checks CURRENT role vs CURRENT path on every render — no prev/next comparison
 * for the redirect itself, so it fires correctly on:
 *   - Initial page load
 *   - Hard refresh
 *   - Live Convex role changes (promotion AND demotion)
 *
 * Direction 1 — Promotion:
 *   User is admin/owner AND not on admin panel → redirect to /super/administrator
 *
 * Direction 2 — Demotion:
 *   User is NOT admin/owner AND IS on admin panel → redirect to /dashboard
 *
 * The ref is used only to detect whether a role changed at runtime (for toast
 * messaging) — it does NOT gate the redirect.
 */
export function RoleBasedRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const me = useQuery(api.users.getCurrentUser);

  // undefined = not yet initialised (sentinel for "first render with resolved user").
  const prevRoleRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (me === undefined) return; // Convex still loading
    if (isPublicPath(pathname)) return;

    const role = me?.role ?? null;
    const prevRole = prevRoleRef.current;
    const nowAdmin = isAdminPanelRole(role);
    const onAdminPanel = isFirmAdminPath(pathname);
    const roleChangedAtRuntime = prevRole !== undefined && prevRole !== role;


    // ── Direction 1: Promotion ──────────────────────────────────────────────
    // Admin/owner who is NOT on the admin panel → send them there.
    if (nowAdmin && !onAdminPanel) {
      if (roleChangedAtRuntime) {
        toast.success("Redirecting you to Administrator…");
      }
      prevRoleRef.current = role;
      router.replace(ADMIN_PANEL_PATH);
      return;
    }

    // ── Direction 2: Demotion ───────────────────────────────────────────────
    // Non-admin who IS on the admin panel → send to dashboard.
    // Use window.location (hard navigation) to guarantee leaving the admin
    // route group — router.replace can be silently swallowed in some layouts.
    if (!nowAdmin && onAdminPanel) {
      if (roleChangedAtRuntime) {
        toast.success("Redirecting you to Dashboard…");
      }
      prevRoleRef.current = role;
      window.location.replace("/dashboard");
      return;
    }

    prevRoleRef.current = role;
  }, [me, pathname, router]);

  return null;
}
