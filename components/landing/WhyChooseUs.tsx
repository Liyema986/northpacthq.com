"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const REASONS = [
  {
    number: "01",
    title: "Proposals that close deals",
    body: "Every template, layout, and pricing block is designed to look sharp on any screen — so clients say yes before they finish reading.",
  },
  {
    number: "02",
    title: "Pricing that calculates itself",
    body: "Set your rates once. NorthPact handles markup, hours, and totals automatically — no spreadsheet juggling, no manual errors.",
  },
  {
    number: "03",
    title: "One home for every client",
    body: "Contacts, proposal history, and communications all in one place. Stop switching tabs; start closing faster.",
  },
  {
    number: "04",
    title: "Know exactly when to follow up",
    body: "Real-time read receipts tell you the moment a client opens your proposal — so you reach out while the deal is still warm.",
  },
];

const STATS = [
  { value: "10×", label: "faster proposal creation" },
  { value: "37%", label: "higher avg. close rate" },
  { value: "2 min", label: "to your first proposal" },
  { value: "98%", label: "client satisfaction rate" },
];

export function WhyChooseUs() {
  const router = useRouter();

  return (
    <section id="why-choose-us" className="w-full bg-white">
      <div className="w-full px-6 md:px-14 py-12 md:py-16">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch">

          {/* ── LEFT ───────────────────────────────────────────────────── */}
          <div className="flex flex-col pr-0 lg:pr-16 border-b lg:border-b-0 lg:border-r border-slate-100 pb-10 lg:pb-0">

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="mb-6 md:mb-8"
            >
              <span className="inline-block text-[11px] font-bold tracking-[0.22em] uppercase mb-3 text-north-gold">
                Why NorthPact
              </span>
              <h2
                className="text-slate-900 font-bold leading-[1.06] text-[1.7rem] sm:text-[2rem] md:text-[2.4rem] lg:text-[2.75rem]"
              >
                Built for firms that{" "}
                <em className="not-italic text-north-gold">refuse</em>{" "}
                to lose deals on paperwork.
              </h2>
            </motion.div>

            <div className="flex flex-col divide-y divide-slate-100 flex-1">
              {REASONS.map((r, i) => (
                <motion.div
                  key={r.number}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="flex gap-4 md:gap-5 py-4 group"
                >
                  <span className="text-[11px] font-bold tabular-nums mt-0.5 shrink-0 w-5 text-north-gold">
                    {r.number}
                  </span>
                  <div>
                    <h3 className="text-slate-900 font-semibold text-[14px] mb-1 group-hover:text-north-gold transition-colors duration-200">
                      {r.title}
                    </h3>
                    <p className="text-slate-500 text-[13px] leading-relaxed">{r.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── RIGHT ──────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="flex flex-col justify-between pl-0 lg:pl-16 pt-8 md:pt-10 lg:pt-0"
          >
            {/* 2×2 stat grid — fills the full right half */}
            <div className="grid grid-cols-2 gap-px bg-slate-100 rounded-2xl overflow-hidden flex-1">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.09 }}
                  className="flex flex-col justify-between bg-white p-4 sm:p-6 md:p-8"
                >
                  <div>
                    <span
                      className="font-bold leading-none tabular-nums text-[1.8rem] sm:text-[2.2rem] md:text-[2.8rem] lg:text-[3.25rem]"
                      style={{ color: "#0F172A" }}
                    >
                      {s.value}
                    </span>
                    <p className="text-slate-400 text-[12px] sm:text-[13px] mt-1.5 md:mt-2 leading-snug">{s.label}</p>
                  </div>
                  <div className="mt-4 sm:mt-6 h-[2px] w-8 sm:w-10 rounded-full bg-north-gold" />
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.5 }}
              className="mt-6 pt-6 border-t border-slate-100"
            >
              <p className="text-slate-500 text-[13px] leading-relaxed mb-4">
                No credit card required. Be up and running in under 2 minutes.
              </p>
              <Button
                onClick={() => router.push("/auth")}
                className="rounded-full font-semibold text-[14px] h-[46px] px-7 gap-2 group bg-north-gold text-white hover:bg-north-gold/90"
              >
                Start for free
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
