"use client";

import { toast } from "sonner";
import { useState } from "react";
import {
  Calculator,
  ChevronDown,
  ChevronRight,
  CopyCheck,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import type {
  ProposalItem,
  ProposalBuilderEntity,
  BillingCategory,
  EntityPricingMode,
  Frequency,
} from "@/types";
import { CATEGORY_LABELS } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  calculateServiceHours,
  formatCurrency,
  formatHoursMinutesClock,
  normalizeFixedTimeEstimate,
  pricingMethodUsesHourlyQuantity,
  pricingMethodUsesMinutesPerUnit,
} from "@/lib/service-metrics";
import {
  getAssignedEntityNames,
  getItemContributionForEntity,
  getItemHoursContributionForEntity,
  getItemTotalHours,
  getItemTotalPrice,
  resolveAssignedEntityIds,
} from "@/lib/proposal-entities";
import { cn } from "@/lib/utils";

const ACCENT = "#C8A96E";

export interface ServicePricingOption {
  label: string;
  price: number;
  hours?: number;
  minutes?: number;
}

export interface ServiceCalculation {
  id: string;
  operation: "add" | "multiply" | "divide" | "subtract";
  valueType?: "quantity" | "static" | "variations";
  label?: string;
  quantityFieldLabel?: string;
  staticValue?: number;
  options?: { label: string; value: number }[];
}

interface ServiceConfigDrawerProps {
  items: ProposalItem[];
  entities: ProposalBuilderEntity[];
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<ProposalItem>) => void;
  onRemoveItem?: (id: string) => void;
  pricingOptions?: ServicePricingOption[];
  calculations?: ServiceCalculation[];
}

const deliveryOptions: Frequency[] = [
  "monthly", "bi_monthly", "quarterly", "semi_annually", "annually",
];

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  bi_monthly: "Bi monthly",
  quarterly: "Quarterly",
  semi_annually: "Six monthly",
  annually: "Annually",
};

const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getDerivedMonths(startMonth: string, frequency: string): string {
  const idx = MONTHS_FULL.indexOf(startMonth);
  if (idx === -1) return "";
  const step = frequency === "bi_monthly" ? 2 : frequency === "quarterly" ? 3 : frequency === "semi_annually" ? 6 : 12;
  const result: string[] = [];
  for (let i = idx; i < 12; i += step) result.push(MONTHS_SHORT[i]);
  return result.join(", ");
}

const cellInput =
  "w-full h-8 px-2 rounded border border-slate-200 text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white tabular-nums";
const cellSelect =
  "h-8 w-full rounded border border-slate-200 bg-white text-[12px] font-normal text-left";

