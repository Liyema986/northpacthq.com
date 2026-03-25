"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BUNDLED_STARTER_TEMPLATE_NAMES } from "@/lib/engagement-letter-starter-names";

export function ScopeLibraryStarterTooltip({ className }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 rounded-full p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]/40",
              className
            )}
            aria-label="About starter templates"
          >
            <HelpCircle className="h-4 w-4" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-sm border border-slate-700 !bg-slate-900 px-3 py-2.5 text-left !text-slate-50 shadow-lg"
        >
          <p className="text-[11px] leading-relaxed text-slate-200">
            When your library is empty, we add these starter templates automatically. Duplicate or customise anytime.
          </p>
          <ul className="mt-2 space-y-1 border-t border-slate-700 pt-2 text-[11px] text-slate-300">
            {BUNDLED_STARTER_TEMPLATE_NAMES.map((name) => (
              <li key={name} className="break-words pl-0">
                {name}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
