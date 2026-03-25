"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Users, Building2, User, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { validateRequiredEmail } from "@/lib/contact-validators";

interface AddClientSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  onSuccess?: () => void;
}

const ACCENT = "#C8A96E";

export function AddClientSheet({ open, onOpenChange, userId, onSuccess }: AddClientSheetProps) {
  const createClient = useMutation(api.clients.createClient);

  const [contactType, setContactType] = useState<"organisation" | "individual">("organisation");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setContactType("organisation");
    setCompanyName(""); setContactName(""); setEmail(""); setPhone(""); setIndustry("");
    setErrors({});
  }

  function handleClose(val: boolean) {
    onOpenChange(val);
    if (!val) reset();
  }

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs.companyName = contactType === "individual" ? "Full name is required" : "Company name is required";
    const emailErr = validateRequiredEmail(email);
    if (emailErr) errs.email = emailErr;
    if (contactType === "organisation" && !contactName.trim()) errs.contactName = "Contact name is required for organisations";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const name = companyName.trim();
    const primary =
      contactType === "individual"
        ? name
        : contactName.trim();

    setSaving(true);
    try {
      const result = await createClient({
        userId,
        contactType,
        companyName: name,
        contactName: primary,
        email: email.trim(),
        phone: phone.trim() || undefined,
        industry: industry.trim() || undefined,
        status: "prospect",
      });
      if (!result.success) {
        if (result.error?.toLowerCase().includes("email")) {
          setErrors({ email: result.error });
        } else {
          toast.error(result.error ?? "Could not add client");
        }
        return;
      }
      toast.success(`Client "${name}" added`);
      handleClose(false);
      onSuccess?.();
    } catch {
      toast.error("Could not add client");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[440px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
        <SheetTitle className="sr-only">Add New Client</SheetTitle>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <Users className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">Add New Client</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Enter the client's information and contact details</p>
                </div>
              </div>
              <button onClick={() => handleClose(false)} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Type toggle */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-slate-600">Contact type</Label>
              <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                {([
                  { key: "organisation", label: "Organisation", Icon: Building2 },
                  { key: "individual",   label: "Individual",   Icon: User },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setContactType(key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                      contactType === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Company / Full name */}
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-[11px] font-medium text-slate-600">
                {contactType === "individual" ? "Full name" : "Company name"} <span className="text-red-500">*</span>
              </Label>
              <input
                id="companyName"
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); if (errors.companyName) setErrors((p) => ({ ...p, companyName: "" })); }}
                placeholder={contactType === "individual" ? "John Doe" : "Acme Corp"}
                disabled={saving}
                className={cn("w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white", errors.companyName ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]")}
              />
              {errors.companyName && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{errors.companyName}</p>}
            </div>

            {/* Contact name */}
            <div className="space-y-1.5">
              <Label htmlFor="contactName" className="text-[11px] font-medium text-slate-600">
                Contact name {contactType === "organisation" && <span className="text-red-500">*</span>}
              </Label>
              <input
                id="contactName"
                value={contactName}
                onChange={(e) => { setContactName(e.target.value); if (errors.contactName) setErrors((p) => ({ ...p, contactName: "" })); }}
                placeholder={contactType === "individual" ? "Same as full name if empty" : "John Doe"}
                disabled={saving}
                className={cn("w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white", errors.contactName ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]")}
              />
              {contactType === "individual" && <p className="text-[10px] text-slate-400">Optional — uses full name if empty</p>}
              {errors.contactName && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{errors.contactName}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-medium text-slate-600">Email <span className="text-red-500">*</span></Label>
              <input
                id="email" type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: "" })); }}
                placeholder="john@acmecorp.com"
                disabled={saving}
                className={cn("w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white", errors.email ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]")}
              />
              {errors.email && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-[11px] font-medium text-slate-600">Phone</Label>
              <input
                id="phone" type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 (0) 21 123 4567"
                disabled={saving}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
              />
            </div>

            {/* Industry */}
            <div className="space-y-1.5">
              <Label htmlFor="industry" className="text-[11px] font-medium text-slate-600">Industry</Label>
              <input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Retail, Finance"
                disabled={saving}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
              />
            </div>
          </div>

          {/* Footer */}
          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={() => handleClose(false)} disabled={saving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5" style={{ background: ACCENT }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</> : "Add Client"}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
