"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";
const NONE_VALUE = "__none__";

export interface SectionLetterConfig {
  _id: Id<"serviceSections">;
  name: string;
  ourResponsibilityText?: string;
  yourResponsibilityText?: string;
  linkedLetterVersionId?: Id<"engagementLetterVersions">;
}

interface ServiceLetterConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SectionLetterConfig | null;
  userId: Id<"users">;
}

export function ServiceLetterConfigSheet({
  open,
  onOpenChange,
  section,
  userId,
}: ServiceLetterConfigSheetProps) {
  const updateSection = useMutation(api.lineItems.updateSection);
  const letterVersions = useQuery(api.engagementLetters.listLetterVersionsForPicker, { userId });

  const [ourText, setOurText] = useState("");
  const [yourText, setYourText] = useState("");
  const [linkedId, setLinkedId] = useState<string>(NONE_VALUE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (section && open) {
      setOurText(section.ourResponsibilityText ?? "");
      setYourText(section.yourResponsibilityText ?? "");
      setLinkedId(section.linkedLetterVersionId ?? NONE_VALUE);
    }
  }, [section, open]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!section) return;
    setSaving(true);
    try {
      const result = await updateSection({
        userId,
        sectionId: section._id,
        ourResponsibilityText: ourText.trim() || undefined,
        yourResponsibilityText: yourText.trim() || undefined,
        linkedLetterVersionId:
          linkedId !== NONE_VALUE
            ? (linkedId as Id<"engagementLetterVersions">)
            : undefined,
      });
      if (result.success) {
        toast.success("Engagement letter config saved");
        handleClose();
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b">
          <FileText className="h-5 w-5" style={{ color: ACCENT }} />
          <SheetTitle className="text-lg font-semibold">Engagement Letter Config</SheetTitle>
        </div>

        {/* Section name badge */}
        <div className="px-6 pt-4 pb-2">
          <span className="text-sm font-medium text-slate-500">Section:</span>{" "}
          <span className="font-semibold text-slate-800">{section?.name ?? "—"}</span>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-4 space-y-5">
          {/* Template picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Linked Letter Template</Label>
            <Select value={linkedId} onValueChange={setLinkedId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a template…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>— None —</SelectItem>
                {(letterVersions ?? []).map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">
              When a proposal includes services from this section, the responsibility paragraphs below will be injected into the selected template.
            </p>
          </div>

          {/* Our Responsibility */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Our Responsibility</Label>
            <textarea
              value={ourText}
              onChange={(e) => setOurText(e.target.value)}
              rows={6}
              placeholder="Describe what the firm commits to for services in this section…"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 resize-y"
            />
          </div>

          {/* Your Responsibility */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Your Responsibility</Label>
            <textarea
              value={yourText}
              onChange={(e) => setYourText(e.target.value)}
              rows={6}
              placeholder="Describe what the client is responsible for regarding services in this section…"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 border-t flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 rounded-md border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2",
              saving ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
            )}
            style={{ backgroundColor: ACCENT }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
