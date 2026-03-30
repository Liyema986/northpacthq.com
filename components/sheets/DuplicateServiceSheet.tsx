"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Copy, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatCurrency } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

export type LineItemForDuplicate = {
  _id: Id<"services">;
  name: string;
  description?: string;
  category: string;
  pricingType: "fixed" | "hourly" | "tiered" | "recurring" | "variation" | "income_range";
  hourlyRate?: number;
  fixedPrice?: number;
  pricingTiers?: { name: string; price: number; description: string; criteria?: string }[];
  isActive: boolean;
  sortOrder: number;
};

interface DuplicateServiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: LineItemForDuplicate | null;
  sectionId: Id<"serviceSections"> | null;
  sectionName: string;
  userId: Id<"users">;
}

export function DuplicateServiceSheet({ open, onOpenChange, service, sectionId, sectionName, userId }: DuplicateServiceSheetProps) {
  const duplicateLineItem = useMutation(api.lineItems.duplicateLineItem);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (service && open) {
      setName(`Copy of ${service.name}`);
      setNameError("");
    }
  }, [service, open]);

  function handleClose() { onOpenChange(false); setNameError(""); }

  async function handleSubmit() {
    if (!name.trim()) { setNameError("Service name is required"); return; }
    if (!service || !sectionId) {
      toast.error("Missing section for duplicate");
      return;
    }
    setSaving(true);
    try {
      const result = await duplicateLineItem({
        userId,
        sectionId,
        lineItemId: service._id,
        newName: name.trim(),
      });
      if (!result.success) {
        toast.error(result.error || "Failed to duplicate service");
        return;
      }
      toast.success(`"${name.trim()}" created`);
      handleClose();
    } catch {
      toast.error("Failed to duplicate service");
    } finally {
      setSaving(false);
    }
  }

  const price = service?.fixedPrice ?? service?.hourlyRate ?? service?.pricingTiers?.[0]?.price ?? 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[460px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
        <SheetTitle className="sr-only">Duplicate Service</SheetTitle>
        <div className="flex flex-col h-full">

          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <Copy className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">Duplicate Service</h2>
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[240px]">{sectionName}</p>
                </div>
              </div>
              <button onClick={handleClose} disabled={saving} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {service && (
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 space-y-1">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Duplicating from</p>
                <p className="text-[13px] font-semibold text-slate-800">{service.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[12px] text-slate-500">{formatCurrency(price)}</span>
                  <span className="text-[12px] text-slate-400">·</span>
                  <span className="text-[12px] text-slate-500">{service.pricingType}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="dup-svc-name" className="text-[13px]">New service name <span className="text-red-500">*</span></Label>
              <input
                id="dup-svc-name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
                disabled={saving}
                className={cn(
                  "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                  nameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                )}
              />
              {nameError && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{nameError}</p>}
              <p className="text-[11px] text-slate-400">Price, description, and schedule are copied into the new draft service.</p>
            </div>

          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={saving || !sectionId} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5" style={{ background: ACCENT }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Duplicating…</> : "Duplicate Service"}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
