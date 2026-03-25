"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, FileText, Users, Package, ClipboardList, BarChart3, TrendingUp, Settings, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** North Star Seal — navy / gold / soft gray accents */
const QUICK_ACTIONS = [
  { id: "proposals",          title: "Proposals",           description: "Create and track client proposals",        href: "/proposals",           icon: FileText,      color: "bg-[#C8A96E]/20 text-[#243E63]" },
  { id: "new-proposal",       title: "New Proposal",        description: "Build a new proposal for a client",        href: "/proposals/new",       icon: FileText,      color: "bg-[#243E63]/12 text-[#243E63]" },
  { id: "clients",            title: "Clients",             description: "Manage your client groups",                href: "/clients",             icon: Users,         color: "bg-[#D9D4CE]/50 text-[#243E63]" },
  { id: "services",           title: "Services",            description: "Service catalog and pricing templates",    href: "/services",            icon: Package,       color: "bg-[#C8A96E]/15 text-[#243E63]" },
  { id: "engagement-letters", title: "Engagement Letters",  description: "Client agreements and signatures",         href: "/engagement-letters",  icon: ClipboardList, color: "bg-[#243E63]/10 text-[#243E63]" },
  { id: "work-planning",      title: "Work Planning",       description: "Schedule and track deliverables",          href: "/work-planning",       icon: BarChart3,     color: "bg-[#D9D4CE]/40 text-[#243E63]" },
  { id: "cash-flow",          title: "Cash Flow",           description: "Revenue monitoring and projections",     href: "/cash-flow",           icon: TrendingUp,    color: "bg-[#C8A96E]/12 text-[#243E63]" },
  { id: "settings",           title: "Settings",            description: "Firm profile and preferences",             href: "/settings?tab=org",    icon: Settings,      color: "bg-muted text-muted-foreground" },
];

export function HeaderSearch() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim().length > 0
    ? QUICK_ACTIONS.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase())
      )
    : QUICK_ACTIONS;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Input */}
      <div className="flex items-center gap-2 w-full px-3 py-1.5 bg-muted/50 rounded-md border border-border transition-colors focus-within:bg-muted focus-within:border-border/80">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          className="flex-1 h-6 px-0 text-sm bg-transparent border-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="p-0.5 rounded hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-background border border-border rounded text-muted-foreground shrink-0">
            <span>⌘</span>K
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          <div className="max-h-80 overflow-y-auto p-2">
            <p className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {search ? "Results" : "Quick Navigation"}
            </p>
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No results for &quot;{search}&quot;</p>
              </div>
            ) : (
              filtered.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  onClick={() => { setOpen(false); setSearch(""); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted transition-colors"
                >
                  <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg shrink-0", action.color)}>
                    <action.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))
            )}
          </div>
          <div className="border-t border-border px-4 py-2 text-center bg-muted/30">
            <p className="text-[11px] text-muted-foreground">NorthPact Search</p>
          </div>
        </div>
      )}
    </div>
  );
}
