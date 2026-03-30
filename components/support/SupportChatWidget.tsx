"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle, Home, HelpCircle, Send, Search,
  CheckCircle2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  Loader2, BookOpen, FileText, Zap, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

type Tab = "home" | "setup" | "messages" | "help";

// ── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdownBody(body: string) {
  const lines = body.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 text-sm text-foreground/80">
        {listItems.map((li, i) => <li key={i}>{formatInline(li)}</li>)}
      </ul>
    );
    listItems = [];
  };

  function formatInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;
    const boldRegex = /\*\*(.+?)\*\*/;
    while (remaining) {
      const match = boldRegex.exec(remaining);
      if (!match) { parts.push(remaining); break; }
      if (match.index > 0) parts.push(remaining.slice(0, match.index));
      parts.push(<strong key={key++} className="font-semibold text-foreground">{match[1]}</strong>);
      remaining = remaining.slice(match.index + match[0].length);
    }
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd();
    if (trimmed === "") { flushList(); continue; }
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(<h4 key={`h4-${i}`} className="text-sm font-semibold text-foreground mt-4 mb-1.5">{trimmed.slice(4)}</h4>);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(<h3 key={`h3-${i}`} className="text-base font-semibold text-foreground mt-4 mb-2">{trimmed.slice(3)}</h3>);
      continue;
    }
    if (/^[-*]\s/.test(trimmed)) { listItems.push(trimmed.replace(/^[-*]\s+/, "")); continue; }
    if (/^\d+\.\s/.test(trimmed)) { flushList(); listItems.push(trimmed.replace(/^\d+\.\s+/, "")); continue; }
    flushList();
    elements.push(<p key={`p-${i}`} className="text-sm text-foreground/80 leading-relaxed">{formatInline(trimmed)}</p>);
  }
  flushList();
  return <div className="space-y-2">{elements}</div>;
}

// ── Collection icons ─────────────────────────────────────────────────────────

const COLLECTION_ICONS: Record<string, React.ReactNode> = {
  "Get Started":  <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  "Proposals":    <FileText className="h-4 w-4 text-blue-600" />,
  "Clients":      <BookOpen className="h-4 w-4 text-purple-600" />,
  "Pricing":      <BookOpen className="h-4 w-4 text-amber-600" />,
  "Workflow":     <BookOpen className="h-4 w-4 text-emerald-600" />,
  "Settings":     <BookOpen className="h-4 w-4 text-slate-600" />,
};

// ── Modal detection ──────────────────────────────────────────────────────────

function useAnyModalOpen(): boolean {
  const [anyOpen, setAnyOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      const openEls = Array.from(document.querySelectorAll<HTMLElement>('[data-state="open"]'));
      const hasExternal = openEls.some((el) => {
        if (el.closest('[data-support-chat="true"]')) return false;
        if (el.getAttribute("role") === "tooltip" || el.closest("[role='tooltip']")) return false;
        if (el.getAttribute("data-radix-select-viewport") !== null) return false;
        const role = el.getAttribute("role");
        return (
          role === "dialog" || role === "alertdialog" || role === "menu" || role === "listbox" ||
          el.hasAttribute("data-radix-dialog-overlay") || el.hasAttribute("data-radix-dialog-content") ||
          el.hasAttribute("data-radix-dropdown-menu-content") || el.hasAttribute("data-radix-popover-content") ||
          el.hasAttribute("data-radix-select-content") || el.hasAttribute("data-vaul-drawer")
        );
      });
      setAnyOpen(hasExternal);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, []);
  return anyOpen;
}

// ── Setup guide types ────────────────────────────────────────────────────────

interface GuideStep {
  id: string;
  label: string;
  href: string;
  done: boolean;
  locked: boolean;
}

interface GuideSection {
  id: string;
  title: string;
  steps: GuideStep[];
  /** Section is fully gated — can't interact at all */
  locked: boolean;
  /** Badge label shown when locked, e.g. "Pro" or "Business" */
  lockedPlan?: string;
  /** Collapse all-done sections by default */
  allDone: boolean;
}

const DISMISSED_KEY = (userId?: string) => `northpact_setup_dismissed_${userId ?? "anon"}`;

// ── Build sections ────────────────────────────────────────────────────────────