export function ServiceConfigDrawer({
  items, entities, open, onClose, onUpdate, onRemoveItem, pricingOptions = [], calculations = [],
}: ServiceConfigDrawerProps) {
  if (items.length === 0) return null;

  const [calcOpen, setCalcOpen] = useState(true);

  // Build a direct map: entityId → item for O(1) lookup & guaranteed independence
  const entityItemMap = new Map<string, ProposalItem>();
  for (const itm of items) {
    for (const eid of (itm.assignedEntityIds ?? [])) {
      entityItemMap.set(eid, itm);
    }
  }

  // Only show entity columns that have an item (deleted entities disappear)
  const assignedEntities = entities.filter((e) => entityItemMap.has(e.id));

  /** Get the item for a specific entity (falls back to primary) */
  const itemFor = (entityId: string): ProposalItem => {
    return entityItemMap.get(entityId) ?? items[0];
  };

  // Totals across all items
  const totalValue = items.reduce((s, itm) => s + getItemTotalPrice(itm, entities), 0);
  const totalHours = items.reduce((s, itm) => s + getItemTotalHours(itm, entities), 0);
  const effectiveRate = totalHours > 0 ? totalValue / totalHours : 0;
  const primaryItem = items[0];

  /** Apply calc change for a specific item */
  const applyCalcChange = (itemId: string, calcId: string, newVal: number) => {
    const itm = items.find((i) => i.id === itemId) ?? primaryItem;
    const ci = itm.calculationInputs ?? {};
    const nextInputs = { ...ci, [calcId]: newVal };
    let price = itm.unitPrice;
    for (const c of calculations) {
      const v = c.valueType === "static" ? (c.staticValue ?? 0) : (nextInputs[c.id] ?? null);
      if (v == null) continue;
      switch (c.operation) {
        case "multiply": price *= v; break;
        case "divide": price = v !== 0 ? price / v : price; break;
        case "add": price += v; break;
        case "subtract": price -= v; break;
      }
    }
    onUpdate(itemId, {
      calculationInputs: nextInputs,
      manualPrice: price !== itm.unitPrice ? price : undefined,
    });
  };

  /** Apply pricing option change for a specific item */
  const applyPricingOption = (itemId: string, opt: ServicePricingOption) => {
    const itm = items.find((i) => i.id === itemId) ?? primaryItem;
    const ci = itm.calculationInputs ?? {};
    let price = opt.price;
    for (const c of calculations) {
      const val = c.valueType === "static" ? (c.staticValue ?? 0) : (ci[c.id] ?? null);
      if (val == null) continue;
      switch (c.operation) {
        case "multiply": price *= val; break;
        case "divide": price = val !== 0 ? price / val : price; break;
        case "add": price += val; break;
        case "subtract": price -= val; break;
      }
    }
    onUpdate(itemId, {
      unitPrice: opt.price,
      manualPrice: price !== opt.price ? price : undefined,
      ...(opt.hours != null ? { timeInputHours: opt.hours, timeInputMinutes: Math.round(opt.hours * 60) } : {}),
    });
  };

  function handleDone() {
    const errors: string[] = [];
    if (!primaryItem.name.trim()) errors.push("Service name cannot be empty");
    for (const itm of items) {
      if (itm.unitPrice === 0 && !itm.isOptional)
        errors.push(`"${itm.name || "This service"}" has a R0.00 price on one entity`);
    }
    if (errors.length > 0) { errors.forEach((err) => toast.error(err)); return; }
    onClose();
  }

  /** Update ALL items at once (for shared fields like name) */
  const updateAll = (updates: Partial<ProposalItem>) => {
    for (const itm of items) onUpdate(itm.id, updates);
  };

  const isSingleEntity = assignedEntities.length <= 1;
  const colCount = assignedEntities.length + 2;
  const gridCols = `190px repeat(${assignedEntities.length}, minmax(130px, 1fr)) 130px`;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        hideClose
        className={cn(
          "p-0 shadow-2xl overflow-hidden flex flex-col bg-white",
          isSingleEntity
            ? "w-full sm:max-w-lg border-l border-slate-200"
            : "w-full sm:max-w-none border-l-0"
        )}
      >
        <SheetTitle className="sr-only">Configure Service</SheetTitle>
        <div className="flex flex-col h-full max-h-[100dvh]">
          {/* Header */}
          <div className="flex-shrink-0 border-b-2 border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-lg border border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <Settings2 className="h-5 w-5" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <input
                    className="text-[15px] font-semibold text-slate-900 bg-transparent border-none outline-none w-full placeholder-slate-400"
                    value={primaryItem.name}
                    onChange={(e) => updateAll({ name: e.target.value })}
                    placeholder="Service name"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {CATEGORY_LABELS[primaryItem.billingCategory]} · {assignedEntities.length} {assignedEntities.length === 1 ? "entity" : "entities"} · {formatCurrency(totalValue)}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {isSingleEntity ? (
            <SingleEntityForm
              item={primaryItem}
              onUpdate={onUpdate}
              pricingOptions={pricingOptions}
              calculations={calculations}
              applyCalcChange={applyCalcChange}
              totalValue={totalValue}
              totalHours={totalHours}
            />
          ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="overflow-x-auto show-scrollbar">
            <div className="min-w-max">
              {/* Column headers */}
              <div className="grid sticky top-0 z-10 bg-slate-50 border-b border-slate-200" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sticky left-0 z-[12] bg-slate-50">Field</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={e.id} className="px-3 py-1.5 flex items-center justify-between gap-1 border-l border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-700 truncate">{e.name || "Untitled"}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onRemoveItem) onRemoveItem(ei.id);
                          if (items.length <= 1) onClose();
                        }}
                        className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title={`Remove ${e.name || "entity"}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                <div className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 border-l-2 border-slate-200 bg-slate-100/80">
                  Total
                </div>
              </div>

              {/* ── SECTION: Pricing ── */}
              <SectionHeader label="Pricing" cols={colCount} gridCols={gridCols} />

              {/* Billing type — per entity */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 sticky left-0 z-[5] bg-white">Billing type</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={`bt-${e.id}`} className="px-3 py-2 border-l border-slate-100">
                      <Select key={`bt-sel-${e.id}`} value={ei.billingCategory} onValueChange={(v) => onUpdate(ei.id, { billingCategory: v as BillingCategory })}>
                        <SelectTrigger className={cellSelect}><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[200]">
                          {(Object.keys(CATEGORY_LABELS) as BillingCategory[]).map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-[12px]">{CATEGORY_LABELS[cat]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                <div className="px-3 py-2 border-l-2 border-slate-200 bg-slate-50/60 flex items-center justify-center">
                  <ApplyAllPopover
                    label="Billing type"
                    options={(Object.keys(CATEGORY_LABELS) as BillingCategory[]).map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] }))}
                    onApply={(v) => { for (const itm of items) onUpdate(itm.id, { billingCategory: v as BillingCategory }); }}
                  />
                </div>
              </div>

              {/* Pricing option — per entity */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 flex items-center gap-1 sticky left-0 z-[5] bg-white">
                  {pricingOptions.length > 1 ? "Pricing option" : "Unit price"}
                </div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={`po-${e.id}`} className="px-3 py-2 border-l border-slate-100">
                      {pricingOptions.length > 1 ? (
                        <Select key={`po-sel-${e.id}`}
                          value={pricingOptions.find((o) => o.price === ei.unitPrice)?.label ?? ""}
                          onValueChange={(v) => {
                            const opt = pricingOptions.find((o) => o.label === v);
                            if (opt) applyPricingOption(ei.id, opt);
                          }}
                        >
                          <SelectTrigger className={cellSelect}><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent className="z-[200]">
                            {pricingOptions.map((opt) => (
                              <SelectItem key={opt.label} value={opt.label} className="text-[12px]">
                                {opt.label} — {formatCurrency(opt.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input type="number" min={0} step="0.01" className={cellInput} value={ei.unitPrice || ""}
                          onChange={(ev) => onUpdate(ei.id, { unitPrice: Number(ev.target.value) })} placeholder="0.00" />
                      )}
                    </div>
                  );
                })}
                <div className="px-3 py-2.5 border-l-2 border-slate-200 bg-slate-50/60 text-[12px] font-semibold text-slate-800 tabular-nums flex items-center">
                  {formatCurrency(items.reduce((s, i) => s + i.unitPrice, 0))}
                </div>
              </div>

              {/* Effective price — per entity */}
              <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2 text-[12px] font-medium text-emerald-700 sticky left-0 z-[5] bg-white">Effective price</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={e.id} className="px-3 py-2 border-l border-slate-100 text-[12px] font-semibold text-emerald-600 tabular-nums">
                      {formatCurrency(getItemContributionForEntity(ei, e.id, entities))}
                    </div>
                  );
                })}
                <div className="px-3 py-2 border-l-2 border-slate-200 bg-emerald-50/60 text-[12px] font-bold text-emerald-700 tabular-nums">
                  {formatCurrency(totalValue)}
                </div>
              </div>

              {/* Calculations (expandable) */}
              {calculations.length > 0 && (
                <>
                  <div
                    className="grid border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                    style={{ gridTemplateColumns: gridCols }}
                    onClick={() => setCalcOpen(!calcOpen)}
                  >
                    <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 col-span-full">
                      {calcOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <Calculator className="h-3.5 w-3.5" />
                      Calculations
                    </div>
                  </div>
                  {calcOpen && calculations.map((calc) => {
                    const opLabel = calc.operation.charAt(0).toUpperCase() + calc.operation.slice(1);
                    const calcLabel = calc.label || calc.quantityFieldLabel || "";
                    return (
                      <div key={calc.id} className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                        <div className="px-4 py-2.5 text-[12px] text-slate-600 pl-8 sticky left-0 z-[5] bg-slate-50/40">
                          {opLabel}{calcLabel ? ` by ${calcLabel}` : ""}
                        </div>
                        {assignedEntities.map((e) => {
                          const ei = itemFor(e.id);
                          const ci = ei.calculationInputs ?? {};
                          const currentVal = ci[calc.id];
                          return (
                            <div key={e.id} className="px-3 py-2 border-l border-slate-100">
                              {calc.valueType === "variations" && calc.options && calc.options.length > 0 && (
                                <Select value={currentVal != null ? String(currentVal) : ""} onValueChange={(v) => applyCalcChange(ei.id, calc.id, Number(v))}>
                                  <SelectTrigger className={cellSelect}><SelectValue placeholder="Select" /></SelectTrigger>
                                  <SelectContent className="z-[200]">
                                    {calc.options.map((opt) => (
                                      <SelectItem key={opt.label} value={String(opt.value)} className="text-[12px]">{opt.label} — {opt.value}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {calc.valueType === "quantity" && (
                                <input type="number" min={0} step="0.01" className={cellInput} value={currentVal || ""}
                                  onChange={(ev) => {
                                    if (ev.target.value === "") { onUpdate(ei.id, { calculationInputs: { ...ci, [calc.id]: 0 }, manualPrice: undefined }); }
                                    else { applyCalcChange(ei.id, calc.id, Number(ev.target.value)); }
                                  }}
                                  placeholder={calc.quantityFieldLabel || "Value"} />
                              )}
                              {calc.valueType === "static" && calc.staticValue != null && (
                                <span className="text-[12px] text-slate-500">{calc.staticValue}</span>
                              )}
                            </div>
                          );
                        })}
                        <div className="px-3 py-2.5 border-l-2 border-slate-200 bg-slate-50/60 text-[11px] text-slate-500 flex items-center">—</div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* ── SECTION: Time Estimates ── */}
              <SectionHeader label="Time Estimates" cols={colCount} gridCols={gridCols} />

              {/* Estimated hours — per entity with calc breakdown */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 sticky left-0 z-[5] bg-white">Estimated hours</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  const ci = ei.calculationInputs ?? {};
                  const parts: string[] = [];
                  const baseH = ei.timeInputHours ?? 0;
                  let resultH = baseH;
                  for (const calc of calculations) {
                    const val = calc.valueType === "static" ? (calc.staticValue ?? 0) : (ci[calc.id] ?? null);
                    if (val == null) continue;
                    const sym = { multiply: "×", divide: "÷", add: "+", subtract: "−" } as const;
                    parts.push(`${sym[calc.operation]} ${val}`);
                    switch (calc.operation) {
                      case "multiply": resultH *= val; break;
                      case "divide": resultH = val !== 0 ? resultH / val : resultH; break;
                      case "add": resultH += val; break;
                      case "subtract": resultH -= val; break;
                    }
                  }
                  return (
                    <div key={`eh-${e.id}`} className="px-3 py-2 border-l border-slate-100">
                      <input type="number" min={0} step="0.25" className={cellInput} value={ei.timeInputHours || ""}
                        onChange={(ev) => { const v = Number(ev.target.value); const h = Number.isFinite(v) ? Math.max(0, v) : 0; onUpdate(ei.id, { timeInputHours: h, timeInputMinutes: Math.round(h * 60) }); }}
                        placeholder="0" />
                      {parts.length > 0 && baseH > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                          {baseH} {parts.join(" ")} = <span className="font-medium text-slate-600">{parseFloat(resultH.toFixed(2))} h</span>
                        </p>
                      )}
                    </div>
                  );
                })}
                <div className="px-3 py-2.5 border-l-2 border-slate-200 bg-slate-50/60 text-[12px] font-semibold text-slate-800 tabular-nums flex items-center">
                  {formatHoursMinutesClock(totalHours)}
                </div>
              </div>

              {/* Total minutes — per entity with calc breakdown */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 sticky left-0 z-[5] bg-white">Total minutes</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  const ci = ei.calculationInputs ?? {};
                  const parts: string[] = [];
                  const baseM = ei.timeInputMinutes ?? 0;
                  let resultM = baseM;
                  for (const calc of calculations) {
                    const val = calc.valueType === "static" ? (calc.staticValue ?? 0) : (ci[calc.id] ?? null);
                    if (val == null) continue;
                    const sym = { multiply: "×", divide: "÷", add: "+", subtract: "−" } as const;
                    parts.push(`${sym[calc.operation]} ${val}`);
                    switch (calc.operation) {
                      case "multiply": resultM *= val; break;
                      case "divide": resultM = val !== 0 ? resultM / val : resultM; break;
                      case "add": resultM += val; break;
                      case "subtract": resultM -= val; break;
                    }
                  }
                  return (
                    <div key={`tm-${e.id}`} className="px-3 py-2 border-l border-slate-100">
                      <input type="number" min={0} step={1} className={cellInput} value={ei.timeInputMinutes || ""}
                        onChange={(ev) => { const v = Number(ev.target.value); const m = Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0; onUpdate(ei.id, { timeInputMinutes: m, timeInputHours: m / 60 }); }}
                        placeholder="0" />
                      {parts.length > 0 && baseM > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                          {baseM} {parts.join(" ")} = <span className="font-medium text-slate-600">{Math.round(resultM)} min</span>
                        </p>
                      )}
                    </div>
                  );
                })}
                <div className="px-3 py-2.5 border-l-2 border-slate-200 bg-slate-50/60 text-[12px] font-semibold text-slate-800 tabular-nums flex items-center">
                  {items.reduce((s, i) => s + (i.timeInputMinutes ?? 0), 0)} min
                </div>
              </div>

              {/* ── SECTION: Financials ── */}
              <SectionHeader label="Discount & Tax" cols={colCount} gridCols={gridCols} />

              {/* Discount — per entity */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 sticky left-0 z-[5] bg-white">Discount (%)</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={e.id} className="px-3 py-2 border-l border-slate-100">
                      <input type="number" min={0} max={100} className={cellInput} value={ei.discount || ""}
                        onChange={(ev) => onUpdate(ei.id, { discount: Number(ev.target.value) })} placeholder="0" />
                    </div>
                  );
                })}
                <div className="px-3 py-2.5 border-l-2 border-slate-200 bg-slate-50/60 text-[12px] font-medium text-slate-600 flex items-center">—</div>
              </div>

              {/* Tax rate — per entity */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 sticky left-0 z-[5] bg-white">Tax rate (%)</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={e.id} className="px-3 py-2 border-l border-slate-100">
                      <input type="number" min={0} className={cellInput} value={ei.taxRate || ""}
                        onChange={(ev) => onUpdate(ei.id, { taxRate: Number(ev.target.value) })} placeholder="0" />
                    </div>
                  );
                })}
                <div className="px-3 py-2.5 border-l-2 border-slate-200 bg-slate-50/60 text-[12px] font-medium text-slate-600 flex items-center">—</div>
              </div>

              {/* ── SECTION: Timing & Scope ── */}
              <SectionHeader label="Timing & Scope" cols={colCount} gridCols={gridCols} />

              {/* Work planner frequency — per entity */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 sticky left-0 z-[5] bg-white">Work planner</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={`wp-${e.id}`} className="px-3 py-2 border-l border-slate-100">
                      <Select key={`wp-sel-${e.id}`} value={ei.frequency ?? "monthly"} onValueChange={(v) => onUpdate(ei.id, { frequency: v as Frequency, scheduledWorkMonth: "" })}>
                        <SelectTrigger className={cellSelect}><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[200]">
                          {deliveryOptions.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-[12px]">{FREQUENCY_LABELS[opt]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                <div className="px-3 py-2 border-l-2 border-slate-200 bg-slate-50/60 flex items-center justify-center">
                  <ApplyAllPopover
                    label="Work planner"
                    options={deliveryOptions.map((o) => ({ value: o, label: FREQUENCY_LABELS[o] }))}
                    onApply={(v) => { for (const itm of items) onUpdate(itm.id, { frequency: v as Frequency, scheduledWorkMonth: "" }); }}
                  />
                </div>
              </div>

              {/* Work planner starting month — per entity (conditional) */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] text-slate-500 pl-8 sticky left-0 z-[5] bg-white">Starting month</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  const freq = ei.frequency ?? "monthly";
                  const needsMonth = ["bi_monthly", "quarterly", "semi_annually", "annually"].includes(freq);
                  return (
                    <div key={`wpm-${e.id}`} className="px-3 py-2 border-l border-slate-100">
                      {needsMonth ? (
                        <div className="space-y-1">
                          <Select key={`wpm-sel-${e.id}`} value={ei.scheduledWorkMonth ?? ""} onValueChange={(v) => onUpdate(ei.id, { scheduledWorkMonth: v })}>
                            <SelectTrigger className={cellSelect}><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent className="z-[200]">
                              {MONTHS_FULL.map((m) => (
                                <SelectItem key={m} value={m} className="text-[12px]">{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {ei.scheduledWorkMonth && freq !== "annually" && (
                            <p className="text-[10px] text-slate-400 leading-tight">
                              {getDerivedMonths(ei.scheduledWorkMonth, freq)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </div>
                  );
                })}
                <div className="px-3 py-2 border-l-2 border-slate-200 bg-slate-50/60 flex items-center justify-center">
                  <ApplyAllPopover
                    label="Starting month"
                    options={MONTHS_FULL.map((m) => ({ value: m, label: m }))}
                    onApply={(v) => { for (const itm of items) onUpdate(itm.id, { scheduledWorkMonth: v }); }}
                  />
                </div>
              </div>

              {/* Cash flow frequency — per entity */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 sticky left-0 z-[5] bg-white">Cash flow</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  const ecf = (ei.duePattern ?? "monthly") as Frequency;
                  return (
                    <div key={`cf-${e.id}`} className="px-3 py-2 border-l border-slate-100">
                      <Select key={`cf-sel-${e.id}`} value={ecf} onValueChange={(v) => { onUpdate(ei.id, { duePattern: v }); if ((ei.commitmentDate ?? "").startsWith("cf:")) onUpdate(ei.id, { commitmentDate: "cf:" }); }}>
                        <SelectTrigger className={cellSelect}><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[200]">
                          {deliveryOptions.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-[12px]">{FREQUENCY_LABELS[opt]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                <div className="px-3 py-2 border-l-2 border-slate-200 bg-slate-50/60 flex items-center justify-center">
                  <ApplyAllPopover
                    label="Cash flow"
                    options={deliveryOptions.map((o) => ({ value: o, label: FREQUENCY_LABELS[o] }))}
                    onApply={(v) => { for (const itm of items) onUpdate(itm.id, { duePattern: v, commitmentDate: "cf:" }); }}
                  />
                </div>
              </div>

              {/* Cash flow billing month — per entity (conditional) */}
              <div className="grid border-b border-slate-100 hover:bg-slate-50/50" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] text-slate-500 pl-8 sticky left-0 z-[5] bg-white">Billing month</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  const ecf = (ei.duePattern ?? "monthly") as Frequency;
                  const ecfMonth = (ei.commitmentDate ?? "").startsWith("cf:") ? ei.commitmentDate!.slice(3) : "";
                  const needsMonth = ["bi_monthly", "quarterly", "semi_annually", "annually"].includes(ecf);
                  return (
                    <div key={`cfm-${e.id}`} className="px-3 py-2 border-l border-slate-100">
                      {needsMonth ? (
                        <div className="space-y-1">
                          <Select key={`cfm-sel-${e.id}`} value={ecfMonth} onValueChange={(v) => onUpdate(ei.id, { commitmentDate: `cf:${v}` })}>
                            <SelectTrigger className={cellSelect}><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent className="z-[200]">
                              {MONTHS_FULL.map((m) => (
                                <SelectItem key={m} value={m} className="text-[12px]">{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {ecfMonth && ecf !== "annually" && (
                            <p className="text-[10px] text-slate-400 leading-tight">
                              {getDerivedMonths(ecfMonth, ecf)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </div>
                  );
                })}
                <div className="px-3 py-2 border-l-2 border-slate-200 bg-slate-50/60 flex items-center justify-center">
                  <ApplyAllPopover
                    label="Billing month"
                    options={MONTHS_FULL.map((m) => ({ value: m, label: m }))}
                    onApply={(v) => { for (const itm of items) onUpdate(itm.id, { commitmentDate: `cf:${v}` }); }}
                  />
                </div>
              </div>

              {/* ── SECTION: Notes ── */}
              <SectionHeader label="Notes" cols={colCount} gridCols={gridCols} />

              <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-2.5 text-[12px] font-medium text-slate-700 sticky left-0 z-[5] bg-white">Notes</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={e.id} className="px-3 py-2 border-l border-slate-100">
                      <textarea
                        className="w-full px-2 py-1.5 rounded border border-slate-200 text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none min-h-[48px]"
                        rows={2}
                        value={ei.itemNotes ?? ""}
                        onChange={(ev) => onUpdate(ei.id, { itemNotes: ev.target.value })}
                        placeholder="Notes"
                      />
                    </div>
                  );
                })}
                <div className="px-3 py-2.5 border-l-2 border-slate-200 bg-slate-50/60" />
              </div>

              {/* ── Summary bar ── */}
              <div className="grid bg-slate-100/80 border-t-2 border-slate-200" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky left-0 z-[5] bg-slate-100/80">Summary</div>
                {assignedEntities.map((e) => {
                  const ei = itemFor(e.id);
                  return (
                    <div key={e.id} className="px-3 py-3 border-l border-slate-200 space-y-0.5">
                      <p className="text-[11px] font-semibold text-slate-800 tabular-nums">{formatCurrency(getItemContributionForEntity(ei, e.id, entities))}</p>
                      <p className="text-[10px] text-slate-500">{formatHoursMinutesClock(getItemHoursContributionForEntity(ei, e.id, entities))}</p>
                    </div>
                  );
                })}
                <div className="px-3 py-3 border-l-2 border-slate-300 bg-slate-200/60 space-y-0.5">
                  <p className="text-[11px] font-bold text-slate-900 tabular-nums">{formatCurrency(totalValue)}</p>
                  <p className="text-[10px] font-semibold text-slate-600">{formatHoursMinutesClock(totalHours)}</p>
                  {effectiveRate > 0 && (
                    <p className="text-[9px] text-slate-500">{formatCurrency(effectiveRate)}/h</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
          )}

          {/* Footer */}
          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-3 bg-slate-50 gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleDone} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90 flex items-center gap-1.5" style={{ background: ACCENT }}>
              Done
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Compact form layout for single entity */
function SingleEntityForm({
  item, onUpdate, pricingOptions, calculations, applyCalcChange, totalValue, totalHours,
}: {
  item: ProposalItem;
  onUpdate: (id: string, updates: Partial<ProposalItem>) => void;
  pricingOptions: ServicePricingOption[];
  calculations: ServiceCalculation[];
  applyCalcChange: (itemId: string, calcId: string, newVal: number) => void;
  totalValue: number;
  totalHours: number;
}) {
  const [calcOpen, setCalcOpen] = useState(true);
  const ci = item.calculationInputs ?? {};
  const cfFreq = (item.duePattern ?? "monthly") as Frequency;
  const cfMonth = (item.commitmentDate ?? "").startsWith("cf:") ? item.commitmentDate!.slice(3) : "";

  const inp = "w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white";
  const sel = "h-9 w-full rounded-lg border border-slate-200 bg-white text-[13px] font-normal text-left";
  const lbl = "text-[13px] font-medium text-slate-700";
  const hint = "text-[11px] text-slate-400 mt-1";

  const SectionLabel = ({ children }: { children: string }) => (
    <div className="pt-5 pb-2 border-b border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>{children}</p>
    </div>
  );

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[140px_1fr] gap-4 items-start py-2.5">
      <label className={lbl}>{label}</label>
      <div>{children}</div>
    </div>
  );

  // Effective price
  let effPrice = item.unitPrice;
  for (const calc of calculations) {
    const val = calc.valueType === "static" ? (calc.staticValue ?? 0) : (ci[calc.id] ?? null);
    if (val == null) continue;
    switch (calc.operation) {
      case "multiply": effPrice *= val; break;
      case "divide": effPrice = val !== 0 ? effPrice / val : effPrice; break;
      case "add": effPrice += val; break;
      case "subtract": effPrice -= val; break;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-2">
      <SectionLabel>Pricing</SectionLabel>
      <Row label="Billing type">
        <Select value={item.billingCategory} onValueChange={(v) => onUpdate(item.id, { billingCategory: v as BillingCategory })}>
          <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
          <SelectContent className="z-[200]">
            {(Object.keys(CATEGORY_LABELS) as BillingCategory[]).map((cat) => (
              <SelectItem key={cat} value={cat} className="text-[13px]">{CATEGORY_LABELS[cat]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label={pricingOptions.length > 1 ? "Pricing option" : "Unit price"}>
        {pricingOptions.length > 1 ? (
          <Select
            value={pricingOptions.find((o) => o.price === item.unitPrice)?.label ?? ""}
            onValueChange={(v) => {
              const opt = pricingOptions.find((o) => o.label === v);
              if (!opt) return;
              let price = opt.price;
              for (const c of calculations) {
                const val = c.valueType === "static" ? (c.staticValue ?? 0) : (ci[c.id] ?? null);
                if (val == null) continue;
                switch (c.operation) { case "multiply": price *= val; break; case "divide": price = val !== 0 ? price / val : price; break; case "add": price += val; break; case "subtract": price -= val; break; }
              }
              onUpdate(item.id, { unitPrice: opt.price, manualPrice: price !== opt.price ? price : undefined, ...(opt.hours != null ? { timeInputHours: opt.hours, timeInputMinutes: Math.round(opt.hours * 60) } : {}) });
            }}
          >
            <SelectTrigger className={sel}><SelectValue placeholder="Select option" /></SelectTrigger>
            <SelectContent className="z-[200]">
              {pricingOptions.map((opt) => (
                <SelectItem key={opt.label} value={opt.label} className="text-[13px]">{opt.label} — {formatCurrency(opt.price)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <input type="number" min={0} step="0.01" className={inp} value={item.unitPrice || ""} onChange={(e) => onUpdate(item.id, { unitPrice: Number(e.target.value) })} placeholder="0.00" />
        )}
      </Row>
      <Row label="Effective price">
        <p className="text-[14px] font-semibold text-emerald-600 py-1">{formatCurrency(effPrice)}</p>
      </Row>

      {calculations.length > 0 && (
        <>
          <button type="button" onClick={() => setCalcOpen(!calcOpen)} className="flex items-center gap-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {calcOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Calculator className="h-3.5 w-3.5" /> Calculations
          </button>
          {calcOpen && calculations.map((calc) => {
            const currentVal = ci[calc.id];
            const opLabel = calc.operation.charAt(0).toUpperCase() + calc.operation.slice(1);
            const calcLabel = calc.label || calc.quantityFieldLabel || "";
            return (
              <Row key={calc.id} label={`${opLabel}${calcLabel ? ` by ${calcLabel}` : ""}`}>
                {calc.valueType === "variations" && calc.options && calc.options.length > 0 && (
                  <Select value={currentVal != null ? String(currentVal) : ""} onValueChange={(v) => applyCalcChange(item.id, calc.id, Number(v))}>
                    <SelectTrigger className={sel}><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="z-[200]">
                      {calc.options.map((opt) => (<SelectItem key={opt.label} value={String(opt.value)} className="text-[13px]">{opt.label} — {opt.value}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
                {calc.valueType === "quantity" && (
                  <input type="number" min={0} step="0.01" className={inp} value={currentVal || ""}
                    onChange={(e) => { if (e.target.value === "") { onUpdate(item.id, { calculationInputs: { ...ci, [calc.id]: 0 }, manualPrice: undefined }); } else { applyCalcChange(item.id, calc.id, Number(e.target.value)); } }}
                    placeholder={calc.quantityFieldLabel || "Value"} />
                )}
                {calc.valueType === "static" && calc.staticValue != null && (
                  <span className="text-[13px] text-slate-600">Fixed: {calc.staticValue}</span>
                )}
              </Row>
            );
          })}
        </>
      )}

      <SectionLabel>Time Estimates</SectionLabel>
      <Row label="Estimated hours">
        <input type="number" min={0} step="0.25" className={inp} value={item.timeInputHours || ""}
          onChange={(e) => { const v = Number(e.target.value); const h = Number.isFinite(v) ? Math.max(0, v) : 0; onUpdate(item.id, { timeInputHours: h, timeInputMinutes: Math.round(h * 60) }); }} placeholder="0" />
      </Row>
      <Row label="Total minutes">
        <input type="number" min={0} step={1} className={inp} value={item.timeInputMinutes || ""}
          onChange={(e) => { const v = Number(e.target.value); const m = Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0; onUpdate(item.id, { timeInputMinutes: m, timeInputHours: m / 60 }); }} placeholder="0" />
      </Row>

      <SectionLabel>Discount & Tax</SectionLabel>
      <Row label="Discount (%)">
        <input type="number" min={0} max={100} className={inp} value={item.discount || ""} onChange={(e) => onUpdate(item.id, { discount: Number(e.target.value) })} placeholder="0" />
      </Row>
      <Row label="Tax rate (%)">
        <input type="number" min={0} className={inp} value={item.taxRate || ""} onChange={(e) => onUpdate(item.id, { taxRate: Number(e.target.value) })} placeholder="0" />
      </Row>

      <SectionLabel>Timing & Scope</SectionLabel>
      <Row label="Work planner">
        <Select value={item.frequency ?? "monthly"} onValueChange={(v) => onUpdate(item.id, { frequency: v as Frequency, scheduledWorkMonth: "" })}>
          <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
          <SelectContent className="z-[200]">
            {deliveryOptions.map((opt) => (<SelectItem key={opt} value={opt} className="text-[13px]">{FREQUENCY_LABELS[opt]}</SelectItem>))}
          </SelectContent>
        </Select>
        {["bi_monthly","quarterly","semi_annually","annually"].includes(item.frequency ?? "") && (
          <div className="mt-2">
            <Select value={item.scheduledWorkMonth ?? ""} onValueChange={(v) => onUpdate(item.id, { scheduledWorkMonth: v })}>
              <SelectTrigger className={sel}><SelectValue placeholder="Starting month" /></SelectTrigger>
              <SelectContent className="z-[200]">{MONTHS_FULL.map((m) => (<SelectItem key={m} value={m} className="text-[13px]">{m}</SelectItem>))}</SelectContent>
            </Select>
            {item.scheduledWorkMonth && item.frequency !== "annually" && (
              <p className={hint}>Scheduled: {getDerivedMonths(item.scheduledWorkMonth, item.frequency ?? "")}</p>
            )}
          </div>
        )}
      </Row>
      <Row label="Cash flow">
        <Select value={cfFreq} onValueChange={(v) => { onUpdate(item.id, { duePattern: v }); if ((item.commitmentDate ?? "").startsWith("cf:")) onUpdate(item.id, { commitmentDate: "cf:" }); }}>
          <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
          <SelectContent className="z-[200]">
            {deliveryOptions.map((opt) => (<SelectItem key={opt} value={opt} className="text-[13px]">{FREQUENCY_LABELS[opt]}</SelectItem>))}
          </SelectContent>
        </Select>
        {["bi_monthly","quarterly","semi_annually","annually"].includes(cfFreq) && (
          <div className="mt-2">
            <Select value={cfMonth} onValueChange={(v) => onUpdate(item.id, { commitmentDate: `cf:${v}` })}>
              <SelectTrigger className={sel}><SelectValue placeholder="Billing month" /></SelectTrigger>
              <SelectContent className="z-[200]">{MONTHS_FULL.map((m) => (<SelectItem key={m} value={m} className="text-[13px]">{m}</SelectItem>))}</SelectContent>
            </Select>
            {cfMonth && cfFreq !== "annually" && (
              <p className={hint}>Billing: {getDerivedMonths(cfMonth, cfFreq)}</p>
            )}
          </div>
        )}
      </Row>

      <SectionLabel>Notes</SectionLabel>
      <div className="py-2.5">
        <textarea className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none min-h-[80px]"
          rows={3} value={item.itemNotes ?? ""} onChange={(e) => onUpdate(item.id, { itemNotes: e.target.value })} placeholder="Internal notes, assumptions, or exclusions" />
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 mt-2 mb-4">
        <div className="grid grid-cols-3 divide-x divide-slate-200 text-center">
          <div className="px-2 py-1"><p className="text-[9px] font-semibold uppercase text-slate-400">Total value</p><p className="text-[13px] font-bold text-slate-800">{formatCurrency(totalValue)}</p></div>
          <div className="px-2 py-1"><p className="text-[9px] font-semibold uppercase text-slate-400">Est. time</p><p className="text-[13px] font-bold text-slate-800">{formatHoursMinutesClock(totalHours)}</p></div>
          <div className="px-2 py-1"><p className="text-[9px] font-semibold uppercase text-slate-400">Rate</p><p className="text-[13px] font-bold text-slate-800">{totalHours > 0 ? formatCurrency(totalValue / totalHours) : "—"}/h</p></div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label, cols, gridCols }: { label: string; cols: number; gridCols: string }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: gridCols }}>
      <div
        className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r from-slate-100 to-slate-50 border-y border-slate-200"
        style={{ gridColumn: `span ${cols}`, color: ACCENT }}
      >
        {label}
      </div>
    </div>
  );
}

/** Small icon button that opens a popover to apply a value to ALL entities at once. */
function ApplyAllPopover({
  label,
  options,
  onApply,
}: {
  label: string;
  options: { value: string; label: string }[];
  onApply: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-[#C8A96E] hover:bg-[#C8A96E]/10 transition-colors"
          title={`Apply ${label} to all entities`}
        >
          <CopyCheck className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2 z-[210]" align="end" side="left">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
          Apply to all
        </p>
        <div className="space-y-0.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onApply(opt.value)}
              className="w-full text-left rounded-md px-2.5 py-1.5 text-[12px] text-slate-700 hover:bg-[#C8A96E]/10 hover:text-slate-900 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
