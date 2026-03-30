"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, X, Loader2, AlertCircle, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

type PricingType = "fixed" | "hourly" | "tiered" | "recurring" | "variation" | "income_range";
type CalcOperation = "multiply" | "divide" | "subtract" | "add";
type CalcByType = "quantity" | "static" | "variations";

const PRICING_TYPES: { value: PricingType; label: string }[] = [
  { value: "fixed",        label: "Fixed Price" },
  { value: "variation",    label: "Variation Price" },
  { value: "hourly",       label: "Hourly Rate" },
  { value: "tiered",       label: "Number Range Price" },
  { value: "recurring",    label: "Annual Revenue Price" },
  { value: "income_range", label: "Income Tax Range Price" },
];

const TAX_RATES = [
  { value: "default", label: "Use default tax rate" },
  { value: "vat15",   label: "VAT (15%)" },
  { value: "exempt",  label: "Exempt VAT (0%)" },
  { value: "zero",    label: "Zero Rated (0%)" },
] as const;

const CALC_OPERATIONS = [
  { value: "multiply", label: "Multiply" },
  { value: "divide",   label: "Divide" },
  { value: "subtract", label: "Subtract" },
  { value: "add",      label: "Add" },
] as const;

const CALC_BY_TYPES = [
  { value: "quantity",   label: "by quantity field" },
  { value: "static",     label: "by static value" },
  { value: "variations", label: "by variations" },
] as const;

// ── Predefined SA brackets ─────────────────────────────────────────────────

const ANNUAL_REVENUE_BRACKETS = [
  "Till",
  "Up to R2M",
  "R2M - R2.5M",
  "R2.5M - R5M",
  "R5M - R10M",
  "R10M - R40M",
  "R40M - R50M",
  "R50M - R80M",
  "R80M - R120M",
  "R120M - R180M",
  "R180M+",
];

const INCOME_TAX_BRACKETS = [
  "Less than R1m",
  "R1m - R20m",
  "R20m - R50m",
  "R50m - R100m",
  "More than R100m",
];

// ── Interfaces ─────────────────────────────────────────────────────────────

interface Calculation {
  id: string;
  operation: CalcOperation;
  valueType: CalcByType;
  staticValue: string;
  quantityLabel: string;
}

interface Variation {
  id: string;
  name: string;
  price: string;
}

interface TierRange {
  id: string;
  from: string;
  to: string;
  price: string;
}

interface PredefinedTier {
  id: string;
  label: string;
  price: string;
}

interface AddServiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: Id<"serviceSections"> | null;
  sectionName: string;
  userId: Id<"users">;
  sectionOptions?: { _id: Id<"serviceSections">; name: string }[];
}

// ── Factory helpers ────────────────────────────────────────────────────────

function newCalc(): Calculation {
  return { id: crypto.randomUUID(), operation: "multiply", valueType: "quantity", staticValue: "", quantityLabel: "" };
}
function newVariation(): Variation {
  return { id: crypto.randomUUID(), name: "", price: "" };
}
function newTierRange(): TierRange {
  return { id: crypto.randomUUID(), from: "0", to: "", price: "" };
}
function defaultAnnualRevenueTiers(): PredefinedTier[] {
  return ANNUAL_REVENUE_BRACKETS.map(label => ({ id: crypto.randomUUID(), label, price: "" }));
}
function defaultIncomeTiers(): PredefinedTier[] {
  return INCOME_TAX_BRACKETS.map(label => ({ id: crypto.randomUUID(), label, price: "" }));
}

// ── Component ──────────────────────────────────────────────────────────────

