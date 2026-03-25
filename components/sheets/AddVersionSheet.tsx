"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { ScrollText, X, Loader2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

interface AddVersionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  userId?: Id<"users">;
}

export function AddVersionSheet({ open, onOpenChange, onSuccess, userId }: AddVersionSheetProps) {
  const createLetterVersion = useMutation(api.engagementLetters.createLetterVersion);

  const [name, setName] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() { setName(""); setLetterBody(""); setNameError(""); }
  function handleClose() { onOpenChange(false); reset(); }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setNameError("Version name is required"); return; }
    if (trimmed.length < 2) { setNameError("Version name must be at least 2 characters"); return; }
    if (!userId) { toast.error("Not authenticated"); return; }
    setSaving(true);
    try {
      await createLetterVersion({
        userId,
        name: trimmed,
        scope: letterBody.trim() || undefined,
      });
      toast.success(`Version "${trimmed}" added`);
      handleClose();
      onSuccess?.();
    } catch {
      toast.error("Failed to save version");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[560px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
        <SheetTitle className="sr-only">Add New Version</SheetTitle>
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <ScrollText className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight flex items-center gap-2">
                    Add New Version
                    <span className="p-0.5 rounded-full text-blue-600 bg-blue-50">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">Name and full letter text</p>
                </div>
              </div>
              <button onClick={handleClose} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="version-name" className="text-[13px]">Version Name <span className="text-red-500">*</span></Label>
              <input
                id="version-name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
                placeholder="e.g. Virtual: Standard Engagement Letter"
                maxLength={100}
                disabled={saving}
                className={cn("w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white", nameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]")}
              />
              {nameError && <p className="text-[11px] text-red-600">{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="version-letter" className="text-[13px] flex items-center gap-1.5">
                Letter
                <span className="p-0.5 rounded-full text-blue-600 bg-blue-50"><HelpCircle className="h-3.5 w-3.5" /></span>
              </Label>
              <textarea
                id="version-letter"
                value={letterBody}
                onChange={(e) => setLetterBody(e.target.value)}
                placeholder="Full engagement letter (optional)…"
                rows={12}
                disabled={saving}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-serif text-[13px] leading-relaxed text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] bg-white resize-y min-h-[200px]"
              />
            </div>
          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5" style={{ background: ACCENT }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Letter Version"}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
