"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import {
  ArrowLeft,
  Loader2,
  ScrollText,
  Mail,
  Pencil,
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EngagementSuiteInlinePanels } from "@/components/engagement/EngagementSuiteInlinePanels";
import {
  AFS_BUNDLED_SYNC_VERSION_ID,
  type EngagementLetterVersionId,
} from "@/lib/engagement-letter-constants";
import { normalizeLetterWhitespace, normalizeScopeForStorage } from "@/lib/engagement-letter-text";
import { TEMPLATE_VARIABLES } from "@/lib/engagement-letter-variables";

const ACCENT = "#C8A96E";

/* ── letterBodyToHtml ─────────────────────────────────────────────────
 * Converts raw engagement-letter text (OCR/PDF with hard-wrapped lines)
 * into structured HTML with proper headings, justified paragraphs,
 * indented bullet lists, a compact address block, and preserved
 * signature/closing formatting.
 * ─────────────────────────────────────────────────────────────────── */

type LetterSection = {
  type: "address" | "title" | "heading" | "paragraph" | "bullets" | "signature";
  lines: string[];
};

const _esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const _escWithBadges = (s: string) =>
  _esc(s).replace(
    /\{\{(\w+)\}\}/g,
    (_m, token: string) =>
      `<span class="letter-variable-badge" contenteditable="false" data-token="${token}">{{${token}}}</span>`
  );

function _isBulletLine(t: string): boolean {
  return (
    /^[•○◦–]\s/.test(t) ||
    /^[•○◦–]$/.test(t) ||
    /^\([a-z]\)\s/.test(t) ||
    /^\([a-z]\)$/.test(t) ||
    /^[a-z]\)\s/.test(t)
  );
}

function _stripBulletPrefix(t: string): string {
  return t
    .replace(/^[•○◦–]\s*/, "")
    .replace(/^\([a-z]\)\s*/, "")
    .replace(/^[a-z]\)\s*/, "");
}

function _isAllCaps(t: string): boolean {
  return t.length > 3 && t.length < 80 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[a-z]/.test(t);
}

function _isHeadingLike(t: string): boolean {
  return t.length > 0 && t.length < 80 && /^[A-Z]/.test(t) && !/[.,:;]\s*$/.test(t) && !_isBulletLine(t);
}

