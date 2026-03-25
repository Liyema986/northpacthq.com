"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

const PRICING_TYPES = [
  { value: "fixed",     label: "Fixed price" },
  { value: "hourly",    label: "Hourly rate" },
  { value: "tiered",    label: "Tiered" },
  { value: "recurring", label: "Recurring" },
] as const;

interface AddServiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Target section; if null, pick from `sectionOptions` */
  sectionId: Id<"serviceSections"> | null;
  sectionName: string;
  userId: Id<"users">;
  /** When sectionId is null, user must choose a section */
  sectionOptions?: { _id: Id<"serviceSections">; name: string }[];
}

export function AddServiceSheet({
  open,
  onOpenChange,
  sectionId,
  sectionName,
  userId,
  sectionOptions,
}: AddServiceSheetProps) {
  const createLineItem = useMutation(api.lineItems.createLineItem);

  const [pickedSectionId, setPickedSectionId] = useState<Id<"serviceSections"> | null>(null);
  const [name,        setName]        = useState("");
  const [desc,        setDesc]        = useState("");
  const [schedule,    setSchedule]    = useState("");
  const [pricingType, setPricingType] = useState<"fixed" | "hourly" | "tiered" | "recurring">("fixed");
  const [price,       setPrice]       = useState("0");
  const [nameError,   setNameError]   = useState("");
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (open && sectionId == null && sectionOptions?.length) {
      setPickedSectionId((prev) => prev ?? sectionOptions[0]._id);
    }
  }, [open, sectionId, sectionOptions]);

  const effectiveSectionId = sectionId ?? pickedSectionId;
  const effectiveSectionLabel =
    sectionId != null
      ? sectionName
      : sectionOptions?.find((s) => s._id === pickedSectionId)?.name ?? "Select a section";

  function reset() {
    setPickedSectionId(null);
    setName("");
    setDesc("");
    setSchedule("");
    setPricingType("fixed");
    setPrice("0");
    setNameError("");
  }
  function handleClose() { onOpenChange(false); reset(); }

  async function handleSubmit() {
    if (!name.trim()) { setNameError("Service name is required"); return; }
    if (!effectiveSectionId) { toast.error("Choose a section"); return; }
    setSaving(true);
    try {
      const result = await createLineItem({
        userId,
        sectionId: effectiveSectionId,
        name: name.trim(),
        description: desc.trim() || undefined,
        serviceSchedule: schedule.trim() || undefined,
        pricingType,
        fixedPrice: pricingType !== "hourly" ? (parseFloat(price) || 0) : undefined,
        hourlyRate:  pricingType === "hourly"  ? (parseFloat(price) || 0) : undefined,
      });
      if (!result.success) { toast.error(result.error || "Failed to add service"); return; }
      toast.success(`"${name.trim()}" added to ${effectiveSectionLabel}`);
      handleClose();
    } catch {
      toast.error("Failed to add service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[480px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
        <SheetTitle className="sr-only">Add Service</SheetTitle>
        <div className="flex flex-col h-full">

          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <Package className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">Add Service</h2>
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[200px]">→ {effectiveSectionLabel}</p>
                </div>
              </div>
              <button onClick={handleClose} disabled={saving} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {sectionId == null && sectionOptions && sectionOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Section <span className="text-red-500">*</span></Label>
                <Select
                  value={pickedSectionId ?? sectionOptions[0]._id}
                  onValueChange={(v) => setPickedSectionId(v as Id<"serviceSections">)}
                  disabled={saving}
                >
                  <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg">
                    <SelectValue placeholder="Choose section…" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {sectionOptions.map((s) => (
                      <SelectItem key={s._id} value={s._id} className="text-[13px]">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="svc-name" className="text-[13px]">Service name <span className="text-red-500">*</span></Label>
              <input
                id="svc-name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
                placeholder="e.g. Monthly Bookkeeping"
                disabled={saving}
                className={cn(
                  "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                  nameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                )}
              />
              {nameError && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-desc" className="text-[13px]">Description</Label>
              <textarea
                id="svc-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Brief description of this service..."
                rows={3}
                disabled={saving}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-schedule" className="text-[13px]">Service schedule</Label>
              <p className="text-[11px] text-slate-400 -mt-0.5 mb-1">Engagement letter — when this service runs.</p>
              <textarea
                id="svc-schedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="e.g. Monthly, within 5 business days of month-end"
                rows={2}
                disabled={saving}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Pricing type</Label>
                <Select value={pricingType} onValueChange={(v) => setPricingType(v as typeof pricingType)} disabled={saving}>
                  <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[100]">
                    {PRICING_TYPES.map(({ value, label }) => (
                      <SelectItem key={value} value={value} className="text-[13px]">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">{pricingType === "hourly" ? "Hourly rate (R)" : "Default price (R)"}</Label>
                <input
                  type="number" min="0" step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={saving}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
                />
              </div>
            </div>
          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5" style={{ background: ACCENT }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</> : "Add Service"}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Keep getCategoryColor exported for any remaining callers
const CAT_PALETTE = [
  "#6366f1","#8b5cf6","#ec4899","#f59e0b",
  "#10b981","#3b82f6","#ef4444","#14b8a6",
  "#f97316","#84cc16","#0ea5e9","#a855f7",
];
export function getCategoryColor(list: string[], name: string): string {
  const idx = list.indexOf(name);
  return CAT_PALETTE[(idx >= 0 ? idx : 0) % CAT_PALETTE.length];
}
