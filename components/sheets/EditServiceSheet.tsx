"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, X, Loader2, AlertCircle, Plus, Trash2, ChevronUp, ChevronDown, GripHorizontal, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

type PricingType = "fixed" | "tiered" | "recurring" | "variation" | "income_range";
type CalcOperation = "multiply" | "divide" | "subtract" | "add";
type CalcByType = "none" | "quantity" | "static" | "variations";

const PRICING_TYPES: { value: PricingType; label: string }[] = [
  { value: "fixed",        label: "Fixed Price" },
  { value: "variation",    label: "Variation Price" },
  { value: "recurring",    label: "Annual Revenue Price" },
  { value: "income_range", label: "Income tax total Income ranges Price" },
  { value: "tiered",       label: "Number Range Price" },
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
  { value: "none",       label: "by what?" },
  { value: "quantity",   label: "by quantity field" },
  { value: "static",     label: "by static value" },
  { value: "variations", label: "by variations" },
] as const;

type PriceMode = "fixed" | "formula";

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

interface CalcVariation {
  id: string;
  name: string;
  value: string;
}

interface Calculation {
  id: string;
  operation: CalcOperation;
  valueType: CalcByType;
  staticValue: string;
  quantityLabel: string;
  calcVariationLabel: string;
  calcVariations: CalcVariation[];
}

interface Variation {
  id: string;
  name: string;
  priceMode: PriceMode;
  price: string;
  formula: string;
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
  priceMode: PriceMode;
  price: string;
  formula: string;
}

export type LineItemForEdit = {
  _id: Id<"services">;
  name: string;
  description?: string;
  serviceSchedule?: string;
  billingFrequency?: "monthly" | "one_off";
  pricingType: PricingType;
  taxRate?: string;
  fieldLabel?: string;
  hourlyRate?: number;
  fixedPrice?: number;
  pricingTiers?: { name: string; price: number; description: string; criteria?: string }[];
  isActive: boolean;
  addCalculation?: boolean;
  calculationVariations?: {
    id: string;
    operation: CalcOperation;
    valueType?: CalcByType;
    staticValue?: number;
    quantityFieldLabel?: string;
    label?: string;
    options?: { label: string; value: number }[];
  }[];
  applyMinimumFee?: boolean;
  minMonthlyFee?: number;
};

interface EditServiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: LineItemForEdit | null;
  sectionName: string;
  userId: Id<"users">;
}

// ── Factory helpers ────────────────────────────────────────────────────────

function newCalcVariation(): CalcVariation {
  return { id: crypto.randomUUID(), name: "", value: "" };
}
function newCalc(): Calculation {
  return { id: crypto.randomUUID(), operation: "multiply", valueType: "none", staticValue: "", quantityLabel: "", calcVariationLabel: "", calcVariations: [newCalcVariation()] };
}
function newVariation(): Variation {
  return { id: crypto.randomUUID(), name: "", priceMode: "fixed", price: "", formula: "" };
}
function newTierRange(): TierRange {
  return { id: crypto.randomUUID(), from: "0", to: "", price: "" };
}
function defaultAnnualRevenueTiers(): PredefinedTier[] {
  return ANNUAL_REVENUE_BRACKETS.map(label => ({ id: crypto.randomUUID(), label, priceMode: "fixed", price: "", formula: "" }));
}
function defaultIncomeTiers(): PredefinedTier[] {
  return INCOME_TAX_BRACKETS.map(label => ({ id: crypto.randomUUID(), label, priceMode: "fixed", price: "", formula: "" }));
}

// ── Component ──────────────────────────────────────────────────────────────