function _endsWithSentence(t: string): boolean {
  return /[.!?":;]\s*$/.test(t.trimEnd()) || /\)\s*$/.test(t.trimEnd());
}

function _isSignatureTrigger(t: string): boolean {
  return (
    /^Yours (faithfully|sincerely)/i.test(t) ||
    /^Acknowledged and agreed/i.test(t) ||
    t.includes("______") ||
    /^In signing this document/i.test(t)
  );
}

function _renderBullets(rawLines: string[]): string {
  const prose: string[] = [];
  const items: string[] = [];
  let cur: string | null = null;
  let seenBullet = false;

  for (const raw of rawLines) {
    const t = raw.trim();
    if (!t) continue;
    if (_isBulletLine(t)) {
      seenBullet = true;
      if (cur !== null) items.push(cur);
      const after = _stripBulletPrefix(t);
      cur = after || "";
    } else if (!seenBullet) {
      prose.push(t);
    } else if (cur !== null) {
      cur = cur ? cur + " " + t : t;
    }
  }
  if (cur !== null) items.push(cur);

  let html = "";
  if (prose.length)
    html += `<p>${_escWithBadges(prose.join(" ").replace(/ {2,}/g, " "))}</p>`;
  if (items.length) {
    html += '<ul class="letter-bullets">';
    for (const item of items) if (item) html += `<li>${_escWithBadges(item.replace(/ {2,}/g, " "))}</li>`;
    html += "</ul>";
  }
  return html;
}

function letterBodyToHtml(rawText: string): string {
  let text = rawText.replace(/\ufffd/g, "\u2022").replace(/\u00b7/g, "\u2022");

  const allLines = text.split("\n");

  const lines: string[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const t = allLines[i].trim();
    if (/^\d{1,2}$/.test(t) && parseInt(t) < 30) {
      const prevBlank = i === 0 || !allLines[i - 1].trim() || _endsWithSentence(allLines[i - 1].trim());
      const nextBlank = i === allLines.length - 1 || !allLines[i + 1].trim();
      if (prevBlank || nextBlank) continue;
    }
    lines.push(allLines[i]);
  }

  const sections: LetterSection[] = [];

  let dearIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    if (/^Dear\s/i.test(lines[i].trim())) { dearIdx = i; break; }
  }

  if (dearIdx >= 0) {
    const addrLines: string[] = [];
    let embeddedTitle: string | null = null;
    for (let i = 0; i <= dearIdx; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (_isAllCaps(t) && t.length > 5) embeddedTitle = t;
      else addrLines.push(t);
    }
    if (addrLines.length) sections.push({ type: "address", lines: addrLines });
    if (embeddedTitle) sections.push({ type: "title", lines: [embeddedTitle] });
  }

  let sigZone = false;
  let group: LetterSection | null = null;
  let isFirstBody = true;
  const startAt = dearIdx >= 0 ? dearIdx + 1 : 0;

  function flush() {
    if (!group || !group.lines.some((l) => l.trim())) { group = null; return; }
    if (group.type === "paragraph") {
      const merged = group.lines.join(" ").replace(/ {2,}/g, " ").trim();
      if (merged.length < 200 && /^[A-Z]/.test(merged) && !/[.,:;!?"]\s*$/.test(merged)) {
        group.type = "heading";
      }
    }
    sections.push(group);
    group = null;
  }

  for (let i = startAt; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed) { flush(); continue; }

    if (!sigZone && _isSignatureTrigger(trimmed)) { flush(); sigZone = true; }

    if (sigZone) {
      if (!group || group.type !== "signature") { flush(); group = { type: "signature", lines: [] }; }
      group!.lines.push(lines[i]);
      continue;
    }

    if (isFirstBody) {
      isFirstBody = false;
      if (
        trimmed.length < 100 &&
        /^[A-Z]/.test(trimmed) &&
        !/[.,:;]\s*$/.test(trimmed) &&
        !trimmed.includes(". ")
      ) {
        flush();
        sections.push({ type: "title", lines: [trimmed] });
        continue;
      }
    }

    if (_isAllCaps(trimmed) && trimmed.length > 5) {
      flush();
      sections.push({ type: "title", lines: [trimmed] });
      continue;
    }

    if (!group && _isHeadingLike(trimmed)) {
      const nextT = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (nextT.length > 60 || !nextT || _isHeadingLike(nextT)) {
        sections.push({ type: "heading", lines: [trimmed] });
        continue;
      }
    }

    if (_isBulletLine(trimmed)) {
      if (!group || group.type !== "bullets") { flush(); group = { type: "bullets", lines: [] }; }
      group!.lines.push(trimmed);
      continue;
    }

    if (group?.type === "bullets") {
      if (
        _isHeadingLike(trimmed) &&
        group.lines.length > 0 &&
        _endsWithSentence(group.lines[group.lines.length - 1].trim())
      ) {
        const nextT = i + 1 < lines.length ? lines[i + 1].trim() : "";
        if (nextT.length > 60 || !nextT || _isHeadingLike(nextT)) {
          flush();
          sections.push({ type: "heading", lines: [trimmed] });
          continue;
        }
      }
      group.lines.push(trimmed);
      continue;
    }

    if (group?.type === "paragraph" && group.lines.length > 0) {
      const prevT = group.lines[group.lines.length - 1].trim();
      if (
        _endsWithSentence(prevT) &&
        trimmed.length < 80 &&
        /^[A-Z]/.test(trimmed) &&
        !/[.,:;]\s*$/.test(trimmed)
      ) {
        const nextT = i + 1 < lines.length ? lines[i + 1].trim() : "";
        if (nextT.length > 60 || !nextT || _isHeadingLike(nextT)) {
          flush();
          sections.push({ type: "heading", lines: [trimmed] });
          continue;
        }
      }
    }

    if (!group || group.type !== "paragraph") { flush(); group = { type: "paragraph", lines: [] }; }
    group!.lines.push(trimmed);
  }
  flush();

  return sections
    .map((s) => {
      const clean = s.lines.filter((l) => l.trim());
      if (!clean.length) return "";
      switch (s.type) {
        case "address":
          return `<div class="letter-address">${clean.map((l) => _escWithBadges(l.trim())).join("<br>")}</div>`;
        case "title":
          return `<h2 class="letter-title">${_escWithBadges(clean.join(" ").replace(/ {2,}/g, " ").trim())}</h2>`;
        case "heading":
          return `<h3 class="letter-heading">${_escWithBadges(clean.join(" ").replace(/ {2,}/g, " ").trim())}</h3>`;
        case "paragraph": {
          const merged = clean.join(" ").replace(/ {2,}/g, " ").trim();
          return `<p>${_escWithBadges(merged)}</p>`;
        }
        case "bullets":
          return _renderBullets(clean);
        case "signature":
          return `<div class="letter-signature">${s.lines.map((l) => _escWithBadges(l)).join("<br>")}</div>`;
        default:
          return "";
      }
    })
    .join("");
}

