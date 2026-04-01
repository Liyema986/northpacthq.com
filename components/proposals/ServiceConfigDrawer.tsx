"use client";

import { toast } from "sonner";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Layers,
  Settings2,
  Users,
  Wallet,
  X,
  ChevronDown,
  Clock,
} from "lucide-react";
import type {
  ProposalItem,
  ProposalBuilderEntity,
  BillingCategory,
  PricingMethod,
  EntityPricingMode,
  Frequency,
} from "@/types";
import { CATEGORY_LABELS, PRICING_METHOD_LABELS } from "@/types";
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
import { Separator } from "@/components/ui/separator";
import {
  calculateServiceHours,
  formatCurrency,
  formatHoursMinutesClock,
  getDerivedMinutesLabel,
  normalizeFixedTimeEstimate,
  pricingMethodUsesHourlyQuantity,
  pricingMethodUsesMinutesPerUnit,
} from "@/lib/service-metrics";
import {
  getAssignedEntityNames,
  getItemTotalHours,
  getItemTotalPrice,
  resolveAssignedEntityIds,
} from "@/lib/proposal-entities";
import { cn } from "@/lib/utils";

const ACCENT = "#C8A96E";

export interface ServicePricingOption {
  label: string;
  price: number;
}

interface ServiceConfigDrawerProps {
  item: ProposalItem | null;
  entities: ProposalBuilderEntity[];
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<ProposalItem>) => void;
  /** Pre-configured pricing options from the service template (variations, tiers, or fixed price) */
  pricingOptions?: ServicePricingOption[];
}

const deliveryOptions: Frequency[] = [
  "monthly", "bi_monthly", "quarterly", "semi_annually",
  "annually", "once_off", "on_demand",
];

const entityPricingModeLabels: Record<EntityPricingMode, string> = {
  single_price:           "Single price regardless of entities",
  price_per_entity:       "Price per selected entity",
  custom_price_by_entity: "Custom price by entity",
};

