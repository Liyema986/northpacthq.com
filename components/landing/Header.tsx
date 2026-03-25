"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { useState } from "react";

interface HeaderProps {
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

/** Must match section `id`s on the homepage (`app/page.tsx` order). No #templates — that section is not on the page. */
const NAV_ITEMS = [
  { id: "hero", label: "Home", href: "#hero" },
  { id: "why-choose-us", label: "Why NorthPact", href: "#why-choose-us" },
  { id: "workflow", label: "Features", href: "#workflow" },
  { id: "how-it-works", label: "How It Works", href: "#how-it-works" },
  { id: "pricing", label: "Pricing", href: "#pricing" },
  { id: "testimonials", label: "Testimonials", href: "#testimonials" },
];

export function Header({ activeSection, onSectionChange }: HeaderProps) {
  const router = useRouter();
  const { isAuthenticated } = useNorthPactAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const el = document.getElementById(href.replace("#", ""));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        onSectionChange?.(href.replace("#", ""));
      }
      setMobileOpen(false);
    }
  };

  const goDashboardOr = (path: string) => {
    router.push(isAuthenticated ? "/dashboard" : path);
  };

  return (
    <header className="w-full relative z-50">
      <div className="relative w-full mx-auto px-4 md:px-8 flex items-center justify-between min-h-[80px] h-[80px] md:min-h-[88px] md:h-[88px]">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/logo1.png"
            alt="NorthPact"
            width={220}
            height={56}
            className="h-14 sm:h-16 md:h-20 w-auto max-w-[min(100%,280px)] md:max-w-[340px] object-contain object-left"
            priority
          />
        </Link>

        {/* Desktop nav — centered absolutely so it's always in the middle */}
        <nav className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className={cn(
                "text-[14px] leading-normal transition-colors whitespace-nowrap px-3 py-1.5 rounded-full",
                activeSection === item.id
                  ? "text-north-gold font-semibold"
                  : "text-north-gray hover:text-white font-normal"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* CTA buttons — right side */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            onClick={() => goDashboardOr("/auth?tab=sign-in")}
            className="rounded-full text-white hover:bg-white/10 hover:text-white font-semibold text-[16px] h-10 px-6"
          >
            Sign In
          </Button>
          <Button
            onClick={() => goDashboardOr("/auth?tab=sign-up")}
            className="rounded-full bg-north-gold text-north-navy hover:bg-north-gold/90 font-semibold text-[16px] h-10 px-6 shadow-none"
          >
            Sign Up
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-north-gray hover:text-white p-2"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden backdrop-blur-md px-4 pb-6 pt-2 border-t border-north-gold/20 bg-north-navy/95">
          <nav className="flex flex-col gap-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="text-north-gray hover:text-white text-[18px] py-2 font-normal"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex gap-3 mt-2">
              <Button
                variant="ghost"
                onClick={() => { goDashboardOr("/auth?tab=sign-in"); setMobileOpen(false); }}
                className="flex-1 rounded-full border border-white/30 text-white hover:bg-white/10 hover:text-white font-semibold h-11 text-[16px]"
              >
                Sign In
              </Button>
              <Button
                onClick={() => { goDashboardOr("/auth?tab=sign-up"); setMobileOpen(false); }}
                className="flex-1 rounded-full bg-north-gold text-north-navy hover:bg-north-gold/90 font-semibold h-11 text-[16px]"
              >
                Sign Up
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
