"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Package, X, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { INCOME_TAX_RANGE_OPTIONS } from "@/lib/proposal-entity-field-options";

const ACCENT = "#C8A96E";

const switchAccentClass =
  "data-[state=checked]:bg-[#C8A96E] data-[state=checked]:border-[#C8A96E] data-[state=unchecked]:bg-slate-200";

const TEMPLATE_OPTIONS = [
  "New Client",
  "Virtual: New Client",
  "Existing Client",
  "Virtual: Existing Client",
  "GLOSS Review™",
  "Additional Services - Mid Year",
];
const DOCUMENTS_OPTIONS = ["Proposal & Letter of Engagement", "Proposal"];
const REVENUE_OPTIONS = [
  "Not Applicable",
  "Nil",
  "Up to R1M",
  "R1M – R2,5M",
  "R2.5M – R5M",
  "R5M – R10M",
  "R10M – R18M",
  "R18M – R30M",
  "R30M – R50M",
];

const INCOME_OPTIONS = [...INCOME_TAX_RANGE_OPTIONS.map((s) => String(s))];

type CalcVar = {
  id: string;
  label?: string;
  options?: { label: string; value: number }[];
};

type CatalogLine = {
  _id: Id<"services">;
  name: string;
  isActive: boolean;
  addCalculation?: boolean;
  calculationVariations?: CalcVar[];
};

export interface CreatePackageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  userId?: Id<"users">;
  mode?: "create" | "edit";
  editPackageId?: Id<"packageTemplates">;
}

function PackageFieldSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px]">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="h-10 text-[13px] border-slate-200 bg-white rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[100] max-h-[min(60vh,320px)]">
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-[13px]">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CreatePackageSheet({
  open,
  onOpenChange,
  onSuccess,
  userId,
  mode = "create",
  editPackageId,
}: CreatePackageSheetProps) {
  const createMutation = useMutation(api.packageTemplates.create);
  const updateMutation = useMutation(api.packageTemplates.update);
  const catalogSections = useQuery(api.lineItems.listSectionsWithItems, userId ? { userId } : "skip");
  const existingPackage = useQuery(
    api.packageTemplates.get,
    userId && mode === "edit" && editPackageId && open
      ? { userId, packageId: editPackageId }
      : "skip"
  );

  const [name, setName] = useState("");
  const [template, setTemplate] = useState(TEMPLATE_OPTIONS[0]);
  const [documents, setDocuments] = useState(DOCUMENTS_OPTIONS[0]);
  const [revenueRange, setRevenueRange] = useState(REVENUE_OPTIONS[0]);
  const [incomeTaxRange, setIncomeTaxRange] = useState(INCOME_OPTIONS[0]);
  const [addProjectName, setAddProjectName] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set());
  const [serviceSettings, setServiceSettings] = useState<Record<string, Record<string, string>>>({});
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  const serviceById = useMemo(() => {
    const m = new Map<string, CatalogLine>();
    for (const sec of catalogSections ?? []) {
      for (const line of sec.lineItems) {
        m.set(String(line._id), line as CatalogLine);
      }
    }
    return m;
  }, [catalogSections]);

  const resetForm = useCallback(() => {
    setName("");
    setTemplate(TEMPLATE_OPTIONS[0]);
    setDocuments(DOCUMENTS_OPTIONS[0]);
    setRevenueRange(REVENUE_OPTIONS[0]);
    setIncomeTaxRange(INCOME_OPTIONS[0]);
    setAddProjectName(false);
    setSelectedServiceIds(new Set());
    setExpandedSectionIds(new Set());
    setServiceSettings({});
    setNameError("");
  }, []);

  function handleClose() {
    onOpenChange(false);
    resetForm();
  }

  useEffect(() => {
    if (!open) return;
    if (mode === "create") resetForm();
  }, [open, mode, resetForm]);

  useEffect(() => {
    if (!open || mode !== "edit" || !existingPackage) return;
    setName(existingPackage.name);
    setTemplate(existingPackage.template);
    setDocuments(existingPackage.documentsToSend);
    setRevenueRange(existingPackage.annualRevenueRange);
    setIncomeTaxRange(
      INCOME_OPTIONS.includes(existingPackage.incomeTaxRange) ? existingPackage.incomeTaxRange : INCOME_OPTIONS[0]
    );
    setAddProjectName(existingPackage.addProjectName);
    setSelectedServiceIds(new Set(existingPackage.includedServiceIds.map(String)));
    setServiceSettings(
      existingPackage.includedServiceSettings && Object.keys(existingPackage.includedServiceSettings).length > 0
        ? { ...existingPackage.includedServiceSettings }
        : {}
    );
  }, [open, mode, existingPackage]);

  function toggleService(id: string) {
    setSelectedServiceIds((prevSel) => {
      const wasOn = prevSel.has(id);
      const n = new Set(prevSel);
      if (wasOn) n.delete(id);
      else n.add(id);
      queueMicrotask(() => {
        setServiceSettings((prevS) => {
          const next = { ...prevS };
          if (wasOn) {
            delete next[id];
          } else {
            const line = serviceById.get(id);
            if (line?.addCalculation && line.calculationVariations?.length) {
              const cur: Record<string, string> = { ...(prevS[id] ?? {}) };
              for (const v of line.calculationVariations!) {
                if (!v.options?.length) continue;
                if (cur[v.id] == null) cur[v.id] = v.options[0]!.label;
              }
              next[id] = cur;
            }
          }
          return next;
        });
      });
      return n;
    });
  }

  function setSectionExpanded(sectionId: string, open: boolean) {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(sectionId);
      else next.delete(sectionId);
      return next;
    });
  }

  function toggleAllInSection(lineIds: string[], checked: boolean) {
    setSelectedServiceIds((prev) => {
      const n = new Set(prev);
      for (const id of lineIds) {
        if (checked) n.add(id);
        else n.delete(id);
      }
      return n;
    });
    setServiceSettings((prevS) => {
      const next = { ...prevS };
      for (const id of lineIds) {
        if (!checked) {
          delete next[id];
        } else {
          const line = serviceById.get(id);
          if (line?.addCalculation && line.calculationVariations?.length) {
            const cur: Record<string, string> = { ...(prevS[id] ?? {}) };
            for (const v of line.calculationVariations!) {
              if (!v.options?.length) continue;
              if (cur[v.id] == null) cur[v.id] = v.options[0]!.label;
            }
            next[id] = cur;
          }
        }
      }
      return next;
    });
  }

  function setVariation(serviceId: string, variationId: string, label: string) {
    setServiceSettings((prev) => ({
      ...prev,
      [serviceId]: { ...(prev[serviceId] ?? {}), [variationId]: label },
    }));
  }

  const selectedWithCalc = useMemo(() => {
    const out: { id: string; line: CatalogLine }[] = [];
    for (const sid of selectedServiceIds) {
      const line = serviceById.get(sid);
      if (!line?.addCalculation || !line.calculationVariations?.length) continue;
      out.push({ id: sid, line });
    }
    return out;
  }, [selectedServiceIds, serviceById]);

  const buildSettingsPayload = (): Record<string, Record<string, string>> | undefined => {
    const cleaned: Record<string, Record<string, string>> = {};
    for (const sid of selectedServiceIds) {
      const s = serviceSettings[sid];
      if (s && Object.keys(s).length > 0) cleaned[sid] = s;
    }
    return Object.keys(cleaned).length ? cleaned : undefined;
  };

  async function handleSave() {
    if (!name.trim()) {
      setNameError("Package name is required");
      return;
    }
    if (name.trim().length < 2) {
      setNameError("Package name must be at least 2 characters");
      return;
    }
    if (!userId) {
      toast.error("Not authenticated");
      return;
    }
    if (selectedServiceIds.size === 0) {
      toast.error("Select at least one service to include in this package");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        template,
        documentsToSend: documents,
        annualRevenueRange: revenueRange,
        incomeTaxRange,
        addProjectName,
        includedServiceIds: [...selectedServiceIds] as Id<"services">[],
        includedServiceSettings: buildSettingsPayload() ?? {},
      };
      if (mode === "edit" && editPackageId) {
        await updateMutation({
          userId,
          packageId: editPackageId,
          ...payload,
        });
        toast.success(`Package "${name.trim()}" updated`);
      } else {
        await createMutation({
          userId,
          ...payload,
        });
        toast.success(`Package "${name.trim()}" created`);
      }
      handleClose();
      onSuccess?.();
    } catch {
      toast.error(mode === "edit" ? "Failed to update package" : "Failed to create package");
    } finally {
      setSaving(false);
    }
  }

  const loadingCatalog = catalogSections === undefined;
  const loadingEdit = mode === "edit" && open && editPackageId && existingPackage === undefined;
  const missingEdit = mode === "edit" && open && editPackageId && existingPackage === null;

  const title = mode === "edit" ? "Edit package" : "Create Package";
  const subtitle =
    mode === "edit" ? "Update package settings and catalogue line items" : "Build a package from your service catalogue";

  if (loadingEdit) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <SheetContent
          side="right"
          hideClose
          className="w-full sm:max-w-none sm:w-[520px] p-0 flex flex-col items-center justify-center min-h-[200px]"
        >
          <SheetTitle className="sr-only">Loading package</SheetTitle>
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500 mt-3">Loading package…</p>
        </SheetContent>
      </Sheet>
    );
  }

  if (missingEdit) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[520px] p-6">
          <SheetTitle className="sr-only">Package not found</SheetTitle>
          <p className="text-sm text-slate-700">This package could not be found.</p>
          <button type="button" className="mt-4 text-sm font-medium text-[#C8A96E]" onClick={handleClose}>
            Close
          </button>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right"
        hideClose
        className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0"
                  style={{ background: `${ACCENT}14` }}
                >
                  <Package className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">{title}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <section className="space-y-4">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Package Information
              </h3>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-name" className="text-[13px]">
                  Package Name
                </Label>
                <input
                  id="pkg-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  placeholder="e.g. GROWING BUSINESS – Making money last..."
                  className={cn(
                    "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                    nameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                  )}
                />
                {nameError && <p className="text-[11px] text-red-600">{nameError}</p>}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Basic Information
              </h3>
              <PackageFieldSelect
                id="pkg-template"
                label="Template"
                value={template}
                onChange={setTemplate}
                options={TEMPLATE_OPTIONS}
                disabled={saving}
              />
              <PackageFieldSelect
                id="pkg-docs"
                label="Which documents would you like to send?"
                value={documents}
                onChange={setDocuments}
                options={DOCUMENTS_OPTIONS}
                disabled={saving}
              />
              <PackageFieldSelect
                id="pkg-revenue"
                label="Annual Revenue Range"
                value={revenueRange}
                onChange={setRevenueRange}
                options={REVENUE_OPTIONS}
                disabled={saving}
              />
              <PackageFieldSelect
                id="pkg-income-tax"
                label="Income tax class (range)"
                value={incomeTaxRange}
                onChange={setIncomeTaxRange}
                options={INCOME_OPTIONS}
                disabled={saving}
              />

              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#243E63]">Add Project Name</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Include project name on the proposal cover
                  </p>
                </div>
                <Switch
                  checked={addProjectName}
                  onCheckedChange={setAddProjectName}
                  disabled={saving}
                  className={cn(switchAccentClass)}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Services
              </h3>

              {loadingCatalog ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-[52px] rounded-xl border border-slate-200 bg-slate-50 animate-pulse"
                    />
                  ))}
                </div>
              ) : !catalogSections || catalogSections.length === 0 ? (
                <p className="text-[12px] text-slate-400 leading-relaxed">
                  No sections yet. Add sections and line items under{" "}
                  <span className="font-medium text-slate-600">Services</span> first.
                </p>
              ) : (
                <div className="space-y-2">
                  {catalogSections.map((section) => {
                    const lines = section.lineItems.filter((l) => l.isActive);
                    const lineIds = lines.map((l) => l._id as string);
                    const isExpanded = expandedSectionIds.has(section._id);
                    const allIncluded =
                      lineIds.length > 0 && lineIds.every((id) => selectedServiceIds.has(id));

                    return (
                      <Collapsible
                        key={section._id}
                        open={isExpanded}
                        onOpenChange={(o) => setSectionExpanded(section._id, o)}
                      >
                        <div
                          className={cn(
                            "rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden transition-shadow",
                            isExpanded && "ring-1 ring-slate-200/80 shadow-md"
                          )}
                        >
                          <div className="flex items-center bg-slate-50/90 hover:bg-slate-100/70 transition-colors">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex flex-1 min-w-0 items-center gap-2 px-4 py-3.5 text-left rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A96E]/35"
                              >
                                <span className="text-[13px] font-semibold text-[#243E63] truncate">
                                  {section.name}
                                </span>
                              </button>
                            </CollapsibleTrigger>
                            <div
                              className="flex items-center gap-2 shrink-0 pr-2 py-3.5"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                                All
                              </span>
                              <Switch
                                checked={allIncluded && lineIds.length > 0}
                                disabled={saving || lineIds.length === 0}
                                onCheckedChange={(v) => toggleAllInSection(lineIds, v)}
                                className={cn(switchAccentClass)}
                              />
                            </div>
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex h-full items-center px-3 py-3.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/40 transition-colors rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A96E]/35"
                                aria-label={isExpanded ? "Collapse section" : "Expand section"}
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform duration-200",
                                    isExpanded && "-rotate-180"
                                  )}
                                />
                              </button>
                            </CollapsibleTrigger>
                          </div>

                          <CollapsibleContent className="overflow-hidden">
                            <div className="border-t border-slate-100 bg-white px-4 py-3 space-y-0.5">
                              {lines.length === 0 ? (
                                <p className="text-[12px] text-slate-400 py-1">
                                  No active line items in this section.
                                </p>
                              ) : (
                                lines.map((svc) => (
                                  <label
                                    key={svc._id}
                                    className="flex items-start gap-3 cursor-pointer rounded-lg py-2 px-2 -mx-2 hover:bg-slate-50 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedServiceIds.has(svc._id)}
                                      onChange={() => toggleService(svc._id)}
                                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/40 focus:ring-offset-0"
                                    />
                                    <span className="text-[13px] text-slate-700 leading-snug">
                                      {svc.name}
                                    </span>
                                  </label>
                                ))
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </section>

            {selectedWithCalc.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Calculation defaults (selected services)
                </h3>
                <p className="text-[11px] text-slate-500">Stored per line item for proposals that use this package.</p>
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                  {selectedWithCalc.map(({ id, line }) => (
                    <div key={id} className="space-y-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <p className="text-[12px] font-semibold text-slate-800">{line.name}</p>
                      {line.calculationVariations?.map((cv) => {
                        const opts = cv.options?.map((o) => o.label) ?? [];
                        const val = serviceSettings[id]?.[cv.id] ?? opts[0] ?? "";
                        return (
                          <div key={cv.id} className="space-y-1">
                            <Label className="text-[11px] text-slate-600">
                              {cv.label ?? "Option"}
                            </Label>
                            {opts.length > 0 ? (
                              <Select
                                value={val}
                                onValueChange={(v) => setVariation(id, cv.id, v)}
                                disabled={saving}
                              >
                                <SelectTrigger className="h-9 text-[12px] border-slate-200 bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {opts.map((o) => (
                                    <SelectItem key={o} value={o} className="text-[12px]">
                                      {o}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-[11px] text-slate-400">No options configured</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
              style={{ background: ACCENT }}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : mode === "edit" ? (
                "Save changes"
              ) : (
                "Save Package"
              )}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