function buildSections(opts: {
  isPro: boolean;
  isBusiness: boolean;
  hasCustomAvatar: boolean;
  hasServices: boolean;
  hasLogo: boolean;
  hasContact: boolean;
  hasClients: boolean;
  hasProposals: boolean;
  hasTeamMember: boolean;
}): GuideSection[] {
  const { isPro, isBusiness, hasCustomAvatar, hasServices, hasLogo, hasContact, hasClients, hasProposals, hasTeamMember } = opts;

  const teamLocked     = !isPro && !isBusiness;
  const advancedLocked = !isBusiness;

  // ── Steps ──────────────────────────────────────────────────────────────────
  const profileSteps: GuideStep[] = [
    { id: "avatar", label: "Upload a profile photo", href: "/settings?tab=account", done: hasCustomAvatar, locked: false },
  ];
  const pricingSteps: GuideStep[] = [
    { id: "service",      label: "Add your first service",  href: "/services",                done: hasServices, locked: false },
    { id: "pricing-tool", label: "Build a pricing scenario", href: "/services/pricing-tool",  done: hasServices && hasProposals, locked: false },
  ];
  const firmSteps: GuideStep[] = [
    { id: "logo",    label: "Upload your firm logo", href: "/settings?tab=org", done: hasLogo,    locked: false },
    { id: "contact", label: "Add contact details",   href: "/settings?tab=org", done: hasContact, locked: false },
  ];
  const clientSteps: GuideStep[] = [
    { id: "client",   label: "Add your first client",    href: "/clients",       done: hasClients,   locked: false },
    { id: "proposal", label: "Send your first proposal", href: "/proposals/new", done: hasProposals, locked: false },
  ];
  const upgradeSteps: GuideStep[] = [
    { id: "upgrade", label: isPro ? "Upgrade to Business" : "Upgrade to Pro or Business", href: "/settings?tab=billing", done: isBusiness, locked: false },
  ];
  const teamSteps: GuideStep[] = [
    { id: "team-invite", label: "Invite a team member",   href: "/settings?tab=people", done: hasTeamMember, locked: teamLocked },
    { id: "integration", label: "Connect an integration", href: "/appsmap",             done: false,         locked: teamLocked },
  ];
  const advancedSteps: GuideStep[] = [
    { id: "approvals",  label: "Configure approval workflow", href: "/settings?tab=workflow",       done: false, locked: advancedLocked },
    { id: "engagement", label: "Set up engagement letters",   href: "/workflow/engagement-letters", done: false, locked: advancedLocked },
    { id: "work-plan",  label: "Enable work planning",        href: "/workflow/work-planning",      done: false, locked: advancedLocked },
  ];

  // ── Sections ───────────────────────────────────────────────────────────────
  const profileSection: GuideSection = { id: "profile",  title: "Set up your profile",  steps: profileSteps,  locked: false,          allDone: profileSteps.every(s => s.done) };
  const pricingSection: GuideSection = { id: "pricing",  title: "Set up your pricing",   steps: pricingSteps,  locked: false,          allDone: pricingSteps.every(s => s.done) };
  const firmSection:    GuideSection = { id: "firm",     title: "Set up your firm",       steps: firmSteps,     locked: !isBusiness,    lockedPlan: "Business", allDone: isBusiness && firmSteps.every(s => s.done) };
  const clientsSection: GuideSection = { id: "clients",  title: "Win clients",            steps: clientSteps,   locked: false,          allDone: clientSteps.every(s => s.done) };
  const billingSection: GuideSection = { id: "billing",  title: "Upgrade your plan",      steps: upgradeSteps,  locked: false,          allDone: upgradeSteps.every(s => s.done) };
  const teamSection:    GuideSection = { id: "team",     title: "Team & integrations",    steps: teamSteps,     locked: teamLocked,     lockedPlan: "Pro",      allDone: !teamLocked && teamSteps.every(s => s.done) };
  const advSection:     GuideSection = { id: "advanced", title: "Advanced features",      steps: advancedSteps, locked: advancedLocked, lockedPlan: "Business", allDone: !advancedLocked && advancedSteps.every(s => s.done) };

  // Order: actionable (unlocked) first, upgrade prompts in the middle, locked features last
  if (isBusiness) {
    // Business: firm setup → pricing → win clients → team → advanced
    return [firmSection, pricingSection, clientsSection, teamSection, advSection];
  }
  // Pro & Starter: profile → pricing → win clients → upgrade → team (locked on starter) → firm (locked) → advanced (locked)
  return [profileSection, pricingSection, clientsSection, billingSection, teamSection, firmSection, advSection];
}

