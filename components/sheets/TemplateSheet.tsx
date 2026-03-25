"use client";

import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

const PROPOSAL_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "virtual", label: "Virtual" },
  { value: "existing", label: "Existing Client" },
];

const DOCUMENTS_OPTIONS = [
  "Proposal & Letter of Engagement",
  "Proposal",
  "Letter of Engagement only",
];

/** Matches `proposalTemplates.serviceType` + filters on /templates */
export const TEMPLATE_SERVICE_TYPES = [
  { value: "general", label: "General" },
  { value: "audit", label: "Audit" },
  { value: "bookkeeping", label: "Bookkeeping" },
  { value: "tax", label: "Tax" },
  { value: "advisory", label: "Advisory" },
  { value: "payroll", label: "Payroll" },
  { value: "other", label: "Other" },
] as const;

export interface TemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  userId?: Id<"users">;
  mode: "create" | "edit";
  editTemplateId?: Id<"proposalTemplates">;
}

export function TemplateSheet({
  open,
  onOpenChange,
  onSuccess,
  userId,
  mode,
  editTemplateId,
}: TemplateSheetProps) {
  const createMutation = useMutation(api.templates.createTemplate);
  const updateMutation = useMutation(api.templates.updateTemplate);

  const existing = useQuery(
    api.templates.getTemplate,
    userId && mode === "edit" && editTemplateId && open
      ? { userId, templateId: editTemplateId }
      : "skip"
  );

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [serviceType, setServiceType] = useState<string>("general");
  const [minimumFee, setMinimumFee] = useState<number | "">(350);
  const [proposalType, setProposalType] = useState(PROPOSAL_TYPES[0].value);
  const [documents, setDocuments] = useState(DOCUMENTS_OPTIONS[0]);
  const [introText, setIntroText] = useState("");
  const [termsText, setTermsText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [emailDeliverability, setEmailDeliverability] = useState<"high" | "low">("high");
  const [isDefault, setIsDefault] = useState(false);
  const [sectionConfigJson, setSectionConfigJson] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setName("");
    setNameError(null);
    setDescription("");
    setServiceType("general");
    setMinimumFee(350);
    setProposalType(PROPOSAL_TYPES[0].value);
    setDocuments(DOCUMENTS_OPTIONS[0]);
    setIntroText("");
    setTermsText("");
    setFooterText("");
    setRedirectUrl("");
    setEmailDeliverability("high");
    setIsDefault(false);
    setSectionConfigJson("");
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    reset();
  }, [onOpenChange, reset]);

  /** Fresh form each time the create sheet opens (avoids leaking prior edit session state). */
  useEffect(() => {
    if (open && mode === "create") reset();
  }, [open, mode, reset]);

  useEffect(() => {
    if (!open || mode !== "edit" || !existing) return;
    setName(existing.name);
    setDescription(existing.description ?? "");
    setServiceType(existing.serviceType || "general");
    setMinimumFee(existing.minimumMonthlyFee ?? 350);
    setProposalType(existing.proposalType ?? PROPOSAL_TYPES[0].value);
    setDocuments(existing.documentsToSend ?? DOCUMENTS_OPTIONS[0]);
    setIntroText(existing.introText ?? "");
    setTermsText(existing.termsText ?? "");
    setFooterText(existing.footerText ?? "");
    setRedirectUrl(existing.redirectOnAcceptUrl ?? "");
    setEmailDeliverability(existing.emailDeliverability ?? "high");
    setIsDefault(existing.isDefault ?? false);
    setSectionConfigJson(
      existing.sectionConfig ? JSON.stringify(existing.sectionConfig, null, 2) : ""
    );
  }, [open, mode, existing]);

  function parseSectionConfig(): Record<string, unknown> | undefined {
    const t = sectionConfigJson.trim();
    if (!t) return undefined;
    try {
      const o = JSON.parse(t) as unknown;
      if (o !== null && typeof o === "object" && !Array.isArray(o)) return o as Record<string, unknown>;
      toast.error("Section config must be a JSON object");
      return undefined;
    } catch {
      toast.error("Invalid JSON in section config");
      return undefined;
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError("Template name is required");
      return;
    }
    if (!userId) {
      toast.error("Not authenticated");
      return;
    }
    const sectionConfig = parseSectionConfig();
    if (sectionConfigJson.trim() && sectionConfig === undefined) return;

    setSaving(true);
    try {
      const common = {
        name: name.trim(),
        description: description.trim() || undefined,
        serviceType,
        introText: introText || "",
        termsText: termsText || "",
        footerText: footerText.trim() || undefined,
        minimumMonthlyFee: typeof minimumFee === "number" ? minimumFee : 350,
        proposalType,
        documentsToSend: documents,
        redirectOnAcceptUrl: redirectUrl.trim() || undefined,
        emailDeliverability,
        ...(sectionConfig !== undefined
          ? {
              sectionConfig:
                sectionConfig as NonNullable<Doc<"proposalTemplates">["sectionConfig"]>,
            }
          : {}),
      };

      if (mode === "create") {
        await createMutation({
          userId,
          ...common,
          isDefault,
        });
        toast.success(`Template "${name.trim()}" created`);
      } else if (editTemplateId) {
        await updateMutation({
          userId,
          templateId: editTemplateId,
          ...common,
          isDefault,
        });
        toast.success(`Template "${name.trim()}" updated`);
      }
      handleClose();
      onSuccess?.();
    } catch {
      toast.error(mode === "create" ? "Failed to create template" : "Failed to update template");
    } finally {
      setSaving(false);
    }
  }

  const loadingEdit = mode === "edit" && open && editTemplateId && existing === undefined;
  const missingEdit = mode === "edit" && open && editTemplateId && existing === null;
  const title = mode === "create" ? "Create New Template" : "Edit Template";
  const sheetTitle = mode === "create" ? "Create New Template" : "Edit Template";

  if (loadingEdit) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <SheetContent
          side="right"
          hideClose
          className="w-full sm:max-w-none sm:w-[600px] p-0 flex flex-col items-center justify-center min-h-[200px]"
        >
          <SheetTitle className="sr-only">{sheetTitle}</SheetTitle>
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500 mt-3">Loading template…</p>
        </SheetContent>
      </Sheet>
    );
  }

  if (missingEdit) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[600px] p-6">
          <SheetTitle className="sr-only">{sheetTitle}</SheetTitle>
          <p className="text-sm text-slate-700">This template could not be found.</p>
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
        className="w-full sm:max-w-none sm:w-[600px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">{sheetTitle}</SheetTitle>
        <div className="flex flex-col h-full max-h-[100dvh]">
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0"
                  style={{ background: `${ACCENT}14` }}
                >
                  <FileText className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">{title}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Configure proposal templates for your firm</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name" className="text-[13px]">
                Template name <span className="text-red-500">*</span>
              </Label>
              <input
                id="tpl-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="e.g., New Client"
                className={cn(
                  "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                  nameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                )}
              />
              {nameError && <p className="text-[11px] text-red-600">{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc" className="text-[13px]">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <input
                id="tpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Service category</Label>
                <Select value={serviceType} onValueChange={setServiceType} disabled={saving}>
                  <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100] max-h-[min(60vh,320px)]">
                    {TEMPLATE_SERVICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-[13px]">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Email deliverability</Label>
                <Select
                  value={emailDeliverability}
                  onValueChange={(v) => setEmailDeliverability(v as "high" | "low")}
                  disabled={saving}
                >
                  <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="high" className="text-[13px]">
                      High
                    </SelectItem>
                    <SelectItem value="low" className="text-[13px]">
                      Low
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-slate-300"
              />
              Set as default for this service category
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Minimum monthly fee (ZAR)</Label>
                <input
                  type="number"
                  min={0}
                  value={minimumFee === "" ? "" : minimumFee}
                  onChange={(e) => setMinimumFee(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Proposal type</Label>
                <Select value={proposalType} onValueChange={setProposalType} disabled={saving}>
                  <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {PROPOSAL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-[13px]">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Documents to send</Label>
              <Select value={documents} onValueChange={setDocuments} disabled={saving}>
                <SelectTrigger className="h-10 text-[13px] border-slate-200 bg-white rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {DOCUMENTS_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o} className="text-[13px]">
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Redirect after accept URL</Label>
              <input
                type="url"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://…"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Introduction</Label>
              <textarea
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 resize-none focus:outline-none focus:border-[#C8A96E] bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Terms &amp; conditions</Label>
              <textarea
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 resize-none focus:outline-none focus:border-[#C8A96E] bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Footer text</Label>
              <textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={2}
                placeholder="Optional footer line for proposals using this template"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-800 resize-none focus:outline-none focus:border-[#C8A96E] bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px]">Section config (JSON, optional)</Label>
              <p className="text-[11px] text-slate-500">Advanced: toggles and copy for proposal sections. Leave empty to use defaults.</p>
              <textarea
                value={sectionConfigJson}
                onChange={(e) => setSectionConfigJson(e.target.value)}
                rows={5}
                placeholder="{}"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-[12px] font-mono text-slate-800 resize-none focus:outline-none focus:border-[#C8A96E] bg-white"
              />
            </div>
          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
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
              ) : mode === "create" ? (
                "Create Template"
              ) : (
                "Save changes"
              )}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** @deprecated Use TemplateSheet with mode="create" — kept for backward compatibility */
export function CreateTemplateSheet(
  props: Omit<TemplateSheetProps, "mode" | "editTemplateId">
) {
  return <TemplateSheet {...props} mode="create" />;
}
