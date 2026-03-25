"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Edit3, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

type Status = "prospect" | "active" | "inactive" | "archived";

interface EditContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: Id<"clients"> | null;
  userId: Id<"users"> | undefined;
  onSuccess?: () => void;
}

export function EditContactSheet({
  open,
  onOpenChange,
  clientId,
  userId,
  onSuccess,
}: EditContactSheetProps) {
  const client = useQuery(
    api.clients.getClient,
    open && userId && clientId ? { userId, clientId } : "skip"
  );
  const updateClient = useMutation(api.clients.updateClient);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("prospect");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!client) return;
    setCompanyName(client.companyName);
    setContactName(client.contactName);
    setEmail(client.email);
    setPhone(client.phone ?? "");
    setWebsite(client.website ?? "");
    setNotes(client.notes ?? "");
    setStatus(
      (["prospect", "active", "inactive", "archived"].includes(client.status)
        ? client.status
        : "prospect") as Status
    );
    setErrors({});
  }, [client]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!userId || !clientId) return;
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs.companyName = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const result = await updateClient({
        userId,
        clientId,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      });
      if (result.success) {
        toast.success("Contact updated");
        handleClose();
        onSuccess?.();
      } else {
        toast.error(result.error ?? "Update failed");
      }
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  const loading = open && userId && clientId && client === undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideClose
        className="w-full sm:max-w-none sm:w-[440px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">Edit contact</SheetTitle>

        <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0"
                style={{ background: `${ACCENT}14` }}
              >
                <Edit3 className="h-7 w-7" style={{ color: ACCENT }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 leading-tight">Edit contact</h2>
                <p className="text-sm text-slate-500 mt-0.5">Update details saved to your firm</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleClose()}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : !client ? (
            <p className="text-sm text-slate-500">Contact not found.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-600">
                  {client.contactType === "individual" ? "Full name" : "Company / organisation"} *
                </Label>
                <input
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (errors.companyName) setErrors((p) => ({ ...p, companyName: "" }));
                  }}
                  className={cn(
                    "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 focus:outline-none bg-white",
                    errors.companyName ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                  )}
                />
                {errors.companyName && (
                  <p className="flex items-center gap-1 text-[10px] text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {errors.companyName}
                  </p>
                )}
              </div>

              {client.contactType !== "individual" && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-600">Contact name</Label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-600">Email *</Label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                  }}
                  className={cn(
                    "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 focus:outline-none bg-white",
                    errors.email ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                  )}
                />
                {errors.email && (
                  <p className="flex items-center gap-1 text-[10px] text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-600">Phone</Label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-600">Website</Label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-600">Category</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white cursor-pointer"
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Client</option>
                  <option value="inactive">Missed opportunity</option>
                  <option value="archived">Hidden</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-600">Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] bg-white resize-y min-h-[88px]"
                />
              </div>
            </>
          )}
        </div>

        <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
          <Button type="button" variant="outline" onClick={() => handleClose()} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !client}
            className="text-white"
            style={{ background: ACCENT }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
