"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { SidebarProvider } from "@/lib/sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";
import { RoleBasedRedirect } from "@/components/auth/RoleBasedRedirect";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth");
    }
  }, [isAuthenticated, isLoading, router]);

  // Do not block the whole app with a full-page spinner while Convex auth resolves
  // (refresh was showing a white screen until loading finished).
  if (!isLoading && !isAuthenticated) return null;

  return (
    <SidebarProvider>
      <RoleBasedRedirect />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </main>
        </div>
      </div>
      <SupportChatWidget />
    </SidebarProvider>
  );
}
