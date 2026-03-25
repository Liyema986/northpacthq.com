"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Building2, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  validateRequiredEmail,
  validateOptionalWebsite,
  normalizeOptionalWebsite,
} from "@/lib/contact-validators";

const ACCENT = "#C8A96E";

interface AddOrganisationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  onSuccess?: () => void;
}

function Field({ id, label, value, onChange, placeholder, type = "text", required, error, disabled, colSpan }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; error?: string; disabled?: boolean; colSpan?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", colSpan && "sm:col-span-2")}>
      <Label htmlFor={id} className="text-[11px] font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <input
        id={id} type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("w-full h-9 px-3 rounded-lg border text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white", error ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]")}
      />
      {error && <p className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

function combinePhone(phone: string, mobile: string): string | undefined {
  const p = phone.trim();
  const m = mobile.trim();
  if (p && m) return `${p} · ${m}`;
  return p || m || undefined;
}

export function AddOrganisationSheet({ open, onOpenChange, userId, onSuccess }: AddOrganisationSheetProps) {
  const createClient = useMutation(api.clients.createClient);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setCompanyName(""); setContactName(""); setEmail(""); setPhone(""); setMobile("");
    setWebsite(""); setTaxNumber(""); setCompanyNumber(""); setDefaultCurrency("");
    setAddressLine1(""); setCity(""); setRegion(""); setPostalCode(""); setCountry("");
    setErrors({});
  }

  function handleClose() { onOpenChange(false); reset(); }

  async function handleCreate() {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs.companyName = "Company name is required";
    const emailErr = validateRequiredEmail(email);
    if (emailErr) errs.email = emailErr;
    if (!contactName.trim()) errs.contactName = "Primary contact name is required";
    const webErr = validateOptionalWebsite(website);
    if (webErr) errs.website = webErr;
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const result = await createClient({
        userId,
        contactType: "organisation",
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: combinePhone(phone, mobile),
        website: normalizeOptionalWebsite(website),
        taxNumber: taxNumber.trim() || undefined,
        companyNumber: companyNumber.trim() || undefined,
        defaultCurrency: defaultCurrency.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        region: region.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        status: "prospect",
      });
      if (!result.success) {
        if (result.error?.toLowerCase().includes("email")) {
          setErrors({ email: result.error });
        } else {
          toast.error(result.error ?? "Could not create contact");
        }
        return;
      }
      toast.success(`Organisation "${companyName.trim()}" saved`);
      handleClose();
      onSuccess?.();
    } catch {
      toast.error("Could not create contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
        <SheetTitle className="sr-only">New Organisation Contact</SheetTitle>
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <Building2 className="h-7 w-7" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 leading-tight">New Organisation Contact</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Enter company name, contact and optional details</p>
                </div>
              </div>
              <button onClick={handleClose} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="companyName" label="Company Name" value={companyName} onChange={(v) => { setCompanyName(v); if (errors.companyName) setErrors((p) => ({ ...p, companyName: "" })); }} placeholder="Enter company name" required error={errors.companyName} disabled={saving} colSpan />
              <Field id="orgContactName" label="Primary contact name" value={contactName} onChange={(v) => { setContactName(v); if (errors.contactName) setErrors((p) => ({ ...p, contactName: "" })); }} placeholder="e.g. John Smith" required error={errors.contactName} disabled={saving} colSpan />
              <Field id="orgEmail" label="Email" value={email} onChange={(v) => { setEmail(v); if (errors.email) setErrors((p) => ({ ...p, email: "" })); }} placeholder="Enter email" type="email" required error={errors.email} disabled={saving} />
              <Field id="orgPhone" label="Phone" value={phone} onChange={setPhone} placeholder="Enter phone" disabled={saving} />
              <Field id="orgMobile" label="Mobile" value={mobile} onChange={setMobile} placeholder="Enter mobile" disabled={saving} />
              <Field id="orgWebsite" label="Website" value={website} onChange={(v) => { setWebsite(v); if (errors.website) setErrors((p) => ({ ...p, website: "" })); }} placeholder="https://..." type="url" error={errors.website} disabled={saving} colSpan />
              <Field id="orgTax" label="Tax / VAT number" value={taxNumber} onChange={setTaxNumber} placeholder="e.g. SARS tax ref / VAT number" disabled={saving} />
              <Field id="orgCIPC" label="Company number (CIPC)" value={companyNumber} onChange={setCompanyNumber} placeholder="e.g. CIPC registration number" disabled={saving} />
              <Field id="orgCurrency" label="Default currency" value={defaultCurrency} onChange={setDefaultCurrency} placeholder="e.g. ZAR" disabled={saving} />
              <Field id="orgAddress" label="Address" value={addressLine1} onChange={setAddressLine1} placeholder="Street / P.O. Box" disabled={saving} colSpan />
              <Field id="orgCity" label="City" value={city} onChange={setCity} placeholder="City" disabled={saving} />
              <Field id="orgRegion" label="Province" value={region} onChange={setRegion} placeholder="e.g. Western Cape" disabled={saving} />
              <Field id="orgPostal" label="Postal code" value={postalCode} onChange={setPostalCode} placeholder="e.g. 8001" disabled={saving} />
              <Field id="orgCountry" label="Country" value={country} onChange={setCountry} placeholder="e.g. South Africa" disabled={saving} />
            </div>
          </div>

          <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
            <button onClick={handleClose} disabled={saving} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5" style={{ background: ACCENT }}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating…</> : "Create Contact"}
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
