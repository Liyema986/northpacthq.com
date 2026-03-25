"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { AddVersionSheet } from "@/components/sheets/AddVersionSheet";
import { PrincipalSheet } from "@/components/sheets/PrincipalSheet";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  Copy,
  Trash2,
  X,
  Upload,
  Building2,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ServiceCatalogueClauses } from "@/components/engagement/ServiceCatalogueClauses";

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "suite", label: "Engagement Letter Suite" },
  { id: "letterhead", label: "Letterhead Components" },
  { id: "key-dates", label: "Key Dates" },
  { id: "key-people", label: "Key People" },
  { id: "emails", label: "Emails" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EngagementLettersSettingsPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  // Convex data
  const convexVersions = useQuery(api.engagementLetters.listLetterVersions, userId ? { userId } : "skip");
  const convexPrincipals = useQuery(api.principals.listPrincipals, userId ? { userId } : "skip");
  const suiteSettings = useQuery(api.engagementLetters.getEngagementSuiteSettings, userId ? { userId } : "skip");
  const keyDatesSettings = useQuery(api.engagementLetters.getKeyDatesSettings, userId ? { userId } : "skip");
  const letterheadUi = useQuery(api.engagementLetters.getEngagementLetterheadForUi, userId ? { userId } : "skip");
  const emailTemplates = useQuery(api.engagementLetters.getEngagementEmailTemplates, userId ? { userId } : "skip");
  const duplicateVersionMutation = useMutation(api.engagementLetters.duplicateLetterVersion);
  const deleteVersionMutation = useMutation(api.engagementLetters.deleteLetterVersion);
  const reorderVersionsMutation = useMutation(api.engagementLetters.reorderLetterVersions);
  const deletePrincipalMutation = useMutation(api.principals.deletePrincipal);
  const reorderPrincipalsMutation = useMutation(api.principals.reorderPrincipals);
  const updateSuiteMutation = useMutation(api.engagementLetters.updateEngagementSuiteSettings);
  const updateKeyDatesMutation = useMutation(api.engagementLetters.updateKeyDatesSettings);
  const updateEmailTemplatesMutation = useMutation(api.engagementLetters.updateEngagementEmailTemplates);
  const updateFirmMutation = useMutation(api.authFunctions.updateFirm);
  const generateLogoUploadUrl = useMutation(api.authFunctions.generateLogoUploadUrl);
  const clearFirmLogoMutation = useMutation(api.authFunctions.clearFirmLogo);

  const versions = useMemo(() => convexVersions ?? [], [convexVersions]);
  const principals = useMemo(() => convexPrincipals ?? [], [convexPrincipals]);

  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    suite: false,
    letterhead: false,
    "key-dates": false,
    "key-people": false,
    emails: false,
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  function setSectionOpen(id: SectionId, open: boolean) {
    setOpenSections((prev) => ({ ...prev, [id]: open }));
    if (open && typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  useEffect(() => {
    const valid: SectionId[] = ["suite", "letterhead", "key-dates", "key-people", "emails"];
    const parseHash = () => {
      const h = window.location.hash.slice(1) as SectionId;
      if (!valid.includes(h)) return;
      setOpenSections({
        suite: h === "suite",
        letterhead: h === "letterhead",
        "key-dates": h === "key-dates",
        "key-people": h === "key-people",
        emails: h === "emails",
      });
    };
    parseHash();
    window.addEventListener("hashchange", parseHash);
    return () => window.removeEventListener("hashchange", parseHash);
  }, []);

  const [emailTab, setEmailTab] = useState<"signed" | "acceptance">("signed");

  /** Nested suite panels: closed by default; reset when the parent Engagement Letter Suite section collapses */
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(false);

  useEffect(() => {
    if (!openSections.suite) {
      setSuiteOpen(false);
      setCatalogueOpen(false);
      setGlobalOpen(false);
    }
  }, [openSections.suite]);
  const [terms, setTerms] = useState("");
  const [scheduleIntro, setScheduleIntro] = useState("");
  const [agreementSig, setAgreementSig] = useState("");
  const [agreementNoSig, setAgreementNoSig] = useState("");
  const [privacyOn, setPrivacyOn] = useState(false);
  const [privacyContent, setPrivacyContent] = useState("");
  const [savingSuite, setSavingSuite] = useState(false);
  const [kdIntro, setKdIntro] = useState("");
  const [kdInfo, setKdInfo] = useState("");
  const [kdFiling, setKdFiling] = useState("");
  const [savingKd, setSavingKd] = useState(false);

  /** Letterhead (firm logo + PDF footer fields + directors list) */
  const [lhPractice, setLhPractice] = useState("");
  const [lhFooter, setLhFooter] = useState("");
  const [lhDirectors, setLhDirectors] = useState("");
  const [lhLogoPreview, setLhLogoPreview] = useState<string | null>(null);
  const [lhLogoFile, setLhLogoFile] = useState<File | null>(null);
  const [savingLetterhead, setSavingLetterhead] = useState(false);

  /** Email templates (per tab) */
  const [emClientSub, setEmClientSub] = useState("");
  const [emClientBody, setEmClientBody] = useState("");
  const [emAddSub, setEmAddSub] = useState("");
  const [emAddBody, setEmAddBody] = useState("");
  const [emStaffSub, setEmStaffSub] = useState("");
  const [emStaffBody, setEmStaffBody] = useState("");
  const [emAdditionally, setEmAdditionally] = useState("");
  const [savingEmails, setSavingEmails] = useState(false);

  /** Principal sheet */
  const [principalSheetOpen, setPrincipalSheetOpen] = useState(false);
  const [principalSheetMode, setPrincipalSheetMode] = useState<"create" | "edit">("create");
  const [editingPrincipalId, setEditingPrincipalId] = useState<Id<"principals"> | null>(null);

  useEffect(() => {
    if (!suiteSettings) return;
    setTerms(suiteSettings.termsAndConditions ?? "");
    setScheduleIntro(suiteSettings.scheduleOfServicesIntroduction ?? "");
    setAgreementSig(suiteSettings.agreementSignatureVersion ?? "");
    setAgreementNoSig(suiteSettings.agreementNoSignatureVersion ?? "");
    setPrivacyOn(suiteSettings.privacyNoticeEnabled ?? false);
    setPrivacyContent(suiteSettings.privacyNoticeContent ?? "");
  }, [suiteSettings]);

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

  const [deleteVersionId, setDeleteVersionId] = useState<Id<"engagementLetterVersions"> | null>(null);
  const [deletePrincipalId, setDeletePrincipalId] = useState<Id<"principals"> | null>(null);

  const loadingVersions = convexVersions === undefined;
  const loadingPrincipals = convexPrincipals === undefined;

  async function handleDeleteVersion() {
    if (!deleteVersionId || !userId) return;
    try {
      await deleteVersionMutation({ userId, versionId: deleteVersionId });
      toast.success("Letter version removed");
    } catch { toast.error("Failed to remove version"); }
    setDeleteVersionId(null);
  }

  async function handleDuplicateVersion(id: Id<"engagementLetterVersions">) {
    if (!userId) return;
    try {
      await duplicateVersionMutation({ userId, versionId: id });
      toast.success("Letter version duplicated");
    } catch { toast.error("Failed to duplicate version"); }
  }

  async function moveVersion(index: number, dir: "up" | "down") {
    if (!userId || versions.length < 2) return;
    const next = dir === "up" ? index - 1 : index + 1;
    if (next < 0 || next >= versions.length) return;
    const copy = [...versions];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    const newOrder = copy.map((v) => v._id);
    try {
      await reorderVersionsMutation({ userId, versionIds: newOrder });
    } catch { toast.error("Failed to reorder"); }
  }

  async function handleDeletePrincipal() {
    if (!deletePrincipalId || !userId) return;
    try {
      await deletePrincipalMutation({ userId, principalId: deletePrincipalId });
      toast.success("Principal removed");
    } catch { toast.error("Failed to remove principal"); }
    setDeletePrincipalId(null);
  }

  async function handleSaveSuite() {
    if (!userId) return;
    setSavingSuite(true);
    try {
      await updateSuiteMutation({
        userId,
        termsAndConditions: terms.trim() || undefined,
        scheduleOfServicesIntroduction: scheduleIntro.trim() || undefined,
        agreementSignatureVersion: agreementSig.trim() || undefined,
        agreementNoSignatureVersion: agreementNoSig.trim() || undefined,
        privacyNoticeEnabled: privacyOn,
        privacyNoticeContent: privacyContent.trim() || undefined,
      });
      toast.success("Global settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSuite(false);
    }
  }

  async function handleSaveKeyDates() {
    if (!userId) return;
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
    if (!userId) return;
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
    if (!userId) return;
    try {
      await clearFirmLogoMutation({ userId });
      setLhLogoFile(null);
      toast.success("Logo removed");
    } catch {
      toast.error("Failed to remove logo");
    }
  }

  async function handleSaveEmails() {
    if (!userId) return;
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

  async function movePrincipal(index: number, dir: "up" | "down") {
    if (!userId || principals.length < 2) return;
    const next = dir === "up" ? index - 1 : index + 1;
    if (next < 0 || next >= principals.length) return;
    const copy = [...principals];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    const newOrder = copy.map((p) => p._id);
    try {
      await reorderPrincipalsMutation({ userId, principalIds: newOrder });
    } catch { toast.error("Failed to reorder"); }
  }

  return (
    <>
      <Header className="h-auto min-h-14 items-start py-2.5">
        <div className="flex min-w-0 flex-col gap-0.5 pr-2">
          <Link
            href="/engagement-letters"
            className="inline-flex w-fit items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
            Back to scope templates
          </Link>
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Suite &amp; firm settings</h1>
          <p className="hidden max-w-2xl text-xs text-muted-foreground sm:block">
            Letterhead, key dates, people, emails, and global scope text — all in one place.
          </p>
        </div>
      </Header>
      <div className="px-6 py-6 max-w-[1600px]">
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ── Suite section ──────────────────────────────────────────────────── */}
        <Collapsible open={openSections.suite} onOpenChange={(o) => setSectionOpen("suite", o)}>
          <div className="bg-white px-4 py-3 sm:px-5">
            <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent py-0.5 text-left shadow-none outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300/40 focus-visible:ring-offset-2">
              <span className="text-[13px] font-semibold text-slate-900">Engagement Letter Suite</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200", openSections.suite && "rotate-180")}
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="space-y-4 border-t border-slate-200 bg-white px-4 pb-5 pt-4 sm:px-5">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-slate-200 px-4 text-[12px] font-medium"
                onClick={() => setSheetOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add version
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Collapsible open={suiteOpen} onOpenChange={setSuiteOpen}>
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-[13px] text-slate-900">
                    {suiteOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Scope Library
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="p-4 space-y-3">
                    <p className="text-[11px] text-slate-500">Build out your library of Scopes for the different entities you serve</p>
                    {loadingVersions ? (
                      <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : versions.length === 0 ? (
                      <div className="py-10 flex flex-col items-center gap-3">
                        <p className="text-[13px] text-slate-500">No letter versions yet</p>
                        <Button size="sm" className="text-white transition-opacity hover:opacity-90" style={{ background: "#C8A96E" }} onClick={() => setSheetOpen(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />Add New Version
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="divide-y divide-slate-200">
                          {versions.map((v, i) => (
                            <div key={`ver-${v._id}-${i}`} className="flex items-center gap-3 py-3 px-3">
                              <div className="flex items-center gap-1 shrink-0">
                                <button className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30" onClick={() => moveVersion(i, "up")} disabled={i === 0}>
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30" onClick={() => moveVersion(i, "down")} disabled={i === versions.length - 1}>
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <GripVertical className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="flex-1 min-w-0 text-[13px] font-medium text-slate-900 truncate">{v.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="outline" size="sm" className="h-8 px-2.5 text-[11px] border-slate-200" asChild>
                                  <Link href={`/engagement-letters/${v._id}`}>
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                                  </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 px-2.5 text-[11px] border-slate-200" onClick={() => handleDuplicateVersion(v._id)}>
                                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copy
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200" onClick={() => setDeleteVersionId(v._id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button size="sm" className="text-white transition-opacity hover:opacity-90" style={{ background: "#C8A96E" }} onClick={() => setSheetOpen(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />Add New Version
                        </Button>
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {userId && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Collapsible open={catalogueOpen} onOpenChange={setCatalogueOpen}>
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-[13px] text-slate-900">
                      {catalogueOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Service catalogue &amp; engagement clauses
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <ServiceCatalogueClauses userId={userId} />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Collapsible open={globalOpen} onOpenChange={setGlobalOpen}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent py-0.5 text-left font-semibold text-[13px] text-slate-900 shadow-none outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[#C8A96E]/30 focus-visible:ring-offset-2">
                    {globalOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />}
                    Global Settings
                  </CollapsibleTrigger>
                  <Button
                    size="sm"
                    className="shrink-0 rounded-full px-5 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#C8A96E" }}
                    disabled={savingSuite || suiteSettings === undefined}
                    onClick={handleSaveSuite}
                  >
                    {savingSuite ? "Saving…" : "Save"}
                  </Button>
                </div>
                <CollapsibleContent>
                  <div className="space-y-5 p-4">
                    <div className="space-y-1.5">
                      <p className="text-[13px] font-medium text-slate-800">Terms and Conditions</p>
                      <p className="text-[11px] text-slate-500">
                        Adding your terms here will overwrite any terms added via the letter versions above.
                      </p>
                      <textarea
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        rows={5}
                        className="w-full rounded-xl border border-slate-200 p-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                        placeholder="Terms HTML or plain text…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[13px] font-medium text-slate-800">Schedule of Services Introduction</p>
                      <p className="text-[11px] text-slate-500">
                        Appears above the Schedule of Services section, alongside catalogue clauses from Services.
                      </p>
                      <textarea
                        value={scheduleIntro}
                        onChange={(e) => setScheduleIntro(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 p-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[13px] font-medium text-slate-800">Confirmation (Signature Version)</p>
                      <p className="text-[11px] text-slate-500">Agreement statement your client signs.</p>
                      <textarea
                        value={agreementSig}
                        onChange={(e) => setAgreementSig(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 p-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[13px] font-medium text-slate-800">Confirmation (No signature version)</p>
                      <textarea
                        value={agreementNoSig}
                        onChange={(e) => setAgreementNoSig(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 p-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="privacy-on"
                        type="checkbox"
                        checked={privacyOn}
                        onChange={(e) => setPrivacyOn(e.target.checked)}
                        className="size-4 rounded-md border-slate-300 text-[#C8A96E] focus:ring-[#C8A96E]/25"
                      />
                      <label htmlFor="privacy-on" className="text-[13px] font-medium text-slate-800">
                        Include privacy notice
                      </label>
                    </div>
                    {privacyOn && (
                      <textarea
                        value={privacyContent}
                        onChange={(e) => setPrivacyContent(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 p-3 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                        placeholder="Privacy notice content…"
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Letterhead section ─────────────────────────────────────────────── */}
        <Collapsible open={openSections.letterhead} onOpenChange={(o) => setSectionOpen("letterhead", o)}>
          <div className="bg-white px-4 py-3 sm:px-5">
            <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent py-0.5 text-left shadow-none outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300/40 focus-visible:ring-offset-2">
              <span className="text-[13px] font-semibold text-slate-900">Letterhead Components</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200", openSections.letterhead && "rotate-180")}
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
          <div className="space-y-5 border-t border-slate-200 bg-white px-4 pb-5 pt-4 sm:px-5">
            <div>
              <p className="text-[12px] text-slate-500">
                Firm logo and practice address are shared with proposal PDFs (Settings → Proposals). Footer text below is the same{" "}
                <span className="font-medium text-slate-600">PDF footer</span> field.
              </p>
            </div>
            {letterheadUi === undefined ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      className="text-[12px] border-slate-200"
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
                    className="text-[12px] border-slate-200"
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
                    className="text-[12px] border-slate-200"
                    placeholder="Name (Role), …"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#C8A96E" }}
                    disabled={savingLetterhead || !userId || letterheadUi === undefined}
                    onClick={handleSaveLetterhead}
                  >
                    {savingLetterhead ? "Saving…" : "Save letterhead"}
                  </Button>
                </div>
              </>
            )}
          </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Key Dates section ──────────────────────────────────────────────── */}
        <Collapsible open={openSections["key-dates"]} onOpenChange={(o) => setSectionOpen("key-dates", o)}>
          <div className="bg-white px-4 py-3 sm:px-5">
            <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent py-0.5 text-left shadow-none outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300/40 focus-visible:ring-offset-2">
              <span className="text-[13px] font-semibold text-slate-900">Key Dates</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200", openSections["key-dates"] && "rotate-180")}
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
          <div className="space-y-5 border-t border-slate-200 bg-white px-4 pb-5 pt-4 sm:px-5">
            <p className="text-[12px] text-slate-500">Configure key deadline headings and the introduction paragraph that appears above the key dates table.</p>
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium text-slate-700">Key Dates Table Introduction</p>
              <p className="text-[11px] text-slate-500">Appears above the key dates table at the bottom of the Introduction.</p>
              <textarea
                value={kdIntro}
                onChange={(e) => setKdIntro(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-200 p-3 text-[12px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                placeholder="Please see below the key dates for this engagement:"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-slate-700">Deadline for all Information</p>
                <input
                  type="text"
                  value={kdInfo}
                  onChange={(e) => setKdInfo(e.target.value)}
                  className="w-full h-9 px-3 text-[12px] border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                  placeholder="Column heading"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[12px] font-medium text-slate-700">Filing Deadline</p>
                <input
                  type="text"
                  value={kdFiling}
                  onChange={(e) => setKdFiling(e.target.value)}
                  className="w-full h-9 px-3 text-[12px] border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                  placeholder="Column heading"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                className="text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "#C8A96E" }}
                disabled={savingKd || keyDatesSettings === undefined || !userId}
                onClick={handleSaveKeyDates}
              >
                {savingKd ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Key People section ─────────────────────────────────────────────── */}
        <Collapsible open={openSections["key-people"]} onOpenChange={(o) => setSectionOpen("key-people", o)}>
          <div className="bg-white px-4 py-3 sm:px-5">
            <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent py-0.5 text-left shadow-none outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300/40 focus-visible:ring-offset-2">
              <span className="text-[13px] font-semibold text-slate-900">Key People</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200", openSections["key-people"] && "rotate-180")}
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
          <div className="space-y-4 border-t border-slate-200 bg-white px-4 pb-5 pt-4 sm:px-5">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-slate-200 px-4 text-[12px] font-medium"
                onClick={() => {
                  setPrincipalSheetMode("create");
                  setEditingPrincipalId(null);
                  setPrincipalSheetOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add principal
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {loadingPrincipals ? (
                <div className="p-4 space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : principals.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3">
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
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Add New Principal
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {principals.map((p, i) => (
                    <div key={`${p._id}-${i}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50">
                      <div className="flex items-center gap-1 shrink-0">
                        <button className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30" onClick={() => movePrincipal(i, "up")} disabled={i === 0}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30" onClick={() => movePrincipal(i, "down")} disabled={i === principals.length - 1}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <GripVertical className="h-4 w-4 text-slate-400 shrink-0" />
                      <p className="flex-1 min-w-0 text-[13px] font-medium text-slate-900 truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-[11px] border-slate-200"
                          onClick={() => {
                            setPrincipalSheetMode("edit");
                            setEditingPrincipalId(p._id);
                            setPrincipalSheetOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200" onClick={() => setDeletePrincipalId(p._id)}>
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
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Add New Principal
                </Button>
              </div>
            )}
          </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Emails section ─────────────────────────────────────────────────── */}
        <Collapsible open={openSections.emails} onOpenChange={(o) => setSectionOpen("emails", o)}>
          <div className="bg-white px-4 py-3 sm:px-5">
            <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 border-0 bg-transparent py-0.5 text-left shadow-none outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[#C8A96E]/30 focus-visible:ring-offset-2">
              <span className="text-[13px] font-semibold text-slate-900">Emails</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200", openSections.emails && "rotate-180")}
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
          <div className="space-y-4 border-t border-slate-200 bg-white px-4 pb-5 pt-4 sm:px-5">
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-[12px] leading-snug">
                <span className="font-semibold text-slate-900">
                  {emailTab === "signed" ? "Signed & Accepted Email Templates" : "Acceptance Button Email Templates"}
                </span>
                <span className="text-slate-300"> · </span>
                <span className="text-slate-500">
                  {emailTab === "signed"
                    ? "Configure the emails sent automatically when a client signs their engagement letter."
                    : "Configure the emails used for the acceptance button flow."}
                </span>
              </p>
              <div className="shrink-0">
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setEmailTab("signed")}
                    className={cn(
                      "h-8 shrink-0 rounded-full px-3.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]/35 focus-visible:ring-offset-2",
                      emailTab === "signed"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Signed &amp; Accepted
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailTab("acceptance")}
                    className={cn(
                      "h-8 shrink-0 rounded-full px-3.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]/35 focus-visible:ring-offset-2",
                      emailTab === "acceptance"
                        ? "bg-primary text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Acceptance Button Only
                  </button>
                </div>
              </div>
            </div>
            {emailTemplates === undefined ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
            ) : (
              <>
                {[
                  { title: "Client Email", sub: emClientSub, setSub: setEmClientSub, body: emClientBody, setBody: setEmClientBody },
                  { title: "Additional Signatory Email", sub: emAddSub, setSub: setEmAddSub, body: emAddBody, setBody: setEmAddBody },
                  { title: "Staff Notification Email", sub: emStaffSub, setSub: setEmStaffSub, body: emStaffBody, setBody: setEmStaffBody },
                ].map((block) => (
                  <div key={block.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-600">Content</label>
                        <Textarea
                          value={block.body}
                          onChange={(e) => block.setBody(e.target.value)}
                          placeholder="Email body (HTML or plain text)…"
                          rows={6}
                          className="min-h-[120px] rounded-xl border-slate-200 text-[12px] focus-visible:ring-[#C8A96E]/25"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-4">
                  <label className="text-[12px] font-medium text-slate-700">Additionally email to (optional)</label>
                  <p className="text-[11px] text-slate-500">Extra recipients (comma-separated emails) for staff notifications.</p>
                  <input
                    type="text"
                    value={emAdditionally}
                    onChange={(e) => setEmAdditionally(e.target.value)}
                    placeholder="ops@firm.co.za, admin@firm.co.za"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/25"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="rounded-full px-5 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#C8A96E" }}
                    disabled={savingEmails || !userId}
                    onClick={handleSaveEmails}
                  >
                    {savingEmails ? "Saving…" : "Save templates"}
                  </Button>
                </div>
              </>
            )}
          </div>
          </CollapsibleContent>
        </Collapsible>
        </div>

        {/* Delete version dialog */}
        <AlertDialog open={!!deleteVersionId} onOpenChange={(o) => !o && setDeleteVersionId(null)}>
          <AlertDialogContent>
            <div className="flex items-start justify-between gap-4">
              <AlertDialogHeader className="flex-1 space-y-2 text-left">
                <AlertDialogTitle>Remove letter version?</AlertDialogTitle>
                <AlertDialogDescription>This will remove the letter version. You can add it again later.</AlertDialogDescription>
              </AlertDialogHeader>
              <button onClick={() => setDeleteVersionId(null)} className="-m-1 p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteVersion} className="bg-red-600 hover:bg-red-700">Yes, remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete principal dialog */}
        <AlertDialog open={!!deletePrincipalId} onOpenChange={(o) => !o && setDeletePrincipalId(null)}>
          <AlertDialogContent>
            <div className="flex items-start justify-between gap-4">
              <AlertDialogHeader className="flex-1 space-y-2 text-left">
                <AlertDialogTitle>Remove principal?</AlertDialogTitle>
                <AlertDialogDescription>This will remove the principal from your engagement letters.</AlertDialogDescription>
              </AlertDialogHeader>
              <button onClick={() => setDeletePrincipalId(null)} className="-m-1 p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePrincipal} className="bg-red-600 hover:bg-red-700">Yes, remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AddVersionSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          userId={userId}
          onSuccess={() => toast.success("Version added to library")}
        />

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
    </>
  );
}
