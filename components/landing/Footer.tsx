"use client";

import Link from "next/link";
import Image from "next/image";

const LINKS = {
  Product: [
    { label: "Proposals", href: "/auth" },
    { label: "Clients", href: "/auth" },
    { label: "Pricing", href: "#pricing" },
    { label: "Features", href: "#workflow" },
  ],
  Company: [
    { label: "About", href: "#why-choose-us" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Testimonials", href: "#testimonials" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="w-full bg-north-gray/20 border-t border-north-navy/8">

      {/* ── Top section ──────────────────────────────────────────── */}
      <div className="w-full px-5 sm:px-6 md:px-8 pt-10 sm:pt-12 md:pt-16 pb-8 sm:pb-10">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-8 md:gap-10">

          {/* Brand */}
          <div className="flex flex-col gap-3 sm:gap-4 lg:max-w-[280px]">
            <Link href="/" className="flex w-fit items-center">
              <Image
                src="/logo3.png"
                alt="NorthPact"
                width={200}
                height={60}
                className="object-contain object-left h-9 sm:h-10 md:h-11 w-auto"
              />
            </Link>
            <p className="text-[14px] sm:text-[15px] leading-[1.6] tracking-[-0.16px] text-slate-500 max-w-[280px]">
              Create, send, and track professional proposals. Close deals faster.
            </p>
          </div>

          {/* Link columns — stacked on mobile, row on sm+ */}
          <div className="flex flex-col gap-7 sm:flex-row sm:flex-wrap sm:gap-10 lg:gap-16 lg:ml-auto">
            {Object.entries(LINKS).map(([title, links]) => (
              <div key={title} className="flex flex-col gap-3">
                <p className="text-[14px] sm:text-[15px] leading-[1.4] tracking-[-0.3px] text-north-navy font-semibold">
                  {title}
                </p>
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  {links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="text-[14px] sm:text-[14px] leading-[1.5] tracking-[-0.12px] text-slate-500 hover:text-north-gold transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Full-width divider */}
      <div className="h-px w-full bg-north-navy/8" />

      {/* ── Bottom bar ────────────────────────────────────────────── */}
      <div className="w-full px-5 sm:px-6 md:px-8 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <p className="text-[13px] leading-[1.5] tracking-[-0.12px] text-slate-400">
            &copy; {new Date().getFullYear()} NorthPact. All rights reserved.
          </p>
          <div className="hidden sm:flex items-center gap-5">
            {[
              { label: "Privacy Policy", href: "#" },
              { label: "Terms of Service", href: "#" },
              { label: "Cookies", href: "#" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[13px] leading-[1.5] tracking-[-0.12px] text-slate-400 hover:text-north-gold transition-colors duration-150"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

    </footer>
  );
}