export function EditServiceSheet({ open, onOpenChange, service, sectionName, userId }: EditServiceSheetProps) {
  const updateLineItem = useMutation(api.lineItems.updateLineItem);

  const [name,               setName]               = useState("");
  const [desc,               setDesc]               = useState("");
  const [schedule,           setSchedule]           = useState("");
  const [billingFreq,        setBillingFreq]        = useState<"monthly" | "one_off">("monthly");
  const [pricingType,        setPricingType]        = useState<PricingType>("fixed");
  const [price,              setPrice]              = useState("");
  const [taxRate,            setTaxRate]            = useState("default");
  const [openModeDropdown,    setOpenModeDropdown]    = useState<string | null>(null);
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null);
  const [fieldLabel,         setFieldLabel]         = useState("");
  const [variations,         setVariations]         = useState<Variation[]>([newVariation()]);
  const [tierRanges,         setTierRanges]         = useState<TierRange[]>([newTierRange()]);
  const [annualRevenueTiers, setAnnualRevenueTiers] = useState<PredefinedTier[]>(defaultAnnualRevenueTiers());
  const [incomeTiers,        setIncomeTiers]        = useState<PredefinedTier[]>(defaultIncomeTiers());
  const [addCalc,            setAddCalc]            = useState(false);
  const [calculations,       setCalculations]       = useState<Calculation[]>([newCalc()]);
  const [applyMinFee,        setApplyMinFee]        = useState(false);
  const [minFee,             setMinFee]             = useState("");
  const [isActive,           setIsActive]           = useState(true);
  const [nameError,          setNameError]          = useState("");
  const [saving,             setSaving]             = useState(false);

  useEffect(() => {
    if (!service || !open) return;
    setName(service.name);
    setDesc(service.description ?? "");
    setSchedule(service.serviceSchedule ?? "");
    setBillingFreq(service.billingFrequency ?? "monthly");
    setPricingType(service.pricingType ?? "fixed");
    setPrice(String(service.fixedPrice ?? service.hourlyRate ?? ""));
    setTaxRate(service.taxRate ?? "default");
    setFieldLabel(service.fieldLabel ?? "");
    setNameError("");
    setIsActive(service.isActive);
    setAddCalc(service.addCalculation ?? false);
    setCalculations(
      service.calculationVariations?.length
        ? service.calculationVariations.map(c => ({
            id: c.id, operation: c.operation ?? "multiply",
            valueType: (c.valueType ?? "none") as CalcByType,
            staticValue: String(c.staticValue ?? ""),
            quantityLabel: c.quantityFieldLabel ?? "",
            calcVariationLabel: c.label ?? "",
            calcVariations: c.options?.length
              ? c.options.map(o => ({ id: crypto.randomUUID(), name: o.label, value: String(o.value) }))
              : [newCalcVariation()],
          }))
        : [newCalc()]
    );
    setApplyMinFee(service.applyMinimumFee ?? false);
    setMinFee(String(service.minMonthlyFee ?? ""));

    // Variation options
    const varTiers = service.pricingTiers?.filter(t => !t.criteria || t.criteria === "variation") ?? [];
    setVariations(
      varTiers.length
        ? varTiers.map(t => ({ id: crypto.randomUUID(), name: t.name, priceMode: "fixed" as PriceMode, price: String(t.price), formula: "" }))
        : [newVariation()]
    );

    // Number range tiers
    const rangeTiers = service.pricingTiers?.filter(t => t.criteria === "number_range") ?? [];
    setTierRanges(
      rangeTiers.length
        ? rangeTiers.map(t => ({ id: crypto.randomUUID(), from: t.name, to: t.description, price: String(t.price) }))
        : [newTierRange()]
    );

    // Annual revenue tiers
    setAnnualRevenueTiers(
      ANNUAL_REVENUE_BRACKETS.map(label => {
        const saved = service.pricingTiers?.find(t => t.name === label && t.criteria === "annual_revenue");
        return { id: crypto.randomUUID(), label, priceMode: "fixed" as PriceMode, price: String(saved?.price ?? ""), formula: "" };
      })
    );

    // Income tax tiers
    setIncomeTiers(
      INCOME_TAX_BRACKETS.map(label => {
        const saved = service.pricingTiers?.find(t => t.name === label && t.criteria === "income_range");
        return { id: crypto.randomUUID(), label, priceMode: "fixed" as PriceMode, price: String(saved?.price ?? ""), formula: "" };
      })
    );
  }, [service, open]);

  useEffect(() => {
    if (!openModeDropdown) return;
    function handleClick() { setOpenModeDropdown(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openModeDropdown]);

  useEffect(() => {
    if (!openActionsDropdown) return;
    function handleClick() { setOpenActionsDropdown(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openActionsDropdown]);

  function handleClose() { onOpenChange(false); setNameError(""); setOpenModeDropdown(null); setOpenActionsDropdown(null); }

  // ── Variation helpers ──────────────────────────────────────────────────
  function addVariation()                                                 { setVariations(v => [...v, newVariation()]); }
  function removeVariation(id: string)                                    { setVariations(v => v.filter(x => x.id !== id)); }
  function updateVariation(id: string, field: "name" | "priceMode" | "price" | "formula", val: string) {
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
  function addTierRange()                                                  { setTierRanges(r => [...r, newTierRange()]); }
  function removeTierRange(id: string)                                     { setTierRanges(r => r.filter(x => x.id !== id)); }
  function updateTierRange(id: string, field: "from" | "to" | "price", val: string) {
    setTierRanges(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));
  }

  // ── Predefined tier helpers ────────────────────────────────────────────
  function updateAnnualTier(id: string, field: "priceMode" | "price" | "formula", val: string) {
    setAnnualRevenueTiers(t => t.map(x => x.id === id ? { ...x, [field]: val } : x));
  }
  function updateIncomeTier(id: string, field: "priceMode" | "price" | "formula", val: string) {
    setIncomeTiers(t => t.map(x => x.id === id ? { ...x, [field]: val } : x));
  }

  function toggleModeDropdown(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setOpenModeDropdown(prev => prev === id ? null : id);
  }
  function toggleActionsDropdown(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setOpenActionsDropdown(prev => prev === id ? null : id);
  }

  // ── Calculation helpers ────────────────────────────────────────────────
  function addCalculation()                                               { if (calculations.length < 5) setCalculations(c => [...c, newCalc()]); }
  function removeCalculation(id: string)                                  { setCalculations(c => c.filter(x => x.id !== id)); }
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
  function addCalcVariation(calcId: string) {
    setCalculations(c => c.map(x => x.id === calcId ? { ...x, calcVariations: [...x.calcVariations, newCalcVariation()] } : x));
  }
  function removeCalcVariation(calcId: string, varId: string) {
    setCalculations(c => c.map(x => x.id === calcId ? { ...x, calcVariations: x.calcVariations.filter(v => v.id !== varId) } : x));
  }
  function updateCalcVariation(calcId: string, varId: string, field: "name" | "value", val: string) {
    setCalculations(c => c.map(x => x.id === calcId
      ? { ...x, calcVariations: x.calcVariations.map(v => v.id === varId ? { ...v, [field]: val } : v) }
      : x));
  }
  function moveCalcVariation(calcId: string, varId: string, dir: -1 | 1 | "bottom") {
    setCalculations(c => c.map(x => {
      if (x.id !== calcId) return x;
      const vars = [...x.calcVariations];
      const idx = vars.findIndex(v => v.id === varId);
      if (idx < 0) return x;
      if (dir === "bottom") { const [item] = vars.splice(idx, 1); return { ...x, calcVariations: [...vars, item] }; }
      const next = idx + (dir as number);
      if (next < 0 || next >= vars.length) return x;
      [vars[idx], vars[next]] = [vars[next], vars[idx]];
      return { ...x, calcVariations: vars };
    }));
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
    if (!service) return;

    // ── Pricing validation ───────────────────────────────────────────────
    const errors: string[] = [];

    if (pricingType === "fixed") {
      const p = parseFloat(price);
      if (isNaN(p) || p < 0) errors.push("Price must be 0 or a positive number");
    }

    if (pricingType === "variation") {
      const named = variations.filter((v) => v.name.trim());
      if (named.length === 0) {
        errors.push("Add at least one variation with a name");
      } else {
        const invalid = named.filter((v) => {
          if (v.priceMode === "formula") return !v.formula.trim();
          return v.price === "" || isNaN(parseFloat(v.price)) || parseFloat(v.price) < 0;
        });
        if (invalid.length > 0)
          errors.push(`${invalid.length} variation${invalid.length > 1 ? "s are" : " is"} missing a valid ${invalid.some(v => v.priceMode === "formula") ? "formula" : "price"}`);
      }
    }

    if (pricingType === "tiered") {
      if (tierRanges.length === 0) {
        errors.push("Add at least one number range");
      } else {
        const badRange = tierRanges.some((r) => {
          const f = parseFloat(r.from); const t = parseFloat(r.to);
          return isNaN(f) || isNaN(t) || t <= f;
        });
        if (badRange) errors.push("Each range: the To value must be greater than the From value");
        const noPrice = tierRanges.filter((r) => r.price === "" || isNaN(parseFloat(r.price)) || parseFloat(r.price) < 0);
        if (noPrice.length > 0)
          errors.push(`${noPrice.length} range${noPrice.length > 1 ? "s are" : " is"} missing a price`);
      }
    }

    if (pricingType === "recurring") {
      const priced = annualRevenueTiers.filter((t) =>
        (t.priceMode === "fixed" && t.price !== "" && parseFloat(t.price) > 0) ||
        (t.priceMode === "formula" && t.formula.trim())
      );
      if (priced.length === 0) errors.push("Set a price for at least one annual revenue bracket");
    }

    if (pricingType === "income_range") {
      const priced = incomeTiers.filter((t) =>
        (t.priceMode === "fixed" && t.price !== "" && parseFloat(t.price) > 0) ||
        (t.priceMode === "formula" && t.formula.trim())
      );
      if (priced.length === 0) errors.push("Set a price for at least one income tax bracket");
    }

    if (addCalc) {
      for (const [i, calc] of calculations.entries()) {
        if (calc.valueType === "none") {
          errors.push(`Calculation ${i + 1}: select what to calculate by`); break;
        }
        if (calc.valueType === "static") {
          const v = parseFloat(calc.staticValue);
          if (!calc.staticValue.trim() || isNaN(v) || v <= 0) {
            errors.push("Static calculations need a value greater than 0"); break;
          }
        }
        if (calc.valueType === "quantity" && !calc.quantityLabel.trim()) {
          errors.push("Quantity-based calculations need a field label"); break;
        }
        if (calc.valueType === "variations" && !calc.calcVariations.some(v => v.name.trim())) {
          errors.push(`Calculation ${i + 1}: add at least one variation`); break;
        }
      }
    }

    if (billingFreq === "monthly" && applyMinFee) {
      const fee = parseFloat(minFee);
      if (isNaN(fee) || fee <= 0) errors.push("Minimum monthly fee must be greater than R0.00");
    }

    if (errors.length > 0) { errors.forEach((e) => toast.error(e)); return; }

    setSaving(true);
    try {
      const result = await updateLineItem({
        userId,
        lineItemId: service._id,
        name: name.trim(),
        description: desc.trim() || undefined,
        serviceSchedule: schedule.trim() || undefined,
        billingFrequency: billingFreq,
        pricingType,
        taxRate: taxRate === "default" ? undefined : taxRate,
        fieldLabel: pricingType === "variation" ? (fieldLabel.trim() || undefined) : undefined,
        fixedPrice: pricingType === "fixed" ? (parseFloat(price) || 0) : undefined,
        pricingTiers: buildPricingTiers(),
        isActive,
        addCalculation: addCalc,
        calculationVariations: addCalc
          ? calculations.map(c => ({
              id: c.id, operation: c.operation,
              valueType: c.valueType === "none" ? undefined : c.valueType as "quantity" | "static" | "variations",
              staticValue:       c.valueType === "static"   ? (parseFloat(c.staticValue) || 0) : undefined,
              quantityFieldLabel: c.valueType === "quantity" ? (c.quantityLabel || undefined)  : undefined,
              label: c.valueType === "quantity" ? (c.quantityLabel || undefined)
                   : c.valueType === "variations" ? (c.calcVariationLabel || undefined)
                   : undefined,
              options: c.valueType === "variations"
                ? c.calcVariations.filter(v => v.name.trim()).map(v => ({ label: v.name.trim(), value: parseFloat(v.value) || 0 }))
                : undefined,
            }))
          : [],
        applyMinimumFee: billingFreq === "monthly" ? applyMinFee : false,
        minMonthlyFee:   billingFreq === "monthly" && applyMinFee ? (parseFloat(minFee) || 0) : undefined,
      });

      if (!result.success) { toast.error(result.error || "Failed to update service"); return; }
      toast.success(`"${name.trim()}" updated`);
      handleClose();
    } catch {
      toast.error("Failed to update service");
    } finally {
      setSaving(false);
    }
  }

  const showSinglePrice = pricingType === "fixed";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right" hideClose
        className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">Edit Service</SheetTitle>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <Pencil className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">Edit Service</h2>
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[240px]">{sectionName}</p>
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

            {/* Service name */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Service name <span className="text-red-500">*</span></Label>
              <input value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
                disabled={saving}
                className={cn(
                  "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                  nameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                )} />
              {nameError && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{nameError}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Description</Label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} disabled={saving}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none" />
            </div>

            {/* Service schedule */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Service schedule</Label>
              <p className="text-[11px] text-slate-400 -mt-0.5 mb-1">Used in engagement letters.</p>
              <textarea value={schedule} onChange={(e) => setSchedule(e.target.value)} rows={2} disabled={saving}
                placeholder="e.g. Once-off service, completed within 10–15 business days"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none" />
            </div>

            {/* Pricing divider */}
            <div className="border-t border-slate-100 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pricing</p>
            </div>

            {/* Pricing type */}
            <div className="space-y-2">
              <Label className="text-[13px]">Pricing Type</Label>
              <Select value={pricingType} onValueChange={(v) => setPricingType(v as PricingType)} disabled={saving}>
                <SelectTrigger className="w-full h-10 text-[13px] border-slate-200 bg-white rounded-lg border-2 border-[#C8A96E]/30 focus:border-[#C8A96E]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {PRICING_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="text-[13px]">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fixed: single price field */}
            {showSinglePrice && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">Price</Label>
                <div className="flex h-10 rounded-lg border border-slate-200 overflow-hidden">
                  <span className="px-3 flex items-center text-[12px] font-medium text-slate-500 bg-slate-50 border-r border-slate-200">ZAR</span>
                  <input type="number" min="0" step="0.01" value={price}
                    onChange={(e) => setPrice(e.target.value)} disabled={saving}
                    placeholder="0.00"
                    className="flex-1 px-3 text-[13px] text-slate-800 focus:outline-none bg-white placeholder-slate-400" />
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
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[13px]">Variations</Label>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-600" aria-label="Help">
                            <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-left text-[12px] font-normal leading-relaxed">
                          Set a fixed price or formula for each variation below.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {variations.map((v, idx) => (
                    <div key={v.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5 shrink-0 opacity-40">
                          <div className="w-3 h-0.5 bg-slate-400 rounded" />
                          <div className="w-3 h-0.5 bg-slate-400 rounded" />
                          <div className="w-3 h-0.5 bg-slate-400 rounded" />
                        </div>
                        <input value={v.name} onChange={(e) => updateVariation(v.id, "name", e.target.value)}
                          placeholder="Variation name" disabled={saving}
                          className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] bg-white" />
                        <div className="relative flex h-9 rounded-lg border border-slate-200 overflow-visible flex-1 min-w-0">
                          <button type="button" disabled={saving}
                            onClick={(e) => toggleModeDropdown(v.id, e)}
                            className="flex items-center gap-1 px-2.5 bg-slate-50 border-r border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors shrink-0 rounded-l-lg">
                            {v.priceMode === "fixed" ? "ZAR" : <GripHorizontal className="h-3.5 w-3.5" />}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </button>
                          {openModeDropdown === v.id && (
                            <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[130px]" onClick={e => e.stopPropagation()}>
                              <button type="button" onClick={() => { updateVariation(v.id, "priceMode", "fixed"); setOpenModeDropdown(null); }}
                                className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50">Fixed Price</button>
                              <button type="button" onClick={() => { updateVariation(v.id, "priceMode", "formula"); setOpenModeDropdown(null); }}
                                className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a73e8] hover:bg-slate-50">Calculation</button>
                            </div>
                          )}
                          {v.priceMode === "fixed" ? (
                            <input type="number" min="0" step="0.01" value={v.price}
                              onChange={(e) => updateVariation(v.id, "price", e.target.value)} disabled={saving}
                              placeholder="Variation Price"
                              className="flex-1 px-3 text-[13px] text-slate-800 placeholder-slate-300 focus:outline-none bg-white min-w-0" />
                          ) : (
                            <input type="text" value={v.formula}
                              onChange={(e) => updateVariation(v.id, "formula", e.target.value)} disabled={saving}
                              placeholder="[previous]*1.35"
                              className="flex-1 px-3 text-[13px] text-slate-800 placeholder-slate-300 focus:outline-none bg-white min-w-0" />
                          )}
                        </div>
                        <button type="button" disabled={saving || idx === 0} onClick={() => moveVariation(v.id, -1)}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={saving || idx === variations.length - 1} onClick={() => moveVariation(v.id, 1)}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={saving || variations.length <= 1} onClick={() => removeVariation(v.id)}
                          className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      {v.priceMode === "formula" && (
                        <div className="flex items-center gap-1.5 flex-wrap pl-5">
                          <span className="text-[11px] text-slate-500 mr-1">You can use the following options</span>
                          <button type="button" onClick={() => updateVariation(v.id, "formula", v.formula + "[previous]")}
                            className="h-6 px-2.5 rounded-full text-[10px] font-medium text-white bg-[#1a6b3c] hover:bg-[#145530]">Previous Price</button>
                          {(["+", "-", "/", "*"] as const).map((op, i) => (
                            <button key={op} type="button" onClick={() => updateVariation(v.id, "formula", v.formula + op)}
                              className="h-6 w-6 rounded-full text-[12px] font-medium text-white bg-[#1a6b3c] hover:bg-[#145530] flex items-center justify-center">
                              {["+", "-", "÷", "×"][i]}
                            </button>
                          ))}
                        </div>
                      )}
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
                  <span className="text-[11px] text-slate-400">You can set the number variants below.</span>
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
                  <span className="text-[11px] text-slate-400">You can set the price for each annual revenue range below.</span>
                </div>
                {annualRevenueTiers.map((t) => (
                  <div key={t.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-slate-600 text-right shrink-0 w-32">{t.label}</span>
                      <div className="relative flex h-9 rounded-lg border border-slate-200 overflow-visible flex-1">
                        <button type="button" disabled={saving}
                          onClick={(e) => toggleModeDropdown(t.id, e)}
                          className="flex items-center gap-1 px-2.5 bg-slate-50 border-r border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors shrink-0 rounded-l-lg">
                          {t.priceMode === "fixed" ? "ZAR" : <GripHorizontal className="h-3.5 w-3.5" />}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                        {openModeDropdown === t.id && (
                          <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[130px]" onClick={e => e.stopPropagation()}>
                            <button type="button" onClick={() => { updateAnnualTier(t.id, "priceMode", "fixed"); setOpenModeDropdown(null); }}
                              className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50">Fixed Price</button>
                            <button type="button" onClick={() => { updateAnnualTier(t.id, "priceMode", "formula"); setOpenModeDropdown(null); }}
                              className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a73e8] hover:bg-slate-50">Calculation</button>
                          </div>
                        )}
                        {t.priceMode === "fixed" ? (
                          <input type="number" min="0" step="0.01" value={t.price} placeholder="Variation Price"
                            onChange={(e) => updateAnnualTier(t.id, "price", e.target.value)} disabled={saving}
                            className="flex-1 px-3 text-[13px] text-slate-800 placeholder-slate-300 focus:outline-none bg-white" />
                        ) : (
                          <input type="text" value={t.formula} placeholder="[previous]*1.35"
                            onChange={(e) => updateAnnualTier(t.id, "formula", e.target.value)} disabled={saving}
                            className="flex-1 px-3 text-[13px] text-slate-800 placeholder-slate-300 focus:outline-none bg-white" />
                        )}
                      </div>
                    </div>
                    {t.priceMode === "formula" && (
                      <div className="flex items-center gap-1.5 flex-wrap pl-36">
                        <span className="text-[11px] text-slate-500 mr-1">You can use the following options</span>
                        <button type="button" onClick={() => updateAnnualTier(t.id, "formula", t.formula + "[previous]")}
                          className="h-6 px-2.5 rounded-full text-[10px] font-medium text-white bg-[#1a6b3c] hover:bg-[#145530]">Previous Price</button>
                        {(["+", "-", "/", "*"] as const).map((op, i) => (
                          <button key={op} type="button" onClick={() => updateAnnualTier(t.id, "formula", t.formula + op)}
                            className="h-6 w-6 rounded-full text-[12px] font-medium text-white bg-[#1a6b3c] hover:bg-[#145530] flex items-center justify-center">
                            {["+", "-", "÷", "×"][i]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Income Tax Range Price */}
            {pricingType === "income_range" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[13px]">Income tax total Income ranges Prices</Label>
                  <span className="text-[11px] text-slate-400">You can set the price for each revenue range below.</span>
                </div>
                {incomeTiers.map((t) => (
                  <div key={t.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-slate-600 text-right shrink-0 w-36">{t.label}</span>
                      <div className="relative flex h-9 rounded-lg border border-slate-200 overflow-visible flex-1">
                        <button type="button" disabled={saving}
                          onClick={(e) => toggleModeDropdown(t.id, e)}
                          className="flex items-center gap-1 px-2.5 bg-slate-50 border-r border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors shrink-0 rounded-l-lg">
                          {t.priceMode === "fixed" ? "ZAR" : <GripHorizontal className="h-3.5 w-3.5" />}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                        {openModeDropdown === t.id && (
                          <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[130px]" onClick={e => e.stopPropagation()}>
                            <button type="button" onClick={() => { updateIncomeTier(t.id, "priceMode", "fixed"); setOpenModeDropdown(null); }}
                              className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50">Fixed Price</button>
                            <button type="button" onClick={() => { updateIncomeTier(t.id, "priceMode", "formula"); setOpenModeDropdown(null); }}
                              className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a73e8] hover:bg-slate-50">Calculation</button>
                          </div>
                        )}
                        {t.priceMode === "fixed" ? (
                          <input type="number" min="0" step="0.01" value={t.price} placeholder="Variation Price"
                            onChange={(e) => updateIncomeTier(t.id, "price", e.target.value)} disabled={saving}
                            className="flex-1 px-3 text-[13px] text-slate-800 placeholder-slate-300 focus:outline-none bg-white" />
                        ) : (
                          <input type="text" value={t.formula} placeholder="[previous]*1.35"
                            onChange={(e) => updateIncomeTier(t.id, "formula", e.target.value)} disabled={saving}
                            className="flex-1 px-3 text-[13px] text-slate-800 placeholder-slate-300 focus:outline-none bg-white" />
                        )}
                      </div>
                    </div>
                    {t.priceMode === "formula" && (
                      <div className="flex items-center gap-1.5 flex-wrap pl-40">
                        <span className="text-[11px] text-slate-500 mr-1">You can use the following options</span>
                        <button type="button" onClick={() => updateIncomeTier(t.id, "formula", t.formula + "[previous]")}
                          className="h-6 px-2.5 rounded-full text-[10px] font-medium text-white bg-[#1a6b3c] hover:bg-[#145530]">Previous Price</button>
                        {(["+", "-", "/", "*"] as const).map((op, i) => (
                          <button key={op} type="button" onClick={() => updateIncomeTier(t.id, "formula", t.formula + op)}
                            className="h-6 w-6 rounded-full text-[12px] font-medium text-white bg-[#1a6b3c] hover:bg-[#145530] flex items-center justify-center">
                            {["+", "-", "÷", "×"][i]}
                          </button>
                        ))}
                      </div>
                    )}
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

            {/* Add Calculation — hidden for fixed price */}
            {pricingType !== "fixed" && <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={addCalc} onChange={(e) => setAddCalc(e.target.checked)} disabled={saving}
                  className="h-4 w-4 rounded border-slate-300 accent-[#C8A96E]" />
                <span className="text-[13px] font-medium text-slate-700">Add Calculation to Line Price?</span>
              </label>

              {addCalc && (
                <div className="space-y-3">
                  {calculations.map((calc, idx) => (
                    <div key={calc.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Calculation {idx + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" disabled={saving || idx === 0} onClick={() => moveCalc(calc.id, -1)}
                            className="h-7 w-7 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                          <button type="button" disabled={saving || idx === calculations.length - 1} onClick={() => moveCalc(calc.id, 1)}
                            className="h-7 w-7 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                          <button type="button" disabled={saving} onClick={() => removeCalculation(calc.id)}
                            className="h-7 w-7 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-500 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
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
                          placeholder="Enter a number" disabled={saving}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-[#C8A96E] placeholder-slate-400" />
                      )}
                      {calc.valueType === "quantity" && (
                        <input type="text" value={calc.quantityLabel}
                          onChange={(e) => updateCalc(calc.id, "quantityLabel", e.target.value)}
                          placeholder="label to show" disabled={saving}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-[#C8A96E] placeholder-slate-400" />
                      )}
                      {calc.valueType === "variations" && (
                        <div className="space-y-2">
                          <input type="text" value={calc.calcVariationLabel}
                            onChange={(e) => updateCalc(calc.id, "calcVariationLabel", e.target.value)}
                            placeholder="label to show" disabled={saving}
                            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-[#C8A96E] placeholder-slate-400" />
                          {calc.calcVariations.map((v) => (
                            <div key={v.id} className="flex items-center gap-2">
                              <div className="flex flex-col gap-0.5 shrink-0 opacity-40">
                                <div className="w-3 h-0.5 bg-slate-400 rounded" /><div className="w-3 h-0.5 bg-slate-400 rounded" /><div className="w-3 h-0.5 bg-slate-400 rounded" />
                              </div>
                              <input value={v.name} onChange={(e) => updateCalcVariation(calc.id, v.id, "name", e.target.value)}
                                placeholder="Variation name" disabled={saving}
                                className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-[#C8A96E] placeholder-slate-400" />
                              <input value={v.value} onChange={(e) => updateCalcVariation(calc.id, v.id, "value", e.target.value)}
                                placeholder="Value" disabled={saving}
                                className="w-24 h-9 px-3 rounded-lg border border-slate-200 text-[13px] bg-white focus:outline-none focus:border-[#C8A96E] placeholder-slate-400" />
                              <div className="relative">
                                <button type="button" disabled={saving}
                                  onClick={(e) => toggleActionsDropdown(v.id, e)}
                                  className="flex items-center gap-1 h-9 px-2 text-[#1a6b3c] font-medium text-[12px] hover:opacity-80">
                                  Actions <span className="text-slate-400">⋮</span>
                                </button>
                                {openActionsDropdown === v.id && (
                                  <div className="absolute z-50 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]" onClick={e => e.stopPropagation()}>
                                    <button type="button" onClick={() => { removeCalcVariation(calc.id, v.id); setOpenActionsDropdown(null); }}
                                      className="w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50">Delete</button>
                                    <button type="button" onClick={() => { moveCalcVariation(calc.id, v.id, 1); setOpenActionsDropdown(null); }}
                                      className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a6b3c] hover:bg-slate-50">Move down</button>
                                    <button type="button" onClick={() => { moveCalcVariation(calc.id, v.id, "bottom"); setOpenActionsDropdown(null); }}
                                      className="w-full text-left px-3 py-1.5 text-[12px] text-[#1a6b3c] hover:bg-slate-50">Move to bottom</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          <button type="button" disabled={saving} onClick={() => addCalcVariation(calc.id)}
                            className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600 border border-slate-300 rounded-full px-3 py-1 hover:bg-slate-50 transition-colors">
                            Add Variation
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {calculations.length < 5 && (
                    <button type="button" disabled={saving} onClick={addCalculation}
                      className="flex items-center gap-1.5 text-[12px] font-medium border border-slate-300 rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add Calculation
                    </button>
                  )}
                </div>
              )}
            </div>}

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
                      placeholder="0.00"
                      className="flex-1 px-3 text-[13px] text-slate-800 focus:outline-none bg-white placeholder-slate-400" />
                  </div>
                )}
              </div>
            )}

            {/* Active toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div>
                <p className="text-[13px] font-medium text-slate-800">Active</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Show this service in proposals</p>
              </div>
              <button type="button" onClick={() => setIsActive(!isActive)} disabled={saving}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  isActive ? "bg-emerald-500" : "bg-slate-300")}>
                <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  isActive ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving}
              className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
              style={{ background: ACCENT }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Changes"}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
