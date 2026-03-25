"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getPageHeader } from "@/lib/page-headers";

function PageHeaderInner() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab");
  const { title, description } = getPageHeader(pathname, tab);

  const isDashboard = pathname === "/dashboard";
  const displayTitle = isDashboard ? "Overview" : title;
  const displayDesc  = isDashboard ? "Track proposals, clients, and firm performance." : description;

  return (
    <>
      <h1 className="text-sm font-semibold text-foreground tracking-tight truncate leading-tight">
        {displayTitle}
      </h1>
      {displayDesc && (
        <p className="hidden sm:block text-xs text-muted-foreground truncate leading-tight mt-0.5">
          {displayDesc}
        </p>
      )}
    </>
  );
}

// Suspense wrapper required because PageHeaderInner uses useSearchParams
export function PageHeaderContent() {
  return (
    <Suspense
      fallback={
        <div className="h-4 w-32 bg-muted/50 animate-pulse rounded" />
      }
    >
      <PageHeaderInner />
    </Suspense>
  );
}
