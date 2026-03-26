"use client";

import { motion } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Marquee from "react-fast-marquee";

const CTA_TESTIMONIALS = [
  { name: "Sarah Chen", avatar: "https://i.pravatar.cc/100?u=sarah", quote: "Cut our proposal time from days to minutes." },
  { name: "Marcus Webb", avatar: "https://i.pravatar.cc/100?u=marcus", quote: "A game-changer for our consulting firm." },
  { name: "Elena Rodriguez", avatar: "https://i.pravatar.cc/100?u=elena", quote: "Clients love the professional look and feel." },
  { name: "James Okafor", avatar: "https://i.pravatar.cc/100?u=james", quote: "Win rate improved by 30% in 3 months." },
  { name: "Priya Sharma", avatar: "https://i.pravatar.cc/100?u=priya", quote: "Finally, one place for all our proposals." },
  { name: "David Kim", avatar: "https://i.pravatar.cc/100?u=david", quote: "The best investment we made this year." },
  { name: "Lisa van Wyk", avatar: "https://i.pravatar.cc/100?u=lisa", quote: "So intuitive, the whole team adopted it instantly." },
  { name: "Tom Ndlovu", avatar: "https://i.pravatar.cc/100?u=tom", quote: "Closed our biggest deal using NorthPact." },
];

const CIRCLES: { size: number; top: string; left?: string; right?: string; bg: string }[] = [
  { size: 80, top: "16%", left: "3%",  bg: "bg-north-gray/30" },
  { size: 56, top: "52%", left: "1%",  bg: "bg-north-gold/20" },
  { size: 44, top: "74%", left: "4%",  bg: "bg-white/12" },
  { size: 68, top: "16%", right: "3%", bg: "bg-north-gold/18" },
  { size: 80, top: "52%", right: "1%", bg: "bg-north-gray/25" },
  { size: 52, top: "74%", right: "4%", bg: "bg-white/10" },
];

export function CTA() {
  return (
    <section id="cta" className="relative w-full overflow-hidden flex flex-col bg-north-navy">
      {/* Decorative circles — compact, same style as hero */}
      {CIRCLES.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
          className={`absolute rounded-full pointer-events-none hidden md:block ${c.bg}`}
          style={{
            width: c.size,
            height: c.size,
            top: c.top,
            ...(c.left ? { left: c.left } : {}),
            ...(c.right ? { right: c.right } : {}),
          }}
        />
      ))}

      {/* Main content */}
      <div className="relative z-10 w-full mx-auto px-6 md:px-14 py-12 md:py-16 flex flex-col items-center text-center gap-3">

        {/* Label */}
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="inline-flex items-center rounded-full border border-north-gold/40 bg-north-gold/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-north-gold"
        >
          Start for free · No credit card needed
        </motion.span>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="text-white font-semibold w-full mt-1 text-[1.7rem] sm:text-[2.2rem] md:text-[3rem] lg:text-[3.625rem] leading-[1.05]"
        >
          Your next deal is{" "}
          <span className="text-north-gold">one proposal away.</span>
        </motion.h2>

        {/* Body */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="text-north-gray/80 max-w-[560px] w-full text-[14px] md:text-[15px] leading-[1.65]"
        >
          Join 2,000+ professionals creating proposals that win. Start free — no credit card needed.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.26 }}
          className="flex flex-col sm:flex-row gap-2.5 mt-3 w-full sm:w-auto"
        >
          <Button
            asChild
            className="w-full sm:w-auto rounded-full font-semibold text-[15px] sm:text-[14px] h-[52px] sm:h-[46px] px-8 gap-2 group bg-north-gold text-north-navy hover:bg-north-gold/90 shadow-none transition-transform hover:scale-[1.02]"
          >
            <Link href="/auth" className="flex items-center gap-2">
              Get started free
              <ArrowRight className="h-4 w-4 sm:h-3.5 sm:w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>

          <Button
            asChild
            variant="ghost"
            className="w-full sm:w-auto rounded-full font-semibold text-[15px] sm:text-[14px] h-[52px] sm:h-[46px] px-8 text-white hover:text-white hover:bg-north-gold/15 border border-north-gold/60 hover:border-north-gold"
          >
            <Link href="#pricing">View pricing</Link>
          </Button>
        </motion.div>

        {/* Social proof + disclaimer in one row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.38, duration: 0.45 }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-3"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-north-gold bg-white/10 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.pravatar.cc/100?u=${i + 20}`} alt="User" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[1,2,3,4,5].map((i) => (
                  <Star key={i} className="w-3 h-3 fill-north-gold text-north-gold" />
                ))}
              </div>
              <p className="text-north-gray/70 text-[12px]">2,000+ professionals</p>
            </div>
          </div>
          <span className="text-north-gray/30 hidden sm:block">·</span>
          <p className="text-north-gray/40 text-[11px]">Free forever on Starter &nbsp;·&nbsp; Upgrade any time</p>
        </motion.div>

      </div>

      {/* Testimonial marquee — same as hero, compact */}
      <div className="relative z-10 w-full overflow-hidden py-4 border-t border-north-gold/25">
        <Marquee gradient={false} speed={32} pauseOnHover>
          <div className="flex items-center shrink-0 gap-6 pr-6">
            {CTA_TESTIMONIALS.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-north-gray/10 backdrop-blur-sm rounded-full py-2 px-4 shrink-0 border border-north-gold/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-7 h-7 rounded-full object-cover border-2 border-north-gold/40 shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <p className="text-north-gray italic text-[12px] leading-tight truncate max-w-[200px]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <span className="text-white/70 text-[10px] font-medium mt-0.5">{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </Marquee>
      </div>
    </section>
  );
}