export function AddServiceSheet({ open, onOpenChange, sectionId, sectionName, userId, sectionOptions }: AddServiceSheetProps) {
  const createLineItem = useMutation(api.lineItems.createLineItem);

  const [pickedSectionId,    setPickedSectionId]    = useState<Id<"serviceSections"> | null>(null);
  const [name,               setName]               = useState("");
  const [desc,               setDesc]               = useState("");
  const [schedule,           setSchedule]           = useState("");
  const [billingFreq,        setBillingFreq]        = useState<"monthly" | "one_off">("monthly");
  const [pricingType,        setPricingType]        = useState<PricingType>("fixed");
  const [price,              setPrice]              = useState("0");
  const [taxRate,            setTaxRate]            = useState("default");
  const [fieldLabel,         setFieldLabel]         = useState("");
  const [variations,         setVariations]         = useState<Variation[]>([newVariation()]);
  const [tierRanges,         setTierRanges]         = useState<TierRange[]>([newTierRange()]);
  const [annualRevenueTiers, setAnnualRevenueTiers] = useState<PredefinedTier[]>(defaultAnnualRevenueTiers());
  const [incomeTiers,        setIncomeTiers]        = useState<PredefinedTier[]>(defaultIncomeTiers());
  const [addCalc,            setAddCalc]            = useState(false);
  const [calculations,       setCalculations]       = useState<Calculation[]>([newCalc()]);
  const [applyMinFee,        setApplyMinFee]        = useState(false);
  const [minFee,             setMinFee]             = useState("0");
  const [nameError,          setNameError]          = useState("");
  const [saving,             setSaving]             = useState(false);

  useEffect(() => {
    if (open && sectionId == null && sectionOptions?.length) {
      setPickedSectionId((prev) => prev ?? sectionOptions[0]._id);
    }
  }, [open, sectionId, sectionOptions]);

  const effectiveSectionId    = sectionId ?? pickedSectionId;
  const effectiveSectionLabel = sectionId != null
    ? sectionName
    : sectionOptions?.find((s) => s._id === pickedSectionId)?.name ?? "Select a section";

  function reset() {
    setPickedSectionId(null);
    setName(""); setDesc(""); setSchedule("");
    setBillingFreq("monthly"); setPricingType("fixed");
    setPrice("0"); setTaxRate("default");
    setFieldLabel(""); setVariations([newVariation()]);
    setTierRanges([newTierRange()]);
    setAnnualRevenueTiers(defaultAnnualRevenueTiers());
    setIncomeTiers(defaultIncomeTiers());
    setAddCalc(false); setCalculations([newCalc()]);
    setApplyMinFee(false); setMinFee("0");
    setNameError("");
  }
  function handleClose() { onOpenChange(false); reset(); }

  // ── Variation helpers ──────────────────────────────────────────────────
  function addVariation()                                                    { setVariations(v => [...v, newVariation()]); }
  function removeVariation(id: string)                                       { setVariations(v => v.filter(x => x.id !== id)); }
  function updateVariation(id: string, field: "name" | "price", val: string) {
    setVariations(v => v.map(x => x.id === id ? { ...x, [field]: val } : x));
  }
  function moveVariation(id: string, dir: -1 | 1) {
    setVariations(v => {
      const idx = v.findIndex(x => x.id === id);
      if (idx < 0) return v;
      const next = idx + dir;
      if (next < 0 || next >= v.length) return v;
      const arr = [...v]; [arr[idx], arr[next]] = [arr[next], arr[idx]]; return arr;
    });
  }

  // ── Number range helpers ───────────────────────────────────────────────
  function addTierRange()                                                     { setTierRanges(r => [...r, newTierRange()]); }
  function removeTierRange(id: string)                                        { setTierRanges(r => r.filter(x => x.id !== id)); }
  function updateTierRange(id: string, field: "from" | "to" | "price", val: string) {
    setTierRanges(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));
  }

  // ── Predefined tier helpers ────────────────────────────────────────────
  function updateAnnualTier(id: string, price: string) {
    setAnnualRevenueTiers(t => t.map(x => x.id === id ? { ...x, price } : x));
  }
  function updateIncomeTier(id: string, price: string) {
    setIncomeTiers(t => t.map(x => x.id === id ? { ...x, price } : x));
  }

  // ── Calculation helpers ────────────────────────────────────────────────
  function addCalculation()                                                   { if (calculations.length < 5) setCalculations(c => [...c, newCalc()]); }
  function removeCalculation(id: string)                                      { setCalculations(c => c.filter(x => x.id !== id)); }
  function updateCalc<K extends keyof Calculation>(id: string, field: K, val: Calculation[K]) {
    setCalculations(c => c.map(x => x.id === id ? { ...x, [field]: val } : x));
  }
  function moveCalc(id: string, dir: -1 | 1) {
    setCalculations(c => {
      const idx = c.findIndex(x => x.id === id);
      if (idx < 0) return c;
      const next = idx + dir;
      if (next < 0 || next >= c.length) return c;
      const arr = [...c]; [arr[idx], arr[next]] = [arr[next], arr[idx]]; return arr;
    });
  }

  // ── Build pricingTiers payload ─────────────────────────────────────────
  function buildPricingTiers() {
    switch (pricingType) {
      case "variation":
        return variations.filter(v => v.name.trim()).map(v => ({
          name: v.name.trim(), price: parseFloat(v.price) || 0, description: "",
        }));
      case "tiered":
        return tierRanges.filter(r => r.from.trim() || r.to.trim()).map(r => ({
          name: r.from.trim(), price: parseFloat(r.price) || 0,
          description: r.to.trim(), criteria: "number_range",
        }));
      case "recurring":
        return annualRevenueTiers.map(t => ({
          name: t.label, price: parseFloat(t.price) || 0, description: "", criteria: "annual_revenue",
        }));
      case "income_range":
        return incomeTiers.map(t => ({
          name: t.label, price: parseFloat(t.price) || 0, description: "", criteria: "income_range",
        }));
      default:
        return undefined;
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { setNameError("Service name is required"); return; }
    if (!effectiveSectionId) { toast.error("Choose a section"); return; }
    setSaving(true);
    try {
      const isHourly = pricingType === "hourly";
      const isFixed  = pricingType === "fixed";

      const result = await createLineItem({
        userId,
        sectionId: effectiveSectionId,
        name: name.trim(),
        description: desc.trim() || undefined,
        serviceSchedule: schedule.trim() || undefined,
        billingFrequency: billingFreq,
        pricingType,
        taxRate: taxRate === "default" ? undefined : taxRate,
        fieldLabel: pricingType === "variation" ? (fieldLabel.trim() || undefined) : undefined,
        fixedPrice: isFixed  ? (parseFloat(price) || 0) : undefined,
        hourlyRate: isHourly ? (parseFloat(price) || 0) : undefined,
        pricingTiers: buildPricingTiers(),
        addCalculation: addCalc,
        calculationVariations: addCalc
          ? calculations.map(c => ({
              id: c.id, operation: c.operation, valueType: c.valueType,
              staticValue:        c.valueType === "static"   ? (parseFloat(c.staticValue) || 0) : undefined,
              quantityFieldLabel: c.valueType === "quantity" ? (c.quantityLabel || undefined)   : undefined,
            }))
          : [],
        applyMinimumFee: billingFreq === "monthly" ? applyMinFee : false,
        minMonthlyFee:   billingFreq === "monthly" && applyMinFee ? (parseFloat(minFee) || 0) : undefined,
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

  const showSinglePrice = pricingType === "fixed" || pricingType === "hourly";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
        <SheetTitle className="sr-only">Add Service</SheetTitle>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <Package className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">Add Service</h2>
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[220px]">→ {effectiveSectionLabel}</p>
                </div>
              </div>
              <button onClick={handleClose} disabled={saving}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Section picker */}
            {sectionId == null && sectionOptions && sectionOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Section <span className="text-red-500">*</span></Label>
                <Select value={pickedSectionId ?? sectionOptions[0]._id} onValueChange={(v) => setPickedSectionId(v as Id<"serviceSections">)} disabled={saving}>
                  <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg"><SelectValue placeholder="Choose section…" /></SelectTrigger>
                  <SelectContent className="z-[100]">
                    {sectionOptions.map((s) => (
                      <SelectItem key={s._id} value={s._id} className="text-[13px]">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Service name */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Service name <span className="text-red-500">*</span></Label>
              <input value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
                placeholder="e.g. Monthly Bookkeeping" disabled={saving}
                className={cn(
                  "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                  nameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                )} />
              {nameError && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{nameError}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Description</Label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} disabled={saving}
                placeholder="Brief description of this service..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none" />
            </div>

            {/* Service schedule */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Service schedule</Label>
              <p className="text-[11px] text-slate-400 -mt-0.5 mb-1">Engagement letter — when this service runs.</p>
              <textarea value={schedule} onChange={(e) => setSchedule(e.target.value)} rows={2} disabled={saving}
                placeholder="e.g. Monthly, within 5 business days of month-end"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none" />
            </div>

            {/* Pricing divider */}
            <div className="border-t border-slate-100 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pricing</p>
            </div>

            {/* Billing + Pricing type (GoProposal layout) */}
            <div className="space-y-2">
              <Label className="text-[13px]">Pricing Type</Label>
              <div className="flex gap-2">
                <div className="flex h-10 rounded-lg border border-slate-200 overflow-hidden shrink-0">
                  {(["monthly", "one_off"] as const).map((v) => (
                    <button key={v} type="button" disabled={saving} onClick={() => setBillingFreq(v)}
                      className={cn("px-3 text-[12px] font-medium transition-colors",
                        billingFreq === v ? "text-white" : "text-slate-500 hover:bg-slate-50")}
                      style={billingFreq === v ? { background: "#243E63" } : {}}>
                      {v === "monthly" ? "Monthly" : "One-Off"}
                    </button>
                  ))}
                </div>
                <Select value={pricingType} onValueChange={(v) => setPricingType(v as PricingType)} disabled={saving}>
                  <SelectTrigger className="flex-1 h-10 text-[13px] border-slate-200 bg-white rounded-lg border-2 border-[#C8A96E]/30 focus:border-[#C8A96E]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {PRICING_TYPES.map(({ value, label }) => (
                      <SelectItem key={value} value={value} className="text-[13px]">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fixed / Hourly: single price */}
            {showSinglePrice && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">{pricingType === "hourly" ? "Hourly rate" : "Price"}</Label>
                <div className="flex h-10 rounded-lg border border-slate-200 overflow-hidden">
                  <span className="px-3 flex items-center text-[12px] font-medium text-slate-500 bg-slate-50 border-r border-slate-200">ZAR</span>
                  <input type="number" min="0" step="0.01" value={price}
                    onChange={(e) => setPrice(e.target.value)} disabled={saving}
                    className="flex-1 px-3 text-[13px] text-slate-800 focus:outline-none bg-white" />
                </div>
              </div>
            )}

            {/* Variation Price */}
            {pricingType === "variation" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Field Label</Label>
                  <input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)}
                    placeholder="e.g. Choose your package" disabled={saving}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] bg-white" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[13px]">Variations</Label>
                    <span className="text-[11px] text-slate-400">Set the price for each variation below.</span>
                  </div>
                  {variations.map((v, idx) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5 shrink-0 opacity-40">
                        <div className="w-3 h-0.5 bg-slate-400 rounded" />
                        <div className="w-3 h-0.5 bg-slate-400 rounded" />
                        <div className="w-3 h-0.5 bg-slate-400 rounded" />
                      </div>
                      <input value={v.name} onChange={(e) => updateVariation(v.id, "name", e.target.value)}
                        placeholder="Variation name" disabled={saving}
                        className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] bg-white" />
                      <div className="flex h-9 rounded-lg border border-slate-200 overflow-hidden w-[130px]">
                        <span className="px-2 flex items-center text-[11px] font-medium text-slate-500 bg-slate-50 border-r border-slate-200 whitespace-nowrap">ZAR</span>
                        <input type="number" min="0" step="0.01" value={v.price}
                          onChange={(e) => updateVariation(v.id, "price", e.target.value)} disabled={saving}
                          className="flex-1 px-2 text-[13px] text-slate-800 focus:outline-none bg-white min-w-0" />
                      </div>
                      <button type="button" disabled={saving || idx === 0} onClick={() => moveVariation(v.id, -1)}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={saving || idx === variations.length - 1} onClick={() => moveVariation(v.id, 1)}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={saving || variations.length <= 1} onClick={() => removeVariation(v.id)}
                        className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" disabled={saving} onClick={addVariation}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-[#243E63] hover:text-[#1a2d47] border border-[#243E63] rounded-lg px-3 py-1.5 transition-colors hover:bg-[#243E63]/5">
                    <Plus className="h-3.5 w-3.5" /> Add Variation
                  </button>
                </div>
              </div>
            )}

            {/* Number Range Price (tiered) */}
            {pricingType === "tiered" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px]">Number Ranges</Label>
                  <span className="text-[11px] text-slate-400">Set the number variants below.</span>
                </div>
                {tierRanges.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-500 shrink-0">From</span>
                    <input type="number" min="0" step="1" value={r.from}
                      onChange={(e) => updateTierRange(r.id, "from", e.target.value)} disabled={saving}
                      className="w-20 h-9 px-2 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white" />
                    <span className="text-[12px] text-slate-500 shrink-0">to</span>
                    <input type="number" min="0" step="1" value={r.to}
                      onChange={(e) => updateTierRange(r.id, "to", e.target.value)} disabled={saving}
                      className="w-20 h-9 px-2 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white" />
                    <div className="flex h-9 rounded-lg border border-slate-200 overflow-hidden flex-1">
                      <span className="px-2 flex items-center text-[11px] font-medium text-slate-500 bg-slate-50 border-r border-slate-200">ZAR</span>
                      <input type="number" min="0" step="0.01" value={r.price} placeholder="Price per unit"
                        onChange={(e) => updateTierRange(r.id, "price", e.target.value)} disabled={saving}
                        className="flex-1 px-2 text-[13px] text-slate-800 focus:outline-none bg-white min-w-0 placeholder-slate-300" />
                    </div>
                    <button type="button" disabled={saving || tierRanges.length <= 1} onClick={() => removeTierRange(r.id)}
                      className="h-9 w-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-100 disabled:opacity-30 transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" disabled={saving} onClick={addTierRange}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#243E63] hover:text-[#1a2d47] border border-[#243E63] rounded-lg px-3 py-1.5 transition-colors hover:bg-[#243E63]/5">
                  <Plus className="h-3.5 w-3.5" /> Add Range
                </button>
              </div>
            )}

            {/* Annual Revenue Price (recurring) */}
            {pricingType === "recurring" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[13px]">Annual Revenue Prices</Label>
                  <span className="text-[11px] text-slate-400">Set the price for each annual revenue range below.</span>
                </div>
                {annualRevenueTiers.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-600 text-right shrink-0 w-32">{t.label}</span>
                    <div className="flex h-9 rounded-lg border border-slate-200 overflow-hidden flex-1">
                      <span className="px-2 flex items-center text-[11px] font-medium text-slate-500 bg-slate-50 border-r border-slate-200">ZAR</span>
                      <input type="number" min="0" step="0.01" value={t.price} placeholder="Price"
                        onChange={(e) => updateAnnualTier(t.id, e.target.value)} disabled={saving}
                        className="flex-1 px-2 text-[13px] text-slate-800 focus:outline-none bg-white min-w-0 placeholder-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Income Tax Range Price */}
            {pricingType === "income_range" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[13px]">Income Tax Range Prices</Label>
                  <span className="text-[11px] text-slate-400">Set the price for each income range below.</span>
                </div>
                {incomeTiers.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-600 text-right shrink-0 w-36">{t.label}</span>
                    <div className="flex h-9 rounded-lg border border-slate-200 overflow-hidden flex-1">
                      <span className="px-2 flex items-center text-[11px] font-medium text-slate-500 bg-slate-50 border-r border-slate-200">ZAR</span>
                      <input type="number" min="0" step="0.01" value={t.price} placeholder="Price"
                        onChange={(e) => updateIncomeTier(t.id, e.target.value)} disabled={saving}
                        className="flex-1 px-2 text-[13px] text-slate-800 focus:outline-none bg-white min-w-0 placeholder-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tax rate */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Tax Rate to use</Label>
              <Select value={taxRate} onValueChange={setTaxRate} disabled={saving}>
                <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[100]">
                  {TAX_RATES.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="text-[13px]">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Calculation */}
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={addCalc} onChange={(e) => setAddCalc(e.target.checked)} disabled={saving}
                  className="h-4 w-4 rounded border-slate-300 accent-[#C8A96E]" />
                <span className="text-[13px] font-medium text-slate-700">Add Calculation to Line Price?</span>
              </label>
              {addCalc && (
                <div className="space-y-3">
                  {calculations.map((calc, idx) => (
                    <div key={calc.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Calculation {idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" disabled={saving || idx === 0} onClick={() => moveCalc(calc.id, -1)}
                            className="h-7 w-7 rounded border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                          <button type="button" disabled={saving || idx === calculations.length - 1} onClick={() => moveCalc(calc.id, 1)}
                            className="h-7 w-7 rounded border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                          <button type="button" disabled={saving} onClick={() => removeCalculation(calc.id)}
                            className="h-7 w-7 rounded border border-red-200 bg-white flex items-center justify-center text-red-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={calc.operation} onValueChange={(v) => updateCalc(calc.id, "operation", v as CalcOperation)} disabled={saving}>
                          <SelectTrigger className="h-9 text-[12px] border-slate-200 bg-white rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[100]">
                            {CALC_OPERATIONS.map(({ value, label }) => (<SelectItem key={value} value={value} className="text-[12px]">{label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <Select value={calc.valueType} onValueChange={(v) => updateCalc(calc.id, "valueType", v as CalcByType)} disabled={saving}>
                          <SelectTrigger className="h-9 text-[12px] border-slate-200 bg-white rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[100]">
                            {CALC_BY_TYPES.map(({ value, label }) => (<SelectItem key={value} value={value} className="text-[12px]">{label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      {calc.valueType === "static" && (
                        <input type="number" min="0" step="0.01" value={calc.staticValue}
                          onChange={(e) => updateCalc(calc.id, "staticValue", e.target.value)}
                          placeholder="Static value" disabled={saving}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-[#C8A96E]" />
                      )}
                      {calc.valueType === "quantity" && (
                        <input type="text" value={calc.quantityLabel}
                          onChange={(e) => updateCalc(calc.id, "quantityLabel", e.target.value)}
                          placeholder="Quantity field label (e.g. Number of employees)" disabled={saving}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-[#C8A96E] placeholder-slate-400" />
                      )}
                    </div>
                  ))}
                  {calculations.length < 5 && (
                    <button type="button" disabled={saving} onClick={addCalculation}
                      className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add Calculation
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Min monthly fee — only for Monthly billing */}
            {billingFreq === "monthly" && (
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={applyMinFee} onChange={(e) => setApplyMinFee(e.target.checked)} disabled={saving}
                    className="h-4 w-4 rounded border-slate-300 accent-[#C8A96E]" />
                  <span className="text-[13px] font-medium text-slate-700">Apply a minimum monthly service fee</span>
                </label>
                {applyMinFee && (
                  <div className="flex h-10 rounded-lg border border-slate-200 overflow-hidden">
                    <span className="px-3 flex items-center text-[12px] font-medium text-slate-500 bg-slate-50 border-r border-slate-200">Min (ZAR)</span>
                    <input type="number" min="0" step="0.01" value={minFee}
                      onChange={(e) => setMinFee(e.target.value)} disabled={saving}
                      className="flex-1 px-3 text-[13px] text-slate-800 focus:outline-none bg-white" />
                  </div>
                )}
              </div>
            )}

          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving}
              className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
              style={{ background: ACCENT }}>
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
