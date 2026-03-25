"use client";

import { useMemo, useState, useEffect, type HTMLAttributes } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { ChevronDown, HelpCircle, Search, GripVertical } from "lucide-react";
import type { ServiceTemplate, BillingCategory } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/service-metrics";
import { getCategoryColor } from "@/components/sheets/AddServiceSheet";

/** Matches `listSectionsWithItems` section shape (minimal fields for UI). */
export type ServiceCatalogSection = {
  _id: string;
  name: string;
  description?: string;
  iconColor?: string;
  isPublished: boolean;
  lineItems: Array<{
    _id: string;
    name: string;
    description?: string;
    pricingType: string;
    fixedPrice?: number;
    hourlyRate?: number;
    isActive: boolean;
    sortOrder: number;
    status: string;
  }>;
};

interface ServiceLibraryProps {
  templates: ServiceTemplate[];
  sections: ServiceCatalogSection[];
  /** All section names (same order as /services) for accent colour rotation */
  sectionNames: string[];
}

const billingDot: Record<BillingCategory, { dot: string; text: string }> = {
  monthly: { dot: "bg-blue-400",   text: "text-blue-600" },
  yearly:  { dot: "bg-violet-400", text: "text-violet-600" },
  onceoff: { dot: "bg-amber-400",  text: "text-amber-600" },
};

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function priceOfLineItem(i: ServiceCatalogSection["lineItems"][0]): number {
  return i.fixedPrice ?? i.hourlyRate ?? 0;
}

