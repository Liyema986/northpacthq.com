"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "NorthPact cut our proposal time from days to minutes. Our win rate improved by 30% and clients love how professional everything looks.",
    name: "Sarah Chen",
    role: "Creative Director",
    company: "Chen Design Studio",
    avatar: "https://i.pravatar.cc/100?u=sarah-chen",
  },
  {
    quote: "We manage dozens of clients across multiple retainers. Having proposals, pricing, and e-signatures all in one place has completely changed how we operate.",
    name: "Marcus Webb",
    role: "CEO",
    company: "Webb Consulting",
    avatar: "https://i.pravatar.cc/100?u=marcus-webb",
  },
  {
    quote: "I switched from spreadsheets and Word docs and never looked back. The builder is so fast — I send a proposal the same day I get on a discovery call.",
    name: "Elena Rodriguez",
    role: "Freelance Brand Strategist",
    company: "Independent",
    avatar: "https://i.pravatar.cc/100?u=elena-rod",
  },
  {
    quote: "The read-receipt feature alone paid for itself. I know exactly when to follow up and closed two deals this month I would have otherwise lost.",
    name: "James Okafor",
    role: "Managing Partner",
    company: "Okafor & Associates",
    avatar: "https://i.pravatar.cc/100?u=james-ok",
  },
  {
    quote: "Our proposals used to take half a day. Now they take twenty minutes. The templates are clean, the branding is on point, and clients sign faster.",
    name: "Priya Sharma",
    role: "Head of Growth",
    company: "Luminary Agency",
    avatar: "https://i.pravatar.cc/100?u=priya-sh",
  },
  {
    quote: "We trialled three tools before landing on NorthPact. Nothing else came close to this level of polish and simplicity at the same time.",
    name: "David Kim",
    role: "Founder",
    company: "Strata Advisory",
    avatar: "https://i.pravatar.cc/100?u=david-kim",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: i * 0.08,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

export function Testimonials() {
  return (
    <section id="testimonials" className="w-full bg-white">
      <div className="w-full px-6 md:px-14 py-14 md:py-16">

        {/* ── Label + headline ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <span className="inline-block text-[11px] font-bold tracking-[0.22em] uppercase mb-3 text-north-gold">
            Testimonials
          </span>
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-20">
            <h2
              className="text-slate-900 font-bold leading-[1.06] flex-1"
              style={{ fontSize: "clamp(1.8rem, 3.2vw, 44px)" }}
            >
              Firms that switched.{" "}
              <span className="text-north-gold">Never looked back.</span>
            </h2>
            <p
              className="text-slate-500 leading-relaxed max-w-[380px] lg:pb-1"
              style={{ fontSize: "clamp(0.875rem, 1.3vw, 15px)" }}
            >
              2,000+ professionals trust NorthPact to win their most
              important deals.
            </p>
          </div>
        </motion.div>

        {/* ── Testimonial grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={cardVariants}
              className="flex flex-col gap-4 rounded-[16px] p-5 bg-white border border-slate-100 hover:border-north-gold/30 hover:shadow-sm transition-all duration-200"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-north-gold text-north-gold" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-slate-700 text-[13px] leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Person */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-slate-900 text-[14px] font-semibold leading-tight truncate">
                    {t.name}
                  </span>
                  <span className="text-slate-400 text-[12px] leading-tight truncate">
                    {t.role} · {t.company}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
