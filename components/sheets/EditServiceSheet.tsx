"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

const PRICING_TYPES = [
  { value: "fixed",     label: "Fixed" },
  { value: "hourly",    label: "Hourly" },
  { value: "tiered",    label: "Tiered" },
  { value: "recurring", label: "Recurring" },
] as const;

export type LineItemForEdit = {
  _id: Id<"services">;
  name: string;
  description?: string;
  serviceSchedule?: string;
  pricingType: "fixed" | "hourly" | "tiered" | "recurring";
  hourlyRate?: number;
  fixedPrice?: number;
  isActive: boolean;
};

interface EditServiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: LineItemForEdit | null;
  sectionName: string;
  userId: Id<"users">;
}

export function EditServiceSheet({ open, onOpenChange, service, sectionName, userId }: EditServiceSheetProps) {
  const updateLineItem = useMutation(api.lineItems.updateLineItem);

  const [name,            setName]            = useState("");
  const [desc,            setDesc]            = useState("");
  const [schedule,        setSchedule]        = useState("");
  const [pricingType,     setPricingType]     = useState<"fixed" | "hourly" | "tiered" | "recurring">("fixed");
  const [price,           setPrice]           = useState("0");
  const [isActive,        setIsActive]        = useState(true);
  const [nameError,       setNameError]       = useState("");
  const [saving,          setSaving]          = useState(false);

  useEffect(() => {
    if (service && open) {
      setName(service.name);
      setDesc(service.description ?? "");
      setSchedule(service.serviceSchedule ?? "");
      setPricingType(service.pricingType ?? "fixed");
      setPrice(String(service.fixedPrice ?? service.hourlyRate ?? 0));
      setIsActive(service.isActive);
      setNameError("");
    }
  }, [service, open]);

  function handleClose() { onOpenChange(false); setNameError(""); }

  async function handleSubmit() {
    if (!name.trim()) { setNameError("Service name is required"); return; }
    if (!service) return;
    setSaving(true);
    try {
      const result = await updateLineItem({
        userId,
        lineItemId: service._id,
        name: name.trim(),
        description: desc.trim() || undefined,
        serviceSchedule: schedule.trim() || undefined,
        pricingType,
        fixedPrice:  pricingType !== "hourly" ? (parseFloat(price) || 0) : undefined,
        hourlyRate:  pricingType === "hourly"  ? (parseFloat(price) || 0) : undefined,
        isActive,
      });
      if (!result.success) {
        toast.error(result.error || "Failed to update service");
        return;
      }
      toast.success(`"${name.trim()}" updated`);
      handleClose();
    } catch {
      toast.error("Failed to update service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right"
        hideClose
        className="w-full sm:max-w-none sm:w-[480px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">Edit Service</SheetTitle>
        <div className="flex flex-col h-full">

          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <Pencil className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">Edit Service</h2>
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[220px]">{sectionName}</p>
                </div>
              </div>
              <button onClick={handleClose} disabled={saving} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            <div className="space-y-1.5">
              <Label htmlFor="edit-svc-name" className="text-[13px]">Service name <span className="text-red-500">*</span></Label>
              <input
                id="edit-svc-name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
                disabled={saving}
                className={cn(
                  "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                  nameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                )}
              />
              {nameError && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-svc-desc" className="text-[13px]">Description</Label>
              <textarea
                id="edit-svc-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                disabled={saving}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-svc-schedule" className="text-[13px]">Service schedule</Label>
              <p className="text-[11px] text-slate-400 -mt-0.5 mb-1">Used in engagement letters (rich text supported in other editors).</p>
              <textarea
                id="edit-svc-schedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                rows={3}
                disabled={saving}
                placeholder="When and how this service is delivered…"
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
                <Label className="text-[13px]">{pricingType === "hourly" ? "Hourly rate (R)" : "Price (R)"}</Label>
                <input
                  type="number" min="0" step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={saving}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div>
                <p className="text-[13px] font-medium text-slate-800">Active</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Show this service in proposals</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                disabled={saving}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  isActive ? "bg-emerald-500" : "bg-slate-300"
                )}
              >
                <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform", isActive ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5" style={{ background: ACCENT }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Changes"}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
