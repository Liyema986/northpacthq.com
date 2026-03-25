"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";

export default function AuthRedirectPage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser);
  const redirectHandled = useRef(false);

  // Redirect once we know the user's role
  useEffect(() => {
    if (!isAuthenticated) return;
    if (user === undefined) return; // still loading
    if (redirectHandled.current) return;
    redirectHandled.current = true;
    router.replace("/dashboard");
  }, [isAuthenticated, user, router]);

  // Safety net — never hang forever
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/dashboard");
    }, 12000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-[3px] border-slate-100" />
          <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-north-gold" strokeWidth={2.5} aria-hidden />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Setting up your workspace</h1>
          <p className="text-[15px] text-slate-500 mt-1">This will only take a moment</p>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="h-1.5 w-1.5 rounded-full bg-north-gold animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-north-gold/70 animate-pulse [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-north-gold/40 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