function humanizeFrequency(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const fieldInput =
  "w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white";
const fieldTextarea =
  "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white resize-none";
const selectTrigger =
  "h-10 w-full rounded-lg border border-slate-200 bg-white text-[13px] font-normal text-left";

export function ServiceConfigDrawer({
  item, entities, open, onClose, onUpdate, pricingOptions = [],
}: ServiceConfigDrawerProps) {
  if (!item) return null;

  const handleChange = (
    field: keyof ProposalItem,
    value: string | number | boolean | string[] | Record<string, number>
  ) => {
    onUpdate(item.id, { [field]: value });
  };

  const selectedEntityIds = resolveAssignedEntityIds(item, entities);
  const selectedNames = getAssignedEntityNames(item, entities);
  const totalValue = getItemTotalPrice(item, entities);
  const totalHours = getItemTotalHours(item, entities);
  const baseHours  = calculateServiceHours(normalizeFixedTimeEstimate(item));
  const effectiveRate = totalHours > 0 ? totalValue / totalHours : 0;

  const usesMinutes = pricingMethodUsesMinutesPerUnit(item.pricingMethod);
  const usesHourly  = pricingMethodUsesHourlyQuantity(item.pricingMethod);

  function handleDone() {
    if (!item) return;
    const errors: string[] = [];

    if (!item.name.trim()) {
      errors.push("Service name cannot be empty");
    }
    if (!usesHourly && item.unitPrice === 0 && !item.isOptional) {
      errors.push(`"${item.name || "This service"}" has a R0.00 price — set a price before continuing`);
    }

    if (errors.length > 0) {
      errors.forEach((err) => toast.error(err));
      return;
    }
    onClose();
  }

  const toggleEntity = (entityId: string) => {
    const current = item.entityAssignmentMode === "all_entities"
      ? entities.map((e) => e.id)
      : selectedEntityIds;
    const next = current.includes(entityId)
      ? current.filter((id) => id !== entityId)
      : [...current, entityId];

    handleChange("entityAssignmentMode", "selected_entities");
    handleChange("assignedEntityIds", next.length > 0 ? next : entities[0] ? [entities[0].id] : []);
  };

  const updateCustomPrice = (entityId: string, value: number) => {
    handleChange("customEntityPrices", {
      ...(item.customEntityPrices ?? {}),
      [entityId]: Math.max(value, 0),
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        hideClose
        className="w-full sm:max-w-none sm:w-[520px] md:w-[560px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">Configure Service</SheetTitle>
        <div className="flex flex-col h-full max-h-[100dvh]">
          {/* Header — matches Add Service sheet */}
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0"
                  style={{ background: `${ACCENT}14` }}
                >
                  <Settings2 className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">Configure Service</h2>
                  <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                    Assign to entities, set pricing, timing, and scope.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <ConfigSection
              icon={FileText}
              title="Service details"
              hint="Name and description as they should appear on the proposal."
            >
              <div className="space-y-1.5">
                <Label className="text-[13px]">Service name</Label>
                <input
                  className={fieldInput}
                  value={item.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Service name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Description</Label>
                <textarea
                  className={cn(fieldTextarea, "min-h-[72px]")}
                  rows={3}
                  value={item.description ?? ""}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Short description for the client"
                />
              </div>
            </ConfigSection>

            <ConfigSection
              icon={Wallet}
              title="Billing & pricing"
              hint="How this line is billed and calculated."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Billing type</Label>
                  <Select
                    value={item.billingCategory}
                    onValueChange={(v) => handleChange("billingCategory", v as BillingCategory)}
                  >
                    <SelectTrigger className={selectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] max-h-[min(60vh,320px)]">
                      {(Object.keys(CATEGORY_LABELS) as BillingCategory[]).map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-[13px]">
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {pricingOptions.length > 1 ? (
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Pricing option</Label>
                    <Select
                      value={pricingOptions.find((o) => o.price === item.unitPrice)?.label ?? ""}
                      onValueChange={(v) => {
                        const opt = pricingOptions.find((o) => o.label === v);
                        if (opt) handleChange("unitPrice", opt.price);
                      }}
                    >
                      <SelectTrigger className={selectTrigger}>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent className="z-[100] max-h-[min(60vh,360px)]">
                        {pricingOptions.map((opt) => (
                          <SelectItem key={opt.label} value={opt.label} className="text-[13px]">
                            {opt.label} — {formatCurrency(opt.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Unit price (R)</Label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={fieldInput}
                      value={item.unitPrice || ""}
                      onChange={(e) => handleChange("unitPrice", Number(e.target.value))}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              {/* Time estimates */}
              {usesMinutes ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">
                      {getDerivedMinutesLabel(item.pricingMethod, item.pricingDriver ?? "")}
                    </Label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      className={fieldInput}
                      value={item.timeInputMinutes || ""}
                      onChange={(e) => handleChange("timeInputMinutes", Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Base estimate = {item.quantity ?? 0} × {item.timeInputMinutes ?? 0} minutes ÷ 60.
                  </p>
                </div>
              ) : usesHourly ? (
                <p className="text-[12px] text-slate-500 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  Base estimate = {item.quantity ?? 0} hours (quantity drives hourly pricing).
                </p>
              ) : (
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 space-y-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 mr-1.5">
                      Formula
                    </span>
                    Total minutes = hours × 60. Editing hours or minutes updates the other so both stay in sync.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
                    <div className="space-y-1.5">
                      <Label className="text-[13px]">Estimated hours</Label>
                      <input
                        type="number"
                        min={0}
                        step="0.25"
                        className={fieldInput}
                        value={item.timeInputHours || ""}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const hours = Number.isFinite(v) ? Math.max(0, v) : 0;
                          onUpdate(item.id, {
                            timeInputHours: hours,
                            timeInputMinutes: Math.round(hours * 60),
                          });
                        }}
                        placeholder="0"
                      />
                    </div>
                    <span className="hidden sm:block pb-2.5 text-center text-muted-foreground text-lg font-medium">
                      =
                    </span>
                    <div className="space-y-1.5">
                      <Label className="text-[13px]">Total minutes</Label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={fieldInput}
                        value={item.timeInputMinutes || ""}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const mins = Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
                          onUpdate(item.id, {
                            timeInputMinutes: mins,
                            timeInputHours: mins / 60,
                          });
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Separator className="bg-slate-100" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Discount (%)</Label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={fieldInput}
                    value={item.discount || ""}
                    onChange={(e) => handleChange("discount", Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Tax rate (%)</Label>
                  <input
                    type="number"
                    min={0}
                    className={fieldInput}
                    value={item.taxRate || ""}
                    onChange={(e) => handleChange("taxRate", Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>
            </ConfigSection>

            <ConfigSection
              icon={Users}
              title="Entities"
              hint="Choose which legal entities this service applies to."
            >
              {entities.length === 0 ? (
                <p className="text-[13px] text-slate-500 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                  Add entities in the proposal builder first, then assign this service.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(["all_entities", "selected_entities"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          handleChange("entityAssignmentMode", mode);
                          if (mode === "selected_entities" && selectedEntityIds.length === 0 && entities[0]) {
                            handleChange("assignedEntityIds", [entities[0].id]);
                          }
                        }}
                        className={cn(
                          "rounded-lg px-3 py-2 text-[12px] font-medium transition-colors border",
                          (item.entityAssignmentMode ?? "all_entities") === mode
                            ? "border-[#C8A96E] bg-[#C8A96E]/10 text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {mode === "all_entities" ? "All entities" : "Selected entities"}
                      </button>
                    ))}
                  </div>

                  {(item.entityAssignmentMode ?? "all_entities") === "selected_entities" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800",
                            "hover:border-slate-300 transition-colors"
                          )}
                        >
                          <span className="truncate text-left">
                            {selectedNames.length > 0 ? selectedNames.join(", ") : "Choose entities…"}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(100vw-2rem,320px)] p-2 z-[110]" align="start">
                        <div className="max-h-56 overflow-y-auto space-y-0.5">
                          {entities.map((entity) => (
                            <label
                              key={entity.id}
                              className="flex items-center gap-3 rounded-md px-2 py-2 text-[13px] hover:bg-slate-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedEntityIds.includes(entity.id)}
                                onChange={() => toggleEntity(entity.id)}
                                className="h-4 w-4 rounded border-slate-300 text-[#C8A96E] focus:ring-[#C8A96E]"
                              />
                              <span className="text-slate-800">{entity.name || "Untitled entity"}</span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {((item.entityAssignmentMode ?? "all_entities") === "all_entities"
                      ? entities.map((e) => e.name)
                      : selectedNames
                    ).map((name, i) => (
                      <span
                        key={`${name}-${i}`}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                      >
                        {name || "—"}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Entity pricing mode</Label>
                    <Select
                      value={item.entityPricingMode}
                      onValueChange={(v) => {
                        const mode = v as EntityPricingMode;
                        if (mode === "custom_price_by_entity") {
                          onUpdate(item.id, {
                            entityPricingMode:  mode,
                            customEntityPrices: {},
                          });
                        } else {
                          handleChange("entityPricingMode", mode);
                        }
                      }}
                    >
                      <SelectTrigger className={selectTrigger}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {(Object.keys(entityPricingModeLabels) as EntityPricingMode[]).map((m) => (
                          <SelectItem key={m} value={m} className="text-[13px]">
                            {entityPricingModeLabels[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {item.entityPricingMode === "custom_price_by_entity" && entities.length > 0 && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                      <p className="text-[12px] font-medium text-slate-800">
                        Custom amount per entity
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Enter the fee for each entity below. Amounts you leave blank split the base
                        subtotal evenly. Adjust quantity/unit price above first if those drive the
                        calculation.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedEntityIds.map((eid, ei) => {
                          const entity = entities.find((e) => e.id === eid);
                          if (!entity) return null;
                          return (
                            <div key={`${eid}-${ei}`} className="space-y-1.5">
                              <Label className="text-[12px] text-slate-600">{entity.name || "Entity"}</Label>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className={fieldInput}
                                value={(item.customEntityPrices?.[eid] ?? item.subtotal) || ""}
                                onChange={(e) => updateCustomPrice(eid, Number(e.target.value))}
                                placeholder="0.00"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ConfigSection>

            <ConfigSection
              icon={Clock}
              title="Timing & scope"
              hint="When work is delivered and any extra notes."
            >
              {item.billingCategory === "yearly" && (
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Planned delivery / commitment date</Label>
                  <input
                    type="date"
                    className={fieldInput}
                    value={item.commitmentDate ?? ""}
                    onChange={(e) => handleChange("commitmentDate", e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500">
                    Used for yearly work and cash-flow planning (e.g. when financials are due).
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[13px]">Scheduled work month (work planning)</Label>
                <input
                  type="month"
                  className={fieldInput}
                  value={item.scheduledWorkMonth ?? ""}
                  onChange={(e) => handleChange("scheduledWorkMonth", e.target.value)}
                />
                <p className="text-[11px] text-slate-500">
                  Appears on Work Planning when you save the proposal (e.g. May for annual financials).
                  If empty, the firm uses proposal start / year-end settings or the current month.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[13px]">Delivery frequency</Label>
                  <Select
                    value={item.frequency ?? "monthly"}
                    onValueChange={(v) => handleChange("frequency", v as Frequency)}
                  >
                    <SelectTrigger className={selectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] max-h-[min(60vh,320px)]">
                      {deliveryOptions.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-[13px]">
                          {humanizeFrequency(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[13px]">Service delivery timing</Label>
                  <input
                    className={fieldInput}
                    value={item.duePattern ?? ""}
                    onChange={(e) => handleChange("duePattern", e.target.value)}
                    placeholder="e.g. By the 7th working day of each month"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[13px]">Notes</Label>
                  <textarea
                    className={cn(fieldTextarea, "min-h-[80px]")}
                    rows={3}
                    value={item.itemNotes ?? ""}
                    onChange={(e) => handleChange("itemNotes", e.target.value)}
                    placeholder="Internal notes, assumptions, or exclusions"
                  />
                </div>
              </div>
            </ConfigSection>

            {/* Summary metrics */}
            <div className="rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/90 to-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Summary
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricPill label="Base time" value={formatHoursMinutesClock(baseHours)} />
                <MetricPill label="Total value" value={formatCurrency(totalValue)} />
                <MetricPill label="Est. time" value={formatHoursMinutesClock(totalHours)} />
                <MetricPill
                  label="Effective rate"
                  value={effectiveRate > 0 ? formatCurrency(effectiveRate) : "—"}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90 flex items-center gap-1.5"
              style={{ background: ACCENT }}
            >
              Done
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConfigSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200"
            style={{ background: `${ACCENT}12` }}
          >
            <Icon className="h-5 w-5" style={{ color: ACCENT }} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
            {hint ? (
              <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{hint}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
