"use client";

import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TrendingUp, X, Loader2, AlertCircle, Eye } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type AdjustmentType = "increase" | "decrease";
type AdjustmentMethod = "percentage" | "cost";

type LineItemPreview = {
  _id: Id<"services">;
  name: string;
  pricingType: string;
  hourlyRate?: number;
  fixedPrice?: number;
};

interface GlobalPriceAdjustmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  /** Line items included in this adjustment (for preview / counts) */
  lineItems: LineItemPreview[];
  /** When set, applies sectionPriceAdjustment; otherwise globalPriceAdjustment */
  sectionMode?: { sectionId: Id<"serviceSections">; sectionName: string } | null;
}

export function GlobalPriceAdjustmentSheet({
  open,
  onOpenChange,
  userId,
  lineItems,
  sectionMode = null,
}: GlobalPriceAdjustmentSheetProps) {
  const globalPriceAdjustment = useMutation(api.lineItems.globalPriceAdjustment);
  const sectionPriceAdjustment = useMutation(api.lineItems.sectionPriceAdjustment);

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("increase");
  const [adjustmentMethod, setAdjustmentMethod] = useState<AdjustmentMethod>("percentage");
  const [amount, setAmount] = useState("10");
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [valueError, setValueError] = useState("");

  function handleClose() { onOpenChange(false); setShowPreview(false); setValueError(""); }

  const numAmount = parseFloat(amount) || 0;

  const affected = useMemo(() => {
    return lineItems.filter((s) => {
      const p = s.fixedPrice ?? s.hourlyRate ?? 0;
      return p > 0;
    });
  }, [lineItems]);

  function priceOf(s: LineItemPreview) {
    return s.fixedPrice ?? s.hourlyRate ?? 0;
  }

  function calcNewPrice(current: number): number {
    if (adjustmentMethod === "percentage") {
      const delta = (current * numAmount) / 100;
      return adjustmentType === "increase"
        ? current + delta
        : Math.max(0, current - delta);
    }
    return adjustmentType === "increase"
      ? current + numAmount
      : Math.max(0, current - numAmount);
  }

  async function handleApply() {
    if (!amount.trim() || numAmount <= 0) { setValueError("Enter a positive amount"); return; }
    if (adjustmentMethod === "percentage" && numAmount > 100) {
      setValueError("Percentage cannot exceed 100%");
      return;
    }
    setSaving(true);
    try {
      const base = {
        userId,
        adjustmentType,
        adjustmentMethod,
        amount: numAmount,
      };
      const result = sectionMode
        ? await sectionPriceAdjustment({ ...base, sectionId: sectionMode.sectionId })
        : await globalPriceAdjustment(base);
      if (!result.success) {
        toast.error(result.error || "Adjustment failed");
        return;
      }
      const n = result.updatedCount ?? 0;
      toast.success(
        sectionMode
          ? `Updated ${n} price${n !== 1 ? "s" : ""} in ${sectionMode.sectionName}`
          : `Updated ${n} price${n !== 1 ? "s" : ""} across your catalog`
      );
      handleClose();
    } catch {
      toast.error("Failed to apply price adjustment");
    } finally {
      setSaving(false);
    }
  }

  const isPercent = adjustmentMethod === "percentage";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
        <SheetTitle className="sr-only">Price adjustment</SheetTitle>
        <div className="flex flex-col h-full">

          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: "#10b98114" }}>
                  <TrendingUp className="h-7 w-7 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">
                    {sectionMode ? "Section price adjustment" : "Global price adjustment"}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5 truncate">
                    {sectionMode ? sectionMode.sectionName : "All services with a fixed price or hourly rate"}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} disabled={saving} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            <div className="space-y-1.5">
              <Label className="text-[13px]">Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["increase", "decrease"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setAdjustmentType(opt); setValueError(""); }}
                    disabled={saving}
                    className={cn(
                      "h-9 rounded-lg border text-[12px] font-medium transition-colors capitalize",
                      adjustmentType === opt
                        ? "border-[#C8A96E] text-[#C8A96E] bg-[#C8A96E14]"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Method</Label>
              <Select value={adjustmentMethod} onValueChange={(v) => { setAdjustmentMethod(v as AdjustmentMethod); setValueError(""); }} disabled={saving}>
                <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="percentage" className="text-[13px]">Percentage (%)</SelectItem>
                  <SelectItem value="cost" className="text-[13px]">Fixed amount (R)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">{isPercent ? "Percentage (%)" : "Amount (R)"}</Label>
              <div className="relative">
                <input
                  type="number" min="0" step={isPercent ? "1" : "50"}
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); if (valueError) setValueError(""); }}
                  disabled={saving}
                  className={cn(
                    "w-full h-10 px-3 pr-10 rounded-lg border text-[13px] text-slate-800 focus:outline-none transition-colors bg-white",
                    valueError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 pointer-events-none">{isPercent ? "%" : "R"}</span>
              </div>
              {valueError && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{valueError}</p>}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div>
                <p className="text-[13px] font-medium text-slate-800">{affected.length} price{affected.length !== 1 ? "s" : ""} eligible</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Services with no rate are skipped server-side</p>
              </div>
              {affected.length > 0 && numAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#C8A96E] hover:text-[#b8955a] transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {showPreview ? "Hide" : "Preview"}
                </button>
              )}
            </div>

            {showPreview && affected.length > 0 && numAmount > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-[11px] font-medium text-slate-500">Service</span>
                  <span className="text-[11px] font-medium text-slate-500 text-right">Current</span>
                  <span className="text-[11px] font-medium text-slate-500 text-right">New</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {affected.slice(0, 20).map((s) => {
                    const cur = priceOf(s);
                    const np = Math.round(calcNewPrice(cur) * 100) / 100;
                    const changed = np !== cur;
                    return (
                      <div key={s._id} className="grid grid-cols-3 px-3 py-2">
                        <span className="text-[12px] text-slate-700 truncate pr-2">{s.name}</span>
                        <span className="text-[12px] text-slate-500 text-right">{formatCurrency(cur)}</span>
                        <span className={cn("text-[12px] text-right font-medium", changed ? "text-emerald-600" : "text-slate-500")}>
                          {formatCurrency(np)}
                        </span>
                      </div>
                    );
                  })}
                  {affected.length > 20 && (
                    <p className="px-3 py-2 text-[11px] text-slate-400 text-center">+{affected.length - 20} more</p>
                  )}
                </div>
              </div>
            )}

          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button
              onClick={handleApply}
              disabled={saving || affected.length === 0 || !amount.trim()}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Applying…</> : "Apply adjustment"}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
