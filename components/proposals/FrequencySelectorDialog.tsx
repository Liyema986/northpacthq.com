"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Frequency } from "@/types";
import { RECURRENCE_MULTIPLIER } from "@/types";

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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold text-slate-900">
            Select recurrence frequency
          </DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500">
            How often is <span className="font-medium text-slate-700">{serviceName}</span> delivered per year?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          {RECURRING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-100 hover:border-[#C8A96E]/40 hover:bg-[#C8A96E]/5 transition-colors text-left group"
            >
              <div>
                <p className="text-[13px] font-medium text-slate-800 group-hover:text-slate-900">
                  {opt.label}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {opt.description}
                </p>
              </div>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: `${ACCENT}18`, color: ACCENT }}
              >
                ×{opt.multiplier}
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onCancel} className="text-[12px]">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
