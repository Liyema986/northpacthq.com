"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plug, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

const INTEGRATIONS = [
  {
    id: "xero",
    name: "Xero",
    description: "Sync clients, invoices and contacts with your Xero accounting.",
    category: "Accounting",
    logo: "/xero-logo.png",
  },
];

interface AddIntegrationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firmId?: Id<"firms">;
  onSuccess?: () => void;
}

export function AddIntegrationSheet({ open, onOpenChange, firmId, onSuccess }: AddIntegrationSheetProps) {
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const addIntegrationMut = useMutation(api.integrations.addFirmIntegration);

  const integration = INTEGRATIONS.find((i) => i.id === selected);

  function handleClose() {
    onOpenChange(false);
    setSelected("");
  }

  async function handleConnect() {
    if (!integration) return;

    if (!firmId) {
      toast.error("Firm not loaded yet — please try again.");
      return;
    }

    setSaving(true);
    try {
      const result = await addIntegrationMut({ firmId, provider: integration.id });
      if (result.success) {
        toast.success("Redirecting to Xero to authorise your account…");
        handleClose();
        onSuccess?.();
        window.location.href = `/api/integrations/xero/authorize?firmId=${firmId}`;
      } else {
        toast.error(result.error ?? "Failed to add integration");
      }
    } catch {
      toast.error("Failed to add integration");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right"
        hideClose
        className="w-full sm:max-w-none sm:w-[480px] p-0 border-l border-slate-200 shadow-2xl flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">Add Integration</SheetTitle>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${ACCENT}18` }}
              >
                <Plug className="h-5 w-5" style={{ color: ACCENT }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">
                  Add Integration
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Connect an app to your workspace
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Dropdown */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium text-slate-700">
              Integration
            </Label>
            <p className="text-[11px] text-slate-400">
              Select the app you want to connect to your workspace.
            </p>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-10 text-[13px] border-slate-200 mt-1">
                <SelectValue placeholder="Select an integration…" />
              </SelectTrigger>
              <SelectContent>
                {INTEGRATIONS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={item.logo} alt={item.name} className="w-4 h-4 object-contain" />
                      </div>
                      <span>{item.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected integration card */}
          {integration && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {/* Logo row */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 bg-slate-50/60">
                <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={integration.logo} alt={integration.name} className="w-7 h-7 object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold text-slate-900">{integration.name}</p>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {integration.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Available now</p>
                </div>
              </div>

              {/* Description */}
              <div className="px-4 py-3">
                <p className="text-[12px] text-slate-600 leading-relaxed">
                  {integration.description} Once added, data will sync based on your settings.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-6 py-4 bg-slate-50 gap-2">
          <button
            onClick={handleClose}
            disabled={saving}
            className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={saving || !selected}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
            style={{ background: ACCENT }}
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting…</>
            ) : (
              "Connect App"
            )}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