function sectionPriceRange(sec: ServiceCatalogSection): { min: number; max: number } {
  const prices = sec.lineItems.map(priceOfLineItem).filter((p) => p > 0);
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function sectionAccent(sec: ServiceCatalogSection, sectionNames: string[]): string {
  if (sec.iconColor?.trim()) return sec.iconColor;
  return getCategoryColor(sectionNames, sec.name);
}

function getFilteredTemplatesForSection(
  sec: ServiceCatalogSection,
  templateById: Map<string, ServiceTemplate>,
  search: string,
  filterCategory: BillingCategory | "all"
): ServiceTemplate[] {
  const q = search.toLowerCase().trim();
  const rows = [...sec.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
  const out: ServiceTemplate[] = [];
  for (const item of rows) {
    if (!item.isActive) continue;
    const t = templateById.get(String(item._id));
    if (!t) continue;
    if (filterCategory !== "all" && t.billingCategory !== filterCategory) continue;
    if (q) {
      const desc = stripHtml(item.description).toLowerCase();
      const ok =
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        desc.includes(q);
      if (!ok) continue;
    }
    out.push(t);
  }
  return out;
}

function StatusTraffic({ status }: { status: string }) {
  const k = status?.toLowerCase() ?? "";
  const cls =
    k === "complete"
      ? "bg-emerald-500"
      : k === "price-missing"
        ? "bg-red-500"
        : "bg-amber-400";
  return (
    <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", cls)} aria-hidden />
  );
}

export function ServiceLibrary({ templates, sections, sectionNames }: ServiceLibraryProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<BillingCategory | "all">("all");
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);

  const templateById = useMemo(() => {
    const m = new Map<string, ServiceTemplate>();
    for (const t of templates) {
      m.set(String(t.id), t);
    }
    return m;
  }, [templates]);

  /** Parent cards: show everything from the catalog unless user is searching or filtering by billing. */
  const filteredSections = useMemo(() => {
    const q = search.toLowerCase().trim();
    const relaxed = !q && filterCategory === "all";
    if (relaxed) return sections;

    return sections.filter((sec) => {
      const nameMatch = !q || sec.name.toLowerCase().includes(q);
      const hasMatchingItem = sec.lineItems.some((item) => {
        if (!item.isActive) return false;
        const t = templateById.get(String(item._id));
        if (!t) return false;
        if (filterCategory !== "all" && t.billingCategory !== filterCategory) return false;
        if (!q) return true;
        const desc = stripHtml(item.description).toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          desc.includes(q)
        );
      });
      if (q && nameMatch) return true;
      return hasMatchingItem;
    });
  }, [sections, search, filterCategory, templateById]);

  useEffect(() => {
    setExpandedSectionIds((prev) =>
      prev.filter((id) => filteredSections.some((s) => s._id === id))
    );
  }, [filteredSections]);

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-r border-slate-100 bg-white">
      <div className="border-b border-slate-100 p-4">
        <TooltipProvider delayDuration={200}>
          <div className="mb-3 flex items-center gap-1.5">
            <h2 className="text-[13px] font-semibold text-slate-800">Service Library</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#C8A96E]/40"
                  aria-label="How the Service Library works"
                >
                  <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="max-w-[280px] text-left text-[12px] font-normal leading-relaxed text-slate-700"
              >
                Sections match Services. Expand a section to see its line items, then drag into
                Monthly, Yearly, or Once-off.
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search sections or services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "monthly", "yearly", "onceoff"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                filterCategory === cat
                  ? "text-white"
                  : "text-slate-500 hover:bg-slate-100"
              )}
              style={filterCategory === cat ? { background: "#C8A96E" } : {}}
            >
              {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="space-y-2 p-3">
          {sections.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-slate-400">
              No service sections yet. Add sections under{" "}
              <span className="font-medium text-slate-600">Services</span>, then return here.
            </p>
          ) : filteredSections.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-slate-400">
              No sections match this search or billing filter.
              {filterCategory !== "all" && (
                <span className="mt-2 block text-[11px]">
                  Catalog services are added as Monthly for now — try <span className="font-medium text-slate-600">All</span>{" "}
                  or <span className="font-medium text-slate-600">Monthly</span>.
                </span>
              )}
            </p>
          ) : (
            filteredSections.map((sec) => {
              const catColor = sectionAccent(sec, sectionNames);
              const isOpen = expandedSectionIds.includes(sec._id);
              const items = sec.lineItems;
              const activeCount = items.filter((s) => s.isActive).length;
              const { min: minPrice, max: maxPrice } = sectionPriceRange(sec);
              const sectionTemplates = getFilteredTemplatesForSection(
                sec,
                templateById,
                search,
                filterCategory
              );

              return (
                <Collapsible
                  key={sec._id}
                  open={isOpen}
                  onOpenChange={(open) => {
                    setExpandedSectionIds((prev) => {
                      if (open) return prev.includes(sec._id) ? prev : [...prev, sec._id];
                      return prev.filter((id) => id !== sec._id);
                    });
                  }}
                >
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl border bg-white transition-colors",
                      isOpen ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full flex-col text-left outline-none transition-colors hover:bg-slate-50/80"
                      >
                        <div className="flex items-start gap-2.5 p-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
                            style={{ background: `${catColor}18`, color: catColor }}
                          >
                            {sec.name[0]?.toUpperCase() ?? "S"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold leading-tight text-slate-900">
                              {sec.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {items.length} {items.length === 1 ? "service" : "services"}
                              {items.length - activeCount > 0 && (
                                <span className="text-amber-500">
                                  {" "}
                                  · {items.length - activeCount} inactive
                                </span>
                              )}
                            </p>
                            <span
                              className={cn(
                                "mt-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                                sec.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {sec.isPublished ? "Published" : "Draft"}
                            </span>
                          </div>
                          <ChevronDown
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                              isOpen ? "rotate-180" : "rotate-0"
                            )}
                            aria-hidden
                          />
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-50 px-3 py-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {maxPrice > 0 ? (
                              <span className="text-[11px] font-semibold tabular-nums text-slate-700">
                                {minPrice === maxPrice
                                  ? formatCurrency(minPrice)
                                  : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">No prices set</span>
                            )}
                            <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                              {activeCount} active
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400" style={{ color: catColor }}>
                            {isOpen ? "Hide" : "Show"} services
                          </span>
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="overflow-hidden">
                      <div className="border-t border-slate-100 bg-slate-50/40">
                        <Droppable droppableId={`service-library-${sec._id}`} isDropDisabled>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="space-y-2 p-3"
                            >
                              {sectionTemplates.map((template, index) => {
                                const row = sec.lineItems.find((l) => l._id === template.id);
                                return (
                                  <Draggable
                                    key={template.id}
                                    draggableId={`template:${template.id}`}
                                    index={index}
                                  >
                                    {(dragProvided, dragSnapshot) => (
                                      <ServiceLibraryCard
                                        template={template}
                                        categoryName={sec.name}
                                        status={row?.status}
                                        pricingTypeLabel={row?.pricingType}
                                        innerRef={dragProvided.innerRef}
                                        draggableProps={dragProvided.draggableProps}
                                        dragHandleProps={dragProvided.dragHandleProps}
                                        isDragging={dragSnapshot.isDragging}
                                      />
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                              {sectionTemplates.length === 0 && (
                                <p className="py-4 text-center text-[11px] text-slate-400">
                                  No services match filters. Try All or clear search.
                                </p>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

const PRICING_LABELS: Record<string, string> = {
  fixed: "Fixed",
  hourly: "Hourly",
  tiered: "Tiered",
  recurring: "Recurring",
};

function ServiceLibraryCard({
  template,
  categoryName,
  status,
  pricingTypeLabel,
  innerRef,
  draggableProps,
  dragHandleProps,
  isDragging,
}: {
  template: ServiceTemplate;
  categoryName: string;
  status?: string;
  pricingTypeLabel?: string;
  innerRef: (el: HTMLDivElement | null) => void;
  draggableProps: HTMLAttributes<HTMLDivElement>;
  dragHandleProps: HTMLAttributes<HTMLButtonElement> | null | undefined;
  isDragging: boolean;
}) {
  const billing = billingDot[template.billingCategory];

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={cn(
        "w-full rounded-xl border bg-white p-3 text-left transition-all",
        isDragging
          ? "rotate-1 border-[#C8A96E] shadow-lg shadow-[#C8A96E]/10"
          : "border-slate-100 hover:border-slate-200"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            {status && <StatusTraffic status={status} />}
            <span className="truncate text-[13px] font-semibold text-slate-800">{template.name}</span>
            <button
              type="button"
              {...(dragHandleProps ?? {})}
              className="shrink-0 cursor-grab rounded p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
              aria-label={`Drag ${template.name}`}
            >
              <GripVertical className="h-3 w-3" />
            </button>
          </div>
          {template.description && (
            <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
              {template.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{categoryName}</span>
            {billing && (
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${billing.dot}`} />
                <span className={`font-medium ${billing.text}`}>
                  {CATEGORY_LABELS[template.billingCategory]}
                </span>
              </span>
            )}
            {pricingTypeLabel && (
              <span className="text-slate-400">
                {PRICING_LABELS[pricingTypeLabel] ?? pricingTypeLabel}
              </span>
            )}
            <span className="text-slate-300">drag to add</span>
          </div>
        </div>
      </div>
    </div>
  );
}
