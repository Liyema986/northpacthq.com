"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Download, X, Loader2, CheckSquare, Square, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

interface SectionTemplate {
  id: string;
  name: string;
  description: string;
  services: { name: string; billing: string; price: number }[];
}

const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: "monthly-accounting",
    name: "Monthly Accounting",
    description: "Core bookkeeping and accounting services",
    services: [
      { name: "Bank reconciliations", billing: "Monthly", price: 2500 },
      { name: "Monthly journals", billing: "Monthly", price: 1500 },
      { name: "Debtors management", billing: "Monthly", price: 2000 },
      { name: "Creditors management", billing: "Monthly", price: 2000 },
      { name: "VAT calculations and submissions", billing: "Monthly", price: 1800 },
    ],
  },
  {
    id: "tax-services",
    name: "Tax Services",
    description: "Annual and provisional tax returns",
    services: [
      { name: "Annual income tax return (individual)", billing: "Once-off", price: 3500 },
      { name: "Provisional tax return", billing: "Once-off", price: 2500 },
      { name: "Capital gains tax calculation", billing: "Once-off", price: 4000 },
      { name: "Tax clearance certificate", billing: "Once-off", price: 1500 },
    ],
  },
  {
    id: "secretarial-services",
    name: "Secretarial Services",
    description: "Company secretarial and compliance",
    services: [
      { name: "Annual return submission (CIPC)", billing: "Once-off", price: 1200 },
      { name: "Director changes", billing: "Once-off", price: 2500 },
      { name: "Share register maintenance", billing: "Monthly", price: 800 },
      { name: "Registered address service", billing: "Monthly", price: 500 },
    ],
  },
  {
    id: "payroll-services",
    name: "Payroll Services",
    description: "Payroll processing and compliance",
    services: [
      { name: "Monthly payroll processing", billing: "Monthly", price: 1500 },
      { name: "EMP201 submissions", billing: "Monthly", price: 800 },
      { name: "IRP5/IT3a certificates", billing: "Once-off", price: 2000 },
      { name: "UIF registration and submissions", billing: "Once-off", price: 1500 },
    ],
  },
  {
    id: "audit-assurance",
    name: "Audit & Assurance",
    description: "Financial statement audits and reviews",
    services: [
      { name: "Annual financial statement compilation", billing: "Once-off", price: 8000 },
      { name: "Independent review", billing: "Once-off", price: 12000 },
      { name: "Agreed-upon procedures", billing: "Once-off", price: 6000 },
    ],
  },
  {
    id: "advisory-services",
    name: "Advisory Services",
    description: "Business advisory and consulting",
    services: [
      { name: "Business plan preparation", billing: "Once-off", price: 15000 },
      { name: "Cash flow forecast", billing: "Once-off", price: 5000 },
      { name: "Management reporting", billing: "Monthly", price: 4500 },
      { name: "Budgeting and forecasting", billing: "Once-off", price: 6500 },
    ],
  },
];

const BILLING_MAP: Record<string, "monthly" | "yearly" | "onceoff"> = {
  Monthly: "monthly",
  Annual: "yearly",
  "Once-off": "onceoff",
};

interface ImportSectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
}

export function ImportSectionsSheet({ open, onOpenChange, userId }: ImportSectionsSheetProps) {
  const createService = useMutation(api.services.createService);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function handleClose() { onOpenChange(false); setSelected(new Set()); setExpanded(new Set()); }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === SECTION_TEMPLATES.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(SECTION_TEMPLATES.map((s) => s.id)));
    }
  }

  async function handleImport() {
    if (selected.size === 0) { toast.error("Select at least one section"); return; }
    setSaving(true);
    let imported = 0;
    try {
      for (const sectionId of selected) {
        const template = SECTION_TEMPLATES.find((s) => s.id === sectionId);
        if (!template) continue;

        for (let i = 0; i < template.services.length; i++) {
          const svc = template.services[i];
          await createService({
            userId,
            name: svc.name,
            category: template.name,
            pricingType: "fixed",
            fixedPrice: svc.price,
          });
        }
        imported++;
      }
      toast.success(`Imported ${imported} section${imported !== 1 ? "s" : ""} with services`);
      handleClose();
    } catch {
      toast.error("Failed to import sections");
    } finally {
      setSaving(false);
    }
  }

  const allSelected = selected.size === SECTION_TEMPLATES.length;
  const totalServices = SECTION_TEMPLATES.filter((s) => selected.has(s.id)).reduce((n, s) => n + s.services.length, 0);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
        <SheetTitle className="sr-only">Import Sections</SheetTitle>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: "#3b82f614" }}>
                  <Download className="h-7 w-7 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">Import Sections</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Add pre-built service sections to your catalog</p>
                </div>
              </div>
              <button onClick={handleClose} disabled={saving} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Select all row */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={toggleAll}
              disabled={saving}
              className="flex items-center gap-2 text-[13px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              {allSelected
                ? <CheckSquare className="h-4 w-4 text-[#C8A96E]" />
                : <Square className="h-4 w-4 text-slate-400" />
              }
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            {selected.size > 0 && (
              <span className="text-[11px] text-slate-500">
                {selected.size} section{selected.size !== 1 ? "s" : ""} · {totalServices} services
              </span>
            )}
          </div>

          {/* Section list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {SECTION_TEMPLATES.map((tmpl) => {
              const isSelected = selected.has(tmpl.id);
              const isExpanded = expanded.has(tmpl.id);
              return (
                <div key={tmpl.id} className={cn("transition-colors", isSelected && "bg-[#C8A96E08]")}>
                  <div className="flex items-start gap-3 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => toggleSelect(tmpl.id)}
                      disabled={saving}
                      className="mt-0.5 shrink-0"
                    >
                      {isSelected
                        ? <CheckSquare className="h-4.5 w-4.5 text-[#C8A96E]" />
                        : <Square className="h-4.5 w-4.5 text-slate-300" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-slate-800">{tmpl.name}</p>
                          <p className="text-[12px] text-slate-500 mt-0.5">{tmpl.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(tmpl.id)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{tmpl.services.length} services included</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-4 ml-7 space-y-1">
                      {tmpl.services.map((svc, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-white border border-slate-100">
                          <span className="text-[12px] text-slate-700">{svc.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-slate-400">{svc.billing}</span>
                            <span className="text-[12px] font-medium text-slate-700">R {svc.price.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button
              onClick={handleImport}
              disabled={saving || selected.size === 0}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importing…</> : `Import ${selected.size || ""} Section${selected.size !== 1 ? "s" : ""}`}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
