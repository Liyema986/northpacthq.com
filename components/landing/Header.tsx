"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

  const handleMobileNavClick = (href: string) => {
    setMobileOpen(false);
    setTimeout(() => {
      if (href.startsWith("#")) {
        const el = document.getElementById(href.replace("#", ""));
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          onSectionChange?.(href.replace("#", ""));
        }
      }
    }, 300);
  };

  const goDashboardOr = (path: string) => {
    router.push(isAuthenticated ? "/dashboard" : path);
  };

  return (
    <>
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

          {/* CTA buttons — right side (desktop) */}
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

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center size-10 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Full-screen mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[200] md:hidden bg-north-navy/98 backdrop-blur-xl flex flex-col"
          >
            {/* Overlay header — mirrors navbar */}
            <div className="flex items-center justify-between px-4 sm:px-6 min-h-[80px] h-[80px] flex-shrink-0">
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <Image
                  src="/logo1.png"
                  alt="NorthPact"
                  width={180}
                  height={48}
                  className="h-12 w-auto object-contain"
                />
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center size-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav links — vertically centered, large + tappable */}
            <nav className="flex-1 flex flex-col justify-center px-8 sm:px-12 gap-0">
              {NAV_ITEMS.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + i * 0.055, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => handleMobileNavClick(item.href)}
                  className={cn(
                    "text-left text-[22px] sm:text-[26px] font-medium py-4 border-b border-white/8 last:border-b-0 transition-colors",
                    activeSection === item.id
                      ? "text-north-gold"
                      : "text-white hover:text-north-gold"
                  )}
                >
                  {item.label}
                </motion.button>
              ))}
            </nav>

            {/* Auth buttons — pinned to bottom */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-3 px-8 sm:px-12 pb-10 pt-4 flex-shrink-0"
            >
              <button
                onClick={() => { setMobileOpen(false); goDashboardOr("/auth?tab=sign-up"); }}
                className="w-full h-[52px] rounded-full bg-north-gold text-white font-semibold text-[16px] hover:bg-north-gold/90 transition-colors"
              >
                Get Started Free
              </button>
              <button
                onClick={() => { setMobileOpen(false); goDashboardOr("/auth?tab=sign-in"); }}
                className="w-full h-[52px] rounded-full border border-white/25 text-white font-medium text-[16px] hover:bg-white/10 transition-colors"
              >
                Sign In
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
