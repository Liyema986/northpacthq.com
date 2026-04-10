"use client";

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { X, RefreshCw } from "lucide-react";
import type { Frequency } from "@/types";

const ACCENT = "#C8A96E";

interface RecurringOption {
  value: Frequency;
  label: string;
  multiplier: number;
  description: string;
}

const RECURRING_OPTIONS: RecurringOption[] = [
  { value: "monthly",         label: "Monthly",         multiplier: 12, description: "Every calendar month" },
  { value: "bi_monthly",      label: "Bi-monthly",      multiplier: 6,  description: "Every 2 months" },
  { value: "quarterly",       label: "Quarterly",       multiplier: 4,  description: "Every 3 months" },
  { value: "every_4_months",  label: "Every 4 months",  multiplier: 3,  description: "3 times per year" },
  { value: "semi_annually",   label: "Bi-annually",     multiplier: 2,  description: "Every 6 months" },
];

interface FrequencySelectorDialogProps {
  open: boolean;
  serviceName: string;
  onSelect: (frequency: Frequency) => void;
  onCancel: () => void;
}

export function FrequencySelectorDialog({
  open,
  serviceName,
  onSelect,
  onCancel,
}: FrequencySelectorDialogProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <SheetContent
        side="right"
        hideClose
        className="w-full sm:max-w-none sm:w-[420px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">Select recurrence frequency</SheetTitle>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0"
                  style={{ background: `${ACCENT}14` }}
                >
                  <RefreshCw className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">
                    Recurrence Frequency
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[220px]">
                    {serviceName}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <p className="text-[12px] text-slate-500 mb-4">
                How often is <span className="font-medium text-slate-700">{serviceName}</span> delivered per year? This drives work planning and pricing.
              </p>
            </div>

            <div className="space-y-2">
              {RECURRING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSelect(opt.value)}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-slate-100 hover:border-[#C8A96E]/50 hover:bg-[#C8A96E]/5 transition-all text-left group"
                >
                  <div>
                    <p className="text-[14px] font-semibold text-slate-800 group-hover:text-slate-900">
                      {opt.label}
                    </p>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                  <span
                    className="text-[12px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                    style={{ background: `${ACCENT}18`, color: ACCENT }}
                  >
                    ×{opt.multiplier}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-slate-200 px-5 py-4">
            <button
              onClick={onCancel}
              className="w-full h-10 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
