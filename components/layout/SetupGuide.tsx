"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, ChevronUp, ChevronDown, X, BookOpen } from "lucide-react";
import Link from "next/link";

const DISMISSED_KEY = "northpact_setup_guide_dismissed";

interface Step {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

export function SetupGuide() {
  const { user } = useNorthPactAuth();
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(DISMISSED_KEY) === "1") setDismissed(true);
    } catch {}
  }, []);

  const userId = user?.id as Id<"users"> | undefined;
  const firmSettings = useQuery(api.firms.getFirmSettings, userId ? { userId } : "skip");
  const clientCounts = useQuery(api.clients.getClientCounts, userId ? { userId } : "skip");
  const proposals = useQuery(api.proposals.listProposals, userId ? { userId } : "skip");

  if (!mounted || dismissed) return null;

  const steps: Step[] = [
    {
      id: "logo",
      label: "Upload your firm logo",
      href: "/settings?tab=org",
      done: Boolean(firmSettings?.firmLogoUrl),
    },
    {
      id: "client",
      label: "Add your first client",
      href: "/clients",
      done: (clientCounts?.total ?? 0) > 0,
    },
    {
      id: "proposal",
      label: "Create your first proposal",
      href: "/proposals/new",
      done: (proposals?.length ?? 0) > 0,
    },
    {
      id: "billing",
      label: "Set up billing",
      href: "/settings?tab=billing",
      done: firmSettings?.subscriptionPlan !== "starter",
    },
    {
      id: "team",
      label: "Invite a team member",
      href: "/settings?tab=people",
      done: false, // optimistic — we don't fetch team count here
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const progress = Math.round((doneCount / steps.length) * 100);

  function dismiss() {
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch {}
    setDismissed(true);
  }

  return (
    <div
      className="fixed bottom-6 left-[228px] z-40 w-[280px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
      style={{ maxHeight: open ? 420 : 56 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-14 cursor-pointer select-none border-b border-slate-100"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#C8A96E] shrink-0" />
          <span className="text-[13px] font-semibold text-slate-800">Setup guide</span>
          <span className="text-[11px] font-medium text-slate-400 ml-1">{doneCount}/{steps.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
          }
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className="ml-1 p-0.5 rounded hover:bg-slate-100 transition-colors"
            aria-label="Dismiss setup guide"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-1 overflow-y-auto max-h-[350px]">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="h-1 w-full rounded-full bg-slate-100">
              <div
                className="h-1 rounded-full bg-[#C8A96E] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {allDone && (
              <p className="text-[11px] text-emerald-600 font-medium mt-1.5 text-center">
                All done — you&apos;re all set! 🎉
              </p>
            )}
          </div>

          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.done ? "#" : step.href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-[12.5px]",
                step.done
                  ? "opacity-50 cursor-default pointer-events-none"
                  : "hover:bg-slate-50 cursor-pointer"
              )}
            >
              {step.done
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                : <Circle className="h-4 w-4 text-slate-300 shrink-0" />
              }
              <span className={cn("leading-snug", step.done ? "line-through text-slate-400" : "text-slate-700")}>
                {step.label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
