"use client";

import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ACCENT = "#C8A96E";

const ROLE_OPTIONS = [
  { id: "director", label: "Director" },
  { id: "principal", label: "Principal" },
  { id: "statutory-auditor", label: "Statutory auditor" },
] as const;

export interface PrincipalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: Id<"users">;
  mode: "create" | "edit";
  /** Set when mode is edit */
  principalId?: Id<"principals">;
  initialName?: string;
  initialQualification?: string;
  initialRoles?: string[];
  onSuccess?: () => void;
}

export function PrincipalSheet({
  open,
  onOpenChange,
  userId,
  mode,
  principalId,
  initialName = "",
  initialQualification = "",
  initialRoles = [],
  onSuccess,
}: PrincipalSheetProps) {
  const createMut = useMutation(api.principals.createPrincipal);
  const updateMut = useMutation(api.principals.updatePrincipal);
  const genUpload = useMutation(api.principals.generateSignatureUploadUrl);

  const [name, setName] = useState("");
  const [qualification, setQualification] = useState("");
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [sigPending, setSigPending] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  const reset = useCallback(() => {
    setName("");
    setQualification("");
    setRoles(new Set());
    setSignatureFile(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit") {
      setName(initialName);
      setQualification(initialQualification ?? "");
      setRoles(new Set(initialRoles.filter((r) => ROLE_OPTIONS.some((o) => o.id === r))));
    } else {
      reset();
    }
  }, [open, mode, initialName, initialQualification, initialRoles, reset]);

  function handleClose() {
    onOpenChange(false);
    reset();
  }

  function toggleRole(id: string) {
    setRoles((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function uploadSignatureFile(file: File): Promise<Id<"_storage"> | undefined> {
    if (!userId) return undefined;
    setSigPending(true);
    try {
      const uploadUrl = await genUpload({ userId });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        toast.error("Signature upload failed");
        return undefined;
      }
      const json = (await res.json()) as { storageId?: Id<"_storage"> };
      return json.storageId;
    } catch {
      toast.error("Signature upload failed");
      return undefined;
    } finally {
      setSigPending(false);
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    if (!userId) {
      toast.error("Not authenticated");
      return;
    }
    const roleList = ROLE_OPTIONS.map((r) => r.id).filter((id) => roles.has(id));
    if (roleList.length === 0) {
      toast.error("Select at least one role");
      return;
    }

    setSaving(true);
    try {
      let signatureStorageId: Id<"_storage"> | undefined;
      if (signatureFile) {
        const sid = await uploadSignatureFile(signatureFile);
        if (!sid) {
          setSaving(false);
          return;
        }
        signatureStorageId = sid;
      }

      if (mode === "create") {
        await createMut({
          userId,
          name: trimmed,
          qualification: qualification.trim() || undefined,
          roles: roleList,
          ...(signatureStorageId ? { signatureStorageId } : {}),
        });
        toast.success("Principal added");
      } else if (principalId) {
        await updateMut({
          userId,
          principalId,
          name: trimmed,
          qualification: qualification.trim() || undefined,
          roles: roleList,
          ...(signatureStorageId !== undefined ? { signatureStorageId } : {}),
        });
        toast.success("Principal updated");
      }
      handleClose();
      onSuccess?.();
    } catch {
      toast.error(mode === "create" ? "Failed to add principal" : "Failed to update principal");
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "create" ? "Add principal" : "Edit principal";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right"
        hideClose
        className="w-full sm:max-w-none sm:w-[480px] p-0 border-l border-slate-200 shadow-2xl flex flex-col bg-white"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex-shrink-0 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-200"
                style={{ background: `${ACCENT}14` }}
              >
                <Users className="h-5 w-5" style={{ color: ACCENT }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Shown on engagement letters when configured in your templates.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="principal-name" className="text-[13px]">
              Full name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="principal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="principal-qual" className="text-[13px]">
              Qualification <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="principal-qual"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              placeholder="CA(SA)"
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-slate-800">Roles</p>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2.5 cursor-pointer text-[13px] text-slate-700"
                >
                  <Checkbox
                    checked={roles.has(r.id)}
                    onCheckedChange={() => toggleRole(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Signature image (optional)</Label>
            <p className="text-[11px] text-slate-500">PNG, JPG or WebP · uploaded when you save</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={sigPending || saving || !userId}
              className="text-[12px] w-full file:mr-2"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSignatureFile(file);
                e.target.value = "";
              }}
            />
            {signatureFile && (
              <p className="text-[11px] text-slate-600">Selected: {signatureFile.name}</p>
            )}
          </div>
        </div>

        <SheetFooter className="border-t border-slate-200 px-6 py-4 gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || sigPending || !userId}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-2"
            style={{ background: ACCENT }}
          >
            {saving || sigPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {mode === "create" ? "Add principal" : "Save changes"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
