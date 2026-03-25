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
    <footer className="w-full bg-north-gray/25 border-t border-north-navy/10">
      <div className="w-full mx-auto px-4 md:px-8 pt-12 pb-8">

        {/* ── Top row ───────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-24 mb-10">

          {/* Brand — larger logo, left-aligned with page content */}
          <div className="lg:w-[300px] shrink-0 flex flex-col gap-3">
            <Link href="/" className="flex w-fit items-center">
              <Image
                src="/logo3.png"
                alt="NorthPact"
                width={200}
                height={60}
                className="object-contain object-left h-11 sm:h-[52px] w-auto max-w-[min(100%,300px)]"
              />
            </Link>

            <p className="text-slate-400 text-[13px] leading-relaxed max-w-[280px]">
              Create, send, and track professional proposals. Close deals faster.
            </p>
          </div>

          {/* Link columns */}
          <div className="flex gap-16 lg:gap-24 lg:ml-auto">
            {Object.entries(LINKS).map(([title, links]) => (
              <div key={title} className="flex flex-col gap-3">
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-north-navy">
                  {title}
                </span>
                <ul className="flex flex-col gap-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-slate-500 text-[13px] hover:text-north-gold transition-colors duration-150"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Full-width divider — touches both edges */}
      <div className="w-full h-px bg-north-navy/10" />

      {/* ── Bottom bar ────────────────────────────────────────── */}
      <div className="w-full mx-auto px-4 md:px-8 py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-slate-400 text-[12px]">
            &copy; {new Date().getFullYear()} NorthPact. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {["Privacy", "Terms", "Cookies"].map((item) => (
              <Link
                key={item}
                href="#"
                className="text-slate-500 text-[12px] hover:text-north-gold transition-colors duration-150"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>

    </footer>
  );
}