function mergeLetterBody(introduction?: string | null, scope?: string | null): string {
  const a = introduction?.trim();
  const b = scope?.trim();
  if (a && b) return `${a}\n\n${b}`;
  return a || b || "";
}

const SUITE_NAV = [
  { id: "template", label: "This template" },
  { id: "letterhead", label: "Letterhead Components" },
  { id: "key-dates", label: "Key Dates" },
  { id: "key-people", label: "Key People" },
  { id: "emails", label: "Emails" },
] as const;

type SuiteEditorView = (typeof SUITE_NAV)[number]["id"];

function EngagementSuiteNav({
  variant,
  activeId,
  onSelect,
}: {
  variant: "mobile" | "desktop";
  activeId: SuiteEditorView;
  onSelect: (id: SuiteEditorView) => void;
}) {
  return (
    <nav
      className={cn(
        "gap-0.5",
        variant === "mobile"
          ? "flex flex-row overflow-x-auto p-2"
          : "flex flex-col px-3 pb-3"
      )}
    >
      {SUITE_NAV.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
              variant === "mobile" && "whitespace-nowrap",
              isActive
                ? "bg-[#C8A96E]/12 font-semibold text-[#243E63]"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

type EmailPreviewSlice = {
  clientSubject?: string;
  clientContent?: string;
  staffSubject?: string;
  staffContent?: string;
};

function EmailPreviewPanelContent({
  emailPreviewTab,
  setEmailPreviewTab,
  templatesLoading,
  signedPreview,
  acceptancePreview,
}: {
  emailPreviewTab: "signed" | "acceptance";
  setEmailPreviewTab: (t: "signed" | "acceptance") => void;
  templatesLoading: boolean;
  signedPreview: EmailPreviewSlice | undefined;
  acceptancePreview: EmailPreviewSlice | undefined;
}) {
  return (
    <>
      <div className="shrink-0 border-b border-slate-100 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <p className="text-[13px] font-semibold text-slate-900">Emails for this firm</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          These are the messages clients and staff receive around engagement letters.
        </p>
        <div className="mt-3 flex rounded-md bg-slate-200/80 p-0.5">
          <button
            type="button"
            onClick={() => setEmailPreviewTab("signed")}
            className={cn(
              "flex-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
              emailPreviewTab === "signed" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            )}
          >
            Signed &amp; accepted
          </button>
          <button
            type="button"
            onClick={() => setEmailPreviewTab("acceptance")}
            className={cn(
              "flex-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
              emailPreviewTab === "acceptance" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            )}
          >
            Acceptance only
          </button>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {templatesLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {[
              {
                title: "Client email",
                sub: emailPreviewTab === "signed" ? signedPreview?.clientSubject : acceptancePreview?.clientSubject,
                body: emailPreviewTab === "signed" ? signedPreview?.clientContent : acceptancePreview?.clientContent,
              },
              {
                title: "Staff notification",
                sub: emailPreviewTab === "signed" ? signedPreview?.staffSubject : acceptancePreview?.staffSubject,
                body: emailPreviewTab === "signed" ? signedPreview?.staffContent : acceptancePreview?.staffContent,
              },
            ].map((block) => (
              <div key={block.title} className="rounded-lg border border-slate-200 p-3">
                <p className="text-[12px] font-semibold text-slate-800">{block.title}</p>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  <span className="font-medium text-slate-600">Subject</span> {block.sub || "—"}
                </p>
                <p className="text-[11px] text-slate-600 mt-2 whitespace-pre-wrap max-h-40 overflow-y-auto rounded bg-slate-50 p-2">
                  {block.body || "—"}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

export default function EditLetterVersionPage() {
  const params = useParams();
  const versionId = params.versionId as string;
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const version = useQuery(
    api.engagementLetters.getLetterVersion,
    userId && versionId ? { userId, versionId: versionId as EngagementLetterVersionId } : "skip"
  );
  const emailTemplates = useQuery(
    api.engagementLetters.getEngagementEmailTemplates,
    userId ? { userId } : "skip"
  );

  const updateLetterVersion = useMutation(api.engagementLetters.updateLetterVersion);
  const applyBundledAfsCompilationLetter = useMutation(
    api.engagementLetters.applyBundledAfsCompilationLetter
  );
  const repairLegacyAfsBodies = useMutation(api.engagementLetters.repairLegacyAfsBundledLetterBodies);

  const [name, setName] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [showSuiteNav, setShowSuiteNav] = useState(true);
  const [suiteView, setSuiteView] = useState<SuiteEditorView>("template");
  const [emailPreviewTab, setEmailPreviewTab] = useState<"signed" | "acceptance">("signed");
  const [editing, setEditing] = useState(false);
  const [varMenuOpen, setVarMenuOpen] = useState(false);
  const afsBundledSyncLock = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [ranLegacyAfsRepair, setRanLegacyAfsRepair] = useState(false);

  useEffect(() => {
    if (editing) {
      const frame = requestAnimationFrame(() => {
        editorRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [editing]);

  function insertVariable(token: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setLetterBody((prev) => prev + `{{${token}}}`);
    } else {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(`{{${token}}}`));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      if (editorRef.current) setLetterBody(editorRef.current.innerText);
    }
    setVarMenuOpen(false);
  }

  /** Patches DB rows that still have old bare-line (a)(b)(c) AFS layout; refetches version via Convex. */
  useEffect(() => {
    if (!userId || ranLegacyAfsRepair) return;
    let cancelled = false;
    void (async () => {
      try {
        await repairLegacyAfsBodies({ userId });
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setRanLegacyAfsRepair(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, ranLegacyAfsRepair, repairLegacyAfsBodies]);

  useEffect(() => {
    afsBundledSyncLock.current = false;
  }, [versionId]);

  useEffect(() => {
    if (!version) return;
    setName(version.name);
    const body = normalizeLetterWhitespace(mergeLetterBody(version.introduction, version.scope));
    setLetterBody(body);
    if (editorRef.current) editorRef.current.innerText = body;
  }, [version]);

  useEffect(() => {
    if (!version || !userId || version._id !== AFS_BUNDLED_SYNC_VERSION_ID) return;
    const combined = `${version.introduction ?? ""}\n${version.scope ?? ""}`;
    if (combined.includes("Protection of Personal Information Act, 2013")) return;
    if (afsBundledSyncLock.current) return;
    afsBundledSyncLock.current = true;
    let cancelled = false;
    void (async () => {
      try {
        await applyBundledAfsCompilationLetter({ userId, versionId: version._id });
        if (!cancelled) toast.success("Loaded the bundled AFS compilation letter");
      } catch {
        afsBundledSyncLock.current = false;
        if (!cancelled) toast.error("Could not load the bundled letter");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version, userId, applyBundledAfsCompilationLetter]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    if (!userId || !version) return;
    setSaving(true);
    try {
      await updateLetterVersion({
        userId,
        versionId: version._id,
        name: trimmed,
        introduction: "",
        scope: normalizeScopeForStorage(letterBody),
      });
      toast.success("Template saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const loading = version === undefined;

  if (!userId) {
    return (
      <div className="min-w-0">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600" asChild>
            <Link href="/engagement-letters">
              <ArrowLeft className="h-4 w-4" />
              Library
            </Link>
          </Button>
        </div>
        <div className="p-6 text-sm text-slate-500">Sign in to edit templates.</div>
      </div>
    );
  }

  if (version === null) {
    return (
      <div className="min-w-0">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600" asChild>
            <Link href="/engagement-letters">
              <ArrowLeft className="h-4 w-4" />
              Library
            </Link>
          </Button>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-sm text-slate-600">This template was not found or you don&apos;t have access.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/engagement-letters">Back to Engagement Letters</Link>
          </Button>
        </div>
      </div>
    );
  }

  const signedPreview = emailTemplates?.signed;
  const acceptancePreview = emailTemplates?.acceptance;

  const templatesLoading = emailTemplates === undefined;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-50/50 lg:flex-row lg:items-stretch">
        {/* Left — mobile: horizontal strip; desktop: collapsible rail like Service Library on /proposals/new */}
        <aside className="w-full min-w-0 shrink-0 overflow-x-auto border-b border-slate-200 bg-white lg:hidden">
          <div className="border-b border-slate-100 p-3">
            <p className="text-[14px] font-semibold text-slate-900">Engagement Letter Suite</p>
          </div>
          <EngagementSuiteNav variant="mobile" activeId={suiteView} onSelect={setSuiteView} />
        </aside>

        <div className="hidden min-h-0 h-full shrink-0 flex-col self-stretch overflow-hidden border-slate-200 bg-white lg:flex">
          {!showSuiteNav ? (
            <button
              type="button"
              onClick={() => setShowSuiteNav(true)}
              className="flex h-full min-h-0 w-10 shrink-0 flex-col items-center justify-start gap-2 border-r border-slate-200 pt-4 text-slate-400 transition-colors hover:text-slate-700"
              title="Open suite navigation"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span className="text-[10px] font-medium [writing-mode:vertical-lr]">Suite</span>
            </button>
          ) : (
            <div className="relative flex h-full min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-slate-200">
              <button
                type="button"
                onClick={() => setShowSuiteNav(false)}
                className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Close suite navigation"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-10">
                <EngagementSuiteNav variant="desktop" activeId={suiteView} onSelect={setSuiteView} />
              </div>
            </div>
          )}
        </div>

        {/* Center — header fixed; letter body scrolls only */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 sm:flex"
                  style={{ background: `${ACCENT}14` }}
                >
                  <ScrollText className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-[15px] font-semibold text-slate-900">
                    {suiteView === "template"
                      ? "Edit template"
                      : SUITE_NAV.find((s) => s.id === suiteView)?.label ?? "Suite"}
                  </h1>
                  <p className="truncate text-[12px] text-slate-500">
                    {suiteView === "template"
                      ? version?.name ?? "…"
                      : "Firm-wide · applies to every engagement letter"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 lg:hidden">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-[12px] font-medium text-slate-700">Email preview</span>
                <Switch
                  checked={showEmailPanel}
                  onCheckedChange={setShowEmailPanel}
                  aria-label="Toggle email templates panel"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-200 font-medium text-slate-700 shadow-sm hover:bg-slate-50" asChild>
                <Link href="/engagement-letters">
                  <ArrowLeft className="h-4 w-4" />
                  Library
                </Link>
              </Button>
              <Button
                type="button"
                disabled={saving || suiteView !== "template"}
                title={suiteView !== "template" ? "Switch to “This template” to save this letter version" : undefined}
                className="h-9 px-4 text-white font-semibold shadow-sm"
                style={{ background: ACCENT }}
                onClick={handleSave}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-white">
            {loading ? (
              <div className="flex items-center gap-2 px-6 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : suiteView === "template" ? (
              <div className="flex w-full flex-col">
                <div
                  className={cn(
                    "relative w-full overflow-hidden bg-white transition-colors",
                    editing ? "ring-2 ring-[#C8A96E]/30 ring-inset" : ""
                  )}
                >
                  {/* Edit mode indicator bar */}
                  <div className={cn(
                    "flex items-center justify-between px-4 py-2 text-[12px] font-medium transition-colors",
                    editing
                      ? "bg-[#C8A96E]/10 text-[#C8A96E]"
                      : "bg-slate-50 text-slate-400"
                  )}>
                    <span>{editing ? "Editing — click anywhere in the letter to type" : "Read-only — click Edit to make changes"}</span>
                    <div className="flex items-center gap-2">
                      {editing && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setVarMenuOpen((v) => !v)}
                            className="flex items-center gap-1.5 rounded-md border border-[#C8A96E]/30 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#C8A96E] hover:bg-[#C8A96E]/5 transition-colors"
                          >
                            + Variable
                          </button>
                          {varMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                              {TEMPLATE_VARIABLES.map((v) => (
                                <button
                                  key={v.token}
                                  type="button"
                                  onClick={() => insertVariable(v.token)}
                                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                                >
                                  <span className="text-[12px] font-semibold text-slate-700">{`{{${v.token}}}`}</span>
                                  <span className="text-[11px] text-slate-400">{v.description}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing((prev) => !prev)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors",
                          editing
                            ? "bg-[#C8A96E] text-white hover:bg-[#b8963e]"
                            : "bg-white border border-slate-200 text-slate-700 hover:border-[#C8A96E]/40 hover:text-[#C8A96E]"
                        )}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        {editing ? "Done editing" : "Edit"}
                      </button>
                    </div>
                  </div>

                  {/* Letter body — same justified HTML in both modes */}
                  <div className="px-6 py-10 sm:px-10 sm:py-12">
                    <div
                      ref={editorRef}
                      contentEditable={editing}
                      suppressContentEditableWarning
                      spellCheck={editing}
                      onInput={editing ? (e) => setLetterBody(e.currentTarget.innerText) : undefined}
                      dangerouslySetInnerHTML={{ __html: letterBodyToHtml(letterBody) }}
                      className={cn(
                        "engagement-letter-body w-full min-h-[min(80vh,64rem)] font-serif text-[14.5px] leading-[1.8] text-slate-900 focus:outline-none",
                        editing ? "cursor-text" : "cursor-default select-none pointer-events-none"
                      )}
                    />
                  </div>
                </div>
              </div>
            ) : (
              userId && (
                <div className="w-full max-w-full px-4 py-6 sm:px-6">
                  <EngagementSuiteInlinePanels panel={suiteView} userId={userId} />
                </div>
              )
            )}
          </div>
        </div>

        {/* Right — scrolls independently; open/close like /proposals/new */}
        <div className="hidden min-h-0 h-full shrink-0 flex-col overflow-hidden self-stretch border-slate-200 bg-white lg:flex">
          {!showEmailPanel ? (
            <button
              type="button"
              onClick={() => setShowEmailPanel(true)}
              className="flex h-full min-h-0 w-10 shrink-0 flex-col items-center justify-start gap-2 border-l border-slate-200 pt-4 text-slate-400 transition-colors hover:text-slate-700"
              title="Open email preview"
            >
              <PanelRightOpen className="h-4 w-4" />
              <span className="text-[10px] font-medium [writing-mode:vertical-lr]">Email preview</span>
            </button>
          ) : (
            <div className="relative flex h-full min-h-0 w-[380px] shrink-0 flex-col overflow-hidden border-l border-slate-200">
              <button
                type="button"
                onClick={() => setShowEmailPanel(false)}
                className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Close email preview"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-10">
                <EmailPreviewPanelContent
                  emailPreviewTab={emailPreviewTab}
                  setEmailPreviewTab={setEmailPreviewTab}
                  templatesLoading={templatesLoading}
                  signedPreview={signedPreview}
                  acceptancePreview={acceptancePreview}
                />
              </div>
            </div>
          )}
        </div>

        {/* Mobile / tablet: email panel stacks below center when open */}
        {showEmailPanel && (
          <div className="flex max-h-[min(55vh,28rem)] min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-slate-200 bg-white lg:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2">
              <span className="text-[13px] font-semibold text-slate-900">Email preview</span>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-500" onClick={() => setShowEmailPanel(false)}>
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <EmailPreviewPanelContent
              emailPreviewTab={emailPreviewTab}
              setEmailPreviewTab={setEmailPreviewTab}
              templatesLoading={templatesLoading}
              signedPreview={signedPreview}
              acceptancePreview={acceptancePreview}
            />
            </div>
          </div>
        )}
    </div>
  );
}
