"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function SSOCallbackPage() {
  const { handleRedirectCallback } = useClerk();

  useEffect(() => {
    async function run() {
      try {
        await handleRedirectCallback({
          signInUrl: "/auth",
          signUpUrl: "/auth",
          afterSignUpUrl: "/auth/redirect",
          afterSignInUrl: "/auth/redirect",
          continueSignUpUrl: "/auth/sso-callback",
        });
      } catch {
        window.location.href = "/auth";
      }
    }
    run();
  }, [handleRedirectCallback]);

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-[3px] border-slate-100" />
          <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-north-gold" strokeWidth={2.5} aria-hidden />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Signing you in</h1>
          <p className="text-[15px] text-slate-500 mt-1">Completing authentication securely</p>
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
