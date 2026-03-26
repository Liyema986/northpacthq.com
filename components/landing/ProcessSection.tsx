"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const STEPS = [
  {
    number: "01",
    title: "Build your proposal",
    body: "Open the builder, drag in your services, set your pricing, and apply your branding. Your first proposal takes under 5 minutes. Every one after that takes less.",
    aside: "50+ templates to start from — or build your own from scratch.",
  },
  {
    number: "02",
    title: "Send a live link",
    body: "No PDF attachments. No email threads. Share a single secure link — your client opens a polished, interactive proposal that looks perfect on any device.",
    aside: "Password protection and expiry dates available on every link.",
  },
  {
    number: "03",
    title: "Watch them engage",
    body: "You get notified the moment they open it. See time spent per section. Know exactly when to follow up — before they've had a chance to go cold.",
    aside: "Real-time read receipts and per-section engagement tracking.",
  },
  {
    number: "04",
    title: "Close and get paid",
    body: "One click to sign. One click to pay. The moment a client accepts, you capture their e-signature and collect a deposit — simultaneously, automatically.",
    aside: "Legally binding signatures. Stripe-powered payments. Zero friction.",
  },
];

export function ProcessSection() {
  const router = useRouter();

  return (
    <section id="how-it-works" className="w-full bg-white">
      <div className="w-full px-6 md:px-14 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

          {/* ── LEFT — label + headline + CTA ───────────────────── */}
          <div className="flex flex-col pr-0 lg:pr-16 border-b lg:border-b-0 lg:border-r border-slate-100 pb-10 lg:pb-0">

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="mb-5 md:mb-6"
            >
              <span className="inline-block text-[11px] font-bold tracking-[0.22em] uppercase mb-3 text-north-gold">
                How it works
              </span>
              <h2
                className="text-slate-900 font-bold leading-[1.06] text-[1.7rem] sm:text-[2rem] md:text-[2.4rem] lg:text-[2.75rem]"
              >
                From blank page to{" "}
                <em className="not-italic text-north-gold">signed deal</em>{" "}
                in four steps.
              </h2>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-slate-500 text-[14px] leading-relaxed mb-6 md:mb-8"
            >
              No steep learning curve. No consultants. Just open NorthPact, follow the steps, and send a proposal your clients will actually read — and sign.
            </motion.p>

            {/* Quick stats */}
            <div className="flex flex-col divide-y divide-slate-100 mb-6 md:mb-8">
              {[
                { value: "2 min", label: "to your first proposal" },
                { value: "50+", label: "professional templates included" },
                { value: "1-click", label: "sign and collect payment instantly" },
              ].map((s, i) => (
                <motion.div
                  key={s.value}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                  className="flex items-center gap-4 py-3.5 md:py-4"
                >
                  <span className="text-[20px] sm:text-[22px] font-bold tabular-nums text-north-gold leading-none shrink-0 w-14 sm:w-16">
                    {s.value}
                  </span>
                  <span className="text-slate-500 text-[13px] leading-snug">{s.label}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.3 }}
              className="pt-5 md:pt-6 border-t border-slate-100"
            >
              <Button
                onClick={() => router.push("/auth")}
                className="w-full sm:w-auto h-[52px] sm:h-[46px] rounded-full font-semibold text-[15px] sm:text-[14px] gap-2 group bg-north-gold text-north-navy hover:bg-north-gold/90"
              >
                Start your first proposal
                <ArrowRight className="h-4 w-4 sm:h-3.5 sm:w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
              <p className="text-slate-400 text-[12px] mt-3">
                Free forever on the starter plan &nbsp;·&nbsp; No credit card needed
              </p>
            </motion.div>
          </div>

          {/* ── RIGHT — 4 steps ──────────────────────────────────── */}
          <div className="flex flex-col divide-y divide-slate-100 pl-0 lg:pl-16 pt-8 md:pt-10 lg:pt-0">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="group flex gap-4 md:gap-5 py-4 md:py-5"
              >
                <span className="text-[11px] font-bold tabular-nums mt-0.5 shrink-0 w-5 text-north-gold">
                  {step.number}
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-slate-900 font-semibold text-[14px] group-hover:text-north-gold transition-colors duration-200">
                    {step.title}
                  </h3>
                  <p className="text-slate-500 text-[13px] leading-relaxed">
                    {step.body}
                  </p>
                  <p className="text-slate-400 text-[12px] leading-relaxed border-l-2 border-north-gold/40 pl-3 mt-1">
                    {step.aside}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
