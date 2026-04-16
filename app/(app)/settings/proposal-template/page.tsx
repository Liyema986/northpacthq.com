"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { toast } from "sonner";
import {
  Save, ChevronLeft, Palette, FileText, Users, Wallet, Clock, ArrowRight,
  Quote, Info, Globe, Trash2, Plus, GripVertical, Eye, EyeOff, Loader2,
  PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose,
  Layers, BookOpen, Footprints, CreditCard, Download, Upload, ImageIcon, Pencil, X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ProposalReviewPDFPreview } from "@/components/pdf/ProposalReviewPDFPreview";
import type { ProposalPDFData } from "@/lib/pdf-types";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors";
const textareaCls = `${inputCls} min-h-[80px] resize-none`;

const ACCENT = "#C8A96E";

// ── Section definitions for left nav ────────────────────────────────────────

type SectionKey = "branding" | "cover" | "intro" | "about" | "team" | "fees" | "timeline" | "nextSteps" | "closing" | "footer";

const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; toggleable?: boolean }[] = [
  { key: "branding",  label: "Branding & Colors", icon: Palette },
  { key: "cover",     label: "Cover Page",        icon: BookOpen,    toggleable: true },
  { key: "intro",     label: "Introduction",      icon: Info,        toggleable: true },
  { key: "about",     label: "About Us",          icon: Globe,       toggleable: true },
  { key: "team",      label: "Your Team",         icon: Users,       toggleable: true },
  { key: "fees",      label: "Fees & Payment",    icon: Wallet,      toggleable: true },
  { key: "timeline",  label: "Timeline",          icon: Clock,       toggleable: true },
  { key: "nextSteps", label: "Next Steps",        icon: ArrowRight,  toggleable: true },
  { key: "closing",   label: "Closing Page",      icon: Quote,       toggleable: true },
  { key: "footer",    label: "Footer & Details",  icon: Footprints },
];

