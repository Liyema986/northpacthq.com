"use client";

import type { ReactNode } from "react";
import { useSidebar } from "@/lib/sidebar-context";
import { PageHeaderContent } from "./page-header-content";
import { HeaderSearch } from "./header-search";
import { NotificationBell } from "./notification-bell";
import { ProfileDropdown } from "./profile-dropdown";
import { PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header({ children, className }: { children?: ReactNode; className?: string }) {
  const { collapsed, toggle } = useSidebar();

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6",
        className
      )}
    >
      {/* Expand sidebar button — only shown when sidebar is collapsed */}
      {collapsed && (
        <button
          onClick={toggle}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* Left: page title */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {children ?? <PageHeaderContent />}
        </div>
      </div>

      {/* Right: search, notifications, profile — vertically centered when header is taller than one line */}
      <div className="flex shrink-0 items-center gap-1 self-center sm:gap-2">
        <div className="hidden md:block w-48 lg:w-64">
          <HeaderSearch />
        </div>
        <NotificationBell />
        <ProfileDropdown />
      </div>
    </header>
  );
}
