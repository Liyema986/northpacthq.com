"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PrincipalSheet } from "@/components/sheets/PrincipalSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SuiteInlinePanelId = "letterhead" | "key-dates" | "key-people" | "emails";

const SETTINGS_HASH: Record<SuiteInlinePanelId, string> = {
  letterhead: "letterhead",
  "key-dates": "key-dates",
  "key-people": "key-people",
  emails: "emails",
};

type Props = {
  panel: SuiteInlinePanelId;
  userId: Id<"users">;
};

export function EngagementSuiteInlinePanels({ panel, userId }: Props) {
  const convexPrincipals = useQuery(api.principals.listPrincipals, { userId });
  const keyDatesSettings = useQuery(api.engagementLetters.getKeyDatesSettings, { userId });
  const letterheadUi = useQuery(api.engagementLetters.getEngagementLetterheadForUi, { userId });
  const emailTemplates = useQuery(api.engagementLetters.getEngagementEmailTemplates, { userId });

  const deletePrincipalMutation = useMutation(api.principals.deletePrincipal);
  const reorderPrincipalsMutation = useMutation(api.principals.reorderPrincipals);
  const updateKeyDatesMutation = useMutation(api.engagementLetters.updateKeyDatesSettings);
  const updateEmailTemplatesMutation = useMutation(api.engagementLetters.updateEngagementEmailTemplates);
  const updateFirmMutation = useMutation(api.authFunctions.updateFirm);
  const generateLogoUploadUrl = useMutation(api.authFunctions.generateLogoUploadUrl);
  const clearFirmLogoMutation = useMutation(api.authFunctions.clearFirmLogo);

  const principals = convexPrincipals ?? [];
  const loadingPrincipals = convexPrincipals === undefined;

  const [emailTab, setEmailTab] = useState<"signed" | "acceptance">("signed");
  const [kdIntro, setKdIntro] = useState("");
  const [kdInfo, setKdInfo] = useState("");
  const [kdFiling, setKdFiling] = useState("");
  const [savingKd, setSavingKd] = useState(false);

  const [lhPractice, setLhPractice] = useState("");
  const [lhFooter, setLhFooter] = useState("");
  const [lhDirectors, setLhDirectors] = useState("");
  const [lhLogoPreview, setLhLogoPreview] = useState<string | null>(null);
  const [lhLogoFile, setLhLogoFile] = useState<File | null>(null);
  const [savingLetterhead, setSavingLetterhead] = useState(false);

  const [emClientSub, setEmClientSub] = useState("");
  const [emClientBody, setEmClientBody] = useState("");
  const [emAddSub, setEmAddSub] = useState("");
  const [emAddBody, setEmAddBody] = useState("");
  const [emStaffSub, setEmStaffSub] = useState("");
  const [emStaffBody, setEmStaffBody] = useState("");
  const [emAdditionally, setEmAdditionally] = useState("");
  const [savingEmails, setSavingEmails] = useState(false);

  const [principalSheetOpen, setPrincipalSheetOpen] = useState(false);
  const [principalSheetMode, setPrincipalSheetMode] = useState<"create" | "edit">("create");
  const [editingPrincipalId, setEditingPrincipalId] = useState<Id<"principals"> | null>(null);
  const [deletePrincipalId, setDeletePrincipalId] = useState<Id<"principals"> | null>(null);

  useEffect(() => {
    if (!keyDatesSettings) return;
    setKdIntro(keyDatesSettings.keyDatesTableIntroduction ?? "");
    setKdInfo(keyDatesSettings.infoDeadlineHeading ?? "");
    setKdFiling(keyDatesSettings.filingDeadlineHeading ?? "");
  }, [keyDatesSettings]);

  useEffect(() => {
    if (!letterheadUi) return;
    setLhPractice(letterheadUi.practiceAddress);
    setLhFooter(letterheadUi.footerText);
    setLhDirectors(letterheadUi.directorsList);
  }, [letterheadUi]);

  useEffect(() => {
    if (lhLogoFile) {
      const url = URL.createObjectURL(lhLogoFile);
      setLhLogoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setLhLogoPreview(letterheadUi?.logoUrl ?? null);
  }, [lhLogoFile, letterheadUi]);

  useEffect(() => {
    if (!emailTemplates) return;
    const bucket = emailTab === "signed" ? emailTemplates.signed : emailTemplates.acceptance;
    setEmClientSub(bucket?.clientSubject ?? "");
    setEmClientBody(bucket?.clientContent ?? "");
    setEmAddSub(bucket?.additionalSignatorySubject ?? "");
    setEmAddBody(bucket?.additionalSignatoryContent ?? "");
    setEmStaffSub(bucket?.staffSubject ?? "");
    setEmStaffBody(bucket?.staffContent ?? "");
    setEmAdditionally(bucket?.additionallyEmailTo ?? "");
  }, [emailTemplates, emailTab]);

  async function handleSaveKeyDates() {
    setSavingKd(true);
    try {
      await updateKeyDatesMutation({
        userId,
        keyDatesTableIntroduction: kdIntro.trim() || undefined,
        infoDeadlineHeading: kdInfo.trim() || undefined,
        filingDeadlineHeading: kdFiling.trim() || undefined,
      });
      toast.success("Key dates saved");
    } catch {
      toast.error("Failed to save key dates");
    } finally {
      setSavingKd(false);
    }
  }

  async function handleSaveLetterhead() {
    setSavingLetterhead(true);
    try {
      let logoStorageId: Id<"_storage"> | undefined;
      if (lhLogoFile) {
        if (lhLogoFile.size > 2 * 1024 * 1024) {
          toast.error("Logo must be 2MB or smaller");
          setSavingLetterhead(false);
          return;
        }
        const uploadUrl = await generateLogoUploadUrl({ userId });
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": lhLogoFile.type || "application/octet-stream" },
          body: lhLogoFile,
        });
        if (!res.ok) {
          toast.error("Logo upload failed");
          setSavingLetterhead(false);
          return;
        }
        const json = (await res.json()) as { storageId?: Id<"_storage"> };
        if (!json.storageId) {
          toast.error("Logo upload failed");
          setSavingLetterhead(false);
          return;
        }
        logoStorageId = json.storageId;
      }
      await updateFirmMutation({
        userId,
        ...(logoStorageId ? { logo: logoStorageId } : {}),
        pdfFooterAddress: lhPractice.trim() || undefined,
        pdfFooterText: lhFooter.trim() || undefined,
        letterheadDirectorsList: lhDirectors.trim() || undefined,
      });
      setLhLogoFile(null);
      toast.success("Letterhead saved");
    } catch {
      toast.error("Failed to save letterhead");
    } finally {
      setSavingLetterhead(false);
    }
  }

  async function handleClearLetterheadLogo() {
    try {
      await clearFirmLogoMutation({ userId });
      setLhLogoFile(null);
      toast.success("Logo removed");
    } catch {
      toast.error("Failed to remove logo");
    }
  }

  async function handleSaveEmails() {
    setSavingEmails(true);
    try {
      const payload = {
        clientSubject: emClientSub.trim() || undefined,
        clientContent: emClientBody.trim() || undefined,
        additionalSignatorySubject: emAddSub.trim() || undefined,
        additionalSignatoryContent: emAddBody.trim() || undefined,
        staffSubject: emStaffSub.trim() || undefined,
        staffContent: emStaffBody.trim() || undefined,
        additionallyEmailTo: emAdditionally.trim() || undefined,
      };
      if (emailTab === "signed") {
        await updateEmailTemplatesMutation({ userId, signed: payload });
      } else {
        await updateEmailTemplatesMutation({ userId, acceptance: payload });
      }
      toast.success("Email templates saved");
    } catch {
      toast.error("Failed to save email templates");
    } finally {
      setSavingEmails(false);
    }
  }

  async function handleDeletePrincipal() {
    if (!deletePrincipalId) return;
    try {
      await deletePrincipalMutation({ userId, principalId: deletePrincipalId });
      toast.success("Principal removed");
    } catch {
      toast.error("Failed to remove principal");
    }
    setDeletePrincipalId(null);
  }

  async function movePrincipal(index: number, dir: "up" | "down") {
    if (principals.length < 2) return;
    const next = dir === "up" ? index - 1 : index + 1;
    if (next < 0 || next >= principals.length) return;
    const copy = [...principals];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    const newOrder = copy.map((p) => p._id);
    try {
      await reorderPrincipalsMutation({ userId, principalIds: newOrder });
    } catch {
      toast.error("Failed to reorder");
    }
  }

  const fullSettingsHref = `/engagement-letters/settings#${SETTINGS_HASH[panel]}`;

  const footer = (
    <p className="text-[11px] text-slate-400 pt-2">
      <Link href={fullSettingsHref} className="font-medium underline hover:text-slate-600" style={{ color: "#C8A96E" }}>
        Open full suite settings
      </Link>{" "}
      for scope library and global options.
    </p>
  );

  if (panel === "letterhead") {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-100 bg-white p-6 space-y-5">
          <div>
            <p className="text-[13px] font-semibold text-slate-800">Letterhead Components</p>
            <p className="text-[12px] text-slate-500 mt-1">
              Firm logo and practice address are shared with proposal PDFs (Settings → Proposals). Footer text below is the same{" "}
              <span className="font-medium text-slate-600">PDF footer</span> field.
            </p>
          </div>
          {letterheadUi === undefined ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-slate-700">Firm logo</p>
                  <div
                    className={cn(
                      "relative flex h-[120px] max-w-[220px] items-center justify-center overflow-hidden rounded-lg border bg-slate-50",
                      lhLogoPreview ? "border-slate-200" : "border-dashed border-slate-200"
                    )}
                  >
                    {lhLogoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Convex or blob URL
                      <img src={lhLogoPreview} alt="Firm logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <Building2 className="h-10 w-10 text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                      <Upload className="h-3.5 w-3.5" />
                      {lhLogoPreview ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          if (!f.type.startsWith("image/")) {
                            toast.error("Please choose an image file");
                            return;
                          }
                          if (f.size > 2 * 1024 * 1024) {
                            toast.error("Image must be 2MB or smaller");
                            return;
                          }
                          setLhLogoFile(f);
                        }}
                      />
                    </label>
                    {(lhLogoFile || letterheadUi?.logoUrl) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[12px]"
                        onClick={() => {
                          if (lhLogoFile) {
                            setLhLogoFile(null);
                            return;
                          }
                          void handleClearLetterheadLogo();
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[12px] font-medium text-slate-700">Practice address</p>
                  <p className="text-[11px] text-slate-500">Shown in the PDF / letter footer address block.</p>
                  <Textarea
                    value={lhPractice}
                    onChange={(e) => setLhPractice(e.target.value)}
                    rows={5}
                    className="border-slate-200 text-[12px]"
                    placeholder="Street, city, postal code…"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-slate-700">Footer text</p>
                <p className="text-[11px] text-slate-500">Legal tagline or registration details (PDF footer).</p>
                <Textarea
                  value={lhFooter}
                  onChange={(e) => setLhFooter(e.target.value)}
                  rows={3}
                  className="border-slate-200 text-[12px]"
                  placeholder="Footer line…"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-slate-700">Directors / partners / members</p>
                <p className="text-[11px] text-slate-500">List that appears on engagement letter letterhead when required.</p>
                <Textarea
                  value={lhDirectors}
                  onChange={(e) => setLhDirectors(e.target.value)}
                  rows={4}
                  className="border-slate-200 text-[12px]"
                  placeholder="Name (Role), …"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#C8A96E" }}
                  disabled={savingLetterhead || letterheadUi === undefined}
                  onClick={() => void handleSaveLetterhead()}
                >
                  {savingLetterhead ? "Saving…" : "Save letterhead"}
                </Button>
              </div>
            </>
          )}
        </div>
        {footer}
      </div>
    );
  }

  if (panel === "key-dates") {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-100 bg-white p-6 space-y-5">
          <p className="text-[13px] font-semibold text-slate-800">Key Dates</p>
          <p className="text-[12px] text-slate-500">
            Configure key deadline headings and the introduction paragraph that appears above the key dates table.
          </p>
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-slate-700">Key Dates Table Introduction</p>
            <p className="text-[11px] text-slate-500">Appears above the key dates table at the bottom of the Introduction.</p>
            <textarea
              value={kdIntro}
              onChange={(e) => setKdIntro(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
              placeholder="Please see below the key dates for this engagement:"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium text-slate-700">Deadline for all Information</p>
              <input
                type="text"
                value={kdInfo}
                onChange={(e) => setKdInfo(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                placeholder="Column heading"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium text-slate-700">Filing Deadline</p>
              <input
                type="text"
                value={kdFiling}
                onChange={(e) => setKdFiling(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                placeholder="Column heading"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#C8A96E" }}
              disabled={savingKd || keyDatesSettings === undefined}
              onClick={() => void handleSaveKeyDates()}
            >
              {savingKd ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
        {footer}
      </div>
    );
  }

  if (panel === "key-people") {
    return (
      <div className="space-y-4">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            {loadingPrincipals ? (
              <div className="space-y-2 p-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : principals.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-[13px] text-slate-500">No principals yet</p>
                <p className="text-[12px] text-slate-400">Add principals who appear on your engagement letters.</p>
                <Button
                  size="sm"
                  className="text-white transition-opacity hover:opacity-90"
                  style={{ background: "#C8A96E" }}
                  onClick={() => {
                    setPrincipalSheetMode("create");
                    setEditingPrincipalId(null);
                    setPrincipalSheetOpen(true);
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add New Principal
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {principals.map((p, i) => (
                  <div key={`${p._id}-${i}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50">
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        onClick={() => {
                          void movePrincipal(i, "up");
                        }}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        onClick={() => {
                          void movePrincipal(i, "down");
                        }}
                        disabled={i === principals.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                    <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">{p.name}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-slate-200 px-2.5 text-[11px]"
                        onClick={() => {
                          setPrincipalSheetMode("edit");
                          setEditingPrincipalId(p._id);
                          setPrincipalSheetOpen(true);
                        }}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 border-slate-200 p-0 text-slate-500 hover:border-red-200 hover:text-red-600"
                        onClick={() => setDeletePrincipalId(p._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {principals.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                className="text-white transition-opacity hover:opacity-90"
                style={{ background: "#C8A96E" }}
                onClick={() => {
                  setPrincipalSheetMode("create");
                  setEditingPrincipalId(null);
                  setPrincipalSheetOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add New Principal
              </Button>
            </div>
          )}
        </div>
        {footer}

        <AlertDialog open={!!deletePrincipalId} onOpenChange={(o) => !o && setDeletePrincipalId(null)}>
          <AlertDialogContent>
            <div className="flex items-start justify-between gap-4">
              <AlertDialogHeader className="flex-1 space-y-2 text-left">
                <AlertDialogTitle>Remove principal?</AlertDialogTitle>
                <AlertDialogDescription>This will remove the principal from your engagement letters.</AlertDialogDescription>
              </AlertDialogHeader>
              <button
                type="button"
                onClick={() => setDeletePrincipalId(null)}
                className="-m-1 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDeletePrincipal()} className="bg-red-600 hover:bg-red-700">
                Yes, remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <PrincipalSheet
          open={principalSheetOpen}
          onOpenChange={(o) => {
            setPrincipalSheetOpen(o);
            if (!o) setEditingPrincipalId(null);
          }}
          userId={userId}
          mode={principalSheetMode}
          principalId={editingPrincipalId ?? undefined}
          initialName={
            principalSheetMode === "edit" && editingPrincipalId
              ? principals.find((p) => p._id === editingPrincipalId)?.name ?? ""
              : ""
          }
          initialQualification={
            principalSheetMode === "edit" && editingPrincipalId
              ? principals.find((p) => p._id === editingPrincipalId)?.qualification ?? ""
              : ""
          }
          initialRoles={
            principalSheetMode === "edit" && editingPrincipalId
              ? principals.find((p) => p._id === editingPrincipalId)?.roles ?? []
              : []
          }
        />
      </div>
    );
  }

  /* emails */
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
          <p className="min-w-0 flex-1 pr-2 text-[13px] font-semibold leading-snug text-slate-800">
            {emailTab === "signed" ? "Signed & Accepted Email Templates" : "Acceptance Button Email Templates"}
          </p>
          <div className="ml-auto shrink-0 rounded-md bg-slate-200/80 p-0.5">
            <button
              type="button"
              onClick={() => setEmailTab("signed")}
              className={cn(
                "h-8 rounded px-3 text-[11px] font-medium transition-colors",
                emailTab === "signed" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Signed &amp; Accepted
            </button>
            <button
              type="button"
              onClick={() => setEmailTab("acceptance")}
              className={cn(
                "h-8 rounded px-3 text-[11px] font-medium transition-colors",
                emailTab === "acceptance" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Acceptance Button Only
            </button>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-slate-500">
          {emailTab === "signed"
            ? "Configure the emails sent automatically when a client signs their engagement letter."
            : "Configure the emails used for the acceptance button flow."}
        </p>
      </div>
      {emailTemplates === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {[
            { title: "Client Email", sub: emClientSub, setSub: setEmClientSub, body: emClientBody, setBody: setEmClientBody },
            {
              title: "Additional Signatory Email",
              sub: emAddSub,
              setSub: setEmAddSub,
              body: emAddBody,
              setBody: setEmAddBody,
            },
            { title: "Staff Notification Email", sub: emStaffSub, setSub: setEmStaffSub, body: emStaffBody, setBody: setEmStaffBody },
          ].map((block) => (
            <div key={block.title} className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <p className="text-[12px] font-semibold text-slate-700">{block.title}</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Subject</label>
                  <input
                    type="text"
                    value={block.sub}
                    onChange={(e) => block.setSub(e.target.value)}
                    placeholder="Email subject…"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Content</label>
                  <Textarea
                    value={block.body}
                    onChange={(e) => block.setBody(e.target.value)}
                    placeholder="Email body (HTML or plain text)…"
                    rows={6}
                    className="min-h-[120px] border-slate-200 text-[12px]"
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-4">
            <label className="text-[12px] font-medium text-slate-700">Additionally email to (optional)</label>
            <p className="text-[11px] text-slate-500">Extra recipients (comma-separated emails) for staff notifications.</p>
            <input
              type="text"
              value={emAdditionally}
              onChange={(e) => setEmAdditionally(e.target.value)}
              placeholder="ops@firm.co.za, admin@firm.co.za"
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#C8A96E" }}
              disabled={savingEmails}
              onClick={() => void handleSaveEmails()}
            >
              {savingEmails ? "Saving…" : "Save templates"}
            </Button>
          </div>
        </>
      )}
      {footer}
    </div>
  );
}