// ── Main widget ──────────────────────────────────────────────────────────────

export function SupportChatWidget() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [activeArticleSlug, setActiveArticleSlug] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sheetSide, setSheetSide] = useState<"right" | "bottom">("right");
  const [setupDismissed, setSetupDismissed] = useState(false);
  /** Which accordion sections are expanded */
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const anyModalOpen = useAnyModalOpen();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!userId) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY(userId)) === "1") setSetupDismissed(true);
      else setSetupDismissed(false); // reset if switching to a different user
    } catch {}
  }, [userId]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setSheetSide(mq.matches ? "bottom" : "right");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ── Convex queries ─────────────────────────────────────────────────────────
  const hasUnreadReplies = useQuery(api.supportChat.hasUnreadReplies) ?? false;
  const messages         = useQuery(api.supportChat.list, {});
  const sendMessage      = useMutation(api.supportChat.send);
  const collections      = useQuery(api.helpArticles.listCollections, open ? {} : "skip");
  const suggested        = useQuery(api.helpArticles.listSuggested,   open ? { limit: 6 } : "skip");
  const searchResults    = useQuery(
    api.helpArticles.search,
    open && searchQuery.trim().length >= 2 ? { q: searchQuery, limit: 8 } : "skip"
  );
  const activeArticle    = useQuery(api.helpArticles.getBySlug, activeArticleSlug ? { slug: activeArticleSlug } : "skip");
  const ensureSeeded     = useMutation(api.helpArticles.ensureSeeded);

  // Setup guide queries
  const firmSettings  = useQuery(api.firms.getFirmSettings, userId ? { userId } : "skip");
  const clientCounts  = useQuery(api.clients.getClientCounts, userId ? { userId } : "skip");
  const proposals     = useQuery(api.proposals.listProposals, userId ? { userId } : "skip");
  const convexUsers   = useQuery(api.users.listUsers, userId ? { userId } : "skip");
  const services      = useQuery(api.services.listServices, userId ? { userId } : "skip");

  useEffect(() => {
    if (open) ensureSeeded({}).catch(() => {});
  }, [open, ensureSeeded]);

  useEffect(() => {
    function handleOpen() { setOpen(true); setTab("messages"); }
    function handleOpenArticle(e: Event) {
      const slug = (e as CustomEvent).detail?.slug;
      if (slug) { setOpen(true); setTab("help"); setActiveArticleSlug(slug); }
    }
    function handleOpenSetupGuide() { setOpen(true); setTab("setup"); }
    window.addEventListener("open-support-chat", handleOpen);
    window.addEventListener("open-support-article", handleOpenArticle);
    window.addEventListener("open-setup-guide", handleOpenSetupGuide);
    return () => {
      window.removeEventListener("open-support-chat", handleOpen);
      window.removeEventListener("open-support-article", handleOpenArticle);
      window.removeEventListener("open-setup-guide", handleOpenSetupGuide);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!open) { setActiveArticleSlug(null); setSearchQuery(""); }
  }, [open]);

  const displayArticles = useMemo(() => {
    if (searchQuery.trim().length >= 2) return searchResults ?? [];
    return suggested ?? [];
  }, [searchQuery, searchResults, suggested]);

  // ── Plan derivation ────────────────────────────────────────────────────────
  const plan      = firmSettings?.subscriptionPlan ?? "starter";
  const isPro     = plan === "professional" || plan === "enterprise";
  const isBusiness = plan === "enterprise";

  // ── Setup sections ─────────────────────────────────────────────────────────
  const sections = buildSections({
    isPro,
    isBusiness,
    // Only count as uploaded if the URL is from our own Convex storage,
    // not the Clerk-synced avatar that's set automatically on every signup.
    hasCustomAvatar: Boolean(user?.avatar && user.avatar.includes(".convex.cloud")),
    hasServices:   (services?.length ?? 0) > 0,
    hasLogo:       Boolean(firmSettings?.firmLogoUrl),
    hasContact:    Boolean(firmSettings?.billingEmail || firmSettings?.phone),
    hasClients:    (clientCounts?.total ?? 0) > 0,
    hasProposals:  (proposals?.length ?? 0) > 0,
    hasTeamMember: (convexUsers?.filter(u => u.membershipStatus === "active").length ?? 0) > 1,
  });

  const totalSteps   = sections.reduce((n, s) => n + s.steps.length, 0);
  const doneSteps    = sections.reduce((n, s) => n + s.steps.filter(st => st.done).length, 0);
  const allSetupDone = doneSteps === totalSteps;


  function toggleSection(id: string, sectionLocked: boolean) {
    if (sectionLocked) return; // locked — don't expand
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function dismissSetup() {
    try { localStorage.setItem(DISMISSED_KEY(userId), "1"); } catch {}
    setSetupDismissed(true);
    setTab("home");
  }

  async function handleSend() {
    const content = messageInput.trim();
    if (!content || isSending) return;
    setIsSending(true);
    try {
      await sendMessage({ content });
      setMessageInput("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  // ── Floating button ────────────────────────────────────────────────────────
  const floatingButton = (
    <div
      dir="ltr"
      style={{
        position: "fixed",
        bottom: sheetSide === "bottom" ? 80 : 24,
        right: 24,
        zIndex: 2147483647,
        width: 52,
        height: 52,
        display: open || anyModalOpen ? "none" : "block",
      }}
    >
      <button
        onClick={() => setOpen(true)}
        aria-label="Open support"
        className="relative h-[52px] w-[52px] rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: "#243E63" }}
      >
        <MessageCircle className="h-5 w-5 text-white" />
        {(hasUnreadReplies || (!setupDismissed && doneSteps < totalSteps)) && (
          <span
            className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white"
            style={{ background: hasUnreadReplies ? "#ef4444" : "#C8A96E" }}
            aria-hidden
          />
        )}
      </button>
    </div>
  );

  // ── Nav tabs ───────────────────────────────────────────────────────────────
  const navTabs = [
    { id: "home"     as Tab, label: "Home",     icon: Home },
    { id: "setup"    as Tab, label: "Setup",    icon: Zap },
    { id: "messages" as Tab, label: "Messages", icon: MessageCircle },
    { id: "help"     as Tab, label: "Help",     icon: HelpCircle },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {mounted && createPortal(floatingButton, document.body)}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          data-support-chat="true"
          side={sheetSide}
          className={cn(
            "flex flex-col p-0 gap-0 border-l border-slate-200 bg-white",
            sheetSide === "bottom"
              ? "w-full max-h-[88vh] rounded-t-2xl"
              : "w-full sm:max-w-[400px] max-h-screen"
          )}
        >
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <SheetHeader className="shrink-0 px-5 py-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "#243E63" }}
              >
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <SheetTitle className="text-[14px] font-semibold text-slate-900 leading-tight">
                  {activeArticleSlug
                    ? "Article"
                    : tab === "home"     ? "Support"
                    : tab === "setup"    ? "Setup guide"
                    : tab === "messages" ? "Messages"
                    : "Help centre"}
                </SheetTitle>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">NorthPact</p>
              </div>
            </div>
          </SheetHeader>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* Article detail — overrides all tabs */}
            {activeArticleSlug ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-5 py-2.5 border-b border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveArticleSlug(null)}
                    className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back to Help
                  </button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-5">
                    {activeArticle === undefined ? (
                      <div className="space-y-3 animate-pulse">
                        {[1,2,3,4].map(i => <div key={i} className="h-4 bg-slate-100 rounded" />)}
                      </div>
                    ) : activeArticle === null ? (
                      <div className="text-center py-8">
                        <BookOpen className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="font-medium text-slate-700">Article not found</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveArticleSlug(null)}>
                          Go back
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-2">
                            {COLLECTION_ICONS[activeArticle.collection] ?? <BookOpen className="h-3.5 w-3.5" />}
                            {activeArticle.collection}
                          </span>
                          <h2 className="text-[16px] font-semibold text-slate-900">{activeArticle.title}</h2>
                          {activeArticle.summary && (
                            <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{activeArticle.summary}</p>
                          )}
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                          {activeArticle.body
                            ? renderMarkdownBody(activeArticle.body)
                            : <p className="text-sm text-slate-400 italic">Content coming soon.</p>
                          }
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <>
                {/* ── Home tab ────────────────────────────────────────────── */}
                {tab === "home" && (
                  <div className="flex-1 overflow-y-auto">
                    <div
                      className="px-5 py-6"
                      style={{ background: "linear-gradient(135deg, #243E63 0%, #1a2f4b 100%)" }}
                    >
                      <p className="text-[18px] font-semibold text-white leading-snug">Hi there! 👋</p>
                      <p className="text-[13px] text-white/70 mt-1">Ask us anything, or browse the help docs.</p>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Message CTA */}
                      <button
                        type="button"
                        onClick={() => setTab("messages")}
                        className="w-full rounded-xl border border-slate-100 bg-white p-4 flex items-center justify-between shadow-sm hover:border-slate-200 hover:shadow transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#243E63" }}>
                            <MessageCircle className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-slate-800">Send us a message</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">We typically reply within a few hours</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                      </button>

                      {/* Setup CTA */}
                      {!setupDismissed && !allSetupDone && (
                        <button
                          type="button"
                          onClick={() => setTab("setup")}
                          className="w-full rounded-xl border border-slate-100 bg-white p-4 flex items-center justify-between shadow-sm hover:border-slate-200 hover:shadow transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#C8A96E" }}>
                              <Zap className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-slate-800">Setup guide</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{doneSteps} of {totalSteps} steps complete</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
                              <circle cx="12" cy="12" r="9" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                              <circle cx="12" cy="12" r="9" fill="none" stroke="#C8A96E" strokeWidth="2.5"
                                strokeDasharray={`${Math.round((doneSteps / totalSteps) * 56.5)} 56.5`} />
                            </svg>
                            <ChevronRight className="h-4 w-4 text-slate-300" />
                          </div>
                        </button>
                      )}

                      {/* Quick help */}
                      <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 pt-3 pb-2 border-b border-slate-50">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Help articles</p>
                        </div>
                        <div className="p-2 space-y-0.5">
                          {(suggested ?? []).slice(0, 4).map((a) => (
                            <button
                              key={a._id}
                              type="button"
                              onClick={() => setActiveArticleSlug(a.slug)}
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left transition-colors"
                            >
                              <span className="text-[13px] text-slate-700 truncate">{a.title}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0 ml-2" />
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTab("help")}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left transition-colors"
                          >
                            <span className="text-[13px] font-medium" style={{ color: "#C8A96E" }}>View all articles</span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-2" style={{ color: "#C8A96E" }} />
                          </button>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-3 shadow-sm">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <p className="text-[13px] font-medium text-slate-800">All systems operational</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {new Date().toLocaleDateString("en-ZA", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Setup tab ───────────────────────────────────────────── */}
                {tab === "setup" && (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Progress header */}
                    <div className="px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-[12px] font-semibold text-slate-700">
                          {allSetupDone ? "All done — you're set! 🎉" : `${doneSteps} of ${totalSteps} steps complete`}
                        </p>
                        <button
                          type="button"
                          onClick={dismissSetup}
                          className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((doneSteps / totalSteps) * 100)}%`, background: "#C8A96E" }}
                        />
                      </div>
                    </div>

                    {/* Accordion sections */}
                    <ScrollArea className="flex-1">
                      <div className="p-3 space-y-2">
                        {sections.map((section) => {
                          const isOpen = openSections.has(section.id);
                          const sectionDone = section.steps.filter(s => s.done).length;
                          const sectionTotal = section.steps.length;
                          const allSectionDone = sectionDone === sectionTotal && !section.locked;

                          return (
                            <div
                              key={section.id}
                              className={cn(
                                "rounded-xl border overflow-hidden transition-all",
                                section.locked
                                  ? "border-slate-100 bg-slate-50/60"
                                  : isOpen
                                    ? "border-slate-300 bg-white shadow-sm"
                                    : "border-slate-100 bg-white hover:border-slate-200"
                              )}
                            >
                              {/* Section header */}
                              <button
                                type="button"
                                onClick={() => toggleSection(section.id, section.locked)}
                                className={cn(
                                  "w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors",
                                  section.locked ? "cursor-default" : "cursor-pointer"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Status indicator */}
                                  {allSectionDone ? (
                                    <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 bg-emerald-500">
                                      <CheckCircle2 className="h-3 w-3 text-white" />
                                    </div>
                                  ) : section.locked ? (
                                    <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 bg-slate-200">
                                      <Lock className="h-2.5 w-2.5 text-slate-400" />
                                    </div>
                                  ) : (
                                    <div
                                      className="h-5 w-5 rounded-full shrink-0 border-2 flex items-center justify-center"
                                      style={{ borderColor: "#C8A96E" }}
                                    >
                                      <div className="h-2 w-2 rounded-full" style={{ background: "#C8A96E" }} />
                                    </div>
                                  )}

                                  <span className={cn(
                                    "text-[13px] font-semibold leading-snug",
                                    section.locked ? "text-slate-400" : "text-slate-800"
                                  )}>
                                    {section.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {section.locked ? (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-400 uppercase tracking-wide">
                                      {section.lockedPlan}
                                    </span>
                                  ) : allSectionDone ? (
                                    <span className="text-[11px] font-medium text-emerald-600">Done</span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 font-medium">{sectionDone}/{sectionTotal}</span>
                                  )}
                                  {!section.locked && (
                                    isOpen
                                      ? <ChevronUp className="h-4 w-4 text-slate-400" />
                                      : <ChevronDown className="h-4 w-4 text-slate-400" />
                                  )}
                                </div>
                              </button>

                              {/* Steps */}
                              {isOpen && !section.locked && (
                                <div className="px-4 pb-3 space-y-1 border-t border-slate-100">
                                  {section.steps.map((step) => (
                                    step.locked ? (
                                      <div
                                        key={step.id}
                                        className="flex items-center gap-3 py-2.5 px-2 opacity-40"
                                      >
                                        <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className="text-[12.5px] text-slate-500 line-through">{step.label}</span>
                                      </div>
                                    ) : step.done ? (
                                      <div key={step.id} className="flex items-center gap-3 py-2.5 px-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                        <span className="text-[12.5px] text-slate-400 line-through">{step.label}</span>
                                      </div>
                                    ) : (
                                      <Link
                                        key={step.id}
                                        href={step.href}
                                        onClick={() => setOpen(false)}
                                        className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors group"
                                      >
                                        <div className="h-4 w-4 rounded-full border-2 border-slate-200 group-hover:border-slate-300 shrink-0 transition-colors" />
                                        <span className="text-[12.5px] font-medium text-slate-700 flex-1 leading-snug">{step.label}</span>
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </Link>
                                    )
                                  ))}

                                  {/* Upgrade CTA inside locked-plan sections */}
                                  {section.id === "billing" && !isPro && (
                                    <Link
                                      href="/settings?tab=billing"
                                      onClick={() => setOpen(false)}
                                      className="mt-2 flex items-center justify-center gap-1.5 w-full rounded-lg py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                                      style={{ background: "#C8A96E" }}
                                    >
                                      <Zap className="h-3.5 w-3.5" />
                                      Upgrade to Pro
                                    </Link>
                                  )}
                                </div>
                              )}

                              {/* Locked section expand — show upgrade prompt */}
                              {section.locked && (
                                <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-slate-100">
                                  {section.steps.map((step) => (
                                    <div key={step.id} className="flex items-center gap-3 py-2 px-2 opacity-40">
                                      <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                      <span className="text-[12.5px] text-slate-500">{step.label}</span>
                                    </div>
                                  ))}
                                  <Link
                                    href="/settings?tab=billing"
                                    onClick={() => setOpen(false)}
                                    className="mt-1 flex items-center justify-center gap-1.5 w-full rounded-lg py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                                    style={{ background: "#243E63" }}
                                  >
                                    Unlock with {section.lockedPlan}
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </Link>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* ── Messages tab ────────────────────────────────────────── */}
                {tab === "messages" && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <ScrollArea className="flex-1 px-4">
                      <div className="py-4 space-y-3">
                        {messages === undefined ? (
                          <div className="space-y-3 animate-pulse">
                            {[1,2,3].map(i => (
                              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                                <div className={`h-9 rounded-xl bg-slate-100 ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
                              </div>
                            ))}
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="text-center py-10">
                            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#243E63" }}>
                              <MessageCircle className="h-7 w-7 text-white" />
                            </div>
                            <p className="font-semibold text-slate-800">No messages yet</p>
                            <p className="text-[12px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                              Send us a message and we&apos;ll get back to you soon.
                            </p>
                          </div>
                        ) : (
                          messages.map((m) => (
                            <div key={m._id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                              {m.role !== "user" && (
                                <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mr-2 mt-auto" style={{ background: "#243E63" }}>
                                  <MessageCircle className="h-3.5 w-3.5 text-white" />
                                </div>
                              )}
                              <div
                                className={cn(
                                  "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                                  m.role === "user" ? "rounded-br-sm text-white" : "rounded-bl-sm bg-slate-100 text-slate-800"
                                )}
                                style={m.role === "user" ? { background: "#243E63" } : {}}
                              >
                                <p>{m.content}</p>
                                {m.isAutoReply && (
                                  <p className="text-[10px] text-slate-400 mt-1">auto-reply</p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    <div className="p-4 border-t border-slate-100 shrink-0">
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Type a message..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                          disabled={isSending}
                          className="flex-1 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-[13px]"
                        />
                        <Button
                          size="icon"
                          onClick={handleSend}
                          disabled={!messageInput.trim() || isSending}
                          className="rounded-xl h-10 w-10 shrink-0"
                          style={{ background: "#243E63" }}
                        >
                          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Help tab ────────────────────────────────────────────── */}
                {tab === "help" && (
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search help articles..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-[13px]"
                          autoFocus
                        />
                      </div>

                      {searchQuery.trim().length >= 2 ? (
                        (searchResults ?? []).length === 0 ? (
                          <div className="text-center py-8">
                            <Search className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                            <p className="text-[13px] text-slate-500">No articles match &ldquo;{searchQuery}&rdquo;</p>
                            <button
                              type="button"
                              onClick={() => { setSearchQuery(""); setTab("messages"); }}
                              className="mt-3 text-[12px] hover:underline"
                              style={{ color: "#C8A96E" }}
                            >
                              Send us a message instead
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(searchResults ?? []).map((a) => (
                              <button
                                key={a._id}
                                type="button"
                                onClick={() => setActiveArticleSlug(a.slug)}
                                className="w-full rounded-xl border border-slate-100 bg-white p-3.5 flex items-center justify-between hover:border-slate-200 hover:shadow-sm text-left transition-all"
                              >
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium text-slate-800 truncate">{a.title}</p>
                                  {a.summary && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{a.summary}</p>}
                                  <p className="text-[10px] text-slate-300 mt-0.5">{a.collection}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 ml-3" />
                              </button>
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="space-y-3">
                          {(collections ?? []).map((c) => (
                            <div key={c.collection} className="rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-50">
                                {COLLECTION_ICONS[c.collection] ?? <BookOpen className="h-4 w-4 text-slate-400" />}
                                <p className="text-[13px] font-semibold text-slate-800">{c.collection}</p>
                                <span className="ml-auto text-[11px] text-slate-400">
                                  {c.count} {c.count === 1 ? "article" : "articles"}
                                </span>
                              </div>
                              <div className="p-2 space-y-0.5">
                                {c.articles.map((a) => (
                                  <button
                                    key={a._id}
                                    type="button"
                                    onClick={() => setActiveArticleSlug(a.slug)}
                                    className="flex items-center justify-between w-full py-2.5 px-3 text-left rounded-lg hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className="block text-[13px] text-slate-700 truncate">{a.title}</span>
                                      {a.summary && (
                                        <span className="block text-[11px] text-slate-400 truncate mt-0.5">{a.summary}</span>
                                      )}
                                    </div>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0 ml-2" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}

            {/* ── Bottom nav ────────────────────────────────────────────────── */}
            {!activeArticleSlug && (
              <nav className="border-t border-slate-100 flex items-stretch bg-white shrink-0">
                {navTabs.map(({ id: t, label, icon: Icon }) => {
                  const isActive = tab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={cn(
                        "flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 relative transition-colors",
                        isActive ? "text-[#243E63]" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <span className="relative inline-block">
                        <Icon className="h-5 w-5" />
                        {t === "messages" && hasUnreadReplies && tab !== "messages" && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" aria-hidden />
                        )}
                        {t === "setup" && !setupDismissed && doneSteps < totalSteps && tab !== "setup" && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full" style={{ background: "#C8A96E" }} aria-hidden />
                        )}
                      </span>
                      <span className={cn("text-[10px] font-medium", isActive ? "text-[#243E63]" : "text-slate-400")}>
                        {label}
                      </span>
                      {isActive && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full" style={{ background: "#243E63" }} />
                      )}
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