// ── Helper ──────────────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px]">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ProposalTemplatePage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const data = useQuery(api.firms.getProposalTemplateData, userId ? { userId } : "skip");
  const updateTemplate = useMutation(api.firms.updateProposalTemplate);
  const updateTeamMember = useMutation(api.firms.updateTeamMember);
  const updateTeamMemberAvatar = useMutation(api.firms.updateTeamMemberAvatar);
  const clearTeamMemberAvatar = useMutation(api.firms.clearTeamMemberAvatar);

  const generateUploadUrl = useMutation(api.authFunctions.generateLogoUploadUrl);
  const updateFirmMut = useMutation(api.authFunctions.updateFirm);
  const clearPdfImage = useMutation(api.authFunctions.clearFirmPdfImage);

  const [saving, setSaving] = useState(false);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionKey>("branding");
  const downloadFnRef = useRef<(() => void) | null>(null);
  const coverLogoInputRef = useRef<HTMLInputElement>(null);
  const footerLogoInputRef = useRef<HTMLInputElement>(null);

  // ── Form state ──
  const [coverQuote, setCoverQuote] = useState("");
  const [coverQuoteAuthor, setCoverQuoteAuthor] = useState("");
  const [introText, setIntroText] = useState("");
  const [aboutUsHtml, setAboutUsHtml] = useState("");
  const [missionStatement, setMissionStatement] = useState("");
  const [whyChooseUsItems, setWhyChooseUsItems] = useState<string[]>([]);
  const [valuesStatement, setValuesStatement] = useState("");
  const [website, setWebsite] = useState("");
  const [feesIntroText, setFeesIntroText] = useState("");
  const [paymentTermsText, setPaymentTermsText] = useState("");
  const [whatHappensNextText, setWhatHappensNextText] = useState("");
  const [closingQuote, setClosingQuote] = useState("");
  const [closingQuoteAuthor, setClosingQuoteAuthor] = useState("");
  const [footerText, setFooterText] = useState("");
  const [footerAddress, setFooterAddress] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [signOffBlock, setSignOffBlock] = useState("");
  const [bankingDetails, setBankingDetails] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#5DBEB4");
  const [secondaryColor, setSecondaryColor] = useState("#4A90E2");
  const [timelineSteps, setTimelineSteps] = useState<{ marker: string; title: string; description: string }[]>([]);
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [teamEdits, setTeamEdits] = useState<Record<string, { jobTitle: string; bio: string; phone: string }>>({});
  const [coverLogoPreview, setCoverLogoPreview] = useState<string | null>(null);
  const [footerLogoPreview, setFooterLogoPreview] = useState<string | null>(null);
  const [teamAvatars, setTeamAvatars] = useState<Record<string, string | null>>({});
  const teamAvatarInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleTeamAvatarUpload = useCallback(async (file: File, memberId: string) => {
    if (!userId) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image (PNG, JPG, or WebP)."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be 2 MB or smaller."); return; }
    try {
      const uploadUrl = await generateUploadUrl({ userId });
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) { toast.error("Upload failed"); return; }
      const json = (await res.json()) as { storageId?: Id<"_storage"> };
      if (!json.storageId) { toast.error("Upload failed"); return; }
      const result = await updateTeamMemberAvatar({ userId, targetUserId: memberId as Id<"users">, storageId: json.storageId });
      if (result.avatarUrl) {
        setTeamAvatars((prev) => ({ ...prev, [memberId]: result.avatarUrl! }));
      }
      toast.success("Photo uploaded");
    } catch { toast.error("Upload failed"); }
  }, [userId, generateUploadUrl, updateTeamMemberAvatar]);

  const handleClearTeamAvatar = useCallback(async (memberId: string) => {
    if (!userId) return;
    try {
      await clearTeamMemberAvatar({ userId, targetUserId: memberId as Id<"users"> });
      setTeamAvatars((prev) => ({ ...prev, [memberId]: null }));
      toast.success("Photo removed");
    } catch { toast.error("Failed to remove photo"); }
  }, [userId, clearTeamMemberAvatar]);

  const handleImageUpload = useCallback(async (
    file: File,
    field: "pdfCoverImage" | "pdfFooterImage",
    setPreview: (v: string | null) => void,
  ) => {
    if (!userId) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image (PNG, JPG, or WebP)."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be 2 MB or smaller."); return; }
    try {
      const uploadUrl = await generateUploadUrl({ userId });
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) { toast.error("Upload failed"); return; }
      const json = (await res.json()) as { storageId?: Id<"_storage"> };
      if (!json.storageId) { toast.error("Upload failed"); return; }
      await updateFirmMut({ userId, [field]: json.storageId });
      // Show local preview immediately
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      toast.success("Image uploaded");
    } catch { toast.error("Upload failed"); }
  }, [userId, generateUploadUrl, updateFirmMut]);

  const handleClearImage = useCallback(async (field: "pdfCoverImage" | "pdfFooterImage", setPreview: (v: string | null) => void) => {
    if (!userId) return;
    try {
      await clearPdfImage({ userId, field });
      setPreview(null);
      toast.success("Image removed");
    } catch { toast.error("Failed to remove image"); }
  }, [userId, clearPdfImage]);

  // ── Load data ──
  useEffect(() => {
    if (!data) return;
    setCoverQuote(data.coverQuote);
    setCoverQuoteAuthor(data.coverQuoteAuthor);
    setIntroText(data.proposalBuilderDefaultIntro);
    setAboutUsHtml(data.aboutUsHtml);
    setMissionStatement(data.missionStatement);
    setWhyChooseUsItems(data.whyChooseUsItems);
    setValuesStatement(data.valuesStatement);
    setWebsite(data.website);
    setFeesIntroText(data.feesIntroductionText);
    setPaymentTermsText(data.paymentTermsText);
    setWhatHappensNextText(data.whatHappensNextText);
    setClosingQuote(data.closingQuote);
    setClosingQuoteAuthor(data.closingQuoteAuthor);
    setFooterText(data.pdfFooterText);
    setFooterAddress(data.pdfFooterAddress);
    setDisclaimer(data.pdfDisclaimer);
    setSignOffBlock(data.pdfSignOffBlock);
    setBankingDetails(data.pdfBankingDetails);
    setPrimaryColor(data.brandColors?.primary || "#5DBEB4");
    setSecondaryColor(data.brandColors?.secondary || "#4A90E2");
    setTimelineSteps(data.defaultTimelineSteps.length > 0 ? data.defaultTimelineSteps : [
      { marker: "W1", title: "Week 1: Onboarding & Setup", description: "Initial meeting, system setup, and team introductions." },
      { marker: "W2", title: "Week 2-4: First Month Transition", description: "Daily processing begins, weekly check-ins." },
      { marker: "M2+", title: "Month 2 Onwards", description: "Ongoing monthly services and quarterly reviews." },
    ]);
    setSections(data.proposalTemplateSections as Record<string, boolean>);
    const edits: Record<string, { jobTitle: string; bio: string; phone: string }> = {};
    data.teamMembers.forEach((m) => { edits[m._id] = { jobTitle: m.role, bio: m.bio, phone: m.phone }; });
    setTeamEdits(edits);
    const avatars: Record<string, string | null> = {};
    data.teamMembers.forEach((m) => { avatars[m._id] = m.proposalPhoto || null; });
    setTeamAvatars(avatars);
    setCoverLogoPreview(data.coverImageUrl);
    setFooterLogoPreview(data.footerImageUrl);
  }, [data]);

  const isSectionEnabled = (key: string) => sections[key] !== false;
  const toggleSection = (key: string, val: boolean) => setSections((prev) => ({ ...prev, [key]: val }));

  // ── Save ──
  const isValidWebsite = (url: string) => !url.trim() || /^(https?:\/\/)?[\w][\w.-]*\.[a-z]{2,}(\/\S*)?$/i.test(url.trim());

  const handleSave = useCallback(async () => {
    if (!userId) return;
    if (!isValidWebsite(website)) {
      toast.error("Please enter a valid website URL or leave it blank.");
      return;
    }
    const invalidPhone = Object.values(teamEdits).find((e) => e.phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(e.phone.trim()));
    if (invalidPhone) {
      toast.error("Please fix the invalid phone number in your team details.");
      return;
    }
    const missingTitle = Object.values(teamEdits).find((e) => !e.jobTitle.trim());
    if (missingTitle) {
      toast.error("Please add a job title for all team members.");
      return;
    }
    setSaving(true);
    try {
      await updateTemplate({
        userId, coverQuote, coverQuoteAuthor, closingQuote, closingQuoteAuthor,
        proposalBuilderDefaultIntro: introText, aboutUsHtml, missionStatement,
        whyChooseUsItems, valuesStatement, website, feesIntroductionText: feesIntroText,
        paymentTermsText, whatHappensNextText, pdfFooterText: footerText,
        pdfFooterAddress: footerAddress, pdfDisclaimer: disclaimer,
        pdfSignOffBlock: signOffBlock, pdfBankingDetails: bankingDetails,
        brandColors: { primary: primaryColor, secondary: secondaryColor },
        defaultTimelineSteps: timelineSteps, proposalTemplateSections: sections,
      });
      for (const [memberId, edits] of Object.entries(teamEdits)) {
        await updateTeamMember({ userId, targetUserId: memberId as Id<"users">, jobTitle: edits.jobTitle, bio: edits.bio, phone: edits.phone });
      }
      toast.success("Proposal template saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save template");
    } finally { setSaving(false); }
  }, [
    userId, updateTemplate, updateTeamMember, coverQuote, coverQuoteAuthor, closingQuote, closingQuoteAuthor,
    introText, aboutUsHtml, missionStatement, whyChooseUsItems, valuesStatement, website,
    feesIntroText, paymentTermsText, whatHappensNextText, footerText, footerAddress,
    disclaimer, signOffBlock, bankingDetails, primaryColor, secondaryColor, timelineSteps, sections, teamEdits,
  ]);

  // ── Preview data ──
  // Memoize to prevent re-generating the PDF on every render (e.g. clicking tabs)
  const previewData: ProposalPDFData = useMemo(() => ({
    firmName: data?.firmName ?? "Your Firm",
    proposalNumber: "PROP-2026-001",
    title: "Sample Proposal",
    clientName: "Sample Client (Pty) Ltd",
    clientEmail: "client@example.com",
    clientPhone: "+27 12 345 6789",
    entities: [{ name: "Entity A", type: "pty" }, { name: "Entity B", type: "pty" }],
    services: [
      { serviceName: "Monthly Bookkeeping", quantity: 1, subtotal: 5000, billingCategory: "monthly", description: "Full monthly accounting and reconciliation services.", entityLabels: ["Entity A"] },
      { serviceName: "VAT Returns", quantity: 1, subtotal: 1500, billingCategory: "monthly", description: "Preparation and submission of bi-monthly VAT returns.", entityLabels: ["Entity A"] },
      { serviceName: "Annual Financial Statements", quantity: 1, subtotal: 15000, billingCategory: "yearly", description: "Preparation of annual financial statements.", entityLabels: ["Entity B"] },
      { serviceName: "Income Tax Return", quantity: 1, subtotal: 5000, billingCategory: "yearly", description: "Annual income tax return preparation and submission.", entityLabels: ["Entity B"] },
    ],
    total: 26500, currency: "ZAR", introText: introText || undefined, createdAt: Date.now(),
    firmLogo: data?.logoUrl ?? undefined,
    coverImageUrl: coverLogoPreview ?? data?.coverImageUrl ?? undefined,
    footerImageUrl: footerLogoPreview ?? data?.footerImageUrl ?? undefined,
    brandColors: { primary: primaryColor, secondary: secondaryColor },
    footerText: footerText || undefined, footerAddress: footerAddress || undefined,
    disclaimer: disclaimer || undefined, signOffBlock: signOffBlock || undefined,
    bankingDetails: bankingDetails || undefined,
    coverQuote: isSectionEnabled("cover") ? (coverQuote || undefined) : undefined,
    coverQuoteAuthor: isSectionEnabled("cover") ? (coverQuoteAuthor || undefined) : undefined,
    closingQuote: isSectionEnabled("closing") ? (closingQuote || undefined) : undefined,
    closingQuoteAuthor: isSectionEnabled("closing") ? (closingQuoteAuthor || undefined) : undefined,
    aboutUsHtml: isSectionEnabled("about") ? (aboutUsHtml || undefined) : undefined,
    missionStatement: isSectionEnabled("about") ? (missionStatement || undefined) : undefined,
    whyChooseUsItems: isSectionEnabled("about") && whyChooseUsItems.length > 0 ? whyChooseUsItems : undefined,
    valuesStatement: isSectionEnabled("about") ? (valuesStatement || undefined) : undefined,
    website: website || undefined,
    teamMembers: isSectionEnabled("team")
      ? (data?.teamMembers ?? []).map((m) => ({ name: m.name, role: teamEdits[m._id]?.jobTitle || m.role, bio: teamEdits[m._id]?.bio || m.bio, avatarUrl: teamAvatars[m._id] || m.proposalPhoto || undefined }))
      : undefined,
    feesIntroductionText: feesIntroText || undefined, paymentTermsText: paymentTermsText || undefined,
    whatHappensNextText: whatHappensNextText || undefined,
    timelineSteps: isSectionEnabled("timeline") ? timelineSteps : undefined,
    allFirmServices: [
      { name: "Monthly Financial Accounting Services" }, { name: "Payroll Services" },
      { name: "Annual Financial Accounting Services" }, { name: "Tax Services" },
      { name: "Audit and Assurance Services" }, { name: "Estate Planning & Executor Services" },
      { name: "Business Advisory Services" }, { name: "Family Business Consulting" },
      { name: "Trust Administration Services" }, { name: "Forensic Analysis" },
    ],
    advisorName: data?.teamMembers?.[0]?.name ?? "[ADVISOR NAME]",
    advisorTitle: data?.teamMembers?.[0]?.role ?? "[ADVISOR TITLE]",
    advisorEmail: data?.teamMembers?.[0]?.email ?? "[EMAIL]",
    advisorPhone: data?.teamMembers?.[0]?.phone ?? "[MOBILE]",
    netMonthlyFee: 6500, netAnnualFee: 20000,
  }), [
    data?.firmName, data?.logoUrl, data?.coverImageUrl, data?.footerImageUrl, data?.teamMembers,
    coverLogoPreview, footerLogoPreview,
    primaryColor, secondaryColor, introText, coverQuote, coverQuoteAuthor,
    closingQuote, closingQuoteAuthor, aboutUsHtml, missionStatement,
    whyChooseUsItems, valuesStatement, website, feesIntroText, paymentTermsText,
    whatHappensNextText, timelineSteps, sections, teamEdits, teamAvatars,
    footerText, footerAddress, disclaimer, signOffBlock, bankingDetails,
  ]);

  const isLoading = !userId || data === undefined;

  // ── Map section key → PDF page number (dynamic based on enabled sections) ──
  // Map each editor section to the PDF page it corresponds to.
  // Must match the actual page order in ProposalReviewPDFPreview.
  const sectionPageMap = (() => {
    const map: Record<SectionKey, number> = {} as Record<SectionKey, number>;
    let p = 1;
    map.branding = p;             // 1: cover page
    map.cover = p; p++;
    p++;                          // 2: contents
    map.intro = p; p++;           // 3: introduction
    const hasAbout = isSectionEnabled("about") && (aboutUsHtml || missionStatement || whyChooseUsItems.length);
    if (hasAbout) { map.about = p; p++; } else { map.about = p; }
    const hasTeam = isSectionEnabled("team") && (data?.teamMembers?.length ?? 0) > 0;
    if (hasTeam) { map.team = p; p++; } else { map.team = p; }
    map.fees = p; p++;            // fees page 1
    p++;                          // fees page 2 (entity breakdown)
    // fees may add more pages dynamically — skip investment summary page
    p++;                          // investment summary
    map.timeline = p; p++;        // service summary & timeline
    p++;                          // all services
    map.nextSteps = p; p++;       // next steps
    map.closing = p;              // closing page
    map.footer = 2;               // footer visible on contents page
    return map;
  })();

  const scrollToPage = sectionPageMap[activeSection] ?? 1;

  // ── Section editor content ──
  const renderSectionEditor = () => {
    switch (activeSection) {
      case "branding":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Primary color" hint="Cover page, headings, accents">
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded border border-slate-200 cursor-pointer" />
                  <input className={inputCls} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
              </Field>
              <Field label="Secondary color" hint="Subheadings, gradient end">
                <div className="flex items-center gap-2">
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 w-14 rounded border border-slate-200 cursor-pointer" />
                  <input className={inputCls} value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                </div>
              </Field>
            </div>
          </div>
        );
      case "cover":
        return (
          <div className="space-y-4">
            <Field label="Cover logo" hint="PNG, JPG or WebP. Max 2 MB. Shown centered at top of cover page.">
              <div className="flex items-center gap-3">
                {coverLogoPreview ? (
                  <div className="h-16 w-28 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                    <img src={coverLogoPreview} alt="Cover logo" className="max-h-14 max-w-24 object-contain" />
                  </div>
                ) : (
                  <div className="h-16 w-28 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => coverLogoInputRef.current?.click()}>
                    <Pencil className="h-3.5 w-3.5" /> {coverLogoPreview ? "Replace" : "Upload"}
                  </Button>
                  {coverLogoPreview && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleClearImage("pdfCoverImage", setCoverLogoPreview)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <input ref={coverLogoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "pdfCoverImage", setCoverLogoPreview); e.target.value = ""; }} />
              </div>
            </Field>
            <Field label="Cover quote" hint="Inspirational quote on the cover page">
              <textarea className={textareaCls} value={coverQuote} onChange={(e) => setCoverQuote(e.target.value)} placeholder='e.g. "If you think good accountants are expensive..."' />
            </Field>
            <Field label="Quote author">
              <input className={inputCls} value={coverQuoteAuthor} onChange={(e) => setCoverQuoteAuthor(e.target.value)} placeholder="e.g. Warren Buffett" />
            </Field>
          </div>
        );
      case "intro":
        return (
          <div className="space-y-4">
            <Field label="Default introduction text" hint="[CLIENT_NAME] is automatically replaced with the client's name.">
              <textarea className={cn(textareaCls, "min-h-[160px]")} value={introText} onChange={(e) => setIntroText(e.target.value)}
                placeholder="Dear [CLIENT_NAME],&#10;&#10;Thank you for the opportunity to present this proposal..." />
            </Field>
          </div>
        );
      case "about":
        return (
          <div className="space-y-4">
            <Field label="About your firm">
              <textarea className={cn(textareaCls, "min-h-[100px]")} value={aboutUsHtml} onChange={(e) => setAboutUsHtml(e.target.value)}
                placeholder="We are a leading financial advisory firm..." />
            </Field>
            <Field label="Mission statement">
              <textarea className={textareaCls} value={missionStatement} onChange={(e) => setMissionStatement(e.target.value)}
                placeholder="To empower businesses..." />
            </Field>
            <Field label="Why choose us?" hint="Drag to reorder. Bullet points highlighting your strengths.">
              <div className="space-y-2">
                {whyChooseUsItems.map((item, idx) => (
                  <div key={idx}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
                    onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      const to = idx;
                      if (from === to) return;
                      setWhyChooseUsItems((prev) => {
                        const next = [...prev];
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        return next;
                      });
                    }}
                    className="flex items-center gap-2"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />
                    <input className={cn(inputCls, "flex-1")} value={item}
                      onChange={(e) => setWhyChooseUsItems((prev) => prev.map((v, i) => i === idx ? e.target.value : v))} placeholder="e.g. Deep SA expertise" />
                    <button type="button" onClick={() => setWhyChooseUsItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setWhyChooseUsItems((prev) => [...prev, ""])}>
                  <Plus className="h-3.5 w-3.5" /> Add point
                </Button>
              </div>
            </Field>
            <Field label="Values statement">
              <textarea className={textareaCls} value={valuesStatement} onChange={(e) => setValuesStatement(e.target.value)}
                placeholder="Integrity, Excellence, Innovation..." />
            </Field>
            <Field label="Website" hint={website && !/^(https?:\/\/)?[\w][\w.-]*\.[a-z]{2,}(\/\S*)?$/i.test(website.trim()) ? "Please enter a valid website (e.g. www.yourfirm.co.za)" : undefined}>
              <input className={cn(inputCls, website && !/^(https?:\/\/)?[\w][\w.-]*\.[a-z]{2,}(\/\S*)?$/i.test(website.trim()) && "border-red-400 focus:border-red-500")} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.yourfirm.co.za" />
            </Field>
          </div>
        );
      case "team": {
        const isValidPhone = (p: string) => !p.trim() || /^\+?[\d\s()-]{7,20}$/.test(p.trim());
        return (
          <div className="space-y-3">
            <p className="text-[12px] text-muted-foreground">Edit team member details shown on the proposal.</p>
            {(data?.teamMembers ?? []).map((member) => {
              const edits = teamEdits[member._id] ?? { jobTitle: member.role, bio: member.bio, phone: member.phone };
              const phoneInvalid = edits.phone && !isValidPhone(edits.phone);
              const avatarUrl = teamAvatars[member._id] ?? null;
              return (
                <div key={member._id} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative group shrink-0">
                      <input ref={(el) => { teamAvatarInputRefs.current[member._id] = el; }} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTeamAvatarUpload(f, member._id); e.target.value = ""; }} />
                      <div className={cn(
                        "h-14 w-14 rounded-full overflow-hidden flex items-center justify-center border-2 cursor-pointer transition-all",
                        avatarUrl ? "border-slate-200 hover:border-[#C8A96E]" : "border-dashed border-slate-300 bg-slate-50 hover:border-[#C8A96E] hover:bg-slate-100"
                      )} onClick={() => teamAvatarInputRefs.current[member._id]?.click()}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={member.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">
                            {member.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        )}
                      </div>
                      {avatarUrl && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); handleClearTeamAvatar(member._id); }}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove photo">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                      <p className="text-[11px] text-muted-foreground">{member.email}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Click photo to {avatarUrl ? "replace" : "upload"}</p>
                    </div>
                  </div>
                  <Field label="Job title" hint={!edits.jobTitle.trim() ? "Required — shown on the proposal" : undefined}>
                    <input className={cn(inputCls, !edits.jobTitle.trim() && "border-red-400 focus:border-red-500")} value={edits.jobTitle} placeholder="e.g. Senior Accountant"
                      onChange={(e) => setTeamEdits((prev) => ({ ...prev, [member._id]: { ...edits, jobTitle: e.target.value } }))} />
                  </Field>
                  <Field label="Phone" hint={phoneInvalid ? "Enter a valid phone number (e.g. +27 82 123 4567)" : undefined}>
                    <input className={cn(inputCls, phoneInvalid && "border-red-400 focus:border-red-500")} value={edits.phone} placeholder="+27 82 123 4567"
                      onChange={(e) => setTeamEdits((prev) => ({ ...prev, [member._id]: { ...edits, phone: e.target.value } }))} />
                  </Field>
                  <Field label="Bio">
                    <textarea className={cn(textareaCls, "min-h-[60px]")} value={edits.bio} placeholder="Short bio..."
                      onChange={(e) => setTeamEdits((prev) => ({ ...prev, [member._id]: { ...edits, bio: e.target.value } }))} />
                  </Field>
                </div>
              );
            })}
            <div className="pt-1">
              <Link href="/settings?tab=people"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add team members in Settings
              </Link>
            </div>
          </div>
        );
      }
      case "fees":
        return (
          <div className="space-y-4">
            <Field label="Fees introduction" hint="Paragraph above the fee tables">
              <textarea className={textareaCls} value={feesIntroText} onChange={(e) => setFeesIntroText(e.target.value)}
                placeholder="This section outlines the services included..." />
            </Field>
            <Field label="Payment terms" hint="Below the investment summary">
              <textarea className={textareaCls} value={paymentTermsText} onChange={(e) => setPaymentTermsText(e.target.value)}
                placeholder="Monthly services are billed at the beginning..." />
            </Field>
          </div>
        );
      case "timeline":
        return (
          <div className="space-y-3">
            <p className="text-[12px] text-muted-foreground">Onboarding timeline steps shown on the Service Summary page.</p>
            {timelineSteps.map((step, idx) => (
              <div key={idx} className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 border-b border-border">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: `${ACCENT}20`, color: ACCENT }}>
                    {step.marker || (idx + 1)}
                  </div>
                  <span className="text-[12px] font-semibold text-slate-700 flex-1 truncate">Step {idx + 1}</span>
                  <button type="button" onClick={() => setTimelineSteps((prev) => prev.filter((_, i) => i !== idx))}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-[64px_1fr] gap-2">
                    <Field label="Marker">
                      <input className={cn(inputCls, "text-center")} value={step.marker}
                        onChange={(e) => setTimelineSteps((prev) => prev.map((s, i) => i === idx ? { ...s, marker: e.target.value } : s))} placeholder="W1" />
                    </Field>
                    <Field label="Title">
                      <input className={inputCls} value={step.title}
                        onChange={(e) => setTimelineSteps((prev) => prev.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))} placeholder="Week 1: Onboarding" />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea className={cn(textareaCls, "min-h-[50px]")} value={step.description}
                      onChange={(e) => setTimelineSteps((prev) => prev.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))} placeholder="Initial meeting, system setup..." />
                  </Field>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              onClick={() => setTimelineSteps((prev) => [...prev, { marker: `W${prev.length + 1}`, title: "", description: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Add step
            </Button>
          </div>
        );
      case "nextSteps":
        return (
          <div className="space-y-4">
            <Field label="What happens next" hint="Intro paragraph for the Next Steps page">
              <textarea className={cn(textareaCls, "min-h-[120px]")} value={whatHappensNextText} onChange={(e) => setWhatHappensNextText(e.target.value)}
                placeholder="We've made the onboarding process as smooth as possible..." />
            </Field>
          </div>
        );
      case "closing":
        return (
          <div className="space-y-4">
            <Field label="Closing quote" hint="Motivational quote on the final page">
              <textarea className={textareaCls} value={closingQuote} onChange={(e) => setClosingQuote(e.target.value)}
                placeholder="You may never know what results..." />
            </Field>
            <Field label="Quote author">
              <input className={inputCls} value={closingQuoteAuthor} onChange={(e) => setClosingQuoteAuthor(e.target.value)} placeholder="e.g. Mahatma Gandhi" />
            </Field>
          </div>
        );
      case "footer":
        return (
          <div className="space-y-4">
            <Field label="Footer logo" hint="PNG, JPG or WebP. Max 2 MB. Shown in the page footer.">
              <div className="flex items-center gap-3">
                {footerLogoPreview ? (
                  <div className="h-14 w-24 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                    <img src={footerLogoPreview} alt="Footer logo" className="max-h-12 max-w-20 object-contain" />
                  </div>
                ) : (
                  <div className="h-14 w-24 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => footerLogoInputRef.current?.click()}>
                    <Pencil className="h-3.5 w-3.5" /> {footerLogoPreview ? "Replace" : "Upload"}
                  </Button>
                  {footerLogoPreview && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleClearImage("pdfFooterImage", setFooterLogoPreview)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <input ref={footerLogoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "pdfFooterImage", setFooterLogoPreview); e.target.value = ""; }} />
              </div>
            </Field>
            <Field label="Footer text">
              <input className={inputCls} value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Registered Auditors | Tax Practitioners" />
            </Field>
            <Field label="Footer address">
              <input className={inputCls} value={footerAddress} onChange={(e) => setFooterAddress(e.target.value)} placeholder="123 Main Street, City" />
            </Field>
            <Field label="Disclaimer">
              <textarea className={textareaCls} value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} placeholder="This proposal is confidential..." />
            </Field>
            <Separator />
            <Field label="Sign-off block" hint="Shown on the last page">
              <textarea className={textareaCls} value={signOffBlock} onChange={(e) => setSignOffBlock(e.target.value)} placeholder="Kind regards, The Team" />
            </Field>
            <Field label="Banking details">
              <textarea className={textareaCls} value={bankingDetails} onChange={(e) => setBankingDetails(e.target.value)} placeholder="Bank: FNB | Account: 123456789" />
            </Field>
          </div>
        );
      default:
        return null;
    }
  };

  const activeDef = SECTIONS.find((s) => s.key === activeSection)!;

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-2.5 shrink-0">
        <Link href="/settings?tab=org"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <h1 className="text-[14px] font-semibold text-slate-800">Proposal Template</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadFnRef.current?.()}
            disabled={isLoading || !downloadFnRef.current}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
          <Button onClick={handleSave} disabled={isLoading || saving} size="sm" className="gap-1.5 h-8 px-3.5 text-[13px] font-semibold text-white hover:opacity-90" style={{ background: ACCENT }}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      {/* ── 3-Panel body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left panel: Section navigator ── */}
        {!showLeft ? (
          <button type="button" onClick={() => setShowLeft(true)}
            className="flex h-full w-10 shrink-0 flex-col items-center justify-start gap-2 border-r border-slate-100 bg-white pt-4 text-slate-400 hover:text-slate-700" title="Open sections">
            <PanelLeftOpen className="h-4 w-4" />
            <span className="text-[10px] font-medium [writing-mode:vertical-lr]">Sections</span>
          </button>
        ) : (
          <div className="relative flex h-full w-[220px] shrink-0 flex-col border-r border-slate-100 bg-white">
            <button type="button" onClick={() => setShowLeft(false)}
              className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Close">
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <div className="p-3 pt-10 space-y-0.5 overflow-y-auto scrollbar-hide flex-1">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.key;
                const enabled = !sec.toggleable || isSectionEnabled(sec.key);
                return (
                  <button key={sec.key} type="button" onClick={() => setActiveSection(sec.key)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                      isActive ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800",
                      !enabled && "opacity-50"
                    )}>
                    <Icon className="h-4 w-4 shrink-0" style={{ color: isActive ? ACCENT : undefined }} />
                    <span className="flex-1 truncate">{sec.label}</span>
                    {sec.toggleable && (
                      enabled
                        ? <Eye className="h-3 w-3 text-emerald-500 shrink-0" />
                        : <EyeOff className="h-3 w-3 text-slate-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Centre: Live PDF Preview ── */}
        <div className="flex-1 min-w-0 overflow-hidden bg-slate-100 dark:bg-slate-900/40">
          <ProposalReviewPDFPreview
            firmName={data?.firmName ?? "Your Firm"}
            selectedClientData={{ companyName: "Sample Client (Pty) Ltd", contactName: "John Smith", email: "client@example.com", phone: "+27 12 345 6789" }}
            packageTemplate="" entities={[]} template="" documentType=""
            startMonth="" startYear="" financialYearEndMonth="" financialYearEndYear=""
            addProjectName={false} projectName="" selectedServices={{}} sections={undefined}
            proposalData={previewData}
            onDownloadReady={(fn) => { downloadFnRef.current = fn; }}
            hideDownloadButton
            scrollToPage={scrollToPage}
          />
        </div>

        {/* ── Right panel: Editor ── */}
        {!showRight ? (
          <button type="button" onClick={() => setShowRight(true)}
            className="flex h-full w-10 shrink-0 flex-col items-center justify-start gap-2 border-l border-slate-100 bg-white pt-4 text-slate-400 hover:text-slate-700" title="Open editor">
            <PanelRightOpen className="h-4 w-4" />
            <span className="text-[10px] font-medium [writing-mode:vertical-lr]">Editor</span>
          </button>
        ) : (
          <div className="relative flex h-full w-[380px] shrink-0 flex-col border-l border-slate-100 bg-white overflow-hidden">
            <button type="button" onClick={() => setShowRight(false)}
              className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Close">
              <PanelRightClose className="h-4 w-4" />
            </button>

            {/* Editor header */}
            <div className="border-b border-slate-100 px-4 py-3 pt-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                  <activeDef.icon className="h-4 w-4" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">{activeDef.label}</h2>
                </div>
                {activeDef.toggleable && (
                  <div className="ml-auto flex items-center gap-2">
                    <Switch checked={isSectionEnabled(activeSection)} onCheckedChange={(v) => toggleSection(activeSection, v)} />
                  </div>
                )}
              </div>
            </div>

            {/* Editor content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : renderSectionEditor()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
